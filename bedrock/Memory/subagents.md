---
note_type: durable-memory-branch
project: bidoc agent
branch: subagents
last_updated: 2026-06-23
tags:
  - subagents
  - alert
  - meeting-evidence
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

## Recent Changes

- 2026-05-09 -- Alert agent calls from chat now pass structured date bounds separately from the human-readable date filter.
- 2026-05-09 -- Alert endpoint accepts `date_from` and `date_to` for direct subagent calls.
- 2026-05-10 -- Added dedicated Alert Agent visibility to the workflow graph and inspector.
- 2026-06-23 -- Added the BIDoc Principal Database Architect prompt specification.
- 2026-06-23 -- Added the Meeting Evidence Agent specification for citation-backed hybrid retrieval from `meetings_documents`.

## Gotchas

- The Alert embeddings RPC currently receives only `query_embedding` and `match_count`; date bounds are applied after retrieval in local code.
- If no date range is classified, the chat-to-alert request leaves `dateFilter` empty and sends null date bounds.

## Related

- See [chat](chat.md) for how the main agent routes tool calls.
