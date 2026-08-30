import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScheduleAssignmentPolicyArtifact } from "../src/scheduleActivityAssignmentPolicy.js";

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const reportPath = valueAfter("--report");
const calibratorPath = valueAfter("--calibrator");
if (!reportPath || !calibratorPath) {
  throw new Error("Policy calibration requires --report <evaluation-report.json> and --calibrator <calibration-artifact.json>");
}

const report = JSON.parse(await readFile(path.resolve(reportPath), "utf8"));
const calibrationArtifact = JSON.parse(await readFile(path.resolve(calibratorPath), "utf8"));
const rows = report?.summary?.rows;
if (!Array.isArray(rows) || !rows.length) throw new Error("The evaluation report does not contain summary.rows");

const artifact = buildScheduleAssignmentPolicyArtifact({
  rows,
  calibrationArtifact,
  manifest: report.manifest || {}
});

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const localRoot = path.resolve(scriptDirectory, "../data/schedule-assignment-evaluations");
const defaultOutput = path.join(localRoot, `${artifact.context.scheduleVersionId || "schedule"}-policy.json`.replaceAll(/[^a-zA-Z0-9._-]+/gu, "_"));
const outputPath = path.resolve(valueAfter("--output") || defaultOutput);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "w" });

console.log(JSON.stringify({
  ok: true,
  outputPath,
  artifactId: artifact.artifactId,
  readyForShadow: artifact.readyForShadow,
  readyForProduction: artifact.readyForProduction,
  readinessReasons: artifact.readinessReasons,
  evidence: artifact.evidence,
  diagnosticBestPolicy: artifact.diagnosticBestPolicy,
  selectedPolicy: artifact.selectedPolicy,
  acceptanceMetrics: artifact.acceptanceMetrics,
  evaluatedConfigurationCount: artifact.selectionSweep.length
}, null, 2));
