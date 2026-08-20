# BIDoc Contracts R6 - Phase 1 Target Schema Approval

Date: 2026-08-19

Status: proposal only. This document authorizes no database, API, UI, model, deployment, or data mutation.

## 1. Decision Requested

Approve the target data contract below before starting Phase 2.

The objective is to make the Contracts data usable by the future Indicator agent while keeping the two existing Contracts agents, review flow, saved contracts, and relationship graph intact.

The target is inspired by `public.meetings_documents` and `public.meetings`:

1. source records are searchable content rows with tags and embeddings;
2. normalized records are searchable, reviewed knowledge rows with tags and embeddings;
3. the Contracts flow owns source-grounded interpretation only;
4. the Indicator agent owns any future operational placement or scheduling.

## 2. Fixed Product Boundary

The following rules are locked for the later implementation:

- Contracts does not write to the Schedule board.
- Contracts does not calculate actual trigger dates or due dates.
- Contracts does not use `schedule_project_id` or `projection_status` as live product fields.
- The existing saved clauses, decisions, and relationships are preserved during migration.
- `CONTENT_SUPABASE_SERVICE_ROLE_KEY` remains server-only. No public client receives it.
- The existing Contracts tab remains functional throughout the migration. UI wording changes only in Phase 4.

## 3. Target Table Roles

| Table | Role after R6 | Comparable Meetings table |
| --- | --- | --- |
| `private.contracts_documents` | One parsed contract clause or document context row. This is the searchable source record. | `public.meetings_documents` |
| `private.contracts` | One reviewed contractual knowledge/decision record prepared for Indicator. | `public.meetings` |
| `private.contract_relationships` | Relationship graph between source clauses and reviewed decisions. | No Meetings equivalent; retain as an internal graph table. |
| `private.contract_workspaces` and technical history | Upload, parser generation, resume, idempotency, and migration mechanics. These are not product-facing Contract records. | No Meetings equivalent needed. |

## 4. `contracts_documents` Target Columns

`private.contracts_documents` becomes a compact clause-content table. Its business-facing shape is intentionally close to `meetings_documents`.

| Column | Type | Required | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Stable source-row identity. UUID remains because current decisions and relationships already reference it. |
| `project_id` | `uuid` | Yes | Project scope. Replaces the product-facing name `source_project_id`. |
| `created_at` | `timestamptz` | Yes | Row creation audit timestamp. |
| `workspace_id` | `uuid` | Yes | Link to the existing private upload/parser workspace. It is technical, not displayed as a business field. |
| `attachment_id` | `text` | Yes | Uploaded contract attachment identity. |
| `document_name` | `text` | No | Original contract filename. |
| `content` | `text` | Yes | Exact clause or document-context text. This is the source passed to retrieval and later processing. |
| `metadata` | `jsonb` | No | Compact clause context: parser version, source hash, page locators, extraction notes, and non-product diagnostics. |
| `chunk_index` | `integer` | Yes | Stable display and retrieval order. It replaces the product-facing need for `clause_order`. |
| `chunk_total` | `integer` | No | Number of stored rows for the same parsed document generation. |
| `clause_key` | `text` | Yes | Human-readable source anchor such as `6.7` or `appendix_b.3`. |
| `parent_clause_key` | `text` | No | Contract hierarchy support for subclauses. |
| `clause_type` | `text` | Yes | `clause`, `subclause`, `appendix_item`, or `document_context`. |
| `page_start` | `integer` | No | First source page for legal review. |
| `page_end` | `integer` | No | Last source page for legal review. |
| `hashtags` | `text[]` | No | Existing project Hebrew hashtags only, preserving the shared dictionary's canonical spelling. |
| `embedding` | `public.vector` | No | 3072-dimension semantic embedding generated from final source content. |

### 4.1 Explicitly not kept as top-level source columns

The following current fields move to `metadata`, the existing workspace table, or a technical history mechanism. They must not be presented as normal Contracts data columns:

- `document_version_id`
- `document_sha256`
- `parser_generation_id`
- `raw_text_sha256`
- `raw_data`
- `summary_he`
- `cross_references`
- `index_ref`
- `processing_status`
- `processing_error`
- `parser_version`
- `extractor_version`
- `processed_at`
- `updated_at`

This does not mean that source integrity, resume, or relationship evidence are discarded. It means they are kept in their technical owner instead of crowding the product table.

## 5. `contracts` Target Columns

`private.contracts` becomes a reviewed, searchable contractual knowledge table. A row describes what the contract says, not what the Schedule system should do.

| Column | Type | Required | Purpose |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Stable decision identity and relationship endpoint. |
| `project_id` | `uuid` | Yes | Project scope. |
| `source_document_id` | `uuid` | Yes | Primary source clause in `contracts_documents`. |
| `created_at` | `timestamptz` | Yes | Creation audit timestamp. |
| `title_he` | `text` | Yes | Short Hebrew decision title. |
| `summary_he` | `text` | Yes | Clear Hebrew summary for the tab and Indicator. |
| `content` | `text` | Yes | Full normalized Hebrew contractual meaning. |
| `metadata` | `jsonb` | No | Source evidence, policy/model version, parser generation, and append-only lineage details. |
| `hashtags` | `text[]` | No | Existing project Hebrew hashtags only, preserving the shared dictionary's canonical spelling. |
| `embedding` | `public.vector` | No | 3072-dimension semantic embedding generated from final normalized content. |
| `responsible_party` | `text` | No | Party responsible under the contract. |
| `beneficiary` | `text` | No | Party benefiting under the contract. |
| `category_he` | `text` | Yes | Hebrew contractual category from the controlled category catalog. |
| `indicator_suitability` | `text` | Yes | `מתאים`, `לא_מתאים`, or `נדרשת_בדיקה`. This replaces `schedule_impact`. |
| `timing` | `jsonb` | No | Contractual timing only: fixed date, relative offset, recurrence, and calendar semantics. It never contains actual project trigger or due dates. |
| `trigger_he` | `text` | No | Hebrew-only trigger selected from the approved trigger catalog. |
| `trigger_description_he` | `text` | No | Source-faithful Hebrew explanation of the trigger. |
| `review_status` | `text` | Yes | `מוצע`, `מאושר`, `תוקן`, `נדחה`, `לא_פתור`, `הוחלף`. |
| `reviewed_at` | `timestamptz` | No | Review audit timestamp. |
| `review_reason_he` | `text` | No | Hebrew explanation of the review action. |

### 5.1 Explicitly removed from the product contract

These fields are legacy schedule design or duplicate state. They are not part of the R6 Contracts-to-Indicator record:

- `schedule_project_id`
- `projection_status`
- `schedule_impact` (replaced by `indicator_suitability`)
- `people`
- `recurring` (represented inside `timing`)
- `contract_date` (represented inside `timing`)
- `trigger_kind` (replaced by `trigger_he`)
- `offset_value` (represented inside `timing`)
- `offset_unit` (represented inside `timing`)
- `calendar_semantics` (represented inside `timing`)

The current fields `decision_key`, `revision`, `supersedes_decision_id`, model version, policy version, and full source-evidence list remain necessary for R4.2C lineage and legal traceability. They move to technical metadata/history or remain available through an internal audit view; they do not appear in the product-facing Contracts row.

## 6. Tags and Triggers

### 6.1 Hashtags

Current repository evidence shows that project hashtags are held on existing content rows and aggregated by the Insights endpoint. There is no canonical tag table to reference today.

Phase 2 must therefore introduce one controlled internal catalog, seeded only from the existing Hebrew project hashtag dictionary after a read-only frequency audit. The catalog preserves the approved Hebrew vocabulary exactly; Contracts does not translate, rename, or introduce English tags:

`private.contract_tag_catalog`

Minimum columns:

| Column | Purpose |
| --- | --- |
| `tag_he` | Canonical Hebrew project hashtag, unique and stored without `#`. |
| `active` | Whether the tag may be assigned to new Contracts rows. |
| `created_at` | Audit timestamp. |
| `source` | `existing_project_vocabulary` or approved future source. |

Contracts agents may select only active Hebrew catalog values. They must not invent Contracts-only or English tags.

### 6.2 Trigger catalog

Phase 2 must introduce:

`private.contract_trigger_catalog`

Minimum columns:

| Column | Purpose |
| --- | --- |
| `trigger_he` | Canonical Hebrew trigger name, unique. |
| `active` | Whether the trigger may be selected. |
| `sort_order` | Stable UI order. |
| `created_at` | Audit timestamp. |

The first catalog seed is intentionally small and editable:

- `חתימת ההסכם`
- `תחילת העבודה`
- `קבלת הודעה`
- `מסירת מסמך`
- `אישור מנהל`
- `בדיקה או מסירה`
- `סיום תקופה`
- `אירוע אחר המפורט בחוזה`

`trigger_he` and `trigger_description_he` are Hebrew only. `trigger_description_he` preserves the source wording when the standardized trigger is not sufficient.

## 7. Embedding Contract

Both Contracts tables require embeddings because both have independent retrieval value:

| Table | Text embedded | When written |
| --- | --- | --- |
| `contracts_documents` | Final source `content` plus the assigned Hebrew hashtags. | After parsing and controlled-tag assignment. |
| `contracts` | `title_he`, `summary_he`, normalized `content`, Hebrew hashtags, and Hebrew trigger. | After decision normalization and before/at review persistence. |

The target is a nullable `public.vector` column with a 3072-dimension HNSW half-vector cosine index, matching the Meetings pattern supplied for this approval.

Embeddings must be regenerated only when the embedded input changes. They do not replace source evidence or human review.

## 8. Model Boundary

The lean model is the default for bounded extraction/normalization work:

| Flow | Target model | Reason |
| --- | --- | --- |
| Clause enrichment and controlled Hebrew-hashtag assignment | `cfg.models.lite` | Each call processes bounded source rows and produces concise structured output. |
| Contract decision normalization | `cfg.models.lite` | It transforms reviewed source evidence into one structured knowledge record. |
| Semantic relationship discovery | Unchanged in Phase 2 | It compares legal meaning across clause pairs. Any downgrade requires a separate quality evaluation. |
| Indicator handoff | No model call | It is a read-only prepared payload. |

## 9. Compatibility and Migration Rules

1. Phase 2 is additive. No existing Contracts column is dropped.
2. Existing saved rows are copied/backfilled before any reader switches to R6 fields.
3. Existing APIs keep returning their current response fields until the Contracts tab is updated in Phase 4.
4. A compatibility adapter supplies legacy response names during the transition.
5. The old schedule fields remain read-only and deprecated until Phase 5 verification passes.
6. `private.contract_relationships` is not redesigned in Phase 2. Its typed endpoints and review lineage remain intact.
7. No new Contracts table is exposed through the public Data API. Server-side access and existing tenant controls remain in force.

## 10. Phase 2 Acceptance Criteria

Phase 2 may start only after this document is approved. It is complete only when all of the following are true:

- Both target tables have nullable 3072-dimension embedding columns and HNSW indexes.
- No existing saved Contracts row is deleted or overwritten.
- A read-only tag audit produces the proposed catalog seed from current project hashtags.
- All persisted new Contracts tags are active shared-project Hebrew catalog values.
- All persisted new triggers are active Hebrew catalog values.
- `indicator_suitability` exists without changing actual scheduling behavior.
- Existing Contracts UI/API behavior remains compatible.
- No Schedule write, Indicator operational write, or deployment is performed.

## 11. Approval Checklist

Approve Phase 1 only if the following statements are correct:

- [ ] `contracts_documents` will be modeled as a searchable clause-content table similar to `meetings_documents`.
- [ ] `contracts` will be modeled as a searchable reviewed-knowledge table similar to `meetings`.
- [ ] Both tables will contain embeddings.
- [ ] Contracts will use only approved existing-project Hebrew hashtags through a controlled catalog.
- [ ] Trigger values will be Hebrew-only and validated by a catalog.
- [ ] `indicator_suitability` replaces scheduling language in the Contracts product model.
- [ ] Schedule-specific fields are deprecated only after compatibility and Indicator handoff verification.
- [ ] Phase 2 remains additive and database-safe.

## 12. Explicit Non-Approval

This phase does not approve:

- applying SQL to KAPAIM/Supabase;
- changing the current Contracts tab;
- changing model configuration;
- generating embeddings for existing rows;
- deleting old fields or tables;
- changing Indicator behavior;
- deployment or Vercel environment changes.
