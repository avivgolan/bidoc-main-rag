# Data Query Agent - deferred security register

Status: deferred by product decision on 2026-07-24.

This file is the single tracker for all security findings identified during the read-only Data Query Phase 4A.0 audit. The functional Data Query roadmap continues separately.

No Supabase query was rerun to create this file. No table, column, row, function, role, grant, policy, index, Auth user, or migration was changed.

## Scope and interpretation

The register contains:

- findings verified by read-only live catalog queries;
- findings returned by the Supabase Security Advisor during Phase 4A.0;
- code paths that weaken the intended Data Query boundary;
- one current Supabase platform change that affects the future grant model.

It is not a penetration test and should not be treated as proof that no other issue exists. The first future remediation step must refresh the Security Advisor and catalog inventory before changing anything.

Supabase uses two separate Data API controls:

1. grants decide whether a role can reach an object;
2. RLS policies decide which rows that role may read or modify.

Both layers must be reviewed together:

- <https://supabase.com/docs/guides/api/securing-your-api>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>

## SEC-001 - managed Data Query token has broad raw-table privileges

Severity: Critical  
Status: Verified, deferred

The managed Data Query access token has native JWT role `authenticated` plus:

```json
{
  "app_metadata": {
    "data_query_role": "bidoc_data_query"
  }
}
```

The claim-gated `SECURITY DEFINER` wrapper checks the application-metadata marker before running the exact Data Query implementation. It does not cause the token to assume the native PostgreSQL role `bidoc_data_query`.

Read-only live catalog checks found `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges for `authenticated` on all reviewed core tables:

- `alerts`;
- `data_index`;
- `emails`;
- `exceptions_report`;
- `financial_transactions`;
- `meetings`;
- `other_documents`;
- `safety_reports`;
- `whatsapp_analysis`.

The reviewed RLS policies also permit broad authenticated access. Therefore a leaked managed token has a materially larger raw-table capability than the fixed Data Query RPC contract.

Impact:

- a credential leak can bypass the typed Query Plan and fixed-RPC boundary;
- raw rows and content-bearing columns may become reachable;
- write operations may be possible even though Data Query is described as read-only;
- caller `project_id` scope is an application/RPC constraint, not a credential-level constraint.

Future remediation goals:

- issue a service identity whose native database capability is restricted to approved RPC execution;
- prove the identity cannot directly `SELECT`, `INSERT`, `UPDATE`, or `DELETE` any raw table;
- keep ordinary team UI access on a separately reviewed authorization path;
- revoke sessions as well as deleting or disabling a service user when rotating credentials.

## SEC-002 - authenticated policies are not project- or user-scoped

Severity: Critical  
Status: Verified, deferred

Many reviewed Content tables use an `ALL` policy whose condition is equivalent to:

```sql
auth.role() = 'authenticated'
```

That checks authentication, not authorization. It does not constrain rows by `project_id`, user identity, team membership, or another ownership predicate.

Impact:

- any authenticated identity may be able to read or modify all rows permitted by the table grant;
- adding another project or customer can create BOLA/IDOR exposure;
- a dedicated Data Query Auth user inherits the same broad row access;
- Supabase anonymous Auth users also use the PostgreSQL `authenticated` role if anonymous sign-in is enabled.

Future remediation goals:

- define the real team/project membership model first;
- replace `auth.role()` predicates with explicit target roles and row authorization;
- use both `USING` and `WITH CHECK` for update policies;
- add cross-project negative tests before changing production policies.

## SEC-003 - thirteen public tables have RLS disabled

Severity: Critical  
Status: Verified, deferred

The Supabase Security Advisor reports 13 tables in exposed schema `public` with RLS disabled. Read-only privilege checks found anonymous and authenticated `SELECT`, `INSERT`, `UPDATE`, and `DELETE` grants on these tables.

Eight backup tables contain 3,023 rows:

| Table | Rows |
|---|---:|
| `jul_8_backup_alerts` | 1,026 |
| `jul_8_backup_other_documents` | 808 |
| `jul_8_backup_documents` | 593 |
| `jul_8_backup_meetings` | 508 |
| `jul_8_backup_financial_transactions` | 46 |
| `jul_8_backup_safety_reports` | 37 |
| `jul_8_backup_consultants_reports` | 4 |
| `jul_8_backup_exceptions_report` | 1 |

Five graph/timeline tables are currently empty but have the same exposure:

- `graph_edges`;
- `graph_nodes`;
- `timeline_entities`;
- `timeline_event_entities`;
- `timeline_graph_edges`.

Impact:

- anonymous Data API clients with the project publishable/anon key may read or modify exposed data;
- backup tables can expose historical records outside the current application path;
- empty exposed tables can become vulnerabilities as soon as data is inserted.

Future remediation goals:

- decide whether each backup table should be deleted, moved to a non-exposed schema, or retained with explicit access controls;
- revoke grants before or together with enabling RLS;
- add reviewed policies where application access is genuinely required;
- verify every existing UI and ingestion path in a non-production branch before rollout.

Advisor reference:

<https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public>

## SEC-004 - direct PostgREST compatibility reads bypass the fixed-RPC design

Severity: High  
Status: Code-verified, deferred

Exact Data Query operations use the fixed RPC. The compatibility `select` operation instead builds a direct request to:

```text
/rest/v1/<selected-table>
```

The request uses the managed `authenticated` token from SEC-001.

Related allowlist drift:

- when a saved selection exists, the confirmed UI selection is only `data_index`;
- when it is absent, the fallback manifest contains `data_index`, the configured alerts table, and `meetings_documents`;
- the existing regression test manually forces `allowedTables: ["data_index"]`, so it does not exercise the real fallback derivation.

Impact:

- the canonical runtime has a path outside the claim-gated fixed-table RPC;
- a missing settings record can expand the constructed table manifest;
- the documented `data_index`-only invariant is not fully tested.

Future remediation goals:

- remove direct raw-table retrieval from the canonical Data Query executor;
- make every structured lookup use a typed fixed-table RPC;
- derive the fallback as exactly one approved table;
- add a regression test around the real settings path.

## SEC-005 - overly permissive RLS policies

Severity: High  
Status: Security Advisor/catalog finding, deferred

Observed permissive policies include:

- `data_index.data_index_authenticated`: unrestricted `ALL` for `authenticated`;
- `drive_folder_queue.drive_queue_all`: unrestricted `ALL`;
- `whatsapp_analysis.whatsapp_analysis_select_all`: unrestricted `SELECT`;
- `whatsapp_analysis.whatsapp_analysis_insert_all`: unrestricted `INSERT`;
- `whatsapp_analysis.whatsapp_analysis_update_all`: unrestricted `UPDATE`;
- `whatsapp_conversations.whatsapp_conversations_insert_all`: unrestricted `INSERT`;
- `whatsapp_conversations.whatsapp_conversations_update_all`: unrestricted `UPDATE`;
- `whatsapp_messages.whatsapp_messages_insert_all`: unrestricted `INSERT`;
- `whatsapp_messages.whatsapp_messages_update_all`: unrestricted `UPDATE`.

Impact:

- the corresponding grant plus an always-true policy can permit every row;
- unrestricted writes can corrupt or replace project-derived analysis;
- public-role policies can include `anon` depending on the target-role declaration.

Future remediation goals:

- map the actual caller for every policy;
- replace blanket policies with operation-specific ownership/team checks;
- remove obsolete duplicate policies;
- test `SELECT`, `INSERT`, `UPDATE`, and `DELETE` independently.

## SEC-006 - RLS-enabled tables with no policy

Severity: Medium / configuration drift  
Status: Security Advisor finding, deferred

The advisor reported RLS enabled but no policy on:

- `consultants_reports_documents`;
- `daily_work_log_documents`;
- `documents`;
- `exceptions_report_documents`;
- `financial_transactions_backup_before_columns`;
- `financial_transactions_documents`;
- `jul_8_backup_data_index`;
- `jul_8_backup_email_attachments`;
- `jul_8_backup_emails`;
- `jul_8_backup_filtered_attachments`;
- `jul_8_backup_filtered_emails`;
- `meetings_documents`;
- `other_documents_documents`;
- `project_insight_runs`;
- `quality_control_documents`;
- `safety_reports_documents`.

RLS with no policy normally denies Data API access rather than exposing rows. The issue is an unclear and inconsistent access contract: application paths may rely on privileged keys or `SECURITY DEFINER` functions without an explicitly documented policy.

Future remediation goals:

- classify each table as private/internal, retrieval-only, or client-accessible;
- revoke unnecessary Data API grants for private tables;
- add narrowly scoped policies only where direct client access is intended.

## SEC-007 - callable `SECURITY DEFINER` functions

Severity: High  
Status: Security Advisor finding, deferred

Advisor-reported anonymous-executable `SECURITY DEFINER` functions:

- `public.find_entity_for_attachment(text, uuid)`;
- `public.stamp_chunk_indices(text, text)`;
- `public.stamp_meetings_chunk_indices(text)`.

The same functions are also callable by `authenticated`.

`public.bidoc_data_query_data_index_v1(...)` is callable by `authenticated` and is intentionally `SECURITY DEFINER`. Its internal immutable `app_metadata.data_query_role` gate and negative `42501` test mitigate the specific RPC call, but the warning remains valid and must be retained in regression coverage.

Impact:

- `SECURITY DEFINER` runs with the owner’s privileges and can bypass RLS;
- public-schema functions are Data API endpoints when `EXECUTE` is granted;
- missing internal authorization or unsafe parameters can become privilege escalation.

Future remediation goals:

- revoke `EXECUTE` from every role that does not require each function;
- move privileged helpers to an unexposed schema where practical;
- enforce an empty or trusted `search_path`;
- review function bodies for caller identity, project scope, and parameter validation.

## SEC-008 - functions with mutable `search_path`

Severity: High  
Status: Security Advisor finding, deferred

Functions visible in the captured advisor output included:

- `set_timeline_graph_updated_at`;
- `set_project_graph_updated_at`;
- `match_documents`;
- `graph_search`;
- `hybrid_match_meetings_documents`;
- `match_quality_control`;
- `hybrid_match_data_index`;
- `match_safety_reports`;
- `match_whatsapp_analysis`;
- `delete_data_index_on_email_irrelevant`;
- `match_alerts`;
- `match_consultants_reports`;
- `documents_fill_from_metadata`;
- `meetings_documents_fill_from_metadata`;
- `match_meetings_documents`;
- `stamp_meetings_chunk_indices`;
- `match_daily_work_log`;
- `match_emails`;
- `match_data_index`;
- `match_whatsapp_messages`.

The advisor response was truncated, so this list must be refreshed before remediation and may not contain every affected function.

Impact:

- an unsafe `search_path` can resolve an unqualified object to an attacker-controlled object;
- risk is higher for `SECURITY DEFINER` functions.

Future remediation goals:

- inventory every affected function from a fresh advisor result;
- schema-qualify referenced objects;
- set `search_path` explicitly to an empty or minimal trusted list;
- rerun behavioral and privilege tests for every changed function.

## SEC-009 - `vector` extension installed in `public`

Severity: Medium  
Status: Security Advisor finding, deferred

The advisor reports the `vector` extension in the exposed `public` schema.

Future remediation goal:

- evaluate moving the extension to a dedicated extensions schema;
- first verify every vector type, operator class, index, function, and RPC dependency.

This must not be changed casually because many embedding tables and HNSW indexes depend on it.

## SEC-010 - leaked-password protection disabled

Severity: Medium  
Status: Security Advisor finding, deferred

Supabase Auth leaked-password protection is disabled.

Impact:

- users, including managed service identities that use passwords, can choose credentials known to be compromised.

Future remediation goals:

- enable leaked-password protection after confirming plan/feature availability;
- rotate the Data Query service password;
- revoke existing sessions during rotation;
- keep the password unique and server-only.

## SEC-011 - Data API default-grant transition

Severity: Operational security / future compatibility  
Status: Track before 2026-10-30

Supabase is changing public-schema Data API exposure from automatic grants to explicit opt-in. Existing tables keep their current grants, but future table creation and provisioning must declare intended access explicitly.

Reference:

<https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>

Required future work:

- audit and version explicit grants in migrations;
- stop relying on project default privileges;
- ensure new Data Query RPCs are exposed intentionally while raw tables remain private.

## Deferred remediation order

When security work resumes:

1. refresh the Security Advisor and live grants/policies/functions inventory;
2. address anonymous exposure of populated backup tables;
3. define the project/team authorization model before changing authenticated RLS;
4. isolate the Data Query managed credential from raw tables and writes;
5. remove direct Data Query table reads;
6. review privileged functions and mutable `search_path`;
7. resolve Auth password protection and session-rotation procedures;
8. add negative API tests and verify the complete UI/ingestion workflow in a non-production branch;
9. deploy incrementally with rollback scripts and post-deployment advisor checks.

## Phase 4D security disposition - 2026-07-26

Phase 4D does not remediate this register:

- SEC-001 remains because the fixed reviewed `GET`/`HEAD` adapters for financial,
  safety, alert, and meeting metadata are application restrictions over a
  credential with broader native privileges.
- SEC-002 remains because localhost had no authenticated project scope. The
  audited single-project result allowed local acceptance only; production and
  multi-project use remain blocked on authenticated project membership/RLS,
  explicit scope, and negative cross-project proof.
- SEC-004's generic compatibility `select` and fallback-manifest description is
  historical. That generic path was removed. The intentional fixed-table
  managed adapters do not accept arbitrary paths, methods, fields, or bodies,
  but they also do not narrow the underlying credential; the residual risk is
  tracked by SEC-001.
- For `meetings_documents`, the managed Data Query identity saw zero rows while
  the existing semantic identity saw 36 chunks across 11 meeting/project keys.
  This visibility split is an access-contract fact, not proof that SEC-006 or
  project authorization is repaired.
- The existing semantic RPC's read-only health probe fails structurally because
  it references an absent meeting-key column while the live key is `source_id`.
  The temporary RPC-first application fallback runs only after structural
  400/404 responses, performs one bodyless fixed-table read capped at 500,
  accepts an unscoped result only when the complete set contains one project,
  validates source/project/attachment/chunk/vector shape, performs no adjacency
  expansion, and redacts identifiers, locators, embeddings, scores, content, and
  provider errors. It is compatibility behavior, not a database or authorization
  remediation.
- SEC-008 for `hybrid_match_meetings_documents` remains deferred. No RPC,
  function, schema, role, grant, permission, RLS policy, Auth/Supabase setting,
  row, or saved selection changed in Phase 4D.

Phase 4F is closed locally. Its fixed credential-gated `exceptions_report`
adapter narrows agent behavior but does not remediate SEC-001 or the managed
identity's broader native table reachability. The exact same-record evidence
handoff requires exception/project/attachment attestation and exposes none of
those identifiers to the client or workflow. No schema, role, grant, permission,
RLS, Auth/Supabase setting, or production authorization boundary changed.
Phase 4G is the next unauthorized approval gate and has not started.

## Safety rules for future remediation

- Do not enable RLS or revoke grants blindly on production tables.
- Do not change all policies in one migration.
- Do not break the current team UI while isolating the Data Query service identity.
- Do not expose service-role keys, service passwords, access tokens, or refresh tokens in tests, logs, screenshots, or committed files.
- Do not claim an issue is fixed until both the intended request and negative unauthorized requests are verified.
