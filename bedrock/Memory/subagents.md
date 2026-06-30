---
note_type: durable-memory-branch
project: bidoc agent
branch: subagents
last_updated: 2026-06-26
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
- The Data Query Agent lives in `src/subagents/dataQuery.js`; it plans Query Plan JSON, validates allowlisted plans, rejects raw SQL and joins, executes read-only Supabase REST fetches, and performs local count/group/aggregate/timeseries-style derivations.
- Data Query Agent settings are exposed under `settings.subagents.dataQuery` with enabled, LLM planner, planner model/timeout, plan/row limits, timeouts, allowed schemas/tables, aggregation, raw-SQL, and join flags.
- The Data Query Agent LLM planner uses OpenRouter JSON-object output against a compact schema manifest and falls back to the deterministic heuristic planner if the model is unavailable or returns an invalid/unsafe plan.
- The direct Data Query Agent test endpoint is `POST /api/subagents/data-query`.
- The Subagents tab in `public/app.js` includes a Data Query Agent card for draft settings and a direct test question run.
- The workflow UI and chat workflow logs include a `data_query` database node when the Main Agent invokes the Data Query Agent.
- The direct Data Query Agent test (`POST /api/subagents/data-query`) now creates its own run: it calls `createRun`, emits `data_query` run events per phase, builds a workflow log via `buildDataQueryWorkflowLog`, and records run history with `kind: "data_query"` so the run appears in the Workflow tab strip just like chat/insights/link-agent runs.
- `buildDataQueryWorkflowLog(result, { question, context })` in `src/subagents/dataQuery.js` builds the graph from the agent response: `dq_input` (trigger) → `dq_planner` (ai for llm / router for heuristic, flagged `fallback` when the LLM plan was rejected) → `dq_validation` (router) → one `dq_exec_<planId>` database node per executed plan → `dq_synthesis` (router) → `dq_output` (output), with per-node nodeDetails carrying the query plan, accepted plans, and row previews.
- The Subagents tab Data Query card sets `state.lastWorkflow` from the test response and shows a toast pointing to the Workflow tab; the run-history strip labels `data_query` runs as "סוכן שאילתות".
- The Data Query Agent's allowed tables are now chosen by scanning the real DB instead of a hardcoded manifest: `introspectSupabaseTables`/`parseOpenApiTables` in `src/subagents/dataQuery.js` read the PostgREST OpenAPI root (`GET {url}/rest/v1/`, no SQL/migration) and the endpoint `GET /api/subagents/data-query/schema` returns real tables+columns per connection (app/content, deduped by URL).
- The "app" and "content" schema aliases are NOT Postgres schemas — they are two real but separate Supabase connections (verified live: app/MAIN has 116 PostgREST tables, content has 42, all in `public`). The legacy hardcoded manifest was partly stale (e.g. referenced `meetings_documents`, which does not exist; real tables are `meetings`/`meetings_gf`).
- When the user picks tables, they are saved to `settings.subagents.dataQuery.tables` ([{ connection, schema, table, columns }]); `dataQuerySettings()` then builds the manifest from that selection via `buildDataQueryManifestFromSelection` (reusing `tableDef`) and derives `allowedTables`/`allowedSchemas` from it. If no selection is saved, it falls back to the legacy `buildDataQueryManifest` so existing behavior is preserved.
- The Subagents Data Query card replaced the free-text "Allowed tables override" + "Allowed schemas" fields with a "סרוק את ה-DB" button and a grouped, searchable checkbox picker (`.dqTablesPicker`); only checked tables are used by the agent.
- A real-SQL pipeline was added alongside the legacy JSON-plan path: `DATA_QUERY_PIPELINE_STEPS` defines 7 discrete, individually-runnable stages (user_question, schema_inspection, field_selection, sql_generation, sql_execution, calculation, result) in `src/subagents/dataQuery.js`. `runDataQueryStep` runs one stage from accumulated `state`; `runDataQueryPipeline` chains them.
- SQL execution goes through a Postgres RPC `exec_read_sql(q text, max_rows int)` that the user must create via a manual migration (read-only role `bidoc_readonly` + read-only transaction + statement_timeout). `execReadSql` calls it via `POST /rest/v1/rpc/exec_read_sql`; until the migration is run it returns "exec_read_sql RPC is missing — run the Supabase migration first". `validateReadOnlySql` is app-side defense-in-depth (SELECT/WITH only, single statement, no DDL/comments, tables ⊆ selection).
- Endpoints: `POST /api/subagents/data-query/step` (run one stage, returns output+state+openRouterUsage) and `POST /api/subagents/data-query/pipeline` (full run with run-history). The Subagents Data Query card has a step-by-step UI (`.dqPipeline`) with a ▶ play button per stage that shows each stage's output.
- Gotcha: app and content are two SEPARATE Supabase connections, so a single SQL statement cannot join across them; the field-selection step keeps all chosen tables on one connection. The exec_read_sql RPC must exist in each DB you want to query (MAIN covers the app tables).
- The pipeline is data-aware: `fetchTableSamples` pulls 2-3 real rows per candidate/selected table (read-only REST, no migration). Schema Inspection samples the selected tables (bounded), and Field Selection + SQL Generation receive those samples so the LLM grounds SQL in real column contents instead of guessing enums. The prompts instruct it to pick the table that actually has the needed column and, for tag/topic questions, to filter a hashtags/tags column with `ILIKE '%term%'` (or `= ANY(col)` for array columns).
- The `hashtags` column exists in `data_index_embeddings_gf_dor_agent` (text) and many `_gf` tables (emails_gf is an ARRAY type), but NOT in `alerts`/`alerts_gf`. So a "count delays by hashtag" question must target `data_index_...`, not the alerts tables — selecting the right table in the picker matters.
- The Data Query Agent is restricted to the CONTENT connection ONLY — it has no access to the main/app Supabase (project MAIN `pmdnmzuqbcnzgkuhpfnx`). Enforced in: `dataQuerySettings` (filters manifest to `schemaAlias==="content"`, drops non-content selection, `allowedSchemas=["content"]`), `pipelineConnection` (always content), `stepSchemaInspection` live-scan (content only), and the `GET /api/subagents/data-query/schema` endpoint (content target only). Defaults `allowedSchemas` and the selection default connection are now "content".
- The content connection points to the **Kapaim** Supabase project (`smxibuaowzuxkznuouwj`, ~42 tables: data_index, alerts, meetings, consultants_reports, etc. — most have a `hashtags` text column). MAIN holds the app's own internals (chat_messages_gf, agent_settings, delay_* , graph_*, the index embeddings) and is intentionally off-limits to this agent.

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

## Gotchas

- The Alert embeddings RPC currently receives only `query_embedding` and `match_count`; date bounds are applied after retrieval in local code.
- If no date range is classified, the chat-to-alert request leaves `dateFilter` empty and sends null date bounds.
- Data Query Agent v1 does not execute raw SQL or build joins; the LLM planner can only propose JSON plans that still must pass server-side validation before execution.

## Related

- See [chat](chat.md) for how the main agent routes tool calls.
