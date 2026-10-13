-- ============================================================
-- Project-scoped graph (graph_nodes / graph_edges / graph_search)
-- Company DB migration (every Company DB; NOT the App/MAIN DB).
--
-- The Project graph lives in the Company DB. bidoc's timeline-relationships
-- pipeline and main-agent's Project-scoped graph writers stamp project_id
-- and use ids prefixed p:<project_id>:. This migration is idempotent and
-- matches bidoc migration 20260806180000_timeline_relationships.sql for the
-- graph part, plus:
--   * graph_search(filter_project_id) also requires BOTH edge nodes to
--     belong to the Project (no cross-Project node through a scoped edge);
--   * a backfill of project_id for legacy rows where it is derivable.
-- Requires graph_nodes / graph_edges to exist (main-agent
-- supabase/project-graph.sql or the bidoc Company DB template).
-- ============================================================

BEGIN;

-- ─── Columns ─────────────────────────────────────────────────
ALTER TABLE public.graph_nodes ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.graph_edges ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.graph_edges ADD COLUMN IF NOT EXISTS truth_tier text;

-- The legacy global keys block per-Project copies of the same source record
-- or entity; Project-scoped keys replace them.
ALTER TABLE public.graph_nodes DROP CONSTRAINT IF EXISTS graph_nodes_source_table_source_id_key;
ALTER TABLE public.graph_edges DROP CONSTRAINT IF EXISTS graph_edges_from_node_id_to_node_id_edge_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_project_source_uq
  ON public.graph_nodes (project_id, source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL AND project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_project_entity_uq
  ON public.graph_nodes (project_id, normalized_label, node_type)
  WHERE source_id IS NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS graph_nodes_project_idx ON public.graph_nodes (project_id);
CREATE INDEX IF NOT EXISTS graph_nodes_project_type_idx ON public.graph_nodes (project_id, node_type);

CREATE UNIQUE INDEX IF NOT EXISTS graph_edges_project_pair_uq
  ON public.graph_edges (project_id, from_node_id, to_node_id, edge_type)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS graph_edges_project_idx ON public.graph_edges (project_id);
CREATE INDEX IF NOT EXISTS graph_edges_project_from_idx ON public.graph_edges (project_id, from_node_id, edge_type);
CREATE INDEX IF NOT EXISTS graph_edges_project_to_idx ON public.graph_edges (project_id, to_node_id, edge_type);

-- ─── Backfill: event nodes from their source rows ────────────
-- A node whose source_table is a Company DB table with a uuid project_id
-- takes that row's project_id. Skipped when the Project already has a node
-- for the same source record (bidoc's p:<project>: copy) — the legacy
-- duplicate stays NULL and is therefore invisible to scoped search.
DO $backfill$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT DISTINCT source_table FROM public.graph_nodes
    WHERE project_id IS NULL AND source_table IS NOT NULL AND source_id IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'project_id' AND data_type = 'uuid'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'id'
    ) THEN
      EXECUTE format($update$
        UPDATE public.graph_nodes n
        SET project_id = s.project_id
        FROM public.%1$I s
        WHERE n.project_id IS NULL
          AND n.source_table = %2$L
          AND n.source_id = s.id::text
          AND s.project_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.graph_nodes x
            WHERE x.project_id = s.project_id
              AND x.source_table = n.source_table
              AND x.source_id = n.source_id
          )
      $update$, t, t);
    ELSE
      RAISE NOTICE 'graph backfill: source_table % has no uuid project_id here; its nodes stay unscoped', t;
    END IF;
  END LOOP;
END
$backfill$;

-- ─── Backfill: entity nodes used by exactly one Project ──────
-- An entity (source_id IS NULL) takes a Project only when every node that
-- points at it belongs to that one Project. Shared or partly-unknown
-- entities stay NULL (a writer re-run creates per-Project copies).
WITH incident AS (
  SELECT e.to_node_id AS node_id, a.project_id
  FROM public.graph_edges e
  JOIN public.graph_nodes a ON a.id = e.from_node_id
),
single_project AS (
  SELECT node_id, min(project_id::text)::uuid AS project_id
  FROM incident
  GROUP BY node_id
  HAVING count(*) FILTER (WHERE project_id IS NULL) = 0
     AND count(DISTINCT project_id) = 1
),
candidates AS (
  SELECT n.id, s.project_id,
    count(*) OVER (PARTITION BY s.project_id, n.normalized_label, n.node_type) AS same_key
  FROM public.graph_nodes n
  JOIN single_project s ON s.node_id = n.id
  WHERE n.project_id IS NULL AND n.source_id IS NULL
)
UPDATE public.graph_nodes n
SET project_id = c.project_id
FROM candidates c
WHERE n.id = c.id
  AND c.same_key = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.graph_nodes x
    WHERE x.project_id = c.project_id
      AND x.source_id IS NULL
      AND x.normalized_label = n.normalized_label
      AND x.node_type = n.node_type
  );

-- ─── Backfill: edges whose two nodes share one Project ───────
UPDATE public.graph_edges e
SET project_id = a.project_id
FROM public.graph_nodes a, public.graph_nodes b
WHERE e.project_id IS NULL
  AND a.id = e.from_node_id
  AND b.id = e.to_node_id
  AND a.project_id IS NOT NULL
  AND b.project_id = a.project_id
  AND NOT EXISTS (
    SELECT 1 FROM public.graph_edges x
    WHERE x.project_id = a.project_id
      AND x.from_node_id = e.from_node_id
      AND x.to_node_id = e.to_node_id
      AND x.edge_type = e.edge_type
  );

-- ─── Project-aware graph_search ──────────────────────────────
DO $drop$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'graph_search'
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn.signature);
  END LOOP;
END
$drop$;

CREATE FUNCTION public.graph_search(
  query_text text default '',
  source_refs jsonb default '[]'::jsonb,
  max_rows integer default 30,
  filter_project_id uuid default null
)
returns table (
  edge_id uuid,
  edge_type text,
  weight numeric,
  confidence numeric,
  evidence_text text,
  truth_tier text,
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
     and (filter_project_id is null or n.project_id = filter_project_id)
    where coalesce(ref->>'node_id', n.id) is not null
  ),
  direct_edges as (
    select e.*
    from public.graph_edges e
    join requested r
      on r.node_id = e.from_node_id
      or r.node_id = e.to_node_id
    where filter_project_id is null or e.project_id = filter_project_id
  ),
  query_edges as (
    select e.*
    from public.graph_edges e
    join public.graph_nodes a on a.id = e.from_node_id
    join public.graph_nodes b on b.id = e.to_node_id
    where length(trim(coalesce(query_text, ''))) > 0
      and (filter_project_id is null or e.project_id = filter_project_id)
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
    e.truth_tier,
    to_jsonb(from_node) - 'created_at' - 'updated_at' as source_node,
    to_jsonb(to_node) - 'created_at' - 'updated_at' as target_node
  from combined e
  join public.graph_nodes from_node on from_node.id = e.from_node_id
  join public.graph_nodes to_node on to_node.id = e.to_node_id
  where filter_project_id is null
     or (from_node.project_id = filter_project_id and to_node.project_id = filter_project_id)
  order by e.confidence desc, e.weight desc, e.created_at desc
  limit greatest(1, least(coalesce(max_rows, 30), 200));
$$;

-- Report what stayed unscoped (visible to unscoped callers only).
DO $report$
DECLARE
  nodes_left bigint;
  edges_left bigint;
BEGIN
  SELECT count(*) INTO nodes_left FROM public.graph_nodes WHERE project_id IS NULL;
  SELECT count(*) INTO edges_left FROM public.graph_edges WHERE project_id IS NULL;
  RAISE NOTICE 'graph backfill: % nodes and % edges still have no project_id', nodes_left, edges_left;
END
$report$;

COMMIT;

NOTIFY pgrst, 'reload schema';
