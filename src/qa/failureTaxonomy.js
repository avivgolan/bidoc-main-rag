export const FAILURE_TAXONOMY = Object.freeze({
  CLASSIFICATION_ERROR: { rootCauseDomain: "Model/Prompt or Code/Pipeline", actionClass: "PROMPT_TUNABLE", recommendation: "Review classifier prompt, model, and heuristic override evidence." },
  RETRIEVAL_MISS: { rootCauseDomain: "Retrieval/Data", actionClass: "CONFIG_TUNABLE", recommendation: "Inspect query expansion, filters, embeddings, and candidate counts." },
  RETRIEVAL_NOISE: { rootCauseDomain: "Retrieval/Data", actionClass: "CONFIG_TUNABLE", recommendation: "Review hybrid weights, filters, and retrieval candidate limits." },
  RERANK_ERROR: { rootCauseDomain: "Retrieval/Data or Code/Pipeline", actionClass: "CONFIG_TUNABLE", recommendation: "Inspect reranker input/output, model, prompt, and top-k." },
  WRONG_TOOL_SELECTION: { rootCauseDomain: "Tools/Integrations or Model/Prompt", actionClass: "PROMPT_TUNABLE", recommendation: "Review tool routing policy and required-tool hints." },
  TOOL_FAILURE: { rootCauseDomain: "Tools/Integrations", actionClass: "EXTERNAL_TOOL_PROBLEM", recommendation: "Inspect the selected tool error, timeout, and response contract." },
  KNOWLEDGE_ROUTING_ERROR: { rootCauseDomain: "Model/Prompt or Code/Pipeline", actionClass: "PROMPT_TUNABLE", recommendation: "Review professional-knowledge routing and planner output." },
  CONTEXT_LOSS: { rootCauseDomain: "Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Inspect context packing, token limits, and dropped evidence." },
  HALLUCINATION: { rootCauseDomain: "Model/Prompt", actionClass: "PROMPT_TUNABLE", recommendation: "Strengthen grounding and unsupported-claim handling." },
  SOURCE_MISMATCH: { rootCauseDomain: "Model/Prompt or Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Inspect claim-to-citation extraction and source support." },
  INCOMPLETE_ANSWER: { rootCauseDomain: "Model/Prompt", actionClass: "PROMPT_TUNABLE", recommendation: "Review missing expected facts, context coverage, and synthesis instructions." },
  PROMPT_BEHAVIOR: { rootCauseDomain: "Model/Prompt", actionClass: "PROMPT_TUNABLE", recommendation: "Review the prompt instruction associated with the failed behavior." },
  MODEL_LIMITATION: { rootCauseDomain: "Model/Prompt", actionClass: "CONFIG_TUNABLE", recommendation: "Compare a bounded model candidate after evidence and prompt adequacy are confirmed." },
  TRACE_INCOMPLETE: { rootCauseDomain: "Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Instrument the missing pipeline stages before drawing a tuning conclusion." },
  EVALUATOR_FAILURE: { rootCauseDomain: "Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Restore or inspect the semantic evaluator; deterministic findings remain authoritative." },
  TIMEOUT: { rootCauseDomain: "Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Inspect the timed-out stage and its configured deadline." },
  BUDGET_EXCEEDED: { rootCauseDomain: "Code/Pipeline", actionClass: "CONFIG_TUNABLE", recommendation: "Reduce workload or obtain an explicit larger QA budget." },
  AUTHORIZATION_DENIED: { rootCauseDomain: "Code/Pipeline", actionClass: "CODE_CHANGE_REQUIRED", recommendation: "Verify actor, tenant, project, and role scope." },
  SIDE_EFFECT_DENIED: { rootCauseDomain: "Tools/Integrations", actionClass: "EXTERNAL_TOOL_PROBLEM", recommendation: "Use an approved read-only implementation, mock, or QA sandbox for this tool." }
});

export function taxonomyFor(code) {
  return FAILURE_TAXONOMY[code] || {
    rootCauseDomain: "Code/Pipeline",
    actionClass: "CODE_CHANGE_REQUIRED",
    recommendation: "Inspect the captured trace and evaluator evidence."
  };
}
