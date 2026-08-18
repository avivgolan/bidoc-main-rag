import { parseContractExtractionRequest } from "./request.js";
import { runContractsClauseParser } from "./clauseParser.js";
import { runContractsClauseEnrichment } from "./clauseEnrichment.js";
import { decorateContractsClausePreview } from "./clausePresentation.js";

export const CONTRACTS_CLAUSE_PREVIEW_VERSION = "contracts-clause-preview.r3.1.v1";

export async function runContractsClausePreview({
  body,
  config,
  deadlineAt = Date.now() + 180_000,
  signal = null,
  parseRequest = parseContractExtractionRequest,
  parseClauses = runContractsClauseParser,
  enrichClauses = runContractsClauseEnrichment
} = {}) {
  const request = parseRequest(body);
  const generation = await parseClauses({
    pdfBytes: request.pdfBytes,
    deadlineAt,
    signal
  });
  const enrichment = await enrichClauses({
    generation,
    config,
    deadlineAt,
    signal
  });
  return projectContractsClausePreview({ request, generation, enrichment });
}

export function projectContractsClausePreview({ request, generation, enrichment } = {}) {
  const clauses = Array.isArray(enrichment?.clauses) ? enrichment.clauses : [];
  const coverageLedger = generation?.coverageLedger;
  const qualityLedger = enrichment?.qualityLedger;
  if (!request || !coverageLedger?.accepted || !qualityLedger?.accepted || clauses.length < 1) {
    throw new TypeError("Contracts clause preview requires accepted parser and enrichment results.");
  }

  const typeCounts = clauses.reduce((counts, clause) => {
    const type = String(clause.clauseType || "unknown");
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});

  return decorateContractsClausePreview({
    previewVersion: CONTRACTS_CLAUSE_PREVIEW_VERSION,
    mode: "dry_run",
    persisted: false,
    document: {
      filename: request.filename,
      mediaType: request.mediaType,
      documentVersionId: enrichment.documentVersionId,
      documentSha256: enrichment.documentSha256,
      pageCount: coverageLedger.pageCount
    },
    generations: {
      parserGenerationId: enrichment.parserGenerationId,
      enrichmentGenerationId: enrichment.enrichmentGenerationId,
      parserVersion: generation.parserVersion,
      enrichmentPolicyVersion: enrichment.enrichmentPolicyVersion,
      promptVersion: enrichment.promptVersion,
      modelVersion: enrichment.modelVersion
    },
    coverage: {
      accepted: true,
      sourceLineCount: coverageLedger.sourceLineCount,
      accountedSourceLineCount: coverageLedger.accountedSourceLineCount,
      numberedSourceCount: coverageLedger.numberedSourceCount,
      storedLogicalCount: coverageLedger.storedLogicalCount,
      clauseCount: coverageLedger.clauseCount,
      subclauseCount: coverageLedger.subclauseCount,
      appendixItemCount: coverageLedger.appendixItemCount,
      contextCount: coverageLedger.contextCount,
      crossPageCount: coverageLedger.crossPageCount,
      missingPageCount: coverageLedger.missingPages.length,
      duplicateKeyCount: coverageLedger.duplicateKeys.length,
      missingParentCount: coverageLedger.missingParents.length,
      unparsedNumberedLineCount: coverageLedger.unparsedNumberedLines.length,
      unaccountedLineCount: coverageLedger.unaccountedLines.length,
      errorCount: coverageLedger.errors.length
    },
    quality: {
      ...qualityLedger,
      typeCounts
    },
    clauses: clauses.map(projectClause),
    semanticDecisions: [],
    canonicalRelationships: []
  });
}

function projectClause(clause) {
  return {
    clauseKey: clause.clauseKey,
    parentClauseKey: clause.parentClauseKey,
    clauseType: clause.clauseType,
    clauseTitle: clause.clauseTitle,
    clauseOrder: clause.clauseOrder,
    pageStart: clause.pageStart,
    pageEnd: clause.pageEnd,
    rawText: clause.rawText,
    rawTextSha256: clause.rawTextSha256,
    summaryHe: clause.summaryHe,
    hashtags: [...clause.hashtags],
    crossReferences: clause.crossReferences.map((reference) => ({
      referenceText: reference.referenceText,
      targetClauseKey: reference.targetClauseKey,
      resolution: reference.resolution,
      origin: reference.origin
    })),
    content: clause.content,
    contentSha256: clause.contentSha256,
    processingStatus: clause.processingStatus
  };
}
