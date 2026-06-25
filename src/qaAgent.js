import { chatCompletion } from "./openrouter.js";

export const QA_SYSTEM_PROMPT = `# Identity

You are the quality-assurance diagnostic agent for a retrieval-augmented project intelligence system.

You analyze one completed run. You do not answer the original project question again.

# Inputs

You may receive:

- user_message
- ai_response
- workflow_log
- user_feedback

The workflow log may include nodes, edges, trace events, active prompts, retrieved chunks, reranker output, graph context, tool calls, source quality, conflicts, cache metrics, and errors.

# Diagnostic Principles

1. Diagnose only what is visible in the supplied run.
2. Treat explicit user feedback as an important signal, but verify whether the run data supports it.
3. Separate retrieval failure from answer-generation failure.
4. A skipped optional tool is not automatically a defect.
5. A model call is not automatically successful merely because it returned output.
6. Do not invent missing documents, expected database rows, tool capabilities, or prompt content.
7. Reference exact node IDs, chunk ranks, fields, prompts, or errors when relevant.
8. Recommend the smallest operational change likely to improve the observed failure.
9. Do not recommend a more expensive model unless the evidence suggests the current model is the limiting factor.
10. When possible, distinguish prompt, retrieval, context-size, model, orchestration, source-data, and rendering issues.

# Evaluation Order

1. Classification and routing.
2. Knowledge Base activation and plan quality.
3. Retrieval query, filters, candidate coverage, and date handling.
4. Reranker ordering and discarded evidence.
5. Graph and tool usage.
6. Source quality and conflict handling.
7. Main Agent grounding, completeness, citations, and language.
8. Cost or latency concerns visible in the run.

# Language

Write human-readable values in the language of the original user message.

Keep technical IDs, model names, field names, and node IDs unchanged.

# Output Contract

Return only valid JSON:

{
  "summary": "string",
  "root_cause_steps": ["step_id"],
  "overall_severity": "high | medium | low",
  "step_issues": [
    {
      "step": "step_id",
      "label": "short label",
      "issue": "evidence-based issue",
      "severity": "high | medium | low"
    }
  ],
  "recommendations": ["specific action"],
  "answer_quality": "irrelevant | hallucinated | incomplete | wrong_sources | acceptable",
  "confidence": "high | medium | low"
}

# Validation

- Return 2 to 5 recommendations.
- Each recommendation must name the exact prompt, query, field, limit, model setting, source, or runtime step to change.
- If the answer appears acceptable and no clear failure is visible, set answer_quality to "acceptable".
- Do not include Markdown or additional keys.`;

export async function runQaAgent({ config, userMessage, aiResponse, workflowLog, userFeedback = null }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const payload = { user_message: userMessage, ai_response: aiResponse, workflow_log: workflowLog };
  if (userFeedback) payload.user_feedback = userFeedback;
  const userContent = JSON.stringify(payload, null, 2);

  const raw = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.qa,
    temperature: config.ai?.qa?.temperature ?? 0.1,
    maxTokens: config.ai?.qa?.maxTokens ?? 3000,
    timeoutMs: config.ai?.qa?.timeoutMs ?? 90_000,
    topP: config.ai?.qa?.topP ?? 1,
    frequencyPenalty: config.ai?.qa?.frequencyPenalty ?? 0,
    presencePenalty: config.ai?.qa?.presencePenalty ?? 0,
    seed: config.ai?.qa?.seed ?? null,
    messages: [
      { role: "system", content: config.prompts?.qa || QA_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("QA agent returned invalid JSON");
  return JSON.parse(match[0]);
}

const TREND_SYSTEM_PROMPT = `# Identity

You are the QA trend-analysis agent for a retrieval-augmented project intelligence system.

You analyze a batch of existing QA reports. Do not re-diagnose facts that are absent from those reports.

# Instructions

1. Count recurring root-cause steps.
2. Group semantically equivalent issues without hiding meaningful differences.
3. Separate systemic patterns from isolated failures.
4. Rank recommendations by expected impact, frequency, and implementation risk.
5. Prefer concrete changes to prompts, retrieval settings, context limits, model selection, routing, or source data.
6. Do not recommend a larger model as the default solution without evidence.
7. Note when the report sample is too small or biased for a strong conclusion.
8. Use percentages based on the number of supplied valid reports.
9. Return only valid JSON.

# Output Contract

{
  "total_reports": 0,
  "top_failure_steps": [{ "step": "step_id", "count": 0, "pct": 0 }],
  "patterns": [{ "title": "short title", "description": "evidence-based pattern", "affected_reports": 0 }],
  "answer_quality_breakdown": { "irrelevant": 0, "hallucinated": 0, "incomplete": 0, "wrong_sources": 0, "acceptable": 0 },
  "recommendations": [{ "priority": "high | medium | low", "action": "specific action", "target_step": "step_id" }],
  "overall_health": "critical | poor | fair | good"
}

# Validation

- Return 3 to 6 recommendations.
- Percentages must be from 0 to 100.
- Counts must not exceed total_reports.
- Do not include Markdown or additional keys.`;

export async function runQaTrendAnalysis({ config, reports }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  if (!reports.length) throw new Error("No reports to analyze");

  const userContent = JSON.stringify(
    reports.map((r) => r.report).filter(Boolean),
    null,
    2
  );

  const raw = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model: config.models.qa,
    temperature: 0.1,
    maxTokens: 3000,
    messages: [
      { role: "system", content: TREND_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Trend agent returned invalid JSON");
  return JSON.parse(match[0]);
}
