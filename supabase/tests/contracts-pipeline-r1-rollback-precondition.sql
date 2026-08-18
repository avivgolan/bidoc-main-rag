-- Creates only legacy/source and Schedule fixture rows. R1-owned tables remain empty.

set role service_role;

insert into public.projects (id, name)
values ('22222222-2222-4222-8222-222222222222', 'Rollback project')
on conflict (id) do nothing;

select public.bidoc_contracts_upsert_workspace_v1(jsonb_build_object(
  'sourceProjectId', '11111111-1111-4111-8111-111111111111',
  'scheduleProjectId', '22222222-2222-4222-8222-222222222222',
  'projectSite', 'rollback-site',
  'documentVersionId', 'sha256:' || repeat('e', 64),
  'documentSha256', repeat('e', 64),
  'filename', 'legacy-contract.pdf',
  'mediaType', 'application/pdf',
  'byteCount', 2048,
  'storageBucket', 'contracts-private',
  'storageObjectKey', 'sha256/' || repeat('e', 64) || '.pdf',
  'extractionFingerprint', repeat('f', 64),
  'extractionSchemaVersion', 'contracts-extraction.phase3f1.v1',
  'extractionVersion', 'legacy-fixture',
  'extraction', jsonb_build_object('candidates', jsonb_build_array()),
  'candidateCount', 0,
  'createdBy', '44444444-4444-4444-8444-444444444444'
));

insert into public.schedule_contract_milestones (
  id, project_id, milestone_key, name, contract_date
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'rollback-milestone',
  'Rollback milestone',
  '2026-08-15'
);

insert into public.schedule_contract_conditions (
  id, project_id, condition_key, name, category, anchor_kind
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'rollback-condition',
  'Rollback condition',
  'notice',
  'event'
);

insert into public.schedule_contract_extensions (
  id, project_id, milestone_key, extension_days, status
) values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '22222222-2222-4222-8222-222222222222',
  'rollback-milestone',
  5,
  'reviewed'
);

reset role;

do $test$
begin
  if exists (select 1 from private.contracts_documents)
     or exists (select 1 from private.contracts)
     or exists (select 1 from private.contract_relationships)
     or exists (
       select 1 from private.contract_workspaces
       where workspace_version = 'contracts-workspace.r1.v1'
     ) then
    raise exception 'Rollback precondition contains R1-owned data';
  end if;
end;
$test$;
