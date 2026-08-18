# BIDoc Contracts Agent - Phase 2 Migration and Apply Checkpoint

- Date: 2026-08-11
- Status: Phase 2 closed for the reviewed Herzliya sample; schema, mapping, review-only audit persistence, and remote security verification complete
- Scope: Official migrations, atomic RPC, backend review routes, reviewer UI, rollback plan, isolated database tests, and remote apply evidence
- Live database changes: Three additive migrations, one approved MAIN-to-KAPAIM mapping row, one immutable review-only batch, twelve rejected decisions, and one zero-promotion attempt
- Production changes: No application deployment, persistent flag activation, promoted Schedule row, Schedule-date change, alert, or notification

## Outcome

The CTO-approved Phase 2 architecture is implemented, verified in an isolated local Supabase/PostgreSQL environment, and applied to KAPAIM through the authenticated Supabase migration connector. The package preserves the existing Schedule tables as the operational source of truth and adds only the missing project-mapping and immutable review/audit responsibilities.

The primary migration is `supabase/migrations/20260810175150_contracts_phase2_review_promotion.sql`. It was generated with the pinned Supabase CLI, compiled locally, exercised by database security/atomicity tests, and recorded remotely as `20260810175150`. Remote verification identified legacy browser-role privileges and one unindexed foreign key; two narrow follow-up migrations (`20260810181135` and `20260810183407`) removed the remaining non-read privileges and added the mapping foreign-key index. Exactly one approved MAIN-to-KAPAIM mapping row was inserted.

The final operational smoke test used the accepted 12-candidate Herzliya review and the production Phase 2 planner/writer. All twelve decisions remained rejected, the planner asserted `review_only`, global blockers were empty, and all three operational row sets were empty before calling the atomic RPC. KAPAIM returned `reviewed_no_promotion` with `promotedCount: 0`. The temporary local server activation process was then stopped, so no persistent environment flag or deployment was left enabled.

## Local implementation

### Official migration

`supabase/migrations/20260810175150_contracts_phase2_review_promotion.sql` creates four defense-in-depth RLS-enabled tables in a non-exposed `private` schema:

1. `schedule_contract_project_mappings` - explicit reviewed MAIN-to-KAPAIM UUID mapping.
2. `schedule_contract_review_batches` - immutable extraction, review, planner, and result snapshots.
3. `schedule_contract_review_decisions` - immutable candidate-level approve/reject decisions, conflicts, and promoted target identity.
4. `schedule_contract_promotion_attempts` - append-only committed, review-only, and failed transaction outcomes.

The migration does not hardcode the MAIN or KAPAIM project UUID. The separately reviewed mapping operation created the active mapping from MAIN `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7` to KAPAIM `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5` after the schema and permissions passed remote verification.

### Atomic function

`public.bidoc_contracts_promote_review_v1(jsonb)`:

- is `SECURITY INVOKER`, not `SECURITY DEFINER`;
- uses `set search_path = ''` and schema-qualified relations;
- rejects callers whose effective database role is not `service_role`;
- validates submission/planner versions, document authority, candidate document identity, byte limit, project mapping, blockers, and whole-batch readiness;
- inserts only into the existing `schedule_contract_milestones`, `schedule_contract_extensions`, and `schedule_contract_conditions` targets;
- treats an identical batch retry as idempotent;
- rejects a reused batch ID with a different payload;
- refuses a conflicting existing operational fact instead of overwriting it;
- stores complete rejection-only reviews without claiming an operational promotion;
- uses a nested PL/pgSQL exception block so an expected database failure rolls back partial audit/target work, then records a separate failed attempt with zero promotions.

### Permissions

The migrations:

- revokes access to the four new private Contracts tables from `PUBLIC`, `anon`, and `authenticated` without changing permissions on unrelated private objects;
- grants the server role only the private-table privileges required by the invoker function;
- revoke every non-read table privilege for `anon` and `authenticated` on the three operational contract targets; the follow-up migration removed legacy `truncate`, `references`, and `trigger` grants discovered during the remote preflight;
- revokes RPC execution from `PUBLIC`, `anon`, and `authenticated`;
- grants RPC execution only to `service_role`;
- never places a service credential in frontend code.

This explicitly accounts for Supabase's 2026 Data API change: new table/function exposure must be controlled with explicit grants independently of RLS.

### Backend transport

`src/contracts/promotionWriter.js` provides the only local caller contract. It:

- builds a bounded submission from extraction, human review, approved mapping, and the pure promotion plan;
- supports a transaction-ready promotion or a complete rejection-only review;
- refuses unsafe reviewed candidates and unresolved global gates;
- requires both `commit: true` and `migrationApplyApproved: true`;
- uses the existing APP DATA/KAPAIM connection selected by `scheduleSupabaseConfig`;
- calls only `/rest/v1/rpc/bidoc_contracts_promote_review_v1`;
- maps timeouts, invalid responses, transport failures, batch mismatches, and database rejections to typed Contracts errors.

`src/contracts/reviewWorkflow.js` and the server routes under `/api/contracts/review/*` bind the reviewer to the authenticated same-origin superadmin session, sanitize mapping metadata, never accept browser-provided database credentials, and keep commit disabled unless `CONTRACTS_PHASE2_APPLY_APPROVED=true`. `src/react/ContractsPage.jsx` adds the Contracts reviewer screen with evidence, candidate-level approve/reject decisions, explicit gate resolution, conflict selection, plan preview, and a disabled-until-approved commit action.

## Verification completed

- Supabase CLI `2.113.0` is pinned as a development dependency; `supabase/config.toml` and an official timestamped migration are committed inputs.
- `npm.cmd run test:contracts` - 53/53 passed after the review-only route/UI split.
- Phase 2 tests cover bounded submissions, UUID identity, exclusive conflict selection, rejection-only audit, unsafe-plan refusal, double opt-in, authenticated reviewer binding, server-owned APP DATA transport, atomic database-rejection handling, and SQL security invariants.
- `npm.cmd run test:contracts:db` - passed against local PostgreSQL 17.6.1. It proved rejection-only persistence, all three promotion targets, idempotent identical retries, changed-payload rejection, immutable review audits, browser-role denial, conflict preservation, and zero partial rows after a forced middle failure.
- `supabase db lint --local --schema private,public --level warning --fail-on error` - no schema errors.
- `supabase db advisors --local --type all --level warn --fail-on error` - no issues found.
- KAPAIM migration history contains `20260810175150`, `20260810181135`, and `20260810183407`; local migration filenames are aligned to those remote versions.
- The approved mapping exists exactly once. The Phase 2 closure batch `contracts-review-phase2-closure-20260811` exists exactly once with `submission_mode=review_only` and `transaction_status=reviewed_no_promotion`.
- The closure batch has 12/12 rejected decisions, zero linked target rows, one successful zero-promotion attempt, and all three immutable audit triggers enabled.
- Live KAPAIM verification after the RPC returned zero rows for the mapped project in `schedule_contract_milestones`, `schedule_contract_extensions`, and `schedule_contract_conditions`.
- Remote catalog checks confirm `SECURITY INVOKER`, an empty function `search_path`, server-only RPC execution, private-table denial, browser read-only target grants, RLS on all four private tables, and the mapping foreign-key index.
- Remote Supabase advisors returned no Phase 2 warnings or errors. Informational notices are expected for deny-by-default private RLS tables and indexes with no production traffic yet.
- The SQL security test verifies private storage, invoker security, empty `search_path`, immutable triggers, failed-attempt recording, explicit function grants/revocations, all three approved Schedule targets, and absence of hardcoded project UUIDs.
- `npm.cmd run contracts:representative` - 6/6 exact canonical cases passed.
- `npm.cmd run test:schedule` - 47/47 protected Schedule regressions passed.
- `npm.cmd run react:build` - passed; 18 modules, 431.34 kB / 106.31 kB gzip.
- Contracts reviewer rendering passed at 1440px desktop and 390px mobile with no horizontal overflow. The authenticated live backend was not bypassed; rendered inspection used a static local preview, while API/database behavior was covered separately.
- `npm.cmd audit --omit=dev` - zero runtime vulnerabilities. The full development audit retains two Vite-chain findings in `postcss`/`nanoid`; no automatic unrelated dependency rewrite was applied.
- JavaScript syntax checks for the planner, writer, and Contracts tests - passed.
- `git diff --check` - passed with line-ending notices only.
- `src/scheduleEngine.js` and `src/scheduleCalendar.js` have no diff and retain their accepted SHA-256 hashes.

## Phase 2 closure and deferred first promotion

### Review-only UI closure (local implementation complete)

The reviewer now separates two server actions instead of treating every reviewed batch as an operational promotion:

- a complete rejection-only batch exposes **Save review without promotion** and calls the dedicated `/api/contracts/review/save` route;
- the route rejects any batch that contains a promotable or unsafe candidate, then persists only the immutable review/audit submission through the existing atomic RPC;
- a transaction-ready approved batch continues to use `/api/contracts/review/commit`;
- the UI distinguishes no approved rows, a disabled server activation flag, and an unavailable/missing Phase 2 RPC;
- the review-only success state explicitly reports zero promoted Schedule rows.

Local verification for this closure passes 53 focused Contracts tests, 47 Schedule regressions, the React production build, the isolated Phase 2 database/RLS/atomicity suite, and an isolated compiled-browser verifier covering enabled review-only save, disabled activation, and missing-RPC behavior. The browser verifier observed one audit-only save and zero promotion calls. The live closure then persisted the reviewed rejection-only batch through the same production planner, writer, APP DATA routing, and atomic RPC used by the backend. It intentionally did not invent an approvable fact merely to exercise a target-table write.

Phase 2 is closed for the current contract because its safe outcome is an auditable no-promotion decision. Two follow-ups remain intentionally separate:

- the first real promotion plus existing Schedule ingestion proof must wait for a genuinely eligible reviewed fact with its trigger, calendar semantics, project binding, and conflicts resolved;
- application deployment requires a separate release approval.

Neither follow-up blocks starting the Indicator phase. The transaction path is already covered locally for all three target types, idempotency, immutability, role denial, conflict preservation, and atomic rollback; the live sample proves the production no-promotion path without changing Schedule data.

## Required KAPAIM apply-gate sequence

1. **Complete:** create an isolated local Supabase/PostgreSQL environment with KAPAIM-compatible Schedule fixtures.
2. **Complete:** generate the migration through the approved Supabase migration workflow.
3. **Complete:** apply and compile the SQL only in that isolated environment.
4. **Complete:** insert a reviewed mapping fixture without hardcoding production-generated IDs in the migration.
5. **Complete:** run database tests proving:
   - `anon` and `authenticated` cannot read/write private audit tables;
   - `anon` and `authenticated` cannot execute the promotion RPC;
   - direct browser-role mutations of the three contract targets fail;
   - the server role can persist a rejection-only review;
   - the server role can atomically promote each of the three target types;
   - a conflicting row produces `failed`, zero promotions, and one immutable failed-attempt record;
   - an identical committed batch is idempotent;
   - a changed payload using the same batch ID is rejected;
   - no partial target or review rows survive a forced middle-of-batch failure.
6. **Complete:** run Supabase schema lint plus security and performance advisors; no issues were returned.
7. **Complete:** the CTO/security apply approval was conveyed, and the exact migration/grant diff plus rollback boundary were reviewed.
8. **Complete:** the three migrations and reviewed mapping were applied to KAPAIM and verified remotely.
9. **Complete for the reviewed sample:** a temporary local activation ran one live rejection-only submission. KAPAIM stored one immutable batch, 12 rejected decisions, and one zero-promotion attempt; all three Schedule targets remained empty for the mapped project. The temporary activation process was stopped afterward.
10. **Deferred until eligible input exists:** execute the first real target-row promotion and confirm consumption through the existing Schedule ingestion/engine. Do not weaken review gates to manufacture this evidence.

## Rollback plan

### Immediate safe stop

1. Disable the backend call site or feature flag if one is later added.
2. Revoke `execute` on `public.bidoc_contracts_promote_review_v1(jsonb)` from `service_role`.
3. Confirm that no new promotion attempts arrive.

This stops writes without deleting operational or audit evidence.

### Schema rollback

- Preserve private audit tables by default; they are evidence and should not be destroyed during an operational rollback.
- Drop the public RPC only after the backend is disabled.
- Do not restore direct `anon`/`authenticated` mutations merely to reproduce the earlier overly broad grants.
- Drop the additive private tables only in an isolated pre-production environment with zero required audit rows and explicit destructive approval.
- Existing milestone, extension, or condition facts are never automatically deleted by rollback. Any reversal requires a reviewed compensating decision using existing lifecycle semantics.

## Stop gate

Phase 2 is complete for the reviewed Herzliya sample and its correct result is `reviewed_no_promotion`. The server-only activation was temporary and is off again. Proceed to the Indicator phase without changing or duplicating existing Schedule arithmetic. A future real promotion, persistent flag activation, or deployment remains a separate reviewed action and requires an actually eligible contractual fact.
