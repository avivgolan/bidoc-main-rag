# BIDoc Contracts Agent - Phase 3D Activity-Mapping Remote Apply Checkpoint

- Date: 2026-08-11
- Status: Complete; stopped before Phase 3E
- Target: KAPAIM / APP DATA (`smxibuaowzuxkznuouwj`)
- Applied migrations: `20260811170622` and `20260811171813`
- Data writes: DDL only; zero mapping, review-event, or Schedule target rows created
- API/UI/runtime/deployment: Unchanged

## Outcome

Phase 3D applied the Phase 3C activity-mapping database package to KAPAIM and verified it directly from the remote PostgreSQL catalogs. The primary migration succeeded. Remote advisors then identified that the project-mapping foreign key used two columns while its supporting index covered only the leading column. A separately approved, CLI-generated follow-up replaced that index with the full composite form and cleared the finding.

No mapping was manufactured for the rejected Herzliya contract. No RPC that writes mapping state was invoked. Phase 3E remains a separate approval gate.

## Applied migration history

| Version | Name | Purpose |
|---|---|---|
| `20260811170622` | `contracts_phase3_activity_mapping_review` | Hardens the existing map, adds immutable review history, and adds backend-only resolver/review RPCs |
| `20260811171813` | `contracts_phase3_cover_project_mapping_fk` | Replaces the leading-column FK index with `(project_mapping_id, project_id)` |

The local filenames are aligned exactly to the remote migration history.

## Pre-apply safety result

- KAPAIM was healthy on PostgreSQL 17.6.
- The three Phase 2 migrations were the latest pre-existing history.
- `schedule_activity_map` contained zero rows.
- All seven proposed map checks had zero violations.
- No duplicate confirmed-alias winner existed.
- No Phase 3 table, RPC, named constraint, or named index collided with an existing object.
- The one approved MAIN-to-KAPAIM route was active and matched the expected project UUIDs.
- Phase 2 audit counts were one review batch, twelve rejected decisions, and one zero-promotion attempt.
- Milestone, extension, and condition counts were all zero.

## Remote catalog verification

| Check | Result |
|---|---|
| Map constraints | Seven checks present and validated |
| Review-event constraints | Fourteen checks/FKs present and validated |
| Composite route uniqueness | `scpm_id_schedule_project_uniq` present and validated |
| Focused indexes | Nine planned indexes present |
| Composite FK coverage | `samre_project_mapping_fk_idx(project_mapping_id, project_id)` verified |
| Immutable event trigger | Present and enabled for `UPDATE OR DELETE` |
| RLS | Enabled on both `schedule_activity_map` and the private review-event table |
| Policies | Zero browser-facing policies on the private review-event table |
| Function security | Both RPCs are `SECURITY INVOKER`, have empty `search_path`, and enforce `service_role` |
| Function grants | `anon`, `authenticated`, and `PUBLIC` cannot execute; `service_role` can execute |
| Map grants | Browser roles have no access; `service_role` has only `SELECT`, `INSERT`, and `UPDATE` |
| Review-event grants | Browser roles have no access; `service_role` has only `SELECT` and `INSERT` |
| Resolver proof | Returned the one active approved MAIN-to-KAPAIM route under `service_role` |

## Advisor result

After the primary migration, the remote performance advisor reported one informational missing-covering-index finding for `samre_project_mapping_fk`. Migration `20260811171813` corrected it.

Final Phase 3 advisor state:

- zero Phase 3 security warnings or errors;
- zero Phase 3 performance warnings or errors;
- zero missing-FK findings for the review-event table;
- expected informational notices only for deny-by-default RLS tables with no policies and indexes with no traffic because the tables are empty.

Relevant remediation reference: [Supabase unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Data-preservation proof

Final live counts:

| Surface | Rows |
|---|---:|
| `schedule_activity_map` | 0 |
| `schedule_activity_mapping_review_events` | 0 |
| `schedule_contract_project_mappings` | 1 |
| `schedule_contract_review_batches` | 1 |
| `schedule_contract_review_decisions` | 12 |
| `schedule_contract_promotion_attempts` | 1 |
| `schedule_contract_milestones` | 0 |
| `schedule_contract_extensions` | 0 |
| `schedule_contract_conditions` | 0 |

## Local verification retained

- Phase 3 database behavior/security suite passed with 10 synthetic mapping rows, 6 immutable review events, and 8 confirmed winners.
- The suite applies both remote-aligned Phase 3 migrations and asserts the composite FK index definition.
- Local Supabase schema lint reported no errors.
- Local Supabase security/performance advisors reported no issues.
- The non-destructive operational rollback remains available and preserves mapping and audit data.

## Stop gate

Phase 3D is complete. Do not begin Phase 3E, add mapping API callers, create a real mapping, change Schedule ingestion or Engine behavior, connect indicators/alerts, enable an application flag, push, or deploy without the next explicit approval.
