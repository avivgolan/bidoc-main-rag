---
note_type: durable-memory-branch
project: bidoc agent
branch: qa-tuning
last_updated: 2026-09-01
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
- The chat improvement Phase 0 smoke harness is local and hermetic. It uses
  `test/fixtures/chat-quality-smoke.v1.json`, current pure routing helpers, and
  synthetic sanitized reference answers. It makes no model, network, database,
  production, prompt, or routing changes.
- `npm run test:chat-quality` runs six harness tests plus the 12-case evaluator
  gate. `npm run chat:eval` writes a dated Markdown report under
  `docs/evaluations/`.
- `npm run test:chat-integrity` runs ten focused completion tests:
  detailed-contract compatibility, invalid-finish rejection, cache safety, one
  retry, fallback, no-retry error classes, policy preservation, workflow states,
  and customer-safe missing-evidence wording.
- `npm run test:chat-payload` runs nine focused Phase 2 tests for stable evidence
  IDs, deduplication, conflict retention, exact Data Query facts, one compact
  evidence representation, deterministic budgeting, rollback defaults, and
  content-free QA visibility, and bounded minimal-tool retry payloads.
- Phase 2 Workflow and QA summaries expose payload mode/contract, estimated input
  tokens, selected evidence count, duplicates removed, budget state, and retry
  estimate without copying evidence text into the new metrics.

## Verification

- `node test/run-tests.js --filter "^qa"` passes the focused schema, service,
  isolation, authorization, concurrency, evaluator, REST, and real MCP contract
  tests.
- The MCP contract test uses the official v2 TypeScript client/server SDK over
  an in-memory transport.
- A live stdio smoke test against MAIN listed all seven tools, created and read
  a temporary suite/case through the MCP service, then removed the test data.
- `npm audit` reports zero known vulnerabilities for the updated lockfile.
- The Phase 0 chat-quality suite passes 12/12 cases and 351/351 deterministic
  assertions. Runtime latency, token, and cost coverage remains explicitly
  unmeasured until a separately approved live read-only evaluation.
- The completion-integrity suite passes 10/10 focused tests. The full local
  suite passes 591 tests and retains 13 previously documented unrelated
  frontend/static assertion failures.
- The Phase 2 payload suite passes 9/9 focused tests. The deterministic size
  fixture dropped from 66,320 to 4,060 estimated tokens. The full local suite now
  now has 601 passing tests and retains the same 13 frontend/static assertion
  failures. Controlled live checks completed semantic Main, broad Main, and
  exact-invoice/Data Query cases. Direct semantic citation links remain open.

## Recent Changes

- 2026-09-01 -- Completed the QA-visible Phase 2 local live checkpoint with nine
  payload tests, ten integrity tests, failure-path telemetry coverage, bounded
  broad tool payloads, and actual provider token/finish/cost/latency evidence.
  Direct semantic citation links remain open and the default flag remains off.
- 2026-08-22 -- Implemented the Phase 1 QA harness vertical slice, local stdio
  MCP transport, shared REST boundary, five-table migration, evaluation stack,
  and focused contract tests.
- 2026-08-22 -- Applied migration `20260822155219_qa_harness_phase1` to MAIN and
  verified catalog security plus live MCP/PostgREST suite and case operations.
- 2026-08-31 -- Added the Phase 0 local chat-quality smoke harness, strict
  12-case schema, code-backed route probes, npm commands, and baseline report.
- 2026-08-31 -- Added the Phase 1 completion-integrity tests and checkpoint,
  covering detailed finish metadata, invalid-completion rejection, cache safety,
  one bounded retry, truthful workflow states, and stable failure reason codes.
