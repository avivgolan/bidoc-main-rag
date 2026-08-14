const memoryStore = new Map();
const summaryStore = new Map();

export function getLocalMemory(sessionId, limit = 8) {
  return (memoryStore.get(sessionId) || []).slice(-limit * 2);
}

export function appendLocalMemory(sessionId, userMessage, assistantMessage) {
  if (!sessionId) return;
  const existing = memoryStore.get(sessionId) || [];
  existing.push({ role: "user", content: userMessage });
  existing.push({ role: "assistant", content: assistantMessage });
  memoryStore.set(sessionId, existing.slice(-24));
  updateMemorySummary(sessionId, userMessage, assistantMessage);
}

export function getMemorySummary(sessionId) {
  return summaryStore.get(sessionId) || emptySummary();
}

export function updateMemorySummary(sessionId, userMessage, assistantMessage = "", baseSummary = null) {
  if (!sessionId) return emptySummary();
  const current = baseSummary && typeof baseSummary === "object" ? normalizeMemorySummary(baseSummary) : getMemorySummary(sessionId);
  const topics = unique([...current.active_topics, ...extractTopics(userMessage), ...extractTopics(assistantMessage)]).slice(-10);
  const dates = unique([...current.date_context, ...extractDates(userMessage), ...extractDates(assistantMessage)]).slice(-8);
  const openQuestions = unique([
    ...current.open_questions.filter((item) => !looksAnswered(item, assistantMessage)),
    ...extractQuestions(userMessage)
  ]).slice(-6);
  const lastIntent = summarizeIntent(userMessage);
  const summary = {
    active_topics: topics,
    date_context: dates,
    open_questions: openQuestions,
    last_intent: lastIntent,
    last_updated: new Date().toISOString()
  };
  summaryStore.set(sessionId, summary);
  return summary;
}

export function setMemorySummary(sessionId, summary) {
  const normalized = normalizeMemorySummary(summary);
  if (sessionId) summaryStore.set(sessionId, normalized);
  return normalized;
}

export function normalizeMemorySummary(value = {}) {
  return {
    active_topics: unique(Array.isArray(value.active_topics) ? value.active_topics : []).slice(-10),
    date_context: unique(Array.isArray(value.date_context) ? value.date_context : []).slice(-8),
    open_questions: unique(Array.isArray(value.open_questions) ? value.open_questions : []).slice(-6),
    last_intent: String(value.last_intent || "").slice(0, 220),
    last_updated: value.last_updated || null
  };
}

export function memorySummaryMessages(summary) {
  if (!summary || !hasSummary(summary)) return [];
  return [{
    role: "system",
    content: `CONVERSATION MEMORY SUMMARY:
Active topics: ${summary.active_topics.join(", ") || "none"}
Date context: ${summary.date_context.join(", ") || "none"}
Open questions: ${summary.open_questions.join(" | ") || "none"}
Last user intent: ${summary.last_intent || "none"}

Use this summary only as conversational context. Do not treat it as project evidence.`
  }];
}

export function emptyMemorySummary() {
  return {
    active_topics: [],
    date_context: [],
    open_questions: [],
    last_intent: "",
    last_updated: null
  };
}

const emptySummary = emptyMemorySummary;

function hasSummary(summary) {
  return Boolean(summary.active_topics?.length || summary.date_context?.length || summary.open_questions?.length || summary.last_intent);
}

function extractTopics(text) {
  const lower = String(text || "").toLowerCase();
  const patterns = [
    ["מעליות", /מעלית|מעליות|elevator/],
    ["בטיחות", /בטיחות|סיכון|תאונה|safety|risk|accident/],
    ["חשמל", /חשמל|לוח|כבל|תאורה|electric/],
    ["איטום", /איטום|נזילה|דליפה|leak|waterproof/],
    ["אלומיניום", /אלומיניום|aluminum|aluminium/],
    ["חשבוניות", /חשבונית|תשלום|קבלה|invoice|payment|receipt/],
    ["ריצוף", /ריצוף|floor|flooring/],
    ["מיזוג", /מיזוג|hvac|air condition/],
    ["אינסטלציה", /אינסטלציה|צנרת|plumbing/],
    ["חריגים", /חריג|שינוי|change order|exception/],
    ["אישורים", /אישור|approved|approval|submittal/],
    ["בקרת_איכות", /בקרת איכות|ליקוי|qc|quality|defect/]
  ];
  return patterns.filter(([, pattern]) => pattern.test(lower)).map(([topic]) => topic);
}

function extractDates(text) {
  return unique((String(text || "").match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|היום|אתמול|השבוע|החודש|בחודש האחרון|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר/gi) || []).map((item) => item.trim()));
}

function extractQuestions(text) {
  const value = String(text || "").trim();
  if (!value || !/[?？]|^(מה|מי|מתי|למה|איך|כיצד|האם|why|what|who|when|how)\b/i.test(value)) return [];
  return [value.slice(0, 220)];
}

function summarizeIntent(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (/למה|why|גורם|גרם|עיכוב|אחריות|אחראי/i.test(value)) return "חקירת סיבה/אחריות";
  if (/סטטוס|עדכן|מה קרה|status|update/i.test(value)) return "בדיקת סטטוס";
  if (/חשבונית|תשלום|invoice|payment/i.test(value)) return "בדיקה פיננסית";
  if (/בטיחות|safety/i.test(value)) return "בדיקת בטיחות";
  return value.slice(0, 120);
}

function looksAnswered(question, answer) {
  const text = String(answer || "");
  return text.includes("לא נמצא") || text.includes("תשובה") || text.length > 120 && question.length < 180;
}

function unique(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}
