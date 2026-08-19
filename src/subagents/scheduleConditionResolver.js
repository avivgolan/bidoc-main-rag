// Contract-condition resolver for the Schedule Intelligence Engine.
//
// The resolver is deliberately outside scheduleEngine.js: the chat/RAG path
// discovers evidence, while the deterministic calendar computes the due date.
// A condition is promoted only when a dated, cited trigger passes validation.

import { runChatPipeline } from "../agent.js";
import { getConfig, settingsOpenRouterApiKey } from "../config.js";
import { chatCompletion, extractJsonObject } from "../openrouter.js";
import { addCalendarDays, calendarCoverageState, isWorkingDay, normalizeCalendar, toIsoDate } from "../scheduleCalendar.js";
import { loadScheduleSource, scheduleDataRequest, scheduleRpcRequest, scheduleSettings } from "../scheduleIngestion.js";
import { resolveIndicatorProjectContext } from "../indicator/contractConditions.js";

export const CONDITION_RESOLVER_VERSION = "schedule-condition-resolver.v1";
export const MIN_AUTO_RESOLVE_CONFIDENCE = 0.8;
export const SCHEDULE_CONDITION_RESOLVE_RPC = "bidoc_schedule_resolve_condition_v1";

const COMMENCEMENT_TASK_ALIASES = new Set([
  "צו תחילת עבודה",
  "תחילת עבודה",
  "תחילת העבודות",
  "מועד תחילת העבודות"
]);

function normalizedLabel(value) {
  return String(value || "").normalize("NFC").replace(/[\s־–—-]+/gu, " ").trim();
}

function structuredEvidence(candidates, source) {
  const dated = candidates.filter((candidate) => toIsoDate(candidate.triggerDate));
  const dates = [...new Set(dated.map((candidate) => toIsoDate(candidate.triggerDate)))];
  if (!dated.length) return { status: "not_found", reason: `No dated ${source} trigger matched.` };
  if (dates.length !== 1) {
    return {
      status: "ambiguous",
      reason: `Structured ${source} sources contain conflicting trigger dates.`,
      candidates: dated
    };
  }
  const candidate = dated[0];
  return {
    status: "found",
    triggerDate: dates[0],
    evidenceQuote: candidate.evidenceQuote,
    sourceUrl: candidate.sourceUrl || null,
    sourceTitle: candidate.sourceTitle || source,
    sourceTable: candidate.sourceTable || source,
    sourceId: candidate.sourceId || null,
    sourceExternalId: candidate.sourceExternalId || null,
    confidence: Number(candidate.confidence) || 1,
    reason: `Matched one unambiguous ${source} trigger date.`
  };
}

export async function findStructuredTriggerEvidence({
  condition,
  sourceProjectId,
  scheduleProjectId,
  config,
  settings
} = {}) {
  const triggerKind = String(condition?.anchor_kind === "schedule_task"
    ? condition?.metadata?.trigger_kind || condition?.trigger_kind || "commencement_of_works"
    : condition?.metadata?.trigger_kind || condition?.trigger_kind || "");

  if (triggerKind === "commencement_of_works") {
    const source = await loadScheduleSource({ config, projectId: sourceProjectId, settings });
    const candidates = source.tasks
      .filter((task) => task.isSummary !== true && COMMENCEMENT_TASK_ALIASES.has(normalizedLabel(task.name)))
      .map((task) => ({
        triggerDate: task.plannedStart || task.plannedFinish,
        evidenceQuote: `${task.name} — ${task.plannedStart || task.plannedFinish}`,
        sourceTitle: source.scheduleMeta.displayName || "לוח הקבלן",
        sourceUrl: `/api/schedule/versions?projectId=${encodeURIComponent(sourceProjectId)}`,
        sourceTable: "gantt_tasks_test",
        sourceExternalId: String(task.stableKey),
        confidence: 1
      }));
    const gantt = structuredEvidence(candidates, "gantt_tasks_test");
    if (gantt.status !== "not_found") return gantt;
  }

  if (!triggerKind) return { status: "not_found", reason: "The contract condition has no controlled trigger kind." };
  const events = await scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/schedule_observed_events?select=id,event_type,event_date,source_table,source_id,source_page,evidence_text,confidence,human_status&project_id=eq.${encodeURIComponent(scheduleProjectId)}&event_type=eq.${encodeURIComponent(triggerKind)}&order=event_date.asc`
  }).catch((error) => {
    if (error.missingTable) return [];
    throw error;
  });
  const reviewed = events.filter((event) =>
    ["approved", "confirmed", "reviewed"].includes(String(event.human_status || ""))
    && Number(event.confidence) >= MIN_AUTO_RESOLVE_CONFIDENCE
  );
  return structuredEvidence(reviewed.map((event) => ({
    triggerDate: event.event_date,
    evidenceQuote: event.evidence_text,
    sourceTitle: event.source_table || "schedule_observed_events",
    sourceTable: "schedule_observed_events",
    sourceId: event.id,
    sourceExternalId: event.source_id,
    confidence: event.confidence
  })), "schedule_observed_events");
}

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
      if (!dueDate) return { dueDate: null, reason: "working_calendar_missing" };
      const normalized = normalizeCalendar(calendar);
      return calendarCoverageState(normalized, dueDate) === "ok"
        ? { dueDate, reason: null }
        : { dueDate: null, reason: "working_calendar_coverage_incomplete", provisionalDueDate: dueDate };
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
      trigger_source_id: evidence.sourceId || null,
      trigger_event_date: evidence.triggerDate,
      metadata: {
        ...(condition.metadata || {}),
        trigger_evidence: evidence
      }
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

async function persistPromotion({ projectId, condition, evidence, dueDate, searchQuestion, pendingReason = null, config, settings }) {
  const rows = promotionRows({ projectId, condition, evidence, dueDate, searchQuestion });
  const result = await scheduleRpcRequest({
    config,
    settings,
    rpc: SCHEDULE_CONDITION_RESOLVE_RPC,
    payload: {
      p_condition_id: condition.id,
      p_project_id: projectId,
      p_trigger_date: evidence.triggerDate,
      p_due_date: dueDate,
      p_trigger_source_table: evidence.sourceTable || "chat_rag",
      p_trigger_source_id: evidence.sourceId || null,
      p_trigger_evidence: {
        ...evidence,
        searchQuestion
      },
      p_confidence: evidence.confidence,
      p_extractor_version: CONDITION_RESOLVER_VERSION,
      p_pending_reason: pendingReason
    }
  });
  return { ...rows, result };
}

async function loadPendingConditions({ projectId, conditionId, contractOnly = false, config, settings }) {
  const filters = [`project_id=eq.${encodeURIComponent(projectId)}`, "status=eq.pending"];
  if (conditionId) filters.push(`id=eq.${encodeURIComponent(conditionId)}`);
  if (contractOnly) filters.push("source_contract_decision_id=not.is.null");
  return scheduleDataRequest({
    config,
    settings,
    path: `/rest/v1/${settings.conditionsTable}?select=*&${filters.join("&")}&order=category.asc,name.asc`
  });
}

function storedTriggerEvidence(condition) {
  const triggerDate = toIsoDate(condition?.trigger_event_date);
  if (!triggerDate) return null;
  const stored = condition?.metadata?.trigger_evidence || {};
  return {
    status: "found",
    triggerDate,
    evidenceQuote: stored.evidenceQuote || condition.source_excerpt || condition.name,
    sourceUrl: stored.sourceUrl || null,
    sourceTitle: stored.sourceTitle || condition.trigger_source_table || null,
    sourceTable: stored.sourceTable || condition.trigger_source_table || "stored_trigger",
    sourceId: stored.sourceId || condition.trigger_source_id || null,
    sourceExternalId: stored.sourceExternalId || null,
    confidence: Math.max(Number(stored.confidence) || Number(condition.confidence) || MIN_AUTO_RESOLVE_CONFIDENCE, MIN_AUTO_RESOLVE_CONFIDENCE),
    reason: "Reused previously verified trigger evidence."
  };
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
  findStructured = findStructuredTriggerEvidence,
  persistResolution = persistPromotion,
  conditions: suppliedConditions = null,
  calendar: suppliedCalendar = undefined,
  projectContext: suppliedProjectContext = null,
  contractOnly = false,
  manualTriggerDate = null,
  env = process.env
} = {}) {
  if (!projectId) throw new Error("runScheduleConditionResolver: projectId is required");
  const hasManualTriggerDate = manualTriggerDate != null && String(manualTriggerDate).trim() !== "";
  const normalizedManualTriggerDate = hasManualTriggerDate ? toIsoDate(String(manualTriggerDate).trim()) : null;
  if (hasManualTriggerDate && !normalizedManualTriggerDate) {
    throw new Error("manualTriggerDate must be an ISO date (YYYY-MM-DD)");
  }
  if (hasManualTriggerDate && !conditionId) {
    throw new Error("manualTriggerDate requires one conditionId");
  }
  const aiConfig = config || getConfig();
  const cfg = {
    ...aiConfig,
    projectId,
    requireProjectScope: true
  };
  const settings = settingsInput || scheduleSettings();
  const projectContext = suppliedProjectContext || await resolveIndicatorProjectContext({
    projectId,
    config: cfg,
    settings,
    env
  });
  const sourceProjectId = projectContext.sourceProjectId;
  const scheduleProjectId = projectContext.scheduleProjectId;
  const count = conditionId ? 1 : Math.min(Math.max(Number(limit) || 10, 1), 25);
  const loadedConditions = suppliedConditions || await loadPendingConditions({
    projectId: scheduleProjectId,
    conditionId,
    contractOnly,
    config: cfg,
    settings
  });
  const conditions = conditionId
    ? loadedConditions.filter((condition) => String(condition.id) === String(conditionId))
    : loadedConditions;
  if (conditionId && conditions.length !== 1) throw new Error(`Pending contractual condition not found: ${conditionId}`);
  let calendar = suppliedCalendar;
  if (calendar === undefined) {
    const rows = await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${settings.calendarsTable}?select=working_weekdays,holidays,holidays_through&project_id=eq.${encodeURIComponent(scheduleProjectId)}&order=is_default.desc&limit=1`
    }).catch(() => []);
    calendar = rows[0] || null;
  }

  const results = [];
  for (const condition of conditions.slice(0, count)) {
    const item = { conditionId: condition.id, conditionKey: condition.condition_key, name: condition.name, status: "pending" };
    try {
      const offsetValue = Number(condition.offset_value);
      const unsupported = !Number.isInteger(offsetValue) || offsetValue < 0
        ? "fractional_offset_not_supported"
        : condition.offset_unit === "hours" && offsetValue % 24 !== 0
          ? "subday_deadline_cannot_be_stored_as_date"
          : !["calendar_days", "weeks", "months", "working_days", "hours"].includes(condition.offset_unit)
            ? "unsupported_offset_unit"
            : null;
      if (unsupported) {
        item.status = "needs_review";
        item.reason = unsupported;
        results.push(item);
        continue;
      }
      let evidence = normalizedManualTriggerDate ? {
        status: "found",
        triggerDate: normalizedManualTriggerDate,
        evidenceQuote: `תאריך האירוע הוזן ידנית בלוח הזמנים: ${normalizedManualTriggerDate}`,
        sourceUrl: null,
        sourceTitle: "אימות ידני בעמוד Schedule",
        sourceTable: "manual_schedule_input",
        sourceId: null,
        confidence: 1,
        reason: "manual_trigger_date"
      } : storedTriggerEvidence(condition);
      if (normalizedManualTriggerDate) {
        item.evidenceSource = "manual_schedule_input";
        item.searchQuestion = "Manual trigger date supplied by an authorized Schedule user";
      } else if (evidence) {
        item.evidenceSource = "stored";
      } else {
        const structured = await findStructured({
          condition,
          sourceProjectId,
          scheduleProjectId,
          projectId,
          config: cfg,
          settings
        });
        if (structured?.status === "ambiguous") {
          item.status = "needs_review";
          item.reason = structured.reason || "Structured trigger sources conflict";
          item.structuredCandidates = structured.candidates || [];
          results.push(item);
          continue;
        }
        if (structured?.status === "found") {
          evidence = structured;
          item.evidenceSource = structured.sourceTable || "structured";
          item.searchQuestion = `Structured trigger lookup: ${condition.anchor_description || condition.name}`;
        }
      }
      if (!evidence) {
        const usesDefaultAi = planSearch === defaultPlanSearch || askChat === defaultAskChat || verify === defaultVerify;
        const ragConfig = usesDefaultAi
          ? settingsOwnedAiConfig(cfg, settingsOpenRouterApiKey())
          : cfg;
        const plan = await planSearch({ condition, projectId: sourceProjectId, config: ragConfig });
        item.searchQuestion = plan.searchQuestion || fallbackConditionQuestion(condition);
        item.planFallback = plan.fallback === true;
        const chatResult = await askChat({
          question: item.searchQuestion,
          condition,
          projectId: sourceProjectId,
          config: ragConfig,
          runId: runId ? `${runId}:${condition.id}` : null
        });
        item.chatAnswer = String(chatResult.answer || "").slice(0, 3000);
        item.sources = chatResult.sources || [];
        evidence = normalizeEvidenceResult(await verify({ chatResult, condition, projectId: sourceProjectId, config: ragConfig }));
        evidence.sourceTable = "chat_rag";
        evidence.sourceId = null;
        item.evidenceSource = "chat_rag";
      }
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
        item.provisionalDueDate = resolved.provisionalDueDate || null;
        if (commit && evidence.triggerDate) {
          await persistResolution({
            projectId: scheduleProjectId,
            condition,
            evidence,
            dueDate: null,
            searchQuestion: item.searchQuestion || "Stored trigger evidence",
            pendingReason: resolved.reason,
            config: cfg,
            settings
          });
          item.triggerSaved = true;
        }
        results.push(item);
        continue;
      }
      item.status = commit ? "resolved" : "ready";
      item.milestoneKey = milestoneKeyForCondition(condition, evidence.triggerDate);
      if (commit) await persistResolution({
        projectId: scheduleProjectId,
        condition,
        evidence,
        dueDate: resolved.dueDate,
        searchQuestion: item.searchQuestion || "Stored trigger evidence",
        config: cfg,
        settings
      });
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
  return {
    ok: true,
    resolverVersion: CONDITION_RESOLVER_VERSION,
    projectId: sourceProjectId,
    scheduleProjectId,
    commit,
    processed: results.length,
    remaining: Math.max(conditions.length - results.length, 0),
    summary,
    results
  };
}
