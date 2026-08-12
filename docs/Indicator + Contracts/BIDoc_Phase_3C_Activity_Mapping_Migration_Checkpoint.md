# BIDoc Contracts Agent - Phase 3C Activity-Mapping Migration Checkpoint

- Date: 2026-08-11
- Status: Local package verified and remotely applied in Phase 3D; stopped before Phase 3E
- Scope: Exact additive schema/DCL, atomic mapping-review functions, isolated database tests, and a non-destructive rollback
- Live database changes: KAPAIM migrations `20260811170622` and `20260811171813`; zero mapping or review-event rows
- Application changes: None; no API, UI, Schedule ingestion, Engine, calendar, indicator, or alert integration
- Deployment: None

## Outcome

Phase 3C now has an exact, reviewable migration package rather than a conceptual schema proposal. The migration reuses the existing `public.schedule_activity_map` and the approved Phase 2 `private.schedule_contract_project_mappings`; it adds only the missing hardening, immutable mapping-review history, and backend-only transactional entry points.

The package was compiled and behavior-tested from a clean state in the repository's dedicated local Supabase PostgreSQL container. Phase 3D subsequently applied the approved primary migration and one advisor-driven composite-index follow-up to KAPAIM. See [BIDoc Phase 3D Activity-Mapping Remote Apply Checkpoint](./BIDoc_Phase_3D_Activity_Mapping_Remote_Apply_Checkpoint.md).

## Delivered files

- `supabase/migrations/20260811170622_contracts_phase3_activity_mapping_review.sql`
- `supabase/migrations/20260811171813_contracts_phase3_cover_project_mapping_fk.sql`
- `supabase/rollbacks/contracts_phase3_activity_mapping_review.rollback.sql`
- `supabase/tests/contracts-phase3-existing-activity-map-baseline.sql`
- `supabase/tests/contracts-phase3-activity-mapping.sql`
- `supabase/tests/contracts-phase3-cleanup.sql`
- `supabase/tests/contracts-phase3-post-rollback.sql`
- `scripts/test-contracts-phase3-db.mjs`
- `package.json` scripts `test:contracts:phase3-db` and `test:contracts:phase3-db:rollback`

## Exact database package

### Existing mapping table hardening

The migration validates existing data before enforcing:

- canonical keys shaped as `schedule-activity:<uuid>`;
- controlled alias-source, match-method, and status vocabularies;
- finite confidence in `[0,1]`;
- consistent manual/automatic confirmation fields;
- source-specific alias shapes;
- a partial unique winner index for confirmed `(project_id, alias_source, alias)` values;
- focused review-queue, alias-lookup, and canonical-status indexes.

### Immutable review evidence

`private.schedule_activity_mapping_review_events` is an RLS-enabled append-only companion table. It preserves:

- stable event-key idempotency and a submission fingerprint;
- explicit correction/supersession lineage;
- exact approved project mapping, source document version, candidate, milestone, and Schedule version;
- selected canonical/mapping/activity identity and confidence;
- reviewed alternatives, evidence, conflicts, reason, reviewer, and time;
- the exact bounded submission and result snapshots.

The existing Phase 2 immutable-audit trigger rejects updates and deletes. No browser policies are created.

### Backend-only functions

Both public functions are `SECURITY INVOKER`, pin an empty `search_path`, reject any caller other than `service_role`, and have execute privileges revoked from `public`, `anon`, and `authenticated`:

1. `bidoc_contracts_resolve_mapping_context_v1(uuid)` resolves exactly one active approved MAIN-to-KAPAIM project mapping and fails closed otherwise.
2. `bidoc_contracts_review_activity_mapping_v1(jsonb)` validates a versioned bounded review submission and atomically updates current mapping state with immutable audit evidence.

The review function supports manual confirmation, correction, rejection, explicit unmapped decisions, and narrow automatic continuation. Automatic continuation requires a previously confirmed activity alias from a different Schedule version, the same task UID, the manually confirmed contract-candidate relationship, no open conflict, and confidence of at least `0.95`. Initial mappings remain manual. A correction that changes the UID rejects the old UID continuity alias before confirming the new one.

Direct mapping-table access is backend-only: `service_role` receives only `select`, `insert`, and `update`; direct delete remains unavailable. The immutable event table grants `service_role` only `select` and `insert`.

This boundary does not rely on a Supabase project's default Data API exposure. It follows the current Supabase function guidance, combines explicit table/function privileges with RLS defense in depth, and remains safe across the platform's move toward opt-in exposure for newly created tables:

- [Database functions](https://supabase.com/docs/guides/database/functions)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Database security](https://supabase.com/docs/guides/database/secure-data)
- [Supabase breaking-change changelog](https://supabase.com/changelog?types=breaking-change)

## Isolated verification

| Check | Result |
|---|---|
| Final clean migration and behavioral/security suite | Passed: 10 mapping rows, 6 immutable review events, 8 confirmed winners |
| Manual confirmation and idempotent replay | Passed |
| Changed-payload event-key reuse | Rejected atomically |
| Strict same-UID, different-version continuation at `>= 0.95` | Passed |
| Same-version, changed-UID, low-confidence, conflicted, or unconfirmed continuation | Rejected atomically |
| Correction/supersession and old UID demotion | Passed |
| Competing confirmed canonical winner | Rejected atomically |
| Reject/unmapped audit with zero mapping mutation | Passed |
| Project/Schedule version mismatch and invalid constraints | Rejected atomically |
| RLS, role boundary, empty `search_path`, invoker security, grants, indexes, and validated constraints | Passed |
| Local Supabase schema lint | No schema errors |
| Local Supabase security/performance advisors | No issues found |
| Non-destructive rollback | Passed: all 10 mapping rows and 6 review events preserved |
| `git diff --check` and new-file whitespace scan | Passed |
| Protected runtime/UI and package-lock status | Unchanged |

Protected application regressions are recorded after the final run below:

- `npm.cmd run test:contracts` - 64/64 passed;
- `npm.cmd run test:schedule` - 47/47 passed;
- `node --check scripts/test-contracts-phase3-db.mjs` - passed;
- `node --check src/contracts/activityMapping.js` - passed;
- migration source guard rejects production project identifiers and `SECURITY DEFINER` - passed inside the isolated harness.

The repository-local Bedrock Schedule/decision memories were updated. `bedrock sync --project .` could not run because the `bedrock` command is not installed or available on `PATH`; the in-repository memory edits are preserved for a later sync.

## Rollback behavior

The operational rollback is deliberately non-destructive. It:

- revokes execute from both Phase 3 functions;
- revokes server mutation grants added for current-state mappings and event inserts;
- drops the two Phase 3 functions;
- preserves the hardened existing map, all current mapping rows, the immutable review-event table, and all audit rows.

A later destructive schema removal would require a separate data-retention decision and approval; it is not part of this checkpoint.

## Phase 3D completion

Phase 3D received explicit approval and completed the following gate:

1. verify the pre-apply KAPAIM migration history and existing `schedule_activity_map` rows;
2. confirm every new constraint can validate without rewriting or deleting data;
3. apply only the approved migration;
4. verify tables, constraints, indexes, triggers, RLS/policies, owners, grants, RPC security, and advisors from the live catalogs;
5. prove there are zero unexpected mapping or review-event rows;
6. leave the rejected Herzliya contract unmapped;
7. stop before any API, UI, ingestion, Engine, indicator, or alert integration.

## Stop gate

Phase 3D is complete. Do not manufacture a mapping, begin Phase 3E, add API or UI callers, change Schedule behavior, generate alerts, push, or deploy without the next explicit approval.
