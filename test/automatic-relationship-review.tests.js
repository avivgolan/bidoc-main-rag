import assert from "node:assert/strict";
import test from "node:test";
import { reviewAutomaticRelationshipBatch } from "../src/contracts/automaticRelationshipReview.js";

const ITEM = {
  relationshipId: "11111111-1111-4111-8111-111111111111",
  relationshipType: "depends_on",
  sourceClauseKey: "1",
  targetClauseKey: "2",
  revision: 1,
  evidence: {
    excerpts: [
      { clauseKey: "1", excerpt: "הקבלן ישלם תוך 14 יום." },
      { clauseKey: "2", excerpt: "התשלום מותנה באישור המפקח." }
    ]
  }
};

test("accepts extra json_object fields and Hebrew reasons", async () => {
  const results = await reviewAutomaticRelationshipBatch({
    items: [ITEM],
    config: { openRouterApiKey: "sk-test", models: { main: "fixture/model" } },
    chatComplete: async () => JSON.stringify({
      schemaVersion: "extra",
      items: [{
        relationshipId: ITEM.relationshipId,
        verdict: "approve",
        confidence: 0.99,
        reasonHe: "הציטוטים תומכים בקשר התלות בין הסעיפים.",
        extra: true
      }]
    })
  });
  assert.equal(results[0].unresolved, false);
  assert.equal(results[0].action, "approve");
});

test("does not fail the pipeline when the model returns no JSON items", async () => {
  const results = await reviewAutomaticRelationshipBatch({
    items: [ITEM],
    config: { openRouterApiKey: "sk-test", models: { main: "fixture/model" } },
    chatComplete: async () => "I cannot review this."
  });
  assert.equal(results[0].unresolved, true);
  assert.equal(results[0].action, "reject");
});

test("keeps the pipeline moving when one review item is malformed", async () => {
  const results = await reviewAutomaticRelationshipBatch({
    items: [ITEM],
    config: { openRouterApiKey: "sk-test", models: { main: "fixture/model" } },
    chatComplete: async () => "```json\n{\"items\":[{\"relationshipId\":\"" + ITEM.relationshipId + "\",\"verdict\":\"approve\",\"confidence\":0.2,\"reasonHe\":\"ok\"}]}\n```"
  });
  assert.equal(results[0].unresolved, true);
  assert.equal(results[0].action, "reject");
  assert.match(results[0].reasonHe, /ממצא לא פתור/);
});
