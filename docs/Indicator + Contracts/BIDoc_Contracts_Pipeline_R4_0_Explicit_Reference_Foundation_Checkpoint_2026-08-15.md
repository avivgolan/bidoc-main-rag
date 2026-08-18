# BIDoc Contracts Pipeline R4.0 — explicit-reference relationship foundation checkpoint

Date: 2026-08-15

Status: implemented, remotely applied to KAPAIM, configured for local activation, and verified after explicit user approval; the user-owned server restart remains the final manual runtime step.

## Outcome

The existing Contracts tab now contains the first bounded Contracts Relationships Agent surface. It deterministically converts only R3's already-extracted explicit-reference observations into review-ready clause-to-clause relationship proposals.

For the retained 189-record contract, the panel displays:

| Measure | Verified value |
| --- | ---: |
| Explicit references found | 15 |
| Canonical direct-link proposals | 14 |
| Unresolved references preserved | 1 |
| Model-proposed relationships | 0 |
| Contractual decisions created | 0 |
| Schedule writes | 0 |

The unresolved item remains the Appendix C reference whose target is absent from the source document. BIDoc does not invent a target.

## Locked R4.0 semantics

- Relationship type is `cross_reference`, displayed as **הפניה מפורשת**.
- Origin is `explicit_reference`, displayed as **הפניה שכתובה בחוזה**.
- Confidence is `null`; deterministic observations are not given a model confidence score.
- Initial review status is `proposed`, displayed as **מוצע לסקירה**.
- Repeated references from the same source clause to the same target clause collapse into one canonical relationship while retaining the reference observations in evidence.
- Each proposal carries immutable source and target clause evidence plus a Hebrew rationale.
- The rationale explicitly states that a cross-reference alone does not prove same-decision support, dependency, exception, amendment, duplication, or conflict.

## Persistence and security contract

Migration `20260815182148_contracts_relationships_explicit_reference_r4_0.sql` adds three short service-role-only, `SECURITY INVOKER`, empty-search-path RPCs:

- relationship status;
- current relationship projection for one saved R3.2 workspace;
- one atomic explicit-reference persistence operation.

The operation reuses the R1 append-only `private.contract_relationships` table and its canonical relationship identity. The first same-policy run inserts revision 1; an identical rerun reuses it instead of creating a duplicate. One workspace/policy advisory transaction lock serializes concurrent runs. Browser database overrides remain rejected and all database credentials remain server-owned.

Activation fails closed through `CONTRACTS_RELATIONSHIPS_R4_APPROVED=TRUE`. The flag is now enabled in the local server environment. When the flag is absent, the Hebrew preview remains visible but the save button is disabled and no database request is made.

The rollback removes only the R4.0 RPCs and refuses to run after any R4.0 proposal exists. It never deletes append-only relationship history.

## Verification

- `npm.cmd run test:contracts` — 121/121 passed.
- `npm.cmd run test:contracts:r4-db` — passed in the dedicated local Supabase container.
  - first run: 1 inserted, 0 reused;
  - identical second run: 0 inserted, 1 reused;
  - unresolved reference retained;
  - authenticated browser role denied direct RPC execution;
  - empty rollback/reapply passed;
  - populated rollback refusal passed;
  - 0 decision rows and 0 Schedule rows.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `node --check` for the server and both new relationship modules — passed.
- Authenticated Chrome check against the retained 189-record workspace — 14 proposal cards, one unresolved section, disabled pre-activation save button, Hebrew labels and explanation rendered, and zero console warnings/errors.
- KAPAIM migration `20260815191126_contracts_relationships_explicit_reference_r4_0` — applied successfully from the reviewed local R4.0 SQL.
- KAPAIM function boundary — 3/3 R4.0 RPCs present; `service_role` has execute, while `anon` and `authenticated` have none.
- KAPAIM retained workspace — 189 clause rows, 14 saved R4.0 relationship rows, 1 unresolved Appendix C reference, and 0 decision rows.
- KAPAIM idempotency — first run inserted 14 and reused 0; identical rerun inserted 0 and reused 14.
- KAPAIM Schedule boundary — milestones, extensions, conditions, and activity-map counts remained unchanged at 0.
- KAPAIM browser boundary — `anon` and `authenticated` have neither `private` schema usage nor direct select on `private.contract_relationships`.

No OpenRouter call, decision row, Schedule write, n8n change, deployment, commit, or push occurred in R4.0.

## Deliberately deferred

R4.0 does not yet perform semantic retrieval, model-based grouping, `supports_same_decision`, dependency/condition/exception/amendment/duplicate/conflict proposals, conflict adjudication, normalized decision creation, or human approve/correct/reject persistence. Those are later R4 slices and remain separately gated.

## Next approval gate

Restart the local BIDoc server so it reloads the enabled R4 flag, then manually confirm that the saved 14-link relationship panel loads in the Contracts tab. Stop before semantic/model-based relationship grouping, relationship review-decision persistence, or normalized contractual-decision creation until explicitly approved.
