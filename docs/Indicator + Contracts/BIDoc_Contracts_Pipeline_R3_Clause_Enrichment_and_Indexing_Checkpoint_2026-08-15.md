# BIDoc Contracts Pipeline R3 — Clause Enrichment and Indexing Checkpoint

- Date: 2026-08-15
- Branch: `feature/contracts-indicator-schedule-intelligence`
- Starting HEAD: `b62ad04983e0`
- Approval: R3 approval given by the user after the verified local R2 handoff
- Status: R3 complete; implementation, isolated database verification, and bounded live semantic-quality acceptance passed
- Stop gate: R4 Contracts Relationships Agent work is not approved and has not started

## 1. Outcome

R3 adds the enrichment layer of the product-facing Contracts Agent. Every accepted immutable clause receives a bounded Hebrew summary, controlled tags, deterministic explicit-reference observations, searchable content, and an attested shared-index reference. The exact source text, source segments, page locators, clause identity, parser generation, and source hash remain unchanged.

The implementation is incremental and generation-aware. Its enrichment-generation identity hashes the exact model, prompt, policy, and schema versions. A same-generation rerun reuses matching processed rows without another model call. A policy, prompt, schema, or model change creates a separate workspace generation rather than silently overwriting prior enrichment. The live-quality closeout uses OpenRouter-enforced strict JSON Schema with an enum for the controlled tags, followed by BIDoc's independent fail-closed validator.

The approved Herzliya PDF was verified only against the dedicated local Supabase Docker database. Production `Kapaim` remained read-only and received no calls or writes during R3. No Storage upload, n8n change, backfill, deployment, decision, canonical relationship, Schedule mapping, or Schedule write occurred.

## 2. Implemented artifacts

- [`clauseEnrichment.js`](../../src/contracts/clauseEnrichment.js)
  - validates a complete accepted clause generation before enrichment;
  - uses a controlled tag ontology and strict JSON output contract;
  - rejects missing clauses, unknown tags, non-Hebrew summaries, and numeric facts absent from the source;
  - batches at most eight clauses and 20,000 source characters per model request;
  - limits concurrency, output tokens, total output budget, and end-to-end duration;
  - extracts explicit references deterministically and keeps them as observations only;
  - builds searchable clause content and an exact `data_index` reference;
  - proves immutable source fields are unchanged before returning.
- [`20260815153955_contracts_pipeline_r3_clause_enrichment.sql`](../../supabase/migrations/20260815153955_contracts_pipeline_r3_clause_enrichment.sql)
  - adds one narrow `SECURITY INVOKER` service-role RPC;
  - revokes default execution from `PUBLIC`, `anon`, and `authenticated`;
  - locks and validates one exact clause row inside a short transaction;
  - accepts only matching source/enrichment identities and attested index references;
  - reuses an identical same-generation result and rejects a divergent rewrite.
- [`contracts_pipeline_r3_clause_enrichment.rollback.sql`](../../supabase/rollbacks/contracts_pipeline_r3_clause_enrichment.rollback.sql)
  - removes only the R3 RPC and its comment.
- [`test-contracts-clause-enrichment-r3.mjs`](../../scripts/test-contracts-clause-enrichment-r3.mjs)
  - verifies the approved PDF SHA-256 before processing;
  - runs a deterministic fixture model with no external model call;
  - persists two enrichment generations and verifies exact same-generation reuse;
  - restores the clean local R1/R3 schema in a `finally` block.
- [`evaluate-contracts-clause-enrichment-r3-live.mjs`](../../scripts/evaluate-contracts-clause-enrichment-r3-live.mjs)
  - loads `.env`/`.env.local` without printing or persisting the OpenRouter credential;
  - verifies the approved PDF identity and runs the full parser/enrichment flow without database writes;
  - reports bounded provider telemetry and a source-versus-summary review sample.
- `package.json`
  - `npm.cmd run test:contracts:r3` runs focused deterministic tests;
  - `npm.cmd run test:contracts:r3-db -- --pdf <approved.pdf>` runs the isolated full-document fixture.

## 3. Locked behavior and safety boundary

The enrichment model is called before database persistence, so database row locks remain short. The server-owned RPC then validates the already-produced output against the immutable source hash and enrichment generation. Model output cannot change source fields or create authoritative Contracts decisions.

Explicit references are evidence for the future Contracts Relationships Agent, not canonical relationships and not legal conclusions. The full fixture produced 15 observations: 14 resolved to an exact clause or appendix heading, and one remained intentionally unresolved because the PDF refers to `נספח ג׳` while no Appendix C target exists in the stored source. R3 records that gap instead of inventing a target.

R3 returns empty `semanticDecisions` and `canonicalRelationships` collections. It does not resolve conflicts, group clauses into decisions, infer missing triggers, calculate dates, require a Schedule project, or write to any Schedule table.

## 4. Verification evidence

Focused R3 tests passed 6/6 and cover:

- full-clause enrichment with immutable-source preservation;
- fail-closed unknown tags and ungrounded numeric facts;
- one bounded repair for invalid model vocabulary while preserving the controlled-tag boundary;
- shared-index and server-owned persistence payloads;
- explicit references remaining observations rather than relationships;
- least-privilege, short-transaction migration structure.

The isolated full-document database fixture passed with:

| Measure | Result |
| --- | ---: |
| PDF pages | 18 |
| Clauses per generation | 189 |
| Enrichment generations | 2 |
| Processed clause rows | 378 |
| Hebrew summaries | 378 |
| Tagged rows | 378 |
| Search-content rows | 378 |
| Attested index references | 378 |
| Explicit-reference observations | 15 |
| Resolved references | 14 |
| Intentionally unresolved references | 1 |
| First-generation fixture-model calls | 24 |
| Same-generation rerun model calls | 0 |
| Second-generation fixture-model calls | 24 |
| Decisions / canonical relationships | 0 / 0 |
| Schedule rows | 0 |
| Remote writes / external model calls | 0 / 0 |

The two verified enrichment generations were:

- `enrichment-generation:sha256:8c79e6f00e2ca3f8e150e008df3e41aefcdd24aecdaa22fed3be86a6812c4814`
- `enrichment-generation:sha256:bbda158d9e653ad957809e70dfb3b470cf5110e020d89694f5c8c3b1f1246bbd`

## 5. Live semantic-quality acceptance

The key already present in `.env.local` was verified by presence, recognized prefix, and actual provider use without printing its value. The earlier missing-key report came from calling `getConfig()` without first calling `loadEnv()`; the production server and the live evaluator both call `loadEnv()` before resolving configuration.

The final bounded live run used `openai/gpt-4o` and passed:

| Measure | Result |
| --- | ---: |
| Clauses summarized and tagged | 189 / 189 |
| Model batches / calls | 24 / 24 |
| Successful / failed calls | 24 / 0 |
| Repair calls | 0 |
| Prompt / completion / total tokens | 39,430 / 9,075 / 48,505 |
| Provider-reported cost | $0.189325 |
| Wall-clock duration | 44,682 ms |
| Duplicate summary groups | 0 |
| Source-hash matches | 189 / 189 |
| References resolved / unresolved | 14 / 1 |
| Remote database writes | 0 |

The accepted live enrichment generation is `enrichment-generation:sha256:dc847009bdb2eda33b3ff39ddc93646e75432c843d83af39a1589b4dd7cea7fd`. A 19-clause human sample compared source text with Hebrew summaries across document context, scope, quality, schedule, payment, completion, termination, insurance, bonds, notices, liability, and appendices. The summaries were concise and grounded; all tags came from the 34-tag controlled ontology. The genuine missing Appendix C target remained explicitly unresolved.

R3's exact-source-preservation and accepted-enrichment-quality exit gate is satisfied. This closes R3 only; it does not approve or start R4.

## 6. R3.1 visual acceptance follow-up

After R3 closed, the user separately approved a no-write visual acceptance slice in the existing Contracts tab. R3.1 now exposes the complete clause decomposition produced by the Contracts Agent: exact source text, Hebrew summary, controlled tags, parent/page identity, explicit-reference observations, search content, coverage metrics, and generation identifiers. The classic extraction remains visible as a separate comparison result. See the [R3.1 visual acceptance checkpoint](./BIDoc_Contracts_Pipeline_R3_1_Visual_Acceptance_Checkpoint_2026-08-15.md).

R3.1 is an ephemeral preview. It does not persist the PDF or clause output, does not call Supabase Storage, does not create decisions or canonical relationships, and does not change Schedule data.

## 7. Deferred work

R4 remains separately gated. It will own candidate retrieval, conflict analysis, canonical relationships, normalized contractual decisions, and the Hebrew relationship/decision review UI under the product name **Contracts Relationships Agent**. R4 has not started; user acceptance of the R3.1 clause extraction is required first.

Remote ingestion, Supabase Storage, production backfill, n8n workflow changes, Schedule projection, deployment, staging, commit, and push also remain outside this checkpoint.
