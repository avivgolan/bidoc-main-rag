import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { reconstructPdfPageText } from "../src/contracts/pdfReader.js";
import { buildContractsClauseGeneration } from "../src/contracts/clauseParser.js";
import {
  CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";

const SHA = "a".repeat(64);

test("normalizes Apple private-use nun glyph from PDF text", () => {
  const text = reconstructPdfPageText([{ str: "רשימת ספחים ותוכיות", hasEOL: true }]);
  assert.equal(text, "רשימת נספחים ותוכניות");
});

test("splits unnumbered document context at each page boundary", () => {
  const generation = buildContractsClauseGeneration({
    pages: [
      { pdfPage: 1, text: "פרטי הסכם\nרשימת נספחים" },
      { pdfPage: 2, text: "הערות כלליות\n1. תחולת ההסכם" }
    ],
    documentVersionId: `sha256:${SHA}`,
    documentSha256: SHA
  });
  const contexts = generation.clauses.filter((clause) => clause.clauseType === "document_context");
  assert.equal(contexts.length, 2);
  assert.deepEqual(contexts.map((clause) => [clause.pageStart, clause.pageEnd]), [[1, 1], [2, 2]]);
});

test("uses Hebrew tags by default for clause enrichment", async () => {
  const generation = buildContractsClauseGeneration({
    pages: [{ pdfPage: 1, text: "1. הקבלן אחראי לביצוע העבודה." }],
    documentVersionId: `sha256:${SHA}`,
    documentSha256: SHA
  });
  const result = await runContractsClauseEnrichment({
    generation,
    config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
    chatComplete: async ({ messages }) => {
      const input = JSON.parse(messages[1].content);
      assert.ok(input.controlledTags.every((tag) => /[\u0590-\u05ff]/u.test(tag)));
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: input.clauses.map((clause) => ({
          clauseKey: clause.clauseKey,
          summaryHe: "הסעיף קובע את אחריות הקבלן לביצוע העבודה.",
          tags: ["ביצוע", "אחריות"]
        }))
      });
    }
  });
  assert.deepEqual(result.clauses[0].hashtags, ["ביצוע", "אחריות"]);
});
