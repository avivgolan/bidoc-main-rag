import { chatCompletion, createEmbedding } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const SYSTEM_PROMPT = `# סוכן התראות — מצב אחזור מהיר

## זהות
אתה סוכן משנה שמאחזר התראות פרויקט ובעיות קריטיות פתוחות.
החזר נתונים יעיל. ללא הקדמות, ללא סיכומים, ללא מילוי.

## כלים
חיפוש סמנטי על טבלת alerts_embeddings_gf.

## פורמט פלט
פלט רשימה בלבד. ללא טקסט הקדמה.

* [התראה] <תאריך> — <סוג_התראה>
  * תיאור: <תיאור>
  * סטטוס: <סטטוס>
  * עדיפות: <עדיפות>
  * מקור: <קישור אם קיים, אחרת ->

## Fallback
אם לא נמצאו נתונים: "לא נמצאו התראות רלוונטיות."`;

async function searchAlertsEmbeddings(config, query, table, topK = 20, cacheContext = null) {
  const contentConfig = contentSupabaseConfig(config);
  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: query,
    cacheContext
  });

  const rpcName = contentConfig.alertsRpcName || `match_${table}`;
  const response = await fetch(`${contentConfig.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey),
    body: JSON.stringify({ query_embedding: embedding, match_count: topK })
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase RPC failed: ${response.status}`);
  return Array.isArray(data) ? data : [];
}

export async function runAlertAgent({ query, dateFilter = "", dateFrom = null, dateTo = null, cacheContext = null }) {
  const config = getConfig();
  const saved = readLocalSettings().subagents?.alert || {};
  const contentConfig = contentSupabaseConfig(config);

  const table = saved.table || contentConfig.alertsTable || "alerts_embeddings_gf";
  const model = saved.model || config.models.main;
  const systemPrompt = saved.systemPrompt || SYSTEM_PROMPT;
  if (!contentConfig.supabaseUrl || !contentConfig.supabaseServiceRoleKey) throw new Error("Content Supabase is not configured");

  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY לא מוגדר");

  const normalizedDateFrom = normalizeDateBoundary(dateFrom);
  const normalizedDateTo = normalizeDateBoundary(dateTo);
  const effectiveDateFilter = dateFilter || buildAlertDateFilter(normalizedDateFrom, normalizedDateTo);
  const searchQuery = effectiveDateFilter ? `${query} ${effectiveDateFilter}` : query;
  const rawResults = await searchAlertsEmbeddings(config, searchQuery, table, 20, cacheContext);
  const results = filterAlertsByDateRange(rawResults, normalizedDateFrom, normalizedDateTo);

  const today = new Date().toISOString().slice(0, 10);

  const userContent = [
    `תאריך היום: ${today}`,
    `שאילתה: ${query}`,
    effectiveDateFilter ? `פילטר תאריך: ${effectiveDateFilter}` : "",
    normalizedDateFrom ? `date_from: ${normalizedDateFrom}` : "",
    normalizedDateTo ? `date_to: ${normalizedDateTo}` : "",
    "",
    `תוצאות חיפוש (${results.length} רשומות):`,
    JSON.stringify(results, null, 2)
  ].filter(Boolean).join("\n");

  const answer = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model,
    temperature: config.ai?.alert?.temperature ?? 0.1,
    maxTokens: config.ai?.alert?.maxTokens ?? 2200,
    timeoutMs: config.ai?.alert?.timeoutMs ?? 90_000,
    topP: config.ai?.alert?.topP ?? 1,
    frequencyPenalty: config.ai?.alert?.frequencyPenalty ?? 0,
    presencePenalty: config.ai?.alert?.presencePenalty ?? 0,
    seed: config.ai?.alert?.seed ?? null,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  });

  return { ok: true, answer, resultsCount: results.length };
}

export function buildAlertDateFilter(dateFrom = null, dateTo = null) {
  if (!dateFrom && !dateTo) return "";
  return [dateFrom, dateTo].filter(Boolean).join(" - ");
}

export function filterAlertsByDateRange(results, dateFrom = null, dateTo = null) {
  if (!dateFrom && !dateTo) return results;
  const fromTime = dateFrom ? Date.parse(dateFrom) : Number.NEGATIVE_INFINITY;
  const toTime = dateTo ? Date.parse(dateTo) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(fromTime) && Number.isNaN(toTime)) return results;

  return results.filter((row) => {
    const rowDate = row?.date || row?.metadata?.date || row?.created_at || row?.metadata?.created_at;
    const rowTime = Date.parse(rowDate);
    if (Number.isNaN(rowTime)) return false;
    if (!Number.isNaN(fromTime) && rowTime < fromTime) return false;
    if (!Number.isNaN(toTime) && rowTime > toTime) return false;
    return true;
  });
}

function normalizeDateBoundary(value) {
  return value ? String(value).trim() : null;
}
