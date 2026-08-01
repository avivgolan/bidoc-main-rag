import { chatCompletion } from "../openrouter.js";
import { supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const PROJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_IDENTITY_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_ATTACHMENT_ID_LENGTH = 2048;
const MAX_EVIDENCE_ROWS = 50;
const MAX_EVIDENCE_CHARACTERS = 24_000;

function normalizeScope(scope = {}) {
  const reportId = Number(scope.reportId);
  const projectId = String(scope.projectId || "").trim().toLowerCase();
  const attachmentId = String(scope.attachmentId || "").trim();
  if (!Number.isSafeInteger(reportId) || reportId < 1) return null;
  if (!PROJECT_UUID.test(projectId)) return null;
  if (!attachmentId || attachmentId.length > MAX_ATTACHMENT_ID_LENGTH || UNSAFE_IDENTITY_CHARACTERS.test(attachmentId)) return null;
  return { reportId, projectId, attachmentId };
}

export function sanitizeConsultantReportEvidenceAnswer(value) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, "[redacted email]")
    .replace(/https?:\/\/\S+/giu, "[redacted link]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, "[redacted identifier]")
    .replace(/\b(?:report|document)\s+(?:number|no\.?|#)\s*[:#-]?\s*[A-Z0-9][A-Z0-9._/-]*/giu, "the report")
    .replace(/(?:דו["״']?ח|דוח|מסמך)\s+(?:מספר|מס[׳']|מס\.)\s*[:#-]?\s*[A-Z0-9][A-Z0-9._/-]*/giu, "הדוח")
    .replace(/\s*,?\s*(?:version|גרסה)\s+[A-Z0-9][A-Z0-9._/-]*\s*,?/giu, " ")
    .replace(/(?:הוא|הינה|הינו)\s+הדוח\s+מתאריך/gu, "מתוארך")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

export async function runConsultantReportEvidenceAgent({
  config,
  question = "",
  scope = {},
  fetchImpl = fetch,
  chatComplete = chatCompletion,
  timeoutMs = 20_000,
  telemetry = null
} = {}) {
  const normalizedScope = normalizeScope(scope);
  if (!normalizedScope) return { status: "not_computable", same_report_match: false, evidence_count: 0, answer: "" };
  const connection = contentSupabaseConfig(config);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey || !config?.openRouterApiKey) {
    return { status: "unavailable", same_report_match: false, evidence_count: 0, answer: "" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({
      select: "source_id,project_id,attachment_id,content,chunk_index,chunk_total,primary_date",
      source_id: `eq.${normalizedScope.reportId}`,
      project_id: `eq.${normalizedScope.projectId}`,
      attachment_id: `eq.${normalizedScope.attachmentId}`,
      order: "chunk_index.asc",
      limit: String(MAX_EVIDENCE_ROWS)
    });
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/consultants_reports_documents?${params}`, {
      method: "GET",
      signal: controller.signal,
      headers: { ...supabaseHeaders(connection.supabaseServiceRoleKey), Accept: "application/json", Prefer: "count=exact" }
    });
    const raw = await response.text();
    let rows = [];
    try { rows = raw ? JSON.parse(raw) : []; } catch { return { status: "unavailable", same_report_match: false, evidence_count: 0, answer: "" }; }
    if (!response.ok || !Array.isArray(rows) || rows.length > MAX_EVIDENCE_ROWS) {
      return { status: "unavailable", same_report_match: false, evidence_count: 0, answer: "" };
    }
    const attested = rows.every((row) =>
      Number(row?.source_id) === normalizedScope.reportId &&
      String(row?.project_id || "").trim().toLowerCase() === normalizedScope.projectId &&
      String(row?.attachment_id || "").trim() === normalizedScope.attachmentId &&
      typeof row?.content === "string" && row.content.trim()
    );
    if (!attested) return { status: "not_computable", same_report_match: false, evidence_count: 0, answer: "" };
    if (!rows.length) return { status: "not_found", same_report_match: true, evidence_count: 0, answer: "" };
    const evidence = rows.map((row, index) => `[chunk ${index + 1}]\n${row.content.trim()}`).join("\n\n").slice(0, MAX_EVIDENCE_CHARACTERS);
    const responseLanguage = /[\u0590-\u05ff]/u.test(question) ? "Hebrew" : "English";
    const answer = await chatComplete({
      apiKey: config.openRouterApiKey,
      model: config.models?.lite || config.models?.main,
      temperature: 0,
      maxTokens: 1400,
      timeoutMs: Math.min(timeoutMs, 18_000),
      telemetry,
      messages: [
        { role: "system", content: `You summarize evidence for exactly one attested consultant report. You MUST answer entirely in ${responseLanguage}, even when the evidence is written in another language. Answer only from the supplied chunks. Company names may be included when relevant, but do not expose personal identities, email addresses, project/record/attachment/document identifiers, report or document numbers, version numbers, filenames, or URLs. Do not infer approval, implementation, responsibility, or completion. If the evidence is insufficient, say so concisely.` },
        { role: "user", content: JSON.stringify({ question, response_language: responseLanguage, evidence }) }
      ]
    });
    const safeAnswer = sanitizeConsultantReportEvidenceAnswer(answer);
    return safeAnswer
      ? { status: "ok", same_report_match: true, evidence_count: rows.length, answer: safeAnswer }
      : { status: "not_computable", same_report_match: true, evidence_count: rows.length, answer: "" };
  } catch {
    return { status: "unavailable", same_report_match: false, evidence_count: 0, answer: "" };
  } finally {
    clearTimeout(timeout);
  }
}
