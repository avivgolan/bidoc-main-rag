# BIDoc Contracts R6 Phase 4A - Target Projection Preparation Checkpoint

Date: 2026-08-22
Status: prepared and locally reviewed only; not applied to KAPAIM

## Approved Scope

Phase 4A prepares the additive transition from the R1/R4 technical tables to the CTO-approved R6 Contracts shape. It does not delete legacy fields, regenerate embeddings, change the current Contracts UI/API, write to Indicator, write to Schedule, deploy, or mutate KAPAIM.

## Delivered Package

- Migration: `supabase/migrations/20260822003639_contracts_r6_phase4a_target_projection.sql`
- Post-apply acceptance: `supabase/tests/contracts-r6-phase4a-target-projection.sql`
- Safe rollback: `supabase/rollbacks/contracts_r6_phase4a_target_projection.rollback.sql`
- Product source view: `private.contracts_documents_product_r6_v1`
- Product decision view: `private.contracts_product_r6_v1`
- Status RPC: `public.bidoc_contracts_r6_phase4a_status_v1()`

The Supabase CLI `migration new` command was attempted first. The repository-pinned CLI returned the known Windows/OneDrive `LegacyMigrationNewWriteError: AlreadyExists` for the existing migrations directory, so the migration uses the timestamp captured immediately after that attempt.

## Projection Rules

### `contracts_documents`

| R6 field | Deterministic source |
| --- | --- |
| `project_id` | Existing immutable `source_project_id` |
| `attachment_id` | Workspace `storage_bucket + '/' + storage_object_key` |
| `document_name` | Original workspace `filename` |
| `content` | Existing finalized searchable clause content |
| `metadata` | Parser generation, source hashes, raw parser data, clause title/summary, cross-references, processing diagnostics, and Storage identity |
| `chunk_index` | Existing `clause_order` |
| `chunk_total` | Count for the same workspace, document version, and parser generation |
| `hashtags` in the product view | Existing values filtered through the active shared Hebrew tag catalog |

The product view includes only processed rows with non-empty content. The base table retains raw evidence and resume fields for the current agents and relationship graph.

### `contracts`

| R6 field | Deterministic source |
| --- | --- |
| `project_id` | Existing immutable `source_project_id` |
| `source_document_id` | Existing primary source clause ID |
| `content` | Existing normalized `decision_text_he` |
| `metadata` | Source evidence, model/policy identity, workspace/document generation, decision key, revision, predecessor, conflict, reviewer, and internal review code |
| `hashtags` | Existing tags filtered through the active shared Hebrew tag catalog |
| `category_he` | Locked Hebrew mapping already used by the Contracts UI |
| `timing` | Contractual kind/date/offset/calendar/recurrence only; never an actual project trigger or due date |
| `trigger_he` | Existing trigger only when it is active in the Hebrew trigger catalog |
| `review_reason_he` | Existing review reason when it contains Hebrew text |

The product decision view exposes only the latest append-only revision for each decision identity. Internal English status codes remain unchanged for R4.2C lineage and are translated in the view:

| Internal status | Product value |
| --- | --- |
| `proposed` | `מוצע` |
| `approved` | `מאושר` |
| `corrected` | `תוקן` |
| `rejected` | `נדחה` |
| `unresolved` | `לא_פתור` |
| `split`, `merged`, `superseded` | `הוחלף` |

## Safety Design

- Both source tables are locked during the bounded one-time backfill.
- Temporary snapshots preserve every pre-existing column and row identity.
- Only newly added projection fields are updated.
- The migration aborts if any legacy value, revision, row, evidence field, review field, or timestamp changes.
- Insert/update projection triggers keep future rows compatible without changing existing RPC payloads.
- Views use `security_invoker = true`, remain in the private schema, deny `anon` and `authenticated`, and grant read access only to `service_role`.
- The rollback removes views, triggers, constraints, and projection functions but deliberately retains additive columns and copied values. It performs no destructive column drop.

## Read-Only KAPAIM Preflight

The preparation audit queried aggregate schema/data state only and performed no DDL or data mutation.

- Clause rows: 313
- Processed clauses missing content: 0
- Clauses missing/mismatching workspace identity: 0
- Decision revisions: 421
- Current decision identities: 235
- Decisions missing a primary source clause: 0
- Decisions missing normalized content/project identity: 0
- Categories outside the 13-value locked map: 0
- Review reasons with no Hebrew text: 0
- Legacy trigger rows not in the active Hebrew catalog: 15
- Current historical decisions missing embeddings: 137
- Stored vectors with a non-3072 dimension: 0

The 15 legacy trigger values are not translated or invented. Their product `trigger_he` is `NULL`, while the original value remains in technical metadata. New R6 persistence already requires active Hebrew trigger values.

The 137 missing vectors are historical backfill debt, not a Phase 4A schema failure. A fresh read-only recheck of workspace `4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa` confirmed 124/124 processed clause vectors and 98/98 current decision vectors, each 3072 dimensions with matching input hashes. It also found zero invalid Hebrew tags and zero invalid Hebrew triggers for that contract. Phase 4A deliberately keeps the current canonical embedding strings unchanged, so it does not invalidate those vectors.

## UI and Indicator Impact

The current Contracts tab continues reading the existing RPC response shapes, so preparing or later applying Phase 4A does not switch the UI by itself. The new views are the clean handoff boundary for a later reader switch and future Indicator consumption. They contain no Schedule placement fields and perform no operational write.

## Local Verification

The migration dependency chain and Phase 4A were compiled in a separate disposable local PostgreSQL database. A synthetic contract then exercised future-write synchronization with two processed clauses and two append-only revisions of one decision.

- Initial Phase 4A apply: passed.
- Acceptance after future-write trigger exercise: passed.
- Product document rows: 2.
- Latest product decision rows: 1.
- Safe rollback: passed; two clause rows, two decision revisions, and all additive target columns were retained while both product views were removed.
- Reapply against existing rows: passed; the migration backfilled 2/2 clauses and 2/2 decision revisions without changing legacy snapshots.
- Acceptance after existing-row backfill: passed.
- Contracts test suite: 163/163 passed.
- Repository-wide test run: the new Contracts Phase 4A test passed, but the suite remains red on unrelated pre-existing React bridge cache-version and timeline swipe assertions.
- Supabase performance advisors: no issues.
- Supabase security advisors: one existing local warning that the required `vector` extension is installed in `public`; this matches the current KAPAIM/Meetings pgvector convention and was not introduced by Phase 4A.

## Acceptance Coverage

The acceptance SQL checks:

- exact CTO-approved view columns and latest-revision cardinality;
- deterministic parity between target fields and immutable legacy sources;
- Hebrew active tags and triggers only;
- allowed Hebrew review and Indicator suitability values;
- absence of actual project dates inside `timing`;
- private `security_invoker` views and service-role-only access;
- valid stored vector dimensions/input hashes and both 3072-dimension HNSW cosine indexes;
- explicit reporting of missing historical vectors and unmapped historical triggers.

## Stop Gate

Phase 4A is not applied. The next action requires a separate explicit approval to apply the migration to KAPAIM. After apply, run the acceptance SQL and then re-query the new contract through both product views before any UI reader switch or historical vector backfill is considered.
