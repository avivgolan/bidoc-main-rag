import crypto from "node:crypto";
import { chatCompletion, createEmbedding, summarizeOpenRouterUsage } from "../openrouter.js";
import { createCacheContext, finalizeCacheMetrics } from "../cache.js";
import {
  buildAssignmentCandidates,
  cosineSimilarity,
  evaluateTimeRelevance,
  evaluateAssignmentDecision,
  normalizeScheduleAssignmentAgentSettings,
  sanitizeRoleResult,
  scheduleAssignmentConfigurationSnapshot,
  SCHEDULE_ASSIGNMENT_ENGINE_VERSION,
  validateScheduleAssignmentAgentSettings
} from "../scheduleActivityAssignmentEngine.js";
import { loadScheduleInputs, scheduleDataRequest, scheduleRpcRequest, scheduleSettings } from "../scheduleIngestion.js";
import { resolveIndicatorProjectContext } from "../indicator/contractConditions.js";
import { buildScheduleActivityAssignmentWorkflowLog } from "../scheduleActivityAssignmentWorkflow.js";
import { scheduleActivityUpdateItem } from "./schedule.js";

const RUNS_TABLE = "schedule_activity_assignment_runs";
const CANDIDATES_TABLE = "schedule_activity_assignment_candidates";
const LINKS_TABLE = "schedule_activity_alert_links";
const COMMIT_RPC = "bidoc_schedule_commit_activity_assignment_v1";
const ALERT_COLUMNS = "id,created_at,data_date,alert_type,severity_level,item_status,lifecycle_status,status,summary,alert_description,answer,question,content,data_link,metadata,hashtags";

function isoAlertDate(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/u);
  return match ? match[1] : null;
}

function safeError(error) {
  return String(error?.message || error || "unknown_error").replace(/[\r\n]+/gu, " ").slice(0, 700);
}

function isMissingAuditTableError(error) {
  return /schedule_activity_assignment_(?:runs|candidates)|assignment_method|assignment_run_id|schema cache|PGRST205/iu.test(safeError(error));
}

async function persistRows({ config, settings, table, body, prefer = "return=minimal" }) {
  return scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/${table}`,
    options: { method: "POST", body, headers: { Prefer: prefer } }
  });
}

async function patchRows({ config, settings, table, filter, body }) {
  return scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/${table}?${filter}`,
    options: { method: "PATCH", body, headers: { Prefer: "return=minimal" } }
  });
}

async function commitAssignmentLink({ config, settings, projectId, runId, activityKey, requestedBy, method, reviewNote }) {
  return scheduleRpcRequest({
    config,
    settings,
    rpc: COMMIT_RPC,
    payload: {
      p_project_id: projectId,
      p_run_id: runId,
      p_activity_key: activityKey,
      p_linked_by: requestedBy,
      p_method: method,
      p_review_note: reviewNote || null
    }
  });
}

function compactTask(task) {
  return {
    activityKey: task.activityKey,
    name: String(task.name || "").slice(0, 500),
    plannedStart: task.plannedStart || null,
    plannedFinish: task.plannedFinish || null,
    outlineLevel: task.outlineLevel ?? null,
    isMilestone: task.isMilestone === true
  };
}

function compactCandidateStage(candidate) {
  return {
    ...compactTask(candidate),
    rank: candidate.rank ?? null,
    finalScore: candidate.finalScore ?? null,
    signals: candidate.signals || {}
  };
}

function compactEvent(item) {
  const list = (value, limit = 20) => Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim().slice(0, 160)).filter(Boolean).slice(0, limit)
    : [];
  return {
    id: item.id,
    title: String(item.title || "").slice(0, 3000),
    description: String(item.description || "").slice(0, 3000),
    question: String(item.question || "").slice(0, 1500),
    answer: String(item.answer || "").slice(0, 1500),
    hashtags: list(item.hashtags),
    alertType: String(item.alertType || "").slice(0, 300),
    date: item.date,
    severity: item.severity,
    status: item.status
  };
}

async function callJsonRole({ apiKey, roleName, role, event, candidates = [], extra = {}, timeoutMs, telemetry = null }) {
  if (!roleName || !role?.schemaName || !role?.responseSchema) {
    throw new Error(`Structured output contract is missing for schedule assignment role ${roleName || "unknown"}`);
  }
  const content = await chatCompletion({
    apiKey,
    model: role.model,
    temperature: role.temperature,
    maxTokens: role.maxTokens,
    reasoning: role.reasoning,
    timeoutMs,
    telemetry,
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: role.schemaName,
        strict: true,
        schema: role.responseSchema
      }
    },
    messages: [
      { role: role.instructionRole || "developer", content: role.prompt },
      { role: "user", content: JSON.stringify({ event, candidates, ...extra }) }
    ]
  });
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Structured output from schedule assignment role ${roleName} was not valid JSON`);
  }
}

function extractedEvent(value, source) {
  const list = (input) => Array.isArray(input) ? input.map((item) => String(item || "").slice(0, 160)).filter(Boolean).slice(0, 20) : [];
  return {
    ...source,
    eventType: String(value?.eventType || source.alertType || "").slice(0, 160),
    subjects: list(value?.subjects),
    locations: list(value?.locations),
    trades: list(value?.trades),
    keywords: list(value?.keywords),
    date: isoAlertDate(value?.date) || source.date
  };
}

export const SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES = Object.freeze({
  DETERMINISTIC_FIRST: "deterministic_first",
  FULL_SEMANTIC: "full_semantic",
  HYBRID_UNION: "hybrid_union"
});

export function normalizeScheduleAssignmentRetrievalOptions(value = {}, agentSettings = {}) {
  const allowed = new Set(Object.values(SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES));
  const strategy = allowed.has(value?.strategy)
    ? value.strategy
    : SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES.DETERMINISTIC_FIRST;
  const maxCandidates = Math.max(2, Math.min(50, Math.round(Number(agentSettings?.maxCandidates) || 20)));
  const semanticPoolLimit = Math.max(2, Math.min(50, Math.round(Number(value?.semanticPoolLimit) || maxCandidates)));
  const modelCandidateLimit = Math.max(2, Math.min(20, Math.round(Number(value?.modelCandidateLimit) || maxCandidates)));
  return {
    strategy,
    semanticPoolLimit,
    modelCandidateLimit,
    fullSetSemantic: strategy !== SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES.DETERMINISTIC_FIRST
  };
}

export function scheduleAssignmentActivityEmbeddingText(candidate = {}) {
  return [
    candidate.activityKey,
    candidate.name,
    candidate.plannedStart,
    candidate.plannedFinish
  ].filter(Boolean).join(" | ");
}

function scheduleAssignmentQueryEmbeddingText(event = {}) {
  return [
    event.title,
    event.description,
    event.alertType,
    ...(event.subjects || []),
    ...(event.locations || []),
    ...(event.trades || []),
    ...(event.keywords || []),
    event.date
  ].filter(Boolean).join(" | ");
}

function semanticCandidateStage(tasks = [], semanticScores = {}, limit = 20) {
  return tasks
    .filter((task) => task?.activityKey && !task.isSummary && Number.isFinite(Number(semanticScores[task.activityKey])))
    .map((task) => ({
      ...compactTask(task),
      finalScore: Number((Number(semanticScores[task.activityKey]) * 100).toFixed(2)),
      signals: { semantic: Number(semanticScores[task.activityKey]) }
    }))
    .sort((left, right) => right.signals.semantic - left.signals.semantic
      || left.name.localeCompare(right.name, "he")
      || left.activityKey.localeCompare(right.activityKey))
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

async function mapWithConcurrency(items = [], concurrency = 8, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export function selectScheduleAssignmentRetrievalKeys({
  strategy,
  deterministicCandidates = [],
  semanticCandidates = [],
  modelCandidateLimit = 20
} = {}) {
  const limit = Math.max(2, Math.min(20, Math.round(Number(modelCandidateLimit) || 20)));
  if (strategy === SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES.FULL_SEMANTIC) {
    return semanticCandidates.slice(0, limit).map((item) => item.activityKey);
  }
  if (strategy !== SCHEDULE_ASSIGNMENT_RETRIEVAL_STRATEGIES.HYBRID_UNION) {
    return deterministicCandidates.slice(0, limit).map((item) => item.activityKey);
  }
  const selected = [];
  const selectedSet = new Set();
  const addSelected = (items, count) => {
    for (const item of items.slice(0, count)) {
      const activityKey = typeof item === "string" ? item : item?.activityKey;
      if (!activityKey || selectedSet.has(activityKey)) continue;
      selectedSet.add(activityKey);
      selected.push(activityKey);
    }
  };
  const semanticReserve = Math.max(1, Math.min(6, Math.ceil(limit * 0.5)));
  addSelected(deterministicCandidates, limit - semanticReserve);
  addSelected(semanticCandidates, semanticReserve);
  const ranks = new Map();
  const add = (items, leg) => items.forEach((item, index) => {
    if (!item?.activityKey) return;
    const current = ranks.get(item.activityKey) || {
      activityKey: item.activityKey,
      deterministicRank: Number.POSITIVE_INFINITY,
      semanticRank: Number.POSITIVE_INFINITY
    };
    current[leg] = index + 1;
    ranks.set(item.activityKey, current);
  });
  add(deterministicCandidates, "deterministicRank");
  add(semanticCandidates, "semanticRank");
  const fusedKeys = [...ranks.values()]
    .map((item) => ({
      ...item,
      bestRank: Math.min(item.deterministicRank, item.semanticRank),
      rankSum: item.deterministicRank + item.semanticRank
    }))
    .sort((left, right) => left.bestRank - right.bestRank
      || left.rankSum - right.rankSum
      || left.activityKey.localeCompare(right.activityKey))
    .map((item) => item.activityKey);
  addSelected(fusedKeys, fusedKeys.length);
  return selected.slice(0, limit);
}

async function semanticScoresForCandidates({
  apiKey,
  role,
  event,
  candidates,
  fullSetSemantic = false,
  cacheContext = null,
  telemetryFor = null
}) {
  if (!apiKey || !role.enabled || !role.model || !candidates.length) return {};
  const limited = candidates.slice(0, role.candidateLimit || candidates.length);
  const queryVector = await createEmbedding({
    apiKey,
    model: role.model,
    input: fullSetSemantic
      ? scheduleAssignmentQueryEmbeddingText(event)
      : [event.title, event.alertType, event.date].filter(Boolean).join(" | "),
    cacheContext,
    telemetry: telemetryFor?.("query") || null
  });
  const vectorResults = await mapWithConcurrency(limited, 8, async (candidate) => {
    try {
      const vector = await createEmbedding({
        apiKey,
        model: role.model,
        input: fullSetSemantic
          ? scheduleAssignmentActivityEmbeddingText(candidate)
          : [candidate.name, candidate.plannedStart, candidate.plannedFinish].filter(Boolean).join(" | "),
        cacheContext,
        telemetry: telemetryFor?.(candidate.activityKey) || null
      });
      return { candidate, vector, error: null };
    } catch (error) {
      return { candidate, vector: null, error: safeError(error) };
    }
  });
  const failures = vectorResults
    .filter((item) => item.error)
    .map((item) => ({ activityKey: item.candidate.activityKey, error: item.error }));
  if (!fullSetSemantic && failures.length) throw new Error(failures[0].error);
  const scores = Object.fromEntries(vectorResults
    .filter((item) => Array.isArray(item.vector))
    .map((item) => [item.candidate.activityKey, cosineSimilarity(queryVector, item.vector)]));
  if (!Object.keys(scores).length) throw new Error(failures[0]?.error || "Semantic activity embeddings were unavailable");
  return { scores, failures };
}

function candidateDbRow(runId, row) {
  return {
    run_id: runId,
    activity_key: row.activityKey,
    rank: row.rank,
    final_score: row.finalScore,
    lexical_score: Number((row.signals.lexical * 100).toFixed(2)),
    semantic_score: Number((row.signals.semantic * 100).toFixed(2)),
    temporal_score: Number((row.signals.temporal * 100).toFixed(2)),
    hierarchy_score: Number((row.signals.hierarchy * 100).toFixed(2)),
    historical_score: Number((row.signals.historical * 100).toFixed(2)),
    model_consensus_score: Number((row.signals.modelConsensus * 100).toFixed(2)),
    supporting_evidence: row.supportingEvidence,
    contradicting_evidence: row.contradictingEvidence
  };
}

export async function runScheduleActivityAssignmentAgent({
  projectId,
  sourceId,
  requestedBy = null,
  commit = true,
  persistAudit = true,
  timeFilter = false,
  evaluationFixture = null,
  config,
  settings: settingsInput = null,
  apiKey = "",
  runId: runIdInput = null,
  retrieval: retrievalInput = null,
  emit = null
} = {}) {
  if (!projectId || !sourceId) throw new Error("projectId and sourceId are required");
  if (commit && persistAudit === false) throw new Error("persistAudit=false is allowed only for a dry-run");
  if (evaluationFixture && (commit || persistAudit)) throw new Error("evaluationFixture requires commit=false and persistAudit=false");
  const scheduleCfg = settingsInput || scheduleSettings();
  const agentSettings = normalizeScheduleAssignmentAgentSettings(config?.scheduleAssignmentAgent);
  const retrieval = normalizeScheduleAssignmentRetrievalOptions(retrievalInput || {}, agentSettings);
  const validation = validateScheduleAssignmentAgentSettings(agentSettings);
  if (!validation.ok) throw new Error(`הגדרת סוכן השיוך אינה תקינה: ${validation.errors.join(" ")}`);
  if (!agentSettings.enabled) throw new Error("סוכן השיוך כבוי בהגדרות");

  const runId = runIdInput || crypto.randomUUID();
  const retrievalCacheContext = retrieval.fullSetSemantic
    ? createCacheContext({ config: config || {}, runId })
    : null;
  const startedAt = new Date().toISOString();
  const trace = [];
  const openRouterCalls = [];
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: new Date().toISOString(), data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };
  const telemetryFor = (stepName, callId) => ({
    step: stepName,
    callId,
    record: (entry) => openRouterCalls.push(entry)
  });
  step("assignment_start", "Schedule activity assignment started", {
    projectId,
    sourceId: String(sourceId),
    commit,
    persistAudit,
    timeFilter
  });
  const warnings = [...validation.warnings];
  const configuration = scheduleAssignmentConfigurationSnapshot(agentSettings);
  const finalizeResult = (result, { scheduleMeta = {}, taskCount = 0, finishedAt = new Date().toISOString() } = {}) => {
    step("assignment_result", "Schedule activity assignment finished", {
      status: result.status,
      selectedActivityKey: result.decision?.selectedActivityKey || null,
      rankingScore: result.decision?.rankingScore ?? result.decision?.confidence ?? null,
      calibratedProbability: result.decision?.calibratedProbability ?? null,
      warnings: result.warnings?.length || 0
    });
    const openRouterUsage = summarizeOpenRouterUsage(openRouterCalls);
    return {
      ...result,
      workflowLog: buildScheduleActivityAssignmentWorkflowLog({
        result,
        configuration,
        scheduleMeta,
        taskCount,
        openRouterUsage,
        trace,
        startedAt,
        finishedAt
      })
    };
  };
  const projectContext = evaluationFixture
    ? {
        sourceProjectId: String(evaluationFixture.sourceProjectId || projectId),
        scheduleProjectId: String(evaluationFixture.scheduleProjectId || projectId)
      }
    : await resolveIndicatorProjectContext({ projectId, config, settings: scheduleCfg });
  const frozenInputs = evaluationFixture
    ? { tasks: evaluationFixture.tasks || [], scheduleMeta: evaluationFixture.scheduleMeta || {} }
    : null;
  const inputsPromise = timeFilter
    ? null
    : frozenInputs
      ? Promise.resolve(frozenInputs)
      : loadScheduleInputs({ config, projectId, engineProjectId: projectContext.scheduleProjectId, settings: scheduleCfg });
  const [sourceRows, existingLinks] = evaluationFixture
    ? [[evaluationFixture.source].filter(Boolean), []]
    : await Promise.all([
        scheduleDataRequest({
          config,
          settings: scheduleCfg,
          path: `/rest/v1/alerts?select=${ALERT_COLUMNS}&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&id=eq.${encodeURIComponent(String(sourceId))}&limit=1`
        }),
        scheduleDataRequest({
          config,
          settings: scheduleCfg,
          path: `/rest/v1/${LINKS_TABLE}?select=id,activity_key,assignment_method&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&source_table=eq.alerts&source_id=eq.${encodeURIComponent(String(sourceId))}&limit=1`
        }).catch(() => [])
      ]);
  const source = sourceRows[0];
  if (!source) throw new Error("update or alert not found");
  const baseEvent = scheduleActivityUpdateItem(
    { ...source, id: `alert_${source.id}` },
    existingLinks[0]?.activity_key || null,
    existingLinks[0]?.assignment_method || null
  );
  const event = {
    ...baseEvent,
    description: source.alert_description || source.metadata?.alert_description || "",
    question: source.question || "",
    answer: source.answer || "",
    hashtags: Array.isArray(source.hashtags) ? source.hashtags : []
  };
  if (!event.date) throw new Error("לא ניתן להריץ שיוך ללא תאריך עסקי קנוני");
  step("assignment_alert", "Alert/update loaded", {
    sourceId: String(source.id),
    eventDate: event.date,
    alertType: event.alertType,
    existingActivityKey: event.activityKey || null
  });
  let timeFilterResult = null;
  let timeFilterRole = null;
  if (timeFilter === true) {
    timeFilterResult = evaluateTimeRelevance({
      event: compactEvent(event),
      confidenceThreshold: agentSettings.timeFilterConfidenceThreshold
    });
    if (timeFilterResult.method !== "deterministic") {
      const role = agentSettings.roles.timeFilter;
      if (!apiKey || !role?.enabled) {
        warnings.push("מסנן הזמן אינו זמין; מטעמי בטיחות ההתראה ממשיכה לבדיקה המלאה.");
        timeFilterRole = { ok: false, error: !apiKey ? "openrouter_key_missing" : "disabled" };
      } else {
        try {
          const rawTimeFilter = await callJsonRole({
            apiKey,
            roleName: "timeFilter",
            role,
            event: compactEvent(event),
            timeoutMs: agentSettings.timeoutMs,
            telemetry: telemetryFor("assignment_time_filter", "time_filter")
          });
          timeFilterResult = evaluateTimeRelevance({
            event: compactEvent(event),
            modelResult: rawTimeFilter,
            confidenceThreshold: agentSettings.timeFilterConfidenceThreshold
          });
          timeFilterRole = { ok: true, ...timeFilterResult };
        } catch (error) {
          timeFilterRole = { ok: false, error: safeError(error) };
          warnings.push("מסנן הזמן נכשל; מטעמי בטיחות ההתראה ממשיכה לבדיקה המלאה.");
        }
      }
    } else {
      timeFilterRole = { ok: true, ...timeFilterResult };
    }
    step("assignment_time_filter", "Time relevance filter completed", {
      method: timeFilterResult.method,
      isTimeRelated: timeFilterResult.isTimeRelated,
      shouldSkip: timeFilterResult.shouldSkip,
      confidence: timeFilterResult.confidence,
      threshold: agentSettings.timeFilterConfidenceThreshold
    }, timeFilterRole?.ok === false ? "error" : "done");
    if (timeFilterResult.shouldSkip) {
      return finalizeResult({
        ok: true,
        runId: null,
        workflowRunId: runId,
        projectId: projectContext.sourceProjectId,
        scheduleProjectId: projectContext.scheduleProjectId,
        sourceId: String(source.id),
        status: "filtered_out",
        dryRun: !commit,
        auditPersisted: false,
        engineVersion: SCHEDULE_ASSIGNMENT_ENGINE_VERSION,
        event: compactEvent(event),
        extractedEvent: null,
        timeFilter: { enabled: true, skipped: true, ...timeFilterResult },
        decision: {
          type: "filtered_out",
          selectedActivityKey: null,
          selectedActivityName: null,
          rankingScore: 0,
          runnerUpRankingScore: 0,
          rankingGap: 0,
          calibratedProbability: null,
          calibration: { status: "not_applicable", probability: null, artifactId: null, reason: "filtered_out" },
          confidence: timeFilterResult.confidence,
          runnerUpConfidence: 0,
          margin: 0,
          reason: timeFilterResult.reason,
          autoAssigned: false,
          gates: { timeRelated: false }
        },
        candidates: [],
        roles: { timeFilter: timeFilterRole },
        assignment: null,
        warnings
      });
    }
  } else {
    step("assignment_time_filter", "Time relevance filter was not requested", { enabled: false }, "skipped");
  }
  const inputs = await (inputsPromise || (frozenInputs
    ? Promise.resolve(frozenInputs)
    : loadScheduleInputs({ config, projectId, engineProjectId: projectContext.scheduleProjectId, settings: scheduleCfg })));
  const tasks = inputs.tasks.filter((task) => task.activityKey && !task.isSummary);
  if (!tasks.length) throw new Error("לא נמצאו פעילויות בגרסת לוח הזמנים הפעילה");
  step("assignment_schedule", "Active Gantt activities loaded", {
    sourceVersionId: inputs.scheduleMeta.sourceVersionId,
    taskCount: tasks.length,
    displayName: inputs.scheduleMeta.displayName || null
  });
  const auditPersistenceSkipped = persistAudit === false;
  let auditPersisted = false;
  if (!auditPersistenceSkipped) {
    try {
      await persistRows({
        config,
        settings: scheduleCfg,
        table: RUNS_TABLE,
        body: {
          id: runId,
          project_id: projectContext.scheduleProjectId,
          source_table: "alerts",
          source_id: String(source.id),
          source_event_date: event.date,
          schedule_version_id: String(inputs.scheduleMeta.sourceVersionId),
          status: "running",
          threshold_snapshot: agentSettings.autoAssignmentThreshold,
          margin_snapshot: agentSettings.minimumRunnerUpMargin,
          model_configuration: configuration,
          tool_versions: { engine: SCHEDULE_ASSIGNMENT_ENGINE_VERSION },
          started_at: startedAt,
          requested_by: requestedBy
        }
      });
      auditPersisted = true;
    } catch (error) {
      if (!isMissingAuditTableError(error)) throw error;
      warnings.push("מיגרציית טבלאות הביקורת של סוכן השיוך טרם הוחלה; הריצה לא נשמרה במסד.");
    }
  }
  step("assignment_audit_start", auditPersistenceSkipped ? "Assignment audit persistence skipped for evaluation" : auditPersisted ? "Assignment audit run initialized" : "Assignment audit schema unavailable", {
    persisted: auditPersisted,
    skipped: auditPersistenceSkipped,
    runId,
    threshold: agentSettings.autoAssignmentThreshold,
    margin: agentSettings.minimumRunnerUpMargin
  }, auditPersistenceSkipped ? "skipped" : auditPersisted ? "done" : "error");

  let extracted = compactEvent(event);
  let extractorOutput = null;
  let matcher = null;
  let validator = null;
  let judge = null;
  let semanticScores = {};
  const candidateStages = { deterministic: [], semantic: [], retrieval: [], final: [] };
  let modelCalls = 0;
  let aiCompleted = false;
  const roleErrors = {};

  if (apiKey && agentSettings.roles.extractor.enabled && modelCalls < agentSettings.maxModelCalls) {
    modelCalls += 1;
    try {
      extractorOutput = await callJsonRole({
        apiKey,
        roleName: "extractor",
        role: agentSettings.roles.extractor,
        event: compactEvent(event),
        timeoutMs: agentSettings.timeoutMs,
        telemetry: telemetryFor("assignment_extractor", "extractor")
      });
      extracted = extractedEvent(extractorOutput, compactEvent(event));
    } catch (error) {
      roleErrors.extractor = safeError(error);
    }
  }
  step("assignment_extractor", extractorOutput ? "Event fields extracted" : "Event extractor did not complete", {
    model: agentSettings.roles.extractor.model,
    temperature: agentSettings.roles.extractor.temperature,
    maxTokens: agentSettings.roles.extractor.maxTokens,
    extracted,
    error: roleErrors.extractor || null
  }, extractorOutput ? "done" : roleErrors.extractor ? "error" : "skipped");

  let candidates = buildAssignmentCandidates({ event: extracted, tasks, settings: agentSettings });
  candidateStages.deterministic = candidates.map(compactCandidateStage);
  step("assignment_candidates", "Deterministic candidate retrieval completed", {
    candidateCount: candidates.length,
    tools: agentSettings.tools,
    weights: agentSettings.weights,
    maxCandidates: agentSettings.maxCandidates
  });
  if (apiKey && agentSettings.tools.semantic && agentSettings.roles.embedding.enabled) {
    try {
      const semanticScanCandidates = retrieval.fullSetSemantic
        ? tasks.filter((task) => task?.activityKey && !task.isSummary)
        : candidates;
      const semanticResult = await semanticScoresForCandidates({
        apiKey,
        role: retrieval.fullSetSemantic
          ? { ...agentSettings.roles.embedding, candidateLimit: semanticScanCandidates.length }
          : agentSettings.roles.embedding,
        event: extracted,
        candidates: semanticScanCandidates,
        fullSetSemantic: retrieval.fullSetSemantic,
        cacheContext: retrievalCacheContext,
        telemetryFor: (callId) => telemetryFor("assignment_embedding", callId)
      });
      semanticScores = semanticResult.scores;
      if (semanticResult.failures.length) {
        roleErrors.embedding = `${semanticResult.failures.length} activity embeddings failed; automatic assignment is blocked.`;
        warnings.push("חלק מהטמעות הפעילויות נכשלו; הדירוג החלקי נשמר לבדיקה אך שיוך אוטומטי נחסם.");
      }
      if (retrieval.fullSetSemantic) {
        candidateStages.semantic = semanticCandidateStage(tasks, semanticScores, retrieval.semanticPoolLimit);
        const retrievalKeys = selectScheduleAssignmentRetrievalKeys({
          strategy: retrieval.strategy,
          deterministicCandidates: candidateStages.deterministic,
          semanticCandidates: candidateStages.semantic,
          modelCandidateLimit: retrieval.modelCandidateLimit
        });
        const retrievalRank = new Map(retrievalKeys.map((activityKey, index) => [activityKey, index]));
        const retrievalTasks = tasks
          .filter((task) => retrievalRank.has(task.activityKey))
          .sort((left, right) => retrievalRank.get(left.activityKey) - retrievalRank.get(right.activityKey));
        const scoredByKey = new Map(buildAssignmentCandidates({
          event: extracted,
          tasks: retrievalTasks,
          settings: agentSettings,
          semanticScores
        }).map((item) => [item.activityKey, item]));
        candidates = retrievalKeys.map((activityKey) => scoredByKey.get(activityKey)).filter(Boolean);
        candidateStages.retrieval = candidates.map(compactCandidateStage);
      } else {
        candidates = buildAssignmentCandidates({ event: extracted, tasks, settings: agentSettings, semanticScores });
        candidateStages.semantic = candidates.map(compactCandidateStage);
        candidateStages.retrieval = candidates.map(compactCandidateStage);
      }
    } catch (error) {
      roleErrors.embedding = safeError(error);
      warnings.push("שכבת החיפוש הסמנטי נכשלה; לא יתבצע שיוך אוטומטי בריצה זו.");
    }
  }
  step("assignment_embedding", Object.keys(semanticScores).length ? "Semantic candidate scoring completed" : "Semantic scoring was unavailable", {
    enabled: agentSettings.tools.semantic && agentSettings.roles.embedding.enabled,
    model: agentSettings.roles.embedding.model,
    retrievalStrategy: retrieval.strategy,
    candidateLimit: agentSettings.roles.embedding.candidateLimit,
    semanticPoolLimit: retrieval.semanticPoolLimit,
    modelCandidateLimit: retrieval.modelCandidateLimit,
    scoredCandidates: Object.keys(semanticScores).length,
    error: roleErrors.embedding || null
  }, Object.keys(semanticScores).length ? "done" : roleErrors.embedding ? "error" : "skipped");
  if (agentSettings.tools.projectRag) warnings.push("Project RAG מסומן בהגדרות אך אינו מחובר עדיין למאגר פעילויות ה־Gantt; הריצה המשיכה בלעדיו.");

  const modelCandidates = candidates.map(compactTask);
  const roleJobs = [];
  if (apiKey && agentSettings.roles.matcher.enabled && modelCalls < agentSettings.maxModelCalls) {
    modelCalls += 1;
    roleJobs.push(callJsonRole({
      apiKey,
      roleName: "matcher",
      role: agentSettings.roles.matcher,
      event: extracted,
      candidates: modelCandidates,
      timeoutMs: agentSettings.timeoutMs,
      telemetry: telemetryFor("assignment_matcher", "matcher")
    })
      .then((value) => { matcher = sanitizeRoleResult(value, modelCandidates.map((item) => item.activityKey)); })
      .catch((error) => { roleErrors.matcher = safeError(error); }));
  }
  if (apiKey && agentSettings.roles.validator.enabled && modelCalls < agentSettings.maxModelCalls) {
    modelCalls += 1;
    roleJobs.push(callJsonRole({
      apiKey,
      roleName: "validator",
      role: agentSettings.roles.validator,
      event: extracted,
      candidates: modelCandidates,
      timeoutMs: agentSettings.timeoutMs,
      telemetry: telemetryFor("assignment_validator", "validator")
    })
      .then((value) => { validator = sanitizeRoleResult(value, modelCandidates.map((item) => item.activityKey), { validator: true }); })
      .catch((error) => { roleErrors.validator = safeError(error); }));
  }
  await Promise.all(roleJobs);
  step("assignment_matcher", matcher ? "Professional matcher completed" : "Professional matcher did not complete", {
    model: agentSettings.roles.matcher.model,
    candidateCount: modelCandidates.length,
    bestActivityKey: matcher?.bestActivityKey || null,
    decision: matcher?.decision || null,
    error: roleErrors.matcher || null
  }, matcher ? "done" : roleErrors.matcher ? "error" : "skipped");
  step("assignment_validator", validator ? "Schedule validator completed" : "Schedule validator did not complete", {
    model: agentSettings.roles.validator.model,
    candidateCount: modelCandidates.length,
    bestActivityKey: validator?.bestActivityKey || null,
    decision: validator?.decision || null,
    error: roleErrors.validator || null
  }, validator ? "done" : roleErrors.validator ? "error" : "skipped");
  aiCompleted = Boolean(extractorOutput && matcher && validator && !roleErrors.embedding && (auditPersisted || auditPersistenceSkipped));
  const finalCandidateKeys = retrieval.fullSetSemantic
    ? new Set(modelCandidates.map((item) => item.activityKey))
    : null;
  const finalTasks = finalCandidateKeys
    ? tasks.filter((task) => finalCandidateKeys.has(task.activityKey))
    : tasks;
  candidates = buildAssignmentCandidates({ event: extracted, tasks: finalTasks, settings: agentSettings, semanticScores, matcher, validator });
  candidateStages.final = candidates.map(compactCandidateStage);

  let decision = evaluateAssignmentDecision({
    candidates,
    settings: agentSettings,
    matcher,
    validator,
    eventDate: event.date,
    existingActivityKey: event.activityKey,
    scheduleVersionId: inputs.scheduleMeta.sourceVersionId,
    aiCompleted,
    calibrator: config?.scheduleAssignmentCalibration || null,
    calibrationContext: {
      settingsVersion: agentSettings.version || null,
      configurationSnapshotId: configuration.snapshotId
    }
  });
  const nearThreshold = Math.abs(decision.rankingScore - agentSettings.autoAssignmentThreshold) <= agentSettings.judgeNearThresholdRange;
  const roleDisagreement = matcher?.bestActivityKey !== validator?.bestActivityKey;
  if (apiKey && agentSettings.roles.judge.enabled && modelCalls < agentSettings.maxModelCalls && (nearThreshold || roleDisagreement || decision.decision === "ambiguous")) {
    try {
      modelCalls += 1;
      const rawJudge = await callJsonRole({
        apiKey,
        roleName: "judge",
        role: agentSettings.roles.judge,
        event: extracted,
        candidates: candidates.slice(0, 5).map((item) => ({ ...compactTask(item), finalScore: item.finalScore, evidence: item.supportingEvidence, conflicts: item.contradictingEvidence })),
        extra: { matcher, validator },
        timeoutMs: agentSettings.timeoutMs,
        telemetry: telemetryFor("assignment_judge", "judge")
      });
      const allowed = new Set(candidates.slice(0, 5).map((item) => item.activityKey));
      judge = {
        decision: ["match", "ambiguous", "no_match", "conflict"].includes(rawJudge?.decision) ? rawJudge.decision : "ambiguous",
        selectedActivityKey: allowed.has(rawJudge?.selectedActivityKey) ? rawJudge.selectedActivityKey : null,
        runnerUpActivityKey: allowed.has(rawJudge?.runnerUpActivityKey) ? rawJudge.runnerUpActivityKey : null,
        reason: String(rawJudge?.reason || "").slice(0, 1000),
        conflicts: Array.isArray(rawJudge?.conflicts) ? rawJudge.conflicts.map((item) => String(item).slice(0, 300)).slice(0, 20) : []
      };
    } catch (error) {
      roleErrors.judge = safeError(error);
      aiCompleted = false;
    }
    decision = evaluateAssignmentDecision({
      candidates,
      settings: agentSettings,
      matcher,
      validator,
      judge,
      eventDate: event.date,
      existingActivityKey: event.activityKey,
      scheduleVersionId: inputs.scheduleMeta.sourceVersionId,
      aiCompleted,
      calibrator: config?.scheduleAssignmentCalibration || null,
      calibrationContext: {
        settingsVersion: agentSettings.version || null,
        configurationSnapshotId: configuration.snapshotId
      }
    });
  }
  step("assignment_judge", judge ? "Decision judge completed" : "Decision judge was not required", {
    model: agentSettings.roles.judge.model,
    invoked: Boolean(judge || roleErrors.judge),
    nearThreshold,
    roleDisagreement,
    decision: judge?.decision || null,
    selectedActivityKey: judge?.selectedActivityKey || null,
    error: roleErrors.judge || null
  }, judge ? "done" : roleErrors.judge ? "error" : "skipped");
  step("assignment_policy", "Safety and auto-assignment policy evaluated", {
    decision: decision.decision,
    rankingScore: decision.rankingScore,
    runnerUpRankingScore: decision.runnerUpRankingScore,
    rankingGap: decision.rankingGap,
    calibratedProbability: decision.calibratedProbability,
    calibrationStatus: decision.calibration.status,
    confidence: decision.confidence,
    runnerUpConfidence: decision.runnerUpConfidence,
    margin: decision.margin,
    autoAssignmentThreshold: agentSettings.autoAssignmentThreshold,
    minimumRunnerUpMargin: agentSettings.minimumRunnerUpMargin,
    gates: decision.gates,
    autoAssigned: decision.autoAssigned
  });

  let assignment = null;
  const finishedAt = new Date().toISOString();
  let status = decision.decision === "no_match" ? "no_match" : "review_required";
  if (auditPersisted) {
    try {
      if (candidates.length) await persistRows({ config, settings: scheduleCfg, table: CANDIDATES_TABLE, body: candidates.map((row) => candidateDbRow(runId, row)) });
      await patchRows({
        config,
        settings: scheduleCfg,
        table: RUNS_TABLE,
        filter: `id=eq.${encodeURIComponent(runId)}`,
        body: {
          status,
          decision: decision.decision,
          selected_activity_key: decision.selected?.activityKey || null,
          confidence: decision.confidence,
          runner_up_confidence: decision.runnerUpConfidence,
          reason: judge?.reason || decision.reason,
          conflicts: [...(judge?.conflicts || []), ...Object.entries(roleErrors).map(([role, error]) => `${role}: ${error}`)],
          finished_at: finishedAt,
          assignment_method: null
        }
      });
    } catch (error) {
      auditPersisted = false;
      warnings.push(`שמירת ביקורת הריצה נכשלה: ${safeError(error)}`);
    }
  }
  step("assignment_audit", auditPersistenceSkipped ? "Assignment audit persistence skipped for evaluation" : auditPersisted ? "Assignment audit finalized" : "Assignment audit was not persisted", {
    persisted: auditPersisted,
    skipped: auditPersistenceSkipped,
    candidateCount: candidates.length,
    status
  }, auditPersistenceSkipped ? "skipped" : auditPersisted ? "done" : "error");
  if (commit && decision.autoAssigned && auditPersisted) {
    await commitAssignmentLink({
      config,
      settings: scheduleCfg,
      projectId: projectContext.scheduleProjectId,
      runId,
      activityKey: decision.selected.activityKey,
      requestedBy,
      method: "agent_auto",
      reviewNote: decision.reason
    });
    assignment = scheduleActivityUpdateItem(
      { ...source, id: `alert_${source.id}` },
      decision.selected.activityKey,
      "agent_auto"
    );
    status = "auto_assigned";
  }
  step("assignment_write", assignment ? "Activity assignment link committed" : "No automatic activity link was written", {
    commitRequested: commit,
    assigned: Boolean(assignment),
    activityKey: assignment?.activityKey || null,
    reason: assignment ? "agent_auto" : decision.reason
  }, assignment ? "done" : "skipped");

  if (!apiKey) warnings.push("מפתח OpenRouter אינו מוגדר ב־Settings; הוצגו מועמדים דטרמיניסטיים בלבד ולא בוצע שיוך אוטומטי.");
  if (Object.keys(roleErrors).length) warnings.push("אחד מתפקידי המודל או החיפוש נכשל; מדיניות הבטיחות חסמה שיוך אוטומטי.");
  return finalizeResult({
    ok: true,
    runId,
    workflowRunId: runId,
    projectId: projectContext.sourceProjectId,
    scheduleProjectId: projectContext.scheduleProjectId,
    sourceId: String(source.id),
    status,
    dryRun: !commit,
    auditPersisted,
    auditPersistenceSkipped,
    engineVersion: SCHEDULE_ASSIGNMENT_ENGINE_VERSION,
    scheduleVersionId: inputs.scheduleMeta.sourceVersionId,
    settingsVersion: agentSettings.version || null,
    configurationSnapshotId: configuration.snapshotId,
    event: compactEvent(event),
    extractedEvent: extracted,
    timeFilter: timeFilter === true ? { enabled: true, skipped: false, ...timeFilterResult } : { enabled: false, skipped: false },
    decision: {
      type: decision.decision,
      selectedActivityKey: decision.selected?.activityKey || null,
      selectedActivityName: decision.selected?.name || null,
      rankingScore: decision.rankingScore,
      runnerUpRankingScore: decision.runnerUpRankingScore,
      rankingGap: decision.rankingGap,
      calibratedProbability: decision.calibratedProbability,
      calibration: decision.calibration,
      roleAgreement: decision.roleAgreement,
      hardConflict: decision.hardConflict,
      confidence: decision.confidence,
      runnerUpConfidence: decision.runnerUpConfidence,
      margin: decision.margin,
      reason: judge?.reason || decision.reason,
      wouldAutoAssign: decision.autoAssigned,
      autoAssigned: Boolean(assignment),
      gates: decision.gates
    },
    candidates: candidates.slice(0, 8),
    candidateStages,
    retrieval: {
      ...retrieval,
      deterministicCandidateCount: candidateStages.deterministic.length,
      semanticCandidateCount: candidateStages.semantic.length,
      modelCandidateCount: modelCandidates.length,
      scoredSemanticCandidateCount: Object.keys(semanticScores).length,
      cache: retrievalCacheContext ? finalizeCacheMetrics(retrievalCacheContext) : null
    },
    roles: {
      timeFilter: timeFilterRole || { error: timeFilter === true ? "not_required" : "not_requested" },
      extractor: extractorOutput ? { ok: true } : { ok: false, error: roleErrors.extractor || "not_run" },
      matcher: matcher || { error: roleErrors.matcher || "not_run" },
      validator: validator || { error: roleErrors.validator || "not_run" },
      judge: judge || { error: roleErrors.judge || "not_required" },
      embedding: { ok: Object.keys(semanticScores).length > 0, error: roleErrors.embedding || null }
    },
    assignment,
    warnings
  }, {
    scheduleMeta: inputs.scheduleMeta,
    taskCount: tasks.length,
    finishedAt
  });
}

export async function getScheduleActivityAssignmentRun({ projectId, runId, config, settings: settingsInput = null } = {}) {
  if (!projectId || !runId) throw new Error("projectId and runId are required");
  const settings = settingsInput || scheduleSettings();
  const context = await resolveIndicatorProjectContext({ projectId, config, settings });
  const [runs, candidates] = await Promise.all([
    scheduleDataRequest({ config, settings, path: `/rest/v1/${RUNS_TABLE}?select=*&id=eq.${encodeURIComponent(runId)}&project_id=eq.${encodeURIComponent(context.scheduleProjectId)}&limit=1` }),
    scheduleDataRequest({ config, settings, path: `/rest/v1/${CANDIDATES_TABLE}?select=*&run_id=eq.${encodeURIComponent(runId)}&order=rank.asc` })
  ]);
  if (!runs[0]) throw new Error("assignment run not found");
  return { run: runs[0], candidates };
}

export async function persistScheduleActivityAssignmentWorkflow({
  scheduleProjectId,
  runId,
  workflowLog,
  runEvents = [],
  config,
  settings: settingsInput = null
} = {}) {
  if (!scheduleProjectId || !runId || !workflowLog) throw new Error("scheduleProjectId, runId and workflowLog are required");
  const settings = settingsInput || scheduleSettings();
  await patchRows({
    config,
    settings,
    table: RUNS_TABLE,
    filter: `id=eq.${encodeURIComponent(runId)}&project_id=eq.${encodeURIComponent(scheduleProjectId)}`,
    body: { workflow_log: workflowLog, run_events: Array.isArray(runEvents) ? runEvents.slice(-200) : [] }
  });
  return { persisted: true, runId };
}

export async function listScheduleActivityAssignmentWorkflowRuns({ limit = 30, config, settings: settingsInput = null } = {}) {
  const settings = settingsInput || scheduleSettings();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const rows = await scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/${RUNS_TABLE}?select=id,started_at,source_id,status,workflow_log,run_events&workflow_log=not.is.null&order=started_at.desc&limit=${safeLimit}`
  });
  return rows.map((row) => {
    const alertNode = (row.workflow_log?.nodes || []).find((node) => node.id === "assignment_alert");
    const alertTitle = String(alertNode?.output?.title || row.source_id || row.id).slice(0, 180);
    return {
      id: row.id,
      created_at: row.started_at,
      user_message: `סוכן שיוך לו״ז · ${alertTitle}`,
      workflow_log: row.workflow_log,
      run_events: Array.isArray(row.run_events) ? row.run_events : [],
      kind: "schedule_activity_assignment",
      status: row.status
    };
  });
}

export async function confirmScheduleActivityAssignment({ projectId, runId, activityKey, requestedBy = null, config, settings: settingsInput = null } = {}) {
  const settings = settingsInput || scheduleSettings();
  const { run, candidates } = await getScheduleActivityAssignmentRun({ projectId, runId, config, settings });
  if (!["review_required", "no_match"].includes(run.status)) throw new Error("assignment run is not awaiting review");
  const candidate = candidates.find((row) => row.activity_key === activityKey);
  if (!candidate) throw new Error("activityKey is not a candidate of this run");
  await commitAssignmentLink({
    config,
    settings,
    projectId: run.project_id,
    runId,
    activityKey,
    requestedBy,
    method: "agent_approved",
    reviewNote: "הצעת הסוכן אושרה ידנית",
  });
  const sourceRows = await scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/alerts?select=${ALERT_COLUMNS}&project_id=eq.${encodeURIComponent(run.project_id)}&id=eq.${encodeURIComponent(run.source_id)}&limit=1`
  });
  if (!sourceRows[0]) throw new Error("update or alert not found after assignment");
  const item = scheduleActivityUpdateItem(
    { ...sourceRows[0], id: `alert_${sourceRows[0].id}` },
    activityKey,
    "agent_approved"
  );
  return { item, runId, activityKey };
}

export async function rejectScheduleActivityAssignment({ projectId, runId, requestedBy = null, reason = "" , config, settings: settingsInput = null } = {}) {
  const settings = settingsInput || scheduleSettings();
  const { run, candidates } = await getScheduleActivityAssignmentRun({ projectId, runId, config, settings });
  if (!["review_required", "no_match"].includes(run.status)) throw new Error("assignment run is not awaiting review");
  await patchRows({ config, settings, table: RUNS_TABLE, filter: `id=eq.${encodeURIComponent(runId)}`, body: { status: "rejected", review_reason: String(reason || "").slice(0, 1000), reviewed_by: requestedBy, reviewed_at: new Date().toISOString() } });
  return {
    runId,
    sourceId: String(run.source_id),
    status: "rejected",
    rejectedCandidateKeys: candidates.map((candidate) => String(candidate.activity_key || "")).filter(Boolean).slice(0, 20)
  };
}
