-- Roll back only before Indicator has created a decision-linked Schedule row.

begin;

do $rollback$
begin
  if exists (select 1 from public.schedule_contract_milestones where source_contract_decision_id is not null)
     or exists (select 1 from public.schedule_contract_conditions where source_contract_decision_id is not null)
     or exists (select 1 from public.schedule_contract_extensions where source_contract_decision_id is not null) then
    raise exception using errcode = '55000', message = 'R5 handoff rollback refused: Indicator-linked Schedule rows already exist';
  end if;
end
$rollback$;

drop index if exists public.schedule_contract_milestones_source_decision_idx;
drop index if exists public.schedule_contract_conditions_source_decision_idx;
drop index if exists public.schedule_contract_extensions_source_decision_idx;

create unique index if not exists schedule_contract_milestones_source_decision_uidx
  on public.schedule_contract_milestones (source_contract_decision_id)
  where source_contract_decision_id is not null;
create unique index if not exists schedule_contract_conditions_source_decision_uidx
  on public.schedule_contract_conditions (source_contract_decision_id)
  where source_contract_decision_id is not null;
create unique index if not exists schedule_contract_extensions_source_decision_uidx
  on public.schedule_contract_extensions (source_contract_decision_id)
  where source_contract_decision_id is not null;

-- Restore the original mapping/target validator only while all linkage columns
-- are empty, as enforced above.
create or replace function private.bidoc_validate_schedule_contract_source_r5()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_source private.contracts%rowtype;
begin
  if new.source_contract_decision_id is null then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.source_contract_decision_id::text, 0));
  select decision.* into v_source from private.contracts decision where decision.id = new.source_contract_decision_id;
  if not found then raise exception using errcode = '23503', message = 'R5 source contractual decision does not exist'; end if;
  if v_source.review_status not in ('approved', 'corrected') then raise exception using errcode = '23514', message = 'R5 source decision is not human reviewed'; end if;
  if v_source.schedule_impact <> 'yes' then raise exception using errcode = '23514', message = 'R5 source decision is not approved for Schedule impact'; end if;
  if v_source.conflict_status = 'unresolved' then raise exception using errcode = '23514', message = 'R5 source decision has an unresolved conflict'; end if;
  if v_source.projection_status not in ('ready', 'projected') then raise exception using errcode = '23514', message = 'R5 source decision has not passed projection eligibility'; end if;
  if v_source.schedule_project_id is null or v_source.schedule_project_id <> new.project_id then raise exception using errcode = '23514', message = 'R5 source decision Schedule project does not match the target project'; end if;
  if exists (
    select 1 from private.contracts newer
    where newer.workspace_id = v_source.workspace_id
      and newer.document_version_id = v_source.document_version_id
      and newer.parser_generation_id = v_source.parser_generation_id
      and newer.decision_key = v_source.decision_key
      and newer.revision > v_source.revision
  ) then raise exception using errcode = '23514', message = 'R5 source decision is not the current decision revision'; end if;

  if tg_table_name = 'schedule_contract_milestones' then
    if v_source.temporal_kind <> 'fixed'
       or v_source.contract_date is null
       or new.contract_date is distinct from v_source.contract_date
       or new.source_document_id is distinct from v_source.document_version_id
       or new.status is distinct from 'active' then
      raise exception using errcode = '23514', message = 'R5 milestone target does not match the fixed contractual decision';
    end if;
  elsif tg_table_name = 'schedule_contract_conditions' then
    if v_source.temporal_kind not in ('relative', 'recurring')
       or new.anchor_description is distinct from v_source.trigger_description_he
       or new.offset_value is distinct from v_source.offset_value
       or new.offset_unit is distinct from v_source.offset_unit
       or new.recurring is distinct from v_source.recurring
       or new.status is distinct from 'pending'
       or new.trigger_event_date is not null then
      raise exception using errcode = '23514', message = 'R5 condition target does not match the unresolved relative contractual decision';
    end if;
  elsif tg_table_name = 'schedule_contract_extensions' then
    if v_source.temporal_kind <> 'extension'
       or new.source_document_id is distinct from v_source.document_version_id
       or new.status is distinct from 'approved' then
      raise exception using errcode = '23514', message = 'R5 extension target does not match the approved extension decision';
    end if;
  else
    raise exception using errcode = '23514', message = 'R5 source validation was attached to an unsupported target';
  end if;

  if tg_table_name <> 'schedule_contract_milestones' and exists (
    select 1 from public.schedule_contract_milestones target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then raise exception using errcode = '23505', message = 'R5 source decision already owns a milestone target'; end if;
  if tg_table_name <> 'schedule_contract_conditions' and exists (
    select 1 from public.schedule_contract_conditions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then raise exception using errcode = '23505', message = 'R5 source decision already owns a condition target'; end if;
  if tg_table_name <> 'schedule_contract_extensions' and exists (
    select 1 from public.schedule_contract_extensions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then raise exception using errcode = '23505', message = 'R5 source decision already owns an extension target'; end if;
  return new;
end
$function$;

revoke all on function private.bidoc_validate_schedule_contract_source_r5() from public;

create or replace function public.bidoc_contracts_schedule_projection_source_r5(p_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with workspace as (
    select saved.id from private.contract_workspaces saved where saved.id = p_workspace_id
  ),
  latest_decisions as (
    select distinct on (decision.decision_key)
      decision.id, decision.schedule_project_id, decision.projection_status,
      decision.decision_key, decision.revision
    from private.contracts decision
    where decision.workspace_id = p_workspace_id
      and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
    order by decision.decision_key, decision.revision desc
  )
  select jsonb_build_object(
    'migrationVersion', '20260817213000',
    'mode', 'read_only',
    'workspaceId', workspace.id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decisionId', decision.id,
        'scheduleProjectId', decision.schedule_project_id,
        'projectionStatus', decision.projection_status
      ) order by decision.decision_key)
      from latest_decisions decision
    ), '[]'::jsonb),
    'scheduleWriteCount', 0
  )
  from workspace;
$function$;

revoke execute on function public.bidoc_contracts_schedule_projection_source_r5(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_schedule_projection_source_r5(uuid)
  to service_role;

drop trigger if exists schedule_contract_milestones_source_decision_r5 on public.schedule_contract_milestones;
create trigger schedule_contract_milestones_source_decision_r5
before insert or update of source_contract_decision_id, project_id, contract_date, source_document_id, status
on public.schedule_contract_milestones for each row execute function private.bidoc_validate_schedule_contract_source_r5();

drop trigger if exists schedule_contract_conditions_source_decision_r5 on public.schedule_contract_conditions;
create trigger schedule_contract_conditions_source_decision_r5
before insert or update of source_contract_decision_id, project_id, anchor_description, offset_value, offset_unit, recurring, status, trigger_event_date
on public.schedule_contract_conditions for each row execute function private.bidoc_validate_schedule_contract_source_r5();

drop trigger if exists schedule_contract_extensions_source_decision_r5 on public.schedule_contract_extensions;
create trigger schedule_contract_extensions_source_decision_r5
before insert or update of source_contract_decision_id, project_id, source_document_id, status
on public.schedule_contract_extensions for each row execute function private.bidoc_validate_schedule_contract_source_r5();

commit;
