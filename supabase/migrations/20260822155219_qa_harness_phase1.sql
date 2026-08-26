-- BiDoc QA & Tuning MCP — Phase 1 QA harness.
-- Server-only tables: clients do not receive direct grants or policies.

create table if not exists public.qa_test_suites (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  project_id text null,
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  domain text not null check (char_length(domain) between 1 and 80),
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'active', 'deprecated')),
  is_regression boolean not null default false,
  is_golden boolean not null default false,
  tags text[] not null default '{}'::text[],
  created_by text not null,
  idempotency_key text null check (idempotency_key is null or char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index if not exists qa_test_suites_idempotency_idx
  on public.qa_test_suites (organization_id, created_by, idempotency_key)
  where idempotency_key is not null;
create index if not exists qa_test_suites_scope_idx
  on public.qa_test_suites (organization_id, project_id, domain, status);

create table if not exists public.qa_test_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  suite_id uuid not null,
  case_key text not null check (char_length(case_key) between 1 and 160),
  question text not null check (char_length(question) between 1 and 8000),
  turns jsonb null,
  expected_behavior jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}'::text[],
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  origin text not null default 'manual'
    check (origin in ('manual', 'generated', 'production_failure', 'user_dislike', 'bug_report', 'ground_truth')),
  is_golden boolean not null default false,
  is_critical boolean not null default false,
  enabled boolean not null default true,
  version integer not null default 1 check (version >= 1),
  last_idempotency_key text null check (last_idempotency_key is null or char_length(last_idempotency_key) between 8 and 200),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (suite_id, organization_id)
    references public.qa_test_suites(id, organization_id) on delete cascade,
  unique (suite_id, case_key),
  unique (id, organization_id)
);

create index if not exists qa_test_cases_suite_idx
  on public.qa_test_cases (suite_id, enabled, priority, created_at);
create index if not exists qa_test_cases_scope_idx
  on public.qa_test_cases (organization_id, suite_id);

create table if not exists public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid null,
  run_type text not null
    check (run_type in ('baseline', 'candidate', 'regression', 'manual', 'production_sample')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  config_snapshot_id text null,
  candidate_id text null,
  organization_id text not null,
  project_id text null,
  data_snapshot_at timestamptz not null default now(),
  corpus_version text null,
  repeat_each integer not null default 1 check (repeat_each between 1 and 10),
  options jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  usage_metrics jsonb not null default '{}'::jsonb,
  estimated_cost numeric(14, 6) null check (estimated_cost is null or estimated_cost >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_by text not null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (suite_id, organization_id)
    references public.qa_test_suites(id, organization_id) on delete restrict,
  unique (id, organization_id)
);

create unique index if not exists qa_runs_idempotency_idx
  on public.qa_runs (organization_id, created_by, idempotency_key);
create index if not exists qa_runs_suite_idx
  on public.qa_runs (suite_id, created_at desc);
create index if not exists qa_runs_status_idx
  on public.qa_runs (organization_id, status, created_at desc);

create table if not exists public.qa_case_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  case_id uuid null,
  organization_id text not null,
  project_id text null,
  repetition integer not null default 1 check (repetition between 1 and 10),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  execution_id uuid not null,
  question text not null check (char_length(question) between 1 and 8000),
  answer text null,
  classification jsonb not null default '{}'::jsonb,
  retrieval jsonb not null default '{}'::jsonb,
  reranking jsonb not null default '{}'::jsonb,
  knowledge jsonb not null default '{}'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  context_trace jsonb not null default '{}'::jsonb,
  workflow jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  usage_metrics jsonb not null default '{}'::jsonb,
  estimated_cost numeric(14, 6) null check (estimated_cost is null or estimated_cost >= 0),
  raw_result jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, organization_id)
    references public.qa_runs(id, organization_id) on delete cascade,
  foreign key (case_id, organization_id)
    references public.qa_test_cases(id, organization_id) on delete restrict,
  unique (execution_id),
  unique (id, organization_id)
);

create unique index if not exists qa_case_runs_identity_idx
  on public.qa_case_runs (run_id, coalesce(case_id, '00000000-0000-0000-0000-000000000000'::uuid), repetition);
create index if not exists qa_case_runs_run_idx
  on public.qa_case_runs (run_id, status, created_at);
create index if not exists qa_case_runs_case_idx
  on public.qa_case_runs (case_id, created_at desc)
  where case_id is not null;

create table if not exists public.qa_evaluations (
  id uuid primary key default gen_random_uuid(),
  case_run_id uuid not null,
  organization_id text not null,
  evaluator_version text not null,
  evaluator_model text null,
  evaluation_profile text not null,
  status text not null check (status in ('pass', 'partial', 'fail', 'error')),
  overall_score numeric(6, 2) not null check (overall_score between 0 and 100),
  scores jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  hard_fail boolean not null default false,
  hard_fail_reason text null,
  failure_codes text[] not null default '{}'::text[],
  severity text not null default 'INFO'
    check (severity in ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  root_cause_domain text null,
  root_cause_confidence numeric(5, 4) null
    check (root_cause_confidence is null or root_cause_confidence between 0 and 1),
  analysis jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (case_run_id, organization_id)
    references public.qa_case_runs(id, organization_id) on delete cascade,
  unique (case_run_id, evaluator_version, evaluation_profile)
);

create index if not exists qa_evaluations_case_run_idx
  on public.qa_evaluations (case_run_id, created_at desc);
create index if not exists qa_evaluations_failure_codes_idx
  on public.qa_evaluations using gin (failure_codes);
create index if not exists qa_evaluations_scope_status_idx
  on public.qa_evaluations (organization_id, status, severity, created_at desc);

alter table public.qa_test_suites enable row level security;
alter table public.qa_test_cases enable row level security;
alter table public.qa_runs enable row level security;
alter table public.qa_case_runs enable row level security;
alter table public.qa_evaluations enable row level security;

revoke all on table public.qa_test_suites from public, anon, authenticated;
revoke all on table public.qa_test_cases from public, anon, authenticated;
revoke all on table public.qa_runs from public, anon, authenticated;
revoke all on table public.qa_case_runs from public, anon, authenticated;
revoke all on table public.qa_evaluations from public, anon, authenticated;
grant select, insert, update on table public.qa_test_suites to service_role;
grant select, insert, update on table public.qa_test_cases to service_role;
grant select, insert, update on table public.qa_runs to service_role;
grant select, insert, update on table public.qa_case_runs to service_role;
grant select, insert on table public.qa_evaluations to service_role;

create or replace function public.set_qa_harness_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_qa_harness_updated_at() from public, anon, authenticated;
grant execute on function public.set_qa_harness_updated_at() to service_role;

drop trigger if exists set_qa_test_suites_updated_at on public.qa_test_suites;
create trigger set_qa_test_suites_updated_at before update on public.qa_test_suites
for each row execute function public.set_qa_harness_updated_at();
drop trigger if exists set_qa_test_cases_updated_at on public.qa_test_cases;
create trigger set_qa_test_cases_updated_at before update on public.qa_test_cases
for each row execute function public.set_qa_harness_updated_at();
drop trigger if exists set_qa_runs_updated_at on public.qa_runs;
create trigger set_qa_runs_updated_at before update on public.qa_runs
for each row execute function public.set_qa_harness_updated_at();
drop trigger if exists set_qa_case_runs_updated_at on public.qa_case_runs;
create trigger set_qa_case_runs_updated_at before update on public.qa_case_runs
for each row execute function public.set_qa_harness_updated_at();

comment on column public.qa_case_runs.raw_result is
  'Redacted evaluator replay payload. Apply a retention policy to this column/table.';

notify pgrst, 'reload schema';
