-- Additive only. No existing table, policy, trigger, index or record is modified.
-- Server-only immutable observations; source tables are deliberately not FK targets.
begin;

create table public.dashboard_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null,
  project_id uuid not null,
  as_of_date date not null,
  fingerprint text not null,
  run_kind text not null default 'manual' check (run_kind in ('manual','daily')),
  status text not null check (status in ('succeeded','partial')),
  metric_version text not null,
  requested_by uuid,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_key, project_id, as_of_date, fingerprint),
  unique (id, tenant_key, project_id)
);
create table public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  tenant_key text not null,
  project_id uuid not null,
  domain text not null default 'project_manager',
  as_of_date date not null,
  captured_at timestamptz not null,
  status text not null check (status in ('ready','partial')),
  metrics jsonb not null check (jsonb_typeof(metrics)='array'),
  source_health jsonb not null check (jsonb_typeof(source_health)='array'),
  source_versions jsonb not null,
  metric_version text not null,
  created_at timestamptz not null default now(),
  foreign key (run_id,tenant_key,project_id) references public.dashboard_refresh_runs(id,tenant_key,project_id),
  unique (run_id,domain),
  unique (id,tenant_key,project_id)
);
create table public.dashboard_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  tenant_key text not null,
  project_id uuid not null,
  metric_key text not null,
  member_key text not null,
  source_table text not null,
  source_id text not null,
  native_status text,
  severity text,
  source_revision text,
  contribution numeric not null,
  created_at timestamptz not null default now(),
  foreign key (snapshot_id,tenant_key,project_id) references public.dashboard_snapshots(id,tenant_key,project_id),
  unique (snapshot_id,metric_key,member_key)
);
create index dashboard_snapshots_project_time_idx on public.dashboard_snapshots(tenant_key,project_id,captured_at desc);
create index dashboard_snapshot_items_scope_idx on public.dashboard_snapshot_items(tenant_key,project_id,snapshot_id,metric_key);

alter table public.dashboard_refresh_runs enable row level security;
alter table public.dashboard_snapshots enable row level security;
alter table public.dashboard_snapshot_items enable row level security;
revoke all on public.dashboard_refresh_runs, public.dashboard_snapshots, public.dashboard_snapshot_items from public, anon, authenticated, service_role;
grant select, insert on public.dashboard_refresh_runs, public.dashboard_snapshots, public.dashboard_snapshot_items to service_role;

create function public.dashboard_publish_snapshot_v1(
  p_tenant_key text, p_project_id uuid, p_as_of date, p_fingerprint text, p_payload jsonb, p_actor uuid,
  p_run_kind text default 'manual'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_run uuid;
  v_snapshot uuid;
  v_captured timestamptz;
  v_metric jsonb;
  v_count bigint;
begin
  if p_tenant_key is null or length(p_tenant_key)>200 or p_project_id is null or p_as_of is null
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or p_payload is null or coalesce(jsonb_typeof(p_payload->'metrics'),'') <> 'array'
    or coalesce(jsonb_typeof(p_payload->'members'),'') <> 'array'
    or coalesce(jsonb_typeof(p_payload->'sourceHealth'),'') <> 'array'
    or p_payload->>'metricVersion' is distinct from 'dashboard.v1'
    or p_payload->>'status' not in ('ready','partial')
    or p_run_kind not in ('manual','daily') then
    raise exception 'invalid dashboard observation';
  end if;
  if jsonb_array_length(p_payload->'members')>50000 or jsonb_array_length(p_payload->'metrics')>30 then
    raise exception 'dashboard observation too large';
  end if;
  v_captured := (p_payload->>'capturedAt')::timestamptz;
  if v_captured is null or v_captured > now()+interval '5 minutes' or v_captured < now()-interval '1 hour'
    or (p_payload->>'asOf')::date is distinct from p_as_of then
    raise exception 'invalid capture time';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_key || ':' || p_project_id::text || ':' || p_as_of::text,0));
  select r.id,s.id into v_run,v_snapshot
    from public.dashboard_refresh_runs r join public.dashboard_snapshots s on s.run_id=r.id
    where r.tenant_key=p_tenant_key and r.project_id=p_project_id and r.as_of_date=p_as_of and r.fingerprint=p_fingerprint;
  if v_snapshot is not null then
    return jsonb_build_object('snapshotId',v_snapshot,'runId',v_run,'reused',true);
  end if;
  for v_metric in select value from jsonb_array_elements(p_payload->'metrics') loop
    if v_metric->>'unit'='count' and v_metric->>'value' is not null then
      select count(*) into v_count from jsonb_array_elements(p_payload->'members') m where m->>'metric_key'=v_metric->>'key';
      if (v_metric->>'value')::numeric <> v_count then raise exception 'metric membership mismatch'; end if;
    end if;
  end loop;
  insert into public.dashboard_refresh_runs(tenant_key,project_id,as_of_date,fingerprint,run_kind,status,metric_version,requested_by,captured_at)
    values(p_tenant_key,p_project_id,p_as_of,p_fingerprint,p_run_kind,
      case when p_payload->>'status'='partial' then 'partial' else 'succeeded' end,
      p_payload->>'metricVersion',p_actor,v_captured) returning id into v_run;
  insert into public.dashboard_snapshots(run_id,tenant_key,project_id,as_of_date,captured_at,status,metrics,source_health,source_versions,metric_version)
    values(v_run,p_tenant_key,p_project_id,p_as_of,v_captured,p_payload->>'status',p_payload->'metrics',p_payload->'sourceHealth',
      p_payload->'sourceVersions',p_payload->>'metricVersion') returning id into v_snapshot;
  insert into public.dashboard_snapshot_items(snapshot_id,tenant_key,project_id,metric_key,member_key,source_table,source_id,native_status,severity,source_revision,contribution)
    select v_snapshot,p_tenant_key,p_project_id,m->>'metric_key',m->>'member_key',m->>'source_table',m->>'source_id',
      m->>'native_status',m->>'severity',m->>'source_revision',(m->>'contribution')::numeric
    from jsonb_array_elements(p_payload->'members') m;
  return jsonb_build_object('snapshotId',v_snapshot,'runId',v_run,'reused',false);
end;
$$;
revoke all on function public.dashboard_publish_snapshot_v1(text,uuid,date,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.dashboard_publish_snapshot_v1(text,uuid,date,text,jsonb,uuid,text) to service_role;
comment on table public.dashboard_snapshots is 'Dashboard observations captured at a real time; not a reconstructed historical business state. Source records stay read-only.';
notify pgrst, 'reload schema';
commit;
