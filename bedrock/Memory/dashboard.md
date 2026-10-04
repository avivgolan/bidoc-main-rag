---
note_type: durable-memory-branch
project: bidoc agent
branch: dashboard
last_updated: 2026-10-04
---

# Central Project Dashboard

## Current State

- Detail drawers recover context_expired automatically: refresh the selected project/schedule overview, update dashboard counts/token, and reload the open evidence/metric drawer. One recovery per opened detail prevents loops; shared refresh promise and generation checks avoid concurrent refreshes and stale project updates. Other errors remain visible.

- Dashboard final-answer synthesis receives separate server-owned popup instructions (never included in routing/retrieval text): key findings first, then up to three next actions, then concise detail and citations (target 150–250 words maximum, no wide tables). The visible question/cache key remain unchanged; cached answers retain daily reuse and require recheck for the new format. Main chat follow-ups remain unrestricted.

- AI answers are reused per project, schedule file, item and trimmed question for the Israel calendar day. A per-key job map deduplicates in-flight calls; tab sessionStorage retains completed saved answers across reloads, with session-message authorization verification before replay. New-day clicks and the popup “בדוק מחדש” trigger a fresh dashboard source refresh and a new chat session. UI regression verifies same-day reuse, reload, forced refresh and date rollover.

- Dashboard AI now sends immediately via the existing `/api/chat` SSE pipeline with a dedicated session ID. `DashboardAiDialog.jsx` shows loading, formatted answer/sources and close/continue actions; it stays on the dashboard. Popup closure does not abort the run; a reopen action retains the last job and overlapping clicks reuse the pending job. Existing chat drafts/active conversations are untouched until explicit continuation.
- Before reporting saved or enabling continuation, the bridge rereads the normal session messages and verifies the returned message ID has an answer. Continue revalidates, loads that exact session, restores project context for follow-ups and navigates to chat. Existing message persistence is reused, with no new storage or schema. UI test mocks the SSE/session APIs and verifies immediate single send, close/reopen, formatted result, same-session continuation and mobile layout; live LLM generation was not part of this regression.

- User explicitly requested matching the supplied reference composition after rejecting the slate workspace. Current layout: six colored metric tiles; attention cards on the left, schedule/planning chart in the middle, fixed AI panel on the right; miniature Gantt, recent sources and updates below. Original sidebar remains hidden only on the dashboard. Three issue cards expose evidence, analysis and schedule actions. AI prompts send immediately and show answers in the dashboard popup. Compact Gantt preserves event markers and expands its alert feed on demand.
- Schedule chart is derived from actual planned task finish dates and shows cumulative planned completions (counts), not fabricated physical progress. Missing actual progress is still unavailable. UI test asserts six metrics and left/center/right reference positioning, plus interaction, mobile and sidebar restoration.
- `DashboardTimeline.jsx` combines miniature Gantt planning bars and Timeline alerts on one date axis. Activity paging was replaced by a continuous five-row scroll viewport; labels and bars share the same scroll surface. The default date window starts at the first visible task's start and ends at the last visible task's finish (partial visible rows included). ResizeObserver tracks actual row/viewport sizes; scrolling resumes follow mode after an all-time overview. Saved activity-link filtering and event detail remain. Dashboard sources are GET-only. Unassigned events stay on the general track; no association is inferred or written.
- Live verification on 2026-10-04: 102 tasks, 518 dated current alerts, 103 alerts with saved associations (131 link rows, including links absent from current alerts). No legacy alert restoration is performed in this dashboard. Seven unit tests and UI test (range switch, association filter, details, mobile, chat) passed after separating marker and bar click targets.

- On 2026-10-04 the user requested completion of the central project dashboard specification, including data sources and snapshot/storage choices, with eventual transfer from this app to production `avivgolan/bidoc`.
- The user explicitly selected a project-manager MVP: schedule, attention items, and decisions. Production repository access was authorized for understanding only; its code must not be changed under this scope.
- Product specification: [BIDoc_Project_Dashboard_Spec.md](../../docs/dashboard/BIDoc_Project_Dashboard_Spec.md).
- Proposed API/storage contract: [BIDoc_Dashboard_Data_Contract.md](../../docs/dashboard/BIDoc_Dashboard_Data_Contract.md).
- Initial implementation is live locally at `#dashboard`; details and remaining rollout work: [IMPLEMENTATION.md](../../docs/dashboard/IMPLEMENTATION.md). `src/dashboard/` provides a GET-only source reader, deterministic model, actor/connection-bound five-minute cache and authenticated API. The React page includes metrics, attention, evidence, schedule preview, decisions, records and snapshot history.
- User explicitly confirmed KAPAIM (`smxibuaowzuxkznuouwj`) for new tables and prohibited changing existing tables. Existing canonical source tables are read-only. Production repo code is untouched.
- Applied only migration `20261004143119_dashboard_read_model_v1.sql` via authenticated linked CLI: three new dashboard tables and an atomic publication RPC. No old migration replay. RLS enabled, no anon/authenticated grants, service_role SELECT/INSERT only. Existing schema fingerprint remained `ca6d45a8b4c6069f57ea6938c83c0007` across 177 relations/5556 structural objects.
- Manual snapshots persist actual observations with metric membership; identical publications reuse a snapshot. Daily worker entry point exists at `scripts/capture-dashboard-snapshot.mjs`; no unattended schedule is enabled. No historical backfill or trend chart is implemented yet.
- Local API uses superadmin session and configured Company DB only. Production transfer still needs Company DB routing, project-member authorization, distributed cache and scheduled job operations.
- Unit tests: `node --test test/dashboard.test.js` (6 passed); UI assertion test `test/ui/dashboard.test.js` passed (Windows teardown required interrupt). Live SQL tests verify RLS/grants, idempotency and membership rollback. Live source evidence, save/reuse and dashboard rendering verified.
- Production source was inspected at `e194d263fe4ebb183b69a38d25fbc5c79cbe43e8`; this is repository HEAD evidence, not proof of the deployed version.
- The production app already has a dashboard, unified `project_ai_alert_feed`, Company DB resolution from Meta, and domain registries for intelligence, delays, approvals, questions, safety, quality, commercial issues, progress and contracts.
- Read-only schema/count/distribution audits for the existing Semel pilot project are recorded under `Evidence/raw/dashboard-*-audit-2026-10-04.json`. Audit data is time-specific, not a permanent product truth.
- Existing [dashboard-pilot](dashboard-pilot.md) remains a separate enrichment/review workflow. Its overview is not a reliable all-history KPI source without version filtering and null handling.

## Confirmed Constraints

- `recorded` decisions must not be counted as requests still awaiting a decision. `needs_attention` and canonical lifecycle are independent dimensions; the production unified status mapping prioritizes attention over completed.
- A contract workspace is a document record, not proof of an active agreement. Its document type is distinct from commercial lifecycle.
- `schedule_indicator_snapshots` contains multiple as-of dates/data versions. Central dashboard counts require a coherent cohort, not a sum of historical rows.
- Existing `persistIndicatorSnapshots` checks same-day/engine/subject existence without differentiating source data version in its skip check. Same-day version changes need validation before treating persisted results as current.
- Missing/null progress and a Gantt reporting zero percent must not be described as verified physical project progress.
- Source table names and databases are project-specific; reuse [Schedule](schedule.md) project resolution and production Company DB conventions.

## Recent Changes

- 2026-10-04 — Compact AI popup header: 13px brand, 17px emblem, inline project name and 9px vertical padding. Question now 14px with tight spacing and no redundant label; expanded answer height allowance and matching mobile padding. CSS-only update.

- 2026-10-04 — Replaced expired-context manual refresh errors in detail drawers with automatic refresh/retry. Build and browser regression passed, including separate evidence and metric expiry cases.

- 2026-10-04 — Fixed popup prompt contamination: the formatting word ציטוטים caused the capability classifier to select meeting_evidence for the approvals question. Reproduced before/after routing locally (meeting_evidence vs hybrid_search). Moved formatting to final Main system instructions after dashboard authorization; original question remains the request text. Existing UI and seven dashboard tests passed; local server restarted. Live answer quality still requires a fresh run.

- 2026-10-04 — Added popup-oriented answer instructions to dashboard AI requests: summary points before actions and supporting detail.

- 2026-10-04 — Added daily AI answer reuse and explicit recheck; build and expanded Chromium regression passed with mocked chat responses.

- 2026-10-04 — Prepared a dashboard-only main commit, excluding unrelated local QA, schedule and pilot edits. Built the exact staged tree in isolation; all seven model/API tests and the Chromium dashboard/AI regression passed.

- 2026-10-04 — Added immediate dashboard AI answer popup through the main chat pipeline with verified session persistence and same-conversation continuation. Build and browser regression passed.

- 2026-10-04 — Replaced Gantt paging with continuous scrolling and visible-row date-window following. UI regression verifies initial/middle/end ranges, all-time-to-follow transition and mobile layout. Build passed; no DB changes.

- 2026-10-04 — Rebuilt layout to match the user's repeated reference image: six metrics, attention/schedule/AI columns, lower Gantt/documents/activity widgets and per-item action buttons. Build, seven model tests and UI regression passed; no DB writes.

- 2026-10-04 — Replaced dashboard shell and styling entirely after user feedback. Full-width control workspace, conditional sidebar hiding, compact rows and side-drawer details. Build and UI regression (including sidebar restoration/mobile) passed. No DB changes.

- 2026-10-04 — Reworked information density and styling based on user feedback; integrated miniature Gantt and Timeline alerts in a shared dashboard panel. No database writes or schema changes for this redesign.

- 2026-10-04 — Implemented first local dashboard and additive KAPAIM snapshot storage, verified read-only source boundary and unchanged existing schema. Production integration and unattended scheduling remain pending.

## Related

- [Dashboard enrichment pilot](dashboard-pilot.md)
- [Schedule](schedule.md)
- [Insights](insights.md)
