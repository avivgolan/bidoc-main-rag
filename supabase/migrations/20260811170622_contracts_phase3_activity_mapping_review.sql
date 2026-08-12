-- BIDoc Contracts Agent Phase 3C activity-mapping review migration.
-- Generated with Supabase CLI 2.113.0. Phase 3C is isolated-verification only:
-- do not apply this migration to KAPAIM without the separate Phase 3D approval.

-- Harden the existing current-state alias table without changing its identity
-- or the accepted Schedule Engine/task identity contract.
alter table public.schedule_activity_map
  add constraint sam_canonical_key_ck
  check (canonical_key ~ '^schedule-activity:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  not valid;

alter table public.schedule_activity_map
  add constraint sam_alias_source_ck
  check (alias_source in (
    'gantt_activity_key',
    'gantt_task_uid',
    'contracts_candidate',
    'contract_milestone'
  ))
  not valid;

alter table public.schedule_activity_map
  add constraint sam_match_method_ck
  check (match_method in (
    'manual_review',
    'exact_uid_continuity',
    'corrected_manual_review'
  ))
  not valid;

alter table public.schedule_activity_map
  add constraint sam_confidence_ck
  check (
    confidence::text not in ('NaN', 'Infinity', '-Infinity')
    and confidence between 0 and 1
  )
  not valid;

alter table public.schedule_activity_map
  add constraint sam_status_ck
  check (status in (
    'suggested',
    'manually_confirmed',
    'auto_confirmed',
    'rejected',
    'unmapped'
  ))
  not valid;

alter table public.schedule_activity_map
  add constraint sam_confirmation_ck
  check (
    (status = 'manually_confirmed' and confirmed_by is not null and confirmed_at is not null)
    or (status = 'auto_confirmed' and confirmed_by is null and confirmed_at is not null)
    or (status in ('suggested', 'rejected', 'unmapped') and confirmed_by is null and confirmed_at is null)
  )
  not valid;

alter table public.schedule_activity_map
  add constraint sam_alias_shape_ck
  check (
    (alias_source = 'gantt_activity_key' and alias like 'gantt:%')
    or (alias_source = 'gantt_task_uid' and alias ~ '^[0-9]+$')
    or (alias_source in ('contracts_candidate', 'contract_milestone') and length(btrim(alias)) >= 1)
  )
  not valid;

alter table public.schedule_activity_map validate constraint sam_canonical_key_ck;
alter table public.schedule_activity_map validate constraint sam_alias_source_ck;
alter table public.schedule_activity_map validate constraint sam_match_method_ck;
alter table public.schedule_activity_map validate constraint sam_confidence_ck;
alter table public.schedule_activity_map validate constraint sam_status_ck;
alter table public.schedule_activity_map validate constraint sam_confirmation_ck;
alter table public.schedule_activity_map validate constraint sam_alias_shape_ck;

create unique index sam_confirmed_alias_winner_uniq
  on public.schedule_activity_map (project_id, alias_source, alias)
  where status in ('manually_confirmed', 'auto_confirmed');

create index sam_review_queue_idx
  on public.schedule_activity_map (project_id, status, updated_at desc);

create index sam_alias_lookup_idx
  on public.schedule_activity_map (project_id, alias_source, alias);

create index sam_canonical_status_idx
  on public.schedule_activity_map (project_id, canonical_key, status);

-- Support an exact composite foreign key so the immutable event's Schedule
-- project must belong to the approved Phase 2 project mapping.
alter table private.schedule_contract_project_mappings
  add constraint scpm_id_schedule_project_uniq
  unique (id, schedule_project_id);

create table private.schedule_activity_mapping_review_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  submission_fingerprint text not null,
  supersedes_event_id uuid references private.schedule_activity_mapping_review_events(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_mapping_id uuid not null,
  document_version_id text not null,
  candidate_key text not null,
  milestone_key text,
  schedule_version_id text not null,
  action text not null,
  selected_mapping_id uuid references public.schedule_activity_map(id) on delete restrict,
  selected_canonical_key text,
  selected_activity_alias text,
  selected_alias_source text,
  selected_match_method text,
  mapping_status text,
  confidence numeric not null,
  alternatives_snapshot jsonb not null,
  evidence_snapshot jsonb not null,
  conflict_snapshot jsonb,
  reviewer_id uuid,
  reviewed_at timestamptz not null,
  reason text not null,
  submission_snapshot jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint samre_project_mapping_fk
    foreign key (project_mapping_id, project_id)
    references private.schedule_contract_project_mappings(id, schedule_project_id)
    on delete restrict,
  constraint samre_event_key_ck check (length(btrim(event_key)) between 3 and 200),
  constraint samre_fingerprint_ck check (submission_fingerprint ~ '^[0-9a-f]{32}$'),
  constraint samre_document_version_ck check (document_version_id ~ '^sha256:[0-9a-f]{64}$'),
  constraint samre_candidate_key_ck check (length(btrim(candidate_key)) >= 3),
  constraint samre_schedule_version_ck check (length(btrim(schedule_version_id)) >= 1),
  constraint samre_action_ck check (action in ('confirm', 'reject', 'correct', 'unmapped', 'auto_continue')),
  constraint samre_confidence_ck check (
    confidence::text not in ('NaN', 'Infinity', '-Infinity')
    and confidence between 0 and 1
  ),
  constraint samre_json_shapes_ck check (
    jsonb_typeof(alternatives_snapshot) = 'array'
    and jsonb_array_length(alternatives_snapshot) <= 5
    and jsonb_typeof(evidence_snapshot) = 'array'
    and jsonb_array_length(evidence_snapshot) >= 1
    and (conflict_snapshot is null or jsonb_typeof(conflict_snapshot) = 'object')
    and jsonb_typeof(submission_snapshot) = 'object'
    and jsonb_typeof(result_snapshot) = 'object'
  ),
  constraint samre_selection_ck check (
    (
      action in ('confirm', 'correct', 'auto_continue')
      and selected_mapping_id is not null
      and selected_canonical_key is not null
      and selected_activity_alias is not null
      and selected_alias_source = 'gantt_activity_key'
      and selected_match_method is not null
      and mapping_status is not null
    )
    or (
      action in ('reject', 'unmapped')
      and selected_mapping_id is null
      and selected_canonical_key is null
      and selected_activity_alias is null
      and selected_alias_source is null
      and selected_match_method is null
      and mapping_status is null
    )
  ),
  constraint samre_method_status_ck check (
    (action = 'confirm' and selected_match_method = 'manual_review' and mapping_status = 'manually_confirmed')
    or (action = 'correct' and selected_match_method = 'corrected_manual_review' and mapping_status = 'manually_confirmed')
    or (action = 'auto_continue' and selected_match_method = 'exact_uid_continuity' and mapping_status = 'auto_confirmed' and confidence >= 0.95)
    or (action in ('reject', 'unmapped') and selected_match_method is null and mapping_status is null)
  ),
  constraint samre_reviewer_ck check (
    (action = 'auto_continue' and reviewer_id is null)
    or (action <> 'auto_continue' and reviewer_id is not null)
  ),
  constraint samre_supersession_ck check (action <> 'correct' or supersedes_event_id is not null),
  constraint samre_reason_ck check (length(btrim(reason)) >= 10)
);

create index samre_project_reviewed_idx
  on private.schedule_activity_mapping_review_events (project_id, reviewed_at desc);

create index samre_candidate_history_idx
  on private.schedule_activity_mapping_review_events (
    project_id,
    document_version_id,
    candidate_key,
    reviewed_at desc
  );

create index samre_project_mapping_fk_idx
  on private.schedule_activity_mapping_review_events (project_mapping_id);

create index samre_selected_mapping_fk_idx
  on private.schedule_activity_mapping_review_events (selected_mapping_id)
  where selected_mapping_id is not null;

create index samre_supersedes_fk_idx
  on private.schedule_activity_mapping_review_events (supersedes_event_id)
  where supersedes_event_id is not null;

alter table private.schedule_activity_mapping_review_events enable row level security;

create trigger schedule_activity_mapping_review_events_immutable
before update or delete on private.schedule_activity_mapping_review_events
for each row execute function private.bidoc_contract_audit_is_immutable();

create or replace function public.bidoc_contracts_resolve_mapping_context_v1(p_source_project_id uuid)
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
    raise exception using
      errcode = '42501',
      message = 'Contracts mapping context requires the server service role';
  end if;

  select jsonb_build_object(
    'sourceSystem', mapping.source_system,
    'sourceProjectId', mapping.source_project_id,
    'scheduleProjectId', mapping.schedule_project_id,
    'projectMappingId', mapping.id,
    'mappingStatus', mapping.status
  )
  into v_result
  from private.schedule_contract_project_mappings mapping
  where mapping.source_system = 'main'
    and mapping.source_project_id = p_source_project_id
    and mapping.status = 'active';

  if v_result is null then
    raise exception using
      errcode = '23503',
      message = 'No active approved MAIN-to-KAPAIM project mapping exists';
  end if;

  return v_result;
end;
$$;

create or replace function public.bidoc_contracts_review_activity_mapping_v1(p_submission jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_submission_version text := p_submission ->> 'submissionVersion';
  v_event_key text := nullif(btrim(p_submission ->> 'eventKey'), '');
  v_fingerprint text := md5(coalesce(p_submission, '{}'::jsonb)::text);
  v_action text := p_submission #>> '{decision,action}';
  v_source_project_id uuid;
  v_project_id uuid;
  v_project_mapping_id uuid;
  v_document_version_id text := p_submission #>> '{obligation,documentVersionId}';
  v_candidate_key text := nullif(btrim(p_submission #>> '{obligation,candidateKey}'), '');
  v_milestone_key text := nullif(btrim(p_submission #>> '{obligation,milestoneKey}'), '');
  v_schedule_version_id text := nullif(btrim(p_submission #>> '{scheduleVersion,fileId}'), '');
  v_canonical_key text := nullif(btrim(p_submission #>> '{decision,canonicalKey}'), '');
  v_activity_alias text := nullif(btrim(p_submission #>> '{decision,activityKey}'), '');
  v_previous_activity_alias text := nullif(btrim(p_submission #>> '{decision,previousActivityKey}'), '');
  v_match_method text := nullif(btrim(p_submission #>> '{decision,matchMethod}'), '');
  v_task_uid integer;
  v_confidence numeric;
  v_reviewer_id uuid;
  v_reviewed_at timestamptz;
  v_reason text := nullif(btrim(p_submission #>> '{decision,reason}'), '');
  v_supersedes_event_id uuid;
  v_alternatives jsonb := p_submission #> '{decision,alternatives}';
  v_evidence jsonb := p_submission #> '{decision,evidence}';
  v_conflict jsonb := nullif(p_submission #> '{decision,conflict}', 'null'::jsonb);
  v_mapping_status text;
  v_confirmed_by uuid;
  v_selected_mapping_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_alias_count integer := 0;
  v_selected_count integer := 0;
  v_result jsonb;
  v_existing_event private.schedule_activity_mapping_review_events%rowtype;
  v_superseded_event private.schedule_activity_mapping_review_events%rowtype;
  v_superseded_task_uid text;
  v_current_prefix text;
begin
  if current_user <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Contracts activity mapping review requires the server service role';
  end if;
  if v_submission_version <> 'contracts-activity-mapping-review.phase3.v1' then
    raise exception using errcode = '22023', message = 'Unsupported activity mapping review submission version';
  end if;
  if octet_length(coalesce(p_submission, '{}'::jsonb)::text) > 525000 then
    raise exception using errcode = '54000', message = 'Activity mapping review submission exceeds the approved byte limit';
  end if;
  if v_event_key is null then
    raise exception using errcode = '23502', message = 'Activity mapping event key is required';
  end if;

  select * into v_existing_event
  from private.schedule_activity_mapping_review_events event
  where event.event_key = v_event_key;
  if found then
    if v_existing_event.submission_fingerprint <> v_fingerprint then
      raise exception using errcode = '23505', message = 'Activity mapping event key was reused with a different payload';
    end if;
    return v_existing_event.result_snapshot;
  end if;

  if v_action not in ('confirm', 'reject', 'correct', 'unmapped', 'auto_continue') then
    raise exception using errcode = '22023', message = 'Unsupported activity mapping review action';
  end if;
  if v_document_version_id is null
     or v_document_version_id !~ '^sha256:[0-9a-f]{64}$'
     or v_candidate_key is null
     or v_schedule_version_id is null then
    raise exception using errcode = '22023', message = 'Authoritative obligation and schedule identities are required';
  end if;
  if coalesce((p_submission #>> '{scheduleVersion,versionConflict}')::boolean, true) then
    raise exception using errcode = '22023', message = 'Ambiguous Schedule version cannot be mapped';
  end if;
  if p_submission #>> '{projectContext,sourceSystem}' <> 'main'
     or p_submission #>> '{projectContext,mappingStatus}' <> 'active' then
    raise exception using errcode = '22023', message = 'An active MAIN project mapping context is required';
  end if;

  v_source_project_id := (p_submission #>> '{projectContext,sourceProjectId}')::uuid;
  v_project_id := (p_submission #>> '{projectContext,scheduleProjectId}')::uuid;
  v_project_mapping_id := (p_submission #>> '{projectContext,projectMappingId}')::uuid;
  v_reviewed_at := (p_submission #>> '{decision,reviewedAt}')::timestamptz;
  v_confidence := (p_submission #>> '{decision,confidence}')::numeric;
  if v_confidence::text in ('NaN', 'Infinity', '-Infinity') or v_confidence < 0 or v_confidence > 1 then
    raise exception using errcode = '22023', message = 'Mapping confidence must be finite and between zero and one';
  end if;
  if v_reason is null or length(v_reason) < 10 then
    raise exception using errcode = '22023', message = 'A substantive mapping review reason is required';
  end if;
  if jsonb_typeof(v_alternatives) <> 'array'
     or jsonb_array_length(v_alternatives) > 5
     or jsonb_typeof(v_evidence) <> 'array'
     or jsonb_array_length(v_evidence) = 0
     or (v_conflict is not null and jsonb_typeof(v_conflict) <> 'object') then
    raise exception using errcode = '22023', message = 'Mapping alternatives, evidence, or conflict snapshot is invalid';
  end if;

  perform 1
  from private.schedule_contract_project_mappings mapping
  where mapping.id = v_project_mapping_id
    and mapping.source_system = 'main'
    and mapping.source_project_id = v_source_project_id
    and mapping.schedule_project_id = v_project_id
    and mapping.status = 'active'
  for share;
  if not found then
    raise exception using errcode = '23503', message = 'Project mapping context does not match an active approved mapping';
  end if;

  if nullif(p_submission #>> '{decision,supersedesEventId}', '') is not null then
    v_supersedes_event_id := (p_submission #>> '{decision,supersedesEventId}')::uuid;
    select * into v_superseded_event
    from private.schedule_activity_mapping_review_events event
    where event.id = v_supersedes_event_id
      and event.project_id = v_project_id
      and event.document_version_id = v_document_version_id
      and event.candidate_key = v_candidate_key;
    if not found then
      raise exception using errcode = '23503', message = 'Superseded mapping event does not match this obligation';
    end if;
  end if;

  if v_action = 'correct' and v_supersedes_event_id is null then
    raise exception using errcode = '23502', message = 'A correction must supersede an immutable mapping event';
  end if;

  if v_action = 'auto_continue' then
    if nullif(p_submission #>> '{decision,reviewerId}', '') is not null then
      raise exception using errcode = '22023', message = 'Automatic continuation cannot claim a human reviewer';
    end if;
    v_reviewer_id := null;
  else
    v_reviewer_id := (p_submission #>> '{decision,reviewerId}')::uuid;
  end if;

  if v_action in ('confirm', 'correct', 'auto_continue') then
    v_task_uid := (p_submission #>> '{decision,taskUid}')::integer;
    if v_task_uid < 0
       or v_activity_alias is distinct from ('gantt:' || v_schedule_version_id || ':' || v_task_uid::text) then
      raise exception using errcode = '22023', message = 'Selected activity identity does not match the reviewed Schedule version and task UID';
    end if;
    select count(*)::integer into v_selected_count
    from jsonb_array_elements(v_alternatives) alternative
    where alternative ->> 'activityKey' = v_activity_alias;
    if v_selected_count <> 1 then
      raise exception using errcode = '22023', message = 'Selected activity must appear exactly once in the reviewed alternatives';
    end if;
    if v_conflict is not null
       and coalesce((p_submission #>> '{decision,conflictResolved}')::boolean, false) is not true then
      raise exception using errcode = '22023', message = 'An open mapping conflict cannot be confirmed';
    end if;

    if v_action = 'confirm' then
      v_match_method := 'manual_review';
      v_mapping_status := 'manually_confirmed';
      v_confirmed_by := v_reviewer_id;
      if v_canonical_key is null then
        v_canonical_key := 'schedule-activity:' || gen_random_uuid()::text;
      elsif not exists (
        select 1 from public.schedule_activity_map mapping
        where mapping.project_id = v_project_id
          and mapping.canonical_key = v_canonical_key
          and mapping.status in ('manually_confirmed', 'auto_confirmed')
      ) then
        raise exception using errcode = '23503', message = 'A supplied canonical activity key must already exist';
      end if;
    elsif v_action = 'correct' then
      v_match_method := 'corrected_manual_review';
      v_mapping_status := 'manually_confirmed';
      v_confirmed_by := v_reviewer_id;
      if v_canonical_key is null
         or v_superseded_event.selected_canonical_key is distinct from v_canonical_key then
        raise exception using errcode = '22023', message = 'A correction must preserve the superseded canonical activity';
      end if;
    else
      v_match_method := 'exact_uid_continuity';
      v_mapping_status := 'auto_confirmed';
      v_confirmed_by := null;
      if v_canonical_key is null or v_previous_activity_alias is null or v_confidence < 0.95 then
        raise exception using errcode = '22023', message = 'Automatic continuation requires prior identity and confidence of at least 0.95';
      end if;
      v_current_prefix := 'gantt:' || v_schedule_version_id || ':';
      if v_previous_activity_alias = v_activity_alias
         or left(v_previous_activity_alias, length(v_current_prefix)) = v_current_prefix
         or right(v_previous_activity_alias, length(':' || v_task_uid::text)) <> (':' || v_task_uid::text) then
        raise exception using errcode = '22023', message = 'Automatic continuation requires the same task UID from a different Schedule version';
      end if;
      if v_conflict is not null then
        raise exception using errcode = '22023', message = 'Automatic continuation cannot carry an open conflict';
      end if;
      if not exists (
        select 1 from public.schedule_activity_map mapping
        where mapping.project_id = v_project_id
          and mapping.canonical_key = v_canonical_key
          and mapping.alias_source = 'gantt_activity_key'
          and mapping.alias = v_previous_activity_alias
          and mapping.status in ('manually_confirmed', 'auto_confirmed')
      ) or not exists (
        select 1 from public.schedule_activity_map mapping
        where mapping.project_id = v_project_id
          and mapping.canonical_key = v_canonical_key
          and mapping.alias_source = 'contracts_candidate'
          and mapping.alias = v_candidate_key
          and mapping.status = 'manually_confirmed'
      ) then
        raise exception using errcode = '23503', message = 'Automatic continuation lacks a confirmed prior alias or contract relationship';
      end if;
    end if;

    if v_canonical_key !~ '^schedule-activity:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = '22023', message = 'Canonical activity key is invalid';
    end if;

    v_current_prefix := 'gantt:' || v_schedule_version_id || ':';
    if v_action = 'confirm' and exists (
      select 1 from public.schedule_activity_map mapping
      where mapping.project_id = v_project_id
        and mapping.canonical_key = v_canonical_key
        and mapping.alias_source = 'gantt_activity_key'
        and left(mapping.alias, length(v_current_prefix)) = v_current_prefix
        and mapping.alias <> v_activity_alias
        and mapping.status in ('manually_confirmed', 'auto_confirmed')
    ) then
      raise exception using errcode = '23505', message = 'Canonical activity already has a different confirmed alias in this Schedule version';
    end if;

    if v_action in ('correct', 'auto_continue') then
      update public.schedule_activity_map mapping
      set status = 'rejected',
          confirmed_by = null,
          confirmed_at = null,
          updated_at = v_reviewed_at
      where mapping.project_id = v_project_id
        and mapping.canonical_key = v_canonical_key
        and mapping.alias_source = 'gantt_activity_key'
        and left(mapping.alias, length(v_current_prefix)) = v_current_prefix
        and mapping.alias <> v_activity_alias
        and mapping.status in ('suggested', 'manually_confirmed', 'auto_confirmed');
    end if;

    if v_action = 'correct' then
      v_superseded_task_uid := regexp_replace(v_superseded_event.selected_activity_alias, '^.*:', '');
      if v_superseded_task_uid ~ '^[0-9]+$' and v_superseded_task_uid <> v_task_uid::text then
        update public.schedule_activity_map mapping
        set status = 'rejected',
            confirmed_by = null,
            confirmed_at = null,
            updated_at = v_reviewed_at
        where mapping.project_id = v_project_id
          and mapping.canonical_key = v_canonical_key
          and mapping.alias_source = 'gantt_task_uid'
          and mapping.alias = v_superseded_task_uid
          and mapping.status in ('suggested', 'manually_confirmed', 'auto_confirmed');
      end if;
    end if;

    insert into public.schedule_activity_map (
      project_id, canonical_key, alias, alias_source, match_method,
      confidence, status, confirmed_by, confirmed_at
    ) values (
      v_project_id, v_canonical_key, v_activity_alias, 'gantt_activity_key', v_match_method,
      v_confidence, v_mapping_status, v_confirmed_by, v_reviewed_at
    )
    on conflict (project_id, canonical_key, alias, alias_source) do update
    set match_method = excluded.match_method,
        confidence = excluded.confidence,
        status = excluded.status,
        confirmed_by = excluded.confirmed_by,
        confirmed_at = excluded.confirmed_at,
        updated_at = excluded.confirmed_at
    returning id into v_selected_mapping_id;
    v_alias_count := v_alias_count + 1;

    if v_action in ('confirm', 'correct') then
      insert into public.schedule_activity_map (
        project_id, canonical_key, alias, alias_source, match_method,
        confidence, status, confirmed_by, confirmed_at
      ) values (
        v_project_id, v_canonical_key, v_task_uid::text, 'gantt_task_uid', v_match_method,
        v_confidence, v_mapping_status, v_confirmed_by, v_reviewed_at
      )
      on conflict (project_id, canonical_key, alias, alias_source) do update
      set match_method = excluded.match_method,
          confidence = excluded.confidence,
          status = excluded.status,
          confirmed_by = excluded.confirmed_by,
          confirmed_at = excluded.confirmed_at,
          updated_at = excluded.confirmed_at;
      v_alias_count := v_alias_count + 1;

      insert into public.schedule_activity_map (
        project_id, canonical_key, alias, alias_source, match_method,
        confidence, status, confirmed_by, confirmed_at
      ) values (
        v_project_id, v_canonical_key, v_candidate_key, 'contracts_candidate', v_match_method,
        v_confidence, v_mapping_status, v_confirmed_by, v_reviewed_at
      )
      on conflict (project_id, canonical_key, alias, alias_source) do update
      set match_method = excluded.match_method,
          confidence = excluded.confidence,
          status = excluded.status,
          confirmed_by = excluded.confirmed_by,
          confirmed_at = excluded.confirmed_at,
          updated_at = excluded.confirmed_at;
      v_alias_count := v_alias_count + 1;

      if v_milestone_key is not null then
        insert into public.schedule_activity_map (
          project_id, canonical_key, alias, alias_source, match_method,
          confidence, status, confirmed_by, confirmed_at
        ) values (
          v_project_id, v_canonical_key, v_milestone_key, 'contract_milestone', v_match_method,
          v_confidence, v_mapping_status, v_confirmed_by, v_reviewed_at
        )
        on conflict (project_id, canonical_key, alias, alias_source) do update
        set match_method = excluded.match_method,
            confidence = excluded.confidence,
            status = excluded.status,
            confirmed_by = excluded.confirmed_by,
            confirmed_at = excluded.confirmed_at,
            updated_at = excluded.confirmed_at;
        v_alias_count := v_alias_count + 1;
      end if;
    end if;
  else
    if v_canonical_key is not null
       or v_activity_alias is not null
       or nullif(p_submission #>> '{decision,taskUid}', '') is not null
       or v_match_method is not null then
      raise exception using errcode = '22023', message = 'Reject and unmapped decisions cannot select an operational mapping';
    end if;
    if v_action = 'reject' and jsonb_array_length(v_alternatives) = 0 then
      raise exception using errcode = '22023', message = 'A rejection must preserve at least one reviewed alternative';
    end if;
    v_mapping_status := null;
  end if;

  v_result := jsonb_build_object(
    'status', 'recorded',
    'eventKey', v_event_key,
    'eventId', v_event_id,
    'action', v_action,
    'canonicalKey', v_canonical_key,
    'selectedMappingId', v_selected_mapping_id,
    'mappingStatus', v_mapping_status,
    'mappingRowsChanged', v_alias_count
  );

  insert into private.schedule_activity_mapping_review_events (
    id, event_key, submission_fingerprint, supersedes_event_id,
    project_id, project_mapping_id, document_version_id, candidate_key,
    milestone_key, schedule_version_id, action, selected_mapping_id,
    selected_canonical_key, selected_activity_alias, selected_alias_source,
    selected_match_method, mapping_status, confidence,
    alternatives_snapshot, evidence_snapshot, conflict_snapshot,
    reviewer_id, reviewed_at, reason, submission_snapshot, result_snapshot
  ) values (
    v_event_id, v_event_key, v_fingerprint, v_supersedes_event_id,
    v_project_id, v_project_mapping_id, v_document_version_id, v_candidate_key,
    v_milestone_key, v_schedule_version_id, v_action, v_selected_mapping_id,
    v_canonical_key, v_activity_alias,
    case when v_selected_mapping_id is null then null else 'gantt_activity_key' end,
    v_match_method, v_mapping_status, v_confidence,
    v_alternatives, v_evidence, v_conflict,
    v_reviewer_id, v_reviewed_at, v_reason, p_submission, v_result
  );

  return v_result;
end;
$$;

-- The mapping surface is backend-only. RLS remains enabled as defense in depth,
-- while grants define the Data API/function reachability boundary explicitly.
revoke all privileges on table public.schedule_activity_map from public, anon, authenticated, service_role;
grant select, insert, update on table public.schedule_activity_map to service_role;

revoke all privileges on table private.schedule_activity_mapping_review_events
from public, anon, authenticated, service_role;
grant select, insert on table private.schedule_activity_mapping_review_events to service_role;

revoke execute on function public.bidoc_contracts_resolve_mapping_context_v1(uuid)
from public, anon, authenticated;
grant execute on function public.bidoc_contracts_resolve_mapping_context_v1(uuid) to service_role;

revoke execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb)
from public, anon, authenticated;
grant execute on function public.bidoc_contracts_review_activity_mapping_v1(jsonb) to service_role;

notify pgrst, 'reload schema';
