import { randomUUID } from "node:crypto";
import { supabaseHeaders } from "../config.js";
import { scheduleSupabaseConfig } from "../scheduleIngestion.js";
import { ACTIVITY_MAPPING_BLOCKER } from "./activityMapping.js";
import {
  CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  assertNoClientDatabaseOverrides,
  buildContractActivityMappingCandidatesFromSources,
  normalizeActivityMappingSourceProjectId
} from "./activityMappingService.js";
import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_ACTIVITY_MAPPING_REVIEW_VERSION = "contracts-activity-mapping-review.phase3.v1";
export const CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION = "contracts-activity-mapping-review-api.phase3f.v1";
export const CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION = "contracts-activity-mapping-history.phase3f.v1";
export const CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC = "bidoc_contracts_review_activity_mapping_v1";
export const CONTRACTS_ACTIVITY_MAPPING_HISTORY_RPC = "bidoc_contracts_list_activity_mapping_reviews_v1";
export const CONTRACTS_ACTIVITY_MAPPING_HISTORY_MIGRATION = "20260811214619";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DOCUMENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/iu;
const REVIEW_ACTIONS = new Set(["confirm", "reject", "correct", "unmapped"]);
const REVIEW_REQUEST_KEYS = new Set([
  "sourceProjectId",
  "obligation",
  "action",
  "selectedActivityKey",
  "reason",
  "reviewRequestId",
  "conflictResolved",
  "supersedesEventId"
]);
const CONFIRMABLE_BUNDLE_BLOCKERS = new Set([ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES]);
const CONFIRMABLE_CANDIDATE_BLOCKERS = new Set([
  ACTIVITY_MAPPING_BLOCKER.HUMAN_REVIEW_REQUIRED,
  ACTIVITY_MAPPING_BLOCKER.SUMMARY_ACTIVITY_REQUIRES_REVIEW
]);

function reviewError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw reviewError("contracts_activity_mapping_review_request_invalid", `${label} must be a JSON object.`);
  }
  return value;
}

function nonEmptyString(value, label, { min = 1, max = 2000 } = {}) {
  const normalized = String(value || "").trim();
  if (normalized.length < min || normalized.length > max) {
    throw reviewError(
      "contracts_activity_mapping_review_request_invalid",
      `${label} must contain between ${min} and ${max} characters.`
    );
  }
  return normalized;
}

function optionalUuid(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLocaleLowerCase("en");
  if (!UUID_PATTERN.test(normalized)) {
    throw reviewError("contracts_activity_mapping_review_request_invalid", `${label} must be a UUID or null.`);
  }
  return normalized;
}

function unexpectedKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key)).sort();
}

export function contractsActivityMappingReviewApproved(env = process.env) {
  return String(env.CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseActivityMappingReviewRequest({ headers = {}, query = null, body = null } = {}) {
  assertNoClientDatabaseOverrides({ headers, query, body });
  const request = plainObject(body, "The activity-mapping review request");
  const extraBody = unexpectedKeys(request, REVIEW_REQUEST_KEYS);
  const queryKeys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  if (extraBody.length || queryKeys.length) {
    const field = [...extraBody.map((key) => `body.${key}`), ...queryKeys.map((key) => `query.${key}`)].sort()[0];
    throw reviewError(
      "contracts_activity_mapping_review_field_unsupported",
      `Unsupported activity-mapping review field: ${field}.`
    );
  }
  const action = String(request.action || "").trim();
  if (!REVIEW_ACTIONS.has(action)) {
    throw reviewError(
      "contracts_activity_mapping_review_action_invalid",
      "action must be one of: confirm, reject, correct, unmapped."
    );
  }
  const reviewRequestId = optionalUuid(request.reviewRequestId, "reviewRequestId");
  if (!reviewRequestId) {
    throw reviewError("contracts_activity_mapping_review_request_invalid", "reviewRequestId is required for idempotency.");
  }
  const selectedActivityKey = request.selectedActivityKey === null || request.selectedActivityKey === undefined
    ? null
    : nonEmptyString(request.selectedActivityKey, "selectedActivityKey", { max: 500 });
  const supersedesEventId = optionalUuid(request.supersedesEventId, "supersedesEventId");
  if (["confirm", "correct"].includes(action) && !selectedActivityKey) {
    throw reviewError("contracts_activity_mapping_review_selection_required", `${action} requires a selected activity candidate.`, 409);
  }
  if (["reject", "unmapped"].includes(action) && selectedActivityKey) {
    throw reviewError("contracts_activity_mapping_review_selection_forbidden", `${action} cannot select an activity.`, 409);
  }
  if (action === "correct" && !supersedesEventId) {
    throw reviewError("contracts_activity_mapping_review_supersession_required", "A correction must supersede an immutable review event.", 409);
  }
  if (action !== "correct" && supersedesEventId) {
    throw reviewError("contracts_activity_mapping_review_supersession_forbidden", "Only a correction may supersede an earlier event.", 409);
  }
  if (request.conflictResolved !== undefined && typeof request.conflictResolved !== "boolean") {
    throw reviewError("contracts_activity_mapping_review_request_invalid", "conflictResolved must be a boolean when provided.");
  }
  return {
    sourceProjectId: normalizeActivityMappingSourceProjectId(request.sourceProjectId),
    obligation: plainObject(request.obligation, "obligation"),
    action,
    selectedActivityKey,
    reason: nonEmptyString(request.reason, "reason", { min: 10, max: 2000 }),
    reviewRequestId,
    conflictResolved: request.conflictResolved === true,
    supersedesEventId
  };
}

export function parseActivityMappingHistoryRequest({ headers = {}, query = null } = {}) {
  assertNoClientDatabaseOverrides({ headers, query });
  const allowed = new Set(["sourceProjectId", "documentVersionId", "candidateKey", "limit"]);
  const keys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  const unsupported = keys.filter((key) => !allowed.has(key));
  if (unsupported.length) {
    throw reviewError(
      "contracts_activity_mapping_history_field_unsupported",
      `Unsupported activity-mapping history field: ${unsupported.sort()[0]}.`
    );
  }
  const get = (key) => query instanceof URLSearchParams ? query.get(key) : query?.[key];
  const documentVersionIdInput = get("documentVersionId");
  const documentVersionId = documentVersionIdInput === null || documentVersionIdInput === undefined || documentVersionIdInput === ""
    ? null
    : String(documentVersionIdInput).trim().toLocaleLowerCase("en");
  if (documentVersionId !== null && !DOCUMENT_VERSION_PATTERN.test(documentVersionId)) {
    throw reviewError("contracts_activity_mapping_history_filter_invalid", "documentVersionId must use sha256:<64 hex> format.");
  }
  const candidateKeyInput = get("candidateKey");
  const candidateKey = candidateKeyInput === null || candidateKeyInput === undefined || candidateKeyInput === ""
    ? null
    : nonEmptyString(candidateKeyInput, "candidateKey", { max: 500 });
  const limitInput = get("limit");
  const limit = limitInput === null || limitInput === undefined || limitInput === "" ? 50 : Number(limitInput);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw reviewError("contracts_activity_mapping_history_filter_invalid", "limit must be an integer between 1 and 100.");
  }
  return {
    sourceProjectId: normalizeActivityMappingSourceProjectId(get("sourceProjectId")),
    documentVersionId,
    candidateKey,
    limit
  };
}

async function activityMappingRpc({
  config,
  rpc,
  body,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  operation
}) {
  const connection = scheduleSupabaseConfig(config, "app_data");
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
    throw reviewError(
      "contracts_activity_mapping_review_database_missing",
      "APP DATA/KAPAIM is not configured for Contracts activity-mapping review.",
      503
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS));
  let response;
  try {
    response = await fetchImpl(
      `${String(connection.supabaseUrl).replace(/\/+$/u, "")}/rest/v1/rpc/${rpc}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: supabaseHeaders(connection.supabaseServiceRoleKey),
        body: JSON.stringify(body)
      }
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw reviewError(
      timedOut ? `contracts_activity_mapping_${operation}_timeout` : `contracts_activity_mapping_${operation}_transport_failed`,
      timedOut ? `The activity-mapping ${operation} request timed out.` : `The activity-mapping ${operation} request failed.`,
      timedOut ? 504 : 502,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let result = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch (error) {
    throw reviewError(
      `contracts_activity_mapping_${operation}_response_invalid`,
      `The activity-mapping ${operation} RPC returned invalid JSON.`,
      502,
      error
    );
  }
  if (Array.isArray(result) && result.length === 1) result = result[0];
  if (!response.ok) {
    const databaseCode = String(result?.code || "");
    const missingRpc = response.status === 404 || ["PGRST202", "42883"].includes(databaseCode);
    const conflict = ["23503", "23505"].includes(databaseCode);
    throw reviewError(
      missingRpc
        ? `contracts_activity_mapping_${operation}_migration_missing`
        : conflict
          ? `contracts_activity_mapping_${operation}_conflict`
          : `contracts_activity_mapping_${operation}_rpc_failed`,
      missingRpc
        ? `The approved activity-mapping ${operation} RPC is unavailable in APP DATA/KAPAIM.`
        : String(result?.message || result?.hint || `Activity-mapping ${operation} failed with status ${response.status}.`).slice(0, 1000),
      missingRpc ? 503 : conflict ? 409 : response.status >= 500 ? 502 : 400
    );
  }
  return result;
}

function contractEvidence(candidateBundle, selectedCandidate) {
  const evidence = (candidateBundle.obligation?.sourceEvidence || []).map((item) => ({
    kind: "contract_source",
    evidenceId: item.evidenceId,
    sourceText: item.sourceText,
    pdfPage: item.pdfPage,
    clause: item.clause
  }));
  for (const item of selectedCandidate?.evidence || []) {
    evidence.push({ kind: item.kind, detail: item.detail, scoreDelta: item.scoreDelta });
  }
  return evidence;
}

function assertConfirmable(candidateBundle, selectedCandidate, conflictResolved) {
  const bundleBlockers = (candidateBundle.blockers || []).filter((blocker) => !CONFIRMABLE_BUNDLE_BLOCKERS.has(blocker));
  const candidateBlockers = (selectedCandidate.blockers || []).filter((blocker) => !CONFIRMABLE_CANDIDATE_BLOCKERS.has(blocker));
  if (bundleBlockers.length || candidateBlockers.length) {
    throw reviewError(
      "contracts_activity_mapping_review_blocked",
      `The selected mapping remains blocked: ${[...new Set([...bundleBlockers, ...candidateBlockers])].sort().join(", ")}.`,
      409
    );
  }
  if (candidateBundle.conflict && conflictResolved !== true) {
    throw reviewError(
      "contracts_activity_mapping_review_conflict_unresolved",
      "The mapping conflict must be explicitly resolved before confirmation or correction.",
      409
    );
  }
}

export async function listActivityMappingReviewHistory({
  config,
  sourceProjectId,
  documentVersionId = null,
  candidateKey = null,
  limit = 50,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS
} = {}) {
  const normalizedSourceProjectId = normalizeActivityMappingSourceProjectId(sourceProjectId);
  const result = await activityMappingRpc({
    config,
    rpc: CONTRACTS_ACTIVITY_MAPPING_HISTORY_RPC,
    body: {
      p_source_project_id: normalizedSourceProjectId,
      p_document_version_id: documentVersionId,
      p_candidate_key: candidateKey,
      p_limit: limit
    },
    fetchImpl,
    timeoutMs,
    operation: "history"
  });
  if (
    !result
    || result.historyVersion !== CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION
    || result.projectContext?.sourceProjectId !== normalizedSourceProjectId
    || !Array.isArray(result.events)
  ) {
    throw reviewError(
      "contracts_activity_mapping_history_response_invalid",
      "The activity-mapping history RPC returned an unsupported response.",
      502
    );
  }
  return {
    ...result,
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
    operationalWritesPerformed: false
  };
}

export async function prepareActivityMappingReviewSubmission({
  config,
  request,
  reviewerId,
  fetchImpl = fetch,
  loadScheduleSourceImpl,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  nowImpl = () => new Date(),
  historyLoader = listActivityMappingReviewHistory
} = {}) {
  const reviewer = optionalUuid(reviewerId, "reviewerId");
  if (!reviewer) {
    throw reviewError("contracts_activity_mapping_reviewer_required", "An authenticated reviewer identity is required.", 403);
  }
  const parsed = parseActivityMappingReviewRequest({ body: request });
  const generated = await buildContractActivityMappingCandidatesFromSources({
    config,
    sourceProjectId: parsed.sourceProjectId,
    obligation: parsed.obligation,
    fetchImpl,
    loadScheduleSourceImpl,
    timeoutMs
  });
  const candidateBundle = generated.candidateBundle;
  if (candidateBundle.scheduleVersion.versionConflict) {
    throw reviewError(
      "contracts_activity_mapping_review_version_conflict",
      "An ambiguous Schedule version cannot be reviewed into mapping state.",
      409
    );
  }
  const selectedCandidate = parsed.selectedActivityKey
    ? candidateBundle.candidates.find((candidate) => candidate.activityKey === parsed.selectedActivityKey) || null
    : null;
  if (["confirm", "correct"].includes(parsed.action) && !selectedCandidate) {
    throw reviewError(
      "contracts_activity_mapping_review_selection_stale",
      "The selected activity is not present exactly once in the current server-generated alternatives.",
      409
    );
  }
  if (["confirm", "correct"].includes(parsed.action)) {
    assertConfirmable(candidateBundle, selectedCandidate, parsed.conflictResolved);
  }
  if (parsed.action === "reject" && candidateBundle.candidates.length === 0) {
    throw reviewError(
      "contracts_activity_mapping_review_reject_without_alternative",
      "Reject requires at least one preserved alternative; use unmapped when no alternative exists.",
      409
    );
  }

  let supersededEvent = null;
  if (parsed.action === "correct") {
    const history = await historyLoader({
      config,
      sourceProjectId: parsed.sourceProjectId,
      documentVersionId: candidateBundle.obligation.documentVersionId,
      candidateKey: candidateBundle.obligation.candidateKey,
      limit: 100,
      fetchImpl,
      timeoutMs
    });
    supersededEvent = history.events.find((event) => event.eventId === parsed.supersedesEventId) || null;
    if (!supersededEvent?.selectedCanonicalKey) {
      throw reviewError(
        "contracts_activity_mapping_review_supersession_invalid",
        "The superseded review event does not identify an existing canonical activity for this obligation.",
        409
      );
    }
  }

  const reviewedAtValue = nowImpl();
  const reviewedAt = reviewedAtValue instanceof Date ? reviewedAtValue.toISOString() : new Date(reviewedAtValue).toISOString();
  const confidence = selectedCandidate?.confidence
    ?? candidateBundle.candidates[0]?.confidence
    ?? 0;
  const evidence = contractEvidence(candidateBundle, selectedCandidate || candidateBundle.candidates[0] || null);
  if (!evidence.length) {
    throw reviewError(
      "contracts_activity_mapping_review_evidence_required",
      "An immutable mapping review requires source evidence.",
      409
    );
  }
  const canonicalKey = parsed.action === "correct"
    ? supersededEvent.selectedCanonicalKey
    : selectedCandidate?.canonicalKey ?? null;
  const submission = {
    submissionVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_VERSION,
    eventKey: `activity-mapping-review:${parsed.reviewRequestId}`,
    projectContext: candidateBundle.projectContext,
    obligation: {
      documentVersionId: candidateBundle.obligation.documentVersionId,
      candidateKey: candidateBundle.obligation.candidateKey,
      milestoneKey: candidateBundle.obligation.milestoneKey
    },
    scheduleVersion: candidateBundle.scheduleVersion,
    decision: {
      action: parsed.action,
      canonicalKey,
      activityKey: selectedCandidate?.activityKey ?? null,
      previousActivityKey: null,
      taskUid: selectedCandidate?.taskUid ?? null,
      matchMethod: null,
      confidence,
      alternatives: candidateBundle.candidates,
      evidence,
      conflict: candidateBundle.conflict,
      conflictResolved: parsed.conflictResolved,
      reviewerId: reviewer,
      reviewedAt,
      reason: parsed.reason,
      supersedesEventId: parsed.supersedesEventId
    }
  };
  return {
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
    candidateBundle,
    submission,
    operationalWritesPerformed: false
  };
}

export async function submitActivityMappingReview({
  config,
  request,
  reviewerId,
  reviewApplyApproved = false,
  fetchImpl = fetch,
  loadScheduleSourceImpl,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  nowImpl,
  historyLoader,
  idFactory = randomUUID
} = {}) {
  if (reviewApplyApproved !== true) {
    throw reviewError(
      "contracts_activity_mapping_review_apply_not_approved",
      "Activity-mapping review writes are disabled by the server-only Phase 3F activation gate.",
      503
    );
  }
  const requestWithId = request?.reviewRequestId
    ? request
    : { ...request, reviewRequestId: idFactory() };
  const prepared = await prepareActivityMappingReviewSubmission({
    config,
    request: requestWithId,
    reviewerId,
    fetchImpl,
    loadScheduleSourceImpl,
    timeoutMs,
    nowImpl,
    historyLoader
  });
  const result = await activityMappingRpc({
    config,
    rpc: CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC,
    body: { p_submission: prepared.submission },
    fetchImpl,
    timeoutMs,
    operation: "review"
  });
  if (
    !result
    || result.status !== "recorded"
    || result.eventKey !== prepared.submission.eventKey
    || result.action !== prepared.submission.decision.action
  ) {
    throw reviewError(
      "contracts_activity_mapping_review_response_invalid",
      "The activity-mapping review RPC returned an unsupported result.",
      502
    );
  }
  const mappingRowsChanged = Number(result.mappingRowsChanged || 0);
  return {
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
    status: "recorded",
    result,
    candidateBundle: prepared.candidateBundle,
    auditWritePerformed: true,
    operationalWritesPerformed: mappingRowsChanged > 0
  };
}

/**
 * Internal Phase 3G transport for a server-built automatic-continuation
 * submission. No browser field is accepted here: the orchestration layer owns
 * the authoritative versions, aliases, evidence, clock, and idempotency key.
 */
export async function submitActivityMappingAutoContinuation({
  config,
  submission,
  reconciliationApplyApproved = false,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS
} = {}) {
  if (reconciliationApplyApproved !== true) {
    throw reviewError(
      "contracts_activity_mapping_reconciliation_apply_not_approved",
      "Upload reconciliation writes are disabled by the server-only Phase 3G activation gate.",
      503
    );
  }
  const value = plainObject(submission, "The server-owned automatic-continuation submission");
  const decision = plainObject(value.decision, "submission.decision");
  const scheduleVersion = plainObject(value.scheduleVersion, "submission.scheduleVersion");
  const eventKey = nonEmptyString(value.eventKey, "submission.eventKey", { min: 3, max: 200 });
  const taskUid = Number(decision.taskUid);
  const confidence = Number(decision.confidence);
  const selectedCount = Array.isArray(decision.alternatives)
    ? decision.alternatives.filter((alternative) => alternative?.activityKey === decision.activityKey).length
    : 0;
  const reviewedAt = new Date(decision.reviewedAt);
  if (
    value.submissionVersion !== CONTRACTS_ACTIVITY_MAPPING_REVIEW_VERSION
    || decision.action !== "auto_continue"
    || decision.reviewerId !== null
    || decision.supersedesEventId !== null
    || decision.matchMethod !== "exact_uid_continuity"
    || !Number.isInteger(taskUid)
    || taskUid < 0
    || !Number.isFinite(confidence)
    || confidence < 0.95
    || confidence > 1
    || !String(decision.previousActivityKey || "").trim()
    || decision.previousActivityKey === decision.activityKey
    || decision.activityKey !== `gantt:${scheduleVersion.fileId}:${taskUid}`
    || scheduleVersion.versionConflict !== false
    || selectedCount !== 1
    || !Array.isArray(decision.evidence)
    || decision.evidence.length === 0
    || decision.conflict !== null
    || Number.isNaN(reviewedAt.getTime())
  ) {
    throw reviewError(
      "contracts_activity_mapping_reconciliation_submission_invalid",
      "The server-owned automatic-continuation submission is incomplete or unsafe.",
      409
    );
  }
  const result = await activityMappingRpc({
    config,
    rpc: CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC,
    body: { p_submission: value },
    fetchImpl,
    timeoutMs,
    operation: "reconciliation"
  });
  if (
    !result
    || result.status !== "recorded"
    || result.eventKey !== eventKey
    || result.action !== "auto_continue"
    || result.canonicalKey !== decision.canonicalKey
  ) {
    throw reviewError(
      "contracts_activity_mapping_reconciliation_response_invalid",
      "The activity-mapping review RPC returned an unsupported automatic-continuation result.",
      502
    );
  }
  const mappingRowsChanged = Number(result.mappingRowsChanged || 0);
  return {
    status: "recorded",
    result,
    auditWritePerformed: true,
    operationalWritesPerformed: mappingRowsChanged > 0
  };
}
