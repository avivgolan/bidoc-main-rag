# Schedule Activity Assignment Calibration

## Phase 6 Shadow Validation Infrastructure Checkpoint

Date: 2026-08-31

Status: shadow infrastructure is complete locally. Fresh shadow observations have not yet been collected, so Phase 6 acceptance and Phase 7 are not approved.

## Outcome

The evidence-selected Phase 4 policy can now run beside the human review flow without receiving Schedule-link write authority. Each compatible run records whether the disabled policy would have selected the leading activity. The reviewer still makes the actual decision, and the aggregate report compares the hidden shadow verdict with that later human label.

No automatic assignment policy is enabled by this implementation.

## Frozen policy path

The runtime source pins and tests the exact Phase 4 artifacts:

- Calibrator artifact: `schedule-assignment-calibrator:e14941848ae46effce000f6de175d218839a3f76868b83487b2ae07bd69e2964`
- Policy artifact: `schedule-assignment-policy:8adc1afe588b500c3b372fd70c98aba0f31f632221cb9220fe111f3cc49d9c67`
- Calibrated probability threshold: `0.50`
- Minimum leading-to-runner-up gap: `12` ranking points
- Matcher and Validator agreement: required
- Judge match when Judge ran: required
- Hard-conflict blocking: required
- Retrieval: `hybrid_union`, semantic pool `20`, model candidate limit `20`
- Engine: `schedule-assignment.v2.1-rc1`
- Settings: `schedule-assignment-openai.v2.1-rc1`
- Schedule version: `1787251318726_MS_Project.xml`
- Configuration snapshot: `schedule-assignment-config:9f2fb7c98d4faae092c69927b92b0e1dcbcb4bd318344f08b7b9557d91d7b4d0`

A run with a different retrieval strategy, engine, settings, Schedule version, or configuration snapshot is recorded as incompatible and cannot become shadow-eligible.

## Implemented safety boundary

- The browser run route always calls the assignment agent with `commit:false`.
- The assignment agent rejects any direct `commit:true` request before project or database access.
- The Phase 4 policy remains `enabled:false`, `readyForShadow:true`, and `readyForProduction:false`.
- Shadow observations always record `writeAllowed:false` and `assignmentCreated:false`.
- Human confirm and reject routes remain available and unchanged.
- The per-card shadow verdict is removed from reviewer-facing results and hydrated pending cards to reduce label bias.
- The complete internal workflow audit retains the bounded shadow evidence for later comparison.

## Durable observation and reporting

No new database table or migration was added. The versioned shadow observation is stored inside the existing backend-owned `schedule_activity_assignment_reviews.decision_snapshot` JSONB record.

The observation includes:

- Compatibility result and reason codes
- Policy and calibrator artifact IDs
- Retrieval configuration
- Leading score, runner-up score, ranking gap, and calibrated probability
- Individual policy gates
- `wouldAutoAssign`
- Selected activity key
- Role-failure count
- Duration, provider cost, tokens, and candidate count when available
- Explicit non-writing boundary fields

The authenticated read-only report is available at:

`GET /api/schedule/activity-updates/assignment-agent/shadow-report?projectId=<project-id>`

The existing authenticated reviews response also includes the aggregate `shadowValidation` report. Neither response exposes a pending card's row-level shadow verdict.

## Aggregate acceptance checks

The report currently requires all of the following before it can return `readyForPhase7:true`:

- At least 50 fresh compatible reviewed shadow observations
- At least 10 negative reviewed outcomes
- At least 5 shadow-eligible reviewed outcomes
- Zero false automatic eligibility outcomes
- Zero write-boundary violations
- Zero incompatible shadow observations in the frozen sample
- Calibrated-probability mean drift no greater than `0.15` after 20 observations
- Ranking-gap mean drift no greater than `10` points after 20 observations
- Role-failure rate no greater than `5%` after 20 observations

The report also exposes label distribution, safe coverage, false rate among eligible cases, latency distribution, probability distribution, ranking-gap distribution, compatibility reasons, and drift from the Phase 4 acceptance baseline.

These are minimum operational gates. Passing them does not activate Phase 7. A frozen report and explicit approval are still required.

## Verification

- JavaScript syntax checks passed for the shadow, agent, review queue, server, workflow, and test modules.
- `npm.cmd run test:schedule` passed: 120 tests.
- `npm.cmd run react:build` passed: 26 modules transformed.
- Tests pin the embedded shadow policy to the compact tracked manifest derived from the versioned Phase 4 JSON artifacts.
- Tests prove compatible eligibility, incompatible-context abstention, hidden reviewer hydration, human-label comparison, aggregate readiness and failure, read-only reporting, workflow audit fields, forced server dry-run, and early rejection of direct write requests.
- `git diff --check` passed with Windows line-ending normalization warnings only.

## Actions not performed

- No Schedule link was automatically created, changed, or deleted.
- No review label was created or resolved.
- No database migration or remote settings change was applied.
- No deployment, commit, or push was performed as part of this checkpoint.
- No fresh Phase 6 observation sample was claimed.

## Next gate

1. Commit and publish this bounded shadow implementation through the normal repository deployment path after review.
2. Run new alerts through the review-only Schedule batch.
3. Ask the reviewer to label each case based on the alert and candidate evidence, without seeing the hidden shadow verdict.
4. Continue until the report has at least 50 compatible reviewed observations, including the negative and eligible minimums.
5. Freeze and review the shadow report.
6. Stop and recalibrate after any false eligibility, write violation, context incompatibility, or material drift.
7. Do not start Phase 7 without explicit approval.
