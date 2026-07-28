import { chatCompletion } from "../openrouter.js";
import { supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const PROJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_IDENTITY_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_ATTACHMENT_ID_LENGTH = 2048;
const MAX_EVIDENCE_ROWS = 50;
const MAX_EVIDENCE_CHARACTERS = 24_000;

function normalizeScope(scope = {}) {
  const exceptionId = Number(scope.exceptionId);
  const projectId = String(scope.projectId || "").trim().toLowerCase();
  const attachmentId = String(scope.attachmentId || "").trim();
  if (!Number.isSafeInteger(exceptionId) || exceptionId < 1) return null;
  if (!PROJECT_UUID.test(projectId)) return null;
  if (!attachmentId || attachmentId.length > MAX_ATTACHMENT_ID_LENGTH || UNSAFE_IDENTITY_CHARACTERS.test(attachmentId)) return null;
  return { exceptionId, projectId, attachmentId };
}

function sanitizeSemanticAnswer(value) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[redacted email]")
    .replace(/https?:\/\/\S+/giu, "[redacted link]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, "[redacted identifier]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .trim();
}

function containsUnrequestedMonetaryValue(value) {
  const text = String(value || "");
  return /[₪$€£]\s*\d|\d(?:[\d,.]*\d)?\s*(?:ש[״"]?ח|שקל(?:ים)?|NIS|ILS|USD|EUR|dollars?|shekels?|euros?)/iu.test(text) ||
    /(?:total\s+cost|price|amount|before\s+VAT|סך\s+ההצעה|סכום|מחיר|עלות|לפני\s+מע[״"]?מ).{0,45}\d/iu.test(text);
}

export async function runExceptionEvidenceAgent({
  config,
  question = "",
  scope = {},
  fetchImpl = fetch,
  chatComplete = chatCompletion,
  timeoutMs = 20_000,
  telemetry = null
} = {}) {
  const normalizedScope = normalizeScope(scope);
  if (!normalizedScope) {
    return { status: "not_computable", same_exception_match: false, evidence_count: 0, answer: "" };
  }
  const connection = contentSupabaseConfig(config);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey || !config?.openRouterApiKey) {
    return { status: "unavailable", same_exception_match: false, evidence_count: 0, answer: "" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      select: "source_id,project_id,attachment_id,content,chunk_index,chunk_total,primary_date",
      source_id: `eq.${normalizedScope.exceptionId}`,
      project_id: `eq.${normalizedScope.projectId}`,
      attachment_id: `eq.${normalizedScope.attachmentId}`,
      order: "chunk_index.asc",
      limit: String(MAX_EVIDENCE_ROWS)
    });
    const response = await fetchImpl(
      `${connection.supabaseUrl}/rest/v1/exceptions_report_documents?${params}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          ...supabaseHeaders(connection.supabaseServiceRoleKey),
          Accept: "application/json",
          Prefer: "count=exact"
        }
      }
    );
    const raw = await response.text();
    let rows = [];
    try {
      rows = raw ? JSON.parse(raw) : [];
    } catch {
      return { status: "unavailable", same_exception_match: false, evidence_count: 0, answer: "" };
    }
    if (!response.ok || !Array.isArray(rows) || rows.length > MAX_EVIDENCE_ROWS) {
      return { status: "unavailable", same_exception_match: false, evidence_count: 0, answer: "" };
    }
    const attested = rows.every((row) =>
      Number(row?.source_id) === normalizedScope.exceptionId &&
      String(row?.project_id || "").trim().toLowerCase() === normalizedScope.projectId &&
      String(row?.attachment_id || "").trim() === normalizedScope.attachmentId &&
      typeof row?.content === "string" &&
      row.content.trim()
    );
    if (!attested) {
      return { status: "not_computable", same_exception_match: false, evidence_count: 0, answer: "" };
    }
    if (!rows.length) {
      return { status: "not_found", same_exception_match: true, evidence_count: 0, answer: "" };
    }
    const evidence = rows
      .map((row, index) => `[chunk ${index + 1}]\n${row.content.trim()}`)
      .join("\n\n")
      .slice(0, MAX_EVIDENCE_CHARACTERS);
    const answer = await chatComplete({
      apiKey: config.openRouterApiKey,
      model: config.models?.lite || config.models?.main,
      temperature: 0,
      maxTokens: 1400,
      timeoutMs: Math.min(timeoutMs, 18_000),
      telemetry,
      messages: [
        {
          role: "system",
          content: [
            "You summarize evidence for exactly one attested construction exception record.",
            "Answer only the user's semantic question from the supplied chunks.",
            "Do not expose personal names, email addresses, project/record/attachment identifiers, filenames, URLs, or unrequested monetary values.",
            "Refer to people and companies by generic roles when needed. Do not infer approval, rejection, responsibility, entitlement, or causality beyond the evidence.",
            "If the chunks do not answer the question, say that same-record evidence is insufficient. Keep the answer concise and use the user's language."
          ].join(" ")
        },
        { role: "user", content: JSON.stringify({ question, evidence }) }
      ]
    });
    const safeAnswer = sanitizeSemanticAnswer(answer);
    if (!safeAnswer || containsUnrequestedMonetaryValue(safeAnswer)) {
      return {
        status: "not_computable",
        same_exception_match: true,
        evidence_count: rows.length,
        answer: ""
      };
    }
    return {
      status: "ok",
      same_exception_match: true,
      evidence_count: rows.length,
      answer: safeAnswer
    };
  } catch {
    return { status: "unavailable", same_exception_match: false, evidence_count: 0, answer: "" };
  } finally {
    clearTimeout(timeout);
  }
}
