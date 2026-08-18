import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_ACTIVITY_MAPPING_VERSION = "contracts-activity-mapping.phase3.v1";

export const ACTIVITY_MAPPING_STATUS = Object.freeze({
  SUGGESTED: "suggested",
  MANUALLY_CONFIRMED: "manually_confirmed",
  AUTO_CONFIRMED: "auto_confirmed",
  REJECTED: "rejected",
  UNMAPPED: "unmapped"
});

export const ACTIVITY_MAPPING_ALIAS_SOURCE = Object.freeze({
  GANTT_ACTIVITY_KEY: "gantt_activity_key",
  GANTT_TASK_UID: "gantt_task_uid",
  CONTRACTS_CANDIDATE: "contracts_candidate",
  CONTRACT_MILESTONE: "contract_milestone"
});

export const ACTIVITY_MAPPING_METHOD = Object.freeze({
  MANUAL_REVIEW: "manual_review",
  EXACT_UID_CONTINUITY: "exact_uid_continuity",
  CORRECTED_MANUAL_REVIEW: "corrected_manual_review"
});

export const ACTIVITY_MAPPING_BLOCKER = Object.freeze({
  HUMAN_REVIEW_REQUIRED: "human_review_required",
  PROJECT_MAPPING_INACTIVE: "project_mapping_inactive",
  SCHEDULE_VERSION_CONFLICT: "schedule_version_conflict",
  TRIGGER_EVIDENCE_UNREVIEWED: "trigger_evidence_unreviewed",
  NO_MAPPING_CANDIDATE: "no_mapping_candidate",
  AMBIGUOUS_CANDIDATES: "ambiguous_candidates",
  CANONICAL_ALIAS_CONFLICT: "canonical_alias_conflict",
  INVALID_CANONICAL_KEY: "invalid_canonical_key",
  PREVIOUS_ACTIVITY_NOT_FOUND: "previous_activity_not_found",
  CURRENT_ACTIVITY_NOT_FOUND: "current_activity_not_found",
  DUPLICATE_PREVIOUS_TASK_UID: "duplicate_previous_task_uid",
  DUPLICATE_CURRENT_TASK_UID: "duplicate_current_task_uid",
  IDENTITY_CONTINUITY_REQUIRES_REVIEW: "identity_continuity_requires_review",
  SUMMARY_ACTIVITY_REQUIRES_REVIEW: "summary_activity_requires_review",
  PRIOR_MAPPING_CONFIDENCE_BELOW_CONTINUITY_GATE: "prior_mapping_confidence_below_continuity_gate"
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/i;
const CANONICAL_KEY_PATTERN = /^schedule-activity:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONFIRMED_STATUSES = new Set([
  ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED,
  ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED
]);

function invalidInput(message, issueCodes = []) {
  throw new ContractsAgentError(
    "contracts_activity_mapping_input_invalid",
    message,
    400,
    { issueCodes }
  );
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidInput(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    invalidInput(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireUuid(value, label) {
  const normalized = requireString(value, label);
  if (!UUID_PATTERN.test(normalized)) {
    invalidInput(`${label} must be a UUID.`);
  }
  return normalized.toLowerCase();
}

function optionalDate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    invalidInput(`${label} must be a YYYY-MM-DD date or null.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    invalidInput(`${label} must be a valid calendar date or null.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") invalidInput(`${label} must be a boolean.`);
  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    invalidInput(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) invalidInput(`${label} must be an array.`);
  return value;
}

function finiteConfidence(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    invalidInput(`${label} must be a finite number between 0 and 1.`);
  }
  return value;
}

function roundConfidence(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value) {
  const normalized = normalizeText(value);
  return normalized ? [...new Set(normalized.split(" "))] : [];
}

function normalizeProjectContext(value) {
  const context = requireObject(value, "projectContext");
  return {
    sourceSystem: requireEnum(context.sourceSystem, ["main"], "projectContext.sourceSystem"),
    sourceProjectId: requireUuid(context.sourceProjectId, "projectContext.sourceProjectId"),
    scheduleProjectId: requireUuid(context.scheduleProjectId, "projectContext.scheduleProjectId"),
    projectMappingId: requireUuid(context.projectMappingId, "projectContext.projectMappingId"),
    mappingStatus: requireEnum(context.mappingStatus, ["active", "inactive"], "projectContext.mappingStatus")
  };
}

function normalizeScheduleVersion(value, label = "scheduleVersion") {
  const version = requireObject(value, label);
  return {
    fileId: requireString(version.fileId, `${label}.fileId`),
    relevancyDate: optionalDate(version.relevancyDate, `${label}.relevancyDate`),
    versionConflict: requireBoolean(version.versionConflict, `${label}.versionConflict`)
  };
}

function normalizeSourceEvidence(value) {
  return requireArray(value, "obligation.sourceEvidence").map((entry, index) => {
    const evidence = requireObject(entry, `obligation.sourceEvidence[${index}]`);
    const pdfPage = evidence.pdfPage === null || evidence.pdfPage === undefined
      ? null
      : Number(evidence.pdfPage);
    if (pdfPage !== null && (!Number.isInteger(pdfPage) || pdfPage < 1)) {
      invalidInput(`obligation.sourceEvidence[${index}].pdfPage must be a positive integer or null.`);
    }
    return {
      evidenceId: requireString(evidence.evidenceId, `obligation.sourceEvidence[${index}].evidenceId`),
      sourceText: requireString(evidence.sourceText, `obligation.sourceEvidence[${index}].sourceText`),
      pdfPage,
      clause: evidence.clause === null || evidence.clause === undefined
        ? null
        : requireString(evidence.clause, `obligation.sourceEvidence[${index}].clause`)
    };
  });
}

function normalizeObligation(value) {
  const obligation = requireObject(value, "obligation");
  const documentVersionId = requireString(obligation.documentVersionId, "obligation.documentVersionId");
  if (!DOCUMENT_VERSION_PATTERN.test(documentVersionId)) {
    invalidInput("obligation.documentVersionId must use sha256:<64 hex> format.");
  }
  const mappingRequirement = requireEnum(
    obligation.mappingRequirement,
    ["required", "not_required"],
    "obligation.mappingRequirement"
  );
  const sourceEvidence = normalizeSourceEvidence(obligation.sourceEvidence);
  if (mappingRequirement === "required" && sourceEvidence.length === 0) {
    invalidInput("A required activity mapping must retain at least one source-evidence item.");
  }
  const preferredTaskUid = obligation.preferredTaskUid === null || obligation.preferredTaskUid === undefined
    ? null
    : Number(obligation.preferredTaskUid);
  if (preferredTaskUid !== null && (!Number.isInteger(preferredTaskUid) || preferredTaskUid < 0)) {
    invalidInput("obligation.preferredTaskUid must be a non-negative integer or null.");
  }
  const preferredOutlineLevel = obligation.preferredOutlineLevel === null || obligation.preferredOutlineLevel === undefined
    ? null
    : Number(obligation.preferredOutlineLevel);
  if (preferredOutlineLevel !== null && (!Number.isInteger(preferredOutlineLevel) || preferredOutlineLevel < 0)) {
    invalidInput("obligation.preferredOutlineLevel must be a non-negative integer or null.");
  }
  const activityTerms = obligation.activityTerms === undefined
    ? []
    : requireArray(obligation.activityTerms, "obligation.activityTerms")
      .map((term, index) => requireString(term, `obligation.activityTerms[${index}]`));
  return {
    documentVersionId: documentVersionId.toLowerCase(),
    candidateKey: requireString(obligation.candidateKey, "obligation.candidateKey"),
    milestoneKey: obligation.milestoneKey === null || obligation.milestoneKey === undefined
      ? null
      : requireString(obligation.milestoneKey, "obligation.milestoneKey"),
    label: requireString(obligation.label, "obligation.label"),
    mappingRequirement,
    conditionStatus: requireEnum(
      obligation.conditionStatus,
      ["not_applicable", "pending", "resolved"],
      "obligation.conditionStatus"
    ),
    triggerEvidenceReviewed: requireBoolean(
      obligation.triggerEvidenceReviewed,
      "obligation.triggerEvidenceReviewed"
    ),
    preferMilestone: obligation.preferMilestone === undefined
      ? false
      : requireBoolean(obligation.preferMilestone, "obligation.preferMilestone"),
    preferredTaskUid,
    preferredActivityKey: obligation.preferredActivityKey === null || obligation.preferredActivityKey === undefined
      ? null
      : requireString(obligation.preferredActivityKey, "obligation.preferredActivityKey"),
    preferredOutlineLevel,
    activityTerms,
    sourceEvidence
  };
}

function normalizeTask(value, index, label) {
  const task = requireObject(value, `${label}[${index}]`);
  const taskUid = Number(task.taskUid ?? task.stableKey);
  if (!Number.isInteger(taskUid) || taskUid < 0) {
    invalidInput(`${label}[${index}].taskUid must be a non-negative integer.`);
  }
  const outlineLevel = Number(task.outlineLevel);
  if (!Number.isInteger(outlineLevel) || outlineLevel < 0) {
    invalidInput(`${label}[${index}].outlineLevel must be a non-negative integer.`);
  }
  const sourceVersionId = requireString(task.sourceVersionId, `${label}[${index}].sourceVersionId`);
  const activityKey = requireString(task.activityKey, `${label}[${index}].activityKey`);
  if (activityKey !== `gantt:${sourceVersionId}:${taskUid}`) {
    invalidInput(`${label}[${index}].activityKey must match gantt:<sourceVersionId>:<taskUid>.`);
  }
  return {
    activityKey,
    taskUid,
    name: requireString(task.name, `${label}[${index}].name`),
    outlineLevel,
    isSummary: requireBoolean(task.isSummary, `${label}[${index}].isSummary`),
    isMilestone: requireBoolean(task.isMilestone, `${label}[${index}].isMilestone`),
    plannedStart: optionalDate(task.plannedStart, `${label}[${index}].plannedStart`),
    plannedFinish: optionalDate(task.plannedFinish, `${label}[${index}].plannedFinish`),
    sourceVersionId
  };
}

function normalizeTasks(value, label) {
  return requireArray(value, label).map((task, index) => normalizeTask(task, index, label));
}

function normalizeExistingMappings(value) {
  if (value === undefined) return [];
  return requireArray(value, "existingMappings").map((entry, index) => {
    const mapping = requireObject(entry, `existingMappings[${index}]`);
    const canonicalKey = requireString(mapping.canonicalKey, `existingMappings[${index}].canonicalKey`);
    return {
      canonicalKey: CANONICAL_KEY_PATTERN.test(canonicalKey) ? canonicalKey.toLowerCase() : canonicalKey,
      alias: requireString(mapping.alias, `existingMappings[${index}].alias`),
      aliasSource: requireEnum(
        mapping.aliasSource,
        Object.values(ACTIVITY_MAPPING_ALIAS_SOURCE),
        `existingMappings[${index}].aliasSource`
      ),
      status: requireEnum(
        mapping.status,
        Object.values(ACTIVITY_MAPPING_STATUS),
        `existingMappings[${index}].status`
      ),
      confidence: finiteConfidence(mapping.confidence, `existingMappings[${index}].confidence`),
      matchMethod: requireEnum(
        mapping.matchMethod,
        Object.values(ACTIVITY_MAPPING_METHOD),
        `existingMappings[${index}].matchMethod`
      )
    };
  });
}

function publicObligation(obligation) {
  return {
    documentVersionId: obligation.documentVersionId,
    candidateKey: obligation.candidateKey,
    milestoneKey: obligation.milestoneKey,
    label: obligation.label,
    mappingRequirement: obligation.mappingRequirement,
    conditionStatus: obligation.conditionStatus,
    triggerEvidenceReviewed: obligation.triggerEvidenceReviewed,
    sourceEvidence: obligation.sourceEvidence
  };
}

function blockerBundle(projectContext, scheduleVersion) {
  const blockers = [];
  if (projectContext.mappingStatus !== "active") {
    blockers.push(ACTIVITY_MAPPING_BLOCKER.PROJECT_MAPPING_INACTIVE);
  }
  if (scheduleVersion.versionConflict) {
    blockers.push(ACTIVITY_MAPPING_BLOCKER.SCHEDULE_VERSION_CONFLICT);
  }
  return blockers;
}

function mappingOwnersForTask(task, mappings) {
  const aliases = new Set([task.activityKey, String(task.taskUid)]);
  const confirmed = mappings.filter((mapping) => (
    CONFIRMED_STATUSES.has(mapping.status)
    && aliases.has(mapping.alias)
    && (
      mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY
      || mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_TASK_UID
    )
  ));
  return {
    confirmed,
    canonicalKeys: [...new Set(confirmed.map((mapping) => mapping.canonicalKey))].sort()
  };
}

function scoreTaskCandidate(task, obligation, mappings) {
  const evidence = [];
  const blockers = [];
  let confidence = 0;
  const obligationTokens = tokens([obligation.label, ...obligation.activityTerms].join(" "));
  const taskTokens = new Set(tokens(task.name));
  const overlap = obligationTokens.filter((token) => taskTokens.has(token));
  const coverage = obligationTokens.length ? overlap.length / obligationTokens.length : 0;

  if (obligation.preferredActivityKey === task.activityKey) {
    confidence = Math.max(confidence, 0.99);
    evidence.push({ kind: "preferred_activity_key_exact", detail: task.activityKey, scoreDelta: 0.99 });
  }
  if (obligation.preferredTaskUid === task.taskUid) {
    confidence = Math.max(confidence, 0.93);
    evidence.push({ kind: "preferred_task_uid_exact", detail: String(task.taskUid), scoreDelta: 0.93 });
  }
  if (normalizeText(obligation.label) === normalizeText(task.name)) {
    confidence = Math.max(confidence, 0.88);
    evidence.push({ kind: "normalized_name_exact", detail: task.name, scoreDelta: 0.88 });
  } else if (coverage > 0) {
    const tokenScore = roundConfidence(0.2 + (0.6 * coverage));
    confidence = Math.max(confidence, tokenScore);
    evidence.push({
      kind: "token_overlap",
      detail: overlap.sort().join(" "),
      scoreDelta: tokenScore
    });
  }
  if (obligation.preferMilestone && task.isMilestone && confidence > 0) {
    confidence += 0.04;
    evidence.push({ kind: "milestone_shape_match", detail: "task is a milestone", scoreDelta: 0.04 });
  }
  if (obligation.preferredOutlineLevel === task.outlineLevel && confidence > 0) {
    confidence += 0.03;
    evidence.push({ kind: "outline_level_match", detail: String(task.outlineLevel), scoreDelta: 0.03 });
  }
  if (task.isSummary && confidence > 0) {
    confidence -= 0.2;
    blockers.push(ACTIVITY_MAPPING_BLOCKER.SUMMARY_ACTIVITY_REQUIRES_REVIEW);
    evidence.push({ kind: "summary_activity_penalty", detail: "summary activities require review", scoreDelta: -0.2 });
  }

  const owners = mappingOwnersForTask(task, mappings);
  let canonicalKey = null;
  if (owners.canonicalKeys.length === 1 && CANONICAL_KEY_PATTERN.test(owners.canonicalKeys[0])) {
    canonicalKey = owners.canonicalKeys[0];
    const mappingConfidence = Math.min(...owners.confirmed.map((mapping) => mapping.confidence));
    confidence = Math.max(confidence, Math.min(0.94, mappingConfidence));
    evidence.push({ kind: "confirmed_alias_owner", detail: canonicalKey, scoreDelta: 0 });
  } else if (owners.canonicalKeys.length > 1) {
    blockers.push(ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT);
    confidence = Math.min(confidence || 0.79, 0.79);
    evidence.push({
      kind: "conflicting_alias_owners",
      detail: owners.canonicalKeys.join(","),
      scoreDelta: 0
    });
  } else if (owners.canonicalKeys.length === 1) {
    blockers.push(ACTIVITY_MAPPING_BLOCKER.INVALID_CANONICAL_KEY);
    confidence = Math.min(confidence || 0.79, 0.79);
    evidence.push({ kind: "invalid_canonical_owner", detail: owners.canonicalKeys[0], scoreDelta: 0 });
  }

  if (confidence > 0 || evidence.length) {
    blockers.push(ACTIVITY_MAPPING_BLOCKER.HUMAN_REVIEW_REQUIRED);
  }

  return {
    task,
    canonicalKey,
    confidence: roundConfidence(confidence),
    evidence,
    blockers: [...new Set(blockers)]
  };
}

function candidateBundleBase(projectContext, obligation, scheduleVersion) {
  return {
    mappingContractVersion: CONTRACTS_ACTIVITY_MAPPING_VERSION,
    outputKind: "candidate_bundle",
    projectContext,
    obligation: publicObligation(obligation),
    scheduleVersion,
    candidates: [],
    blockers: [],
    conflict: null,
    decisionState: "unmapped",
    automaticAlertEligible: false
  };
}

/**
 * Produces review candidates only. It never selects or confirms an initial mapping.
 */
export function buildContractActivityMappingCandidates(input) {
  const request = requireObject(input, "input");
  const projectContext = normalizeProjectContext(request.projectContext);
  const obligation = normalizeObligation(request.obligation);
  const scheduleVersion = normalizeScheduleVersion(request.scheduleVersion);
  const tasks = normalizeTasks(request.tasks, "tasks");
  const existingMappings = normalizeExistingMappings(request.existingMappings);
  const output = candidateBundleBase(projectContext, obligation, scheduleVersion);

  if (obligation.mappingRequirement === "not_required") {
    output.decisionState = "not_required";
    return output;
  }
  if (obligation.conditionStatus === "pending" && !obligation.triggerEvidenceReviewed) {
    output.decisionState = "pending_trigger";
    output.blockers = [ACTIVITY_MAPPING_BLOCKER.TRIGGER_EVIDENCE_UNREVIEWED];
    return output;
  }

  output.blockers = blockerBundle(projectContext, scheduleVersion);
  if (output.blockers.length) {
    output.decisionState = "blocked";
    return output;
  }

  const currentTasks = tasks.filter((task) => task.sourceVersionId === scheduleVersion.fileId);
  if ([...tasksByUid(currentTasks).values()].some((matches) => matches.length > 1)) {
    output.blockers.push(ACTIVITY_MAPPING_BLOCKER.DUPLICATE_CURRENT_TASK_UID);
    output.decisionState = "blocked";
    return output;
  }

  const scored = currentTasks
    .map((task) => scoreTaskCandidate(task, obligation, existingMappings))
    .filter((candidate) => candidate.confidence > 0 || candidate.evidence.length || candidate.blockers.length)
    .sort((left, right) => (
      right.confidence - left.confidence
      || left.task.activityKey.localeCompare(right.task.activityKey)
    ))
    .slice(0, 5);

  output.candidates = scored.map((candidate, index) => ({
    rank: index + 1,
    canonicalKey: candidate.canonicalKey,
    taskUid: candidate.task.taskUid,
    activityKey: candidate.task.activityKey,
    taskName: candidate.task.name,
    outlineLevel: candidate.task.outlineLevel,
    isSummary: candidate.task.isSummary,
    isMilestone: candidate.task.isMilestone,
    plannedStart: candidate.task.plannedStart,
    plannedFinish: candidate.task.plannedFinish,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    blockers: candidate.blockers
  }));

  const conflictingAliases = output.candidates
    .filter((candidate) => candidate.blockers.includes(ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT))
    .map((candidate) => candidate.activityKey);
  if (conflictingAliases.length) {
    output.conflict = {
      type: ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT,
      candidateActivityKeys: conflictingAliases
    };
    output.blockers.push(ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT);
    output.decisionState = "blocked";
    return output;
  }

  if (output.candidates.some((candidate) => (
    candidate.blockers.includes(ACTIVITY_MAPPING_BLOCKER.INVALID_CANONICAL_KEY)
  ))) {
    output.blockers.push(ACTIVITY_MAPPING_BLOCKER.INVALID_CANONICAL_KEY);
    output.decisionState = "blocked";
    return output;
  }

  if (output.candidates.length > 1 && output.candidates[0].confidence === output.candidates[1].confidence) {
    const topConfidence = output.candidates[0].confidence;
    const tiedActivityKeys = output.candidates
      .filter((candidate) => candidate.confidence === topConfidence)
      .map((candidate) => candidate.activityKey);
    output.conflict = {
      type: ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES,
      candidateActivityKeys: tiedActivityKeys
    };
    output.blockers.push(ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES);
    output.decisionState = "blocked";
    return output;
  }

  if (!output.candidates.length) {
    output.blockers.push(ACTIVITY_MAPPING_BLOCKER.NO_MAPPING_CANDIDATE);
    output.decisionState = "unmapped";
    return output;
  }

  output.decisionState = "suggested";
  return output;
}

function tasksByUid(tasks) {
  const byUid = new Map();
  for (const task of tasks) {
    const existing = byUid.get(task.taskUid) ?? [];
    existing.push(task);
    byUid.set(task.taskUid, existing);
  }
  return byUid;
}

function competingCurrentIdentityKeys(tasks, currentTask) {
  const normalizedName = normalizeText(currentTask.name);
  return tasks
    .filter((task) => (
      task.activityKey !== currentTask.activityKey
      && normalizeText(task.name) === normalizedName
      && task.outlineLevel === currentTask.outlineLevel
    ))
    .map((task) => task.activityKey)
    .sort();
}

function reconciliationEvidence(previousTask, currentTask) {
  return [
    { kind: "task_uid_exact", detail: String(currentTask.taskUid), scoreDelta: 0.5 },
    { kind: "normalized_name_exact", detail: currentTask.name, scoreDelta: 0.3 },
    { kind: "outline_level_exact", detail: String(currentTask.outlineLevel), scoreDelta: 0.17 },
    { kind: "previous_activity_key", detail: previousTask.activityKey, scoreDelta: 0 }
  ];
}

function currentAliasConflicts({ mappings, currentTask, scheduleVersion, canonicalKey }) {
  const liveMappings = mappings.filter((mapping) => (
    mapping.status !== ACTIVITY_MAPPING_STATUS.REJECTED
    && mapping.status !== ACTIVITY_MAPPING_STATUS.UNMAPPED
  ));
  const currentVersionPrefix = `gantt:${scheduleVersion.fileId}:`;
  const directOwners = liveMappings.filter((mapping) => (
    (
      mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY
      && mapping.alias === currentTask.activityKey
    )
    || (
      mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_TASK_UID
      && mapping.alias === String(currentTask.taskUid)
    )
  ));
  const otherCurrentAliases = liveMappings.filter((mapping) => (
    mapping.canonicalKey === canonicalKey
    && mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY
    && mapping.alias.startsWith(currentVersionPrefix)
    && mapping.alias !== currentTask.activityKey
  ));
  const competingCanonicalKeys = directOwners
    .filter((mapping) => mapping.canonicalKey !== canonicalKey)
    .map((mapping) => mapping.canonicalKey);
  return [...new Set([
    ...competingCanonicalKeys,
    ...otherCurrentAliases.map((mapping) => mapping.alias)
  ])].sort();
}

export function mappingAutomaticAlertEligible(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    CONFIRMED_STATUSES.has(value.status)
    && typeof value.confidence === "number"
    && Number.isFinite(value.confidence)
    && value.confidence >= 0.8
    && value.confidence <= 1
    && value.currentVersionAliasResolvedExactlyOnce === true
    && value.noOpenMappingConflict === true
    && value.projectMappingActive === true
  );
}

function reconciliationBundleBase(projectContext, previousScheduleVersion, scheduleVersion) {
  return {
    mappingContractVersion: CONTRACTS_ACTIVITY_MAPPING_VERSION,
    outputKind: "reconciliation_bundle",
    projectContext,
    previousScheduleVersion,
    scheduleVersion,
    reconciliations: [],
    blockers: [],
    conflictCount: 0,
    summary: {
      evaluated: 0,
      autoConfirmed: 0,
      suggested: 0,
      unmapped: 0,
      conflicts: 0
    }
  };
}

function pushReconciliation(output, reconciliation) {
  output.reconciliations.push(reconciliation);
  output.summary.evaluated += 1;
  if (reconciliation.status === ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED) output.summary.autoConfirmed += 1;
  if (reconciliation.status === ACTIVITY_MAPPING_STATUS.SUGGESTED) output.summary.suggested += 1;
  if (reconciliation.status === ACTIVITY_MAPPING_STATUS.UNMAPPED) output.summary.unmapped += 1;
  if (reconciliation.status === "conflict") {
    output.summary.conflicts += 1;
    output.conflictCount += 1;
  }
}

function reconciliationRecord({
  canonicalKey,
  previousActivityKey,
  currentActivityKey,
  taskUid,
  status,
  confidence,
  matchMethod,
  evidence = [],
  blockers = [],
  projectMappingActive = false
}) {
  const uniqueBlockers = [...new Set(blockers)];
  return {
    canonicalKey,
    previousActivityKey,
    currentActivityKey,
    taskUid,
    status,
    confidence: roundConfidence(confidence),
    aliasSource: ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY,
    matchMethod,
    evidence,
    blockers: uniqueBlockers,
    automaticAlertEligible: mappingAutomaticAlertEligible({
      status,
      confidence,
      currentVersionAliasResolvedExactlyOnce: currentActivityKey !== null,
      noOpenMappingConflict: uniqueBlockers.length === 0,
      projectMappingActive
    })
  };
}

/**
 * Reconciles only previously confirmed version-scoped activity aliases. A new
 * alias is auto-confirmed only under unique exact UID/name/outline continuity at >= .95.
 */
export function reconcileConfirmedActivityAliases(input) {
  const request = requireObject(input, "input");
  const projectContext = normalizeProjectContext(request.projectContext);
  const previousScheduleVersion = normalizeScheduleVersion(
    request.previousScheduleVersion,
    "previousScheduleVersion"
  );
  const scheduleVersion = normalizeScheduleVersion(request.scheduleVersion);
  if (previousScheduleVersion.fileId === scheduleVersion.fileId) {
    invalidInput("previousScheduleVersion.fileId must differ from scheduleVersion.fileId.");
  }
  const previousTasks = normalizeTasks(request.previousTasks, "previousTasks")
    .filter((task) => task.sourceVersionId === previousScheduleVersion.fileId);
  const currentTasks = normalizeTasks(request.currentTasks, "currentTasks")
    .filter((task) => task.sourceVersionId === scheduleVersion.fileId);
  const mappings = normalizeExistingMappings(request.existingMappings);
  const output = reconciliationBundleBase(
    projectContext,
    previousScheduleVersion,
    scheduleVersion
  );

  output.blockers = [
    ...blockerBundle(projectContext, scheduleVersion),
    ...(previousScheduleVersion.versionConflict ? [ACTIVITY_MAPPING_BLOCKER.SCHEDULE_VERSION_CONFLICT] : [])
  ];
  output.blockers = [...new Set(output.blockers)];
  if (output.blockers.length) return output;

  const previousByUid = tasksByUid(previousTasks);
  const currentByUid = tasksByUid(currentTasks);
  const previousActivityKeys = new Set(previousTasks.map((task) => task.activityKey));
  const confirmedAliases = mappings.filter((mapping) => (
    mapping.aliasSource === ACTIVITY_MAPPING_ALIAS_SOURCE.GANTT_ACTIVITY_KEY
    && CONFIRMED_STATUSES.has(mapping.status)
    && previousActivityKeys.has(mapping.alias)
  ));
  const mappingGroups = new Map();
  for (const mapping of confirmedAliases) {
    const group = mappingGroups.get(mapping.alias) ?? [];
    group.push(mapping);
    mappingGroups.set(mapping.alias, group);
  }
  const canonicalPreviousAliases = new Map();
  for (const [alias, group] of mappingGroups) {
    for (const canonicalKey of new Set(group.map((mapping) => mapping.canonicalKey))) {
      const aliases = canonicalPreviousAliases.get(canonicalKey) ?? new Set();
      aliases.add(alias);
      canonicalPreviousAliases.set(canonicalKey, aliases);
    }
  }

  for (const [previousActivityKey, group] of [...mappingGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const canonicalKeys = [...new Set(group.map((mapping) => mapping.canonicalKey))].sort();
    const previousMatches = previousTasks.filter((task) => task.activityKey === previousActivityKey);
    const previousTask = previousMatches.length === 1 ? previousMatches[0] : null;
    const fallbackTaskUid = previousTask?.taskUid ?? 0;

    if (canonicalKeys.length !== 1) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey: null,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: fallbackTaskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT],
        projectMappingActive: true
      }));
      continue;
    }
    const canonicalKey = canonicalKeys[0];
    if (!CANONICAL_KEY_PATTERN.test(canonicalKey)) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey: null,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: fallbackTaskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.INVALID_CANONICAL_KEY],
        projectMappingActive: true
      }));
      continue;
    }
    if ((canonicalPreviousAliases.get(canonicalKey)?.size ?? 0) > 1) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: fallbackTaskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT],
        projectMappingActive: true
      }));
      continue;
    }
    if (previousMatches.length !== 1) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: fallbackTaskUid,
        status: previousMatches.length > 1 ? "conflict" : ACTIVITY_MAPPING_STATUS.UNMAPPED,
        confidence: 0,
        matchMethod: null,
        blockers: [
          previousMatches.length > 1
            ? ACTIVITY_MAPPING_BLOCKER.DUPLICATE_PREVIOUS_TASK_UID
            : ACTIVITY_MAPPING_BLOCKER.PREVIOUS_ACTIVITY_NOT_FOUND
        ],
        projectMappingActive: true
      }));
      continue;
    }

    const previousUidMatches = previousByUid.get(previousTask.taskUid) ?? [];
    if (previousUidMatches.length !== 1) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: previousTask.taskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.DUPLICATE_PREVIOUS_TASK_UID],
        projectMappingActive: true
      }));
      continue;
    }

    const currentMatches = currentByUid.get(previousTask.taskUid) ?? [];
    if (!currentMatches.length) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: previousTask.taskUid,
        status: ACTIVITY_MAPPING_STATUS.UNMAPPED,
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.CURRENT_ACTIVITY_NOT_FOUND],
        projectMappingActive: true
      }));
      continue;
    }
    if (currentMatches.length !== 1) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: null,
        taskUid: previousTask.taskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        blockers: [ACTIVITY_MAPPING_BLOCKER.DUPLICATE_CURRENT_TASK_UID],
        projectMappingActive: true
      }));
      continue;
    }

    const currentTask = currentMatches[0];
    const currentConflicts = currentAliasConflicts({
      mappings,
      currentTask,
      scheduleVersion,
      canonicalKey
    });
    if (currentConflicts.length) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: currentTask.activityKey,
        taskUid: currentTask.taskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        evidence: [{
          kind: "conflicting_alias_owners",
          detail: currentConflicts.join(","),
          scoreDelta: 0
        }],
        blockers: [ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT],
        projectMappingActive: true
      }));
      continue;
    }
    const exactName = normalizeText(previousTask.name) === normalizeText(currentTask.name);
    const exactOutline = previousTask.outlineLevel === currentTask.outlineLevel;
    const exactIdentityContinuity = exactName && exactOutline && !currentTask.isSummary;
    const competingIdentityKeys = exactIdentityContinuity
      ? competingCurrentIdentityKeys(currentTasks, currentTask)
      : [];
    if (competingIdentityKeys.length) {
      pushReconciliation(output, reconciliationRecord({
        canonicalKey,
        previousActivityKey,
        currentActivityKey: currentTask.activityKey,
        taskUid: currentTask.taskUid,
        status: "conflict",
        confidence: 0,
        matchMethod: null,
        evidence: [
          { kind: "task_uid_exact", detail: String(currentTask.taskUid), scoreDelta: 0.5 },
          {
            kind: "identity_mismatch",
            detail: `normalized name and outline level also match ${competingIdentityKeys.join(",")}`,
            scoreDelta: 0
          }
        ],
        blockers: [ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES],
        projectMappingActive: true
      }));
      continue;
    }
    const priorConfidence = Math.min(...group.map((mapping) => mapping.confidence));
    const exactContinuity = exactIdentityContinuity;
    const continuityConfidence = exactContinuity
      ? roundConfidence(Math.min(0.97, priorConfidence))
      : 0.79;
    const canAutoConfirm = exactContinuity && continuityConfidence >= 0.95;
    const blockers = [];
    if (!exactContinuity) {
      blockers.push(ACTIVITY_MAPPING_BLOCKER.IDENTITY_CONTINUITY_REQUIRES_REVIEW);
      if (currentTask.isSummary) blockers.push(ACTIVITY_MAPPING_BLOCKER.SUMMARY_ACTIVITY_REQUIRES_REVIEW);
    } else if (!canAutoConfirm) {
      blockers.push(ACTIVITY_MAPPING_BLOCKER.PRIOR_MAPPING_CONFIDENCE_BELOW_CONTINUITY_GATE);
    }
    pushReconciliation(output, reconciliationRecord({
      canonicalKey,
      previousActivityKey,
      currentActivityKey: currentTask.activityKey,
      taskUid: currentTask.taskUid,
      status: canAutoConfirm
        ? ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED
        : ACTIVITY_MAPPING_STATUS.SUGGESTED,
      confidence: continuityConfidence,
      matchMethod: canAutoConfirm ? ACTIVITY_MAPPING_METHOD.EXACT_UID_CONTINUITY : null,
      evidence: exactContinuity
        ? reconciliationEvidence(previousTask, currentTask)
        : [
            { kind: "task_uid_exact", detail: String(currentTask.taskUid), scoreDelta: 0.5 },
            { kind: "identity_mismatch", detail: "name, outline, or summary shape changed", scoreDelta: 0 }
          ],
      blockers,
      projectMappingActive: projectContext.mappingStatus === "active"
    }));
  }

  return output;
}
