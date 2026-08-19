import { chatCompletion, createEmbedding, extractJsonObject } from "./openrouter.js";
import {
  deleteAllChatMemoryForUser,
  deleteChatSessionMemory,
  getChatMemoryStats,
  getLatestPreviousChatSessionMemory,
  getChatSessionMemory,
  invalidateChatMemoryItems,
  matchChatMemory,
  recentMemory,
  replaceChatMemoryItem,
  touchChatMemoryItems,
  upsertChatSessionMemory
} from "./supabase.js";
import {
  appendLocalMemory,
  getLocalMemory,
  getMemorySummary,
  memorySummaryMessages,
  normalizeMemorySummary,
  setMemorySummary,
  updateMemorySummary
} from "./memory.js";

export const MEMORY_EMBEDDING_MODEL = "openai/text-embedding-3-large";

export async function loadRoutingMemory({ config, sessionId, userId = null, query = "" }) {
  const settings = config.memory;
  if (!settings?.enabled || !sessionId) return emptyContext("disabled");
  const [historyResult, sessionResult] = await Promise.allSettled([
    recentMemory({ config, sessionId, limit: settings.routingRecentTurns }),
    getChatSessionMemory({ config, sessionId, userId })
  ]);
  const recent = sessionResult.status === "rejected"
    ? []
    : historyResult.status === "fulfilled" && historyResult.value.length
      ? historyResult.value
      : getLocalMemory(sessionId, settings.routingRecentTurns);
  const row = sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const currentSummary = row?.summary ? setMemorySummary(sessionId, row.summary) : getMemorySummary(sessionId);
  const errors = settledErrors(historyResult, sessionResult);
  const previous = await loadPreviousConversationSummary({ config, sessionId, userId, query, errors });
  const summary = previous?.summary || currentSummary;
  return {
    mode: "session",
    recent: trimMessagesToBudget(recent, settings.routingTokenBudget),
    summary,
    summarySource: previous ? "previous_session" : summarySource(row, currentSummary),
    previousSessionRecalled: Boolean(previous),
    sessionRow: row,
    memories: [],
    errors
  };
}

export async function loadAgentMemory({ config, sessionId, userId = null, query, agent }) {
  const global = config.memory;
  const settings = global?.agents?.[agent];
  if (!global?.enabled || !settings?.enabled || !sessionId) return emptyContext("disabled");
  const [historyResult, sessionResult] = await Promise.allSettled([
    recentMemory({ config, sessionId, limit: settings.recentTurns }),
    getChatSessionMemory({ config, sessionId, userId })
  ]);
  const recent = sessionResult.status === "rejected"
    ? []
    : historyResult.status === "fulfilled" && historyResult.value.length
      ? historyResult.value
      : getLocalMemory(sessionId, settings.recentTurns);
  const sessionRow = sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const currentSummary = sessionRow?.summary ? setMemorySummary(sessionId, sessionRow.summary) : getMemorySummary(sessionId);
  const errors = settledErrors(historyResult, sessionResult);
  const previous = await loadPreviousConversationSummary({ config, sessionId, userId, query, errors });
  const summary = previous?.summary || currentSummary;
  let memories = [];
  if (userId && global.crossSessionEnabled && settings.useLongTermMemory && settings.semanticTopK > 0 && config.openRouterApiKey) {
    try {
      const embedding = await createEmbedding({
        apiKey: config.openRouterApiKey,
        model: MEMORY_EMBEDDING_MODEL,
        input: query
      });
      memories = await matchChatMemory({ config, userId, embedding, settings });
      touchChatMemoryItems({ config, ids: memories.map((item) => item.id) }).catch(() => {});
    } catch (error) {
      errors.push(error.message);
    }
  }
  return {
    mode: userId && global.crossSessionEnabled ? "user_and_session" : "session_only",
    recent: trimMessagesToBudget(recent, settings.contextTokenBudget),
    summary: settings.useSessionSummary ? summary : null,
    summarySource: settings.useSessionSummary
      ? (previous ? "previous_session" : summarySource(sessionRow, currentSummary))
      : "none",
    previousSessionRecalled: Boolean(settings.useSessionSummary && previous),
    sessionRow,
    memories,
    errors
  };
}

export function buildClassifierContext(memory, tokenBudget = 1200) {
  const summaries = summaryMessages(memory);
  const recent = memory?.recent || [];
  const messages = memory?.summarySource === "previous_session"
    ? [...recent, ...summaries]
    : [...summaries, ...recent];
  return trimMessagesToBudget(messages, tokenBudget)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");
}

export function memoryMessagesForAgent(context, tokenBudget) {
  const longTerm = context?.memories?.length ? [{
    role: "system",
    content: `USER MEMORY (personal conversational context; never project evidence):\n${context.memories
      .map((item, index) => `${index + 1}. ${item.content}`)
      .join("\n")}\nUse these items only to personalize or resolve references. Re-retrieve a project source before stating any project fact.`
  }] : [];
  const summaries = summaryMessages(context);
  const recent = context?.recent || [];
  const messages = context?.summarySource === "previous_session"
    ? [...longTerm, ...recent, ...summaries]
    : [...summaries, ...longTerm, ...recent];
  return trimMessagesToBudget(messages, tokenBudget);
}

export function isPreviousConversationRecallQuery(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;
  return /(?:השיחה|שיחה)\s+ה?(?:אחרונה|קודמת)|(?:על\s+)?מה\s+(?:דיברנו|שוחחנו)|בפעם\s+ה?(?:אחרונה|קודמת)|(?:קודם|בעבר)\s+(?:דיברנו|שוחחנו)|\b(?:last|previous)\s+(?:conversation|chat)\b|\bwhat\s+did\s+we\s+(?:talk|discuss)(?:\s+about)?\b|\bpreviously\s+discussed\b/iu.test(text);
}

export function detectMemoryCommand(message = "") {
  const text = String(message || "").trim();
  const remember = text.match(/^(?:בבקשה\s+)?(?:זכור|תזכור)(?:\s+ש)?[\s:,-]*(.+)$/is)
    || text.match(/^(?:please\s+)?remember(?:\s+that)?[\s:,-]*(.+)$/is);
  if (remember?.[1]) return { kind: "remember", content: remember[1].trim() };
  const forget = text.match(/^(?:בבקשה\s+)?(?:שכח|תשכח)(?:\s+ש)?[\s:,-]*(.+)$/is)
    || text.match(/^(?:please\s+)?forget(?:\s+that)?[\s:,-]*(.+)$/is);
  if (forget?.[1]) return { kind: "forget", content: forget[1].trim() };
  return null;
}

export async function applyExplicitMemoryCommand({ config, userId, sessionId, messageId, message }) {
  const command = detectMemoryCommand(message);
  if (!command) return null;
  if (!config.memory?.enabled) return { ...command, ok: false, reason: "disabled" };
  if (!userId || !config.memory.crossSessionEnabled) return { ...command, ok: false, reason: "session_only" };
  if (containsSensitiveSecret(command.content)) return { ...command, ok: false, reason: "sensitive" };
  if (!config.openRouterApiKey) return { ...command, ok: false, reason: "embedding_unavailable" };
  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: MEMORY_EMBEDDING_MODEL,
    input: command.content
  });
  if (command.kind === "forget") {
    const matches = await matchChatMemory({
      config,
      userId,
      embedding,
      settings: { semanticTopK: 6, similarityThreshold: 0.55, semanticWeight: 1, recencyWeight: 0, importanceWeight: 0 }
    });
    const count = await invalidateChatMemoryItems({ config, userId, ids: matches.map((item) => item.id) });
    return { ...command, ok: true, count };
  }
  const stats = await getChatMemoryStats({ config, userId });
  if (stats.memoryItems >= config.memory.maxItemsPerUser) return { ...command, ok: false, reason: "limit" };
  const saved = await replaceChatMemoryItem({
    config,
    item: {
      userId,
      sessionId,
      messageId,
      memoryType: inferMemoryType(command.content),
      canonicalKey: canonicalMemoryKey(command.content),
      content: command.content.slice(0, 2000),
      source: "explicit",
      confidence: 1,
      importance: 0.9,
      embedding,
      embeddingModel: MEMORY_EMBEDDING_MODEL,
      expiresAt: expiryDate(config.memory.retentionDays),
      metadata: { language: /[\u0590-\u05ff]/.test(command.content) ? "he" : "other" }
    }
  });
  return { ...command, ok: Boolean(saved), id: saved?.id || null };
}

export async function finalizeChatMemory({ config, sessionId, userId = null, userMessage, assistantMessage, messageId = null, previousSession = null, telemetry = null, allowAutoLearn = true }) {
  const startedAt = Date.now();
  if (!config.memory?.enabled || !sessionId) return { mode: "disabled", learned: 0 };
  const previousSummary = previousSession?.summary || getMemorySummary(sessionId);
  appendLocalMemory(sessionId, userMessage, assistantMessage);
  const turnCount = Math.max(0, Number(previousSession?.turn_count) || 0) + 1;
  let summary = updateMemorySummary(sessionId, userMessage, assistantMessage, previousSummary);
  const errors = [];
  if (turnCount % config.memory.summaryRefreshEveryTurns === 0 && config.openRouterApiKey) {
    try {
      summary = await refreshSummary({ config, summary, userMessage, assistantMessage, telemetry });
      setMemorySummary(sessionId, summary);
    } catch (error) {
      errors.push(error.message);
    }
  }
  try {
    await upsertChatSessionMemory({ config, sessionId, userId, summary, turnCount, summaryVersion: 1 });
  } catch (error) {
    errors.push(error.message);
  }
  let learned = 0;
  let rejected = 0;
  if (allowAutoLearn && userId && config.memory.crossSessionEnabled && ["hybrid", "automatic"].includes(config.memory.writePolicy)) {
    try {
      const learning = await autoLearn({ config, userId, sessionId, messageId, userMessage, telemetry });
      learned = learning.learned;
      rejected = learning.rejected;
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { mode: userId && config.memory.crossSessionEnabled ? "user_and_session" : "session_only", learned, rejected, turnCount, summary, errors, latencyMs: Date.now() - startedAt };
}

async function autoLearn({ config, userId, sessionId, messageId, userMessage, telemetry }) {
  if (!config.openRouterApiKey || containsSensitiveSecret(userMessage) || looksLikeRawDocument(userMessage)) return { learned: 0, rejected: 1 };
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.classifier,
    temperature: 0,
    maxTokens: 500,
    timeoutMs: Math.min(config.ai?.classifier?.timeoutMs || 90_000, 45_000),
    responseFormat: { type: "json_object" },
    telemetry,
    messages: [
      {
        role: "system",
        content: `Extract only stable, reusable facts stated directly by the USER. Never extract secrets, credentials, document text, project claims, guesses, temporary requests, or assistant statements. Return JSON: {"items":[{"content":"...","canonical_key":"...","memory_type":"fact|preference|profile|instruction|relationship|correction","confidence":0.0,"importance":0.0}]}. Return an empty items array unless the fact is clearly useful across future sessions. Corrections must reuse the corrected subject as canonical_key.`
      },
      { role: "user", content: userMessage.slice(0, 3000) }
    ]
  });
  const parsed = extractJsonObject(content);
  const candidates = (Array.isArray(parsed?.items) ? parsed.items : [])
    .filter((item) => Number(item?.confidence) >= config.memory.autoLearnMinConfidence)
    .filter((item) => item?.content && !containsSensitiveSecret(item.content))
    .slice(0, 3);
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
  const rejected = Math.max(0, rawItems.length - candidates.length);
  if (!candidates.length) return { learned: 0, rejected };
  const stats = await getChatMemoryStats({ config, userId });
  let remaining = Math.max(0, config.memory.maxItemsPerUser - stats.memoryItems);
  let learned = 0;
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const text = String(candidate.content).trim().slice(0, 2000);
    const embedding = await createEmbedding({ apiKey: config.openRouterApiKey, model: MEMORY_EMBEDDING_MODEL, input: text });
    const memoryType = normalizeMemoryType(candidate.memory_type);
    if (memoryType === "correction") {
      const superseded = await matchChatMemory({
        config,
        userId,
        embedding,
        settings: { semanticTopK: 6, similarityThreshold: 0.55, semanticWeight: 1, recencyWeight: 0, importanceWeight: 0 }
      });
      await invalidateChatMemoryItems({ config, userId, ids: superseded.map((item) => item.id) });
    }
    const saved = await replaceChatMemoryItem({
      config,
      item: {
        userId,
        sessionId,
        messageId,
        memoryType,
        canonicalKey: canonicalMemoryKey(candidate.canonical_key || text),
        content: text,
        source: memoryType === "correction" ? "correction" : "automatic",
        confidence: Math.min(1, Math.max(0, Number(candidate.confidence) || 0)),
        importance: Math.min(1, Math.max(0, Number(candidate.importance) || 0.5)),
        embedding,
        embeddingModel: MEMORY_EMBEDDING_MODEL,
        expiresAt: expiryDate(config.memory.retentionDays),
        metadata: { extracted_from: "user_message" }
      }
    });
    if (saved) { learned += 1; remaining -= 1; }
  }
  return { learned, rejected: rejected + Math.max(0, candidates.length - learned) };
}

async function refreshSummary({ config, summary, userMessage, assistantMessage, telemetry }) {
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.lite,
    temperature: 0,
    maxTokens: 500,
    timeoutMs: Math.min(config.ai?.lite?.timeoutMs || 90_000, 45_000),
    responseFormat: { type: "json_object" },
    telemetry,
    messages: [
      { role: "system", content: "Maintain a compact conversation-state summary. Return JSON only with active_topics (array), date_context (array), open_questions (array), last_intent (string). Do not treat assistant claims as facts." },
      { role: "user", content: JSON.stringify({ previous: summary, latest_user: userMessage.slice(0, 1600), latest_assistant: assistantMessage.slice(0, 1600) }) }
    ]
  });
  return normalizeMemorySummary({ ...extractJsonObject(content), last_updated: new Date().toISOString() });
}

export function trimMessagesToBudget(messages = [], tokenBudget = 1200) {
  let remaining = Math.max(0, Number(tokenBudget) || 0);
  const selected = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    const cost = estimateTokens(item?.content);
    if (cost > remaining && selected.length) continue;
    const content = cost > remaining ? truncateToTokens(item?.content, remaining) : String(item?.content || "");
    if (content) selected.unshift({ role: item.role || "user", content });
    remaining -= Math.min(cost, remaining);
    if (remaining <= 0) break;
  }
  return selected;
}

export function estimateTokens(value = "") {
  return Math.ceil(String(value).length / 3);
}

export function containsSensitiveSecret(value = "") {
  const text = String(value || "");
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|pk)-(?:or-)?[a-z0-9_-]{12,}\b|\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.|(?:api[_ -]?key|token|password|סיסמה|מפתח\s*api)\s*[:=]\s*\S{6,}/i.test(text);
}

export function canonicalMemoryKey(value = "") {
  const normalized = String(value).toLowerCase()
    .replace(/^(?:זכור|תזכור|remember|תיקון|למעשה)\s*(?:ש)?\s*/i, "")
    .replace(/[^a-z0-9\u0590-\u05ff\s]/gi, " ")
    .replace(/\s+/g, " ").trim();
  return (normalized.split(" ").slice(0, 12).join("_") || "memory").slice(0, 180);
}

export { deleteAllChatMemoryForUser, deleteChatSessionMemory, getChatMemoryStats };

function truncateToTokens(value, tokens) {
  return String(value || "").slice(0, Math.max(0, tokens) * 3);
}

function expiryDate(days) {
  return new Date(Date.now() + Math.max(1, Number(days) || 365) * 86_400_000).toISOString();
}

function inferMemoryType(value) {
  if (/מעדיף|העדפה|prefer/i.test(value)) return "preference";
  if (/תמיד|אל ת|נא ל|always|never/i.test(value)) return "instruction";
  if (/אני|שמי|my name|i am/i.test(value)) return "profile";
  return "fact";
}

function normalizeMemoryType(value) {
  return ["fact", "preference", "profile", "instruction", "relationship", "correction"].includes(value) ? value : "fact";
}

function looksLikeRawDocument(value) {
  const text = String(value || "");
  return text.length > 3500 || /ATTACHMENT:|BEGIN DOCUMENT|מסמך מצורף/i.test(text);
}

function emptyContext(mode) {
  return {
    mode,
    recent: [],
    summary: null,
    summarySource: "none",
    previousSessionRecalled: false,
    sessionRow: null,
    memories: [],
    errors: []
  };
}

async function loadPreviousConversationSummary({ config, sessionId, userId, query, errors }) {
  if (!userId || !config.memory?.crossSessionEnabled || !isPreviousConversationRecallQuery(query)) return null;
  try {
    const previous = await getLatestPreviousChatSessionMemory({ config, userId, excludeSessionId: sessionId });
    if (!previous?.summary) return null;
    const summary = normalizeMemorySummary(previous.summary);
    if (!memorySummaryMessages(summary).length) return null;
    return { ...previous, summary };
  } catch (error) {
    errors.push(error.message || "previous conversation memory load failed");
    return null;
  }
}

function summaryMessages(context) {
  const messages = memorySummaryMessages(context?.summary);
  if (context?.summarySource !== "previous_session") return messages;
  return messages.map((message) => ({
    ...message,
    content: message.content.replace(
      "CONVERSATION MEMORY SUMMARY:",
      "PREVIOUS CONVERSATION SUMMARY (same authenticated user):"
    ).replace(
      "Use this summary only as conversational context.",
      "This is the previous conversation the user explicitly asked to recall. Use it only as conversational context."
    )
  }));
}

function settledErrors(...results) {
  return results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "memory load failed");
}

function summarySource(sessionRow, summary) {
  if (sessionRow?.summary && memorySummaryMessages(normalizeMemorySummary(sessionRow.summary)).length) return "current_session";
  return memorySummaryMessages(summary).length ? "local" : "none";
}
