# BIDoc Contracts Agent - Phase 2 Entry and Schema-Reuse Gate

- Date: 2026-08-10
- Status: Phase 2 KAPAIM schema/mapping gate complete; activation and reviewed live promotion pending
- Scope: Schema reuse, fail-closed promotion, local and remote database verification, and reviewer workflow
- Database changes: Three additive KAPAIM migrations and one approved MAIN-to-KAPAIM mapping
- Production changes: No application deployment or operational contract promotion

## Executive decision

Phase 1 is accepted, and the mandatory Schema Reuse and Regression Gate now permits only the installed fail-closed infrastructure. Operational Phase 2 contract writes remain disabled pending activation and a separately reviewed live promotion.

Approval update (2026-08-10): the CTO approved D2-01 through D2-04 using the recommendations recorded below. This closes the architecture-decision gate. It does not authorize applying DDL or enabling live writes; the exact additive schema, function signature, rollback plan, database tests, and permission diff must be reviewed as the next bounded checkpoint before any migration is applied.

Remote apply update (2026-08-10): the official migration plus two narrow verification follow-ups were applied to KAPAIM, and the reviewed MAIN-to-KAPAIM mapping was inserted. Remote checks confirm server-only RPC execution, an empty function `search_path`, private-table denial, read-only browser grants on the existing contract targets, and the advisor-requested mapping-FK index. Review and promotion audit counts remain zero. See [BIDoc Phase 2 Migration and Apply Checkpoint](./BIDoc_Phase_2_Migration_Apply_Checkpoint.md). Server-flag enablement, a live contract promotion, and deployment remain pending explicit approval.

The live audit proves that the three intended operational targets exist and can represent reviewed milestones, calendar-day extensions, and unresolved relative conditions. At audit time it also proved that four required lifecycle invariants had no live implementation:

1. MAIN and KAPAIM do not use the same project UUID for the currently relevant records, and no approved cross-database mapping contract exists.
2. No existing approved table preserves document authority, candidate versions, reviewer decisions, rejected candidates, conflict history, and supersession as immutable audit history.
3. No existing database function atomically commits review/audit state together with milestone, extension, or condition promotion.
4. The eight Schedule tables have RLS enabled but no policies, while `anon` and `authenticated` retain broad table grants. This is not an approved least-privilege writer model.

Therefore no milestone, extension, condition, review record, or other row was inserted, updated, or deleted.

## Live evidence

The audit used read-only PostgreSQL catalog queries against KAPAIM (`smxibuaowzuxkznuouwj`) and a read-only project-identity comparison against MAIN (`pmdnmzuqbcnzgkuhpfnx`). It inspected columns, nullability, defaults, checks, foreign keys, unique indexes, partial indexes, RLS state, policies, grants, triggers, row counts, and functions that reference the operational contract tables.

### Current row state

| Table | Rows | Phase responsibility |
| --- | ---: | --- |
| `projects` | 1 | KAPAIM project namespace |
| `schedule_calendars` | 1 | Existing Schedule calendar; Contracts reads only |
| `schedule_contract_milestones` | 0 | Phase 2 reviewed fixed milestones |
| `schedule_contract_extensions` | 0 | Phase 2 reviewed approved calendar-day extensions |
| `schedule_contract_conditions` | 0 | Phase 2 reviewed unresolved relative conditions |
| `schedule_indicator_snapshots` | 0 | Existing Schedule Engine output; not a Contracts writer target |
| `schedule_alerts` | 0 | Existing Schedule alert lifecycle; not a Phase 2 Contracts target |
| `schedule_activity_map` | 0 | Phase 3 mapping target |
| `schedule_observed_events` | 0 | Later observed-evidence target |

### Project namespace mismatch

The active IDs observed in the two databases are different:

- MAIN selected project: `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7`
- KAPAIM Schedule project/calendar: `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5`

The names also do not establish that these rows are the same project. Because PostgreSQL cannot enforce a foreign key across the two Supabase projects, an explicit reviewed namespace decision is required before a Contracts candidate can be promoted.

### Existing target contracts

| Target | Safe represented fact | Existing idempotency | Important limitation |
| --- | --- | --- | --- |
| `schedule_contract_milestones` | Reviewed fixed contractual date | Unique `(project_id, milestone_key)` | Requires KAPAIM project FK; no immutable review history |
| `schedule_contract_extensions` | Reviewed approved integer calendar-day extension | Partial unique `(project_id, milestone_key, source_document_id, extension_days)` | No project FK and no atomic review transaction |
| `schedule_contract_conditions` | Reviewed unresolved non-negative relative condition | Unique `(project_id, condition_key)` | No project FK; unqualified day semantics require explicit review |

The adapter always uses `documentVersionId` in `source_document_id`; it never stores an evidence URL as document identity. Exact excerpts and page/clause locations remain separate evidence fields.

### Constraint and permission findings

- All eight tables have RLS enabled.
- None of the eight has an RLS policy.
- `anon`, `authenticated`, and `service_role` currently have broad table privileges.
- With RLS enabled and no policies, normal `anon`/`authenticated` row access is denied, while the backend service role bypasses RLS.
- There is no existing function that references `schedule_contract_milestones`, `schedule_contract_extensions`, or `schedule_contract_conditions` and can provide atomic reviewed promotion.
- `schedule_contract_conditions`, `schedule_contract_extensions`, and `schedule_alerts` lack the project foreign keys present on several other Schedule tables.
- No DDL recommendation is executed by this checkpoint.

## Implemented local adapter

`src/contracts/promotionPlanner.js` is a pure, no-I/O Phase 2 planner. It performs no database request and returns `operationalWritesPerformed: false` in every result.

It refuses transaction readiness unless all five approvals are explicit:

1. `schemaAuditApproved`
2. `projectNamespaceApproved`
3. `reviewAuditPersistenceApproved`
4. `atomicPromotionApproved`
5. `permissionModelApproved`

It also validates:

- authoritative document approval;
- reviewer UUID, review timestamp, reason, and confidence;
- exact source evidence;
- resolved review gates;
- explicit MAIN-to-KAPAIM project mapping;
- conflict selection when a candidate is conflicting;
- approved existing-table target;
- fixed date, relative offset, or extension-specific material fields;
- stable document and candidate identity;
- rejection and unsupported candidates remaining non-operational.

When every prerequisite is simulated as approved in tests, it produces table-compatible transaction payloads for:

- `schedule_contract_milestones`;
- `schedule_contract_extensions`;
- `schedule_contract_conditions`.

It does not execute those payloads.

## Verification

- `npm.cmd run test:contracts` - 50/50 passed in the current Phase 2 package.
- Six new Phase 2 planner tests cover fail-closed global gates, fixed milestone mapping, unresolved-condition mapping, approved-extension mapping, rejection and unsupported compliance candidates, and whole-batch blocking when one reviewed item is unsafe.
- `npm.cmd run contracts:representative` - 6/6 exact canonical Phase 1 cases passed.
- `npm.cmd run test:schedule` - 47/47 protected Schedule regressions passed.
- `npm.cmd run react:build` - production React bundle built successfully.
- `node --check src/contracts/promotionPlanner.js` and `node --check test/contracts-agent.tests.js` - passed.
- `src/scheduleEngine.js` and `src/scheduleCalendar.js` retain their accepted SHA-256 hashes and have no diff in this checkpoint.
- `npm.cmd run test:contracts:db` passed against the isolated local Supabase/PostgreSQL stack; schema lint and security/performance advisors returned no issues.
- `npm.cmd run react:build` passed with the Contracts reviewer included; 1440px and 390px rendered checks showed no horizontal overflow.
- No live Supabase migration, remote SQL mutation, live REST/RPC write, or deployment occurred.

## Approved CTO/security decisions

### D2-01 - Project identity: approved

Use a bounded additive mapping table between the MAIN project UUID and the KAPAIM Schedule project UUID. Preserve the existing identifiers and calendar relationships. The mapping must enforce uniqueness and record approval identity, timestamp, reason, and lifecycle state. The adapter will never infer a mapping from project names or addresses.

### D2-02 - Review and audit persistence: approved

Use a bounded additive, append-oriented audit schema for immutable:

- document/version authority;
- candidate staging and supersession;
- approve/reject/correct/merge decisions;
- reviewer, timestamp, and reason;
- conflict selection and rejected alternatives;
- transaction outcome and failure history.

The existing Schedule tables remain the operational source of approved facts. Putting only the latest review object inside a mutable milestone `metadata` column does not satisfy this invariant.

### D2-03 - Atomic promotion: approved

Use one bounded PostgreSQL function/RPC transaction that records the reviewed decision and promotes the approved milestone, extension, or condition together. Any failure must prevent a partial operational promotion. Application-level sequential PostgREST calls are not treated as atomic.

### D2-04 - Permission model: approved

Only the server-side backend identity may invoke the promotion RPC. `anon` and `authenticated` receive no direct write access to the new audit/mapping structures, no direct operational Schedule writes for this workflow, and no execution permission on the promotion function. Exact grants, revocations, RLS behavior, function security mode, and `search_path` must be verified in the migration checkpoint. The service credential must never enter browser code.

Reference: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api).

## Separate security finding

The Supabase table/advisor audit also reported eight unrelated `jul_8_backup_*` tables with RLS disabled and exposed grants. This is outside the Contracts Phase 2 slice and was not changed automatically. It requires a separate security-owner review because enabling RLS without matching policies could break existing access.

## Stop gate

Phase 2 schema/mapping implementation and remote verification are complete. The review routes and UI are implemented but promotion remains paused by default. No server apply flag, deployment, or live Schedule promotion may be activated until the CTO/security owner explicitly approves the next operational sequence in [BIDoc Phase 2 Migration and Apply Checkpoint](./BIDoc_Phase_2_Migration_Apply_Checkpoint.md).

Phase 1 remains unchanged and accepted. The existing Schedule Engine, Calendar, tables, rows, and UI behavior remain unchanged.
