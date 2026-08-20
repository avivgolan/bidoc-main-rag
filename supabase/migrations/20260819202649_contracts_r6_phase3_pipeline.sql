-- BIDoc Contracts R6 Phase 3: Hebrew catalogs, lite-model persistence, and embeddings.
-- Existing public response shapes and Schedule boundaries remain unchanged.

begin;

alter table private.contracts_documents
  add column if not exists embedding_input_sha256 text
    check (embedding_input_sha256 is null or embedding_input_sha256 ~ '^[0-9a-f]{64}$');

alter table private.contracts
  add column if not exists embedding_input_sha256 text
    check (embedding_input_sha256 is null or embedding_input_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.bidoc_contracts_r6_active_catalog_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  return jsonb_build_object(
    'schemaVersion', 'contracts-r6-catalog.v1',
    'tags', coalesce((select jsonb_agg(tag_he order by tag_he)
      from private.contract_tag_catalog where active), '[]'::jsonb),
    'triggers', coalesce((select jsonb_agg(trigger_he order by sort_order)
      from private.contract_trigger_catalog where active), '[]'::jsonb)
  );
end;
$$;

-- R3.2 still owns its atomic workspace save. This replacement only changes
-- tag validation so the R6 wrapper can persist active shared Hebrew tags.
create or replace function public.bidoc_contracts_apply_clause_enrichment_r3(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_clause private.contracts_documents%rowtype;
  v_tags text[];
  v_cross_references jsonb;
  v_index_ref jsonb;
  v_content text;
  v_content_sha256 text;
  v_summary_he text;
  v_policy_version text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or (p_payload - array['workspaceId','documentVersionId','parserGenerationId','clauseKey',
       'rawTextSha256','enrichmentGenerationId','summaryHe','hashtags','crossReferences',
       'content','contentSha256','indexRef']::text[]) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'R3 enrichment payload shape is invalid';
  end if;
  v_summary_he := btrim(p_payload ->> 'summaryHe');
  v_policy_version := lower(btrim(p_payload ->> 'enrichmentGenerationId'));
  v_content := p_payload ->> 'content';
  v_content_sha256 := lower(p_payload ->> 'contentSha256');
  v_cross_references := p_payload -> 'crossReferences';
  v_index_ref := p_payload -> 'indexRef';
  if char_length(v_summary_he) not between 5 and 700 or v_summary_he !~ '[א-ת]'
     or v_policy_version !~ '^enrichment-generation:sha256:[0-9a-f]{64}$'
     or char_length(v_content) not between 1 and 120000
     or v_content_sha256 !~ '^[0-9a-f]{64}$'
     or v_content_sha256 <> encode(pg_catalog.sha256(pg_catalog.convert_to(v_content, 'UTF8')), 'hex') then
    raise exception using errcode = '22023', message = 'R3 enrichment summary, policy, or content identity is invalid';
  end if;
  if jsonb_typeof(p_payload -> 'hashtags') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'hashtags') not between 1 and 8 then
    raise exception using errcode = '22023', message = 'R3 enrichment tags are invalid';
  end if;
  select array_agg(value order by ordinal) into v_tags
  from jsonb_array_elements_text(p_payload -> 'hashtags') with ordinality tags(value, ordinal);
  if cardinality(v_tags) <> cardinality(array(select distinct unnest(v_tags)))
     or exists (
       select 1 from unnest(v_tags) tag
       where not exists (select 1 from private.contract_tag_catalog catalog where catalog.tag_he = tag and catalog.active)
         and tag <> all(array['appendix','approval','authorization','bond','change','commercial','communication',
           'compliance','completion','confidentiality','coordination','definitions','delay','dispute',
           'document_context','documents','execution','extension','insurance','liability','milestone',
           'notice','other','ownership','parties','payment','quality','responsibility','safety',
           'schedule','scope','storage','termination','warranty']::text[])
     ) then
    raise exception using errcode = '22023', message = 'R3 enrichment tags are not controlled or unique';
  end if;
  if jsonb_typeof(v_cross_references) is distinct from 'array'
     or jsonb_array_length(v_cross_references) > 100
     or exists (select 1 from jsonb_array_elements(v_cross_references) reference
       where jsonb_typeof(reference) is distinct from 'object'
         or (reference - array['schemaVersion','referenceText','referenceKind','targetClauseKey','resolution','pageStart','pageEnd']::text[]) <> '{}'::jsonb
         or reference ->> 'schemaVersion' <> 'contracts-cross-reference.r3.v1'
         or reference ->> 'referenceKind' not in ('clause','appendix')
         or reference ->> 'resolution' not in ('resolved','unresolved')
         or char_length(btrim(reference ->> 'referenceText')) not between 1 and 500
         or char_length(btrim(reference ->> 'targetClauseKey')) not between 1 and 300
         or coalesce(reference ->> 'pageStart', '') !~ '^[1-9][0-9]*$'
         or coalesce(reference ->> 'pageEnd', '') !~ '^[1-9][0-9]*$'
         or case when coalesce(reference ->> 'pageStart', '') ~ '^[1-9][0-9]*$'
                    and coalesce(reference ->> 'pageEnd', '') ~ '^[1-9][0-9]*$'
                 then (reference ->> 'pageEnd')::integer < (reference ->> 'pageStart')::integer
                 else true end) then
    raise exception using errcode = '22023', message = 'R3 explicit cross-reference observations are invalid';
  end if;
  if jsonb_typeof(v_index_ref) = 'null' then v_index_ref := null;
  elsif not private.bidoc_contracts_index_ref_valid_r1(v_index_ref)
        or lower(v_index_ref ->> 'contentSha256') <> v_content_sha256 then
    raise exception using errcode = '22023', message = 'R3 index reference is invalid or does not attest the stored content';
  end if;
  select * into v_clause from private.contracts_documents
  where workspace_id = (p_payload ->> 'workspaceId')::uuid
    and document_version_id = lower(p_payload ->> 'documentVersionId')
    and parser_generation_id = lower(p_payload ->> 'parserGenerationId')
    and clause_key = p_payload ->> 'clauseKey' for update;
  if not found then raise exception using errcode = 'P0002', message = 'The R3 clause target was not found'; end if;
  if v_clause.raw_text_sha256 <> lower(p_payload ->> 'rawTextSha256') then
    raise exception using errcode = '40001', message = 'The R3 clause source hash changed';
  end if;
  if v_clause.extractor_version <> v_policy_version then
    raise exception using errcode = '40001', message = 'The R3 enrichment policy does not match the immutable workspace generation';
  end if;
  if v_clause.processing_status = 'processed' then
    if v_clause.summary_he is not distinct from v_summary_he and v_clause.hashtags is not distinct from v_tags
       and v_clause.cross_references is not distinct from v_cross_references and v_clause.content is not distinct from v_content
       and v_clause.index_ref is not distinct from v_index_ref then
      return jsonb_build_object('clauseId',v_clause.id,'clauseKey',v_clause.clause_key,
        'processingStatus',v_clause.processing_status,'updatedAt',v_clause.updated_at,'inserted',false,'reused',true);
    end if;
    raise exception using errcode = '23505', message = 'Same-policy R3 rerun produced different enrichment';
  end if;
  if v_clause.processing_status = 'processing' then raise exception using errcode = '55000', message = 'The R3 clause is already being processed'; end if;
  update private.contracts_documents set processing_status = 'processing', processing_error = null where id = v_clause.id;
  update private.contracts_documents
     set summary_he = v_summary_he, hashtags = v_tags, cross_references = v_cross_references,
         content = v_content, index_ref = v_index_ref, processing_status = 'processed',
         processing_error = null, processed_at = now()
   where id = v_clause.id returning * into v_clause;
  return jsonb_build_object('clauseId',v_clause.id,'clauseKey',v_clause.clause_key,
    'processingStatus',v_clause.processing_status,'updatedAt',v_clause.updated_at,'inserted',true,'reused',false);
end;
$$;

create or replace function public.bidoc_contracts_persist_clause_generation_r6(
  p_workspace jsonb, p_clauses jsonb, p_enrichments jsonb, p_reviewer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role is required'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_enrichments, '[]'::jsonb)) enrichment
    cross join lateral jsonb_array_elements_text(coalesce(enrichment.value -> 'hashtags', '[]'::jsonb)) tag(value)
    where not exists (select 1 from private.contract_tag_catalog catalog where catalog.tag_he = tag.value and catalog.active)
  ) then raise exception using errcode = '22023', message = 'R6 requires active shared Hebrew tags'; end if;
  return public.bidoc_contracts_persist_clause_generation_r3_2(p_workspace, p_clauses, p_enrichments, p_reviewer_id);
end;
$$;

create or replace function public.bidoc_contracts_persist_decisions_r6(
  p_workspace_id uuid, p_decision_policy_version text, p_model_version text, p_proposals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_result jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role is required'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) proposal
    cross join lateral jsonb_array_elements_text(coalesce(proposal.value -> 'tags', '[]'::jsonb)) tag(value)
    where not exists (select 1 from private.contract_tag_catalog catalog where catalog.tag_he = tag.value and catalog.active)
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) proposal
    where nullif(btrim(proposal.value ->> 'triggerKind'), '') is not null
      and not exists (select 1 from private.contract_trigger_catalog catalog
        where catalog.trigger_he = btrim(proposal.value ->> 'triggerKind') and catalog.active)
  ) then raise exception using errcode = '22023', message = 'R6 requires active Hebrew catalog values'; end if;
  v_result := public.bidoc_contracts_persist_decisions_r4_2b(p_workspace_id, p_decision_policy_version, p_model_version, p_proposals);
  update private.contracts decision
     set indicator_suitability = case decision.schedule_impact
       when 'yes' then 'מתאים' when 'no' then 'לא_מתאים' else 'נדרשת_בדיקה' end
   where decision.workspace_id = p_workspace_id
     and decision.decision_policy_version = p_decision_policy_version;
  return v_result;
end;
$$;

create or replace function public.bidoc_contracts_review_decision_r6(
  p_workspace_id uuid, p_decision_id uuid, p_expected_revision integer, p_reviewer_id uuid,
  p_action text, p_reason_he text, p_correction jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_result jsonb;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role is required'; end if;
  if p_action = 'correct' and nullif(btrim(p_correction ->> 'triggerKind'), '') is not null
     and not exists (select 1 from private.contract_trigger_catalog catalog
       where catalog.trigger_he = btrim(p_correction ->> 'triggerKind') and catalog.active) then
    raise exception using errcode = '22023', message = 'R6 requires an active Hebrew trigger';
  end if;
  v_result := public.bidoc_contracts_review_decision_r4_2b(
    p_workspace_id, p_decision_id, p_expected_revision, p_reviewer_id, p_action, p_reason_he, p_correction
  );
  update private.contracts decision
     set indicator_suitability = case decision.schedule_impact
       when 'yes' then 'מתאים' when 'no' then 'לא_מתאים' else 'נדרשת_בדיקה' end
   where decision.workspace_id = p_workspace_id
     and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1';
  return v_result;
end;
$$;

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

create or replace function public.bidoc_contracts_r6_embedding_work_v1(p_workspace_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role is required'; end if;
  return jsonb_build_object('schemaVersion', 'contracts-r6-embedding-work.v1', 'items', coalesce((
    with documents as (
      select 'document'::text as kind, item.id, private.bidoc_contracts_r6_document_embedding_input(item) as input
      from private.contracts_documents item where item.workspace_id = p_workspace_id and item.processing_status = 'processed'
    ), latest_decisions as (
      select distinct on (item.decision_key) 'decision'::text as kind, item.id,
        private.bidoc_contracts_r6_decision_embedding_input(item) as input
      from private.contracts item where item.workspace_id = p_workspace_id
      order by item.decision_key, item.revision desc
    ), items as (select * from documents union all select * from latest_decisions)
    select jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'input', input,
      'inputSha256', encode(pg_catalog.sha256(pg_catalog.convert_to(input, 'UTF8')), 'hex')) order by kind, id)
    from items where input <> ''
  ), '[]'::jsonb));
end;
$$;

create or replace function public.bidoc_contracts_r6_apply_embeddings_v1(p_workspace_id uuid, p_records jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_record jsonb; v_kind text; v_id uuid; v_expected_hash text; v_actual_input text;
  v_actual_hash text; v_vector public.vector; v_written integer := 0; v_reused integer := 0;
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service_role is required'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) > 500 then
    raise exception using errcode = '22023', message = 'R6 embedding records are invalid';
  end if;
  for v_record in select value from jsonb_array_elements(p_records) loop
    v_kind := v_record ->> 'kind'; v_id := (v_record ->> 'id')::uuid; v_expected_hash := lower(v_record ->> 'inputSha256');
    if jsonb_typeof(v_record) is distinct from 'object'
       or (v_record - array['kind','id','inputSha256','embedding']::text[]) <> '{}'::jsonb
       or v_kind not in ('document','decision') or v_expected_hash !~ '^[0-9a-f]{64}$'
       or jsonb_typeof(v_record -> 'embedding') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'R6 embedding record shape is invalid';
    end if;
    v_vector := (v_record -> 'embedding')::text::public.vector;
    if public.vector_dims(v_vector) <> 3072 then raise exception using errcode = '22023', message = 'R6 requires 3072-dimension embeddings'; end if;
    if v_kind = 'document' then
      select private.bidoc_contracts_r6_document_embedding_input(item) into v_actual_input
      from private.contracts_documents item where item.id = v_id and item.workspace_id = p_workspace_id for update;
      if not found then raise exception using errcode = 'P0002', message = 'R6 document embedding target was not found'; end if;
      v_actual_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(v_actual_input, 'UTF8')), 'hex');
      if v_actual_hash <> v_expected_hash then raise exception using errcode = '40001', message = 'R6 document embedding input changed'; end if;
      update private.contracts_documents set embedding = v_vector, embedding_input_sha256 = v_actual_hash
       where id = v_id and workspace_id = p_workspace_id
         and (embedding_input_sha256 is distinct from v_actual_hash or embedding is null);
    else
      select private.bidoc_contracts_r6_decision_embedding_input(item) into v_actual_input
      from private.contracts item where item.id = v_id and item.workspace_id = p_workspace_id for update;
      if not found then raise exception using errcode = 'P0002', message = 'R6 decision embedding target was not found'; end if;
      v_actual_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(v_actual_input, 'UTF8')), 'hex');
      if v_actual_hash <> v_expected_hash then raise exception using errcode = '40001', message = 'R6 decision embedding input changed'; end if;
      update private.contracts set embedding = v_vector, embedding_input_sha256 = v_actual_hash
       where id = v_id and workspace_id = p_workspace_id
         and (embedding_input_sha256 is distinct from v_actual_hash or embedding is null);
    end if;
    if found then v_written := v_written + 1; else v_reused := v_reused + 1; end if;
  end loop;
  return jsonb_build_object('schemaVersion','contracts-r6-embedding-apply.v1','written',v_written,'reused',v_reused);
end;
$$;

revoke execute on function public.bidoc_contracts_r6_active_catalog_v1() from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_persist_clause_generation_r6(jsonb,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_persist_decisions_r6(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_review_decision_r6(uuid,uuid,integer,uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_r6_embedding_work_v1(uuid) from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_r6_apply_embeddings_v1(uuid,jsonb) from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_r6_document_embedding_input(private.contracts_documents) from public, anon, authenticated;
revoke execute on function private.bidoc_contracts_r6_decision_embedding_input(private.contracts) from public, anon, authenticated;
grant execute on function public.bidoc_contracts_r6_active_catalog_v1() to service_role;
grant execute on function public.bidoc_contracts_persist_clause_generation_r6(jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.bidoc_contracts_persist_decisions_r6(uuid,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_review_decision_r6(uuid,uuid,integer,uuid,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_r6_embedding_work_v1(uuid) to service_role;
grant execute on function public.bidoc_contracts_r6_apply_embeddings_v1(uuid,jsonb) to service_role;
grant execute on function private.bidoc_contracts_r6_document_embedding_input(private.contracts_documents) to service_role;
grant execute on function private.bidoc_contracts_r6_decision_embedding_input(private.contracts) to service_role;

comment on column private.contracts_documents.embedding_input_sha256 is 'Technical identity of the exact R6 document embedding input.';
comment on column private.contracts.embedding_input_sha256 is 'Technical identity of the exact R6 decision embedding input.';

commit;
