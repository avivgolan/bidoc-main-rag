# Data Query Agent Phase 4C - alerts promotion

Audit and policy date: 2026-07-26
Implementation date: 2026-07-26
Supplemental Hebrew regression correction: 2026-07-26
Table boundary: existing Content table `public.alerts` only
Database boundary: structured read-only inspection; no database object, data,
authorization, setting, or saved-selection mutation

## Status

- Phase 4C.1 read-only source audit and typed-policy decision: complete.
- Phase 4C.2 implementation and automated verification: complete locally.
- Phase 4C.3 authenticated UI verification and closeout: complete.
- Phase 4C is closed for review. All 13 required authenticated UI cases passed
  after affected wording was isolated and rerun.
- A user-reported Hebrew mixed latest-plus-why wording gap was subsequently
  corrected and passed one additional authenticated UI case. The original
  13-case matrix remains the planned closeout record.
- `alerts` is active only through the fixed credential-gated Data Query contract
  described below. Phase 4D has not started.

## Phase 4C.1 source-of-truth audit

The live audit authenticated with the configured managed Data Query identity,
read the PostgREST OpenAPI description, and issued only fixed `GET` requests to
the existing `public.alerts` table. The row projection was fixed and capped at
5,000 rows. The audit output contained schema facts, value distributions,
coverage, and relationship counts only. It did not emit credentials, project or
record identifiers, source identifiers, URLs, narrative content, people, or raw
provider errors.

### Table identity and deterministic scope

| Contract item | Audited result |
|---|---|
| Connection | Content Supabase |
| PostgreSQL schema | `public` |
| Exact source table | `alerts` |
| Exact row count | 1,676 |
| Stable ID | `id` (`bigint`); 1,676 populated, positive, and unique |
| Project scope | `project_id` (`uuid`); 1,676 populated, one distinct project |
| Canonical alert date | `data_date` (`timestamptz`) |
| Date coverage | 1,673 populated; 3 null; no invalid populated value |
| Date range | 2023-10-01 through 2026-03-31 |
| Date ties | 144 distinct timestamps; 123 tied groups; largest tie 145 rows |
| Ingestion time | `created_at`; 1,676 populated and unique, all in July 2026 |

`data_date` is the business date. `created_at` is ingestion metadata and must not
replace one of the three missing alert dates. A dated latest, earliest, or last-N
lookup excludes null `data_date` values. Deterministic ordering is:

- latest and last N: `data_date DESC NULLS LAST, id DESC`;
- earliest: `data_date ASC NULLS LAST, id ASC`.

The high tie rate makes the stable ID tie-breaker mandatory. The ID remains an
internal execution value and is never displayed or retained in workflow
telemetry.

The live snapshot contains only one project, so it proves field coverage but not
multi-project isolation. The Phase 4C.2 runtime appends a validated caller project
filter when scope is present and uses synthetic cross-project negative tests. The
deferred caller-membership risk remains a production release boundary.

### Live structured vocabularies

#### Alert type

| Stored value | Rows | Approved English query/display alias |
|---|---:|---|
| `עדכון` | 755 | update |
| `התראה` | 593 | alert or warning |
| `עיכוב` | 142 | delay |
| `חריג` | 105 | exception or anomaly |
| `איכות` | 60 | quality |
| `אירוע בטיחות` | 21 | safety event |

The stored Hebrew value remains authoritative. These aliases support bilingual
filtering and display; they do not impose a severity or lifecycle order. An
unmapped future value is vocabulary drift and must fail closed until reviewed.

#### Severity

`severity_level` is a `smallint`. Every one of the 1,676 live rows stores only
the value `3`.

No audited source defines what `3` means. It is therefore approved only as the
opaque label **stored severity level 3**. Phase 4C must not translate or relabel
it as critical, high, medium, low, urgent, or any Hebrew equivalent. Severity
ordering, highest/lowest severity, severity arithmetic, and a count filtered by
one of those unproven labels are `not_computable`. A breakdown explicitly by
stored severity level may return the single `3` bucket with this limitation.

#### State

| Field | Populated | Live vocabulary | Decision |
|---|---:|---|---|
| `status` | 0 of 1,676 | none | Excluded; no metric can be computed from it |
| `item_status` | 1,676 of 1,676 | `בטיפול` only | Approved only as stored item status |

`item_status` may support an exact group or filter labelled **stored item
status**. The literal English display gloss is **being handled**. It does not
prove that an alert is open, unresolved, active, valid, acknowledged, or
escalated. Questions requiring any of those lifecycle meanings are
`not_computable`; the agent must not silently substitute `item_status` for an
empty `status` field.

#### Relevance

`is_relevant` is a populated boolean and is `true` on all 1,676 rows. Boolean
filtering/grouping is structurally exact, including an exact current zero for
`false`, but the current one-value distribution makes a relevance breakdown
non-informative. It must be described as the stored relevance flag, not as a
fresh evaluation of whether an alert is truly useful or valid.

#### Input type

| Stored value | Rows | Approved display label |
|---|---:|---|
| `email` | 1,282 | email |
| `attachment/meeting_summary` | 352 | meeting-summary attachment |
| `attachment/safety_report` | 24 | safety-report attachment |
| `attachment/exception_report` | 18 | exception-report attachment |

These are exact technical origin categories. They do not prove source-record
identity, document ownership, or a safe link relationship. Unmapped future
values fail closed until reviewed.

### Source and link relationship decision

All 1,676 rows populate `input_data_id` and `data_link`. The stored links are all
syntactically credential-free HTTP(S) URLs. The source-identifier distribution
also proves that multiple alerts may originate from the same input:

| Input type | Alerts | Distinct stored input IDs |
|---|---:|---:|
| email | 1,282 | 670 |
| meeting-summary attachment | 352 | 142 |
| safety-report attachment | 24 | 9 |
| exception-report attachment | 18 | 15 |

This is coverage evidence, not a verified foreign-key or authorization contract.
The repository has no fixed alert resolver that rechecks alert project, source
project, source type, source identifier, and unique matching row before exposing
a document link. The semantic Alert Agent currently reads a configurable table
and may return stored links, which is a separate retrieval behavior.

Therefore Phase 4C.2 must not expose `data_link`, join on `input_data_id`, call a
generic source resolver, or claim that an alert count is a count of unique source
documents. Exact alert lookups display no verified source link. A future link
feature requires a separate fixed relationship audit and authorization-bound
resolver.

### Metadata approved for the typed plan

| Field | Approved use |
|---|---|
| `id` | Internal stable identity and ordering tie-breaker only |
| `project_id` | Internal caller-scope filter only |
| `data_date` | Select, inclusive date filter, order, group/time series |
| `alert_type` | Select, exact/canonical-alias filter, group |
| `severity_level` | Select/group/filter only as opaque stored value `3` |
| `input_data_type` | Select, exact/canonical-alias filter, group |
| `item_status` | Select/group/filter only as stored status `בטיפול` |
| `is_relevant` | Select, boolean filter, group |

`created_at` and empty `status` are not Query Plan fields. The following remain
outside plans, deterministic answers, logs, and workflow telemetry:

- narrative/evidence: `question`, `answer`, `alert_description`,
  `analyzed_data`, `summary`, and `content`;
- content/derived data: `hashtags`, `metadata`, and `embedding`;
- source identifiers and locators: `input_data_id` and `data_link`;
- displayed or logged raw `id` and `project_id` values.

Narrative fields remain Alert Agent or retrieval evidence. They are never exact
metrics and cannot change a Data Query count or selected record.

## Implemented Phase 4C.2 typed contract

The approved and implemented Phase 4C.2 runtime is limited to this contract.

### Fixed source and transport

- hardcode Content `public.alerts` as the exact source;
- activate only with dedicated Data Query credentials;
- use fixed PostgREST `HEAD` for exact count and fixed `GET` for bounded lookup
  or complete local derivation;
- permit no request body, configurable method, SQL, join, arbitrary path, schema
  override, or mutation;
- never use `CONTENT_ALERTS_TABLE`, `alerts_embeddings_gf`, a saved Alert Agent
  table, `match_alerts`, or any `match_*` RPC as the exact source;
- keep a 5,000-row complete-scan cap and fail closed rather than sample;
- preserve the inherited five-plan cap and timeout limits.

### Approved operations and limits

- `count` of alert rows, including alerts with null `data_date` unless a date
  filter is requested;
- `group_count` by exactly one of `alert_type`, `severity_level`,
  `input_data_type`, `item_status`, or `is_relevant`;
- alert-count `timeseries` by day or month over `data_date`;
- `lookup_latest`, `lookup_earliest`, and `lookup_last_n` over dated alerts;
- default last-N limit 5 and hard maximum 25;
- lookup projection limited to `data_date`, `alert_type`, `severity_level`,
  `input_data_type`, `item_status`, and `is_relevant`, plus internal `id` for
  stable ordering.

No numeric `sum`, `average`, `minimum`, `maximum`, severity comparison, generic
`top_n`, content search, arbitrary distinct field, or cross-table aggregate is
approved.

### Approved filters

- `project_id = <validated caller scope>` appended by the runtime when present;
- UTC calendar-date bounds on `data_date`: a date-only start uses `gte`, and a
  date-only inclusive end compiles to `lt` the next UTC midnight;
- exact or approved bilingual-alias `eq`/`in` filters on `alert_type` and
  `input_data_type`;
- `eq`/`in` on the opaque stored `severity_level = 3` only;
- `eq`/`in` on stored `item_status = 'בטיפול'` only;
- boolean `eq` on `is_relevant`;
- explicit null-date checks only for completeness accounting, never as a
  `created_at` fallback.

Unknown values, fields, filters, operations, orderings, aliases, tables, and
limits are rejected before network execution. Stored vocabulary drift makes the
affected result `not_computable`; it is not silently merged into an `other`
bucket.

### Null-date result contract

Total and categorical counts cover all matching rows. A time series covers the
dated subset and must also expose an undated count so its total remains
reconcilable. The current live values are 1,673 dated and 3 undated. A temporal
lookup adds `data_date IS NOT NULL`; if a filtered subset has no dated row, it
returns no dated alert rather than selecting by `created_at`.

Day and month buckets use UTC calendar boundaries. Deterministic time-series
answers label this explicitly so a Jerusalem-offset timestamp is not silently
presented as a local-calendar bucket.

Explicit timestamp bounds retain their typed timestamp comparison; they are not
reinterpreted as local calendar dates.

## Routing contract

Data Query only:

- total alert count;
- counts by approved type, stored severity level, input type, stored item
  status, relevance flag, or date range;
- day/month alert-count time series with undated accounting;
- bounded latest, earliest, or last-N structured metadata.

Mixed exact plus semantic request:

- an approved exact count or metadata lookup combined with a request for alert
  description or evidence;
- only Data Query executes in Phase 4C because no authorization-bound same-record
  resolver was proven;
- the exact fact remains authoritative and the deterministic answer adds an
  explicit evidence boundary explaining why semantic detail was not attached;
- unscoped Alert Agent output is never presented as evidence for the exact row or
  exact filtered set.

Alert Agent, retrieval, or delay analysis only:

- why an alert fired;
- whether it is valid, correct, important, or actionable;
- evidence, quotation, summary, root cause, responsibility, recommendation, or
  corrective action;
- interpretation of the narrative/content fields.

Explicit `not_computable` examples:

- critical, high, medium, low, highest, or lowest severity alerts;
- open, closed, resolved, unresolved, active, acknowledged, or escalated alerts;
- counts of unique incidents, issues, messages, documents, or attachments;
- source-document links from the current exact contract;
- any metric that silently drops an unsupported qualifier.

## Security decision carried into Phase 4C.2

The source table contains a complete `project_id`, so no new table-specific
scope blocker was found. Phase 4C.2 was implemented as another local,
agent-code-only, fixed read slice under the already deferred SEC-001 and SEC-002
risk posture. That does not make the managed identity least privilege and does
not prove that a caller-supplied project ID is authorized membership.

Consequently:

- approval covered only the Phase 4C alert slice and did not authorize Phase 4D;
- project scope must be validated and applied whenever available;
- exact links remain disabled;
- production or multi-project release remains blocked on authorization-bound
  caller membership and cross-project proof unless the user separately accepts
  that narrower documented risk;
- no grant, role, RLS, Auth, permission, schema, or database remediation is part
  of Phase 4C.2.

## Phase 4C.2 automated matrix

1. Register exactly one fixed `alerts` policy and preserve the reviewed
   `data_index`, financial, invoice, and safety manifests.
2. Prove configured Alert Agent table/RPC changes cannot redirect exact alerts
   execution.
3. Cover English and Hebrew total, type, input type, stored status, stored
   severity, relevance, date-range, latest, earliest, and last-five questions.
   Include a negative parser case proving that the entity noun “alerts” does not
   accidentally add the `alert_type = 'התראה'` category filter.
4. Prove the six alert-type aliases and four input-type aliases filter the exact
   stored values without rewriting stored data.
5. Prove `critical`/high/medium/low and open/closed/resolved/unresolved requests
   return typed `not_computable` without a database fetch.
6. Prove empty `status` is never substituted and `item_status` is labelled as
   stored status only.
7. Cover zero-row and one-row results, all-null and partially-null date fixtures,
   inclusive date bounds, timezone boundaries, tied dates, and stable-ID order.
8. Reconcile time-series rows with an explicit undated count and prove temporal
   lookups never fall back to `created_at`.
9. Cover approved project scope and a synthetic cross-project rejection without
   committing live UUIDs.
10. Fail closed on new stored type, input-type, status, severity, or non-boolean
    relevance drift.
11. Prove fixed `HEAD`/`GET`, no body, fixed `/rest/v1/alerts`, complete-scan cap,
    timeout, credential failure, sanitized provider failure, and validation
    before fetch.
12. Prove raw IDs, project IDs, source IDs, URLs, plan/request IDs, and narrative
    values do not enter telemetry or deterministic answers.
13. Prove pure semantic questions route away from Data Query and mixed answers
    preserve exact counts while refusing incompatible same-record enrichment.
14. Prove no source link is displayed from the exact alert contract.
15. Run the entire prior Data Query suite in addition to the focused alert
    matrix.

All 15 categories are covered by the nine Phase 4C test groups. The final
adversarial additions prove that ordinal, negated, random, person/project, and
unknown-source lookup qualifiers fail closed with zero reads; an untrusted model
`data_query` hint cannot originate an alert metric or suppress retrieval; and
valid positive time-series grammar remains accepted.

## Phase 4C.2 implementation and automated verification

Implemented behavior:

- one fixed `public.alerts` managed-read adapter, active only with dedicated Data
  Query credentials and limited to bodyless `HEAD`/`GET` requests;
- deterministic one-plan count, approved one-field breakdown, UTC day/month
  time series, and dated latest/earliest/last-N execution;
- exact filter, project/date scope, row-cardinality, vocabulary, null-date,
  duplicate-ID, and stable-order attestation before an answer is accepted;
- closed positive bilingual grammar for exact alert metrics/lookups, including
  whole-clause rejection of silently dropped qualifiers and model-hint isolation;
- deterministic answers that label opaque severity, stored status/relevance,
  UTC bucketing, missing links, and mixed-request evidence boundaries;
- browser-facing alert tool-call projection that preserves safe workflow status
  and counts while removing caller, plan, request, row, project, source, URL, and
  narrative values. The authenticated direct machine API retains its typed
  contract behind `BIDOC_API_SECRET`.

Automated evidence:

- JavaScript syntax checks passed for the changed runtime, prompt, metadata, and
  test files;
- Phase 4C filter: 9/9 test groups passed;
- protected Data Query suite: 89/89 passed, including all earlier financial and
  safety regressions;
- full repository suite: 334/345 passed; the same 11 unrelated Settings,
  Workflow, and Timeline static-contract tests failed, with no Data Query failure;
- `git diff --check` passed with line-ending warnings only;
- `npm.cmd run react:build` could not start because the local `vite` executable is
  not installed; no dependency installation was authorized or attempted;
- independent correctness and client-output/privacy reviews found no remaining
  Phase 4C P1/P2 code blocker after the final adversarial fixes.

## Phase 4C.1 verification and immutability

- At the Phase 4C.1 audit checkpoint, read-only repository inspection confirmed
  that no production alerts policy was registered and the existing fallback
  heuristic was not safe for promotion. Phase 4C.2 subsequently added the fixed
  typed policy described above.
- Managed OpenAPI discovery and two fixed paginated `public.alerts` `GET`
  requests completed successfully with an exact `Content-Range` total.
- The live audit returned all 1,676 rows under the fixed 5,000-row cap and emitted
  only the aggregate evidence recorded above.
- The historical row-count, date, severity, relevance, and empty-status snapshot
  was revalidated; the audit additionally confirmed project scope, tie density,
  exact vocabularies, and link/source limitations.
- `npm.cmd run test:data-query`: 80/80 protected Data Query tests passed; Phase
  4C.1 added no runtime test because it changed no runtime behavior.
- `git diff --check`: passed; Git reported only the existing LF-to-CRLF working
  copy warnings.
- No runtime source, test, settings, or browser file was changed in Phase 4C.1.
- No table, row, column, schema, RPC, function, migration, role, grant,
  permission, RLS policy, Supabase setting, Auth setting/user, or saved table
  selection was added, edited, or deleted.

## Phase 4C.3 authenticated UI verification and closeout

The authenticated matrix ran against the current local server at
`http://localhost:4000` after re-authentication. Every required final case passed
in an isolated chat. The live table contained one project, so the unscoped
system-level counts below reconcile with the 1,676-row read-only audit. Because
no authorization-bound same-record source resolver exists for alerts, exact and
mixed answers deliberately exposed no alert links or narrative evidence.

| # | Question and final observed result | Exact contract / scope | Live route evidence |
|---:|---|---|---|
| 1 | `How many alerts are there?` -> 1,676 | `count`; no date or project filter | Data Query used; Hybrid Search, graph search, reranker, and Main skipped |
| 2 | `Break down alerts by stored severity level` -> 1,676 at `Stored severity level 3 (no verified business mapping)` | `group_count` by opaque stored `severity` | Exact route preserved the stored value and did not relabel it critical/high/medium/low |
| 3 | `Break down alerts by stored item status` -> 1,676 at `Being handled (stored item status only)` | `group_count` by approved stored `item_status` | Exact route did not reinterpret the value as open/closed/resolved/unresolved |
| 4 | `Show the latest alert` -> 2026-03-31, Update, stored severity 3, Email input, stored item status Being handled, relevance true | `lookup_latest`; dated rows only; `data_date DESC, id DESC`; limit 1 | Exact route exposed approved metadata only and stated that no verified source link was available |
| 5 | `Show the last five alerts` -> five rows dated 2026-03-31 with types Update, Exception/anomaly, Delay, Update, and Alert/warning in stable order | `lookup_last_n`; dated rows only; `data_date DESC, id DESC`; limit 5 | Exact route returned exactly five safe metadata projections and no links |
| 6 | `How many alerts were there from 2023-10-01 to 2026-03-31?` -> 1,673 | `count`; `data_date >= 2023-10-01` and `< 2026-04-01` | Exact route confirmed an inclusive final UTC calendar day; the three null-date rows were excluded |
| 7 | `How many alerts have stored relevance flag false?` -> 0 | `count` with stored `relevance = false` | Exact route described a stored flag, not a fresh relevance judgment |
| 8 | `How many alerts have severity level 4?` -> not computable | deliberate `not_computable`; no table fetch | The policy rejected an unapproved severity value rather than inventing a mapping or zero |
| 9 | Hebrew total-count wording -> 1,676 | Same total-count contract as case 1 | Hebrew exact routing matched the English result |
| 10 | Hebrew last-five wording -> the same five rows in the same order as case 5 | Same dated lookup, order, and limit | Hebrew labels preserved the same safe fields and unavailable-link boundary |
| 11 | `Why did this alert fire?` -> no specific alert was identified; only general semantic evidence was discussed | no Data Query plan; causality and evidence are outside the typed policy | Hybrid Search, graph search, reranker, and Main ran; no Data Query node supplied an exact alert claim |
| 12 | `How many delay alerts are there, and why did they fire?` -> exact stored-type count 142 plus an explicit no-attached-semantic-evidence boundary | `count` with the approved stored Delay type | Data Query was the only project-data tool and sole source of the final exact fact; Hybrid Search, graph search, reranker, Alert Agent, and Main were skipped. Knowledge Planner activity supplied no project evidence |
| 13 | `How many alerts are unresolved?` -> not computable because no approved lifecycle mapping exists | deliberate `not_computable`; no table fetch | The answer did not substitute stored `item_status = Being handled` for unresolved |

### Supplemental user-reported Hebrew mixed lookup correction

After the planned 13-case closeout, the user tested
`מה ההתראה האחרונה שעלתה ולמה היא עלתה?`. The first run safely failed closed as
`alert_unapproved_lookup_not_computable`: the parser recognized an alert
`lookup_latest` candidate but treated the natural Hebrew wording as an
unapproved qualifier. This was a bilingual mixed-lookup usability gap, not an
incorrect source result or an unsafe fallback.

The correction approves that complete Hebrew sentence through one anchored
positive grammar. It does not generally strip text following `ולמה` and does
not widen the typed filter vocabulary. The corrected plan has no user-derived
filter, orders dated rows by `data_date DESC, id DESC`, excludes `created_at`
and narrative fields, and preserves the same authorization/evidence boundary as
other mixed alert requests. Regression cases that add Slack, a project, or a
person before or after `ולמה` still fail closed. Explicit ingestion-time or
`created_at` wording remains `alert_ingestion_time_not_computable`.

The supplemental authenticated UI rerun passed against the restarted current
server. It returned the latest dated alert on 2026-03-31 with stored type Update,
opaque severity level 3, Email input, stored item status Being handled, stored
relevance true, no verified source link, and a Hebrew `גבול ראיות` statement
instead of attaching an unscoped causal narrative. Hybrid Search, graph search,
and reranking were skipped; Data Query completed; Alert Agent and Main were not
used for project evidence or final synthesis. Knowledge Planner ran before exact
route detection but supplied no project evidence. The run completed in 18.49
seconds with 4,715 total tokens.

Post-correction verification is 9/9 Phase 4C groups and 89/89 protected Data
Query tests. Answer-level regression fixtures prove that row/project/source IDs,
URLs, narrative fields, and unrelated Alert Agent content remain absent. The
supplemental UI run created only ordinary chat/run-history rows and made no
Content, database-object, authorization, setting, or saved-selection mutation.

The first date-range wording, `How many alerts were recorded from 2023-10-01
through 2026-03-31?`, failed closed under the intentionally narrow positive
grammar and performed no exact count. The approved `from ... to ...` wording in
case 6 then passed. This is a nonblocking wording limitation, not evidence of an
incorrect count or an unsafe fallback.

The pure semantic run completed on the retrieval/Main branch but remained
expensive at about 92.79 seconds and 193,990 total tokens. The mixed run also
incurred Knowledge Planner overhead before the exact bypass. These observations
remain inputs to the comprehensive semantic and performance regression after the
remaining Data Query table work; they do not change the Phase 4C correctness
decision.

Expanded exact/mixed answers and the available client workflow/debug projections
showed no alert row or project identifiers, UUIDs, source URLs, filenames,
narratives, Data Query plan/request/caller identifiers, or raw provider errors.
Exact and mixed answers preserved `links: []`. The Workflow screen still showed
ordinary framework run metadata and node status; that operational telemetry is
distinct from alert-record content or private Data Query request details.

Authenticated verification created only ordinary application chat and
run-history rows through the existing workflow. It did not add, edit, or delete
Content `alerts` data, database objects, permissions, RLS, Supabase/Auth settings,
or saved table selections.

## Stop point

Phase 4C is complete through read-only audit, typed policy, implementation,
automated regression, authenticated UI verification, and documentation
reconciliation. Phase 4D and all later phases remain untouched and require a
separate approval checkpoint before any audit or implementation begins.
