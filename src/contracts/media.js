export const CONTRACTS_PDF_MEDIA_TYPE = "application/pdf";
export const CONTRACTS_DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const CONTRACTS_ALLOWED_STORAGE_MEDIA_TYPES = Object.freeze([
  CONTRACTS_PDF_MEDIA_TYPE,
  CONTRACTS_DOCX_MEDIA_TYPE
]);
const DECLARED_MEDIA_TYPES = new Set([
  CONTRACTS_PDF_MEDIA_TYPE,
  CONTRACTS_DOCX_MEDIA_TYPE,
  "application/octet-stream",
  "application/zip",
  "application/msword",
  "application/vnd.ms-word"
]);

export function normalizeMediaType(value) {
  return String(value || "").trim().toLowerCase().split(";", 1)[0].trim();
}

export function isAllowedContractDeclaredMediaType(value) {
  return DECLARED_MEDIA_TYPES.has(normalizeMediaType(value));
}

export function isPdfSignature(bytes) {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  return source.length >= 5 && source.subarray(0, 5).toString("latin1") === "%PDF-";
}

export function isZipSignature(bytes) {
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  return source.length >= 4
    && source[0] === 0x50
    && source[1] === 0x4b
    && (source[2] === 0x03 || source[2] === 0x05 || source[2] === 0x07)
    && (source[3] === 0x04 || source[3] === 0x06 || source[3] === 0x08);
}

export function contractStorageExtension(mediaType) {
  return normalizeMediaType(mediaType) === CONTRACTS_DOCX_MEDIA_TYPE ? ".docx" : ".pdf";
}

export function isAllowedContractsStorageMimeTypes(mimeTypes) {
  if (!Array.isArray(mimeTypes) || mimeTypes.length < 1) return false;
  const allowed = new Set(CONTRACTS_ALLOWED_STORAGE_MEDIA_TYPES);
  const normalized = [...new Set(mimeTypes.map((value) => normalizeMediaType(value)).filter(Boolean))];
  return normalized.includes(CONTRACTS_PDF_MEDIA_TYPE)
    && normalized.every((type) => allowed.has(type));
}
