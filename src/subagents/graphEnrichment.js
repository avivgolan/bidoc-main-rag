// Graph Entity Enrichment Agent (docs/graph-entity-enrichment-agent-spec.md, Task G1).
// An INTERNAL agent (part of the n8n phase-out): extracts real entities
// (contractors, people, suppliers, organizations, locations) from record text and
// enriches graph_nodes/graph_edges so that graph-based clustering (phase-2 Task 4)
// becomes possible. Two tiers: free deterministic extractors, then a batched
// lite-LLM pass. The grounding rule — evidence must appear in the record text —
// is enforced in code, never trusted to the prompt.

import { chatCompletion, extractJsonObject } from "../openrouter.js";
import { normalizeGraphRecord } from "../projectGraph.js";
import { fetchAlertsTimelineEvents, fetchTimelineEvents, listEntityMentionEdges, upsertProjectGraphData } from "../supabase.js";
import { extractApprover } from "../timelineLinks.js";
import { extractLikelyCompanies } from "../timelineGraph.js";

export const GRAPH_ENRICHMENT_VERSION = "graph-enrichment-v1";
const ENTITY_KINDS = new Set(["contractor", "person", "supplier", "organization", "location"]);
const KIND_TO_NODE_TYPE = {
  contractor: "company",
  person: "person",
  supplier: "supplier",
  organization: "company",
  location: "topic"
};
const LLM_BATCH_SIZE = 15;
const LLM_TEXT_SLICE = 700;
// Generic role words that are not an identity on their own ("קבלן" alone is noise;
// "קבלן גבס אחים לוי" is an entity).
const GENERIC_NAME_BLOCKLIST = new Set([
  "קבלן", "ספק", "מנהל", "לקוח", "מזמין", "יועץ", "מפקח", "עובד", "צוות",
  "חברה", "פרויקט", "אתר", "מהנדס", "אדריכל", "קבלן משנה", "מנהל עבודה",
  "מנהל פרויקט", "היזם", "יזם", "מזמין העבודה", "בעל הבית", "הצוות",
  "לא צוין", "לא ידוע", "לא רלוונטי", "אין",
  "supplier", "contractor", "manager", "client", "unknown", "n/a"
]);
const HONORIFICS = /^(?:מר|גב'|גברת|ד"ר|דר'|אינג'|עו"ד|אדון)\s+/u;
const COMPANY_SUFFIX = /\s+(?:בע"מ|בעמ|ltd\.?|inc\.?)\s*$/iu;

export function normalizeEntityName(value = "") {
  let text = String(value || "")
    .replace(/["'״׳`]+/g, (match, offset, whole) => {
      // Keep gershayim inside acronyms/company names handled by the suffix rule;
      // strip decorative quotes at the edges.
      const inWord = offset > 0 && offset < whole.length - 1 && /[\p{L}]/u.test(whole[offset - 1]) && /[\p{L}]/u.test(whole[offset + 1]);
      return inWord ? match : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  text = text.replace(HONORIFICS, "");
  text = text.replace(COMPANY_SUFFIX, "");
  return text.replace(/\s+/g, " ").trim();
}

export function entityIdFor(kind, name) {
  const normalized = normalizeEntityName(name).toLowerCase();
  return `${kind}:${normalized}`;
}

export function isAcceptableEntityName(name = "") {
  const normalized = normalizeEntityName(name);
  if (!normalized) return false;
  if (GENERIC_NAME_BLOCKLIST.has(normalized.toLowerCase())) return false;
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 2 && normalized.length < 4) return false;
  // A single generic word with an adjective is still generic ("קבלן משנה" is blocked
  // above); a single remaining blocklist word after normalization is rejected too.
  if (words.length === 1 && GENERIC_NAME_BLOCKLIST.has(words[0].toLowerCase())) return false;
  return true;
}

// Code-enforced grounding: the cited evidence must actually appear in the record
// text (whitespace-normalized). Entities without grounded evidence are dropped.
export function validateExtractedEntities(items = [], recordText = "") {
  const haystack = String(recordText || "").replace(/\s+/g, " ").trim();
  const accepted = [];
  const rejected = [];
  for (const item of Array.isArray(items) ? items : []) {
    const kind = String(item?.kind || "").toLowerCase().trim();
    const evidence = String(item?.evidence || "").replace(/\s+/g, " ").trim();
    // Models sometimes pack several people into one string ("אור שטמרמן, זיו") —
    // each part is its own entity, validated separately.
    const nameParts = String(item?.name || "").split(/[,;]+/).map((part) => normalizeEntityName(part)).filter(Boolean);
    for (const name of nameParts.length ? nameParts : [""]) {
      if (!ENTITY_KINDS.has(kind)) { rejected.push({ name, reason: "invalid_kind" }); continue; }
      if (!isAcceptableEntityName(name)) { rejected.push({ name, reason: "generic_or_short_name" }); continue; }
      if (!evidence || !haystack.includes(evidence)) { rejected.push({ name, reason: "ungrounded_evidence" }); continue; }
      accepted.push({
        kind,
        name,
        role: String(item?.role || "").slice(0, 60),
        evidence: evidence.slice(0, 240),
        confidence: 0.7,
        extraction: "llm"
      });
    }
  }
  return { accepted, rejected };
}

// Tier 1: free deterministic extraction — existing text extractors plus the
// metadata fields the base graph builder already understands (usually empty in
// KAPAIM data, but honored when present).
export function splitPersonNames(value = "") {
  return String(value || "")
    .split(/[,;]+/)
    .map((part) => normalizeEntityName(part))
    .filter(Boolean);
}

export function collectDeterministicEntities(normalizedRecord) {
  const entities = [];
  const text = normalizedRecord.text || "";
  const approver = extractApprover(text);
  for (const name of splitPersonNames(approver)) {
    if (!isAcceptableEntityName(name)) continue;
    entities.push({ kind: "person", name, role: "approver", evidence: String(approver).slice(0, 240), confidence: 0.85, extraction: "deterministic" });
  }
  for (const company of extractLikelyCompanies(text) || []) {
    if (!isAcceptableEntityName(company)) continue;
    entities.push({ kind: "organization", name: normalizeEntityName(company), role: "company", evidence: String(company).slice(0, 240), confidence: 0.7, extraction: "deterministic" });
  }
  const metadata = normalizedRecord.metadata || {};
  if (metadata.vendor_name && isAcceptableEntityName(metadata.vendor_name)) {
    entities.push({ kind: "supplier", name: normalizeEntityName(metadata.vendor_name), role: "vendor", evidence: String(metadata.vendor_name).slice(0, 240), confidence: 0.85, extraction: "metadata" });
  }
  for (const person of [].concat(metadata.people || [], metadata.mentioned_responsibles || [])) {
    if (typeof person !== "string") continue;
    for (const name of splitPersonNames(person)) {
      if (!isAcceptableEntityName(name)) continue;
      entities.push({ kind: "person", name, role: "mentioned", evidence: String(person).slice(0, 240), confidence: 0.8, extraction: "metadata" });
    }
  }
  return dedupeEntities(entities);
}

export function buildEntityGraphRows(recordEntities = []) {
  const nodes = new Map();
  const edges = new Map();
  for (const { record, entities } of recordEntities) {
    if (!record?.sourceId || !entities?.length) continue;
    nodes.set(record.nodeId, {
      id: record.nodeId,
      node_type: record.nodeType,
      label: String(record.title || record.nodeId).slice(0, 240),
      source_table: record.sourceTable,
      source_id: record.sourceId,
      event_date: record.date || null,
      metadata: { source_table: record.sourceTable, source_id: record.sourceId, title: record.title || null }
    });
    for (const entity of entities) {
      const entityId = entityIdFor(entity.kind, entity.name);
      if (!nodes.has(entityId)) {
        nodes.set(entityId, {
          id: entityId,
          node_type: KIND_TO_NODE_TYPE[entity.kind] || "topic",
          label: entity.name.slice(0, 240),
          normalized_label: entity.name.toLowerCase(),
          source_table: null,
          source_id: null,
          event_date: null,
          metadata: { entity_kind: entity.kind, enrichment: GRAPH_ENRICHMENT_VERSION }
        });
      }
      const edgeKey = `${record.nodeId}|${entityId}|mentions`;
      if (!edges.has(edgeKey)) {
        edges.set(edgeKey, {
          from_node_id: record.nodeId,
          to_node_id: entityId,
          edge_type: "mentions",
          weight: entity.confidence,
          confidence: entity.confidence,
          evidence_text: entity.evidence,
          metadata: {
            source_table: record.sourceTable,
            source_id: record.sourceId,
            edge_kind: "mentions",
            target_kind: entity.kind,
            role: entity.role || null,
            extraction: entity.extraction,
            enrichment: GRAPH_ENRICHMENT_VERSION
          }
        });
      }
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export async function runGraphEnrichment({
  config,
  source = "index",
  dateFrom = null,
  dateTo = null,
  limit = 200,
  mode = "incremental",
  runId = null,
  emit = null
} = {}) {
  const summary = {
    enrichment_version: GRAPH_ENRICHMENT_VERSION,
    source,
    mode,
    records: 0,
    skippedExisting: 0,
    llmCalls: 0,
    entities: 0,
    entitiesByKind: {},
    rejectedByReason: {},
    nodesUpserted: 0,
    edgesUpserted: 0
  };

  const rawRecords = source === "alerts"
    ? await fetchAlertsTimelineEvents({ config, limit: Math.min(limit * 5, 4000) })
    : await fetchTimelineEvents({ config, limit: Math.min(limit * 5, 4000) });
  let records = (rawRecords || [])
    .map((record) => normalizeGraphRecord(record, source === "alerts" ? "alerts" : config?.contentSource?.indexTable || "data_index"))
    .filter((record) => record.sourceId && record.text);
  if (dateFrom) records = records.filter((record) => !record.date || String(record.date).slice(0, 10) >= dateFrom);
  if (dateTo) records = records.filter((record) => !record.date || String(record.date).slice(0, 10) <= dateTo);

  if (mode === "incremental") {
    const enriched = await alreadyEnrichedSourceKeys({ config });
    const before = records.length;
    records = records.filter((record) => !enriched.has(`${record.sourceTable}:${record.sourceId}`));
    summary.skippedExisting = before - records.length;
  }
  records = records.slice(0, limit);
  summary.records = records.length;
  emit?.(runId, "graph_enrichment", `Enriching ${records.length} records (${summary.skippedExisting} already enriched)`, { ...summary, status: "running" });
  if (!records.length) return summary;

  const recordEntities = records.map((record) => ({ record, entities: collectDeterministicEntities(record) }));

  if (config?.openRouterApiKey) {
    const batches = chunk(recordEntities, LLM_BATCH_SIZE);
    // Modest parallelism: 3 concurrent lite calls keeps backfills tractable
    // (~1000 records in ~10-12 minutes) without hammering the provider.
    for (const group of chunk(batches, 3)) {
      await Promise.all(group.map((batch) => enrichBatchWithLlm({ config, batch, summary, runId, emit })));
    }
  }

  for (const item of recordEntities) {
    for (const entity of item.entities) {
      summary.entities += 1;
      summary.entitiesByKind[entity.kind] = (summary.entitiesByKind[entity.kind] || 0) + 1;
    }
  }

  const rows = buildEntityGraphRows(recordEntities);
  if (rows.nodes.length) {
    const saved = await upsertProjectGraphData({ config, nodes: rows.nodes, edges: rows.edges });
    summary.nodesUpserted = saved.nodes;
    summary.edgesUpserted = saved.edges;
  }
  emit?.(runId, "graph_enrichment", `Graph enriched: ${summary.entities} entity mentions across ${records.length} records`, { ...summary, status: "done" });
  return summary;
}

async function enrichBatchWithLlm({ config, batch, summary, runId, emit }) {
  try {
    summary.llmCalls += 1;
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models?.lite || config.models?.classifier || "openai/gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 3000,
      timeoutMs: 60_000,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You extract real named entities from Hebrew construction-project records.",
            "For each record, list entities of kinds: contractor, person, supplier, organization, location.",
            "Rules:",
            "- Extract ONLY names that literally appear in the text. Never infer or invent.",
            "- evidence must be a short verbatim quote from the record text containing the name.",
            "- Generic role words alone (קבלן, ספק, מנהל, יועץ) are NOT entities; a role word with a name is (e.g. \"קבלן הגבס אחים לוי\").",
            "- Skip hashtags, dates, quantities, and document names.",
            "Return ONLY valid JSON: {\"records\":[{\"index\":0,\"entities\":[{\"name\":\"string\",\"kind\":\"contractor|person|supplier|organization|location\",\"role\":\"string\",\"evidence\":\"quote\"}]}]}"
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            records: batch.map((item, index) => ({ index, text: item.record.text.slice(0, LLM_TEXT_SLICE) }))
          })
        }
      ]
    });
    const parsed = extractJsonObject(content);
    for (const entry of Array.isArray(parsed?.records) ? parsed.records : []) {
      const target = batch[Number(entry?.index)];
      if (!target) continue;
      const { accepted, rejected } = validateExtractedEntities(entry?.entities, target.record.text);
      target.entities = dedupeEntities([...target.entities, ...accepted]);
      for (const item of rejected) {
        summary.rejectedByReason[item.reason] = (summary.rejectedByReason[item.reason] || 0) + 1;
      }
    }
  } catch (error) {
    emit?.(runId, "graph_enrichment", "LLM entity extraction batch failed; deterministic tier kept", { error: error.message, status: "warning" });
  }
}

async function alreadyEnrichedSourceKeys({ config }) {
  try {
    const links = await listEntityMentionEdges({ config, limit: 5000 });
    return new Set(links.map((link) => link.record_ref));
  } catch {
    return new Set();
  }
}

function dedupeEntities(entities = []) {
  const seen = new Map();
  for (const entity of entities) {
    const key = entityIdFor(entity.kind, entity.name);
    const existing = seen.get(key);
    if (!existing || (entity.confidence || 0) > (existing.confidence || 0)) seen.set(key, entity);
  }
  return [...seen.values()];
}

function chunk(items = [], size = 10) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}
