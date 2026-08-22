do $$
declare
  v_status jsonb;
  v_apply_definition text;
begin
  if to_regprocedure('public.bidoc_contracts_decision_auto_review_status_r4_2b1()') is null
     or to_regprocedure('public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)') is null then
    raise exception 'R4.2B.1 auto-review functions are missing';
  end if;

  v_status := public.bidoc_contracts_decision_auto_review_status_r4_2b1();
  if v_status ->> 'agentVersion' <> 'contracts-decisions-agent.r4.2b1.v1'
     or v_status ->> 'policyVersion' <> 'contracts-decisions-auto-review.r4.2b1.v1'
     or v_status ->> 'migrationVersion' <> '20260821223832'
     or (v_status ->> 'minimumConfidence')::numeric <> 0.98
     or (v_status ->> 'autoApproveEnabled')::boolean is not true
     or (v_status ->> 'autoRejectEnabled')::boolean is not false
     or (v_status ->> 'correctionEnabled')::boolean is not false
     or (v_status ->> 'conflictWinnerSelectionEnabled')::boolean is not false
     or (v_status ->> 'humanFallbackEnabled')::boolean is not true
     or (v_status ->> 'indicatorHandoffEnabled')::boolean is not false
     or (v_status ->> 'scheduleWritesEnabled')::boolean is not false then
    raise exception 'R4.2B.1 status contract is invalid: %', v_status;
  end if;

  if has_function_privilege('anon', 'public.bidoc_contracts_decision_auto_review_status_r4_2b1()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_decision_auto_review_status_r4_2b1()', 'EXECUTE')
     or has_function_privilege('anon', 'public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)', 'EXECUTE') then
    raise exception 'Browser roles must not execute R4.2B.1 functions';
  end if;
  if not has_function_privilege('service_role', 'public.bidoc_contracts_decision_auto_review_status_r4_2b1()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)', 'EXECUTE') then
    raise exception 'service_role is missing R4.2B.1 execute privileges';
  end if;

  select pg_get_functiondef('public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)'::regprocedure)
  into v_apply_definition;
  if v_apply_definition ~* 'security[[:space:]]+definer'
     or v_apply_definition ~* '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(public\.)?schedule_'
     or v_apply_definition ~* 'bidoc_contracts_review_decision_r4_2b'
     or v_apply_definition ~* 'bidoc_contracts_review_decision_r6' then
    raise exception 'R4.2B.1 apply function violates its security or audit boundary';
  end if;
end;
$$;

select
  public.bidoc_contracts_decision_auto_review_status_r4_2b1() as status,
  count(*) filter (
    where relationship.evidence #>> '{signals,autoReview,policyVersion}'
      = 'contracts-decisions-auto-review.r4.2b1.v1'
  ) as automatic_decision_support_rows,
  count(*) filter (
    where relationship.evidence #>> '{signals,autoReview,policyVersion}'
      = 'contracts-decisions-auto-review.r4.2b1.v1'
      and (
        relationship.origin <> 'system'
        or relationship.review_status <> 'approved'
        or relationship.model_version <> 'not_applicable'
      )
  ) as invalid_automatic_decision_support_rows
from private.contract_relationships relationship;
