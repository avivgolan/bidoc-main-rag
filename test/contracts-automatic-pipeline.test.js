import test from "node:test";
import assert from "node:assert/strict";
import { runContractsAutomaticStep } from "../src/contracts/automaticPipeline.js";
import { runContractsAutomaticSequence, readContractsAutomaticCheckpoint } from "../src/react/contractsAutomaticRun.js";
import { reviewAutomaticRelationshipBatch } from "../src/contracts/automaticRelationshipReview.js";
import { AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX, CONTRACTS_AUTOMATIC_PIPELINE_VERSION as version, CONTRACTS_AUTOMATIC_STEPS } from "../src/contracts/automaticPipelinePolicy.js";
import { buildContractsDecisionCandidates } from "../src/contracts/decisionNormalization.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const reviewerId = "22222222-2222-4222-8222-222222222222";
const config = { openRouterApiKey: "fixture-never-sent", models: { main: "fixture-model" } };
const base = { workspaceId, reviewerId, config };

function fixtureServices() {
  let relationships = [];
  let decisions = [];
  const writes = [];
  const relationshipProjection = () => ({ items: structuredClone(relationships), metrics: { proposedCount: relationships.filter((item) => item.reviewStatus === "proposed").length } });
  const decisionProjection = () => ({ items: structuredClone(decisions), metrics: {
    currentDecisionCount: decisions.length, proposedCount: decisions.filter((item) => item.reviewStatus === "proposed").length,
    pendingRelationshipCount: relationshipProjection().metrics.proposedCount
  } });
  const services = {
    persistContractsExplicitRelationships: async () => ({ items: [] }),
    loadContractsRelationshipReview: async () => relationshipProjection(),
    loadContractsDecisionReview: async () => decisionProjection(),
    previewContractsSemanticRelationships: async () => ({ marker: "semantic-result" }),
    persistContractsSemanticRelationshipProposals: async ({ semanticResult }) => {
      assert.equal(semanticResult.marker, "semantic-result");
      relationships = [{ relationshipId: "relationship-1", revision: 1, origin: "model", reviewStatus: "proposed" }];
      return relationshipProjection();
    },
    autoReviewContractsSemanticRelationships: async () => ({ review: relationshipProjection() }),
    reviewAutomaticRelationshipBatch: async ({ items }) => items.map((item) => ({
      ...item, expectedRevision: item.revision, action: "reject", unresolved: true,
      reasonHe: `${AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX} הקשר לא הוכרע על סמך המקורות.`
    })),
    reviewContractsSemanticRelationship: async ({ relationshipId, body }) => {
      const item = relationships.find((row) => row.relationshipId === relationshipId);
      assert.equal(body.expectedRevision, item.revision);
      item.reviewStatus = "rejected"; item.reviewReason = body.reasonHe; item.revision++;
    },
    generateAndPersistContractsDecisions: async () => {
      assert.equal(relationshipProjection().metrics.proposedCount, 0);
      if (!decisions.length) decisions = Array.from({ length: 7 }, (_, index) => ({ decisionId: `decision-${index}`, revision: 1, reviewStatus: "proposed" }));
      return { review: decisionProjection() };
    },
    autoReviewContractsDecisions: async () => {
      decisions[0].reviewStatus = "approved";
      return { review: decisionProjection(), plan: { metrics: { failedBatchCount: 0 } }, autoReview: { approvedCount: 1 } };
    },
    reviewContractsDecision: async ({ decisionId, body }) => {
      const item = decisions.find((row) => row.decisionId === decisionId);
      assert.equal(body.action, "unresolved");
      assert.equal(body.expectedRevision, item.revision);
      item.reviewStatus = "unresolved"; item.revision++;
    },
    loadContractsIndicatorHandoff: async () => {
      assert.equal(decisionProjection().metrics.proposedCount, 0);
      return { items: decisions.map((item) => ({ ...item, handoffStatus: item.reviewStatus === "approved" ? "suitable" : "requires_review" })) };
    },
    reconcileContractConditions: async ({ commit }) => {
      assert.equal(commit, true);
      writes.push(decisions.filter((item) => item.reviewStatus === "approved").map((item) => item.decisionId));
      return { ok: true, committed: true, eligible: 1 };
    },
    getSavedContractsClauseWorkspace: async () => ({ workspace: { sourceProjectId: "server-owned-project" } }),
    runScheduleSweep: async ({ projectId, persist }) => {
      assert.equal(projectId, "server-owned-project"); assert.equal(persist, true);
      return { indicators: [], contractConditionSync: { ok: true }, conditionResolution: { ok: true, summary: { not_found: 1, error: 0 } } };
    }
  };
  return { services, writes, decisionProjection };
}

test("upload continuation completes every stage, batches unresolved findings, and hands off only approved decisions", async () => {
  const { services, writes, decisionProjection } = fixtureServices();
  const stages = []; const checkpoints = []; let final;
  const completed = await runContractsAutomaticSequence({
    workspaceId,
    request: async (path) => {
      const step = path.split("/").at(-1); stages.push(step);
      return runContractsAutomaticStep({ ...base, step, services });
    },
    saveCheckpoint: (value) => checkpoints.push(value),
    onProgress: (value) => { if (value.response) final = value.response; }
  });
  assert.equal(completed.completed, true);
  assert.deepEqual([...new Set(stages)], CONTRACTS_AUTOMATIC_STEPS);
  assert.equal(stages.filter((step) => step === "decision-findings").length, 2);
  assert.deepEqual(writes, [["decision-0"]]);
  assert.equal(decisionProjection().metrics.proposedCount, 0);
  assert.equal(final.unresolvedDecisions, 6);
  assert.equal(checkpoints.at(-1), null);
});

test("provider failure retries the saved stage and never skips ahead", async () => {
  const calls = []; const saved = []; let attempts = 0;
  await runContractsAutomaticSequence({
    workspaceId, nextStep: "schedule", saveCheckpoint: (value) => saved.push(value), delay: async () => {},
    request: async () => {
      calls.push("schedule");
      if (++attempts < 3) throw Object.assign(new Error("provider unavailable"), { status: 502 });
      return { version, workspaceId, step: "schedule", repeat: false, nextStep: null };
    }
  });
  assert.equal(calls.length, 3); assert.equal(saved[0].nextStep, "schedule"); assert.equal(saved.at(-1), null);
});

test("failed verifier batches still advance so findings can record unresolved decisions", async () => {
  const result = await runContractsAutomaticStep({ ...base, step: "decision-review", services: {
    autoReviewContractsDecisions: async () => ({
      review: { items: [], metrics: { proposedCount: 1 } },
      plan: { metrics: { failedBatchCount: 1 } },
      autoReview: { approvedCount: 0 }
    })
  } });
  assert.equal(result.nextStep, "decision-findings");
  assert.equal(result.failedVerifierBatches, 1);
});

test("incomplete reviews cannot trigger an operational handoff", async () => {
  await assert.rejects(runContractsAutomaticStep({ ...base, step: "indicator", services: {
    loadContractsDecisionReview: async () => ({ metrics: { proposedCount: 1, pendingRelationshipCount: 0 } })
  } }), (error) => error.code === "contracts_automatic_review_incomplete");
});

test("invalid model IDs, duplicate IDs, non-Hebrew reasons and truncation apply no approvals", async () => {
  const item = { relationshipId: "rel-1", revision: 2, evidence: { excerpts: [{ excerpt: "מקור ראשון" }, { excerpt: "מקור שני" }] } };
  for (const output of [
    { items: [{ relationshipId: "invented", verdict: "approve", confidence: 1, reasonHe: "הקשר נתמך באופן ברור במקורות." }] },
    { items: [{ relationshipId: "rel-1", verdict: "approve", confidence: 1, reasonHe: "unsupported English reason" }] },
    { items: [{ relationshipId: "rel-1", verdict: "approve", confidence: "1", reasonHe: "הקשר נתמך באופן ברור במקורות." }] }
  ]) {
    const [result] = await reviewAutomaticRelationshipBatch({ items: [item], config, chatComplete: async () => JSON.stringify(output) });
    assert.equal(result.unresolved, true);
    assert.equal(result.action, "reject");
  }
  const truncated = await reviewAutomaticRelationshipBatch({ items: [item], config, chatComplete: async ({ telemetry }) => {
    telemetry.record({ finish_reason: "length" }); return "{}";
  } });
  assert.equal(truncated[0].unresolved, true);
  const maxTokens = await reviewAutomaticRelationshipBatch({ items: [item], config, chatComplete: async ({ telemetry }) => {
    telemetry.record({ finish_reason: "stop", native_finish_reason: "MAX_TOKENS" });
    return JSON.stringify({ items: [{ relationshipId: "rel-1", verdict: "approve", confidence: 1, reasonHe: "הקשר נתמך באופן ברור במקורות." }] });
  } });
  assert.equal(maxTokens[0].unresolved, true);
  const duplicates = await reviewAutomaticRelationshipBatch({ items: [item, { ...item, relationshipId: "rel-2" }], config,
    chatComplete: async () => JSON.stringify({ items: [1, 2].map(() => ({
      relationshipId: "rel-1", verdict: "approve", confidence: 1, reasonHe: "הקשר נתמך באופן ברור במקורות."
    })) })
  });
  assert.equal(duplicates[0].unresolved, false);
  assert.equal(duplicates[1].unresolved, true);
});

test("complete high-confidence model verdicts preserve their IDs, revisions and audit reasons", async () => {
  const items = ["rel-1", "rel-2"].map((relationshipId) => ({
    relationshipId, revision: 7,
    evidence: { excerpts: [{ excerpt: "מקור ראשון" }, { excerpt: "מקור שני" }] }
  }));
  const results = await reviewAutomaticRelationshipBatch({ items, config, chatComplete: async () => JSON.stringify({
    items: items.map((item, index) => ({ relationshipId: item.relationshipId,
      verdict: index ? "reject" : "approve", confidence: 0.99, reasonHe: "הכרעת המודל נתמכת באופן ברור בשני המקורות."
    }))
  }) });
  assert.deepEqual(results.map((item) => item.action), ["approve", "reject"]);
  assert.ok(results.every((item) => item.expectedRevision === 7 && !item.unresolved && item.reasonHe.includes("fixture-model")));
});

test("uncertainty is retained as an unresolved finding, never automatic approval", async () => {
  const item = { relationshipId: "rel-1", revision: 2, evidence: { excerpts: [{ excerpt: "מקור ראשון" }, { excerpt: "מקור שני" }] } };
  const [result] = await reviewAutomaticRelationshipBatch({ items: [item], config, chatComplete: async () => JSON.stringify({ items: [{
    relationshipId: item.relationshipId, verdict: "approve", confidence: 0.8, reasonHe: "הקשר אפשרי אך אינו ודאי במקורות."
  }] }) });
  assert.equal(result.action, "reject"); assert.equal(result.unresolved, true);
  assert.ok(result.reasonHe.startsWith(AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX));
});

test("excluding an uncertain relationship preserves the block on both source clauses", () => {
  const candidates = buildContractsDecisionCandidates({
    preview: {
      document: { documentSha256: "a".repeat(64), documentVersionId: `sha256:${"a".repeat(64)}` },
      clauses: ["1", "2", "3"].map((key) => ({
        clauseKey: key, clauseType: "clause", clauseTitle: `הוראה ${key}`, structuralRole: "operative_clause",
        clauseOrder: Number(key), rawText: "הקבלן יבצע את העבודות בהתאם להסכם.", summaryHe: "הוראה חוזית לביצוע עבודות", hashtags: []
      }))
    },
    relationshipReview: { metrics: { proposedCount: 0 }, items: [{
      sourceClauseKey: "1", targetClauseKey: "2", relationshipType: "amends", reviewStatus: "rejected",
      reviewReason: `${AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX} הקשר לא הוכרע.`
    }] }
  });
  assert.equal(candidates.find((item) => item.primaryClauseKey === "1").hasUnresolvedRelationship, true);
  assert.equal(candidates.find((item) => item.primaryClauseKey === "2").hasUnresolvedRelationship, true);
  assert.equal(candidates.find((item) => item.primaryClauseKey === "3").hasUnresolvedRelationship, false);
});

test("cancellation retains the next checkpoint; malformed server responses cannot clear it", async () => {
  let saved; let cancel = false;
  const outcome = await runContractsAutomaticSequence({ workspaceId, nextStep: "indicator",
    saveCheckpoint: (value) => { saved = value; }, cancelled: () => cancel,
    request: async () => { cancel = true; return { version, workspaceId, step: "indicator", repeat: false, nextStep: "schedule" }; }
  });
  assert.equal(outcome.completed, false); assert.equal(saved.nextStep, "schedule");
  assert.equal(readContractsAutomaticCheckpoint({ getItem: () => JSON.stringify(saved) }).nextStep, "schedule");
  await assert.rejects(runContractsAutomaticSequence({ workspaceId, request: async () => ({ nextStep: null }),
    saveCheckpoint: (value) => { saved = value; }
  }), /invalid stage checkpoint/);
  assert.equal(saved.nextStep, "explicit");
});
