// The Lab's test dataset (ADR 0012). A Lab request works only on MAIN, and the
// screens that read a Project's content (chat, insights, dashboard, timeline,
// graph, schedule, indexing, QA runs) read it from the Lab tables in MAIN: the
// same table and RPC names as a Company DB (the Company DB template), in MAIN.
// Ticket 06 seeds them from a chosen Project's slice; until then those tables
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

// The request config's content source for a Lab request: MAIN itself, with the
// table and RPC names from the settings. Never a Company DB.
export function labDatasetSource(base) {
  return {
    ...base.contentSource,
    supabaseUrl: base.supabaseUrl,
    supabaseServiceRoleKey: base.supabaseServiceRoleKey,
    labDataset: true,
    useAppSupabase: false,
    usesAppSupabase: false
  };
}
