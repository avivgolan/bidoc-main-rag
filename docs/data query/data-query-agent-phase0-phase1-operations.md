# Data Query Agent — Phase 0 + 1 operations

Status: implemented in code and applied to the Kapaim Content Supabase project on 2026-07-22.

## Canonical runtime

The only supported runtime is:

1. user question;
2. LLM or deterministic planner produces typed Query Plan JSON;
3. server validates Content-only schema, table, fields, operation, row limit, and forbidden SQL text;
4. server calls a fixed-table, structured-parameter analytics RPC for approved exact operations;
5. server normalizes exactness, cardinality, deterministic metrics, and provenance;
6. bounded PostgREST row retrieval remains only for the compatibility `select` operation;
7. workflow history stores structure and field names, not source row or raw filter values.

The model-generated SQL pipeline, step endpoint, pipeline endpoint, browser runner, and schema-scan endpoint are retired. The `public.exec_read_sql(text, integer)` function was removed from Kapaim.

Phase 2 exact analytics for `public.data_index` are documented in `docs/data-query-agent-phase2-correctness.md`. Unsupported tables or operations return `not_computable`; they do not fall back to capped local aggregation.

Phase 3 caller routing, scope, budget, run-cache, and `data-query.v2` machine-result rules are documented in `docs/data-query-agent-phase3-contract.md`.

Phase 3.1 supersedes the manually minted custom-role JWT with a managed Supabase Auth service account. Its current operator contract is `docs/data-query-agent-phase3-1-managed-auth.md`.

## Required server environment

```text
BIDOC_API_SECRET=<strong random server secret>
DATA_QUERY_SUPABASE_SERVICE_EMAIL=<dedicated private service-account email>
DATA_QUERY_SUPABASE_SERVICE_PASSWORD=<long unique random password>
```

`BIDOC_API_SECRET` is required for `POST /api/subagents/data-query`. If it is absent, the endpoint returns HTTP 503; an invalid `X-Bidoc-Api-Secret` returns HTTP 401.

The two Data Query service-account values authenticate a dedicated Supabase Auth user whose admin-controlled `app_metadata.data_query_role` is `bidoc_data_query`. Do not place any of these values in browser settings or committed files. The application intentionally fails closed if the managed credential is absent or incomplete.

The runtime exchanges the credential for a short-lived `authenticated` token, validates its application-metadata claim, caches it only in process memory, and refreshes it before expiry. The existing `DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN` variable is only a temporary compatibility fallback.

## Database boundary

The Phase 0 tracked SQL is `supabase/data-query-exec-read-sql.sql`. Phase 3.1 then applies `supabase/data-query-phase3-1-service-account.sql`, which tightens the final boundary to:

- role: `bidoc_data_query`, `NOLOGIN`, `NOINHERIT`;
- role membership: granted to PostgREST's `authenticator` role;
- schema: `USAGE` on `public`;
- tables and sequences: no direct privileges, including no raw `data_index` read;
- timeout: `statement_timeout=8s`;
- exact wrapper: executable only by `authenticated` and the legacy compatibility role, with an immutable claim check;
- exact implementation: not executable by API roles;
- writes: no table write privileges.

The Phase 2 exact implementation remains fixed to `public.data_index` and accepts no SQL or table-name input. The Phase 3.1 wrapper owns the table access and rejects tokens without the dedicated service-account claim.

When another Content table is approved, add a separate claim-gated, fixed-table wrapper and implementation in a reviewed migration. Updating the UI/settings allowlist alone does not grant database access.

## Deployment order

1. Apply the tracked database migration. This is already complete for Kapaim project `smxibuaowzuxkznuouwj`.
2. Set the managed service-account variables.
3. Run `npm.cmd run data-query:provision`.
4. Deploy the code.
5. Run the smoke request below and inspect its workflow record.

```powershell
$headers = @{ "X-Bidoc-Api-Secret" = $env:BIDOC_API_SECRET }
$body = @{ question = "How many records are there?" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/subagents/data-query" -Headers $headers -ContentType "application/json" -Body $body
```

## Verified on 2026-07-22

- `exec_read_sql` is absent.
- `authenticator` can assume `bidoc_data_query`.
- `bidoc_data_query` can select from `public.data_index`.
- The role cannot insert, update, or delete that table.
- The dedicated RLS policy exists.
- The role timeout is 8 seconds.
- A transaction running as the role successfully read `data_index`.
- The exact metrics RPC matched trusted SQL over all 1,248 live rows.
- A transactional 10,000-row gold fixture returned exact boundary counts and was fully rolled back.

## Remaining production gate

A live HTTP smoke test is intentionally blocked until the dedicated Auth user has been provisioned from the managed service-account variables. `BIDOC_API_SECRET` is already present locally. Do not substitute a service-role token as the Data Query bearer token.
