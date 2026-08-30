# Schedule Activity Assignment Calibration. Phase 4 Automatic Decision Policy Checkpoint

Date: 2026-08-30

Status: the Phase 4 policy-evaluation framework is implemented and verified locally. Policy selection is blocked by the evidence gate. No policy is active, Phase 5 has not started, and the Phase 3.1 MAIN migration is applied and verified.

## 1. Outcome

Phase 4 can now evaluate calibrated probability thresholds, runner-up margins, role agreement, Judge outcomes, and hard-conflict blocking on deterministic validation and acceptance splits. It produces a versioned policy artifact, but it cannot select or activate a policy unless the calibration artifact is compatible and production-ready and the held-out acceptance set observes zero false automatic assignments with non-zero safe coverage.

The current 30-case evidence does not pass that gate. The actual Phase 3 report and calibrator produced a blocked policy artifact with no selected policy.

## 2. Delivered implementation

### 2.1 Calibrated policy sweep

`src/scheduleActivityAssignmentPolicy.js` adds a pure Phase 4 evaluator with:

- Calibrated probability thresholds: 50%, 60%, 70%, 80%, 85%, 90%, and 95%.
- Runner-up ranking margins: 1, 3, 5, 10, 12, 15, and 20 points.
- Matcher/Validator agreement required or not required.
- Judge-match-when-run required or not required.
- Hard-conflict blocking enabled or disabled for diagnosis.
- Mandatory recommendation safety that requires role agreement and hard-conflict blocking.
- Per-label outcomes, correct and false automatic assignments, safe coverage, abstention, probability and margin distributions, latency, provider cost, and token reporting.

The default grid evaluates 392 configurations.

### 2.2 Validation and acceptance selection

Policy selection uses the calibrator's deterministic validation split. A selected operating point is then evaluated without tuning on the held-out test split.

Selection requires:

- Zero false automatic assignments in the selection split.
- At least one correct automatic assignment.
- Mandatory Matcher/Validator agreement.
- Mandatory hard-conflict blocking.
- Maximum safe coverage only after the safety conditions pass.

The acceptance split must also contain zero false automatic assignments and non-zero safe automatic coverage.

### 2.3 Versioned disabled artifact

The Phase 4 artifact records:

- Policy and feature versions.
- Calibrator artifact and feature versions.
- Engine, Schedule, settings, and configuration snapshot identity.
- Dataset and policy-configuration hashes.
- Selection and acceptance case IDs.
- The full configuration sweep.
- Diagnostic best policy, selected policy, acceptance metrics, and readiness reasons.
- The prior 90/12 configuration as the disabled rollback snapshot.

`readyForProduction` is always `false` in Phase 4. A policy that passes the evidence gates can become `readyForShadow`, but it remains disabled until separate Phase 5 and Phase 6 approval.

### 2.4 Runtime fail-closed gates

The assignment runtime no longer treats a raw ranking score as calibrated confidence. Automatic assignment now requires a compatible, production-ready calibrator that emits a real calibrated probability above the configured threshold.

The overloaded `aiCompleted` gate is split into:

- `requiredRolesCompleted`
- `matcherValidatorAgreement`

A high raw score without a valid calibrator now fails the `calibratedThreshold` gate and cannot authorize an automatic assignment.

The calibration feature contract moved to `schedule-assignment-calibration-features.v2` so artifacts created from the previous combined gate cannot be reused silently.

### 2.5 CLI and evaluation telemetry

`npm.cmd run schedule:assignment:policy-calibrate` builds the local Phase 4 artifact from an evaluation report and a calibration artifact.

Evaluation rows now retain Matcher/Validator agreement, required-role completion, Judge outcome, hard-conflict status, provider cost, total tokens, and latency for Phase 4 reporting.

## 3. Actual 30-case Phase 4 run

Inputs:

- `data/schedule-assignment-evaluations/phase3-hybrid-20-full-report.json`
- `data/schedule-assignment-evaluations/phase3-hybrid-20-calibrator.json`

Output:

- `data/schedule-assignment-evaluations/phase4-policy-blocked.json`
- Artifact ID: `schedule-assignment-policy:f69b6eeba30d81c44c02bb73369389befb1d2ed852a207741d121e88efd4c261`

Observed result:

| Measure | Result |
| --- | --- |
| Total reviewed cases | 30 |
| Policy-selection cases | 5 |
| Held-out acceptance cases | 8 |
| Configurations evaluated | 392 |
| Selected policy | None |
| Acceptance metrics | Not run because no policy was selectable |
| Ready for shadow | No |
| Ready for production | No |

Readiness blockers:

- `calibration_feature_version_mismatch`
- `calibration_artifact_not_ready`

The diagnostic-only best configuration was 50% probability, 15 ranking points, required Matcher/Validator agreement, required Judge match when Judge ran, and hard-conflict blocking. It covered only one of five selection cases. All five selection cases were confirmed matches, so this is not representative negative-class evidence and is not a policy recommendation.

## 4. Phase 4 acceptance assessment

| Acceptance requirement | Result |
| --- | --- |
| Zero false automatic assignments on the held-out acceptance set | Not evaluable without a selectable policy |
| No automatic decision from the small baseline | Passed |
| Safe coverage maximized only after the safety objective | Implemented, but evidence-blocked |
| Threshold, margin, gates, dataset, and configuration hashes recorded | Passed |
| Remote settings unchanged | Passed |
| Phase 4 policy accepted for shadow | Blocked |

## 5. Supabase and security boundary

No new schema was required for Phase 4. The existing Phase 3.1 migration remains local and unapplied. No Supabase table, function, grant, policy, or row changed.

The current Supabase guidance was rechecked before implementation. The existing migration's `SECURITY INVOKER` and explicit function-execution revocation model remains the required boundary. Phase 4 did not weaken or bypass it.

## 6. Verification

- Schedule tests: 110/110 passed.
- Calibrated-threshold fail-closed regression passed.
- Explicit required-role and Matcher/Validator gate regressions passed.
- Calibrated sweep, Judge outcome, hard-conflict, cost, token, and latency regressions passed.
- Validation-selection and held-out acceptance artifact regression passed.
- Actual blocked 392-configuration run completed successfully.
- React production build passed with 24 modules transformed.
- JavaScript syntax checks passed for 13 changed entry points.
- `git diff --check` passed with only Windows line-ending normalization warnings.

No migration apply, database write, deployment, commit, push, remote-setting change, policy activation, automatic link, or Phase 5 implementation occurred.

## 7. Next evidence gate

Phase 4 cannot select a real operating point until Phase 3.1 collection is activated and the reviewed dataset is expanded.

The next bounded sequence is:

1. Review and separately approve the additive Phase 3.1 MAIN migration.
2. Apply the migration and deploy the authenticated label-collection path only after that approval.
3. Collect at least 70 additional representative reviewed cases, including every missing negative and ambiguous label class.
4. Freeze a new dataset and rerun evaluation.
5. Build a compatible `schedule-assignment-calibration-features.v2` calibrator.
6. Rerun the Phase 4 policy sweep and held-out acceptance check.
7. Stop before Phase 5 unless a policy becomes `readyForShadow` and receives separate approval.
