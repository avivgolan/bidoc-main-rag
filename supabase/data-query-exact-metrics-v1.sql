-- Data Query Agent Phase 2: exact, typed analytics for public.data_index.
-- The function is SECURITY INVOKER, accepts no SQL, targets one fixed table,
-- validates every identifier/operator, and is executable only by the
-- bidoc_data_query role created in the Phase 0/1 hardening migration.

create or replace function public.bidoc_data_query_data_index_v1(
  p_operation text,
  p_filters jsonb default '[]'::jsonb,
  p_group_by text[] default '{}'::text[],
  p_metrics jsonb default '[]'::jsonb,
  p_select text[] default '{}'::text[],
  p_date_field text default null,
  p_granularity text default 'day',
  p_order_by jsonb default '[]'::jsonb,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_operation text := lower(coalesce(p_operation, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_where text := 'true';
  v_filter jsonb;
  v_metric jsonb;
  v_field text;
  v_op text;
  v_value text;
  v_type text;
  v_operator text;
  v_in_list text;
  v_group_sql text := '';
  v_select_sql text := '';
  v_metric_sql text := '';
  v_alias text;
  v_metric_type text;
  v_first_metric_alias text := '';
  v_period_sql text;
  v_rows jsonb := '[]'::jsonb;
  v_cardinality bigint := 0;
  v_result_rows bigint := 0;
  v_truncated boolean := false;
  v_queryable_fields constant text[] := array[
    'id', 'created_at', 'project_id', 'source_table', 'source_id',
    'primary_date', 'item_status', 'severity_or_risk', 'mail_id',
    'attachment_id', 'processed_mentioned', 'event_date', 'document_date'
  ];
  v_groupable_fields constant text[] := array[
    'source_table', 'item_status', 'severity_or_risk', 'processed_mentioned',
    'event_date', 'document_date'
  ];
  v_selectable_fields constant text[] := array[
    'id', 'created_at', 'project_id', 'source_table', 'primary_date',
    'item_status', 'severity_or_risk', 'processed_mentioned',
    'event_date', 'document_date'
  ];
  v_date_fields constant text[] := array[
    'created_at', 'primary_date', 'event_date', 'document_date'
  ];
begin
  if v_operation <> all(array['count', 'group_count', 'aggregate', 'timeseries', 'top_n', 'distinct']) then
    raise exception 'unsupported operation: %', v_operation;
  end if;
  if jsonb_typeof(coalesce(p_filters, '[]'::jsonb)) <> 'array' then
    raise exception 'filters must be a JSON array';
  end if;
  if jsonb_typeof(coalesce(p_metrics, '[]'::jsonb)) <> 'array' then
    raise exception 'metrics must be a JSON array';
  end if;
  if jsonb_typeof(coalesce(p_order_by, '[]'::jsonb)) <> 'array' then
    raise exception 'order_by must be a JSON array';
  end if;
  if cardinality(coalesce(p_group_by, '{}'::text[])) > 2 then
    raise exception 'at most two group fields are supported';
  end if;

  for v_filter in select value from jsonb_array_elements(coalesce(p_filters, '[]'::jsonb))
  loop
    v_field := v_filter->>'field';
    v_op := lower(coalesce(v_filter->>'op', ''));
    v_value := v_filter->>'value';
    if not (v_field = any(v_queryable_fields)) then
      raise exception 'filter field is not allowed: %', v_field;
    end if;
    if v_op <> all(array['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'ilike', 'in', 'is']) then
      raise exception 'filter operator is not allowed: %', v_op;
    end if;

    v_type := case
      when v_field = 'id' then 'bigint'
      when v_field in ('created_at', 'primary_date') then 'timestamptz'
      when v_field in ('event_date', 'document_date') then 'date'
      when v_field = 'project_id' then 'uuid'
      when v_field = 'processed_mentioned' then 'boolean'
      else 'text'
    end;

    if v_op = 'is' then
      if v_filter->'value' = 'null'::jsonb or lower(coalesce(v_value, 'null')) = 'null' then
        v_where := v_where || format(' and %I is null', v_field);
      elsif v_type = 'boolean' and lower(v_value) in ('true', 'false') then
        v_where := v_where || format(' and %I is %s', v_field, lower(v_value));
      else
        raise exception 'invalid is filter for field %', v_field;
      end if;
    elsif v_op = 'in' then
      if jsonb_typeof(v_filter->'value') <> 'array' or jsonb_array_length(v_filter->'value') = 0 then
        raise exception 'in filter requires a non-empty array';
      end if;
      select string_agg(format('%L', item), ',')
      into v_in_list
      from jsonb_array_elements_text(v_filter->'value') as values_list(item);
      -- Cast the array to the registered field type. This both preserves index/type
      -- semantics and rejects malformed values even if the RPC is called directly.
      v_where := v_where || format(' and %I = any(array[%s]::%s[])', v_field, v_in_list, v_type);
    elsif v_op = 'ilike' then
      if v_type <> 'text' then
        raise exception 'ilike requires a text field';
      end if;
      v_where := v_where || format(' and %I ilike %L', v_field, v_value);
    else
      v_operator := case v_op
        when 'eq' then '='
        when 'neq' then '<>'
        when 'gt' then '>'
        when 'gte' then '>='
        when 'lt' then '<'
        when 'lte' then '<='
      end;
      if v_type = 'text' then
        if v_op not in ('eq', 'neq') then raise exception 'ordered comparison requires a typed ordered field'; end if;
        v_where := v_where || format(' and %I %s %L', v_field, v_operator, v_value);
      else
        v_where := v_where || format(' and %I %s %L::%s', v_field, v_operator, v_value, v_type);
      end if;
    end if;
  end loop;

  execute format('select count(*) from public.data_index where %s', v_where)
  into v_cardinality;

  if v_operation = 'count' then
    v_rows := jsonb_build_array(jsonb_build_object('count', v_cardinality));
    v_result_rows := 1;

  elsif v_operation in ('group_count', 'top_n') then
    if cardinality(coalesce(p_group_by, '{}'::text[])) = 0 then
      raise exception '% requires at least one group field', v_operation;
    end if;
    foreach v_field in array p_group_by loop
      if not (v_field = any(v_groupable_fields)) then raise exception 'group field is not allowed: %', v_field; end if;
      v_group_sql := concat_ws(', ', nullif(v_group_sql, ''), format('%I', v_field));
    end loop;
    execute format('select count(*) from (select 1 from public.data_index where %s group by %s) grouped', v_where, v_group_sql)
    into v_result_rows;
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (
         select %s, count(*)::bigint as count
         from public.data_index where %s
         group by %s
         order by count desc, %s
         limit %s
       ) q',
      v_group_sql, v_where, v_group_sql, v_group_sql, v_limit
    ) into v_rows;

  elsif v_operation = 'distinct' then
    v_field := coalesce(p_select[1], p_group_by[1]);
    if not (v_field = any(v_selectable_fields)) then raise exception 'distinct field is not allowed: %', v_field; end if;
    execute format('select count(distinct %I) from public.data_index where %s and %I is not null', v_field, v_where, v_field)
    into v_result_rows;
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (
         select %I from public.data_index
         where %s and %I is not null
         group by %I order by %I limit %s
       ) q',
      v_field, v_where, v_field, v_field, v_field, v_limit
    ) into v_rows;

  elsif v_operation = 'timeseries' then
    v_field := coalesce(p_date_field, 'primary_date');
    if not (v_field = any(v_date_fields)) then raise exception 'timeseries field is not allowed: %', v_field; end if;
    if lower(coalesce(p_granularity, 'day')) not in ('day', 'month') then raise exception 'timeseries granularity must be day or month'; end if;
    v_period_sql := format('date_trunc(%L, %I)::date', lower(coalesce(p_granularity, 'day')), v_field);
    execute format('select count(*) from (select 1 from public.data_index where %s and %I is not null group by %s) periods', v_where, v_field, v_period_sql)
    into v_result_rows;
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (
         select %s as period, count(*)::bigint as count
         from public.data_index where %s and %I is not null
         group by 1 order by 1 limit %s
       ) q',
      v_period_sql, v_where, v_field, v_limit
    ) into v_rows;

  elsif v_operation = 'aggregate' then
    if cardinality(coalesce(p_group_by, '{}'::text[])) > 0 then
      foreach v_field in array p_group_by loop
        if not (v_field = any(v_groupable_fields)) then raise exception 'group field is not allowed: %', v_field; end if;
        v_group_sql := concat_ws(', ', nullif(v_group_sql, ''), format('%I', v_field));
      end loop;
    end if;
    if jsonb_array_length(coalesce(p_metrics, '[]'::jsonb)) = 0 then
      p_metrics := '[{"type":"count","as":"count"}]'::jsonb;
    end if;
    for v_metric in select value from jsonb_array_elements(p_metrics)
    loop
      v_metric_type := lower(coalesce(v_metric->>'type', ''));
      v_field := v_metric->>'field';
      v_alias := coalesce(v_metric->>'as', v_metric_type);
      if v_alias !~ '^[a-zA-Z][a-zA-Z0-9_]{0,62}$' then raise exception 'invalid metric alias: %', v_alias; end if;
      if v_metric_type = 'count' then
        v_select_sql := 'count(*)::bigint';
      elsif v_metric_type in ('min', 'max') and v_field = 'id' then
        v_select_sql := case v_metric_type
          when 'min' then 'min(id)::bigint'
          when 'max' then 'max(id)::bigint'
        end;
      else
        raise exception 'metric % is not allowed for field %', v_metric_type, v_field;
      end if;
      v_metric_sql := concat_ws(', ', nullif(v_metric_sql, ''), format('%s as %I', v_select_sql, v_alias));
      if v_first_metric_alias = '' then v_first_metric_alias := v_alias; end if;
    end loop;

    if v_group_sql = '' then
      execute format('select jsonb_build_array(to_jsonb(q)) from (select %s from public.data_index where %s) q', v_metric_sql, v_where)
      into v_rows;
      v_result_rows := 1;
    else
      execute format('select count(*) from (select 1 from public.data_index where %s group by %s) grouped', v_where, v_group_sql)
      into v_result_rows;
      execute format(
        'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from (
           select %s, %s from public.data_index where %s
           group by %s order by %I desc nulls last, %s limit %s
         ) q',
        v_group_sql, v_metric_sql, v_where, v_group_sql, v_first_metric_alias, v_group_sql, v_limit
      ) into v_rows;
    end if;
  end if;

  v_truncated := v_result_rows > v_limit;
  return jsonb_build_object(
    'version', 1,
    'operation', v_operation,
    'rows', coalesce(v_rows, '[]'::jsonb),
    'cardinality', v_cardinality,
    'result_rows', v_result_rows,
    'exactness', case when v_truncated then 'truncated' else 'exact' end,
    'truncated', v_truncated,
    'sampled', false
  );
end;
$$;

revoke execute on function public.bidoc_data_query_data_index_v1(text, jsonb, text[], jsonb, text[], text, text, jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bidoc_data_query_data_index_v1(text, jsonb, text[], jsonb, text[], text, text, jsonb, integer)
  to bidoc_data_query;

create index if not exists data_index_primary_date_idx
  on public.data_index (primary_date desc);
create index if not exists data_index_project_primary_date_idx
  on public.data_index (project_id, primary_date desc);
create index if not exists data_index_source_table_primary_date_idx
  on public.data_index (source_table, primary_date desc);

notify pgrst, 'reload schema';
