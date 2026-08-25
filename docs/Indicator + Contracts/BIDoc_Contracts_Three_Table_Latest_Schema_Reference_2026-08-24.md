# BIDoc Contracts: Three-Table Schema Reference

Date: 2026-08-24

Source: latest live KAPAIM `private` schema.

## 1. `private.contracts_documents`

**Purpose:** Stores the contract source truth after parsing. Each row is one clause, subclause, appendix item, or document-context unit, together with its original evidence, enrichment, searchable content, and embedding.

| Field | Purpose |
| --- | --- |
| `id` | Physical UUID of the stored clause/document unit. |
| `workspace_id` | Saved-contract workspace that owns the row. |
| `source_project_id` | Original project UUID associated with the contract. |
| `document_version_id` | Immutable contract-version identity derived from the file hash. |
| `document_sha256` | SHA-256 hash of the uploaded contract file. |
| `parser_generation_id` | Identity of the parser generation that produced the row. |
| `clause_key` | Human-readable logical clause identifier, such as `7.4`. |
| `parent_clause_key` | Parent clause identifier for hierarchy reconstruction. |
| `clause_type` | Structural type: clause, subclause, appendix item, or document context. |
| `clause_title` | Extracted clause or section title when available. |
| `clause_order` | Stable numeric order of the unit inside the parsed contract. |
| `page_start` | First PDF page containing the unit. |
| `page_end` | Last PDF page containing the unit. |
| `raw_text` | Exact source text extracted from the contract. |
| `raw_text_sha256` | Integrity hash of `raw_text`. |
| `raw_data` | Original structured parser payload retained for evidence and replay. |
| `summary_he` | Hebrew summary generated for the unit. |
| `hashtags` | Controlled Hebrew tags assigned to the unit. |
| `cross_references` | Explicit clause references found in the source text. |
| `content` | Final assembled searchable text containing source, summary, tags, and evidence. |
| `index_ref` | Internal legacy index-lineage reference; not part of the R6 product shape. |
| `processing_status` | Processing state: pending, processing, processed, or failed. |
| `processing_error` | Failure details when processing did not complete. |
| `parser_version` | Parser version used to produce the source structure. |
| `extractor_version` | Enrichment/extractor version used for the row. |
| `processed_at` | Time at which processing completed successfully. |
| `created_at` | Row creation timestamp. |
| `updated_at` | Last row update timestamp. |
| `embedding` | 3072-dimension semantic vector for the final clause content. |
| `embedding_input_sha256` | SHA-256 identity of the exact text used to generate the embedding. |
| `project_id` | R6 product project UUID projected from the source project. |
| `attachment_id` | Immutable private Storage identity: bucket plus object key. |
| `document_name` | Original contract filename. |
| `metadata` | R6 product metadata while preserving the original parser evidence separately. |
| `chunk_index` | Position of the unit within the contract's stored chunks. |
| `chunk_total` | Total number of stored units for that contract generation. |

## 2. `private.contracts`

**Purpose:** Stores normalized contractual decision truth. Each row is one revision of an obligation, right, restriction, payment rule, approval, timing condition, or other contractual meaning derived from the source clauses. Revisions are append-only so review, correction, split, merge, and supersession history remains available.

| Field | Purpose |
| --- | --- |
| `id` | Physical UUID of this decision revision. |
| `workspace_id` | Saved-contract workspace that owns the decision. |
| `source_project_id` | Original source-project UUID. |
| `schedule_project_id` | Legacy Schedule-project reference retained for compatibility; R6 does not perform Schedule placement. |
| `document_version_id` | Contract version from which the decision was derived. |
| `parser_generation_id` | Parser generation associated with the source evidence. |
| `decision_key` | Stable logical decision identity across revisions. |
| `revision` | Revision number of the logical decision. |
| `supersedes_decision_id` | Previous decision revision replaced by this row. |
| `primary_clause_id` | Main source clause supporting the decision. |
| `source_evidence` | Structured source evidence supporting the normalized decision. |
| `title_he` | Hebrew decision title. |
| `summary_he` | Concise Hebrew summary. |
| `decision_text_he` | Full authoritative normalized decision text in Hebrew. |
| `tags` | Internal controlled tags attached to the decision. |
| `people` | Legacy structured entity payload; R6 uses normalized party fields instead. |
| `responsible_party` | Party responsible for fulfilling the obligation, when grounded in the contract. |
| `beneficiary` | Party benefiting from the obligation, when grounded in the contract. |
| `decision_category` | Internal controlled contractual category code. |
| `conflict_status` | Conflict state: none, detected, reviewed, or unresolved. |
| `schedule_impact` | Legacy internal suitability signal retained for compatibility. |
| `temporal_kind` | Internal timing type: none, fixed, relative, recurring, extension, or consequence. |
| `contract_date` | Fixed contractual date when explicitly present. |
| `trigger_kind` | Legacy internal trigger value; the R6 Hebrew value is stored in `trigger_he`. |
| `trigger_description_he` | Hebrew description of the contractual trigger. |
| `offset_value` | Numeric contractual offset from a trigger. |
| `offset_unit` | Offset unit: hours, calendar days, working days, weeks, or months. |
| `calendar_semantics` | Interpretation state for the contractual timing. |
| `recurring` | Legacy/internal recurrence flag projected into the structured R6 timing object. |
| `review_status` | Decision review state, including proposed, approved, corrected, rejected, split, merged, superseded, or unresolved. |
| `reviewer_id` | UUID of the reviewer responsible for the review action. |
| `reviewed_at` | Review timestamp. |
| `review_reason` | Original review explanation. |
| `projection_status` | Legacy Schedule-projection state retained for compatibility; R6 performs no Schedule projection. |
| `model_version` | Model/prompt identity that produced the decision. |
| `decision_policy_version` | Decision-normalization policy version. |
| `created_at` | Revision creation timestamp. |
| `updated_at` | Revision update timestamp; append-only rules restrict business-field mutation. |
| `embedding` | 3072-dimension semantic vector for the normalized decision. |
| `indicator_suitability` | Hebrew Contracts classification for future Indicator handling: suitable, not suitable, or requires review. |
| `embedding_input_sha256` | SHA-256 identity of the exact decision text used for the embedding. |
| `project_id` | R6 product project UUID. |
| `source_document_id` | R6 product reference to the primary source row in `contracts_documents`. |
| `content` | R6 product content for the normalized decision. |
| `metadata` | R6 metadata containing evidence, model/policy identity, and append-only lineage. |
| `hashtags` | Controlled Hebrew product tags. |
| `category_he` | Hebrew product category derived from `decision_category`. |
| `timing` | Structured R6 contractual timing object; it does not contain an operational project due date. |
| `trigger_he` | Active Hebrew-only trigger catalog value. |
| `review_reason_he` | Hebrew review explanation when available. |

## 3. `private.contract_relationships`

**Purpose:** Stores the canonical graph connecting contract clauses and normalized decisions. Each row is one directed relationship revision, such as an explicit reference, support, dependency, condition, exception, amendment, duplicate, conflict, split, or merge. Relationship history is append-only.

| Field | Purpose |
| --- | --- |
| `id` | Physical UUID of this relationship revision. |
| `relationship_key` | Stable generated logical identity across relationship revisions. |
| `workspace_id` | Saved-contract workspace that owns the relationship. |
| `document_version_id` | Contract version containing the related source information. |
| `parser_generation_id` | Parser generation associated with the relationship evidence. |
| `source_clause_id` | Source endpoint when the relationship starts from a clause. |
| `source_decision_id` | Source endpoint when the relationship starts from a decision. |
| `target_clause_id` | Target endpoint when the relationship points to a clause. |
| `target_decision_id` | Target endpoint when the relationship points to a decision. |
| `relationship_type` | Controlled graph type: cross-reference, support, dependency, condition, exception, amendment, duplicate, conflict, split, or merge. |
| `origin` | Producer of the relationship: explicit reference, deterministic logic, model, human, or system. |
| `confidence` | Optional model confidence score. |
| `evidence` | Structured source evidence supporting the relationship. |
| `model_version` | Model version used for model-generated relationships. |
| `relationship_policy_version` | Policy version used to classify and validate the relationship. |
| `review_status` | Review state: proposed, approved, corrected, rejected, superseded, or unresolved. |
| `reviewer_id` | UUID of the reviewer responsible for the review action. |
| `reviewed_at` | Review timestamp. |
| `review_reason` | Explanation for the review action. |
| `revision` | Revision number of the logical relationship. |
| `supersedes_relationship_id` | Previous relationship revision replaced by this row. |
| `created_at` | Relationship-revision creation timestamp. |
| `updated_at` | Relationship-revision update timestamp. |

## Summary

| Table | Responsibility |
| --- | --- |
| `contracts_documents` | Preserves what the contract says as structured source clauses and evidence. |
| `contracts` | Preserves what the contract means as normalized contractual decision revisions. |
| `contract_relationships` | Preserves how clauses and decisions relate to one another as a reviewed graph. |

