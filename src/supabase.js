import { createEmbedding } from "./openrouter.js";

const MESSAGES_TABLE = "chat_messages_gf";

export async function saveMessage({ config, userMessage, sanitizedMessage, sessionId }) {
  if (!isConfigured(config)) return localMessage({ userMessage, sanitizedMessage, sessionId });
  const response = await supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_message: userMessage,
      session_id: sessionId,
      sanitzed_user_message: sanitizedMessage,
      status: "processing"
    })
  });
  return response?.[0] || localMessage({ userMessage, sanitizedMessage, sessionId });
}

export async function updateMessage({ config, messageId, aiResponse, status = "done" }) {
  if (!isConfigured(config) || String(messageId).startsWith("local_")) return null;
  return supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ai_response: aiResponse, status })
  });
}

export async function listSessions({ config, limit = 30 }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=session_id,status,created_at,user_message,ai_response&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  const seen = new Map();
  for (const row of rows || []) {
    if (!seen.has(row.session_id)) seen.set(row.session_id, row);
  }
  return [...seen.entries()].map(([sessionId, row]) => ({ sessionId, ...row }));
}

export async function listMessages({ config, sessionId }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`;
  return supabaseFetch(config, query);
}

export async function recentMemory({ config, sessionId, limit = 8 }) {
  if (!isConfigured(config) || !sessionId) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=user_message,ai_response,created_at&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  return (rows || []).reverse().flatMap((row) => {
    const messages = [];
    if (row.user_message) messages.push({ role: "user", content: row.user_message });
    if (row.ai_response) messages.push({ role: "assistant", content: row.ai_response });
    return messages;
  });
}

export async function hybridSearch({ config, query, dateFrom, dateTo, hashtags = [], topK = config.retrieval.candidates }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  if (!isConfigured(config)) throw new Error("Supabase is not configured");

  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: query
  });

  const payload = {
    query_text: query,
    query_embedding: embedding,
    match_count: topK,
    date_from: dateFrom,
    date_to: dateTo,
    hashtags: normalizeHashtags(hashtags),
    vector_weight: config.retrieval.vectorWeight,
    keyword_weight: config.retrieval.keywordWeight
  };

  try {
    return await supabaseFetch(config, `/rest/v1/rpc/${config.retrieval.rpcName}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!payload.hashtags.length || !looksLikeRpcSignatureError(error.message)) throw error;
    const { hashtags: _hashtags, ...payloadWithoutHashtags } = payload;
    return supabaseFetch(config, `/rest/v1/rpc/${config.retrieval.rpcName}`, {
      method: "POST",
      body: JSON.stringify(payloadWithoutHashtags)
    });
  }
}

export const vectorSearch = hybridSearch;

async function supabaseFetch(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return data;
}

function isConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

function normalizeHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return [];
  return [...new Set(hashtags.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}

function looksLikeRpcSignatureError(message) {
  return /function|parameter|argument|schema cache|could not find|PGRST202/i.test(String(message || ""));
}

export async function fetchTimelineEvents({ config, limit = 1000 }) {
  if (!isConfigured(config)) return [];
  const TABLE = "data_index_embeddings_gf_dor_agent";
  const query = `/rest/v1/${TABLE}?select=id,date,hashtags,content,metadata&order=date.asc&limit=${limit}&date=not.is.null`;
  const rows = await supabaseFetch(config, query);
  return (rows || []).map((row) => ({
    id: row.id,
    date: row.date,
    tags: parseHashtags(row.hashtags),
    content: row.content || (typeof row.metadata === "object" && row.metadata ? row.metadata.summary || row.metadata.text || row.metadata.content || "" : "") || "",
    metadata: row.metadata ?? null
  }));
}

function parseHashtags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).replace(/^#+/, "")).filter(Boolean);
  return String(raw).match(/#[֐-׿\w]+/gu)?.map((t) => t.replace(/^#+/, "")) || [];
}

function localMessage({ userMessage, sanitizedMessage, sessionId }) {
  return {
    id: `local_${Date.now()}`,
    user_message: userMessage,
    sanitzed_user_message: sanitizedMessage,
    session_id: sessionId,
    status: "processing"
  };
}
