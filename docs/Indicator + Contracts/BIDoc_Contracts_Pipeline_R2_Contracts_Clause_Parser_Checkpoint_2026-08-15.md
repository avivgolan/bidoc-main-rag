# BIDoc Contracts Pipeline R2 — Contracts Clause Parser Checkpoint

- Date: 2026-08-15
- Branch: `feature/contracts-indicator-schedule-intelligence`
- Starting HEAD: `b62ad04983e0`
- Approval: R2 approval given by the user after the verified R1 remote apply
- Status: R2 local implementation complete and validated
- Next gate: R3 was subsequently approved and closed; explicit approval is required before R4

## 1. Outcome

R2 implements deterministic Contracts clause parsing without model calls or semantic decision creation. The parser binds immutable PDF bytes to a SHA-256 document version, derives a stable parser-generation identity from the exact parser/schema/policy versions, assembles numbered clauses and appendix items across page boundaries, preserves ordered source segments and line locators, and rejects incomplete coverage.

The implementation is local only. It did not call or mutate the remote `Kapaim` project. The full Herzliya fixture was persisted only inside the dedicated local Supabase Docker database, verified across reruns and two parser generations, and then removed by restoring the clean R1 schema. No Storage object, Schedule row, decision row, relationship row, n8n workflow, application route, UI, deployment, backfill, or model-processing state changed.

## 2. Implemented artifacts

- [`clauseParser.js`](../../src/contracts/clauseParser.js)
  - computes the document version directly from immutable PDF bytes;
  - derives `parser_generation_id` from canonical parser, policy, and extraction-schema versions;
  - recognizes numbered clauses, nested subclauses, appendix headings/items, and bounded document-context units;
  - joins a logical clause across page breaks only when no numbered or appendix boundary intervenes;
  - preserves ordered per-page text segments, line locators, source hashes, page spans, and explicit continuation decisions;
  - emits a strict coverage ledger and an empty `semanticDecisions` collection;
  - builds exact R1 workspace and clause RPC payloads without requiring Schedule mapping.
- [`test-contracts-clause-parser-r2.mjs`](../../scripts/test-contracts-clause-parser-r2.mjs)
  - verifies the approved Herzliya PDF hash before processing;
  - uses only the dedicated local Supabase container;
  - persists the complete first generation, reruns it idempotently, persists a second policy generation, and verifies immutable coexistence;
  - restores the clean local R1 schema in a `finally` block.
- `package.json`
  - `npm.cmd run test:contracts:r2` runs focused deterministic tests;
  - `npm.cmd run test:contracts:r2-db -- --pdf <approved.pdf>` runs the full isolated database fixture.

## 3. Locked Contracts clause-parser behavior

The parser counts and accounts for every non-empty reconstructed source line. Repeated `סמל הקבלן` page markers are the only default exclusion and remain enumerated in the coverage ledger. Preamble, signature blocks, appendix forms, and other non-clause text are preserved as `document_context`; they are not silently discarded or promoted into contractual meaning.

Main clause keys retain their normalized numeric hierarchy, such as `14.1.6.4`. Appendix keys are scoped, such as `appendix_b.2`, so unrelated appendix numbering cannot collide. Subclauses reference their immediate parent, and appendix items/context units reference the stored appendix heading. Missing parents, duplicate keys, malformed numbered boundaries, missing pages, empty page text, source-line gaps, duplicate line assignment, invalid document identity, unsupported generation identity, and bounded-input violations fail closed.

Same document bytes plus the same parser policy produce the same generation ID, clause keys, orders, and hashes. Changing the parser policy creates a different generation ID while preserving the prior generation and its source hashes. R2 performs no relevance filtering, summarization, tagging, cross-reference enrichment, conflict analysis, decision creation, date calculation, Schedule mapping, or Schedule write.

## 4. Verification evidence

Focused tests passed 5/5 and cover:

- cross-page logical-clause assembly and appendix scoping;
- full source-line accounting;
- stable same-policy reruns;
- distinct immutable identity after a parser-policy change;
- byte-derived document identity;
- R1 workspace/clause payload boundaries;
- duplicate-key, missing-parent, page-gap, malformed-numbering, and generation-mismatch hard failures;
- absence of decision and Schedule fields from clause payloads.

The approved Herzliya PDF matched SHA-256 `0ff80eb28a157e748c02676b3c3897ea1fbbb1ad429f12e8aece0ef062629dda`. The full local fixture produced:

| Measure | Result |
| --- | ---: |
| PDF pages | 18 |
| Non-empty reconstructed source lines | 743 |
| Accounted source lines | 743 |
| Numbered source units | 173 |
| Stored logical records | 189 |
| Main clauses | 19 |
| Subclauses | 141 |
| Appendix items | 13 |
| Document-context units | 16 |
| Cross-page clauses | 8 |
| Duplicate keys | 0 |
| Missing parents | 0 |
| Unparsed numbered lines | 0 |
| Missing/uncovered pages | 0 |
| Coverage errors | 0 |

The first generation was `parser-generation:sha256:22af61282d8ed59bf242474fdfaf4d091f52087eb61cf7aaaf0a7f3a9b2e6dec`. A fixture-only policy change produced `parser-generation:sha256:9e9adfdda8b3e5f8c7214a28aa0b5638625d147925c562c7cdb2235a5ff2b471`.

The isolated database check found two distinct R1 workspaces and 189 clauses in each generation. All 189 first-generation rows retained `created_at = updated_at`; all 189 same-key rows in the second generation retained the same source hash. Same-generation rerun reused the existing workspace and clauses. Decision count, relationship count, all three Schedule target counts, and Schedule source-decision-column count remained zero. Model calls and remote writes were zero.

## 5. Subsequent gate status

R3 was subsequently approved and implemented locally. It adds Hebrew clause summaries and tags, explicit cross-reference observations, search content, and shared-index references under a separately versioned enrichment policy without converting them into reviewed contractual decisions. See the [R3 clause-enrichment checkpoint](./BIDoc_Contracts_Pipeline_R3_Clause_Enrichment_and_Indexing_Checkpoint_2026-08-15.md).

R3's bounded live semantic-quality exit gate subsequently passed. Stop before R4 Contracts Relationships Agent work, any remote clause ingestion, Storage upload, contract reprocessing, review UI, Schedule projection, n8n change, backfill, or deployment. Each remains separately gated.
