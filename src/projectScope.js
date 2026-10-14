// Project scoping for chat and insights. One Company DB can hold several Projects, so
// a request carrying x-project-id (config.projectId) must only read that
// Project's rows. Company DB reads without a projectId are refused (see
// companyDb.js and the Project gate in server.js).

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

// match_<table> / hybrid / graph_search RPCs take a Project filter (migration
// 20261013120000_match_rpc_project_filter). An older Company DB whose RPC
// lacks it is refused (search_function_outdated in companyDb.js), never
// called unfiltered.

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

// A request Project (x-project-id / ?project_id) and a Project named by the
// route or body must agree; either one alone is the Project.
export function resolveScopedProjectId(requestProjectIdValue, candidate) {
  const fromRequest = String(requestProjectIdValue ?? "").trim() || null;
  const fromCandidate = String((Array.isArray(candidate) ? candidate[0] : candidate) ?? "").trim() || null;
  if (fromRequest && fromCandidate && !sameProjectId(fromRequest, fromCandidate)) {
    throw projectMismatchError("The request names two different Projects");
  }
  return fromRequest || fromCandidate;
}

// BiDoc tags the chat session ids it sends main-agent as
// bidoc:<projectId>:<sessionId>; App DB chat rows carry no other Project link.
const BIDOC_SESSION_PATTERN = /^bidoc:([^:]+):/u;

export function chatSessionProjectId(sessionId) {
  const match = String(sessionId ?? "").match(BIDOC_SESSION_PATTERN);
  return match ? match[1] : null;
}

export function chatSessionInProject(sessionId, projectId) {
  return Boolean(projectId) && sameProjectId(chatSessionProjectId(sessionId), projectId);
}

export function bidocChatSessionPrefix(projectId) {
  return `bidoc:${projectId}:`;
}
