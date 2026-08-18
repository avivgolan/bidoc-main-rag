-- Verifies that R1 can be reapplied after the preservation-safe rollback.

do $test$
begin
  if to_regclass('private.contracts_documents') is null
     or to_regclass('private.contracts') is null
     or to_regclass('private.contract_relationships') is null then
    raise exception 'R1 tables are missing after reapply';
  end if;
  if public.bidoc_contracts_schema_status_r1() ->> 'migrationVersion' <> '20260815103618' then
    raise exception 'R1 status RPC is invalid after reapply';
  end if;
  if (select count(*) from private.contract_workspaces) <> 1
     or not exists (
       select 1
       from private.contract_workspaces
       where workspace_version = 'contracts-workspace.phase3f1.v1'
         and parser_generation_id is null
         and schedule_project_id = '22222222-2222-4222-8222-222222222222'
     ) then
    raise exception 'Legacy workspace was not preserved through reapply';
  end if;
  if (select count(*) from public.schedule_contract_milestones) <> 1
     or (select count(*) from public.schedule_contract_conditions) <> 1
     or (select count(*) from public.schedule_contract_extensions) <> 1 then
    raise exception 'Reapply changed Schedule rows';
  end if;
end;
$test$;
