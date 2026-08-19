begin;

-- Indicator projects relative decisions through the active Contracts-to-Schedule
-- mapping. Those decisions can legitimately remain blocked for the older direct
-- R5 projection, so the source guard must validate the mapping instead of the
-- decision's legacy projection_status/schedule_project_id fields.
create or replace function private.bidoc_validate_schedule_contract_source_r5()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_source private.contracts%rowtype;
  v_indicator_condition boolean;
begin
  if new.source_contract_decision_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.source_contract_decision_id::text, 0)
  );

  select decision.* into v_source
  from private.contracts decision
  where decision.id = new.source_contract_decision_id;
  if not found then
    raise exception using errcode = '23503', message = 'R5 source contractual decision does not exist';
  end if;

  if tg_table_name = 'schedule_contract_conditions'
     and tg_op = 'UPDATE'
     and old.source_contract_decision_id = new.source_contract_decision_id then
    if new.project_id is distinct from old.project_id
       or new.anchor_description is distinct from v_source.trigger_description_he
       or new.offset_value is distinct from v_source.offset_value
       or new.offset_unit is distinct from v_source.offset_unit
       or new.recurring is distinct from v_source.recurring
       or new.status not in ('pending', 'resolved', 'dismissed')
       or (new.status = 'resolved' and (new.recurring or new.trigger_event_date is null))
       or (new.status = 'pending' and new.trigger_event_date is not null and not new.recurring
           and coalesce(new.metadata ->> 'pending_reason', '') = '') then
      raise exception using errcode = '23514', message = 'R5 condition lifecycle update changed contractual truth';
    end if;
    return new;
  end if;

  v_indicator_condition :=
    tg_table_name = 'schedule_contract_conditions'
    and new.written_by = 'indicator_agent'
    and coalesce(new.metadata ->> 'sync_version', '') = 'indicator-contract-conditions.v1';

  if v_source.review_status not in ('approved', 'corrected')
     or v_source.schedule_impact <> 'yes'
     or v_source.conflict_status = 'unresolved' then
    raise exception using errcode = '23514', message = 'R5 source decision is not eligible for Schedule projection';
  end if;

  if v_indicator_condition then
    if not exists (
      select 1
      from private.contract_workspaces workspace
      join private.schedule_contract_project_mappings mapping
        on mapping.source_system = 'main'
       and mapping.source_project_id = workspace.source_project_id
       and mapping.status = 'active'
      where workspace.id = v_source.workspace_id
        and mapping.schedule_project_id = new.project_id
    ) then
      raise exception using errcode = '23514', message = 'Indicator source decision has no active Schedule project mapping';
    end if;
  elsif v_source.projection_status not in ('ready', 'projected')
     or v_source.schedule_project_id is null
     or v_source.schedule_project_id <> new.project_id then
    raise exception using errcode = '23514', message = 'R5 source decision is not eligible for Schedule projection';
  end if;

  if exists (
    select 1 from private.contracts newer
    where newer.workspace_id = v_source.workspace_id
      and newer.document_version_id = v_source.document_version_id
      and newer.parser_generation_id = v_source.parser_generation_id
      and newer.decision_key = v_source.decision_key
      and newer.revision > v_source.revision
  ) then
    raise exception using errcode = '23514', message = 'R5 source decision is not the current decision revision';
  end if;

  if tg_table_name = 'schedule_contract_conditions' then
    if v_source.temporal_kind not in ('relative', 'recurring')
       or new.anchor_description is distinct from v_source.trigger_description_he
       or new.offset_value is distinct from v_source.offset_value
       or new.offset_unit is distinct from v_source.offset_unit
       or new.recurring is distinct from v_source.recurring
       or new.status is distinct from 'pending'
       or new.trigger_event_date is not null then
      raise exception using errcode = '23514', message = 'R5 condition target does not match the unresolved relative contractual decision';
    end if;
  elsif tg_table_name = 'schedule_contract_milestones' then
    if v_source.temporal_kind <> 'fixed'
       or v_source.contract_date is null
       or new.contract_date is distinct from v_source.contract_date
       or new.source_document_id is distinct from v_source.document_version_id
       or new.status is distinct from 'active' then
      raise exception using errcode = '23514', message = 'R5 milestone target does not match the fixed contractual decision';
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
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns a milestone target';
  end if;
  if tg_table_name <> 'schedule_contract_conditions' and exists (
    select 1 from public.schedule_contract_conditions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns a condition target';
  end if;
  if tg_table_name <> 'schedule_contract_extensions' and exists (
    select 1 from public.schedule_contract_extensions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns an extension target';
  end if;

  return new;
end
$function$;

comment on function private.bidoc_validate_schedule_contract_source_r5() is
  'Validates immutable R5 contract truth while allowing Indicator-owned relative conditions through an active project mapping.';

commit;
