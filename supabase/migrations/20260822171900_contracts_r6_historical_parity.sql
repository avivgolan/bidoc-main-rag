-- BIDoc Contracts R6 historical parity and CTO-facing verification.
-- Normalizes legacy clause tags, exposes only stale embedding work, and adds
-- a read-only per-contract parity view. It performs no Schedule/Indicator writes.

begin;

do $preconditions$
begin
  if to_regclass('private.contracts_documents') is null
     or to_regclass('private.contracts') is null
     or to_regclass('private.contract_tag_catalog') is null
     or to_regprocedure('private.bidoc_contracts_r6_document_embedding_input(private.contracts_documents)') is null
     or to_regprocedure('private.bidoc_contracts_r6_decision_embedding_input(private.contracts)') is null
     or to_regprocedure('public.bidoc_contracts_r6_apply_embeddings_v1(uuid,jsonb)') is null then
    raise exception using
      errcode = '42P01',
      message = 'Contracts R6 historical parity requires the approved R6 Phase 3 and Phase 4A schema';
  end if;
end
$preconditions$;

create temporary table bidoc_contracts_r6_legacy_tag_map (
  legacy_tag text primary key,
  tag_he text not null
) on commit drop;

insert into bidoc_contracts_r6_legacy_tag_map (legacy_tag, tag_he)
values
  ('appendix', 'מסמך'),
  ('approval', 'אישור'),
  ('authorization', 'אישור'),
  ('bond', 'ניהול_סיכונים'),
  ('change', 'שינוי_חוזה'),
  ('commercial', 'כספים'),
  ('communication', 'תקשורת'),
  ('compliance', 'בקרה'),
  ('completion', 'ביצוע'),
  ('confidentiality', 'חוזה'),
  ('coordination', 'תיאום'),
  ('definitions', 'חוזה'),
  ('delay', 'עיכוב'),
  ('dispute', 'דיון'),
  ('document_context', 'תיעוד'),
  ('documents', 'מסמך'),
  ('execution', 'ביצוע'),
  ('extension', 'שינוי_חוזה'),
  ('insurance', 'ניהול_סיכונים'),
  ('liability', 'ניהול_סיכונים'),
  ('milestone', 'לוח_זמנים'),
  ('notice', 'עדכון'),
  ('other', 'חוזה'),
  ('ownership', 'ניהול'),
  ('parties', 'חוזה'),
  ('payment', 'תשלום'),
  ('quality', 'איכות'),
  ('responsibility', 'ניהול'),
  ('safety', 'בטיחות'),
  ('schedule', 'לוח_זמנים'),
  ('scope', 'תוכנית_עבודה'),
  ('storage', 'ניהול_מלאי'),
  ('termination', 'חוזה'),
  ('warranty', 'תחזוקה');

do $catalog_preflight$
begin
  if exists (
    select 1
    from bidoc_contracts_r6_legacy_tag_map mapping
    left join private.contract_tag_catalog catalog
      on catalog.tag_he = mapping.tag_he
     and catalog.active
    where catalog.tag_he is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'A historical Contracts tag mapping is missing from the active Hebrew catalog';
  end if;

  if exists (
    select 1
    from private.contracts_documents item
    cross join lateral unnest(coalesce(item.hashtags, '{}'::text[])) source(tag)
    left join private.contract_tag_catalog catalog
      on catalog.tag_he = source.tag
     and catalog.active
    left join bidoc_contracts_r6_legacy_tag_map mapping
      on mapping.legacy_tag = source.tag
    where catalog.tag_he is null
      and mapping.legacy_tag is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'An unmapped Contracts clause tag is outside the active Hebrew catalog';
  end if;
end
$catalog_preflight$;

create temporary table bidoc_contracts_r6_normalized_document_tags
on commit drop
as
select
  item.id,
  coalesce(array_agg(normalized.tag order by normalized.first_ordinal), '{}'::text[]) as hashtags
from private.contracts_documents item
cross join lateral (
  select
    coalesce(mapping.tag_he, source.tag) as tag,
    min(source.ordinality) as first_ordinal
  from unnest(coalesce(item.hashtags, '{}'::text[])) with ordinality source(tag, ordinality)
  left join bidoc_contracts_r6_legacy_tag_map mapping
    on mapping.legacy_tag = source.tag
  group by coalesce(mapping.tag_he, source.tag)
) normalized
group by item.id;

do $content_preflight$
begin
  if exists (
    select 1
    from private.contracts_documents item
    join bidoc_contracts_r6_normalized_document_tags normalized using (id)
    where item.hashtags is distinct from normalized.hashtags
      and item.content !~ '(^|\n)תגיות:[^\n]*'
  ) then
    raise exception using
      errcode = '23514',
      message = 'A historical Contracts clause cannot be normalized because its deterministic tags line is missing';
  end if;
end
$content_preflight$;

update private.contracts_documents item
set hashtags = normalized.hashtags,
    content = pg_catalog.regexp_replace(
      item.content,
      '(^|\n)תגיות:[^\n]*',
      E'\\1תגיות: ' || pg_catalog.array_to_string(normalized.hashtags, ' ')
    ),
    metadata = pg_catalog.jsonb_set(
      coalesce(item.metadata, '{}'::jsonb),
      '{r6HistoricalParity}',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 'contracts-r6-historical-parity.v1',
        'originalHashtags', pg_catalog.to_jsonb(item.hashtags),
        'normalizedHashtags', pg_catalog.to_jsonb(normalized.hashtags)
      ),
      true
    ),
    embedding = null,
    embedding_input_sha256 = null
from bidoc_contracts_r6_normalized_document_tags normalized
where normalized.id = item.id
  and item.hashtags is distinct from normalized.hashtags;

do $catalog_postflight$
begin
  if exists (
    select 1
    from private.contracts_documents item
    cross join lateral unnest(coalesce(item.hashtags, '{}'::text[])) source(tag)
    left join private.contract_tag_catalog catalog
      on catalog.tag_he = source.tag
     and catalog.active
    where catalog.tag_he is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Contracts clause tag normalization left a value outside the active Hebrew catalog';
  end if;
end
$catalog_postflight$;

create or replace function public.bidoc_contracts_r6_embedding_work_v2(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;

  return pg_catalog.jsonb_build_object(
    'schemaVersion', 'contracts-r6-embedding-work.v2',
    'items', coalesce((
      with source_items as (
        select
          'document'::text as kind,
          item.id,
          private.bidoc_contracts_r6_document_embedding_input(item) as input,
          item.embedding,
          item.embedding_input_sha256
        from private.contracts_documents item
        where item.workspace_id = p_workspace_id
          and item.processing_status = 'processed'

        union all

        select
          'decision'::text as kind,
          item.id,
          private.bidoc_contracts_r6_decision_embedding_input(item) as input,
          item.embedding,
          item.embedding_input_sha256
        from private.contracts item
        where item.workspace_id = p_workspace_id
      ), work_items as (
        select
          source.kind,
          source.id,
          source.input,
          source.embedding,
          source.embedding_input_sha256,
          pg_catalog.encode(
            pg_catalog.sha256(pg_catalog.convert_to(source.input, 'UTF8')),
            'hex'
          ) as input_sha256
        from source_items source
        where nullif(pg_catalog.btrim(source.input), '') is not null
      )
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'kind', item.kind,
          'id', item.id,
          'input', item.input,
          'inputSha256', item.input_sha256
        )
        order by item.kind, item.id
      )
      from work_items item
      where item.embedding is null
         or public.vector_dims(item.embedding) is distinct from 3072
         or item.embedding_input_sha256 is distinct from item.input_sha256
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.bidoc_contracts_r6_embedding_work_v2(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_r6_embedding_work_v2(uuid) to service_role;

create or replace view private.contracts_workspace_parity_r6_v1
with (security_invoker = true)
as
with latest_decisions as (
  select distinct on (
    item.workspace_id,
    item.document_version_id,
    item.parser_generation_id,
    item.decision_key
  ) item.*
  from private.contracts item
  order by
    item.workspace_id,
    item.document_version_id,
    item.parser_generation_id,
    item.decision_key,
    item.revision desc
), document_metrics as (
  select
    item.workspace_id,
    count(*) filter (where item.processing_status = 'processed')::integer as document_rows,
    count(*) filter (
      where item.processing_status = 'processed'
        and item.project_id is not null
        and nullif(pg_catalog.btrim(item.attachment_id), '') is not null
        and nullif(pg_catalog.btrim(item.document_name), '') is not null
        and nullif(pg_catalog.btrim(item.content), '') is not null
        and pg_catalog.jsonb_typeof(item.metadata) = 'object'
        and item.chunk_index is not null
        and item.chunk_total is not null
    )::integer as required_fields_ready_rows,
    count(*) filter (
      where item.processing_status = 'processed'
        and item.embedding is not null
        and public.vector_dims(item.embedding) = 3072
        and item.embedding_input_sha256 = pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(
            private.bidoc_contracts_r6_document_embedding_input(item), 'UTF8'
          )), 'hex'
        )
    )::integer as embedding_ready_rows,
    count(*) filter (
      where item.processing_status = 'processed'
        and not exists (
          select 1
          from unnest(coalesce(item.hashtags, '{}'::text[])) source(tag)
          left join private.contract_tag_catalog catalog
            on catalog.tag_he = source.tag
           and catalog.active
          where catalog.tag_he is null
        )
    )::integer as catalog_ready_rows
  from private.contracts_documents item
  group by item.workspace_id
), current_decision_metrics as (
  select
    item.workspace_id,
    count(*)::integer as decision_rows,
    count(*) filter (
      where item.project_id is not null
        and item.source_document_id is not null
        and nullif(pg_catalog.btrim(item.title_he), '') is not null
        and nullif(pg_catalog.btrim(item.summary_he), '') is not null
        and nullif(pg_catalog.btrim(item.content), '') is not null
        and pg_catalog.jsonb_typeof(item.metadata) = 'object'
        and item.hashtags is not null
        and nullif(pg_catalog.btrim(item.category_he), '') is not null
        and item.indicator_suitability in ('מתאים', 'לא_מתאים', 'נדרשת_בדיקה')
    )::integer as required_fields_ready_rows,
    count(*) filter (
      where item.embedding is not null
        and public.vector_dims(item.embedding) = 3072
        and item.embedding_input_sha256 = pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(
            private.bidoc_contracts_r6_decision_embedding_input(item), 'UTF8'
          )), 'hex'
        )
    )::integer as embedding_ready_rows
  from latest_decisions item
  group by item.workspace_id
), revision_metrics as (
  select
    item.workspace_id,
    count(*)::integer as revision_rows,
    count(*) filter (
      where item.embedding is not null
        and public.vector_dims(item.embedding) = 3072
        and item.embedding_input_sha256 = pg_catalog.encode(
          pg_catalog.sha256(pg_catalog.convert_to(
            private.bidoc_contracts_r6_decision_embedding_input(item), 'UTF8'
          )), 'hex'
        )
    )::integer as embedding_ready_rows
  from private.contracts item
  group by item.workspace_id
)
select
  workspace.id as workspace_id,
  workspace.filename as document_name,
  coalesce(documents.document_rows, 0) as document_rows,
  coalesce(documents.required_fields_ready_rows, 0) as document_required_fields_ready_rows,
  coalesce(documents.embedding_ready_rows, 0) as document_embedding_ready_rows,
  coalesce(documents.catalog_ready_rows, 0) as document_catalog_ready_rows,
  coalesce(decisions.decision_rows, 0) as current_decision_rows,
  coalesce(decisions.required_fields_ready_rows, 0) as decision_required_fields_ready_rows,
  coalesce(decisions.embedding_ready_rows, 0) as current_decision_embedding_ready_rows,
  coalesce(revisions.revision_rows, 0) as decision_revision_rows,
  coalesce(revisions.embedding_ready_rows, 0) as decision_revision_embedding_ready_rows,
  coalesce(documents.document_rows, 0) > 0
    and documents.document_rows = documents.required_fields_ready_rows
    and documents.document_rows = documents.embedding_ready_rows
    and documents.document_rows = documents.catalog_ready_rows
    and coalesce(decisions.decision_rows, 0) > 0
    and decisions.decision_rows = decisions.required_fields_ready_rows
    and decisions.decision_rows = decisions.embedding_ready_rows
    and revisions.revision_rows = revisions.embedding_ready_rows
    as parity_ready
from private.contract_workspaces workspace
left join document_metrics documents on documents.workspace_id = workspace.id
left join current_decision_metrics decisions on decisions.workspace_id = workspace.id
left join revision_metrics revisions on revisions.workspace_id = workspace.id
where coalesce(documents.document_rows, 0) > 0
   or coalesce(decisions.decision_rows, 0) > 0;

revoke all privileges on table private.contracts_workspace_parity_r6_v1
from public, anon, authenticated, service_role;
grant select on table private.contracts_workspace_parity_r6_v1 to service_role;

comment on function public.bidoc_contracts_r6_embedding_work_v2(uuid) is
  'Returns only missing or stale R6 embeddings for all processed clauses and all append-only decision revisions in one workspace.';
comment on view private.contracts_workspace_parity_r6_v1 is
  'Read-only CTO evidence: required product fields, Hebrew catalog compliance, and current 3072-vector coverage per contract.';
comment on column private.contracts_documents.index_ref is
  'Internal legacy index lineage retained for compatibility; excluded from the CTO-facing R6 product view.';
comment on column private.contracts.schedule_project_id is
  'Internal legacy compatibility field; Contracts R6 does not write Schedule placement.';
comment on column private.contracts.people is
  'Internal legacy extraction payload; the R6 product view exposes normalized responsible_party and beneficiary instead.';
comment on column private.contracts.schedule_impact is
  'Internal decision-processing signal retained for compatibility; Indicator suitability is exposed through indicator_suitability.';
comment on column private.contracts.trigger_kind is
  'Internal legacy trigger value; the R6 product view exposes only active Hebrew trigger_he values.';
comment on column private.contracts.recurring is
  'Internal timing input retained for compatibility and projected into the R6 timing object.';
comment on column private.contracts.projection_status is
  'Internal legacy workflow state retained for compatibility; Contracts R6 performs no Schedule projection.';

commit;
