-- BIDoc Contracts Pipeline R1: clause-first schema and revision lock.
-- Target on separately approved apply only: APP DATA / KAPAIM.
-- This migration is additive, preserves Phase 3F.1 RPC contracts, performs no
-- Schedule writes, and keeps the new domain tables outside exposed API schemas.

create or replace function private.bidoc_contracts_raw_data_valid_r1(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'object'
    and pg_column_size(p_value) <= 262144
    and (p_value - array[
      'segments',
      'pageLocators',
      'headings',
      'continuationDecisions',
      'boxes'
    ]::text[]) = '{}'::jsonb
    and jsonb_typeof(p_value -> 'segments') = 'array'
    and jsonb_array_length(p_value -> 'segments') between 1 and 500
    and not exists (
      select 1
      from jsonb_array_elements(p_value -> 'segments') segment
      where jsonb_typeof(segment) is distinct from 'object'
        or (segment - array['page', 'text', 'heading', 'continuation', 'boxes']::text[]) <> '{}'::jsonb
        or coalesce(segment ->> 'page', '') !~ '^[1-9][0-9]*$'
        or jsonb_typeof(segment -> 'text') is distinct from 'string'
        or char_length(btrim(segment ->> 'text')) not between 1 and 20000
        or (segment ? 'heading' and (
          jsonb_typeof(segment -> 'heading') is distinct from 'string'
          or char_length(segment ->> 'heading') > 1000
        ))
        or (segment ? 'continuation' and jsonb_typeof(segment -> 'continuation') is distinct from 'boolean')
        or (segment ? 'boxes' and (
          jsonb_typeof(segment -> 'boxes') is distinct from 'array'
          or jsonb_array_length(segment -> 'boxes') > 100
        ))
    )
    and (not (p_value ? 'pageLocators') or jsonb_typeof(p_value -> 'pageLocators') = 'array')
    and (not (p_value ? 'headings') or jsonb_typeof(p_value -> 'headings') = 'array')
    and (not (p_value ? 'continuationDecisions') or jsonb_typeof(p_value -> 'continuationDecisions') = 'array')
    and (not (p_value ? 'boxes') or jsonb_typeof(p_value -> 'boxes') = 'array'), false);
$$;

create or replace function private.bidoc_contracts_source_evidence_valid_r1(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'array'
    and pg_column_size(p_value) <= 262144
    and jsonb_array_length(p_value) between 1 and 100
    and not exists (
      select 1
      from jsonb_array_elements(p_value) item
      where jsonb_typeof(item) is distinct from 'object'
        or (item - array[
          'clauseId', 'pageStart', 'pageEnd', 'rawTextSha256', 'excerpt'
        ]::text[]) <> '{}'::jsonb
        or coalesce(item ->> 'clauseId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(item ->> 'pageStart', '') !~ '^[1-9][0-9]*$'
        or coalesce(item ->> 'pageEnd', '') !~ '^[1-9][0-9]*$'
        or case
          when coalesce(item ->> 'pageStart', '') ~ '^[1-9][0-9]*$'
           and coalesce(item ->> 'pageEnd', '') ~ '^[1-9][0-9]*$'
          then (item ->> 'pageEnd')::integer < (item ->> 'pageStart')::integer
          else true
        end
        or coalesce(item ->> 'rawTextSha256', '') !~ '^[0-9a-f]{64}$'
        or jsonb_typeof(item -> 'excerpt') is distinct from 'string'
        or char_length(btrim(item ->> 'excerpt')) not between 1 and 20000
    ), false);
$$;

create or replace function private.bidoc_contracts_relationship_evidence_valid_r1(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'object'
    and pg_column_size(p_value) <= 262144
    and (p_value - array['excerpts', 'rationaleHe', 'signals']::text[]) = '{}'::jsonb
    and private.bidoc_contracts_source_evidence_valid_r1(p_value -> 'excerpts')
    and jsonb_typeof(p_value -> 'rationaleHe') = 'string'
    and char_length(btrim(p_value ->> 'rationaleHe')) between 1 and 5000
    and (not (p_value ? 'signals') or jsonb_typeof(p_value -> 'signals') = 'object'), false);
$$;

create or replace function private.bidoc_contracts_index_ref_valid_r1(p_value jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_typeof(p_value) = 'object'
    and pg_column_size(p_value) <= 32768
    and (p_value - array[
      'schemaVersion', 'provider', 'recordId', 'contentSha256', 'metadata'
    ]::text[]) = '{}'::jsonb
    and p_value ->> 'schemaVersion' = 'contracts-index-ref.r1.v1'
    and jsonb_typeof(p_value -> 'provider') = 'string'
    and char_length(btrim(p_value ->> 'provider')) between 1 and 100
    and jsonb_typeof(p_value -> 'recordId') = 'string'
    and char_length(btrim(p_value ->> 'recordId')) between 1 and 500
    and coalesce(p_value ->> 'contentSha256', '') ~ '^[0-9a-f]{64}$'
    and (not (p_value ? 'metadata') or jsonb_typeof(p_value -> 'metadata') = 'object'), false);
$$;

alter table private.contract_workspaces
  alter column schedule_project_id drop not null,
  add column if not exists parser_generation_id text,
  add column if not exists parser_version text,
  add column if not exists prompt_version text,
  add column if not exists extractor_version text,
  add column if not exists extraction_fingerprint_input jsonb;

alter table private.contract_workspaces
  drop constraint if exists contract_workspaces_workspace_version_check,
  drop constraint if exists contract_workspaces_candidate_count_matches;

alter table private.contract_workspaces
  add constraint contract_workspaces_workspace_version_check
    check (workspace_version in (
      'contracts-workspace.phase3f1.v1',
      'contracts-workspace.r1.v1'
    )),
  add constraint contract_workspaces_version_shape
    check (
      (
        workspace_version = 'contracts-workspace.phase3f1.v1'
        and schedule_project_id is not null
        and parser_generation_id is null
        and parser_version is null
        and prompt_version is null
        and extractor_version is null
        and extraction_fingerprint_input is null
      )
      or
      (
        workspace_version = 'contracts-workspace.r1.v1'
        and parser_generation_id ~ '^parser-generation:sha256:[0-9a-f]{64}$'
        and char_length(parser_version) between 1 and 200
        and char_length(prompt_version) between 1 and 200
        and char_length(extractor_version) between 1 and 200
        and jsonb_typeof(extraction_fingerprint_input) = 'object'
        and extraction_fingerprint_input ->> 'workspaceVersion' = workspace_version
        and extraction_fingerprint_input ->> 'parserGenerationId' = parser_generation_id
        and extraction_fingerprint_input ->> 'parserVersion' = parser_version
        and extraction_fingerprint_input ->> 'promptVersion' = prompt_version
        and extraction_fingerprint_input ->> 'extractorVersion' = extractor_version
        and extraction_fingerprint_input ->> 'extractionSchemaVersion' = extraction_schema_version
        and extraction_fingerprint = encode(
          pg_catalog.sha256(pg_catalog.convert_to(extraction_fingerprint_input::text, 'UTF8')),
          'hex'
        )
      )
    ),
  add constraint contract_workspaces_candidate_count_matches
    check (
      (
        workspace_version = 'contracts-workspace.phase3f1.v1'
        and jsonb_typeof(extraction_json -> 'candidates') = 'array'
        and jsonb_array_length(extraction_json -> 'candidates') = candidate_count
      )
      or
      (
        workspace_version = 'contracts-workspace.r1.v1'
        and candidate_count = 0
      )
    ),
  add constraint contract_workspaces_r1_scope_key
    unique (id, source_project_id, document_version_id, parser_generation_id);

create unique index contract_workspaces_r1_document_fingerprint_key
  on private.contract_workspaces (
    source_project_id,
    document_sha256,
    extraction_fingerprint
  )
  where workspace_version = 'contracts-workspace.r1.v1';

create index contract_workspaces_r1_generation_idx
  on private.contract_workspaces (
    source_project_id,
    document_version_id,
    parser_generation_id
  )
  where workspace_version = 'contracts-workspace.r1.v1';

create table private.contracts_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  source_project_id uuid not null,
  document_version_id text not null
    check (document_version_id ~ '^sha256:[0-9a-f]{64}$'),
  document_sha256 text not null
    check (document_sha256 ~ '^[0-9a-f]{64}$'),
  parser_generation_id text not null
    check (parser_generation_id ~ '^parser-generation:sha256:[0-9a-f]{64}$'),
  clause_key text not null check (char_length(btrim(clause_key)) between 1 and 300),
  parent_clause_key text,
  clause_type text not null
    check (clause_type in ('clause', 'subclause', 'appendix_item', 'document_context')),
  clause_title text check (clause_title is null or char_length(clause_title) <= 1000),
  clause_order integer not null check (clause_order > 0),
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  raw_text text not null check (char_length(btrim(raw_text)) > 0),
  raw_text_sha256 text not null
    check (raw_text_sha256 ~ '^[0-9a-f]{64}$'),
  raw_data jsonb not null
    check (private.bidoc_contracts_raw_data_valid_r1(raw_data)),
  summary_he text check (summary_he is null or char_length(summary_he) <= 10000),
  hashtags text[] not null default '{}'::text[],
  cross_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cross_references) = 'array'),
  content text,
  index_ref jsonb
    check (index_ref is null or private.bidoc_contracts_index_ref_valid_r1(index_ref)),
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'processed', 'failed')),
  processing_error text check (processing_error is null or char_length(processing_error) <= 5000),
  parser_version text not null check (char_length(parser_version) between 1 and 200),
  extractor_version text not null check (char_length(extractor_version) between 1 and 200),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_documents_workspace_fk
    foreign key (workspace_id, source_project_id, document_version_id, parser_generation_id)
    references private.contract_workspaces (
      id, source_project_id, document_version_id, parser_generation_id
    ) on delete restrict,
  constraint contracts_documents_document_identity
    check (document_version_id = 'sha256:' || document_sha256),
  constraint contracts_documents_raw_text_hash
    check (
      raw_text_sha256 = encode(
        pg_catalog.sha256(pg_catalog.convert_to(raw_text, 'UTF8')),
        'hex'
      )
    ),
  constraint contracts_documents_processing_shape
    check (
      (processing_status = 'processed' and processed_at is not null and processing_error is null)
      or (processing_status = 'failed' and processed_at is null and char_length(btrim(processing_error)) > 0)
      or (processing_status in ('pending', 'processing') and processed_at is null and processing_error is null)
    ),
  constraint contracts_documents_updated_after_created
    check (updated_at >= created_at),
  constraint contracts_documents_identity_key
    unique (workspace_id, document_version_id, parser_generation_id, clause_key),
  constraint contracts_documents_order_key
    unique (workspace_id, document_version_id, parser_generation_id, clause_order),
  constraint contracts_documents_scoped_id_key
    unique (id, workspace_id, document_version_id, parser_generation_id),
  constraint contracts_documents_parent_fk
    foreign key (workspace_id, document_version_id, parser_generation_id, parent_clause_key)
    references private.contracts_documents (
      workspace_id, document_version_id, parser_generation_id, clause_key
    ) on delete restrict deferrable initially deferred
);

create index contracts_documents_project_order_idx
  on private.contracts_documents (
    source_project_id,
    document_version_id,
    parser_generation_id,
    clause_order
  );

create index contracts_documents_processing_idx
  on private.contracts_documents (
    workspace_id,
    parser_generation_id,
    processing_status,
    clause_order
  );

create table private.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  source_project_id uuid not null,
  schedule_project_id uuid references public.projects(id) on delete restrict,
  document_version_id text not null,
  parser_generation_id text not null,
  decision_key text not null check (char_length(btrim(decision_key)) between 1 and 300),
  revision integer not null default 1 check (revision > 0),
  supersedes_decision_id uuid,
  primary_clause_id uuid,
  source_evidence jsonb not null
    check (private.bidoc_contracts_source_evidence_valid_r1(source_evidence)),
  title_he text not null check (char_length(btrim(title_he)) between 1 and 1000),
  summary_he text not null check (char_length(btrim(summary_he)) between 1 and 10000),
  decision_text_he text not null check (char_length(btrim(decision_text_he)) between 1 and 20000),
  tags text[] not null default '{}'::text[],
  people jsonb not null default '[]'::jsonb check (jsonb_typeof(people) = 'array'),
  responsible_party text,
  beneficiary text,
  decision_category text not null check (decision_category in (
    'scope_and_execution',
    'commencement_and_completion',
    'stage_acceptance_and_handover',
    'payment_and_commercial',
    'notice_and_communication',
    'change_and_approval',
    'bond_and_security',
    'warranty_and_defects',
    'recurring_compliance',
    'delay_extension_and_consequence',
    'termination_and_remedy',
    'document_and_information_obligation',
    'other'
  )),
  conflict_status text not null default 'none'
    check (conflict_status in ('none', 'detected', 'reviewed', 'unresolved')),
  schedule_impact text not null default 'unknown'
    check (schedule_impact in ('yes', 'no', 'unknown')),
  temporal_kind text not null default 'none'
    check (temporal_kind in ('none', 'fixed', 'relative', 'recurring', 'extension', 'consequence')),
  contract_date date,
  trigger_kind text,
  trigger_description_he text,
  offset_value numeric,
  offset_unit text check (
    offset_unit is null or offset_unit in ('hours', 'calendar_days', 'working_days', 'weeks', 'months')
  ),
  calendar_semantics text not null default 'unknown'
    check (calendar_semantics in ('explicit', 'reviewed', 'unknown', 'not_applicable')),
  recurring boolean not null default false,
  review_status text not null default 'proposed'
    check (review_status in ('proposed', 'approved', 'corrected', 'rejected', 'split', 'merged', 'superseded', 'unresolved')),
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_reason text,
  projection_status text not null default 'blocked'
    check (projection_status in ('not_applicable', 'blocked', 'ready', 'projected', 'superseded')),
  model_version text not null check (char_length(model_version) between 1 and 200),
  decision_policy_version text not null check (char_length(decision_policy_version) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_workspace_fk
    foreign key (workspace_id, source_project_id, document_version_id, parser_generation_id)
    references private.contract_workspaces (
      id, source_project_id, document_version_id, parser_generation_id
    ) on delete restrict,
  constraint contracts_primary_clause_fk
    foreign key (primary_clause_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts_documents (
      id, workspace_id, document_version_id, parser_generation_id
    ) on delete restrict,
  constraint contracts_review_shape
    check (
      (review_status = 'proposed' and reviewer_id is null and reviewed_at is null and review_reason is null)
      or
      (review_status <> 'proposed' and reviewer_id is not null and reviewed_at is not null
       and char_length(btrim(review_reason)) > 0)
    ),
  constraint contracts_temporal_shape
    check (
      (temporal_kind = 'fixed' and contract_date is not null)
      or
      (temporal_kind in ('relative', 'recurring')
       and char_length(btrim(trigger_description_he)) > 0
       and offset_value >= 0
       and offset_unit is not null)
      or temporal_kind in ('none', 'extension', 'consequence')
    ),
  constraint contracts_projection_shape
    check (
      (schedule_impact = 'no' and projection_status = 'not_applicable')
      or
      (projection_status in ('ready', 'projected')
       and schedule_impact = 'yes'
       and schedule_project_id is not null
       and review_status in ('approved', 'corrected'))
      or
      (schedule_impact <> 'no' and projection_status in ('blocked', 'superseded'))
    ),
  constraint contracts_offset_nonnegative check (offset_value is null or offset_value >= 0),
  constraint contracts_append_timestamp check (updated_at = created_at),
  constraint contracts_lineage_key
    unique (workspace_id, document_version_id, parser_generation_id, decision_key, revision),
  constraint contracts_scoped_id_key
    unique (id, workspace_id, document_version_id, parser_generation_id),
  constraint contracts_scoped_lineage_id_key
    unique (id, workspace_id, document_version_id, parser_generation_id, decision_key),
  constraint contracts_supersedes_fk
    foreign key (
      supersedes_decision_id,
      workspace_id,
      document_version_id,
      parser_generation_id,
      decision_key
    ) references private.contracts (
      id,
      workspace_id,
      document_version_id,
      parser_generation_id,
      decision_key
    ) on delete restrict
);

create index contracts_lineage_revision_idx
  on private.contracts (
    workspace_id,
    parser_generation_id,
    decision_key,
    revision desc
  );

create index contracts_review_queue_idx
  on private.contracts (source_project_id, review_status, created_at)
  where review_status in ('proposed', 'unresolved');

create index contracts_projection_queue_idx
  on private.contracts (schedule_project_id, projection_status, created_at)
  where projection_status in ('ready', 'blocked');

create index contracts_primary_clause_idx on private.contracts (primary_clause_id);
create index contracts_supersedes_idx on private.contracts (supersedes_decision_id);
create index contracts_schedule_project_idx on private.contracts (schedule_project_id);

create or replace function private.bidoc_contracts_endpoint_token_r1(
  p_clause_id uuid,
  p_decision_id uuid
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_clause_id is not null and p_decision_id is null then 'clause:' || p_clause_id::text
    when p_clause_id is null and p_decision_id is not null then 'decision:' || p_decision_id::text
    else null
  end;
$$;

create or replace function private.bidoc_contracts_relationship_key_r1(
  p_document_version_id text,
  p_parser_generation_id text,
  p_relationship_type text,
  p_source_clause_id uuid,
  p_source_decision_id uuid,
  p_target_clause_id uuid,
  p_target_decision_id uuid
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      'contracts-relationship.r1' || chr(31)
      || p_document_version_id || chr(31)
      || p_parser_generation_id || chr(31)
      || p_relationship_type || chr(31)
      || private.bidoc_contracts_endpoint_token_r1(p_source_clause_id, p_source_decision_id) || chr(31)
      || private.bidoc_contracts_endpoint_token_r1(p_target_clause_id, p_target_decision_id),
      'UTF8'
    )),
    'hex'
  );
$$;

create table private.contract_relationships (
  id uuid primary key default gen_random_uuid(),
  relationship_key text generated always as (
    private.bidoc_contracts_relationship_key_r1(
      document_version_id,
      parser_generation_id,
      relationship_type,
      source_clause_id,
      source_decision_id,
      target_clause_id,
      target_decision_id
    )
  ) stored,
  workspace_id uuid not null,
  document_version_id text not null,
  parser_generation_id text not null,
  source_clause_id uuid,
  source_decision_id uuid,
  target_clause_id uuid,
  target_decision_id uuid,
  relationship_type text not null check (relationship_type in (
    'cross_reference',
    'supports_same_decision',
    'depends_on',
    'condition_of',
    'exception_to',
    'amends',
    'duplicates',
    'conflicts_with'
  )),
  origin text not null
    check (origin in ('explicit_reference', 'deterministic', 'model', 'human', 'system')),
  confidence numeric,
  evidence jsonb not null
    check (private.bidoc_contracts_relationship_evidence_valid_r1(evidence)),
  model_version text not null check (char_length(model_version) between 1 and 200),
  relationship_policy_version text not null
    check (char_length(relationship_policy_version) between 1 and 200),
  review_status text not null default 'proposed'
    check (review_status in ('proposed', 'approved', 'corrected', 'rejected', 'superseded', 'unresolved')),
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_reason text,
  revision integer not null default 1 check (revision > 0),
  supersedes_relationship_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_relationships_source_endpoint
    check (num_nonnulls(source_clause_id, source_decision_id) = 1),
  constraint contract_relationships_target_endpoint
    check (num_nonnulls(target_clause_id, target_decision_id) = 1),
  constraint contract_relationships_no_same_endpoint
    check (
      source_clause_id is null or target_clause_id is null or source_clause_id <> target_clause_id
    )
    not valid,
  constraint contract_relationships_no_same_decision
    check (
      source_decision_id is null or target_decision_id is null or source_decision_id <> target_decision_id
    )
    not valid,
  constraint contract_relationships_symmetric_order
    check (
      relationship_type not in ('duplicates', 'conflicts_with')
      or private.bidoc_contracts_endpoint_token_r1(source_clause_id, source_decision_id)
         < private.bidoc_contracts_endpoint_token_r1(target_clause_id, target_decision_id)
    ),
  constraint contract_relationships_origin_confidence
    check (
      (origin = 'model' and (confidence is null or (confidence >= 0 and confidence <= 1)))
      or (origin <> 'model' and confidence is null)
    ),
  constraint contract_relationships_model_shape
    check (
      (origin = 'model' and model_version <> 'not_applicable')
      or (origin <> 'model' and model_version = 'not_applicable')
    ),
  constraint contract_relationships_review_shape
    check (
      (review_status = 'proposed' and reviewer_id is null and reviewed_at is null and review_reason is null)
      or
      (review_status <> 'proposed' and reviewer_id is not null and reviewed_at is not null
       and char_length(btrim(review_reason)) > 0)
    ),
  constraint contract_relationships_append_timestamp check (updated_at = created_at),
  constraint contract_relationships_source_clause_fk
    foreign key (source_clause_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts_documents (
      id, workspace_id, document_version_id, parser_generation_id
    ) match simple on delete restrict,
  constraint contract_relationships_source_decision_fk
    foreign key (source_decision_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts (
      id, workspace_id, document_version_id, parser_generation_id
    ) match simple on delete restrict,
  constraint contract_relationships_target_clause_fk
    foreign key (target_clause_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts_documents (
      id, workspace_id, document_version_id, parser_generation_id
    ) match simple on delete restrict,
  constraint contract_relationships_target_decision_fk
    foreign key (target_decision_id, workspace_id, document_version_id, parser_generation_id)
    references private.contracts (
      id, workspace_id, document_version_id, parser_generation_id
    ) match simple on delete restrict,
  constraint contract_relationships_lineage_key
    unique (
      workspace_id,
      document_version_id,
      parser_generation_id,
      relationship_policy_version,
      relationship_key,
      revision
    ),
  constraint contract_relationships_scoped_lineage_id_key
    unique (
      id,
      workspace_id,
      document_version_id,
      parser_generation_id,
      relationship_key
    ),
  constraint contract_relationships_supersedes_fk
    foreign key (
      supersedes_relationship_id,
      workspace_id,
      document_version_id,
      parser_generation_id,
      relationship_key
    ) references private.contract_relationships (
      id,
      workspace_id,
      document_version_id,
      parser_generation_id,
      relationship_key
    ) on delete restrict
);

alter table private.contract_relationships
  validate constraint contract_relationships_no_same_endpoint;
alter table private.contract_relationships
  validate constraint contract_relationships_no_same_decision;

create index contract_relationships_source_clause_idx
  on private.contract_relationships (
    workspace_id, document_version_id, parser_generation_id, source_clause_id
  );
create index contract_relationships_source_decision_idx
  on private.contract_relationships (
    workspace_id, document_version_id, parser_generation_id, source_decision_id
  );
create index contract_relationships_target_clause_idx
  on private.contract_relationships (
    workspace_id, document_version_id, parser_generation_id, target_clause_id
  );
create index contract_relationships_target_decision_idx
  on private.contract_relationships (
    workspace_id, document_version_id, parser_generation_id, target_decision_id
  );
create index contract_relationships_scope_type_review_idx
  on private.contract_relationships (
    workspace_id, parser_generation_id, relationship_type, review_status
  );
create index contract_relationships_review_queue_idx
  on private.contract_relationships (workspace_id, review_status, created_at)
  where review_status in ('proposed', 'unresolved');
create index contract_relationships_supersedes_idx
  on private.contract_relationships (supersedes_relationship_id);

alter table private.contract_relationships alter column relationship_key set not null;

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
     or new.created_at is distinct from old.created_at
     or new.parser_generation_id is distinct from old.parser_generation_id
     or new.parser_version is distinct from old.parser_version
     or new.prompt_version is distinct from old.prompt_version
     or new.extractor_version is distinct from old.extractor_version
     or new.extraction_fingerprint_input is distinct from old.extraction_fingerprint_input then
    raise exception using
      errcode = '55000',
      message = 'Saved contract extraction and source identity are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.bidoc_contracts_document_guard_r1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'Contract clause source rows cannot be deleted';
  end if;

  if new.id is distinct from old.id
     or new.workspace_id is distinct from old.workspace_id
     or new.source_project_id is distinct from old.source_project_id
     or new.document_version_id is distinct from old.document_version_id
     or new.document_sha256 is distinct from old.document_sha256
     or new.parser_generation_id is distinct from old.parser_generation_id
     or new.clause_key is distinct from old.clause_key
     or new.parent_clause_key is distinct from old.parent_clause_key
     or new.clause_type is distinct from old.clause_type
     or new.clause_title is distinct from old.clause_title
     or new.clause_order is distinct from old.clause_order
     or new.page_start is distinct from old.page_start
     or new.page_end is distinct from old.page_end
     or new.raw_text is distinct from old.raw_text
     or new.raw_text_sha256 is distinct from old.raw_text_sha256
     or new.raw_data is distinct from old.raw_data
     or new.parser_version is distinct from old.parser_version
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = '55000', message = 'Contract clause source identity and evidence are immutable';
  end if;

  if not (
    new.processing_status = old.processing_status
    or (old.processing_status = 'pending' and new.processing_status in ('processing', 'failed'))
    or (old.processing_status = 'processing' and new.processing_status in ('processed', 'failed'))
    or (old.processing_status = 'failed' and new.processing_status = 'processing')
    or (old.processing_status = 'processed' and new.processing_status = 'processed')
  ) then
    raise exception using errcode = '55000', message = 'Invalid contract clause processing transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger bidoc_contracts_document_guard_r1
before update or delete on private.contracts_documents
for each row execute function private.bidoc_contracts_document_guard_r1();

create or replace function private.bidoc_contracts_decision_revision_guard_r1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous private.contracts%rowtype;
begin
  if new.revision = 1 then
    if new.supersedes_decision_id is not null then
      raise exception using errcode = '23514', message = 'Decision revision one cannot have a predecessor';
    end if;
  else
    if new.supersedes_decision_id is null then
      raise exception using errcode = '23514', message = 'Decision revision greater than one requires a predecessor';
    end if;
    select * into v_previous
    from private.contracts
    where id = new.supersedes_decision_id;
    if not found or v_previous.revision <> new.revision - 1 then
      raise exception using errcode = '23514', message = 'Decision predecessor must be the immediately prior revision';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.bidoc_contracts_relationship_revision_guard_r1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous private.contract_relationships%rowtype;
begin
  if new.revision > 1 and new.supersedes_relationship_id is null then
    raise exception using errcode = '23514', message = 'Relationship revision greater than one requires a predecessor';
  end if;

  if new.supersedes_relationship_id is not null then
    select * into v_previous
    from private.contract_relationships
    where id = new.supersedes_relationship_id;
    if not found then
      raise exception using errcode = '23514', message = 'Relationship predecessor was not found';
    end if;
    if new.revision > 1 and (
      v_previous.relationship_policy_version <> new.relationship_policy_version
      or v_previous.revision <> new.revision - 1
    ) then
      raise exception using errcode = '23514', message = 'Relationship predecessor must be the immediately prior same-policy revision';
    end if;
    if new.revision = 1 and v_previous.relationship_policy_version = new.relationship_policy_version then
      raise exception using errcode = '23514', message = 'A new policy generation must differ from its predecessor policy';
    end if;
  elsif new.revision <> 1 then
    raise exception using errcode = '23514', message = 'Relationship revision lineage is invalid';
  end if;
  return new;
end;
$$;

create or replace function private.bidoc_contracts_append_only_guard_r1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Contract decision and relationship revisions are append-only';
end;
$$;

create trigger bidoc_contracts_decision_revision_guard_r1
before insert on private.contracts
for each row execute function private.bidoc_contracts_decision_revision_guard_r1();

create trigger bidoc_contracts_decision_append_only_r1
before update or delete on private.contracts
for each row execute function private.bidoc_contracts_append_only_guard_r1();

create trigger bidoc_contracts_relationship_revision_guard_r1
before insert on private.contract_relationships
for each row execute function private.bidoc_contracts_relationship_revision_guard_r1();

create trigger bidoc_contracts_relationship_append_only_r1
before update or delete on private.contract_relationships
for each row execute function private.bidoc_contracts_append_only_guard_r1();

alter table private.contracts_documents enable row level security;
alter table private.contracts_documents force row level security;
alter table private.contracts enable row level security;
alter table private.contracts force row level security;
alter table private.contract_relationships enable row level security;
alter table private.contract_relationships force row level security;

revoke all privileges on table private.contracts_documents from public, anon, authenticated, service_role;
revoke all privileges on table private.contracts from public, anon, authenticated, service_role;
revoke all privileges on table private.contract_relationships from public, anon, authenticated, service_role;

grant select, insert, update on table private.contracts_documents to service_role;
grant select, insert on table private.contracts to service_role;
grant select, insert on table private.contract_relationships to service_role;

revoke execute on function private.bidoc_contracts_endpoint_token_r1(uuid,uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_relationship_key_r1(text,text,text,uuid,uuid,uuid,uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_document_guard_r1()
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_decision_revision_guard_r1()
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_relationship_revision_guard_r1()
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_append_only_guard_r1()
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_raw_data_valid_r1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_source_evidence_valid_r1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_relationship_evidence_valid_r1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function private.bidoc_contracts_index_ref_valid_r1(jsonb)
from public, anon, authenticated, service_role;

grant execute on function private.bidoc_contracts_endpoint_token_r1(uuid,uuid)
to service_role;
grant execute on function private.bidoc_contracts_relationship_key_r1(text,text,text,uuid,uuid,uuid,uuid)
to service_role;
grant execute on function private.bidoc_contracts_raw_data_valid_r1(jsonb)
to service_role;
grant execute on function private.bidoc_contracts_source_evidence_valid_r1(jsonb)
to service_role;
grant execute on function private.bidoc_contracts_relationship_evidence_valid_r1(jsonb)
to service_role;
grant execute on function private.bidoc_contracts_index_ref_valid_r1(jsonb)
to service_role;

create or replace function public.bidoc_contracts_schema_status_r1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'workspaceVersion', 'contracts-workspace.r1.v1',
    'clauseSchemaVersion', 'contracts-documents.r1.v1',
    'decisionSchemaVersion', 'contracts.r1.v1',
    'relationshipSchemaVersion', 'contract-relationships.r1.v1',
    'migrationVersion', '20260815103618'
  );
$$;

create or replace function public.bidoc_contracts_upsert_workspace_r1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace record;
  v_fingerprint_input jsonb;
  v_extraction_fingerprint text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'R1 workspace payload must be an object';
  end if;

  v_fingerprint_input := jsonb_build_object(
    'workspaceVersion', 'contracts-workspace.r1.v1',
    'parserGenerationId', lower(p_payload ->> 'parserGenerationId'),
    'parserVersion', p_payload ->> 'parserVersion',
    'promptVersion', p_payload ->> 'promptVersion',
    'extractorVersion', p_payload ->> 'extractorVersion',
    'extractionSchemaVersion', p_payload ->> 'extractionSchemaVersion'
  );
  v_extraction_fingerprint := encode(
    pg_catalog.sha256(pg_catalog.convert_to(v_fingerprint_input::text, 'UTF8')),
    'hex'
  );

  insert into private.contract_workspaces (
    workspace_version,
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
    created_by,
    parser_generation_id,
    parser_version,
    prompt_version,
    extractor_version,
    extraction_fingerprint_input
  ) values (
    'contracts-workspace.r1.v1',
    (p_payload ->> 'sourceProjectId')::uuid,
    nullif(p_payload ->> 'scheduleProjectId', '')::uuid,
    nullif(p_payload ->> 'projectSite', ''),
    lower(p_payload ->> 'documentVersionId'),
    lower(p_payload ->> 'documentSha256'),
    p_payload ->> 'filename',
    coalesce(p_payload ->> 'mediaType', 'application/pdf'),
    (p_payload ->> 'byteCount')::integer,
    p_payload ->> 'storageBucket',
    p_payload ->> 'storageObjectKey',
    v_extraction_fingerprint,
    p_payload ->> 'extractionSchemaVersion',
    p_payload ->> 'extractionVersion',
    coalesce(p_payload -> 'extraction', '{}'::jsonb),
    0,
    (p_payload ->> 'createdBy')::uuid,
    lower(p_payload ->> 'parserGenerationId'),
    p_payload ->> 'parserVersion',
    p_payload ->> 'promptVersion',
    p_payload ->> 'extractorVersion',
    v_fingerprint_input
  )
  on conflict (source_project_id, document_sha256, extraction_fingerprint)
    where workspace_version = 'contracts-workspace.r1.v1'
  do update set last_opened_at = now()
  returning private.contract_workspaces.*, (xmax = 0) as inserted into v_workspace;

  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'workspaceVersion', v_workspace.workspace_version,
    'sourceProjectId', v_workspace.source_project_id,
    'scheduleProjectId', v_workspace.schedule_project_id,
    'documentVersionId', v_workspace.document_version_id,
    'parserGenerationId', v_workspace.parser_generation_id,
    'extractionFingerprint', v_workspace.extraction_fingerprint,
    'inserted', v_workspace.inserted,
    'reused', not v_workspace.inserted
  );
end;
$$;

create or replace function public.bidoc_contracts_insert_clause_r1(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clause record;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'Clause payload must be an object';
  end if;

  insert into private.contracts_documents (
    workspace_id,
    source_project_id,
    document_version_id,
    document_sha256,
    parser_generation_id,
    clause_key,
    parent_clause_key,
    clause_type,
    clause_title,
    clause_order,
    page_start,
    page_end,
    raw_text,
    raw_text_sha256,
    raw_data,
    parser_version,
    extractor_version
  ) values (
    (p_payload ->> 'workspaceId')::uuid,
    (p_payload ->> 'sourceProjectId')::uuid,
    lower(p_payload ->> 'documentVersionId'),
    lower(p_payload ->> 'documentSha256'),
    lower(p_payload ->> 'parserGenerationId'),
    p_payload ->> 'clauseKey',
    nullif(p_payload ->> 'parentClauseKey', ''),
    p_payload ->> 'clauseType',
    nullif(p_payload ->> 'clauseTitle', ''),
    (p_payload ->> 'clauseOrder')::integer,
    (p_payload ->> 'pageStart')::integer,
    (p_payload ->> 'pageEnd')::integer,
    p_payload ->> 'rawText',
    lower(p_payload ->> 'rawTextSha256'),
    p_payload -> 'rawData',
    p_payload ->> 'parserVersion',
    p_payload ->> 'extractorVersion'
  )
  on conflict (workspace_id, document_version_id, parser_generation_id, clause_key)
  do nothing
  returning private.contracts_documents.*, true as inserted into v_clause;

  if not found then
    select private.contracts_documents.*, false as inserted into v_clause
    from private.contracts_documents
    where workspace_id = (p_payload ->> 'workspaceId')::uuid
      and document_version_id = lower(p_payload ->> 'documentVersionId')
      and parser_generation_id = lower(p_payload ->> 'parserGenerationId')
      and clause_key = p_payload ->> 'clauseKey';
    if v_clause.raw_text_sha256 <> lower(p_payload ->> 'rawTextSha256') then
      raise exception using
        errcode = '23505',
        message = 'Clause identity already exists with a different source hash';
    end if;
  end if;

  return jsonb_build_object(
    'clauseId', v_clause.id,
    'clauseKey', v_clause.clause_key,
    'rawTextSha256', v_clause.raw_text_sha256,
    'inserted', v_clause.inserted,
    'reused', not v_clause.inserted
  );
end;
$$;

create or replace function public.bidoc_contracts_append_decision_r1(
  p_expected_revision integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current private.contracts%rowtype;
  v_inserted private.contracts%rowtype;
  v_workspace_id uuid;
  v_document_version_id text;
  v_parser_generation_id text;
  v_decision_key text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Decision payload and expected revision are invalid';
  end if;

  v_workspace_id := (p_payload ->> 'workspaceId')::uuid;
  v_document_version_id := lower(p_payload ->> 'documentVersionId');
  v_parser_generation_id := lower(p_payload ->> 'parserGenerationId');
  v_decision_key := p_payload ->> 'decisionKey';

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_workspace_id::text || chr(31) || v_document_version_id || chr(31)
    || v_parser_generation_id || chr(31) || v_decision_key,
    0
  ));

  select * into v_current
  from private.contracts
  where workspace_id = v_workspace_id
    and document_version_id = v_document_version_id
    and parser_generation_id = v_parser_generation_id
    and decision_key = v_decision_key
  order by revision desc
  limit 1;

  if (case when found then v_current.revision else 0 end) <> p_expected_revision then
    raise exception using
      errcode = '40001',
      message = 'Contract decision revision is stale',
      detail = format(
        'Expected revision %s but the current revision is %s.',
        p_expected_revision,
        case when found then v_current.revision else 0 end
      );
  end if;

  insert into private.contracts (
    workspace_id,
    source_project_id,
    schedule_project_id,
    document_version_id,
    parser_generation_id,
    decision_key,
    revision,
    supersedes_decision_id,
    primary_clause_id,
    source_evidence,
    title_he,
    summary_he,
    decision_text_he,
    tags,
    people,
    responsible_party,
    beneficiary,
    decision_category,
    conflict_status,
    schedule_impact,
    temporal_kind,
    contract_date,
    trigger_kind,
    trigger_description_he,
    offset_value,
    offset_unit,
    calendar_semantics,
    recurring,
    review_status,
    reviewer_id,
    reviewed_at,
    review_reason,
    projection_status,
    model_version,
    decision_policy_version
  ) values (
    v_workspace_id,
    (p_payload ->> 'sourceProjectId')::uuid,
    nullif(p_payload ->> 'scheduleProjectId', '')::uuid,
    v_document_version_id,
    v_parser_generation_id,
    v_decision_key,
    p_expected_revision + 1,
    case when p_expected_revision = 0 then null else v_current.id end,
    nullif(p_payload ->> 'primaryClauseId', '')::uuid,
    p_payload -> 'sourceEvidence',
    p_payload ->> 'titleHe',
    p_payload ->> 'summaryHe',
    p_payload ->> 'decisionTextHe',
    coalesce(array(select jsonb_array_elements_text(p_payload -> 'tags')), '{}'::text[]),
    coalesce(p_payload -> 'people', '[]'::jsonb),
    nullif(p_payload ->> 'responsibleParty', ''),
    nullif(p_payload ->> 'beneficiary', ''),
    p_payload ->> 'decisionCategory',
    coalesce(p_payload ->> 'conflictStatus', 'none'),
    coalesce(p_payload ->> 'scheduleImpact', 'unknown'),
    coalesce(p_payload ->> 'temporalKind', 'none'),
    nullif(p_payload ->> 'contractDate', '')::date,
    nullif(p_payload ->> 'triggerKind', ''),
    nullif(p_payload ->> 'triggerDescriptionHe', ''),
    nullif(p_payload ->> 'offsetValue', '')::numeric,
    nullif(p_payload ->> 'offsetUnit', ''),
    coalesce(p_payload ->> 'calendarSemantics', 'unknown'),
    coalesce((p_payload ->> 'recurring')::boolean, false),
    coalesce(p_payload ->> 'reviewStatus', 'proposed'),
    nullif(p_payload ->> 'reviewerId', '')::uuid,
    nullif(p_payload ->> 'reviewedAt', '')::timestamptz,
    nullif(p_payload ->> 'reviewReason', ''),
    coalesce(p_payload ->> 'projectionStatus', 'blocked'),
    p_payload ->> 'modelVersion',
    p_payload ->> 'decisionPolicyVersion'
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'decisionId', v_inserted.id,
    'decisionKey', v_inserted.decision_key,
    'revision', v_inserted.revision,
    'supersedesDecisionId', v_inserted.supersedes_decision_id
  );
end;
$$;

create or replace function public.bidoc_contracts_append_relationship_r1(
  p_expected_revision integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current private.contract_relationships%rowtype;
  v_predecessor private.contract_relationships%rowtype;
  v_inserted private.contract_relationships%rowtype;
  v_workspace_id uuid;
  v_document_version_id text;
  v_parser_generation_id text;
  v_policy_version text;
  v_relationship_key text;
  v_source_clause_id uuid;
  v_source_decision_id uuid;
  v_target_clause_id uuid;
  v_target_decision_id uuid;
  v_supersedes_relationship_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) <> 'object' or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Relationship payload and expected revision are invalid';
  end if;

  v_workspace_id := (p_payload ->> 'workspaceId')::uuid;
  v_document_version_id := lower(p_payload ->> 'documentVersionId');
  v_parser_generation_id := lower(p_payload ->> 'parserGenerationId');
  v_policy_version := p_payload ->> 'relationshipPolicyVersion';
  v_source_clause_id := nullif(p_payload ->> 'sourceClauseId', '')::uuid;
  v_source_decision_id := nullif(p_payload ->> 'sourceDecisionId', '')::uuid;
  v_target_clause_id := nullif(p_payload ->> 'targetClauseId', '')::uuid;
  v_target_decision_id := nullif(p_payload ->> 'targetDecisionId', '')::uuid;
  v_relationship_key := private.bidoc_contracts_relationship_key_r1(
    v_document_version_id,
    v_parser_generation_id,
    p_payload ->> 'relationshipType',
    v_source_clause_id,
    v_source_decision_id,
    v_target_clause_id,
    v_target_decision_id
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_workspace_id::text || chr(31) || v_policy_version || chr(31) || v_relationship_key,
    0
  ));

  select * into v_current
  from private.contract_relationships
  where workspace_id = v_workspace_id
    and document_version_id = v_document_version_id
    and parser_generation_id = v_parser_generation_id
    and relationship_policy_version = v_policy_version
    and relationship_key = v_relationship_key
  order by revision desc
  limit 1;

  if found and p_expected_revision = 0 and v_current.revision = 1
     and v_current.origin = (p_payload ->> 'origin')
     and v_current.confidence is not distinct from nullif(p_payload ->> 'confidence', '')::numeric
     and v_current.evidence = p_payload -> 'evidence'
     and v_current.model_version = (p_payload ->> 'modelVersion')
     and v_current.review_status = coalesce(p_payload ->> 'reviewStatus', 'proposed') then
    return jsonb_build_object(
      'relationshipId', v_current.id,
      'relationshipKey', v_current.relationship_key,
      'revision', v_current.revision,
      'inserted', false,
      'reused', true
    );
  end if;

  if (case when found then v_current.revision else 0 end) <> p_expected_revision then
    raise exception using
      errcode = '40001',
      message = 'Contract relationship revision is stale',
      detail = format(
        'Expected revision %s but the current revision is %s.',
        p_expected_revision,
        case when found then v_current.revision else 0 end
      );
  end if;

  if p_expected_revision > 0 then
    v_supersedes_relationship_id := v_current.id;
  else
    v_supersedes_relationship_id := nullif(p_payload ->> 'supersedesRelationshipId', '')::uuid;
    if v_supersedes_relationship_id is not null then
      select * into v_predecessor
      from private.contract_relationships
      where id = v_supersedes_relationship_id;
      if not found
         or v_predecessor.workspace_id <> v_workspace_id
         or v_predecessor.document_version_id <> v_document_version_id
         or v_predecessor.parser_generation_id <> v_parser_generation_id
         or v_predecessor.relationship_key <> v_relationship_key
         or v_predecessor.relationship_policy_version = v_policy_version then
        raise exception using errcode = '23514', message = 'New relationship policy predecessor is incompatible';
      end if;
    end if;
  end if;

  insert into private.contract_relationships (
    workspace_id,
    document_version_id,
    parser_generation_id,
    source_clause_id,
    source_decision_id,
    target_clause_id,
    target_decision_id,
    relationship_type,
    origin,
    confidence,
    evidence,
    model_version,
    relationship_policy_version,
    review_status,
    reviewer_id,
    reviewed_at,
    review_reason,
    revision,
    supersedes_relationship_id
  ) values (
    v_workspace_id,
    v_document_version_id,
    v_parser_generation_id,
    v_source_clause_id,
    v_source_decision_id,
    v_target_clause_id,
    v_target_decision_id,
    p_payload ->> 'relationshipType',
    p_payload ->> 'origin',
    nullif(p_payload ->> 'confidence', '')::numeric,
    p_payload -> 'evidence',
    p_payload ->> 'modelVersion',
    v_policy_version,
    coalesce(p_payload ->> 'reviewStatus', 'proposed'),
    nullif(p_payload ->> 'reviewerId', '')::uuid,
    nullif(p_payload ->> 'reviewedAt', '')::timestamptz,
    nullif(p_payload ->> 'reviewReason', ''),
    p_expected_revision + 1,
    v_supersedes_relationship_id
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'relationshipId', v_inserted.id,
    'relationshipKey', v_inserted.relationship_key,
    'revision', v_inserted.revision,
    'supersedesRelationshipId', v_inserted.supersedes_relationship_id,
    'inserted', true,
    'reused', false
  );
end;
$$;

revoke execute on function public.bidoc_contracts_schema_status_r1()
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_upsert_workspace_r1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_insert_clause_r1(jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_append_decision_r1(integer,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_append_relationship_r1(integer,jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_schema_status_r1() to service_role;
grant execute on function public.bidoc_contracts_upsert_workspace_r1(jsonb) to service_role;
grant execute on function public.bidoc_contracts_insert_clause_r1(jsonb) to service_role;
grant execute on function public.bidoc_contracts_append_decision_r1(integer,jsonb) to service_role;
grant execute on function public.bidoc_contracts_append_relationship_r1(integer,jsonb) to service_role;
