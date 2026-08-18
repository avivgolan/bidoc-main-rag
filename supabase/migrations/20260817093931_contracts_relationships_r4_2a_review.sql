-- BIDoc Contracts Relationships Agent R4.2A
-- Persists only complete, skeptically verified R4.1 clause-to-clause proposals
-- and records authenticated human review as append-only relationship revisions.
-- This slice creates no normalized contractual decisions and performs no
-- Schedule projection or writes.

create or replace function public.bidoc_contracts_relationship_review_status_r4_2a()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'agentVersion', 'contracts-relationships-agent.r4.2a.v1',
    'relationshipPolicyVersion', 'contracts-relationships-semantic.r4.1.v2',
    'migrationVersion', '20260817093931',
    'scope', 'verified_semantic_proposals_and_human_review',
    'proposalPersistenceEnabled', true,
    'humanReviewEnabled', true,
    'decisionCreationEnabled', false,
    'conflictResolutionEnabled', false,
    'scheduleWritesEnabled', false
  );
$$;

create or replace function public.bidoc_contracts_get_relationship_review_r4_2a(
  p_workspace_id uuid,
  p_relationship_policy_version text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with workspace as (
    select item.*
    from private.contract_workspaces item
    where item.id = p_workspace_id
      and item.workspace_version = 'contracts-workspace.r1.v1'
      and item.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
      and p_relationship_policy_version = 'contracts-relationships-semantic.r4.1.v2'
  ),
  latest as (
    select distinct on (relationship.relationship_key) relationship.*
    from private.contract_relationships relationship
    join workspace on workspace.id = relationship.workspace_id
    where relationship.relationship_policy_version = p_relationship_policy_version
      and relationship.source_clause_id is not null
      and relationship.target_clause_id is not null
      and relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1'
    order by relationship.relationship_key, relationship.revision desc
  )
  select jsonb_build_object(
    'agentVersion', 'contracts-relationships-agent.r4.2a.v1',
    'relationshipPolicyVersion', p_relationship_policy_version,
    'migrationVersion', '20260817093931',
    'scope', 'verified_semantic_proposals_and_human_review',
    'workspace', jsonb_build_object(
      'workspaceId', workspace.id,
      'sourceProjectId', workspace.source_project_id,
      'documentVersionId', workspace.document_version_id,
      'parserGenerationId', workspace.parser_generation_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site
    ),
    'metrics', jsonb_build_object(
      'currentRelationshipCount', (select count(*) from latest),
      'modelProposalCount', (select count(*) from latest where origin = 'model'),
      'humanCorrectedCount', (select count(*) from latest where origin = 'human' and review_status = 'corrected'),
      'proposedCount', (select count(*) from latest where review_status = 'proposed'),
      'approvedCount', (select count(*) from latest where review_status = 'approved'),
      'correctedCount', (select count(*) from latest where review_status = 'corrected'),
      'rejectedCount', (select count(*) from latest where review_status = 'rejected'),
      'supersededCount', (select count(*) from latest where review_status = 'superseded'),
      'decisionCount', (select count(*) from private.contracts decision where decision.workspace_id = workspace.id),
      'scheduleWriteCount', 0
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relationshipId', relationship.id,
        'relationshipKey', relationship.relationship_key,
        'revision', relationship.revision,
        'relationshipType', relationship.relationship_type,
        'origin', relationship.origin,
        'confidence', relationship.confidence,
        'reviewStatus', relationship.review_status,
        'reviewerId', relationship.reviewer_id,
        'reviewedAt', relationship.reviewed_at,
        'reviewReason', relationship.review_reason,
        'sourceClauseId', source.id,
        'sourceClauseKey', source.clause_key,
        'sourceSummaryHe', source.summary_he,
        'sourcePageStart', source.page_start,
        'sourcePageEnd', source.page_end,
        'targetClauseId', target.id,
        'targetClauseKey', target.clause_key,
        'targetSummaryHe', target.summary_he,
        'targetPageStart', target.page_start,
        'targetPageEnd', target.page_end,
        'evidence', relationship.evidence,
        'modelVersion', relationship.model_version,
        'relationshipPolicyVersion', relationship.relationship_policy_version,
        'createdAt', relationship.created_at
      ) order by
        case relationship.review_status
          when 'proposed' then 0
          when 'corrected' then 1
          when 'approved' then 2
          when 'rejected' then 3
          when 'superseded' then 4
          else 5
        end,
        source.clause_order,
        target.clause_order,
        relationship.relationship_key)
      from latest relationship
      join private.contracts_documents source on source.id = relationship.source_clause_id
      join private.contracts_documents target on target.id = relationship.target_clause_id
    ), '[]'::jsonb),
    'gates', jsonb_build_object(
      'proposalPersistenceEnabled', true,
      'humanReviewEnabled', true,
      'decisionCreationEnabled', false,
      'conflictResolutionEnabled', false,
      'scheduleWritesEnabled', false
    )
  )
  from workspace;
$$;

create or replace function public.bidoc_contracts_persist_semantic_relationships_r4_2a(
  p_workspace_id uuid,
  p_relationship_policy_version text,
  p_prompt_version text,
  p_model_version text,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_proposal jsonb;
  v_source private.contracts_documents%rowtype;
  v_target private.contracts_documents%rowtype;
  v_swap private.contracts_documents%rowtype;
  v_existing private.contract_relationships%rowtype;
  v_relationship_type text;
  v_relationship_key text;
  v_append_result jsonb;
  v_projection jsonb;
  v_inserted integer := 0;
  v_reused integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_relationship_policy_version is distinct from 'contracts-relationships-semantic.r4.1.v2'
     or char_length(btrim(coalesce(p_prompt_version, ''))) not between 1 and 200
     or char_length(btrim(coalesce(p_model_version, ''))) not between 1 and 200
     or jsonb_typeof(p_proposals) is distinct from 'array'
     or jsonb_array_length(p_proposals) > 50 then
    raise exception using errcode = '22023', message = 'The R4.2A proposal envelope is invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_proposals) proposal(value)
    where jsonb_typeof(value) is distinct from 'object'
       or pg_column_size(value) > 32768
       or (value - array[
         'proposalKey', 'relationshipType', 'sourceClauseKey', 'targetClauseKey',
         'confidence', 'classifierConfidence', 'verificationConfidence',
         'verificationSchemaVersion', 'rationaleHe', 'retrieval'
       ]::text[]) <> '{}'::jsonb
       or coalesce(value ->> 'proposalKey', '') !~ '^[0-9a-f]{64}$'
       or value ->> 'relationshipType' not in (
         'supports_same_decision', 'depends_on', 'condition_of', 'exception_to',
         'amends', 'duplicates', 'conflicts_with'
       )
       or char_length(btrim(coalesce(value ->> 'sourceClauseKey', ''))) not between 1 and 200
       or char_length(btrim(coalesce(value ->> 'targetClauseKey', ''))) not between 1 and 200
       or value ->> 'sourceClauseKey' = value ->> 'targetClauseKey'
       or coalesce(value ->> 'confidence', '') !~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
       or coalesce(value ->> 'classifierConfidence', '') !~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
       or coalesce(value ->> 'verificationConfidence', '') !~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
       or (value ->> 'confidence')::numeric > (value ->> 'classifierConfidence')::numeric
       or (value ->> 'confidence')::numeric > (value ->> 'verificationConfidence')::numeric
       or value ->> 'verificationSchemaVersion' <> 'contracts-relationships-semantic-verifier.r4.1.v2'
       or jsonb_typeof(value -> 'rationaleHe') is distinct from 'string'
       or char_length(btrim(value ->> 'rationaleHe')) not between 8 and 240
       or (value ->> 'rationaleHe') !~ '[א-ת]'
       or jsonb_typeof(value -> 'retrieval') is distinct from 'object'
  ) or (
    select count(*) <> count(distinct value ->> 'proposalKey')
    from jsonb_array_elements(p_proposals) proposal(value)
  ) then
    raise exception using errcode = '22023', message = 'An R4.2A semantic proposal is invalid or duplicated';
  end if;

  select * into v_workspace
  from private.contract_workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.workspace_version = 'contracts-workspace.r1.v1'
    and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1';
  if not found then
    raise exception using errcode = 'P0002', message = 'The saved R3.2 clause workspace was not found';
  end if;
  if not exists (
    select 1 from private.contracts_documents clause where clause.workspace_id = p_workspace_id
  ) or exists (
    select 1 from private.contracts_documents clause
    where clause.workspace_id = p_workspace_id and clause.processing_status <> 'processed'
  ) then
    raise exception using errcode = '23514', message = 'The R3.2 clause generation is incomplete';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || chr(31) || p_relationship_policy_version,
    0
  ));

  for v_proposal in
    select value
    from jsonb_array_elements(p_proposals) proposal(value)
    order by value ->> 'proposalKey'
  loop
    v_relationship_type := v_proposal ->> 'relationshipType';
    select * into v_source
    from private.contracts_documents clause
    where clause.workspace_id = v_workspace.id
      and clause.document_version_id = v_workspace.document_version_id
      and clause.parser_generation_id = v_workspace.parser_generation_id
      and clause.clause_key = v_proposal ->> 'sourceClauseKey';
    if not found then
      raise exception using errcode = '23503', message = 'The semantic proposal source clause was not found';
    end if;
    select * into v_target
    from private.contracts_documents clause
    where clause.workspace_id = v_workspace.id
      and clause.document_version_id = v_workspace.document_version_id
      and clause.parser_generation_id = v_workspace.parser_generation_id
      and clause.clause_key = v_proposal ->> 'targetClauseKey';
    if not found or v_target.id = v_source.id then
      raise exception using errcode = '23503', message = 'The semantic proposal target clause was not found';
    end if;

    if v_relationship_type in ('duplicates', 'conflicts_with')
       and private.bidoc_contracts_endpoint_token_r1(v_source.id, null)
         > private.bidoc_contracts_endpoint_token_r1(v_target.id, null) then
      v_swap := v_source;
      v_source := v_target;
      v_target := v_swap;
    end if;

    v_relationship_key := private.bidoc_contracts_relationship_key_r1(
      v_workspace.document_version_id,
      v_workspace.parser_generation_id,
      v_relationship_type,
      v_source.id,
      null,
      v_target.id,
      null
    );
    select * into v_existing
    from private.contract_relationships relationship
    where relationship.workspace_id = v_workspace.id
      and relationship.document_version_id = v_workspace.document_version_id
      and relationship.parser_generation_id = v_workspace.parser_generation_id
      and relationship.relationship_policy_version = p_relationship_policy_version
      and relationship.relationship_key = v_relationship_key
    order by relationship.revision desc
    limit 1;
    if found then
      v_reused := v_reused + 1;
      continue;
    end if;

    v_append_result := public.bidoc_contracts_append_relationship_r1(
      0,
      jsonb_build_object(
        'workspaceId', v_workspace.id,
        'documentVersionId', v_workspace.document_version_id,
        'parserGenerationId', v_workspace.parser_generation_id,
        'sourceClauseId', v_source.id,
        'targetClauseId', v_target.id,
        'relationshipType', v_relationship_type,
        'origin', 'model',
        'confidence', (v_proposal ->> 'confidence')::numeric,
        'evidence', jsonb_build_object(
          'excerpts', jsonb_build_array(
            jsonb_build_object(
              'clauseId', v_source.id,
              'pageStart', v_source.page_start,
              'pageEnd', v_source.page_end,
              'rawTextSha256', v_source.raw_text_sha256,
              'excerpt', left(v_source.raw_text, 20000)
            ),
            jsonb_build_object(
              'clauseId', v_target.id,
              'pageStart', v_target.page_start,
              'pageEnd', v_target.page_end,
              'rawTextSha256', v_target.raw_text_sha256,
              'excerpt', left(v_target.raw_text, 20000)
            )
          ),
          'rationaleHe', btrim(v_proposal ->> 'rationaleHe'),
          'signals', jsonb_build_object(
            'schemaVersion', 'contracts-relationship-signals.r4.2a.v1',
            'proposalKey', v_proposal ->> 'proposalKey',
            'promptVersion', p_prompt_version,
            'classifierConfidence', (v_proposal ->> 'classifierConfidence')::numeric,
            'verificationConfidence', (v_proposal ->> 'verificationConfidence')::numeric,
            'verificationSchemaVersion', v_proposal ->> 'verificationSchemaVersion',
            'retrieval', v_proposal -> 'retrieval',
            'source', 'r4.1_complete_verified_preview'
          )
        ),
        'modelVersion', p_model_version,
        'relationshipPolicyVersion', p_relationship_policy_version,
        'reviewStatus', 'proposed'
      )
    );
    if coalesce((v_append_result ->> 'inserted')::boolean, false) then
      v_inserted := v_inserted + 1;
    else
      v_reused := v_reused + 1;
    end if;
  end loop;

  v_projection := public.bidoc_contracts_get_relationship_review_r4_2a(
    p_workspace_id,
    p_relationship_policy_version
  );
  return v_projection || jsonb_build_object(
    'persistence', jsonb_build_object(
      'inserted', v_inserted,
      'reused', v_reused,
      'atomic', true
    )
  );
end;
$$;

create or replace function public.bidoc_contracts_review_semantic_relationship_r4_2a(
  p_workspace_id uuid,
  p_relationship_id uuid,
  p_expected_revision integer,
  p_reviewer_id uuid,
  p_action text,
  p_reason_he text,
  p_correction jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_policy_version constant text := 'contracts-relationships-semantic.r4.1.v2';
  v_current private.contract_relationships%rowtype;
  v_latest private.contract_relationships%rowtype;
  v_source private.contracts_documents%rowtype;
  v_target private.contracts_documents%rowtype;
  v_swap private.contracts_documents%rowtype;
  v_new_key text;
  v_reviewed_at timestamptz := statement_timestamp();
  v_append_result jsonb;
  v_corrected_result jsonb := null;
  v_projection jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null
     or p_relationship_id is null
     or p_reviewer_id is null
     or p_expected_revision is null
     or p_expected_revision < 1
     or p_action not in ('approve', 'reject', 'correct')
     or char_length(btrim(coalesce(p_reason_he, ''))) not between 10 and 1000
     or p_reason_he !~ '[א-ת]' then
    raise exception using errcode = '22023', message = 'The R4.2A review decision is invalid';
  end if;
  if p_action = 'correct' then
    if jsonb_typeof(p_correction) is distinct from 'object'
       or (p_correction - array['relationshipType', 'sourceClauseKey', 'targetClauseKey']::text[]) <> '{}'::jsonb
       or p_correction ->> 'relationshipType' not in (
         'supports_same_decision', 'depends_on', 'condition_of', 'exception_to',
         'amends', 'duplicates', 'conflicts_with'
       )
       or char_length(btrim(coalesce(p_correction ->> 'sourceClauseKey', ''))) not between 1 and 200
       or char_length(btrim(coalesce(p_correction ->> 'targetClauseKey', ''))) not between 1 and 200
       or p_correction ->> 'sourceClauseKey' = p_correction ->> 'targetClauseKey' then
      raise exception using errcode = '22023', message = 'The R4.2A relationship correction is invalid';
    end if;
  elsif p_correction is not null then
    raise exception using errcode = '22023', message = 'Only a correction action may include corrected endpoints';
  end if;

  select * into v_current
  from private.contract_relationships relationship
  where relationship.id = p_relationship_id
    and relationship.workspace_id = p_workspace_id
    and relationship.relationship_policy_version = v_policy_version
    and relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1';
  if not found then
    raise exception using errcode = 'P0002', message = 'The relationship proposal was not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || chr(31) || v_policy_version || chr(31) || v_current.relationship_key,
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
     or v_current.revision <> p_expected_revision
     or v_current.review_status <> 'proposed' then
    raise exception using
      errcode = '40001',
      message = 'Contract relationship review revision is stale',
      detail = format('Expected proposal revision %s but the current revision is %s.', p_expected_revision, v_latest.revision);
  end if;

  if p_action in ('approve', 'reject') then
    v_append_result := public.bidoc_contracts_append_relationship_r1(
      p_expected_revision,
      jsonb_build_object(
        'workspaceId', v_current.workspace_id,
        'documentVersionId', v_current.document_version_id,
        'parserGenerationId', v_current.parser_generation_id,
        'sourceClauseId', v_current.source_clause_id,
        'targetClauseId', v_current.target_clause_id,
        'relationshipType', v_current.relationship_type,
        'origin', v_current.origin,
        'confidence', v_current.confidence,
        'evidence', v_current.evidence,
        'modelVersion', v_current.model_version,
        'relationshipPolicyVersion', v_current.relationship_policy_version,
        'reviewStatus', case p_action when 'approve' then 'approved' else 'rejected' end,
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he)
      )
    );
  else
    select * into v_source
    from private.contracts_documents clause
    where clause.workspace_id = v_current.workspace_id
      and clause.document_version_id = v_current.document_version_id
      and clause.parser_generation_id = v_current.parser_generation_id
      and clause.clause_key = p_correction ->> 'sourceClauseKey';
    if not found then
      raise exception using errcode = '23503', message = 'The corrected source clause was not found';
    end if;
    select * into v_target
    from private.contracts_documents clause
    where clause.workspace_id = v_current.workspace_id
      and clause.document_version_id = v_current.document_version_id
      and clause.parser_generation_id = v_current.parser_generation_id
      and clause.clause_key = p_correction ->> 'targetClauseKey';
    if not found
       or v_target.id = v_source.id
       or not (
         (v_source.id = v_current.source_clause_id and v_target.id = v_current.target_clause_id)
         or (v_source.id = v_current.target_clause_id and v_target.id = v_current.source_clause_id)
       ) then
      raise exception using errcode = '23514', message = 'A correction may only change the type or direction of the reviewed clause pair';
    end if;

    if p_correction ->> 'relationshipType' in ('duplicates', 'conflicts_with')
       and private.bidoc_contracts_endpoint_token_r1(v_source.id, null)
         > private.bidoc_contracts_endpoint_token_r1(v_target.id, null) then
      v_swap := v_source;
      v_source := v_target;
      v_target := v_swap;
    end if;
    v_new_key := private.bidoc_contracts_relationship_key_r1(
      v_current.document_version_id,
      v_current.parser_generation_id,
      p_correction ->> 'relationshipType',
      v_source.id,
      null,
      v_target.id,
      null
    );
    if v_new_key = v_current.relationship_key then
      raise exception using errcode = '22023', message = 'The correction must change the relationship type or direction';
    end if;
    if exists (
      select 1
      from private.contract_relationships relationship
      where relationship.workspace_id = v_current.workspace_id
        and relationship.document_version_id = v_current.document_version_id
        and relationship.parser_generation_id = v_current.parser_generation_id
        and relationship.relationship_policy_version = v_policy_version
        and relationship.relationship_key = v_new_key
    ) then
      raise exception using errcode = '23505', message = 'The corrected relationship already exists';
    end if;

    v_append_result := public.bidoc_contracts_append_relationship_r1(
      p_expected_revision,
      jsonb_build_object(
        'workspaceId', v_current.workspace_id,
        'documentVersionId', v_current.document_version_id,
        'parserGenerationId', v_current.parser_generation_id,
        'sourceClauseId', v_current.source_clause_id,
        'targetClauseId', v_current.target_clause_id,
        'relationshipType', v_current.relationship_type,
        'origin', v_current.origin,
        'confidence', v_current.confidence,
        'evidence', v_current.evidence,
        'modelVersion', v_current.model_version,
        'relationshipPolicyVersion', v_current.relationship_policy_version,
        'reviewStatus', 'superseded',
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he)
      )
    );
    v_corrected_result := public.bidoc_contracts_append_relationship_r1(
      0,
      jsonb_build_object(
        'workspaceId', v_current.workspace_id,
        'documentVersionId', v_current.document_version_id,
        'parserGenerationId', v_current.parser_generation_id,
        'sourceClauseId', v_source.id,
        'targetClauseId', v_target.id,
        'relationshipType', p_correction ->> 'relationshipType',
        'origin', 'human',
        'confidence', null,
        'evidence', jsonb_build_object(
          'excerpts', jsonb_build_array(
            jsonb_build_object(
              'clauseId', v_source.id,
              'pageStart', v_source.page_start,
              'pageEnd', v_source.page_end,
              'rawTextSha256', v_source.raw_text_sha256,
              'excerpt', left(v_source.raw_text, 20000)
            ),
            jsonb_build_object(
              'clauseId', v_target.id,
              'pageStart', v_target.page_start,
              'pageEnd', v_target.page_end,
              'rawTextSha256', v_target.raw_text_sha256,
              'excerpt', left(v_target.raw_text, 20000)
            )
          ),
          'rationaleHe', btrim(p_reason_he),
          'signals', (v_current.evidence -> 'signals') || jsonb_build_object(
            'schemaVersion', 'contracts-relationship-signals.r4.2a.v1',
            'reviewAction', 'correct',
            'reviewedProposalRelationshipId', v_current.id,
            'reviewedProposalRelationshipKey', v_current.relationship_key,
            'originalRelationshipType', v_current.relationship_type,
            'originalSourceClauseId', v_current.source_clause_id,
            'originalTargetClauseId', v_current.target_clause_id,
            'originalRationaleHe', v_current.evidence ->> 'rationaleHe'
          )
        ),
        'modelVersion', 'not_applicable',
        'relationshipPolicyVersion', v_current.relationship_policy_version,
        'reviewStatus', 'corrected',
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he)
      )
    );
  end if;

  v_projection := public.bidoc_contracts_get_relationship_review_r4_2a(
    p_workspace_id,
    v_policy_version
  );
  return v_projection || jsonb_build_object(
    'review', jsonb_build_object(
      'action', p_action,
      'reviewedRelationshipId', v_append_result ->> 'relationshipId',
      'correctedRelationshipId', v_corrected_result ->> 'relationshipId',
      'reviewedAt', v_reviewed_at,
      'atomic', true
    )
  );
end;
$$;

revoke execute on function public.bidoc_contracts_relationship_review_status_r4_2a()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_relationship_review_r4_2a(uuid,text)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_persist_semantic_relationships_r4_2a(uuid,text,text,text,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_review_semantic_relationship_r4_2a(uuid,uuid,integer,uuid,text,text,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_relationship_review_status_r4_2a() to service_role;
grant execute on function public.bidoc_contracts_get_relationship_review_r4_2a(uuid,text) to service_role;
grant execute on function public.bidoc_contracts_persist_semantic_relationships_r4_2a(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_review_semantic_relationship_r4_2a(uuid,uuid,integer,uuid,text,text,jsonb) to service_role;
