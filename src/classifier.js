import { chatCompletion, extractJsonObject } from "./openrouter.js";

export function classifierPrompt(currentDate) {
  return `You are a Senior Project Manager Assistant for the JFrog construction project.

the date now is ${currentDate}

Your Goal: Analyze the user's incoming query and classify it.

Output MUST be a valid JSON object with EXACTLY these keys:
- "type": "CHAT" (greeting/smalltalk) OR "RAG" (asking for project info)
- "complexity": "GENERAL" (broad questions: status, what happened, updates) OR "SPECIFIC" (specific document, invoice, report number, or technical detail)
- "tool_hint": A comma-separated string of the MOST likely tools needed. Use "none" if type is CHAT.
- "urgency": "HIGH" (safety risk, accident, leak, structural issue) OR "NORMAL"
- "date_from": ISO timestamp (YYYY-MM-DDTHH:mm:ssZ) of the START of the date range. Use null if no date is mentioned.
- "date_to": ISO timestamp (YYYY-MM-DDTHH:mm:ssZ) of the END of the date range. Use null if no date is mentioned.
- "hashtags": An array of the most relevant topic hashtags WITHOUT the # symbol. Use [] if none are clear.

Tools Available:
[Group A - General/Status]:
- alert (Critical issues, leaks, breaks, open alerts, project status - ALWAYS first stop)
- whatsapp_messages (Informal updates, photos, site coordination)
- emails (Formal correspondence)
- meetings (Decisions made, deadlines, approvals, "when was it decided?")

[Group B - Specific/Technical]:
- financial_transactions (Invoices, payments, vendor receipts)
- consultants_reports (Engineering, supervision, inspection reports)
- exceptions_report (Change orders, extra costs, scope changes)
- quality_control (QC findings, defects, open items)
- safety_report (Safety violations, risk levels, site safety)
- submittals (Material approvals, LLI tracking, delivery dates)

Classification Logic:
1. Money/Invoices -> financial_transactions
2. "What happened?" / "Status update" / "Update me" -> alert
3. "When was X decided?" / "Deadline?" / "Was this approved?" -> meetings (add submittals if material related)
4. Safety/Accident/Leak -> safety_report,alert - urgency: HIGH
5. Defect/QC issue -> quality_control
6. Material approval/delivery -> submittals
7. Engineering/technical report -> consultants_reports
8. WhatsApp/site photos/informal -> whatsapp_messages
9. Emails/formal letters -> emails

Hashtag Extraction:
- Extract short topic tags that likely exist in the project index.
- Prefer exact project/domain topics from the user query.
- Use Hebrew when the user writes Hebrew.
- Examples: "מעליות", "בטיחות", "חשמל", "איטום", "אלומיניום", "חשבוניות", "ריצוף", "מיזוג", "אינסטלציה", "חריגים", "אישורים", "בקרת_איכות".
- Return tags without "#".

Do not include markdown formatting. Output ONLY the JSON object.`;
}

export async function classifyMessage({ message, config, now = new Date() }) {
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.classifier,
    temperature: 0,
    messages: [
      { role: "system", content: classifierPrompt(now.toISOString()) },
      { role: "user", content: message }
    ]
  });
  return normalizeClassification(extractJsonObject(content));
}

export function normalizeClassification(value) {
  const type = value?.type === "CHAT" ? "CHAT" : "RAG";
  const complexity = value?.complexity === "SPECIFIC" ? "SPECIFIC" : "GENERAL";
  const urgency = value?.urgency === "HIGH" ? "HIGH" : "NORMAL";
  return {
    type,
    complexity,
    tool_hint: typeof value?.tool_hint === "string" ? value.tool_hint : type === "CHAT" ? "none" : "alert",
    urgency,
    date_from: value?.date_from || null,
    date_to: value?.date_to || null,
    hashtags: normalizeHashtags(value?.hashtags)
  };
}

export function normalizeHashtags(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return [...new Set(
    raw
      .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
      .filter(Boolean)
  )].slice(0, 8);
}

export function hintedTools(classification) {
  if (!classification || classification.type === "CHAT") return [];
  return String(classification.tool_hint || "")
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool) => tool && tool !== "none");
}
