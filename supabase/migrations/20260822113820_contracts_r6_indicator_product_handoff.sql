begin;

do $prerequisites$
begin
  if to_regclass('private.contracts_product_r6_v1') is null
     or to_regclass('private.contract_workspaces') is null then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A product projection is required before the Indicator product handoff';
  end if;
end
$prerequisites$;

create or replace function public.bidoc_contracts_r6_indicator_product_handoff_source_v1(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'A Contracts workspace ID is required';
  end if;

  with workspace as (
    select item.*
    from private.contract_workspaces item
    where item.id = p_workspace_id
      and item.workspace_version = 'contracts-workspace.r1.v1'
  ),
  product_decisions as (
    select decision.*
    from private.contracts_product_r6_v1 decision
    join workspace
      on workspace.source_project_id = decision.project_id
    where decision.metadata ->> 'workspaceId' = p_workspace_id::text
  )
  select jsonb_build_object(
    'schemaVersion', 'contracts-indicator-product-source.r6.v1',
    'migrationVersion', '20260822113820',
    'sourceView', 'private.contracts_product_r6_v1',
    'workspace', jsonb_build_object(
      'workspaceId', workspace.id,
      'projectId', workspace.source_project_id,
      'documentVersionId', workspace.document_version_id,
      'parserGenerationId', workspace.parser_generation_id,
      'documentName', workspace.filename
    ),
    'metrics', jsonb_build_object(
      'productDecisionCount', (select count(*) from product_decisions),
      'embeddingReadyCount', (
        select count(*) from product_decisions
        where embedding is not null and public.vector_dims(embedding) = 3072
      ),
      'modelCallCount', 0,
      'contractTruthWriteCount', 0,
      'indicatorWriteCount', 0,
      'scheduleWriteCount', 0
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decisionId', decision.id,
        'projectId', decision.project_id,
        'sourceDocumentId', decision.source_document_id,
        'decisionKey', decision.metadata ->> 'decisionKey',
        'revision', (decision.metadata ->> 'revision')::integer,
        'documentVersionId', decision.metadata ->> 'documentVersionId',
        'parserGenerationId', decision.metadata ->> 'parserGenerationId',
        'titleHe', decision.title_he,
        'summaryHe', decision.summary_he,
        'content', decision.content,
        'hashtags', decision.hashtags,
        'sourceEvidence', coalesce(decision.metadata -> 'sourceEvidence', '[]'::jsonb),
        'responsibleParty', decision.responsible_party,
        'beneficiary', decision.beneficiary,
        'categoryHe', decision.category_he,
        'indicatorSuitability', decision.indicator_suitability,
        'timing', decision.timing,
        'triggerHe', decision.trigger_he,
        'triggerDescriptionHe', decision.trigger_description_he,
        'reviewStatus', decision.review_status,
        'reviewStatusCode', decision.metadata ->> 'reviewStatusCode',
        'conflictStatus', decision.metadata ->> 'conflictStatus',
        'reviewedAt', decision.reviewed_at,
        'reviewReasonHe', decision.review_reason_he,
        'embeddingReady', decision.embedding is not null
          and public.vector_dims(decision.embedding) = 3072,
        'embeddingDimensions', case
          when decision.embedding is null then null
          else public.vector_dims(decision.embedding)
        end,
        'createdAt', decision.created_at
      ) order by
        case decision.metadata ->> 'reviewStatusCode'
          when 'proposed' then 0
          when 'unresolved' then 1
          when 'corrected' then 2
          when 'approved' then 3
          when 'rejected' then 4
          else 5
        end,
        decision.created_at,
        decision.metadata ->> 'decisionKey')
      from product_decisions decision
    ), '[]'::jsonb),
    'gates', jsonb_build_object(
      'productViewSource', true,
      'readOnly', true,
      'indicatorOwnsPlacement', true,
      'indicatorOwnsScheduleWrites', true,
      'contractsIndicatorWritesEnabled', false,
      'contractsScheduleWritesEnabled', false
    )
  )
  into v_result
  from workspace;

  return v_result;
end;
$$;

revoke execute on function public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)
to service_role;

comment on function public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid) is
  'Service-role-only read boundary from the R6 Contracts product view to the future Indicator agent. Performs no model, Indicator, or Schedule write.';

commit;
