import { sanitizeMessage } from "./sanitize.js";
import { classifyMessage, hintedTools } from "./classifier.js";
import { heuristicClassification, isHebrew } from "./heuristics.js";
import { chatCompletion, extractJsonObject, rerankWithLlm } from "./openrouter.js";
import { graphSearch, hybridSearch, recentMemory, saveMessage, updateMessage } from "./supabase.js";
import { buildToolOrder, callN8nTool, extractLinks } from "./tools.js";
import { runAlertAgent } from "./subagents/alert.js";
import { runDataQueryAgent } from "./subagents/dataQuery.js";
import { formatMeetingCitation, runMeetingEvidenceAgent } from "./subagents/meeting.js";
import { appendLocalMemory, getLocalMemory, getMemorySummary, memorySummaryMessages } from "./memory.js";
import { completeRun, emitRunEvent, getRunEvents } from "./runLog.js";
import { renderPrompt, defaultPrompts } from "./prompts.js";
import { getProjectDateTime } from "./clock.js";
import { routeKnowledgeAgents, searchKnowledgeBase } from "./knowledge.js";
import { TOOL_NAMES } from "./config.js";
import { annotateToolCall, buildSourceQualitySummary, detectConflicts } from "./sourceQuality.js";
import { buildGraphSearchPayload, summarizeGraphContext } from "./projectGraph.js";
import { CACHE_TTL, cachedOperation, createCacheContext, finalizeCacheMetrics, hashValue } from "./cache.js";

export const KNOWLEDGE_PLANNER_RESPONSE_FORMAT = { type: "json_object" };

export async function runChatPipeline({ message, sessionId, config, runId, sourcesEnabled = true, deepResearch = false, attachments = [] }) {
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
  emitRunEvent(runId, "sanitize", "Message sanitized", { changed: sanitized !== message, length: sanitized.length });
  const saved = await saveMessage({ config, userMessage: message, sanitizedMessage: sanitized, sessionId });
  emitRunEvent(runId, "save_message", "Message saved", { id: saved.id, status: saved.status });
  const trace = [];
  let classification;

  try {
    emitRunEvent(runId, "classifier", "Classifying message", {});
    classification = await classifyMessage({ message: sanitized, config, telemetry: telemetryFor("classifier") });
    emitRunEvent(runId, "classifier", "Classification completed", classification);
    console.log(`[classifier] type=${classification.type} tool="${classification.tool_hint}" msg="${sanitized.slice(0, 70)}"`);
  } catch (error) {
    classification = heuristicClassification(sanitized);
    trace.push({ step: "classifier", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "classifier", "Classifier failed, using local fallback", { error: error.message, classification });
    console.log(`[classifier] FALLBACK (${error.message}) type=${classification.type} msg="${sanitized.slice(0, 70)}"`);
  }
  const beforeProfessional = Boolean(classification?.professional);
  classification = enforceProfessionalKnowledgeMode(classification, sanitized, config);
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
  classification = enforceInvestigationMode(classification, sanitized);
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

  let memory = await recentMemory({ config, sessionId }).catch((error) => {
    trace.push({ step: "memory", ok: false, error: error.message });
    emitRunEvent(runId, "memory", "Memory load failed", { error: error.message });
    return [];
  });
  if (!memory.length) memory = getLocalMemory(sessionId);
  const memorySummary = getMemorySummary(sessionId);
  emitRunEvent(runId, "memory", "Memory loaded", { messages: memory.length, summary: memorySummary });

  let result;
  if (classification.type === "CHAT") {
    emitRunEvent(runId, "switch", "Routing to Lite Agent", { type: classification.type });
    result = await runLiteAgent({ message: sanitized, memory, memorySummary, config, trace, runId, telemetryFor });
  } else {
    emitRunEvent(runId, "switch", "Routing to Main RAG Agent", { type: classification.type });
    result = await runRagAgent({ message: sanitized, sessionId, classification, memory, memorySummary, config, trace, runId, cacheContext, telemetryFor });
  }

  appendLocalMemory(sessionId, message, result.answer);
  emitRunEvent(runId, "local_memory", "Local memory updated", {});
  const workflowLog = buildWorkflowLog({
    message,
    sanitized,
    saved,
    memory,
    memorySummary: getMemorySummary(sessionId),
    classification,
    result,
    trace,
    config,
    openRouterCalls
  });
  workflowLog.cacheMetrics = finalizeCacheMetrics(cacheContext);

  const runEvents = getRunEvents(runId);
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
    toolCalls: result.toolCalls,
    knowledgePlan: result.knowledgePlan || null,
    investigationPlan: result.investigationPlan || null,
    memorySummary: getMemorySummary(sessionId),
    sourceQuality: result.sourceQuality || null,
    conflicts: result.conflicts || [],
    openRouterUsage: workflowLog.openRouterUsage,
    trace,
    workflowLog
  };
  completeRun(runId, { messageId: saved.id, type: classification.type });
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
        ...memorySummaryMessages(memorySummary),
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

async function runRagAgent({ message, sessionId, classification, memory, memorySummary, config, trace, runId, cacheContext, telemetryFor }) {
  const toolCalls = [];
  const sources = [];
  let hybridResults = null;
  let rerankedResults = null;
  let graphContext = [];
  let knowledgePlan = null;
  const listIntent = isEntityListQuestion(message);
  const investigationPlan = buildInvestigationPlan({ message, classification, memorySummary });
  if (investigationPlan) {
    emitRunEvent(runId, "investigation", "Investigation Mode enabled", investigationPlan);
  }

  const toolsRuntime = config.n8n?.runtime || {};
  const safetyPrecheckTools = toolsRuntime.safetyPrecheckEnabled !== false && classification.urgency === "HIGH"
    ? ["safety_report", ...(toolsRuntime.alertAgentEnabled === false ? [] : ["alert"])]
    : [];
  const safetyResults = await Promise.all(
    safetyPrecheckTools.map((toolName) =>
      callProjectTool({ toolName, message, classification, sessionId, config, cacheContext, telemetryFor }).then((result) => {
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

  if (classification.professional) {
    knowledgePlan = await runKnowledgePlanner({ message, classification, config, trace, runId, telemetryFor });
  }

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
          const plannedSources = extractLinks(plannedRows);
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
    const hybridSources = extractLinks(hybridResults);
    sources.push(...hybridSources);
    toolCalls.push(annotateToolCall({ toolName: "hybrid_search", ok: true, rawQuery: message, data: hybridResults, sources: hybridSources, relaxedHashtags: primarySearch.relaxedHashtags }));
    emitRunEvent(runId, "hybrid_search", "Hybrid Search completed", { records: countRows(hybridResults), sources: hybridSources.length, plannedQueries: planQueries.length });
  } catch (error) {
    toolCalls.push(annotateToolCall({ toolName: "hybrid_search", ok: false, rawQuery: message, error: error.message, data: null, sources: [] }));
    emitRunEvent(runId, "hybrid_search", "Hybrid Search failed", { error: error.message });
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
      const rerankSources = extractLinks(rerankedResults);
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

  const plannerTools = recommendedProjectTools(knowledgePlan);
  const meetingsEvidenceEnabled = config.meetingsEvidence?.enabled !== false;
  const shouldRunMeetingEvidence = meetingsEvidenceEnabled && (
    (classification.tool_hint || "").includes("meetings") ||
    (rerankedResults && normalizeRows(rerankedResults).some((r) => r.meeting_id || r.source_table === "meetings_documents")) ||
    Boolean(classification.investigation)
  );
  const meetingsEvidenceTool = shouldRunMeetingEvidence ? ["meeting_evidence_search"] : [];
  const dataQueryTool = shouldRunDataQuery({ message, classification, config }) ? ["data_query"] : [];
  const tools = buildToolOrder(classification, [...hintedTools(classification), ...plannerTools, ...meetingsEvidenceTool, ...dataQueryTool])
    .filter((toolName) => !safetyPrecheckTools.includes(toolName))
    .filter((toolName) => toolsRuntime.enabled !== false)
    .filter((toolName) => toolsRuntime.alertAgentEnabled !== false || toolName !== "alert")
    .filter((toolName) => toolName !== "meeting_evidence_search" || shouldRunMeetingEvidence)
    .filter((toolName) => toolName !== "data_query" || config.dataQuery?.enabled !== false)
    .slice(0, Number(toolsRuntime.parallelLimit || 6));
  emitRunEvent(runId, "n8n_tools", "Calling hinted/fallback tools in parallel", { tools });
  const toolResults = await Promise.all(
    tools.map((toolName) =>
      callProjectTool({ toolName, message, classification, sessionId, config, cacheContext, telemetryFor }).then((result) => {
        if (toolName === "meeting_evidence_search") {
          emitRunEvent(runId, "meeting_evidence", `Meeting Evidence Agent completed`, {
            ok: result.ok,
            skipped: result.skipped || false,
            status: result.data?.status || null,
            evidenceCount: result.data?.evidence?.length || 0,
            conflictsCount: result.data?.conflicts?.length || 0,
            error: result.error || result.data?.error || null
          });
        } else if (toolName === "data_query") {
          emitRunEvent(runId, "data_query", "Data Query Agent completed", {
            ok: result.ok,
            skipped: result.skipped || false,
            status: result.data?.status || null,
            plans: result.data?.plans?.length || 0,
            metrics: result.data?.metrics?.length || 0,
            warnings: result.data?.warnings || [],
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

  const uniqueSources = uniqueByUrl(sources);
  const sourceQuality = buildSourceQualitySummary(toolCalls);
  const conflicts = detectConflicts(toolCalls);
  if (conflicts.length) {
    emitRunEvent(runId, "conflict_detection", "Potential source conflicts detected", { conflicts });
  } else {
    emitRunEvent(runId, "conflict_detection", "No obvious source conflicts detected", {});
  }
  emitRunEvent(runId, "source_quality", "Source quality scored", sourceQuality);
  const answer = await synthesizeAnswer({ message, classification, memory, memorySummary, retrievalResults: rerankedResults || hybridResults, graphContext, toolCalls, sources: uniqueSources, knowledgePlan, investigationPlan, sourceQuality, conflicts, config, trace, runId, cacheContext, telemetryFor });
  return { answer, sources: uniqueSources, toolCalls, knowledgePlan, investigationPlan, sourceQuality, conflicts, graphContext };
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

async function callProjectTool({ toolName, message, classification, sessionId, config, cacheContext = null, telemetryFor }) {
  if (toolName === "data_query") {
    try {
      const result = await runDataQueryAgent({
        config,
        question: message,
        context: {
          dateFrom: classification?.date_from || null,
          dateTo: classification?.date_to || null,
          sessionId,
          source: "main_agent"
        },
        telemetry: telemetryFor("data_query")
      });
      return {
        toolName,
        ok: ["ok", "partial"].includes(result.status),
        skipped: ["skipped", "needs_clarification"].includes(result.status),
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

function shouldRunDataQuery({ message, classification, config }) {
  if (config.dataQuery?.enabled === false || classification?.type === "CHAT") return false;
  const hint = String(classification?.tool_hint || "");
  if (hint.split(",").map((item) => item.trim()).includes("data_query")) return true;
  return /כמה|ספור|ספירה|פילוח|ממוצע|מגמה|לפי סטטוס|לפי תאריך|לפי חומרה|מה הכי הרבה|השוואה בין|תמונת מצב|kpi|count|how many|breakdown|average|trend|by status|by date|by severity|top|compare/i.test(String(message || ""));
}

export function buildAlertAgentRequest({ message, classification }) {
  return {
    query: message,
    dateFilter: buildDateFilter(classification),
    dateFrom: classification?.date_from || null,
    dateTo: classification?.date_to || null
  };
}

async function synthesizeAnswer({ message, classification, memory, memorySummary, retrievalResults, graphContext = [], toolCalls, sources, knowledgePlan, investigationPlan, sourceQuality, conflicts, config, trace, runId, cacheContext, telemetryFor }) {
  const successful = toolCalls.filter((call) => call.ok);
  const failed = toolCalls.filter((call) => !call.ok && !call.skipped);
  const skipped = toolCalls.filter((call) => call.skipped);
  const listIntent = isEntityListQuestion(message);
  const retrievalLimit = contextRecordsLimitForQuestion({ config, listIntent, classification });
  const projectGraphFindings = buildProjectGraphFindings(graphContext, { listIntent });
  if (!config.openRouterApiKey) {
    console.warn("[main_agent] OPENROUTER_API_KEY is missing — cannot call LLM, returning structured fallback.");
    trace.push({ step: "mainAgent", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "main_agent", "Missing OpenRouter key, using fallback answer", {});
    return fallbackRagAnswer({ successful, failed, skipped, sources });
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
      retrieval_context: formatRetrievalContext(retrievalResults, retrievalLimit, config.rag?.chunkTextLimit || 1800),
      retrieval_results: retrievalResults,
      graph_context: graphContext,
      project_graph_findings: projectGraphFindings,
      knowledge_plan: knowledgePlan,
      investigation_plan: investigationPlan,
      source_quality: sourceQuality,
      potential_conflicts: conflicts,
      tool_results: toolCalls.filter((call) => !call.skipped),
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
          memorySummary
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
          timeoutMs: config.ai?.main?.timeoutMs ?? 90_000,
          ...samplingSettings(config, "main"),
          telemetry: telemetryFor("main_agent"),
          messages: [
            { role: "system", content: systemPrompt },
            ...memorySummaryMessages(memorySummary),
            {
              role: "user",
              content: JSON.stringify(mainPayload, null, 2)
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
      return fallbackRagAnswer({ successful, failed, skipped, sources });
    }
    emitRunEvent(runId, "main_agent", "Main Agent response received", { length: answer.length });
    return answer;
  } catch (error) {
    trace.push({ step: "mainAgent", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "main_agent", "Main Agent failed, using fallback answer", { error: error.message });
    return fallbackRagAnswer({ successful, failed, skipped, sources });
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
- knowledge_plan is planning guidance only. It is not project evidence.
- Use knowledge_plan to decide what to look for and how to reason.
- Final factual claims must come only from retrieval_context, retrieval_results, tool_results, graph_context/project_graph_findings when they are connected to retrieved records, or explicit user input from the current request.
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
- If a claim has no directly matching URL, write "(ללא קישור ישיר במקור)" instead of borrowing another source.
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

function fallbackRagAnswer({ successful, failed, skipped = [], sources }) {
  const found = successful.length
    ? successful.map((call) => {
      const callSources = uniqueByUrl(call.sources || []);
      const links = callSources.length
        ? ` ${callSources.map((source) => `[למסמך לחץ כאן](${source.url})`).join(" ")}`
        : " (ללא קישור ישיר במקור)";
      return `- ${call.toolName}: ${summarizeData(call.data)}${links}`;
    }).join("\n")
    : "- לא הצלחתי לאחזר מידע מהפרויקט כרגע.";

  // Build a human-readable reason for why we're in fallback mode
  const reasons = [];
  const supabaseFail = failed.find((c) => c.toolName === "hybrid_search");
  if (supabaseFail) reasons.push(`חיפוש הוקטורי נכשל (${supabaseFail.error})`);
  if (!successful.length && !supabaseFail) reasons.push("מפתח OpenRouter חסר — הסוכן הראשי לא הופעל");

  const reasonNote = reasons.length
    ? `\n> ⚠️ ${reasons.join(" · ")}`
    : "";

  const failedText = failed.map((call) => `- ${call.toolName}: ${call.error}`);
  const skippedText = skipped.map((call) => `- ${call.toolName}: לא מוגדר`);
  const missing = failedText.length || skippedText.length
    ? [...failedText, ...skippedText].join("\n")
    : "- אין.";
  const noSourceNote = !successful.length && sources.length
    ? `\n${sources.map((source) => `[למסמך לחץ כאן](${source.url})`).join(" ")}`
    : "";
  return `**תשובה:**\n${found}${noSourceNote}${reasonNote}\n\n**פרטים לפי מקור:**\n${found}${noSourceNote}\n\n**מה לא נמצא:**\n${missing}`;
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

function formatRetrievalContext(results, limit = 12, chunkTextLimit = 1800) {
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
      const sourceUrl = row.source_url || row.url || row.link || row.data_link || row.metadata?.source_url || row.metadata?.url || "";
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

function buildWorkflowLog({ message, sanitized, saved, memory, memorySummary, classification, result, trace, config, openRouterCalls = [] }) {
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
      summary: memorySummary,
      preview: memory.slice(-4)
    }),
    workflowNode("switch", "Traffic Switch", "router", "done", classification, {
      route: isChat ? "Lite Agent" : "Main RAG Agent"
    })
  ];

  if (isChat) {
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
      nodes.push(
        workflowNode("data_query", "Data Query Agent", "database", dataQueryCall.ok ? "done" : dataQueryCall.skipped ? "skipped" : "error", {
          question: sanitized,
          requested_plans: dataQueryCall.data?.queryPlan?.plans?.map((plan) => plan.id) || [],
          allowed_tables: config.dataQuery?.allowedTables || []
        }, {
          status: dataQueryCall.data?.status || null,
          plans_executed: dataQueryCall.data?.plans || [],
          rows_returned: (dataQueryCall.data?.plans || []).reduce((sum, plan) => sum + Number(plan.rows || 0), 0),
          metrics: dataQueryCall.data?.metrics || [],
          tables_used: dataQueryCall.data?.tablesUsed || [],
          warnings: dataQueryCall.data?.warnings || [],
          error: dataQueryCall.error || null
        })
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
      workflowNode("hybrid_search", "Hybrid Search", "vector", hybridCall?.ok ? "done" : "error", {
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
      workflowNode("reranker", "OpenRouter Reranker", "ai", rerankerCall?.ok ? "done" : "error", {
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
          error: call.error || null,
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
