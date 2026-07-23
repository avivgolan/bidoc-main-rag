---
note_type: durable-memory-branch
project: bidoc agent
branch: subagents
last_updated: 2026-07-23
tags:
  - subagents
  - alert
  - meeting-evidence
  - delay-claim
  - data-query
---

# Subagents

## Current State

- The Alert subagent lives in `src/subagents/alert.js`.
- Alert subagent settings are stored under `settings.subagents.alert`; the UI for them lives in the Subagents tab in `public/app.js`.
- The Alert subagent searches the configured Supabase embeddings table, defaulting to `alerts_embeddings_gf`, through an RPC named `match_<table>`.
- The test endpoint `POST /api/subagents/alert` is handled in `src/server.js`.
- Alert requests can include `dateFilter`, `dateFrom`, and `dateTo`.
- When `dateFrom`/`dateTo` are present, Alert filters returned rows by `date`, `metadata.date`, `created_at`, or `metadata.created_at`.
- The workflow UI has a first-class `alert_agent` node for Alert runs.
- The database-agent specification is stored at `prompts agents - dor/bidoc-principal-database-architect.md`; it defines PostgreSQL/Supabase ownership, database safety rules, and the Hebrew reporting contract.
- The approved Meeting Evidence Agent specification is stored at `docs/meeting-evidence-agent-spec.md`; it targets only `public.meetings_documents` and defines hybrid vector/text retrieval, adjacent-chunk expansion, and exact citation evidence for the main agent.
- The contractor delay-claim agent roadmap is stored at `docs/contractor-delay-claim-agents-roadmap.md`; it splits the proposed claim-building agent system into four implementation stages aligned with the existing Node/SPA, Supabase, Timeline, Project Graph, Workflow, and Meeting Evidence Agent infrastructure.
- The Delay Claim subagent lives in `src/subagents/delayClaim.js`; Stage 2 maps sources, builds chronology, detects/merges delay event candidates, collects evidence, detects gaps/contradictions, and emits workflow-log nodes without legal, cost, entitlement, or schedule-critical-path conclusions.
- Delay Claim Stage 3 deep analysis also lives in `src/subagents/delayClaim.js`; it analyzes existing events for causality, notices, possible responsibility, concurrency, mitigation, attack risk, readiness, and quality review while persisting candidate findings only.
- Delay Claim Stage 4 package preparation also lives in `src/subagents/delayClaim.js`; it creates schedule review links, possible cost items, dashboard metrics, and Markdown/JSON exports without final entitlement or critical-path conclusions.
- The Data Query Agent implementation prompt is stored at `docs/data-query-agent-codex-prompt.md`; it specifies a read-only, allowlisted Query Plan subagent with multi-query support, safe Supabase execution, Main Agent integration, Workflow visibility, Settings UI, and tests.
- The Data Query Agent lives in `src/subagents/dataQuery.js`; it plans Query Plan JSON, validates allowlisted typed plans, rejects raw SQL and joins, and uses a fixed-table database RPC for exact quantitative operations over `public.data_index`.
- Data Query typed field capabilities and sensitivity rules live in `src/subagents/dataQueryMetadata.js`. Content fields are excluded from quantitative planning, and unregistered exact operations return `not_computable`.
- Data Query Agent settings are exposed under `settings.subagents.dataQuery` with enabled, LLM planner, planner model/timeout, plan/row limits, timeouts, and Content-only allowed tables. Dead raw-SQL, join, and approval flags were removed in Phase 0.
- The Data Query Agent LLM planner uses OpenRouter JSON-object output against a compact schema manifest and falls back to the deterministic heuristic planner if the model is unavailable or returns an invalid/unsafe plan.
- The direct Data Query Agent endpoint is `POST /api/subagents/data-query`; it fails closed unless `BIDOC_API_SECRET` is configured and supplied as `X-Bidoc-Api-Secret`.
- The Subagents tab in `public/app.js` includes a Data Query Agent card for Content table settings. Direct browser execution and schema scanning were retired; testing uses the Main Agent or the authenticated HTTP endpoint.
- The workflow UI and chat workflow logs include a `data_query` database node when the Main Agent invokes the Data Query Agent.
- The direct Data Query Agent test (`POST /api/subagents/data-query`) now creates its own run: it calls `createRun`, emits `data_query` run events per phase, builds a workflow log via `buildDataQueryWorkflowLog`, and records run history with `kind: "data_query"` so the run appears in the Workflow tab strip just like chat/insights/link-agent runs.
- `buildDataQueryWorkflowLog(result, { question, context })` in `src/subagents/dataQuery.js` builds the Data Query workflow graph. Execution-node details retain the accepted plan, row count/status, and field names but never raw source-row previews.
- Data Query tables are provisioned deliberately in settings and in the database migration. The browser no longer performs privileged OpenAPI schema discovery.
- The `content` schema alias is a connection selector, not a Postgres schema. It points only to Kapaim Content; the actual approved table is in Postgres schema `public`.
- When the user picks tables, they are saved to `settings.subagents.dataQuery.tables` ([{ connection, schema, table, columns }]); `dataQuerySettings()` then builds the manifest from that selection via `buildDataQueryManifestFromSelection` (reusing `tableDef`) and derives `allowedTables`/`allowedSchemas` from it. If no selection is saved, it falls back to the legacy `buildDataQueryManifest` so existing behavior is preserved.
- The Subagents Data Query card shows the saved Content table selection without a privileged scan or direct-run control.
- Phase 0 retired the model-generated SQL pipeline. Its helpers are private compatibility code only; the step/pipeline endpoints and UI are removed, and the typed Query Plan path is the sole supported runtime.
- The Kapaim `public.exec_read_sql(text, integer)` RPC was dropped in the live Phase 0/1 migration. The tracked `supabase/data-query-exec-read-sql.sql` now decommissions the RPC and provisions the least-privilege `bidoc_data_query` role instead.
- The canonical Query Plan runtime never emits or executes SQL and cannot join across connections.
- The `hashtags` column exists in `data_index_embeddings_gf_dor_agent` (text) and many `_gf` tables (emails_gf is an ARRAY type), but NOT in `alerts`/`alerts_gf`. So a "count delays by hashtag" question must target `data_index_...`, not the alerts tables — selecting the right table in the picker matters.
- The Data Query Agent is restricted to the CONTENT connection ONLY; it has no access to the main/app Supabase (project MAIN `pmdnmzuqbcnzgkuhpfnx`). Config normalization drops non-Content selections, the manifest contains only Content tables, and `allowedSchemas` is always `["content"]`. The schema-scan endpoint was removed.
- The content connection points to the **Kapaim** Supabase project (`smxibuaowzuxkznuouwj`, ~42 tables: data_index, alerts, meetings, consultants_reports, etc. — most have a `hashtags` text column). MAIN holds the app's own internals (chat_messages_gf, agent_settings, delay_* , graph_*, the index embeddings) and is intentionally off-limits to this agent.

- The current-state audit is `docs/data-query-agent-current-state-audit.md`; its Phase 0/1 status section records the implemented security baseline. Operator and deployment instructions are in `docs/data-query-agent-phase0-phase1-operations.md`.
- The Phase 2 exactness contract and live/gold verification evidence are in `docs/data-query-agent-phase2-correctness.md`.
- Data Query Phase 3 uses the versioned `data-query.v2` caller/response contract. It normalizes caller source/run identity, only narrows caller budgets, enforces project/date scope, routes semantic/citation questions without database execution, deduplicates identical plans within one run, and returns `machineResult.metricsByRequestId` for machine consumers.
- Main Agent passes its run ID and caller node to Data Query and must consume numeric facts from `machineResult`, not the display-oriented `answer`.
- Phase 3 contract and verification details are in `docs/data-query-agent-phase3-contract.md`.
- Data Query Phase 3.1 uses a dedicated Supabase Auth service account with `app_metadata.data_query_role=bidoc_data_query`. The runtime validates, caches, and refreshes short-lived tokens; the static custom-role JWT is compatibility-only.
- The live Phase 3.1 wrapper is claim-gated `SECURITY DEFINER` with an empty search path. `bidoc_data_query` remains `NOLOGIN` and has no direct table/sequence privileges; API roles cannot execute the fixed-table implementation function.
- If the optional Data Query table selection is missing from persisted Settings, the manifest now falls back to the exact `data_index` contract, not the hybrid-search embedding table.
- Data Query managed authentication and provisioning explicitly reject `contentSource.usesAppSupabase=true`. Local Phase 3.1 acceptance uses the explicit Kapaim Content host; never provision against MAIN.
- Phase 3.1 implementation and provisioning instructions are in `docs/data-query-agent-phase3-1-managed-auth.md`.

## Recent Changes

- 2026-05-09 -- Alert agent calls from chat now pass structured date bounds separately from the human-readable date filter.
- 2026-05-09 -- Alert endpoint accepts `date_from` and `date_to` for direct subagent calls.
- 2026-05-10 -- Added dedicated Alert Agent visibility to the workflow graph and inspector.
- 2026-06-23 -- Added the BIDoc Principal Database Architect prompt specification.
- 2026-06-23 -- Added the Meeting Evidence Agent specification for citation-backed hybrid retrieval from `meetings_documents`.
- 2026-06-24 -- Added the contractor delay-claim agent roadmap with four staged Codex implementation prompts.
- 2026-06-24 -- Added the Delay Claim Stage 2 subagent implementation and analyze API integration.
- 2026-06-24 -- Added Delay Claim Stage 3 event deep-analysis agents, workflow nodes, finding persistence, readiness scoring, and UI integration.
- 2026-06-24 -- Added Delay Claim Stage 4 package agents, schedule/cost/export persistence, dashboard UI, and Supabase migration.
- 2026-06-26 -- Added the Data Query Agent Codex prompt for safe multi-table read-only query planning and execution.
- 2026-06-26 -- Implemented the Data Query Agent with a read-only allowlisted executor, direct API endpoint, Subagents UI card, workflow node, Main Agent integration, and focused validator/executor tests.
- 2026-06-26 -- Added the Data Query Agent LLM planner with JSON-only prompt, planner settings UI, OpenRouter workflow telemetry, unsafe-plan audit warnings, and fallback to the deterministic planner.

- 2026-07-22 -- Added a current-state source map, risk audit, test-gap analysis, and phased hardening roadmap for the Data Query Agent.
- 2026-07-22 -- Completed Data Query Phase 0/1 baseline: canonical Content-only Query Plan, strict direct-API secret, dedicated database-role token, total deadline, redacted workflow details, retired SQL/schema routes and UI, and a live Kapaim migration that removed `exec_read_sql` and provisioned `bidoc_data_query` with `SELECT` only on `public.data_index`.
- 2026-07-22 -- Completed Data Query Phase 2 correctness hardening: typed field policy, exact fixed-table analytics RPC, explicit exactness/cardinality/provenance, planner-inclusive deadline, 25 focused tests, trusted-SQL comparison over 1,248 live rows, and a rolled-back 10,000-row gold fixture.
- 2026-07-23 -- Completed Data Query Phase 3 routing/reuse contract: `data-query.v2`, normalized caller envelope, narrowing budgets, enforced date/project scope, semantic route-away, same-run dedup cache, machine metric mapping, workflow caller metadata, UI cache controls, and 31 focused tests.
- 2026-07-23 -- Applied Data Query Phase 3.1 managed-auth hardening to Kapaim: short-lived Supabase Auth service tokens, immutable service claim, no raw `data_index` grant, guarded exact wrapper, inaccessible implementation function, 35 focused tests, and positive 1,248-row/negative 42501 live proofs. Service-account provisioning and the HTTP smoke test remain.
- 2026-07-23 -- Phase 3.1 provisioning audit found the local Content connection falling back to MAIN. The newly created wrong-project Auth user was deleted and verified absent; provisioning/runtime now reject App fallback, 36 focused tests pass, and explicit Kapaim Content credentials are the continuation gate.
- 2026-07-23 -- Completed local Phase 3.1 acceptance against Kapaim: confirmed managed Auth identity and immutable marker, successful live LLM-planned exact count of 1,248, same-run cache hit, HTTP 401 API-secret negatives, semantic route-away, forbidden-table rejection, and 36 passing Data Query tests. Deployment propagation and production smoke remain.

## Gotchas

- The Alert embeddings RPC currently receives only `query_embedding` and `match_count`; date bounds are applied after retrieval in local code.
- If no date range is classified, the chat-to-alert request leaves `dateFilter` empty and sends null date bounds.
- Data Query Agent v1 does not execute raw SQL or build joins; the LLM planner can only propose JSON plans that still must pass server-side validation before execution.

## Related

- See [chat](chat.md) for how the main agent routes tool calls.
