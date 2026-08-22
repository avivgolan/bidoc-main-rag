do $$
declare
  v_status jsonb;
begin
  if to_regprocedure('public.bidoc_contracts_relationship_auto_review_status_r4_2a1()') is null
     or to_regprocedure('public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)') is null then
    raise exception 'R4.2A.1 auto-review functions are missing';
  end if;

  v_status := public.bidoc_contracts_relationship_auto_review_status_r4_2a1();
  if v_status ->> 'agentVersion' <> 'contracts-relationships-agent.r4.2a1.v1'
     or v_status ->> 'policyVersion' <> 'contracts-relationships-auto-review.r4.2a1.v1'
     or v_status ->> 'migrationVersion' <> '20260821193107'
     or (v_status ->> 'minimumConfidence')::numeric <> 0.95
     or (v_status ->> 'autoApproveEnabled')::boolean is not true
     or (v_status ->> 'autoRejectEnabled')::boolean is not false
     or (v_status ->> 'correctionEnabled')::boolean is not false
     or (v_status ->> 'humanFallbackEnabled')::boolean is not true
     or (v_status ->> 'decisionCreationEnabled')::boolean is not false
     or (v_status ->> 'scheduleWritesEnabled')::boolean is not false then
    raise exception 'R4.2A.1 status contract is invalid: %', v_status;
  end if;

  if has_function_privilege('anon', 'public.bidoc_contracts_relationship_auto_review_status_r4_2a1()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_relationship_auto_review_status_r4_2a1()', 'EXECUTE')
     or has_function_privilege('anon', 'public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'Browser roles must not execute R4.2A.1 functions';
  end if;

  if not has_function_privilege('service_role', 'public.bidoc_contracts_relationship_auto_review_status_r4_2a1()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role is missing R4.2A.1 execute privileges';
  end if;
end;
$$;

select
  public.bidoc_contracts_relationship_auto_review_status_r4_2a1() as status,
  count(*) filter (
    where relationship.evidence #>> '{signals,autoReview,policyVersion}'
      = 'contracts-relationships-auto-review.r4.2a1.v1'
  ) as automatically_reviewed_relationship_rows,
  count(*) filter (
    where relationship.evidence #>> '{signals,autoReview,mode}' = 'model_auto_approval'
      and relationship.review_status <> 'approved'
  ) as invalid_automatic_review_status_rows
from private.contract_relationships relationship;
