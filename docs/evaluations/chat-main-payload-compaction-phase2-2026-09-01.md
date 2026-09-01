# Chat Improvement Phase 2 Checkpoint

Date: 2026-09-01

Scope: local implementation and automated verification

Deployment: not performed

Feature state: disabled by default, enabled in the current local server process for live verification

## Outcome

Phase 2 Main payload measurement and compaction are implemented locally behind
the reversible `mainCompactEvidence` flag. The compact path gives Main one
canonical evidence representation instead of the previous combination of a
formatted retrieval string, raw retrieval rows, full graph objects, projected
graph findings, tool payloads, and a duplicate global source list.

The controlled local comparison is complete. Payload, finish-integrity, fallback,
and exact-route checks passed after two live-only hotfixes. Direct semantic
citation links remain an open acceptance item, so the feature is not approved
for deployment or production enablement yet.

## Implemented behavior

- Added `src/mainEvidence.js` with the versioned
  `canonical_evidence.v1` contract.
- Builds stable evidence IDs and human-readable source IDs.
- Deduplicates by safe source URL, typed table/record identity, compatible
  title/date identity, and normalized text fingerprint.
- Keeps separate sources when their content conflicts, even if title and date
  are equal.
- Selects a diverse bounded evidence set. Default is 12 records and broad-list
  mode permits up to 18.
- Caps evidence excerpts and compacts graph relationships into one bounded
  representation.
- Removes internal retrieval calls, embeddings, raw metadata, provider fields,
  credentials, request payloads, and duplicate URL fields from compact tool
  facts.
- Preserves authoritative Data Query machine facts without rewriting their
  values.
- Keeps one source map for citation resolution while removing the duplicate
  `sources` array from the Main request.
- Adds deterministic preflight trimming against an initial 24,000 estimated
  input-token budget. The user question and exact machine facts are never
  trimmed.
- Uses the same compact builder for the one bounded Phase 1 retry.
- Broad/list requests keep tool status and source references but omit duplicate
  bulky tool details from both the first Main request and its retry.
- A broad timeout retry can use the configured 8,092-token output allowance;
  ordinary timeout retries retain the smaller 1,600-token ceiling.
- Adds content-free payload telemetry for prompt, memory, question, evidence,
  graph, tools, plans, conflicts, sources, total size, budget state,
  deduplication, and selected evidence count.
- Exposes the content-free measurements in Workflow and QA summaries.

## Feature flag and rollback

The compact path is disabled by default.

Enable locally through either:

- saved RAG setting: `rag.mainCompactEvidence=true`
- server environment: `MAIN_COMPACT_EVIDENCE_ENABLED=true`

The environment value takes precedence when present. Disable or remove the
value to return to the legacy first-request payload. Payload telemetry remains
available in legacy mode for comparison.

## Automated verification

- `npm.cmd run test:chat-payload`: 9/9 passed.
- `npm.cmd run test:chat-integrity`: 10/10 passed.
- `npm.cmd run test:chat-quality`: 6/6 harness tests, 12/12 smoke cases, and
  351/351 assertions passed.
- Full local suite: 601 passing tests and the same 13 failures.
- The 13 failures are the previously documented frontend/static contract group:
  stale React asset assertions, a missing historical roadmap file, removed
  settings/workflow markup, and removed mobile timeline functions.
- The one old source assertion that named the former retry helper was updated to
  assert the new canonical retry payload contract. Its focused test passes.
- Syntax checks passed for `src/agent.js`, `src/config.js`,
  `src/mainEvidence.js`, and `test/main-evidence.tests.js`.
- `git diff --check` passed with line-ending warnings only.

## Local synthetic size comparison

One deterministic 12-record fixture was measured through both payload paths:

| Payload | Estimated input tokens | Selected evidence | Budget state |
|---|---:|---:|---|
| Legacy duplicated payload | 66,320 | 12 raw records plus duplicates | Over target |
| Compact canonical payload | 4,060 | 12 canonical records | Within target |

The estimated reduction was 93.9 percent. This fixture demonstrates that the
builder removes the structural duplication. It is not a live provider-token,
latency, cost, citation-quality, or production-quality result.

## Controlled local live results

The server was restarted with `MAIN_COMPACT_EVIDENCE_ENABLED=true` only in the
local process. No `.env.local`, saved setting, database, or deployment state was
changed.

| Case | Result | Main input | Finish | End-to-end | Cost |
|---|---|---:|---|---:|---:|
| Supplier responsibility and evidence | Complete answer, 2 sources | 23,128 actual prompt tokens, 18 evidence records | `stop` | 85.64s | $0.1062 total, $0.0814 Main |
| Broad report, before live hotfix | Safe fallback | Initial timeout; retry 22,953 prompt tokens | Retry `length` | 146.46s | $0.0699 |
| Broad report, after minimal-tool retry hotfix | Safe fallback | Retry reduced to 10,075 prompt tokens | Retry `length` at 4,092 completion tokens | 184.08s | $0.1005 |
| Broad report, final local configuration | Complete 3,725-character answer, 3 sources | 17,038 actual prompt tokens, 18 evidence records | `stop` | 90.19s | $0.0942 |
| Latest invoice | Exact deterministic answer and document link | Main skipped | Data Query `done` | 5.65s | $0.000329 |

The first live run exposed a failure-path scope error,
`payloadMetrics is not defined`. The payload and retry telemetry variables now
live outside the Main `try` block, and a focused regression test covers that
failure path. A broad request then exposed oversized duplicated tool details and
an output ceiling that was too small for Gemini reasoning plus the report. Both
were corrected and verified through the final complete run.

The final broad response carried three structured sources but rendered zero
clickable Markdown links in its answer text. This is not a payload-compaction
failure, but it leaves the direct-citation acceptance gate open for the answer
and citation phase.

## Manual acceptance gate results

The controlled local checks produced the following gate status:

1. `MAIN_COMPACT_EVIDENCE_ENABLED=true` was enabled locally and the listener,
   root application path, and protected API behavior were verified.
2. Semantic responsibility question completed:
   `מי היה הספק שגרם לעיכוב, מה הראיות לכך ומה הפעולה המומלצת?`
3. Broad report question completed after the live hotfixes:
   `תן לי דוח מפורט על כל העיכובים, הספקים, האחריות והפעולות הנדרשות. אל תשמיט ממצא מבוסס.`
4. Latest invoice remained on Data Query with deterministic Main skip.
5. Both completed semantic runs showed:
   - `payload_mode: compact`
   - `evidence_records` at or below 12, or 18 for broad mode
   - `estimated_input_tokens` at or below 24,000
   - `input_budget_ok: true`
6. Actual prompt tokens, finish state, cost, and latency were captured above.
   Direct semantic source links did not pass and remain the explicit blocker.

Phase 2 is complete at the local implementation and live payload-verification
level. The citation-quality gate remains open, so the code default stays off and
no deployment should occur yet. The current local server process remains enabled
only so the user can inspect the verified behavior; restarting without the
environment flag returns to the default-off state.
