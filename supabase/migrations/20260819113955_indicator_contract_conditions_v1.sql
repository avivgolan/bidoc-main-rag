-- Indicator-owned synchronization of reviewed relative contract decisions into
-- the existing Schedule waiting pool. The migration is additive: Contracts
-- truth remains append-only and Schedule remains the only date calculator.

begin;

create table if not exists private.indicator_contract_condition_sync_state (
  workspace_id uuid primary key
    references private.contract_workspaces(id) on delete cascade,
  last_committed_at timestamptz not null,
  eligible_count integer not null default 0 check (eligible_count >= 0),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  dismissed_count integer not null default 0 check (dismissed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0)
);

revoke all on table private.indicator_contract_condition_sync_state
  from public, anon, authenticated;
grant select, insert, update on table private.indicator_contract_condition_sync_state
  to service_role;

create or replace function public.bidoc_indicator_schedule_project_context_v1(
  p_project_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_mapping private.schedule_contract_project_mappings%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;

  select mapping.* into v_mapping
  from private.schedule_contract_project_mappings mapping
  where mapping.status = 'active'
    and (mapping.source_project_id = p_project_id or mapping.schedule_project_id = p_project_id)
  order by case when mapping.source_project_id = p_project_id then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object(
      'mappingFound', false,
      'sourceProjectId', p_project_id,
      'scheduleProjectId', p_project_id
    );
  end if;

  return jsonb_build_object(
    'mappingFound', true,
    'mappingId', v_mapping.id,
    'sourceProjectId', v_mapping.source_project_id,
    'scheduleProjectId', v_mapping.schedule_project_id
  );
end
$function$;

create or replace function public.bidoc_indicator_sync_contract_conditions_v1(
  p_workspace_id uuid,
  p_commit boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_workspace private.contract_workspaces%rowtype;
  v_mapping private.schedule_contract_project_mappings%rowtype;
  v_decision private.contracts%rowtype;
  v_condition_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_dismissed integer := 0;
  v_eligible integer := 0;
  v_blocked integer := 0;
  v_was_inserted boolean;
  v_evidence jsonb;
  v_page integer;
  v_excerpt text;
  v_category text;
  v_anchor_kind text;
  v_last_sync_at timestamptz;
  v_sync_at timestamptz;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'workspace id is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('indicator-contracts:' || p_workspace_id::text, 0));

  select workspace.* into v_workspace
  from private.contract_workspaces workspace
  where workspace.id = p_workspace_id
    and workspace.workspace_version = 'contracts-workspace.r1.v1';
  if not found then
    raise exception using errcode = 'P0002', message = 'Contracts workspace was not found';
  end if;

  select state.last_committed_at into v_last_sync_at
  from private.indicator_contract_condition_sync_state state
  where state.workspace_id = p_workspace_id;

  select mapping.* into v_mapping
  from private.schedule_contract_project_mappings mapping
  where mapping.source_system = 'main'
    and mapping.source_project_id = v_workspace.source_project_id
    and mapping.status = 'active';

  if not found then
    select count(*)::integer into v_blocked
    from (
      select distinct on (decision.decision_key) decision.*
      from private.contracts decision
      where decision.workspace_id = p_workspace_id
      order by decision.decision_key, decision.revision desc
    ) decision
    where decision.review_status in ('approved', 'corrected')
      and decision.schedule_impact = 'yes'
      and decision.temporal_kind in ('relative', 'recurring');
    return jsonb_build_object(
      'ok', true, 'committed', false, 'workspaceId', p_workspace_id,
      'sourceProjectId', v_workspace.source_project_id, 'scheduleProjectId', null,
      'eligible', 0, 'inserted', 0, 'updated', 0, 'unchanged', 0,
      'dismissed', 0, 'blocked', v_blocked, 'lastSyncAt', v_last_sync_at,
      'reason', 'active_project_mapping_missing'
    );
  end if;

  select count(*)::integer into v_eligible
  from (
    select distinct on (decision.decision_key) decision.*
    from private.contracts decision
    where decision.workspace_id = p_workspace_id
      and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
    order by decision.decision_key, decision.revision desc
  ) decision
  where decision.review_status in ('approved', 'corrected')
    and decision.schedule_impact = 'yes'
    and decision.conflict_status in ('none', 'reviewed')
    and decision.temporal_kind in ('relative', 'recurring')
    and nullif(btrim(decision.trigger_kind), '') is not null
    and nullif(btrim(decision.trigger_description_he), '') is not null
    and decision.offset_value >= 0
    and decision.offset_unit in ('hours', 'calendar_days', 'working_days', 'weeks', 'months');

  select count(*)::integer into v_blocked
  from (
    select distinct on (decision.decision_key) decision.*
    from private.contracts decision
    where decision.workspace_id = p_workspace_id
      and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
    order by decision.decision_key, decision.revision desc
  ) decision
  where decision.review_status in ('approved', 'corrected')
    and decision.schedule_impact = 'yes'
    and decision.temporal_kind in ('relative', 'recurring')
    and not (
      decision.conflict_status in ('none', 'reviewed')
      and nullif(btrim(decision.trigger_kind), '') is not null
      and nullif(btrim(decision.trigger_description_he), '') is not null
      and decision.offset_value >= 0
      and decision.offset_unit in ('hours', 'calendar_days', 'working_days', 'weeks', 'months')
    );

  if not coalesce(p_commit, false) then
    return jsonb_build_object(
      'ok', true, 'committed', false, 'workspaceId', p_workspace_id,
      'sourceProjectId', v_workspace.source_project_id,
      'scheduleProjectId', v_mapping.schedule_project_id,
      'eligible', v_eligible, 'inserted', 0, 'updated', 0, 'unchanged', 0,
      'dismissed', 0, 'blocked', v_blocked, 'lastSyncAt', v_last_sync_at
    );
  end if;

  update public.schedule_contract_conditions condition
  set status = 'dismissed',
      metadata = condition.metadata || jsonb_build_object(
        'dismissed_reason', 'contract_decision_superseded_or_ineligible',
        'dismissed_at', pg_catalog.clock_timestamp()
      ),
      updated_at = pg_catalog.clock_timestamp()
  where condition.project_id = v_mapping.schedule_project_id
    and condition.status = 'pending'
    and condition.metadata ->> 'contracts_workspace_id' = p_workspace_id::text
    and not exists (
      select 1
      from (
        select distinct on (decision.decision_key) decision.*
        from private.contracts decision
        where decision.workspace_id = p_workspace_id
          and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
        order by decision.decision_key, decision.revision desc
      ) current_decision
      where current_decision.id = condition.source_contract_decision_id
        and current_decision.review_status in ('approved', 'corrected')
        and current_decision.schedule_impact = 'yes'
        and current_decision.conflict_status in ('none', 'reviewed')
        and current_decision.temporal_kind in ('relative', 'recurring')
        and nullif(btrim(current_decision.trigger_kind), '') is not null
        and nullif(btrim(current_decision.trigger_description_he), '') is not null
        and current_decision.offset_value >= 0
        and current_decision.offset_unit in ('hours', 'calendar_days', 'working_days', 'weeks', 'months')
    );
  get diagnostics v_dismissed = row_count;

  for v_decision in
    select current_decision.*
    from (
      select distinct on (decision.decision_key) decision.*
      from private.contracts decision
      where decision.workspace_id = p_workspace_id
        and decision.decision_policy_version = 'contracts-decisions-normalization.r4.2b.v1'
      order by decision.decision_key, decision.revision desc
    ) current_decision
    where current_decision.review_status in ('approved', 'corrected')
      and current_decision.schedule_impact = 'yes'
      and current_decision.conflict_status in ('none', 'reviewed')
      and current_decision.temporal_kind in ('relative', 'recurring')
      and nullif(btrim(current_decision.trigger_kind), '') is not null
      and nullif(btrim(current_decision.trigger_description_he), '') is not null
      and current_decision.offset_value >= 0
      and current_decision.offset_unit in ('hours', 'calendar_days', 'working_days', 'weeks', 'months')
    order by current_decision.decision_key
  loop
    v_evidence := coalesce(v_decision.source_evidence -> 0, '{}'::jsonb);
    v_page := nullif(v_evidence ->> 'pageStart', '')::integer;
    v_excerpt := nullif(btrim(v_evidence ->> 'excerpt'), '');
    v_category := case v_decision.decision_category
      when 'payment_and_commercial' then 'payment'
      when 'notice_and_communication' then 'notice'
      when 'document_and_information_obligation' then 'notice'
      when 'bond_and_security' then 'guarantee'
      when 'warranty_and_defects' then 'warranty'
      when 'scope_and_execution' then 'execution'
      when 'commencement_and_completion' then 'execution'
      when 'stage_acceptance_and_handover' then 'execution'
      else 'other'
    end;
    v_anchor_kind := case
      when v_decision.trigger_kind = 'commencement_of_works' then 'schedule_task'
      else 'event'
    end;

    insert into public.schedule_contract_conditions (
      project_id, condition_key, name, category, anchor_kind, anchor_description,
      offset_value, offset_unit, recurring, is_project_completion,
      source_excerpt, source_page, confidence, status, trigger_event_date,
      trigger_source_table, trigger_source_id, resolved_milestone_key,
      written_by, metadata, source_contract_decision_id, updated_at
    ) values (
      v_mapping.schedule_project_id,
      'contract-decision:' || v_decision.id::text,
      v_decision.title_he,
      v_category,
      v_anchor_kind,
      v_decision.trigger_description_he,
      v_decision.offset_value,
      v_decision.offset_unit,
      v_decision.recurring,
      false,
      v_excerpt,
      v_page,
      1.0,
      'pending',
      null,
      null,
      null,
      null,
      'indicator_agent',
      jsonb_build_object(
        'sync_version', 'indicator-contract-conditions.v1',
        'contracts_workspace_id', p_workspace_id,
        'contracts_decision_key', v_decision.decision_key,
        'contracts_decision_revision', v_decision.revision,
        'trigger_kind', v_decision.trigger_kind,
        'document_version_id', v_workspace.document_version_id,
        'source_filename', v_workspace.filename,
        'source_project_id', v_workspace.source_project_id,
        'confidence_basis', 'human_review'
      ),
      v_decision.id,
      pg_catalog.clock_timestamp()
    )
    on conflict (project_id, condition_key) do update
    set name = excluded.name,
        category = excluded.category,
        anchor_kind = excluded.anchor_kind,
        anchor_description = excluded.anchor_description,
        offset_value = excluded.offset_value,
        offset_unit = excluded.offset_unit,
        recurring = excluded.recurring,
        source_excerpt = excluded.source_excerpt,
        source_page = excluded.source_page,
        confidence = excluded.confidence,
        written_by = excluded.written_by,
        metadata = public.schedule_contract_conditions.metadata || excluded.metadata,
        source_contract_decision_id = excluded.source_contract_decision_id,
        updated_at = pg_catalog.clock_timestamp()
    where public.schedule_contract_conditions.status = 'pending'
      and (
        public.schedule_contract_conditions.name,
        public.schedule_contract_conditions.category,
        public.schedule_contract_conditions.anchor_kind,
        public.schedule_contract_conditions.anchor_description,
        public.schedule_contract_conditions.offset_value,
        public.schedule_contract_conditions.offset_unit,
        public.schedule_contract_conditions.recurring,
        public.schedule_contract_conditions.source_excerpt,
        public.schedule_contract_conditions.source_page,
        public.schedule_contract_conditions.confidence,
        public.schedule_contract_conditions.source_contract_decision_id,
        public.schedule_contract_conditions.metadata ->> 'contracts_decision_revision',
        public.schedule_contract_conditions.metadata ->> 'document_version_id'
      ) is distinct from (
        excluded.name,
        excluded.category,
        excluded.anchor_kind,
        excluded.anchor_description,
        excluded.offset_value,
        excluded.offset_unit,
        excluded.recurring,
        excluded.source_excerpt,
        excluded.source_page,
        excluded.confidence,
        excluded.source_contract_decision_id,
        excluded.metadata ->> 'contracts_decision_revision',
        excluded.metadata ->> 'document_version_id'
      )
    returning id, (xmax = 0) into v_condition_id, v_was_inserted;

    if not found then
      v_unchanged := v_unchanged + 1;
    elsif v_was_inserted then
      v_inserted := v_inserted + 1;
    else
      v_updated := v_updated + 1;
    end if;
  end loop;

  v_sync_at := pg_catalog.clock_timestamp();
  insert into private.indicator_contract_condition_sync_state (
    workspace_id, last_committed_at, eligible_count, inserted_count,
    updated_count, unchanged_count, dismissed_count, blocked_count
  ) values (
    p_workspace_id, v_sync_at, v_eligible, v_inserted,
    v_updated, v_unchanged, v_dismissed, v_blocked
  )
  on conflict (workspace_id) do update
  set last_committed_at = excluded.last_committed_at,
      eligible_count = excluded.eligible_count,
      inserted_count = excluded.inserted_count,
      updated_count = excluded.updated_count,
      unchanged_count = excluded.unchanged_count,
      dismissed_count = excluded.dismissed_count,
      blocked_count = excluded.blocked_count;

  return jsonb_build_object(
    'ok', true, 'committed', true, 'workspaceId', p_workspace_id,
    'sourceProjectId', v_workspace.source_project_id,
    'scheduleProjectId', v_mapping.schedule_project_id,
    'eligible', v_eligible, 'inserted', v_inserted, 'updated', v_updated,
    'unchanged', v_unchanged, 'dismissed', v_dismissed, 'blocked', v_blocked,
    'lastSyncAt', v_sync_at
  );
end
$function$;

create or replace function public.bidoc_indicator_sync_schedule_project_contract_conditions_v1(
  p_project_id uuid,
  p_commit boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_mapping private.schedule_contract_project_mappings%rowtype;
  v_workspace_id uuid;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_eligible integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_dismissed integer := 0;
  v_blocked integer := 0;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;

  select mapping.* into v_mapping
  from private.schedule_contract_project_mappings mapping
  where mapping.status = 'active'
    and (mapping.source_project_id = p_project_id or mapping.schedule_project_id = p_project_id)
  limit 1;
  if not found then
    return jsonb_build_object(
      'ok', true, 'committed', false, 'sourceProjectId', p_project_id,
      'scheduleProjectId', p_project_id, 'workspaceCount', 0,
      'eligible', 0, 'inserted', 0, 'updated', 0, 'unchanged', 0,
      'dismissed', 0, 'blocked', 0, 'reason', 'active_project_mapping_missing'
    );
  end if;

  for v_workspace_id in
    select workspace.id
    from private.contract_workspaces workspace
    where workspace.workspace_version = 'contracts-workspace.r1.v1'
      and workspace.source_project_id = v_mapping.source_project_id
    order by workspace.created_at
  loop
    v_result := public.bidoc_indicator_sync_contract_conditions_v1(v_workspace_id, coalesce(p_commit, false));
    v_results := v_results || jsonb_build_array(v_result);
    v_eligible := v_eligible + coalesce((v_result ->> 'eligible')::integer, 0);
    v_inserted := v_inserted + coalesce((v_result ->> 'inserted')::integer, 0);
    v_updated := v_updated + coalesce((v_result ->> 'updated')::integer, 0);
    v_unchanged := v_unchanged + coalesce((v_result ->> 'unchanged')::integer, 0);
    v_dismissed := v_dismissed + coalesce((v_result ->> 'dismissed')::integer, 0);
    v_blocked := v_blocked + coalesce((v_result ->> 'blocked')::integer, 0);
  end loop;

  return jsonb_build_object(
    'ok', true, 'committed', coalesce(p_commit, false),
    'sourceProjectId', v_mapping.source_project_id,
    'scheduleProjectId', v_mapping.schedule_project_id,
    'workspaceCount', jsonb_array_length(v_results),
    'eligible', v_eligible, 'inserted', v_inserted, 'updated', v_updated,
    'unchanged', v_unchanged, 'dismissed', v_dismissed, 'blocked', v_blocked,
    'workspaces', v_results
  );
end
$function$;

-- R5 originally made the initial unresolved projection immutable by requiring
-- status=pending and trigger_event_date=null on every update. Indicator v1
-- retains the contractual fields as immutable while allowing Schedule-owned
-- lifecycle transitions after that initial projection.
create or replace function private.bidoc_validate_schedule_contract_source_r5()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_source private.contracts%rowtype;
begin
  if new.source_contract_decision_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.source_contract_decision_id::text, 0)
  );

  select decision.* into v_source
  from private.contracts decision
  where decision.id = new.source_contract_decision_id;
  if not found then
    raise exception using errcode = '23503', message = 'R5 source contractual decision does not exist';
  end if;

  if tg_table_name = 'schedule_contract_conditions'
     and tg_op = 'UPDATE'
     and old.source_contract_decision_id = new.source_contract_decision_id then
    if new.project_id is distinct from old.project_id
       or new.anchor_description is distinct from v_source.trigger_description_he
       or new.offset_value is distinct from v_source.offset_value
       or new.offset_unit is distinct from v_source.offset_unit
       or new.recurring is distinct from v_source.recurring
       or new.status not in ('pending', 'resolved', 'dismissed')
       or (new.status = 'resolved' and (new.recurring or new.trigger_event_date is null))
       or (new.status = 'pending' and new.trigger_event_date is not null and not new.recurring
           and coalesce(new.metadata ->> 'pending_reason', '') = '') then
      raise exception using errcode = '23514', message = 'R5 condition lifecycle update changed contractual truth';
    end if;
    return new;
  end if;

  if v_source.review_status not in ('approved', 'corrected')
     or v_source.schedule_impact <> 'yes'
     or v_source.conflict_status = 'unresolved'
     or v_source.projection_status not in ('ready', 'projected')
     or v_source.schedule_project_id is null
     or v_source.schedule_project_id <> new.project_id then
    raise exception using errcode = '23514', message = 'R5 source decision is not eligible for Schedule projection';
  end if;
  if exists (
    select 1 from private.contracts newer
    where newer.workspace_id = v_source.workspace_id
      and newer.document_version_id = v_source.document_version_id
      and newer.parser_generation_id = v_source.parser_generation_id
      and newer.decision_key = v_source.decision_key
      and newer.revision > v_source.revision
  ) then
    raise exception using errcode = '23514', message = 'R5 source decision is not the current decision revision';
  end if;

  if tg_table_name = 'schedule_contract_conditions' then
    if v_source.temporal_kind not in ('relative', 'recurring')
       or new.anchor_description is distinct from v_source.trigger_description_he
       or new.offset_value is distinct from v_source.offset_value
       or new.offset_unit is distinct from v_source.offset_unit
       or new.recurring is distinct from v_source.recurring
       or new.status is distinct from 'pending'
       or new.trigger_event_date is not null then
      raise exception using errcode = '23514', message = 'R5 condition target does not match the unresolved relative contractual decision';
    end if;
  elsif tg_table_name = 'schedule_contract_milestones' then
    if v_source.temporal_kind <> 'fixed'
       or v_source.contract_date is null
       or new.contract_date is distinct from v_source.contract_date
       or new.source_document_id is distinct from v_source.document_version_id
       or new.status is distinct from 'active' then
      raise exception using errcode = '23514', message = 'R5 milestone target does not match the fixed contractual decision';
    end if;
  elsif tg_table_name = 'schedule_contract_extensions' then
    if v_source.temporal_kind <> 'extension'
       or new.source_document_id is distinct from v_source.document_version_id
       or new.status is distinct from 'approved' then
      raise exception using errcode = '23514', message = 'R5 extension target does not match the approved extension decision';
    end if;
  else
    raise exception using errcode = '23514', message = 'R5 source validation was attached to an unsupported target';
  end if;

  if tg_table_name <> 'schedule_contract_milestones' and exists (
    select 1 from public.schedule_contract_milestones target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns a milestone target';
  end if;
  if tg_table_name <> 'schedule_contract_conditions' and exists (
    select 1 from public.schedule_contract_conditions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns a condition target';
  end if;
  if tg_table_name <> 'schedule_contract_extensions' and exists (
    select 1 from public.schedule_contract_extensions target
    where target.source_contract_decision_id = new.source_contract_decision_id
  ) then
    raise exception using errcode = '23505', message = 'R5 source decision already owns an extension target';
  end if;

  return new;
end
$function$;

create or replace function public.bidoc_schedule_resolve_condition_v1(
  p_condition_id uuid,
  p_project_id uuid,
  p_trigger_date date,
  p_due_date date,
  p_trigger_source_table text,
  p_trigger_source_id uuid,
  p_trigger_evidence jsonb,
  p_confidence numeric,
  p_extractor_version text,
  p_pending_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_condition public.schedule_contract_conditions%rowtype;
  v_milestone_key text;
  v_evidence_quote text;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  if p_condition_id is null or p_project_id is null or p_trigger_date is null
     or jsonb_typeof(coalesce(p_trigger_evidence, '{}'::jsonb)) <> 'object'
     or p_confidence is null or p_confidence < 0 or p_confidence > 1
     or char_length(btrim(coalesce(p_extractor_version, ''))) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Condition resolution request is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('schedule-condition:' || p_condition_id::text, 0));
  select condition.* into v_condition
  from public.schedule_contract_conditions condition
  where condition.id = p_condition_id
    and condition.project_id = p_project_id
    and condition.status = 'pending'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pending contractual condition was not found';
  end if;

  v_milestone_key := 'condition:' || v_condition.condition_key ||
    case when v_condition.recurring then ':' || p_trigger_date::text else '' end;
  v_evidence_quote := nullif(btrim(p_trigger_evidence ->> 'evidenceQuote'), '');

  if p_due_date is not null then
    insert into public.schedule_contract_milestones (
      project_id, milestone_key, name, contract_date, is_project_completion,
      activity_key, status, source_document_id, source_excerpt, confidence,
      written_by, extractor_version, metadata, source_contract_decision_id,
      updated_at
    ) values (
      p_project_id, v_milestone_key, v_condition.name, p_due_date,
      v_condition.is_project_completion, null, 'active',
      nullif(v_condition.metadata ->> 'document_version_id', ''),
      left(concat_ws(E'\n\nTrigger evidence: ', v_condition.source_excerpt, v_evidence_quote), 4000),
      least(coalesce(v_condition.confidence, 1), p_confidence),
      'schedule_condition_resolver', p_extractor_version,
      v_condition.metadata || jsonb_build_object(
        'condition_key', v_condition.condition_key,
        'trigger_date', p_trigger_date,
        'trigger_evidence', p_trigger_evidence
      ),
      null,
      pg_catalog.clock_timestamp()
    )
    on conflict (project_id, milestone_key) do update
    set contract_date = excluded.contract_date,
        source_document_id = excluded.source_document_id,
        source_excerpt = excluded.source_excerpt,
        confidence = excluded.confidence,
        metadata = excluded.metadata,
        source_contract_decision_id = excluded.source_contract_decision_id,
        updated_at = pg_catalog.clock_timestamp();
  end if;

  update public.schedule_contract_conditions
  set status = case when p_due_date is null or recurring then 'pending' else 'resolved' end,
      resolved_milestone_key = case when p_due_date is null then resolved_milestone_key else v_milestone_key end,
      trigger_event_date = p_trigger_date,
      trigger_source_table = nullif(btrim(p_trigger_source_table), ''),
      trigger_source_id = p_trigger_source_id,
      metadata = metadata || jsonb_build_object(
        'trigger_evidence', p_trigger_evidence,
        'pending_reason', p_pending_reason,
        'last_resolution_attempt_at', pg_catalog.clock_timestamp()
      ),
      updated_at = pg_catalog.clock_timestamp()
  where id = p_condition_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when p_due_date is null or v_condition.recurring then 'pending' else 'resolved' end,
    'conditionId', p_condition_id,
    'milestoneKey', case when p_due_date is null then null else v_milestone_key end,
    'triggerDate', p_trigger_date,
    'dueDate', p_due_date,
    'pendingReason', p_pending_reason
  );
end
$function$;

create or replace function public.bidoc_contracts_source_object_v1(
  p_workspace_id uuid,
  p_decision_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_workspace private.contract_workspaces%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;
  select workspace.* into v_workspace
  from private.contract_workspaces workspace
  where workspace.id = p_workspace_id
    and exists (
      select 1 from private.contracts decision
      where decision.id = p_decision_id and decision.workspace_id = workspace.id
    );
  if not found then
    raise exception using errcode = 'P0002', message = 'Contract source object was not found';
  end if;
  return jsonb_build_object(
    'workspaceId', v_workspace.id,
    'decisionId', p_decision_id,
    'documentVersionId', v_workspace.document_version_id,
    'filename', v_workspace.filename,
    'storageBucket', v_workspace.storage_bucket,
    'storageObjectKey', v_workspace.storage_object_key
  );
end
$function$;

revoke execute on function public.bidoc_indicator_schedule_project_context_v1(uuid) from public, anon, authenticated;
revoke execute on function public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.bidoc_indicator_sync_schedule_project_contract_conditions_v1(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text) from public, anon, authenticated;
revoke execute on function public.bidoc_contracts_source_object_v1(uuid,uuid) from public, anon, authenticated;

grant execute on function public.bidoc_indicator_schedule_project_context_v1(uuid) to service_role;
grant execute on function public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean) to service_role;
grant execute on function public.bidoc_indicator_sync_schedule_project_contract_conditions_v1(uuid,boolean) to service_role;
grant execute on function public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text) to service_role;
grant execute on function public.bidoc_contracts_source_object_v1(uuid,uuid) to service_role;

create index if not exists schedule_contract_conditions_pending_project_idx
  on public.schedule_contract_conditions (project_id, created_at)
  where status = 'pending';

comment on function public.bidoc_indicator_sync_contract_conditions_v1(uuid,boolean) is
  'Indicator-owned, review-gated synchronization of current relative Contracts decisions into the Schedule waiting pool.';
comment on function public.bidoc_schedule_resolve_condition_v1(uuid,uuid,date,date,text,uuid,jsonb,numeric,text,text) is
  'Atomically records trigger evidence and, when a deterministic due date is available, promotes a pending condition to a milestone.';

commit;
