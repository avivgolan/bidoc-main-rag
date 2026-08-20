-- BIDoc Contracts R6 Phase 2: additive data foundation.
--
-- This migration does not change persistence RPCs, existing UI/API payloads,
-- Schedule rows, or Indicator operational behavior. It only adds the schema
-- needed for the later controlled tag/trigger, embedding, and Indicator work.

begin;

do $r6$
begin
  if to_regtype('public.vector') is null or to_regtype('public.halfvec') is null then
    raise exception using
      errcode = '42704',
      message = 'R6 requires the existing public pgvector types used by Meetings';
  end if;
end
$r6$;

alter table private.contracts_documents
  add column if not exists embedding public.vector;

alter table private.contracts
  add column if not exists embedding public.vector,
  add column if not exists indicator_suitability text not null default 'נדרשת_בדיקה';

alter table private.contracts
  drop constraint if exists contracts_indicator_suitability_r6_check,
  add constraint contracts_indicator_suitability_r6_check
    check (indicator_suitability in ('מתאים', 'לא_מתאים', 'נדרשת_בדיקה'));

create index if not exists contracts_documents_embedding_hnsw_r6_idx
  on private.contracts_documents
  using hnsw (((embedding)::halfvec(3072)) halfvec_cosine_ops)
  with (m = '16', ef_construction = '64');

create index if not exists contracts_embedding_hnsw_r6_idx
  on private.contracts
  using hnsw (((embedding)::halfvec(3072)) halfvec_cosine_ops)
  with (m = '16', ef_construction = '64');

create table if not exists private.contract_tag_catalog (
  tag_he text primary key,
  active boolean not null default true,
  source_table text not null default 'public.data_index',
  observed_count integer not null default 0 check (observed_count >= 0),
  created_at timestamptz not null default now(),
  constraint contract_tag_catalog_r6_hebrew_check check (
    tag_he = btrim(tag_he)
    and char_length(tag_he) between 1 and 100
    and tag_he !~ '#'
    and tag_he !~ '[A-Za-z]'
    and tag_he ~ '[א-ת]'
  )
);

create table if not exists private.contract_trigger_catalog (
  trigger_he text primary key,
  active boolean not null default true,
  sort_order smallint not null unique check (sort_order > 0),
  created_at timestamptz not null default now(),
  constraint contract_trigger_catalog_r6_hebrew_check check (
    trigger_he = btrim(trigger_he)
    and char_length(trigger_he) between 1 and 100
    and trigger_he !~ '[A-Za-z]'
    and trigger_he ~ '[א-ת]'
  )
);

alter table private.contract_tag_catalog enable row level security;
alter table private.contract_tag_catalog force row level security;
alter table private.contract_trigger_catalog enable row level security;
alter table private.contract_trigger_catalog force row level security;

revoke all on table private.contract_tag_catalog from public, anon, authenticated;
revoke all on table private.contract_trigger_catalog from public, anon, authenticated;
grant select, insert, update, delete on table private.contract_tag_catalog to service_role;
grant select, insert, update, delete on table private.contract_trigger_catalog to service_role;

-- Seed only the existing shared Hebrew project vocabulary. This does not alter
-- the source index and can be rerun safely if the migration is replayed locally.
do $r6$
begin
  if to_regclass('public.data_index') is not null then
    insert into private.contract_tag_catalog (tag_he, active, source_table, observed_count)
    select tag_he, true, 'public.data_index', count(*)::integer
    from (
      select btrim(regexp_replace(raw_tag, '^#+', '')) as tag_he
      from public.data_index item
      cross join lateral unnest(coalesce(item.hashtags, '{}'::text[])) as source(raw_tag)
    ) tags
    where tag_he <> ''
      and tag_he !~ '[A-Za-z]'
      and tag_he ~ '[א-ת]'
      and char_length(tag_he) <= 100
    group by tag_he
    on conflict (tag_he) do update
      set active = excluded.active,
          source_table = excluded.source_table,
          observed_count = excluded.observed_count;
  end if;
end
$r6$;

insert into private.contract_trigger_catalog (trigger_he, sort_order)
values
  ('חתימת ההסכם', 1),
  ('תחילת העבודה', 2),
  ('קבלת הודעה', 3),
  ('מסירת מסמך', 4),
  ('אישור מנהל', 5),
  ('בדיקה או מסירה', 6),
  ('סיום תקופה', 7),
  ('אירוע אחר המפורט בחוזה', 8)
on conflict (trigger_he) do update
  set sort_order = excluded.sort_order;

comment on column private.contracts_documents.embedding is
  'Nullable 3072-dimension semantic embedding for final clause source content.';
comment on column private.contracts.embedding is
  'Nullable 3072-dimension semantic embedding for final reviewed contractual knowledge.';
comment on column private.contracts.indicator_suitability is
  'Hebrew Contracts classification for future Indicator handling. It does not schedule or place work.';
comment on table private.contract_tag_catalog is
  'Controlled Hebrew tag vocabulary seeded from public.data_index. Contracts agents may select only active values.';
comment on table private.contract_trigger_catalog is
  'Controlled Hebrew contractual trigger vocabulary. Trigger display and persistence are Hebrew only.';

commit;
