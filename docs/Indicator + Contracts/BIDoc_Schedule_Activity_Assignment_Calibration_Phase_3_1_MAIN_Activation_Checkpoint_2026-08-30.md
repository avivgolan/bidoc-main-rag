# Schedule Activity Assignment Calibration. Phase 3.1 MAIN Activation Checkpoint

Date: 2026-08-30
Status: MAIN schema activated and verified. The authenticated production collection UI is deployed and verified. Four reviews are pending and no explicit labels have been created.

## 1. Approved scope

This step activated only the reviewed-evidence collection foundation approved by the user:

1. Apply the additive evaluation-label migration to MAIN.
2. Verify schema, privileges, constraints, RPC behavior, and rollback safety.
3. Verify the current application can read the live schema through the exact authenticated review endpoint.
4. Stop before fabricating labels, activating a calibrator or policy, changing automatic-assignment settings, or writing Schedule links.

## 2. MAIN migration result

Supabase project: MAIN (`pmdnmzuqbcnzgkuhpfnx`)
Recorded migration: `20260830174803 schedule_assignment_evaluation_labels`
Local migration: `supabase/migrations/20260830174803_schedule_assignment_evaluation_labels.sql`

Post-migration catalog evidence:

| Check | Result |
| --- | --- |
| Existing queue rows | 4 |
| Pending | 3 |
| Superseded | 1 |
| Explicit labels | 0 |
| Label columns | All 6 present |
| Label constraints | All 3 present and validated |
| Partial label index | Valid and ready |
| RLS | Enabled |
| Browser table grants | None |
| RPC security mode | Invoker |
| RPC search path | Empty fixed search path |
| `anon` execute | No |
| `authenticated` execute | No |
| `service_role` execute | Yes |

The migration was hardened before apply so its constraints and index are idempotent. A guarded rollback script refuses to remove the schema after any explicit label exists.

## 3. Transactional RPC verification

A real pending review was resolved as `no_match` inside a database transaction. The test verified the rejected status, label type, and label timestamp, then rolled the transaction back.

Post-rollback state remained:

- 4 total rows.
- 3 pending rows.
- 1 superseded row.
- 0 explicit labels.

This proves the RPC and constraints execute without consuming a real review or manufacturing calibration evidence.

## 4. Advisor review

Target-specific security advisor result:

- `rls_enabled_no_policy`, informational. This is expected because the table is backend-only, browser roles have no table grants, and the RPC is service-role-only.
- No target-specific mutable-search-path or public-execute warning was reported for the new RPC.

Target-specific performance advisor result:

- The new label index is currently unused. This is expected while explicit-label count is zero.
- Unrelated pre-existing MAIN advisor findings were not modified in this phase.

## 5. Application read-path verification

The post-migration frozen dataset refresh succeeded with the active remote settings:

| Metric | Result |
| --- | ---: |
| Active Schedule tasks | 102 |
| Reviewed evaluation cases | 30 |
| Explicit shared-review labels | 0 |
| Remaining to the minimum | 70 |
| Missing label classes | 4 |

Missing classes remain `no_match`, `stale_activity`, `irrelevant_alert`, and `ambiguous`.

The local server was then started on port 4000. A short-lived simulated same-origin superadmin session called the exact collection endpoint:

`GET /api/schedule/activity-updates/assignment-agent/reviews?projectId=81b1cbac-8fcf-43c1-acdc-6b5c809de0e5`

Result: HTTP 200, 3 pending review cards, and 0 explicit queue labels. The public login page also rendered meaningful RTL content without a framework error overlay or browser console errors. This is local API and login-wall evidence, not a claim that the authenticated production UI was manually reviewed.

## 6. Deployment and production verification

The reviewed Phase 1 through Phase 4 change set was committed as `9f61e29` and pushed to `origin/main`. The existing Vercel Git integration deployed it automatically. Authenticated production verification then exposed two collection-path defects: durable reviews were dropped when their original alert row no longer existed, and the reviewer GET could reuse stale cached data.

The focused fixes were committed and deployed as:

- `9e6655c fix(schedule): restore durable review cards`
- `4a102c1 fix(schedule): bypass cached review data`

Production build `4a102c1` was verified in an existing authenticated Chrome session on the exact Schedule page for project `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5`.

Observed production result:

| Check | Result |
| --- | ---: |
| Schedule items shown | 544 |
| Existing activity links shown | 24 |
| Pending review cards | 4 |
| Current-feed review cards | 1 |
| Durable snapshot-only review cards | 3 |
| Candidate buttons | 8 |
| Each negative-label choice | 4 |
| Explicit labels | 0 |
| Schedule load warnings or errors | 0 |

Every snapshot-only card clearly states that its decision will be stored as a calibration label only and will not change a Schedule link. Its manual activity picker cannot be opened and its rerun button is disabled. A positive label-only choice is validated on the server against the candidates stored in the durable review record. The authenticated reviewer endpoint and client request now use `private, no-store` behavior.

No candidate or label button was clicked during verification. The only browser console warnings were unrelated pre-existing Cytoscape style warnings from the graph library. There was no Schedule framework error overlay.

## 7. Current gate

The database can now collect explicit labels once application code containing the new UI/API contract is deployed. Evidence and policy state remain blocked:

- Pending review cards available to the team: 4.
- Explicit queue labels: 0.
- Frozen reviewed cases: 30.
- Remaining cases to minimum: 70.
- Missing label classes: 4.
- Calibrator: not ready.
- Phase 4 policy: not selected.
- Shadow readiness: false.
- Production readiness: false.

The next safe step is human reviewed-label collection. The team must resolve representative cases across every missing class until at least 70 additional valid cases have been collected. Automatic decisions remain disabled and out of scope.
