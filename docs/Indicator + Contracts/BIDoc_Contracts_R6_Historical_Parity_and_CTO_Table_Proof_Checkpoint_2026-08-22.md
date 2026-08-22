# BIDoc Contracts R6 - Historical Parity and CTO Table Proof

Date: 2026-08-22

Status: applied and verified in KAPAIM production.

Managed KAPAIM migration: `20260822144217 contracts_r6_historical_parity`.

## Scope

This phase closes the data gap between the retained historical contract and the newly uploaded contract. It does not change the Contracts UI flow and performs no Schedule or Indicator operational write.

Delivered database objects:

- `public.bidoc_contracts_r6_embedding_work_v2(uuid)` - service-role-only, resumable work queue for missing or stale clause and decision-revision embeddings.
- `private.contracts_workspace_parity_r6_v1` - read-only per-contract proof of required R6 fields, Hebrew catalog compliance, and vector coverage.

The existing product-facing views remain the approved table shapes:

- `private.contracts_documents_product_r6_v1`
- `private.contracts_product_r6_v1`

## Historical Normalization

The retained historical contract contained 34 distinct English legacy tag values across 541 tag occurrences. They were mapped only to active values in `private.contract_tag_catalog`.

The migration updated the derived `hashtags` array and the deterministic `תגיות:` line in `content`. It preserved each original tag array in `metadata.r6HistoricalParity.originalHashtags`; source text, source hashes, clause identity, page evidence, decision lineage, and relationship rows were not changed.

## Embedding Backfill

The guarded dry-run returned exactly:

- 189 processed clause rows requiring embeddings.
- 135 historical decision revisions requiring embeddings.

The apply run wrote 324 embeddings. Every vector has 3072 dimensions and a SHA-256 identity matching its current canonical embedding input. A post-run work query returned zero remaining documents and zero remaining decisions.

## Production Acceptance

| Contract | Clause fields | Clause vectors | Hebrew catalog | Current decisions | Current decision vectors | All decision revisions | Revision vectors | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Electrical works contract | 124/124 | 124/124 | 124/124 | 98/98 | 98/98 | 149/149 | 149/149 | `parity_ready=true` |
| Herzliya showroom contractor agreement | 189/189 | 189/189 | 189/189 | 137/137 | 137/137 | 272/272 | 272/272 | `parity_ready=true` |

Relationship counts remained unchanged at 257 and 510 rows. The captured Schedule/Indicator operational table counts were identical before and after the migration and backfill.

## Compatibility-Safe Cleanup

The raw tables still expose internal parser, audit, review, and append-only lineage columns. Candidate legacy fields were documented in PostgreSQL comments and remain excluded from the CTO-facing product views where appropriate.

They were not physically dropped because active review, lineage, auto-review, and Indicator-handoff code still references several of them. Removing those columns now would be a behavioral regression, not a cosmetic cleanup. Any physical deletion must follow a separate dependency refactor and migration.

## Verification

- Contracts tests: 171/171 passed.
- PostgreSQL 17/Supabase local migration compile: passed.
- Local fixture normalized legacy tags and returned historical decision-revision work: passed.
- KAPAIM guarded dry-run: 189 clauses and 135 decision revisions.
- KAPAIM backfill: 324 written, 0 remaining.
- KAPAIM per-contract acceptance: both contracts `parity_ready=true`.
- Schedule/Indicator and relationship row-count invariance: passed.
- Supabase advisors: no finding specific to the new RPC or parity view.
