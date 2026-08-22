-- Safe rollback for Contracts R6 Phase 4A.
--
-- The additive target columns and their backfilled values are intentionally
-- retained. This rollback removes synchronization and product-facing surfaces
-- without deleting copied data or changing legacy Contracts fields.

begin;

do $rollback_guard$
begin
  if to_regclass('private.contracts_documents_product_r6_v1') is null
     or to_regclass('private.contracts_product_r6_v1') is null
     or to_regprocedure('public.bidoc_contracts_r6_phase4a_status_v1()') is null then
    raise exception using
      errcode = '55000',
      message = 'Contracts R6 Phase 4A rollback refused because the installed projection is incomplete';
  end if;
end
$rollback_guard$;

lock table private.contracts_documents, private.contracts in access exclusive mode;

drop view private.contracts_documents_product_r6_v1;
drop view private.contracts_product_r6_v1;

drop trigger if exists bidoc_contracts_refresh_chunk_total_r6_4a
on private.contracts_documents;
drop trigger if exists bidoc_contracts_project_document_r6_4a
on private.contracts_documents;
drop trigger if exists bidoc_contracts_project_decision_r6_4a
on private.contracts;

alter table private.contracts_documents
  drop constraint if exists contracts_documents_target_project_r6_4a_check,
  drop constraint if exists contracts_documents_target_attachment_r6_4a_check,
  drop constraint if exists contracts_documents_target_metadata_r6_4a_check,
  drop constraint if exists contracts_documents_target_chunk_r6_4a_check,
  alter column project_id drop not null,
  alter column attachment_id drop not null,
  alter column chunk_index drop not null;

alter table private.contracts
  drop constraint if exists contracts_target_project_r6_4a_check,
  drop constraint if exists contracts_target_source_r6_4a_check,
  drop constraint if exists contracts_target_content_r6_4a_check,
  drop constraint if exists contracts_target_metadata_r6_4a_check,
  drop constraint if exists contracts_target_hashtags_r6_4a_check,
  drop constraint if exists contracts_target_category_r6_4a_check,
  drop constraint if exists contracts_target_timing_r6_4a_check,
  drop constraint if exists contracts_target_trigger_r6_4a_check,
  drop constraint if exists contracts_target_review_reason_r6_4a_check,
  drop constraint if exists contracts_target_source_document_r6_4a_fk,
  alter column project_id drop not null,
  alter column source_document_id drop not null,
  alter column content drop not null,
  alter column hashtags drop not null,
  alter column category_he drop not null;

drop function public.bidoc_contracts_r6_phase4a_status_v1();
drop function private.bidoc_contracts_refresh_chunk_total_r6_4a();
drop function private.bidoc_contracts_project_document_r6_4a();
drop function private.bidoc_contracts_project_decision_r6_4a();
drop function private.bidoc_contracts_document_metadata_r6_4a(private.contracts_documents,private.contract_workspaces);
drop function private.bidoc_contracts_decision_metadata_r6_4a(private.contracts);
drop function private.bidoc_contracts_timing_r6_4a(private.contracts);
drop function private.bidoc_contracts_approved_trigger_r6_4a(text);
drop function private.bidoc_contracts_approved_hashtags_r6_4a(text[]);
drop function private.bidoc_contracts_all_hebrew_tags_r6_4a(text[]);
drop function private.bidoc_contracts_review_status_he_r6_4a(text);
drop function private.bidoc_contracts_category_he_r6_4a(text);

comment on column private.contracts_documents.attachment_id is null;
comment on column private.contracts_documents.metadata is null;
comment on column private.contracts.metadata is null;
comment on column private.contracts.category_he is null;
comment on column private.contracts.timing is null;
comment on column private.contracts.trigger_he is null;

commit;
