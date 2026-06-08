import { chatCompletion } from "./openrouter.js";

export const QA_SYSTEM_PROMPT = `You are a QA engineer analyzing a RAG pipeline run that received a dislike rating from the user.

You receive:
- user_message: the original question
- ai_response: the answer that was disliked
- workflow_log: JSON with nodes (pipeline steps), edges, activePrompts, and trace
- user_feedback (optional): a human description of what was wrong — treat this as the PRIMARY signal when present

Each node has: id, label, kind, status ("done"|"error"|"skipped"), input, output.
The reranker node output includes top_chunks: [{rank, hybrid_score, rerank_score, rerank_reason, text, url}]
workflow_log.activePrompts contains the live prompts for: classifier, main, lite, reranker, knowledge_planner

Your job:
1. Identify which pipeline step(s) caused the bad answer
2. Examine the retrieved chunks — were the right documents returned? were they ranked correctly?
3. Examine the active prompts — are there missing instructions that would have prevented this failure?
4. Give 2-4 concrete, actionable recommendations (cite specific prompt lines or chunk ranks when relevant)

Rules:
- Write every human-readable JSON value in Hebrew when the user's question is in Hebrew. Keep node IDs and technical identifiers unchanged.
- Be specific. Reference node IDs, chunk ranks, and actual prompt text when relevant.
- Do not invent problems. Only diagnose what is visible in the data.
- A skipped optional n8n tool is not automatically a failure. Include it as a root cause only when the run data shows it was required and likely contained evidence unavailable from the configured sources.
- Do not assign high severity merely because an optional tool was not configured.
- Separate retrieval failure from answer behavior: if the retrieved and reranked records lack the requested fact, identify retrieval/reranking as the primary cause. If the fact exists in the supplied records but the answer omits it, identify the main answer step.
- Recommendations must be grounded in this run. Avoid generic requests to "improve the algorithm" without naming the exact query, field, ranking signal, prompt instruction, or fallback to change.
- If the answer looks acceptable but the user disliked it anyway, say so with answer_quality: "acceptable".

Output ONLY valid JSON matching this exact schema:
{
  "summary": string,
  "root_cause_steps": string[],
  "overall_severity": "high" | "medium" | "low",
  "step_issues": [
    { "step": string, "label": string, "issue": string, "severity": "high" | "medium" | "low" }
  ],
  "recommendations": string[],
  "answer_quality": "irrelevant" | "hallucinated" | "incomplete" | "wrong_sources" | "acceptable",
  "confidence": "high" | "medium" | "low"
}`;

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

const TREND_SYSTEM_PROMPT = `You are a QA lead analyzing a batch of RAG pipeline failure reports.

You receive an array of QA reports, each containing: summary, root_cause_steps, step_issues, recommendations, answer_quality, confidence.

Your job:
1. Find the most common failure patterns across all reports
2. Rank pipeline steps by failure frequency
3. Identify systemic issues vs. one-off failures
4. Give 3-6 high-priority actionable recommendations to fix the most impactful problems

Output ONLY valid JSON:
{
  "total_reports": number,
  "top_failure_steps": [{ "step": string, "count": number, "pct": number }],
  "patterns": [{ "title": string, "description": string, "affected_reports": number }],
  "answer_quality_breakdown": { "irrelevant": number, "hallucinated": number, "incomplete": number, "wrong_sources": number, "acceptable": number },
  "recommendations": [{ "priority": "high"|"medium"|"low", "action": string, "target_step": string }],
  "overall_health": "critical"|"poor"|"fair"|"good"
}`;

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
