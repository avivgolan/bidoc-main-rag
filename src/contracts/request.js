import { ContractsAgentError } from "./errors.js";
import { CONTRACTS_MAX_JSON_BYTES, CONTRACTS_MAX_PDF_BYTES } from "./constants.js";

export { CONTRACTS_MAX_JSON_BYTES, CONTRACTS_MAX_PDF_BYTES };

const REQUEST_FIELDS = new Set([
  "filename",
  "mediaType",
  "pdfBase64",
  "projectSelection",
  "sourceId",
  "mode"
]);
const PROJECT_FIELDS = new Set(["projectId", "projectSite", "selectedByUser"]);

export async function readJsonBounded(req, maxBytes = CONTRACTS_MAX_JSON_BYTES) {
  const declaredLength = Number(req.headers?.["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ContractsAgentError(
      "contracts_request_too_large",
      `Contract extraction request exceeds the ${maxBytes}-byte limit.`,
      413
    );
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) {
      throw new ContractsAgentError(
        "contracts_request_too_large",
        `Contract extraction request exceeds the ${maxBytes}-byte limit.`,
        413
      );
    }
    chunks.push(bytes);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) throw new ContractsAgentError("contracts_request_empty", "Request body is required.", 400);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ContractsAgentError("contracts_request_invalid_json", "Request body must be valid JSON.", 400);
  }
}

export function parseContractExtractionRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ContractsAgentError("contracts_request_invalid", "Request body must be a JSON object.", 400);
  }

  if (body.commit !== undefined || body.persist !== undefined) {
    throw new ContractsAgentError(
      "contracts_write_options_forbidden",
      "Phase 1 contract extraction is dry-run only and does not accept write options.",
      400
    );
  }

  const unknownField = Object.keys(body).find((key) => !REQUEST_FIELDS.has(key));
  if (unknownField) {
    throw new ContractsAgentError(
      "contracts_request_unknown_field",
      `Unsupported request field: ${unknownField}`,
      400
    );
  }

  if (body.mode !== undefined && body.mode !== "dry_run") {
    throw new ContractsAgentError(
      "contracts_mode_not_supported",
      "Phase 1 supports mode=\"dry_run\" only.",
      400
    );
  }

  const filename = String(body.filename || "").normalize("NFC").trim();
  if (!filename || filename.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(filename)) {
    throw new ContractsAgentError(
      "contracts_filename_invalid",
      "filename is required and must be a plain filename of at most 255 characters.",
      400
    );
  }

  const mediaType = String(body.mediaType || "").trim().toLowerCase();
  if (mediaType !== "application/pdf") {
    throw new ContractsAgentError(
      "contracts_media_type_unsupported",
      "mediaType must be application/pdf.",
      415
    );
  }

  const pdfBytes = decodeStrictBase64(body.pdfBase64);
  if (pdfBytes.length > CONTRACTS_MAX_PDF_BYTES) {
    throw new ContractsAgentError(
      "contracts_pdf_too_large",
      `Decoded PDF exceeds the ${CONTRACTS_MAX_PDF_BYTES}-byte Phase 1 limit.`,
      413
    );
  }
  if (pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new ContractsAgentError(
      "contracts_pdf_signature_invalid",
      "The uploaded payload is not a valid PDF document.",
      422
    );
  }

  return {
    filename,
    mediaType,
    pdfBytes,
    projectSelection: normalizeProjectSelection(body.projectSelection),
    sourceId: normalizeNullableIdentifier(body.sourceId, "sourceId")
  };
}

function decodeStrictBase64(value) {
  if (typeof value !== "string" || !value) {
    throw new ContractsAgentError("contracts_pdf_missing", "pdfBase64 is required.", 400);
  }
  const input = value.trim();
  if (
    !input ||
    input.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(input)
  ) {
    throw new ContractsAgentError("contracts_pdf_base64_invalid", "pdfBase64 must be strict base64.", 400);
  }
  const decoded = Buffer.from(input, "base64");
  if (decoded.toString("base64") !== input) {
    throw new ContractsAgentError("contracts_pdf_base64_invalid", "pdfBase64 must be canonical base64.", 400);
  }
  return decoded;
}

function normalizeProjectSelection(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ContractsAgentError(
      "contracts_project_selection_invalid",
      "projectSelection must be an object when supplied.",
      400
    );
  }
  const unknownField = Object.keys(value).find((key) => !PROJECT_FIELDS.has(key));
  if (unknownField) {
    throw new ContractsAgentError(
      "contracts_project_selection_invalid",
      `Unsupported projectSelection field: ${unknownField}`,
      400
    );
  }
  if (value.selectedByUser !== true) {
    throw new ContractsAgentError(
      "contracts_project_selection_not_explicit",
      "projectSelection.selectedByUser must be true for an explicit binding candidate.",
      400
    );
  }
  const projectId = normalizeNullableIdentifier(value.projectId, "projectSelection.projectId");
  const projectSite = normalizeNullableText(value.projectSite, 500, "projectSelection.projectSite");
  if (!projectId) {
    throw new ContractsAgentError(
      "contracts_project_id_missing",
      "projectSelection.projectId is required when projectSelection is supplied.",
      400
    );
  }
  return { projectId, projectSite, selectedByUser: true };
}

function normalizeNullableIdentifier(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 256 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ContractsAgentError("contracts_identifier_invalid", `${field} is invalid.`, 400);
  }
  return normalized;
}

function normalizeNullableText(value, maxLength, field) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).normalize("NFC").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ContractsAgentError("contracts_text_invalid", `${field} is invalid.`, 400);
  }
  return normalized;
}
