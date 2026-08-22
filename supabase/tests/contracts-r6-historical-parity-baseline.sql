create extension if not exists vector with schema public;
create schema if not exists private;

create table private.contract_workspaces (
  id uuid primary key,
  filename text not null
);

create table private.contract_tag_catalog (
  tag_he text primary key,
  active boolean not null default true
);

insert into private.contract_tag_catalog (tag_he)
values
  ('מסמך'), ('אישור'), ('ניהול_סיכונים'), ('שינוי_חוזה'), ('כספים'),
  ('תקשורת'), ('בקרה'), ('ביצוע'), ('חוזה'), ('תיאום'), ('עיכוב'),
  ('דיון'), ('תיעוד'), ('לוח_זמנים'), ('עדכון'), ('ניהול'), ('תשלום'),
  ('איכות'), ('בטיחות'), ('תוכנית_עבודה'), ('ניהול_מלאי'), ('תחזוקה');

create table private.contracts_documents (
  id uuid primary key,
  workspace_id uuid not null references private.contract_workspaces(id),
  processing_status text not null,
  hashtags text[] not null default '{}',
  content text,
  metadata jsonb,
  embedding public.vector,
  embedding_input_sha256 text,
  project_id uuid,
  attachment_id text,
  document_name text,
  chunk_index integer,
  chunk_total integer,
  index_ref jsonb
);

create table private.contracts (
  id uuid primary key,
  workspace_id uuid not null references private.contract_workspaces(id),
  document_version_id text not null,
  parser_generation_id text not null,
  decision_key text not null,
  revision integer not null,
  title_he text not null,
  summary_he text not null,
  decision_text_he text not null,
  tags text[] not null default '{}',
  trigger_kind text,
  embedding public.vector,
  embedding_input_sha256 text,
  project_id uuid,
  source_document_id uuid,
  content text,
  metadata jsonb,
  hashtags text[],
  category_he text,
  indicator_suitability text,
  schedule_project_id uuid,
  people jsonb not null default '[]',
  responsible_party text,
  beneficiary text,
  schedule_impact text not null default 'unknown',
  timing jsonb,
  trigger_he text,
  trigger_description_he text,
  recurring boolean not null default false,
  projection_status text not null default 'blocked',
  review_status text not null default 'proposed',
  reviewed_at timestamptz,
  review_reason_he text,
  created_at timestamptz not null default now()
);

create or replace function private.bidoc_contracts_r6_document_embedding_input(item private.contracts_documents)
returns text language sql immutable security invoker set search_path = '' as $$
  select btrim(coalesce(item.content, ''))
$$;

create or replace function private.bidoc_contracts_r6_decision_embedding_input(item private.contracts)
returns text language sql immutable security invoker set search_path = '' as $$
  select concat_ws(E'\n',
    'כותרת: ' || item.title_he,
    'תקציר: ' || item.summary_he,
    'משמעות חוזית: ' || item.decision_text_he,
    case when cardinality(item.tags) > 0 then 'תגיות: ' || array_to_string(item.tags, ' ') end,
    case when nullif(btrim(item.trigger_kind), '') is not null then 'טריגר חוזי: ' || item.trigger_kind end
  )
$$;

create or replace function public.bidoc_contracts_r6_apply_embeddings_v1(p_workspace_id uuid, p_records jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object('schemaVersion', 'contracts-r6-embedding-apply.v1', 'written', 0, 'reused', 0)
$$;

insert into private.contract_workspaces (id, filename)
values
  ('82345c75-c6f4-468d-b899-1f8407d9a9c1', 'historical.pdf'),
  ('4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa', 'new.pdf');

insert into private.contracts_documents (
  id, workspace_id, processing_status, hashtags, content, metadata,
  project_id, attachment_id, document_name, chunk_index, chunk_total
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '82345c75-c6f4-468d-b899-1f8407d9a9c1',
    'processed',
    array['responsibility', 'payment'],
    E'מקור: contracts_documents\nתגיות: responsibility payment\nטקסט מקורי:\nבדיקה',
    '{}'::jsonb,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bucket/historical.pdf', 'historical.pdf', 1, 1
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa',
    'processed',
    array['ביצוע'],
    E'מקור: contracts_documents\nתגיות: ביצוע\nטקסט מקורי:\nבדיקה',
    '{}'::jsonb,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bucket/new.pdf', 'new.pdf', 1, 1
  );

insert into private.contracts (
  id, workspace_id, document_version_id, parser_generation_id, decision_key, revision,
  title_he, summary_he, decision_text_he, tags, project_id, source_document_id,
  content, metadata, hashtags, category_he, indicator_suitability
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '82345c75-c6f4-468d-b899-1f8407d9a9c1', 'sha256:old', 'parser:old', 'd1', 1,
    'כותרת', 'תקציר', 'החלטה', array['ניהול'],
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
    'החלטה', '{}'::jsonb, array['ניהול'], 'ניהול', 'נדרשת_בדיקה'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '82345c75-c6f4-468d-b899-1f8407d9a9c1', 'sha256:old', 'parser:old', 'd1', 2,
    'כותרת מעודכנת', 'תקציר מעודכן', 'החלטה מעודכנת', array['ניהול'],
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
    'החלטה מעודכנת', '{}'::jsonb, array['ניהול'], 'ניהול', 'נדרשת_בדיקה'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa', 'sha256:new', 'parser:new', 'd2', 1,
    'כותרת חדשה', 'תקציר חדש', 'החלטה חדשה', array['ביצוע'],
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222',
    'החלטה חדשה', '{}'::jsonb, array['ביצוע'], 'ביצוע', 'נדרשת_בדיקה'
  );
