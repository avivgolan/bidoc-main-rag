# Data Query Agent - Phase 3.1 managed authentication

Status: local Phase 3.1 RPC claim-gate acceptance completed on 2026-07-23. Later security findings are tracked separately and deferred by product decision.

## Deferred security follow-up - 2026-07-24

A later read-only audit identified credential-boundary and broader project-security issues beyond the Phase 3.1 RPC claim-gate proof. The findings, evidence, and deferred remediation order are maintained in `docs/data-query-agent-deferred-security-register.md`. This document retains the Phase 3.1 functional behavior and verification record.

## Decision

Phase 3.1 replaces the manually minted, long-lived custom-role JWT with a dedicated Supabase Auth service account.

Supabase Auth keeps its native `role=authenticated` claim. The service identity is stored in admin-controlled JWT application metadata:

```json
{
  "data_query_role": "bidoc_data_query"
}
```

The exact analytics RPC is now a `SECURITY DEFINER` wrapper that checks this immutable claim before calling the Phase 2 implementation. The implementation remains fixed to `public.data_index`, validates every operation, field, operator, metric, and limit, and accepts no raw SQL.

This avoids rotating or exporting the project's managed ECC P-256 signing key. It also avoids a permanent database password.

## Database boundary

After applying `supabase/data-query-phase3-1-service-account.sql`:

- `bidoc_data_query` remains `NOLOGIN`, `NOINHERIT`, and `NOBYPASSRLS`;
- the role has no direct table or sequence privileges;
- the guarded wrapper is the intended Data Query RPC callable by the managed `authenticated` service token;
- the unguarded implementation function is not callable by API roles;
- three pre-existing `SECURITY DEFINER` functions no longer grant implicit execution through `PUBLIC`;
- their existing explicit `anon`, `authenticated`, and `service_role` permissions remain unchanged.

These statements describe the wrapper and the `bidoc_data_query` database role. They do not remove the native `authenticated` role's separate table privileges, as recorded in the Phase 4A.0 correction.

The legacy `DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN` route remains a temporary compatibility fallback. New deployments should use the managed service-account variables.

## Runtime variables

Add these only to server-side `.env.local` and the production deployment:

```dotenv
CONTENT_SUPABASE_URL=https://YOUR_CONTENT_PROJECT_REF.supabase.co
CONTENT_SUPABASE_SERVICE_ROLE_KEY=YOUR_CONTENT_PROJECT_SERVER_KEY
DATA_QUERY_SUPABASE_SERVICE_EMAIL=data-query-agent@your-private-domain.example
DATA_QUERY_SUPABASE_SERVICE_PASSWORD=GENERATE_A_LONG_RANDOM_PASSWORD
```

The Content values must be explicit. Data Query refuses to fall back to the App/MAIN Supabase project. Never put the service-account password, access token, refresh token, or server API key in browser settings.

The runtime signs in with the password once, validates the returned JWT claims, caches the short-lived access token in process memory, refreshes it before expiry, and falls back to password sign-in only when refresh fails. Tokens and passwords are never returned through public settings.

## Provisioning

1. Generate a unique service-account email and a long random password in a password manager.
2. Add both variables above to `.env.local`.
3. Run:

```powershell
npm.cmd run data-query:provision
```

The command creates or updates exactly that Supabase Auth user, confirms the email administratively, and assigns `app_metadata.data_query_role=bidoc_data_query`. It does not print the password or any token.

Restart the server after changing `.env.local`.

## Verification gate

Run the focused automated suite first:

```powershell
npm.cmd test
```

Then start the server:

```powershell
npm.cmd run dev
```

Use the configured `BIDOC_API_SECRET` for an authenticated call:

```powershell
$headers = @{ "X-Bidoc-Api-Secret" = $env:BIDOC_API_SECRET }
$body = @{
  question = "How many indexed records are there?"
  context = @{
    source = "api"
    runId = "phase3_1_smoke"
    callerNodeId = "manual_smoke"
  }
  requestedMetrics = @("records_total")
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Uri "http://localhost:4000/api/subagents/data-query" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

Acceptance requires HTTP 200, `contractVersion=data-query.v2`, a successful exact plan, and a numeric `machineResult.metricsByRequestId.records_total` value.

Negative proof is also required: a normal authenticated user without `app_metadata.data_query_role=bidoc_data_query` must receive a database permission error from the RPC.

## Live verification - 2026-07-23

- migration `data_query_phase3_1_service_account` applied successfully to Kapaim;
- all 35 focused Data Query tests pass; the full repository suite retains the same 11 unrelated UI/static-contract failures;
- `bidoc_data_query` is `NOLOGIN`, `NOINHERIT`, non-superuser, non-replication, `NOBYPASSRLS`, with connection limit 3;
- the role cannot select `public.data_index`;
- `authenticated` can execute the wrapper but cannot execute the implementation;
- the guarded exact count returned 1,248 live rows;
- the same call with an ordinary authenticated claim and no service marker failed with PostgreSQL `42501`;
- the three audited pre-existing `SECURITY DEFINER` functions are no longer executable through `PUBLIC`, while their explicit application-role grants remain;
- the security advisor's one Phase 3.1 warning is the intentionally authenticated-executable wrapper; its claim gate and negative authorization proof are part of the acceptance contract.
- Phase 3.1 changed the first fallback entry to canonical `data_index` instead of the unrelated hybrid-search embedding table; Phase 4A.0 later found two additional non-exact fallback manifest entries and an allowlist regression-test gap;
- the local authenticated HTTP probe reaches `data-query.v2` and fails closed specifically on the two missing managed service-account variables.
- the service-account values are now present locally, but the Content connection audit found `usesAppSupabase=true` and project `pmdnmzuqbcnzgkuhpfnx` (MAIN), not Kapaim `smxibuaowzuxkznuouwj`;
- the mistakenly provisioned MAIN Auth user was immediately deleted and verified absent from both projects;
- provisioning and runtime authentication now fail closed whenever the Content connection falls back to App/MAIN;
- all 36 focused Data Query tests pass after adding the cross-project regression guard.
- the local runtime now resolves the explicit Kapaim host `smxibuaowzuxkznuouwj.supabase.co` with `usesAppSupabase=false`;
- provisioning created or updated the confirmed Kapaim Auth identity `data-query-agent@bidoc.internal` with `app_metadata.data_query_role=bidoc_data_query`;
- an authenticated natural-language request used the live LLM planner and returned `data-query.v2`, an exact `data_index` count of 1,248, and no warnings;
- a deterministic repeat within the same run returned the same exact count and `cacheHit=true`;
- missing and incorrect `X-Bidoc-Api-Secret` values returned HTTP `401`;
- a semantic or citation question returned `needs_clarification`, routed to `delay_claim`, and executed no plan;
- a supplied `auth.users` plan returned HTTP `400` and executed no plan;
- the full repository suite still has 11 unrelated UI/static-contract failures, while all 36 Data Query tests pass.

## Current continuation point

The Phase 3.1 wrapper and local positive/negative RPC smoke are complete. Deferred security work is tracked in `docs/data-query-agent-deferred-security-register.md`. Functional Phase 4A can continue locally; any deployment, migration, or live database change still requires explicit approval. Do not reuse the MAIN project key or expose any secret through browser settings.
