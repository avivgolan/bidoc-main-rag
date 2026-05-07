import { chatCompletion, extractJsonObject } from "./openrouter.js";
import { defaultPrompts, renderPrompt } from "./prompts.js";
import { getProjectDateTime } from "./clock.js";

export async function classifyMessage({ message, config }) {
  const currentDate = getProjectDateTime(config.timezone);
  const systemPrompt = renderPrompt(config.prompts?.classifier || defaultPrompts().classifier, {
    currentDate
  });
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.classifier,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
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
    hashtags: normalizeHashtags(value?.hashtags),
    professional: Boolean(value?.professional),
    professional_reason: typeof value?.professional_reason === "string" ? value.professional_reason : "",
    knowledge_tags: normalizeHashtags(value?.knowledge_tags),
    investigation: Boolean(value?.investigation),
    investigation_reason: typeof value?.investigation_reason === "string" ? value.investigation_reason : ""
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
