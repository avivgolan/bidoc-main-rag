# Data Query Agent Phase 4A.3 manual regression

Date: 2026-07-25

Purpose: confirm the Main Agent uses the new read-only structured financial path for deterministic invoice lookups and counts while semantic and unsupported money questions keep their established boundaries.

## Preconditions

- Run the current application code with the configured Content Supabase connection.
- Configure the dedicated Data Query managed service identity.
- Do not change any table, row, schema, RPC, RLS policy, role, permission, migration, saved table selection, or Supabase setting.

## Checks

1. Ask: `What is the latest invoice?`
   - Expected: Main schedules Data Query.
   - Expected Data Query operation: `lookup_latest`.
   - Expected filter: exact invoice discriminator.
   - Expected: one bounded record ordered by `transaction_date`, then `id`.
   - Verify the returned ID/date against the source table.

2. Ask: `How many invoices are there?`
   - Expected: Main schedules Data Query.
   - Expected operation: `count`.
   - Expected: exact result, not sampled or truncated.
   - The live implementation check on 2026-07-25 returned 23; treat the source table as authoritative if data changes later.

3. Ask: `How many invoices are there by status?`
   - Expected: Main schedules Data Query.
   - Expected operation: `group_count` grouped by `status`.
   - Expected: exact result over the complete filtered invoice relation.

4. Ask: `Why was the latest invoice rejected?`
   - Expected: semantic precedence.
   - Expected: retrieval/financial evidence route, not a structured Data Query lookup presented as an explanation.

5. Ask: `What is the total invoice amount?`
   - Expected: `not_computable`.
   - Expected: no financial read is presented as a valid money aggregate.

## Pass criteria

- Checks 1-3 use Data Query and match current source-table facts.
- Check 4 stays on retrieval.
- Check 5 fails closed as `not_computable`.
- Workflow output contains bounded machine results and redacted provenance, not secrets.
- No database or Supabase mutation occurs.

## Authenticated UI evidence - 2026-07-25

The first run after activation failed this gate because the persisted picker
contained only `data_index`, which excluded the built-in financial capability
from runtime routing. That run did not call Data Query, spent 25,839 tokens in
the reranker, and fell back after the Main Agent returned an incomplete JSON
response.

After the runtime-manifest and exact-route correction, check 1 passed:

- prompt: `What is the latest invoice?`;
- Hybrid Search: skipped for exact Data Query route;
- Project Graph Search: skipped for exact Data Query route;
- reranker: skipped for exact Data Query route;
- Data Query: `ok`, one plan, zero warnings;
- semantic `financial_transactions`: completed;
- conflicts: none;
- Main Agent: completed successfully;
- final answer: 2026-02-28, supplier `בי בי לייט בע"מ`, status `בטיפול`,
  type `חשבונית`, currency `ILS`;
- total workflow tokens: 18,410.

This UI check performed read-only agent requests only. It did not change a
table, row, schema, RPC, permission, RLS policy, role, migration, saved table
selection, or Supabase setting.

## Exact-invoice answer enrichment checkpoint - 2026-07-25

Approved scope: improve only the Main Agent presentation for the exact latest
invoice and stop for UI review.

Implemented behavior:

- enrichment runs only when Data Query completed one
  `financial_transactions` `lookup_latest` plan;
- the machine result must contain exactly one record with an ID;
- the semantic financial result must contain a row with that exact same ID;
- structured date, supplier, status, type, and currency remain authoritative
  from Data Query;
- amount, category, topic/summary, and `data_link` come only from the matched
  financial row;
- the final answer receives a deterministic invoice-details section;
- an HTTP(S) document link is shown as `Open invoice document`;
- the matched document source is prioritized in the response source list;
- missing fields are omitted, mismatched rows are rejected, and non-HTTP(S)
  links fail closed.

Offline verification:

- `node --check src/agent.js`: passed;
- `node --check test/run-tests.js`: passed;
- `npm.cmd run test:data-query`: 57 tests passed;
- `git diff --check`: passed.

No database, table, row, schema, RPC, permission, RLS policy, role, migration,
saved table selection, or Supabase setting changed.

Authenticated UI review exposed that the semantic result set did not contain
the exact Data Query record. The same-ID matcher correctly refused to enrich
from another invoice. The implementation now performs one fallback
`GET /rest/v1/financial_transactions?id=eq.<exact integer ID>&limit=1`, with a
fixed select list and no request body. Non-integer IDs are rejected before a
request is made.

Final authenticated UI result:

- Data Query and the semantic financial tool completed;
- exact invoice enrichment completed with `matched: true`;
- the answer included document name `SI266000183`, amount `802.40 ILS`,
  description, date, supplier, status, type, and category;
- the exact row had no usable HTTP(S) `data_link`, recorded as
  `documentLink: false`, so the answer correctly omitted a document button
  instead of inventing a URL;
- Hybrid Search, graph search, and reranking remained skipped;
- Main Agent completed successfully;
- total workflow usage was 17,881 tokens and $0.0285.

Final focused verification is 57 passing Data Query tests. The checkpoint stops
here for user review. A missing source `data_link` is a source-data limitation,
not an answer-composition failure.

## Deterministic invoice-answer correction checkpoint - 2026-07-25

The three-question UI review exposed two correctness problems: invoice metrics
did not require the invoice discriminator, and exact financial questions still
passed through semantic financial retrieval and Main-Agent generation. This
checkpoint corrects both in the agent layer only.

Current contract:

- every invoice lookup, count, grouped count, and date-scoped count requires
  `transaction_type = 'חשבונית'`;
- a plan that omits or changes that discriminator is rejected before network
  execution;
- invoice metrics and bounded invoice lookups use the deterministic planner;
- exact invoice questions schedule only `data_query`; the semantic financial
  tool is not called;
- Hybrid Search, graph search, reranking, and Main-Agent generation are skipped;
- count and group answers are rendered directly from
  `machineResult.metricsByRequestId`;
- latest/earliest/last-N answers are rendered directly from the ordered exact
  records;
- display enrichment performs one bounded GET for the exact returned IDs and
  matches rows by ID only;
- amount, description, and an HTTP(S) document link are shown when the matched
  source row supplies them; no link is invented;
- genuine cross-source conflicts are appended as a visible warning on routes
  that still combine sources.

Verification:

- all JavaScript syntax checks passed;
- `npm.cmd run test:data-query`: 61 tests passed;
- the full suite has the same 11 pre-existing UI/static-contract failures and
  no Data Query failure.

No database object, table, row, schema, RPC, permission, RLS policy, role,
migration, saved selection, or Supabase setting changed. The implementation
uses read-only GET/HEAD operations only.

### Fresh UI review gate

Run these in new chat sessions so previous conversation memory cannot influence
the answers:

1. `Show the last five invoices.`
   - Expect five exact invoice records in descending chronological order.
   - Expect available supplier, amount, status, description, and a document
     link only where the exact row has a valid link.
2. `How many invoices are there by status?`
   - Expect the status values and counts to come only from invoice rows.
   - The status counts must sum to the exact invoice total, not the total number
     of all financial transactions.
3. `כמה חשבוניות היו מתאריך 01-01-26 עד 01-03-26?`
   - Expect one exact invoice count for the inclusive date range.
   - Do not expect examples of transfers or other financial transaction types.

For all three workflow logs, expect `data_query` as the only project tool and a
`Main Agent skipped for deterministic invoice answer` event. This checkpoint
stops before the UI review.

## Whole-table financial-document count correction checkpoint - 2026-07-25

Approved business definition:

- `financial documents`, `financial records`, and `מסמכים פיננסיים` mean every
  row in `financial_transactions` within the caller's project/date scope;
- these requests do not apply a `transaction_type` filter;
- `invoices` remain the subset where
  `transaction_type = 'חשבונית'`;
- generic `documents` without the financial qualifier continue to mean
  `data_index`.

The pre-correction UI response returned four relevance-matched records and
added a total amount. It was not an exact whole-table count. The corrected
route builds one deterministic `count` plan on `financial_transactions`, reads
the result only from `machineResult.metricsByRequestId`, and does not calculate
or display an amount that the user did not request.

Exact financial-document count questions now use only `data_query`. Hybrid
Search, graph search, reranking, semantic `financial_transactions`, and
Main-Agent generation are skipped. A plan that adds a `transaction_type`
filter to the whole-table financial-document intent is rejected before
execution. If the user explicitly asks for a breakdown by type, the
deterministic plan uses `group_count` over `transaction_type`; mentioning
invoices as an example does not narrow the whole-table intent.

Classifier calendar-day bounds such as
`2026-03-01T00:00:00+03:00` are normalized at the Main-to-Data-Query boundary
to `2026-03-01`. The existing timestamp policy then applies the inclusive
end-date bound `transaction_date < 2026-03-02T00:00:00.000Z`.

Offline verification:

- `node --check src/subagents/dataQuery.js`: passed;
- `node --check src/agent.js`: passed;
- `node --check test/run-tests.js`: passed;
- `npm.cmd run test:data-query`: 64 tests passed;
- `npm.cmd test`: the same 11 pre-existing UI/static-contract failures remain,
  with no Data Query failure.

No table, row, schema, RPC, permission, RLS policy, role, migration, saved
selection, or Supabase setting changed. All implementation reads remain on the
existing validated read-only Data Query path.

### Fresh UI review gate

Run these in a new chat session:

1. `כמה חשבוניות היו בין 01.01.2026 ל-01.03.2026?`
   - Current verified checkpoint: 3.
   - The exact invoice discriminator must remain present.
2. `כמה מסמכים פיננסיים היו בין 01.01.2026 ל-01.03.2026?`
   - Current checkpoint expectation: 8, subject to the live source table.
   - No `transaction_type` filter may be present.
3. `How many financial documents are there?`
   - Compare the exact result with the complete `financial_transactions` table.
4. `How many documents are there?`
   - This must continue targeting `data_index`.
5. `How many financial documents are there by type?`
   - Expect an exact `transaction_type` breakdown whose groups sum to the exact
     whole-table financial-document total.

For checks 1-3 and 5, Workflow History must show `data_query` as the only project
tool and a deterministic Main-Agent-skip event. This checkpoint stops for user
review before any further Data Query capability is added.

## Hebrew attached-prefix invoice lookup correction checkpoint - 2026-07-25

The UI prompt `מה עלה בחשבונית האחרונה?` exposed one routing gap. The invoice
target and financial scope were recognized, but the Hebrew direction matcher
accepted only a bare or definite target such as `חשבונית` or `החשבונית`. It did
not accept the attached `ב` in `בחשבונית`, so the run used Hybrid Search,
reranking, semantic financial retrieval, and Main-Agent generation instead of
proving the latest invoice through Data Query.

The corrected matcher adds only the complete approved wording
`מה עלה בחשבונית האחרונה?`, allowing harmless whitespace before punctuation.
It deliberately does not add `ב` to every Hebrew lookup target. Meeting
content questions, plural invoice wording, line-item questions, earliest
wording, and questions with a trailing supplier qualifier remain outside this
exact structured route. Existing semantic precedence is unchanged: questions
that ask why, request evidence, or combine the invoice lookup with a why-clause
do not become Data Query-only requests. Neighboring unsupported invoice-content
forms are rejected before the classifier-hint fallback, so an erroneous
`data_query` hint cannot turn them into an invoice count.

For the exact UI wording, the verified local contract is now:

- `lookup_latest` over `financial_transactions`;
- mandatory `transaction_type = 'חשבונית'`;
- order by `transaction_date DESC`, then `id DESC`;
- one exact record;
- Hybrid Search, graph search, and reranking bypassed;
- `data_query` is the only project tool;
- display details are enriched only from the bounded exact-ID financial read;
- deterministic invoice formatting skips Main-Agent generation.

Offline verification:

- `node --check src/subagents/dataQuery.js`: passed;
- `node --check test/run-tests.js`: passed;
- the dedicated attached-prefix regression test: passed;
- `npm.cmd run test:data-query`: 65 tests passed;
- `git diff --check` for the changed code and test: passed.

No table, row, schema, RPC, permission, RLS policy, role, migration, saved
selection, or Supabase setting changed.

### Fresh UI review gate

Ask in a new chat:

`מה עלה בחשבונית האחרונה?`

Expected Workflow History:

- Data Query operation `lookup_latest`;
- exact invoice discriminator present;
- one exact record ordered by `transaction_date`, then `id`;
- Hybrid Search, Project Graph Search, and reranker skipped;
- no semantic `financial_transactions` tool call;
- `Main Agent skipped for deterministic invoice answer`;
- answer contains only the exact latest invoice and its available same-ID
  details, without an unrelated recent-invoices list.

This checkpoint stops for UI review before any broader Hebrew wording or
semantic-question expansion.

## Exact latest-invoice attachment-link checkpoint - 2026-07-25

Approved scope:

- enrich only the exact singular latest-invoice answer;
- keep the exact Data Query record and same-ID financial row as the source of
  invoice facts;
- when that row has no safe `data_link`, resolve its existing
  `email_attachment_id` through the existing `email_attachments` table;
- do not change any database table, row, schema, RPC, permission, RLS policy,
  role, migration, or Supabase setting.

The read-only relationship verified against the existing Content data is:

`financial_transactions.email_attachment_id`
-> `email_attachments.attachment_id`
-> `email_attachments.attachment_link`

The attachment lookup is one fixed GET with a fixed column list, exact
`attachment_id`, exact `project_id`, and `limit=2`. The current localhost chat
does not supply a caller project, so the exact financial row's validated
`project_id` scopes the attachment lookup. If a caller project is supplied, it
must also match the financial row. The returned attachment row is accepted only
when exactly one row matches and both identifiers match again in the response.
There is no attachment-only or unscoped retry.

Link precedence is deterministic:

1. a safe HTTP(S) `data_link` on the exact financial row;
2. a safe HTTP(S) attachment link from the unique composite match;
3. no link.

Credential-bearing URLs, non-HTTP(S) schemes, missing rows, duplicate rows,
project mismatches, malformed identifiers, and network errors fail closed.
Attachment failure never removes the already verified invoice details, and no
resolved URL is fetched by the server or written to workflow telemetry.

Offline verification:

- `node --check src/subagents/contentTools.js`: passed;
- `node --check src/agent.js`: passed;
- `node --check test/run-tests.js`: passed;
- `npm.cmd run test:data-query`: 68 tests passed;
- `npm.cmd test`: the same 11 pre-existing UI/static-contract failures remain,
  with no Data Query failure;
- independent read-only review found no remaining blocking issue.

### Fresh UI review gate

Ask in a new chat:

`מה עלה בחשבונית האחרונה?`

Expected answer:

- the same exact latest invoice and details already approved;
- a clickable document link sourced from the uniquely matched attachment;
- no unrelated recent-invoice list and no invented link.

Expected Workflow History:

- Data Query `lookup_latest` with the invoice discriminator;
- no Hybrid Search, graph search, reranker, or semantic financial tool;
- one successful `invoice_attachment_link` event with booleans only, not the
  attachment ID or URL;
- deterministic invoice formatting and Main-Agent generation skipped.

This checkpoint stops for UI review before any list-link expansion or new Data
Query capability.

## Invoice-link presentation cleanup checkpoint - 2026-07-25

The attachment relationship and destination were already correct, but the chat
renderer displayed the long Outlook destination next to the intended Markdown
label. The backend emits the safe CommonMark form
`[פתיחת מסמך החשבונית](<https://...>)`; the previous frontend formatter escaped
the answer before recognizing that angle-bracket destination.

This checkpoint changes only the answer presentation layer:

- `public/chatMarkdown.js` now recognizes angle-bracket and ordinary HTTP(S)
  Markdown links before global HTML escaping;
- link labels and destinations are escaped independently;
- control characters, credentials, non-HTTP(S) schemes, and malformed
  destinations fail closed;
- links retain `target="_blank"` and `rel="noopener noreferrer"`;
- supported bold and inline-code formatting inside a safe label is preserved;
- the existing source-card renderer remains separate and unchanged;
- the `app.js` browser version was advanced so a normal reload fetches the new
  formatter.

Offline verification:

- `node --check public/chatMarkdown.js`: passed;
- `node --check public/app.js`: passed;
- `node --check test/run-tests.js`: passed;
- `npm.cmd run test:data-query`: 69 tests passed;
- `npm.cmd test`: the same 11 pre-existing UI/static-contract failures remain,
  with no new Data Query or chat-link failure;
- independent security and regression reviews found no blocking issue in the
  approved Outlook-link path.

Authenticated localhost UI verification used a new chat with:

`מה עלה בחשבונית האחרונה?`

The answer retained record `226` and all approved invoice details. The inline
document field rendered exactly one visible link labeled
`פתיחת מסמך החשבונית`; the long Outlook URL and `ItemID` were not visible. The
separate `SI266000183.pdf` source chip remained visible. DOM inspection
confirmed that both UI elements use the same exact Outlook destination and that
both keep `_blank` plus `noopener noreferrer`.

Two legacy renderer-hardening items remain outside this checkpoint: automatic
bare-URL linking still runs after HTML escaping, and the shared URL cleaner
strips terminal punctuation even for an explicit Markdown destination. Neither
affects the verified Outlook URL; address them only in a separate approved
renderer slice.

No Content financial row, table, schema, query contract, RLS policy, permission,
or Supabase setting changed. The UI verification created only the ordinary
chat/run history inherent in sending the approved test question.

This checkpoint now stops for user review. List-link expansion, other financial
answer surfaces, and any new Data Query capability remain deferred.

## Bounded invoice-list attachment-link checkpoint - 2026-07-25

This checkpoint extends the already approved exact attachment relationship from
`lookup_latest` to exact, bounded `lookup_last_n` invoice answers only. It does
not activate earliest-invoice links, other financial document types, or any
other table.

The resolver is reusable orchestration with an explicit invoice adapter:

- the exact Data Query records and the matching `financial_transactions` rows
  remain authoritative for list membership, order, and invoice facts;
- a safe direct `data_link` remains first priority;
- otherwise, each row is resolved only through its exact
  `email_attachment_id` plus validated `project_id`;
- duplicate composite references share one read, list order is preserved, and
  one failed or unavailable link cannot remove another invoice;
- the operation is capped at 25 source rows, uses at most four concurrent
  attachment reads, and performs no retry;
- returned links must be unique composite matches and safe HTTP(S)
  destinations; credentials, control characters, scope drift, ambiguity, and
  network failures fail closed per item;
- workflow telemetry contains aggregate counters only. It never includes an
  attachment identifier, project identifier, filename, destination, or raw
  exception message;
- source chips preserve first-invoice order and deduplicate identical safe
  destinations, while every invoice keeps its own inline document field.

Focused verification:

- `node --check src/agent.js`: passed;
- `node --check test/run-tests.js`: passed;
- `npm.cmd run test:data-query`: 71 tests passed;
- `npm.cmd test`: the same 11 pre-existing UI/static-contract failures remain,
  with no Data Query or attachment-link regression;
- the five-lookup concurrency regression reached exactly four active reads and
  never exceeded the configured ceiling;
- independent correctness and security reviews found no blocking issue after
  the raw-error telemetry and concurrency-test hardening.

Authenticated localhost UI verification used a fresh chat with:

`תראה לי את חמשת החשבוניות האחרונות`

The result retained the five exact invoices in descending chronological order
and rendered five inline links labeled `פתיחת מסמך החשבונית`. The workflow
event reported `requested=5`, `uniqueLookups=5`, `resolved=5`, no unavailable,
failed, or scope-rejected rows, and `bounded=true`. DOM inspection confirmed
that no raw Outlook URL or `ItemID` appeared in the visible answer. The five
exact attachment references resolved to three distinct safe destinations, so
the source area correctly showed three ordered, deduplicated filename chips.

No financial row, table, schema, RPC, migration, permission, RLS policy, role,
query contract, saved Data Query selection, or Supabase setting changed. The UI
verification created only ordinary chat/run history. Later expansion can reuse
the bounded orchestration, but every additional table still requires its own
explicit identifier mapping, project-scope policy, limit, and regression gate.

This checkpoint stops for user review before any other table is enabled.
