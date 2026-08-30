import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScheduleAssignmentCalibrationArtifact } from "../src/scheduleActivityAssignmentCalibration.js";

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const reportPath = valueAfter("--report");
if (!reportPath) throw new Error("Calibration requires --report <evaluation-report.json>");

const report = JSON.parse(await readFile(path.resolve(reportPath), "utf8"));
const rows = report?.summary?.rows;
if (!Array.isArray(rows) || !rows.length) throw new Error("The evaluation report does not contain summary.rows");

const retrieval = report?.runtime?.retrieval || {};
const artifact = buildScheduleAssignmentCalibrationArtifact({
  rows,
  manifest: report.manifest || {},
  retrieval,
  seed: valueAfter("--seed") || "schedule-assignment-calibration.v1"
});

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const localRoot = path.resolve(scriptDirectory, "../data/schedule-assignment-evaluations");
const defaultOutput = path.join(localRoot, `${artifact.context.scheduleVersionId || "schedule"}-calibrator.json`.replaceAll(/[^a-zA-Z0-9._-]+/gu, "_"));
const outputPath = path.resolve(valueAfter("--output") || defaultOutput);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "w" });

console.log(JSON.stringify({
  ok: true,
  outputPath,
  artifactId: artifact.artifactId,
  selectedMethod: artifact.selectedMethod,
  readyForProduction: artifact.readyForProduction,
  readinessReasons: artifact.readinessReasons,
  evidence: artifact.evidence,
  validation: artifact.comparisons[artifact.selectedMethod]?.validation || null,
  test: artifact.comparisons[artifact.selectedMethod]?.test || null
}, null, 2));
