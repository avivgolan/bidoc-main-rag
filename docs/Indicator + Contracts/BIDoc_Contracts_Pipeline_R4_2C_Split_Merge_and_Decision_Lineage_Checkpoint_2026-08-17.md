# BIDoc Contracts Pipeline R4.2C — split, merge, and decision-lineage checkpoint

Date: 2026-08-17

Status: the approved R4.2C implementation and retained decision-quality review are complete, published to KAPAIM, and verified. It adds append-only human corrections for decisions that must be split or merged, without invoking a model and without writing to Schedule.

## Outcome

R4.2C closes the remaining decision-review gap from R4.2B. A reviewer can now:

- split one current decision into 2–10 current decisions;
- merge 2–10 current decisions into one current decision;
- retain exact immutable clause evidence for every resulting decision;
- see the terminal source revisions, resulting revisions, and directional lineage in the existing Contracts tab;
- reload the complete lineage after refresh without recomputation.

The locked three-table architecture remains unchanged. R4.2C reuses `private.contracts` for append-only decision revisions and `private.contract_relationships` for evidence and lineage. No fourth Contracts domain table was added.

## Append-only lineage contract

The relationship ontology now contains the directional lineage types `split_into` and `merged_into`.

A split is one atomic database action:

- one current source decision receives a terminal `split` revision;
- 2–10 corrected output decisions are appended;
- current support links for the source become superseded;
- terminal support, output support, and `split_into` lineage links are appended;
- the exact union of output evidence must equal the complete source evidence set.

The same source clause may support more than one split output. This overlap is intentional because one contractual clause can contain several distinct operative decisions. Evidence outside the source set is rejected, and omitting any source evidence is rejected.

A merge is one atomic database action:

- 2–10 current source decisions each receive a terminal `merged` revision;
- one corrected output decision is appended;
- current source support links become superseded;
- terminal support, output support, and one `merged_into` link per source are appended;
- the output evidence must exactly equal the union of all source evidence.

If any source has an unresolved conflict, the merged output must remain unresolved. R4.2C never selects an authority winner.

All actions use a workspace-scoped advisory lock and optimistic current-revision checks. A stale browser revision, incomplete lineage, repeated source, unsupported status, invalid evidence set, non-Hebrew core content, or malformed temporal data fails the whole transaction. No partial lineage is retained.

## Database publication and security

KAPAIM project: `smxibuaowzuxkznuouwj`.

Local migration contract: `20260817173106_contracts_decision_lineage_r4_2c.sql`.

Supabase remote migration record: `20260817150412_contracts_decision_lineage_r4_2c`. The managed apply timestamp differs from the local generated version; the runtime contract retains local migration version `20260817173106`.

The migration adds three service-role-only, `SECURITY INVOKER`, empty-search-path RPCs:

- `bidoc_contracts_decision_lineage_status_r4_2c`;
- `bidoc_contracts_get_decision_lineage_review_r4_2c`;
- `bidoc_contracts_review_decision_lineage_r4_2c`.

Anonymous and authenticated roles cannot execute these functions. The service role can execute only the bounded RPC contract. `private.contracts` and `private.contract_relationships` retain enabled and forced RLS.

The rollback refuses to remove R4.2C after any lineage row exists. This prevents an operator from destroying accepted split/merge history under the appearance of a schema rollback.

## Server routes and UI

Local activation flag: `CONTRACTS_DECISION_LINEAGE_R4_2C_APPROVED=TRUE`.

Authenticated same-origin superadmin routes:

- `GET /api/contracts/decisions/lineage/status`;
- `GET /api/contracts/decisions/workspaces/:workspaceId/lineage`;
- `POST /api/contracts/decisions/workspaces/:workspaceId/lineage/split/:decisionId`;
- `POST /api/contracts/decisions/workspaces/:workspaceId/lineage/merge`.

The browser cannot provide reviewer identity, database routing, model settings, timestamps, workspace ownership, or existing evidence. Those values are resolved server-side. Mutation bodies are bounded to 256 KiB and strictly reject unsupported fields.

The Hebrew Contracts UI now provides:

- **פצל החלטה** on current decisions;
- **בחר למיזוג** for selecting 2–10 current decisions;
- editable Hebrew output content and controlled decision metadata;
- an evidence picker with exact-set validation;
- a visible warning that accepted split/merge actions are append-only;
- current, terminal, and lineage metrics;
- persisted split/merge history after refresh.

## Live KAPAIM evidence

Retained workspace: `82345c75-c6f4-468d-b899-1f8407d9a9c1`.

Before publication, the full migration compiled successfully against live KAPAIM inside `BEGIN`/`ROLLBACK`.

A rollback-only split smoke appended a valid split graph and then removed every temporary row on rollback. A rollback-only merge smoke produced exactly:

- source decisions: 2;
- terminal decision revisions: 2;
- output decisions: 1;
- lineage links: 2;
- superseded support links: 2;
- terminal support links: 2;
- output support links: 2;
- incomplete lineage: 0;
- model calls: 0;
- Schedule writes: 0.

After rollback, KAPAIM still contained exactly 135 current decision revisions and zero retained test-lineage rows.

After managed publication:

- current decisions: 135;
- normalized proposals: 135;
- retained R4.2C lineage links: 0;
- anonymous execute privilege: false;
- authenticated execute privilege: false;
- service-role execute privilege: true;
- `private.contracts` RLS enabled and forced: true;
- `private.contract_relationships` RLS enabled and forced: true.

A live read-only call through the new server module returned `ready = true`, 135 current decisions, 135 proposals, zero lineage links, zero incomplete lineage, zero model calls, and zero Schedule writes.

### Post-publication R4.2A compatibility correction

The first refreshed combined R4.1/R4.2A/R4.2B/R4.2C screen exposed a read-only validator defect in the older R4.2A server module. Its projection correctly reported the 135 decisions subsequently created by R4.2B, but the historical validator still required `decisionCount = 0` and rejected the otherwise valid response.

The validator now accepts a safe non-negative observed decision count while continuing to require zero Schedule writes and all original R4.2A relationship, evidence, version, and gate constraints. A regression test fixes the exact phase-progression case. The corrected loader passed against live KAPAIM with 19 current relationships, 19 approved, zero pending, 135 decisions, and zero Schedule writes. No database row, schema, privilege, or migration changed for this compatibility repair.

The Supabase security advisor continues to report the existing informational `RLS enabled, no policy` notices for the private default-deny Contracts tables. This is intentional for the service-RPC-only design. No R4.2C-specific security or performance advisor regression was identified.

### Retained decision-review acceptance

The user authorized a source-by-source review of all 135 normalized proposals in retained workspace `82345c75-c6f4-468d-b899-1f8407d9a9c1`. The completed append-only review retained:

- approved decisions: 127;
- corrected decisions: 4, comprising two corrected generic summaries and two outputs from one atomic split;
- rejected structural headings: 3;
- unresolved decisions: 2, comprising one genuine monetary conflict and one OCR-corrupted clause enumeration;
- pending proposals: 0;
- split parents: 1;
- retained lineage links: 2;
- incomplete lineage: 0;
- active decisions: 133;
- current decision records including terminal and rejected revisions: 137;
- Schedule writes: 0.

The retained split separates the insolvency/receivership termination ground from SML's independent discretionary right to terminate, stop, or reduce the works. The first output preserves the explicit 15-calendar-day condition. Both outputs retain exact source evidence and are visible after refresh.

The first browser split attempt also exposed a local route defect before any KAPAIM mutation: the split and merge routes imported a nonexistent `src/contracts/multipart.js`. Both routes now use the existing bounded `readJsonBounded(req, 262_144)` request reader. A regression assertion rejects any future `contracts/multipart.js` reference. The UI lineage serializer now converts legacy canonical English tags to their locked Hebrew labels while preserving tags already written in Hebrew.

## Verification

- `npm.cmd run test:contracts` — 141/141 passed.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `node --check src/contracts/decisionLineage.js` — passed.
- `node --check src/server.js` — passed.
- `git diff --check` — passed; only existing line-ending warnings were reported.
- full KAPAIM migration compile inside `BEGIN`/`ROLLBACK` — passed.
- rollback-only split and merge atomicity/lineage/no-model/no-Schedule checks — passed.
- managed KAPAIM migration publication and post-apply privilege/RLS checks — passed.
- live server-module read-only status/projection smoke — passed.
- retained 135-proposal human review — passed with zero pending proposals and zero Schedule writes.
- retained atomic split — passed with two outputs, two lineage links, and zero incomplete lineage.
- post-review refresh — passed; both split outputs and the 137-current-record badge are visible.
- missing `multipart.js` route regression — fixed; `npm.cmd run test:contracts` remains 141/141 passed.

## Acceptance closeout

The decision-quality gate is complete: every proposal has a durable review outcome, the genuine split survived refresh, and the retained projection reports complete lineage with zero Schedule writes.

The current local `npm run dev` process was started before the bounded request-reader correction. Restart it once with `Ctrl+C` followed by `npm run dev` before using split/merge again or beginning R5. No additional R4.2 decision review is required.

## Deliberately deferred

- authority ordering or conflict-winner selection;
- Schedule activity projection, mapping, dates, alerts, or writes;
- R5 and all later phases;
- commit, push, deployment, or production propagation.

The next bounded slice after R4.2C visual acceptance and decision-quality review is R5 shadow Schedule projection. R5 remains a separate approval gate.
