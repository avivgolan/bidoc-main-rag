const runs = new Map();
const subscribers = new Map();

export function createRun(runId) {
  runs.set(runId, []);
  emitRunEvent(runId, "created", "Run created", {});
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

function closeRunSubscribers(runId) {
  for (const res of subscribers.get(runId) || []) {
    res.end();
  }
  subscribers.delete(runId);
}
