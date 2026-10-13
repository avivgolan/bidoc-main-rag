// Project scoping for chat and insights. One Company DB can hold several Projects, so
// a request carrying x-project-id (config.projectId) must only read that
// Project's rows. Callers without a projectId keep their existing behaviour.

export function requestProjectId(config) {
  const value = String(config?.projectId ?? "").trim();
  return value || null;
}

// PostgREST query fragment for tables that carry a project_id column.
export function projectIdFilterParam(projectId) {
  return projectId ? `project_id=eq.${encodeURIComponent(projectId)}` : null;
}

export function sameProjectId(left, right) {
  const a = String(left ?? "").trim().toLowerCase();
  return Boolean(a) && a === String(right ?? "").trim().toLowerCase();
}

// match_<table> RPCs take an optional project_id_filter (migration
// 20261013120000_match_rpc_project_filter). Older Company DBs lack it: the
// project filter is then applied on the follow-up row select, so the fallback
// call asks the RPC for more candidates to keep recall.
export const PROJECT_SCOPED_OVERFETCH = 3;

// PostgREST signature errors: the function or one of its named params is
// unknown to the DB (PGRST202 / schema cache), i.e. an older schema.
export function looksLikeRpcSignatureError(message) {
  return /function|parameter|argument|schema cache|could not find|PGRST202/i.test(String(message || ""));
}

// A request that names its Project twice (x-project-id header and a
// project_id query param) must name the same one.
export function projectMismatchError(message = "The request names two different Projects") {
  const error = new Error(message);
  error.code = "project_mismatch";
  error.status = 400;
  return error;
}

// Resolves the requesting Project: the x-project-id header wins, the
// project_id query param is the fallback, then the body. Header and query
// that disagree are rejected rather than silently picking one.
export function resolveRequestProjectId({ header = null, query = null, body = null } = {}) {
  const clean = (value) => {
    const text = String((Array.isArray(value) ? value[0] : value) ?? "").trim();
    return text || null;
  };
  const fromHeader = clean(header);
  const fromQuery = clean(query);
  if (fromHeader && fromQuery && !sameProjectId(fromHeader, fromQuery)) {
    throw projectMismatchError("x-project-id header and project_id query parameter name different Projects");
  }
  return fromHeader || fromQuery || clean(body) || null;
}
