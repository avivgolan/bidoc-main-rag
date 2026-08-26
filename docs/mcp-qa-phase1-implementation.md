# BiDoc QA & Tuning MCP — Phase 1 implementation

This repository now contains the first end-to-end Phase 1 vertical slice from
`docs/MCP DOR.MD`.

## Implemented

- Five isolated `qa_*` tables, constraints, indexes, service-role-only RLS, and
  idempotency fields in `supabase/migrations/20260822155219_qa_harness_phase1.sql`.
- Shared framework-independent QA services in `src/qa/`.
- Isolated execution through the existing `runChatPipeline` with:
  - `executionMode: "qa"`
  - `persistChatHistory: false`
  - ephemeral sessions and no chat memory writes
  - external/unapproved tool side effects denied
  - normalized, redacted trace capture
- Deterministic, pipeline, evidence-policy, and constrained semantic evaluation.
- Versioned evaluator/profile output, fixed failure taxonomy, severity, root-cause
  confidence, recommendations, latency, usage, cost, and stability summaries.
- The seven Phase 1 MCP tools over local stdio.
- REST routes that call the same `QaHarnessService` as MCP.

## Database migration

The `supabase/migrations/20260822155219_qa_harness_phase1.sql` migration was
applied to the App/MAIN Supabase project (`pmdnmzuqbcnzgkuhpfnx`) on
2026-08-22. The MCP does not apply schema changes itself.

The migration intentionally grants no access to `anon` or `authenticated`.
Only the server-side `service_role` can read or write the QA tables. Tenant and
project scope are also checked in the service before every operation.

## Run the local MCP server

```powershell
npm run mcp:qa
```

The stdio process reserves stdout for MCP JSON-RPC and redirects existing BiDoc
pipeline diagnostics to stderr.

Optional server-owned environment context:

```text
BIDOC_MCP_ACTOR_ID=local-mcp
BIDOC_MCP_ORGANIZATION_ID=default
BIDOC_MCP_PROJECT_ID=<project-id>
BIDOC_MCP_ALLOWED_PROJECT_IDS=<project-id>,<another-project-id>
BIDOC_MCP_ROLES=QA_VIEWER,QA_OPERATOR
BIDOC_MCP_ENVIRONMENT=qa
```

If roles are omitted, the trusted local stdio process receives only
`QA_VIEWER,QA_OPERATOR`. Supplied project IDs never expand the configured
allow-list.

Example client configuration:

```json
{
  "mcpServers": {
    "bidoc-qa": {
      "command": "npm",
      "args": ["run", "mcp:qa"],
      "cwd": "C:\\Users\\dor thalamus\\Documents\\bidoc agent",
      "env": {
        "BIDOC_MCP_ORGANIZATION_ID": "default",
        "BIDOC_MCP_PROJECT_ID": "<project-id>",
        "BIDOC_MCP_ALLOWED_PROJECT_IDS": "<project-id>"
      }
    }
  }
}
```

## Phase 1 tools

1. `qa_create_test_suite`
2. `qa_get_test_suite`
3. `qa_add_test_cases`
4. `qa_run_query`
5. `qa_run_test_suite`
6. `qa_get_run`
7. `qa_analyze_run`

Every tool returns the common versioned envelope from the specification.
`qa_run_test_suite` returns `accepted`; poll with `qa_get_run`.

## REST routes

```text
POST /api/qa/test-suites
GET  /api/qa/test-suites/:suiteId
POST /api/qa/test-suites/:suiteId/cases
POST /api/qa/query
POST /api/qa/test-suites/:suiteId/runs
GET  /api/qa/runs/:runId
POST /api/qa/runs/:runId/analyze
```

These routes use the existing authenticated server boundary and the same
service methods as MCP.

## Verification

```powershell
node test/run-tests.js --filter "^qa"
```

The focused tests cover schema isolation, suite/case idempotency, project
authorization, the no-history execution contract, bounded concurrency,
repetition/stability, deterministic evaluator precedence, and an in-memory MCP
client/server contract test for all seven tools.

A live deployment smoke test also connected through the stdio MCP transport,
listed all seven tools, created a temporary suite and case in MAIN, read them
back, and removed the temporary records.

## Deliberately deferred

- Phase 2 snapshots, candidates, paired experiments, comparison, and clustering.
- Phase 3 approvals, promotion, immutable config versions, audit, and rollback.
- A durable cross-process job queue and an exposed cancellation operation. The
  current Phase 1 stdio/server runner is bounded and in-process; it marks
  execution failures explicitly but does not survive process termination.
- Remote MCP transport. The implementation is local stdio only, as required by
  the security plan.
