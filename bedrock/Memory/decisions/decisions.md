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

- The existing Schedule Engine and Calendar behavior are protected for Contracts Agent work.
- The eight existing KAPAIM `schedule_*` tables are canonical and must be reused; zero DDL is the default.
- Contracts Agent Phase 1 is dry-run/no-persistence only and remains gated on Phase 0 approval.

## Recent Changes

- 2026-08-08 - Recorded the CTO's protected Schedule baseline, existing-table reuse lock, and phase-gated Contracts Agent boundary.
- 2026-05-08 - Created decision log.

## Decisions

- 2026-08-08 - Preserve `src/scheduleEngine.js`, `src/scheduleCalendar.js`, and existing Schedule semantics. Contracts work integrates additively; any behavioral change requires a separate bounded approval.
- 2026-08-08 - Reuse `schedule_calendars`, `schedule_contract_milestones`, `schedule_contract_extensions`, `schedule_contract_conditions`, `schedule_indicator_snapshots`, `schedule_alerts`, `schedule_activity_map`, and `schedule_observed_events`. Do not create duplicate-purpose tables or execute unapproved DDL.
- 2026-08-08 - Phase 1 may extract evidence-backed candidates only after the Phase 0 checkpoint is approved. It performs no operational database writes, Schedule arithmetic, or conflict resolution.

## Open Questions

- Which approved read-only catalog path will verify live constraints, indexes, RLS, policies, grants, and ownership before Phase 2?
- Where will immutable document authority, reviewer decisions, and conflict history live if no existing table safely owns them?
