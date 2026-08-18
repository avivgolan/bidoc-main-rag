-- BIDoc Contracts Pipeline R3: bounded clause enrichment persistence.
-- This migration adds no table and changes no immutable clause/source field.

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
     or (p_payload - array[
       'workspaceId', 'documentVersionId', 'parserGenerationId', 'clauseKey',
       'rawTextSha256', 'enrichmentGenerationId', 'summaryHe', 'hashtags',
       'crossReferences', 'content', 'contentSha256', 'indexRef'
     ]::text[]) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'R3 enrichment payload shape is invalid';
  end if;

  v_summary_he := btrim(p_payload ->> 'summaryHe');
  v_policy_version := lower(btrim(p_payload ->> 'enrichmentGenerationId'));
  v_content := p_payload ->> 'content';
  v_content_sha256 := lower(p_payload ->> 'contentSha256');
  v_cross_references := p_payload -> 'crossReferences';
  v_index_ref := p_payload -> 'indexRef';

  if char_length(v_summary_he) not between 5 and 700
     or v_summary_he !~ '[א-ת]'
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
  select array_agg(value order by ordinal)
  into v_tags
  from jsonb_array_elements_text(p_payload -> 'hashtags') with ordinality tags(value, ordinal);
  if cardinality(v_tags) <> cardinality(array(select distinct unnest(v_tags)))
     or exists (
       select 1 from unnest(v_tags) tag
       where tag <> all(array[
         'appendix','approval','authorization','bond','change','commercial','communication',
         'compliance','completion','confidentiality','coordination','definitions','delay',
         'dispute','document_context','documents','execution','extension','insurance',
         'liability','milestone','notice','other','ownership','parties','payment','quality',
         'responsibility','safety','schedule','scope','storage','termination','warranty'
       ]::text[])
     ) then
    raise exception using errcode = '22023', message = 'R3 enrichment tags are not controlled or unique';
  end if;

  if jsonb_typeof(v_cross_references) is distinct from 'array'
     or jsonb_array_length(v_cross_references) > 100
     or exists (
       select 1
       from jsonb_array_elements(v_cross_references) reference
       where jsonb_typeof(reference) is distinct from 'object'
          or (reference - array[
            'schemaVersion','referenceText','referenceKind','targetClauseKey',
            'resolution','pageStart','pageEnd'
          ]::text[]) <> '{}'::jsonb
          or reference ->> 'schemaVersion' <> 'contracts-cross-reference.r3.v1'
          or reference ->> 'referenceKind' not in ('clause', 'appendix')
          or reference ->> 'resolution' not in ('resolved', 'unresolved')
          or char_length(btrim(reference ->> 'referenceText')) not between 1 and 500
          or char_length(btrim(reference ->> 'targetClauseKey')) not between 1 and 300
          or coalesce(reference ->> 'pageStart', '') !~ '^[1-9][0-9]*$'
          or coalesce(reference ->> 'pageEnd', '') !~ '^[1-9][0-9]*$'
          or case
            when coalesce(reference ->> 'pageStart', '') ~ '^[1-9][0-9]*$'
             and coalesce(reference ->> 'pageEnd', '') ~ '^[1-9][0-9]*$'
            then (reference ->> 'pageEnd')::integer < (reference ->> 'pageStart')::integer
            else true
          end
     ) then
    raise exception using errcode = '22023', message = 'R3 explicit cross-reference observations are invalid';
  end if;

  if jsonb_typeof(v_index_ref) = 'null' then
    v_index_ref := null;
  elsif not private.bidoc_contracts_index_ref_valid_r1(v_index_ref)
        or lower(v_index_ref ->> 'contentSha256') <> v_content_sha256 then
    raise exception using errcode = '22023', message = 'R3 index reference is invalid or does not attest the stored content';
  end if;

  select * into v_clause
  from private.contracts_documents
  where workspace_id = (p_payload ->> 'workspaceId')::uuid
    and document_version_id = lower(p_payload ->> 'documentVersionId')
    and parser_generation_id = lower(p_payload ->> 'parserGenerationId')
    and clause_key = p_payload ->> 'clauseKey'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The R3 clause target was not found';
  end if;
  if v_clause.raw_text_sha256 <> lower(p_payload ->> 'rawTextSha256') then
    raise exception using errcode = '40001', message = 'The R3 clause source hash changed';
  end if;
  if v_clause.extractor_version <> v_policy_version then
    raise exception using errcode = '40001', message = 'The R3 enrichment policy does not match the immutable workspace generation';
  end if;

  if v_clause.processing_status = 'processed' then
    if v_clause.summary_he is not distinct from v_summary_he
       and v_clause.hashtags is not distinct from v_tags
       and v_clause.cross_references is not distinct from v_cross_references
       and v_clause.content is not distinct from v_content
       and v_clause.index_ref is not distinct from v_index_ref then
      return jsonb_build_object(
        'clauseId', v_clause.id,
        'clauseKey', v_clause.clause_key,
        'processingStatus', v_clause.processing_status,
        'updatedAt', v_clause.updated_at,
        'inserted', false,
        'reused', true
      );
    end if;
    raise exception using errcode = '23505', message = 'Same-policy R3 rerun produced different enrichment';
  end if;
  if v_clause.processing_status = 'processing' then
    raise exception using errcode = '55000', message = 'The R3 clause is already being processed';
  end if;

  update private.contracts_documents
  set processing_status = 'processing',
      processing_error = null
  where id = v_clause.id;

  update private.contracts_documents
  set summary_he = v_summary_he,
      hashtags = v_tags,
      cross_references = v_cross_references,
      content = v_content,
      index_ref = v_index_ref,
      processing_status = 'processed',
      processing_error = null,
      processed_at = now()
  where id = v_clause.id
  returning * into v_clause;

  return jsonb_build_object(
    'clauseId', v_clause.id,
    'clauseKey', v_clause.clause_key,
    'processingStatus', v_clause.processing_status,
    'updatedAt', v_clause.updated_at,
    'inserted', true,
    'reused', false
  );
end;
$$;

revoke execute on function public.bidoc_contracts_apply_clause_enrichment_r3(jsonb)
from public, anon, authenticated;
grant execute on function public.bidoc_contracts_apply_clause_enrichment_r3(jsonb)
to service_role;
