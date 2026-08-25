# Contracts, Schedule, and Alerts Handoff Plan

Date: 2026-08-24  
Status: implementation plan; no production write or deployment performed.

## Verified starting point

- The Contracts UI now renders canonical Hebrew tags directly. The legacy English-key label map remains available for older records.
- The existing Indicator flow already owns the correct operational path: it synchronizes eligible reviewed relative decisions into `schedule_contract_conditions`; the Schedule condition resolver finds verified anchor evidence; the Schedule engine performs date arithmetic.
- A read-only dry run for workspace `4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa` found an active project mapping but zero eligible and zero blocked conditions.
- The R6 product source contains 98 decisions: all have `timing.kind = none`, all have `indicatorSuitability = נדרשת_בדיקה`, and 51 are approved while 47 remain proposed. The immediate defect is therefore missing structured temporal extraction/classification, not a missing waiting table or trigger.
- The older R5 shadow-projection audit cannot diagnose this R6 workspace: it receives zero `scheduleImpact=yes` decisions, its legacy source-mapping RPC is unavailable, and no active Schedule version is returned. It remains useful as a later projection acceptance check, but not as the required temporal-coverage audit.
- The Schedule-assignment agent is active with its unchanged default configuration: `gpt-4o-mini` for filtering, extraction, matching, and validation; `gpt-4o` for judging; `text-embedding-3-large` for embeddings; 90% automatic-assignment threshold; 12-point minimum margin. All editable prompts match the code defaults.
- The legacy Daily Alerts RAG workflow reads `alerts_gf` / `alerts_embeddings_gf`. The Schedule service writes and manages a separate `schedule_alerts` lifecycle. Neither is currently a contract-derived event adapter for the other.

## Workstream 1 — Contracts to Indicator and the Schedule engine

### Phase 1A: temporal-coverage audit

1. Add a deterministic, source-evidence-based audit that compares time expressions in saved contract clauses with the current R6 product decisions' structured timing fields. This is distinct from the existing R5 shadow-projection audit, whose inputs are insufficient for the current workspace.
2. Report each missing candidate as one of: fixed date, relative offset, recurring/windowed rule, sub-day rule, ambiguous, or unsupported compound rule.
3. Produce no database writes and do not change an existing decision revision.

**Acceptance:** every detected time expression is either represented by a current structured decision or explicitly placed in a review queue with its source excerpt.

### Phase 1B: versioned re-extraction and review

1. Extend the existing decision extraction/review contract only where Phase 1A proves a missing representation.
2. Create new append-only revisions; preserve the 98 current product decisions and all source evidence.
3. Require a reviewer to select the Indicator suitability and approve/correct each schedule-relevant relative rule.

**Acceptance:** approved relative/recurring decisions contain a controlled trigger, anchor description, non-negative offset, supported unit, cleared conflict state, and exact source evidence.

### Phase 1C: existing Indicator synchronization

1. Reuse `bidoc_indicator_sync_contract_conditions_v1`; do not create a parallel Contracts-to-Schedule writer.
2. Verify the dry run first, then use the existing controlled commit only for approved eligible rows.
3. Run the Schedule condition resolver and verify that it stores trigger evidence before a deterministic due date is created.

**Acceptance:** one idempotent pending condition per approved decision revision; no fabricated due date; superseded pending rows are dismissed while resolved history remains.

## Workstream 2 — Schedule-assignment agent

### Phase 2A: evaluation baseline

1. Build a read-only evaluation set from historically confirmed/rejected `schedule_activity_alert_links`, plus explicit no-match and ambiguous cases.
2. Measure the current default configuration by role: extraction validity, candidate recall, incorrect automatic assignments, abstentions, and model-call cost/latency.

### Phase 2B: prompts, models, and configuration

1. Update only the roles that fail the baseline; preserve strict JSON-only outputs and candidate-bound decisions.
2. Compare any model change against the same evaluation set; do not change the 90%/12-point safety gates without evidence.
3. Save a versioned configuration snapshot and run a dry-run on representative project data before enabling a write-capable run.

**Acceptance:** no incorrect automatic assignment in the labelled high-confidence set; ambiguous/no-match cases remain non-writing; configuration changes are reproducible and auditable.

## Workstream 3 — Notifications and updates from contracts

### Phase 3A: integration decision and data contract

1. Confirm which existing mechanism is the intended user-facing delivery path: the legacy Daily Alerts RAG workflow, the Schedule `schedule_alerts` lifecycle, or another notification channel.
2. Define the additive contract-derived event payload: project identity, source decision revision, condition/occurrence identity, lifecycle state, severity basis, evidence link, and idempotency key.
3. Keep the Contracts agent read-only with respect to notifications; the Indicator/Schedule/alert layer owns event creation and lifecycle.

### Phase 3B: adapter and verification

1. Add one server-owned adapter into the selected existing mechanism rather than writing directly from Contracts to a user-facing alerts table.
2. Cover create, update, resolution, deduplication, and source-evidence rendering.
3. Verify no unrelated legacy alert/query rows change.

**Acceptance:** one contract-derived lifecycle event is visible through the agreed existing mechanism, retains source lineage, does not duplicate on repeated sweeps, and resolves when the underlying condition resolves or is superseded.

## Execution order

1. Complete Phase 1A, then review its evidence before creating new decision revisions.
2. Complete Phase 1B and Phase 1C as separate checkpoints because they change contractual and operational state.
3. Complete Phase 2A before choosing different prompts/models/configuration.
4. Start Phase 3 only after its delivery mechanism is explicitly selected.
