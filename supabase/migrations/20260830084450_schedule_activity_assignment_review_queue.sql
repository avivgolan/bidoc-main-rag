-- Shared Schedule assignment review queue in MAIN.
-- The browser never receives table privileges; authenticated same-origin API
-- routes use the server-owned MAIN service key and keep cross-database schedule
-- identifiers as immutable text/UUID references without unsafe foreign keys.

create table public.schedule_activity_assignment_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  source_project_id uuid not null,
  schedule_project_id uuid not null,
  source_table text not null default 'alerts',
  source_id text not null,
  source_event_date date not null,
  event_snapshot jsonb not null default '{}'::jsonb,
  decision_snapshot jsonb not null default '{}'::jsonb,
  candidates_snapshot jsonb not null default '[]'::jsonb,
  audit_persisted boolean not null default false,
  status text not null default 'pending',
  selected_activity_key text,
  created_by text,
  resolved_by text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint schedule_activity_assignment_reviews_source_ck
    check (source_table = 'alerts' and source_id <> '' and length(source_id) <= 160),
  constraint schedule_activity_assignment_reviews_status_ck
    check (status in ('pending', 'selected', 'rejected', 'superseded')),
  constraint schedule_activity_assignment_reviews_activity_ck
    check (selected_activity_key is null or selected_activity_key like 'gantt:%'),
  constraint schedule_activity_assignment_reviews_event_ck
    check (jsonb_typeof(event_snapshot) = 'object'),
  constraint schedule_activity_assignment_reviews_decision_ck
    check (jsonb_typeof(decision_snapshot) = 'object'),
  constraint schedule_activity_assignment_reviews_candidates_ck
    check (jsonb_typeof(candidates_snapshot) = 'array'),
  constraint schedule_activity_assignment_reviews_resolution_ck
    check (
      (status = 'pending' and resolved_at is null)
      or (status <> 'pending' and resolved_at is not null)
    )
);

comment on table public.schedule_activity_assignment_reviews is
  'MAIN-owned collaborative queue of Schedule assignment-agent decisions awaiting a teammate review.';
comment on column public.schedule_activity_assignment_reviews.schedule_project_id is
  'Cross-database Schedule project identity; intentionally has no MAIN projects foreign key.';
comment on column public.schedule_activity_assignment_reviews.candidates_snapshot is
  'Bounded candidate snapshots needed to reconstruct the reviewer card after reload; no provider secrets or prompts.';

create index schedule_activity_assignment_reviews_project_status_idx
  on public.schedule_activity_assignment_reviews (source_project_id, status, created_at desc);
create index schedule_activity_assignment_reviews_schedule_status_idx
  on public.schedule_activity_assignment_reviews (schedule_project_id, status, created_at desc);
create index schedule_activity_assignment_reviews_source_idx
  on public.schedule_activity_assignment_reviews (source_project_id, source_table, source_id, created_at desc);

alter table public.schedule_activity_assignment_reviews enable row level security;

create or replace function public.bidoc_upsert_schedule_assignment_review_v1(
  p_run_id uuid,
  p_source_project_id uuid,
  p_schedule_project_id uuid,
  p_source_id text,
  p_source_event_date date,
  p_event_snapshot jsonb,
  p_decision_snapshot jsonb,
  p_candidates_snapshot jsonb,
  p_audit_persisted boolean,
  p_created_by text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review_id uuid;
begin
  if p_run_id is null or p_source_project_id is null or p_schedule_project_id is null then
    raise exception 'run and project identities are required';
  end if;
  if nullif(btrim(coalesce(p_source_id, '')), '') is null or length(p_source_id) > 160 then
    raise exception 'source_id is required';
  end if;
  if p_source_event_date is null then
    raise exception 'source_event_date is required';
  end if;
  if jsonb_typeof(coalesce(p_event_snapshot, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_decision_snapshot, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_candidates_snapshot, '[]'::jsonb)) <> 'array' then
    raise exception 'review snapshots are invalid';
  end if;

  update public.schedule_activity_assignment_reviews
  set status = 'superseded',
      resolved_at = now(),
      updated_at = now(),
      resolution_note = 'Superseded by a newer assignment-agent run'
  where source_project_id = p_source_project_id
    and source_table = 'alerts'
    and source_id = p_source_id
    and status = 'pending'
    and run_id <> p_run_id;

  insert into public.schedule_activity_assignment_reviews as existing_review (
    run_id, source_project_id, schedule_project_id, source_table, source_id,
    source_event_date, event_snapshot, decision_snapshot, candidates_snapshot,
    audit_persisted, status, created_by
  ) values (
    p_run_id, p_source_project_id, p_schedule_project_id, 'alerts', p_source_id,
    p_source_event_date, coalesce(p_event_snapshot, '{}'::jsonb),
    coalesce(p_decision_snapshot, '{}'::jsonb), coalesce(p_candidates_snapshot, '[]'::jsonb),
    coalesce(p_audit_persisted, false), 'pending', nullif(left(coalesce(p_created_by, ''), 300), '')
  )
  on conflict (run_id) do update
  set event_snapshot = excluded.event_snapshot,
      decision_snapshot = excluded.decision_snapshot,
      candidates_snapshot = excluded.candidates_snapshot,
      audit_persisted = excluded.audit_persisted,
      updated_at = now()
  where existing_review.status = 'pending'
  returning id into v_review_id;

  if v_review_id is null then
    select id into v_review_id
    from public.schedule_activity_assignment_reviews
    where run_id = p_run_id;
  end if;
  return v_review_id;
end;
$$;

create or replace function public.bidoc_resolve_schedule_assignment_reviews_v1(
  p_source_project_id uuid,
  p_source_id text,
  p_status text,
  p_activity_key text default null,
  p_resolved_by text default null,
  p_note text default null
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_status not in ('selected', 'rejected') then
    raise exception 'unsupported review resolution';
  end if;
  if p_status = 'selected' and (p_activity_key is null or p_activity_key not like 'gantt:%') then
    raise exception 'selected activity key is required';
  end if;

  update public.schedule_activity_assignment_reviews
  set status = p_status,
      selected_activity_key = case when p_status = 'selected' then p_activity_key else null end,
      resolved_by = nullif(left(coalesce(p_resolved_by, ''), 300), ''),
      resolution_note = nullif(left(coalesce(p_note, ''), 1000), ''),
      resolved_at = now(),
      updated_at = now()
  where source_project_id = p_source_project_id
    and source_table = 'alerts'
    and source_id = p_source_id
    and status = 'pending';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on table public.schedule_activity_assignment_reviews from public, anon, authenticated;
revoke all on function public.bidoc_upsert_schedule_assignment_review_v1(uuid, uuid, uuid, text, date, jsonb, jsonb, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.bidoc_resolve_schedule_assignment_reviews_v1(uuid, text, text, text, text, text) from public, anon, authenticated;

grant select, insert, update, delete on table public.schedule_activity_assignment_reviews to service_role;
grant execute on function public.bidoc_upsert_schedule_assignment_review_v1(uuid, uuid, uuid, text, date, jsonb, jsonb, jsonb, boolean, text) to service_role;
grant execute on function public.bidoc_resolve_schedule_assignment_reviews_v1(uuid, text, text, text, text, text) to service_role;
