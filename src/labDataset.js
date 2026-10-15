// The Lab's test dataset (ADR 0012). A Lab request works only on MAIN, and the
// screens that read a Project's content (chat, insights, dashboard, timeline,
// graph, schedule, indexing, QA runs) read it from the Lab tables in MAIN: the
// same table and RPC names as a Company DB (the Company DB template), in MAIN.
// Ticket 06 seeds them from a chosen Project's slice (labDatasetCopy.js); until then those tables
// are missing or empty and every such screen shows the empty state below.
//
// The Lab dataset is one synthetic Project: its rows (and its projects row) carry
// the Lab Project id, a fixed UUID so it fits the Company DB template's uuid
// project_id columns. Ticket 06's copy stamps the copied slice with it. A Lab
// request that names a Project of its own (x-project-id / ?project_id) uses that
// id instead.

export const LAB_PROJECT_ID = "00000000-0000-4000-8000-0000000001ab";
export const LAB_EMPTY_MESSAGE = "אין נתוני Lab — טען מערך בדיקה";
export const LAB_EMPTY_CODE = "lab_dataset_empty";

export function labDatasetEmptyError(cause = null) {
  const error = new Error(LAB_EMPTY_MESSAGE);
  error.code = LAB_EMPTY_CODE;
  error.status = 409;
  if (cause) error.cause = cause;
  return error;
}

export function isLabDatasetEmptyError(error) {
  return error?.code === LAB_EMPTY_CODE;
}

// PostgREST answers a read of a table or function it does not know with 404
// (PGRST205 / PGRST202); Postgres itself with 42P01 (relation) or 42883 (function).
export function isMissingRelationFailure(status, data) {
  const code = String(data?.code || "");
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(code)) return true;
  return Number(status) === 404;
}

// The names the Lab dataset has in MAIN: the Company DB template's, the same ones BiDoc sends for a
// real Project (x-index-table / x-hybrid-rpc-name / x-alerts-table). They are fixed here, not read from
// the settings: the settings' contentSource still names the legacy JFrog tables of MAIN
// (data_index_embeddings_gf_dor_agent, alerts_embeddings_gf), which the Lab dataset must never read or
// fill (supabase/migrations/20261016100000_lab_dataset_tables.sql).
export const LAB_DATASET_NAMES = Object.freeze({
  indexTable: "data_index",
  hybridRpcName: "hybrid_match_data_index",
  alertsTable: "alerts",
  alertsRpcName: "match_alerts"
});

// The request config's content source for a Lab request: MAIN itself, with the Lab dataset's table
// and RPC names. Never a Company DB.
export function labDatasetSource(base) {
  return {
    ...base.contentSource,
    ...LAB_DATASET_NAMES,
    supabaseUrl: base.supabaseUrl,
    supabaseServiceRoleKey: base.supabaseServiceRoleKey,
    labDataset: true,
    useAppSupabase: false,
    usesAppSupabase: false
  };
}
