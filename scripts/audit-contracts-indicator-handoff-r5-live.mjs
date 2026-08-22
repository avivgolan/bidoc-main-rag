import assert from "node:assert/strict";
import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { loadContractsIndicatorHandoff } from "../src/contracts/indicatorHandoff.js";

const workspaceId = String(process.argv[2] || "").trim();
const includeDetails = process.argv.includes("--details");

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(workspaceId)) {
  console.error("Usage: node scripts/audit-contracts-indicator-handoff-r5-live.mjs <workspace-uuid> [--details]");
  process.exit(2);
}

loadEnv();
await initSettings();

const result = await loadContractsIndicatorHandoff({
  config: getConfig(),
  workspaceId,
  env: process.env,
  timeoutMs: 60_000
});

assert.equal(result.mode, "indicator_handoff_read_only");
assert.equal(result.operationalWritesPerformed, false);
assert.equal(result.metrics.currentDecisionCount, result.metrics.suitableCount
  + result.metrics.notSuitableCount
  + result.metrics.requiresReviewCount);
assert.equal(result.metrics.modelCallCount, 0);
assert.equal(result.metrics.contractTruthWriteCount, 0);
assert.equal(result.metrics.indicatorWriteCount, 0);
assert.equal(result.metrics.scheduleWriteCount, 0);
assert.equal(result.metrics.activityMappingWriteCount, 0);
assert.equal(result.metrics.runtimeDueDateWriteCount, 0);
assert.equal(result.items.some((item) => Object.hasOwn(item, "targetTable")), false);
assert.equal(result.items.some((item) => Object.hasOwn(item, "scheduleProjectId")), false);
assert.equal(result.items.some((item) => Object.hasOwn(item, "shadowRow")), false);
assert.equal(result.items.some((item) => Object.hasOwn(item, "scheduleImpact")), false);
assert.equal(result.items.some((item) => Object.hasOwn(item, "decisionCategory")), false);
assert.equal(result.items.some((item) => Object.hasOwn(item, "temporalKind")), false);
assert.equal(result.gates.productViewSource, true);
assert.equal(result.metrics.embeddingReadyCount, result.metrics.currentDecisionCount);

const output = {
  result: "Contracts R6 product-view Indicator handoff audit passed",
  workspaceId: result.workspace.workspaceId,
  mode: result.mode,
  metrics: result.metrics,
  gates: result.gates,
  zeroWriteProof: {
    modelCalls: result.metrics.modelCallCount,
    contractTruthWrites: result.metrics.contractTruthWriteCount,
    indicatorWrites: result.metrics.indicatorWriteCount,
    scheduleWrites: result.metrics.scheduleWriteCount,
    activityMappingWrites: result.metrics.activityMappingWriteCount,
    runtimeDueDateWrites: result.metrics.runtimeDueDateWriteCount
  },
  ...(includeDetails ? {
    suitableItems: result.suitableItems.map((item) => ({
      decisionId: item.decisionId,
      decisionKey: item.decisionKey,
      revision: item.revision,
      titleHe: item.titleHe,
      reviewStatus: item.reviewStatus,
      reviewStatusCode: item.reviewStatusCode,
      conflictStatus: item.conflictStatus,
      indicatorSuitability: item.indicatorSuitability,
      handoffStatus: item.handoffStatus,
      reasonCodes: item.reasonCodes
    })),
    requiresReviewItems: result.items.filter((item) => item.handoffStatus === "requires_review").map((item) => ({
      decisionId: item.decisionId,
      decisionKey: item.decisionKey,
      revision: item.revision,
      titleHe: item.titleHe,
      reviewStatus: item.reviewStatus,
      reviewStatusCode: item.reviewStatusCode,
      conflictStatus: item.conflictStatus,
      indicatorSuitability: item.indicatorSuitability,
      handoffStatus: item.handoffStatus,
      reasonCodes: item.reasonCodes
    }))
  } : {})
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
