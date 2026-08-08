# Data Query Agent Phase 4D - meetings metadata and Meeting Evidence handoff

Date: 2026-07-26

Audit source: live Content database, read only

Audit script: `scripts/audit-phase4d-meetings.mjs`

## Status

- Phase 4D.1 source-of-truth audit and typed policy: **complete**.
- Phase 4D.2 implementation and automated verification: **complete**.
- Phase 4D.3 authenticated UI verification and documentation closeout:
  **complete; all 17 planned cases passed**.
- Phase 4E and all later table promotions remain untouched.

Phase 4D promotes fixed `public.meetings` metadata under the bounded policy
below. It does not approve Data Query access to meeting content, decisions,
attendance data, attachments, filenames, or evidence chunks. Pure semantic
questions use Meeting Evidence only. A mixed answer may use that connection
only after a sequential exact-identity handoff from Data Query. Phase 4D is
closed locally under the audited single-project boundary; production or
multi-project activation remains blocked pending authorization-bound project
membership and negative cross-project proof.

## Phase 4D.1 source-of-truth audit

### Audit method and evidence boundary

The audit used `scripts/audit-phase4d-meetings.mjs` with fixed, paginated,
bodyless `GET` requests and exact `Content-Range` reconciliation. It inspected:

1. `public.meetings` through the managed Data Query read identity;
2. `public.meetings_documents` through the same managed identity; and
3. `public.meetings_documents` through the existing read-only semantic
   connection used by Meeting Evidence.

The script ordered pages by stable `id`, required the reported total to remain
unchanged across pages, and rejected an incomplete read. Its output contained
aggregate counts and relationship attestations only. It did not print secrets,
project values, meeting IDs, attachment IDs, filenames, names, decisions,
attendance text, or document content.

This is current live evidence, not a fixture or historical snapshot. The prior
151-row snapshot was revalidated.

### Exact source identity and scope

| Property | Live result | Phase 4D.1 decision |
|---|---:|---|
| Exact table | `public.meetings` | Fixed; no configurable table alias or semantic table may replace it |
| Rows | 151 | Exact live total |
| `id` populated | 151 | Internal stable identity |
| `id` unique | 151 | Approved deterministic tie-breaker |
| Positive integer `id` | 151 | Validated before execution results are accepted |
| `project_id` populated | 151 | Required internal scope field |
| Distinct projects | 1 | Current live environment is single-project; this is not proof of caller authorization |

`id` and `project_id` are authorization/identity fields. They may be used
internally for validation, ordering, scoping, and the exact evidence handoff,
but must not appear in deterministic answers, workflow telemetry, client tool
projections, screenshots, or committed fixtures.

### Canonical meeting date and deterministic ordering

`meeting_date` is the only approved business date for exact meeting analytics
and lookups.

| Property | Live result |
|---|---:|
| Populated dates | 151 |
| Null dates | 0 |
| Invalid dates | 0 |
| Minimum date | 2024-11-13 |
| Maximum date | 2025-01-28 |
| Distinct timestamps | 9 |
| Timestamp groups containing ties | 9 |
| Largest tie | 48 rows |

Every observed date is tied, so date-only ordering is not deterministic. The
mandatory lookup order is:

- latest and last-N: `meeting_date DESC, id DESC`;
- earliest: `meeting_date ASC, id ASC`.

Date filters use `meeting_date`. An inclusive user end date is compiled as an
exclusive next-calendar-day upper bound. UTC day/month bucketing must be
explicit. `created_at`, evidence `primary_date`, filenames, and ingestion order
must never replace `meeting_date`.

### Reviewed stored status vocabulary

`status` is populated in all 151 rows and is approved only as an opaque stored
meeting status.

| Stored `status` value | Count |
|---|---:|
| `בביצוע` | 69 |
| `בוצע` | 12 |
| `בטיפול` | 42 |
| `לביצוע` | 10 |
| `לידיעה` | 16 |
| `מתעכב` | 2 |
| **Total** | **151** |

The values may be counted, grouped, listed distinctly, or filtered only by the
exact approved stored vocabulary. Phase 4D does not infer that any value means
open, closed, resolved, unresolved, active, approved, overdue, or completed in a
separate business lifecycle. English display must label the raw value as a
stored meeting status rather than inventing a translation with lifecycle
semantics.

`item_status` is populated only with `בטיפול`. It is excluded because its
business relationship to `status` is not defined and substituting it would
collapse the reviewed six-value status vocabulary.

Unknown or changed stored status values are vocabulary drift and must fail
closed rather than being merged, translated, or silently omitted.

### Content, personal data, and internal fields

| Field or family | Live evidence | Decision |
|---|---|---|
| `subject` | 151 populated; 134 distinct; maximum length 31 | Excluded free text; may contain personal or semantic content |
| `decisions_made` | 151 populated text rows | Excluded semantic evidence; decision presence is `not_computable` |
| `attendances` | 151 populated text rows | Excluded personal data |
| `attachment_id` | 151 populated | Internal relationship attestation only |
| `mail_id` | 151 populated | Internal identifier; not queryable or visible |
| `document_filename` | 151 populated | Internal locator; not queryable or visible |
| `external_meeting_ref` | 0 populated | Not an identity or lookup path |
| `processed_for_insights` | Operational field | Excluded; no approved business meaning |

The fact that `decisions_made` is nonempty does not prove that a meeting contains
an affirmative decision. Detecting no-decision wording, commitments,
responsibility, rationale, deadlines, or quotes requires semantic
interpretation. Therefore counts such as "meetings with decisions" remain
`not_computable` in Data Query.

Subjects, decisions, attendance lists, summaries, content, hashtags, mail data,
attachment data, filenames, and quotations must never enter a Data Query plan,
`machineResult`, exact answer, or Data Query telemetry.

### `meetings_documents` relationship audit

The two read identities have materially different visibility:

| Evidence property | Live result |
|---|---:|
| Rows visible to the managed Data Query identity | 0 |
| Rows visible to the existing semantic read connection | 36 chunks |
| Exact `(project_id, source_id)` meeting keys represented | 11 |
| Meetings with at least one evidence chunk | 11 |
| Meetings without evidence chunks | 140 |
| Chunks per represented meeting | 2-6 |
| Orphan chunks without a same-project meeting | 0 |
| Same source ID attached to another project | 0 |
| Attachment mismatches | 0 |
| Evidence `primary_date` mismatches | 18 chunks |
| Evidence chunks for the deterministic latest meeting | 4 |

The proven relationship is:

```text
meetings.id + meetings.project_id
  -> meetings_documents.source_id + meetings_documents.project_id

meetings.attachment_id
  == every accepted meetings_documents.attachment_id for that exact key
```

This is a sparse evidence relationship, not a generic join. The 140 meetings
without chunks require an ordinary `evidence_unavailable` result. Similar text,
the same date, or nearby dates must never substitute another meeting's evidence.
In particular, the 18 `primary_date` mismatches prove that `primary_date` cannot
attest meeting identity.

Because the managed Data Query identity sees zero evidence chunks, Data Query
must not plan over `meetings_documents` and must not claim that the exact-read
credential can retrieve meeting evidence. `meetings_documents` remains an
evidence source accessed only through the existing semantic read connection.

### Approved exact metadata contract

Phase 4D.2 may register one fixed `public.meetings` policy with the following
closed contract.

#### Approved internal fields

- `id`: stable validation/order key; never visible;
- `project_id`: exact scope and handoff key; never visible;
- `meeting_date`: exact filter, date grouping, time-series, and lookup field;
- `status`: opaque stored status for exact filter/group/distinct output.

No other meeting field is queryable by Data Query.

#### Approved operations

- `count` meeting rows;
- `group_count` by exactly one of `meeting_date` or `status`;
- `timeseries` by `meeting_date`, with explicit UTC day or month granularity;
- `distinct` only for the approved stored `status` field;
- `lookup_latest`, `lookup_earliest`, and `lookup_last_n` over dated meeting
  metadata.

Lookup output is limited to `meeting_date` and the opaque stored `status`. The
internal stable ID remains available only for validation and ordering. The
maximum lookup cardinality proposed for 4D.2 is 25; larger, zero, negative,
fractional, or unbounded requests must fail before network execution.

#### Approved filters and scope

- caller/configured project scope through internal `project_id` equality;
- `meeting_date` inclusive lower and exclusive upper bounds;
- exact equality against one of the six audited stored `status` values.

Subject, participant, decision, attachment, filename, mail, created-at,
processed-state, and external-reference filters are not approved. Arbitrary
aliases and user-supplied IDs are not approved.

#### Explicit `not_computable` families

- number of meetings containing a decision;
- number of decisions, commitments, deadlines, responsibilities, or attendees;
- unique participants or participation frequency;
- open/closed/resolved/unresolved/approved/overdue lifecycle counts;
- subject/category/topic analytics;
- meeting duration, lateness, or time-of-day analytics;
- ingestion/creation-time questions;
- evidence/link availability counts;
- arbitrary numeric sums, averages, minima, maxima, rankings, or top-N
  analytics.

These requests must not degrade into a row count, free-text scan, or unfiltered
fallback.

### Routing and Meeting Evidence handoff policy

Question families are separated as follows:

| Question family | Required route |
|---|---|
| Approved counts, stored-status grouping/distinct values, time series, and bounded metadata lookups | Data Query only |
| Decisions, commitments, quotes, participants, rationale, responsibility, deadlines, or what was said | Meeting Evidence / semantic route only |
| Exact meeting metadata plus what was decided or said in that same meeting | Sequential Data Query then exact Meeting Evidence handoff |

The mixed route must not schedule broad Data Query and Meeting Evidence reads in
parallel. It must:

1. execute and attest the bounded Data Query lookup first;
2. keep the selected `id`, `project_id`, and `attachment_id` internal;
3. query the existing Meeting Evidence connection with exact
   `source_id + project_id` scope;
4. require every accepted chunk to match the selected attachment;
5. reject missing, ambiguous, orphaned, cross-project, attachment-mismatched, or
   differently keyed evidence;
6. preserve the exact date/status fact even when semantic evidence is absent or
   conflicts; and
7. return an explicit evidence boundary rather than broadening retrieval.

The legacy `meetings` content tool, generic retrieval, graph search, and semantic
similarity must not replace this exact handoff. A pure semantic question remains
outside Data Query and may use the ordinary Meeting Evidence route.

### Citation and link decision

The audit proves chunk identity, not a safe browser link. `document_filename`,
attachment identifiers, and raw storage/provider URLs remain private internal
locators. Phase 4D therefore approves no exact meeting or document link.

A mixed answer may show an authorized quote only when it came from an exactly
attested chunk. Until a separate authorization-bound URL relationship is proven,
the UI must use a plain-language unavailable-link boundary and must not emit a
raw URL, filename, attachment ID, or bracket label that looks like a link.

### Security decision for Phase 4D.2

The exact metadata slice may proceed to implementation under the existing
documented local, read-only, single-project risk boundary. This approval does
not establish database least privilege or prove that a caller-supplied project
value belongs to the authenticated user/team.

Before Phase 4D.2 can close, it must additionally prove:

- the fixed table and trusted Content origin cannot be redirected;
- validation occurs before any request;
- the managed credential is required and fails closed;
- exact execution uses only bodyless `GET`/`HEAD` against `public.meetings`;
- the semantic connection is invoked only after exact identity selection for a
  mixed request;
- client and workflow projections redact internal fields, chunks, filenames,
  URLs, content, scores, and raw provider errors; and
- synthetic cross-project and mismatched-identity fixtures fail before an
  answer is accepted.

Production or multi-project activation remains blocked on authorization-bound
caller membership and negative cross-project proof unless the user explicitly
accepts that narrower documented risk.

## Phase 4D.1 verification and database immutability

- The fixed live audit reconciled 151 `meetings` rows through the managed
  read-only identity.
- The same identity saw zero `meetings_documents` rows; the separate existing
  semantic connection reconciled 36 chunks without printing their contents or
  identities.
- All row, vocabulary, tie, and relationship totals in this document came from
  live read-only requests performed by `scripts/audit-phase4d-meetings.mjs`.
- Phase 4D.1 changed no runtime source, tests, settings, or browser files.
- No Content row, table, column, schema, RPC, function, index, role, grant,
  permission, RLS policy, Supabase/Auth setting, user, or saved table selection
  was added, edited, or deleted.

## Phase 4D.2 implementation and automated verification - complete

Completed implementation checklist:

- [x] Register exactly one dormant-then-activated `meetings` metadata policy
      without changing earlier manifests.
- [x] Hardcode `public.meetings`, the approved field projection, and bodyless
      `GET`/`HEAD` transport.
- [x] Add closed English/Hebrew grammar for approved meeting metrics and bounded
      lookups; reject whole-clause qualifiers that would otherwise be dropped.
- [x] Enforce `meeting_date + id` ordering, inclusive date bounds, UTC
      bucketing, status vocabulary attestation, project scope, row caps,
      cardinality, timeout, and provider failure closure.
- [x] Render exact-only answers deterministically from `machineResult`, exposing
      date and opaque stored status only.
- [x] Add explicit `not_computable` guards for decisions, attendance, lifecycle,
      subject/topic, ingestion-time, and unsupported analytics.
- [x] Preserve semantic precedence for pure decisions, quotes, participants,
      rationale, responsibility, and deadline questions.
- [x] Implement the mixed route as sequential Data Query selection followed by
      exact `source_id + project_id + attachment_id` Meeting Evidence
      attestation.
- [x] Ensure missing or mismatched evidence returns a boundary and never broad
      parallel retrieval.
- [x] Add meeting-specific client/workflow projections that contain aggregate
      statuses and presence flags only.
- [x] Keep links unavailable unless a separate safe authorization-bound
      relationship is proven.

Required automated coverage:

- [x] English and Hebrew total, stored-status grouping, distinct status, date
      range, day/month time series, latest, earliest, and last-N;
- [x] zero-row, one-row, tied-date, stable-ID, invalid-date, inclusive-end-date,
      and timezone fixtures;
- [x] exact status filters and unknown-vocabulary drift;
- [x] project scope and synthetic cross-project rejection;
- [x] decision/attendance/subject/lifecycle route-away or `not_computable`
      behavior without content reads;
- [x] exact meeting/source/project/attachment match success;
- [x] missing chunks, ambiguous keys, orphan chunks, cross-project keys,
      attachment mismatch, and misleading `primary_date` failure;
- [x] semantic precedence and mixed exact-fact preservation;
- [x] invalid table, field, alias, operation, filter, order, limit, and arbitrary
      raw-plan rejection before fetch;
- [x] credential, trusted-origin, bodyless method, timeout, cap, and sanitized
      provider-failure behavior;
- [x] absence of IDs, names, attendance, subject, decisions, chunks, filenames,
      URLs, scores, and raw errors from exact answers and client/workflow
      telemetry;
- [x] every protected Data Query regression from the earlier phases.

### Implemented routing and evidence transport

- Exact count, approved status/date metrics, time series, and bounded metadata
  lookups use Data Query only. Pure semantic meeting questions use Meeting
  Evidence only. Mixed questions run Data Query first, then pass only the exact
  selected meeting identity into the same-meeting evidence read.
- All three meeting route families bypass generic Hybrid Search, graph search,
  reranking, investigation planning, and knowledge planning. Exact answers skip
  Main; semantic and mixed answers use Main only for bounded grounded synthesis.
- Main retry input is reconstructed from a sanitized projection. It does not
  receive raw identifiers, filenames, URLs, scores, embeddings, or provider
  error payloads.
- Exact meeting metadata remains fixed to bodyless `HEAD`/`GET` requests against
  `public.meetings`. Validation covers the table, operation, fields, filters,
  status vocabulary, project scope, date bounds, ordering, cardinality, and
  complete-read cap before execution.
- The published `hybrid_match_meetings_documents` argument contract was audited.
  A read-only health probe returned structural HTTP 400 / PostgreSQL `42703`
  because the deployed function references an absent `meeting_id` column while
  the live evidence key is `source_id`.
- No RPC or schema repair was authorized. The application therefore keeps the
  RPC first and uses a temporary compatibility path only for structural HTTP
  400/404 failures. That path performs exactly one bodyless, fixed-table
  `meetings_documents` `GET`, reconciles an exact count, and fails closed above
  500 rows.
- The compatibility read uses the existing semantic service credential and
  validates project, source, attachment, chunk, and vector shape. An unscoped
  request is accepted only when the complete bounded result contains exactly
  one project. It applies the configured vector admission threshold followed by
  bounded weighted ranking, performs no adjacency expansion, and returns no
  filename, URL, embedding, raw identifier, or score to the client.
- Exact mixed handoff additionally revalidates the selected meeting row through
  the Data Query identity and requires every evidence chunk to match the exact
  meeting/project/attachment relationship. Missing, ambiguous, mismatched, or
  cross-project evidence returns an explicit unavailable boundary.

Recorded verification commands:

```text
node --check src/subagents/dataQuery.js
node --check src/subagents/dataQueryMetadata.js
node --check src/subagents/meeting.js
node --check src/agent.js
node --check test/run-tests.js
npm.cmd test -- --filter "^data query Phase 4D"
npm.cmd run test:data-query
npm.cmd test
npm.cmd run react:build
git diff --check
```

Results:

- all five listed JavaScript syntax checks passed;
- Phase 4D filter: **10/10 passed**;
- protected Data Query suite: **99/99 passed**;
- full repository suite: **344/355 passed**; the same 11 unrelated Settings,
  Workflow, and Timeline UI/static-contract checks failed, with no Phase 4D or
  Data Query failure;
- React build could not start because `node_modules/.bin/vite.cmd` is absent and
  `vite` is not recognized; no dependency installation was authorized;
- `git diff --check` is part of the final root verification and is not replaced
  by the focused test evidence above.

## Phase 4D.3 authenticated UI verification and closeout - complete

After a verified server restart, all 17 planned cases were run through a fresh
authenticated chat. Only privacy-safe aggregate and route evidence is retained
here.

Authenticated matrix - **17/17 passed**:

| # | Exact question | Expected contract |
|---:|---|---|
| 1 | `How many meetings are there?` | Exact total count; Data Query only |
| 2 | `כמה ישיבות יש?` | Same exact total in Hebrew |
| 3 | `Break down meetings by stored status.` | Six raw stored-status groups reconciling to the total |
| 4 | `פלח את הישיבות לפי הסטטוס השמור.` | Same groups/counts in Hebrew |
| 5 | `Show the latest meeting.` | `lookup_latest`; date/status only; deterministic descending order |
| 6 | `הצג את הישיבה האחרונה.` | Same row in Hebrew |
| 7 | `Show the last five meetings.` | Exactly five rows in stable order |
| 8 | `הצג את חמש הישיבות האחרונות.` | Same five rows/order in Hebrew |
| 9 | `How many meetings were held from 2024-11-13 to 2025-01-28?` | Inclusive audited live range |
| 10 | `Show the earliest meeting.` | `lookup_earliest`; deterministic ascending order |
| 11 | `How many meetings were held from 2099-01-01 to 2099-01-02?` | Exact numeric zero, not blank |
| 12 | `How many unique meeting attendees are there?` | `not_computable`; no names or content read |
| 13 | `How many meetings contain at least one decision?` | `not_computable`; no text interpretation |
| 14 | `What was decided about the electrical accessories in the fire panel? Quote the meeting record.` | Meeting Evidence only; exact quote/citation boundary |
| 15 | `מה הוחלט לגבי אביזרי החשמל בפאנל הכבאות? הצג ציטוט מפרוטוקול הישיבה.` | Hebrew Meeting Evidence-only case |
| 16 | `What was the latest meeting, and what was decided in that same meeting?` | Sequential exact lookup plus same-meeting evidence |
| 17 | `מה הייתה הישיבה האחרונה ומה הוחלט באותה ישיבה?` | Same exact mixed contract in Hebrew |

Observed closeout results:

- Cases 1-13 all passed their exact or `not_computable` contracts in English
  and Hebrew. The total was 151; the six stored-status groups reconciled to 151;
  the inclusive full live date range returned 151; the future range returned
  exact zero; attendee and decision-presence counts remained
  `not_computable` without reading excluded content.
- Exact latest/earliest/last-five answers used canonical `meeting_date` plus
  stable ID ordering but displayed only the approved date and opaque stored
  status. No internal identity or source locator was displayed.
- Case 14 used Meeting Evidence only and truthfully said that no specific
  evidence supported the requested detail while still showing authorized dated
  meeting citations. No generic retrieval result was substituted.
- Case 15 preserved the same boundary in Hebrew and displayed only a related
  authorized citation excerpt. The excerpt is intentionally not copied into
  this tracker.
- Cases 16 and 17 selected the exact latest meeting dated 2025-01-28 with stored
  status `לביצוע`, then retrieved evidence only for that same meeting. The
  exact metadata remained authoritative and no false conflict was reported.
  English completed through the normal Main path. The Hebrew case passed in a
  fresh isolated run after the planner correction, also through the normal Main
  path.
- Pure exact cases used only Data Query. Pure semantic cases used only Meeting
  Evidence as their project-data tool. Mixed cases showed Data Query completion
  before the exact Meeting Evidence call. All 17 cases skipped generic Hybrid
  Search, graph search, reranking, investigation planning, and knowledge
  planning.

The retained run evidence records operation shape, bounds, route family,
tools used/skipped, Main usage/bypass, and read-only reconciliation without raw
meeting/project/attachment/chunk identities or evidence payloads.

The final privacy review verified that retained workflow projections and
committed evidence contain no meeting/project/attachment/chunk
IDs, UUIDs, attendance names, subjects, filenames, URLs, raw evidence content,
scores, or provider errors. Authorized quotes may appear in the semantic answer
only; they were not copied into workflow telemetry or this tracker.

Authenticated UI verification created only ordinary application chat/run-history
records. It did not mutate Content data, database objects, permissions, RLS,
Auth/Supabase settings, or saved selections.

## Post-closeout routing hotfix - 2026-07-27

Manual UI regression found that natural Hebrew variants such as
`מתי הייתה הישיבה האחרונה?` and `כמה ישיבות היו?` were rejected by the narrow
positive grammar and returned an internal `not_computable` policy message.
`מתי הייתה הישיבה האחרונה ומה עלה בה?` was also not recognized as the approved
mixed exact-plus-semantic shape.

The hotfix:

- accepts the natural Hebrew lookup and count variants as the same typed exact
  operations;
- recognizes `מה עלה בה` as a meeting-scoped semantic request without changing
  the existing `מה עלה בחשבונית האחרונה` invoice route;
- keeps mixed latest-meeting questions sequential: exact meeting identity first,
  then evidence constrained to that same meeting;
- keeps semantic fallback available for empty or failed non-mixed exact meeting
  lookups instead of exposing an internal policy response;
- sends unsupported meeting-topic qualifiers directly to Meeting Evidence,
  bypassing generic Hybrid Search, graph search, reranking, and Main-model
  timeout/retry latency;
- formats verified fallback evidence deterministically with bounded dated
  excerpts and an explicit boundary that it is relevance-ranked, not proof of
  the chronologically latest meeting under that qualifier;
- does not use semantic text to invent exact meeting counts or bypass the
  existing privacy, origin, scope, and typed-field boundaries.

Final verification after the hotfix:

- Phase 4D automated suite: `10/10`;
- full Data Query regression set: `99/99`;
- repository suite: `344` passed and the same `11` unrelated pre-existing UI
  failures out of `355` total;
- authenticated UI: `מתי הייתה הישיבה האחרונה?` returned 28.01.2025 with stored
  status `לביצוע`; `כמה ישיבות היו?` returned the exact count 151;
  `מתי הייתה הישיבה האחרונה ומה עלה בה?` used exact Data Query identity followed
  by same-meeting evidence and normal synthesis;
- live negative path: `מה הייתה הישיבה האחרונה בנושא תאורה?` returned HTTP 200
  in 6.7 seconds with a non-empty bounded answer, Meeting Evidence `found`, an
  explicit semantic-evidence boundary, and no internal policy text. Only
  `meeting_evidence_search` ran as the project-data tool.

The hotfix changed no database schema, data, permissions, RLS, credentials, or
saved settings. Chrome control stopped responding after an intentionally
terminated long-running pre-optimization check; the final negative path was
therefore verified through the same live authenticated server pipeline without
retaining answer content.

## Exact-date decision evidence hotfix - 2026-07-27

Manual verification of
`יכול לפרט לי את כל ההחלטות שנקבעו בישיבה ב-23/01/25?` exposed a second
meeting-evidence gap. The route selected Meeting Evidence correctly, but the
configured semantic RPC failed with PostgreSQL `42703`. Its compatibility scan
could not answer because the relevant rows exist in `public.meetings` while the
sparse `public.meetings_documents` relation does not represent most meetings.
The resulting evidence error was incorrectly presented as an empty evidence
set.

The bounded correction keeps `decisions_made` excluded from Data Query and adds
one Meeting Evidence-only path for an explicit single calendar date plus a
decision-detail request. That path:

- parses `DD/MM/YY`, `DD.MM.YYYY`, and ISO dates deterministically;
- preserves the classifier's calendar date before timezone-to-UTC conversion,
  so `2025-01-23T00:00:00+03:00` remains January 23;
- performs one bodyless `GET` against fixed `public.meetings`, with exact count
  reconciliation, stable ID ordering, and a 25-row hard bound;
- applies a configured project filter when available; in the attested local
  unscoped shape, it accepts results only when every validated row belongs to
  exactly one project and otherwise fails closed;
- validates positive row identity, project identity, canonical meeting date,
  attachment presence, unique rows, and nonempty decision content before any
  answer is built;
- bypasses the broken vector RPC for this exact-date decision family; and
- formats the result deterministically without exposing project, meeting,
  attachment, filename, URL, score, provider, or credential values.

The formatter also distinguishes agenda records from affirmative decisions.
Placeholder decision text such as `לא צוין` is not relabeled as a decision.
Instead, explicit decisions and agenda items without an explicit recorded
decision are shown in separate sections.

Final live pipeline evidence for the reported question:

- HTTP `200` in 4.0 seconds;
- only `meeting_evidence_search` ran as the project-data tool;
- Meeting Evidence returned `found` with 13 exact-date records;
- one explicit decision was recorded:
  `חתימה על תוספת טרמוסטטים` -> `אושר ונחתם`;
- 12 other agenda items were listed under “no explicit decision recorded”;
- generic Hybrid Search, graph search, reranking, and semantic substitution were
  not used; and
- no RPC error or internal policy text appeared in the answer.

The hotfix made no database schema, data, permission, RLS, credential, or saved
settings change. The live check created only ordinary application chat and run
history records.

Final automated verification after this hotfix:

- Data Query regression set: `100/100`;
- repository suite: `345` passed and the same `11` unrelated pre-existing UI
  failures out of `356` total; and
- JavaScript syntax checks passed for `src/agent.js`,
  `src/subagents/meeting.js`, and `test/run-tests.js`.

## Current stop point

Phase 4D.1, 4D.2, and 4D.3 are complete. The bounded local runtime, automated
suite, all 17 authenticated UI cases, privacy review, and documentation closeout
passed under the audited single-project shape. No project scope was configured
in the localhost UI, so that acceptance is not a production authorization
claim. Production and multi-project use remain blocked on authenticated project
membership/RLS enforcement and explicit scope. SEC-001 remains deferred.

Work stops here. Phase 4E is the next separately approval-gated phase and has
not started.
