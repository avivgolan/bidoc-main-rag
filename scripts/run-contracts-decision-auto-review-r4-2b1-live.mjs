import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { autoReviewContractsDecisions } from "../src/contracts/decisionAutoReview.js";

loadEnv();
await initSettings();

const workspaceId = String(process.argv[2] || "").trim();
const reviewerId = String(process.argv[3] || "").trim();
if (!workspaceId || !reviewerId) {
  throw new Error("Usage: node scripts/run-contracts-decision-auto-review-r4-2b1-live.mjs <workspace-id> <reviewer-id>");
}

const result = await autoReviewContractsDecisions({
  config: getConfig(),
  workspaceId,
  reviewerId,
  body: {},
  deadlineAt: Date.now() + 300_000
});

const summary = {
  workspaceId,
  agentVersion: result.agentVersion,
  policyVersion: result.policyVersion,
  verifierModelVersion: result.plan?.verifierModelVersion || null,
  minimumConfidence: result.plan?.minimumConfidence || null,
  audit: result.plan?.metrics || null,
  applied: result.autoReview,
  reviewMetrics: result.review?.metrics || null,
  gates: result.gates
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
