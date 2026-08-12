# BIDoc Contracts Agent - Phase 3E Server-Owned Activity-Mapping API Checkpoint

- Date: 2026-08-11
- Status: Complete; stopped before Phase 3F
- Runtime scope: Authenticated read-only activity/state listing and candidate generation
- Database scope: Existing MAIN Gantt source and existing APP DATA/KAPAIM mapping surfaces only
- Writes: None
- UI, Schedule arithmetic, alerts, deployment: Unchanged

## 1. Outcome

Phase 3E adds the first runtime bridge to the approved Phase 3 mapping contract without adding a write path. The server accepts an authoritative MAIN `sourceProjectId`, resolves the active MAIN-to-KAPAIM route through `bidoc_contracts_resolve_mapping_context_v1`, loads the current Gantt version from MAIN, and loads current `schedule_activity_map` state from KAPAIM. The pure Phase 3B mapper then produces review candidates without selecting or confirming a winner.

No browser-supplied database URL, key, table, RPC, task list, mapping list, or selected activity can become routing or identity evidence.

## 2. API contract

### `GET /api/contracts/activity-mapping/activities`

Required query:

- `sourceProjectId`: authoritative MAIN project UUID.

Returns:

- resolved server-owned `projectContext`;
- selected Schedule version and conflict flag;
- normalized current-version Gantt activities;
- current KAPAIM mapping rows;
- source counts and `operationalWritesPerformed: false`.

Only `sourceProjectId` is accepted. Additional query fields fail closed.

### `POST /api/contracts/activity-mapping/candidates`

Required JSON body:

```json
{
  "sourceProjectId": "<MAIN project UUID>",
  "obligation": { "...": "contracts-activity-mapping.phase3.v1 obligation" }
}
```

Returns the versioned Phase 3B `candidate_bundle`, source counts, and `operationalWritesPerformed: false`. Only `sourceProjectId` and `obligation` are accepted at the top level. Browser-provided tasks, existing mappings, selected activity pairs, database configuration, and review decisions are rejected or unavailable.

Both routes require a valid same-origin superadmin session. The generic cross-tenant request-config override mechanism is deliberately excluded.

## 3. Server-owned data flow

1. Validate the same-origin reviewer session.
2. Reject database credential/configuration overrides before data access.
3. Resolve the active approved route through the KAPAIM service-role-only resolver RPC.
4. Read the current Gantt file and its tasks from MAIN `gantt_files_test` and `gantt_tasks_test` through the existing Schedule source loader.
5. Read only current `schedule_activity_map` state for the resolved KAPAIM `scheduleProjectId`.
6. Normalize the database rows to the pure Phase 3B contract.
7. Return the activity list or build a maximum-five candidate bundle.

The service does not call `bidoc_contracts_review_activity_mapping_v1`, mutate MAIN, insert/update mapping rows, read review-event history, run Schedule arithmetic, or generate alerts.

## 4. Security and failure behavior

- MAIN and KAPAIM credentials come only from server configuration.
- Secret/service-role keys remain backend-only, consistent with current [Supabase data-security guidance](https://supabase.com/docs/guides/database/secure-data).
- The existing explicit table/function grants remain a separate control from RLS, consistent with Supabase's [Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- Missing/invalid source UUID, inactive project route, missing Gantt version, unavailable migration surface, malformed database response, transport failure, and timeouts return typed fail-closed errors.
- An inactive or ambiguous Schedule version never becomes an automatic mapping. Version conflicts remain visible to the pure mapper as blockers.
- Error responses never include a server database key.

## 5. Verification

Focused tests:

- `npm.cmd run test:contracts` - 69 tests passed, including Phase 3E source routing, read-only transport, credential-override rejection, fail-closed context/Gantt behavior, and server-route guards.
- `npm.cmd run test:schedule` - 47 tests passed.
- `node --check src/contracts/activityMappingService.js` - passed.
- `node --check src/server.js` - passed.
- `node --check scripts/verify-contracts-phase3e-live.mjs` - passed.
- `git diff --check` - passed.

The broader `npm.cmd test` command is not globally green: it reports 12 unrelated UI/source-contract failures covering project-insights direction, Settings/workflow markup, and timeline mobile wiring. The failing assertions and UI assets are outside the Phase 3E slice and were not modified here; the focused Contracts and protected Schedule suites pass.

Read-only live integration:

```powershell
npm.cmd run test:contracts:phase3e:live -- 652bf3e0-9a1e-47ca-b06f-cd8dc33907f7
```

Verified result:

- active server-resolved MAIN-to-KAPAIM route;
- selected file `1776105870763_03.12.25.xml` with relevancy date `2025-12-03`;
- `versionConflict: false`;
- 382 normalized current activities;
- 0 existing activity mappings;
- `operationalWritesPerformed: false`.

The live verifier prints only routing/version/count metadata. It does not print credentials, task text, or mapping content and has no write operation.

## 6. Files

- `src/contracts/activityMappingService.js` - server-owned context resolution, source/state loading, strict request parsing, and candidate orchestration.
- `src/server.js` - two authenticated Phase 3E routes and early header-override rejection.
- `test/contracts-agent.tests.js` - focused service, security, failure, and route tests.
- `scripts/verify-contracts-phase3e-live.mjs` - read-only integration verifier.
- `package.json` - `test:contracts:phase3e:live` script.

## 7. Stop gate

Phase 3E is complete. Do not add manual confirm/reject/correct/unmapped actions, call the atomic review RPC, add mapping UI, manufacture a live mapping for the rejected Herzliya sample, change Schedule ingestion or Engine behavior, connect indicators/alerts, push, or deploy without explicit Phase 3F approval.
