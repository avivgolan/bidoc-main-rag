const GRAPH_NODE_TYPES = new Set(["event", "alert", "supplier", "person", "company", "document", "topic", "risk", "invoice", "quote", "source"]);
const GRAPH_EDGE_TYPES = new Set(["mentions", "caused_by", "blocks", "approved_by", "related_to", "same_topic", "from_document", "has_status", "has_risk"]);

export function buildGraphRowsFromRecords(records = [], { defaultSource = "data_index" } = {}) {
  const nodes = new Map();
  const edges = new Map();
  for (const record of records || []) {
    const normalized = normalizeGraphRecord(record, defaultSource);
    if (!normalized.sourceId) continue;
    addNode(nodes, sourceNode(normalized));
    for (const entity of extractGraphEntities(normalized)) {
      addNode(nodes, entity);
      addEdge(edges, {
        from_node_id: normalized.nodeId,
        to_node_id: entity.id,
        edge_type: edgeTypeForEntity(entity.node_type, entity),
        weight: entity.weight || 0.65,
        confidence: entity.confidence || 0.65,
        evidence_text: entity.evidence_text || normalized.text.slice(0, 240),
        metadata: {
          source_table: normalized.sourceTable,
          source_id: normalized.sourceId,
          edge_kind: entity.edgeKind || entity.metadata?.edge_kind || edgeTypeForEntity(entity.node_type, entity),
          target_kind: entity.entityKind || entity.metadata?.entity_kind || entity.node_type
        }
      });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function summarizeGraphContext(context = {}, limit = 12) {
  const items = normalizeGraphResults(context).slice(0, limit);
  if (!items.length) return [];
  return items.map((item) => ({
    relation: item.edge_type || item.edgeType || "related_to",
    source: graphNodeLabel(item.source_node || item.source || item.from_node),
    target: graphNodeLabel(item.target_node || item.target || item.to_node),
    confidence: item.confidence ?? item.weight ?? null,
    evidence: String(item.evidence_text || item.reason || "").slice(0, 240)
  }));
}

export function buildGraphSearchPayload({ query = "", records = [], maxRows = 30 } = {}) {
  const sourceRefs = normalizeRows(records)
    .map((record) => {
      const normalized = normalizeGraphRecord(record);
      return normalized.sourceId ? {
        node_id: normalized.nodeId,
        source_table: normalized.sourceTable,
        source_id: normalized.sourceId
      } : null;
    })
    .filter(Boolean);
  return {
    query_text: query,
    source_refs: sourceRefs,
    max_rows: maxRows
  };
}

export function normalizeGraphResults(value = {}) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.edges)) return value.edges;
  if (Array.isArray(value.graphContext)) return value.graphContext;
  return [];
}

export function normalizeGraphRecord(record = {}, defaultSource = "data_index") {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const isAlert = Boolean(record.alert_type || record.alert_description || record.data_date || String(record.id || "").startsWith("alert_") || record.source === "alert");
  const sourceTable = String(record.source_table || metadata.source_table || record.sourceTable || (isAlert ? "alerts" : defaultSource) || "data_index");
  const rawId = record.source_id || metadata.source_id || record.id || record.input_data_id || metadata.input_data_id || "";
  const sourceId = String(rawId).replace(/^alert_/, "").trim();
  const nodeType = isAlert || sourceTable === "alerts" ? "alert" : "event";
  const text = recordText(record);
  return {
    nodeId: sourceNodeId(sourceTable, sourceId),
    nodeType,
    sourceTable,
    sourceId,
    title: record.title || metadata.title || text.slice(0, 80) || `${sourceTable} ${sourceId}`,
    text,
    date: record.primary_date || record.data_date || record.date || record.created_at || metadata.primary_date || metadata.data_date || metadata.date || "",
    tags: normalizeTags(record.hashtags || record.tags || metadata.hashtags || metadata.tags),
    metadata: { ...metadata, source_table: sourceTable, source_id: sourceId }
  };
}

function sourceNode(record) {
  return {
    id: record.nodeId,
    node_type: record.nodeType,
    label: record.title,
    source_table: record.sourceTable,
    source_id: record.sourceId,
    event_date: record.date || null,
    metadata: compactSourceMetadata(record)
  };
}

function compactSourceMetadata(record) {
  return {
    source_table: record.sourceTable,
    source_id: record.sourceId,
    tags: record.tags,
    url: record.metadata?.url || record.metadata?.source_url || record.metadata?.data_link || null,
    title: record.title || null,
    source_kind: record.nodeType,
    category: record.metadata?.category || null,
    status: record.metadata?.item_status || record.metadata?.status || null,
    vendor_name: record.metadata?.vendor_name || null,
    document_filename: record.metadata?.document_filename || null,
    mail_id: record.metadata?.mail_id || null,
    attachment_id: record.metadata?.attachment_id || null
  };
}

function extractGraphEntities(record) {
  const entities = [];
  for (const tag of record.tags) {
    entities.push(entityNode("topic", tag, { entityKind: "hashtag", edgeKind: "has_hashtag", confidence: 0.86, evidence_text: `#${tag}` }));
  }
  for (const person of splitNames(record.metadata.people)) {
    entities.push(entityNode("person", person, { entityKind: "person", edgeKind: "mentions_person", confidence: 0.82, evidence_text: person }));
  }
  for (const person of normalizeArray(record.metadata.mentioned_responsibles)) {
    if (isUsefulName(person)) entities.push(entityNode("person", person, { entityKind: "person", edgeKind: "mentions_person", confidence: 0.78, evidence_text: person }));
  }
  if (record.metadata.vendor_name) {
    entities.push(entityNode("supplier", record.metadata.vendor_name, { entityKind: "vendor", edgeKind: "has_vendor", confidence: 0.84, evidence_text: record.metadata.vendor_name }));
  }
  if (record.metadata.transaction_submitter) {
    entities.push(entityNode("company", record.metadata.transaction_submitter, { entityKind: "submitter", edgeKind: "submitted_by", confidence: 0.72, evidence_text: record.metadata.transaction_submitter }));
  }
  if (record.metadata.category) {
    entities.push(entityNode("topic", record.metadata.category, { entityKind: "category", edgeKind: "has_category", confidence: 0.76, evidence_text: record.metadata.category }));
  }
  if (record.metadata.transaction_type) {
    entities.push(entityNode("topic", record.metadata.transaction_type, { entityKind: "transaction_type", edgeKind: "has_transaction_type", confidence: 0.76, evidence_text: record.metadata.transaction_type }));
  }
  if (record.metadata.item_status || record.metadata.status) {
    const status = record.metadata.item_status || record.metadata.status;
    entities.push(entityNode("topic", status, { entityKind: "status", edgeKind: "has_status", confidence: 0.7, evidence_text: status }));
  }
  if (record.sourceTable) {
    entities.push(entityNode("source", record.sourceTable, { entityKind: "source_table", edgeKind: "from_source_table", confidence: 0.68, evidence_text: record.sourceTable }));
  }
  if (record.metadata.document_filename) {
    entities.push(entityNode("document", record.metadata.document_filename, { entityKind: "document", edgeKind: "in_document", confidence: 0.86, evidence_text: record.metadata.document_filename }));
  }
  if (record.metadata.mail_id) {
    entities.push(entityNode("source", shortIdentifier(record.metadata.mail_id, "mail"), { entityKind: "email", edgeKind: "from_email", confidence: 0.74, evidence_text: "mail_id" }));
  }
  if (record.metadata.attachment_id) {
    entities.push(entityNode("document", shortIdentifier(record.metadata.attachment_id, "attachment"), { entityKind: "attachment", edgeKind: "has_attachment", confidence: 0.74, evidence_text: "attachment_id" }));
  }
  for (const date of normalizeArray(record.metadata.mentioned_dates)) {
    if (date) entities.push(entityNode("topic", date, { entityKind: "date", edgeKind: "mentions_date", confidence: 0.7, evidence_text: date }));
  }
  const text = record.text;
  for (const quote of text.match(/\b(?:quote|proposal|quotation)[\s:#-]*([A-Za-z0-9_-]{2,})\b/gi) || []) {
    entities.push(entityNode("quote", quote, { confidence: 0.78, evidence_text: quote }));
  }
  for (const invoice of text.match(/\b(?:invoice|חשבונית)[\s:#-]*([A-Za-z0-9_-]{2,})\b/gi) || []) {
    entities.push(entityNode("invoice", invoice, { confidence: 0.78, evidence_text: invoice }));
  }
  for (const risk of extractRiskTerms(text)) {
    entities.push(entityNode("risk", risk, { confidence: 0.72, evidence_text: risk }));
  }
  for (const company of extractLikelyCompanies(text)) {
    entities.push(entityNode("company", company, { confidence: 0.58, evidence_text: company }));
  }
  return uniqueNodes(entities);
}

function entityNode(type, name, extra = {}) {
  const normalized = normalizeName(name);
  const entityKind = extra.entityKind || type;
  return {
    id: `${entityKind}:${normalized}`,
    node_type: GRAPH_NODE_TYPES.has(type) ? type : "topic",
    label: String(name || "").trim(),
    normalized_label: normalized,
    metadata: {
      entity_kind: entityKind,
      edge_kind: extra.edgeKind || edgeTypeForEntity(type)
    },
    ...extra
  };
}

function addNode(nodes, node) {
  if (!node?.id) return;
  nodes.set(node.id, {
    id: node.id,
    node_type: GRAPH_NODE_TYPES.has(node.node_type) ? node.node_type : "topic",
    label: String(node.label || node.id).slice(0, 240),
    normalized_label: normalizeName(node.normalized_label || node.label || node.id),
    source_table: node.source_table || null,
    source_id: node.source_id || null,
    event_date: node.event_date || null,
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {}
  });
}

function addEdge(edges, edge) {
  if (!edge?.from_node_id || !edge?.to_node_id || edge.from_node_id === edge.to_node_id) return;
  const edgeType = GRAPH_EDGE_TYPES.has(edge.edge_type) ? edge.edge_type : "related_to";
  const key = `${edge.from_node_id}|${edge.to_node_id}|${edgeType}`;
  edges.set(key, {
    from_node_id: edge.from_node_id,
    to_node_id: edge.to_node_id,
    edge_type: edgeType,
    weight: Number(edge.weight || 0.5),
    confidence: Number(edge.confidence || edge.weight || 0.5),
    evidence_text: String(edge.evidence_text || "").slice(0, 500),
    metadata: edge.metadata && typeof edge.metadata === "object" ? edge.metadata : {}
  });
}

function edgeTypeForEntity(nodeType, entity = {}) {
  const semantic = entity.metadata?.edge_kind || entity.edgeKind;
  if (semantic === "has_status") return "has_status";
  if (semantic === "has_risk") return "has_risk";
  if (semantic === "in_document" || semantic === "from_email" || semantic === "has_attachment") return "from_document";
  return {
    source: "from_document",
    risk: "has_risk"
  }[nodeType] || "mentions";
}

function sourceNodeId(sourceTable, sourceId) {
  return `${sourceTable}:${sourceId}`;
}

function recordText(record = {}) {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  return String(
    record.content ||
      record.index_text ||
      record.summary ||
      record.title ||
      record.alert_description ||
      record.answer ||
      record.analyzed_data ||
      record.question ||
      record.text ||
      metadata.content ||
      metadata.index_text ||
      metadata.summary ||
      metadata.title ||
      ""
  );
}

function normalizeRows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  return [];
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return [...new Set(value.map((tag) => String(tag || "").replace(/^#+/, "").trim()).filter(Boolean))];
  return String(value).match(/#[א-ת\w]+/gu)?.map((tag) => tag.replace(/^#+/, "")) || [];
}

function extractRiskTerms(text) {
  const terms = ["עיכוב", "עיכובים", "חסם", "חסמים", "סיכון", "סיכונים", "delay", "blocker", "risk", "dependency"];
  const lower = String(text || "").toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

function extractLikelyCompanies(text) {
  const matches = [];
  const patterns = [
    /\b([A-Z][A-Za-z0-9&.' -]{2,40}\s(?:Ltd|LLC|Inc|Group|Systems|Construction))\b/g,
    /(?:ספק|קבלן|חברה)[:\s]+([א-תA-Za-z0-9 .'"-]{2,50})/g
  ];
  for (const pattern of patterns) {
    for (const match of String(text || "").matchAll(pattern)) matches.push(cleanName(match[1]));
  }
  return [...new Set(matches.filter(Boolean))].slice(0, 5);
}

function uniqueNodes(items) {
  return [...new Map(items.filter((item) => item.id && item.label).map((item) => [item.id, item])).values()];
}

function graphNodeLabel(node = {}) {
  if (!node || typeof node !== "object") return "";
  return node.label || node.name || node.id || "";
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, " ");
}

function cleanName(value) {
  return String(value || "").replace(/[.,;:|]+.*$/, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function splitNames(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(splitNames);
  return String(value)
    .split(/[,;|،\n]+/)
    .map((item) => item.trim())
    .filter(isUsefulName)
    .slice(0, 12);
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return splitNames(value);
}

function isUsefulName(value) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "לא צוין" && text !== "לא ידוע" && text !== "-");
}

function shortIdentifier(value, prefix) {
  const text = String(value || "").trim();
  if (!text) return prefix;
  return `${prefix}:${text.slice(-18)}`;
}
