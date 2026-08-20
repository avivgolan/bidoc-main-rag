-- Verification fixture for Contracts R6 Phase 2.

set role service_role;

do $test$
declare
  v_tag_count integer;
  v_trigger_count integer;
  v_failed boolean := false;
begin
  if to_regtype('public.vector') is null or to_regtype('public.halfvec') is null then
    raise exception 'R6 pgvector types are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'contracts_documents'
      and column_name = 'embedding'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'contracts'
      and column_name = 'embedding'
  ) then
    raise exception 'R6 embedding columns are missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'contracts'
      and column_name = 'indicator_suitability'
      and is_nullable = 'NO'
  ) then
    raise exception 'R6 indicator_suitability is missing or nullable';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'contracts_documents_embedding_hnsw_r6_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'contracts_embedding_hnsw_r6_idx') then
    raise exception 'R6 HNSW embedding indexes are missing';
  end if;

  select count(*) into v_tag_count from private.contract_tag_catalog;
  if v_tag_count <> 3 then
    raise exception 'R6 tag catalog seed count mismatch: %', v_tag_count;
  end if;
  if exists (
    select 1 from private.contract_tag_catalog
    where tag_he ~ '[A-Za-z]' or tag_he !~ '[א-ת]'
  ) then
    raise exception 'R6 tag catalog accepted a non-Hebrew value';
  end if;

  select count(*) into v_trigger_count from private.contract_trigger_catalog where active;
  if v_trigger_count <> 8 then
    raise exception 'R6 trigger catalog seed count mismatch: %', v_trigger_count;
  end if;
  if exists (
    select 1 from private.contract_trigger_catalog
    where trigger_he ~ '[A-Za-z]' or trigger_he !~ '[א-ת]'
  ) then
    raise exception 'R6 trigger catalog accepted a non-Hebrew value';
  end if;

  begin
    insert into private.contract_tag_catalog (tag_he, source_table)
    values ('contract_tag', 'test');
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'R6 tag catalog accepted an English tag';
  end if;
end
$test$;

reset role;
