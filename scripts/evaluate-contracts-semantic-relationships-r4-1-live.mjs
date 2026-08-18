import assert from "node:assert/strict";
import { getConfig, loadEnv } from "../src/config.js";
import { previewContractsSemanticRelationships } from "../src/contracts/semanticRelationshipService.js";
import { getSavedContractsClauseWorkspace } from "../src/contracts/clausePersistence.js";

const workspaceId = String(process.argv[2] || "").trim();
const summaryOnly = process.argv.includes("--summary");
const clausesOnly = process.argv.includes("--clauses-only");
const requestedClauseKeys = process.argv
  .filter((argument) => argument.startsWith("--clause="))
  .map((argument) => argument.slice("--clause=".length))
  .filter(Boolean);
if (!/^[0-9a-f-]{36}$/iu.test(workspaceId)) {
  console.error("Usage: node scripts/evaluate-contracts-semantic-relationships-r4-1-live.mjs <saved-clause-workspace-uuid>");
  process.exit(2);
}

loadEnv();
const config = getConfig();
if (!config.openRouterApiKey) {
  console.error("OPENROUTER_API_KEY is unavailable after loading .env and .env.local.");
  process.exit(2);
}

if (clausesOnly) {
  const saved = await getSavedContractsClauseWorkspace({ config, workspaceId });
  process.stdout.write(`${JSON.stringify({
    workspaceId: saved.workspace.workspaceId,
    clauses: requestedClauseKeys.map((clauseKey) => {
      const clause = saved.preview.clauses.find((item) => item.clauseKey === clauseKey);
      return { clauseKey, rawText: clause?.rawText || null };
    })
  }, null, 2)}\n`);
  process.exit(0);
}

const startedAt = Date.now();
const deadlineAt = startedAt + 180_000;
const controller = new AbortController();
const abortTimer = setTimeout(
  () => controller.abort(new Error("R4.1 live quality check reached its 180-second total deadline.")),
  180_000
);

try {
  const result = await previewContractsSemanticRelationships({
    config,
    workspaceId,
    body: {},
    env: process.env,
    deadlineAt,
    signal: controller.signal
  });

  assert.equal(result.metrics.decisionCount, 0);
  assert.equal(result.metrics.persistenceWriteCount, 0);
  assert.equal(result.metrics.scheduleWriteCount, 0);
  assert.equal(result.gates.relationshipPersistenceEnabled, false);
  assert.equal(result.gates.decisionCreationEnabled, false);
  assert.equal(result.gates.conflictResolutionEnabled, false);
  assert.equal(result.gates.scheduleWritesEnabled, false);

  const visibleProposals = summaryOnly
    ? result.proposals.filter((proposal) => proposal.relationshipType === "conflicts_with")
    : result.proposals;
  process.stdout.write(`${JSON.stringify({
    result: "Contracts R4.1 live semantic-preview automatic boundaries passed",
    workspaceId: result.workspace.workspaceId,
    documentVersionId: result.workspace.documentVersionId,
    parserGenerationId: result.workspace.parserGenerationId,
    modelVersion: result.modelVersion,
    durationMs: Date.now() - startedAt,
    metrics: result.metrics,
    gates: result.gates,
    proposalTypeCounts: Object.fromEntries(Object.entries(Object.groupBy(
      result.proposals,
      (proposal) => proposal.relationshipType
    )).map(([type, proposals]) => [type, proposals.length])),
    proposals: visibleProposals.map((proposal) => ({
      sourceClauseKey: proposal.sourceClauseKey,
      targetClauseKey: proposal.targetClauseKey,
      relationshipType: proposal.relationshipType,
      relationshipTypeLabelHe: proposal.relationshipTypeLabelHe,
      confidence: proposal.confidence,
      rationaleHe: proposal.rationaleHe,
      reviewStatusLabelHe: proposal.reviewStatusLabelHe
    }))
  }, null, 2)}\n`);
} finally {
  clearTimeout(abortTimer);
}
