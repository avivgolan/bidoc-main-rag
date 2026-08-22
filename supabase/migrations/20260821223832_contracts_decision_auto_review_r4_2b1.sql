-- BIDoc Contracts Decisions Agent R4.2B.1
-- Atomically approves only server-planned decisions that pass deterministic
-- checks and a separate high-confidence verifier. It never rejects, corrects,
-- chooses conflict winners, hands off to Indicator, or writes Schedule rows.

create or replace function public.bidoc_contracts_decision_auto_review_status_r4_2b1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  return jsonb_build_object(
    'agentVersion', 'contracts-decisions-agent.r4.2b1.v1',
    'policyVersion', 'contracts-decisions-auto-review.r4.2b1.v1',
    'migrationVersion', '20260821223832',
    'scope', 'independent_high_confidence_decision_verification_with_human_fallback',
    'minimumConfidence', 0.98,
    'autoApproveEnabled', true,
    'autoRejectEnabled', false,
    'correctionEnabled', false,
    'conflictWinnerSelectionEnabled', false,
    'humanFallbackEnabled', true,
    'indicatorHandoffEnabled', false,
    'scheduleWritesEnabled', false
  );
end;
$$;

create or replace function public.bidoc_contracts_auto_review_decisions_r4_2b1(
  p_workspace_id uuid,
  p_requested_by_reviewer_id uuid,
  p_auto_policy_version text,
  p_verifier_model_version text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision_policy constant text := 'contracts-decisions-normalization.r4.2b.v1';
  v_support_policy constant text := 'contracts-decision-support.r4.2b.v1';
  v_auto_policy constant text := 'contracts-decisions-auto-review.r4.2b1.v1';
  v_auto_agent constant text := 'contracts-decisions-agent.r4.2b1.v1';
  v_verifier_schema constant text := 'contracts-decisions-auto-review-verifier.r4.2b1.v1';
  v_evidence_schema constant text := 'contracts-decisions-auto-review-evidence.r4.2b1.v1';
  v_item jsonb;
  v_policy_evidence jsonb;
  v_checks jsonb;
  v_current private.contracts%rowtype;
  v_latest private.contracts%rowtype;
  v_support private.contract_relationships%rowtype;
  v_source_item jsonb;
  v_source_clause private.contracts_documents%rowtype;
  v_append_result jsonb;
  v_new_decision_id uuid;
  v_reviewed_at timestamptz := statement_timestamp();
  v_reason text;
  v_seen_decision_ids uuid[] := '{}'::uuid[];
  v_approved_count integer := 0;
  v_support_superseded integer := 0;
  v_support_inserted integer := 0;
  v_projection jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null
     or p_requested_by_reviewer_id is null
     or p_auto_policy_version is distinct from v_auto_policy
     or char_length(btrim(coalesce(p_verifier_model_version, ''))) not between 1 and 200
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'The R4.2B.1 auto-review request is invalid';
  end if;
  if not exists (
    select 1
    from private.contract_workspaces workspace
    where workspace.id = p_workspace_id
      and workspace.workspace_version = 'contracts-workspace.r1.v1'
      and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
  ) then
    raise exception using errcode = 'P0002', message = 'The saved clause workspace was not found';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or (v_item - array['decisionId', 'expectedRevision', 'reasonHe', 'policyEvidence']::text[]) <> '{}'::jsonb
       or coalesce(v_item ->> 'decisionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_item ->> 'expectedRevision', '') !~ '^[1-9][0-9]*$'
       or char_length(btrim(coalesce(v_item ->> 'reasonHe', ''))) not between 10 and 1000
       or v_item ->> 'reasonHe' !~ '[א-ת]'
       or jsonb_typeof(v_item -> 'policyEvidence') is distinct from 'object' then
      raise exception using errcode = '22023', message = 'An R4.2B.1 auto-review item is invalid';
    end if;
    if (v_item ->> 'decisionId')::uuid = any(v_seen_decision_ids) then
      raise exception using errcode = '22023', message = 'An R4.2B.1 decision appears more than once';
    end if;
    v_seen_decision_ids := array_append(v_seen_decision_ids, (v_item ->> 'decisionId')::uuid);
    v_reason := btrim(v_item ->> 'reasonHe');
    v_policy_evidence := v_item -> 'policyEvidence';
    v_checks := v_policy_evidence -> 'deterministicChecks';
    if (v_policy_evidence - array[
         'schemaVersion', 'verifierSchemaVersion', 'verifierModelVersion',
         'verifierVerdict', 'verifierConfidence', 'verifierReasonCode',
         'verifierRationaleHe', 'temporalSignalPresent',
         'recurringSignalPresent', 'deterministicChecks', 'blockers'
       ]::text[]) <> '{}'::jsonb
       or v_policy_evidence ->> 'schemaVersion' is distinct from v_evidence_schema
       or v_policy_evidence ->> 'verifierSchemaVersion' is distinct from v_verifier_schema
       or v_policy_evidence ->> 'verifierModelVersion' is distinct from p_verifier_model_version
       or v_policy_evidence ->> 'verifierVerdict' is distinct from 'approve'
       or v_policy_evidence ->> 'verifierReasonCode' is distinct from 'accepted'
       or jsonb_typeof(v_policy_evidence -> 'verifierConfidence') is distinct from 'number'
       or (v_policy_evidence ->> 'verifierConfidence')::numeric < 0.98
       or (v_policy_evidence ->> 'verifierConfidence')::numeric > 1
       or char_length(btrim(coalesce(v_policy_evidence ->> 'verifierRationaleHe', ''))) not between 10 and 700
       or v_policy_evidence ->> 'verifierRationaleHe' !~ '[א-ת]'
       or jsonb_typeof(v_policy_evidence -> 'temporalSignalPresent') is distinct from 'boolean'
       or jsonb_typeof(v_policy_evidence -> 'recurringSignalPresent') is distinct from 'boolean'
       or jsonb_typeof(v_checks) is distinct from 'object'
       or (v_checks - array[
         'sourceEvidenceComplete', 'hebrewFieldsPresent', 'numericFactsGrounded',
         'partiesGrounded', 'temporalClassificationConsistent',
         'temporalShapeValid', 'recurringClassificationConsistent', 'conflictFree'
       ]::text[]) <> '{}'::jsonb
       or v_checks -> 'sourceEvidenceComplete' is distinct from 'true'::jsonb
       or v_checks -> 'hebrewFieldsPresent' is distinct from 'true'::jsonb
       or v_checks -> 'numericFactsGrounded' is distinct from 'true'::jsonb
       or v_checks -> 'partiesGrounded' is distinct from 'true'::jsonb
       or v_checks -> 'temporalClassificationConsistent' is distinct from 'true'::jsonb
       or v_checks -> 'temporalShapeValid' is distinct from 'true'::jsonb
       or v_checks -> 'recurringClassificationConsistent' is distinct from 'true'::jsonb
       or v_checks -> 'conflictFree' is distinct from 'true'::jsonb
       or v_policy_evidence -> 'blockers' is distinct from '[]'::jsonb then
      raise exception using errcode = '22023', message = 'The R4.2B.1 policy evidence is invalid';
    end if;

    select * into v_current
    from private.contracts decision
    where decision.id = (v_item ->> 'decisionId')::uuid
      and decision.workspace_id = p_workspace_id
      and decision.decision_policy_version = v_decision_policy;
    if not found then
      raise exception using errcode = 'P0002', message = 'The R4.2B decision proposal was not found';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_workspace_id::text || chr(31) || v_decision_policy || chr(31) || v_current.decision_key,
      0
    ));
    select * into v_latest
    from private.contracts decision
    where decision.workspace_id = v_current.workspace_id
      and decision.document_version_id = v_current.document_version_id
      and decision.parser_generation_id = v_current.parser_generation_id
      and decision.decision_key = v_current.decision_key
    order by decision.revision desc
    limit 1;
    if v_latest.id <> v_current.id
       or v_current.revision <> (v_item ->> 'expectedRevision')::integer
       or v_current.review_status <> 'proposed' then
      raise exception using errcode = '40001', message = 'Contract decision auto-review revision is stale';
    end if;
    if v_current.conflict_status <> 'none'
       or jsonb_typeof(v_current.source_evidence) is distinct from 'array'
       or jsonb_array_length(v_current.source_evidence) < 1
       or coalesce(v_current.title_he, '') !~ '[א-ת]'
       or coalesce(v_current.summary_he, '') !~ '[א-ת]'
       or coalesce(v_current.decision_text_he, '') !~ '[א-ת]'
       or ((v_policy_evidence ->> 'temporalSignalPresent')::boolean
         and (v_current.temporal_kind = 'none' or v_current.schedule_impact = 'unknown'))
       or ((v_policy_evidence ->> 'recurringSignalPresent')::boolean
         and (v_current.temporal_kind <> 'recurring' or v_current.recurring is not true)) then
      raise exception using errcode = '23514', message = 'The proposal does not satisfy the R4.2B.1 auto-approval policy';
    end if;

    v_append_result := public.bidoc_contracts_append_decision_r1(
      v_current.revision,
      jsonb_build_object(
        'workspaceId', v_current.workspace_id,
        'sourceProjectId', v_current.source_project_id,
        'scheduleProjectId', null,
        'documentVersionId', v_current.document_version_id,
        'parserGenerationId', v_current.parser_generation_id,
        'decisionKey', v_current.decision_key,
        'primaryClauseId', v_current.primary_clause_id,
        'sourceEvidence', v_current.source_evidence,
        'titleHe', v_current.title_he,
        'summaryHe', v_current.summary_he,
        'decisionTextHe', v_current.decision_text_he,
        'tags', to_jsonb(v_current.tags),
        'people', v_current.people,
        'responsibleParty', v_current.responsible_party,
        'beneficiary', v_current.beneficiary,
        'decisionCategory', v_current.decision_category,
        'conflictStatus', v_current.conflict_status,
        'scheduleImpact', v_current.schedule_impact,
        'temporalKind', v_current.temporal_kind,
        'contractDate', v_current.contract_date::text,
        'triggerKind', v_current.trigger_kind,
        'triggerDescriptionHe', v_current.trigger_description_he,
        'offsetValue', v_current.offset_value::text,
        'offsetUnit', v_current.offset_unit,
        'calendarSemantics', v_current.calendar_semantics,
        'recurring', v_current.recurring,
        'reviewStatus', 'approved',
        'reviewerId', p_requested_by_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', v_reason,
        'projectionStatus', case when v_current.schedule_impact = 'no' then 'not_applicable' else 'blocked' end,
        'modelVersion', v_current.model_version,
        'decisionPolicyVersion', v_current.decision_policy_version
      )
    );
    v_new_decision_id := (v_append_result ->> 'decisionId')::uuid;

    for v_support in
      select latest.*
      from (
        select distinct on (relationship.relationship_key) relationship.*
        from private.contract_relationships relationship
        where relationship.workspace_id = v_current.workspace_id
          and relationship.relationship_policy_version = v_support_policy
          and relationship.target_decision_id = v_current.id
        order by relationship.relationship_key, relationship.revision desc
      ) latest
      where latest.review_status = 'proposed'
      order by latest.relationship_key
    loop
      perform public.bidoc_contracts_append_relationship_r1(
        v_support.revision,
        jsonb_build_object(
          'workspaceId', v_support.workspace_id,
          'documentVersionId', v_support.document_version_id,
          'parserGenerationId', v_support.parser_generation_id,
          'sourceClauseId', v_support.source_clause_id,
          'targetDecisionId', v_support.target_decision_id,
          'relationshipType', v_support.relationship_type,
          'origin', v_support.origin,
          'confidence', v_support.confidence,
          'evidence', v_support.evidence,
          'modelVersion', v_support.model_version,
          'relationshipPolicyVersion', v_support.relationship_policy_version,
          'reviewStatus', 'superseded',
          'reviewerId', p_requested_by_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', v_reason
        )
      );
      v_support_superseded := v_support_superseded + 1;
    end loop;

    for v_source_item in select value from jsonb_array_elements(v_current.source_evidence) source(value)
    loop
      select * into v_source_clause
      from private.contracts_documents clause
      where clause.id = (v_source_item ->> 'clauseId')::uuid
        and clause.workspace_id = v_current.workspace_id;
      if not found then
        raise exception using errcode = '23503', message = 'An automatic decision review source clause was not found';
      end if;
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_current.workspace_id,
          'documentVersionId', v_current.document_version_id,
          'parserGenerationId', v_current.parser_generation_id,
          'sourceClauseId', v_source_clause.id,
          'targetDecisionId', v_new_decision_id,
          'relationshipType', 'supports_same_decision',
          'origin', 'system',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', jsonb_build_array(v_source_item),
            'rationaleHe', v_reason,
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-support-signals.r4.2b.v1',
              'reviewAction', 'approve',
              'reviewedProposalDecisionId', v_current.id,
              'source', 'r4.2b1_automatic_decision_review',
              'autoReview', jsonb_build_object(
                'mode', 'independent_model_auto_approval',
                'agentVersion', v_auto_agent,
                'policyVersion', v_auto_policy,
                'verifierModelVersion', p_verifier_model_version,
                'initiatedByReviewerId', p_requested_by_reviewer_id,
                'reviewedAt', v_reviewed_at,
                'policyEvidence', v_policy_evidence
              )
            )
          ),
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', v_support_policy,
          'reviewStatus', 'approved',
          'reviewerId', p_requested_by_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', v_reason
        )
      );
      v_support_inserted := v_support_inserted + 1;
    end loop;
    v_approved_count := v_approved_count + 1;
  end loop;

  v_projection := public.bidoc_contracts_get_decision_review_r4_2b(
    p_workspace_id,
    v_decision_policy
  );
  return v_projection || jsonb_build_object(
    'autoReview', jsonb_build_object(
      'agentVersion', v_auto_agent,
      'policyVersion', v_auto_policy,
      'approvedCount', v_approved_count,
      'requestedByReviewerId', p_requested_by_reviewer_id,
      'reviewedAt', v_reviewed_at,
      'supportSuperseded', v_support_superseded,
      'supportInserted', v_support_inserted,
      'atomic', true,
      'indicatorHandoffCount', 0,
      'scheduleWriteCount', 0
    )
  );
end;
$$;

revoke execute on function public.bidoc_contracts_decision_auto_review_status_r4_2b1()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_decision_auto_review_status_r4_2b1()
to service_role;
grant execute on function public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)
to service_role;

comment on function public.bidoc_contracts_decision_auto_review_status_r4_2b1()
is 'Service-role-only R4.2B.1 decision auto-review capability status. Performs no writes.';
comment on function public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)
is 'Atomically auto-approves only independently verified decisions; never rejects, corrects, hands off to Indicator, or writes Schedule.';
