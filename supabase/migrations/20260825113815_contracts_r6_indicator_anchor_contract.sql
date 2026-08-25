-- Adapts the R6 controlled Hebrew trigger vocabulary to the established
-- Schedule anchor contract. It preserves Contract truth and makes the
-- existing Indicator V1 writer produce the correct anchor_kind idempotently.

begin;

create or replace function private.bidoc_schedule_condition_anchor_contract_r6()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.metadata ->> 'trigger_kind' in ('commencement_of_works', 'תחילת העבודה') then
    new.anchor_kind := 'schedule_task';
  end if;
  return new;
end
$function$;

drop trigger if exists bidoc_schedule_condition_anchor_contract_r6
  on public.schedule_contract_conditions;
create trigger bidoc_schedule_condition_anchor_contract_r6
before insert or update of anchor_kind, metadata
on public.schedule_contract_conditions
for each row execute function private.bidoc_schedule_condition_anchor_contract_r6();

-- Reconcile only pending rows already owned by the Indicator sync. This makes
-- an R6 deployment safe if a Hebrew commencement condition existed before the
-- trigger was introduced; resolved/dismissed lifecycle history is untouched.
update public.schedule_contract_conditions condition
set anchor_kind = 'schedule_task',
    updated_at = pg_catalog.clock_timestamp()
where condition.status = 'pending'
  and condition.metadata ->> 'trigger_kind' = 'תחילת העבודה'
  and condition.anchor_kind is distinct from 'schedule_task';

revoke execute on function private.bidoc_schedule_condition_anchor_contract_r6()
  from public, anon, authenticated, service_role;
grant execute on function private.bidoc_schedule_condition_anchor_contract_r6()
  to service_role;

comment on function private.bidoc_schedule_condition_anchor_contract_r6() is
  'Maps only the canonical R6 Hebrew commencement trigger to the Schedule task-anchor kind; all other contract triggers remain event anchors.';

commit;
