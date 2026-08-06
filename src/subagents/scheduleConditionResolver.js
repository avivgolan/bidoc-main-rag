// Contract-condition resolver for the Schedule Intelligence Engine.
//
// The resolver is deliberately outside scheduleEngine.js: the chat/RAG path
// discovers evidence, while the deterministic calendar computes the due date.
// A condition is promoted only when a dated, cited trigger passes validation.

import { runChatPipeline } from "../agent.js";
import { getConfig, settingsOpenRouterApiKey } from "../config.js";
import { chatCompletion, extractJsonObject } from "../openrouter.js";
import { addCalendarDays, isWorkingDay, normalizeCalendar, toIsoDate } from "../scheduleCalendar.js";
import { scheduleDataRequest, scheduleSettings } from "../scheduleIngestion.js";
import { listScheduleConditions } from "./schedule.js";

export const CONDITION_RESOLVER_VERSION = "schedule-condition-resolver.v1";
export const MIN_AUTO_RESOLVE_CONFIDENCE = 0.8;

export function scheduleResolverError(error) {
  const message = String(error?.message || error || "Unknown resolver error");
  if (error?.httpStatus === 401 || /user not found|unauthorized|invalid api key/i.test(message)) {
    return {
      code: "openrouter_auth",
      message: "מפתח OpenRouter נדחה על ידי הספק (401). יש לעדכן מפתח תקין בהגדרות לפני הפעלת סוכן החיפוש."
    };
  }
  if (/settings_openrouter_key_missing/i.test(message)) {
    return {
      code: "settings_openrouter_key_missing",
      message: "לא נמצא מפתח OpenRouter תקין בטבלת agent_settings ב־MAIN. סוכן הלו״ז אינו משתמש במפתח מה־env."
    };
  }
  if (/project_id_filter|function .* does not exist|schema cache/i.test(message)) {
    return {
      code: "project_scope_unavailable",
      message: "מנוע החיפוש אינו תומך עדיין בסינון מאובטח לפי פרויקט, ולכן החיפוש נעצר בלי להרחיב את הגישה לפרויקטים אחרים."
    };
  }
  return { code: "resolver_error", message };
}

export function settingsOwnedAiConfig(baseConfig = {}, settingsKey = "") {
  const key = String(settingsKey || "").trim();
  if (!/^sk-/i.test(key)) throw new Error("settings_openrouter_key_missing");
  return { ...baseConfig, openRouterApiKey: key };
}

const PLANNER_SYSTEM_PROMPT = `You plan one evidence search for a construction-project schedule.
Given one contractual condition, identify the real-world trigger event whose date is required.
Return ONLY JSON: {"search_question":"...","event_description":"...","date_hint_from":null,"date_hint_to":null}.
The question must ask for one explicit historical event date and supporting document evidence.
For a recurring condition with trigger_event_date, ask only for a later occurrence.
Do not calculate the contractual due date. Do not assume the trigger occurred.`;

const VERIFIER_SYSTEM_PROMPT = `You verify a chat/RAG answer for a contractual schedule condition.
Return ONLY JSON with this schema:
{"status":"found|not_found|ambiguous","trigger_date":"YYYY-MM-DD|null","evidence_quote":"...|null","source_url":"...|null","source_title":"...|null","confidence":0.0,"reason":"..."}
Rules:
- found requires one explicit event date supported by the supplied answer/source list.
- never infer a date from relative wording, upload time, or the contractual offset.
- if sources conflict, the event is prospective, or the date is unclear, return ambiguous.
- confidence is evidence confidence, from 0 to 1. Use >=0.8 only for a direct dated source.`;

export function fallbackConditionQuestion(condition = {}) {
  const anchor = String(condition.anchor_description || "האירוע המפעיל").trim();
  const name = String(condition.name || "ההתחייבות החוזית").trim();
  const after = condition.recurring === true && toIsoDate(condition.trigger_event_date)
    ? ` חפש רק אירוע מאוחר מ-${toIsoDate(condition.trigger_event_date)}.`
    : "";
  return `מה התאריך המדויק שבו התרחש בפרויקט האירוע: "${anchor}"?${after} חפש מסמך או רשומה שמאשרים במפורש את תאריך האירוע, לצורך חישוב המועד החוזי של "${name}". החזר תאריך ומקור; אם אין ראיה חד-משמעית, אמור שלא נמצא.`;
}

export function normalizeEvidenceResult(raw = {}) {
  const status = ["found", "not_found", "ambiguous"].includes(raw.status) ? raw.status : "ambiguous";
  const triggerDate = toIsoDate(raw.trigger_date ?? raw.triggerDate);
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));
  const evidenceQuoteRaw = raw.evidence_quote ?? raw.evidenceQuote;
  const sourceUrlRaw = raw.source_url ?? raw.sourceUrl;
  const sourceTitleRaw = raw.source_title ?? raw.sourceTitle;
  const evidenceQuote = evidenceQuoteRaw ? String(evidenceQuoteRaw).slice(0, 2000) : null;
  const sourceUrl = sourceUrlRaw ? String(sourceUrlRaw).slice(0, 2000) : null;
  // A date without both a pinpoint excerpt and a traceable source is not safe
  // to turn into a contractual flag, even when the verifier labels it found.
  const supportedFound = status === "found" && triggerDate && evidenceQuote && sourceUrl;
  return {
    status: status === "found" && !supportedFound ? "ambiguous" : status,
    triggerDate,
    evidenceQuote,
    sourceUrl,
    sourceTitle: sourceTitleRaw ? String(sourceTitleRaw).slice(0, 500) : null,
    confidence,
    reason: String(raw.reason || "").slice(0, 1000)
  };
}

export function addWorkingDays(startIso, days, calendarInput) {
  const start = toIsoDate(startIso);
  const count = Number(days);
  const calendar = normalizeCalendar(calendarInput);
  if (!start || !calendar || !Number.isInteger(count) || count < 0) return null;
  let cursor = start;
  let remaining = count;
  while (remaining > 0) {
    cursor = addCalendarDays(cursor, 1);
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
  }
  return cursor;
}

function addCalendarMonths(startIso, months) {
  const start = toIsoDate(startIso);
  const amount = Number(months);
  if (!start || !Number.isInteger(amount)) return null;
  const [year, month, day] = start.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function resolveConditionDueDate(condition = {}, triggerDate, calendar = null) {
  const anchor = toIsoDate(triggerDate);
  const value = Number(condition.offset_value);
  if (!anchor || !Number.isFinite(value) || value < 0) return { dueDate: null, reason: "invalid_anchor_or_offset" };
  if (!Number.isInteger(value)) return { dueDate: null, reason: "fractional_offset_not_supported" };
  switch (condition.offset_unit) {
    case "calendar_days": return { dueDate: addCalendarDays(anchor, value), reason: null };
    case "weeks": return { dueDate: addCalendarDays(anchor, value * 7), reason: null };
    case "months": return { dueDate: addCalendarMonths(anchor, value), reason: null };
    case "working_days": {
      const dueDate = addWorkingDays(anchor, value, calendar);
      return { dueDate, reason: dueDate ? null : "working_calendar_missing" };
    }
    case "hours":
      return value % 24 === 0
        ? { dueDate: addCalendarDays(anchor, value / 24), reason: null }
        : { dueDate: null, reason: "subday_deadline_cannot_be_stored_as_date" };
    default: return { dueDate: null, reason: "unsupported_offset_unit" };
  }
}

export function milestoneKeyForCondition(condition = {}, triggerDate) {
  const base = `condition:${String(condition.condition_key || condition.id || "unknown")}`;
  return condition.recurring === true ? `${base}:${triggerDate}` : base;
}

export function promotionRows({ projectId, condition, evidence, dueDate, searchQuestion }) {
  const milestoneKey = milestoneKeyForCondition(condition, evidence.triggerDate);
  const combinedConfidence = Math.min(Number(condition.confidence) || 0.8, evidence.confidence);
  return {
    milestone: {
      project_id: projectId,
      milestone_key: milestoneKey,
      name: condition.name,
      contract_date: dueDate,
      is_project_completion: condition.is_project_completion === true,
      activity_key: null,
      status: "active",
      source_document_id: evidence.sourceUrl || condition.trigger_source_id || null,
      source_excerpt: [condition.source_excerpt, evidence.evidenceQuote].filter(Boolean).join("\n\nTrigger evidence: ").slice(0, 4000),
      confidence: combinedConfidence,
      written_by: "schedule_condition_resolver",
      extractor_version: CONDITION_RESOLVER_VERSION,
      metadata: {
        condition_key: condition.condition_key,
        trigger_date: evidence.triggerDate,
        trigger_source_url: evidence.sourceUrl,
        trigger_source_title: evidence.sourceTitle,
        search_question: searchQuestion,
        evidence_confidence: evidence.confidence
      }
    },
    conditionPatch: {
      status: condition.recurring === true ? "pending" : "resolved",
      resolved_milestone_key: milestoneKey,
      trigger_source_table: "chat_rag",
      trigger_source_id: evidence.sourceUrl || null,
      trigger_event_date: evidence.triggerDate
    }
  };
}

async function defaultPlanSearch({ condition, config }) {
  if (!config.openRouterApiKey) return { searchQuestion: fallbackConditionQuestion(condition), fallback: true };
  const ai = config.ai?.knowledgePlanner || {};
  try {
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.knowledgePlanner || config.models.main,
      temperature: 0,
      maxTokens: Math.min(ai.maxTokens || 900, 900),
      timeoutMs: ai.timeoutMs || 90_000,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(condition) }
      ]
    });
    const parsed = extractJsonObject(content);
    return { searchQuestion: String(parsed.search_question || fallbackConditionQuestion(condition)), plan: parsed };
  } catch (error) {
    return { searchQuestion: fallbackConditionQuestion(condition), fallback: true, error: error.message };
  }
}

async function defaultAskChat({ question, condition, projectId, config, runId }) {
  const instruction = `${question}\n\nהקשר חוזי: ${condition.source_excerpt || condition.name}. ` +
    `ענה רק על תאריך האירוע המפעיל, עם אסמכתא. אל תחשב את הדדליין החוזי ואל תשלים תאריך שאינו מופיע במקור.`;
  return runChatPipeline({
    message: instruction,
    sessionId: `schedule-condition:${projectId}:${condition.condition_key || condition.id}`,
    config: { ...config, projectId, requireProjectScope: true },
    runId,
    sourcesEnabled: true,
    deepResearch: false,
    attachments: [],
    ephemeral: true,
    forceRag: true
  });
}

async function defaultVerify({ chatResult, config }) {
  if (!config.openRouterApiKey) return normalizeEvidenceResult({ status: "ambiguous", reason: "OPENROUTER_API_KEY is missing" });
  const ai = config.ai?.knowledgePlanner || {};
  const content = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.knowledgePlanner || config.models.main,
    temperature: 0,
    maxTokens: 900,
    timeoutMs: ai.timeoutMs || 90_000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: VERIFIER_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ answer: chatResult.answer, sources: chatResult.sources || [] }) }
    ]
  });
  return normalizeEvidenceResult(extractJsonObject(content));
}

async function persistPromotion({ projectId, condition, evidence, dueDate, searchQuestion, config, settings }) {
  const rows = promotionRows({ projectId, condition, evidence, dueDate, searchQuestion });
  await scheduleDataRequest({
    config, settings,
    path: `/rest/v1/${settings.milestonesTable}?on_conflict=project_id,milestone_key`,
    options: {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: [rows.milestone]
    }
  });
  await scheduleDataRequest({
    config, settings,
    path: `/rest/v1/${settings.conditionsTable}?id=eq.${encodeURIComponent(condition.id)}&project_id=eq.${encodeURIComponent(projectId)}`,
    options: { method: "PATCH", headers: { Prefer: "return=minimal" }, body: rows.conditionPatch }
  });
  return rows;
}

export async function runScheduleConditionResolver({
  projectId,
  conditionId = null,
  limit = 10,
  commit = false,
  minConfidence = MIN_AUTO_RESOLVE_CONFIDENCE,
  config = null,
  settings: settingsInput = null,
  runId = null,
  planSearch = defaultPlanSearch,
  askChat = defaultAskChat,
  verify = defaultVerify,
  conditions: suppliedConditions = null,
  calendar: suppliedCalendar = undefined
} = {}) {
  if (!projectId) throw new Error("runScheduleConditionResolver: projectId is required");
  const settingsKey = settingsOpenRouterApiKey();
  const usesDefaultAi = planSearch === defaultPlanSearch || askChat === defaultAskChat || verify === defaultVerify;
  const aiConfig = usesDefaultAi
    ? settingsOwnedAiConfig(config || getConfig(), settingsKey)
    : (config || getConfig());
  const cfg = {
    ...aiConfig,
    // Deliberately override getConfig(): getConfig has a legacy env fallback,
    // while this resolver is owned by MAIN.agent_settings.
    projectId,
    requireProjectScope: true
  };
  const settings = settingsInput || scheduleSettings();
  const count = conditionId ? 1 : Math.min(Math.max(Number(limit) || 10, 1), 25);
  const loadedConditions = suppliedConditions || (await listScheduleConditions({ projectId, conditionId, status: "pending", config: cfg, settings })).conditions;
  const conditions = conditionId
    ? loadedConditions.filter((condition) => String(condition.id) === String(conditionId))
    : loadedConditions;
  if (conditionId && conditions.length !== 1) throw new Error(`Pending contractual condition not found: ${conditionId}`);
  let calendar = suppliedCalendar;
  if (calendar === undefined) {
    const rows = await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${settings.calendarsTable}?select=working_weekdays,holidays,holidays_through&project_id=eq.${encodeURIComponent(projectId)}&order=is_default.desc&limit=1`
    }).catch(() => []);
    calendar = rows[0] || null;
  }

  const results = [];
  for (const condition of conditions.slice(0, count)) {
    const item = { conditionId: condition.id, conditionKey: condition.condition_key, name: condition.name, status: "pending" };
    try {
      // Fail before spending three model calls when the stored contractual
      // rule cannot be represented by the date-only milestone schema.
      const arithmeticCheck = resolveConditionDueDate(condition, "2000-01-01", calendar);
      if (!arithmeticCheck.dueDate) {
        item.status = "needs_review";
        item.reason = arithmeticCheck.reason;
        results.push(item);
        continue;
      }
      const plan = await planSearch({ condition, projectId, config: cfg });
      item.searchQuestion = plan.searchQuestion || fallbackConditionQuestion(condition);
      item.planFallback = plan.fallback === true;
      const chatResult = await askChat({
        question: item.searchQuestion,
        condition,
        projectId,
        config: cfg,
        runId: runId ? `${runId}:${condition.id}` : null
      });
      item.chatAnswer = String(chatResult.answer || "").slice(0, 3000);
      item.sources = chatResult.sources || [];
      const evidence = normalizeEvidenceResult(await verify({ chatResult, condition, projectId, config: cfg }));
      item.evidence = evidence;
      if (evidence.status !== "found" || evidence.confidence < Number(minConfidence)) {
        item.status = evidence.status === "not_found" ? "not_found" : "needs_review";
        item.reason = evidence.reason || "No high-confidence dated evidence";
        results.push(item);
        continue;
      }
      const resolved = resolveConditionDueDate(condition, evidence.triggerDate, calendar);
      item.dueDate = resolved.dueDate;
      if (!resolved.dueDate) {
        item.status = "needs_review";
        item.reason = resolved.reason;
        results.push(item);
        continue;
      }
      item.status = commit ? "resolved" : "ready";
      item.milestoneKey = milestoneKeyForCondition(condition, evidence.triggerDate);
      if (commit) await persistPromotion({ projectId, condition, evidence, dueDate: resolved.dueDate, searchQuestion: item.searchQuestion, config: cfg, settings });
    } catch (error) {
      const normalizedError = scheduleResolverError(error);
      item.status = "error";
      item.errorCode = normalizedError.code;
      item.reason = normalizedError.message;
    }
    results.push(item);
  }

  const summary = Object.fromEntries(["resolved", "ready", "not_found", "needs_review", "error"]
    .map((status) => [status, results.filter((item) => item.status === status).length]));
  return { ok: true, resolverVersion: CONDITION_RESOLVER_VERSION, projectId, commit, processed: results.length, remaining: Math.max(conditions.length - results.length, 0), summary, results };
}
