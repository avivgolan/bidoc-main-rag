-- Data Query Agent: read-only SQL execution RPC
-- Used by src/subagents/dataQuery.js -> execReadSql():
--   POST /rest/v1/rpc/exec_read_sql  body { "q": "<select ...>", "max_rows": 200 }
--
-- Run this in the Supabase SQL Editor for EVERY database the Data Query Agent
-- targets (the app/MAIN project and the separate content project).
--
-- Safety: this function ONLY runs a single read-only SELECT/WITH statement.
-- A hard transaction-level guard (transaction_read_only = on) makes any write
-- or DDL fail at the database level, even if the keyword checks are bypassed.

create or replace function public.exec_read_sql(q text, max_rows int default 200)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  cleaned text := rtrim(btrim(coalesce(q, '')), ';');
  capped  int  := least(greatest(coalesce(max_rows, 200), 1), 1000);
  result  jsonb;
begin
  if cleaned = '' then
    raise exception 'empty query';
  end if;

  -- Only one statement, and it must be a read query.
  if cleaned ~ ';' then
    raise exception 'multiple statements are not allowed';
  end if;
  if lower(cleaned) !~ '^(select|with)\s' then
    raise exception 'only read-only SELECT/WITH queries are allowed';
  end if;

  -- Hard database-level guard: any INSERT/UPDATE/DELETE/DDL fails under this.
  set local transaction_read_only = on;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
       from ( select * from ( %s ) _q limit %s ) t',
    cleaned,
    capped
  )
  into result;

  return result;
end;
$$;

-- The agent calls this with the service role key.
grant execute on function public.exec_read_sql(text, int) to service_role;

-- Refresh PostgREST so the new RPC is visible immediately (avoids the
-- "could not find function / schema cache" error).
notify pgrst, 'reload schema';
