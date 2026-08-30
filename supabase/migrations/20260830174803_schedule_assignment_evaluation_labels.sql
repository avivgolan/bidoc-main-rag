-- Add explicit human evaluation labels to the existing MAIN Schedule review queue.
-- This migration is additive. Existing operational resolutions remain valid but
-- do not become calibration evidence unless a reviewer supplied an explicit label.

alter table public.schedule_activity_assignment_reviews
  add column if not exists evaluation_label_type text,
  add column if not exists expected_activity_key text,
  add column if not exists forbidden_activity_keys jsonb not null default '[]'::jsonb,
  add column if not exists evaluation_label_reason text,
  add column if not exists labelled_by text,
  add column if not exists labelled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_activity_assignment_reviews_label_type_ck'
      and conrelid = 'public.schedule_activity_assignment_reviews'::regclass
  ) then
    alter table public.schedule_activity_assignment_reviews
      add constraint schedule_activity_assignment_reviews_label_type_ck
      check (
        evaluation_label_type is null
        or evaluation_label_type in (
          'confirmed_match', 'rejected_match', 'no_match',
          'stale_activity', 'irrelevant_alert', 'ambiguous'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_activity_assignment_reviews_forbidden_ck'
      and conrelid = 'public.schedule_activity_assignment_reviews'::regclass
  ) then
    alter table public.schedule_activity_assignment_reviews
      add constraint schedule_activity_assignment_reviews_forbidden_ck
      check (jsonb_typeof(forbidden_activity_keys) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_activity_assignment_reviews_label_shape_ck'
      and conrelid = 'public.schedule_activity_assignment_reviews'::regclass
  ) then
    alter table public.schedule_activity_assignment_reviews
      add constraint schedule_activity_assignment_reviews_label_shape_ck
      check (
        evaluation_label_type is null
        or (
          evaluation_label_reason is not null
          and labelled_at is not null
          and (
            (
              evaluation_label_type = 'confirmed_match'
              and status = 'selected'
              and expected_activity_key like 'gantt:%'
              and jsonb_array_length(forbidden_activity_keys) = 0
            )
            or (
              evaluation_label_type <> 'confirmed_match'
              and status = 'rejected'
              and expected_activity_key is null
              and (
                evaluation_label_type not in ('rejected_match', 'stale_activity')
                or jsonb_array_length(forbidden_activity_keys) > 0
              )
            )
          )
        )
      );
  end if;
end
$$;

comment on column public.schedule_activity_assignment_reviews.evaluation_label_type is
  'Explicit reviewer label for offline Schedule assignment evaluation. Null operational resolutions are not calibration evidence.';
comment on column public.schedule_activity_assignment_reviews.forbidden_activity_keys is
  'Server-validated rejected or stale Gantt activities. Never populated from untrusted browser keys.';

create index if not exists schedule_activity_assignment_reviews_label_idx
  on public.schedule_activity_assignment_reviews
  (source_project_id, evaluation_label_type, labelled_at desc)
  where evaluation_label_type is not null;

create or replace function public.bidoc_resolve_schedule_assignment_review_label_v1(
  p_source_project_id uuid,
  p_source_id text,
  p_label_type text,
  p_expected_activity_key text,
  p_forbidden_activity_keys jsonb,
  p_resolved_by text,
  p_reason text
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_status text;
  v_forbidden jsonb := coalesce(p_forbidden_activity_keys, '[]'::jsonb);
begin
  if p_label_type not in (
    'confirmed_match', 'rejected_match', 'no_match',
    'stale_activity', 'irrelevant_alert', 'ambiguous'
  ) then
    raise exception 'unsupported Schedule assignment evaluation label';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reviewed Schedule assignment label requires a reason';
  end if;
  if jsonb_typeof(v_forbidden) <> 'array' then
    raise exception 'forbidden activity keys must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_forbidden) as forbidden(value)
    where forbidden.value not like 'gantt:%'
  ) then
    raise exception 'forbidden activity keys must identify Gantt activities';
  end if;
  if p_label_type = 'confirmed_match' then
    if p_expected_activity_key is null or p_expected_activity_key not like 'gantt:%' then
      raise exception 'confirmed_match requires an expected Gantt activity';
    end if;
    if jsonb_array_length(v_forbidden) <> 0 then
      raise exception 'confirmed_match cannot contain forbidden activities';
    end if;
    v_status := 'selected';
  else
    if p_expected_activity_key is not null then
      raise exception 'negative labels cannot contain an expected activity';
    end if;
    if p_label_type in ('rejected_match', 'stale_activity') and jsonb_array_length(v_forbidden) = 0 then
      raise exception 'rejected_match and stale_activity require a forbidden activity';
    end if;
    v_status := 'rejected';
  end if;

  update public.schedule_activity_assignment_reviews
  set status = v_status,
      selected_activity_key = case when v_status = 'selected' then p_expected_activity_key else null end,
      evaluation_label_type = p_label_type,
      expected_activity_key = case when v_status = 'selected' then p_expected_activity_key else null end,
      forbidden_activity_keys = v_forbidden,
      evaluation_label_reason = left(p_reason, 1200),
      labelled_by = nullif(left(coalesce(p_resolved_by, ''), 300), ''),
      labelled_at = now(),
      resolved_by = nullif(left(coalesce(p_resolved_by, ''), 300), ''),
      resolution_note = left(p_reason, 1000),
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

revoke all on function public.bidoc_resolve_schedule_assignment_review_label_v1(uuid, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.bidoc_resolve_schedule_assignment_review_label_v1(uuid, text, text, text, jsonb, text, text)
  to service_role;
