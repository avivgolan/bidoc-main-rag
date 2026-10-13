// Project scoping for chat reads. One Company DB can hold several Projects, so
// a chat request carrying x-project-id (config.projectId) must only read that
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

// Vector RPCs without a project parameter rank across the whole Company DB;
// the project filter is applied on the follow-up row select, so scoped calls
// ask the RPC for more candidates to keep recall.
export const PROJECT_SCOPED_OVERFETCH = 3;
