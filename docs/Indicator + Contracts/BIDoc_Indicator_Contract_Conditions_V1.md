# Indicator Contract Conditions V1

## Outcome

Reviewed relative contractual decisions can now enter the existing
`schedule_contract_conditions` waiting pool without receiving a fabricated due
date. Indicator owns synchronization; Schedule owns trigger discovery and the
deterministic calendar calculation.

## Runtime flow

1. A decision is approved/corrected, has `scheduleImpact=yes`, a cleared
   conflict, and a complete relative trigger/offset.
2. Indicator resolves the active MAIN-to-Schedule project mapping and atomically
   upserts one pending condition per immutable decision revision.
3. At an operational Schedule sweep, structured Gantt tasks are checked first,
   then reviewed `schedule_observed_events`, then the existing project-scoped
   RAG path.
4. Verified trigger evidence is persisted even when the working calendar is not
   complete. A milestone is created only after deterministic calculation.
5. Contract corrections dismiss superseded pending rows; resolved history is
   retained.

## Runtime availability

- Migration: `20260819113955_indicator_contract_conditions_v1.sql`.
- The integration is active whenever the migration is installed; it does not
  depend on an environment feature flag. Project mapping is required for reads
  as well as writes so every runtime resolves the same `project_id`.
- Dry run: `GET /api/indicator/contracts/workspaces/:workspaceId/status`.
- Controlled apply/retry: `POST /api/indicator/contracts/workspaces/:workspaceId/reconcile`.
- Source documents are opened through an authenticated server route that emits
  a private Storage signed URL valid for at most 60 seconds.

## Safety gates

- All RPCs are `SECURITY INVOKER`, explicitly require `service_role`, and revoke
  execution from `public`, `anon`, and `authenticated`.
- No browser-supplied database URL, key, project placement, decision fields, or
  calculated date is trusted.
- `working_days` resolution fails closed unless `holidays_through` covers the
  computed due date.
- The Schedule Engine formulas and Contracts append-only truth are unchanged.
