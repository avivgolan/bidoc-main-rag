# Schedule Activity Assignment Calibration. Phase 4 Expanded Evidence and Shadow Readiness Checkpoint

Date: 2026-08-31

Status: Phase 4 acceptance passed. The selected policy is versioned, disabled, `readyForShadow`, and not ready for production. Phase 5 has not started.

## 1. Outcome

The reviewed evidence target was reached and the complete frozen dataset was evaluated without persistence. A compatible Platt calibrator improved held-out calibration over the uncalibrated score. The 392-configuration policy sweep selected a conservative operating point that produced zero false automatic assignments and non-zero safe coverage on both policy-selection and untouched acceptance splits.

No policy was published or enabled. No Schedule link, remote setting, prompt, model, threshold, or margin was changed.

## 2. Frozen evidence

Dataset cutoff: `2026-08-31T10:21:53.461Z`

Active Schedule version: `1787251318726_MS_Project.xml`

Dataset artifact: `data/schedule-assignment-evaluations/phase3-1-reviewed-100-labels-dataset-2026-08-31.json`

| Label | Cases |
| --- | ---: |
| `confirmed_match` | 119 |
| `rejected_match` | 2 |
| `no_match` | 23 |
| `irrelevant_alert` | 2 |
| `ambiguous` | 2 |
| `stale_activity` | 0 |
| Total | 148 |

The shared review queue contained 100 explicit labels. Canonical reviewed links took precedence over duplicate shared labels, and 148 conflict-safe cases remained usable.

### 2.1 Stale-history coverage correction

`stale_activity` is not a reviewer-selectable outcome. It is derived only when an existing reviewed link points to an activity absent from the active Schedule. This project has no such recoverable link, so the former requirement that every dataset contain that subtype could not be satisfied through additional UI review.

The coverage contract now:

- Continues reporting `stale_activity` as missing diagnostic evidence.
- Continues treating any observed `stale_activity` row as a negative calibration case.
- Requires all reviewer-selectable outcome classes.
- Retains the 100-case minimum and the separate minimum counts for correct and incorrect outcomes.
- Advances the calibration artifact version to `schedule-assignment-calibrator.v2`, preventing silent reuse of artifacts built under the older readiness contract.

This changes evidence readiness only. It does not relax runtime agreement, conflict, probability, margin, or automatic-write gates.

## 3. Full hybrid evaluation

Report artifact: `data/schedule-assignment-evaluations/phase4-expanded-hybrid-20-report-2026-08-31.json`

Runtime identity:

- Engine: `schedule-assignment.v2.1-rc1`
- Settings: `schedule-assignment-openai.v2.1-rc1`
- Retrieval: full-set `hybrid_union`, 20 model candidates
- Persistence: disabled

| Metric | Result |
| --- | ---: |
| Evaluated cases | 148 |
| Confirmed-match cases | 119 |
| Negative review cases | 29 |
| Final candidate recall at 1 | 55.46% |
| Final candidate recall at 5 | 84.03% |
| Final candidate present in bounded set | 94.12% |
| Role failures | 0 |
| Structured-output failures | 0 |
| Total model calls | 784 |
| Average latency | 19.14 seconds |
| P95 latency | 29.18 seconds |

The raw ranking score still overlaps substantially between confirmed and non-confirmed cases. Confirmed matches had a mean ranking score of 60.92, while non-confirmed cases averaged 57.11. This confirms that the original score cannot be interpreted as a probability or used alone for automatic assignment.

The 55.46% top-1 recall is also an explicit limitation. Probability calibration can quantify final-selection correctness, but it cannot repair a reviewed activity that was missing or ranked poorly. Retrieval and role-agreement gates therefore remain required.

## 4. Calibrator result

Calibrator artifact: `data/schedule-assignment-evaluations/phase4-expanded-calibrator-v2-2026-08-31.json`

Artifact ID: `schedule-assignment-calibrator:e14941848ae46effce000f6de175d218839a3f76868b83487b2ae07bd69e2964`

Selected method: Platt calibration

Calibration target:

- Correct final selections: 64
- Incorrect selections or abstention-required outcomes: 84

| Held-out metric | Raw score control | Platt |
| --- | ---: | ---: |
| Validation Brier score | 0.245567 | 0.211195 |
| Validation expected calibration error | 0.167675 | 0.117734 |
| Test Brier score | 0.259959 | 0.226105 |
| Test expected calibration error | 0.189212 | 0.033494 |

The Platt artifact passed the case-count, positive-count, negative-count, label-coverage, stability, and held-out-improvement gates. Its readiness reasons are empty.

## 5. Policy sweep and acceptance

Policy artifact: `data/schedule-assignment-evaluations/phase4-expanded-policy-sweep-2026-08-31.json`

Artifact ID: `schedule-assignment-policy:8adc1afe588b500c3b372fd70c98aba0f31f632221cb9220fe111f3cc49d9c67`

Configurations evaluated: 392

Selected disabled policy:

- Calibrated probability threshold: 50%
- Minimum runner-up ranking margin: 12 points
- Matcher/Validator agreement: required
- Judge match when Judge ran: required
- Hard-conflict blocking: required
- Enabled: false

| Split | Cases | Eligible | Correct automatic | False automatic | Safe coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Policy selection | 28 | 5 | 5 | 0 | 17.86% |
| Untouched acceptance | 32 | 4 | 4 | 0 | 12.50% |

The acceptance split contained 26 confirmed matches and 6 explicit `no_match` cases. None of the `no_match` cases became eligible for automatic assignment.

The artifact is `readyForShadow: true` and `readyForProduction: false`. The 50% threshold must not be read in isolation. An automatic decision was eligible only when the separate 12-point margin, role-agreement, Judge, and hard-conflict gates also passed.

## 6. Verification

- `npm.cmd run test:schedule`: 116 tests passed.
- JavaScript syntax checks passed for the changed label, calibration, and evaluation modules.
- Full 148-case evaluation completed with zero role failures and zero structured-output failures.
- Compatible v2 calibrator completed with no readiness blockers.
- The 392-configuration policy sweep completed and passed held-out shadow readiness.
- `git diff --check` passed with Windows line-ending normalization warnings only.

## 7. Safety boundary and next gate

This checkpoint does not authorize automatic assignment.

Current state:

- The selected policy is disabled.
- Remote settings are unchanged.
- No production policy or calibrator is published.
- No database or Schedule link was written by the evaluation.
- Phase 5 has not started.

The next step requires separate approval for Phase 5 terminology and audit work. Phase 6 shadow validation must remain non-writing and should collect fresh live outcomes before any controlled automatic-assignment rollout is considered.
