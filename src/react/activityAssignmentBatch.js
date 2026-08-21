export const ACTIVITY_ASSIGNMENT_BATCH_STATUSES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  STOPPING: "stopping",
  PAUSED: "paused",
  COMPLETED: "completed"
});

export function createActivityAssignmentBatch(overrides = {}) {
  return {
    status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.IDLE,
    queue: [],
    nextIndex: 0,
    processed: 0,
    total: 0,
    assigned: 0,
    review: 0,
    skipped: 0,
    failed: 0,
    currentId: null,
    timeFilter: false,
    ...overrides
  };
}

export function buildActivityAssignmentBatchQueue(items = []) {
  const seen = new Set();
  const queue = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || "").trim();
    if (!id || !item?.date || item?.activityKey || seen.has(id)) continue;
    seen.add(id);
    queue.push(item);
  }
  return queue;
}

export function activityAssignmentReviewCandidates(result, limit = 2) {
  if (!result || result.status === "filtered_out" || result.decision?.autoAssigned) return [];
  const safeLimit = Math.max(0, Math.min(2, Number(limit) || 0));
  return (Array.isArray(result.candidates) ? result.candidates : [])
    .filter((candidate) => candidate?.activityKey && candidate?.name)
    .slice(0, safeLimit);
}

export function applyActivityAssignmentBatchOutcome(stats, outcome) {
  const next = {
    processed: Number(stats?.processed) || 0,
    assigned: Number(stats?.assigned) || 0,
    review: Number(stats?.review) || 0,
    skipped: Number(stats?.skipped) || 0,
    failed: Number(stats?.failed) || 0
  };
  next.processed += 1;
  if (!outcome?.ok) next.failed += 1;
  else if (outcome.result?.status === "filtered_out" || outcome.result?.timeFilter?.skipped === true) next.skipped += 1;
  else if (outcome.result?.assignment) next.assigned += 1;
  else next.review += 1;
  return next;
}

export function activityAssignmentBatchStatusText(batch) {
  const processed = Number(batch?.processed) || 0;
  const total = Number(batch?.total) || 0;
  switch (batch?.status) {
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING:
      return `${batch?.timeFilter ? "מסנן ומאתר" : "מאתר"} שורה ${Math.min(processed + 1, total)} מתוך ${total}`;
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING:
      return "בקשת העצירה נקלטה — מסיים את השורה הפעילה";
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED:
      return `הריצה נעצרה אחרי ${processed} מתוך ${total}`;
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED:
      return `הריצה הסתיימה: ${processed} עובדו · ${batch.assigned || 0} שויכו · ${batch.review || 0} לבדיקה · ${batch.skipped || 0} דולגו · ${batch.failed || 0} נכשלו`;
    default:
      return "";
  }
}
