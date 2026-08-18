-- Local-only representation of KAPAIM's existing schedule_activity_map.
-- This fixture is never part of a remote migration.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.schedule_activity_map (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  canonical_key text not null,
  alias text not null,
  alias_source text not null,
  match_method text not null,
  confidence numeric not null default 0.5,
  status text not null default 'suggested',
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, canonical_key, alias, alias_source)
);

alter table public.schedule_activity_map enable row level security;

create trigger set_updated_at
before update on public.schedule_activity_map
for each row execute function public.set_updated_at();

-- Reproduce the audited legacy grants so Phase 3C proves their removal.
grant select, insert, update, delete, truncate, references, trigger
on table public.schedule_activity_map to anon, authenticated, service_role;
