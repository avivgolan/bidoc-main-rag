// Root Cause Hypothesis Engine (upgrade plan section 26, priority P9).
// Produces causal HYPOTHESES only — never confirmed causes. Every output is forced
// to classification "inference" with requires_validation: true by code, regardless
// of what the model returns. Returning no hypothesis is a valid outcome.

import { chatCompletion, extractJsonObject } from "../openrouter.js";

const HYPOTHESIS_VERSION = "root-cause-hypothesis-v1";
const CANDIDATE_LOOKBACK_DAYS = 30;
const MAX_PATTERNS = 2;
const MAX_HYPOTHESES_PER_PATTERN = 2;

const CATEGORY_RULES = [
  { category: "planning", pattern: /תכנון|תוכנית|תכניות|design|planning/i },
  { category: "procurement", pattern: /רכש|הזמנה|הזמנות|ספק|אספקה|procurement|supplier|purchase/i },
  { category: "coordination", pattern: /תיאום|coordination|סנכרון/i },
  { category: "decisions", pattern: /החלטה|הוחלט|לא הוחלט|טרם הוחלט|decision/i },
  { category: "approval", pattern: /אישור|אישורים|היתר|approval|permit/i },
  { category: "information_gap", pattern: /חסר|מידע|לא התקבל|לא נשלח|missing|information/i },
  { category: "manpower", pattern: /כוח אדם|עובדים|צוות|פועלים|manpower|crew|staff/i },
  { category: "execution", pattern: /ביצוע|עבודות|execution/i },
  { category: "external_dependency", pattern: /רשות|עירייה|חברת חשמל|תאגיד|external|authority|utility/i }
];

// Deterministic step: for a detected pattern's cluster, gather evidence from OTHER
// clusters that shares a hashtag and chronologically precedes the pattern (within a
// bounded lookback). These are candidate contributing factors, not proof.
export function collectRootCauseCandidates({ pattern, clusters = [], evidence = [] } = {}) {
  const cluster = clusters.find((item) => item.cluster_id === pattern?.cluster_id);
  if (!cluster || !cluster.first_date) return [];
  const clusterTags = new Set((cluster.hashtags || []).map((tag) => String(tag).toLowerCase()));
  const clusterEvidenceIds = new Set(cluster.evidence_ids || []);
  const windowStart = shiftDate(cluster.first_date, -CANDIDATE_LOOKBACK_DAYS);

  return evidence
    .filter((item) => !clusterEvidenceIds.has(item.evidence_id))
    .filter((item) => item.event_date && item.event_date >= windowStart && item.event_date <= cluster.first_date)
    .filter((item) => (item.hashtags || []).some((tag) => clusterTags.has(String(tag).toLowerCase())))
    .map((item) => ({
      evidence_id: item.evidence_id,
      event_date: item.event_date,
      category: classifyCauseCategory(`${item.subject} ${item.text}`),
      subject: item.subject,
      text: String(item.text || "").slice(0, 240),
      status: item.status,
      evidence_type: item.evidence_type
    }))
    .sort((a, b) => (a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : a.evidence_id.localeCompare(b.evidence_id)))
    .slice(0, 12);
}

export function classifyCauseCategory(text = "") {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(String(text || ""))) return rule.category;
  }
  return "unclassified";
}

// Code-side validation of model output: enforce the inference contract, drop
// hypotheses whose supporting evidence ids were invented, cap the count.
export function validateRootCauseHypotheses(rawItems, { patternId = null, validEvidenceIds = new Set() } = {}) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((item, index) => {
      const supporting = (Array.isArray(item?.supporting_evidence_ids) ? item.supporting_evidence_ids : [])
        .map((id) => String(id || "").trim())
        .filter((id) => validEvidenceIds.has(id));
      const text = String(item?.hypothesis || "").trim();
      if (!text || !supporting.length) return null;
      return {
        hypothesis_id: `hypothesis-${patternId || "pattern"}-${index + 1}`,
        hypothesis_version: HYPOTHESIS_VERSION,
        pattern_id: patternId,
        hypothesis: text,
        classification: "inference",
        category: classifyCauseCategory(text) === "unclassified" ? String(item?.category || "unclassified") : classifyCauseCategory(text),
        supporting_evidence_ids: supporting,
        counter_evidence_ids: (Array.isArray(item?.counter_evidence_ids) ? item.counter_evidence_ids : [])
          .map((id) => String(id || "").trim())
          .filter((id) => validEvidenceIds.has(id)),
        alternative_hypotheses: (Array.isArray(item?.alternative_hypotheses) ? item.alternative_hypotheses : [])
          .map((alt) => String(alt || "").trim())
          .filter(Boolean)
          .slice(0, 3),
        missing_evidence: (Array.isArray(item?.missing_evidence) ? item.missing_evidence : [])
          .map((gap) => String(gap || "").trim())
          .filter(Boolean)
          .slice(0, 3),
        confidence: ["high", "medium", "low"].includes(String(item?.confidence || "").toLowerCase())
          ? String(item.confidence).toLowerCase()
          : "low",
        requires_validation: true,
        status: "candidate"
      };
    })
    .filter(Boolean)
    .slice(0, MAX_HYPOTHESES_PER_PATTERN);
}

// Orchestrator: deterministic candidates first, then one lite-LLM call per pattern
// (max 2 patterns). "no_supported_hypothesis" is an accepted model answer.
export async function generateRootCauseHypotheses({ config, patterns = [], clusters = [], evidence = [], runId = null, emit = null } = {}) {
  const targets = patterns
    .filter((item) => ["unfulfilled_commitment", "persistent_open_issue", "status_deterioration"].includes(item.type))
    .sort((a, b) => (b.evidence_ids?.length || 0) - (a.evidence_ids?.length || 0))
    .slice(0, MAX_PATTERNS);
  if (!targets.length || !config?.openRouterApiKey) return [];

  const results = [];
  for (const pattern of targets) {
    const candidates = collectRootCauseCandidates({ pattern, clusters, evidence });
    if (!candidates.length) continue;
    const cluster = clusters.find((item) => item.cluster_id === pattern.cluster_id);
    try {
      const content = await chatCompletion({
        apiKey: config.openRouterApiKey,
        model: config.models?.lite || config.models?.classifier || "openai/gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 1200,
        timeoutMs: 45_000,
        responseFormat: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You generate root-cause HYPOTHESES for a construction-project issue pattern.",
              "You are given the pattern, its cluster timeline, and candidate contributing factors (evidence that preceded the pattern).",
              "Rules:",
              "- A hypothesis is an inference, never a confirmed cause. Chronological order alone does not prove causation.",
              "- Use ONLY the provided candidates as supporting evidence; cite their evidence_id values.",
              "- Include missing_evidence: what would confirm or refute the hypothesis.",
              "- Include alternative_hypotheses when plausible.",
              "- If no candidate plausibly explains the pattern, return {\"no_supported_hypothesis\":true}.",
              "- At most 2 hypotheses. Hebrew for hypothesis text. Return ONLY valid JSON.",
              "Schema: {\"hypotheses\":[{\"hypothesis\":\"string\",\"category\":\"string\",\"supporting_evidence_ids\":[\"ev-1\"],\"counter_evidence_ids\":[],\"alternative_hypotheses\":[\"string\"],\"missing_evidence\":[\"string\"],\"confidence\":\"high|medium|low\"}]} or {\"no_supported_hypothesis\":true}"
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({
              pattern: { type: pattern.type, details: pattern.details, cluster_topic: cluster?.topic || null },
              cluster_timeline: (cluster?.timeline || []).slice(-6),
              candidates
            }, null, 2)
          }
        ]
      });
      const parsed = extractJsonObject(content);
      if (parsed?.no_supported_hypothesis) {
        emit?.(runId, "root_cause_hypotheses", `No supported hypothesis for ${cluster?.topic || pattern.type}`, { pattern: pattern.pattern_id, status: "done" });
        continue;
      }
      const validated = validateRootCauseHypotheses(parsed?.hypotheses, {
        patternId: pattern.pattern_id,
        validEvidenceIds: new Set(candidates.map((item) => item.evidence_id))
      });
      results.push(...validated);
    } catch (error) {
      emit?.(runId, "root_cause_hypotheses", "Root-cause hypothesis generation failed", { pattern: pattern.pattern_id, error: error.message, status: "warning" });
    }
  }
  return results;
}

function shiftDate(date, days) {
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Date(parsed.getTime() + days * 86400000).toISOString().slice(0, 10);
}
