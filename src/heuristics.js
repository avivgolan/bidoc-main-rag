export function heuristicClassification(message) {
  const text = String(message || "").toLowerCase();
  const isChat = /^(שלום|היי|הי|תודה|hello|hi|thanks|thank you|מי אתה)/i.test(text.trim());
  if (isChat) {
    return { type: "CHAT", complexity: "GENERAL", tool_hint: "none", urgency: "NORMAL", date_from: null, date_to: null, hashtags: [] };
  }

  const rules = [
    [/חשבונית|תשלום|קבלה|invoice|payment|receipt/, "financial_transactions", "SPECIFIC"],
    [/בטיחות|תאונה|דליפה|נזילה|סיכון|safety|accident|leak/, "safety_report,alert", "GENERAL", "HIGH"],
    [/פגם|ליקוי|qc|quality|defect/, "quality_control", "SPECIFIC"],
    [/אישור|חומר|אספקה|אלומיניום|submittal|material|delivery/, "submittals", "SPECIFIC"],
    [/ישיבה|החלטה|דדליין|אושר|meeting|decision|deadline|approved/, "meetings", "GENERAL"],
    [/מייל|email|letter|correspondence/, "emails", "SPECIFIC"],
    [/וואטסאפ|whatsapp|תמונה|photos?/, "whatsapp_messages", "SPECIFIC"],
    [/דוח|יועץ|פיקוח|engineering|consultant|inspection/, "consultants_reports", "SPECIFIC"]
  ];

  for (const [pattern, tool, complexity, urgency = "NORMAL"] of rules) {
    if (pattern.test(text)) return { type: "RAG", complexity, tool_hint: tool, urgency, date_from: null, date_to: null, hashtags: extractHeuristicHashtags(message) };
  }
  return { type: "RAG", complexity: "GENERAL", tool_hint: "alert", urgency: "NORMAL", date_from: null, date_to: null, hashtags: extractHeuristicHashtags(message) };
}

export function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(String(text || ""));
}

function extractHeuristicHashtags(message) {
  const text = String(message || "").toLowerCase();
  const tags = [
    ["מעליות", /מעלית|מעליות|elevator/],
    ["בטיחות", /בטיחות|סיכון|תאונה|safety|risk|accident/],
    ["חשמל", /חשמל|לוח|כבל|תאורה|electric/],
    ["איטום", /איטום|נזילה|דליפה|leak|waterproof/],
    ["אלומיניום", /אלומיניום|aluminum|aluminium/],
    ["חשבוניות", /חשבונית|תשלום|קבלה|invoice|payment|receipt/],
    ["ריצוף", /ריצוף|floor|flooring/],
    ["מיזוג", /מיזוג|hvac|air condition/],
    ["אינסטלציה", /אינסטלציה|צנרת|plumbing/],
    ["חריגים", /חריג|חריגים|שינוי|change order|exception/],
    ["אישורים", /אישור|אישורים|approved|approval|submittal/],
    ["בקרת_איכות", /בקרת איכות|ליקוי|qc|quality|defect/]
  ];
  return tags.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}
