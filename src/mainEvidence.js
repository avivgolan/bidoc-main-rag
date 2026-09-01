import { createHash } from "node:crypto";

export const MAIN_EVIDENCE_CONTRACT = "canonical_evidence.v1";
export const DEFAULT_MAIN_INPUT_BUDGET_TOKENS = 24_000;
export const DEFAULT_MAIN_EVIDENCE_RECORDS = 12;
export const DEFAULT_MAIN_BROAD_EVIDENCE_RECORDS = 18;
export const DEFAULT_MAIN_EVIDENCE_EXCERPT_LIMIT = 900;

const RETRIEVAL_TOOL_NAMES = new Set([
  "hybrid_search",
  "hybrid_search_plan",
  "graph_search",
  "reranker"
]);
const URL_FIELD_NAMES = new Set(["url", "source_url", "data_link", "link", "href"]);
const INTERNAL_FIELD_PATTERN = /^(?:embedding|embeddings|vector|vectors|metadata|index_text|raw|raw_response|headers|authorization|api_?key|service_?role_?key|password|access_?token|refresh_?token|prompt|messages|request|telemetry|openrouter)$/i;

export function buildCompactMainPayload({
  userMessage = "",
  answerMode = "standard_grounded_answer",
  retrievalResults = null,
  graphContext = [],
  knowledgePlan = null,
  investigationPlan = null,
  sourceQuality = null,
  conflicts = [],
  exactInvoiceEnrichment = null,
  toolResults = [],
  skippedTools = [],
  sources = [],
  systemPrompt = "",
  memory = [],
  resolveSourceUrl = null,
  options = {}
} = {}) {
  const broad = answerMode === "ranked_entity_list" || options.broad === true;
  const configuredRecordLimit = clampInteger(
    broad ? options.broadRecordLimit : options.recordLimit,
    1,
    50,
    broad ? DEFAULT_MAIN_BROAD_EVIDENCE_RECORDS : DEFAULT_MAIN_EVIDENCE_RECORDS
  );
  const minimumRecords = Math.min(
    configuredRecordLimit,
    clampInteger(options.minimumRecords, 1, 12, broad ? 6 : 4)
  );
  const configuredExcerptLimit = clampInteger(
    options.excerptLimit,
    240,
    2400,
    DEFAULT_MAIN_EVIDENCE_EXCERPT_LIMIT
  );
  const minimumExcerptLimit = Math.min(
    configuredExcerptLimit,
    clampInteger(options.minimumExcerptLimit, 160, 900, 360)
  );
  const configuredGraphLimit = clampInteger(options.graphLimit, 0, 24, broad ? 12 : 8);
  const toolDetail = options.toolDetail === "minimal" ? "minimal" : "full";
  const budgetTokens = clampInteger(
    options.budgetTokens,
    4_000,
    200_000,
    DEFAULT_MAIN_INPUT_BUDGET_TOKENS
  );
  const candidates = collectEvidenceCandidates({
    retrievalResults,
    sources,
    toolResults,
    graphContext,
    resolveSourceUrl
  });
  const deduplicated = deduplicateCandidates(candidates);

  let recordLimit = configuredRecordLimit;
  let excerptLimit = configuredExcerptLimit;
  let graphLimit = configuredGraphLimit;
  let assembled = null;
  let metrics = null;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    assembled = assembleCompactPayload({
      userMessage,
      answerMode,
      deduplicated,
      graphContext,
      knowledgePlan,
      investigationPlan,
      sourceQuality,
      conflicts,
      exactInvoiceEnrichment,
      toolResults,
      skippedTools,
      recordLimit,
      excerptLimit,
      graphLimit,
      toolDetail,
      broad
    });
    metrics = measureMainRequest({
      systemPrompt,
      memory,
      payload: assembled.payload,
      budgetTokens,
      mode: "compact"
    });
    if (metrics.within_budget) break;
    if (excerptLimit > minimumExcerptLimit) {
      excerptLimit = Math.max(minimumExcerptLimit, excerptLimit - 120);
      continue;
    }
    if (recordLimit > minimumRecords) {
      recordLimit -= 1;
      continue;
    }
    if (graphLimit > 0) {
      graphLimit -= 1;
      continue;
    }
    break;
  }

  return {
    payload: assembled.payload,
    metrics: {
      ...metrics,
      contract: MAIN_EVIDENCE_CONTRACT,
      evidence: {
        input_records: normalizeRows(retrievalResults).length,
        candidate_records: candidates.length,
        deduplicated_records: deduplicated.length,
        duplicates_removed: Math.max(0, candidates.length - deduplicated.length),
        selected_records: assembled.selectedCount,
        source_map_records: assembled.sourceMapCount,
        record_limit: recordLimit,
        excerpt_limit: excerptLimit,
        graph_limit: graphLimit,
        tool_detail: toolDetail,
        broad
      },
      trimmed: recordLimit < configuredRecordLimit
        || excerptLimit < configuredExcerptLimit
        || graphLimit < configuredGraphLimit
    }
  };
}

export function buildCanonicalEvidenceRecords({
  retrievalResults = null,
  sources = [],
  toolResults = [],
  graphContext = [],
  resolveSourceUrl = null,
  recordLimit = DEFAULT_MAIN_EVIDENCE_RECORDS,
  excerptLimit = DEFAULT_MAIN_EVIDENCE_EXCERPT_LIMIT,
  broad = false
} = {}) {
  const candidates = collectEvidenceCandidates({
    retrievalResults,
    sources,
    toolResults,
    graphContext,
    resolveSourceUrl
  });
  const deduplicated = deduplicateCandidates(candidates);
  const selected = selectEvidenceCandidates(deduplicated, clampInteger(recordLimit, 1, 50, DEFAULT_MAIN_EVIDENCE_RECORDS));
  const registry = buildSourceRegistry({ selected, allCandidates: deduplicated, limit: Math.max(24, selected.length + 8) });
  return {
    records: selected.map((candidate) => evidenceRecord(candidate, registry, excerptLimit)),
    sourceMap: registry.sourceMap,
    stats: {
      inputRecords: normalizeRows(retrievalResults).length,
      candidateRecords: candidates.length,
      deduplicatedRecords: deduplicated.length,
      duplicatesRemoved: Math.max(0, candidates.length - deduplicated.length),
      selectedRecords: selected.length,
      broad
    }
  };
}

export function compactToolResultsForMain(toolResults = [], { sourceMap = {}, broad = false, detail = "full" } = {}) {
  const lookup = buildSourceLookup(sourceMap);
  return (Array.isArray(toolResults) ? toolResults : [])
    .filter((call) => call && !call.skipped && !RETRIEVAL_TOOL_NAMES.has(String(call.toolName || call.tool_name || "")))
    .map((call) => compactToolResult(call, { lookup, broad, detail }))
    .filter(Boolean);
}

export function measureMainRequest({
  systemPrompt = "",
  memory = [],
  payload = {},
  budgetTokens = DEFAULT_MAIN_INPUT_BUDGET_TOKENS,
  mode = "legacy"
} = {}) {
  const sections = {
    prompt: measureValue(systemPrompt),
    memory: measureValue(memory),
    question: measureValue({ user_message: payload?.user_message, answer_mode: payload?.answer_mode }),
    evidence: measureValue({ retrieval_context: payload?.retrieval_context, retrieval_results: payload?.retrieval_results }),
    graph: measureValue({ graph_context: payload?.graph_context, project_graph_findings: payload?.project_graph_findings }),
    tools: measureValue({ tool_results: payload?.tool_results, skipped_tools: payload?.skipped_tools, exact_invoice_enrichment: payload?.exact_invoice_enrichment }),
    plans: measureValue({ knowledge_plan: payload?.knowledge_plan, investigation_plan: payload?.investigation_plan }),
    conflicts: measureValue({ source_quality: payload?.source_quality, potential_conflicts: payload?.potential_conflicts }),
    sources: measureValue({ sources: payload?.sources, source_map: payload?.source_map })
  };
  const messages = [
    { role: "system", content: systemPrompt },
    ...(Array.isArray(memory) ? memory : []),
    { role: "user", content: stableStringify(payload) }
  ];
  const total = measureValue(messages);
  const normalizedBudget = clampInteger(budgetTokens, 1, 200_000, DEFAULT_MAIN_INPUT_BUDGET_TOKENS);
  return {
    mode,
    estimate: "utf8_bytes_div_4",
    budget_tokens: normalizedBudget,
    within_budget: total.estimated_tokens <= normalizedBudget,
    total,
    sections
  };
}

function assembleCompactPayload({
  userMessage,
  answerMode,
  deduplicated,
  graphContext,
  knowledgePlan,
  investigationPlan,
  sourceQuality,
  conflicts,
  exactInvoiceEnrichment,
  toolResults,
  skippedTools,
  recordLimit,
  excerptLimit,
  graphLimit,
  toolDetail,
  broad
}) {
  const selected = selectEvidenceCandidates(deduplicated, recordLimit);
  const registry = buildSourceRegistry({ selected, allCandidates: deduplicated, limit: Math.max(24, selected.length + 8) });
  const records = selected.map((candidate) => evidenceRecord(candidate, registry, excerptLimit));
  const payload = {
    user_message: String(userMessage || ""),
    answer_mode: answerMode,
    retrieval_context: {
      format: MAIN_EVIDENCE_CONTRACT,
      instruction: "Use only these canonical evidence records for retrieved project facts. Match source_id to source_map for citations.",
      records
    },
    graph_context: compactGraphContext(graphContext, {
      limit: graphLimit,
      sourceMap: registry.sourceMap,
      excerptLimit: Math.min(360, excerptLimit)
    }),
    knowledge_plan: compactMachineValue(knowledgePlan, { stringLimit: 700, arrayLimit: broad ? 18 : 12 }),
    investigation_plan: compactMachineValue(investigationPlan, { stringLimit: 700, arrayLimit: broad ? 18 : 12 }),
    source_quality: compactMachineValue(sourceQuality, { stringLimit: 500, arrayLimit: 12 }),
    potential_conflicts: compactMachineValue(conflicts, { stringLimit: 700, arrayLimit: broad ? 18 : 12 }),
    exact_invoice_enrichment: compactMachineValue(exactInvoiceEnrichment, { stringLimit: 1200, arrayLimit: broad ? 18 : 12, preserveExact: true }),
    tool_results: compactToolResultsForMain(toolResults, { sourceMap: registry.sourceMap, broad, detail: toolDetail }),
    skipped_tools: uniqueStrings(skippedTools),
    source_map: registry.sourceMap
  };
  return {
    payload: removeUndefined(payload),
    selectedCount: records.length,
    sourceMapCount: Object.keys(registry.sourceMap).length
  };
}

function collectEvidenceCandidates({ retrievalResults, sources, toolResults, graphContext, resolveSourceUrl }) {
  const candidates = [];
  normalizeRows(retrievalResults).forEach((row, index) => {
    candidates.push(candidateFromRecord(row, {
      rank: index,
      priority: 0,
      origin: "retrieval",
      resolveSourceUrl
    }));
  });
  let rank = candidates.length;
  for (const call of Array.isArray(toolResults) ? toolResults : []) {
    for (const source of Array.isArray(call?.sources) ? call.sources : []) {
      candidates.push(candidateFromRecord(source, {
        rank: rank++,
        priority: 1,
        origin: String(call.toolName || call.tool_name || "tool"),
        resolveSourceUrl
      }));
    }
  }
  for (const source of Array.isArray(sources) ? sources : []) {
    candidates.push(candidateFromRecord(source, {
      rank: rank++,
      priority: 2,
      origin: "source",
      resolveSourceUrl
    }));
  }
  for (const item of Array.isArray(graphContext) ? graphContext : []) {
    if (!recordUrl(item, resolveSourceUrl)) continue;
    candidates.push(candidateFromRecord(item, {
      rank: rank++,
      priority: 3,
      origin: "graph",
      resolveSourceUrl
    }));
  }
  return candidates.filter((candidate) => candidate.title || candidate.excerpt || candidate.url || candidate.typedIdentity);
}

function candidateFromRecord(record, { rank, priority, origin, resolveSourceUrl }) {
  const row = record && typeof record === "object" ? record : { content: String(record || "") };
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const excerpt = cleanText(firstValue(
    row.content,
    row.index_text,
    row.summary,
    row.text,
    row.chunk,
    row.page_content,
    row.document,
    row.answer,
    metadata.text,
    metadata.content,
    metadata.summary
  ), 6_000);
  const sourceTable = cleanIdentifier(firstValue(
    row.source_table,
    row.sourceTable,
    row.table,
    metadata.source_table,
    metadata.sourceTable,
    origin
  ));
  const rawId = cleanIdentifier(firstValue(
    row.source_id,
    row.sourceId,
    metadata.source_id,
    metadata.sourceId,
    row.id,
    row.input_data_id,
    metadata.input_data_id
  ));
  const title = cleanText(firstValue(
    row.title,
    row.label,
    row.subject,
    row.document_name,
    metadata.title,
    sourceTable && rawId ? `${sourceTable} ${rawId}` : ""
  ), 240);
  const date = normalizeDate(firstValue(
    row.primary_date,
    row.date,
    row.data_date,
    row.created_at,
    row.received_date,
    metadata.primary_date,
    metadata.date
  ));
  const url = recordUrl(row, resolveSourceUrl);
  const relevance = finiteNumber(firstValue(
    row.rerank_score,
    row.hybrid_score,
    row.match_score,
    row.similarity,
    row.score
  ));
  const fingerprint = textFingerprint(excerpt);
  const typedIdentity = sourceTable && rawId ? `${normalizeKey(sourceTable)}:${normalizeKey(rawId)}` : "";
  const titleDateIdentity = title && date ? `${normalizeKey(title)}:${normalizeKey(date)}` : "";
  const identitySeed = url || typedIdentity || titleDateIdentity || fingerprint || `${priority}:${rank}:${title}`;
  return {
    rank,
    priority,
    origin,
    sourceTable,
    rawId,
    title,
    date,
    url,
    relevance,
    whyRelevant: cleanText(firstValue(row.rerank_reason, row.why_relevant, metadata.why_relevant), 300),
    excerpt,
    fingerprint,
    typedIdentity,
    titleDateIdentity,
    evidenceKey: `EV_${shortHash(identitySeed)}`,
    duplicateCount: 1
  };
}

function deduplicateCandidates(candidates) {
  const entries = [];
  const urlMap = new Map();
  const typedMap = new Map();
  const fingerprintMap = new Map();
  const titleDateMap = new Map();
  for (const candidate of candidates) {
    const urlKey = candidate.url ? normalizeUrlKey(candidate.url) : "";
    let duplicateIndex = urlKey ? urlMap.get(urlKey) : undefined;
    if (duplicateIndex === undefined && candidate.typedIdentity) duplicateIndex = typedMap.get(candidate.typedIdentity);
    if (duplicateIndex === undefined && candidate.fingerprint) duplicateIndex = fingerprintMap.get(candidate.fingerprint);
    if (duplicateIndex === undefined && candidate.titleDateIdentity) {
      const indexes = titleDateMap.get(candidate.titleDateIdentity) || [];
      duplicateIndex = indexes.find((index) => {
        const existing = entries[index];
        return !existing.excerpt || !candidate.excerpt || existing.fingerprint === candidate.fingerprint;
      });
    }
    if (duplicateIndex !== undefined) {
      entries[duplicateIndex] = mergeCandidate(entries[duplicateIndex], candidate);
      registerCandidateMaps(entries[duplicateIndex], duplicateIndex, { urlMap, typedMap, fingerprintMap, titleDateMap });
      continue;
    }
    const index = entries.length;
    entries.push(candidate);
    registerCandidateMaps(candidate, index, { urlMap, typedMap, fingerprintMap, titleDateMap });
  }
  return entries.sort(compareCandidates);
}

function registerCandidateMaps(candidate, index, maps) {
  if (candidate.url) maps.urlMap.set(normalizeUrlKey(candidate.url), index);
  if (candidate.typedIdentity) maps.typedMap.set(candidate.typedIdentity, index);
  if (candidate.fingerprint) maps.fingerprintMap.set(candidate.fingerprint, index);
  if (candidate.titleDateIdentity) {
    const indexes = maps.titleDateMap.get(candidate.titleDateIdentity) || [];
    if (!indexes.includes(index)) indexes.push(index);
    maps.titleDateMap.set(candidate.titleDateIdentity, indexes);
  }
}

function mergeCandidate(existing, incoming) {
  const incomingWins = compareCandidates(incoming, existing) < 0;
  const primary = incomingWins ? incoming : existing;
  const secondary = incomingWins ? existing : incoming;
  return {
    ...primary,
    sourceTable: primary.sourceTable || secondary.sourceTable,
    rawId: primary.rawId || secondary.rawId,
    title: primary.title || secondary.title,
    date: primary.date || secondary.date,
    url: primary.url || secondary.url,
    relevance: Math.max(primary.relevance ?? -Infinity, secondary.relevance ?? -Infinity) === -Infinity
      ? null
      : Math.max(primary.relevance ?? -Infinity, secondary.relevance ?? -Infinity),
    whyRelevant: primary.whyRelevant || secondary.whyRelevant,
    excerpt: primary.excerpt || secondary.excerpt,
    fingerprint: primary.fingerprint || secondary.fingerprint,
    typedIdentity: primary.typedIdentity || secondary.typedIdentity,
    titleDateIdentity: primary.titleDateIdentity || secondary.titleDateIdentity,
    evidenceKey: primary.evidenceKey || secondary.evidenceKey,
    duplicateCount: Number(existing.duplicateCount || 1) + Number(incoming.duplicateCount || 1)
  };
}

function selectEvidenceCandidates(candidates, limit) {
  const eligible = candidates.filter((candidate) => candidate.excerpt);
  const selected = [];
  const selectedKeys = new Set();
  const coveredTypes = new Set();
  for (const candidate of eligible) {
    const type = candidate.sourceTable || candidate.origin || "unknown";
    if (coveredTypes.has(type)) continue;
    selected.push(candidate);
    selectedKeys.add(candidate.evidenceKey);
    coveredTypes.add(type);
    if (selected.length >= limit) break;
  }
  for (const candidate of eligible) {
    if (selected.length >= limit) break;
    if (selectedKeys.has(candidate.evidenceKey)) continue;
    selected.push(candidate);
    selectedKeys.add(candidate.evidenceKey);
  }
  return selected.sort(compareCandidates);
}

function buildSourceRegistry({ selected, allCandidates, limit }) {
  const ordered = [];
  const seen = new Set();
  for (const candidate of [...selected, ...allCandidates]) {
    const key = candidate.evidenceKey;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(candidate);
    if (ordered.length >= limit) break;
  }
  const sourceMap = {};
  const evidenceToSource = new Map();
  ordered.forEach((candidate, index) => {
    const sourceId = `S${index + 1}`;
    evidenceToSource.set(candidate.evidenceKey, sourceId);
    sourceMap[sourceId] = removeUndefined({
      title: candidate.title || candidate.sourceTable || "Project source",
      date: candidate.date || null,
      source_table: candidate.sourceTable || null,
      record_id: candidate.rawId || null,
      url: candidate.url || null
    });
  });
  return { sourceMap, evidenceToSource };
}

function evidenceRecord(candidate, registry, excerptLimit) {
  return removeUndefined({
    evidence_id: candidate.evidenceKey,
    source_id: registry.evidenceToSource.get(candidate.evidenceKey) || null,
    source_table: candidate.sourceTable || null,
    record_id: candidate.rawId || null,
    title: candidate.title || candidate.sourceTable || "Project evidence",
    date: candidate.date || null,
    evidence_type: candidate.sourceTable || candidate.origin || "project_record",
    relevance: candidate.relevance,
    why_relevant: candidate.whyRelevant || null,
    evidence_excerpt: cleanText(candidate.excerpt, excerptLimit),
    duplicate_chunks_collapsed: Math.max(0, Number(candidate.duplicateCount || 1) - 1)
  });
}

function compactToolResult(call, { lookup, broad, detail }) {
  const toolName = String(call.toolName || call.tool_name || "project_tool");
  const sourceIds = uniqueStrings((Array.isArray(call.sources) ? call.sources : [])
    .map((source) => sourceIdForRecord(source, lookup))
    .filter(Boolean));
  const base = {
    tool_name: toolName,
    ok: call.ok === true,
    status: firstValue(call.data?.status, call.status, call.ok === true ? "ok" : "failed"),
    source_ids: sourceIds
  };
  if (detail === "minimal") return removeUndefined(base);
  if (toolName === "data_query") {
    const data = call.data && typeof call.data === "object" ? call.data : {};
    const exactFields = Object.fromEntries(Object.entries(data).filter(([key]) => /^exact_/i.test(key)));
    return removeUndefined({
      ...base,
      routing: compactMachineValue(data.routing, { stringLimit: 500, arrayLimit: broad ? 18 : 12, preserveExact: true }),
      machine_result: compactMachineValue(data.machineResult ?? data.machine_result, { stringLimit: 4000, arrayLimit: 200, preserveExact: true }),
      exact_facts: compactMachineValue(exactFields, { stringLimit: 4000, arrayLimit: 200, preserveExact: true }),
      metrics: compactMachineValue(data.metrics, { stringLimit: 1200, arrayLimit: 200, preserveExact: true }),
      warnings: compactMachineValue(data.warnings, { stringLimit: 1200, arrayLimit: 50, preserveExact: true })
    });
  }
  return removeUndefined({
    ...base,
    verified_facts: compactMachineValue(call.data, {
      stringLimit: 1200,
      arrayLimit: broad ? 18 : 12
    })
  });
}

function compactGraphContext(graphContext, { limit, sourceMap, excerptLimit }) {
  const lookup = buildSourceLookup(sourceMap);
  const relationships = (Array.isArray(graphContext) ? graphContext : [])
    .slice(0, Math.max(0, limit))
    .map((item) => removeUndefined({
      relation: cleanText(firstValue(item?.relation, item?.type), 120),
      source: cleanText(item?.source, 220),
      target: cleanText(item?.target, 220),
      confidence: finiteNumber(item?.confidence),
      evidence_excerpt: cleanText(firstValue(item?.evidence, item?.text, item?.summary), excerptLimit),
      evidence_source_id: sourceIdForRecord(item, lookup) || null
    }))
    .filter((item) => item.relation || item.source || item.target || item.evidence_excerpt);
  return {
    format: "compact_graph.v1",
    available: relationships.length > 0,
    relationship_count: relationships.length,
    relationships
  };
}

function buildSourceLookup(sourceMap) {
  const byUrl = new Map();
  const byTypedIdentity = new Map();
  const byTitle = new Map();
  for (const [sourceId, source] of Object.entries(sourceMap || {})) {
    if (source?.url) byUrl.set(normalizeUrlKey(source.url), sourceId);
    if (source?.source_table && source?.record_id) {
      byTypedIdentity.set(`${normalizeKey(source.source_table)}:${normalizeKey(source.record_id)}`, sourceId);
    }
    if (source?.title) byTitle.set(normalizeKey(source.title), sourceId);
  }
  return { byUrl, byTypedIdentity, byTitle };
}

function sourceIdForRecord(record, lookup) {
  if (!record || typeof record !== "object") return null;
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const url = safeHttpUrl(firstValue(record.url, record.source_url, record.data_link, metadata.url, metadata.source_url, metadata.data_link));
  if (url && lookup.byUrl.has(normalizeUrlKey(url))) return lookup.byUrl.get(normalizeUrlKey(url));
  const table = cleanIdentifier(firstValue(record.source_table, record.sourceTable, record.table, metadata.source_table));
  const rawId = cleanIdentifier(firstValue(record.source_id, record.sourceId, metadata.source_id, record.id, record.input_data_id));
  if (table && rawId) {
    const typed = `${normalizeKey(table)}:${normalizeKey(rawId)}`;
    if (lookup.byTypedIdentity.has(typed)) return lookup.byTypedIdentity.get(typed);
  }
  const title = cleanText(firstValue(record.title, record.label, metadata.title), 240);
  return title ? lookup.byTitle.get(normalizeKey(title)) || null : null;
}

function compactMachineValue(value, { stringLimit = 1000, arrayLimit = 12, preserveExact = false, depth = 0 } = {}) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return cleanText(value, preserveExact ? Math.max(stringLimit, 4000) : stringLimit);
  if (["number", "boolean"].includes(typeof value)) return value;
  if (typeof value === "bigint") return value.toString();
  if (depth >= 6) return undefined;
  if (Array.isArray(value)) {
    const bounded = preserveExact ? value : value.slice(0, arrayLimit);
    return bounded
      .map((item) => compactMachineValue(item, { stringLimit, arrayLimit, preserveExact, depth: depth + 1 }))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return cleanText(String(value), stringLimit);
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (URL_FIELD_NAMES.has(String(key).toLowerCase()) || INTERNAL_FIELD_PATTERN.test(key)) continue;
    const compacted = compactMachineValue(value[key], { stringLimit, arrayLimit, preserveExact, depth: depth + 1 });
    if (compacted !== undefined) output[key] = compacted;
  }
  return Object.keys(output).length ? output : undefined;
}

function recordUrl(row, resolveSourceUrl) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const direct = firstValue(
    row?.source_url,
    row?.url,
    row?.link,
    row?.data_link,
    row?.href,
    metadata.source_url,
    metadata.url,
    metadata.data_link
  );
  const resolved = direct || (typeof resolveSourceUrl === "function" ? resolveSourceUrl(row) : "");
  return safeHttpUrl(resolved);
}

function normalizeRows(results) {
  if (Array.isArray(results)) return results;
  if (Array.isArray(results?.data)) return results.data;
  if (Array.isArray(results?.matches)) return results.matches;
  if (Array.isArray(results?.documents)) return results.documents;
  if (results && typeof results === "object") return [results];
  return [];
}

function compareCandidates(left, right) {
  return Number(left.priority || 0) - Number(right.priority || 0)
    || Number(left.rank || 0) - Number(right.rank || 0)
    || Number(right.relevance || 0) - Number(left.relevance || 0)
    || String(left.evidenceKey || "").localeCompare(String(right.evidenceKey || ""));
}

function measureValue(value) {
  const serialized = stableStringify(value);
  const bytes = Buffer.byteLength(serialized, "utf8");
  return {
    bytes,
    estimated_tokens: Math.ceil(bytes / 4)
  };
}

function stableStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({ serialization_error: true });
  }
}

function safeHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeUrlKey(value) {
  return String(value || "").trim().replace(/\/$/, "").toLowerCase();
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : cleanText(raw, 40);
}

function cleanText(value, limit = 1000) {
  const text = String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, Math.max(0, Number(limit || 0)));
}

function cleanIdentifier(value) {
  return cleanText(value, 180);
}

function textFingerprint(value) {
  const normalized = normalizeKey(value);
  return normalized.length >= 40 ? shortHash(normalized) : "";
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function shortHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 14);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") ?? "";
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
