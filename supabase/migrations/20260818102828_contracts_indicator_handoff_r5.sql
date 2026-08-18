-- R5 correction: Contracts decides Indicator suitability; Indicator owns placement.
-- This migration changes only the dormant one-way lineage guard. It creates no
-- Contracts truth row, Schedule row, project mapping, target selection, or date.

begin;

-- The shadow-planner companion exposed Schedule mapping/projection state that
-- Contracts no longer owns. The reviewed R4.2C decision RPC remains the source
-- for the server-owned Indicator handoff service.
drop function if exists public.bidoc_contracts_schedule_projection_source_r5(uuid);

-- Cardinality and target choice belong to the future Indicator. Keep ordinary
-- lineage lookup indexes, but remove Contracts-owned one-target uniqueness.
drop index if exists public.schedule_contract_milestones_source_decision_uidx;
drop index if exists public.schedule_contract_conditions_source_decision_uidx;
drop index if exists public.schedule_contract_extensions_source_decision_uidx;

create index if not exists schedule_contract_milestones_source_decision_idx
  on public.schedule_contract_milestones (source_contract_decision_id)
  where source_contract_decision_id is not null;
create index if not exists schedule_contract_conditions_source_decision_idx
  on public.schedule_contract_conditions (source_contract_decision_id)
  where source_contract_decision_id is not null;
create index if not exists schedule_contract_extensions_source_decision_idx
  on public.schedule_contract_extensions (source_contract_decision_id)
  where source_contract_decision_id is not null;

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

  select decision.*
    into v_source
    from private.contracts decision
   where decision.id = new.source_contract_decision_id;

  if not found then
    raise exception using errcode = '23503', message = 'R5 source contractual decision does not exist';
  end if;
  if v_source.review_status not in ('approved', 'corrected') then
    raise exception using errcode = '23514', message = 'R5 source decision is not human reviewed';
  end if;
  if v_source.schedule_impact <> 'yes' then
    raise exception using errcode = '23514', message = 'R5 source decision is not approved for Indicator handoff';
  end if;
  if v_source.conflict_status not in ('none', 'reviewed') then
    raise exception using errcode = '23514', message = 'R5 source decision conflict is not cleared for Indicator handoff';
  end if;
  if exists (
    select 1
      from private.contracts newer
     where newer.workspace_id = v_source.workspace_id
       and newer.document_version_id = v_source.document_version_id
       and newer.parser_generation_id = v_source.parser_generation_id
       and newer.decision_key = v_source.decision_key
       and newer.revision > v_source.revision
  ) then
    raise exception using errcode = '23514', message = 'R5 source decision is not the current decision revision';
  end if;

  -- project_id, target table, cardinality, calendar handling, and the target
  -- payload are intentionally not validated here. They belong to Indicator.
  return new;
end
$function$;

revoke all on function private.bidoc_validate_schedule_contract_source_r5() from public;

drop trigger if exists schedule_contract_milestones_source_decision_r5
  on public.schedule_contract_milestones;
create trigger schedule_contract_milestones_source_decision_r5
before insert or update of source_contract_decision_id
on public.schedule_contract_milestones
for each row execute function private.bidoc_validate_schedule_contract_source_r5();

drop trigger if exists schedule_contract_conditions_source_decision_r5
  on public.schedule_contract_conditions;
create trigger schedule_contract_conditions_source_decision_r5
before insert or update of source_contract_decision_id
on public.schedule_contract_conditions
for each row execute function private.bidoc_validate_schedule_contract_source_r5();

drop trigger if exists schedule_contract_extensions_source_decision_r5
  on public.schedule_contract_extensions;
create trigger schedule_contract_extensions_source_decision_r5
before insert or update of source_contract_decision_id
on public.schedule_contract_extensions
for each row execute function private.bidoc_validate_schedule_contract_source_r5();

comment on column public.schedule_contract_milestones.source_contract_decision_id is
  'Optional Indicator-owned lineage to a current reviewed Contracts decision approved for Indicator handoff.';
comment on column public.schedule_contract_conditions.source_contract_decision_id is
  'Optional Indicator-owned lineage to a current reviewed Contracts decision; runtime resolution never rewrites Contracts truth.';
comment on column public.schedule_contract_extensions.source_contract_decision_id is
  'Optional Indicator-owned lineage to a current reviewed Contracts decision approved for Indicator handoff.';

comment on function private.bidoc_validate_schedule_contract_source_r5() is
  'Validates only Contracts provenance and handoff suitability. Indicator owns project placement, target choice, cardinality, and Schedule payload validation.';

commit;
