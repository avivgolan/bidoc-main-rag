-- Index the review-batch mapping foreign key identified by the remote
-- Supabase performance advisor after the Phase 2 migration apply.

create index if not exists schedule_contract_review_batches_mapping_idx
  on private.schedule_contract_review_batches (mapping_id);
