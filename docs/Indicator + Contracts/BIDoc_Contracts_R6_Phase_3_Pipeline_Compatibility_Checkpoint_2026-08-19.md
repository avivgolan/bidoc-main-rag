# BIDoc Contracts R6 - Phase 3 Pipeline Compatibility Checkpoint

Date: 2026-08-19

Status: implementation prepared and source-validated. KAPAIM has not been changed by this phase yet.

## Delivered

Phase 3 connects the approved Phase 2 database foundation to the two existing Contracts agents without changing the current Contracts tab or writing to Schedule.

| Concern | R6 behavior |
| --- | --- |
| Clause tags | The server reads active values from `private.contract_tag_catalog`. The model may select only those Hebrew values, and KAPAIM validates them again at persistence. |
| Decision triggers | The server reads active values from `private.contract_trigger_catalog`. The model may use an empty trigger or one exact Hebrew catalog value; KAPAIM validates it again. |
| Model routing | Clause enrichment and decision normalization use `models.lite` when R6 is enabled. Relationship discovery is unchanged. |
| Embeddings | The server creates 3072-dimension embeddings only for source and decision rows in the active workspace after persistence/review. An input hash prevents rewriting an unchanged vector. |
| Indicator classification | The existing legacy `schedule_impact` value is mapped compatibly to `indicator_suitability`: `yes` -> `מתאים`, `no` -> `לא_מתאים`, otherwise `נדרשת_בדיקה`. No schedule action occurs. |

The new migration is:

`supabase/migrations/20260819202649_contracts_r6_phase3_pipeline.sql`

It adds technical `embedding_input_sha256` columns and service-role-only RPCs. It does not remove old fields or data. The existing R3/R4 response shapes stay intact.

## Activation Order

1. Apply the Phase 3 migration in the KAPAIM Supabase SQL Editor.
2. Deploy the server code containing this phase.
3. Set `CONTRACTS_R6_PHASE3_APPROVED=TRUE` only in the server environment.
4. Upload/process one new test contract and complete one decision review.
5. Run the verification queries below.

Do not expose this flag, the KAPAIM service key, or any service-role key to browser variables.

The flag defaults to disabled. Before it is enabled, legacy behavior remains available, so an incomplete deployment cannot silently select Hebrew catalog values against an older database schema.

## Verification

After a new R6 contract run and a decision review, run:

```sql
select
  count(*) filter (where embedding is not null) as document_embeddings,
  count(*) filter (where embedding_input_sha256 is not null) as document_embedding_hashes,
  count(*) filter (where exists (
    select 1 from unnest(hashtags) tag
    where not exists (
      select 1 from private.contract_tag_catalog catalog
      where catalog.tag_he = tag and catalog.active
    )
  )) as documents_with_invalid_tags
from private.contracts_documents;

select
  count(*) filter (where embedding is not null) as decision_embeddings,
  count(*) filter (where embedding_input_sha256 is not null) as decision_embedding_hashes,
  count(*) filter (where trigger_kind is not null and not exists (
    select 1 from private.contract_trigger_catalog catalog
    where catalog.trigger_he = contracts.trigger_kind and catalog.active
  )) as decisions_with_invalid_triggers,
  count(*) filter (where indicator_suitability not in ('מתאים', 'לא_מתאים', 'נדרשת_בדיקה')) as invalid_indicator_suitability
from private.contracts;
```

For the newly processed R6 workspace, the embedding counts should be positive and both invalid-value counts must be `0`. Historical rows are not bulk-rewritten by this phase.

## Verification Evidence

Completed locally:

- `node --check` passed for the changed Contracts modules and focused test file.
- `npm.cmd run test:contracts` passed: 151/151 tests.
- Focused tests cover Hebrew catalog delivery, `models.lite` selection, 3072-dimension embedding handoff, server-only RPC calls, and no Schedule write in the migration.

Not run locally:

- Local PostgreSQL migration execution, because Docker Desktop is not running and the dedicated local Supabase container is unavailable.
- KAPAIM migration apply, server deployment, feature-flag activation, and live model embedding calls. These remain manual Phase 3 verification steps.

## Phase Gate

Do not start the UI wording/field-cleanup phase until the manual migration, deployment, one live R6 workspace run, and the verification query are confirmed.
