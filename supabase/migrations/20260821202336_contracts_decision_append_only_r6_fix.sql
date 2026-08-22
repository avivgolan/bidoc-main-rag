-- BIDoc Contracts R6: preserve append-only decision content while allowing
-- deterministic Indicator classification at insert time and technical embedding enrichment.

begin;

do $preconditions$
begin
  if to_regprocedure('public.bidoc_contracts_append_decision_r1(integer,jsonb)') is null
     or to_regprocedure('public.bidoc_contracts_persist_decisions_r4_2b(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.bidoc_contracts_review_decision_r4_2b(uuid,uuid,integer,uuid,text,text,jsonb)') is null
     or to_regprocedure('private.bidoc_contracts_r6_decision_embedding_input(private.contracts)') is null then
    raise exception using
      errcode = '55000',
      message = 'R6 decision append-only fix requires the R1, R4.2B, and R6 pipeline functions';
  end if;
end
$preconditions$;

create or replace function private.bidoc_contracts_append_only_guard_r1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and tg_table_schema = 'private'
     and tg_table_name = 'contracts'
     and (to_jsonb(new) - array['embedding', 'embedding_input_sha256']::text[])
       is not distinct from
       (to_jsonb(old) - array['embedding', 'embedding_input_sha256']::text[])
     and new.embedding is not null
     and public.vector_dims(new.embedding) = 3072
     and new.embedding_input_sha256 ~ '^[0-9a-f]{64}$'
     and new.embedding_input_sha256 = encode(
       pg_catalog.sha256(pg_catalog.convert_to(
         private.bidoc_contracts_r6_decision_embedding_input(new),
         'UTF8'
       )),
       'hex'
     ) then
    return new;
  end if;

  raise exception using
    errcode = '55000',
    message = 'Contract decision and relationship revisions are append-only';
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
    indicator_suitability,
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
    case coalesce(p_payload ->> 'scheduleImpact', 'unknown')
      when 'yes' then 'מתאים'
      when 'no' then 'לא_מתאים'
      else 'נדרשת_בדיקה'
    end,
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

create or replace function public.bidoc_contracts_persist_decisions_r6(
  p_workspace_id uuid,
  p_decision_policy_version text,
  p_model_version text,
  p_proposals jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) proposal
    cross join lateral jsonb_array_elements_text(coalesce(proposal.value -> 'tags', '[]'::jsonb)) tag(value)
    where not exists (
      select 1
      from private.contract_tag_catalog catalog
      where catalog.tag_he = tag.value and catalog.active
    )
  ) or exists (
    select 1
    from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) proposal
    where nullif(btrim(proposal.value ->> 'triggerKind'), '') is not null
      and not exists (
        select 1
        from private.contract_trigger_catalog catalog
        where catalog.trigger_he = btrim(proposal.value ->> 'triggerKind') and catalog.active
      )
  ) then
    raise exception using errcode = '22023', message = 'R6 requires active Hebrew catalog values';
  end if;

  return public.bidoc_contracts_persist_decisions_r4_2b(
    p_workspace_id,
    p_decision_policy_version,
    p_model_version,
    p_proposals
  );
end;
$$;

create or replace function public.bidoc_contracts_review_decision_r6(
  p_workspace_id uuid,
  p_decision_id uuid,
  p_expected_revision integer,
  p_reviewer_id uuid,
  p_action text,
  p_reason_he text,
  p_correction jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_action = 'correct'
     and nullif(btrim(p_correction ->> 'triggerKind'), '') is not null
     and not exists (
       select 1
       from private.contract_trigger_catalog catalog
       where catalog.trigger_he = btrim(p_correction ->> 'triggerKind') and catalog.active
     ) then
    raise exception using errcode = '22023', message = 'R6 requires an active Hebrew trigger';
  end if;

  return public.bidoc_contracts_review_decision_r4_2b(
    p_workspace_id,
    p_decision_id,
    p_expected_revision,
    p_reviewer_id,
    p_action,
    p_reason_he,
    p_correction
  );
end;
$$;

create or replace function public.bidoc_contracts_decision_append_only_status_r6_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 'contracts-decision-append-only-r6.v1',
    'migrationVersion', '20260821202336',
    'indicatorSuitabilityAtInsert', true,
    'embeddingTechnicalUpdateOnly', true,
    'businessFieldUpdatesEnabled', false,
    'scheduleWritesEnabled', false
  )
$$;

revoke update (embedding, embedding_input_sha256) on private.contracts
from public, anon, authenticated, service_role;
grant update (embedding, embedding_input_sha256) on private.contracts to service_role;

revoke execute on function public.bidoc_contracts_append_decision_r1(integer,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_persist_decisions_r6(uuid,text,text,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_review_decision_r6(uuid,uuid,integer,uuid,text,text,jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.bidoc_contracts_decision_append_only_status_r6_v1()
from public, anon, authenticated, service_role;

grant execute on function public.bidoc_contracts_append_decision_r1(integer,jsonb) to service_role;
grant execute on function public.bidoc_contracts_persist_decisions_r6(uuid,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_review_decision_r6(uuid,uuid,integer,uuid,text,text,jsonb) to service_role;
grant execute on function public.bidoc_contracts_decision_append_only_status_r6_v1() to service_role;

comment on function public.bidoc_contracts_decision_append_only_status_r6_v1() is
  'R6 corrective status: Indicator suitability is inserted with each revision; only validated embedding fields may be enriched in place.';

commit;
