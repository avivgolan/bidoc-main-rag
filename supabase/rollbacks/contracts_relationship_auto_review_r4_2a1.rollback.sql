do $$
begin
  if exists (
    select 1
    from private.contract_relationships relationship
    where relationship.evidence #>> '{signals,autoReview,policyVersion}' = 'contracts-relationships-auto-review.r4.2a1.v1'
  ) then
    raise exception 'R4.2A.1 rollback refused: automatically reviewed relationship history exists';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb);
drop function if exists public.bidoc_contracts_relationship_auto_review_status_r4_2a1();
