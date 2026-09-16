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
const NUMBERING_ENTRY = "word/numbering.xml";
const STYLES_ENTRY = "word/styles.xml";
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
  const numberingXml = unzipNamedEntry(bytes, NUMBERING_ENTRY);
  const stylesXml = unzipNamedEntry(bytes, STYLES_ENTRY);

  const pages = splitDocxPages(extractDocxText(
    documentXml.toString("utf8"),
    numberingXml ? numberingXml.toString("utf8") : "",
    stylesXml ? stylesXml.toString("utf8") : ""
  ));
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

export function extractDocxText(xml, numberingXml = "", stylesXml = "") {
  const numbering = parseWordNumbering(numberingXml);
  const styles = parseWordStyles(stylesXml);
  const countersByNum = new Map();
  const chunks = [];
  const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/giu;
  let match = paragraphPattern.exec(xml);
  if (!match) {
    return decodeXmlEntities(stripXmlTags(insertPageBreaks(String(xml || ""))))
      .replace(/\r\n?/gu, "\n")
      .replace(/[ \t]+\n/gu, "\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
  }

  paragraphPattern.lastIndex = 0;
  while ((match = paragraphPattern.exec(xml))) {
    const inner = match[1];
    const hasPageBreak = /<w:lastRenderedPageBreak\b/i.test(inner)
      || /<w:br\b[^>]*w:type=["']page["']/i.test(inner);
    const text = decodeXmlEntities(extractRunText(inner)).replace(/\s+/gu, " ").trim();
    const numPr = resolveNumPr(inner, styles);
    let line = text;
    if (numPr && numbering) {
      const label = nextListLabel(numbering, countersByNum, numPr.numId, numPr.ilvl);
      if (label && text && !/^\d{1,2}(?:\.\d{1,2}){0,4}[.)]?(?:\s|$)/u.test(text)) {
        line = `${label} ${text}`.trim();
      } else if (label && !text) {
        line = label;
      }
    }
    if (line) chunks.push(line);
    if (hasPageBreak) chunks.push(PAGE_BREAK);
  }

  return chunks.join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function insertPageBreaks(xml) {
  return String(xml || "")
    .replace(/<w:lastRenderedPageBreak\b[^>]*\/?>/giu, PAGE_BREAK)
    .replace(/<w:br\b[^>]*w:type=["']page["'][^>]*\/?>/giu, PAGE_BREAK)
    .replace(/<w:tab\b[^>]*\/?>/giu, "\t")
    .replace(/<w:br\b[^>]*\/?>/giu, "\n")
    .replace(/<\/w:p>/giu, "\n");
}

function stripXmlTags(xml) {
  return String(xml || "").replace(/<[^>]+>/gu, "");
}

function extractRunText(inner) {
  const parts = [];
  const pattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/giu;
  let match;
  while ((match = pattern.exec(inner))) {
    parts.push(match[1]);
  }
  if (parts.length) return parts.join("");
  return stripXmlTags(insertPageBreaks(inner)).replace(PAGE_BREAK, " ");
}

function parseNumPr(inner) {
  const block = String(inner || "").match(/<w:numPr\b[\s\S]*?<\/w:numPr>/iu)?.[0] || "";
  if (!block) return null;
  const numId = Number(block.match(/<w:numId\b[^>]*w:val=["'](\d+)["']/iu)?.[1]);
  const ilvl = Number(block.match(/<w:ilvl\b[^>]*w:val=["'](\d+)["']/iu)?.[1] || 0);
  if (!Number.isInteger(numId) || numId < 1) return null;
  return { numId, ilvl: Number.isInteger(ilvl) && ilvl >= 0 ? ilvl : 0 };
}

function parseWordStyles(xml) {
  const source = String(xml || "");
  if (!source.trim()) return new Map();
  const styles = new Map();
  const stylePattern = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/giu;
  let match;
  while ((match = stylePattern.exec(source))) {
    const attrs = match[1];
    const type = attrs.match(/\bw:type=["']([^"']+)["']/iu)?.[1] || "paragraph";
    const styleId = attrs.match(/\bw:styleId=["']([^"']+)["']/iu)?.[1];
    if (!styleId || !/^paragraph$/i.test(type)) continue;
    styles.set(styleId, {
      numPr: parseNumPr(match[2]),
      basedOn: match[2].match(/<w:basedOn\b[^>]*w:val=["']([^"']+)["']/iu)?.[1] || null
    });
  }
  return styles;
}

function resolveNumPr(inner, styles) {
  const direct = parseNumPr(inner);
  if (direct) return direct;
  let styleId = String(inner || "").match(/<w:pStyle\b[^>]*w:val=["']([^"']+)["']/iu)?.[1];
  const seen = new Set();
  while (styleId && !seen.has(styleId)) {
    seen.add(styleId);
    const style = styles.get(styleId);
    if (!style) return null;
    if (style.numPr) return style.numPr;
    styleId = style.basedOn;
  }
  return null;
}

function parseWordNumbering(xml) {
  const source = String(xml || "");
  if (!source.trim()) return null;
  const abstracts = new Map();
  const abstractPattern = /<w:abstractNum\b[^>]*w:abstractNumId=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:abstractNum>/giu;
  let match;
  while ((match = abstractPattern.exec(source))) {
    const levels = new Map();
    const levelPattern = /<w:lvl\b[^>]*w:ilvl=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:lvl>/giu;
    let levelMatch;
    while ((levelMatch = levelPattern.exec(match[2]))) {
      const ilvl = Number(levelMatch[1]);
      const body = levelMatch[2];
      levels.set(ilvl, {
        start: Number(body.match(/<w:start\b[^>]*w:val=["'](\d+)["']/iu)?.[1] || 1) || 1,
        numFmt: String(body.match(/<w:numFmt\b[^>]*w:val=["']([^"']+)["']/iu)?.[1] || "decimal"),
        lvlText: decodeXmlEntities(String(body.match(/<w:lvlText\b[^>]*w:val=["']([^"']*)["']/iu)?.[1] || `%${ilvl + 1}.`))
      });
    }
    abstracts.set(Number(match[1]), levels);
  }
  const nums = new Map();
  const numPattern = /<w:num\b[^>]*w:numId=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:num>/giu;
  while ((match = numPattern.exec(source))) {
    const abstractId = Number(match[2].match(/<w:abstractNumId\b[^>]*w:val=["'](\d+)["']/iu)?.[1]);
    if (Number.isInteger(abstractId)) nums.set(Number(match[1]), abstractId);
  }
  if (!nums.size) return null;
  return { abstracts, nums };
}

function nextListLabel(numbering, countersByNum, numId, ilvl) {
  const abstractId = numbering.nums.get(Number(numId));
  const levels = numbering.abstracts.get(abstractId);
  if (!levels) return "";
  const level = levels.get(Number(ilvl));
  if (!level || /^(bullet|none)$/i.test(level.numFmt)) return "";
  const key = String(numId);
  const counters = countersByNum.get(key) || [];
  const depth = Number(ilvl);
  counters[depth] = (counters[depth] || (level.start - 1)) + 1;
  counters.length = depth + 1;
  countersByNum.set(key, counters);
  let label = level.lvlText || `%${depth + 1}.`;
  for (let index = 0; index <= depth; index += 1) {
    const formatted = formatListValue(counters[index] || 1, levels.get(index)?.numFmt || "decimal");
    label = label.replaceAll(`%${index + 1}`, formatted);
  }
  label = label.replace(/\s+/gu, " ").trim();
  if (/^\d{1,2}(?:\.\d{1,2}){0,4}$/u.test(label)) label = `${label}.`;
  return label;
}

function formatListValue(value, numFmt) {
  const n = Number(value) || 1;
  if (/^decimalZero/i.test(numFmt)) return String(n).padStart(2, "0");
  if (/letter|hebrew/i.test(numFmt)) return String(n);
  return String(n);
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
