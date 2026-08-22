import { getConfig, initSettings, loadEnv } from "../src/config.js";
import { analyzeContractsDecisionAutoReview } from "../src/contracts/decisionAutoReview.js";
import { loadContractsDecisionReview } from "../src/contracts/decisionReview.js";

loadEnv();
await initSettings();

const workspaceId = process.argv.find((value) => /^[0-9a-f-]{36}$/iu.test(value));
if (!workspaceId) throw new Error("Pass one saved Contracts workspace UUID.");
const limitArgument = process.argv.find((value) => /^--limit=\d+$/u.test(value));
const limit = limitArgument ? Number(limitArgument.split("=")[1]) : null;
if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
  throw new Error("--limit must be an integer from 1 to 100.");
}

const config = getConfig();
if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
if (!config.contentSource?.supabaseUrl || !config.contentSource?.supabaseServiceRoleKey) {
  throw new Error("Server-side KAPAIM credentials are not configured.");
}

const review = await loadContractsDecisionReview({
  config,
  workspaceId,
  timeoutMs: 60_000
});
const auditedReview = limit === null ? review : {
  ...review,
  items: review.items.filter((item) => item.reviewStatus === "proposed").slice(0, limit),
  metrics: { ...review.metrics, proposedCount: Math.min(Number(review.metrics.proposedCount || 0), limit) }
};
const plan = await analyzeContractsDecisionAutoReview({
  decisionReview: auditedReview,
  config,
  deadlineAt: Date.now() + 300_000
});
const blockerCounts = {};
const verifierReasonCounts = {};
for (const candidate of plan.candidates) {
  for (const blocker of candidate.blockers) blockerCounts[blocker] = (blockerCounts[blocker] || 0) + 1;
  const reason = candidate.policyEvidence.verifierReasonCode;
  verifierReasonCounts[reason] = (verifierReasonCounts[reason] || 0) + 1;
}

console.log(JSON.stringify({
  workspaceId,
  requestedLimit: limit,
  policyVersion: plan.policyVersion,
  verifierModelVersion: plan.verifierModelVersion,
  minimumConfidence: plan.minimumConfidence,
  metrics: plan.metrics,
  blockerCounts,
  verifierReasonCounts,
  gates: plan.gates
}, null, 2));
