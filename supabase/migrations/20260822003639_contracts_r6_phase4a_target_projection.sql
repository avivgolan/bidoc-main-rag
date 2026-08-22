-- BIDoc Contracts R6 Phase 4A: additive CTO-approved target projection.
--
-- This migration preserves the R1/R4 append-only source and lineage fields.
-- It adds deterministic product-facing fields and private compatibility views;
-- it performs no Schedule write, Indicator write, vector generation, or deletion.

begin;

do $preconditions$
begin
  if to_regclass('private.contract_workspaces') is null
     or to_regclass('private.contracts_documents') is null
     or to_regclass('private.contracts') is null
     or to_regclass('private.contract_tag_catalog') is null
     or to_regclass('private.contract_trigger_catalog') is null
     or to_regprocedure('private.bidoc_contracts_r6_document_embedding_input(private.contracts_documents)') is null
     or to_regprocedure('private.bidoc_contracts_r6_decision_embedding_input(private.contracts)') is null then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A requires the R1, R6 Phase 2, and R6 Phase 3 schema';
  end if;

  if not exists (
       select 1 from pg_trigger
       where tgrelid = 'private.contracts_documents'::regclass
         and tgname = 'bidoc_contracts_document_guard_r1'
         and not tgisinternal
     ) or not exists (
       select 1 from pg_trigger
       where tgrelid = 'private.contracts'::regclass
         and tgname = 'bidoc_contracts_decision_append_only_r1'
         and not tgisinternal
     ) then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A requires the existing document and append-only decision guards';
  end if;

  if exists (
    select 1
    from private.contracts_documents item
    left join private.contract_workspaces workspace on workspace.id = item.workspace_id
    where workspace.id is null
       or workspace.source_project_id is distinct from item.source_project_id
       or workspace.document_version_id is distinct from item.document_version_id
       or workspace.parser_generation_id is distinct from item.parser_generation_id
       or nullif(btrim(workspace.storage_bucket), '') is null
       or nullif(btrim(workspace.storage_object_key), '') is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Contracts R6 Phase 4A cannot project a clause with missing or mismatched workspace identity';
  end if;

  if exists (
    select 1 from private.contracts
    where primary_clause_id is null
       or source_project_id is null
       or nullif(btrim(decision_text_he), '') is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Contracts R6 Phase 4A requires every decision revision to retain a primary source clause and normalized content';
  end if;
end
$preconditions$;

lock table private.contracts_documents, private.contracts in access exclusive mode;

alter table private.contracts_documents
  add column if not exists project_id uuid,
  add column if not exists attachment_id text,
  add column if not exists document_name text,
  add column if not exists metadata jsonb,
  add column if not exists chunk_index integer,
  add column if not exists chunk_total integer;

alter table private.contracts
  add column if not exists project_id uuid,
  add column if not exists source_document_id uuid,
  add column if not exists content text,
  add column if not exists metadata jsonb,
  add column if not exists hashtags text[],
  add column if not exists category_he text,
  add column if not exists timing jsonb,
  add column if not exists trigger_he text,
  add column if not exists review_reason_he text;

create or replace function private.bidoc_contracts_category_he_r6_4a(p_category text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_category
    when 'scope_and_execution' then 'היקף וביצוע'
    when 'commencement_and_completion' then 'תחילה והשלמה'
    when 'stage_acceptance_and_handover' then 'קבלת שלב ומסירה'
    when 'payment_and_commercial' then 'תשלום ומסחר'
    when 'notice_and_communication' then 'הודעות ותקשורת'
    when 'change_and_approval' then 'שינוי ואישור'
    when 'bond_and_security' then 'ערבויות ובטוחות'
    when 'warranty_and_defects' then 'אחריות וליקויים'
    when 'recurring_compliance' then 'ציות חוזר'
    when 'delay_extension_and_consequence' then 'עיכוב, הארכה ותוצאה'
    when 'termination_and_remedy' then 'סיום ותרופה'
    when 'document_and_information_obligation' then 'מסמכים ומידע'
    when 'other' then 'אחר'
    else null
  end
$$;

create or replace function private.bidoc_contracts_review_status_he_r6_4a(p_status text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_status
    when 'proposed' then 'מוצע'
    when 'approved' then 'מאושר'
    when 'corrected' then 'תוקן'
    when 'rejected' then 'נדחה'
    when 'unresolved' then 'לא_פתור'
    when 'split' then 'הוחלף'
    when 'merged' then 'הוחלף'
    when 'superseded' then 'הוחלף'
    else null
  end
$$;

create or replace function private.bidoc_contracts_all_hebrew_tags_r6_4a(p_tags text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(not exists (
    select 1
    from unnest(coalesce(p_tags, '{}'::text[])) tag(value)
    where nullif(btrim(tag.value), '') is null
       or tag.value ~ '[A-Za-z]'
       or tag.value !~ '[א-ת]'
  ), true)
$$;

create or replace function private.bidoc_contracts_approved_hashtags_r6_4a(p_tags text[])
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(approved.tag_he order by approved.first_ordinal), '{}'::text[])
  from (
    select source.tag_he, min(source.ordinality) as first_ordinal
    from unnest(coalesce(p_tags, '{}'::text[])) with ordinality source(tag_he, ordinality)
    join private.contract_tag_catalog catalog
      on catalog.tag_he = source.tag_he
     and catalog.active
    group by source.tag_he
  ) approved
$$;

create or replace function private.bidoc_contracts_approved_trigger_r6_4a(p_trigger text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select catalog.trigger_he
  from private.contract_trigger_catalog catalog
  where catalog.trigger_he = nullif(btrim(p_trigger), '')
    and catalog.active
$$;

create or replace function private.bidoc_contracts_timing_r6_4a(p_item private.contracts)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_item.temporal_kind = 'none'
     and p_item.contract_date is null
     and p_item.offset_value is null
     and p_item.offset_unit is null
     and not p_item.recurring
    then null
    else jsonb_strip_nulls(jsonb_build_object(
      'schemaVersion', 'contracts-timing.r6.4a.v1',
      'kind', p_item.temporal_kind,
      'contractDate', p_item.contract_date,
      'offsetValue', p_item.offset_value,
      'offsetUnit', p_item.offset_unit,
      'calendarSemantics', p_item.calendar_semantics,
      'recurring', p_item.recurring
    ))
  end
$$;

create or replace function private.bidoc_contracts_document_metadata_r6_4a(
  p_item private.contracts_documents,
  p_workspace private.contract_workspaces
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 'contracts-document-metadata.r6.4a.v1',
    'documentVersionId', p_item.document_version_id,
    'documentSha256', p_item.document_sha256,
    'parserGenerationId', p_item.parser_generation_id,
    'rawTextSha256', p_item.raw_text_sha256,
    'rawData', p_item.raw_data,
    'clauseTitle', p_item.clause_title,
    'summaryHe', p_item.summary_he,
    'crossReferences', p_item.cross_references,
    'indexRef', p_item.index_ref,
    'processingStatus', p_item.processing_status,
    'processingError', p_item.processing_error,
    'parserVersion', p_item.parser_version,
    'extractorVersion', p_item.extractor_version,
    'processedAt', p_item.processed_at,
    'storageBucket', p_workspace.storage_bucket,
    'storageObjectKey', p_workspace.storage_object_key
  ))
$$;

create or replace function private.bidoc_contracts_decision_metadata_r6_4a(p_item private.contracts)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 'contracts-decision-metadata.r6.4a.v1',
    'workspaceId', p_item.workspace_id,
    'documentVersionId', p_item.document_version_id,
    'parserGenerationId', p_item.parser_generation_id,
    'decisionKey', p_item.decision_key,
    'revision', p_item.revision,
    'supersedesDecisionId', p_item.supersedes_decision_id,
    'sourceEvidence', p_item.source_evidence,
    'conflictStatus', p_item.conflict_status,
    'modelVersion', p_item.model_version,
    'decisionPolicyVersion', p_item.decision_policy_version,
    'reviewStatusCode', p_item.review_status,
    'reviewerId', p_item.reviewer_id,
    'legacyTagValues', case
      when p_item.tags is distinct from private.bidoc_contracts_approved_hashtags_r6_4a(p_item.tags)
      then to_jsonb(p_item.tags)
      else null
    end,
    'legacyTriggerValue', case
      when p_item.trigger_kind is not null
       and private.bidoc_contracts_approved_trigger_r6_4a(p_item.trigger_kind) is null
      then p_item.trigger_kind
      else null
    end,
    'legacyReviewReason', case
      when p_item.review_reason is not null and p_item.review_reason !~ '[א-ת]'
      then p_item.review_reason
      else null
    end
  ))
$$;

create temporary table bidoc_contracts_documents_r6_4a_baseline on commit drop as
select
  item.id,
  to_jsonb(item) - array[
    'project_id', 'attachment_id', 'document_name', 'metadata', 'chunk_index', 'chunk_total'
  ]::text[] as legacy_row
from private.contracts_documents item;

create temporary table bidoc_contracts_r6_4a_baseline on commit drop as
select
  item.id,
  to_jsonb(item) - array[
    'project_id', 'source_document_id', 'content', 'metadata', 'hashtags',
    'category_he', 'timing', 'trigger_he', 'review_reason_he'
  ]::text[] as legacy_row
from private.contracts item;

alter table private.contracts_documents disable trigger bidoc_contracts_document_guard_r1;
alter table private.contracts disable trigger bidoc_contracts_decision_append_only_r1;

with generation_totals as (
  select
    workspace_id,
    document_version_id,
    parser_generation_id,
    count(*)::integer as chunk_total
  from private.contracts_documents
  group by workspace_id, document_version_id, parser_generation_id
)
update private.contracts_documents item
set project_id = item.source_project_id,
    attachment_id = workspace.storage_bucket || '/' || workspace.storage_object_key,
    document_name = workspace.filename,
    metadata = private.bidoc_contracts_document_metadata_r6_4a(item, workspace),
    chunk_index = item.clause_order,
    chunk_total = totals.chunk_total
from private.contract_workspaces workspace,
     generation_totals totals
where workspace.id = item.workspace_id
  and totals.workspace_id = item.workspace_id
  and totals.document_version_id = item.document_version_id
  and totals.parser_generation_id = item.parser_generation_id;

update private.contracts item
set project_id = item.source_project_id,
    source_document_id = item.primary_clause_id,
    content = item.decision_text_he,
    metadata = private.bidoc_contracts_decision_metadata_r6_4a(item),
    hashtags = private.bidoc_contracts_approved_hashtags_r6_4a(item.tags),
    category_he = private.bidoc_contracts_category_he_r6_4a(item.decision_category),
    timing = private.bidoc_contracts_timing_r6_4a(item),
    trigger_he = private.bidoc_contracts_approved_trigger_r6_4a(item.trigger_kind),
    review_reason_he = case
      when item.review_reason is null or item.review_reason ~ '[א-ת]' then item.review_reason
      else null
    end;

alter table private.contracts_documents enable trigger bidoc_contracts_document_guard_r1;
alter table private.contracts enable trigger bidoc_contracts_decision_append_only_r1;

do $legacy_integrity$
begin
  if exists (
    select 1
    from bidoc_contracts_documents_r6_4a_baseline baseline
    full join (
      select
        item.id,
        to_jsonb(item) - array[
          'project_id', 'attachment_id', 'document_name', 'metadata', 'chunk_index', 'chunk_total'
        ]::text[] as legacy_row
      from private.contracts_documents item
    ) current using (id)
    where baseline.id is null
       or current.id is null
       or baseline.legacy_row is distinct from current.legacy_row
  ) then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A changed existing clause identity, evidence, or processing fields';
  end if;

  if exists (
    select 1
    from bidoc_contracts_r6_4a_baseline baseline
    full join (
      select
        item.id,
        to_jsonb(item) - array[
          'project_id', 'source_document_id', 'content', 'metadata', 'hashtags',
          'category_he', 'timing', 'trigger_he', 'review_reason_he'
        ]::text[] as legacy_row
      from private.contracts item
    ) current using (id)
    where baseline.id is null
       or current.id is null
       or baseline.legacy_row is distinct from current.legacy_row
  ) then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A changed existing decision lineage or review fields';
  end if;
end
$legacy_integrity$;

alter table private.contracts_documents
  alter column project_id set not null,
  alter column attachment_id set not null,
  alter column chunk_index set not null;

alter table private.contracts_documents
  drop constraint if exists contracts_documents_target_project_r6_4a_check,
  drop constraint if exists contracts_documents_target_attachment_r6_4a_check,
  drop constraint if exists contracts_documents_target_metadata_r6_4a_check,
  drop constraint if exists contracts_documents_target_chunk_r6_4a_check,
  add constraint contracts_documents_target_project_r6_4a_check
    check (project_id = source_project_id),
  add constraint contracts_documents_target_attachment_r6_4a_check
    check (attachment_id = btrim(attachment_id) and char_length(attachment_id) between 1 and 700),
  add constraint contracts_documents_target_metadata_r6_4a_check
    check (metadata is null or jsonb_typeof(metadata) = 'object'),
  add constraint contracts_documents_target_chunk_r6_4a_check
    check (chunk_index = clause_order and chunk_index > 0 and (chunk_total is null or chunk_total > 0));

alter table private.contracts
  alter column project_id set not null,
  alter column source_document_id set not null,
  alter column content set not null,
  alter column hashtags set not null,
  alter column category_he set not null;

alter table private.contracts
  drop constraint if exists contracts_target_project_r6_4a_check,
  drop constraint if exists contracts_target_source_r6_4a_check,
  drop constraint if exists contracts_target_content_r6_4a_check,
  drop constraint if exists contracts_target_metadata_r6_4a_check,
  drop constraint if exists contracts_target_hashtags_r6_4a_check,
  drop constraint if exists contracts_target_category_r6_4a_check,
  drop constraint if exists contracts_target_timing_r6_4a_check,
  drop constraint if exists contracts_target_trigger_r6_4a_check,
  drop constraint if exists contracts_target_review_reason_r6_4a_check,
  drop constraint if exists contracts_target_source_document_r6_4a_fk,
  add constraint contracts_target_project_r6_4a_check
    check (project_id = source_project_id),
  add constraint contracts_target_source_r6_4a_check
    check (source_document_id = primary_clause_id),
  add constraint contracts_target_content_r6_4a_check
    check (content = decision_text_he and char_length(btrim(content)) > 0),
  add constraint contracts_target_metadata_r6_4a_check
    check (metadata is null or jsonb_typeof(metadata) = 'object'),
  add constraint contracts_target_hashtags_r6_4a_check
    check (private.bidoc_contracts_all_hebrew_tags_r6_4a(hashtags)),
  add constraint contracts_target_category_r6_4a_check
    check (category_he = private.bidoc_contracts_category_he_r6_4a(decision_category)),
  add constraint contracts_target_timing_r6_4a_check
    check (
      timing is null
      or (
        jsonb_typeof(timing) = 'object'
        and timing ->> 'schemaVersion' = 'contracts-timing.r6.4a.v1'
        and (timing - array[
          'schemaVersion', 'kind', 'contractDate', 'offsetValue', 'offsetUnit',
          'calendarSemantics', 'recurring'
        ]::text[]) = '{}'::jsonb
      )
    ),
  add constraint contracts_target_trigger_r6_4a_check
    check (trigger_he is null or (trigger_he = btrim(trigger_he) and trigger_he ~ '[א-ת]' and trigger_he !~ '[A-Za-z]')),
  add constraint contracts_target_review_reason_r6_4a_check
    check (review_reason_he is null or review_reason_he ~ '[א-ת]'),
  add constraint contracts_target_source_document_r6_4a_fk
    foreign key (source_document_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts_documents (id, workspace_id, document_version_id, parser_generation_id)
    on delete restrict;

create or replace function private.bidoc_contracts_project_document_r6_4a()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_chunk_total integer;
begin
  select * into v_workspace
  from private.contract_workspaces workspace
  where workspace.id = new.workspace_id;

  if not found
     or v_workspace.source_project_id is distinct from new.source_project_id
     or v_workspace.document_version_id is distinct from new.document_version_id
     or v_workspace.parser_generation_id is distinct from new.parser_generation_id then
    raise exception using
      errcode = '23514',
      message = 'Contracts R6 Phase 4A document projection requires matching immutable workspace identity';
  end if;

  select count(*)::integer + case when tg_op = 'INSERT' then 1 else 0 end
  into v_chunk_total
  from private.contracts_documents item
  where item.workspace_id = new.workspace_id
    and item.document_version_id = new.document_version_id
    and item.parser_generation_id = new.parser_generation_id;

  new.project_id := new.source_project_id;
  new.attachment_id := v_workspace.storage_bucket || '/' || v_workspace.storage_object_key;
  new.document_name := v_workspace.filename;
  new.chunk_index := new.clause_order;
  new.chunk_total := v_chunk_total;
  new.metadata := private.bidoc_contracts_document_metadata_r6_4a(new, v_workspace);
  return new;
end;
$$;

create or replace function private.bidoc_contracts_refresh_chunk_total_r6_4a()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with affected as (
    select distinct workspace_id, document_version_id, parser_generation_id
    from inserted_contract_rows
  ), totals as (
    select
      item.workspace_id,
      item.document_version_id,
      item.parser_generation_id,
      count(*)::integer as chunk_total
    from private.contracts_documents item
    join affected scope
      on scope.workspace_id = item.workspace_id
     and scope.document_version_id = item.document_version_id
     and scope.parser_generation_id = item.parser_generation_id
    group by item.workspace_id, item.document_version_id, item.parser_generation_id
  )
  update private.contracts_documents item
  set chunk_total = totals.chunk_total
  from totals
  where item.workspace_id = totals.workspace_id
    and item.document_version_id = totals.document_version_id
    and item.parser_generation_id = totals.parser_generation_id
    and item.chunk_total is distinct from totals.chunk_total;
  return null;
end;
$$;

create or replace function private.bidoc_contracts_project_decision_r6_4a()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.primary_clause_id is null then
    raise exception using
      errcode = '23514',
      message = 'Contracts R6 Phase 4A requires a primary source clause for every decision revision';
  end if;

  new.project_id := new.source_project_id;
  new.source_document_id := new.primary_clause_id;
  new.content := new.decision_text_he;
  new.hashtags := private.bidoc_contracts_approved_hashtags_r6_4a(new.tags);
  new.category_he := private.bidoc_contracts_category_he_r6_4a(new.decision_category);
  new.timing := private.bidoc_contracts_timing_r6_4a(new);
  new.trigger_he := private.bidoc_contracts_approved_trigger_r6_4a(new.trigger_kind);
  new.review_reason_he := case
    when new.review_reason is null or new.review_reason ~ '[א-ת]' then new.review_reason
    else null
  end;
  new.metadata := private.bidoc_contracts_decision_metadata_r6_4a(new);
  return new;
end;
$$;

drop trigger if exists bidoc_contracts_project_document_r6_4a on private.contracts_documents;
create trigger bidoc_contracts_project_document_r6_4a
before insert or update on private.contracts_documents
for each row execute function private.bidoc_contracts_project_document_r6_4a();

drop trigger if exists bidoc_contracts_refresh_chunk_total_r6_4a on private.contracts_documents;
create trigger bidoc_contracts_refresh_chunk_total_r6_4a
after insert on private.contracts_documents
referencing new table as inserted_contract_rows
for each statement execute function private.bidoc_contracts_refresh_chunk_total_r6_4a();

drop trigger if exists bidoc_contracts_project_decision_r6_4a on private.contracts;
create trigger bidoc_contracts_project_decision_r6_4a
before insert on private.contracts
for each row execute function private.bidoc_contracts_project_decision_r6_4a();

create or replace view private.contracts_documents_product_r6_v1
with (security_invoker = true)
as
select
  item.id,
  item.project_id,
  item.created_at,
  item.workspace_id,
  item.attachment_id,
  item.document_name,
  item.content,
  item.metadata,
  item.chunk_index,
  item.chunk_total,
  item.clause_key,
  item.parent_clause_key,
  item.clause_type,
  item.page_start,
  item.page_end,
  private.bidoc_contracts_approved_hashtags_r6_4a(item.hashtags) as hashtags,
  item.embedding
from private.contracts_documents item
where item.processing_status = 'processed'
  and nullif(btrim(item.content), '') is not null;

create or replace view private.contracts_product_r6_v1
with (security_invoker = true)
as
with latest as (
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
)
select
  item.id,
  item.project_id,
  item.source_document_id,
  item.created_at,
  item.title_he,
  item.summary_he,
  item.content,
  item.metadata,
  item.hashtags,
  item.embedding,
  item.responsible_party,
  item.beneficiary,
  item.category_he,
  item.indicator_suitability,
  item.timing,
  item.trigger_he,
  item.trigger_description_he,
  private.bidoc_contracts_review_status_he_r6_4a(item.review_status) as review_status,
  item.reviewed_at,
  item.review_reason_he
from latest item;

revoke all privileges on table private.contracts_documents_product_r6_v1
from public, anon, authenticated, service_role;
revoke all privileges on table private.contracts_product_r6_v1
from public, anon, authenticated, service_role;
grant select on table private.contracts_documents_product_r6_v1 to service_role;
grant select on table private.contracts_product_r6_v1 to service_role;

create or replace function public.bidoc_contracts_r6_phase4a_status_v1()
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
  return jsonb_build_object(
    'schemaVersion', 'contracts-r6-phase4a-status.v1',
    'migrationVersion', '20260822003639',
    'documentsView', 'private.contracts_documents_product_r6_v1',
    'contractsView', 'private.contracts_product_r6_v1',
    'legacyColumnsPreserved', true,
    'embeddingInputsChanged', false,
    'scheduleWritesEnabled', false,
    'indicatorWritesEnabled', false
  );
end;
$$;

revoke execute on function public.bidoc_contracts_r6_phase4a_status_v1()
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_r6_phase4a_status_v1() to service_role;

revoke execute on function private.bidoc_contracts_category_he_r6_4a(text)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_review_status_he_r6_4a(text)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_all_hebrew_tags_r6_4a(text[])
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_approved_hashtags_r6_4a(text[])
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_approved_trigger_r6_4a(text)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_timing_r6_4a(private.contracts)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_document_metadata_r6_4a(private.contracts_documents,private.contract_workspaces)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_decision_metadata_r6_4a(private.contracts)
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_project_document_r6_4a()
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_refresh_chunk_total_r6_4a()
from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_project_decision_r6_4a()
from public, anon, authenticated;

grant execute on function private.bidoc_contracts_category_he_r6_4a(text) to service_role;
grant execute on function private.bidoc_contracts_review_status_he_r6_4a(text) to service_role;
grant execute on function private.bidoc_contracts_all_hebrew_tags_r6_4a(text[]) to service_role;
grant execute on function private.bidoc_contracts_approved_hashtags_r6_4a(text[]) to service_role;
grant execute on function private.bidoc_contracts_approved_trigger_r6_4a(text) to service_role;
grant execute on function private.bidoc_contracts_timing_r6_4a(private.contracts) to service_role;
grant execute on function private.bidoc_contracts_document_metadata_r6_4a(private.contracts_documents,private.contract_workspaces) to service_role;
grant execute on function private.bidoc_contracts_decision_metadata_r6_4a(private.contracts) to service_role;
grant execute on function private.bidoc_contracts_project_document_r6_4a() to service_role;
grant execute on function private.bidoc_contracts_refresh_chunk_total_r6_4a() to service_role;
grant execute on function private.bidoc_contracts_project_decision_r6_4a() to service_role;

comment on view private.contracts_documents_product_r6_v1 is
  'Processed clause rows in the CTO-approved R6 source shape. Legacy parser and audit fields remain on the base table.';
comment on view private.contracts_product_r6_v1 is
  'Latest decision revisions in the CTO-approved R6 Contracts-to-Indicator knowledge shape. This view performs no Indicator or Schedule write.';
comment on column private.contracts_documents.attachment_id is
  'Immutable private Storage attachment identity: storage bucket plus object key.';
comment on column private.contracts_documents.metadata is
  'R6 product metadata projection. Existing immutable parser evidence remains in its original columns.';
comment on column private.contracts.metadata is
  'R6 product metadata projection containing source evidence, model/policy identity, and append-only lineage.';
comment on column private.contracts.category_he is
  'Hebrew controlled category projected from the internal decision category code.';
comment on column private.contracts.timing is
  'Contractual timing only; this value never contains an actual project trigger date or due date.';
comment on column private.contracts.trigger_he is
  'Hebrew-only active trigger catalog value; unsupported historical codes remain only in technical metadata.';

commit;
