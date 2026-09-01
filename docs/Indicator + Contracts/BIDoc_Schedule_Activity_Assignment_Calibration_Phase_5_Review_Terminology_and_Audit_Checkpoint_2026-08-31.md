# Schedule Activity Assignment Calibration

## Phase 5 Review Terminology and Audit Checkpoint

Date: 2026-08-31

Status: complete. Implementation, automated acceptance, and the populated-card visual acceptance are verified. Phase 6 remains separately gated.

## Outcome

The Schedule review card no longer presents the model's blended ranking value as if it were a probability. Reviewers can now distinguish four separate facts:

1. The leading candidate's raw match score.
2. The runner-up candidate's raw match score.
3. The ranking gap in score points.
4. A calibrated probability, only when a compatible ready calibrator produced one.

Every non-automatic decision also explains which safety conditions required human review.

## Implemented behavior

### Review presentation

- Added distinct labels for leading score, runner-up score, ranking gap, and calibrated probability.
- Raw ranking scores never receive a percent sign.
- An unavailable or incompatible calibrator is shown as unavailable, not as zero probability.
- Added a plain-Hebrew list explaining why human review is required.
- Added an expandable audit section with bounded versions and gate outcomes.
- Preserved the two candidate buttons and all explicit negative-label choices.
- Preserved RTL behavior and responsive card layout.

### Human review reasons

The presentation layer can explain:

- No candidate passed the suggestion threshold.
- The model did not reach an unambiguous match decision.
- Calibrated probability was unavailable or below the policy threshold.
- The ranking gap was smaller than the required margin.
- Matcher and Schedule Validator disagreed.
- A hard conflict was detected.
- Required model roles did not complete.
- The source date was invalid or missing.
- The selected activity was not from the active schedule version.
- The run became stale, the alert was already assigned, or automatic assignment was disabled.

### Audit compatibility

New decisions and shared review snapshots now retain:

- `rankingScore`
- `runnerUpRankingScore`
- `rankingGap`
- `calibratedProbability`
- Calibration status and artifact ID
- Suggestion, probability, and gap policy thresholds
- Gate outcomes
- Engine, settings, configuration, and schedule versions

Workflow result nodes expose the same explicit fields. Existing `confidence`, `runnerUpConfidence`, and `margin` fields remain as compatibility aliases.

No prompt text, secret, or unbounded model content was added to the UI or audit snapshot.

## Verification

- `node --check` passed for the new presentation module and all modified Schedule engine, agent, review, and workflow modules.
- `npm.cmd run test:schedule` passed: 117 tests.
- `npm.cmd run react:build` passed: 26 modules transformed.
- The authenticated local `http://localhost:4000/#schedule` route loaded after the build with no browser console warnings or errors.
- The local route exposed zero projects and zero review cards. Therefore the populated-card visual check was not available in this local data state.
- A later connected-system review supplied three populated-card screenshots. They confirmed the separate leading score, runner-up score, ranking gap, unavailable calibrated-probability state, plain-Hebrew review reasons, expandable audit details, both candidate choices, and the negative-label actions in RTL layout.

## Safety boundary

- Automatic assignment remains disabled.
- The Phase 4 policy artifact remains `readyForShadow` and not ready for production.
- No Schedule link was created, changed, or deleted.
- No review label was created or resolved during verification.
- No remote settings, database schema, deployment, or production policy was changed.

## Phase 5 acceptance

Passed locally:

- Uncalibrated scores are not labelled as probabilities.
- Failed safety gates are translated into reviewer-facing reasons.
- Shared review selection and rejection behavior remains unchanged.
- Compatibility aliases remain available.
- Focused tests and the React build pass.

The remaining populated-card publication check is complete based on the connected-system screenshots reviewed on 2026-08-31.

## Next gate

Phase 6 may start only after approval. It must run the selected calibrated policy in non-writing shadow mode, record `wouldAutoAssign`, and compare that outcome with subsequent human decisions. It must not create Schedule links or enable the production policy.
