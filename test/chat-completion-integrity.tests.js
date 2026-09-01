import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ChatCompletionIntegrityError,
  chatCompletion,
  chatCompletionDetailed,
  classifyChatCompletion,
  requireCompleteChatCompletion
} from "../src/openrouter.js";
import { mainCompletionFailureCode, runBoundedMainCompletion, validateMainCompletion } from "../src/mainCompletion.js";
import { cachedOperation, createCacheContext } from "../src/cache.js";
import {
  conflictWorkflowStatus,
  dataQueryFailureReasonCode,
  fallbackRagAnswer,
  mainSynthesisRetryPolicy,
  mainWorkflowStatus
} from "../src/agent.js";

const complete = (overrides = {}) => ({
  content: "Complete answer",
  finishReason: "stop",
  nativeFinishReason: "STOP",
  usage: { total_tokens: 20 },
  model: "openai/gpt-test",
  callId: "generation-1",
  provider: "test-provider",
  malformed: false,
  ...overrides
});

export function registerChatCompletionIntegrityTests(test) {
  test("chat completion integrity returns detailed metadata and preserves the text wrapper", async () => {
    const previousFetch = global.fetch;
    const telemetry = [];
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "generation-42",
        model: "openai/gpt-test",
        provider: "Test Provider",
        choices: [{
          finish_reason: "stop",
          native_finish_reason: "STOP",
          message: { content: "Verified answer" }
        }],
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 }
      })
    });
    try {
      const detailed = await chatCompletionDetailed({
        apiKey: "sk-test",
        model: "openai/gpt-test",
        messages: [{ role: "user", content: "question" }],
        telemetry: { record: (entry) => telemetry.push(entry) }
      });
      assert.deepEqual(detailed, {
        content: "Verified answer",
        finishReason: "stop",
        nativeFinishReason: "STOP",
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        model: "openai/gpt-test",
        callId: "generation-42",
        provider: "Test Provider",
        malformed: false
      });
      assert.equal(await chatCompletion({
        apiKey: "sk-test",
        model: "openai/gpt-test",
        messages: [{ role: "user", content: "question" }]
      }), "Verified answer");
      assert.equal(telemetry[0].completion_status, "complete");
    } finally {
      global.fetch = previousFetch;
    }
  });

  test("chat completion integrity accepts STOP and rejects every incomplete shape", () => {
    assert.deepEqual(classifyChatCompletion(complete()), {
      status: "complete",
      reasonCode: "completion_complete"
    });
    assert.equal(requireCompleteChatCompletion(complete()), "Complete answer");
    assert.equal(validateMainCompletion(complete({ finishReason: "length" }), { enforceIntegrity: false }), "Complete answer");

    const cases = [
      [complete({ finishReason: "length" }), "truncated", "completion_truncated"],
      [complete({ nativeFinishReason: "MAX_TOKENS" }), "truncated", "completion_truncated"],
      [complete({ content: "   " }), "empty", "completion_empty"],
      [complete({ malformed: true }), "malformed", "completion_malformed"],
      [complete({ finishReason: null, nativeFinishReason: null }), "missing_finish", "completion_missing_finish"],
      [complete({ finishReason: "content_filter" }), "failed_finish", "completion_failed_finish"]
    ];
    for (const [completion, status, reasonCode] of cases) {
      assert.deepEqual(classifyChatCompletion(completion), { status, reasonCode });
      assert.throws(
        () => requireCompleteChatCompletion(completion),
        (error) => error instanceof ChatCompletionIntegrityError
          && error.integrityStatus === status
          && error.reasonCode === reasonCode
      );
    }
  });

  test("chat completion integrity never stores an invalid completion in the answer cache", async () => {
    let operations = 0;
    const context = createCacheContext({
      config: {
        cache: {
          enabled: true,
          provider: "memory",
          namespace: `chat-integrity-${Date.now()}-${Math.random()}`,
          memoryMaxEntries: 10
        }
      }
    });
    const call = () => cachedOperation({
      context,
      type: "finalAnswer",
      keyParts: { contract: "detailed.v1", case: "truncated" },
      operation: async () => {
        operations += 1;
        const completion = complete({ content: "Partial", finishReason: "length" });
        validateMainCompletion(completion);
        return completion;
      }
    });
    await assert.rejects(call, ChatCompletionIntegrityError);
    await assert.rejects(call, ChatCompletionIntegrityError);
    assert.equal(operations, 2);
  });

  test("chat completion integrity retries one truncated Main completion and records recovery", async () => {
    let initialCalls = 0;
    let retryCalls = 0;
    const result = await runBoundedMainCompletion({
      initialCall: async () => {
        initialCalls += 1;
        return complete({ content: "Partial answer", finishReason: "length", nativeFinishReason: "MAX_TOKENS" });
      },
      retryPolicyFor: (error) => mainSynthesisRetryPolicy(error, {
        models: { main: "openai/gpt-test" },
        ai: { main: { maxTokens: 4096 } }
      }),
      retryCall: async (policy) => {
        retryCalls += 1;
        assert.equal(policy.reason, "truncation");
        assert.equal(policy.maxTokens, 4096);
        return complete({ content: "Recovered complete answer", callId: "generation-2" });
      }
    });
    assert.equal(initialCalls, 1);
    assert.equal(retryCalls, 1);
    assert.equal(result.content, "Recovered complete answer");
    assert.equal(result.status, "retried");
    assert.equal(result.reason, "truncation");
    assert.deepEqual(result.attempts.map((attempt) => attempt.status), ["truncated", "complete"]);
  });

  test("chat completion integrity falls back after one failed retry and never loops", async () => {
    let retryCalls = 0;
    await assert.rejects(
      () => runBoundedMainCompletion({
        initialCall: async () => complete({ content: "Partial one", finishReason: "length" }),
        retryPolicyFor: (error) => mainSynthesisRetryPolicy(error, {
          models: { main: "openai/gpt-test" },
          ai: { main: { maxTokens: 4096 } }
        }),
        retryCall: async () => {
          retryCalls += 1;
          return complete({ content: "Partial two", nativeFinishReason: "MAX_TOKENS" });
        }
      }),
      (error) => {
        assert.equal(error.mainCompletion.status, "fallback");
        assert.equal(error.mainCompletion.reason, "completion_truncated");
        assert.equal(error.mainCompletion.integrityStatus, "truncated");
        assert.deepEqual(error.mainCompletion.attempts.map((attempt) => attempt.status), ["truncated", "truncated"]);
        return true;
      }
    );
    assert.equal(retryCalls, 1);
  });

  test("chat completion integrity does not retry empty, authentication, or invalid requests", async () => {
    const cases = [
      async () => complete({ content: "" }),
      async () => { throw Object.assign(new Error("Unauthorized"), { httpStatus: 401 }); },
      async () => { throw Object.assign(new Error("Invalid schema"), { httpStatus: 400 }); }
    ];
    const reasons = [];
    for (const initialCall of cases) {
      let retryCalls = 0;
      await assert.rejects(
        () => runBoundedMainCompletion({
          initialCall,
          retryPolicyFor: (error) => mainSynthesisRetryPolicy(error, {}),
          retryCall: async () => {
            retryCalls += 1;
            return complete();
          }
        }),
        (error) => {
          reasons.push(error.mainCompletion.reason);
          return true;
        }
      );
      assert.equal(retryCalls, 0);
    }
    assert.deepEqual(reasons, ["completion_empty", "authentication", "invalid_request"]);
  });

  test("chat completion integrity preserves bounded timeout and capacity retry policies", () => {
    assert.deepEqual(mainSynthesisRetryPolicy(new Error("OpenRouter response timed out after 120000ms"), {
      models: { main: "openai/gpt-main" },
      ai: { main: { maxTokens: 4096 } }
    }), {
      reason: "timeout",
      model: "openai/gpt-main",
      maxTokens: 1600,
      recordLimit: 5,
      chunkTextLimit: 700
    });
    assert.deepEqual(mainSynthesisRetryPolicy(new Error("OpenRouter response timed out after 90000ms"), {
      models: { main: "openai/gpt-main" },
      ai: { main: { maxTokens: 8092 } }
    }, { broad: true }), {
      reason: "timeout",
      model: "openai/gpt-main",
      maxTokens: 8092,
      recordLimit: 8,
      chunkTextLimit: 700
    });
    assert.equal(mainCompletionFailureCode(Object.assign(new Error("secret provider text"), { httpStatus: 402 })), "provider_capacity");
    assert.equal(mainCompletionFailureCode(Object.assign(new Error("secret provider text"), { httpStatus: 503 })), "provider_unavailable");
  });

  test("chat completion integrity maps workflow recovery, fallback, skip, and conflicts truthfully", () => {
    assert.equal(mainWorkflowStatus({ status: "done" }), "done");
    assert.equal(mainWorkflowStatus({ status: "retried" }), "retried");
    assert.equal(mainWorkflowStatus({ status: "fallback" }), "fallback");
    assert.equal(mainWorkflowStatus({ status: "skipped" }), "skipped");
    assert.equal(mainWorkflowStatus({ integrityStatus: "truncated" }), "truncated");
    assert.equal(mainWorkflowStatus({ status: "unknown" }), "error");
    assert.equal(conflictWorkflowStatus([]), "done");
    assert.equal(conflictWorkflowStatus([{ field: "status" }]), "warning");
    assert.equal(dataQueryFailureReasonCode({ ok: false, data: { status: "error" } }), "data_query_error");
    assert.equal(dataQueryFailureReasonCode({ ok: false, data: { routing: { warning: "structured_lookup_not_available" } } }), "data_query_structured_lookup_not_available");
    assert.equal(dataQueryFailureReasonCode({ ok: false, error: "private provider text" }), "data_query_execution_failed");

    const appSource = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    for (const status of ["retried", "fallback", "warning", "truncated"]) {
      assert.match(appSource, new RegExp(`node\\.status === "${status}"`));
    }
  });

  test("chat completion integrity keeps payload telemetry available on Main failure", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    const synthesisStart = agentSource.indexOf("async function synthesizeAnswer");
    const synthesisTry = agentSource.indexOf("  try {", synthesisStart);
    const synthesisCatch = agentSource.indexOf("  } catch (error) {", synthesisTry);
    const beforeTry = agentSource.slice(synthesisStart, synthesisTry);
    const tryBlock = agentSource.slice(synthesisTry, synthesisCatch);
    assert.match(beforeTry, /let payloadMetrics = null;\s*let retryPayloadMetrics = null;/);
    assert.match(tryBlock, /payloadMetrics = compactBuild\?\.metrics \|\| measureMainRequest\(/);
    assert.doesNotMatch(tryBlock, /(?:const|let) payloadMetrics =/);
    assert.doesNotMatch(tryBlock, /let retryPayloadMetrics =/);
  });

  test("chat completion integrity customer fallback distinguishes missing evidence", () => {
    const answer = fallbackRagAnswer({ message: "What caused the delay?" });
    assert.match(answer, /No sufficient verified evidence was available/);
    assert.doesNotMatch(answer, /Potentially relevant sources were found/);
  });
}
