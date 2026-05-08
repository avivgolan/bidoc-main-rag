import { chatCompletion, createEmbedding } from "../openrouter.js";
import { getConfig, readLocalSettings } from "../config.js";

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

async function searchAlertsEmbeddings(config, query, table, topK = 20) {
  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: query
  });

  const rpcName = `match_${table}`;
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query_embedding: embedding, match_count: topK })
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase RPC failed: ${response.status}`);
  return Array.isArray(data) ? data : [];
}

export async function runAlertAgent({ query, dateFilter = "" }) {
  const config = getConfig();
  const saved = readLocalSettings().subagents?.alert || {};

  const table = saved.table || "alerts_embeddings_gf";
  const model = saved.model || config.models.main;
  const systemPrompt = saved.systemPrompt || SYSTEM_PROMPT;

  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY לא מוגדר");
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) throw new Error("Supabase לא מוגדר");

  const searchQuery = dateFilter ? `${query} ${dateFilter}` : query;
  const results = await searchAlertsEmbeddings(config, searchQuery, table);

  const today = new Date().toISOString().slice(0, 10);

  const userContent = [
    `תאריך היום: ${today}`,
    `שאילתה: ${query}`,
    dateFilter ? `פילטר תאריך: ${dateFilter}` : "",
    "",
    `תוצאות חיפוש (${results.length} רשומות):`,
    JSON.stringify(results, null, 2)
  ].filter(Boolean).join("\n");

  const answer = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ]
  });

  return { ok: true, answer, resultsCount: results.length };
}
