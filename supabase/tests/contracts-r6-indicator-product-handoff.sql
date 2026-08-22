begin;

do $structure$
declare
  v_definition text;
  v_security_definer boolean;
  v_config text[];
begin
  if to_regclass('private.contracts_product_r6_v1') is null
     or to_regprocedure('public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)') is null then
    raise exception 'Contracts R6 Indicator product handoff objects are missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)',
       'EXECUTE'
     ) then
    raise exception 'Contracts R6 Indicator product handoff privileges are unsafe';
  end if;

  select pg_get_functiondef(
    'public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)'::regprocedure
  ) into v_definition;

  select item.prosecdef, item.proconfig
  into v_security_definer, v_config
  from pg_proc item
  where item.oid = 'public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)'::regprocedure;

  if v_security_definer
     or not ('search_path=""' = any(v_config))
     or v_definition !~ 'private\.contracts_product_r6_v1'
     or v_definition ~* '(insert\s+into|update|delete\s+from)\s+(private|public)\.'
     or v_definition ~* '(private|public)\.schedule_' then
    raise exception 'Contracts R6 Indicator product handoff is not a bounded read-only product-view function';
  end if;
end
$structure$;

set local role service_role;

do $runtime$
declare
  v_workspace_id uuid;
  v_result jsonb;
  v_expected_count integer;
  v_expected_embeddings integer;
begin
  select (item.metadata ->> 'workspaceId')::uuid
  into v_workspace_id
  from private.contracts_product_r6_v1 item
  where item.metadata ->> 'workspaceId' is not null
  order by item.created_at desc
  limit 1;

  if v_workspace_id is null then
    raise exception 'Contracts R6 Indicator product handoff acceptance requires one product decision';
  end if;

  select public.bidoc_contracts_r6_indicator_product_handoff_source_v1(v_workspace_id)
  into v_result;

  select count(*), count(*) filter (
    where embedding is not null and public.vector_dims(embedding) = 3072
  )
  into v_expected_count, v_expected_embeddings
  from private.contracts_product_r6_v1 item
  where item.metadata ->> 'workspaceId' = v_workspace_id::text;

  if v_result is null
     or v_result ->> 'schemaVersion' <> 'contracts-indicator-product-source.r6.v1'
     or v_result ->> 'migrationVersion' <> '20260822113820'
     or v_result ->> 'sourceView' <> 'private.contracts_product_r6_v1'
     or (v_result #>> '{workspace,workspaceId}')::uuid <> v_workspace_id
     or (v_result #>> '{metrics,productDecisionCount}')::integer <> v_expected_count
     or (v_result #>> '{metrics,embeddingReadyCount}')::integer <> v_expected_embeddings
     or (v_result #>> '{metrics,modelCallCount}')::integer <> 0
     or (v_result #>> '{metrics,contractTruthWriteCount}')::integer <> 0
     or (v_result #>> '{metrics,indicatorWriteCount}')::integer <> 0
     or (v_result #>> '{metrics,scheduleWriteCount}')::integer <> 0
     or v_result #>> '{gates,productViewSource}' <> 'true'
     or v_result #>> '{gates,readOnly}' <> 'true'
     or jsonb_array_length(v_result -> 'items') <> v_expected_count then
    raise exception 'Contracts R6 Indicator product handoff envelope is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_result -> 'items') item(value)
    where coalesce(value ->> 'decisionId', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(value ->> 'projectId', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(value ->> 'sourceDocumentId', '') !~* '^[0-9a-f-]{36}$'
       or char_length(btrim(coalesce(value ->> 'content', ''))) < 1
       or value ->> 'indicatorSuitability' not in ('מתאים', 'לא_מתאים', 'נדרשת_בדיקה')
       or value ->> 'reviewStatus' not in ('מוצע', 'מאושר', 'תוקן', 'נדחה', 'לא_פתור', 'הוחלף')
       or jsonb_typeof(value -> 'hashtags') is distinct from 'array'
       or jsonb_typeof(value -> 'sourceEvidence') is distinct from 'array'
       or jsonb_typeof(value -> 'timing') not in ('object', 'null')
       or value ?| array[
         'embedding', 'scheduleImpact', 'decisionCategory', 'temporalKind',
         'triggerKind', 'recurring', 'scheduleProjectId', 'targetTable', 'shadowRow'
       ]
  ) then
    raise exception 'Contracts R6 Indicator product handoff exposes an invalid or legacy item';
  end if;
end
$runtime$;

reset role;

select
  count(*) as product_decisions,
  count(*) filter (
    where embedding is not null and public.vector_dims(embedding) = 3072
  ) as embedding_ready_decisions
from private.contracts_product_r6_v1;

rollback;
