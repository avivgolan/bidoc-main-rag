# Chat Improvement Phase 2.1 Checkpoint

Date: 2026-09-04

Scope: local citation resolution, bounded source-link reads, and verification.

Deployment: not performed. Saved settings, model selection, database schema,
project data, and permissions were not changed. Compact mode remains off by
default. Live checks enabled it only in ephemeral QA processes.

## Outcome

The local citation path now resolves canonical source IDs into inline Markdown
links. The final controlled live answer produced 13 links across 11 bullet lines,
with zero unresolved references and a complete `STOP` response without retry.

This is a reference-resolution and rendering result, not a semantic-entailment
approval. Authenticated document opening, human claim-to-source review, repeated
gold-set coverage, and production rollout remain separate acceptance gates.

## Confirmed cause

The old postprocessor received only the general `sources` list and recognized
primarily bare bracket citations. It did not receive the compact payload's
`source_map` or bind retry citations to the retry's own map.

Live inspection also found an upstream link loss. For one cited email:

- The index row had a valid HTTPS Outlook `source_url`.
- Its historical `source_id` was an opaque mail identifier, not the numeric
  `emails.id`. A read using `emails.mail_id` found exactly one row in the same
  project.
- The search RPC returned that same record with `id`, `content`, `source_table`,
  `source_id`, `title`, `summary`, `metadata`, and `similarity`, but omitted
  `source_url`. Its metadata did not contain a link either.

Consequently, the selected evidence reached Main without its available link.
The presence of other linked sources did not justify attaching those unrelated
URLs to the selected evidence.

## Implemented behavior

- `src/mainCitations.js` resolves exact `[Source: S1]` / `[מקור: S1]` markers
  against the active source map. It also supports unambiguous legacy title
  citations, including parentheses.
- Unknown IDs are not exposed as internal identifiers. Missing links receive
  an honest no-direct-link label. Ambiguous titles/categories never receive a
  guessed URL.
- In compact mode, model-written Markdown links must belong to the active
  source map. Unsafe or non-canonical destinations are removed.
- `src/sourceLinks.js` restores only missing `source_url` fields from the
  configured index table, using exact index ID plus source table/source ID.
  Project scope is included and checked when supplied. Existing links and
  retrieved evidence text remain unchanged.
- Source-link hydration runs only with `mainCompactEvidence=true`. It uses
  read-only requests, at most 200 IDs in batches of 50, and a 3-second request
  timeout. A metadata-read failure leaves retrieval intact and does not invent
  a link. The retrieval cache key includes the link-resolution contract.
- Internal content-tool sources retain table, record ID, and date metadata.
  Same-title/date records with different typed identities cannot borrow links
  through the title/date deduplication fallback.
- Workflow and QA expose linkable evidence counts, source-reference resolution,
  missing/invalid links, and bullet-link coverage. Completion output no longer
  repeats the full payload metrics, keeping these diagnostics structured below
  the generic workflow preview limit.
- The diagnostic contract explicitly states
  `semantic_entailment_checked: false`. It does not label URL matching as proof
  that a source supports the model's interpretation.

## Verification

- Focused citation, payload, completion-integrity, and inline-contract tests:
  **37/37 passed**.
- Citation tests include source/project mismatches, unsafe URLs, unknown IDs,
  missing links, bounded/non-fatal reads, rollback-flag behavior, and clickable
  HTML anchors through the existing chat Markdown renderer.
- Quality harness: **6/6 tests, 12/12 cases, 351/351 assertions passed**.
- Full suite at this checkpoint: **627 passing, 14 failing**. Remaining failures
  concern Contracts R3.2 UI, stale React/settings/workflow assertions, a historical
  roadmap reference, and removed mobile timeline functions. Those surfaces were
  not changed in this work. Concurrent Schedule changes were preserved.
- No browser-based document opening or semantic entailment audit was performed.

## Controlled live results

Runtime settings were loaded through the normal settings initialization:
`google/gemini-2.5-pro`, `maxTokens=8092`. Neither was changed.

Question used for the before/after check:

> מה כתוב במיילים על עיכובים באספקת תקרות הרשת, ומה הפעולה שנדרשה?

| Measurement | Before index-link hydration | Final local run |
|---|---:|---:|
| Selected evidence records | 18 | 18 |
| Selected evidence with a link | 0 | 14 |
| Linkable source-map entries | 8 | 22 |
| Inline Markdown links | 0 | 13 |
| Unresolved citation references | 0 | 0 |
| Cited bullet lines | 0/7 | 11/11 |
| Estimated Main input tokens | 14,202 | 14,791 |
| Completion | Complete, STOP | Complete, STOP |
| Retry | None | None |
| End-to-end latency | 59.264s | 115.465s |

Final run: `citation_final_1788537365531`.

The final result referenced six distinct source IDs. Links pointed to supplied
Outlook and SharePoint URLs. The timing is one non-deterministic sample per state,
not a latency benchmark or evidence of a performance improvement.

An ephemeral latest-invoice regression completed in 4.144 seconds with Data Query
`done` and Hybrid Search, Graph Search, Reranker, and Main `skipped`. The run did
not return a Markdown document link. Exact routing passed, but invoice-link
availability was not established by this test and must not be reported as passed.

All controlled chat runs used `executionMode: qa` and
`persistChatHistory: false`. No chat-history or memory write was performed.

## Manual acceptance before the next phase

1. Start the local server with `MAIN_COMPACT_EVIDENCE_ENABLED=true` without
   changing the saved model or 8,092-token allowance.
2. Ask the email question above. Check the Main workflow diagnostics for complete
   output, canonical URL enforcement, zero unresolved references, and inline
   source links. Open at least one Outlook link and one SharePoint link while
   authenticated and verify the adjacent factual claim against that source.
3. Ask the broader supplier-responsibility question. A source without a stored
   URL must remain honestly unlinked, never attached to a different record.
4. Repeat the latest-invoice question. Confirm Data Query handles it and Main is
   skipped. Separately inspect why a document link was unavailable in the QA run.

Do not enable production solely because one live citation run passed. Keep the
default off until these manual checks and repeated representative cases pass.
