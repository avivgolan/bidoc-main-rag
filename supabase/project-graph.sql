create table if not exists public.graph_nodes (
  id text primary key,
  node_type text not null check (
    node_type in ('event', 'alert', 'supplier', 'person', 'company', 'document', 'topic', 'risk', 'invoice', 'quote', 'source')
  ),
  label text not null,
  normalized_label text not null,
  source_table text null,
  source_id text null,
  event_date timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create table if not exists public.graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_node_id text not null references public.graph_nodes(id) on delete cascade,
  to_node_id text not null references public.graph_nodes(id) on delete cascade,
  edge_type text not null check (
    edge_type in ('mentions', 'caused_by', 'blocks', 'approved_by', 'related_to', 'same_topic', 'from_document', 'has_status', 'has_risk')
  ),
  weight numeric not null default 0.5,
  confidence numeric not null default 0.5,
  evidence_text text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_node_id, to_node_id, edge_type)
);

create index if not exists graph_nodes_type_idx
  on public.graph_nodes (node_type);

create index if not exists graph_nodes_source_idx
  on public.graph_nodes (source_table, source_id);

create index if not exists graph_nodes_label_idx
  on public.graph_nodes (normalized_label);

create index if not exists graph_edges_from_idx
  on public.graph_edges (from_node_id, edge_type);

create index if not exists graph_edges_to_idx
  on public.graph_edges (to_node_id, edge_type);

create index if not exists graph_edges_type_idx
  on public.graph_edges (edge_type);

create or replace function public.set_project_graph_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_graph_nodes_updated_at on public.graph_nodes;
create trigger trg_graph_nodes_updated_at
before update on public.graph_nodes
for each row execute function public.set_project_graph_updated_at();

drop trigger if exists trg_graph_edges_updated_at on public.graph_edges;
create trigger trg_graph_edges_updated_at
before update on public.graph_edges
for each row execute function public.set_project_graph_updated_at();

create or replace function public.graph_search(
  query_text text default '',
  source_refs jsonb default '[]'::jsonb,
  max_rows integer default 30
)
returns table (
  edge_id uuid,
  edge_type text,
  weight numeric,
  confidence numeric,
  evidence_text text,
  source_node jsonb,
  target_node jsonb
)
language sql
stable
as $$
  with requested as (
    select distinct
      coalesce(ref->>'node_id', n.id) as node_id
    from jsonb_array_elements(coalesce(source_refs, '[]'::jsonb)) ref
    left join public.graph_nodes n
      on n.source_table = ref->>'source_table'
     and n.source_id = ref->>'source_id'
    where coalesce(ref->>'node_id', n.id) is not null
  ),
  direct_edges as (
    select e.*
    from public.graph_edges e
    join requested r
      on r.node_id = e.from_node_id
      or r.node_id = e.to_node_id
  ),
  query_edges as (
    select e.*
    from public.graph_edges e
    join public.graph_nodes a on a.id = e.from_node_id
    join public.graph_nodes b on b.id = e.to_node_id
    where length(trim(coalesce(query_text, ''))) > 0
      and (
        a.normalized_label ilike '%' || lower(query_text) || '%'
        or b.normalized_label ilike '%' || lower(query_text) || '%'
        or e.evidence_text ilike '%' || query_text || '%'
      )
  ),
  combined as (
    select * from direct_edges
    union
    select * from query_edges
  )
  select
    e.id as edge_id,
    e.edge_type,
    e.weight,
    e.confidence,
    e.evidence_text,
    to_jsonb(from_node) - 'created_at' - 'updated_at' as source_node,
    to_jsonb(to_node) - 'created_at' - 'updated_at' as target_node
  from combined e
  join public.graph_nodes from_node on from_node.id = e.from_node_id
  join public.graph_nodes to_node on to_node.id = e.to_node_id
  order by e.confidence desc, e.weight desc, e.created_at desc
  limit greatest(1, least(coalesce(max_rows, 30), 200));
$$;

notify pgrst, 'reload schema';
