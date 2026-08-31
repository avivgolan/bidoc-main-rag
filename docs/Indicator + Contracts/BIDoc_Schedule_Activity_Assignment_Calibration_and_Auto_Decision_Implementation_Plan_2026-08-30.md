# Schedule Activity Assignment Calibration and Automatic Decision Implementation Plan

Date: 2026-08-30

Status: the Phase 4 policy-evaluation framework is implemented, but evidence-based policy selection is blocked. The Phase 3.1 MAIN migration and authenticated production collection UI are deployed and verified. A bounded, review-only collection safety update is implemented locally and awaits automatic deployment verification. Four reviews are pending, zero explicit labels exist, and Phase 5 has not started.

Current engine: `schedule-assignment.v2.1-rc1`
Current published configuration: `schedule-assignment-openai.v2.1-rc1`

## 1. Purpose

This plan defines the controlled work required to improve the Schedule activity-assignment engine from candidate retrieval through calibrated confidence and safe automatic assignment.

The current engine can rank activities and correctly abstains when its safety gates do not pass. However, the displayed values are blended ranking scores rather than calibrated probabilities, the correct activity can be excluded before semantic scoring, and the current labelled dataset is too small and incomplete to select a production threshold or runner-up margin.

The implementation must therefore improve the system in this order:

```text
trusted human labels
  -> complete candidate retrieval
  -> bounded model ranking and validation
  -> calibrated probability
  -> threshold and runner-up policy
  -> shadow validation
  -> controlled automatic assignment
```

Each phase has its own approval gate. Completing one phase does not authorize the next phase, a deployment, a remote settings change, or an automatic Schedule write.

## 2. Scope lock

### 2.1 In scope

- Read-only recovery of reviewed Schedule assignment evidence.
- Reproducible labelled evaluation datasets.
- Candidate retrieval and candidate-recall improvements.
- Separation of ranking scores from calibrated probability.
- Offline confidence calibration and threshold-margin sweeps.
- Clearer decision gates and review reasons.
- Hebrew RTL review UI terminology for score, confidence, and manual review.
- Shadow-mode validation with no automatic write.
- Controlled automatic-assignment rollout after a separate approval.
- Monitoring, rollback, and recurring recalibration evidence.

### 2.2 Out of scope unless separately approved

- Deleting or rewriting CTO-created Schedule links.
- Copying recovered backup alerts into the live `alerts` table.
- Changing Contracts-to-Indicator ownership boundaries.
- Changing the Gantt source of truth or Schedule version selection.
- Replacing the approved model family without a frozen comparison.
- Publishing a new remote threshold, margin, prompt, model, or weight during the evaluation phases.
- Deploying or enabling production automatic assignment before shadow acceptance.
- Treating an uncalibrated ranking score as a probability.

## 3. Safety principles

1. The first acceptance priority is zero observed false automatic assignments. Coverage is optimized only after safety.
2. A missing correct candidate is a retrieval failure. No threshold or prompt change can repair a candidate that never reaches the ranking stage.
3. The top two candidate values must not be normalized to sum to 100%. Two weak candidates can both be wrong.
4. `no_match`, ambiguity, hard conflict, stale activity, and irrelevant alert remain valid non-writing outcomes.
5. Existing manual and CTO-authored links remain immutable evidence. Evaluation reads them but does not mutate, delete, or reinterpret them automatically.
6. Human labels are excluded from the runtime signals of the same evaluated case to prevent leakage.
7. Every report freezes the data cutoff, active Schedule version, engine version, settings version, configuration snapshot, prompt hashes, and fixture hash.
8. A threshold selected on training data is not accepted until it passes a held-out or shadow-reviewed set.

## 4. Verified current baseline

### 4.1 Current production-style flow

The current implementation:

1. Builds deterministic scores across active non-summary Gantt activities.
2. Retains up to 20 deterministic candidates.
3. Computes semantic embeddings only for the first 8 retained candidates.
4. Sends the bounded candidates to the Matcher and Schedule Validator.
5. Blends semantic, lexical, temporal, hierarchy, historical, and model-consensus values into `finalScore`.
6. Invokes the Judge for disagreement, ambiguity, or near-threshold results, with at most 5 candidates.
7. Returns up to 8 candidates from the runtime and persists only the top 2 in the shared review snapshot.
8. Applies the automatic-write gates using the leading raw `finalScore` as `confidence`.

The UI currently shows the leading `finalScore` with a percent sign. This value is a weighted match score, not an empirically calibrated probability.

### 4.2 Current default policy

| Setting | Current value |
| --- | ---: |
| Automatic-assignment threshold | 90 |
| Minimum runner-up margin | 12 points |
| Suggestion threshold | 45 |
| Judge near-threshold range | 8 points |
| Maximum deterministic/final candidates | 20 |
| Maximum semantic candidates | 8 |
| Maximum Judge candidates | 5 |
| Candidates shown and persisted for team review | 2 |

### 4.3 Live evaluation evidence from 2026-08-30

A non-persisting evaluation was run against the active Schedule version `1787251318726_MS_Project.xml` and the published `schedule-assignment-openai.v2.1-rc1` configuration.

| Metric | Result |
| --- | ---: |
| Active activities | 102 |
| Evaluated cases | 6 |
| Confirmed matches | 4 |
| Rejected proposals | 2 |
| Final candidate recall at 1 | 75% |
| Final candidate recall at 5 | 75% |
| Correct automatic assignments | 0 |
| False automatic assignments | 0 |
| Abstention rate | 100% |
| Role failures | 0 |
| Structured-output failures | 0 |
| Total provider calls | 75 |
| Average latency | 18.2 seconds |
| P95 latency | 23.3 seconds |

One of four confirmed activities was absent from the final top five. This establishes a candidate-retrieval failure that cannot be solved by lowering the confidence threshold.

The six-case threshold-margin sweep produced preliminary observations only:

| Threshold | Margin | Correct automatic | False automatic |
| ---: | ---: | ---: | ---: |
| 90 | 12 | 0 | 0 |
| 60 | 12 | 1 | 0 |
| 55 | 10 | 2 | 0 |
| 55 | 5 | 2 | 0 |

These results must not be used to publish `55/10`, `55/5`, or any other policy. Six cases and two negative labels are insufficient for a production decision.

### 4.4 Available reviewed evidence

The active Schedule version has 28 linked alerts:

- 27 links with `assignment_method = manual`.
- 1 link with `assignment_method = agent_approved`.
- 4 linked alerts remain in the current `alerts` table.
- 24 linked alerts are restored through the read-only `alerts_backup_dedupe_20260822` compatibility path.
- 2 rejected assignment runs are currently available as negative evidence.

The current evaluation preparation script reads only the current `alerts` table. It therefore recovers 4 confirmed cases instead of the available 28 active linked cases.

## 5. Target architecture

### 5.1 Candidate retrieval

```text
all active non-summary Gantt activities
  -> lexical retrieval
  -> semantic retrieval across the full active set
  -> scope, trade, location, and time features
  -> union and deduplication
  -> bounded candidate set
```

Semantic search must be able to introduce an activity that lexical/deterministic ranking missed. It must not be limited to reranking only the first deterministic candidates.

### 5.2 Candidate evaluation

```text
bounded candidates
  -> Matcher
  -> independent Schedule Validator
  -> optional Judge
  -> explicit match / ambiguous / no_match / conflict outcome
```

### 5.3 Confidence and policy

```text
candidate features and model outcomes
  -> calibrated P(correct top candidate)
  -> threshold gate
  -> runner-up separation gate
  -> existing operational safety gates
  -> shadow or controlled write
```

The calibrated probability and runner-up separation are different concepts and remain separate in storage, policy, and UI.

## 6. Phase 0 - Baseline lock and plan approval

### Objective

Freeze the verified starting point and prevent accidental production tuning before the evaluation foundation is complete.

### Deliverables

- This implementation plan.
- Recorded current configuration and baseline metrics.
- Explicit statement that `finalScore` is not calibrated probability.
- Explicit preservation of the 28 reviewed links and the backup read-only restoration layer.
- A clean repository baseline before Phase 1 edits.

### Acceptance gate

- The plan is reviewed and approved.
- Phase 1 scope is accepted.
- No code, remote settings, database, UI behavior, or deployment change is included in Phase 0.

### Status

Completed on 2026-08-30. The user approved Phase 1 implementation. No production configuration, database, deployment, or automatic-assignment behavior was changed.

## 7. Phase 1 - Complete evaluation foundation

Implementation status: completed on 2026-08-30. The frozen read-only dataset contains all 28 reviewed positive links and 2 reviewed rejected choices. The full checkpoint and baseline results are recorded in `BIDoc_Schedule_Activity_Assignment_Calibration_Phase_1_Evaluation_Foundation_Checkpoint_2026-08-30.md`.

### Objective

Build a reproducible, read-only evaluation system that uses all available reviewed evidence and reports enough detail to diagnose retrieval, ranking, calibration, and policy separately.

### 7.1 Unified reviewed-alert recovery

Implementation:

1. Reuse the canonical Schedule read behavior that merges current alerts with explicitly linked legacy backup rows.
2. Read backup rows only when `schedule_activity_alert_links` contains an explicit link.
3. Never copy recovered backup rows into `alerts`.
4. Preserve source provenance indicating current alert or recovered legacy alert.
5. Reject duplicate source identities deterministically.

Expected initial recovery:

- 28 confirmed active-version links.
- 2 rejected proposals.
- Additional no-match, ambiguous, irrelevant, and stale labels only when supported by reviewed evidence.

### 7.2 Label contract

Every fixture must use one of:

| Label | Meaning |
| --- | --- |
| `confirmed_match` | A reviewer selected the expected active activity. |
| `rejected_match` | A reviewer rejected the proposed activity. |
| `no_match` | A reviewer confirmed that no active activity is suitable. |
| `ambiguous` | Multiple activities remain plausible after review. |
| `irrelevant_alert` | The source should not enter assignment. |
| `stale_activity` | The historical activity is absent from the active Schedule version. |

Labels must include provenance, review time when available, expected or forbidden activity keys, and a bounded reason.

### 7.3 Full diagnostic capture

For every case and candidate stage, capture:

- Candidate key, name, dates, hierarchy, and rank.
- Lexical, semantic, temporal, hierarchy, historical, and model-consensus signals.
- Matcher score, reason, best key, and decision.
- Validator score, reason, hard conflict, best key, and decision.
- Judge outcome, selected key, runner-up key, reason, and conflicts.
- Final score, selected candidate, runner-up, and raw margin.
- Operational gates and precise failed-gate names.
- Retrieval recall at 1, 5, and the full bounded candidate set.
- Provider call count, latency, model errors, and structured-output failures.

### 7.4 Evaluation reports

Add reports for:

- Candidate recall by stage.
- Confusion and outcome counts.
- Correct and false automatic-assignment eligibility.
- Abstention rate and coverage.
- Threshold-margin sweep.
- Score distributions for positive and negative labels.
- Reliability bins once calibrated probability exists.
- Row-level explanations for every disagreement.

### 7.5 Phase 1 files expected to change

- `scripts/run-schedule-activity-assignment-evaluation.mjs`
- `src/scheduleActivityAssignmentEvaluation.js`
- `src/subagents/schedule.js` or a narrowly extracted shared read helper
- `src/supabase.js` only if an existing read helper must be safely exposed
- `test/schedule-engine.test.js`
- A new Phase 1 checkpoint under `docs/Indicator + Contracts/`

### 7.6 Verification

- Focused unit tests for current plus recovered alert merging.
- Fixture tests for every label type.
- Duplicate and stale-version tests.
- Read-only live preparation against the active project.
- `npm.cmd run test:schedule`.
- `git diff --check`.

### Phase 1 acceptance gate

- All 28 available active links are either included with valid source evidence or excluded with an explicit reason.
- The 2 rejected proposals remain negative labels.
- No evaluation label is passed into runtime candidate scoring.
- No database write occurs.
- Every case has a reproducible configuration and provenance manifest.
- A complete baseline report is reviewed before Phase 2 begins.

### Rollback

Phase 1 is local evaluation infrastructure. Rollback consists of reverting only its scoped code and documentation changes. No business data rollback should be required.

## 8. Phase 2 - Candidate retrieval correction

Implementation status: completed locally on 2026-08-30. The recommended comparison winner is a 20-candidate hybrid union with 14 deterministic slots and 6 full-set semantic slots, backed by versioned activity-embedding cache keys. It is not active in production. Results and limitations are recorded in `BIDoc_Schedule_Activity_Assignment_Calibration_Phase_2_Candidate_Retrieval_Checkpoint_2026-08-30.md`.

### Objective

Ensure the correct activity reaches Matcher and Validator before tuning confidence or automatic policy.

### 8.1 Full-set semantic retrieval

- Compute semantic similarity across the full active non-summary activity set.
- Avoid embedding only candidates already selected by deterministic retrieval.
- Reuse cached activity embeddings when the active Schedule version and activity text are unchanged.
- Invalidate cached activity embeddings when activity identity, name, dates, or Schedule version changes according to the selected canonical input contract.

### 8.2 Hybrid candidate union

Build a deterministic union from:

- Lexical retrieval.
- Semantic retrieval.
- Extracted trade and scope matches.
- Location or work-zone matches.
- Event meaning matches such as start, delay, approval, delivery, inspection, completion, or handover.
- Temporal compatibility as supporting evidence.

Use explicit deduplication and stable tie-breaking. Generic date proximity must not dominate a candidate with no scope support.

### 8.3 Candidate limits

Measure candidate limits rather than assuming one value:

- Retrieval pool candidates.
- Matcher/Validator candidates.
- Judge candidates.
- UI review candidates.

The expected model input is a bounded 6 to 8 candidate set, subject to evaluation evidence. The UI may continue showing two candidates plus `none`, while the audit retains the full bounded set.

### 8.4 Phase 2 comparison

Run the frozen Phase 1 dataset against:

- Current deterministic-first retrieval.
- Full-set semantic retrieval.
- Hybrid union retrieval.
- Candidate limits selected for comparison.

No prompts, thresholds, margins, or automatic-write gates change during the retrieval comparison.

### Phase 2 acceptance gate

- Confirmed-match recall at 5 improves materially from the 75% baseline.
- No confirmed activity in the frozen initial dataset is lost from the final bounded set without an explicit documented cause.
- Negative and ambiguous cases do not gain false certainty.
- Provider calls and latency stay within an explicitly reviewed budget.
- The selected retrieval configuration is approved before Phase 3.

### Rollback

Keep the current retrieval path behind a configuration/version boundary until the new path passes the frozen comparison. Switching back must not require data mutation.

## 9. Phase 3 - Score separation and probability calibration

Implementation status: completed locally on 2026-08-30. The ranking score, ranking gap, and calibrated probability are now explicit fields; a versioned Platt/isotonic/control evaluation artifact and compatibility gate are implemented. The current 30-case artifact is blocked from production because it has insufficient label coverage and its selected Platt model did not improve held-out performance over the raw control. Full results are recorded in `BIDoc_Schedule_Activity_Assignment_Calibration_Phase_3_Score_and_Probability_Checkpoint_2026-08-30.md`.

### Objective

Replace the misleading use of `finalScore` as confidence with a clear ranking score plus an empirically calibrated probability.

### 9.1 Ranking score contract

The candidate ranking layer may continue producing a deterministic ranking score, but it must be named and documented as a score. It is not displayed as probability and does not need to sum to 100 across candidates.

### 9.2 Calibration features

Candidate-level and decision-level calibration may use:

- Leading ranking score.
- Runner-up ranking score.
- Score gap.
- Semantic and lexical separation.
- Matcher and Validator scores.
- Matcher and Validator best-key agreement.
- Matcher and Validator decision types.
- Hard conflicts.
- Judge decision and whether Judge changed the selected key.
- Candidate specificity and generic-task penalties.
- Missing trade, scope, location, event-meaning, or date discriminators.

No feature may use the evaluated human label or a historical signal derived from that same row.

### 9.3 Calibration methods to compare

Compare simple, auditable methods:

1. Logistic calibration or Platt scaling.
2. Isotonic calibration when sufficient data supports a non-parametric fit.
3. Uncalibrated score retained as the control.

Select the simplest method that improves held-out calibration without unstable folds or leakage.

### 9.4 Minimum evidence rule

The initial 28 positive links and 2 rejected cases can diagnose retrieval but are not balanced enough to authorize calibrated automatic assignment.

Before enabling calibrated production confidence, collect approximately 100 representative reviewed cases with meaningful coverage of rejected, no-match, ambiguous, irrelevant, and stale outcomes. The exact readiness decision must consider class balance and held-out behavior, not only total row count.

Until this gate passes:

- Keep automatic assignment disabled or governed by the existing conservative policy.
- Display `match score`, not calibrated confidence.
- Continue collecting labels through shared review.

### Phase 3 acceptance gate

- Ranking score and calibrated probability are separate fields.
- The probability is evaluated on held-out data.
- Reliability bins and expected-versus-observed correctness are reported.
- `no_match` remains an independent outcome.
- The calibrator artifact is versioned and tied to feature, engine, Schedule, and dataset versions.
- The calibration choice is reviewed before Phase 4.

### Rollback

If calibration is unavailable, stale, or incompatible with the active feature version, the engine must return to non-probability match scores and conservative human review. It must not silently reuse an incompatible calibrator.

## 9A. Phase 3.1 - Reviewed evidence collection

Implementation status: deployed and verified in the authenticated production Schedule UI on 2026-08-30. The collection path supports explicit labels for confirmed matches, rejected matches, no match, ambiguous cases, irrelevant alerts, and stale activities. Labels are merged with canonical links using conflict-safe precedence, and readiness is reported against the 100-case evidence target.

The latest read-only refresh contains 30 reviewed cases: 28 confirmed matches and 2 rejected matches. Another 70 representative reviewed cases are required, and the dataset still has no examples of `no_match`, `stale_activity`, `irrelevant_alert`, or `ambiguous`.

The additive backend-only migration is applied in MAIN. Production build `4a102c1` shows four pending cards, including three durable snapshot-only reviews whose original alert rows are no longer in the active feed. No explicit labels were created during verification. The implementation and activation checkpoints are recorded in the Phase 3.1 checkpoint documents.

The 2026-08-31 bounded collection update replaces the ambiguous all-row action with a 10, 25, or 50 row review-only batch. The batch cannot write automatic links, the full eligible count is identified as a waiting queue, and assigned rows display persisted assignment provenance. Its checkpoint is `BIDoc_Schedule_Activity_Assignment_Phase_3_1_Bounded_Collection_UI_Checkpoint_2026-08-31.md`.

The expanded dataset must be frozen and reviewed before calibration and Phase 4 policy selection are rerun. Collection-path activation does not authorize an automatic policy, shadow mode, or Phase 5 work.

## 10. Phase 4 - Automatic decision policy calibration

### Objective

Choose the automatic-assignment threshold and runner-up separation from held-out evidence rather than intuition.

### 10.1 Policy sweep

Evaluate a bounded grid of:

- Calibrated confidence thresholds.
- Runner-up margins such as 1, 3, 5, 10, 12, 15, and 20 points or their calibrated equivalent.
- Role-agreement requirements.
- Hard-conflict blocking.
- Judge outcomes.

Report for every configuration:

- Correct automatic assignments.
- False automatic assignments.
- Safe coverage.
- Abstention rate.
- Per-label outcomes.
- Confidence and margin distributions.
- Latency and provider cost.

### 10.2 Operational safety gates

The selected candidate can be automatically assigned only when all approved gates pass:

- Final decision is `match`.
- Calibrated probability passes the approved threshold.
- Runner-up separation passes the approved margin.
- No hard conflict exists.
- Event has a canonical business date.
- Candidate belongs to the active Schedule version.
- Source is currently unassigned.
- Run is fresh.
- Automatic assignment is enabled.
- Required model roles completed successfully.
- Any separately required role agreement passes.

### 10.3 Gate naming correction

The current `aiCompleted` policy gate also includes Matcher/Validator agreement. Split it into explicit gates:

- `requiredRolesCompleted`
- `matcherValidatorAgreement`

This prevents the UI and audit from reporting a role failure when the actual condition is model disagreement.

### Phase 4 acceptance gate

- Zero observed false automatic assignments on the held-out acceptance set.
- No automatic decision is enabled from the six-case baseline or training set alone.
- The selected policy maximizes safe coverage only after satisfying the safety objective.
- Threshold, margin, gates, dataset, and configuration hashes are recorded.
- Remote settings remain unchanged until Phase 5 shadow approval.

### Rollback

The policy remains versioned and disabled by default until shadow approval. The previous 90/12 configuration snapshot remains available as the immediate configuration rollback.

### Phase 4 implementation status

The offline policy framework was implemented locally on 2026-08-30. It evaluates 392 combinations of calibrated probability threshold, ranking margin, Matcher/Validator agreement, Judge behavior, and hard-conflict blocking. It reports per-label outcomes, safe coverage, abstention, latency, provider cost, and tokens, then selects on the validation split and verifies without tuning on the held-out acceptance split.

Runtime gates now require a valid calibrated probability and split `aiCompleted` into `requiredRolesCompleted` and `matcherValidatorAgreement`. The calibration feature version advanced to v2, preventing silent reuse of the old combined-gate artifact.

The actual 30-case run selected no policy. It is blocked by `calibration_feature_version_mismatch` and `calibration_artifact_not_ready`; `readyForShadow` and `readyForProduction` are both false. The checkpoint is recorded in `BIDoc_Schedule_Activity_Assignment_Calibration_Phase_4_Automatic_Decision_Policy_Checkpoint_2026-08-30.md`.

Phase 4 acceptance remains blocked until the Phase 3.1 collection path is activated, at least 70 additional representative cases cover every missing label class, a compatible calibrator passes held-out review, and the policy acceptance set observes zero false automatic assignments with non-zero safe coverage.

## 11. Phase 5 - Review UI and audit terminology

### Objective

Make scores, calibrated confidence, alternatives, and review reasons understandable without overstating certainty.

### 11.1 Before calibration readiness

- Replace `confidence` wording with `match score` for raw `finalScore` values.
- Display runner-up separation as score points.
- Show the reason human review is required.
- Preserve the two candidate buttons and `none of these` action.
- Do not normalize the two displayed candidates to 100%.

### 11.2 After calibration readiness

- Display calibrated confidence for the leading candidate.
- Keep runner-up fit and separation visible as different values.
- Show whether review was caused by low confidence, small margin, role disagreement, hard conflict, stale version, or incomplete role execution.
- Preserve Hebrew RTL and shared-team review behavior.

### 11.3 Audit snapshot

Persist enough diagnostic information to reproduce the decision without exposing secrets or unbounded prompt content:

- Engine/settings/calibrator versions.
- Candidate stage and feature summaries.
- Calibrated probability and raw ranking score.
- Threshold and margin snapshots.
- Gate results.
- Role decisions and bounded reasons.
- Final reviewer action when available.

### Phase 5 acceptance gate

- Uncalibrated scores are not labelled as probabilities.
- Human reviewers can identify why automation did not occur.
- Existing shared review selection and rejection remain functional.
- React build and focused UI tests pass.
- UI publication or deployment requires separate approval.

### Rollback

Keep API compatibility aliases during the UI transition. The previous rendering can be restored without changing Schedule links or review records.

## 12. Phase 6 - Shadow-mode validation

### Objective

Measure the proposed calibrated policy against new human decisions without allowing automatic writes.

### Implementation

1. Run the selected retrieval, ranking, calibration, and policy path in `commit:false` mode.
2. Record `wouldAutoAssign` separately from any actual assignment.
3. Continue requiring a human selection or rejection.
4. Compare every shadow decision with the final human outcome.
5. Monitor score drift, retrieval misses, false eligibility, latency, role failures, and class distribution.
6. Freeze a shadow acceptance report before any production-write request.

### Phase 6 acceptance gate

- No automatic Schedule link is written.
- Zero observed false automatic eligibility on the frozen holdout and accepted shadow sample.
- Retrieval and probability distributions remain stable across representative activity types.
- Manual override and rejection remain available.
- A rollback configuration and disable switch are verified.
- Explicit approval is received before Phase 7.

## 13. Phase 7 - Controlled automatic-assignment rollout

### Objective

Enable automatic assignment gradually with immediate rollback and full auditability.

### Controlled rollout

1. Publish the approved versioned configuration.
2. Enable automatic writes for a small controlled scope or share.
3. Preserve all safety gates and human override.
4. Monitor every automatic assignment and later reviewer correction.
5. Stop automatic writes immediately after a false assignment, incompatible calibrator, unexpected score drift, or material role failure increase.
6. Expand only after a separate evidence review and approval.

### Phase 7 acceptance gate

- Published configuration matches the approved hashes and values.
- Actual links are written only through the existing server-owned atomic assignment RPC.
- No browser-controlled activity key bypass is introduced.
- Automatic decisions remain traceable to candidates, evidence, configuration, and policy.
- Rollback has been tested before scope expansion.

### Rollback

- Disable `autoAssignmentEnabled`.
- Restore the previous approved configuration snapshot.
- Preserve already written assignment audit history.
- Do not delete or silently rewrite assignment links. Corrections remain reviewed actions.

## 14. Phase 8 - Monitoring and recurring recalibration

### Objective

Prevent calibration drift as alerts, activities, Schedule versions, models, prompts, or feature behavior change.

### Ongoing evidence

- Add reviewed selections and rejections to versioned evaluation datasets.
- Track confirmed correctness, correction rate, false automatic assignments, abstention, and candidate recall.
- Track confidence reliability by range and activity category.
- Compare active Schedule versions and new activity vocabularies.
- Re-run the frozen evaluator after any model, prompt, embedding, feature, weight, or policy change.
- Require a new approval before publishing a new calibrator, threshold, or margin.

### Recalibration triggers

- Any confirmed false automatic assignment.
- Material decline in candidate recall.
- Material confidence-distribution shift.
- New model or embedding model.
- Prompt or structured-output contract change.
- Feature or weight change.
- Significant active Schedule restructuring.
- Meaningful accumulation of new reviewed labels.

## 15. Phase deliverables and approval matrix

| Phase | Main deliverable | Production behavior change | Remote write | Approval required to proceed |
| --- | --- | --- | --- | --- |
| 0 | Baseline and implementation plan | No | No | Approve Phase 1 |
| 1 | Complete read-only labelled evaluator | No | No | Approve Phase 2 |
| 2 | Full-set hybrid candidate retrieval | No automatic policy change | No | Approve Phase 3 |
| 3 | Versioned calibrated probability | No automatic policy change | No | Approve Phase 4 |
| 4 | Evidence-selected policy | Disabled/shadow only | No | Approve Phase 5/6 |
| 5 | Correct UI and audit terminology | UI only when separately deployed | Deployment only with approval | Approve shadow |
| 6 | Shadow validation report | No automatic write | Read/audit only as approved | Approve rollout |
| 7 | Controlled automatic assignment | Yes, bounded | Yes | Approve expansion |
| 8 | Monitoring and recalibration | Controlled | As approved | Recurring review |

## 16. Verification strategy

### Every implementation phase

- Inspect `git status --short` before edits.
- Preserve unrelated dirty work.
- Add focused deterministic tests.
- Run `npm.cmd run test:schedule`.
- Run `git diff --check`.
- Record exact pass/fail counts and known limitations.
- Create a phase checkpoint before requesting the next approval.

### Phases involving live reads

- Use service-role-only backend access.
- Print no keys or secrets.
- Freeze the data cutoff and active Schedule version.
- Prove zero business-data writes.

### Phases involving remote settings or writes

- Capture a rollback snapshot first.
- Compare every changed settings section.
- Apply only the explicitly approved section.
- Reload and verify the persisted snapshot.
- Run an authenticated end-to-end smoke check of the exact Schedule path.

## 17. Canonical implementation surfaces

| Concern | Current source |
| --- | --- |
| Candidate scores and decision gates | `src/scheduleActivityAssignmentEngine.js` |
| Runtime roles and candidate stages | `src/subagents/scheduleActivityAssignmentAgent.js` |
| Evaluation manifests and metrics | `src/scheduleActivityAssignmentEvaluation.js` |
| Evaluation CLI | `scripts/run-schedule-activity-assignment-evaluation.mjs` |
| Probability calibration | `src/scheduleActivityAssignmentCalibration.js`, `scripts/run-schedule-activity-assignment-calibration.mjs` |
| Automatic policy calibration | `src/scheduleActivityAssignmentPolicy.js`, `scripts/run-schedule-activity-assignment-policy-calibration.mjs` |
| Prompt and model contracts | `src/scheduleActivityAssignmentPromptPack.js` |
| Workflow/audit rendering | `src/scheduleActivityAssignmentWorkflow.js` |
| Current and restored Schedule alert reads | `src/subagents/schedule.js`, `src/supabase.js` |
| Shared review persistence | `src/subagents/scheduleActivityAssignmentReviewQueue.js` |
| Schedule review UI | `src/react/SchedulePage.jsx`, `src/react/activityAssignmentBatch.js` |
| Settings UI | `src/react/SettingsPage.jsx` |
| Focused verification | `test/schedule-engine.test.js` |

## 18. Immediate next action

Phase 4 tooling is complete, but policy selection remains evidence-blocked. The immediate next action is the separately gated Phase 3.1 activation and evidence collection sequence:

1. Completed: review, approve, apply, and verify the additive MAIN label migration.
2. Completed: commit, push, automatic deployment, and authenticated production verification of the label-collection path.
3. Completed locally, deployment verification pending: bound grouped collection to 10, 25, or 50 review-only rows and clarify assignment provenance.
4. Next: review the four pending cases and collect at least 70 additional representative cases across all missing label classes.
5. Freeze and review the expanded dataset.
6. Rerun evaluation, compatible v2 calibration, and the Phase 4 policy acceptance sweep.
7. Stop before Phase 5 unless a disabled policy is genuinely `readyForShadow` and receives separate approval.
