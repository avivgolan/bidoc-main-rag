# BIDoc Contracts Pipeline R4.2A.1 — safe automatic relationship review checkpoint

Date: 2026-08-21

Status: local implementation complete and the KAPAIM migration is applied and verified. Production/Vercel deployment is not part of this slice.

## Outcome

R4.2A.1 adds a bounded automatic approval path to the existing R4.1 classifier, skeptical verifier, and R4.2A review queue. It does not add a fourth Contracts table and does not add another environment-variable gate.

The server may automatically approve a saved model proposal only when all of the following are true:

- the proposal is still the latest pending revision and its origin is `model`;
- the relationship type is `supports_same_decision`, `depends_on`, or `condition_of`;
- final, classifier, and independent-verifier confidence are each at least `0.95`;
- the exact R4.1 verifier schema is present;
- the two immutable source excerpts and a Hebrew rationale are present;
- the proposal has same-section evidence or an explicit-reference signal;
- deterministic checks find no conflicting amount, date, deadline, or trigger.

The automatic path never rejects or corrects a relationship. `duplicates`, `conflicts_with`, lower-confidence proposals, mismatches, incomplete evidence, and unsupported types remain in the human queue.

## Persistence and audit contract

The canonical tables remain:

- `private.contracts_documents` for source clauses and embeddings;
- `private.contracts` for normalized decisions and embeddings;
- `private.contract_relationships` for the graph and append-only review lineage.

Automatic-review provenance is stored under `private.contract_relationships.evidence.signals.autoReview`. It records:

- mode `model_auto_approval`;
- automatic-review agent, policy, and model versions;
- the authenticated superadmin who initiated the bounded batch;
- the review timestamp;
- the server-owned confidence and mismatch checks.

The existing `reviewer_id` records the authenticated initiator. The evidence explicitly identifies the model as the decision path, so the row is not presented as a human review.

## Database contract

Migration:

`supabase/migrations/20260821193107_contracts_relationship_auto_review_r4_2a1.sql`

Rollback guard:

`supabase/rollbacks/contracts_relationship_auto_review_r4_2a1.rollback.sql`

Read-only verification:

`supabase/tests/contracts-relationship-auto-review-r4-2a1.sql`

The migration adds two `SECURITY INVOKER` functions:

- `bidoc_contracts_relationship_auto_review_status_r4_2a1()`;
- `bidoc_contracts_auto_review_semantic_relationships_r4_2a1(uuid,uuid,text,jsonb)`.

Both functions revoke execution from `PUBLIC`, `anon`, and `authenticated`, and grant execution only to `service_role`. The apply RPC processes the complete server-owned eligible set in one PostgreSQL transaction. A stale or invalid item rolls back the whole batch.

## Server and UI contract

Authenticated same-origin routes:

- `GET /api/contracts/relationships/auto-review/status`;
- `POST /api/contracts/relationships/workspaces/:workspaceId/semantic-auto-review`.

The POST body must be an empty object. The browser cannot provide relationships, confidence thresholds, model settings, decisions, reviewer identity, or database routing.

The Contracts relationship tab now includes **אשר אוטומטית קשרים בטוחים**. Automatically approved cards are labeled **אושר אוטומטית בידי המודל** and retain the full policy evidence. Remaining proposals keep the existing approve, reject, and correction controls.

## Indicator boundary

R4.2A.1 only appends relationship review revisions. It does not:

- insert or update `private.contracts`;
- normalize contractual decisions;
- select conflict winners;
- classify Indicator suitability;
- read from or write to Schedule tables.

Decision normalization remains the existing R4.2B successor and Indicator remains the owner of operational placement.

## Local verification

- `node --check src/contracts/semanticRelationshipAutoReview.js` — passed.
- `node --check src/server.js` — passed.
- `npm.cmd run test:contracts` — 158/158 passed.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run test:contracts:ui` — passed all three review-only UI scenarios with zero promotion calls.
- Focused Chromium R4.2A.1 scenario — passed: one safe relationship was shown as model-approved, one duplicate remained pending, and the browser sent an empty request body.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `git diff --check` — passed, with only repository line-ending warnings.

Docker Desktop was not running, so a local PostgreSQL compile/apply test was unavailable. The exact migration was instead applied through the KAPAIM Supabase SQL Editor and the separate read-only verification script succeeded.

## KAPAIM activation evidence

The exact migration file was applied to the `Kapaim` production project on 2026-08-21. The SQL Editor returned `Success. No rows returned`.

The read-only verification returned:

- migration version `20260821193107`;
- automatic approval enabled;
- human fallback enabled;
- decision creation disabled;
- Schedule writes disabled;
- `automatically_reviewed_relationship_rows = 0` before the first live run;
- `invalid_automatic_review_status_rows = 0`.

The local service then loaded `.env.local` and called the KAPAIM status RPC directly. It returned `ready = true` and `applyApproved = true` with the exact agent, policy, and migration versions. The signed-in localhost page also showed saved clause persistence as active. No contract was uploaded and no automatic review row was written during activation verification.

## Activation steps

1. Completed: the complete migration file `20260821193107_contracts_relationship_auto_review_r4_2a1.sql` was applied in the KAPAIM Supabase SQL Editor.
2. Completed: `contracts-relationship-auto-review-r4-2a1.sql` passed with `invalid_automatic_review_status_rows = 0`.
3. Completed: the local server loaded the existing `CONTRACTS_RELATIONSHIPS_R4_2A_APPROVED=TRUE` gate and reported the new capability as ready. No new environment variable was added.
4. Open a contract version that still has pending relationship proposals and click **אשר אוטומטית קשרים בטוחים**.
5. Confirm that only eligible proposals are approved, every automatic card shows model provenance, ambiguous proposals remain pending, and decision/Schedule counts remain unchanged.

The contract reviewed on 2026-08-21 already has zero pending relationship proposals, so it cannot demonstrate the new automatic action. Live validation requires a new contract version or another saved workspace with pending R4.2A proposals; existing reviewed history must not be deleted or reset.
