import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { exportFullSettings, getConfig, initSettings, loadEnv, previewImportedSettingsFile, publicSettings, readLocalSettings, refreshSettingsIfStale, reloadSettingsFromDb, settingsOpenRouterApiKey, supabaseHeaders, supabaseKeyRole, TOOL_NAMES, writeLocalSettings } from "./config.js";
import { buildAgentList } from "./prompts.js";
import { chatCompletion, createEmbedding, extractJsonObject, listOpenRouterModels, summarizeOpenRouterUsage } from "./openrouter.js";
import { runChatPipeline } from "./agent.js";
import { addDelayEventChangeLog, addDelayEventEvidence, addDelayEventGap, annotateMessage, contentSupabaseConfig, createDelayClaim, createDelayEvent, createTimelineEventLink, deleteTimelineEventLink, fetchAlertsTimelineEvents, fetchTimelineEventPage, fetchTimelineEvents, getMessage, getLatestQaReport, getProjectInsightRun, graphSearch, hybridSearch, listDelayClaims, listDelayEvents, listDislikedMessages, listMessages, listProjectGraph, listProjectInsightRuns, listQaMessages, listQaReports, listRunHistory, listSessions, listTimelineEventLinks, listTimelineGraphData, parseTimelineEventsQuery, saveProjectInsightRun, saveQaReport, TimelineRequestError, updateDelayEvent, updateMessage, upsertProjectGraphData, upsertTimelineGraphData } from "./supabase.js";
import { buildTimelineLinkSuggestions, buildTimelineSuggestionFromEvents, eventTitle, isTimelineApprovalEvent, isTimelineEventAfter, isTimelineQuoteEvent, mergeTimelineSuggestions, normalizeTimelineSource, timelineEventText } from "./timelineLinks.js";
import { buildEntityGraphRowsForEvents, buildTimelineKnowledgeGraph, createTimelineGraphScorer } from "./timelineGraph.js";
import { runQaAgent, runQaTrendAnalysis } from "./qaAgent.js";
import { callN8nTool } from "./tools.js";
import { authorizeContractsExtractionRequest, authorizeDataQueryRequest } from "./apiSecurity.js";
import { runAlertAgent } from "./subagents/alert.js";
import { assignScheduleActivityUpdate, listScheduleActivityUpdates, listScheduleAlerts, listScheduleConditions, runScheduleAlertScan, runScheduleHealth, runScheduleIndicator, runScheduleSweep } from "./subagents/schedule.js";
import { confirmScheduleActivityAssignment, getScheduleActivityAssignmentRun, listScheduleActivityAssignmentWorkflowRuns, persistScheduleActivityAssignmentWorkflow, rejectScheduleActivityAssignment, runScheduleActivityAssignmentAgent } from "./subagents/scheduleActivityAssignmentAgent.js";
import { getPendingSharedScheduleAssignmentReview, listSharedScheduleAssignmentEvaluationLabels, listSharedScheduleAssignmentReviews, persistSharedScheduleAssignmentReview, resolveSharedScheduleAssignmentReviews, scheduleAssignmentNeedsSharedReview } from "./subagents/scheduleActivityAssignmentReviewQueue.js";
import { SCHEDULE_ASSIGNMENT_LABEL_TYPES, SCHEDULE_ASSIGNMENT_NEGATIVE_LABEL_TYPES } from "./scheduleActivityAssignmentLabels.js";
import { scheduleAssignmentConfigurationSnapshot, validateScheduleAssignmentAgentSettings } from "./scheduleActivityAssignmentEngine.js";
import { runScheduleConditionResolver } from "./subagents/scheduleConditionResolver.js";
import { CONTRACTS_AGENT_VERSION, CONTRACTS_EXTRACTION_BUDGET_MS, CONTRACTS_MAX_JSON_BYTES, CONTRACTS_MAX_PDF_BYTES, CONTRACTS_MAX_RESPONSE_BYTES, CONTRACTS_PDF_READER_VERSION } from "./contracts/constants.js";
import { contractsErrorResponse } from "./contracts/errors.js";
import { readJsonBounded } from "./contracts/request.js";
import { listScheduleProjects, loadScheduleSource, saveScheduleProjectEndDate, scheduleSettings } from "./scheduleIngestion.js";
import { buildDataQueryWorkflowLog, runDataQueryAgent } from "./subagents/dataQuery.js";
import { runDelayClaimAnalysis, runDelayClaimPackageAnalysis, runDelayEventDeepAnalysis } from "./subagents/delayClaim.js";
import { aggregateInsightQualityMetrics, runProjectInsightsAnalysis } from "./subagents/projectInsights.js";
import { consolidateGraphEntities, runGraphEnrichment } from "./subagents/graphEnrichment.js";
import { runEmbeddingBackfill, runIncrementalIndexing, runIndexDatesBackfill } from "./subagents/indexing.js";
import { callInternalContentTool, CONTENT_TOOL_SPECS, isInternalContentTool } from "./subagents/contentTools.js";
import { completeRun, createRun, emitRunEvent, failRun, getRunEvents, listLocalRunHistory, recordRunHistory, subscribeRun } from "./runLog.js";
import { deleteKnowledgeDocument, listKnowledgeAgents, listKnowledgeDocuments, readKnowledgeDocument, saveKnowledgeDocument, searchKnowledgeBase } from "./knowledge.js";
import { buildGraphRowsFromRecords, buildGraphSearchPayload, summarizeGraphContext } from "./projectGraph.js";
import { authenticateAgainstBidoc, buildLogoutSetCookieHeader, buildSessionSetCookieHeader, getSuperadminSession } from "./auth.js";
import { injectBuildVersion } from "./buildInfo.js";
import { QaHarnessService } from "./qa/qaHarnessService.js";
import { handleQaHttpRequest } from "./qa/httpApi.js";
import { createHttpQaContext } from "./mcp/context.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const config = () => getConfig();
const qaHarnessService = new QaHarnessService();

function logContractsRouteFailure(scope, error) {
  const cause = error?.cause;
  console.error(`[contracts:${scope}] request failed`, {
    code: String(error?.code || "contracts_internal_error").slice(0, 160),
    status: Number(error?.status) || 500,
    message: String(error?.message || "Contract request failed.").replace(/[\r\n]+/gu, " ").slice(0, 1000),
    ...(cause ? {
      causeCode: String(cause?.code || cause?.name || "unknown").slice(0, 160),
      causeMessage: String(cause?.message || "").replace(/[\r\n]+/gu, " ").slice(0, 1000)
    } : {})
  });
}

async function reconcileIndicatorAfterContractMutation({ workspaceId }) {
  const {
    bestEffortReconcileContractConditions
  } = await import("./indicator/contractConditions.js");
  return bestEffortReconcileContractConditions({
    workspaceId,
    config: config()
  });
}

// ─── Multi-tenant helpers ─────────────────────────────────────────────────────

/**
 * Validates the X-Bidoc-Api-Secret header when BIDOC_API_SECRET is set.
 * If no secret is configured, all requests are allowed (backward compat).
 */
function checkBidocSecret(req) {
  const secret = process.env.BIDOC_API_SECRET;
  if (!secret) return true;
  return req.headers["x-bidoc-api-secret"] === secret;
}

/**
 * For read-only GET endpoints: only enforce the secret when the request
 * carries cross-tenant headers (i.e. it's coming from an external proxy).
 * Same-origin UI requests (no x-content-supabase-url) are allowed through
 * so the app's own interface can still load history/hashtags.
 */
function checkBidocSecretForRead(req) {
  const isCrossTenant = Boolean(req.headers["x-content-supabase-url"]);
  if (!isCrossTenant) return true;
  return checkBidocSecret(req);
}

/**
 * Builds a config with contentSource overridden by per-request credentials.
 * Credentials are read from request headers first, then from body fields.
 * Falls back to the global config values when not provided.
 */
function buildRequestConfig(req, body = {}) {
  const base = getConfig();
  const url  = req.headers["x-content-supabase-url"]  || body.contentSupabaseUrl  || null;
  const key  = req.headers["x-content-supabase-key"]  || body.contentSupabaseKey  || null;
  const rpc  = req.headers["x-hybrid-rpc-name"]       || body.hybridRpcName        || null;
  const idx  = req.headers["x-index-table"]            || body.indexTable           || null;
  const alt  = req.headers["x-alerts-table"]           || body.alertsTable          || null;
  const pid  = req.headers["x-project-id"]             || body.projectId || body.project_id || null;
  const merged = (!url && !key) ? base : {
    ...base,
    contentSource: {
      ...base.contentSource,
      ...(url ? { supabaseUrl: url }                     : {}),
      ...(key ? { supabaseServiceRoleKey: key }          : {}),
      ...(rpc ? { hybridRpcName: rpc }                   : {}),
      ...(idx ? { indexTable: idx }                      : {}),
      ...(alt ? { alertsTable: alt }                     : {}),
    },
  };
  return pid ? { ...merged, projectId: pid } : merged;
}

// Load persisted settings from Supabase before handling any requests.
const ready = initSettings().catch(() => {});

async function handler(req, res) {
  await ready;
  await refreshSettingsIfStale();
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

export default handler;

let httpServer = null;

if (!process.env.VERCEL) {
  httpServer = http.createServer(handler);
  httpServer.listen(config().port, () => {
    const cfg = config();
    console.log(`bidoc agent running at http://localhost:${cfg.port}`);
    console.log(`[startup] OpenRouter : ${cfg.openRouterApiKey ? "✓ configured" : "✗ MISSING — RAG agent will use fallback"}`);
    console.log(`[startup] App DB     : ${cfg.supabaseUrl ? "✓ configured" : "✗ MISSING"}`);
    console.log(`[startup] APP DATA   : ${cfg.contentSource?.supabaseUrl && cfg.contentSource?.supabaseServiceRoleKey ? "✓ configured" : "✗ MISSING"}`);
    console.log(`[startup] Timezone   : ${cfg.timezone}`);
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname.startsWith("/api/runs/") && url.pathname.endsWith("/events")) {
    const runId = decodeURIComponent(url.pathname.split("/")[3] || "");
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    res.write(`retry: 1000\n\n`);
    const unsubscribe = subscribeRun(runId, res);
    req.on("close", unsubscribe);
    return;
  }

  // ─── Login wall (same-origin UI only; cross-tenant bidoc calls are unaffected) ──
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJson(req);
    try {
      const user = await authenticateAgainstBidoc(String(body.email || "").trim(), String(body.password || ""));
      res.setHeader("Set-Cookie", buildSessionSetCookieHeader(user));
      return sendJson(res, 200, { success: true, email: user.email });
    } catch (error) {
      return sendJson(res, 401, { error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    res.setHeader("Set-Cookie", buildLogoutSetCookieHeader());
    return sendJson(res, 200, { success: true });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    const session = getSuperadminSession(req);
    return sendJson(res, 200, { authenticated: Boolean(session), email: session?.email || null });
  }

  // Every route is gated here up front (rather than per-route) so routes that
  // never had their own checkBidocSecretForRead guard (e.g. /api/messages/:id/annotate)
  // are covered too. Cross-tenant calls (bidoc's BFF) must carry a valid shared
  // secret — merely sending the content-supabase-url header is not enough to
  // bypass the login wall. Same-origin calls (the standalone UI) need a session.
  if (!url.pathname.startsWith("/api/auth/")) {
    const isContractsExtractionRoute = req.method === "POST"
      && ["/api/contracts/extract"].includes(url.pathname);
    const hasContractsIngestionSecret = Object.prototype.hasOwnProperty.call(
      req.headers,
      "x-contracts-ingestion-secret"
    );
    const isContractsActivityMappingRoute = url.pathname.startsWith("/api/contracts/activity-mapping/");
    const isContractsWorkspaceRoute = url.pathname.startsWith("/api/contracts/workspaces");
    const isContractsClausePreviewRoute = url.pathname === "/api/contracts/clauses/preview";
    const isContractsClausePersistenceRoute = url.pathname.startsWith("/api/contracts/clauses/workspaces")
      || url.pathname === "/api/contracts/clauses/status";
    const isContractsRelationshipsRoute = url.pathname.startsWith("/api/contracts/relationships/");
    const isContractsDecisionsRoute = url.pathname.startsWith("/api/contracts/decisions/");
    const isIndicatorContractsRoute = url.pathname.startsWith("/api/indicator/contracts/");
    const isContractsServerOwnedRoute = isContractsActivityMappingRoute
      || isContractsWorkspaceRoute
      || isContractsClausePreviewRoute
      || isContractsClausePersistenceRoute
      || isContractsRelationshipsRoute
      || isContractsDecisionsRoute
      || isIndicatorContractsRoute;
    const hasContractsDatabaseHeaderOverride = isContractsServerOwnedRoute && [
      "x-content-supabase-url",
      "x-content-supabase-key",
      "x-hybrid-rpc-name",
      "x-index-table",
      "x-alerts-table"
    ].some((header) => Object.prototype.hasOwnProperty.call(req.headers, header));
    if (isContractsExtractionRoute && hasContractsIngestionSecret) {
      const auth = authorizeContractsExtractionRequest(req);
      if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    } else if (isContractsServerOwnedRoute) {
      if (!getSuperadminSession(req)) {
        return sendJson(res, 401, { error: "התחברות כסופראדמין נדרשת" });
      }
      if (hasContractsDatabaseHeaderOverride) {
        return sendJson(res, 400, {
          error: isContractsActivityMappingRoute
            ? "contracts_activity_mapping_database_override_rejected"
            : isContractsClausePreviewRoute
              ? "contracts_clause_preview_database_override_rejected"
              : isContractsClausePersistenceRoute
                ? "contracts_clause_persistence_database_override_rejected"
                : isContractsRelationshipsRoute
                  ? "contracts_relationships_database_override_rejected"
                  : isContractsDecisionsRoute
                    ? "contracts_decisions_database_override_rejected"
              : "contracts_workspace_database_override_rejected",
          message: "Contracts APIs use server-owned MAIN and KAPAIM connections; client database overrides are not accepted."
        });
      }
    } else {
      const isCrossTenantApiRequest = Boolean(req.headers["x-content-supabase-url"]);
      if (isCrossTenantApiRequest) {
        if (!checkBidocSecret(req)) return sendJson(res, 401, { error: "Unauthorized" });
      } else if (!getSuperadminSession(req)) {
        return sendJson(res, 401, { error: "התחברות כסופראדמין נדרשת" });
      }
    }
  }

  if (url.pathname.startsWith("/api/qa/")) {
    const qaResponse = await handleQaHttpRequest({
      req,
      url,
      service: qaHarnessService,
      context: createHttpQaContext(req, { session: getSuperadminSession(req) }),
      readJson
    });
    return sendJson(res, qaResponse.status, qaResponse.body);
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req);
    if (!body.message) return sendJson(res, 400, { error: "message is required" });
    const sessionId = body.sessionId || `session_${Date.now()}`;
    const runId = body.runId || `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const cfg = buildRequestConfig(req, body);
    createRun(runId);

    // Opt-in inline-stream mode (body.stream === true, used by the standalone
    // UI): subscribes *this same response* to the run's live log before the
    // pipeline starts, so progress events — emitted from within this very
    // request/response cycle — always reach this client no matter how the
    // platform schedules a separate GET /api/runs/:id/events call onto a
    // different serverless instance later. On Vercel, that second GET and
    // this POST can land on two isolated instances that don't share the
    // in-memory run log (see runLog.js), which is why the standalone app's
    // progress panel could get stuck on the first placeholder step while the
    // real answer kept computing fine server-side. Folding the log into the
    // same request/response removes the cross-instance dependency entirely —
    // no persistence needed. Non-opting-in callers (e.g. bidoc's BFF) are
    // completely unaffected and keep getting the plain JSON response below.
    if (body.stream === true) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      res.write(`retry: 1000\n\n`);
      const unsubscribe = subscribeRun(runId, res);
      try {
        const output = await runChatPipeline({
          message: body.message,
          sessionId,
          config: cfg,
          runId,
          sourcesEnabled: body.sourcesEnabled !== false,
          deepResearch: body.deepResearch === true,
          attachments: normalizeChatAttachments(body.attachments)
        });
        unsubscribe();
        res.write(`event: result\n`);
        res.write(`data: ${JSON.stringify({ ...output, runId })}\n\n`);
      } catch (error) {
        failRun(runId, error);
        unsubscribe();
        res.write(`event: result-error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      } finally {
        res.end();
      }
      return;
    }

    try {
      const output = await runChatPipeline({
        message: body.message,
        sessionId,
        config: cfg,
        runId,
        sourcesEnabled: body.sourcesEnabled !== false,
        deepResearch: body.deepResearch === true,
        attachments: normalizeChatAttachments(body.attachments)
      });
      return sendJson(res, 200, { ...output, runId });
    } catch (error) {
      failRun(runId, error);
      throw error;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/sessions") {
    const sessions = await listSessions({ config: config() }).catch(() => []);
    return sendJson(res, 200, { sessions });
  }

  if (req.method === "GET" && url.pathname === "/api/run-history") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
    const [dbRuns, scheduleAssignmentRuns] = await Promise.all([
      listRunHistory({ config: config(), limit }).catch(() => []),
      listScheduleActivityAssignmentWorkflowRuns({ config: config(), limit }).catch(() => [])
    ]);
    const localRuns = listLocalRunHistory({ limit });
    const seen = new Set();
    const runs = [...localRuns, ...scheduleAssignmentRuns, ...dbRuns]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter((run) => run?.id && !seen.has(run.id) && seen.add(run.id))
      .slice(0, limit);
    return sendJson(res, 200, { runs });
  }

  if (req.method === "POST" && url.pathname === "/api/evaluations/run") {
    const body = await readJson(req);
    const cases = Array.isArray(body.cases) ? body.cases.slice(0, 25) : [];
    if (!cases.length) return sendJson(res, 400, { error: "cases array is required" });
    const results = [];
    for (const [index, testCase] of cases.entries()) {
      const message = String(testCase.message || "").trim();
      if (!message) {
        results.push({ index, ok: false, error: "message is required" });
        continue;
      }
      const runId = `eval_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`;
      createRun(runId);
      try {
        const output = await runChatPipeline({
          message,
          sessionId: body.sessionId || `eval_${Date.now()}`,
          config: config(),
          runId
        });
        results.push(summarizeEvaluationCase({ index, testCase, output, runId }));
      } catch (error) {
        failRun(runId, error);
        results.push({ index, message, runId, ok: false, error: error.message });
      }
    }
    return sendJson(res, 200, {
      total: results.length,
      passed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results
    });
  }

  if (req.method === "POST" && url.pathname === "/api/diagnostics/connections") {
    const body = await readJson(req).catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    // Diagnostics must report the persisted MAIN settings, not a process-local
    // Content DB snapshot that may predate the last Settings save.
    await reloadSettingsFromDb();
    const results = await runConnectionDiagnostics(config(), { ids });
    return sendJson(res, 200, {
      ok: results.every((item) => item.ok),
      results
    });
  }

  if (req.method === "GET" && url.pathname === "/api/graph") {
    const graph = await listProjectGraph({
      config: config(),
      limit: Number(url.searchParams.get("limit") || 300),
      nodeType: url.searchParams.get("nodeType") || "",
      edgeType: url.searchParams.get("edgeType") || "",
      query: url.searchParams.get("q") || ""
    });
    return sendJson(res, 200, graph);
  }

  if (req.method === "GET" && url.pathname === "/api/insights/runs") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
    const cfg = buildRequestConfig(req, {});
    const runs = await listProjectInsightRuns({ config: cfg, limit });
    return sendJson(res, 200, { runs });
  }

  if (req.method === "GET" && url.pathname === "/api/insights/quality-metrics") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    try {
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
      const dateFrom = url.searchParams.get("date_from") || null;
      const dateTo = url.searchParams.get("date_to") || null;
      const cfg = buildRequestConfig(req, {});
      const runs = await listProjectInsightRuns({ config: cfg, limit });
      const scoped = (runs || []).filter((run) => {
        const created = String(run?.created_at || "").slice(0, 10);
        if (dateFrom && created && created < dateFrom) return false;
        if (dateTo && created && created > dateTo) return false;
        return true;
      });
      return sendJson(res, 200, { ...aggregateInsightQualityMetrics(scoped), date_from: dateFrom, date_to: dateTo });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/insights/hashtags") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    try {
      const dateFrom = url.searchParams.get("date_from") || null;
      const dateTo = url.searchParams.get("date_to") || null;
      const source = url.searchParams.get("source") || "alerts";
      const cfg = buildRequestConfig(req, {});
      const fetcher = source === "index"
        ? fetchTimelineEvents({ config: cfg }).catch(() => [])
        : fetchAlertsTimelineEvents({ config: cfg }).catch(() => []);
      const allEvents = await fetcher;
      const events = allEvents.filter((ev) => {
        if (!ev.date) return true;
        if (dateFrom && ev.date < dateFrom) return false;
        if (dateTo && ev.date > dateTo) return false;
        return true;
      });
      const counts = {};
      for (const ev of events) {
        for (const tag of (ev.tags || [])) {
          const t = String(tag || "").trim().replace(/^#+/, "");
          if (t) counts[t] = (counts[t] || 0) + 1;
        }
      }
      const hashtags = Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
      return sendJson(res, 200, { hashtags, total: events.length });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/insights/analyze") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    const cfg = buildRequestConfig(req, body);
    // Per-request calibration flags: body.insights toggles the phase-2 engines for
    // this run only, on top of the persisted config.insights defaults.
    const requestInsights = body.insights && typeof body.insights === "object" ? body.insights : null;
    const effectiveCfg = requestInsights
      ? { ...cfg, insights: { ...(cfg.insights || {}), ...requestInsights } }
      : cfg;
    const runId = body.runId || `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    const excludedSourceKeys = Array.isArray(body.excludeSourceKeys) ? body.excludeSourceKeys : [];
    const parentRunId = body.parentRunId || body.parent_run_id || null;
    // Persist a "running" row immediately so clients that leave/return can show
    // the run in history as in-progress while analysis continues.
    await saveProjectInsightRun({
      config: cfg,
      run: {
        runId,
        parentRunId,
        projectId: body.projectId || body.project_id || null,
        focusQuery: body.focusQuery || body.query || "",
        dateFrom: body.dateFrom || body.date_from || null,
        dateTo: body.dateTo || body.date_to || null,
        limit: body.limit || 350,
        expansion: Boolean(body.expansion),
        excludedSourceKeys,
        scannedSourceKeys: [],
        summary: {
          focusQuery: body.focusQuery || body.query || "",
          dateFrom: body.dateFrom || body.date_from || null,
          dateTo: body.dateTo || body.date_to || null
        },
        insights: [],
        toolContext: {},
        workflowLog: null,
        runEvents: [],
        status: "running",
        metadata: { hasMore: false, findings: [] }
      }
    }).catch((error) => {
      emitRunEvent(runId, "persistence_warning", "Insight run start persistence failed", { error: error.message, status: "warning" });
    });
    try {
      const result = await runProjectInsightsAnalysis({
        config: effectiveCfg,
        focusQuery: body.focusQuery || body.query || "",
        dateFrom: body.dateFrom || body.date_from || null,
        dateTo: body.dateTo || body.date_to || null,
        limit: body.limit || 350,
        excludeSourceKeys: excludedSourceKeys,
        selectedHashtags: body.selectedHashtags || body.selected_hashtags || [],
        hashtagMode: body.hashtagMode || body.hashtag_mode || "boost",
        expansion: Boolean(body.expansion),
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, {
        insights: result.insights.length,
        findings: Array.isArray(result.findings) ? result.findings.length : 0,
        records: result.summary.totalRecords
      });
      const runEvents = getRunEvents(runId);
      recordRunHistory({
        id: runId,
        title: `תובנות פרויקט · ${result.summary.focusQuery || "סריקת אינדקס"}`,
        workflowLog: result.workflowLog,
        runEvents,
        kind: "project_insights_analysis"
      });
      const parentRun = parentRunId ? await getProjectInsightRun({ config: cfg, runId: parentRunId }).catch(() => null) : null;
      const persistedResult = parentRun ? mergePersistedProjectInsightRun(parentRun, result) : result;
      await saveProjectInsightRun({
        config: cfg,
        run: {
          runId,
          parentRunId,
          projectId: body.projectId || body.project_id || null,
          focusQuery: persistedResult.summary.focusQuery || body.focusQuery || body.query || "",
          dateFrom: persistedResult.summary.dateFrom || body.dateFrom || body.date_from || null,
          dateTo: persistedResult.summary.dateTo || body.dateTo || body.date_to || null,
          limit: body.limit || 350,
          expansion: Boolean(body.expansion),
          excludedSourceKeys,
          scannedSourceKeys: persistedResult.scannedSourceKeys || [],
          summary: persistedResult.summary || {},
          insights: persistedResult.insights || [],
          toolContext: persistedResult.toolContext || {},
          workflowLog: persistedResult.workflowLog || null,
          runEvents,
          status: "done",
          metadata: {
            hasMore: Boolean(persistedResult.hasMore),
            findings: Array.isArray(persistedResult.findings) ? persistedResult.findings : [],
            recordsSample: Array.isArray(persistedResult.recordsSample) ? persistedResult.recordsSample.slice(0, 24) : [],
            expansionRuns: Array.isArray(result.expansionRuns) ? result.expansionRuns.map((item) => item.runId).filter(Boolean) : [],
            // Phase-2 engine outputs so history restore can re-render their panels.
            healthScore: result.healthScore || null,
            trends: result.analytics?.trends || null,
            rootCauseHypotheses: Array.isArray(result.rootCauseHypotheses) ? result.rootCauseHypotheses : []
          }
        }
      }).catch((error) => {
        emitRunEvent(runId, "persistence_warning", "Insight run persistence failed", { error: error.message, status: "warning" });
      });
      return sendJson(res, 200, { ...result, runId });
    } catch (error) {
      failRun(runId, error);
      await saveProjectInsightRun({
        config: cfg,
        run: {
          runId,
          parentRunId: body.parentRunId || body.parent_run_id || null,
          projectId: body.projectId || body.project_id || null,
          focusQuery: body.focusQuery || body.query || "",
          dateFrom: body.dateFrom || body.date_from || null,
          dateTo: body.dateTo || body.date_to || null,
          limit: body.limit || 350,
          expansion: Boolean(body.expansion),
          excludedSourceKeys,
          scannedSourceKeys: [],
          summary: {},
          insights: [],
          toolContext: {},
          workflowLog: null,
          runEvents: getRunEvents(runId),
          status: "error",
          error: error.message
        }
      }).catch(() => {});
      return sendJson(res, 500, { ok: false, error: error.message, runId });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/delay-claims") {
    const claims = await listDelayClaims({
      config: config(),
      limit: Number(url.searchParams.get("limit") || 50)
    });
    return sendJson(res, 200, { claims });
  }

  if (req.method === "POST" && url.pathname === "/api/delay-claims") {
    const body = await readJson(req);
    const claim = await createDelayClaim({ config: config(), claim: body });
    return sendJson(res, 200, { claim });
  }

  const delayClaimEventsMatch = url.pathname.match(/^\/api\/delay-claims\/([^/]+)\/events$/);
  if (delayClaimEventsMatch) {
    const caseId = decodeURIComponent(delayClaimEventsMatch[1]);
    if (req.method === "GET") {
      const events = await listDelayEvents({
        config: config(),
        caseId,
        limit: Number(url.searchParams.get("limit") || 200)
      });
      return sendJson(res, 200, { events });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      const event = await createDelayEvent({ config: config(), caseId, event: body });
      return sendJson(res, 200, { event });
    }
  }

  const delayClaimAnalyzeMatch = url.pathname.match(/^\/api\/delay-claims\/([^/]+)\/analyze$/);
  if (req.method === "POST" && delayClaimAnalyzeMatch) {
    const caseId = decodeURIComponent(delayClaimAnalyzeMatch[1]);
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `delay_claim_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const result = await runDelayClaimAnalysis({
        config: config(),
        caseId,
        projectId: body.projectId || body.project_id || null,
        dateFrom: body.dateFrom || body.date_from || null,
        dateTo: body.dateTo || body.date_to || null,
        focusQuery: body.focusQuery || body.query || "",
        sources: body.sources || [],
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, result.saved);
      recordRunHistory({
        id: runId,
        title: `תיק עיכוב · ${caseId}`,
        workflowLog: result.workflowLog,
        runEvents: getRunEvents(runId),
        kind: "delay_claim_analysis"
      });
      return sendJson(res, 200, { ...result, runId });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, error: error.message, runId });
    }
  }

  const delayClaimPackageMatch = url.pathname.match(/^\/api\/delay-claims\/([^/]+)\/package$/);
  if (req.method === "POST" && delayClaimPackageMatch) {
    const caseId = decodeURIComponent(delayClaimPackageMatch[1]);
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `delay_package_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const result = await runDelayClaimPackageAnalysis({
        config: config(),
        caseId,
        contractualCompletionDate: body.contractualCompletionDate || body.contractual_completion_date || null,
        actualCompletionDate: body.actualCompletionDate || body.actual_completion_date || null,
        exportType: body.exportType || body.export_type || "markdown",
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, result.saved);
      recordRunHistory({
        id: runId,
        title: `חבילת תיק עיכוב · ${caseId}`,
        workflowLog: result.workflowLog,
        runEvents: getRunEvents(runId),
        kind: "delay_claim_package"
      });
      return sendJson(res, 200, { ...result, runId });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, error: error.message, runId });
    }
  }

  const delayEventMatch = url.pathname.match(/^\/api\/delay-events\/([^/]+)$/);
  if (req.method === "PATCH" && delayEventMatch) {
    const eventId = decodeURIComponent(delayEventMatch[1]);
    const body = await readJson(req);
    const event = await updateDelayEvent({
      config: config(),
      eventId,
      patch: body,
      changedBy: body.changed_by || "ui"
    });
    return sendJson(res, 200, { event });
  }

  const delayEventAnalyzeMatch = url.pathname.match(/^\/api\/delay-events\/([^/]+)\/analyze$/);
  if (req.method === "POST" && delayEventAnalyzeMatch) {
    const eventId = decodeURIComponent(delayEventAnalyzeMatch[1]);
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `delay_event_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const result = await runDelayEventDeepAnalysis({
        config: config(),
        eventId,
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, result.saved);
      recordRunHistory({
        id: runId,
        title: `ניתוח אירוע עיכוב · ${eventId}`,
        workflowLog: result.workflowLog,
        runEvents: getRunEvents(runId),
        kind: "delay_event_analysis"
      });
      return sendJson(res, 200, { ...result, runId });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, error: error.message, runId });
    }
  }

  const delayEventEvidenceMatch = url.pathname.match(/^\/api\/delay-events\/([^/]+)\/evidence$/);
  if (req.method === "POST" && delayEventEvidenceMatch) {
    const eventId = decodeURIComponent(delayEventEvidenceMatch[1]);
    const body = await readJson(req);
    const evidence = await addDelayEventEvidence({ config: config(), eventId, evidence: body });
    return sendJson(res, 200, { evidence });
  }

  const delayEventGapsMatch = url.pathname.match(/^\/api\/delay-events\/([^/]+)\/gaps$/);
  if (req.method === "POST" && delayEventGapsMatch) {
    const eventId = decodeURIComponent(delayEventGapsMatch[1]);
    const body = await readJson(req);
    const gap = await addDelayEventGap({ config: config(), eventId, gap: body });
    return sendJson(res, 200, { gap });
  }

  const delayEventChangeLogMatch = url.pathname.match(/^\/api\/delay-events\/([^/]+)\/change-log$/);
  if (req.method === "POST" && delayEventChangeLogMatch) {
    const eventId = decodeURIComponent(delayEventChangeLogMatch[1]);
    const body = await readJson(req);
    const change = await addDelayEventChangeLog({ config: config(), eventId, change: body });
    return sendJson(res, 200, { change });
  }

  const messagesMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (req.method === "GET" && messagesMatch) {
    const messages = await listMessages({ config: config(), sessionId: decodeURIComponent(messagesMatch[1]) }).catch(() => []);
    return sendJson(res, 200, { messages });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    await reloadSettingsFromDb();
    return sendJson(res, 200, publicSettings(config()));
  }

  if (req.method === "POST" && url.pathname === "/api/settings/reload") {
    await reloadSettingsFromDb();
    return sendJson(res, 200, { settings: publicSettings(config()) });
  }

  if (req.method === "GET" && url.pathname === "/api/settings/export") {
    return sendJson(res, 200, exportFullSettings(config()));
  }

  if (req.method === "POST" && url.pathname === "/api/settings/import") {
    const body = await readJson(req);
    return sendJson(res, 200, previewImportedSettingsFile(body));
  }

  if (req.method === "GET" && url.pathname === "/api/settings/schedule-assignment-agent") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    await reloadSettingsFromDb();
    const settings = config().scheduleAssignmentAgent;
    const snapshot = scheduleAssignmentConfigurationSnapshot(settings);
    return sendJson(res, 200, {
      ok: true,
      settings,
      persisted: Boolean(readLocalSettings()?.scheduleAssignmentAgent),
      snapshotId: snapshot.snapshotId
    });
  }

  if (req.method === "POST" && url.pathname === "/api/settings/schedule-assignment-agent/validate") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    const result = validateScheduleAssignmentAgentSettings(body.settings || {});
    return sendJson(res, result.ok ? 200 : 400, {
      ok: result.ok,
      errors: result.errors,
      warnings: result.warnings,
      weightTotal: result.weightTotal
    });
  }

  if (req.method === "POST" && url.pathname === "/api/settings/schedule-assignment-agent/dry-run") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    if (!body.projectId || !body.sourceId) return sendJson(res, 400, { error: "projectId and sourceId are required" });
    try {
      await reloadSettingsFromDb();
      const requestConfig = getConfig();
      const result = await runScheduleActivityAssignmentAgent({
        projectId: body.projectId,
        sourceId: body.sourceId,
        requestedBy: reviewer.sub,
        commit: false,
        config: requestConfig,
        apiKey: settingsOpenRouterApiKey()
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, /required|not found|אינה תקינה|ללא תאריך|לא נמצאו|כבוי/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/system/restart") {
    sendJson(res, 200, { ok: true, message: "Restarting server" });
    scheduleServerRestart();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/agents") {
    return sendJson(res, 200, { agents: buildAgentList(config()) });
  }

  if (req.method === "GET" && url.pathname === "/api/knowledge/agents") {
    return sendJson(res, 200, { agents: listKnowledgeAgents() });
  }

  if (req.method === "GET" && url.pathname === "/api/knowledge/documents") {
    const documents = await listKnowledgeDocuments({ agentId: url.searchParams.get("agentId") || undefined });
    return sendJson(res, 200, { documents });
  }

  if (req.method === "POST" && url.pathname === "/api/knowledge/documents") {
    const body = await readJson(req);
    const document = await saveKnowledgeDocument({ filename: body.filename, content: body.content, agentId: body.agentId });
    return sendJson(res, 200, { document });
  }

  const knowledgeDocumentMatch = url.pathname.match(/^\/api\/knowledge\/documents\/([^/]+)$/);
  if (knowledgeDocumentMatch) {
    const filename = decodeURIComponent(knowledgeDocumentMatch[1]);
    const agentId = url.searchParams.get("agentId") || undefined;
    const source = url.searchParams.get("source") || undefined;
    if (req.method === "GET") {
      const document = await readKnowledgeDocument(filename, { agentId, source });
      return sendJson(res, 200, { document });
    }
    if (req.method === "DELETE") {
      const deleted = await deleteKnowledgeDocument(filename, { agentId, source });
      return sendJson(res, 200, deleted);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/knowledge/search") {
    const body = await readJson(req);
    const payload = await searchKnowledgeBase({
      query: body.query || "",
      tags: parseHashtags(body.tags || body.hashtags || []),
      topK: Number(body.topK || 6),
      agentId: body.agentId
    });
    return sendJson(res, 200, payload);
  }

  if (req.method === "GET" && url.pathname === "/api/openrouter/models") {
    try {
      const models = await listOpenRouterModels({ apiKey: config().openRouterApiKey });
      return sendJson(res, 200, { models, fallback: false });
    } catch (error) {
      return sendJson(res, 200, { models: fallbackOpenRouterModels(), fallback: true, error: error.message });
    }
  }

  if (req.method === "PUT" && url.pathname === "/api/agents") {
    return sendJson(res, 405, { error: "Agents are read-only. Save chat models and prompts through /api/settings." });
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readJson(req);
    if (Object.prototype.hasOwnProperty.call(body || {}, "scheduleAssignmentAgent")) {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const validation = validateScheduleAssignmentAgentSettings(body.scheduleAssignmentAgent || {});
      if (!validation.ok) return sendJson(res, 400, { error: validation.errors.join(" "), validation });
    }
    await reloadSettingsFromDb();
    const saved = await writeLocalSettings(body, { source: "settings_save" });
    return sendJson(res, 200, { saved, settings: publicSettings(config()) });
  }

  const toolMatch = url.pathname.match(/^\/api\/tools\/([^/]+)\/test$/);
  if (req.method === "POST" && toolMatch) {
    const toolName = decodeURIComponent(toolMatch[1]);
    const body = await readJson(req);
    if (toolName === "hybrid_search" || toolName === "rag_vector_store") {
      try {
        const data = await hybridSearch({
          config: config(),
          query: body.query || "",
          dateFrom: body.date_from || null,
          dateTo: body.date_to || null,
          hashtags: parseHashtags(body.hashtags),
          topK: Number(body.topK || config().retrieval.candidates)
        });
        return sendJson(res, 200, { toolName: "hybrid_search", ok: true, data });
      } catch (error) {
        return sendJson(res, 200, { toolName: "hybrid_search", ok: false, error: error.message, data: null });
      }
    }
    if (!TOOL_NAMES.includes(toolName)) return sendJson(res, 404, { error: "Unknown tool" });
    // body.internal === true forces the internal path for calibration even
    // while the toolsRuntime.internalTools flag is still off.
    if (CONTENT_TOOL_SPECS[toolName] && (body.internal === true || isInternalContentTool(toolName, config()))) {
      const result = await callInternalContentTool({
        config: config(),
        toolName,
        query: body.query || "",
        dateFrom: body.date_from || null,
        dateTo: body.date_to || null,
        // Draft settings from the Subagents card — test before saving.
        overrides: body.overrides && typeof body.overrides === "object" ? body.overrides : null
      });
      return sendJson(res, 200, result);
    }
    const result = await callN8nTool({
      toolName,
      query: body.query || "",
      dateFilter: body.date_filter || "",
      dateFrom: body.date_from || null,
      dateTo: body.date_to || null,
      sessionId: body.sessionId || "tool_test",
      config: config()
    });
    return sendJson(res, 200, result);
  }

  // Contracts Agent Phase 1: authenticated, bounded, dry-run extraction only.
  // This route intentionally has no project-data override, persistence option,
  // Schedule service call, or database writer.
  if (req.method === "POST" && url.pathname === "/api/contracts/extract") {
    try {
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { runContractsExtractionRequest, safeContractTelemetry } = await import("./subagents/contracts.js");
      const { sendContractsJson } = await import("./contracts/response.js");
      const result = await runContractsExtractionRequest({
        body,
        config: config(),
        emit: (payload) => {
          const safe = safeContractTelemetry(payload.event, payload);
          if (safe) console.info("[contracts]", JSON.stringify(safe));
        }
      });
      return sendContractsJson(res, 200, result);
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Contracts Agent R3.1 acceptance preview: authenticated, bounded, and
  // deliberately ephemeral. It runs the complete clause parser/enricher but
  // performs no Supabase, Storage, Schedule, decision, or relationship write.
  if (req.method === "POST" && url.pathname === "/api/contracts/clauses/preview") {
    try {
      if (!getSuperadminSession(req)) {
        return sendJson(res, 401, { error: "נדרשת התחברות כסופראדמין" });
      }
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { runContractsClausePreview } = await import("./contracts/clausePreview.js");
      const { sendContractsJson } = await import("./contracts/response.js");
      const result = await runContractsClausePreview({ body, config: config() });
      return sendContractsJson(res, 200, result);
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // ─── Schedule Intelligence Service (spec 4.4) ──────────────────────────────
  // Contracts Agent R3.2 persistence: save the accepted R2/R3 generation
  // atomically and reopen it later without another parser or model run.
  if (req.method === "GET" && url.pathname === "/api/contracts/clauses/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsClausePersistenceStatus } = await import("./contracts/clausePersistence.js");
      return sendJson(res, 200, await loadContractsClausePersistenceStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/contracts/clauses/workspaces") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsClausePersistenceApproved,
        listSavedContractsClauseWorkspaces,
        parseContractsClauseWorkspaceListRequest
      } = await import("./contracts/clausePersistence.js");
      if (!contractsClausePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_clause_persistence_not_enabled",
          code: "contracts_clause_persistence_not_enabled"
        });
      }
      const request = parseContractsClauseWorkspaceListRequest(url.searchParams);
      const result = await listSavedContractsClauseWorkspaces({ config: config(), ...request });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsClauseWorkspaceMatch = url.pathname.match(/^\/api\/contracts\/clauses\/workspaces\/([0-9a-f-]+)$/iu);
  if (req.method === "GET" && contractsClauseWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsClausePersistenceApproved,
        getSavedContractsClauseWorkspace
      } = await import("./contracts/clausePersistence.js");
      if (!contractsClausePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_clause_persistence_not_enabled",
          code: "contracts_clause_persistence_not_enabled"
        });
      }
      const result = await getSavedContractsClauseWorkspace({
        config: config(),
        workspaceId: contractsClauseWorkspaceMatch[1]
      });
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/clauses/workspaces/extract") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsClausePersistenceApproved,
        runContractsClausePersistence
      } = await import("./contracts/clausePersistence.js");
      if (!contractsClausePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_clause_persistence_not_enabled",
          code: "contracts_clause_persistence_not_enabled"
        });
      }
      const result = await runContractsClausePersistence({
        body,
        config: config(),
        reviewerId: reviewer.sub,
        emit: (event) => console.info("[contracts-r3.2]", JSON.stringify(event))
      });
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r3.2-persist", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Contracts Relationships Agent R4.0 foundation. This slice persists only
  // deterministic clause-to-clause links for explicit references already
  // extracted by R3. It creates no decisions and never calls Schedule.
  if (req.method === "GET" && url.pathname === "/api/contracts/relationships/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsRelationshipsStatus } = await import("./contracts/relationshipPersistence.js");
      return sendJson(res, 200, await loadContractsRelationshipsStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.1 is a read/model-only semantic preview over one server-loaded saved
  // clause generation. The browser cannot supply clauses, model settings,
  // database routing, or review decisions, and this route performs no write.
  if (req.method === "GET" && url.pathname === "/api/contracts/relationships/semantic/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsSemanticRelationshipsStatus } = await import("./contracts/semanticRelationshipService.js");
      return sendJson(res, 200, loadContractsSemanticRelationshipsStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.2A persists only complete, skeptically verified R4.1 proposals and
  // exposes append-only authenticated review. It creates no normalized
  // contractual decisions and never calls Schedule.
  if (req.method === "GET" && url.pathname === "/api/contracts/relationships/review/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsRelationshipReviewStatus } = await import("./contracts/semanticRelationshipReview.js");
      return sendJson(res, 200, await loadContractsRelationshipReviewStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.2A.1 reuses the approved relationship-review gate and automatically
  // approves only server-planned high-confidence proposals. It never rejects,
  // corrects, creates decisions, or calls Schedule.
  if (req.method === "GET" && url.pathname === "/api/contracts/relationships/auto-review/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsRelationshipAutoReviewStatus } = await import("./contracts/semanticRelationshipAutoReview.js");
      return sendJson(res, 200, await loadContractsRelationshipAutoReviewStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsRelationshipsWorkspaceMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)$/iu
  );
  if (req.method === "GET" && contractsRelationshipsWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsRelationshipsApproved,
        loadContractsRelationships
      } = await import("./contracts/relationshipPersistence.js");
      if (!contractsRelationshipsApproved()) {
        return sendJson(res, 503, {
          error: "contracts_relationships_not_enabled",
          code: "contracts_relationships_not_enabled"
        });
      }
      return sendJson(res, 200, await loadContractsRelationships({
        config: config(),
        workspaceId: contractsRelationshipsWorkspaceMatch[1]
      }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsRelationshipsPersistMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/explicit$/iu
  );
  if (req.method === "POST" && contractsRelationshipsPersistMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsRelationshipsApproved,
        persistContractsExplicitRelationships
      } = await import("./contracts/relationshipPersistence.js");
      if (!contractsRelationshipsApproved()) {
        return sendJson(res, 503, {
          error: "contracts_relationships_not_enabled",
          code: "contracts_relationships_not_enabled"
        });
      }
      const result = await persistContractsExplicitRelationships({
        config: config(),
        workspaceId: contractsRelationshipsPersistMatch[1],
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.0]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        inserted: result.persistence.inserted,
        reused: result.persistence.reused,
        unresolved: result.metrics.unresolvedReferenceCount,
        scheduleWrites: 0
      }));
      return sendJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.0-explicit-relationships", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsSemanticRelationshipsPreviewMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/semantic-preview$/iu
  );
  if (req.method === "POST" && contractsSemanticRelationshipsPreviewMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsSemanticRelationshipsApproved,
        previewContractsSemanticRelationships
      } = await import("./contracts/semanticRelationshipService.js");
      if (!contractsSemanticRelationshipsApproved()) {
        return sendJson(res, 503, {
          error: "contracts_semantic_relationships_not_enabled",
          code: "contracts_semantic_relationships_not_enabled"
        });
      }
      const result = await previewContractsSemanticRelationships({
        config: config(),
        workspaceId: contractsSemanticRelationshipsPreviewMatch[1],
        body,
        deadlineAt: Date.now() + 180_000
      });
      console.info("[contracts-r4.1]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        candidates: result.metrics.candidatePairCount,
        proposed: result.metrics.modelRelationshipCount,
        classificationComplete: result.metrics.classificationComplete,
        classificationFailedPairs: result.metrics.classificationFailedPairCount,
        verificationComplete: result.metrics.verificationComplete,
        verificationFailedPairs: result.metrics.verificationFailedPairCount,
        decisions: 0,
        persistenceWrites: 0,
        scheduleWrites: 0
      }));
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.1-semantic-relationships-preview", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsSemanticRelationshipsPersistMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/semantic-proposals$/iu
  );
  if (req.method === "POST" && contractsSemanticRelationshipsPersistMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsSemanticRelationshipsApproved,
        previewContractsSemanticRelationships
      } = await import("./contracts/semanticRelationshipService.js");
      const {
        contractsRelationshipReviewApproved,
        persistContractsSemanticRelationshipProposals
      } = await import("./contracts/semanticRelationshipReview.js");
      if (!contractsSemanticRelationshipsApproved() || !contractsRelationshipReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_relationship_review_not_enabled",
          code: "contracts_relationship_review_not_enabled"
        });
      }
      const analysis = await previewContractsSemanticRelationships({
        config: config(),
        workspaceId: contractsSemanticRelationshipsPersistMatch[1],
        body,
        deadlineAt: Date.now() + 180_000
      });
      const review = await persistContractsSemanticRelationshipProposals({
        config: config(),
        workspaceId: contractsSemanticRelationshipsPersistMatch[1],
        semanticResult: analysis,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2a]", JSON.stringify({
        workspaceId: analysis.workspace.workspaceId,
        verifiedProposals: analysis.metrics.modelRelationshipCount,
        inserted: review.persistence.inserted,
        reused: review.persistence.reused,
        pendingReview: review.metrics.proposedCount,
        decisions: 0,
        scheduleWrites: 0
      }));
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, { analysis, review });
    } catch (error) {
      logContractsRouteFailure("r4.2a-semantic-proposals", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsSemanticRelationshipReviewWorkspaceMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/semantic-review$/iu
  );
  if (req.method === "GET" && contractsSemanticRelationshipReviewWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsRelationshipReviewApproved,
        loadContractsRelationshipReview
      } = await import("./contracts/semanticRelationshipReview.js");
      if (!contractsRelationshipReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_relationship_review_not_enabled",
          code: "contracts_relationship_review_not_enabled"
        });
      }
      return sendJson(res, 200, await loadContractsRelationshipReview({
        config: config(),
        workspaceId: contractsSemanticRelationshipReviewWorkspaceMatch[1],
        timeoutMs: 60_000
      }));
    } catch (error) {
      logContractsRouteFailure("r4.2a-relationship-review-load", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsSemanticRelationshipAutoReviewMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/semantic-auto-review$/iu
  );
  if (req.method === "POST" && contractsSemanticRelationshipAutoReviewMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { autoReviewContractsSemanticRelationships } = await import("./contracts/semanticRelationshipAutoReview.js");
      const result = await autoReviewContractsSemanticRelationships({
        config: config(),
        workspaceId: contractsSemanticRelationshipAutoReviewMatch[1],
        reviewerId: reviewer.sub,
        body,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2a1-auto-review]", JSON.stringify({
        workspaceId: result.review.workspace.workspaceId,
        eligible: result.plan.metrics.eligibleCount,
        autoApproved: result.autoReview.approvedCount,
        pendingHumanReview: result.review.metrics.proposedCount,
        decisions: 0,
        scheduleWrites: 0
      }));
      return sendJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.2a1-relationship-auto-review", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsSemanticRelationshipReviewItemMatch = url.pathname.match(
    /^\/api\/contracts\/relationships\/workspaces\/([0-9a-f-]+)\/semantic-review\/([0-9a-f-]+)$/iu
  );
  if (req.method === "POST" && contractsSemanticRelationshipReviewItemMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsRelationshipReviewApproved,
        reviewContractsSemanticRelationship
      } = await import("./contracts/semanticRelationshipReview.js");
      if (!contractsRelationshipReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_relationship_review_not_enabled",
          code: "contracts_relationship_review_not_enabled"
        });
      }
      const result = await reviewContractsSemanticRelationship({
        config: config(),
        workspaceId: contractsSemanticRelationshipReviewItemMatch[1],
        relationshipId: contractsSemanticRelationshipReviewItemMatch[2],
        reviewerId: reviewer.sub,
        body,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2a-review]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        action: result.review.action,
        reviewedRelationshipId: result.review.reviewedRelationshipId,
        correctedRelationshipId: result.review.correctedRelationshipId,
        pendingReview: result.metrics.proposedCount,
        decisions: 0,
        scheduleWrites: 0
      }));
      return sendJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.2a-relationship-review-apply", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.2B creates normalized contractual decision proposals only after every
  // saved R4.2A relationship has been reviewed. Proposals and human decisions
  // are append-only in KAPAIM; this slice never selects a conflict winner and
  // never calls or writes to Schedule.
  if (req.method === "GET" && url.pathname === "/api/contracts/decisions/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsDecisionReviewStatus } = await import("./contracts/decisionReview.js");
      return sendJson(res, 200, await loadContractsDecisionReviewStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.2B.1 uses a separate server-owned verifier and deterministic safety
  // checks to auto-approve only high-confidence proposals. All uncertain
  // decisions remain in human review; this path cannot reject, correct, hand
  // off to Indicator, or write Schedule data.
  if (req.method === "GET" && url.pathname === "/api/contracts/decisions/auto-review/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsDecisionAutoReviewStatus } = await import("./contracts/decisionAutoReview.js");
      return sendJson(res, 200, await loadContractsDecisionAutoReviewStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R4.2C adds authenticated split/merge actions over existing decision
  // proposals. Every action appends terminal/source and output revisions plus
  // explicit decision-to-decision lineage; it performs no model or Schedule call.
  if (req.method === "GET" && url.pathname === "/api/contracts/decisions/lineage/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsDecisionLineageStatus } = await import("./contracts/decisionLineage.js");
      return sendJson(res, 200, await loadContractsDecisionLineageStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // R6 exposes the clean Contracts product view as a read-only handoff
  // to the future Indicator agent. Contracts decides suitability only;
  // Indicator owns project placement, target selection, calendars, and every
  // Schedule write. This route performs no model or database mutation.
  if (req.method === "GET" && url.pathname === "/api/contracts/decisions/indicator-handoff/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsIndicatorHandoffStatus } = await import("./contracts/indicatorHandoff.js");
      return sendJson(res, 200, await loadContractsIndicatorHandoffStatus());
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsIndicatorHandoffWorkspaceMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/indicator-handoff$/iu
  );
  if (req.method === "GET" && contractsIndicatorHandoffWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsIndicatorHandoff } = await import("./contracts/indicatorHandoff.js");
      const result = await loadContractsIndicatorHandoff({
        config: config(),
        workspaceId: contractsIndicatorHandoffWorkspaceMatch[1],
        timeoutMs: 60_000
      });
      console.info("[contracts-r6-indicator-handoff]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        suitable: result.metrics.suitableCount,
        notSuitable: result.metrics.notSuitableCount,
        requiresReview: result.metrics.requiresReviewCount,
        scheduleWrites: 0
      }));
      return sendJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r5-indicator-handoff-load", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionLineageWorkspaceMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/lineage$/iu
  );
  if (req.method === "GET" && contractsDecisionLineageWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsDecisionLineageReview } = await import("./contracts/decisionLineage.js");
      return sendJson(res, 200, await loadContractsDecisionLineageReview({
        config: config(),
        workspaceId: contractsDecisionLineageWorkspaceMatch[1],
        timeoutMs: 60_000
      }));
    } catch (error) {
      logContractsRouteFailure("r4.2c-decision-lineage-load", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionSplitMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/lineage\/split\/([0-9a-f-]+)$/iu
  );
  if (req.method === "POST" && contractsDecisionSplitMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, 262_144);
      const { splitContractsDecision } = await import("./contracts/decisionLineage.js");
      const result = await splitContractsDecision({
        config: config(),
        workspaceId: contractsDecisionSplitMatch[1],
        decisionId: contractsDecisionSplitMatch[2],
        reviewerId: reviewer.sub,
        body,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2c-lineage]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        action: "split",
        sourceDecisionCount: result.lineageMutation.sourceDecisionIds.length,
        outputDecisionCount: result.lineageMutation.outputDecisionIds.length,
        lineageInserted: result.lineageMutation.lineageInserted,
        modelCalls: 0,
        scheduleWrites: 0
      }));
      const indicatorSync = await reconcileIndicatorAfterContractMutation({ workspaceId: contractsDecisionSplitMatch[1] });
      return sendJson(res, 200, { ...result, indicatorSync });
    } catch (error) {
      logContractsRouteFailure("r4.2c-decision-split", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionMergeMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/lineage\/merge$/iu
  );
  if (req.method === "POST" && contractsDecisionMergeMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, 262_144);
      const { mergeContractsDecisions } = await import("./contracts/decisionLineage.js");
      const result = await mergeContractsDecisions({
        config: config(),
        workspaceId: contractsDecisionMergeMatch[1],
        reviewerId: reviewer.sub,
        body,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2c-lineage]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        action: "merge",
        sourceDecisionCount: result.lineageMutation.sourceDecisionIds.length,
        outputDecisionCount: result.lineageMutation.outputDecisionIds.length,
        lineageInserted: result.lineageMutation.lineageInserted,
        modelCalls: 0,
        scheduleWrites: 0
      }));
      const indicatorSync = await reconcileIndicatorAfterContractMutation({ workspaceId: contractsDecisionMergeMatch[1] });
      return sendJson(res, 200, { ...result, indicatorSync });
    } catch (error) {
      logContractsRouteFailure("r4.2c-decision-merge", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionReviewWorkspaceMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)$/iu
  );
  if (req.method === "GET" && contractsDecisionReviewWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsDecisionReviewApproved,
        loadContractsDecisionReview
      } = await import("./contracts/decisionReview.js");
      if (!contractsDecisionReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_decision_review_not_enabled",
          code: "contracts_decision_review_not_enabled"
        });
      }
      return sendJson(res, 200, await loadContractsDecisionReview({
        config: config(),
        workspaceId: contractsDecisionReviewWorkspaceMatch[1],
        timeoutMs: 60_000
      }));
    } catch (error) {
      logContractsRouteFailure("r4.2b-decision-review-load", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionProposalMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/proposals$/iu
  );
  if (req.method === "POST" && contractsDecisionProposalMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsDecisionReviewApproved,
        generateAndPersistContractsDecisions
      } = await import("./contracts/decisionReview.js");
      if (!contractsDecisionReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_decision_review_not_enabled",
          code: "contracts_decision_review_not_enabled"
        });
      }
      const result = await generateAndPersistContractsDecisions({
        config: config(),
        workspaceId: contractsDecisionProposalMatch[1],
        body,
        deadlineAt: Date.now() + 300_000
      });
      console.info("[contracts-r4.2b]", JSON.stringify({
        workspaceId: result.review.workspace.workspaceId,
        modelAvoided: result.modelAvoided,
        decisions: result.review.metrics.currentDecisionCount,
        pendingRelationshipReview: result.review.metrics.pendingRelationshipCount,
        pendingDecisionReview: result.review.metrics.proposedCount,
        scheduleWrites: 0
      }));
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.2b-decision-proposals", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionAutoReviewMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/auto-review$/iu
  );
  if (req.method === "POST" && contractsDecisionAutoReviewMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { autoReviewContractsDecisions } = await import("./contracts/decisionAutoReview.js");
      const result = await autoReviewContractsDecisions({
        config: config(),
        workspaceId: contractsDecisionAutoReviewMatch[1],
        reviewerId: reviewer.sub,
        body,
        deadlineAt: Date.now() + 300_000
      });
      console.info("[contracts-r4.2b1-auto-review]", JSON.stringify({
        workspaceId: result.review.workspace.workspaceId,
        checked: result.plan.metrics.inputPendingCount,
        eligible: result.plan.metrics.eligibleCount,
        autoApproved: result.autoReview.approvedCount,
        pendingHumanReview: result.review.metrics.proposedCount,
        verifierCalls: result.plan.metrics.modelCallCount,
        failedVerifierBatches: result.plan.metrics.failedBatchCount,
        indicatorHandoffs: 0,
        scheduleWrites: 0
      }));
      const { sendContractsJson } = await import("./contracts/response.js");
      return sendContractsJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("r4.2b1-decision-auto-review", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractsDecisionReviewItemMatch = url.pathname.match(
    /^\/api\/contracts\/decisions\/workspaces\/([0-9a-f-]+)\/review\/([0-9a-f-]+)$/iu
  );
  if (req.method === "POST" && contractsDecisionReviewItemMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsDecisionReviewApproved,
        reviewContractsDecision
      } = await import("./contracts/decisionReview.js");
      if (!contractsDecisionReviewApproved()) {
        return sendJson(res, 503, {
          error: "contracts_decision_review_not_enabled",
          code: "contracts_decision_review_not_enabled"
        });
      }
      const result = await reviewContractsDecision({
        config: config(),
        workspaceId: contractsDecisionReviewItemMatch[1],
        decisionId: contractsDecisionReviewItemMatch[2],
        reviewerId: reviewer.sub,
        body,
        timeoutMs: 60_000
      });
      console.info("[contracts-r4.2b-review]", JSON.stringify({
        workspaceId: result.workspace.workspaceId,
        action: result.review.action,
        reviewedProposalDecisionId: result.review.reviewedProposalDecisionId,
        reviewedDecisionId: result.review.reviewedDecisionId,
        pendingDecisionReview: result.metrics.proposedCount,
        scheduleWrites: 0
      }));
      const indicatorSync = await reconcileIndicatorAfterContractMutation({ workspaceId: contractsDecisionReviewItemMatch[1] });
      return sendJson(res, 200, { ...result, indicatorSync });
    } catch (error) {
      logContractsRouteFailure("r4.2b-decision-review-apply", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const indicatorContractWorkspaceMatch = url.pathname.match(
    /^\/api\/indicator\/contracts\/workspaces\/([0-9a-f-]+)\/(status|reconcile)$/iu
  );
  if (indicatorContractWorkspaceMatch
      && ((req.method === "GET" && indicatorContractWorkspaceMatch[2] === "status")
        || (req.method === "POST" && indicatorContractWorkspaceMatch[2] === "reconcile"))) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = req.method === "POST" ? await readJson(req).catch(() => ({})) : {};
      const { reconcileContractConditions } = await import("./indicator/contractConditions.js");
      const result = await reconcileContractConditions({
        workspaceId: indicatorContractWorkspaceMatch[1],
        commit: req.method === "POST" ? body.commit !== false : false,
        config: config()
      });
      return sendJson(res, 200, result);
    } catch (error) {
      logContractsRouteFailure("indicator-contract-conditions", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractSourceLinkMatch = url.pathname.match(
    /^\/api\/contracts\/workspaces\/([0-9a-f-]+)\/source-link$/iu
  );
  if (req.method === "GET" && contractSourceLinkMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const decisionId = url.searchParams.get("decisionId") || "";
      const page = Number(url.searchParams.get("page"));
      if (!decisionId) return sendJson(res, 400, { error: "decisionId is required" });
      const { createContractSourceSignedUrl } = await import("./indicator/contractConditions.js");
      const source = await createContractSourceSignedUrl({
        workspaceId: contractSourceLinkMatch[1],
        decisionId,
        expiresIn: 60,
        config: config()
      });
      const location = `${source.signedUrl}${Number.isInteger(page) && page > 0 ? `#page=${page}` : ""}`;
      res.writeHead(302, {
        Location: location,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "Referrer-Policy": "no-referrer"
      });
      return res.end();
    } catch (error) {
      logContractsRouteFailure("contract-source-link", error);
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Every route requires an explicit projectId — there is no default project
  // (acceptance criterion 24). DB routing comes from the schedule source
  // profile (scheduleSettings), never from this layer.

  // Contracts saved-workspace Phase 3F.1: same-origin saved contract workspaces.
  // Canonical extraction snapshots and source PDFs are immutable; reviewer
  // drafts remain mutable and separate from Phase 2/3 audit decisions.
  // These routes never run Schedule arithmetic, create mappings, or emit alerts.
  if (req.method === "GET" && url.pathname === "/api/contracts/workspaces/status") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractsWorkspaceStatus } = await import("./contracts/workspacePersistence.js");
      return sendJson(res, 200, await loadContractsWorkspaceStatus({ config: config() }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/contracts/workspaces") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const {
        contractsWorkspacePersistenceApproved,
        listSavedContractWorkspaces,
        parseWorkspaceListRequest
      } = await import("./contracts/workspacePersistence.js");
      if (!contractsWorkspacePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_workspace_persistence_not_enabled",
          code: "contracts_workspace_persistence_not_enabled"
        });
      }
      const request = parseWorkspaceListRequest(url.searchParams);
      const result = await listSavedContractWorkspaces({ config: config(), reviewerId: reviewer.sub, ...request });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractWorkspaceMatch = url.pathname.match(/^\/api\/contracts\/workspaces\/([0-9a-f-]+)$/iu);
  if (req.method === "GET" && contractWorkspaceMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { contractsWorkspacePersistenceApproved, getSavedContractWorkspace } = await import("./contracts/workspacePersistence.js");
      if (!contractsWorkspacePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_workspace_persistence_not_enabled",
          code: "contracts_workspace_persistence_not_enabled"
        });
      }
      const workspace = await getSavedContractWorkspace({
        config: config(),
        workspaceId: contractWorkspaceMatch[1],
        reviewerId: reviewer.sub
      });
      return sendJson(res, 200, { ok: true, workspace });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  const contractWorkspaceDraftMatch = url.pathname.match(/^\/api\/contracts\/workspaces\/([0-9a-f-]+)\/draft$/iu);
  if (req.method === "PUT" && contractWorkspaceDraftMatch) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsWorkspacePersistenceApproved,
        getSavedContractWorkspace,
        saveContractWorkspaceDraft
      } = await import("./contracts/workspacePersistence.js");
      if (!contractsWorkspacePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_workspace_persistence_not_enabled",
          code: "contracts_workspace_persistence_not_enabled"
        });
      }
      const workspaceId = contractWorkspaceDraftMatch[1];
      const workspace = await getSavedContractWorkspace({ config: config(), workspaceId, reviewerId: reviewer.sub });
      const saved = await saveContractWorkspaceDraft({
        config: config(),
        workspaceId,
        reviewerId: reviewer.sub,
        draft: body,
        extraction: workspace.extraction
      });
      return sendJson(res, 200, { ok: true, saved });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/workspaces/extract") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractPdfSha256,
        contractsWorkspacePersistenceApproved,
        findSavedContractWorkspace,
        parseWorkspaceExtractionRequest,
        persistExtractedContractWorkspace,
        projectSavedContractExtractionResponse
      } = await import("./contracts/workspacePersistence.js");
      if (!contractsWorkspacePersistenceApproved()) {
        return sendJson(res, 503, {
          error: "contracts_workspace_persistence_not_enabled",
          code: "contracts_workspace_persistence_not_enabled"
        });
      }
      const request = parseWorkspaceExtractionRequest(body);
      const existing = await findSavedContractWorkspace({
        config: config(),
        sourceProjectId: request.parsedExtraction.projectSelection.projectId,
        scheduleProjectId: request.scheduleProjectId,
        documentSha256: contractPdfSha256(request.parsedExtraction.pdfBytes),
        reviewerId: reviewer.sub
      });
      const { sendContractsJson } = await import("./contracts/response.js");
      if (existing) {
        return sendContractsJson(res, 200, projectSavedContractExtractionResponse(existing, { modelAvoided: true }));
      }

      const { runContractsExtractionRequest, safeContractTelemetry } = await import("./subagents/contracts.js");
      const extraction = await runContractsExtractionRequest({
        body: request.extractionRequest,
        config: config(),
        emit: (payload) => {
          const safe = safeContractTelemetry(payload.event, payload);
          if (safe) console.info("[contracts]", JSON.stringify(safe));
        }
      });
      const workspace = await persistExtractedContractWorkspace({
        config: config(),
        parsedExtraction: request.parsedExtraction,
        extraction,
        scheduleProjectId: request.scheduleProjectId,
        reviewerId: reviewer.sub
      });
      return sendContractsJson(res, 200, projectSavedContractExtractionResponse(workspace, { modelAvoided: false }));
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Contracts Agent Phase 2: authenticated human review and separately gated
  // atomic promotion. These routes never accept per-request database credentials
  // and never run Schedule arithmetic; the existing Schedule Engine consumes the
  // reviewed rows through its existing ingestion path.
  if (req.method === "GET" && url.pathname === "/api/contracts/review/status") {
    const { CONTRACTS_PHASE2_MIGRATION_VERSION, contractsPhase2ApplyApproved } = await import("./contracts/reviewWorkflow.js");
    const applyApproved = contractsPhase2ApplyApproved();
    return sendJson(res, 200, {
      active: true,
      mode: applyApproved ? "promotion_enabled" : "review_only",
      migrationVersion: CONTRACTS_PHASE2_MIGRATION_VERSION,
      applyApproved,
      scheduleEngineMode: "reuse_existing_logic"
    });
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/review/plan") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { prepareContractReview } = await import("./contracts/reviewWorkflow.js");
      const prepared = prepareContractReview({ body, reviewerId: reviewer.sub });
      return sendJson(res, 200, prepared);
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/review/save") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { contractsPhase2ApplyApproved, prepareContractReview } = await import("./contracts/reviewWorkflow.js");
      if (!contractsPhase2ApplyApproved()) {
        return sendJson(res, 503, {
          error: "Contracts review persistence is disabled by the server-only Phase 2 activation gate.",
          code: "contracts_review_persistence_not_enabled"
        });
      }
      if (body.persistReview !== true) {
        return sendJson(res, 409, { error: "An explicit review-only persistence confirmation is required.", code: "contracts_review_persistence_required" });
      }
      const prepared = prepareContractReview({ body, reviewerId: reviewer.sub });
      const { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } = await import("./contracts/reviewMode.js");
      if (contractReviewSubmissionMode(prepared.plan) !== CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly) {
        return sendJson(res, 409, {
          error: "This endpoint accepts only a complete rejection-only review and can never promote Schedule facts.",
          code: "contracts_review_only_not_ready"
        });
      }
      const { submitContractPromotion } = await import("./contracts/promotionWriter.js");
      const result = await submitContractPromotion({
        ...prepared,
        config: config(),
        commit: true,
        migrationApplyApproved: true
      });
      return sendJson(res, 200, result);
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/review/commit") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { contractsPhase2ApplyApproved, prepareContractReview } = await import("./contracts/reviewWorkflow.js");
      if (!contractsPhase2ApplyApproved()) {
        return sendJson(res, 503, {
          error: "Contracts fact promotion is disabled by the server-only Phase 2 activation gate.",
          code: "contracts_promotion_apply_not_approved"
        });
      }
      if (body.commit !== true) {
        return sendJson(res, 409, { error: "An explicit commit confirmation is required.", code: "contracts_promotion_commit_required" });
      }
      const prepared = prepareContractReview({ body, reviewerId: reviewer.sub });
      const { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } = await import("./contracts/reviewMode.js");
      if (contractReviewSubmissionMode(prepared.plan) !== CONTRACT_REVIEW_SUBMISSION_MODE.promotion) {
        return sendJson(res, 409, {
          error: "No transaction-ready approved fact exists. Use the review-only save endpoint for a complete rejection review.",
          code: "contracts_promotion_not_ready"
        });
      }
      const { submitContractPromotion } = await import("./contracts/promotionWriter.js");
      const result = await submitContractPromotion({
        ...prepared,
        config: config(),
        commit: true,
        migrationApplyApproved: true
      });
      return sendJson(res, 200, result);
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Contracts Agent Phase 3E: same-origin, read-only activity-mapping inputs
  // and candidates. The authoritative MAIN project UUID is the only routing
  // input; the server resolves the approved KAPAIM project context and owns
  // both database connections. No review RPC or Schedule arithmetic runs here.
  if (req.method === "GET" && url.pathname === "/api/contracts/activity-mapping/status") {
    const {
      CONTRACTS_ACTIVITY_MAPPING_HISTORY_MIGRATION,
      CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
      contractsActivityMappingReviewApproved
    } = await import("./contracts/activityMappingReview.js");
    const {
      CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_API_VERSION,
      contractsActivityMappingUploadReconciliationApproved
    } = await import("./contracts/activityMappingReconciliation.js");
    return sendJson(res, 200, {
      active: true,
      apiVersion: CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
      mode: "manual_review",
      reviewApplyApproved: contractsActivityMappingReviewApproved(),
      reconciliationApiVersion: CONTRACTS_ACTIVITY_MAPPING_RECONCILIATION_API_VERSION,
      uploadReconciliationApplyApproved: contractsActivityMappingUploadReconciliationApproved(),
      historyMigrationVersion: CONTRACTS_ACTIVITY_MAPPING_HISTORY_MIGRATION,
      automaticReviewActionsEnabled: false
    });
  }

  // Contracts Agent Phase 3G: server-owned upload reconciliation. Both routes
  // accept only the authoritative MAIN project UUID. Preview is read-only;
  // apply uses a separate exact activation flag and the existing atomic review
  // RPC. Browser callers can never submit an auto_continue decision or task set.
  if (
    req.method === "POST"
    && [
      "/api/contracts/activity-mapping/reconciliation/preview",
      "/api/contracts/activity-mapping/reconciliation/apply"
    ].includes(url.pathname)
  ) {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        applyActivityMappingUploadReconciliation,
        contractsActivityMappingUploadReconciliationApproved,
        parseActivityMappingReconciliationRequest,
        previewActivityMappingUploadReconciliation
      } = await import("./contracts/activityMappingReconciliation.js");
      const request = parseActivityMappingReconciliationRequest({
        headers: req.headers,
        query: url.searchParams,
        body
      });
      const applying = url.pathname.endsWith("/apply");
      const result = applying
        ? await applyActivityMappingUploadReconciliation({
            config: config(),
            sourceProjectId: request.sourceProjectId,
            reconciliationApplyApproved: contractsActivityMappingUploadReconciliationApproved()
          })
        : await previewActivityMappingUploadReconciliation({
            config: config(),
            sourceProjectId: request.sourceProjectId
          });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/contracts/activity-mapping/activities") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { loadContractActivityMappingState, parseActivityMappingListRequest } = await import("./contracts/activityMappingService.js");
      const request = parseActivityMappingListRequest({ headers: req.headers, query: url.searchParams });
      const result = await loadContractActivityMappingState({
        config: config(),
        sourceProjectId: request.sourceProjectId
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/activity-mapping/candidates") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const { buildContractActivityMappingCandidatesFromSources, parseActivityMappingCandidateRequest } = await import("./contracts/activityMappingService.js");
      const request = parseActivityMappingCandidateRequest({ headers: req.headers, query: url.searchParams, body });
      const result = await buildContractActivityMappingCandidatesFromSources({
        config: config(),
        sourceProjectId: request.sourceProjectId,
        obligation: request.obligation
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  // Contracts Agent Phase 3F: authenticated manual review/history only. The
  // server rebuilds alternatives from current MAIN/KAPAIM state, owns reviewer
  // identity/time and database credentials, and calls the single atomic RPC.
  if (req.method === "GET" && url.pathname === "/api/contracts/activity-mapping/history") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const { listActivityMappingReviewHistory, parseActivityMappingHistoryRequest } = await import("./contracts/activityMappingReview.js");
      const request = parseActivityMappingHistoryRequest({ headers: req.headers, query: url.searchParams });
      const result = await listActivityMappingReviewHistory({ config: config(), ...request });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/contracts/activity-mapping/review") {
    try {
      const reviewer = getSuperadminSession(req);
      if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
      const body = await readJsonBounded(req, CONTRACTS_MAX_JSON_BYTES);
      const {
        contractsActivityMappingReviewApproved,
        parseActivityMappingReviewRequest,
        submitActivityMappingReview
      } = await import("./contracts/activityMappingReview.js");
      const request = parseActivityMappingReviewRequest({ headers: req.headers, query: url.searchParams, body });
      const result = await submitActivityMappingReview({
        config: config(),
        request,
        reviewerId: reviewer.sub,
        reviewApplyApproved: contractsActivityMappingReviewApproved()
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      const response = contractsErrorResponse(error);
      return sendJson(res, response.status, response.body);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/indicator") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await runScheduleIndicator({
        projectId,
        activityKey: url.searchParams.get("activityKey") || null,
        milestoneKey: url.searchParams.get("milestoneKey") || null,
        asOf: url.searchParams.get("asOf") || null,
        config: buildRequestConfig(req)
      });
      if (!result.ok) return sendJson(res, result.notFound ? 404 : 500, result);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, /required/.test(error.message) ? 400 : 500, { error: error.message });
    }
  }

  if (req.method === "POST" && (url.pathname === "/api/schedule/sweep" || url.pathname === "/api/subagents/schedule")) {
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await runScheduleSweep({
        projectId,
        asOf: body.asOf || body.as_of || null,
        filters: body.filters && typeof body.filters === "object" ? body.filters : {},
        persist: body.persist !== false,
        config: buildRequestConfig(req, body)
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/health") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const health = await runScheduleHealth({
        projectId,
        asOf: url.searchParams.get("asOf") || null,
        config: buildRequestConfig(req)
      });
      return sendJson(res, 200, { ok: true, ...health });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/recalculate") {
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await runScheduleSweep({
        projectId,
        asOf: body.asOf || body.as_of || null,
        filters: {},
        persist: true,
        config: buildRequestConfig(req, body)
      });
      const snapshot = result.workflowLog.nodes.find((node) => node.id === "snapshot_write")?.output ?? {};
      return sendJson(res, 200, {
        ok: true,
        projectId,
        asOf: result.asOf,
        calculatedAt: result.calculatedAt,
        dataVersion: result.dataVersion,
        computed: result.total,
        snapshot,
        warnings: result.warnings
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/projects") {
    try {
      const projects = await listScheduleProjects({ config: buildRequestConfig(req) });
      return sendJson(res, 200, { ok: true, projects });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message, projects: [] });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/alert-scan") {
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await runScheduleAlertScan({
        projectId,
        asOf: body.asOf || body.as_of || null,
        config: buildRequestConfig(req, body)
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/alerts") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const alerts = await listScheduleAlerts({
        projectId,
        lifecycle: url.searchParams.get("lifecycle") || null,
        baselined: url.searchParams.has("baselined") ? url.searchParams.get("baselined") : null,
        minSeverity: url.searchParams.get("minSeverity") || null,
        config: buildRequestConfig(req)
      });
      return sendJson(res, 200, { ok: true, projectId, count: alerts.length, alerts });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/project-end-date") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await saveScheduleProjectEndDate({
        projectId,
        projectEndDate: body.projectEndDate ?? body.project_end_date ?? null,
        config: buildRequestConfig(req, body)
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      return sendJson(res, /required|valid ISO date|not found|not saved/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/activity-updates") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await listScheduleActivityUpdates({ projectId, config: buildRequestConfig(req) });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message, items: [] });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/activity-updates/assignment-agent/reviews") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const [result, labels] = await Promise.all([
        listSharedScheduleAssignmentReviews({
          projectId,
          status: url.searchParams.get("status") || "pending",
          config: getConfig()
        }),
        listSharedScheduleAssignmentEvaluationLabels({ projectId, config: getConfig() })
      ]);
      return sendJson(res, 200, { ok: true, projectId, ...result, labelCoverage: labels.coverage });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message, reviews: [] });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/activity-updates/assign") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId || !body.sourceId) return sendJson(res, 400, { error: "projectId and sourceId are required" });
    try {
      const item = await assignScheduleActivityUpdate({
        projectId,
        sourceId: body.sourceId,
        activityKey: body.activityKey ?? null,
        linkedBy: reviewer.sub,
        config: buildRequestConfig(req, body)
      });
      let reviewQueueWarning = null;
      if (item.activityKey) {
        await resolveSharedScheduleAssignmentReviews({
          projectId,
          sourceId: item.id,
          status: "selected",
          activityKey: item.activityKey,
          resolvedBy: reviewer.sub,
          note: "הבודק בחר פעילות מתאימה ידנית מלוח הזמנים.",
          labelType: SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH,
          config: getConfig()
        }).catch((error) => { reviewQueueWarning = error.message; });
      }
      return sendJson(res, 200, { ok: true, item, ...(reviewQueueWarning ? { reviewQueueWarning } : {}) });
    } catch (error) {
      return sendJson(res, /required|not found|does not belong|ללא data_date/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/activity-updates/assignment-agent/run") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId || !body.sourceId) return sendJson(res, 400, { error: "projectId and sourceId are required" });
    const runId = crypto.randomUUID();
    createRun(runId);
    try {
      // The browser cannot supply a model, prompt, threshold or key. Refresh
      // the SETTINGS-owned configuration and secret for every explicit click.
      await reloadSettingsFromDb();
      const result = await runScheduleActivityAssignmentAgent({
        projectId,
        sourceId: body.sourceId,
        requestedBy: reviewer.sub,
        commit: true,
        timeFilter: body.timeFilter === true,
        config: getConfig(),
        apiKey: settingsOpenRouterApiKey(),
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, {
        status: result.status,
        selectedActivityKey: result.decision?.selectedActivityKey || null,
        confidence: result.decision?.confidence ?? null
      });
      const runEvents = getRunEvents(runId);
      recordRunHistory({
        id: runId,
        title: `סוכן שיוך לו״ז · ${result.event?.title || body.sourceId}`,
        workflowLog: result.workflowLog,
        runEvents,
        kind: "schedule_activity_assignment"
      });
      if (result.auditPersisted) {
        await persistScheduleActivityAssignmentWorkflow({
          scheduleProjectId: result.scheduleProjectId,
          runId,
          workflowLog: result.workflowLog,
          runEvents,
          config: getConfig()
        }).catch((error) => {
          emitRunEvent(runId, "workflow_persistence_warning", "Workflow persistence failed", { status: "warning", error: error.message });
        });
      }
      try {
        if (result.assignment) {
          await resolveSharedScheduleAssignmentReviews({
            projectId,
            sourceId: result.sourceId,
            status: "selected",
            activityKey: result.assignment.activityKey,
            resolvedBy: reviewer.sub,
            note: "הסוכן שייך את ההתראה אוטומטית",
            config: getConfig()
          });
        } else if (scheduleAssignmentNeedsSharedReview(result)) {
          const sharedReview = await persistSharedScheduleAssignmentReview({
            result,
            projectId,
            requestedBy: reviewer.sub,
            config: getConfig()
          });
          result.persistedReview = sharedReview.persisted === true;
          result.reviewId = sharedReview.reviewId || null;
        }
      } catch (error) {
        result.persistedReview = false;
        result.warnings = [...(result.warnings || []), `שמירת ההחלטה המשותפת ב־MAIN נכשלה: ${error.message}`];
      }
      return sendJson(res, 200, result);
    } catch (error) {
      failRun(runId, error);
      const workflowLog = {
        kind: "schedule_activity_assignment",
        runId,
        nodes: [
          { id: "assignment_start", label: "Schedule Assignment Trigger", kind: "trigger", status: "done", input: { projectId, sourceId: body.sourceId, timeFilterEnabled: body.timeFilter === true }, output: { runId } },
          { id: "assignment_error", label: "Assignment Run Error", kind: "output", status: "error", input: {}, output: { error: error.message } }
        ],
        edges: [{ from: "assignment_start", to: "assignment_error" }],
        trace: [
          ...getRunEvents(runId),
          { step: "assignment_error", message: "Schedule activity assignment failed", status: "error", time: new Date().toISOString(), data: { error: error.message } }
        ]
      };
      recordRunHistory({
        id: runId,
        title: `סוכן שיוך לו״ז · ${body.sourceId}`,
        workflowLog,
        kind: "schedule_activity_assignment"
      });
      return sendJson(res, /required|not found|אינה תקינה|ללא תאריך|לא נמצאו|כבוי|כבר משויכת/.test(error.message) ? 400 : 500, { ok: false, error: error.message, runId, workflowLog });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/activity-updates/assignment-agent/confirm") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    if (!body.projectId || !body.runId || !body.activityKey) return sendJson(res, 400, { error: "projectId, runId and activityKey are required" });
    try {
      const result = await confirmScheduleActivityAssignment({
        projectId: body.projectId,
        runId: body.runId,
        activityKey: body.activityKey,
        requestedBy: reviewer.sub,
        config: getConfig()
      });
      let reviewQueueWarning = null;
      await resolveSharedScheduleAssignmentReviews({
        projectId: body.projectId,
        sourceId: result.item.id,
        status: "selected",
        activityKey: result.activityKey,
        resolvedBy: reviewer.sub,
        note: "הבודק אישר את פעילות הסוכן כפעילות המתאימה.",
        labelType: SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH,
        config: getConfig()
      }).catch((error) => { reviewQueueWarning = error.message; });
      return sendJson(res, 200, { ok: true, ...result, ...(reviewQueueWarning ? { reviewQueueWarning } : {}) });
    } catch (error) {
      return sendJson(res, /required|not found|not awaiting|not a candidate|כבר משויכת/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/activity-updates/assignment-agent/reject") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    if (!body.projectId || !body.runId) return sendJson(res, 400, { error: "projectId and runId are required" });
    try {
      const requestedLabelType = SCHEDULE_ASSIGNMENT_NEGATIVE_LABEL_TYPES.includes(body.labelType)
        && body.labelType !== SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY
        ? body.labelType
        : SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH;
      const result = await rejectScheduleActivityAssignment({ projectId: body.projectId, runId: body.runId, reason: body.reason, requestedBy: reviewer.sub, config: getConfig() });
      let reviewQueueWarning = null;
      await resolveSharedScheduleAssignmentReviews({
        projectId: body.projectId,
        sourceId: result.sourceId,
        status: "rejected",
        resolvedBy: reviewer.sub,
        note: body.reason || "הצעת הסוכן נדחתה ידנית",
        labelType: requestedLabelType,
        forbiddenActivityKeys: requestedLabelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH
          ? result.rejectedCandidateKeys
          : [],
        config: getConfig()
      }).catch((error) => { reviewQueueWarning = error.message; });
      return sendJson(res, 200, { ok: true, ...result, ...(reviewQueueWarning ? { reviewQueueWarning } : {}) });
    } catch (error) {
      return sendJson(res, /required|not found|not awaiting/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/activity-updates/assignment-agent/review-label") {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const body = await readJson(req).catch(() => ({}));
    if (!body.projectId || !body.sourceId) return sendJson(res, 400, { error: "projectId and sourceId are required" });
    if (!SCHEDULE_ASSIGNMENT_NEGATIVE_LABEL_TYPES.includes(body.labelType) || body.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY) {
      return sendJson(res, 400, { error: "unsupported review label" });
    }
    try {
      const review = await getPendingSharedScheduleAssignmentReview({
        projectId: body.projectId,
        sourceId: body.sourceId,
        config: getConfig()
      });
      const trustedCandidateKeys = (Array.isArray(review.candidates_snapshot) ? review.candidates_snapshot : [])
        .map((candidate) => String(candidate?.activityKey || ""))
        .filter((activityKey) => activityKey.startsWith("gantt:"));
      const result = await resolveSharedScheduleAssignmentReviews({
        projectId: body.projectId,
        sourceId: body.sourceId,
        status: "rejected",
        resolvedBy: reviewer.sub,
        note: body.reason,
        labelType: body.labelType,
        forbiddenActivityKeys: body.labelType === SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH ? trustedCandidateKeys : [],
        config: getConfig()
      });
      return sendJson(res, 200, { ok: true, sourceId: String(body.sourceId), ...result });
    } catch (error) {
      return sendJson(res, /required|unsupported|not found|requires/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  const assignmentRunMatch = url.pathname.match(/^\/api\/schedule\/activity-updates\/assignment-agent\/runs\/([^/]+)$/u);
  if (req.method === "GET" && assignmentRunMatch) {
    const reviewer = getSuperadminSession(req);
    if (!reviewer?.sub) return sendJson(res, 403, { error: "A same-origin authenticated reviewer session is required." });
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await getScheduleActivityAssignmentRun({ projectId, runId: decodeURIComponent(assignmentRunMatch[1]), config: getConfig() });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      return sendJson(res, /required|not found/.test(error.message) ? 400 : 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/conditions") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const result = await listScheduleConditions({
        projectId,
        status: url.searchParams.get("status") || "pending",
        category: url.searchParams.get("category") || null,
        config: buildRequestConfig(req)
      });
      return sendJson(res, 200, { ok: true, projectId, count: result.conditions.length, ...result });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message, conditions: [] });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/schedule/conditions/resolve") {
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.projectId || body.project_id || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    const runId = body.runId || `schedule_conditions_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      // This agent is SETTINGS-owned. Refresh MAIN.agent_settings on every
      // explicit row action so a stale process can never use the env fallback.
      if (!body.manualTriggerDate) await reloadSettingsFromDb();
      const result = await runScheduleConditionResolver({
        projectId,
        conditionId: body.conditionId || body.condition_id || null,
        limit: body.limit,
        commit: body.commit === true,
        minConfidence: body.minConfidence,
        manualTriggerDate: body.manualTriggerDate || null,
        config: buildRequestConfig(req, body),
        runId
      });
      completeRun(runId, { processed: result.processed, summary: result.summary });
      recordRunHistory({ id: runId, title: `Schedule condition resolver · ${projectId}`, kind: "schedule-condition-resolver" });
      return sendJson(res, 200, { ...result, runId });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, error: error.message, runId });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/versions") {
    const projectId = url.searchParams.get("projectId") || "";
    if (!projectId) return sendJson(res, 400, { error: "projectId is required" });
    try {
      const source = await loadScheduleSource({ config: buildRequestConfig(req), projectId, settings: scheduleSettings() });
      return sendJson(res, 200, {
        ok: true,
        projectId,
        current: source.scheduleMeta,
        files: source.files
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  const subagentConfigMatch = url.pathname.match(/^\/api\/subagents\/([^/]+)\/config$/);
  if (req.method === "PUT" && subagentConfigMatch) {
    return sendJson(res, 405, { error: "Subagent settings are draft-only here. Save them through /api/settings." });
  }

  if (req.method === "POST" && url.pathname === "/api/subagents/alert") {
    const body = await readJson(req);
    try {
      const result = await runAlertAgent({
        query: body.query || "",
        dateFilter: body.date_filter || "",
        dateFrom: body.date_from || null,
        dateTo: body.date_to || null
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 200, { ok: false, error: error.message, answer: null });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/subagents/data-query") {
    const access = authorizeDataQueryRequest(req);
    if (!access.ok) return sendJson(res, access.status, { error: access.error });
    const body = await readJson(req).catch(() => ({}));
    const question = body.question || body.query || "";
    const runId = String(body.runId || body.run_id || `dq_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    const dqContext = {
      ...(body.context && typeof body.context === "object" ? body.context : {}),
      dateFrom: body.dateFrom || body.date_from || body.context?.dateFrom || body.context?.date_from || null,
      dateTo: body.dateTo || body.date_to || body.context?.dateTo || body.context?.date_to || null,
      projectId: body.projectId || body.project_id || body.context?.projectId || body.context?.project_id || null,
      caseId: body.caseId || body.case_id || body.context?.caseId || body.context?.case_id || null,
      source: body.source || body.context?.source || "api",
      runId,
      callerNodeId: body.callerNodeId || body.caller_node_id || body.context?.callerNodeId || body.context?.caller_node_id || null,
      budget: body.budget && typeof body.budget === "object" ? body.budget : body.context?.budget || {}
    };
    createRun(runId);
    emitRunEvent(runId, "chat_input", "שאלת בדיקה התקבלה", { question, context: dqContext });
    const dqOpenRouterCalls = [];
    const dqTelemetry = {
      step: "dq_planner",
      callId: "dq_planner_1",
      record: (entry) => {
        dqOpenRouterCalls.push(entry);
        emitRunEvent(runId, "dq_planner", entry.status === "error" ? "OpenRouter call failed" : "OpenRouter usage recorded", { openrouter: entry });
      }
    };
    try {
      const result = await runDataQueryAgent({
        config: config(),
        question,
        context: dqContext,
        requestedMetrics: body.requestedMetrics || body.requested_metrics || [],
        budget: dqContext.budget,
        maxPlans: body.maxPlans,
        queryPlan: body.queryPlan || body.query_plan || null,
        telemetry: dqTelemetry
      });
      emitRunEvent(runId, "data_query", "Capability routing completed", {
        contractVersion: result.contractVersion || null,
        source: result.caller?.source || dqContext.source,
        domain: result.routing?.domain || null,
        supported: result.routing?.supported !== false,
        suggestedAgent: result.routing?.suggestedAgent || null
      });
      emitRunEvent(runId, "data_query", `תכנון באמצעות ${result.planner || "unknown"}`, {
        planner: result.planner || "unknown",
        plansProposed: (result.queryPlan?.plans || []).length
      });
      emitRunEvent(runId, "data_query", "אימות תוכניות שאילתה", { accepted: result.plans?.length || 0 });
      for (const plan of result.plans || []) {
        emitRunEvent(runId, "data_query", `הרצת ${plan.table}`, {
          id: plan.id,
          table: plan.table,
          operation: plan.operation,
          status: plan.status,
          rows: plan.rows,
          cardinality: plan.cardinality ?? null,
          exactness: plan.exactness || null,
          truncated: plan.truncated === true
        });
      }
      emitRunEvent(runId, "data_query", "סינתוז תשובה", { metrics: (result.metrics || []).length, status: result.status });
      const workflowLog = buildDataQueryWorkflowLog(result, { question, context: dqContext, openRouterCalls: dqOpenRouterCalls });
      completeRun(runId, { status: result.status, workflowLog });
      recordRunHistory({
        id: runId,
        title: `סוכן שאילתות · ${(question || "בדיקה").slice(0, 40)}`,
        workflowLog,
        runEvents: getRunEvents(runId),
        kind: "data_query"
      });
      const status = result.status === "error" && !result.plans?.some((plan) => plan.status === "ok") ? 400 : 200;
      return sendJson(res, status, { ...result, workflowLog, runId });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { status: "error", error: error.message, answer: null, metrics: [], plans: [], tablesUsed: [], confidence: 0, warnings: [error.message], runId });
    }
  }

  if (req.method === "POST" && /^\/api\/messages\/[^/]+\/annotate$/.test(url.pathname)) {
    const messageId = decodeURIComponent(url.pathname.split("/")[3]);
    const body = await readJson(req);
    const annotation = body.annotation === "V" || body.annotation === "X" ? body.annotation : null;
    try {
      await annotateMessage({ config: config(), messageId, annotation });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/timeline") {
    const events = await fetchTimelineEvents({ config: config() }).catch(() => []);
    return sendJson(res, 200, { events });
  }

  if (req.method === "GET" && url.pathname === "/api/timeline/alerts") {
    const events = await fetchAlertsTimelineEvents({ config: config() }).catch(() => []);
    return sendJson(res, 200, { events });
  }

  if (req.method === "GET" && url.pathname === "/api/timeline/events") {
    try {
      const query = parseTimelineEventsQuery(url.searchParams);
      const result = await fetchTimelineEventPage({ config: config(), ...query });
      return sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof TimelineRequestError || error?.statusCode === 400) {
        return sendJson(res, 400, { error: error.message });
      }
      throw error;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/timeline/links") {
    const source = normalizeTimelineSource(url.searchParams.get("source") || "index");
    const links = await listTimelineEventLinks({ config: config(), source });
    return sendJson(res, 200, { links });
  }

  if (req.method === "GET" && url.pathname === "/api/timeline/link-suggestions") {
    const source = normalizeTimelineSource(url.searchParams.get("source") || "index");
    const smart = ["1", "true", "yes", "ai", "smart"].includes(String(url.searchParams.get("smart") || "").toLowerCase());
    const focusEventId = String(url.searchParams.get("eventId") || "").trim();
    const runId = String(url.searchParams.get("runId") || "").trim();
    if (runId) createRun(runId);
    const linkAgent = config().timelineLinks || {};
    const requestedLimit = Math.min(Math.max(Number(url.searchParams.get("limit") || 0) || (focusEventId ? linkAgent.suggestionLimit || 12 : 40), 1), 200);
    const trace = [];
    trace.push(timelineLinkTrace("link_agent_start", "סוכן הקשרים הופעל", {
      source,
      smart,
      focusEventId: focusEventId || null,
      requestedLimit
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const events = source === "alerts"
      ? await fetchAlertsTimelineEvents({ config: config() }).catch(() => [])
      : await fetchTimelineEvents({ config: config() }).catch(() => []);
    trace.push(timelineLinkTrace("timeline_events", "נטענו אירועי ציר זמן", { count: events.length, source }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const links = await listTimelineEventLinks({ config: config(), source }).catch(() => []);
    trace.push(timelineLinkTrace("saved_links", "נטענו קשרים קיימים", { count: links.length }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const graphData = await listTimelineGraphData({ config: config(), source }).catch(() => ({ eventEntities: [], graphEdges: [] }));
    trace.push(timelineLinkTrace("timeline_graph_data", "נטענו נתוני Knowledge Graph", {
      eventEntities: graphData.eventEntities?.length || 0,
      graphEdges: graphData.graphEdges?.length || 0
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
    await buildTimelineKnowledgeGraph({ events, links, source, eventEntities: graphData.eventEntities || [], graphEdges: graphData.graphEdges || [] });
    const graphScorer = createTimelineGraphScorer({ eventEntities: graphData.eventEntities || [], source });
    trace.push(timelineLinkTrace("graph_scorer", "נבנה scorer מהגרף", { persistedEventEntities: graphData.eventEntities?.length || 0 }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const projectGraphPayload = buildGraphSearchPayload({
      query: focusEventId || source,
      records: focusEventId ? events.filter((event) => String(event.id) === focusEventId) : events.slice(0, 50),
      maxRows: 30
    });
    const projectGraph = await graphSearch({ config: config(), payload: projectGraphPayload, limit: 30 })
      .catch((error) => ({ skipped: true, error: error.message, results: [] }));
    const projectGraphContext = summarizeGraphContext(projectGraph, 12);
    trace.push(timelineLinkTrace("project_graph_search", "Project Graph Search checked", {
      sourceRefs: projectGraphPayload.source_refs.length,
      relationships: projectGraphContext.length,
      skipped: Boolean(projectGraph.skipped),
      error: projectGraph.error || null
    }, projectGraph.error ? "error" : "done"));
    emitTimelineLinkRun(runId, trace.at(-1));
    const baseSuggestions = buildTimelineLinkSuggestions({
      events,
      links,
      source,
      limit: focusEventId ? 200 : requestedLimit,
      pairScorer: graphScorer
    });
    trace.push(timelineLinkTrace("quote_rules", "הופעלו חוקי הצעת מחיר לאישור", {
      suggestions: baseSuggestions.length,
      filteredByEvent: Boolean(focusEventId)
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const focusedBaseSuggestions = focusEventId
      ? baseSuggestions.filter((item) => String(item.source_event_id) === focusEventId || String(item.target_event_id) === focusEventId)
      : baseSuggestions;
    const relatedSuggestions = focusEventId
      ? buildFocusedRelatedTimelineSuggestions({ events, links, source, focusEventId, graphScorer, limit: requestedLimit, settings: linkAgent })
      : [];
    trace.push(timelineLinkTrace("related_fallback", "הופעלה השלמה דרך הגרף", {
      enabled: Boolean(focusEventId && linkAgent.useGraphFallback !== false),
      suggestions: relatedSuggestions.length
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const focusedSuggestions = mergeTimelineSuggestions([...focusedBaseSuggestions, ...relatedSuggestions], requestedLimit);
    trace.push(timelineLinkTrace("candidate_merge", "אוחדו מועמדים לפני מודל", {
      ruleSuggestions: focusedBaseSuggestions.length,
      relatedSuggestions: relatedSuggestions.length,
      candidates: focusedSuggestions.length
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const suggestions = smart
      ? await enrichTimelineSuggestionsWithModel({
        cfg: config(),
        events,
        links,
        source,
        baseSuggestions: focusedSuggestions,
        graphScorer,
        focusEventId,
        limit: requestedLimit,
        trace,
        runId
      }).catch((error) => {
        console.warn("[timeline] smart suggestions failed:", error.message);
        trace.push(timelineLinkTrace("model_review", "בדיקת מודל נכשלה", { error: error.message }, "error"));
        emitTimelineLinkRun(runId, trace.at(-1));
        return focusedSuggestions.map((item) => ({ ...item, modelStatus: "fallback", modelError: error.message }));
      })
      : focusedSuggestions;
    trace.push(timelineLinkTrace("link_agent_result", "סוכן הקשרים סיים", { suggestions: suggestions.length }));
    emitTimelineLinkRun(runId, trace.at(-1));
    const workflowLog = buildTimelineLinkWorkflowLog({
      source,
      smart,
      focusEventId,
      requestedLimit,
      events,
      links,
      graphData,
      baseSuggestions,
      focusedBaseSuggestions,
      relatedSuggestions,
      focusedSuggestions,
      suggestions,
      linkAgent,
      trace
    });
    if (runId) {
      completeRun(runId, { suggestions: suggestions.length, workflowLog });
      recordRunHistory({
        id: runId,
        title: `סוכן הקשרים · ${focusEventId || source}`,
        workflowLog,
        runEvents: getRunEvents(runId),
        kind: "link_agent"
      });
    }
    return sendJson(res, 200, { suggestions, mode: smart ? "smart" : "rules", workflowLog, runId: runId || null });
  }

  if (req.method === "POST" && url.pathname === "/api/timeline/graph/rebuild") {
    const body = await readJson(req).catch(() => ({}));
    const source = normalizeTimelineSource(body.source || url.searchParams.get("source") || "index");
    const events = source === "alerts"
      ? await fetchAlertsTimelineEvents({ config: config() }).catch(() => [])
      : await fetchTimelineEvents({ config: config() }).catch(() => []);
    const rows = buildEntityGraphRowsForEvents(events, source);
    const saved = await upsertTimelineGraphData({ config: config(), entities: rows.entities, eventEntities: rows.eventEntities });
    const projectRows = buildGraphRowsFromRecords(events, { defaultSource: source === "alerts" ? "alerts" : config().contentSource?.indexTable || "data_index" });
    const projectSaved = await upsertProjectGraphData({ config: config(), nodes: projectRows.nodes, edges: projectRows.edges }).catch((error) => ({ nodes: 0, edges: 0, error: error.message }));
    // Entity enrichment piggybacks on rebuilds when requested explicitly or enabled in settings.
    let enrichment = null;
    if (body.enrichEntities === true || config().insights?.graphEnrichment === true) {
      enrichment = await runGraphEnrichment({ config: config(), source, mode: body.enrichmentMode || "incremental", limit: Number(body.enrichmentLimit || 200) })
        .catch((error) => ({ error: error.message }));
    }
    return sendJson(res, 200, { ok: true, source, events: events.length, ...saved, projectGraph: projectSaved, enrichment });
  }

  // Entity-resolution v2: merge duplicate entity nodes (dry-run by default —
  // pass {"dryRun": false} explicitly to apply).
  if (req.method === "POST" && url.pathname === "/api/graph/consolidate") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    try {
      const result = await consolidateGraphEntities({
        config: buildRequestConfig(req, body),
        dryRun: body.dryRun !== false
      });
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  // Graph Entity Enrichment Agent (docs/graph-entity-enrichment-agent-spec.md, Task G2).
  // Explicit invocation is consent; the insights.graphEnrichment flag only controls
  // automatic enrichment during rebuilds.
  if (req.method === "POST" && url.pathname === "/api/graph/enrich") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `graph_enrichment_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const summary = await runGraphEnrichment({
        config: buildRequestConfig(req, body),
        source: body.source === "alerts" ? "alerts" : "index",
        dateFrom: body.dateFrom || body.date_from || null,
        dateTo: body.dateTo || body.date_to || null,
        limit: Math.max(1, Math.min(Number(body.limit) || 200, 1000)),
        mode: body.mode === "backfill" ? "backfill" : "incremental",
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, { entities: summary.entities, records: summary.records });
      return sendJson(res, 200, { ok: true, runId, ...summary });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, runId, error: error.message });
    }
  }

  // Internal Indexing Agent (docs/n8n-agents-migration-spec.md, Task A1).
  // Explicit invocation is consent; dry-run is the default on both endpoints.
  if (req.method === "POST" && url.pathname === "/api/index/backfill-dates") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `indexing_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const summary = await runIndexDatesBackfill({
        config: buildRequestConfig(req, body),
        dryRun: body.dryRun !== false,
        limit: Math.max(1, Math.min(Number(body.limit) || 3000, 10000)),
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, { planned: summary.planned, updated: summary.updated });
      return sendJson(res, 200, { ok: true, runId, ...summary });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, runId, error: error.message });
    }
  }

  // Embedding backfill: fills NULL embedding columns in content source tables
  // (additive only — the is.null filter is part of every write).
  if (req.method === "POST" && url.pathname === "/api/index/embeddings") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `indexing_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const summary = await runEmbeddingBackfill({
        config: buildRequestConfig(req, body),
        tables: Array.isArray(body.tables) ? body.tables : null,
        dryRun: body.dryRun !== false,
        limit: Math.max(1, Math.min(Number(body.limit) || 150, 500)),
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, { planned: summary.planned, embedded: summary.embedded });
      return sendJson(res, 200, { ok: true, runId, ...summary });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, runId, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/index/run") {
    if (!checkBidocSecretForRead(req)) return sendJson(res, 401, { error: "Unauthorized" });
    const body = await readJson(req).catch(() => ({}));
    const runId = body.runId || `indexing_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const summary = await runIncrementalIndexing({
        config: buildRequestConfig(req, body),
        dryRun: body.dryRun !== false,
        limit: Math.max(1, Math.min(Number(body.limit) || 50, 200)),
        tables: Array.isArray(body.tables) ? body.tables : null,
        runId,
        emit: emitRunEvent
      });
      completeRun(runId, { planned: summary.planned, inserted: summary.inserted });
      return sendJson(res, 200, { ok: true, runId, ...summary });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { ok: false, runId, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/timeline/links") {
    const body = await readJson(req);
    const link = await createTimelineEventLink({ config: config(), link: body });
    return sendJson(res, 200, { link });
  }

  const timelineLinkDeleteMatch = url.pathname.match(/^\/api\/timeline\/links\/([^/]+)$/);
  if (req.method === "DELETE" && timelineLinkDeleteMatch) {
    const id = decodeURIComponent(timelineLinkDeleteMatch[1]);
    const result = await deleteTimelineEventLink({ config: config(), id });
    return sendJson(res, 200, result);
  }


  if (req.method === "GET" && url.pathname === "/api/qa/dislikes") {
    const messages = await listDislikedMessages({ config: config() }).catch(() => []);
    return sendJson(res, 200, { messages });
  }

  if (req.method === "GET" && url.pathname === "/api/qa/messages") {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 50);
    const [messages, reports] = await Promise.all([
      listQaMessages({
        config: config(),
        limit,
        dislikedOnly: url.searchParams.get("filter") === "disliked"
      }),
      listQaReports({ config: config(), limit: 200 })
    ]);
    const latestReportByMessage = new Map();
    for (const report of reports || []) {
      const key = String(report.message_id);
      if (!latestReportByMessage.has(key) && report.report?.kind !== "ai_report") {
        latestReportByMessage.set(key, report);
      }
    }
    return sendJson(res, 200, {
      messages: (messages || []).map((message) => ({
        ...message,
        qa_report: latestReportByMessage.get(String(message.id)) || null
      }))
    });
  }

  const qaRunMatch = url.pathname.match(/^\/api\/qa\/([^/]+)\/run$/);
  if (req.method === "POST" && qaRunMatch) {
    const messageId = decodeURIComponent(qaRunMatch[1]);
    const row = await getMessage({ config: config(), messageId }).catch(() => null);
    if (!row) return sendJson(res, 404, { error: "Message not found" });
    if (!row.workflow_log) return sendJson(res, 422, { error: "חסר workflow_log — הרץ את ה-migration בסופאבייס ושלח הודעה חדשה עם דיסלייק" });
    const qaBody = await readJson(req).catch(() => ({}));
    try {
      const report = await runQaAgent({
        config: config(),
        userMessage: row.user_message,
        aiResponse: row.ai_response,
        workflowLog: row.workflow_log,
        userFeedback: qaBody.userFeedback || null
      });
      await saveQaReport({ config: config(), messageId, status: "done", report });
      return sendJson(res, 200, { ok: true, report });
    } catch (err) {
      await saveQaReport({ config: config(), messageId, status: "error", error: err.message });
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  const aiReportRunMatch = url.pathname.match(/^\/api\/ai-report\/([^/]+)\/run$/);
  if (req.method === "POST" && aiReportRunMatch) {
    const messageId = decodeURIComponent(aiReportRunMatch[1]);
    const body = await readJson(req).catch(() => ({}));
    const row = await getMessage({ config: config(), messageId });
    if (!row) return sendJson(res, 404, { error: "Run was not found in history" });
    try {
      const report = await runQaAgent({
        config: config(),
        userMessage: row.user_message,
        aiResponse: row.ai_response,
        workflowLog: row.workflow_log,
        userFeedback: body.userFeedback || "Analyze this workflow run as an AI run report. Focus on how to improve retrieval, graph use, tool calls, prompt behavior, and final answer quality."
      });
      const reportEnvelope = {
        kind: "ai_report",
        generated_at: new Date().toISOString(),
        report
      };
      await saveQaReport({ config: config(), messageId, status: "done", report: reportEnvelope });
      await updateMessage({
        config: config(),
        messageId,
        aiResponse: row.ai_response,
        status: row.status || "done",
        workflowLog: { ...(row.workflow_log || {}), ai_report: reportEnvelope },
        runEvents: row.run_events || null
      });
      return sendJson(res, 200, { ok: true, report: reportEnvelope });
    } catch (err) {
      await saveQaReport({ config: config(), messageId, status: "error", error: err.message });
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  const aiReportMatch = url.pathname.match(/^\/api\/ai-report\/([^/]+)$/);
  if (req.method === "GET" && aiReportMatch) {
    const messageId = decodeURIComponent(aiReportMatch[1]);
    const row = await getMessage({ config: config(), messageId }).catch(() => null);
    if (row?.workflow_log?.ai_report) return sendJson(res, 200, { report: row.workflow_log.ai_report });
    const saved = await getLatestQaReport({ config: config(), messageId }).catch(() => null);
    if (saved?.report?.kind === "ai_report") return sendJson(res, 200, { report: saved.report });
    return sendJson(res, 404, { error: "No AI report found" });
  }

  const qaReportMatch = url.pathname.match(/^\/api\/qa\/([^/]+)\/report$/);
  if (req.method === "GET" && qaReportMatch) {
    const messageId = decodeURIComponent(qaReportMatch[1]);
    const report = await getLatestQaReport({ config: config(), messageId }).catch(() => null);
    if (!report) return sendJson(res, 404, { error: "No report found" });
    return sendJson(res, 200, { report });
  }

  if (req.method === "POST" && url.pathname === "/api/qa/trends") {
    const reports = await listQaReports({ config: config() }).catch(() => []);
    if (!reports.length) return sendJson(res, 422, { error: "אין דוחות QA שמורים עדיין" });
    try {
      const trend = await runQaTrendAnalysis({ config: config(), reports });
      return sendJson(res, 200, { ok: true, trend });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

function normalizeChatAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((item) => ({
    name: String(item?.name || "attachment").slice(0, 160),
    content: String(item?.content || "").slice(0, 1_000_000)
  })).filter((item) => item.content.trim());
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  // Login wall: any HTML page other than the login page itself requires a
  // valid superadmin session cookie, otherwise redirect to /login.html.
  if (safePath.endsWith(".html") && safePath !== "/login.html" && !getSuperadminSession(req)) {
    res.writeHead(302, { Location: "/login.html" });
    res.end();
    return;
  }
  const fullPath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath)) {
    sendText(res, 404, "Not found");
    return;
  }
  const ext = path.extname(fullPath);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  }[ext] || "application/octet-stream";
  // The HTML shell references versioned assets (?v=...). If the browser caches the
  // HTML, those version bumps never take effect and stale bundles keep loading.
  // Force the document (and JS/CSS, which use query-string busting) to revalidate.
  const noCache = ext === ".html" || ext === ".js" || ext === ".css";
  const headers = { "Content-Type": contentType };
  if (noCache) headers["Cache-Control"] = "no-cache, must-revalidate";
  if (safePath === "/index.html") {
    const html = injectBuildVersion(fs.readFileSync(fullPath, "utf8"));
    headers["Content-Length"] = Buffer.byteLength(html);
    res.writeHead(200, headers);
    res.end(html);
    return;
  }

  res.writeHead(200, headers);
  fs.createReadStream(fullPath).pipe(res);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function parseHashtags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

async function enrichTimelineSuggestionsWithModel({ cfg, events = [], links = [], source = "index", baseSuggestions = [], graphScorer, focusEventId = "", limit = 8, trace = [], runId = "" }) {
  if (!cfg.openRouterApiKey) return baseSuggestions;
  const linkAgent = cfg.timelineLinks || {};
  const semanticSuggestions = linkAgent.useSemanticSearch === false
    ? (trace.push(timelineLinkTrace("semantic_search", "חיפוש סמנטי דולג", { enabled: false })), emitTimelineLinkRun(runId, trace.at(-1)), [])
    : await buildSemanticTimelineSuggestions({ cfg, events, links, source, graphScorer, focusEventId }).catch((error) => {
      console.warn("[timeline] semantic suggestions failed:", error.message);
      trace.push(timelineLinkTrace("semantic_search", "חיפוש סמנטי נכשל", { error: error.message }, "error"));
      emitTimelineLinkRun(runId, trace.at(-1));
      return [];
    });
  if (linkAgent.useSemanticSearch !== false) {
    trace.push(timelineLinkTrace("semantic_search", "הופעל חיפוש סמנטי", {
      suggestions: semanticSuggestions.length,
      topK: Number(linkAgent.semanticTopK || 8)
    }));
    emitTimelineLinkRun(runId, trace.at(-1));
  }
  const candidates = mergeTimelineSuggestions([...baseSuggestions, ...semanticSuggestions], Math.max(limit * 2, 14));
  trace.push(timelineLinkTrace("candidate_merge", "אוחדו מועמדים סמנטיים", {
    baseSuggestions: baseSuggestions.length,
    semanticSuggestions: semanticSuggestions.length,
    candidates: candidates.length
  }));
  emitTimelineLinkRun(runId, trace.at(-1));
  if (!candidates.length) return [];

  const byId = new Map(events.map((event) => [String(event.id), event]));
  const reviewInput = candidates.map((item, index) => {
    const sourceEvent = byId.get(String(item.source_event_id));
    const targetEvent = byId.get(String(item.target_event_id));
    return {
      index,
      relation_type: item.relation_type,
      durationDays: item.durationDays,
      score: Number(item.score || 0),
      semantic: item.semantic || null,
      graph: {
        score: Number(item.graphScore || 0),
        sharedEntities: (item.graphSharedEntities || []).slice(0, 8)
      },
      source: compactTimelineEvent(sourceEvent),
      target: compactTimelineEvent(targetEvent)
    };
  });

  const content = await chatCompletion({
    apiKey: cfg.openRouterApiKey,
    model: linkAgent.model || cfg.models.reranker || cfg.models.lite || cfg.models.main,
    temperature: 0,
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content: linkAgent.prompt || "You verify timeline event links for a construction project."
      },
      {
        role: "user",
        content: JSON.stringify({ source, candidates: reviewInput }, null, 2)
      }
    ]
  });
  const parsed = extractJsonObject(content);
  const reviews = Array.isArray(parsed.links) ? parsed.links : [];
  trace.push(timelineLinkTrace("model_review", "המודל בדק את המועמדים", {
    model: linkAgent.model || cfg.models.reranker || cfg.models.lite || cfg.models.main,
    candidates: candidates.length,
    reviews: reviews.length,
    minConfidence: Number(linkAgent.minConfidence ?? 0.42)
  }));
  emitTimelineLinkRun(runId, trace.at(-1));
  const accepted = [];
  for (const review of reviews) {
    const index = Number(review.index);
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) continue;
    if (review.accepted === false || Number(review.confidence || 0) < Number(linkAgent.minConfidence ?? 0.42)) continue;
    const candidate = candidates[index];
    accepted.push({
      ...candidate,
      relation_type: normalizeTimelineRelationType(review.relation_type, candidate.relation_type),
      approver: String(review.approver || candidate.approver || "").trim(),
      modelStatus: "reviewed",
      modelConfidence: Number(review.confidence || 0),
      modelReason: String(review.reason || "").slice(0, 240),
      score: Number(candidate.score || 0) + Math.round(Number(review.confidence || 0) * 35)
    });
  }
  trace.push(timelineLinkTrace("review_filter", "סוננו תוצאות לפי סף ביטחון", {
    accepted: accepted.length,
    rejected: Math.max(0, reviews.length - accepted.length)
  }));
  emitTimelineLinkRun(runId, trace.at(-1));
  return mergeTimelineSuggestions(accepted.length ? accepted : candidates.map((item) => ({ ...item, modelStatus: "reviewed_no_accept" })), limit);
}

async function buildSemanticTimelineSuggestions({ cfg, events = [], links = [], source = "index", graphScorer, focusEventId = "" }) {
  if (source !== "index") return [];
  const existing = new Set(links.map((link) => [
    link.source_event_source,
    link.source_event_id,
    link.target_event_source,
    link.target_event_id,
    link.relation_type
  ].join("|")));
  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const focusEvent = focusEventId ? events.find((event) => String(event.id) === focusEventId) : null;
  const quoteEvents = selectTimelineQuoteSeeds(events, focusEvent)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, focusEvent ? 20 : 10);
  const suggestions = [];
  for (const quote of quoteEvents) {
    const query = [
      "approval accepted approved אישור אושר אושרה",
      eventTitle(quote),
      (quote.tags || []).join(" "),
      String(quote.content || "").slice(0, 500)
    ].filter(Boolean).join("\n");
    const rows = await hybridSearch({
      config: cfg,
      query,
      dateFrom: quote.date || null,
      dateTo: null,
      hashtags: quote.tags || [],
      topK: Number(cfg.timelineLinks?.semanticTopK || 8)
    }).catch(() => []);
    for (const row of rows || []) {
      const target = findTimelineEventForSearchRow(row, eventsById);
      if (!target || String(target.id) === String(quote.id) || !isTimelineEventAfter(target, quote)) continue;
      const graph = typeof graphScorer === "function"
        ? graphScorer({ sourceEvent: quote, targetEvent: target, source })
        : { graphScore: 0, graphSharedEntities: [] };
      const looksApproval = isTimelineApprovalEvent(target);
      if (!looksApproval && Number(graph.graphScore || 0) < 18) continue;
      const key = [source, quote.id, source, target.id, "quote_approved"].join("|");
      if (existing.has(key)) continue;
      const semanticScore = Number(row.hybrid_score ?? row.match_score ?? row.score ?? row.similarity ?? 0);
      suggestions.push(buildTimelineSuggestionFromEvents({
        sourceEvent: quote,
        targetEvent: target,
        source,
        relationType: "quote_approved",
        score: 25 + Number(graph.graphScore || 0) + Math.round(semanticScore * 20),
        sharedTags: sharedTimelineTags(quote, target),
        graph,
        semantic: {
          score: semanticScore,
          source: "hybrid_search"
        }
      }));
    }
  }
  return mergeTimelineSuggestions(suggestions, 12);
}

function findTimelineEventForSearchRow(row, eventsById) {
  const candidates = [
    row?.id,
    row?.document_id,
    row?.metadata?.id,
    row?.metadata?.document_id,
    row?.metadata?.source_id
  ].filter((value) => value !== undefined && value !== null);
  for (const id of candidates) {
    const event = eventsById.get(String(id));
    if (event) return event;
  }
  const text = String(row?.content || row?.index_text || row?.summary || row?.title || row?.text || row?.metadata?.content || "");
  if (!text) return null;
  for (const event of eventsById.values()) {
    const eventText = timelineEventText(event);
    if (eventText && (eventText.includes(text.slice(0, 80)) || text.includes(eventText.slice(0, 80)))) return event;
  }
  return null;
}

function compactTimelineEvent(event) {
  if (!event) return null;
  return {
    id: String(event.id),
    date: event.date || null,
    title: eventTitle(event),
    tags: event.tags || [],
    text: timelineEventText(event).slice(0, 900)
  };
}

function sharedTimelineTags(a, b) {
  const aTags = new Set((a?.tags || []).map((tag) => String(tag).toLowerCase()));
  return (b?.tags || []).filter((tag) => aTags.has(String(tag).toLowerCase())).length;
}

function normalizeTimelineRelationType(value, fallback = "related") {
  const allowed = new Set(["quote_approved", "invoice_sent", "payment_received", "change_order", "related"]);
  return allowed.has(value) ? value : fallback;
}

function selectTimelineQuoteSeeds(events, focusEvent) {
  if (!focusEvent) return events.filter(isTimelineQuoteEvent);
  if (isTimelineQuoteEvent(focusEvent)) return [focusEvent];
  if (isTimelineApprovalEvent(focusEvent)) {
    return events.filter((event) =>
      isTimelineQuoteEvent(event) &&
      isTimelineEventAfter(focusEvent, event) &&
      event.id !== focusEvent.id &&
      hasTimelineOverlap(event, focusEvent)
    );
  }
  return events.filter((event) =>
    isTimelineQuoteEvent(event) &&
    event.id !== focusEvent.id &&
    hasTimelineOverlap(event, focusEvent)
  );
}

function buildFocusedRelatedTimelineSuggestions({ events = [], links = [], source = "index", focusEventId = "", graphScorer, limit = 12, settings = {} }) {
  if (settings.useGraphFallback === false) return [];
  const focus = events.find((event) => String(event.id) === String(focusEventId));
  if (!focus) return [];
  const existing = new Set(links.map((link) => [
    link.source_event_source,
    link.source_event_id,
    link.target_event_source,
    link.target_event_id,
    link.relation_type
  ].join("|")));
  const focusDate = new Date(focus.date);
  const proposals = [];
  for (const candidate of events) {
    if (String(candidate.id) === String(focus.id)) continue;
    const candidateDate = new Date(candidate.date);
    if (Number.isNaN(focusDate.getTime()) || Number.isNaN(candidateDate.getTime())) continue;
    const distanceDays = Math.abs(candidateDate.getTime() - focusDate.getTime()) / 86400000;
    if (distanceDays > Number(settings.timeWindowDays || 120)) continue;
    const graph = typeof graphScorer === "function"
      ? graphScorer({ sourceEvent: focus, targetEvent: candidate, source })
      : { graphScore: 0, graphSharedEntities: [] };
    const ignoredTerms = timelineIgnoredTerms(settings);
    const meaningfulEntities = (graph.graphSharedEntities || []).filter((entity) => isMeaningfulTimelineEntity(entity, ignoredTerms));
    const meaningfulTags = sharedMeaningfulTimelineTags(focus, candidate, ignoredTerms);
    if (!meaningfulEntities.length && !meaningfulTags.length) continue;

    const focusIsBefore = candidateDate >= focusDate;
    const sourceEvent = focusIsBefore ? focus : candidate;
    const targetEvent = focusIsBefore ? candidate : focus;
    const relationType = isTimelineQuoteEvent(sourceEvent) && isTimelineApprovalEvent(targetEvent)
      ? "quote_approved"
      : "related";
    const key = [source, sourceEvent.id, source, targetEvent.id, relationType].join("|");
    if (existing.has(key)) continue;

    const timeScore = Math.max(0, 35 - Math.min(distanceDays, 35));
    const score = Math.round(timeScore + meaningfulTags.length * 18 + meaningfulEntities.length * 14 + Number(graph.graphScore || 0) * 0.35);
    proposals.push(buildTimelineSuggestionFromEvents({
      sourceEvent,
      targetEvent,
      source,
      relationType,
      score,
      sharedTags: meaningfulTags.length,
      graph: {
        graphScore: score,
        graphSharedEntities: meaningfulEntities
      },
      semantic: { source: "timeline_graph_focus" }
    }));
  }
  return mergeTimelineSuggestions(proposals, limit);
}

function isMeaningfulTimelineEntity(entity, ignoredTerms = GENERIC_TIMELINE_TERMS) {
  const name = String(entity?.name || "").trim().toLowerCase().replace(/^#+/, "");
  if (!name || ignoredTerms.has(name)) return false;
  return name.length > 2 || /[0-9_-]/.test(name);
}

function sharedMeaningfulTimelineTags(a, b, ignoredTerms = GENERIC_TIMELINE_TERMS) {
  const bTags = new Set((b?.tags || []).map(normalizeTimelineTerm).filter((tag) => tag && !ignoredTerms.has(tag)));
  return (a?.tags || [])
    .map(normalizeTimelineTerm)
    .filter((tag, index, all) => tag && all.indexOf(tag) === index && bTags.has(tag) && !ignoredTerms.has(tag));
}

function normalizeTimelineTerm(value) {
  return String(value || "").trim().toLowerCase().replace(/^#+/, "");
}

const GENERIC_TIMELINE_TERMS = new Set([
  "פרויקט",
  "project",
  "כללי",
  "general",
  "בנייה",
  "construction",
  "תכניות",
  "תכנית",
  "מסמך",
  "מסמכים",
  "document",
  "documents",
  "לידיעה",
  "סטטוס"
]);

function timelineIgnoredTerms(settings = {}) {
  const terms = Array.isArray(settings.ignoredTerms) && settings.ignoredTerms.length
    ? settings.ignoredTerms
    : [...GENERIC_TIMELINE_TERMS];
  return new Set(terms.map(normalizeTimelineTerm).filter(Boolean));
}

function hasTimelineOverlap(a, b) {
  const aTags = new Set((a?.tags || []).map(normalizeTimelineTerm).filter((tag) => tag && !GENERIC_TIMELINE_TERMS.has(tag)));
  if ((b?.tags || []).some((tag) => aTags.has(normalizeTimelineTerm(tag)))) return true;
  const aText = timelineEventText(a).toLowerCase();
  const bText = timelineEventText(b).toLowerCase();
  return (a?.tags || []).some((tag) => bText.includes(String(tag).toLowerCase())) ||
    (b?.tags || []).some((tag) => aText.includes(String(tag).toLowerCase()));
}

function timelineLinkTrace(step, message, data = {}, status = "done") {
  return {
    step,
    message,
    status,
    time: new Date().toISOString(),
    data
  };
}

function emitTimelineLinkRun(runId, item) {
  if (!runId || !item) return;
  emitRunEvent(runId, item.step, item.message, { ...(item.data || {}), status: item.status });
}

function buildTimelineLinkWorkflowLog({
  source,
  smart,
  focusEventId,
  requestedLimit,
  events = [],
  links = [],
  graphData = {},
  baseSuggestions = [],
  focusedBaseSuggestions = [],
  relatedSuggestions = [],
  focusedSuggestions = [],
  suggestions = [],
  linkAgent = {},
  trace = []
}) {
  const hasFocus = Boolean(focusEventId);
  const semanticTrace = latestTrace(trace, "semantic_search");
  const modelTrace = latestTrace(trace, "model_review");
  const reviewTrace = latestTrace(trace, "review_filter");
  const nodes = [
    workflowNode("link_agent_start", "Link Agent Trigger", "trigger", "done", {
      source,
      smart,
      focusEventId: focusEventId || null
    }, {
      requestedLimit,
      settings: {
        model: linkAgent.model || "",
        useSemanticSearch: linkAgent.useSemanticSearch !== false,
        useGraphFallback: linkAgent.useGraphFallback !== false,
        minConfidence: linkAgent.minConfidence,
        timeWindowDays: linkAgent.timeWindowDays
      }
    }),
    workflowNode("timeline_events", "Load Timeline Events", "database", "done", {
      source
    }, {
      count: events.length,
      sample: events.slice(0, 3).map(compactTimelineEvent)
    }),
    workflowNode("saved_links", "Load Saved Links", "database", "done", {
      source
    }, {
      count: links.length
    }),
    workflowNode("timeline_graph_data", "Load Knowledge Graph", "database", "done", {
      source
    }, {
      eventEntities: graphData.eventEntities?.length || 0,
      graphEdges: graphData.graphEdges?.length || 0
    }),
    workflowNode("graph_scorer", "Graph Scorer", "router", "done", {
      eventEntities: graphData.eventEntities?.length || 0
    }, {
      ready: true
    }),
    workflowNode("quote_rules", "Quote Approval Rules", "router", "done", {
      focusEventId: focusEventId || null,
      limit: hasFocus ? 200 : requestedLimit
    }, {
      suggestions: baseSuggestions.length,
      focusedSuggestions: focusedBaseSuggestions.length
    }),
    workflowNode("related_fallback", "Graph Related Fallback", "router", hasFocus && linkAgent.useGraphFallback !== false ? "done" : "skipped", {
      focusEventId: focusEventId || null,
      timeWindowDays: linkAgent.timeWindowDays || 120,
      ignoredTerms: linkAgent.ignoredTerms || []
    }, {
      suggestions: relatedSuggestions.length
    }),
    workflowNode("candidate_merge", "Merge Candidates", "code", "done", {
      ruleSuggestions: focusedBaseSuggestions.length,
      relatedSuggestions: relatedSuggestions.length,
      semanticSuggestions: semanticTrace?.data?.suggestions || 0
    }, {
      candidates: focusedSuggestions.length,
      afterSemanticMerge: latestTrace(trace, "candidate_merge")?.data?.candidates || focusedSuggestions.length
    })
  ];

  if (smart) {
    nodes.push(
      workflowNode("semantic_search", "Semantic Search", "vector", linkAgent.useSemanticSearch === false ? "skipped" : semanticTrace?.status || "done", {
        enabled: linkAgent.useSemanticSearch !== false,
        topK: linkAgent.semanticTopK || 8
      }, semanticTrace?.data || {
        suggestions: 0
      }),
      workflowNode("model_review", "Model Review", "ai", modelTrace?.status || "done", {
        model: linkAgent.model || "default reranker",
        prompt: linkAgent.prompt || "",
        minConfidence: linkAgent.minConfidence
      }, modelTrace?.data || {
        candidates: focusedSuggestions.length
      }),
      workflowNode("review_filter", "Confidence Filter", "router", reviewTrace?.status || "done", {
        minConfidence: linkAgent.minConfidence
      }, reviewTrace?.data || {
        accepted: suggestions.filter((item) => item.modelStatus === "reviewed").length
      })
    );
  }

  nodes.push(
    workflowNode("link_agent_result", "Link Suggestions", "database", "done", {
      mode: smart ? "smart" : "rules",
      requestedLimit
    }, {
      suggestions: suggestions.length,
      sample: suggestions.slice(0, 5).map((item) => ({
        source_event_id: item.source_event_id,
        target_event_id: item.target_event_id,
        relation_type: item.relation_type,
        score: item.score,
        modelConfidence: item.modelConfidence || null
      }))
    })
  );

  const edges = [
    ["link_agent_start", "timeline_events"],
    ["timeline_events", "saved_links"],
    ["saved_links", "timeline_graph_data"],
    ["timeline_graph_data", "graph_scorer"],
    ["graph_scorer", "quote_rules"],
    ["quote_rules", "related_fallback"],
    ["related_fallback", "candidate_merge"],
    ...(smart
      ? [
          ["candidate_merge", "semantic_search"],
          ["semantic_search", "model_review"],
          ["model_review", "review_filter"],
          ["review_filter", "link_agent_result"]
        ]
      : [["candidate_merge", "link_agent_result"]])
  ];

  return {
    nodes,
    edges: edges.map(([from, to]) => ({ from, to })),
    trace,
    activePrompts: {
      timeline_link_agent: linkAgent.prompt || null
    }
  };
}

function workflowNode(id, label, kind, status, input, output) {
  return { id, label, kind, status, input: compactWorkflowLog(input), output: compactWorkflowLog(output) };
}

function compactWorkflowLog(value) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= 5000) return value;
  return { preview: `${text.slice(0, 5000)}...`, truncated: true };
}

function latestTrace(trace, step) {
  return [...(trace || [])].reverse().find((item) => item.step === step) || null;
}

function mergePersistedProjectInsightRun(parentRun = {}, next = {}) {
  const parentSummary = parentRun.summary && typeof parentRun.summary === "object" ? parentRun.summary : {};
  const nextSummary = next.summary && typeof next.summary === "object" ? next.summary : {};
  const parentFindings = normalizePersistedProjectFindings(parentRun);
  const nextFindings = Array.isArray(next.findings) ? next.findings : [];
  const parentInsights = normalizePersistedProjectInsights(parentRun);
  const nextInsights = Array.isArray(next.insights) ? next.insights : [];
  const parentKeys = Array.isArray(parentRun.scanned_source_keys) ? parentRun.scanned_source_keys : [];
  const nextKeys = Array.isArray(next.scannedSourceKeys) ? next.scannedSourceKeys : [];
  return {
    ...next,
    summary: {
      ...nextSummary,
      focusQuery: nextSummary.focusQuery || parentSummary.focusQuery || parentRun.focus_query || "",
      dateFrom: nextSummary.dateFrom || parentSummary.dateFrom || parentRun.date_from || null,
      dateTo: nextSummary.dateTo || parentSummary.dateTo || parentRun.date_to || null,
      totalRecords: Number(parentSummary.totalRecords || 0) + Number(nextSummary.totalRecords || 0),
      sourceCounts: mergeCountObjects(parentSummary.sourceCounts, nextSummary.sourceCounts),
      expandedRuns: Number(parentSummary.expandedRuns || 1) + 1
    },
    findings: dedupeProjectFindings([...parentFindings, ...nextFindings]),
    insights: dedupeInsightCards([...parentInsights, ...nextInsights]),
    recordsSample: [
      ...(Array.isArray(parentRun.metadata?.recordsSample) ? parentRun.metadata.recordsSample : []),
      ...(Array.isArray(next.recordsSample) ? next.recordsSample : [])
    ].slice(0, 24),
    scannedSourceKeys: [...new Set([...parentKeys, ...nextKeys].map((item) => String(item || "").trim()).filter(Boolean))],
    toolContext: next.toolContext || parentRun.tool_context || {},
    workflowLog: next.workflowLog || parentRun.workflow_log || null,
    hasMore: Boolean(next.hasMore)
  };
}

function normalizePersistedProjectFindings(run = {}) {
  if (Array.isArray(run.metadata?.findings)) return run.metadata.findings;
  if (Array.isArray(run.findings)) return run.findings;
  const legacyCards = Array.isArray(run.insights) ? run.insights : [];
  if (legacyCards.some((item) => Array.isArray(item?.supporting_finding_ids) && item.supporting_finding_ids.length)) return [];
  return legacyCards.map((item, index) => ({
    ...item,
    id: item?.id && String(item.id).startsWith("finding_") ? item.id : `legacy_finding_${index + 1}`,
    finding: item?.finding || item?.insight || "",
    statement: item?.statement || item?.finding || item?.insight || "",
    human_status: item?.human_status || "new",
    legacy: true
  }));
}

function normalizePersistedProjectInsights(run = {}) {
  const cards = Array.isArray(run.insights) ? run.insights : [];
  return cards.filter((item) => Array.isArray(item?.supporting_finding_ids) && item.supporting_finding_ids.length);
}

function mergeCountObjects(first = {}, second = {}) {
  const merged = { ...(first || {}) };
  for (const [key, value] of Object.entries(second || {})) {
    merged[key] = Number(merged[key] || 0) + Number(value || 0);
  }
  return merged;
}

function dedupeInsightCards(insights = []) {
  const seen = new Set();
  const output = [];
  for (const insight of insights || []) {
    const evidenceKey = (insight?.evidence || [])
      .map((item) => [item.source_table, item.source_id, item.id].filter(Boolean).join(":"))
      .join("|");
    const key = [insight?.category, insight?.title, evidenceKey || insight?.finding].filter(Boolean).join("::");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(insight);
  }
  return output;
}

function dedupeProjectFindings(findings = []) {
  const seen = new Set();
  const output = [];
  for (const finding of findings || []) {
    const evidenceKey = (finding?.evidence || [])
      .map((item) => [item.source_table, item.source_id, item.id].filter(Boolean).join(":"))
      .join("|");
    const key = [finding?.id, finding?.category, finding?.title, evidenceKey || finding?.finding || finding?.statement].filter(Boolean).join("::");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendText(res, status, value) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(value);
}

async function runConnectionDiagnostics(cfg, { ids = [] } = {}) {
  const contentCfg = contentSupabaseConfig(cfg);
  const savedSettings = readLocalSettings();
  const checks = [];
  const add = (id, label, group, fn) => checks.push({ id, label, group, fn });
  const inactive = (reason) => {
    const error = new Error(reason);
    error.diagnosticStatus = "inactive";
    throw error;
  };
  const requireConnection = (connection, label) => {
    if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) {
      throw new Error(`${label} URL or Service Role Key is missing`);
    }
  };
  const probeTable = async (connection, table, label) => {
    requireConnection(connection, label);
    if (!/^[A-Za-z0-9_]+$/.test(String(table || ""))) throw new Error(`${label} table is missing or invalid`);
    await rawSupabaseFetch(connection, `/rest/v1/${table}?select=*&limit=1`, { method: "HEAD" });
    return table;
  };

  add("openrouter_chat", "OpenRouter Chat", "core", async () => {
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
    const answer = await chatCompletion({
      apiKey: cfg.openRouterApiKey,
      model: cfg.models.classifier || "openai/gpt-4o-mini",
      temperature: 0,
      maxTokens: 16,
      messages: [
        { role: "system", content: "Return only OK." },
        { role: "user", content: "ping" }
      ]
    });
    return { model: cfg.models.classifier, preview: String(answer || "").slice(0, 80) };
  });

  add("openrouter_embeddings", "OpenRouter Embeddings", "core", async () => {
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
    const embedding = await createEmbedding({
      apiKey: cfg.openRouterApiKey,
      model: cfg.models.embedding,
      input: "connection test"
    });
    return { model: cfg.models.embedding, dimensions: embedding.length };
  });

  add("app_supabase_rest", "App Supabase REST", "core", async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) throw new Error("Supabase URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(cfg, "/rest/v1/chat_messages_gf?select=id&limit=1");
    return { table: "chat_messages_gf", rows: Array.isArray(rows) ? rows.length : 0 };
  });

  add("content_supabase_index_table", "APP DATA Index Table", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("APP DATA URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/${contentCfg.indexTable}?select=id&limit=1`);
    return { table: contentCfg.indexTable, rows: Array.isArray(rows) ? rows.length : 0, keyRole: supabaseKeyRole(contentCfg.supabaseServiceRoleKey) };
  });

  add("content_supabase_alerts_table", "APP DATA Alerts Table", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("APP DATA URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/${contentCfg.alertsTable}?select=id&limit=1`);
    return { table: contentCfg.alertsTable, rows: Array.isArray(rows) ? rows.length : 0, keyRole: supabaseKeyRole(contentCfg.supabaseServiceRoleKey) };
  });

  add("content_supabase_hybrid_rpc", "APP DATA Hybrid RPC", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("APP DATA URL or Service Role Key is missing");
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing because RPC test needs a query embedding");
    const embedding = await createEmbedding({
      apiKey: cfg.openRouterApiKey,
      model: cfg.models.embedding,
      input: "connection test"
    });
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/rpc/${contentCfg.hybridRpcName}`, {
      method: "POST",
      body: JSON.stringify({
        query_text: "connection test",
        query_embedding: embedding,
        match_count: 1,
        date_from: null,
        date_to: null,
        hashtags: [],
        vector_weight: cfg.retrieval.vectorWeight,
        keyword_weight: cfg.retrieval.keywordWeight
      })
    });
    return { rpc: contentCfg.hybridRpcName, rows: Array.isArray(rows) ? rows.length : 0 };
  });

  add("content_supabase_alerts_rpc", "APP DATA Alerts RPC", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("APP DATA URL or Service Role Key is missing");
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing because RPC test needs a query embedding");
    const embedding = await createEmbedding({ apiKey: cfg.openRouterApiKey, model: cfg.models.embedding, input: "connection test" });
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/rpc/${contentCfg.alertsRpcName}`, {
      method: "POST",
      body: JSON.stringify({ query_embedding: embedding, match_count: 1 })
    });
    return { rpc: contentCfg.alertsRpcName, rows: Array.isArray(rows) ? rows.length : 0 };
  });

  add("app_graph_tables", "Project Graph Tables", "data", async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) throw new Error("Supabase URL or Service Role Key is missing");
    const [nodes, edges] = await Promise.all([
      rawSupabaseFetch(cfg, "/rest/v1/graph_nodes?select=id&limit=1"),
      rawSupabaseFetch(cfg, "/rest/v1/graph_edges?select=id&limit=1")
    ]);
    return { graph_nodes: Array.isArray(nodes) ? nodes.length : 0, graph_edges: Array.isArray(edges) ? edges.length : 0 };
  });

  add("app_graph_search_rpc", "Project Graph Search RPC", "data", async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) throw new Error("Supabase URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(cfg, "/rest/v1/rpc/graph_search", {
      method: "POST",
      body: JSON.stringify({ query_text: "connection test", source_refs: [], max_rows: 1 })
    });
    return { rpc: "graph_search", rows: Array.isArray(rows) ? rows.length : 0 };
  });

  add("knowledge_base", "Local Knowledge Base", "data", async () => {
    const agents = listKnowledgeAgents();
    const documents = await listKnowledgeDocuments();
    return { agents: agents.length, documents: documents.length };
  });

  const agentModels = [
    ["classifier", "Classifier Agent", cfg.models.classifier],
    ["knowledge_planner", "Knowledge Planner Agent", cfg.models.knowledgePlanner],
    ["main", "Main Agent", cfg.models.main],
    ["lite", "Lite Agent", cfg.models.lite],
    ["reranker", "Reranker Agent", cfg.models.reranker],
    ["alert", "Alert Agent", cfg.models.alert || cfg.models.main],
    ["qa", "QA / AI Report Agent", cfg.models.qa || cfg.models.main]
  ];
  for (const [id, label, model] of agentModels) {
    add(`agent_${id}`, label, "agents", async () => {
      if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
      if (!model) throw new Error(`${label} model is missing`);
      const answer = await chatCompletion({
        apiKey: cfg.openRouterApiKey,
        model,
        temperature: 0,
        maxTokens: 8,
        timeoutMs: 30_000,
        messages: [
          { role: "system", content: "Return only OK." },
          { role: "user", content: "ping" }
        ]
      });
      return { model, preview: String(answer || "").slice(0, 40) };
    });
  }

  add("subagent_alert", "Alert Subagent", "subagents", async () => {
    const table = savedSettings.subagents?.alert?.table || contentCfg.alertsTable;
    await probeTable(contentCfg, table, "APP DATA");
    if (!cfg.openRouterApiKey) inactive("Alert Subagent is inactive: OpenRouter API Key is missing");
    return { active: true, table, model: savedSettings.subagents?.alert?.model || cfg.models.alert || cfg.models.main };
  });

  for (const [toolName, spec] of Object.entries(CONTENT_TOOL_SPECS)) {
    add(`subagent_${toolName}`, spec.label || toolName, "subagents", async () => {
      if (cfg.n8n?.runtime?.internalTools !== true) inactive("Internal subagents master switch is off");
      const settings = cfg.contentTools?.perTool?.[toolName] || {};
      if (settings.enabled === false) inactive(`${spec.label || toolName} is disabled in Settings`);
      const table = settings.table || spec.defaultTable;
      await probeTable(contentCfg, table, "APP DATA");
      if (settings.answerSynthesis !== false && !cfg.openRouterApiKey) {
        inactive(`${spec.label || toolName} is inactive: OpenRouter API Key is missing`);
      }
      return { active: true, table, answerSynthesis: settings.answerSynthesis !== false };
    });
  }

  add("subagent_meeting_evidence", "Meeting Evidence Agent", "subagents", async () => {
    if (cfg.meetingsEvidence?.enabled === false) inactive("Meeting Evidence Agent is disabled in Settings");
    const table = cfg.meetingsEvidence?.table || "meetings_documents";
    await probeTable(contentCfg, table, "APP DATA");
    if (!cfg.openRouterApiKey) inactive("Meeting Evidence Agent is inactive: OpenRouter API Key is missing");
    return { active: true, table, rpc: cfg.meetingsEvidence?.rpcName || null };
  });

  add("subagent_data_query", "Data Query Agent", "subagents", async () => {
    if (cfg.dataQuery?.enabled === false) inactive("Data Query Agent is disabled in Settings");
    await probeTable(contentCfg, contentCfg.indexTable, "APP DATA");
    return {
      active: true,
      plannerEnabled: cfg.dataQuery?.plannerEnabled !== false,
      configuredTables: Array.isArray(cfg.dataQuery?.tables) ? cfg.dataQuery.tables.length : 0
    };
  });

  add("subagent_contracts", "Contracts Agent", "subagents", async () => {
    if (cfg.contractsAgent?.enabled === false) inactive("Contracts Agent is disabled in Settings");
    if (!cfg.openRouterApiKey) inactive("Contracts Agent is inactive: OpenRouter API Key is missing");
    const contractsModel = cfg.contractsAgent?.extraction?.primaryModel || cfg.models?.main;
    if (!contractsModel) inactive("Contracts Agent is inactive: extraction model is missing");
    return {
      active: true,
      mode: "dry_run",
      model: contractsModel,
      agentVersion: CONTRACTS_AGENT_VERSION,
      pdfReaderVersion: CONTRACTS_PDF_READER_VERSION,
      maxJsonBytes: CONTRACTS_MAX_JSON_BYTES,
      maxPdfBytes: CONTRACTS_MAX_PDF_BYTES,
      maxResponseBytes: CONTRACTS_MAX_RESPONSE_BYTES,
      extractionBudgetMs: cfg.contractsAgent?.extraction?.totalBudgetMs || CONTRACTS_EXTRACTION_BUDGET_MS
    };
  });

  add("subagent_indexing", "Indexing Agent", "subagents", async () => {
    await probeTable(contentCfg, contentCfg.indexTable, "APP DATA");
    if (!cfg.openRouterApiKey) inactive("Indexing Agent is inactive: OpenRouter API Key is missing");
    return { active: true, mode: cfg.indexing?.autoIndexing ? "automatic" : "manual", targetTable: contentCfg.indexTable };
  });

  add("subagent_schedule", "Schedule Agent", "subagents", async () => {
    const projects = await listScheduleProjects({ config: cfg });
    return { active: true, source: "MAIN", projects: projects.length, tables: ["gantt_files_test", "gantt_tasks_test"] };
  });

  add("subagent_schedule_conditions", "Schedule Condition Resolver", "subagents", async () => {
    const table = scheduleSettings().conditionsTable;
    await probeTable(contentCfg, table, "APP DATA");
    if (!settingsOpenRouterApiKey()) inactive("Schedule Condition Resolver is inactive: a Settings-owned OpenRouter API Key is missing");
    return { active: true, table };
  });

  add("subagent_project_insights", "Project Insights Agent", "subagents", async () => {
    if (cfg.insights?.evidencePipeline === false) inactive("Project Insights evidence pipeline is disabled");
    await probeTable(contentCfg, contentCfg.indexTable, "APP DATA");
    return { active: true, evidencePipeline: true, rootCauseHypotheses: cfg.insights?.rootCauseHypotheses === true };
  });

  add("subagent_graph_enrichment", "Graph Enrichment Agent", "subagents", async () => {
    if (cfg.graph?.enabled === false) inactive("Project Graph is disabled in Settings");
    await probeTable(cfg, "graph_nodes", "App DB");
    return { active: true, automatic: cfg.insights?.graphEnrichment === true, mode: cfg.insights?.graphEnrichment ? "automatic" : "manual" };
  });

  add("subagent_delay_claim", "Delay Claim Agent", "subagents", async () => {
    await probeTable(cfg, "delay_claim_cases", "App DB");
    return { active: true, table: "delay_claim_cases", mode: "manual" };
  });

  for (const toolName of TOOL_NAMES) {
    add(`tool_${toolName}`, diagnosticToolLabel(toolName), "tools", async () => {
      const result = isInternalContentTool(toolName, cfg)
        ? await callInternalContentTool({ config: cfg, toolName, query: "בדיקת חיבור" })
        : await callN8nTool({
            toolName,
            query: "connection test",
            sessionId: "diagnostic",
            config: cfg
          });
      if (!result.ok) throw new Error(result.error || `${toolName} test failed`);
      return { tool: toolName, configured: true, internal: result.internal || false, preview: summarizeDiagnosticToolResult(result) };
    });
  }

  const selected = ids.length ? checks.filter((check) => ids.includes(check.id)) : checks;
  return runDiagnosticChecks(selected, 4);
}

async function runDiagnosticChecks(checks, parallelLimit = 4) {
  const results = new Array(checks.length);
  let cursor = 0;
  async function worker() {
    while (cursor < checks.length) {
      const index = cursor++;
      const check = checks[index];
      results[index] = await diagnosticCheck(check.id, check.label, check.group, check.fn);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelLimit, checks.length) }, worker));
  return results;
}

async function diagnosticCheck(id, label, group, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    return { id, label, group, ok: true, status: "ok", ms: Date.now() - startedAt, details };
  } catch (error) {
    const errorText = diagnosticErrorText(error);
    return {
      id,
      label,
      group,
      ok: false,
      status: error?.diagnosticStatus || classifyDiagnosticError(errorText),
      ms: Date.now() - startedAt,
      error: errorText
    };
  }
}

function diagnosticToolLabel(toolName) {
  return ({
    alert: "N8N Alerts",
    meetings: "N8N Meetings",
    emails: "N8N Emails",
    whatsapp_messages: "N8N WhatsApp",
    financial_transactions: "N8N Financial",
    consultants_reports: "N8N Consultants",
    exceptions_report: "N8N Exceptions",
    quality_control: "N8N Quality",
    safety_report: "N8N Safety",
    submittals: "N8N Submittals"
  })[toolName] || `N8N ${toolName}`;
}

function summarizeDiagnosticToolResult(result) {
  if (Array.isArray(result?.data)) return `${result.data.length} rows`;
  if (result?.answer) return String(result.answer).slice(0, 80);
  return result?.data ? "Response received" : "OK";
}

async function rawSupabaseFetch(cfg, path, options = {}) {
  const response = await fetch(`${cfg.supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(cfg.supabaseServiceRoleKey),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return data;
}

function classifyDiagnosticError(message) {
  const value = String(message || "");
  if (/OPENROUTER_API_KEY|User not found|No auth credentials|unauthorized|forbidden|401|403/i.test(value)) return "auth_error";
  if (/credit|quota|insufficient/i.test(value)) return "billing_or_quota";
  if (/could not find|PGRST202|function|rpc|schema cache/i.test(value)) return "missing_rpc_or_schema";
  if (/relation|table|column/i.test(value)) return "missing_table_or_column";
  if (/Supabase URL|Service Role/i.test(value)) return "missing_config";
  if (/EACCES|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(value)) return "network_error";
  return "error";
}

function diagnosticErrorText(error) {
  const parts = [error?.message || String(error)];
  const causes = Array.isArray(error?.cause?.errors) ? error.cause.errors : error?.cause ? [error.cause] : [];
  for (const cause of causes) {
    const code = cause?.code || cause?.name || "";
    const message = cause?.message || "";
    const text = [code, message].filter(Boolean).join(": ");
    if (text && !parts.includes(text)) parts.push(text);
  }
  return parts.join(" | ");
}

function summarizeEvaluationCase({ index, testCase, output, runId }) {
  const expectedTools = parseArray(testCase.expectedTools || []);
  const actualTools = [...new Set((output.toolCalls || []).map((call) => call.toolName))];
  const checks = {
    type: !testCase.expectedType || output.type === testCase.expectedType,
    professional: testCase.expectedProfessional == null || Boolean(output.classification?.professional) === Boolean(testCase.expectedProfessional),
    tools: !expectedTools.length || expectedTools.every((tool) => actualTools.includes(tool)),
    answer: Boolean(String(output.answer || "").trim()),
    sources: testCase.requireSources ? Boolean(output.sources?.length) : true,
    noConflicts: testCase.allowConflicts === false ? !output.conflicts?.length : true
  };
  return {
    index,
    runId,
    message: testCase.message,
    ok: Object.values(checks).every(Boolean),
    checks,
    expected: {
      type: testCase.expectedType || null,
      professional: testCase.expectedProfessional ?? null,
      tools: expectedTools,
      requireSources: Boolean(testCase.requireSources)
    },
    actual: {
      type: output.type,
      professional: Boolean(output.classification?.professional),
      tools: actualTools,
      answerLength: String(output.answer || "").length,
      sourceQuality: output.sourceQuality,
      conflicts: output.conflicts || []
    }
  };
}

function parseArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
}

function scheduleServerRestart() {
  if (!httpServer) return;
  setTimeout(() => {
    httpServer.close(() => {
      const child = spawn(process.execPath, [process.argv[1]], {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        env: process.env
      });
      child.unref();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1500);
  }, 300);
}

function fallbackOpenRouterModels() {
  return [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4.1",
    "openai/gpt-4.1-mini",
    "openai/o3-mini",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.0-flash-001",
    "google/gemini-2.5-pro",
    "meta-llama/llama-3.3-70b-instruct",
    "mistralai/mistral-large"
  ].map((id) => ({ id, name: id, contextLength: null, pricing: null }));
}
