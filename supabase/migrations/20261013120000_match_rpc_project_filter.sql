-- ============================================================
-- match_<table> RPCs: optional Project filter
-- Company DB migration (every Company DB; NOT the App/MAIN DB).
--
-- One Company DB holds several Projects. main-agent passes
-- project_id_filter for Project-scoped chat; NULL keeps the old behaviour,
-- so existing callers are unaffected. main-agent falls back to an
-- unfiltered call + project-filtered row select when the param is missing.
--
-- Each match_<table> is recreated only when the table has bigint id,
-- content, metadata, embedding and a uuid project_id; other tables are
-- skipped with a NOTICE. Every existing overload of the name is dropped
-- first so PostgREST never sees two candidates.
-- ============================================================

BEGIN;

DO $migration$
DECLARE
  t text;
  fn record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alerts', 'meetings', 'emails', 'whatsapp_analysis', 'whatsapp_messages',
    'financial_transactions', 'safety_reports', 'consultants_reports',
    'exceptions_report', 'quality_control', 'daily_work_log', 'gantt_tasks'
  ] LOOP
    IF (
      SELECT count(*) FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t
        AND (
          (c.column_name = 'id' AND c.data_type = 'bigint') OR
          (c.column_name = 'project_id' AND c.data_type = 'uuid') OR
          (c.column_name IN ('content', 'metadata', 'embedding'))
        )
    ) < 5 THEN
      RAISE NOTICE 'match_%: skipped (table or required columns missing)', t;
      CONTINUE;
    END IF;

    FOR fn IN
      SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'match_' || t
    LOOP
      EXECUTE format('DROP FUNCTION %s', fn.signature);
    END LOOP;

    EXECUTE format($create$
      CREATE FUNCTION public.%1$I(
        query_embedding   vector,
        match_count       integer          DEFAULT NULL,
        filter            jsonb            DEFAULT '{}',
        match_threshold   double precision DEFAULT 0.5,
        project_id_filter uuid             DEFAULT NULL
      ) RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
      LANGUAGE plpgsql STABLE AS $body$
      #variable_conflict use_column
      begin
        return query
        select src.id, src.content, src.metadata,
          1 - (src.embedding <=> query_embedding) as similarity
        from public.%2$I src
        where src.metadata @> filter
          and (project_id_filter is null or src.project_id = project_id_filter)
          and 1 - (src.embedding <=> query_embedding) > match_threshold
        order by src.embedding <=> query_embedding
        limit match_count;
      end;
      $body$
    $create$, 'match_' || t, t);
  END LOOP;
END
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
