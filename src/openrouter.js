import { CACHE_TTL, cachedOperation } from "./cache.js";

function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export async function chatCompletion({
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
  telemetry = null
}) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const startedAt = Date.now();
  let response;
  let data = {};
  try {
    response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
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
        seed
      }))
    }, timeoutMs);

    data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenRouter request failed: ${response.status}`);
    }
    recordTelemetry(telemetry, buildTelemetryEntry({
      kind: "chat",
      requestedModel: model,
      data,
      durationMs: Date.now() - startedAt,
      status: "done"
    }));
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    recordTelemetry(telemetry, buildTelemetryEntry({
      kind: "chat",
      requestedModel: model,
      data,
      durationMs: Date.now() - startedAt,
      status: "error",
      error: error.message,
      httpStatus: response?.status || null
    }));
    throw error;
  }
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
  httpStatus = null
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
