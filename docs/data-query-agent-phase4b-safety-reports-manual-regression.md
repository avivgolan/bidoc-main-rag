# Data Query Agent Phase 4B - safety reports promotion

Audit date: 2026-07-25
Closeout date: 2026-07-26
Table boundary: existing Content table `public.safety_reports` only
Database boundary: structured read-only inspection and runtime reads; no database
or saved-selection mutation

## Status

- Phase 4B.1 read-only source audit and typed-policy decision: complete.
- Phase 4B.2 implementation and automated verification: complete.
- Phase 4B.3 authenticated UI verification and closeout: complete.
- Phase 4B is closed for review. At its closeout, Phase 4C and every other
  unreviewed table remained deferred.
- At the Phase 4B closeout, the documentation-only Phase 4C-4K sequence was
  formalized in `docs/data-query-agent-phases4c-4k-roadmap.md` and no Phase 4C
  checkpoint had started. Phase 4C.1 subsequently completed on 2026-07-26; its
  current status is in `docs/data-query-agent-phase4c-alerts.md`.

## Phase 4B.1 source-of-truth audit

The audit used the configured managed Data Query identity and only fixed
PostgREST `GET` requests against the existing Content project. Audit output
contained schema metadata and aggregates only. It did not emit report contents,
people, project IDs, mail IDs, attachment IDs, filenames, URLs, credentials, or
raw provider/database exceptions.

### Table identity and deterministic scope

| Contract item | Audited result |
|---|---|
| Connection | Content Supabase |
| PostgreSQL schema | `public` |
| Table | `safety_reports` |
| Exact row count | 21 |
| Stable ID | `id` (`bigint` primary key); 21 populated, positive, unique integers |
| Project scope | `project_id` (`uuid`); 21 populated, one distinct project |
| Canonical report date | `report_date` (`timestamptz`) |
| Date coverage | 21 populated; 2023-10-01 through 2026-02-18 |
| Date ties | none in the current 21 rows |
| Null-date behavior | no current null dates; policy still sorts null dates last |

`created_at` is ingestion metadata and is not an alternate report date.
Deterministic lookup order is `report_date`, then `id`, with both directions
matching the requested latest/earliest operation and null dates last.

### Audited structured fields

Approved quantitative/query-plan fields:

- `id`: stable lookup identity and tie-breaker;
- `project_id`: caller scope only, never displayed or logged;
- `report_date`: canonical date, filters, ordering, grouping/time series;
- `site_location`: exact stored-value filters and grouping;
- `risk_level`: agent-side canonical filters/grouping;
- `site_grade`: exact stored-value filters and grouping;
- `item_status`: exact stored-value filters and grouping only;
- `total_workers`: selectable only on a bounded report lookup;
- `life_threatening_defects`, `severe_defects`, `medium_defects`, and
  `minor_defects`: selectable on a bounded lookup and approved for `sum`.

Excluded from the quantitative Query Plan:

- `created_at`, `processed_for_insights`, and `resolved`;
- `project_manager` and `site_manager`;
- `mail_id`, `attachment_id`, and `document_filename`;
- `defect_details`, `summary`, `content`, `hashtags`, `metadata`, and
  `embedding`.

The excluded source/link fields may be used only by a separate fixed,
same-record enrichment path after an exact bounded lookup. Content fields remain
retrieval evidence and never become exact metrics.

### Null coverage and field types

All 21 rows populate the stable ID, project scope, canonical date, site, risk,
grade, item status, worker counter, four typed defect counters, `resolved`
counter, mail reference, attachment reference, document filename, and
`processed_for_insights`. All typed counters are non-negative integers.

The current table has:

- 12 distinct stored site strings, including spelling, punctuation, and address
  variants for what may be the same physical site;
- 9 distinct text-form grade values: `0`, `5`, `75`, `80`, `85`, `86`, `95`,
  `99`, and `100`;
- one stored item-status value, `בטיפול`, on all 21 rows;
- `processed_for_insights = true` on all 21 rows.

Site strings must therefore remain exact stored categories. Phase 4B does not
normalize or merge sites, and it does not claim that different spellings are
the same place.

### Reviewed risk vocabulary

The live values and counts are:

| Stored value | Rows | Canonical agent value |
|---|---:|---|
| `נמוכה` | 15 | `low` |
| `בינוני` | 2 | `medium` |
| `בינונית` | 3 | `medium` |
| `לא ידוע` | 1 | `unknown` |

The agent-side canonical vocabulary is `low`, `medium`, `high`, and `unknown`.
The reviewed input mapping also recognizes the ordinary Hebrew/English
masculine/feminine forms of those four values. The current snapshot contains no
high-risk row. Unknown or unmapped risk filter values fail validation before a
network request. Group results merge both audited medium spellings into one
`medium` group. Risk severity is never ordered lexically.

Stored data is not normalized or rewritten.

### Counter semantics

Audited counter totals:

| Field | Min | Max | Sum | Phase 4B aggregate decision |
|---|---:|---:|---:|---|
| `life_threatening_defects` | 0 | 2 | 2 | approved as report-recorded occurrences |
| `severe_defects` | 0 | 5 | 8 | approved as report-recorded occurrences |
| `medium_defects` | 0 | 10 | 17 | approved as report-recorded occurrences |
| `minor_defects` | 0 | 20 | 26 | approved as report-recorded occurrences |
| `resolved` | 0 | 30 | 45 | not approved |
| `total_workers` | 0 | 150 | 323 | cross-report aggregate not computable |

The four severity counters are typed, complete, non-negative report counters.
Their sums are approved only with wording such as “report-recorded defect
occurrences.” They are not unique-defect counts across inspections.

`resolved` exceeds the sum of the four typed defect counters in two rows. Its
business scope is therefore not proven, so it is excluded from exact metrics.

`total_workers` is a per-report site snapshot. The same workforce may be counted
again in later reports, and the table has no worker identity or additive-period
contract. It may be displayed for one exact report, but cross-report sum,
average, minimum, maximum, or “total workers across reports” is deliberately
`not_computable`.

### Status decision

`item_status` is approved only as the exact stored record-status category. All
21 current rows contain `בטיפול`.

No source contract proves that `בטיפול` means “unresolved safety report,” and
the separate `resolved` counter cannot repair that ambiguity. Phase 4B may
answer counts “by stored item status,” but it must not translate
`item_status`, `resolved`, or their combination into open/closed or
resolved/unresolved business truth. Questions that require that interpretation
must state that the resolution-state metric is not computable from approved
structured fields.

### Exact document-link relationship

Every safety row has populated, distinct `mail_id` and `attachment_id` values.
A fixed read-only audit verified the existing relationship:

`safety_reports.attachment_id` + `safety_reports.project_id` ->
`email_attachments.attachment_id` + `email_attachments.project_id`

For all 21 reports:

- exactly one project-scoped attachment row matched;
- the returned attachment and project identifiers matched again;
- the attachment `mail_id` matched the safety-report `mail_id`;
- the safety document filename matched an attachment filename;
- one safe HTTP(S) attachment link was present;
- no missing, ambiguous, mismatched, unsafe, or failed lookup occurred.

Phase 4B.2 may therefore support document links for exact bounded safety-report
lookups only when the runtime also has an authorized caller project scope. The
runtime requires the unique project-scoped attachment match, matching mail
reference, and matching filename, and fails closed per report. It never uses
semantic similarity to attach a link or exposes raw URLs/identifiers in
workflow telemetry. The authenticated localhost chat did not provide an
authorization-bound project scope, so the final UI deliberately displayed that
no verified document link was available.

## Approved routing contract

Data Query only:

- exact total report count;
- counts or grouped counts by canonical date, exact stored site, canonical
  risk, text-form grade, or stored item status;
- exact latest, earliest, and bounded last-N report metadata;
- report-count day/month time series;
- sums of the four approved typed defect counters.

Data Query plus retrieval:

- questions that combine an approved exact metric with defect descriptions or
  supporting evidence;
- exact structured values remain authoritative and retrieval may add only
  content/evidence;
- if a mixed question requires unproven resolution semantics, the exact
  response must expose that limitation rather than silently dropping the
  qualifier.

Retrieval only:

- describe or quote a defect;
- explain cause, responsibility, or corrective action;
- summarize report contents;
- answer from fields excluded from the typed policy.

## Phase 4B.2 implementation gate

Implementation may begin only with this fixed policy:

- hardcode Content `public.safety_reports`;
- activate only with dedicated Data Query credentials;
- use `GET`/`HEAD` only and no request body;
- preserve project scope and inclusive calendar-date bounds;
- reject renamed tables, unknown fields/operations/filters/order/limits, raw
  SQL, joins, schemas, aliases, and arbitrary paths before network execution;
- preserve every completed financial/invoice regression;
- keep all other Content tables dormant.

## Phase 4B.2 implementation

The fixed `safety_reports` policy now lives in
`src/subagents/dataQueryMetadata.js`. Runtime classification, deterministic
planning, validation, fixed managed reads, canonical risk normalization, and
redacted workflow projections live in `src/subagents/dataQuery.js`.
`src/agent.js`, `src/subagents/contentTools.js`, and `src/prompts.js` implement
route scheduling, deterministic rendering, exact enrichment fail-closure, and
Main-Agent grounding rules.

Implemented behavior:

- the Content table is hardcoded to `safety_reports`; a renamed table is
  rejected before fetch;
- the adapter emits only `HEAD` for count and `GET` for bounded lookup or
  complete typed derivation, with no request body;
- validated project/date scope is added before execution, including an
  exclusive next-day upper bound for an inclusive final calendar date;
- latest/earliest/last-N ordering is `report_date`, then `id`; undated rows are
  excluded from temporal lookup results and otherwise remain null-last;
- unmapped stored risk drift becomes canonical `unknown`; unsupported requested
  risk values still fail validation;
- empty-set sums of the four approved defect counters are exact zero, while a
  populated relation with no verified numeric values remains
  `not_computable`;
- cross-report worker aggregates and report-level resolved/unresolved counts
  are deliberate `not_computable` capabilities;
- exact counts, group counts, date series, defect sums, and bounded lookups use
  deterministic machine-result answers and skip generic retrieval and Main
  generation;
- mixed exact-plus-defect questions run both routes. When an exact requested
  report-risk subset is zero, a deterministic guard prevents defect severity
  in another report-risk tier from being relabeled as a matching report;
- exact high-urgency/not-computable questions do not run the semantic safety
  precheck;
- safety exact-row enrichment requires an authorized project UUID and the
  dedicated Data Query bearer identity. Missing scope fails closed without a
  service-role fallback;
- workflow telemetry retains operations, tables, approved field names, counts,
  exactness, and scope-presence flags only. Plan IDs, request IDs, caller IDs,
  project values, group values, report values, URLs, filenames, and attachment
  identifiers are omitted.

The saved Data Query table selection was not modified. Runtime settings merge
only the reviewed credential-gated `safety_reports` built-in alongside the
previous approved Data Query policies. No other Content table was activated.

## Automated verification

Final results on 2026-07-26:

- `node --check` passed for all six changed JavaScript files:
  `dataQueryMetadata.js`, `dataQuery.js`, `contentTools.js`, `agent.js`,
  `prompts.js`, and `test/run-tests.js`;
- `npm.cmd test -- --filter "^data query Phase 4B"`: 9/9 passed;
- `npm.cmd run test:data-query`: 80/80 passed, including every prior financial,
  invoice, `data_index`, authentication, lookup, cache, and telemetry test;
- `npm.cmd test`: 325/336 passed. The 11 failures are the unchanged,
  unrelated UI/static-contract tests for Settings import/presets/save wiring,
  embedding settings, Workflow usage/cards/QA/compare, and Timeline responsive
  touch/swipe behavior. No Data Query or Phase 4B test failed;
- `git diff --check`: passed with line-ending warnings only;
- the optional React bundle build was not verified because the local locked
  dependencies do not contain `node_modules/.bin/vite.cmd`; no dependency
  installation or generated-asset rewrite was performed.

Independent read-only correctness and security reviews were completed. Their
in-scope findings were corrected and covered by the focused suite: common
English defect-sum routing, dormant-credential answer handling, null/zero
rendering, null-date temporal lookup, canonical risk drift, mixed zero-risk
truthfulness, high-urgency precheck bypass, authorized-scope enrichment, and
identifier-free workflow telemetry.

## Phase 4B.3 authenticated UI regression

The local server was restarted from the edited workspace with external network
access before the final reruns. One intermediate post-restart request returned
`fetch failed` because the server had accidentally been launched inside the
network sandbox; it was discarded, the process was restarted with Content
network access, and every affected question was rerun successfully.

The authenticated chat had no caller project ID and no classifier date scope
except where the question supplied dates. The live table contains one project,
so the unscoped system-level counts below match the 21-row read-only audit. The
absence of an authorization-bound project scope caused link enrichment to fail
closed by design.

| # | Question and final observed result | Exact plan / scope | Live route evidence |
|---:|---|---|---|
| 1 | `How many safety reports are there?` -> 21 | `count`; no date or project filter | Data Query used; Hybrid, graph, reranker, safety retrieval, and Main skipped |
| 2 | Hebrew total-count wording -> 21 | `count`; no date or project filter | Same exact-only route |
| 3 | `How many safety reports are there by risk level?` -> Low 15, Medium 5, Unknown 1 | `group_count` by canonical `risk_level` | Exact-only route; both stored medium spellings merged |
| 4 | Hebrew risk breakdown -> low 15, medium 5, unknown 1 | `group_count` by canonical `risk_level` | Same exact-only route and Hebrew display labels |
| 5 | `What is the latest safety report?` -> 2026-02-18, audited site, Low, grade 95, stored status, workers 0, all four defect counters 0 | `lookup_latest`; `report_date DESC, id DESC`; limit 1 | Generic retrieval and Main skipped; missing authorized scope displayed `No verified document link was available` |
| 6 | Hebrew latest wording -> same exact row and zero values | Same lookup, order, and limit | Same exact-only route; Hebrew unavailable-link wording |
| 7 | `Show me the last five safety reports.` -> 2026-02-18, 2026-02-13, 2026-02-06, 2026-01-30, 2026-01-16 | `lookup_last_n`; `report_date DESC, id DESC`; limit 5 | Exact-only route; stable order; five fail-closed unavailable-link labels |
| 8 | Hebrew last-five wording -> same five rows in the same order | Same lookup, order, and limit | Same exact-only route and Hebrew labels |
| 9 | `How many safety reports were recorded from 2023-10-01 through 2026-02-18?` -> 21 | `count`; `report_date >= 2023-10-01` and `< 2026-02-19` | Exact-only route; inclusive final calendar day confirmed |
| 10 | `What is the total number of severe defects recorded in safety reports?` -> 8 report-recorded defect occurrences | `aggregate`; `sum(severe_defects)` | Exact-only route after correction; Hybrid, graph, reranker, safety retrieval, and Main skipped |
| 11 | `What is the total number of workers across all safety reports?` -> not computable because each row is a repeatable report snapshot | deliberate `not_computable`; no aggregate fetch | Generic retrieval and Main skipped; no fabricated 323 total |
| 12 | `What defects were found in the latest safety report?` -> latest 2026-02-18 report described as having no safety defects, with older reports presented only as semantic context | no Data Query plan; description fields are outside the typed policy | Hybrid Search, graph search, reranking, safety retrieval, and Main used; Data Query skipped |
| 13 | `How many high-risk safety reports remain unresolved, and what defects were found?` -> exact high-risk report count 0; no matching defect descriptions; unresolved qualifier not computable | `count` with canonical `risk_level = high`; resolution warning preserved | Hybrid, graph, reranker, safety retrieval, and Data Query used; deterministic mixed guard skipped Main and kept a visible detected multi-source conflict warning |

The workflow view for the final mixed run contained the expected operation and
tool names but no HTTP URL, UUID, attachment identifier, plan ID, or request ID.
Visible exact answers contained no long URL or raw attachment/project
identifier. Final UI reruns also confirmed that numeric zero is rendered as
`0`, not as an empty label.

Three incorrect first-pass results were diagnosed and corrected within the
approved table slice:

1. nullable zero counters rendered as blank labels in latest/last-N output;
2. the exact severe-defect wording was classified as mixed and allowed semantic
   synthesis to over-explain the exact total;
3. the zero high-risk mixed answer described medium-risk reports as if severe
   defect severity could satisfy report-risk and resolution qualifiers.

All affected English/Hebrew lookup questions, the exact defect total, the mixed
question, and the worker guard were rerun against the restarted corrected
server.

## Unsupported, deferred, and remaining risks

- Cross-report worker totals/averages/min/max remain `not_computable`.
- Resolved/unresolved or open/closed report counts remain `not_computable`.
- Site-name merging, unique-defect deduplication, and interpretation of the
  `resolved` counter remain unsupported.
- Safety document links require an authorization-bound caller project scope.
  The current authenticated localhost chat does not provide one, so links are
  withheld even though the underlying composite relationship was proven in the
  read-only audit.
- Binding a caller-supplied project UUID to user/team membership is a broader
  authorization issue already tracked with the deferred Data Query security
  work. Phase 4B did not change grants, roles, RLS, policies, or schemas.
- The Bedrock memory Markdown was updated in-repository, but the optional
  Bedrock CLI synchronization could not run because no `bedrock` executable is
  installed in this workspace.
- No Phase 4C table or capability was started.

## Database immutability confirmation

Phase 4B made no insert, update, delete, normalization, migration, RPC,
function, schema, table, column, index, role, grant, permission, RLS, policy,
Supabase-setting, or saved table-selection change. Phase 4B.3 created only the
ordinary chat and run-history records needed for authenticated UI verification.
