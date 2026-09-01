import crypto from "node:crypto";
import {
  predictScheduleAssignmentCalibration,
  scheduleAssignmentCalibrationExample,
  SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION,
  SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION
} from "./scheduleActivityAssignmentCalibration.js";
import { SCHEDULE_ASSIGNMENT_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";

export const SCHEDULE_ASSIGNMENT_POLICY_ARTIFACT_VERSION = "schedule-assignment-policy.v1";
export const SCHEDULE_ASSIGNMENT_POLICY_FEATURE_VERSION = "schedule-assignment-policy-features.v1";

export const DEFAULT_SCHEDULE_ASSIGNMENT_POLICY_GRID = Object.freeze({
  probabilityThresholds: Object.freeze([0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]),
  rankingMargins: Object.freeze([1, 3, 5, 10, 12, 15, 20]),
  requireMatcherValidatorAgreement: Object.freeze([true, false]),
  requireJudgeMatchWhenRun: Object.freeze([false, true]),
  blockHardConflict: Object.freeze([true, false])
});

const NON_RUN_JUDGE_OUTCOMES = new Set(["", "not_run", "not_required", "not_requested", "disabled", "unavailable"]);

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : null;
}

function percentile(values = [], fraction = 0.5) {
  const numbers = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!numbers.length) return null;
  const index = Math.min(numbers.length - 1, Math.max(0, Math.ceil(numbers.length * fraction) - 1));
  return numbers[index];
}

function distribution(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return { count: 0, min: null, median: null, p95: null, max: null, mean: null };
  return {
    count: numbers.length,
    min: Math.min(...numbers),
    median: percentile(numbers, 0.5),
    p95: percentile(numbers, 0.95),
    max: Math.max(...numbers),
    mean: Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(6))
  };
}

function uniqueSortedNumbers(values = [], { min = -Infinity, max = Infinity } = {}) {
  return [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value >= min && value <= max))]
    .sort((left, right) => left - right);
}

function booleanDimension(values = [], fallback = []) {
  const normalized = [...new Set(values.filter((value) => typeof value === "boolean"))];
  return normalized.length ? normalized : [...fallback];
}

function gateValue(row = {}, name, fallback = false) {
  if (typeof row?.gates?.[name] === "boolean") return row.gates[name];
  if (typeof row?.[name] === "boolean") return row[name];
  return fallback;
}

function matcherValidatorAgreement(row = {}) {
  if (typeof row.matcherValidatorAgreement === "boolean") return row.matcherValidatorAgreement;
  if (typeof row.roleAgreement === "boolean") return row.roleAgreement;
  const selected = row.selectedActivityKey || null;
  const matcher = row.roleOutcomes?.matcher?.bestActivityKey || row.roleOutcomes?.matcher?.selectedActivityKey || null;
  const validator = row.roleOutcomes?.validator?.bestActivityKey || row.roleOutcomes?.validator?.selectedActivityKey || null;
  return Boolean(selected && matcher === selected && validator === selected);
}

function judgeOutcome(row = {}) {
  return String(row.judgeOutcome || row.roleOutcomes?.judge?.decision || row.roles?.judge?.decision || "not_run").trim().toLowerCase();
}

function hasHardConflict(row = {}) {
  if (typeof row.hardConflict === "boolean") return row.hardConflict;
  if (typeof row?.gates?.noHardConflict === "boolean") return row.gates.noHardConflict !== true;
  const selected = (row.allCandidates || row.topCandidates || []).find((candidate) => candidate.activityKey === row.selectedActivityKey);
  return selected?.hardConflict === true || ["conflict", "no_match"].includes(judgeOutcome(row));
}

function requiredRolesCompleted(row = {}) {
  if (typeof row.requiredRolesCompleted === "boolean") return row.requiredRolesCompleted;
  if (typeof row?.gates?.requiredRolesCompleted === "boolean") return row.gates.requiredRolesCompleted;
  if (typeof row?.gates?.aiCompleted === "boolean") return row.gates.aiCompleted;
  return row.roleFailureCount === 0;
}

function calibratedProbabilityForRow(row = {}, calibrationArtifact = null) {
  if (!calibrationArtifact || calibrationArtifact.selectedMethod === "control" || !calibrationArtifact.selectedModel) return null;
  const example = scheduleAssignmentCalibrationExample(row);
  return finiteNumber(predictScheduleAssignmentCalibration(calibrationArtifact.selectedModel, example.features));
}

export function scheduleAssignmentPolicyEvidenceRow(row = {}, calibrationArtifact = null) {
  const outcome = judgeOutcome(row);
  const probability = calibratedProbabilityForRow(row, calibrationArtifact);
  return {
    ...row,
    calibratedProbability: probability,
    matcherValidatorAgreement: matcherValidatorAgreement(row),
    requiredRolesCompleted: requiredRolesCompleted(row),
    judgeOutcome: outcome,
    judgeRan: !NON_RUN_JUDGE_OUTCOMES.has(outcome),
    hardConflict: hasHardConflict(row),
    providerCost: finiteNumber(row.providerCost),
    totalTokens: finiteNumber(row.totalTokens),
    durationMs: finiteNumber(row.durationMs),
    rankingGap: finiteNumber(row.rankingGap ?? row.margin, 0)
  };
}

function normalizePolicyConfig(value = {}) {
  const policy = {
    probabilityThreshold: finiteNumber(value.probabilityThreshold, 0.9),
    rankingMargin: finiteNumber(value.rankingMargin, 12),
    requireMatcherValidatorAgreement: value.requireMatcherValidatorAgreement !== false,
    requireJudgeMatchWhenRun: value.requireJudgeMatchWhenRun === true,
    blockHardConflict: value.blockHardConflict !== false
  };
  return {
    ...policy,
    policyId: `schedule-assignment-policy-config:${sha256(policy)}`,
    safetyEligible: policy.requireMatcherValidatorAgreement === true && policy.blockHardConflict === true
  };
}

function policyRowEligible(row = {}, config = {}) {
  const policy = normalizePolicyConfig(config);
  const outcome = judgeOutcome(row);
  const judgePass = !policy.requireJudgeMatchWhenRun || NON_RUN_JUDGE_OUTCOMES.has(outcome) || outcome === "match";
  const structuralGates = {
    decisionMatch: row.decisionType === "match" || gateValue(row, "decisionMatch"),
    calibratedProbability: Number.isFinite(row.calibratedProbability) && row.calibratedProbability >= policy.probabilityThreshold,
    rankingMargin: finiteNumber(row.rankingGap ?? row.margin, 0) >= policy.rankingMargin,
    noHardConflict: !policy.blockHardConflict || !hasHardConflict(row),
    canonicalDate: gateValue(row, "canonicalDate"),
    activeScheduleActivity: gateValue(row, "activeScheduleActivity"),
    unassigned: gateValue(row, "unassigned"),
    freshRun: gateValue(row, "freshRun"),
    requiredRolesCompleted: requiredRolesCompleted(row),
    matcherValidatorAgreement: !policy.requireMatcherValidatorAgreement || matcherValidatorAgreement(row),
    judgeOutcome: judgePass
  };
  return {
    eligible: Object.values(structuralGates).every(Boolean),
    gates: structuralGates,
    policy
  };
}

function policyOutcome(row = {}, config = {}) {
  const result = policyRowEligible(row, config);
  const correct = result.eligible
    && row.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH
    && Boolean(row.expectedActivityKey)
    && row.selectedActivityKey === row.expectedActivityKey;
  return {
    ...result,
    correctAutomaticAssignment: correct,
    falseAutomaticAssignment: result.eligible && !correct
  };
}

export function evaluateScheduleAssignmentPolicyRow(row = {}, config = {}) {
  return policyOutcome(row, config);
}

export function evaluateScheduleAssignmentPolicyConfiguration(rows = [], config = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const policy = normalizePolicyConfig(config);
  const outcomes = safeRows.map((row) => ({ row, ...policyOutcome(row, policy) }));
  const eligible = outcomes.filter((item) => item.eligible);
  const correct = outcomes.filter((item) => item.correctAutomaticAssignment);
  const falseAutomatic = outcomes.filter((item) => item.falseAutomaticAssignment);
  const eligibleCosts = eligible.map((item) => item.row.providerCost).filter(Number.isFinite);
  const eligibleTokens = eligible.map((item) => item.row.totalTokens).filter(Number.isFinite);
  const eligibleDurations = eligible.map((item) => item.row.durationMs).filter(Number.isFinite);
  return {
    ...policy,
    caseCount: safeRows.length,
    eligibleCount: eligible.length,
    correctAutomaticAssignmentCount: correct.length,
    falseAutomaticAssignmentCount: falseAutomatic.length,
    safeCoverageRate: ratio(correct.length, safeRows.length),
    eligibleCoverageRate: ratio(eligible.length, safeRows.length),
    falseRateAmongEligible: ratio(falseAutomatic.length, eligible.length),
    abstentionCount: safeRows.length - eligible.length,
    abstentionRate: ratio(safeRows.length - eligible.length, safeRows.length),
    perLabelOutcomes: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((labelType) => {
      const labelRows = outcomes.filter((item) => item.row.labelType === labelType);
      return [labelType, {
        caseCount: labelRows.length,
        eligibleCount: labelRows.filter((item) => item.eligible).length,
        correctAutomaticAssignmentCount: labelRows.filter((item) => item.correctAutomaticAssignment).length,
        falseAutomaticAssignmentCount: labelRows.filter((item) => item.falseAutomaticAssignment).length
      }];
    })),
    distributions: {
      eligibleProbability: distribution(eligible.map((item) => item.row.calibratedProbability)),
      eligibleRankingMargin: distribution(eligible.map((item) => item.row.rankingGap)),
      falseAutomaticProbability: distribution(falseAutomatic.map((item) => item.row.calibratedProbability)),
      falseAutomaticRankingMargin: distribution(falseAutomatic.map((item) => item.row.rankingGap)),
      eligibleLatencyMs: distribution(eligibleDurations),
      eligibleProviderCost: distribution(eligibleCosts),
      eligibleTotalTokens: distribution(eligibleTokens)
    },
    totalEligibleProviderCost: eligibleCosts.length ? Number(eligibleCosts.reduce((sum, value) => sum + value, 0).toFixed(8)) : null,
    totalEligibleTokens: eligibleTokens.length ? eligibleTokens.reduce((sum, value) => sum + value, 0) : null
  };
}

export function buildScheduleAssignmentCalibratedPolicySweep(rows = [], {
  calibrationArtifact = null,
  grid = DEFAULT_SCHEDULE_ASSIGNMENT_POLICY_GRID
} = {}) {
  const evidenceRows = (Array.isArray(rows) ? rows : []).map((row) => scheduleAssignmentPolicyEvidenceRow(row, calibrationArtifact));
  const probabilityThresholds = uniqueSortedNumbers(grid.probabilityThresholds, { min: 0, max: 1 });
  const rankingMargins = uniqueSortedNumbers(grid.rankingMargins, { min: 0, max: 100 });
  const agreementRequirements = booleanDimension(grid.requireMatcherValidatorAgreement, [true]);
  const judgeRequirements = booleanDimension(grid.requireJudgeMatchWhenRun, [false]);
  const hardConflictRequirements = booleanDimension(grid.blockHardConflict, [true]);
  return probabilityThresholds.flatMap((probabilityThreshold) => rankingMargins.flatMap((rankingMargin) => agreementRequirements.flatMap((requireMatcherValidatorAgreement) => judgeRequirements.flatMap((requireJudgeMatchWhenRun) => hardConflictRequirements.map((blockHardConflict) => evaluateScheduleAssignmentPolicyConfiguration(evidenceRows, {
    probabilityThreshold,
    rankingMargin,
    requireMatcherValidatorAgreement,
    requireJudgeMatchWhenRun,
    blockHardConflict
  }))))));
}

function calibrationReadinessReasons(artifact = null) {
  if (!artifact) return ["calibration_artifact_missing"];
  const reasons = [];
  if (artifact.artifactVersion !== SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION) reasons.push("calibration_artifact_version_mismatch");
  if (artifact.context?.featureVersion !== SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION) reasons.push("calibration_feature_version_mismatch");
  if (artifact.readyForProduction !== true) reasons.push("calibration_artifact_not_ready");
  if (artifact.selectedMethod === "control") reasons.push("calibration_method_is_uncalibrated_control");
  if (!artifact.selectedModel) reasons.push("calibration_model_missing");
  return reasons;
}

function bestZeroFalsePolicy(sweep = []) {
  return sweep
    .filter((item) => item.safetyEligible && item.falseAutomaticAssignmentCount === 0 && item.correctAutomaticAssignmentCount > 0)
    .sort((left, right) => right.correctAutomaticAssignmentCount - left.correctAutomaticAssignmentCount
      || right.safeCoverageRate - left.safeCoverageRate
      || right.probabilityThreshold - left.probabilityThreshold
      || right.rankingMargin - left.rankingMargin
      || Number(right.requireJudgeMatchWhenRun) - Number(left.requireJudgeMatchWhenRun))[0] || null;
}

export function buildScheduleAssignmentPolicyArtifact({
  rows = [],
  calibrationArtifact = null,
  manifest = {},
  grid = DEFAULT_SCHEDULE_ASSIGNMENT_POLICY_GRID
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowsByCaseId = new Map(safeRows.map((row) => [String(row.caseId || ""), row]));
  const selectionCaseIds = calibrationArtifact?.split?.validationCaseIds || [];
  const acceptanceCaseIds = calibrationArtifact?.split?.testCaseIds || [];
  const selectionRows = selectionCaseIds.map((caseId) => rowsByCaseId.get(String(caseId))).filter(Boolean);
  const acceptanceRows = acceptanceCaseIds.map((caseId) => rowsByCaseId.get(String(caseId))).filter(Boolean);
  const selectionSweep = buildScheduleAssignmentCalibratedPolicySweep(selectionRows, { calibrationArtifact, grid });
  const diagnosticBestPolicy = bestZeroFalsePolicy(selectionSweep);
  const reasons = calibrationReadinessReasons(calibrationArtifact);
  if (!selectionCaseIds.length || selectionRows.length !== selectionCaseIds.length) reasons.push("policy_selection_split_incomplete");
  if (!acceptanceCaseIds.length || acceptanceRows.length !== acceptanceCaseIds.length) reasons.push("policy_acceptance_split_incomplete");
  if (!diagnosticBestPolicy) reasons.push("selection_has_no_zero_false_safe_policy");
  const selectedPolicy = reasons.length === 0 ? diagnosticBestPolicy : null;
  const acceptanceMetrics = selectedPolicy
    ? evaluateScheduleAssignmentPolicyConfiguration(
        acceptanceRows.map((row) => scheduleAssignmentPolicyEvidenceRow(row, calibrationArtifact)),
        selectedPolicy
      )
    : null;
  if (acceptanceMetrics?.falseAutomaticAssignmentCount > 0) reasons.push("acceptance_false_automatic_assignment_observed");
  if (acceptanceMetrics && acceptanceMetrics.correctAutomaticAssignmentCount === 0) reasons.push("acceptance_has_no_safe_automatic_coverage");
  const readinessReasons = [...new Set(reasons)];
  const configuration = {
    grid,
    selectionRule: "maximize_safe_coverage_after_zero_false_and_mandatory_safety_gates",
    mandatoryRecommendationGates: {
      requireMatcherValidatorAgreement: true,
      blockHardConflict: true
    }
  };
  const context = {
    policyFeatureVersion: SCHEDULE_ASSIGNMENT_POLICY_FEATURE_VERSION,
    calibrationArtifactId: calibrationArtifact?.artifactId || null,
    calibrationFeatureVersion: calibrationArtifact?.context?.featureVersion || null,
    engineVersion: manifest.engineVersion || calibrationArtifact?.context?.engineVersion || null,
    scheduleVersionId: manifest.activeScheduleVersionId || calibrationArtifact?.context?.scheduleVersionId || null,
    settingsVersion: manifest.settingsVersion || calibrationArtifact?.context?.settingsVersion || null,
    configurationSnapshotId: manifest.configurationSnapshotId || calibrationArtifact?.context?.configurationSnapshotId || null,
    datasetHash: manifest.fixtureHash || `sha256:${sha256(safeRows.map((row) => [row.caseId, row.labelType, row.expectedActivityKey, row.selectedActivityKey]))}`,
    policyConfigurationHash: `sha256:${sha256(configuration)}`
  };
  const artifactCore = {
    artifactVersion: SCHEDULE_ASSIGNMENT_POLICY_ARTIFACT_VERSION,
    createdAt: new Date().toISOString(),
    context,
    configuration,
    evidence: {
      totalCaseCount: safeRows.length,
      selectionCaseCount: selectionRows.length,
      acceptanceCaseCount: acceptanceRows.length,
      selectionCaseIds,
      acceptanceCaseIds
    },
    diagnosticBestPolicy,
    selectedPolicy: selectedPolicy ? { ...selectedPolicy, enabled: false } : null,
    acceptanceMetrics,
    selectionSweep,
    readyForShadow: readinessReasons.length === 0,
    readyForProduction: false,
    readinessReasons,
    rollbackPolicy: {
      source: "pre_phase_4_configuration_snapshot",
      rankingScoreThreshold: 90,
      rankingMargin: 12,
      enabled: false
    }
  };
  return {
    ...artifactCore,
    artifactId: `schedule-assignment-policy:${sha256(artifactCore)}`
  };
}
