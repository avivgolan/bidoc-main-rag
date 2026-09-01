import crypto from "node:crypto";
import { SCHEDULE_ASSIGNMENT_CALIBRATION_REQUIRED_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";

export const SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION = "schedule-assignment-calibrator.v2";
export const SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION = "schedule-assignment-calibration-features.v2";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
const sigmoid = (value) => value >= 0
  ? 1 / (1 + Math.exp(-value))
  : Math.exp(value) / (1 + Math.exp(value));

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeScore(value) {
  return clamp(Number(value) / 100);
}

function selectedRoleScore(role = {}, selectedActivityKey = null) {
  const row = Array.isArray(role?.scores)
    ? role.scores.find((item) => item.activityKey === selectedActivityKey)
    : null;
  return safeScore(row?.score);
}

export function scheduleAssignmentCalibrationExample(row = {}) {
  const selectedActivityKey = row.selectedActivityKey || null;
  const matcher = row.roleOutcomes?.matcher || {};
  const validator = row.roleOutcomes?.validator || {};
  const top = row.allCandidates?.[0] || row.topCandidates?.[0] || {};
  const runnerUp = row.allCandidates?.[1] || row.topCandidates?.[1] || {};
  const rankingScore = Number(row.rankingScore ?? row.confidence ?? top.finalScore ?? 0);
  const runnerUpRankingScore = Number(row.runnerUpRankingScore ?? row.runnerUpConfidence ?? runnerUp.finalScore ?? 0);
  const rankingGap = Number(row.rankingGap ?? row.margin ?? (rankingScore - runnerUpRankingScore));
  return {
    caseId: String(row.caseId || row.sourceId || ""),
    sourceId: String(row.sourceId || ""),
    target: row.labelType === "confirmed_match" && selectedActivityKey === row.expectedActivityKey ? 1 : 0,
    labelType: row.labelType || null,
    selectedActivityKey,
    expectedActivityKey: row.expectedActivityKey || null,
    features: scheduleAssignmentCalibrationFeatures({
      rankingScore,
      runnerUpRankingScore,
      rankingGap,
      selectedActivityKey,
      selectedCandidate: top,
      runnerUpCandidate: runnerUp,
      matcher,
      validator,
      decisionType: row.decisionType,
      gates: row.gates
    })
  };
}

export function scheduleAssignmentCalibrationFeatures({
  rankingScore = 0,
  runnerUpRankingScore = 0,
  rankingGap = 0,
  selectedActivityKey = null,
  selectedCandidate = {},
  runnerUpCandidate = {},
  matcher = {},
  validator = {},
  decisionType = null,
  gates = {}
} = {}) {
  const safeMatcher = matcher && typeof matcher === "object" ? matcher : {};
  const safeValidator = validator && typeof validator === "object" ? validator : {};
  const safeSelectedCandidate = selectedCandidate && typeof selectedCandidate === "object" ? selectedCandidate : {};
  const safeRunnerUpCandidate = runnerUpCandidate && typeof runnerUpCandidate === "object" ? runnerUpCandidate : {};
  const safeGates = gates && typeof gates === "object" ? gates : {};
  const matcherBest = safeMatcher.bestActivityKey || safeMatcher.selectedActivityKey || null;
  const validatorBest = safeValidator.bestActivityKey || safeValidator.selectedActivityKey || null;
  return {
    rankingScore: safeScore(rankingScore),
    runnerUpRankingScore: safeScore(runnerUpRankingScore),
    rankingGap: clamp(rankingGap / 100, -1, 1),
    semanticGap: clamp(Number(safeSelectedCandidate.signals?.semantic || 0) - Number(safeRunnerUpCandidate.signals?.semantic || 0), -1, 1),
    lexicalGap: clamp(Number(safeSelectedCandidate.signals?.lexical || 0) - Number(safeRunnerUpCandidate.signals?.lexical || 0), -1, 1),
    matcherSelectedScore: selectedRoleScore(safeMatcher, selectedActivityKey),
    validatorSelectedScore: selectedRoleScore(safeValidator, selectedActivityKey),
    roleAgreement: Number(Boolean(selectedActivityKey && matcherBest === selectedActivityKey && validatorBest === selectedActivityKey)),
    decisionMatch: Number(decisionType === "match" || safeGates.decisionMatch === true),
    noHardConflict: Number(safeGates.noHardConflict === true),
    requiredRolesCompleted: Number((safeGates.requiredRolesCompleted ?? safeGates.aiCompleted) === true),
    matcherValidatorAgreement: Number((safeGates.matcherValidatorAgreement ?? (matcherBest && matcherBest === validatorBest)) === true)
  };
}

function deterministicClassSplit(examples = [], seed = "schedule-assignment-calibration.v1") {
  const splits = { train: [], validation: [], test: [] };
  for (const target of [0, 1]) {
    const labelled = examples
      .filter((item) => item.target === target)
      .map((item) => ({ item, hash: stableHash([seed, target, item.sourceId, item.caseId]) }))
      .sort((left, right) => left.hash.localeCompare(right.hash))
      .map((entry) => entry.item);
    if (labelled.length < 3) throw new Error(`Calibration needs at least three examples for target ${target}`);
    let trainCount = Math.max(1, Math.floor(labelled.length * 0.6));
    let validationCount = Math.max(1, Math.floor(labelled.length * 0.2));
    if (trainCount + validationCount >= labelled.length) trainCount = labelled.length - validationCount - 1;
    splits.train.push(...labelled.slice(0, trainCount));
    splits.validation.push(...labelled.slice(trainCount, trainCount + validationCount));
    splits.test.push(...labelled.slice(trainCount + validationCount));
  }
  for (const name of Object.keys(splits)) {
    splits[name].sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  }
  return splits;
}

function fitPlatt(examples = []) {
  const values = examples.map((item) => item.features.rankingScore);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const scale = Math.sqrt(variance) || 1;
  const positiveRate = clamp(examples.reduce((sum, item) => sum + item.target, 0) / examples.length, 0.001, 0.999);
  let coefficient = 0;
  let intercept = Math.log(positiveRate / (1 - positiveRate));
  const learningRate = 0.08;
  const regularization = 0.001;
  for (let iteration = 0; iteration < 5000; iteration += 1) {
    let coefficientGradient = 0;
    let interceptGradient = 0;
    for (const item of examples) {
      const standardized = (item.features.rankingScore - mean) / scale;
      const error = sigmoid(coefficient * standardized + intercept) - item.target;
      coefficientGradient += error * standardized;
      interceptGradient += error;
    }
    coefficientGradient = coefficientGradient / examples.length + regularization * coefficient;
    interceptGradient /= examples.length;
    coefficient -= learningRate * coefficientGradient;
    intercept -= learningRate * interceptGradient;
  }
  return { method: "platt", coefficient, intercept, mean, scale };
}

function fitIsotonic(examples = []) {
  const sorted = examples
    .map((item) => ({ score: item.features.rankingScore, target: item.target }))
    .sort((left, right) => left.score - right.score || left.target - right.target);
  const blocks = [];
  for (const item of sorted) {
    blocks.push({ minScore: item.score, maxScore: item.score, weight: 1, positives: item.target, probability: item.target });
    while (blocks.length >= 2 && blocks.at(-2).probability > blocks.at(-1).probability) {
      const right = blocks.pop();
      const left = blocks.pop();
      const weight = left.weight + right.weight;
      const positives = left.positives + right.positives;
      blocks.push({
        minScore: left.minScore,
        maxScore: right.maxScore,
        weight,
        positives,
        probability: positives / weight
      });
    }
  }
  return { method: "isotonic", blocks };
}

export function predictScheduleAssignmentCalibration(model = null, features = {}) {
  if (!model) return null;
  const score = clamp(features.rankingScore);
  if (model.method === "control") return score;
  if (model.method === "platt") {
    const standardized = (score - model.mean) / (model.scale || 1);
    return clamp(sigmoid(model.coefficient * standardized + model.intercept));
  }
  if (model.method === "isotonic") {
    const blocks = Array.isArray(model.blocks) ? model.blocks : [];
    if (!blocks.length) return null;
    const block = blocks.find((item) => score <= item.maxScore) || blocks.at(-1);
    return clamp(block.probability);
  }
  return null;
}

function calibrationMetrics(examples = [], model = null, binCount = 5) {
  const predictions = examples.map((item) => ({
    target: item.target,
    probability: clamp(predictScheduleAssignmentCalibration(model, item.features))
  }));
  const brierScore = predictions.reduce((sum, item) => sum + (item.probability - item.target) ** 2, 0) / predictions.length;
  const logLoss = predictions.reduce((sum, item) => {
    const probability = clamp(item.probability, 0.000001, 0.999999);
    return sum - item.target * Math.log(probability) - (1 - item.target) * Math.log(1 - probability);
  }, 0) / predictions.length;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;
    const members = predictions.filter((item) => item.probability >= lower && (index === binCount - 1 ? item.probability <= upper : item.probability < upper));
    return {
      lower,
      upper,
      count: members.length,
      meanPredicted: members.length ? members.reduce((sum, item) => sum + item.probability, 0) / members.length : null,
      observedAccuracy: members.length ? members.reduce((sum, item) => sum + item.target, 0) / members.length : null
    };
  });
  const expectedCalibrationError = bins.reduce((sum, bin) => sum + (bin.count
    ? bin.count / predictions.length * Math.abs(bin.meanPredicted - bin.observedAccuracy)
    : 0), 0);
  return {
    count: predictions.length,
    positiveCount: predictions.filter((item) => item.target === 1).length,
    negativeCount: predictions.filter((item) => item.target === 0).length,
    meanPredicted: predictions.reduce((sum, item) => sum + item.probability, 0) / predictions.length,
    observedAccuracy: predictions.reduce((sum, item) => sum + item.target, 0) / predictions.length,
    brierScore,
    logLoss,
    expectedCalibrationError,
    reliabilityBins: bins
  };
}

function roundedMetrics(value = {}) {
  const round = (number) => number == null ? null : Number(number.toFixed(6));
  return {
    ...value,
    meanPredicted: round(value.meanPredicted),
    observedAccuracy: round(value.observedAccuracy),
    brierScore: round(value.brierScore),
    logLoss: round(value.logLoss),
    expectedCalibrationError: round(value.expectedCalibrationError),
    reliabilityBins: value.reliabilityBins?.map((bin) => ({
      ...bin,
      meanPredicted: round(bin.meanPredicted),
      observedAccuracy: round(bin.observedAccuracy)
    })) || []
  };
}

export function buildScheduleAssignmentCalibrationArtifact({
  rows = [],
  manifest = {},
  retrieval = {},
  seed = "schedule-assignment-calibration.v1",
  minimumCaseCount = 100,
  minimumClassCount = 20
} = {}) {
  const examples = rows.map(scheduleAssignmentCalibrationExample);
  const positiveCount = examples.filter((item) => item.target === 1).length;
  const negativeCount = examples.length - positiveCount;
  const splits = deterministicClassSplit(examples, seed);
  const models = {
    control: { method: "control" },
    platt: fitPlatt(splits.train),
    isotonic: fitIsotonic(splits.train)
  };
  const comparisons = Object.fromEntries(Object.entries(models).map(([method, model]) => [method, {
    train: roundedMetrics(calibrationMetrics(splits.train, model)),
    validation: roundedMetrics(calibrationMetrics(splits.validation, model)),
    test: roundedMetrics(calibrationMetrics(splits.test, model)),
    stableForSelection: method !== "isotonic" || (splits.train.length >= 50 && Math.min(
      splits.train.filter((item) => item.target === 1).length,
      splits.train.filter((item) => item.target === 0).length
    ) >= 15)
  }]));
  const selectable = Object.entries(comparisons)
    .filter(([, comparison]) => comparison.stableForSelection)
    .sort((left, right) => left[1].validation.brierScore - right[1].validation.brierScore
      || left[1].validation.expectedCalibrationError - right[1].validation.expectedCalibrationError
      || ["control", "platt", "isotonic"].indexOf(left[0]) - ["control", "platt", "isotonic"].indexOf(right[0]));
  const selectedMethod = selectable[0]?.[0] || "control";
  const selectedModel = models[selectedMethod];
  const reasons = [];
  if (examples.length < minimumCaseCount) reasons.push(`case_count_below_${minimumCaseCount}`);
  if (positiveCount < minimumClassCount) reasons.push(`correct_count_below_${minimumClassCount}`);
  if (negativeCount < minimumClassCount) reasons.push(`incorrect_count_below_${minimumClassCount}`);
  const labelTypes = [...new Set(examples.map((item) => item.labelType).filter(Boolean))];
  for (const required of SCHEDULE_ASSIGNMENT_CALIBRATION_REQUIRED_LABEL_TYPES) {
    if (!labelTypes.includes(required)) reasons.push(`label_type_missing:${required}`);
  }
  if (selectedMethod === "control") reasons.push("no_stable_calibrator_improved_validation");
  if (selectedMethod !== "control") {
    const selectedTest = comparisons[selectedMethod].test;
    const controlTest = comparisons.control.test;
    if (selectedTest.brierScore >= controlTest.brierScore
      || selectedTest.expectedCalibrationError >= controlTest.expectedCalibrationError) {
      reasons.push("selected_calibrator_failed_held_out_improvement");
    }
  }
  const context = {
    featureVersion: SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION,
    engineVersion: manifest.engineVersion || null,
    scheduleVersionId: manifest.activeScheduleVersionId || null,
    settingsVersion: manifest.settingsVersion || null,
    configurationSnapshotId: manifest.configurationSnapshotId || null,
    fixtureHash: manifest.fixtureHash || null,
    retrieval
  };
  const artifactCore = {
    artifactVersion: SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION,
    createdAt: new Date().toISOString(),
    context,
    split: {
      seed,
      trainCaseIds: splits.train.map((item) => item.caseId),
      validationCaseIds: splits.validation.map((item) => item.caseId),
      testCaseIds: splits.test.map((item) => item.caseId)
    },
    evidence: {
      caseCount: examples.length,
      correctCount: positiveCount,
      incorrectCount: negativeCount,
      labelTypes
    },
    comparisons,
    selectedMethod,
    selectedModel,
    readyForProduction: reasons.length === 0,
    readinessReasons: reasons
  };
  return {
    ...artifactCore,
    artifactId: `schedule-assignment-calibrator:${stableHash(artifactCore)}`
  };
}

export function validateScheduleAssignmentCalibratorCompatibility(artifact = null, context = {}) {
  if (!artifact) return { compatible: false, reason: "calibrator_unavailable" };
  if (artifact.artifactVersion !== SCHEDULE_ASSIGNMENT_CALIBRATION_ARTIFACT_VERSION) return { compatible: false, reason: "artifact_version_mismatch" };
  if (artifact.context?.featureVersion !== SCHEDULE_ASSIGNMENT_CALIBRATION_FEATURE_VERSION) return { compatible: false, reason: "feature_version_mismatch" };
  for (const [artifactField, contextField] of [
    ["engineVersion", "engineVersion"],
    ["scheduleVersionId", "scheduleVersionId"],
    ["settingsVersion", "settingsVersion"],
    ["configurationSnapshotId", "configurationSnapshotId"]
  ]) {
    if (artifact.context?.[artifactField] && artifact.context[artifactField] !== context?.[contextField]) {
      return { compatible: false, reason: `${artifactField}_mismatch` };
    }
  }
  return { compatible: true, reason: null };
}

export function applyScheduleAssignmentCalibration({ artifact = null, features = {}, context = {} } = {}) {
  const compatibility = validateScheduleAssignmentCalibratorCompatibility(artifact, context);
  if (!compatibility.compatible) return { status: "unavailable", probability: null, artifactId: artifact?.artifactId || null, reason: compatibility.reason };
  if (artifact.readyForProduction !== true) return { status: "not_ready", probability: null, artifactId: artifact.artifactId, reason: artifact.readinessReasons?.[0] || "minimum_evidence_not_met" };
  if (artifact.selectedMethod === "control") return { status: "uncalibrated_control", probability: null, artifactId: artifact.artifactId, reason: "selected_method_is_control" };
  const probability = predictScheduleAssignmentCalibration(artifact.selectedModel, features);
  if (!Number.isFinite(probability)) return { status: "unavailable", probability: null, artifactId: artifact.artifactId, reason: "calibrator_prediction_failed" };
  return { status: "calibrated", probability: Number(probability.toFixed(6)), artifactId: artifact.artifactId, reason: null };
}
