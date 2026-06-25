create table if not exists public.delay_claim_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  title text not null,
  project_id text null,
  description text null,
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delay_claim_sources (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  source_type text not null,
  source_id text null,
  source_table text null,
  source_url text null,
  title text null,
  reference_date timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delay_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  title text not null,
  short_description text null,
  contractor_claim text null,
  event_type text null,
  start_date date null,
  end_date date null,
  alleged_responsible_party text null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  readiness_score numeric null check (readiness_score is null or (readiness_score >= 0 and readiness_score <= 1)),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, event_key)
);

create table if not exists public.delay_event_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.delay_events(id) on delete cascade,
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  source_id uuid null references public.delay_claim_sources(id) on delete set null,
  source_type text null,
  external_source_id text null,
  source_url text null,
  quote text null,
  excerpt text null,
  what_it_supports text null,
  supports_or_weakens text not null default 'supports' check (supports_or_weakens in ('supports', 'weakens', 'neutral')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delay_event_gaps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.delay_events(id) on delete cascade,
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  missing_item text not null,
  why_it_matters text null,
  urgency text not null default 'medium' check (urgency in ('low', 'medium', 'high')),
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delay_event_findings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.delay_events(id) on delete cascade,
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  finding_type text not null check (finding_type in ('documented_fact', 'calculation', 'analytical_conclusion', 'professional_review')),
  title text not null,
  explanation text null,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence_ids uuid[] not null default '{}'::uuid[],
  human_status text not null default 'candidate' check (human_status in ('candidate', 'approved', 'rejected', 'needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delay_event_change_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.delay_events(id) on delete cascade,
  case_id uuid not null references public.delay_claim_cases(id) on delete cascade,
  changed_by text null,
  change_type text not null default 'manual_update',
  from_status text null,
  to_status text null,
  note text null,
  diff jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delay_claim_cases_project_idx on public.delay_claim_cases (project_id);
create index if not exists delay_claim_sources_case_idx on public.delay_claim_sources (case_id);
create index if not exists delay_events_case_idx on public.delay_events (case_id, created_at desc);
create index if not exists delay_events_status_idx on public.delay_events (human_status);
create index if not exists delay_event_evidence_event_idx on public.delay_event_evidence (event_id);
create index if not exists delay_event_gaps_event_idx on public.delay_event_gaps (event_id);
create index if not exists delay_event_findings_event_idx on public.delay_event_findings (event_id);
create index if not exists delay_event_change_log_event_idx on public.delay_event_change_log (event_id, created_at desc);

alter table public.delay_claim_cases enable row level security;
alter table public.delay_claim_sources enable row level security;
alter table public.delay_events enable row level security;
alter table public.delay_event_evidence enable row level security;
alter table public.delay_event_gaps enable row level security;
alter table public.delay_event_findings enable row level security;
alter table public.delay_event_change_log enable row level security;

create or replace function public.set_delay_claim_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_delay_claim_cases_updated_at on public.delay_claim_cases;
create trigger trg_delay_claim_cases_updated_at
before update on public.delay_claim_cases
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_claim_sources_updated_at on public.delay_claim_sources;
create trigger trg_delay_claim_sources_updated_at
before update on public.delay_claim_sources
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_events_updated_at on public.delay_events;
create trigger trg_delay_events_updated_at
before update on public.delay_events
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_event_evidence_updated_at on public.delay_event_evidence;
create trigger trg_delay_event_evidence_updated_at
before update on public.delay_event_evidence
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_event_gaps_updated_at on public.delay_event_gaps;
create trigger trg_delay_event_gaps_updated_at
before update on public.delay_event_gaps
for each row execute function public.set_delay_claim_updated_at();

drop trigger if exists trg_delay_event_findings_updated_at on public.delay_event_findings;
create trigger trg_delay_event_findings_updated_at
before update on public.delay_event_findings
for each row execute function public.set_delay_claim_updated_at();

notify pgrst, 'reload schema';
