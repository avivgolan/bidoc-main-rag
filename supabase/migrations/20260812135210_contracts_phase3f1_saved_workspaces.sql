-- BiDoc Contracts Agent Phase 3F.1: saved contract workspaces and mutable review drafts.
-- Target on separately approved apply only: APP DATA / KAPAIM.
-- Raw PDFs are stored in a separately provisioned private Supabase Storage bucket;
-- this migration deliberately does not mutate Supabase's managed storage schema.

create schema if not exists private;
grant usage on schema private to service_role;

create table if not exists private.contract_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_version text not null default 'contracts-workspace.phase3f1.v1'
    check (workspace_version = 'contracts-workspace.phase3f1.v1'),
  source_project_id uuid not null,
  schedule_project_id uuid not null,
  project_site text,
  document_version_id text not null
    check (document_version_id ~ '^sha256:[0-9a-f]{64}$'),
  document_sha256 text not null
    check (document_sha256 ~ '^[0-9a-f]{64}$'),
  filename text not null check (char_length(filename) between 1 and 255),
  media_type text not null default 'application/pdf'
    check (media_type = 'application/pdf'),
  byte_count integer not null check (byte_count > 0 and byte_count <= 3000000),
  storage_bucket text not null check (char_length(storage_bucket) between 1 and 100),
  storage_object_key text not null check (char_length(storage_object_key) between 1 and 500),
  extraction_fingerprint text not null
    check (extraction_fingerprint ~ '^[0-9a-f]{64}$'),
  extraction_schema_version text not null,
  extraction_version text not null,
  extraction_json jsonb not null check (jsonb_typeof(extraction_json) = 'object'),
  candidate_count integer not null check (candidate_count between 0 and 120),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  constraint contract_workspaces_document_identity
    check (document_version_id = 'sha256:' || document_sha256),
  constraint contract_workspaces_candidate_count_matches
    check (
      jsonb_typeof(extraction_json -> 'candidates') = 'array'
      and jsonb_array_length(extraction_json -> 'candidates') = candidate_count
    ),
  constraint contract_workspaces_project_document_fingerprint_key
    unique (source_project_id, schedule_project_id, document_sha256, extraction_fingerprint)
);

create index if not exists contract_workspaces_project_recent_idx
  on private.contract_workspaces (source_project_id, last_opened_at desc, created_at desc);

create index if not exists contract_workspaces_document_version_idx
  on private.contract_workspaces (document_version_id, source_project_id);

create index if not exists contract_workspaces_storage_object_idx
  on private.contract_workspaces (storage_bucket, storage_object_key);

create table if not exists private.contract_review_drafts (
  workspace_id uuid not null
    references private.contract_workspaces(id) on delete restrict,
  reviewer_id uuid not null,
  draft_version text not null default 'contracts-review-draft.phase3f1.v1'
    check (draft_version = 'contracts-review-draft.phase3f1.v1'),
  decisions_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(decisions_json) = 'object'),
  review_reason text not null default '' check (char_length(review_reason) <= 5000),
  batch_id text not null check (char_length(batch_id) between 1 and 300),
  reviewed_at timestamptz not null,
  mapping_draft_json jsonb,
  candidate_count integer not null check (candidate_count between 0 and 120),
  reviewed_count integer not null check (reviewed_count between 0 and candidate_count),
  approved_count integer not null check (approved_count between 0 and reviewed_count),
  rejected_count integer not null check (rejected_count between 0 and reviewed_count),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, reviewer_id),
  constraint contract_review_drafts_decision_counts
    check (approved_count + rejected_count = reviewed_count),
  constraint contract_review_drafts_mapping_object
    check (mapping_draft_json is null or jsonb_typeof(mapping_draft_json) = 'object')
);

create index if not exists contract_review_drafts_reviewer_recent_idx
  on private.contract_review_drafts (reviewer_id, updated_at desc);

alter table private.contract_workspaces enable row level security;
alter table private.contract_review_drafts enable row level security;

revoke all privileges on table private.contract_workspaces from public, anon, authenticated, service_role;
revoke all privileges on table private.contract_review_drafts from public, anon, authenticated, service_role;
grant select, insert, update on table private.contract_workspaces to service_role;
grant select, insert, update on table private.contract_review_drafts to service_role;

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

drop trigger if exists bidoc_contract_workspace_extraction_is_immutable
  on private.contract_workspaces;
create trigger bidoc_contract_workspace_extraction_is_immutable
before update on private.contract_workspaces
for each row execute function private.bidoc_contract_workspace_extraction_is_immutable();

revoke execute on function private.bidoc_contract_workspace_extraction_is_immutable()
from public, anon, authenticated, service_role;

create or replace function public.bidoc_contracts_workspace_status_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workspaceVersion', 'contracts-workspace.phase3f1.v1',
    'draftVersion', 'contracts-review-draft.phase3f1.v1',
    'migrationVersion', '20260812135210'
  );
$$;

create or replace function public.bidoc_contracts_upsert_workspace_v1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace record;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'workspace payload must be an object';
  end if;

  insert into private.contract_workspaces (
    source_project_id,
    schedule_project_id,
    project_site,
    document_version_id,
    document_sha256,
    filename,
    media_type,
    byte_count,
    storage_bucket,
    storage_object_key,
    extraction_fingerprint,
    extraction_schema_version,
    extraction_version,
    extraction_json,
    candidate_count,
    created_by
  ) values (
    (p_payload ->> 'sourceProjectId')::uuid,
    (p_payload ->> 'scheduleProjectId')::uuid,
    nullif(p_payload ->> 'projectSite', ''),
    lower(p_payload ->> 'documentVersionId'),
    lower(p_payload ->> 'documentSha256'),
    p_payload ->> 'filename',
    p_payload ->> 'mediaType',
    (p_payload ->> 'byteCount')::integer,
    p_payload ->> 'storageBucket',
    p_payload ->> 'storageObjectKey',
    lower(p_payload ->> 'extractionFingerprint'),
    p_payload ->> 'extractionSchemaVersion',
    p_payload ->> 'extractionVersion',
    p_payload -> 'extraction',
    (p_payload ->> 'candidateCount')::integer,
    (p_payload ->> 'createdBy')::uuid
  )
  on conflict (source_project_id, schedule_project_id, document_sha256, extraction_fingerprint)
  do update set last_opened_at = now()
  returning contract_workspaces.*, (xmax = 0) as inserted into v_workspace;

  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'workspaceVersion', v_workspace.workspace_version,
    'documentVersionId', v_workspace.document_version_id,
    'filename', v_workspace.filename,
    'projectSite', v_workspace.project_site,
    'sourceProjectId', v_workspace.source_project_id,
    'scheduleProjectId', v_workspace.schedule_project_id,
    'candidateCount', v_workspace.candidate_count,
    'createdAt', v_workspace.created_at,
    'lastOpenedAt', v_workspace.last_opened_at,
    'inserted', v_workspace.inserted,
    'reused', not v_workspace.inserted,
    'extraction', v_workspace.extraction_json
  );
end;
$$;

-- Remove the pre-review development overload so a partially compiled local
-- database cannot retain its old execution grants or omit Schedule identity.
drop function if exists public.bidoc_contracts_find_workspace_v1(uuid,text,text,uuid);

create or replace function public.bidoc_contracts_find_workspace_v1(
  p_source_project_id uuid,
  p_schedule_project_id uuid,
  p_document_sha256 text,
  p_extraction_fingerprint text,
  p_reviewer_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_draft private.contract_review_drafts%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  update private.contract_workspaces
  set last_opened_at = now()
  where source_project_id = p_source_project_id
    and schedule_project_id = p_schedule_project_id
    and document_sha256 = lower(p_document_sha256)
    and extraction_fingerprint = lower(p_extraction_fingerprint)
  returning * into v_workspace;
  if not found then return null; end if;

  select * into v_draft
  from private.contract_review_drafts
  where workspace_id = v_workspace.id
    and reviewer_id = p_reviewer_id;

  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'workspaceVersion', v_workspace.workspace_version,
    'documentVersionId', v_workspace.document_version_id,
    'filename', v_workspace.filename,
    'projectSite', v_workspace.project_site,
    'sourceProjectId', v_workspace.source_project_id,
    'scheduleProjectId', v_workspace.schedule_project_id,
    'candidateCount', v_workspace.candidate_count,
    'createdAt', v_workspace.created_at,
    'lastOpenedAt', v_workspace.last_opened_at,
    'extraction', v_workspace.extraction_json,
    'draft', case when v_draft.workspace_id is null then null else jsonb_build_object(
      'draftVersion', v_draft.draft_version,
      'decisions', v_draft.decisions_json,
      'reviewReason', v_draft.review_reason,
      'batchId', v_draft.batch_id,
      'reviewedAt', v_draft.reviewed_at,
      'mappingDraft', v_draft.mapping_draft_json,
      'candidateCount', v_draft.candidate_count,
      'reviewedCount', v_draft.reviewed_count,
      'approvedCount', v_draft.approved_count,
      'rejectedCount', v_draft.rejected_count,
      'revision', v_draft.revision,
      'updatedAt', v_draft.updated_at
    ) end
  );
end;
$$;

create or replace function public.bidoc_contracts_get_workspace_v1(
  p_workspace_id uuid,
  p_reviewer_id uuid
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_draft private.contract_review_drafts%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  update private.contract_workspaces
  set last_opened_at = now()
  where id = p_workspace_id
  returning * into v_workspace;
  if not found then return null; end if;

  select * into v_draft
  from private.contract_review_drafts
  where workspace_id = v_workspace.id
    and reviewer_id = p_reviewer_id;

  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'workspaceVersion', v_workspace.workspace_version,
    'documentVersionId', v_workspace.document_version_id,
    'filename', v_workspace.filename,
    'projectSite', v_workspace.project_site,
    'sourceProjectId', v_workspace.source_project_id,
    'scheduleProjectId', v_workspace.schedule_project_id,
    'candidateCount', v_workspace.candidate_count,
    'createdAt', v_workspace.created_at,
    'lastOpenedAt', v_workspace.last_opened_at,
    'extraction', v_workspace.extraction_json,
    'draft', case when v_draft.workspace_id is null then null else jsonb_build_object(
      'draftVersion', v_draft.draft_version,
      'decisions', v_draft.decisions_json,
      'reviewReason', v_draft.review_reason,
      'batchId', v_draft.batch_id,
      'reviewedAt', v_draft.reviewed_at,
      'mappingDraft', v_draft.mapping_draft_json,
      'candidateCount', v_draft.candidate_count,
      'reviewedCount', v_draft.reviewed_count,
      'approvedCount', v_draft.approved_count,
      'rejectedCount', v_draft.rejected_count,
      'revision', v_draft.revision,
      'updatedAt', v_draft.updated_at
    ) end
  );
end;
$$;

create or replace function public.bidoc_contracts_list_workspaces_v1(
  p_source_project_id uuid,
  p_reviewer_id uuid,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workspaceVersion', 'contracts-workspace.phase3f1.v1',
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'workspaceId', workspace.id,
      'documentVersionId', workspace.document_version_id,
      'filename', workspace.filename,
      'projectSite', workspace.project_site,
      'sourceProjectId', workspace.source_project_id,
      'scheduleProjectId', workspace.schedule_project_id,
      'candidateCount', workspace.candidate_count,
      'createdAt', workspace.created_at,
      'lastOpenedAt', workspace.last_opened_at,
      'draft', case when draft.workspace_id is null then null else jsonb_build_object(
        'reviewedCount', draft.reviewed_count,
        'approvedCount', draft.approved_count,
        'rejectedCount', draft.rejected_count,
        'revision', draft.revision,
        'updatedAt', draft.updated_at
      ) end
    ) order by coalesce(draft.updated_at, workspace.last_opened_at) desc, workspace.created_at desc), '[]'::jsonb)
  )
  from (
    select *
    from private.contract_workspaces
    where source_project_id = p_source_project_id
    order by last_opened_at desc, created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) workspace
  left join private.contract_review_drafts draft
    on draft.workspace_id = workspace.id
   and draft.reviewer_id = p_reviewer_id;
$$;

-- Remove the pre-concurrency development overload so callers must supply the
-- revision they observed and stale autosaves cannot silently overwrite work.
drop function if exists public.bidoc_contracts_save_review_draft_v1(uuid,uuid,jsonb);

create or replace function public.bidoc_contracts_save_review_draft_v1(
  p_workspace_id uuid,
  p_reviewer_id uuid,
  p_expected_revision bigint,
  p_draft jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate_count integer;
  v_current_revision bigint;
  v_row private.contract_review_drafts%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_draft) <> 'object' then
    raise exception using errcode = '22023', message = 'draft payload must be an object';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'expected draft revision must be zero or greater';
  end if;

  select candidate_count into v_candidate_count
  from private.contract_workspaces
  where id = p_workspace_id;
  if not found then
    raise exception using errcode = '23503', message = 'Saved contract workspace was not found';
  end if;
  if v_candidate_count <> (p_draft ->> 'candidateCount')::integer then
    raise exception using errcode = '23514', message = 'Draft candidate count does not match the saved extraction';
  end if;

  select revision into v_current_revision
  from private.contract_review_drafts
  where workspace_id = p_workspace_id
    and reviewer_id = p_reviewer_id
  for update;

  if found then
    if v_current_revision <> p_expected_revision then
      raise exception using
        errcode = '40001',
        message = 'Saved contract review draft revision is stale',
        detail = format(
          'Expected revision %s but the current revision is %s.',
          p_expected_revision,
          v_current_revision
        );
    end if;

    update private.contract_review_drafts
    set decisions_json = p_draft -> 'decisions',
        review_reason = coalesce(p_draft ->> 'reviewReason', ''),
        batch_id = p_draft ->> 'batchId',
        reviewed_at = (p_draft ->> 'reviewedAt')::timestamptz,
        mapping_draft_json = nullif(p_draft -> 'mappingDraft', 'null'::jsonb),
        candidate_count = (p_draft ->> 'candidateCount')::integer,
        reviewed_count = (p_draft ->> 'reviewedCount')::integer,
        approved_count = (p_draft ->> 'approvedCount')::integer,
        rejected_count = (p_draft ->> 'rejectedCount')::integer,
        revision = revision + 1,
        updated_at = now()
    where workspace_id = p_workspace_id
      and reviewer_id = p_reviewer_id
      and revision = p_expected_revision
    returning * into v_row;
  else
    if p_expected_revision <> 0 then
      raise exception using
        errcode = '40001',
        message = 'Saved contract review draft revision is stale',
        detail = format(
          'Expected revision %s but no saved draft exists.',
          p_expected_revision
        );
    end if;

    begin
      insert into private.contract_review_drafts (
        workspace_id,
        reviewer_id,
        decisions_json,
        review_reason,
        batch_id,
        reviewed_at,
        mapping_draft_json,
        candidate_count,
        reviewed_count,
        approved_count,
        rejected_count
      ) values (
        p_workspace_id,
        p_reviewer_id,
        p_draft -> 'decisions',
        coalesce(p_draft ->> 'reviewReason', ''),
        p_draft ->> 'batchId',
        (p_draft ->> 'reviewedAt')::timestamptz,
        nullif(p_draft -> 'mappingDraft', 'null'::jsonb),
        (p_draft ->> 'candidateCount')::integer,
        (p_draft ->> 'reviewedCount')::integer,
        (p_draft ->> 'approvedCount')::integer,
        (p_draft ->> 'rejectedCount')::integer
      )
      returning * into v_row;
    exception when unique_violation then
      raise exception using
        errcode = '40001',
        message = 'Saved contract review draft revision is stale',
        detail = 'Another request created the saved draft first.';
    end;
  end if;

  return jsonb_build_object(
    'workspaceId', v_row.workspace_id,
    'draftVersion', v_row.draft_version,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at,
    'reviewedCount', v_row.reviewed_count,
    'approvedCount', v_row.approved_count,
    'rejectedCount', v_row.rejected_count
  );
end;
$$;

revoke execute on function public.bidoc_contracts_workspace_status_v1()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_upsert_workspace_v1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_find_workspace_v1(uuid,uuid,text,text,uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_get_workspace_v1(uuid,uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_save_review_draft_v1(uuid,uuid,bigint,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_workspace_status_v1() to service_role;
grant execute on function public.bidoc_contracts_upsert_workspace_v1(jsonb) to service_role;
grant execute on function public.bidoc_contracts_find_workspace_v1(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.bidoc_contracts_get_workspace_v1(uuid,uuid) to service_role;
grant execute on function public.bidoc_contracts_list_workspaces_v1(uuid,uuid,integer) to service_role;
grant execute on function public.bidoc_contracts_save_review_draft_v1(uuid,uuid,bigint,jsonb) to service_role;
