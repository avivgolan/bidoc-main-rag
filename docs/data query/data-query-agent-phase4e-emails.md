# Data Query Agent Phase 4E - email metadata

Date: 2026-07-27

Audit source: live Content database, read only

Audit script: `scripts/audit-phase4e-emails.mjs`

## Status

- Phase 4E.1 source-of-truth audit and typed policy: **complete**.
- Phase 4E.2 implementation and automated verification: **complete**.
- Phase 4E.3 authenticated UI verification and documentation closeout:
  **complete**.
- Phase 4F and all later table promotions remain untouched.

The approved Phase 4E boundary is one fixed `public.emails` metadata contract.
Email content and personal data remain retrieval-only. No database object,
Content row, schema, permission, RLS policy, Supabase setting, or saved table
selection may be changed by this phase.

## Phase 4E.1 source-of-truth audit - complete

The fixed audit made paginated, bodyless, read-only requests through both the
managed Data Query identity and the semantic Content identity. It did not use
SQL or change any database object.

| Property | Audited result | Phase 4E policy |
| --- | ---: | --- |
| Source rows | 7,163 | not the ordinary email total |
| Project-related rows | 786 | unqualified `email`/`emails` means these rows |
| Excluded `no_clear_project` rows | 6,377 | never included in the ordinary exact total |
| Stable positive unique IDs | 7,163 | internal tie-break only; never displayed |
| Populated valid `received_date` | 7,163 | sole canonical email business date |
| Date range | 2024-11-01 04:39:35Z to 2026-04-01 05:42:56Z | exact date filter and ordering field |
| Timestamp ties | 42 groups; largest 3 | order by `received_date`, then `id` |
| Project-related categories | 9 reviewed values across all 786 rows | typed group/filter/display vocabulary |
| Direction | 5,377 inbound; 1,786 outbound source rows | typed `inbound`/`outbound` vocabulary |
| Attachment flag | 4,986 false; 2,177 true source rows | email-row existence flag only |
| Item status | all 7,163 `בטיפול` | opaque stored value, not lifecycle truth |

The nine project-related category counts are 37 approvals/permits, 129
contracts/engagements, 143 finance/accounting, 29 schedules, 12
analysis/forecasting, 4 coordination/execution, 176 documentation/decisions,
159 operations/execution, and 97 general communication. They reconcile to
786.

The attachment relation contains 298 rows and 214 project-related email keys.
Among project-related emails, 282 rows have `has_attachments=true`, but only 214
have attachment rows. Therefore `has_attachments` is authoritative only for an
email-row existence metric. Attachment counts, filenames, rows, and links are
not computable in the exact contract.

Sender/recipient names and addresses, other recipients, subject, body,
summaries, IDs, conversation keys, filenames, URLs, hashtags, metadata, and
embeddings are excluded. Content meaning such as requests, approvals,
rejections, intent, and quotations remains semantic retrieval work.

`received_date` means message receipt time. It must never be presented as the
date of an event described in the email body.

## Phase 4E.2 implementation and automated verification - complete

The sixth reviewed exact table is fixed `public.emails`. Dedicated Data Query
credentials activate its managed PostgREST adapter; otherwise it remains
dormant. The adapter accepts only bodyless `GET`/`HEAD` requests and supports:

- exact scoped totals and approved category/direction/attachment-state/
  relevance/item-status filters and one-field groups;
- distinct reviewed email categories;
- day/month `received_date` series and inclusive date filters; and
- bounded latest, earliest, and last-N safe metadata lookups (1-25 rows).

Every exact email plan must contain exactly one fixed
`relevance_status in (project_related,multi_project)` predicate. The validator
and transport independently enforce it. The transport also validates every
returned category, direction, attachment flag, relevance value, item status,
positive ID, and receipt date before accepting a result.

Exact questions use deterministic answers and skip semantic substitution.
Content-only questions route to the email retrieval tool. The approved mixed
family keeps the exact scoped count separate while allowing retrieval to explain
email content. Client and workflow projections expose no row IDs, project IDs,
mail/conversation IDs, identities, addresses, content, plan/request identifiers,
or provider errors.

Verification evidence:

- syntax: `node --check` passed for `src/agent.js`,
  `src/subagents/dataQuery.js`, and `src/subagents/dataQueryMetadata.js`;
- focused Phase 4E: 6/6 test groups passed;
- protected Data Query regression: 106/106 passed;
- full repository suite: 351 passed, 11 failed; the same 11 pre-existing
  settings/workflow/timeline static-contract failures remain outside Data Query;
- no new database migration, RPC, grant, role, RLS, schema, or write path was
  added.

## Phase 4E.3 authenticated UI verification - complete

The authenticated localhost UI matrix passed on 2026-07-27 in the user's
existing Chrome profile. The verified results were:

| Case | Authenticated UI result |
| --- | --- |
| Hebrew scoped total | 786 project-related emails |
| Relevance group | `project_related`: 786 |
| Category group | nine reviewed categories totaling 786 |
| Direction group | 620 inbound and 166 outbound |
| Attachment-state group | 504 false and 282 true |
| Attachment-flag count | 282 |
| Latest safe metadata | 2026-03-31; finance/accounting; outbound; no attachments; project-related; item status displayed |
| Last five | five stable, metadata-only records; all received 2026-03-31 |
| Inclusive 2024-11-01 through 2026-04-01 | 786 |
| Known category in an empty January 2024 range | 0 |
| English scoped total | 786 project-related emails |
| Semantic latest-content question | semantic retrieval returned content with an explicit non-exact-latest boundary |
| Mixed count plus latest-content question | exact 786 anchor preserved; semantic content kept separate and explicitly qualified |

Exact runs showed the intended route in the workflow UI: generic hybrid,
project-graph, and reranker retrieval were skipped; Data Query completed; and
Main generation was skipped for deterministic email answers. The mixed route
ran Data Query together with email semantic retrieval while preserving the
exact count.

Live UI verification found and corrected six integration defects before
closeout:

1. added the approved English and Hebrew scoped-count grammar variants;
2. trusted caller-derived email date bounds and retained fail-closed unresolved
   date-scope validation, with the inclusive upper bound translated to the next
   UTC day;
3. rendered the real group field and localized direction values instead of a
   generic `value` label;
4. guarded absent workflow hint/board elements in the client;
5. restarted the stale pre-Phase-4E server process; and
6. added a deterministic boundary that prevents relevance-ranked semantic email
   content from being described as the exact overall latest email.

The final exact answers exposed no sender/recipient identities, addresses,
subjects, bodies, internal IDs, source URLs, or provider errors. Semantic email
content remained available only on the approved retrieval route and was not
presented as an exact same-record join.

### Reopened baseline correction - 2026-07-27

The user reopened the 4E.3 acceptance gate after two ordinary Hebrew questions
failed despite the earlier matrix:

- `כמה מיילים יש במערכת?` reached the exact route but was rejected because the
  harmless UI phrase `במערכת` was absent from the positive email-count grammar;
- `מה המייל האחרון שמופיע?` was parsed as a latest-email candidate but the
  `מה ... שמופיע` wording was treated as an unsupported qualifier, so it fell
  into the slow relevance-ranked semantic route.

The grammar was widened only for those harmless system-count and metadata-latest
forms; the fixed project-related scope, PII exclusions, and semantic-content
boundary did not change. Focused tests now cover both user wordings, their typed
plans, generic-retrieval bypass, and Data-Query-only tool scheduling even when
the external classifier hints only `emails` for the latest lookup.

Authenticated Chrome reruns then passed:

| Reopened case | Corrected live result | Verified route |
| --- | --- | --- |
| `כמה מיילים יש במערכת?` | 786, with the project-related scope stated explicitly | hybrid/graph/reranker skipped; Data Query completed; Main skipped |
| `מה המייל האחרון שמופיע?` | 31.03.2026; finance/accounting; outbound; no attachments; project-related; stored status `בטיפול` | hybrid/graph/reranker skipped; Data Query completed; Main skipped |

Both corrected live runs completed in roughly five seconds, including classifier
latency, rather than entering the previous multi-minute semantic path. The
protected Data Query suite remains 106/106; the full suite remains 351 passed
with the same 11 unrelated settings/workflow/timeline contract failures. The
localhost server was also restarted outside the restricted execution environment
so its configured Supabase and OpenRouter network calls remain available.

### Reopened relevance-scope correction - 2026-07-27

The user reopened Phase 4E to verify that project email searches exclude rows
whose stored relevance is unclear. The resulting contract now distinguishes two
explicit scopes without widening ordinary email access:

- ordinary, project-related, lookup, mixed, and semantic email requests remain
  fixed to `relevance_status in (project_related,multi_project)`;
- an explicit English or Hebrew unclear/non-project count may use exactly
  `relevance_status = no_clear_project`;
- `no_clear_project` is count-only: lookups, breakdowns, content interpretation,
  and row display remain rejected; and
- spam or junk-mail requests fail closed because `no_clear_project` means no
  clear project association and is not evidence that an email is spam.

The validator accepts the unclear scope only when the caller-attested metric is
one count, and the managed transport independently accepts only a bodyless HEAD
count with that predicate. A no-clear plan without the matching attested intent,
or any no-clear lookup, is rejected before network execution. Ordinary plans
still require the original fixed project-related predicate.

Timeline-impact email questions are now recognized as semantic email work even
when the external classifier suggests only generic retrieval. They bypass
generic hybrid, graph, and reranker retrieval and schedule the internal `emails`
tool directly. That tool retains its fixed
`relevance_status=in.(project_related,multi_project)` PostgREST filter for both
vector enrichment and text retrieval.

Verification evidence:

- syntax passed for `src/agent.js`, `src/subagents/dataQuery.js`,
  `src/subagents/dataQueryMetadata.js`, and `test/run-tests.js`;
- all six focused Phase 4E groups passed;
- the protected Data Query regression passed 106/106;
- the full repository suite remained 351 passed and the same 11 unrelated
  settings/workflow/timeline static-contract failures;
- the live read-only audit reconfirmed 7,163 source rows: 786
  `project_related`, 6,377 `no_clear_project`, and no current `multi_project`
  rows; and
- authenticated UI checks returned 786 for an explicit relevant count, 6,377
  for the Hebrew unclear count, refused to equate spam with
  `no_clear_project`, and routed the timeline-impact question through the
  internal `emails` tool after skipping hybrid/graph/reranker retrieval.

The timeline-impact email tool completed in about ten seconds. Main synthesis
then timed out twice and returned the source-derived fallback answer after about
three minutes. This is a separate Main-Agent latency limitation; the relevance
filter and dedicated semantic routing passed. No database object, Content row,
schema, permission, RLS policy, Supabase setting, or saved table selection was
changed.

### Reopened Hebrew project-membership wording - 2026-07-28

The user reopened the Phase 4E grammar checkpoint after the ordinary question
`כמה מיילים שייכים לפרויקט יש מתוך כל המיילים?` was rejected as an unapproved
email metadata query. A regression first reproduced the rejection at capability
classification, before any database call.

The correction is grammar-only. The exact email parser now treats
`שייכים לפרויקט` as a project-related alias and removes the harmless comparative
tail `מתוך כל המיילים` before validating the approved count grammar. It does not
introduce a denominator, percentage, content filter, identity filter, or new
relevance state. The generated plan still contains exactly the fixed predicate
`relevance_status in (project_related,multi_project)`.

Verification evidence:

- the exact screenshot wording now classifies, plans, validates, bypasses generic
  retrieval, and schedules only `data_query` in the focused regression;
- all six Phase 4E test groups passed;
- the protected Data Query suite passed 106/106;
- the full suite remained 351 passed and the same 11 unrelated
  settings/workflow/timeline static-contract failures;
- after replacing the stale localhost listener, the live chat pipeline returned
  786 project-related emails in about five seconds; and
- live run telemetry showed hybrid search, graph search, and reranking skipped,
  Data Query completed with `status: ok`, and Main skipped for the deterministic
  email answer.

Chrome exposed the user's open authenticated BiDoc tab but its automation bridge
held a stale tab handle, so this exact rendering was not independently observed
in the browser. The existing tab was left open and the corrected server remains
available on port 4000 for the user's immediate manual refresh and retest.

### Central Hebrew email-relevance lexicon - 2026-07-28

The user reopened Phase 4E after related Hebrew forms still behaved differently:
`כמה מיילים רלוונטים יש?` was rejected while `כמה מיילים שייכים לפרויקט?`
worked, and `כמה מיילים לא שייכים לפרויקט?` was rejected. The two failing
questions were reproduced in deterministic tests before implementation.

Hebrew email relevance is now defined in the centralized
`src/subagents/dataQueryHebrewLexicon.js` lexicon instead of being duplicated
across independent regular expressions. Its controlled vocabulary covers:

- common correct and colloquial spellings of relevant, including
  `רלוונטיים`, `רלוונטים`, `רלבנטיים`, and `רלבנטים`;
- gender/number forms of related, belonging, concerning, and assigned;
- project-association nouns such as `שיוך`, `זיקה`, `קשר`, and `רלוונטיות`;
- explicit negative/unclear forms such as `לא`, `שלא`, `שאינו/ה/ם/ן`,
  `ללא`, `בלי`, and `לא ברור`; and
- safe entity/count aliases including `אימייל`, `דוא״ל`, `דואר אלקטרוני`,
  `כמה מהמיילים`, `מה כמות`, `מה סך כל`, and the spelling `פרוייקט`.

The normalizer removes Hebrew diacritics, canonicalizes harmless spelling and
entity aliases, and converts recognized relevance phrases into the existing
approved count grammar. Negative intent is resolved before positive intent so
`לא שייכים` cannot accidentally become project-related. Words merely adjacent
in meaning, such as `חשובים` or `מעניינים`, still fail closed; spam remains a
separate rejected concept; and unclear-project breakdowns remain count-only.

Verification evidence:

- the lexicon regression covers 15 positive and 13 negative/unclear Hebrew
  questions, plus fail-closed adjacent-word, spam, and breakdown controls;
- all seven Phase 4E groups passed;
- the protected Data Query suite passed 107/107;
- the full suite passed 352 tests and retained the same 11 unrelated
  settings/workflow/timeline static-contract failures;
- the restarted live chat pipeline returned 786 for
  `כמה מיילים רלוונטים יש?` and 6,377 for
  `כמה מיילים לא שייכים לפרויקט?`; and
- telemetry for both live runs showed hybrid/graph/reranker skipped, Data Query
  completed with `status: ok`, and Main skipped for the deterministic answer.

This checkpoint changes only application-language normalization. It does not
change the relevance predicates, table policy, query transport, database,
Content rows, schema, permissions, RLS, roles, or Supabase settings. The
dictionary structure is reusable by later approved domains, but no Phase 4F or
other-table vocabulary was activated here.

## Database immutability

Phase 4E uses read-only `GET`/`HEAD` requests only. It does not authorize SQL,
RPC creation, migrations, writes, role/grant changes, RLS changes, schema changes,
or settings mutations.

## Next approval gate

Phase 4E is closed. Phase 4F is the next approval gate and remains outside scope
until the user separately approves it.
