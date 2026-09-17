import { ContractsAgentError } from "./errors.js";
import { getSavedContractsClauseWorkspace, parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import { persistContractsExplicitRelationships } from "./relationshipPersistence.js";
import { previewContractsSemanticRelationships } from "./semanticRelationshipService.js";
import { loadContractsRelationshipReview, persistContractsSemanticRelationshipProposals, reviewContractsSemanticRelationship } from "./semanticRelationshipReview.js";
import { autoReviewContractsSemanticRelationships } from "./semanticRelationshipAutoReview.js";
import { generateAndPersistContractsDecisions, loadContractsDecisionReview, reviewContractsDecision } from "./decisionReview.js";
import { autoReviewContractsDecisions } from "./decisionAutoReview.js";
import { loadContractsIndicatorHandoff } from "./indicatorHandoff.js";
import { promoteLabDecisionsToApp } from "./publicDecisionPromote.js";
import { reconcileContractConditions } from "../indicator/contractConditions.js";
import { runScheduleSweep } from "../subagents/schedule.js";
import { reviewAutomaticRelationshipBatch } from "./automaticRelationshipReview.js";
import { AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX, CONTRACTS_AUTOMATIC_PIPELINE_VERSION, CONTRACTS_AUTOMATIC_STEPS, unresolvedAutomaticRelationship } from "./automaticPipelinePolicy.js";

const SERVICES = {
  getSavedContractsClauseWorkspace, persistContractsExplicitRelationships,
  previewContractsSemanticRelationships, loadContractsRelationshipReview,
  persistContractsSemanticRelationshipProposals, reviewContractsSemanticRelationship,
  autoReviewContractsSemanticRelationships, generateAndPersistContractsDecisions,
  loadContractsDecisionReview, reviewContractsDecision, autoReviewContractsDecisions,
  loadContractsIndicatorHandoff, promoteLabDecisionsToApp, reconcileContractConditions,
  runScheduleSweep, reviewAutomaticRelationshipBatch
};

// Each bounded request completes one persisted stage (or one review batch).
// No model-supplied HTTP targets, project mappings, stage names or write payloads.
export async function runContractsAutomaticStep({
  workspaceId, step, reviewerId, config, body = {}, services = SERVICES
}) {
  const id = parseContractsClauseWorkspaceId(workspaceId);
  if (!CONTRACTS_AUTOMATIC_STEPS.includes(step) || !body || Array.isArray(body)
      || typeof body !== "object" || Object.keys(body).length) {
    throw new ContractsAgentError("contracts_automatic_step_invalid", "Automatic steps accept only a workspace and a supported stage, with an empty body.", 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(reviewerId || "")) {
    throw new ContractsAgentError("contracts_automatic_session_required", "An authenticated session is required.", 401);
  }
  const args = { workspaceId: id, reviewerId, config };
  const deadlineAt = Date.now() + 270_000;
  const result = (data = {}, repeat = false) => ({
    version: CONTRACTS_AUTOMATIC_PIPELINE_VERSION, workspaceId: id, step, repeat,
    nextStep: repeat ? step : CONTRACTS_AUTOMATIC_STEPS[CONTRACTS_AUTOMATIC_STEPS.indexOf(step) + 1] || null,
    ...data
  });

  if (step === "explicit") {
    return result({ relationships: await services.persistContractsExplicitRelationships(args) });
  }
  if (step === "semantic") {
    const [relationships, decisions] = await Promise.all([
      services.loadContractsRelationshipReview(args), services.loadContractsDecisionReview(args)
    ]);
    // Atomic semantic persistence and append-only decisions make response-loss retries safe.
    if (relationships.items.some((item) => item.origin === "model") || decisions.metrics.currentDecisionCount > 0) {
      return result({ relationshipReview: relationships, reused: true });
    }
    try {
      const analysis = await services.previewContractsSemanticRelationships({
        ...args,
        deadlineAt: Math.min(deadlineAt, Date.now() + 80_000)
      });
      const review = await services.persistContractsSemanticRelationshipProposals({ ...args, semanticResult: analysis });
      return result({ relationshipReview: review });
    } catch (error) {
      if (error?.code === "contracts_semantic_relationships_input_invalid") {
        return result({ relationshipReview: { items: [] }, skipped: "insufficient_clauses" });
      }
      if (
        error?.code === "contracts_relationship_review_analysis_incomplete"
        || error?.code === "contracts_semantic_relationships_time_budget_exceeded"
        || error?.code === "contracts_semantic_relationships_provider_failed"
      ) {
        return result({
          relationshipReview: await services.loadContractsRelationshipReview(args),
          skipped: "semantic_incomplete"
        });
      }
      throw error;
    }
  }
  if (step === "relationship-review") {
    const automatic = await services.autoReviewContractsSemanticRelationships(args);
    const pending = automatic.review.items.filter((item) => item.reviewStatus === "proposed").slice(0, 4);
    if (pending.length) {
      const verdicts = await services.reviewAutomaticRelationshipBatch({ items: pending, config });
      for (const verdict of verdicts) {
        await services.reviewContractsSemanticRelationship({
          ...args, relationshipId: verdict.relationshipId,
          body: { expectedRevision: verdict.expectedRevision, action: verdict.action, reasonHe: verdict.reasonHe }
        });
      }
    }
    const review = await services.loadContractsRelationshipReview(args);
    return result({
      relationshipReview: review,
      unresolvedRelationships: review.items.filter(unresolvedAutomaticRelationship).length
    }, review.items.some((item) => item.reviewStatus === "proposed"));
  }
  if (step === "decisions") {
    const pendingRelationships = (await services.loadContractsRelationshipReview(args)).items
      .filter((item) => item.reviewStatus === "proposed")
      .slice(0, 4);
    for (const item of pendingRelationships) {
      await services.reviewContractsSemanticRelationship({
        ...args,
        relationshipId: item.relationshipId,
        body: {
          expectedRevision: item.revision,
          action: "reject",
          reasonHe: `${AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX} הקשר נותר מוצע אחרי בדיקת המודל, ולכן נשמר כממצא לא פתור ואינו מאושר לתזמון.`
        }
      });
    }
    try {
      const generated = await services.generateAndPersistContractsDecisions({ ...args, deadlineAt });
      return result({ decisionReview: generated.review });
    } catch (error) {
      if (error?.code !== "contracts_decision_normalization_input_invalid") throw error;
      return result({ decisionReview: { items: [] }, skipped: "insufficient_clauses" });
    }
  }
  if (step === "decision-review") {
    try {
      const automatic = await services.autoReviewContractsDecisions({ ...args, deadlineAt });
      // Failed verifier batches stay proposed; decision-findings records them as unresolved
      // so File Classify can continue to Indicator instead of retrying the same stage forever.
      return result({
        decisionReview: automatic.review,
        approvedCount: automatic.autoReview?.approvedCount || 0,
        failedVerifierBatches: Number(automatic.plan?.metrics?.failedBatchCount || 0)
      });
    } catch (error) {
      if (error?.code !== "contracts_decision_auto_review_rpc_failed") throw error;
      return result({
        decisionReview: await services.loadContractsDecisionReview(args),
        approvedCount: 0,
        failedVerifierBatches: 1,
        skipped: "decision_auto_review_failed"
      });
    }
  }
  if (step === "decision-findings") {
    const current = await services.loadContractsDecisionReview(args);
    // Re-read persisted proposals. Never overwrite a concurrently reviewed revision.
    for (const item of current.items.filter((row) => row.reviewStatus === "proposed").slice(0, 4)) {
      await services.reviewContractsDecision({
        ...args, decisionId: item.decisionId,
        body: {
          expectedRevision: item.revision, action: "unresolved",
          reasonHe: `[${CONTRACTS_AUTOMATIC_PIPELINE_VERSION}:unresolved] הבדיקה האוטומטית לא אישרה את ההחלטה על סמך המקורות ובדיקות העקביות. נשמר ממצא לא פתור שאינו מועבר לתזמון; עיבוד יתר החוזה ממשיך ללא המתנה לאדם.`
        }
      });
    }
    const review = await services.loadContractsDecisionReview(args);
    return result({ decisionReview: review }, review.items.some((item) => item.reviewStatus === "proposed"));
  }
  // Handoff and operational calls require the CURRENT persisted review to be terminal.
  const review = await services.loadContractsDecisionReview(args);
  if (review.metrics.pendingRelationshipCount > 0 || review.metrics.proposedCount > 0) {
    throw new ContractsAgentError("contracts_automatic_review_incomplete", "Automatic review has not finished for this workspace.", 409);
  }
  const promote = typeof services.promoteLabDecisionsToApp === "function"
    ? services.promoteLabDecisionsToApp
    : async () => ({ ok: true, skipped: true });
  if (step === "handoff") {
    const handoff = await services.loadContractsIndicatorHandoff(args);
    return result({
      handoff,
      promoted: await promote({ ...args, workspaceId: id })
    });
  }
  if (step === "indicator") {
    const sync = await services.reconcileContractConditions({ ...args, commit: true });
    if (sync.ok !== true || sync.committed !== true) {
      throw new ContractsAgentError("contracts_automatic_indicator_failed", "Indicator did not complete its synchronization.", 502);
    }
    return result({ indicatorSync: sync });
  }
  const saved = await services.getSavedContractsClauseWorkspace(args);
  const schedule = await services.runScheduleSweep({ projectId: saved.workspace.sourceProjectId, config, persist: true });
  if (schedule.contractConditionSync?.ok === false || schedule.conditionResolution?.ok === false
      || schedule.persistOutcome?.persisted === false
      || Number(schedule.conditionResolution?.summary?.error || 0) > 0) {
    throw new ContractsAgentError("contracts_automatic_schedule_failed", "Schedule synchronization or condition resolution failed. Retry from the saved stage.", 502);
  }
  return result({
    schedule: {
      scheduleProjectId: schedule.scheduleProjectId, asOf: schedule.asOf,
      indicators: schedule.indicators, contractConditionSync: schedule.contractConditionSync,
      conditionResolution: schedule.conditionResolution, warnings: schedule.warnings || []
    },
    unresolvedDecisions: review.items.filter((item) => item.reviewStatus === "unresolved").length,
    promoted: await promote({ ...args, workspaceId: id })
  });
}
