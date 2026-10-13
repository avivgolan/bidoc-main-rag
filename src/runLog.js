const runs = new Map();
const subscribers = new Map();
const runHistory = [];
// runId -> the Project the run was started for (null: an unscoped run, e.g.
// from the standalone UI).
const runProjects = new Map();

function cleanProjectId(value) {
  return String(value ?? "").trim().toLowerCase() || null;
}

export function createRun(runId, { projectId = null } = {}) {
  const project = cleanProjectId(projectId);
  // A runId re-used for another Project must not stream into the previous
  // Project's subscribers.
  if (runs.has(runId) && runProjects.get(runId) !== project) closeRunSubscribers(runId);
  runProjects.set(runId, project);
  runs.set(runId, []);
  emitRunEvent(runId, "created", "Run created", {});
}

export function getRunProjectId(runId) {
  return runProjects.get(runId) ?? null;
}

// The standalone UI (superadmin session) follows any run. A BiDoc-context
// caller follows only a known run of its own Project.
export function runVisibleToRequest(runId, { bidocContext = false, projectId = null } = {}) {
  if (!bidocContext) return true;
  const requested = cleanProjectId(projectId);
  const runProject = runProjects.get(runId) ?? null;
  return Boolean(requested && runProject && requested === runProject);
}

export function emitRunEvent(runId, step, message, data = {}) {
  if (!runId) return;
  const event = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    time: new Date().toISOString(),
    step,
    message,
    data
  };
  if (!runs.has(runId)) runs.set(runId, []);
  runs.get(runId).push(event);
  if (runs.get(runId).length > 200) runs.set(runId, runs.get(runId).slice(-200));
  for (const res of subscribers.get(runId) || []) {
    res.write(`event: log\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function completeRun(runId, data = {}) {
  emitRunEvent(runId, "complete", "Run completed", data);
  setTimeout(() => closeRunSubscribers(runId), 500);
}

export function failRun(runId, error) {
  emitRunEvent(runId, "error", "Run failed", { error: error?.message || String(error) });
  setTimeout(() => closeRunSubscribers(runId), 500);
}

export function subscribeRun(runId, res) {
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId).add(res);
  for (const event of runs.get(runId) || []) {
    res.write(`event: log\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  return () => {
    subscribers.get(runId)?.delete(res);
  };
}

export function getRunEvents(runId) {
  return [...(runs.get(runId) || [])];
}

export function recordRunHistory({ id, title, workflowLog = null, runEvents = null, createdAt = new Date().toISOString(), kind = "run" }) {
  if (!id) return;
  const item = {
    id,
    created_at: createdAt,
    user_message: title || id,
    workflow_log: workflowLog,
    run_events: runEvents || getRunEvents(id),
    kind,
    project_id: runProjects.get(id) ?? null
  };
  const existingIndex = runHistory.findIndex((run) => run.id === id);
  if (existingIndex >= 0) runHistory.splice(existingIndex, 1);
  runHistory.unshift(item);
  if (runHistory.length > 50) runHistory.splice(50);
}

// projectId given (a BiDoc-context caller): only that Project's runs.
export function listLocalRunHistory({ limit = 30, projectId = undefined } = {}) {
  if (projectId === undefined) return runHistory.slice(0, limit);
  const project = cleanProjectId(projectId);
  if (!project) return [];
  return runHistory.filter((run) => run.project_id === project).slice(0, limit);
}

function closeRunSubscribers(runId) {
  for (const res of subscribers.get(runId) || []) {
    res.end();
  }
  subscribers.delete(runId);
}
