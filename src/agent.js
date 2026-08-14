import { sanitizeMessage } from "./sanitize.js";
import { classifyMessage, hintedTools } from "./classifier.js";
import { heuristicClassification, isHebrew } from "./heuristics.js";
import { chatCompletion, extractJsonObject, rerankWithLlm } from "./openrouter.js";
import { graphSearch, hybridSearch, saveMessage, updateMessage } from "./supabase.js";
import { buildToolOrder, callN8nTool, extractLinks, buildInternalSourceUrl, isInternalProjectTool } from "./tools.js";
import { runAlertAgent } from "./subagents/alert.js";
import {
  callInternalContentTool,
  fetchEmailAttachmentByReference,
  fetchFinancialTransactionsByIds,
  fetchSafetyAttachmentByReference,
  fetchSafetyReportsByIds,
  isInternalContentTool
} from "./subagents/contentTools.js";
import {
  classifyDataQueryCapability,
  dataQuerySettings,
  runDataQueryAgent,
  summarizeDataQueryCallerForWorkflow,
  summarizeDataQueryMachineResultForWorkflow,
  summarizeDataQueryMetricsForWorkflow,
  summarizeDataQueryQuestionForWorkflow,
  summarizeDataQueryRoutingForWorkflow,
  summarizeDataQueryWarningsForWorkflow
} from "./subagents/dataQuery.js";
import { dataQueryFinancialTypeForStoredValue } from "./subagents/dataQueryFinancialLexicon.js";
import { DATA_QUERY_EXCEPTION_CURRENCY, DATA_QUERY_EXCEPTION_VAT_RATE } from "./subagents/dataQueryMetadata.js";
import { formatMeetingCitation, runMeetingEvidenceAgent } from "./subagents/meeting.js";
import { runExceptionEvidenceAgent } from "./subagents/exceptionEvidence.js";
import { runConsultantReportEvidenceAgent } from "./subagents/consultantReportEvidence.js";
import {
  applyExplicitMemoryCommand,
  buildClassifierContext,
  estimateTokens,
  finalizeChatMemory,
  loadAgentMemory,
  loadRoutingMemory,
  memoryMessagesForAgent
} from "./chatMemory.js";
import { completeRun, emitRunEvent, getRunEvents } from "./runLog.js";
import { renderPrompt, defaultPrompts } from "./prompts.js";
import { getProjectDateTime } from "./clock.js";
import { routeKnowledgeAgents, searchKnowledgeBase } from "./knowledge.js";
import { getConfig, TOOL_NAMES } from "./config.js";
import { annotateToolCall, buildSourceQualitySummary, detectConflicts } from "./sourceQuality.js";
import { buildGraphSearchPayload, summarizeGraphContext } from "./projectGraph.js";
import { CACHE_TTL, cachedOperation, createCacheContext, finalizeCacheMetrics, hashValue } from "./cache.js";
import { appendMemoryLog } from "./memoryLogger.js";

export const KNOWLEDGE_PLANNER_RESPONSE_FORMAT = { type: "json_object" };

export async function runChatPipeline({ message, sessionId, userId = null, config, runId, sourcesEnabled = true, deepResearch = false, attachments = [], ephemeral = false, forceRag = false }) {
  const cacheContext = createCacheContext({ config, runId, emit: emitRunEvent });
  const openRouterCalls = [];
  let openRouterCallSequence = 0;
  const telemetryFor = (step) => ({
    step,
    callId: `${step}_${++openRouterCallSequence}`,
    record: (entry) => {
      openRouterCalls.push(entry);
      emitRunEvent(runId, step, entry.status === "error" ? "OpenRouter call failed" : "OpenRouter usage recorded", {
        openrouter: entry
      });
    }
  });
  const attachmentContext = attachments.map((item) => `ATTACHMENT: ${item.name}\n${item.content}`).join("\n\n");
  const effectiveMessage = attachmentContext ? `${message}\n\n${attachmentContext}` : message;
  emitRunEvent(runId, "chat_input", "Received user message", {
    sessionId,
    preview: message.slice(0, 300),
    attachments: attachments.map((item) => item.name)
  });
  const sanitized = sanitizeMessage(effectiveMessage);
  const memoryLoadStartedAt = Date.now();
  emitRunEvent(runId, "sanitize", "Message sanitized", { changed: sanitized !== message, length: sanitized.length });
  const routingMemory = ephemeral
    ? { mode: "disabled", recent: [], summary: null, sessionRow: null, memories: [], errors: [] }
    : await loadRoutingMemory({ config, sessionId, userId }).catch((error) => ({
      mode: "session_only", recent: [], summary: null, sessionRow: null, memories: [], errors: [error.message]
    }));
  if (routingMemory.errors.length) {
    emitRunEvent(runId, "memory", "Routing memory degraded; chat continues", { errors: routingMemory.errors });
  }
  const saved = ephemeral
    ? { id: null, status: "ephemeral" }
    : await saveMessage({ config, userMessage: message, sanitizedMessage: sanitized, sessionId });
  emitRunEvent(runId, "save_message", ephemeral ? "Internal query kept out of chat history" : "Message saved", { id: saved.id, status: saved.status });
  const trace = [];
  let classification;

  try {
    emitRunEvent(runId, "classifier", "Classifying message", {});
    classification = await classifyMessage({
      message: sanitized,
      context: buildClassifierContext(routingMemory, config.memory?.routingTokenBudget),
      config,
      telemetry: telemetryFor("classifier")
    });
    emitRunEvent(runId, "classifier", "Classification completed", classification);
    console.log(`[classifier] type=${classification.type} tool="${classification.tool_hint}" msg="${sanitized.slice(0, 70)}"`);
  } catch (error) {
    classification = { ...heuristicClassification(sanitized), standalone_query: sanitized };
    trace.push({ step: "classifier", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "classifier", "Classifier failed, using local fallback", { error: error.message, classification });
    console.log(`[classifier] FALLBACK (${error.message}) type=${classification.type} msg="${sanitized.slice(0, 70)}"`);
  }
  const resolvedMessage = classification.standalone_query || sanitized;
  const beforeProfessional = Boolean(classification?.professional);
  classification = enforceProfessionalKnowledgeMode(classification, resolvedMessage, config);
  emitRunEvent(runId, "knowledge_vocabulary", classification?.knowledge_vocabulary_match
    ? "Knowledge vocabulary matched"
    : "Knowledge vocabulary checked", {
    matched: classification?.knowledge_vocabulary_match || null,
    professional: Boolean(classification?.professional),
    trigger_keywords: config.knowledge?.triggerKeywords || [],
    knowledge_tags: classification?.knowledge_tags || []
  });
  if (!beforeProfessional && classification?.professional) {
    emitRunEvent(runId, "knowledge_vocabulary", "Professional Knowledge mode enforced locally", {
      professional_reason: classification.professional_reason,
      knowledge_tags: classification.knowledge_tags || [],
      matched: classification.knowledge_vocabulary_match || null
    });
  }
  classification = enforceInvestigationMode(classification, resolvedMessage);
  if (!sourcesEnabled && !deepResearch) {
    classification = { ...classification, type: "CHAT", professional: false, investigation: false };
    emitRunEvent(runId, "switch", "Project sources disabled by user", {});
  }
  if (deepResearch) {
    classification = {
      ...classification,
      type: "RAG",
      complexity: "COMPLEX",
      investigation: true,
      investigation_reason: classification.investigation_reason || "user_requested"
    };
    emitRunEvent(runId, "investigation", "Deep research requested by user", {});
  }
  if (forceRag) {
    classification = { ...classification, type: "RAG" };
    emitRunEvent(runId, "switch", "RAG route required by internal caller", {});
  }

  let memoryCommand = null;
  if (!ephemeral) {
    try {
      memoryCommand = await applyExplicitMemoryCommand({ config, userId, sessionId, messageId: saved.id, message: sanitized });
      if (memoryCommand) classification = { ...classification, type: "CHAT" };
    } catch (error) {
      memoryCommand = { kind: "unknown", ok: false, reason: "write_failed" };
      trace.push({ step: "memory_write", ok: false, error: error.message });
      emitRunEvent(runId, "memory_write", "Explicit memory action failed; chat continues", { error: error.message });
    }
  }
  const agentName = classification.type === "CHAT" ? "lite" : "main";
  const memoryContext = ephemeral
    ? { mode: "disabled", recent: [], summary: null, sessionRow: null, memories: [], errors: [] }
    : await loadAgentMemory({ config, sessionId, userId, query: resolvedMessage, agent: agentName }).catch((error) => ({
      mode: userId ? "user_and_session" : "session_only",
      recent: routingMemory.recent,
      summary: routingMemory.summary,
      sessionRow: routingMemory.sessionRow,
      memories: [],
      errors: [error.message]
    }));
  const agentMemorySettings = config.memory?.agents?.[agentName] || {};
  const memory = memoryMessagesForAgent(memoryContext, agentMemorySettings.contextTokenBudget);
  const memorySummary = memoryContext.summary;
  if (memoryContext.errors.length) trace.push({ step: "memory", ok: false, fallback: true, errors: memoryContext.errors });
  emitRunEvent(runId, "memory", "Memory loaded", {
    mode: memoryContext.mode,
    recent_messages: memoryContext.recent.length,
    recalled_items: memoryContext.memories.length,
    errors: memoryContext.errors
  });
  const memoryLoadLatencyMs = Date.now() - memoryLoadStartedAt;

  let result;
  if (memoryCommand) {
    emitRunEvent(runId, "memory_write", "Explicit memory action verified", { kind: memoryCommand.kind, ok: memoryCommand.ok });
    result = { answer: explicitMemoryResponse(memoryCommand, sanitized), sources: [], toolCalls: [], memoryAction: true };
  } else if (classification.type === "CHAT") {
    emitRunEvent(runId, "switch", "Routing to Lite Agent", { type: classification.type });
    result = await runLiteAgent({ message: resolvedMessage, memory, memorySummary, config, trace, runId, telemetryFor });
  } else {
    emitRunEvent(runId, "switch", "Routing to Main RAG Agent", { type: classification.type });
    result = await runRagAgent({ message: resolvedMessage, sessionId, classification, memory, memorySummary, config, trace, runId, cacheContext, telemetryFor });
  }

  result.answer = sanitizeCustomerFacingAnswer(result.answer, { hebrew: isHebrew(sanitized) });

  const memoryWrite = ephemeral ? null : await finalizeChatMemory({
    config,
    sessionId,
    userId,
    userMessage: message,
    assistantMessage: result.answer,
    messageId: saved.id,
    previousSession: memoryContext.sessionRow || routingMemory.sessionRow,
    telemetry: telemetryFor("memory_maintenance"),
    allowAutoLearn: !memoryCommand
  }).catch((error) => ({ mode: memoryContext.mode, learned: 0, errors: [error.message] }));
  if (memoryWrite?.errors?.length) {
    trace.push({ step: "memory_write", ok: false, fallback: true, errors: memoryWrite.errors });
    emitRunEvent(runId, "memory_write", "Memory maintenance degraded; answer preserved", { errors: memoryWrite.errors });
  } else if (!ephemeral) {
    emitRunEvent(runId, "memory_write", "Persistent memory updated", { learned: memoryWrite?.learned || 0, turns: memoryWrite?.turnCount || 0 });
  }
  const workflowLog = buildWorkflowLog({
    message,
    sanitized,
    saved,
    memory,
    memorySummary: memoryWrite?.summary || memorySummary,
    classification,
    result,
    trace,
    config,
    openRouterCalls,
    memoryWrite
  });
  workflowLog.cacheMetrics = finalizeCacheMetrics(cacheContext);

  const runEvents = getRunEvents(runId);
  if (!ephemeral) {
    await updateMessage({
      config,
      messageId: saved.id,
      aiResponse: result.answer,
      status: "done",
      workflowLog,
      runEvents
    }).then(() => {
      emitRunEvent(runId, "update_message", "Message updated with AI response", { id: saved.id, status: "done" });
    }).catch((error) => {
      trace.push({ step: "updateMessage", ok: false, error: error.message });
      emitRunEvent(runId, "update_message", "DB update failed", { error: error.message });
    });
  }

  const memoryDebug = {
    mode: memoryContext.mode,
    recentTurns: Math.floor(memoryContext.recent.length / 2),
    recalledItems: memoryContext.memories.length,
    turnCount: memoryWrite?.turnCount || memoryContext.sessionRow?.turn_count || 0,
    degraded: Boolean(memoryContext.errors.length || memoryWrite?.errors?.length),
    queryRewritten: resolvedMessage !== sanitized,
    contextEstimatedTokens: memory.reduce((sum, item) => sum + estimateTokens(item.content), 0),
    loadLatencyMs: memoryLoadLatencyMs,
    maintenanceLatencyMs: memoryWrite?.latencyMs || 0,
    rejectedItems: memoryWrite?.rejected || 0,
    localLogWritten: false
  };
  if (!ephemeral) {
    const logStatus = await appendMemoryLog({
      runId,
      sessionId,
      userId,
      mode: memoryContext.mode,
      selectedAgent: memoryCommand ? "memory_action" : agentName,
      routeType: classification.type,
      originalMessage: message,
      standaloneQuery: resolvedMessage,
      queryRewritten: memoryDebug.queryRewritten,
      recentTurns: memoryDebug.recentTurns,
      recalledItems: memoryDebug.recalledItems,
      recalledScores: memoryContext.memories,
      contextEstimatedTokens: memoryDebug.contextEstimatedTokens,
      turnCount: memoryDebug.turnCount,
      memoryAction: memoryCommand,
      learnedItems: memoryWrite?.learned || 0,
      rejectedItems: memoryDebug.rejectedItems,
      degraded: memoryDebug.degraded,
      loadLatencyMs: memoryDebug.loadLatencyMs,
      maintenanceLatencyMs: memoryDebug.maintenanceLatencyMs,
      errors: [...routingMemory.errors, ...memoryContext.errors, ...(memoryWrite?.errors || [])]
    });
    memoryDebug.localLogWritten = logStatus.ok;
    if (!logStatus.ok) console.warn("[memory_log] write failed:", logStatus.error);
  }

  const output = {
    messageId: saved.id,
    status: "complete",
    type: classification.type,
    classification,
    answer: result.answer,
    sources: normalizeChatSources(result.sources),
    followUps: buildChatFollowUps({ classification, result }),
    progress: {
      completed: true,
      stages: (workflowLog.nodes || [])
        .filter((node) => node.status === "done")
        .map((node) => ({ id: node.id, label: node.label, status: node.status }))
    },
    toolCalls: projectChatToolCallsForClient(result.toolCalls, { question: sanitized }),
    knowledgePlan: result.knowledgePlan || null,
    investigationPlan: result.investigationPlan || null,
    memorySummary: ephemeral ? null : (memoryWrite?.summary || memorySummary),
    memoryDebug,
    sourceQuality: result.sourceQuality || null,
    conflicts: result.conflicts || [],
    openRouterUsage: workflowLog.openRouterUsage,
    trace,
    workflowLog
  };
  if (!ephemeral) completeRun(runId, { messageId: saved.id, type: classification.type });
  return output;
}

function normalizeChatSources(sources = []) {
  return uniqueByUrl(sources).map((source, index) => {
    let hostname = "";
    try {
      hostname = new URL(source.url).hostname.replace(/^www\./, "");
    } catch {
      hostname = "";
    }
    return {
      id: source.id || `source_${index + 1}`,
      title: source.title || source.label || source.name || `מקור ${index + 1}`,
      url: source.url,
      type: source.type || hostname || "document"
    };
  });
}

function buildChatFollowUps({ classification, result }) {
  if (classification?.type === "CHAT") return [];
  const followUps = [
    "הצג רק נושאים שדורשים פעולה מיידית",
    "אילו מסמכים תומכים במסקנות האלה?"
  ];
  if (result?.conflicts?.length) followUps.push("הסבר את הסתירות בין המקורות");
  else if (classification?.urgency === "HIGH") followUps.push("מי צריך לטפל בכל נושא ועד מתי?");
  else followUps.push("סכם את התשובה לעדכון הנהלה קצר");
  return followUps;
}

function explicitMemoryResponse(command, originalMessage) {
  const hebrew = isHebrew(originalMessage);
  if (command.kind === "remember" && command.ok) {
    return hebrew ? "זכרתי. המידע נשמר בזיכרון האישי שלך לשיחות הבאות." : "Remembered. I saved this to your personal memory for future conversations.";
  }
  if (command.kind === "forget" && command.ok) {
    if (command.count > 0) return hebrew ? "שכחתי את המידע שביקשת." : "I forgot the information you requested.";
    return hebrew ? "לא מצאתי זיכרון אישי תואם למחיקה." : "I could not find a matching personal memory to remove.";
  }
  const reasons = {
    session_only: hebrew ? "אין משתמש מזוהה, ולכן השיחה פועלת כרגע בזיכרון session בלבד." : "No authenticated user was found, so this conversation is using session-only memory.",
    sensitive: hebrew ? "לא שמרתי את המידע כי הוא נראה כמו סוד, מפתח או סיסמה." : "I did not save that because it appears to contain a secret, key, or password.",
    limit: hebrew ? "לא שמרתי את המידע כי מכסת הזיכרון האישי מלאה." : "I did not save that because the personal memory limit is full.",
    disabled: hebrew ? "הזיכרון כבוי בהגדרות." : "Memory is disabled in settings.",
    embedding_unavailable: hebrew ? "לא ניתן היה לאמת ולשמור את הזיכרון כרגע." : "The memory could not be verified and saved right now."
  };
  return reasons[command.reason] || (hebrew ? "לא הצלחתי לבצע את פעולת הזיכרון; השיחה עצמה ממשיכה כרגיל." : "I could not complete the memory action; the chat itself is still available.");
}

async function runLiteAgent({ message, memory, memorySummary, config, trace, runId, telemetryFor }) {
  const fallback = liteFallback(message);
  if (!config.openRouterApiKey) {
    trace.push({ step: "liteAgent", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "lite_agent", "Missing OpenRouter key, using fallback", {});
    return { answer: fallback, sources: [], toolCalls: [] };
  }

  try {
    emitRunEvent(runId, "lite_agent", "Calling Lite Agent model", { model: config.models.lite, memory: memory.length });
    const answer = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.lite,
      temperature: config.ai?.lite?.temperature ?? 0.3,
      maxTokens: config.ai?.lite?.maxTokens ?? 1800,
      timeoutMs: config.ai?.lite?.timeoutMs ?? 90_000,
      ...samplingSettings(config, "lite"),
      telemetry: telemetryFor("lite_agent"),
      messages: [
        {
          role: "system",
          content: `SYSTEM TIME: ${getProjectDateTime(config.timezone)} — when the user asks about the time or date, answer using this exact value. Do not say you lack real-time access.\n\n${renderPrompt(config.prompts?.lite, { currentDate: getProjectDateTime(config.timezone) })}`
        },
        ...memory,
        { role: "user", content: message }
      ]
    });
    emitRunEvent(runId, "lite_agent", "Lite Agent response received", { length: answer.length });
    return { answer, sources: [], toolCalls: [] };
  } catch (error) {
    trace.push({ step: "liteAgent", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "lite_agent", "Lite Agent failed, using fallback", { error: error.message });
    return { answer: fallback, sources: [], toolCalls: [] };
  }
}

const MEETING_EVIDENCE_INTENT_RE = /(?:\bmeeting(?:s|\s+minutes)?\b|\bminutes\b|\bmeeting\s+(?:decision|quote|evidence)\b|ישיב(?:ה|ות)|פגיש(?:ה|ות)|פרוטוקול|סיכום\s+ישיבה|החלט(?:ה|ות)\s+מישיבה|ציטוט\s+מישיבה)/iu;

export function shouldRunMeetingEvidenceForRequest({
  enabled = true,
  message = "",
  classification = null,
  routing = null
} = {}) {
  if (!enabled) return false;
  if (routing?.suggestedAgent === "meeting_evidence") return true;
  const toolHint = String(classification?.tool_hint || "").toLowerCase();
  if (toolHint.split(",").map((item) => item.trim()).some((item) => ["meetings", "meeting_evidence"].includes(item))) {
    return true;
  }
  return MEETING_EVIDENCE_INTENT_RE.test(String(message || ""));
}

async function runRagAgent({ message, sessionId, classification, memory, memorySummary, config, trace, runId, cacheContext, telemetryFor }) {
  const toolCalls = [];
  const sources = [];
  let hybridResults = null;
  let rerankedResults = null;
  let graphContext = [];
  let knowledgePlan = null;
  // Keep one immutable-enough settings snapshot for the complete request. Routing,
  // tool selection, date scoping, and execution must not independently rediscover
  // different table capabilities during the same run.
  const dataQueryRequestSettings = dataQuerySettings(config);
  const dataQueryRouting = enforceAlertDataQueryTrustedOrigin(classifyDataQueryCapability(message, {
    hasDataQueryHint: hintedTools(classification).includes("data_query"),
    settings: dataQueryRequestSettings
  }), config);
  const pureMeetingEvidenceRoute = isPureMeetingEvidenceCapability(dataQueryRouting);
  const structuredDataQueryRoute = shouldBypassGenericRetrieval({
    message,
    classification,
    config,
    routing: dataQueryRouting
  });
  const listIntent = structuredDataQueryRoute
    ? dataQueryRouting.lookup?.operation === "lookup_last_n" && dataQueryRouting.lookup.limit > 1
    : isEntityListQuestion(message);
  const investigationPlan = structuredDataQueryRoute
    ? null
    : buildInvestigationPlan({ message, classification, memorySummary });
  if (investigationPlan) {
    emitRunEvent(runId, "investigation", "Investigation Mode enabled", investigationPlan);
  }

  const toolsRuntime = config.n8n?.runtime || {};
  const safetyPrecheckTools = buildSafetyPrecheckTools({
    structuredDataQueryRoute,
    toolsRuntime,
    classification
  });
  const safetyResults = await Promise.all(
    safetyPrecheckTools.map((toolName) =>
      callProjectTool({ toolName, message, classification, sessionId, config, runId, cacheContext, telemetryFor }).then((result) => {
        emitRunEvent(runId, "safety_precheck", `Safety precheck ${toolName} completed`, {
          ok: result.ok, skipped: result.skipped || false, error: result.error || null
        });
        return result;
      })
    )
  );
  for (const result of safetyResults) {
    toolCalls.push(annotateToolCall(result));
    sources.push(...result.sources);
  }

  if (classification.professional && !structuredDataQueryRoute) {
    knowledgePlan = await runKnowledgePlanner({ message, classification, config, trace, runId, telemetryFor });
  }

  if (!structuredDataQueryRoute) {
    try {
    emitRunEvent(runId, "hybrid_search", "Running Hybrid Search", {
      rpc: config.retrieval.rpcName,
      candidates: config.retrieval.candidates,
      date_from: classification.date_from,
      date_to: classification.date_to,
      hashtags: classification.hashtags || []
    });
    const primarySearch = await hybridSearchWithRelaxedHashtags({
      config,
      query: message,
      dateFrom: classification.date_from,
      dateTo: classification.date_to,
      hashtags: classification.hashtags || [],
      topK: config.retrieval.candidates,
      runId,
      context: "primary",
      cacheContext,
      telemetryFor
    });
    hybridResults = primarySearch.results;
    const allRows = normalizeRows(hybridResults);

    const planQueries = plannedRagQueries(knowledgePlan, message, config);
    const planResults = await Promise.all(
      planQueries.map(async (query) => {
        try {
          emitRunEvent(runId, "hybrid_search", "Running Knowledge Planner RAG query", { query });
          const plannedSearch = await hybridSearchWithRelaxedHashtags({
            config, query,
            dateFrom: classification.date_from,
            dateTo: classification.date_to,
            hashtags: classification.hashtags || [],
            topK: config.retrieval.plannerCandidates,
            runId, context: "knowledge_plan", cacheContext, telemetryFor
          });
          const plannedRows = normalizeRows(plannedSearch.results);
          const plannedSources = extractLinks(plannedRows, config);
          emitRunEvent(runId, "hybrid_search", "Knowledge Planner RAG query completed", { query, records: plannedRows.length, relaxedHashtags: plannedSearch.relaxedHashtags });
          return { ok: true, query, rows: plannedRows, sources: plannedSources, relaxedHashtags: plannedSearch.relaxedHashtags };
        } catch (error) {
          emitRunEvent(runId, "hybrid_search", "Knowledge Planner RAG query failed", { query, error: error.message });
          return { ok: false, query, rows: [], sources: [], error: error.message };
        }
      })
    );
    for (const pr of planResults) {
      allRows.push(...pr.rows);
      sources.push(...pr.sources);
      toolCalls.push(annotateToolCall(pr.ok
        ? { toolName: "hybrid_search_plan", ok: true, rawQuery: pr.query, data: pr.rows, sources: pr.sources, relaxedHashtags: pr.relaxedHashtags }
        : { toolName: "hybrid_search_plan", ok: false, rawQuery: pr.query, error: pr.error, data: null, sources: [] }
      ));
    }

    hybridResults = filterRowsByHashtags(uniqueRows(allRows), classification.hashtags || []);
    const hybridSources = extractLinks(hybridResults, config);
    sources.push(...hybridSources);
    toolCalls.push(annotateToolCall({ toolName: "hybrid_search", ok: true, rawQuery: message, data: hybridResults, sources: hybridSources, relaxedHashtags: primarySearch.relaxedHashtags }));
    emitRunEvent(runId, "hybrid_search", "Hybrid Search completed", { records: countRows(hybridResults), sources: hybridSources.length, plannedQueries: planQueries.length });
    } catch (error) {
      toolCalls.push(annotateToolCall({ toolName: "hybrid_search", ok: false, rawQuery: message, error: error.message, data: null, sources: [] }));
      emitRunEvent(runId, "hybrid_search", "Hybrid Search failed", { error: error.message });
    }
  } else {
    const reason = pureMeetingEvidenceRoute
      ? "pure_meeting_evidence_route"
      : "exact_structured_data_query_route";
    for (const toolName of ["hybrid_search", "graph_search", "reranker"]) {
      if (!pureMeetingEvidenceRoute) {
        toolCalls.push(annotateToolCall({
          toolName,
          ok: false,
          skipped: true,
          rawQuery: message,
          error: reason,
          data: null,
          sources: []
        }));
      }
      emitRunEvent(runId, toolName, `${toolName === "hybrid_search" ? "Hybrid Search" : toolName === "graph_search" ? "Project Graph Search" : "Reranker"} skipped for ${pureMeetingEvidenceRoute ? "pure Meeting Evidence" : "exact Data Query"} route`, {
        reason,
        dataQueryDomain: dataQueryRouting.domain,
        dataQueryIntent: dataQueryRouting.intent
      });
    }
  }

  if (hybridResults && config.graph?.enabled !== false) {
    const graphSearchLimit = Number(config.graph?.searchLimit || 30);
    const graphContextLimit = graphContextLimitForQuestion({ config, listIntent });
    const payload = buildGraphSearchPayload({ query: message, records: normalizeRows(hybridResults), maxRows: graphSearchLimit });
    try {
      emitRunEvent(runId, "graph_search", "Running Project Graph Search", { sourceRefs: payload.source_refs.length });
      const graph = await cachedOperation({
        context: cacheContext,
        type: "graphSearch",
        keyParts: {
          node_ids: payload.source_refs.map((ref) => ref.node_id || `${ref.source_table}:${ref.source_id}`).sort(),
          graph_depth: graphSearchLimit,
          query: payload.query_text
        },
        ttl: CACHE_TTL.graphSearch,
        savedCall: "search",
        estimatedCost: 0.0001,
        operation: () => graphSearch({ config, payload, limit: graphSearchLimit })
      });
      graphContext = summarizeGraphContext(graph, graphContextLimit);
      toolCalls.push(annotateToolCall({
        toolName: "graph_search",
        ok: !graph.skipped,
        skipped: Boolean(graph.skipped),
        rawQuery: message,
        data: graphContext,
        error: graph.skipped ? graph.reason || graph.error || "No graph context found" : null,
        sources: []
      }));
      emitRunEvent(runId, "graph_search", graph.skipped ? "Project Graph Search skipped" : "Project Graph Search completed", {
        mode: graph.mode || "unknown",
        records: graphContext.length,
        error: graph.error || null
      });
    } catch (error) {
      toolCalls.push(annotateToolCall({ toolName: "graph_search", ok: false, rawQuery: message, error: error.message, data: null, sources: [] }));
      emitRunEvent(runId, "graph_search", "Project Graph Search failed", { error: error.message });
    }
  }

  if (hybridResults) {
    try {
      const rerankTopK = retrievalTopKForQuestion({ config, message, classification });
      emitRunEvent(runId, "reranker", "Running reranker", { model: config.models.reranker, candidates: countRows(hybridResults), topK: rerankTopK, listIntent });
      const rerankRows = normalizeRows(hybridResults);
      rerankedResults = await cachedOperation({
        context: cacheContext,
        type: "reranker",
        keyParts: {
          query: message,
          source_ids: rerankRows.map(rowKey),
          model: config.models.reranker,
          topK: rerankTopK,
          prompt_hash: hashValue(config.prompts?.reranker || "")
        },
        ttl: CACHE_TTL.reranker,
        savedCall: "model",
        estimatedCost: 0.002,
        operation: () => rerankWithLlm({
          apiKey: config.openRouterApiKey,
          model: config.models.reranker,
          query: message,
          results: rerankRows,
          topK: rerankTopK,
          systemPrompt: config.prompts?.reranker,
          temperature: config.ai?.reranker?.temperature ?? 0,
          maxTokens: config.ai?.reranker?.maxTokens ?? 4096,
          timeoutMs: config.ai?.reranker?.timeoutMs ?? 90_000,
          ...samplingSettings(config, "reranker"),
          telemetry: telemetryFor("reranker")
        })
      });
      const rerankSources = extractLinks(rerankedResults, config);
      sources.push(...rerankSources);
      toolCalls.push(annotateToolCall({ toolName: "reranker", ok: true, rawQuery: message, data: rerankedResults, sources: rerankSources }));
      emitRunEvent(runId, "reranker", "Reranker completed", { records: countRows(rerankedResults) });
    } catch (error) {
      const fallbackRows = normalizeRows(hybridResults).slice(0, retrievalTopKForQuestion({ config, message, classification }));
      rerankedResults = fallbackRows;
      toolCalls.push(annotateToolCall({ toolName: "reranker", ok: false, fallback: true, rawQuery: message, error: error.message, data: fallbackRows, sources: [] }));
      emitRunEvent(runId, "reranker", "Reranker failed, using hybrid order", { error: error.message, fallbackRecords: fallbackRows.length });
    }
  }

  const plannerTools = pureMeetingEvidenceRoute ? [] : recommendedProjectTools(knowledgePlan);
  const meetingsEvidenceEnabled = config.meetingsEvidence?.enabled !== false;
  const shouldRunMeetingEvidence = shouldRunMeetingEvidenceForRequest({
    enabled: meetingsEvidenceEnabled,
    message,
    classification,
    routing: dataQueryRouting
  });
  const meetingsEvidenceTool = shouldRunMeetingEvidence ? ["meeting_evidence_search"] : [];
  const tools = buildMainProjectTools({
    message,
    classification,
    config,
    plannerTools,
    meetingsEvidenceTool,
    safetyPrecheckTools,
    shouldRunMeetingEvidence,
    dataQuerySettingsOverride: dataQueryRequestSettings,
    dataQueryRoutingOverride: dataQueryRouting
  });
  emitRunEvent(runId, "n8n_tools", "Calling hinted/fallback tools in parallel", { tools });
  const toolResults = await Promise.all(
    tools.map((toolName) =>
      callProjectTool({
        toolName,
        message,
        classification,
        sessionId,
        config,
        runId,
        cacheContext,
        telemetryFor,
        dataQuerySettingsOverride: dataQueryRequestSettings,
        dataQueryRoutingOverride: dataQueryRouting
      }).then((result) => {
        if (toolName === "meeting_evidence_search") {
          emitRunEvent(runId, "meeting_evidence", `Meeting Evidence Agent completed`, {
            ok: result.ok,
            skipped: result.skipped || false,
            status: result.data?.status || null,
            evidenceCount: result.data?.evidence?.length || 0,
            conflictsCount: result.data?.conflicts?.length || 0,
            error: summarizeMeetingEvidenceErrorForWorkflow(result)
          });
        } else if (toolName === "data_query") {
          emitRunEvent(runId, "data_query", "Data Query Agent completed", {
            ok: result.ok,
            skipped: result.skipped || false,
            status: result.data?.status || null,
            plans: result.data?.plans?.length || 0,
            metrics: result.data?.metrics?.length || 0,
            warnings: summarizeDataQueryWarningsForWorkflow(result.data?.warnings || []),
            error: result.error || null
          });
        } else {
          emitRunEvent(runId, "n8n_tools", `Tool ${toolName} completed`, { ok: result.ok, skipped: result.skipped || false, error: result.error || null });
        }
        return result;
      })
    )
  );
  for (const result of toolResults) {
    toolCalls.push(annotateToolCall(result));
    sources.push(...result.sources);
  }

  // Mixed meeting requests are deliberately sequential. Data Query first
  // attests one exact meeting identity; only then may Meeting Evidence search
  // within that same record and project boundary.
  if (meetingsEvidenceEnabled && isDeterministicMeetingMixedCapability(dataQueryRouting)) {
    const exactMeetingRecords = exactMeetingLookupRecords(toolCalls);
    const exactMeeting = exactMeetingRecords.length === 1 ? exactMeetingRecords[0] : null;
    const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
    if (exactMeeting) {
      const meetingEvidenceResult = await callProjectTool({
        toolName: "meeting_evidence_search",
        message,
        classification,
        sessionId,
        config,
        runId,
        cacheContext,
        telemetryFor,
        meetingEvidenceScope: {
          meetingId: exactMeeting.id,
          meetingDate: exactMeeting.meeting_date,
          status: exactMeeting.status,
          projectId: exactMeeting.project_id,
          attachmentId: exactMeeting.attachment_id
        }
      });
      toolCalls.push(annotateToolCall(meetingEvidenceResult));
      emitRunEvent(runId, "meeting_evidence", "Same-meeting evidence handoff completed", {
        ok: meetingEvidenceResult.ok === true,
        status: meetingEvidenceResult.data?.status || null,
        sameMeetingMatch: meetingEvidenceResult.data?.same_meeting_match === true,
        evidenceCount: Array.isArray(meetingEvidenceResult.data?.evidence)
          ? meetingEvidenceResult.data.evidence.length
          : 0,
        insufficientEvidence: meetingEvidenceResult.data?.insufficient_evidence === true,
        error: summarizeMeetingEvidenceErrorForWorkflow(meetingEvidenceResult)
      });
    } else {
      emitRunEvent(runId, "meeting_evidence", "Same-meeting evidence handoff skipped", {
        reason: "exact_meeting_identity_unavailable",
        exactRecordCount: exactMeetingRecords.length
      });
    }
  }

  if (isDeterministicExceptionMixedCapability(dataQueryRouting)) {
    const exactExceptionRecords = exactExceptionLookupRecords(toolCalls);
    const exactException = exactExceptionRecords.length === 1 ? exactExceptionRecords[0] : null;
    if (exactException?.project_id && exactException?.attachment_id) {
      const evidence = await runExceptionEvidenceAgent({
        config,
        question: message,
        scope: {
          exceptionId: exactException.id,
          projectId: exactException.project_id,
          attachmentId: exactException.attachment_id
        },
        telemetry: telemetryFor("exception_evidence")
      });
      toolCalls.push(annotateToolCall({
        toolName: "exception_evidence_search",
        ok: ["ok", "not_found"].includes(evidence.status),
        data: evidence,
        sources: []
      }));
      emitRunEvent(runId, "exception_evidence", "Same-exception evidence handoff completed", {
        status: evidence.status,
        sameExceptionMatch: evidence.same_exception_match === true,
        evidenceCount: Number(evidence.evidence_count || 0)
      });
    } else {
      emitRunEvent(runId, "exception_evidence", "Same-exception evidence handoff skipped", {
        reason: "exact_exception_identity_unavailable",
        exactRecordCount: exactExceptionRecords.length
      });
    }
  }
  if (isDeterministicConsultantReportMixedCapability(dataQueryRouting)) {
    const records = exactConsultantReportLookupRecords(toolCalls);
    const report = records.length === 1 ? records[0] : null;
    if (report) {
      const evidence = await runConsultantReportEvidenceAgent({
        config,
        question: message,
        scope: { reportId: report.id, projectId: report.project_id, attachmentId: report.attachment_id },
        telemetry: telemetryFor("consultant_report_evidence")
      });
      toolCalls.push(annotateToolCall({ toolName: "consultant_report_evidence_search", ok: ["ok", "not_found"].includes(evidence.status), data: evidence, sources: [] }));
      emitRunEvent(runId, "consultant_report_evidence", "Same-report consultant evidence handoff completed", { status: evidence.status, sameReportMatch: evidence.same_report_match === true, evidenceCount: Number(evidence.evidence_count || 0) });
    }
  }

  const exactInvoiceRecords = exactInvoiceLookupRecords(toolCalls);
  let exactInvoiceEnrichments = buildExactInvoiceEnrichments(toolCalls);
  if (exactInvoiceRecords.length) {
    try {
      const exactProjectScope = exactInvoiceLookupProjectScope(toolCalls, config);
      if (!exactProjectScope.ok) {
        throw new Error("Exact financial-record enrichment caller project scope is invalid or mismatched");
      }
      let exactFinancialRows = await fetchFinancialTransactionsByIds({
        config,
        ids: exactInvoiceRecords.map((record) => record.id),
        projectId: exactProjectScope.projectId
      });
      const invoiceLookupOperation = exactInvoiceLookupOperation(toolCalls);
      const attachmentResolution = await resolveExactInvoiceAttachmentLinks({
        config,
        operation: invoiceLookupOperation,
        financialRows: exactFinancialRows,
        callerProjectId: exactProjectScope.projectId,
        allRequested: dataQueryRouting.lookup?.allRequested === true
      });
      exactFinancialRows = attachmentResolution.rows;
      if (
        invoiceLookupOperation === "lookup_latest" &&
        attachmentResolution.stats.uniqueLookups > 0
      ) {
        emitRunEvent(
          runId,
          "invoice_attachment_link",
          attachmentResolution.stats.resolved > 0
            ? "Exact financial-document attachment link resolved"
            : attachmentResolution.stats.failed > 0
              ? "Exact financial-document attachment link lookup failed closed"
              : "Exact financial-document attachment link unavailable",
          {
            attempted: true,
            resolved: attachmentResolution.stats.resolved > 0,
            failed: attachmentResolution.stats.failed > 0
          }
        );
      }
      if (invoiceLookupOperation === "lookup_last_n") {
        emitRunEvent(
          runId,
          "invoice_attachment_links",
          "Bounded financial-document attachment link resolution completed",
          attachmentResolution.stats
        );
      }
      exactInvoiceEnrichments = buildExactInvoiceEnrichments([
        ...toolCalls,
        {
          toolName: "financial_transactions",
          ok: true,
          internal: true,
          exactRead: true,
          data: { results: exactFinancialRows },
          sources: []
        }
      ]);
      emitRunEvent(runId, "invoice_enrichment", exactInvoiceEnrichments.length
        ? "Exact financial-record enrichment completed"
        : "Exact financial-record enrichment unavailable", {
        requestedRecords: exactInvoiceRecords.length,
        matchedRecords: exactInvoiceEnrichments.length,
        documentLinks: exactInvoiceEnrichments.filter((item) => item.documentUrl).length
      });
    } catch {
      emitRunEvent(runId, "invoice_enrichment", "Exact financial-record enrichment failed closed", {
        requestedRecords: exactInvoiceRecords.length,
        matchedRecords: exactInvoiceEnrichments.length,
        documentLinks: exactInvoiceEnrichments.filter((item) => item.documentUrl).length,
        error: "invoice_enrichment_failed"
      });
    }
  }
  const exactInvoiceSources = buildExactInvoiceDocumentSources(exactInvoiceEnrichments);
  const exactInvoiceEnrichment = exactInvoiceEnrichments[0] || null;
  const exactSafetyRecords = exactSafetyLookupRecords(toolCalls);
  let exactSafetyEnrichments = [];
  if (exactSafetyRecords.length) {
    try {
      const exactProjectScope = exactSafetyLookupProjectScope(toolCalls, config);
      if (!exactProjectScope.ok) {
        throw new Error("Exact safety enrichment caller project scope is invalid or mismatched");
      }
      const exactSafetyRows = await fetchSafetyReportsByIds({
        config,
        ids: exactSafetyRecords.map((record) => record.id),
        projectId: exactProjectScope.projectId
      });
      const attachmentResolution = await resolveExactSafetyAttachmentLinks({
        config,
        safetyRows: exactSafetyRows,
        callerProjectId: exactProjectScope.projectId
      });
      exactSafetyEnrichments = buildExactSafetyEnrichments([
        ...toolCalls,
        {
          toolName: "safety_report",
          ok: true,
          internal: true,
          exactRead: true,
          data: { results: attachmentResolution.rows },
          sources: []
        }
      ]);
      emitRunEvent(runId, "safety_attachment_links", "Bounded safety attachment link resolution completed", attachmentResolution.stats);
      emitRunEvent(runId, "safety_enrichment", exactSafetyEnrichments.length
        ? "Exact safety-report enrichment completed"
        : "Exact safety-report enrichment unavailable", {
        requestedRecords: exactSafetyRecords.length,
        matchedRecords: exactSafetyEnrichments.length,
        documentLinks: exactSafetyEnrichments.filter((item) => item.documentUrl).length
      });
    } catch {
      emitRunEvent(runId, "safety_enrichment", "Exact safety-report enrichment failed closed", {
        requestedRecords: exactSafetyRecords.length,
        matchedRecords: exactSafetyEnrichments.length,
        documentLinks: exactSafetyEnrichments.filter((item) => item.documentUrl).length,
        error: "safety_enrichment_failed"
      });
    }
  }
  const exactSafetySources = buildExactSafetyDocumentSources(exactSafetyEnrichments);
  const uniqueSources = uniqueByUrl([
    ...exactInvoiceSources,
    ...exactSafetySources,
    ...sources
  ]);
  const sourceQuality = buildSourceQualitySummary(toolCalls);
  const detectedConflicts = detectConflicts(toolCalls);
  const conflicts = toolCalls.some((call) => call?.toolName === "meeting_evidence_search")
    ? projectMeetingEvidenceConflicts(toolCalls)
    : detectedConflicts;
  if (conflicts.length) {
    emitRunEvent(runId, "conflict_detection", "Potential source conflicts detected", { conflicts });
  } else {
    emitRunEvent(runId, "conflict_detection", "No obvious source conflicts detected", {});
  }
  emitRunEvent(runId, "source_quality", "Source quality scored", sourceQuality);
  const deterministicInvoiceAnswer = buildDeterministicInvoiceAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    exactRecords: exactInvoiceRecords,
    enrichments: exactInvoiceEnrichments,
    conflicts
  });
  const deterministicFinancialDocumentAnswer = buildDeterministicFinancialDocumentAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    conflicts
  });
  const deterministicFinancialDataQueryFailureAnswer = buildDeterministicFinancialDataQueryFailureAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls
  });
  const deterministicSafetyAnswer = buildDeterministicSafetyAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    exactRecords: exactSafetyRecords,
    enrichments: exactSafetyEnrichments,
    conflicts
  });
  const deterministicAlertAnswer = buildDeterministicAlertAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    conflicts
  });
  const deterministicMeetingAnswer = buildDeterministicMeetingAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    conflicts,
    semanticFallbackAvailable: Boolean(
      (!structuredDataQueryRoute && normalizeRows(rerankedResults || hybridResults).length) ||
      toolCalls.some((call) => call?.toolName === "meeting_evidence_search" && call?.ok)
    )
  });
  const deterministicEmailAnswer = buildDeterministicEmailAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    conflicts
  });
  const deterministicExceptionAnswer = buildDeterministicExceptionAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls,
    conflicts
  });
  const deterministicConsultantReportAnswer = buildDeterministicConsultantReportAnswer({ message, routing: dataQueryRouting, toolCalls, conflicts });
  const deterministicMeetingEvidenceAnswer = buildDeterministicMeetingEvidenceUnavailableAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls
  });
  const deterministicMeetingDateDecisionAnswer = buildDeterministicDateScopedMeetingDecisionAnswer({
    message,
    toolCalls
  });
  const deterministicMeetingFallbackEvidenceAnswer = buildDeterministicMeetingFallbackEvidenceAnswer({
    message,
    routing: dataQueryRouting,
    toolCalls
  });
  const deterministicAnswer = deterministicInvoiceAnswer ||
    deterministicFinancialDocumentAnswer ||
    deterministicFinancialDataQueryFailureAnswer ||
    deterministicSafetyAnswer ||
    deterministicAlertAnswer ||
    deterministicMeetingAnswer ||
    deterministicEmailAnswer ||
    deterministicExceptionAnswer ||
    deterministicConsultantReportAnswer ||
    deterministicMeetingDateDecisionAnswer ||
    deterministicMeetingFallbackEvidenceAnswer ||
    deterministicMeetingEvidenceAnswer;
  if (deterministicAnswer) {
    const invoiceAnswer = Boolean(deterministicInvoiceAnswer);
    const financialDocumentAnswer = Boolean(deterministicFinancialDocumentAnswer);
    const financialDataQueryFailureAnswer = Boolean(deterministicFinancialDataQueryFailureAnswer);
    const safetyAnswer = Boolean(deterministicSafetyAnswer);
    const emailAnswer = Boolean(deterministicEmailAnswer);
    const exceptionAnswer = Boolean(deterministicExceptionAnswer);
    const meetingAnswer = Boolean(
      deterministicMeetingAnswer ||
      deterministicMeetingDateDecisionAnswer ||
      deterministicMeetingFallbackEvidenceAnswer ||
      deterministicMeetingEvidenceAnswer
    );
    const meetingEvidenceUnavailable = Boolean(deterministicMeetingEvidenceAnswer);
    const meetingDateDecisionAnswer = Boolean(deterministicMeetingDateDecisionAnswer);
    const meetingEvidenceFallback = Boolean(deterministicMeetingFallbackEvidenceAnswer);
    emitRunEvent(
      runId,
      "main_agent",
      invoiceAnswer
        ? "Main Agent skipped for deterministic invoice answer"
        : financialDocumentAnswer
          ? "Main Agent skipped for deterministic financial-document answer"
          : financialDataQueryFailureAnswer
            ? "Main Agent skipped because exact financial Data Query failed closed"
            : safetyAnswer
              ? "Main Agent skipped for deterministic safety-report answer"
              : emailAnswer
                ? "Main Agent skipped for deterministic email answer"
              : exceptionAnswer
                ? "Main Agent skipped for deterministic exception answer"
            : meetingDateDecisionAnswer
              ? "Main Agent skipped for deterministic date-scoped meeting decisions"
            : meetingEvidenceFallback
              ? "Main Agent skipped for deterministic Meeting Evidence fallback"
            : meetingEvidenceUnavailable
              ? "Main Agent skipped because verified Meeting Evidence is unavailable"
              : meetingAnswer
                ? "Main Agent skipped for deterministic meeting answer"
              : "Main Agent skipped for deterministic alert answer",
      {
        reason: invoiceAnswer
          ? "exact_invoice_data_query_answer"
          : financialDocumentAnswer
            ? "exact_financial_document_data_query_answer"
            : financialDataQueryFailureAnswer
              ? "exact_financial_data_query_failed_closed"
            : safetyAnswer
              ? "exact_safety_report_data_query_answer"
              : emailAnswer
                ? "exact_email_data_query_answer"
              : exceptionAnswer
                ? "exact_exception_data_query_answer"
              : meetingDateDecisionAnswer
                ? "meeting_date_decisions_answer"
              : meetingEvidenceFallback
                ? "meeting_semantic_fallback_answer"
              : meetingEvidenceUnavailable
                ? "meeting_evidence_unavailable"
                : meetingAnswer
                  ? "exact_meeting_data_query_answer"
                : "exact_alert_data_query_answer",
        intent: dataQueryRouting.intent,
        operation: dataQueryRouting.lookup?.operation || toolCalls
          .find((call) => call.toolName === "data_query")?.data?.plans?.[0]?.operation || null
      }
    );
    return {
      answer: deterministicAnswer,
      sources: uniqueSources,
      toolCalls,
      knowledgePlan,
      investigationPlan,
      sourceQuality,
      conflicts,
      graphContext
    };
  }
  const synthesisToolCalls = pureMeetingEvidenceRoute
    ? toolCalls.filter((call) => call?.toolName === "meeting_evidence_search")
    : toolCalls;
  const synthesizedAnswer = await synthesizeAnswer({
    message,
    classification,
    memory: pureMeetingEvidenceRoute ? [] : memory,
    memorySummary: pureMeetingEvidenceRoute ? null : memorySummary,
    retrievalResults: pureMeetingEvidenceRoute ? null : rerankedResults || hybridResults,
    graphContext: pureMeetingEvidenceRoute ? [] : graphContext,
    toolCalls: synthesisToolCalls,
    sources: pureMeetingEvidenceRoute ? [] : uniqueSources,
    knowledgePlan: pureMeetingEvidenceRoute ? null : knowledgePlan,
    investigationPlan: pureMeetingEvidenceRoute ? null : investigationPlan,
    sourceQuality: pureMeetingEvidenceRoute ? buildSourceQualitySummary(synthesisToolCalls) : sourceQuality,
    conflicts,
    exactInvoiceEnrichment,
    config,
    trace,
    runId,
    cacheContext,
    telemetryFor
  });
  const groundedAnswer = appendConflictWarnings(
    appendExactInvoiceEnrichment(synthesizedAnswer, exactInvoiceEnrichment),
    conflicts,
    { hebrew: isHebrew(message) }
  );
  const meetingAnchoredAnswer = isDeterministicMeetingMixedCapability(dataQueryRouting) && hasVerifiedSameMeetingEvidence(toolCalls)
    ? prefixExactMeetingAnchor({
        answer: groundedAnswer,
        records: exactMeetingLookupRecords(toolCalls),
        hebrew: isHebrew(message)
      })
    : groundedAnswer;
  const answer = isExceptionCountApprovalMixedCapability(dataQueryRouting)
    ? prefixExactExceptionApprovalAnchor({
        answer: meetingAnchoredAnswer,
        routing: dataQueryRouting,
        toolCalls,
        hebrew: isHebrew(message)
      })
    : meetingAnchoredAnswer;
  return { answer, sources: uniqueSources, toolCalls, knowledgePlan, investigationPlan, sourceQuality, conflicts, graphContext };
}

export function buildSafetyPrecheckTools({
  structuredDataQueryRoute = false,
  toolsRuntime = {},
  classification = {}
} = {}) {
  if (
    structuredDataQueryRoute ||
    toolsRuntime.safetyPrecheckEnabled === false ||
    classification.urgency !== "HIGH"
  ) {
    return [];
  }
  return ["safety_report", ...(toolsRuntime.alertAgentEnabled === false ? [] : ["alert"])];
}

async function hybridSearchWithRelaxedHashtags({ config, query, dateFrom, dateTo, hashtags = [], topK, runId, context, cacheContext, telemetryFor }) {
  const requestedHashtags = normalizeTagList(hashtags);
  const results = await hybridSearch({
    config,
    query,
    dateFrom,
    dateTo,
    hashtags: requestedHashtags,
    topK,
    cacheContext,
    telemetry: telemetryFor("hybrid_search")
  });
  if (countRows(results) || !requestedHashtags.length) {
    return { results, relaxedHashtags: false };
  }

  emitRunEvent(runId, "hybrid_search", "No records with hashtag filter, retrying without hashtags", {
    context,
    query,
    hashtags: requestedHashtags
  });
  const relaxedResults = await hybridSearch({
    config,
    query,
    dateFrom,
    dateTo,
    hashtags: [],
    topK,
    cacheContext,
    telemetry: telemetryFor("hybrid_search")
  });
  return { results: relaxedResults, relaxedHashtags: true };
}

async function runKnowledgePlanner({ message, classification, config, trace, runId, telemetryFor }) {
  const tags = [...new Set([...(classification.knowledge_tags || []), ...(classification.hashtags || [])])];
  const routedAgents = routeKnowledgeAgents({ message, tags, limit: config.knowledge?.agentLimit || 2 });
  emitRunEvent(runId, "knowledge_planner", "Searching local Knowledge Base", {
    query: message,
    tags,
    agents: routedAgents.map((agent) => ({ id: agent.id, name: agent.name, score: agent.score }))
  });
  let search;
  try {
    const searches = await Promise.all(
      routedAgents.map((agent) => searchKnowledgeBase({ query: message, tags: [...tags, ...agent.tags], topK: config.knowledge?.topK || 4, agentId: agent.id, chunkSize: config.knowledge?.chunkSize || 1800 }))
    );
    search = {
      agentIds: routedAgents.map((agent) => agent.id),
      agents: routedAgents.map((agent) => ({ id: agent.id, name: agent.name, description: agent.description })),
      matches: searches.flatMap((item) => item.matches || [])
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Number(config.knowledge?.agentLimit || 2)) * Math.max(1, Number(config.knowledge?.topK || 4))),
      totalDocuments: searches.reduce((sum, item) => sum + Number(item.totalDocuments || 0), 0),
      totalChunks: searches.reduce((sum, item) => sum + Number(item.totalChunks || 0), 0)
    };
  } catch (error) {
    const skippedPlan = skippedKnowledgePlan(`Knowledge Base unavailable: ${error.message}`);
    trace.push({ step: "knowledgePlanner", ok: false, skipped: true, error: error.message });
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner skipped", skippedPlan);
    return skippedPlan;
  }
  if (!search.matches.length) {
    const skippedPlan = skippedKnowledgePlan(
      search.totalDocuments ? "No relevant Knowledge Base excerpts found" : "Knowledge Base ריק",
      search.totalDocuments ? "לא נמצאו מקטעי ידע רלוונטיים." : "Knowledge Base ריק."
    );
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner skipped", skippedPlan);
    return skippedPlan;
  }

  const fallback = fallbackKnowledgePlan({ message, classification, matches: search.matches, agents: search.agents });
  if (!config.openRouterApiKey) {
    trace.push({ step: "knowledgePlanner", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "knowledge_planner", "Missing OpenRouter key, using local knowledge fallback", { matches: search.matches.length });
    return fallback;
  }

  try {
    emitRunEvent(runId, "knowledge_planner", "Calling Professional Knowledge Agent", {
      model: config.models.knowledgePlanner,
      matches: search.matches.length,
      agents: search.agents
    });
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.knowledgePlanner,
      temperature: config.ai?.knowledgePlanner?.temperature ?? 0.1,
      maxTokens: config.ai?.knowledgePlanner?.maxTokens ?? 2200,
      timeoutMs: config.ai?.knowledgePlanner?.timeoutMs ?? 90_000,
      ...samplingSettings(config, "knowledgePlanner"),
      responseFormat: KNOWLEDGE_PLANNER_RESPONSE_FORMAT,
      telemetry: telemetryFor("knowledge_planner"),
      messages: [
        { role: "system", content: config.prompts?.knowledge_planner || "" },
        {
          role: "user",
          content: JSON.stringify({
            user_message: message,
            classification,
            selected_knowledge_agents: search.agents,
            knowledge_excerpts: search.matches.map((match) => ({
              agentId: match.agentId,
              agentName: match.agentName,
              filename: match.filename,
              chunkIndex: match.chunkIndex,
              score: match.score,
              text: match.text
            }))
          }, null, 2)
        }
      ]
    });
    const plan = await parseOrRepairKnowledgePlan({
      content,
      message,
      classification,
      config,
      search,
      trace,
      runId,
      telemetryFor
    });
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner completed", plan);
    return plan;
  } catch (error) {
    trace.push({ step: "knowledgePlanner", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner failed, using fallback", { error: error.message });
    return fallback;
  }
}

async function parseOrRepairKnowledgePlan({ content, message, classification, config, search, trace, runId, telemetryFor }) {
  try {
    return normalizeKnowledgePlan(extractJsonObject(content), search.matches, search.agents);
  } catch (error) {
    trace.push({ step: "knowledgePlanner", ok: false, recoverable: true, error: error.message });
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner returned invalid JSON, retrying repair", {
      error: error.message,
      content_preview: String(content || "").slice(0, 600)
    });
    const repaired = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.knowledgePlanner,
      temperature: 0,
      maxTokens: Math.max(1200, Math.min(Number(config.ai?.knowledgePlanner?.maxTokens ?? 2200), 3000)),
      timeoutMs: config.ai?.knowledgePlanner?.timeoutMs ?? 90_000,
      ...samplingSettings(config, "knowledgePlanner"),
      responseFormat: KNOWLEDGE_PLANNER_RESPONSE_FORMAT,
      telemetry: telemetryFor("knowledge_planner"),
      messages: [
        {
          role: "system",
          content: `You repair Professional Knowledge Planner output.
Return only one valid JSON object.
Do not include Markdown, explanations, or extra text.
Use this exact schema:
{
  "domain_summary": "concise professional guidance",
  "relevant_terms": ["term"],
  "decision_criteria": ["criterion"],
  "rag_queries": ["concrete search query"],
  "recommended_tools": ["valid tool name"],
  "risks_or_cautions": ["caution or limitation"]
}`
        },
        {
          role: "user",
          content: JSON.stringify({
            user_message: message,
            classification,
            selected_knowledge_agents: search.agents,
            invalid_model_output: String(content || "").slice(0, 5000)
          }, null, 2)
        }
      ]
    });
    const plan = normalizeKnowledgePlan(extractJsonObject(repaired), search.matches, search.agents);
    return { ...plan, planner_json_repaired: true };
  }
}

async function callProjectTool({
  toolName,
  message,
  classification,
  sessionId,
  config,
  runId = null,
  cacheContext = null,
  telemetryFor,
  meetingEvidenceScope = null,
  dataQuerySettingsOverride = null,
  dataQueryRoutingOverride = null
}) {
  if (toolName === "data_query") {
    try {
      const requestSettings = dataQuerySettingsOverride || dataQuerySettings(config);
      const classifierDateScope = dataQueryClassifierDateScopeForQuestion({
        message,
        classification,
        settings: requestSettings
      });
      const result = await runDataQueryAgent({
        config,
        settings: requestSettings,
        question: message,
        context: {
          dateFrom: classifierDateScope.dateFrom,
          dateTo: classifierDateScope.dateTo,
          sessionId,
          source: "main_agent",
          runId,
          callerNodeId: "main_agent",
          projectId: config.projectId || config.contentSource?.projectId || null
        },
        telemetry: telemetryFor("data_query")
      });
      if (
        dataQueryRoutingOverride?.supported === true &&
        result.routing?.supported !== true
      ) {
        throw new Error("Data Query routing changed after exact-route selection");
      }
      return {
        toolName,
        ok: ["ok", "partial"].includes(result.status),
        skipped: ["skipped", "needs_clarification", "not_computable"].includes(result.status),
        data: result,
        answer: result.answer,
        sources: []
      };
    } catch (error) {
      return { toolName, ok: false, error: error.message, data: null, sources: [] };
    }
  }
  if (toolName === "meeting_evidence_search") {
    try {
      const result = await runMeetingEvidenceAgent({
        query: message,
        keywords: classification?.hashtags || [],
        meetingId: meetingEvidenceScope?.meetingId || null,
        projectId: meetingEvidenceScope?.projectId || null,
        attachmentId: meetingEvidenceScope?.attachmentId || null,
        expectedMeetingDate: meetingEvidenceScope?.meetingDate || null,
        expectedStatus: meetingEvidenceScope?.status || null,
        dateFrom: classification?.date_from || null,
        dateTo: classification?.date_to || null,
        requireQuote: config.meetingsEvidence?.requireQuote !== false,
        cacheContext,
        telemetry: telemetryFor("meeting_evidence")
      });
      const evidenceText = result.status === "found"
        ? result.evidence.slice(0, 8).map((e) => {
            const quote = e.quote && e.quote.length > 700 ? e.quote.slice(0, 700) + "…" : e.quote;
            return `${formatMeetingCitation(e)}\n${quote}`;
          }).join("\n\n")
        : null;
      return {
        toolName,
        ok: result.status !== "error",
        skipped: result.status === "not_found",
        data: result,
        answer: evidenceText,
        sources: []
      };
    } catch (error) {
      return { toolName, ok: false, error: error.message, data: null, sources: [] };
    }
  }
  if (toolName === "alert") {
    try {
      const result = await runAlertAgent({
        ...buildAlertAgentRequest({ message, classification }),
        cacheContext,
        telemetry: telemetryFor("alert_agent")
      });
      return {
        toolName,
        ok: result.ok,
        data: result.answer,
        sources: extractLinks(result.answer)
      };
    } catch (error) {
      return { toolName, ok: false, error: error.message, data: null, sources: [] };
    }
  }
  if (isInternalContentTool(toolName, config)) {
    return callInternalContentTool({
      config,
      toolName,
      query: message,
      dateFrom: classification.date_from,
      dateTo: classification.date_to,
      cacheContext,
      telemetry: telemetryFor(toolName)
    });
  }
  return callN8nTool({
    toolName,
    query: message,
    dateFilter: buildDateFilter(classification),
    dateFrom: classification.date_from,
    dateTo: classification.date_to,
    sessionId,
    config
  });
}

export function shouldRunDataQuery({ message, classification, config, settings = null, routing = null }) {
  if (config?.dataQuery?.enabled === false || classification?.type === "CHAT") return false;
  const hasDataQueryHint = hintedTools(classification).includes("data_query");
  const capability = routing || classifyDataQueryCapability(message, {
    hasDataQueryHint,
    settings: settings || dataQuerySettings(config)
  });
  return capability.supported ||
    isDeterministicSafetyNotComputableCapability(capability) ||
    isDeterministicAlertNotComputableCapability(capability) ||
    isDeterministicMeetingNotComputableCapability(capability) ||
    isDeterministicEmailNotComputableCapability(capability) ||
    isDeterministicExceptionNotComputableCapability(capability) ||
    isDeterministicConsultantReportNotComputableCapability(capability);
}

export function normalizeDataQueryClassifierDate(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const midnight = normalized.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:\d{2})$/i);
  return midnight ? midnight[1] : normalized;
}

export function dataQueryClassifierDateScopeForQuestion({
  message = "",
  classification = {},
  settings = dataQuerySettings()
} = {}) {
  const routing = classifyDataQueryCapability(message, {
    hasDataQueryHint: hintedTools(classification).includes("data_query"),
    settings
  });
  const unscopedTimeSeries = routing.supported === true &&
    routing.metricScope?.operation === "timeseries" &&
    !routing.metricScope?.dateScopeRequirement;
  return {
    dateFrom: unscopedTimeSeries ? null : normalizeDataQueryClassifierDate(classification?.date_from),
    dateTo: unscopedTimeSeries ? null : normalizeDataQueryClassifierDate(classification?.date_to)
  };
}

export function shouldBypassGenericRetrieval({ message, classification, config, settings = null, routing = null }) {
  if (classification?.type === "CHAT") return false;
  const capability = routing || classifyDataQueryCapability(message, {
    hasDataQueryHint: hintedTools(classification).includes("data_query"),
    settings: settings || dataQuerySettings(config)
  });
  if (isPureMeetingEvidenceCapability(capability)) return true;
  if (isPureEmailSemanticCapability(capability)) return true;
  if (isMeetingSemanticFallbackCapability(capability)) return false;
  return (
    capability.supported === true &&
    ["content_structured_lookup", "content_metadata_metrics"].includes(capability.domain)
  ) ||
    isDeterministicSafetyNotComputableCapability(capability) ||
    isDeterministicAlertNotComputableCapability(capability) ||
    isDeterministicAlertMixedCapability(capability) ||
    isDeterministicMeetingNotComputableCapability(capability) ||
    isDeterministicMeetingMixedCapability(capability) ||
    isDeterministicEmailNotComputableCapability(capability) ||
    isDeterministicExceptionNotComputableCapability(capability) ||
    isDeterministicExceptionMixedCapability(capability) ||
    isDeterministicConsultantReportNotComputableCapability(capability) ||
    isDeterministicConsultantReportMixedCapability(capability) ||
    isPureMeetingEvidenceCapability(capability);
}

export function isMeetingSemanticFallbackCapability(capability = null) {
  const meetingLookup = capability?.lookup?.targetTable === "meetings";
  if (capability?.supported === true && capability?.mixed !== true && capability?.intent === "lookup" && meetingLookup) {
    return true;
  }
  return capability?.supported === false &&
    capability?.status === "not_computable" &&
    ["meeting_unapproved_lookup_not_computable", "structured_lookup_not_available"].includes(capability?.warning) &&
    (meetingLookup || capability?.metricScope?.targetTable === "meetings");
}

export function buildMainProjectTools({
  message,
  classification,
  config,
  plannerTools = [],
  meetingsEvidenceTool = [],
  safetyPrecheckTools = [],
  shouldRunMeetingEvidence = false,
  dataQuerySettingsOverride = null,
  dataQueryRoutingOverride = null
}) {
  const toolsRuntime = config?.n8n?.runtime || {};
  const dataQueryRouting = dataQueryRoutingOverride || classifyDataQueryCapability(message, {
    hasDataQueryHint: hintedTools(classification).includes("data_query"),
    settings: dataQuerySettingsOverride || dataQuerySettings(config)
  });
  const originWarnings = ["alert_content_origin_not_approved", "meeting_content_origin_not_approved", "email_content_origin_not_approved", "exception_content_origin_not_approved", "consultant_content_origin_not_approved"];
  const runDataQuery = originWarnings.includes(dataQueryRouting?.warning)
    ? false
    : shouldRunDataQuery({
        message,
        classification,
        config,
        settings: dataQuerySettingsOverride,
        routing: dataQueryRouting
      });
  const classificationTools = hintedTools(classification).filter((toolName) => toolName !== "data_query" || runDataQuery);
  const dataQueryTool = runDataQuery ? ["data_query"] : [];
  if (originWarnings.includes(dataQueryRouting?.warning)) return [];
  if (isPureMeetingEvidenceCapability(dataQueryRouting)) {
    return shouldRunMeetingEvidence ? ["meeting_evidence_search"] : [];
  }
  if (isPureEmailSemanticCapability(dataQueryRouting)) {
    return ["emails"];
  }
  if (
    runDataQuery &&
    (
      isDeterministicFinancialTransactionTypeCapability(dataQueryRouting) ||
      isDeterministicFinancialDocumentMetricCapability(dataQueryRouting) ||
      isDeterministicSafetyCapability(dataQueryRouting) ||
      isDeterministicSafetyNotComputableCapability(dataQueryRouting) ||
      isDeterministicAlertCapability(dataQueryRouting) ||
      isDeterministicAlertNotComputableCapability(dataQueryRouting) ||
      isDeterministicAlertMixedCapability(dataQueryRouting) ||
      isDeterministicMeetingCapability(dataQueryRouting) ||
      isDeterministicMeetingNotComputableCapability(dataQueryRouting) ||
      isDeterministicMeetingMixedCapability(dataQueryRouting) ||
      isDeterministicEmailCapability(dataQueryRouting) ||
      isDeterministicEmailNotComputableCapability(dataQueryRouting) ||
      isDeterministicExceptionCapability(dataQueryRouting) ||
      isDeterministicExceptionNotComputableCapability(dataQueryRouting) ||
      isDeterministicExceptionMixedCapability(dataQueryRouting) ||
      isDeterministicConsultantReportCapability(dataQueryRouting) ||
      isDeterministicConsultantReportNotComputableCapability(dataQueryRouting) ||
      isDeterministicConsultantReportMixedCapability(dataQueryRouting) ||
      isExceptionCountApprovalMixedCapability(dataQueryRouting)
    )
  ) {
    return dataQueryTool;
  }
  const ordered = buildToolOrder(classification, [
    ...dataQueryTool,
    ...classificationTools,
    ...(dataQueryRouting.domain === "content_mixed_exact_semantic"
      ? [dataQueryRouting.lookup?.targetTable === "alerts" || dataQueryRouting.metricScope?.targetTable === "alerts"
          ? "alert"
          : dataQueryRouting.lookup?.targetTable === "emails" || dataQueryRouting.metricScope?.targetTable === "emails"
            ? "emails"
            : "safety_report"]
      : []),
    ...plannerTools,
    ...meetingsEvidenceTool
  ])
    .filter((toolName) => !safetyPrecheckTools.includes(toolName))
    // The n8n runtime kill-switch does not gate tools that run internally.
    .filter((toolName) => toolsRuntime.enabled !== false || isInternalContentTool(toolName, config) || isInternalProjectTool(toolName))
    .filter((toolName) => toolsRuntime.alertAgentEnabled !== false || toolName !== "alert")
    .filter((toolName) => toolName !== "meeting_evidence_search" || shouldRunMeetingEvidence)
    .filter((toolName) => toolName !== "data_query" || config?.dataQuery?.enabled !== false);
  // Internal Data Query does not consume the external n8n concurrency budget.
  // This prevents a low parallelLimit from silently dropping the exact route.
  const dataQuery = ordered.filter((toolName) => toolName === "data_query");
  const external = ordered
    .filter((toolName) => toolName !== "data_query")
    .slice(0, Number(toolsRuntime.parallelLimit || 6));
  return [...dataQuery, ...external];
}

export function isDeterministicInvoiceCapability(capability = null) {
  return capability?.supported === true && (
    capability.lookup?.recordKind === "invoice" ||
    capability.metricScope?.recordKind === "invoice"
  );
}

export function isDeterministicFinancialTransactionTypeCapability(capability = null) {
  return capability?.supported === true && (
    ["invoice", "financial_transaction_type"].includes(capability.lookup?.recordKind) ||
    ["invoice", "financial_transaction_type"].includes(capability.metricScope?.recordKind)
  );
}

export function isDeterministicFinancialDocumentMetricCapability(capability = null) {
  return capability?.supported === true &&
    capability.intent === "metrics" &&
    capability.metricScope?.targetTable === "financial_transactions" &&
    capability.metricScope?.recordKind === "financial_document";
}

export function isDeterministicSafetyCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed !== true &&
    (
      capability.lookup?.targetTable === "safety_reports" ||
      capability.metricScope?.targetTable === "safety_reports"
    );
}

export function isDeterministicSafetyNotComputableCapability(capability = null) {
  return capability?.supported === false &&
    capability?.status === "not_computable" &&
    capability?.metricScope?.targetTable === "safety_reports" &&
    [
      "safety_worker_aggregate_not_computable",
      "safety_resolution_status_not_computable"
    ].includes(capability?.warning);
}

export function isDeterministicAlertCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed !== true &&
    (
      capability.lookup?.targetTable === "alerts" ||
      capability.metricScope?.targetTable === "alerts"
    );
}

export function isDeterministicAlertNotComputableCapability(capability = null) {
  const alertTarget = capability?.metricScope?.targetTable === "alerts" ||
    capability?.lookup?.targetTable === "alerts";
  const unavailableWarning = [
    "structured_metrics_not_available",
    "structured_lookup_not_available"
  ].includes(capability?.warning);
  return capability?.supported === false &&
    alertTarget &&
    (capability?.status === "not_computable" || unavailableWarning) &&
    [
      "alert_semantic_severity_not_computable",
      "alert_lifecycle_status_not_computable",
      "alert_unique_sources_not_computable",
      "alert_distinct_values_not_computable",
      "alert_time_granularity_not_computable",
      "alert_numeric_aggregate_not_computable",
      "alert_source_links_not_computable",
      "alert_grouped_lookup_not_computable",
      "alert_unapproved_lookup_not_computable",
      "alert_multidimensional_timeseries_not_computable",
      "alert_ingestion_time_not_computable",
      "alert_ambiguous_qualifier_requires_clarification",
      "alert_scope_field_not_queryable",
      "alert_dated_filter_not_computable",
      "alert_undated_temporal_conflict_not_computable",
      "alert_excluded_status_not_computable",
      "alert_unapproved_metric_not_computable",
      "invalid_lookup_limit",
      "alert_content_origin_not_approved",
      "structured_metrics_not_available",
      "structured_lookup_not_available"
    ].includes(capability?.warning);
}

export function isDeterministicAlertMixedCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed === true &&
    (
      capability.lookup?.targetTable === "alerts" ||
      capability.metricScope?.targetTable === "alerts"
    );
}

export function isDeterministicMeetingCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed !== true &&
    (
      capability.lookup?.targetTable === "meetings" ||
      capability.metricScope?.targetTable === "meetings"
    );
}

export function isDeterministicMeetingMixedCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed === true &&
    capability?.lookup?.targetTable === "meetings";
}

export function isPureMeetingEvidenceCapability(capability = null) {
  const semanticMeetingRoute = capability?.domain === "semantic_or_citation" &&
    capability?.warning === "semantic_question_route_elsewhere";
  const typedLookupFallback = capability?.status === "not_computable" &&
    capability?.warning === "meeting_unapproved_lookup_not_computable";
  return (semanticMeetingRoute || typedLookupFallback) &&
    capability?.suggestedAgent === "meeting_evidence" &&
    capability?.mixed !== true;
}

export function isDeterministicMeetingNotComputableCapability(capability = null) {
  const meetingTarget = capability?.metricScope?.targetTable === "meetings" ||
    capability?.lookup?.targetTable === "meetings";
  return capability?.supported === false &&
    meetingTarget &&
    capability?.status === "not_computable" &&
    [
      "meeting_attendance_not_computable",
      "meeting_decision_presence_not_computable",
      "meeting_ingestion_time_not_computable",
      "meeting_scope_field_not_queryable",
      "meeting_unapproved_lookup_not_computable",
      "meeting_unapproved_metric_not_computable",
      "meeting_date_scope_not_resolved",
      "invalid_lookup_limit",
      "meeting_content_origin_not_approved",
      "structured_metrics_not_available",
      "structured_lookup_not_available"
    ].includes(capability?.warning);
}

export function isDeterministicEmailCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed !== true &&
    (
      capability.lookup?.targetTable === "emails" ||
      capability.metricScope?.targetTable === "emails"
    );
}

export function isDeterministicEmailMixedCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed === true &&
    (
      capability.lookup?.targetTable === "emails" ||
      capability.metricScope?.targetTable === "emails"
    );
}

export function isPureEmailSemanticCapability(capability = null) {
  return capability?.supported === false &&
    capability?.domain === "semantic_or_citation" &&
    capability?.suggestedAgent === "emails" &&
    capability?.mixed !== true;
}

export function isDeterministicEmailNotComputableCapability(capability = null) {
  const emailTarget = capability?.metricScope?.targetTable === "emails" ||
    capability?.lookup?.targetTable === "emails";
  const unavailableWarning = ["structured_metrics_not_available", "structured_lookup_not_available"]
    .includes(capability?.warning);
  return capability?.supported === false &&
    emailTarget &&
    (capability?.status === "not_computable" || unavailableWarning) &&
    [
      "email_ingestion_time_not_computable",
      "email_scope_field_not_queryable",
      "email_pii_metric_not_computable",
      "email_attachment_documents_not_computable",
      "email_multidimensional_timeseries_not_computable",
      "email_no_clear_scope_count_only",
      "email_spam_not_equivalent_to_relevance",
      "email_unapproved_metric_not_computable",
      "invalid_lookup_limit",
      "email_content_origin_not_approved",
      "structured_metrics_not_available",
      "structured_lookup_not_available"
    ].includes(capability?.warning);
}

export function isDeterministicExceptionCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed !== true &&
    (
      capability.lookup?.targetTable === "exceptions_report" ||
      capability.metricScope?.targetTable === "exceptions_report"
    );
}

export function isDeterministicExceptionMixedCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed === true &&
    capability?.lookup?.targetTable === "exceptions_report";
}

export function isExceptionCountApprovalMixedCapability(capability = null) {
  return capability?.supported === true &&
    capability?.mixed === true &&
    capability?.mixedKind === "exception_count_approval_evidence" &&
    capability?.metricScope?.targetTable === "exceptions_report" &&
    capability?.metricScope?.operation === "count";
}

export function isDeterministicExceptionNotComputableCapability(capability = null) {
  const exceptionTarget = capability?.metricScope?.targetTable === "exceptions_report" ||
    capability?.lookup?.targetTable === "exceptions_report";
  return capability?.supported === false &&
    exceptionTarget &&
    capability?.status === "not_computable" &&
    [
      "exception_ingestion_time_not_computable",
      "exception_identity_field_not_queryable",
      "exception_amount_not_computable",
      "exception_execution_days_not_computable",
      "exception_identity_grouping_not_computable",
      "exception_category_not_computable",
      "exception_lifecycle_status_not_computable",
      "exception_multidimensional_timeseries_not_computable",
      "exception_ambiguous_or_negative_scope_not_computable",
      "exception_unapproved_lookup_not_computable",
      "exception_unapproved_metric_not_computable",
      "invalid_lookup_limit",
      "exception_content_origin_not_approved",
      "structured_metrics_not_available",
      "structured_lookup_not_available"
    ].includes(capability?.warning);
}

export function isDeterministicConsultantReportCapability(capability = null) {
  return capability?.supported === true && capability?.mixed !== true && (capability.lookup?.targetTable === "consultants_reports" || capability.metricScope?.targetTable === "consultants_reports");
}

export function isDeterministicConsultantReportMixedCapability(capability = null) {
  return capability?.supported === true && capability?.mixed === true && capability?.lookup?.targetTable === "consultants_reports";
}

export function isDeterministicConsultantReportNotComputableCapability(capability = null) {
  const target = capability?.lookup?.targetTable === "consultants_reports" || capability?.metricScope?.targetTable === "consultants_reports";
  const peopleCountAmbiguity = capability?.warning === "consultant_people_count_not_computable";
  return capability?.supported === false && (target || peopleCountAmbiguity) && capability?.status === "not_computable" && [
    "consultant_people_count_not_computable",
    "consultant_ingestion_time_not_computable", "consultant_identity_field_not_queryable",
    "consultant_identity_grouping_not_computable", "consultant_category_not_computable",
    "consultant_implementation_status_not_computable", "consultant_multidimensional_timeseries_not_computable",
    "consultant_unapproved_lookup_not_computable", "consultant_unapproved_metric_not_computable",
    "invalid_lookup_limit", "consultant_content_origin_not_approved", "structured_metrics_not_available", "structured_lookup_not_available"
  ].includes(capability?.warning);
}

export function enforceAlertDataQueryTrustedOrigin(routing = null, requestConfig = {}, trustedConfig = getConfig()) {
  const alertTarget = routing?.lookup?.targetTable === "alerts" ||
    routing?.metricScope?.targetTable === "alerts";
  const meetingTarget = routing?.lookup?.targetTable === "meetings" ||
    routing?.metricScope?.targetTable === "meetings";
  const emailTarget = routing?.lookup?.targetTable === "emails" ||
    routing?.metricScope?.targetTable === "emails";
  const exceptionTarget = routing?.lookup?.targetTable === "exceptions_report" ||
    routing?.metricScope?.targetTable === "exceptions_report";
  const consultantTarget = routing?.lookup?.targetTable === "consultants_reports" || routing?.metricScope?.targetTable === "consultants_reports";
  if (!alertTarget && !meetingTarget && !emailTarget && !exceptionTarget && !consultantTarget) return routing;
  const requestUrl = normalizeDataQueryContentOrigin(
    requestConfig?.contentSource?.supabaseUrl || requestConfig?.contentSupabaseUrl
  );
  const trustedUrl = normalizeDataQueryContentOrigin(
    trustedConfig?.contentSource?.supabaseUrl || trustedConfig?.contentSupabaseUrl
  );
  if (requestUrl && trustedUrl && requestUrl === trustedUrl) return routing;
  const targetTable = meetingTarget ? "meetings" : emailTarget ? "emails" : exceptionTarget ? "exceptions_report" : consultantTarget ? "consultants_reports" : "alerts";
  const recordKind = meetingTarget ? "meeting" : emailTarget ? "email" : exceptionTarget ? "exception" : consultantTarget ? "consultant report" : "alert";
  return {
    ...routing,
    supported: false,
    status: "not_computable",
    domain: "content_metadata_metrics",
    intent: routing?.intent || (routing?.lookup ? "lookup" : "metrics"),
    lookup: null,
    metricScope: routing?.metricScope || { targetTable, recordKind },
    mixed: false,
    reason: `Exact ${recordKind} reads are unavailable because the request Content origin does not match the trusted managed Data Query origin.`,
    warning: meetingTarget
      ? "meeting_content_origin_not_approved"
      : emailTarget
        ? "email_content_origin_not_approved"
        : exceptionTarget
          ? "exception_content_origin_not_approved"
        : consultantTarget
          ? "consultant_content_origin_not_approved"
        : "alert_content_origin_not_approved",
    suggestedAgent: null
  };
}

export function summarizeMeetingEvidenceErrorForWorkflow(result = {}) {
  return result?.error || result?.data?.error ? "meeting_evidence_failed" : null;
}

export function projectMeetingEvidenceConflicts(toolCalls = []) {
  const hasEvidenceConflict = (Array.isArray(toolCalls) ? toolCalls : [])
    .filter((call) => call?.toolName === "meeting_evidence_search")
    .some((call) => Array.isArray(call?.data?.conflicts) && call.data.conflicts.length > 0);
  return hasEvidenceConflict
    ? [{
        type: "meeting_evidence_conflict",
        summary: "Potentially conflicting meeting evidence requires review."
      }]
    : [];
}

function normalizeDataQueryContentOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

export function buildMainDataQueryWorkflowProjection({
  dataQueryCall = {},
  question = "",
  allowedTables = []
} = {}) {
  const data = dataQueryCall.data && typeof dataQueryCall.data === "object" ? dataQueryCall.data : {};
  const plans = Array.isArray(data.plans) ? data.plans : [];
  const targetsMeetings = data.routing?.lookup?.targetTable === "meetings" ||
    data.routing?.metricScope?.targetTable === "meetings" ||
    data.tablesUsed?.includes("meetings") ||
    plans.some((plan) => plan?.table === "meetings") ||
    data.queryPlan?.plans?.some((plan) => plan?.table === "meetings");
  const targetsEmails = data.routing?.lookup?.targetTable === "emails" ||
    data.routing?.metricScope?.targetTable === "emails" ||
    data.tablesUsed?.includes("emails") ||
    plans.some((plan) => plan?.table === "emails") ||
    data.queryPlan?.plans?.some((plan) => plan?.table === "emails");
  const targetsExceptions = data.routing?.lookup?.targetTable === "exceptions_report" ||
    data.routing?.metricScope?.targetTable === "exceptions_report" ||
    data.tablesUsed?.includes("exceptions_report") ||
    plans.some((plan) => plan?.table === "exceptions_report") ||
    data.queryPlan?.plans?.some((plan) => plan?.table === "exceptions_report");
  const targetsConsultants = data.routing?.lookup?.targetTable === "consultants_reports" || data.routing?.metricScope?.targetTable === "consultants_reports" || data.tablesUsed?.includes("consultants_reports") || plans.some((plan) => plan?.table === "consultants_reports") || data.queryPlan?.plans?.some((plan) => plan?.table === "consultants_reports");
  const machineResult = summarizeDataQueryMachineResultForWorkflow(data.machineResult || {});
  if (targetsMeetings || targetsEmails || targetsExceptions || targetsConsultants) {
    machineResult.recordFields = (machineResult.recordFields || [])
      .filter((field) => !["id", "project_id", "attachment_id", "mail_id", "conversationid"].includes(field));
  }
  const redactedPlans = plans.map((plan) => ({
    operation: plan.operation || null,
    table: plan.table || null,
    status: plan.status || null,
    rows: Number.isFinite(Number(plan.rows)) ? Number(plan.rows) : 0,
    cardinality: plan.cardinality ?? null,
    exactness: plan.exactness || null,
    truncated: plan.truncated === true,
    sampled: plan.sampled === true,
    cacheHit: plan.cacheHit === true
  }));
  return {
    input: {
      question: summarizeDataQueryQuestionForWorkflow(question),
      requested_plan_count: Array.isArray(data.queryPlan?.plans) ? data.queryPlan.plans.length : 0,
      allowed_tables: Array.isArray(allowedTables) ? [...allowedTables] : []
    },
    output: {
      status: data.status || null,
      contract_version: data.contractVersion || null,
      caller: summarizeDataQueryCallerForWorkflow(data.caller || {}),
      routing: summarizeDataQueryRoutingForWorkflow(data.routing || {}),
      plans_executed: redactedPlans,
      rows_returned: redactedPlans.reduce((sum, plan) => sum + plan.rows, 0),
      metrics: summarizeDataQueryMetricsForWorkflow(data.metrics || []),
      machine_result: machineResult,
      tables_used: Array.isArray(data.tablesUsed) ? data.tablesUsed : [],
      warnings: summarizeDataQueryWarningsForWorkflow(data.warnings || []),
      error: dataQueryCall.error ? "data_query_failed" : null
    }
  };
}

export function projectChatToolCallsForClient(toolCalls = [], { question = "" } = {}) {
  return (Array.isArray(toolCalls) ? toolCalls : []).map((call) => {
    if (call?.toolName === "exception_evidence_search") {
      return {
        toolName: "exception_evidence_search",
        ok: call.ok === true,
        skipped: call.skipped === true,
        data: {
          status: call.data?.status || null,
          same_exception_match: call.data?.same_exception_match === true,
          evidence_count: Number(call.data?.evidence_count || 0)
        },
        sources: []
      };
    }
    if (call?.toolName === "consultant_report_evidence_search") {
      return {
        toolName: "consultant_report_evidence_search", ok: call.ok === true, skipped: call.skipped === true,
        data: { status: call.data?.status || null, same_report_match: call.data?.same_report_match === true, evidence_count: Number(call.data?.evidence_count || 0) }, sources: []
      };
    }
    if (call?.toolName === "meeting_evidence_search") {
      const data = call.data && typeof call.data === "object" ? call.data : {};
      return {
        toolName: "meeting_evidence_search",
        ok: call.ok === true,
        skipped: call.skipped === true,
        data: {
          status: data.status || null,
          evidence_count: Array.isArray(data.evidence) ? data.evidence.length : 0,
          same_meeting_match: data.same_meeting_match === true,
          insufficient_evidence: data.insufficient_evidence !== false
        },
        ...(summarizeMeetingEvidenceErrorForWorkflow(call) ? { error: "meeting_evidence_failed" } : {}),
        sources: []
      };
    }
    if (call?.toolName !== "data_query") return call;
    const data = call.data && typeof call.data === "object" ? call.data : null;
    if (!data) {
      return {
        toolName: "data_query",
        ok: false,
        skipped: false,
        error: "data_query_failed",
        data: null,
        sources: []
      };
    }
    const targetsAlerts = data.routing?.lookup?.targetTable === "alerts" ||
      data.routing?.metricScope?.targetTable === "alerts" ||
      data.tablesUsed?.includes("alerts") ||
      data.plans?.some((plan) => plan?.table === "alerts") ||
      data.queryPlan?.plans?.some((plan) => plan?.table === "alerts");
    const targetsMeetings = data.routing?.lookup?.targetTable === "meetings" ||
      data.routing?.metricScope?.targetTable === "meetings" ||
      data.tablesUsed?.includes("meetings") ||
      data.plans?.some((plan) => plan?.table === "meetings") ||
      data.queryPlan?.plans?.some((plan) => plan?.table === "meetings");
    const targetsEmails = data.routing?.lookup?.targetTable === "emails" ||
      data.routing?.metricScope?.targetTable === "emails" ||
      data.tablesUsed?.includes("emails") ||
      data.plans?.some((plan) => plan?.table === "emails") ||
      data.queryPlan?.plans?.some((plan) => plan?.table === "emails");
    const targetsExceptions = data.routing?.lookup?.targetTable === "exceptions_report" ||
      data.routing?.metricScope?.targetTable === "exceptions_report" ||
      data.tablesUsed?.includes("exceptions_report") ||
      data.plans?.some((plan) => plan?.table === "exceptions_report") ||
      data.queryPlan?.plans?.some((plan) => plan?.table === "exceptions_report");
    const targetsConsultants = data.routing?.lookup?.targetTable === "consultants_reports" || data.routing?.metricScope?.targetTable === "consultants_reports" || data.tablesUsed?.includes("consultants_reports") || data.plans?.some((plan) => plan?.table === "consultants_reports") || data.queryPlan?.plans?.some((plan) => plan?.table === "consultants_reports");
    if (!targetsAlerts && !targetsMeetings && !targetsEmails && !targetsExceptions && !targetsConsultants) return call;
    return {
      toolName: "data_query",
      ok: call.ok === true,
      skipped: call.skipped === true,
      data: buildMainDataQueryWorkflowProjection({
        dataQueryCall: call,
        question
      }).output,
      ...(call.error ? { error: "data_query_failed" } : {}),
      sources: []
    };
  });
}

function projectToolCallsForMain(toolCalls = []) {
  return (Array.isArray(toolCalls) ? toolCalls : [])
    .filter((call) => !call?.skipped)
    .map((call) => {
      if (call?.toolName === "meeting_evidence_search") {
        const data = call.data && typeof call.data === "object" ? call.data : {};
        return {
          toolName: "meeting_evidence_search",
          ok: call.ok === true,
          data: {
            status: data.status || null,
            same_meeting_match: data.same_meeting_match === true,
            insufficient_evidence: data.insufficient_evidence !== false,
            evidence: (Array.isArray(data.evidence) ? data.evidence : []).slice(0, 8).map((item) => ({
              quote: String(item?.quote || "").slice(0, 1200),
              meeting_date: item?.meeting_date || null,
              citation: formatMeetingCitation(item)
            }))
          },
          sources: []
        };
      }
      if (call?.toolName === "consultant_report_evidence_search") {
        return { toolName: "consultant_report_evidence_search", ok: call.ok === true, data: { status: call.data?.status || null, same_report_match: call.data?.same_report_match === true, evidence_count: Number(call.data?.evidence_count || 0), answer: String(call.data?.answer || "").slice(0, 2400) }, sources: [] };
      }
      if (call?.toolName === "data_query") {
        const data = call.data && typeof call.data === "object" ? call.data : {};
        const targetsMeetings = data.routing?.lookup?.targetTable === "meetings" ||
          data.routing?.metricScope?.targetTable === "meetings" ||
          data.tablesUsed?.includes("meetings") ||
          data.plans?.some((plan) => plan?.table === "meetings");
        if (targetsMeetings) {
          return {
            toolName: "data_query",
            ok: call.ok === true,
            data: {
              status: data.status || null,
              routing: {
                domain: data.routing?.domain || null,
                intent: data.routing?.intent || null,
                mixed: data.routing?.mixed === true
              },
              exact_meetings: exactMeetingLookupRecords([call]).map((record) => ({
                meeting_date: record.meeting_date || null,
                status: record.status || null
              })),
              metrics: summarizeDataQueryMetricsForWorkflow(data.metrics || []),
              warnings: summarizeDataQueryWarningsForWorkflow(data.warnings || [])
            },
            sources: []
          };
        }
        const targetsEmails = data.routing?.lookup?.targetTable === "emails" ||
          data.routing?.metricScope?.targetTable === "emails" ||
          data.tablesUsed?.includes("emails") ||
          data.plans?.some((plan) => plan?.table === "emails");
        if (targetsEmails) {
          return {
            toolName: "data_query",
            ok: call.ok === true,
            data: {
              status: data.status || null,
              routing: {
                domain: data.routing?.domain || null,
                intent: data.routing?.intent || null,
                mixed: data.routing?.mixed === true
              },
              exact_emails: exactEmailLookupRecords([call]).map((record) => ({
                received_date: record.received_date || null,
                mail_category: record.mail_category || null,
                direction: record.direction || null,
                has_attachments: typeof record.has_attachments === "boolean" ? record.has_attachments : null,
                relevance_status: record.relevance_status || null,
                item_status: record.item_status || null
              })),
              metrics: summarizeDataQueryMetricsForWorkflow(data.metrics || []),
              warnings: summarizeDataQueryWarningsForWorkflow(data.warnings || [])
            },
            sources: []
          };
        }
        const targetsExceptions = data.routing?.lookup?.targetTable === "exceptions_report" ||
          data.routing?.metricScope?.targetTable === "exceptions_report" ||
          data.tablesUsed?.includes("exceptions_report") ||
          data.plans?.some((plan) => plan?.table === "exceptions_report");
        if (targetsExceptions) {
          return {
            toolName: "data_query",
            ok: call.ok === true,
            data: {
              status: data.status || null,
              routing: {
                domain: data.routing?.domain || null,
                intent: data.routing?.intent || null,
                mixed: data.routing?.mixed === true,
                mixedKind: data.routing?.mixedKind || null
              },
              metrics: summarizeDataQueryMetricsForWorkflow(data.metrics || []),
              warnings: summarizeDataQueryWarningsForWorkflow(data.warnings || [])
            },
            sources: []
          };
        }
        const targetsConsultants = data.routing?.lookup?.targetTable === "consultants_reports" || data.routing?.metricScope?.targetTable === "consultants_reports" || data.tablesUsed?.includes("consultants_reports") || data.plans?.some((plan) => plan?.table === "consultants_reports");
        if (targetsConsultants) {
          return { toolName: "data_query", ok: call.ok === true, data: { status: data.status || null, routing: { domain: data.routing?.domain || null, intent: data.routing?.intent || null, mixed: data.routing?.mixed === true }, exact_consultant_reports: exactConsultantReportLookupRecords([call]).map((record) => ({ report_date: record.report_date || null, item_status: record.item_status || null })), metrics: summarizeDataQueryMetricsForWorkflow(data.metrics || []), warnings: summarizeDataQueryWarningsForWorkflow(data.warnings || []) }, sources: [] };
        }
      }
      return call;
    });
}

function compactToolCallsForMainRetry(toolCalls = []) {
  return projectToolCallsForMain(toolCalls)
    .map((call) => {
      if (call?.toolName === "meeting_evidence_search") {
        return {
          ...call,
          data: {
            status: call.data?.status || null,
            same_meeting_match: call.data?.same_meeting_match === true,
            insufficient_evidence: call.data?.insufficient_evidence !== false,
            evidence: (Array.isArray(call.data?.evidence) ? call.data.evidence : [])
              .slice(0, 3)
              .map((item) => ({
                quote: String(item?.quote || "").slice(0, 500),
                meeting_date: item?.meeting_date || null,
                citation: item?.citation || null
              }))
          }
        };
      }
      const serialized = safeJsonStringify(call);
      if (serialized.length <= 3200) return call;
      return {
        toolName: call?.toolName || "project_source",
        ok: call?.ok === true,
        data: { status: call?.data?.status || null },
        sources: []
      };
    });
}

export function mainSynthesisRetryPolicy(error, config = {}) {
  const message = String(error?.message || "");
  const configuredMainTokens = Number(config.ai?.main?.maxTokens || 4096);
  if (/timed out/i.test(message)) {
    return {
      reason: "timeout",
      model: config.models?.main,
      maxTokens: Math.max(512, Math.min(1600, configuredMainTokens)),
      recordLimit: 5,
      chunkTextLimit: 700
    };
  }
  const providerCapacityFailure = Number(error?.httpStatus) === 402 || /more credits|can only afford/i.test(message);
  if (!providerCapacityFailure) return null;
  const parsedAffordable = Number(error?.affordableMaxTokens || String(message).match(/can\s+only\s+afford\s+([\d,]+)/i)?.[1]?.replaceAll(",", ""));
  const affordable = Number.isFinite(parsedAffordable) ? parsedAffordable : 900;
  const retryTokens = Math.min(1200, Math.max(0, affordable - Math.max(64, Math.floor(affordable * 0.08))));
  if (retryTokens < 256) return null;
  return {
    reason: "provider_capacity",
    model: config.models?.lite || config.models?.main,
    maxTokens: retryTokens,
    recordLimit: 5,
    chunkTextLimit: 700
  };
}

export function buildAlertAgentRequest({ message, classification }) {
  return {
    query: message,
    dateFilter: buildDateFilter(classification),
    dateFrom: classification?.date_from || null,
    dateTo: classification?.date_to || null
  };
}

async function synthesizeAnswer({ message, classification, memory, memorySummary, retrievalResults, graphContext = [], toolCalls, sources, knowledgePlan, investigationPlan, sourceQuality, conflicts, exactInvoiceEnrichment = null, config, trace, runId, cacheContext, telemetryFor }) {
  const successful = toolCalls.filter((call) => call.ok);
  const failed = toolCalls.filter((call) => !call.ok && !call.skipped);
  const skipped = toolCalls.filter((call) => call.skipped);
  const structuredLookup = successful.some((call) =>
    call.toolName === "data_query" &&
    call.data?.routing?.domain === "content_structured_lookup"
  );
  const listIntent = !structuredLookup && isEntityListQuestion(message);
  const retrievalLimit = contextRecordsLimitForQuestion({ config, listIntent, classification });
  const projectGraphFindings = buildProjectGraphFindings(graphContext, { listIntent });
  if (!config.openRouterApiKey) {
    console.warn("[main_agent] OPENROUTER_API_KEY is missing — cannot call LLM, returning structured fallback.");
    trace.push({ step: "mainAgent", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "main_agent", "Missing OpenRouter key, using fallback answer", {});
    return fallbackRagAnswer({ successful, failed, skipped, sources, message, retrievalResults, config });
  }

  try {
    emitRunEvent(runId, "main_agent", "Calling Main Agent", {
      model: config.models.main,
      retrievalRecords: countRows(retrievalResults),
      graphRelationships: graphContext.length,
      answerMode: listIntent ? "ranked_entity_list" : "standard_grounded_answer",
      toolCalls: toolCalls.length
    });
    const mainPayload = {
      user_message: message,
      answer_mode: listIntent ? "ranked_entity_list" : "standard_grounded_answer",
      retrieval_context: formatRetrievalContext(retrievalResults, retrievalLimit, config.rag?.chunkTextLimit || 1800, config),
      retrieval_results: retrievalResults,
      graph_context: graphContext,
      project_graph_findings: projectGraphFindings,
      knowledge_plan: knowledgePlan,
      investigation_plan: investigationPlan,
      source_quality: sourceQuality,
      potential_conflicts: conflicts,
      exact_invoice_enrichment: exactInvoiceEnrichment,
      tool_results: projectToolCallsForMain(toolCalls),
      skipped_tools: skipped.map((call) => call.toolName),
      sources
    };
    const systemPrompt = mainSystemPrompt(classification, config);
    const answer = await cachedOperation({
      context: cacheContext,
      type: "finalAnswer",
      keyParts: {
        user_question: message,
        retrieved_context_hash: hashValue({
          retrievalResults,
          graphContext,
          toolResults: mainPayload.tool_results,
          memorySummary,
          memory
        }),
        model: config.models.main,
        prompt_hash: hashValue(systemPrompt)
      },
      ttl: CACHE_TTL.finalAnswer,
      savedCall: "model",
      estimatedCost: 0.01,
      operation: async () => {
        const generated = await chatCompletion({
          apiKey: config.openRouterApiKey,
          model: config.models.main,
          temperature: config.ai?.main?.temperature ?? 0.2,
          maxTokens: config.ai?.main?.maxTokens ?? 4096,
          timeoutMs: config.ai?.main?.timeoutMs ?? 120_000,
          ...samplingSettings(config, "main"),
          telemetry: telemetryFor("main_agent"),
          messages: [
            { role: "system", content: systemPrompt },
            ...memory,
            {
              role: "user",
              content: safeJsonStringify(mainPayload)
            }
          ]
        });
        if (!String(generated || "").trim()) {
          throw new Error("Main Agent returned an empty response");
        }
        return generated;
      }
    });
    if (!String(answer || "").trim()) {
      console.warn("[main_agent] Model returned empty string — using structured fallback.");
      trace.push({ step: "mainAgent", ok: false, fallback: true, error: "Main Agent returned an empty answer" });
      emitRunEvent(runId, "main_agent", "Main Agent returned empty answer, using fallback", {});
      return fallbackRagAnswer({ successful, failed, skipped, sources, message, retrievalResults, config });
    }
    emitRunEvent(runId, "main_agent", "Main Agent response received", { length: answer.length });
    return appendEmailSemanticLatestBoundary(linkifyCitations(answer, sources), { message });
  } catch (error) {
    // Retry once with compact, deduplicated context when the provider times out
    // or rejects the requested output budget. The retry uses the configured
    // lite model for credit/capacity failures and never loops.
    const retryPolicy = mainSynthesisRetryPolicy(error, config);
    if (retryPolicy) {
      try {
        emitRunEvent(runId, "main_agent", "Main Agent retrying with compact context", {
          reason: retryPolicy.reason,
          model: retryPolicy.model,
          maxTokens: retryPolicy.maxTokens
        });
        const trimmedContext = formatRetrievalContext(
          retrievalResults,
          retryPolicy.recordLimit,
          retryPolicy.chunkTextLimit,
          config
        );
        const retryAnswer = await chatCompletion({
          apiKey: config.openRouterApiKey,
          model: retryPolicy.model,
          temperature: config.ai?.main?.temperature ?? 0.2,
          maxTokens: retryPolicy.maxTokens,
          timeoutMs: config.ai?.main?.timeoutMs ?? 120_000,
          ...samplingSettings(config, "main"),
          telemetry: telemetryFor("main_agent_compact_retry"),
          messages: [
            { role: "system", content: mainSystemPrompt(classification, config) },
            ...memory,
            {
              role: "user",
              content: safeJsonStringify({
                user_message: message,
                answer_mode: listIntent ? "ranked_entity_list" : "standard_grounded_answer",
                retrieval_context: trimmedContext,
                graph_context: (Array.isArray(graphContext) ? graphContext : []).slice(0, 4),
                project_graph_findings: (Array.isArray(projectGraphFindings) ? projectGraphFindings : []).slice(0, 4),
                tool_results: compactToolCallsForMainRetry(toolCalls.filter((call) => !call.skipped)),
                skipped_tools: skipped.map((call) => call.toolName),
                potential_conflicts: conflicts,
                sources: uniqueByUrl(sources).slice(0, 8)
              })
            }
          ]
        });
        if (String(retryAnswer || "").trim()) {
          emitRunEvent(runId, "main_agent", "Main Agent compact retry succeeded", {
            reason: retryPolicy.reason,
            length: retryAnswer.length
          });
          return appendEmailSemanticLatestBoundary(linkifyCitations(retryAnswer, sources), { message });
        }
      } catch (retryError) {
        trace.push({ step: "mainAgent", ok: false, fallback: true, error: `retry failed: ${retryError.message}` });
      }
    }
    trace.push({ step: "mainAgent", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "main_agent", "Main Agent failed, using fallback answer", { error: error.message });
    return fallbackRagAnswer({ successful, failed, skipped, sources, message, retrievalResults, config });
  }
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return JSON.stringify(value, (key, val) => (typeof val === "bigint" ? val.toString() : val));
    } catch {
      return JSON.stringify({ error: "payload could not be serialized" });
    }
  }
}

function mainSystemPrompt(classification, config) {
  const fallback = defaultPrompts().main;
  const rendered = renderPrompt(config.prompts?.main || fallback, {
    tool_hint: classification.tool_hint,
    complexity: classification.complexity,
    urgency: classification.urgency
  });
  return `${rendered}

CRITICAL KNOWLEDGE BOUNDARY:
- The final answer is customer-facing. Never mention internal component, agent, tool, route, model, prompt, database-table, or retrieval-stage names such as Data Query, Main Agent, Hybrid Search, Project Graph Search, or Reranker. Describe only the project facts, available documents, and honest information limits in natural business language.
- knowledge_plan is planning guidance only. It is not project evidence.
- Use knowledge_plan to decide what to look for and how to reason.
- Final factual claims must come only from retrieval_context, retrieval_results, tool_results, graph_context/project_graph_findings when they are connected to retrieved records, or explicit user input from the current request.
- For Data Query Agent output, consume numeric facts only from data.machineResult.metricsByRequestId and structured lookup facts only from data.machineResult.recordsByRequestId. Never parse those facts from the Data Query answer prose, never infer missing record fields, and preserve exactness/truncation warnings from planStatusByRequestId.
- For an exact structured lookup, Data Query determines which record is latest/earliest and is authoritative for its ID, date, status, and other returned fields. A semantic financial/tool result may enrich that same record with description, amount text, and citations, but must never replace it with a merely relevance-ranked record. If the semantic result cannot be matched to the exact record, answer from the Data Query fields and state that additional details were unavailable.
- For safety reports, Data Query is authoritative for exact counts, report dates, ordering, canonical risk, grade, stored item status, and approved typed defect-counter sums. Semantic safety retrieval may add descriptions or evidence but must not override those facts.
- A stored safety item status is not automatically a resolved/unresolved status. If Data Query reports safety_resolution_status_not_computable, state that the resolution qualifier is unavailable and never relabel a broader count as unresolved.
- Report risk and defect severity are different fields. If the exact count for a requested canonical report-risk tier is zero, do not present reports from another risk tier as matching reports and do not relabel severe or life-threatening defects as high-risk reports.
- Safety worker values are per-report snapshots. If Data Query reports safety_worker_aggregate_not_computable, do not sum or average them across reports.
- For alerts, Data Query is authoritative only for exact row counts, alert dates and ordering, stored alert type, opaque stored severity level 3, technical input type, stored item status, and stored relevance flag.
- Never translate alert severity level 3 into critical, high, medium, low, urgent, highest, or lowest. Never treat stored item status as open, closed, resolved, active, acknowledged, or escalated lifecycle truth.
- Exact alert records have no approved source-link resolver. Do not expose IDs, project IDs, input identifiers, stored URLs, or narrative fields from Data Query, and do not claim that Alert Agent narrative belongs to an exact latest/earliest alert unless an authorization-bound same-record match is independently proven.
- In a mixed alert request, preserve the exact Data Query count or record separately. Alert Agent or retrieval may provide only clearly labelled general semantic evidence; it must not change the exact count, replace the exact ordered record, or fill an unsupported severity/lifecycle/source qualifier.
- For emails, Data Query is authoritative only for the fixed project-related scope (\`project_related\` or \`multi_project\`), \`received_date\`, reviewed stored category, direction, attachment-existence flag, relevance status, and opaque stored item status.
- Never include \`no_clear_project\` rows in an ordinary email total. Never expose or infer sender/recipient names or addresses, subject/body content, mail/conversation/project IDs, attachment filenames, or links from Data Query.
- In a mixed email request, preserve the exact scoped count or metadata separately. Email retrieval may explain content, requests, approvals, or rejections, but it must not change the exact number or imply that \`received_date\` is the date of an event described in the message body.
- A relevance-ranked email result is not proof of the overall latest email. Unless an authorization-bound same-record match to the exact Data Query latest record is supplied, describe it only as the most recent matching email returned by semantic retrieval, explicitly state that it may not be the overall latest project email, and do not answer what "the exact latest email" requested as a verified fact.
- For exceptions, Data Query is authoritative for exact row counts, exception dates and ordering, stored urgency, opaque stored item status, and the coverage-qualified requested-amount subtotal.
- Never treat the stored exception item status as approval, rejection, open/closed, resolution, or completion truth. For an exception_count_approval_evidence request, state the exact submitted-row count first. Retrieved approval evidence may identify supported examples only; it is not an exhaustive approved count. Explicitly say that an exact approved count is unavailable from the stored lifecycle metadata.
- A requested-amount aggregate is only the subtotal of populated \`requested_amount_ex_vat\` values. Present the ILS subtotal before VAT first, then its calculated value including VAT at the fixed 18% rate, and only afterward state the populated-row coverage and missing-row count. Never call either figure the total value of all exceptions when rows are missing amounts.
- Conversation memory is only for understanding follow-up wording. Never repeat an earlier assistant answer when current retrieval/tool results contradict it or provide newer evidence.
- Never cite Knowledge Base excerpts as project sources unless they also appear in retrieval/tool results.

PROJECT GRAPH RULES:
- When graph_context or project_graph_findings is available, use it actively as project relationship evidence, not as optional decoration.
- Use graph relationships to find additional connected events, alerts, suppliers/vendors, people, documents, hashtags, statuses, dates, risks, quotes, and invoices around the retrieved records.
- If answer_mode is "ranked_entity_list", or the user asks who/what/which/which other entities are delayed, blocking, responsible, related, recurring, or connected, return a ranked list of all supported candidates. Do not answer with only one item unless only one supported candidate exists.
- Group findings by shared graph entities when useful: supplier/vendor, person, document, hashtag, status, risk, or date.
- Separate strong findings from weaker/possible findings when source support differs.
- If the graph suggests a connection but retrieval/tool records do not support a factual claim, label it as a relationship clue, not as proof.

SOURCE QUALITY AND CONFLICTS:
- If source_quality.overall is LOW or NO_SOURCES, clearly qualify the answer.
- If potential_conflicts is not empty, add a short "סתירות אפשריות" note and do not hide the conflict.
- Prefer higher sourceQuality.score sources when sources disagree.

INVESTIGATION MODE:
- If investigation_plan is supplied, include "**מה בדקתי:**" with the checks performed/suggested.
- Then answer with findings, uncertainty, and missing evidence.
- Do not invent root causes or responsibility without project evidence.

INLINE SOURCE CONTRACT:
- Put the relevant source link immediately after every factual bullet or finding, using Markdown exactly like: [למסמך לחץ כאן](https://...).
- Match each claim to the URL from the same retrieval record or tool result. Do not attach an unrelated URL merely because it appears in the general sources list.
- When one bullet is supported by multiple records, place the relevant links together at the end of that bullet.
- If a claim has no directly matching URL, omit the citation rather than borrowing an unrelated source or writing a placeholder.
- Do NOT create a separate "**מקורות:**" section or a consolidated list of links at the bottom.
- Do NOT print raw URLs.`;
}

function skippedKnowledgePlan(reason, caution = reason) {
  return {
    skipped: true,
    reason,
    agents: [],
    matches: [],
    domain_summary: "",
    relevant_terms: [],
    decision_criteria: [],
    rag_queries: [],
    recommended_tools: [],
    risks_or_cautions: [caution]
  };
}

function isEntityListQuestion(message = "") {
  const text = String(message || "").toLowerCase();
  return /(\bwho\b|\bwhat\b|\bwhich\b|\bmore\b|\bothers?\b|\blist\b|\brank\b|מי|מה|איזה|אילו|עוד|כן|כולם|רשימה|דירוג|התעכב|התעכבו|מעכב|מעכבים|חסם|חסמים|קשור|קשורים|אחראי|אחראים)/i.test(text);
}

function retrievalTopKForQuestion({ config, message, classification } = {}) {
  const base = Number(config?.retrieval?.rerankTopK || 10);
  if (isEntityListQuestion(message) || classification?.investigation) {
    return Math.min(Math.max(base, 18), 25);
  }
  return base;
}

function samplingSettings(config, agentKey) {
  const settings = config?.ai?.[agentKey] || {};
  return {
    topP: settings.topP ?? 1,
    frequencyPenalty: settings.frequencyPenalty ?? 0,
    presencePenalty: settings.presencePenalty ?? 0,
    seed: settings.seed ?? null
  };
}

function contextRecordsLimitForQuestion({ config, listIntent = false, classification = {} } = {}) {
  const base = Number(config?.rag?.contextRecordsLimit || 12);
  if (listIntent || classification?.investigation) return Math.min(Math.max(base, 20), 50);
  return base;
}

function graphContextLimitForQuestion({ config, listIntent = false } = {}) {
  const base = Number(config?.graph?.contextLimit || 12);
  if (listIntent && config?.graph?.expandedForListQuestions !== false) return Math.min(Math.max(base, 20), 50);
  return base;
}

function buildProjectGraphFindings(graphContext = [], { listIntent = false } = {}) {
  const rows = Array.isArray(graphContext) ? graphContext : [];
  const entityCounts = new Map();
  const relationCounts = new Map();
  const relationships = rows.slice(0, listIntent ? 20 : 12).map((item) => {
    const relation = item.relation || "related_to";
    const source = item.source || "";
    const target = item.target || "";
    const confidence = item.confidence ?? null;
    relationCounts.set(relation, (relationCounts.get(relation) || 0) + 1);
    for (const entity of [source, target].filter(Boolean)) {
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
    }
    return {
      relation,
      source,
      target,
      confidence,
      evidence: item.evidence || ""
    };
  });
  return {
    available: relationships.length > 0,
    instruction: relationships.length
      ? "Use these graph relationships to broaden the answer beyond the single strongest RAG record. For who/what/which/more questions, produce a ranked list of supported candidates."
      : "No graph relationships were returned.",
    relationship_count: relationships.length,
    top_entities: topCounts(entityCounts, listIntent ? 12 : 8),
    top_relations: topCounts(relationCounts, 8),
    relationships
  };
}

function topCounts(map, limit = 10) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

function buildInvestigationPlan({ message, classification, memorySummary }) {
  if (!classification.investigation) return null;
  const tools = buildToolOrder(classification, hintedTools(classification));
  const checks = [
    "בדיקת האינדקס עם נוסח השאלה המקורי",
    "בדיקת מקורות רשמיים מול מקורות שטח",
    "בדיקת סתירות אפשריות בין תוצאות",
    "הפרדה בין ממצא מבוסס לבין השערה"
  ];
  if (classification.urgency === "HIGH") checks.unshift("בדיקת בטיחות מוקדמת לפני שאר החיפושים");
  if (memorySummary?.active_topics?.length) checks.push(`שימוש בהקשר השיחה: ${memorySummary.active_topics.join(", ")}`);
  return {
    enabled: true,
    reason: classification.investigation_reason || "שאלה מורכבת הדורשת חקירה.",
    question: message,
    expected_checks: checks,
    recommended_tools: tools,
    answer_contract: [
      "להציג מה נבדק",
      "לציין ממצאים לפי מקור",
      "לציין סתירות או מידע חסר",
      "לא לקבוע סיבה או אחריות ללא מקור פרויקט"
    ]
  };
}

function enforceInvestigationMode(classification, message) {
  if (!classification || classification.type === "CHAT" || classification.investigation) return classification;
  if (!isInvestigationQuestion(message)) return classification;
  return {
    ...classification,
    investigation: true,
    investigation_reason: "זוהתה שאלה מורכבת לפי חוקי התזמור המקומיים."
  };
}

export function enforceProfessionalKnowledgeMode(classification, message, config = {}) {
  if (!classification) return classification;
  const local = heuristicClassification(message);
  const vocabularyMatch = findKnowledgeVocabularyMatch(message, config.knowledge?.triggerKeywords || []);
  const checkedClassification = {
    ...classification,
    knowledge_vocabulary_checked: true,
    knowledge_vocabulary_match: vocabularyMatch || classification.knowledge_vocabulary_match || null
  };
  if (local.type !== "RAG" || (!local.professional && !vocabularyMatch)) return checkedClassification;
  if (classification.professional && classification.type === "RAG") {
    return {
      ...checkedClassification,
      knowledge_tags: uniqueStrings([
        ...(classification.knowledge_tags || []),
        ...(vocabularyMatch ? ["אוצר_מילים"] : [])
      ])
    };
  }
  return {
    ...checkedClassification,
    type: "RAG",
    professional: true,
    professional_reason:
      classification.professional_reason ||
      local.professional_reason ||
      (vocabularyMatch ? `זוהתה מילת מפתח מאוצר המילים: ${vocabularyMatch}` : "") ||
      "זוהתה שאלה מקצועית לפי חוקי התזמור המקומיים.",
    knowledge_tags: uniqueStrings([
      ...(classification.knowledge_tags || []),
      ...(classification.hashtags || []),
      ...(local.knowledge_tags || []),
      ...(local.hashtags || []),
      ...(vocabularyMatch ? ["אוצר_מילים"] : [])
    ])
  };
}

function isInvestigationQuestion(message) {
  return /למה|מדוע|מה גרם|גורם|עיכוב|אחריות|אחראי|מי אחראי|השווא|פער|סתירה|בעיה חוזרת|שורש|root cause|why|cause|delay|responsible|compare|conflict/i.test(String(message || ""));
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function findKnowledgeVocabularyMatch(message, keywords) {
  const originalText = String(message || "");
  const text = normalizeVocabularyText(originalText);
  const textTokens = vocabularyTokens(text);
  return (keywords || [])
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .find((keyword) => vocabularyKeywordMatches(text, textTokens, keyword)) || "";
}

function vocabularyKeywordMatches(normalizedText, textTokens, keyword) {
  const normalizedKeyword = normalizeVocabularyText(keyword);
  if (!normalizedKeyword) return false;
  if (normalizedText.includes(normalizedKeyword)) return true;

  const keywordTokens = vocabularyTokens(normalizedKeyword);
  for (const keywordToken of keywordTokens) {
    const keywordStem = stemVocabularyToken(keywordToken);
    for (const textToken of textTokens) {
      const textStem = stemVocabularyToken(textToken);
      if (!keywordStem || !textStem) continue;
      if (keywordStem.length < 3 || textStem.length < 3) continue;
      if (
        textStem === keywordStem ||
        textStem.includes(keywordStem) ||
        keywordStem.includes(textStem)
      ) {
        return true;
      }
    }
  }
  return false;
}

function normalizeVocabularyText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vocabularyTokens(value) {
  return normalizeVocabularyText(value).split(/[\s_-]+/).filter(Boolean);
}

function stemVocabularyToken(token) {
  let value = String(token || "").trim();
  if (!value) return "";
  value = value.replace(/^(ו|ה|ב|כ|ל|מ|ש)(?=.{3,})/u, "");
  value = value
    .replace(/(יים|יהם|יהן|ות|ים|י|ה|ן|ם)$/u, "")
    .replace(/(ed|ing|ers|er|ies|s)$/iu, "");
  return value;
}

function normalizeKnowledgePlan(value, matches, agents = []) {
  return {
    skipped: false,
    agents,
    matches: matches.map((match) => ({
      agentId: match.agentId,
      agentName: match.agentName,
      filename: match.filename,
      chunkIndex: match.chunkIndex,
      score: match.score,
      text: match.text
    })),
    domain_summary: String(value?.domain_summary || ""),
    relevant_terms: normalizeArray(value?.relevant_terms),
    decision_criteria: normalizeArray(value?.decision_criteria),
    rag_queries: normalizeArray(value?.rag_queries),
    recommended_tools: normalizeArray(value?.recommended_tools),
    risks_or_cautions: normalizeArray(value?.risks_or_cautions)
  };
}

function fallbackKnowledgePlan({ message, classification, matches, agents = [] }) {
  const terms = [...new Set([...(classification.knowledge_tags || []), ...(classification.hashtags || [])])];
  return {
    skipped: false,
    agents,
    matches: matches.map((match) => ({
      agentId: match.agentId,
      agentName: match.agentName,
      filename: match.filename,
      chunkIndex: match.chunkIndex,
      score: match.score,
      text: match.text
    })),
    domain_summary: matches.slice(0, 2).map((match) => match.text).join("\n\n").slice(0, 1200),
    relevant_terms: terms,
    decision_criteria: [],
    rag_queries: [message],
    recommended_tools: hintedTools(classification),
    risks_or_cautions: ["תכנית הידע נוצרה ללא קריאת מודל, על בסיס התאמות טקסט מקומיות בלבד."]
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function plannedRagQueries(knowledgePlan, originalMessage, config = {}) {
  if (!knowledgePlan || knowledgePlan.skipped) return [];
  const limit = Number(config.rag?.plannerExtraQueriesLimit ?? 2);
  if (limit <= 0) return [];
  const original = String(originalMessage || "").trim();
  return normalizeArray(knowledgePlan.rag_queries)
    .map((query) => query.trim())
    .filter((query) => query && query !== original)
    .slice(0, limit);
}

function recommendedProjectTools(knowledgePlan) {
  if (!knowledgePlan || knowledgePlan.skipped) return [];
  return normalizeArray(knowledgePlan.recommended_tools)
    .map((tool) => tool.trim())
    .filter((tool) => TOOL_NAMES.includes(tool));
}

function uniqueRows(rows) {
  const seen = new Set();
  return normalizeRows(rows).filter((row) => {
    const key = rowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowKey(row) {
  return String(
    row?.id ||
    row?.attachment_id ||
    row?.metadata?.attachment_id ||
    row?.metadata?.source ||
    row?.url ||
    row?.content ||
    row?.text ||
    JSON.stringify(row)
  ).slice(0, 500);
}

// Deterministic safety net: despite the INLINE SOURCE CONTRACT / Citation
// Rules instructing the model to always wrap a citation as a Markdown link
// when a source_url is available, it sometimes still writes a bare bracket
// like "[מקור: emails, כותרת, 29.01.2025]" or "[ישיבה: ..., 21.01.2025]" with
// no "(url)" — which Markdown renders as plain, non-clickable text. Rather
// than rely purely on prompt compliance, find these bare brackets after
// generation and attach the matching URL from the retrieved sources by
// matching the record title that the model already copied into the bracket.
const BARE_CITATION_BRACKET = /\[(מקור|ישיבה)\s*:\s*([^\]]+)\](?!\()/g;

function linkifyCitations(text, sources = []) {
  const value = String(text || "");
  if (!value || !Array.isArray(sources) || !sources.length) return value;
  const candidates = sources
    .filter((source) => source?.url && (source.title || source.label))
    .map((source) => ({ url: source.url, normalizedTitle: normalizeForCitationMatch(source.title || source.label) }))
    .filter((source) => source.normalizedTitle);
  if (!candidates.length) return value;
  return value.replace(BARE_CITATION_BRACKET, (full, label, inner) => {
    const normalizedInner = normalizeForCitationMatch(inner);
    const match = candidates.find((source) => normalizedInner.includes(source.normalizedTitle));
    return match ? `[${label}: ${inner}](${match.url})` : full;
  });
}

function normalizeForCitationMatch(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Hebrew display labels for tool names, kept out of the fallback answer's
// technical vocabulary (per the "no technical details" requirement — the user
// should never see raw tool/RPC identifiers or error strings in chat).
const TOOL_DISPLAY_LABELS = {
  hybrid_search: "חיפוש במסמכי הפרויקט",
  hybrid_search_plan: "חיפוש משלים",
  reranker: "מיון תוצאות לפי רלוונטיות",
  graph_search: "קשרים בין נתוני הפרויקט",
  alert: "התראות פרויקט",
  data_query: "שאילתת נתונים",
  safety_report: "דוחות בטיחות",
  meetings: "ישיבות",
  emails: "מיילים",
  whatsapp_messages: "הודעות וואטסאפ",
  financial_transactions: "נתונים כספיים",
  consultants_reports: "דוחות יועצים",
  exceptions_report: "דוח חריגים",
  quality_control: "בקרת איכות",
  submittals: "מסמכים להגשה",
  meeting_evidence_search: "חיפוש ראיות מישיבות"
};

function toolDisplayLabel(toolName) {
  return TOOL_DISPLAY_LABELS[toolName] || "מקור נוסף";
}

export function appendEmailSemanticLatestBoundary(answer, { message = "" } = {}) {
  const text = String(message || "");
  const englishLatestContent = /\bemails?\b.{0,90}\b(?:latest|newest|most\s+recent)\b.{0,60}\b(?:request(?:ed|s)?|say|said|contain(?:ed|s)?|body|content|subject|mean)\b|\b(?:latest|newest|most\s+recent)\b.{0,60}\bemails?\b.{0,60}\b(?:request(?:ed|s)?|say|said|contain(?:ed|s)?|body|content|subject|mean)\b/iu;
  const hebrewLatestContent = /מייל(?:ים)?.{0,70}(?:האחרון|האחרונה|הכי\s+חדש).{0,60}(?:ביקש|נאמר|נכתב|הכיל|תוכן|נושא|כוונה)|(?:המייל\s+האחרון|המייל\s+האחרונה|המייל\s+הכי\s+חדש).{0,60}(?:ביקש|נאמר|נכתב|הכיל|תוכן|נושא|כוונה)/iu;
  if (!englishLatestContent.test(text) && !hebrewLatestContent.test(text)) return answer;
  const boundary = isHebrew(text)
    ? "> **גבול אימות:** המטא-דאטה המדויק של המיילים אינו חושף או מחבר את תוכן ההודעה, ולכן לא ניתן לאמת מה ביקש המייל האחרון בפרויקט כולו. התוכן שלהלן מגיע מהמייל התואם העדכני ביותר שהחזיר החיפוש הסמנטי, וייתכן שאינו המייל האחרון הכולל."
    : "> **Verification boundary:** The approved exact email metadata does not expose or join message-body content, so I cannot verify what the overall latest project email requested. The content below comes from the most recent matching email returned by semantic retrieval and may not be the overall latest email.";
  return `${boundary}\n\n${String(answer || "").trim()}`;
}

function dataQueryFallbackSection(call) {
  const machine = call?.data?.machineResult || {};
  const records = Object.values(machine.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const metrics = Object.values(machine.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const recordLines = records.slice(0, 5).map((record) => {
    const payload = record?.record && typeof record.record === "object" ? record.record : record;
    const preferredFields = [
      "transaction_date", "vendor_name", "status", "category",
      "transaction_type", "item_status", "currency", "data_date",
      "alert_type", "severity_level", "input_data_type", "is_relevant"
    ];
    const values = preferredFields
      .filter((field) => payload[field] !== null && payload[field] !== undefined && payload[field] !== "")
      .map((field) => `${field}: ${String(payload[field]).slice(0, 160)}`);
    return `  - ${values.join(" · ") || "רשומה מדויקת נמצאה"}`;
  });
  const metricLines = metrics.slice(0, 8).map((metric) =>
    `  - ${metric.label || "metric"}: ${metric.value} (${metric.exactness || "exact"})`
  );
  const lines = [...recordLines, ...metricLines];
  return lines.length
    ? `- **${toolDisplayLabel("data_query")}**:\n${lines.join("\n")}`
    : null;
}

export function buildExactInvoiceEnrichment(toolCalls = []) {
  return buildExactInvoiceEnrichments(toolCalls)[0] || null;
}

export function buildExactInvoiceEnrichments(toolCalls = []) {
  const exactRecords = exactInvoiceLookupRecords(toolCalls);
  if (!exactRecords.length) return [];
  const financialRows = [...toolCalls]
    .sort((left, right) => Number(Boolean(right?.exactRead)) - Number(Boolean(left?.exactRead)))
    .filter((call) =>
      call?.toolName === "financial_transactions" &&
      call.ok &&
      Array.isArray(call.data?.results)
    )
    .flatMap((call) => call.data.results);
  return exactRecords.flatMap((exactRecord) => {
    const exactId = exactRecord.id;
    const financialRow = financialRows.find((row) =>
      row?.id !== null &&
      row?.id !== undefined &&
      String(row.id) === String(exactId)
    );
    if (!financialRow) return [];
    const enrichment = {
      recordId: exactId,
      transactionDate: firstPresent(exactRecord.transaction_date, financialRow.transaction_date),
      vendorName: firstPresent(exactRecord.vendor_name, financialRow.vendor_name),
      status: firstPresent(exactRecord.status, financialRow.status, financialRow.item_status),
      transactionType: firstPresent(exactRecord.transaction_type, financialRow.transaction_type),
      category: firstPresent(financialRow.category),
      currency: firstPresent(exactRecord.currency, financialRow.currency),
      amount: invoiceAmountDisplay(financialRow),
      topic: firstPresent(financialRow.topic),
      summary: firstPresent(financialRow.summary),
      documentUrl: normalizeInvoiceDocumentUrl(financialRow.data_link) ||
        normalizeInvoiceDocumentUrl(financialRow.resolved_attachment_link),
      documentLabel: firstPresent(
        financialRow.resolved_attachment_filename,
        financialRow.document_filename,
        financialRow.topic,
        financialRow.vendor_name,
        "Invoice document"
      )
    };
    return Object.values(enrichment).some((value) => value !== null && value !== undefined && value !== "")
      ? [enrichment]
      : [];
  });
}

const EXACT_INVOICE_ATTACHMENT_OPERATIONS = new Set(["lookup_latest", "lookup_last_n"]);
const MAX_EXACT_INVOICE_ATTACHMENT_ROWS = 25;
const MAX_EXACT_FINANCIAL_TYPE_ATTACHMENT_ROWS = 200;
const EXACT_INVOICE_ATTACHMENT_CONCURRENCY = 4;

export async function resolveExactInvoiceAttachmentLinks({
  config,
  operation,
  financialRows = [],
  callerProjectId = null,
  allRequested = false
} = {}) {
  const rows = Array.isArray(financialRows) ? financialRows : [];
  const maxRows = allRequested
    ? MAX_EXACT_FINANCIAL_TYPE_ATTACHMENT_ROWS
    : MAX_EXACT_INVOICE_ATTACHMENT_ROWS;
  const stats = {
    requested: rows.length,
    uniqueLookups: 0,
    resolved: 0,
    unavailable: 0,
    failed: 0,
    scopeRejected: 0,
    bounded: rows.length <= maxRows
  };
  if (
    !EXACT_INVOICE_ATTACHMENT_OPERATIONS.has(operation) ||
    !rows.length ||
    !stats.bounded
  ) {
    return { rows, stats };
  }

  const references = new Map();
  rows.forEach((row, rowIndex) => {
    if (
      normalizeInvoiceDocumentUrl(row?.data_link) ||
      normalizeInvoiceDocumentUrl(row?.resolved_attachment_link) ||
      !row?.email_attachment_id
    ) {
      return;
    }
    const projectId = exactInvoiceAttachmentProjectId(callerProjectId, row.project_id);
    if (!projectId) {
      stats.scopeRejected += 1;
      return;
    }
    const attachmentId = String(row.email_attachment_id).trim();
    const key = JSON.stringify([projectId, attachmentId]);
    const existing = references.get(key);
    if (existing) {
      existing.rowIndexes.push(rowIndex);
      return;
    }
    references.set(key, {
      attachmentId,
      projectId,
      rowIndexes: [rowIndex]
    });
  });

  const uniqueReferences = [...references.values()];
  stats.uniqueLookups = uniqueReferences.length;
  const outcomes = await mapWithConcurrency(
    uniqueReferences,
    EXACT_INVOICE_ATTACHMENT_CONCURRENCY,
    async (reference) => {
      try {
        const attachment = await fetchEmailAttachmentByReference({
          config,
          attachmentId: reference.attachmentId,
          projectId: reference.projectId
        });
        const url = normalizeInvoiceDocumentUrl(attachment?.attachment_link);
        if (!attachment || !url) return { kind: "unavailable" };
        return {
          kind: "resolved",
          url,
          filename: firstPresent(
            attachment.original_file_name,
            attachment.current_filename
          )
        };
      } catch {
        return { kind: "failed" };
      }
    }
  );

  const resolvedRows = [...rows];
  outcomes.forEach((outcome, outcomeIndex) => {
    const reference = uniqueReferences[outcomeIndex];
    if (outcome.kind === "resolved") {
      for (const rowIndex of reference.rowIndexes) {
        resolvedRows[rowIndex] = {
          ...resolvedRows[rowIndex],
          resolved_attachment_link: outcome.url,
          resolved_attachment_filename: outcome.filename
        };
      }
      stats.resolved += reference.rowIndexes.length;
    } else if (outcome.kind === "failed") {
      stats.failed += reference.rowIndexes.length;
    } else {
      stats.unavailable += reference.rowIndexes.length;
    }
  });
  return { rows: resolvedRows, stats };
}

export function buildExactInvoiceDocumentSources(enrichments = []) {
  const seen = new Set();
  return (Array.isArray(enrichments) ? enrichments : []).flatMap((enrichment) => {
    const url = normalizeInvoiceDocumentUrl(enrichment?.documentUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      label: firstPresent(
        enrichment.documentLabel,
        enrichment.topic,
        enrichment.vendorName,
        "Invoice document"
      )
    }];
  });
}

const MAX_EXACT_SAFETY_ATTACHMENT_ROWS = 25;
const EXACT_SAFETY_ATTACHMENT_CONCURRENCY = 4;

export async function resolveExactSafetyAttachmentLinks({
  config,
  safetyRows = [],
  callerProjectId = null
} = {}) {
  const rows = Array.isArray(safetyRows) ? safetyRows : [];
  const stats = {
    requested: rows.length,
    uniqueLookups: 0,
    resolved: 0,
    unavailable: 0,
    failed: 0,
    scopeRejected: 0,
    bounded: rows.length <= MAX_EXACT_SAFETY_ATTACHMENT_ROWS
  };
  if (!rows.length || !stats.bounded) return { rows, stats };
  const authorizedProjectId = normalizeExactProjectId(callerProjectId);
  if (!authorizedProjectId) {
    stats.scopeRejected = rows.length;
    return { rows, stats };
  }

  const references = new Map();
  rows.forEach((row, rowIndex) => {
    const projectId = exactInvoiceAttachmentProjectId(authorizedProjectId, row?.project_id);
    const attachmentId = String(row?.attachment_id || "").trim();
    const mailId = String(row?.mail_id || "").trim();
    if (!projectId || !attachmentId || !mailId) {
      stats.scopeRejected += 1;
      return;
    }
    const key = JSON.stringify([projectId, attachmentId, mailId]);
    const existing = references.get(key);
    if (existing) {
      existing.rowIndexes.push(rowIndex);
      return;
    }
    references.set(key, {
      attachmentId,
      projectId,
      mailId,
      documentFilename: String(row?.document_filename || "").trim(),
      rowIndexes: [rowIndex]
    });
  });

  const uniqueReferences = [...references.values()];
  stats.uniqueLookups = uniqueReferences.length;
  const outcomes = await mapWithConcurrency(
    uniqueReferences,
    EXACT_SAFETY_ATTACHMENT_CONCURRENCY,
    async (reference) => {
      try {
        const attachment = await fetchSafetyAttachmentByReference({
          config,
          attachmentId: reference.attachmentId,
          projectId: reference.projectId,
          mailId: reference.mailId
        });
        const url = normalizeInvoiceDocumentUrl(attachment?.attachment_link);
        const attachmentNames = [
          attachment?.original_file_name,
          attachment?.current_filename
        ].map(normalizeSafetyFilename).filter(Boolean);
        const reportFilename = normalizeSafetyFilename(reference.documentFilename);
        if (
          !attachment ||
          !url ||
          !reportFilename ||
          !attachmentNames.includes(reportFilename)
        ) {
          return { kind: "unavailable" };
        }
        return {
          kind: "resolved",
          url,
          filename: firstPresent(
            attachment.original_file_name,
            attachment.current_filename,
            reference.documentFilename
          )
        };
      } catch {
        return { kind: "failed" };
      }
    }
  );

  const resolvedRows = [...rows];
  outcomes.forEach((outcome, outcomeIndex) => {
    const reference = uniqueReferences[outcomeIndex];
    if (outcome.kind === "resolved") {
      for (const rowIndex of reference.rowIndexes) {
        resolvedRows[rowIndex] = {
          ...resolvedRows[rowIndex],
          resolved_attachment_link: outcome.url,
          resolved_attachment_filename: outcome.filename
        };
      }
      stats.resolved += reference.rowIndexes.length;
    } else if (outcome.kind === "failed") {
      stats.failed += reference.rowIndexes.length;
    } else {
      stats.unavailable += reference.rowIndexes.length;
    }
  });
  return { rows: resolvedRows, stats };
}

function normalizeSafetyFilename(value) {
  return String(value || "").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

export function buildExactSafetyEnrichments(toolCalls = []) {
  const exactRecords = exactSafetyLookupRecords(toolCalls);
  if (!exactRecords.length) return [];
  const safetyRows = [...toolCalls]
    .sort((left, right) => Number(Boolean(right?.exactRead)) - Number(Boolean(left?.exactRead)))
    .filter((call) =>
      call?.toolName === "safety_report" &&
      call.ok &&
      Array.isArray(call.data?.results)
    )
    .flatMap((call) => call.data.results);
  return exactRecords.flatMap((exactRecord) => {
    const safetyRow = safetyRows.find((row) =>
      row?.id !== null &&
      row?.id !== undefined &&
      String(row.id) === String(exactRecord.id)
    );
    if (!safetyRow) return [];
    return [{
      recordId: exactRecord.id,
      reportDate: firstPresent(exactRecord.report_date, safetyRow.report_date),
      siteLocation: firstPresent(exactRecord.site_location, safetyRow.site_location),
      riskLevel: firstPresent(exactRecord.risk_level, safetyRow.risk_level),
      siteGrade: firstPresent(exactRecord.site_grade, safetyRow.site_grade),
      itemStatus: firstPresent(exactRecord.item_status, safetyRow.item_status),
      totalWorkers: firstPresent(exactRecord.total_workers, safetyRow.total_workers),
      lifeThreateningDefects: firstPresent(
        exactRecord.life_threatening_defects,
        safetyRow.life_threatening_defects
      ),
      severeDefects: firstPresent(exactRecord.severe_defects, safetyRow.severe_defects),
      mediumDefects: firstPresent(exactRecord.medium_defects, safetyRow.medium_defects),
      minorDefects: firstPresent(exactRecord.minor_defects, safetyRow.minor_defects),
      documentUrl: normalizeInvoiceDocumentUrl(safetyRow.resolved_attachment_link),
      documentLabel: firstPresent(
        safetyRow.resolved_attachment_filename,
        safetyRow.document_filename,
        "Safety report document"
      )
    }];
  });
}

export function buildExactSafetyDocumentSources(enrichments = []) {
  const seen = new Set();
  return (Array.isArray(enrichments) ? enrichments : []).flatMap((enrichment) => {
    const url = normalizeInvoiceDocumentUrl(enrichment?.documentUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      label: firstPresent(enrichment.documentLabel, "Safety report document")
    }];
  });
}

function exactSafetyLookupRecords(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    call.data?.routing?.domain === "content_structured_lookup" &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "safety_reports" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  if (!dataQueryCall) return [];
  const planIds = new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "safety_reports" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.id)
    .filter(Boolean));
  return Object.values(dataQueryCall.data?.machineResult?.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => !value?.planId || planIds.has(value.planId))
    .sort((left, right) => Number(left?.ordinal || 0) - Number(right?.ordinal || 0))
    .map((value) => value?.record && typeof value.record === "object" ? value.record : null)
    .filter((record) => record && record.id !== null && record.id !== undefined && record.id !== "");
}

function exactSafetyLookupProjectScope(toolCalls = [], config = {}) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "safety_reports" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  const callerProjectId = String(dataQueryCall?.data?.caller?.projectId || "").trim();
  const configuredProjectId = String(config?.projectId || "").trim();
  if (!callerProjectId && !configuredProjectId) return { ok: false, projectId: null };
  const normalizedCallerProjectId = normalizeExactProjectId(callerProjectId);
  const normalizedConfiguredProjectId = normalizeExactProjectId(configuredProjectId);
  if (
    !normalizedCallerProjectId ||
    (configuredProjectId && !normalizedConfiguredProjectId) ||
    (normalizedConfiguredProjectId && normalizedConfiguredProjectId !== normalizedCallerProjectId)
  ) {
    return { ok: false, projectId: null };
  }
  return { ok: true, projectId: normalizedCallerProjectId };
}

export function exactAlertLookupRecords(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "alerts" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  if (!dataQueryCall) return [];
  const planIds = new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "alerts" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.id)
    .filter(Boolean));
  return Object.values(dataQueryCall.data?.machineResult?.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => !value?.planId || planIds.has(value.planId))
    .sort((left, right) => Number(left?.ordinal || 0) - Number(right?.ordinal || 0))
    .map((value) => value?.record && typeof value.record === "object" ? value.record : null)
    .filter(Boolean);
}

export function exactEmailLookupRecords(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "emails" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  if (!dataQueryCall) return [];
  const planIds = new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "emails" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.id)
    .filter(Boolean));
  return Object.values(dataQueryCall.data?.machineResult?.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => !value?.planId || planIds.has(value.planId))
    .sort((left, right) => Number(left?.ordinal || 0) - Number(right?.ordinal || 0))
    .map((value) => value?.record && typeof value.record === "object" ? value.record : null)
    .filter(Boolean);
}

export function exactExceptionLookupRecords(toolCalls = []) {
  return (Array.isArray(toolCalls) ? toolCalls : [])
    .filter((call) => call?.toolName === "data_query" && call?.ok)
    .flatMap((call) => Object.values(call?.data?.machineResult?.recordsByRequestId || {}))
    .flatMap((records) => Array.isArray(records) ? records : [])
    .filter((item) => item?.source?.table === "exceptions_report")
    .map((item) => item?.record || {})
    .filter((record) =>
      record.id !== null && record.id !== undefined &&
      record.exception_date
    );
}

export function exactConsultantReportLookupRecords(toolCalls = []) {
  return (Array.isArray(toolCalls) ? toolCalls : [])
    .filter((call) => call?.toolName === "data_query" && call?.ok)
    .flatMap((call) => Object.values(call?.data?.machineResult?.recordsByRequestId || {}))
    .flatMap((records) => Array.isArray(records) ? records : [])
    .filter((item) => item?.source?.table === "consultants_reports")
    .map((item) => item?.record || {})
    .filter((record) => record.id !== null && record.id !== undefined && record.report_date && record.project_id && record.attachment_id);
}

export function exactMeetingLookupRecords(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "meetings" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  if (!dataQueryCall) return [];
  const planIds = new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "meetings" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.id)
    .filter(Boolean));
  return Object.values(dataQueryCall.data?.machineResult?.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => !value?.planId || planIds.has(value.planId))
    .sort((left, right) => Number(left?.ordinal || 0) - Number(right?.ordinal || 0))
    .map((value) => value?.record && typeof value.record === "object" ? value.record : null)
    .filter((record) =>
      record &&
      /^\d+$/.test(String(record.id || "")) &&
      Number(record.id) > 0 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(record.project_id || "")) &&
      String(record.attachment_id || "").trim().length > 0 &&
      record.meeting_date &&
      !Number.isNaN(Date.parse(String(record.meeting_date)))
    );
}

export function buildDeterministicMeetingAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = [],
  semanticFallbackAvailable = false
} = {}) {
  const hebrew = isHebrew(message);
  if (isDeterministicMeetingNotComputableCapability(routing)) {
    if (semanticFallbackAvailable && isMeetingSemanticFallbackCapability(routing)) return null;
    const answers = {
      meeting_attendance_not_computable: hebrew
        ? "לא ניתן לחשב משתתפים או משתתפים ייחודיים מהחוזה המדויק: נתוני הנוכחות הם תוכן אישי מוחרג ודורשים פרשנות סמנטית."
        : "Meeting attendee or unique-participant counts are not computable from the exact contract: attendance is excluded personal content that requires semantic interpretation.",
      meeting_decision_presence_not_computable: hebrew
        ? "לא ניתן לחשב כמה ישיבות כוללות החלטות: נוכחות החלטה דורשת פרשנות של תוכן החלטות מוחרג, ולא תנוחש משדה טקסט."
        : "The number of meetings containing decisions is not computable: decision presence requires interpretation of excluded decision text and is not inferred from text-field presence.",
      meeting_ingestion_time_not_computable: hebrew
        ? "זמן הקליטה created_at מוחרג ואינו יכול להחליף את meeting_date, שהוא זמן הישיבה העסקי המאושר."
        : "Meeting created_at and ingestion time are excluded and cannot replace meeting_date, the approved business timestamp.",
      meeting_scope_field_not_queryable: hebrew
        ? "מזהי ישיבה, פרויקט, קובץ ומייל הם שדות ביצוע פנימיים ואינם מסננים או ערכי תצוגה זמינים למשתמש."
        : "Meeting, project, attachment, mail, and file identifiers are internal execution fields, not user-queryable filters or display values.",
      meeting_unapproved_lookup_not_computable: hebrew
        ? "חיפוש הישיבה כולל מסנן שאינו חלק מאוצר המילים המאושר. המסנן לא הושמט ולא הוחזרה ישיבה לא מסוננת."
        : "The meeting lookup contains an unapproved qualifier. It was not silently dropped, so no unfiltered meeting was returned.",
      meeting_unapproved_metric_not_computable: hebrew
        ? "הבקשה אינה תואמת לדקדוק המאושר למדדי ישיבות ועלולה לכלול ישות או מסנן לא נתמכים. לא הוחזרה ספירה לא מסוננת."
        : "The request does not match the approved meeting-metric grammar. An unsupported entity or qualifier was not silently dropped, so no unfiltered count was returned.",
      meeting_date_scope_not_resolved: hebrew
        ? "הבקשה כללה תאריך, אך לא התקבל טווח מנורמל. מסנן התאריך לא הושמט ולא הוחזרה תוצאה לא מסוננת."
        : "The request included a date qualifier, but no normalized date scope was supplied. The qualifier was not dropped and no unfiltered result was returned.",
      invalid_lookup_limit: hebrew
        ? "מספר הישיבות המבוקש אינו נתמך. ניתן לבקש את הישיבה האחרונה או הראשונה, או 1 עד 25 ישיבות אחרונות."
        : "The requested meeting lookup size is unsupported. Request the latest or earliest meeting, or 1–25 latest meetings.",
      meeting_content_origin_not_approved: hebrew
        ? "שאילתת הישיבות המדויקת לא בוצעה משום שמקור ה-Content אינו תואם למקור המהימן של זהות Data Query."
        : "The exact meeting query was not executed because the request Content origin does not match the trusted managed Data Query origin.",
      structured_metrics_not_available: hebrew
        ? "מדדי הישיבות מזוהים, אך חוזה הקריאה המנוהל אינו פעיל. חיפוש סמנטי לא הוצג כתחליף למדד מדויק."
        : "The exact meeting metric is recognized, but the managed read contract is inactive. Semantic search was not substituted for an exact metric.",
      structured_lookup_not_available: hebrew
        ? "חיפוש הישיבה המדויק מזוהה, אך חוזה הקריאה המנוהל אינו פעיל. תוצאה סמנטית לא הוצגה כרשומה מדויקת."
        : "The exact meeting lookup is recognized, but the managed read contract is inactive. A semantic result was not presented as an exact record."
    };
    return appendConflictWarnings(answers[routing.warning] || routing.reason, conflicts, { hebrew });
  }
  if (!isDeterministicMeetingCapability(routing) && !isDeterministicMeetingMixedCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
  if (!dataQueryCall?.ok || !["ok", "partial"].includes(dataQueryCall?.data?.status || "ok")) {
    if (semanticFallbackAvailable && isMeetingSemanticFallbackCapability(routing)) return null;
    const unresolvedDate = dataQueryCall?.data?.routing?.warning === "meeting_date_scope_not_resolved";
    const answer = unresolvedDate
      ? hebrew
        ? "הבקשה כללה תאריך, אך לא התקבל טווח מנורמל. המסנן לא הושמט ולא הוחזרה תוצאה לא מסוננת."
        : "The request included a date qualifier, but no normalized date scope was supplied. The qualifier was not dropped and no unfiltered result was returned."
      : hebrew
        ? "שאילתת הישיבות המדויקת לא הושלמה, ולכן לא הוחזרה תשובה משוערת או תוצאה סמנטית חלופית."
        : "The exact meeting query did not complete, so no estimated answer or semantic substitute was returned.";
    return appendConflictWarnings(answer, conflicts, { hebrew });
  }
  const exactRecords = routing.intent === "lookup" ? exactMeetingLookupRecords(toolCalls) : [];
  if (routing.intent === "lookup" && !exactRecords.length && semanticFallbackAvailable) return null;
  let answer = routing.intent === "lookup"
    ? formatDeterministicMeetingLookup({
        operation: routing.lookup?.operation,
        records: exactRecords,
        hebrew
      })
    : formatDeterministicMeetingMetrics({
        data: dataQueryCall.data,
        hebrew
      });
  if (!answer) return null;
  if (isDeterministicMeetingMixedCapability(routing)) {
    if (hasVerifiedSameMeetingEvidence(toolCalls)) return null;
    answer += formatSameMeetingEvidenceBoundary({ toolCalls, hebrew });
  }
  return appendConflictWarnings(answer, conflicts, { hebrew });
}

function formatDeterministicMeetingLookup({ operation, records = [], hebrew = false }) {
  if (!records.length) {
    return hebrew
      ? "לא נמצאו ישיבות מתוארכות התואמות לבקשה. תאריכי קליטה לא שימשו כתחליף."
      : "No dated meetings matched the request. Ingestion dates were not used as a substitute.";
  }
  const blocks = records.map((record, index) => {
    const fields = [
      `- **${hebrew ? "תאריך הישיבה" : "Meeting date"}:** ${escapeInvoiceDisplayValue(formatInvoiceDate(record.meeting_date))}`,
      `- **${hebrew ? "סטטוס שמור" : "Stored status"}:** ${escapeInvoiceDisplayValue(String(record.status || (hebrew ? "לא צוין" : "Not provided")))}`,
      `- **${hebrew ? "קישור מקור" : "Source link"}:** ${hebrew ? "לא קיים קישור מקור מאומת בחוזה המדויק" : "No verified source link is available under the exact contract"}`
    ];
    if (records.length === 1) return fields.join("\n");
    return `### ${index + 1}. ${hebrew ? "ישיבה" : "Meeting"}\n\n${fields.join("\n")}`;
  });
  const heading = records.length === 1
    ? operation === "lookup_earliest"
      ? (hebrew ? "הישיבה המתוארכת הראשונה" : "Earliest dated meeting")
      : (hebrew ? "הישיבה המתוארכת האחרונה" : "Latest dated meeting")
    : (hebrew
        ? `${records.length} הישיבות המתוארכות האחרונות, בסדר כרונולוגי יורד:`
        : `The ${records.length} latest dated meetings, in descending chronological order:`);
  return records.length === 1
    ? `## ${heading}\n\n${blocks[0]}`
    : `${heading}\n\n${blocks.join("\n\n")}`;
}

function formatDeterministicMeetingMetrics({ data = {}, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : []).find((item) => item?.table === "meetings");
  if (!plan) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  const statuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  if (plan.truncated === true || plan.sampled === true || statuses.some((item) => item.truncated || item.sampled)) {
    return hebrew
      ? `לא ניתן להציג תוצאת ישיבות מדויקת${scope}: המקור סימן את התוצאה כחלקית או מדגמית.`
      : `An exact meeting result cannot be presented${scope}: the source marked it as truncated or sampled.`;
  }
  if (plan.operation === "count") {
    const metric = metrics.find((item) => item.operation === "count");
    const count = metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value);
    if (!Number.isFinite(count)) return null;
    return hebrew
      ? `Data Query מצא **${formatInvoiceNumber(count)} ישיבות תואמות**${scope}.`
      : `Data Query found **${formatInvoiceNumber(count)} matching meetings**${scope}.`;
  }
  if (plan.operation === "distinct") {
    const metric = metrics.find((item) => item.operation === "distinct");
    const count = metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value);
    if (!Number.isFinite(count)) return null;
    return hebrew
      ? `Data Query מצא **${formatInvoiceNumber(count)} ערכי סטטוס שמורים ייחודיים** לישיבות${scope}.`
      : `Data Query found **${formatInvoiceNumber(count)} distinct stored meeting-status values**${scope}.`;
  }
  if (!["group_count", "timeseries"].includes(plan.operation)) return null;
  const groups = metrics
    .map((metric) => ({
      label: firstPresent(...Object.values(metric.group || {})),
      value: metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value)
    }))
    .filter((item) => item.label !== null && item.label !== undefined && Number.isFinite(item.value))
    .sort((left, right) => plan.operation === "timeseries"
      ? String(left.label).localeCompare(String(right.label))
      : right.value - left.value || String(left.label).localeCompare(String(right.label)));
  if (!groups.length) return hebrew ? `לא נמצאו ישיבות${scope}.` : `No meetings were found${scope}.`;
  const total = groups.reduce((sum, item) => sum + item.value, 0);
  const label = plan.operation === "timeseries"
    ? (hebrew
        ? `${plan.granularity === "month" ? "חודש" : "יום"} קלנדרי לפי UTC`
        : `UTC calendar ${plan.granularity === "month" ? "month" : "day"}`)
    : (hebrew ? "סטטוס שמור" : "stored status");
  const heading = hebrew
    ? `Data Query מצא **${formatInvoiceNumber(total)} ישיבות**${scope}. פילוח לפי ${label}:`
    : `Data Query found **${formatInvoiceNumber(total)} meetings**${scope}. Breakdown by ${label}:`;
  return `${heading}\n\n${groups.map((item) =>
    `- **${escapeInvoiceDisplayValue(String(item.label))}:** ${formatInvoiceNumber(item.value)}`
  ).join("\n")}`;
}

function formatSameMeetingEvidenceBoundary({ toolCalls = [], hebrew = false }) {
  const evidenceCall = toolCalls.find((call) => call?.toolName === "meeting_evidence_search");
  const evidence = Array.isArray(evidenceCall?.data?.evidence) ? evidenceCall.data.evidence : [];
  if (
    evidenceCall?.ok &&
    evidenceCall.data?.status === "found" &&
    evidenceCall.data?.same_meeting_match === true &&
    evidence.length
  ) {
    const snippets = evidence.slice(0, 3).map((item) => {
      const quote = String(item?.quote || "").trim().slice(0, 900);
      const date = item?.meeting_date ? formatInvoiceDate(item.meeting_date) : "";
      const citation = hebrew
        ? `[רשומת ישיבה${date ? `, ${date}` : ""}]`
        : `[Meeting record${date ? `, ${date}` : ""}]`;
      return `> ${quote.replace(/\n+/g, "\n> ")}\n>\n> ${citation}`;
    }).filter((value) => !/^>\s*\n/u.test(value));
    if (snippets.length) {
      return hebrew
        ? `\n\n## ראיות מאותה ישיבה\n\n${snippets.join("\n\n")}\n\n> הראיות הוחזרו רק לאחר התאמה לאותה זהות ישיבה ופרויקט. אין קישור מקור מאומת להצגה.`
        : `\n\n## Evidence from that same meeting\n\n${snippets.join("\n\n")}\n\n> Evidence was returned only after matching the same meeting and project identity. No verified source link is available for display.`;
    }
  }
  return hebrew
    ? "\n\n> **גבול ראיות:** לא נמצאו ראיות מאומתות שניתנות לשיוך לאותה ישיבה בדיוק. פרטי הישיבה המדויקים נשמרו, אך לא הוצגה החלטה משוערת או ראיה מישיבה אחרת."
    : "\n\n> **Evidence boundary:** No verified evidence could be tied to that exact meeting. The exact meeting metadata is preserved, but no estimated decision or evidence from another meeting was shown.";
}

function hasVerifiedSameMeetingEvidence(toolCalls = []) {
  const evidenceCall = toolCalls.find((call) => call?.toolName === "meeting_evidence_search");
  return Boolean(
    evidenceCall?.ok &&
    evidenceCall.data?.status === "found" &&
    evidenceCall.data?.same_meeting_match === true &&
    Array.isArray(evidenceCall.data?.evidence) &&
    evidenceCall.data.evidence.some((item) => String(item?.quote || "").trim())
  );
}

export function hasVerifiedMeetingEvidence(toolCalls = []) {
  const evidenceCall = toolCalls.find((call) => call?.toolName === "meeting_evidence_search");
  return Boolean(
    evidenceCall?.ok &&
    !summarizeMeetingEvidenceErrorForWorkflow(evidenceCall) &&
    evidenceCall.data?.status === "found" &&
    evidenceCall.data?.insufficient_evidence !== true &&
    Array.isArray(evidenceCall.data?.evidence) &&
    evidenceCall.data.evidence.some((item) => String(item?.quote || "").trim())
  );
}

export function buildDeterministicDateScopedMeetingDecisionAnswer({
  message = "",
  toolCalls = []
} = {}) {
  const evidenceCall = toolCalls.find((call) => call?.toolName === "meeting_evidence_search");
  const data = evidenceCall?.data;
  if (
    !evidenceCall?.ok ||
    data?.status !== "found" ||
    data?.evidence_scope !== "meeting_date_decisions" ||
    data?.date_scope_verified !== true ||
    data?.exact_identity_verified !== true ||
    data?.insufficient_evidence === true
  ) return null;
  const evidence = (Array.isArray(data.evidence) ? data.evidence : [])
    .filter((item) => String(item?.decision || item?.quote || "").trim())
    .slice(0, 25);
  if (!evidence.length || Number(data.record_count) !== evidence.length) return null;

  const hebrew = isHebrew(message);
  const date = escapeInvoiceDisplayValue(
    formatInvoiceDate(data.meeting_date || evidence[0]?.meeting_date) ||
    (hebrew ? "תאריך לא זמין" : "Date unavailable")
  );
  const isExplicit = (item) => item?.decision_explicit === true || (
    item?.decision_explicit !== false &&
    !/^(?:לא\s+צוי(?:ן|נה)|לא\s+נמסר|אין|none|not\s+(?:specified|provided|stated)|n\/?a)$/iu.test(
      String(item?.decision || "").trim()
    )
  );
  const explicitDecisions = evidence.filter(isExplicit);
  const undocumentedItems = evidence.filter((item) => !isExplicit(item));
  if (
    Number.isFinite(Number(data.explicit_decision_count)) &&
    Number(data.explicit_decision_count) !== explicitDecisions.length
  ) return null;
  const formatItem = (item, index) => {
    const subject = escapeInvoiceDisplayValue(String(item?.subject || "").trim());
    const decision = escapeInvoiceDisplayValue(String(item?.decision || item?.quote || "").trim());
    const label = subject
      ? `**${subject}:** ${decision}`
      : decision;
    return `${index + 1}. ${label}`;
  };
  const heading = hebrew
    ? `בישיבה המתוארכת ${date} נמצאו ${evidence.length} סעיפים. ${explicitDecisions.length === 1 ? "החלטה מפורשת תועדה בסעיף אחד" : `${explicitDecisions.length} החלטות מפורשות תועדו`}; ב-${undocumentedItems.length} סעיפים לא תועדה החלטה מפורשת.`
    : `${evidence.length} agenda records were found for ${date}. ${explicitDecisions.length} contain an explicit recorded decision; ${undocumentedItems.length} do not.`;
  const sections = [];
  if (explicitDecisions.length) {
    sections.push(
      `${hebrew ? "## החלטות מפורשות" : "## Explicit decisions"}\n\n${explicitDecisions.map(formatItem).join("\n")}`
    );
  }
  if (undocumentedItems.length) {
    const items = undocumentedItems.map((item, index) => {
      const subject = escapeInvoiceDisplayValue(String(item?.subject || "").trim());
      const fallback = hebrew ? "נושא ללא כותרת" : "Untitled agenda item";
      return `${index + 1}. ${subject || fallback}`;
    });
    sections.push(
      `${hebrew ? "## סעיפים ללא החלטה מפורשת" : "## Items without an explicit decision"}\n\n${items.join("\n")}`
    );
  }
  const boundary = hebrew
    ? "> כל הפריטים נקראו מרשומות הישיבות של הפרויקט בתאריך המדויק. לא נעשה שימוש בהתאמת דמיון או בישיבה מתאריך אחר."
    : "> Every item was read from the project-scoped meeting records for the exact date. No similarity match or differently dated meeting was substituted.";
  return `${heading}\n\n${sections.join("\n\n")}\n\n${boundary}`;
}

export function buildDeterministicMeetingEvidenceUnavailableAnswer({
  message = "",
  routing = null,
  toolCalls = []
} = {}) {
  if (!isPureMeetingEvidenceCapability(routing) || hasVerifiedMeetingEvidence(toolCalls)) return null;
  return isHebrew(message)
    ? "לא נמצאו ראיות מאומתות מישיבות לשאלה הזו. לא השתמשתי בחיפוש כללי, בסוכן אחר או בתחליף לא מאומת."
    : "No verified meeting evidence was available for this question. Generic search, another agent, and unverified substitutes were not used.";
}

export function buildDeterministicMeetingFallbackEvidenceAnswer({
  message = "",
  routing = null,
  toolCalls = []
} = {}) {
  if (
    routing?.warning !== "meeting_unapproved_lookup_not_computable" ||
    !hasVerifiedMeetingEvidence(toolCalls)
  ) return null;
  const evidenceCall = toolCalls.find((call) => call?.toolName === "meeting_evidence_search");
  const evidence = (Array.isArray(evidenceCall?.data?.evidence) ? evidenceCall.data.evidence : [])
    .filter((item) => String(item?.quote || "").trim())
    .slice(0, 3);
  if (!evidence.length) return null;
  const hebrew = isHebrew(message);
  const heading = hebrew
    ? "לא ניתן לאמת מהי הישיבה האחרונה לפי המסנן הזה באמצעות המטא-דאטה המדויק. נמצאו הראיות הסמנטיות המאומתות והרלוונטיות הבאות:"
    : "The exact metadata cannot verify which meeting is latest under this qualifier. The following verified, relevant semantic evidence was found:";
  const items = evidence.map((item) => {
    const date = escapeInvoiceDisplayValue(formatInvoiceDate(item?.meeting_date) || (hebrew ? "תאריך לא זמין" : "Date unavailable"));
    const quote = escapeInvoiceDisplayValue(item?.quote);
    return `- **${date}:** “${quote}”`;
  });
  const boundary = hebrew
    ? "> הראיות מסודרות לפי רלוונטיות סמנטית ואינן מוצגות כהוכחה לכך שזו הישיבה האחרונה כרונולוגית בנושא."
    : "> Evidence is ordered by semantic relevance and is not presented as proof that it is chronologically the latest meeting on the topic.";
  return `${heading}\n\n${items.join("\n")}\n\n${boundary}`;
}

function prefixExactMeetingAnchor({ answer = "", records = [], hebrew = false } = {}) {
  const exact = formatDeterministicMeetingLookup({
    operation: "lookup_latest",
    records: Array.isArray(records) ? records.slice(0, 1) : [],
    hebrew
  });
  if (!exact) return answer;
  const boundary = hebrew
    ? "> פרטי התאריך והסטטוס לעיל מגיעים מ-Data Query והם העוגן המדויק. הסיכום להלן משתמש רק בראיות שאומתו לאותה ישיבה."
    : "> The date and stored status above come from Data Query and are the exact anchor. The synthesis below uses only evidence verified for that same meeting.";
  return `${exact}\n\n${boundary}\n\n${String(answer || "").trim()}`.trim();
}

export function prefixExactExceptionApprovalAnchor({
  answer = "",
  routing = null,
  toolCalls = [],
  hebrew = false
} = {}) {
  if (!isExceptionCountApprovalMixedCapability(routing)) return answer;
  const dataQueryCall = (Array.isArray(toolCalls) ? toolCalls : [])
    .find((call) => call?.toolName === "data_query" && call?.ok);
  if (!dataQueryCall?.data) return answer;
  const count = Number(Object.values(dataQueryCall.data.machineResult?.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .find((metric) => metric?.operation === "count")?.value);
  if (!Number.isFinite(count)) return answer;
  const exact = hebrew
    ? `**סה״כ הוגשו ${formatInvoiceNumber(count)} חריגים.**`
    : `**A total of ${formatInvoiceNumber(count)} exceptions were submitted.**`;
  const boundary = hebrew
    ? "לא ניתן לקבוע מהמידע הזמין כמה מהם אושרו. הרשימה להלן כוללת רק מקרים שבהם נמצא במסמכי הפרויקט תיעוד מפורש של אישור לחריג."
    : "The available project information does not provide a complete count of how many were approved. The list below includes only cases where project documents explicitly record approval of an exception.";
  return `${exact}\n\n${boundary}${String(answer || "").trim() ? `\n\n${String(answer).trim()}` : ""}`;
}

export function buildDeterministicAlertAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  const hebrew = isHebrew(message);
  const mixedGuardAnswer = buildDeterministicAlertMixedGuardAnswer({
    message,
    routing,
    toolCalls,
    conflicts
  });
  if (mixedGuardAnswer) return mixedGuardAnswer;
  if (isDeterministicAlertNotComputableCapability(routing)) {
    const answers = {
      alert_semantic_severity_not_computable: hebrew
        ? "לא ניתן לחשב התראות קריטיות, גבוהות, בינוניות, נמוכות או דחופות: המקור המאושר מכיל רק רמת חומרה שמורה ואטומה 3, ללא מיפוי עסקי מאומת."
        : "Critical, high, medium, low, urgent, severe, major, minor, moderate, highest, or lowest alert severity is not computable: the approved source contains only opaque stored severity level 3, with no verified business mapping.",
      alert_lifecycle_status_not_computable: hebrew
        ? "לא ניתן לחשב התראות פתוחות, סגורות, פתורות, פעילות, מאושרות או מוסלמות: השדות המאושרים אינם מגדירים סטטוס מחזור חיים אמין להתראה."
        : "Open, closed, resolved, active, pending, completed, new, in-progress, cancelled, acknowledged, or escalated alert counts are not computable because the approved fields do not define a trustworthy alert lifecycle status.",
      alert_unique_sources_not_computable: hebrew
        ? "לא ניתן לחשב מספר מקורות, אירועים, הודעות, מסמכים או קבצים ייחודיים מהתראות: למזהי המקור השמורים אין חוזה זהות וקשר מאושר."
        : "Unique source, incident, message, document, or attachment counts are not computable because stored alert source identifiers have no approved identity and relationship contract.",
      alert_distinct_values_not_computable: hebrew
        ? "מספר הערכים הייחודיים בשדות ההתראות אינו פעולה מאושרת. ניתן לבקש פילוח מלא לפי שדה מאושר ולראות את כל הקטגוריות השמורות."
        : "Distinct alert-vocabulary cardinality is outside the approved operation contract. Request a full breakdown by an approved field to see all stored categories.",
      alert_time_granularity_not_computable: hebrew
        ? "סדרת זמן להתראות מאושרת רק לפי יום קלנדרי או חודש קלנדרי. רמת הזמן המבוקשת אינה חלק מהחוזה המדויק."
        : "Alert time series are approved only by calendar day or calendar month; the requested time granularity is outside the exact contract.",
      alert_numeric_aggregate_not_computable: hebrew
        ? "ממוצעים, סכומים, מינימום, מקסימום, דירוגים וניתוח top-N להתראות אינם חלק מהחוזה המדויק המאושר."
        : "Alert averages, sums, minima, maxima, rankings, and top-N analytics are outside the approved exact contract.",
      alert_source_links_not_computable: hebrew
        ? "אין קישורי מקור מאומתים בחוזה ההתראות המדויק, משום שלא קיים פותר קישורים תחום-הרשאה שמאמת את הקשר לרשומת המקור."
        : "Verified source links are unavailable from the exact alert contract because no authorization-bound resolver verifies the source-record relationship.",
      alert_grouped_lookup_not_computable: hebrew
        ? "לא ניתן לבחור את ההתראה האחרונה או הראשונה לכל קבוצה בחוזה החיפוש התחום הנוכחי. יש לבקש חיפוש מתוארך יחיד או פילוח ספירות נפרד."
        : "Latest or earliest alert per group is outside the approved bounded lookup contract. Request one dated lookup or a separate count breakdown.",
      alert_unapproved_lookup_not_computable: hebrew
        ? "חיפוש ההתראה כולל מסנן שאינו חלק מאוצר המילים המאושר. לא הוחזרה התראה לא מסוננת."
        : "The alert lookup contains an unapproved qualifier. It was not silently dropped, so no unfiltered alert record was returned.",
      alert_multidimensional_timeseries_not_computable: hebrew
        ? "סדרת זמן להתראות יכולה להשתמש בממד זמן יחיד בלבד: יום או חודש. פיצול נוסף לפי שדה אחר אינו חלק מהחוזה המדויק."
        : "Alert time series may use one UTC calendar dimension only—day or month. Splitting by another field is outside the exact contract.",
      alert_ingestion_time_not_computable: hebrew
        ? "זמן הקליטה created_at אינו זמן ההתראה העסקי ואינו יכול להחליף את data_date. יש לבקש טווח לפי תאריך ההתראה."
        : "Alert created_at and ingestion time are excluded and cannot replace the canonical data_date business time. Request a range over the alert date instead.",
      alert_ambiguous_qualifier_requires_clarification: hebrew
        ? "המונח המבוקש דו-משמעי. יש לציין במפורש סוג התראה 'אירוע בטיחות' או מקור טכני 'קובץ דוח בטיחות'."
        : "The alert qualifier is ambiguous. Specify either the safety-event alert type or the safety-report attachment input type.",
      alert_scope_field_not_queryable: hebrew
        ? "מזהי התראה ופרויקט הם שדות ביצוע פנימיים ואינם מסננים או ערכי תצוגה זמינים למשתמש."
        : "Alert and project identifiers are internal execution fields and are not user-queryable filters or display values.",
      alert_dated_filter_not_computable: hebrew
        ? "ספירה כללית לפי 'יש תאריך' אינה מסנן מאושר. ניתן לבקש טווח תאריכים מפורש או ספירת התראות ללא תאריך."
        : "A generic dated-alert count is not an approved direct filter. Request an explicit date range or an undated completeness count.",
      alert_undated_temporal_conflict_not_computable: hebrew
        ? "לא ניתן לשייך התראה ללא data_date לתקופה באותו שדה. אי אפשר לשלב מסנן תאריך חסר עם טווח תאריכים או סדרת זמן."
        : "Undated alerts cannot be assigned to a data_date period. A null-date filter cannot be combined with a date scope or time series.",
      alert_excluded_status_not_computable: hebrew
        ? "שדה הסטטוס המוחרג ריק במקור שנבדק, ולכן לא ניתן לחשב ממנו נוכחות או מצב מחזור חיים."
        : "The excluded alert status field is empty in the audited source, so status presence and lifecycle metrics are not computable.",
      alert_unapproved_metric_not_computable: hebrew
        ? "הבקשה אינה תואמת לדקדוק החיובי המאושר לספירת שורות התראה ועלולה לכלול ישות או מסנן שאינם נתמכים. לא הוחזרה ספירה לא מסוננת."
        : "The request does not match the approved positive grammar for counting alert rows. An unsupported entity or qualifier was not silently dropped, so no unfiltered count was returned.",
      invalid_lookup_limit: hebrew
        ? "מספר רשומות ההתראה המבוקש אינו נתמך. ניתן לבקש את הרשומה האחרונה או הראשונה, או 1 עד 25 התראות אחרונות."
        : "The requested alert lookup size is unsupported. Request the latest or earliest record, or 1–25 latest alerts.",
      alert_content_origin_not_approved: hebrew
        ? "שאילתת ההתראות המדויקת לא בוצעה: מקור ה-Content של הבקשה אינו תואם למקור המהימן של זהות Data Query המנוהלת. לא נשלחו פרטי גישה למקור החלופי."
        : "The exact alert query was not executed because the request Content origin does not match the trusted origin of the managed Data Query identity. No managed credentials were sent to the alternate origin.",
      structured_metrics_not_available: hebrew
        ? "מדדי ההתראות המדויקים מזוהים, אך חוזה הקריאה המנוהל אינו פעיל משום שלא הוגדרו פרטי גישה ייעודיים ל-Data Query. לא הוחלפה התוצאה בחיפוש סמנטי."
        : "The exact alert metric is recognized, but the managed read contract is inactive because dedicated Data Query credentials are not configured. Semantic search was not substituted.",
      structured_lookup_not_available: hebrew
        ? "בקשת רשומת ההתראה המדויקת מזוהה, אך חוזה הקריאה המנוהל אינו פעיל משום שלא הוגדרו פרטי גישה ייעודיים ל-Data Query. לא הוחלפה הרשומה בתוצאת חיפוש סמנטית."
        : "The exact alert lookup is recognized, but the managed read contract is inactive because dedicated Data Query credentials are not configured. A semantic search result was not substituted."
    };
    return appendConflictWarnings(answers[routing.warning] || routing.reason, conflicts, { hebrew });
  }
  if (isDeterministicAlertCapability(routing) || isDeterministicAlertMixedCapability(routing)) {
    const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
    if (!dataQueryCall?.ok || !["ok", "partial"].includes(dataQueryCall?.data?.status || "ok")) {
      const callWarning = dataQueryCall?.data?.routing?.warning;
      const unresolvedDate = callWarning === "alert_date_scope_not_resolved";
      const undatedConflict = callWarning === "alert_undated_temporal_conflict_not_computable";
      const answer = undatedConflict
        ? hebrew
          ? "לא ניתן לשלב התראות ללא data_date עם טווח תאריכים או סדרת זמן. לא הוחזרה תוצאה מבנית מטעה."
          : "Undated alerts cannot be combined with a data_date range or time series. No structurally misleading result was returned."
        : unresolvedDate
        ? hebrew
          ? "הבקשה כללה תאריך, אך לא התקבל טווח תאריכים מנורמל מהמסווג. המסנן לא הושמט ולא הוחזרה ספירה לא מסוננת; יש לציין טווח מפורש ולנסות שוב."
          : "The request included a date qualifier, but no normalized date scope was supplied. The qualifier was not dropped and no unfiltered count was returned; specify an explicit range and try again."
        : hebrew
          ? "שאילתת ההתראות המדויקת לא הושלמה, ולכן לא ניתן להציג תוצאה מאומתת. לא הוחלפה התוצאה בחיפוש סמנטי או בתשובה משוערת; ניתן לנסות שוב."
          : "The exact alert query did not complete, so no verified result can be presented. Semantic search or an estimated answer was not substituted; please try again.";
      return appendConflictWarnings(answer, conflicts, { hebrew });
    }
  }
  if (!isDeterministicAlertCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  if (!dataQueryCall?.data) return null;
  const answer = routing.intent === "lookup"
    ? formatDeterministicAlertLookup({
        operation: routing.lookup?.operation,
        records: exactAlertLookupRecords(toolCalls),
        hebrew
      })
    : formatDeterministicAlertMetrics({
        data: dataQueryCall.data,
        metricScope: routing.metricScope,
        hebrew
      });
  return answer ? appendConflictWarnings(answer, conflicts, { hebrew }) : null;
}

export function buildDeterministicAlertMixedGuardAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  if (
    routing?.mixed !== true ||
    (routing.lookup?.targetTable !== "alerts" && routing.metricScope?.targetTable !== "alerts")
  ) {
    return null;
  }
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  if (!dataQueryCall?.data) return null;
  const hebrew = isHebrew(message);
  if (routing.intent === "lookup" && exactAlertLookupRecords(toolCalls).length === 0) {
    const answer = hebrew
      ? "Data Query לא מצא התראה מתוארכת התואמת לבקשה. לכן אין רשומת התראה מדויקת שניתן להתאים לה תיאור או ראיה; לא נעשה שימוש בתוצאות סמנטיות לא תואמות."
      : "Data Query found no dated alert matching the request. There is therefore no exact alert record to match with a description or evidence; unrelated semantic results were not substituted.";
    return appendConflictWarnings(answer, conflicts, { hebrew });
  }
  if (routing.intent === "metrics") {
    const countMetric = Object.values(dataQueryCall.data.machineResult?.metricsByRequestId || {})
      .flatMap((value) => Array.isArray(value) ? value : [])
      .find((metric) => metric?.operation === "count" && metric?.exactness === "exact");
    if (Number(countMetric?.value) === 0) {
      let answer = hebrew
        ? "Data Query מצא **0 התראות תואמות**. לכן אין ראיות או תיאורים מאותה קבוצת התראות לדווח; תוצאות סמנטיות לא תואמות לא הוצגו כראיה לקבוצה הריקה."
        : "Data Query found **0 matching alerts**. There is therefore no evidence or description from that alert set to report; unrelated semantic results were not presented as evidence for the empty set.";
      const filterBoundary = formatAlertCountFilterBoundary(routing.metricScope, hebrew);
      if (filterBoundary) answer += `\n\n${filterBoundary}`;
      return appendConflictWarnings(answer, conflicts, { hebrew });
    }
  }
  const exactAnswer = routing.intent === "lookup"
    ? formatDeterministicAlertLookup({
        operation: routing.lookup?.operation,
        records: exactAlertLookupRecords(toolCalls),
        hebrew
      })
    : formatDeterministicAlertMetrics({
        data: dataQueryCall.data,
        metricScope: routing.metricScope,
        hebrew
      });
  if (!exactAnswer) return null;
  const evidenceBoundary = hebrew
    ? "\n\n> **גבול ראיות:** לא צורף תיאור סמנטי להתראה המדויקת, משום שאין כרגע פותר קשרים תחום-הרשאה שמוכיח התאמה לאותה רשומה. תוצאת Alert Agent כללית לא הוצגה כראיה לרשומה או לקבוצה המדויקת."
    : "\n\n> **Evidence boundary:** No semantic description was attached to the exact alert result because there is currently no authorization-bound resolver proving a same-record match. General Alert Agent output was not presented as evidence for the exact record or set.";
  return appendConflictWarnings(`${exactAnswer}${evidenceBoundary}`, conflicts, { hebrew });
}

function formatDeterministicAlertLookup({ operation, records = [], hebrew = false }) {
  if (!records.length) {
    return hebrew
      ? "לא נמצאו התראות מתוארכות התואמות לבקשה. תאריכי קליטה אינם משמשים כתחליף."
      : "No dated alerts matched the request. Ingestion dates were not used as a substitute.";
  }
  const labels = hebrew
    ? {
        latest: "ההתראה המתוארכת האחרונה",
        earliest: "ההתראה המתוארכת הראשונה",
        list: `אלה ${records.length} ההתראות המתוארכות האחרונות, בסדר כרונולוגי יורד:`,
        date: "תאריך ההתראה",
        type: "סוג התראה שמור",
        severity: "חומרה שמורה",
        input: "סוג קלט טכני שמור",
        status: "סטטוס פריט שמור",
        relevance: "דגל רלוונטיות שמור",
        source: "קישור מקור"
      }
    : {
        latest: "Latest dated alert",
        earliest: "Earliest dated alert",
        list: `These are the ${records.length} latest dated alerts, in descending chronological order:`,
        date: "Alert date",
        type: "Stored alert type",
        severity: "Stored severity",
        input: "Stored technical input type",
        status: "Stored item status",
        relevance: "Stored relevance flag",
        source: "Source link"
      };
  const blocks = records.map((record, index) => {
    const fields = [
      [labels.date, formatInvoiceDate(record.data_date)],
      [labels.type, alertTypeDisplay(record.alert_type, hebrew)],
      [labels.severity, alertSeverityDisplay(record.severity_level, hebrew)],
      [labels.input, alertInputTypeDisplay(record.input_data_type, hebrew)],
      [labels.status, alertStatusDisplay(record.item_status, hebrew)],
      [labels.relevance, alertRelevanceDisplay(record.is_relevant, hebrew)]
    ]
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(String(value))}`);
    fields.push(`- **${labels.source}:** ${hebrew
      ? "לא קיים קישור מקור מאומת בחוזה המדויק"
      : "No verified source link is available under the exact contract"}`);
    if (records.length === 1) return fields.join("\n");
    return `### ${index + 1}. ${escapeInvoiceDisplayValue(alertTypeDisplay(record.alert_type, hebrew) || (hebrew ? "התראה" : "Alert"))}\n\n${fields.join("\n")}`;
  });
  const heading = records.length === 1
    ? operation === "lookup_earliest" ? labels.earliest : labels.latest
    : labels.list;
  return records.length === 1
    ? `## ${heading}\n\n${blocks[0]}`
    : `${heading}\n\n${blocks.join("\n\n")}`;
}

function formatDeterministicAlertMetrics({ data = {}, metricScope = null, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : [])
    .find((item) => item?.table === "alerts");
  if (!plan) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  const planStatuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  if (
    plan.truncated === true ||
    plan.sampled === true ||
    planStatuses.some((item) => item.truncated || item.sampled)
  ) {
    return hebrew
      ? `לא ניתן להציג תוצאת התראות מדויקת${scope}: מספר שורות התוצאה חרג מהמגבלה המאושרת והמקור סימן את התוצאה כחלקית או מדגמית.`
      : `An exact alert result cannot be presented${scope}: the result-row cardinality exceeded the approved limit and the source marked the result as truncated or sampled.`;
  }
  let answer;
  if (plan.operation === "count") {
    const metric = metrics.find((item) => item.operation === "count");
    const count = metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value);
    if (!Number.isFinite(count)) return null;
    answer = hebrew
      ? `Data Query מצא **${formatInvoiceNumber(count)} התראות תואמות**${scope}.`
      : `Data Query found **${formatInvoiceNumber(count)} matching alerts**${scope}.`;
    const filterBoundary = formatAlertCountFilterBoundary(metricScope, hebrew);
    if (filterBoundary) answer += `\n\n${filterBoundary}`;
  } else if (["group_count", "timeseries"].includes(plan.operation)) {
    const groupField = plan.operation === "timeseries"
      ? "period"
      : plan.groupBy?.[0] || Object.keys(metrics[0]?.group || {})[0] || "value";
    const groups = metrics
      .map((metric) => ({
        label: firstPresent(...Object.values(metric.group || {}), "undated"),
        value: metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value)
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((left, right) => {
        if (plan.operation === "timeseries") {
          if (left.label === "undated") return 1;
          if (right.label === "undated") return -1;
          return String(left.label).localeCompare(String(right.label));
        }
        return right.value - left.value || String(left.label).localeCompare(String(right.label));
      });
    if (!groups.length) {
      return hebrew ? `לא נמצאו התראות${scope}.` : `No alerts were found${scope}.`;
    }
    const total = groups.reduce((sum, item) => sum + item.value, 0);
    const groupingLabel = plan.operation === "timeseries"
      ? hebrew
        ? `יום/חודש קלנדרי לפי UTC (${plan.granularity === "month" ? "חודש" : "יום"})`
        : `UTC calendar ${plan.granularity === "month" ? "month" : "day"}`
      : alertGroupLabel(groupField, hebrew);
    const heading = hebrew
      ? `Data Query מצא **${formatInvoiceNumber(total)} התראות**${scope}. פילוח לפי ${groupingLabel}:`
      : `Data Query found **${formatInvoiceNumber(total)} alerts**${scope}. Breakdown by ${groupingLabel}:`;
    answer = `${heading}\n\n${groups.map((item) =>
      `- **${escapeInvoiceDisplayValue(alertGroupValueDisplay(groupField, item.label, hebrew))}:** ${formatInvoiceNumber(item.value)}`
    ).join("\n")}`;
    if (plan.operation === "timeseries") {
      answer += hebrew
        ? "\n\n> חלוקת התקופות משתמשת בגבולות לוח שנה לפי **UTC** וכוללת שורת **ללא תאריך** מפורשת, ולכן סכום התקופות מתיישב עם מספר ההתראות הכולל."
        : "\n\n> Periods use **UTC calendar boundaries**. The series includes an explicit **Undated** bucket, so the period counts reconcile with the total alert count.";
    }
  } else {
    return null;
  }
  return answer;
}

function formatAlertCountFilterBoundary(metricScope, hebrew = false) {
  const fields = new Set((metricScope?.requiredFilters || []).map((filter) => filter?.field).filter(Boolean));
  const notes = [];
  if (fields.has("alert_type")) {
    notes.push(hebrew
      ? "הסינון משתמש בסוג ההתראה השמור בלבד."
      : "The filter uses the stored alert-type vocabulary only.");
  }
  if (fields.has("input_data_type")) {
    notes.push(hebrew
      ? "סוג המקור הוא קטגוריית קלט טכנית שמורה, לא זהות מסמך מאומתת."
      : "The input category is a stored technical origin, not a verified source-document identity.");
  }
  if (fields.has("severity_level")) {
    notes.push(hebrew
      ? "רמת חומרה 3 היא ערך שמור ואטום ללא מיפוי עסקי מאומת."
      : "Stored severity level 3 is opaque and has no verified business mapping.");
  }
  if (fields.has("item_status")) {
    notes.push(hebrew
      ? "'בטיפול' הוא סטטוס פריט שמור בלבד, לא הוכחה למצב מחזור חיים של ההתראה."
      : "Being handled is the stored item status only, not a verified alert lifecycle state.");
  }
  if (fields.has("is_relevant")) {
    notes.push(hebrew
      ? "זהו דגל הרלוונטיות השמור, לא הערכה חדשה של תקפות, חשיבות או שימושיות ההתראה."
      : "This is the stored relevance flag, not a fresh judgment of alert validity, importance, or usefulness.");
  }
  if (fields.has("data_date")) {
    notes.push(hebrew
      ? "הספירה מתייחסת לשלמות data_date; created_at לא שימש כתחליף."
      : "This is data_date completeness accounting; created_at was not used as a fallback.");
  }
  return notes.join(" ");
}

function alertGroupLabel(field, hebrew) {
  const labels = hebrew
    ? {
        alert_type: "סוג ההתראה השמור",
        severity_level: "רמת החומרה השמורה והאטומה",
        input_data_type: "סוג הקלט הטכני השמור",
        item_status: "סטטוס הפריט השמור",
        is_relevant: "דגל הרלוונטיות השמור",
        period: "תאריך ההתראה"
      }
    : {
        alert_type: "stored alert type",
        severity_level: "opaque stored severity level",
        input_data_type: "stored technical input type",
        item_status: "stored item status",
        is_relevant: "stored relevance flag",
        period: "alert date"
      };
  return labels[field] || field;
}

function alertGroupValueDisplay(field, value, hebrew) {
  if (field === "alert_type") return alertTypeDisplay(value, hebrew);
  if (field === "severity_level") return alertSeverityDisplay(value, hebrew);
  if (field === "input_data_type") return alertInputTypeDisplay(value, hebrew);
  if (field === "item_status") return alertStatusDisplay(value, hebrew);
  if (field === "is_relevant") return alertRelevanceDisplay(value, hebrew);
  if (field === "period" && value === "undated") return hebrew ? "ללא תאריך" : "Undated";
  return String(value);
}

function alertTypeDisplay(value, hebrew) {
  const stored = String(value || "");
  if (hebrew) return stored;
  return {
    עדכון: "Update",
    התראה: "Alert / warning",
    עיכוב: "Delay",
    חריג: "Exception / anomaly",
    איכות: "Quality",
    "אירוע בטיחות": "Safety event"
  }[stored] || stored;
}

function alertInputTypeDisplay(value, hebrew) {
  const stored = String(value || "");
  const english = {
    email: "Email",
    "attachment/meeting_summary": "Meeting-summary attachment",
    "attachment/safety_report": "Safety-report attachment",
    "attachment/exception_report": "Exception-report attachment"
  }[stored] || stored;
  return hebrew ? `${english} (${stored})` : english;
}

function alertSeverityDisplay(value, hebrew) {
  if (Number(value) !== 3) return hebrew ? "רמת חומרה שמורה לא מאושרת" : "Unapproved stored severity level";
  return hebrew ? "רמת חומרה שמורה 3 (ללא מיפוי עסקי)" : "Stored severity level 3 (no verified business mapping)";
}

function alertStatusDisplay(value, hebrew) {
  if (String(value || "") !== "בטיפול") return String(value || "");
  return hebrew ? "בטיפול (סטטוס פריט שמור בלבד)" : "Being handled (stored item status only)";
}

function alertRelevanceDisplay(value, hebrew) {
  const normalized = value === true || String(value).toLowerCase() === "true";
  return hebrew
    ? `${normalized ? "אמת" : "שקר"} (דגל רלוונטיות שמור)`
    : `${normalized ? "True" : "False"} (stored relevance flag)`;
}

export function buildDeterministicEmailAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  const hebrew = isHebrew(message);
  if (isDeterministicEmailNotComputableCapability(routing)) {
    const answers = {
      email_ingestion_time_not_computable: hebrew
        ? "לא ניתן להשתמש בזמן היצירה או הקליטה כתאריך עסקי של מייל. החוזה המדויק משתמש רק ב-`received_date`, שהוא זמן קבלת ההודעה."
        : "Email creation or ingestion time is not an approved business date. The exact contract uses only `received_date`, which is message receipt time.",
      email_scope_field_not_queryable: hebrew
        ? "מזהי פרויקט, מייל, רשומה ושיחה הם שדות פנימיים ואינם זמינים לסינון או להצגה."
        : "Project, email, record, and conversation identifiers are internal and unavailable as filters or display values.",
      email_pii_metric_not_computable: hebrew
        ? "לא ניתן לחשב ספירות לפי שולחים, נמענים, אנשים או כתובות דוא״ל משום שהם מוחרגים כמידע אישי."
        : "Counts by senders, recipients, people, or email addresses are not computable because those fields are excluded personal data.",
      email_attachment_documents_not_computable: hebrew
        ? "ניתן לספור מיילים לפי דגל קיום מצורפים, אך לא ניתן לחשב מספר קבצים, להציג שמות קבצים או להחזיר קישורים בחוזה המדויק."
        : "Email rows may be counted by the stored attachment-existence flag, but attachment counts, filenames, and links are outside the exact contract.",
      email_multidimensional_timeseries_not_computable: hebrew
        ? "סדרת זמן של מיילים נתמכת לפי יום או חודש אחד בלבד, ללא פילוח נוסף באותה שאילתה."
        : "Email time series support one day or month dimension only, without an additional grouping dimension.",
      email_no_clear_scope_count_only: hebrew
        ? "מיילים עם `relevance_status = no_clear_project` נתמכים בספירה מפורשת בלבד. פילוח, רשומות ותוכן נשארים מחוץ לחוזה המדויק."
        : "Emails with `relevance_status = no_clear_project` support an explicit count only. Breakdowns, records, and content remain outside the exact contract.",
      email_spam_not_equivalent_to_relevance: hebrew
        ? "לא ניתן לחשב ספאם מהשדה `relevance_status`. הערך `no_clear_project` מציין שאין שיוך ברור לפרויקט ואינו קביעה שהמייל הוא דואר זבל."
        : "Spam is not computable from `relevance_status`. `no_clear_project` means there is no clear project association; it does not establish that an email is spam.",
      email_unapproved_metric_not_computable: hebrew
        ? "השאילתה אינה תואמת את חוזה המטא-נתונים המאושר למיילים ועלולה לכלול מסנן תוכן או זהות שאינו נתמך."
        : "The request does not match the approved email-metadata contract and may include an unsupported content or identity qualifier.",
      invalid_lookup_limit: hebrew
        ? "גודל רשימת המיילים המבוקש אינו נתמך. ניתן לבקש את המייל האחרון או הראשון, או 1 עד 25 מיילים אחרונים."
        : "The requested email lookup size is unsupported. Request the latest or earliest email, or 1–25 latest emails.",
      email_content_origin_not_approved: hebrew
        ? "שאילתת המיילים המדויקת לא בוצעה משום שמקור ה-Content אינו תואם למקור המהימן של זהות Data Query המנוהלת."
        : "The exact email query was not executed because the request Content origin does not match the trusted managed Data Query origin.",
      structured_metrics_not_available: hebrew
        ? "מדד המיילים המדויק זוהה, אך חוזה הקריאה המנוהל אינו פעיל משום שלא הוגדרו פרטי גישה ייעודיים ל-Data Query."
        : "The exact email metric is recognized, but the managed read contract is inactive because dedicated Data Query credentials are not configured.",
      structured_lookup_not_available: hebrew
        ? "בקשת רשומת המייל המדויקת זוהתה, אך חוזה הקריאה המנוהל אינו פעיל משום שלא הוגדרו פרטי גישה ייעודיים ל-Data Query."
        : "The exact email lookup is recognized, but the managed read contract is inactive because dedicated Data Query credentials are not configured."
    };
    return appendConflictWarnings(answers[routing.warning] || routing.reason, conflicts, { hebrew });
  }
  if (!isDeterministicEmailCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
  if (!dataQueryCall?.ok || !["ok", "partial"].includes(dataQueryCall?.data?.status || "ok")) {
    const answer = hebrew
      ? "שאילתת המיילים המדויקת לא הושלמה, ולכן לא ניתן להציג תוצאה מאומתת. לא הוחלפה התוצאה בחיפוש סמנטי או בהערכה."
      : "The exact email query did not complete, so no verified result can be presented. Semantic search or an estimated answer was not substituted.";
    return appendConflictWarnings(answer, conflicts, { hebrew });
  }
  const answer = routing.intent === "lookup"
    ? formatDeterministicEmailLookup({
        operation: routing.lookup?.operation,
        records: exactEmailLookupRecords(toolCalls),
        hebrew
      })
    : formatDeterministicEmailMetrics({
        data: dataQueryCall.data,
        metricScope: routing.metricScope,
        hebrew
      });
  return answer ? appendConflictWarnings(answer, conflicts, { hebrew }) : null;
}

function formatDeterministicEmailLookup({ operation, records = [], hebrew = false }) {
  if (!records.length) {
    return hebrew
      ? "לא נמצאו מיילים רלוונטיים לפרויקט התואמים לבקשה לפי `received_date`."
      : "No project-related emails matched the request by `received_date`.";
  }
  const labels = hebrew
    ? {
        latest: "המייל הרלוונטי לפרויקט שהתקבל לאחרונה",
        earliest: "המייל הרלוונטי לפרויקט שהתקבל ראשון",
        list: `אלה ${records.length} המיילים הרלוונטיים לפרויקט שהתקבלו לאחרונה:`,
        date: "תאריך קבלה",
        category: "קטגוריה שמורה",
        direction: "כיוון",
        attachments: "מצורפים",
        relevance: "סטטוס רלוונטיות שמור",
        status: "סטטוס פריט שמור"
      }
    : {
        latest: "Latest received project-related email",
        earliest: "Earliest received project-related email",
        list: `These are the ${records.length} latest received project-related emails:`,
        date: "Received date",
        category: "Stored category",
        direction: "Direction",
        attachments: "Attachments",
        relevance: "Stored relevance status",
        status: "Stored item status"
      };
  const blocks = records.map((record, index) => {
    const fields = [
      [labels.date, formatInvoiceDate(record.received_date)],
      [labels.category, record.mail_category],
      [labels.direction, emailDirectionDisplay(record.direction, hebrew)],
      [labels.attachments, emailAttachmentDisplay(record.has_attachments, hebrew)],
      [labels.relevance, emailRelevanceDisplay(record.relevance_status, hebrew)],
      [labels.status, record.item_status]
    ]
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(String(value))}`);
    return records.length === 1
      ? fields.join("\n")
      : `### ${index + 1}. ${formatInvoiceDate(record.received_date)}\n\n${fields.join("\n")}`;
  });
  const heading = records.length === 1
    ? operation === "lookup_earliest" ? labels.earliest : labels.latest
    : labels.list;
  return records.length === 1
    ? `## ${heading}\n\n${blocks[0]}`
    : `${heading}\n\n${blocks.join("\n\n")}`;
}

function formatDeterministicEmailMetrics({ data = {}, metricScope = null, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : []).find((item) => item?.table === "emails");
  if (!plan) return null;
  const dateScope = formatInvoiceDateScope(data.caller || {}, hebrew);
  const noClearScope = metricScope?.requiredFilters?.some((filter) =>
    filter?.field === "relevance_status" && filter?.op === "eq" && filter?.value === "no_clear_project"
  );
  const scope = noClearScope
    ? hebrew
      ? `${dateScope} מתוך המיילים שאין להם שיוך ברור לפרויקט`
      : `${dateScope} among emails without a clear project association`
    : hebrew
      ? `${dateScope} מתוך המיילים הרלוונטיים לפרויקט`
      : `${dateScope} within project-related emails`;
  if (plan.operation === "count") {
    const metric = metrics.find((item) => item.operation === "count");
    const count = metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value);
    if (!Number.isFinite(count)) return null;
    let answer = hebrew
      ? `Data Query מצא **${formatInvoiceNumber(count)} מיילים תואמים**${scope}.`
      : `Data Query found **${formatInvoiceNumber(count)} matching emails**${scope}.`;
    answer += `\n\n${formatEmailFilterBoundary(metricScope, hebrew)}`;
    return answer;
  }
  if (plan.operation === "distinct") {
    const values = metrics
      .map((metric) => firstPresent(...Object.values(metric.group || {}), metric.value))
      .filter((value) => value !== null && value !== undefined && value !== "")
      .sort((left, right) => String(left).localeCompare(String(right)));
    if (!values.length) return hebrew ? `לא נמצאו קטגוריות מיילים${scope}.` : `No email categories were found${scope}.`;
    const heading = hebrew
      ? `נמצאו **${values.length} קטגוריות מיילים שונות**${scope}:`
      : `Found **${values.length} distinct email categories**${scope}:`;
    return `${heading}\n\n${values.map((value) => `- ${escapeInvoiceDisplayValue(String(value))}`).join("\n")}`;
  }
  if (!["group_count", "timeseries"].includes(plan.operation)) return null;
  const groupField = plan.operation === "timeseries"
    ? "period"
    : plan.groupBy?.[0] || metricScope?.groupField || Object.keys(metrics[0]?.group || {})[0];
  const groups = metrics
    .map((metric) => ({
      label: firstPresent(...Object.values(metric.group || {})),
      value: metric?.value === null || metric?.value === undefined ? NaN : Number(metric.value)
    }))
    .filter((item) => item.label !== null && item.label !== undefined && Number.isFinite(item.value))
    .sort((left, right) => plan.operation === "timeseries"
      ? String(left.label).localeCompare(String(right.label))
      : right.value - left.value || String(left.label).localeCompare(String(right.label)));
  if (!groups.length) return hebrew ? `לא נמצאו מיילים${scope}.` : `No emails were found${scope}.`;
  const total = groups.reduce((sum, item) => sum + item.value, 0);
  const groupLabel = plan.operation === "timeseries"
    ? hebrew
      ? `גבול לוח שנה לפי UTC (${(plan.granularity || metricScope?.granularity) === "month" ? "חודש" : "יום"})`
      : `UTC calendar ${(plan.granularity || metricScope?.granularity) === "month" ? "month" : "day"}`
    : emailGroupLabel(groupField, hebrew);
  const heading = hebrew
    ? `Data Query מצא **${formatInvoiceNumber(total)} מיילים**${scope}. פילוח לפי ${groupLabel}:`
    : `Data Query found **${formatInvoiceNumber(total)} emails**${scope}. Breakdown by ${groupLabel}:`;
  return `${heading}\n\n${groups.map((item) =>
    `- **${escapeInvoiceDisplayValue(emailGroupValueDisplay(groupField, item.label, hebrew))}:** ${formatInvoiceNumber(item.value)}`
  ).join("\n")}`;
}

function formatEmailFilterBoundary(metricScope, hebrew = false) {
  const filters = (metricScope?.requiredFilters || []).filter((filter) => filter?.field !== "relevance_status");
  const notes = filters.map((filter) => {
    const value = emailGroupValueDisplay(filter.field, filter.value, hebrew);
    return `${emailGroupLabel(filter.field, hebrew)} = ${value}`;
  });
  const noClearScope = (metricScope?.requiredFilters || []).some((filter) =>
    filter?.field === "relevance_status" && filter?.op === "eq" && filter?.value === "no_clear_project"
  );
  const fixed = noClearScope
    ? hebrew
      ? "היקף מפורש: רק `no_clear_project`. המשמעות היא שאין שיוך ברור לפרויקט; אין להסיק מכך שמדובר בספאם."
      : "Explicit scope: `no_clear_project` only. This means no clear project association; it does not establish that the email is spam."
    : hebrew
      ? "היקף קבוע: רק `project_related` או `multi_project`; רשומות `no_clear_project` אינן נכללות."
      : "Fixed scope: `project_related` or `multi_project` only; `no_clear_project` rows are excluded.";
  return `> ${[fixed, ...notes].join(" ")}`;
}

function emailGroupLabel(field, hebrew = false) {
  const labels = {
    mail_category: hebrew ? "קטגוריה שמורה" : "stored category",
    direction: hebrew ? "כיוון" : "direction",
    has_attachments: hebrew ? "קיום מצורפים" : "attachment presence",
    relevance_status: hebrew ? "סטטוס רלוונטיות שמור" : "stored relevance status",
    item_status: hebrew ? "סטטוס פריט שמור" : "stored item status",
    period: hebrew ? "תקופה" : "period"
  };
  return labels[field] || String(field || "value");
}

function emailGroupValueDisplay(field, value, hebrew = false) {
  if (field === "direction") return emailDirectionDisplay(value, hebrew);
  if (field === "has_attachments") return emailAttachmentDisplay(value, hebrew);
  if (field === "relevance_status") return emailRelevanceDisplay(value, hebrew);
  return String(value);
}

function emailDirectionDisplay(value, hebrew = false) {
  if (value === "inbound") return hebrew ? "נכנס" : "Inbound";
  if (value === "outbound") return hebrew ? "יוצא" : "Outbound";
  return String(value ?? "");
}

function emailAttachmentDisplay(value, hebrew = false) {
  if (value === true || value === "true") return hebrew ? "יש" : "Yes";
  if (value === false || value === "false") return hebrew ? "אין" : "No";
  return String(value ?? "");
}

function emailRelevanceDisplay(value, hebrew = false) {
  if (value === "project_related") return hebrew ? "רלוונטי לפרויקט" : "Project-related";
  if (value === "multi_project") return hebrew ? "רלוונטי למספר פרויקטים" : "Multi-project";
  if (value === "no_clear_project") return hebrew ? "ללא שיוך ברור לפרויקט" : "No clear project association";
  return String(value ?? "");
}

export function buildDeterministicExceptionAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  const hebrew = isHebrew(message);
  if (isDeterministicExceptionNotComputableCapability(routing)) {
    const messages = {
      exception_amount_not_computable: hebrew
        ? "לא ניתן לחשב את הסכום של כלל החריגים משום שבחלק מהרשומות חסר סכום מבוקש. כאשר קיים סכום חלקי, הוא מוצג בש״ח לפני מע״מ ולאחר חישוב מע״מ בשיעור 18%, יחד עם היקף הכיסוי."
        : "The amount for all exceptions cannot be calculated because some records have no requested amount. When a partial subtotal is available, it is shown in ILS before VAT and after applying 18% VAT, together with its coverage.",
      exception_execution_days_not_computable: hebrew
        ? "לא ניתן לחשב זמן ביצוע מייצג משום שהשדה `execution_days` מאוכלס רק ברשומה מבוקרת אחת וחסר בשאר הרשומות."
        : "Execution time is not computable because `execution_days` is populated in only one audited record and is missing from the rest.",
      exception_identity_grouping_not_computable: hebrew
        ? "פילוח לפי מפקח או מנהל חושף מידע אישי, ופילוח החברות מזהה צדדים עסקיים בקבוצה קטנה; לכן הוא מחוץ לחוזה המדויק."
        : "Inspector and manager breakdowns expose personal data, while company groups identify business parties in a small dataset; those groupings are excluded.",
      exception_category_not_computable: hebrew
        ? "אין בטבלה שדה קטגוריה שמור ומאושר לחריגים. נושא, תקציר והאשטגים דורשים פרשנות סמנטית."
        : "The table has no approved stored exception-category field. Subject, summary, and hashtags require semantic interpretation.",
      exception_lifecycle_status_not_computable: hebrew
        ? "הסטטוס השמור הוא תווית טיפול אטומה ואינו מוכיח אישור, דחייה, פתיחה, סגירה או השלמה."
        : "The stored item status is an opaque processing label and does not prove approval, rejection, open/closed, resolution, or completion.",
      exception_identity_field_not_queryable: hebrew
        ? "מזהי חריג, פרויקט, קובץ ומייל אינם ניתנים להצגה או לסינון; גם מספר החריג אינו זהות יציבה משום שהוא חסר וכפול בחלק מהרשומות."
        : "Exception, project, attachment, and mail identifiers are unavailable for display or filtering; exception numbers are also incomplete and duplicated.",
      exception_ingestion_time_not_computable: hebrew
        ? "זמן יצירה או קליטה אינו תאריך עסקי מאושר. החוזה המדויק משתמש רק ב-`exception_date`."
        : "Creation or ingestion time is not an approved business date. The exact contract uses only `exception_date`."
    };
    return appendConflictWarnings(messages[routing.warning] || routing.reason, conflicts, { hebrew });
  }
  if (!isDeterministicExceptionCapability(routing) && !isDeterministicExceptionMixedCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
  if (!dataQueryCall?.ok || !["ok", "partial"].includes(dataQueryCall?.data?.status || "ok")) {
    return hebrew
      ? "שאילתת החריגים המדויקת לא הושלמה, ולכן לא הוחלפה בהערכה או בחיפוש סמנטי."
      : "The exact exception query did not complete, so no estimate or semantic result was substituted.";
  }
  let answer = routing.intent === "lookup"
    ? formatDeterministicExceptionLookup({
        operation: routing.lookup?.operation,
        records: exactExceptionLookupRecords(toolCalls),
        hebrew
      })
    : formatDeterministicExceptionMetrics({
        data: dataQueryCall.data,
        metricScope: routing.metricScope,
        hebrew
      });
  if (!answer) return null;
  if (isDeterministicExceptionMixedCapability(routing)) {
    const evidence = toolCalls.find((call) => call?.toolName === "exception_evidence_search")?.data;
    if (evidence?.status === "ok" && evidence?.same_exception_match === true && evidence?.answer) {
      answer += hebrew
        ? `\n\n## הסבר מראיות של אותה רשומת חריג\n\n${evidence.answer}`
        : `\n\n## Same-record exception evidence\n\n${evidence.answer}`;
    } else {
      answer += hebrew
        ? "\n\n> הראיות המאומתות של אותה רשומת חריג אינן מספיקות לתמצית בטוחה; לא צורף הסבר מרשומה אחרת."
        : "\n\n> Attested evidence from that same exception record was insufficient for a safe summary; evidence from another record was not substituted.";
    }
  }
  return appendConflictWarnings(answer, conflicts, { hebrew });
}

function formatDeterministicExceptionLookup({ operation, records = [], hebrew = false }) {
  if (!records.length) {
    return hebrew ? "לא נמצאו חריגים מתוארכים התואמים לבקשה." : "No dated exceptions matched the request.";
  }
  const heading = records.length > 1
    ? (hebrew ? `${records.length} החריגים המתוארכים האחרונים:` : `The ${records.length} latest dated exceptions:`)
    : operation === "lookup_earliest"
      ? (hebrew ? "החריג המתוארך הראשון" : "Earliest dated exception")
      : (hebrew ? "החריג המתוארך האחרון" : "Latest dated exception");
  const blocks = records.map((record, index) => {
    const lines = [
      [hebrew ? "תאריך חריגה" : "Exception date", formatInvoiceDate(record.exception_date)],
      [hebrew ? "דחיפות שמורה" : "Stored urgency", record.urgency_level],
      [hebrew ? "סטטוס פריט שמור" : "Stored item status", record.item_status]
    ]
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
      .map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(String(value))}`);
    return records.length === 1 ? lines.join("\n") : `### ${index + 1}. ${formatInvoiceDate(record.exception_date)}\n\n${lines.join("\n")}`;
  });
  const boundary = hebrew
    ? "> רשומות ללא `exception_date` אינן משתתפות במיון. מספרי חריג, זהויות, סכומים וקישורי מקור אינם מוצגים."
    : "> Rows without `exception_date` are excluded from ordering. Exception numbers, identities, amounts, and source links are not displayed.";
  return `## ${heading}\n\n${blocks.join("\n\n")}\n\n${boundary}`;
}

function formatDeterministicExceptionMetrics({ data = {}, metricScope = null, hebrew = false }) {
  const metrics = Object.values(data.machineResult?.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (data.plans || []).find((item) => item?.table === "exceptions_report");
  if (!plan) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  if (plan.operation === "aggregate") {
    const metricValue = (alias) => Number(metrics.find((item) =>
      item?.definition?.as === alias || String(item?.label || "").includes(`.${alias}`)
    )?.value);
    const totalRows = metricValue("total_exception_rows");
    const populatedRows = metricValue("exceptions_with_requested_amount");
    const partialSubtotal = metricValue("partial_requested_amount_ex_vat");
    if (![totalRows, populatedRows, partialSubtotal].every(Number.isFinite)) return null;
    const missingRows = Math.max(0, totalRows - populatedRows);
    const includingVat = Math.round((partialSubtotal * (1 + DATA_QUERY_EXCEPTION_VAT_RATE) + Number.EPSILON) * 100) / 100;
    const beforeVat = formatExceptionCurrency(partialSubtotal, hebrew);
    const afterVat = formatExceptionCurrency(includingVat, hebrew);
    const vatPercent = formatInvoiceNumber(DATA_QUERY_EXCEPTION_VAT_RATE * 100);
    return hebrew
      ? `**לפני מע״מ:** **${beforeVat}**${scope}\n\n**כולל מע״מ (${vatPercent}%):** **${afterVat}**\n\nהסכומים מבוססים על **${formatInvoiceNumber(populatedRows)} מתוך ${formatInvoiceNumber(totalRows)} חריגים**. ב-${formatInvoiceNumber(missingRows)} חריגים לא קיים סכום, ולכן הם אינם מייצגים את כלל החריגים.`
      : `**Before VAT:** **${beforeVat}**${scope}\n\n**Including VAT (${vatPercent}%):** **${afterVat}**\n\nThese amounts are based on **${formatInvoiceNumber(populatedRows)} of ${formatInvoiceNumber(totalRows)} exceptions**. ${formatInvoiceNumber(missingRows)} exceptions have no recorded amount, so the figures do not represent all exceptions.`;
  }
  if (plan.operation === "count") {
    const value = Number(metrics.find((item) => item.operation === "count")?.value);
    if (!Number.isFinite(value)) return null;
    const filtered = (metricScope?.requiredFilters || []).some((filter) => filter.field === "exception_date" && filter.op === "is")
      ? (hebrew ? " ללא תאריך" : " without a date")
      : "";
    return hebrew
      ? `נמצאו **${formatInvoiceNumber(value)} חריגים${filtered}**${scope}.`
      : `**${formatInvoiceNumber(value)} exceptions${filtered}** were found${scope}.`;
  }
  if (!["group_count", "timeseries"].includes(plan.operation)) return null;
  const groupField = plan.operation === "timeseries" ? "period" : metricScope?.groupField || plan.groupBy?.[0];
  const groups = metrics.map((metric) => ({
    label: firstPresent(...Object.values(metric.group || {})),
    value: Number(metric.value)
  })).filter((item) => item.label !== null && item.label !== undefined && Number.isFinite(item.value));
  if (!groups.length) return hebrew ? `לא נמצאו חריגים${scope}.` : `No exceptions were found${scope}.`;
  const total = groups.reduce((sum, item) => sum + item.value, 0);
  const label = groupField === "urgency_level"
    ? (hebrew ? "דחיפות שמורה" : "stored urgency")
    : groupField === "item_status"
      ? (hebrew ? "סטטוס פריט שמור" : "stored item status")
      : (hebrew ? "תקופת UTC" : "UTC period");
  const items = groups
    .sort((left, right) => String(left.label).localeCompare(String(right.label)))
    .map((item) => `- **${escapeInvoiceDisplayValue(item.label === "undated" ? (hebrew ? "ללא תאריך" : "Undated") : String(item.label))}:** ${formatInvoiceNumber(item.value)}`)
    .join("\n");
  const heading = hebrew
    ? `נמצאו **${formatInvoiceNumber(total)} חריגים**${scope}. פילוח לפי ${label}:`
    : `**${formatInvoiceNumber(total)} exceptions** were found${scope}. Breakdown by ${label}:`;
  const boundary = plan.operation === "timeseries"
    ? (hebrew ? "\n\n> סדרת הזמן משתמשת בגבולות UTC וכוללת דלי מפורש לרשומות ללא תאריך." : "\n\n> The time series uses UTC boundaries and includes an explicit undated bucket.")
    : "";
  return `${heading}\n\n${items}${boundary}`;
}

export function buildDeterministicConsultantReportAnswer({ message = "", routing = null, toolCalls = [], conflicts = [] } = {}) {
  const hebrew = isHebrew(message);
  if (isDeterministicConsultantReportNotComputableCapability(routing)) {
    const messages = {
      consultant_people_count_not_computable: hebrew ? "לא ניתן לספק ספירה מדויקת של יועצים כאנשים. המדד המאושר סופר דוחות יועצים, לא אנשים, ולכן לא הוחזרה רשימת שמות." : "An exact count of consultant people is not available. The approved metric counts consultant reports, not people, so no names were returned.",
      consultant_ingestion_time_not_computable: hebrew ? "זמן היצירה או הקליטה אינו תאריך עסקי מאושר. השאילתה המדויקת משתמשת רק בתאריך הדוח." : "Creation or ingestion time is not an approved business date. The exact query uses only the report date.",
      consultant_identity_field_not_queryable: hebrew ? "מזהי פרויקט, דוח, קובץ ומייל ושם הקובץ אינם זמינים להצגה או לסינון." : "Project, report, attachment, mail, and filename identifiers are unavailable for display or filtering.",
      consultant_identity_grouping_not_computable: hebrew ? "לא ניתן לבצע פילוח מדויק לפי שם היועץ, משום שזהו מידע מזהה שאינו חלק מחוזה המדדים." : "Exact grouping by consultant identity is outside the approved metrics contract.",
      consultant_category_not_computable: hebrew ? "תחום ההתמחות ונושא הדוח הם טקסט חופשי ודורשים חיפוש סמנטי, ולכן אינם זמינים כפילוח מדויק." : "Specialization and report topic are free text and require semantic retrieval, so they are unavailable as exact groups.",
      consultant_implementation_status_not_computable: hebrew ? "לא ניתן לקבוע יישום, אישור או השלמה: שדה סטטוס היישום ריק, והסטטוס השמור מציין טיפול בלבד." : "Implementation, approval, or completion cannot be determined: implementation status is blank and the stored item status indicates processing only."
    };
    return appendConflictWarnings(messages[routing.warning] || routing.reason, conflicts, { hebrew });
  }
  if (!isDeterministicConsultantReportCapability(routing) && !isDeterministicConsultantReportMixedCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
  if (!dataQueryCall?.ok || !["ok", "partial"].includes(dataQueryCall?.data?.status || "ok")) {
    return hebrew ? "שאילתת דוחות היועצים המדויקת לא הושלמה, ולכן לא הוחלפה בהערכה סמנטית." : "The exact consultant-report query did not complete, so no semantic estimate was substituted.";
  }
  let answer = routing.intent === "lookup"
    ? formatDeterministicConsultantReportLookup({ operation: routing.lookup?.operation, records: exactConsultantReportLookupRecords(toolCalls), hebrew })
    : formatDeterministicConsultantReportMetrics({ data: dataQueryCall.data, metricScope: routing.metricScope, hebrew });
  if (!answer) return null;
  if (isDeterministicConsultantReportMixedCapability(routing)) {
    const evidence = toolCalls.find((call) => call?.toolName === "consultant_report_evidence_search")?.data;
    answer += evidence?.status === "ok" && evidence?.same_report_match === true && evidence?.answer
      ? (hebrew ? `\n\n## המלצות מתוך אותו דוח\n\n${evidence.answer}` : `\n\n## Recommendations from that same report\n\n${evidence.answer}`)
      : (hebrew ? "\n\n> לא נמצאו באותו דוח ראיות מספיקות לתמצית בטוחה; לא צורף מידע מדוח אחר." : "\n\n> Evidence from that same report was insufficient for a safe summary; another report was not substituted.");
  }
  return appendConflictWarnings(answer, conflicts, { hebrew });
}

function formatDeterministicConsultantReportLookup({ operation, records = [], hebrew = false }) {
  if (!records.length) return hebrew ? "לא נמצאו דוחות יועצים מתוארכים התואמים לבקשה." : "No dated consultant reports matched the request.";
  const heading = records.length > 1
    ? (hebrew ? `${records.length} דוחות היועצים המתוארכים האחרונים:` : `The ${records.length} latest dated consultant reports:`)
    : operation === "lookup_earliest"
      ? (hebrew ? "דוח היועץ המתוארך הראשון" : "Earliest dated consultant report")
      : (hebrew ? "דוח היועץ המתוארך האחרון" : "Latest dated consultant report");
  const blocks = records.map((record, index) => {
    const lines = [
      [hebrew ? "תאריך הדוח" : "Report date", formatInvoiceDate(record.report_date)],
      [hebrew ? "סטטוס שמור" : "Stored item status", record.item_status]
    ].map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(String(value))}`);
    return records.length === 1 ? lines.join("\n") : `### ${index + 1}. ${formatInvoiceDate(record.report_date)}\n\n${lines.join("\n")}`;
  });
  return `## ${heading}\n\n${blocks.join("\n\n")}`;
}

function formatDeterministicConsultantReportMetrics({ data = {}, metricScope = null, hebrew = false }) {
  const metrics = Object.values(data.machineResult?.metricsByRequestId || {}).flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (data.plans || []).find((item) => item?.table === "consultants_reports");
  if (!plan) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  if (plan.operation === "count") {
    const value = Number(metrics.find((item) => item.operation === "count")?.value);
    if (!Number.isFinite(value)) return null;
    const undated = (metricScope?.requiredFilters || []).some((filter) => filter.field === "report_date" && filter.op === "is");
    if (value === 1) {
      return hebrew
        ? `נמצא **דוח יועץ אחד${undated ? " ללא תאריך" : ""}**${scope}.`
        : `**1 consultant report${undated ? " without a date" : ""}** was found${scope}.`;
    }
    return hebrew ? `נמצאו **${formatInvoiceNumber(value)} דוחות יועצים${undated ? " ללא תאריך" : ""}**${scope}.` : `**${formatInvoiceNumber(value)} consultant reports${undated ? " without a date" : ""}** were found${scope}.`;
  }
  const groups = metrics.map((metric) => ({ label: firstPresent(...Object.values(metric.group || {})), value: Number(metric.value) })).filter((item) => item.label !== null && item.label !== undefined && Number.isFinite(item.value));
  if (!groups.length) return hebrew ? `לא נמצאו דוחות יועצים${scope}.` : `No consultant reports were found${scope}.`;
  const items = groups.sort((a, b) => String(a.label).localeCompare(String(b.label))).map((item) => `- **${escapeInvoiceDisplayValue(item.label === "undated" ? (hebrew ? "ללא תאריך" : "Undated") : String(item.label))}:** ${formatInvoiceNumber(item.value)}`).join("\n");
  const heading = plan.operation === "timeseries" ? (hebrew ? "מגמת דוחות יועצים" : "Consultant-report trend") : (hebrew ? "פילוח לפי סטטוס שמור" : "Breakdown by stored item status");
  return `## ${heading}\n\n${items}`;
}

export function buildDeterministicSafetyAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  exactRecords = [],
  enrichments = [],
  conflicts = []
} = {}) {
  const hebrew = isHebrew(message);
  const mixedGuardAnswer = buildDeterministicSafetyMixedGuardAnswer({
    message,
    routing,
    toolCalls,
    conflicts
  });
  if (mixedGuardAnswer) return mixedGuardAnswer;
  if (isDeterministicSafetyNotComputableCapability(routing)) {
    const answer = routing.warning === "safety_worker_aggregate_not_computable"
      ? (hebrew
          ? "לא ניתן לחשב סכום או ממוצע עובדים בין דוחות: מספר העובדים הוא תמונת מצב לכל דוח ועלול לספור את אותם עובדים שוב."
          : "A cross-report worker total or average is not computable: each value is a per-report snapshot and may count the same workers again.")
      : (hebrew
          ? "לא ניתן לחשב סטטוס פתוח/סגור או נפתר/לא נפתר: השדות המאושרים אינם מגדירים סטטוס פתרון אמין ברמת הדוח."
          : "Resolved/unresolved or open/closed report counts are not computable because the approved fields do not define a trustworthy report-level resolution status.");
    return appendConflictWarnings(answer, conflicts, { hebrew });
  }
  if (!isDeterministicSafetyCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  if (!dataQueryCall?.data) return null;
  const answer = routing.intent === "lookup"
    ? formatDeterministicSafetyLookup({
        operation: routing.lookup?.operation,
        records: exactRecords.length ? exactRecords : exactSafetyLookupRecords(toolCalls),
        enrichments,
        hebrew
      })
    : formatDeterministicSafetyMetrics({ data: dataQueryCall.data, hebrew });
  return answer ? appendConflictWarnings(answer, conflicts, { hebrew }) : null;
}

export function buildDeterministicSafetyMixedGuardAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  if (
    routing?.mixed !== true ||
    routing?.metricScope?.targetTable !== "safety_reports" ||
    !(routing.warnings || []).includes("safety_resolution_status_not_computable")
  ) {
    return null;
  }
  const risk = (routing.metricScope.requiredFilters || [])
    .find((filter) => filter?.field === "risk_level" && filter?.op === "eq")?.value;
  if (!risk) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  const countMetric = Object.values(dataQueryCall?.data?.machineResult?.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .find((metric) => metric?.operation === "count" && metric?.exactness === "exact");
  if (Number(countMetric?.value) !== 0) return null;
  const hebrew = isHebrew(message);
  const riskLabel = safetyRiskDisplay(risk, hebrew);
  const answer = hebrew
    ? `Data Query מצא **0 דוחות בטיחות** ברמת הסיכון הקנונית **${riskLabel}**. מאחר שאין דוח תואם, אין תיאורי ליקויים תואמים לדווח. לא ניתן לחשב כמה דוחות לא נפתרו, משום שהשדות המאושרים אינם מגדירים סטטוס פתרון אמין ברמת הדוח.`
    : `Data Query found **0 safety reports** with canonical report risk **${riskLabel}**. Because no matching report exists, there are no matching defect descriptions to report. The unresolved qualifier is not computable because the approved fields do not define a trustworthy report-level resolution status.`;
  return appendConflictWarnings(answer, conflicts, { hebrew });
}

function formatDeterministicSafetyLookup({
  operation,
  records = [],
  enrichments = [],
  hebrew = false
}) {
  if (!records.length) {
    return hebrew
      ? "לא נמצאו דוחות בטיחות התואמים לבקשה."
      : "No safety reports matched the request.";
  }
  const enrichmentById = new Map(enrichments.map((item) => [String(item.recordId), item]));
  const labels = hebrew
    ? {
        latest: "דוח הבטיחות האחרון",
        earliest: "דוח הבטיחות הראשון",
        list: `אלה ${records.length} דוחות הבטיחות האחרונים, בסדר כרונולוגי יורד:`,
        date: "תאריך",
        site: "אתר",
        risk: "רמת סיכון",
        grade: "ציון",
        status: "סטטוס פריט שמור",
        workers: "עובדים בדוח",
        life: "ליקויים מסכני חיים",
        severe: "ליקויים חמורים",
        medium: "ליקויים בינוניים",
        minor: "ליקויים קלים",
        document: "מסמך",
        openDocument: "פתיחת מסמך דוח הבטיחות",
        missingDocument: "לא נמצא קישור מאומת למסמך"
      }
    : {
        latest: "Latest safety report",
        earliest: "Earliest safety report",
        list: `These are the ${records.length} latest safety reports, in descending chronological order:`,
        date: "Date",
        site: "Site",
        risk: "Risk level",
        grade: "Grade",
        status: "Stored item status",
        workers: "Workers in report",
        life: "Life-threatening defects",
        severe: "Severe defects",
        medium: "Medium defects",
        minor: "Minor defects",
        document: "Document",
        openDocument: "Open safety report document",
        missingDocument: "No verified document link was available"
      };
  const blocks = records.map((record, index) => {
    const enrichment = enrichmentById.get(String(record.id)) || {};
    const fields = [
      [labels.date, formatInvoiceDate(firstPresent(enrichment.reportDate, record.report_date))],
      [labels.site, firstPresent(enrichment.siteLocation, record.site_location)],
      [labels.risk, safetyRiskDisplay(firstPresent(enrichment.riskLevel, record.risk_level), hebrew)],
      [labels.grade, firstPresent(enrichment.siteGrade, record.site_grade)],
      [labels.status, firstPresent(enrichment.itemStatus, record.item_status)],
      [labels.workers, firstPresent(enrichment.totalWorkers, record.total_workers)],
      [labels.life, firstPresent(enrichment.lifeThreateningDefects, record.life_threatening_defects)],
      [labels.severe, firstPresent(enrichment.severeDefects, record.severe_defects)],
      [labels.medium, firstPresent(enrichment.mediumDefects, record.medium_defects)],
      [labels.minor, firstPresent(enrichment.minorDefects, record.minor_defects)]
    ]
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(String(value))}`);
    fields.push(enrichment.documentUrl
      ? `- **${labels.document}:** [${labels.openDocument}](<${enrichment.documentUrl}>)`
      : `- **${labels.document}:** ${labels.missingDocument}`);
    if (records.length === 1) return fields.join("\n");
    const itemTitle = firstPresent(
      enrichment.siteLocation,
      record.site_location,
      `${hebrew ? "דוח בטיחות" : "Safety report"} ${index + 1}`
    );
    return `### ${index + 1}. ${escapeInvoiceDisplayValue(itemTitle)}\n\n${fields.join("\n")}`;
  });
  const heading = records.length === 1
    ? operation === "lookup_earliest" ? labels.earliest : labels.latest
    : labels.list;
  return records.length === 1
    ? `## ${heading}\n\n${blocks[0]}`
    : `${heading}\n\n${blocks.join("\n\n")}`;
}

function formatDeterministicSafetyMetrics({ data = {}, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : [])
    .find((item) => item?.table === "safety_reports");
  if (!plan) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  let answer;
  if (plan.operation === "count") {
    const count = Number(metrics.find((metric) => metric.operation === "count")?.value);
    if (!Number.isFinite(count)) return null;
    answer = hebrew
      ? `במערכת נמצאו **${formatInvoiceNumber(count)} דוחות בטיחות**${scope}.`
      : `The system contains **${formatInvoiceNumber(count)} safety reports**${scope}.`;
  } else if (["group_count", "timeseries"].includes(plan.operation)) {
    const groups = metrics
      .map((metric) => ({
        label: firstPresent(...Object.values(metric.group || {}), hebrew ? "לא צוין" : "Not specified"),
        value: Number(metric.value)
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((left, right) =>
        plan.operation === "timeseries"
          ? String(left.label).localeCompare(String(right.label))
          : right.value - left.value || String(left.label).localeCompare(String(right.label))
      );
    if (!groups.length) {
      return hebrew
        ? `לא נמצאו דוחות בטיחות${scope}.`
        : `No safety reports were found${scope}.`;
    }
    const total = groups.reduce((sum, item) => sum + item.value, 0);
    const groupField = plan.operation === "timeseries"
      ? "period"
      : plan.groupBy?.[0] || Object.keys(metrics[0]?.group || {})[0] || "value";
    const heading = hebrew
      ? `במערכת נמצאו **${formatInvoiceNumber(total)} דוחות בטיחות**${scope}. פילוח לפי ${safetyGroupLabel(groupField, true)}:`
      : `The system contains **${formatInvoiceNumber(total)} safety reports**${scope}. Breakdown by ${safetyGroupLabel(groupField, false)}:`;
    answer = `${heading}\n\n${groups.map((item) => {
      const label = groupField === "risk_level"
        ? safetyRiskDisplay(item.label, hebrew)
        : item.label;
      return `- **${escapeInvoiceDisplayValue(label)}:** ${formatInvoiceNumber(item.value)}`;
    }).join("\n")}`;
  } else if (plan.operation === "aggregate") {
    const totals = metrics
      .map((metric) => ({
        label: safetyDefectMetricLabel(metric.definition?.as || metric.id, hebrew),
        value: metric.value === null || metric.value === undefined || metric.exactness === "not_computable"
          ? null
          : Number(metric.value)
      }))
      .filter((item) => item.label && Number.isFinite(item.value));
    if (!totals.length) {
      return hebrew
        ? `לא ניתן לחשב את סכום מוני הליקויים המבוקש${scope}, משום שהמקור לא החזיר ערכים מספריים מאומתים.`
        : `The requested defect-counter total is not computable${scope} because the source did not return verified numeric values.`;
    }
    const total = totals.reduce((sum, item) => sum + item.value, 0);
    const heading = hebrew
      ? `סך הליקויים המתועדים במוני הדוחות הוא **${formatInvoiceNumber(total)} מופעי ליקוי**${scope}:`
      : `The approved report counters contain **${formatInvoiceNumber(total)} recorded defect occurrences**${scope}:`;
    answer = `${heading}\n\n${totals.map((item) =>
      `- **${item.label}:** ${formatInvoiceNumber(item.value)}`
    ).join("\n")}`;
  } else {
    return null;
  }
  const planStatuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  if (planStatuses.some((item) => item.truncated || item.sampled)) {
    answer += hebrew
      ? "\n\n> **אזהרה:** תוצאת המקור סומנה כחלקית או מדגמית."
      : "\n\n> **Warning:** The source marked this result as truncated or sampled.";
  }
  return answer;
}

function safetyRiskDisplay(value, hebrew) {
  const normalized = String(value || "").trim().toLowerCase();
  const labels = hebrew
    ? { low: "נמוכה", medium: "בינונית", high: "גבוהה", unknown: "לא ידוע", other: "אחר" }
    : { low: "Low", medium: "Medium", high: "High", unknown: "Unknown", other: "Other" };
  return labels[normalized] || value;
}

function safetyGroupLabel(field, hebrew) {
  const labels = hebrew
    ? {
        risk_level: "רמת סיכון קנונית",
        site_grade: "ציון שמור",
        site_location: "ערך אתר שמור",
        item_status: "סטטוס פריט שמור",
        period: "תקופה"
      }
    : {
        risk_level: "canonical risk level",
        site_grade: "stored grade",
        site_location: "stored site value",
        item_status: "stored item status",
        period: "period"
      };
  return labels[field] || escapeInvoiceDisplayValue(field);
}

function safetyDefectMetricLabel(alias, hebrew) {
  const labels = hebrew
    ? {
        life_threatening_defects_total: "מסכני חיים",
        severe_defects_total: "חמורים",
        medium_defects_total: "בינוניים",
        minor_defects_total: "קלים"
      }
    : {
        life_threatening_defects_total: "Life-threatening",
        severe_defects_total: "Severe",
        medium_defects_total: "Medium",
        minor_defects_total: "Minor"
      };
  return labels[alias] || null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  );
  return results;
}

function exactInvoiceLookupOperation(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    call.data?.routing?.domain === "content_structured_lookup" &&
    Array.isArray(call.data?.plans)
  );
  if (!dataQueryCall) return null;
  const operations = [...new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "financial_transactions" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.operation))];
  return operations.length === 1 ? operations[0] : null;
}

export function exactInvoiceLookupProjectScope(toolCalls = [], config = {}) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    call.data?.routing?.domain === "content_structured_lookup" &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "financial_transactions" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  const callerProjectId = String(dataQueryCall?.data?.caller?.projectId || "").trim();
  const configuredProjectId = String(config?.projectId || "").trim();
  if (!callerProjectId && !configuredProjectId) {
    return { ok: true, projectId: null };
  }
  const normalizedCallerProjectId = normalizeExactProjectId(callerProjectId);
  const normalizedConfiguredProjectId = normalizeExactProjectId(configuredProjectId);
  if (
    !normalizedCallerProjectId ||
    (configuredProjectId && !normalizedConfiguredProjectId) ||
    (normalizedConfiguredProjectId && normalizedConfiguredProjectId !== normalizedCallerProjectId)
  ) {
    return { ok: false, projectId: null };
  }
  return { ok: true, projectId: normalizedCallerProjectId };
}

export function exactInvoiceLookupProjectId(toolCalls = [], config = {}) {
  const scope = exactInvoiceLookupProjectScope(toolCalls, config);
  return scope.ok ? scope.projectId : null;
}

export function exactInvoiceAttachmentProjectId(callerProjectId, financialProjectId) {
  const normalizedFinancialProjectId = normalizeExactProjectId(financialProjectId);
  if (!normalizedFinancialProjectId) return null;
  const rawCallerProjectId = String(callerProjectId || "").trim();
  if (!rawCallerProjectId) return normalizedFinancialProjectId;
  const normalizedCallerProjectId = normalizeExactProjectId(rawCallerProjectId);
  return normalizedCallerProjectId === normalizedFinancialProjectId
    ? normalizedFinancialProjectId
    : null;
}

function normalizeExactProjectId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function exactInvoiceLookupRecords(toolCalls = []) {
  const dataQueryCall = toolCalls.find((call) =>
    call?.toolName === "data_query" &&
    call.ok &&
    call.data?.routing?.domain === "content_structured_lookup" &&
    Array.isArray(call.data?.plans) &&
    call.data.plans.some((plan) =>
      plan?.table === "financial_transactions" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
  );
  if (!dataQueryCall) return [];

  const invoicePlanIds = new Set(dataQueryCall.data.plans
    .filter((plan) =>
      plan?.table === "financial_transactions" &&
      ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(plan?.operation)
    )
    .map((plan) => plan.id)
    .filter(Boolean));
  return Object.values(dataQueryCall.data?.machineResult?.recordsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => !value?.planId || invoicePlanIds.has(value.planId))
    .sort((left, right) => Number(left?.ordinal || 0) - Number(right?.ordinal || 0))
    .map((value) => value?.record && typeof value.record === "object" ? value.record : null)
    .filter((record) => record && record.id !== null && record.id !== undefined && record.id !== "");
}

export function buildDeterministicInvoiceAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  exactRecords = [],
  enrichments = [],
  conflicts = []
} = {}) {
  if (!isDeterministicFinancialTransactionTypeCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  if (!dataQueryCall?.data) return null;
  const hebrew = isHebrew(message);
  let answer = null;
  if (routing.intent === "lookup") {
    answer = formatDeterministicInvoiceLookup({
      operation: routing.lookup?.operation,
      records: exactRecords.length ? exactRecords : exactInvoiceLookupRecords(toolCalls),
      enrichments,
      financialType: routing.lookup?.financialType,
      allRequested: routing.lookup?.allRequested === true,
      data: dataQueryCall.data,
      hebrew
    });
  } else if (routing.intent === "metrics") {
    answer = formatDeterministicInvoiceMetrics({
      data: dataQueryCall.data,
      financialType: routing.metricScope?.financialType,
      hebrew
    });
  }
  return answer ? appendConflictWarnings(answer, conflicts, { hebrew }) : null;
}

export function buildDeterministicFinancialDocumentAnswer({
  message = "",
  routing = null,
  toolCalls = [],
  conflicts = []
} = {}) {
  if (!isDeterministicFinancialDocumentMetricCapability(routing)) return null;
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query" && call.ok);
  if (!dataQueryCall?.data) return null;
  const hebrew = isHebrew(message);
  const answer = formatDeterministicFinancialDocumentMetrics({
    data: dataQueryCall.data,
    hebrew
  });
  return answer ? appendConflictWarnings(answer, conflicts, { hebrew }) : null;
}

export function buildDeterministicFinancialDataQueryFailureAnswer({
  message = "",
  routing = null,
  toolCalls = []
} = {}) {
  if (
    !isDeterministicFinancialTransactionTypeCapability(routing) &&
    !isDeterministicFinancialDocumentMetricCapability(routing)
  ) {
    return null;
  }
  const dataQueryCall = toolCalls.find((call) => call?.toolName === "data_query");
  if (dataQueryCall?.ok === true) return null;
  const hebrew = isHebrew(message);
  return hebrew
    ? "לא הצלחתי להשלים את השליפה המדויקת מטבלת המסמכים הפיננסיים. כדי לא להציג רשימה חלקית או ספירה לא נכונה, לא השתמשתי בתוצאות החיפוש הסמנטי כתחליף. אפשר לנסות שוב לאחר בדיקת מסלול ה-Data Query."
    : "I could not complete the exact query against the financial-documents table. To avoid showing a partial list or an incorrect count, I did not substitute semantic-search results. Please retry after the Data Query route is checked.";
}

function formatDeterministicFinancialDocumentMetrics({ data = {}, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : [])
    .find((item) => item?.table === "financial_transactions");
  if (!plan || !["count", "group_count"].includes(plan.operation)) return null;
  const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
  let answer;
  if (plan.operation === "count") {
    const count = Number(metrics.find((metric) => metric.operation === "count")?.value);
    if (!Number.isFinite(count)) return null;
    answer = hebrew
      ? `במערכת נמצאו **${formatInvoiceNumber(count)} מסמכים פיננסיים**${scope}.`
      : `The system contains **${formatInvoiceNumber(count)} financial documents**${scope}.`;
  } else {
    const groupField = plan.groupBy?.[0] || Object.keys(metrics[0]?.group || {})[0] || "transaction_type";
    const groupedValues = new Map();
    for (const metric of metrics) {
      const rawLabel = firstPresent(...Object.values(metric.group || {}), hebrew ? "לא צוין" : "Not specified");
      const financialType = groupField === "transaction_type"
        ? dataQueryFinancialTypeForStoredValue(rawLabel)
        : null;
      const label = financialType
        ? (hebrew ? financialType.hebrewSingular : financialType.englishSingular)
        : rawLabel;
      const value = Number(metric.value);
      if (!Number.isFinite(value)) continue;
      groupedValues.set(label, (groupedValues.get(label) || 0) + value);
    }
    const groups = [...groupedValues.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value || String(left.label).localeCompare(String(right.label)));
    if (!groups.length) return null;
    const total = groups.reduce((sum, item) => sum + item.value, 0);
    const groupLabel = financialDocumentGroupLabel(groupField, hebrew);
    const heading = hebrew
      ? `במערכת נמצאו **${formatInvoiceNumber(total)} מסמכים פיננסיים**${scope}. להלן הפילוח לפי ${groupLabel}:`
      : `The system contains **${formatInvoiceNumber(total)} financial documents**${scope}. Breakdown by ${groupLabel}:`;
    const lines = groups.map((item) =>
      `- **${escapeInvoiceDisplayValue(item.label)}:** ${formatInvoiceNumber(item.value)}`
    );
    answer = `${heading}\n\n${lines.join("\n")}`;
  }
  const planStatuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  if (planStatuses.some((item) => item.truncated || item.sampled)) {
    answer += hebrew
      ? "\n\n> **אזהרה:** תוצאת המקור סומנה כחלקית או מדגמית."
      : "\n\n> **Warning:** The source marked this result as truncated or sampled.";
  }
  return answer;
}

function financialDocumentGroupLabel(field, hebrew) {
  const labels = hebrew
    ? {
        transaction_type: "סוג המסמך השמור",
        status: "הסטטוס השמור",
        currency: "המטבע השמור"
      }
    : {
        transaction_type: "the stored document type",
        status: "the stored status",
        currency: "the stored currency"
      };
  return labels[field] || (hebrew
    ? `הערך השמור בשדה ${escapeInvoiceDisplayValue(field)}`
    : `the stored ${escapeInvoiceDisplayValue(field)} value`);
}

function financialTransactionTypeDisplay(financialType, hebrew, plural = false) {
  if (hebrew) {
    return firstPresent(
      plural ? financialType?.hebrewPlural : financialType?.hebrewSingular,
      plural ? "חשבוניות" : "חשבונית"
    );
  }
  return firstPresent(
    plural ? financialType?.englishPlural : financialType?.englishSingular,
    plural ? "invoices" : "invoice"
  );
}

function formatDeterministicInvoiceLookup({
  operation,
  records = [],
  enrichments = [],
  financialType = null,
  allRequested = false,
  data = {},
  hebrew = false
}) {
  const singularType = financialTransactionTypeDisplay(financialType, hebrew, false);
  const pluralType = financialTransactionTypeDisplay(financialType, hebrew, true);
  const invoiceType = !financialType || financialType.key === "invoice";
  if (!records.length) {
    return hebrew
      ? `לא נמצאו **${escapeInvoiceDisplayValue(pluralType)}** התואמים לבקשה.`
      : `No **${escapeInvoiceDisplayValue(pluralType)}** matched the request.`;
  }
  const enrichmentById = new Map(enrichments.map((item) => [String(item.recordId), item]));
  const items = records.map((record) => {
    const enrichment = enrichmentById.get(String(record.id)) || {};
    const storedTransactionType = firstPresent(enrichment.transactionType, record.transaction_type);
    const canonicalTransactionType = dataQueryFinancialTypeForStoredValue(storedTransactionType);
    return {
      recordId: record.id,
      transactionDate: firstPresent(enrichment.transactionDate, record.transaction_date),
      vendorName: firstPresent(enrichment.vendorName, record.vendor_name),
      amount: enrichment.amount || null,
      currency: firstPresent(enrichment.currency, record.currency),
      status: firstPresent(enrichment.status, record.status, record.item_status),
      transactionType: canonicalTransactionType
        ? (hebrew ? canonicalTransactionType.hebrewSingular : canonicalTransactionType.englishSingular)
        : storedTransactionType,
      category: enrichment.category || null,
      topic: enrichment.topic || null,
      summary: enrichment.summary || null,
      documentUrl: enrichment.documentUrl || null
    };
  });
  const labels = hebrew
    ? {
        latest: invoiceType ? "החשבונית האחרונה" : `הרשומה האחרונה מסוג ${singularType}`,
        earliest: invoiceType ? "החשבונית הראשונה" : `הרשומה הראשונה מסוג ${singularType}`,
        list: invoiceType
          ? `נמצאו ${items.length} החשבוניות האחרונות, לפי סדר כרונולוגי יורד:`
          : `נמצאו ${items.length} ${pluralType}, לפי סדר כרונולוגי יורד:`,
        date: "תאריך",
        vendor: "ספק",
        amount: "סכום",
        status: "סטטוס",
        type: "סוג",
        category: "קטגוריה",
        title: "כותרת",
        summary: "תיאור",
        recordId: "מזהה רשומה",
        document: "מסמך",
        openDocument: invoiceType ? "פתיחת מסמך החשבונית" : "פתיחת המסמך הפיננסי",
        missingDocument: "לא היה קישור מאומת למסמך בתוצאת השליפה"
      }
    : {
        latest: invoiceType ? "Latest invoice" : `Latest ${singularType}`,
        earliest: invoiceType ? "Earliest invoice" : `Earliest ${singularType}`,
        list: invoiceType
          ? `These are the ${items.length} latest invoices, in descending chronological order:`
          : `Found ${items.length} ${pluralType}, in descending chronological order:`,
        date: "Date",
        vendor: "Supplier",
        amount: "Amount",
        status: "Status",
        type: "Type",
        category: "Category",
        title: "Title",
        summary: "Description",
        recordId: "Record ID",
        document: "Document",
        openDocument: invoiceType ? "Open invoice document" : "Open financial document",
        missingDocument: "No verified document link was available in the retrieved result"
      };
  const plan = (Array.isArray(data.plans) ? data.plans : []).find((item) =>
    item?.table === "financial_transactions" &&
    ["lookup_latest", "lookup_earliest", "lookup_last_n"].includes(item?.operation)
  );
  const total = Number(plan?.cardinality);
  if (allRequested && Number.isFinite(total)) {
    labels.list = hebrew
      ? total > items.length
        ? `נמצאו **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**. מוצגות ${items.length} הרשומות העדכניות ביותר, לפי סדר כרונולוגי יורד:`
        : `נמצאו **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**, לפי סדר כרונולוגי יורד:`
      : total > items.length
        ? `Found **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**. Showing the ${items.length} most recent records in descending chronological order:`
        : `Found **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**, in descending chronological order:`;
  }
  const single = items.length === 1;
  const heading = single
    ? operation === "lookup_earliest" ? labels.earliest : labels.latest
    : labels.list;
  const blocks = items.map((item, index) => {
    const amount = item.amount
      ? [item.amount, item.currency].filter(Boolean).join(" ")
      : null;
    const fields = [
      [labels.date, formatInvoiceDate(item.transactionDate)],
      [labels.vendor, item.vendorName],
      [labels.amount, amount],
      [labels.status, item.status],
      [labels.type, item.transactionType],
      [labels.category, item.category],
      [labels.title, item.topic],
      [labels.summary, item.summary],
      [labels.recordId, item.recordId]
    ]
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([label, value]) => `- **${label}:** ${escapeInvoiceDisplayValue(value)}`);
    fields.push(item.documentUrl
      ? `- **${labels.document}:** [${labels.openDocument}](<${item.documentUrl}>)`
      : `- **${labels.document}:** ${labels.missingDocument}`);
    if (single) return fields.join("\n");
    const itemTitle = firstPresent(item.topic, item.vendorName, `${singularType} ${index + 1}`);
    return `### ${index + 1}. ${escapeInvoiceDisplayValue(itemTitle)}\n\n${fields.join("\n")}`;
  });
  let answer = single
    ? `## ${heading}\n\n${blocks[0]}`
    : `${heading}\n\n${blocks.join("\n\n")}`;
  if (allRequested && (plan?.truncated === true || (Number.isFinite(total) && total > items.length))) {
    answer += hebrew
      ? `\n\n> **הערת שלמות:** קיימות ${formatInvoiceNumber(total)} רשומות תואמות, אך תשובה זו מוגבלת ל-${items.length}. הנתונים המוצגים מדויקים; הרשימה אינה מלאה.`
      : `\n\n> **Completeness note:** ${formatInvoiceNumber(total)} records match, but this response is limited to ${items.length}. The displayed records are exact; the list is incomplete.`;
  }
  return answer;
}

function formatDeterministicInvoiceMetrics({ data = {}, financialType = null, hebrew = false }) {
  const machineResult = data.machineResult || {};
  const metrics = Object.values(machineResult.metricsByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const plan = (Array.isArray(data.plans) ? data.plans : [])
    .find((item) => item?.table === "financial_transactions");
  if (!plan || !metrics.length) return null;
  const planStatuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((value) => Array.isArray(value) ? value : []);
  const pluralType = financialTransactionTypeDisplay(financialType, hebrew, true);
  const invoiceType = !financialType || financialType.key === "invoice";
  let answer;
  if (plan.operation === "count") {
    const count = Number(metrics.find((metric) => metric.operation === "count")?.value);
    if (!Number.isFinite(count)) return null;
    const scope = formatInvoiceDateScope(data.caller || {}, hebrew);
    answer = hebrew
      ? invoiceType
        ? `במערכת נמצאו **${formatInvoiceNumber(count)} חשבוניות**${scope}.`
        : `במערכת נמצאו **${formatInvoiceNumber(count)} ${escapeInvoiceDisplayValue(pluralType)}**${scope}.`
      : `The system contains **${formatInvoiceNumber(count)} ${escapeInvoiceDisplayValue(pluralType)}**${scope}.`;
  } else if (plan.operation === "group_count") {
    const groups = metrics
      .map((metric) => ({
        label: firstPresent(...Object.values(metric.group || {}), hebrew ? "לא צוין" : "Not specified"),
        value: Number(metric.value)
      }))
      .filter((item) => Number.isFinite(item.value))
      .sort((left, right) => right.value - left.value || String(left.label).localeCompare(String(right.label)));
    if (!groups.length) return null;
    const total = groups.reduce((sum, item) => sum + item.value, 0);
    const groupField = Object.keys(metrics[0]?.group || {})[0] || "status";
    const heading = hebrew
      ? invoiceType
        ? `במערכת נמצאו **${formatInvoiceNumber(total)} חשבוניות**. להלן הפילוח לפי הערך השמור בשדה ${escapeInvoiceDisplayValue(groupField)}:`
        : `במערכת נמצאו **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**. להלן הפילוח לפי הערך השמור בשדה ${escapeInvoiceDisplayValue(groupField)}:`
      : `The system contains **${formatInvoiceNumber(total)} ${escapeInvoiceDisplayValue(pluralType)}**. Breakdown by the stored ${escapeInvoiceDisplayValue(groupField)} value:`;
    const lines = groups.map((item) =>
      `- **${escapeInvoiceDisplayValue(item.label)}:** ${formatInvoiceNumber(item.value)}`
    );
    answer = `${heading}\n\n${lines.join("\n")}`;
  } else {
    return null;
  }
  const precisionWarnings = planStatuses.filter((item) => item.truncated || item.sampled);
  if (precisionWarnings.length) {
    answer += hebrew
      ? "\n\n> **אזהרה:** תוצאת המקור סומנה כחלקית או מדגמית."
      : "\n\n> **Warning:** The source marked this result as truncated or sampled.";
  }
  return answer;
}

function formatInvoiceDateScope(caller = {}, hebrew = false) {
  const from = formatInvoiceDate(caller.dateFrom);
  const to = formatInvoiceDate(caller.dateTo);
  if (from && to) return hebrew ? ` בין **${from}** ל-**${to}**` : ` between **${from}** and **${to}**`;
  if (from) return hebrew ? ` החל מ-**${from}**` : ` from **${from}**`;
  if (to) return hebrew ? ` עד **${to}**` : ` through **${to}**`;
  return "";
}

function formatInvoiceNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(value));
}

function formatExceptionCurrency(value, hebrew = false) {
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value));
  return DATA_QUERY_EXCEPTION_CURRENCY === "ILS"
    ? (hebrew ? `${amount} ₪` : `₪${amount}`)
    : `${amount} ${DATA_QUERY_EXCEPTION_CURRENCY}`;
}

export function appendConflictWarnings(answer, conflicts = [], { hebrew = false } = {}) {
  const value = String(answer || "").trim();
  if (!value || !Array.isArray(conflicts) || !conflicts.length) return value;
  const heading = hebrew ? "סתירות אפשריות" : "Possible conflicts";
  const prefix = hebrew
    ? "המקורות כוללים אינדיקציות סותרות בנושאים הבאים:"
    : "The sources contain conflicting indications about:";
  const labels = [...new Set(conflicts.map((conflict) => conflict?.label || conflict?.type).filter(Boolean))];
  if (!labels.length) return value;
  return `${value}\n\n> **${heading}:** ${prefix} ${labels.map(escapeInvoiceDisplayValue).join(", ")}.`;
}

export function sanitizeCustomerFacingAnswer(answer = "", { hebrew = false } = {}) {
  const replacements = hebrew
    ? [
        [/Data Query לא מצא/gi, "לא נמצאה"],
        [/Data Query מצא/gi, "נמצאו"],
        [/Data Query Agent/gi, "המידע הזמין בפרויקט"],
        [/Data Query/gi, "המידע הזמין בפרויקט"],
        [/Main Agent/gi, "מערכת המענה"],
        [/Hybrid Search/gi, "חיפוש במסמכי הפרויקט"],
        [/Project Graph Search/gi, "מידע מקושר מהפרויקט"],
        [/Reranker/gi, "בדיקת רלוונטיות"]
      ]
    : [
        [/Data Query found no/gi, "No"],
        [/Data Query found/gi, "The available project information contains"],
        [/Data Query Agent/gi, "the available project information"],
        [/Data Query/gi, "the available project information"],
        [/Main Agent/gi, "the response service"],
        [/Hybrid Search/gi, "project-document search"],
        [/Project Graph Search/gi, "related project information"],
        [/Reranker/gi, "relevance review"]
      ];
  return replacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(answer || "")
  )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function appendExactInvoiceEnrichment(answer, enrichment) {
  const value = String(answer || "").trim();
  if (!enrichment) return value;
  const hebrew = isHebrew(value);
  const labels = hebrew
    ? {
        heading: "פרטי החשבונית",
        date: "תאריך",
        vendor: "ספק",
        amount: "סכום",
        status: "סטטוס",
        type: "סוג",
        category: "קטגוריה",
        description: "תיאור",
        document: "פתיחת מסמך החשבונית"
      }
    : {
        heading: "Invoice details",
        date: "Date",
        vendor: "Supplier",
        amount: "Amount",
        status: "Status",
        type: "Type",
        category: "Category",
        description: "Description",
        document: "Open invoice document"
      };
  const amount = enrichment.amount
    ? [enrichment.amount, enrichment.currency].filter(Boolean).join(" ")
    : null;
  const description = firstPresent(enrichment.topic, enrichment.summary);
  const lines = [
    [labels.date, formatInvoiceDate(enrichment.transactionDate)],
    [labels.vendor, enrichment.vendorName],
    [labels.amount, amount],
    [labels.status, enrichment.status],
    [labels.type, enrichment.transactionType],
    [labels.category, enrichment.category],
    [labels.description, description]
  ]
    .filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined && fieldValue !== "")
    .map(([label, fieldValue]) => `- **${label}:** ${escapeInvoiceDisplayValue(fieldValue)}`);
  if (enrichment.documentUrl) {
    lines.push(`- **${labels.document}:** [${labels.document}](<${enrichment.documentUrl}>)`);
  }
  if (!lines.length) return value;
  return `${value}\n\n### ${labels.heading}\n\n${lines.join("\n")}`.trim();
}

function firstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== "") ?? null;
}

function invoiceAmountDisplay(row) {
  const numeric = firstPresent(row?.amount_numeric);
  if (numeric !== null) return String(numeric).trim();
  const sourceText = firstPresent(row?.total);
  return sourceText === null ? null : String(sourceText).trim();
}

function normalizeInvoiceDocumentUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function formatInvoiceDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : raw;
}

function escapeInvoiceDisplayValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)
    .replace(/[\\`*_[\]<>]/g, "\\$&");
}

const EXPLICIT_APPROVAL_POSITIVE_RE = /(?:\bapproved\b|\bapproval\s+(?:was\s+)?granted\b|אושר(?:ה|ו)?|מאושר(?:ת|ים|ות)?|אישר(?:ה|ו)?|(?:התקבל|ניתן|קיבל)\s+אישור)/i;
const EXPLICIT_APPROVAL_NEGATIVE_RE = /(?:\bnot\s+approved\b|\b(?:unapproved|rejected|denied)\b|\b(?:pending|awaiting)\s+approval\b|\bapproval\s+(?:is\s+)?required\b|לא\s+אושר|טרם\s+אושר|אינ(?:ו|ה|ם|ן)\s+מאושר|לא\s+התקבל\s+אישור|ממתינ(?:ה|ים|ות)?\s+לאישור|נדרש(?:ת)?\s+אישור|דרוש(?:ה)?\s+אישור|בקשת\s+אישור|נדח(?:ה|ו))/i;
const EXCEPTION_APPROVAL_CONTEXT_RE = /(?:\bexception(?:s|\s+report(?:s)?)?\b|חריג(?:ה|ים|ות)?)/i;
const EXCEPTION_APPROVAL_PAID_RE = /(?:\bpaid\b|\bpayment\s+(?:was\s+)?made\b|שול(?:ם|מה|מו))/i;
const EXCEPTION_APPROVAL_PARTIAL_RE = /(?:\bnot\s+(?:in\s+full|100\s*%)\b|\bpartial(?:ly)?\b|\b(?:completion|performance)\s+percent(?:age)?s?\b|לא\s*100\s*%|לא\s+במלוא(?:ו|ה|ם)?|לפי\s+(?:ה)?שיעור(?:י)?\s+ביצוע|שיעור(?:י)?\s+ביצוע|חלקי(?:ת|ים|ות)?)/i;

function exceptionApprovalFacts(row = {}) {
  const title = String(row?.title || row?.metadata?.title || "").normalize("NFKC");
  const titleHasExceptionContext = EXCEPTION_APPROVAL_CONTEXT_RE.test(title);
  const text = [
    title,
    row?.content,
    row?.index_text,
    row?.summary,
    row?.text,
    row?.chunk,
    row?.page_content,
    row?.document,
    row?.metadata?.title,
    row?.metadata?.text,
    row?.metadata?.content
  ]
    .filter(Boolean)
    .join("\n")
    .normalize("NFKC");
  const matchingParts = text
    .split(/[\n.!?;]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) =>
      EXPLICIT_APPROVAL_POSITIVE_RE.test(part) &&
      !EXPLICIT_APPROVAL_NEGATIVE_RE.test(part) &&
      (titleHasExceptionContext || EXCEPTION_APPROVAL_CONTEXT_RE.test(part))
    );
  if (!matchingParts.length) return null;
  const relevantText = matchingParts.join(" ");
  return {
    paid: EXCEPTION_APPROVAL_PAID_RE.test(relevantText),
    partial: EXCEPTION_APPROVAL_PARTIAL_RE.test(relevantText)
  };
}

function describeExceptionApprovalFacts(facts = {}, hebrew = false) {
  if (hebrew) {
    if (facts.paid && facts.partial) return "המסמך מציין כי החריגים המופיעים בו אושרו ושולמו לפי שיעורי הביצוע, ולא במלואם.";
    if (facts.paid) return "המסמך מציין כי החריגים המופיעים בו אושרו ושולמו.";
    if (facts.partial) return "המסמך מציין כי החריגים המופיעים בו אושרו באופן חלקי או לפי שיעורי הביצוע.";
    return "המסמך מציין כי החריגים המופיעים בו אושרו.";
  }
  if (facts.paid && facts.partial) return "The document states that the listed exceptions were approved and paid according to the recorded completion percentages, rather than in full.";
  if (facts.paid) return "The document states that the listed exceptions were approved and paid.";
  if (facts.partial) return "The document states that the listed exceptions were approved partially or according to recorded completion percentages.";
  return "The document states that the listed exceptions were approved.";
}

export function buildExceptionApprovalFallbackAnswer({
  message = "",
  routing = null,
  retrievalResults = null,
  config = null
} = {}) {
  if (!isExceptionCountApprovalMixedCapability(routing)) return "";
  const hebrew = isHebrew(message);
  const evidence = [];
  const seen = new Set();
  for (const row of normalizeRows(retrievalResults)) {
    const facts = exceptionApprovalFacts(row);
    if (!facts) continue;
    const source = extractLinks([row], config)[0] || null;
    const title = escapeInvoiceDisplayValue(source?.title || row?.title || row?.summary || "");
    if (!title) continue;
    const key = String(source?.url || title).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    evidence.push({ title, url: source?.url || "", date: source?.date || "", facts });
    if (evidence.length >= 5) break;
  }

  const boundary = hebrew
    ? "> ייתכן שקיימים אישורים נוספים שלא תועדו במסמכים שנבדקו. כמה מסמכים עשויים להתייחס לאותו חריג, ולכן אין להסיק ממספר המסמכים כמה חריגים אושרו."
    : "> Additional approvals may exist without documentation in the reviewed sources. Multiple documents may refer to the same exception, so the document count must not be interpreted as the number of approved exceptions.";
  if (!evidence.length) {
    return hebrew
      ? `**אישורים מתועדים:** לא נמצא במסמכים שנבדקו תיעוד מפורש הקושר אישור לחריג.\n\n${boundary}`
      : `**Documented approvals:** The reviewed documents did not contain an explicit record tying approval to an exception.\n\n${boundary}`;
  }

  const heading = hebrew
    ? evidence.length === 1
      ? "**אישורים מתועדים:** נמצא מסמך אחד המתעד במפורש אישור של חריג:"
      : `**אישורים מתועדים:** נמצאו ${evidence.length} מסמכים המתעדים במפורש אישור של חריג:`
    : evidence.length === 1
      ? "**Documented approvals:** One document explicitly records approval of an exception:"
      : `**Documented approvals:** ${evidence.length} documents explicitly record approval of an exception:`;
  const items = evidence.map((item) => {
    const date = item.date ? ` (${escapeInvoiceDisplayValue(item.date)})` : "";
    const sourceLabel = item.url
      ? `- [${item.title}${date}](${item.url})`
      : `- ${item.title}${date}`;
    return `${sourceLabel} — ${describeExceptionApprovalFacts(item.facts, hebrew)}`;
  });
  return `${heading}\n\n${items.join("\n")}\n\n${boundary}`;
}

// Last-resort answer used only when the main LLM synthesis call itself fails
// (missing key, timeout, provider error). Renders deterministic Data Query
// facts plus sanitized, deduplicated document links — never retrieved excerpts,
// raw row/tool-call objects, contact details, or provider error strings.
function safeFallbackSourceTitle(value, hebrew = false) {
  const contactPlaceholder = hebrew ? "פרטי קשר הוסרו" : "Contact details removed";
  const sourcePlaceholder = hebrew ? "מסמך מהפרויקט" : "Project document";
  const sanitized = String(value || "")
    .normalize("NFKC")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, contactPlaceholder)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "")
    .replace(/[|]+/g, " · ")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return escapeInvoiceDisplayValue(sanitized || sourcePlaceholder);
}

function safeFallbackSources({ sources = [], retrievalResults = null, config = null, hebrew = false } = {}) {
  const retrievedSources = extractLinks(normalizeRows(retrievalResults), config);
  return uniqueByUrl([...(Array.isArray(sources) ? sources : []), ...retrievedSources])
    .map((source) => ({
      title: safeFallbackSourceTitle(source?.title || source?.label || source?.name, hebrew),
      url: normalizeInvoiceDocumentUrl(source?.url)
    }))
    .filter((source) => source.title && source.url)
    .slice(0, 5);
}

export function fallbackRagAnswer({ successful = [], failed = [], skipped = [], sources = [], message = "", retrievalResults = null, config = null }) {
  const dataQueryRouting = successful
    .find((call) => call?.toolName === "data_query" && call?.ok)
    ?.data?.routing || null;
  const exceptionApprovalFallback = buildExceptionApprovalFallbackAnswer({
    message,
    routing: dataQueryRouting,
    retrievalResults,
    config
  });
  if (exceptionApprovalFallback) return exceptionApprovalFallback;

  const hebrew = isHebrew(message);
  const exactSections = successful
    .filter((call) => call?.toolName === "data_query" && call?.ok)
    .map(dataQueryFallbackSection)
    .filter(Boolean);
  const safeSources = safeFallbackSources({ sources, retrievalResults, config, hebrew });
  const sourceItems = safeSources.map((source) => `- [${source.title}](<${source.url}>)`);
  const hasExactFacts = exactSections.length > 0;
  if (hebrew) {
    return [
      "**לא ניתן היה להשלים כרגע תשובה מהימנה.**",
      hasExactFacts
        ? "המידע המאומת שניתן להציג מופיע להלן. עיבוד התוכן הנוסף לא הושלם, ולכן לא נוספה מסקנה משוערת."
        : "נמצאו מקורות שעשויים להיות רלוונטיים, אך עיבוד התוכן לא הושלם. כדי להימנע מהצגת טקסט גולמי או מסקנה לא מבוססת, לא מוצג סיכום משוער.",
      exactSections.length ? `\n${exactSections.join("\n\n")}` : "",
      sourceItems.length ? `\n**מסמכים שעשויים להיות רלוונטיים:**\n\n${sourceItems.join("\n")}` : "",
      "\n> אפשר לנסות שוב מאוחר יותר. טקסט גולמי, פרטי קשר ושלבי עיבוד פנימיים אינם מוצגים."
    ].filter(Boolean).join("\n").trim();
  }
  return [
    "**A reliable answer could not be completed right now.**",
    hasExactFacts
      ? "The verified information available for display appears below. Additional content processing did not complete, so no estimated conclusion was added."
      : "Potentially relevant sources were found, but content processing did not complete. To avoid showing raw text or an unsupported conclusion, no estimated summary is displayed.",
    exactSections.length ? `\n${exactSections.join("\n\n")}` : "",
    sourceItems.length ? `\n**Potentially relevant documents:**\n\n${sourceItems.join("\n")}` : "",
    "\n> Please try again later. Raw excerpts, contact details, and internal processing stages are not displayed."
  ].filter(Boolean).join("\n").trim();
}

function liteFallback(message) {
  if (!isHebrew(message)) return "Hello, I am the bidoc.ai AI assistant. How can I help?";
  return "שלום! אני עוזר ה-AI של bidoc.ai. במה אוכל לסייע?";
}

function summarizeData(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  if (!text || text === "null") return "לא הוחזר מידע.";
  return text.length > 450 ? `${text.slice(0, 450)}...` : text;
}

function formatRetrievalContext(results, limit = 12, chunkTextLimit = 1800, config = null) {
  const rows = normalizeRows(results).slice(0, limit);
  if (!rows.length) return "No vector records returned.";
  return rows
    .map((row, index) => {
      const text =
        row.content ||
        row.index_text ||
        row.summary ||
        row.title ||
        row.text ||
        row.chunk ||
        row.page_content ||
        row.document ||
        row.metadata?.text ||
        row.metadata?.content ||
        JSON.stringify(row);
      const metadata = row.metadata ? `\nmetadata: ${JSON.stringify(row.metadata)}` : "";
      const score = row.similarity || row.score || row.distance || row.match_score || "";
      // Fall back to an internal bidoc "view in app" link (buildInternalSourceUrl)
      // when the record has no external URL of its own, so the main agent always
      // has *something* real to cite instead of leaving a bracket with no link.
      const sourceUrl = row.source_url || row.url || row.link || row.data_link || row.metadata?.source_url || row.metadata?.url || buildInternalSourceUrl(config, row) || "";
      const source = sourceUrl ? `\nsource_url: ${sourceUrl}` : "\nsource_url: unavailable";
      return `[${index + 1}] score: ${score}\n${String(text).slice(0, Number(chunkTextLimit || 1800))}${metadata}${source}`;
    })
    .join("\n\n---\n\n");
}

function normalizeRows(results) {
  if (Array.isArray(results)) return results;
  if (Array.isArray(results?.data)) return results.data;
  if (Array.isArray(results?.matches)) return results.matches;
  if (Array.isArray(results?.documents)) return results.documents;
  if (results && typeof results === "object") return [results];
  return [];
}

function filterRowsByHashtags(results, requestedHashtags) {
  const requested = normalizeTagList(requestedHashtags);
  if (!requested.length) return results;
  const rows = normalizeRows(results);
  if (!rows.length) return results;
  const rowsWithHashtags = rows.filter((row) => normalizeTagList(row.hashtags || row.metadata?.hashtags).length);
  if (!rowsWithHashtags.length) return results;
  const filtered = rows.filter((row) => {
    const rowTags = normalizeTagList(row.hashtags || row.metadata?.hashtags);
    return requested.some((tag) => rowTags.includes(tag));
  });
  return filtered.length ? filtered : rows;
}

function normalizeTagList(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return [...new Set(
    raw
      .map((tag) => String(tag || "").trim().replace(/^#+/, "").toLowerCase())
      .filter(Boolean)
  )];
}

function buildDateFilter(classification) {
  if (!classification.date_from && !classification.date_to) return "";
  return [classification.date_from, classification.date_to].filter(Boolean).join(" - ");
}

function uniqueByUrl(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function buildWorkflowLog({ message, sanitized, saved, memory, memorySummary, classification, result, trace, config, openRouterCalls = [], memoryWrite = null }) {
  const toolCalls = result.toolCalls || [];
  const hybridCall = toolCalls.find((call) => call.toolName === "hybrid_search");
  const graphCall = toolCalls.find((call) => call.toolName === "graph_search");
  const rerankerCall = toolCalls.find((call) => call.toolName === "reranker");
  const alertCall = toolCalls.find((call) => call.toolName === "alert");
  const dataQueryCall = toolCalls.find((call) => call.toolName === "data_query");
  const retrievalToolNames = ["hybrid_search", "hybrid_search_plan", "graph_search", "reranker"];
  const safetyPrecheckCalls = classification.urgency === "HIGH"
    ? toolCalls.filter((call) => ["safety_report", "alert"].includes(call.toolName))
    : [];
  const safetyReportPrecheckCalls = safetyPrecheckCalls.filter((call) => call.toolName !== "alert");
  const alertRanInSafetyPrecheck = Boolean(alertCall && safetyPrecheckCalls.includes(alertCall));
  const safetyPrecheckNames = new Set(safetyPrecheckCalls.map((call) => call.toolName));
  const n8nCalls = toolCalls.filter((call) => !["alert", "data_query"].includes(call.toolName) && !retrievalToolNames.includes(call.toolName) && !safetyPrecheckNames.has(call.toolName));
  const isChat = classification.type === "CHAT";
  const knowledgePlan = result.knowledgePlan || null;
  const nodes = [
    workflowNode("chat_input", "Chat Trigger", "trigger", "done", { message }, { session_id: saved.session_id }),
    workflowNode("sanitize", "Sanitize Message", "code", "done", { message }, { sanitized }),
    workflowNode("save_message", "Save Message", "database", "done", {
      user_message: message,
      sanitized_message: sanitized
    }, {
      table: "chat_messages_gf",
      id: saved.id,
      status: saved.status
    }),
    workflowNode("classifier", "Smart Classifier", "ai", "done", { sanitized }, classification),
    workflowNode("knowledge_vocabulary", "Knowledge Vocabulary", "router", classification.knowledge_vocabulary_match ? "done" : "skipped", {
      message: sanitized,
      trigger_keywords: config.knowledge?.triggerKeywords || []
    }, {
      checked: Boolean(classification.knowledge_vocabulary_checked),
      matched: classification.knowledge_vocabulary_match || null,
      professional: Boolean(classification.professional),
      knowledge_tags: classification.knowledge_tags || []
    }),
    workflowNode("memory", "Chat Memory", "memory", "done", {
      session_id: saved.session_id
    }, {
      messages_loaded: memory.length,
      has_summary: Boolean(memorySummary?.last_intent || memorySummary?.active_topics?.length)
    }),
    workflowNode("memory_write", "Memory Maintenance", "memory", memoryWrite?.errors?.length ? "error" : "done", {
      session_id: saved.session_id
    }, {
      mode: memoryWrite?.mode || "disabled",
      learned_items: memoryWrite?.learned || 0,
      rejected_items: memoryWrite?.rejected || 0,
      turn_count: memoryWrite?.turnCount || 0,
      degraded: Boolean(memoryWrite?.errors?.length)
    }),
    workflowNode("switch", "Traffic Switch", "router", "done", classification, {
      route: result.memoryAction ? "Memory Action" : isChat ? "Lite Agent" : "Main RAG Agent"
    })
  ];

  if (isChat && !result.memoryAction) {
    nodes.push(
      workflowNode("lite_agent", "Lite Agent", "ai", "done", {
        message: sanitized,
        memory_messages: memory.length
      }, {
        answer: result.answer
      })
    );
  } else {
    if (classification.urgency === "HIGH") {
      nodes.push(
        workflowNode("safety_precheck", "Safety Precheck", "tool", safetyReportPrecheckCalls.some((call) => call.ok) ? "done" : "skipped", {
          urgency: classification.urgency,
          tools: ["safety_report"]
        }, {
          results: safetyReportPrecheckCalls.map((call) => ({
            toolName: call.toolName,
            ok: call.ok,
            skipped: call.skipped,
            error: call.error || null,
            sources: call.sources || []
          }))
        })
      );
    }
    if (alertCall) {
      nodes.push(
        workflowNode("alert_agent", "Alert Agent", "ai", alertCall.ok ? "done" : alertCall.skipped ? "skipped" : "error", {
          ...buildAlertAgentRequest({ message: sanitized, classification }),
          phase: alertRanInSafetyPrecheck ? "safety_precheck" : "tool_call"
        }, {
          ok: alertCall.ok,
          skipped: alertCall.skipped || false,
          error: alertCall.error || null,
          answer: summarizeData(alertCall.data),
          sources: alertCall.sources || []
        })
      );
    }
    if (dataQueryCall) {
      const dataQueryWorkflow = buildMainDataQueryWorkflowProjection({
        dataQueryCall,
        question: sanitized,
        allowedTables: dataQuerySettings(config).allowedTables
      });
      nodes.push(
        workflowNode(
          "data_query",
          "Data Query Agent",
          "database",
          dataQueryCall.ok ? "done" : dataQueryCall.skipped ? "skipped" : "error",
          dataQueryWorkflow.input,
          dataQueryWorkflow.output
        )
      );
    }
    if (result.investigationPlan) {
      nodes.push(
        workflowNode("investigation", "Investigation Mode", "router", "done", {
          reason: classification.investigation_reason,
          message: sanitized
        }, result.investigationPlan)
      );
    }
    if (classification.professional) {
      nodes.push(
        workflowNode("knowledge_planner", "Professional Knowledge Agent", "ai", knowledgePlan?.skipped ? "skipped" : "done", {
          message: sanitized,
          knowledge_tags: classification.knowledge_tags || [],
          professional_reason: classification.professional_reason || ""
        }, knowledgePlan || {
          skipped: true,
          reason: "not returned"
        })
      );
    }
    nodes.push(
      workflowNode("hybrid_search", "Hybrid Search", "vector", hybridCall?.skipped ? "skipped" : hybridCall?.ok ? "done" : "error", {
        raw_query: sanitized,
        date_from: classification.date_from,
        date_to: classification.date_to,
        hashtags: classification.hashtags || [],
        rpc: config.retrieval.rpcName,
        candidates: config.retrieval.candidates,
        vector_weight: config.retrieval.vectorWeight,
        keyword_weight: config.retrieval.keywordWeight
      }, hybridCall?.ok ? {
        records_returned: countRows(hybridCall.data),
        sources: hybridCall.sources,
        sample: previewRows(hybridCall.data)
      } : {
        error: hybridCall?.error || "not called"
      })
    );
    if (config.graph?.enabled !== false) {
      nodes.push(workflowNode("graph_search", "Project Graph Search", "database", graphCall?.ok ? "done" : graphCall?.skipped ? "skipped" : "error", {
        records_from_hybrid: countRows(hybridCall?.data)
      }, graphCall?.ok || graphCall?.skipped ? {
        relationships_returned: countRows(graphCall?.data),
        sample: graphCall?.data || [],
        skipped: graphCall?.skipped || false,
        error: graphCall?.error || null
      } : {
        error: graphCall?.error || "not called"
      }));
    }
    nodes.push(
      workflowNode("reranker", "OpenRouter Reranker", "ai", rerankerCall?.skipped ? "skipped" : rerankerCall?.ok ? "done" : "error", {
        model: config.models.reranker,
        candidates: countRows(hybridCall?.data)
      }, rerankerCall?.ok ? {
        records_returned: countRows(rerankerCall.data),
        top_chunks: qaChunksPreview(rerankerCall.data)
      } : {
        error: rerankerCall?.error || "not called",
        fallback: rerankerCall?.fallback || false,
        fallback_chunks: rerankerCall?.fallback ? qaChunksPreview(hybridCall?.data) : undefined
      }),
      workflowNode("n8n_tools", "n8n Tool Adapters", "tool", n8nCalls.some((c) => c.ok) ? "done" : n8nCalls.some((c) => !c.ok && !c.skipped) ? "error" : "skipped", {
        hinted_tools: classification.tool_hint,
        calls: n8nCalls.map((call) => call.toolName)
      }, {
        results: n8nCalls.map((call) => ({
          toolName: call.toolName,
          ok: call.ok,
          skipped: call.skipped,
          error: call.toolName === "meeting_evidence_search" && summarizeMeetingEvidenceErrorForWorkflow(call)
            ? "meeting_evidence_failed"
            : call.error || null,
          sources: call.sources || []
        }))
      }),
      workflowNode("source_quality", "Source Quality", "router", "done", {
        retrieval_records: countRows(rerankerCall?.data || hybridCall?.data),
        tool_calls: n8nCalls.length
      }, result.sourceQuality || {
        summary: "not returned"
      }),
      workflowNode("conflict_detection", "Conflict Detection", "router", (result.conflicts || []).length ? "error" : "done", {
        source_quality: Boolean(result.sourceQuality),
        sources: result.sources?.length || 0
      }, {
        conflicts: result.conflicts || []
      }),
      workflowNode("main_agent", "Main RAG Agent", "ai", "done", {
        message: sanitized,
        memory_messages: memory.length,
        retrieval_records: countRows(rerankerCall?.data || hybridCall?.data),
        graph_relationships: countRows(graphCall?.data),
        answer_mode: isEntityListQuestion(sanitized) ? "ranked_entity_list" : "standard_grounded_answer",
        tool_calls: n8nCalls.length
      }, {
        answer: result.answer,
        sources: result.sources,
        source_quality: result.sourceQuality,
        conflicts: result.conflicts
      })
    );
  }

  nodes.push(
    workflowNode("update_message", "Update DB", "database", "done", {
      id: saved.id,
      ai_response: result.answer
    }, {
      table: "chat_messages_gf",
      status: "done"
    })
  );

  const edges = isChat
    ? [
        ["chat_input", "sanitize"],
        ["sanitize", "save_message"],
        ["save_message", "classifier"],
        ["classifier", "knowledge_vocabulary"],
        ["knowledge_vocabulary", "memory"],
        ["memory", "switch"],
        ["switch", "lite_agent"],
        ["lite_agent", "update_message"]
      ]
    : [
        ["chat_input", "sanitize"],
        ["sanitize", "save_message"],
        ["save_message", "classifier"],
        ["classifier", "knowledge_vocabulary"],
        ["knowledge_vocabulary", "memory"],
        ["memory", "switch"],
        ...(classification.urgency === "HIGH" ? [["switch", "safety_precheck"]] : []),
        ...(alertRanInSafetyPrecheck ? [["safety_precheck", "alert_agent"]] : []),
        ...(result.investigationPlan
          ? [[alertRanInSafetyPrecheck ? "alert_agent" : classification.urgency === "HIGH" ? "safety_precheck" : "switch", "investigation"]]
          : []),
        ...(classification.professional
          ? [
              [classification.knowledge_vocabulary_match ? "knowledge_vocabulary" : result.investigationPlan ? "investigation" : alertRanInSafetyPrecheck ? "alert_agent" : classification.urgency === "HIGH" ? "safety_precheck" : "switch", "knowledge_planner"],
              ["knowledge_planner", "hybrid_search"]
            ]
          : [[result.investigationPlan ? "investigation" : alertRanInSafetyPrecheck ? "alert_agent" : classification.urgency === "HIGH" ? "safety_precheck" : "switch", "hybrid_search"]]),
        ...(config.graph?.enabled === false
          ? [["hybrid_search", "reranker"]]
          : [["hybrid_search", "graph_search"], ["graph_search", "reranker"]]),
        ...(dataQueryCall ? [["reranker", "data_query"]] : []),
        ...(alertCall && !alertRanInSafetyPrecheck
          ? n8nCalls.length
            ? [[dataQueryCall ? "data_query" : "reranker", "alert_agent"], ["alert_agent", "n8n_tools"], ["n8n_tools", "source_quality"]]
            : [[dataQueryCall ? "data_query" : "reranker", "alert_agent"], ["alert_agent", "source_quality"]]
          : [[dataQueryCall ? "data_query" : "reranker", "n8n_tools"], ["n8n_tools", "source_quality"]]),
        ["source_quality", "conflict_detection"],
        ["conflict_detection", "main_agent"],
        ["main_agent", "update_message"]
      ];

  const activePrompts = {
    classifier: config.prompts?.classifier || null,
    main: config.prompts?.main || null,
    lite: config.prompts?.lite || null,
    reranker: config.prompts?.reranker || null,
    knowledge_planner: config.prompts?.knowledge_planner || null
  };
  for (const node of nodes) {
    const calls = openRouterCalls.filter((call) => call.step === node.id);
    if (calls.length) node.openrouter = calls;
  }

  return {
    nodes,
    edges: edges.map(([from, to]) => ({ from, to })),
    activePrompts,
    trace,
    openRouterUsage: summarizeOpenRouterUsage(openRouterCalls)
  };
}

function workflowNode(id, label, kind, status, input, output) {
  return { id, label, kind, status, input: compactLog(input), output: compactLog(output) };
}

function compactLog(value) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= 5000) return value;
  return { preview: `${text.slice(0, 5000)}...`, truncated: true };
}

function summarizeOpenRouterUsage(calls = []) {
  const completed = calls.filter((call) => call.status === "done");
  const totalDurationMs = completed.reduce((sum, call) => sum + Number(call.duration_ms || 0), 0);
  const completionTokens = completed.reduce((sum, call) => sum + Number(call.completion_tokens || 0), 0);
  const knownCosts = completed.filter((call) => call.cost !== null && call.cost !== undefined && Number.isFinite(Number(call.cost)));
  return {
    calls,
    totals: {
      calls: calls.length,
      successful_calls: completed.length,
      failed_calls: calls.length - completed.length,
      prompt_tokens: completed.reduce((sum, call) => sum + Number(call.prompt_tokens || 0), 0),
      completion_tokens: completionTokens,
      total_tokens: completed.reduce((sum, call) => sum + Number(call.total_tokens || 0), 0),
      cached_tokens: completed.reduce((sum, call) => sum + Number(call.cached_tokens || 0), 0),
      reasoning_tokens: completed.reduce((sum, call) => sum + Number(call.reasoning_tokens || 0), 0),
      cost: knownCosts.length
        ? Number(knownCosts.reduce((sum, call) => sum + Number(call.cost || 0), 0).toFixed(8))
        : null,
      duration_ms: totalDurationMs,
      output_tokens_per_second: completionTokens > 0 && totalDurationMs > 0
        ? Number((completionTokens / (totalDurationMs / 1000)).toFixed(2))
        : null
    }
  };
}

function countRows(results) {
  return normalizeRows(results).length;
}

function previewRows(results) {
  return normalizeRows(results).slice(0, 3).map((row) => {
    const text = row.content || row.index_text || row.summary || row.title || row.text || row.chunk || row.page_content || row.document || row.metadata?.text || JSON.stringify(row);
    return {
      score: row.similarity || row.score || row.distance || row.match_score || null,
      text: String(text).slice(0, 600),
      metadata: row.metadata || null
    };
  });
}

function qaChunksPreview(results) {
  return normalizeRows(results).slice(0, 10).map((row, i) => {
    const text = row.content || row.index_text || row.summary || row.title || row.text || row.chunk || row.page_content || row.document || row.metadata?.text || JSON.stringify(row);
    return {
      rank: i + 1,
      hybrid_score: row.hybrid_score || row.similarity || row.score || row.match_score || null,
      rerank_score: row.rerank_score ?? null,
      rerank_reason: row.rerank_reason || null,
      text: String(text).slice(0, 1500),
      url: row.url || row.metadata?.url || null,
      metadata: row.metadata || null
    };
  });
}
