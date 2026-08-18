-- Roll back only the Contracts Pipeline R3.2 persistence/read layer.
-- Refuse while R3.2 workspaces exist because removing the read contract would strand them.

do $$
begin
  if exists (
    select 1
    from private.contract_workspaces
    where workspace_version = 'contracts-workspace.r1.v1'
      and extraction_json ->> 'persistenceVersion' = 'contracts-clause-persistence.r3.2.v1'
  ) then
    raise exception using
      errcode = '55000',
      message = 'R3.2 rollback refused while saved clause workspaces exist';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_persist_clause_generation_r3_2(jsonb,jsonb,jsonb,uuid);
drop function if exists public.bidoc_contracts_list_clause_workspaces_r3_2(uuid,integer);
drop function if exists public.bidoc_contracts_get_clause_workspace_r3_2(uuid);
drop function if exists public.bidoc_contracts_find_clause_workspace_r3_2(uuid,text,text,text);
drop function if exists public.bidoc_contracts_clause_persistence_status_r3_2();
drop function if exists private.bidoc_contracts_clause_projection_r3_2(uuid);

-- Restore the pre-R3.2 classic saved-workspace list contract.
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
    order by last_opened_at desc, created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) workspace
  left join private.contract_review_drafts draft
    on draft.workspace_id = workspace.id
   and draft.reviewer_id = p_reviewer_id;
$$;

revoke execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer) to service_role;
