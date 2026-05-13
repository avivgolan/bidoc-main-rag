import { daysBetweenDates, eventTitle, extractApprover, normalizeTimelineSource } from "./timelineLinks.js";

export const TIMELINE_ENTITY_TYPES = ["supplier", "person", "company", "quote", "invoice", "work_package", "topic", "location"];
export const TIMELINE_ENTITY_ROLES = ["supplier", "approver", "quote", "invoice", "work_package", "topic", "location", "mentioned"];
export const TIMELINE_GRAPH_EDGE_TYPES = ["issued_by", "approved_by", "belongs_to", "references", "follows", "same_topic"];

export async function buildTimelineKnowledgeGraph({ events = [], eventEntities = [], graphEdges = [], links = [], source = "index" } = {}) {
  const graph = await createGraph();
  const normalizedSource = normalizeTimelineSource(source);
  const allEventEntities = eventEntities.length
    ? eventEntities
    : events.flatMap((event) => extractTimelineEntities(event, normalizedSource).eventEntities);

  for (const event of events) {
    graph.mergeNode(eventNodeId(normalizedSource, event.id), {
      kind: "event",
      source: normalizedSource,
      eventId: String(event.id),
      date: event.date,
      title: eventTitle(event)
    });
  }

  for (const item of allEventEntities) {
    const entity = item.entity || {
      id: item.entity_id || item.entityKey || entityKey(item.entity_type, item.name),
      entity_type: item.entity_type,
      name: item.name,
      normalized_name: normalizeName(item.name),
      metadata: item.metadata || {}
    };
    const eNode = entityNodeId(entity.id || entityKey(entity.entity_type, entity.name));
    graph.mergeNode(eNode, { kind: "entity", ...entity });
    graph.mergeEdge(eventNodeId(item.event_source || normalizedSource, item.event_id), eNode, {
      kind: "event_entity",
      role: item.role || "mentioned",
      confidence: Number(item.confidence || 0.5),
      evidenceText: item.evidence_text || ""
    });
  }

  for (const edge of graphEdges) {
    graph.mergeEdge(entityNodeId(edge.from_entity_id), entityNodeId(edge.to_entity_id), {
      kind: "entity_edge",
      edgeType: edge.edge_type,
      confidence: Number(edge.confidence || 0.5),
      evidenceEventSource: edge.evidence_event_source || normalizedSource,
      evidenceEventId: edge.evidence_event_id || null
    });
  }

  for (const link of links) {
    graph.mergeEdge(eventNodeId(link.source_event_source, link.source_event_id), eventNodeId(link.target_event_source, link.target_event_id), {
      kind: "saved_link",
      relationType: link.relation_type,
      confidence: 1
    });
  }

  return { graph, eventEntities: allEventEntities };
}

export function extractTimelineEntities(event, source = "index") {
  const eventSource = normalizeTimelineSource(event?.source || source);
  const text = eventText(event);
  const found = [];

  for (const tag of event?.tags || []) {
    const name = String(tag || "").trim();
    if (!name) continue;
    found.push(entityRecord({ event, eventSource, entityType: "topic", role: "topic", name, confidence: 0.62, evidenceText: `#${name}` }));
  }

  for (const quote of text.match(/\b(?:quote|proposal|quotation)[\s:#-]*([A-Za-z0-9_-]{2,})\b/gi) || []) {
    found.push(entityRecord({ event, eventSource, entityType: "quote", role: "quote", name: quote, confidence: 0.78, evidenceText: quote }));
  }

  for (const invoice of text.match(/\b(?:invoice|חשבונית)[\s:#-]*([A-Za-z0-9_-]{2,})\b/gi) || []) {
    found.push(entityRecord({ event, eventSource, entityType: "invoice", role: "invoice", name: invoice, confidence: 0.78, evidenceText: invoice }));
  }

  const approver = extractApprover(text);
  if (approver) {
    found.push(entityRecord({ event, eventSource, entityType: "person", role: "approver", name: approver, confidence: 0.84, evidenceText: approver }));
  }

  for (const company of extractLikelyCompanies(text)) {
    found.push(entityRecord({ event, eventSource, entityType: "company", role: "supplier", name: company, confidence: 0.58, evidenceText: company }));
  }

  return { eventEntities: uniqueEventEntities(found) };
}

export function createTimelineGraphScorer({ eventEntities = [], source = "index" } = {}) {
  const normalizedSource = normalizeTimelineSource(source);
  const byEvent = new Map();
  for (const item of eventEntities || []) {
    const eventSource = normalizeTimelineSource(item.event_source || normalizedSource);
    const eventId = String(item.event_id || "");
    if (!eventId) continue;
    const normalized = normalizeEventEntity(item);
    if (!normalized?.entity?.id) continue;
    const key = `${eventSource}|${eventId}`;
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(normalized);
  }
  return (pair) => scoreTimelinePairWithGraph({ ...pair, source: normalizedSource, eventEntitiesByEvent: byEvent });
}

export function scoreTimelinePairWithGraph({ sourceEvent, targetEvent, source = "index", eventEntitiesByEvent = null }) {
  const normalizedSource = normalizeTimelineSource(source);
  const sourceEntities = entitiesForScoring(sourceEvent, normalizedSource, eventEntitiesByEvent);
  const targetEntities = entitiesForScoring(targetEvent, normalizedSource, eventEntitiesByEvent);
  const shared = sharedEntities(sourceEntities, targetEntities);
  const durationDays = daysBetweenDates(sourceEvent?.date, targetEvent?.date);
  const roleBonus = shared.some((item) => ["quote", "invoice"].includes(item.role)) ? 18 : 0;
  const supplierBonus = shared.some((item) => ["supplier", "approver"].includes(item.role)) ? 16 : 0;
  const topicBonus = shared.filter((item) => item.role === "topic").length * 8;
  const timeScore = Math.max(0, 35 - Math.min(durationDays ?? 35, 35));
  return {
    graphScore: roleBonus + supplierBonus + topicBonus + timeScore,
    graphSharedEntities: shared,
    durationDays
  };
}

function entitiesForScoring(event, source, eventEntitiesByEvent) {
  const key = `${normalizeTimelineSource(event?.source || source)}|${String(event?.id || "")}`;
  const stored = eventEntitiesByEvent?.get?.(key) || eventEntitiesByEvent?.get?.(`${source}|${String(event?.id || "")}`);
  if (stored?.length) return stored;
  return extractTimelineEntities(event, source).eventEntities;
}

function normalizeEventEntity(item = {}) {
  const entity = item.entity || {
    id: item.entity_id || entityKey(item.entity_type, item.name),
    entity_type: item.entity_type || "topic",
    name: item.name || item.entity_id || "",
    normalized_name: normalizeName(item.name || item.entity_id || ""),
    metadata: item.metadata || {}
  };
  if (!entity.id && entity.name) entity.id = entityKey(entity.entity_type, entity.name);
  return {
    ...item,
    role: item.role || "mentioned",
    confidence: Number(item.confidence || 0.5),
    entity
  };
}

export function buildEntityGraphRowsForEvents(events = [], source = "index") {
  const entities = new Map();
  const eventEntities = [];
  for (const event of events) {
    const extracted = extractTimelineEntities(event, source).eventEntities;
    for (const item of extracted) {
      entities.set(item.entity.id, item.entity);
      eventEntities.push({
        event_source: item.event_source,
        event_id: item.event_id,
        entity_id: item.entity.id,
        role: item.role,
        confidence: item.confidence,
        evidence_text: item.evidence_text
      });
    }
  }
  return { entities: [...entities.values()], eventEntities };
}

async function createGraph() {
  try {
    const mod = await import("graphology");
    const Graph = mod.default || mod.Graph || mod.DirectedGraph;
    return new Graph({ multi: true, type: "directed" });
  } catch {
    return new SimpleGraph();
  }
}

function entityRecord({ event, eventSource, entityType, role, name, confidence, evidenceText }) {
  const normalized = normalizeName(name);
  return {
    event_source: eventSource,
    event_id: String(event?.id || ""),
    entity_type: entityType,
    role,
    name: String(name || "").trim(),
    confidence,
    evidence_text: String(evidenceText || "").slice(0, 240),
    entity: {
      id: entityKey(entityType, normalized),
      entity_type: entityType,
      name: String(name || "").trim(),
      normalized_name: normalized,
      metadata: {}
    }
  };
}

function uniqueEventEntities(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.event_source}|${item.event_id}|${item.entity.id}|${item.role}`;
    if (seen.has(key) || !item.event_id || !item.entity.name) return false;
    seen.add(key);
    return true;
  });
}

function sharedEntities(a, b) {
  const byId = new Map(a.map((item) => [item.entity.id, item]));
  return b
    .filter((item) => byId.has(item.entity.id))
    .map((item) => ({
      id: item.entity.id,
      name: item.entity.name,
      entityType: item.entity.entity_type,
      role: item.role,
      sourceRole: byId.get(item.entity.id)?.role || ""
    }));
}

function extractLikelyCompanies(text) {
  const matches = [];
  const patterns = [
    /\b([A-Z][A-Za-z0-9&.' -]{2,40}\s(?:Ltd|LLC|Inc|Group|Systems|Construction))\b/g,
    /(?:ספק|קבלן|חברה)[:\s]+([א-תA-Za-z0-9 .'"-]{2,50})/g
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) matches.push(cleanName(match[1]));
  }
  return [...new Set(matches.filter(Boolean))].slice(0, 5);
}

function eventText(event) {
  return `${event?.content || ""} ${(event?.tags || []).join(" ")} ${JSON.stringify(event?.metadata || {})}`;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, " ");
}

function cleanName(value) {
  return String(value || "").replace(/[.,;:|]+.*$/, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function entityKey(type, name) {
  return `${type}:${normalizeName(name)}`;
}

function entityNodeId(id) {
  return `entity:${id}`;
}

function eventNodeId(source, id) {
  return `event:${normalizeTimelineSource(source)}:${String(id)}`;
}

class SimpleGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  mergeNode(id, attrs = {}) {
    this.nodes.set(id, { ...(this.nodes.get(id) || {}), ...attrs });
  }

  mergeEdge(source, target, attrs = {}) {
    this.edges.push({ source, target, attrs });
  }
}
