do $$
begin
  if exists (
    select 1
    from private.contract_relationships relationship
    where relationship.evidence #>> '{signals,autoReview,policyVersion}'
      = 'contracts-decisions-auto-review.r4.2b1.v1'
  ) then
    raise exception 'R4.2B.1 rollback refused: automatically reviewed decision history exists';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb);
drop function if exists public.bidoc_contracts_decision_auto_review_status_r4_2b1();
