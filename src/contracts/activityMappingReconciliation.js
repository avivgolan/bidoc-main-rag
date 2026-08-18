import { createHash } from "node:crypto";
import {
  ACTIVITY_MAPPING_ALIAS_SOURCE,
  ACTIVITY_MAPPING_METHOD,
  ACTIVITY_MAPPING_STATUS,
  reconcileConfirmedActivityAliases
} from "./activityMapping.js";
import {
  CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  assertNoClientDatabaseOverrides,
  loadContractActivityMappingState,
  normalizeActivityMappingSourceProjectId
} from "./activityMappingService.js";
import {
  CONTRACTS_ACTIVITY_MAPPING_REVIEW_VERSION,
  listActivityMappingReviewHistory,
  submitActivityMappingAutoContinuation
} from "./activityMappingReview.js";
import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_API_VERSION =
  "contracts-activity-mapping-reconciliation.phase3g.v1";
export const CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_HISTORY_LIMIT = 100;

const CONFIRMED_STATUSES = new Set([
  ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED,
  ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED
]);
const CONFIRMED_ACTIONS = new Set(["confirm", "correct", "auto_continue"]);
const DOCUMENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const AUTHORITATIVE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

function reconciliationError(code, message, status = 409, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_request_invalid",
      `${label} must be a JSON object.`,
      400
    );
  }
  return value;
}

function sameInstant(left, right) {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function currentStatus(value) {
  return CONFIRMED_STATUSES.has(value);
}

function validAuthoritativeDate(value) {
  if (typeof value !== "string") return false;
  const match = value.match(AUTHORITATIVE_DATE_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function mapperMapping(mapping) {
  return {
    canonicalKey: mapping.canonicalKey,
    alias: mapping.alias,
    aliasSource: mapping.aliasSource,
    matchMethod: mapping.matchMethod,
    confidence: mapping.confidence,
    status: mapping.status
  };
}

function ensureAuthoritativeState(state, sourceProjectId) {
  const value = plainObject(state, "The authoritative mapping state");
  if (
    value.operationalWritesPerformed !== false
    || value.projectContext?.sourceSystem !== "main"
    || value.projectContext?.sourceProjectId !== sourceProjectId
    || value.projectContext?.mappingStatus !== "active"
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_context_invalid",
      "The server-owned MAIN-to-KAPAIM mapping context is missing or inconsistent.",
      502
    );
  }
  const currentVersion = plainObject(value.scheduleVersion, "scheduleVersion");
  const previousVersion = value.previousScheduleVersion;
  if (!previousVersion || typeof previousVersion !== "object" || Array.isArray(previousVersion)) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_previous_version_missing",
      "Upload reconciliation requires one authoritative previous Schedule version.",
      409
    );
  }
  if (
    !String(currentVersion.fileId || "").trim()
    || !String(previousVersion.fileId || "").trim()
    || currentVersion.fileId === previousVersion.fileId
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_versions_invalid",
      "The authoritative current and previous Schedule versions are invalid.",
      502
    );
  }
  if (currentVersion.versionConflict !== false || previousVersion.versionConflict !== false) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_version_ambiguous",
      "Upload reconciliation is blocked because current or previous Schedule version selection is ambiguous.",
      409
    );
  }
  const currentRelevancyTime = new Date(currentVersion.relevancyDate).getTime();
  const previousRelevancyTime = new Date(previousVersion.relevancyDate).getTime();
  if (
    !String(currentVersion.relevancyDate || "").trim()
    || !String(previousVersion.relevancyDate || "").trim()
    || !Number.isFinite(currentRelevancyTime)
    || !Number.isFinite(previousRelevancyTime)
    || currentRelevancyTime <= previousRelevancyTime
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_version_dates_invalid",
      "Upload reconciliation requires two distinct authoritative relevance dates in chronological order.",
      409
    );
  }
  const currentTasks = Array.isArray(value.activities) ? value.activities : null;
  const previousTasks = Array.isArray(value.previousActivities) ? value.previousActivities : null;
  const mappings = Array.isArray(value.existingMappings) ? value.existingMappings : null;
  const sourceVersions = Array.isArray(value.sourceVersions) ? value.sourceVersions : null;
  if (!currentTasks || !previousTasks || !mappings || !sourceVersions) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_state_invalid",
      "The authoritative task or mapping collections are invalid.",
      502
    );
  }
  const completeness = value.sourceCompleteness || {};
  const completeCount = (declared, loaded, actual) => (
    Number.isInteger(declared)
    && declared >= 0
    && Number.isInteger(loaded)
    && loaded === declared
    && actual === loaded
  );
  if (
    !Number.isInteger(completeness.versionDeclaredCount)
    || completeness.versionDeclaredCount < 2
    || !Number.isInteger(completeness.versionRowsLoaded)
    || completeness.versionRowsLoaded < 2
    || completeness.versionRowsLoaded !== completeness.versionDeclaredCount
    || sourceVersions.length !== completeness.versionRowsLoaded
    || completeness.currentVersionSelectionMatches !== true
    || !Number.isInteger(completeness.mappingDeclaredCount)
    || completeness.mappingDeclaredCount < 0
    || !Number.isInteger(completeness.mappingLoadedCount)
    || completeness.mappingLoadedCount !== mappings.length
    || completeness.mappingDeclaredCount !== completeness.mappingLoadedCount
    || !completeCount(
      completeness.currentDeclaredTaskCount,
      completeness.currentLoadedTaskCount,
      currentTasks.length
    )
    || completeness.currentExactTaskCount !== completeness.currentLoadedTaskCount
    || !completeCount(
      completeness.previousDeclaredTaskCount,
      completeness.previousLoadedTaskCount,
      previousTasks.length
    )
    || completeness.previousExactTaskCount !== completeness.previousLoadedTaskCount
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_source_incomplete",
      "The authoritative MAIN version or task read is incomplete or inconsistent.",
      409
    );
  }
  const sourceVersionIds = new Set();
  const normalizedSourceVersions = [];
  for (const sourceVersion of sourceVersions) {
    const fileId = typeof sourceVersion?.fileId === "string" ? sourceVersion.fileId.trim() : "";
    const projectId = typeof sourceVersion?.projectId === "string"
      ? sourceVersion.projectId.trim().toLocaleLowerCase("en")
      : "";
    const relevancyDate = sourceVersion?.relevancyDate;
    if (
      !fileId
      || projectId !== sourceProjectId
      || !validAuthoritativeDate(relevancyDate)
      || sourceVersionIds.has(fileId)
    ) {
      throw reconciliationError(
        "contracts_activity_mapping_reconciliation_source_file_invalid",
        "Every authoritative MAIN Gantt file row must have one unique file identity, the requested project identity, and a valid relevance date.",
        409
      );
    }
    sourceVersionIds.add(fileId);
    normalizedSourceVersions.push({ fileId, projectId, relevancyDate });
  }
  const currentSourceVersion = normalizedSourceVersions.find((version) => version.fileId === currentVersion.fileId);
  const previousSourceVersion = normalizedSourceVersions.find((version) => version.fileId === previousVersion.fileId);
  if (
    !currentSourceVersion
    || !previousSourceVersion
    || currentSourceVersion.relevancyDate !== currentVersion.relevancyDate
    || previousSourceVersion.relevancyDate !== previousVersion.relevancyDate
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_source_file_invalid",
      "The selected current or previous Schedule version does not match the complete authoritative MAIN file set.",
      409
    );
  }
  if (
    currentTasks.some((task) => task?.sourceVersionId !== currentVersion.fileId)
    || previousTasks.some((task) => task?.sourceVersionId !== previousVersion.fileId)
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_source_mismatch",
      "A MAIN task does not belong to the authoritative Schedule version selected by the server.",
      409
    );
  }
  const duplicateIdentity = (tasks) => {
    const uids = new Set();
    const activityKeys = new Set();
    for (const task of tasks) {
      if (
        !Number.isInteger(task?.taskUid)
        || task.taskUid < 0
        || !String(task.activityKey || "").trim()
        || uids.has(task.taskUid)
        || activityKeys.has(task.activityKey)
      ) return true;
      uids.add(task.taskUid);
      activityKeys.add(task.activityKey);
    }
    return false;
  };
  if (duplicateIdentity(currentTasks) || duplicateIdentity(previousTasks)) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_source_identity_ambiguous",
      "Every task UID and activity key must be unique within both authoritative MAIN versions.",
      409
    );
  }
  return {
    ...value,
    scheduleVersion: currentVersion,
    previousScheduleVersion: previousVersion,
    sourceVersions: normalizedSourceVersions,
    activities: currentTasks,
    previousActivities: previousTasks,
    existingMappings: mappings
  };
}

function ensureCompleteHistory(history, state) {
  const value = plainObject(history, "The immutable mapping history");
  const total = Number(value.total);
  const returned = Number(value.returned);
  if (
    value.operationalWritesPerformed !== false
    || value.projectContext?.sourceProjectId !== state.projectContext.sourceProjectId
    || value.projectContext?.scheduleProjectId !== state.projectContext.scheduleProjectId
    || value.projectContext?.projectMappingId !== state.projectContext.projectMappingId
    || value.projectContext?.mappingStatus !== "active"
    || !Number.isInteger(total)
    || total < 0
    || !Number.isInteger(returned)
    || returned < 0
    || !Array.isArray(value.events)
    || returned !== value.events.length
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_history_invalid",
      "The immutable KAPAIM mapping history response is inconsistent.",
      502
    );
  }
  if (
    total !== returned
    || total > CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_HISTORY_LIMIT
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_history_truncated",
      "Upload reconciliation is blocked because the immutable mapping history is incomplete or truncated.",
      409
    );
  }
  const eventIds = new Set();
  const eventKeys = new Set();
  for (const event of value.events) {
    if (
      !event
      || typeof event !== "object"
      || Array.isArray(event)
      || !String(event.eventId || "").trim()
      || !String(event.eventKey || "").trim()
      || eventIds.has(event.eventId)
      || eventKeys.has(event.eventKey)
    ) {
      throw reconciliationError(
        "contracts_activity_mapping_reconciliation_history_ambiguous",
        "Upload reconciliation is blocked by duplicate or malformed immutable history identities.",
        409
      );
    }
    eventIds.add(event.eventId);
    eventKeys.add(event.eventKey);
  }
  return value;
}

function matchingAuthoritativeEvent({ history, mapping, scheduleVersionId }) {
  const candidates = history.events.filter((event) => (
    event.selectedMappingId === mapping.mappingId
    && event.selectedCanonicalKey === mapping.canonicalKey
    && event.selectedActivityKey === mapping.alias
    && event.scheduleVersionId === scheduleVersionId
    && event.mappingStatus === mapping.status
    && CONFIRMED_ACTIONS.has(event.action)
    && sameInstant(event.reviewedAt, mapping.confirmedAt)
  ));
  if (candidates.length !== 1) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_history_ambiguous",
      "A confirmed Gantt alias does not have exactly one matching immutable current-state event.",
      409
    );
  }
  const event = candidates[0];
  const confidence = Number(event.confidence);
  const reviewerSemanticsValid = event.action === "auto_continue"
    ? event.reviewerId === null
    : typeof event.reviewerId === "string" && event.reviewerId.length > 0;
  if (
    !DOCUMENT_VERSION_PATTERN.test(String(event.documentVersionId || ""))
    || !String(event.candidateKey || "").trim()
    || !Array.isArray(event.evidence)
    || event.evidence.length === 0
    || !Number.isFinite(confidence)
    || Math.abs(confidence - Number(mapping.confidence)) > 1e-9
    || !reviewerSemanticsValid
    || event.result?.status !== "recorded"
    || event.result?.eventKey !== event.eventKey
    || event.result?.action !== event.action
    || event.result?.canonicalKey !== mapping.canonicalKey
  ) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_history_invalid",
      "The immutable event for a confirmed Gantt alias is incomplete or inconsistent.",
      409
    );
  }
  return event;
}

function confirmedGanttMapping(state, canonicalKey, activityKey) {
  const mappings = state.existingMappings.filter((mapping) => (
    mapping.canonicalKey === canonicalKey
    && mapping.alias === activityKey
    && mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY
    && currentStatus(mapping.status)
  ));
  if (mappings.length > 1) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_mapping_ambiguous",
      "More than one confirmed KAPAIM mapping row owns the same Gantt alias.",
      409
    );
  }
  return mappings[0] || null;
}

function ensureContractRelationship(state, event) {
  const relationships = state.existingMappings.filter((mapping) => (
    mapping.canonicalKey === event.selectedCanonicalKey
    && mapping.alias === event.candidateKey
    && mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.CONTRACTS_CANDIDATE
    && mapping.status === ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED
  ));
  if (relationships.length !== 1) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_contract_link_invalid",
      "Automatic continuation lacks one authoritative confirmed contract relationship in KAPAIM.",
      409
    );
  }
}

function deterministicEventKey({ state, reconciliation, sourceEvent }) {
  const identity = [
    CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_API_VERSION,
    state.projectContext.sourceProjectId,
    state.projectContext.scheduleProjectId,
    state.projectContext.projectMappingId,
    state.previousScheduleVersion.fileId,
    state.scheduleVersion.fileId,
    reconciliation.canonicalKey,
    reconciliation.previousActivityKey,
    reconciliation.currentActivityKey,
    sourceEvent.documentVersionId,
    sourceEvent.candidateKey
  ].join("\n");
  return `activity-mapping-auto-continue:${createHash("sha256").update(identity).digest("hex")}`;
}

function buildOperation({ state, history, reconciliation }) {
  const previousMapping = confirmedGanttMapping(
    state,
    reconciliation.canonicalKey,
    reconciliation.previousActivityKey
  );
  if (!previousMapping) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_previous_mapping_missing",
      "The pure reconciliation result does not match one confirmed previous-version KAPAIM alias.",
      409
    );
  }
  const sourceEvent = matchingAuthoritativeEvent({
    history,
    mapping: previousMapping,
    scheduleVersionId: state.previousScheduleVersion.fileId
  });
  ensureContractRelationship(state, sourceEvent);
  const currentTasks = state.activities.filter((task) => task.activityKey === reconciliation.currentActivityKey);
  if (currentTasks.length !== 1) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_current_task_ambiguous",
      "The exact continuation target does not identify one authoritative current MAIN task.",
      409
    );
  }
  const eventKey = deterministicEventKey({ state, reconciliation, sourceEvent });
  const currentMapping = confirmedGanttMapping(
    state,
    reconciliation.canonicalKey,
    reconciliation.currentActivityKey
  );
  let alreadyRecorded = false;
  let recordedEventKey = null;
  let recordedEvent = null;
  if (currentMapping) {
    const currentEvent = matchingAuthoritativeEvent({
      history,
      mapping: currentMapping,
      scheduleVersionId: state.scheduleVersion.fileId
    });
    alreadyRecorded = true;
    recordedEventKey = currentEvent.eventKey;
    recordedEvent = currentEvent;
  }
  const currentHumanDecisions = history.events.filter((event) => (
    event.scheduleVersionId === state.scheduleVersion.fileId
    && event.documentVersionId === sourceEvent.documentVersionId
    && event.candidateKey === sourceEvent.candidateKey
    && ["confirm", "correct", "reject", "unmapped"].includes(event.action)
  ));
  const preservingCurrentHumanMapping = Boolean(
    currentMapping?.status === ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED
    && currentHumanDecisions.length === 1
    && currentHumanDecisions[0].eventId === recordedEvent?.eventId
  );
  if (currentHumanDecisions.length > 0 && !preservingCurrentHumanMapping) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_human_decision_exists",
      "A human current-version decision already exists for this contract obligation.",
      409
    );
  }
  return {
    eventKey,
    recordedEventKey,
    recordedEvent,
    alreadyRecorded,
    reconciliation,
    sourceEvent,
    currentTask: currentTasks[0]
  };
}

async function buildReconciliationPlan({
  config,
  sourceProjectId,
  fetchImpl,
  timeoutMs,
  loadStateImpl,
  historyLoader
}) {
  const normalizedSourceProjectId = normalizeActivityMappingSourceProjectId(sourceProjectId);
  const state = ensureAuthoritativeState(await loadStateImpl({
    config,
    sourceProjectId: normalizedSourceProjectId,
    fetchImpl,
    timeoutMs,
    includePreviousVersion: true
  }), normalizedSourceProjectId);
  const history = ensureCompleteHistory(await historyLoader({
    config,
    sourceProjectId: normalizedSourceProjectId,
    documentVersionId: null,
    candidateKey: null,
    limit: CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_HISTORY_LIMIT,
    fetchImpl,
    timeoutMs
  }), state);
  const reconciliationBundle = reconcileConfirmedActivityAliases({
    projectContext: state.projectContext,
    previousScheduleVersion: state.previousScheduleVersion,
    scheduleVersion: state.scheduleVersion,
    previousTasks: state.previousActivities,
    currentTasks: state.activities,
    existingMappings: state.existingMappings.map(mapperMapping)
  });
  const operations = reconciliationBundle.reconciliations
    .filter((item) => item.status === ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED)
    .map((reconciliation) => buildOperation({ state, history, reconciliation }));
  const hasAmbiguity = reconciliationBundle.blockers.length > 0
    || reconciliationBundle.conflictCount > 0;
  return { state, history, reconciliationBundle, operations, hasAmbiguity };
}

function publicPlan(plan) {
  const pendingOperations = plan.operations.filter((operation) => !operation.alreadyRecorded);
  return {
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_API_VERSION,
    mode: "preview",
    projectContext: plan.state.projectContext,
    previousScheduleVersion: plan.state.previousScheduleVersion,
    scheduleVersion: plan.state.scheduleVersion,
    sourceCounts: {
      previousActivities: plan.state.previousActivities.length,
      currentActivities: plan.state.activities.length,
      mappings: plan.state.existingMappings.length,
      immutableHistoryEvents: plan.history.events.length
    },
    summary: {
      ...plan.reconciliationBundle.summary,
      plannedAutomaticContinuations: plan.operations.length,
      pendingAutomaticContinuations: pendingOperations.length,
      alreadyRecorded: plan.operations.length - pendingOperations.length
    },
    blockers: plan.reconciliationBundle.blockers,
    reconciliations: plan.reconciliationBundle.reconciliations,
    operations: plan.operations.map((operation) => ({
      eventKey: operation.eventKey,
      recordedEventKey: operation.recordedEventKey,
      alreadyRecorded: operation.alreadyRecorded,
      canonicalKey: operation.reconciliation.canonicalKey,
      previousActivityKey: operation.reconciliation.previousActivityKey,
      currentActivityKey: operation.reconciliation.currentActivityKey,
      taskUid: operation.reconciliation.taskUid,
      confidence: operation.reconciliation.confidence,
      documentVersionId: operation.sourceEvent.documentVersionId,
      candidateKey: operation.sourceEvent.candidateKey
    })),
    canApply: !plan.hasAmbiguity,
    auditWritePerformed: false,
    operationalWritesPerformed: false
  };
}

function buildSubmission(plan, operation, reviewedAt) {
  const reconciliation = operation.reconciliation;
  const task = operation.currentTask;
  return {
    submissionVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_VERSION,
    eventKey: operation.eventKey,
    projectContext: plan.state.projectContext,
    obligation: {
      documentVersionId: operation.sourceEvent.documentVersionId,
      candidateKey: operation.sourceEvent.candidateKey,
      milestoneKey: operation.sourceEvent.milestoneKey ?? null
    },
    scheduleVersion: plan.state.scheduleVersion,
    decision: {
      action: "auto_continue",
      canonicalKey: reconciliation.canonicalKey,
      activityKey: reconciliation.currentActivityKey,
      previousActivityKey: reconciliation.previousActivityKey,
      taskUid: reconciliation.taskUid,
      matchMethod: ACTIVITY_MAPPING_METHOD.EXACT_UID_CONTINUITY,
      confidence: reconciliation.confidence,
      alternatives: [{
        rank: 1,
        activityKey: task.activityKey,
        taskUid: task.taskUid,
        name: task.name,
        outlineLevel: task.outlineLevel,
        isSummary: task.isSummary,
        isMilestone: task.isMilestone,
        plannedStart: task.plannedStart,
        plannedFinish: task.plannedFinish,
        canonicalKey: reconciliation.canonicalKey,
        confidence: reconciliation.confidence,
        matchMethod: ACTIVITY_MAPPING_METHOD.EXACT_UID_CONTINUITY,
        blockers: [],
        evidence: reconciliation.evidence
      }],
      evidence: [
        {
          kind: "immutable_review_event",
          detail: operation.sourceEvent.eventId,
          scoreDelta: 0
        },
        ...reconciliation.evidence
      ],
      conflict: null,
      conflictResolved: false,
      reviewerId: null,
      reviewedAt,
      reason: "המשך אוטומטי מבוקר לאחר אימות זהות מדויק בין שתי גרסאות לוח סמכותיות.",
      supersedesEventId: null
    }
  };
}

export function contractsActivityMappingUploadReconciliationApproved(env = process.env) {
  return String(env.CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED || "")
    .trim()
    .toUpperCase() === "TRUE";
}

export function parseActivityMappingReconciliationRequest({ headers = {}, query = null, body = null } = {}) {
  assertNoClientDatabaseOverrides({ headers, query, body });
  const request = plainObject(body, "The upload-reconciliation request");
  const bodyKeys = Object.keys(request);
  const queryKeys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "sourceProjectId" || queryKeys.length > 0) {
    const unsupported = [
      ...bodyKeys.filter((key) => key !== "sourceProjectId").map((key) => `body.${key}`),
      ...queryKeys.map((key) => `query.${key}`)
    ].sort()[0] || "body";
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_field_unsupported",
      `Unsupported upload-reconciliation field: ${unsupported}.`,
      400
    );
  }
  return { sourceProjectId: normalizeActivityMappingSourceProjectId(request.sourceProjectId) };
}

export async function previewActivityMappingUploadReconciliation({
  config,
  sourceProjectId,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  loadStateImpl = loadContractActivityMappingState,
  historyLoader = listActivityMappingReviewHistory
} = {}) {
  return publicPlan(await buildReconciliationPlan({
    config,
    sourceProjectId,
    fetchImpl,
    timeoutMs,
    loadStateImpl,
    historyLoader
  }));
}

export async function applyActivityMappingUploadReconciliation({
  config,
  sourceProjectId,
  reconciliationApplyApproved = false,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  nowImpl = () => new Date(),
  loadStateImpl = loadContractActivityMappingState,
  historyLoader = listActivityMappingReviewHistory,
  submitter = submitActivityMappingAutoContinuation
} = {}) {
  if (reconciliationApplyApproved !== true) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_apply_not_approved",
      "Upload reconciliation writes are disabled by the server-only Phase 3G activation gate.",
      503
    );
  }
  const plan = await buildReconciliationPlan({
    config,
    sourceProjectId,
    fetchImpl,
    timeoutMs,
    loadStateImpl,
    historyLoader
  });
  if (plan.hasAmbiguity) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_blocked",
      "Automatic upload reconciliation is blocked by an ambiguous mapping result.",
      409
    );
  }
  const reviewedAtValue = nowImpl();
  const reviewedAtDate = reviewedAtValue instanceof Date ? reviewedAtValue : new Date(reviewedAtValue);
  if (Number.isNaN(reviewedAtDate.getTime())) {
    throw reconciliationError(
      "contracts_activity_mapping_reconciliation_clock_invalid",
      "The server clock did not produce a valid review timestamp.",
      500
    );
  }
  const reviewedAt = reviewedAtDate.toISOString();
  const results = [];
  for (const operation of plan.operations) {
    if (operation.alreadyRecorded) {
      results.push({
        eventKey: operation.eventKey,
        recordedEventKey: operation.recordedEventKey,
        status: "already_recorded",
        auditWritePerformed: false,
        operationalWritesPerformed: false
      });
      continue;
    }
    try {
      const recorded = await submitter({
        config,
        submission: buildSubmission(plan, operation, reviewedAt),
        reconciliationApplyApproved: true,
        fetchImpl,
        timeoutMs
      });
      results.push({
        eventKey: operation.eventKey,
        status: "recorded",
        result: recorded.result,
        auditWritePerformed: recorded.auditWritePerformed === true,
        operationalWritesPerformed: recorded.operationalWritesPerformed === true
      });
    } catch (error) {
      const recoverable = new Set([
        "contracts_activity_mapping_reconciliation_conflict",
        "contracts_activity_mapping_reconciliation_timeout",
        "contracts_activity_mapping_reconciliation_transport_failed"
      ]);
      if (!recoverable.has(error?.code)) throw error;
      const refreshed = await buildReconciliationPlan({
        config,
        sourceProjectId,
        fetchImpl,
        timeoutMs,
        loadStateImpl,
        historyLoader
      });
      const recovered = refreshed.operations.find((candidate) => (
        candidate.eventKey === operation.eventKey
        && candidate.alreadyRecorded
        && candidate.recordedEventKey === operation.eventKey
      ));
      if (!recovered) throw error;
      const mappingRowsChanged = Number(recovered.recordedEvent?.result?.mappingRowsChanged || 0);
      results.push({
        eventKey: operation.eventKey,
        recordedEventKey: recovered.recordedEventKey,
        status: "recorded_after_race",
        result: recovered.recordedEvent?.result ?? null,
        auditWritePerformed: true,
        operationalWritesPerformed: mappingRowsChanged > 0
      });
    }
  }
  const preview = publicPlan(plan);
  return {
    ...preview,
    mode: "apply",
    status: results.some((result) => result.status.startsWith("recorded")) ? "recorded" : "no_changes",
    reviewedAt,
    results,
    auditWritePerformed: results.some((result) => result.auditWritePerformed),
    operationalWritesPerformed: results.some((result) => result.operationalWritesPerformed)
  };
}
