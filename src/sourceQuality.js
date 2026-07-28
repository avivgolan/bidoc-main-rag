const QUALITY_BY_TOOL = {
  safety_report: { score: 95, level: "HIGH", label: "דוח בטיחות רשמי" },
  quality_control: { score: 92, level: "HIGH", label: "בקרת איכות רשמית" },
  consultants_reports: { score: 90, level: "HIGH", label: "דוח יועצים/פיקוח" },
  submittals: { score: 88, level: "HIGH", label: "אישורי חומרים/מעקב מסירות" },
  financial_transactions: { score: 86, level: "HIGH", label: "מסמך פיננסי" },
  meetings: { score: 78, level: "MEDIUM_HIGH", label: "סיכום ישיבה/החלטות" },
  meeting_evidence_search: { score: 78, level: "MEDIUM_HIGH", label: "ראיות מתועדות מישיבה" },
  emails: { score: 74, level: "MEDIUM_HIGH", label: "תכתובת מייל" },
  alert: { score: 70, level: "MEDIUM", label: "התראה/תקציר מערכת" },
  hybrid_search: { score: 68, level: "MEDIUM", label: "אינדקס פרויקט" },
  hybrid_search_plan: { score: 64, level: "MEDIUM", label: "חיפוש אינדקס לפי תכנון מקצועי" },
  reranker: { score: 60, level: "MEDIUM", label: "דירוג רלוונטיות" },
  whatsapp_messages: { score: 52, level: "LOW_MEDIUM", label: "עדכוני וואטסאפ/שטח" }
};

const CONFLICT_RULES = [
  { id: "approval", positive: /(^|[^א-תa-z])(?:מאושר|אושר|approved|accepted)([^א-תa-z]|$)/i, negative: /(?:לא\s+מאושר|לא\s+אושר|נדחה|rejected|not\s+approved)/i, label: "סטטוס אישור" },
  { id: "completion", positive: /(?:בוצע|הושלם|נסגר|completed|closed|done)/i, negative: /(?:לא\s+בוצע|טרם\s+בוצע|פתוח|open|pending|not\s+completed)/i, label: "סטטוס ביצוע" },
  { id: "safety", positive: /(?:תקין|אין\s+סיכון|עבר|safe|passed)/i, negative: /(?:סיכון|מסוכן|נכשל|ליקוי|unsafe|failed|violation)/i, label: "מצב בטיחות/תקינות" },
  { id: "payment", positive: /(?:שולם|paid|settled)/i, negative: /(?:לא\s+שולם|פתוח|pending|unpaid|overdue)/i, label: "סטטוס תשלום" }
];

export function qualityForTool(toolName) {
  return QUALITY_BY_TOOL[toolName] || { score: 50, level: "UNKNOWN", label: "מקור לא מסווג" };
}

export function annotateToolCall(call) {
  return {
    ...call,
    sourceQuality: {
      ...qualityForTool(call.toolName),
      rationale: call.toolName === "whatsapp_messages"
        ? "מקור שטח לא רשמי; שימושי לאיתור הקשר אך דורש אימות מול מקור רשמי."
        : call.toolName === "hybrid_search" || call.toolName === "hybrid_search_plan"
          ? "תוצאה מאינדקס הפרויקט; אמינה כאשר יש מקור/מטאדאטה ברור."
          : "מקור מובנה במערכת הפרויקט."
    }
  };
}

export function buildSourceQualitySummary(toolCalls) {
  const successful = (toolCalls || []).filter((call) => call.ok);
  if (!successful.length) {
    return {
      overall: "NO_SOURCES",
      bestScore: 0,
      primarySources: [],
      note: "לא התקבלו מקורות מוצלחים להערכת איכות."
    };
  }
  const ranked = successful
    .map((call) => ({ toolName: call.toolName, ...qualityForTool(call.toolName) }))
    .sort((a, b) => b.score - a.score);
  const bestScore = ranked[0].score;
  return {
    overall: bestScore >= 85 ? "HIGH" : bestScore >= 70 ? "MEDIUM_HIGH" : bestScore >= 55 ? "MEDIUM" : "LOW",
    bestScore,
    primarySources: ranked.slice(0, 5),
    note: ranked[0].label
  };
}

export function detectConflicts(toolCalls) {
  const evidence = (toolCalls || [])
    .filter((call) => call.ok && call.data != null)
    .map((call) => ({ toolName: call.toolName, text: compactText(call.data) }))
    .filter((item) => item.text);

  const conflicts = [];
  for (const rule of CONFLICT_RULES) {
    const positives = evidence.filter((item) => rule.positive.test(item.text) && !rule.negative.test(item.text));
    const negatives = evidence.filter((item) => rule.negative.test(item.text));
    if (positives.length && negatives.length) {
      conflicts.push({
        type: rule.id,
        label: rule.label,
        severity: "MEDIUM",
        message: `נמצאו אינדיקציות סותרות לגבי ${rule.label}.`,
        positiveTools: [...new Set(positives.map((item) => item.toolName))],
        negativeTools: [...new Set(negatives.map((item) => item.toolName))]
      });
    }
  }
  return conflicts;
}

function compactText(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return text.replace(/\s+/g, " ").slice(0, 12000);
}
