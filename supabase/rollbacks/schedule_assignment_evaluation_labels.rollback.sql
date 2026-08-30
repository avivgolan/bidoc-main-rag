begin;

do $$
begin
  if exists (
    select 1
    from public.schedule_activity_assignment_reviews
    where evaluation_label_type is not null
  ) then
    raise exception 'Refusing rollback: Schedule assignment evaluation labels already exist';
  end if;
end
$$;

drop function if exists public.bidoc_resolve_schedule_assignment_review_label_v1(
  uuid, text, text, text, jsonb, text, text
);

drop index if exists public.schedule_activity_assignment_reviews_label_idx;

alter table public.schedule_activity_assignment_reviews
  drop constraint if exists schedule_activity_assignment_reviews_label_shape_ck,
  drop constraint if exists schedule_activity_assignment_reviews_forbidden_ck,
  drop constraint if exists schedule_activity_assignment_reviews_label_type_ck,
  drop column if exists labelled_at,
  drop column if exists labelled_by,
  drop column if exists evaluation_label_reason,
  drop column if exists forbidden_activity_keys,
  drop column if exists expected_activity_key,
  drop column if exists evaluation_label_type;

commit;
