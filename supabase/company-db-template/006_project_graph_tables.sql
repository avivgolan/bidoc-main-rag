-- ============================================================
-- Company DB template addition (bidoc supabase/migrations/006_new_company_db_schema.sql)
--
-- 006 does not create graph_nodes / graph_edges, yet bidoc's
-- timeline-relationships pipeline and main-agent's Project-scoped graph
-- read and write them in every Company DB. Append to 006, in this order:
--   1. this file (tables, Project-scoped from birth);
--   2. main-agent supabase/migrations/20261013120100_project_graph_scope.sql
--      (indexes, backfill no-op on an empty DB, project-aware graph_search);
--   3. main-agent supabase/migrations/20261013120000_match_rpc_project_filter.sql
--      after 006's match_* section (recreates them with project_id_filter).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.graph_nodes (
  id               text primary key,
  project_id       uuid,
  node_type        text not null check (
    node_type in ('event', 'alert', 'supplier', 'person', 'company', 'document', 'topic', 'risk', 'invoice', 'quote', 'source')
  ),
  label            text not null,
  normalized_label text not null,
  source_table     text,
  source_id        text,
  event_date       timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.graph_edges (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid,
  from_node_id  text not null references public.graph_nodes(id) on delete cascade,
  to_node_id    text not null references public.graph_nodes(id) on delete cascade,
  edge_type     text not null check (
    edge_type in ('mentions', 'caused_by', 'blocks', 'approved_by', 'related_to', 'same_topic', 'from_document', 'has_status', 'has_risk')
  ),
  weight        numeric not null default 0.5,
  confidence    numeric not null default 0.5,
  evidence_text text,
  truth_tier    text check (truth_tier is null or truth_tier in ('confirmed', 'suggested', 'context')),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS graph_nodes_type_idx ON public.graph_nodes (node_type);
CREATE INDEX IF NOT EXISTS graph_nodes_source_idx ON public.graph_nodes (source_table, source_id);
CREATE INDEX IF NOT EXISTS graph_nodes_label_idx ON public.graph_nodes (normalized_label);
CREATE INDEX IF NOT EXISTS graph_edges_from_idx ON public.graph_edges (from_node_id, edge_type);
CREATE INDEX IF NOT EXISTS graph_edges_to_idx ON public.graph_edges (to_node_id, edge_type);

ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS graph_nodes_authenticated ON public.graph_nodes;
CREATE POLICY graph_nodes_authenticated ON public.graph_nodes
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS graph_edges_authenticated ON public.graph_edges;
CREATE POLICY graph_edges_authenticated ON public.graph_edges
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
