// Shared by the tests that drive the real HTTP handler under a fake network
// (company-db-isolation.tests.js, settings-from-meta.tests.js).
import { Readable } from "node:stream";

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

// Fake network: records every call's origin and answers OpenRouter and any
// Supabase REST call. `route` may override per call.
export function installFakeFetch(route = () => null) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input?.url || input);
    const parsed = new URL(url);
    const call = {
      url,
      origin: parsed.origin,
      method: String(options.method || "GET").toUpperCase(),
      headers: options.headers || {},
      body: typeof options.body === "string" ? safeJson(options.body) : null
    };
    calls.push(call);
    const custom = await route(call);
    if (custom) return custom;
    if (parsed.hostname === "openrouter.ai") {
      if (parsed.pathname.endsWith("/embeddings")) return jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify({ type: "RAG", complexity: "SPECIFIC", urgency: "NORMAL", answer: "ok" }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      });
    }
    return jsonResponse([], 200, { "content-range": "*/0" });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function fakeReq({ method = "POST", url, headers = {}, body = null }) {
  const req = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

export function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    chunks: [],
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); return this; },
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end(chunk = "") { if (chunk) this.chunks.push(String(chunk)); this.ended = true; }
  };
  return res;
}

export function bodyOf(res) {
  const text = res.chunks.join("");
  try { return JSON.parse(text); } catch { return text; }
}

