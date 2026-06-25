---
note_type: durable-memory-branch
project: bidoc agent
branch: delay-claims
last_updated: 2026-06-24
tags:
  - delay-claims
  - insights
  - frontend
  - supabase
---

# Delay Claims

## Current State

- The Insights page is exposed as the `#insights` SPA tab labeled `תובנות`.
- Stage 1 of `docs/contractor-delay-claim-agents-roadmap.md` is implemented as manual delay-claim infrastructure.
- Stage 2 is implemented as deterministic claim analysis scaffolding in `src/subagents/delayClaim.js`; it does not perform schedule calculations, legal conclusions, day counting, costs, or entitlement decisions.
- Stage 3 is implemented as deterministic deep analysis for existing delay events; it writes `delay_event_findings`, updates `delay_events.readiness_score`, and avoids final legal, cost, entitlement, or critical-path conclusions.
- Stage 4 is implemented as deterministic claim-package preparation; it writes schedule review rows, possible cost rows, and export rows while avoiding final cost entitlement, legal responsibility, or critical-path impact conclusions.
- The Insights page now starts with a project-insights agent that reads Content Index data directly through `POST /api/insights/analyze`; delay claim case management is a secondary/advanced area below it.
- Project insights analysis lives in `src/subagents/projectInsights.js` and detects evidence-backed groups for blockers/delays, approvals/decisions, missing information, commercial/cost signals, and quality/safety signals.
- Project insights workflow logs use nodes named `index_scan`, `focus_retrieval`, `signal_detection`, `insight_ranking`, and `insights_output`.
- App Supabase schema for delay claim infrastructure lives in `supabase/delay-claims.sql`.
- The migration creates `delay_claim_cases`, `delay_claim_sources`, `delay_events`, `delay_event_evidence`, `delay_event_gaps`, `delay_event_findings`, and `delay_event_change_log`.
- The App Supabase migration `create_delay_claim_tables` was applied to project `pmdnmzuqbcnzgkuhpfnx` on 2026-06-24.
- The App Supabase migration `create_delay_claim_stage4_tables` was applied to project `pmdnmzuqbcnzgkuhpfnx` on 2026-06-24.
- RLS is enabled on all seven delay claim tables; the server uses the configured service-role key for the app API.
- RLS is enabled on the Stage 4 delay tables: `delay_schedule_versions`, `delay_schedule_activities`, `delay_event_schedule_links`, `delay_cost_items`, and `delay_claim_exports`.
- Allowed human statuses are `candidate`, `approved`, `rejected`, and `needs_review`.
- Delay claim CRUD and validation helpers live in `src/supabase.js`.
- Delay claim API routes live in `src/server.js`:
  - `GET /api/delay-claims`
  - `POST /api/delay-claims`
  - `GET /api/delay-claims/:caseId/events`
  - `POST /api/delay-claims/:caseId/events`
  - `PATCH /api/delay-events/:eventId`
  - `POST /api/delay-events/:eventId/evidence`
  - `POST /api/delay-events/:eventId/gaps`
  - `POST /api/delay-events/:eventId/change-log`
- The Stage 2 analysis route is `POST /api/delay-claims/:caseId/analyze`; it accepts optional `projectId`, `dateFrom`, `dateTo`, `focusQuery`, and `sources`.
- Delay claim analysis maps sources from hybrid search, Timeline, and Project Graph, builds chronology, detects candidate events, merges related candidates, collects evidence, detects gaps/contradictions, and writes saved events/evidence/gaps.
- Delay claim analysis workflow logs use nodes named `source_mapping`, `chronology`, `delay_detection`, `event_merge`, `evidence_collection`, `gaps_contradictions`, and `write_results`.
- Delay event deep analysis uses `POST /api/delay-events/:eventId/analyze` and workflow nodes named `causality_agent`, `notice_agent`, `responsibility_agent`, `concurrency_agent`, `mitigation_agent`, `attack_agent`, `readiness_agent`, `quality_agent`, and `write_results`.
- Delay claim package generation uses `POST /api/delay-claims/:caseId/package` and workflow nodes named `schedule_analysis_agent`, `cost_damage_agent`, and `claim_output_agent`.
- The Insights UI currently supports creating a case, selecting a case, creating an event, changing event human status, and adding manual evidence.
- The Insights UI supports running an index-first project insight scan with optional focus query, date bounds, and source limit, then displays insight cards with source evidence.
- Delay claim case management remains available in the Insights UI as the advanced follow-up area.
- The Insights UI also supports running Stage 2 analysis for the selected case with optional focus query/date bounds and displays counts for created events, evidence, and gaps.
- The Insights event inspector supports Stage 3 event analysis, readiness display, attack-risk display, professional-review flag, and finding panels for causality, notices, concurrent delays, counter-arguments, and quality/gaps.
- The Insights case workspace supports Stage 4 package generation with contractual/actual completion date inputs, export type selection, dashboard metrics, recommended actions, and a workflow link.
- Event status changes through `updateDelayEvent` attempt to write `delay_event_change_log` with a `status_change` record.

## Recent Changes

- 2026-06-24 -- Added Stage 1 delay claim schema, CRUD/API, Insights tab UI, status controls, evidence entry, and focused validation tests.
- 2026-06-24 -- Added Stage 2 delay claim analysis subagent, analyze API route, Insights run button/status summary, workflow log nodes, and focused subagent/UI tests.
- 2026-06-24 -- Applied the delay claim Supabase migration, enabled RLS on the new delay tables, and smoke-tested SQL plus app REST writes with cleanup.
- 2026-06-24 -- Added Stage 3 delay event deep analysis endpoint, finding persistence, readiness scoring, UI summary panels, focused tests, and Supabase smoke verification with cleanup.
- 2026-06-24 -- Added Stage 4 schedule/cost/export tables, package-analysis endpoint, dashboard/export UI, focused tests, and Supabase smoke verification with cleanup.
- 2026-06-24 -- Re-centered the Insights tab on an index-first project-insights agent, added `POST /api/insights/analyze`, source-evidence UI cards, workflow logging, and focused tests.

## Gotchas

- A configured App Supabase without the `supabase/delay-claims.sql` migration will make `/api/delay-claims` fail with a missing table/schema error.
- The production App Supabase project now has the delay claim tables, so this missing-table gotcha applies only to other environments that have not run the migration.
- Re-running Stage 2 analysis against the same generated event keys may hit the `delay_events(case_id, event_key)` uniqueness constraint unless a future stage adds idempotent upsert behavior.
- Re-running Stage 3 event analysis appends another set of candidate findings; there is no dedupe/upsert layer for repeated deep-analysis runs yet.
- Re-running Stage 4 package generation appends another schedule version and export; cost items are de-duplicated within a single run but not upserted across repeated runs.
- The full Node test suite still has unrelated pre-existing UI assertion failures around Workflow OpenRouter metrics and Timeline mobile touch helpers; the delay claim validation tests pass before those failures.
