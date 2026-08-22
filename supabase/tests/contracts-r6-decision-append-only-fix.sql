do $$
declare
  v_status jsonb;
  v_append_definition text;
  v_guard_definition text;
  v_persist_definition text;
  v_review_definition text;
begin
  if to_regprocedure('public.bidoc_contracts_decision_append_only_status_r6_v1()') is null then
    raise exception 'R6 decision append-only corrective status function is missing';
  end if;

  v_status := public.bidoc_contracts_decision_append_only_status_r6_v1();
  if v_status ->> 'schemaVersion' <> 'contracts-decision-append-only-r6.v1'
     or v_status ->> 'migrationVersion' <> '20260821202336'
     or (v_status ->> 'indicatorSuitabilityAtInsert')::boolean is not true
     or (v_status ->> 'embeddingTechnicalUpdateOnly')::boolean is not true
     or (v_status ->> 'businessFieldUpdatesEnabled')::boolean is not false
     or (v_status ->> 'scheduleWritesEnabled')::boolean is not false then
    raise exception 'R6 decision append-only corrective status is invalid: %', v_status;
  end if;

  if has_table_privilege('service_role', 'private.contracts', 'UPDATE') then
    raise exception 'service_role must not receive broad UPDATE on private.contracts';
  end if;
  if not has_column_privilege('service_role', 'private.contracts', 'embedding', 'UPDATE')
     or not has_column_privilege('service_role', 'private.contracts', 'embedding_input_sha256', 'UPDATE') then
    raise exception 'service_role is missing the narrow technical embedding UPDATE privileges';
  end if;
  if has_column_privilege('anon', 'private.contracts', 'embedding', 'UPDATE')
     or has_column_privilege('authenticated', 'private.contracts', 'embedding', 'UPDATE')
     or has_column_privilege('anon', 'private.contracts', 'embedding_input_sha256', 'UPDATE')
     or has_column_privilege('authenticated', 'private.contracts', 'embedding_input_sha256', 'UPDATE') then
    raise exception 'Browser roles must not update private contract embeddings';
  end if;

  if has_function_privilege('anon', 'public.bidoc_contracts_decision_append_only_status_r6_v1()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_decision_append_only_status_r6_v1()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_decision_append_only_status_r6_v1()', 'EXECUTE') then
    raise exception 'R6 decision append-only corrective status privileges are invalid';
  end if;

  select pg_get_functiondef('public.bidoc_contracts_append_decision_r1(integer,jsonb)'::regprocedure)
    into v_append_definition;
  select pg_get_functiondef('private.bidoc_contracts_append_only_guard_r1()'::regprocedure)
    into v_guard_definition;
  select pg_get_functiondef('public.bidoc_contracts_persist_decisions_r6(uuid,text,text,jsonb)'::regprocedure)
    into v_persist_definition;
  select pg_get_functiondef('public.bidoc_contracts_review_decision_r6(uuid,uuid,integer,uuid,text,text,jsonb)'::regprocedure)
    into v_review_definition;

  if v_append_definition !~ 'indicator_suitability'
     or v_append_definition !~ 'when ''yes'' then ''מתאים'''
     or v_append_definition !~ 'when ''no'' then ''לא_מתאים''' then
    raise exception 'R6 Indicator suitability is not derived at decision insert time';
  end if;
  if v_guard_definition !~ 'embedding_input_sha256'
     or v_guard_definition !~ 'vector_dims'
     or v_guard_definition !~ 'to_jsonb\(new\)' then
    raise exception 'R6 append-only guard does not isolate validated technical embedding updates';
  end if;
  if v_persist_definition ~* 'update\s+private\.contracts'
     or v_review_definition ~* 'update\s+private\.contracts'
     or v_persist_definition ~* '(insert\s+into|update|delete\s+from)\s+public\.schedule'
     or v_review_definition ~* '(insert\s+into|update|delete\s+from)\s+public\.schedule' then
    raise exception 'R6 wrappers still mutate append-only decisions or Schedule rows';
  end if;
end;
$$;

select
  public.bidoc_contracts_decision_append_only_status_r6_v1() as status,
  has_table_privilege('service_role', 'private.contracts', 'UPDATE') as broad_contract_update,
  has_column_privilege('service_role', 'private.contracts', 'embedding', 'UPDATE') as embedding_update,
  has_column_privilege('service_role', 'private.contracts', 'embedding_input_sha256', 'UPDATE') as embedding_hash_update;
