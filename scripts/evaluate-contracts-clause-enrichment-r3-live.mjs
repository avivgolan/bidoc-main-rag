import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, getConfig } from "../src/config.js";
import { chatCompletion, summarizeOpenRouterUsage } from "../src/openrouter.js";
import { runContractsClauseParser } from "../src/contracts/clauseParser.js";
import {
  CONTRACTS_CONTROLLED_TAGS,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";

const APPROVED_DOCUMENT_SHA256 = "0ff80eb28a157e748c02676b3c3897ea1fbbb1ad429f12e8aece0ef062629dda";
const args = parseArgs(process.argv.slice(2));

if (!args.pdf) {
  console.error("Usage: npm.cmd run contracts:r3-live -- --pdf <approved.pdf>");
  process.exit(2);
}

loadEnv();
const config = getConfig();
if (!config.openRouterApiKey) {
  console.error("OPENROUTER_API_KEY is unavailable after loading .env and .env.local.");
  process.exit(2);
}

const pdfPath = path.resolve(args.pdf);
const pdfBytes = fs.readFileSync(pdfPath);
const telemetry = [];
const startedAt = Date.now();
const deadlineAt = startedAt + 180_000;
const controller = new AbortController();
const abortTimer = setTimeout(
  () => controller.abort(new Error("R3 live semantic-quality run reached its 180-second total deadline.")),
  180_000
);

try {
  const generation = await runContractsClauseParser({
    pdfBytes,
    expectedDocumentVersionId: `sha256:${APPROVED_DOCUMENT_SHA256}`,
    deadlineAt,
    signal: controller.signal
  });
  assert.equal(generation.coverageLedger.accepted, true);
  assert.equal(generation.coverageLedger.pageCount, 18);
  assert.equal(generation.clauses.length, 189);

  const enrichment = await runContractsClauseEnrichment({
    generation,
    config,
    deadlineAt,
    signal: controller.signal,
    chatComplete: (request) => chatCompletion({
      ...request,
      telemetry: {
        ...request.telemetry,
        record: (entry) => telemetry.push(entry)
      }
    })
  });

  assert.equal(enrichment.qualityLedger.accepted, true);
  assert.equal(enrichment.qualityLedger.clauseCount, 189);
  assert.equal(enrichment.qualityLedger.summarizedClauseCount, 189);
  assert.equal(enrichment.qualityLedger.taggedClauseCount, 189);
  assert.equal(enrichment.qualityLedger.sourceHashMatchCount, 189);
  assert.deepEqual(enrichment.semanticDecisions, []);
  assert.deepEqual(enrichment.canonicalRelationships, []);

  const usage = summarizeOpenRouterUsage(telemetry);
  const tagCounts = countTags(enrichment.clauses);
  const duplicateSummaryGroups = duplicateSummaries(enrichment.clauses);
  const samples = selectReviewSamples(enrichment.clauses).map((clause) => ({
    clauseKey: clause.clauseKey,
    recordType: clause.recordType,
    pages: [clause.pageStart, clause.pageEnd],
    sourceExcerpt: compact(clause.rawText, 420),
    summaryHe: clause.summaryHe,
    tags: clause.hashtags,
    references: clause.crossReferences.map((reference) => ({
      target: reference.targetClauseKey,
      resolution: reference.resolution,
      text: reference.referenceText
    }))
  }));

  process.stdout.write(`${JSON.stringify({
    result: "Contracts R3 live semantic-quality run passed automatic gates",
    remoteDatabaseWrites: 0,
    documentSha256: enrichment.documentSha256,
    parserGenerationId: enrichment.parserGenerationId,
    enrichmentGenerationId: enrichment.enrichmentGenerationId,
    model: enrichment.modelVersion,
    durationMs: Date.now() - startedAt,
    qualityLedger: enrichment.qualityLedger,
    outputQuality: {
      controlledTagVocabularySize: CONTRACTS_CONTROLLED_TAGS.length,
      observedTagCounts: tagCounts,
      duplicateSummaryGroups,
      reviewSampleCount: samples.length
    },
    openRouterUsage: usage.totals,
    reviewSamples: samples
  }, null, 2)}\n`);
} finally {
  clearTimeout(abortTimer);
}

function countTags(clauses) {
  const counts = new Map();
  for (const clause of clauses) {
    for (const tag of clause.hashtags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function duplicateSummaries(clauses) {
  const bySummary = new Map();
  for (const clause of clauses) {
    const key = clause.summaryHe.trim();
    const keys = bySummary.get(key) || [];
    keys.push(clause.clauseKey);
    bySummary.set(key, keys);
  }
  return [...bySummary.entries()]
    .filter(([, keys]) => keys.length > 1)
    .map(([summaryHe, clauseKeys]) => ({ summaryHe, clauseKeys }))
    .slice(0, 20);
}

function selectReviewSamples(clauses) {
  const selected = new Map();
  const indexes = [0, 1, 2, 10, 25, 50, 75, 100, 125, 150, 175, clauses.length - 1];
  for (const index of indexes) {
    const clause = clauses[index];
    if (clause) selected.set(clause.clauseKey, clause);
  }
  for (const clause of clauses) {
    if (clause.crossReferences.length) selected.set(clause.clauseKey, clause);
    if (selected.size >= 18) break;
  }
  const unresolved = clauses.find((clause) => clause.crossReferences.some((reference) => reference.resolution === "unresolved"));
  if (unresolved) selected.set(unresolved.clauseKey, unresolved);
  return [...selected.values()];
}

function compact(value, limit) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--pdf") parsed.pdf = values[++index];
  }
  return parsed;
}
