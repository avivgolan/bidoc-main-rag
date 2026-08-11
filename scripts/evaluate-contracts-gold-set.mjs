import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateContractExtraction } from "../src/contracts/goldEvaluator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
if (!args.actual) {
  console.error("Usage: npm run contracts:gold -- --actual <extraction.json> [--gold <annotation.json>]");
  process.exit(2);
}

const goldPath = path.resolve(
  args.gold || path.join(root, "docs", "Indicator + Contracts", "gold-set", "sample-herzliya-contract.annotation.json")
);
const actualPath = path.resolve(args.actual);
const expected = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const actual = JSON.parse(fs.readFileSync(actualPath, "utf8"));
const report = evaluateContractExtraction({ expected, actual });
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === "--actual" || key === "--gold") parsed[key.slice(2)] = values[++index];
  }
  return parsed;
}
