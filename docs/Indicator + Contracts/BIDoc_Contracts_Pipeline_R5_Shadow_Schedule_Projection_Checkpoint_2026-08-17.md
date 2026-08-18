# BIDoc Contracts Pipeline R5 — Indicator handoff correction

Date: 2026-08-18

Status: the earlier Schedule-shadow interpretation is superseded. Contracts now owns only a read-only suitability handoff; the future `indicator_agent` owns project placement, target selection, activity mapping, calendar/date calculation, and every Schedule write.

## Outcome

R5 derives one complete handoff view from the existing current revisions in `private.contracts`. It creates no fourth Contracts table and no second source of contractual truth.

Every current decision is classified as exactly one of:

- `suitable`: reviewed or corrected, `schedule_impact = yes`, and no uncleared conflict;
- `not_suitable`: inactive, or reviewed with `schedule_impact = no`;
- `requires_review`: not reviewed, suitability still `unknown`, or conflict not cleared.

The Contracts tab exposes the classifications and exact stored evidence in Hebrew. The handoff route is authenticated, same-origin, and GET-only. It makes no model call and performs no Contracts, Schedule, activity-mapping, or runtime-date write.

This satisfies the Contracts-side R5 boundary. It does not claim that every saved decision has already received a final suitability judgment.

## Live retained-workspace evidence

KAPAIM project: `smxibuaowzuxkznuouwj`.

Retained workspace: `82345c75-c6f4-468d-b899-1f8407d9a9c1`.

The live read-only audit returned:

- mode: `indicator_handoff_read_only`;
- current decisions: 137;
- suitable for Indicator: 40;
- not suitable: 24;
- requires review: 73;
- model calls: 0;
- Contracts truth writes: 0;
- Schedule writes: 0;
- activity-mapping writes: 0;
- runtime due-date writes: 0.

The 73 review-required rows are explained rather than silently defaulted:

- 71 are reviewed decisions whose saved `schedule_impact` is still `unknown`;
- 2 decisions are not yet in an approved or corrected terminal review state;
- one of those two also has an unresolved conflict.

The system therefore does not convert missing judgment into either approval or rejection.

Reusable command:

```powershell
npm.cmd run contracts:r5-handoff-live -- 82345c75-c6f4-468d-b899-1f8407d9a9c1
```

## Corrective KAPAIM migration

The user approved the R5 correction and the exact migration was applied once through the managed Supabase migration interface:

- remote migration version: `20260818080957`;
- remote migration name: `contracts_indicator_handoff_r5`;
- local migration: `supabase/migrations/20260818102828_contracts_indicator_handoff_r5.sql`;
- local SHA-256: `5CF54CCCE505F707D03EFFBCFA6036A2DEDCCFE87B73BF57213F4395EF949FBC`.

Post-apply catalog verification confirmed:

- the legacy `public.bidoc_contracts_schedule_projection_source_r5(uuid)` RPC is absent;
- the three Contracts-owned one-target unique indexes are absent;
- three ordinary lineage lookup indexes remain;
- all three source-lineage triggers validate only changes to `source_contract_decision_id`;
- the validator requires a current reviewed decision with `schedule_impact = yes` and a cleared conflict;
- it does not select a target table or validate a Contracts-owned target payload;
- all three Schedule contract target tables contain zero rows and zero linked rows.

The corrective rollback refuses to restore the older ownership model after any linked Indicator/Schedule row exists.

## Routes and activation

Activation flag: `CONTRACTS_INDICATOR_HANDOFF_R5_APPROVED=TRUE`.

The legacy `CONTRACTS_SCHEDULE_PROJECTION_R5_APPROVED=TRUE` remains an activation alias for existing local configuration only.

Authenticated same-origin routes:

- `GET /api/contracts/decisions/indicator-handoff/status`;
- `GET /api/contracts/decisions/workspaces/:workspaceId/indicator-handoff`.

There is no R5 POST, promotion, Schedule planner, target-row creator, resolver, calendar calculation, or alert endpoint.

## Verification

- `npm.cmd run test:contracts` — 148/148 passed.
- `npm.cmd run test:schedule` — 47/47 passed.
- `npm.cmd run react:build` — passed; 21 modules transformed.
- `git diff --check` — passed; only Windows line-ending warnings were reported.
- retained-workspace live Indicator handoff audit — passed with all 137 decisions accounted for and every write counter at zero.
- managed KAPAIM catalog verification — passed with the exact corrective migration, zero legacy uniqueness, three lineage indexes/triggers, and zero target rows.
- Supabase security advisor — no R5-specific finding; project-wide result remains 88 findings (`INFO` 37, `WARN` 43, `ERROR` 8).
- Supabase performance advisor — three new `INFO` unused-index notices for the empty lineage indexes; expected until the future Indicator creates lineage-bearing rows.

## Acceptance and next owner

Restart the local server, reopen the retained contract, and click **טען את ערכת המסירה ל־Indicator**. The expected counts are 137 / 40 / 24 / 73 with every write counter at zero.

R5 implementation is complete. Before the handoff set can be called fully adjudicated, the 71 `schedule_impact = unknown` decisions and the two non-terminal review decisions still need explicit suitability review. That review changes contractual decision truth only; it does not place anything on a schedule.

The separate future Indicator phase will consume only the suitable set and will own all mapping and operational writes.

## Deliberately deferred

- project or activity mapping;
- target-table selection and target cardinality;
- calendar or due-date calculation;
- Schedule row creation, updates, alerts, or runtime evidence;
- commit, push, deployment, or production propagation.
