do $$
begin
  if exists (
    select 1 from private.contracts
    where decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
  ) or exists (
    select 1 from private.contract_relationships
    where relationship_policy_version = 'contracts-decision-support.r4.2b.v1'
  ) then
    raise exception using
      errcode = '55000',
      message = 'R4.2B decision or support revisions exist; preserve the append-only review history';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_review_decision_r4_2b(uuid,uuid,integer,uuid,text,text,jsonb);
drop function if exists public.bidoc_contracts_persist_decisions_r4_2b(uuid,text,text,jsonb);
drop function if exists public.bidoc_contracts_get_decision_review_r4_2b(uuid,text);
drop function if exists public.bidoc_contracts_decision_review_status_r4_2b();
