// A Contract File passed by URL instead of as base64 in the JSON body.
//
// Vercel refuses request bodies over 4.5 MB, so a contract of more than about
// 3.3 MB could never reach the clause parser as `pdfBase64`. BiDoc web now sends
// `pdfUrl`: a short-lived Supabase Storage signed URL for the File in the
// Project's Company DB, and main-agent fetches the bytes itself. `pdfBase64`
// keeps working unchanged (n8n still posts it).
//
// The URL is validated before any request is made (SSRF): https only, default
// port, no userinfo, a Supabase host (or one listed in
// CONTRACTS_PDF_URL_ALLOWED_HOSTS), and the Storage signed-object path. The
// body is streamed with the same byte cap as decoded base64, redirects are
// refused, and the signed URL is never echoed in errors or logs.

import crypto from "node:crypto";
import { ContractsAgentError } from "./errors.js";
import { CONTRACTS_MAX_PDF_BYTES } from "./constants.js";

export const CONTRACTS_PDF_URL_FETCH_TIMEOUT_MS = 60_000;
const MAX_URL_LENGTH = 4096;
const SIGNED_OBJECT_PATH = /^\/storage\/v1\/object\/sign\/[^/]+\/.+/u;
const DEFAULT_HOST_SUFFIXES = Object.freeze([".supabase.co", ".supabase.in"]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

/** Bytes resolved from `pdfUrl`, attached under a Symbol so JSON input can never forge them. */
export const RESOLVED_CONTRACT_BYTES = Symbol.for("bidoc.contracts.resolvedDocumentBytes");

function allowedHost(hostname, env) {
  const host = String(hostname || "").toLowerCase();
  if (!host || host.includes(":")) return false; // no IPv6 literals
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host)) return false; // no IPv4 literals
  const extra = String(env?.CONTRACTS_PDF_URL_ALLOWED_HOSTS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const exact = extra.filter((entry) => !entry.startsWith("."));
  const suffixes = [...DEFAULT_HOST_SUFFIXES, ...extra.filter((entry) => entry.startsWith("."))];
  if (exact.includes(host)) return true;
  return suffixes.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

function urlError(message) {
  return new ContractsAgentError("contracts_pdf_url_invalid", message, 400);
}

/** The validated signed URL, or a 400 `contracts_pdf_url_invalid`. */
export function validateContractPdfUrl(value, { env = process.env } = {}) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_URL_LENGTH) {
    throw urlError("pdfUrl must be a Supabase Storage signed URL.");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw urlError("pdfUrl must be an absolute URL.");
  }
  if (url.protocol !== "https:") throw urlError("pdfUrl must use https.");
  if (url.username || url.password) throw urlError("pdfUrl must not carry credentials.");
  if (url.port && url.port !== "443") throw urlError("pdfUrl must use the default https port.");
  if (!allowedHost(url.hostname, env)) throw urlError("pdfUrl host is not an allowed Supabase Storage host.");
  if (!SIGNED_OBJECT_PATH.test(url.pathname) || url.pathname.split("/").some((segment) => segment === "..")) {
    throw urlError("pdfUrl must be a Supabase Storage signed object URL.");
  }
  if (!url.searchParams.get("token")) throw urlError("pdfUrl must carry its signed token.");
  url.hash = "";
  return url;
}

async function readCapped(response, maxBytes) {
  const tooLarge = () => new ContractsAgentError(
    "contracts_pdf_too_large",
    `Fetched document exceeds the ${maxBytes}-byte Phase 1 limit.`,
    413
  );
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel?.().catch(() => {});
    throw tooLarge();
  }
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw tooLarge();
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
  }
  return Buffer.concat(chunks, total);
}

/**
 * Fetches a validated signed URL with the byte cap. Storage 4xx (expired or
 * unknown object) is a 422 the caller should not retry; network errors and
 * Storage 5xx are a 502 a retry may fix.
 */
export async function fetchContractPdfUrl(url, {
  fetchImpl = globalThis.fetch,
  maxBytes = CONTRACTS_MAX_PDF_BYTES,
  timeoutMs = CONTRACTS_PDF_URL_FETCH_TIMEOUT_MS,
  signal = null
} = {}) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: combined,
      headers: { accept: "application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, */*" }
    });
  } catch (error) {
    throw new ContractsAgentError(
      "contracts_pdf_url_fetch_failed",
      "The contract document could not be fetched from storage.",
      502,
      { cause: error, details: { reason: String(error?.name || "fetch_failed").slice(0, 80) } }
    );
  }
  if (!response.ok) {
    await response.body?.cancel?.().catch(() => {});
    const status = Number(response.status) || 0;
    if (status >= 400 && status < 500) {
      throw new ContractsAgentError(
        "contracts_pdf_url_rejected",
        "Storage refused the contract document URL (expired or unknown object).",
        422,
        { details: { storageStatus: status } }
      );
    }
    throw new ContractsAgentError(
      "contracts_pdf_url_fetch_failed",
      "The contract document could not be fetched from storage.",
      502,
      { details: { storageStatus: status } }
    );
  }
  try {
    return await readCapped(response, maxBytes);
  } catch (error) {
    if (error instanceof ContractsAgentError) throw error;
    throw new ContractsAgentError(
      "contracts_pdf_url_fetch_failed",
      "The contract document stream failed.",
      502,
      { cause: error, details: { reason: String(error?.name || "stream_failed").slice(0, 80) } }
    );
  }
}

/**
 * Resolves a contract request body's document source before the synchronous
 * request parser runs. A body with `pdfBase64` (n8n) is returned unchanged. A
 * body with `pdfUrl` (BiDoc web) comes back without `pdfUrl` and with the
 * fetched bytes under RESOLVED_CONTRACT_BYTES; an optional `pdfSha256` must
 * match them. Bodies with neither are returned unchanged so the parser reports
 * `contracts_pdf_missing` as before.
 */
export async function resolveContractDocumentSource(body, options = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const hasUrl = Object.prototype.hasOwnProperty.call(body, "pdfUrl");
  const hasSha = Object.prototype.hasOwnProperty.call(body, "pdfSha256");
  if (!hasUrl) {
    if (hasSha) {
      throw new ContractsAgentError("contracts_request_unknown_field", "pdfSha256 is accepted only with pdfUrl.", 400);
    }
    return body;
  }
  if (body.pdfBase64 !== undefined && body.pdfBase64 !== null && body.pdfBase64 !== "") {
    throw new ContractsAgentError(
      "contracts_pdf_source_ambiguous",
      "Send either pdfBase64 or pdfUrl, not both.",
      400
    );
  }
  let expectedSha = null;
  if (hasSha && body.pdfSha256 !== null && body.pdfSha256 !== undefined) {
    expectedSha = String(body.pdfSha256).trim().toLowerCase();
    if (!SHA256_PATTERN.test(expectedSha)) {
      throw new ContractsAgentError("contracts_pdf_sha256_invalid", "pdfSha256 must be 64 hex characters.", 400);
    }
  }
  const url = validateContractPdfUrl(body.pdfUrl, options);
  const bytes = await fetchContractPdfUrl(url, options);
  if (!bytes.length) {
    throw new ContractsAgentError("contracts_pdf_missing", "The fetched contract document is empty.", 422);
  }
  if (expectedSha) {
    const actual = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actual !== expectedSha) {
      throw new ContractsAgentError(
        "contracts_pdf_sha256_mismatch",
        "The fetched contract document does not match pdfSha256.",
        422
      );
    }
  }
  const { pdfUrl: _pdfUrl, pdfSha256: _pdfSha256, ...rest } = body;
  return { ...rest, [RESOLVED_CONTRACT_BYTES]: bytes };
}
