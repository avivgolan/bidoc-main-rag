-- Verifies that rollback restored Phase 3F.1 and preserved legacy/Schedule rows.

do $test$
begin
  if to_regclass('private.contracts_documents') is not null
     or to_regclass('private.contracts') is not null
     or to_regclass('private.contract_relationships') is not null then
    raise exception 'R1-owned tables remain after rollback';
  end if;
  if to_regprocedure('public.bidoc_contracts_upsert_workspace_r1(jsonb)') is not null
     or to_regprocedure('public.bidoc_contracts_append_decision_r1(integer,jsonb)') is not null then
    raise exception 'R1-owned RPCs remain after rollback';
  end if;
  if to_regprocedure('public.bidoc_contracts_upsert_workspace_v1(jsonb)') is null
     or public.bidoc_contracts_workspace_status_v1() ->> 'migrationVersion' <> '20260812135210' then
    raise exception 'Legacy workspace RPC contract was not preserved';
  end if;
  if (select count(*) from private.contract_workspaces) <> 1
     or not exists (
       select 1
       from private.contract_workspaces
       where workspace_version = 'contracts-workspace.phase3f1.v1'
         and document_sha256 = repeat('e', 64)
         and schedule_project_id = '22222222-2222-4222-8222-222222222222'
     ) then
    raise exception 'Legacy workspace source row was not preserved';
  end if;
  if not (
    select attnotnull
    from pg_attribute
    where attrelid = 'private.contract_workspaces'::regclass
      and attname = 'schedule_project_id'
  ) then
    raise exception 'Rollback did not restore required legacy Schedule mapping';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'contract_workspaces'
      and column_name in (
        'parser_generation_id',
        'parser_version',
        'prompt_version',
        'extractor_version',
        'extraction_fingerprint_input'
      )
  ) then
    raise exception 'R1 workspace columns remain after rollback';
  end if;
  if (select count(*) from public.schedule_contract_milestones) <> 1
     or (select count(*) from public.schedule_contract_conditions) <> 1
     or (select count(*) from public.schedule_contract_extensions) <> 1 then
    raise exception 'Rollback changed Schedule source rows';
  end if;
end;
$test$;
