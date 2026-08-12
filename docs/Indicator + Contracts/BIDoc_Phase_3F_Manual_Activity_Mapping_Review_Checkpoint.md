# BIDoc Contracts Agent - Phase 3F Manual Activity-Mapping Review Checkpoint

- Date: 2026-08-12
- Status: Local implementation complete; stopped before Phase 3G
- Runtime scope: Authenticated manual mapping review and immutable history display
- Database scope: One local, service-role-only history-read RPC; not applied to KAPAIM
- Live writes: Disabled and not invoked
- Schedule arithmetic, alerts, deployment: Unchanged

## 1. Outcome

Phase 3F completes the local human-review surface for Contract-to-Schedule activity mapping. The server exposes strict same-origin history and manual-review routes, rebuilds every candidate set from current MAIN and KAPAIM state, and is the sole owner of reviewer identity, review time, evidence snapshots, correction continuity, and database credentials.

The Hebrew Contracts workspace now presents exact contract evidence, current Schedule version, maximum-five alternatives, confidence, activity dates and hierarchy, blockers, conflicts, a substantive reviewer reason, and immutable decision history. Reviewer-facing roles, actions, statuses, blockers, gates, and decisions use deterministic Hebrew labels; original contract quotations, original Schedule activity names, and technical identifiers remain visibly marked source evidence. It supports four manual outcomes only: confirm, reject, correct, and unmapped. Correction adds a superseding event; it never overwrites prior history.

This checkpoint does not enable a live write. `CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED` remains unset/false, the new history migration remains local, and no KAPAIM review RPC, mapping row, review event, Schedule calculation, alert, deployment, commit, or push occurred.

## 2. API contract

### `GET /api/contracts/activity-mapping/status`

Returns the Phase 3F API version, manual-review mode, history migration version, exact server-side activation state, and `automaticReviewActionsEnabled: false`.

### `GET /api/contracts/activity-mapping/history`

Accepted query fields:

- `sourceProjectId`: required authoritative MAIN project UUID;
- `documentVersionId`: optional `sha256:<64 hex>` filter;
- `candidateKey`: optional exact contract-candidate filter;
- `limit`: integer from 1 through 100.

The server calls only `bidoc_contracts_list_activity_mapping_reviews_v1` with the APP DATA/KAPAIM service role. The result retains event identity, reviewer/time/reason, selection, evidence, alternatives, conflict snapshot, result, and correction supersession.

### `POST /api/contracts/activity-mapping/review`

Accepted browser-owned fields are limited to:

- authoritative `sourceProjectId`;
- a typed mapping `obligation` derived from the extracted candidate;
- one manual `action` from confirm/reject/correct/unmapped;
- exact selected activity for confirm/correct;
- substantive reason;
- idempotency UUID;
- explicit conflict-resolution boolean;
- superseded immutable event ID for correction only.

Before the atomic write RPC, the server reloads the active project mapping, current MAIN Gantt, current KAPAIM mappings, and maximum-five alternatives. A stale/non-current selection, Schedule version conflict, unsafe blocker, missing evidence, unresolved ambiguity, invalid correction, or closed activation gate fails before the write.

## 3. Database addition and access boundary

Local migration `20260811214619_contracts_phase3f_mapping_review_history.sql` adds only:

```sql
public.bidoc_contracts_list_activity_mapping_reviews_v1(uuid, text, text, integer)
```

The function is `STABLE`, `SECURITY INVOKER`, uses an empty `search_path`, verifies `current_user = 'service_role'`, resolves the existing active MAIN-to-KAPAIM mapping, and reads the private immutable review table. Execute is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `service_role`. The migration adds no table, policy, mutation privilege, or browser access.

This follows Supabase's current guidance that service-role secrets remain backend-only and that function execution grants must be controlled explicitly in addition to RLS:

- [Secure your data](https://supabase.com/docs/guides/database/secure-data)
- [Database functions](https://supabase.com/docs/guides/database/functions)
- [Revoke function execution](https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A)

The Supabase CLI `migration new` command was attempted first. On this Windows/OneDrive checkout it failed with `LegacyMigrationNewWriteError: AlreadyExists` while creating the existing migrations directory, so the file was added with the CLI timestamp convention through the repository patch workflow. The migration itself was compiled and behavior-tested in the isolated local database.

## 4. Human-review behavior

- Approval means “promote this exact activity mapping through the atomic review transaction,” not “the contractual clause is legally valid.”
- Rejection means “do not promote any displayed alternative automatically yet.” The exact alternatives and evidence remain in immutable history.
- Unmapped is required when no alternative exists; rejection cannot disguise an empty candidate set.
- Correction must reference a prior event for the same document/candidate and preserves the established canonical identity while recording a newly selected current activity.
- Ambiguous alternatives require an explicit confirmation that trigger evidence, Schedule version, project binding, and the conflict were reviewed.
- Pending trigger evidence, inactive routing, version conflicts, alias ownership conflicts, invalid canonical identity, and stale selections remain fail closed.
- No automatic continuation action is exposed through the browser API or UI.
- Controlled reviewer terminology fails to a generic Hebrew label rather than exposing an unknown English enum value.
- Mapping-option cards wrap at desktop and mobile widths; the acceptance viewport showed no clipping, overlap, or horizontal overflow.

## 5. Verification

| Command | Exact result |
|---|---|
| `npm.cmd run test:contracts` | 79 tests passed, including Hebrew terminology, alternate-model timeout retry, validated-chunk resume, model-change invalidation, and six focused Phase 3F service/route/security tests |
| `npm.cmd run test:schedule` | 47 tests passed |
| `npm.cmd run test:contracts:phase3-db` | Isolated full Phase 3 database suite passed with 10 mapping rows, 6 immutable review events, and 8 confirmed winners |
| `npm.cmd run test:contracts:phase3-db:rollback` | Non-destructive rollback passed; 10 mapping rows and 6 review events preserved |
| `npm.cmd run test:contracts:ui` | Existing Phase 2 UI regression passed: 3 scenarios, 0 promotion calls |
| In-app browser acceptance | At 1634px: 12 cards render as 4/4/4 with 0 clipped cards/headings, 0 overlaps, 0 raw controlled English values, and 0px horizontal overflow; at 390px: 12 single-column cards with the same zero-defect metrics |
| `npm.cmd run test:contracts:phase3f:ui` | Desktop and 390px mobile passed; exact evidence/history, disabled gate, confirmation, correction, Hebrew controlled terminology, and no browser-owned identity/credentials |
| `npm.cmd run react:build` | Passed; 19 modules, 467.21 kB, 113.87 kB gzip |
| `node --check src/contracts/activityMappingReview.js` | Passed |
| `node --check src/server.js` | Passed |
| `git diff --check` | Passed |

The automated Phase 3F browser fixture uses isolated synthetic data. Its two activity alternatives and review events are not production claims and are never sent to KAPAIM.

The broader `npm.cmd test` command still reports the 12 pre-existing UI/source-contract failures carried from the Phase 3E baseline: one project-insights direction assertion, four Settings/retrieval-markup assertions, four workflow-inspector assertions, and three timeline-mobile wiring assertions. None of those source surfaces changed in Phase 3F; the focused Contracts, Schedule, database, and browser suites above pass.

## 6. Important files

- `src/contracts/activityMappingReview.js` - strict review/history parsing, server-owned preparation, activation gate, history transport, and atomic review transport.
- `src/server.js` - same-origin status/history/review routes.
- `src/react/ContractsPage.jsx` - Hebrew manual mapping review workspace and immutable history UI.
- `src/react/contractsHebrew.js` - deterministic Hebrew display vocabulary for controlled reviewer roles, actions, states, gates, blockers, and errors.
- `public/styles.css` - responsive Phase 3F workspace styles.
- `supabase/migrations/20260811214619_contracts_phase3f_mapping_review_history.sql` - local history-read RPC.
- `supabase/tests/contracts-phase3-activity-mapping.sql` - isolated history behavior/security assertions.
- `scripts/verify-contracts-phase3f-ui.mjs` - desktop/mobile browser proof.
- `test/contracts-agent.tests.js` - service, security, correction, activation, history, and route contracts.

## 7. Optional local inspection

1. Start the existing local server and open `http://localhost:4000/#contracts`.
2. Run a dry extraction, then open “סקירת קישור לפעילות בלוח”.
3. Check evidence, current version, alternatives, confidence, blockers, and conflict explanation.
4. Confirm the save button is disabled because the server-only activation gate is closed.
5. At desktop and phone width, confirm controls remain readable and no horizontal page overflow appears.

The live history request may report that the Phase 3F history migration is unavailable. That is expected until a separate KAPAIM apply is explicitly approved.

## 8. Stop gate

Phase 3F is locally complete. Do not apply migration `20260811214619` to KAPAIM, enable `CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED`, invoke the live review RPC, create a real mapping, begin Phase 3G upload reconciliation, integrate Schedule consumers/alerts, deploy, commit, or push without a separate explicit approval.
