-- Tests insert exclusively into the new dashboard tables and roll everything back.
begin;
do $$
declare n text; p jsonb; a jsonb; b jsonb;
begin
  foreach n in array array['dashboard_refresh_runs','dashboard_snapshots','dashboard_snapshot_items'] loop
    if has_table_privilege('anon','public.'||n,'SELECT') or has_table_privilege('authenticated','public.'||n,'INSERT')
      or has_table_privilege('service_role','public.'||n,'UPDATE') or has_table_privilege('service_role','public.'||n,'DELETE') then
      raise exception 'unexpected dashboard privileges: %',n;
    end if;
    if not (select relrowsecurity from pg_class where oid=('public.'||n)::regclass) then raise exception 'RLS missing'; end if;
  end loop;
  if has_function_privilege('anon','public.dashboard_publish_snapshot_v1(text,uuid,date,text,jsonb,uuid,text)','EXECUTE') then raise exception 'RPC exposed'; end if;
end $$;
set local role service_role;
do $$
declare p jsonb; a jsonb; b jsonb; rejected boolean := false;
begin
  p:=jsonb_build_object('metricVersion','dashboard.v1','status','ready','capturedAt',now(),'asOf',current_date,
    'metrics',jsonb_build_array(jsonb_build_object('key','approvals','unit','count','value',0)),
    'members','[]'::jsonb,'sourceHealth','[]'::jsonb,'sourceVersions','{}'::jsonb);
  a:=public.dashboard_publish_snapshot_v1('dashboard-rollback-test','00000000-0000-4000-8000-000000000001',current_date,repeat('a',64),p,null);
  b:=public.dashboard_publish_snapshot_v1('dashboard-rollback-test','00000000-0000-4000-8000-000000000001',current_date,repeat('a',64),p,null);
  if a->>'snapshotId' <> b->>'snapshotId' or b->>'reused' <> 'true' then raise exception 'idempotency failed'; end if;
  begin
    perform public.dashboard_publish_snapshot_v1('dashboard-rollback-test','00000000-0000-4000-8000-000000000001',current_date,repeat('b',64),jsonb_set(p,'{metrics,0,value}','1'),null);
  exception when others then
    if SQLERRM <> 'metric membership mismatch' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'mismatched count accepted'; end if;
end $$;
rollback;
select 'dashboard permissions, RLS, atomic membership and idempotency passed; test rows rolled back' as result;
