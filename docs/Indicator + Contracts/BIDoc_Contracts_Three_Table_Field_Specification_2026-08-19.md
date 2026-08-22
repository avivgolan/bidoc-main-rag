# BIDoc Contracts - Three Table Field Specification

Date: 2026-08-19

Scope: the three new Contracts domain tables in KAPAIM/BIDoc:

1. `private.contracts_documents`
2. `private.contracts`
3. `private.contract_relationships`

This file explains what each field means, what it is used for, and which fields are core versus questionable. It is intentionally written as a product and engineering reference, not as a migration script.

## Short Architecture Summary

| Table | Main purpose | What it owns |
| --- | --- | --- |
| `contracts_documents` | Immutable clause/source truth | The parsed contract structure: clauses, subclauses, appendix items, source text, page ranges, hashes, and enrichment metadata. |
| `contracts` | Normalized decision truth | The contractual decisions extracted from the source clauses, including review state and suitability for later Indicator handling. |
| `contract_relationships` | Canonical graph truth | Relationships between clauses/decisions: supports, conditions, exceptions, conflicts, duplicates, explicit references, split/merge lineage. |

## Field Status Legend

| Status | Meaning |
| --- | --- |
| Keep - core | Needed for the current product behavior. |
| Keep - audit | Needed for traceability, reproducibility, review history, or append-only lineage. |
| Keep - derived | Useful generated field derived from source data. |
| Review | Useful idea, but the current implementation should be clarified or constrained. |
| Candidate for cleanup | Currently unused, redundant, or legacy from an older design. Do not remove without checking runtime consumers first. |

## 1. `private.contracts_documents`

Purpose: stores the contract as structured source truth. Each row is one document-level unit, clause, subclause, or appendix item. This is the base table that lets the system reopen a saved contract without uploading and parsing the PDF again.

Live snapshot used during review: 189 rows. Current clause types: `clause`, `subclause`, `appendix_item`, `document_context`. `index_ref` is currently unused in the saved sample.

| Field | Meaning | Used for | Status / note |
| --- | --- | --- | --- |
| `id` | Physical row UUID. | Primary key and target for relationships/decisions. | Keep - core. |
| `workspace_id` | BIDoc workspace/customer scope. | Tenant isolation, RLS, scoped uniqueness. | Keep - core. |
| `source_project_id` | Original project ID in the source/main system. | Connects the parsed contract back to its source project. | Keep - core. |
| `document_version_id` | Stable namespaced document version identity, currently tied to the file SHA. | Resume, dedupe, version tracking, joins across the three tables. | Keep - audit. Looks similar to `document_sha256`, but gives a stable version identifier. |
| `document_sha256` | Raw SHA-256 hash of the uploaded/source document. | File identity, dedupe, integrity checks. | Keep - audit. |
| `parser_generation_id` | Hash/ID for the parser generation run. | Separates different parser outputs for the same file/version. | Keep - audit. |
| `clause_key` | Human-readable logical clause key, for example `6.7` or `appendix_b.3`. | UI display, lookup, relationship explanation, stable scoped identity. | Keep - core. |
| `parent_clause_key` | Parent clause key for nested clauses. | Rebuilding contract hierarchy and grouping subclauses under clauses. | Keep - core. |
| `clause_type` | Structural type of the row. | Filtering headings, clauses, subclauses, appendix items, document context. | Keep - core. |
| `clause_title` | Title/heading text when available. | UI grouping and context. | Keep - derived. |
| `clause_order` | Numeric order in the parsed contract. | Sorting and stable display order. | Keep - core. |
| `page_start` | First source page for this unit. | Evidence display and review. | Keep - core. |
| `page_end` | Last source page for this unit. | Evidence display and review. | Keep - core. |
| `raw_text` | Exact text extracted for this unit. | Source evidence, model input, human verification. | Keep - core. |
| `raw_text_sha256` | Hash of `raw_text`. | Detects accidental text mutation and supports reproducibility. | Keep - audit. |
| `raw_data` | Parser payload for this unit. | Replay/debug parser output and preserve details not promoted into columns. | Keep - audit. |
| `summary_he` | Hebrew summary of the clause/unit. | UI preview and downstream decision extraction. | Keep - derived. |
| `hashtags` | Hebrew/domain tags for the unit. | Filtering, visual scanning, possible downstream retrieval. | Keep - derived. |
| `cross_references` | Explicit references detected inside the clause text. | R4 explicit relationship discovery. | Keep - core. |
| `content` | Searchable text assembled from clause text, title, summary, and tags. | Search/retrieval/indexing. | Keep - derived. |
| `index_ref` | Optional pointer to a search/vector/index entry. | Future or external index integration. | Candidate for cleanup unless index integration is planned. It is currently empty in the live sample. |
| `processing_status` | Processing state such as pending/processed/failed. | Resume behavior, UI state, troubleshooting. | Keep - core. |
| `processing_error` | Error text if clause processing failed. | Debugging failed enrichment/indexing. | Keep - audit. |
| `parser_version` | Parser code/prompt version. | Reproducibility and migration comparisons. | Keep - audit. |
| `extractor_version` | Enrichment/extractor version. | Reproducibility and quality comparisons. | Keep - audit. |
| `processed_at` | Timestamp when enrichment/processing completed. | Operational status and replay decisions. | Keep - audit. |
| `created_at` | Row creation timestamp. | Audit and sorting. | Keep - audit. |
| `updated_at` | Last update timestamp. | Processing updates after initial insert. | Keep - audit. |

### `contracts_documents` Cleanup Notes

The table is mostly justified. The fields that deserve review are:

| Field | Why it looks questionable | Recommendation |
| --- | --- | --- |
| `index_ref` | Currently empty in the live saved contract. | Either connect it to the real index/search integration or remove it later. |
| `document_version_id` + `document_sha256` | Slightly redundant because a constraint ties them together. | Keep for now. It separates business version identity from raw file hash. |

## 2. `private.contracts`

Purpose: stores normalized contractual decisions extracted from source clauses. A decision is not necessarily a calendar item. In the current architecture, this table decides whether something is suitable for the future Indicator agent, but the Indicator agent owns actual scheduling/placement.

Live snapshot used during review: 272 append-only rows, including current and historical revisions. `people` is empty in the live sample. `schedule_project_id` is not populated. `projection_status` is mostly legacy from the older schedule-projection design.

| Field | Meaning | Used for | Status / note |
| --- | --- | --- | --- |
| `id` | Physical row UUID. | Primary key and relationship endpoint. | Keep - core. |
| `workspace_id` | BIDoc workspace/customer scope. | Tenant isolation, RLS, scoped joins. | Keep - core. |
| `source_project_id` | Original project ID in the source/main system. | Connects decision to source project. | Keep - core. |
| `schedule_project_id` | Target schedule project ID from the older projection design. | Old schedule projection flow. | Candidate for cleanup. Current R5 handoff does not schedule into a project. |
| `document_version_id` | Source document version identity. | Joins decision to the contract version. | Keep - audit. |
| `parser_generation_id` | Parser run/generation identity. | Reproducibility and scoped joins to source clauses. | Keep - audit. |
| `decision_key` | Stable logical key for the decision across revisions. | Append-only lineage, display, review history. | Keep - core. |
| `revision` | Version number of this decision row. | Human review corrections, split/merge history. | Keep - audit. |
| `supersedes_decision_id` | Previous decision row replaced by this revision. | Append-only history and rollback trace. | Keep - audit. |
| `primary_clause_id` | Main source clause row for this decision. | UI anchor, evidence display, relationship generation. | Keep - core. |
| `source_evidence` | JSON evidence list backing the decision. | Legal review, source display, audit. | Keep - core. |
| `title_he` | Hebrew decision title. | UI display and human review. | Keep - core. |
| `summary_he` | Hebrew normalized summary. | UI preview and decision review. | Keep - core. |
| `decision_text_he` | Full normalized Hebrew decision text. | The authoritative decision body. | Keep - core. |
| `tags` | Multi-label Hebrew/domain tags. | Filtering, grouping, Indicator handoff context. | Keep - core. |
| `people` | Structured people/entities connected to the decision. | Intended for future entity extraction. | Candidate for cleanup. Current code forces this to empty and live rows are empty. |
| `responsible_party` | Party responsible for the obligation/decision. | Review, filtering, Indicator handoff. | Keep - core. |
| `beneficiary` | Party benefiting from the obligation/decision. | Review, filtering, Indicator handoff. | Keep - core. |
| `decision_category` | Controlled category of the decision. | UI grouping, analytics, model quality review. | Keep - core. |
| `conflict_status` | Whether the decision conflicts with another decision. | Human review and graph quality. | Keep - core. |
| `schedule_impact` | Suitability signal for Indicator, not direct scheduling. | R5 handoff classification: suitable, not suitable, review. | Keep - core, but rename later if possible to `indicator_suitability` or similar. |
| `temporal_kind` | Type of time logic, for example none/relative/extension/consequence. | Indicator handoff context and filtering. | Keep - core. |
| `contract_date` | Fixed date if the contract decision contains one. | Indicator handoff evidence. | Keep - core, even if empty in current sample. |
| `trigger_kind` | Trigger category for relative timing. | Indicator handoff evidence. | Review. Current values are mixed controlled codes and free text/Hebrew. |
| `trigger_description_he` | Hebrew explanation of the trigger. | Human review and Indicator handoff context. | Keep - core. |
| `offset_value` | Numeric delay/offset value, for example 15. | Indicator handoff evidence. | Keep - core. |
| `offset_unit` | Offset unit, for example days/months. | Indicator handoff evidence. | Keep - core. |
| `calendar_semantics` | How timing should be interpreted, for example business days/calendar days/unknown. | Indicator handoff context. | Keep - core. |
| `recurring` | Boolean recurrence marker. | Intended temporal shortcut. | Candidate for cleanup. It duplicates `temporal_kind = recurring`; better derive or enforce strictly. |
| `review_status` | Human/model review state: proposed, approved, corrected, rejected, etc. | Review UI and final current-state filtering. | Keep - core. |
| `reviewer_id` | User who reviewed the decision. | Audit trail. | Keep - audit. |
| `reviewed_at` | Review timestamp. | Audit trail. | Keep - audit. |
| `review_reason` | Human note/reason for decision review action. | Review trace and QA. | Keep - audit. |
| `projection_status` | Old projection state for scheduling. | Legacy from earlier R5 schedule projection. | Candidate for cleanup or rename. Current corrected design does not write schedule items. |
| `model_version` | Model/prompt version that produced the decision. | Reproducibility and QA. | Keep - audit. |
| `decision_policy_version` | Policy/schema version used to normalize decisions. | Reproducibility and migration safety. | Keep - audit. |
| `created_at` | Row creation timestamp. | Append-only audit. | Keep - audit. |
| `updated_at` | Last update timestamp. In append-only rows this is constrained to equal `created_at`. | API consistency, but semantically redundant. | Candidate for cleanup later, low priority. |

### `contracts` Cleanup Notes

The fields most likely to be confusing or unnecessary are:

| Field | Current issue | Recommendation |
| --- | --- | --- |
| `schedule_project_id` | Belongs to the old idea that Contracts writes to schedule/project rows. | Deprecate or remove when R5 Indicator handoff is fully stable. |
| `projection_status` | Same legacy issue. Current design only classifies for Indicator. | Rename/deprecate. A clearer field would be `indicator_handoff_status`. |
| `schedule_impact` | Name implies scheduling, but current use is suitability for Indicator. | Keep behavior, rename later to a clearer business term. |
| `people` | Always empty in current live data and forced empty by current flow. | Remove or postpone until a real entity-extraction feature exists. |
| `recurring` | Duplicates temporal semantics. | Derive from `temporal_kind`, or add a strict DB constraint if kept. |
| `trigger_kind` | Mixed values reduce reliability. | Add a controlled enum/mapping table and keep Hebrew labels only for display. |

## 3. `private.contract_relationships`

Purpose: stores the relationship graph between clauses and/or decisions. This is what allows the system to say one clause supports, conditions, contradicts, duplicates, splits, or merges with another.

Live snapshot used during review: 510 append-only rows. Most relationships are model-generated or human-reviewed. Many rows are historical revisions/superseded rows, not active current relationships.

| Field | Meaning | Used for | Status / note |
| --- | --- | --- | --- |
| `id` | Physical row UUID. | Primary key. | Keep - core. |
| `relationship_key` | Stable logical relationship identity across revisions. | Append-only lineage and dedupe. | Keep - core. |
| `workspace_id` | BIDoc workspace/customer scope. | Tenant isolation, RLS, scoped joins. | Keep - core. |
| `document_version_id` | Source document version identity. | Keeps graph scoped to one contract version. | Keep - audit. |
| `parser_generation_id` | Parser generation used to create the graph. | Reproducibility and joins to clauses/decisions. | Keep - audit. |
| `source_clause_id` | Source endpoint when the source is a clause. | Clause-to-clause and mixed clause/decision relationships. | Keep - core. |
| `source_decision_id` | Source endpoint when the source is a decision. | Decision-to-decision and mixed relationships. | Keep - core. |
| `target_clause_id` | Target endpoint when the target is a clause. | Clause-to-clause and mixed relationships. | Keep - core. |
| `target_decision_id` | Target endpoint when the target is a decision. | Decision-to-decision and mixed relationships. | Keep - core. |
| `relationship_type` | Controlled type: supports, condition, exception, conflict, duplicate, cross-reference, split/merge, etc. | UI labels, filtering, downstream reasoning. | Keep - core. |
| `origin` | Who/what created the relationship: model, human, explicit reference. | Trust, filtering, review behavior. | Keep - core. |
| `confidence` | Model confidence score when model-generated. | Review prioritization. | Keep - core for model rows. |
| `evidence` | JSON evidence explaining why the relationship exists. | Human review, audit, explainability. | Keep - core. |
| `model_version` | Model/prompt version for model-origin relationships. | Reproducibility. | Keep - audit. The current `not_applicable` value for non-model rows is awkward but intentional. |
| `relationship_policy_version` | Policy/schema version for relationship classification. | Reproducibility and migration safety. | Keep - audit. |
| `review_status` | Human/model review state. | Review UI and current relationship filtering. | Keep - core. |
| `reviewer_id` | User who reviewed/corrected the relationship. | Audit trail. | Keep - audit. |
| `reviewed_at` | Review timestamp. | Audit trail. | Keep - audit. |
| `review_reason` | Human review note/reason. | QA and review history. | Keep - audit. |
| `revision` | Version number of the relationship. | Append-only relationship corrections. | Keep - audit. |
| `supersedes_relationship_id` | Previous relationship row replaced by this revision. | Lineage and rollback trace. | Keep - audit. |
| `created_at` | Row creation timestamp. | Append-only audit. | Keep - audit. |
| `updated_at` | Last update timestamp. In append-only rows this is effectively redundant. | API consistency. | Candidate for cleanup later, low priority. |

### Why Four Endpoint Fields Exist

`source_clause_id`, `source_decision_id`, `target_clause_id`, and `target_decision_id` look repetitive, but they model a polymorphic graph:

| Relationship shape | Example |
| --- | --- |
| Clause to clause | Clause 6.7 explicitly refers to appendix B.3. |
| Clause to decision | A source clause supports a normalized decision. |
| Decision to decision | One normalized decision depends on another. |
| Decision to clause | A reviewed decision still points back to a specific source clause. |

The database constraints require exactly one source endpoint and exactly one target endpoint. That means the four fields are not accidental duplication; they are the current way to avoid a weak generic `source_id/source_type` pattern.

## Recommended Cleanup Order

These are the practical next cleanup steps, ordered by risk:

| Priority | Action | Why |
| --- | --- | --- |
| 1 | Add database column comments for all three tables. | This solves the immediate Supabase confusion without changing behavior. |
| 2 | Add simple read views for product/debug use. | Most people should not need to see every audit/hash/version field in Supabase. |
| 3 | Rename or document `schedule_impact` as Indicator suitability. | The current name still sounds like direct scheduling. |
| 4 | Deprecate `schedule_project_id` and `projection_status`. | They belong to the older schedule-projection direction, not the current Indicator handoff design. |
| 5 | Decide whether `index_ref` is real. | If there is no index integration, remove it later. |
| 6 | Remove or postpone `people`. | It is currently empty and not contributing to behavior. |
| 7 | Normalize `trigger_kind`. | This field should not mix internal codes and display labels. |
| 8 | Derive or constrain `recurring`. | Avoid two fields saying the same thing. |

## Fields That Should Not Be Removed

The following groups may look technical but are important:

| Field group | Why keep it |
| --- | --- |
| Hashes: `document_sha256`, `raw_text_sha256` | Protect source integrity and make saved extraction reproducible. |
| Generation/version fields | Let us compare outputs across parser/model/policy versions. |
| `revision` and `supersedes_*` | Preserve human review history without destructive updates. |
| Evidence JSON fields | Needed for explainability and legal/human review. |
| Review fields | Required because the system is intentionally not fully automatic. |
| Relationship endpoint fields | Required for the clause/decision graph. |

## Minimal Business-Facing Views Recommended

To reduce confusion in Supabase and in future admin screens, create views that expose only the fields that business users actually need.

### Suggested View: `contracts_documents_readable`

Recommended fields:

- `workspace_id`
- `source_project_id`
- `document_version_id`
- `clause_key`
- `parent_clause_key`
- `clause_type`
- `clause_title`
- `clause_order`
- `page_start`
- `page_end`
- `raw_text`
- `summary_he`
- `hashtags`
- `cross_references`
- `processing_status`

### Suggested View: `contracts_current_decisions`

Recommended fields:

- `workspace_id`
- `source_project_id`
- `document_version_id`
- `decision_key`
- `revision`
- `primary_clause_id`
- `title_he`
- `summary_he`
- `decision_text_he`
- `tags`
- `responsible_party`
- `beneficiary`
- `decision_category`
- `conflict_status`
- `schedule_impact`
- `temporal_kind`
- `trigger_kind`
- `trigger_description_he`
- `offset_value`
- `offset_unit`
- `calendar_semantics`
- `review_status`
- `review_reason`

### Suggested View: `contract_relationships_current`

Recommended fields:

- `workspace_id`
- `document_version_id`
- `relationship_key`
- `revision`
- `source_clause_id`
- `source_decision_id`
- `target_clause_id`
- `target_decision_id`
- `relationship_type`
- `origin`
- `confidence`
- `evidence`
- `review_status`
- `review_reason`

## Bottom Line

The three-table design itself is sound:

1. `contracts_documents` preserves the contract text and clause structure.
2. `contracts` preserves the normalized contractual decisions.
3. `contract_relationships` preserves the relationship graph between clauses and decisions.

The confusing part is not the architecture. The confusing part is that several old or future-facing fields are visible next to core product fields. The highest-value cleanup is to add comments/views first, then separately decide whether to remove `schedule_project_id`, `projection_status`, `people`, `index_ref`, and possibly `recurring`.

## 2026-08-22 R6 Implementation Addendum

The CTO-facing product shapes are now implemented as:

- `private.contracts_documents_product_r6_v1`
- `private.contracts_product_r6_v1`

The per-contract verification surface is:

- `private.contracts_workspace_parity_r6_v1`

The verification view checks required product fields, active Hebrew tag-catalog compliance, current 3072-dimension embeddings, and append-only decision-revision embeddings. Both retained production contracts pass this view with `parity_ready = true`.

The base tables intentionally remain broader than the product views. Legacy fields were documented as internal compatibility or lineage fields instead of being dropped because current review, lineage, and Indicator-handoff code still references several of them. Physical column deletion therefore requires a separate dependency-removal migration and is not part of the safe R6 product-shape rollout.
