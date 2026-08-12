do $test$
begin
  if to_regprocedure('public.bidoc_contracts_review_activity_mapping_v1(jsonb)') is not null
     or to_regprocedure('public.bidoc_contracts_resolve_mapping_context_v1(uuid)') is not null
     or to_regprocedure('public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid,text,text,integer)') is not null then
    raise exception 'Phase 3 RPC remained after operational rollback';
  end if;
  if to_regclass('public.schedule_activity_map') is null
     or to_regclass('private.schedule_activity_mapping_review_events') is null then
    raise exception 'Operational rollback destroyed mapping state or immutable evidence';
  end if;
  if has_table_privilege('service_role', 'public.schedule_activity_map', 'insert')
     or has_table_privilege('service_role', 'public.schedule_activity_map', 'update')
     or has_table_privilege('service_role', 'private.schedule_activity_mapping_review_events', 'insert') then
    raise exception 'Operational rollback left a server mutation path enabled';
  end if;
  if (select count(*) from public.schedule_activity_map) = 0
     or (select count(*) from private.schedule_activity_mapping_review_events) = 0 then
    raise exception 'Operational rollback removed current state or audit history';
  end if;
end;
$test$;

select jsonb_build_object(
  'status', 'rollback_passed',
  'mappingRowsPreserved', (select count(*) from public.schedule_activity_map),
  'reviewEventsPreserved', (select count(*) from private.schedule_activity_mapping_review_events)
) as contracts_phase3_rollback_test;
