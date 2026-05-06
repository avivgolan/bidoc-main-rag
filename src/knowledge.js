const ALLOWED_EXTENSIONS = new Set([".md", ".txt"]);
const STOP_WORDS = new Set([
  "של", "על", "עם", "את", "זה", "זו", "הוא", "היא", "הם", "הן", "או", "אם", "כי", "לא", "כן", "מה", "מי",
  "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "a", "an", "with", "by", "from"
]);

async function sbFetch(path, options = {}) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase is not configured");
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return data;
}

export async function listKnowledgeDocuments() {
  const rows = await sbFetch("/rest/v1/knowledge_documents?select=filename,content,updated_at&order=filename.asc");
  return (rows || []).map((row) => ({
    filename: row.filename,
    size: Buffer.byteLength(row.content || "", "utf8"),
    updatedAt: row.updated_at
  }));
}

export async function saveKnowledgeDocument({ filename, content }) {
  const safeName = sanitizeKnowledgeFilename(filename);
  const now = new Date().toISOString();
  await sbFetch("/rest/v1/knowledge_documents", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ filename: safeName, content: String(content || ""), updated_at: now })
  });
  return { filename: safeName, content: String(content || ""), size: Buffer.byteLength(content || "", "utf8"), updatedAt: now };
}

export async function readKnowledgeDocument(filename) {
  const safeName = sanitizeKnowledgeFilename(filename);
  const rows = await sbFetch(`/rest/v1/knowledge_documents?filename=eq.${encodeURIComponent(safeName)}&select=filename,content,updated_at`);
  if (!rows?.length) throw new Error("Knowledge document not found");
  const row = rows[0];
  return {
    filename: row.filename,
    content: row.content || "",
    size: Buffer.byteLength(row.content || "", "utf8"),
    updatedAt: row.updated_at
  };
}

export async function deleteKnowledgeDocument(filename) {
  const safeName = sanitizeKnowledgeFilename(filename);
  await sbFetch(`/rest/v1/knowledge_documents?filename=eq.${encodeURIComponent(safeName)}`, { method: "DELETE" });
  return { filename: safeName, deleted: true };
}

export async function searchKnowledgeBase({ query, tags = [], topK = 6 }) {
  const rows = await sbFetch("/rest/v1/knowledge_documents?select=filename,content,updated_at&order=filename.asc");
  const documents = (rows || []).map((row) => ({
    filename: row.filename,
    content: row.content || "",
    size: Buffer.byteLength(row.content || "", "utf8"),
    updatedAt: row.updated_at
  }));

  const queryText = String(query || "");
  const queryTokens = tokenize(queryText);
  const normalizedTags = normalizeTags(tags);
  const chunks = documents.flatMap((doc) => chunkDocument(doc));

  const matches = chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk({ chunk, queryText, queryTokens, tags: normalizedTags }) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK || 6));

  return { matches, totalDocuments: documents.length, totalChunks: chunks.length };
}

export function sanitizeKnowledgeFilename(filename) {
  const raw = String(filename || "").trim().split(/[\\/]/).pop();
  if (!raw) throw new Error("filename is required");
  const ext = raw.slice(raw.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("Only .txt and .md knowledge documents are supported");
  return raw.replace(/[^\w.\-\u0590-\u05FF ]+/g, "_");
}

function chunkDocument(document) {
  const blocks = document.content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((text, index) => ({
    filename: document.filename,
    chunkIndex: index,
    text: text.length > 1800 ? text.slice(0, 1800) : text,
    tokens: tokenize(text)
  }));
}

function scoreChunk({ chunk, queryText, queryTokens, tags }) {
  const tokenSet = new Set(chunk.tokens);
  let score = 0;
  for (const token of queryTokens) {
    if (tokenSet.has(token)) score += token.length > 4 ? 2 : 1;
  }
  const lower = chunk.text.toLowerCase();
  for (const tag of tags) {
    if (lower.includes(tag.toLowerCase())) score += 5;
  }
  for (const phrase of importantPhrases(queryText)) {
    if (phrase && lower.includes(phrase.toLowerCase())) score += 4;
  }
  return score;
}

function importantPhrases(text) {
  return String(text || "")
    .split(/[?.!,;:\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
    .slice(0, 3);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_# ]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim().replace(/^#+/, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeTags(tags) {
  const raw = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(/[,\s]+/) : [];
  return [...new Set(raw.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}
