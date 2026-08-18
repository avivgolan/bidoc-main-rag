-- Isolated behavioral/security fixture for Contracts Pipeline R1.

set role service_role;

create temporary table r1_fixture_ids (
  name text primary key,
  id uuid not null
);

create temporary table r1_schedule_counts as
select
  (select count(*) from public.schedule_contract_milestones) as milestones,
  (select count(*) from public.schedule_contract_conditions) as conditions,
  (select count(*) from public.schedule_contract_extensions) as extensions;

do $test$
declare
  v_source_project uuid := '11111111-1111-4111-8111-111111111111';
  v_other_source_project uuid := '99999999-9999-4999-8999-999999999999';
  v_schedule_project uuid := '22222222-2222-4222-8222-222222222222';
  v_reviewer uuid := '44444444-4444-4444-8444-444444444444';
  v_document_sha text := repeat('a', 64);
  v_document_version text := 'sha256:' || repeat('a', 64);
  v_other_document_sha text := repeat('d', 64);
  v_other_document_version text := 'sha256:' || repeat('d', 64);
  v_generation_one text := 'parser-generation:sha256:' || repeat('b', 64);
  v_generation_two text := 'parser-generation:sha256:' || repeat('c', 64);
  v_workspace_one uuid;
  v_workspace_two uuid;
  v_workspace_cross uuid;
  v_workspace_other_document uuid;
  v_clause_one uuid;
  v_clause_two uuid;
  v_clause_generation_two uuid;
  v_clause_cross uuid;
  v_clause_other_document uuid;
  v_decision_one uuid;
  v_decision_two uuid;
  v_relationship_one uuid;
  v_relationship_two uuid;
  v_result jsonb;
  v_payload jsonb;
  v_source_evidence jsonb;
  v_relationship_evidence jsonb;
  v_failed boolean;
begin
  insert into public.projects (id, name)
  values (v_schedule_project, 'R1 local schedule fixture')
  on conflict (id) do nothing;

  v_payload := jsonb_build_object(
    'sourceProjectId', v_source_project,
    'documentVersionId', v_document_version,
    'documentSha256', v_document_sha,
    'filename', 'contract-a.pdf',
    'mediaType', 'application/pdf',
    'byteCount', 1024,
    'storageBucket', 'contracts-private',
    'storageObjectKey', 'sha256/' || v_document_sha || '.pdf',
    'extractionSchemaVersion', 'contracts-extraction.r1.v1',
    'extractionVersion', 'agent-a.not-started',
    'extraction', jsonb_build_object('coverageLedger', jsonb_build_array()),
    'createdBy', v_reviewer,
    'parserGenerationId', v_generation_one,
    'parserVersion', 'segmenter.r1.v1',
    'promptVersion', 'not_applicable',
    'extractorVersion', 'extractor.r1.v1'
  );
  v_result := public.bidoc_contracts_upsert_workspace_r1(v_payload);
  v_workspace_one := (v_result ->> 'workspaceId')::uuid;
  if v_result ->> 'inserted' <> 'true'
     or v_result ->> 'scheduleProjectId' is not null then
    raise exception 'R1 workspace was not inserted with nullable Schedule mapping: %', v_result;
  end if;

  v_result := public.bidoc_contracts_upsert_workspace_r1(
    jsonb_set(v_payload, '{extraction,rerunMarker}', 'true'::jsonb, true)
  );
  if (v_result ->> 'workspaceId')::uuid <> v_workspace_one
     or v_result ->> 'reused' <> 'true' then
    raise exception 'R1 workspace rerun was not idempotent: %', v_result;
  end if;

  v_result := public.bidoc_contracts_upsert_workspace_r1(
    jsonb_set(v_payload, '{parserGenerationId}', to_jsonb(v_generation_two))
  );
  v_workspace_two := (v_result ->> 'workspaceId')::uuid;
  if v_workspace_two = v_workspace_one then
    raise exception 'Parser generation did not create a distinct workspace';
  end if;

  v_result := public.bidoc_contracts_upsert_workspace_r1(
    jsonb_set(v_payload, '{sourceProjectId}', to_jsonb(v_other_source_project))
  );
  v_workspace_cross := (v_result ->> 'workspaceId')::uuid;

  v_result := public.bidoc_contracts_upsert_workspace_r1(
    jsonb_set(
      jsonb_set(v_payload, '{documentSha256}', to_jsonb(v_other_document_sha)),
      '{documentVersionId}', to_jsonb(v_other_document_version)
    )
  );
  v_workspace_other_document := (v_result ->> 'workspaceId')::uuid;

  v_payload := jsonb_build_object(
    'workspaceId', v_workspace_one,
    'sourceProjectId', v_source_project,
    'documentVersionId', v_document_version,
    'documentSha256', v_document_sha,
    'parserGenerationId', v_generation_one,
    'clauseKey', 'clause:1',
    'clauseType', 'clause',
    'clauseTitle', 'Clause one',
    'clauseOrder', 1,
    'pageStart', 1,
    'pageEnd', 1,
    'rawText', 'Exact clause one text.',
    'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Exact clause one text.', 'UTF8')), 'hex'),
    'rawData', jsonb_build_object(
      'segments',
      jsonb_build_array(jsonb_build_object('page', 1, 'text', 'Exact clause one text.'))
    ),
    'parserVersion', 'segmenter.r1.v1',
    'extractorVersion', 'extractor.r1.v1'
  );
  v_result := public.bidoc_contracts_insert_clause_r1(v_payload);
  v_clause_one := (v_result ->> 'clauseId')::uuid;
  if v_result ->> 'inserted' <> 'true' then
    raise exception 'First clause insert did not report inserted';
  end if;
  v_result := public.bidoc_contracts_insert_clause_r1(v_payload);
  if (v_result ->> 'clauseId')::uuid <> v_clause_one
     or v_result ->> 'reused' <> 'true' then
    raise exception 'Clause rerun was not idempotent';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_insert_clause_r1(
      jsonb_set(
        jsonb_set(v_payload, '{rawText}', '"Different source bytes."'::jsonb),
        '{rawTextSha256}',
        to_jsonb(encode(pg_catalog.sha256(pg_catalog.convert_to('Different source bytes.', 'UTF8')), 'hex'))
      )
    );
  exception when unique_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Clause identity accepted a conflicting source hash';
  end if;

  v_payload := v_payload
    || jsonb_build_object(
      'clauseKey', 'clause:2',
      'clauseOrder', 2,
      'rawText', 'Exact clause two text.',
      'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Exact clause two text.', 'UTF8')), 'hex')
    );
  v_clause_two := (public.bidoc_contracts_insert_clause_r1(v_payload) ->> 'clauseId')::uuid;

  v_payload := v_payload
    || jsonb_build_object(
      'workspaceId', v_workspace_two,
      'parserGenerationId', v_generation_two,
      'clauseKey', 'clause:1',
      'clauseOrder', 1,
      'rawText', 'Generation two clause text.',
      'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Generation two clause text.', 'UTF8')), 'hex')
    );
  v_clause_generation_two := (public.bidoc_contracts_insert_clause_r1(v_payload) ->> 'clauseId')::uuid;

  v_payload := v_payload
    || jsonb_build_object(
      'workspaceId', v_workspace_cross,
      'sourceProjectId', v_other_source_project,
      'parserGenerationId', v_generation_one,
      'rawText', 'Cross-workspace clause text.',
      'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Cross-workspace clause text.', 'UTF8')), 'hex')
    );
  v_clause_cross := (public.bidoc_contracts_insert_clause_r1(v_payload) ->> 'clauseId')::uuid;

  v_payload := v_payload
    || jsonb_build_object(
      'workspaceId', v_workspace_other_document,
      'sourceProjectId', v_source_project,
      'documentVersionId', v_other_document_version,
      'documentSha256', v_other_document_sha,
      'rawText', 'Other-document clause text.',
      'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Other-document clause text.', 'UTF8')), 'hex')
    );
  v_clause_other_document := (public.bidoc_contracts_insert_clause_r1(v_payload) ->> 'clauseId')::uuid;

  v_failed := false;
  begin
    perform public.bidoc_contracts_insert_clause_r1(
      v_payload || jsonb_build_object(
        'clauseKey', 'clause:invalid-raw-data',
        'clauseOrder', 99,
        'rawText', 'Invalid raw-data shape.',
        'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Invalid raw-data shape.', 'UTF8')), 'hex'),
        'rawData', jsonb_build_object('segments', jsonb_build_array(jsonb_build_object('page', 1)))
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Clause accepted an unbounded/incomplete raw_data shape';
  end if;

  v_source_evidence := jsonb_build_array(jsonb_build_object(
    'clauseId', v_clause_one,
    'pageStart', 1,
    'pageEnd', 1,
    'rawTextSha256', encode(pg_catalog.sha256(pg_catalog.convert_to('Exact clause one text.', 'UTF8')), 'hex'),
    'excerpt', 'Exact clause one text.'
  ));
  v_relationship_evidence := jsonb_build_object(
    'excerpts', v_source_evidence,
    'rationaleHe', 'Exact bounded relationship evidence for the local R1 fixture.'
  );

  v_payload := jsonb_build_object(
    'workspaceId', v_workspace_one,
    'sourceProjectId', v_source_project,
    'documentVersionId', v_document_version,
    'parserGenerationId', v_generation_one,
    'decisionKey', 'decision:one',
    'primaryClauseId', v_clause_one,
    'sourceEvidence', v_source_evidence,
    'titleHe', 'Decision one',
    'summaryHe', 'Decision one summary',
    'decisionTextHe', 'Decision one normalized meaning',
    'tags', jsonb_build_array('time'),
    'people', jsonb_build_array(),
    'decisionCategory', 'commencement_and_completion',
    'scheduleImpact', 'unknown',
    'temporalKind', 'none',
    'calendarSemantics', 'unknown',
    'reviewStatus', 'proposed',
    'projectionStatus', 'blocked',
    'modelVersion', 'model.r1',
    'decisionPolicyVersion', 'decision-policy.r1'
  );
  v_result := public.bidoc_contracts_append_decision_r1(0, v_payload);
  v_decision_one := (v_result ->> 'decisionId')::uuid;
  if v_result ->> 'revision' <> '1' then
    raise exception 'Decision revision one was not created';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_decision_r1(
      0,
      v_payload || jsonb_build_object(
        'decisionKey', 'decision:invalid-evidence',
        'sourceEvidence', jsonb_build_array(jsonb_build_object('clauseId', v_clause_one))
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Decision accepted an incomplete source_evidence shape';
  end if;

  v_result := public.bidoc_contracts_append_decision_r1(
    1,
    v_payload || jsonb_build_object(
      'reviewStatus', 'approved',
      'reviewerId', v_reviewer,
      'reviewedAt', '2026-08-15T10:00:00Z',
      'reviewReason', 'Approved against exact clause evidence.',
      'scheduleImpact', 'no',
      'projectionStatus', 'not_applicable'
    )
  );
  v_decision_one := (v_result ->> 'decisionId')::uuid;
  if v_result ->> 'revision' <> '2'
     or v_result ->> 'supersedesDecisionId' is null then
    raise exception 'Decision revision two did not supersede revision one';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_decision_r1(1, v_payload);
  exception when sqlstate '40001' then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Stale decision revision did not fail closed';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_decision_r1(
      0,
      v_payload || jsonb_build_object(
        'decisionKey', 'decision:invalid-ready',
        'scheduleImpact', 'yes',
        'reviewStatus', 'approved',
        'reviewerId', v_reviewer,
        'reviewedAt', '2026-08-15T10:00:00Z',
        'reviewReason', 'Ready mapping test.',
        'projectionStatus', 'ready'
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Projection readiness accepted a null Schedule project';
  end if;

  v_result := public.bidoc_contracts_append_decision_r1(
    0,
    v_payload || jsonb_build_object('decisionKey', 'decision:two', 'primaryClauseId', v_clause_two)
  );
  v_decision_two := (v_result ->> 'decisionId')::uuid;

  -- All four typed endpoint combinations.
  v_payload := jsonb_build_object(
    'workspaceId', v_workspace_one,
    'documentVersionId', v_document_version,
    'parserGenerationId', v_generation_one,
    'sourceClauseId', v_clause_one,
    'targetClauseId', v_clause_two,
    'relationshipType', 'cross_reference',
    'origin', 'explicit_reference',
    'evidence', v_relationship_evidence,
    'modelVersion', 'not_applicable',
    'relationshipPolicyVersion', 'relationship-policy.r1',
    'reviewStatus', 'proposed'
  );
  v_result := public.bidoc_contracts_append_relationship_r1(0, v_payload);
  v_relationship_one := (v_result ->> 'relationshipId')::uuid;
  if v_result ->> 'revision' <> '1' then
    raise exception 'Clause-to-clause relationship was not created';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_relationship_r1(
      0,
      v_payload || jsonb_build_object(
        'relationshipType', 'amends',
        'evidence', jsonb_build_object('excerpt', 'Incomplete evidence shape.')
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Relationship accepted an incomplete evidence shape';
  end if;
  v_result := public.bidoc_contracts_append_relationship_r1(0, v_payload);
  if v_result ->> 'reused' <> 'true' then
    raise exception 'Same-policy relationship rerun was not idempotent';
  end if;

  perform public.bidoc_contracts_append_relationship_r1(
    0,
    v_payload || jsonb_build_object(
      'sourceClauseId', v_clause_one,
      'targetClauseId', null,
      'targetDecisionId', v_decision_one,
      'relationshipType', 'supports_same_decision',
      'evidence', jsonb_set(v_relationship_evidence, '{rationaleHe}', '"Clause supports decision."'::jsonb)
    )
  );
  perform public.bidoc_contracts_append_relationship_r1(
    0,
    v_payload || jsonb_build_object(
      'sourceClauseId', null,
      'sourceDecisionId', v_decision_one,
      'targetClauseId', v_clause_two,
      'relationshipType', 'condition_of',
      'evidence', jsonb_set(v_relationship_evidence, '{rationaleHe}', '"Decision is conditioned by clause."'::jsonb)
    )
  );
  perform public.bidoc_contracts_append_relationship_r1(
    0,
    v_payload || jsonb_build_object(
      'sourceClauseId', null,
      'sourceDecisionId', v_decision_one,
      'targetClauseId', null,
      'targetDecisionId', v_decision_two,
      'relationshipType', 'depends_on',
      'evidence', jsonb_set(v_relationship_evidence, '{rationaleHe}', '"Decision one depends on decision two."'::jsonb)
    )
  );

  v_result := public.bidoc_contracts_append_relationship_r1(
    1,
    v_payload || jsonb_build_object(
      'reviewStatus', 'approved',
      'reviewerId', v_reviewer,
      'reviewedAt', '2026-08-15T10:05:00Z',
      'reviewReason', 'Relationship approved against exact evidence.',
      'evidence', jsonb_set(v_relationship_evidence, '{rationaleHe}', '"Reviewed clause reference."'::jsonb)
    )
  );
  v_relationship_two := (v_result ->> 'relationshipId')::uuid;
  if v_result ->> 'revision' <> '2'
     or (v_result ->> 'supersedesRelationshipId')::uuid <> v_relationship_one then
    raise exception 'Relationship correction did not append revision two';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_relationship_r1(1, v_payload);
  exception when sqlstate '40001' then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Stale relationship revision did not fail closed';
  end if;

  v_result := public.bidoc_contracts_append_relationship_r1(
    0,
    v_payload || jsonb_build_object(
      'relationshipPolicyVersion', 'relationship-policy.r2',
      'supersedesRelationshipId', v_relationship_two,
      'evidence', jsonb_set(v_relationship_evidence, '{rationaleHe}', '"New policy interpretation."'::jsonb)
    )
  );
  if v_result ->> 'revision' <> '1'
     or (v_result ->> 'supersedesRelationshipId')::uuid <> v_relationship_two then
    raise exception 'New relationship policy did not start at revision one with predecessor';
  end if;

  -- Canonical symmetric orientation rejects the reverse duplicate.
  if private.bidoc_contracts_endpoint_token_r1(v_clause_one, null)
     < private.bidoc_contracts_endpoint_token_r1(v_clause_two, null) then
    v_payload := v_payload || jsonb_build_object(
      'sourceClauseId', v_clause_one,
      'targetClauseId', v_clause_two,
      'relationshipType', 'duplicates',
      'origin', 'deterministic',
      'evidence', v_relationship_evidence || jsonb_build_object('signals', jsonb_build_object('duplicate', true)),
      'modelVersion', 'not_applicable',
      'relationshipPolicyVersion', 'relationship-policy.r1',
      'reviewStatus', 'proposed'
    );
  else
    v_payload := v_payload || jsonb_build_object(
      'sourceClauseId', v_clause_two,
      'targetClauseId', v_clause_one,
      'relationshipType', 'duplicates',
      'origin', 'deterministic',
      'evidence', v_relationship_evidence || jsonb_build_object('signals', jsonb_build_object('duplicate', true)),
      'modelVersion', 'not_applicable',
      'relationshipPolicyVersion', 'relationship-policy.r1',
      'reviewStatus', 'proposed'
    );
  end if;
  perform public.bidoc_contracts_append_relationship_r1(0, v_payload);
  v_failed := false;
  begin
    perform public.bidoc_contracts_append_relationship_r1(
      0,
      v_payload || jsonb_build_object(
        'sourceClauseId', v_payload ->> 'targetClauseId',
        'targetClauseId', v_payload ->> 'sourceClauseId'
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Reverse symmetric relationship was accepted';
  end if;

  -- Cross-workspace, cross-document, and cross-generation endpoints fail.
  foreach v_clause_generation_two in array array[v_clause_generation_two, v_clause_cross, v_clause_other_document]
  loop
    v_failed := false;
    begin
      perform public.bidoc_contracts_append_relationship_r1(
        0,
        jsonb_build_object(
          'workspaceId', v_workspace_one,
          'documentVersionId', v_document_version,
          'parserGenerationId', v_generation_one,
          'sourceClauseId', v_clause_one,
          'targetClauseId', v_clause_generation_two,
          'relationshipType', 'amends',
          'origin', 'human',
          'evidence', v_relationship_evidence,
          'modelVersion', 'not_applicable',
          'relationshipPolicyVersion', 'relationship-policy.scope-test',
          'reviewStatus', 'proposed'
        )
      );
    exception when foreign_key_violation then
      v_failed := true;
    end;
    if not v_failed then
      raise exception 'Cross-scope relationship endpoint was accepted';
    end if;
  end loop;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_relationship_r1(
      0,
      jsonb_build_object(
        'workspaceId', v_workspace_one,
        'documentVersionId', v_document_version,
        'parserGenerationId', v_generation_one,
        'sourceClauseId', v_clause_one,
        'targetDecisionId', v_decision_two,
        'relationshipType', 'amends',
        'origin', 'deterministic',
        'confidence', 0.5,
        'evidence', v_relationship_evidence,
        'modelVersion', 'not_applicable',
        'relationshipPolicyVersion', 'relationship-policy.origin-test',
        'reviewStatus', 'proposed'
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Non-model relationship accepted probabilistic confidence';
  end if;

  v_failed := false;
  begin
    perform public.bidoc_contracts_append_relationship_r1(
      0,
      jsonb_build_object(
        'workspaceId', v_workspace_one,
        'documentVersionId', v_document_version,
        'parserGenerationId', v_generation_one,
        'sourceClauseId', v_clause_one,
        'targetDecisionId', v_decision_two,
        'relationshipType', 'exception_to',
        'origin', 'model',
        'confidence', 1.1,
        'evidence', v_relationship_evidence,
        'modelVersion', 'model.r1',
        'relationshipPolicyVersion', 'relationship-policy.origin-test',
        'reviewStatus', 'proposed'
      )
    );
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Model relationship accepted confidence above one';
  end if;

  insert into r1_fixture_ids (name, id) values
    ('workspace', v_workspace_one),
    ('clause', v_clause_one),
    ('decision', v_decision_two),
    ('relationship', v_relationship_two);
end;
$test$;

do $test$
declare
  v_clause_id uuid := (select id from r1_fixture_ids where name = 'clause');
  v_failed boolean := false;
begin
  begin
    update private.contracts_documents
    set index_ref = '{}'::jsonb
    where id = v_clause_id;
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Clause accepted an incomplete index_ref shape';
  end if;

  update private.contracts_documents
  set index_ref = jsonb_build_object(
    'schemaVersion', 'contracts-index-ref.r1.v1',
    'provider', 'shared-data-index',
    'recordId', 'local-r1-record',
    'contentSha256', repeat('a', 64)
  )
  where id = v_clause_id;

  v_failed := false;
  begin
    update private.contracts_documents
    set raw_text = 'Tampered source text.'
    where id = v_clause_id;
  exception when sqlstate '55000' then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Clause source update was not blocked';
  end if;

  if has_table_privilege('anon', 'private.contracts_documents', 'select')
     or has_table_privilege('authenticated', 'private.contracts', 'insert')
     or has_table_privilege('service_role', 'private.contracts', 'update')
     or has_table_privilege('service_role', 'private.contract_relationships', 'delete')
     or has_table_privilege('service_role', 'private.contracts_documents', 'truncate') then
    raise exception 'R1 table privilege boundary is too broad';
  end if;
  if not has_table_privilege('service_role', 'private.contracts_documents', 'select,insert,update')
     or not has_table_privilege('service_role', 'private.contracts', 'select,insert')
     or not has_table_privilege('service_role', 'private.contract_relationships', 'select,insert') then
    raise exception 'service_role is missing an R1 table privilege';
  end if;

  if has_function_privilege('anon', 'public.bidoc_contracts_upsert_workspace_r1(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.bidoc_contracts_append_decision_r1(integer,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.bidoc_contracts_append_relationship_r1(integer,jsonb)', 'execute') then
    raise exception 'R1 RPC execution privilege boundary is invalid';
  end if;

  if exists (
    select 1
    from pg_class
    where oid in (
      'private.contracts_documents'::regclass,
      'private.contracts'::regclass,
      'private.contract_relationships'::regclass
    )
      and (not relrowsecurity or not relforcerowsecurity)
  ) then
    raise exception 'R1 table RLS is not enabled and forced';
  end if;

  if (select count(*) from private.contracts_documents) < 5
     or (select count(distinct parser_generation_id) from private.contracts_documents) <> 2
     or (select count(*) from private.contract_relationships) < 7 then
    raise exception 'R1 fixture rows or parser generations are incomplete';
  end if;

  if exists (
    select 1
    from r1_schedule_counts before
    where before.milestones <> (select count(*) from public.schedule_contract_milestones)
       or before.conditions <> (select count(*) from public.schedule_contract_conditions)
       or before.extensions <> (select count(*) from public.schedule_contract_extensions)
  ) then
    raise exception 'R1 migration or RPCs wrote to a Schedule target table';
  end if;
end;
$test$;

reset role;

do $test$
declare
  v_failed boolean := false;
begin
  begin
    delete from private.contracts_documents
    where id = (select id from r1_fixture_ids where name = 'clause');
  exception when sqlstate '55000' then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Superuser source deletion bypassed the database guard';
  end if;
end;
$test$;
