import assert from "node:assert/strict";
import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { chatCompletion } from "../src/openrouter.js";
import { getSavedContractsClauseWorkspace } from "../src/contracts/clausePersistence.js";
import { loadContractsRelationshipReview } from "../src/contracts/semanticRelationshipReview.js";
import { runContractsDecisionNormalization } from "../src/contracts/decisionNormalization.js";

const workspaceId = String(process.argv[2] || "").trim();
if (!/^[0-9a-f-]{36}$/iu.test(workspaceId)) {
  console.error("Usage: node scripts/evaluate-contracts-decisions-r4-2b-live.mjs <saved-clause-workspace-uuid>");
  process.exit(2);
}

loadEnv();
await initSettings();
const config = getConfig();
if (!config.openRouterApiKey) {
  console.error("OPENROUTER_API_KEY is unavailable after loading server settings and local environment files.");
  process.exit(2);
}

const startedAt = Date.now();
const deadlineAt = startedAt + 300_000;
const controller = new AbortController();
const abortTimer = setTimeout(
  () => controller.abort(new Error("R4.2B live no-write check reached its 300-second total deadline.")),
  300_000
);
const telemetry = [];
const chatComplete = (request) => {
  const upstreamRecord = request.telemetry?.record;
  return chatCompletion({
    ...request,
    telemetry: {
      ...request.telemetry,
      record(entry) {
        upstreamRecord?.(entry);
        telemetry.push({
          step: entry.step,
          batch: request.telemetry?.batch || null,
          attempt: request.telemetry?.attempt || null,
          status: entry.status,
          completionTokens: entry.completion_tokens,
          finishReason: entry.finish_reason,
          nativeFinishReason: entry.native_finish_reason,
          durationMs: entry.duration_ms
        });
      }
    }
  });
};

try {
  const [saved, relationshipReview] = await Promise.all([
    getSavedContractsClauseWorkspace({ config, workspaceId, timeoutMs: 60_000 }),
    loadContractsRelationshipReview({ config, workspaceId, timeoutMs: 60_000 })
  ]);
  const result = await runContractsDecisionNormalization({
    preview: saved.preview,
    relationshipReview,
    config,
    chatComplete,
    deadlineAt,
    signal: controller.signal
  });

  assert.equal(result.metrics.normalizationComplete, true);
  assert.equal(result.metrics.persistenceWriteCount, 0);
  assert.equal(result.metrics.scheduleWriteCount, 0);
  assert.equal(result.gates.decisionPersistenceEnabled, false);
  assert.equal(result.gates.scheduleWritesEnabled, false);
  process.stdout.write(`${JSON.stringify({
    result: "Contracts R4.2B live no-write normalization passed",
    workspaceId,
    modelVersion: result.modelVersion,
    durationMs: Date.now() - startedAt,
    metrics: result.metrics,
    telemetry
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    result: "Contracts R4.2B live no-write normalization failed",
    workspaceId,
    durationMs: Date.now() - startedAt,
    error: {
      code: error?.code || null,
      status: error?.status || null,
      message: error?.message || String(error),
      causeCode: error?.cause?.code || null,
      causeMessage: error?.cause?.message || null
    },
    telemetry
  }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(abortTimer);
}
