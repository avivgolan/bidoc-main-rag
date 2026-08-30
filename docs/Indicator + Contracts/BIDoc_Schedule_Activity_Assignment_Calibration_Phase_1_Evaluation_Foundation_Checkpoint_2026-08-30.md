# Schedule Activity Assignment Calibration. Phase 1 Evaluation Foundation Checkpoint

Date: 2026-08-30

Status: Phase 1 completed and verified. Phase 2 has not started.
Decision: do not change the production threshold, margin, prompts, model, weights, or automatic-write behavior from this evidence.

## 1. Outcome

Phase 1 delivered a complete, read-only evaluation foundation for the currently reviewed Schedule assignment evidence.

- All 28 confirmed activity links were included.
- Both reviewed rejected choices were included.
- Six source alerts came from the current `alerts` table.
- Twenty-four explicitly linked alerts were recovered through the approved legacy read path from `alerts_backup_dedupe_20260822`.
- No unlinked alert was recovered from backup.
- No case was excluded.
- No production data, reviewed link, remote setting, prompt, model, threshold, margin, deployment, or automatic-write behavior was changed.

The full baseline demonstrates that the current displayed percentage is an uncalibrated ranking score. It is not safe to select a production threshold from it.

## 2. Delivered implementation

### 2.1 Canonical evaluation-source recovery

`src/subagents/schedule.js` now exposes a read-only evaluation loader that:

1. Reads current alert timeline events.
2. Identifies only explicitly requested linked IDs that are missing from the current table.
3. Reads those missing linked IDs from the existing legacy backup path.
4. Merges current and recovered events through the canonical Schedule timeline event shape.
5. Records source provenance and explicit exclusions.

Rejected or current-only IDs cannot silently fall back to backup unless they are explicitly present in the requested linked set.

### 2.2 Reproducible dataset preparation

`scripts/run-schedule-activity-assignment-evaluation.mjs` now:

- Uses the active remote Schedule settings for production-style read-only evaluation by default.
- Supports `--code-defaults` for an explicit local-default comparison.
- Recovers eligible linked sources once per dataset build.
- Freezes the active Schedule version, tasks, labels, record origin, assignment method, recovery counts, exclusions, and settings source.
- Produces `schedule-assignment-dataset.v2` and `schedule-assignment-evaluation-report.v2` artifacts.

### 2.3 Full diagnostic report

`src/scheduleActivityAssignmentEvaluation.js` now records:

- Recall at rank 1, rank 5, presence in the bounded candidate set, and exact rank.
- Per-stage candidate evidence for deterministic, semantic, model, and final ranking stages.
- All returned candidates and compact role outcomes.
- Score and margin distributions by label.
- Failed decision-gate counts.
- Model-call, role-failure, latency, and provenance diagnostics.
- A 96-cell raw-score threshold and margin sweep.

The sweep deliberately holds the other runtime gates fixed. It is diagnostic only and cannot authorize a production policy because the input score is not calibrated.

## 3. Frozen evaluation manifest

| Field | Value |
|---|---:|
| Project | `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5` |
| Data cutoff | `2026-08-30T23:59:59.999Z` |
| Active Schedule version | `1787251318726_MS_Project.xml` |
| Schedule activities | 102 |
| Evaluation cases | 30 |
| Confirmed matches | 28 |
| Rejected choices | 2 |
| Current alert records | 6 |
| Recovered linked legacy records | 24 |
| Excluded cases | 0 |
| Engine version | `schedule-assignment.v2.0-rc1` |
| Configuration version | `schedule-assignment-openai.v2.1-rc1` |
| Configuration snapshot | `schedule-assignment-config:9f2fb7c98d4faae092c69927b92b0e1dcbcb4bd318344f08b7b9557d91d7b4d0` |
| Fixture hash | `sha256:3debc78f6c440ee86140c4c44369e69aa503baee52aa4fb30c3062fc4d82a2b2` |

The generated dataset and report are local evaluation artifacts under `data/schedule-assignment-evaluations/`. They are ignored by Git and contain source evidence, so they are not added to the repository.

## 4. Full 30-case baseline

### 4.1 Retrieval and ranking

| Metric | Result |
|---|---:|
| Final recall at rank 1 | 17/28, 60.71% |
| Final recall at rank 5 | 23/28, 82.14% |
| Correct activity present in final bounded set | 25/28, 89.29% |
| Deterministic recall at rank 5 | 23/28, 82.14% |
| Semantic recall at rank 5 | 22/28, 78.57% |
| Average returned candidate count | 8 |

Three confirmed activities never reached the final bounded set. Two additional confirmed activities were present but ranked below the top five. Threshold calibration cannot fix these five retrieval and ranking failures.

| Source alert | Expected activity | Final result | Raw score | Margin | Decision |
|---|---|---|---:|---:|---|
| `1474` | activity `92` | absent from bounded set; selected `9` | 66.30 | 20.17 | match |
| `2713` | activity `49` | absent from bounded set; selected `10` | 65.09 | 8.22 | match |
| `5689` | activity `15` | absent from bounded set; selected `20` | 55.67 | 2.35 | ambiguous |
| `2734` | activity `10` | final rank 10; selected `16` | 51.99 | 0.09 | ambiguous |
| `2791` | activity `10` | final rank 14; selected `5` | 52.20 | 2.25 | conflict |

### 4.2 Decision behavior

| Metric | Result |
|---|---:|
| Current-policy correct automatic assignments | 0 |
| Current-policy false automatic assignments | 0 |
| Current-policy abstentions | 30/30, 100% |
| Confirmed decisions: match | 11 |
| Confirmed decisions: conflict | 10 |
| Confirmed decisions: ambiguous | 6 |
| Confirmed decisions: no match | 1 |
| Rejected decisions | 1 conflict, 1 ambiguous |

The current threshold of 90 and margin of 12 are conservative enough to prevent writes in this dataset, but they also produce no automatic coverage.

### 4.3 Score calibration finding

| Distribution | Confirmed matches | Rejected choices |
|---|---:|---:|
| Minimum raw score | 41.53 | 58.16 |
| Median raw score | 57.55 | not meaningful with two cases |
| Maximum raw score | 71.20 | 59.13 |
| Mean raw score | 58.78 | 58.64 |

The confirmed and rejected means differ by only 0.14 points. A rejected choice can score higher than many confirmed matches. The raw score therefore does not currently represent an empirical probability of correctness.

Confirmed margins also do not provide clean separation. Their median is 2.59, while the two rejected examples average 3.10.

### 4.4 Threshold and margin sweep

Selected diagnostic cells from the 96-cell sweep:

| Raw threshold | Minimum margin | Eligible automatic decisions | Correct | False | Coverage | False rate among eligible |
|---:|---:|---:|---:|---:|---:|---:|
| 90 | 12 | 0 | 0 | 0 | 0.00% | n/a |
| 70 | 12 | 1 | 1 | 0 | 3.33% | 0.00% |
| 65 | 12 | 6 | 5 | 1 | 20.00% | 16.67% |
| 60 | 5 | 8 | 6 | 2 | 26.67% | 25.00% |
| 50 | 5 | 9 | 6 | 3 | 30.00% | 33.33% |
| 40 | 0 | 11 | 8 | 3 | 36.67% | 27.27% |

The only tested raw-score policy with zero observed false assignments and non-zero coverage is centered on threshold 70, but it covers only one case. Two negative labels are far too few to treat that observation as a safe production result.

Three incorrect selections already passed the non-threshold runtime gates, including the Matcher and Validator agreement path:

| Source alert | Expected | Selected | Raw score | Margin |
|---|---:|---:|---:|---:|
| `1474` | 92 | 9 | 66.30 | 20.17 |
| `2713` | 49 | 10 | 65.09 | 8.22 |
| `4656` | 28 | 7 | 57.72 | 7.69 |

This means that lowering only the threshold or margin would convert known wrong recommendations into automatic assignments.

### 4.5 Runtime diagnostics

| Metric | Result |
|---|---:|
| Total model calls | 377 |
| Chat-model calls | 107 |
| Embedding calls | 270 |
| Average case latency | 18.254 seconds |
| P95 case latency | 23.149 seconds |
| Role failures | 1 |
| Structured JSON failures | 0 |

The single role failure was an embedding `fetch failed` error for source alert `2793`. The evaluator retained the failure in the report instead of hiding it.

## 5. Phase 1 acceptance

| Acceptance condition | Result |
|---|---|
| All reviewed positive links are present or explicitly excluded | Passed. 28/28 present, 0 excluded |
| Reviewed rejected examples are included | Passed. 2/2 included |
| Recovered data uses the canonical read-only path | Passed |
| Labels are not injected as runtime ranking signals | Passed by dataset and evaluator separation |
| Report freezes configuration and provenance | Passed |
| Candidate-stage, role, score, margin, gate, and sweep diagnostics exist | Passed |
| Focused Schedule tests pass | Passed. 96 tests |
| No production mutation | Passed |

Phase 1 is complete. The dataset is sufficient to diagnose the principal failure modes, but it is not sufficient to calibrate a probability or authorize automatic assignment. The label set contains only two reviewed negative choices and has no separately reviewed `no_match`, irrelevant, ambiguous, or stale-activity labels.

## 6. Verification performed

- `node --check scripts/run-schedule-activity-assignment-evaluation.mjs`
- `node --check src/scheduleActivityAssignmentEvaluation.js`
- `node --check src/subagents/schedule.js`
- `npm.cmd run test:schedule`
- Read-only live dataset preparation against the active Schedule version.
- Full 30-case production-style evaluation without persistence.
- `git diff --check`

The final command results are captured in the implementation handoff. No browser or authenticated production UI behavior was changed or claimed as verified.

## 7. Phase 2 recommendation and approval gate

Proceed next with Phase 2 only. Improve candidate retrieval and bounded-set recall before modifying confidence or automatic-decision thresholds.

Phase 2 should specifically address:

1. The three confirmed activities excluded from the final bounded set.
2. The two confirmed activities ranked below the top five.
3. The current ordering in which semantic scoring sees only the first eight deterministic candidates.
4. Candidate fusion that preserves lexical, semantic, temporal, hierarchy, and historical evidence without treating any one raw score as probability.
5. A frozen comparison against this exact Phase 1 dataset and manifest.

Phase 2 must not change the production threshold, margin, automatic-write policy, reviewed links, or live data. Implementation requires explicit user approval.
