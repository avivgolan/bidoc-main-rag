import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig, loadEnv, reloadSettingsFromDb } from "../src/config.js";
import {
  buildScheduleAssignmentEvaluationManifest,
  evaluateScheduleAssignmentCase,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES,
  summarizeScheduleAssignmentEvaluation
} from "../src/scheduleActivityAssignmentEvaluation.js";
import { loadScheduleSource, scheduleDataRequest, scheduleSettings } from "../src/scheduleIngestion.js";
import { resolveIndicatorProjectContext } from "../src/indicator/contractConditions.js";
import { runScheduleActivityAssignmentAgent } from "../src/subagents/scheduleActivityAssignmentAgent.js";

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const mode = hasFlag("--prepare") ? "prepare" : hasFlag("--run") ? "run" : null;
const localRoot = path.resolve("data", "schedule-assignment-evaluations");
const READ_TIMEOUT_MS = 20_000;

function timeoutFetch(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(READ_TIMEOUT_MS) });
}

function safeTimestamp(value = new Date().toISOString()) {
  const timestamp = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}T/iu.test(timestamp)) throw new Error("--cutoff must be an ISO timestamp");
  return timestamp;
}

function safeFileName(value) {
  return String(value || "evaluation").replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "").slice(0, 120) || "evaluation";
}

async function writePrivateJson(filePath, value) {
  const resolved = path.resolve(filePath);
  const relative = path.relative(localRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`evaluation output must stay under ${localRoot}`);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

async function loadRuntime({ reloadRemoteSettings = true } = {}) {
  loadEnv();
  if (reloadRemoteSettings) await reloadSettingsFromDb();
  return { config: getConfig(), settings: scheduleSettings() };
}

async function readAlert({ config, settings, scheduleProjectId, sourceId }) {
  const rows = await scheduleDataRequest({
    config,
    settings,
    fetchImpl: timeoutFetch,
    path: `/rest/v1/alerts?select=*&project_id=eq.${encodeURIComponent(scheduleProjectId)}&id=eq.${encodeURIComponent(String(sourceId))}&limit=1`
  });
  return rows[0] || null;
}

async function prepareDataset() {
  const projectId = valueAfter("--project");
  if (!projectId) throw new Error("--prepare requires --project <project-id>");
  const dataCutoff = safeTimestamp(valueAfter("--cutoff") || new Date().toISOString());
  const { config, settings } = await loadRuntime({ reloadRemoteSettings: false });
  const explicitScheduleProjectId = valueAfter("--schedule-project");
  const context = explicitScheduleProjectId
    ? { sourceProjectId: projectId, scheduleProjectId: explicitScheduleProjectId }
    : await resolveIndicatorProjectContext({ projectId, config, settings });
  const scheduleSource = await loadScheduleSource({ config, projectId, settings, fetchImpl: timeoutFetch });
  const inputs = { tasks: scheduleSource.tasks, scheduleMeta: scheduleSource.scheduleMeta };
  const cutoffMs = Date.parse(dataCutoff);
  const [rawLinks, rawRejectedRuns] = await Promise.all([
    scheduleDataRequest({
      config,
      settings,
      fetchImpl: timeoutFetch,
      path: `/rest/v1/schedule_activity_alert_links?select=id,project_id,source_id,activity_key,assignment_method,created_at,updated_at&project_id=eq.${encodeURIComponent(context.scheduleProjectId)}&limit=1000`
    }),
    scheduleDataRequest({
      config,
      settings,
      fetchImpl: timeoutFetch,
      path: `/rest/v1/schedule_activity_assignment_runs?select=id,project_id,source_id,schedule_version_id,status,selected_activity_key,review_reason,reviewed_at&project_id=eq.${encodeURIComponent(context.scheduleProjectId)}&status=eq.rejected&limit=1000`
    }).catch(() => [])
  ]);
  const links = rawLinks
    .filter((row) => ["manual", "agent_approved"].includes(String(row.assignment_method || "manual")))
    .filter((row) => !row.created_at || Date.parse(row.created_at) <= cutoffMs)
    .sort((left, right) => Date.parse(left.created_at || 0) - Date.parse(right.created_at || 0));
  const rejectedRuns = rawRejectedRuns
    .filter((row) => !row.reviewed_at || Date.parse(row.reviewed_at) <= cutoffMs)
    .sort((left, right) => Date.parse(left.reviewed_at || 0) - Date.parse(right.reviewed_at || 0));
  const activeScheduleVersionId = String(inputs.scheduleMeta.sourceVersionId || "");
  const casesBySource = new Map();
  for (const link of links) {
    const activeActivity = String(link.activity_key || "").startsWith(`gantt:${activeScheduleVersionId}:`);
    casesBySource.set(String(link.source_id), {
      id: `link:${link.id}`,
      projectId: context.sourceProjectId,
      sourceId: String(link.source_id),
      scheduleVersionId: activeScheduleVersionId,
      label: activeActivity
        ? {
            type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH,
            expectedActivityKey: String(link.activity_key),
            reason: "Human-confirmed Schedule activity link."
          }
        : {
            type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY,
            forbiddenActivityKeys: [String(link.activity_key)],
            reason: "Historical link points to a non-active Schedule version."
          },
      provenance: {
        source: "schedule_activity_alert_links",
        linkId: String(link.id),
        reviewedAt: link.updated_at || link.created_at || null
      }
    });
  }
  for (const run of rejectedRuns) {
    const sourceId = String(run.source_id || "");
    if (!sourceId || casesBySource.has(sourceId) || !run.selected_activity_key) continue;
    casesBySource.set(sourceId, {
      id: `rejected-run:${run.id}`,
      projectId: context.sourceProjectId,
      sourceId,
      scheduleVersionId: activeScheduleVersionId,
      label: {
        type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH,
        forbiddenActivityKeys: [String(run.selected_activity_key)],
        reason: String(run.review_reason || "The proposed activity was rejected by a reviewer.").slice(0, 1200)
      },
      provenance: {
        source: "schedule_activity_assignment_runs",
        linkId: null,
        reviewedAt: run.reviewed_at || null
      }
    });
  }
  const cases = [];
  for (const item of casesBySource.values()) {
    const source = await readAlert({ config, settings, scheduleProjectId: context.scheduleProjectId, sourceId: item.sourceId });
    if (source) cases.push({ ...item, source });
  }
  const dataset = {
    schemaVersion: "schedule-assignment-dataset.v1",
    dataCutoff,
    preparedAt: new Date().toISOString(),
    sourceProjectId: context.sourceProjectId,
    scheduleProjectId: context.scheduleProjectId,
    activeScheduleVersionId,
    scheduleMeta: inputs.scheduleMeta,
    tasks: inputs.tasks,
    cases
  };
  const defaultPath = path.join(localRoot, `${safeFileName(projectId)}-${dataCutoff.slice(0, 10)}-dataset.json`);
  const outputPath = await writePrivateJson(valueAfter("--output") || defaultPath, dataset);
  console.log(JSON.stringify({
    ok: true,
    mode,
    outputPath,
    dataCutoff,
    activeScheduleVersionId,
    taskCount: inputs.tasks.length,
    caseCount: cases.length,
    labelBreakdown: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((label) => [label, cases.filter((item) => item.label.type === label).length]))
  }, null, 2));
}

async function runEvaluation() {
  const datasetPath = valueAfter("--dataset");
  if (!datasetPath) throw new Error("--run requires --dataset <path>");
  const dataset = JSON.parse(await readFile(path.resolve(datasetPath), "utf8"));
  const { config, settings } = await loadRuntime({ reloadRemoteSettings: !hasFlag("--code-defaults") });
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is not configured; the full baseline cannot run.");
  const limit = Math.max(1, Math.min(dataset.cases.length, Number(valueAfter("--limit")) || dataset.cases.length));
  const selectedCases = dataset.cases.slice(0, limit);
  const manifest = buildScheduleAssignmentEvaluationManifest({
    dataCutoff: dataset.dataCutoff,
    activeScheduleVersionId: dataset.activeScheduleVersionId,
    settings: config.scheduleAssignmentAgent,
    cases: selectedCases
  });
  const rows = [];
  for (const fixture of selectedCases) {
    const startedAt = Date.now();
    let result;
    try {
      result = await runScheduleActivityAssignmentAgent({
        projectId: dataset.sourceProjectId,
        sourceId: fixture.sourceId,
        commit: false,
        persistAudit: false,
        timeFilter: false,
        evaluationFixture: {
          sourceProjectId: dataset.sourceProjectId,
          scheduleProjectId: dataset.scheduleProjectId,
          source: fixture.source,
          tasks: dataset.tasks,
          scheduleMeta: dataset.scheduleMeta
        },
        config,
        settings,
        apiKey: config.openRouterApiKey
      });
    } catch (error) {
      result = {
        status: "error",
        decision: { type: "error", selectedActivityKey: null, wouldAutoAssign: false },
        candidates: [],
        roles: { runtime: { error: String(error?.message || error).slice(0, 700) } },
        workflowLog: { openRouterUsage: { calls: [] } }
      };
    }
    rows.push(evaluateScheduleAssignmentCase({ fixture, result, durationMs: Date.now() - startedAt }));
  }
  const report = {
    schemaVersion: "schedule-assignment-evaluation-report.v1",
    generatedAt: new Date().toISOString(),
    runtime: {
      settingsSource: hasFlag("--code-defaults") ? "code_defaults" : "remote_active_settings",
      databasePersistence: "disabled"
    },
    manifest,
    summary: summarizeScheduleAssignmentEvaluation(rows)
  };
  const defaultPath = path.join(localRoot, `${safeFileName(dataset.sourceProjectId)}-${dataset.dataCutoff.slice(0, 10)}-baseline-report.json`);
  const outputPath = await writePrivateJson(valueAfter("--output") || defaultPath, report);
  console.log(JSON.stringify({ ok: true, mode, outputPath, manifest, metrics: { ...report.summary, rows: undefined } }, null, 2));
}

if (!mode) {
  throw new Error("Choose --prepare or --run. Example: npm run schedule:assignment:evaluate -- --prepare --project <project-id>");
}

if (mode === "prepare") await prepareDataset();
else await runEvaluation();
