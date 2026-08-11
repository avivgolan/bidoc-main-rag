import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalOutputSha256, compileRepresentativeCases, evaluateRepresentativeCases } from "../src/contracts/representativeEvaluator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "docs", "Indicator + Contracts", "gold-set", "representative-contract-cases.input.json");
const expectedPath = path.join(root, "docs", "Indicator + Contracts", "gold-set", "representative-contract-cases.expected.json");
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (process.argv.includes("--print-generated")) {
  console.log(JSON.stringify({
    expectedVersion: "contracts-representative-expected.phase1.v1",
    generatedFrom: input.caseSetVersion,
    cases: compileRepresentativeCases(input).map((item) => ({ id: item.id, canonicalSha256: canonicalOutputSha256(item.output) }))
  }, null, 2));
  process.exit(0);
}

const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const report = evaluateRepresentativeCases({ input, expected });
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
