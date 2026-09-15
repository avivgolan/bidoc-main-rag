import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";
import { buildContractsClauseGeneration } from "../src/contracts/clauseParser.js";

const FIXTURE_SHA = "a".repeat(64);

test("contracts R3 remaps mangled enrichment keys in batch order without a repair call", async () => {
  const generation = buildContractsClauseGeneration({
    pages: [{ pdfPage: 1, text: "1. הוראות כלליות\n1.1. יש לפעול לפי ההסכם." }],
    documentVersionId: `sha256:${FIXTURE_SHA}`,
    documentSha256: FIXTURE_SHA
  });
  let calls = 0;
  const enriched = await runContractsClauseEnrichment({
    generation,
    config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
    chatComplete: async ({ messages }) => {
      calls += 1;
      const input = JSON.parse(messages[1].content);
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: input.clauses.map((_clause, index) => ({
          clauseKey: `wrong.${index + 1}`,
          summaryHe: "הסעיף מתאר הוראה חוזית כללית.",
          tags: ["scope"]
        }))
      });
    }
  });
  assert.equal(calls, 1);
  assert.equal(enriched.qualityLedger.modelRepairCount, 0);
  assert.equal(enriched.qualityLedger.correctedUnknownKeyCount, generation.clauses.length);
  assert.deepEqual(
    enriched.clauses.map((clause) => clause.clauseKey),
    generation.clauses.map((clause) => clause.clauseKey)
  );
});

test("contracts R3 fills omitted enrichment keys from source text after bounded repair", async () => {
  const generation = buildContractsClauseGeneration({
    pages: [{ pdfPage: 1, text: "1. הוראות כלליות לביצוע העבודה." }],
    documentVersionId: `sha256:${FIXTURE_SHA}`,
    documentSha256: FIXTURE_SHA
  });
  let calls = 0;
  const enriched = await runContractsClauseEnrichment({
    generation,
    config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
    chatComplete: async () => {
      calls += 1;
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: []
      });
    }
  });
  assert.equal(calls, 2);
  assert.equal(enriched.qualityLedger.modelRepairCount, 1);
  assert.equal(enriched.qualityLedger.deterministicFallbackClauseCount, 1);
  assert.equal(enriched.clauses[0].clauseKey, "1");
  assert.match(enriched.clauses[0].summaryHe, /הוראות כלליות/u);
  assert.ok(enriched.clauses[0].hashtags.length >= 1);
});

test("contracts R3 maps spaced Hebrew tags and falls back invented tags without failing the batch", async () => {
  const generation = buildContractsClauseGeneration({
    pages: [{ pdfPage: 1, text: "1. הוראות כלליות לביצוע העבודה." }],
    documentVersionId: `sha256:${FIXTURE_SHA}`,
    documentSha256: FIXTURE_SHA
  });
  let calls = 0;
  const enriched = await runContractsClauseEnrichment({
    generation,
    config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
    chatComplete: async ({ messages }) => {
      calls += 1;
      const input = JSON.parse(messages[1].content);
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: input.clauses.map((clause) => ({
          clauseKey: clause.clauseKey,
          summaryHe: "הסעיף קובע הוראות כלליות לביצוע העבודה.",
          tags: ["לוח זמנים", "#תשלום", "invented_tag"]
        }))
      });
    }
  });
  assert.equal(calls, 1);
  assert.deepEqual(enriched.clauses[0].hashtags, ["לוח_זמנים", "תשלום"]);
});

test("contracts R3 falls back invented-only tags onto the Hebrew catalog", async () => {
  const generation = buildContractsClauseGeneration({
    pages: [{ pdfPage: 1, text: "1. הוראות כלליות" }],
    documentVersionId: `sha256:${FIXTURE_SHA}`,
    documentSha256: FIXTURE_SHA
  });
  const enriched = await runContractsClauseEnrichment({
    generation,
    config: { openRouterApiKey: "configured", models: { main: "fixture/model" } },
    chatComplete: async ({ messages }) => {
      const input = JSON.parse(messages[1].content);
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: input.clauses.map((clause) => ({
          clauseKey: clause.clauseKey,
          summaryHe: "תקציר חוזי תקין.",
          tags: ["invented_tag"]
        }))
      });
    }
  });
  assert.ok(enriched.clauses[0].hashtags.length >= 1);
  assert.equal(enriched.clauses[0].hashtags.every((tag) => typeof tag === "string" && !tag.includes("invented")), true);
});
