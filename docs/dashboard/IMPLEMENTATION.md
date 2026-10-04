# Dashboard implementation — 2026-10-04

## Delivered locally

AI interaction update: all dashboard analysis actions now submit immediately through the normal chat SSE endpoint in a new session, display the answer/sources in a modal and allow close or continuation in that exact session. Closing keeps the request running; the last analysis can be reopened. Persistence is checked through the normal session API before reporting success. Existing chat drafts are not changed until continuation. Validation used mocked SSE/session responses, not a live LLM run.

Latest reference-matching revision supersedes the slate workspace below: six colored metrics, attention cards left, schedule center, AI right spanning both rows; miniature Gantt, documents and updates below. The chart shows cumulative planned task finish counts derived from Gantt dates and is explicitly not actual progress. Compact Gantt retains saved alert associations and exposes its alert feed via an expand control. Build, seven model tests and UI composition/interaction/mobile tests passed.

Current UI supersedes the visual revision below: independent full-width workspace with slate app bar, unified metrics, main planning/worklist column and secondary status column. The dashboard stylesheet was replaced entirely. Sidebar/mobile shell hiding is scoped to the active dashboard; leaving restores the original app. Details use a side drawer. Workspace navigation and a return-to-app action remain available.

Visual revision: compact blue/white control-board styling based on the user's reference. Summary and five numeric tiles precede a shared Gantt/Timeline panel, followed by priority rows and domain count bars. The combined panel reads the configured alerts table and saved schedule activity-alert links, always scoped to project. It shows five task rows per page, up to 80 date markers and 30 alert summaries for the selected range/activity. Toggle schedule period/all time, click a task to filter its saved linked alerts, click markers or summaries for details. No inferred associations or source mutations. Old links to records absent from the current alerts table are not restored from backups here.

`http://localhost:4000/#dashboard` is a Hebrew RTL project-manager dashboard. The React island loads only while its panel is active. Project/version changes clear prior data and abort pending browser reads. The server computes a deterministic read model from canonical sources; it does not run schedule sweeps or extraction agents.

Features: four KPIs with honest unknown states, prioritized attention and source excerpts, decision review, schedule version selection and preview, milestones, recent indexed sources, record update filters, manual refresh, immutable snapshot history and historical membership drilldown. The AI action prepares a draft in the existing chat; the server validates the opaque context token and project before an explicitly sent request starts analysis.

All dashboard source reads use a GET-only adapter. Canonical records marked withdrawn/superseded are excluded. Recorded decisions can require attention without being counted as open decisions. Schedule indicators are isolated by file, engine and as-of date; non-activity bootstrap alerts are excluded from schedule KPIs. Missing progress is null, and stale Gantt dates are visible.

## Storage and deployment boundary

User confirmed KAPAIM (`smxibuaowzuxkznuouwj`). The installed connector lacked access to it; the authenticated, linked local Supabase CLI did have access. Applied only `supabase/migrations/20261004143119_dashboard_read_model_v1.sql` through `db query --linked --file`; no blanket `db push`, no historical migration replay or migration-ledger repair.

Added `dashboard_refresh_runs`, `dashboard_snapshots`, `dashboard_snapshot_items`, and `dashboard_publish_snapshot_v1`. RLS enabled; anon/authenticated have no table access or RPC execution. Service role has SELECT/INSERT only; publication uses a transaction and advisory lock, validates membership counts and reuses identical observations. New tables reference only other new tables. No changes to existing source records, tables, policies or triggers were issued by this implementation.

Existing schema fingerprint before and after: `ca6d45a8b4c6069f57ea6938c83c0007`, covering 177 public relations and 5,556 structural objects (new dashboard objects excluded). Initial real snapshot: `73f88ad5-1ca8-45e2-9a0c-39a2c2c4b313`; repeated publication returned the same snapshot ID.

The production repository remains reference-only and was not modified. This API is restricted to the local app's existing superadmin session and configured Company DB. Tenant routing, project-member authorization and a distributed cache are required before integration into production. Cache tokens are process-local, actor/connection bound, expire after five minutes and fail closed after restart.

## API implemented

Prefix `/api/dashboard/v1`; GET: `projects`, `overview?project_id=&file_id=`, `items?token=&metric=`, `evidence?token=&id=`, `history?project_id=`, `snapshot-items?project_id=&snapshot_id=&metric=`. POST: `refresh` with project_id/file_id, `snapshots` with token. Unknown request fields and client DB override headers are rejected. POST checks same-origin. Snapshot publication rereads sources before capture.

The earlier specification remains the target design; these initial paths differ from its proposed REST resource paths. Refresh loads current data; saving history is explicit.

## Remaining rollout work

- Daily worker entry point: `node scripts/capture-dashboard-snapshot.mjs <project-uuid>`. No unattended schedule was enabled. Connect to the production scheduler after agreeing hosting, time and project list.
- History starts at actual capture time; no historical backfill is fabricated. Current UI provides membership history, not a trend chart or baseline comparison.
- Validated project-wide progress, approved schedule baselines and delivery forecasts require additional source coverage and business rules; they remain unavailable.
- Production Company DB routing, member access, distributed cache, operational job monitoring and rollout are not included in this local first version.

## Verification

- `npm run react:build` passed.
- `node --test test/dashboard.test.js`: six tests passed (lifecycle/null semantics, cohort isolation, pagination, actor/connection isolation, writes limited to new RPC, auth/CSRF).
- Playwright `test/ui/dashboard.test.js`: UI assertion test passed, including detail/escape, 390px layout, null progress and chat draft. Windows web-server teardown did not terminate promptly and required interrupting the runner after the test passed.
- `supabase/tests/dashboard-read-model.sql` passed against KAPAIM: RLS, grants, RPC access, idempotency, invalid membership rejection. Test inserts were rolled back.
- Real read model: all 14 sources available; progress unavailable, 2 critical open items, 74 pending approvals, 0 activity-scoped open schedule alerts, 8 decisions for review. These are observations from source data, not independently verified site conditions.
- Source excerpt drilldown and real snapshot save/reuse were verified; browser displayed live data successfully. Security advisors returned no findings matching the new object names.
