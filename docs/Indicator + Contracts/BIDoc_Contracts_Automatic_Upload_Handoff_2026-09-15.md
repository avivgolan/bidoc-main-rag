# Contracts upload automation

Date: 2026-09-15

Status: implemented locally. Not deployed or validated with a new production contract.

## Requested behavior

The Contracts screen starts all processing after one upload action. Relationship analysis, model review, decision generation, recommendation handoff and Schedule calculation run sequentially without intermediate clicks or human approval. The separate main-product ingestion path is outside this change, as confirmed by the user.

## What the audit found

The previous screen stopped after clause extraction, enrichment, embedding preparation and persistence. Explicit relationships, semantic relationships, automatic relationship review, decision generation, automatic decision review and the Indicator handoff were separate actions.

Automatic approval capability did not mean automatic orchestration. In particular, the existing decision auto-review route explicitly returned zero Indicator handoffs and zero Schedule writes. Manual decision review and split/merge routes already attempted Indicator reconciliation. A Schedule sweep also already reconciled conditions and invoked their resolver.

Read-only KAPAIM queries during this task found:

- Two private R6 workspaces passing parity checks, with 124 clauses / 98 current decisions and 189 clauses / 137 current decisions.
- Three public workspaces. The newest had 167 clauses and 12 decisions. Public decision row counts also contain revision history and are not comparable with current private decision counts.
- 12 pending Schedule contract conditions: 4 written by `indicator_agent` and 8 by `contracts_agent_cto_approved`.
- Zero contractual milestones, and two Indicator synchronization-state records.
- No `cron` tables in the inspected KAPAIM database. This does not rule out an external scheduler.

These records establish earlier processing and partial synchronization, not a successful unattended upload-to-Schedule run or the deployed application version.

## Delivered sequence

1. Extract, enrich and persist the uploaded contract using the existing upload action.
2. Persist explicit references between clauses.
3. Analyze and persist semantic relationships.
4. Run the existing conservative automatic reviewer, then an independent model reviewer for the remaining relationships in bounded batches.
5. Generate normalized decisions from the reviewed clauses and relationships.
6. Run the existing independent decision verifier. Its 98% approval threshold remains unchanged.
7. Save remaining uncertain decisions as terminal unresolved findings. Continue processing without waiting for human review.
8. Load the R6 recommendation package for Indicator.
9. Call the existing Indicator synchronization writer.
10. Run the existing Schedule sweep, including condition synchronization, trigger resolution and date calculation.

The new authenticated endpoint is `POST /api/contracts/automatic/workspaces/:workspaceId/steps/:step`. It accepts an empty body; source clauses, model inputs and Schedule project identity come from the server. Existing server activation flags and database permissions remain effective.

## Uncertainty and model provenance

The automatic relationship reviewer returns approve, reject or unresolved with a Hebrew explanation. An approval or substantive rejection needs at least 95% confidence and two complete source excerpts. Invalid JSON, unknown or duplicate IDs, truncated results and provider failures cannot be treated as successful reviews.

An unresolved relationship is excluded from decision assembly using the existing rejected-edge storage state. Its review reason contains a versioned unresolved marker. Decision generation propagates that marker to both affected clauses, so excluding an uncertain edge cannot silently authorize their scheduling. The screen labels these edges as unresolved automatically. The original proposal and subsequent revision remain available.

Uncertain decisions use the existing `unresolved` state, retain their evidence and are excluded from operational synchronization. This is a completed finding, not a request that pauses the contract. Model review reasons identify the automatic policy and reviewer model. The authenticated initiating user's ID records who initiated the run, not an assertion that they personally reviewed every item.

Provider failures remain technical failures. They retry up to twice, retain saved progress and are surfaced if the retries fail. Missing project mappings are reported rather than invented.

## Persistence and operational limits

- Completed domain outputs are persisted using existing RPCs. No schema migration was introduced.
- The next-stage checkpoint is stored in this browser's local storage. The browser issues one bounded request per stage or review batch.
- Keep the Contracts screen open during processing. Closing it stops further stage dispatch; reopening in the same browser resumes automatically after the initial upload has returned a workspace ID. This is not a background worker and does not continue while the browser is closed. Clearing site storage removes the continuation checkpoint, although saved contract results remain in the database.
- A browser lock prevents simultaneous execution for one workspace across tabs where Web Locks are supported. Existing database revision checks protect individual writes.
- The existing Indicator writer synchronizes eligible reviewed relative/recurring rules. This change does not introduce a writer for every fixed-date rule. The recommendation package can contain rules that the current operational writer does not support.
- Schedule still needs an existing project mapping and factual trigger evidence. A condition waiting for commencement, a notice or another future event remains pending until evidence exists. The current resolver also retains its existing per-sweep limit of 25 conditions.
- The new model review behavior has deterministic and mocked integration coverage, but no fresh live-model quality evaluation was performed in this task.

## Validation

- Contracts regression suite: 183 passed.
- Schedule engine suite: 122 passed.
- Automatic pipeline tests: 9 passed, including sequencing, bounded review batches, retries, invalid model results, unresolved-source propagation and checkpoint recovery.
- Browser scenarios: upload-to-completion without intermediate clicks and resume from a saved stage both passed using isolated mocked API responses. The upload scenario reported no page errors. The Windows Playwright runner stalled during server teardown after the results and was interrupted; this is not a clean runner-exit claim.
- React production build: passed. The tracked browser bundle was regenerated.
- No new production contract was uploaded. No model-review or operational mutation endpoint was invoked against production. No commit, push or deployment was performed.

## Deployment acceptance checks

1. Deploy the reviewed backend and rebuilt browser bundle together with the existing Contracts/R6 activation flags and server connections.
2. In the Contracts screen, select a mapped project and upload one agreed acceptance contract using the automatic upload button.
3. Verify that every stage progresses without intermediate clicks. Check the final recommendation package and the corresponding Indicator synchronization result.
4. Confirm that unresolved findings are retained and excluded from scheduling while independent eligible recommendations continue.
5. Reload during a later stage and verify automatic resume without re-uploading or duplicate decision revisions.
6. Verify the expected pending conditions, source evidence and any resolved milestones. A pending real-world event is not an automation failure.

Deployment, a controlled live-model acceptance run, background execution after browser closure and broader fixed-date operational support are not established by the local checks above.
