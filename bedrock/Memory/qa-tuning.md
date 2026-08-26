---
note_type: durable-memory-branch
project: bidoc agent
branch: qa-tuning
last_updated: 2026-08-22
tags:
  - qa
  - mcp
  - tuning
---

# QA & Tuning MCP

## Current State

- Phase 1 of `docs/MCP DOR.MD` is implemented as a local stdio MCP server plus
  REST adapters over one shared `QaHarnessService`.
- The seven Phase 1 tools are `qa_create_test_suite`, `qa_get_test_suite`,
  `qa_add_test_cases`, `qa_run_query`, `qa_run_test_suite`, `qa_get_run`, and
  `qa_analyze_run`.
- `src/qa/` owns contracts, authorization, Supabase/in-memory repositories,
  isolated execution, trace redaction, deterministic/pipeline/evidence/semantic
  evaluation, scoring, stability, and run analysis.
- `src/mcp/` owns the local authenticated context, tool schemas/handlers, server
  factory, and stdio entry. Run it with `npm run mcp:qa`.
- `src/server.js` exposes matching `/api/qa/*` REST routes through the same
  service layer.
- `runChatPipeline` now accepts `executionMode` and `persistChatHistory`.
  `executionMode: "qa"` is ephemeral even if the legacy `ephemeral` flag is
  false: no normal chat row, session memory, long-term memory, or memory log is
  written.
- QA execution disables external/unapproved tools and preserves internal
  read-only retrieval tools. Denials are recorded as `SIDE_EFFECT_DENIED`.
- Pipeline events now cover heuristic override, query planning, embedding,
  retrieval filters/deduplication, tool selection, context construction, and
  source extraction so trace completeness is machine-readable.
- The Phase 1 App/MAIN migration is `supabase/migrations/20260822155219_qa_harness_phase1.sql`; it creates
  exactly five service-role-only tables: `qa_test_suites`, `qa_test_cases`,
  `qa_runs`, `qa_case_runs`, and `qa_evaluations`.
- Migration `20260822155219_qa_harness_phase1` is applied to App/MAIN Supabase
  project `pmdnmzuqbcnzgkuhpfnx`. Catalog verification confirms RLS on all five
  tables, service-role access, and no browser-role DML grants.
- The stdio runner is bounded and in-process. Durable cross-process jobs and an
  exposed cancellation operation remain deferred.
- Phase 2 experiments/snapshots and Phase 3 promotion/rollback are not yet
  implemented.

## Verification

- `node test/run-tests.js --filter "^qa"` passes the focused schema, service,
  isolation, authorization, concurrency, evaluator, REST, and real MCP contract
  tests.
- The MCP contract test uses the official v2 TypeScript client/server SDK over
  an in-memory transport.
- A live stdio smoke test against MAIN listed all seven tools, created and read
  a temporary suite/case through the MCP service, then removed the test data.
- `npm audit` reports zero known vulnerabilities for the updated lockfile.

## Recent Changes

- 2026-08-22 -- Implemented the Phase 1 QA harness vertical slice, local stdio
  MCP transport, shared REST boundary, five-table migration, evaluation stack,
  and focused contract tests.
- 2026-08-22 -- Applied migration `20260822155219_qa_harness_phase1` to MAIN and
  verified catalog security plus live MCP/PostgREST suite and case operations.
