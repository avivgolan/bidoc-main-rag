import { CACHE_TTL, cachedOperation } from "./cache.js";

function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export class ChatCompletionIntegrityError extends Error {
  constructor(message, { reasonCode, integrityStatus, finishReason = null, nativeFinishReason = null } = {}) {
    super(message);
    this.name = "ChatCompletionIntegrityError";
    this.code = reasonCode || "completion_invalid";
    this.reasonCode = reasonCode || "completion_invalid";
    this.integrityStatus = integrityStatus || "malformed";
    this.finishReason = finishReason;
    this.nativeFinishReason = nativeFinishReason;
  }
}

export async function chatCompletion(options) {
  const completion = await chatCompletionDetailed(options);
  return completion.content;
}

export async function chatCompletionDetailed({
  apiKey,
  model,
  messages,
  temperature = 0.2,
  maxTokens = 4096,
  timeoutMs = 90_000,
  topP = 1,
  frequencyPenalty = 0,
  presencePenalty = 0,
  seed = null,
  reasoning = null,
  responseFormat = null,
  telemetry = null,
  signal = null
}) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const startedAt = Date.now();
  let response;
  let data = {};
  // The abort timer must span the BODY read too: providers can send headers early
  // and stream the completion body for minutes, so a fetch-only timeout never fires
  // and response.json() hangs unbounded.
  const controller = new AbortController();
  let abortError = null;
  const abortWith = (reason, fallbackMessage) => {
    if (controller.signal.aborted) return;
    abortError = reason instanceof Error ? reason : new Error(fallbackMessage);
    controller.abort(abortError);
  };
  const externalSignal = signal && typeof signal.addEventListener === "function" ? signal : null;
  const abortFromExternal = () => abortWith(externalSignal?.reason, "OpenRouter response was cancelled");
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  const abortTimer = setTimeout(
    () => abortWith(null, `OpenRouter response timed out after ${timeoutMs}ms`),
    timeoutMs
  );
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost",
        "X-Title": "bidoc-agent"
      },
      body: JSON.stringify(omitNullish({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        seed,
        reasoning,
        response_format: responseFormat
      }))
    });

    data = await response.json().catch((error) => {
      if (controller.signal.aborted && abortError) throw abortError;
      if (!response.ok) return {};
      throw error;
    });
    if (!response.ok) {
      const providerDetails = extractProviderErrorDetails(data, response.status);
      const providerError = new Error(providerDetails.message);
      providerError.httpStatus = response.status;
      providerError.providerName = providerDetails.providerName;
      providerError.providerCode = providerDetails.providerCode;
      const affordableMatch = String(providerDetails.message).match(/can\s+only\s+afford\s+([\d,]+)(?:\s+tokens?)?/i);
      if (affordableMatch) {
        providerError.affordableMaxTokens = Number(affordableMatch[1].replaceAll(",", ""));
      }
      throw providerError;
    }
    const completion = buildDetailedChatCompletion(data);
    recordTelemetry(telemetry, buildTelemetryEntry({
      kind: "chat",
      requestedModel: model,
      data,
      durationMs: Date.now() - startedAt,
      status: "done",
      completionStatus: classifyChatCompletion(completion).status
    }));
    return completion;
  } catch (error) {
    const reportedError = controller.signal.aborted && abortError ? abortError : error;
    recordTelemetry(telemetry, buildTelemetryEntry({
      kind: "chat",
      requestedModel: model,
      data,
      durationMs: Date.now() - startedAt,
      status: "error",
      error: reportedError.message,
      httpStatus: response?.status || null
    }));
    throw reportedError;
  } finally {
    clearTimeout(abortTimer);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

function buildDetailedChatCompletion(data = {}) {
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const message = choice?.message;
  const contentIsString = typeof message?.content === "string";
  return {
    content: contentIsString ? message.content : "",
    finishReason: choice?.finish_reason ?? null,
    nativeFinishReason: choice?.native_finish_reason ?? null,
    usage: data?.usage && typeof data.usage === "object" ? data.usage : null,
    model: data?.model || null,
    callId: data?.id || null,
    provider: data?.provider || null,
    malformed: !choice || !message || !contentIsString
  };
}

export function classifyChatCompletion(completion) {
  if (!completion || typeof completion !== "object" || completion.malformed || typeof completion.content !== "string") {
    return { status: "malformed", reasonCode: "completion_malformed" };
  }
  const finishReason = normalizeFinishReason(completion.finishReason);
  const nativeFinishReason = normalizeFinishReason(completion.nativeFinishReason);
  const finishReasons = [finishReason, nativeFinishReason].filter(Boolean);
  if (finishReasons.some(isTruncationFinishReason)) {
    return { status: "truncated", reasonCode: "completion_truncated" };
  }
  if (!completion.content.trim()) {
    return { status: "empty", reasonCode: "completion_empty" };
  }
  if (!finishReasons.length) {
    return { status: "missing_finish", reasonCode: "completion_missing_finish" };
  }
  if (finishReasons.some(isFailureFinishReason)) {
    return { status: "failed_finish", reasonCode: "completion_failed_finish" };
  }
  return { status: "complete", reasonCode: "completion_complete" };
}

export function requireCompleteChatCompletion(completion) {
  const integrity = classifyChatCompletion(completion);
  if (integrity.status === "complete") return completion.content;
  throw new ChatCompletionIntegrityError(
    `Chat completion integrity check failed: ${integrity.status}`,
    {
      reasonCode: integrity.reasonCode,
      integrityStatus: integrity.status,
      finishReason: completion?.finishReason ?? null,
      nativeFinishReason: completion?.nativeFinishReason ?? null
    }
  );
}

function normalizeFinishReason(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isTruncationFinishReason(value) {
  return value === "length"
    || value === "max_tokens"
    || value === "max_token"
    || value === "max_output_tokens"
    || value.includes("max_tokens");
}

function isFailureFinishReason(value) {
  return [
    "error",
    "failed",
    "cancelled",
    "canceled",
    "content_filter",
    "blocked",
    "safety"
  ].includes(value);
}

export async function listOpenRouterModels({ apiKey = "" } = {}) {
  const headers = {
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost",
    "X-Title": "bidoc-agent"
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/models", { headers }, 15_000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter models request failed: ${response.status}`);
  }

  return (data.data || [])
    .map((model) => ({
      id: model.id,
      name: model.name || model.id,
      contextLength: model.context_length || null,
      pricing: model.pricing || null
    }))
    .filter((model) => model.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function createEmbedding({ apiKey, model, input, cacheContext = null, telemetry = null }) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const normalizedModel = normalizeEmbeddingModel(model);
  return cachedOperation({
    context: cacheContext,
    type: "embedding",
    keyParts: { text: String(input || ""), model: normalizedModel },
    ttl: CACHE_TTL.embedding,
    savedCall: "embedding",
    estimatedCost: 0.0001,
    operation: async () => {
      const startedAt = Date.now();
      let response;
      let data = {};
      try {
        response = await fetchWithTimeout("https://openrouter.ai/api/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({ model: normalizedModel, input })
        }, 30_000);

        data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error?.message || `OpenRouter embedding request failed: ${response.status}`);
        }
        const embedding = data.data?.[0]?.embedding;
        if (!Array.isArray(embedding)) throw new Error("OpenRouter embedding response is missing data[0].embedding");
        recordTelemetry(telemetry, buildTelemetryEntry({
          kind: "embedding",
          requestedModel: normalizedModel,
          data,
          durationMs: Date.now() - startedAt,
          status: "done"
        }));
        return embedding;
      } catch (error) {
        recordTelemetry(telemetry, buildTelemetryEntry({
          kind: "embedding",
          requestedModel: normalizedModel,
          data,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: error.message,
          httpStatus: response?.status || null
        }));
        throw error;
      }
    }
  });
}

export async function rerankWithLlm({ apiKey, model, query, results, topK = 10, systemPrompt = "", temperature = 0, maxTokens = 4096, timeoutMs = 90_000, topP = 1, frequencyPenalty = 0, presencePenalty = 0, seed = null, telemetry = null }) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const candidates = results.map((row, index) => ({
    index,
    text: extractResultText(row).slice(0, 1800),
    scores: {
      vector_score: row.vector_score ?? row.similarity ?? row.score ?? null,
      keyword_score: row.keyword_score ?? null,
      hybrid_score: row.hybrid_score ?? row.match_score ?? null
    },
    metadata: row.metadata || null
  }));
  const content = await chatCompletion({
    apiKey,
    model,
    temperature,
    maxTokens,
    timeoutMs,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    telemetry,
    messages: [
      {
        role: "system",
        content:
          systemPrompt || "You are a strict RAG reranker. Return ONLY valid JSON: {\"ranked\":[{\"index\":number,\"relevance\":number,\"reason\":string}]}. Rank by relevance to the user query. Use scores as hints, but judge semantic relevance. Do not include markdown."
      },
      {
        role: "user",
        content: JSON.stringify({ query, topK, candidates }, null, 2)
      }
    ]
  });
  const parsed = extractJsonObject(content);
  const ranked = Array.isArray(parsed.ranked) ? parsed.ranked : [];
  const used = new Set();
  const reranked = [];
  for (const item of ranked) {
    const index = Number(item.index);
    if (!Number.isInteger(index) || index < 0 || index >= results.length || used.has(index)) continue;
    used.add(index);
    reranked.push({
      ...results[index],
      rerank_score: Number(item.relevance) || null,
      rerank_reason: String(item.reason || "")
    });
    if (reranked.length >= topK) break;
  }
  for (let index = 0; reranked.length < topK && index < results.length; index += 1) {
    if (!used.has(index)) reranked.push(results[index]);
  }
  return reranked;
}

function omitNullish(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""));
}

function extractProviderErrorDetails(data, status) {
  const outer = data?.error && typeof data.error === "object" ? data.error : {};
  const metadata = outer?.metadata && typeof outer.metadata === "object" ? outer.metadata : {};
  let nested = {};
  if (typeof metadata.raw === "string" && metadata.raw.length <= 20_000) {
    try {
      const parsed = JSON.parse(metadata.raw);
      nested = parsed?.error && typeof parsed.error === "object" ? parsed.error : {};
    } catch {
      nested = {};
    }
  }
  const outerMessage = String(outer.message || "").trim();
  const nestedMessage = String(nested.message || "").trim();
  const message = nestedMessage
    || outerMessage
    || `OpenRouter request failed: ${status}`;
  return {
    message: message.slice(0, 2_000),
    providerName: String(metadata.provider_name || "").trim().slice(0, 200) || null,
    providerCode: String(nested.status || nested.code || outer.code || "").trim().slice(0, 200) || null
  };
}

function extractResultText(row) {
  return String(
    row?.content ||
      row?.index_text ||
      row?.summary ||
      row?.title ||
      row?.text ||
      row?.chunk ||
      row?.page_content ||
      row?.document ||
      row?.metadata?.text ||
      row?.metadata?.content ||
      JSON.stringify(row || {})
  );
}

function normalizeEmbeddingModel(model) {
  const value = model || "openai/text-embedding-3-large";
  if (value.startsWith("openai/")) return value;
  if (value.startsWith("text-embedding-")) return `openai/${value}`;
  return value;
}

function buildTelemetryEntry({
  kind,
  requestedModel,
  data = {},
  durationMs = 0,
  status = "done",
  error = null,
  httpStatus = null,
  completionStatus = null
}) {
  const usage = data?.usage || {};
  const promptTokens = numberOrNull(usage.prompt_tokens ?? usage.input_tokens);
  const completionTokens = numberOrNull(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = numberOrNull(usage.total_tokens)
    ?? sumNullable(promptTokens, completionTokens);
  const cost = numberOrNull(usage.cost ?? data?.cost);
  const measuredDurationMs = Math.max(0, Number(durationMs || 0));
  const tokensPerSecond = completionTokens !== null && measuredDurationMs > 0
    ? Number((completionTokens / (measuredDurationMs / 1000)).toFixed(2))
    : null;
  return {
    kind,
    status,
    requested_model: requestedModel || null,
    actual_model: data?.model || requestedModel || null,
    generation_id: data?.id || null,
    provider: data?.provider || null,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cached_tokens: numberOrNull(usage?.prompt_tokens_details?.cached_tokens),
    reasoning_tokens: numberOrNull(usage?.completion_tokens_details?.reasoning_tokens),
    cost,
    duration_ms: measuredDurationMs,
    tokens_per_second: tokensPerSecond,
    finish_reason: data?.choices?.[0]?.finish_reason || null,
    native_finish_reason: data?.choices?.[0]?.native_finish_reason || null,
    completion_status: completionStatus,
    http_status: httpStatus,
    error: error || null
  };
}

function recordTelemetry(telemetry, entry) {
  if (!telemetry || !entry) return;
  const payload = {
    ...entry,
    step: telemetry.step || "openrouter",
    call_id: telemetry.callId || null,
    recorded_at: new Date().toISOString()
  };
  try {
    if (typeof telemetry.record === "function") telemetry.record(payload);
  } catch (error) {
    console.warn("[openrouter] telemetry recording failed:", error.message);
  }
}

// Aggregates per-call OpenRouter telemetry into a workflow-level usage summary
// (used by both the chat pipeline and standalone subagent runs).
export function summarizeOpenRouterUsage(calls = []) {
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumNullable(first, second) {
  if (first === null && second === null) return null;
  return Number(first || 0) + Number(second || 0);
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) throw new Error("Model did not return JSON");
    return JSON.parse(raw.slice(first, last + 1));
  }
}
