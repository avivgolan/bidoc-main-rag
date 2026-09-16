import assert from "node:assert/strict";
import test from "node:test";
import { buildContractsClauseGeneration } from "../src/contracts/clauseParser.js";

const SHA = "a".repeat(64);

test("ignores payment amounts that look like dotted clause numbers", () => {
  const generation = buildContractsClauseGeneration({
    pages: [{
      pdfPage: 1,
      text: [
        "1. תחולת ההסכם",
        "הקבלן יבצע את העבודות.",
        "28.35 ₪",
        "94.50 ש\"ח כולל מע\"מ",
        "47.25 %",
        "85.5 יח'",
        "66.15 תוספת ברזל",
        "85.5. יחידות מזגן",
        "2. תמורה",
        "התמורה תשולם לפי חשבון."
      ].join("\n")
    }],
    documentVersionId: `sha256:${SHA}`,
    documentSha256: SHA
  });
  assert.equal(generation.coverageLedger.accepted, true);
  assert.deepEqual(generation.coverageLedger.duplicateKeys, []);
  assert.deepEqual(generation.coverageLedger.missingParents, []);
  assert.deepEqual(
    generation.clauses
      .filter((clause) => clause.clauseType !== "document_context")
      .map((clause) => clause.clauseKey),
    ["1", "2"]
  );
});

test("still reads real subclauses with an explicit delimiter", () => {
  const generation = buildContractsClauseGeneration({
    pages: [{
      pdfPage: 1,
      text: "1. תחולת ההסכם\n1.10. הקבלן ישלים את העבודה.\n2. תמורה"
    }],
    documentVersionId: `sha256:${SHA}`,
    documentSha256: SHA
  });
  assert.equal(generation.coverageLedger.accepted, true);
  assert.deepEqual(
    generation.clauses
      .filter((clause) => clause.clauseType !== "document_context")
      .map((clause) => clause.clauseKey),
    ["1", "1.10", "2"]
  );
});
