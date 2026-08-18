-- BIDoc Contracts Relationships Agent R4.0
-- Bounded foundation: canonical clause-to-clause relationships for explicit
-- references already extracted by R3. No model calls, decisions, conflict
-- winners, date arithmetic, or Schedule writes occur in this migration.

create or replace function public.bidoc_contracts_relationships_status_r4_0()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'agentVersion', 'contracts-relationships-agent.r4.0.v1',
    'relationshipPolicyVersion', 'contracts-relationships-explicit-reference.r4.0.v1',
    'migrationVersion', '20260815182148',
    'scope', 'explicit_references_only',
    'modelGroupingEnabled', false,
    'decisionCreationEnabled', false,
    'conflictResolutionEnabled', false,
    'scheduleWritesEnabled', false
  );
$$;

create or replace function public.bidoc_contracts_get_relationships_r4_0(
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
      and p_relationship_policy_version = 'contracts-relationships-explicit-reference.r4.0.v1'
  ),
  observations as (
    select
      source.id as source_clause_id,
      source.clause_key as source_clause_key,
      source.clause_order as source_clause_order,
      observation.ordinal,
      observation.value,
      target.id as target_clause_id,
      target.clause_key as target_clause_key
    from workspace
    join private.contracts_documents source on source.workspace_id = workspace.id
    cross join lateral jsonb_array_elements(source.cross_references)
      with ordinality as observation(value, ordinal)
    left join private.contracts_documents target
      on target.workspace_id = source.workspace_id
     and target.document_version_id = source.document_version_id
     and target.parser_generation_id = source.parser_generation_id
     and target.clause_key = observation.value ->> 'targetClauseKey'
  ),
  latest as (
    select distinct on (relationship.relationship_key) relationship.*
    from private.contract_relationships relationship
    join workspace on workspace.id = relationship.workspace_id
    where relationship.relationship_policy_version = p_relationship_policy_version
      and relationship.relationship_type = 'cross_reference'
      and relationship.origin = 'explicit_reference'
    order by relationship.relationship_key, relationship.revision desc
  )
  select jsonb_build_object(
    'agentVersion', 'contracts-relationships-agent.r4.0.v1',
    'relationshipPolicyVersion', p_relationship_policy_version,
    'migrationVersion', '20260815182148',
    'scope', 'explicit_references_only',
    'workspace', jsonb_build_object(
      'workspaceId', workspace.id,
      'sourceProjectId', workspace.source_project_id,
      'documentVersionId', workspace.document_version_id,
      'parserGenerationId', workspace.parser_generation_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site
    ),
    'metrics', jsonb_build_object(
      'explicitReferenceCount', (select count(*) from observations),
      'explicitRelationshipCount', (select count(*) from latest),
      'unresolvedReferenceCount', (
        select count(*)
        from observations
        where value ->> 'resolution' <> 'resolved'
           or target_clause_id is null
           or target_clause_id = source_clause_id
      ),
      'modelRelationshipCount', 0,
      'decisionCount', 0,
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
        'createdAt', relationship.created_at
      ) order by source.clause_order, target.clause_order, relationship.relationship_key)
      from latest relationship
      join private.contracts_documents source on source.id = relationship.source_clause_id
      join private.contracts_documents target on target.id = relationship.target_clause_id
    ), '[]'::jsonb),
    'unresolvedReferences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceClauseKey', source_clause_key,
        'targetClauseKey', value ->> 'targetClauseKey',
        'referenceText', value ->> 'referenceText',
        'referenceKind', value ->> 'referenceKind',
        'reason', case
          when target_clause_id = source_clause_id then 'self_reference'
          else 'target_missing'
        end
      ) order by source_clause_order, ordinal)
      from observations
      where value ->> 'resolution' <> 'resolved'
         or target_clause_id is null
         or target_clause_id = source_clause_id
    ), '[]'::jsonb),
    'gates', jsonb_build_object(
      'modelGroupingEnabled', false,
      'decisionCreationEnabled', false,
      'conflictResolutionEnabled', false,
      'scheduleWritesEnabled', false
    )
  )
  from workspace;
$$;

create or replace function public.bidoc_contracts_persist_explicit_relationships_r4_0(
  p_workspace_id uuid,
  p_relationship_policy_version text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_candidate record;
  v_append_result jsonb;
  v_projection jsonb;
  v_inserted integer := 0;
  v_reused integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_relationship_policy_version is distinct from 'contracts-relationships-explicit-reference.r4.0.v1' then
    raise exception using errcode = '22023', message = 'The R4.0 relationship policy version is invalid';
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

  for v_candidate in
    with distinct_observations as (
      select distinct
        source.id as source_clause_id,
        source.clause_key as source_clause_key,
        source.page_start as source_page_start,
        source.page_end as source_page_end,
        source.raw_text as source_raw_text,
        source.raw_text_sha256 as source_raw_text_sha256,
        target.id as target_clause_id,
        target.clause_key as target_clause_key,
        target.page_start as target_page_start,
        target.page_end as target_page_end,
        target.raw_text as target_raw_text,
        target.raw_text_sha256 as target_raw_text_sha256,
        observation.value ->> 'referenceText' as reference_text,
        observation.value ->> 'referenceKind' as reference_kind
      from private.contracts_documents source
      cross join lateral jsonb_array_elements(source.cross_references) observation(value)
      join private.contracts_documents target
        on target.workspace_id = source.workspace_id
       and target.document_version_id = source.document_version_id
       and target.parser_generation_id = source.parser_generation_id
       and target.clause_key = observation.value ->> 'targetClauseKey'
      where source.workspace_id = p_workspace_id
        and observation.value ->> 'resolution' = 'resolved'
        and target.id <> source.id
    )
    select
      source_clause_id,
      source_clause_key,
      source_page_start,
      source_page_end,
      source_raw_text,
      source_raw_text_sha256,
      target_clause_id,
      target_clause_key,
      target_page_start,
      target_page_end,
      target_raw_text,
      target_raw_text_sha256,
      jsonb_agg(jsonb_build_object(
        'referenceText', reference_text,
        'referenceKind', reference_kind
      ) order by reference_text, reference_kind) as observations
    from distinct_observations
    group by
      source_clause_id, source_clause_key, source_page_start, source_page_end,
      source_raw_text, source_raw_text_sha256,
      target_clause_id, target_clause_key, target_page_start, target_page_end,
      target_raw_text, target_raw_text_sha256
    order by source_clause_key, target_clause_key
  loop
    v_append_result := public.bidoc_contracts_append_relationship_r1(
      0,
      jsonb_build_object(
        'workspaceId', v_workspace.id,
        'documentVersionId', v_workspace.document_version_id,
        'parserGenerationId', v_workspace.parser_generation_id,
        'sourceClauseId', v_candidate.source_clause_id,
        'targetClauseId', v_candidate.target_clause_id,
        'relationshipType', 'cross_reference',
        'origin', 'explicit_reference',
        'confidence', null,
        'evidence', jsonb_build_object(
          'excerpts', jsonb_build_array(
            jsonb_build_object(
              'clauseId', v_candidate.source_clause_id,
              'pageStart', v_candidate.source_page_start,
              'pageEnd', v_candidate.source_page_end,
              'rawTextSha256', v_candidate.source_raw_text_sha256,
              'excerpt', left(v_candidate.source_raw_text, 20000)
            ),
            jsonb_build_object(
              'clauseId', v_candidate.target_clause_id,
              'pageStart', v_candidate.target_page_start,
              'pageEnd', v_candidate.target_page_end,
              'rawTextSha256', v_candidate.target_raw_text_sha256,
              'excerpt', left(v_candidate.target_raw_text, 20000)
            )
          ),
          'rationaleHe', format(
            'בסעיף %s נמצאה הפניה מפורשת אל סעיף %s. הקשר מתעד את ההפניה בלבד ואינו מוכיח ששני הסעיפים שייכים לאותה החלטה.',
            v_candidate.source_clause_key,
            v_candidate.target_clause_key
          ),
          'signals', jsonb_build_object(
            'schemaVersion', 'contracts-relationship-signals.r4.0.v1',
            'rule', 'resolved_explicit_cross_reference',
            'observations', v_candidate.observations,
            'semanticConclusion', false
          )
        ),
        'modelVersion', 'not_applicable',
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

  v_projection := public.bidoc_contracts_get_relationships_r4_0(
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

revoke execute on function public.bidoc_contracts_relationships_status_r4_0()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_relationships_r4_0(uuid,text)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_persist_explicit_relationships_r4_0(uuid,text)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_relationships_status_r4_0() to service_role;
grant execute on function public.bidoc_contracts_get_relationships_r4_0(uuid,text) to service_role;
grant execute on function public.bidoc_contracts_persist_explicit_relationships_r4_0(uuid,text) to service_role;
