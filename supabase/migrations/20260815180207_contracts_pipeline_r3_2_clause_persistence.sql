-- BIDoc Contracts Pipeline R3.2: durable, idempotent clause-generation persistence.
-- No decision, relationship, Schedule, or browser role write path is introduced.

create or replace function private.bidoc_contracts_clause_projection_r3_2(p_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'persistenceVersion', 'contracts-clause-persistence.r3.2.v1',
    'workspace', jsonb_build_object(
      'workspaceId', workspace.id,
      'workspaceVersion', workspace.workspace_version,
      'sourceProjectId', workspace.source_project_id,
      'projectSite', workspace.project_site,
      'documentVersionId', workspace.document_version_id,
      'filename', workspace.filename,
      'createdAt', workspace.created_at,
      'lastOpenedAt', workspace.last_opened_at,
      'clauseCount', (select count(*) from private.contracts_documents c where c.workspace_id = workspace.id)
    ),
    'preview', jsonb_build_object(
      'previewVersion', coalesce(workspace.extraction_json ->> 'previewVersion', 'contracts-clause-preview.r3.1.v1'),
      'mode', 'persisted',
      'persisted', true,
      'document', jsonb_build_object(
        'filename', workspace.filename,
        'mediaType', workspace.media_type,
        'documentVersionId', workspace.document_version_id,
        'documentSha256', workspace.document_sha256,
        'pageCount', (workspace.extraction_json #>> '{coverageLedger,pageCount}')::integer
      ),
      'generations', jsonb_build_object(
        'parserGenerationId', workspace.parser_generation_id,
        'enrichmentGenerationId', workspace.extractor_version,
        'parserVersion', workspace.parser_version,
        'enrichmentPolicyVersion', workspace.extraction_json #>> '{enrichmentIdentity,enrichmentPolicyVersion}',
        'promptVersion', workspace.extraction_json #>> '{enrichmentIdentity,promptVersion}',
        'modelVersion', workspace.extraction_json #>> '{enrichmentIdentity,modelVersion}'
      ),
      'coverage', jsonb_build_object(
        'accepted', true,
        'sourceLineCount', (workspace.extraction_json #>> '{coverageLedger,sourceLineCount}')::integer,
        'accountedSourceLineCount', (workspace.extraction_json #>> '{coverageLedger,accountedSourceLineCount}')::integer,
        'numberedSourceCount', (workspace.extraction_json #>> '{coverageLedger,numberedSourceCount}')::integer,
        'storedLogicalCount', (workspace.extraction_json #>> '{coverageLedger,storedLogicalCount}')::integer,
        'clauseCount', (workspace.extraction_json #>> '{coverageLedger,clauseCount}')::integer,
        'subclauseCount', (workspace.extraction_json #>> '{coverageLedger,subclauseCount}')::integer,
        'appendixItemCount', (workspace.extraction_json #>> '{coverageLedger,appendixItemCount}')::integer,
        'contextCount', (workspace.extraction_json #>> '{coverageLedger,contextCount}')::integer,
        'crossPageCount', (workspace.extraction_json #>> '{coverageLedger,crossPageCount}')::integer,
        'missingPageCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,missingPages}', '[]'::jsonb)),
        'duplicateKeyCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,duplicateKeys}', '[]'::jsonb)),
        'missingParentCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,missingParents}', '[]'::jsonb)),
        'unparsedNumberedLineCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,unparsedNumberedLines}', '[]'::jsonb)),
        'unaccountedLineCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,unaccountedLines}', '[]'::jsonb)),
        'errorCount', jsonb_array_length(coalesce(workspace.extraction_json #> '{coverageLedger,errors}', '[]'::jsonb))
      ),
      'quality', coalesce(workspace.extraction_json -> 'enrichmentQualityLedger', '{}'::jsonb) || jsonb_build_object(
        'accepted', true,
        'typeCounts', coalesce((
          select jsonb_object_agg(types.clause_type, types.item_count)
          from (
            select c.clause_type, count(*) as item_count
            from private.contracts_documents c
            where c.workspace_id = workspace.id
            group by c.clause_type
          ) types
        ), '{}'::jsonb)
      ),
      'clauses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'clauseKey', clause.clause_key,
          'parentClauseKey', clause.parent_clause_key,
          'clauseType', clause.clause_type,
          'clauseTitle', clause.clause_title,
          'clauseOrder', clause.clause_order,
          'pageStart', clause.page_start,
          'pageEnd', clause.page_end,
          'rawText', clause.raw_text,
          'rawTextSha256', clause.raw_text_sha256,
          'summaryHe', clause.summary_he,
          'hashtags', to_jsonb(clause.hashtags),
          'crossReferences', coalesce((
            select jsonb_agg(reference || jsonb_build_object('origin', 'explicit_reference') order by ordinal)
            from jsonb_array_elements(clause.cross_references) with ordinality refs(reference, ordinal)
          ), '[]'::jsonb),
          'content', clause.content,
          'contentSha256', encode(pg_catalog.sha256(pg_catalog.convert_to(clause.content, 'UTF8')), 'hex'),
          'processingStatus', clause.processing_status
        ) order by clause.clause_order)
        from private.contracts_documents clause
        where clause.workspace_id = workspace.id
      ), '[]'::jsonb),
      'semanticDecisions', '[]'::jsonb,
      'canonicalRelationships', '[]'::jsonb
    )
  )
  from private.contract_workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.workspace_version = 'contracts-workspace.r1.v1'
    and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
    and exists (select 1 from private.contracts_documents c where c.workspace_id = workspace.id)
    and not exists (
      select 1 from private.contracts_documents c
      where c.workspace_id = workspace.id and c.processing_status <> 'processed'
    );
$$;

create or replace function public.bidoc_contracts_clause_persistence_status_r3_2()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'persistenceVersion', 'contracts-clause-persistence.r3.2.v1',
    'workspaceVersion', 'contracts-workspace.r1.v1',
    'clauseSchemaVersion', 'contracts-documents.r1.v1',
    'enrichmentVersion', 'contracts-clause-enrichment.r3.v1',
    'migrationVersion', '20260815180207'
  );
$$;

create or replace function public.bidoc_contracts_find_clause_workspace_r3_2(
  p_source_project_id uuid,
  p_document_sha256 text,
  p_parser_generation_id text,
  p_enrichment_generation_id text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bidoc_contracts_clause_projection_r3_2(workspace.id)
  from private.contract_workspaces workspace
  where workspace.workspace_version = 'contracts-workspace.r1.v1'
    and workspace.source_project_id = p_source_project_id
    and workspace.document_sha256 = lower(p_document_sha256)
    and workspace.parser_generation_id = lower(p_parser_generation_id)
    and workspace.extractor_version = lower(p_enrichment_generation_id)
    and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
  limit 1;
$$;

create or replace function public.bidoc_contracts_get_clause_workspace_r3_2(p_workspace_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.bidoc_contracts_clause_projection_r3_2(p_workspace_id);
$$;

create or replace function public.bidoc_contracts_list_clause_workspaces_r3_2(
  p_source_project_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'persistenceVersion', 'contracts-clause-persistence.r3.2.v1',
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'workspaceId', workspace.id,
      'documentVersionId', workspace.document_version_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site,
      'sourceProjectId', workspace.source_project_id,
      'clauseCount', workspace.clause_count,
      'pageCount', (workspace.extraction_json #>> '{coverageLedger,pageCount}')::integer,
      'parserGenerationId', workspace.parser_generation_id,
      'enrichmentGenerationId', workspace.extractor_version,
      'createdAt', workspace.created_at,
      'lastOpenedAt', workspace.last_opened_at
    ) order by workspace.last_opened_at desc, workspace.created_at desc), '[]'::jsonb)
  )
  from (
    select workspace.*, count(clause.id) as clause_count
    from private.contract_workspaces workspace
    join private.contracts_documents clause
      on clause.workspace_id = workspace.id
     and clause.processing_status = 'processed'
    where workspace.workspace_version = 'contracts-workspace.r1.v1'
      and workspace.source_project_id = p_source_project_id
      and workspace.extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
    group by workspace.id
    having count(*) = (select count(*) from private.contracts_documents all_clauses where all_clauses.workspace_id = workspace.id)
    order by workspace.last_opened_at desc, workspace.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) workspace;
$$;

create or replace function public.bidoc_contracts_persist_clause_generation_r3_2(
  p_workspace jsonb,
  p_clauses jsonb,
  p_enrichments jsonb,
  p_reviewer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_result jsonb;
  v_workspace_id uuid;
  v_clause jsonb;
  v_enrichment jsonb;
  v_clause_result jsonb;
  v_enrichment_result jsonb;
  v_clause_inserted integer := 0;
  v_clause_reused integer := 0;
  v_enrichment_inserted integer := 0;
  v_enrichment_reused integer := 0;
  v_projection jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_workspace) is distinct from 'object'
     or jsonb_typeof(p_clauses) is distinct from 'array'
     or jsonb_typeof(p_enrichments) is distinct from 'array'
     or jsonb_array_length(p_clauses) not between 1 and 500
     or jsonb_array_length(p_enrichments) <> jsonb_array_length(p_clauses)
     or (p_workspace ->> 'createdBy')::uuid is distinct from p_reviewer_id
     or p_workspace #>> '{extraction,persistenceVersion}' <> 'contracts-clause-persistence.r3.2.v1' then
    raise exception using errcode = '22023', message = 'R3.2 persistence payload is invalid';
  end if;

  v_workspace_result := public.bidoc_contracts_upsert_workspace_r1(p_workspace);
  v_workspace_id := (v_workspace_result ->> 'workspaceId')::uuid;

  for v_clause in select value from jsonb_array_elements(p_clauses)
  loop
    v_clause_result := public.bidoc_contracts_insert_clause_r1(
      v_clause || jsonb_build_object('workspaceId', v_workspace_id)
    );
    if (v_clause_result ->> 'inserted')::boolean then
      v_clause_inserted := v_clause_inserted + 1;
    else
      v_clause_reused := v_clause_reused + 1;
    end if;
  end loop;

  for v_enrichment in select value from jsonb_array_elements(p_enrichments)
  loop
    v_enrichment_result := public.bidoc_contracts_apply_clause_enrichment_r3(
      v_enrichment || jsonb_build_object('workspaceId', v_workspace_id, 'indexRef', null)
    );
    if (v_enrichment_result ->> 'inserted')::boolean then
      v_enrichment_inserted := v_enrichment_inserted + 1;
    else
      v_enrichment_reused := v_enrichment_reused + 1;
    end if;
  end loop;

  v_projection := private.bidoc_contracts_clause_projection_r3_2(v_workspace_id);
  if v_projection is null then
    raise exception using errcode = '23514', message = 'R3.2 persisted generation is incomplete';
  end if;
  return v_projection || jsonb_build_object('persistence', jsonb_build_object(
    'workspaceInserted', (v_workspace_result ->> 'inserted')::boolean,
    'workspaceReused', (v_workspace_result ->> 'reused')::boolean,
    'clausesInserted', v_clause_inserted,
    'clausesReused', v_clause_reused,
    'enrichmentsInserted', v_enrichment_inserted,
    'enrichmentsReused', v_enrichment_reused
  ));
end;
$$;

-- Keep the legacy classic-extraction list isolated from R1/R3 clause workspaces.
create or replace function public.bidoc_contracts_list_workspaces_v1(
  p_source_project_id uuid,
  p_reviewer_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workspaceVersion', 'contracts-workspace.phase3f1.v1',
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'workspaceId', workspace.id,
      'documentVersionId', workspace.document_version_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site,
      'sourceProjectId', workspace.source_project_id,
      'scheduleProjectId', workspace.schedule_project_id,
      'candidateCount', workspace.candidate_count,
      'createdAt', workspace.created_at,
      'lastOpenedAt', workspace.last_opened_at,
      'draft', case when draft.workspace_id is null then null else jsonb_build_object(
        'reviewedCount', draft.reviewed_count,
        'approvedCount', draft.approved_count,
        'rejectedCount', draft.rejected_count,
        'revision', draft.revision,
        'updatedAt', draft.updated_at
      ) end
    ) order by coalesce(draft.updated_at, workspace.last_opened_at) desc, workspace.created_at desc), '[]'::jsonb)
  )
  from (
    select *
    from private.contract_workspaces
    where source_project_id = p_source_project_id
      and workspace_version = 'contracts-workspace.phase3f1.v1'
    order by last_opened_at desc, created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) workspace
  left join private.contract_review_drafts draft
    on draft.workspace_id = workspace.id
   and draft.reviewer_id = p_reviewer_id;
$$;

revoke execute on function private.bidoc_contracts_clause_projection_r3_2(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.bidoc_contracts_clause_projection_r3_2(uuid) to service_role;

revoke execute on function public.bidoc_contracts_clause_persistence_status_r3_2()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_find_clause_workspace_r3_2(uuid,text,text,text)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_clause_workspace_r3_2(uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_list_clause_workspaces_r3_2(uuid,integer)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_persist_clause_generation_r3_2(jsonb,jsonb,jsonb,uuid)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_clause_persistence_status_r3_2() to service_role;
grant execute on function public.bidoc_contracts_find_clause_workspace_r3_2(uuid,text,text,text) to service_role;
grant execute on function public.bidoc_contracts_get_clause_workspace_r3_2(uuid) to service_role;
grant execute on function public.bidoc_contracts_list_clause_workspaces_r3_2(uuid,integer) to service_role;
grant execute on function public.bidoc_contracts_persist_clause_generation_r3_2(jsonb,jsonb,jsonb,uuid) to service_role;

revoke execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer) to service_role;
