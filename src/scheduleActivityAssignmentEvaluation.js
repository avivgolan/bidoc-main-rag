import crypto from "node:crypto";
import {
  scheduleAssignmentConfigurationSnapshot,
  SCHEDULE_ASSIGNMENT_ENGINE_VERSION
} from "./scheduleActivityAssignmentEngine.js";
import { SCHEDULE_ASSIGNMENT_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";

export const SCHEDULE_ASSIGNMENT_EVALUATION_VERSION = "schedule-assignment-eval.v2";
export { SCHEDULE_ASSIGNMENT_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";

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

function numberDistribution(values = []) {
  const numbers = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!numbers.length) return { count: 0, min: null, p25: null, median: null, p75: null, max: null, mean: null };
  return {
    count: numbers.length,
    min: Math.min(...numbers),
    p25: percentile(numbers, 0.25),
    median: percentile(numbers, 0.5),
    p75: percentile(numbers, 0.75),
    max: Math.max(...numbers),
    mean: Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2))
  };
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
  const rank = positiveLabel ? keys.indexOf(expectedActivityKey) + 1 : 0;
  return {
    at1: positiveLabel ? keys[0] === expectedActivityKey : null,
    at5: positiveLabel ? keys.slice(0, 5).includes(expectedActivityKey) : null,
    inSet: positiveLabel ? rank > 0 : null,
    rank: positiveLabel && rank > 0 ? rank : null
  };
}

function compactEvaluationCandidate(candidate = {}) {
  return {
    rank: finiteNumber(candidate?.rank, 0) || null,
    activityKey: safeText(candidate?.activityKey, 500) || null,
    name: safeText(candidate?.name, 700) || null,
    plannedStart: safeText(candidate?.plannedStart, 30) || null,
    plannedFinish: safeText(candidate?.plannedFinish, 30) || null,
    outlineLevel: candidate?.outlineLevel == null ? null : finiteNumber(candidate.outlineLevel, 0),
    isMilestone: candidate?.isMilestone === true,
    finalScore: finiteNumber(candidate?.finalScore, 0),
    signals: candidate?.signals && typeof candidate.signals === "object" ? candidate.signals : {},
    supportingEvidence: Array.isArray(candidate?.supportingEvidence) ? candidate.supportingEvidence.slice(0, 10) : [],
    contradictingEvidence: Array.isArray(candidate?.contradictingEvidence) ? candidate.contradictingEvidence.slice(0, 10) : [],
    hardConflict: candidate?.hardConflict === true
  };
}

function compactRoleOutcome(value = {}) {
  const scores = Array.isArray(value?.scores) ? value.scores : [];
  return {
    ok: value?.ok === true,
    error: safeText(value?.error, 700) || null,
    decision: safeText(value?.decision, 80) || null,
    bestActivityKey: safeText(value?.bestActivityKey, 500) || null,
    selectedActivityKey: safeText(value?.selectedActivityKey, 500) || null,
    runnerUpActivityKey: safeText(value?.runnerUpActivityKey, 500) || null,
    reason: safeText(value?.reason, 1200) || null,
    scores: scores.slice(0, 50).map((row) => ({
      activityKey: safeText(row?.activityKey, 500) || null,
      score: finiteNumber(row?.score, 0),
      reason: safeText(row?.reason, 700) || null,
      hardConflict: row?.hardConflict === true
    }))
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
      reviewedAt: safeText(value?.provenance?.reviewedAt, 100) || null,
      recordOrigin: safeText(value?.provenance?.recordOrigin, 160) || null,
      assignmentMethod: safeText(value?.provenance?.assignmentMethod, 120) || null
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
      evaluatedLinkIds: [...new Set(normalizedCases.map((item) => item.provenance.linkId).filter(Boolean))],
      recordOrigins: Object.fromEntries([...new Set(normalizedCases.map((item) => item.provenance.recordOrigin).filter(Boolean))]
        .map((origin) => [origin, normalizedCases.filter((item) => item.provenance.recordOrigin === origin).length]))
    }
  };
}

export function evaluateScheduleAssignmentCase({ fixture, result = {}, durationMs = null } = {}) {
  const item = normalizeScheduleAssignmentEvaluationCase(fixture);
  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  const candidateKeys = candidates.map((candidate) => safeText(candidate?.activityKey, 500)).filter(Boolean);
  const allCandidates = candidates.map(compactEvaluationCandidate);
  const topCandidates = allCandidates.slice(0, 5);
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
  const usageTotals = result?.workflowLog?.openRouterUsage?.totals && typeof result.workflowLog.openRouterUsage.totals === "object"
    ? result.workflowLog.openRouterUsage.totals
    : {};
  const stageNames = [...new Set(["deterministic", "semantic", "retrieval", "final", ...Object.keys(result?.candidateStages || {})])];
  const candidateStages = Object.fromEntries(stageNames.map((stage) => {
    const rows = Array.isArray(result?.candidateStages?.[stage])
      ? result.candidateStages[stage]
      : stage === "final"
        ? candidates
        : [];
    return [stage, rows.map(compactEvaluationCandidate)];
  }));
  const stageKeys = Object.fromEntries(Object.entries(candidateStages)
    .map(([stage, rows]) => [stage, rows.map((candidate) => candidate.activityKey).filter(Boolean)]));
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
    rankingScore: finiteNumber(result?.decision?.rankingScore ?? result?.decision?.confidence, 0),
    runnerUpRankingScore: finiteNumber(result?.decision?.runnerUpRankingScore ?? result?.decision?.runnerUpConfidence, 0),
    rankingGap: finiteNumber(result?.decision?.rankingGap ?? result?.decision?.margin, 0),
    calibratedProbability: Number.isFinite(result?.decision?.calibratedProbability)
      ? Number(result.decision.calibratedProbability)
      : null,
    calibrationStatus: safeText(result?.decision?.calibration?.status, 80) || "unavailable",
    calibrationArtifactId: safeText(result?.decision?.calibration?.artifactId, 300) || null,
    calibrationReason: safeText(result?.decision?.calibration?.reason, 300) || null,
    matcherValidatorAgreement: typeof result?.decision?.roleAgreement === "boolean"
      ? result.decision.roleAgreement
      : Boolean(selectedActivityKey
        && result?.roles?.matcher?.bestActivityKey === selectedActivityKey
        && result?.roles?.validator?.bestActivityKey === selectedActivityKey),
    requiredRolesCompleted: typeof gates.requiredRolesCompleted === "boolean"
      ? gates.requiredRolesCompleted
      : gates.aiCompleted === true,
    judgeOutcome: safeText(result?.roles?.judge?.decision, 80) || "not_run",
    hardConflict: typeof result?.decision?.hardConflict === "boolean"
      ? result.decision.hardConflict
      : gates.noHardConflict === false,
    confidence: finiteNumber(result?.decision?.confidence, 0),
    runnerUpConfidence: finiteNumber(result?.decision?.runnerUpConfidence, 0),
    margin: finiteNumber(result?.decision?.margin, 0),
    gates,
    failedGates,
    candidateCount: candidates.length,
    topCandidates,
    allCandidates,
    candidateStages,
    roleOutcomes: Object.fromEntries(Object.entries(result?.roles || {}).map(([role, value]) => [role, compactRoleOutcome(value)])),
    retrieval: result?.retrieval && typeof result.retrieval === "object" ? result.retrieval : null,
    modelCallCount: calls.length,
    chatModelCallCount,
    embeddingCallCount,
    roleFailureCount: failures.length,
    roleJsonFailureCount: failures.filter((failure) => failure.jsonFailure).length,
    roleFailures: failures,
    providerCost: Number.isFinite(Number(usageTotals.cost)) ? Number(usageTotals.cost) : null,
    totalTokens: Number.isFinite(Number(usageTotals.total_tokens)) ? Number(usageTotals.total_tokens) : null,
    durationMs: durationMs == null ? null : Math.max(0, finiteNumber(durationMs, 0)),
    explanation: reasons.join("; "),
    provenance: item.provenance
  };
}

export function buildScheduleAssignmentPolicySweep(rows = [], {
  thresholds = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95],
  margins = [0, 1, 3, 5, 10, 12, 15, 20]
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const uniqueThresholds = [...new Set(thresholds.map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  const uniqueMargins = [...new Set(margins.map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  return uniqueThresholds.flatMap((threshold) => uniqueMargins.map((margin) => {
    const eligibleRows = safeRows.filter((row) => {
      const gates = row?.gates && typeof row.gates === "object" ? row.gates : {};
      const nonTunableGatesPass = Object.entries(gates)
        .filter(([gate]) => !["threshold", "calibratedThreshold", "margin"].includes(gate))
        .every(([, passed]) => passed === true);
      return nonTunableGatesPass && finiteNumber(row.confidence, 0) >= threshold && finiteNumber(row.margin, 0) >= margin;
    });
    const correctRows = eligibleRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH && row.selectedActivityKey === row.expectedActivityKey);
    const falseRows = eligibleRows.filter((row) => !correctRows.includes(row));
    return {
      threshold,
      margin,
      eligibleCount: eligibleRows.length,
      correctAutomaticAssignmentCount: correctRows.length,
      falseAutomaticAssignmentCount: falseRows.length,
      coverageRate: ratio(eligibleRows.length, safeRows.length),
      falseRateAmongEligible: ratio(falseRows.length, eligibleRows.length),
      abstentionCount: safeRows.length - eligibleRows.length,
      labelBreakdown: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((label) => [label, eligibleRows.filter((row) => row.labelType === label).length]))
    };
  }));
}

export function summarizeScheduleAssignmentEvaluation(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const matchRows = safeRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
  const durations = safeRows.map((row) => row.durationMs).filter((value) => Number.isFinite(value));
  const falseAutoCount = safeRows.filter((row) => row.falseAutomaticAssignment).length;
  const correctAutoCount = safeRows.filter((row) => row.correctAutomaticAssignment).length;
  const abstentionCount = safeRows.filter((row) => row.abstained).length;
  const stageNames = [...new Set(["deterministic", "semantic", "retrieval", "final", ...safeRows.flatMap((row) => Object.keys(row.candidateRecallByStage || {}))])];
  const candidateRecallByStage = Object.fromEntries(stageNames.map((stage) => {
    const relevant = safeRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
    return [stage, {
      at1: ratio(relevant.filter((row) => row.candidateRecallByStage?.[stage]?.at1).length, relevant.length),
      at5: ratio(relevant.filter((row) => row.candidateRecallByStage?.[stage]?.at5).length, relevant.length),
      inSet: ratio(relevant.filter((row) => row.candidateRecallByStage?.[stage]?.inSet).length, relevant.length)
    }];
  }));
  const decisionByLabel = Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((label) => {
    const labelledRows = safeRows.filter((row) => row.labelType === label);
    return [label, Object.fromEntries([...new Set(labelledRows.map((row) => row.decisionType || "unknown"))]
      .map((decision) => [decision, labelledRows.filter((row) => (row.decisionType || "unknown") === decision).length]))];
  }));
  const failedGateBreakdown = Object.fromEntries([...new Set(safeRows.flatMap((row) => row.failedGates || []))]
    .map((gate) => [gate, safeRows.filter((row) => row.failedGates?.includes(gate)).length]));
  const positiveRows = safeRows.filter((row) => row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
  const negativeRows = safeRows.filter((row) => row.labelType !== SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH);
  const retrievalRows = safeRows.filter((row) => row.retrieval);
  return {
    evaluationVersion: SCHEDULE_ASSIGNMENT_EVALUATION_VERSION,
    caseCount: safeRows.length,
    labelledMatchCount: matchRows.length,
    candidateRecallAt1: ratio(matchRows.filter((row) => row.candidateRecallAt1).length, matchRows.length),
    candidateRecallAt5: ratio(matchRows.filter((row) => row.candidateRecallAt5).length, matchRows.length),
    candidateRecallByStage,
    decisionByLabel,
    failedGateBreakdown,
    scoreDistributions: {
      confirmedMatch: {
        rankingScore: numberDistribution(positiveRows.map((row) => row.rankingScore ?? row.confidence)),
        rankingGap: numberDistribution(positiveRows.map((row) => row.rankingGap ?? row.margin)),
        calibratedProbability: numberDistribution(positiveRows.map((row) => row.calibratedProbability).filter(Number.isFinite)),
        confidence: numberDistribution(positiveRows.map((row) => row.confidence)),
        margin: numberDistribution(positiveRows.map((row) => row.margin))
      },
      nonConfirmed: {
        rankingScore: numberDistribution(negativeRows.map((row) => row.rankingScore ?? row.confidence)),
        rankingGap: numberDistribution(negativeRows.map((row) => row.rankingGap ?? row.margin)),
        calibratedProbability: numberDistribution(negativeRows.map((row) => row.calibratedProbability).filter(Number.isFinite)),
        confidence: numberDistribution(negativeRows.map((row) => row.confidence)),
        margin: numberDistribution(negativeRows.map((row) => row.margin))
      }
    },
    calibrationDiagnostics: {
      statuses: Object.fromEntries([...new Set(safeRows.map((row) => row.calibrationStatus || "unavailable"))]
        .map((status) => [status, safeRows.filter((row) => (row.calibrationStatus || "unavailable") === status).length])),
      calibratedCaseCount: safeRows.filter((row) => Number.isFinite(row.calibratedProbability)).length,
      artifactIds: [...new Set(safeRows.map((row) => row.calibrationArtifactId).filter(Boolean))]
    },
    retrievalDiagnostics: {
      strategies: Object.fromEntries([...new Set(retrievalRows.map((row) => row.retrieval.strategy).filter(Boolean))]
        .map((strategy) => [strategy, retrievalRows.filter((row) => row.retrieval.strategy === strategy).length])),
      modelCandidateCount: numberDistribution(retrievalRows.map((row) => row.retrieval.modelCandidateCount)),
      scoredSemanticCandidateCount: numberDistribution(retrievalRows.map((row) => row.retrieval.scoredSemanticCandidateCount)),
      cacheHits: retrievalRows.reduce((sum, row) => sum + finiteNumber(row.retrieval.cache?.cache_hits, 0), 0),
      cacheMisses: retrievalRows.reduce((sum, row) => sum + finiteNumber(row.retrieval.cache?.cache_misses, 0), 0),
      savedEmbeddingCalls: retrievalRows.reduce((sum, row) => sum + finiteNumber(row.retrieval.cache?.saved_embedding_calls, 0), 0)
    },
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
    rawScorePolicySweepWarning: "This sweep uses the uncalibrated ranking score and cannot authorize a production threshold.",
    rawScorePolicySweep: buildScheduleAssignmentPolicySweep(safeRows),
    rows: safeRows
  };
}
