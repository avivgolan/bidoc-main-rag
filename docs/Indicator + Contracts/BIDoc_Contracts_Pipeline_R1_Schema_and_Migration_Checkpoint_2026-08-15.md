# BIDoc Contracts Pipeline R1 — Schema and Migration Checkpoint

- Date: 2026-08-15
- Branch: `feature/contracts-indicator-schedule-intelligence`
- Starting HEAD: `b62ad04983e0`
- Approval: CTO approval reported by the user; approver name not supplied. Separate R1 remote-apply approval was given by the user on 2026-08-15.
- Status: R1 package complete, applied to `Kapaim`, and verified
- Next gate: R2 and R3 were subsequently approved and completed; explicit approval is required before the R3.1 acceptance UI or R4

## 1. Outcome

R1 implements the approved clause-first database contract as an additive migration package. It adapts new workspaces without changing the existing Phase 3F.1 RPC signatures, creates the three locked private domain tables, adds bounded service-role-only R1 RPCs, and provides a preservation-safe rollback plus isolated database tests. After a separate user approval, the exact checked-in migration was applied to the connected `Kapaim` project and recorded there as migration `20260815114144_contracts_pipeline_r1_schema_lock`.

No source PDF or Storage object was changed. No Schedule target row was written. No remote seed or test row was created. Contracts clause processing, the Contracts Relationships Agent, review UI, projection execution, backfill, model processing, n8n changes, and application deployment were not part of R1.

## 2. Implemented artifacts

- [`20260815103618_contracts_pipeline_r1_schema_lock.sql`](../../supabase/migrations/20260815103618_contracts_pipeline_r1_schema_lock.sql)
  - adapts `private.contract_workspaces` for `contracts-workspace.r1.v1` while retaining legacy `contracts-workspace.phase3f1.v1` behavior;
  - makes Schedule mapping optional and removes it from the new R1 uniqueness identity;
  - adds explicit parser generation/version, prompt version, extractor version, and a database-verified fingerprint input;
  - creates `private.contracts_documents`, `private.contracts`, and `private.contract_relationships`;
  - adds scoped composite foreign keys, append-only revision guards, canonical symmetric relationship identity, fail-closed bounded JSON validators, status/check constraints, required FK/query indexes, forced RLS, and least-privilege grants;
  - adds versioned `SECURITY INVOKER` RPCs for R1 workspace upsert, clause insertion, decision revision append, and relationship revision append.
- [`contracts_pipeline_r1_schema_lock.rollback.sql`](../../supabase/rollbacks/contracts_pipeline_r1_schema_lock.rollback.sql)
  - refuses rollback when any R1-owned row exists;
  - otherwise removes only R1-owned schema/RPC/helper objects and restores the prior Phase 3F.1 workspace contract;
  - does not alter Schedule tables or managed Storage.
- [`contracts-pipeline-r1-schema-lock.sql`](../../supabase/tests/contracts-pipeline-r1-schema-lock.sql) and rollback/reapply fixtures in `supabase/tests/`.
- [`test-contracts-pipeline-r1-db.mjs`](../../scripts/test-contracts-pipeline-r1-db.mjs), exposed as `npm.cmd run test:contracts:r1-db`.

## 3. Locked implementation decisions

### 3.1 Workspace compatibility

The existing four-column Phase 3F.1 uniqueness constraint remains in place so `bidoc_contracts_upsert_workspace_v1` keeps its exact `ON CONFLICT` contract. New R1 workspaces also use a partial unique index on `(source_project_id, document_sha256, extraction_fingerprint)`, which excludes Schedule identity and applies only to `contracts-workspace.r1.v1`.

Legacy rows require `schedule_project_id` and have null R1 parser fields. R1 rows require the explicit parser/prompt/extractor fields while allowing `schedule_project_id` to remain null until later projection readiness.

### 3.2 Immutable evidence and revision history

Clause source identity, raw text/hash, page range, hierarchy, and locators cannot be updated or deleted. Only bounded processing/enrichment state can change through valid transitions.

Decision and relationship rows are append-only. The R1 append RPCs use transaction-scoped advisory locks and expected-revision checks; stale requests fail with SQLSTATE `40001`. Database triggers and composite self-foreign keys also enforce immediate predecessor scope and revision semantics.

### 3.3 Relationship typing and symmetry

Each source and target endpoint has exactly one typed clause/decision UUID. Four composite endpoint foreign keys enforce the same workspace, document version, and parser generation.

`relationship_key` is a generated lowercase SHA-256 value over the locked schema tag, document version, parser generation, relationship type, and typed endpoint tokens. `duplicates` and `conflicts_with` require canonical token ordering, so a reversed symmetric row is rejected.

### 3.4 Security and Schedule boundary

All three domain tables live in `private`, have RLS enabled and forced, and have no browser policies. `anon` and `authenticated` receive no table or RPC privileges. `service_role` receives `SELECT, INSERT, UPDATE` only for mutable clause processing rows and `SELECT, INSERT` only for append-only decision/relationship rows. No direct delete or truncate privilege is granted.

R1 adds only the optional decision-to-`public.projects` mapping FK needed for later readiness checks. It does not add source-decision columns to Schedule targets and performs no Schedule DML; projection linkage remains deferred to its separately approved phase.

### 3.5 Bounded JSON contracts

The migration resolves the four R0 JSON-shape questions with immutable fail-closed validators:

- `raw_data` is at most 256 KiB, has only the locked provenance keys, and requires 1–500 ordered segment objects with a positive page and bounded non-empty text;
- `source_evidence` is at most 256 KiB and contains 1–100 exact snapshot objects with only clause UUID, page range, lowercase source hash, and bounded excerpt;
- relationship `evidence` is at most 256 KiB and contains the same exact snapshot array, a bounded non-empty rationale, and optional object-valued deterministic/model signals;
- `index_ref`, when present, is at most 32 KiB and uses the exact `contracts-index-ref.r1.v1` reference shape without embedding or guessing a vector dimension.

Missing fields and wrong JSON types return explicit `false`; they cannot pass a PostgreSQL `CHECK` through SQL `NULL` semantics.

## 4. Verification evidence

The repository's Supabase CLI generated migration name `20260815103618_contracts_pipeline_r1_schema_lock.sql`. On this Windows runtime, direct generation into the existing migrations directory returned `LegacyMigrationNewWriteError: AlreadyExists`; the CLI generated the file in a clean staging workdir, and that exact generated file was moved into `supabase/migrations` before SQL was added.

`npm.cmd run test:contracts:r1-db` passed against the dedicated healthy PostgreSQL 17 container `supabase_db_bidoc-main-rag`. The harness verified:

- schema/function compilation from the Phase 3F.1 baseline;
- R1 workspace idempotency, nullable Schedule mapping, and parser-generation coexistence;
- clause hash verification, rerun reuse, and conflicting-source rejection;
- all four typed relationship endpoint combinations;
- cross-workspace, cross-document, and cross-generation rejection;
- symmetric reverse rejection and deterministic relationship keys;
- origin/confidence, review, temporal, projection-readiness, and processing constraints;
- valid and invalid bounded `raw_data`, `source_evidence`, relationship `evidence`, and `index_ref` shapes;
- two-client decision and relationship revision races, with exactly one winner and one SQLSTATE `40001` stale failure;
- forced RLS, browser denial, server-role least privilege, append-only history, and source-deletion rejection;
- unchanged Schedule milestone, condition, and extension row counts;
- populated rollback refusal;
- clean rollback preserving a legacy workspace and Schedule rows;
- successful R1 reapply over that preserved legacy workspace.

Additional verification passed:

- `npm.cmd run test:contracts`: 96/96 tests;
- `npm.cmd run test:schedule`: 47/47 tests;
- `npm.cmd run test:contracts:phase3-db`: passed against the full Phase 2–3G database fixture;
- R1 compiled successfully on top of that full fixture;
- `npx.cmd supabase db lint --local --schema private,public --level warning --fail-on error`: exit 0, no schema errors.

The final local catalog check found all three R1 tables with forced RLS, zero unvalidated R1 constraints, zero R1 `SECURITY DEFINER` functions, zero browser policies, and zero Schedule `source_contract_decision_id` columns. A conservative all-composite-column FK/index probe reported six pairs; manual inspection confirmed each uses a locked primary-identifier index or the scoped endpoint index required by the R0 contract, so no redundant speculative indexes were added without query-plan evidence.

Immediately before the approved remote apply, the connected `Kapaim` project was `ACTIVE_HEALTHY` on PostgreSQL 17.6. The preflight found no R1 tables or RPCs, no target lock waiters, no transactions older than 30 seconds, one legacy Phase 3F.1 workspace, and zero rows in each of the three Schedule targets. The checked-in migration had 1,389 lines and SHA-256 `89CB6FAE721409D21ED7C3B430E6A97ABCB39F3C45225D8F0DFDD87C5BEA77AE`.

The post-apply catalog verification found all three R1 relations, five R1 RPCs, forced RLS on every new table, zero browser policies, zero browser table/RPC privileges, zero R1 `SECURITY DEFINER` functions, empty search paths on all public R1 RPCs, and zero unvalidated constraints. `service_role` has exactly the intended table and RPC privileges and no direct delete or truncate privilege. All three new tables remain empty. The one legacy workspace remains present with its legacy Schedule mapping and null R1 metadata. The three Schedule target row counts remain zero, and no `source_contract_decision_id` column was added.

The advisor baseline was 85 security findings and 364 performance findings. After R1 it is 88 security findings and 390 performance findings: the R1 delta contains only informational notices. The three new security notices are the intentional server-only [`rls_enabled_no_policy`](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings. The 26 performance notices consist of empty-table unused-index notices plus conservative composite-FK coverage notices; they introduce no warning or error and will be revisited only with R2 query-plan evidence. The eight pre-existing security errors remain unrelated legacy `public.jul_8_backup_*` tables with RLS disabled and require a separate access-policy review. See the [Supabase `rls_disabled_in_public` remediation](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

## 5. Deferred work and stop gate

R2 was separately approved and completed locally after this checkpoint. Its deterministic clause-parser implementation, full Herzliya fixture evidence, and stop gate are recorded in the [R2 Contracts clause-parser checkpoint](./BIDoc_Contracts_Pipeline_R2_Contracts_Clause_Parser_Checkpoint_2026-08-15.md).

The R1 remote-apply gate and local R2 gate are complete. Stop before remote clause ingestion, Contracts Relationships Agent/UI implementation, contract reprocessing, backfill, Schedule projection, n8n change, or deployment; each remains separately gated.
