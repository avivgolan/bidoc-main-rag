# Data Query Agent - Phase 2 correctness contract

Status: implemented and verified on 2026-07-22.

## Outcome

Phase 2 replaces row-capped local analytics with an exact, typed database function for the currently approved `public.data_index` table. Counts, grouped counts, date buckets, distinct values, top-N groups, and approved aggregates are now computed over the full filtered relation rather than the first `maxRowsPerPlan` rows.

The runtime reports one of four explicit exactness states:

- `exact`: the returned metric covers every matching database row.
- `truncated`: the metric is exact, but only the first requested result groups or distinct values are returned.
- `sampled`: reserved for an explicitly sampled future execution path; the current exact RPC never reports this state.
- `not_computable`: the requested operation, field, table, or typed value is outside the approved exact contract.

The agent must never convert `truncated`, `sampled`, or `not_computable` into an unqualified factual answer.

## Canonical execution flow

1. Build the Content-only table manifest from saved settings.
2. Attach the registered field policy from `src/subagents/dataQueryMetadata.js`.
3. Ask the LLM planner for typed Query Plan JSON, or use the deterministic fallback planner.
4. Validate the operation, field capabilities, filter operator and value type, metric aliases, limits, and total deadline in Node.js.
5. Call `public.bidoc_data_query_data_index_v1` using the dedicated `bidoc_data_query` JWT.
6. Normalize exactness, cardinality, result-row count, metrics, provenance, warnings, and deterministic answer text.
7. Persist structural workflow telemetry without source-row previews or raw filter values.

The RPC accepts structured JSON parameters. It does not accept SQL text, a schema name, or a table name, and it is fixed to `public.data_index`.

## Approved operations

| Operation | Current behavior |
|---|---|
| `count` | Exact matching-row count, including zero |
| `group_count` | Exact group counts; a result-group limit can make the returned list `truncated` |
| `aggregate` | Exact approved numeric aggregation; the current app policy exposes `min` and `max` for `id` |
| `timeseries` | Exact day or month buckets over an approved date field |
| `top_n` | Exact grouped counts with a bounded, deterministically ordered result list |
| `distinct` | Exact distinct values and cardinality; a result-value limit can make the list `truncated` |
| `select` | Bounded row retrieval retained for compatibility; it is never represented as an exact aggregate |

`orderBy` is validated by the database function but Phase 2 uses deterministic operation-specific ordering: grouped results use count descending followed by group value, and timeseries buckets use ascending bucket time.

## Typed field policy

The field registry records data type, supported filter operators, selection/grouping capability, aggregation capability, sensitivity, and date semantics. Quantitative planning excludes content-bearing fields including:

- `summary`
- `index_text`
- `metadata`
- `embedding`
- `title`
- `source_url`
- `hashtags`
- `mentioned_dates`

`project_id` may be filtered or selected but is not groupable. Workflow provenance stores field names, operators, and a stable filter signature, not raw filter values. Group values can appear only for explicitly groupable non-content fields.

## Database security boundary

The tracked migration is `supabase/data-query-exact-metrics-v1.sql`.

- The function is `SECURITY INVOKER`, `STABLE`, and uses an empty `search_path`.
- `EXECUTE` is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- `EXECUTE` is granted only to `bidoc_data_query`.
- The role has `SELECT` only on the approved `public.data_index` table.
- Field names, operators, types, aliases, limits, and operation shapes are allowlisted inside the function.
- A malicious field-name probe was rejected by the live function.

The migration also adds indexes for `primary_date`, `(project_id, primary_date)`, and `(source_table, primary_date)` to support common filtered date analytics. An unused-index advisor result immediately after creation is expected until production traffic exercises the access paths.

## Verification evidence

### Focused automated tests

The Data Query block contains 25 passing tests covering:

- typed metadata and content-field exclusion;
- typed filter rejection and unsupported-RPC behavior;
- dedicated-token exact RPC request contract;
- zero preservation and stable provenance IDs;
- a mocked exact 10,000-row result that is not capped at 200;
- end-to-end exact metric normalization without raw previews;
- planner time inside the total-run deadline;
- fixed-table, invoker-rights, and restricted-grant properties of the SQL migration.

### Live production-data comparison

The function was executed as `bidoc_data_query` and compared with trusted SQL over all 1,248 live `data_index` rows:

- total count: `1248`;
- zero-match count: `0`;
- grouped source query: six exact groups, with a five-group response correctly marked `truncated`;
- distinct `item_status`: `12`;
- monthly `primary_date` series: `24` buckets;
- `id` bounds: minimum `11637`, maximum `13189`.

### Transactional gold fixture

A 10,000-row fixture was inserted inside a transaction, queried under the restricted role, and rolled back. It proved exact counts for `0`, `1`, `199`, `200`, `201`, and `10,000` matches, plus a Unicode identifier, 10,000-row grouping, 12 monthly buckets, and exact numeric bounds. A post-rollback check confirmed that no fixture rows remained.

### Privilege proof

Live catalog checks confirmed:

- `security_definer = false`;
- function volatility is stable;
- only `bidoc_data_query` can execute the function;
- the role can select only `public.data_index` among public tables;
- `anon`, `authenticated`, and `service_role` cannot execute this RPC.

## Known limitations and gates

- Exact execution is registered only for `public.data_index`. Other selected tables are `not_computable` until they receive a reviewed typed policy and fixed-table RPC.
- `data_index` has no meaningful business measure for sums or averages. The app therefore exposes only `min` and `max` for its numeric `id`; future measure-bearing tables should define their own semantics.
- Phase 2 does not add joins, arbitrary SQL, App/MAIN database access, or semantic document search.
- The live database migration is applied, but production HTTP proof still requires deployment secrets: `BIDOC_API_SECRET` and a trusted JWT whose role claim is `bidoc_data_query`.
- No browser behavior changed in Phase 2. The existing card can be checked for saved Content-only table selection, but correctness proof is API/database based.
- The full repository test command still contains unrelated pre-existing UI/static-contract failures; the focused Data Query block is green.

## Promotion gate for another table

Before another table becomes computable, require all of the following:

1. an explicit typed field policy and sensitivity review;
2. a fixed-table, structured-parameter, `SECURITY INVOKER` database function or equally constrained view contract;
3. least-privilege grants and RLS verification for `bidoc_data_query`;
4. trusted-SQL comparisons over live or representative data;
5. deterministic zero, boundary, Unicode, date, truncation, and 10,000-row fixtures;
6. workflow proof that no raw row values or filter values are persisted.
