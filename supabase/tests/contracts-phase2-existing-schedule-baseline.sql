-- Local-only representation of the already-existing KAPAIM Schedule targets.
-- This is a compilation/security fixture and is never part of a remote migration.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_contract_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  milestone_key text not null,
  name text not null,
  contract_date date not null,
  is_project_completion boolean not null default false,
  activity_key text,
  source_document_id text,
  source_excerpt text,
  confidence numeric,
  status text not null default 'active',
  extractor_version text,
  written_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, milestone_key)
);

create table if not exists public.schedule_contract_extensions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  milestone_key text not null,
  extension_days integer not null,
  status text not null,
  approved_date date,
  approved_by text,
  source_document_id text,
  source_excerpt text,
  confidence numeric,
  written_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists schedule_contract_extensions_reviewed_uniq
  on public.schedule_contract_extensions (
    project_id,
    milestone_key,
    source_document_id,
    extension_days
  ) where source_document_id is not null;

create table if not exists public.schedule_contract_conditions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  condition_key text not null,
  name text not null,
  category text not null,
  anchor_kind text not null,
  anchor_description text,
  offset_value numeric,
  offset_unit text,
  recurring boolean not null default false,
  is_project_completion boolean not null default false,
  penalty_ils_per_day numeric,
  source_excerpt text,
  source_page integer,
  confidence numeric,
  status text not null default 'pending',
  trigger_event_date date,
  trigger_source_table text,
  trigger_source_id uuid,
  resolved_milestone_key text,
  written_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, condition_key)
);

alter table public.projects enable row level security;
alter table public.schedule_contract_milestones enable row level security;
alter table public.schedule_contract_extensions enable row level security;
alter table public.schedule_contract_conditions enable row level security;

grant select, insert, update, delete on table public.projects to anon, authenticated, service_role;
grant select, insert, update, delete on table public.schedule_contract_milestones to anon, authenticated, service_role;
grant select, insert, update, delete on table public.schedule_contract_extensions to anon, authenticated, service_role;
grant select, insert, update, delete on table public.schedule_contract_conditions to anon, authenticated, service_role;
