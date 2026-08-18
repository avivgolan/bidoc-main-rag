import assert from "node:assert/strict";
import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { loadContractsScheduleProjectionPreview } from "../src/contracts/scheduleProjection.js";

const workspaceId = String(process.argv[2] || "").trim();
const includeDetails = process.argv.includes("--details");

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(workspaceId)) {
  console.error("Usage: node scripts/audit-contracts-schedule-r5-live.mjs <workspace-uuid> [--details]");
  process.exit(2);
}

loadEnv();
await initSettings();

const result = await loadContractsScheduleProjectionPreview({
  config: getConfig(),
  workspaceId,
  env: process.env,
  timeoutMs: 60_000
});

assert.equal(result.mode, "shadow_read_only");
assert.equal(result.operationalWritesPerformed, false);
assert.equal(result.metrics.modelCallCount, 0);
assert.equal(result.metrics.scheduleWriteCount, 0);
assert.equal(result.metrics.activityMappingWriteCount, 0);
assert.equal(result.metrics.contractTruthWriteCount, 0);
assert.equal(result.metrics.runtimeDueDateWriteCount, 0);

const scheduleRelated = result.items.filter((item) => item.scheduleImpact === "yes");
const withoutTarget = scheduleRelated.filter((item) => !item.targetTable);
const byTemporalKind = Object.fromEntries(
  [...new Set(withoutTarget.map((item) => item.temporalKind))]
    .sort()
    .map((kind) => [kind, withoutTarget.filter((item) => item.temporalKind === kind).length])
);
const byReviewStatus = Object.fromEntries(
  [...new Set(withoutTarget.map((item) => item.reviewStatus))]
    .sort()
    .map((status) => [status, withoutTarget.filter((item) => item.reviewStatus === status).length])
);
const byDisposition = Object.fromEntries(
  [...new Set(withoutTarget.map((item) => item.scheduleAudit?.disposition || "unknown"))]
    .sort()
    .map((disposition) => [disposition, withoutTarget.filter((item) => (item.scheduleAudit?.disposition || "unknown") === disposition).length])
);

const output = {
  result: "Contracts R5 live read-only Schedule audit passed",
  workspaceId: result.workspace.workspaceId,
  mode: result.mode,
  migrationAvailable: result.decisionSource.migrationAvailable,
  projectMappingAvailable: result.projectMapping.available,
  metrics: result.metrics,
  scheduleRelatedAudit: {
    total: scheduleRelated.length,
    targetShaped: scheduleRelated.length - withoutTarget.length,
    withoutTarget: withoutTarget.length,
    byTemporalKind,
    byReviewStatus,
    byDisposition
  },
  zeroWriteProof: {
    modelCalls: result.metrics.modelCallCount,
    scheduleWrites: result.metrics.scheduleWriteCount,
    activityMappingWrites: result.metrics.activityMappingWriteCount,
    contractTruthWrites: result.metrics.contractTruthWriteCount,
    runtimeDueDateWrites: result.metrics.runtimeDueDateWriteCount
  },
  ...(includeDetails ? {
    withoutTarget: withoutTarget.map((item) => ({
      decisionId: item.decisionId,
      decisionKey: item.decisionKey,
      titleHe: item.titleHe,
      summaryHe: item.summaryHe,
      reviewStatus: item.reviewStatus,
      conflictStatus: item.conflictStatus,
      scheduleImpact: item.scheduleImpact,
      temporalKind: item.temporalKind,
      scheduleAudit: item.scheduleAudit,
      blockerCodes: item.blockerCodes
    }))
  } : {})
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
