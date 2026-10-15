-- ============================================================
-- Lab dataset tables (ticket 06, ADR 0012)
-- MAIN migration. Apply to MAIN only: NOT a Company DB, NOT the Meta DB.
--
-- The Lab reads a test copy of one Project's content from MAIN: the Company DB
-- template's tables (same table and column names as bidoc 006_new_company_db_schema.sql),
-- stamped with the Lab Project id 00000000-0000-4000-8000-0000000001ab. The Lab action
-- "load test dataset" fills them (src/labDatasetCopy.js); this file creates the shape only.
--
-- Safe to re-run, and safe on a MAIN that already has some of these tables from the legacy era:
--   * a table that does not exist is created (RLS on, no policy, service role only);
--   * a table that exists is never dropped, never emptied, and keeps its rows, its RLS and its
--     grants: only the columns the Lab needs and it lacks are added (nullable or defaulted);
--   * an existing table whose id is not unique, or whose project_id is not a uuid, aborts the
--     whole migration (one transaction, nothing is applied) so it can be looked at first;
--   * a function that already accepts the Project filter is left alone; otherwise it is created
--     next to any older overload (no overload is dropped);
--   * the legacy *_gf tables of JFrog are not touched: the Lab dataset uses the template names
--     (data_index, alerts, ...), never data_index_embeddings_gf_dor_agent / alerts_embeddings_gf.
-- Ids are plain primary keys (no identity): the copy keeps the source ids. No foreign keys and no
-- check constraints: a slice is a partial copy and must load in any order.
-- No vector index: a Lab slice is a few thousand rows.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Creates one Lab table, or tops up one that MAIN already has. Session-local: it disappears with the
-- session. p_id_def is the id column's type (and default); p_columns are the other columns.
--   * missing table: created with RLS on and no policy, service role only;
--   * existing table: id must be unique (the copy upserts on id) and project_id, if present, a uuid,
--     else the migration aborts; then only the columns it lacks are added (nullable or defaulted).
CREATE FUNCTION pg_temp.lab_dataset_table(p_table text, p_id_def text, p_columns text[])
RETURNS void LANGUAGE plpgsql AS $table$
DECLARE
  v_id_type text := split_part(p_id_def, ' ', 1);
  v_has_project boolean := p_table <> 'projects' AND EXISTS (SELECT 1 FROM unnest(p_columns) c WHERE c LIKE 'project_id %');
  v_actual_id text;
  v_actual_project text;
  v_col text;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.%I (id %s PRIMARY KEY, %s)', p_table, p_id_def,
      (SELECT string_agg(CASE WHEN c = 'project_id uuid' AND v_has_project THEN 'project_id uuid NOT NULL' ELSE c END, ', ') FROM unnest(p_columns) c)
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', p_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', p_table);
  ELSE
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_actual_id
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.' || p_table) AND a.attname = 'id' AND NOT a.attisdropped;
    IF v_actual_id IS DISTINCT FROM v_id_type THEN
      RAISE EXCEPTION 'lab dataset: existing table public.% has id type %, expected % (nothing was changed)', p_table, coalesce(v_actual_id, 'none'), v_id_type;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = to_regclass('public.' || p_table) AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
        AND i.indnatts = 1 AND i.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attname = 'id')
    ) THEN
      RAISE EXCEPTION 'lab dataset: existing table public.% has no unique id (nothing was changed)', p_table;
    END IF;
    IF v_has_project THEN
      SELECT format_type(a.atttypid, a.atttypmod) INTO v_actual_project
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass('public.' || p_table) AND a.attname = 'project_id' AND NOT a.attisdropped;
      IF v_actual_project IS NOT NULL AND v_actual_project <> 'uuid' THEN
        RAISE EXCEPTION 'lab dataset: existing table public.% has project_id type %, expected uuid (nothing was changed)', p_table, v_actual_project;
      END IF;
    END IF;
    FOREACH v_col IN ARRAY p_columns LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %s', p_table, v_col);
    END LOOP;
  END IF;
  IF v_has_project THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (project_id)', p_table || '_lab_project_idx', p_table);
  END IF;
END
$table$;

-- ─── Tables (the Company DB template's shape) ────────────────
DO $tables$
BEGIN
  PERFORM pg_temp.lab_dataset_table('projects', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'name text', 'settings jsonb DEFAULT ''{}''::jsonb', 'is_active boolean DEFAULT true',
    'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('data_index', 'bigint', ARRAY[
    'created_at timestamptz DEFAULT now()', 'project_id uuid', 'source_table text', 'source_id text',
    'summary text', 'hashtags text[]', 'index_text text', 'metadata jsonb', 'embedding vector(3072)',
    'primary_date timestamptz', 'title text', 'item_status text', 'severity_or_risk text', 'mail_id text',
    'attachment_id text', 'source_url text', 'mentioned_dates text[]',
    'processed_mentioned boolean DEFAULT false', 'event_date date', 'document_date date',
    'end_date timestamptz'
  ]);
  PERFORM pg_temp.lab_dataset_table('alerts', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'question text', 'answer text',
    'alert_description text', 'alert_type text', 'severity_level smallint', 'input_data_type text',
    'input_data_id text', 'analyzed_data text', 'data_link text', 'data_date timestamptz', 'status text',
    'item_status text DEFAULT ''בטיפול''::text', 'is_relevant boolean DEFAULT true', 'hashtags text[]',
    'summary text', 'content text', 'metadata jsonb', 'embedding vector(3072)',
    'alert_configuration_id bigint', 'analysis_fingerprint text', 'configuration_fingerprint text',
    'lifecycle_status text DEFAULT ''active''::text', 'occurrence_group_id text'
  ]);
  PERFORM pg_temp.lab_dataset_table('emails', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'mail_id text', 'received_date timestamptz',
    'subject text', 'sender_name text', 'sender_mail text', 'sender_domain text', 'other_recipients text[]',
    'mail_body text', 'has_attachments boolean', 'hashtags text[]', 'mail_summarize text',
    'mail_category text', 'processed_for_insights boolean', 'conversationid text', 'direction text',
    'item_status text DEFAULT ''בטיפול''::text', 'summary text', 'content text', 'metadata jsonb',
    'embedding vector(3072)', 'relevance_status text', 'enrichment_run_id text',
    'enrichment_started_at timestamptz'
  ]);
  PERFORM pg_temp.lab_dataset_table('email_attachments', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'mail_id text', 'original_file_name text',
    'ftp_path text', 'attachment_id text', 'current_filename text', 'hash text', 'source text',
    'attachment_link text', 'attachment_category text', 'analyze_type text', 'is_filtered boolean',
    'attachment_date timestamptz'
  ]);
  PERFORM pg_temp.lab_dataset_table('meetings', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'meeting_date timestamptz', 'meeting_hour text',
    'meeting_goal text', 'external_meeting_ref text', 'attendances text', 'decisions_made text',
    'subject text', 'description text', 'mentioned_dates jsonb', 'mentioned_responsibles jsonb', 'status text',
    'document_filename text', 'mail_id text', 'attachment_id text', 'processed_for_insights boolean',
    'item_status text DEFAULT ''בטיפול''::text', 'hashtags text[]', 'summary text', 'content text',
    'metadata jsonb', 'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('meetings_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_id bigint',
    'attachment_id text DEFAULT ''unknown''::text', 'content text DEFAULT ''(no content)''::text',
    'metadata jsonb', 'chunk_index integer', 'chunk_total integer', 'primary_date timestamptz',
    'mentioned_dates text[]', 'document_name text', 'embedding vector(3072)', 'hashtags text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('safety_reports', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'report_date timestamptz', 'site_location text',
    'total_workers integer', 'life_threatening_defects integer', 'severe_defects integer',
    'medium_defects integer', 'minor_defects integer', 'resolved integer', 'project_manager text',
    'site_manager text', 'risk_level text', 'mail_id text', 'attachment_id text', 'site_grade text',
    'processed_for_insights boolean', 'document_filename text', 'defect_details text',
    'item_status text DEFAULT ''בטיפול''::text', 'hashtags text[]', 'summary text', 'content text',
    'metadata jsonb', 'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('safety_reports_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_id bigint',
    'attachment_id text DEFAULT ''unknown''::text', 'content text DEFAULT ''(no content)''::text',
    'metadata jsonb', 'chunk_index integer', 'chunk_total integer', 'primary_date timestamptz',
    'mentioned_dates text[]', 'document_name text', 'embedding vector(3072)', 'hashtags text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('quality_control', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'inspection_date timestamptz',
    'defect_title text', 'defect_severity text', 'defect_location text', 'defect_description text',
    'actions_needed text', 'discipline text', 'subject text', 'positive_observations text', 'mail_id text',
    'attachment_id text', 'item_status text DEFAULT ''בטיפול''::text', 'hashtags text[]', 'summary text',
    'content text', 'metadata jsonb', 'embedding vector(3072)', 'processed_for_insights boolean DEFAULT false'
  ]);
  PERFORM pg_temp.lab_dataset_table('quality_control_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_id bigint',
    'attachment_id text DEFAULT ''unknown''::text', 'content text DEFAULT ''(no content)''::text',
    'metadata jsonb', 'chunk_index integer', 'chunk_total integer', 'primary_date timestamptz',
    'mentioned_dates text[]', 'document_name text', 'embedding vector(3072)', 'hashtags text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('daily_work_log', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'log_date timestamptz',
    'daily_work_log_id integer', 'site_name text', 'inspector_name text', 'inspector_comments text',
    'contractor_comments text', 'mail_id text', 'attachment_id text',
    'item_status text DEFAULT ''בטיפול''::text', 'hashtags text[]', 'summary text', 'content text',
    'metadata jsonb', 'embedding vector(3072)', 'processed_for_insights boolean DEFAULT false'
  ]);
  PERFORM pg_temp.lab_dataset_table('daily_work_log_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_id bigint',
    'attachment_id text DEFAULT ''unknown''::text', 'content text DEFAULT ''(no content)''::text',
    'metadata jsonb', 'chunk_index integer', 'chunk_total integer', 'primary_date timestamptz',
    'mentioned_dates text[]', 'document_name text', 'embedding vector(3072)', 'hashtags text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('consultants_reports', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'report_date timestamptz',
    'consultant_name text', 'specialization text', 'report_topic text', 'main_recommendations text',
    'proposed_actions text', 'implementation_status text', 'mail_id text', 'attachment_id text',
    'processed_for_insights boolean', 'document_name text', 'item_status text DEFAULT ''בטיפול''::text',
    'hashtags text[]', 'summary text', 'content text', 'metadata jsonb', 'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('consultants_reports_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_id bigint',
    'attachment_id text DEFAULT ''unknown''::text', 'content text DEFAULT ''(no content)''::text',
    'metadata jsonb', 'chunk_index integer', 'chunk_total integer', 'primary_date timestamptz',
    'mentioned_dates text[]', 'document_name text', 'embedding vector(3072)', 'hashtags text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('exceptions_report', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'exception_date timestamptz',
    'project_name text', 'exception_number integer', 'supervision_company text', 'inspector text',
    'project_manager text', 'exception_subject text', 'exception_description text', 'execution_days integer',
    'requested_amount_ex_vat numeric', 'vat_amount numeric', 'total_amount_incl_vat numeric',
    'main_contractor_profit numeric', 'mail_id text', 'attachment_id text', 'processed_for_insights boolean',
    'urgency_level text', 'item_status text DEFAULT ''בטיפול''::text', 'hashtags text[]', 'summary text',
    'content text', 'metadata jsonb', 'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('financial_transactions', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'transaction_date timestamptz', 'topic text',
    'category text', 'transaction_submitter text', 'status text', 'total text', 'vendor_name text',
    'people text', 'short_description text', 'mail_id text', 'email_attachment_id text',
    'processed_for_insights boolean', 'transaction_type text', 'item_status text DEFAULT ''בטיפול''::text',
    'hashtags text[]', 'summary text', 'content text', 'metadata jsonb', 'embedding vector(3072)',
    'source_document_id text', 'line_number text', 'report_total text', 'amount_numeric numeric',
    'amount_original text', 'report_total_numeric numeric', 'report_total_original text',
    'currency text DEFAULT ''ILS''::text', 'vat_amount numeric', 'amount_before_vat numeric',
    'amount_including_vat numeric', 'document_filename text', 'data_link text'
  ]);
  PERFORM pg_temp.lab_dataset_table('whatsapp_analysis', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'conversation_id bigint', 'tasks_json jsonb',
    'decisions_json jsonb', 'deadlines_json jsonb', 'people_involved_json jsonb', 'locations_json jsonb',
    'hashtags text[]', 'item_status text DEFAULT ''בטיפול''::text', 'summary text', 'content text',
    'metadata jsonb', 'embedding vector(3072)', 'processed_for_insights boolean DEFAULT false',
    'alerts_last_fingerprint text', 'links_json jsonb', 'conversation_title text', 'category text',
    'urgency text'
  ]);
  PERFORM pg_temp.lab_dataset_table('whatsapp_conversations', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'conversation_index integer',
    'conversation_start timestamptz', 'conversation_end timestamptz', 'participants text[]',
    'message_count integer', 'raw_messages jsonb', 'chat_id text', 'metadata jsonb DEFAULT ''{}''::jsonb'
  ]);
  PERFORM pg_temp.lab_dataset_table('other_documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'attachment_date timestamptz',
    'document_name text', 'document_type text', 'source text', 'filename text', 'summary text', 'mail_id text',
    'attachment_id text', 'hashtags text[]', 'metadata jsonb', 'content text', 'embedding vector(3072)',
    'processed_for_insights boolean DEFAULT false'
  ]);
  PERFORM pg_temp.lab_dataset_table('documents', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'source_table text', 'source_id text',
    'content text', 'metadata jsonb', 'hashtags text[]', 'primary_date timestamptz', 'mentioned_dates text[]',
    'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('graph_nodes', 'text', ARRAY[
    'node_type text', 'label text', 'normalized_label text', 'source_table text', 'source_id text',
    'event_date timestamptz', 'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()', 'project_id uuid'
  ]);
  PERFORM pg_temp.lab_dataset_table('graph_edges', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'from_node_id text', 'to_node_id text', 'edge_type text', 'weight numeric DEFAULT 0.5',
    'confidence numeric DEFAULT 0.5', 'evidence_text text', 'metadata jsonb DEFAULT ''{}''::jsonb',
    'created_at timestamptz DEFAULT now()', 'updated_at timestamptz DEFAULT now()', 'project_id uuid',
    'truth_tier text'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_insight_runs', 'bigint', ARRAY[
    'run_id text', 'parent_run_id text', 'project_id uuid', 'focus_query text', 'date_from text',
    'date_to text', 'source_limit integer DEFAULT 350', 'is_expansion boolean DEFAULT false',
    'excluded_source_keys text[] DEFAULT ''{}''::text[]', 'scanned_source_keys text[] DEFAULT ''{}''::text[]',
    'summary jsonb DEFAULT ''{}''::jsonb', 'insights jsonb DEFAULT ''[]''::jsonb',
    'findings jsonb DEFAULT ''[]''::jsonb', 'tool_context jsonb DEFAULT ''{}''::jsonb', 'workflow_log jsonb',
    'run_events jsonb DEFAULT ''[]''::jsonb', 'status text DEFAULT ''done''::text', 'error text',
    'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_intelligence_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'kind text', 'statement text', 'title text', 'source_date date', 'effective_date date',
    'due_date date', 'date_basis text', 'owner_text text', 'decision_maker_text text', 'owner_contact_id uuid',
    'status text DEFAULT ''unknown''::text', 'topic text', 'discipline text', 'location text',
    'company_name text', 'confidence numeric(4,3) DEFAULT 0.500',
    'field_confidence jsonb DEFAULT ''{}''::jsonb', 'needs_attention boolean DEFAULT false',
    'attention_reasons text[] DEFAULT ''{}''::text[]', 'extraction_method text DEFAULT ''n8n''::text',
    'extractor_version text DEFAULT ''intelligence-v6''::text', 'fingerprint text',
    'auto_published boolean DEFAULT true', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb',
    'created_at timestamptz DEFAULT now()', 'updated_at timestamptz DEFAULT now()', 'category text',
    'importance text', 'dedupe_key text', 'recipient_text text', 'content text', 'embedding vector(3072)',
    'summary text', 'hashtags text[] DEFAULT ''{}''::text[]'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_intelligence_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'source_url text', 'attachment_id text', 'mail_id text',
    'channel text', 'extraction_confidence numeric(4,3)', 'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text',
    'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_approval_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'authorization_text text',
    'authorization_type text', 'requester_text text', 'approver_text text', 'authority_body text',
    'request_date date', 'due_date date', 'decision_date date', 'source_date date',
    'status text DEFAULT ''requested''::text', 'conditions text', 'is_blocking boolean DEFAULT false',
    'blocking_effect text', 'resulting_decision text', 'confidence numeric(4,3) DEFAULT 0.980',
    'field_confidence jsonb DEFAULT ''{}''::jsonb', 'needs_attention boolean DEFAULT false',
    'attention_reasons text[] DEFAULT ''{}''::text[]', 'extraction_method text DEFAULT ''n8n''::text',
    'extractor_version text DEFAULT ''approval-v1''::text', 'fingerprint text', 'dedupe_key text',
    'auto_published boolean DEFAULT false', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_approval_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_open_question_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'question_text text',
    'question_type text', 'asker_text text', 'expected_respondent text', 'discipline text', 'location text',
    'requested_date date', 'due_date date', 'source_date date', 'status text DEFAULT ''open''::text',
    'is_blocking boolean DEFAULT false', 'blocking_effect text', 'resulting_decision text',
    'linked_item_text text', 'confidence numeric(4,3) DEFAULT 0.980',
    'field_confidence jsonb DEFAULT ''{}''::jsonb', 'needs_attention boolean DEFAULT false',
    'attention_reasons text[] DEFAULT ''{}''::text[]', 'extraction_method text DEFAULT ''n8n''::text',
    'extractor_version text DEFAULT ''open-question-v1''::text', 'fingerprint text', 'dedupe_key text',
    'auto_published boolean DEFAULT false', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_open_question_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_delay_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'title text', 'statement text', 'certainty text', 'category text', 'cause text',
    'delay_duration_text text', 'delay_days_min integer', 'delay_days_max integer', 'responsible_text text',
    'why_causing_delay text', 'affected_aspect text', 'location text', 'source_date date', 'event_date date',
    'status text DEFAULT ''open''::text', 'confidence numeric(4,3) DEFAULT 0.850',
    'field_confidence jsonb DEFAULT ''{}''::jsonb', 'needs_attention boolean DEFAULT false',
    'attention_reasons text[] DEFAULT ''{}''::text[]', 'extraction_method text DEFAULT ''n8n''::text',
    'extractor_version text DEFAULT ''delay-v1''::text', 'fingerprint text', 'dedupe_key text',
    'auto_published boolean DEFAULT true', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb',
    'created_at timestamptz DEFAULT now()', 'updated_at timestamptz DEFAULT now()', 'content text',
    'embedding vector(3072)', 'summary text', 'hashtags text[]', 'impact_types text[] DEFAULT ''{}''::text[]',
    'cost_impact_min numeric', 'cost_impact_max numeric', 'cost_impact_currency text', 'cost_impact_text text',
    'delay_start_date date', 'expected_resolution_date date', 'resolution_date date',
    'blocking_condition text', 'mitigation_action text', 'next_action text', 'decision_needed_from text',
    'affected_aspect_code text', 'responsible_contact_id uuid', 'responsible_company text', 'importance text',
    'age_days integer', 'age_bucket text', 'source_count integer DEFAULT 0',
    'channels text[] DEFAULT ''{}''::text[]', 'first_evidence_date date', 'last_evidence_date date',
    'evidence_strength text', 'recurrence_count integer DEFAULT 0', 'recurrence_velocity integer DEFAULT 0',
    'priority_score numeric(6,2) DEFAULT 0', 'priority_components jsonb DEFAULT ''{}''::jsonb',
    'action_reasons text[] DEFAULT ''{}''::text[]', 'contradiction_flags text[] DEFAULT ''{}''::text[]',
    'cluster_id uuid', 'entities jsonb DEFAULT ''{}''::jsonb'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_delay_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_safety_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'event_class text', 'hazard text',
    'severity text DEFAULT ''unknown''::text', 'location text', 'affected_area text', 'immediate_action text',
    'stop_work boolean DEFAULT false', 'responsible_text text', 'responsible_company text',
    'occurrence_count integer DEFAULT 1', 'first_observed_at date', 'last_observed_at date',
    'source_date date', 'event_date date', 'status text DEFAULT ''open''::text',
    'confidence numeric(4,3) DEFAULT 0.850', 'field_confidence jsonb DEFAULT ''{}''::jsonb',
    'needs_attention boolean DEFAULT false', 'attention_reasons text[] DEFAULT ''{}''::text[]',
    'extraction_method text DEFAULT ''hybrid''::text', 'extractor_version text DEFAULT ''safety-v1''::text',
    'fingerprint text', 'dedupe_key text', 'auto_published boolean DEFAULT false',
    'corrected boolean DEFAULT false', 'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false',
    'run_id text', 'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_safety_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_quality_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'issue_type text',
    'requirement_or_test text', 'severity text DEFAULT ''unknown''::text', 'location text',
    'affected_work text', 'responsible_text text', 'responsible_company text', 'corrective_action text',
    'verifier text', 'inspection_date date', 'closure_date date', 'source_date date', 'event_date date',
    'status text DEFAULT ''open''::text', 'confidence numeric(4,3) DEFAULT 0.850',
    'field_confidence jsonb DEFAULT ''{}''::jsonb', 'needs_attention boolean DEFAULT false',
    'attention_reasons text[] DEFAULT ''{}''::text[]', 'extraction_method text DEFAULT ''hybrid''::text',
    'extractor_version text DEFAULT ''quality-v1''::text', 'fingerprint text', 'dedupe_key text',
    'auto_published boolean DEFAULT false', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_quality_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_commercial_issue_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'issue_text text',
    'issue_type text', 'document_ref text', 'line_ref text', 'supplier_text text', 'party_text text',
    'amount numeric', 'currency text', 'disputed_amount numeric', 'payment_state text', 'cost_impact text',
    'schedule_impact text', 'required_action text', 'source_date date', 'due_date date',
    'status text DEFAULT ''open''::text', 'is_blocking boolean DEFAULT false', 'blocking_effect text',
    'confidence numeric(4,3) DEFAULT 0.980', 'field_confidence jsonb DEFAULT ''{}''::jsonb',
    'needs_attention boolean DEFAULT false', 'attention_reasons text[] DEFAULT ''{}''::text[]',
    'extraction_method text DEFAULT ''n8n''::text',
    'extractor_version text DEFAULT ''commercial-issue-v1''::text', 'fingerprint text', 'dedupe_key text',
    'auto_published boolean DEFAULT false', 'corrected boolean DEFAULT false',
    'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false', 'run_id text',
    'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_commercial_issue_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_progress_items', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'registry_id uuid', 'title text', 'statement text', 'progress_text text',
    'progress_type text', 'work_area text', 'percent_complete numeric', 'progress_narrative text',
    'source_date date', 'as_of_date date', 'status text DEFAULT ''open''::text',
    'confidence numeric(4,3) DEFAULT 0.980', 'field_confidence jsonb DEFAULT ''{}''::jsonb',
    'needs_attention boolean DEFAULT false', 'attention_reasons text[] DEFAULT ''{}''::text[]',
    'extraction_method text DEFAULT ''n8n''::text', 'extractor_version text DEFAULT ''progress-v1''::text',
    'fingerprint text', 'dedupe_key text', 'auto_published boolean DEFAULT false',
    'corrected boolean DEFAULT false', 'superseded boolean DEFAULT false', 'withdrawn boolean DEFAULT false',
    'run_id text', 'original_prediction jsonb', 'metadata jsonb DEFAULT ''{}''::jsonb', 'summary text',
    'hashtags text[] DEFAULT ''{}''::text[]', 'content text', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('project_progress_sources', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'item_id uuid', 'source_table text', 'source_id text', 'source_item_key text',
    'source_date date', 'excerpt text', 'evidence_field text', 'source_url text', 'attachment_id text',
    'mail_id text', 'channel text', 'extraction_confidence numeric(4,3)',
    'lineage jsonb DEFAULT ''{}''::jsonb', 'run_id text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('contract_conflicts', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'workspace_id uuid', 'primary_decision_id uuid', 'title text', 'summary text',
    'statement text', 'scope text DEFAULT ''same_contract''::text',
    'conflict_kind text DEFAULT ''rule_conflict''::text', 'status text DEFAULT ''unresolved''::text',
    'fingerprint text', 'source text DEFAULT ''contracts_agent''::text',
    'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('gantt_files', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'file_id text', 'display_name text',
    'task_count integer', 'start_date date', 'end_date date', 'last_saved timestamptz',
    'uploaded_at timestamptz', 'relevancy_date date'
  ]);
  PERFORM pg_temp.lab_dataset_table('gantt_tasks', 'bigint', ARRAY[
    'project_id uuid', 'created_at timestamptz DEFAULT now()', 'file_id text', 'task_uid integer',
    'task_name text', 'start_date date', 'finish_date date', 'percent_complete integer', 'is_summary boolean',
    'is_milestone boolean', 'outline_level integer', 'item_status text DEFAULT ''בטיפול''::text',
    'hashtags text[]', 'summary text', 'content text', 'metadata jsonb', 'embedding vector(3072)'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_alerts', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'activity_key text', 'alert_type text', 'severity_level smallint', 'days_late integer',
    'days_remaining integer', 'working_days_late integer', 'working_days_remaining integer',
    'indicator_snapshot_id uuid', 'title text', 'description text', 'occurrence_group_id text',
    'lifecycle_status text DEFAULT ''open''::text', 'baselined boolean DEFAULT false',
    'materiality_bucket integer', 'first_detected_at date', 'last_evaluated_at date', 'resolved_at date',
    'resolution text', 'reviewed_by uuid', 'reviewed_at timestamptz', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_indicator_snapshots', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'activity_key text', 'milestone_key text', 'as_of date', 'status text',
    'days_late integer', 'days_remaining integer', 'working_days_late integer',
    'working_days_remaining integer', 'basis text', 'basis_date date', 'confidence numeric', 'payload jsonb',
    'engine_version text', 'contract_version text DEFAULT ''schedule-indicator.v1''::text',
    'data_version text', 'calculated_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_activity_alert_links', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'source_event_id text', 'source_table text DEFAULT ''alerts''::text', 'source_id text',
    'activity_key text', 'event_date date', 'linked_by uuid', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()', 'assignment_method text DEFAULT ''manual''::text',
    'assignment_run_id uuid', 'confidence numeric(5,2)', 'review_note text'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_calendars', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'name text DEFAULT ''default''::text',
    'working_weekdays integer[] DEFAULT ''{0,1,2,3,4}''::integer[]', 'holidays date[] DEFAULT ''{}''::date[]',
    'holidays_through date', 'is_default boolean DEFAULT true', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_observed_events', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'activity_key text', 'event_type text', 'event_date date', 'progress_percent numeric',
    'confidence numeric DEFAULT 0.5', 'source_table text', 'source_id text', 'source_page integer',
    'evidence_text text', 'human_status text DEFAULT ''auto''::text', 'created_at timestamptz DEFAULT now()'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_contract_milestones', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'milestone_key text', 'name text', 'contract_date date',
    'is_project_completion boolean DEFAULT false', 'activity_key text', 'status text DEFAULT ''active''::text',
    'source_document_id text', 'source_excerpt text', 'confidence numeric DEFAULT 1.0', 'written_by text',
    'extractor_version text', 'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()', 'source_contract_decision_id uuid'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_contract_extensions', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'milestone_key text', 'extension_days integer', 'approved_date date',
    'approved_by text', 'status text DEFAULT ''approved''::text', 'source_document_id text',
    'source_excerpt text', 'confidence numeric DEFAULT 1.0', 'written_by text',
    'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'source_contract_decision_id uuid'
  ]);
  PERFORM pg_temp.lab_dataset_table('schedule_contract_conditions', 'uuid DEFAULT gen_random_uuid()', ARRAY[
    'project_id uuid', 'condition_key text', 'name text', 'category text',
    'anchor_kind text DEFAULT ''event''::text', 'anchor_description text', 'offset_value numeric',
    'offset_unit text', 'recurring boolean DEFAULT false', 'status text DEFAULT ''pending''::text',
    'resolved_milestone_key text', 'trigger_source_table text', 'trigger_source_id text',
    'trigger_event_date date', 'is_project_completion boolean DEFAULT false', 'penalty_ils_per_day numeric',
    'source_page integer', 'source_excerpt text', 'confidence numeric DEFAULT 0.8', 'written_by text',
    'metadata jsonb DEFAULT ''{}''::jsonb', 'created_at timestamptz DEFAULT now()',
    'updated_at timestamptz DEFAULT now()', 'source_contract_decision_id uuid'
  ]);
END
$tables$;

-- ─── The load runs (progress of the Lab action) ───────────────
CREATE TABLE IF NOT EXISTS public.lab_dataset_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_id   uuid NOT NULL,
  source_project_name text,
  company_id          uuid,
  date_from           date,
  date_to             date,
  row_cap             integer NOT NULL,
  status              text NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'done', 'partial', 'failed', 'superseded')),
  progress            jsonb NOT NULL DEFAULT '{}'::jsonb,
  error               text,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz
);
CREATE INDEX IF NOT EXISTS lab_dataset_runs_created_idx ON public.lab_dataset_runs (created_at DESC);
ALTER TABLE public.lab_dataset_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_dataset_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_dataset_runs TO service_role;

-- ─── Search functions (Project filter required, service role only) ───
-- hybrid_match_data_index: the index search of Lab chat. Created only when MAIN has no function of
-- that name that already accepts project_id_filter.
DO $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'hybrid_match_data_index' AND p.proargnames @> ARRAY['project_id_filter']
  ) THEN
    CREATE FUNCTION public.hybrid_match_data_index(
      query_text        text        DEFAULT '',
      query_embedding   vector      DEFAULT NULL,
      match_count       integer     DEFAULT NULL,
      date_from         text        DEFAULT NULL,
      date_to           text        DEFAULT NULL,
      hashtags          text[]      DEFAULT '{}',
      vector_weight     float       DEFAULT 0.7,
      keyword_weight    float       DEFAULT 0.3,
      project_id_filter uuid        DEFAULT NULL
    )
    RETURNS TABLE(id bigint, content text, source_table text, source_id text, title text, summary text, metadata jsonb, similarity double precision)
    LANGUAGE plpgsql STABLE AS $body$
    #variable_conflict use_column
    BEGIN
      RETURN QUERY
      SELECT di.id, di.index_text AS content, di.source_table, di.source_id, di.title, di.summary, di.metadata,
             1 - (di.embedding <=> query_embedding) AS similarity
      FROM public.data_index di
      WHERE di.embedding IS NOT NULL
        AND (date_from IS NULL OR di.primary_date >= date_from::timestamptz)
        AND (date_to IS NULL OR di.primary_date <= date_to::timestamptz)
        AND (array_length(hashtags, 1) IS NULL OR di.hashtags && hashtags)
        AND (project_id_filter IS NULL OR di.project_id = project_id_filter)
      ORDER BY di.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $body$;
    REVOKE ALL ON FUNCTION public.hybrid_match_data_index(text, vector, integer, text, text, text[], float, float, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.hybrid_match_data_index(text, vector, integer, text, text, text[], float, float, uuid) TO service_role;
  END IF;
END
$fn$;

-- match_<table>: the vector leg of the content tools and of the alerts search. Same rule: created only
-- when MAIN has no function of that name that already accepts project_id_filter; no overload is dropped.
-- (The Lab slice copies embeddings only for data_index and alerts, so these return nothing for the
-- other tables and the tools use their text leg; the functions exist so a tool never fails on a
-- missing function.)
DO $match$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alerts', 'meetings', 'emails', 'whatsapp_analysis', 'financial_transactions', 'safety_reports', 'consultants_reports', 'exceptions_report', 'quality_control', 'daily_work_log', 'gantt_tasks'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'match_' || t AND p.proargnames @> ARRAY['project_id_filter']
    ) THEN
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
        BEGIN
          RETURN QUERY
          SELECT src.id, src.content, src.metadata, 1 - (src.embedding <=> query_embedding) AS similarity
          FROM public.%2$I src
          WHERE src.metadata @> filter
            %3$s
            AND src.embedding IS NOT NULL
            AND (project_id_filter IS NULL OR src.project_id = project_id_filter)
            AND 1 - (src.embedding <=> query_embedding) > match_threshold
          ORDER BY src.embedding <=> query_embedding
          LIMIT match_count;
        END;
        $body$
      $create$, 'match_' || t, t, CASE WHEN t = 'alerts' THEN 'AND src.is_relevant = true' ELSE '' END);
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I(vector, integer, jsonb, double precision, uuid) FROM PUBLIC, anon, authenticated', 'match_' || t);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(vector, integer, jsonb, double precision, uuid) TO service_role', 'match_' || t);
    END IF;
  END LOOP;
END
$match$;

-- graph_search: the Project graph of Lab chat and of the graph screen (both edge ends in the Project).
DO $graph$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'graph_search' AND p.proargnames @> ARRAY['filter_project_id']
  ) THEN
    CREATE FUNCTION public.graph_search(
      query_text        text    DEFAULT '',
      source_refs       jsonb   DEFAULT '[]'::jsonb,
      max_rows          integer DEFAULT 30,
      filter_project_id uuid    DEFAULT NULL
    )
    RETURNS TABLE (
      edge_id uuid, edge_type text, weight numeric, confidence numeric, evidence_text text, truth_tier text,
      source_node jsonb, target_node jsonb
    )
    LANGUAGE sql STABLE AS $body$
      WITH requested AS (
        SELECT DISTINCT coalesce(ref->>'node_id', n.id) AS node_id
        FROM jsonb_array_elements(coalesce(source_refs, '[]'::jsonb)) ref
        LEFT JOIN public.graph_nodes n
          ON n.source_table = ref->>'source_table'
         AND n.source_id = ref->>'source_id'
         AND (filter_project_id IS NULL OR n.project_id = filter_project_id)
        WHERE coalesce(ref->>'node_id', n.id) IS NOT NULL
      ),
      direct_edges AS (
        SELECT e.* FROM public.graph_edges e
        JOIN requested r ON r.node_id = e.from_node_id OR r.node_id = e.to_node_id
        WHERE filter_project_id IS NULL OR e.project_id = filter_project_id
      ),
      query_edges AS (
        SELECT e.* FROM public.graph_edges e
        JOIN public.graph_nodes a ON a.id = e.from_node_id
        JOIN public.graph_nodes b ON b.id = e.to_node_id
        WHERE length(trim(coalesce(query_text, ''))) > 0
          AND (filter_project_id IS NULL OR e.project_id = filter_project_id)
          AND (
            a.normalized_label ILIKE '%' || lower(query_text) || '%'
            OR b.normalized_label ILIKE '%' || lower(query_text) || '%'
            OR e.evidence_text ILIKE '%' || query_text || '%'
          )
      ),
      combined AS (
        SELECT * FROM direct_edges
        UNION
        SELECT * FROM query_edges
      )
      SELECT e.id AS edge_id, e.edge_type, e.weight, e.confidence, e.evidence_text, e.truth_tier,
             to_jsonb(from_node) - 'created_at' - 'updated_at' AS source_node,
             to_jsonb(to_node) - 'created_at' - 'updated_at' AS target_node
      FROM combined e
      JOIN public.graph_nodes from_node ON from_node.id = e.from_node_id
      JOIN public.graph_nodes to_node ON to_node.id = e.to_node_id
      WHERE filter_project_id IS NULL
         OR (from_node.project_id = filter_project_id AND to_node.project_id = filter_project_id)
      ORDER BY e.confidence DESC, e.weight DESC, e.created_at DESC
      LIMIT greatest(1, least(coalesce(max_rows, 30), 200));
    $body$;
    REVOKE ALL ON FUNCTION public.graph_search(text, jsonb, integer, uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.graph_search(text, jsonb, integer, uuid) TO service_role;
  END IF;
END
$graph$;

-- bidoc_indicator_schedule_project_context_v1: the schedule screens ask which Project holds a Project's
-- schedule. MAIN's Contracts lab usually has it already (it maps Projects through
-- private.schedule_contract_project_mappings) and then this is left alone. Without it, the Lab
-- Project is its own schedule Project.
DO $ctx$
BEGIN
  IF to_regprocedure('public.bidoc_indicator_schedule_project_context_v1(uuid)') IS NULL THEN
    CREATE FUNCTION public.bidoc_indicator_schedule_project_context_v1(p_project_id uuid)
    RETURNS jsonb LANGUAGE sql STABLE AS $body$
      SELECT jsonb_build_object('mappingFound', false, 'sourceProjectId', p_project_id, 'scheduleProjectId', p_project_id);
    $body$;
    REVOKE ALL ON FUNCTION public.bidoc_indicator_schedule_project_context_v1(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.bidoc_indicator_schedule_project_context_v1(uuid) TO service_role;
  END IF;
END
$ctx$;

COMMIT;

NOTIFY pgrst, 'reload schema';
