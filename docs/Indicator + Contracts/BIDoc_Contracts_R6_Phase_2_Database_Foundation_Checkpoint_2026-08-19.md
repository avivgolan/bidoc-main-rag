# BIDoc Contracts R6 - Phase 2 Database Foundation Checkpoint

Date: 2026-08-19

Status: implementation prepared and locally source-validated. KAPAIM production has not been mutated by this task.

## Delivered

The additive SQL migration is:

`supabase/migrations/20260819195943_contracts_r6_phase2_foundation.sql`

It makes no Schedule write, does not change existing Contracts RPCs, does not remove legacy columns, and does not change the Contracts tab.

It adds:

| Item | Target |
| --- | --- |
| Source embeddings | Nullable `embedding public.vector` on `private.contracts_documents`. |
| Reviewed-decision embeddings | Nullable `embedding public.vector` on `private.contracts`. |
| Vector search | One 3072-dimension HNSW `halfvec` cosine index per embedding column, using the approved Meetings pattern. |
| Indicator classification | Additive non-null `private.contracts.indicator_suitability`, defaulting to `נדרשת_בדיקה`. |
| Shared tag dictionary | Private RLS-protected `private.contract_tag_catalog`. |
| Trigger dictionary | Private RLS-protected `private.contract_trigger_catalog`. |

## Read-only KAPAIM Tag Audit

The confirmed shared source is `public.data_index`, not the stale local default `data_index_embeddings_gf_dor_agent`.

| Result | Value |
| --- | --- |
| Indexed rows scanned | 2,610 |
| Distinct hashtags | 251 |
| Hebrew hashtags | 251 |
| Non-Hebrew hashtags | 0 |

The migration seeds the tag catalog directly from `public.data_index.hashtags`. It normalizes a leading `#`, rejects English values, and preserves the existing Hebrew vocabulary. It never writes to `public.data_index`.

The trigger catalog starts with eight approved Hebrew trigger names and can be curated later without changing agent code.

## Security and Compatibility

- Both new catalogs remain in the unexposed `private` schema.
- RLS is enabled and forced on both catalogs.
- Only `service_role` receives catalog privileges.
- Existing Contracts rows gain only nullable embeddings and the additive suitability default.
- Current `schedule_project_id`, `projection_status`, `schedule_impact`, and existing RPC contracts are unchanged in this phase.
- No production secret was displayed, copied, or moved to client-side configuration.

## Verification

Completed:

- `node --check scripts/test-contracts-r6-phase2-db.mjs`
- `package.json` JSON validation
- static migration guard: no `SECURITY DEFINER`, no Schedule-table reference, private catalogs present, and both HNSW indexes present
- `npm.cmd run test:contracts -- --filter "^contracts R5"`: 148/148 Contracts tests passed

Prepared but blocked locally:

- `npm.cmd run test:contracts:r6-phase2-db`

The test correctly refused to reset its dedicated local container because Docker Desktop is stopped and `supabase_db_bidoc-main-rag` is unavailable. No local database was changed.

## Manual KAPAIM Apply and Read-only Verification

Repository policy requires the developer to run the migration manually in Supabase Dashboard SQL Editor. Run the migration file above against KAPAIM, then run this read-only verification query:

```sql
select
  to_regtype('public.vector') as vector_type,
  to_regtype('public.halfvec') as halfvec_type,
  (select count(*) from private.contract_tag_catalog) as tag_count,
  (select count(*) from private.contract_trigger_catalog where active) as active_trigger_count,
  (select count(*) from private.contracts where indicator_suitability = 'נדרשת_בדיקה') as defaulted_decision_count;

select indexname
from pg_indexes
where schemaname = 'private'
  and indexname in (
    'contracts_documents_embedding_hnsw_r6_idx',
    'contracts_embedding_hnsw_r6_idx'
  )
order by indexname;
```

Expected result:

- both pgvector types are present;
- `tag_count = 251` unless the source vocabulary changed between audit and apply;
- `active_trigger_count = 8`;
- both named indexes exist;
- no Schedule table is changed.

## Phase Gate

Do not start Phase 3 until the manual KAPAIM apply and read-only verification results are confirmed. Phase 3 will then change Contracts persistence to use the Hebrew catalogs, create embeddings, and use the lite model while preserving current API compatibility.
