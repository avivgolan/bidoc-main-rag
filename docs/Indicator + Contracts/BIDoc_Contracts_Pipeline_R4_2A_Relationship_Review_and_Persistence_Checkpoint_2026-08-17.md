# BIDoc Contracts Pipeline R4.2A — relationship persistence and human review checkpoint

Date: 2026-08-17

Status: the explicitly approved R4.2A slice is implemented, published to KAPAIM, verified, and manually accepted for continuation. R4.2B is now implemented, while the retained workspace still requires completion of its remaining relationship reviews before the first real decision-normalization run.

## Outcome

R4.2A turns a complete, skeptically verified R4.1 preview into durable, reviewable relationship proposals. It reuses the canonical `private.contract_relationships` table; it does not create a fourth Contracts table.

The existing Contracts tab now supports a Hebrew review queue in which a superadmin can:

- approve a model proposal;
- reject it;
- correct only its locked relationship type or direction;
- inspect both immutable source excerpts and the model rationale;
- leave a required Hebrew review reason;
- reload the saved workspace later without rerunning an already persisted proposal set.

This slice remains intentionally bounded:

- only a complete R4.1 result with both classification and skeptical verification complete may be persisted;
- incomplete or partial model output fails closed and produces no relationship writes;
- the server owns the workspace, clauses, model identity, reviewer identity, and review timestamp;
- the browser sends only a bounded action, expected revision, Hebrew reason, and optional corrected type/direction;
- review writes are append-only revisions;
- rerunning the same verified relationship set is idempotent;
- a correction atomically supersedes the model relationship and appends a human-origin corrected relationship linked to the original proposal;
- no row is added to `private.contracts`;
- no conflict winner, normalized decision, Schedule mapping, date arithmetic, alert, or Schedule write is created.

## Published database contract

KAPAIM project: `smxibuaowzuxkznuouwj`.

Local migration contract: `20260817093931_contracts_relationships_r4_2a_review.sql`.

Supabase remote migration record: `20260817100230_contracts_relationships_r4_2a_review`. The later timestamp is the apply time assigned by the managed Supabase migration operation; the runtime status contract intentionally retains the local generated version `20260817093931`, matching the existing Contracts migration convention.

The migration adds four service-role-only RPCs:

- `bidoc_contracts_relationship_review_status_r4_2a`;
- `bidoc_contracts_get_relationship_review_r4_2a`;
- `bidoc_contracts_persist_semantic_relationships_r4_2a`;
- `bidoc_contracts_review_semantic_relationship_r4_2a`.

`private.contract_relationships` still has forced RLS. `anon` and `authenticated` have no table grants; `service_role` has only `SELECT` and `INSERT`, with no `UPDATE` or `DELETE`. The review path therefore cannot rewrite or erase audit history.

The rollback file removes only the four R4.2A functions and refuses to run after R4.2A relationship data exists.

## Server and UI contract

Activation flag: `CONTRACTS_RELATIONSHIPS_R4_2A_APPROVED=TRUE`.

Authenticated, same-origin superadmin routes:

- `GET /api/contracts/relationships/review/status`;
- `POST /api/contracts/relationships/workspaces/:workspaceId/semantic-proposals`;
- `GET /api/contracts/relationships/workspaces/:workspaceId/semantic-review`;
- `POST /api/contracts/relationships/workspaces/:workspaceId/semantic-review/:relationshipId`.

The persistence route reruns R4.1 from the server-owned saved workspace and writes only after both completion flags are true. It does not accept browser-owned clauses, proposal objects, model names, database routing, reviewer IDs, or timestamps.

## Live KAPAIM verification

The applied migration is present under version `20260817100230`, and all four functions are present.

A live rollback-only database smoke test used retained workspace `82345c75-c6f4-468d-b899-1f8407d9a9c1` and verified:

- two valid model proposals inserted;
- an identical second persistence call inserted zero and reused two;
- approval appended revision 2 with the authenticated reviewer and an immutable reason;
- correction appended a superseded model revision plus a new human-origin corrected relationship linked to the reviewed proposal;
- the normalized-decision row count remained unchanged at zero;
- the transaction rolled back successfully and left zero R4.2A rows.

Current live state before the user's first real R4.2A run:

- canonical relationship rows from earlier phases: 14;
- R4.2A semantic relationship rows: 0;
- reviewed R4.2A rows: 0;
- normalized decision rows for the retained workspace: 0.

The Supabase security advisor reports the existing informational `RLS enabled, no policy` notice for the private table. This is intentional for this server-only table: forced RLS remains enabled, browser roles have no grants, and only the privileged server role has the bounded table/RPC permissions. The performance advisor continues to report pre-existing informational missing-covering-index notices for relationship foreign keys; R4.2A does not change those keys, and this low-volume review slice does not widen scope into a table-index redesign.

## Verification

- `npm.cmd run test:contracts` — 132/132 passed.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `node --check src/server.js` — passed.
- `node --check src/contracts/semanticRelationshipReview.js` — passed.
- KAPAIM migration compile in an explicit transaction followed by rollback — passed.
- KAPAIM live append-only/idempotency/approve/correct/no-decision smoke test followed by rollback — passed.
- Local Docker database verification was unavailable because Docker Desktop was not running; the live transaction-and-rollback test covered the actual published RPCs without retaining test data.

## Manual acceptance and successor gate

The user confirmed that saved relationship reviews survived refresh as expected and approved continuation into R4.2B. At the R4.2B publication checkpoint the retained workspace contains 19 current semantic relationships: 3 approved and 16 still proposed.

1. Restart the user-owned BIDoc process so the new server code and R4.2A flag are loaded.
2. Open the retained saved extraction in the existing Contracts tab.
3. Click **הרץ, אמת ושמור הצעות לסקירה**.
4. Confirm that the resulting proposals appear in the Hebrew review queue and remain after a browser refresh or leaving and returning to the tab.
5. Approve, reject, or correct only proposals whose two source excerpts support that decision.
6. Confirm the same workspace reloads the saved reviewed state without a second model run.

R4.2B now enforces the remaining review work as a database and UI gate: normalized decision generation stays disabled until all 16 proposed relationships are approved, corrected, or rejected. See `BIDoc_Contracts_Pipeline_R4_2B_Normalized_Decisions_and_Review_Checkpoint_2026-08-17.md` for the implemented successor slice. Conflict adjudication and every Schedule integration remain separate approval gates.

## Deliberately deferred

- normalized rows in `private.contracts`;
- clause-to-decision and decision-to-decision relationships;
- conflict winner selection or authority ordering;
- Schedule mapping, projection, alerts, or writes;
- performance-index changes to the pre-existing relationship table;
- deployment, commit, or push.
