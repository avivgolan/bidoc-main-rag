create table if not exists public.delay_schedule_versions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  version_key text not null,
  title text not null,
  source_type text null,
  source_id text null,
  source_url text null,
  schedule_date date null,
  contractual_completion_date date null,
  actual_completion_date date null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, version_key)
);

create table if not exists public.delay_schedule_activities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  schedule_version_id uuid not null references public.delay_schedule_versions(id) on delete cascade,
  activity_key text not null,
  name text not null,
  start_date date null,
  finish_date date null,
  duration_days numeric null check (duration_days is null or duration_days >= 0),
  float_days numeric null,
  is_critical boolean null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_version_id, activity_key)
);

create table if not exists public.delay_event_schedule_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  event_id uuid not null references public.delay_events(id) on delete cascade,
  schedule_activity_id uuid not null references public.delay_schedule_activities(id) on delete cascade,
  link_type text not null default 'possibly_related' check (link_type in ('possibly_related', 'claimed_impact', 'weakening_context', 'review_required')),
  explanation text null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, schedule_activity_id, link_type)
);

create table if not exists public.delay_cost_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  event_id uuid null references public.delay_events(id) on delete set null,
  cost_key text not null,
  title text not null,
  cost_type text not null default 'estimate' check (cost_type in ('direct', 'indirect', 'estimate', 'review_required')),
  amount numeric null check (amount is null or amount >= 0),
  currency text null,
  source_type text null,
  source_id text null,
  source_url text null,
  explanation text null,
  duplicate_risk boolean not null default false,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, cost_key)
);

create table if not exists public.delay_claim_exports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  export_key text not null,
  export_type text not null default 'markdown' check (export_type in ('markdown', 'json')),
  title text not null,
  content text null,
  payload jsonb not null default '{}'::jsonb,
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, export_key)
);

create index if not exists delay_schedule_versions_case_idx on public.delay_schedule_versions (case_id, created_at desc);
create index if not exists delay_schedule_activities_case_idx on public.delay_schedule_activities (case_id, schedule_version_id);
create index if not exists delay_event_schedule_links_event_idx on public.delay_event_schedule_links (event_id);
create index if not exists delay_cost_items_case_idx on public.delay_cost_items (case_id, event_id);
create index if not exists delay_claim_exports_case_idx on public.delay_claim_exports (case_id, created_at desc);

alter table public.delay_schedule_versions enable row level security;
alter table public.delay_schedule_activities enable row level security;
alter table public.delay_event_schedule_links enable row level security;
alter table public.delay_cost_items enable row level security;
alter table public.delay_claim_exports enable row level security;

drop trigger if exists trg_delay_schedule_versions_updated_at on public.delay_schedule_versions;
create trigger trg_delay_schedule_versions_updated_at
before update on public.delay_schedule_versions
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_schedule_activities_updated_at on public.delay_schedule_activities;
create trigger trg_delay_schedule_activities_updated_at
before update on public.delay_schedule_activities
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_event_schedule_links_updated_at on public.delay_event_schedule_links;
create trigger trg_delay_event_schedule_links_updated_at
before update on public.delay_event_schedule_links
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_cost_items_updated_at on public.delay_cost_items;
create trigger trg_delay_cost_items_updated_at
before update on public.delay_cost_items
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_claim_exports_updated_at on public.delay_claim_exports;
create trigger trg_delay_claim_exports_updated_at
before update on public.delay_claim_exports
for each row execute function public.set_delay_claim_updated_at();

notify pgrst, 'reload schema';
