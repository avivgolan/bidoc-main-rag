# Data Query Agent - remaining table promotion roadmap

Formalized: 2026-07-26

Status: planning baseline approved. Phase 4C, Phase 4D, Phase 4E, and Phase 4F
are complete through their `.3` authenticated UI and documentation closeouts. Phase 4D passed
all 17 planned UI cases under the audited local single-project boundary. Phase
4E passed its live read-only audit, typed implementation, 6/6 focused groups,
106/106 protected Data Query tests, and authenticated email UI matrix. Phase 4F
passed its live read-only audit, 7/7 focused groups, 114/114 protected tests, and
authenticated exact/lookup/mixed/fail-closed UI closeout. The
requested pre-4C critical semantic smoke check passed; broader semantic-quality
regression remains scheduled after the remaining Data Query Agent work is
complete.

## Purpose and authority

This document assigns the remaining reviewed Content-table candidates to explicit
phases and gives every table the same three approval checkpoints:

1. `X.1` - read-only source audit and typed business policy;
2. `X.2` - implementation and automated regression verification;
3. `X.3` - authenticated UI verification, documentation, and closeout.

It refines the candidate order in
`docs/data-query-agent-phase4a-capability-map.md`. The Phase 4A and Phase 4B
closeout documents remain the source of truth for already implemented behavior.
This roadmap records checkpoint state but does not itself activate a table or
claim that a queued capability is currently available.

## Protected baseline

- The canonical runtime remains Content-only typed `data-query.v2`; it does not
  execute raw SQL or build generic joins.
- `data_index`, `financial_transactions`, `safety_reports`, `alerts`, `meetings`,
  `emails`, and `exceptions_report` are closed reviewed exact-capability tables.
- Existing financial, safety, alert, and meeting behavior and all focused
  regressions are protected baselines for every later phase.
- Structured read-only inspection is allowed. No phase in this roadmap authorizes
  an insert, update, delete, normalization, migration, RPC, function, schema,
  table, column, index, role, grant, permission, RLS policy, Supabase setting, or
  saved table-selection change.
- Any database-object or authorization remediation requires a separate explicit
  approval and must not be inferred from approval of a table-promotion phase.
- Existing dirty-worktree changes must be preserved. Each phase edits only its
  approved table slice and shared code required by that slice.

## Formal phase sequence

| Phase | Target | Current gate |
|---|---|---|
| 4C | `public.alerts` | Complete through 4C.3 closeout |
| 4D | `public.meetings` plus Meeting Evidence handoff | Complete through 4D.3 closeout |
| 4E | `public.emails` | Complete through 4E.3 closeout |
| 4F | `public.exceptions_report` | Complete through 4F.3 closeout |
| 4G | `public.whatsapp_analysis` | Next unauthorized approval gate; temporal/task relations remain blocked |
| 4H | `public.consultants_reports` | Data-readiness gate; zero rows in the last audit |
| 4I | `public.daily_work_log` | Data-readiness gate; zero rows in the last audit |
| 4J | `public.gantt_tasks` | Data-readiness gate; zero rows in the last audit |
| 4K | `public.quality_control` | Data-readiness gate; zero rows in the last audit |

The sequence is the default. Reordering or skipping a phase requires an explicit
user decision and a roadmap update. Completing one `.3` checkpoint does not
authorize the next `.1` checkpoint automatically.

## Pre-Phase 4C critical semantic smoke check

The 2026-07-26 checkpoint is recorded in
`docs/data-query-agent-pre4c-semantic-regression.md`.

- 21/21 focused automated semantic-routing checks passed.
- Four authenticated broad semantic questions did not execute Data Query or
  bypass retrieval; Hybrid Search, graph search, reranking, and Main remained
  active. One safety question included a preliminary Data Query classifier hint,
  but no Data Query workflow node, execution event, or tool result followed.
- Main finished `stop` in all four runs without `MAX_TOKENS`.
- No critical route theft, retrieval bypass, empty answer, or Main truncation was
  observed, so the requested smoke check passed.
- Knowledge Planner fallback and citation-grounding problems were also observed.
  They are retained as baseline targets for the final comprehensive semantic
  regression, not treated as Phase 4C blockers.

This is not evidence that Data Query caused the semantic quality defects; the
defects occurred on the already-isolated semantic branch. The point-in-time smoke
sample is also not exhaustive semantic certification. At that checkpoint,
Phase 4C.1 was still the next gate; it subsequently completed on 2026-07-26
without changing runtime behavior.

## Final comprehensive semantic regression

After the last approved Data Query table phase is complete, run a representative
matrix across all supported semantic families and exact/semantic interactions.
The final matrix must cover bilingual routing, claim-level citations, Knowledge
Planner repair/fallback, Meeting Evidence, cross-domain synthesis, conflicts,
context size, latency, answer completeness, and every protected semantic
question retained by the per-phase reports. This final regression is a separate
approval-gated checkpoint and does not authorize semantic remediation by itself.

## Common checkpoint contract

### `X.1` - read-only audit and typed policy

Every `X.1` checkpoint must:

1. inspect the current repository route, policy, retrieval, prompt, workflow, and
   test surfaces for the target table;
2. use fixed read-only requests to confirm the live table name, connection,
   stable ID, project-scope field, canonical dates, field types, row count, null
   coverage, duplicates, tied dates, real vocabularies, and value drift;
3. identify content, PII, credentials, filenames, URLs, raw IDs, and other fields
   that must remain outside the quantitative plan and telemetry;
4. prove or reject every proposed aggregate, derived value, status meaning,
   canonical mapping, relationship, and document-link path;
5. classify question families as Data Query-only, Data Query plus retrieval, or
   semantic/retrieval-only;
6. mark ambiguous metrics `not_computable` instead of guessing;
7. separate current live evidence from historical snapshots, mocks, and synthetic
   fixtures;
8. write a dedicated phase audit/acceptance document before implementation; and
9. stop if a missing business definition materially changes correctness.

The `.1` closeout must list the exact approved fields, operations, filters,
ordering, limits, normalization rules, unsupported questions, security boundary,
and proposed `.2` tests. It must also state whether `.2` is safe under the still
deferred security findings or requires a separate security decision first.

### `X.2` - implementation and automated verification

Every `X.2` checkpoint must:

1. register one explicit table-specific metadata policy;
2. hardcode the Content table and approved projection;
3. allow only validated `GET`/`HEAD` requests with no request body, arbitrary
   method, raw SQL, generic join, arbitrary path, schema override, or mutation;
4. require the dedicated Data Query credential and fail closed on missing,
   invalid, or expired credentials;
5. enforce caller project/date scope, inclusive end-date semantics, bounded
   limits, deterministic date-plus-stable-ID ordering, timeouts, and fail closure;
6. reject unknown tables, fields, aliases, operations, filters, orderings, and
   limits before network execution;
7. return exact structured facts through `machineResult` and render exact-only
   answers deterministically;
8. preserve semantic precedence and keep retrieval evidence from replacing or
   changing exact facts;
9. resolve links only through a proven exact, authorization-bound relationship;
   otherwise display that no verified link is available;
10. retain only redacted aggregate workflow telemetry: approved table,
    operations, fields, result counts, execution/result statuses, exactness, and
    presence flags; and
11. add table-specific tests while preserving every earlier Data Query regression.

Minimum automated coverage for every promoted table:

- English and Hebrew routing;
- zero-row and one-row results;
- approved counts, groups, time series, aggregates, and bounded lookups;
- inclusive dates, null dates, tied dates, and stable-ID ordering;
- canonical vocabulary mappings and unmapped-value fail closure;
- project-scope enforcement and cross-project negative fixtures;
- semantic precedence and mixed exact-plus-retrieval postconditions;
- invalid field, filter, operation, order, limit, alias, and renamed-table
  rejection before fetch;
- missing/invalid credentials, `GET`/`HEAD` only, no request body, bounded
  execution, timeout, row-cap, and provider failure behavior;
- Unicode filters, timezone boundaries, and validation-before-network behavior;
- telemetry and visible-answer redaction;
- safe-link success and ambiguous/mismatched/unsafe/unscoped fail closure when
  links are supported;
- all earlier `data_index`, financial, invoice, and safety regressions.

Verification commands must include JavaScript syntax checks for every changed
file, a phase-specific filter, the complete focused Data Query suite, the full
repository suite, relevant build checks, and `git diff --check`. Independent
read-only correctness and security reviews should be used when available. The
handoff must report exact counts and separate unrelated baseline failures from
changed-area failures.

### `X.3` - authenticated UI verification and closeout

Every `X.3` checkpoint must:

1. restart or otherwise prove that the local server uses the newly edited code
   and has required network access;
2. use a fresh authenticated chat and retain the final verified conversation;
3. exercise English and Hebrew exact questions, date scope, grouping, latest,
   last-N, zero/unavailable behavior, one semantic question, and one mixed
   exact-plus-retrieval question;
4. inspect each run trace for the selected route, Data Query operation, filters,
   order, limit, scope, retrieval tools, Main usage or bypass, and redacted
   telemetry;
5. compare every exact result with a read-only view of the approved source table;
6. verify deterministic ordering, canonicalization, `not_computable` wording,
   conflict warnings, link labels, and absence of raw identifiers or URLs; and
7. update the phase document, capability roadmap, current-state audit, and Bedrock
   project memory before closing.

If a UI result is wrong, the correction remains limited to the current table
slice. The affected automated checks and UI questions must be rerun. The phase
then stops for review.

## Cross-cutting security and release gate

The deferred security register remains authoritative. In particular:

- SEC-001 records that the managed token has broader native raw-table privileges
  than the typed application contract;
- SEC-002 records that reviewed authenticated policies are not bound to project or
  team membership;
- other findings cover exposed backup tables, privileged functions, mutable
  `search_path`, Auth settings, and future Data API grant behavior.

These findings do not prevent a read-only `.1` audit. They do prevent any claim
that an agent-code allowlist is database least privilege or that caller-supplied
project scope proves authorization. Before each `.2`, the phase handoff must make
the security decision explicit. Before production or multi-project activation,
authorization-bound caller membership and negative cross-project proof are a
release gate unless the user explicitly accepts a narrower documented risk.

No phase may expose or record service keys, passwords, access/refresh tokens, raw
provider errors, live/production project UUIDs, record IDs, attachment IDs,
filenames, URLs, email addresses, names, or source content in committed fixtures,
logs, workflow history, or screenshots. Clearly synthetic identifiers remain
allowed in deterministic fixtures when they cannot identify real records or
people.

## Phase 4C - `alerts`

Current status: complete through Phase 4C.3. The live audit, implemented typed
policy, automated evidence, 13/13 authenticated UI matrix, and closeout decision
are recorded in `docs/data-query-agent-phase4c-alerts.md`.

Historical snapshot, revalidated in 4C.1: 1,676 rows; `data_date` populated in
1,673; type, severity, and relevance populated in all rows; `status` empty in all
rows; the observed severity value was only `3`.

### Phase 4C.1 - alert source audit and typed policy

Audit and decide:

- stable ID, project scope, canonical alert date, null dates, duplicate/tied dates,
  and deterministic ordering;
- authoritative state: `item_status`, empty `status`, or neither;
- real severity vocabulary, ordering, translations, and whether any stored value
  truthfully means "critical";
- type, relevance, input-type, and other candidate grouping vocabularies;
- exact-table identity `public.alerts`, independent of the configurable Alert
  Agent embeddings table and `match_alerts` retrieval RPC;
- whether an exact source/document relationship exists and is authorization-bound;
- which fields are metadata versus alert narrative/evidence; and
- whether every proposed filter and group remains meaningful with the live value
  distribution.

Candidate exact capabilities, subject to the audit: total count; counts by date,
type, canonical severity, approved state, relevance, or input type; alert-count
time series; and bounded latest/earliest/last-N alert metadata.

Semantic boundary: why an alert fired, whether it is valid, evidence, root cause,
responsibility, and recommended action remain Alert Agent, retrieval, or delay
analysis responsibilities.

### Phase 4C.2 - alert implementation and tests

Implemented only the fields and vocabularies approved in 4C.1. Exact alert plans
use the fixed source table and never treat the embeddings table or semantic RPC
as an exact source. Mixed requests preserve the Data Query fact and add an
explicit evidence boundary; they do not run unscoped Alert Agent retrieval until
an authorization-bound same-record resolver exists. Unsupported critical or
open-state terminology returns `not_computable` rather than mapping by guess.

The common test matrix and alert-specific coverage include severity/state drift,
all-null `status`, nullable `data_date`, exact-source versus embeddings separation,
semantic "why did it fire?" route-away behavior, whole-clause qualifier
rejection, model-hint isolation, client-output redaction, and explicit UTC
calendar bucketing. The final protected Data Query suite is 89/89.

### Phase 4C.3 - alert UI closeout

Completed 13/13 authenticated checks covering total, severity grouping, approved
stored state grouping, latest, last five, an inclusive live date range, stored
relevance zero, unsupported severity, two Hebrew exact cases, a semantic alert
explanation, a mixed exact-count plus explanation request, and an unsupported
lifecycle count. The matrix proved that severity is not relabeled as "critical,"
empty `status` is not presented as open/closed, pure semantics remain on
retrieval/Main, and mixed output retains the exact fact without attaching
unscoped alert evidence. The detailed results and wording limitation are in the
dedicated Phase 4C tracker.

A supplemental user-reported Hebrew `latest alert + why` sentence initially
failed closed. Phase 4C was reopened only for that wording, corrected with an
anchored full-sentence grammar, and reclosed after focused regression and one
authenticated UI pass. The corrected answer returns safe latest metadata plus a
Hebrew evidence boundary; project/source/person suffixes remain fail-closed.

## Phase 4D - `meetings` plus Meeting Evidence

Current status: complete through Phase 4D.3. The live audit, fixed metadata
policy, temporary RPC-first evidence compatibility path, 10/10 filtered tests,
99/99 protected Data Query tests, and 17/17 authenticated UI cases are recorded
in `docs/data-query-agent-phase4d-meetings.md`.

### Phase 4D.1 - meeting metadata audit and handoff policy

The read-only audit reconciled 151 positive, uniquely identified rows in one
project. Canonical `meeting_date` spans 2024-11-13 through 2025-01-28. All nine
distinct timestamps contain ties, with a maximum tie of 48, so every lookup uses
date plus stable ID. The six stored `status` values are opaque exact categories.
`item_status`, subject, decisions, attendance, source locators, and lifecycle
interpretations are excluded; decision presence and participant counts are
explicitly `not_computable`.

The audit also proved a sparse same-project relationship from meeting ID to
`meetings_documents.source_id`, with attachment equality required. The semantic
identity sees 36 chunks across 11 meetings; 140 meetings have no chunks. The
managed Data Query identity sees no evidence rows. Eighteen evidence dates differ
from the authoritative meeting date, so `primary_date` cannot establish identity.

### Phase 4D.2 - meeting implementation and tests

The fixed credential-gated `public.meetings` adapter supports exact counts,
approved stored-status/date groupings and series, distinct stored statuses, and
bounded latest/earliest/last-N date/status metadata. It emits only validated
bodyless `HEAD`/`GET` requests. Pure semantic questions use Meeting Evidence
only; the approved mixed latest-plus-decision route executes Data Query first and
then requires the exact source/project/attachment relationship.

The deployed semantic RPC currently fails its read-only health probe because it
references an absent meeting-key column. No database repair was authorized. A
temporary RPC-first application fallback is limited to structural 400/404
responses and one fixed bodyless evidence read capped at 500 rows. It validates
project/source/attachment/chunk/vector shape, accepts an unscoped local result
only when it contains one project, performs no adjacency expansion, and exposes
no raw identifiers, filenames, URLs, embeddings, scores, or provider errors.

Automated evidence is 10/10 Phase 4D groups and 99/99 protected Data Query tests.
The full suite is 344/355 with only the same 11 unrelated UI/static-contract
failures. React build verification remains unavailable because the local Vite
executable is absent.

### Phase 4D.3 - meeting UI closeout

All 17 authenticated cases passed. Exact English/Hebrew metrics and lookups used
Data Query only; attendee and decision-presence counts failed closed. Pure
semantic cases used Meeting Evidence only and preserved the no-specific-evidence
boundary with authorized dated citations. Mixed English/Hebrew cases selected
the exact 2025-01-28 latest meeting and its opaque stored status before the
same-meeting evidence call, preserved exact metadata, and reported no false
conflict. The Hebrew case passed in a fresh isolated rerun after a planner fix.

No project scope was configured in the localhost UI. Acceptance is limited to
the audited single-project shape; production or multi-project use remains
blocked on authenticated membership/RLS and explicit scope. UI verification
created only ordinary app chat/run-history records. No Content data, database
object, authorization setting, or saved selection changed.

## Phase 4E - `emails`

Historical snapshot, to be revalidated in 4E.1: 7,163 rows with received date,
direction, attachment state, and relevance populated; category populated in 786;
the earlier index comparison identified 786 project-related rows.

### Phase 4E.1 - email relevance and PII policy

Audit and decide:

- stable ID, project scope, canonical received date, tie ordering, and nulls;
- the authoritative project-related/relevance predicate and whether "all emails"
  means all source rows or only project-related rows;
- reviewed category, direction, attachment-state, and item-status vocabularies;
- which bounded display fields are allowed without exposing sender/recipient names
  or addresses;
- exact attachment/document relationships and authorization scope; and
- the rule that `received_date` is message receipt time, not the date of an event
  described in the body.

Candidate exact capabilities: project-related total; counts by received date,
approved category, direction, attachment state, relevance, or approved item
status; distinct reviewed categories; date time series; and bounded
latest/earliest/last-N metadata.

Email body, summary, request, approval, rejection, intent, quotations, event
meaning, and unapproved person/vendor identity remain retrieval-only.

### Phase 4E.2 - email implementation and tests

Implement only the reviewed project-relevance and PII-safe metadata projection.
Every ambiguous unqualified count must follow the documented 4E.1 default and
state that scope in the machine result and answer. PII filters or display values
remain unsupported unless explicitly approved with redaction rules.

Add the common test matrix plus relevance-scope ambiguity, received-date/event-date
separation, PII exclusion, attachment ambiguity, category sparsity, and semantic
email-content route-away coverage.

### Phase 4E.3 - email UI closeout

The authenticated matrix must cover scoped total, relevance/category/direction
groups, latest, last five, date range, attachments, a zero/unknown category case,
one Hebrew exact pair, a semantic "what did it request?" question, and a mixed
count-plus-content question. It must show the selected email scope and expose no
unapproved names, addresses, raw IDs, or URLs.

Current status: complete through Phase 4E.3 on 2026-07-27. The authenticated UI
verified the 786-row project-related scope, all approved group dimensions,
attachment existence, bounded lookups, inclusive and empty date ranges, English
and Hebrew exact questions, semantic content routing, mixed exact-plus-semantic
behavior, and exact-answer redaction. Direction reconciled to 620 inbound and
166 outbound; attachment state reconciled to 504 false and 282 true. Semantic
latest-content answers now carry a deterministic warning that relevance-ranked
retrieval is not an exact same-record latest join. Phase 4E changed no Content
data, schema, database object, permission, RLS policy, Supabase setting, or saved
selection.

The 4E.3 gate was briefly reopened on 2026-07-27 for two user-discovered Hebrew
grammar gaps: `כמה מיילים יש במערכת?` and `מה המייל האחרון שמופיע?`. Both now
use the deterministic exact route, passed authenticated UI reruns, and are
protected by route-and-plan regressions. Phase 4E is closed again without
widening the approved metadata or privacy boundary.

## Phase 4F - `exceptions_report`

Historical snapshot, revalidated in 4F.1: 20 rows; date populated in 14,
exception number in 15, requested amount in 12, urgency in all 20, and
`execution_days` in only one row.

### Phase 4F.1 - exception data-quality and metric policy

Audit and decide:

- stable ID, project scope, canonical date, null-date semantics, tie ordering, and
  exception-number identity;
- urgency, item-status, inspector, and company vocabularies and their PII/business
  sensitivity;
- whether requested amounts have a typed numeric representation, currency, and
  additive business meaning;
- whether missing amounts are excluded, zero, or make an aggregate
  `not_computable`;
- whether any execution-day metric is meaningful with current coverage; and
- exact source/document relationships and semantic report boundaries.

Candidate exact capabilities: total count; counts by date, canonical urgency,
approved inspector/company category, or approved item status; and bounded
latest/earliest/last-N metadata. Requested-amount and execution-day aggregates are
disabled until the audit proves their types and null semantics.

### Phase 4F.2 - exception implementation and tests

Implement the fixed source-table contract with explicit missing-data provenance.
An aggregate may be enabled only when 4F.1 defines numeric validation, currency,
row inclusion, and empty-set behavior. Narrative explanations and evidence remain
retrieval-routed.

Add the common test matrix plus sparse date/number/amount coverage, invalid amount,
mixed currency if present, missing-value semantics, single-value execution-days,
PII redaction, and exact-plus-report-evidence coverage.

### Phase 4F.3 - exception UI closeout

The authenticated matrix must cover total, urgency/status grouping, latest, last
five, an incomplete-date range, missing-value wording, any approved amount metric
or deliberate `not_computable`, one Hebrew exact pair, a semantic explanation,
and a mixed exact-plus-evidence question.

Current status: complete through Phase 4F.3 on 2026-07-28. The final policy
enables total/dated/undated counts, one-field stored urgency or item-status
groups, day/month exception-date series, and dated latest/earliest/last-N safe
metadata. Exception number, identities, companies, amounts, execution days,
subject/content, links, and lifecycle interpretations remain excluded or
`not_computable`. The mixed latest-exception family runs Data Query first and
then requires exact exception/project/attachment attestation before same-record
semantic evidence. Verification is 7/7 Phase 4F groups and 114/114 protected
Data Query tests; authenticated UI returned 20 total rows, latest date
09.03.2025, safe same-record insufficient-evidence wording, and deliberate
amount fail-closure. Full evidence is in
`docs/data-query-agent-phase4f-exceptions.md`. No Content/database/settings
mutation occurred.

## Phase 4G - `whatsapp_analysis`

Historical snapshot, to be revalidated in 4G.1: 525 analysis rows with conversation
identity and JSON analysis fields; no native domain date on the table.

### Phase 4G.1 - conversation identity, JSON, and relation policy

Audit and decide:

- stable row identity, project scope, conversation identity, duplicate analyses,
  and approved item-status vocabulary;
- whether row count, distinct conversation count, or both represent the requested
  business concept;
- which JSON fields contain content, people, tasks, decisions, or other PII and
  must remain outside quantitative plans;
- whether an existing fixed project-scoped relationship supplies a trustworthy
  conversation date without a generic join;
- whether task/open/closed state has an authoritative typed representation; and
- whether a limited non-temporal promotion has enough user value if the relation
  and task semantics remain unavailable.

Candidate direct capabilities: explicit analysis-row count, distinct conversation
count if identity is proven, approved item-status counts, and a bounded
conversation-identity lookup with non-sensitive display fields. Latest/date time
series and task/decision/deadline/responsible-person counts remain
`not_computable` until a declared relation and business-state model are approved.

Any new view, RPC, materialized relation, schema change, or stored normalization is
outside this roadmap and requires separate database approval.

### Phase 4G.2 - WhatsApp implementation and tests

Implement only the limited operations approved in 4G.1. JSON text, participants,
task descriptions, decisions, and chat meaning remain retrieval-only. The current
text-regex "open task" behavior cannot become an exact Data Query metric.

Add the common test matrix plus row-versus-conversation count distinction,
duplicate analysis rows, JSON/PII exclusion, missing native date, forbidden
temporal/task planning, and fixed-relation rejection before fetch.

### Phase 4G.3 - WhatsApp UI closeout

The authenticated matrix must cover row and conversation counts as separately
defined, approved status grouping, bounded metadata lookup, unavailable temporal
and task questions, one Hebrew exact pair, a semantic chat question, and a mixed
question that preserves the exact count without exposing JSON content or people.

## Shared zero-row readiness rule for Phases 4H-4K

The 2026-07-24 audit found no live rows in these four source tables. Synthetic
fixtures can verify validator mechanics, but they cannot prove live vocabulary,
business semantics, null behavior, relationships, or production correctness.

For each `.1`, start with a fixed read-only row count and schema audit. If the
table still lacks representative rows, record field hypotheses as unverified,
optionally prepare clearly labeled synthetic fixtures, mark production semantics
blocked, and stop. Do not infer canonical dates, statuses, identities, aggregates,
or relationships from column names. No `.2` starts until representative data and
approved business definitions exist.

## Phase 4H - `consultants_reports`

Dedicated tracker: `docs/data-query-agent-phase4h-consultants-reports.md`.

### Phase 4H.1 - consultant-report readiness audit and typed policy

Apply the shared zero-row rule and the full common `.1` contract specifically to
`public.consultants_reports`. When representative data exists, define its own
exact/mixed/semantic matrix from audited values. No operation is pre-authorized.

### Phase 4H.2 - consultant-report implementation and tests

If 4H.1 closes, promote only `consultants_reports` through the common `.2`
contract. Other zero-row candidates remain dormant.

### Phase 4H.3 - consultant-report UI closeout

Run a table-specific authenticated matrix derived from 4H.1, update its tracker,
and stop. Success does not activate Phase 4I.

## Phase 4I - `daily_work_log`

Dedicated tracker: `docs/data-query-agent-phase4i-daily-work-log.md`.

### Phase 4I.1 - daily-work-log readiness audit and typed policy

Apply the shared zero-row rule and the full common `.1` contract specifically to
`public.daily_work_log`. When representative data exists, define its own
exact/mixed/semantic matrix from audited values. No operation is pre-authorized.

### Phase 4I.2 - daily-work-log implementation and tests

If 4I.1 closes, promote only `daily_work_log` through the common `.2` contract.
Other zero-row candidates remain dormant.

### Phase 4I.3 - daily-work-log UI closeout

Run a table-specific authenticated matrix derived from 4I.1, update its tracker,
and stop. Success does not activate Phase 4J.

## Phase 4J - `gantt_tasks`

Dedicated tracker: `docs/data-query-agent-phase4j-gantt-tasks.md`.

### Phase 4J.1 - Gantt-task readiness audit and typed policy

Apply the shared zero-row rule and the full common `.1` contract specifically to
`public.gantt_tasks`. When representative data exists, define its own
exact/mixed/semantic matrix from audited values. No operation is pre-authorized.

### Phase 4J.2 - Gantt-task implementation and tests

If 4J.1 closes, promote only `gantt_tasks` through the common `.2` contract. Other
zero-row candidates remain dormant.

### Phase 4J.3 - Gantt-task UI closeout

Run a table-specific authenticated matrix derived from 4J.1, update its tracker,
and stop. Success does not activate Phase 4K.

## Phase 4K - `quality_control`

Dedicated tracker: `docs/data-query-agent-phase4k-quality-control.md`.

### Phase 4K.1 - quality-control readiness audit and typed policy

Apply the shared zero-row rule and the full common `.1` contract specifically to
`public.quality_control`. When representative data exists, define its own
exact/mixed/semantic matrix from audited values. No operation is pre-authorized.

### Phase 4K.2 - quality-control implementation and tests

If 4K.1 closes, promote only `quality_control` through the common `.2` contract.
Every table outside its approved policy remains dormant.

### Phase 4K.3 - quality-control UI closeout

Run a table-specific authenticated matrix derived from 4K.1, update its tracker,
and stop. No additional table phase is implied.

## Explicitly excluded or separately routed tables

The following dispositions are formal and do not receive ordinary phases in this
promotion sequence:

- `other_documents`: retrieval source; empty structured `document_type` in the
  historical snapshot. A future business case requires a new explicit roadmap
  decision.
- `key_personnel_contacts`: PII directory, not an approved quantitative target.
- `*_documents` chunk tables: retrieval/evidence sources, not direct business
  analytics contracts.
- backup tables: never Data Query sources.
- chat, settings, queue, run-history, and other application-internal tables: out
  of Content analytics scope.
- graph and timeline tables: relationship infrastructure. Any future use requires
  a separately approved bounded relationship phase, never generic joins.
- embedding tables and semantic `match_*` RPCs: retrieval infrastructure; they do
  not replace exact source tables.

## Documentation and naming contract

Each phase creates one dedicated Markdown tracker before implementation:

- `docs/data-query-agent-phase4c-alerts.md`;
- `docs/data-query-agent-phase4d-meetings.md`;
- `docs/data-query-agent-phase4e-emails.md`;
- `docs/data-query-agent-phase4f-exceptions-report.md`;
- `docs/data-query-agent-phase4g-whatsapp-analysis.md`;
- the 4H-4K files listed above.

Each tracker must retain the `.1` audit, `.2` implementation evidence, `.3` UI
matrix, exact commands/results, live-versus-synthetic distinction, database
immutability confirmation, deferred risks, and next approval gate. The capability
map and current-state audit receive concise status updates; detailed evidence stays
in the dedicated tracker.

## Current checkpoint

This roadmap formalizes Phases 4C-4K. Phase 4C, Phase 4D, Phase 4E, and Phase 4F
are complete through their authenticated UI and documentation closeouts. Phase 4D added only the
fixed meetings metadata contract and bounded Meeting Evidence handoff; it made
no database object, Content-data, permission, RLS, Supabase-setting, or
saved-selection mutation. Phase 4E added only its fixed, relevance-scoped,
PII-safe email metadata contract without such a mutation. Phase 4F added only
the fixed exception metadata contract and exact same-record evidence handoff.
Phase 4G remains the next unauthorized approval gate. Comprehensive
semantic testing remains scheduled after the remaining Data Query Agent work is
complete.
