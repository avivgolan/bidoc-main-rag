import assert from "node:assert/strict";
import test from "node:test";
import { chatCompletion } from "../src/openrouter.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function okCompletion(content = "{\"ok\":true}") {
  return jsonResponse(200, {
    id: "gen-test",
    model: "fixture/model",
    choices: [{ finish_reason: "stop", native_finish_reason: "stop", message: { content } }]
  });
}

test("falls back from json_schema to json_object and injects the word json", async () => {
  const bodies = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) {
      return jsonResponse(400, {
        error: { message: "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model." }
      });
    }
    return okCompletion();
  };
  try {
    const content = await chatCompletion({
      apiKey: "sk-test",
      model: "fixture/model",
      messages: [{ role: "system", content: "Review the relationship." }, { role: "user", content: "approve or reject" }],
      responseFormat: { type: "json_schema", json_schema: { name: "x", schema: { type: "object" } } }
    });
    assert.equal(content, "{\"ok\":true}");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].response_format.type, "json_schema");
    assert.equal(bodies[1].response_format.type, "json_object");
    assert.match(JSON.stringify(bodies[1].messages), /json/iu);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("drops json_object when the model rejects that response format", async () => {
  const bodies = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) {
      return jsonResponse(400, {
        error: { message: "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model." }
      });
    }
    return okCompletion("plain");
  };
  try {
    const content = await chatCompletion({
      apiKey: "sk-test",
      model: "fixture/model",
      messages: [{ role: "user", content: "Return JSON please" }],
      responseFormat: { type: "json_object" }
    });
    assert.equal(content, "plain");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].response_format, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
