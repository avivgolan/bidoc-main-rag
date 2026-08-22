# BIDoc Contracts Pipeline R4.2B.1 - Safe Automatic Decision Review Checkpoint

Date: 2026-08-22
Workspace: `4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa`

## Approved Scope

R4.2B.1 automatically approves only current R4.2B decision proposals that pass both deterministic source-grounding checks and an independent model verification with confidence of at least `0.98`. Any uncertainty remains in the human queue.

The phase does not reject or correct decisions, choose conflict winners, hand decisions to Indicator, or write Schedule rows.

## Delivered

- Server-owned decision loading, policy checks, verifier prompts, thresholds, and model configuration.
- An independent verifier using the configured main model with structured output, bounded batches, concurrency, deadline, and one retry.
- Fail-closed behavior for provider failures, malformed output, incomplete evidence, numeric or party mismatch, missing temporal classification, recurrence mismatch, or conflicts.
- One atomic, service-role-only, append-only RPC that creates approved decision revisions and approved support lineage.
- R6 embedding refresh for newly approved revisions.
- Hebrew UI action and metrics in the Decisions tab.
- No new environment variable or feature flag.

## Database Package

- Local migration: `supabase/migrations/20260821223832_contracts_decision_auto_review_r4_2b1.sql`
- Supabase migration history entry: `20260821204450_contracts_decision_auto_review_r4_2b1`
- SQL verification: `supabase/tests/contracts-decision-auto-review-r4-2b1.sql`
- Rollback guard: `supabase/rollbacks/contracts_decision_auto_review_r4_2b1.rollback.sql`
- Status RPC: `public.bidoc_contracts_decision_auto_review_status_r4_2b1()`
- Apply RPC: `public.bidoc_contracts_auto_review_decisions_r4_2b1(uuid,uuid,text,text,jsonb)`

Both functions are `SECURITY INVOKER`, use an empty `search_path`, and grant execution only to `service_role`.

## Live Quality Gate

The initial no-write audit reviewed all 98 proposed decisions:

- Deterministically eligible for verifier: 88
- Eligible for automatic approval: 46
- Human review required: 52
- Verifier calls: 22
- Failed batches: 0
- Schedule writes: 0

The live execution reran the independent verifier against current state. Because model judgments are not fully deterministic, it produced a different but still policy-valid boundary:

- Automatically approved: 51
- Remaining human review: 47
- Rejected: 0
- Corrected: 0
- Failed batches: 0
- Schedule writes: 0

The system must not assume the same set or count on repeated model runs. The database accepts only items whose submitted evidence records an `approve` verdict, `accepted` reason, confidence at or above `0.98`, all deterministic checks true, and no blockers.

## Live Database Verification

- Current decision identities: 98
- Total append-only revisions: 149
- Approved current revisions: 51
- Proposed current revisions: 47
- Approved revisions missing a proposed predecessor: 0
- Approved revisions with a revision other than 2: 0
- Approved revisions missing embeddings: 0
- Approved vectors not 3,072 dimensions: 0
- Invalid embedding hashes: 0
- Invalid controlled Hebrew tags: 0
- Non-Hebrew tags: 0
- Invalid controlled triggers: 0
- Non-Hebrew triggers: 0
- Approved automatic support rows: 56
- Invalid automatic support rows: 0
- Schedule milestone rows linked to this workspace: 0
- Schedule extension rows linked to this workspace: 0
- Schedule condition rows linked to this workspace: 0

The existing Indicator sync timestamp for this workspace predates R4.2B.1 execution, confirming that this phase did not invoke the Indicator sync.

## Remaining Work

The 47 proposed decisions remain visible for human review. A later quality-improvement phase may analyze blocker distributions and improve R4.2B normalization, but it must not weaken the 98% approval gate or silently convert uncertain proposals into approved decisions.

No commit, deployment, Indicator handoff, or Schedule operation is part of this checkpoint.

## Existing Project Advisory

Supabase advisors still report pre-existing project-wide RLS findings, including disabled RLS on legacy backup tables and `private.indicator_contract_condition_sync_state`. R4.2B.1 did not create or modify those tables. They require a separate access-policy decision and must not be auto-fixed because enabling RLS without matching policies can break existing access.
