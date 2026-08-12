-- BIDoc Contracts Agent Phase 3F review-history read surface.
-- This migration adds no table, policy, mutation privilege, or browser access.

create or replace function public.bidoc_contracts_list_activity_mapping_reviews_v1(
  p_source_project_id uuid,
  p_document_version_id text default null,
  p_candidate_key text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_mapping_id uuid;
  v_schedule_project_id uuid;
  v_document_version_id text := nullif(btrim(p_document_version_id), '');
  v_candidate_key text := nullif(btrim(p_candidate_key), '');
  v_total integer := 0;
  v_events jsonb := '[]'::jsonb;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Contracts activity mapping history requires the server service role';
  end if;
  if p_source_project_id is null then
    raise exception using errcode = '23502', message = 'A MAIN source project UUID is required';
  end if;
  if p_document_version_id is not null and v_document_version_id is null then
    raise exception using errcode = '22023', message = 'Document version filter cannot be blank';
  end if;
  if v_document_version_id is not null
     and v_document_version_id !~ '^sha256:[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Document version filter is invalid';
  end if;
  if p_candidate_key is not null and v_candidate_key is null then
    raise exception using errcode = '22023', message = 'Candidate key filter cannot be blank';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'Activity mapping history limit must be between 1 and 100';
  end if;

  select mapping.id, mapping.schedule_project_id
  into v_mapping_id, v_schedule_project_id
  from private.schedule_contract_project_mappings mapping
  where mapping.source_system = 'main'
    and mapping.source_project_id = p_source_project_id
    and mapping.status = 'active';

  if v_mapping_id is null then
    raise exception using
      errcode = '23503',
      message = 'No active approved MAIN-to-KAPAIM project mapping exists';
  end if;

  select count(*)::integer
  into v_total
  from private.schedule_activity_mapping_review_events event
  where event.project_id = v_schedule_project_id
    and event.project_mapping_id = v_mapping_id
    and (v_document_version_id is null or event.document_version_id = v_document_version_id)
    and (v_candidate_key is null or event.candidate_key = v_candidate_key);

  select coalesce(jsonb_agg(item.payload order by item.reviewed_at desc, item.created_at desc, item.id desc), '[]'::jsonb)
  into v_events
  from (
    select
      event.id,
      event.reviewed_at,
      event.created_at,
      jsonb_build_object(
        'eventId', event.id,
        'eventKey', event.event_key,
        'supersedesEventId', event.supersedes_event_id,
        'documentVersionId', event.document_version_id,
        'candidateKey', event.candidate_key,
        'milestoneKey', event.milestone_key,
        'scheduleVersionId', event.schedule_version_id,
        'action', event.action,
        'selectedMappingId', event.selected_mapping_id,
        'selectedCanonicalKey', event.selected_canonical_key,
        'selectedActivityKey', event.selected_activity_alias,
        'mappingStatus', event.mapping_status,
        'confidence', event.confidence,
        'alternatives', event.alternatives_snapshot,
        'evidence', event.evidence_snapshot,
        'conflict', event.conflict_snapshot,
        'reviewerId', event.reviewer_id,
        'reviewedAt', event.reviewed_at,
        'reason', event.reason,
        'result', event.result_snapshot,
        'createdAt', event.created_at
      ) as payload
    from private.schedule_activity_mapping_review_events event
    where event.project_id = v_schedule_project_id
      and event.project_mapping_id = v_mapping_id
      and (v_document_version_id is null or event.document_version_id = v_document_version_id)
      and (v_candidate_key is null or event.candidate_key = v_candidate_key)
    order by event.reviewed_at desc, event.created_at desc, event.id desc
    limit p_limit
  ) item;

  return jsonb_build_object(
    'historyVersion', 'contracts-activity-mapping-history.phase3f.v1',
    'projectContext', jsonb_build_object(
      'sourceSystem', 'main',
      'sourceProjectId', p_source_project_id,
      'scheduleProjectId', v_schedule_project_id,
      'projectMappingId', v_mapping_id,
      'mappingStatus', 'active'
    ),
    'filters', jsonb_build_object(
      'documentVersionId', v_document_version_id,
      'candidateKey', v_candidate_key,
      'limit', p_limit
    ),
    'total', v_total,
    'returned', jsonb_array_length(v_events),
    'events', v_events
  );
end;
$$;

revoke execute on function public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid, text, text, integer)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid, text, text, integer)
to service_role;

notify pgrst, 'reload schema';
