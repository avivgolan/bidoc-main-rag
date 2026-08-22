-- BIDoc Contracts Relationships Agent R4.2A.1
-- Atomically approves only server-planned high-confidence model proposals.
-- Ambiguous, conflicting, correction-prone, and rejected relationships remain
-- in the existing human review queue. No decisions or Schedule rows are made.

create or replace function public.bidoc_contracts_relationship_auto_review_status_r4_2a1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'agentVersion', 'contracts-relationships-agent.r4.2a1.v1',
    'policyVersion', 'contracts-relationships-auto-review.r4.2a1.v1',
    'migrationVersion', '20260821193107',
    'scope', 'high_confidence_model_agreement_with_human_fallback',
    'minimumConfidence', 0.95,
    'autoApproveEnabled', true,
    'autoRejectEnabled', false,
    'correctionEnabled', false,
    'humanFallbackEnabled', true,
    'decisionCreationEnabled', false,
    'scheduleWritesEnabled', false
  );
$$;

create or replace function public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(
  p_workspace_id uuid,
  p_requested_by_reviewer_id uuid,
  p_auto_policy_version text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_relationship_policy_version constant text := 'contracts-relationships-semantic.r4.1.v2';
  v_auto_policy_version constant text := 'contracts-relationships-auto-review.r4.2a1.v1';
  v_auto_agent_version constant text := 'contracts-relationships-agent.r4.2a1.v1';
  v_item jsonb;
  v_policy_evidence jsonb;
  v_checks jsonb;
  v_current private.contract_relationships%rowtype;
  v_latest private.contract_relationships%rowtype;
  v_reviewed_at timestamptz := statement_timestamp();
  v_append_result jsonb;
  v_approved_count integer := 0;
  v_projection jsonb;
  v_evidence jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null
     or p_requested_by_reviewer_id is null
     or p_auto_policy_version is distinct from v_auto_policy_version
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'The R4.2A.1 auto-review request is invalid';
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
       or (v_item - array['relationshipId', 'expectedRevision', 'reasonHe', 'policyEvidence']::text[]) <> '{}'::jsonb
       or coalesce(v_item ->> 'relationshipId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_item ->> 'expectedRevision', '') !~ '^[1-9][0-9]*$'
       or char_length(btrim(coalesce(v_item ->> 'reasonHe', ''))) not between 10 and 1000
       or v_item ->> 'reasonHe' !~ '[א-ת]'
       or jsonb_typeof(v_item -> 'policyEvidence') is distinct from 'object' then
      raise exception using errcode = '22023', message = 'An R4.2A.1 auto-review item is invalid';
    end if;
    v_policy_evidence := v_item -> 'policyEvidence';
    v_checks := v_policy_evidence -> 'checks';
    if (v_policy_evidence - array[
         'finalConfidence', 'classifierConfidence', 'verificationConfidence',
         'sameSection', 'explicitReference', 'checks', 'blockers'
       ]::text[]) <> '{}'::jsonb
       or jsonb_typeof(v_policy_evidence -> 'finalConfidence') is distinct from 'number'
       or jsonb_typeof(v_policy_evidence -> 'classifierConfidence') is distinct from 'number'
       or jsonb_typeof(v_policy_evidence -> 'verificationConfidence') is distinct from 'number'
       or jsonb_typeof(v_policy_evidence -> 'sameSection') is distinct from 'boolean'
       or jsonb_typeof(v_policy_evidence -> 'explicitReference') is distinct from 'boolean'
       or jsonb_typeof(v_checks) is distinct from 'object'
       or (v_checks - array['amountMismatch', 'dateMismatch', 'deadlineMismatch', 'triggerMismatch']::text[]) <> '{}'::jsonb
       or v_checks -> 'amountMismatch' is distinct from 'false'::jsonb
       or v_checks -> 'dateMismatch' is distinct from 'false'::jsonb
       or v_checks -> 'deadlineMismatch' is distinct from 'false'::jsonb
       or v_checks -> 'triggerMismatch' is distinct from 'false'::jsonb
       or v_policy_evidence -> 'blockers' is distinct from '[]'::jsonb
       or not ((v_policy_evidence ->> 'sameSection')::boolean or (v_policy_evidence ->> 'explicitReference')::boolean) then
      raise exception using errcode = '22023', message = 'The R4.2A.1 policy evidence is invalid';
    end if;

    select * into v_current
    from private.contract_relationships relationship
    where relationship.id = (v_item ->> 'relationshipId')::uuid
      and relationship.workspace_id = p_workspace_id
      and relationship.relationship_policy_version = v_relationship_policy_version
      and relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1';
    if not found then
      raise exception using errcode = 'P0002', message = 'The relationship proposal was not found';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      p_workspace_id::text || chr(31) || v_relationship_policy_version || chr(31) || v_current.relationship_key,
      0
    ));
    select * into v_latest
    from private.contract_relationships relationship
    where relationship.workspace_id = v_current.workspace_id
      and relationship.document_version_id = v_current.document_version_id
      and relationship.parser_generation_id = v_current.parser_generation_id
      and relationship.relationship_policy_version = v_current.relationship_policy_version
      and relationship.relationship_key = v_current.relationship_key
    order by relationship.revision desc
    limit 1;
    if v_latest.id <> v_current.id
       or v_current.revision <> (v_item ->> 'expectedRevision')::integer
       or v_current.review_status <> 'proposed'
       or v_current.origin <> 'model' then
      raise exception using errcode = '40001', message = 'Contract relationship auto-review revision is stale';
    end if;
    if v_current.relationship_type not in ('supports_same_decision', 'depends_on', 'condition_of')
       or coalesce(v_current.confidence, -1) < 0.95
       or coalesce((v_current.evidence #>> '{signals,classifierConfidence}')::numeric, -1) < 0.95
       or coalesce((v_current.evidence #>> '{signals,verificationConfidence}')::numeric, -1) < 0.95
       or v_current.evidence #>> '{signals,verificationSchemaVersion}' is distinct from 'contracts-relationships-semantic-verifier.r4.1.v2'
       or jsonb_typeof(v_current.evidence -> 'excerpts') is distinct from 'array'
       or jsonb_array_length(v_current.evidence -> 'excerpts') <> 2
       or coalesce(v_current.evidence ->> 'rationaleHe', '') !~ '[א-ת]'
       or not (
         coalesce((v_current.evidence #>> '{signals,retrieval,sameSection}')::boolean, false)
         or coalesce((v_current.evidence #>> '{signals,retrieval,explicitReference}')::boolean, false)
       )
       or (v_policy_evidence ->> 'finalConfidence')::numeric is distinct from v_current.confidence
       or (v_policy_evidence ->> 'classifierConfidence')::numeric is distinct from (v_current.evidence #>> '{signals,classifierConfidence}')::numeric
       or (v_policy_evidence ->> 'verificationConfidence')::numeric is distinct from (v_current.evidence #>> '{signals,verificationConfidence}')::numeric
       or (v_policy_evidence ->> 'sameSection')::boolean is distinct from coalesce((v_current.evidence #>> '{signals,retrieval,sameSection}')::boolean, false)
       or (v_policy_evidence ->> 'explicitReference')::boolean is distinct from coalesce((v_current.evidence #>> '{signals,retrieval,explicitReference}')::boolean, false) then
      raise exception using errcode = '23514', message = 'The proposal does not satisfy the R4.2A.1 auto-approval policy';
    end if;

    v_evidence := jsonb_set(
      v_current.evidence,
      '{signals}',
      (v_current.evidence -> 'signals') || jsonb_build_object(
        'autoReview', jsonb_build_object(
          'mode', 'model_auto_approval',
          'decision', 'approve',
          'agentVersion', v_auto_agent_version,
          'policyVersion', v_auto_policy_version,
          'modelVersion', v_current.model_version,
          'initiatedByReviewerId', p_requested_by_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'policyEvidence', v_policy_evidence
        )
      ),
      true
    );
    v_append_result := public.bidoc_contracts_append_relationship_r1(
      v_current.revision,
      jsonb_build_object(
        'workspaceId', v_current.workspace_id,
        'documentVersionId', v_current.document_version_id,
        'parserGenerationId', v_current.parser_generation_id,
        'sourceClauseId', v_current.source_clause_id,
        'targetClauseId', v_current.target_clause_id,
        'relationshipType', v_current.relationship_type,
        'origin', v_current.origin,
        'confidence', v_current.confidence,
        'evidence', v_evidence,
        'modelVersion', v_current.model_version,
        'relationshipPolicyVersion', v_current.relationship_policy_version,
        'reviewStatus', 'approved',
        'reviewerId', p_requested_by_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(v_item ->> 'reasonHe')
      )
    );
    if coalesce((v_append_result ->> 'inserted')::boolean, false) is not true then
      raise exception using errcode = '23514', message = 'The automatic relationship review was not appended';
    end if;
    v_approved_count := v_approved_count + 1;
  end loop;

  v_projection := public.bidoc_contracts_get_relationship_review_r4_2a(
    p_workspace_id,
    v_relationship_policy_version
  );
  return v_projection || jsonb_build_object(
    'autoReview', jsonb_build_object(
      'agentVersion', v_auto_agent_version,
      'policyVersion', v_auto_policy_version,
      'approvedCount', v_approved_count,
      'requestedByReviewerId', p_requested_by_reviewer_id,
      'reviewedAt', v_reviewed_at,
      'atomic', true,
      'decisionCount', 0,
      'scheduleWriteCount', 0
    )
  );
end;
$$;

revoke execute on function public.bidoc_contracts_relationship_auto_review_status_r4_2a1()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_relationship_auto_review_status_r4_2a1()
to service_role;
grant execute on function public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)
to service_role;

comment on function public.bidoc_contracts_relationship_auto_review_status_r4_2a1()
is 'Service-role-only R4.2A.1 auto-review capability status. Performs no writes.';
comment on function public.bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)
is 'Atomically auto-approves only high-confidence verified semantic relationships; never rejects, corrects, creates decisions, or writes Schedule.';
