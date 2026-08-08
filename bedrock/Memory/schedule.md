---
note_type: durable-memory-branch
project: bidoc agent
branch: schedule
last_updated: 2026-08-08
tags:
  - schedule
  - contract
  - rag
---

# Schedule Intelligence

## Current State

- `src/scheduleEngine.js` is the pure deterministic calculation layer; it receives normalized inputs and performs no I/O or LLM calls.
- The CTO has locked the existing Schedule Engine and Calendar behavior as a protected baseline for Contracts Agent work. Contracts integration must be additive; changes to formulas, status, confidence, severity, basis, extensions, or calendar behavior require a separate approval.
- `src/subagents/schedule.js` orchestrates source loading, calculation, snapshots, health, and schedule-alert lifecycle.
- `src/scheduleIngestion.js` is the only schedule table/profile-aware layer. Uploaded Gantt source data is read from MAIN; engine-owned `schedule_*` data is read and written through the existing `APP DATA` connection (`contentSource`) whose Supabase project is KAPAIM (`smxibuaowzuxkznuouwj`).
- Schedule has no separate URL, project ID, key, or Settings card. Direct KAPAIM introspection confirms that `gantt_files`/`gantt_tasks` exist there but are empty; the active upload source is therefore MAIN's populated `_test` tables.
- The upload UI currently persists its schedule source in MAIN as `gantt_files_test` (1 row) and `gantt_tasks_test` (382 rows). Schedule source reads use those two MAIN tables; engine-owned `schedule_*` reads/writes remain on APP DATA/KAPAIM. The unsuffixed MAIN names return 404.
- Contract dates live in `schedule_contract_milestones`; relative obligations waiting for a trigger live in `schedule_contract_conditions`.
- Unlinked active contract milestones still produce milestone-only indicators and visible global contract markers; they do not need an activity mapping to appear.
- `src/subagents/scheduleConditionResolver.js` resolves pending conditions row by row: it plans an event-date question, calls the complete chat RAG path ephemerally, verifies an ISO date plus quote, source URL, and confidence, then computes the due date deterministically.
- Resolver searches require `project_id_filter`; older hybrid RPCs that cannot enforce it fail closed instead of widening to tenant-wide retrieval.
- The auto-promotion threshold is 0.8. Ambiguous, uncited, unsupported, or low-confidence results remain pending for review.
- `calendar_days`, `weeks`, `months`, integral-day `hours`, and `working_days` are supported. Working-day resolution requires a project calendar; sub-day deadlines stay unresolved because the milestone schema stores a date, not a timestamp.
- `POST /api/schedule/conditions/resolve` accepts `conditionId` for exact single-row processing. The Schedule UI exposes one AI action per condition row; batch mode remains API-only and capped at 25.
- Internal resolver questions do not write chat history or conversational memory. The standard chat path is unchanged for normal callers.
- The resolver's OpenRouter credential is SETTINGS-owned: every row action refreshes MAIN `agent_settings`, reads `data.secrets.openRouterApiKey`, and explicitly forbids the legacy environment fallback.
- Schedule-page auxiliary loads are isolated: missing alert or contractual-condition tables become visible warnings and no longer discard a successful schedule sweep.
- The eight existing KAPAIM tables are canonical for Contracts/Schedule work: `schedule_calendars`, `schedule_contract_milestones`, `schedule_contract_extensions`, `schedule_contract_conditions`, `schedule_indicator_snapshots`, `schedule_alerts`, `schedule_activity_map`, and `schedule_observed_events`. A 2026-08-08 read-only OpenAPI/HEAD audit reconfirmed all eight without DDL or data writes.
- Contracts Agent Phase 0 has a decision/baseline package, JSON Schema, page-grounded sample annotation, and synthetic variants under `docs/Indicator + Contracts/`. Phase 1 remains unstarted pending the approval checkpoint and is dry-run/no-persistence only.

## Recent Changes

- 2026-08-08 -- Completed the Contracts Agent Phase 0 evidence package: live read-only eight-table audit, existing-table reuse matrix, 47/47 Schedule regression baseline and protected hashes, output schema, page-grounded sample contract annotation, and representative synthetic variants. No runtime, database, or UI behavior changed.
- 2026-08-05 -- Moved the Gantt activity-label column to the left of the chart while preserving the timeline's left-to-right direction; aligned the time overlay and responsive 240/170px column offsets with the new layout.
- 2026-08-05 -- Split Schedule storage by responsibility after live verification: uploaded Gantt metadata/tasks are read from MAIN `gantt_files_test`/`gantt_tasks_test`, while calendars, contract data, snapshots, alerts, and conditions remain on APP DATA/KAPAIM. Browser verification loaded 1 schedule file and 382 tasks successfully.
- 2026-08-05 -- Corrected Schedule routing to reuse the single existing APP DATA (`contentSource`) URL/key and removed the mistakenly introduced Schedule/KAPAIM credentials. Live KAPAIM OpenAPI inspection verified the `app_data` profile (`gantt_files`/`gantt_tasks`) and showed that both source tables are empty; all required `schedule_*` tables exist, with only `schedule_calendars` containing one row.
- 2026-08-05 -- Added the pending contractual-condition pool and Schedule UI box.
- 2026-08-05 -- Added evidence-gated condition resolution through the existing chat RAG engine, deterministic due-date calculation, controlled promotion to milestones, API/UI integration, and regression tests.
- 2026-08-05 -- Replaced the bulk resolver control with a per-row contractual-condition table action and exact server-side `conditionId` isolation.
- 2026-08-05 -- Diagnosed live per-row resolver failure as an OpenRouter 401 (`User not found`) affecting both chat completion and embeddings; added actionable inline authentication errors and a Settings link.
- 2026-08-05 -- Confirmed the replacement MAIN Settings OpenRouter key works for chat and embeddings; the remaining live blocker is missing `schedule_alerts`, `schedule_contract_milestones`, `schedule_contract_conditions`, and `schedule_calendars` in the configured App Supabase Data API. Made optional Schedule loads fail independently so the contractor schedule remains usable with explicit warnings.

## Gotchas

- Never let an LLM calculate schedule offsets; only validated trigger evidence crosses into deterministic date arithmetic.
- A `found` result without both a pinpoint excerpt and a traceable source is treated as ambiguous.
- Recurring conditions remain pending and use the trigger date in the generated milestone key so later occurrences can create distinct milestones.
- The resolver first upserts the milestone and then patches the condition. Reruns are safe because milestone identity is stable.
- A configured key is not necessarily a valid key. The resolver maps OpenRouter 401/`User not found` to `openrouter_auth`; the UI must expose this instead of a generic search failure.
- Do not diagnose this resolver with `getConfig().openRouterApiKey` alone because generic config supports env fallback. Use the settings-owned boundary.
- A healthy Gantt source does not imply the Schedule schema is provisioned. `gantt_*` and every `schedule_*` table must be exposed by the KAPAIM Data API reached through APP DATA.
- PostgREST OpenAPI does not prove live indexes, constraints, triggers, RLS, policies, grants, or owners. An approved read-only catalog export remains mandatory before operational Contracts promotion in Phase 2.
- A gold contract annotation is evaluation evidence, not operational approval. Authority, project binding, human review, exact evidence, and an approved persistence target remain separate gates.

## Related

- See [chat.md](chat.md) for the RAG pipeline reused by the resolver.
- See [timeline.md](timeline.md) for the separate project Timeline UI.
