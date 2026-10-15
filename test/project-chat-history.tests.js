import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { summarizeEarlierTurns, toConversationTurns } from "../src/projectChatHistory.js";

// Project chat builds its conversation context from BiDoc's own chat in the
// request Project's Company DB (chat_sessions + chat_messages) and stores
// nothing: no MAIN memory read or write. These tests drive the real HTTP
// handler under a fake network that records every call.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const COMPANY_A = "https://company-a.supabase.test";
const COMPANY_B = "https://company-b.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const APP_DB = "https://app-db.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";

const TEST_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  SUPABASE_URL: APP_DB,
  SUPABASE_SERVICE_ROLE_KEY: "app-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key",
  META_SUPABASE_URL: undefined,
  META_SUPABASE_SERVICE_ROLE_KEY: undefined
};

const MAIN_MEMORY_PATHS = /\/rest\/v1\/(chat_session_memory|chat_memory_items)|\/rest\/v1\/rpc\/match_chat_memory/;

function companyHeaders({ url = COMPANY_A, key = "company-a-key", projectId = PROJECT_A, extra = {} } = {}) {
  return {
    host: "main-agent.test",
    "content-type": "application/json",
    "x-bidoc-api-secret": BIDOC_SECRET,
    "x-content-supabase-url": url,
    "x-content-supabase-key": key,
    "x-project-id": projectId,
    ...extra
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// A tiny PostgREST stand-in for one Company DB's chat tables. It filters on
// session_id / project_id like the real REST API, honours order and limit, and
// rejects a select of a column the table does not have (an unmigrated Company
// DB such as Kapaim's).
function companyChatDb({ origin, sessions, messages, messageColumns = ["id", "session_id", "role", "content", "created_at", "metadata", "agent_message_id", "annotation"], failMessages = false }) {
  const sessionColumns = ["id", "session_id", "project_id", "user_id", "title", "created_at", "updated_at"];
  return (call) => {
    if (call.origin !== origin || call.method !== "GET") return null;
    const url = new URL(call.url);
    const table = url.pathname.replace("/rest/v1/", "");
    if (table !== "chat_sessions" && table !== "chat_messages") return null;
    if (table === "chat_messages" && failMessages) return jsonResponse({ message: "boom" }, 500);
    const allowed = table === "chat_sessions" ? sessionColumns : messageColumns;
    const select = (url.searchParams.get("select") || "*").split(",").map((item) => item.trim());
    const unknown = select.filter((column) => column !== "*" && !allowed.includes(column));
    if (unknown.length) return jsonResponse({ code: "42703", message: `column ${table}.${unknown[0]} does not exist` }, 400);
    let rows = (table === "chat_sessions" ? sessions : messages).filter((row) => {
      for (const [key, value] of url.searchParams) {
        if (!value.startsWith("eq.")) continue;
        if (String(row[key]) !== value.slice(3)) return false;
      }
      return true;
    });
    const order = url.searchParams.get("order");
    if (order) {
      const keys = order.split(",").map((part) => part.split("."));
      rows = [...rows].sort((a, b) => {
        for (const [column, direction] of keys) {
          if (a[column] === b[column]) continue;
          const result = a[column] > b[column] ? 1 : -1;
          return direction === "desc" ? -result : result;
        }
        return 0;
      });
    }
    const limit = Number(url.searchParams.get("limit"));
    if (limit > 0) rows = rows.slice(0, limit);
    const columns = select.includes("*") ? allowed : select;
    return jsonResponse(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))));
  };
}

const isOpenRouterChat = (call) => call.origin === "https://openrouter.ai" && call.url.endsWith("/chat/completions");
const isClassifierCall = (call) => isOpenRouterChat(call) && /standalone_query/.test(String(call.body?.messages?.[0]?.content || ""));
const isSummaryCall = (call) => isOpenRouterChat(call) && /EARLIER part of a conversation/.test(String(call.body?.messages?.[0]?.content || ""));
const callText = (call) => (call.body?.messages || []).map((message) => String(message.content)).join("\n---\n");

// Fake network: records every call. The classifier answers CHAT so the Lite
// Agent (which receives the conversation memory) answers; the summary call
// answers with a recognisable summary.
function installFakeFetch(route = () => null) {
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
      const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };
      if (isSummaryCall(call)) {
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ active_topics: ["SUMMARY-TOPIC-ELEVATORS"], date_context: [], open_questions: [], last_intent: "elevator approvals" }) } }], usage });
      }
      if (isClassifierCall(call)) {
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ type: "CHAT", complexity: "SPECIFIC", urgency: "NORMAL", standalone_query: "When was the elevator submittal approved?" }) } }], usage });
      }
      return jsonResponse({ choices: [{ message: { content: "It was approved on 3 June." } }], usage });
    }
    if (parsed.origin === APP_DB && call.method === "POST" && parsed.pathname.endsWith("/chat_messages_gf")) {
      return jsonResponse([{ id: 901, session_id: call.body?.session_id, status: "processing" }]);
    }
    return jsonResponse([], 200, { "content-range": "*/0" });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function fakeReq({ method = "POST", url, headers = {}, body = null }) {
  const req = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); return this; },
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end(chunk = "") { if (chunk) this.chunks.push(String(chunk)); this.ended = true; }
  };
}

let serverModule = null;
let savedEnv = null;

async function withServer(fn, { route } = {}) {
  if (!savedEnv) {
    savedEnv = {};
    for (const [key, value] of Object.entries(TEST_ENV)) {
      savedEnv[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const fake = installFakeFetch(route);
  try {
    serverModule ||= await import("../src/server.js");
    return await fn({ handler: serverModule.default, calls: fake.calls });
  } finally {
    fake.restore();
  }
}

function restoreEnv() {
  if (!savedEnv) return;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = null;
}

async function chat(handler, { headers = companyHeaders(), projectId = PROJECT_A, sessionId, message }) {
  const res = fakeRes();
  await handler(fakeReq({ url: "/api/chat", headers, body: { message, sessionId, projectId } }), res);
  const text = res.chunks.join("");
  return { status: res.statusCode, body: safeJson(text) ?? text };
}

let nextId = 1;
const row = (sessionId, role, content, minute) => ({
  id: nextId++,
  session_id: sessionId,
  role,
  content,
  created_at: `2026-10-15T09:${String(minute).padStart(2, "0")}:00Z`
});

const homeConversation = (sessionId) => [
  row(sessionId, "human", "Who approved the elevator submittal?", 1),
  row(sessionId, "ai", "The elevator submittal was approved by Dana.", 2),
  // BiDoc saves the question being asked right now before calling main-agent.
  row(sessionId, "human", "And when was it approved?", 3)
];

const contactedMainMemory = (calls) => calls.filter((call) => call.origin === APP_DB && MAIN_MEMORY_PATHS.test(call.url));

export function registerProjectChatHistoryTests(test) {
  test("project chat history: BiDoc's roles map to turns, the in-flight question and error bubbles are dropped", () => {
    const rows = [
      { role: "human", content: "first question" },
      { role: "ai", content: "first answer" },
      { role: "human", content: "second question" },
      { role: "ai", content: "שגיאה בקבלת תשובה מה-AI. אנא נסה שוב." },
      { role: "human", content: "second question" },
      { role: "ai", content: "שגיאה בקבלת תשובה מה-AI. אנא נסה שוב." },
      { role: "system", content: "ignored" },
      { role: "user", content: "   " },
      { role: "human", content: "  third question  " }
    ];
    assert.deepEqual(toConversationTurns(rows, { currentMessage: "third question" }), [
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" }
    ]);
    // A trailing human message that is not the current question stays.
    assert.deepEqual(toConversationTurns([{ role: "human", content: "earlier" }], { currentMessage: "now" }), [{ role: "user", content: "earlier" }]);
    assert.deepEqual(toConversationTurns(null, { currentMessage: "x" }), []);
  });

  test("project chat history: without a model the older turns still get a deterministic summary", async () => {
    const turns = [
      { role: "user", content: "מה המצב עם המעלית בקומה 3?" },
      { role: "assistant", content: "המעלית עדיין ממתינה לאישור." }
    ];
    const result = await summarizeEarlierTurns({ config: { openRouterApiKey: "", models: {} }, turns });
    assert.equal(result.source, "local");
    assert.deepEqual(result.summary.active_topics, ["מעליות", "אישורים"]);
  });

  test("project chat history: a follow-up gets the session's earlier turns from the Company DB, not from MAIN", async () => {
    const sessionId = "sess-follow";
    const route = companyChatDb({
      origin: COMPANY_A,
      sessions: [{ session_id: sessionId, project_id: PROJECT_A, user_id: "u1" }],
      messages: homeConversation(sessionId)
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "And when was it approved?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      const seen = calls.slice(start);

      // The classifier and the answering agent both saw the earlier turns once.
      const classifier = seen.find(isClassifierCall);
      assert.match(callText(classifier), /USER: Who approved the elevator submittal\?/);
      assert.match(callText(classifier), /ASSISTANT: The elevator submittal was approved by Dana\./);
      const agent = seen.filter(isOpenRouterChat).find((call) => !isClassifierCall(call) && !isSummaryCall(call));
      assert.ok(agent, "the Lite Agent answered");
      assert.match(callText(agent), /Who approved the elevator submittal\?/);
      assert.match(callText(agent), /approved by Dana/);
      // The question being asked is not repeated as history.
      const occurrences = (callText(agent).match(/And when was it approved\?/g) || []).length;
      assert.equal(occurrences, 0, "the in-flight question is the user message, not history (the rewritten standalone query is sent)");

      // History came from the Company DB tables, scoped by session and Project.
      const sessionRead = seen.find((call) => call.origin === COMPANY_A && call.url.includes("/rest/v1/chat_sessions"));
      assert.ok(sessionRead, "the session was looked up in the Company DB");
      assert.match(sessionRead.url, new RegExp(`project_id=eq.${PROJECT_A}`));
      assert.match(sessionRead.url, new RegExp(`session_id=eq.${sessionId}(?:&|$)`), "BiDoc's own session id, not the bidoc:<project>: tag");
      const messageRead = seen.find((call) => call.origin === COMPANY_A && call.url.includes("/rest/v1/chat_messages"));
      assert.ok(messageRead, "the session's messages were read from the Company DB");
      assert.match(messageRead.url, new RegExp(`session_id=eq.${sessionId}(?:&|$)`));
    }, { route });
  });

  test("project chat history: Project chat reads and writes no MAIN memory and no MAIN history", async () => {
    const sessionId = "sess-nomain";
    const route = companyChatDb({
      origin: COMPANY_A,
      sessions: [{ session_id: sessionId, project_id: PROJECT_A, user_id: "u1" }],
      messages: homeConversation(sessionId)
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const asked = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "And when was it approved?" });
      assert.equal(asked.status, 200);
      // "remember ..." is an ordinary message in Project mode; it must not save a memory item.
      const remember = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "Remember that I prefer short answers" });
      assert.equal(remember.status, 200);
      const seen = calls.slice(start);

      assert.deepEqual(contactedMainMemory(seen).map((call) => `${call.method} ${call.url}`), [], "no MAIN memory read or write");
      const appHistoryReads = seen.filter((call) => call.origin === APP_DB && call.method === "GET" && call.url.includes("/rest/v1/chat_messages_gf"));
      assert.deepEqual(appHistoryReads.map((call) => call.url), [], "history is never read from MAIN");
      assert.equal(seen.some((call) => call.origin === COMPANY_B), false);
      assert.equal(seen.some((call) => call.url.includes("/embeddings") && /remember/i.test(JSON.stringify(call.body))), false, "no memory embedding of the user's message");
    }, { route });
  });

  test("project chat history: chat stores nothing of its own in the Company DB", async () => {
    const sessionId = "sess-nowrite";
    const route = companyChatDb({
      origin: COMPANY_A,
      sessions: [{ session_id: sessionId, project_id: PROJECT_A, user_id: "u1" }],
      messages: homeConversation(sessionId)
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "And when was it approved?" });
      const writes = calls.slice(start).filter((call) => call.origin === COMPANY_A && call.method !== "GET" && !call.url.includes("/rest/v1/rpc/"));
      assert.deepEqual(writes.map((call) => `${call.method} ${call.url}`), [], "BiDoc owns Company DB chat writes");
    }, { route });
  });

  test("project chat history: a session of another Project is never read", async () => {
    const sessionId = "sess-other";
    const route = companyChatDb({
      origin: COMPANY_A,
      // The session exists in this Company DB but belongs to Project B.
      sessions: [{ session_id: sessionId, project_id: PROJECT_B, user_id: "u2" }],
      messages: [row(sessionId, "human", "SECRET-OF-PROJECT-B question", 1), row(sessionId, "ai", "SECRET-OF-PROJECT-B answer", 2)]
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "What was decided?" });
      assert.equal(result.status, 200);
      const seen = calls.slice(start);
      assert.equal(seen.some((call) => call.origin === COMPANY_A && call.url.includes("/rest/v1/chat_messages")), false, "messages are not read for a session the Project does not own");
      assert.equal(seen.filter(isOpenRouterChat).some((call) => /SECRET-OF-PROJECT-B/.test(callText(call))), false);
    }, { route });
  });

  test("project chat history: a long conversation is summarised on the fly within the budget and nothing is stored", async () => {
    const sessionId = "sess-long";
    const filler = "x".repeat(900);
    const messages = [];
    for (let turn = 1; turn <= 18; turn += 1) {
      messages.push(row(sessionId, "human", `${turn === 8 ? "OLDER-TURN-MARKER " : ""}question ${turn} ${filler}`, turn * 2));
      messages.push(row(sessionId, "ai", `answer ${turn} ${filler}`, turn * 2 + 1));
    }
    messages.push(row(sessionId, "human", "And when was it approved?", 59));
    const route = companyChatDb({ origin: COMPANY_A, sessions: [{ session_id: sessionId, project_id: PROJECT_A, user_id: "u1" }], messages });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "And when was it approved?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      const seen = calls.slice(start);

      const summary = seen.find(isSummaryCall);
      assert.ok(summary, "older turns were summarised for this request");
      assert.ok(/OLDER-TURN-MARKER/.test(callText(summary)), "the summary is built from the older turns");
      const agent = seen.filter(isOpenRouterChat).find((call) => !isClassifierCall(call) && !isSummaryCall(call));
      const agentPrompt = callText(agent);
      assert.ok(/SUMMARY-TOPIC-ELEVATORS/.test(agentPrompt), "the summary reaches the agent");
      assert.ok(!/OLDER-TURN-MARKER/.test(agentPrompt), "older turns are not repeated verbatim");
      assert.ok(/answer 18 /.test(agentPrompt), "the latest turns stay verbatim");
      // Lite agent budget (4000 tokens, ~3 chars per token) plus the summary note.
      const history = agent.body.messages.filter((message) => message.role !== "system" || /CONVERSATION MEMORY SUMMARY/.test(message.content));
      const historyChars = history.reduce((sum, message) => sum + String(message.content).length, 0) - String(agent.body.messages.at(-1).content).length;
      assert.ok(historyChars <= 4000 * 3 + 600, `history stays within the context budget (${historyChars} chars)`);

      assert.deepEqual(contactedMainMemory(seen).map((call) => call.url), []);
      assert.deepEqual(seen.filter((call) => call.origin === COMPANY_A && call.method !== "GET" && !call.url.includes("/rest/v1/rpc/")), []);
    }, { route });
  });

  test("project chat history: a failing history read does not fail the chat", async () => {
    const sessionId = "sess-fail";
    const route = companyChatDb({
      origin: COMPANY_A,
      sessions: [{ session_id: sessionId, project_id: PROJECT_A, user_id: "u1" }],
      messages: homeConversation(sessionId),
      failMessages: true
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await chat(handler, { sessionId: `bidoc:${PROJECT_A}:${sessionId}`, message: "And when was it approved?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      assert.ok(result.body.answer);
      assert.ok(result.body.trace.some((item) => item.step === "memory" && item.ok === false), "the degraded history is recorded in the trace");
      assert.deepEqual(contactedMainMemory(calls.slice(start)), []);
    }, { route });
  });

  test("project chat history: Kapaim regression - a Kapaim-shaped Company DB request still gets follow-up context", async () => {
    const sessionId = "kapaim-sess";
    // Kapaim's chat_messages has only the base columns (no migration 029).
    const route = companyChatDb({
      origin: KAPAIM,
      messageColumns: ["id", "session_id", "role", "content", "created_at"],
      sessions: [{ session_id: sessionId, project_id: KAPAIM_PROJECT, user_id: "k1" }],
      messages: homeConversation(sessionId)
    });
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const headers = companyHeaders({
        url: KAPAIM,
        key: "kapaim-key",
        projectId: KAPAIM_PROJECT,
        extra: { "x-index-table": "data_index", "x-alerts-table": "alerts", "x-hybrid-rpc-name": "hybrid_match_data_index" }
      });
      const result = await chat(handler, { headers, projectId: KAPAIM_PROJECT, sessionId: `bidoc:${KAPAIM_PROJECT}:${sessionId}`, message: "And when was it approved?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      const seen = calls.slice(start);
      assert.match(callText(seen.find(isClassifierCall)), /USER: Who approved the elevator submittal\?/);
      const agent = seen.filter(isOpenRouterChat).find((call) => !isClassifierCall(call) && !isSummaryCall(call));
      assert.match(callText(agent), /approved by Dana/);
      assert.match(seen.find((call) => call.url.includes("/rest/v1/chat_sessions")).url, new RegExp(`project_id=eq.${KAPAIM_PROJECT}`));

      for (const call of seen.filter((item) => item.origin.includes("supabase.test"))) {
        assert.ok(call.origin === KAPAIM || call.origin === APP_DB, `only Kapaim's Company DB (and main-agent's own App DB) are contacted, not ${call.origin}`);
      }
      assert.deepEqual(seen.filter((call) => call.origin === KAPAIM && call.method !== "GET" && !call.url.includes("/rest/v1/rpc/")), [], "no Kapaim write, no schema change");
      assert.deepEqual(contactedMainMemory(seen), []);
    }, { route });
  });

  test("project chat history: restore env", () => {
    restoreEnv();
  });
}
