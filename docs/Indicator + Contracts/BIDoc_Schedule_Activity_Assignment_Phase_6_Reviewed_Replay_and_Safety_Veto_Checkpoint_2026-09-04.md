# Schedule assignment: reviewed shadow replay and safety veto

Date: 2026-09-04

Status: Phase 6 acceptance has not passed. Automatic assignment remains disabled. The recalibrated candidate is rejected by known labeled evidence and must not be published as ready for shadow or production.

## Outcome

The reviewed sample is useful and sufficient to expose the current failure. More labels are not required before correcting the identified safety and semantic-matching problems.

- Live read-only snapshot: 50 compatible observations, 49 reviewed, 1 pending (`sourceId=6417`).
- Labels: 8 confirmed matches, 13 rejected matches, 12 no-match, 4 irrelevant, and 12 ambiguous.
- Current frozen policy: 0 eligible decisions, 0 write violations, and 0 model-role failures. Its coverage and drift checks fail.
- Recalibrated 70% probability / 10-point gap candidate: 3 eligible decisions on the stored reviewed observations, 2 correct and 1 false.
- No database writes, new labels, deployment, policy activation, commit, or push occurred in this continuation.

## Dataset preparation correction

The offline preparer resolved the source-to-Schedule project mapping but still loaded Schedule tasks using the source project ID. This produced an empty task set and invalid stale-activity classifications.

The preparer now uses `context.scheduleProjectId` when calling `loadScheduleSource`. The invalid preparation output was discarded and rebuilt.

The corrected frozen dataset contains 102 active Schedule activities and 149 cases:

| Label | Count |
| --- | ---: |
| confirmed_match | 128 |
| rejected_match | 4 |
| no_match | 10 |
| irrelevant_alert | 1 |
| ambiguous | 6 |
| stale_activity | 0 |

The missing stale subtype remains diagnostic, not a collection blocker. Reconciliation retained canonical-link precedence and excluded conflicting review labels instead of silently choosing a verdict.

## Incremental evaluation and calibration

Comparison with the previous 148-case dataset found 121 reusable cases and 28 new or changed cases. The Schedule task snapshot was unchanged. The 28 cases were rerun with `commit:false`, `persistAudit:false`, hybrid retrieval, a 20-candidate semantic pool, and a 20-candidate model pool. The run completed with zero role failures.

The composition utility verifies engine, settings, prompt/schema hashes, retrieval, Schedule version/tasks, source snapshots, fixture hashes, and cutoffs. It recomputes label-dependent outcomes against the latest human labels. Historical runtime eligibility aggregates are marked incomparable; the dedicated calibrated policy sweep supplies a consistent policy evaluation.

Calibration selected isotonic regression. Held-out Brier score improved from 0.257758 for the raw-score control to 0.244161. This is component-level calibration evidence, not authorization to write assignments.

The 392-configuration sweep initially selected a disabled candidate with:

- Calibrated probability threshold: 0.70.
- Ranking margin: 10 points.
- Matcher/Validator agreement required.
- Judge match required when the Judge ran.
- Hard conflicts blocked.

The 31-case acceptance split had 4 correct eligible decisions and 0 false, or 12.9% safe coverage. However, replay against the previously reviewed shadow observations found a known false decision. The candidate was therefore rejected.

## Concrete counterexample and root cause

`sourceId=6593` is the alert about architect approval to use melamine instead of Master B. The human label is `no_match`.

The offline model output selected `סימון קירות + אישור אדריכל` (wall marking and architect approval), with a score of 70.86 and an 11.46-point gap. The shared generic phrase about architect approval outweighed the actual material context. Matcher returned `match`; Validator returned `ambiguous` but supplied the same best activity key. The existing key-equality agreement gate still passed.

The stored shadow run also made this case eligible under the new candidate, with a 10.73-point gap. The case was not omitted or mislabeled in the dataset. It was in the calibration training split.

The policy artifact previously checked selection and acceptance splits only. A candidate could therefore be marked `readyForShadow` despite a known false automatic decision elsewhere in the labeled evidence.

## Safety correction delivered locally

Policy artifact construction now applies a final safety veto to the selected candidate across all known labeled rows. If any row is falsely eligible, `readyForShadow` is false with `known_evidence_false_automatic_assignment_observed`.

This is a rejection-only check. It does not choose another threshold using acceptance results or claim a new untouched hold-out set.

The corrected artifact reports 20 eligible decisions across all 149 cases: 19 correct and 1 false. It remains disabled and not ready for shadow or production.

## Evidence and verification

Private artifacts remain under the ignored `data/schedule-assignment-evaluations/` directory:

- `phase6-shadow-reviewed-provisional-dataset-2026-09-03.json`
- `phase6-shadow-reviewed-fresh-28-report-2026-09-03.json`
- `phase6-shadow-reviewed-composed-149-report-2026-09-03.json`
- `phase6-shadow-reviewed-calibrator-2026-09-03.json`
- `phase6-shadow-reviewed-policy-sweep-2026-09-03.json` (pre-veto diagnostic artifact, rejected)
- `phase6-shadow-reviewed-replay-2026-09-03.json` (generated on 2026-09-04)
- `phase6-shadow-reviewed-policy-safety-veto-2026-09-04.json`

Calibrator: `schedule-assignment-calibrator:b07a5e3794cf4001fa001ada91dee111f71bb7046eea9020649f0505e3ec290c`.

The replay is diagnostic only. Twenty-eight of its 49 reviewed sources overlap the updated calibration dataset, so it cannot be counted as fresh independent acceptance evidence.

Focused Schedule tests: 122 passed, including regression coverage for mapped Schedule loading, relabeling preserved model outputs, and the known-evidence safety veto. Syntax checks passed for the new offline scripts. No UI behavior changed in this slice.

A separate in-progress chat-citation edit temporarily introduced an unescaped backtick in `src/prompts.js`. Only that syntax escaping was corrected to unblock module loading. Other unrelated dirty work was preserved and not staged.

## Next approved-work proposal

1. Tighten automatic eligibility so an ambiguous or no-match Validator outcome cannot count as positive agreement merely because its best activity key matches the Matcher.
2. Address generic-phrase matches that confuse an approval action with the actual material/work scope, using source 6593 as a regression case.
3. Re-evaluate these changes on the same frozen evidence and replay available observations. Do not request another broad labeling batch before this diagnosis is resolved.
4. The technical reviewer can complete the one remaining pending case, but that is not a prerequisite for the engineering correction.
5. Only after known false decisions are eliminated should a new candidate be approved for shadow-only publication and independently validated. Phase 7 automatic writes require explicit approval.
