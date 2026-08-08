# Data Query Agent - Phase 3 routing and reusable contract

Status: implemented and verified on 2026-07-23.

## Outcome

Phase 3 turns the Phase 2 exact engine into a reusable internal service contract. Main Agent and authenticated callers now receive `data-query.v2`, including normalized caller identity, narrowed budgets, enforced date/project scope, deterministic routing, run-local deduplication, stable metrics, and `machineResult.metricsByRequestId`.

The Phase 0-2 safety boundary is unchanged: Content DB only, no raw SQL, no joins, no App/MAIN database access, and exact analytics only through approved fixed-table RPCs.

## Supported capability

The current supported domain is structured quantitative analysis over approved `data_index` metadata:

- total counts and zero counts;
- counts by source, status, severity/risk, processed state, or approved date field;
- distinct approved metadata values;
- top-N grouped counts;
- day/month time series;
- approved numeric bounds;
- caller-enforced project and date scopes.

The capability router rejects semantic interpretation and citation/evidence retrieval before either the LLM planner or database is called. It returns `needs_clarification`, `semantic_question_route_elsewhere`, and one suggested route:

- `delay_claim` for delay, claim, responsibility, and root-cause questions;
- `meeting_evidence` for meeting/quote evidence questions;
- `hybrid_search` for other semantic or source-content requests.

The suggestion is data, not an automatic tool invocation. The caller remains responsible for invoking the suggested agent.

## Versioned caller envelope

Supported sources are `main_agent`, `project_insights`, `delay_claim`, `workflow_qa`, and `api`. Missing or unknown sources normalize to `api` with `unknown_caller_source`.

```json
{
  "question": "How many indexed records are there by source?",
  "context": {
    "source": "project_insights",
    "runId": "run_20260723_01",
    "callerNodeId": "insights_metrics",
    "dateFrom": "2026-07-01",
    "dateTo": "2026-07-31",
    "projectId": "123e4567-e89b-42d3-a456-426614174000",
    "budget": {
      "maxPlans": 2,
      "maxRowsPerPlan": 100,
      "totalTimeoutMs": 10000
    }
  },
  "requestedMetrics": ["records_by_source"]
}
```

`runId` and `callerNodeId` accept only bounded identifier characters. Dates must parse correctly, `projectId` must be a UUID, and `dateFrom` cannot follow `dateTo`. `caseId` is rejected because the Content `data_index` contract cannot enforce a delay-case scope.

## Budget narrowing

A caller can narrow, but never expand:

- `maxPlans`;
- `maxRowsPerPlan`;
- `timeoutMsPerPlan`;
- `totalTimeoutMs`;
- `plannerTimeoutMs`.

A requested value above the configured value is ignored with `budget_expansion_ignored:<field>`. Invalid values are ignored with `invalid_budget_ignored:<field>`. The effective budget is returned under `caller.budget` for auditability.

## Scope enforcement

Caller scope is added to every planned query before validation:

- `projectId` becomes an equality filter on `project_id`;
- `dateFrom` becomes an inclusive `gte` filter on the approved plan/default date field;
- a date-only `dateTo` on a timestamp field becomes `lt` the next UTC day, preserving the entire requested final day;
- unsupported scope fails before execution rather than being silently ignored.

Planner-supplied filters can narrow the result further but cannot remove caller scope.

## Run-local deduplication

When `runCacheEnabled` is true and `runId` is present, exact normalized plans are keyed by:

```text
runId + SHA-256(schema, table, operation, select, sorted filters,
                groupBy, metrics, orderBy, date field, granularity, limit)
```

Equivalent filter order produces the same signature. A hit avoids a second database request, marks the plan `cacheHit: true`, and adds `served_from_run_cache` without turning an otherwise exact response into `partial`.

The cache is process-memory only, defaults to a 60-second TTL, is capped, and is not shared across Vercel instances or cold starts.

## Machine response contract

```json
{
  "contractVersion": "data-query.v2",
  "status": "ok",
  "caller": {
    "source": "workflow_qa",
    "runId": "run_20260723_01",
    "callerNodeId": "qa_metrics"
  },
  "routing": {
    "supported": true,
    "domain": "content_metadata_metrics"
  },
  "machineResult": {
    "contractVersion": "data-query.v2",
    "requestedMetrics": ["records_total"],
    "metricsByRequestId": {
      "records_total": [
        {
          "id": "records_total__count__all",
          "planId": "index_count",
          "value": 1248,
          "exactness": "exact"
        }
      ]
    },
    "planStatusByRequestId": {
      "records_total": [
        {
          "planId": "index_count",
          "status": "ok",
          "exactness": "exact",
          "cardinality": 1248,
          "cacheHit": false
        }
      ]
    }
  }
}
```

When requested metric IDs are supplied, the validator accepts only those IDs. Missing plan `requestId` values are assigned deterministically by caller order. Metric IDs use the caller request ID, calculation alias, and stable group hash, so callers do not depend on planner-generated plan names.

Machine consumers must read numeric facts from `machineResult`, never parse `answer`. Main Agent's system contract now states this explicitly.

## Workflow and UI

Workflow logs include a first-class Capability Router node plus contract version, caller source, parent run ID, caller node ID, route decision, machine result, and cache-hit count. Database execution nodes are absent when routing rejects a question.

The Subagents card now exposes:

- `Run-local dedup cache`;
- `Run cache TTL (ms)`.

No secret or raw filter value is displayed. The existing selected Content table remains `data_index`.

## Verification

The focused Data Query suite now contains 31 passing tests. Phase 3 coverage includes:

- source and caller-ID normalization;
- budget narrowing and expansion rejection;
- semantic/citation routing with zero planner and database calls;
- project/date scope enforcement and inclusive final-day semantics;
- order-independent plan signatures and same-run deduplication;
- versioned metric mapping without prose parsing;
- cache settings and caller-aware workflow metadata;
- Main Agent machine-result consumption rules.

The full repository test command still has the same 11 unrelated UI/static-contract failures recorded in the earlier phases.

### Manual acceptance - 2026-07-23

The operator confirmed the Phase 3 card on `http://localhost:4000/#subagents`:

- the description declares `data-query.v2`;
- the run-local deduplication cache is enabled;
- the cache TTL is `60000`;
- `data_index` remains the only selected Content table.

The earlier local HTTP production-gate probe returned HTTP `503` before `BIDOC_API_SECRET` was configured. Phase 3.1 has since confirmed that `BIDOC_API_SECRET` is present locally and replaced the static token requirement with a managed Supabase Auth service account.

## Remaining gates

- Production HTTP smoke still requires provisioning the managed service account described in `docs/data-query-agent-phase3-1-managed-auth.md`.
- `project_insights`, `delay_claim`, and `workflow_qa` can use the contract but are not automatically changed to invoke Data Query in this phase.
- Exact analytics remain limited to `public.data_index`.
- Cross-table relations and joins remain unsupported.
- Cache is intentionally run-local rather than persistent.
