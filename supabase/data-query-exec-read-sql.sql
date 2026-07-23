-- Data Query Agent Phase 0/1 hardening (Kapaim Content project only).
--
-- The raw-SQL RPC is deliberately removed. The supported runtime uses typed
-- PostgREST Query Plans authenticated as the dedicated bidoc_data_query role.
-- Re-running this file is safe.

do $$
begin
  if to_regprocedure('public.exec_read_sql(text,integer)') is not null then
    revoke execute on function public.exec_read_sql(text, integer) from public, anon, authenticated, service_role;
    drop function public.exec_read_sql(text, integer);
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bidoc_data_query') then
    create role bidoc_data_query nologin noinherit;
  end if;
end
$$;

grant bidoc_data_query to authenticator;
alter role bidoc_data_query set statement_timeout = '8s';

grant usage on schema public to bidoc_data_query;
grant select on table public.data_index to bidoc_data_query;
revoke insert, update, delete, truncate, references, trigger
  on table public.data_index from bidoc_data_query;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'data_index'
      and policyname = 'data_index_bidoc_data_query_select'
  ) then
    create policy data_index_bidoc_data_query_select
      on public.data_index
      for select
      to bidoc_data_query
      using (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
