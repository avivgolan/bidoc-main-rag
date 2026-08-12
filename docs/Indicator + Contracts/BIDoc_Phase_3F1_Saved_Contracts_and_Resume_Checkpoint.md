# BiDoc Contracts Agent Phase 3F.1 — Saved Contracts and Resume

Date: 2026-08-12  
Status: remote KAPAIM migration and private Storage activated; local saved-workspace flow and exact no-model reuse verified

## 1. Outcome

Phase 3F.1 removes the need to send an unchanged contract to the model after every refresh. The server hashes the PDF before any model call and can reopen the validated extraction and the current review draft when the project, document bytes, and extraction fingerprint match.

The Contracts page now contains a Hebrew saved-contract workspace. It lists prior document versions for the selected MAIN project, shows review progress, opens a saved contract without a model call, and autosaves mutable reviewer decisions and the current mapping draft.

The activation preflight found and corrected four integrity risks before any remote apply: Schedule-project identity is now part of reuse, fingerprint upgrades can safely share one content-addressed PDF, a concurrent first extraction returns the canonical stored winner, and draft saves use optimistic revision checks instead of last-write-wins.

This checkpoint applied only the saved-workspace migration and private PDF Storage required by Phase 3F.1, enabled the feature through process-local server flags, and created one verified saved workspace/draft from the exact contract PDF. It did not apply the separate Phase 3F mapping-history migration, write an activity mapping, change Schedule arithmetic, emit an alert, deploy, commit, or push.

During the earlier read-only preflight, the existing KAPAIM service-role credential was accidentally printed to internal task output. Its value is not copied into this document. The user explicitly accepted proceeding with Phase 3F.1 activation without first rotating it; replacement and revocation therefore remain a recommended, unresolved security action rather than a completed control.

## 2. Persistence contract

- `private.contract_workspaces` stores immutable source identity and validated canonical extraction JSON.
- `private.contract_review_drafts` stores one mutable draft per workspace and reviewer, including decisions, reasons, review time, progress counts, and the current mapping draft.
- The raw PDF is stored under a deterministic source-project/SHA-256 object key in a separately provisioned private Supabase Storage bucket. A changed extraction fingerprint may reuse those same verified bytes while creating a distinct immutable extraction workspace.
- An identical PDF is reusable only when the source project, Schedule project, SHA-256 hash, and extraction fingerprint all match.
- The fingerprint includes the workspace/schema/agent/compiler versions and configured primary/retry models. A changed extraction contract or model therefore creates a new workspace instead of silently reusing stale output.
- Different PDF bytes are a distinct document version. Decisions are not copied automatically across versions.
- Saved extraction JSON is validated again against the canonical Contracts schema before it is returned to the browser.

## 3. Server and browser boundary

The same-origin, authenticated server routes are:

- `GET /api/contracts/workspaces/status`
- `GET /api/contracts/workspaces?sourceProjectId=<uuid>&limit=<1..100>`
- `GET /api/contracts/workspaces/:workspaceId`
- `PUT /api/contracts/workspaces/:workspaceId/draft`
- `POST /api/contracts/workspaces/extract`

The browser supplies no database URL, service-role key, reviewer identity, storage credential, extraction fingerprint, or server timestamp. Unsupported fields and client database-override headers fail closed. The browser never receives the service-role key.

The existing `POST /api/contracts/extract` route remains an unpersisted Phase 1 dry run. The activated saved-workspace path uses `POST /api/contracts/workspaces/extract`. Its approval and bucket settings are process-local on the current server, not a deployment-level configuration change.

## 4. Database and Storage safety

- The repository migration is `supabase/migrations/20260812135210_contracts_phase3f1_saved_workspaces.sql`; KAPAIM records the applied remote migration as `20260812152042`.
- Both private tables have RLS enabled.
- `PUBLIC`, `anon`, and `authenticated` have no table or RPC mutation privileges.
- RPCs are `SECURITY INVOKER`, use an empty `search_path`, and require `current_user = 'service_role'`.
- Extraction/source columns are protected by an immutable-update trigger.
- There is no delete or truncate route and no browser-accessible write path.
- The workspace UPSERT is atomic and keyed by source project, Schedule project, document hash, and extraction fingerprint.
- A concurrent UPSERT returns the canonical persisted extraction plus explicit insert/reuse state. A request that already called the model never claims that the model was avoided.
- Draft writes require the caller's expected revision. A stale write fails with HTTP 409, the browser reloads the canonical draft, and it does not automatically resubmit the rejected local snapshot.
- The migration does not modify Supabase-managed `storage.*` tables. The separately provisioned `contracts-private` bucket was read back and verified with `public=false`.
- Bucket readiness requires exactly `application/pdf` and a file-size cap of at most 3,000,000 bytes; both settings were verified live. A duplicate Storage object is accepted only after its byte count and SHA-256 are verified.

## 5. Hebrew UX correction for “0 alternatives”

The previous mapping summary displayed `0` when trigger evidence had not been reviewed, even though no Schedule search had run. The UI now distinguishes three states:

1. `החיפוש טרם בוצע` — the trigger-evidence review gate is still open.
2. `החיפוש הושלם ונמצאו N חלופות` — current alternatives were returned.
3. `החיפוש הושלם, אך לא נמצאה פעילות מתאימה` — a real search completed with no candidates.

Changing the search controls invalidates the old result. Loading or refreshing alternatives scrolls the outcome into view. Source task names and exact source evidence remain in their original language for accuracy; all decisions, controls, states, blockers, and guidance are Hebrew.

## 6. Verification

- `npm.cmd run test:contracts` — 94 Contracts tests pass.
- `npm.cmd run test:schedule` — 47 Schedule regression tests pass.
- `npm.cmd run test:contracts:phase3-db` — the full isolated Phase 3 database suite passes, including saved-workspace schema, permissions, immutability, reuse, draft revision, and security assertions.
- `npm.cmd run test:contracts:ui` — the Phase 2 reviewer UI regression passes.
- `npm.cmd run test:contracts:phase3f:ui` — desktop and 390px mapping review pass with two alternatives, exact evidence/history, correction flow, and no browser-owned credentials.
- `npm.cmd run react:build` — passes.
- `node --check src/contracts/workspacePersistence.js` and `node --check src/server.js` — pass.
- `npx.cmd playwright test test/ui/contracts-review.test.js` — 5/5 pass, including no save on open, serialized rapid edits, revision advancement, and canonical reload after a stale-write 409.
- Chrome inspection at the existing authenticated `http://localhost:4000/#contracts` route confirms the Hebrew Phase 3F.1 status and saved-contract panel at desktop and 390x844.

An independent final security review cleared the code and schema before remote apply.

### Live activation and reuse evidence

- The exact saved-workspace migration was applied to KAPAIM as remote migration `20260812152042`.
- `contracts-private` was verified as private (`public=false`), PDF-only, and limited to 3,000,000 bytes.
- Local server PID `39492` started with process-local `CONTRACTS_PHASE3F1_WORKSPACE_PERSISTENCE_APPROVED=TRUE` and `CONTRACTS_STORAGE_BUCKET=contracts-private`; the authenticated workspace status reported `ready: true`.
- The first exact-PDF extraction saved one workspace and one revision-1 reviewer draft containing 12 candidates.
- That initial extraction emitted eight `contract_model_call` events: seven completed and the first chunk-7 call failed after 90 seconds. The bounded chunk-7 retry using `gpt-4o-mini` succeeded and is included among the seven completed events.
- Reopening the saved workspace restored the Hebrew review draft and added zero model-call events.
- A second byte-identical upload reused the saved extraction, restored the Hebrew draft, and also added zero model-call events.
- The UI explicitly indicated in Hebrew that reuse did not call the model and incurred no additional token cost.

The no-model claim applies only to the reopen and byte-identical second upload. The first extraction legitimately used the model and its timeout/retry is recorded above.

## 7. Activation record — complete

1. Applied only `20260812135210_contracts_phase3f1_saved_workspaces.sql` to APP DATA/KAPAIM; remote history recorded `20260812152042`. The separate Phase 3F history migration remains unapplied.
2. Created and verified `contracts-private` as private, exactly `application/pdf`, with a 3,000,000-byte limit.
3. Activated the exact Phase 3F.1 flags on the local server process and verified readiness.
4. Saved one exact contract workspace and its revision-1 draft with 12 candidates.
5. Reopened the saved workspace and repeated a byte-identical upload; both restored the draft with zero additional model calls.
6. Left mapping writes, Schedule consumers, alerts, deployment, commit, and push untouched.
7. Accepted risk: credential replacement/revocation was not performed. It remains recommended and unresolved.

## 8. Stop gate

Phase 3F.1 activation and reuse certification are complete and no longer block Phase 3G. Continue to stop before Phase 3F mapping-history activation/review writes, Schedule consumers, alerts, deployment, commit, or push unless they receive their own explicit approval. The Phase 3F.1 flags are process-local and must be set intentionally again after a future server restart. Credential replacement and revocation remain recommended security debt accepted by the user, not a resolved control.
