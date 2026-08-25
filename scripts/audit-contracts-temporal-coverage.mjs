import { getConfig, loadEnv, reloadSettingsFromDb } from "../src/config.js";
import { getSavedContractsClauseWorkspace } from "../src/contracts/clausePersistence.js";
import { loadContractsIndicatorProductSource } from "../src/contracts/indicatorHandoff.js";
import { auditContractsTemporalCoverage } from "../src/contracts/temporalCoverageAudit.js";

const workspaceId = String(process.argv[2] || "").trim();
if (!workspaceId) {
  console.error("Usage: node scripts/audit-contracts-temporal-coverage.mjs <workspace-uuid>");
  process.exitCode = 1;
} else {
  loadEnv();
  await reloadSettingsFromDb();
  const config = getConfig();
  const [savedWorkspace, productSource] = await Promise.all([
    getSavedContractsClauseWorkspace({ config, workspaceId }),
    loadContractsIndicatorProductSource({ config, workspaceId })
  ]);
  const result = auditContractsTemporalCoverage({
    clauses: savedWorkspace.preview?.clauses,
    decisions: productSource.items
  });
  console.log(JSON.stringify({
    workspaceId,
    productDecisionCount: productSource.items.length,
    ...result
  }, null, 2));
}
