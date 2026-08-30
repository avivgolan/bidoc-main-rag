# Schedule Activity Assignment Calibration. Phase 3 Score and Probability Checkpoint

Date: 2026-08-30

Status: Phase 3 implemented and evaluated locally. The calibration artifact is blocked from production. Phase 4 has not started.
Decision: keep the ranking score as a non-probability match score, expose calibrated probability only when a compatible artifact passes the evidence gate, and collect a larger reviewed dataset before calibrating automatic-decision thresholds.

## 1. Outcome

Phase 3 now separates three concepts that were previously conflated:

| Field | Meaning | Scale | Runtime use |
|---|---|---:|---|
| `rankingScore` | Weighted candidate-ranking score | 0 to 100 | Ranking and existing conservative gates |
| `rankingGap` | Difference between first and second ranked candidates | score points | Existing conservative margin gate |
| `calibratedProbability` | Empirical probability that the selected activity is correct | 0 to 1 or `null` | Display and future policy only after artifact approval |

The compatibility aliases `confidence`, `runnerUpConfidence`, and `margin` remain in the API and database audit boundary so existing consumers do not break. They contain the ranking values and are not presented as calibrated percentages.

No production calibration artifact was loaded. No threshold, margin, prompt, model, weight, remote setting, database row, deployment, or automatic-write behavior was changed.

## 2. Delivered implementation

### 2.1 Offline calibration module

`src/scheduleActivityAssignmentCalibration.js` provides:

- Deterministic class-stratified 60/20/20 train, validation, and held-out test splits.
- A raw ranking-score control.
- One-dimensional Platt scaling.
- Isotonic regression with a minimum stability gate.
- Brier score, log loss, expected calibration error, and five reliability bins.
- Validation-only model selection followed by untouched held-out test reporting.
- A versioned artifact with immutable split case IDs, evidence counts, method comparisons, compatibility context, and an artifact hash.
- Safe application that returns `null` instead of a probability when the artifact is missing, not ready, stale, incompatible, or only selects the raw control.

The artifact compatibility context includes the artifact and feature versions, assignment engine, active Schedule version, settings version, configuration snapshot ID, frozen fixture hash, and retrieval configuration.

### 2.2 Evidence gate

An artifact cannot be marked ready unless it has at least:

- 100 reviewed cases.
- 20 correct selections.
- 20 incorrect selections.
- Evidence for `confirmed_match`, `rejected_match`, `no_match`, `stale_activity`, `irrelevant_alert`, and `ambiguous`.
- A stable calibrated method that beats the raw control selection rule on validation.

These are minimum software gates, not a guarantee that the dataset is representative. Product review remains required before Phase 4.

### 2.3 Runtime and UI contract

The explicit fields now flow through the assignment engine, assignment-agent result and workflow log, read-only evaluation report, shared team-review snapshot, Schedule review card, and Settings laboratory result.

The Hebrew UI now labels the raw value as `ציון התאמה` without a percent sign. It displays `הסתברות מכוילת` with a percent sign only when a compatible and approved calibrator actually returns a probability.

The active automatic-assignment policy still uses the same raw threshold and raw runner-up margin behind all existing safety gates. Phase 3 did not authorize changing that policy.

## 3. Valid full hybrid-20 evaluation

The approved Phase 2 configuration was evaluated against the complete frozen set with real model calls and no persistence:

| Property | Result |
|---|---|
| Cases | 30 |
| Confirmed reviewed links | 28 |
| Reviewed rejected choices | 2 |
| Retrieval strategy | Hybrid union. 14 deterministic plus 6 semantic slots |
| Matcher and Validator pool | 20 candidates |
| Active Schedule version | `1787251318726_MS_Project.xml` |
| Engine | `schedule-assignment.v2.1-rc1` |
| Role failures | 0 |
| Structured-output failures | 0 |
| Automatic assignments | 0 |
| Database persistence | Disabled |

### 3.1 Retrieval and ranking results

| Metric | Result |
|---|---:|
| Retrieval expected activity in set | 100.00% |
| Final expected activity in set | 100.00% |
| Final recall at 5 | 89.29% |
| Final recall at 1 | 50.00% |
| Correct selected activity | 14 of 30 |
| Incorrect selected activity or negative case | 16 of 30 |
| Abstention | 30 of 30 |
| False automatic assignments | 0 |
| Average latency | 18.128 seconds |
| p95 latency | 23.231 seconds |
| Embedding calls | 132 |
| Cache hits | 2,958 |

Hybrid retrieval fixed the candidate-exclusion problem for this set. It did not fix the ranking or calibration problem. The top candidate was correct in only half of all cases.

### 3.2 Reproduction of the CTO concern

| Label group | Mean ranking score | Median ranking score | Mean ranking gap |
|---|---:|---:|---:|
| Confirmed reviewed links | 57.81 | 57.72 | 6.23 |
| Reviewed rejected choices | 57.81 | 56.71 | 4.18 |

The confirmed and rejected groups have the same mean raw score. This is direct evidence that the displayed 40 to 60 style values are match-ranking scores, not calibrated probabilities.

## 4. Calibration comparison

The frozen 30 cases produced 17 training cases, 5 validation cases, and 8 untouched test cases. Fourteen selections were correct and sixteen were incorrect.

| Method | Eligible for selection | Validation Brier | Validation ECE | Test Brier | Test ECE | Test log loss |
|---|---|---:|---:|---:|---:|---:|
| Raw-score control | Yes | 0.254425 | 0.283620 | 0.263468 | 0.085500 | 0.720641 |
| Platt | Yes. selected on validation | 0.231831 | 0.186288 | 0.265632 | 0.099930 | 0.725481 |
| Isotonic | No. insufficient training support | 0.187556 | 0.146667 | 0.258333 | 0.125000 | 0.710008 |

Platt scaling won the validation comparison, but it was slightly worse than the raw control on all three held-out test metrics. Isotonic was not eligible because the training split was too small for the configured stability gate.

The selected Platt model placed seven of eight held-out cases in the 0.4 to 0.6 reliability bin. This is consistent with the weak separation in the raw evidence and does not support an automatic-decision threshold.

## 5. Production readiness assessment

The generated artifact is `schedule-assignment-calibrator:99d4ad234235ea9237cfd70a7c147e11e57b396be595c15f92a9354abb60dfd0` and is explicitly `readyForProduction: false`.

Blocking reasons:

- Only 30 cases are available, below the 100-case minimum.
- Only 14 correct selections are available, below the 20-case minimum.
- Only 16 incorrect selections are available, below the 20-case minimum.
- The dataset contains no reviewed `no_match`, `stale_activity`, `irrelevant_alert`, or `ambiguous` cases.
- The selected calibrator did not improve held-out performance over the raw control.

Because the artifact is not ready, runtime application returns `calibratedProbability: null` with status `not_ready`. The UI therefore continues to display only the non-probability match score.

## 6. Phase 3 acceptance assessment

| Acceptance condition | Result |
|---|---|
| Ranking score and calibrated probability are separate fields | Passed |
| Held-out comparison and reliability bins exist | Passed |
| `no_match` remains independent of probability | Passed. Existing decision logic is unchanged |
| Artifact is versioned and bound to runtime context | Passed |
| Missing or stale artifact safely falls back to review | Passed |
| Current evidence authorizes a production probability | Failed by design |
| Calibration choice can proceed to Phase 4 | Blocked pending more representative reviewed evidence |

## 7. Required evidence before Phase 4

1. Grow the reviewed set to at least 100 representative cases.
2. Include at least 20 correct and 20 incorrect top selections.
3. Add reviewed negative examples across `no_match`, stale activity, irrelevant alert, ambiguous evidence, and rejected match.
4. Re-run the frozen hybrid-20 evaluator without persistence.
5. Fit all eligible methods on the deterministic split.
6. Require the chosen method to improve held-out Brier score and calibration error without degrading safety-critical negative behavior.
7. Review the artifact and reliability bins before any threshold or runner-up margin sweep is allowed to affect runtime policy.

## 8. Verification

- `npm.cmd run test:schedule`: 102 tests passed.
- `npm.cmd run react:build`: passed.
- JavaScript syntax checks: passed.
- Full 30-case hybrid-20 model evaluation: completed with zero role failures and zero persistence.
- Calibration CLI: completed and generated a blocked local artifact.
- `git diff --check`: passed.

The evaluation report and calibration artifact are local ignored files under `data/schedule-assignment-evaluations/`. No deployment, commit, push, database write, production setting change, or automatic Schedule link was performed.
