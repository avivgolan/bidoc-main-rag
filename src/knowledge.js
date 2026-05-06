import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const KNOWLEDGE_DIR = path.join(ROOT, "data", "knowledge-base");
const ALLOWED_EXTENSIONS = new Set([".md", ".txt"]);
const STOP_WORDS = new Set([
  "של", "על", "עם", "את", "זה", "זו", "הוא", "היא", "הם", "הן", "או", "אם", "כי", "לא", "כן", "מה", "מי",
  "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "a", "an", "with", "by", "from"
]);

export function listKnowledgeDocuments() {
  ensureKnowledgeDir();
  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter((filename) => ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .map((filename) => {
      const fullPath = path.join(KNOWLEDGE_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function saveKnowledgeDocument({ filename, content }) {
  ensureKnowledgeDir();
  const safeName = sanitizeKnowledgeFilename(filename);
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, safeName), String(content || ""), "utf8");
  return readKnowledgeDocument(safeName);
}

export function readKnowledgeDocument(filename) {
  const safeName = sanitizeKnowledgeFilename(filename);
  const fullPath = path.join(KNOWLEDGE_DIR, safeName);
  if (!fs.existsSync(fullPath)) throw new Error("Knowledge document not found");
  const stat = fs.statSync(fullPath);
  return {
    filename: safeName,
    content: fs.readFileSync(fullPath, "utf8"),
    size: stat.size,
    updatedAt: stat.mtime.toISOString()
  };
}

export function deleteKnowledgeDocument(filename) {
  const safeName = sanitizeKnowledgeFilename(filename);
  const fullPath = path.join(KNOWLEDGE_DIR, safeName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  return { filename: safeName, deleted: true };
}

export function searchKnowledgeBase({ query, tags = [], topK = 6 }) {
  const documents = listKnowledgeDocuments();
  const queryText = String(query || "");
  const queryTokens = tokenize(queryText);
  const normalizedTags = normalizeTags(tags);
  const chunks = documents.flatMap((document) => chunkDocument(readKnowledgeDocument(document.filename)));

  const matches = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk({ chunk, queryText, queryTokens, tags: normalizedTags })
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(topK || 6));

  return {
    matches,
    totalDocuments: documents.length,
    totalChunks: chunks.length
  };
}

export function sanitizeKnowledgeFilename(filename) {
  const raw = path.basename(String(filename || "").trim());
  if (!raw) throw new Error("filename is required");
  const extension = path.extname(raw).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Only .txt and .md knowledge documents are supported");
  return raw.replace(/[^\w.\-\u0590-\u05FF ]+/g, "_");
}

function ensureKnowledgeDir() {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

function chunkDocument(document) {
  const blocks = document.content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const chunks = [];
  for (const [index, block] of blocks.entries()) {
    const text = block.length > 1800 ? block.slice(0, 1800) : block;
    chunks.push({
      filename: document.filename,
      chunkIndex: index,
      text,
      tokens: tokenize(text)
    });
  }
  return chunks;
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
  const raw = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? tags.split(/[,\s]+/)
      : [];
  return [...new Set(raw.map((tag) => String(tag || "").trim().replace(/^#+/, "")).filter(Boolean))];
}
