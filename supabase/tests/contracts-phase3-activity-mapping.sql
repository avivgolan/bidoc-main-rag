-- Phase 3C isolated SQL contract tests. These fixtures use synthetic identities
-- and run only in the dedicated local Supabase/PostgreSQL container.

insert into public.projects (id, name)
values ('22222222-2222-4222-8222-222222222222'::uuid, 'Contracts Phase 3 local fixture');

insert into private.schedule_contract_project_mappings (
  id, source_project_id, schedule_project_id, approved_by, approved_at, reason
) values (
  '33333333-3333-4333-8333-333333333333'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid,
  'phase3-isolated-security-owner',
  '2026-08-11T12:00:00Z'::timestamptz,
  'Explicit synthetic project mapping for isolated Phase 3 database tests.'
);

create or replace function pg_temp.phase3_submission(
  p_event_key text,
  p_action text,
  p_candidate_key text,
  p_milestone_key text,
  p_schedule_file text,
  p_activity_key text,
  p_previous_activity_key text,
  p_task_uid integer,
  p_canonical_key text,
  p_confidence numeric,
  p_reviewer_id uuid,
  p_supersedes_event_id uuid,
  p_alternatives jsonb,
  p_conflict jsonb,
  p_conflict_resolved boolean,
  p_version_conflict boolean
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'submissionVersion', 'contracts-activity-mapping-review.phase3.v1',
    'eventKey', p_event_key,
    'projectContext', jsonb_build_object(
      'sourceSystem', 'main',
      'sourceProjectId', '11111111-1111-4111-8111-111111111111',
      'scheduleProjectId', '22222222-2222-4222-8222-222222222222',
      'projectMappingId', '33333333-3333-4333-8333-333333333333',
      'mappingStatus', 'active'
    ),
    'obligation', jsonb_build_object(
      'documentVersionId', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'candidateKey', p_candidate_key,
      'milestoneKey', p_milestone_key
    ),
    'scheduleVersion', jsonb_build_object(
      'fileId', p_schedule_file,
      'versionConflict', p_version_conflict
    ),
    'decision', jsonb_build_object(
      'action', p_action,
      'canonicalKey', p_canonical_key,
      'activityKey', p_activity_key,
      'previousActivityKey', p_previous_activity_key,
      'taskUid', p_task_uid,
      'matchMethod', null,
      'confidence', p_confidence,
      'alternatives', p_alternatives,
      'evidence', jsonb_build_array(jsonb_build_object(
        'kind', 'isolated_fixture',
        'source', 'contracts-phase3-activity-mapping.sql'
      )),
      'conflict', p_conflict,
      'conflictResolved', p_conflict_resolved,
      'reviewerId', p_reviewer_id,
      'reviewedAt', '2026-08-11T12:30:00Z',
      'reason', 'Reviewed against the synthetic authoritative contract and exact Schedule fixture.',
      'supersedesEventId', p_supersedes_event_id
    )
  );
$$;

set role service_role;

create temporary table phase3_test_state (
  key text primary key,
  value text not null
);

do $test$
declare
  context_result jsonb;
begin
  context_result := public.bidoc_contracts_resolve_mapping_context_v1(
    '11111111-1111-4111-8111-111111111111'::uuid
  );
  if context_result ->> 'sourceProjectId' <> '11111111-1111-4111-8111-111111111111'
     or context_result ->> 'scheduleProjectId' <> '22222222-2222-4222-8222-222222222222'
     or context_result ->> 'projectMappingId' <> '33333333-3333-4333-8333-333333333333'
     or context_result ->> 'mappingStatus' <> 'active' then
    raise exception 'Project-context resolver returned an unexpected contract: %', context_result;
  end if;
end;
$test$;

do $test$
declare
  submission jsonb;
  result jsonb;
begin
  submission := pg_temp.phase3_submission(
    'phase3-confirm-1',
    'confirm',
    'candidate:structural-framing',
    'milestone:structural-framing',
    '1776105870763_03.12.25.xml',
    'gantt:1776105870763_03.12.25.xml:17',
    null,
    17,
    null,
    0.91,
    '44444444-4444-4444-8444-444444444444'::uuid,
    null,
    '[{"activityKey":"gantt:1776105870763_03.12.25.xml:17"}]'::jsonb,
    null,
    false,
    false
  );
  result := public.bidoc_contracts_review_activity_mapping_v1(submission);
  if result ->> 'status' <> 'recorded'
     or result ->> 'mappingStatus' <> 'manually_confirmed'
     or (result ->> 'mappingRowsChanged')::integer <> 4
     or result ->> 'canonicalKey' !~ '^schedule-activity:' then
    raise exception 'Manual confirmation returned an unexpected result: %', result;
  end if;
  insert into phase3_test_state (key, value) values
    ('canonical_1', result ->> 'canonicalKey'),
    ('confirm_event_id', result ->> 'eventId'),
    ('confirm_result', result::text);

  if public.bidoc_contracts_review_activity_mapping_v1(submission) is distinct from result then
    raise exception 'Identical mapping event retry was not idempotent';
  end if;
end;
$test$;

do $test$
declare
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_1');
begin
  if (select count(*) from public.schedule_activity_map where project_id = '22222222-2222-4222-8222-222222222222' and canonical_key = v_canonical_key) <> 4 then
    raise exception 'Manual confirmation did not create the four required aliases';
  end if;
  if exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and (
        status <> 'manually_confirmed'
        or confirmed_by <> '44444444-4444-4444-8444-444444444444'::uuid
        or confirmed_at is null
      )
  ) then
    raise exception 'Manual alias confirmation fields are inconsistent';
  end if;
  if (select count(*) from private.schedule_activity_mapping_review_events where event_key = 'phase3-confirm-1') <> 1 then
    raise exception 'Manual mapping event was not stored exactly once';
  end if;
end;
$test$;

do $test$
declare
  submission jsonb;
  changed_submission jsonb;
  rejected boolean := false;
begin
  submission := pg_temp.phase3_submission(
    'phase3-confirm-1', 'confirm', 'candidate:structural-framing', 'milestone:structural-framing',
    '1776105870763_03.12.25.xml', 'gantt:1776105870763_03.12.25.xml:17', null, 17, null, 0.91,
    '44444444-4444-4444-8444-444444444444'::uuid, null,
    '[{"activityKey":"gantt:1776105870763_03.12.25.xml:17"}]'::jsonb, null, false, false
  );
  changed_submission := jsonb_set(
    submission,
    '{decision,reason}',
    to_jsonb('A changed payload must never reuse an immutable event key.'::text)
  );
  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(changed_submission);
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Changed payload reused an immutable event key';
  end if;
end;
$test$;

do $test$
declare
  rejected_same_version boolean := false;
  rejected_changed_uid boolean := false;
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_1');
begin
  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
      'phase3-auto-same-version', 'auto_continue', 'candidate:structural-framing', 'milestone:structural-framing',
      '1781010000000_01.08.26.xml', 'gantt:1781010000000_01.08.26.xml:18',
      'gantt:1781010000000_01.08.26.xml:17', 18, v_canonical_key, 0.97, null,
      (select value::uuid from phase3_test_state where key = 'confirm_event_id'),
      '[{"activityKey":"gantt:1781010000000_01.08.26.xml:18"}]'::jsonb, null, false, false
    ));
  exception when invalid_parameter_value then
    rejected_same_version := true;
  end;

  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
      'phase3-auto-changed-uid', 'auto_continue', 'candidate:structural-framing', 'milestone:structural-framing',
      '1790000000000_01.09.26.xml', 'gantt:1790000000000_01.09.26.xml:18',
      'gantt:1781010000000_01.08.26.xml:17', 18, v_canonical_key, 0.97, null,
      (select value::uuid from phase3_test_state where key = 'confirm_event_id'),
      '[{"activityKey":"gantt:1790000000000_01.09.26.xml:18"}]'::jsonb, null, false, false
    ));
  exception when invalid_parameter_value then
    rejected_changed_uid := true;
  end;

  if not rejected_same_version
     or not rejected_changed_uid
     or exists (
       select 1 from private.schedule_activity_mapping_review_events
       where event_key in ('phase3-auto-same-version', 'phase3-auto-changed-uid')
     )
     or exists (
       select 1 from public.schedule_activity_map
       where alias in (
         'gantt:1781010000000_01.08.26.xml:18',
         'gantt:1790000000000_01.09.26.xml:18'
       )
     ) then
    raise exception 'Same-version or changed-UID automatic continuation did not fail atomically';
  end if;
end;
$test$;

do $test$
declare
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_1');
  result jsonb;
begin
  result := public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
    'phase3-auto-1',
    'auto_continue',
    'candidate:structural-framing',
    'milestone:structural-framing',
    '1781010000000_01.08.26.xml',
    'gantt:1781010000000_01.08.26.xml:17',
    'gantt:1776105870763_03.12.25.xml:17',
    17,
    v_canonical_key,
    0.97,
    null,
    (select value::uuid from phase3_test_state where key = 'confirm_event_id'),
    '[{"activityKey":"gantt:1781010000000_01.08.26.xml:17"}]'::jsonb,
    null,
    false,
    false
  ));
  if result ->> 'mappingStatus' <> 'auto_confirmed'
     or (result ->> 'mappingRowsChanged')::integer <> 1 then
    raise exception 'Exact continuation returned an unexpected result: %', result;
  end if;
  insert into phase3_test_state (key, value) values ('auto_event_id', result ->> 'eventId');
  if not exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and alias = 'gantt:1781010000000_01.08.26.xml:17'
      and status = 'auto_confirmed'
      and confidence = 0.97
      and confirmed_by is null
      and confirmed_at is not null
  ) then
    raise exception 'Exact continuation did not create an eligible current alias';
  end if;
  if not exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and alias = 'gantt:1776105870763_03.12.25.xml:17'
      and status = 'manually_confirmed'
  ) then
    raise exception 'Exact continuation changed the prior version alias';
  end if;
end;
$test$;

do $test$
declare
  rejected boolean := false;
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_1');
begin
  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
      'phase3-auto-low', 'auto_continue', 'candidate:structural-framing', 'milestone:structural-framing',
      '1790000000000_01.09.26.xml', 'gantt:1790000000000_01.09.26.xml:17',
      'gantt:1781010000000_01.08.26.xml:17', 17, v_canonical_key, 0.94, null,
      (select value::uuid from phase3_test_state where key = 'auto_event_id'),
      '[{"activityKey":"gantt:1790000000000_01.09.26.xml:17"}]'::jsonb, null, false, false
    ));
  exception when invalid_parameter_value then
    rejected := true;
  end;
  if not rejected
     or exists (select 1 from private.schedule_activity_mapping_review_events where event_key = 'phase3-auto-low')
     or exists (select 1 from public.schedule_activity_map where alias = 'gantt:1790000000000_01.09.26.xml:17') then
    raise exception 'Sub-threshold automatic continuation did not fail atomically';
  end if;
end;
$test$;

do $test$
declare
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_1');
  result jsonb;
begin
  result := public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
    'phase3-correct-1',
    'correct',
    'candidate:structural-framing',
    'milestone:structural-framing',
    '1781010000000_01.08.26.xml',
    'gantt:1781010000000_01.08.26.xml:18',
    null,
    18,
    v_canonical_key,
    0.88,
    '44444444-4444-4444-8444-444444444444'::uuid,
    (select value::uuid from phase3_test_state where key = 'auto_event_id'),
    '[{"activityKey":"gantt:1781010000000_01.08.26.xml:18"},{"activityKey":"gantt:1781010000000_01.08.26.xml:17"}]'::jsonb,
    '{"type":"ambiguous_candidates"}'::jsonb,
    true,
    false
  ));
  if result ->> 'mappingStatus' <> 'manually_confirmed'
     or (result ->> 'mappingRowsChanged')::integer <> 4 then
    raise exception 'Correction returned an unexpected result: %', result;
  end if;
  if (select count(*) from public.schedule_activity_map
      where canonical_key = v_canonical_key
        and alias_source = 'gantt_activity_key'
        and left(alias, length('gantt:1781010000000_01.08.26.xml:')) = 'gantt:1781010000000_01.08.26.xml:'
        and status in ('manually_confirmed', 'auto_confirmed')) <> 1 then
    raise exception 'Correction left more than one confirmed alias in the current version';
  end if;
  if not exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and alias = 'gantt:1781010000000_01.08.26.xml:17'
      and status = 'rejected'
      and confirmed_by is null
      and confirmed_at is null
  ) then
    raise exception 'Correction did not preserve and demote the prior current-version alias';
  end if;
  if not exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and alias_source = 'gantt_task_uid'
      and alias = '17'
      and status = 'rejected'
  ) or not exists (
    select 1 from public.schedule_activity_map
    where canonical_key = v_canonical_key
      and alias_source = 'gantt_task_uid'
      and alias = '18'
      and status = 'manually_confirmed'
  ) then
    raise exception 'Correction did not replace the stable UID continuity signal';
  end if;
  if not exists (
    select 1 from private.schedule_activity_mapping_review_events
    where event_key = 'phase3-correct-1'
      and action = 'correct'
      and supersedes_event_id = (select value::uuid from phase3_test_state where key = 'auto_event_id')
      and conflict_snapshot = '{"type":"ambiguous_candidates"}'::jsonb
  ) then
    raise exception 'Correction audit did not preserve supersession and conflict evidence';
  end if;
end;
$test$;

do $test$
declare
  result jsonb;
begin
  result := public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
    'phase3-confirm-other', 'confirm', 'candidate:other', null,
    '1776105870763_03.12.25.xml', 'gantt:1776105870763_03.12.25.xml:50', null, 50, null, 0.86,
    '44444444-4444-4444-8444-444444444444'::uuid, null,
    '[{"activityKey":"gantt:1776105870763_03.12.25.xml:50"}]'::jsonb, null, false, false
  ));
  insert into phase3_test_state (key, value) values ('canonical_2', result ->> 'canonicalKey');
end;
$test$;

do $test$
declare
  rejected boolean := false;
  v_canonical_key text := (select value from phase3_test_state where key = 'canonical_2');
begin
  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
      'phase3-conflicting-winner', 'confirm', 'candidate:other', null,
      '1781010000000_01.08.26.xml', 'gantt:1781010000000_01.08.26.xml:18', null, 18,
      v_canonical_key, 0.9, '44444444-4444-4444-8444-444444444444'::uuid, null,
      '[{"activityKey":"gantt:1781010000000_01.08.26.xml:18"}]'::jsonb, null, false, false
    ));
  exception when unique_violation then
    rejected := true;
  end;
  if not rejected
     or exists (select 1 from private.schedule_activity_mapping_review_events where event_key = 'phase3-conflicting-winner') then
    raise exception 'A second confirmed canonical winner was not rejected atomically';
  end if;
end;
$test$;

do $test$
declare
  reject_result jsonb;
  unmapped_result jsonb;
begin
  reject_result := public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
    'phase3-reject-1', 'reject', 'candidate:rejected', null,
    '1781010000000_01.08.26.xml', null, null, null, null, 0.62,
    '44444444-4444-4444-8444-444444444444'::uuid, null,
    '[{"activityKey":"gantt:1781010000000_01.08.26.xml:90"}]'::jsonb,
    '{"type":"ambiguous_candidates"}'::jsonb, false, false
  ));
  unmapped_result := public.bidoc_contracts_review_activity_mapping_v1(pg_temp.phase3_submission(
    'phase3-unmapped-1', 'unmapped', 'candidate:unmapped', null,
    '1781010000000_01.08.26.xml', null, null, null, null, 0,
    '44444444-4444-4444-8444-444444444444'::uuid, null,
    '[]'::jsonb, null, false, false
  ));
  if reject_result ->> 'mappingStatus' is not null
     or unmapped_result ->> 'mappingStatus' is not null
     or exists (
       select 1 from public.schedule_activity_map
       where alias_source = 'contracts_candidate'
         and alias in ('candidate:rejected', 'candidate:unmapped')
     ) then
    raise exception 'Reject or unmapped decision created operational mapping state';
  end if;
end;
$test$;

do $test$
declare
  rejected boolean := false;
  submission jsonb;
begin
  submission := pg_temp.phase3_submission(
    'phase3-version-conflict', 'confirm', 'candidate:conflict', null,
    '1781010000000_01.08.26.xml', 'gantt:1781010000000_01.08.26.xml:77', null, 77, null, 0.9,
    '44444444-4444-4444-8444-444444444444'::uuid, null,
    '[{"activityKey":"gantt:1781010000000_01.08.26.xml:77"}]'::jsonb, null, false, true
  );
  begin
    perform public.bidoc_contracts_review_activity_mapping_v1(submission);
  exception when invalid_parameter_value then
    rejected := true;
  end;
  if not rejected or exists (select 1 from private.schedule_activity_mapping_review_events where event_key = 'phase3-version-conflict') then
    raise exception 'Schedule version conflict did not fail closed';
  end if;
end;
$test$;

do $test$
declare
  history jsonb;
  newest jsonb;
  invalid_limit_rejected boolean := false;
begin
  history := public.bidoc_contracts_list_activity_mapping_reviews_v1(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'candidate:structural-framing',
    10
  );
  newest := history #> '{events,0}';
  if history ->> 'historyVersion' <> 'contracts-activity-mapping-history.phase3f.v1'
     or (history ->> 'total')::integer <> 3
     or (history ->> 'returned')::integer <> 3
     or newest ->> 'action' <> 'correct'
     or newest ->> 'supersedesEventId' <> (select value from phase3_test_state where key = 'auto_event_id')
     or newest ->> 'selectedCanonicalKey' <> (select value from phase3_test_state where key = 'canonical_1')
     or jsonb_typeof(newest -> 'alternatives') <> 'array'
     or jsonb_typeof(newest -> 'evidence') <> 'array'
     or length(newest ->> 'reason') < 10
     or newest ->> 'reviewerId' <> '44444444-4444-4444-8444-444444444444' then
    raise exception 'Phase 3F history RPC returned an unexpected contract: %', history;
  end if;

  begin
    perform public.bidoc_contracts_list_activity_mapping_reviews_v1(
      '11111111-1111-4111-8111-111111111111'::uuid,
      null,
      null,
      101
    );
  exception when invalid_parameter_value then
    invalid_limit_rejected := true;
  end;
  if not invalid_limit_rejected then
    raise exception 'Phase 3F history RPC accepted an unsafe limit';
  end if;
end;
$test$;

reset role;

do $test$
declare
  rejected boolean := false;
begin
  begin
    insert into public.schedule_activity_map (
      project_id, canonical_key, alias, alias_source, match_method, confidence, status
    ) values (
      '22222222-2222-4222-8222-222222222222', 'invalid-canonical', '17',
      'gantt_task_uid', 'manual_review', 1.2, 'manually_confirmed'
    );
  exception when check_violation then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Mapping table accepted invalid canonical/confidence/confirmation state';
  end if;
end;
$test$;

do $test$
declare
  event_id uuid;
  immutable_blocked boolean := false;
begin
  select id into event_id from private.schedule_activity_mapping_review_events limit 1;
  begin
    update private.schedule_activity_mapping_review_events
    set reason = 'Immutable event mutation must fail'
    where id = event_id;
  exception when sqlstate '55000' then
    immutable_blocked := true;
  end;
  if not immutable_blocked then
    raise exception 'Immutable activity mapping audit accepted an update';
  end if;
end;
$test$;

do $test$
declare
  review_invoker boolean;
  resolver_invoker boolean;
  history_invoker boolean;
begin
  select not prosecdef and proconfig = array['search_path=""']
  into review_invoker
  from pg_proc
  where oid = 'public.bidoc_contracts_review_activity_mapping_v1(jsonb)'::regprocedure;

  select not prosecdef and proconfig = array['search_path=""']
  into resolver_invoker
  from pg_proc
  where oid = 'public.bidoc_contracts_resolve_mapping_context_v1(uuid)'::regprocedure;

  select not prosecdef and proconfig = array['search_path=""']
  into history_invoker
  from pg_proc
  where oid = 'public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid,text,text,integer)'::regprocedure;

  if review_invoker is not true or resolver_invoker is not true or history_invoker is not true then
    raise exception 'Phase 3 function security or search_path contract is invalid';
  end if;
  if has_function_privilege('anon', 'public.bidoc_contracts_review_activity_mapping_v1(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_resolve_mapping_context_v1(uuid)', 'execute')
     or has_function_privilege('anon', 'public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid,text,text,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid,text,text,integer)', 'execute') then
    raise exception 'Browser role unexpectedly has a Phase 3 RPC grant';
  end if;
  if has_table_privilege('anon', 'public.schedule_activity_map', 'select')
     or has_table_privilege('authenticated', 'public.schedule_activity_map', 'insert')
     or has_table_privilege('service_role', 'public.schedule_activity_map', 'delete')
     or not has_table_privilege('service_role', 'public.schedule_activity_map', 'select,insert,update') then
    raise exception 'schedule_activity_map privileges do not match the backend-only contract';
  end if;
  if has_table_privilege('anon', 'private.schedule_activity_mapping_review_events', 'select')
     or has_table_privilege('authenticated', 'private.schedule_activity_mapping_review_events', 'insert')
     or has_table_privilege('service_role', 'private.schedule_activity_mapping_review_events', 'update')
     or not has_table_privilege('service_role', 'private.schedule_activity_mapping_review_events', 'select,insert') then
    raise exception 'Mapping audit privileges do not match the append-only contract';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.schedule_activity_map'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'private.schedule_activity_mapping_review_events'::regclass) then
    raise exception 'Required RLS is not enabled';
  end if;
  if (select count(*) from pg_policies where schemaname = 'private' and tablename = 'schedule_activity_mapping_review_events') <> 0 then
    raise exception 'Private mapping audit unexpectedly has a browser-facing RLS policy';
  end if;
  if to_regclass('public.sam_confirmed_alias_winner_uniq') is null
     or to_regclass('public.sam_review_queue_idx') is null
     or to_regclass('public.sam_alias_lookup_idx') is null
     or to_regclass('private.samre_project_mapping_fk_idx') is null
     or to_regclass('private.samre_selected_mapping_fk_idx') is null
     or to_regclass('private.samre_supersedes_fk_idx') is null then
    raise exception 'Required Phase 3 constraint-supporting or lookup index is missing';
  end if;
  if pg_get_indexdef('private.samre_project_mapping_fk_idx'::regclass)
     not like '%(project_mapping_id, project_id)%' then
    raise exception 'Project-mapping foreign key index does not cover the full composite key';
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.schedule_activity_map'::regclass
      and conname like 'sam_%_ck'
      and not convalidated
  ) then
    raise exception 'A schedule_activity_map constraint remains unvalidated';
  end if;
end;
$test$;

select jsonb_build_object(
  'status', 'passed',
  'mappingRows', (select count(*) from public.schedule_activity_map),
  'reviewEvents', (select count(*) from private.schedule_activity_mapping_review_events),
  'confirmedWinners', (
    select count(*) from public.schedule_activity_map
    where status in ('manually_confirmed', 'auto_confirmed')
  )
) as contracts_phase3_database_test;
