import { getConfig, initSettings, loadEnv } from "../src/config.js";
import {
  loadContractsR6EmbeddingWork,
  persistContractsR6EmbeddingItems
} from "../src/contracts/r6Preparation.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function integerFlag(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) return null;
  const value = Number(argument.slice(prefix.length));
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${prefix}<non-negative integer> is required.`);
  }
  return value;
}

function countKinds(items) {
  return items.reduce((counts, item) => {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    return counts;
  }, { document: 0, decision: 0 });
}

loadEnv();
await initSettings();

const workspaceId = String(process.argv[2] || "").trim().toLowerCase();
if (!UUID_PATTERN.test(workspaceId)) {
  throw new Error("Usage: node scripts/backfill-contracts-r6-historical-parity.mjs <workspace-id> [--apply --expected-documents=N --expected-decisions=N]");
}

const apply = process.argv.includes("--apply");
const expectedDocuments = integerFlag("expected-documents");
const expectedDecisions = integerFlag("expected-decisions");
if (apply && (expectedDocuments === null || expectedDecisions === null)) {
  throw new Error("--apply requires --expected-documents and --expected-decisions.");
}

const config = getConfig();
if (!config.contentSource?.supabaseUrl || !config.contentSource?.supabaseServiceRoleKey) {
  throw new Error("Server-side KAPAIM credentials are not configured.");
}

const items = await loadContractsR6EmbeddingWork({
  config,
  workspaceId,
  timeoutMs: 60_000
});
const planned = countKinds(items);

if (!apply) {
  process.stdout.write(`${JSON.stringify({
    mode: "dry-run",
    workspaceId,
    planned
  }, null, 2)}\n`);
  process.exit(0);
}

if (!config.openRouterApiKey) {
  throw new Error("OPENROUTER_API_KEY is not configured.");
}
if (planned.document !== expectedDocuments || planned.decision !== expectedDecisions) {
  throw new Error(`Embedding work changed: expected ${expectedDocuments} documents and ${expectedDecisions} decisions, found ${planned.document} and ${planned.decision}.`);
}

const result = await persistContractsR6EmbeddingItems({
  config,
  workspaceId,
  items,
  timeoutMs: 120_000
});
const remaining = await loadContractsR6EmbeddingWork({
  config,
  workspaceId,
  timeoutMs: 60_000
});
const remainingCounts = countKinds(remaining);
if (remaining.length) {
  throw new Error(`Historical parity backfill is incomplete: ${remainingCounts.document} documents and ${remainingCounts.decision} decisions remain.`);
}

process.stdout.write(`${JSON.stringify({
  mode: "apply",
  workspaceId,
  planned,
  written: result.written,
  reused: result.reused,
  remaining: remainingCounts
}, null, 2)}\n`);
