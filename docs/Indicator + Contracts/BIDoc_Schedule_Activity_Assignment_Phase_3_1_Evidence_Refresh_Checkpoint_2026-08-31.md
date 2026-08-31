# Schedule Activity Assignment. Phase 3.1 Evidence Refresh Checkpoint

Date: 2026-08-31

Status: dataset preparation corrected and verified. Evidence collection remains below the calibration gate.

## 1. Problem found

The Schedule review UI stores a durable review row under the project ID used to open the Schedule page. Dataset preparation queried only the mapped source project ID. A valid reviewed label could therefore exist in MAIN but remain invisible to calibration.

Three resolved review cards also belonged to alerts that had disappeared from the current feed. The cards retained bounded event snapshots, but dataset preparation rejected them when live source recovery failed. This made the label-only review path operationally visible but unusable as evaluation evidence.

## 2. Correction

- Dataset preparation queries the requested page project, mapped source project, and mapped Schedule project.
- Repeated results are deduplicated by durable review ID before label reconciliation.
- A resolved explicit label may use its bounded stored event snapshot only when the live source cannot be recovered and the snapshot contains a canonical business date.
- Live source rows and linked backup recovery still take precedence over snapshots.
- Snapshot-derived cases retain `schedule_assignment_review_snapshot` provenance.
- Canonical activity links still win over duplicate or conflicting shared-review labels.

No database row, Schedule link, prompt, model, threshold, margin, or runtime policy was changed.

## 3. Read-only refresh result

The corrected preparation command used Schedule page project `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5` and produced the ignored local artifact `data/schedule-assignment-evaluations/phase3-1-evidence-refresh-2026-08-31.json`.

| Metric | Result |
|---|---:|
| Active Schedule tasks | 102 |
| Explicit resolved review labels found | 12 |
| Duplicate explicit labels already represented by canonical links | 9 |
| Historical review cases recovered from durable snapshots | 3 |
| Usable evaluation cases | 36 |
| Remaining to the 100-case minimum | 64 |

Usable label breakdown:

| Label | Count |
|---|---:|
| `confirmed_match` | 35 |
| `no_match` | 1 |
| `rejected_match` | 0 |
| `stale_activity` | 0 |
| `irrelevant_alert` | 0 |
| `ambiguous` | 0 |

The three snapshot-recovered cases contain two confirmed matches and one explicit no-match.

## 4. Verification

- JavaScript syntax checks passed for the label module and evaluation script.
- `npm.cmd run test:schedule`: 113 tests passed.
- `git diff --check`: passed.
- The final frozen refresh loaded active Schedule version `1787251318726_MS_Project.xml` with 102 tasks. A previous zero-task attempt was rejected and overwritten before any calibration use.

## 5. Gate assessment

Calibration and the threshold-margin policy sweep must not be rerun yet. The dataset is 64 cases below the minimum and has no evidence for `rejected_match`, `stale_activity`, `irrelevant_alert`, or `ambiguous`.

The next operational step is to continue review-only batches of 10 and record the exact human outcome. Shadow validation and automatic assignment remain disabled until a compatible calibrator passes held-out review and the selected policy observes zero false automatic assignments with useful non-zero coverage.
