# BIDoc Contracts Agent - Phase 0 Decision Lock and Baseline

- Version: 1.0
- Date: 2026-08-08
- Phase status: Evidence package complete; CTO/product approval gate open
- Runtime status: No runtime behavior changed
- Database status: Read-only verification only; no DDL and no data writes

Related artifacts:

- [Implementation plan](./BIDoc_Contracts_Agent_and_Schedule_Intelligence_Implementation_Plan.md)
- [Canonical Schedule Intelligence specification](./BIDoc_Schedule_Intelligence_Engine_Spec.md)
- [Contracts Agent output schema](./schemas/contracts-agent-output.v1.schema.json)
- [Human gold annotation draft for the sample contract](./gold-set/sample-herzliya-contract.annotation.json)
- [Synthetic representative contract variants](./gold-set/representative-contract-variants.json)
- [Database table and caller inventory](../db-table-callers-inventory.md)

This is an engineering and data-model record, not legal advice.

## 1. Phase 0 outcome

Phase 0 has produced the evidence and proposed decisions needed to review a safe Phase 1 implementation.

The immediate recommendation is:

1. Approve Phase 1 as a dry-run extraction slice only.
2. Keep every extracted fact outside operational Schedule tables during Phase 1.
3. Preserve the existing Schedule Engine, APIs, calculations, statuses, confidence, severity, calendars, snapshots, and alert behavior.
4. Reuse the eight existing CTO-created Schedule tables in later approved phases.
5. Keep Phase 2 operational promotion blocked until the live database catalog, review/audit persistence, and field-level gaps are explicitly resolved.

Phase 1 has not started in this checkpoint.

## 2. Binding CTO constraints

The following decisions are already locked by the CTO's 2026-08-08 review:

### 2.1 Protected Schedule Engine

The Contracts Agent is an additive producer. It must not duplicate the existing Schedule Engine. Per the CTO clarification recorded on 2026-08-10, an approved later integration slice may modify or extend the existing Engine when genuinely required, but it must reuse the current logic and prove unchanged-input compatibility with focused regressions.

Protected behavior includes:

- Schedule and calendar arithmetic.
- Basis priority and approved-extension handling.
- Lateness and remaining-day semantics.
- Status and confidence precedence.
- Severity and alert derivation.
- Lookup, sweep, health, snapshots, conditions, and alert lifecycle behavior.
- Current Schedule API and UI behavior.

Any behavioral change to the protected baseline requires a separate, bounded exception approved before editing.

### 2.2 Existing Schedule tables

The following tables already exist in APP DATA/KAPAIM and are canonical:

1. `schedule_calendars`
2. `schedule_contract_milestones`
3. `schedule_contract_extensions`
4. `schedule_contract_conditions`
5. `schedule_indicator_snapshots`
6. `schedule_alerts`
7. `schedule_activity_map`
8. `schedule_observed_events`

No duplicate, replacement, renamed, cloned, or parallel-purpose Schedule table is authorized. No `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, index, trigger, function, RLS, grant, policy, permission, or backfill operation is authorized by Phase 0 or Phase 1.

## 3. Evidence baseline

### 3.1 Repository baseline

| Evidence | Value |
|---|---|
| Git root | `main-rag-backend/bidoc-main-rag` |
| Local branch | `main` |
| Local HEAD | `82ff6a51eb892486addcc9e4aec8c2e214dd059e` |
| Remote state | Local branch is one commit behind `origin/main` |
| Remote-only commit | `7ff6cc7 Add subagent readiness diagnostics` |
| Node.js | `v22.14.0` |
| npm | `10.9.2` |

The remote-only commit changes diagnostics in `src/server.js`, the legacy UI, tests, and Bedrock notes. It does not change the protected Schedule Engine, Calendar, ingestion, Schedule orchestration, condition resolver, Schedule React page, or focused Schedule test file. Because Phase 1 will eventually add a server route, the branch state must be reconciled deliberately before editing `src/server.js`; this phase does not pull, merge, reset, or overwrite the current dirty worktree.

### 3.2 Sample contract baseline

| Evidence | Value |
|---|---|
| File | `הסכם קבלן-סמל אולם תצוגה הרצליה גרסה לחתימה 1.11.pdf` |
| SHA-256 | `0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA` |
| Pages | 18 |
| Header date | 2024-11-19 |
| Visible signatures | Blank |
| Appendix B commencement | Blank |
| Execution authority | Unverified |
| Project binding | Needs review because the contract identifies 5 HaHoshlim while the Schedule specification identifies 15 HaHoshlim |

The PDF was rendered and the relevant pages were visually inspected. Text extraction was used only as a secondary aid; page images are the evidence source for the gold annotation.

### 3.3 Live database verification

The live audit ran on 2026-08-08 at `2026-08-08T14:37:46.635Z` through authenticated PostgREST OpenAPI `GET` and table-count `HEAD` requests only.

| Logical target | Project ref | OpenAPI result |
|---|---|---:|
| APP DATA / KAPAIM | `smxibuaowzuxkznuouwj` | 200 |
| App / MAIN | `pmdnmzuqbcnzgkuhpfnx` | 200 |

No row values, credentials, or secret configuration were printed. No `POST`, `PATCH`, `PUT`, `DELETE`, RPC, SQL, migration, or database write was executed.

## 4. Read-only table and caller audit

### 4.1 Live table state

| Existing table | Live rows | Current source-verified reader/writer | Phase ownership |
|---|---:|---|---|
| `schedule_calendars` | 1 | Read by `loadScheduleCalendar()` and the condition resolver; no current backend writer | Existing calendar administration owns writes; Contracts reads only |
| `schedule_contract_milestones` | 0 | Read by ingestion; upserted by the existing condition resolver | Later reviewed Contracts writer may add fixed milestones through the existing contract |
| `schedule_contract_extensions` | 0 | Read by ingestion; no current backend writer | Later reviewed Contracts writer may add discrete extension events only |
| `schedule_contract_conditions` | 0 | Read by Schedule conditions API; patched by the existing resolver | Later reviewed Contracts writer may add supported unresolved relative conditions |
| `schedule_indicator_snapshots` | 0 | Read and inserted by `persistIndicatorSnapshots()` | Schedule orchestrator only |
| `schedule_alerts` | 0 | Read/insert/update/resolve by Schedule alert workflow | Schedule alert workflow only |
| `schedule_activity_map` | 0 | No runtime caller yet | Later reviewed mapping workflow; no replacement mapping table |
| `schedule_observed_events` | 0 | No runtime caller yet | Separately approved observed-evidence phase |

The full current column list is maintained in the [database table and caller inventory](../db-table-callers-inventory.md).

### 4.2 Schedule source topology

| Source | Live rows | Role |
|---|---:|---|
| MAIN `gantt_files_test` | 1 | Current uploaded Schedule version metadata |
| MAIN `gantt_tasks_test` | 382 | Current uploaded Schedule activities |
| APP DATA `gantt_files` | 0 | Existing but not the populated runtime source |
| APP DATA `gantt_tasks` | 0 | Existing but not the populated runtime source |

Contracts work must not mutate, migrate, recreate, or replace these Gantt source rows or tables.

### 4.3 What the live OpenAPI audit proves

The audit confirms:

- Both configured Supabase targets are reachable.
- All eight canonical Schedule tables are exposed through the configured APP DATA Data API.
- Current columns, formats, defaults, and nullability are visible.
- Current row counts match the earlier 2026-08-05 inventory.
- The populated Gantt source remains in MAIN `_test` tables.

### 4.4 Catalog evidence still required before Phase 2

PostgREST OpenAPI does not fully expose live:

- Primary, unique, check, and foreign-key constraints.
- Index predicates and index ownership.
- Triggers and functions.
- RLS enablement and policies.
- Grants and effective role permissions.
- Table owners.

No read-only PostgreSQL catalog connection is configured in this checkout. Service-role visibility proves backend access, but does not prove the intended end-user RLS or grant posture.

This is not a Phase 1 blocker because Phase 1 performs no operational writes. It is a hard Phase 2 blocker. Before promotion work, the backend/security owner must provide a read-only catalog export or approved catalog query covering all eight tables.

## 5. Logical-to-physical reuse matrix

| Contracts fact or responsibility | Existing destination | Phase 0 classification | Required guard |
|---|---|---|---|
| Document hash/version identity | `source_document_id` where present; otherwise dry-run output | Partial fit | Never use a URL as document identity; conditions lack a typed document ID |
| Document authority/version/supersession | No verified first-class Schedule destination | Dry-run only | Must not be inferred from filename or header date |
| Project binding | Existing `project_id` on operational tables | Fits only after review | Explicit user selection and mismatch validation required |
| Fixed reviewed contractual date | `schedule_contract_milestones` | Fits existing typed columns | Requires authority, project, evidence, review, source version, confidence, and stable milestone key |
| Unresolved positive relative deadline | `schedule_contract_conditions` | Structural fit with gaps | One anchor, one numeric offset, supported unit, exact evidence; source-version/review audit gap remains |
| Recurring simple condition | `schedule_contract_conditions.recurring` | Partial fit | The table does not preserve immutable occurrence history |
| Sub-day deadline | No safe operational destination | Dry-run only | Existing milestone projection is date-only |
| Negative offset | No supported current resolver path | Dry-run only | Must not be converted into a positive offset |
| Compound or branching rule | No safe single-row representation | Dry-run only | Preserve rule structure; do not flatten away guards or branches |
| Approved quantified extension event | `schedule_contract_extensions` | Fits calendar-day event only | Must name an existing milestone and explicitly write status; rules/claims are not approvals |
| Working-day, hourly, monthly, scoped, or variable extension | No safe extension representation | Dry-run only | `extension_days` is consumed as calendar days by the current Engine |
| Contract consequence/charge | `schedule_contract_conditions.penalty_ils_per_day` only after review | Partial fit | Conflict and day semantics must be resolved first |
| Candidate review and reviewer history | No verified first-class Schedule destination | Dry-run only | Metadata is not a substitute for an immutable review record |
| Conflict history and superseded candidates | No verified first-class Schedule destination | Dry-run only | Preserve all candidates; no model-selected winner |
| Contract/activity alias | `schedule_activity_map` | Fits later reviewed mapping phase | Existing stable/canonical activity identity must be confirmed first |
| Reviewed observed project event | `schedule_observed_events` | Fits separately approved later phase | Contracts Agent does not write project observations |
| Project working calendar | `schedule_calendars` | Read/reference only | Contracts Agent never silently overwrites a calendar |
| Derived indicator | `schedule_indicator_snapshots` | Not a Contracts write target | Existing Schedule orchestrator only |
| Alert lifecycle | `schedule_alerts` | Not a Contracts write target | Existing alert workflow only |

### 5.1 Operational conclusion

The existing tables support the future operational projection of:

- Reviewed fixed milestones.
- Supported unresolved relative conditions.
- Reviewed calendar-day extension events.
- Reviewed activity aliases/mappings.
- Later reviewed observed events.

They do not currently provide a verified complete home for document authority, candidate staging, reviewer decisions, immutable conflict history, or compound/recurring occurrence history. Therefore Phase 1 must remain dry-run and Phase 2 must not be inferred as approved.

## 6. Identity and compatibility lock

### 6.1 Contracts identities

The proposed stable identities are:

- `documentVersionId = sha256:<64-hex-document-hash>`
- `candidateKey = contract:<first-12-hash-chars>:clause:<normalized-clause>:role:<normalized-role>`
- Conflict identity is a stable semantic group key scoped to the document version.

Model wording, summaries, translations, and confidence values are not key material.

Reprocessing the same bytes and the same clause-role pair must produce the same candidate key. A new document version produces new versioned candidates connected through a future reviewed supersession record; it must not silently overwrite source facts.

### 6.2 Existing Schedule identities remain unchanged

- Version selection remains `relevancy_date`, then `uploaded_at`, then `file_id`.
- `activityKey` remains `gantt:<fileId>:<taskUid>`.
- Cross-version `stableKey` remains `task_uid` until a separately approved identity decision.
- Contract milestone identity remains project plus `milestone_key` under the existing table contract.
- Condition-resolved milestone keys remain under the existing resolver policy.
- Snapshot subject, version, and alert surrogate identities remain unchanged.

The future additive mapping seam is the existing `schedule_activity_map`; it is not a license to replace activity keys.

### 6.3 Cross-database identity warning

MAIN and KAPAIM cannot enforce a foreign key across databases. Current Schedule routes require a non-empty `projectId`, but source inspection does not prove membership or namespace equivalence at the route boundary. Phase 1 may use an explicitly selected project only as binding context; Phase 2 must define and enforce the tenant/project identity namespace before writes.

## 7. Protected Schedule regression contract

### 7.1 Focused test baseline

Command:

`npm.cmd run test:schedule`

Result on local HEAD:

- 47 passed.
- 0 failed.
- 0 skipped.
- Exit code 0.
- No live HTTP, Supabase, OpenRouter, browser, or database write occurred.

Coverage groups:

| Area | Tests |
|---|---:|
| Calendar | 3 |
| Schedule Engine | 24 |
| Ingestion normalization/configuration | 4 |
| Orchestrator/snapshot/health | 4 |
| Alert planner | 5 |
| Condition resolver | 7 |

### 7.2 Representative golden outputs

| Case | Protected result |
|---|---|
| Flagship late task | `delayed_vs_contractor`, 226 calendar days late, 162 working days late, confidence 0.4/low, severity 4 |
| Contract milestone plus approved extension | Effective date `2026-07-01`, 30 extension days, `contract_finish`, 34 days late, `milestone_delayed`, severity 5 |
| Hidden cross-version slippage | `hidden_slippage`, 31 days |
| Sweep fixture | 4 total, 3 matched; 2 delayed and 1 on track |
| Health fixture | 3 computed, 2 late, 535 total days late, 1 delayed milestone |
| Calendar condition | 14 days after `2026-08-05` resolves to `2026-08-19` |
| Missing working calendar | Working-day condition stays unresolved with `working_calendar_missing` |
| Sub-day condition | 12-hour rule stays unresolved with `subday_deadline_cannot_be_stored_as_date` |

The full output-shape and case inventory remains in `test/schedule-engine.test.js`. Runtime timestamps must be normalized or pinned for future byte-stable fixtures.

### 7.3 Protected file hashes

| Protected file | SHA-256 |
|---|---|
| `src/scheduleEngine.js` | `EA9EE4D4460672680611CCEE5984C971011032F61B17BF5DFA98A929048D7975` |
| `src/scheduleCalendar.js` | `B972EAA0CBF456D99DBA05AE96D074ED9B7685A8B7217CDB262A75EF8FC6AA2C` |
| `src/scheduleIngestion.js` | `2F8FE2AEF67125C40864B14A79A906D42FF7F11CAEE64C2BC455521C7810B28D` |
| `src/subagents/schedule.js` | `AA631BF2501C56EAD2E357C8C1E1020938B0B448F26229C17E0EC74152EA76E0` |
| `src/subagents/scheduleConditionResolver.js` | `2C98B6DA12ED9750959F926AF98BC6F672AD1B35FC423A1C10F30E94DD2CA4A9` |
| `test/schedule-engine.test.js` | `B6E19FAA42263549E1360E32D90847217604C77DBA10AA801AAC7F36B6A6B67C` |
| `src/react/SchedulePage.jsx` | `91EB33B927D9D6967572E57F7544B484FE5838837BD1BF1E339F13666DA8E56C` |

`src/server.js` is intentionally recorded outside the immutable core hash gate because the remote-only diagnostics commit changes it. Any Phase 1 server edit must first establish the reconciled server baseline while leaving all Schedule routes behaviorally unchanged.

## 8. Contracts Agent output and temporal ontology

The normative Phase 1 output is [contracts-agent-output.v1.schema.json](./schemas/contracts-agent-output.v1.schema.json).

### 8.1 Output classes

- Fixed milestone.
- Relative condition.
- Recurring rule.
- Extension rule.
- Extension event.
- Consequence or contractual charge.
- Notice rule.
- Missing-information record.
- Conflict group.

### 8.2 Temporal grammar

Every candidate preserves, when present:

- Literal trigger.
- Literal value and unit.
- Direction: before, after, or unspecified.
- Calendar reference.
- Inclusivity.
- Roll convention.
- Recurrence and occurrence policy.
- Compound guards or branching semantics in metadata until first-class support exists.
- Exact page, clause, source excerpt, and document hash.

Supported extraction units are calendar days, working days, weeks, months, hours, and unknown. Extraction support does not imply operational date-computation support.

The Contracts Agent never calculates lateness, effective milestone dates, forecasts, variance, severity, entitlement, legal precedence, or alert state.

### 8.3 Projection policy

Each candidate receives exactly one classification:

- `project_schedule`
- `contract_compliance`
- `both`
- `none`

Only a separately reviewed `project_schedule` or `both` candidate may be considered for a later Schedule projection. Phase 1 always returns `automaticPromotionAllowed: false`.

## 9. Human review and conflict policy

### 9.1 Separate approvals

Two approvals must never be conflated:

1. Gold annotation approval: a human confirms that the PDF text and structured interpretation are accurate for evaluation.
2. Operational approval: an authorized contract/project owner confirms document authority, project binding, projection, and use in Schedule Intelligence.

Gold annotation approval never authorizes an operational write.

### 9.2 Required operational gates

Before any future operational fact is eligible, it must have:

- Verified authoritative document status.
- Explicit project binding.
- Stable source-document/version identity.
- Stable candidate identity.
- Exact page/clause evidence.
- Explicit review decision and reviewer identity.
- Explicit fact status and confidence.
- No unresolved material conflict.
- A supported projection and storage contract.

Defaults in database columns are not evidence. Future writers must always provide status, confidence, source identity, evidence, and writer identity explicitly.

### 9.3 Conflict policy

- Preserve all competing candidates.
- Assign one stable conflict group.
- Do not infer or model-select a winner.
- Keep selected value, reviewer, reason, timestamp, and superseded candidates in an immutable review record before Phase 2 promotion.
- If no approved review/audit destination exists, the conflict remains dry-run only.

## 10. Sample contract gold annotation

The draft gold annotation is [sample-herzliya-contract.annotation.json](./gold-set/sample-herzliya-contract.annotation.json).

Its required safe outcome is:

| Finding | Gold result |
|---|---|
| Execution | `unverified` because visible signature fields are blank |
| Project binding | `needs_review`; no automatic binding |
| Completion rule | Commencement plus 100 working days |
| Computed completion | `null` |
| Calendar | Missing |
| Delay charge | Unresolved conflict between NIS 2,000/day and NIS 3,250/day |
| Extension rows | 0; clause 6.6 is a rule, not an extension event |
| Fixed milestone rows | 0 |
| Approved Schedule projections | 0 |

The annotation preserves twelve candidate records, one material conflict, five missing-information records, and three referenced packet gaps.

The most important future condition candidate is the 100-working-day completion rule. It remains blocked because commencement, authoritative calendar, execution authority, project binding, and human review are unresolved.

## 11. Representative evaluation set

The [representative variants](./gold-set/representative-contract-variants.json) are synthetic and cover:

- Signed fixed completion date.
- Working-day relative deadline with a missing calendar.
- Approved quantified calendar-day extension event.
- Unsigned document with project mismatch.
- Compound recurring monthly payment chain.
- Negative-offset bond-renewal rule.

These variants are evaluation scaffolding, not real project evidence and not a production-generalization claim. Additional real, authorized contracts are required before operational rollout.

### 11.1 Phase 1 evaluation thresholds

Safety assertions must pass at 100%:

- Schema-valid output.
- Stable document and candidate identities across identical reruns.
- Every critical date, duration, amount, and clause has exact page evidence.
- Blank or missing facts remain missing.
- Material conflicts remain unresolved.
- Project mismatch blocks automatic binding.
- Extension rules are not emitted as approved extension events.
- No computed Schedule date, lateness, severity, or alert state is emitted.
- No operational database write is attempted.

Quality targets across the approved gold set:

- Critical number/date/duration recall: 100%.
- Evidence-page accuracy: 100%.
- Conflict-pair recall: 100%.
- Candidate class micro-F1: at least 0.90.
- Projection-class macro-F1: at least 0.90.
- False operational eligibility: 0.

These thresholds may be tightened after more real contracts are annotated; they must not be weakened to make a model pass.

## 12. Canonical API and component ownership proposal

This section is proposed for CTO/backend approval; it is not implemented in Phase 0.

### 12.1 Phase 1 API

Canonical route:

`POST /api/contracts/extract`

Proposed bounded request contract:

- Existing authentication gate applies.
- JSON request with an explicitly bounded base64 PDF payload for the MVP.
- Required filename and `application/pdf` media type.
- Explicit project selection may be provided for binding validation; omission keeps the result unbound.
- Mode is always `dry_run` in Phase 1.
- The server does not persist the uploaded bytes or extracted candidates.
- Telemetry contains hashes, sizes, timings, model/version identifiers, and aggregate counts only; it never logs raw PDF bytes, full evidence text, credentials, or unauthorized content.

The older specification's unimplemented `/api/schedule/evaluate-source` remains reserved for separately approved observed project evidence. It must not be overloaded with contract-authority and contract-review semantics.

### 12.2 Proposed Phase 1 components

| Component | Responsibility | Forbidden responsibility |
|---|---|---|
| Contracts PDF reader | Bounded PDF validation and page-aware text extraction | Persistence, schedule arithmetic, OCR claims without evidence |
| Contracts Agent | Clause segmentation and typed candidate extraction | Date calculation, project selection, conflict resolution, legal conclusion |
| Deterministic Contracts validator | Schema, stable keys, evidence, authority, project-binding, and safety invariants | Model inference or Schedule computation |
| Contracts API adapter | Authentication, size/type bounds, dry-run orchestration, safe response | Schedule table writes |
| Gold-set evaluator | Exact and scored comparison against approved annotations | Production writes or live-project mutation |

All components are internal code under the current strategic direction; no new n8n workflow is introduced.

## 13. Security and ownership findings

The following findings do not authorize unrelated fixes in Phase 1, but must be assigned:

1. APP DATA configuration can fall back to MAIN; every future operational writer must assert the resolved non-secret target before writing.
2. Per-request content credentials are accepted by the backend; tenancy and URL/key-pair rules require a documented owner.
3. Project identity is application-enforced across MAIN and KAPAIM; no cross-database foreign key exists.
4. `GET /api/schedule/projects` enumerates MAIN schedule projects without a caller-supplied project filter and must remain superadmin-only.
5. Run-event streaming is handled before the global authorization wall; Phase 1 must not place raw contract evidence in run events.
6. Schedule table-name overrides are not currently restricted to the locked eight-table set; a future writer must pin canonical targets.
7. Several intended uniqueness rules may fail open when source identity is null; operational writers must require stable source identity.
8. Reviewer UUID ownership across KAPAIM and MAIN/Meta is unresolved.
9. The condition resolver accepts `commit` and `minConfidence` from the caller; future human-review enforcement must be server-owned rather than a UI convention.

Items 1-9 are not permission to change Schedule behavior during Phase 1. They are compatibility and security gates for later operational promotion.

## 14. Phase 0 decision register

| ID | Proposed/locked decision | Status after this phase | Next gate |
|---|---|---|---|
| D-00 | Existing Schedule behavior is the protected compatibility baseline; necessary integration extensions must reuse the existing modules and carry focused regression evidence | CTO clarified; baseline captured | Re-run before and after every implementation slice |
| D-01 | Reuse all eight existing tables; zero DDL by default | CTO locked; OpenAPI audit complete; catalog detail pending | Backend/security catalog evidence before Phase 2 |
| D-02 | Gantt parser ownership remains outside Contracts Phase 1 | Deferred, non-blocking | CTO/frontend/backend owner before Phase 5 |
| D-03 | Hash/clause/role candidate identity and existing activity-map seam | Proposed | CTO/backend approval before Phase 1 |
| D-04 | Document authority must be explicit and reviewed | Proposed | Contract/product/CTO approval before Phase 1 |
| D-05 | Project binding requires explicit selection; mismatch blocks | Proposed | Product/CTO approval before Phase 1 |
| D-06 | Preserve literal temporal grammar; no Contracts arithmetic | Proposed | Contract/backend approval before Phase 1 |
| D-07 | Only reviewed `project_schedule` or `both` may later affect delay indicators | Proposed | Product/contract/CTO approval before Phase 1 |
| D-08 | Every operational fact requires human review | Proposed | Product/contract/CTO approval before Phase 1 |
| D-09 | Existing snapshot identity and persistence remain frozen | Locked baseline | Separate exception for any future change |
| D-10 | Existing status/confidence/as-of behavior is authoritative | Locked baseline | Separate exception for any future change |
| D-11 | Alerts remain back-office shadow-first and use existing `schedule_alerts` | Proposed; non-blocking for Phase 1 | Product/CTO before Phase 6 |
| D-12 | Evidence permissions must survive every layer | Partially verified | Security owner before Phase 1 logging and before Phase 2 persistence |

## 15. Approval checklist for Phase 1

Phase 1 may begin only when the following are acknowledged:

- [ ] CTO approves D-03 through D-08 and the `/api/contracts/extract` route boundary.
- [ ] Contract/product owner approves the annotation guide and sample gold interpretation.
- [ ] Backend/security owner approves the Phase 1 no-persistence and safe-telemetry boundary.
- [ ] Backend/security owner records the live catalog audit as a Phase 2 blocker, not as permission for DDL.
- [ ] Repository owner decides whether to reconcile the one remote diagnostics commit before the first `src/server.js` edit.
- [ ] All reviewers confirm that Phase 1 does not change Schedule Engine files, existing Schedule tables, or Schedule UI behavior.

## 16. Phase 0 completion record

Completed in this phase:

- Live read-only table exposure, columns, defaults, nullability, and row-count verification.
- Current caller/writer map.
- Existing-table reuse and compatibility matrix.
- Protected Schedule regression baseline and hashes.
- Identity, ontology, projection, review, and conflict policies.
- Contracts Agent JSON Schema.
- Page-grounded sample gold annotation draft.
- Six synthetic representative evaluation variants.
- Proposed API names and component ownership.
- Explicit gaps and later-phase blockers.

Not performed:

- Runtime Contracts Agent implementation.
- Schedule Engine, Calendar, ingestion, resolver, API, or UI modification.
- Operational candidate persistence.
- Database DDL, migration, RPC, or row write.
- Deployment or production change.
- UI implementation or browser-facing feature change.

Historical transition note (updated 2026-08-10): the CTO-approved Phase 1 dry-run slice was subsequently authorized, implemented, and accepted. Phase 0 remains the design baseline, subject to the CTO's 2026-08-10 Engine-reuse clarification above; the passing live artifact and current status are recorded in [BIDoc Phase 1 Contracts Agent Dry Run](./BIDoc_Phase_1_Contracts_Agent_Dry_Run.md). Phase 2 has entered its separately approved read-only schema-reuse checkpoint; its operational persistence status and required decisions are recorded in [BIDoc Phase 2 Entry and Schema-Reuse Gate](./BIDoc_Phase_2_Entry_Schema_Reuse_and_Promotion_Gate.md).
