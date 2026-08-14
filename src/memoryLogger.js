import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MEMORY_LOG_PATH = path.join(PROJECT_ROOT, "logs", "chat-memory.jsonl");
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_BACKUPS = 5;
let writeQueue = Promise.resolve();

export function appendMemoryLog(entry = {}) {
  const safe = sanitizeMemoryLogEntry(entry);
  const line = `${JSON.stringify(safe)}\n`;
  const operation = writeQueue.then(() => appendWithRotation(line));
  writeQueue = operation.catch(() => {});
  return operation
    .then(() => ({ ok: true, path: MEMORY_LOG_PATH }))
    .catch((error) => ({ ok: false, error: redactLogText(error.message) }));
}

export function sanitizeMemoryLogEntry(entry = {}) {
  const recalledScores = Array.isArray(entry.recalledScores) ? entry.recalledScores : [];
  const errors = Array.isArray(entry.errors) ? entry.errors : [];
  return {
    timestamp: new Date().toISOString(),
    event: "chat_memory",
    runId: safeIdentifier(entry.runId),
    sessionId: safeIdentifier(entry.sessionId),
    userHash: hashLogIdentifier(entry.userId),
    mode: safeEnum(entry.mode, ["disabled", "session", "session_only", "user_and_session"], "unknown"),
    selectedAgent: safeEnum(entry.selectedAgent, ["main", "lite", "memory_action"], "unknown"),
    routeType: safeEnum(entry.routeType, ["CHAT", "RAG"], "unknown"),
    originalMessage: redactLogText(entry.originalMessage).slice(0, 600),
    standaloneQuery: redactLogText(entry.standaloneQuery).slice(0, 600),
    queryRewritten: Boolean(entry.queryRewritten),
    recentTurns: boundedInteger(entry.recentTurns, 0, 100),
    recalledItems: boundedInteger(entry.recalledItems, 0, 100),
    recalledScores: recalledScores.slice(0, 30).map((item) => ({
      similarity: boundedScore(item?.similarity),
      score: boundedScore(item?.score),
      recencyScore: boundedScore(item?.recency_score ?? item?.recencyScore),
      importance: boundedScore(item?.importance)
    })),
    contextEstimatedTokens: boundedInteger(entry.contextEstimatedTokens, 0, 100_000),
    turnCount: boundedInteger(entry.turnCount, 0, 1_000_000),
    memoryAction: entry.memoryAction ? {
      kind: safeEnum(entry.memoryAction.kind, ["remember", "forget", "unknown"], "unknown"),
      ok: Boolean(entry.memoryAction.ok),
      reason: redactLogText(entry.memoryAction.reason).slice(0, 120) || null,
      affectedItems: boundedInteger(entry.memoryAction.count ?? (entry.memoryAction.id ? 1 : 0), 0, 100)
    } : null,
    learnedItems: boundedInteger(entry.learnedItems, 0, 100),
    rejectedItems: boundedInteger(entry.rejectedItems, 0, 100),
    degraded: Boolean(entry.degraded),
    loadLatencyMs: boundedInteger(entry.loadLatencyMs, 0, 3_600_000),
    maintenanceLatencyMs: boundedInteger(entry.maintenanceLatencyMs, 0, 3_600_000),
    errors: errors.slice(0, 20).map((error) => redactLogText(error?.message || error).slice(0, 500)).filter(Boolean)
  };
}

export function redactLogText(value = "") {
  return String(value || "")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(?:sk|pk)-(?:or-)?[a-z0-9_-]{10,}\b/gi, "[REDACTED_API_KEY]")
    .replace(/\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/((?:api[_ -]?key|token|password|secret|סיסמה|מפתח\s*api)\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+?972[-\s]?|0)(?:5\d|[23489])[-\s]?\d{3}[-\s]?\d{4}\b/g, "[REDACTED_PHONE]");
}

export function hashLogIdentifier(value = "") {
  const text = String(value || "").trim();
  if (!text) return null;
  return crypto.createHash("sha256").update(`bidoc-memory-log:${text}`).digest("hex").slice(0, 16);
}

async function appendWithRotation(line) {
  const maxBytes = boundedInteger(process.env.MEMORY_LOG_MAX_BYTES || DEFAULT_MAX_BYTES, 1024, 1024 * 1024 * 1024);
  const backups = boundedInteger(process.env.MEMORY_LOG_BACKUPS || DEFAULT_BACKUPS, 1, 20);
  await fs.mkdir(path.dirname(MEMORY_LOG_PATH), { recursive: true });
  const currentSize = await fs.stat(MEMORY_LOG_PATH).then((stat) => stat.size).catch((error) => {
    if (error.code === "ENOENT") return 0;
    throw error;
  });
  if (currentSize + Buffer.byteLength(line, "utf8") > maxBytes) {
    await rotateLogs(backups);
  }
  await fs.appendFile(MEMORY_LOG_PATH, line, "utf8");
}

async function rotateLogs(backups) {
  for (let index = backups; index >= 1; index -= 1) {
    const source = index === 1 ? MEMORY_LOG_PATH : `${MEMORY_LOG_PATH}.${index - 1}`;
    const target = `${MEMORY_LOG_PATH}.${index}`;
    await fs.rm(target, { force: true });
    await fs.rename(source, target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function safeIdentifier(value) {
  return redactLogText(value).replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 180) || null;
}

function safeEnum(value, allowed, fallback) {
  const text = String(value || "");
  return allowed.includes(text) ? text : fallback;
}

function boundedInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.round(Math.min(max, Math.max(min, number)));
}

function boundedScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(1, Math.max(0, number)) * 10_000) / 10_000;
}

