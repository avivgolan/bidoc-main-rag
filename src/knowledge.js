import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KNOWLEDGE_AGENT_ROOT = path.join(ROOT, "knowledge-base", "agents");
const KNOWLEDGE_UPLOAD_ROOT = path.join(ROOT, "data", "knowledge-base");
const ALLOWED_EXTENSIONS = new Set([".md", ".txt"]);
const DEFAULT_AGENT_ORDER = ["schedule", "safety_quality", "commercial"];

export const KNOWLEDGE_AGENTS = loadKnowledgeAgents();

const STOP_WORDS = new Set([
  "של", "על", "עם", "את", "זה", "זו", "הוא", "היא", "הם", "הן", "או", "אם", "כי", "לא", "כן", "מה", "מי",
  "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "a", "an", "with", "by", "from"
]);

export function listKnowledgeAgents() {
  return loadKnowledgeAgents().map(publicAgent);
}

export function routeKnowledgeAgents({ message = "", tags = [], limit = 2 } = {}) {
  const agents = loadKnowledgeAgents();
  const text = `${message} ${normalizeTags(tags).join(" ")}`.toLowerCase();
  const scored = agents
    .map((agent) => {
      let score = 0;
      for (const keyword of agent.keywords) {
        if (text.includes(String(keyword).toLowerCase())) score += 3;
      }
      for (const tag of agent.tags) {
        if (text.includes(String(tag).toLowerCase())) score += 2;
      }
      return { ...publicAgent(agent), score };
    })
    .filter((agent) => agent.score > 0)
    .sort((a, b) => b.score - a.score || compareAgentOrder(a.id, b.id))
    .slice(0, Number(limit || 2));
  return scored.length ? scored : [publicAgent(defaultKnowledgeAgent(agents))];
}

export async function listKnowledgeDocuments({ agentId } = {}) {
  const agents = selectedAgents(agentId);
  const agentDocuments = agents.map(agentDocumentSummary);
  const uploadedDocuments = await listUploadedKnowledgeDocuments(agents.map((agent) => agent.id));
  return [...agentDocuments, ...uploadedDocuments].sort(compareKnowledgeDocuments);
}

export async function saveKnowledgeDocument({ filename, content, agentId = "schedule" }) {
  const id = normalizeAgentId(agentId);
  const safeName = sanitizeKnowledgeFilename(filename);
  await ensureAgentDir(id);
  const filePath = safeKnowledgePath(id, safeName);
  await fsp.writeFile(filePath, String(content || ""), "utf8");
  const stat = await fsp.stat(filePath);
  return {
    agentId: id,
    agentName: knowledgeAgentName(id),
    filename: safeName,
    storedFilename: `${id}/${safeName}`,
    source: "upload",
    readOnly: false,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
    content: String(content || "")
  };
}

export async function readKnowledgeDocument(filename, { agentId, source } = {}) {
  const resolved = resolveKnowledgeTarget(filename, agentId);
  const normalizedSource = normalizeDocumentSource(source);
  if (normalizedSource === "agent" || (!normalizedSource && isAgentDocumentFilename(resolved.agentId, resolved.filename))) {
    const agent = knowledgeAgentById(resolved.agentId);
    if (!isAgentDocumentFilename(agent.id, resolved.filename)) {
      throw new Error("Built-in Knowledge agent document was not found");
    }
    return agentDocumentSummary(agent, { content: agent.rawContent });
  }

  const filePath = safeKnowledgePath(resolved.agentId, resolved.filename);
  const content = await fsp.readFile(filePath, "utf8");
  const stat = await fsp.stat(filePath);
  return {
    agentId: resolved.agentId,
    agentName: knowledgeAgentName(resolved.agentId),
    filename: resolved.filename,
    storedFilename: `${resolved.agentId}/${resolved.filename}`,
    source: "upload",
    readOnly: false,
    content,
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

export async function deleteKnowledgeDocument(filename, { agentId, source } = {}) {
  const resolved = resolveKnowledgeTarget(filename, agentId);
  const normalizedSource = normalizeDocumentSource(source);
  if (normalizedSource === "agent" || (!normalizedSource && isAgentDocumentFilename(resolved.agentId, resolved.filename))) {
    throw new Error("Built-in Knowledge agent documents are read-only");
  }
  await fsp.unlink(safeKnowledgePath(resolved.agentId, resolved.filename));
  return { agentId: resolved.agentId, filename: resolved.filename, source: "upload", deleted: true };
}

export async function searchKnowledgeBase({ query, tags = [], topK = 6, agentId, chunkSize = 1800 } = {}) {
  const documents = await loadKnowledgeDocuments(agentId);
  const queryText = String(query || "");
  const queryTokens = tokenize(queryText);
  const normalizedTags = normalizeTags(tags);
  const chunks = documents.flatMap((doc) => chunkDocument(doc, { chunkSize }));

  const matches = chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk({ chunk, queryText, queryTokens, tags: normalizedTags }) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK || 6));

  return {
    agentId: agentId ? normalizeAgentId(agentId) : null,
    matches,
    totalDocuments: documents.length,
    totalChunks: chunks.length,
    sources: summarizeKnowledgeSources({ documents, chunks, matches })
  };
}

export function sanitizeKnowledgeFilename(filename) {
  const raw = String(filename || "").trim().split(/[\\/]/).pop();
  if (!raw) throw new Error("filename is required");
  const ext = path.extname(raw).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("Only .txt and .md knowledge documents are supported");
  return raw.replace(/[^\w.\-\u0590-\u05FF ]+/g, "_");
}

export function parseKnowledgeAgentMarkdown(raw, filename = "agent.md") {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`Knowledge agent ${filename} is missing frontmatter`);

  const metadata = parseFrontmatter(match[1], filename);
  const body = String(match[2] || "").trim();
  const id = requiredMetadata(metadata, "id", filename);
  const expectedId = path.basename(filename, path.extname(filename));
  if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error(`Knowledge agent ${filename} has invalid id "${id}"`);
  if (id !== expectedId) throw new Error(`Knowledge agent ${filename} id must match filename "${expectedId}"`);
  if (!body) throw new Error(`Knowledge agent ${filename} must include non-empty Markdown body content`);

  return {
    id,
    name: requiredMetadata(metadata, "name", filename),
    description: requiredMetadata(metadata, "description", filename),
    tags: requiredListMetadata(metadata, "tags", filename),
    keywords: requiredListMetadata(metadata, "keywords", filename),
    filename,
    storedFilename: `agent/${filename}`,
    source: "agent",
    readOnly: true,
    body,
    rawContent: text
  };
}

function loadKnowledgeAgents() {
  let entries;
  try {
    entries = fs.readdirSync(KNOWLEDGE_AGENT_ROOT, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Knowledge agent directory is missing: ${KNOWLEDGE_AGENT_ROOT}`);
  }

  const agents = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".md")
    .map((entry) => {
      const filePath = path.join(KNOWLEDGE_AGENT_ROOT, entry.name);
      const raw = fs.readFileSync(filePath, "utf8");
      const stat = fs.statSync(filePath);
      return {
        ...parseKnowledgeAgentMarkdown(raw, entry.name),
        size: Buffer.byteLength(raw, "utf8"),
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => compareAgentOrder(a.id, b.id));

  if (!agents.length) throw new Error(`Knowledge agent directory has no .md files: ${KNOWLEDGE_AGENT_ROOT}`);
  return agents;
}

async function loadKnowledgeDocuments(agentId) {
  const agents = selectedAgents(agentId);
  const agentDocuments = agents.map((agent) => ({
    ...agentDocumentSummary(agent),
    content: agent.body
  }));
  const uploadedDocuments = await loadUploadedKnowledgeDocuments(agents.map((agent) => agent.id));
  return [...agentDocuments, ...uploadedDocuments];
}

async function listUploadedKnowledgeDocuments(agentIds) {
  const documents = [];
  for (const id of agentIds) {
    let entries;
    try {
      entries = await fsp.readdir(agentDir(id), { withFileTypes: true });
    } catch (error) {
      // Uploaded documents are optional. Read-only/serverless deployments may
      // not have a writable data directory, so listing must not create one.
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const filePath = path.join(agentDir(id), entry.name);
      const stat = await fsp.stat(filePath);
      documents.push({
        agentId: id,
        agentName: knowledgeAgentName(id),
        filename: entry.name,
        storedFilename: `${id}/${entry.name}`,
        source: "upload",
        readOnly: false,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }
  }
  return documents;
}

async function loadUploadedKnowledgeDocuments(agentIds) {
  const summaries = await listUploadedKnowledgeDocuments(agentIds);
  return Promise.all(summaries.map(async (summary) => ({
    ...summary,
    content: await fsp.readFile(safeKnowledgePath(summary.agentId, summary.filename), "utf8")
  })));
}

function chunkDocument(document, { chunkSize = 1800 } = {}) {
  const max = Math.min(Math.max(Number(chunkSize || 1800), 300), 6000);
  const blocks = String(document.content || "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((text, index) => ({
    agentId: document.agentId,
    agentName: document.agentName,
    filename: document.filename,
    storedFilename: document.storedFilename,
    source: document.source,
    readOnly: Boolean(document.readOnly),
    chunkIndex: index,
    text: text.length > max ? text.slice(0, max) : text,
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
  return uniqueStrings(raw);
}

function normalizeAgentId(agentId) {
  const id = String(agentId || "schedule").trim();
  const agents = loadKnowledgeAgents();
  if (agents.some((agent) => agent.id === id)) return id;
  return defaultKnowledgeAgent(agents).id;
}

function knowledgeAgentName(agentId) {
  return knowledgeAgentById(agentId).name;
}

function knowledgeAgentById(agentId) {
  const id = String(agentId || "").trim();
  const agents = loadKnowledgeAgents();
  return agents.find((agent) => agent.id === id) || defaultKnowledgeAgent(agents);
}

function defaultKnowledgeAgent(agents = loadKnowledgeAgents()) {
  return agents.find((agent) => agent.id === "schedule") || agents[0];
}

function selectedAgents(agentId) {
  if (agentId) return [knowledgeAgentById(normalizeAgentId(agentId))];
  return loadKnowledgeAgents();
}

function publicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tags: agent.tags,
    keywords: agent.keywords,
    filename: agent.filename,
    source: "agent",
    readOnly: true
  };
}

function agentDocumentSummary(agent, extra = {}) {
  return {
    agentId: agent.id,
    agentName: agent.name,
    filename: agent.filename,
    storedFilename: agent.storedFilename,
    source: "agent",
    readOnly: true,
    size: agent.size,
    updatedAt: agent.updatedAt,
    ...extra
  };
}

function agentDir(agentId) {
  return path.join(KNOWLEDGE_UPLOAD_ROOT, normalizeAgentId(agentId));
}

async function ensureAgentDir(agentId) {
  await fsp.mkdir(agentDir(agentId), { recursive: true });
}

function safeKnowledgePath(agentId, filename) {
  const safeName = sanitizeKnowledgeFilename(filename);
  const fullPath = path.resolve(agentDir(agentId), safeName);
  const basePath = path.resolve(agentDir(agentId));
  if (!fullPath.startsWith(`${basePath}${path.sep}`)) throw new Error("Invalid knowledge path");
  return fullPath;
}

function resolveKnowledgeTarget(filename, agentId) {
  const raw = String(filename || "").trim().replace(/\\/g, "/");
  const [maybeAgent, ...rest] = raw.split("/");
  if (rest.length && loadKnowledgeAgents().some((agent) => agent.id === maybeAgent)) {
    return { agentId: maybeAgent, filename: sanitizeKnowledgeFilename(rest.join("/")) };
  }
  return { agentId: normalizeAgentId(agentId), filename: sanitizeKnowledgeFilename(raw) };
}

function isAgentDocumentFilename(agentId, filename) {
  const agent = knowledgeAgentById(agentId);
  return sanitizeKnowledgeFilename(filename) === agent.filename;
}

function normalizeDocumentSource(source) {
  const value = String(source || "").trim().toLowerCase();
  return value === "agent" || value === "upload" ? value : "";
}

function parseFrontmatter(frontmatter, filename) {
  const metadata = {};
  let currentKey = "";
  for (const rawLine of String(frontmatter || "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem) {
      if (!currentKey || !Array.isArray(metadata[currentKey])) {
        throw new Error(`Knowledge agent ${filename} has a list item without a key`);
      }
      metadata[currentKey].push(parseScalar(listItem[1]));
      continue;
    }

    const keyValue = line.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!keyValue) throw new Error(`Knowledge agent ${filename} has invalid frontmatter line: ${line}`);
    const key = keyValue[1];
    const value = String(keyValue[2] || "").trim();
    if (!value) {
      metadata[key] = [];
      currentKey = key;
    } else {
      metadata[key] = parseScalar(value);
      currentKey = "";
    }
  }
  return metadata;
}

function parseScalar(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function requiredMetadata(metadata, key, filename) {
  const value = String(metadata[key] || "").trim();
  if (!value) throw new Error(`Knowledge agent ${filename} is missing required frontmatter field "${key}"`);
  return value;
}

function requiredListMetadata(metadata, key, filename) {
  const values = normalizeStringList(metadata[key]);
  if (!values.length) throw new Error(`Knowledge agent ${filename} is missing required frontmatter list "${key}"`);
  return values;
}

function normalizeStringList(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return uniqueStrings(raw);
}

function uniqueStrings(values) {
  return [...new Set(values.map((item) => String(item || "").trim().replace(/^#+/, "")).filter(Boolean))];
}

function compareAgentOrder(a, b) {
  const ai = DEFAULT_AGENT_ORDER.indexOf(a);
  const bi = DEFAULT_AGENT_ORDER.indexOf(b);
  if (ai !== -1 || bi !== -1) {
    return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
  }
  return String(a).localeCompare(String(b));
}

function compareKnowledgeDocuments(a, b) {
  if (a.source !== b.source) return a.source === "agent" ? -1 : 1;
  return a.filename.localeCompare(b.filename, "he");
}

function summarizeKnowledgeSources({ documents = [], chunks = [], matches = [] }) {
  const summary = {
    agent: { documents: 0, chunks: 0, matches: 0 },
    upload: { documents: 0, chunks: 0, matches: 0 }
  };
  for (const doc of documents) incrementSource(summary, doc.source, "documents");
  for (const chunk of chunks) incrementSource(summary, chunk.source, "chunks");
  for (const match of matches) incrementSource(summary, match.source, "matches");
  return summary;
}

function incrementSource(summary, source, key) {
  const normalized = source === "upload" ? "upload" : "agent";
  summary[normalized][key] += 1;
}
