set role service_role;

do $test$
declare
  payload jsonb := jsonb_build_object(
    'sourceProjectId', '11111111-1111-4111-8111-111111111111',
    'scheduleProjectId', '22222222-2222-4222-8222-222222222222',
    'projectSite', 'Phase 3F.1 local fixture',
    'documentVersionId', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'documentSha256', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'filename', 'fixture.pdf',
    'mediaType', 'application/pdf',
    'byteCount', 1024,
    'storageBucket', 'contracts-private',
    'storageObjectKey', '11111111-1111-4111-8111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf',
    'extractionFingerprint', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'extractionSchemaVersion', 'contract-extraction.v1',
    'extractionVersion', 'contracts-compiler.phase1.v1',
    'extraction', jsonb_build_object(
      'schemaVersion', 'contract-extraction.v1',
      'document', jsonb_build_object(
        'documentVersionId', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      ),
      'candidates', jsonb_build_array(jsonb_build_object('candidateKey', 'candidate:one'))
    ),
    'candidateCount', 1,
    'createdBy', '44444444-4444-4444-8444-444444444444'
  );
  first_result jsonb;
  second_result jsonb;
  alternate_schedule_result jsonb;
  fingerprint_upgrade_result jsonb;
  v_workspace_id uuid;
  draft_result jsonb;
  found_result jsonb;
  wrong_schedule_result jsonb;
  listed_result jsonb;
  immutable_blocked boolean := false;
  immutable_id_blocked boolean := false;
  immutable_version_blocked boolean := false;
  stale_draft_blocked boolean := false;
  stale_message text;
begin
  if public.bidoc_contracts_workspace_status_v1() ->> 'migrationVersion' <> '20260812135210' then
    raise exception 'Unexpected workspace migration status';
  end if;

  first_result := public.bidoc_contracts_upsert_workspace_v1(payload);
  second_result := public.bidoc_contracts_upsert_workspace_v1(
    jsonb_set(payload, '{extraction,document,unexpected}', '"must-not-replace-existing"'::jsonb, true)
  );
  v_workspace_id := (first_result ->> 'workspaceId')::uuid;
  if v_workspace_id is null
     or first_result ->> 'inserted' <> 'true'
     or first_result ->> 'reused' <> 'false'
     or second_result ->> 'workspaceId' <> v_workspace_id::text
     or second_result ->> 'inserted' <> 'false'
     or second_result ->> 'reused' <> 'true' then
    raise exception 'Workspace upsert is not idempotent';
  end if;
  if (select count(*) from private.contract_workspaces) <> 1 then
    raise exception 'Workspace upsert created a duplicate row';
  end if;
  if second_result #>> '{extraction,document,unexpected}' is not null
     or second_result #>> '{extraction,document,documentVersionId}'
       <> 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
     or (select extraction_json #>> '{document,unexpected}' from private.contract_workspaces where id = v_workspace_id) is not null then
    raise exception 'Idempotent workspace reuse did not return the canonical immutable extraction';
  end if;

  wrong_schedule_result := public.bidoc_contracts_find_workspace_v1(
    '11111111-1111-4111-8111-111111111111',
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444'
  );
  if wrong_schedule_result is not null then
    raise exception 'Workspace find crossed the Schedule project boundary';
  end if;

  alternate_schedule_result := public.bidoc_contracts_upsert_workspace_v1(
    jsonb_set(payload, '{scheduleProjectId}', '"33333333-3333-4333-8333-333333333333"'::jsonb)
  );
  if alternate_schedule_result ->> 'inserted' <> 'true'
     or alternate_schedule_result ->> 'workspaceId' = v_workspace_id::text then
    raise exception 'Schedule project identity did not create a distinct workspace';
  end if;

  fingerprint_upgrade_result := public.bidoc_contracts_upsert_workspace_v1(
    jsonb_set(
      payload,
      '{extractionFingerprint}',
      '"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"'::jsonb
    )
  );
  if fingerprint_upgrade_result ->> 'inserted' <> 'true'
     or fingerprint_upgrade_result ->> 'workspaceId' = v_workspace_id::text then
    raise exception 'Extraction fingerprint upgrade did not create a distinct workspace';
  end if;
  if (select count(*) from private.contract_workspaces) <> 3
     or (select count(distinct storage_bucket || '/' || storage_object_key) from private.contract_workspaces) <> 1 then
    raise exception 'Content-addressed PDF object was not shared across workspace identities';
  end if;

  draft_result := public.bidoc_contracts_save_review_draft_v1(
    v_workspace_id,
    '44444444-4444-4444-8444-444444444444',
    0,
    jsonb_build_object(
      'decisions', jsonb_build_object(
        'candidate:one', jsonb_build_object(
          'action', 'reject',
          'reason', 'Reviewed against the exact source quote.'
        )
      ),
      'reviewReason', 'Local Phase 3F.1 draft verification.',
      'batchId', 'contracts-review-local-1',
      'reviewedAt', '2026-08-12T12:00:00.000Z',
      'mappingDraft', null,
      'candidateCount', 1,
      'reviewedCount', 1,
      'approvedCount', 0,
      'rejectedCount', 1
    )
  );
  if draft_result ->> 'revision' <> '1' then
    raise exception 'First draft revision is invalid: %', draft_result;
  end if;
  draft_result := public.bidoc_contracts_save_review_draft_v1(
    v_workspace_id,
    '44444444-4444-4444-8444-444444444444',
    1,
    jsonb_build_object(
      'decisions', jsonb_build_object(
        'candidate:one', jsonb_build_object(
          'action', 'approve',
          'reason', 'Reviewed again against the exact source quote.'
        )
      ),
      'reviewReason', 'Updated local Phase 3F.1 draft verification.',
      'batchId', 'contracts-review-local-1',
      'reviewedAt', '2026-08-12T12:05:00.000Z',
      'mappingDraft', jsonb_build_object('candidateKey', 'candidate:one'),
      'candidateCount', 1,
      'reviewedCount', 1,
      'approvedCount', 1,
      'rejectedCount', 0
    )
  );
  if draft_result ->> 'revision' <> '2' then
    raise exception 'Draft upsert did not increment revision: %', draft_result;
  end if;

  begin
    perform public.bidoc_contracts_save_review_draft_v1(
      v_workspace_id,
      '44444444-4444-4444-8444-444444444444',
      1,
      jsonb_build_object(
        'decisions', jsonb_build_object(
          'candidate:one', jsonb_build_object(
            'action', 'reject',
            'reason', 'This stale write must not replace revision two.'
          )
        ),
        'reviewReason', 'Stale local Phase 3F.1 draft verification.',
        'batchId', 'contracts-review-local-1',
        'reviewedAt', '2026-08-12T12:10:00.000Z',
        'mappingDraft', null,
        'candidateCount', 1,
        'reviewedCount', 1,
        'approvedCount', 0,
        'rejectedCount', 1
      )
    );
  exception when sqlstate '40001' then
    get stacked diagnostics stale_message = message_text;
    stale_draft_blocked := stale_message = 'Saved contract review draft revision is stale';
  end;
  if not stale_draft_blocked
     or (select revision from private.contract_review_drafts where workspace_id = v_workspace_id and reviewer_id = '44444444-4444-4444-8444-444444444444') <> 2
     or (select decisions_json #>> '{candidate:one,action}' from private.contract_review_drafts where workspace_id = v_workspace_id and reviewer_id = '44444444-4444-4444-8444-444444444444') <> 'approve' then
    raise exception 'Stale draft revision did not fail closed';
  end if;

  found_result := public.bidoc_contracts_find_workspace_v1(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444'
  );
  if found_result ->> 'workspaceId' <> v_workspace_id::text
     or found_result #>> '{draft,revision}' <> '2'
     or found_result #>> '{extraction,document,documentVersionId}'
       <> 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' then
    raise exception 'Workspace reopen did not restore extraction and draft: %', found_result;
  end if;

  listed_result := public.bidoc_contracts_list_workspaces_v1(
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    50
  );
  if jsonb_array_length(listed_result -> 'items') <> 3
     or not exists (
       select 1
       from jsonb_array_elements(listed_result -> 'items') item
       where item ->> 'workspaceId' = v_workspace_id::text
         and item #>> '{draft,revision}' = '2'
     ) then
    raise exception 'Workspace list did not expose current review progress: %', listed_result;
  end if;

  begin
    update private.contract_workspaces
    set extraction_json = jsonb_set(extraction_json, '{tampered}', 'true'::jsonb)
    where id = v_workspace_id;
  exception when sqlstate '55000' then
    immutable_blocked := true;
  end;
  if not immutable_blocked then
    raise exception 'Immutable extraction accepted a direct update';
  end if;

  begin
    update private.contract_workspaces
    set id = '77777777-7777-4777-8777-777777777777'
    where id = v_workspace_id;
  exception when sqlstate '55000' then
    immutable_id_blocked := true;
  end;
  begin
    update private.contract_workspaces
    set workspace_version = 'tampered-workspace-version'
    where id = v_workspace_id;
  exception when sqlstate '55000' then
    immutable_version_blocked := true;
  end;
  if not immutable_id_blocked or not immutable_version_blocked then
    raise exception 'Workspace identity/version immutability is incomplete';
  end if;
end;
$test$;

do $test$
begin
  if has_table_privilege('anon', 'private.contract_workspaces', 'select')
     or has_table_privilege('authenticated', 'private.contract_review_drafts', 'insert')
     or has_table_privilege('service_role', 'private.contract_workspaces', 'delete')
     or has_table_privilege('service_role', 'private.contract_review_drafts', 'truncate') then
    raise exception 'Saved workspace tables expose a forbidden privilege';
  end if;
  if not has_table_privilege('service_role', 'private.contract_workspaces', 'select,insert,update')
     or not has_table_privilege('service_role', 'private.contract_review_drafts', 'select,insert,update') then
    raise exception 'service_role is missing a required saved workspace privilege';
  end if;
  if has_function_privilege('anon', 'public.bidoc_contracts_get_workspace_v1(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_save_review_draft_v1(uuid,uuid,bigint,jsonb)', 'execute') then
    raise exception 'Browser roles unexpectedly retain saved workspace RPC execution';
  end if;
  if not has_function_privilege('service_role', 'public.bidoc_contracts_find_workspace_v1(uuid,uuid,text,text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_save_review_draft_v1(uuid,uuid,bigint,jsonb)', 'execute') then
    raise exception 'service_role is missing an updated saved workspace RPC privilege';
  end if;
  if to_regprocedure('public.bidoc_contracts_find_workspace_v1(uuid,text,text,uuid)') is not null
     or to_regprocedure('public.bidoc_contracts_save_review_draft_v1(uuid,uuid,jsonb)') is not null then
    raise exception 'A pre-review saved workspace RPC overload remains installed';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'private.contract_workspaces'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'private.contract_review_drafts'::regclass) then
    raise exception 'RLS is not enabled on saved workspace tables';
  end if;
  if to_regclass('private.contract_review_drafts_reviewer_recent_idx') is null then
    raise exception 'Draft reviewer/recent index is missing';
  end if;
  if to_regclass('private.contract_workspaces_storage_object_idx') is null
     or exists (
       select 1
       from pg_constraint
       where conrelid = 'private.contract_workspaces'::regclass
         and conname = 'contract_workspaces_storage_object_key_key'
     ) then
    raise exception 'Storage object sharing index/constraint is invalid';
  end if;
  if not (
    select attnotnull
    from pg_attribute
    where attrelid = 'private.contract_workspaces'::regclass
      and attname = 'schedule_project_id'
  ) then
    raise exception 'Schedule project identity must be required';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.contract_workspaces'::regclass
      and conname = 'contract_workspaces_project_document_fingerprint_key'
      and pg_get_constraintdef(oid, true)
        = 'UNIQUE (source_project_id, schedule_project_id, document_sha256, extraction_fingerprint)'
  ) then
    raise exception 'Workspace identity constraint does not include the Schedule project';
  end if;
end;
$test$;

reset role;
