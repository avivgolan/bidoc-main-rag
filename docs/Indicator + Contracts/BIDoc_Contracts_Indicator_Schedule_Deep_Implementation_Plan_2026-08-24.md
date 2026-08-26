# Contracts -> Indicator -> Schedule: Deep Implementation Plan

Date: 2026-08-24 (updated 2026-08-26)
Status: the CTO-approved direct-input lane has written and verified eight new pending rows in APP DATA. The normal reviewed-Contracts-to-Indicator sync remains a separate future bridge; no runtime trigger or due date was written.

## Target architecture and ownership

```text
immutable contract clause
  -> append-only, human-reviewed Contract decision
  -> Indicator eligibility sync
  -> schedule_contract_conditions waiting pool
  -> Schedule resolver validates a real anchor event
  -> Schedule engine calculates lifecycle / due date
  -> selected alert mechanism renders the lifecycle event
```

Contracts owns contractual truth, not operational dates. Indicator is the only Contracts-to-Schedule writer. Schedule owns anchor evidence, date calculation, and lifecycle. The notification layer only exposes Schedule-owned state.

Exception recorded for this approved one-time delivery: the CTO explicitly approved direct population of the target table before the narrow Contract decision-review bridge exists. The eight rows are marked `written_by = contracts_agent_cto_approved`, retain immutable clause text/page and separate provenance metadata, and leave `source_contract_decision_id = null`. They must not be placed in the normal Indicator sync scope, because that scope is reserved for a reviewed source decision.

## Verified baseline

- The workspace has an active Contracts-to-Schedule project mapping, but its dry-run has zero eligible conditions.
- The R6 source contains 98 decisions (51 approved, 47 proposed). Every current record reports `timing.kind = none` and `indicatorSuitability = נדרשת_בדיקה`.
- The temporal coverage audit found eight timing clauses absent from R6 decisions: `3.6`, `3.8`, `8.2`, `8.5`, `8.10.2.1`, `8.10.2.4`, `13.4`, `15.3`.
- The existing Indicator RPC is correct but gates on the legacy reviewed fields `scheduleImpact`, `temporalKind`, trigger/description, offset, unit, and conflict status. `indicatorSuitability` alone is not sufficient.
- The four existing Indicator-authored conditions establish the target pattern: one commencement condition uses `anchor_kind = schedule_task` with `anchor_description = מועד תחילת העבודות`; event-based conditions use `anchor_kind = event` and a specific Hebrew event description. R6's controlled value `תחילת העבודה` needs a runtime adapter so it reaches the first pattern rather than defaulting to `event`.
- The legacy R5 shadow audit lacks the R6 source/mapping required for diagnosis. Keep it only as a post-bridge acceptance check.
- The schedule-assignment agent is distinct: it links existing `alerts` events to Gantt activities. It currently uses unchanged defaults: `gpt-4o-mini` for time filter/extraction/matching/validation, `gpt-4o` for judge, `text-embedding-3-large` for embeddings, 90% auto threshold, 12-point runner-up margin.
- Daily Alerts RAG reads `alerts_gf`/`alerts_embeddings_gf`; Schedule maintains `schedule_alerts`. There is no verified contract-event adapter between them.

## Workstream 1 — Contracts -> Indicator -> Schedule engine

### Outcome

For each reviewed schedule-relevant contractual rule, the final deliverable is exactly one idempotent pending row in `public.schedule_contract_conditions`. The Indicator team owns trigger detection and subsequent Schedule processing; Contracts supplies the reviewed contractual condition fields that the Indicator reads.

The extraction/review work must therefore prioritize the table's matching contract, especially the two anchor fields:

| Target column                                                          | Contracts responsibility                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `anchor_kind`                                                        | A controlled anchor class, such as`event` or `schedule_task`, that tells Indicator where to look. |
| `anchor_description`                                                 | The exact, source-grounded Hebrew description of the event/task that starts the contractual clock.    |
| `offset_value` / `offset_unit`                                     | The contractual period to apply after the anchor is found.                                            |
| `recurring`                                                          | Whether the condition repeats.                                                                        |
| `source_excerpt` / `source_page` / `source_contract_decision_id` | The contract lineage required to explain and audit the condition.                                     |

Contracts does not populate `trigger_event_date`, `trigger_source_table`, `trigger_source_id`, `resolved_milestone_key`, or a calculated due date. Those are runtime facts owned by Indicator/Schedule after it matches an anchor.

### Phase 1A — Source coverage (complete)

The read-only coverage audit compares immutable saved clauses against R6 structured timing. A temporal clause is classified as `represented`, `missing_decision`, or `missing_structured_timing`. It performs no model/database/Schedule operation.

Acceptance: every timing clause is either structured or listed in a bounded repair queue.

### Phase 1B — Narrow re-extraction lane (started locally)

The existing R4.2B decision runner deliberately refuses to process a workspace that already has decisions. That protects the current 98 records but prevents repairing the eight uncovered clauses. The solution is a separate narrow lane, not a full re-run.

Implemented now:

- `contracts:temporal-reextraction-plan` derives deterministic candidate keys from the audit and immutable clauses.
- Every numeric relative-time mention receives its own candidate with clause key, text offset, and bounded source context.
- Recurring/windowed/compound rules without one unambiguous numeric mention become `manual_temporal_review`; missing immutable source text becomes blocked rather than guessed.
- This creates no model call, decision revision, or remote write.

Read-only validation run (2026-08-25): the eight uncovered clauses produced nine distinct candidates. With the primary model and the target-table anchor contract, all nine received a source-grounded offset and anchor description. Eight were proposed as potentially schedule-relevant; the six-month non-solicitation rule was proposed as not schedule-relevant. These are model proposals only: no Contract decision, Indicator condition, or Schedule runtime field was written.

CTO-authorized APP DATA delivery (2026-08-25): the eight schedule-relevant candidates were inserted directly into `public.schedule_contract_conditions` for Schedule project `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5`. The table now contains 12 rows: four existing Indicator-authored rows and eight new `contracts_agent_cto_approved` rows. Every new row is `pending`, has exact source text plus source page, has `anchor_kind = event`, and has `trigger_event_date`, trigger source, and resolved milestone all null. The rows use a deterministic `cto-approved-temporal:<sha256>` key; this is deliberately not an Indicator-sync or fake Contracts-decision key.

Compatibility safeguard applied: the direct rows use `metadata.source_contracts_workspace_id`, not `metadata.contracts_workspace_id`. The latter is the existing Indicator sync scope and would cause a later sync to dismiss a row that intentionally has no `source_contract_decision_id`.

Next implementation:

1. Add server-only normalization that accepts only the generated candidate keys; never browser-supplied clauses, model config, or decision fields.
2. Reuse the existing bounded JSON schema, zero-temperature model policy, controlled Hebrew trigger catalog, and numeric/unit validation.
   The narrow anchor-extraction lane uses the configured primary model because a source-grounded `anchor_description` drives downstream Indicator matching; the cheaper model remains suitable for the broad existing flow.
3. Create append-only `proposed` decisions only. Do not overwrite the 98 decisions or auto-approve a contractual interpretation.
4. Require reviewer action: approve, correct, reject, or unresolved. Persist source clause/evidence, a decision revision, category, temporal kind, trigger, Hebrew trigger description, non-negative offset, allowed unit, recurrence, and conflict state.
5. Validate the resulting table-row projection against the four existing boss-authored `schedule_contract_conditions` examples before any write is enabled. The examples define the accepted shape and use of `anchor_kind` and `anchor_description`; they do not replace contract evidence or review.

Acceptance: only the uncovered rule(s) get proposals; multiple time mentions in one clause get separate decision keys; all other decision history remains untouched.

### Phase 1C — R6 eligibility bridge

Before any Schedule sync, introduce one versioned, server-owned bridge into the existing Indicator RPC. A current decision is eligible only when all fields below are true:

| Field                | Required value                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Review               | `approved` or `corrected`                                                                 |
| Scheduling relevance | reviewer-confirmed`scheduleImpact = yes`                                                    |
| Temporal kind        | `relative` or `recurring`                                                                 |
| Conflict             | `none` or reviewed/cleared                                                                  |
| Trigger              | controlled value plus non-empty Hebrew description                                            |
| Offset               | non-negative and unit in`hours`, `calendar_days`, `working_days`, `weeks`, `months` |
| Evidence             | decision revision and source clause/page/excerpt                                              |

`indicatorSuitability` is a product classification, not authorization to schedule. The bridge must explicitly project reviewer-confirmed operational fields into the current Indicator eligibility shape, without introducing a second `schedule_contract_conditions` writer.

Implementation order:

1. Finalize the local service contract and tests.
2. Add the narrow migration/RPC or versioned eligibility view; preserve append-only Contract history and service-role/RLS boundaries.
3. Add a reason-coded, read-only eligibility dry run.
4. Use the existing review-gated writer `bidoc_indicator_sync_contract_conditions_v1`. A table-level compatibility trigger maps the R6 Hebrew `תחילת העבודה` value to `schedule_task` during the same upsert, while the resolver recognizes both the legacy English and R6 Hebrew values. This adds no parallel writer and avoids sync churn.

Local implementation ready for review: migration `20260825113815_contracts_r6_indicator_anchor_contract.sql` adds the Hebrew commencement compatibility trigger without changing the V1 writer or any existing condition row until it is applied. It was created after the Supabase CLI migration command failed with the known OneDrive directory error; it has not been applied to APP DATA.

Acceptance: every dry-run row is explainable by decision revision/reason code; eligibility is never inferred from a number of days alone.

### Phase 1D — Controlled operational execution

After the bridge is code-reviewed and the dry-run is positive:

1. Execute `reconcileContractConditions(..., commit:false)`.
2. With explicit approval for the production mutation, invoke `commit:true` once.
3. Run the Schedule resolver/sweep. It may resolve only after verified anchor evidence exists; otherwise the condition remains pending.
4. Re-run dry-run and the older R5 projection as acceptance checks.

Acceptance: one pending condition per current eligible decision revision; no fabricated date; repeated sync is idempotent; supersession dismisses only pending conditions and retains resolved history.

## Workstream 2 — Schedule-activity assignment agent

### Outcome

Improve alert-to-Gantt assignment without lowering safety gates or causing a wrong automatic assignment. This does not make Contract conditions into Gantt activity assignments.

### Phase 2A — Read-only evaluation baseline

1. Build a versioned evaluator using historically manually confirmed/rejected `schedule_activity_alert_links`; include active schedule version and avoid label leakage.
2. Add explicit no-match, stale activity, irrelevant alert, and ambiguous examples.
3. Run the exact current setting in `commit:false` and measure candidate recall at 1/5, false automatic assignments, correct automatic assignments, abstentions, role JSON failures, latency, model calls, and candidate count.
4. Store fixture data cutoff, settings version, and prompt hashes so every later comparison is reproducible.

Acceptance: each disagreement has a row-level explanation and the baseline makes false-auto rate visible.

Implementation status (2026-08-26): the code-side Phase 2A baseline foundation is implemented, while the real human-labelled dataset run remains deferred. The evaluator now freezes a data cutoff, active Schedule version, engine version, settings version, configuration snapshot ID, per-role prompt hashes, fixture hash, and evaluated human-link IDs. It reports candidate recall@1/@5, correct and false automatic assignments, abstentions, role/JSON failures, latency, model-call count, and candidate count with a row-level explanation. The runtime also exposes `wouldAutoAssign` separately from an actual write and supports an internal `commit:false, persistAudit:false` fixture lane that neither writes audit rows nor creates `schedule_activity_alert_links`. Human labels are never passed into the assignment pipeline. A private ignored data directory and CLI support preparing historical human-confirmed/rejected fixtures and running the frozen baseline. The live read-only preparation attempt was not accepted as evidence because the configured APP DATA endpoint returned HTTP 522. This does not invalidate the independently published Phase 2B configuration, but it prevents any production-accuracy claim.

Validation note (2026-08-26): a single synthetic Hebrew end-to-end smoke case exercised the current code-default extractor, embeddings, matcher, validator, judge, and unchanged 90/12 safety policy without any database read or write. The expected activity ranked first and top-5 recall was 100% for this one synthetic case; there were zero role/JSON failures and zero false automatic assignments. The policy correctly abstained because the final score was 86.96%, below the unchanged 90% threshold, despite a 36.29-point runner-up margin. The result validates the evaluation lane and gate explanation only; it is not a production-accuracy baseline and must not justify a prompt, model, weight, or threshold change.

Remaining configuration hypotheses to measure on the frozen human-labelled set:

1. The “semantic” stage currently embeds only the candidates that already survived deterministic retrieval; it is a bounded rerank, not retrieval across every active Gantt activity. If deterministic top-20 recall is poor, improving prompts or models cannot recover the missing activity.
2. `maxModelCalls: 4` currently bounds chat-role calls only. The five-candidate smoke used four chat calls plus six embedding calls (ten provider calls total), so the UI/configuration name does not describe the actual provider-call budget.
3. `tools.historical` is disabled in the current safe defaults. Human-confirmed links are evaluation labels only and are not yet used as a runtime score; any future historical feature must exclude the evaluated row to prevent leakage.
4. The synthetic winner received semantic `0.69`, lexical `1.00`, temporal `1.00`, hierarchy `0.90`, and model-consensus `0.90`, producing `86.96%`. This explains the threshold abstention but is not evidence to lower the 90% gate. The real labelled set must determine whether the issue is conservative calibration, embedding quality, or desired abstention.

### Phase 2B — Prompts, models, and configuration

This is the primary delivery for Workstream 2. The evaluator is a supporting acceptance mechanism, not the product deliverable. Preserve the existing model family and safety constraints: `openai/gpt-4o-mini` for time filter, extraction, matching and validation; `openai/gpt-4o` for the conditional judge; `openai/text-embedding-3-large` for semantic ranking; zero temperature; candidate-bound outputs; matcher-and-validator agreement; hard-conflict blocking; 90% confidence; and a 12-point margin.

Implementation order:

1. Replace prompt-embedded JSON examples and legacy `json_object` mode with server-owned strict JSON Schemas (`json_schema`, `strict:true`).
2. Give each role one bounded responsibility, explicit evidence priorities, calibrated decision meanings, anti-invention rules, and Hebrew explanation behavior.
3. Pass the full bounded alert evidence envelope to the roles: title, description, question, answer, hashtags, alert type, canonical date, severity and status.
4. Calibrate every numeric model score explicitly to the engine's 0–100 scale. Keep schemas separate from prompt prose.
5. Record immutable settings version, schema name/version and prompt hash in every configuration snapshot and workflow log.
6. Publish the explicitly approved GPT-4o allocation, 90% automatic threshold, 12-point margin and V2 weights. A future model or policy change requires a frozen labelled comparison and explicit approval.
7. Publish remote configuration only after dry-run review and explicit approval.

Implementation status (2026-08-26): V2.1 `schedule-assignment-openai.v2.1-rc1` is implemented and published to MAIN `agent_settings`. It applies the approved GPT-4o model allocation and 90/12 safety policy, adds five strict server-owned Structured Output contracts, versioned prompts, complete bounded alert evidence, Hebrew reasons, explicit validator score calibration and prompt/schema hashes. Each Chat role now follows the same reviewable structure: Identity, Objective, Instructions, Examples, Output Semantics, Failure Behavior and Context. The runtime rejects missing structured contracts and parses the strict response directly rather than extracting an arbitrary JSON fragment. Negative model reasons are now recorded as contradicting evidence instead of being mislabeled as supporting evidence. Publication replaced a remote `draft-v1` drift state that used unapproved GPT-5-family role models and a 50% automatic threshold.

Verification (2026-08-26): 83 focused Schedule tests and the React production build pass. A one-case synthetic end-to-end smoke using the approved GPT-4o models completed with `system` instructions and strict Structured Outputs, no role or JSON failures, no database persistence and the expected activity ranked first at every candidate stage. The validator calibration defect was reproduced (`1` on an intended 0–100 scale), corrected, and the final score increased from 79.96% to 87.38%. The 90% policy still abstained, so this smoke proves contract compatibility and conservative behavior only; it is not a production-accuracy claim. The Settings UI now exposes active/persisted status, prompt version, publication time, configuration snapshot, instruction role and schema, and its reload path preserves the full prompt text. The publication command saved a pre-change rollback snapshot, changed only `scheduleAssignmentAgent`, reloaded the remote row in a fresh process and matched role/schema/prompt hashes plus snapshot `schedule-assignment-config:9f2fb7c98d4faae092c69927b92b0e1dcbcb4bd318344f08b7b9557d91d7b4d0`.

Live labelled-validation attempt (2026-08-26): dataset preparation was retried against the approved APP DATA Schedule project and failed before producing a dataset with HTTP 522. Independent read-only diagnostics reached the same result through both PostgREST and a direct `select 1` via the Supabase management connection. API logs show 522 responses across unrelated existing tables and RPCs after earlier 200 responses, so this is a project-wide database connectivity outage rather than a missing Schedule table, RLS decision, or evaluator defect. MAIN cannot substitute for accuracy evidence because it contains alerts but no assignment-link history or Gantt rows. After explicit approval, V2 configuration publication proceeded independently; labelled validation remains deferred until Kapaim accepts read-only queries again.

Acceptance: zero false automatic assignments in the labelled high-confidence holdout; ambiguity/no-match remains non-writing and auditable.

## Workstream 3 — Contract-derived notifications and updates

### Decision required

The intended user-facing delivery mechanism is not yet specified. Recommended: Schedule owns the contract-condition lifecycle in `schedule_alerts`, while Daily Alerts RAG reads a server-owned adapter/view. This keeps idempotency, resolution, and due-date semantics with Schedule instead of making Contracts write indexed alert data.

| Option                                | Meaning                                                          | Risk                                                     |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| A — Schedule canonical (recommended) | `schedule_alerts` is canonical; legacy retrieval reads adapter | Must define one read/query integration                   |
| B — Legacy Alerts canonical          | adapter materializes into`alerts_gf`/embeddings                | index lifecycle and stale/deduplicated search state      |
| C — External delivery                | email/WhatsApp/push etc.                                         | recipient consent, sender, retries, rate limiting absent |

### Phase 3A — Additive event contract

Define a server-owned payload with: deterministic `eventKey`; project; Contract decision/revision; condition/occurrence/lifecycle status; Schedule-owned severity and due-date basis; authorized source evidence reference; created/updated/resolved timestamps; and a rendering-safe summary. Browser inputs must not select tables, recipients, sources, or lifecycle states.

### Phase 3B — Adapter and lifecycle verification

1. Implement one Schedule-owned adapter into the selected mechanism. Contracts remains read-only.
2. Cover create, repeat sweep/deduplication, update/reschedule, resolution, and dismissal after supersession.
3. Verify one synthetic Schedule condition through the selected user-facing read path, preserving source lineage and leaving unrelated alerts/query rows untouched.
4. For external delivery, add opt-in/recipient ownership, rate limit, retry/dead-letter handling, and visible delivery status before any send.

Acceptance: exactly one visible lifecycle event per condition revision; no duplicate after repeated sweeps; resolution and supersession reach the selected view.

## Execution and approvals

1. Finish Workstream 1B local implementation and tests, then review its append-only persistence contract.
2. Implement and test the R6 eligibility bridge; run an Indicator dry-run.
3. Request explicit approval for the controlled Indicator commit, then run Schedule resolution.
4. Build Workstream 2A before changing models/prompts/settings.
5. Choose the Workstream 3 delivery option before adapter work.
