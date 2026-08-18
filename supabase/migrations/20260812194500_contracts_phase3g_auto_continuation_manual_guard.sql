-- BIDoc Contracts Agent Phase 3G automatic-continuation manual-decision guard.
--
-- Keep bidoc_contracts_review_activity_mapping_v1 as the single atomic write
-- surface. This forward migration strengthens that RPC through an internal
-- guard: every manual and automatic review serializes on the same project /
-- contract obligation / Schedule-version identity, and auto_continue fails if a human
-- current-version decision won the race.

create or replace function private.bidoc_contracts_lock_activity_mapping_review_v1(
  p_action text,
  p_project_id uuid,
  p_canonical_key text,
  p_schedule_version_id text,
  p_activity_alias text,
  p_document_version_id text,
  p_candidate_key text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lock_identity text;
  v_current_prefix text;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Contracts activity mapping review guard requires the server service role';
  end if;
  if p_action not in ('confirm', 'correct', 'reject', 'unmapped', 'auto_continue')
     or p_project_id is null
     or p_schedule_version_id is null
     or p_document_version_id is null
     or p_candidate_key is null then
    return;
  end if;

  -- Every Phase 3F/3G action for the same contract obligation and Schedule
  -- version shares one cross-process lock, including reject and unmapped.
  v_lock_identity := p_document_version_id || ':' || p_candidate_key;
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_project_id::text || ':' || v_lock_identity || ':' || p_schedule_version_id,
      0
    )
  );

  if p_action <> 'auto_continue' then
    return;
  end if;
  if p_canonical_key is null or p_activity_alias is null then
    raise exception using
      errcode = '23502',
      message = 'Automatic continuation guard requires canonical and activity identities';
  end if;

  v_current_prefix := 'gantt:' || p_schedule_version_id || ':';
  if exists (
    select 1
    from public.schedule_activity_map mapping
    where mapping.project_id = p_project_id
      and mapping.canonical_key = p_canonical_key
      and mapping.alias_source = 'gantt_activity_key'
      and left(mapping.alias, length(v_current_prefix)) = v_current_prefix
      and mapping.status = 'manually_confirmed'
  ) or exists (
    select 1
    from private.schedule_activity_mapping_review_events event
    where event.project_id = p_project_id
      and event.schedule_version_id = p_schedule_version_id
      and event.document_version_id = p_document_version_id
      and event.candidate_key = p_candidate_key
      and event.action in ('confirm', 'correct', 'reject', 'unmapped')
  ) then
    raise exception using
      errcode = '23505',
      message = 'Automatic continuation cannot replace or follow a human current-version decision';
  end if;
end;
$$;

revoke execute on function private.bidoc_contracts_lock_activity_mapping_review_v1(text, uuid, text, text, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function private.bidoc_contracts_lock_activity_mapping_review_v1(text, uuid, text, text, text, text, text)
to service_role;

-- Wrap the already-applied single RPC without exposing a new public writer.
-- The original implementation is retained privately and remains invoker-only.
alter function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
rename to bidoc_contracts_review_activity_mapping_phase3c_v1;
alter function public.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)
set schema private;

revoke execute on function private.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)
from public, anon, authenticated, service_role;
grant execute on function private.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)
to service_role;

create or replace function public.bidoc_contracts_review_activity_mapping_v1(p_submission jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_action text := p_submission #>> '{decision,action}';
  v_project_id uuid;
  v_canonical_key text := nullif(btrim(p_submission #>> '{decision,canonicalKey}'), '');
  v_schedule_version_id text := nullif(btrim(p_submission #>> '{scheduleVersion,fileId}'), '');
  v_activity_alias text := nullif(btrim(p_submission #>> '{decision,activityKey}'), '');
  v_document_version_id text := nullif(btrim(p_submission #>> '{obligation,documentVersionId}'), '');
  v_candidate_key text := nullif(btrim(p_submission #>> '{obligation,candidateKey}'), '');
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Contracts activity mapping review requires the server service role';
  end if;
  v_project_id := (p_submission #>> '{projectContext,scheduleProjectId}')::uuid;

  -- Lock before the retained RPC reaches its project-mapping FOR SHARE lock or
  -- any mapping mutation. Manual and automatic writers therefore share the
  -- same cross-process serialization point.
  perform private.bidoc_contracts_lock_activity_mapping_review_v1(
    v_action,
    v_project_id,
    v_canonical_key,
    v_schedule_version_id,
    v_activity_alias,
    v_document_version_id,
    v_candidate_key
  );
  return private.bidoc_contracts_review_activity_mapping_phase3c_v1(p_submission);
end;
$$;

revoke execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
to service_role;

notify pgrst, 'reload schema';
