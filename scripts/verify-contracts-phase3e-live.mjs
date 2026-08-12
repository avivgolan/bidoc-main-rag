import { getConfig, loadEnv } from "../src/config.js";
import { loadContractActivityMappingState } from "../src/contracts/activityMappingService.js";

const sourceProjectId = String(process.argv[2] || "").trim();
loadEnv();
if (!sourceProjectId) {
  console.error("Usage: node scripts/verify-contracts-phase3e-live.mjs <MAIN source project UUID>");
  process.exitCode = 2;
} else {
  const state = await loadContractActivityMappingState({
    config: getConfig(),
    sourceProjectId
  });
  console.log(JSON.stringify({
    apiVersion: state.apiVersion,
    mode: state.mode,
    projectContext: state.projectContext,
    scheduleVersion: state.scheduleVersion,
    counts: state.counts,
    operationalWritesPerformed: state.operationalWritesPerformed
  }, null, 2));
}
