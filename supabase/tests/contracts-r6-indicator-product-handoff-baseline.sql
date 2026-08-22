create extension if not exists vector with schema public;
create schema if not exists private;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$roles$;

grant usage on schema private to service_role;

create table private.contract_workspaces (
  id uuid primary key,
  workspace_version text not null,
  source_project_id uuid not null,
  document_version_id text not null,
  parser_generation_id text not null,
  filename text not null
);

create table private.contracts_product_r6_fixture (
  id uuid primary key,
  project_id uuid not null,
  source_document_id uuid not null,
  created_at timestamptz not null default now(),
  title_he text not null,
  summary_he text not null,
  content text not null,
  metadata jsonb not null,
  hashtags text[] not null,
  embedding public.vector,
  responsible_party text,
  beneficiary text,
  category_he text not null,
  indicator_suitability text not null,
  timing jsonb,
  trigger_he text,
  trigger_description_he text,
  review_status text not null,
  reviewed_at timestamptz,
  review_reason_he text
);

create view private.contracts_product_r6_v1
with (security_invoker = true)
as
select * from private.contracts_product_r6_fixture;

grant select on private.contract_workspaces,
  private.contracts_product_r6_fixture,
  private.contracts_product_r6_v1
to service_role;

insert into private.contract_workspaces (
  id,
  workspace_version,
  source_project_id,
  document_version_id,
  parser_generation_id,
  filename
) values (
  '11111111-1111-4111-8111-111111111111',
  'contracts-workspace.r1.v1',
  '22222222-2222-4222-8222-222222222222',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'contracts-parser.fixture',
  'fixture.pdf'
);

insert into private.contracts_product_r6_fixture (
  id,
  project_id,
  source_document_id,
  title_he,
  summary_he,
  content,
  metadata,
  hashtags,
  category_he,
  indicator_suitability,
  timing,
  review_status,
  reviewed_at,
  review_reason_he
) values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  'החלטה חוזית לבדיקה',
  'החלטה חוזית מלאה שנשענת על סעיף המקור.',
  'הקבלן נדרש לבצע את החובה החוזית בהתאם לסעיף המקור.',
  jsonb_build_object(
    'workspaceId', '11111111-1111-4111-8111-111111111111',
    'documentVersionId', 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'parserGenerationId', 'contracts-parser.fixture',
    'decisionKey', 'contract:fixture:indicator-product',
    'revision', 1,
    'reviewStatusCode', 'approved',
    'conflictStatus', 'none',
    'sourceEvidence', jsonb_build_array(jsonb_build_object(
      'clauseId', '44444444-4444-4444-8444-444444444444',
      'clauseKey', '3.1',
      'pageStart', 2,
      'pageEnd', 2,
      'excerpt', 'ראיית מקור חוזית מלאה.'
    ))
  ),
  array['לוח זמנים'],
  'תחילה והשלמה',
  'מתאים',
  null,
  'מאושר',
  now(),
  'ההחלטה נבדקה מול סעיף המקור.'
);
