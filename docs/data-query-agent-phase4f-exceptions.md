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

The refreshed live source contains 21 rows in one project scope.

- `id`: complete, unique, and positive; internal stable tie breaker only.
- `exception_date`: 15 populated and valid, 6 missing. The canonical ordering is
  `exception_date`, then `id`; lookups exclude undated rows and time series expose
  an explicit `undated` bucket.
- `exception_number`: 17 populated but only 10 unique, with three duplicate
  groups. It is neither a stable identity nor an approved display/filter field.
- `urgency_level`: 21/21 contain the single stored value `לא צוין`.
- `item_status`: 21/21 contain the single stored value `בטיפול`. This is an
  opaque item-processing label, not approval, rejection, open/closed, resolution,
  or completion truth.
- Personal/business groupings are unsafe in the small dataset: inspector,
  manager, supervision-company, contractor, and similar identities remain
  excluded.
- Requested amount is populated in 12/21 rows. Although the source has no stored
  row-level currency and its VAT/total/profit columns are empty, the confirmed
  project contract defines these amounts as ILS. The customer answer therefore
  shows the exact populated subtotal before VAT, calculates the corresponding
  value including the fixed 18% VAT rate, and then states populated/missing-row
  coverage. Neither figure is presented as the value of all exceptions.
- `execution_days` is populated in only 1/21 rows and is `not_computable`.
- Subject, summary, content, hashtags, approval/rejection meaning, cause,
  responsibility, and consequence are semantic-only.

The managed Data Query identity sees no `exceptions_report_documents` rows. The
existing semantic connection sees 91 chunks for 19 of the 21 source records,
with no orphan source keys or attachment mismatches. The approved mixed route
therefore uses the exact source row first and then requires all three attestation
keys - exception ID, project ID, and attachment ID - before reading or summarizing
same-record chunks. `primary_date` is not an identity join.

## Phase 4F.2 implementation

The reviewed fixed contract supports:

- total counts, optional canonical-date scope, and an explicit undated count;
- one-field group counts by stored urgency or stored item status;
- day/month `exception_date` time series with an `undated` bucket;
- a coverage-qualified ILS subtotal of populated requested amounts before VAT,
  followed by its calculated value including the fixed 18% VAT rate;
- dated latest, earliest, and bounded last-N metadata lookups;
- English and controlled Hebrew entity/count/group/date/lookup wording; and
- two guarded mixed families: exact latest exception followed by semantic
  evidence from that same attested record only, and exact submitted-row count
  followed by non-exhaustive semantic approval evidence.

Exact row answers expose only exception date, stored urgency, and stored item status.
The amount route exposes only its aggregate subtotal and coverage counts. It does
not expose row-level amounts. No exact route exposes IDs, exception numbers,
people, companies, subjects, content, filenames, links, or raw rows. Validator
and transport reject unapproved
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

## Post-closeout manager-query regression - 2026-07-29

Two manager queries exposed a gap between exact exception metrics and semantic
approval evidence:

- `מה היה סה"כ החריגים שהוגשו, ומה מתוכם אושר?` and its English equivalent now
  use an explicit mixed route. The answer starts with the exact exception count,
  then uses semantic retrieval for approval evidence. Stored `item_status` is
  not treated as approval truth, and semantic matches are not presented as an
  exhaustive approved count.
- `מה סכום הכסף של החריגים?` and its English equivalent now use a fixed,
  aggregate-only contract over `requested_amount_ex_vat`. The current read-only
  audit produced a subtotal of 306,964 ILS before VAT from 12 of 21 rows; 9 rows
  are missing the value. The customer answer first shows 306,964 ILS before VAT
  and 362,217.52 ILS including 18% VAT, then explains that the figures cover
  only those 12 populated rows.

The current read-only source audit found 21 rows, 15 dated rows, 12 populated
requested-amount values, no row-level currency field, 21 stored urgency values
of `לא צוין`, 21 stored item-status values of `בטיפול`, and semantic chunks for
19 of the 21 rows. Row-level amount selection, filtering, grouping, and ordering
remain blocked; only the fixed aggregate metric may read that field.

Focused verification passed 9/9 and the protected Data Query suite passed
122/122. The full money-query pipeline returned the coverage-qualified ILS
subtotal before VAT and its calculated value including 18% VAT. The mixed
approval pipeline selected the correct route and preserved its exact-count-first safe fallback, but the local semantic
service rejected retrieval with `User not found`; the semantic evidence portion
therefore still requires one UI rerun in an environment where retrieval is
healthy. The full repository suite passed 367/378; the same 11 unrelated
settings, workflow, and timeline static-contract tests remain failing. No
database, schema, authorization, production, or deployment state changed; the
audit was read-only and local pipeline checks created normal local chat/run-history
records.

The subsequent authenticated UI check exposed a synthesis-provider credit
failure: Main requested up to 8,192 tokens while the provider reported capacity
for only 2,969. The generic RAG fallback then repeated broad Hybrid Search,
Project Graph, and reranker source lists. The manager mixed route now has a
dedicated deterministic fallback instead. It scans retrieved sentences for
explicit positive approval wording, rejects pending, required, negative, and
rejected approval language before accepting a match, and requires the positive
wording to be explicitly tied to an exception in the same sentence or in an
exception-specific document title. It returns at most five unique supporting
document titles and never labels that document count as the number of approved
exceptions. The first bounded rerun exposed four generally approved but
non-exception-specific project documents; the stricter live rerun excluded all
four and returned the exact 21-row count followed only by `אישור חריגים בפרויקט
סמל מטבחים` and the non-exhaustive approval boundary. The broad repeated source
dump was absent. During the final rerun the provider-reported affordable output
fell further to 1,981 tokens, so the dedicated fallback remains necessary until
the Main Agent token budget or OpenRouter balance is corrected.

The final customer-copy review removed implementation language from this route.
The answer now begins `סה״כ הוגשו 21 חריגים`, explains in plain language that
the available project information does not provide a complete approved count,
and labels the bounded list `אישורים מתועדים`. It does not expose `Data Query`,
stored-field terminology, semantic-evidence terminology, routing, retrieval
stages, model names, or database details. The general Main synthesis contract
also now forbids internal component, agent, tool, route, model, prompt, table,
and retrieval-stage names in customer-facing answers. A live fallback rerun
confirmed the final wording and contained no internal implementation name.
As defense in depth, every completed chat answer now passes through a final
customer-copy guard that removes the known internal names `Data Query`, `Main
Agent`, `Hybrid Search`, `Project Graph Search`, and `Reranker`. Internal
workflow and QA diagnostics are unchanged and remain available only in their
dedicated operator surfaces.

The subsequent customer-copy correction makes both answers useful without
exposing implementation details. Approval evidence now includes a controlled
summary of the supported statement rather than only a document title. For the
current matching document, it says that the exceptions listed there were
approved and paid according to completion percentages, not in full; raw text
and personal names are not copied into the answer. The amount answer now leads
with the ILS subtotal before VAT and the calculated amount including 18% VAT,
then gives the 12/21 coverage and 9-row missing-data limitation. It no longer
claims that the currency or VAT calculation is unavailable. An authenticated
local UI rerun on port 4000 confirmed both final Hebrew answers and exposed no
internal component names or personal name from the supporting sentence.

## Deferred and next gate

SEC-001 and production/multi-project authorization remain deferred; local
acceptance is within the audited single-project shape and is not a production
authorization claim. Database amount normalization, database views/RPCs, new
currency fields, document-visibility changes, and all schema/security remediation require
separate approval. Phase 4G `whatsapp_analysis` remains the next unauthorized
gate. Stop here.
