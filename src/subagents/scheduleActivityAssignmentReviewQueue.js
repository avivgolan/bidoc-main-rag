import { supabaseHeaders } from "../config.js";
import {
  normalizeScheduleAssignmentReviewLabel,
  scheduleAssignmentReviewRowToEvaluationCase,
  summarizeScheduleAssignmentLabelCoverage
} from "../scheduleActivityAssignmentLabels.js";

export const SCHEDULE_ASSIGNMENT_REVIEWS_TABLE = "schedule_activity_assignment_reviews";
const UPSERT_REVIEW_RPC = "bidoc_upsert_schedule_assignment_review_v1";
const RESOLVE_REVIEWS_RPC = "bidoc_resolve_schedule_assignment_reviews_v1";
const RESOLVE_REVIEW_LABEL_RPC = "bidoc_resolve_schedule_assignment_review_label_v1";

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
      description: safeText(result.event?.description, 3000),
      question: safeText(result.event?.question, 1500),
      answer: safeText(result.event?.answer, 1500),
      hashtags: Array.isArray(result.event?.hashtags)
        ? result.event.hashtags.map((item) => safeText(item, 160)).filter(Boolean).slice(0, 20)
        : [],
      alertType: safeText(result.event?.alertType, 300),
      date: safeText(result.event?.date, 20) || null,
      severity: result.event?.severity == null ? null : Number(result.event.severity),
      status: safeText(result.event?.status, 160) || null,
      recordOrigin: safeText(result.event?.metadata?.evaluation_record_origin || result.event?.recordOrigin, 160) || null
    },
    decision: {
      type: safeText(result.decision?.type, 80) || "ambiguous",
      selectedActivityKey: safeText(result.decision?.selectedActivityKey, 500) || null,
      selectedActivityName: safeText(result.decision?.selectedActivityName, 500) || null,
      rankingScore: Math.max(0, Math.min(100, Number(result.decision?.rankingScore ?? result.decision?.confidence) || 0)),
      runnerUpRankingScore: Math.max(0, Math.min(100, Number(result.decision?.runnerUpRankingScore ?? result.decision?.runnerUpConfidence) || 0)),
      rankingGap: Math.max(0, Math.min(100, Number(result.decision?.rankingGap ?? result.decision?.margin) || 0)),
      calibratedProbability: Number.isFinite(result.decision?.calibratedProbability)
        ? Math.max(0, Math.min(1, Number(result.decision.calibratedProbability)))
        : null,
      calibration: result.decision?.calibration && typeof result.decision.calibration === "object"
        ? {
            status: safeText(result.decision.calibration.status, 80) || "unavailable",
            artifactId: safeText(result.decision.calibration.artifactId, 300) || null,
            reason: safeText(result.decision.calibration.reason, 300) || null
          }
        : { status: "unavailable", artifactId: null, reason: "calibrator_unavailable" },
      confidence: Math.max(0, Math.min(100, Number(result.decision?.confidence) || 0)),
      runnerUpConfidence: Math.max(0, Math.min(100, Number(result.decision?.runnerUpConfidence) || 0)),
      margin: Math.max(0, Math.min(100, Number(result.decision?.margin) || 0)),
      reason: safeText(result.decision?.reason, 3000),
      autoAssigned: false,
      gates: result.decision?.gates && typeof result.decision.gates === "object" ? result.decision.gates : {},
      engineVersion: safeText(result.engineVersion, 160) || null,
      scheduleVersionId: safeText(result.scheduleVersionId, 500) || null,
      settingsVersion: safeText(result.settingsVersion, 160) || null,
      configurationSnapshotId: safeText(result.configurationSnapshotId, 300) || null,
      retrieval: result.retrieval && typeof result.retrieval === "object"
        ? {
            strategy: safeText(result.retrieval.strategy, 80) || null,
            semanticPoolLimit: Number(result.retrieval.semanticPoolLimit) || null,
            modelCandidateLimit: Number(result.retrieval.modelCandidateLimit) || null
          }
        : null
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

export async function listSharedScheduleAssignmentEvaluationLabels({ projectId, limit = 5000, config, fetchImpl = fetch } = {}) {
  if (!projectId) throw new Error("projectId is required");
  const safeLimit = Math.max(1, Math.min(5000, Number(limit) || 5000));
  const rows = await mainDataRequest({
    config,
    fetchImpl,
    path: `/rest/v1/${SCHEDULE_ASSIGNMENT_REVIEWS_TABLE}?select=*&source_project_id=eq.${encodeURIComponent(projectId)}&status=in.(selected,rejected)&order=resolved_at.desc&limit=${safeLimit}`
  });
  const labelledRows = (Array.isArray(rows) ? rows : []).filter((row) => row?.evaluation_label_type);
  const cases = labelledRows.map(scheduleAssignmentReviewRowToEvaluationCase).filter(Boolean);
  return {
    count: cases.length,
    cases,
    coverage: summarizeScheduleAssignmentLabelCoverage(cases)
  };
}

export async function getPendingSharedScheduleAssignmentReview({ projectId, sourceId, config, fetchImpl = fetch } = {}) {
  if (!projectId || !sourceId) throw new Error("projectId and sourceId are required");
  const rows = await mainDataRequest({
    config,
    fetchImpl,
    path: `/rest/v1/${SCHEDULE_ASSIGNMENT_REVIEWS_TABLE}?select=*&source_project_id=eq.${encodeURIComponent(projectId)}&source_id=eq.${encodeURIComponent(String(sourceId))}&status=eq.pending&order=created_at.desc&limit=1`
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error("pending shared Schedule assignment review not found");
  return row;
}

export async function resolveSharedScheduleAssignmentReviews({
  projectId,
  sourceId,
  status,
  activityKey = null,
  resolvedBy = null,
  note = null,
  labelType = null,
  forbiddenActivityKeys = [],
  config,
  fetchImpl = fetch
} = {}) {
  if (!projectId || !sourceId) throw new Error("projectId and sourceId are required");
  if (labelType) {
    const label = normalizeScheduleAssignmentReviewLabel({
      labelType,
      expectedActivityKey: activityKey,
      forbiddenActivityKeys,
      reason: note
    });
    const resolvedCount = await mainDataRequest({
      config,
      fetchImpl,
      path: `/rest/v1/rpc/${RESOLVE_REVIEW_LABEL_RPC}`,
      options: {
        method: "POST",
        body: {
          p_source_project_id: projectId,
          p_source_id: String(sourceId),
          p_label_type: label.type,
          p_expected_activity_key: label.expectedActivityKey,
          p_forbidden_activity_keys: label.forbiddenActivityKeys,
          p_resolved_by: resolvedBy ? String(resolvedBy) : null,
          p_reason: label.reason
        }
      }
    });
    return { resolved: Number(resolvedCount) || 0, label };
  }
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
