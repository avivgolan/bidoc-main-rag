-- BIDoc Contracts Decisions Agent R4.2B
-- Normalizes reviewed clause relationships into append-only contractual
-- decision proposals and records bounded authenticated human review.
-- This slice does not select conflict winners and performs no Schedule writes.

create or replace function public.bidoc_contracts_decision_review_status_r4_2b()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'agentVersion', 'contracts-decisions-agent.r4.2b.v1',
    'decisionPolicyVersion', 'contracts-decisions-normalization.r4.2b.v1',
    'supportRelationshipPolicyVersion', 'contracts-decision-support.r4.2b.v1',
    'migrationVersion', '20260817121000',
    'scope', 'reviewed_relationships_to_normalized_decision_proposals',
    'decisionPersistenceEnabled', true,
    'humanReviewEnabled', true,
    'conflictWinnerSelectionEnabled', false,
    'scheduleWritesEnabled', false
  );
$$;

create or replace function public.bidoc_contracts_get_decision_review_r4_2b(
  p_workspace_id uuid,
  p_decision_policy_version text
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
      and p_decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
  ),
  latest_semantic_relationships as (
    select distinct on (relationship.relationship_key) relationship.*
    from private.contract_relationships relationship
    join workspace on workspace.id = relationship.workspace_id
    where relationship.relationship_policy_version = 'contracts-relationships-semantic.r4.1.v2'
      and relationship.source_clause_id is not null
      and relationship.target_clause_id is not null
      and relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1'
    order by relationship.relationship_key, relationship.revision desc
  ),
  latest_decisions as (
    select distinct on (decision.decision_key) decision.*
    from private.contracts decision
    join workspace on workspace.id = decision.workspace_id
    where decision.decision_policy_version = p_decision_policy_version
    order by decision.decision_key, decision.revision desc
  )
  select jsonb_build_object(
    'agentVersion', 'contracts-decisions-agent.r4.2b.v1',
    'decisionPolicyVersion', p_decision_policy_version,
    'supportRelationshipPolicyVersion', 'contracts-decision-support.r4.2b.v1',
    'migrationVersion', '20260817121000',
    'scope', 'reviewed_relationships_to_normalized_decision_proposals',
    'workspace', jsonb_build_object(
      'workspaceId', workspace.id,
      'sourceProjectId', workspace.source_project_id,
      'documentVersionId', workspace.document_version_id,
      'documentSha256', workspace.document_sha256,
      'parserGenerationId', workspace.parser_generation_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site
    ),
    'metrics', jsonb_build_object(
      'currentRelationshipCount', (select count(*) from latest_semantic_relationships),
      'pendingRelationshipCount', (select count(*) from latest_semantic_relationships where review_status = 'proposed'),
      'acceptedRelationshipCount', (select count(*) from latest_semantic_relationships where review_status in ('approved', 'corrected')),
      'currentDecisionCount', (select count(*) from latest_decisions),
      'proposedCount', (select count(*) from latest_decisions where review_status = 'proposed'),
      'approvedCount', (select count(*) from latest_decisions where review_status = 'approved'),
      'correctedCount', (select count(*) from latest_decisions where review_status = 'corrected'),
      'rejectedCount', (select count(*) from latest_decisions where review_status = 'rejected'),
      'unresolvedCount', (select count(*) from latest_decisions where review_status = 'unresolved'),
      'scheduleWriteCount', 0
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decisionId', decision.id,
        'decisionKey', decision.decision_key,
        'revision', decision.revision,
        'supersedesDecisionId', decision.supersedes_decision_id,
        'primaryClauseId', decision.primary_clause_id,
        'sourceEvidence', decision.source_evidence,
        'titleHe', decision.title_he,
        'summaryHe', decision.summary_he,
        'decisionTextHe', decision.decision_text_he,
        'tags', decision.tags,
        'people', decision.people,
        'responsibleParty', decision.responsible_party,
        'beneficiary', decision.beneficiary,
        'decisionCategory', decision.decision_category,
        'conflictStatus', decision.conflict_status,
        'scheduleImpact', decision.schedule_impact,
        'temporalKind', decision.temporal_kind,
        'contractDate', decision.contract_date,
        'triggerKind', decision.trigger_kind,
        'triggerDescriptionHe', decision.trigger_description_he,
        'offsetValue', decision.offset_value,
        'offsetUnit', decision.offset_unit,
        'calendarSemantics', decision.calendar_semantics,
        'recurring', decision.recurring,
        'reviewStatus', decision.review_status,
        'reviewerId', decision.reviewer_id,
        'reviewedAt', decision.reviewed_at,
        'reviewReason', decision.review_reason,
        'projectionStatus', decision.projection_status,
        'modelVersion', decision.model_version,
        'decisionPolicyVersion', decision.decision_policy_version,
        'createdAt', decision.created_at
      ) order by
        case decision.review_status
          when 'proposed' then 0
          when 'unresolved' then 1
          when 'corrected' then 2
          when 'approved' then 3
          when 'rejected' then 4
          else 5
        end,
        decision.created_at,
        decision.decision_key)
      from latest_decisions decision
    ), '[]'::jsonb),
    'gates', jsonb_build_object(
      'decisionPersistenceEnabled', true,
      'humanReviewEnabled', true,
      'relationshipReviewComplete', not exists (
        select 1 from latest_semantic_relationships where review_status = 'proposed'
      ),
      'conflictWinnerSelectionEnabled', false,
      'scheduleWritesEnabled', false
    )
  )
  from workspace;
$$;

create or replace function public.bidoc_contracts_persist_decisions_r4_2b(
  p_workspace_id uuid,
  p_decision_policy_version text,
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
  v_primary_clause private.contracts_documents%rowtype;
  v_existing private.contracts%rowtype;
  v_clause_count integer;
  v_source_evidence jsonb;
  v_expected_proposal_key text;
  v_expected_decision_key text;
  v_append_result jsonb;
  v_decision_id uuid;
  v_source_item jsonb;
  v_source_clause private.contracts_documents%rowtype;
  v_support_key text;
  v_support_existing private.contract_relationships%rowtype;
  v_projection jsonb;
  v_inserted integer := 0;
  v_reused integer := 0;
  v_support_inserted integer := 0;
  v_support_reused integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_decision_policy_version is distinct from 'contracts-decisions-normalization.r4.2b.v1'
     or char_length(btrim(coalesce(p_model_version, ''))) not between 1 and 200
     or jsonb_typeof(p_proposals) is distinct from 'array'
     or jsonb_array_length(p_proposals) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'The R4.2B proposal envelope is invalid';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_proposals) proposal(value)
    where jsonb_typeof(value) is distinct from 'object'
       or pg_column_size(value) > 131072
       or (value - array[
         'proposalKey', 'decisionKey', 'primaryClauseKey', 'sourceClauseKeys',
         'titleHe', 'summaryHe', 'decisionTextHe', 'tags', 'people',
         'responsibleParty', 'beneficiary', 'decisionCategory', 'conflictStatus',
         'scheduleImpact', 'temporalKind', 'contractDate', 'triggerKind',
         'triggerDescriptionHe', 'offsetValue', 'offsetUnit', 'calendarSemantics',
         'recurring'
       ]::text[]) <> '{}'::jsonb
       or coalesce(value ->> 'proposalKey', '') !~ '^[0-9a-f]{64}$'
       or char_length(btrim(coalesce(value ->> 'decisionKey', ''))) not between 1 and 300
       or char_length(btrim(coalesce(value ->> 'primaryClauseKey', ''))) not between 1 and 300
       or jsonb_typeof(value -> 'sourceClauseKeys') is distinct from 'array'
       or jsonb_array_length(value -> 'sourceClauseKeys') not between 1 and 20
       or exists (
         select 1 from jsonb_array_elements(value -> 'sourceClauseKeys') key(item)
         where jsonb_typeof(item) is distinct from 'string'
            or char_length(btrim(item #>> '{}')) not between 1 and 300
       )
       or char_length(btrim(coalesce(value ->> 'titleHe', ''))) not between 5 and 1000
       or char_length(btrim(coalesce(value ->> 'summaryHe', ''))) not between 10 and 10000
       or char_length(btrim(coalesce(value ->> 'decisionTextHe', ''))) not between 10 and 20000
       or value ->> 'titleHe' !~ '[א-ת]'
       or value ->> 'summaryHe' !~ '[א-ת]'
       or value ->> 'decisionTextHe' !~ '[א-ת]'
       or jsonb_typeof(value -> 'tags') is distinct from 'array'
       or jsonb_array_length(value -> 'tags') > 12
       or exists (
         select 1 from jsonb_array_elements(value -> 'tags') tag(item)
         where jsonb_typeof(item) is distinct from 'string'
            or char_length(btrim(item #>> '{}')) not between 1 and 100
       )
       or value -> 'people' <> '[]'::jsonb
       or value ->> 'decisionCategory' not in (
         'scope_and_execution', 'commencement_and_completion',
         'stage_acceptance_and_handover', 'payment_and_commercial',
         'notice_and_communication', 'change_and_approval', 'bond_and_security',
         'warranty_and_defects', 'recurring_compliance',
         'delay_extension_and_consequence', 'termination_and_remedy',
         'document_and_information_obligation', 'other'
       )
       or value ->> 'conflictStatus' not in ('none', 'unresolved')
       or value ->> 'scheduleImpact' not in ('yes', 'no', 'unknown')
       or value ->> 'temporalKind' not in ('none', 'fixed', 'relative', 'recurring', 'extension', 'consequence')
       or value ->> 'calendarSemantics' not in ('explicit', 'unknown', 'not_applicable')
       or jsonb_typeof(value -> 'recurring') is distinct from 'boolean'
       or (value -> 'offsetValue' <> 'null'::jsonb and jsonb_typeof(value -> 'offsetValue') <> 'number')
       or (value -> 'offsetUnit' <> 'null'::jsonb and coalesce(value ->> 'offsetUnit', '') not in (
         'hours', 'calendar_days', 'working_days', 'weeks', 'months'
       ))
  ) or (
    select count(*) <> count(distinct value ->> 'proposalKey')
    from jsonb_array_elements(p_proposals) proposal(value)
  ) or (
    select count(*) <> count(distinct value ->> 'decisionKey')
    from jsonb_array_elements(p_proposals) proposal(value)
  ) then
    raise exception using errcode = '22023', message = 'An R4.2B decision proposal is invalid or duplicated';
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
    p_workspace_id::text || chr(31) || p_decision_policy_version,
    0
  ));

  if exists (
    with latest as (
      select distinct on (relationship.relationship_key) relationship.*
      from private.contract_relationships relationship
      where relationship.workspace_id = p_workspace_id
        and relationship.relationship_policy_version = 'contracts-relationships-semantic.r4.1.v2'
        and relationship.source_clause_id is not null
        and relationship.target_clause_id is not null
        and relationship.evidence #>> '{signals,schemaVersion}' = 'contracts-relationship-signals.r4.2a.v1'
      order by relationship.relationship_key, relationship.revision desc
    )
    select 1 from latest where review_status = 'proposed'
  ) then
    raise exception using errcode = '23514', message = 'Every R4.2A relationship proposal must be reviewed before R4.2B';
  end if;

  for v_proposal in
    select value
    from jsonb_array_elements(p_proposals) proposal(value)
    order by value ->> 'proposalKey'
  loop
    if (
      select count(*) <> count(distinct item #>> '{}')
      from jsonb_array_elements(v_proposal -> 'sourceClauseKeys') key(item)
    ) then
      raise exception using errcode = '22023', message = 'Decision source clause keys must be unique';
    end if;

    select count(*), jsonb_agg(jsonb_build_object(
      'clauseId', clause.id,
      'pageStart', clause.page_start,
      'pageEnd', clause.page_end,
      'rawTextSha256', clause.raw_text_sha256,
      'excerpt', left(clause.raw_text, 20000)
    ) order by source_key.ordinality)
    into v_clause_count, v_source_evidence
    from jsonb_array_elements_text(v_proposal -> 'sourceClauseKeys') with ordinality source_key(clause_key, ordinality)
    join private.contracts_documents clause
      on clause.workspace_id = v_workspace.id
     and clause.document_version_id = v_workspace.document_version_id
     and clause.parser_generation_id = v_workspace.parser_generation_id
     and clause.clause_key = source_key.clause_key;
    if v_clause_count <> jsonb_array_length(v_proposal -> 'sourceClauseKeys') then
      raise exception using errcode = '23503', message = 'A decision source clause was not found';
    end if;

    select * into v_primary_clause
    from private.contracts_documents clause
    where clause.workspace_id = v_workspace.id
      and clause.document_version_id = v_workspace.document_version_id
      and clause.parser_generation_id = v_workspace.parser_generation_id
      and clause.clause_key = v_proposal ->> 'primaryClauseKey';
    if not found or not (v_proposal -> 'sourceClauseKeys' @> jsonb_build_array(v_primary_clause.clause_key)) then
      raise exception using errcode = '23503', message = 'The primary decision clause is invalid';
    end if;

    select encode(pg_catalog.sha256(pg_catalog.convert_to(
      p_decision_policy_version || chr(31) || v_workspace.document_sha256 || chr(31)
      || string_agg(source_key.clause_key, chr(31) order by source_key.ordinality),
      'UTF8'
    )), 'hex')
    into v_expected_proposal_key
    from jsonb_array_elements_text(v_proposal -> 'sourceClauseKeys') with ordinality source_key(clause_key, ordinality);
    v_expected_decision_key := 'contract:' || left(v_workspace.document_sha256, 12)
      || ':clause:' || left(encode(pg_catalog.sha256(pg_catalog.convert_to(
        v_primary_clause.clause_key, 'UTF8'
      )), 'hex'), 16) || ':role:normalized';
    if v_proposal ->> 'proposalKey' <> v_expected_proposal_key
       or v_proposal ->> 'decisionKey' <> v_expected_decision_key then
      raise exception using errcode = '23514', message = 'The deterministic decision identity is invalid';
    end if;

    select * into v_existing
    from private.contracts decision
    where decision.workspace_id = v_workspace.id
      and decision.document_version_id = v_workspace.document_version_id
      and decision.parser_generation_id = v_workspace.parser_generation_id
      and decision.decision_key = v_expected_decision_key
    order by decision.revision desc
    limit 1;
    if found then
      if v_existing.decision_policy_version <> p_decision_policy_version then
        raise exception using errcode = '23505', message = 'The decision key belongs to another policy generation';
      end if;
      v_decision_id := v_existing.id;
      v_reused := v_reused + 1;
    else
      v_append_result := public.bidoc_contracts_append_decision_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_workspace.id,
          'sourceProjectId', v_workspace.source_project_id,
          'scheduleProjectId', null,
          'documentVersionId', v_workspace.document_version_id,
          'parserGenerationId', v_workspace.parser_generation_id,
          'decisionKey', v_expected_decision_key,
          'primaryClauseId', v_primary_clause.id,
          'sourceEvidence', v_source_evidence,
          'titleHe', btrim(v_proposal ->> 'titleHe'),
          'summaryHe', btrim(v_proposal ->> 'summaryHe'),
          'decisionTextHe', btrim(v_proposal ->> 'decisionTextHe'),
          'tags', v_proposal -> 'tags',
          'people', '[]'::jsonb,
          'responsibleParty', nullif(btrim(v_proposal ->> 'responsibleParty'), ''),
          'beneficiary', nullif(btrim(v_proposal ->> 'beneficiary'), ''),
          'decisionCategory', v_proposal ->> 'decisionCategory',
          'conflictStatus', v_proposal ->> 'conflictStatus',
          'scheduleImpact', v_proposal ->> 'scheduleImpact',
          'temporalKind', v_proposal ->> 'temporalKind',
          'contractDate', nullif(v_proposal ->> 'contractDate', ''),
          'triggerKind', nullif(btrim(v_proposal ->> 'triggerKind'), ''),
          'triggerDescriptionHe', nullif(btrim(v_proposal ->> 'triggerDescriptionHe'), ''),
          'offsetValue', case when v_proposal -> 'offsetValue' = 'null'::jsonb then null else v_proposal ->> 'offsetValue' end,
          'offsetUnit', nullif(v_proposal ->> 'offsetUnit', ''),
          'calendarSemantics', v_proposal ->> 'calendarSemantics',
          'recurring', (v_proposal ->> 'recurring')::boolean,
          'reviewStatus', 'proposed',
          'projectionStatus', case when v_proposal ->> 'scheduleImpact' = 'no' then 'not_applicable' else 'blocked' end,
          'modelVersion', p_model_version,
          'decisionPolicyVersion', p_decision_policy_version
        )
      );
      v_decision_id := (v_append_result ->> 'decisionId')::uuid;
      v_inserted := v_inserted + 1;
    end if;

    for v_source_item in select value from jsonb_array_elements(v_source_evidence) source(value)
    loop
      select * into v_source_clause
      from private.contracts_documents clause
      where clause.id = (v_source_item ->> 'clauseId')::uuid
        and clause.workspace_id = v_workspace.id;
      v_support_key := private.bidoc_contracts_relationship_key_r1(
        v_workspace.document_version_id,
        v_workspace.parser_generation_id,
        'supports_same_decision',
        v_source_clause.id,
        null,
        null,
        v_decision_id
      );
      select * into v_support_existing
      from private.contract_relationships relationship
      where relationship.workspace_id = v_workspace.id
        and relationship.relationship_policy_version = 'contracts-decision-support.r4.2b.v1'
        and relationship.relationship_key = v_support_key
      order by relationship.revision desc
      limit 1;
      if found then
        v_support_reused := v_support_reused + 1;
        continue;
      end if;
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_workspace.id,
          'documentVersionId', v_workspace.document_version_id,
          'parserGenerationId', v_workspace.parser_generation_id,
          'sourceClauseId', v_source_clause.id,
          'targetDecisionId', v_decision_id,
          'relationshipType', 'supports_same_decision',
          'origin', 'model',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', jsonb_build_array(v_source_item),
            'rationaleHe', 'הסעיף משמש ראיית מקור ישירה להצעת ההחלטה המנורמלת.',
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-support-signals.r4.2b.v1',
              'proposalKey', v_proposal ->> 'proposalKey',
              'promptVersion', 'contracts-decisions-normalization-prompt.r4.2b.v1',
              'source', 'r4.2b_normalized_decision_proposal'
            )
          ),
          'modelVersion', p_model_version,
          'relationshipPolicyVersion', 'contracts-decision-support.r4.2b.v1',
          'reviewStatus', 'proposed'
        )
      );
      v_support_inserted := v_support_inserted + 1;
    end loop;
  end loop;

  v_projection := public.bidoc_contracts_get_decision_review_r4_2b(
    p_workspace_id,
    p_decision_policy_version
  );
  return v_projection || jsonb_build_object(
    'persistence', jsonb_build_object(
      'inserted', v_inserted,
      'reused', v_reused,
      'supportInserted', v_support_inserted,
      'supportReused', v_support_reused,
      'atomic', true
    )
  );
end;
$$;

create or replace function public.bidoc_contracts_review_decision_r4_2b(
  p_workspace_id uuid,
  p_decision_id uuid,
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
  v_policy_version constant text := 'contracts-decisions-normalization.r4.2b.v1';
  v_support_policy constant text := 'contracts-decision-support.r4.2b.v1';
  v_current private.contracts%rowtype;
  v_latest private.contracts%rowtype;
  v_workspace private.contract_workspaces%rowtype;
  v_reviewed_at timestamptz := statement_timestamp();
  v_review_status text;
  v_projection_status text;
  v_append_result jsonb;
  v_new_decision_id uuid;
  v_support private.contract_relationships%rowtype;
  v_source_item jsonb;
  v_source_clause private.contracts_documents%rowtype;
  v_projection jsonb;
  v_support_superseded integer := 0;
  v_support_inserted integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null
     or p_decision_id is null
     or p_reviewer_id is null
     or p_expected_revision is null
     or p_expected_revision < 1
     or p_action not in ('approve', 'reject', 'correct', 'unresolved')
     or char_length(btrim(coalesce(p_reason_he, ''))) not between 10 and 1000
     or p_reason_he !~ '[א-ת]' then
    raise exception using errcode = '22023', message = 'The R4.2B review decision is invalid';
  end if;
  if p_action = 'correct' then
    if jsonb_typeof(p_correction) is distinct from 'object'
       or (p_correction - array[
         'titleHe', 'summaryHe', 'decisionTextHe', 'responsibleParty', 'beneficiary',
         'decisionCategory', 'conflictStatus', 'scheduleImpact', 'temporalKind',
         'contractDate', 'triggerKind', 'triggerDescriptionHe', 'offsetValue',
         'offsetUnit', 'calendarSemantics', 'recurring'
       ]::text[]) <> '{}'::jsonb
       or char_length(btrim(coalesce(p_correction ->> 'titleHe', ''))) not between 5 and 1000
       or char_length(btrim(coalesce(p_correction ->> 'summaryHe', ''))) not between 10 and 10000
       or char_length(btrim(coalesce(p_correction ->> 'decisionTextHe', ''))) not between 10 and 20000
       or p_correction ->> 'titleHe' !~ '[א-ת]'
       or p_correction ->> 'summaryHe' !~ '[א-ת]'
       or p_correction ->> 'decisionTextHe' !~ '[א-ת]'
       or p_correction ->> 'decisionCategory' not in (
         'scope_and_execution', 'commencement_and_completion',
         'stage_acceptance_and_handover', 'payment_and_commercial',
         'notice_and_communication', 'change_and_approval', 'bond_and_security',
         'warranty_and_defects', 'recurring_compliance',
         'delay_extension_and_consequence', 'termination_and_remedy',
         'document_and_information_obligation', 'other'
       )
       or p_correction ->> 'conflictStatus' not in ('none', 'detected', 'reviewed', 'unresolved')
       or p_correction ->> 'scheduleImpact' not in ('yes', 'no', 'unknown')
       or p_correction ->> 'temporalKind' not in ('none', 'fixed', 'relative', 'recurring', 'extension', 'consequence')
       or p_correction ->> 'calendarSemantics' not in ('explicit', 'reviewed', 'unknown', 'not_applicable')
       or jsonb_typeof(p_correction -> 'recurring') is distinct from 'boolean'
       or (p_correction -> 'offsetValue' <> 'null'::jsonb and jsonb_typeof(p_correction -> 'offsetValue') <> 'number')
       or (p_correction -> 'offsetUnit' <> 'null'::jsonb and coalesce(p_correction ->> 'offsetUnit', '') not in (
         'hours', 'calendar_days', 'working_days', 'weeks', 'months'
       )) then
      raise exception using errcode = '22023', message = 'The corrected R4.2B decision is invalid';
    end if;
  elsif p_correction is not null then
    raise exception using errcode = '22023', message = 'Only a correction action may include corrected decision fields';
  end if;

  select * into v_current
  from private.contracts decision
  where decision.id = p_decision_id
    and decision.workspace_id = p_workspace_id
    and decision.decision_policy_version = v_policy_version;
  if not found then
    raise exception using errcode = 'P0002', message = 'The R4.2B decision proposal was not found';
  end if;
  select * into v_workspace from private.contract_workspaces where id = p_workspace_id;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || chr(31) || v_policy_version || chr(31) || v_current.decision_key,
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
     or v_current.revision <> p_expected_revision
     or v_current.review_status <> 'proposed' then
    raise exception using
      errcode = '40001',
      message = 'Contract decision review revision is stale',
      detail = format('Expected proposal revision %s but the current revision is %s.', p_expected_revision, v_latest.revision);
  end if;

  v_review_status := case p_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'correct' then 'corrected'
    else 'unresolved'
  end;
  v_projection_status := case
    when coalesce(p_correction ->> 'scheduleImpact', v_current.schedule_impact) = 'no' then 'not_applicable'
    else 'blocked'
  end;
  v_append_result := public.bidoc_contracts_append_decision_r1(
    p_expected_revision,
    jsonb_build_object(
      'workspaceId', v_current.workspace_id,
      'sourceProjectId', v_current.source_project_id,
      'scheduleProjectId', null,
      'documentVersionId', v_current.document_version_id,
      'parserGenerationId', v_current.parser_generation_id,
      'decisionKey', v_current.decision_key,
      'primaryClauseId', v_current.primary_clause_id,
      'sourceEvidence', v_current.source_evidence,
      'titleHe', case when p_action = 'correct' then btrim(p_correction ->> 'titleHe') else v_current.title_he end,
      'summaryHe', case when p_action = 'correct' then btrim(p_correction ->> 'summaryHe') else v_current.summary_he end,
      'decisionTextHe', case when p_action = 'correct' then btrim(p_correction ->> 'decisionTextHe') else v_current.decision_text_he end,
      'tags', to_jsonb(v_current.tags),
      'people', v_current.people,
      'responsibleParty', case when p_action = 'correct' then nullif(btrim(p_correction ->> 'responsibleParty'), '') else v_current.responsible_party end,
      'beneficiary', case when p_action = 'correct' then nullif(btrim(p_correction ->> 'beneficiary'), '') else v_current.beneficiary end,
      'decisionCategory', case when p_action = 'correct' then p_correction ->> 'decisionCategory' else v_current.decision_category end,
      'conflictStatus', case when p_action = 'correct' then p_correction ->> 'conflictStatus' else v_current.conflict_status end,
      'scheduleImpact', case when p_action = 'correct' then p_correction ->> 'scheduleImpact' else v_current.schedule_impact end,
      'temporalKind', case when p_action = 'correct' then p_correction ->> 'temporalKind' else v_current.temporal_kind end,
      'contractDate', case when p_action = 'correct' then nullif(p_correction ->> 'contractDate', '') else v_current.contract_date::text end,
      'triggerKind', case when p_action = 'correct' then nullif(btrim(p_correction ->> 'triggerKind'), '') else v_current.trigger_kind end,
      'triggerDescriptionHe', case when p_action = 'correct' then nullif(btrim(p_correction ->> 'triggerDescriptionHe'), '') else v_current.trigger_description_he end,
      'offsetValue', case when p_action = 'correct' then case when p_correction -> 'offsetValue' = 'null'::jsonb then null else p_correction ->> 'offsetValue' end else v_current.offset_value::text end,
      'offsetUnit', case when p_action = 'correct' then nullif(p_correction ->> 'offsetUnit', '') else v_current.offset_unit end,
      'calendarSemantics', case when p_action = 'correct' then p_correction ->> 'calendarSemantics' else v_current.calendar_semantics end,
      'recurring', case when p_action = 'correct' then (p_correction ->> 'recurring')::boolean else v_current.recurring end,
      'reviewStatus', v_review_status,
      'reviewerId', p_reviewer_id,
      'reviewedAt', v_reviewed_at,
      'reviewReason', btrim(p_reason_he),
      'projectionStatus', v_projection_status,
      'modelVersion', case when p_action = 'correct' then 'not_applicable' else v_current.model_version end,
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
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he)
      )
    );
    v_support_superseded := v_support_superseded + 1;
  end loop;

  if p_action <> 'reject' then
    for v_source_item in select value from jsonb_array_elements(v_current.source_evidence) source(value)
    loop
      select * into v_source_clause
      from private.contracts_documents clause
      where clause.id = (v_source_item ->> 'clauseId')::uuid
        and clause.workspace_id = v_current.workspace_id;
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_current.workspace_id,
          'documentVersionId', v_current.document_version_id,
          'parserGenerationId', v_current.parser_generation_id,
          'sourceClauseId', v_source_clause.id,
          'targetDecisionId', v_new_decision_id,
          'relationshipType', 'supports_same_decision',
          'origin', 'human',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', jsonb_build_array(v_source_item),
            'rationaleHe', btrim(p_reason_he),
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-support-signals.r4.2b.v1',
              'reviewAction', p_action,
              'reviewedProposalDecisionId', v_current.id,
              'source', 'r4.2b_human_decision_review'
            )
          ),
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', v_support_policy,
          'reviewStatus', v_review_status,
          'reviewerId', p_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', btrim(p_reason_he)
        )
      );
      v_support_inserted := v_support_inserted + 1;
    end loop;
  end if;

  v_projection := public.bidoc_contracts_get_decision_review_r4_2b(
    p_workspace_id,
    v_policy_version
  );
  return v_projection || jsonb_build_object(
    'review', jsonb_build_object(
      'action', p_action,
      'reviewedProposalDecisionId', v_current.id,
      'reviewedDecisionId', v_new_decision_id,
      'reviewedAt', v_reviewed_at,
      'supportSuperseded', v_support_superseded,
      'supportInserted', v_support_inserted,
      'atomic', true
    )
  );
end;
$$;

revoke execute on function public.bidoc_contracts_decision_review_status_r4_2b()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_decision_review_r4_2b(uuid,text)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_persist_decisions_r4_2b(uuid,text,text,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_review_decision_r4_2b(uuid,uuid,integer,uuid,text,text,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_decision_review_status_r4_2b() to service_role;
grant execute on function public.bidoc_contracts_get_decision_review_r4_2b(uuid,text) to service_role;
grant execute on function public.bidoc_contracts_persist_decisions_r4_2b(uuid,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_review_decision_r4_2b(uuid,uuid,integer,uuid,text,text,jsonb) to service_role;
