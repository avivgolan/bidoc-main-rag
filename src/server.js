import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, loadEnv, publicSettings, TOOL_NAMES, writeLocalSettings } from "./config.js";
import { runChatPipeline } from "./agent.js";
import { hybridSearch, listMessages, listSessions } from "./supabase.js";
import { callN8nTool } from "./tools.js";
import { createRun, failRun, subscribeRun } from "./runLog.js";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const config = () => getConfig();

const server = http.createServer(async (req, res) => {
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
});

server.listen(config().port, () => {
  console.log(`bidoc agent running at http://localhost:${config().port}`);
});

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

  const messagesMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (req.method === "GET" && messagesMatch) {
    const messages = await listMessages({ config: config(), sessionId: decodeURIComponent(messagesMatch[1]) }).catch(() => []);
    return sendJson(res, 200, { messages });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    return sendJson(res, 200, publicSettings(config()));
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readJson(req);
    const saved = writeLocalSettings(body);
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
