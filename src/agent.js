import { sanitizeMessage } from "./sanitize.js";
import { classifyMessage, hintedTools } from "./classifier.js";
import { heuristicClassification, isHebrew } from "./heuristics.js";
import { chatCompletion, extractJsonObject, rerankWithLlm } from "./openrouter.js";
import { hybridSearch, recentMemory, saveMessage, updateMessage } from "./supabase.js";
import { buildToolOrder, callN8nTool, extractLinks } from "./tools.js";
import { appendLocalMemory, getLocalMemory } from "./memory.js";
import { completeRun, emitRunEvent } from "./runLog.js";
import { renderPrompt } from "./prompts.js";
import { getProjectDateTime } from "./clock.js";
import { searchKnowledgeBase } from "./knowledge.js";

export async function runChatPipeline({ message, sessionId, config, runId }) {
  emitRunEvent(runId, "chat_input", "Received user message", { sessionId, preview: message.slice(0, 300) });
  const sanitized = sanitizeMessage(message);
  emitRunEvent(runId, "sanitize", "Message sanitized", { changed: sanitized !== message, length: sanitized.length });
  const saved = await saveMessage({ config, userMessage: message, sanitizedMessage: sanitized, sessionId });
  emitRunEvent(runId, "save_message", "Message saved", { id: saved.id, status: saved.status });
  const trace = [];
  let memory = await recentMemory({ config, sessionId }).catch((error) => {
    trace.push({ step: "memory", ok: false, error: error.message });
    emitRunEvent(runId, "memory", "Memory load failed", { error: error.message });
    return [];
  });
  if (!memory.length) memory = getLocalMemory(sessionId);
  emitRunEvent(runId, "memory", "Memory loaded", { messages: memory.length });
  let classification;

  try {
    emitRunEvent(runId, "classifier", "Classifying message", {});
    classification = await classifyMessage({ message: sanitized, config });
    emitRunEvent(runId, "classifier", "Classification completed", classification);
    console.log(`[classifier] type=${classification.type} tool="${classification.tool_hint}" msg="${sanitized.slice(0, 70)}"`);
  } catch (error) {
    classification = heuristicClassification(sanitized);
    trace.push({ step: "classifier", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "classifier", "Classifier failed, using local fallback", { error: error.message, classification });
    console.log(`[classifier] FALLBACK (${error.message}) type=${classification.type} msg="${sanitized.slice(0, 70)}"`);
  }

  let result;
  if (classification.type === "CHAT") {
    emitRunEvent(runId, "switch", "Routing to Lite Agent", { type: classification.type });
    result = await runLiteAgent({ message: sanitized, memory, config, trace, runId });
  } else {
    emitRunEvent(runId, "switch", "Routing to Main RAG Agent", { type: classification.type });
    result = await runRagAgent({ message: sanitized, sessionId, classification, memory, config, trace, runId });
  }

  await updateMessage({
    config,
    messageId: saved.id,
    aiResponse: result.answer,
    status: "done"
  }).then(() => {
    emitRunEvent(runId, "update_message", "Message updated with AI response", { id: saved.id, status: "done" });
  }).catch((error) => {
    trace.push({ step: "updateMessage", ok: false, error: error.message });
    emitRunEvent(runId, "update_message", "DB update failed", { error: error.message });
  });
  appendLocalMemory(sessionId, message, result.answer);
  emitRunEvent(runId, "local_memory", "Local memory updated", {});
  const workflowLog = buildWorkflowLog({
    message,
    sanitized,
    saved,
    memory,
    classification,
    result,
    trace,
    config
  });

  const output = {
    messageId: saved.id,
    type: classification.type,
    classification,
    answer: result.answer,
    sources: result.sources,
    toolCalls: result.toolCalls,
    knowledgePlan: result.knowledgePlan || null,
    trace,
    workflowLog
  };
  completeRun(runId, { messageId: saved.id, type: classification.type });
  return output;
}

async function runLiteAgent({ message, memory, config, trace, runId }) {
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
      temperature: 0.3,
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

async function runRagAgent({ message, sessionId, classification, memory, config, trace, runId }) {
  const toolCalls = [];
  const sources = [];
  let hybridResults = null;
  let rerankedResults = null;
  let knowledgePlan = null;

  if (classification.professional) {
    knowledgePlan = await runKnowledgePlanner({ message, classification, config, trace, runId });
  }

  try {
    emitRunEvent(runId, "hybrid_search", "Running Hybrid Search", {
      rpc: config.retrieval.rpcName,
      candidates: config.retrieval.candidates,
      date_from: classification.date_from,
      date_to: classification.date_to,
      hashtags: classification.hashtags || []
    });
    hybridResults = await hybridSearch({
      config,
      query: message,
      dateFrom: classification.date_from,
      dateTo: classification.date_to,
      hashtags: classification.hashtags || [],
      topK: config.retrieval.candidates
    });
    hybridResults = filterRowsByHashtags(hybridResults, classification.hashtags || []);
    const hybridSources = extractLinks(hybridResults);
    sources.push(...hybridSources);
    toolCalls.push({ toolName: "hybrid_search", ok: true, rawQuery: message, data: hybridResults, sources: hybridSources });
    emitRunEvent(runId, "hybrid_search", "Hybrid Search completed", { records: countRows(hybridResults), sources: hybridSources.length });
  } catch (error) {
    toolCalls.push({ toolName: "hybrid_search", ok: false, rawQuery: message, error: error.message, data: null, sources: [] });
    emitRunEvent(runId, "hybrid_search", "Hybrid Search failed", { error: error.message });
  }

  if (hybridResults) {
    try {
      emitRunEvent(runId, "reranker", "Running reranker", { model: config.models.reranker, candidates: countRows(hybridResults), topK: config.retrieval.rerankTopK });
      rerankedResults = await rerankWithLlm({
        apiKey: config.openRouterApiKey,
        model: config.models.reranker,
        query: message,
        results: normalizeRows(hybridResults),
        topK: config.retrieval.rerankTopK,
        systemPrompt: config.prompts?.reranker
      });
      const rerankSources = extractLinks(rerankedResults);
      sources.push(...rerankSources);
      toolCalls.push({ toolName: "reranker", ok: true, rawQuery: message, data: rerankedResults, sources: rerankSources });
      emitRunEvent(runId, "reranker", "Reranker completed", { records: countRows(rerankedResults) });
    } catch (error) {
      const fallbackRows = normalizeRows(hybridResults).slice(0, config.retrieval.rerankTopK);
      rerankedResults = fallbackRows;
      toolCalls.push({ toolName: "reranker", ok: false, fallback: true, rawQuery: message, error: error.message, data: fallbackRows, sources: [] });
      emitRunEvent(runId, "reranker", "Reranker failed, using hybrid order", { error: error.message, fallbackRecords: fallbackRows.length });
    }
  }

  const tools = buildToolOrder(classification, hintedTools(classification));
  emitRunEvent(runId, "n8n_tools", "Calling hinted/fallback tools", { tools });
  for (const toolName of tools) {
    const result = await callN8nTool({
      toolName,
      query: message,
      dateFilter: buildDateFilter(classification),
      dateFrom: classification.date_from,
      dateTo: classification.date_to,
      sessionId,
      config
    });
    toolCalls.push(result);
    sources.push(...result.sources);
    emitRunEvent(runId, "n8n_tools", `Tool ${toolName} completed`, { ok: result.ok, skipped: result.skipped || false, error: result.error || null });
  }

  const uniqueSources = uniqueByUrl(sources);
  const answer = await synthesizeAnswer({ message, classification, memory, retrievalResults: rerankedResults || hybridResults, toolCalls, sources: uniqueSources, knowledgePlan, config, trace, runId });
  return { answer, sources: uniqueSources, toolCalls, knowledgePlan };
}

async function runKnowledgePlanner({ message, classification, config, trace, runId }) {
  const tags = [...new Set([...(classification.knowledge_tags || []), ...(classification.hashtags || [])])];
  emitRunEvent(runId, "knowledge_planner", "Searching local Knowledge Base", { query: message, tags });
  const search = searchKnowledgeBase({ query: message, tags, topK: 6 });
  if (!search.matches.length) {
    const skippedPlan = {
      skipped: true,
      reason: search.totalDocuments ? "No relevant Knowledge Base excerpts found" : "Knowledge Base ריק",
      matches: [],
      domain_summary: "",
      relevant_terms: [],
      decision_criteria: [],
      rag_queries: [],
      recommended_tools: [],
      risks_or_cautions: [search.totalDocuments ? "לא נמצאו מקטעי ידע רלוונטיים." : "Knowledge Base ריק."]
    };
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner skipped", skippedPlan);
    return skippedPlan;
  }

  const fallback = fallbackKnowledgePlan({ message, classification, matches: search.matches });
  if (!config.openRouterApiKey) {
    trace.push({ step: "knowledgePlanner", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "knowledge_planner", "Missing OpenRouter key, using local knowledge fallback", { matches: search.matches.length });
    return fallback;
  }

  try {
    emitRunEvent(runId, "knowledge_planner", "Calling Professional Knowledge Agent", {
      model: config.models.knowledgePlanner,
      matches: search.matches.length
    });
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.knowledgePlanner,
      temperature: 0.1,
      messages: [
        { role: "system", content: config.prompts?.knowledge_planner || "" },
        {
          role: "user",
          content: JSON.stringify({
            user_message: message,
            classification,
            knowledge_excerpts: search.matches.map((match) => ({
              filename: match.filename,
              chunkIndex: match.chunkIndex,
              score: match.score,
              text: match.text
            }))
          }, null, 2)
        }
      ]
    });
    const plan = normalizeKnowledgePlan(extractJsonObject(content), search.matches);
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner completed", plan);
    return plan;
  } catch (error) {
    trace.push({ step: "knowledgePlanner", ok: false, fallback: true, error: error.message });
    emitRunEvent(runId, "knowledge_planner", "Knowledge Planner failed, using fallback", { error: error.message });
    return fallback;
  }
}

async function synthesizeAnswer({ message, classification, memory, retrievalResults, toolCalls, sources, knowledgePlan, config, trace, runId }) {
  const successful = toolCalls.filter((call) => call.ok);
  const failed = toolCalls.filter((call) => !call.ok && !call.skipped);
  const skipped = toolCalls.filter((call) => call.skipped);
  if (!config.openRouterApiKey) {
    trace.push({ step: "mainAgent", ok: false, fallback: true, error: "OPENROUTER_API_KEY is missing" });
    emitRunEvent(runId, "main_agent", "Missing OpenRouter key, using fallback answer", {});
    return fallbackRagAnswer({ successful, failed, skipped, sources });
  }

  try {
    emitRunEvent(runId, "main_agent", "Calling Main Agent", { model: config.models.main, retrievalRecords: countRows(retrievalResults), toolCalls: toolCalls.length });
    const answer = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models.main,
      temperature: 0.2,
      messages: [
        { role: "system", content: mainSystemPrompt(classification, config) },
        ...memory,
        {
          role: "user",
          content: JSON.stringify(
            {
              user_message: message,
              retrieval_context: formatRetrievalContext(retrievalResults),
              retrieval_results: retrievalResults,
              knowledge_plan: knowledgePlan,
              tool_results: toolCalls.filter((call) => !call.skipped),
              skipped_tools: skipped.map((call) => call.toolName),
              sources
            },
            null,
            2
          )
        }
      ]
    });
    if (!String(answer || "").trim()) {
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
  const fallback = `You are RAG-PM, the Primary Project Intelligence Agent for the JFrog construction project.
Default language: Hebrew. If the user writes in English, respond in English.

SYSTEM HINT: ${classification.tool_hint}
COMPLEXITY: ${classification.complexity}
URGENCY: ${classification.urgency}

Answer only from supplied vector/tool results. Do not fabricate.
Use retrieval_context as the primary source when it contains items.
Do not say "no relevant information found" if retrieval_context or retrieval_results contains records.
If optional n8n tools are skipped because they are not configured, mention that only under missing info and still answer from vector results.
If knowledge_plan is supplied, use it only as professional planning guidance. Do not treat it as project evidence.
Response format:
**תשובה:**
- Detailed bullets with names, dates, amounts

**פרטים לפי מקור:**
- Per tool breakdown

**מה לא נמצא:**
- Missing info

**מקורות:**
- ALL links returned by tools.`;
  return renderPrompt(config.prompts?.main || fallback, {
    tool_hint: classification.tool_hint,
    complexity: classification.complexity,
    urgency: classification.urgency
  });
}

function normalizeKnowledgePlan(value, matches) {
  return {
    skipped: false,
    matches: matches.map((match) => ({
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

function fallbackKnowledgePlan({ message, classification, matches }) {
  const terms = [...new Set([...(classification.knowledge_tags || []), ...(classification.hashtags || [])])];
  return {
    skipped: false,
    matches: matches.map((match) => ({
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

function fallbackRagAnswer({ successful, failed, skipped = [], sources }) {
  const found = successful.length
    ? successful.map((call) => `- ${call.toolName}: ${summarizeData(call.data)}`).join("\n")
    : "- לא נמצא מידע רלוונטי במקורות שהוגדרו.";
  const failedText = failed.map((call) => `- ${call.toolName}: ${call.error}`);
  const skippedText = skipped.map((call) => `- ${call.toolName}: לא מוגדר`);
  const missing = failedText.length || skippedText.length
    ? [...failedText, ...skippedText].join("\n")
    : "- אין.";
  const sourceText = sources.length ? sources.map((source) => `- ${source.url}`).join("\n") : "- לא הוחזרו קישורים.";
  return `**תשובה:**\n${found}\n\n**פרטים לפי מקור:**\n${found}\n\n**מה לא נמצא:**\n${missing}\n\n**מקורות:**\n${sourceText}`;
}

function liteFallback(message) {
  if (!isHebrew(message)) return "Hello, I am the bidoc.ai AI assistant for the JFrog project. How can I help?";
  return "שלום! אני עוזר ה-AI של bidoc.ai לפרויקט JFrog. במה אוכל לסייע?";
}

function summarizeData(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  if (!text || text === "null") return "לא הוחזר מידע.";
  return text.length > 450 ? `${text.slice(0, 450)}...` : text;
}

function formatRetrievalContext(results) {
  const rows = normalizeRows(results).slice(0, 12);
  if (!rows.length) return "No vector records returned.";
  return rows
    .map((row, index) => {
      const text =
        row.content ||
        row.text ||
        row.chunk ||
        row.page_content ||
        row.document ||
        row.metadata?.text ||
        row.metadata?.content ||
        JSON.stringify(row);
      const metadata = row.metadata ? `\nmetadata: ${JSON.stringify(row.metadata)}` : "";
      const score = row.similarity || row.score || row.distance || row.match_score || "";
      return `[${index + 1}] score: ${score}\n${String(text).slice(0, 1800)}${metadata}`;
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
  return filtered.length ? filtered : [];
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

function buildWorkflowLog({ message, sanitized, saved, memory, classification, result, trace, config }) {
  const toolCalls = result.toolCalls || [];
  const hybridCall = toolCalls.find((call) => call.toolName === "hybrid_search");
  const rerankerCall = toolCalls.find((call) => call.toolName === "reranker");
  const n8nCalls = toolCalls.filter((call) => !["hybrid_search", "reranker"].includes(call.toolName));
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
    workflowNode("memory", "Chat Memory", "memory", "done", {
      session_id: saved.session_id
    }, {
      messages_loaded: memory.length,
      preview: memory.slice(-4)
    }),
    workflowNode("classifier", "Smart Classifier", "ai", "done", { sanitized }, classification),
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
      }),
      workflowNode("reranker", "OpenRouter Reranker", "ai", rerankerCall?.ok ? "done" : "error", {
        model: config.models.reranker,
        candidates: countRows(hybridCall?.data)
      }, rerankerCall?.ok ? {
        records_returned: countRows(rerankerCall.data),
        sample: previewRows(rerankerCall.data)
      } : {
        error: rerankerCall?.error || "not called",
        fallback: rerankerCall?.fallback || false
      }),
      workflowNode("n8n_tools", "n8n Tool Adapters", "tool", n8nCalls.some((call) => call.ok) ? "done" : "skipped", {
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
      workflowNode("main_agent", "Main RAG Agent", "ai", "done", {
        message: sanitized,
        memory_messages: memory.length,
        retrieval_records: countRows(rerankerCall?.data || hybridCall?.data),
        tool_calls: n8nCalls.length
      }, {
        answer: result.answer,
        sources: result.sources
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
        ["save_message", "memory"],
        ["memory", "classifier"],
        ["classifier", "switch"],
        ["switch", "lite_agent"],
        ["lite_agent", "update_message"]
      ]
    : [
        ["chat_input", "sanitize"],
        ["sanitize", "save_message"],
        ["save_message", "memory"],
        ["memory", "classifier"],
        ["classifier", "switch"],
        ...(classification.professional
          ? [["switch", "knowledge_planner"], ["knowledge_planner", "hybrid_search"]]
          : [["switch", "hybrid_search"]]),
        ["hybrid_search", "reranker"],
        ["reranker", "n8n_tools"],
        ["n8n_tools", "main_agent"],
        ["main_agent", "update_message"]
      ];

  return {
    nodes,
    edges: edges.map(([from, to]) => ({ from, to })),
    trace
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

function countRows(results) {
  return normalizeRows(results).length;
}

function previewRows(results) {
  return normalizeRows(results).slice(0, 3).map((row) => {
    const text = row.content || row.text || row.chunk || row.page_content || row.document || row.metadata?.text || JSON.stringify(row);
    return {
      score: row.similarity || row.score || row.distance || row.match_score || null,
      text: String(text).slice(0, 600),
      metadata: row.metadata || null
    };
  });
}
