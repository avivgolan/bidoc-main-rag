import { SCHEDULE_ASSIGNMENT_ENGINE_VERSION } from "./scheduleActivityAssignmentEngine.js";
import { SCHEDULE_ASSIGNMENT_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";
import {
  evaluateScheduleAssignmentPolicyRow,
  scheduleAssignmentPolicyEvidenceRow,
  SCHEDULE_ASSIGNMENT_POLICY_ARTIFACT_VERSION,
  SCHEDULE_ASSIGNMENT_POLICY_FEATURE_VERSION
} from "./scheduleActivityAssignmentPolicy.js";
import {
  SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION,
  SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION
} from "./scheduleActivityAssignmentCalibration.js";

export const SCHEDULE_ASSIGNMENT_SHADOW_SCHEMA_VERSION = "schedule-assignment-shadow-observation.v1";
export const SCHEDULE_ASSIGNMENT_SHADOW_MODE = "shadow_read_only";
export const SCHEDULE_ASSIGNMENT_SHADOW_MINIMUM_REVIEWED_CASES = 50;
export const SCHEDULE_ASSIGNMENT_SHADOW_RETRIEVAL = Object.freeze({
  strategy: "hybrid_union",
  semanticPoolLimit: 20,
  modelCandidateLimit: 20
});

export const SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR = Object.freeze({
  artifactVersion: SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION,
  artifactId: "schedule-assignment-calibrator:e14941848ae46effce000f6de175d218839a3f76868b83487b2ae07bd69e2964",
  context: Object.freeze({
    featureVersion: SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION,
    engineVersion: "schedule-assignment.v2.1-rc1",
    scheduleVersionId: "1787251318726_MS_Project.xml",
    settingsVersion: "schedule-assignment-openai.v2.1-rc1",
    configurationSnapshotId: "schedule-assignment-config:9f2fb7c98d4faae092c69927b92b0e1dcbcb4bd318344f08b7b9557d91d7b4d0",
    fixtureHash: "sha256:624149641bfe74d5791ce2f549a378c9dc13485b6e8230929b43c3021baf7bb2",
    retrieval: SCHEDULE_ASSIGNMENT_SHADOW_RETRIEVAL
  }),
  selectedMethod: "platt",
  selectedModel: Object.freeze({
    method: "platt",
    coefficient: 0.6101315980625583,
    intercept: -0.29811118126448644,
    mean: 0.5988534090909092,
    scale: 0.09951658551639628
  }),
  readyForProduction: true,
  readinessReasons: Object.freeze([])
});

export const SCHEDULE_ASSIGNMENT_SHADOW_POLICY = Object.freeze({
  artifactVersion: SCHEDULE_ASSIGNMENT_POLICY_ARTIFACT_VERSION,
  artifactId: "schedule-assignment-policy:8adc1afe588b500c3b372fd70c98aba0f31f632221cb9220fe111f3cc49d9c67",
  context: Object.freeze({
    policyFeatureVersion: SCHEDULE_ASSIGNMENT_POLICY_FEATURE_VERSION,
    calibrationArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.artifactId,
    calibrationFeatureVersion: SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION,
    engineVersion: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.engineVersion,
    scheduleVersionId: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.scheduleVersionId,
    settingsVersion: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.settingsVersion,
    configurationSnapshotId: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.configurationSnapshotId,
    datasetHash: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.fixtureHash
  }),
  selectedPolicy: Object.freeze({
    probabilityThreshold: 0.5,
    rankingMargin: 12,
    requireMatcherValidatorAgreement: true,
    requireJudgeMatchWhenRun: true,
    blockHardConflict: true,
    policyId: "schedule-assignment-policy-config:d552d66e4cb7d251f979efc92331e480b7c755bf6844976aad99a0902c88ad11",
    safetyEligible: true,
    enabled: false
  }),
  baselineAcceptance: Object.freeze({
    caseCount: 32,
    eligibleCount: 4,
    correctAutomaticAssignmentCount: 4,
    falseAutomaticAssignmentCount: 0,
    safeCoverageRate: 0.125,
    calibratedProbabilityMean: 0.613607,
    rankingGapMean: 19.415
  }),
  readyForShadow: true,
  readyForProduction: false,
  readinessReasons: Object.freeze([])
});

const NEGATIVE_LABEL_TYPES = new Set([
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.NO_MATCH,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.IRRELEVANT_ALERT,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.AMBIGUOUS
]);

function safeText(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, "").trim().slice(0, max);
}

function finiteNumber(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
}

function distribution(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!numbers.length) return { count: 0, min: null, median: null, p95: null, max: null, mean: null };
  const percentile = (fraction) => numbers[Math.min(numbers.length - 1, Math.max(0, Math.ceil(numbers.length * fraction) - 1))];
  return {
    count: numbers.length,
    min: numbers[0],
    median: percentile(0.5),
    p95: percentile(0.95),
    max: numbers[numbers.length - 1],
    mean: Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(6))
  };
}

function roleFailureCount(roles = {}) {
  return Object.values(roles && typeof roles === "object" ? roles : {}).filter((role) => {
    const error = safeText(role?.error, 160);
    return Boolean(error && !["not_run", "not_required", "not_requested", "disabled"].includes(error));
  }).length;
}

function compatibilityReasons(result = {}) {
  const reasons = [];
  const context = SCHEDULE_ASSIGNMENT_SHADOW_POLICY.context;
  if (SCHEDULE_ASSIGNMENT_SHADOW_POLICY.readyForShadow !== true) reasons.push("policy_not_ready_for_shadow");
  if (SCHEDULE_ASSIGNMENT_SHADOW_POLICY.readyForProduction === true) reasons.push("shadow_policy_must_not_be_production_ready");
  if (SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy?.enabled !== false) reasons.push("shadow_policy_must_remain_disabled");
  if (SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy?.safetyEligible !== true) reasons.push("shadow_policy_safety_gates_missing");
  if (context.calibrationArtifactId !== SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.artifactId) reasons.push("calibration_artifact_id_mismatch");
  const fields = ["engineVersion", "scheduleVersionId", "settingsVersion", "configurationSnapshotId"];
  for (const field of fields) {
    if (safeText(result?.[field], 500) !== safeText(context[field], 500)) reasons.push(`${field}_mismatch`);
  }
  const expectedRetrieval = SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.context.retrieval;
  for (const field of ["strategy", "semanticPoolLimit", "modelCandidateLimit"]) {
    if (safeText(result?.retrieval?.[field], 160) !== safeText(expectedRetrieval[field], 160)) reasons.push(`retrieval_${field}_mismatch`);
  }
  if (result?.dryRun !== true) reasons.push("shadow_run_not_dry_run");
  if (result?.assignment) reasons.push("shadow_assignment_write_detected");
  if (result?.decision?.autoAssigned === true) reasons.push("shadow_auto_assignment_detected");
  return [...new Set(reasons)];
}

function shadowEvidenceRow(result = {}, { durationMs = null, openRouterUsage = {} } = {}) {
  const decision = result.decision && typeof result.decision === "object" ? result.decision : {};
  const totals = openRouterUsage?.totals && typeof openRouterUsage.totals === "object" ? openRouterUsage.totals : {};
  return {
    caseId: safeText(result.runId, 500),
    sourceId: safeText(result.sourceId, 160),
    selectedActivityKey: safeText(decision.selectedActivityKey, 500) || null,
    decisionType: safeText(decision.type, 80) || null,
    rankingScore: finiteNumber(decision.rankingScore ?? decision.confidence, 0),
    runnerUpRankingScore: finiteNumber(decision.runnerUpRankingScore ?? decision.runnerUpConfidence, 0),
    rankingGap: finiteNumber(decision.rankingGap ?? decision.margin, 0),
    gates: decision.gates && typeof decision.gates === "object" ? decision.gates : {},
    roleAgreement: decision.roleAgreement === true,
    hardConflict: decision.hardConflict === true,
    roleOutcomes: result.roles && typeof result.roles === "object" ? result.roles : {},
    topCandidates: (Array.isArray(result.candidates) ? result.candidates : []).slice(0, 5),
    allCandidates: (Array.isArray(result.candidates) ? result.candidates : []).slice(0, 8),
    roleFailureCount: roleFailureCount(result.roles),
    durationMs: finiteNumber(durationMs),
    providerCost: finiteNumber(totals.cost ?? totals.provider_cost ?? totals.total_cost),
    totalTokens: finiteNumber(totals.total_tokens ?? totals.totalTokens)
  };
}

export function buildScheduleAssignmentShadowObservation({
  result = {},
  observedAt = new Date().toISOString(),
  durationMs = null,
  openRouterUsage = {}
} = {}) {
  const reasons = compatibilityReasons(result);
  const evidence = shadowEvidenceRow(result, { durationMs, openRouterUsage });
  const calibrated = reasons.length
    ? { ...evidence, calibratedProbability: null }
    : scheduleAssignmentPolicyEvidenceRow(evidence, SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR);
  const outcome = reasons.length
    ? { eligible: false, gates: {}, policy: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy }
    : evaluateScheduleAssignmentPolicyRow(calibrated, SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy);
  return {
    schemaVersion: SCHEDULE_ASSIGNMENT_SHADOW_SCHEMA_VERSION,
    mode: SCHEDULE_ASSIGNMENT_SHADOW_MODE,
    observedAt: safeText(observedAt, 100),
    compatible: reasons.length === 0,
    compatibilityReasons: reasons,
    policyArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.artifactId,
    policyId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy.policyId,
    calibrationArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.artifactId,
    retrieval: { ...SCHEDULE_ASSIGNMENT_SHADOW_RETRIEVAL },
    writeAllowed: false,
    assignmentCreated: false,
    wouldAutoAssign: reasons.length === 0 && outcome.eligible === true,
    selectedActivityKey: evidence.selectedActivityKey,
    rankingScore: evidence.rankingScore,
    runnerUpRankingScore: evidence.runnerUpRankingScore,
    rankingGap: evidence.rankingGap,
    calibratedProbability: finiteNumber(calibrated.calibratedProbability),
    policyGates: outcome.gates || {},
    roleFailureCount: evidence.roleFailureCount,
    durationMs: evidence.durationMs,
    providerCost: evidence.providerCost,
    totalTokens: evidence.totalTokens,
    candidateCount: evidence.allCandidates.length
  };
}

function normalizeStoredObservation(row = {}) {
  const shadow = row?.decision_snapshot?.shadow;
  if (!shadow || shadow.schemaVersion !== SCHEDULE_ASSIGNMENT_SHADOW_SCHEMA_VERSION) return null;
  return {
    row,
    shadow,
    labelType: safeText(row.evaluation_label_type, 80) || null,
    expectedActivityKey: safeText(row.expected_activity_key, 500) || null,
    candidateKeys: (Array.isArray(row.candidates_snapshot) ? row.candidates_snapshot : [])
      .map((candidate) => safeText(candidate?.activityKey, 500))
      .filter(Boolean)
  };
}

export function summarizeScheduleAssignmentShadowRows(rows = [], {
  minimumReviewedCaseCount = SCHEDULE_ASSIGNMENT_SHADOW_MINIMUM_REVIEWED_CASES
} = {}) {
  const observations = (Array.isArray(rows) ? rows : []).map(normalizeStoredObservation).filter(Boolean);
  const compatible = observations.filter((item) => item.shadow.compatible === true);
  const reviewed = compatible.filter((item) => item.labelType);
  const eligibleReviewed = reviewed.filter((item) => item.shadow.wouldAutoAssign === true);
  const correctEligible = eligibleReviewed.filter((item) => item.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH
    && item.expectedActivityKey
    && item.shadow.selectedActivityKey === item.expectedActivityKey);
  const falseEligible = eligibleReviewed.filter((item) => !correctEligible.includes(item));
  const negativeReviewed = reviewed.filter((item) => NEGATIVE_LABEL_TYPES.has(item.labelType));
  const writeViolations = observations.filter((item) => item.shadow.writeAllowed !== false || item.shadow.assignmentCreated === true);
  const roleFailures = compatible.filter((item) => finiteNumber(item.shadow.roleFailureCount, 0) > 0);
  const probabilityDistribution = distribution(compatible.map((item) => item.shadow.calibratedProbability));
  const rankingGapDistribution = distribution(compatible.map((item) => item.shadow.rankingGap));
  const latencyDistribution = distribution(compatible.map((item) => item.shadow.durationMs));
  const baseline = SCHEDULE_ASSIGNMENT_SHADOW_POLICY.baselineAcceptance;
  const probabilityMeanDrift = probabilityDistribution.mean == null ? null : Number((probabilityDistribution.mean - baseline.calibratedProbabilityMean).toFixed(6));
  const rankingGapMeanDrift = rankingGapDistribution.mean == null ? null : Number((rankingGapDistribution.mean - baseline.rankingGapMean).toFixed(6));
  const readinessReasons = [];
  if (observations.length !== compatible.length) readinessReasons.push("incompatible_shadow_observations_present");
  if (reviewed.length < minimumReviewedCaseCount) readinessReasons.push("minimum_reviewed_shadow_sample_not_met");
  if (eligibleReviewed.length < 5) readinessReasons.push("minimum_eligible_shadow_sample_not_met");
  if (negativeReviewed.length < 10) readinessReasons.push("minimum_negative_shadow_sample_not_met");
  if (falseEligible.length) readinessReasons.push("false_automatic_eligibility_observed");
  if (writeViolations.length) readinessReasons.push("shadow_write_boundary_violation");
  if (compatible.length >= 20 && probabilityMeanDrift != null && Math.abs(probabilityMeanDrift) > 0.15) readinessReasons.push("calibrated_probability_drift_detected");
  if (compatible.length >= 20 && rankingGapMeanDrift != null && Math.abs(rankingGapMeanDrift) > 10) readinessReasons.push("ranking_gap_drift_detected");
  if (compatible.length >= 20 && ratio(roleFailures.length, compatible.length) > 0.05) readinessReasons.push("role_failure_rate_too_high");
  return {
    schemaVersion: "schedule-assignment-shadow-report.v1",
    mode: SCHEDULE_ASSIGNMENT_SHADOW_MODE,
    policyArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.artifactId,
    policyId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy.policyId,
    automaticWritesEnabled: false,
    minimumReviewedCaseCount,
    observationCount: observations.length,
    compatibleObservationCount: compatible.length,
    incompatibleObservationCount: observations.length - compatible.length,
    pendingObservationCount: compatible.filter((item) => !item.labelType).length,
    reviewedObservationCount: reviewed.length,
    negativeReviewedObservationCount: negativeReviewed.length,
    eligibleReviewedCount: eligibleReviewed.length,
    correctEligibleCount: correctEligible.length,
    falseEligibleCount: falseEligible.length,
    safeCoverageRate: ratio(correctEligible.length, reviewed.length),
    falseRateAmongEligible: ratio(falseEligible.length, eligibleReviewed.length),
    roleFailureObservationCount: roleFailures.length,
    roleFailureRate: ratio(roleFailures.length, compatible.length),
    writeViolationCount: writeViolations.length,
    labelBreakdown: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES)
      .map((type) => [type, reviewed.filter((item) => item.labelType === type).length])),
    distributions: {
      calibratedProbability: probabilityDistribution,
      rankingGap: rankingGapDistribution,
      latencyMs: latencyDistribution
    },
    drift: {
      baselineAcceptance: baseline,
      calibratedProbabilityMeanDelta: probabilityMeanDrift,
      rankingGapMeanDelta: rankingGapMeanDrift,
      evaluated: compatible.length >= 20
    },
    readyForPhase7: readinessReasons.length === 0,
    readinessReasons,
    compatibilityReasonBreakdown: Object.fromEntries([...new Set(observations.flatMap((item) => item.shadow.compatibilityReasons || []))]
      .map((reason) => [reason, observations.filter((item) => (item.shadow.compatibilityReasons || []).includes(reason)).length]))
  };
}

export function scheduleAssignmentShadowRuntimeStatus() {
  return {
    mode: SCHEDULE_ASSIGNMENT_SHADOW_MODE,
    engineVersion: SCHEDULE_ASSIGNMENT_ENGINE_VERSION,
    policyArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.artifactId,
    policyId: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy.policyId,
    calibrationArtifactId: SCHEDULE_ASSIGNMENT_SHADOW_CALIBRATOR.artifactId,
    retrieval: { ...SCHEDULE_ASSIGNMENT_SHADOW_RETRIEVAL },
    automaticWritesEnabled: false,
    readyForShadow: SCHEDULE_ASSIGNMENT_SHADOW_POLICY.readyForShadow,
    readyForProduction: false
  };
}
