import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { exportFullSettings, getConfig, initSettings, loadEnv, previewImportedSettingsFile, publicSettings, readLocalSettings, refreshSettingsIfStale, reloadSettingsFromDb, supabaseHeaders, supabaseKeyRole, TOOL_NAMES, writeLocalSettings } from "./config.js";
import { buildAgentList } from "./prompts.js";
import { chatCompletion, createEmbedding, extractJsonObject, listOpenRouterModels, summarizeOpenRouterUsage } from "./openrouter.js";
import { runChatPipeline } from "./agent.js";
import { addDelayEventChangeLog, addDelayEventEvidence, addDelayEventGap, annotateMessage, contentSupabaseConfig, createDelayClaim, createDelayEvent, createTimelineEventLink, deleteTimelineEventLink, fetchAlertsTimelineEvents, fetchTimelineEventPage, fetchTimelineEvents, getMessage, getLatestQaReport, getProjectInsightRun, graphSearch, hybridSearch, listDelayClaims, listDelayEvents, listDislikedMessages, listMessages, listProjectGraph, listProjectInsightRuns, listQaMessages, listQaReports, listRunHistory, listSessions, listTimelineEventLinks, listTimelineGraphData, parseTimelineEventsQuery, saveProjectInsightRun, saveQaReport, TimelineRequestError, updateDelayEvent, updateMessage, upsertProjectGraphData, upsertTimelineGraphData } from "./supabase.js";
import { buildTimelineLinkSuggestions, buildTimelineSuggestionFromEvents, eventTitle, isTimelineApprovalEvent, isTimelineEventAfter, isTimelineQuoteEvent, mergeTimelineSuggestions, normalizeTimelineSource, timelineEventText } from "./timelineLinks.js";
import { buildEntityGraphRowsForEvents, buildTimelineKnowledgeGraph, createTimelineGraphScorer } from "./timelineGraph.js";
import { runQaAgent, runQaTrendAnalysis } from "./qaAgent.js";
import { callN8nTool } from "./tools.js";
import { runAlertAgent } from "./subagents/alert.js";
import { buildDataQueryWorkflowLog, DATA_QUERY_PIPELINE_STEPS, introspectSupabaseTables, runDataQueryAgent, runDataQueryPipeline, runDataQueryStep } from "./subagents/dataQuery.js";
import { runDelayClaimAnalysis, runDelayClaimPackageAnalysis, runDelayEventDeepAnalysis } from "./subagents/delayClaim.js";
import { runProjectInsightsAnalysis } from "./subagents/projectInsights.js";
import { completeRun, createRun, emitRunEvent, failRun, getRunEvents, listLocalRunHistory, recordRunHistory, subscribeRun } from "./runLog.js";
import { deleteKnowledgeDocument, listKnowledgeAgents, listKnowledgeDocuments, readKnowledgeDocument, saveKnowledgeDocument, searchKnowledgeBase } from "./knowledge.js";
import { buildGraphRowsFromRecords, buildGraphSearchPayload, summarizeGraphContext } from "./projectGraph.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const config = () => getConfig();

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
  if (!url && !key) return base;
  return {
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
    serveStatic(res, url.pathname);
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
    console.log(`[startup] Content DB : ${cfg.contentSource?.supabaseUrl ? "✓ configured" : "✗ MISSING"}`);
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

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await readJson(req);
    if (!body.message) return sendJson(res, 400, { error: "message is required" });
    const sessionId = body.sessionId || `session_${Date.now()}`;
    const runId = body.runId || `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    try {
      const output = await runChatPipeline({
        message: body.message,
        sessionId,
        config: config(),
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
    const dbRuns = await listRunHistory({ config: config(), limit }).catch(() => []);
    const localRuns = listLocalRunHistory({ limit });
    const runs = [...localRuns, ...dbRuns]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
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
    const runId = body.runId || `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createRun(runId);
    const excludedSourceKeys = Array.isArray(body.excludeSourceKeys) ? body.excludeSourceKeys : [];
    const parentRunId = body.parentRunId || body.parent_run_id || null;
    try {
      const result = await runProjectInsightsAnalysis({
        config: cfg,
        focusQuery: body.focusQuery || body.query || "",
          dateFrom: body.dateFrom || body.date_from || null,
          dateTo: body.dateTo || body.date_to || null,
          limit: body.limit || 350,
          excludeSourceKeys: excludedSourceKeys,
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
            expansionRuns: Array.isArray(result.expansionRuns) ? result.expansionRuns.map((item) => item.runId).filter(Boolean) : []
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

  if (req.method === "POST" && url.pathname === "/api/subagents/data-query/step") {
    const body = await readJson(req).catch(() => ({}));
    const step = String(body.step || "").trim();
    if (!DATA_QUERY_PIPELINE_STEPS.some((s) => s.id === step)) {
      return sendJson(res, 400, { error: `unknown step "${step}"`, steps: DATA_QUERY_PIPELINE_STEPS });
    }
    const state = {
      ...(body.state && typeof body.state === "object" ? body.state : {}),
      question: body.question ?? body.state?.question ?? "",
      context: body.context ?? body.state?.context ?? {}
    };
    const calls = [];
    const telemetry = { step: "data_query", callId: `dq_${step}`, record: (entry) => calls.push(entry) };
    try {
      const result = await runDataQueryStep({ step, state, config: config(), telemetry });
      return sendJson(res, 200, { step, output: result.output, state: result.state, openRouterUsage: summarizeOpenRouterUsage(calls) });
    } catch (error) {
      return sendJson(res, 200, { step, status: "error", error: error.message, state, openRouterUsage: summarizeOpenRouterUsage(calls) });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/subagents/data-query/pipeline") {
    const body = await readJson(req).catch(() => ({}));
    const question = String(body.question || body.query || "").trim();
    const context = {
      ...(body.context && typeof body.context === "object" ? body.context : {}),
      dateFrom: body.dateFrom || body.date_from || body.context?.dateFrom || null,
      dateTo: body.dateTo || body.date_to || body.context?.dateTo || null,
      source: body.source || body.context?.source || "api"
    };
    const runId = String(body.runId || `dqp_${Date.now()}_${Math.random().toString(16).slice(2)}`);
    createRun(runId);
    emitRunEvent(runId, "chat_input", "שאלת בדיקה התקבלה", { question, context });
    const calls = [];
    const telemetry = { step: "data_query", callId: "dqp", record: (entry) => { calls.push(entry); emitRunEvent(runId, "data_query", "OpenRouter usage recorded", { openrouter: entry }); } };
    try {
      const result = await runDataQueryPipeline({
        question, context, config: config(), telemetry,
        onStep: (entry) => emitRunEvent(runId, "data_query", `${entry.label}: ${entry.status}`, { step: entry.id, status: entry.status, error: entry.error || null })
      });
      completeRun(runId, { status: result.status });
      recordRunHistory({ id: runId, title: `סוכן שאילתות (SQL) · ${(question || "בדיקה").slice(0, 40)}`, runEvents: getRunEvents(runId), kind: "data_query" });
      return sendJson(res, result.status === "error" ? 200 : 200, { ...result, runId, openRouterUsage: summarizeOpenRouterUsage(calls) });
    } catch (error) {
      failRun(runId, error);
      return sendJson(res, 500, { status: "error", error: error.message, steps: [], runId });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/subagents/data-query/schema") {
    const cfg = config();
    const contentConn = contentSupabaseConfig(cfg);
    // The Data Query Agent is restricted to the content connection only.
    const targets = [
      { key: "content", label: "מאגר תוכן", supabaseUrl: contentConn.supabaseUrl, supabaseServiceRoleKey: contentConn.supabaseServiceRoleKey }
    ];
    const connections = [];
    const warnings = [];
    const seenUrls = new Set();
    for (const target of targets) {
      if (!target.supabaseUrl || !target.supabaseServiceRoleKey) {
        warnings.push(`${target.key}: Supabase לא מוגדר`);
        continue;
      }
      if (seenUrls.has(target.supabaseUrl)) continue;
      seenUrls.add(target.supabaseUrl);
      try {
        const tables = await introspectSupabaseTables({ supabaseUrl: target.supabaseUrl, supabaseServiceRoleKey: target.supabaseServiceRoleKey });
        connections.push({ key: target.key, label: target.label, schema: "public", tables });
      } catch (error) {
        warnings.push(`${target.key}: ${error.message}`);
      }
    }
    return sendJson(res, connections.length ? 200 : 502, { connections, warnings });
  }

  if (req.method === "POST" && url.pathname === "/api/subagents/data-query") {
    const body = await readJson(req).catch(() => ({}));
    const question = body.question || body.query || "";
    const dqContext = {
      ...(body.context && typeof body.context === "object" ? body.context : {}),
      dateFrom: body.dateFrom || body.date_from || body.context?.dateFrom || body.context?.date_from || null,
      dateTo: body.dateTo || body.date_to || body.context?.dateTo || body.context?.date_to || null,
      source: body.source || body.context?.source || "api"
    };
    const runId = String(body.runId || body.run_id || `dq_${Date.now()}_${Math.random().toString(16).slice(2)}`);
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
        maxPlans: body.maxPlans,
        queryPlan: body.queryPlan || body.query_plan || null,
        telemetry: dqTelemetry
      });
      emitRunEvent(runId, "data_query", `תכנון באמצעות ${result.planner || "unknown"}`, {
        planner: result.planner || "unknown",
        plansProposed: (result.queryPlan?.plans || []).length
      });
      emitRunEvent(runId, "data_query", "אימות תוכניות שאילתה", { accepted: result.plans?.length || 0 });
      for (const plan of result.plans || []) {
        emitRunEvent(runId, "data_query", `הרצת ${plan.table}`, { id: plan.id, table: plan.table, status: plan.status, rows: plan.rows });
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
    return sendJson(res, 200, { ok: true, source, events: events.length, ...saved, projectGraph: projectSaved });
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

function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
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
        content: [
          linkAgent.prompt || "You verify timeline event links for a construction project.",
          "Return ONLY valid JSON with the requested schema. Do not include markdown."
        ].join(" ")
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
  const checks = [];
  const add = (id, label, group, fn) => checks.push({ id, label, group, fn });

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

  add("content_supabase_index_table", "Content Supabase Index Table", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("Content Supabase URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/${contentCfg.indexTable}?select=id&limit=1`);
    return { table: contentCfg.indexTable, rows: Array.isArray(rows) ? rows.length : 0, keyRole: supabaseKeyRole(contentCfg.supabaseServiceRoleKey) };
  });

  add("content_supabase_alerts_table", "Content Supabase Alerts Table", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("Content Supabase URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(contentCfg, `/rest/v1/${contentCfg.alertsTable}?select=id&limit=1`);
    return { table: contentCfg.alertsTable, rows: Array.isArray(rows) ? rows.length : 0, keyRole: supabaseKeyRole(contentCfg.supabaseServiceRoleKey) };
  });

  add("content_supabase_hybrid_rpc", "Content Supabase Hybrid RPC", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("Content Supabase URL or Service Role Key is missing");
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

  add("content_supabase_alerts_rpc", "Content Supabase Alerts RPC", "data", async () => {
    if (!contentCfg.supabaseUrl || !contentCfg.supabaseServiceRoleKey) throw new Error("Content Supabase URL or Service Role Key is missing");
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

  for (const toolName of TOOL_NAMES) {
    add(`tool_${toolName}`, diagnosticToolLabel(toolName), "tools", async () => {
      const result = await callN8nTool({
        toolName,
        query: "connection test",
        sessionId: "diagnostic",
        config: cfg
      });
      if (!result.ok) throw new Error(result.error || `${toolName} test failed`);
      return { tool: toolName, configured: true, preview: summarizeDiagnosticToolResult(result) };
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
      status: classifyDiagnosticError(errorText),
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
