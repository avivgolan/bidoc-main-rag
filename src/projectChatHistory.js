import { chatCompletion, extractJsonObject } from "./openrouter.js";
import { memorySummaryMessages, normalizeMemorySummary, summarizeTurnsLocally } from "./memory.js";
import { recentCompanyChatMessages } from "./supabase.js";
import { estimateTokens, trimMessagesToBudget } from "./chatMemory.js";

// Conversation context of a Project chat request, built from BiDoc's own chat
// in the Project's Company DB (chat_sessions + chat_messages) and kept nowhere:
// no summary row, no memory item, no MAIN table. Turns beyond the context
// budget are summarised on the fly, for this request only.
//
// The returned contexts have the shape of the MAIN memory contexts
// (chatMemory.js) so the classifier and agents consume them unchanged.

// How many of the newest messages are read per request. Older ones are dropped.
export const PROJECT_HISTORY_MAX_MESSAGES = 60;
// Tokens of an agent's budget held back for the on-the-fly summary so verbatim
// turns never crowd it out.
export const SUMMARY_RESERVE_TOKENS = 600;
const SUMMARY_INPUT_CHARS = 12_000;
const SUMMARY_MESSAGE_CHARS = 800;

// BiDoc saves this text as the AI bubble when main-agent fails
// (apps/web dashboard-questions.ts CHAT_AI_ERROR_TEXT); it is not an answer.
const CHAT_AI_ERROR_TEXT = "שגיאה בקבלת תשובה מה-AI. אנא נסה שוב.";

const ROLE_BY_BIDOC_ROLE = { human: "user", user: "user", ai: "assistant", assistant: "assistant" };

const sameText = (left, right) => String(left || "").replace(/\s+/g, " ").trim() === String(right || "").replace(/\s+/g, " ").trim();

// BiDoc chat_messages rows (role human|ai, oldest first) to conversation turns
// [{ role: "user"|"assistant", content }]. BiDoc saves the question being asked
// before it calls main-agent, so a trailing copy of the current question is not
// history and is dropped; so are error bubbles (with the question that failed),
// unknown roles and empty rows.
export function toConversationTurns(rows, { currentMessage = "" } = {}) {
  const turns = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const role = ROLE_BY_BIDOC_ROLE[String(row?.role || "").toLowerCase()];
    const content = String(row?.content ?? "").trim();
    if (!role || !content) continue;
    if (role === "assistant" && content === CHAT_AI_ERROR_TEXT) {
      // The question that failed is asked again on retry; keep neither.
      if (turns.at(-1)?.role === "user") turns.pop();
      continue;
    }
    turns.push({ role, content });
  }
  const last = turns.at(-1);
  if (last?.role === "user" && sameText(last.content, currentMessage)) turns.pop();
  return turns;
}

// Reads the session's conversation. Never throws: a Company DB that cannot be
// read leaves the chat without history, with the reason in `errors`.
export async function loadProjectConversation({ config, sessionId, currentMessage = "" }) {
  if (!config.memory?.enabled || !sessionId) return { turns: [], errors: [] };
  try {
    // +1: the question being asked is among the newest rows.
    const rows = await recentCompanyChatMessages({ config, sessionId, limit: PROJECT_HISTORY_MAX_MESSAGES + 1 });
    return { turns: toConversationTurns(rows, { currentMessage }), errors: [] };
  } catch (error) {
    console.warn(`[chat history] Company DB conversation could not be read: ${error.message}`);
    return { turns: [], errors: [error.message || "conversation history load failed"] };
  }
}

// The newest turns that fit `maxMessages` and `tokenBudget`, and everything
// older. A single turn larger than the budget is kept, truncated.
function splitByBudget(turns, { maxMessages, tokenBudget }) {
  const limit = Math.max(0, Math.floor(maxMessages));
  let remaining = Math.max(0, tokenBudget);
  let count = 0;
  for (let index = turns.length - 1; index >= 0 && count < limit; index -= 1) {
    const cost = estimateTokens(turns[index].content);
    if (cost > remaining) {
      if (count === 0 && remaining > 0) count = 1;
      break;
    }
    remaining -= cost;
    count += 1;
  }
  return { recent: turns.slice(turns.length - count), older: turns.slice(0, turns.length - count) };
}

function memoryContext({ recent, summary, errors, turns }) {
  const hasSummary = memorySummaryMessages(summary).length > 0;
  return {
    mode: "company_db",
    recent,
    summary: hasSummary ? summary : null,
    summarySource: hasSummary ? "company_db" : "none",
    previousSessionRecalled: false,
    sessionRow: null,
    memories: [],
    errors,
    // Questions asked so far in the session, counting the one being answered.
    turnCount: turns.filter((turn) => turn.role === "user").length + 1
  };
}

// Routing context for the classifier: the latest turns plus a deterministic
// summary of anything older (no model call: routing must stay fast).
export function projectRoutingMemory({ config, conversation }) {
  const settings = config.memory;
  const { turns, errors } = conversation;
  if (!settings?.enabled) return memoryContext({ recent: [], summary: null, errors, turns: [] });
  const { recent, older } = splitByBudget(turns, {
    maxMessages: settings.routingRecentTurns * 2,
    tokenBudget: settings.routingTokenBudget - SUMMARY_RESERVE_TOKENS / 2
  });
  return memoryContext({ recent, summary: older.length ? summarizeTurnsLocally(older) : null, errors, turns });
}

function agentSplit(config, conversation, agent) {
  const settings = config.memory?.agents?.[agent];
  if (!config.memory?.enabled || !settings?.enabled) return null;
  return splitByBudget(conversation.turns, {
    maxMessages: settings.recentTurns * 2,
    tokenBudget: settings.contextTokenBudget - (settings.useSessionSummary ? SUMMARY_RESERVE_TOKENS : 0)
  });
}

// Starts the on-the-fly summary of the turns that do not fit an agent's
// context, so it runs while the classifier does. Resolves to { summary,
// source } and never rejects; null when every turn fits.
export function startEarlierSummary({ config, conversation, telemetry = null }) {
  const older = ["main", "lite"]
    .map((agent) => agentSplit(config, conversation, agent)?.older || [])
    .reduce((longest, candidate) => (candidate.length > longest.length ? candidate : longest), []);
  return older.length ? summarizeEarlierTurns({ config, turns: older, telemetry }) : null;
}

export async function summarizeEarlierTurns({ config, turns, telemetry = null }) {
  const local = { summary: summarizeTurnsLocally(turns), source: "local" };
  if (!config.openRouterApiKey || !config.models?.lite) return local;
  try {
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.lite,
      temperature: 0,
      maxTokens: 500,
      timeoutMs: Math.min(config.ai?.lite?.timeoutMs || 90_000, 45_000),
      responseFormat: { type: "json_object" },
      telemetry,
      messages: [
        {
          role: "system",
          content: "You summarise the EARLIER part of a conversation between a user and a construction-project assistant, so a later turn of the same conversation can continue it. Return JSON only with active_topics (array), date_context (array), open_questions (array), last_intent (string). Capture what the user was asking about and what is still unresolved. Do not treat assistant claims as facts."
        },
        { role: "user", content: JSON.stringify({ earlier_turns: summaryInput(turns) }) }
      ]
    });
    const summary = normalizeMemorySummary({ ...extractJsonObject(content), last_updated: new Date().toISOString() });
    if (memorySummaryMessages(summary).length) return { summary, source: "model" };
  } catch {
    // The deterministic summary below keeps the conversation usable.
  }
  return local;
}

// The newest of the older turns that fit the summary input cap, oldest first.
function summaryInput(turns) {
  const selected = [];
  let chars = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const content = turns[index].content.slice(0, SUMMARY_MESSAGE_CHARS);
    if (chars + content.length > SUMMARY_INPUT_CHARS && selected.length) break;
    chars += content.length;
    selected.unshift({ role: turns[index].role, content });
  }
  return selected;
}

// Context for one agent ("main" | "lite"): the latest turns that fit its
// budget, plus the on-the-fly summary of what did not fit.
export async function projectAgentMemory({ config, conversation, agent, earlierSummary = null }) {
  const split = agentSplit(config, conversation, agent);
  if (!split) return memoryContext({ recent: [], summary: null, errors: conversation.errors, turns: [] });
  const useSummary = config.memory.agents[agent].useSessionSummary && split.older.length > 0 && earlierSummary;
  const summary = useSummary ? (await earlierSummary).summary : null;
  return memoryContext({
    recent: trimMessagesToBudget(split.recent, config.memory.agents[agent].contextTokenBudget),
    summary,
    errors: conversation.errors,
    turns: conversation.turns
  });
}
