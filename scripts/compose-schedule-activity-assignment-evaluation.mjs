import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { getConfig, loadEnv, reloadSettingsFromDb } from "../src/config.js";
import {
  buildScheduleAssignmentEvaluationManifest,
  relabelScheduleAssignmentEvaluationRow,
  summarizeScheduleAssignmentEvaluation
} from "../src/scheduleActivityAssignmentEvaluation.js";

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const requiredPath = (name) => {
  const value = valueAfter(name);
  if (!value) throw new Error(`Composition requires ${name} <path>`);
  return path.resolve(value);
};

const currentDatasetPath = requiredPath("--dataset");
const reuseDatasetPath = requiredPath("--reuse-dataset");
const reuseReportPath = requiredPath("--reuse-report");
const freshReportPath = requiredPath("--fresh-report");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const localRoot = path.resolve(scriptDirectory, "../data/schedule-assignment-evaluations");
const outputPath = path.resolve(valueAfter("--output") || path.join(localRoot, "composed-evaluation-report.json"));

function assertPrivateOutput(filePath) {
  const relative = path.relative(localRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`evaluation output must stay under ${localRoot}`);
  }
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function indexUnique(rows, key, label) {
  const result = new Map();
  for (const row of rows) {
    const value = String(row?.[key] || "").trim();
    if (!value) throw new Error(`${label} contains a row without ${key}`);
    if (result.has(value)) throw new Error(`${label} contains duplicate ${key} ${value}`);
    result.set(value, row);
  }
  return result;
}

function compatibilityView(manifest = {}) {
  return {
    evaluationVersion: manifest.evaluationVersion || null,
    engineVersion: manifest.engineVersion || null,
    activeScheduleVersionId: manifest.activeScheduleVersionId || null,
    settingsVersion: manifest.settingsVersion || null,
    configurationSnapshotId: manifest.configurationSnapshotId || null,
    promptHashes: manifest.promptHashes || {},
    schemaHashes: manifest.schemaHashes || {}
  };
}

const [dataset, reuseDataset, reuseReport, freshReport] = await Promise.all([
  loadJson(currentDatasetPath),
  loadJson(reuseDatasetPath),
  loadJson(reuseReportPath),
  loadJson(freshReportPath)
]);

if (dataset.sourceProjectId !== reuseDataset.sourceProjectId
  || dataset.scheduleProjectId !== reuseDataset.scheduleProjectId
  || !isDeepStrictEqual(dataset.tasks, reuseDataset.tasks)
  || dataset.activeScheduleVersionId !== reuseDataset.activeScheduleVersionId) {
  throw new Error("Cannot reuse evaluation rows because the active Schedule tasks or version changed");
}
if (!isDeepStrictEqual(compatibilityView(reuseReport.manifest), compatibilityView(freshReport.manifest))) {
  throw new Error("Cannot compose reports produced by incompatible engine, prompt, schema, or settings versions");
}
if (!isDeepStrictEqual(reuseReport.runtime?.retrieval, freshReport.runtime?.retrieval)) {
  throw new Error("Cannot compose reports produced by different retrieval configurations");
}

const currentCases = indexUnique(dataset.cases || [], "sourceId", "current dataset");
const reuseCases = indexUnique(reuseDataset.cases || [], "sourceId", "reuse dataset");
const reuseRows = indexUnique(reuseReport.summary?.rows || [], "sourceId", "reuse report");
const freshRows = indexUnique(freshReport.summary?.rows || [], "sourceId", "fresh report");
const rows = [];
const reusedSourceIds = [];
const freshSourceIds = [];

for (const [sourceId, fixture] of currentCases) {
  const freshRow = freshRows.get(sourceId);
  if (freshRow) {
    rows.push(relabelScheduleAssignmentEvaluationRow({ fixture, row: freshRow }));
    freshSourceIds.push(sourceId);
    continue;
  }
  const reuseFixture = reuseCases.get(sourceId);
  const reuseRow = reuseRows.get(sourceId);
  if (!reuseFixture || !reuseRow || !isDeepStrictEqual(fixture.source, reuseFixture.source)) {
    throw new Error(`No compatible fresh or reusable evaluation row exists for source ${sourceId}`);
  }
  rows.push(relabelScheduleAssignmentEvaluationRow({ fixture, row: reuseRow }));
  reusedSourceIds.push(sourceId);
}

for (const sourceId of freshRows.keys()) {
  if (!currentCases.has(sourceId)) throw new Error(`Fresh report contains unknown source ${sourceId}`);
}

loadEnv();
await reloadSettingsFromDb();
const config = getConfig();
const expectedReuseManifest = buildScheduleAssignmentEvaluationManifest({
  dataCutoff: reuseDataset.dataCutoff,
  activeScheduleVersionId: reuseDataset.activeScheduleVersionId,
  settings: config.scheduleAssignmentAgent,
  cases: reuseDataset.cases
});
const expectedFreshManifest = buildScheduleAssignmentEvaluationManifest({
  dataCutoff: dataset.dataCutoff,
  activeScheduleVersionId: dataset.activeScheduleVersionId,
  settings: config.scheduleAssignmentAgent,
  cases: dataset.cases.filter((fixture) => freshRows.has(String(fixture.sourceId)))
});
for (const [label, expected, actual] of [
  ["reuse", expectedReuseManifest, reuseReport.manifest],
  ["fresh", expectedFreshManifest, freshReport.manifest]
]) {
  if (expected.fixtureHash !== actual.fixtureHash || expected.dataCutoff !== actual.dataCutoff
    || expected.caseCount !== actual.caseCount) {
    throw new Error(`${label} report does not match its supplied dataset fixtures and cutoff`);
  }
}
const manifest = buildScheduleAssignmentEvaluationManifest({
  dataCutoff: dataset.dataCutoff,
  activeScheduleVersionId: dataset.activeScheduleVersionId,
  settings: config.scheduleAssignmentAgent,
  cases: dataset.cases
});
if (!isDeepStrictEqual(compatibilityView(manifest), compatibilityView(freshReport.manifest))) {
  throw new Error("Current runtime configuration is incompatible with the fresh evaluation report");
}

const summary = summarizeScheduleAssignmentEvaluation(rows);
// Old rows can predate shadow eligibility recording. Only the dedicated policy
// sweep recomputes one comparable policy over every row in the combined report.
summary.runtimeDecisionMetricsStatus = "mixed_historical_runs_use_dedicated_policy_sweep";
for (const key of ["correctAutomaticAssignmentCount", "falseAutomaticAssignmentCount",
  "falseAutomaticAssignmentRate", "abstentionCount", "abstentionRate"]) {
  summary[key] = null;
}
const report = {
  schemaVersion: "schedule-assignment-evaluation-report.v2",
  generatedAt: new Date().toISOString(),
  runtime: {
    settingsSource: "remote_active_settings",
    databasePersistence: "disabled",
    retrievalOnly: false,
    retrieval: freshReport.runtime.retrieval,
    composition: {
      reuseReportPath,
      freshReportPath,
      reusedCaseCount: reusedSourceIds.length,
      freshCaseCount: freshSourceIds.length,
      reusedSourceIds,
      freshSourceIds
    }
  },
  dataset: {
    schemaVersion: dataset.schemaVersion || null,
    sourceRecovery: dataset.sourceRecovery || null
  },
  manifest,
  summary
};

assertPrivateOutput(outputPath);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  outputPath,
  manifest,
  composition: report.runtime.composition,
  metrics: {
    ...report.summary,
    rows: undefined,
    rawScorePolicySweep: undefined,
    rawScorePolicySweepRows: report.summary.rawScorePolicySweep.length
  }
}, null, 2));
