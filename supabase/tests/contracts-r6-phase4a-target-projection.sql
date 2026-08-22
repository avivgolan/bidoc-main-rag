-- Post-apply acceptance for Contracts R6 Phase 4A.
-- This test validates the additive target projection without requiring legacy
-- historical vectors to be backfilled. Missing-vector counts are reported below.

set role service_role;

do $acceptance$
declare
  v_status jsonb;
  v_document_columns text[];
  v_contract_columns text[];
begin
  if to_regprocedure('public.bidoc_contracts_r6_phase4a_status_v1()') is null
     or to_regclass('private.contracts_documents_product_r6_v1') is null
     or to_regclass('private.contracts_product_r6_v1') is null then
    raise exception 'Contracts R6 Phase 4A status or compatibility views are missing';
  end if;

  v_status := public.bidoc_contracts_r6_phase4a_status_v1();
  if v_status ->> 'migrationVersion' <> '20260822003639'
     or (v_status ->> 'legacyColumnsPreserved')::boolean is not true
     or (v_status ->> 'embeddingInputsChanged')::boolean is not false
     or (v_status ->> 'scheduleWritesEnabled')::boolean is not false
     or (v_status ->> 'indicatorWritesEnabled')::boolean is not false then
    raise exception 'Contracts R6 Phase 4A status contract is invalid: %', v_status;
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_document_columns
  from information_schema.columns
  where table_schema = 'private'
    and table_name = 'contracts_documents_product_r6_v1';

  if v_document_columns is distinct from array[
    'id', 'project_id', 'created_at', 'workspace_id', 'attachment_id',
    'document_name', 'content', 'metadata', 'chunk_index', 'chunk_total',
    'clause_key', 'parent_clause_key', 'clause_type', 'page_start', 'page_end',
    'hashtags', 'embedding'
  ]::text[] then
    raise exception 'Contracts R6 Phase 4A document view columns are invalid: %', v_document_columns;
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_contract_columns
  from information_schema.columns
  where table_schema = 'private'
    and table_name = 'contracts_product_r6_v1';

  if v_contract_columns is distinct from array[
    'id', 'project_id', 'source_document_id', 'created_at', 'title_he',
    'summary_he', 'content', 'metadata', 'hashtags', 'embedding',
    'responsible_party', 'beneficiary', 'category_he', 'indicator_suitability',
    'timing', 'trigger_he', 'trigger_description_he', 'review_status',
    'reviewed_at', 'review_reason_he'
  ]::text[] then
    raise exception 'Contracts R6 Phase 4A contract view columns are invalid: %', v_contract_columns;
  end if;

  if not exists (
       select 1 from pg_class item
       join pg_namespace namespace on namespace.oid = item.relnamespace
       where namespace.nspname = 'private'
         and item.relname = 'contracts_documents_product_r6_v1'
         and coalesce(item.reloptions, '{}'::text[]) @> array['security_invoker=true']
     ) or not exists (
       select 1 from pg_class item
       join pg_namespace namespace on namespace.oid = item.relnamespace
       where namespace.nspname = 'private'
         and item.relname = 'contracts_product_r6_v1'
         and coalesce(item.reloptions, '{}'::text[]) @> array['security_invoker=true']
     ) then
    raise exception 'Contracts R6 Phase 4A views must use security_invoker';
  end if;

  if has_table_privilege('anon', 'private.contracts_documents_product_r6_v1', 'SELECT')
     or has_table_privilege('authenticated', 'private.contracts_documents_product_r6_v1', 'SELECT')
     or has_table_privilege('anon', 'private.contracts_product_r6_v1', 'SELECT')
     or has_table_privilege('authenticated', 'private.contracts_product_r6_v1', 'SELECT')
     or not has_table_privilege('service_role', 'private.contracts_documents_product_r6_v1', 'SELECT')
     or not has_table_privilege('service_role', 'private.contracts_product_r6_v1', 'SELECT') then
    raise exception 'Contracts R6 Phase 4A view privileges are invalid';
  end if;

  if exists (
    with totals as (
      select workspace_id, document_version_id, parser_generation_id, count(*)::integer as chunk_total
      from private.contracts_documents
      group by workspace_id, document_version_id, parser_generation_id
    )
    select 1
    from private.contracts_documents item
    join private.contract_workspaces workspace on workspace.id = item.workspace_id
    join totals
      on totals.workspace_id = item.workspace_id
     and totals.document_version_id = item.document_version_id
     and totals.parser_generation_id = item.parser_generation_id
    where item.project_id is distinct from item.source_project_id
       or item.attachment_id is distinct from workspace.storage_bucket || '/' || workspace.storage_object_key
       or item.document_name is distinct from workspace.filename
       or item.chunk_index is distinct from item.clause_order
       or item.chunk_total is distinct from totals.chunk_total
       or item.metadata ->> 'schemaVersion' <> 'contracts-document-metadata.r6.4a.v1'
  ) then
    raise exception 'Contracts R6 Phase 4A document projection drifted from immutable source data';
  end if;

  if (select count(*) from private.contracts_documents_product_r6_v1)
     <> (select count(*) from private.contracts_documents
         where processing_status = 'processed' and nullif(btrim(content), '') is not null) then
    raise exception 'Contracts R6 Phase 4A document view does not contain exactly the processed source rows';
  end if;

  if exists (
    select 1
    from private.contracts item
    where item.project_id is distinct from item.source_project_id
       or item.source_document_id is distinct from item.primary_clause_id
       or item.content is distinct from item.decision_text_he
       or item.category_he is distinct from private.bidoc_contracts_category_he_r6_4a(item.decision_category)
       or item.hashtags is distinct from private.bidoc_contracts_approved_hashtags_r6_4a(item.tags)
       or item.timing is distinct from private.bidoc_contracts_timing_r6_4a(item)
       or item.trigger_he is distinct from private.bidoc_contracts_approved_trigger_r6_4a(item.trigger_kind)
       or item.review_reason_he is distinct from case
         when item.review_reason is null or item.review_reason ~ '[א-ת]' then item.review_reason
         else null
       end
       or item.metadata ->> 'schemaVersion' <> 'contracts-decision-metadata.r6.4a.v1'
  ) then
    raise exception 'Contracts R6 Phase 4A decision projection drifted from append-only lineage';
  end if;

  if exists (
    select 1
    from private.contracts_product_r6_v1 item
    cross join lateral unnest(item.hashtags) tag(value)
    where tag.value ~ '[A-Za-z]'
       or tag.value !~ '[א-ת]'
       or not exists (
         select 1 from private.contract_tag_catalog catalog
         where catalog.tag_he = tag.value and catalog.active
       )
  ) then
    raise exception 'Contracts R6 Phase 4A product decisions contain invalid Hebrew tags';
  end if;

  if exists (
    select 1
    from private.contracts_product_r6_v1 item
    where item.trigger_he is not null
      and (
        item.trigger_he ~ '[A-Za-z]'
        or item.trigger_he !~ '[א-ת]'
        or not exists (
          select 1 from private.contract_trigger_catalog catalog
          where catalog.trigger_he = item.trigger_he and catalog.active
        )
      )
  ) then
    raise exception 'Contracts R6 Phase 4A product decisions contain an invalid Hebrew trigger';
  end if;

  if exists (
    select 1
    from private.contracts_product_r6_v1 item
    where item.review_status not in ('מוצע', 'מאושר', 'תוקן', 'נדחה', 'לא_פתור', 'הוחלף')
       or item.indicator_suitability not in ('מתאים', 'לא_מתאים', 'נדרשת_בדיקה')
       or (item.review_reason_he is not null and item.review_reason_he !~ '[א-ת]')
       or (item.timing ?| array['actualTriggerDate', 'actualDueDate', 'dueDate', 'scheduleDate'])
  ) then
    raise exception 'Contracts R6 Phase 4A product decisions contain invalid Hebrew state or operational dates';
  end if;

  if (select count(*) from private.contracts_product_r6_v1) <> (
    select count(*)
    from (
      select distinct on (workspace_id, document_version_id, parser_generation_id, decision_key) id
      from private.contracts
      order by workspace_id, document_version_id, parser_generation_id, decision_key, revision desc
    ) latest
  ) then
    raise exception 'Contracts R6 Phase 4A contract view does not contain exactly the latest decision revisions';
  end if;

  if exists (
    select 1 from private.contracts_documents item
    where item.embedding is not null
      and (
        public.vector_dims(item.embedding) <> 3072
        or item.embedding_input_sha256 is distinct from encode(pg_catalog.sha256(pg_catalog.convert_to(
          private.bidoc_contracts_r6_document_embedding_input(item), 'UTF8'
        )), 'hex')
      )
  ) or exists (
    select 1 from private.contracts item
    where item.embedding is not null
      and (
        public.vector_dims(item.embedding) <> 3072
        or item.embedding_input_sha256 is distinct from encode(pg_catalog.sha256(pg_catalog.convert_to(
          private.bidoc_contracts_r6_decision_embedding_input(item), 'UTF8'
        )), 'hex')
      )
  ) then
    raise exception 'Contracts R6 Phase 4A found a stored vector with invalid dimensions or input identity';
  end if;

  if not exists (
       select 1 from pg_indexes
       where schemaname = 'private'
         and indexname = 'contracts_documents_embedding_hnsw_r6_idx'
         and indexdef ~ 'halfvec\(3072\).*halfvec_cosine_ops'
     ) or not exists (
       select 1 from pg_indexes
       where schemaname = 'private'
         and indexname = 'contracts_embedding_hnsw_r6_idx'
         and indexdef ~ 'halfvec\(3072\).*halfvec_cosine_ops'
     ) then
    raise exception 'Contracts R6 Phase 4A requires both 3072-dimension HNSW cosine indexes';
  end if;
end
$acceptance$;

with latest as (
  select distinct on (workspace_id, document_version_id, parser_generation_id, decision_key) *
  from private.contracts
  order by workspace_id, document_version_id, parser_generation_id, decision_key, revision desc
)
select
  (select count(*) from private.contracts_documents_product_r6_v1) as product_document_rows,
  (select count(*) from private.contracts_documents_product_r6_v1 where embedding is not null) as embedded_document_rows,
  (select count(*) from private.contracts_product_r6_v1) as product_contract_rows,
  (select count(*) from private.contracts_product_r6_v1 where embedding is not null) as embedded_contract_rows,
  (select count(*) from latest where embedding is null) as historical_current_decisions_missing_embeddings,
  (select count(*) from private.contracts where trigger_kind is not null and trigger_he is null) as historical_triggers_kept_only_in_metadata;

reset role;
