import { createEmbedding } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const DEFAULT_MEETINGS_RPC = "hybrid_match_meetings_documents";
const DEFAULT_MEETINGS_TABLE = "meetings_documents";

async function callMeetingsRpc(config, subagentCfg, embedding, query, keywords, dateFrom, dateTo, cacheContext, telemetry) {
  const contentConfig = contentSupabaseConfig(config);
  const rpcName = subagentCfg.rpcName || DEFAULT_MEETINGS_RPC;
  const projectId = config.contentSource?.projectId || process.env.PROJECT_ID || null;

  const body = {
    query_embedding: embedding,
    query_text: query,
    keywords: keywords || [],
    p_project_id: projectId,
    match_count: subagentCfg.matchCount || 20,
    match_threshold: subagentCfg.matchThreshold ?? 0.3,
    vector_weight: subagentCfg.vectorWeight ?? 0.55,
    text_weight: subagentCfg.textWeight ?? 0.25,
    keyword_weight: subagentCfg.keywordWeight ?? 0.15,
    metadata_weight: subagentCfg.metadataWeight ?? 0.05
  };
  if (dateFrom) body.date_from = dateFrom;
  if (dateTo) body.date_to = dateTo;

  const response = await fetch(`${contentConfig.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey),
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Meetings RPC failed: ${response.status}`);
  return Array.isArray(data) ? data : [];
}

async function fetchAdjacentChunks(config, chunks, adjacentCount = 1) {
  if (!chunks.length || adjacentCount <= 0) return [];
  const contentConfig = contentSupabaseConfig(config);
  const projectId = config.contentSource?.projectId || process.env.PROJECT_ID || null;
  const table = DEFAULT_MEETINGS_TABLE;

  const adjacentIds = new Set();
  const topChunks = chunks.slice(0, 5);

  const results = await Promise.all(topChunks.map(async (chunk) => {
    const targetIndexes = [];
    for (let i = 1; i <= adjacentCount; i++) {
      if (chunk.chunk_index - i >= 0) targetIndexes.push(chunk.chunk_index - i);
      targetIndexes.push(chunk.chunk_index + i);
    }
    if (!targetIndexes.length) return [];

    const indexFilter = targetIndexes.map((i) => `chunk_index.eq.${i}`).join(",");
    let url = `${contentConfig.supabaseUrl}/rest/v1/${table}?select=id,content,chunk_index,attachment_id&attachment_id=eq.${encodeURIComponent(chunk.attachment_id)}&or=(${indexFilter})`;
    if (projectId) url += `&project_id=eq.${projectId}`;

    try {
      const resp = await fetch(url, { headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey) });
      const txt = await resp.text();
      const data = txt ? JSON.parse(txt) : [];
      return Array.isArray(data) ? data.filter((r) => !adjacentIds.has(r.id) && (adjacentIds.add(r.id), true)) : [];
    } catch {
      return [];
    }
  }));

  return results.flat();
}

function detectConflicts(chunks) {
  if (chunks.length < 2) return [];
  const conflicts = [];
  for (let i = 0; i < chunks.length - 1; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const a = chunks[i];
      const b = chunks[j];
      if (a.attachment_id === b.attachment_id) continue;
      if (a.final_score >= 0.7 && b.final_score >= 0.7) {
        conflicts.push({ chunk_a: a.id, chunk_b: b.id, document_a: a.document_name, document_b: b.document_name });
      }
    }
  }
  return conflicts;
}

export async function runMeetingEvidenceAgent({
  query,
  keywords = [],
  meetingId = null,
  attachmentId = null,
  dateFrom = null,
  dateTo = null,
  requireQuote = true,
  cacheContext = null,
  telemetry = null
}) {
  const config = getConfig();
  const saved = readLocalSettings().subagents?.meetingsEvidence || {};
  const contentConfig = contentSupabaseConfig(config);

  if (!contentConfig.supabaseUrl || !contentConfig.supabaseServiceRoleKey) {
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "Content Supabase not configured" };
  }
  if (!config.openRouterApiKey) {
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "OPENROUTER_API_KEY not configured" };
  }

  const subagentCfg = {
    rpcName: saved.rpcName || DEFAULT_MEETINGS_RPC,
    matchCount: saved.matchCount || 20,
    matchThreshold: saved.matchThreshold ?? 0.3,
    vectorWeight: saved.vectorWeight ?? 0.55,
    textWeight: saved.textWeight ?? 0.25,
    keywordWeight: saved.keywordWeight ?? 0.15,
    metadataWeight: saved.metadataWeight ?? 0.05,
    adjacentChunks: saved.adjacentChunks ?? 1,
    requireQuote: saved.requireQuote ?? requireQuote,
    timeoutMs: saved.timeoutMs || 10000
  };

  let embedding;
  try {
    embedding = await createEmbedding({
      apiKey: config.openRouterApiKey,
      model: config.models.embedding,
      input: query,
      cacheContext,
      telemetry
    });
  } catch (error) {
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: `Embedding failed: ${error.message}` };
  }

  let chunks;
  try {
    chunks = await callMeetingsRpc(config, subagentCfg, embedding, query, keywords, dateFrom, dateTo, cacheContext, telemetry);
  } catch (error) {
    console.error("[meeting_evidence] RPC failed:", error.message);
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: `RPC failed: ${error.message}` };
  }

  if (!chunks.length) {
    return { status: "not_found", summary: null, evidence: [], conflicts: [], insufficient_evidence: true };
  }

  const adjacentChunks = await fetchAdjacentChunks(config, chunks, subagentCfg.adjacentChunks);

  const conflictsDetected = detectConflicts(chunks);

  const evidence = chunks.map((chunk) => {
    const lines = chunk.metadata?.loc?.lines || {};
    return {
      quote: chunk.content,
      chunk_id: chunk.id,
      meeting_id: chunk.meeting_id,
      attachment_id: chunk.attachment_id,
      document_name: chunk.document_name,
      meeting_date: chunk.primary_date ? chunk.primary_date.slice(0, 10) : null,
      chunk_index: chunk.chunk_index,
      line_from: lines.from ?? null,
      line_to: lines.to ?? null,
      final_score: chunk.final_score,
      vector_score: chunk.vector_score,
      text_score: chunk.text_score,
      keyword_score: chunk.keyword_score,
      adjacent_chunks: adjacentChunks
        .filter((adj) => adj.attachment_id === chunk.attachment_id)
        .map((adj) => ({ id: adj.id, chunk_index: adj.chunk_index, content: adj.content }))
    };
  });

  const topDate = evidence[0]?.meeting_date || "";
  const topDoc = evidence[0]?.document_name || "";
  const summary = evidence.length
    ? `נמצאו ${evidence.length} ממצאים רלוונטיים${topDoc ? ` — מקור עיקרי: ${topDoc}` : ""}${topDate ? ` (${topDate})` : ""}.`
    : null;

  return {
    status: "found",
    summary,
    evidence,
    conflicts: conflictsDetected,
    insufficient_evidence: false
  };
}

export function formatMeetingCitation(evidenceItem) {
  const date = evidenceItem.meeting_date
    ? new Date(evidenceItem.meeting_date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
  return `[ישיבה: ${evidenceItem.document_name || ""}${date ? ", " + date : ""}, צ'אנק ${evidenceItem.chunk_index ?? ""}]`;
}
