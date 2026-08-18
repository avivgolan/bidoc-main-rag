-- Manual rollback for 20260817213000_contracts_schedule_projection_r5.sql.
-- Refuses to remove contractual lineage after any R5 target has been linked.

begin;

do $rollback$
begin
  if exists (select 1 from public.schedule_contract_milestones where source_contract_decision_id is not null)
     or exists (select 1 from public.schedule_contract_conditions where source_contract_decision_id is not null)
     or exists (select 1 from public.schedule_contract_extensions where source_contract_decision_id is not null) then
    raise exception using errcode = '55000', message = 'R5 rollback refused: Schedule rows already reference contractual decisions';
  end if;
end
$rollback$;

drop trigger if exists schedule_contract_milestones_source_decision_r5
  on public.schedule_contract_milestones;
drop trigger if exists schedule_contract_conditions_source_decision_r5
  on public.schedule_contract_conditions;
drop trigger if exists schedule_contract_extensions_source_decision_r5
  on public.schedule_contract_extensions;

drop function if exists public.bidoc_contracts_schedule_projection_source_r5(uuid);
drop function if exists private.bidoc_validate_schedule_contract_source_r5();

drop index if exists public.schedule_contract_milestones_source_decision_uidx;
drop index if exists public.schedule_contract_conditions_source_decision_uidx;
drop index if exists public.schedule_contract_extensions_source_decision_uidx;

alter table public.schedule_contract_milestones
  drop constraint if exists schedule_contract_milestones_source_decision_fk,
  drop column if exists source_contract_decision_id;
alter table public.schedule_contract_conditions
  drop constraint if exists schedule_contract_conditions_source_decision_fk,
  drop column if exists source_contract_decision_id;
alter table public.schedule_contract_extensions
  drop constraint if exists schedule_contract_extensions_source_decision_fk,
  drop column if exists source_contract_decision_id;

commit;
