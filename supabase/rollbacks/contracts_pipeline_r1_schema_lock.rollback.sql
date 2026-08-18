-- Local/manual rollback for BIDoc Contracts Pipeline R1.
-- Refuses to remove R1-owned data. Run only before R1 data is created or after
-- an explicitly approved export/retention plan.

do $$
begin
  if exists (select 1 from private.contracts_documents limit 1)
     or exists (select 1 from private.contracts limit 1)
     or exists (select 1 from private.contract_relationships limit 1)
     or exists (
       select 1
       from private.contract_workspaces
       where workspace_version = 'contracts-workspace.r1.v1'
       limit 1
     ) then
    raise exception using
      errcode = '55000',
      message = 'R1 rollback refused because R1-owned data exists';
  end if;
end;
$$;

drop function if exists public.bidoc_contracts_append_relationship_r1(integer,jsonb);
drop function if exists public.bidoc_contracts_append_decision_r1(integer,jsonb);
drop function if exists public.bidoc_contracts_insert_clause_r1(jsonb);
drop function if exists public.bidoc_contracts_upsert_workspace_r1(jsonb);
drop function if exists public.bidoc_contracts_schema_status_r1();

drop table if exists private.contract_relationships;
drop table if exists private.contracts;
drop table if exists private.contracts_documents;

drop function if exists private.bidoc_contracts_append_only_guard_r1();
drop function if exists private.bidoc_contracts_relationship_revision_guard_r1();
drop function if exists private.bidoc_contracts_decision_revision_guard_r1();
drop function if exists private.bidoc_contracts_document_guard_r1();
drop function if exists private.bidoc_contracts_relationship_key_r1(text,text,text,uuid,uuid,uuid,uuid);
drop function if exists private.bidoc_contracts_endpoint_token_r1(uuid,uuid);
drop function if exists private.bidoc_contracts_index_ref_valid_r1(jsonb);
drop function if exists private.bidoc_contracts_relationship_evidence_valid_r1(jsonb);
drop function if exists private.bidoc_contracts_source_evidence_valid_r1(jsonb);
drop function if exists private.bidoc_contracts_raw_data_valid_r1(jsonb);

drop index if exists private.contract_workspaces_r1_generation_idx;
drop index if exists private.contract_workspaces_r1_document_fingerprint_key;

alter table private.contract_workspaces
  drop constraint if exists contract_workspaces_r1_scope_key,
  drop constraint if exists contract_workspaces_version_shape,
  drop constraint if exists contract_workspaces_candidate_count_matches,
  drop constraint if exists contract_workspaces_workspace_version_check;

alter table private.contract_workspaces
  drop column if exists extraction_fingerprint_input,
  drop column if exists extractor_version,
  drop column if exists prompt_version,
  drop column if exists parser_version,
  drop column if exists parser_generation_id,
  alter column schedule_project_id set not null;

alter table private.contract_workspaces
  add constraint contract_workspaces_workspace_version_check
    check (workspace_version = 'contracts-workspace.phase3f1.v1'),
  add constraint contract_workspaces_candidate_count_matches
    check (
      jsonb_typeof(extraction_json -> 'candidates') = 'array'
      and jsonb_array_length(extraction_json -> 'candidates') = candidate_count
    );

create or replace function private.bidoc_contract_workspace_extraction_is_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.workspace_version is distinct from old.workspace_version
     or new.source_project_id is distinct from old.source_project_id
     or new.schedule_project_id is distinct from old.schedule_project_id
     or new.project_site is distinct from old.project_site
     or new.document_version_id is distinct from old.document_version_id
     or new.document_sha256 is distinct from old.document_sha256
     or new.filename is distinct from old.filename
     or new.media_type is distinct from old.media_type
     or new.byte_count is distinct from old.byte_count
     or new.storage_bucket is distinct from old.storage_bucket
     or new.storage_object_key is distinct from old.storage_object_key
     or new.extraction_fingerprint is distinct from old.extraction_fingerprint
     or new.extraction_schema_version is distinct from old.extraction_schema_version
     or new.extraction_version is distinct from old.extraction_version
     or new.extraction_json is distinct from old.extraction_json
     or new.candidate_count is distinct from old.candidate_count
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '55000',
      message = 'Saved contract extraction and source identity are immutable';
  end if;
  return new;
end;
$$;

revoke execute on function private.bidoc_contract_workspace_extraction_is_immutable()
from public, anon, authenticated, service_role;
