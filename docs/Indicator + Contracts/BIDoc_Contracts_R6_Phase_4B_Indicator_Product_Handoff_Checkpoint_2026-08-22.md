# BIDoc Contracts R6 Phase 4B - Indicator Product Handoff Checkpoint

Date: 2026-08-22
Status: applied to KAPAIM and verified with local application code; not deployed

## Delivered Boundary

The Contracts-to-Indicator read boundary now uses the clean
`private.contracts_product_r6_v1` product view rather than the legacy R4.2C
decision projection. The existing Contracts review UI remains on its current
review RPCs and is not rewritten by this phase.

Delivered artifacts:

- Migration: `supabase/migrations/20260822113820_contracts_r6_indicator_product_handoff.sql`.
- Acceptance: `supabase/tests/contracts-r6-indicator-product-handoff.sql`.
- Local fixture: `supabase/tests/contracts-r6-indicator-product-handoff-baseline.sql`.
- Safe rollback: `supabase/rollbacks/contracts_r6_indicator_product_handoff.rollback.sql`.
- Product source RPC: `public.bidoc_contracts_r6_indicator_product_handoff_source_v1(uuid)`.
- Application mapper: `src/contracts/indicatorHandoff.js`.

No new environment variable was introduced. The existing server-side Indicator
handoff activation flag remains the gate.

## Product Contract

The service-role-only RPC returns compact product records with:

- `projectId` and `sourceDocumentId`.
- Hebrew `categoryHe`, `indicatorSuitability`, `reviewStatus`, tags, and trigger.
- Compact contractual `timing` without runtime due dates.
- Exact source evidence and technical decision identity.
- Embedding readiness and dimension, without returning the vector payload.

The RPC rejects browser roles, uses `security invoker`, reads only the private
R6 product view, and performs no model, contract-truth, Indicator, or Schedule
write. Legacy handoff fields such as `scheduleImpact`, `decisionCategory`,
`temporalKind`, `scheduleProjectId`, and `targetTable` are not exposed.

## Local Verification

- Supabase CLI migration scaffolding was attempted first and failed with the
  known Windows/OneDrive `LegacyMigrationNewWriteError: AlreadyExists`.
- The migration compiled in an isolated PostgreSQL 17 Supabase container.
- Acceptance passed.
- Function-only rollback passed while preserving the product view and fixture rows.
- Reapply and acceptance passed.
- Contracts tests: 164/164 passed.
- React production bundle: passed.
- Contracts review UI verification: passed.
- The repository-wide suite remains red on 13 unrelated existing assertions in
  the React bridge, project-insights roadmap, settings/workflow UI, and timeline
  mobile behavior. None reference the Phase 4B migration or handoff module.
- The disposable test container was removed; unrelated Docker containers were not changed.

## KAPAIM Application

Supabase recorded the migration as:

- Version: `20260822090003`.
- Name: `contracts_r6_indicator_product_handoff`.

The exact acceptance SQL passed with 235 product decisions and 235 embedding-ready
decisions. Supabase security and performance advisors reported no finding tied to
the new RPC or product view. Older project-wide advisor findings remain outside
this phase.

## New Contract Audit

Workspace `4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa` returned:

- Product decisions: 98.
- Embedding-ready decisions: 98.
- Invalid product items: 0.
- Legacy or operational handoff fields: 0.
- Contract-truth writes: 0.
- Indicator writes: 0.
- Schedule writes: 0.

The local application classified all 98 decisions as requiring review because
their current product value is `נדרשת_בדיקה`. This is an explicit suitability
state, not missing-vector debt: all 98 embeddings are ready.

## Zero-Write Parity

Before and after Phase 4B:

- Clause rows remained 313.
- Decision revisions remained 421.
- Product decisions remained 235.
- Embedding-ready product decisions remained 235.
- Every `schedule_contract_%` and `indicator_contract_%` table count remained identical.

## Stop Gate

The KAPAIM read boundary is complete. The updated server and React bundle are not
deployed, and no Git commit was created. The remaining approved boundary is a
Vercel deployment followed by an authenticated production handoff/UI smoke test
and final repository commit.
