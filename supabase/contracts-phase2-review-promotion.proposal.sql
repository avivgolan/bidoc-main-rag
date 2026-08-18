-- UNAPPLIED PHASE 2 PROPOSAL.
-- This file is intentionally not a migration and must not be run against KAPAIM
-- until the separate migration/apply checkpoint is explicitly approved.
-- Target: KAPAIM / APP DATA (project ref smxibuaowzuxkznuouwj).

create schema if not exists private;

grant usage on schema private to service_role;

create table if not exists private.schedule_contract_project_mappings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'main' check (source_system = 'main'),
  source_project_id uuid not null,
  schedule_project_id uuid not null references public.projects(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive')),
  approved_by text not null check (length(btrim(approved_by)) >= 3),
  approved_at timestamptz not null,
  reason text not null check (length(btrim(reason)) >= 10),
  created_at timestamptz not null default now(),
  unique (source_system, source_project_id),
  unique (schedule_project_id)
);

create table if not exists private.schedule_contract_review_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique check (length(btrim(batch_key)) >= 3),
  payload_fingerprint text not null,
  submission_version text not null check (submission_version = 'contracts-promotion-submission.phase2.v1'),
  planner_version text not null check (planner_version = 'contracts-promotion-planner.phase2.v1'),
  submission_mode text not null check (submission_mode in ('promotion', 'review_only')),
  transaction_status text not null check (transaction_status in ('committed', 'reviewed_no_promotion')),
  document_version_id text not null check (document_version_id like 'sha256:%'),
  source_project_id uuid not null,
  schedule_project_id uuid not null references public.projects(id) on delete restrict,
  mapping_id uuid not null references private.schedule_contract_project_mappings(id) on delete restrict,
  reviewer_id uuid not null,
  reviewed_at timestamptz not null,
  review_reason text not null check (length(btrim(review_reason)) >= 10),
  extractor_version text,
  extraction_snapshot jsonb not null,
  review_snapshot jsonb not null,
  planner_snapshot jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists private.schedule_contract_review_decisions (
  id uuid primary key default gen_random_uuid(),
  review_batch_id uuid not null references private.schedule_contract_review_batches(id) on delete restrict,
  candidate_key text not null,
  action text not null check (action in ('approve', 'reject')),
  outcome text not null check (outcome in ('approved_for_transaction', 'rejected')),
  target_table text check (target_table is null or target_table in (
    'schedule_contract_milestones',
    'schedule_contract_extensions',
    'schedule_contract_conditions'
  )),
  target_row_id uuid,
  reason text not null check (length(btrim(reason)) >= 3),
  candidate_snapshot jsonb not null,
  decision_snapshot jsonb not null,
  conflict_snapshot jsonb,
  created_at timestamptz not null default now(),
  unique (review_batch_id, candidate_key)
);

create table if not exists private.schedule_contract_promotion_attempts (
  id uuid primary key default gen_random_uuid(),
  batch_key text,
  payload_fingerprint text not null,
  status text not null check (status in ('committed', 'reviewed_no_promotion', 'failed')),
  error_code text,
  error_message text,
  promoted_count integer not null default 0 check (promoted_count >= 0),
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists schedule_contract_review_batches_project_idx
  on private.schedule_contract_review_batches (schedule_project_id, reviewed_at desc);
create index if not exists schedule_contract_review_batches_document_idx
  on private.schedule_contract_review_batches (document_version_id, reviewed_at desc);
create index if not exists schedule_contract_review_decisions_candidate_idx
  on private.schedule_contract_review_decisions (candidate_key, created_at desc);
create index if not exists schedule_contract_promotion_attempts_batch_idx
  on private.schedule_contract_promotion_attempts (batch_key, created_at desc);

alter table private.schedule_contract_project_mappings enable row level security;
alter table private.schedule_contract_review_batches enable row level security;
alter table private.schedule_contract_review_decisions enable row level security;
alter table private.schedule_contract_promotion_attempts enable row level security;

create or replace function private.bidoc_contract_audit_is_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Contracts review and promotion audit rows are immutable';
end;
$$;

revoke execute on function private.bidoc_contract_audit_is_immutable() from public, anon, authenticated, service_role;

drop trigger if exists schedule_contract_review_batches_immutable on private.schedule_contract_review_batches;
create trigger schedule_contract_review_batches_immutable
before update or delete on private.schedule_contract_review_batches
for each row execute function private.bidoc_contract_audit_is_immutable();

drop trigger if exists schedule_contract_review_decisions_immutable on private.schedule_contract_review_decisions;
create trigger schedule_contract_review_decisions_immutable
before update or delete on private.schedule_contract_review_decisions
for each row execute function private.bidoc_contract_audit_is_immutable();

drop trigger if exists schedule_contract_promotion_attempts_immutable on private.schedule_contract_promotion_attempts;
create trigger schedule_contract_promotion_attempts_immutable
before update or delete on private.schedule_contract_promotion_attempts
for each row execute function private.bidoc_contract_audit_is_immutable();

create or replace function public.bidoc_contracts_promote_review_v1(p_submission jsonb)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_batch_key text := nullif(btrim(p_submission #>> '{reviewBatch,batchId}'), '');
  v_fingerprint text := md5(coalesce(p_submission, '{}'::jsonb)::text);
  v_submission_version text := p_submission ->> 'submissionVersion';
  v_submission_mode text := p_submission ->> 'submissionMode';
  v_planner_version text := p_submission #>> '{plan,plannerVersion}';
  v_document_version_id text := p_submission #>> '{extraction,document,documentVersionId}';
  v_source_project_id uuid;
  v_schedule_project_id uuid;
  v_mapping_id uuid;
  v_review_batch_id uuid;
  v_existing_batch private.schedule_contract_review_batches%rowtype;
  v_row jsonb;
  v_audit jsonb;
  v_target_id uuid;
  v_existing record;
  v_candidate_snapshot jsonb;
  v_decision_snapshot jsonb;
  v_conflict_snapshot jsonb;
  v_conflict_group_id text;
  v_promotions jsonb := '[]'::jsonb;
  v_result jsonb;
  v_ready_count integer := 0;
  v_rejected_count integer := 0;
  v_unsafe_blocked_count integer := 0;
  v_candidate_document_mismatch_count integer := 0;
  v_row_count integer := 0;
  v_error_code text;
  v_error_message text;
begin
  begin
    if current_user <> 'service_role' then
      raise exception using errcode = '42501', message = 'Contracts promotion requires the server service role';
    end if;
    if v_submission_version <> 'contracts-promotion-submission.phase2.v1' then
      raise exception using errcode = '22023', message = 'Unsupported Contracts promotion submission version';
    end if;
    if octet_length(p_submission::text) > 4250000 then
      raise exception using errcode = '54000', message = 'Contracts promotion submission exceeds the approved byte limit';
    end if;
    if v_planner_version <> 'contracts-promotion-planner.phase2.v1' then
      raise exception using errcode = '22023', message = 'Unsupported Contracts promotion planner version';
    end if;
    if v_submission_mode not in ('promotion', 'review_only') then
      raise exception using errcode = '22023', message = 'Unsupported Contracts submission mode';
    end if;
    if v_batch_key is null then
      raise exception using errcode = '23502', message = 'Review batch ID is required';
    end if;
    if v_document_version_id is null or v_document_version_id not like 'sha256:%' then
      raise exception using errcode = '22023', message = 'Authoritative document version is required';
    end if;
    if p_submission #>> '{reviewBatch,documentAuthority}' <> 'authoritative' then
      raise exception using errcode = '22023', message = 'Document authority is not approved';
    end if;
    select count(*)::integer into v_candidate_document_mismatch_count
      from jsonb_array_elements(coalesce(p_submission #> '{extraction,candidates}', '[]'::jsonb)) item
     where item ->> 'documentVersionId' is distinct from v_document_version_id;
    if v_candidate_document_mismatch_count <> 0 then
      raise exception using errcode = '22023', message = 'Candidate document identity does not match the authoritative version';
    end if;
    if coalesce((p_submission #>> '{plan,operationalWritesPerformed}')::boolean, true) then
      raise exception using errcode = '22023', message = 'Planner output already reports operational writes';
    end if;
    if jsonb_array_length(coalesce(p_submission #> '{plan,globalBlockers}', '[]'::jsonb)) <> 0 then
      raise exception using errcode = '22023', message = 'Planner output contains global blockers';
    end if;

    v_source_project_id := (p_submission #>> '{projectMapping,sourceProjectId}')::uuid;
    v_schedule_project_id := (p_submission #>> '{projectMapping,scheduleProjectId}')::uuid;

    select mapping.id
      into v_mapping_id
      from private.schedule_contract_project_mappings mapping
     where mapping.source_system = 'main'
       and mapping.source_project_id = v_source_project_id
       and mapping.schedule_project_id = v_schedule_project_id
       and mapping.status = 'active';
    if v_mapping_id is null then
      raise exception using errcode = '23503', message = 'No active approved MAIN-to-KAPAIM project mapping exists';
    end if;
    if p_submission #>> '{extraction,projectBinding,projectId}' <> v_source_project_id::text then
      raise exception using errcode = '22023', message = 'Extraction project binding does not match the approved mapping';
    end if;

    select * into v_existing_batch
      from private.schedule_contract_review_batches
     where batch_key = v_batch_key;
    if found then
      if v_existing_batch.payload_fingerprint <> v_fingerprint then
        raise exception using errcode = '23505', message = 'Review batch ID was reused with a different payload';
      end if;
      return v_existing_batch.result_snapshot;
    end if;

    select count(*)::integer into v_ready_count
      from jsonb_array_elements(coalesce(p_submission #> '{plan,candidatePlans}', '[]'::jsonb)) item
     where item ->> 'status' = 'transaction_ready';
    select count(*)::integer into v_rejected_count
      from jsonb_array_elements(coalesce(p_submission #> '{plan,candidatePlans}', '[]'::jsonb)) item
     where item ->> 'status' = 'rejected';
    select count(*)::integer into v_unsafe_blocked_count
     from jsonb_array_elements(coalesce(p_submission #> '{plan,candidatePlans}', '[]'::jsonb)) item
     where item ->> 'status' = 'blocked'
       and not (coalesce(item -> 'blockers', '[]'::jsonb) ? 'review_decision_missing');
    if v_unsafe_blocked_count <> 0 then
      raise exception using errcode = '22023', message = 'A reviewed candidate remains unsafe';
    end if;

    v_row_count :=
      jsonb_array_length(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_milestones}', '[]'::jsonb)) +
      jsonb_array_length(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_extensions}', '[]'::jsonb)) +
      jsonb_array_length(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_conditions}', '[]'::jsonb));
    if v_submission_mode = 'promotion' and (
      coalesce((p_submission #>> '{plan,transactionReady}')::boolean, false) is not true
      or v_ready_count = 0
      or v_row_count <> v_ready_count
    ) then
      raise exception using errcode = '22023', message = 'Promotion submission is not transaction ready';
    end if;
    if v_submission_mode = 'review_only' and (v_ready_count <> 0 or v_row_count <> 0 or v_rejected_count = 0) then
      raise exception using errcode = '22023', message = 'Review-only submission is inconsistent';
    end if;

    for v_row in
      select value from jsonb_array_elements(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_milestones}', '[]'::jsonb))
    loop
      if v_row ->> 'project_id' <> v_schedule_project_id::text or v_row ->> 'source_document_id' <> v_document_version_id then
        raise exception using errcode = '22023', message = 'Milestone row violates project or document binding';
      end if;
      v_target_id := null;
      insert into public.schedule_contract_milestones (
        project_id, milestone_key, name, contract_date, is_project_completion,
        activity_key, status, source_document_id, source_excerpt, confidence,
        written_by, extractor_version, metadata
      ) values (
        v_schedule_project_id, v_row ->> 'milestone_key', v_row ->> 'name', (v_row ->> 'contract_date')::date,
        coalesce((v_row ->> 'is_project_completion')::boolean, false), nullif(v_row ->> 'activity_key', ''),
        'active', v_document_version_id, v_row ->> 'source_excerpt', (v_row ->> 'confidence')::numeric,
        'contracts_agent_phase2_review', nullif(v_row ->> 'extractor_version', ''), coalesce(v_row -> 'metadata', '{}'::jsonb)
      ) on conflict (project_id, milestone_key) do nothing returning id into v_target_id;
      if v_target_id is null then
        select id, contract_date, source_document_id into v_existing
          from public.schedule_contract_milestones
         where project_id = v_schedule_project_id and milestone_key = v_row ->> 'milestone_key';
        if v_existing.contract_date is distinct from (v_row ->> 'contract_date')::date
           or v_existing.source_document_id is distinct from v_document_version_id then
          raise exception using errcode = '23505', message = 'Existing milestone conflicts with the reviewed contract fact';
        end if;
        v_target_id := v_existing.id;
      end if;
      v_promotions := v_promotions || jsonb_build_array(jsonb_build_object(
        'candidateKey', v_row #>> '{metadata,contracts_candidate_key}',
        'targetTable', 'schedule_contract_milestones',
        'targetId', v_target_id
      ));
    end loop;

    for v_row in
      select value from jsonb_array_elements(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_extensions}', '[]'::jsonb))
    loop
      if v_row ->> 'project_id' <> v_schedule_project_id::text or v_row ->> 'source_document_id' <> v_document_version_id then
        raise exception using errcode = '22023', message = 'Extension row violates project or document binding';
      end if;
      v_target_id := null;
      insert into public.schedule_contract_extensions (
        project_id, milestone_key, extension_days, approved_date, approved_by,
        status, source_document_id, source_excerpt, confidence, written_by, metadata
      ) values (
        v_schedule_project_id, v_row ->> 'milestone_key', (v_row ->> 'extension_days')::integer,
        (v_row ->> 'approved_date')::date, v_row ->> 'approved_by', 'approved',
        v_document_version_id, v_row ->> 'source_excerpt', (v_row ->> 'confidence')::numeric,
        'contracts_agent_phase2_review', coalesce(v_row -> 'metadata', '{}'::jsonb)
      ) on conflict (project_id, milestone_key, source_document_id, extension_days)
        where source_document_id is not null do nothing returning id into v_target_id;
      if v_target_id is null then
        select id, approved_date, status into v_existing
          from public.schedule_contract_extensions
         where project_id = v_schedule_project_id
           and milestone_key = v_row ->> 'milestone_key'
           and source_document_id = v_document_version_id
           and extension_days = (v_row ->> 'extension_days')::integer;
        if v_existing.approved_date is distinct from (v_row ->> 'approved_date')::date
           or v_existing.status is distinct from 'approved' then
          raise exception using errcode = '23505', message = 'Existing extension conflicts with the reviewed contract fact';
        end if;
        v_target_id := v_existing.id;
      end if;
      v_promotions := v_promotions || jsonb_build_array(jsonb_build_object(
        'candidateKey', v_row #>> '{metadata,contracts_candidate_key}',
        'targetTable', 'schedule_contract_extensions',
        'targetId', v_target_id
      ));
    end loop;

    for v_row in
      select value from jsonb_array_elements(coalesce(p_submission #> '{plan,rowsByTable,schedule_contract_conditions}', '[]'::jsonb))
    loop
      if v_row ->> 'project_id' <> v_schedule_project_id::text
         or v_row #>> '{metadata,document_version_id}' <> v_document_version_id then
        raise exception using errcode = '22023', message = 'Condition row violates project or document binding';
      end if;
      v_target_id := null;
      insert into public.schedule_contract_conditions (
        project_id, condition_key, name, category, anchor_kind, anchor_description,
        offset_value, offset_unit, recurring, status, resolved_milestone_key,
        trigger_source_table, trigger_source_id, trigger_event_date,
        is_project_completion, penalty_ils_per_day, source_page, source_excerpt,
        confidence, written_by, metadata
      ) values (
        v_schedule_project_id, v_row ->> 'condition_key', v_row ->> 'name', v_row ->> 'category',
        coalesce(nullif(v_row ->> 'anchor_kind', ''), 'event'), v_row ->> 'anchor_description',
        (v_row ->> 'offset_value')::numeric, v_row ->> 'offset_unit',
        coalesce((v_row ->> 'recurring')::boolean, false), 'pending', null, null, null, null,
        coalesce((v_row ->> 'is_project_completion')::boolean, false),
        nullif(v_row ->> 'penalty_ils_per_day', '')::numeric,
        nullif(v_row ->> 'source_page', '')::integer, v_row ->> 'source_excerpt',
        (v_row ->> 'confidence')::numeric, 'contracts_agent_phase2_review', coalesce(v_row -> 'metadata', '{}'::jsonb)
      ) on conflict (project_id, condition_key) do nothing returning id into v_target_id;
      if v_target_id is null then
        select id, anchor_description, offset_value, offset_unit into v_existing
          from public.schedule_contract_conditions
         where project_id = v_schedule_project_id and condition_key = v_row ->> 'condition_key';
        if v_existing.anchor_description is distinct from v_row ->> 'anchor_description'
           or v_existing.offset_value is distinct from (v_row ->> 'offset_value')::numeric
           or v_existing.offset_unit is distinct from v_row ->> 'offset_unit' then
          raise exception using errcode = '23505', message = 'Existing condition conflicts with the reviewed contract fact';
        end if;
        v_target_id := v_existing.id;
      end if;
      v_promotions := v_promotions || jsonb_build_array(jsonb_build_object(
        'candidateKey', v_row #>> '{metadata,contracts_candidate_key}',
        'targetTable', 'schedule_contract_conditions',
        'targetId', v_target_id
      ));
    end loop;

    v_result := jsonb_build_object(
      'status', case when v_submission_mode = 'promotion' then 'committed' else 'reviewed_no_promotion' end,
      'batchId', v_batch_key,
      'promotedCount', jsonb_array_length(v_promotions),
      'promotions', v_promotions
    );

    insert into private.schedule_contract_review_batches (
      batch_key, payload_fingerprint, submission_version, planner_version,
      submission_mode, transaction_status, document_version_id,
      source_project_id, schedule_project_id, mapping_id, reviewer_id,
      reviewed_at, review_reason, extractor_version, extraction_snapshot,
      review_snapshot, planner_snapshot, result_snapshot
    ) values (
      v_batch_key, v_fingerprint, v_submission_version, v_planner_version,
      v_submission_mode, v_result ->> 'status', v_document_version_id,
      v_source_project_id, v_schedule_project_id, v_mapping_id,
      (p_submission #>> '{reviewBatch,reviewerId}')::uuid,
      (p_submission #>> '{reviewBatch,reviewedAt}')::timestamptz,
      p_submission #>> '{reviewBatch,reason}', nullif(p_submission #>> '{reviewBatch,extractorVersion}', ''),
      p_submission -> 'extraction', p_submission -> 'reviewBatch',
      p_submission -> 'plan', v_result
    ) returning id into v_review_batch_id;

    for v_audit in
      select value from jsonb_array_elements(coalesce(p_submission #> '{plan,audit}', '[]'::jsonb))
    loop
      select value into v_candidate_snapshot
        from jsonb_array_elements(coalesce(p_submission #> '{extraction,candidates}', '[]'::jsonb))
       where value ->> 'candidateKey' = v_audit ->> 'candidateKey' limit 1;
      select value into v_decision_snapshot
        from jsonb_array_elements(coalesce(p_submission #> '{reviewBatch,decisions}', '[]'::jsonb))
       where value ->> 'candidateKey' = v_audit ->> 'candidateKey' limit 1;
      if v_candidate_snapshot is null or v_decision_snapshot is null then
        raise exception using errcode = '22023', message = 'Audit candidate or reviewer decision snapshot is missing';
      end if;
      v_conflict_group_id := nullif(v_candidate_snapshot ->> 'conflictGroupId', '');
      v_conflict_snapshot := null;
      if v_conflict_group_id is not null then
        select value into v_conflict_snapshot
          from jsonb_array_elements(coalesce(p_submission #> '{extraction,conflicts}', '[]'::jsonb))
         where value ->> 'conflictGroupId' = v_conflict_group_id limit 1;
      end if;
      v_target_id := null;
      select (value ->> 'targetId')::uuid into v_target_id
        from jsonb_array_elements(v_promotions)
       where value ->> 'candidateKey' = v_audit ->> 'candidateKey' limit 1;
      insert into private.schedule_contract_review_decisions (
        review_batch_id, candidate_key, action, outcome, target_table,
        target_row_id, reason, candidate_snapshot, decision_snapshot, conflict_snapshot
      ) values (
        v_review_batch_id, v_audit ->> 'candidateKey', v_audit ->> 'action',
        v_audit ->> 'outcome', nullif(v_audit ->> 'targetTable', ''), v_target_id,
        coalesce(nullif(v_audit ->> 'reason', ''), p_submission #>> '{reviewBatch,reason}'),
        v_candidate_snapshot, v_decision_snapshot, v_conflict_snapshot
      );
    end loop;

    insert into private.schedule_contract_promotion_attempts (
      batch_key, payload_fingerprint, status, promoted_count, result_snapshot
    ) values (
      v_batch_key, v_fingerprint, v_result ->> 'status', jsonb_array_length(v_promotions), v_result
    );
    return v_result;
  exception when others then
    get stacked diagnostics v_error_code = returned_sqlstate, v_error_message = message_text;
    v_result := jsonb_build_object(
      'status', 'failed',
      'batchId', v_batch_key,
      'errorCode', v_error_code,
      'promotedCount', 0,
      'promotions', '[]'::jsonb
    );
    insert into private.schedule_contract_promotion_attempts (
      batch_key, payload_fingerprint, status, error_code, error_message,
      promoted_count, result_snapshot
    ) values (
      v_batch_key, v_fingerprint, 'failed', v_error_code, left(v_error_message, 1000), 0, v_result
    );
    return v_result;
  end;
end;
$$;

revoke all privileges on table
  private.schedule_contract_project_mappings,
  private.schedule_contract_review_batches,
  private.schedule_contract_review_decisions,
  private.schedule_contract_promotion_attempts
from public, anon, authenticated;
grant select, insert, update on table private.schedule_contract_project_mappings to service_role;
grant select, insert on table private.schedule_contract_review_batches to service_role;
grant select, insert on table private.schedule_contract_review_decisions to service_role;
grant select, insert on table private.schedule_contract_promotion_attempts to service_role;

-- Existing RLS remains enabled. These revocations remove direct browser-role
-- mutations while preserving the current service-role Schedule integrations.
revoke insert, update, delete on table public.schedule_contract_milestones from anon, authenticated;
revoke insert, update, delete on table public.schedule_contract_extensions from anon, authenticated;
revoke insert, update, delete on table public.schedule_contract_conditions from anon, authenticated;
grant select, insert on table public.schedule_contract_milestones to service_role;
grant select, insert on table public.schedule_contract_extensions to service_role;
grant select, insert on table public.schedule_contract_conditions to service_role;

revoke execute on function public.bidoc_contracts_promote_review_v1(jsonb) from public, anon, authenticated;
grant execute on function public.bidoc_contracts_promote_review_v1(jsonb) to service_role;

notify pgrst, 'reload schema';
