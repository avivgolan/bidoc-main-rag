import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { getConfig, initSettings, loadEnv, publicSettings, readLocalSettings, refreshSettingsIfStale, reloadSettingsFromDb, TOOL_NAMES, writeLocalSettings } from "./config.js";
import { buildAgentList } from "./prompts.js";
import { chatCompletion, createEmbedding, listOpenRouterModels } from "./openrouter.js";
import { runChatPipeline } from "./agent.js";
import { annotateMessage, fetchAlertsTimelineEvents, fetchTimelineEvents, getMessage, getLatestQaReport, hybridSearch, listDislikedMessages, listMessages, listQaReports, listSessions, saveQaReport } from "./supabase.js";
import { runQaAgent, runQaTrendAnalysis } from "./qaAgent.js";
import { callN8nTool } from "./tools.js";
import { runAlertAgent } from "./subagents/alert.js";
import { createRun, failRun, subscribeRun } from "./runLog.js";
import { deleteKnowledgeDocument, listKnowledgeAgents, listKnowledgeDocuments, readKnowledgeDocument, saveKnowledgeDocument, searchKnowledgeBase } from "./knowledge.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const config = () => getConfig();

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
    console.log(`[startup] Supabase   : ${cfg.supabaseUrl ? "✓ configured" : "✗ MISSING"}`);
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
      const output = await runChatPipeline({ message: body.message, sessionId, config: config(), runId });
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
    const results = await runConnectionDiagnostics(config());
    return sendJson(res, 200, {
      ok: results.every((item) => item.ok),
      results
    });
  }

  const messagesMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (req.method === "GET" && messagesMatch) {
    const messages = await listMessages({ config: config(), sessionId: decodeURIComponent(messagesMatch[1]) }).catch(() => []);
    return sendJson(res, 200, { messages });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    return sendJson(res, 200, publicSettings(config()));
  }

  if (req.method === "POST" && url.pathname === "/api/settings/reload") {
    await reloadSettingsFromDb();
    return sendJson(res, 200, { settings: publicSettings(config()) });
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
    if (req.method === "GET") {
      const document = await readKnowledgeDocument(filename, { agentId });
      return sendJson(res, 200, { document });
    }
    if (req.method === "DELETE") {
      const deleted = await deleteKnowledgeDocument(filename, { agentId });
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
    const body = await readJson(req);
    const prompts = body.prompts || {};
    const models = body.models || {};
    const current = readLocalSettings();
    await writeLocalSettings({ ...current, prompts, models: { ...(current.models || {}), ...models } });
    return sendJson(res, 200, { agents: buildAgentList(config()) });
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readJson(req);
    const saved = await writeLocalSettings(body);
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
    const agentId = decodeURIComponent(subagentConfigMatch[1]);
    const body = await readJson(req);
    const current = readLocalSettings();
    const updated = {
      ...current,
      subagents: {
        ...(current.subagents || {}),
        [agentId]: {
          table: body.table || "",
          model: body.model || "",
          systemPrompt: body.systemPrompt || ""
        }
      }
    };
    const saved = await writeLocalSettings(updated);
    return sendJson(res, 200, { ok: true, config: saved.subagents?.[agentId] });
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


  if (req.method === "GET" && url.pathname === "/api/qa/dislikes") {
    const messages = await listDislikedMessages({ config: config() }).catch(() => []);
    return sendJson(res, 200, { messages });
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
  res.writeHead(200, { "Content-Type": contentType });
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

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendText(res, status, value) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(value);
}

async function runConnectionDiagnostics(cfg) {
  const results = [];
  results.push(await diagnosticCheck("openrouter_chat", "OpenRouter Chat", async () => {
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
  }));

  results.push(await diagnosticCheck("openrouter_embeddings", "OpenRouter Embeddings", async () => {
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
    const embedding = await createEmbedding({
      apiKey: cfg.openRouterApiKey,
      model: cfg.models.embedding,
      input: "connection test"
    });
    return { model: cfg.models.embedding, dimensions: embedding.length };
  }));

  results.push(await diagnosticCheck("supabase_rest", "Supabase REST", async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) throw new Error("Supabase URL or Service Role Key is missing");
    const rows = await rawSupabaseFetch(cfg, "/rest/v1/chat_messages_gf?select=id&limit=1");
    return { table: "chat_messages_gf", rows: Array.isArray(rows) ? rows.length : 0 };
  }));

  results.push(await diagnosticCheck("supabase_hybrid_rpc", "Supabase Hybrid RPC", async () => {
    if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) throw new Error("Supabase URL or Service Role Key is missing");
    if (!cfg.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing because RPC test needs a query embedding");
    const embedding = await createEmbedding({
      apiKey: cfg.openRouterApiKey,
      model: cfg.models.embedding,
      input: "connection test"
    });
    const rows = await rawSupabaseFetch(cfg, `/rest/v1/rpc/${cfg.retrieval.rpcName}`, {
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
    return { rpc: cfg.retrieval.rpcName, rows: Array.isArray(rows) ? rows.length : 0 };
  }));

  return results;
}

async function diagnosticCheck(id, label, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    return { id, label, ok: true, status: "ok", ms: Date.now() - startedAt, details };
  } catch (error) {
    return {
      id,
      label,
      ok: false,
      status: classifyDiagnosticError(error.message),
      ms: Date.now() - startedAt,
      error: error.message
    };
  }
}

async function rawSupabaseFetch(cfg, path, options = {}) {
  const response = await fetch(`${cfg.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: cfg.supabaseServiceRoleKey,
      Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
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
  return "error";
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
