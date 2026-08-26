import crypto from "node:crypto";
import {
  scheduleAssignmentConfigurationSnapshot,
  SCHEDULE_ASSIGNMENT_ENGINE_VERSION
} from "./scheduleActivityAssignmentEngine.js";

export const SCHEDULE_ASSIGNMENT_EVALUATION_VERSION = "schedule-assignment-eval.v1";

export const SCHEDULE_ASSIGNMENT_LABEL_TYPES = Object.freeze({
  CONFIRMED_MATCH: "confirmed_match",
  REJECTED_MATCH: "rejected_match",
  NO_MATCH: "no_match",
  STALE_ACTIVITY: "stale_activity",
  IRRELEVANT_ALERT: "irrelevant_alert",
  AMBIGUOUS: "ambiguous"
});

const LABEL_TYPES = new Set(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES));
const NON_FAILURE_ROLE_ERRORS = new Set(["", "not_run", "not_required", "not_requested", "disabled"]);

function safeText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function policyWouldAutoAssign(result = {}) {
  if (typeof result?.decision?.wouldAutoAssign === "boolean") return result.decision.wouldAutoAssign;
  const gates = result?.decision?.gates;
  if (gates && typeof gates === "object" && Object.keys(gates).length) return Object.values(gates).every(Boolean);
  return result?.decision?.autoAssigned === true;
}

function roleFailures(roles = {}) {
  return Object.entries(roles).flatMap(([role, value]) => {
    const error = safeText(value?.error, 700);
    if (NON_FAILURE_ROLE_ERRORS.has(error)) return [];
    return [{
      role,
      error,
      jsonFailure: /(?:json|schema|parse|structured|extract)/iu.test(error)
    }];
  });
}

function recallForKeys(keys, expectedActivityKey, positiveLabel) {
  return {
    at1: positiveLabel ? keys[0] === expectedActivityKey : null,
    at5: positiveLabel ? keys.slice(0, 5).includes(expectedActivityKey) : null
  };
}

export function normalizeScheduleAssignmentEvaluationCase(value = {}) {
  const labelType = safeText(value?.label?.type || value?.labelType, 80);
  if (!LABEL_TYPES.has(labelType)) throw new Error(`unsupported evaluation label: ${labelType || "missing"}`);
  const expectedActivityKey = safeText(value?.label?.expectedActivityKey || value?.expectedActivityKey, 500) || null;
  if (labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH && !expectedActivityKey) {
    throw new Error("confirmed_match requires expectedActivityKey");
  }
  const sourceId = safeText(value.sourceId, 500);
  if (!sourceId) throw new Error("evaluation case requires sourceId");
  const caseId = safeText(value.id || `${labelType}:${sourceId}`, 500);
  const forbiddenActivityKeys = [...new Set((value?.label?.forbiddenActivityKeys || value?.forbiddenActivityKeys || [])
    .map((item) => safeText(item, 500))
    .filter(Boolean))];
  return {
    id: caseId,
    projectId: safeText(value.projectId, 500) || null,
    sourceId,
    scheduleVersionId: safeText(value.scheduleVersionId, 500) || null,
    label: {
      type: labelType,
      expectedActivityKey,
      forbiddenActivityKeys,
      reason: safeText(value?.label?.reason || value.reason, 1200) || null
    },
    provenance: {
      source: safeText(value?.provenance?.source || "fixture", 120) || "fixture",
      linkId: safeText(value?.provenance?.linkId, 500) || null,
      reviewedAt: safeText(value?.provenance?.reviewedAt, 100) || null
    }
  };
}

export function buildScheduleAssignmentEvaluationManifest({
  dataCutoff,
  activeScheduleVersionId,
  settings = {},
  cases = []
} = {}) {
  const cutoff = safeText(dataCutoff, 100);
  if (!/^\d{4}-\d{2}-\d{2}T/iu.test(cutoff)) throw new Error("dataCutoff must be an ISO timestamp");
  const normalizedCases = cases.map(normalizeScheduleAssignmentEvaluationCase);
  const configuration = scheduleAssignmentConfigurationSnapshot(settings);
  const fixtureHash = sha256(JSON.stringify(normalizedCases));
  return {
    evaluationVersion: SCHEDULE_ASSIGNMENT_EVALUATION_VERSION,
    engineVersion: SCHEDULE_ASSIGNMENT_ENGINE_VERSION,
    dataCutoff: cutoff,
    activeScheduleVersionId: safeText(activeScheduleVersionId, 500) || null,
    settingsVersion: configuration.version,
    configurationSnapshotId: configuration.snapshotId,
    promptHashes: Object.fromEntries(Object.entries(configuration.roles).map(([role, config]) => [role, config.promptHash || null])),
    schemaHashes: Object.fromEntries(Object.entries(configuration.roles).map(([role, config]) => [role, config.schemaHash || null])),
    fixtureHash: `sha256:${fixtureHash}`,
    caseCount: normalizedCases.length,
    leakageControl: {
      labelsExcludedFromHistoricalSignals: true,
      evaluatedLinkIds: normalizedCases.map((item) => item.provenance.linkId).filter(Boolean)
    }
  };
}

export function evaluateScheduleAssignmentCase({ fixture, result = {}, durationMs = null } = {}) {
  const item = normalizeScheduleAssignmentEvaluationCase(fixture);
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const candidateKeys = candidates.map((candidate) => safeText(candidate?.activityKey, 500)).filter(Boolean);
  const topCandidates = candidates.slice(0, 5).map((candidate) => ({
    rank: finiteNumber(candidate?.rank, 0) || null,
    activityKey: safeText(candidate?.activityKey, 500) || null,
    name: safeText(candidate?.name, 700) || null,
    finalScore: finiteNumber(candidate?.finalScore, 0),
    signals: candidate?.signals && typeof candidate.signals === "object" ? candidate.signals : {},
    supportingEvidence: Array.isArray(candidate?.supportingEvidence) ? candidate.supportingEvidence.slice(0, 5) : [],
    contradictingEvidence: Array.isArray(candidate?.contradictingEvidence) ? candidate.contradictingEvidence.slice(0, 5) : []
  }));
  const selectedActivityKey = safeText(result?.decision?.selectedActivityKey, 500) || null;
  const expectedActivityKey = item.label.expectedActivityKey;
  const positiveLabel = item.label.type === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH;
  const wouldAutoAssign = policyWouldAutoAssign(result);
  const selectedExpected = Boolean(expectedActivityKey && selectedActivityKey === expectedActivityKey);
  const forbiddenSelection = Boolean(selectedActivityKey && item.label.forbiddenActivityKeys.includes(selectedActivityKey));
  const correctAutomaticAssignment = wouldAutoAssign && positiveLabel && selectedExpected && !forbiddenSelection;
  const falseAutomaticAssignment = wouldAutoAssign && !correctAutomaticAssignment;
  const failures = roleFailures(result.roles);
  const gates = result?.decision?.gates && typeof result.decision.gates === "object" ? result.decision.gates : {};
  const failedGates = Object.entries(gates).filter(([, passed]) => passed !== true).map(([gate]) => gate);
  const calls = Array.isArray(result?.workflowLog?.openRouterUsage?.calls)
    ? result.workflowLog.openRouterUsage.calls
    : [];
  const stageKeys = Object.fromEntries(["deterministic", "semantic", "final"].map((stage) => {
    const rows = Array.isArray(result?.candidateStages?.[stage])
      ? result.candidateStages[stage]
      : stage === "final"
        ? candidates
        : [];
    return [stage, rows.map((candidate) => safeText(candidate?.activityKey, 500)).filter(Boolean)];
  }));
  const candidateRecallByStage = Object.fromEntries(Object.entries(stageKeys).map(([stage, keys]) => [stage, recallForKeys(keys, expectedActivityKey, positiveLabel)]));
  const embeddingCallCount = calls.filter((call) => call?.step === "assignment_embedding").length;
  const chatModelCallCount = calls.length - embeddingCallCount;
  const reasons = [];
  if (positiveLabel && candidateKeys[0] !== expectedActivityKey) reasons.push("expected activity was not ranked first");
  if (positiveLabel && !candidateKeys.slice(0, 5).includes(expectedActivityKey)) reasons.push("expected activity was absent from top 5");
  if (falseAutomaticAssignment) reasons.push(positiveLabel ? "automatic policy selected the wrong activity" : `automatic policy must abstain for ${item.label.type}`);
  if (!wouldAutoAssign && failedGates.length) reasons.push(`failed safety gates: ${failedGates.join(", ")}`);
  if (forbiddenSelection) reasons.push("selected activity is explicitly forbidden by the label");
  if (failures.length) reasons.push(`${failures.length} model role failure(s)`);
  if (!reasons.length) reasons.push(wouldAutoAssign ? "automatic decision agrees with the label" : "policy abstained without contradicting the label");
  return {
    caseId: item.id,
    sourceId: item.sourceId,
    labelType: item.label.type,
    expectedActivityKey,
    selectedActivityKey,
    candidateRecallAt1: positiveLabel ? candidateKeys[0] === expectedActivityKey : null,
    candidateRecallAt5: positiveLabel ? candidateKeys.slice(0, 5).includes(expectedActivityKey) : null,
    candidateRecallByStage,
    wouldAutoAssign,
    correctAutomaticAssignment,
    falseAutomaticAssignment,
    abstained: !wouldAutoAssign,
    decisionType: safeText(result?.decision?.type, 80) || null,
    confidence: finiteNumber(result?.decision?.confidence, 0),
    margin: finiteNumber(result?.decision?.margin, 0),
    gates,
    failedGates,
    candidateCount: candidates.length,
    topCandidates,
    modelCallCount: calls.length,
    chatModelCallCount,
    embeddingCallCount,
    roleFailureCount: failures.length,
    roleJsonFailureCount: failures.filter((failure) => failure.jsonFailure).length,
    roleFailures: failures,
    durationMs: durationMs == null ? null : Math.max(0, finiteNumber(durationMs, 0)),
    explanation: reasons.join("; "),
    provenance: item.provenance
  };
}

export function summarizeScheduleAssignmentEvaluation(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchRows = safeRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
  const durations = safeRows.map((row) => row.durationMs).filter((value) => Number.isFinite(value));
  const falseAutoCount = safeRows.filter((row) => row.falseAutomaticAssignment).length;
  const correctAutoCount = safeRows.filter((row) => row.correctAutomaticAssignment).length;
  const abstentionCount = safeRows.filter((row) => row.abstained).length;
  const candidateRecallByStage = Object.fromEntries(["deterministic", "semantic", "final"].map((stage) => {
    const relevant = safeRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
    return [stage, {
      at1: ratio(relevant.filter((row) => row.candidateRecallByStage?.[stage]?.at1).length, relevant.length),
      at5: ratio(relevant.filter((row) => row.candidateRecallByStage?.[stage]?.at5).length, relevant.length)
    }];
  }));
  return {
    evaluationVersion: SCHEDULE_ASSIGNMENT_EVALUATION_VERSION,
    caseCount: safeRows.length,
    labelledMatchCount: matchRows.length,
    candidateRecallAt1: ratio(matchRows.filter((row) => row.candidateRecallAt1).length, matchRows.length),
    candidateRecallAt5: ratio(matchRows.filter((row) => row.candidateRecallAt5).length, matchRows.length),
    candidateRecallByStage,
    correctAutomaticAssignmentCount: correctAutoCount,
    falseAutomaticAssignmentCount: falseAutoCount,
    falseAutomaticAssignmentRate: ratio(falseAutoCount, safeRows.length),
    abstentionCount,
    abstentionRate: ratio(abstentionCount, safeRows.length),
    roleFailureCount: safeRows.reduce((sum, row) => sum + finiteNumber(row.roleFailureCount, 0), 0),
    roleJsonFailureCount: safeRows.reduce((sum, row) => sum + finiteNumber(row.roleJsonFailureCount, 0), 0),
    totalModelCalls: safeRows.reduce((sum, row) => sum + finiteNumber(row.modelCallCount, 0), 0),
    totalChatModelCalls: safeRows.reduce((sum, row) => sum + finiteNumber(row.chatModelCallCount, 0), 0),
    totalEmbeddingCalls: safeRows.reduce((sum, row) => sum + finiteNumber(row.embeddingCallCount, 0), 0),
    averageCandidateCount: safeRows.length
      ? Number((safeRows.reduce((sum, row) => sum + finiteNumber(row.candidateCount, 0), 0) / safeRows.length).toFixed(2))
      : null,
    averageLatencyMs: durations.length
      ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(2))
      : null,
    p95LatencyMs: percentile(durations, 0.95),
    labelBreakdown: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((label) => [label, safeRows.filter((row) => row.labelType === label).length])),
    rows: safeRows
  };
}
