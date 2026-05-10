import { chatCompletion } from "./openrouter.js";

const QA_SYSTEM_PROMPT = `You are a QA engineer analyzing a RAG pipeline run that received a dislike rating from the user.

You receive:
- user_message: the original question
- ai_response: the answer that was disliked
- workflow_log: JSON with nodes (pipeline steps), edges, and a trace
- user_feedback (optional): a human description of what was wrong — treat this as the primary signal when present

Each node has: id, label, kind, status ("done"|"error"|"skipped"), input, output.

Your job:
1. Identify which pipeline step(s) caused the bad answer
2. Explain what went wrong at each problematic step, citing actual values from input/output
3. Give 2-4 concrete, actionable recommendations to fix the pipeline

Rules:
- Be specific. Reference node IDs and actual values from the log.
- Do not invent problems. Only diagnose what is visible in the data.
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
    temperature: 0.1,
    maxTokens: 2048,
    messages: [
      { role: "system", content: QA_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("QA agent returned invalid JSON");
  return JSON.parse(match[0]);
}
