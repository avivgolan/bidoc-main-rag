create table public.schedule_activity_alert_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  source_event_id text not null,
  source_table text not null default 'alerts',
  source_id text not null,
  activity_key text not null,
  event_date date not null,
  linked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activity_alert_links_project_fk
    foreign key (project_id) references public.projects(id) on delete cascade,
  constraint schedule_activity_alert_links_source_ck
    check (source_table = 'alerts' and source_event_id <> '' and source_id <> ''),
  constraint schedule_activity_alert_links_activity_ck
    check (activity_key like 'gantt:%'),
  constraint schedule_activity_alert_links_source_uk
    unique (project_id, source_table, source_id)
);

comment on table public.schedule_activity_alert_links is
  'User-reviewed one-to-one links from canonical alerts timeline events to the active MAIN Gantt activity identity.';
comment on column public.schedule_activity_alert_links.activity_key is
  'Cross-database MAIN Gantt identity (gantt:<file_id>:<task_uid>); intentionally not a local FK.';
comment on column public.schedule_activity_alert_links.source_id is
  'Canonical public.alerts.id represented as text; source content is never copied into this relation.';

create index schedule_activity_alert_links_activity_idx
  on public.schedule_activity_alert_links (project_id, activity_key, event_date desc);

create trigger set_updated_at
  before update on public.schedule_activity_alert_links
  for each row execute function public.set_updated_at();

alter table public.schedule_activity_alert_links enable row level security;

revoke all on table public.schedule_activity_alert_links from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_activity_alert_links to service_role;
