import { createEmbedding } from "./openrouter.js";
import { supabaseHeaders } from "./config.js";
import { addDurationToLink, TIMELINE_RELATION_TYPES } from "./timelineLinks.js";
import { CACHE_TTL, cachedOperation } from "./cache.js";

const MESSAGES_TABLE = "chat_messages_gf";
const TIMELINE_LINKS_TABLE = "timeline_event_links";
const TIMELINE_ENTITIES_TABLE = "timeline_entities";
const TIMELINE_EVENT_ENTITIES_TABLE = "timeline_event_entities";
const TIMELINE_GRAPH_EDGES_TABLE = "timeline_graph_edges";
const GRAPH_NODES_TABLE = "graph_nodes";
const GRAPH_EDGES_TABLE = "graph_edges";
const GRAPH_UPSERT_BATCH_SIZE = 300;
const GRAPH_NODE_TYPES = new Set(["event", "alert", "supplier", "person", "company", "document", "topic", "risk", "invoice", "quote", "source"]);
const GRAPH_EDGE_TYPES = new Set(["mentions", "caused_by", "blocks", "approved_by", "related_to", "same_topic", "from_document", "has_status", "has_risk"]);

export async function saveMessage({ config, userMessage, sanitizedMessage, sessionId }) {
  if (!isConfigured(config)) return localMessage({ userMessage, sanitizedMessage, sessionId });
  const response = await supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_message: userMessage,
      session_id: sessionId,
      sanitzed_user_message: sanitizedMessage,
      status: "processing"
    })
  });
  return response?.[0] || localMessage({ userMessage, sanitizedMessage, sessionId });
}

export async function updateMessage({ config, messageId, aiResponse, status = "done", workflowLog = null, runEvents = null }) {
  if (!isConfigured(config) || String(messageId).startsWith("local_")) return null;
  const patch = { ai_response: aiResponse, status };
  if (workflowLog !== null) patch.workflow_log = workflowLog;
  if (runEvents !== null) patch.run_events = runEvents;
  return supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
}

export async function getMessage({ config, messageId }) {
  if (!isConfigured(config)) return null;
  const rows = await supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}&select=*&limit=1`
  );
  return rows?.[0] || null;
}

export async function listDislikedMessages({ config, limit = 50 }) {
  if (!isConfigured(config)) return [];
  return supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?select=id,user_message,ai_response,created_at,session_id,annotation,workflow_log&annotation=eq.X&status=eq.done&order=created_at.desc&limit=${limit}`
  );
}

export async function listQaMessages({ config, limit = 50, dislikedOnly = false }) {
  if (!isConfigured(config)) return [];
  const annotationFilter = dislikedOnly ? "&annotation=eq.X" : "";
  return supabaseFetch(config,
    `/rest/v1/${MESSAGES_TABLE}?select=id,user_message,ai_response,created_at,session_id,annotation&status=eq.done&workflow_log=not.is.null${annotationFilter}&order=created_at.desc&limit=${limit}`
  );
}

const QA_TABLE = "qa_reports";

export async function saveQaReport({ config, messageId, status, report = null, error = null }) {
  if (!isConfigured(config)) return null;
  return supabaseFetch(config, `/rest/v1/${QA_TABLE}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ message_id: messageId, status, report, error })
  });
}

export async function getLatestQaReport({ config, messageId }) {
  if (!isConfigured(config)) return null;
  const rows = await supabaseFetch(config,
    `/rest/v1/${QA_TABLE}?message_id=eq.${encodeURIComponent(messageId)}&order=created_at.desc&limit=1`
  );
  return rows?.[0] || null;
}

export async function listQaReports({ config, limit = 200 }) {
  if (!isConfigured(config)) return [];
  return supabaseFetch(config,
    `/rest/v1/${QA_TABLE}?status=eq.done&order=created_at.desc&limit=${limit}&select=id,message_id,created_at,report`
  );
}

export async function annotateMessage({ config, messageId, annotation }) {
  if (!isConfigured(config) || String(messageId).startsWith("local_")) return null;
  return supabaseFetch(config, `/rest/v1/${MESSAGES_TABLE}?id=eq.${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ annotation })
  });
}

export async function listSessions({ config, limit = 30 }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=session_id,status,created_at,user_message,ai_response&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  const seen = new Map();
  for (const row of rows || []) {
    if (!seen.has(row.session_id)) seen.set(row.session_id, row);
  }
  return [...seen.entries()].map(([sessionId, row]) => ({ sessionId, ...row }));
}

export async function listRunHistory({ config, limit = 30 }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=id,created_at,user_message,workflow_log,run_events&workflow_log=not.is.null&status=eq.done&order=created_at.desc&limit=${limit}`;
  return supabaseFetch(config, query);
}

export async function listMessages({ config, sessionId }) {
  if (!isConfigured(config)) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`;
  return supabaseFetch(config, query);
}

export async function recentMemory({ config, sessionId, limit = 8 }) {
  if (!isConfigured(config) || !sessionId) return [];
  const query = `/rest/v1/${MESSAGES_TABLE}?select=user_message,ai_response,created_at&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(config, query);
  return (rows || []).reverse().flatMap((row) => {
    const messages = [];
    if (row.user_message) messages.push({ role: "user", content: row.user_message });
    if (row.ai_response) messages.push({ role: "assistant", content: row.ai_response });
    return messages;
  });
}

export async function hybridSearch({ config, query, dateFrom, dateTo, hashtags = [], topK = config.retrieval.candidates, cacheContext = null }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) throw new Error("Content Supabase is not configured");

  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: query,
    cacheContext
  });

  const payload = {
    query_text: query,
    query_embedding: embedding,
    match_count: topK,
    date_from: dateFrom,
    date_to: dateTo,
    hashtags: normalizeHashtags(hashtags),
    vector_weight: config.retrieval.vectorWeight,
    keyword_weight: config.retrieval.keywordWeight
  };

  return cachedOperation({
    context: cacheContext,
    type: "hybridSearch",
    keyParts: {
      query,
      dateFrom,
      dateTo,
      hashtags: payload.hashtags,
      topK,
      rpc: contentConfig.hybridRpcName,
      vectorWeight: payload.vector_weight,
      keywordWeight: payload.keyword_weight
    },
    ttl: CACHE_TTL.hybridSearch,
    savedCall: "search",
    estimatedCost: 0.0002,
    operation: async () => {
      try {
        return await supabaseFetch(contentConfig, `/rest/v1/rpc/${contentConfig.hybridRpcName}`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      } catch (error) {
        if (!payload.hashtags.length || !looksLikeRpcSignatureError(error.message)) throw error;
        const { hashtags: _hashtags, ...payloadWithoutHashtags } = payload;
        return supabaseFetch(contentConfig, `/rest/v1/rpc/${contentConfig.hybridRpcName}`, {
          method: "POST",
          body: JSON.stringify(payloadWithoutHashtags)
        });
      }
    }
  });
}

export const vectorSearch = hybridSearch;

async function supabaseFetch(config, path, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 20_000);
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      ...supabaseHeaders(config.supabaseServiceRoleKey),
      ...(options.headers || {})
    }
  }).finally(() => clearTimeout(id));
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return data;
}

function isConfigured(config) {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export function contentSupabaseConfig(config) {
  return {
    supabaseUrl: config.contentSource?.supabaseUrl || config.supabaseUrl || "",
    supabaseServiceRoleKey: config.contentSource?.supabaseServiceRoleKey || config.supabaseServiceRoleKey || "",
    hybridRpcName: config.contentSource?.hybridRpcName || config.retrieval?.rpcName || "hybrid_match_data_index_embeddings_gf_dor_agent",
    indexTable: config.contentSource?.indexTable || "data_index_embeddings_gf_dor_agent",
    alertsTable: config.contentSource?.alertsTable || "alerts_embeddings_gf",
    alertsRpcName: config.contentSource?.alertsRpcName || `match_${config.contentSource?.alertsTable || "alerts_embeddings_gf"}`
  };
}

function normalizeHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return [];
  return [...new Set(hashtags.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}

function looksLikeRpcSignatureError(message) {
  return /function|parameter|argument|schema cache|could not find|PGRST202/i.test(String(message || ""));
}

export async function fetchAlertsTimelineEvents({ config, limit = 2000 }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return [];
  const query = `/rest/v1/${contentConfig.alertsTable}?select=id,created_at,question,answer,alert_description,alert_type,severity_level,input_data_type,input_data_id,analyzed_data,data_link,data_date,status,item_status,hashtags,summary,content,metadata,is_relevant&order=data_date.asc.nullslast,created_at.asc&limit=${limit}`;
  const rows = await supabaseFetch(contentConfig, query);
  return (rows || []).map((row) => {
    const date = timelineRowDate(row);
    return {
      id: `alert_${row.id}`,
      date,
      tags: parseHashtags(row.hashtags || row.metadata?.hashtags || row.metadata?.tags || row.alert_type).concat(row.alert_type ? [row.alert_type] : []).filter((tag, index, all) => tag && all.indexOf(tag) === index),
      content: alertRowContent(row),
      metadata: alertRowMetadata(row),
      source: "alert",
      severity: Number(row.severity_level || row.metadata?.severity_level || 1)
    };
  }).filter((event) => event.date);
}

function alertRowContent(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return row.summary ||
    row.alert_description ||
    row.content ||
    row.answer ||
    row.analyzed_data ||
    row.question ||
    metadata.summary ||
    metadata.alert_description ||
    metadata.content ||
    "";
}

function alertRowMetadata(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    question: row.question ?? metadata.question,
    answer: row.answer ?? metadata.answer,
    alert_description: row.alert_description ?? metadata.alert_description,
    alert_type: row.alert_type ?? metadata.alert_type,
    severity_level: row.severity_level ?? metadata.severity_level,
    input_data_type: row.input_data_type ?? metadata.input_data_type,
    input_data_id: row.input_data_id ?? metadata.input_data_id,
    analyzed_data: row.analyzed_data ?? metadata.analyzed_data,
    data_link: row.data_link ?? metadata.data_link,
    data_date: row.data_date ?? metadata.data_date,
    status: row.status ?? metadata.status,
    item_status: row.item_status ?? metadata.item_status,
    is_relevant: row.is_relevant ?? metadata.is_relevant,
    url: row.data_link ?? metadata.url
  };
}

export async function fetchTimelineEvents({ config, limit = 1000 }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!isConfigured(contentConfig)) return [];
  const query = `/rest/v1/${contentConfig.indexTable}?select=id,created_at,project_id,source_table,source_id,summary,hashtags,index_text,metadata,primary_date,title,item_status,severity_or_risk,mail_id,attachment_id,source_url,mentioned_dates&order=primary_date.asc.nullslast,created_at.asc&limit=${limit}`;
  const rows = await supabaseFetch(contentConfig, query);
  return (rows || []).map((row) => ({
    id: row.id,
    date: timelineRowDate(row),
    tags: parseHashtags(row.hashtags || row.metadata?.hashtags || row.metadata?.tags),
    content: timelineRowContent(row),
    metadata: timelineRowMetadata(row)
  })).filter((event) => event.date);
}

function timelineRowDate(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const candidates = [
    row.primary_date,
    row.data_date,
    row.date,
    row.created_at,
    metadata.date,
    metadata.primary_date,
    metadata.event_date,
    metadata.created_at,
    metadata.timestamp,
    metadata.time,
    metadata.datetime,
    metadata.document_date
  ];
  const value = candidates.find((item) => item && !Number.isNaN(Date.parse(item)));
  return value ? String(value) : "";
}

function timelineRowContent(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return row.title ||
    row.summary ||
    row.index_text ||
    row.content ||
    metadata.summary ||
    metadata.title ||
    metadata.text ||
    metadata.content ||
    "";
}

function timelineRowMetadata(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    source_table: row.source_table ?? metadata.source_table,
    source_id: row.source_id ?? metadata.source_id,
    project_id: row.project_id ?? metadata.project_id,
    title: row.title ?? metadata.title,
    summary: row.summary ?? metadata.summary,
    index_text: row.index_text ?? metadata.index_text,
    item_status: row.item_status ?? metadata.item_status,
    severity_or_risk: row.severity_or_risk ?? metadata.severity_or_risk,
    mail_id: row.mail_id ?? metadata.mail_id,
    attachment_id: row.attachment_id ?? metadata.attachment_id,
    mentioned_dates: row.mentioned_dates ?? metadata.mentioned_dates,
    source_url: row.source_url ?? metadata.source_url,
    url: row.source_url ?? metadata.url
  };
}

export async function listTimelineEventLinks({ config, source = "", limit = 1000 } = {}) {
  if (!isConfigured(config)) return [];
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(limit)
  });
  if (source === "index" || source === "alerts") {
    params.set("or", `(source_event_source.eq.${source},target_event_source.eq.${source})`);
  }
  const rows = await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?${params.toString()}`);
  return (rows || []).map(addDurationToLink);
}

export async function createTimelineEventLink({ config, link }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const payload = sanitizeTimelineEventLink(link);
  const rows = await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?select=*`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return addDurationToLink(rows?.[0] || payload);
}

export async function deleteTimelineEventLink({ config, id }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  if (!id) throw new Error("Timeline link id is required");
  await supabaseFetch(config, `/rest/v1/${TIMELINE_LINKS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return { ok: true };
}

export async function listTimelineGraphData({ config, source = "index", limit = 5000 } = {}) {
  if (!isConfigured(config)) return { entities: [], eventEntities: [], graphEdges: [] };
  const eventParams = new URLSearchParams({
    select: "*,entity:timeline_entities(*)",
    event_source: `eq.${source}`,
    limit: String(limit)
  });
  const edgeParams = new URLSearchParams({
    select: "*",
    limit: String(limit)
  });
  const eventEntities = await supabaseFetch(config, `/rest/v1/${TIMELINE_EVENT_ENTITIES_TABLE}?${eventParams.toString()}`).catch(() => []);
  const graphEdges = await supabaseFetch(config, `/rest/v1/${TIMELINE_GRAPH_EDGES_TABLE}?${edgeParams.toString()}`).catch(() => []);
  const entities = [...new Map((eventEntities || []).map((item) => [item.entity_id, item.entity]).filter(([, entity]) => entity)).values()];
  return { entities, eventEntities: eventEntities || [], graphEdges: graphEdges || [] };
}

export async function upsertTimelineGraphData({ config, entities = [], eventEntities = [] }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const uniqueEntities = uniqueByKey(entities, (entity) => entity.id);
  const uniqueEventEntities = uniqueByKey(eventEntities, (item) => [
    item.event_source === "alerts" ? "alerts" : "index",
    item.event_id,
    item.entity_id,
    item.role || "mentioned"
  ].join("|"));
  if (uniqueEntities.length) {
    await supabaseFetch(config, `/rest/v1/${TIMELINE_ENTITIES_TABLE}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(uniqueEntities.map(sanitizeTimelineEntity))
    });
  }
  if (uniqueEventEntities.length) {
    await supabaseFetch(config, `/rest/v1/${TIMELINE_EVENT_ENTITIES_TABLE}?on_conflict=event_source,event_id,entity_id,role`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(uniqueEventEntities.map(sanitizeTimelineEventEntity))
    });
  }
  return { entities: uniqueEntities.length, eventEntities: uniqueEventEntities.length };
}

export async function upsertProjectGraphData({ config, nodes = [], edges = [] }) {
  if (!isConfigured(config)) throw new Error("Supabase is not configured");
  const uniqueNodes = uniqueByKey(nodes, (node) => node.id);
  const uniqueEdges = uniqueByKey(edges, (edge) => [
    edge.from_node_id,
    edge.to_node_id,
    edge.edge_type || "related_to"
  ].join("|"));
  for (const batch of chunk(uniqueNodes, GRAPH_UPSERT_BATCH_SIZE)) {
    await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch.map(sanitizeGraphNode))
    });
  }
  for (const batch of chunk(uniqueEdges, GRAPH_UPSERT_BATCH_SIZE)) {
    await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?on_conflict=from_node_id,to_node_id,edge_type`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch.map(sanitizeGraphEdge))
    });
  }
  return { nodes: uniqueNodes.length, edges: uniqueEdges.length };
}

export async function graphSearch({ config, payload = {}, limit = 30 } = {}) {
  if (!isConfigured(config)) return { results: [], skipped: true, reason: "App Supabase is not configured" };
  const body = {
    query_text: payload.query_text || "",
    source_refs: Array.isArray(payload.source_refs) ? payload.source_refs : [],
    max_rows: Number(payload.max_rows || limit || 30)
  };
  try {
    const results = await supabaseFetch(config, "/rest/v1/rpc/graph_search", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return { results: results || [], skipped: false, mode: "rpc" };
  } catch (error) {
    if (!looksLikeRpcSignatureError(error.message) && !/graph_search/i.test(error.message)) throw error;
    const results = await graphSearchFallback({ config, payload: body, limit: body.max_rows }).catch(() => []);
    return { results, skipped: !results.length, mode: "rest_fallback", error: error.message };
  }
}

export async function listProjectGraph({ config, limit = 300, nodeType = "", edgeType = "", query = "" } = {}) {
  if (!isConfigured(config)) return emptyProjectGraph("App Supabase is not configured");
  const max = Math.min(Math.max(Number(limit || 300), 1), 1000);
  if (nodeType) {
    const graph = await listProjectGraphByNodeFilter({ config, limit: max, nodeType, edgeType, query }).catch(() => null);
    if (graph && (graph.nodes.length || graph.edges.length)) return graph;
  }
  const needsSemanticFilter = Boolean(
    query ||
    (nodeType && !GRAPH_NODE_TYPES.has(nodeType)) ||
    (edgeType && !GRAPH_EDGE_TYPES.has(edgeType))
  );
  const fetchLimit = needsSemanticFilter ? Math.min(Math.max(max * 200, 5000), 10000) : max;
  const filters = [];
  if (edgeType && GRAPH_EDGE_TYPES.has(edgeType)) filters.push(`edge_type=eq.${encodeURIComponent(edgeType)}`);
  if (edgeType && !GRAPH_EDGE_TYPES.has(edgeType)) filters.push(`metadata->>edge_kind=eq.${encodeURIComponent(edgeType)}`);
  const params = new URLSearchParams({
    select: "id,edge_type,weight,confidence,evidence_text,metadata,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
    order: "confidence.desc",
    limit: String(fetchLimit)
  });
  const edgePath = `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}${filters.length ? `&${filters.join("&")}` : ""}`;
  try {
    const rows = await supabaseFetch(config, edgePath);
    return projectGraphResponse(rows || [], { nodeType, edgeType, query, limit: max });
  } catch (error) {
    if (/graph_nodes|graph_edges|schema cache|could not find/i.test(error.message)) {
      return emptyProjectGraph(error.message);
    }
    throw error;
  }
}

async function listProjectGraphByNodeFilter({ config, limit = 300, nodeType = "", edgeType = "", query = "" } = {}) {
  const max = Math.min(Math.max(Number(limit || 300), 1), 1000);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const nodeRows = await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?select=*&limit=10000`);
  const selectedNodes = (nodeRows || [])
    .map(normalizeProjectGraphNode)
    .filter((node) => node && nodeMatchesType(node, nodeType))
    .filter((node) => !normalizedQuery || projectGraphNodeMatches({ node, query: normalizedQuery }))
    .slice(0, max);
  if (!selectedNodes.length) return projectGraphResponse([], { nodeType, edgeType, query, limit: max });
  const edgeRows = [];
  for (const batch of chunk(selectedNodes.map((node) => node.id), 50)) {
    const encoded = batch.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(",");
    const params = new URLSearchParams({
      select: "id,edge_type,weight,confidence,evidence_text,metadata,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
      or: `(from_node_id.in.(${encoded}),to_node_id.in.(${encoded}))`,
      order: "confidence.desc",
      limit: String(Math.min(max * 10, 1000))
    });
    if (edgeType && GRAPH_EDGE_TYPES.has(edgeType)) params.set("edge_type", `eq.${edgeType}`);
    const rows = await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}`).catch(() => []);
    edgeRows.push(...(rows || []));
  }
  return projectGraphResponse(edgeRows, { nodeType, edgeType, query, limit: max, extraNodes: selectedNodes });
}

export function projectGraphResponse(rows = [], { nodeType = "", edgeType = "", query = "", limit = 300, extraNodes = [] } = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const selectedType = String(nodeType || "").trim();
  const selectedEdgeType = String(edgeType || "").trim();
  const nodes = new Map();
  const edges = [];
  for (const node of extraNodes || []) {
    if (node?.id && (!selectedType || nodeMatchesType(node, selectedType))) nodes.set(node.id, node);
  }
  for (const row of rows || []) {
    const source = normalizeProjectGraphNode(row.from_node || row.source_node);
    const target = normalizeProjectGraphNode(row.to_node || row.target_node);
    if (!source?.id || !target?.id) continue;
    if (!normalizedQuery && (isNoisySourceNode(source) || isNoisySourceNode(target))) continue;
    if (selectedType && !nodeMatchesType(source, selectedType) && !nodeMatchesType(target, selectedType)) continue;
    if (selectedEdgeType && row.edge_type !== selectedEdgeType && row.metadata?.edge_kind !== selectedEdgeType) continue;
    if (normalizedQuery && !projectGraphRowMatches({ row, source, target, query: normalizedQuery })) continue;
    nodes.set(source.id, source);
    nodes.set(target.id, target);
    edges.push({
      id: row.id || row.edge_id || `${source.id}->${target.id}:${row.edge_type}`,
      source: source.id,
      target: target.id,
      edge_type: row.edge_type || "related_to",
      edge_kind: row.metadata?.edge_kind || row.edge_type || "related_to",
      weight: Number(row.weight || 0.5),
      confidence: Number(row.confidence || row.weight || 0.5),
      evidence_text: row.evidence_text || "",
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {}
    });
  }
  const graphNodes = [...nodes.values()].slice(0, Number(limit || 300));
  const visible = new Set(graphNodes.map((node) => node.id));
  const graphEdges = edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)).slice(0, Number(limit || 300));
  return {
    nodes: graphNodes,
    edges: graphEdges,
    stats: projectGraphStats(graphNodes, graphEdges),
    skipped: false
  };
}

function emptyProjectGraph(reason = "") {
  return {
    nodes: [],
    edges: [],
    stats: { nodeCount: 0, edgeCount: 0, nodeTypes: [], entityKinds: [], edgeTypes: [], edgeKinds: [] },
    skipped: Boolean(reason),
    reason
  };
}

function normalizeProjectGraphNode(node = {}) {
  if (!node || typeof node !== "object" || !node.id) return null;
  return {
    id: String(node.id),
    node_type: node.node_type || "topic",
    entity_kind: node.metadata?.entity_kind || node.node_type || "topic",
    label: node.label || node.id,
    normalized_label: node.normalized_label || "",
    source_table: node.source_table || null,
    source_id: node.source_id || null,
    event_date: node.event_date || null,
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {}
  };
}

function projectGraphRowMatches({ row, source, target, query }) {
  const haystack = [
    source.id, source.label, source.node_type, source.entity_kind, source.source_table, source.source_id,
    target.id, target.label, target.node_type, target.entity_kind, target.source_table, target.source_id,
    row.edge_type, row.metadata?.edge_kind, row.evidence_text
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function projectGraphNodeMatches({ node, query }) {
  const haystack = [
    node.id, node.label, node.node_type, node.entity_kind, node.source_table, node.source_id
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function projectGraphStats(nodes = [], edges = []) {
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypes: countBy(nodes, (node) => node.node_type),
    entityKinds: countBy(nodes, (node) => node.entity_kind || node.node_type),
    edgeTypes: countBy(edges, (edge) => edge.edge_type),
    edgeKinds: countBy(edges, (edge) => edge.edge_kind || edge.edge_type)
  };
}

function nodeMatchesType(node, selectedType) {
  return node.node_type === selectedType || node.entity_kind === selectedType || node.metadata?.entity_kind === selectedType;
}

function isNoisySourceNode(node = {}) {
  if (node.node_type !== "source") return false;
  if (node.entity_kind && node.entity_kind !== "source") return false;
  const label = String(node.label || node.id || "");
  return /^https?:\/\//i.test(label) || /^source:https?:/i.test(node.id || "");
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items || []) {
    const key = keyFn(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function graphSearchFallback({ config, payload = {}, limit = 30 }) {
  const refs = Array.isArray(payload.source_refs) ? payload.source_refs : [];
  const nodeIds = refs.map((ref) => ref.node_id).filter(Boolean);
  const sourcePairs = refs.filter((ref) => ref.source_table && ref.source_id);
  let sourceNodes = [];
  if (sourcePairs.length) {
    const or = sourcePairs
      .slice(0, 20)
      .map((ref) => `and(source_table.eq.${encodeURIComponent(ref.source_table)},source_id.eq.${encodeURIComponent(ref.source_id)})`)
      .join(",");
    sourceNodes = await supabaseFetch(config, `/rest/v1/${GRAPH_NODES_TABLE}?select=id&or=(${or})&limit=50`).catch(() => []);
  }
  const ids = [...new Set([...nodeIds, ...(sourceNodes || []).map((node) => node.id)].filter(Boolean))];
  if (!ids.length) return [];
  const encoded = ids.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(",");
  const params = new URLSearchParams({
    select: "id,edge_type,weight,confidence,evidence_text,from_node:graph_nodes!graph_edges_from_node_id_fkey(*),to_node:graph_nodes!graph_edges_to_node_id_fkey(*)",
    or: `(from_node_id.in.(${encoded}),to_node_id.in.(${encoded}))`,
    order: "confidence.desc",
    limit: String(Math.min(Number(limit || 30), 200))
  });
  const rows = await supabaseFetch(config, `/rest/v1/${GRAPH_EDGES_TABLE}?${params.toString()}`).catch(() => []);
  return (rows || []).map((row) => ({
    edge_id: row.id,
    edge_type: row.edge_type,
    weight: row.weight,
    confidence: row.confidence,
    evidence_text: row.evidence_text,
    source_node: row.from_node,
    target_node: row.to_node
  }));
}

function sanitizeTimelineEventLink(link = {}) {
  const payload = {
    source_event_source: link.source_event_source === "alerts" ? "alerts" : "index",
    source_event_id: requiredString(link.source_event_id, "source_event_id"),
    target_event_source: link.target_event_source === "alerts" ? "alerts" : "index",
    target_event_id: requiredString(link.target_event_id, "target_event_id"),
    relation_type: TIMELINE_RELATION_TYPES.includes(link.relation_type) ? link.relation_type : "related",
    source_date: nullableString(link.source_date),
    target_date: nullableString(link.target_date),
    source_title: nullableString(link.source_title),
    target_title: nullableString(link.target_title),
    approver: nullableString(link.approver),
    note: nullableString(link.note),
    created_by: nullableString(link.created_by)
  };
  if (payload.source_event_source === payload.target_event_source && payload.source_event_id === payload.target_event_id) {
    throw new Error("Cannot link an event to itself");
  }
  return payload;
}

function requiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function nullableString(value) {
  const text = String(value || "").trim();
  return text || null;
}

function sanitizeTimelineEntity(entity = {}) {
  return {
    id: requiredString(entity.id, "entity.id"),
    entity_type: nullableString(entity.entity_type) || "topic",
    name: requiredString(entity.name, "entity.name"),
    normalized_name: requiredString(entity.normalized_name || entity.name, "entity.normalized_name"),
    metadata: entity.metadata && typeof entity.metadata === "object" ? entity.metadata : {}
  };
}

function sanitizeTimelineEventEntity(item = {}) {
  return {
    event_source: item.event_source === "alerts" ? "alerts" : "index",
    event_id: requiredString(item.event_id, "event_id"),
    entity_id: requiredString(item.entity_id, "entity_id"),
    role: nullableString(item.role) || "mentioned",
    confidence: Number(item.confidence || 0.5),
    evidence_text: nullableString(item.evidence_text)
  };
}

function sanitizeGraphNode(node = {}) {
  return {
    id: requiredString(node.id, "node.id"),
    node_type: nullableString(node.node_type) || "topic",
    label: requiredString(node.label, "node.label"),
    normalized_label: requiredString(node.normalized_label || node.label, "node.normalized_label"),
    source_table: nullableString(node.source_table),
    source_id: nullableString(node.source_id),
    event_date: nullableString(node.event_date),
    metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {}
  };
}

function sanitizeGraphEdge(edge = {}) {
  return {
    from_node_id: requiredString(edge.from_node_id, "from_node_id"),
    to_node_id: requiredString(edge.to_node_id, "to_node_id"),
    edge_type: nullableString(edge.edge_type) || "related_to",
    weight: Number(edge.weight || 0.5),
    confidence: Number(edge.confidence || edge.weight || 0.5),
    evidence_text: nullableString(edge.evidence_text),
    metadata: edge.metadata && typeof edge.metadata === "object" ? edge.metadata : {}
  };
}

function uniqueByKey(items = [], keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function chunk(items = [], size = 500) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseHashtags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).replace(/^#+/, "")).filter(Boolean);
  return String(raw).match(/#[֐-׿\w]+/gu)?.map((t) => t.replace(/^#+/, "")) || [];
}

function localMessage({ userMessage, sanitizedMessage, sessionId }) {
  return {
    id: `local_${Date.now()}`,
    user_message: userMessage,
    sanitzed_user_message: sanitizedMessage,
    session_id: sessionId,
    status: "processing"
  };
}
