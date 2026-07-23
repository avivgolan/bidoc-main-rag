-- Data Query Agent Phase 3.1: managed Supabase Auth service account.
--
-- The native JWT database role stays `authenticated`. Authorization is carried
-- in immutable app_metadata.data_query_role and checked inside this wrapper.
-- The implementation function remains fixed-table, typed, and SQL-free.

do $$
begin
  if to_regprocedure(
    'public.bidoc_data_query_data_index_impl_v1(text,jsonb,text[],jsonb,text[],text,text,jsonb,integer)'
  ) is null then
    if to_regprocedure(
      'public.bidoc_data_query_data_index_v1(text,jsonb,text[],jsonb,text[],text,text,jsonb,integer)'
    ) is null then
      raise exception 'Phase 2 exact analytics function is missing';
    end if;
    alter function public.bidoc_data_query_data_index_v1(
      text, jsonb, text[], jsonb, text[], text, text, jsonb, integer
    ) rename to bidoc_data_query_data_index_impl_v1;
  end if;
end
$$;

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
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
begin
  if coalesce(v_claims->>'role', '') <> 'bidoc_data_query'
     and coalesce(v_claims#>>'{app_metadata,data_query_role}', '') <> 'bidoc_data_query' then
    raise exception using
      errcode = '42501',
      message = 'Data Query service-account authorization is required';
  end if;

  return public.bidoc_data_query_data_index_impl_v1(
    p_operation,
    p_filters,
    p_group_by,
    p_metrics,
    p_select,
    p_date_field,
    p_granularity,
    p_order_by,
    p_limit
  );
end;
$$;

-- Keep the database role non-login. Managed tokens enter through PostgREST's
-- authenticator, so no long-lived database password or signing key is needed.
alter role bidoc_data_query nologin noinherit connection limit 3;

-- The wrapper owns the data access boundary. A leaked agent token cannot select
-- raw rows or execute the implementation function directly.
revoke all privileges on all tables in schema public from bidoc_data_query;
revoke all privileges on all sequences in schema public from bidoc_data_query;
revoke execute on function public.bidoc_data_query_data_index_impl_v1(
  text, jsonb, text[], jsonb, text[], text, text, jsonb, integer
) from public, anon, authenticated, service_role, bidoc_data_query;
revoke execute on function public.bidoc_data_query_data_index_v1(
  text, jsonb, text[], jsonb, text[], text, text, jsonb, integer
) from public, anon, service_role;
grant execute on function public.bidoc_data_query_data_index_v1(
  text, jsonb, text[], jsonb, text[], text, text, jsonb, integer
) to authenticated, bidoc_data_query;

-- These existing SECURITY DEFINER functions had implicit PUBLIC execution.
-- Their explicit anon/authenticated/service_role grants remain unchanged, while
-- bidoc_data_query no longer inherits access through PUBLIC.
do $$
declare
  v_function regprocedure;
begin
  foreach v_function in array array[
    to_regprocedure('public.find_entity_for_attachment(text,uuid)'),
    to_regprocedure('public.stamp_chunk_indices(text,text)'),
    to_regprocedure('public.stamp_meetings_chunk_indices(text)')
  ]
  loop
    if v_function is not null then
      execute format('revoke execute on function %s from public', v_function);
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
