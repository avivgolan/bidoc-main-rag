# Schedule Activity Assignment. Phase 3.1 Bounded Collection UI Checkpoint

Date: 2026-08-31

Status: implemented, pushed in commit `69e6d68`, and verified in the deployed public production bundle. Authenticated rendered-page verification remains pending because the saved browser session redirected to login.

## 1. Problem addressed

The Schedule button displayed `אתר את כולם (508)`. The number represented dated, unassigned alerts eligible for processing, but the wording could be read as 508 completed automatic assignments. The action also queued every eligible row, which was too broad for controlled evidence collection.

Assigned rows continued to display a disabled `איתור אוטומטי` button, while the Schedule read response omitted the saved `assignment_method`. Reviewers therefore could not distinguish manual assignments, agent proposals approved by a person, and fully automatic assignments.

## 2. Delivered behavior

### 2.1 Bounded collection

- The grouped action defaults to 10 rows.
- Reviewers can select 10, 25, or 50 rows.
- The action states the selected batch size separately from the full eligible count.
- A confirmation explains that the eligible count is not a completed-assignment count.
- Every grouped run sends `reviewOnly: true`.
- The server accepts `reviewOnly` only as a reduction of authority and runs the agent with `commit: false`.
- Audit runs and shared review cards remain available, but the grouped collection action cannot write an automatic Schedule link.

### 2.2 Clear assignment provenance

The Schedule read path now returns the persisted assignment method and the UI renders one of:

- `שויך ידנית`
- `הוצע על ידי הסוכן ואושר`
- `שויך אוטומטית`
- `שיוך קיים` only as a compatibility fallback when an assigned row has no known method

An unassigned row now uses `בדיקת התאמה`. An assigned row no longer displays the misleading disabled `איתור אוטומטי` action.

### 2.3 Provenance correctness on later edits

A future manual reassignment records `manual` and clears an older agent run identifier, confidence, and review note. Existing links are not rewritten by this deployment. The correction applies only when a reviewer later saves a changed assignment.

## 3. Safety boundaries

- No existing Schedule link was changed, deleted, or remapped.
- No reviewed label was created.
- No production policy, prompt, model, threshold, margin, or settings value was changed.
- The single-row agent action keeps its existing server-owned policy behavior.
- Only the grouped evidence-collection action is forced to review-only mode.

## 4. Verification

- `npm.cmd run test:schedule`: 112 tests passed.
- `npm.cmd run react:build`: passed, 25 modules transformed.
- JavaScript syntax checks passed for the changed server, Schedule, and assignment modules.
- The public production bundle returned HTTP 200 and contains the bounded-count explanation, review-only warning, and assignment-provenance labels.
- The deployed bundle no longer contains the `אתר את כולם` action text.
- Authenticated rendered production verification remains pending a renewed reviewer session.

## 5. Next gate

After authenticated production verification:

1. Review the four existing pending cases.
2. Run additional review-only batches of 10.
3. Collect at least 70 additional representative labels, including `no_match`, `ambiguous`, `irrelevant_alert`, and `stale_activity`.
4. Freeze and review the expanded dataset.
5. Rerun v2 calibration and the Phase 4 held-out policy sweep.

Automatic assignment, shadow mode, and Phase 5 remain blocked until their evidence and approval gates pass.
