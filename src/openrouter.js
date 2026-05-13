function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export async function chatCompletion({ apiKey, model, messages, temperature = 0.2, maxTokens = 4096 }) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost",
      "X-Title": "bidoc-agent"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  }, 90_000);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter request failed: ${response.status}`);
  }
  return data.choices?.[0]?.message?.content || "";
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

export async function createEmbedding({ apiKey, model, input }) {
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const normalizedModel = normalizeEmbeddingModel(model);
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: normalizedModel, input })
  }, 30_000);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter embedding request failed: ${response.status}`);
  }
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("OpenRouter embedding response is missing data[0].embedding");
  return embedding;
}

export async function rerankWithLlm({ apiKey, model, query, results, topK = 10, systemPrompt = "" }) {
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
    temperature: 0,
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

function extractResultText(row) {
  return String(
    row?.content ||
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
