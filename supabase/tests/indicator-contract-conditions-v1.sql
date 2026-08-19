-- Run after 20260819113955_indicator_contract_conditions_v1.sql.
-- Catalog-only security/shape checks; this script writes no project data.

do $test$
declare
  v_function record;
begin
  for v_function in
    select procedure_name
    from (values
      ('bidoc_indicator_schedule_project_context_v1'),
      ('bidoc_indicator_sync_contract_conditions_v1'),
      ('bidoc_indicator_sync_schedule_project_contract_conditions_v1'),
      ('bidoc_schedule_resolve_condition_v1'),
      ('bidoc_contracts_source_object_v1')
    ) expected(procedure_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = v_function.procedure_name
        and procedure.prosecdef = false
    ) then
      raise exception 'Missing SECURITY INVOKER function: %', v_function.procedure_name;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean)', 'execute') then
    raise exception 'Indicator synchronization grants are unsafe';
  end if;

  if has_function_privilege('anon', 'public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text)', 'execute')
     or not has_function_privilege('service_role', 'public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text)', 'execute') then
    raise exception 'Condition resolution grants are unsafe';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'schedule_contract_conditions'
      and relation.relrowsecurity = true
  ) then
    raise exception 'schedule_contract_conditions must retain RLS';
  end if;

  if to_regclass('public.schedule_contract_conditions_pending_project_idx') is null then
    raise exception 'Pending condition partial index is missing';
  end if;

  if to_regclass('private.indicator_contract_condition_sync_state') is null
     or has_table_privilege('anon', 'private.indicator_contract_condition_sync_state', 'select')
     or has_table_privilege('authenticated', 'private.indicator_contract_condition_sync_state', 'select')
     or not has_table_privilege('service_role', 'private.indicator_contract_condition_sync_state', 'select') then
    raise exception 'Indicator sync status storage is missing or exposed';
  end if;
end
$test$;
