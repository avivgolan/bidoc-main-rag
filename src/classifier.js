import { chatCompletion, extractJsonObject } from "./openrouter.js";
import { defaultPrompts, renderPrompt } from "./prompts.js";
import { getProjectDateTime } from "./clock.js";

export async function classifyMessage({ message, context = "", config, telemetry = null }) {
  const currentDate = getProjectDateTime(config.timezone);
  const systemPrompt = `${renderPrompt(config.prompts?.classifier || defaultPrompts().classifier, {
    currentDate
  })}\n\nAlso return standalone_query: rewrite the latest user message into a self-contained query using the bounded conversation context. Preserve the user's language and meaning. If no rewrite is needed, copy the user message.`;
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.classifier,
    temperature: config.ai?.classifier?.temperature ?? 0,
    maxTokens: config.ai?.classifier?.maxTokens ?? 900,
    timeoutMs: config.ai?.classifier?.timeoutMs ?? 90_000,
    topP: config.ai?.classifier?.topP ?? 1,
    frequencyPenalty: config.ai?.classifier?.frequencyPenalty ?? 0,
    presencePenalty: config.ai?.classifier?.presencePenalty ?? 0,
    seed: config.ai?.classifier?.seed ?? null,
    telemetry,
    messages: [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "system", content: `BOUNDED CONVERSATION CONTEXT (not project evidence):\n${context}` }] : []),
      { role: "user", content: message }
    ]
  });
  return normalizeClassification(extractJsonObject(content), message);
}

export function normalizeClassification(value, originalMessage = "") {
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
    hashtags: normalizeHashtags(value?.hashtags),
    professional: Boolean(value?.professional),
    professional_reason: typeof value?.professional_reason === "string" ? value.professional_reason : "",
    knowledge_tags: normalizeHashtags(value?.knowledge_tags),
    investigation: Boolean(value?.investigation),
    investigation_reason: typeof value?.investigation_reason === "string" ? value.investigation_reason : "",
    standalone_query: typeof value?.standalone_query === "string" && value.standalone_query.trim()
      ? value.standalone_query.trim().slice(0, 4000)
      : String(originalMessage || "").trim().slice(0, 4000)
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
