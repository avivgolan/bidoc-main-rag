---
note_type: decisions-index
project: bidoc agent
status: active
last_updated: 2026-08-08
tags:
  - bedrock
  - decision
---

# Decisions

## Purpose

Architectural and process decisions that affect this project.

## Current State

- The existing Schedule Engine and Calendar are the canonical calculation baseline for Contracts and Indicators. Necessary, regression-tested integration extensions are allowed; parallel or duplicate schedule arithmetic is prohibited.
- The eight existing KAPAIM `schedule_*` tables are canonical and must be reused; zero DDL is the default.
- Contracts Agent Phase 1 dry-run is accepted. Phase 2 schema, mapping, transport, review UI, and rejection-only live audit closure are complete. The first real target-row promotion remains deferred to an eligible reviewed fact; it must reuse the existing Schedule ingestion and engine.

## Recent Changes

- 2026-08-11 - Split rejection-only audit persistence from operational Schedule promotion. A dedicated backend route may store only a complete all-rejected review and must produce zero Schedule rows; the promotion route now refuses such batches. Server activation and any live write remain separate explicit gates.
- 2026-08-10 - Completed the local Phase 2 migration/apply package without changing Supabase. Audit/mapping storage is proposed in a non-exposed private schema; the public function is `SECURITY INVOKER`, uses an empty `search_path`, and is server-role-only; the writer requires commit plus migration-apply approval. Database compilation and apply remain separate gates.
- 2026-08-10 - Recorded CTO approval of D2-01 through D2-04. The approved direction is an additive MAIN-to-KAPAIM mapping, append-oriented audit storage, one atomic PostgreSQL promotion RPC, and backend-only execution with no anon/authenticated direct writes. This is architecture approval, not permission to apply DDL.
- 2026-08-10 - Recorded the Phase 2 schema-reuse gate: existing Schedule tables are reused, but no writer is authorized because cross-database project identity, immutable review state, atomicity, and permissions are unresolved. The planner must remain pure and fail closed until all five gate approvals are explicit.
- 2026-08-10 - Accepted Contracts Agent Phase 1 after the final live gold evaluation passed all unchanged hard gates and quality thresholds within the global budget; recorded the redacted accepted artifact and preserved the separate Phase 2 approval boundary.
- 2026-08-08 - Recorded the CTO's protected Schedule baseline, existing-table reuse lock, and phase-gated Contracts Agent boundary.
- 2026-08-10 - Recorded the CTO clarification that Schedule Engine files are not immutable. Contracts/Indicator work may build on and modify the existing Engine when required, provided existing logic is reused, unchanged behavior is regression-protected, and no parallel calculation engine is created.
- 2026-05-08 - Created decision log.

## Decisions

- 2026-08-08 - Preserve `src/scheduleEngine.js`, `src/scheduleCalendar.js`, and existing Schedule semantics. Contracts work integrates additively; any behavioral change requires a separate bounded approval.
- 2026-08-08 - Reuse `schedule_calendars`, `schedule_contract_milestones`, `schedule_contract_extensions`, `schedule_contract_conditions`, `schedule_indicator_snapshots`, `schedule_alerts`, `schedule_activity_map`, and `schedule_observed_events`. Do not create duplicate-purpose tables or execute unapproved DDL.
- 2026-08-08 - Phase 1 may extract evidence-backed candidates only after the Phase 0 checkpoint is approved. It performs no operational database writes, Schedule arithmetic, or conflict resolution.
- 2026-08-10 - Phase 1 is accepted as local authenticated dry-run only. Thirty-two focused tests, six exact canonical representative cases, 47 Schedule tests, the React build, dependency audit, and the final real-contract gold evaluation pass. Compiler safety gates and thresholds remain unchanged. Phase 2 persistence and promotion require a separate approved slice.
- 2026-08-10 - Phase 2 may prepare table-compatible payloads only through the pure planner. No operational write may occur unless schema reuse, project namespace, immutable review/audit persistence, atomic promotion, and the permission model are all explicitly approved.
- 2026-08-10 - The CTO approved D2-01 through D2-04 as recommended: a bounded additive project mapping; separate immutable audit persistence; one transactional PostgreSQL promotion RPC; and backend-only least-privilege execution. The exact SQL, tests, permission diff, rollback plan, and live application still require a separate apply approval.
- 2026-08-10 - The local exact package is ready for the apply gate: four additive private tables, one atomic invoker RPC, a fail-closed backend transport, and rollback/test documentation. It must not be applied to KAPAIM until it compiles and passes isolated database/RLS/advisor tests.
- 2026-08-10 - The isolated Phase 2 database gate now passes and the authenticated reviewer workflow is implemented. Promotion remains fail closed until the official migration and reviewed MAIN-to-KAPAIM mapping are explicitly applied and verified remotely, after which only the server-side apply flag may enable commit.
- 2026-08-10 - The approved KAPAIM schema/mapping apply is complete. Remote verification found and removed legacy non-read browser privileges and added the missing mapping-FK index. Exactly one approved mapping is active; no contract fact was promoted. Activation, a reviewed live promotion, and deployment remain separate explicit gates.
- 2026-08-11 - A complete rejection-only Contracts batch is audit evidence, not a blocked promotion. It must use `/api/contracts/review/save`, remain all-rejected, and persist zero Schedule target rows; `/api/contracts/review/commit` is reserved for transaction-ready approved facts.
- 2026-08-11 - Phase 2 is closed for the reviewed Herzliya sample with one live `review_only` batch, 12 rejected decisions, one `reviewed_no_promotion` attempt, and zero Schedule target rows. Do not manufacture an approval to force an end-to-end write; the first real promotion and ingestion proof waits for a genuinely eligible fact and is a separate checkpoint.

## Open Questions

- Which future reviewed contract fact will first satisfy trigger, calendar, project-binding, conflict, and target-table requirements for the separate real-promotion checkpoint?
