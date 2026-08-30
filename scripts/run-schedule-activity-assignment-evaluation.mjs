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
import { listSharedScheduleAssignmentEvaluationLabels } from "../src/subagents/scheduleActivityAssignmentReviewQueue.js";
import { loadScheduleAssignmentEvaluationSources } from "../src/subagents/schedule.js";
import { reconcileScheduleAssignmentReviewLabels, summarizeScheduleAssignmentLabelCoverage } from "../src/scheduleActivityAssignmentLabels.js";

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

async function prepareDataset() {
  const projectId = valueAfter("--project");
  if (!projectId) throw new Error("--prepare requires --project <project-id>");
  const dataCutoff = safeTimestamp(valueAfter("--cutoff") || new Date().toISOString());
  const { config, settings } = await loadRuntime({ reloadRemoteSettings: !hasFlag("--code-defaults") });
  const explicitScheduleProjectId = valueAfter("--schedule-project");
  const context = explicitScheduleProjectId
    ? { sourceProjectId: projectId, scheduleProjectId: explicitScheduleProjectId }
    : await resolveIndicatorProjectContext({ projectId, config, settings });
  const scheduleSource = await loadScheduleSource({ config, projectId, settings, fetchImpl: timeoutFetch });
  const inputs = { tasks: scheduleSource.tasks, scheduleMeta: scheduleSource.scheduleMeta };
  const cutoffMs = Date.parse(dataCutoff);
  const [rawLinks, rawRejectedRuns, sharedLabelResult] = await Promise.all([
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
    }).catch(() => []),
    listSharedScheduleAssignmentEvaluationLabels({
      projectId: context.sourceProjectId,
      config,
      fetchImpl: timeoutFetch
    }).catch(() => ({ count: 0, cases: [], coverage: null }))
  ]);
  const links = rawLinks
    .filter((row) => ["manual", "agent_approved"].includes(String(row.assignment_method || "manual")))
    .filter((row) => !row.created_at || Date.parse(row.created_at) <= cutoffMs)
    .sort((left, right) => Date.parse(left.created_at || 0) - Date.parse(right.created_at || 0));
  const rejectedRuns = rawRejectedRuns
    .filter((row) => !row.reviewed_at || Date.parse(row.reviewed_at) <= cutoffMs)
    .sort((left, right) => Date.parse(left.reviewed_at || 0) - Date.parse(right.reviewed_at || 0));
  const sharedLabelCases = (Array.isArray(sharedLabelResult.cases) ? sharedLabelResult.cases : [])
    .filter((item) => !item.provenance?.reviewedAt || Date.parse(item.provenance.reviewedAt) <= cutoffMs)
    .sort((left, right) => Date.parse(left.provenance?.reviewedAt || 0) - Date.parse(right.provenance?.reviewedAt || 0));
  const sourceRecovery = await loadScheduleAssignmentEvaluationSources({
    linkedSourceIds: links.map((row) => row.source_id),
    currentOnlySourceIds: [
      ...rejectedRuns.map((row) => row.source_id),
      ...sharedLabelCases.map((item) => item.sourceId)
    ],
    config
  });
  const recoveredSourceById = new Map(sourceRecovery.sources.map((item) => [String(item.sourceId), item]));
  const activeScheduleVersionId = String(inputs.scheduleMeta.sourceVersionId || "");
  const casesBySource = new Map();
  for (const link of links) {
    const sourceId = String(link.source_id || "");
    const recoveredSource = recoveredSourceById.get(sourceId);
    if (!sourceId || !recoveredSource) continue;
    const activeActivity = String(link.activity_key || "").startsWith(`gantt:${activeScheduleVersionId}:`);
    casesBySource.set(sourceId, {
      id: `link:${link.id}`,
      projectId: context.sourceProjectId,
      sourceId,
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
        reviewedAt: link.updated_at || link.created_at || null,
        recordOrigin: recoveredSource.recordOrigin,
        assignmentMethod: String(link.assignment_method || "manual")
      },
      source: recoveredSource.source
    });
  }
  const reconciledReviewLabels = reconcileScheduleAssignmentReviewLabels({
    reviewCases: sharedLabelCases,
    canonicalCases: [...casesBySource.values()]
  });
  const evidenceExclusions = [...reconciledReviewLabels.exclusions];
  const blockedReviewSourceIds = new Set(reconciledReviewLabels.blockedSourceIds);
  for (const labelledCase of reconciledReviewLabels.selectedCases) {
    const sourceId = String(labelledCase.sourceId || "");
    if (!sourceId) continue;
    if (labelledCase.scheduleVersionId && labelledCase.scheduleVersionId !== activeScheduleVersionId) {
      evidenceExclusions.push({
        sourceId,
        reviewId: labelledCase.provenance?.linkId || null,
        reason: "review_label_schedule_version_mismatch"
      });
      continue;
    }
    const recoveredSource = recoveredSourceById.get(sourceId);
    if (!recoveredSource) {
      evidenceExclusions.push({
        sourceId,
        reviewId: labelledCase.provenance?.linkId || null,
        reason: "review_label_source_not_recovered"
      });
      continue;
    }
    casesBySource.set(sourceId, {
      ...labelledCase,
      scheduleVersionId: activeScheduleVersionId,
      provenance: {
        ...labelledCase.provenance,
        recordOrigin: recoveredSource.recordOrigin
      },
      source: recoveredSource.source
    });
  }
  for (const run of rejectedRuns) {
    const sourceId = String(run.source_id || "");
    const recoveredSource = recoveredSourceById.get(sourceId);
    if (!sourceId || blockedReviewSourceIds.has(sourceId) || casesBySource.has(sourceId) || !run.selected_activity_key || !recoveredSource) continue;
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
        reviewedAt: run.reviewed_at || null,
        recordOrigin: recoveredSource.recordOrigin,
        assignmentMethod: null
      },
      source: recoveredSource.source
    });
  }
  const cases = [...casesBySource.values()];
  const includedSourceIds = new Set(cases.map((item) => item.sourceId));
  const exclusions = [
    ...sourceRecovery.exclusions,
    ...evidenceExclusions,
    ...links
      .filter((row) => !includedSourceIds.has(String(row.source_id || "")))
      .map((row) => ({ sourceId: String(row.source_id || ""), reason: "eligible_link_not_included", linkId: String(row.id || "") })),
    ...rejectedRuns
      .filter((row) => row.selected_activity_key && !includedSourceIds.has(String(row.source_id || "")))
      .map((row) => ({ sourceId: String(row.source_id || ""), reason: "eligible_rejected_run_not_included", runId: String(row.id || "") }))
  ].filter((item, index, all) => all.findIndex((other) => other.sourceId === item.sourceId && other.reason === item.reason) === index);
  const dataset = {
    schemaVersion: "schedule-assignment-dataset.v2",
    dataCutoff,
    preparedAt: new Date().toISOString(),
    settingsSource: hasFlag("--code-defaults") ? "code_defaults" : "remote_active_settings",
    sourceProjectId: context.sourceProjectId,
    scheduleProjectId: context.scheduleProjectId,
    activeScheduleVersionId,
    scheduleMeta: inputs.scheduleMeta,
    tasks: inputs.tasks,
    cases,
    sourceRecovery: {
      requestedCount: sourceRecovery.requestedCount,
      currentCount: sourceRecovery.currentCount,
      recoveredLegacyCount: sourceRecovery.recoveredLegacyCount,
      eligibleLinkCount: links.length,
      eligibleRejectedRunCount: rejectedRuns.filter((row) => row.selected_activity_key).length,
      eligibleSharedReviewLabelCount: sharedLabelCases.length,
      includedCaseCount: cases.length,
      exclusions
    },
    labelCoverage: summarizeScheduleAssignmentLabelCoverage(cases)
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
    labelBreakdown: Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES).map((label) => [label, cases.filter((item) => item.label.type === label).length])),
    labelCoverage: dataset.labelCoverage,
    sourceRecovery: dataset.sourceRecovery,
    exclusionBreakdown: Object.fromEntries([...new Set(exclusions.map((item) => item.reason))].map((reason) => [reason, exclusions.filter((item) => item.reason === reason).length]))
  }, null, 2));
}

async function runEvaluation() {
  const datasetPath = valueAfter("--dataset");
  if (!datasetPath) throw new Error("--run requires --dataset <path>");
  const dataset = JSON.parse(await readFile(path.resolve(datasetPath), "utf8"));
  const { config, settings } = await loadRuntime({ reloadRemoteSettings: !hasFlag("--code-defaults") });
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is not configured; the full baseline cannot run.");
  const requestedSourceIds = new Set(String(valueAfter("--source-ids") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean));
  const eligibleCases = requestedSourceIds.size
    ? dataset.cases.filter((item) => requestedSourceIds.has(String(item.sourceId)))
    : dataset.cases;
  if (requestedSourceIds.size && eligibleCases.length !== requestedSourceIds.size) {
    const found = new Set(eligibleCases.map((item) => String(item.sourceId)));
    const missing = [...requestedSourceIds].filter((sourceId) => !found.has(sourceId));
    throw new Error(`Unknown --source-ids: ${missing.join(", ")}`);
  }
  const limit = Math.max(1, Math.min(eligibleCases.length, Number(valueAfter("--limit")) || eligibleCases.length));
  const selectedCases = eligibleCases.slice(0, limit);
  const retrievalOnly = hasFlag("--retrieval-only");
  const evaluationConfig = retrievalOnly
    ? {
        ...config,
        scheduleAssignmentAgent: {
          ...config.scheduleAssignmentAgent,
          maxModelCalls: 0,
          roles: Object.fromEntries(Object.entries(config.scheduleAssignmentAgent.roles || {}).map(([roleName, role]) => [
            roleName,
            roleName === "embedding" ? role : { ...role, enabled: false }
          ]))
        }
      }
    : config;
  const retrieval = {
    strategy: valueAfter("--retrieval-strategy") || "deterministic_first",
    semanticPoolLimit: Number(valueAfter("--semantic-pool-limit")) || 20,
    modelCandidateLimit: Number(valueAfter("--model-candidate-limit")) || 20
  };
  const manifest = buildScheduleAssignmentEvaluationManifest({
    dataCutoff: dataset.dataCutoff,
    activeScheduleVersionId: dataset.activeScheduleVersionId,
    settings: evaluationConfig.scheduleAssignmentAgent,
    cases: selectedCases
  });
  const rows = [];
  for (const [caseIndex, fixture] of selectedCases.entries()) {
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
        config: evaluationConfig,
        settings,
        apiKey: evaluationConfig.openRouterApiKey,
        retrieval
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
    const evaluated = evaluateScheduleAssignmentCase({ fixture, result, durationMs: Date.now() - startedAt });
    rows.push(evaluated);
    console.error(JSON.stringify({
      progress: `${caseIndex + 1}/${selectedCases.length}`,
      sourceId: fixture.sourceId,
      labelType: evaluated.labelType,
      selectedActivityKey: evaluated.selectedActivityKey,
      expectedActivityKey: evaluated.expectedActivityKey,
      finalRank: evaluated.candidateRecallByStage?.final?.rank ?? null,
      durationMs: evaluated.durationMs
    }));
  }
  const report = {
    schemaVersion: "schedule-assignment-evaluation-report.v2",
    generatedAt: new Date().toISOString(),
    runtime: {
      settingsSource: hasFlag("--code-defaults") ? "code_defaults" : "remote_active_settings",
      databasePersistence: "disabled",
      retrievalOnly,
      retrieval
    },
    dataset: {
      schemaVersion: dataset.schemaVersion || null,
      sourceRecovery: dataset.sourceRecovery || null
    },
    manifest,
    summary: summarizeScheduleAssignmentEvaluation(rows)
  };
  const retrievalSuffixBase = retrieval.strategy === "deterministic_first" && retrieval.modelCandidateLimit === 20
    ? "baseline"
    : `${safeFileName(retrieval.strategy)}-model-${retrieval.modelCandidateLimit}-semantic-${retrieval.semanticPoolLimit}`;
  const retrievalSuffix = retrievalOnly ? `${retrievalSuffixBase}-retrieval-only` : retrievalSuffixBase;
  const defaultPath = path.join(localRoot, `${safeFileName(dataset.sourceProjectId)}-${dataset.dataCutoff.slice(0, 10)}-${retrievalSuffix}-report.json`);
  const outputPath = await writePrivateJson(valueAfter("--output") || defaultPath, report);
  console.log(JSON.stringify({
    ok: true,
    mode,
    outputPath,
    manifest,
    metrics: {
      ...report.summary,
      rows: undefined,
      rawScorePolicySweep: undefined,
      rawScorePolicySweepRows: report.summary.rawScorePolicySweep.length
    }
  }, null, 2));
}

if (!mode) {
  throw new Error("Choose --prepare or --run. Example: npm run schedule:assignment:evaluate -- --prepare --project <project-id>");
}

if (mode === "prepare") await prepareDataset();
else await runEvaluation();
