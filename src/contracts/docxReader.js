import {
  CONTRACTS_DOCX_READER_VERSION,
  CONTRACTS_MAX_PAGES,
  CONTRACTS_MAX_TEXT_CHARACTERS
} from "./constants.js";
import { ContractsAgentError } from "./errors.js";
import { isZipSignature } from "./media.js";
import { unzipNamedEntry } from "./zip.js";

export { CONTRACTS_DOCX_READER_VERSION };
const DOCUMENT_ENTRY = "word/document.xml";
const PAGE_BREAK = "\f";

export function isDocxArchive(bytes) {
  if (!isZipSignature(bytes)) return false;
  return unzipNamedEntry(bytes, DOCUMENT_ENTRY) !== null;
}

export async function readContractDocx({
  pdfBytes,
  maxPages = CONTRACTS_MAX_PAGES,
  maxTextCharacters = CONTRACTS_MAX_TEXT_CHARACTERS
} = {}) {
  const bytes = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes || []);
  const documentXml = unzipNamedEntry(bytes, DOCUMENT_ENTRY);
  if (!documentXml) {
    throw new ContractsAgentError(
      "contracts_docx_invalid",
      "The uploaded payload is not a valid DOCX document.",
      422
    );
  }

  const pages = splitDocxPages(extractDocxText(documentXml.toString("utf8")));
  if (!pages.length) {
    throw new ContractsAgentError(
      "contracts_docx_empty",
      "The DOCX contains no readable paragraphs.",
      422
    );
  }
  if (pages.length > maxPages) {
    throw new ContractsAgentError(
      "contracts_docx_page_limit",
      `The DOCX exceeds the ${maxPages}-page Phase 1 limit.`,
      413
    );
  }

  const extractedCharacters = pages.reduce((total, page) => total + page.characterCount, 0);
  if (extractedCharacters > maxTextCharacters) {
    throw new ContractsAgentError(
      "contracts_docx_text_limit",
      `Extracted DOCX text exceeds the ${maxTextCharacters}-character Phase 1 limit.`,
      413
    );
  }
  if (extractedCharacters < 40) {
    throw new ContractsAgentError(
      "contracts_docx_text_unavailable",
      "The DOCX has no usable text.",
      422
    );
  }

  return {
    readerVersion: CONTRACTS_DOCX_READER_VERSION,
    pageCount: pages.length,
    extractedCharacters,
    unreadablePages: [],
    pages
  };
}

export function extractDocxText(xml) {
  return decodeXmlEntities(
    String(xml || "")
      .replace(/<w:lastRenderedPageBreak\b[^>]*\/?>/giu, PAGE_BREAK)
      .replace(/<w:br\b[^>]*w:type=["']page["'][^>]*\/?>/giu, PAGE_BREAK)
      .replace(/<w:tab\b[^>]*\/?>/giu, "\t")
      .replace(/<w:br\b[^>]*\/?>/giu, "\n")
      .replace(/<\/w:p>/giu, "\n")
      .replace(/<[^>]+>/gu, "")
  )
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function splitDocxPages(text) {
  const chunks = String(text || "").split(PAGE_BREAK)
    .map((page) => page.trim())
    .filter(Boolean);
  return chunks.map((pageText, index) => ({
    pdfPage: index + 1,
    text: pageText,
    characterCount: pageText.length
  }));
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/gu, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&apos;/gu, "'");
}

function safeCodePoint(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return "";
  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}
