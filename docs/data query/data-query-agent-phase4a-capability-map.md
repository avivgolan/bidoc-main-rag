# Data Query Agent - Phase 4A structured capability map

Status: Phase 4A.0 discovery complete on 2026-07-24. No application runtime, database object, table, column, row, privilege, policy, role, function, index, or migration was changed.

Current-status note (2026-07-28): the Phase 4A.0 discovery sections preserve
checkpoint history. Later sections supersede their runtime-status statements.
Phase 4B `safety_reports`, Phase 4C `alerts`, Phase 4D `meetings`, Phase 4E
`emails`, and Phase 4F `exceptions_report` are complete. Phase 4F passed its
authenticated exact, lookup, same-record mixed, fail-closed, and telemetry
closeout. Every later table remains dormant and separately approval-gated.

## Decision

Phase 4A is not a generic multi-table SQL or join phase. It is the controlled promotion of individual Content tables into the typed Data Query contract.

At the Phase 4A.0 discovery snapshot, the production capability was:

- exact, full-relation analytics only for `public.data_index`;
- typed Query Plans rather than model-authored SQL;
- no joins;
- no semantic interpretation or citation retrieval;
- `data-query.v2` machine results for Main Agent consumption.

At that snapshot, every other table in this document was a candidate rather
than an implemented capability. The later sections record individually approved
promotions; every still-unreviewed table must continue returning
`not_computable` until its typed metadata, fixed-table database contract,
authorization boundary, and deterministic tests are implemented and approved.

The practical product target is:

1. Data Query identifies exact structured facts or the exact latest/earliest records.
2. Main Agent consumes those facts from `machineResult`.
3. A retrieval/evidence agent is invoked only when the question also asks what a document says, why something happened, who is responsible, or where the evidence is.

For example, after the financial table is promoted, “What is the latest invoice?” should be a simple deterministic lookup ordered by `transaction_date DESC, id DESC`. “What is the latest invoice and why was it rejected?” should combine that lookup with document retrieval for the explanation.

## Evidence and safety boundary

This checkpoint used:

- read-only catalog and aggregate `SELECT` queries against Kapaim Content project `smxibuaowzuxkznuouwj`;
- the Supabase security advisor;
- repository code, migrations, tests, and existing Data Query phase documents;
- aggregate counts, null coverage, date ranges, and low-cardinality vocabularies only.

No raw content, email body, person-level record, source document, credential, or secret was copied into this document.

Supabase treats table privileges and RLS as separate layers, and recommends RLS for exposed tables. Function execution privileges must also be controlled explicitly:

- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/api/securing-your-api>

## What is implemented today

### Exact operations

`src/subagents/dataQueryMetadata.js` registers only `data_index` and its fixed RPC. The exact operation set is:

- `count`;
- `group_count`;
- `aggregate`;
- `timeseries`;
- `top_n`, meaning top grouped counts;
- `distinct`.

`top_n` does **not** mean “latest N records.” A new typed lookup operation is required for `latest`, `earliest`, and `last_n`.

The fixed database implementation targets only `public.data_index`, accepts no SQL, and validates every operation, field, filter operator, grouping field, metric, and limit.

### Current routing

The capability router recognizes quantitative wording such as counts, breakdowns, averages, trends, comparisons, distributions, and KPIs. It routes semantic, citation, explanation, root-cause, and responsibility questions to retrieval/evidence agents.

Ordinary lookup wording such as “latest invoice,” “earliest safety report,” and “last five meetings” is not yet a first-class capability. Phase 4A must add deterministic lookup intent rather than forcing these questions through a count-oriented heuristic.

Main Agent also has a second, narrower quantitative regex instead of reusing the Data Query classifier. The two routing rules can therefore disagree. The deterministic fallback planner currently produces only one alerts-by-severity shape and is not a general fallback for `data_index` counts or trends.

### Existing specialist agents are not exact analytics

The meetings, email, WhatsApp, financial, and safety specialist tools retrieve a bounded candidate set. Their default `topK` is 12 and is capped at 50. Vector and text results are merged, sliced, and only then passed to local rollups.

Therefore, specialist values such as `total_amount`, `by_status`, `defect_totals`, or `open_tasks_count` describe the retrieved candidates, not the complete database table. They must not override an exact Data Query metric.

## Phase 4A implementation source map

| Concern | Source of truth |
|---|---|
| Typed operations and the sole exact table policy | `src/subagents/dataQueryMetadata.js` |
| Settings normalization, manifest, routing, planning, validation, execution, machine results, workflow log | `src/subagents/dataQuery.js` |
| Managed-token acquisition and claim validation | `src/subagents/dataQueryAuth.js` |
| Main Agent tool routing and machine-result consumption | `src/agent.js` |
| Fixed `data_index` exact implementation | `supabase/data-query-exact-metrics-v1.sql` |
| Claim-gated Phase 3.1 wrapper | `supabase/data-query-phase3-1-service-account.sql` |
| Existing specialist table projections | `src/subagents/contentTools.js` |
| Existing retrieval-capped specialist rollups | `src/subagents/contentAnalysis.js` |
| Direct Data Query HTTP route and run persistence | `src/server.js` |
| Settings/Subagents card | `public/app.js` |
| Current automated coverage | `test/run-tests.js` |

## Deferred security track

All security findings identified during Phase 4A.0 are tracked separately in:

`docs/data-query-agent-deferred-security-register.md`

Per the 2026-07-24 product decision, those findings will be handled later as a separate security program. They do not replace or reorder the functional Phase 4A plan.

Phase 4A.1 may continue as local code and automated-test work without querying or changing Supabase. Any later live RPC deployment or business-table promotion still requires explicit database-change approval.

## Functional contract drift

### F1 - fallback manifest and test drift

When a saved UI selection exists, the current confirmed selection is only `data_index`.

When no selection exists, `dataQuerySettings()` derives `allowedTables` from every entry returned by `buildDataQueryManifest()`. That fallback currently returns:

- `data_index`;
- the configured alerts table;
- `meetings_documents`.

The regression test named “missing selection falls back to the exact data_index contract” manually overrides `allowedTables` to `["data_index"]`, so it does not test the real default behavior.

Exact operations still reject tables without a registered exact RPC. However, `select` uses a direct PostgREST table request with the managed authenticated token. The fallback must therefore be corrected before relying on “only `data_index`” as an enforced invariant.

### P1 - source index drift

`data_index` currently contains:

| Source | Index rows | Live source rows matched | Orphaned index rows | Unindexed live rows |
|---|---:|---:|---:|---:|
| `financial_transactions` | 102 | 100 | 2 | 0 |
| `meetings` | 151 | 151 | 0 | 0 |
| `safety_reports` | 22 | 21 | 1 | 0 |
| `exceptions_report` | 20 | 20 | 0 | 0 |

An exact count of indexed financial or safety records is therefore not automatically an exact count of live source rows.

## Live structured-data snapshot

Snapshot date: 2026-07-24.

| Table | Rows | Useful structured coverage | Readiness |
|---|---:|---|---|
| `data_index` | 1,248 | `primary_date` 1,239; `source_table` 1,248; `item_status` 273; `severity_or_risk` 42 | Implemented exact metadata analytics |
| `financial_transactions` | 100 | `transaction_date` 99; vendor/type/status/currency 100; legacy `total` 100 | Best business-value candidate, but numeric amount columns are empty |
| `meetings` | 151 | date/subject/status/decisions/attendances 151 | Strong lookup/count metadata; semantic fields need Meeting Evidence |
| `safety_reports` | 21 | dates, worker/defect counters, risk, grade all 21 | Strong typed aggregate candidate |
| `alerts` | 1,676 | `data_date` 1,673; type/severity/relevance 1,676; `status` 0 | Counts possible; severity currently has one value and status needs definition |
| `emails` | 7,163 | received date/direction/attachment/relevance 7,163; category 786 | PII-heavy; only 786 are project-related |
| `whatsapp_analysis` | 525 | conversation ID and JSON analysis fields 525 | JSON- and relation-heavy; defer direct exact analytics |
| `other_documents` | 168 | name/source 168; document type 0 | Mostly retrieval, little structured value |
| `exceptions_report` | 20 | date 14; exception number 15; requested amount 12; urgency 20 | Useful later; incomplete date/amount coverage |
| `key_personnel_contacts` | 10 | name/type/role/company/profession 10 | PII directory; not an early analytics target |
| `consultants_reports` | 0 | no live rows | Defer until data exists |
| `daily_work_log` | 0 | no live rows | Defer until data exists |
| `gantt_tasks` | 0 | no live rows | Defer until data exists |
| `quality_control` | 0 | no live rows | Defer until data exists |

### Important data-quality observations

- `financial_transactions.amount_numeric`, `amount_including_vat`, and `report_total_numeric` are populated in 0 of 100 rows.
- The legacy financial `total` text is populated in all 100 rows and sanitizes to a non-empty numeric-looking string in 99 rows. That is not enough proof for exact money arithmetic.
- All 100 financial rows are marked `ILS`, but future mixed-currency behavior still needs an explicit rule.
- Financial status and transaction-type vocabularies contain spelling variants. Exact filters require canonical values or a reviewed normalization layer.
- Safety risk contains both Hebrew variants of “medium.” Ordered risk comparisons require a canonical risk vocabulary, not lexical ordering.
- All 1,676 alerts currently have severity level `3`; severity grouping is technically possible but not informative in the current data.
- `alerts.status` is empty for every row, so the product must decide whether `item_status` is the authoritative state.
- Email questions must define whether “all emails” means all 7,163 source rows or the 786 `project_related` rows represented in `data_index`.

## Question capability matrix

Legend:

- **Now**: implemented exact behavior.
- **DQ**: a future deterministic Data Query result after promotion.
- **DQ + retrieval**: structured facts from Data Query plus semantic explanation/evidence from another agent.
- **Retrieval**: Data Query should route away without executing a database plan.

### `data_index` - Now

DQ now:

- exact total and zero counts;
- counts by source table, item status, severity/risk, or processed state;
- distinct approved metadata values;
- top grouped counts;
- day/month time series over approved date fields;
- filters by project, source identifiers, approved dates, status, and severity/risk.

DQ + retrieval:

- “How many indexed safety records are high risk, and what do those reports say?”

Retrieval:

- titles, summaries, hashtags, index text, source documents, quotes, explanations, responsibility, and root cause.

Boundary:

- a `source_table=financial_transactions` count is an index count, not a financial total or guaranteed source-table count;
- `created_at`, `primary_date`, `event_date`, and `document_date` have different semantics.

### `financial_transactions` - proposed first business table

DQ:

- latest, earliest, and last N invoices/transactions;
- counts by transaction date, type, category, status, vendor, or currency;
- grouped counts and time series;
- bounded lookup returning date, vendor, type, status, currency, and approved source identity.

Deferred until numeric normalization is proven:

- sum, average, minimum, or maximum amount;
- financial KPIs based on money values;
- cross-currency totals.

DQ + retrieval:

- “What is the latest rejected invoice, and why was it rejected?”
- “How many unpaid invoices exist, and what do their documents say?”

Retrieval:

- purpose or justification of a charge;
- contractual interpretation;
- why payment was delayed or rejected;
- document quotation.

### `safety_reports`

DQ:

- latest, earliest, and last N reports;
- counts by date, site, risk level, grade, or item status;
- sums of the typed defect counters;
- time series of report and defect counts;
- worker-count aggregates after confirming whether values may be safely summed across reports.

DQ + retrieval:

- “How many high-risk reports remain unresolved, and what defects were found?”
- “Which site has the most severe defects, and what do the reports say?”

Retrieval:

- describe a defect;
- explain cause, responsibility, or required action;
- quote the report.

### `alerts`

DQ:

- latest, earliest, and last N alert metadata;
- counts by date, type, severity, item status, relevance, or input type;
- date time series.

DQ + retrieval:

- “How many critical open alerts exist, and what do they describe?”
- “What is the latest safety alert, and what evidence generated it?”

Retrieval or delay analysis:

- why an alert fired;
- whether it is valid;
- root cause or responsibility.

Promotion blockers:

- choose `item_status` versus empty `status`;
- validate the severity vocabulary;
- freeze the exact table as `public.alerts`, independent of the configurable Alert Agent embedding table.

### `meetings`

DQ:

- latest, earliest, and last N meeting metadata;
- counts by date and reviewed status;
- date time series;
- distinct statuses;
- count records with a decision only through a reviewed derived `has_decision` expression or view.

DQ + Meeting Evidence:

- “What was the latest meeting, and what was decided?”
- “How many open meetings exist, and what commitments remain?”

Meeting Evidence only:

- what was decided or said;
- who committed to an action;
- exact quotes, contradictions, rationale, responsibility, or deadlines.

Sensitive/content boundary:

- `attendances` is unstructured personal data;
- `decisions_made`, description, summary, and content are semantic evidence fields;
- subject may be returned only in a bounded lookup after review.

### `emails`

DQ:

- counts of project-related emails by received date, category, direction, attachment state, or item status;
- latest, earliest, and last N project-related email metadata;
- date time series and distinct reviewed categories.

DQ + retrieval:

- “What is the latest email from vendor X, and what did it request?”
- “How many approval emails arrived this month, and what approvals were given?”

Retrieval:

- what a sender said, requested, approved, or rejected;
- email summary, intent, quote, or event interpretation.

Promotion blockers:

- mandatory project-relevance rule;
- explicit PII policy for sender/recipient names and addresses;
- `received_date` must not be presented as the date of an event described in the body.

### `exceptions_report`

Implemented fixed Data Query capabilities:

- total, dated/undated, and date-scoped counts;
- stored urgency or stored item-status group counts;
- day/month `exception_date` series with an explicit undated bucket;
- dated latest, earliest, and bounded last-N safe metadata; and
- exact latest metadata followed only by evidence from the same attested
  exception/project/attachment relation.

Excluded or `not_computable`:

- exception numbers, identities, inspector/manager/company groups, and links;
- requested-amount, VAT, total, profit, and execution-day aggregates;
- subject/category interpretation, cause, responsibility, approval/rejection,
  lifecycle state, quotations, and raw narrative content.

The live 20-row audit found six missing canonical dates, incomplete and duplicate
exception numbers, no row-level currency, eight missing requested amounts, empty
VAT/total/profit columns, and only one populated `execution_days` value. Phase 4F
therefore closed without normalizing or mutating source data.

### `whatsapp_analysis`

DQ directly on the current table:

- count analysis rows/conversations;
- counts by `item_status`;
- bounded lookup by conversation ID.

Requires a declared view or fixed relation:

- latest conversation and date time series;
- exact task, decision, and deadline counts;
- open-task counts by status or responsible person.

Retrieval:

- task descriptions, decisions, participants, responsible people, or chat meaning.

Promotion blockers:

- no native domain date on `whatsapp_analysis`;
- date comes from a separate conversation table;
- JSON arrays contain content and personal data;
- the current “open task” logic is a text regex, not a reviewed business-state model.

### Deferred tables

- `consultants_reports`, `daily_work_log`, `gantt_tasks`, and `quality_control`: zero live rows, so no production correctness proof is possible yet.
- `other_documents`: primarily a retrieval source; its structured `document_type` is empty.
- `key_personnel_contacts`: PII directory rather than an early quantitative use case.
- chunk tables such as `*_documents`: retrieval/evidence sources, not direct business analytics contracts.
- backup tables: never Data Query sources.
- chat/settings/queue/internal tables: application infrastructure and out of the Content analytics product scope.
- graph/timeline tables: relationship infrastructure; any future use belongs to a declared bounded relationship phase, not generic joins.

## Recommended implementation sequence

### Phase 4A.1 - typed lookup foundation

Status: complete locally on 2026-07-24.

Implemented and tested locally:

- typed operations `lookup_latest`, `lookup_earliest`, and `lookup_last_n`;
- allowlisted sort fields and directions;
- deterministic tie-breaking by a stable ID;
- bounded record results in the machine contract, separate from narrative text;
- Hebrew and English routing for latest, earliest, and last-N questions;
- Main Agent consumption of the machine-readable lookup result;
- semantic-question precedence so explanation questions still route to retrieval;
- a real no-selection regression test proving the fallback is exactly `data_index`;
- removal of the direct-table `select` compatibility path from canonical lookup execution.

This slice uses mocks and the existing typed Data Query policy. It does not require a Supabase query, migration, table change, or business-table promotion.

At the Phase 4A.1 checkpoint, the lookup parser recognized business targets but the only registered policy was the dormant `data_index` lookup policy. Phase 4A.2 now adds a dormant financial policy; questions such as “What is the latest invoice?” still continue through the existing financial retrieval route because no matching exact deployment contract is available.

### Phase 4A.2 - promote `financial_transactions`

Status: complete as a local fail-closed implementation on 2026-07-25. This slice did not authorize or perform a Supabase query, migration, RPC deployment, saved-selection change, production activation, or any other database mutation.

Approved local contract:

- add a fixed typed policy for date, type, category, status, vendor, currency, and project scope;
- order financial lookups by `transaction_date`, then `id`;
- support exact latest, earliest, and last-N invoice/transaction questions;
- support exact count, group count, distinct, and time-series operations;
- return `not_computable` for money aggregates until numeric columns are populated and verified;
- hand semantic follow-up questions to retrieval rather than inferring explanations from metadata.

Implementation boundaries for this checkpoint:

- register the reviewed local policy independently from deployment availability;
- define invoice as the exact declared transaction-type filter, never as a fuzzy or multi-type synonym;
- exercise the policy only with trusted local fixtures or mocked exact execution;
- keep `financial_transactions` absent from the default `data_index` fallback;
- keep Main Agent lookup routing dormant while the matching exact execution contract is unavailable;
- keep all canonical execution on typed RPC payloads with no direct PostgREST table read;
- do not add or edit a SQL proposal, migration, RPC, permission, RLS policy, role, table, column, row, or UI selection.

Local completion requires the full Phase 4A.2 acceptance matrix below, focused and full regression verification, and documentation that separates fixture proof from live proof. Production activation and trusted-SQL/RPC comparison remain a separate approval-gated checkpoint.

### Later functional promotions

The remaining sequence was formally assigned on 2026-07-26. Planning does not
activate any table:

1. Phase 4B - `safety_reports`, completed on 2026-07-26;
2. Phase 4C - `alerts`, completed through authenticated UI closeout on
   2026-07-26;
3. Phase 4D - `meetings` metadata plus Meeting Evidence handoff, completed
   through authenticated UI closeout on 2026-07-26;
4. Phase 4E - `emails` with relevance and PII rules, completed through
   authenticated UI closeout on 2026-07-27;
5. Phase 4F - `exceptions_report`, completed through authenticated UI closeout
   on 2026-07-28;
6. Phase 4G - `whatsapp_analysis`, the next unauthorized approval gate, with
   temporal/task metrics blocked until a
   declared relation and business-state model exist;
7. Phase 4H - `consultants_reports`, reserved behind its zero-row readiness gate;
8. Phase 4I - `daily_work_log`, reserved behind its zero-row readiness gate;
9. Phase 4J - `gantt_tasks`, reserved behind its zero-row readiness gate;
10. Phase 4K - `quality_control`, reserved behind its zero-row readiness gate.

Every remaining table uses three explicit checkpoints: `.1` read-only audit and
typed policy, `.2` implementation and automated verification, and `.3`
authenticated UI verification/documentation/closeout. The complete
implementation-ready contract is in
`docs/data-query-agent-phases4c-4k-roadmap.md`.

## Phase 4A.1 acceptance tests

Before the typed lookup foundation is described as working:

1. Latest, earliest, and last-N wording produces the matching typed operation.
2. Equal-date ties are deterministic.
3. Sort fields, directions, filters, and limits outside the policy are rejected.
4. Lookup rows are exposed through a bounded machine-readable record contract.
5. Hebrew and English variants route consistently.
6. Semantic follow-ups route to retrieval instead of inventing an explanation from metadata.
7. The real missing-settings path resolves to exactly `data_index`.
8. Canonical lookup execution does not use a raw PostgREST table read.
9. Workflow and logs retain only redacted provenance and machine metrics.

All nine acceptance items pass in the focused local suite. The tests also cover temporal-phrase false positives, invalid/oversized cardinality, ambiguous targets, planner operation substitution, exact-RPC operation drift, `not_computable` payloads, and the dormant production-routing gate.

## Phase 4A.2 acceptance tests

The local acceptance matrix passes through trusted fixtures and mocked typed exact execution:

1. English latest-invoice wording maps to `lookup_latest`.
2. English last-five-invoices wording maps to `lookup_last_n` with limit 5.
3. English earliest-transaction wording maps to `lookup_earliest`.
4. Hebrew latest, earliest, and last-N wording maps to the same typed operations.
5. Invoice and transaction targets map only to `financial_transactions`.
6. Financial ordering is canonicalized to `transaction_date`, then `id`.
7. Equal-date ties use stable `id` ordering.
8. Null `transaction_date` values sort last.
9. Zero-row and one-row lookups return bounded deterministic results.
10. Limit 25 is accepted and limit 26 is rejected by the financial policy.
11. Unicode/Hebrew vendor equality filters validate and execute in fixtures.
12. Invoice means exactly `transaction_type = 'חשבונית'`; missing or different filters are rejected.
13. Fixture counts cover status, type, vendor, currency, and date-range filters.
14. Caller `dateTo` uses an exclusive next-UTC-day boundary.
15. Content-bearing and other unapproved fields are rejected.
16. `created_at` is rejected as alternate financial date-field drift.
17. Wrong operation, table, or lookup limit is rejected.
18. Missing or mismatched exact-operation attestation is rejected.
19. Financial `sum`, `avg`, and natural-language amount requests return `not_computable`.
20. Lookup results bypass the run cache because record caching is not authorized.
21. Workflow history exposes record counts/field names, not questions, filters, or record values.
22. `machineResult.recordsByRequestId` is bounded by the approved lookup limit and selected fields.
23. Canonical execution remains typed-only; no raw PostgREST `select` fallback is present.
24. A registered policy with no matching exact deployment contract performs no execution.
25. Main does not schedule Data Query for invoice lookup while that contract is dormant.
26. “Why was the latest invoice rejected?” retains semantic precedence and retrieval routing.
27. The original `data_index` metric/Phase 4A.1 tests remain green and the real missing-selection fallback remains exactly `data_index`.

These tests prove the local policy and fail-closed behavior only. They do not prove that a financial RPC is deployed, that live database results match trusted SQL, or that production invoice lookup uses Data Query.

## Phase 4A.0 exit gate

Phase 4A.0 is complete because:

- the current exact capability is separated from proposed capabilities;
- real live tables, structured fields, data coverage, and source-index drift are mapped;
- question families are classified as Data Query, Data Query plus retrieval, or retrieval-only;
- promotion priorities and blockers are explicit;
- all identified security findings are isolated in `docs/data-query-agent-deferred-security-register.md`;
- the next implementation slice has a deterministic acceptance contract.

Phase 4A.1 is complete as local code and automated-test work. It did not authorize or perform a Supabase query, migration, table change, or business-table promotion.

## Verification - 2026-07-24

- `node --check src/subagents/dataQuery.js`: passed.
- `node --check src/agent.js`: passed.
- `git diff --check`: passed.
- `npm.cmd run test:data-query`: all 40 active Data Query tests passed.
- `npm.cmd test`: exit code 1 with the same 11 unrelated UI/static-contract failures already tracked in prior Data Query phase documents; no Data Query test failed.
- The four-question manual UI regression matrix passed. The user independently confirmed the selected latest invoice and latest meeting against their source tables. Full evidence is in `docs/data-query-agent-phase4a1-manual-regression.md`.
- No Data Query API/runtime smoke test, Supabase query, migration, or live database change was executed in Phase 4A.1.
- At the Phase 4A.1 checkpoint, the next gated slice was Phase 4A.2 local financial policy work; the verification below records its completion while keeping every live database object separately approval-gated.

## Verification - 2026-07-25

- `node --check src/subagents/dataQuery.js`: passed.
- `node --check src/subagents/dataQueryMetadata.js`: passed.
- `node --check src/agent.js`: passed.
- `node --check src/prompts.js`: passed.
- `node --check src/tools.js`: passed.
- `node --check test/run-tests.js`: passed.
- `git diff --check`: passed.
- `npm.cmd run test:data-query`: all 50 active Data Query tests passed, including the complete Phase 4A.2 fixture matrix and all prior tests.
- `npm.cmd test`: exit code 1 with exactly the same 11 unrelated UI/static-contract failure names recorded before Phase 4A.2; all Data Query tests passed and no new full-suite regression appeared.
- No Data Query API/runtime smoke test, live Supabase query, schema scan, migration, RPC proposal/deployment, settings mutation, or production activation was performed.
- Manual UI execution was not repeated by Codex in this local slice. The exact repeatable checklist and unchanged expected routes are in `docs/data-query-agent-phase4a2-manual-regression.md`.
- The next checkpoint, if approved, is a separate financial exact-contract design/deployment and trusted-SQL comparison gate. This local phase stops before that work.

## Existing-interface activation audit - 2026-07-25

Status: read-only audit complete; financial Data Query activation remains dormant.

The user approved checking whether the agent could use an already-existing authorized financial read interface without changing tables or any database object. The audit used the configured managed Data Query identity and made no mutation.

Observed live API surface:

- managed authentication succeeded;
- managed OpenAPI discovery returned HTTP 200;
- `match_financial_transactions` exists, but its published inputs are `query_embedding`, `match_count`, `match_threshold`, and `filter`, so it is a semantic/vector retrieval contract rather than an exact structured-query contract;
- `bidoc_data_query_data_index_v1` remains the only public typed Data Query contract with operation, filter, grouping, ordering, selection, metric, granularity, and limit inputs;
- no typed exact financial Data Query RPC is exposed;
- a managed-identity `HEAD` request to `financial_transactions?select=id&limit=1` returned HTTP 206 and a count of 100 rows.

The successful direct-table permission is not treated as an approved interface. It confirms the already-deferred SEC-001 finding: the native `authenticated` role can reach raw tables beyond the fixed Data Query RPC boundary. Activating Data Query through this path would violate the existing no-raw-PostgREST and no-privilege-bypass contract.

Therefore no source implementation, settings change, direct row query, route activation, RPC proposal, migration, permission change, or database mutation was made. The local financial policy and all Phase 4A.2 work remain preserved.

Under the current boundaries, exact financial Data Query cannot be activated from an existing interface. It must remain dormant unless the user explicitly changes one of these constraints:

1. authorize a separately reviewed typed exact read contract; or
2. explicitly replace the no-direct-PostgREST rule with a reviewed typed GET-only adapter despite the SEC-001 credential risk.

The second option is not recommended while the managed identity also has broad raw-table privileges.

### Read-only boundary clarification

The user subsequently clarified the governing boundary:

- structured SQL-style reads are allowed because the agent must read existing tables;
- `financial_transactions` may be queried read-only;
- tables and their contents must never be changed.

Approved agent-code-only slice:

- add a fixed managed-identity PostgREST `GET`/`HEAD` adapter for the registered `financial_transactions` policy;
- allow only the policy's reviewed fields, filters, ordering, limits, and operations;
- hardcode the table contract rather than accepting arbitrary paths or SQL;
- use `GET`/`HEAD` only and reject every mutation method by construction;
- keep semantic/explanation questions on the retrieval path;
- keep monetary aggregates `not_computable`;
- do not add or edit SQL, RPCs, migrations, grants, RLS, roles, schema objects, tables, columns, rows, or saved UI selections.

The adapter may use the existing managed Data Query identity for authentication. The broader SEC-001 credential risk remains documented and deferred; this slice constrains what the agent code can issue but does not claim credential-level least privilege.

## Phase 4A.3 - approved read-only financial activation

Status: complete in agent code and live-read verified on 2026-07-25.

This checkpoint supersedes the earlier dormant-activation conclusion after the user clarified that structured reads from existing tables are allowed and only database/table mutation is forbidden.

Implemented contract:

- the reviewed `financial_transactions` policy activates only when dedicated Data Query credentials are configured;
- the no-selection fallback contains the two reviewed built-ins: exact-RPC `data_index` and credential-gated `financial_transactions`;
- the financial transport is hardcoded to `/rest/v1/financial_transactions`;
- exact counts use `HEAD`; bounded record lookups and complete local grouping/distinct/time-series derivation use `GET`;
- the adapter cannot accept a method, raw SQL, schema name, table path, join, or mutation statement from a plan;
- the existing field, filter-operator, ordering, operation, date, and limit allowlists remain mandatory before transport execution;
- invoice remains exactly `transaction_type = 'חשבונית'`;
- semantic/explanation questions retain retrieval precedence;
- money questions remain `not_computable`;
- complete-read derivation fails closed above 5,000 matching rows instead of sampling.

Live read-only verification with the configured managed identity:

- latest invoice: `lookup_latest`, status `ok`, exact, one bounded row, 23 matching invoice records;
- invoice count: `count`, status `ok`, exact count/cardinality 23;
- invoices by status: `group_count`, status `ok`, exact, cardinality 23;
- all three runs completed without warnings.

Verification:

- `npm.cmd run test:data-query`: 52 tests passed;
- `npm.cmd test`: all Data Query tests passed; the same 11 unrelated UI/static-contract tests failed;
- `git diff --check`: passed;
- the focused transport test proves `HEAD`, `GET`, `GET` for count, grouping, and lookup, no request body, the hardcoded table endpoint, the managed bearer token, deterministic ordering, and rejection of a renamed table before network execution.

No SQL, RPC, migration, grant, RLS policy, role, schema object, table, column, row, saved UI selection, or Supabase setting was added or changed. The pre-existing SEC-001 credential-level privilege risk remains deferred; this checkpoint limits the agent's emitted requests but does not narrow the identity's database privileges.

The repeatable manual UI gate is `docs/data-query-agent-phase4a3-manual-regression.md`.

## Phase 4A.3 UI routing regression correction - 2026-07-25

The first post-activation UI run did not schedule Data Query. The authenticated
Subagents screen showed why: the persisted table selection contained only
`data_index`, and runtime settings treated that saved selection as an exclusive
manifest. The credential-gated built-in `financial_transactions` policy was
therefore absent even though the read adapter itself was available.

The correction keeps the persisted UI selection unchanged and merges only the
reviewed, credential-gated built-in financial policy into the runtime manifest.
It does not discover, select, or activate arbitrary tables.

Exact structured lookups now also:

- use the deterministic typed lookup planner before any built-in LLM planner;
- run `data_query` alongside the semantic financial enrichment tool;
- bypass Hybrid Search, Project Graph Search, and reranking;
- treat Data Query as authoritative for record identity, order, date, status,
  and other structured fields;
- retain the semantic financial result for description, amount text, and
  citations when it supports the same record;
- render exact Data Query fields and the semantic tool answer in the fallback
  if final synthesis fails.

Authenticated UI verification with `What is the latest invoice?` passed after
restarting the local server. The workflow recorded all three generic retrieval
steps as skipped, `data_query` as `ok` with one plan and no warnings,
`financial_transactions` as successful, no detected conflict, and a successful
Main Agent response. The answer identified the latest invoice as
2026-02-28 and included supplier, status, transaction type, and currency.

The corrected run used 18,410 total tokens. The failed run had already used
30,851 tokens before its Main Agent response failed, including 25,839 tokens in
the reranker alone.

Verification after the correction:

- `npm.cmd run test:data-query`: 54 tests passed;
- syntax checks passed for `src/agent.js`,
  `src/subagents/dataQuery.js`, and `test/run-tests.js`;
- `git diff --check`: passed;
- the full suite retained exactly the same 11 unrelated UI/static-contract
  failures, with no Data Query failure.

No database object, table, row, permission, RLS policy, role, migration, RPC,
saved UI selection, or Supabase setting was changed.

## Phase 4B promotion closeout - 2026-07-26

Status: `safety_reports` promotion is complete through audit, implementation,
automated regression, authenticated UI verification, and documentation.

Promoted capability:

- exact report count, canonical risk/site/grade/stored-status breakdowns,
  report-count time series, four approved defect-counter sums, and bounded
  latest/earliest/last-N metadata;
- fixed Content `safety_reports` `HEAD`/`GET` transport with dedicated Data Query
  identity, typed plan validation, project/date scope, stable report-date/ID
  ordering, bounded scans/lookups, and no mutation path;
- canonical risk vocabulary low/medium/high/unknown with two live Hebrew medium
  spellings merged and unmapped stored drift classified as unknown;
- deterministic exact answers, retrieval-only semantic descriptions, and mixed
  exact-plus-evidence routing with report-risk/defect-severity separation;
- deliberate `not_computable` for cross-report worker snapshots and unproven
  resolution-state questions;
- fail-closed document enrichment. The live relationship is exact, but a caller
  must carry an authorization-bound project scope before a link is displayed.

Acceptance evidence:

- 9/9 Phase 4B filtered tests and 80/80 complete Data Query tests pass;
- the full suite is 325/336 with only the same 11 unrelated UI/static-contract
  failures;
- all 13 required authenticated chat checks passed after affected regressions
  were corrected and rerun;
- live workflow telemetry contains operation/field/count structure without raw
  URLs, UUIDs, report values, attachment identifiers, or plan/request IDs;
- no table, row, schema, RPC, migration, role, grant, permission, RLS policy,
  Supabase setting, or saved table selection changed.

Deferred after this closeout:

1. authorization-bound caller-to-project membership for direct API/UI scope;
2. link display when that scope is available;
3. worker/additive-period business semantics;
4. report resolution-state business semantics;
5. site normalization and unique-defect identity;
6. every Phase 4C-4K table promotion.

The implementation-ready evidence is in
`docs/data-query-agent-phase4b-safety-reports-manual-regression.md`. At that
checkpoint, implemented behavior stopped after Phase 4B pending explicit
approval. The Phase 4C-4K sequence and checkpoint contract were then formalized
in `docs/data-query-agent-phases4c-4k-roadmap.md`; later sections record the
separately approved Phase 4C work.

## Phase 4C alerts promotion closeout - 2026-07-26

Status: complete through read-only audit, typed policy, runtime implementation,
automated regression, authenticated UI verification, and documentation.

The live table remains at 1,676 rows. It has a complete unique `id`, a complete
`project_id`, 1,673 canonical `data_date` values, six alert types, four technical
input types, one opaque stored severity value (`3`), one stored item status
(`בטיפול`), and an all-true relevance flag. The separate `status` field remains
empty. Three null business dates and extensive date ties require dated-only
lookup behavior and stable date-plus-ID ordering.

The implemented exact scope is limited to alert-row counts, approved categorical
breakdowns, reconcilable date time series, and bounded dated metadata lookups.
No mapping from level `3` to critical/high/medium/low and no mapping from stored
item status to open/closed/resolved/unresolved is approved. Alert narrative,
source IDs, direct links, unique-source counts, and causal/evidence questions
remain outside the exact contract.

The exact source is fixed `public.alerts`; it never inherits the configurable
Alert Agent embeddings table or semantic `match_*` RPC. The full policy,
implementation evidence, and UI matrix are in
`docs/data-query-agent-phase4c-alerts.md`.

Acceptance evidence is 9/9 filtered Phase 4C test groups, 89/89 protected Data
Query tests, and 13/13 authenticated UI cases. The UI verified 1,676 total rows,
1,673 dated rows in the accepted inclusive range, safe latest/last-five metadata,
stored-value labeling, Hebrew parity, semantic route isolation, the mixed 142
Delay count with an evidence boundary, and fail-closed unsupported severity and
lifecycle questions. No database object, Content alert row, permission, RLS,
Supabase/Auth setting, or saved selection changed. At that Phase 4C checkpoint,
Phase 4D had not started.

One supplemental user-reported Hebrew mixed latest-plus-why sentence was later
corrected with an anchored positive grammar and passed authenticated UI
verification. It returns the same safe latest metadata plus a Hebrew evidence
boundary; arbitrary project/source/person suffixes and ingestion-time wording
remain fail-closed. The protected suite remained 89/89 at that Phase 4C
checkpoint; the Phase 4D section below supersedes its then-unstarted status.

## Phase 4D meetings promotion closeout - 2026-07-26

This section supersedes the historical candidate wording above. `public.meetings`
is now the fifth reviewed exact-capability table. Its fixed credential-gated
adapter exposes exact counts, approved date/stored-status groups and series,
distinct stored statuses, and bounded date/status lookups. Subject, decisions,
attendance, lifecycle meanings, source locators, and links remain excluded or
`not_computable`.

Pure semantics use Meeting Evidence only. The approved mixed family runs Data
Query first and then requires the exact meeting/project/attachment relation to
evidence `source_id`; `primary_date` cannot attest identity. A temporary
RPC-first structural-failure fallback performs one fixed bodyless evidence read,
caps the complete result at 500, validates identity/vector shape, performs no
adjacency expansion, and exposes no identifiers, filenames, URLs, embeddings,
scores, or provider errors.

Acceptance evidence is 10/10 Phase 4D groups, 99/99 protected Data Query tests,
and 17/17 authenticated UI cases. The full suite is 344/355 with the same 11
unrelated UI/static failures; React build remains blocked by the absent local
Vite executable. No Content data, database object, authorization setting, or
saved selection changed. Local unscoped acceptance relies only on the audited
single-project shape; production/multi-project authorization and SEC-001 remain
deferred. Phase 4E and Phase 4F are complete through their authenticated UI
closeouts; Phase 4G is the next approval gate and remains unstarted.
