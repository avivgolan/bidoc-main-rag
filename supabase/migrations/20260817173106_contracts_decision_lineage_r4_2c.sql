-- BIDoc Contracts Decisions Agent R4.2C
-- Adds audited split/merge mechanics and explicit decision-to-decision lineage.
-- This migration reuses the existing three-table Contracts boundary, preserves
-- append-only history, never selects a conflict winner, and performs no
-- Schedule reads or writes.

alter table private.contract_relationships
  drop constraint contract_relationships_relationship_type_check;

alter table private.contract_relationships
  add constraint contract_relationships_relationship_type_check
  check (relationship_type in (
    'cross_reference',
    'supports_same_decision',
    'depends_on',
    'condition_of',
    'exception_to',
    'amends',
    'duplicates',
    'conflicts_with',
    'split_into',
    'merged_into'
  )) not valid;

alter table private.contract_relationships
  validate constraint contract_relationships_relationship_type_check;

create or replace function public.bidoc_contracts_decision_lineage_status_r4_2c()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'agentVersion', 'contracts-decisions-lineage.r4.2c.v1',
    'decisionPolicyVersion', 'contracts-decisions-normalization.r4.2b.v1',
    'supportRelationshipPolicyVersion', 'contracts-decision-support.r4.2b.v1',
    'lineageRelationshipPolicyVersion', 'contracts-decision-lineage.r4.2c.v1',
    'migrationVersion', '20260817173106',
    'scope', 'audited_decision_split_merge_and_lineage',
    'splitEnabled', true,
    'mergeEnabled', true,
    'humanReviewRequired', true,
    'conflictWinnerSelectionEnabled', false,
    'modelCallsEnabled', false,
    'scheduleWritesEnabled', false
  );
$$;

create or replace function public.bidoc_contracts_get_decision_lineage_review_r4_2c(
  p_workspace_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select public.bidoc_contracts_get_decision_review_r4_2b(
      p_workspace_id,
      'contracts-decisions-normalization.r4.2b.v1'
    ) as projection
  ),
  latest_decisions as (
    select distinct on (decision.decision_key) decision.*
    from private.contracts decision
    where decision.workspace_id = p_workspace_id
      and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
    order by decision.decision_key, decision.revision desc
  ),
  latest_lineage as (
    select distinct on (relationship.relationship_key) relationship.*
    from private.contract_relationships relationship
    where relationship.workspace_id = p_workspace_id
      and relationship.relationship_policy_version = 'contracts-decision-lineage.r4.2c.v1'
      and relationship.relationship_type in ('split_into', 'merged_into')
      and relationship.source_decision_id is not null
      and relationship.target_decision_id is not null
    order by relationship.relationship_key, relationship.revision desc
  ),
  lineage_counts as (
    select
      decision.id,
      decision.review_status,
      count(lineage.id) filter (where lineage.review_status in ('approved', 'corrected')) as outgoing_count
    from latest_decisions decision
    left join latest_lineage lineage on lineage.source_decision_id = decision.id
    where decision.review_status in ('split', 'merged')
    group by decision.id, decision.review_status
  )
  select base.projection || jsonb_build_object(
    'lineage', jsonb_build_object(
      'agentVersion', 'contracts-decisions-lineage.r4.2c.v1',
      'decisionPolicyVersion', 'contracts-decisions-normalization.r4.2b.v1',
      'supportRelationshipPolicyVersion', 'contracts-decision-support.r4.2b.v1',
      'relationshipPolicyVersion', 'contracts-decision-lineage.r4.2c.v1',
      'migrationVersion', '20260817173106',
      'scope', 'audited_decision_split_merge_and_lineage',
      'metrics', jsonb_build_object(
        'activeDecisionCount', (
          select count(*) from latest_decisions
          where review_status in ('proposed', 'approved', 'corrected', 'unresolved')
        ),
        'splitParentCount', (
          select count(*) from latest_decisions where review_status = 'split'
        ),
        'mergedSourceCount', (
          select count(*) from latest_decisions where review_status = 'merged'
        ),
        'lineageLinkCount', (
          select count(*) from latest_lineage where review_status in ('approved', 'corrected')
        ),
        'incompleteLineageCount', (
          select count(*) from lineage_counts
          where (review_status = 'split' and outgoing_count < 2)
             or (review_status = 'merged' and outgoing_count < 1)
        ),
        'modelCallCount', 0,
        'scheduleWriteCount', 0
      ),
      'links', coalesce((
        select jsonb_agg(jsonb_build_object(
          'relationshipId', lineage.id,
          'relationshipKey', lineage.relationship_key,
          'revision', lineage.revision,
          'relationshipType', lineage.relationship_type,
          'sourceDecisionId', lineage.source_decision_id,
          'targetDecisionId', lineage.target_decision_id,
          'reviewStatus', lineage.review_status,
          'reviewerId', lineage.reviewer_id,
          'reviewedAt', lineage.reviewed_at,
          'reviewReason', lineage.review_reason,
          'evidence', lineage.evidence,
          'createdAt', lineage.created_at
        ) order by lineage.created_at, lineage.relationship_key)
        from latest_lineage lineage
      ), '[]'::jsonb),
      'gates', jsonb_build_object(
        'splitEnabled', true,
        'mergeEnabled', true,
        'humanReviewRequired', true,
        'conflictWinnerSelectionEnabled', false,
        'modelCallsEnabled', false,
        'scheduleWritesEnabled', false
      )
    )
  )
  from base
  where base.projection is not null;
$$;

create or replace function public.bidoc_contracts_review_decision_lineage_r4_2c(
  p_workspace_id uuid,
  p_reviewer_id uuid,
  p_action text,
  p_reason_he text,
  p_sources jsonb,
  p_outputs jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision_policy constant text := 'contracts-decisions-normalization.r4.2b.v1';
  v_support_policy constant text := 'contracts-decision-support.r4.2b.v1';
  v_lineage_policy constant text := 'contracts-decision-lineage.r4.2c.v1';
  v_workspace private.contract_workspaces%rowtype;
  v_source_item jsonb;
  v_output_item jsonb;
  v_current private.contracts%rowtype;
  v_latest private.contracts%rowtype;
  v_terminal private.contracts%rowtype;
  v_output_decision private.contracts%rowtype;
  v_source_decision_ids uuid[] := '{}'::uuid[];
  v_terminal_decision_ids uuid[] := '{}'::uuid[];
  v_output_decision_ids uuid[] := '{}'::uuid[];
  v_expected_clause_ids uuid[] := '{}'::uuid[];
  v_output_clause_ids uuid[] := '{}'::uuid[];
  v_part_clause_ids uuid[];
  v_distinct_output_clause_ids uuid[];
  v_primary_clause private.contracts_documents%rowtype;
  v_source_evidence jsonb;
  v_source_seed text;
  v_output_seed text;
  v_decision_key text;
  v_expected_revision integer;
  v_append_result jsonb;
  v_reviewed_at timestamptz := statement_timestamp();
  v_support private.contract_relationships%rowtype;
  v_evidence_item jsonb;
  v_terminal_status text;
  v_terminal_projection_status text;
  v_has_unresolved_conflict boolean := false;
  v_support_superseded integer := 0;
  v_terminal_support_inserted integer := 0;
  v_output_support_inserted integer := 0;
  v_lineage_inserted integer := 0;
  v_projection jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null
     or p_reviewer_id is null
     or p_action not in ('split', 'merge')
     or char_length(btrim(coalesce(p_reason_he, ''))) not between 10 and 1000
     or p_reason_he !~ '[א-ת]'
     or jsonb_typeof(p_sources) is distinct from 'array'
     or jsonb_typeof(p_outputs) is distinct from 'array'
     or (p_action = 'split' and (
       jsonb_array_length(p_sources) <> 1
       or jsonb_array_length(p_outputs) not between 2 and 10
     ))
     or (p_action = 'merge' and (
       jsonb_array_length(p_sources) not between 2 and 10
       or jsonb_array_length(p_outputs) <> 1
     )) then
    raise exception using errcode = '22023', message = 'The R4.2C split or merge envelope is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_sources) source(value)
    where jsonb_typeof(value) is distinct from 'object'
       or (value - array['decisionId', 'expectedRevision']::text[]) <> '{}'::jsonb
       or coalesce(value ->> 'decisionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(value ->> 'expectedRevision', '') !~ '^[1-9][0-9]*$'
  ) or (
    select count(*) <> count(distinct value ->> 'decisionId')
    from jsonb_array_elements(p_sources) source(value)
  ) then
    raise exception using errcode = '22023', message = 'An R4.2C source decision is invalid or duplicated';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_outputs) output(value)
    where jsonb_typeof(value) is distinct from 'object'
       or pg_column_size(value) > 131072
       or (value - array[
         'primaryClauseId', 'sourceClauseIds', 'titleHe', 'summaryHe',
         'decisionTextHe', 'tags', 'responsibleParty', 'beneficiary',
         'decisionCategory', 'conflictStatus', 'scheduleImpact', 'temporalKind',
         'contractDate', 'triggerKind', 'triggerDescriptionHe', 'offsetValue',
         'offsetUnit', 'calendarSemantics', 'recurring'
       ]::text[]) <> '{}'::jsonb
       or coalesce(value ->> 'primaryClauseId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(value -> 'sourceClauseIds') is distinct from 'array'
       or jsonb_array_length(value -> 'sourceClauseIds') not between 1 and 100
       or exists (
         select 1 from jsonb_array_elements(value -> 'sourceClauseIds') clause(item)
         where jsonb_typeof(item) is distinct from 'string'
            or (item #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       )
       or (
         select count(*) <> count(distinct item #>> '{}')
         from jsonb_array_elements(value -> 'sourceClauseIds') clause(item)
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
            or item #>> '{}' !~ '[א-ת]'
       )
       or char_length(coalesce(value ->> 'responsibleParty', '')) > 300
       or char_length(coalesce(value ->> 'beneficiary', '')) > 300
       or coalesce(value ->> 'decisionCategory', '') not in (
         'scope_and_execution', 'commencement_and_completion',
         'stage_acceptance_and_handover', 'payment_and_commercial',
         'notice_and_communication', 'change_and_approval', 'bond_and_security',
         'warranty_and_defects', 'recurring_compliance',
         'delay_extension_and_consequence', 'termination_and_remedy',
         'document_and_information_obligation', 'other'
       )
       or coalesce(value ->> 'conflictStatus', '') not in ('none', 'detected', 'reviewed', 'unresolved')
       or coalesce(value ->> 'scheduleImpact', '') not in ('yes', 'no', 'unknown')
       or coalesce(value ->> 'temporalKind', '') not in ('none', 'fixed', 'relative', 'recurring', 'extension', 'consequence')
       or coalesce(value ->> 'calendarSemantics', '') not in ('explicit', 'reviewed', 'unknown', 'not_applicable')
       or jsonb_typeof(value -> 'recurring') is distinct from 'boolean'
       or (value -> 'offsetValue' <> 'null'::jsonb and jsonb_typeof(value -> 'offsetValue') <> 'number')
       or (value -> 'offsetUnit' <> 'null'::jsonb and coalesce(value ->> 'offsetUnit', '') not in (
         'hours', 'calendar_days', 'working_days', 'weeks', 'months'
       ))
       or (value ->> 'temporalKind' = 'fixed' and coalesce(value ->> 'contractDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
       or (value ->> 'temporalKind' in ('relative', 'recurring') and (
         char_length(btrim(coalesce(value ->> 'triggerDescriptionHe', ''))) < 1
         or value ->> 'triggerDescriptionHe' !~ '[א-ת]'
         or value -> 'offsetValue' = 'null'::jsonb
         or case
           when jsonb_typeof(value -> 'offsetValue') = 'number'
           then (value ->> 'offsetValue')::numeric < 0
           else true
         end
         or value -> 'offsetUnit' = 'null'::jsonb
       ))
  ) then
    raise exception using errcode = '22023', message = 'An R4.2C output decision is invalid';
  end if;

  select * into v_workspace
  from private.contract_workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.workspace_version = 'contracts-workspace.r1.v1'
    and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1';
  if not found then
    raise exception using errcode = 'P0002', message = 'The saved R3.2 clause workspace was not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || chr(31) || v_decision_policy || chr(31) || v_lineage_policy,
    0
  ));

  for v_source_item in
    select value
    from jsonb_array_elements(p_sources) source(value)
    order by value ->> 'decisionId'
  loop
    select * into v_current
    from private.contracts decision
    where decision.id = (v_source_item ->> 'decisionId')::uuid
      and decision.workspace_id = p_workspace_id
      and decision.document_version_id = v_workspace.document_version_id
      and decision.parser_generation_id = v_workspace.parser_generation_id
      and decision.decision_policy_version = v_decision_policy;
    if not found then
      raise exception using errcode = 'P0002', message = 'An R4.2C source decision was not found';
    end if;

    select * into v_latest
    from private.contracts decision
    where decision.workspace_id = v_current.workspace_id
      and decision.document_version_id = v_current.document_version_id
      and decision.parser_generation_id = v_current.parser_generation_id
      and decision.decision_key = v_current.decision_key
    order by decision.revision desc
    limit 1;
    v_expected_revision := (v_source_item ->> 'expectedRevision')::integer;
    if v_latest.id <> v_current.id
       or v_current.revision <> v_expected_revision
       or v_current.review_status in ('rejected', 'split', 'merged', 'superseded')
       or v_current.projection_status = 'projected' then
      raise exception using
        errcode = '40001',
        message = 'Contract decision lineage revision is stale',
        detail = format('Expected decision revision %s but the current revision is %s.', v_expected_revision, v_latest.revision);
    end if;
    v_source_decision_ids := array_append(v_source_decision_ids, v_current.id);
    v_has_unresolved_conflict := v_has_unresolved_conflict or v_current.conflict_status = 'unresolved';
  end loop;

  select string_agg(decision.decision_key, chr(31) order by decision.decision_key)
  into v_source_seed
  from private.contracts decision
  where decision.id = any(v_source_decision_ids);

  select coalesce(array_agg(distinct (evidence.item ->> 'clauseId')::uuid order by (evidence.item ->> 'clauseId')::uuid), '{}'::uuid[])
  into v_expected_clause_ids
  from private.contracts decision
  cross join lateral jsonb_array_elements(decision.source_evidence) evidence(item)
  where decision.id = any(v_source_decision_ids);
  if cardinality(v_expected_clause_ids) < 1 then
    raise exception using errcode = '23514', message = 'R4.2C source evidence is empty';
  end if;

  for v_output_item in select value from jsonb_array_elements(p_outputs) output(value)
  loop
    select array_agg((item #>> '{}')::uuid order by (item #>> '{}')::uuid)
    into v_part_clause_ids
    from jsonb_array_elements(v_output_item -> 'sourceClauseIds') clause(item);
    if not (v_part_clause_ids <@ v_expected_clause_ids)
       or not ((v_output_item ->> 'primaryClauseId')::uuid = any(v_part_clause_ids)) then
      raise exception using errcode = '23514', message = 'R4.2C output evidence is not an exact source subset';
    end if;
    if v_has_unresolved_conflict and v_output_item ->> 'conflictStatus' <> 'unresolved' then
      raise exception using errcode = '23514', message = 'R4.2C cannot choose a winner for an unresolved conflict';
    end if;
    v_output_clause_ids := v_output_clause_ids || v_part_clause_ids;
  end loop;

  select coalesce(array_agg(distinct clause_id order by clause_id), '{}'::uuid[])
  into v_distinct_output_clause_ids
  from unnest(v_output_clause_ids) clause_id;
  if v_distinct_output_clause_ids <> v_expected_clause_ids then
    raise exception using errcode = '23514', message = 'R4.2C output evidence must cover every source clause exactly as a union';
  end if;

  v_terminal_status := case p_action when 'split' then 'split' else 'merged' end;
  for v_current in
    select decision.*
    from private.contracts decision
    where decision.id = any(v_source_decision_ids)
    order by decision.decision_key
  loop
    v_terminal_projection_status := case
      when v_current.schedule_impact = 'no' then 'not_applicable'
      else 'superseded'
    end;
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
        'contractDate', v_current.contract_date,
        'triggerKind', v_current.trigger_kind,
        'triggerDescriptionHe', v_current.trigger_description_he,
        'offsetValue', v_current.offset_value,
        'offsetUnit', v_current.offset_unit,
        'calendarSemantics', v_current.calendar_semantics,
        'recurring', v_current.recurring,
        'reviewStatus', v_terminal_status,
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he),
        'projectionStatus', v_terminal_projection_status,
        'modelVersion', v_current.model_version,
        'decisionPolicyVersion', v_decision_policy
      )
    );
    select * into v_terminal
    from private.contracts decision
    where decision.id = (v_append_result ->> 'decisionId')::uuid;
    v_terminal_decision_ids := array_append(v_terminal_decision_ids, v_terminal.id);

    for v_support in
      select latest.*
      from (
        select distinct on (relationship.relationship_key) relationship.*
        from private.contract_relationships relationship
        where relationship.workspace_id = p_workspace_id
          and relationship.relationship_policy_version = v_support_policy
          and relationship.target_decision_id = v_current.id
        order by relationship.relationship_key, relationship.revision desc
      ) latest
      where latest.review_status not in ('rejected', 'superseded')
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

    for v_evidence_item in select value from jsonb_array_elements(v_terminal.source_evidence) evidence(value)
    loop
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_terminal.workspace_id,
          'documentVersionId', v_terminal.document_version_id,
          'parserGenerationId', v_terminal.parser_generation_id,
          'sourceClauseId', v_evidence_item ->> 'clauseId',
          'targetDecisionId', v_terminal.id,
          'relationshipType', 'supports_same_decision',
          'origin', 'human',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', jsonb_build_array(v_evidence_item),
            'rationaleHe', btrim(p_reason_he),
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-support-signals.r4.2c.v1',
              'reviewAction', p_action,
              'terminalDecisionId', v_terminal.id,
              'source', 'r4.2c_human_decision_lineage'
            )
          ),
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', v_support_policy,
          'reviewStatus', 'superseded',
          'reviewerId', p_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', btrim(p_reason_he)
        )
      );
      v_terminal_support_inserted := v_terminal_support_inserted + 1;
    end loop;
  end loop;

  for v_output_item in
    select value
    from jsonb_array_elements(p_outputs) output(value)
  loop
    select array_agg((item #>> '{}')::uuid order by (item #>> '{}')::uuid)
    into v_part_clause_ids
    from jsonb_array_elements(v_output_item -> 'sourceClauseIds') clause(item);
    select string_agg(clause_id::text, chr(31) order by clause_id)
    into v_output_seed
    from unnest(v_part_clause_ids) clause_id;
    v_decision_key := 'contract:' || left(v_workspace.document_sha256, 12)
      || ':' || p_action || ':' || left(encode(pg_catalog.sha256(pg_catalog.convert_to(
        v_source_seed || chr(31) || v_output_seed || chr(31)
        || case when p_action = 'split'
          then btrim(v_output_item ->> 'titleHe') || chr(31) || btrim(v_output_item ->> 'decisionTextHe')
          else 'merged'
        end,
        'UTF8'
      )), 'hex'), 20) || ':role:normalized';

    select * into v_primary_clause
    from private.contracts_documents clause
    where clause.id = (v_output_item ->> 'primaryClauseId')::uuid
      and clause.workspace_id = p_workspace_id
      and clause.document_version_id = v_workspace.document_version_id
      and clause.parser_generation_id = v_workspace.parser_generation_id;
    if not found then
      raise exception using errcode = '23503', message = 'The R4.2C output primary clause was not found';
    end if;
    select jsonb_agg(jsonb_build_object(
      'clauseId', clause.id,
      'pageStart', clause.page_start,
      'pageEnd', clause.page_end,
      'rawTextSha256', clause.raw_text_sha256,
      'excerpt', left(clause.raw_text, 20000)
    ) order by clause.clause_order)
    into v_source_evidence
    from private.contracts_documents clause
    where clause.id = any(v_part_clause_ids)
      and clause.workspace_id = p_workspace_id
      and clause.document_version_id = v_workspace.document_version_id
      and clause.parser_generation_id = v_workspace.parser_generation_id;
    if jsonb_array_length(v_source_evidence) <> cardinality(v_part_clause_ids) then
      raise exception using errcode = '23503', message = 'An R4.2C output source clause was not found';
    end if;

    v_append_result := public.bidoc_contracts_append_decision_r1(
      0,
      jsonb_build_object(
        'workspaceId', p_workspace_id,
        'sourceProjectId', v_workspace.source_project_id,
        'scheduleProjectId', null,
        'documentVersionId', v_workspace.document_version_id,
        'parserGenerationId', v_workspace.parser_generation_id,
        'decisionKey', v_decision_key,
        'primaryClauseId', v_primary_clause.id,
        'sourceEvidence', v_source_evidence,
        'titleHe', btrim(v_output_item ->> 'titleHe'),
        'summaryHe', btrim(v_output_item ->> 'summaryHe'),
        'decisionTextHe', btrim(v_output_item ->> 'decisionTextHe'),
        'tags', v_output_item -> 'tags',
        'people', '[]'::jsonb,
        'responsibleParty', nullif(btrim(v_output_item ->> 'responsibleParty'), ''),
        'beneficiary', nullif(btrim(v_output_item ->> 'beneficiary'), ''),
        'decisionCategory', v_output_item ->> 'decisionCategory',
        'conflictStatus', v_output_item ->> 'conflictStatus',
        'scheduleImpact', v_output_item ->> 'scheduleImpact',
        'temporalKind', v_output_item ->> 'temporalKind',
        'contractDate', nullif(v_output_item ->> 'contractDate', ''),
        'triggerKind', nullif(btrim(v_output_item ->> 'triggerKind'), ''),
        'triggerDescriptionHe', nullif(btrim(v_output_item ->> 'triggerDescriptionHe'), ''),
        'offsetValue', case when v_output_item -> 'offsetValue' = 'null'::jsonb then null else v_output_item ->> 'offsetValue' end,
        'offsetUnit', nullif(v_output_item ->> 'offsetUnit', ''),
        'calendarSemantics', v_output_item ->> 'calendarSemantics',
        'recurring', (v_output_item ->> 'recurring')::boolean,
        'reviewStatus', 'corrected',
        'reviewerId', p_reviewer_id,
        'reviewedAt', v_reviewed_at,
        'reviewReason', btrim(p_reason_he),
        'projectionStatus', case when v_output_item ->> 'scheduleImpact' = 'no' then 'not_applicable' else 'blocked' end,
        'modelVersion', 'not_applicable',
        'decisionPolicyVersion', v_decision_policy
      )
    );
    select * into v_output_decision
    from private.contracts decision
    where decision.id = (v_append_result ->> 'decisionId')::uuid;
    v_output_decision_ids := array_append(v_output_decision_ids, v_output_decision.id);

    for v_evidence_item in select value from jsonb_array_elements(v_output_decision.source_evidence) evidence(value)
    loop
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_output_decision.workspace_id,
          'documentVersionId', v_output_decision.document_version_id,
          'parserGenerationId', v_output_decision.parser_generation_id,
          'sourceClauseId', v_evidence_item ->> 'clauseId',
          'targetDecisionId', v_output_decision.id,
          'relationshipType', 'supports_same_decision',
          'origin', 'human',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', jsonb_build_array(v_evidence_item),
            'rationaleHe', btrim(p_reason_he),
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-support-signals.r4.2c.v1',
              'reviewAction', p_action,
              'outputDecisionId', v_output_decision.id,
              'source', 'r4.2c_human_decision_lineage'
            )
          ),
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', v_support_policy,
          'reviewStatus', 'corrected',
          'reviewerId', p_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', btrim(p_reason_he)
        )
      );
      v_output_support_inserted := v_output_support_inserted + 1;
    end loop;
  end loop;

  for v_terminal in
    select decision.* from private.contracts decision
    where decision.id = any(v_terminal_decision_ids)
    order by decision.decision_key
  loop
    for v_output_decision in
      select decision.* from private.contracts decision
      where decision.id = any(v_output_decision_ids)
        and (p_action = 'split' or cardinality(v_output_decision_ids) = 1)
      order by decision.decision_key
    loop
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', p_workspace_id,
          'documentVersionId', v_workspace.document_version_id,
          'parserGenerationId', v_workspace.parser_generation_id,
          'sourceDecisionId', v_terminal.id,
          'targetDecisionId', v_output_decision.id,
          'relationshipType', case when p_action = 'split' then 'split_into' else 'merged_into' end,
          'origin', 'human',
          'confidence', null,
          'evidence', jsonb_build_object(
            'excerpts', case when p_action = 'split' then v_output_decision.source_evidence else v_terminal.source_evidence end,
            'rationaleHe', btrim(p_reason_he),
            'signals', jsonb_build_object(
              'schemaVersion', 'contracts-decision-lineage-signals.r4.2c.v1',
              'reviewAction', p_action,
              'sourceDecisionId', v_terminal.id,
              'sourceDecisionKey', v_terminal.decision_key,
              'targetDecisionId', v_output_decision.id,
              'targetDecisionKey', v_output_decision.decision_key,
              'source', 'r4.2c_human_decision_lineage'
            )
          ),
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', v_lineage_policy,
          'reviewStatus', 'approved',
          'reviewerId', p_reviewer_id,
          'reviewedAt', v_reviewed_at,
          'reviewReason', btrim(p_reason_he)
        )
      );
      v_lineage_inserted := v_lineage_inserted + 1;
    end loop;
  end loop;

  v_projection := public.bidoc_contracts_get_decision_lineage_review_r4_2c(p_workspace_id);
  return v_projection || jsonb_build_object(
    'lineageMutation', jsonb_build_object(
      'action', p_action,
      'sourceDecisionIds', to_jsonb(v_source_decision_ids),
      'terminalDecisionIds', to_jsonb(v_terminal_decision_ids),
      'outputDecisionIds', to_jsonb(v_output_decision_ids),
      'reviewedAt', v_reviewed_at,
      'supportSuperseded', v_support_superseded,
      'terminalSupportInserted', v_terminal_support_inserted,
      'outputSupportInserted', v_output_support_inserted,
      'lineageInserted', v_lineage_inserted,
      'atomic', true,
      'modelCallCount', 0,
      'scheduleWriteCount', 0
    )
  );
end;
$$;

revoke execute on function public.bidoc_contracts_decision_lineage_status_r4_2c()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_decision_lineage_review_r4_2c(uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_review_decision_lineage_r4_2c(uuid,uuid,text,text,jsonb,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_decision_lineage_status_r4_2c() to service_role;
grant execute on function public.bidoc_contracts_get_decision_lineage_review_r4_2c(uuid) to service_role;
grant execute on function public.bidoc_contracts_review_decision_lineage_r4_2c(uuid,uuid,text,text,jsonb,jsonb) to service_role;
