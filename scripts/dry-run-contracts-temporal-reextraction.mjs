import { getConfig, loadEnv, reloadSettingsFromDb } from "../src/config.js";
import { getSavedContractsClauseWorkspace } from "../src/contracts/clausePersistence.js";
import { loadContractsIndicatorProductSource } from "../src/contracts/indicatorHandoff.js";
import { runContractsDecisionNormalization } from "../src/contracts/decisionNormalization.js";
import { loadContractsR6ActiveCatalog } from "../src/contracts/r6Preparation.js";
import { loadContractsRelationshipReview } from "../src/contracts/semanticRelationshipReview.js";
import { auditContractsTemporalCoverage } from "../src/contracts/temporalCoverageAudit.js";
import { buildContractsTemporalReextractionPlan } from "../src/contracts/temporalReextractionPlan.js";

const workspaceId = String(process.argv[2] || "").trim();
if (!workspaceId) {
  console.error("Usage: node scripts/dry-run-contracts-temporal-reextraction.mjs <workspace-uuid>");
  process.exitCode = 1;
} else {
  loadEnv();
  await reloadSettingsFromDb();
  const config = getConfig();
  const [savedWorkspace, productSource, relationshipReview, catalog] = await Promise.all([
    getSavedContractsClauseWorkspace({ config, workspaceId }),
    loadContractsIndicatorProductSource({ config, workspaceId }),
    loadContractsRelationshipReview({ config, workspaceId }),
    loadContractsR6ActiveCatalog({ config })
  ]);
  const coverageAudit = auditContractsTemporalCoverage({
    clauses: savedWorkspace.preview?.clauses,
    decisions: productSource.items
  });
  const repairPlan = buildContractsTemporalReextractionPlan({
    coverageAudit,
    clauses: savedWorkspace.preview?.clauses
  });
  const targetClauseKeys = [...new Set(repairPlan.candidates
    .filter((candidate) => candidate.disposition === "normalize_for_human_review")
    .map((candidate) => candidate.clauseKey))];
  const analysis = await runContractsDecisionNormalization({
    preview: savedWorkspace.preview,
    relationshipReview,
    config,
    triggerCatalog: catalog.triggers,
    // This narrow repair lane extracts the fields that drive Indicator anchor
    // matching. Use the configured primary model; the generic full-workspace
    // path can retain its lower-cost model independently.
    modelVersion: config.models?.main || config.models?.lite || "openai/gpt-4o",
    targetClauseKeys
  });
  console.log(JSON.stringify({
    workspaceId,
    repairPlan: {
      planVersion: repairPlan.planVersion,
      metrics: repairPlan.metrics,
      targetClauseKeys
    },
    analysis: {
      agentVersion: analysis.agentVersion,
      modelVersion: analysis.modelVersion,
      metrics: analysis.metrics,
      gates: analysis.gates
    },
    indicatorTablePreview: analysis.proposals.map((proposal) => ({
      decisionKey: proposal.decisionKey,
      sourceClauseKeys: proposal.sourceClauseKeys,
      name: proposal.titleHe,
      category: proposal.decisionCategory,
      scheduleImpact: proposal.scheduleImpact,
      temporalKind: proposal.temporalKind,
      anchor_kind: proposal.triggerKind === "תחילת העבודה" ? "schedule_task" : "event",
      anchor_description: proposal.triggerDescriptionHe,
      offset_value: proposal.offsetValue,
      offset_unit: proposal.offsetUnit,
      recurring: proposal.recurring,
      reviewStatus: proposal.reviewStatus
    }))
  }, null, 2));
}
