begin;

drop view if exists private.contracts_workspace_parity_r6_v1;
drop function if exists public.bidoc_contracts_r6_embedding_work_v2(uuid);

-- Hebrew tag normalization and generated embeddings are valid product data and
-- are intentionally retained. Original historical tags remain in metadata.

commit;
