import {
  ChatCompletionIntegrityError,
  classifyChatCompletion,
  requireCompleteChatCompletion
} from "./openrouter.js";

export function mainCompletionFailureCode(error) {
  if (error?.reasonCode) return String(error.reasonCode);
  const message = String(error?.message || "");
  const httpStatus = Number(error?.httpStatus || 0);
  if (/timed out/i.test(message)) return "timeout";
  if (httpStatus === 402 || /more credits|can only afford/i.test(message)) return "provider_capacity";
  if ([401, 403].includes(httpStatus)) return "authentication";
  if ([400, 422].includes(httpStatus)) return "invalid_request";
  if (httpStatus === 429) return "provider_rate_limit";
  if (httpStatus >= 500) return "provider_unavailable";
  return "provider_error";
}

export async function runBoundedMainCompletion({
  initialCall,
  retryCall = null,
  retryPolicyFor = () => null,
  enforceIntegrity = true
} = {}) {
  if (typeof initialCall !== "function") throw new TypeError("initialCall must be a function");
  const attempts = [];

  try {
    const completion = await initialCall();
    const integrity = classifyChatCompletion(completion);
    attempts.push(completionAttempt("initial", completion, integrity));
    const content = validateMainCompletion(completion, { enforceIntegrity });
    return successfulCompletionOutcome({ content, completion, attempts, status: "done", reason: "completion_complete" });
  } catch (error) {
    recordTransportFailure(attempts, "initial", error);
    const retryPolicy = typeof retryPolicyFor === "function" ? retryPolicyFor(error) : null;
    if (!retryPolicy || typeof retryCall !== "function") {
      throw attachFailureOutcome(error, attempts);
    }

    try {
      const completion = await retryCall(retryPolicy);
      const integrity = classifyChatCompletion(completion);
      attempts.push(completionAttempt("retry", completion, integrity));
      const content = validateMainCompletion(completion, { enforceIntegrity });
      return successfulCompletionOutcome({
        content,
        completion,
        attempts,
        status: "retried",
        reason: retryPolicy.reason || "retry"
      });
    } catch (retryError) {
      recordTransportFailure(attempts, "retry", retryError);
      throw attachFailureOutcome(retryError, attempts, retryPolicy.reason || "retry");
    }
  }
}

export function validateMainCompletion(completion, { enforceIntegrity = true } = {}) {
  if (enforceIntegrity) return requireCompleteChatCompletion(completion);
  if (typeof completion?.content === "string" && completion.content.trim()) return completion.content;
  throw new ChatCompletionIntegrityError("Chat completion integrity check failed: empty", {
    reasonCode: "completion_empty",
    integrityStatus: "empty",
    finishReason: completion?.finishReason ?? null,
    nativeFinishReason: completion?.nativeFinishReason ?? null
  });
}

function successfulCompletionOutcome({ content, completion, attempts, status, reason }) {
  return {
    content,
    status,
    reason,
    integrityStatus: "complete",
    attempts,
    model: completion?.model || null,
    callId: completion?.callId || null
  };
}

function completionAttempt(stage, completion, integrity) {
  return {
    stage,
    status: integrity.status,
    reason: integrity.reasonCode,
    finishReason: completion?.finishReason ?? null,
    nativeFinishReason: completion?.nativeFinishReason ?? null,
    model: completion?.model || null,
    callId: completion?.callId || null
  };
}

function recordTransportFailure(attempts, stage, error) {
  if (error instanceof ChatCompletionIntegrityError) {
    if (!attempts.some((attempt) => attempt.stage === stage)) {
      attempts.push({
        stage,
        status: error.integrityStatus,
        reason: error.reasonCode,
        finishReason: error.finishReason ?? null,
        nativeFinishReason: error.nativeFinishReason ?? null,
        model: error.completionModel || null,
        callId: error.completionCallId || null
      });
    }
    return;
  }
  attempts.push({
    stage,
    status: "error",
    reason: mainCompletionFailureCode(error),
    finishReason: null,
    nativeFinishReason: null,
    model: null,
    callId: null
  });
}

function attachFailureOutcome(error, attempts, retryReason = null) {
  const failure = error instanceof Error ? error : new Error("Main completion failed");
  failure.mainCompletion = {
    status: "fallback",
    reason: mainCompletionFailureCode(failure),
    integrityStatus: failure.integrityStatus || "error",
    retryReason,
    attempts: attempts.map((attempt) => ({ ...attempt }))
  };
  return failure;
}
