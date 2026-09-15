import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, loadEnv, supabaseHeaders } from "../src/config.js";
import { predictScheduleAssignmentCalibration } from "../src/scheduleActivityAssignmentCalibration.js";
import {
  SCHEDULE_ASSIGNMENT_SHADOW_POLICY,
  SCHEDULE_ASSIGNMENT_SHADOW_SCHEMA_VERSION,
  summarizeScheduleAssignmentShadowRows
} from "../src/scheduleActivityAssignmentShadow.js";

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const required = (name) => {
  const value = valueAfter(name);
  if (!value) throw new Error(`Shadow replay requires ${name}`);
  return value;
};
const projectId = required("--project");
const calibrator = JSON.parse(await readFile(path.resolve(required("--calibrator")), "utf8"));
const policy = JSON.parse(await readFile(path.resolve(required("--policy")), "utf8"));
const dataset = JSON.parse(await readFile(path.resolve(required("--dataset")), "utf8"));
const selected = policy.selectedPolicy;
if (!selected || selected.enabled !== false || policy.readyForProduction !== false
  || policy.context?.calibrationArtifactId !== calibrator.artifactId) {
  throw new Error("Replay requires a disabled candidate policy tied to the supplied calibrator");
}
if (!["platt", "isotonic"].includes(calibrator.selectedModel?.method)) {
  throw new Error("Replay only supports the stored ranking-score Platt/isotonic calibrators");
}
for (const key of ["requireMatcherValidatorAgreement", "requireJudgeMatchWhenRun", "blockHardConflict"]) {
  if (selected[key] !== true || selected[key] !== SCHEDULE_ASSIGNMENT_SHADOW_POLICY.selectedPolicy[key]) {
    throw new Error(`Stored shadow gates cannot replay a changed structural policy: ${key}`);
  }
}

loadEnv();
const config = getConfig();
if (!config.supabaseUrl || !config.supabaseServiceRoleKey) throw new Error("MAIN Supabase is not configured");
const query = new URLSearchParams({
  select: "id,source_id,status,decision_snapshot,candidates_snapshot,evaluation_label_type,expected_activity_key",
  source_project_id: `eq.${projectId}`,
  status: "in.(pending,selected,rejected)",
  order: "created_at.desc",
  limit: "5000"
});
const response = await fetch(`${config.supabaseUrl.replace(/\/$/u, "")}/rest/v1/schedule_activity_assignment_reviews?${query}`, {
  headers: supabaseHeaders(config.supabaseServiceRoleKey),
  signal: AbortSignal.timeout(20_000)
});
if (!response.ok) throw new Error(`Read-only shadow query failed with HTTP ${response.status}`);
const storedRows = await response.json();
const fixedGates = ["decisionMatch", "noHardConflict", "canonicalDate", "activeScheduleActivity",
  "unassigned", "freshRun", "requiredRolesCompleted", "matcherValidatorAgreement", "judgeOutcome"];
const datasetSourceIds = new Set((dataset.cases || []).map((fixture) => String(fixture.sourceId)));
const replayRows = [];
const excluded = [];
for (const row of storedRows) {
  const decision = row.decision_snapshot || {};
  const shadow = decision.shadow;
  if (shadow?.schemaVersion !== SCHEDULE_ASSIGNMENT_SHADOW_SCHEMA_VERSION) continue;
  const reasons = [];
  if (shadow.compatible !== true) reasons.push("original_observation_incompatible");
  for (const key of ["engineVersion", "scheduleVersionId", "settingsVersion", "configurationSnapshotId"]) {
    if (decision[key] !== calibrator.context?.[key]) reasons.push(`${key}_mismatch`);
  }
  for (const key of ["strategy", "semanticPoolLimit", "modelCandidateLimit"]) {
    if (shadow.retrieval?.[key] !== calibrator.context?.retrieval?.[key]) reasons.push(`retrieval_${key}_mismatch`);
  }
  if (!Number.isFinite(shadow.rankingScore) || !Number.isFinite(shadow.rankingGap)) reasons.push("missing_scores");
  if (reasons.length) {
    excluded.push({ sourceId: String(row.source_id), reasons });
    continue;
  }
  const probability = predictScheduleAssignmentCalibration(calibrator.selectedModel, { rankingScore: shadow.rankingScore / 100 });
  const failedGates = fixedGates.filter((key) => shadow.policyGates?.[key] !== true);
  if (probability < selected.probabilityThreshold) failedGates.push("calibratedProbability");
  if (shadow.rankingGap < selected.rankingMargin) failedGates.push("rankingMargin");
  const eligible = failedGates.length === 0;
  const reviewed = Boolean(row.evaluation_label_type);
  const correct = reviewed && eligible && row.evaluation_label_type === "confirmed_match"
    && Boolean(row.expected_activity_key) && row.expected_activity_key === shadow.selectedActivityKey;
  replayRows.push({
    sourceId: String(row.source_id),
    reviewed,
    labelType: row.evaluation_label_type || null,
    overlapsCalibrationDataset: datasetSourceIds.has(String(row.source_id)),
    previousEligible: shadow.wouldAutoAssign === true,
    candidateEligible: eligible,
    correctEligible: correct,
    falseEligible: reviewed && eligible && !correct,
    calibratedProbability: probability,
    rankingGap: shadow.rankingGap,
    failedGates
  });
}
const reviewed = replayRows.filter((row) => row.reviewed);
const eligible = reviewed.filter((row) => row.candidateEligible);
const correct = eligible.filter((row) => row.correctEligible);
const falseEligible = eligible.filter((row) => row.falseEligible);
const report = {
  schemaVersion: "schedule-assignment-shadow-replay.v1",
  generatedAt: new Date().toISOString(),
  projectId,
  databasePersistence: "disabled",
  automaticWritesEnabled: false,
  diagnosticOnly: true,
  readyForProduction: false,
  warning: "This reuses reviewed observations and may overlap calibration evidence. It is not a fresh shadow acceptance sample.",
  calibratorArtifactId: calibrator.artifactId,
  policyArtifactId: policy.artifactId,
  probabilityThreshold: selected.probabilityThreshold,
  rankingMargin: selected.rankingMargin,
  originalShadowReport: summarizeScheduleAssignmentShadowRows(storedRows),
  reviewedCount: reviewed.length,
  pendingSourceIds: replayRows.filter((row) => !row.reviewed).map((row) => row.sourceId),
  overlappingReviewedCount: reviewed.filter((row) => row.overlapsCalibrationDataset).length,
  previousEligibleCount: reviewed.filter((row) => row.previousEligible).length,
  candidateEligibleCount: eligible.length,
  correctEligibleCount: correct.length,
  falseEligibleCount: falseEligible.length,
  safeCoverageRate: reviewed.length ? correct.length / reviewed.length : 0,
  failedGateBreakdown: Object.fromEntries([...new Set(reviewed.flatMap((row) => row.failedGates))]
    .map((gate) => [gate, reviewed.filter((row) => row.failedGates.includes(gate)).length])),
  excluded,
  rows: replayRows
};
const localRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/schedule-assignment-evaluations");
const outputPath = path.resolve(required("--output"));
const relative = path.relative(localRoot, outputPath);
if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`output must stay under ${localRoot}`);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, rows: undefined, outputPath }, null, 2));
