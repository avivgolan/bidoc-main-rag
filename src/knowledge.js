import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const KNOWLEDGE_ROOT = path.join(ROOT, "data", "knowledge-base");
const ALLOWED_EXTENSIONS = new Set([".md", ".txt"]);

export const KNOWLEDGE_AGENTS = [
  {
    id: "schedule",
    name: "Schedule Knowledge Agent",
    description: "חסמים, עיכובים, לו״ז, נתיב קריטי וניהול זמן.",
    tags: ["עיכובים", "חסמים", "לו״ז", "לוחות_זמנים", "תלויות", "גורמי_עיכוב", "נתיב_קריטי"],
    keywords: ["עיכוב", "עיכובים", "חסם", "חסמים", "לו״ז", "לוח זמנים", "תלות", "תלויות", "נתיב קריטי", "delay", "schedule", "blocker"]
  },
  {
    id: "safety_quality",
    name: "Safety & Quality Knowledge Agent",
    description: "בטיחות, ליקויים, QC, איכות, עצירת עבודה וסיכונים באתר.",
    tags: ["בטיחות", "בקרת_איכות", "ליקויים", "QC", "סיכונים", "עצירת_עבודה"],
    keywords: ["בטיחות", "ליקוי", "ליקויים", "qc", "איכות", "סיכון", "סיכונים", "עצירת עבודה", "defect", "safety", "quality"]
  },
  {
    id: "commercial",
    name: "Commercial Knowledge Agent",
    description: "חריגים, תביעות, עלויות, אחריות, חוזים ואישורים מסחריים.",
    tags: ["חריגים", "תביעות", "עלויות", "כספים", "אחריות", "חוזים", "אישורים"],
    keywords: ["חריג", "חריגים", "תביעה", "תביעות", "עלות", "עלויות", "כסף", "חוזה", "אחריות", "אישור", "change order", "claim", "commercial"]
  }
];

const STOP_WORDS = new Set([
  "של", "על", "עם", "את", "זה", "זו", "הוא", "היא", "הם", "הן", "או", "אם", "כי", "לא", "כן", "מה", "מי",
  "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "a", "an", "with", "by", "from"
]);

export function listKnowledgeAgents() {
  return KNOWLEDGE_AGENTS;
}

export function routeKnowledgeAgents({ message = "", tags = [], limit = 2 } = {}) {
  const text = `${message} ${normalizeTags(tags).join(" ")}`.toLowerCase();
  const scored = KNOWLEDGE_AGENTS
    .map((agent) => {
      let score = 0;
      for (const keyword of agent.keywords) {
        if (text.includes(String(keyword).toLowerCase())) score += 3;
      }
      for (const tag of agent.tags) {
        if (text.includes(String(tag).toLowerCase())) score += 2;
      }
      return { ...agent, score };
    })
    .filter((agent) => agent.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(limit || 2));
  return scored.length ? scored : [KNOWLEDGE_AGENTS[0]];
}

export async function listKnowledgeDocuments({ agentId } = {}) {
  const agents = agentId ? [normalizeAgentId(agentId)] : KNOWLEDGE_AGENTS.map((agent) => agent.id);
  const documents = [];
  for (const id of agents) {
    await ensureAgentDir(id);
    const entries = await fs.readdir(agentDir(id), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const filePath = path.join(agentDir(id), entry.name);
      const stat = await fs.stat(filePath);
      documents.push({
        agentId: id,
        agentName: knowledgeAgentName(id),
        filename: entry.name,
        storedFilename: `${id}/${entry.name}`,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      });
    }
  }
  return documents.sort((a, b) => a.filename.localeCompare(b.filename, "he"));
}

export async function saveKnowledgeDocument({ filename, content, agentId = "schedule" }) {
  const id = normalizeAgentId(agentId);
  const safeName = sanitizeKnowledgeFilename(filename);
  await ensureAgentDir(id);
  const filePath = safeKnowledgePath(id, safeName);
  await fs.writeFile(filePath, String(content || ""), "utf8");
  const stat = await fs.stat(filePath);
  return {
    agentId: id,
    agentName: knowledgeAgentName(id),
    filename: safeName,
    storedFilename: `${id}/${safeName}`,
    content: String(content || ""),
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

export async function readKnowledgeDocument(filename, { agentId } = {}) {
  const resolved = resolveKnowledgeTarget(filename, agentId);
  const content = await fs.readFile(safeKnowledgePath(resolved.agentId, resolved.filename), "utf8");
  const stat = await fs.stat(safeKnowledgePath(resolved.agentId, resolved.filename));
  return {
    agentId: resolved.agentId,
    agentName: knowledgeAgentName(resolved.agentId),
    filename: resolved.filename,
    storedFilename: `${resolved.agentId}/${resolved.filename}`,
    content,
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

export async function deleteKnowledgeDocument(filename, { agentId } = {}) {
  const resolved = resolveKnowledgeTarget(filename, agentId);
  await fs.unlink(safeKnowledgePath(resolved.agentId, resolved.filename));
  return { agentId: resolved.agentId, filename: resolved.filename, deleted: true };
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

  return { agentId: agentId ? normalizeAgentId(agentId) : null, matches, totalDocuments: documents.length, totalChunks: chunks.length };
}

export function sanitizeKnowledgeFilename(filename) {
  const raw = String(filename || "").trim().split(/[\\/]/).pop();
  if (!raw) throw new Error("filename is required");
  const ext = path.extname(raw).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error("Only .txt and .md knowledge documents are supported");
  return raw.replace(/[^\w.\-\u0590-\u05FF ]+/g, "_");
}

async function loadKnowledgeDocuments(agentId) {
  const summaries = await listKnowledgeDocuments({ agentId });
  return Promise.all(summaries.map(async (summary) => ({
    ...summary,
    content: await fs.readFile(safeKnowledgePath(summary.agentId, summary.filename), "utf8")
  })));
}

function chunkDocument(document, { chunkSize = 1800 } = {}) {
  const max = Math.min(Math.max(Number(chunkSize || 1800), 300), 6000);
  const blocks = document.content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((text, index) => ({
    agentId: document.agentId,
    agentName: document.agentName,
    filename: document.filename,
    storedFilename: document.storedFilename,
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
  return [...new Set(raw.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}

function normalizeAgentId(agentId) {
  const id = String(agentId || "schedule").trim();
  return KNOWLEDGE_AGENTS.some((agent) => agent.id === id) ? id : "schedule";
}

function knowledgeAgentName(agentId) {
  return KNOWLEDGE_AGENTS.find((agent) => agent.id === normalizeAgentId(agentId))?.name || "Schedule Knowledge Agent";
}

function agentDir(agentId) {
  return path.join(KNOWLEDGE_ROOT, normalizeAgentId(agentId));
}

async function ensureAgentDir(agentId) {
  await fs.mkdir(agentDir(agentId), { recursive: true });
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
  if (rest.length && KNOWLEDGE_AGENTS.some((agent) => agent.id === maybeAgent)) {
    return { agentId: maybeAgent, filename: sanitizeKnowledgeFilename(rest.join("/")) };
  }
  return { agentId: normalizeAgentId(agentId), filename: sanitizeKnowledgeFilename(raw) };
}
