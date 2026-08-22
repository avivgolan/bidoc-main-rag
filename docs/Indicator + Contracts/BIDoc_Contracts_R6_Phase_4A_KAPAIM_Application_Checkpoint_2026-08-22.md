# BIDoc Contracts R6 Phase 4A - KAPAIM Application Checkpoint

Date: 2026-08-22
Status: applied to KAPAIM and accepted

## Applied Scope

The additive Phase 4A target projection migration was applied to KAPAIM project
`smxibuaowzuxkznuouwj`. Supabase recorded it as:

- Version: `20260822080954`
- Name: `contracts_r6_phase4a_target_projection`
- Repository source: `supabase/migrations/20260822003639_contracts_r6_phase4a_target_projection.sql`
- Source SHA-256: `2780F22C16B9745692FF79D45CA9EC04ECAD2965410868F10A78E39332D9C044`

This step did not delete rows or legacy columns, regenerate embeddings, change the
Contracts UI/API reader, write to Indicator or Schedule, deploy the application,
or create a Git commit.

## Preflight

- KAPAIM status: `ACTIVE_HEALTHY`, PostgreSQL 17.
- Existing clause rows: 313.
- Existing decision revisions: 421.
- Both Phase 4A product views were absent before application.
- The prepared migration contained no table drop, truncate, row delete, or column drop.

## Acceptance Result

The exact repository acceptance script
`supabase/tests/contracts-r6-phase4a-target-projection.sql` passed after application.

- Product clause rows: 313.
- Product latest-decision rows: 235.
- Clause rows with stored embeddings: 124.
- Latest decisions with stored embeddings: 98.
- Historical latest decisions still missing embeddings: 137.
- Historical trigger values retained only in technical metadata: 15.

The 137 missing historical decision embeddings and 15 legacy trigger values are
reported migration debt, not Phase 4A acceptance failures. Phase 4A preserves the
original technical values and does not invent Hebrew translations.

## Fresh Contract Verification

Workspace `4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa` was queried through both new
product views after migration.

- Product clause rows: 124.
- Clause vectors with 3072 dimensions: 124.
- Incomplete clause projection rows: 0.
- Invalid clause tags: 0.
- Product latest-decision rows: 98.
- Decision vectors with 3072 dimensions: 98.
- Incomplete decision projection rows: 0.
- Invalid decision tags: 0.
- Invalid decision triggers: 0.
- Review statuses: 51 `מאושר`, 47 `מוצע`.
- Indicator suitability: 98 `נדרשת_בדיקה`.

## Advisor Result

Supabase security and performance advisors reported no finding whose object or
detail belongs to the Phase 4A views, functions, or triggers. The project-wide
advisor output still contains older findings for unrelated tables and functions;
those were not changed in this phase.

## Stop Gate

Phase 4A application and acceptance are complete. The next database mutation is
a separately approved historical embedding backfill for the 137 current decisions
that still have no vector. No backfill has been started by this checkpoint.
