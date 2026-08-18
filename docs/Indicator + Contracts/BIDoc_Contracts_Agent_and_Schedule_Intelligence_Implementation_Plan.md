# BIDoc Contracts Agent and Schedule Intelligence Implementation Plan

- Status: Phase 1 accepted; Phase 2 schema, mapping, and remote security gate complete; activation and live-promotion approval pending
- Version: 1.0
- Date: 2026-08-10
- Audience: CTO, product, contract operations, engineering, and security
- Confidentiality: Internal planning document
- Requested decision: Review the completed KAPAIM schema/mapping evidence, then authorize or reject activation and one reviewed end-to-end promotion
- Implementation status: Phase 1 remains accepted. Phase 2 now includes the remote KAPAIM migration history, one approved MAIN-to-KAPAIM mapping, private immutable audit storage, pure planner, atomic RPC, fail-closed backend transport, authenticated review routes, reviewer UI, rollback plan, 50 focused Contracts tests, the passing isolated database suite, and passing Phase 2 remote security checks. The server apply flag, live contract promotion, and deployment remain pending separate approval
- Production status: KAPAIM received three additive Phase 2 migrations and one approved mapping row. No contract fact, Schedule date, alert, application flag, deployment, or notification changed

Related specification: [BIDoc Schedule Intelligence Engine Specification](./BIDoc_Schedule_Intelligence_Engine_Spec.md)

## How to Review This Document

Recommended CTO reading path:

1. CTO-Locked Pre-Implementation Constraints.
2. Executive Summary.
3. Current Repository State.
4. What the Sample Contract Proves.
5. Target Architecture.
6. Decisions Required Before Coding.
7. Phased Delivery Plan.
8. Risk Register.
9. CTO Approval Checklist.

Appendices A-C contain the engineering findings and source map supporting the executive plan.

## 0. CTO-Locked Pre-Implementation Constraints — updated 2026-08-10

These constraints record the CTO's review feedback and override any conflicting wording elsewhere in this plan or the related Schedule Intelligence specification.

### 0.1 Reuse and extend the existing Schedule Engine

The existing Schedule Engine calculation core is an important, already implemented working baseline and remains the canonical owner of schedule arithmetic. The CTO clarified on 2026-08-10 that this does not make its files immutable: Contracts and Indicator integration may modify or extend the Engine when the integration genuinely requires it. This clarification supersedes earlier blanket wording that every Engine edit required a separate exception.

The governing rule is reuse rather than avoidance. New work must call, extend, or feed the existing basis priority, calendar arithmetic, extension handling, lateness/remaining-time calculations, statuses, confidence, severity, snapshots, and alert behavior. It must not recreate those calculations in a Contracts service, Indicator service, UI consumer, prompt, or parallel "new engine."

Protected baseline:

- [src/scheduleEngine.js](../../src/scheduleEngine.js)
- [src/scheduleCalendar.js](../../src/scheduleCalendar.js)
- Existing basis priority and approved-extension behavior.
- Existing daysLate, daysRemaining, variance, status, confidence, severity, lookup, and sweep behavior.
- Existing Schedule API and UI behavior unless a separately reviewed integration change is required.

Default allowed work:

- New Contracts Agent extraction code.
- New deterministic contract validation and review code.
- Additive adapters that translate reviewed contract facts into the existing Schedule table contracts.
- Tests, fixtures, evaluation artifacts, documentation, and read-only diagnostics.

Conditional work:

- Changes at ingestion, orchestration, API, resolver, or UI boundaries are allowed only when necessary for the approved Contracts integration, with focused regression evidence showing that existing Schedule calculations and behavior did not change.
- Changes to `src/scheduleEngine.js`, `src/scheduleCalendar.js`, or adjacent Schedule services are permitted when needed for the approved integration slice. Every such change must identify the existing logic being reused, add focused regression coverage, preserve unchanged-input behavior unless an intentional product change is documented, and explain why an additive extension is preferable to duplicate computation.
- Opportunistic rewrites, parallel formula implementations, and unrelated refactors remain out of scope.
- Opportunistic Schedule refactoring, cleanup, renaming, or redesign is out of scope.

Required regression gate:

1. Capture the current Schedule test and representative-output baseline before Contracts implementation.
2. Run npm.cmd run test:schedule before and after every integration slice.
3. Add contract-input tests without weakening or rewriting existing Schedule assertions.
4. Compare representative indicator outputs for unchanged Schedule inputs.
5. Stop the phase on any unexplained Schedule result change.

### 0.2 Reuse the CTO-created Schedule tables

The CTO confirmed on 2026-08-08 that the related Schedule tables already exist and must be used. They are the canonical persistence baseline for this work:

| Existing table | Current/planned responsibility |
|---|---|
| schedule_calendars | Existing project working-calendar input |
| schedule_contract_milestones | Existing fixed/approved contractual milestone input |
| schedule_contract_extensions | Existing extension event input |
| schedule_contract_conditions | Existing unresolved relative-condition pool and resolver input |
| schedule_indicator_snapshots | Existing Schedule indicator snapshot persistence |
| schedule_alerts | Existing isolated Schedule alert lifecycle |
| schedule_activity_map | Existing table reserved for durable activity aliases/mappings |
| schedule_observed_events | Existing table reserved for reviewed project-event evidence |

The current contractor-schedule source remains the existing Gantt path. This Contracts work does not replace, recreate, truncate, reset, or mutate the source Gantt tables.

Table-use rules:

1. Audit the live table definitions and current callers read-only before coding.
2. Reuse existing typed columns and constraints first.
3. Do not create parallel or duplicate contract/schedule tables by default.
4. Do not execute CREATE, ALTER, DROP, TRUNCATE, backfill, permission, RLS, grant, or data-migration operations as part of Contracts implementation without separate CTO approval.
5. Do not hide critical contractual semantics only in metadata when a typed field is required for deterministic behavior.
6. If a required fact cannot be represented safely, record the exact compatibility gap and propose the smallest backward-compatible additive change to the existing table. Stop for approval before implementing it.
7. Preserve every existing row, constraint, index, permission, caller, and table name unless a separately approved migration explicitly states otherwise.
8. A repository migration may document or reproduce the existing deployed schema only after schema reconciliation; it must not recreate an existing live table blindly.

### 0.3 Mandatory pre-work evidence

Before the first implementation phase, produce:

- A read-only live schema inventory for all eight Schedule tables.
- A caller map showing which current modules read or write each table.
- A field compatibility matrix mapping each Contracts Agent output to an existing column.
- A gap register separating: fits as-is, fits through an existing safe metadata field, requires application validation only, or requires a separately approved additive schema change.
- A baseline Schedule regression report and representative unchanged-output fixtures.
- A written integration note identifying whether the slice reuses the Engine unchanged or requires a bounded, regression-tested Engine extension; no duplicate calculation path is permitted.

If a required behavior cannot be expressed by reusing or safely extending the existing Engine, implementation pauses and returns to the CTO with the concrete gap and alternatives.

## 1. Executive Summary

BIDoc will convert contractual obligations, contractor schedules, and project evidence into explainable schedule indicators and early delay warnings. AI will extract and classify candidate facts; one deterministic Schedule Intelligence service will perform every date, variance, lateness, forecast, and severity calculation.

The sequencing is:

1. Establish a reviewed Contracts Agent output contract.
2. Promote only approved schedule-driving facts into the contract axis.
3. Integrate through the existing Schedule Engine's table, service, and calculation contracts; extend them only where required and keep the Engine as the single calculation authority.
4. Add reviewed contract-to-activity mapping and observed project evidence.
5. Operate alerts in shadow mode before enabling broader delivery.

The deterministic Schedule Engine calculation core is already implemented and is the regression baseline. Adjacent three-axis inputs and consumer integrations are not all complete or end-to-end verified. Required integration changes may build on the core, but must not duplicate its working calculation logic. The missing critical capability is a trustworthy bridge from contracts to structured, versioned, reviewed facts in the existing Schedule tables and Engine inputs.

The sample contract proves that this bridge cannot be implemented as simple date extraction. It includes a blank commencement date, visibly blank signature fields with unverified execution authority, absent BOQ/plans/specifications referenced by Appendix A, no Appendix C in the supplied packet, conflicting daily delay-charge figures, recurring obligations, event-relative deadlines, channel-dependent notice rules, and a project-address mismatch. The safe output is therefore a partially computable contract record with explicit conflicts and missing anchors—not a completed project timeline.

### Recommendation

Approve a short Phase 0 decision-and-design checkpoint before production code. Phase 0 will lock:

- Contract document authority and versioning.
- Explicit project binding.
- Schedule-driving versus contract-compliance classification.
- Stable obligation and activity identities.
- Calendar and temporal-rule semantics.
- Human-review and conflict policy.
- Existing-table ownership, compatibility, and caller contracts; schema changes only through a separately approved exception.
- Snapshot revision semantics.
- Alert ownership and rollout channel.

### CTO decision requested now

Approve the architecture direction and Phase 0 deliverables. Phase 0 does not authorize changes to Schedule Engine arithmetic, output contracts, existing APIs, existing Schedule UI behavior, CTO-created tables, or database DDL. Do not yet approve production extraction, automatic contract writes, automatic alerts, or deployment.

## 2. Business Outcome

### 2.1 Problem

Today, project schedule risk is distributed across three different sources:

- The contractual commitments and amendments.
- The contractor's submitted schedule.
- The project evidence showing what actually happened.

Looking at only one source creates incomplete or misleading conclusions. A contractor schedule may show a planned completion date that differs from the contract. A contract may define a completion duration but omit the commencement date. Project correspondence may prove a triggering event, delay, approval, or handover that neither structured source contains.

### 2.2 Product outcome

BIDoc should be able to answer:

- What is the applicable contractual or planned date?
- What source and clause support that date?
- What remains unresolved and why?
- Is the activity late, at risk, on track, completed late, or blocked by missing data?
- Has the contractor's latest schedule moved relative to the prior version?
- What project evidence supports or contradicts the schedule?
- Which issues require human review before an alert can be trusted?
- Which schedule risks became new or materially worse?

### 2.3 Success measures

The feature is successful when:

- Every schedule conclusion has a replayable evidence trail.
- Contract conflicts and missing anchors never become silent assumptions.
- Only approved extensions move contractual dates.
- Contract links survive new contractor schedule uploads.
- Chat, Insights, Health, UI, and alerts use the same Schedule Intelligence result.
- Historical backlog does not create alert floods.
- Low-confidence or unmapped facts cannot trigger automatic portfolio alerts.
- A user can understand why an indicator exists without reading engine code.

## 3. Scope and Boundaries

### 3.1 In scope

- Contract document identity, authority, version, and supersession tracking.
- Page-aware and clause-aware contract extraction.
- Fixed dates, relative deadlines, recurrence, extensions, consequences, and notice rules.
- Exact evidence excerpts and extraction provenance.
- Candidate validation, conflicts, missing fields, and human review.
- Projection of approved schedule-driving facts through additive writers/adapters into the existing CTO-created Schedule tables.
- Stable contract-to-Gantt activity mapping using the existing schedule_activity_map table first.
- Regression certification that the existing Schedule Engine produces unchanged results for unchanged inputs.
- Read-only schema/caller audit and a logical-to-physical table reuse matrix.
- Shadow-mode alerts and back-office review.
- Chat, Insights, Health, and Schedule UI integration through the Schedule service; Timeline is an optional later consumer under separate scope approval.
- Permission-aware evidence display and audit history.

### 3.2 Explicit non-goals

- No legal opinion or determination of contractual entitlement.
- No automatic decision that a delay claim is justified.
- No automatic approval of an extension or amendment.
- No modification of contractor MPP, Primavera, XML, or Gantt source data.
- No AI-based schedule arithmetic.
- No independent delay calculation in Chat, Data Query, n8n, UI, or Insights.
- No automatic fuzzy project binding.
- No automatic low-confidence activity mapping.
- No critical-path or dependency claim until predecessor and slack data are persisted.
- No production notification based on one sample contract.
- No mutation of application-owned source tables.
- No migration, deployment, or production activation without a separate approval gate.
- No rewrite, replacement, refactor, formula change, or opportunistic cleanup of the existing Schedule Engine.
- No duplicate or parallel contract/schedule table when an existing CTO-created table serves that responsibility.
- No unapproved CREATE, ALTER, DROP, TRUNCATE, index, trigger, function, RLS, grant, policy, permission, or backfill operation.
- No alternative schedule calculator, snapshot system, severity engine, or alert table.

## 4. Current Repository State

### 4.1 Implemented, verified, and missing

Database terminology used in this document:

- MAIN App DB: the configured MAIN project currently holding the active test Gantt source.
- KAPAIM Content DB: the database reached through the current APP DATA/contentSource connection for engine-owned schedule tables.

The CTO confirmed the existing Schedule-table baseline on 2026-08-08. The dated 2026-08-05 caller inventory also records all eight tables through the Data API. A fresh read-only audit is still required immediately before implementation to detect drift; it is verification, not permission to redesign the schema.

| Area | Current state | Verification boundary |
|---|---|---|
| Deterministic Schedule Engine | Implemented working calculation core and protected behavioral baseline for basis priority, extensions, lateness, remaining time, status, confidence, severity, lookup, and sweep | 47 focused Schedule tests passed; later integration changes are allowed only when required, reuse existing logic, and include focused regression evidence |
| Calendar arithmetic | Implemented for calendar days, weeks, months, integral-day hours, and working days | Unit-tested |
| Schedule ingestion | Implemented, but Gantt input is forced to MAIN App DB test tables while engine data uses KAPAIM Content DB | Source inspection; not live-verified in this review |
| Schedule APIs | Indicator, sweep, health, recalculate, versions, alerts, conditions, and resolver routes exist | Source and unit/mocked tests |
| Schedule UI | Three-axis Schedule view, alerts, health, and pending-condition actions exist | Source inspection; no browser verification in this review |
| Contract milestones/extensions | Existing tables and readers are implemented. The additive Contracts writer must provide reviewed authority, explicit status, confidence, and evidence so unsafe defaults are never reached | Prefer containment in the writer/adapter; extend the existing Engine only if the approved integration genuinely requires it and regressions prove unchanged-input compatibility |
| Relative condition resolver | Can search for trigger evidence and promote a pre-extracted condition at the current confidence gate | Unit-tested; writes are not transactional and the UI can commit without a separate contract-review object |
| Contracts Agent | Phase 1 dry-run PDF extractor, typed candidate contract, authenticated API, diagnostics, evaluators, and tests are implemented; review queue, writer, persistence, and upload/review UI remain deferred | Phase 1 accepted: final live gold evaluation, deterministic verification, and protected regressions are green |
| Activity mapping | schedule_activity_map already exists; current engine pipeline does not yet consume it | Existing table confirmed in the dated inventory; caller integration missing |
| Observed events | schedule_observed_events already exists; current engine pipeline does not yet consume it | Existing table confirmed in the dated inventory; caller integration missing |
| Dependencies and critical path | Not implemented; the specification/source-artifact review reports useful XML fields that the active backend input does not persist | Specification and repository audit; parser not present here |
| Chat routing | Missing: a quantitative schedule question can be classified as supported Data Query with no target table and bypass Schedule Intelligence | Source audit and classifier probe |
| Insights/Health integration | Missing: older independent overdue-commitment calculations remain | Source audit |
| Proactive scheduling | Alert scan is manual; no recurring execution owner exists | Source audit |
| Existing Schedule schema ownership | CTO-created tables already exist; exact live schema/caller compatibility and repository reproducibility records have not yet been reconciled | Read-only audit required; no table creation or DDL authorized |
| Schedule settings | Read paths expect Schedule settings, but the current settings writer does not preserve that section | Source audit; profiles and thresholds can silently revert |

### 4.2 Recent implementation baseline

The plan was prepared against the local repository state:

- b9c7397, 2026-08-05: Schedule engine, ingestion, alerts, and specification.
- af14cb4, 2026-08-05: three-axis Schedule UI.
- 82ff6a5, 2026-08-06: Schedule source, connection, and local-review fixes.
- The locally recorded origin/main is one commit ahead at 7ff6cc7, which adds readiness diagnostics. The remote was not freshly fetched during this planning pass.
- The documentation reorganization and this planning file are currently in a dirty/untracked worktree state. CTO circulation should use a committed revision or a dated exported copy so the reviewed artifact has a stable identity.

### 4.3 Verification completed for this planning pass

- npm.cmd run test:schedule: 47 of 47 passed.
- The complete 2,200-line Schedule Intelligence specification was reviewed.
- Current Schedule, condition-resolver, ingestion, API, UI, Chat, Insights, and Health code paths were inspected.
- All 18 pages of the supplied sample contract were text-extracted and visually inspected.

### 4.4 Not verified

- Current live database contents or permissions.
- End-to-end API authentication.
- Browser rendering and interaction.
- PDF extraction through a runtime Contracts Agent.
- Transactional contract promotion.
- Automatic alert scheduling.
- Production configuration or deployment.

## 5. What the Sample Contract Proves

### 5.1 Artifact identity

Sample filename:

הסכם קבלן-סמל אולם תצוגה הרצליה גרסה לחתימה 1.11.pdf

SHA-256:

0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA

Observed artifact state:

- Header date: 19 November 2024.
- Visible signature fields are blank.
- Appendix B's commencement date is blank.
- Appendix A refers to BOQ, plans, and specifications that are not present.
- Several appendix fields remain placeholders.
- The visible signature fields are blank. The file should be classified as execution status unknown until a human confirms whether an authoritative executed counterpart exists.

This is a data-model and engineering assessment, not legal advice.

### 5.2 Project-binding warning

The contract identifies the project site as 5 HaHoshlim Street, Herzliya. The existing Schedule specification refers to the sample project as 15 HaHoshlim Street, Herzliya.

Required behavior:

- The user must explicitly select the BIDoc project.
- Extracted party names, company IDs, and addresses act as validation evidence only.
- A material mismatch blocks automatic binding.
- The Contracts Agent must never select a project through fuzzy similarity alone.

### 5.3 Schedule-relevant clause map

| Contract fact | Safe system interpretation |
|---|---|
| Completion within 100 working days from commencement | Relative project-completion obligation; unresolved until a reviewed commencement event and authoritative calendar exist |
| Safety-manager appointment is a condition to starting work | Commencement prerequisite; not itself proof that work started |
| Exceptional-event notice immediately and no later than eight hours | Sub-day contract-compliance obligation |
| Waste removal at least weekly | Recurring compliance obligation |
| Monthly account submission on days 1-5 | Monthly-window obligation |
| Manager review within ten days after receipt | Event-relative rule |
| An approved interim amount is payable within 25 days after the end of the submission month, with a Shabbat/holiday rollover | Chained rule with an approval guard, month-end anchor, and next-weekday roll convention |
| A schedule delay pursuant to Semel's request, not arising from contractor acts or omissions, permits a corresponding postponement | Narrow extension candidate rule; do not generalize it automatically to every client-caused event or change order |
| Performance bond within 14 days of signing | Relative compliance obligation; unresolved while execution/signing is unverified |
| Completion inspection and corrections process | Multi-event acceptance graph; inspection must finish within 14 days after it begins, but the deadline to begin inspection after completion notice is missing |
| Notice deemed received differently by delivery channel | Channel-dependent trigger rule |

### 5.4 Material conflict

The document contains two daily contractual delay-charge figures. The source label must be retained without the system making a legal characterization:

- Section 6.7: NIS 2,000 per day.
- Appendix B: NIS 3,250 per day.

Required behavior:

- Preserve both source facts.
- Assign them to one conflict group.
- Do not infer a winner.
- Do not use either value operationally until reviewed.
- Retain the final reviewer, decision, reason, and superseded candidates.

### 5.5 Additional review candidates

The Contracts Agent should also preserve, without resolving:

- The potential overlap between Section 6.5's 30-day termination notice and Section 15.2's broad right to stop or reduce work at any time.
- The visibly malformed section-number list in Section 19.10.
- inspection_start_due = missing, because the contract states a period after inspection begins but no deadline for beginning inspection after completion notice.

### 5.6 Safe extraction outcome

For this sample, the Contracts Agent must produce:

- execution_status = unverified
- project_binding_status = needs_review
- completion_rule = commencement plus 100 working days
- computed_completion_date = null
- calendar_status = missing
- delay_charge_conflict_status = unresolved
- attachments_status = incomplete
- approved_schedule_projection_count = 0 until review

The correct result is a partially computable contract with explicit gaps—not an authoritative timeline.

## 6. Target Architecture

~~~mermaid
flowchart LR
    A["Contract, appendices and amendments"] --> B["Contracts Agent: candidate extraction"]
    B --> C["Deterministic validation"]
    C --> D["Human review and conflict resolution"]

    D --> E["Approved schedule-driving obligations"]
    D --> F["Contract-compliance obligations"]

    G["Contractor Gantt versions"] --> H["Stable activity mapping"]
    I["Project documents and messages"] --> J["Observed project events"]

    E --> P["Existing CTO-created schedule_* tables — reuse, no duplicates"]
    H --> P
    J --> P
    P --> K["Existing Schedule Intelligence service — protected calculation core"]

    K --> L["Existing schedule_indicator_snapshots"]
    L --> M["Schedule UI, Chat, Insights and Health"]
    L --> N["Existing schedule_alerts: shadow alerts and later approved delivery"]

    F --> O["Future contract-compliance workstream"]
~~~

### 6.1 Core architectural rules

1. AI extracts candidate facts and uncertainty; it does not calculate dates or delay.
2. Deterministic validators block malformed, incomplete, contradictory, or unreviewed candidates from promotion while retaining all conflict candidates for review.
3. Proposed MVP safety policy: every fact capable of moving a schedule basis or creating a delay alert requires explicit approval. This intentionally supersedes the current specification/runtime behavior that can promote a condition at confidence 0.80 or higher; D-08 must approve the change.
4. The existing Schedule Intelligence service remains the unchanged sole authority for schedule arithmetic; new Contracts code must conform to its current input/output contract.
5. Source Gantt data and source documents remain read-only.
6. Every indicator is linked to a specific input revision and exact evidence.
7. Missing capability is represented explicitly as null plus a gate, never as zero or false success.
8. Conflicts retain every source and every review decision.
9. Schedule Intelligence calculates indicator status and alert severity; the Alert workflow owns alert persistence, deduplication, lifecycle, scheduling, and delivery, subject to D-11.
10. The Schedule MVP retains non-schedule obligations and their evidence, but a compliance engine, API, UI, and alert policy are a separately approved future workstream.
11. Existing CTO-created Schedule tables are reused. Duplicate tables and unapproved DDL are prohibited.
12. Compatibility is solved first in the additive Contracts writer/adapter. A core-engine or schema change is an exception, not a default task.

### 6.2 Component ownership

| Component | Responsibility | Must not do |
|---|---|---|
| Contracts Agent | Segment clauses; extract typed candidates; identify uncertainty, missing fields, and conflicts | Calculate effective dates, lateness, entitlement, or final precedence |
| Contract validator | Enforce schema, stable keys, source evidence, version rules, and project-binding policy | Invent missing facts |
| Human review workflow | Approve, reject, correct, merge, or preserve conflicts with an audit trail | Hide rejected history |
| Existing-table adapter/writer | Map approved facts to existing typed columns, provide explicit status/confidence/evidence, and fail closed before invoking current storage contracts | Create duplicate tables, depend on unsafe defaults, or change Schedule calculations |
| Condition resolver | Find reviewed trigger evidence and submit it for deterministic date resolution | Treat retrieval confidence alone as legal approval |
| Activity mapper | Propose and review obligation-to-activity links using schedule_activity_map first | Bind low-confidence mappings automatically or introduce a replacement mapping table |
| Existing Schedule Intelligence service | Preserve current date arithmetic, basis selection, variance, status, confidence, and alert-severity behavior | Absorb Contracts extraction logic or change behavior without separate CTO approval |
| Consumer integrations | Display and explain stored indicators | Recalculate schedule values |
| Alert workflow | Compare snapshots, control noise, and manage lifecycle | Create an alert without a stored snapshot |

## 7. Contract-Domain Model

The following is an extraction and review ontology, not a proposal for a new physical schema. Phase 0 must map each persisted responsibility to an existing CTO-created table and column. If an entity cannot be represented safely, it stays dry-run-only until a specific additive storage-gap proposal is separately approved. No table name below authorizes table creation.

### 7.1 Document layer

ContractDocument:

- Project selected by the user.
- Document family and stable document identity.
- Parties and project-site claims.
- Current authority status.
- Access-control and tenant context.

ContractDocumentVersion:

- Cryptographic hash.
- File name and source ID.
- Document type: draft, signing version, signed contract, appendix, amendment, change order, instruction, or unknown.
- Execution status and execution date when verified.
- Effective period.
- Supersedes and superseded-by links.
- Parser, OCR, extractor, and schema versions.

### 7.2 Candidate obligation layer

TemporalObligationCandidate:

- Stable candidate key.
- Responsible party, beneficiary, action, and subject.
- Obligation type.
- Trigger event or fixed anchor.
- Deadline expression.
- Value, unit, calendar type, inclusivity, and roll convention.
- Recurrence or occurrence policy.
- Relief, consequence, or extension relationship.
- Schedule projection classification.
- Clause, page, exact excerpt, and optional bounding box.
- Explicit, inferred, missing, or conflicting fact status.
- Confidence and warnings.
- Conflict group.
- Review status.

### 7.3 Review and conflict layer

ContractReviewDecision:

- Candidate or conflict group.
- Decision: approved, rejected, corrected, merged, superseded, or unresolved.
- Reviewer identity and role.
- Timestamp and reason.
- Corrected structured value without deleting the extracted source value.

ContractConflict:

- All competing candidates.
- Conflict type and materiality.
- Current resolution state.
- Selected result, if reviewed.
- Complete decision history.

### 7.4 Rule and occurrence layer

TemporalRule:

- Trigger definition.
- Offset or time window.
- Calendar and roll behavior.
- Recurrence definition.
- Next rule in a compound chain.
- Stop/supersession conditions.

ObligationOccurrence:

- Rule and occurrence identity.
- Trigger evidence.
- Due date or due timestamp.
- Resolution state.
- Review status.
- Source and computation revision.

This layer is required for:

- Eight-hour deadlines.
- Weekly recurrence.
- Monthly windows.
- Month-end rules.
- Channel-dependent deemed receipt.
- Manager-set future deadlines.

### 7.5 Projection layer

Each approved obligation receives one projection:

- project_schedule: affects contractual or planned project milestones.
- contract_compliance: retains a future compliance projection but does not affect construction-delay status.
- both: identifies a future linked schedule/compliance representation.
- none: retained for evidence but not operationalized.

Only approved project_schedule or both projections may enter the Schedule Intelligence contract axis.

For the Schedule MVP, contract_compliance candidates are stored and reviewable but are not given an operational compliance engine, API, UI, or alert lifecycle. That work requires a separate product and architecture approval.

### 7.6 Stable-key policy

Stable keys must be derived from durable source identity, not model wording.

Recommended inputs:

- Explicit project ID.
- Authoritative document-version ID.
- Normalized clause locator.
- Obligation role.
- Trigger role.
- Occurrence identity when recurring.

Reprocessing the same version must create no duplicates. A new authoritative document version creates a new versioned fact connected through supersession, rather than silently overwriting history.

### 7.7 Existing-table reuse map

| Logical responsibility | Existing canonical table | Writer boundary |
|---|---|---|
| Reviewed fixed contractual milestone | schedule_contract_milestones | Contracts writer after review |
| Reviewed extension event | schedule_contract_extensions | Contracts writer after review |
| Unresolved relative condition | schedule_contract_conditions | Contracts writer after review; existing resolver handles trigger resolution |
| Contract/activity alias or confirmed mapping | schedule_activity_map | Mapping workflow after review |
| Reviewed observed project event | schedule_observed_events | Later observed-evidence workflow |
| Project working calendar | schedule_calendars | Existing calendar administration; Contracts Agent reads/references, not silently overwrites |
| Derived indicator history | schedule_indicator_snapshots | Existing Schedule orchestrator only |
| Alert lifecycle | schedule_alerts | Existing Schedule alert workflow only |

Candidate extraction, document authority, conflict review, and reviewer-decision persistence must first be mapped to compatible existing application/Schedule storage. No physical storage is assumed by this ontology. If the audit finds no safe target, those records remain dry-run output and Phase 2 pauses for a specific storage-gap decision.

## 8. Contracts Agent Output Contract

### 8.1 Required output classes

- Fixed contractual milestone candidate.
- Unresolved relative condition.
- Recurring obligation rule.
- Extension, amendment, claim, approval, or rejection event.
- Consequence or contractual charge term, preserving the source's original label.
- Notice/service rule.
- Missing-information record.
- Conflict group.

### 8.2 Example output for the sample contract

This is an abbreviated, non-normative example. Bracketed source text represents the verbatim Hebrew excerpt that the runtime must preserve; null confidence indicates that this planning example was not produced by a calibrated extraction evaluator.

~~~json
{
  "schemaVersion": "contract-extraction.v1",
  "extractionVersion": "contracts-agent.prompt.v1",
  "document": {
    "documentVersionId": "sha256:0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA",
    "executionStatus": "unverified",
    "authorityStatus": "needs_review",
    "sha256": "0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA"
  },
  "projectBinding": {
    "projectId": null,
    "status": "needs_review",
    "contractSiteRaw": "leased ground-floor area at 5 HaHoshlim Street, Herzliya",
    "contractSiteNormalized": "5 HaHoshlim Street, Herzliya",
    "candidateProjectSiteFromSpecification": "15 HaHoshlim Street, Herzliya",
    "automaticBindingAllowed": false
  },
  "candidates": [
    {
      "candidateKey": "contract-version:appendix-b:item-2:contractual-completion",
      "documentVersionId": "sha256:0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA",
      "type": "relative_deadline",
      "role": "contractual_completion",
      "trigger": "reviewed_contractual_commencement_event",
      "offset": {
        "value": 100,
        "unit": "working_day",
        "calendarId": null
      },
      "projection": "project_schedule",
      "computedDate": null,
      "factStatus": "explicit",
      "reviewStatus": "pending",
      "confidence": null,
      "gates": [
        "authority_unverified",
        "project_binding_unreviewed",
        "missing_contractual_commencement_event",
        "missing_calendar"
      ],
      "sourceEvidence": [
        {
          "pdfPage": 14,
          "clause": "Appendix B, item 2",
          "sourceText": "[verbatim Hebrew 100-workday completion excerpt]"
        },
        {
          "pdfPage": 4,
          "clause": "6.1",
          "sourceText": "[verbatim Hebrew start/completion linkage excerpt]"
        }
      ]
    },
    {
      "candidateKey": "contract-version:clause-6.7:daily-delay-charge",
      "documentVersionId": "sha256:0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA",
      "type": "contractual_delay_charge",
      "originalSourceLabel": "קנס",
      "value": 2000,
      "currency": "ILS",
      "dayType": "unresolved",
      "factStatus": "conflicting",
      "reviewStatus": "pending",
      "confidence": null,
      "conflictGroupId": "daily-delay-charge",
      "sourceEvidence": [{
        "pdfPage": 5,
        "clause": "6.7",
        "sourceText": "[verbatim Hebrew NIS 2,000 daily-charge excerpt]"
      }]
    },
    {
      "candidateKey": "contract-version:appendix-b:item-3:daily-delay-charge",
      "documentVersionId": "sha256:0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA",
      "type": "contractual_delay_charge",
      "originalSourceLabel": "קנס",
      "value": 3250,
      "currency": "ILS",
      "dayType": "unresolved",
      "factStatus": "conflicting",
      "reviewStatus": "pending",
      "confidence": null,
      "conflictGroupId": "daily-delay-charge",
      "sourceEvidence": [{
        "pdfPage": 14,
        "clause": "Appendix B, item 3",
        "sourceText": "[verbatim Hebrew NIS 3,250 daily-charge excerpt]"
      }]
    }
  ]
}
~~~

### 8.3 Contracts Agent invariants

- It never computes days late, effective completion, variance, forecast, or severity.
- It never chooses a conflicting value without an approved policy or human decision.
- It never invents a commencement date, calendar, signature, attachment, or activity mapping.
- Every critical number and date has page-level evidence.
- Empty fields remain explicit missing values.
- Inference is clearly separated from explicit contract text.
- Promotion is atomic per reviewed decision set: no operational fact can commit without its corresponding review, evidence, source version, and audit state. Unrelated valid candidates need not be rolled back together.
- Original source facts remain immutable after review corrections.

## 9. Existing Schedule Intelligence Compatibility Contract

This section records the existing Schedule input/output expectations that the Contracts Agent must satisfy. It is a regression contract, not authorization to redefine Engine behavior. If current code, tests, and the older specification disagree, Phase 0 records the discrepancy and requests a separate decision rather than changing the Engine through the Contracts scope.

### 9.1 Three input axes

Contract axis:

- Approved fixed contractual milestones.
- Approved resolved relative conditions.
- Approved extensions and amendments.
- Contract version and source evidence.

Contractor schedule axis:

- Current contractor schedule version.
- Prior comparable version.
- Stable activities across versions.
- Planned, actual, dependency, and progress fields when available.

Observed evidence axis:

- Dated project events.
- Source excerpt and access permissions.
- Activity mapping and mapping confidence.
- Review state.

### 9.2 Basis priority

The protected basis priority is:

1. Approved contractual finish.
2. Current contractor planned finish.
3. Supported forecast finish.

If no valid basis exists, status is insufficient_data. The system must never infer on_track from missing information.

### 9.3 Required semantics

- asOf is explicit and replayable.
- Completed work uses completion variance.
- Active work has either positive daysLate or nonnegative daysRemaining, never both.
- daysLate = 0 is not emitted.
- Existing calendar arithmetic and null behavior remain unchanged. The Contracts writer must provide only reviewed calendar-dependent facts; any calendar-policy change requires a separate Engine exception.
- Claimed or rejected extensions do not move the contractual basis.
- Existing snapshot/recalculation behavior remains the baseline; any demonstrated inability to represent Contracts input becomes a separate compatibility proposal.
- Low-confidence mappings do not trigger automatic alerts.
- Unsupported dependency or critical-path impact is null with an explicit gate.

## 10. Decisions Required Before Coding

### 10.1 Executive approval bundles

| Bundle | Decisions | Executive question |
|---|---|---|
| Protected baseline, table reuse, and identity compatibility | D-00 to D-03 | Which existing behaviors must remain compatible, which tables/callers/identities are reused, and where may Contracts integration extend the existing Engine? |
| Contract authority, semantics, and review | D-04 to D-08 | Which document facts may become operational, under which calendar and human approval policy? |
| Deterministic indicator and evidence security | D-09, D-10, D-12 | How is every result replayed, classified, and permissioned? |
| Alert ownership and rollout | D-11 | Who owns severity consumption, lifecycle, scheduling, and delivery, and when can users be notified? |

### 10.2 Detailed decision register

| ID | Decision | Recommended direction | Required approver | Blocks |
|---|---|---|---|---|
| D-00 | Canonical Schedule baseline | Reuse the existing Engine as the single owner of formulas and status behavior. Necessary integration extensions are allowed with focused tests and an explained behavioral diff; duplicate calculation paths are prohibited | CTO and Schedule owner | All implementation |
| D-01 | Existing schema ownership and reuse | Read-only audit the actual databases and eight CTO-created tables; produce a field-level reuse matrix; no migration or DDL is authorized by Phase 0 | CTO, backend owner, security | All persistence |
| D-02 | Gantt parser ownership | Assign the repository/component and owner responsible for reliable Gantt persistence, including predecessors, slack, actual dates, and calendars | CTO and frontend/backend owners | Basic production indicators, dependencies, and critical path |
| D-03 | Existing identity compatibility | Audit current task_uid, stableKey, activity_key, schedule_activity_map, and constraints; prefer an additive crosswalk in existing structures; any core identity change requires separate approval | CTO and backend owner | Mapping, slippage, alert continuity |
| D-04 | Document authority | Require reviewed authority status for drafts, signed versions, appendices, amendments, and instructions | Product, contract owner, CTO | Contract projection |
| D-05 | Project binding | Require explicit project selection; use extracted identity only for validation and mismatch warnings | Product and CTO | Contract ingestion |
| D-06 | Temporal semantics | Approve calendar types, counting rules, time zones, inclusivity, roll conventions, recurrence, and compound rules | Product, contract owner, backend owner | Date resolution |
| D-07 | Schedule versus compliance | Approve which obligation classes affect project-delay indicators | Product, contract owner, CTO | Alert correctness |
| D-08 | Human-review policy | Supersede current confidence-only auto-promotion for the MVP; require approval for every fact that can change a basis or create an alert | Product, contract owner, CTO | Safe automation |
| D-09 | Existing snapshot compatibility | Freeze current snapshot behavior as the regression baseline; map Contracts inputs through an additive writer/adapter first; any index or snapshot-identity change requires a separate exception | Backend owner and CTO | Audit and alert linkage |
| D-10 | Existing status/confidence/clock contract | Record current tested formulas, precedence, asOf, and calculatedAt behavior as authoritative regression expectations. Contracts and Indicators must reuse them; a necessary change belongs in the Engine with focused regression coverage, not in a parallel consumer calculation | Product, data/AI owner, CTO | Consistent indicators |
| D-11 | Alert ownership and channel | Run back-office shadow alerts first; approve main-alert or external delivery separately | Product and CTO | Proactive rollout |
| D-12 | Evidence access | Preserve source permissions through every snapshot, API, and UI | Security, backend owner, CTO | Tenant-safe launch |

## 11. Phased Delivery Plan

No calendar estimate is committed here. Team sizing and delivery estimates should be produced after Phase 0 resolves D-01 through D-12.

### 11.1 Executive phase summary

| Step | Outcome | Approval evidence |
|---|---|---|
| Phase 0 | Decisions and contracts locked; no runtime change | Approved architecture decision record |
| Schema Reuse and Regression Gate | Existing Engine logic reused and baseline behavior protected; integration seam proven with zero DDL by default | Schema/caller audit, reuse matrix, golden outputs, focused Engine regressions when touched, and no-schema-diff proof |
| Phase 1 | Dry-run Contracts Agent with no operational writes | Representative gold-set evaluation |
| Phase 2 | Reviewed staging and atomic promotion | Review/audit/transaction report |
| Phase 3 | Contract-to-schedule mapping through schedule_activity_map | Mapping reuse and conflict-review report |
| Phase 4 | Additive Rule 001 consumer integration | Baseline-preservation, routing, and consumer-consistency report |
| Phase 5 | Separately approved observed evidence/dependency enrichment | Existing-table reuse plus separate parser/DDL/Engine approvals where required |
| Phase 6 | Shadow alerts and staged operations | Noise, lifecycle, permissions, monitoring, and rollback report |

### 11.2 Detailed phases

### Phase 0 — Decision Lock

Goal:

Make the architecture implementation-safe before building the Contracts Agent. This phase is design and approval only.

Checkpoint status — 2026-08-08:

- The Phase 0 evidence package is complete and recorded in the [Phase 0 Decision Lock and Baseline](./BIDoc_Phase_0_Decision_Lock_and_Baseline.md).
- Live verification confirmed all eight existing Schedule tables through read-only OpenAPI and `HEAD` requests; no DDL or data write occurred.
- The protected Schedule suite passes 47/47 on the local baseline.
- The Contracts output schema, sample-contract gold annotation draft, and representative synthetic variants are ready for review.
- Phase 1 was authorized on 2026-08-08 and is accepted after its final real-contract evaluation passed every unchanged hard gate and quality threshold. Phase 2 entry work is recorded in [BIDoc Phase 2 Entry and Schema-Reuse Gate](./BIDoc_Phase_2_Entry_Schema_Reuse_and_Promotion_Gate.md). D2-01 through D2-04 were approved on 2026-08-10; operational persistence remains paused until the exact migration/apply checkpoint is approved.
- The local-only schema/RPC/transport package and its remaining database verification gate are recorded in [BIDoc Phase 2 Migration and Apply Checkpoint](./BIDoc_Phase_2_Migration_Apply_Checkpoint.md).

Deliverables:

- One approved architecture decision record.
- Read-only database/source profile, table schema, caller, permission, and ownership inventory.
- Existing-table logical-to-physical reuse matrix covering all proposed persisted facts.
- Protected Schedule files, APIs, tables, tests, and representative-output baseline.
- Existing identity compatibility audit and approved additive mapping seam.
- Existing snapshot compatibility record.
- Contract temporal ontology and projection policy.
- Human-review and conflict policy.
- Recorded existing deterministic status/confidence/clock behavior as a regression contract.
- Canonical API names and component ownership.
- Approved gold-contract annotation guide.

Compatibility findings to classify before the next gate:

- Fits through a new additive Contracts writer with no Engine/schema change.
- Fits through current typed columns.
- Fits only as non-critical supplementary metadata.
- Remains dry-run-only because no approved persistence target exists.
- Requires a bounded exception request for an additive application, Engine, or schema change.

Exit criteria:

- Every decision that blocks the immediately authorized next phase is approved.
- A non-blocking decision may be deferred only with a named owner, decision deadline, and explicit statement that it cannot affect the authorized work.
- The actual existing schema, callers, permissions, row counts, and logical-to-physical reuse matrix can be reviewed without relying on the prose specification alone.
- Stable identity keys do not depend on LLM-generated wording.
- Protected Schedule tests and representative outputs are captured before Contracts changes.
- Every proposed persisted fact has an existing reuse target or is explicitly dry-run-only.
- The sample contract has an approved human annotation.

Approval gate:

CTO approval is required before Phase 1.

### Schema Reuse and Regression Gate — Required Before Operational Promotion

Goal:

Prove that Contracts integration can reuse the existing Schedule tables and preserve the existing Schedule Engine. The dry-run extraction work in Phase 1 may proceed in parallel because it writes no operational facts, but Phase 2 may not promote any candidate until this gate passes.

Required work:

- Complete the read-only live audit of all eight existing Schedule tables, constraints, indexes, permissions, callers, and non-secret row shapes.
- Approve the field-level table reuse matrix.
- Implement an additive Contracts writer/adapter that validates reviewed authority, explicit status, confidence, project binding, and exact evidence before invoking existing storage contracts.
- Preserve stable document/version identity separately from evidence URLs and locations using existing safe columns first.
- Implement reviewed promotion at the application/service boundary using existing tables; if atomicity cannot be achieved without a database function or schema change, keep promotion disabled and request approval.
- Add an interim routing guard so quantitative schedule questions cannot fall through Data Query and bypass Schedule Intelligence.
- Capture and rerun existing Schedule tests and representative golden outputs.
- Verify that the no-contract path and zero-approved-contract-facts path remain behaviorally identical to the current baseline.
- Confirm zero database-schema diff and no duplicate-purpose tables.

Exit criteria:

- All eight existing tables are confirmed and assigned their current/planned responsibility.
- Every operational Contracts output maps to an approved existing table/column contract.
- Unreviewed or authority-unknown candidates never reach schedule_contract_milestones or schedule_contract_extensions.
- The writer never emits a null status, missing confidence, missing evidence, or ambiguous project binding into an operational row.
- Document identity is never populated with a URL.
- Existing Schedule tests pass unchanged and representative unchanged inputs produce the baseline outputs.
- src/scheduleEngine.js and src/scheduleCalendar.js remain unchanged unless a separate exception was approved.
- Database schema diff is zero; existing rows, IDs, constraints, indexes, permissions, snapshots, alerts, mappings, and review data are preserved.
- No operational contract promotion is possible without review, evidence, source version, and audit state.
- No replacement table, duplicate table, or parallel Schedule calculation exists.

Approval gate:

Backend, security, Schedule, and architecture owners must approve this gate before Phase 2 can perform operational promotion. Any required Engine or DDL change is removed from this gate and presented as a separate bounded exception request.

### Phase 1 — Dry-Run Contracts Agent

Checkpoint status - 2026-08-08:

- The authenticated, bounded, no-write extraction core is implemented.
- Focused Contracts and protected Schedule regression suites are green.
- The existing Schedule Engine/Calendar and all CTO-created Schedule tables remain unchanged.
- The six-case deterministic representative gate passes. Phase 1 is not accepted for exit until the post-fix real-contract sample also completes within budget and passes the unchanged quality gates.
- See [BIDoc Phase 1 Contracts Agent Dry Run](./BIDoc_Phase_1_Contracts_Agent_Dry_Run.md) for implementation, verification, live chronology, manual checks, and deferred scope.

Goal:

Extract typed, evidence-backed candidates without writing operational schedule facts.

Deliverables:

- Page-aware document ingestion.
- Clause segmentation.
- Structured Contracts Agent prompt and schema.
- Deterministic validation.
- Authority, project-binding, missing-data, and conflict detection.
- Dry-run API returning candidate JSON.
- Gold-set evaluation harness.
- Extraction telemetry without raw secret or unauthorized evidence logging.

MVP rule:

No candidate is written to Schedule Intelligence tables in this phase.

Exit criteria:

- Reprocessing the same document produces stable candidate identities.
- Every critical date, duration, amount, party, and clause has exact evidence.
- The blank commencement stays missing; visible signature fields remain blank and execution authority stays unverified; the referenced BOQ/plans/specifications and absent Appendix C remain explicit packet gaps.
- The 2,000 versus 3,250 conflict remains unresolved.
- The 5 versus 15 project-address mismatch blocks binding.
- The explicit 100-workday completion rule is retained, while computedCompletionDate remains null until commencement and calendar inputs are approved.
- Eight-hour, weekly, monthly, and chained rules retain their real temporal form.
- The agent performs no schedule arithmetic or legal conclusion.
- A representative multi-contract gold-set evaluation is completed and meets the Phase 0 thresholds; one contract is not treated as a production generalization gate.

Approval gate:

Contract/product owner and CTO approve candidate quality before staging and review persistence work.

### Phase 2 — Staging, Review, and Atomic Promotion

Goal:

Create a controlled contract-fact lifecycle with human accountability.

Checkpoint status - 2026-08-10:

- The read-only live catalog, constraint, index, permission, row-count, function, and cross-database project-identity audit is complete.
- The pure fail-closed promotion planner is implemented and covered by focused tests; it performs no I/O.
- Operational persistence is paused because project namespace, immutable review/audit storage, atomic promotion, and the permission model are not yet approved.
- See [BIDoc Phase 2 Entry and Schema-Reuse Gate](./BIDoc_Phase_2_Entry_Schema_Reuse_and_Promotion_Gate.md).

Entry criteria:

- Phase 1 extraction evaluation is approved.
- The Schema Reuse and Regression Gate has passed.

Deliverables:

- Dry-run candidate output remains non-operational until every persisted field has an approved existing-table target.
- Reviewed fixed milestones persist only to schedule_contract_milestones.
- Reviewed extension events persist only to schedule_contract_extensions.
- Reviewed unresolved relative obligations persist only to schedule_contract_conditions.
- Document version, supersession, review, and conflict state reuse approved existing application/Schedule storage where compatible; any uncovered persistence need remains dry-run-only pending a separate storage-gap approval.
- Review queue and evidence viewer.
- Conflict review workflow.
- Approve, reject, correct, merge, and supersede actions.
- Application/service-level reviewed promotion through existing tables.
- Audit history and permission enforcement.
- Idempotent reprocessing.

Exit criteria:

- A partial failure cannot leave a promoted milestone without the corresponding reviewed state.
- Every approval records reviewer, time, reason, source version, and extractor version.
- Rejected candidates remain visible in audit history.
- Only approved schedule-driving candidates enter the contract axis.
- No source document or contractor schedule row is mutated.
- No staging, review, conflict, document, milestone, extension, or condition table is created automatically.
- If existing tables cannot preserve a required audit invariant, the affected candidate remains non-operational and a bounded gap proposal is returned to the CTO.

Approval gate:

Security, contract/product owner, and CTO approve controlled persistence.

### Phase 3 — Contract-to-Schedule Mapping

Goal:

Connect approved contractual obligations to durable project activities.

Deliverables:

- Audit and reuse current task_uid, stableKey, activity_key, and schedule_activity_map behavior before proposing any identity change.
- Mapping candidates with alternatives and confidence.
- Manual mapping review.
- Mapping state, conflict evidence, and confirmed aliases use schedule_activity_map and its existing fields first.
- Resolved-condition promotion using reviewed trigger evidence.
- Unlinked milestone representation for valid global contract milestones.

Exit criteria:

- Links survive a new schedule upload.
- Mapping confidence below 0.80 cannot create an automatic alert.
- Rejected and corrected mappings retain user, time, reason, and history.
- Unmapped obligations remain pending without fabricated dates.
- Conflicts between contract and contractor schedule stay visible; observed-evidence conflicts begin in Phase 5.
- No replacement mapping table or core activity-key change is introduced without a separate compatibility-gap approval.

Approval gate:

Product and Schedule domain owner approve mapping behavior.

### Phase 4 — Additive Consumer Integration and Regression Certification

Goal:

Route BIDoc consumers to the existing Schedule Intelligence outputs while preserving Engine behavior.

Deliverables:

- Regression validation of the existing snapshot, status, confidence, basis, null, and clock behavior.
- Evidence propagation through additive adapters and existing output fields where supported.
- Chat/classifier routing to the Schedule service.
- Data Query exclusion for schedule arithmetic.
- Insights and Health consumption of stored indicators.
- Optional later consumer: Timeline projection of approved milestones and relevant indicator changes, only under separate scope approval.
- Retirement of independent schedule arithmetic while preserving days_past_stated_commitment as a separately named evidence/legal metric pending an explicit product decision.
- Cross-version schedule_slippage or hidden_slippage enhancement is a separate scope item if it requires an Engine behavior change.

Exit criteria:

- Existing representative inputs preserve their baseline indicator outputs.
- Existing Schedule API shapes, basis priority, status, confidence, severity, and null behavior remain unchanged.
- Chat schedule questions invoke the Schedule service.
- Data Query never substitutes for schedule arithmetic.
- Insights and Health consume the same snapshot facts.
- Missing calendars, dependencies, or mappings remain explicit gates.
- No schedule arithmetic remains in UI or consumer agents.
- The protected Engine files remain unchanged unless a separate exception was approved.

Approval gate:

Architecture and product owners approve Rule 001 compliance.

### Phase 5 — Separately Approved Observed Evidence and Dependency Enrichment

Goal:

Improve delay explanation and downstream-impact analysis.

This is a later, separately approved phase. It does not authorize parser, Engine, or schema changes through the Contracts workstream.

Deliverables:

- Observed-event extraction and review using schedule_observed_events.
- Actual start/finish ingestion.
- Predecessor persistence.
- Slack, critical flags, WBS, and source-calendar persistence.
- Existing dependency/project-finish inputs are used where already supported; any new calculation requires a separate Engine-change proposal.
- Cross-axis conflict detection.

Exit criteria:

- Every observed event has source, excerpt, date, confidence, permission, and review state.
- Dependency conclusions are emitted only when the required source fields exist.
- Unsupported critical-path impact remains null.
- Contractor schedule source remains read-only.
- Cross-axis conflicts retain all evidence.
- Any required parser persistence, column, index, constraint, function, trigger, or permission change has a fresh read-only audit and separate DDL approval.

Approval gate:

Schedule domain owner approves dependency and impact accuracy.

### Phase 6 — Shadow Alerts and Operational Rollout

Goal:

Prove usefulness and noise control before broad notification.

Deliverables:

- Recurring alert-scan owner and schedule.
- Back-office shadow-alert mode.
- Snapshot-linked alert lifecycle using the existing schedule_alerts table.
- Initial-backlog summary behavior.
- Deduplication, material-change, reopen, resolve, and suppression rules.
- Calendar maintenance and operational monitoring.
- Rollback and circuit-breaker procedures.
- Staged tenant/project rollout plan.
- Existing Engine severity output is reused; no alternate severity calculator or alert table is introduced.

Exit criteria:

- Initial backlog creates at most one summary.
- Continuing breaches do not produce daily duplicates.
- Every alert links to the exact snapshot used.
- Removed or completed activities resolve alerts rather than deleting history.
- Noise, missed-alert, and false-positive results are reviewed against agreed thresholds.
- Permissions, monitoring, calendar ownership, and support procedures are documented.

Approval gate:

Only after shadow-mode acceptance may the CTO approve integration with the main BIDoc alerts experience or external notification channels.

## 12. Verification Strategy

| Layer | Required verification | Pass condition |
|---|---|---|
| Protected Schedule baseline | Existing focused suite plus representative lookup, sweep, health, condition, severity, and alert outputs | Current tests pass and unchanged inputs produce unchanged outputs |
| Existing-table schema audit | Read-only columns, types, defaults, nullability, keys, indexes, triggers, RLS, policies, grants, owners, counts, and callers for all eight tables | Complete approved reuse matrix; no assumptions from stale prose |
| Schema preservation | Before/after schema diff and table-name inventory | Zero DDL and no duplicate-purpose table unless a separate change was explicitly approved |
| No-contract compatibility | Existing flow plus zero approved contract facts | Behavior is identical to the protected baseline |
| Contract parsing | Text/OCR/page-order fixtures | Stable page and clause boundaries |
| Candidate extraction | Human-annotated gold contracts | Critical values exact; missing/conflicting facts preserved |
| Schema validation | Property and adversarial tests | Invalid or incomplete candidates fail closed |
| Idempotency | Repeat extraction and promotion | No duplicate current facts; history preserved |
| Temporal rules | Fixed, relative, sub-day, recurring, business-day, and chained fixtures | Deterministic expected occurrences |
| Calendar compatibility | Existing calendar regression suite | Existing behavior remains unchanged |
| Contract promotion | Application/service transaction and failure tests against existing tables | No operational row without its review/evidence state; no schema change |
| Activity identity | Existing task_uid/stableKey/activity_key behavior plus schedule_activity_map | Durable link where supported; any core identity gap becomes an exception request |
| Indicator Engine | Existing invariants plus additive contract-input cases | Existing formulas and outputs remain unchanged |
| Snapshot compatibility | Existing persistence/idempotency behavior | Baseline preserved; any demonstrated Contracts gap is separately proposed |
| Chat routing | Exact and semantic schedule questions | Schedule service is always authoritative |
| Consumer integration | Chat, Insights, Health, and Schedule UI; optional Timeline only if approved | No parallel schedule arithmetic |
| Alerts | Bootstrap, dedup, severity, reopen, resolve, suppression | Snapshot-linked, low-noise lifecycle |
| Permissions | Cross-project, cross-tenant, and evidence-access tests | No unauthorized fact or excerpt exposure |
| Browser | Desktop/mobile review queue, conflicts, indicators, and alerts | Correct null, conflict, gate, and evidence rendering |
| Operations | Scheduler, monitoring, failure, retry, and rollback drill | Controlled recovery without source mutation |

### 12.1 Sample-contract mandatory assertions

- Execution authority is unverified.
- Project binding requires review.
- Contractual completion date is null.
- Completion rule retains 100 working days.
- Calendar is missing.
- Both daily contractual delay-charge figures are present in one conflict with day type unresolved.
- Eight-hour notice remains sub-day compliance.
- Weekly cleanup remains recurring.
- Monthly payment workflow remains a rule chain.
- No reviewed schedule projection exists before approval.

## 13. Risk Register

| Risk | Severity | Consequence | Mitigation and gate |
|---|---|---|---|
| Existing Schedule Engine regression | Critical | A proven scheduling feature changes while adding Contracts | Protected-file default, before/after golden outputs, focused suite on every slice, immediate stop on unexplained diff |
| Duplicate/replacement Schedule table | Critical | Split truth, inconsistent callers, and operational drift | Eight-table reuse lock and zero-new-table default |
| Unauthorized DDL or destructive migration | Critical | Existing CTO schema, data, permissions, or availability is damaged | Read-only audit first; zero-DDL default; separate CTO approval for exact bounded SQL |
| Wrong document treated as authoritative | Critical | False contractual dates and alerts | Authority/version model plus human approval |
| Contract bound to wrong project | Critical | Cross-project contamination | Explicit project selection and mismatch blocking |
| AI invents or normalizes missing terms | Critical | False schedule basis | Exact evidence, deterministic validation, fail-closed review |
| Conflicting terms silently resolved | Critical | Unsupported contractual conclusion | Conflict groups and no automatic winner |
| Current contract admission defaults are unsafe for a new writer | Critical | An incomplete row can become an authoritative basis | Additive Contracts writer always supplies reviewed authority, explicit status, confidence, project binding, and evidence before existing readers see a row |
| Durable activity identity is file-scoped or unverified | Critical | Broken contract links, slippage, and alert lifecycle | Audit and reuse current identity/mapping fields; any core change requires separate approval |
| Snapshot compatibility concern | High | New Contracts revisions may not fit current persistence semantics | Preserve baseline; prove the exact gap first; request a separate additive change only if required |
| Quantitative schedule question bypasses Schedule Intelligence | Critical | Chat can return incomplete or contradictory schedule facts | Interim additive routing guard in the Schema Reuse and Regression Gate and full Rule 001 routing in Phase 4 |
| Schedule facts calculated in multiple agents | High | Contradictory user answers | Rule 001 routing and retirement of parallel arithmetic |
| Database/schema drift | High | Environment-specific failures | Read-only live audit, schema manifest, caller map, and no blind replay of historical CREATE/DROP SQL |
| Original evidence or document identity is lost/corrupted | High | Unexplainable indicators or URL/document-ID conflation | Separate document/version identity from evidence location and propagate clause/page/excerpt |
| Schedule settings silently revert | High | Wrong database profile, thresholds, or alert policy | Record as a separate configuration issue; do not use Contracts scope to refactor the Engine |
| Wall-clock/snapshot semantics may not fit future revisions | High | Duplicate or stale derived history | Preserve and measure current behavior; any change is a separate compatibility proposal |
| Non-schedule obligations become delay alerts | High | Alert noise and loss of trust | Explicit projection classification |
| Missing calendar produces a fake date | High | Incorrect contractual completion | Null plus missing-calendar gate |
| Condition promotion partially succeeds | High | Inconsistent legal/schedule state | Application/service-level reviewed promotion using existing tables; request DDL only if no safe existing mechanism exists |
| Alert flood from historical backlog | High | User disengagement | Shadow mode and bootstrap summary |
| Unauthorized evidence exposure | High | Tenant/privacy incident | Permission inheritance and negative access tests |
| One contract overfits the extractor | Medium | Poor generalization | Representative multi-contract gold set |
| Model or OCR version changes output | Medium | Silent extraction drift | Versioned outputs and regression evaluation |

## 14. Operational Rollout Model

Phase-to-rollout mapping:

| Delivery work | Operational stage |
|---|---|
| Phase 0 | No runtime stage; architecture decision only |
| Schema Reuse and Regression Gate | Stage B additive-integration prerequisite; existing Engine/tables preserved and no customer-facing behavior |
| Phase 1 | Stage A offline evaluation |
| Phase 2 | Stage B reviewed local/development persistence |
| Phases 3-5 | Stage C single-project shadow validation, then Stage D only after their approval gates |
| Phase 6 | Stage C alert shadowing, Stage D back-office expansion, and Stage E only after separate notification approval |

### Stage A — Offline evaluation

- Curated contract gold set.
- No operational database writes.
- No end-user alerts.

### Stage B — Reviewed local or development persistence

- Candidate staging and review.
- Explicit test projects only.
- No production notification.

### Stage C — Single-project shadow mode

- One approved project and authoritative contract set.
- Indicators and alerts visible only to reviewers.
- Compare BIDoc output with project/contract manager judgment.

### Stage D — Multi-project back-office rollout

- Measured precision, recall, noise, unresolved rates, and review effort.
- Operational calendar and scheduler ownership.
- Tenant isolation proven.

### Stage E — Product alert integration

- Separate CTO/product approval.
- Main BIDoc alert delivery or external notification only after shadow acceptance.
- Rollback and circuit breaker active.

## 15. Metrics

### Extraction quality

- Critical-value precision.
- Critical-value recall.
- Missing-field detection rate.
- Conflict detection rate.
- Project-binding block accuracy.
- Stable-key duplicate rate.
- Human correction rate by field and clause type.

### Mapping quality

- High-confidence mapping precision.
- Unmapped obligation rate.
- Mapping correction rate.
- Cross-version link survival rate.

### Indicator quality

- Recalculation determinism.
- Snapshot replay success.
- Stale-snapshot rate.
- Missing-capability gate accuracy.
- Contract/schedule/evidence conflict detection.

### Alert quality

- False-positive rate.
- Missed material delay rate.
- Duplicate alert rate.
- Historical backlog noise.
- Time from new evidence to reviewed indicator.
- Time from reviewed indicator to alert.

### Operational quality

- Review queue age.
- Failed extraction and retry rate.
- Calendar coverage.
- Permission-denial test success.
- Scheduler freshness.
- Rollback drill success.

Metric thresholds must be agreed during Phase 0; they should not be invented after observing results.

## 16. CTO Approval Checklist

### CTO directives confirmed on 2026-08-08 and clarified on 2026-08-10

- [x] Keep the existing Schedule Engine as the canonical schedule-calculation baseline.
- [x] Reuse and, where genuinely required, extend the existing Engine instead of building duplicate schedule logic.
- [x] Require focused regression tests and an explicit behavioral explanation for every Engine integration change.
- [x] Reuse the eight existing CTO-created Schedule tables.
- [x] Perform a read-only schema/caller compatibility audit before coding.
- [x] Do not create duplicate tables or execute DDL without separate approval.

### Approve now

- [ ] AI extraction plus deterministic calculation boundary.
- [ ] Separate schedule-driving and contract-compliance projections.
- [ ] Human approval for every MVP fact capable of moving a schedule basis or creating an alert, superseding confidence-only auto-promotion.
- [ ] Explicit project selection with mismatch blocking.
- [ ] Phase 0 decision lock only.
- [ ] Gold-set evaluation before persistence.
- [ ] Shadow-alert rollout before product notifications.

### Decisions to assign owners

- [ ] Existing-table schema/caller audit and reuse-matrix owner.
- [ ] Gantt parser/persistence owner.
- [ ] Contract authority and review owner.
- [ ] Calendar owner.
- [ ] Existing identity compatibility owner.
- [ ] Protected Schedule regression owner.
- [ ] Alert lifecycle and scheduler owner.
- [ ] Evidence access/security owner.

### Not approved by this document

- [ ] Any unrelated or duplicate implementation of Schedule formulas, basis priority, status, confidence, severity, or calendar arithmetic.
- [ ] Any Schedule Engine/Calendar edit that is unnecessary for the approved integration slice, lacks an explicit reuse rationale, or lacks focused regression evidence.
- [ ] Any duplicate, replacement, cloned, or parallel schedule/contract table.
- [ ] Any CREATE, ALTER, DROP, TRUNCATE, index, trigger, function, RLS, grant, policy, permission, or backfill operation.
- [ ] Replaying the specification's historical CREATE/DROP blocks against the existing environment.
- [ ] Automatic contract-fact promotion.
- [ ] Production or customer-facing alerts.
- [ ] Main alert-channel integration.
- [ ] External notifications.
- [ ] Deployment.

## Appendix A — Critical Technical Findings

### A.1 Database and source-profile contradiction

The specification alternates between a KAPAIM Content DB-only data policy and configurable MAIN/KAPAIM profiles. Current code forces Gantt reads to MAIN App DB gantt_files_test and gantt_tasks_test, while engine-owned schedule tables use KAPAIM Content DB through APP DATA/contentSource.

Additive-first handling:

- Audit and document the current topology, table locations, callers, and connection settings read-only.
- Contracts work uses the existing topology; it does not move, clone, or recreate the tables.
- Any routing, permission, RLS, grant, or migration change is a separate exception request.

Evidence:

- [Schedule ingestion](../../src/scheduleIngestion.js)
- [Database caller inventory](../db-table-callers-inventory.md)

### A.2 Version-specific activity identity

The persisted/source activity key contains the schedule file ID. The engine's current cross-version comparison attempts to match task_uid through a separate stableKey, but task_uid durability has not been verified and contract mappings, snapshots, and alert identity remain tied to the file-scoped activity key.

Impact:

- Contract links can break.
- Alert continuity can break.
- Cross-version slippage can mispair or disappear if task_uid changes between schedule versions.
- Removed-activity resolution becomes ambiguous.

Additive-first handling:

Audit and reuse current task_uid, stableKey, activity_key, and schedule_activity_map first. Prefer an additive crosswalk in the existing mapping table. Do not change core identity behavior without a separate approved proposal.

### A.3 Snapshot revision mismatch

Snapshot deduplication currently omits dataVersion, while the documented indexes also omit data version. The derived data version does not cover all contract, calendar, evidence, and mapping inputs.

The indicator payload also contains a runtime-clock calculatedAt value. Without an explicit content-identity contract, identical semantic inputs can appear different or every rerun can create a new revision.

Impact:

Fresh same-day results can be computed but skipped during persistence, leaving alerts linked to stale snapshots.

Additive-first handling:

Freeze the current snapshot behavior as the regression baseline. Prove that a specific Contracts use case cannot be represented through the existing writer and payload before proposing an index, identity, or persistence change.

Evidence:

- [Schedule orchestration and snapshot persistence](../../src/subagents/schedule.js)

### A.4 Contract evidence loss

Milestone loading omits the original clause excerpt and page-level evidence. Extension mapping also loses approval evidence. The engine later synthesizes contract evidence text from structured names and dates. The current condition resolver can also write an evidence URL into source_document_id, conflating stable document identity with an evidence location.

Additive-first handling:

The Contracts writer populates the existing evidence/provenance columns correctly and keeps source URL/location separate from document identity. If a critical field has no safe existing target, keep that candidate non-operational and request a bounded additive change.

Evidence:

- [Schedule ingestion](../../src/scheduleIngestion.js)
- [Schedule engine](../../src/scheduleEngine.js)

### A.5 Fail-open contract admission

The current loader accepts active contract milestones without authority or review fields. Missing milestone confidence can default to 1, and a missing extension status can default to approved.

Impact:

- An unreviewed or malformed row can become the highest-priority contractual basis.
- A missing extension decision can move the contractual date.
- Confidence can be overstated without evidence.

Additive-first handling:

The new Contracts writer/adapter fails closed before any existing reader sees a row: reviewed authority is mandatory, status is explicit, confidence is explicit, evidence is present, and project binding is approved. Existing Engine defaults are not changed under this plan.

Evidence:

- [Schedule ingestion](../../src/scheduleIngestion.js)
- [Schedule engine](../../src/scheduleEngine.js)

### A.6 Non-transactional condition promotion

The current condition resolver first writes a milestone and then updates the condition. A failure between requests can leave partial state.

The UI currently invokes the resolver with commit enabled, without a separate reviewed-contract approval object.

Additive-first handling:

Use an application/service-level promotion boundary over the existing tables after explicit review. If a database function, trigger, or schema change is required for atomicity, keep promotion disabled and request separate DDL approval.

Evidence:

- [Condition resolver](../../src/subagents/scheduleConditionResolver.js)
- [Schedule UI](../../src/react/SchedulePage.jsx)

### A.7 Rule 001 is incomplete

Chat and the classifier do not currently route schedule questions to the Schedule Intelligence service. Insights and Health retain independent overdue-commitment calculations.

A quantitative schedule question can be classified as supported Data Query with no target table, allowing it to bypass Schedule Intelligence.

Impact:

Different consumers can produce different schedule answers.

Additive-first handling:

Change consumers to call the existing Schedule Intelligence APIs/results and retire parallel consumer-side schedule arithmetic. Leave the Schedule Engine calculation core unchanged.

Evidence:

- [Main agent](../../src/agent.js)
- [Classifier](../../src/classifier.js)
- [Insights pipeline](../../src/subagents/insightPipeline.js)
- [Health score](../../src/subagents/healthScore.js)

### A.8 Parser and dependency gap

The canonical specification and its reviewed source-artifact analysis report predecessor, slack, criticality, actual-date, WBS, and calendar information in the XML. The XML parser is not present in this backend repository, and the current selected backend source columns do not provide these inputs to the engine.

Additive-first handling:

Treat parser persistence and dependency enrichment as a separately owned future phase. Do not claim critical-path impact or change the Engine/parser/schema through the Contracts scope.

### A.9 Alert ownership and visibility

Schedule alerts use an isolated schedule_alerts lifecycle and currently require manual scanning. They do not automatically enter the main BIDoc alert experience.

Additive-first handling:

Reuse schedule_alerts and the current Engine severity output. Assign the existing-table writer, scheduler, operational owner, shadow-review process, and eventual delivery channel; do not create a parallel alert table or severity calculator.

### A.10 Schedule settings persistence

The Schedule settings reader expects a schedule section, while the current settings writer does not preserve it.

Impact:

- Source profiles, thresholds, and alert policy can silently revert after settings are saved.

Additive-first handling:

Track this as a separate regression-tested configuration issue. It does not justify refactoring the Schedule Engine or changing tables through the Contracts scope.

Evidence:

- [Configuration and settings persistence](../../src/config.js)

## Appendix B — Known Compatibility Findings

The following items must be audited and classified in Phase 0. Only findings that block the approved Contracts slice may be addressed, and the additive writer/adapter is the first remedy. This list is not permission to change the Schedule Engine, create tables, or execute DDL:

- Canonical database and source-profile policy.
- Storage/browser ingestion description versus MAIN test-table reality.
- Existing activity identity and schedule_activity_map compatibility across schedule versions.
- Current snapshot behavior and Contracts-input compatibility.
- Reconciliation of all eight already-existing tables with the specification and repository history.
- Historical CREATE/DROP blocks are schema reference only and must not be replayed against the existing environment.
- Contracts Agent ontology and writer contract.
- Backlog-summary alert storage representation.
- Alert writer ownership.
- Canonical evaluate-source route name.
- Existing calculatedAt and asOf behavior as a protected regression expectation.
- Completed-work variance representation.
- Existing confidence formula and status precedence as a protected regression expectation.
- Persistent conflict and mapping-review history.
- Calendar fallback and stale-coverage behavior.
- Immutable contract history versus upsert behavior.
- Extension units and applicable scope.
- Recurring-condition occurrence representation.
- Contract review/import UI ownership.

## Appendix C — Code and Document Source Map

| Concern | Primary source |
|---|---|
| Canonical Schedule design | [Schedule Intelligence specification](./BIDoc_Schedule_Intelligence_Engine_Spec.md) |
| Deterministic calculation | [src/scheduleEngine.js](../../src/scheduleEngine.js) |
| Calendar calculations | [src/scheduleCalendar.js](../../src/scheduleCalendar.js) |
| Schedule source and engine-table loading | [src/scheduleIngestion.js](../../src/scheduleIngestion.js) |
| Snapshot, lookup, sweep, health, and alerts | [src/subagents/schedule.js](../../src/subagents/schedule.js) |
| Relative-condition resolution | [src/subagents/scheduleConditionResolver.js](../../src/subagents/scheduleConditionResolver.js) |
| Schedule APIs | [src/server.js](../../src/server.js) |
| Schedule UI | [src/react/SchedulePage.jsx](../../src/react/SchedulePage.jsx) |
| Main Chat pipeline | [src/agent.js](../../src/agent.js) |
| Request classification | [src/classifier.js](../../src/classifier.js) |
| Data Query routing | [src/subagents/dataQuery.js](../../src/subagents/dataQuery.js) |
| Insights calculations | [src/subagents/insightPipeline.js](../../src/subagents/insightPipeline.js) |
| Health calculations | [src/subagents/healthScore.js](../../src/subagents/healthScore.js) |
| Settings persistence | [src/config.js](../../src/config.js) |
| Database caller inventory | [docs/db-table-callers-inventory.md](../db-table-callers-inventory.md) |

## Appendix D — Immediate Next Artifact

If Phase 0 is approved, the first implementation-preparation artifact should be:

BIDoc Schedule Reuse Audit, Regression Baseline, Contracts Agent Output Contract, and Gold-Set Annotation Guide

It should contain:

- Read-only schema inventory for the eight existing Schedule tables.
- Current caller/writer map.
- Logical-to-physical field reuse matrix.
- Explicit zero-DDL and no-duplicate-table confirmation for the authorized slice.
- Protected Schedule test baseline and representative golden outputs.
- Protected-behavior list, existing-logic reuse map, and confirmation of whether the approved slice required an Engine change.
- Final JSON schemas.
- Stable-key examples.
- Authority/version rules.
- Project-binding rules.
- Temporal expression grammar.
- Projection classification guide.
- Conflict and review rules.
- The fully annotated sample contract.
- At least several additional representative contract variants.
- Evaluation cases and exact pass/fail criteria.

Implementation should begin only after that artifact, the Phase 0 architecture decisions, and the Schema Reuse and Regression Gate are approved. If any Contracts requirement needs an Engine or schema change, that item stays out of the authorized slice until its separate exception is approved.
