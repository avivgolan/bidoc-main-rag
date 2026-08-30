# Schedule Activity Assignment Calibration. Phase 3.1 Reviewed Evidence Collection Checkpoint

Date: 2026-08-30

Status: the additive MAIN schema and authenticated production collection UI are deployed and verified. Four review cards are pending and explicit production labels collected remain 0. Phase 4 remains evidence-blocked.
Decision: collect explicit human outcomes through the existing shared review flow, merge only valid reviewed labels into frozen datasets, and keep calibration and automatic-decision policy blocked until the evidence gate passes.

## 1. Outcome

Phase 3 proved that the current 30-case dataset cannot support a production probability. Phase 3.1 adds the missing reviewed-evidence collection path without manufacturing labels or reinterpreting prior decisions.

The shared Schedule review card now has explicit human outcomes:

| Reviewer action | Evaluation label | Operational effect |
|---|---|---|
| Select an active activity | `confirmed_match` | Save the normal activity link and resolve the review |
| None of the active activities fit | `no_match` | Resolve without a link |
| Several activities remain plausible | `ambiguous` | Resolve without a link |
| Alert should not enter Schedule assignment | `irrelevant_alert` | Resolve without a link |
| Proposed activities are wrong but another may exist | `rejected_match` | Resolve without a link and preserve server-known candidate keys as forbidden |
| Historical reviewed activity is absent from the active version | `stale_activity` | Derived by frozen dataset preparation from reviewed historical evidence |

Existing operational `selected` or `rejected` review rows do not automatically become calibration labels. Only a row with an explicit `evaluation_label_type`, bounded reason, reviewer, and review time is eligible.

## 2. Delivered implementation

### 2.1 Explicit label contract

`src/scheduleActivityAssignmentLabels.js` defines and validates the six allowed labels. It enforces non-overlapping shapes:

- `confirmed_match` requires one expected `gantt:` activity and cannot contain forbidden keys.
- `rejected_match` and `stale_activity` require at least one server-validated forbidden `gantt:` activity.
- `no_match`, `ambiguous`, and `irrelevant_alert` cannot contain an expected activity.
- Every explicit label requires a bounded human-review reason.

It also provides conversion from a resolved shared-review row to an evaluation case, coverage reporting against the 100-case minimum, and deterministic reconciliation for duplicate and conflicting reviews.

### 2.2 Additive backend-only schema

Migration `20260830174803_schedule_assignment_evaluation_labels.sql` adds nullable label fields to the existing MAIN `schedule_activity_assignment_reviews` table: label type, expected activity key, forbidden activity keys, reason, reviewer identity, and timestamp.

Existing rows remain valid with null label fields. The new invoker RPC validates the label shape and updates only a pending review. Browser roles receive no table or RPC privilege. Only `service_role` receives execute permission.

The migration was applied to MAIN on 2026-08-30. The target table kept RLS enabled, browser table grants remained empty, the label RPC remained `security invoker`, and execute privilege remained limited to `service_role`. No review row was labelled by the migration.

### 2.3 Authenticated API and review UI

The existing same-origin superadmin boundary remains mandatory.

- Confirmed activity keys are validated by the existing active-Schedule assignment path.
- Negative forbidden keys come from persisted server snapshots or audited run candidates.
- The browser cannot submit arbitrary forbidden activity keys.
- Reviews without the new explicit label fields remain excluded from calibration.
- The Hebrew UI displays the four negative choices separately and shows the number of explicit calibration labels collected.
- Candidate values are labelled `ציון התאמה` without a percent sign.

### 2.4 Frozen dataset integration

Dataset preparation now reads explicit resolved labels from MAIN in addition to the canonical KAPAIM evidence.

Precedence and conflict rules:

1. Existing reviewed `schedule_activity_alert_links` remain canonical and are never rewritten or reinterpreted.
2. A duplicate shared label matching a canonical link is excluded as a duplicate.
3. A shared label conflicting with a canonical link is excluded. The canonical link remains unchanged.
4. Repeated identical shared labels collapse to the newest reviewed row.
5. Conflicting shared labels for the same source exclude that source instead of selecting one label.
6. A label tied to another Schedule version is excluded from the current-version dataset.
7. A reviewed source that cannot be recovered is excluded with an explicit reason.
8. Legacy backup rows remain readable only through the existing explicit `schedule_activity_alert_links` recovery path. Nothing is copied into `alerts`.

## 3. Read-only current evidence refresh

The frozen preparation command was rerun after the migration with the active remote settings and cutoff `2026-08-30T18:04:41.424Z`.

| Metric | Result |
|---|---:|
| Active Schedule tasks | 102 |
| Total reviewed cases | 30 |
| Confirmed match | 28 |
| Rejected match | 2 |
| No match | 0 |
| Stale activity | 0 |
| Irrelevant alert | 0 |
| Ambiguous | 0 |
| Explicit shared-review labels | 0 |
| Pending shared-review cards | 3 |
| Remaining to 100-case minimum | 70 |
| Recovered current alerts | 6 |
| Recovered explicitly linked legacy alerts | 24 |
| Exclusions | 0 |

The first attempt used `--code-defaults` and failed before output because that local configuration points the Timeline reader to an absent `alerts_embeddings_gf` table. The successful refresh used active remote settings, which is the correct configuration source for live dataset preparation. Neither attempt wrote to a database.

## 4. Safety boundaries

- No synthetic or model-generated outcome is accepted as a human label.
- A model decision alone cannot populate `evaluation_label_type`.
- Old operational resolutions remain excluded unless explicitly labelled through the new contract.
- Canonical CTO-authored links keep precedence.
- Conflicting human reviews fail closed and do not enter calibration.
- Label collection does not activate a calibrator, threshold, margin, retrieval strategy, or automatic write.
- The migration was applied after explicit approval. Deploying the UI/API remains a separate, currently unverified action.
- Phase 4 remains blocked until a new frozen dataset reaches the evidence gate and passes held-out calibration review.

## 5. Verification

- Focused explicit-label contract tests.
- Canonical precedence, duplicate collapse, and conflict exclusion tests.
- Service-role RPC payload and browser-input rejection tests.
- Existing-row compatibility test proving unlabeled operational resolutions are ignored.
- Authenticated route and backend-only migration source checks.
- Full Schedule test suite: 111/111 passed after the durable-review regression fix.
- React production build: passed with 25 modules transformed.
- JavaScript syntax checks: 10 changed entry points passed.
- `git diff --check`: passed, with only existing Windows line-ending normalization warnings.
- PostgreSQL catalog verification of all six columns, three validated constraints, the valid partial index, function configuration, RLS, and privileges.
- Transactional RPC smoke test: one pending row was labelled inside a transaction, validated, and rolled back. The table remained at 4 rows, 3 pending, 1 superseded, and 0 explicit labels.
- Live read-only dataset preparation with active settings after migration.
- Local exact API-path check: HTTP 200, 3 pending review cards, and explicit queue-label coverage of 0/100 under a short-lived simulated same-origin superadmin session.
- Local login page browser check: meaningful RTL content, no error overlay, and no warning or error console entries.
- Authenticated production Schedule check on build `4a102c1`: 4 pending cards, 8 candidate buttons, all 4 negative-label choices on each card, 3 clearly marked snapshot-only reviews, and 0 explicit labels.
- Production review reads use `private, no-store`; snapshot-only reviews cannot rerun the agent or open the manual activity picker, and a positive label-only choice is server-validated against stored candidates.

Supabase recorded the migration as version `20260830174803`. The local file was aligned to that exact remote migration history entry. The security advisor reports only the expected informational `rls_enabled_no_policy` finding for this backend-only table. The performance advisor reports the new partial index as unused, which is expected before explicit labels exist.

The approved schema migration, commits, push, and collection-UI deployment occurred. No review label, Schedule link, production policy setting, calibrator activation, or automatic-assignment activation occurred.

## 6. Next approval gate

The next bounded action is human reviewed-label collection. Reviewers must accumulate at least 70 additional representative cases with coverage across every missing label class. Calibration must be rerun only after freezing and reviewing that expanded dataset.
