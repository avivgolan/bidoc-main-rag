# Data Query Agent Phase 4F - exceptions report

Closed: 2026-07-28

Status: Phase 4F.1, 4F.2, and 4F.3 complete locally. Phase 4G is not authorized.

## Scope and non-mutation boundary

This phase promotes only fixed `public.exceptions_report` metadata into the
credential-gated typed Data Query runtime. The audit and runtime used read-only
`GET`/`HEAD` requests. No Content row, schema, RPC, migration, role, grant,
permission, RLS policy, Auth/Supabase setting, saved table selection, production
configuration, or deployment changed. Authenticated UI checks created only
ordinary local chat/run-history records.

## Phase 4F.1 read-only audit

The live source contains 20 rows in one project scope.

- `id`: complete, unique, and positive; internal stable tie breaker only.
- `exception_date`: 14 populated and valid, 6 missing. The canonical ordering is
  `exception_date`, then `id`; lookups exclude undated rows and time series expose
  an explicit `undated` bucket.
- `exception_number`: 15 populated but only 10 unique, with three duplicate
  groups. It is neither a stable identity nor an approved display/filter field.
- `urgency_level`: 20/20 contain the single stored value `לא צוין`.
- `item_status`: 20/20 contain the single stored value `בטיפול`. This is an
  opaque item-processing label, not approval, rejection, open/closed, resolution,
  or completion truth.
- Personal/business groupings are unsafe in the small dataset: inspector,
  manager, supervision-company, contractor, and similar identities remain
  excluded.
- Requested amount is populated in 12/20 rows, but there is no stored row-level
  currency; six populated-amount rows have no currency signal, and the VAT,
  total, and profit columns are empty. Every exception amount aggregate is
  deliberately `not_computable`.
- `execution_days` is populated in only 1/20 rows and is `not_computable`.
- Subject, summary, content, hashtags, approval/rejection meaning, cause,
  responsibility, and consequence are semantic-only.

The managed Data Query identity sees no `exceptions_report_documents` rows. The
existing semantic connection sees 84 chunks for 17 of the 20 source records,
with no orphan source keys or attachment mismatches. The approved mixed route
therefore uses the exact source row first and then requires all three attestation
keys - exception ID, project ID, and attachment ID - before reading or summarizing
same-record chunks. `primary_date` is not an identity join.

## Phase 4F.2 implementation

The reviewed fixed contract supports:

- total counts, optional canonical-date scope, and an explicit undated count;
- one-field group counts by stored urgency or stored item status;
- day/month `exception_date` time series with an `undated` bucket;
- dated latest, earliest, and bounded last-N metadata lookups;
- English and controlled Hebrew entity/count/group/date/lookup wording; and
- one sequential mixed family: exact latest exception first, then semantic
  evidence from that same attested record only.

Exact answers expose only exception date, stored urgency, and stored item status.
They do not expose IDs, exception numbers, people, companies, amounts, subjects,
content, filenames, links, or raw rows. Validator and transport reject unapproved
fields, filters, grouping, order, metrics, table/path drift, missing/duplicate
stable IDs, vocabulary drift, and lookup cardinality/order drift before returning
an answer. The transport is fixed to `public.exceptions_report`, bodyless, and
limited to `GET`/`HEAD`.

Semantic-only exception explanations stay on retrieval. The mixed helper uses the
configured lite model with a bounded 1,400-token completion budget, generic-role
wording, and post-generation redaction for email addresses, URLs, UUIDs, and
control characters. A post-generation guard also rejects unrequested monetary
values instead of exposing them in a summary. Missing, mismatched, or unsafe
same-record evidence fails closed and does not substitute another exception.

## Automated verification

- `node test/run-tests.js --filter "Phase 4F"` - 8/8 passed.
- `npm.cmd run test:data-query` - 115/115 passed; Phases 4A-4E remain green.
- Syntax checks passed for Data Query source, metadata, Hebrew lexicon,
  same-record evidence helper, Main routing, audit script, and test runner.
- The final full-suite result is recorded in the closeout section of
  `docs/data-query-agent-current-state-audit.md`.

## Phase 4F.3 authenticated UI closeout

The current local code ran on temporary port 4001 using the existing authenticated
Chrome session. The temporary server was stopped and the user tab restored to
port 4000 afterward.

- `How many exceptions are there?` returned exact `20`.
- `Show the latest exception report` returned 09.03.2025, stored urgency
  `לא צוין`, and stored item status `בטיפול`, with the undated-ordering and
  no-identities/amounts/links boundary.
- `Show the latest exception report and summarize what happened` ran Data Query
  first, then the same-record evidence handoff. The final lite-model run finished
  `stop`, returned the safe insufficient-evidence wording, skipped generic
  hybrid/graph/reranker retrieval, and skipped Main synthesis.
- `What is the total requested amount for exceptions?` returned the deliberate
  `not_computable` explanation and did not fabricate a currency or total.
- Workflow telemetry exposed aggregate route/status/model/token/cost information
  only for the Phase 4F tools; it contained no exception/project/attachment ID,
  raw exception row, raw evidence chunk, identity, amount, or source URL.

The first mixed UI attempt exposed a truncated evidence sentence because the
then-selected reasoning model ended with `MAX_TOKENS`. The phase was not closed on
that result. The evidence step was moved to the configured lite model, its
contract test was added, and the authenticated rerun completed with `stop`.

## Post-closeout Hebrew basic-query regression - 2026-07-28

The authenticated UI later exposed two natural Hebrew forms that were outside
the narrowly approved grammar while port 4000 was also still running the older
pre-4F server process:

- `כמה חריגים יש במערכת.` now treats `במערכת` as a harmless whole-scope count
  suffix and returns the exact 20-row count.
- `מהו דוח החריגים האחרון?` now accepts the natural `מהו` copular form while
  preserving the singular report distinction and returns the dated latest row:
  09.03.2025, stored urgency `לא צוין`, and stored item status `בטיפול`.

Both exact screenshot queries have direct regression cases. Phase 4F remains
7/7 and the protected Data Query suite remains 114/114. After restarting only
the local BiDoc dev-server process tree, authenticated UI reruns passed both
queries. Workflow inspection confirmed Data Query execution with hybrid search,
graph search, reranking, and Main synthesis skipped. The full repository suite
was 359/370 with the same 11 unrelated settings, workflow, and timeline
static-contract failures. No data, database, authorization, production, or
deployment state changed; normal local chat/run-history records were created.

## Post-closeout bilingual UI matrix regression - 2026-07-28

The full published acceptance matrix now has one English and one Hebrew query
for each of the 10 capabilities: total count, latest, earliest, last five,
urgency grouping, status grouping, undated count, monthly trend, amount
fail-closure, and latest plus same-record summary. All 20 queries passed in the
existing authenticated local UI on port 4000.

This regression pass fixed five connected defects rather than only adding
aliases:

- natural Hebrew grouping, undated, monthly-trend, and `תמצת` forms are covered
  by the controlled lexicon and strict grammar;
- the semantic verb `תאר` no longer prefix-matches `תאריך` and diverts basic
  date questions to retrieval;
- validated project/date filters for `exceptions_report` retain their trusted
  caller-scope marker, while an untrusted plan still cannot forge that marker;
- classifier-inferred current-month dates are ignored for an unscoped monthly
  time-series query, so the result is the complete series: 20 total, monthly
  buckets `2024-11: 4`, `2024-12: 3`, `2025-01: 5`, `2025-03: 2`, and an
  explicit undated bucket of 6; and
- urgency/status answers use their actual stored-field labels rather than the
  time-series `UTC period` label.

The two screenshot cases now return 6 undated exceptions and exact latest-row
metadata followed by a safe insufficient-evidence message. During the mixed
rerun the evidence model attempted to include an unrequested amount; the new
deterministic monetary-disclosure guard rejected that output in both languages.

Current verification: Phase 4F 8/8, protected Data Query 115/115, authenticated
UI 20/20, and full repository suite 360/371. The 11 full-suite failures are the
same unrelated settings, workflow, and timeline static-contract failures. No
database, stored data, authorization, production, or deployment state changed;
normal local chat/run-history records were created.

## Deferred and next gate

SEC-001 and production/multi-project authorization remain deferred; local
acceptance is within the audited single-project shape and is not a production
authorization claim. Amount normalization, database views/RPCs, new currency
fields, document-visibility changes, and all schema/security remediation require
separate approval. Phase 4G `whatsapp_analysis` remains the next unauthorized
gate. Stop here.
