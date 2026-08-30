import { supabaseHeaders } from "../config.js";

export const SCHEDULE_ASSIGNMENT_REVIEWS_TABLE = "schedule_activity_assignment_reviews";
const UPSERT_REVIEW_RPC = "bidoc_upsert_schedule_assignment_review_v1";
const RESOLVE_REVIEWS_RPC = "bidoc_resolve_schedule_assignment_reviews_v1";

function safeText(value, max = 1000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, "").slice(0, max);
}

function mainConnection(config = {}) {
  const supabaseUrl = String(config?.supabaseUrl || "").replace(/\/$/u, "");
  const supabaseServiceRoleKey = String(config?.supabaseServiceRoleKey || "");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("MAIN Supabase is not configured for the Schedule review queue");
  }
  return { supabaseUrl, supabaseServiceRoleKey };
}

async function mainDataRequest({ config, path, options = {}, fetchImpl = fetch }) {
  const connection = mainConnection(config);
  const response = await fetchImpl(`${connection.supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(connection.supabaseServiceRoleKey),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = raw; }
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload
      ? payload.message || payload.error || payload.details || response.statusText
      : payload || response.statusText;
    throw new Error(`MAIN Schedule review queue: ${safeText(message, 700)}`);
  }
  return payload;
}

function compactCandidate(candidate = {}) {
  return {
    activityKey: safeText(candidate.activityKey, 500),
    name: safeText(candidate.name, 500),
    finalScore: Math.max(0, Math.min(100, Number(candidate.finalScore) || 0)),
    plannedStart: safeText(candidate.plannedStart, 20) || null,
    plannedFinish: safeText(candidate.plannedFinish, 20) || null
  };
}

export function scheduleAssignmentNeedsSharedReview(result = {}) {
  if (!result?.runId || result.assignment || result.status === "filtered_out" || result.decision?.autoAssigned) return false;
  if (!["review_required", "no_match"].includes(result.status)) return false;
  return (Array.isArray(result.candidates) ? result.candidates : [])
    .some((candidate) => candidate?.activityKey && candidate?.name);
}

export function scheduleAssignmentReviewSnapshot(result = {}) {
  const candidates = (Array.isArray(result.candidates) ? result.candidates : [])
    .filter((candidate) => candidate?.activityKey && candidate?.name)
    .slice(0, 2)
    .map(compactCandidate);
  return {
    event: {
      id: safeText(result.event?.id || result.sourceId, 160),
      title: safeText(result.event?.title, 3000),
      alertType: safeText(result.event?.alertType, 300),
      date: safeText(result.event?.date, 20) || null,
      severity: result.event?.severity == null ? null : Number(result.event.severity),
      status: safeText(result.event?.status, 160) || null
    },
    decision: {
      type: safeText(result.decision?.type, 80) || "ambiguous",
      selectedActivityKey: safeText(result.decision?.selectedActivityKey, 500) || null,
      selectedActivityName: safeText(result.decision?.selectedActivityName, 500) || null,
      confidence: Math.max(0, Math.min(100, Number(result.decision?.confidence) || 0)),
      runnerUpConfidence: Math.max(0, Math.min(100, Number(result.decision?.runnerUpConfidence) || 0)),
      margin: Math.max(0, Math.min(100, Number(result.decision?.margin) || 0)),
      reason: safeText(result.decision?.reason, 3000),
      autoAssigned: false,
      gates: result.decision?.gates && typeof result.decision.gates === "object" ? result.decision.gates : {}
    },
    candidates
  };
}

export function sharedReviewRowToAgentResult(row = {}) {
  const event = row.event_snapshot && typeof row.event_snapshot === "object" ? row.event_snapshot : {};
  const decision = row.decision_snapshot && typeof row.decision_snapshot === "object" ? row.decision_snapshot : {};
  const candidates = Array.isArray(row.candidates_snapshot) ? row.candidates_snapshot.map(compactCandidate) : [];
  return {
    ok: true,
    runId: row.run_id,
    workflowRunId: row.run_id,
    projectId: row.source_project_id,
    scheduleProjectId: row.schedule_project_id,
    sourceId: String(row.source_id || ""),
    status: "review_required",
    auditPersisted: row.audit_persisted === true,
    persistedReview: true,
    reviewId: row.id,
    reviewCreatedAt: row.created_at || null,
    event,
    decision: { ...decision, autoAssigned: false },
    candidates,
    assignment: null,
    warnings: ["החלטה זו נשמרה ב־MAIN וזמינה לכל חברי הצוות המורשים."]
  };
}

export async function persistSharedScheduleAssignmentReview({ result, projectId = null, requestedBy = null, config, fetchImpl = fetch } = {}) {
  if (!scheduleAssignmentNeedsSharedReview(result)) return { persisted: false, reason: "review_not_required" };
  const snapshot = scheduleAssignmentReviewSnapshot(result);
  const reviewId = await mainDataRequest({
    config,
    fetchImpl,
    path: `/rest/v1/rpc/${UPSERT_REVIEW_RPC}`,
    options: {
      method: "POST",
      body: {
        p_run_id: result.runId,
        p_source_project_id: projectId || result.projectId,
        p_schedule_project_id: result.scheduleProjectId,
        p_source_id: String(result.sourceId),
        p_source_event_date: snapshot.event.date,
        p_event_snapshot: snapshot.event,
        p_decision_snapshot: snapshot.decision,
        p_candidates_snapshot: snapshot.candidates,
        p_audit_persisted: result.auditPersisted === true,
        p_created_by: requestedBy ? String(requestedBy) : null
      }
    }
  });
  return { persisted: true, reviewId };
}

export async function listSharedScheduleAssignmentReviews({ projectId, status = "pending", limit = 2000, config, fetchImpl = fetch } = {}) {
  if (!projectId) throw new Error("projectId is required");
  const safeStatus = ["pending", "selected", "rejected", "superseded"].includes(status) ? status : "pending";
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 2000));
  const rows = await mainDataRequest({
    config,
    fetchImpl,
    path: `/rest/v1/${SCHEDULE_ASSIGNMENT_REVIEWS_TABLE}?select=*&source_project_id=eq.${encodeURIComponent(projectId)}&status=eq.${safeStatus}&order=created_at.desc&limit=${safeLimit}`
  });
  const reviews = (Array.isArray(rows) ? rows : []).map(sharedReviewRowToAgentResult);
  return { count: reviews.length, reviews };
}

export async function resolveSharedScheduleAssignmentReviews({ projectId, sourceId, status, activityKey = null, resolvedBy = null, note = null, config, fetchImpl = fetch } = {}) {
  if (!projectId || !sourceId) throw new Error("projectId and sourceId are required");
  if (!["selected", "rejected"].includes(status)) throw new Error("unsupported review resolution");
  const resolvedCount = await mainDataRequest({
    config,
    fetchImpl,
    path: `/rest/v1/rpc/${RESOLVE_REVIEWS_RPC}`,
    options: {
      method: "POST",
      body: {
        p_source_project_id: projectId,
        p_source_id: String(sourceId),
        p_status: status,
        p_activity_key: status === "selected" ? activityKey : null,
        p_resolved_by: resolvedBy ? String(resolvedBy) : null,
        p_note: note ? String(note) : null
      }
    }
  });
  return { resolved: Number(resolvedCount) || 0 };
}
