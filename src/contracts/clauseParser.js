import crypto from "node:crypto";
import {
  CONTRACTS_MAX_PAGES,
  CONTRACTS_MAX_TEXT_CHARACTERS,
  readContractPdf
} from "./pdfReader.js";
import { CONTRACTS_MAX_PDF_BYTES } from "./constants.js";
import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_CLAUSE_PARSER_AGENT_VERSION = "contracts-clause-parser.r2.v1";
export const CONTRACTS_CLAUSE_SCHEMA_VERSION = "contracts-clause-extraction.r2.v1";
export const CONTRACTS_CLAUSE_PARSER_VERSION = "contracts-clause-parser.r2.v1";
export const CONTRACTS_CLAUSE_PARSER_POLICY_VERSION = "contracts-clause-parser-policy.r2.v1";
export const CONTRACTS_CLAUSE_PARSER_PROMPT_VERSION = "not_applicable";

const DOCUMENT_VERSION_PATTERN = /^sha256:([0-9a-f]{64})$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const PARSER_GENERATION_PATTERN = /^parser-generation:sha256:[0-9a-f]{64}$/u;
const MAX_LINE_CHARACTERS = 20_000;
const MAX_CLAUSE_CHARACTERS = 100_000;
const MAX_RAW_SEGMENTS = 500;

const HEBREW_APPENDIX_KEYS = Object.freeze({
  "א": "a", "ב": "b", "ג": "c", "ד": "d", "ה": "e", "ו": "f", "ז": "g", "ח": "h",
  "ט": "i", "י": "j", "כ": "k", "ל": "l", "מ": "m", "נ": "n", "ס": "o", "ע": "p",
  "פ": "q", "צ": "r", "ק": "s", "ר": "t", "ש": "u", "ת": "v"
});

const REPEATED_PAGE_MARKERS = new Set(["סמל הקבלן"]);
const CONTEXT_BOUNDARIES = [
  /^ולראיה\s+באו\s+הצדדים\s+על\s+החתום/u,
  /^ולראיה\s+באתי\s+על\s+החתום/u,
  /^בכבוד\s+רב[,،]?$/u
];

export function createContractsClauseParserGeneration({
  parserVersion = CONTRACTS_CLAUSE_PARSER_VERSION,
  parserPolicyVersion = CONTRACTS_CLAUSE_PARSER_POLICY_VERSION,
  extractionSchemaVersion = CONTRACTS_CLAUSE_SCHEMA_VERSION
} = {}) {
  const generationInput = {
    extractionSchemaVersion: boundedVersion(extractionSchemaVersion, "extractionSchemaVersion"),
    parserPolicyVersion: boundedVersion(parserPolicyVersion, "parserPolicyVersion"),
    parserVersion: boundedVersion(parserVersion, "parserVersion")
  };
  const digest = sha256(canonicalJson(generationInput));
  return {
    ...generationInput,
    parserGenerationId: `parser-generation:sha256:${digest}`,
    generationFingerprintInput: generationInput
  };
}

export async function runContractsClauseParser({
  pdfBytes,
  parserVersion = CONTRACTS_CLAUSE_PARSER_VERSION,
  parserPolicyVersion = CONTRACTS_CLAUSE_PARSER_POLICY_VERSION,
  extractionSchemaVersion = CONTRACTS_CLAUSE_SCHEMA_VERSION,
  expectedParserGenerationId = null,
  expectedDocumentVersionId = null,
  deadlineAt = null,
  signal = null,
  readPdf = readContractPdf
} = {}) {
  const bytes = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes || []);
  if (!bytes.length || bytes.length > CONTRACTS_MAX_PDF_BYTES) {
    throw new ContractsAgentError(
      "contracts_clause_parser_pdf_size_invalid",
      `The Contracts clause parser requires a non-empty PDF of at most ${CONTRACTS_MAX_PDF_BYTES} bytes.`,
      413,
      { issueCodes: ["clause_parser.pdf_size_invalid"] }
    );
  }
  const documentSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const documentVersionId = `sha256:${documentSha256}`;
  if (expectedDocumentVersionId !== null
      && String(expectedDocumentVersionId).toLowerCase() !== documentVersionId) {
    throw new ContractsAgentError(
      "contracts_clause_parser_document_version_mismatch",
      "The supplied document version does not match the immutable PDF bytes.",
      409,
      { issueCodes: ["clause_parser.document_version_mismatch"] }
    );
  }
  const parsedPdf = await readPdf({ pdfBytes: bytes, deadlineAt, signal });
  const generation = buildContractsClauseGeneration({
    pages: parsedPdf.pages,
    documentVersionId,
    documentSha256,
    parserVersion,
    parserPolicyVersion,
    extractionSchemaVersion,
    expectedParserGenerationId
  });
  return {
    ...generation,
    pdfReaderVersion: parsedPdf.readerVersion,
    pageCount: parsedPdf.pageCount,
    unreadablePages: [...parsedPdf.unreadablePages]
  };
}

export function buildContractsClauseGeneration({
  pages,
  documentVersionId,
  documentSha256,
  parserVersion = CONTRACTS_CLAUSE_PARSER_VERSION,
  parserPolicyVersion = CONTRACTS_CLAUSE_PARSER_POLICY_VERSION,
  extractionSchemaVersion = CONTRACTS_CLAUSE_SCHEMA_VERSION,
  expectedParserGenerationId = null
} = {}) {
  const identity = normalizeDocumentIdentity(documentVersionId, documentSha256);
  const parser = createContractsClauseParserGeneration({
    parserVersion,
    parserPolicyVersion,
    extractionSchemaVersion
  });
  if (expectedParserGenerationId !== null
      && String(expectedParserGenerationId).toLowerCase() !== parser.parserGenerationId) {
    throw new ContractsAgentError(
      "contracts_clause_parser_generation_mismatch",
      "The supplied parser generation does not match the deterministic parser policy identity.",
      409,
      { issueCodes: ["clause_parser.generation_mismatch"] }
    );
  }

  const normalizedPages = normalizePages(pages);
  const state = createAssemblyState(normalizedPages);
  assembleLogicalRecords(state);
  const clauses = finalizeRecords(state.records, identity, parser);
  const coverageLedger = buildCoverageLedger(state, clauses);
  assertContractsClauseCoverage(coverageLedger);

  return {
    agentVersion: CONTRACTS_CLAUSE_PARSER_AGENT_VERSION,
    extractionSchemaVersion: parser.extractionSchemaVersion,
    parserVersion: parser.parserVersion,
    parserPolicyVersion: parser.parserPolicyVersion,
    parserGenerationId: parser.parserGenerationId,
    generationFingerprintInput: parser.generationFingerprintInput,
    documentVersionId: identity.documentVersionId,
    documentSha256: identity.documentSha256,
    clauses,
    coverageLedger,
    semanticDecisions: []
  };
}

export function assertContractsClauseCoverage(coverageLedger) {
  const errors = Array.isArray(coverageLedger?.errors) ? coverageLedger.errors : ["coverage.ledger_missing"];
  if (coverageLedger?.accepted === true && errors.length === 0) return coverageLedger;
  throw new ContractsAgentError(
    "contracts_clause_parser_coverage_failed",
    "The Contracts clause parser rejected the generation because deterministic coverage was incomplete.",
    422,
    { issueCodes: [...new Set(errors)].slice(0, 40) }
  );
}

export function buildContractsClauseWorkspacePayload({
  generation,
  sourceProjectId,
  scheduleProjectId = null,
  projectSite = null,
  filename,
  mediaType = "application/pdf",
  byteCount,
  storageBucket,
  storageObjectKey,
  createdBy,
  extractorVersion,
  promptVersion = CONTRACTS_CLAUSE_PARSER_PROMPT_VERSION,
  extractionVersion = CONTRACTS_CLAUSE_PARSER_AGENT_VERSION,
  enrichmentIdentity = null
} = {}) {
  assertGeneration(generation);
  return {
    sourceProjectId: requiredUuid(sourceProjectId, "sourceProjectId"),
    scheduleProjectId: nullableUuid(scheduleProjectId, "scheduleProjectId"),
    projectSite: nullableBoundedText(projectSite, 500, "projectSite"),
    documentVersionId: generation.documentVersionId,
    documentSha256: generation.documentSha256,
    filename: requiredBoundedText(filename, 255, "filename"),
    mediaType: mediaType === "application/pdf" ? mediaType : invalid("mediaType must be application/pdf."),
    byteCount: positiveInteger(byteCount, 3_000_000, "byteCount"),
    storageBucket: requiredBoundedText(storageBucket, 100, "storageBucket"),
    storageObjectKey: requiredBoundedText(storageObjectKey, 500, "storageObjectKey"),
    extractionSchemaVersion: generation.extractionSchemaVersion,
    extractionVersion: requiredBoundedText(extractionVersion, 200, "extractionVersion"),
    extraction: {
      parserPolicyVersion: generation.parserPolicyVersion,
      coverageLedger: generation.coverageLedger,
      ...(enrichmentIdentity && typeof enrichmentIdentity === "object" && !Array.isArray(enrichmentIdentity)
        ? { enrichmentIdentity: structuredClone(enrichmentIdentity) }
        : {})
    },
    createdBy: requiredUuid(createdBy, "createdBy"),
    parserGenerationId: generation.parserGenerationId,
    parserVersion: generation.parserVersion,
    promptVersion: requiredBoundedText(promptVersion, 200, "promptVersion"),
    extractorVersion: requiredBoundedText(extractorVersion, 200, "extractorVersion")
  };
}

export function buildContractsClausePayloads({
  generation,
  workspaceId,
  sourceProjectId,
  extractorVersion
} = {}) {
  assertGeneration(generation);
  const normalizedWorkspaceId = requiredUuid(workspaceId, "workspaceId");
  const normalizedSourceProjectId = requiredUuid(sourceProjectId, "sourceProjectId");
  const normalizedExtractorVersion = requiredBoundedText(extractorVersion, 200, "extractorVersion");
  return generation.clauses.map((clause) => ({
    workspaceId: normalizedWorkspaceId,
    sourceProjectId: normalizedSourceProjectId,
    documentVersionId: generation.documentVersionId,
    documentSha256: generation.documentSha256,
    parserGenerationId: generation.parserGenerationId,
    clauseKey: clause.clauseKey,
    parentClauseKey: clause.parentClauseKey,
    clauseType: clause.clauseType,
    clauseTitle: clause.clauseTitle,
    clauseOrder: clause.clauseOrder,
    pageStart: clause.pageStart,
    pageEnd: clause.pageEnd,
    rawText: clause.rawText,
    rawTextSha256: clause.rawTextSha256,
    rawData: clause.rawData,
    parserVersion: generation.parserVersion,
    extractorVersion: normalizedExtractorVersion
  }));
}

function createAssemblyState(pages) {
  const lines = pages.flatMap((page) => page.lines);
  return {
    pages,
    lines,
    records: [],
    exclusions: [],
    assigned: new Map(lines.map((line) => [line.id, 0])),
    current: null,
    appendixKey: null,
    contextCounters: new Map(),
    numberedSourceCount: 0,
    unparsedNumberedLines: []
  };
}

function assembleLogicalRecords(state) {
  for (const page of state.pages) {
    for (const line of page.lines) {
      if (REPEATED_PAGE_MARKERS.has(line.text)) {
        excludeLine(state, line, "repeated_page_marker");
        continue;
      }

      const appendix = parseAppendixHeading(line.text);
      if (appendix) {
        flushCurrent(state);
        state.appendixKey = appendix;
        state.current = createRecordBuilder({
          clauseKey: `appendix_${appendix}.heading`,
          clauseType: "document_context",
          clauseTitle: line.text,
          parentClauseKey: null,
          heading: true
        });
        addLine(state, line);
        flushCurrent(state);
        continue;
      }

      if (CONTEXT_BOUNDARIES.some((pattern) => pattern.test(line.text))) {
        flushCurrent(state);
        ensureContextBuilder(state);
        addLine(state, line);
        continue;
      }

      const marker = parseClauseMarker(line.text);
      if (marker) {
        flushCurrent(state);
        state.numberedSourceCount += 1;
        const appendixKey = state.appendixKey;
        const clauseKey = appendixKey ? `appendix_${appendixKey}.${marker.number}` : marker.number;
        const clauseType = appendixKey
          ? "appendix_item"
          : marker.number.includes(".") ? "subclause" : "clause";
        state.current = createRecordBuilder({
          clauseKey,
          clauseType,
          clauseTitle: clauseType === "clause" ? marker.remainder : null,
          parentClauseKey: appendixKey
            ? `appendix_${appendixKey}.heading`
            : parentClauseKey(marker.number),
          heading: false
        });
        addLine(state, line);
        continue;
      }

      if (looksLikeUnsupportedNumberedLine(line.text)) {
        state.unparsedNumberedLines.push({ page: line.pdfPage, line: line.lineNumber });
      }
      ensureContextBuilder(state);
      addLine(state, line);
    }
  }
  flushCurrent(state);
}

function createRecordBuilder({ clauseKey, clauseType, clauseTitle, parentClauseKey, heading }) {
  return {
    clauseKey,
    clauseType,
    clauseTitle,
    parentClauseKey,
    heading,
    lineRefs: []
  };
}

function ensureContextBuilder(state) {
  if (state.current) return;
  const scope = state.appendixKey ? `appendix_${state.appendixKey}` : "document";
  const next = (state.contextCounters.get(scope) || 0) + 1;
  state.contextCounters.set(scope, next);
  state.current = createRecordBuilder({
    clauseKey: `${scope}.context.${next}`,
    clauseType: "document_context",
    clauseTitle: null,
    parentClauseKey: state.appendixKey ? `appendix_${state.appendixKey}.heading` : null,
    heading: false
  });
}

function addLine(state, line) {
  state.current.lineRefs.push(line);
  state.assigned.set(line.id, (state.assigned.get(line.id) || 0) + 1);
}

function excludeLine(state, line, reason) {
  state.exclusions.push({ page: line.pdfPage, line: line.lineNumber, reason });
  state.assigned.set(line.id, (state.assigned.get(line.id) || 0) + 1);
}

function flushCurrent(state) {
  if (!state.current?.lineRefs.length) {
    state.current = null;
    return;
  }
  state.records.push(state.current);
  state.current = null;
}

function finalizeRecords(records, identity, parser) {
  return records.map((record, index) => {
    const segments = groupLinesByPage(record.lineRefs);
    const rawText = segments.map((segment) => segment.text).join("\n");
    if (rawText.length > MAX_CLAUSE_CHARACTERS || segments.length > MAX_RAW_SEGMENTS) {
      throw new ContractsAgentError(
        "contracts_clause_parser_clause_bound_exceeded",
        "A logical clause exceeds the bounded R2 source-preservation contract.",
        413,
        { issueCodes: ["clause_parser.clause_bound_exceeded"] }
      );
    }
    return {
      documentVersionId: identity.documentVersionId,
      documentSha256: identity.documentSha256,
      parserGenerationId: parser.parserGenerationId,
      clauseKey: record.clauseKey,
      parentClauseKey: record.parentClauseKey,
      clauseType: record.clauseType,
      clauseTitle: record.clauseTitle,
      clauseOrder: index + 1,
      pageStart: segments[0].page,
      pageEnd: segments.at(-1).page,
      rawText,
      rawTextSha256: sha256(rawText),
      rawData: {
        segments: segments.map((segment, segmentIndex) => ({
          page: segment.page,
          text: segment.text,
          ...(record.heading && segmentIndex === 0 ? { heading: record.clauseTitle } : {}),
          continuation: segmentIndex > 0
        })),
        pageLocators: segments.map((segment) => ({
          page: segment.page,
          lineStart: segment.lineStart,
          lineEnd: segment.lineEnd
        })),
        headings: record.heading ? [{ page: segments[0].page, text: record.clauseTitle }] : [],
        continuationDecisions: segments.slice(1).map((segment, segmentIndex) => ({
          fromPage: segments[segmentIndex].page,
          toPage: segment.page,
          rule: "no_numbered_boundary"
        }))
      },
      sourceLineIds: record.lineRefs.map((line) => line.id),
      crossReferences: []
    };
  });
}

function buildCoverageLedger(state, clauses) {
  const errors = [];
  const keyCounts = new Map();
  for (const clause of clauses) keyCounts.set(clause.clauseKey, (keyCounts.get(clause.clauseKey) || 0) + 1);
  const duplicateKeys = [...keyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key).sort();
  if (duplicateKeys.length) errors.push("coverage.duplicate_clause_key");

  const clauseKeys = new Set(clauses.map((clause) => clause.clauseKey));
  const missingParents = clauses
    .filter((clause) => clause.parentClauseKey && !clauseKeys.has(clause.parentClauseKey))
    .map((clause) => clause.clauseKey);
  if (missingParents.length) errors.push("coverage.parent_clause_missing");

  const unaccountedLines = [];
  const multiplyAccountedLines = [];
  for (const line of state.lines) {
    const count = state.assigned.get(line.id) || 0;
    if (count === 0) unaccountedLines.push(line.id);
    if (count > 1) multiplyAccountedLines.push(line.id);
  }
  if (unaccountedLines.length) errors.push("coverage.unaccounted_source_line");
  if (multiplyAccountedLines.length) errors.push("coverage.duplicate_source_line_assignment");
  if (state.unparsedNumberedLines.length) errors.push("coverage.unparsed_numbered_line");

  const numberedStoredCount = clauses.filter((clause) => clause.clauseType !== "document_context").length;
  if (numberedStoredCount !== state.numberedSourceCount) errors.push("coverage.numbered_count_mismatch");

  const invalidSpans = clauses.filter((clause) => clause.pageEnd < clause.pageStart);
  if (invalidSpans.length) errors.push("coverage.invalid_page_span");

  const pagesCovered = new Set();
  for (const clause of clauses) {
    for (const locator of clause.rawData.pageLocators) pagesCovered.add(locator.page);
  }
  for (const exclusion of state.exclusions) pagesCovered.add(exclusion.page);
  const missingPages = state.pages.map((page) => page.pdfPage).filter((page) => !pagesCovered.has(page));
  if (missingPages.length) errors.push("coverage.page_uncovered");

  return {
    ledgerVersion: "contracts-clause-coverage.r2.v1",
    accepted: errors.length === 0,
    pageCount: state.pages.length,
    pagesCovered: [...pagesCovered].sort((a, b) => a - b),
    missingPages,
    sourceLineCount: state.lines.length,
    accountedSourceLineCount: state.lines.length - unaccountedLines.length,
    numberedSourceCount: state.numberedSourceCount,
    storedLogicalCount: clauses.length,
    clauseCount: clauses.filter((clause) => clause.clauseType === "clause").length,
    subclauseCount: clauses.filter((clause) => clause.clauseType === "subclause").length,
    appendixItemCount: clauses.filter((clause) => clause.clauseType === "appendix_item").length,
    contextCount: clauses.filter((clause) => clause.clauseType === "document_context").length,
    crossPageCount: clauses.filter((clause) =>
      clause.clauseType !== "document_context" && clause.pageEnd > clause.pageStart
    ).length,
    duplicateKeys,
    missingParents,
    unparsedNumberedLines: state.unparsedNumberedLines,
    unaccountedLines,
    multiplyAccountedLines,
    exclusions: state.exclusions,
    errors
  };
}

function normalizePages(pages) {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > CONTRACTS_MAX_PAGES) {
    throw new ContractsAgentError(
      "contracts_clause_parser_pages_invalid",
      `The Contracts clause parser requires between 1 and ${CONTRACTS_MAX_PAGES} ordered pages.`,
      422,
      { issueCodes: ["clause_parser.page_count_invalid"] }
    );
  }
  const normalized = pages.map((page) => ({
    pdfPage: Number(page?.pdfPage),
    text: String(page?.text || "").normalize("NFC")
  })).sort((a, b) => a.pdfPage - b.pdfPage);
  let totalCharacters = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const page = normalized[index];
    if (!Number.isInteger(page.pdfPage) || page.pdfPage !== index + 1) {
      throw new ContractsAgentError(
        "contracts_clause_parser_page_gap",
        "The Contracts clause parser rejected a missing, duplicate, or out-of-order PDF page.",
        422,
        { issueCodes: ["clause_parser.page_gap"] }
      );
    }
    if (!page.text.trim()) {
      throw new ContractsAgentError(
        "contracts_clause_parser_page_text_missing",
        `The Contracts clause parser cannot account for PDF page ${page.pdfPage} because its text is empty.`,
        422,
        { issueCodes: ["clause_parser.page_text_missing"] }
      );
    }
    totalCharacters += page.text.length;
    if (totalCharacters > CONTRACTS_MAX_TEXT_CHARACTERS) {
      throw new ContractsAgentError(
        "contracts_clause_parser_text_limit",
        "The Contracts clause parser input exceeds the bounded PDF text limit.",
        413,
        { issueCodes: ["clause_parser.text_limit"] }
      );
    }
    page.lines = page.text.split(/\r?\n/u)
      .map((text, lineIndex) => ({
        id: `p${String(page.pdfPage).padStart(3, "0")}:l${String(lineIndex + 1).padStart(4, "0")}`,
        pdfPage: page.pdfPage,
        lineNumber: lineIndex + 1,
        text: text.trim()
      }))
      .filter((line) => line.text);
    if (page.lines.some((line) => line.text.length > MAX_LINE_CHARACTERS)) {
      throw new ContractsAgentError(
        "contracts_clause_parser_line_limit",
        `The Contracts clause parser found an oversized source line on PDF page ${page.pdfPage}.`,
        413,
        { issueCodes: ["clause_parser.line_limit"] }
      );
    }
  }
  return normalized;
}

function groupLinesByPage(lines) {
  const segments = [];
  for (const line of lines) {
    const current = segments.at(-1);
    if (!current || current.page !== line.pdfPage) {
      segments.push({
        page: line.pdfPage,
        lineStart: line.lineNumber,
        lineEnd: line.lineNumber,
        lines: [line.text]
      });
    } else {
      current.lineEnd = line.lineNumber;
      current.lines.push(line.text);
    }
  }
  return segments.map((segment) => ({ ...segment, text: segment.lines.join("\n") }));
}

function parseAppendixHeading(value) {
  const text = String(value || "").trim();
  if (/^\d/u.test(text)) return null;
  const leading = text.match(/^נספח\s+([א-תA-Za-z])(?:\s*['׳״"])?(?:\s|[-–—:]|$)/u);
  const reversed = text.length <= 160
    ? text.match(/(?:^|[-–—]\s*)([א-תA-Za-z])(?:\s*['׳״"])?\s+נספח(?:\s|$)/u)
    : null;
  const key = leading?.[1] || reversed?.[1];
  if (!key) return null;
  return HEBREW_APPENDIX_KEYS[key] || key.toLowerCase();
}

function parseClauseMarker(value) {
  const match = String(value || "").match(/^\s*(\d{1,2}(?:\.\d{1,2}){0,4})(?:\.|\))?\s+(\S.*)$/u);
  if (!match) return null;
  const parts = match[1].split(".").map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 1)) return null;
  if (/^(?:(?:לעיל|להלן)(?:\s|[,.;:])|(?:above|below)\b)/iu.test(match[2])) return null;
  return { number: parts.join("."), remainder: match[2].trim() };
}

function looksLikeUnsupportedNumberedLine(value) {
  return /^\s*\d{1,2}(?:\.\d{1,2}){0,4}(?!\.\d)[.)]\S/u.test(String(value || ""));
}

function parentClauseKey(number) {
  const parts = String(number).split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : null;
}

function normalizeDocumentIdentity(documentVersionId, documentSha256) {
  const version = String(documentVersionId || "").trim().toLowerCase();
  const sha = String(documentSha256 || "").trim().toLowerCase();
  const match = version.match(DOCUMENT_VERSION_PATTERN);
  if (!match || !SHA256_PATTERN.test(sha) || match[1] !== sha) {
    throw new ContractsAgentError(
      "contracts_clause_parser_document_identity_invalid",
      "The Contracts clause parser requires a matching lowercase SHA-256 document version and document hash.",
      400,
      { issueCodes: ["clause_parser.document_identity_invalid"] }
    );
  }
  return { documentVersionId: version, documentSha256: sha };
}

function assertGeneration(generation) {
  if (!generation || typeof generation !== "object"
      || !PARSER_GENERATION_PATTERN.test(String(generation.parserGenerationId || ""))
      || !Array.isArray(generation.clauses)
      || generation.coverageLedger?.accepted !== true
      || generation.semanticDecisions?.length !== 0) {
    throw new ContractsAgentError(
      "contracts_clause_parser_generation_invalid",
      "The Contracts clause generation is incomplete or contains prohibited semantic decisions.",
      400,
      { issueCodes: ["clause_parser.generation_invalid"] }
    );
  }
}

function boundedVersion(value, field) {
  return requiredBoundedText(value, 200, field);
}

function requiredBoundedText(value, maxLength, field) {
  const normalized = String(value || "").normalize("NFC").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    invalid(`${field} is invalid.`);
  }
  return normalized;
}

function nullableBoundedText(value, maxLength, field) {
  if (value === null || value === undefined || value === "") return null;
  return requiredBoundedText(value, maxLength, field);
}

function requiredUuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(normalized)) {
    invalid(`${field} must be a UUID.`);
  }
  return normalized;
}

function nullableUuid(value, field) {
  if (value === null || value === undefined || value === "") return null;
  return requiredUuid(value, field);
}

function positiveInteger(value, max, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) invalid(`${field} is invalid.`);
  return number;
}

function invalid(message) {
  throw new ContractsAgentError(
    "contracts_clause_parser_payload_invalid",
    message,
    400,
    { issueCodes: ["clause_parser.payload_invalid"] }
  );
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
