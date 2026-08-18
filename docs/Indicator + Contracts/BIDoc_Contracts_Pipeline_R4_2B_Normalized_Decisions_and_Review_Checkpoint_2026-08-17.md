# BIDoc Contracts Pipeline R4.2B — normalized decisions and human review checkpoint

Date: 2026-08-17

Status: the approved R4.2B implementation is complete, published to KAPAIM, runtime-hardened against real provider output limits, and verified. All R4.2A relationships are reviewed; the next user action is the first persisted decision-proposal run.

## Outcome

R4.2B turns a fully reviewed relationship generation into durable normalized contractual decision proposals. It reuses the locked three-table architecture:

- source clauses remain in `private.contracts_documents`;
- normalized decision revisions are appended to `private.contracts`;
- clause-to-decision evidence links are appended to `private.contract_relationships` under policy `contracts-decision-support.r4.2b.v1`.

No fourth Contracts domain table was added.

The existing Contracts tab now contains a Hebrew R4.2B panel that:

- displays the exact count of R4.2A relationships still awaiting review;
- disables decision generation while any relationship remains `proposed`;
- creates one normalized decision proposal per operative clause group after the gate opens;
- displays the Hebrew title, summary, normalized contractual meaning, category, responsible party, beneficiary, Schedule-impact classification, temporal shape, and every immutable source excerpt;
- supports append-only approve, reject, correct, and mark-unresolved actions with a required Hebrew reason;
- reloads the current decision revisions after refresh without rerunning the model;
- explicitly states that conflict winners are not selected and Schedule is not written.

## Normalization boundary

The server loads the immutable saved R3.2 generation and current R4.2A relationship revisions. The browser supplies neither clauses, relationships, proposals, model settings, reviewer identity, database routing, nor timestamps.

Only operative contractual clauses enter R4.2B. Structural headings and document-context rows remain visible in the Contracts extraction but do not become decisions.

Approved or corrected relationships of the following types group clauses into the same candidate decision:

- `supports_same_decision`;
- `condition_of`;
- `exception_to`;
- `amends`;
- `duplicates`;
- `conflicts_with`.

`depends_on` remains a relationship between separate decisions and therefore does not merge clause groups. A reviewed `conflicts_with` group is normalized with `conflict_status = unresolved`; the model is instructed to preserve both source-grounded alternatives and is forbidden to choose a winner.

Every model batch uses strict JSON Schema plus local validation. Two candidates are sent per call with bounded three-call concurrency. Provider truncation is detected from completion telemetry and a failed pair may split into bounded single-candidate calls. A missing, duplicated, malformed, or non-Hebrew core decision still fails the complete run, and no partial proposal set is persisted.

Optional generated metadata is handled conservatively rather than allowing one weak field to discard the complete proposal set:

- an ungrounded responsible-party or beneficiary label is omitted;
- an unprovable temporal date, trigger, or offset is neutralized to `temporalKind = none` with no calculated date;
- if generated title, summary, or decision text introduces a numeric fact absent from the source, the ungrounded generated field is replaced deterministically: neutral Hebrew for title/summary and exact stored clause text for the decision body;
- every sanitization is counted in normalization metrics and remains visible for the required human review.

## Append-only database contract

KAPAIM project: `smxibuaowzuxkznuouwj`.

Local migration contract: `20260817121000_contracts_decisions_r4_2b_review.sql`.

Supabase remote migration record: `20260817123929_contracts_decisions_r4_2b_review`. The managed apply timestamp differs from the local generated version; the runtime status contract retains the local migration version `20260817121000`.

The migration adds four service-role-only, `SECURITY INVOKER`, empty-search-path RPCs:

- `bidoc_contracts_decision_review_status_r4_2b`;
- `bidoc_contracts_get_decision_review_r4_2b`;
- `bidoc_contracts_persist_decisions_r4_2b`;
- `bidoc_contracts_review_decision_r4_2b`.

Persistence and review use transaction-scoped advisory locks. Decision writes call the locked R1 append RPC; support-link writes call the locked R1 relationship append RPC. Browser roles cannot execute the R4.2B RPCs. `private.contracts` and `private.contract_relationships` retain enabled and forced RLS. The service role has the bounded RPC privileges; anonymous and authenticated roles have none.

The rollback file refuses to remove the R4.2B functions after any R4.2B decision or support revision exists, preserving append-only history.

## Server routes and activation

Local activation flag: `CONTRACTS_DECISIONS_R4_2B_APPROVED=TRUE`.

Authenticated same-origin superadmin routes:

- `GET /api/contracts/decisions/status`;
- `GET /api/contracts/decisions/workspaces/:workspaceId`;
- `POST /api/contracts/decisions/workspaces/:workspaceId/proposals`;
- `POST /api/contracts/decisions/workspaces/:workspaceId/review/:decisionId`.

The proposal route accepts only an empty JSON object. A second run after decisions exist returns the saved projection without another model call.

## Live KAPAIM evidence

Retained workspace: `82345c75-c6f4-468d-b899-1f8407d9a9c1`.

Current live gate after the user completed R4.2A review:

- R4.2A relationships: 19 current;
- pending relationship reviews: 0;
- accepted relationship reviews: 19;
- R4.2B decisions: 0;
- R4.2B support relationships: 0;
- Schedule writes: 0.

The first real-model proposal attempt exposed a provider-output limit: four-item batches ended with `finish_reason = length` / `native_finish_reason = MAX_TOKENS`, and the same-size repair truncated again. No proposal was persisted. A no-write reproduction proved the failure at the provider boundary before the batching fix.

After the bounded two-item batching and conservative validation fallbacks were added, the retained workspace completed a full real-model no-write quality check:

- model: `google/gemini-2.5-pro`;
- eligible clauses: 152;
- decision candidate groups: 135;
- completed model decisions: 135;
- model calls: 68;
- provider retries: 0;
- repair calls: 0;
- split fallback calls: 0;
- truncated outputs: 0;
- omitted ungrounded optional party labels: 57;
- neutralized unprovable temporal metadata records: 35;
- generated text fields replaced by safe deterministic source-grounded fallbacks: 13;
- duration: 187,430 ms inside the 300-second route deadline;
- persistence writes: 0;
- Schedule writes: 0.

A live rollback-only end-to-end smoke test verified:

- persistence fails with SQL check violation while any R4.2A relationship remains proposed;
- temporary in-transaction reviews open the gate;
- two valid decision proposals are appended atomically;
- identical persistence reuses both decisions instead of duplicating them;
- each proposal gets exact clause-to-decision support evidence;
- approval appends a reviewed decision revision and reviewed support revisions;
- correction appends a corrected decision revision while preserving exact source evidence;
- every decision keeps `schedule_project_id` null and the reported Schedule write count is zero;
- rollback removes all smoke rows and restores the original 3-approved/16-pending relationship state.

The post-migration security advisor reports the existing informational `RLS enabled, no policy` notices for the private default-deny tables. This is intentional for the server-only design: browser roles have no execute privileges and the bounded service RPC is the access path. The advisor did not expose a new R4.2B privilege widening.

## Verification

- `npm.cmd run test:contracts` — 137/137 passed.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `node --check src/server.js` — passed.
- `node --check src/contracts/decisionNormalization.js` — passed.
- `node --check src/contracts/decisionReview.js` — passed.
- `git diff --check` — passed; only existing line-ending warnings were reported.
- full KAPAIM migration compile inside `BEGIN`/`ROLLBACK` — passed.
- managed KAPAIM migration publication — passed.
- live pending-gate/idempotency/approve/correct/support/no-Schedule smoke inside rollback — passed.

## Manual acceptance gate

The user should now:

1. restart the local BIDoc process so the R4.2B server code and activation flag load;
2. reopen the retained extraction in the Contracts tab;
3. confirm the R4.2B panel shows zero pending relationship reviews;
4. click **צור ושמור הצעות החלטה** once and allow up to five minutes for the bounded full-contract run;
5. inspect the resulting normalized decisions and exact evidence before approving, rejecting, correcting, or marking any item unresolved;
6. pay particular attention to decisions showing neutral titles or exact clause text, which indicate a deterministic safety fallback that needs human confirmation;
7. refresh the page and confirm the reviewed decision state reloads without another model run.

The implementation is ready for this manual gate, but real-model decision quality is not claimed before the user inspects that first retained run.

## Deliberately deferred

- split and merge review mechanics across existing decision lineages;
- explicit authority ordering or conflict-winner selection;
- decision-to-decision relationship materialization beyond the reviewed clause grouping used by normalization;
- Schedule activity mapping, due-date calculation, projection, alerts, or writes;
- R5 and all later phases;
- commit, push, deployment, or production propagation.

The next bounded implementation slice after visual acceptance is R4.2C for split/merge and decision-lineage completeness. R5 remains a separate approval gate.
