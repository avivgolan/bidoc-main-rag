import { CONTRACTS_AUTOMATIC_PIPELINE_VERSION, CONTRACTS_AUTOMATIC_STEPS } from "../contracts/automaticPipelinePolicy.js";

export const CONTRACTS_AUTOMATIC_STORAGE_KEY = "bidoc.contracts.automatic.v1";

export function readContractsAutomaticCheckpoint(storage) {
  try {
    const value = JSON.parse(storage.getItem(CONTRACTS_AUTOMATIC_STORAGE_KEY) || "null");
    return value?.version === CONTRACTS_AUTOMATIC_PIPELINE_VERSION
      && /^[0-9a-f-]{36}$/iu.test(value.workspaceId || "")
      && CONTRACTS_AUTOMATIC_STEPS.includes(value.nextStep) ? value : null;
  } catch { return null; }
}

export async function runContractsAutomaticSequence({
  workspaceId, nextStep = "explicit", request, saveCheckpoint, onProgress = () => {},
  cancelled = () => false, delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  let step = nextStep;
  let batches = 0;
  while (step && !cancelled()) {
    if (!CONTRACTS_AUTOMATIC_STEPS.includes(step) || ++batches > 160) {
      throw new Error("Automatic processing exceeded its bounded stage count.");
    }
    saveCheckpoint({ version: CONTRACTS_AUTOMATIC_PIPELINE_VERSION, workspaceId, nextStep: step });
    onProgress({ step, status: "running" });
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await request(`/api/contracts/automatic/workspaces/${workspaceId}/steps/${step}`, {
          method: "POST", body: {}, timeoutMs: 300_000
        });
        break;
      } catch (error) {
        const retryable = error?.name === "AbortError" || error?.name === "TypeError"
          || error?.status === 429 || error?.status >= 500
          || (error?.status === 409 && /stale/u.test(error.code || ""));
        if (attempt >= 2 || !retryable || cancelled()) throw error;
        onProgress({ step, status: "retrying", attempt: attempt + 1 });
        await delay(1000 * 2 ** attempt);
      }
    }
    const expectedNext = response.repeat === true ? step
      : CONTRACTS_AUTOMATIC_STEPS[CONTRACTS_AUTOMATIC_STEPS.indexOf(step) + 1] || null;
    if (response.version !== CONTRACTS_AUTOMATIC_PIPELINE_VERSION || response.workspaceId !== workspaceId
        || response.step !== step || response.nextStep !== expectedNext) {
      throw new Error("Automatic processing returned an invalid stage checkpoint.");
    }
    onProgress({ step, status: response.repeat ? "running" : "done", response });
    step = response.nextStep;
    saveCheckpoint(step ? { version: CONTRACTS_AUTOMATIC_PIPELINE_VERSION, workspaceId, nextStep: step } : null);
  }
  return { completed: step === null, nextStep: step };
}
