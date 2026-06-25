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
