create table if not exists public.timeline_entities (
  id text primary key,
  entity_type text not null check (
    entity_type in ('supplier', 'person', 'company', 'quote', 'invoice', 'work_package', 'topic', 'location')
  ),
  name text not null,
  normalized_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, normalized_name)
);

create table if not exists public.timeline_event_entities (
  id uuid primary key default gen_random_uuid(),
  event_source text not null check (event_source in ('index', 'alerts')),
  event_id text not null,
  entity_id text not null references public.timeline_entities(id) on delete cascade,
  role text not null check (
    role in ('supplier', 'approver', 'quote', 'invoice', 'work_package', 'topic', 'location', 'mentioned')
  ),
  confidence numeric not null default 0.5,
  evidence_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_source, event_id, entity_id, role)
);

create table if not exists public.timeline_graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_entity_id text not null references public.timeline_entities(id) on delete cascade,
  to_entity_id text not null references public.timeline_entities(id) on delete cascade,
  edge_type text not null check (
    edge_type in ('issued_by', 'approved_by', 'belongs_to', 'references', 'follows', 'same_topic')
  ),
  confidence numeric not null default 0.5,
  evidence_event_source text check (evidence_event_source in ('index', 'alerts')),
  evidence_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_entity_id, to_entity_id, edge_type, evidence_event_source, evidence_event_id)
);

create index if not exists timeline_entities_type_name_idx
  on public.timeline_entities (entity_type, normalized_name);

create index if not exists timeline_event_entities_event_idx
  on public.timeline_event_entities (event_source, event_id);

create index if not exists timeline_event_entities_entity_idx
  on public.timeline_event_entities (entity_id, role);

create index if not exists timeline_graph_edges_from_idx
  on public.timeline_graph_edges (from_entity_id, edge_type);

create index if not exists timeline_graph_edges_to_idx
  on public.timeline_graph_edges (to_entity_id, edge_type);

create or replace function public.set_timeline_graph_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_timeline_entities_updated_at on public.timeline_entities;
create trigger trg_timeline_entities_updated_at
before update on public.timeline_entities
for each row execute function public.set_timeline_graph_updated_at();

drop trigger if exists trg_timeline_event_entities_updated_at on public.timeline_event_entities;
create trigger trg_timeline_event_entities_updated_at
before update on public.timeline_event_entities
for each row execute function public.set_timeline_graph_updated_at();

drop trigger if exists trg_timeline_graph_edges_updated_at on public.timeline_graph_edges;
create trigger trg_timeline_graph_edges_updated_at
before update on public.timeline_graph_edges
for each row execute function public.set_timeline_graph_updated_at();
