import { createEmbedding } from "./openrouter.js";
import { supabaseHeaders } from "./config.js";
import { addDurationToLink, TIMELINE_RELATION_TYPES } from "./timelineLinks.js";
import { CACHE_TTL, cachedOperation } from "./cache.js";

const MESSAGES_TABLE = "chat_messages_gf";
const SESSION_MEMORY_TABLE = "chat_session_memory";
const MEMORY_ITEMS_TABLE = "chat_memory_items";
const TIMELINE_LINKS_TABLE = "timeline_event_links";
const TIMELINE_ENTITIES_TABLE = "timeline_entities";
const TIMELINE_EVENT_ENTITIES_TABLE = "timeline_event_entities";
const TIMELINE_GRAPH_EDGES_TABLE = "timeline_graph_edges";
const GRAPH_NODES_TABLE = "graph_nodes";
const GRAPH_EDGES_TABLE = "graph_edges";
const DELAY_CLAIM_CASES_TABLE = "delay_claim_cases";
const DELAY_EVENTS_TABLE = "delay_events";
const DELAY_EVENT_EVIDENCE_TABLE = "delay_event_evidence";
const DELAY_EVENT_GAPS_TABLE = "delay_event_gaps";
const DELAY_EVENT_FINDINGS_TABLE = "delay_event_findings";
const DELAY_EVENT_CHANGE_LOG_TABLE = "delay_event_change_log";
const DELAY_SCHEDULE_VERSIONS_TABLE = "delay_schedule_versions";
const DELAY_SCHEDULE_ACTIVITIES_TABLE = "delay_schedule_activities";
const DELAY_EVENT_SCHEDULE_LINKS_TABLE = "delay_event_schedule_links";
const DELAY_COST_ITEMS_TABLE = "delay_cost_items";
const DELAY_CLAIM_EXPORTS_TABLE = "delay_claim_exports";
const PROJECT_INSIGHT_RUNS_TABLE = "project_insight_runs";
const GRAPH_UPSERT_BATCH_SIZE = 300;
export const DELAY_HUMAN_STATUSES = ["candidate", "approved", "rejected", "needs_review"];
const DELAY_EVIDENCE_DIRECTIONS = ["supports", "weakens", "neutral"];
const DELAY_GAP_URGENCIES = ["low", "medium", "high"];
const DELAY_SCHEDULE_LINK_TYPES = ["possibly_related", "claimed_impact", "weakening_context", "review_required"];
const DELAY_COST_TYPES = ["direct", "indirect", "estimate", "review_required"];
const DELAY_EXPORT_TYPES = ["markdown", "json"];
const GRAPH_NODE_TYPES = new Set(["event", "alert", "supplier", "person", "company", "document", "topic", "risk", "invoice", "quote", "source"]);
const GRAPH_EDGE_TYPES = new Set(["mentions", "caused_by", "blocks", "approved_by", "related_to", "same_topic", "from_document", "has_status", "has_risk"]);
const TIMELINE_PAGE_DEFAULT_LIMIT = 200;
const TIMELINE_PAGE_MAX_LIMIT = 2000;
const TIMELINE_CURSOR_VERSION = 2;
const TIMELINE_ORIGINS = ["drive", "email", "whatsapp"];
const TIMELINE_PAGE_FIELDS = {
  index: [
    "id", "created_at", "primary_date", "hashtags", "title", "summary", "index_text",
    "source_table", "source_id", "project_id", "item_status", "severity_or_risk",
    "mail_id", "attachment_id", "source_url", "mentioned_dates"
  ],
  alerts: [
    "id", "created_at", "data_date", "hashtags", "summary", "content", "answer",
    "question", "alert_description", "alert_type", "severity_level", "input_data_type",
    "input_data_id", "data_link", "status", "item_status", "is_relevant"
  ]
};
const TIMELINE_METADATA_FIELDS = {
  index: [
    "title", "summary", "source_table", "source_id", "project_id", "item_status",
    "severity_or_risk", "mail_id", "attachment_id", "source_url", "mentioned_dates"
  ],
  alerts: [
    "question", "alert_description", "alert_type", "severity_level", "input_data_type",
    "input_data_id", "data_link", "status", "item_status", "is_relevant"
  ]
};

export class TimelineRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "TimelineRequestError";
    this.statusCode = 400;
  }
}

export async function saveMessage({ config, userMessage, sanitizedMessage, sessionId }) {
  if (!isConfigured(config)) return localMessage({ userMessage, sanitizedMessage, sessionId });
  const response = await supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_message: userMessage,
      session_id: sessionId,
      sanitzed_user_message: sanitizedMessage,
      status: "processing"
    })
  });
  return response?.[0] || localMessage({ userMessage, sanitizedMessage, sessionId });
}

export async function updateMessage({ config, messageId, aiResponse, status = "done", workflowLog = null, runEvents = null }) {
  if (!isConfigured(config) || String(messageId).startsWith("local_")) return null;
  const patch = { ai_response: aiResponse, status };
  if (workflowLog !== null) patch.workflow_log = workflowLog;
  if (runEvents !== null) patch.run_events = runEvents;
  return supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
}

export async function getMessage({ config, messageId }) {
  if (!isConfigured(config)) return null;
  const rows = await supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}&select=*&limit=1`
  );
  return rows?.[0] || null;
}

export async function listDislikedMessages({ config, limit = 50 }) {
  if (!isConfigured(config)) return [];
  return supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?select=id,user_message,ai_response,created_at,session_id,annotation,workflow_log&annotation=eq.X&status=eq.done&order=created_at.desc&limit=${limit}`
  );
}

export async function listQaMessages({ config, limit = 50, dislikedOnly = false }) {
  if (!isConfigured(config)) return [];
  const annotationFilter = dislikedOnly ? "&annotation=eq.X" : "";
  return supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?select=id,user_message,ai_response,created_at,session_id,annotation&status=eq.done&workflow_log=not.is.null${annotationFilter}&order=created_at.desc&limit=${limit}`
  );
}

const QA_TABLE = "qa_reports";

export async function saveQaReport({ config, messageId, status, report = null, error = null }) {
  if (!isConfigured(config)) return null;
  return supabaseFetch(config, `/rest/v1/${QA_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ message_id: messageId, status, report, error })
  });
}

export async function getLatestQaReport({ config, messageId }) {
  if (!isConfigured(config)) return null;
  const rows = await supabaseFetch(config,
    `/rest/v1/${QA_TABLE}?message_id=eq.${encodeURIComponent(messageId)}&order=created_at.desc&limit=1`
  );
  return rows?.[0] || null;
}

export function sanitizeDelayClaimCasePayload(input = {}) {
  const title = requiredString(input.title, "title");
  return {
    case_key: nullableString(input.case_key) || stableKey("delay_case", title),
    title,
    project_id: nullableString(input.project_id),
    description: nullableString(input.description),
    human_status: normalizeDelayStatus(input.human_status),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayEventPayload(input = {}, defaults = {}) {
  const title = requiredString(input.title, "title");
  const caseId = requiredString(input.case_id || defaults.case_id, "case_id");
  const startDate = nullableDate(input.start_date, "start_date");
  const endDate = nullableDate(input.end_date, "end_date");
  if (startDate && endDate && Date.parse(startDate) > Date.parse(endDate)) {
    throw new Error("start_date must not be later than end_date");
  }
  return {
    event_key: nullableString(input.event_key) || stableKey("delay_event", `${caseId}:${title}:${startDate || ""}`),
    case_id: caseId,
    title,
    short_description: nullableString(input.short_description),
    contractor_claim: nullableString(input.contractor_claim),
    event_type: nullableString(input.event_type),
    start_date: startDate,
    end_date: endDate,
    alleged_responsible_party: nullableString(input.alleged_responsible_party),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    readiness_score: input.readiness_score == null || input.readiness_score === "" ? null : boundedNumber(input.readiness_score, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayEventUpdatePayload(input = {}) {
  const payload = {};
  for (const field of ["title", "short_description", "contractor_claim", "event_type", "alleged_responsible_party"]) {
    if (Object.hasOwn(input, field)) payload[field] = field === "title" ? requiredString(input[field], field) : nullableString(input[field]);
  }
  if (Object.hasOwn(input, "start_date")) payload.start_date = nullableDate(input.start_date, "start_date");
  if (Object.hasOwn(input, "end_date")) payload.end_date = nullableDate(input.end_date, "end_date");
  if (payload.start_date && payload.end_date && Date.parse(payload.start_date) > Date.parse(payload.end_date)) {
    throw new Error("start_date must not be later than end_date");
  }
  if (Object.hasOwn(input, "confidence")) payload.confidence = boundedNumber(input.confidence, 0, 0, 1);
  if (Object.hasOwn(input, "readiness_score")) payload.readiness_score = input.readiness_score == null || input.readiness_score === "" ? null : boundedNumber(input.readiness_score, 0, 0, 1);
  if (Object.hasOwn(input, "human_status")) payload.human_status = normalizeDelayStatus(input.human_status);
  if (Object.hasOwn(input, "metadata")) payload.metadata = plainObject(input.metadata);
  return payload;
}

export function sanitizeDelayEvidencePayload(input = {}, defaults = {}) {
  return {
    event_id: requiredString(input.event_id || defaults.event_id, "event_id"),
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    source_id: nullableString(input.source_id),
    source_type: nullableString(input.source_type),
    external_source_id: nullableString(input.external_source_id || input.source_ref_id),
    source_url: nullableString(input.source_url),
    quote: nullableString(input.quote),
    excerpt: nullableString(input.excerpt),
    what_it_supports: nullableString(input.what_it_supports),
    supports_or_weakens: enumValue(input.supports_or_weakens, DELAY_EVIDENCE_DIRECTIONS, "supports_or_weakens", "supports"),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayGapPayload(input = {}, defaults = {}) {
  return {
    event_id: requiredString(input.event_id || defaults.event_id, "event_id"),
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    missing_item: requiredString(input.missing_item, "missing_item"),
    why_it_matters: nullableString(input.why_it_matters),
    urgency: enumValue(input.urgency, DELAY_GAP_URGENCIES, "urgency", "medium"),
    human_status: normalizeDelayStatus(input.human_status),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayChangeLogPayload(input = {}, defaults = {}) {
  return {
    event_id: requiredString(input.event_id || defaults.event_id, "event_id"),
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    changed_by: nullableString(input.changed_by),
    change_type: nullableString(input.change_type) || "manual_update",
    from_status: nullableString(input.from_status),
    to_status: input.to_status == null || input.to_status === "" ? null : normalizeDelayStatus(input.to_status),
    note: nullableString(input.note),
    diff: plainObject(input.diff),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayFindingPayload(input = {}, defaults = {}) {
  return {
    event_id: requiredString(input.event_id || defaults.event_id, "event_id"),
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    finding_type: enumValue(input.finding_type, ["documented_fact", "calculation", "analytical_conclusion", "professional_review"], "finding_type", "analytical_conclusion"),
    title: requiredString(input.title, "title"),
    explanation: nullableString(input.explanation),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    evidence_ids: Array.isArray(input.evidence_ids) ? input.evidence_ids.map((item) => String(item)).filter(Boolean) : [],
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayScheduleVersionPayload(input = {}, defaults = {}) {
  const title = requiredString(input.title, "title");
  return {
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    version_key: nullableString(input.version_key) || stableKey("delay_schedule", `${defaults.case_id || input.case_id}:${title}`),
    title,
    source_type: nullableString(input.source_type),
    source_id: nullableString(input.source_id),
    source_url: nullableString(input.source_url),
    schedule_date: nullableDate(input.schedule_date, "schedule_date"),
    contractual_completion_date: nullableDate(input.contractual_completion_date, "contractual_completion_date"),
    actual_completion_date: nullableDate(input.actual_completion_date, "actual_completion_date"),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayScheduleActivityPayload(input = {}, defaults = {}) {
  const startDate = nullableDate(input.start_date, "start_date");
  const finishDate = nullableDate(input.finish_date, "finish_date");
  if (startDate && finishDate && Date.parse(startDate) > Date.parse(finishDate)) {
    throw new Error("start_date must not be later than finish_date");
  }
  const name = requiredString(input.name, "name");
  return {
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    schedule_version_id: requiredString(input.schedule_version_id || defaults.schedule_version_id, "schedule_version_id"),
    activity_key: nullableString(input.activity_key) || stableKey("delay_activity", `${defaults.schedule_version_id || input.schedule_version_id}:${name}:${startDate || ""}`),
    name,
    start_date: startDate,
    finish_date: finishDate,
    duration_days: input.duration_days == null || input.duration_days === "" ? null : boundedNumber(input.duration_days, 0, 0, Number.MAX_SAFE_INTEGER),
    float_days: input.float_days == null || input.float_days === "" ? null : Number(input.float_days),
    is_critical: input.is_critical == null ? null : Boolean(input.is_critical),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayScheduleLinkPayload(input = {}, defaults = {}) {
  return {
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    event_id: requiredString(input.event_id || defaults.event_id, "event_id"),
    schedule_activity_id: requiredString(input.schedule_activity_id || defaults.schedule_activity_id, "schedule_activity_id"),
    link_type: enumValue(input.link_type, DELAY_SCHEDULE_LINK_TYPES, "link_type", "possibly_related"),
    explanation: nullableString(input.explanation),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayCostItemPayload(input = {}, defaults = {}) {
  const title = requiredString(input.title, "title");
  return {
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    event_id: nullableString(input.event_id || defaults.event_id),
    cost_key: nullableString(input.cost_key) || stableKey("delay_cost", `${defaults.case_id || input.case_id}:${title}:${input.amount || ""}`),
    title,
    cost_type: enumValue(input.cost_type, DELAY_COST_TYPES, "cost_type", "estimate"),
    amount: input.amount == null || input.amount === "" ? null : boundedNumber(input.amount, 0, 0, Number.MAX_SAFE_INTEGER),
    currency: nullableString(input.currency),
    source_type: nullableString(input.source_type),
    source_id: nullableString(input.source_id),
    source_url: nullableString(input.source_url),
    explanation: nullableString(input.explanation),
    duplicate_risk: Boolean(input.duplicate_risk),
    confidence: boundedNumber(input.confidence, 0, 0, 1),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export function sanitizeDelayClaimExportPayload(input = {}, defaults = {}) {
  const title = requiredString(input.title, "title");
  return {
    case_id: requiredString(input.case_id || defaults.case_id, "case_id"),
    export_key: nullableString(input.export_key) || stableKey("delay_export", `${defaults.case_id || input.case_id}:${title}:${input.export_type || "markdown"}`),
    export_type: enumValue(input.export_type, DELAY_EXPORT_TYPES, "export_type", "markdown"),
    title,
    content: nullableString(input.content),
    payload: plainObject(input.payload),
    human_status: normalizeDelayStatus(input.human_status),
    metadata: plainObject(input.metadata)
  };
}

export async function listDelayClaims({ config, limit = 50 } = {}) {
  if (!isConfigured(config)) return [];
  const max = Math.min(Math.max(Number(limit || 50), 1), 200);
  return supabaseFetch(config, `/rest/v1/${DELAY_CLAIM_CASES_TABLE}?select=*&order=updated_at.desc&limit=${max}`);
}

export async function createDelayClaim({ config, claim }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayClaimCasePayload(claim);
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_CLAIM_CASES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function listDelayEvents({ config, caseId, limit = 200 }) {
  if (!isConfigured(config)) return [];
  const max = Math.min(Math.max(Number(limit || 200), 1), 500);
  const select = "*,evidence:delay_event_evidence(*),gaps:delay_event_gaps(*),findings:delay_event_findings(*),change_log:delay_event_change_log(*)";
  const params = new URLSearchParams({
    select,
    case_id: `eq.${caseId}`,
    order: "created_at.desc",
    limit: String(max)
  });
  return supabaseFetch(config, `/rest/v1/${DELAY_EVENTS_TABLE}?${params.toString()}`);
}

export async function createDelayEvent({ config, caseId, event }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayEventPayload(event, { case_id: caseId });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENTS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function updateDelayEvent({ config, eventId, patch, changedBy = null }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const event = await getDelayEvent({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const payload = sanitizeDelayEventUpdatePayload(patch);
  if (!Object.keys(payload).length) return event;
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENTS_TABLE}?id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  const updated = rows?.[0] || { ...event, ...payload };
  if (payload.human_status && payload.human_status !== event.human_status) {
    await addDelayEventChangeLog({
      config,
      eventId,
      change: {
        case_id: updated.case_id,
        changed_by: changedBy,
        change_type: "status_change",
        from_status: event.human_status,
        to_status: payload.human_status,
        note: patch.status_note || patch.note || null,
        diff: { human_status: { from: event.human_status, to: payload.human_status } }
      }
    }).catch(() => null);
  }
  return updated;
}

export async function addDelayEventEvidence({ config, eventId, evidence }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const event = await getDelayEvent({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const payload = sanitizeDelayEvidencePayload(evidence, { event_id: eventId, case_id: event.case_id });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENT_EVIDENCE_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function addDelayEventGap({ config, eventId, gap }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const event = await getDelayEvent({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const payload = sanitizeDelayGapPayload(gap, { event_id: eventId, case_id: event.case_id });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENT_GAPS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function addDelayEventChangeLog({ config, eventId, change }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const event = change?.case_id ? { case_id: change.case_id } : await getDelayEvent({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const payload = sanitizeDelayChangeLogPayload(change, { event_id: eventId, case_id: event.case_id });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENT_CHANGE_LOG_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function addDelayEventFinding({ config, eventId, finding }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const event = finding?.case_id ? { case_id: finding.case_id } : await getDelayEvent({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const payload = sanitizeDelayFindingPayload(finding, { event_id: eventId, case_id: event.case_id });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENT_FINDINGS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function getDelayEvent({ config, eventId }) {
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENTS_TABLE}?id=eq.${encodeURIComponent(eventId)}&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function getDelayEventDetails({ config, eventId }) {
  if (!isConfigured(config)) return null;
  const select = "*,evidence:delay_event_evidence(*),gaps:delay_event_gaps(*),findings:delay_event_findings(*),change_log:delay_event_change_log(*)";
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENTS_TABLE}?id=eq.${encodeURIComponent(eventId)}&select=${encodeURIComponent(select)}&limit=1`);
  return rows?.[0] || null;
}

export async function createDelayScheduleVersion({ config, caseId, version }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayScheduleVersionPayload(version, { case_id: caseId });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_SCHEDULE_VERSIONS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function addDelayScheduleActivity({ config, scheduleVersionId, activity }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayScheduleActivityPayload(activity, { schedule_version_id: scheduleVersionId });
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_SCHEDULE_ACTIVITIES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function linkDelayEventScheduleActivity({ config, link }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayScheduleLinkPayload(link);
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_EVENT_SCHEDULE_LINKS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function addDelayCostItem({ config, cost }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayCostItemPayload(cost);
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_COST_ITEMS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function createDelayClaimExport({ config, claimExport }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeDelayClaimExportPayload(claimExport);
  const rows = await supabaseFetch(config, `/rest/v1/${DELAY_CLAIM_EXPORTS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function listQaReports({ config, limit = 200 }) {
  if (!isConfigured(config)) return [];
  return supabaseFetch(config,
    `/rest/v1/${QA_TABLE}?status=eq.done&order=created_at.desc&limit=${limit}&select=id,message_id,created_at,report`
  );
}

export async function annotateMessage({ config, messageId, annotation }) {
  if (!isConfigured(config) || String(messageId).startsWith("local_")) return null;
  return supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ annotation })
  });
}

export async function listSessions({ config, limit = 30 }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=session_id,status,created_at,user_message&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  const seen = new Map();
  for (const row of rows || []) {
    if (!seen.has(row.session_id)) seen.set(row.session_id, row);
  }
  return [...seen.entries()].map(([sessionId, row]) => ({ sessionId, ...row }));
}

export async function listRunHistory({ config, limit = 30 }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=id,created_at,user_message,workflow_log,run_events&workflow_log=not.is.null&status=eq.done&order=created_at.desc&limit=${limit}`;
  return supabaseFetch(config, query);
}

export async function saveProjectInsightRun({ config, run }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return null;
  const payload = sanitizeProjectInsightRunPayload(run);
  const rows = await supabaseFetch(contentConfig, `/rest/v1/${PROJECT_INSIGHT_RUNS_TABLE}?on_conflict=run_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || payload;
}

export async function listProjectInsightRuns({ config, limit = 30 }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return [];
  const max = Math.min(Math.max(Number(limit || 30), 1), 100);
  const select = [
    "id", "run_id", "parent_run_id", "project_id", "focus_query", "date_from", "date_to",
    "source_limit", "is_expansion", "excluded_source_keys", "scanned_source_keys", "summary",
    "insights", "tool_context", "workflow_log", "run_events", "status", "error", "metadata",
    "created_at", "updated_at"
  ].join(",");
  return supabaseFetch(contentConfig, `/rest/v1/${PROJECT_INSIGHT_RUNS_TABLE}?select=${select}&order=created_at.desc&limit=${max}`);
}

export async function getProjectInsightRun({ config, runId }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig) || !runId) return null;
  const rows = await supabaseFetch(contentConfig,
    `/rest/v1/${PROJECT_INSIGHT_RUNS_TABLE}?run_id=eq.${encodeURIComponent(runId)}&select=*&limit=1`
  );
  return rows?.[0] || null;
}

function sanitizeProjectInsightRunPayload(input = {}) {
  const runId = requiredString(input.run_id || input.runId, "run_id");
  const summary = plainObject(input.summary);
  return {
    run_id: runId,
    parent_run_id: nullableString(input.parent_run_id || input.parentRunId),
    project_id: nullableString(input.project_id || input.projectId),
    focus_query: nullableString(input.focus_query || input.focusQuery || summary.focusQuery),
    date_from: nullableDate(cleanProjectInsightDate(input.date_from || input.dateFrom || summary.dateFrom), "date_from"),
    date_to: nullableDate(cleanProjectInsightDate(input.date_to || input.dateTo || summary.dateTo), "date_to"),
    source_limit: Math.min(Math.max(Number(input.source_limit || input.limit || 350), 1), 2000),
    is_expansion: Boolean(input.is_expansion || input.expansion),
    excluded_source_keys: Array.isArray(input.excluded_source_keys) ? input.excluded_source_keys : Array.isArray(input.excludedSourceKeys) ? input.excludedSourceKeys : [],
    scanned_source_keys: Array.isArray(input.scanned_source_keys) ? input.scanned_source_keys : Array.isArray(input.scannedSourceKeys) ? input.scannedSourceKeys : [],
    summary,
    insights: Array.isArray(input.insights) ? input.insights : [],
    tool_context: plainObject(input.tool_context || input.toolContext),
    workflow_log: input.workflow_log || input.workflowLog || null,
    run_events: Array.isArray(input.run_events) ? input.run_events : Array.isArray(input.runEvents) ? input.runEvents : [],
    status: nullableString(input.status) || "done",
    error: nullableString(input.error),
    metadata: plainObject(input.metadata),
    updated_at: new Date().toISOString()
  };
}

function cleanProjectInsightDate(value) {
  const text = String(value || "").trim();
  if (!text || text === "undefined" || text === "null" || text === "Invalid Date") return null;
  return text.slice(0, 10);
}

export async function listMessages({ config, sessionId }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`;
  return supabaseFetch(config, query);
}

export async function recentMemory({ config, sessionId, limit = 8 }) {
  if (!isConfigured(config) || !sessionId) return [];
  // Only completed turns are conversational history. The current request is
  // inserted as `processing`, so excluding it prevents the latest user message
  // from appearing twice in the model prompt.
  const query = `/rest/v1/${MESSAGES_TABLE}?select=user_message,ai_response,created_at&session_id=eq.${encodeURIComponent(sessionId)}&status=eq.done&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  return (rows || []).reverse().flatMap((row) => {
    const messages = [];
    if (row.user_message) messages.push({ role: "user", content: row.user_message });
    if (row.ai_response) messages.push({ role: "assistant", content: row.ai_response });
    return messages;
  });
}

export async function getChatSessionMemory({ config, sessionId, userId = null }) {
  if (!isConfigured(config) || !sessionId) return null;
  const rows = await supabaseFetch(config,
    `/rest/v1/${SESSION_MEMORY_TABLE}?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`
  );
  const row = rows?.[0] || null;
  if (row && String(row.user_id || "") !== String(userId || "")) {
    throw new Error("Session memory belongs to a different user");
  }
  return row;
}

export async function upsertChatSessionMemory({ config, sessionId, userId = null, summary = {}, turnCount = 0, summaryVersion = 1 }) {
  if (!isConfigured(config) || !sessionId) return null;
  const existing = await supabaseFetch(config,
    `/rest/v1/${SESSION_MEMORY_TABLE}?session_id=eq.${encodeURIComponent(sessionId)}&select=user_id&limit=1`
  );
  if (existing?.length && String(existing[0].user_id || "") !== String(userId || "")) {
    throw new Error("Session memory belongs to a different user");
  }
  const rows = await supabaseFetch(config, `/rest/v1/${SESSION_MEMORY_TABLE}?on_conflict=session_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      user_id: userId || null,
      summary: plainObject(summary),
      turn_count: Math.max(0, Number(turnCount) || 0),
      summary_version: Math.max(1, Number(summaryVersion) || 1)
    })
  });
  return rows?.[0] || null;
}

export async function matchChatMemory({ config, userId, embedding, settings }) {
  if (!isConfigured(config) || !userId || !Array.isArray(embedding) || !embedding.length) return [];
  return supabaseFetch(config, "/rest/v1/rpc/match_chat_memory", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId,
      p_query_embedding: embedding,
      p_match_count: settings.semanticTopK,
      p_similarity_threshold: settings.similarityThreshold,
      p_semantic_weight: settings.semanticWeight,
      p_recency_weight: settings.recencyWeight,
      p_importance_weight: settings.importanceWeight
    })
  });
}

export async function replaceChatMemoryItem({ config, item }) {
  if (!isConfigured(config) || !item?.userId || !item?.canonicalKey) return null;
  const userFilter = encodeURIComponent(item.userId);
  const keyFilter = encodeURIComponent(item.canonicalKey);
  const active = await supabaseFetch(config,
    `/rest/v1/${MEMORY_ITEMS_TABLE}?user_id=eq.${userFilter}&canonical_key=eq.${keyFilter}&valid_to=is.null&select=id&limit=1`
  );
  const previousId = active?.[0]?.id || null;
  if (previousId) {
    await supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(previousId)}`, {
      method: "PATCH",
      body: JSON.stringify({ valid_to: new Date().toISOString() })
    });
  }
  const rows = await supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: item.userId,
      memory_type: item.memoryType || "fact",
      canonical_key: item.canonicalKey,
      content: item.content,
      source: item.source || "automatic",
      source_session_id: item.sessionId || null,
      source_message_id: Number.isFinite(Number(item.messageId)) ? Number(item.messageId) : null,
      confidence: item.confidence ?? 1,
      importance: item.importance ?? 0.5,
      embedding: item.embedding || null,
      embedding_model: item.embeddingModel || "openai/text-embedding-3-large",
      expires_at: item.expiresAt || null,
      metadata: plainObject(item.metadata)
    })
  });
  const created = rows?.[0] || null;
  if (previousId && created?.id) {
    await supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(previousId)}`, {
      method: "PATCH",
      body: JSON.stringify({ superseded_by: created.id })
    });
  }
  return created;
}

export async function forgetChatMemory({ config, userId, canonicalKey }) {
  if (!isConfigured(config) || !userId || !canonicalKey) return 0;
  const rows = await supabaseFetch(config,
    `/rest/v1/${MEMORY_ITEMS_TABLE}?user_id=eq.${encodeURIComponent(userId)}&canonical_key=eq.${encodeURIComponent(canonicalKey)}&valid_to=is.null&select=id`
  );
  if (!rows?.length) return 0;
  await supabaseFetch(config,
    `/rest/v1/${MEMORY_ITEMS_TABLE}?user_id=eq.${encodeURIComponent(userId)}&canonical_key=eq.${encodeURIComponent(canonicalKey)}&valid_to=is.null`,
    { method: "PATCH", body: JSON.stringify({ valid_to: new Date().toISOString() }) }
  );
  return rows.length;
}

export async function invalidateChatMemoryItems({ config, userId, ids = [] }) {
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 30);
  if (!isConfigured(config) || !userId || !clean.length) return 0;
  const timestamp = new Date().toISOString();
  let count = 0;
  for (const id of clean) {
    const rows = await supabaseFetch(config,
      `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&valid_to=is.null&select=id`
    );
    if (!rows?.length) continue;
    await supabaseFetch(config,
      `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&valid_to=is.null`,
      { method: "PATCH", body: JSON.stringify({ valid_to: timestamp }) }
    );
    count += 1;
  }
  return count;
}

export async function touchChatMemoryItems({ config, ids = [] }) {
  const clean = [...new Set(ids.map(String).filter(Boolean))].slice(0, 30);
  if (!isConfigured(config) || !clean.length) return;
  for (const id of clean) {
    const rows = await supabaseFetch(config,
      `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(id)}&select=access_count&limit=1`
    );
    await supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        access_count: Math.max(0, Number(rows?.[0]?.access_count) || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
    });
  }
}

export async function getChatMemoryStats({ config, userId = null }) {
  if (!isConfigured(config)) return { memoryItems: 0, sessions: 0, lastUpdatedAt: null };
  const userQuery = userId ? `user_id=eq.${encodeURIComponent(userId)}` : "user_id=is.null";
  const [items, sessions] = await Promise.all([
    userId
      ? supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}?${userQuery}&valid_to=is.null&select=id,updated_at&order=updated_at.desc`)
      : Promise.resolve([]),
    supabaseFetch(config, `/rest/v1/${SESSION_MEMORY_TABLE}?${userQuery}&select=session_id,updated_at&order=updated_at.desc`)
  ]);
  const dates = [...(items || []), ...(sessions || [])].map((row) => row.updated_at).filter(Boolean).sort().reverse();
  return { memoryItems: items?.length || 0, sessions: sessions?.length || 0, lastUpdatedAt: dates[0] || null };
}

export async function deleteChatSessionMemory({ config, sessionId, userId = null }) {
  if (!isConfigured(config) || !sessionId) return false;
  const ownerFilter = userId ? `&user_id=eq.${encodeURIComponent(userId)}` : "&user_id=is.null";
  const rows = await supabaseFetch(config,
    `/rest/v1/${SESSION_MEMORY_TABLE}?session_id=eq.${encodeURIComponent(sessionId)}${ownerFilter}&select=session_id`
  );
  if (!rows?.length) return false;
  await supabaseFetch(config,
    `/rest/v1/${SESSION_MEMORY_TABLE}?session_id=eq.${encodeURIComponent(sessionId)}${ownerFilter}`,
    { method: "DELETE" }
  );
  return true;
}

export async function deleteAllChatMemoryForUser({ config, userId }) {
  if (!isConfigured(config) || !userId) return { memories: 0, sessions: 0 };
  const stats = await getChatMemoryStats({ config, userId });
  const filter = encodeURIComponent(userId);
  await Promise.all([
    supabaseFetch(config, `/rest/v1/${MEMORY_ITEMS_TABLE}?user_id=eq.${filter}`, { method: "DELETE" }),
    supabaseFetch(config, `/rest/v1/${SESSION_MEMORY_TABLE}?user_id=eq.${filter}`, { method: "DELETE" })
  ]);
  return { memories: stats.memoryItems, sessions: stats.sessions };
}

export async function hybridSearch({ config, query, dateFrom, dateTo, hashtags = [], topK = config.retrieval.candidates, cacheContext = null, telemetry = null }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) throw new Error("Content Supabase is not configured");

  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: query,
    cacheContext,
    telemetry
  });

  const payload = {
    query_text: query,
    query_embedding: embedding,
    match_count: topK,
    date_from: dateFrom,
    date_to: dateTo,
    hashtags: normalizeHashtags(hashtags),
    vector_weight: config.retrieval.vectorWeight,
    keyword_weight: config.retrieval.keywordWeight,
    ...(config.projectId ? { project_id_filter: config.projectId } : {})
  };

  return cachedOperation({
    context: cacheContext,
    type: "hybridSearch",
    keyParts: {
      query,
      dateFrom,
      dateTo,
      hashtags: payload.hashtags,
      topK,
      rpc: contentConfig.hybridRpcName,
      vectorWeight: payload.vector_weight,
      keywordWeight: payload.keyword_weight,
      ...(config.projectId ? { projectId: config.projectId } : {})
    },
    ttl: CACHE_TTL.hybridSearch,
    savedCall: "search",
    estimatedCost: 0.0002,
    operation: async () => {
      try {
        return await supabaseFetch(contentConfig, `/rest/v1/rpc/${contentConfig.hybridRpcName}`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      } catch (error) {
        if (!looksLikeRpcSignatureError(error.message)) throw error;
        // Contractual-date resolution must never widen from one project to the
        // whole tenant when an older RPC lacks project_id_filter support.
        if (config.requireProjectScope === true && payload.project_id_filter) throw error;
        // Graceful degradation: strip all optional params that older company DBs
        // may not recognise (project_id_filter requires migration 027, hashtags
        // requires the GIN index from 026). Retry with the minimal required params.
        const hasOptionalParams = payload.project_id_filter || payload.hashtags.length;
        if (!hasOptionalParams) throw error;
        const { project_id_filter: _pid, hashtags: _hashtags, ...payloadBase } = payload;
        return supabaseFetch(contentConfig, `/rest/v1/rpc/${contentConfig.hybridRpcName}`, {
          method: "POST",
          body: JSON.stringify(payloadBase)
        });
      }
    }
  });
}

export const vectorSearch = hybridSearch;

async function supabaseFetch(config, path, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 20_000);
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      ...supabaseHeaders(config.supabaseServiceRoleKey),
      ...(options.headers || {})
    }
  }).finally(() => clearTimeout(id));
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return data;
}

function isConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

// Raw REST access to the Content Supabase for internal agents (indexing agent).
export async function contentSupabaseRequest({ config, path, options = {} }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) throw new Error("Content Supabase is not configured");
  return supabaseFetch(contentConfig, path, options);
}

export function contentSupabaseConfig(config) {
  return {
    supabaseUrl: config.contentSource?.supabaseUrl || config.supabaseUrl || "",
    supabaseServiceRoleKey: config.contentSource?.supabaseServiceRoleKey || config.supabaseServiceRoleKey || "",
    hybridRpcName: config.contentSource?.hybridRpcName || config.retrieval?.rpcName || "hybrid_match_data_index_embeddings_gf_dor_agent",
    indexTable: config.contentSource?.indexTable || "data_index_embeddings_gf_dor_agent",
    alertsTable: config.contentSource?.alertsTable || "alerts_embeddings_gf",
    alertsRpcName: config.contentSource?.alertsRpcName || `match_${config.contentSource?.alertsTable || "alerts_embeddings_gf"}`
  };
}

function normalizeHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return [];
  return [...new Set(hashtags.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}

function looksLikeRpcSignatureError(message) {
  return /function|parameter|argument|schema cache|could not find|PGRST202/i.test(String(message || ""));
}

export function parseTimelineEventsQuery(searchParams = new URLSearchParams()) {
  const sourceValue = searchParams.get("source");
  const sortValue = searchParams.get("sort");
  const limitValue = searchParams.get("limit");
  const source = sourceValue == null ? "index" : sourceValue;
  const sort = sortValue == null ? "desc" : sortValue;
  const origins = parseTimelineOrigins(searchParams, source);

  if (!["index", "alerts"].includes(source)) {
    throw new TimelineRequestError("source must be index or alerts");
  }
  if (!["asc", "desc"].includes(sort)) {
    throw new TimelineRequestError("sort must be asc or desc");
  }

  let limit = TIMELINE_PAGE_DEFAULT_LIMIT;
  if (limitValue != null) {
    if (!/^\d+$/.test(limitValue)) throw new TimelineRequestError("limit must be an integer between 1 and 2000");
    limit = Number(limitValue);
    if (limit < 1 || limit > TIMELINE_PAGE_MAX_LIMIT) {
      throw new TimelineRequestError("limit must be between 1 and 2000");
    }
  }

  const from = parseTimelineIsoDate(searchParams.get("from"), "from");
  const to = parseTimelineIsoDate(searchParams.get("to"), "to");
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new TimelineRequestError("from must not be later than to");
  }

  const cursor = decodeTimelineCursor(searchParams.get("cursor"), { source, sort, origins });
  return { source, sort, limit, from, to, origins, cursor };
}

export async function fetchTimelineEventPage({ config, source = "index", sort = "desc", limit = TIMELINE_PAGE_DEFAULT_LIMIT, from = null, to = null, origins = [], cursor = null }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) {
    return {
      events: [],
      page: { nextCursor: null, hasMore: false, from, to, sort, limit, origins }
    };
  }

  const primaryDateField = source === "alerts" ? "data_date" : "primary_date";
  const table = source === "alerts" ? contentConfig.alertsTable : contentConfig.indexTable;
  const direction = sort === "asc" ? "asc" : "desc";
  const decodedCursor = typeof cursor === "string"
    ? decodeTimelineCursor(cursor, { source, sort, origins })
    : cursor;
  const params = new URLSearchParams({
    select: TIMELINE_PAGE_FIELDS[source].join(","),
    order: `${primaryDateField}.${direction}.nullslast,created_at.${direction},id.${direction}`,
    limit: String(limit + 1)
  });
  const filters = buildTimelinePageFilters({ primaryDateField, from, to, cursor: decodedCursor, sort, origins });
  if (filters.length) params.set("and", `(${filters.join(",")})`);

  const rows = await supabaseFetch(contentConfig, `/rest/v1/${table}?${params.toString()}`);
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const events = pageRows.map((row) => compactTimelineEvent(row, source));
  const lastRow = pageRows.at(-1);
  return {
    events,
    page: {
      nextCursor: hasMore && lastRow ? encodeTimelineCursor(lastRow, { source, sort, origins, primaryDateField }) : null,
      hasMore,
      from,
      to,
      sort,
      limit,
      origins
    }
  };
}

function parseTimelineOrigins(searchParams, source) {
  if (!searchParams.has("origins")) return [];
  if (searchParams.getAll("origins").length !== 1) {
    throw new TimelineRequestError("origins must be provided once");
  }
  const raw = searchParams.get("origins");
  if (source !== "index") {
    throw new TimelineRequestError("origins is only supported for index events");
  }
  if (!raw) throw new TimelineRequestError("origins must contain drive, email or whatsapp");
  const values = raw.split(",");
  if (values.some((value) => !value || !TIMELINE_ORIGINS.includes(value))) {
    throw new TimelineRequestError("origins must contain drive, email or whatsapp");
  }
  return TIMELINE_ORIGINS.filter((origin) => values.includes(origin));
}

function parseTimelineIsoDate(value, field) {
  if (value == null) return null;
  const text = String(value).trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if ((!isoDate.test(text) && !isoDateTime.test(text)) || !validIsoCalendarDate(text) || Number.isNaN(Date.parse(text))) {
    throw new TimelineRequestError(`${field} must be a valid ISO date`);
  }
  return new Date(text).toISOString();
}

function validIsoCalendarDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function buildTimelinePageFilters({ primaryDateField, from, to, cursor, sort, origins = [] }) {
  const filters = [];
  if (origins.length) filters.push(timelineOriginsFilter(origins));
  if (from) {
    filters.push(`or(${primaryDateField}.gte.${from},and(${primaryDateField}.is.null,created_at.gte.${from}))`);
  }
  if (to) {
    filters.push(`or(${primaryDateField}.lte.${to},and(${primaryDateField}.is.null,created_at.lte.${to}))`);
  }
  if (cursor) filters.push(timelineCursorFilter({ primaryDateField, cursor, sort }));
  return filters;
}

function timelineOriginsFilter(origins) {
  const clauses = [];
  if (origins.includes("drive")) {
    clauses.push("source_url.ilike.*sharepoint.com*", "source_url.ilike.*onedrive*");
  }
  if (origins.includes("email")) clauses.push("source_table.eq.emails");
  if (origins.includes("whatsapp")) clauses.push("source_table.eq.whatsapp_analysis");
  return `or(${clauses.join(",")})`;
}

function timelineCursorFilter({ primaryDateField, cursor, sort }) {
  const comparison = sort === "asc" ? "gt" : "lt";
  const id = cursor.id;
  if (cursor.fallback) {
    return `and(${primaryDateField}.is.null,or(created_at.${comparison}.${cursor.date},and(created_at.eq.${cursor.date},id.${comparison}.${id})))`;
  }
  return `or(${primaryDateField}.${comparison}.${cursor.date},and(${primaryDateField}.eq.${cursor.date},created_at.${comparison}.${cursor.createdAt}),and(${primaryDateField}.eq.${cursor.date},created_at.eq.${cursor.createdAt},id.${comparison}.${id}),${primaryDateField}.is.null)`;
}

function encodeTimelineCursor(row, { source, sort, origins, primaryDateField }) {
  const fallback = !row[primaryDateField];
  const date = fallback ? row.created_at : row[primaryDateField];
  const payload = {
    v: TIMELINE_CURSOR_VERSION,
    source,
    sort,
    origins: origins.join(","),
    date: normalizeCursorDate(date),
    createdAt: normalizeCursorDate(row.created_at),
    id: normalizeCursorId(row.id),
    fallback
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeTimelineCursor(value, { source, sort, origins }) {
  if (value == null) return null;
  try {
    const payload = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (
      payload?.v !== TIMELINE_CURSOR_VERSION ||
      payload.source !== source ||
      payload.sort !== sort ||
      payload.origins !== origins.join(",") ||
      typeof payload.fallback !== "boolean" ||
      normalizeCursorDate(payload.date) !== payload.date ||
      normalizeCursorDate(payload.createdAt) !== payload.createdAt ||
      normalizeCursorId(payload.id) !== payload.id
    ) {
      throw new Error("invalid cursor payload");
    }
    return payload;
  } catch {
    throw new TimelineRequestError("cursor is invalid");
  }
}

function normalizeCursorDate(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("invalid cursor date");
  return new Date(value).toISOString();
}

function normalizeCursorId(value) {
  if (!["string", "number"].includes(typeof value)) throw new Error("invalid cursor id");
  const id = String(value);
  if (!id || !/^[A-Za-z0-9:_-]+$/.test(id)) throw new Error("invalid cursor id");
  return id;
}

function compactTimelineEvent(row, source) {
  const metadata = pickNonEmpty(row, TIMELINE_METADATA_FIELDS[source]);
  if (source === "alerts") {
    return {
      id: `alert_${row.id}`,
      date: row.data_date || row.created_at,
      content: row.summary || row.alert_description || row.content || row.answer || row.question || "",
      tags: uniqueTimelineTags(row.hashtags, row.alert_type),
      source: "alerts",
      severity: emptyTimelineValue(row.severity_level) ? null : row.severity_level,
      metadata
    };
  }
  return {
    id: row.id,
    date: row.primary_date || row.created_at,
    content: row.title || row.summary || row.index_text || "",
    tags: uniqueTimelineTags(row.hashtags),
    source: "index",
    severity: emptyTimelineValue(row.severity_or_risk) ? null : row.severity_or_risk,
    metadata
  };
}

function pickNonEmpty(row, fields) {
  return Object.fromEntries(fields
    .map((field) => [field, row[field]])
    .filter(([, value]) => !emptyTimelineValue(value)));
}

function emptyTimelineValue(value) {
  return value == null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
}

function uniqueTimelineTags(value, extra = null) {
  return [...new Set([
    ...parseHashtags(value),
    ...(emptyTimelineValue(extra) ? [] : [String(extra).replace(/^#+/, "")])
  ].filter(Boolean))];
}

export async function fetchAlertsTimelineEvents({ config, limit = 2000 }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return [];
  const query = `/rest/v1/${contentConfig.alertsTable}?select=id,created_at,question,answer,alert_description,alert_type,severity_level,input_data_type,input_data_id,analyzed_data,data_link,data_date,status,item_status,hashtags,summary,content,metadata,is_relevant&order=data_date.asc.nullslast,created_at.asc&limit=${limit}`;
  const rows = await supabaseFetch(contentConfig, query);
  return (rows || []).map((row) => {
    const date = timelineRowDate(row);
    return {
      id: `alert_${row.id}`,
      date,
      tags: parseHashtags(row.hashtags || row.metadata?.hashtags || row.metadata?.tags || row.alert_type).concat(row.alert_type ? [row.alert_type] : []).filter((tag, index, all) => tag && all.indexOf(tag) === index),
      content: alertRowContent(row),
      metadata: alertRowMetadata(row),
      source: "alert",
      severity: Number(row.severity_level || row.metadata?.severity_level || 1)
    };
  }).filter((event) => event.date);
}

function alertRowContent(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return row.summary ||
    row.alert_description ||
    row.content ||
    row.answer ||
    row.analyzed_data ||
    row.question ||
    metadata.summary ||
    metadata.alert_description ||
    metadata.content ||
    "";
}

function alertRowMetadata(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    question: row.question ?? metadata.question,
    answer: row.answer ?? metadata.answer,
    alert_description: row.alert_description ?? metadata.alert_description,
    alert_type: row.alert_type ?? metadata.alert_type,
    severity_level: row.severity_level ?? metadata.severity_level,
    input_data_type: row.input_data_type ?? metadata.input_data_type,
    input_data_id: row.input_data_id ?? metadata.input_data_id,
    analyzed_data: row.analyzed_data ?? metadata.analyzed_data,
    data_link: row.data_link ?? metadata.data_link,
    data_date: row.data_date ?? metadata.data_date,
    status: row.status ?? metadata.status,
    item_status: row.item_status ?? metadata.item_status,
    is_relevant: row.is_relevant ?? metadata.is_relevant,
    url: row.data_link ?? metadata.url
  };
}

export async function fetchTimelineEvents({ config, limit = 1000 }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return [];
  const query = `/rest/v1/${contentConfig.indexTable}?select=id,created_at,project_id,source_table,source_id,summary,hashtags,index_text,metadata,primary_date,title,item_status,severity_or_risk,mail_id,attachment_id,source_url,mentioned_dates&order=primary_date.asc.nullslast,created_at.asc&limit=${limit}`;
  const rows = await supabaseFetch(contentConfig, query);
  return (rows || []).map((row) => ({
    id: row.id,
    date: timelineRowDate(row),
    tags: parseHashtags(row.hashtags || row.metadata?.hashtags || row.metadata?.tags),
    content: timelineRowContent(row),
    metadata: timelineRowMetadata(row)
  })).filter((event) => event.date);
}

function timelineRowDate(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const candidates = [
    row.primary_date,
    row.data_date,
    row.date,
    row.created_at,
    metadata.date,
    metadata.primary_date,
    metadata.event_date,
    metadata.created_at,
    metadata.timestamp,
    metadata.time,
    metadata.datetime,
    metadata.document_date
  ];
  const value = candidates.find((item) => item && !Number.isNaN(Date.parse(item)));
  return value ? String(value) : "";
}

function timelineRowContent(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return row.title ||
    row.summary ||
    row.index_text ||
    row.content ||
    metadata.summary ||
    metadata.title ||
    metadata.text ||
    metadata.content ||
    "";
}

function timelineRowMetadata(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    source_table: row.source_table ?? metadata.source_table,
    source_id: row.source_id ?? metadata.source_id,
    project_id: row.project_id ?? metadata.project_id,
    title: row.title ?? metadata.title,
    summary: row.summary ?? metadata.summary,
    index_text: row.index_text ?? metadata.index_text,
    item_status: row.item_status ?? metadata.item_status,
    severity_or_risk: row.severity_or_risk ?? metadata.severity_or_risk,
    mail_id: row.mail_id ?? metadata.mail_id,
    attachment_id: row.attachment_id ?? metadata.attachment_id,
    mentioned_dates: row.mentioned_dates ?? metadata.mentioned_dates,
    source_url: row.source_url ?? metadata.source_url,
    url: row.source_url ?? metadata.url
  };
}

export async function listTimelineEventLinks({ config, source = "", limit = 1000 } = {}) {
  if (!isConfigured(config)) return [];
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(limit)
  });
  if (source === "index" || source === "alerts") {
    params.set("or", `(source_event_source.eq.${source},target_event_source.eq.${source})`);
  }
  const rows = await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?${params.toString()}`);
  return (rows || []).map(addDurationToLink);
}

export async function createTimelineEventLink({ config, link }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeTimelineEventLink(link);
  const rows = await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?select=*`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return addDurationToLink(rows?.[0] || payload);
}

export async function deleteTimelineEventLink({ config, id }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  if (!id) throw new Error("Timeline link id is required");
  await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return { ok: true };
}

export async function listTimelineGraphData({ config, source = "index", limit = 5000 } = {}) {
  if (!isConfigured(config)) return { entities: [], eventEntities: [], graphEdges: [] };
  const eventParams = new URLSearchParams({
    select: "*,entity:timeline_entities(*)",
    event_source: `eq.${source}`,
    limit: String(limit)
  });
  const edgeParams = new URLSearchParams({
    select: "*",
    limit: String(limit)
  });
  const eventEntities = await supabaseFetch(config, `/rest/v1/${TIMELINE_EVENT_ENTITIES_TABLE}?${eventParams.toString()}`).catch(() => []);
  const graphEdges = await supabaseFetch(config, `/rest/v1/${TIMELINE_GRAPH_EDGES_TABLE}?${edgeParams.toString()}`).catch(() => []);
  const entities = [...new Map((eventEntities || []).map((item) => [item.entity_id, item.entity]).filter(([, entity]) => entity)).values()];
  return { entities, eventEntities: eventEntities || [], graphEdges: graphEdges || [] };
}

export async function upsertTimelineGraphData({ config, entities = [], eventEntities = [] }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const uniqueEntities = uniqueByKey(entities, (entity) => entity.id);
  const uniqueEventEntities = uniqueByKey(eventEntities, (item) => [
    item.event_source === "alerts" ? "alerts" : "index",
    item.event_id,
    item.entity_id,
    item.role || "mentioned"
  ].join("|"));
  if (uniqueEntities.length) {
    await supabaseFetch(config, `/rest/v1/${TIMELINE_ENTITIES_TABLE}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(uniqueEntities.map(sanitizeTimelineEntity))
    });
  }
  if (uniqueEventEntities.length) {
    await supabaseFetch(config, `/rest/v1/${TIMELINE_EVENT_ENTITIES_TABLE}?on_conflict=event_source,event_id,entity_id,role`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(uniqueEventEntities.map(sanitizeTimelineEventEntity))
    });
  }
  return { entities: uniqueEntities.length, eventEntities: uniqueEventEntities.length };
}

export async function upsertProjectGraphData({ config, nodes = [], edges = [] }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const uniqueNodes = uniqueByKey(nodes, (node) => node.id);
  const uniqueEdges = uniqueByKey(edges, (edge) => [
    edge.from_node_id,
    edge.to_node_id,
    edge.edge_type || "related_to"
  ].join("|"));
  for (const batch of chunk(uniqueNodes, GRAPH_UPSERT_BATCH_SIZE)) {
    await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch.map(sanitizeGraphNode))
    });
  }
  for (const batch of chunk(uniqueEdges, GRAPH_UPSERT_BATCH_SIZE)) {
    await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?on_conflict=from_node_id,to_node_id,edge_type`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch.map(sanitizeGraphEdge))
    });
  }
  return { nodes: uniqueNodes.length, edges: uniqueEdges.length };
}

// Entity mention links created by the Graph Entity Enrichment Agent (tagged
// metadata.enrichment). Consumed by the insights pipeline for entity-aware
// clustering and dependency detection (phase-2 Task 4 / spec Task G3).
export async function listEntityMentionEdges({ config, limit = 2000 } = {}) {
  if (!isConfigured(config)) return [];
  const params = new URLSearchParams({
    select: "to_node_id,metadata",
    limit: String(Math.min(Math.max(Number(limit) || 2000, 1), 5000))
  });
  const rows = await supabaseFetch(
    config,
    `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}&metadata->>enrichment=eq.graph-enrichment-v1`
  );
  return (rows || [])
    .map((row) => {
      const metadata = row.metadata || {};
      const entityId = String(row.to_node_id || "");
      return {
        record_ref: `${metadata.source_table || ""}:${metadata.source_id || ""}`,
        entity_id: entityId,
        kind: metadata.target_kind || entityId.split(":")[0] || "entity",
        label: entityId.split(":").slice(1).join(":")
      };
    })
    .filter((item) => item.entity_id && item.record_ref.length > 1 && !item.record_ref.startsWith(":") && !item.record_ref.endsWith(":"));
}

// Entity-resolution v2: re-point every mention edge from an alias entity node to
// its canonical node (merge-duplicates keeps the unique from/to/type constraint
// happy), then remove the alias node. Alias rows are all enrichment-created, so
// they can be regenerated from source records if ever needed.
export async function mergeGraphEntityNodes({ config, moves = [] } = {}) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  let edgesRepointed = 0;
  let nodesRemoved = 0;
  for (const move of moves) {
    if (!move?.from_id || !move?.to_id || move.from_id === move.to_id) continue;
    const params = new URLSearchParams({
      select: "from_node_id,to_node_id,edge_type,weight,confidence,evidence_text,metadata",
      limit: "2000"
    });
    const edges = await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}&to_node_id=eq.${encodeURIComponent(move.from_id)}`);
    const repointed = (edges || []).map((edge) => ({ ...edge, to_node_id: move.to_id }));
    if (repointed.length) {
      await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?on_conflict=from_node_id,to_node_id,edge_type`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(repointed)
      });
      await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?to_node_id=eq.${encodeURIComponent(move.from_id)}`, { method: "DELETE" });
      edgesRepointed += repointed.length;
    }
    await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?id=eq.${encodeURIComponent(move.from_id)}`, { method: "DELETE" });
    nodesRemoved += 1;
  }
  return { edgesRepointed, nodesRemoved };
}

// Removes junk entity nodes (and their mention edges) outright — used by the
// consolidation pass for sentence-length extraction artifacts.
export async function removeGraphEntityNodes({ config, ids = [] } = {}) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  let removed = 0;
  for (const id of ids) {
    if (!id) continue;
    await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?to_node_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    removed += 1;
  }
  return { removed };
}

export async function graphSearch({ config, payload = {}, limit = 30 } = {}) {
  if (!isConfigured(config)) return { results: [], skipped: true, reason: "App Supabase is not configured" };
  const body = {
    query_text: payload.query_text || "",
    source_refs: Array.isArray(payload.source_refs) ? payload.source_refs : [],
    max_rows: Number(payload.max_rows || limit || 30)
  };
  try {
    const results = await supabaseFetch(config, "/rest/v1/rpc/graph_search", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return { results: results || [], skipped: false, mode: "rpc" };
  } catch (error) {
    if (!looksLikeRpcSignatureError(error.message) && !/graph_search/i.test(error.message)) throw error;
    const results = await graphSearchFallback({ config, payload: body, limit: body.max_rows }).catch(() => []);
    return { results, skipped: !results.length, mode: "rest_fallback", error: error.message };
  }
}

export async function listProjectGraph({ config, limit = 300, nodeType = "", edgeType = "", query = "" } = {}) {
  if (!isConfigured(config)) return emptyProjectGraph("App Supabase is not configured");
  const max = Math.min(Math.max(Number(limit || 300), 1), 1000);
  if (nodeType) {
    const graph = await listProjectGraphByNodeFilter({ config, limit: max, nodeType, edgeType, query }).catch(() => null);
    if (graph && (graph.nodes.length || graph.edges.length)) return graph;
  }
  const needsSemanticFilter = Boolean(
    query ||
    (nodeType && !GRAPH_NODE_TYPES.has(nodeType)) ||
    (edgeType && !GRAPH_EDGE_TYPES.has(edgeType))
  );
  const fetchLimit = needsSemanticFilter ? Math.min(Math.max(max * 200, 5000), 10000) : max;
  const filters = [];
  if (edgeType && GRAPH_EDGE_TYPES.has(edgeType)) filters.push(`edge_type=eq.${encodeURIComponent(edgeType)}`);
  if (edgeType && !GRAPH_EDGE_TYPES.has(edgeType)) filters.push(`metadata->>edge_kind=eq.${encodeURIComponent(edgeType)}`);
  const params = new URLSearchParams({
    select: "id,edge_type,weight,confidence,evidence_text,metadata,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
    order: "confidence.desc",
    limit: String(fetchLimit)
  });
  const edgePath = `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}${filters.length ? `&${filters.join("&")}` : ""}`;
  try {
    const rows = await supabaseFetch(config, edgePath);
    return projectGraphResponse(rows || [], { nodeType, edgeType, query, limit: max });
  } catch (error) {
    if (/graph_nodes|graph_edges|schema cache|could not find/i.test(error.message)) {
      return emptyProjectGraph(error.message);
    }
    throw error;
  }
}

async function listProjectGraphByNodeFilter({ config, limit = 300, nodeType = "", edgeType = "", query = "" } = {}) {
  const max = Math.min(Math.max(Number(limit || 300), 1), 1000);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const nodeRows = await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?select=*&limit=10000`);
  const selectedNodes = (nodeRows || [])
    .map(normalizeProjectGraphNode)
    .filter((node) => node && nodeMatchesType(node, nodeType))
    .filter((node) => !normalizedQuery || projectGraphNodeMatches({ node, query: normalizedQuery }))
    .slice(0, max);
  if (!selectedNodes.length) return projectGraphResponse([], { nodeType, edgeType, query, limit: max });
  const edgeRows = [];
  for (const batch of chunk(selectedNodes.map((node) => node.id), 50)) {
    const encoded = batch.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(",");
    const params = new URLSearchParams({
      select: "id,edge_type,weight,confidence,evidence_text,metadata,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
      or: `(from_node_id.in.(${encoded}),to_node_id.in.(${encoded}))`,
      order: "confidence.desc",
      limit: String(Math.min(max * 10, 1000))
    });
    if (edgeType && GRAPH_EDGE_TYPES.has(edgeType)) params.set("edge_type", `eq.${edgeType}`);
    const rows = await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}`).catch(() => []);
    edgeRows.push(...(rows || []));
  }
  return projectGraphResponse(edgeRows, { nodeType, edgeType, query, limit: max, extraNodes: selectedNodes });
}

export function projectGraphResponse(rows = [], { nodeType = "", edgeType = "", query = "", limit = 300, extraNodes = [] } = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const selectedType = String(nodeType || "").trim();
  const selectedEdgeType = String(edgeType || "").trim();
  const nodes = new Map();
  const edges = [];
  for (const node of extraNodes || []) {
    if (node?.id && (!selectedType || nodeMatchesType(node, selectedType))) nodes.set(node.id, node);
  }
  for (const row of rows || []) {
    const source = normalizeProjectGraphNode(row.from_node || row.source_node);
    const target = normalizeProjectGraphNode(row.to_node || row.target_node);
    if (!source?.id || !target?.id) continue;
    if (!normalizedQuery && (isNoisySourceNode(source) || isNoisySourceNode(target))) continue;
    if (selectedType && !nodeMatchesType(source, selectedType) && !nodeMatchesType(target, selectedType)) continue;
    if (selectedEdgeType && row.edge_type !== selectedEdgeType && row.metadata?.edge_kind !== selectedEdgeType) continue;
    if (normalizedQuery && !projectGraphRowMatches({ row, source, target, query: normalizedQuery })) continue;
    nodes.set(source.id, source);
    nodes.set(target.id, target);
    edges.push({
      id: row.id || row.edge_id || `${source.id}->${target.id}:${row.edge_type}`,
      source: source.id,
      target: target.id,
      edge_type: row.edge_type || "related_to",
      edge_kind: row.metadata?.edge_kind || row.edge_type || "related_to",
      weight: Number(row.weight || 0.5),
      confidence: Number(row.confidence || row.weight || 0.5),
      evidence_text: row.evidence_text || "",
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}
    });
  }
  const graphNodes = [...nodes.values()].slice(0, Number(limit || 300));
  const visible = new Set(graphNodes.map((node) => node.id));
  const graphEdges = edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)).slice(0, Number(limit || 300));
  return {
    nodes: graphNodes,
    edges: graphEdges,
    stats: projectGraphStats(graphNodes, graphEdges),
    skipped: false
  };
}

function emptyProjectGraph(reason = "") {
  return {
    nodes: [],
    edges: [],
    stats: { nodeCount: 0, edgeCount: 0, nodeTypes: [], entityKinds: [], edgeTypes: [], edgeKinds: [] },
    skipped: Boolean(reason),
    reason
  };
}

function normalizeProjectGraphNode(node = {}) {
  if (!node || typeof node !== "object" || !node.id) return null;
  return {
    id: String(node.id),
    node_type: node.node_type || "topic",
    entity_kind: node.metadata?.entity_kind || node.node_type || "topic",
    label: node.label || node.id,
    normalized_label: node.normalized_label || "",
    source_table: node.source_table || null,
    source_id: node.source_id || null,
    event_date: node.event_date || null,
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {}
  };
}

function projectGraphRowMatches({ row, source, target, query }) {
  const haystack = [
    source.id, source.label, source.node_type, source.entity_kind, source.source_table, source.source_id,
    target.id, target.label, target.node_type, target.entity_kind, target.source_table, target.source_id,
    row.edge_type, row.metadata?.edge_kind, row.evidence_text
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function projectGraphNodeMatches({ node, query }) {
  const haystack = [
    node.id, node.label, node.node_type, node.entity_kind, node.source_table, node.source_id
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function projectGraphStats(nodes = [], edges = []) {
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypes: countBy(nodes, (node) => node.node_type),
    entityKinds: countBy(nodes, (node) => node.entity_kind || node.node_type),
    edgeTypes: countBy(edges, (edge) => edge.edge_type),
    edgeKinds: countBy(edges, (edge) => edge.edge_kind || edge.edge_type)
  };
}

function nodeMatchesType(node, selectedType) {
  return node.node_type === selectedType || node.entity_kind === selectedType || node.metadata?.entity_kind === selectedType;
}

function isNoisySourceNode(node = {}) {
  if (node.node_type !== "source") return false;
  if (node.entity_kind && node.entity_kind !== "source") return false;
  const label = String(node.label || node.id || "");
  return /^https?:\/\//i.test(label) || /^source:https?:/i.test(node.id || "");
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items || []) {
    const key = keyFn(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function graphSearchFallback({ config, payload = {}, limit = 30 }) {
  const refs = Array.isArray(payload.source_refs) ? payload.source_refs : [];
  const nodeIds = refs.map((ref) => ref.node_id).filter(Boolean);
  const sourcePairs = refs.filter((ref) => ref.source_table && ref.source_id);
  let sourceNodes = [];
  if (sourcePairs.length) {
    const or = sourcePairs
      .slice(0, 20)
      .map((ref) => `and(source_table.eq.${encodeURIComponent(ref.source_table)},source_id.eq.${encodeURIComponent(ref.source_id)})`)
      .join(",");
    sourceNodes = await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?select=id&or=(${or})&limit=50`).catch(() => []);
  }
  const ids = [...new Set([...nodeIds, ...(sourceNodes || []).map((node) => node.id)].filter(Boolean))];
  if (!ids.length) return [];
  const encoded = ids.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(",");
  const params = new URLSearchParams({
    select: "id,edge_type,weight,confidence,evidence_text,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
    or: `(from_node_id.in.(${encoded}),to_node_id.in.(${encoded}))`,
    order: "confidence.desc",
    limit: String(Math.min(Number(limit || 30), 200))
  });
  const rows = await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}`).catch(() => []);
  return (rows || []).map((row) => ({
    edge_id: row.id,
    edge_type: row.edge_type,
    weight: row.weight,
    confidence: row.confidence,
    evidence_text: row.evidence_text,
    source_node: row.from_node,
    target_node: row.to_node
  }));
}

function sanitizeTimelineEventLink(link = {}) {
  const payload = {
    source_event_source: link.source_event_source === "alerts" ? "alerts" : "index",
    source_event_id: requiredString(link.source_event_id, "source_event_id"),
    target_event_source: link.target_event_source === "alerts" ? "alerts" : "index",
    target_event_id: requiredString(link.target_event_id, "target_event_id"),
    relation_type: TIMELINE_RELATION_TYPES.includes(link.relation_type) ? link.relation_type : "related",
    source_date: nullableString(link.source_date),
    target_date: nullableString(link.target_date),
    source_title: nullableString(link.source_title),
    target_title: nullableString(link.target_title),
    approver: nullableString(link.approver),
    note: nullableString(link.note),
    created_by: nullableString(link.created_by)
  };
  if (payload.source_event_source === payload.target_event_source && payload.source_event_id === payload.target_event_id) {
    throw new Error("Cannot link an event to itself");
  }
  return payload;
}

function requiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function nullableString(value) {
  const text = String(value || "").trim();
  return text || null;
}

function nullableDate(value, label) {
  const text = nullableString(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !validIsoCalendarDate(text)) {
    throw new Error(`${label} must be a valid ISO date`);
  }
  return text;
}

function normalizeDelayStatus(value) {
  return enumValue(value, DELAY_HUMAN_STATUSES, "human_status", "candidate");
}

function enumValue(value, allowed, label, fallback = null) {
  const text = nullableString(value);
  if (!text) return fallback;
  if (!allowed.includes(text)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return text;
}

function boundedNumber(value, fallback, min, max) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`value must be a number between ${min} and ${max}`);
  }
  return number;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableKey(prefix, value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${prefix}_${normalized || Date.now()}`;
}

function sanitizeTimelineEntity(entity = {}) {
  return {
    id: requiredString(entity.id, "entity.id"),
    entity_type: nullableString(entity.entity_type) || "topic",
    name: requiredString(entity.name, "entity.name"),
    normalized_name: requiredString(entity.normalized_name || entity.name, "entity.normalized_name"),
    metadata: entity.metadata && typeof entity.metadata === "object" ? entity.metadata : {}
  };
}

function sanitizeTimelineEventEntity(item = {}) {
  return {
    event_source: item.event_source === "alerts" ? "alerts" : "index",
    event_id: requiredString(item.event_id, "event_id"),
    entity_id: requiredString(item.entity_id, "entity_id"),
    role: nullableString(item.role) || "mentioned",
    confidence: Number(item.confidence || 0.5),
    evidence_text: nullableString(item.evidence_text)
  };
}

function sanitizeGraphNode(node = {}) {
  return {
    id: requiredString(node.id, "node.id"),
    node_type: nullableString(node.node_type) || "topic",
    label: requiredString(node.label, "node.label"),
    normalized_label: requiredString(node.normalized_label || node.label, "node.normalized_label"),
    source_table: nullableString(node.source_table),
    source_id: nullableString(node.source_id),
    event_date: nullableString(node.event_date),
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {}
  };
}

function sanitizeGraphEdge(edge = {}) {
  return {
    from_node_id: requiredString(edge.from_node_id, "from_node_id"),
    to_node_id: requiredString(edge.to_node_id, "to_node_id"),
    edge_type: nullableString(edge.edge_type) || "related_to",
    weight: Number(edge.weight || 0.5),
    confidence: Number(edge.confidence || edge.weight || 0.5),
    evidence_text: nullableString(edge.evidence_text),
    metadata: edge.metadata && typeof edge.metadata === "object" ? edge.metadata : {}
  };
}

function uniqueByKey(items = [], keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function chunk(items = [], size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseHashtags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).replace(/^#+/, "")).filter(Boolean);
  return String(raw).match(/#[֐-׿\w]+/gu)?.map((t) => t.replace(/^#+/, "")) || [];
}

function localMessage({ userMessage, sanitizedMessage, sessionId }) {
  return {
    id: `local_${Date.now()}`,
    user_message: userMessage,
    sanitzed_user_message: sanitizedMessage,
    session_id: sessionId,
    status: "processing"
  };
}
