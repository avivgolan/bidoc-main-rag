---
note_type: durable-memory-branch
project: bidoc agent
branch: dashboard
last_updated: 2026-10-04
---

# Central Project Dashboard

## Current State

- Period insights v4 renders one unnumbered conclusion per section; evidence lists remain in the full chat popup. Synthesis requests 8–16 words and a separate evidence section. An actor/token-authorized, bounded brief from the date-filtered dashboard (metrics/coverage, attention, activity, documents, schedule, timeline) enters synthesis only, avoiding routing keyword contamination. Unknowns and historical-status limitations are retained. Brief is deterministic, not another LLM call. Cache version forces regeneration.

- Attention-card Open Schedule now passes a navigation target to the miniature Gantt. It reads item evidence (recovering expired context), matches a saved alert source ID or a unique exact event title/summary, scrolls to the saved activity row, highlights its event and expands the date window to include it. Missing activity links show the event on the general track with an explicit message; missing events do not fabricate associations. Project/request guards prevent late navigation from older clicks.

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

- 2026-10-06 — Replaced multi-card insights with one prominent conclusion and popup evidence; added scoped synthesis brief. Thirteen dashboard tests and two mocked Chromium UI tests pass. Restarted local server; live model adherence to the new wording remains unverified.

- 2026-10-06 — Replayed the risks query from chat-memory run dashboard_1791306887588_9f7ef36538d018: negated formatting text triggered alert_lifecycle_status_not_computable before synthesis. Added shared analysis-only insight questions, v3 cache key and synthesis-only presentation instructions. Regression covers all three queries with date context while preserving genuine alert-count guards. Twelve dashboard tests and both mocked browser tests pass; live model output quality remains unverified.

- 2026-10-06 — Period insights now use a dedicated server-owned period-insights-v2 synthesis contract instead of the generic 150–250-word popup report. Requests ask for evidence-grounded cross-record themes and implications; output contract is 1–3 single-sentence conclusions (<=22 words) plus separate supporting sources, no task/alert inventory or invented trends. Mode passes through chat and daily cache key to invalidate old report answers. Preview cards show one conclusion without a second detail paragraph. Eleven unit tests and two mocked UI regressions passed, including mode propagation; server restarted. Live model quality still requires a fresh generated answer.


- 2026-10-06 — Period insights now render up to three numbered preview cards per section instead of full scrolling chat answers. Extracts first rendered list (paragraph fallback), preserves bold lead text, bounds preview lengths and clamps to two lines; no generated claims or severity inference. Section tints distinguish overview/risks/actions. Cards and footer open original full answer/citations in popup. Works with cached answers without regeneration. UI regression verifies long Markdown yields nine bounded cards and retains omitted detail in popup.


- 2026-10-06 — Added full-width DashboardInsights widget below KPIs with three independent sections: period overview, risks/blockers, recommended actions. Auto-starts three scoped chat jobs 400ms after mount; scope key includes project, schedule, date bounds and as-of day. Uses existing bridge/daily cache, persisted chat, notifications, inline safe answer renderer, individual retry and popup continuation. Unmount/current guards prevent old-range results replacing current insights. Fullscreen supported. Build and two mocked browser regressions passed (automatic execution, period token, late answers, partial failure, retry, existing popup/cache/navigation). Live model content was not part of regression.


- 2026-10-06 — Added dashboard from/to date controls with explicit Apply and whole-project reset (default unbounded history; no invented project start). Server validates dates/order and includes range in actor-bound cache keys. Domain records filter by source/event/detected date then created/updated; timeline uses data_date/created, documents primary_date/created, schedule tasks overlap selected bounds. Undated rows stay in default view but are excluded/reported for explicit ranges. Current lifecycle is not historical reconstruction. Snapshot refresh/source_versions and AI cache/context preserve range; final answer instructions constrain source dates. Filtered document reads scan beyond the recent-40 cap. Gantt resets on range changes and clips its axis. Ten backend tests and dashboard browser regression passed.


- 2026-10-06 — Added seventh KPI tile for safety incidents, using existing project_safety_items read model. Counts valid open/in_progress/monitoring items, excludes resolved/mitigated/withdrawn/superseded; missing coverage yields null. Standard metric membership powers details and snapshots. Eight model tests plus dashboard UI regression passed. No schema changes.


- 2026-10-06 — Mini/fullscreen Gantt now places activity title, planned start and planned finish columns left of the bars using an LTR four-column grid with RTL titles. Compact widgets allow horizontal overflow within the Gantt. Shared vertical scrolling/date-follow preserved; build and dashboard UI regression passed including column position/date assertions.


- 2026-10-05 — Restored immediate AI progress popup at user request. Users can wait for the answer in place or close and continue working while notifications remain active. Regression covers both waiting and closing during processing.


- 2026-10-05 — Dashboard AI opens its progress popup immediately and continues in the background if closed, with a header notification inbox, unread counts and a 6.5-second nonblocking top-layer toast on success/failure. Each job is tracked once, independent concurrent jobs retain their results, project-matched widget icons pulse while pending. Inbox/toast opens the original job; cached settled answers open directly, recheck keeps the progress popup open, same chat continuation unchanged. Inbox is page-lifetime state, not durable storage. UI regression covers pending/dedup/cache/reload/day rollover, out-of-order success/failure and toast expiry.
- 2026-10-05 — Restyled timeline event dialog with icon header, date/status strip and tinted source card; whatsapp_analysis/email_analysis now have friendly source labels. Live WhatsApp popup verified. Vite build and Chromium dashboard regression passed.


- 2026-10-05 — Event popup now shows stored alert input type (localized email/WhatsApp/document/meeting variants), input record ID, alert description, expandable analyzed source text and safe source link. Source reader includes existing input_data_type/input_data_id/analyzed_data/metadata fields; missing origin/link explicitly disclosed, no inference from title. Seven model tests and UI regression passed; local server restarted.

- 2026-10-05 — Timeline dots/feed entries and task bars now open DashboardEventDialog instead of inline details. Dots expose a viewport-clamped top-layer title tooltip on hover/focus, dismissed on leave/blur/wheel/touch. Schedule navigation highlights without automatically opening the modal. Build and Chromium regression passed including hover, popup content, and Escape closing only the event while fullscreen Gantt stays open.

- 2026-10-05 — Removed fullscreen controls/wrappers from all six top metric cards at user request, restoring their original spacing and detail click behavior. Fullscreen remains on the six main widgets. Build passed.

- 2026-10-05 — Fixed fullscreen control/header action overlap on narrow widgets using a shrinking title column, fixed action column and reserved expand-button space. Live DOM geometry verifies disjoint coverage/expand buttons with vertically aligned centers.

- 2026-10-05 — Refined widget expansion control to a 13px thin-stroke muted icon, transparent borderless button and subtle hover background. Retained 28px click area in both modes.

- 2026-10-04 — Added diagonal-arrow fullscreen controls to all twelve dashboard widgets using a persistent native dialog wrapper. Content stays mounted; Escape/minimize restores the widget. Fullscreen Gantt gets more visible rows and readable typography. Build and UI regression cover all twelve viewport-sized expansions and Escape; live browser Gantt expansion verified.

- 2026-10-04 — Fixed Open Schedule React crash: public overview deliberately omits items, so navigation now validates explicit projectId instead of reading view.items. UI fixture now mirrors public overview shape and checks React page errors. Build/UI regression passed. Live browser confirmed the electrical-drilling update opens its general-track event without crashing; it has no available activity association in the selected version.

- 2026-10-04 — Added item-specific Gantt navigation from attention cards. Build and Chromium regression passed for off-screen linked activity, event outside the task window, and unassigned event fallback.

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
