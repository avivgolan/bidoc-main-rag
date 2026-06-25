import { buildGraphSearchPayload, summarizeGraphContext } from "../projectGraph.js";
import {
  addDelayEventFinding,
  addDelayEventEvidence,
  addDelayEventGap,
  addDelayCostItem,
  addDelayScheduleActivity,
  createDelayClaimExport,
  createDelayScheduleVersion,
  createDelayEvent,
  fetchTimelineEvents,
  getDelayEventDetails,
  graphSearch,
  hybridSearch,
  linkDelayEventScheduleActivity,
  listDelayEvents,
  updateDelayEvent
} from "../supabase.js";
import { runMeetingEvidenceAgent } from "./meeting.js";

const DELAY_TERMS = [
  "עיכוב", "עיכובים", "איחור", "חסם", "חסמים", "תקוע", "ממתין", "לא אושר",
  "delay", "delayed", "late", "blocker", "blocked", "pending", "waiting", "hold"
];
const RESPONSIBILITY_PATTERNS = [
  /(?:באחריות|אחריות|responsible|responsibility)[:\s-]+([^.,;\n]{2,80})/i,
  /(?:ספק|קבלן|יועץ|מזמין)[:\s-]+([^.,;\n]{2,80})/i
];
const NOTICE_TERMS = ["notice", "notification", "warning", "alert", "×”×•×“×¢×”", "×”×ª×¨××”", "×”×•×“×¢×ª"];
const MITIGATION_TERMS = ["mitigation", "accelerat", "recover", "expedite", "×”×§×˜× ×ª", "×”××¦×”", "×¦×ž×¦×•×", "×”×©×œ×ž×”"];
const CONCURRENCY_TERMS = ["concurrent", "parallel", "overlap", "×ž×§×‘×™×œ", "×—×•×¤×£", "×‘×ž×§×‘×™×œ"];
const ATTACK_TERMS = ["critical", "float", "late notice", "double count", "× ×ª×™×‘ ×§×¨×™×˜×™", "×ž×¨×•×•×—", "×›×¤×•×œ", "××™×—×•×¨ ×§×•×“×"];
const COST_PATTERN = /(?:(₪|ILS|NIS|USD|\$|€|EUR)\s*)?(\d[\d,]*(?:\.\d+)?)\s*(₪|ILS|NIS|USD|\$|€|EUR)?/gi;

export async function runDelayClaimAnalysis({
  config,
  caseId,
  projectId = null,
  dateFrom = null,
  dateTo = null,
  focusQuery = "",
  sources = [],
  runId = null,
  emit = null
}) {
  const trace = [];
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: new Date().toISOString(), data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };

  const sourceMap = await mapDelaySources({ config, projectId, dateFrom, dateTo, focusQuery, sources });
  step("source_mapping", "Delay source mapping completed", {
    records: sourceMap.records.length,
    hybridRecords: sourceMap.hybridRecords.length,
    timelineEvents: sourceMap.timelineEvents.length,
    graphRelations: sourceMap.graphContext.length
  });

  const chronology = buildDelayChronology(sourceMap.records, { dateFrom, dateTo });
  step("chronology", "Delay chronology built", {
    items: chronology.items.length,
    dateFrom: chronology.dateFrom,
    dateTo: chronology.dateTo
  });

  const candidates = detectDelayEventCandidates({ records: sourceMap.records, chronology, focusQuery });
  step("delay_detection", "Delay event candidates detected", {
    candidates: candidates.length,
    weakCandidates: candidates.filter((item) => item.weak_candidate).length
  });

  const merged = mergeDelayEventCandidates(candidates);
  step("event_merge", "Delay event candidates merged", {
    before: candidates.length,
    after: merged.length,
    contradictions: merged.reduce((sum, item) => sum + item.contradictions.length, 0)
  });

  const withEvidence = await collectDelayEvidence({ config, candidates: merged, dateFrom, dateTo });
  step("evidence_collection", "Delay evidence collected", {
    candidates: withEvidence.length,
    evidence: withEvidence.reduce((sum, item) => sum + item.evidence.length, 0),
    meetingEvidence: withEvidence.reduce((sum, item) => sum + item.meetingEvidence.length, 0)
  });

  const withGaps = detectDelayGapsAndContradictions(withEvidence);
  step("gaps_contradictions", "Delay gaps and contradictions checked", {
    gaps: withGaps.reduce((sum, item) => sum + item.gaps.length, 0),
    contradictions: withGaps.reduce((sum, item) => sum + item.contradictions.length, 0)
  });

  const saved = await writeDelayAnalysisResults({ config, caseId, candidates: withGaps });
  step("write_results", "Delay analysis results written", saved);

  return {
    ok: true,
    caseId,
    runId,
    sourceMap: {
      records: sourceMap.records.length,
      hybridRecords: sourceMap.hybridRecords.length,
      timelineEvents: sourceMap.timelineEvents.length,
      graphContext: sourceMap.graphContext.length
    },
    chronology,
    candidates: withGaps,
    saved,
    workflowLog: buildDelayClaimWorkflowLog({ sourceMap, chronology, candidates, merged, withEvidence, withGaps, saved, trace }),
    trace
  };
}

export async function runDelayEventDeepAnalysis({ config, eventId, runId = null, emit = null }) {
  const trace = [];
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: new Date().toISOString(), data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };

  const event = await getDelayEventDetails({ config, eventId });
  if (!event) throw new Error("Delay event not found");
  const context = buildEventAnalysisContext(event);

  const causality = analyzeCausality(context);
  step("causality_agent", "Causality chain checked", { confidence: causality.confidence, evidence: causality.evidence_ids.length });

  const notice = analyzeNoticeStatus(context);
  step("notice_agent", "Notice and warning signals checked", { confidence: notice.confidence, status: notice.metadata.notice_status });

  const responsibility = analyzePossibleResponsibility(context);
  step("responsibility_agent", "Possible responsibility signals checked", { confidence: responsibility.confidence });

  const concurrency = analyzeConcurrentDelays(context);
  step("concurrency_agent", "Concurrent delay signals checked", { confidence: concurrency.confidence });

  const mitigation = analyzeMitigation(context);
  step("mitigation_agent", "Mitigation and acceleration signals checked", { confidence: mitigation.confidence });

  const attack = analyzeAttackRisk(context, { notice, concurrency });
  step("attack_agent", "Counter-arguments and attack risk checked", { risk: attack.metadata.attack_risk, confidence: attack.confidence });

  const readiness = analyzeReadiness(context, { causality, notice, responsibility, concurrency, mitigation, attack });
  step("readiness_agent", "Readiness score calculated", { readiness_score: readiness.metadata.readiness_score, confidence: readiness.confidence });

  const quality = analyzeQuality(context, { readiness, attack });
  step("quality_agent", "Quality checks completed", { issues: quality.metadata.issues.length, confidence: quality.confidence });

  const findings = [causality, notice, responsibility, concurrency, mitigation, attack, readiness, quality];
  const saved = { findings: 0, findingIds: [], readiness_score: readiness.metadata.readiness_score };
  for (const finding of findings) {
    const savedFinding = await addDelayEventFinding({ config, eventId, finding });
    saved.findings += 1;
    saved.findingIds.push(savedFinding.id);
  }

  await updateDelayEvent({
    config,
    eventId,
    changedBy: "delay_event_deep_analysis",
    patch: {
      readiness_score: readiness.metadata.readiness_score,
      metadata: {
        ...(event.metadata || {}),
        stage3_analysis: {
          analyzed_at: new Date().toISOString(),
          attack_risk: attack.metadata.attack_risk,
          professional_review_required: quality.metadata.professional_review_required,
          finding_ids: saved.findingIds
        }
      }
    }
  });
  step("write_results", "Deep analysis findings written", saved);

  return {
    ok: true,
    eventId,
    caseId: event.case_id,
    runId,
    analysis: {
      causality_chain: causality,
      notice_status: notice,
      possible_responsibility: responsibility,
      concurrent_delays: concurrency,
      mitigation_actions: mitigation,
      acceleration_indicators: mitigation.metadata.acceleration_indicators,
      counter_arguments: attack,
      contractor_possible_response: attack.metadata.contractor_possible_response,
      readiness_score: readiness.metadata.readiness_score,
      attack_risk: attack.metadata.attack_risk,
      professional_review_required: quality.metadata.professional_review_required,
      quality
    },
    saved,
    workflowLog: buildDelayEventAnalysisWorkflowLog({ event, findings, saved, trace }),
    trace
  };
}

export async function runDelayClaimPackageAnalysis({
  config,
  caseId,
  contractualCompletionDate = null,
  actualCompletionDate = null,
  exportType = "markdown",
  runId = null,
  emit = null
}) {
  const trace = [];
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: new Date().toISOString(), data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };

  const events = await listDelayEvents({ config, caseId, limit: 500 });
  const approvedEvents = events.filter((event) => event.human_status === "approved");
  step("schedule_analysis_agent", "Schedule analysis input loaded", {
    events: events.length,
    approvedEvents: approvedEvents.length
  });

  const schedule = buildScheduleAnalysis({ caseId, events, contractualCompletionDate, actualCompletionDate });
  const savedSchedule = await writeScheduleAnalysis({ config, caseId, schedule });
  step("schedule_analysis_agent_write", "Schedule analysis saved", savedSchedule);

  const costs = buildCostDamageAnalysis({ caseId, events });
  const savedCosts = await writeCostAnalysis({ config, costs });
  step("cost_damage_agent", "Cost and damage signals checked", {
    costItems: costs.items.length,
    saved: savedCosts.costItems,
    duplicateRisks: costs.items.filter((item) => item.duplicate_risk).length
  });

  const output = buildClaimOutput({ caseId, events, schedule, costs, savedSchedule, savedCosts, exportType });
  const savedExport = await createDelayClaimExport({ config, claimExport: output.exportRow });
  step("claim_output_agent", "Claim output generated", {
    exportId: savedExport.id,
    exportType: savedExport.export_type,
    warnings: output.warnings.length
  });

  return {
    ok: true,
    caseId,
    runId,
    dashboard: output.dashboard,
    schedule,
    costs,
    export: savedExport,
    warnings: output.warnings,
    saved: {
      ...savedSchedule,
      ...savedCosts,
      exportId: savedExport.id
    },
    workflowLog: buildDelayClaimPackageWorkflowLog({ events, schedule, costs, output, savedExport, trace }),
    trace
  };
}

export async function mapDelaySources({ config, projectId = null, dateFrom = null, dateTo = null, focusQuery = "", sources = [] }) {
  const query = String(focusQuery || "").trim() || "עיכוב חסם איחור delay blocker pending approval";
  const requestedSources = normalizeRequestedSources(sources);
  const hybridRows = requestedSources.includes("hybrid")
    ? await hybridSearch({
        config,
        query,
        dateFrom,
        dateTo,
        hashtags: [],
        topK: Math.min(Math.max(Number(config.retrieval?.candidates || 20), 10), 50)
      }).catch(() => [])
    : [];
  const timelineRows = requestedSources.includes("timeline")
    ? await fetchTimelineEvents({ config, limit: 1000 }).catch(() => [])
    : [];
  const normalizedHybrid = normalizeSourceRows(hybridRows, "hybrid").filter((row) => !projectId || row.project_id === projectId || row.metadata?.project_id === projectId);
  const normalizedTimeline = normalizeSourceRows(timelineRows, "timeline").filter((row) => rowWithinRange(row, dateFrom, dateTo));
  const records = uniqueRecords([...normalizedHybrid, ...normalizedTimeline]);
  const graphPayload = buildGraphSearchPayload({ query, records: records.slice(0, 40), maxRows: 30 });
  const graph = requestedSources.includes("graph")
    ? await graphSearch({ config, payload: graphPayload, limit: 30 }).catch((error) => ({ skipped: true, error: error.message, results: [] }))
    : { skipped: true, results: [] };
  return {
    query,
    records,
    hybridRecords: normalizedHybrid,
    timelineEvents: normalizedTimeline,
    graph,
    graphContext: summarizeGraphContext(graph, 20)
  };
}

export function buildDelayChronology(records = [], { dateFrom = null, dateTo = null } = {}) {
  const items = records
    .map((record) => ({
      id: record.id,
      date: normalizeDate(record.date || record.primary_date || record.created_at),
      title: record.title || record.summary || record.content.slice(0, 90),
      source_type: record.source_type,
      source_id: record.source_id || record.id,
      text: record.content
    }))
    .filter((item) => item.date && rowWithinRange(item, dateFrom, dateTo))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return {
    dateFrom: items[0]?.date || dateFrom || null,
    dateTo: items.at(-1)?.date || dateTo || null,
    items
  };
}

export function detectDelayEventCandidates({ records = [], chronology = { items: [] }, focusQuery = "" } = {}) {
  const queryTerms = tokenize(focusQuery);
  return records
    .map((record) => candidateFromRecord(record, chronology, queryTerms))
    .filter(Boolean)
    .slice(0, 30);
}

export function mergeDelayEventCandidates(candidates = []) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = mergeKey(candidate);
    if (!groups.has(key)) {
      groups.set(key, { ...candidate, source_records: [...candidate.source_records], evidence: [...candidate.evidence], contradictions: [] });
      continue;
    }
    const current = groups.get(key);
    const datesConflict = current.start_date && candidate.start_date && Math.abs(Date.parse(current.start_date) - Date.parse(candidate.start_date)) > 1000 * 60 * 60 * 24 * 21;
    if (datesConflict) {
      current.contradictions.push({
        type: "date_conflict",
        message: "Candidate dates are far apart; kept as a contradiction instead of a silent merge.",
        source_ids: [current.source_records[0]?.id, candidate.source_records[0]?.id].filter(Boolean)
      });
    }
    current.source_records.push(...candidate.source_records);
    current.evidence.push(...candidate.evidence);
    current.confidence = Math.max(current.confidence, candidate.confidence);
    current.readiness_score = Math.max(current.readiness_score || 0, candidate.readiness_score || 0);
    if (!current.end_date && candidate.end_date) current.end_date = candidate.end_date;
    if (!current.alleged_responsible_party && candidate.alleged_responsible_party) current.alleged_responsible_party = candidate.alleged_responsible_party;
  }
  return [...groups.values()].map((candidate) => ({
    ...candidate,
    source_records: uniqueRecords(candidate.source_records),
    evidence: uniqueEvidence(candidate.evidence)
  }));
}

export async function collectDelayEvidence({ config, candidates = [], dateFrom = null, dateTo = null }) {
  const output = [];
  for (const candidate of candidates) {
    const meetingEvidence = await maybeCollectMeetingEvidence({ config, candidate, dateFrom, dateTo });
    const evidence = uniqueEvidence([
      ...candidate.evidence,
      ...meetingEvidence.map((item) => ({
        source_type: "meeting",
        external_source_id: item.chunk_id || item.attachment_id || item.meeting_id,
        quote: item.quote,
        source_url: item.source_url || null,
        what_it_supports: "Meeting evidence related to the candidate delay event.",
        supports_or_weakens: "supports",
        confidence: boundedConfidence(item.final_score ?? 0.62),
        metadata: {
          meeting_id: item.meeting_id,
          attachment_id: item.attachment_id,
          document_name: item.document_name,
          meeting_date: item.meeting_date,
          chunk_index: item.chunk_index
        }
      }))
    ]);
    output.push({ ...candidate, evidence, meetingEvidence });
  }
  return output;
}

export function detectDelayGapsAndContradictions(candidates = []) {
  return candidates.map((candidate) => {
    const gaps = [...(candidate.gaps || [])];
    if (!candidate.start_date) {
      gaps.push({
        missing_item: "תאריך התחלה מבוסס",
        why_it_matters: "אי אפשר לבנות כרונולוגיה אמינה בלי תאריך מקור.",
        urgency: "high",
        confidence: 0.8
      });
    }
    if (!candidate.evidence.some((item) => item.quote || item.excerpt)) {
      gaps.push({
        missing_item: "ציטוט או קטע מקור",
        why_it_matters: "האירוע נשאר מועמד חלש עד שיש ראיה מצוטטת.",
        urgency: "medium",
        confidence: 0.7
      });
    }
    if (!candidate.alleged_responsible_party) {
      gaps.push({
        missing_item: "גורם נטען",
        why_it_matters: "אין לקבוע אחריות, אך כדאי לזהות מי מופיע במקורות כגורם קשור.",
        urgency: "low",
        confidence: 0.55
      });
    }
    for (const contradiction of candidate.contradictions || []) {
      gaps.push({
        missing_item: "סתירה בין מקורות",
        why_it_matters: contradiction.message,
        urgency: "high",
        confidence: 0.85,
        metadata: contradiction
      });
    }
    return { ...candidate, gaps };
  });
}

async function writeDelayAnalysisResults({ config, caseId, candidates = [] }) {
  const saved = { events: 0, evidence: 0, gaps: 0, eventIds: [], skipped: 0 };
  for (const candidate of candidates) {
    if (!candidate.evidence.length && !candidate.weak_candidate) {
      saved.skipped += 1;
      continue;
    }
    const event = await createDelayEvent({ config, caseId, event: { ...candidate, human_status: "candidate" } });
    saved.events += 1;
    saved.eventIds.push(event.id);
    for (const evidence of candidate.evidence) {
      await addDelayEventEvidence({ config, eventId: event.id, evidence }).then(() => { saved.evidence += 1; });
    }
    for (const gap of candidate.gaps || []) {
      await addDelayEventGap({ config, eventId: event.id, gap }).then(() => { saved.gaps += 1; });
    }
  }
  return saved;
}

export function buildDelayClaimWorkflowLog({ sourceMap, chronology, candidates, merged, withEvidence, withGaps, saved, trace = [] }) {
  const nodes = [
    workflowNode("source_mapping", "Source Mapping", "database", "done", { query: sourceMap.query }, { records: sourceMap.records.length, graphContext: sourceMap.graphContext.slice(0, 5) }),
    workflowNode("chronology", "Chronology", "router", "done", { records: sourceMap.records.length }, { items: chronology.items.slice(0, 10), total: chronology.items.length }),
    workflowNode("delay_detection", "Delay Detection", "router", "done", { chronologyItems: chronology.items.length }, { candidates: candidates.map(compactCandidate) }),
    workflowNode("event_merge", "Event Merge", "router", "done", { candidates: candidates.length }, { merged: merged.map(compactCandidate) }),
    workflowNode("evidence_collection", "Evidence Collection", "database", "done", { candidates: merged.length }, { evidence: withEvidence.map((item) => ({ event_key: item.event_key, evidence: item.evidence.length, meetingEvidence: item.meetingEvidence.length })) }),
    workflowNode("gaps_contradictions", "Gaps & Contradictions", "router", "done", { candidates: withEvidence.length }, { gaps: withGaps.map((item) => ({ event_key: item.event_key, gaps: item.gaps.length, contradictions: item.contradictions.length })) }),
    workflowNode("write_results", "Write Results", "database", "done", { candidates: withGaps.length }, saved)
  ];
  return {
    nodes,
    edges: [
      ["source_mapping", "chronology"],
      ["chronology", "delay_detection"],
      ["delay_detection", "event_merge"],
      ["event_merge", "evidence_collection"],
      ["evidence_collection", "gaps_contradictions"],
      ["gaps_contradictions", "write_results"]
    ].map(([from, to]) => ({ from, to })),
    trace
  };
}

export function buildDelayEventAnalysisWorkflowLog({ event, findings = [], saved = {}, trace = [] }) {
  const byKey = new Map(findings.map((finding) => [finding.metadata?.analysis_key, finding]));
  const nodes = [
    workflowNode("causality_agent", "Causality Agent", "router", "done", { event_id: event.id }, byKey.get("causality_chain") || {}),
    workflowNode("notice_agent", "Notice Agent", "router", "done", { event_id: event.id }, byKey.get("notice_status") || {}),
    workflowNode("responsibility_agent", "Responsibility Agent", "router", "done", { event_id: event.id }, byKey.get("possible_responsibility") || {}),
    workflowNode("concurrency_agent", "Concurrency Agent", "router", "done", { event_id: event.id }, byKey.get("concurrent_delays") || {}),
    workflowNode("mitigation_agent", "Mitigation Agent", "router", "done", { event_id: event.id }, byKey.get("mitigation_actions") || {}),
    workflowNode("attack_agent", "Attack Agent", "router", "done", { event_id: event.id }, byKey.get("counter_arguments") || {}),
    workflowNode("readiness_agent", "Readiness Agent", "database", "done", { event_id: event.id }, byKey.get("readiness_score") || {}),
    workflowNode("quality_agent", "Quality Agent", "router", "done", { event_id: event.id }, byKey.get("quality") || {}),
    workflowNode("write_results", "Write Results", "database", "done", { findings: findings.length }, saved)
  ];
  return {
    nodes,
    edges: [
      ["causality_agent", "notice_agent"],
      ["notice_agent", "responsibility_agent"],
      ["responsibility_agent", "concurrency_agent"],
      ["concurrency_agent", "mitigation_agent"],
      ["mitigation_agent", "attack_agent"],
      ["attack_agent", "readiness_agent"],
      ["readiness_agent", "quality_agent"],
      ["quality_agent", "write_results"]
    ].map(([from, to]) => ({ from, to })),
    trace
  };
}

export function buildDelayClaimPackageWorkflowLog({ events = [], schedule = {}, costs = {}, output = {}, savedExport = {}, trace = [] }) {
  const nodes = [
    workflowNode("schedule_analysis_agent", "Schedule Analysis Agent", "router", "done", { events: events.length }, schedule.summary || {}),
    workflowNode("cost_damage_agent", "Cost Damage Agent", "router", "done", { events: events.length }, { items: costs.items?.length || 0, warnings: costs.warnings || [] }),
    workflowNode("claim_output_agent", "Claim Output Agent", "database", "done", { export_type: savedExport.export_type || output.exportRow?.export_type }, { export_id: savedExport.id, dashboard: output.dashboard, warnings: output.warnings })
  ];
  return {
    nodes,
    edges: [
      ["schedule_analysis_agent", "cost_damage_agent"],
      ["cost_damage_agent", "claim_output_agent"]
    ].map(([from, to]) => ({ from, to })),
    trace
  };
}

export function buildDelayClaimDashboard({ events = [], schedule = {}, costs = {} }) {
  const strongEvents = events.filter((event) => Number(event.readiness_score ?? event.confidence ?? 0) >= 0.7);
  const weakEvents = events.filter((event) => Number(event.readiness_score ?? event.confidence ?? 0) < 0.45);
  const needsReview = events.filter((event) => event.human_status === "needs_review" || (event.gaps || []).length || (event.findings || []).some((finding) => finding.metadata?.professional_review_required));
  return {
    contractual_completion_date: schedule.contractualCompletionDate || null,
    actual_completion_date: schedule.actualCompletionDate || null,
    total_delay_days: schedule.totalDelayDays,
    total_events: events.length,
    strong_events: strongEvents.length,
    weak_events: weakEvents.length,
    needs_review_events: needsReview.length,
    missing_documents: events.reduce((sum, event) => sum + (event.gaps || []).length, 0),
    readiness_score: calculateClaimReadiness(events),
    cost_items: costs.items?.length || 0,
    cost_total_known: costs.totalKnown || 0,
    recommended_actions: recommendedClaimActions({ events, schedule, costs })
  };
}

function buildScheduleAnalysis({ caseId, events = [], contractualCompletionDate = null, actualCompletionDate = null }) {
  const totalDelayDays = contractualCompletionDate && actualCompletionDate
    ? Math.max(0, daysBetween(contractualCompletionDate, actualCompletionDate))
    : null;
  const activities = events
    .filter((event) => event.start_date || event.end_date)
    .map((event) => ({
      case_id: caseId,
      event_id: event.id,
      activity_key: `activity_${slug(event.event_key || event.id)}`,
      name: event.title || "Delay event activity",
      start_date: event.start_date || event.end_date || null,
      finish_date: event.end_date || event.start_date || null,
      duration_days: event.start_date && event.end_date ? daysBetween(event.start_date, event.end_date) + 1 : null,
      float_days: null,
      is_critical: null,
      confidence: boundedConfidence(Number(event.readiness_score ?? event.confidence ?? 0.35)),
      human_status: "candidate",
      metadata: {
        stage: 4,
        source_event_id: event.id,
        critical_path_impact_final: false,
        schedule_expert_required: true
      }
    }));
  return {
    caseId,
    contractualCompletionDate: normalizeDate(contractualCompletionDate),
    actualCompletionDate: normalizeDate(actualCompletionDate),
    totalDelayDays,
    activities,
    summary: {
      activities: activities.length,
      totalDelayDays,
      criticalPathImpact: "not_determined",
      floatStatus: "not_determined",
      scheduleExpertRequired: true
    },
    warnings: totalDelayDays == null
      ? ["חסרים תאריכי מסירה חוזיים/בפועל לצורך חישוב איחור כולל."]
      : ["חישוב האיחור הכולל הוא הפרש תאריכים בלבד ואינו קובע השפעה על נתיב קריטי."]
  };
}

async function writeScheduleAnalysis({ config, caseId, schedule }) {
  const version = await createDelayScheduleVersion({
    config,
    caseId,
    version: {
      version_key: `stage4_${Date.now()}`,
      title: "Stage 4 schedule review",
      contractual_completion_date: schedule.contractualCompletionDate,
      actual_completion_date: schedule.actualCompletionDate,
      confidence: schedule.totalDelayDays == null ? 0.35 : 0.55,
      metadata: { stage: 4, warnings: schedule.warnings, critical_path_impact_final: false }
    }
  });
  const saved = { scheduleVersions: 1, scheduleActivities: 0, scheduleLinks: 0, scheduleVersionId: version.id };
  for (const activity of schedule.activities) {
    const savedActivity = await addDelayScheduleActivity({ config, scheduleVersionId: version.id, activity: { ...activity, schedule_version_id: version.id } });
    saved.scheduleActivities += 1;
    await linkDelayEventScheduleActivity({
      config,
      link: {
        case_id: caseId,
        event_id: activity.event_id,
        schedule_activity_id: savedActivity.id,
        link_type: "review_required",
        explanation: "Event has date data and was linked for schedule expert review; critical path impact is not determined.",
        confidence: activity.confidence,
        metadata: { stage: 4, critical_path_impact_final: false }
      }
    });
    saved.scheduleLinks += 1;
  }
  return saved;
}

function buildCostDamageAnalysis({ caseId, events = [] }) {
  const raw = [];
  for (const event of events) {
    const texts = [
      event.title,
      event.short_description,
      event.contractor_claim,
      ...(event.evidence || []).map((item) => `${item.quote || ""} ${item.excerpt || ""} ${item.what_it_supports || ""}`),
      ...(event.findings || []).map((item) => `${item.title || ""} ${item.explanation || ""}`)
    ].filter(Boolean);
    for (const text of texts) {
      for (const match of String(text).matchAll(COST_PATTERN)) {
        const currency = normalizeCurrency(match[1] || match[3]);
        const amount = Number(String(match[2]).replace(/,/g, ""));
        if (!Number.isFinite(amount) || amount < 100) continue;
        raw.push({
          case_id: caseId,
          event_id: event.id,
          cost_key: `cost_${slug(`${event.id}_${currency || "amount"}_${amount}`)}`,
          title: `עלות אפשרית: ${event.title || event.event_key}`,
          cost_type: "estimate",
          amount,
          currency,
          explanation: "זוהה סכום במקורות האירוע. אין בכך קביעת זכאות כספית.",
          duplicate_risk: false,
          confidence: 0.45,
          human_status: "candidate",
          metadata: { stage: 4, final_entitlement: false }
        });
      }
    }
  }
  const seenCostKeys = new Set();
  const uniqueRaw = raw.filter((item) => {
    if (seenCostKeys.has(item.cost_key)) return false;
    seenCostKeys.add(item.cost_key);
    return true;
  });
  const seenAmounts = new Map();
  const items = uniqueRaw.map((item) => {
    const key = `${item.currency || ""}:${item.amount}`;
    const duplicate = seenAmounts.has(key);
    seenAmounts.set(key, true);
    return { ...item, duplicate_risk: duplicate };
  });
  return {
    items,
    totalKnown: items.reduce((sum, item) => sum + (item.duplicate_risk ? 0 : Number(item.amount || 0)), 0),
    warnings: items.length ? ["סכומי העלות הם אותות ראשוניים בלבד ואינם קובעים זכאות כספית."] : ["לא זוהו סכומי עלות מפורשים במקורות האירועים."]
  };
}

async function writeCostAnalysis({ config, costs }) {
  const saved = { costItems: 0 };
  for (const item of costs.items) {
    await addDelayCostItem({ config, cost: item });
    saved.costItems += 1;
  }
  return saved;
}

function buildClaimOutput({ caseId, events, schedule, costs, savedSchedule, savedCosts, exportType }) {
  const dashboard = buildDelayClaimDashboard({ events, schedule, costs });
  const warnings = [
    ...schedule.warnings,
    ...costs.warnings,
    "התוצר מיועד להכנת בדיקה לעורך דין/מומחה לו״ז ואינו קביעה סופית."
  ];
  const payload = {
    case_id: caseId,
    dashboard,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      status: event.human_status,
      readiness_score: event.readiness_score,
      evidence_count: (event.evidence || []).length,
      gaps_count: (event.gaps || []).length
    })),
    schedule: schedule.summary,
    costs: { items: costs.items.length, totalKnown: costs.totalKnown },
    warnings,
    saved: { ...savedSchedule, ...savedCosts }
  };
  const content = exportType === "json" ? JSON.stringify(payload, null, 2) : renderClaimMarkdown(payload);
  return {
    dashboard,
    warnings,
    exportRow: {
      case_id: caseId,
      export_key: `stage4_${exportType}_${Date.now()}`,
      export_type: exportType === "json" ? "json" : "markdown",
      title: "Delay claim preparation package",
      content,
      payload,
      human_status: "candidate",
      metadata: { stage: 4, final_legal_conclusion: false, final_cost_entitlement: false }
    }
  };
}

function renderClaimMarkdown(payload) {
  const lines = [
    "# Delay Claim Preparation Package",
    "",
    "## Dashboard",
    `- Total events: ${payload.dashboard.total_events}`,
    `- Strong events: ${payload.dashboard.strong_events}`,
    `- Weak events: ${payload.dashboard.weak_events}`,
    `- Needs review: ${payload.dashboard.needs_review_events}`,
    `- Readiness score: ${Math.round(payload.dashboard.readiness_score * 100)}%`,
    `- Total delay days: ${payload.dashboard.total_delay_days ?? "not determined"}`,
    "",
    "## Events",
    ...payload.events.map((event) => `- ${event.title} (${event.status}) - evidence: ${event.evidence_count}, gaps: ${event.gaps_count}, readiness: ${Math.round(Number(event.readiness_score || 0) * 100)}%`),
    "",
    "## Warnings",
    ...payload.warnings.map((warning) => `- ${warning}`)
  ];
  return lines.join("\n");
}

function calculateClaimReadiness(events) {
  if (!events.length) return 0;
  const average = events.reduce((sum, event) => sum + Number(event.readiness_score ?? event.confidence ?? 0), 0) / events.length;
  const approvedBoost = events.filter((event) => event.human_status === "approved").length / events.length * 0.12;
  return boundedConfidence(average + approvedBoost);
}

function recommendedClaimActions({ events, schedule, costs }) {
  const actions = [];
  if (schedule.totalDelayDays == null) actions.push("להזין מועד מסירה חוזי ומועד מסירה בפועל.");
  if (!(schedule.activities || []).length) actions.push("לקשר אירועים לפעילויות לו״ז או להעלות גרסת לו״ז.");
  if (!costs.items.length) actions.push("לאסוף מסמכי עלויות או אומדנים תומכים.");
  if (events.some((event) => (event.gaps || []).length)) actions.push("לסגור חוסרים וסתירות באירועים לפני הפקת תיק סופי.");
  if (!events.some((event) => event.human_status === "approved")) actions.push("לאשר אנושית אירועים חזקים לפני מעבר לתוצר חיצוני.");
  return actions;
}

function daysBetween(from, to) {
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / (1000 * 60 * 60 * 24));
}

function normalizeCurrency(value) {
  const token = String(value || "").toUpperCase();
  if (!token) return null;
  if (token === "$" || token === "USD") return "USD";
  if (token === "€" || token === "EUR") return "EUR";
  if (token === "₪" || token === "ILS" || token === "NIS") return "ILS";
  return token;
}

export function calculateDelayEventReadiness({ evidence = [], gaps = [], event = {}, attackRisk = "medium" } = {}) {
  const evidenceCount = evidence.length;
  const quotedEvidence = evidence.filter((item) => item.quote || item.excerpt).length;
  const weakeningEvidence = evidence.filter((item) => item.supports_or_weakens === "weakens").length;
  const highGaps = gaps.filter((item) => item.urgency === "high").length;
  let score = 0.2;
  score += Math.min(evidenceCount, 5) * 0.09;
  score += Math.min(quotedEvidence, 3) * 0.08;
  if (event.start_date) score += 0.08;
  if (event.end_date) score += 0.04;
  if (event.alleged_responsible_party) score += 0.06;
  score -= Math.min(gaps.length, 6) * 0.05;
  score -= highGaps * 0.07;
  score -= weakeningEvidence * 0.04;
  if (attackRisk === "high") score -= 0.12;
  if (attackRisk === "low") score += 0.05;
  return boundedConfidence(score);
}

function buildEventAnalysisContext(event) {
  const evidence = Array.isArray(event.evidence) ? event.evidence : [];
  const gaps = Array.isArray(event.gaps) ? event.gaps : [];
  const findings = Array.isArray(event.findings) ? event.findings : [];
  const evidenceText = evidence.map((item) => `${item.quote || ""} ${item.excerpt || ""} ${item.what_it_supports || ""}`).join("\n");
  const gapText = gaps.map((item) => `${item.missing_item || ""} ${item.why_it_matters || ""}`).join("\n");
  const eventText = `${event.title || ""}\n${event.short_description || ""}\n${event.contractor_claim || ""}\n${event.event_type || ""}\n${event.alleged_responsible_party || ""}`;
  const allText = `${eventText}\n${evidenceText}\n${gapText}`.toLowerCase();
  return { event, evidence, gaps, findings, eventText, evidenceText, gapText, allText };
}

function analyzeCausality(context) {
  const evidenceIds = supportingEvidenceIds(context.evidence, DELAY_TERMS);
  const hasDate = Boolean(context.event.start_date);
  const confidence = boundedConfidence(0.35 + Math.min(evidenceIds.length, 4) * 0.1 + (hasDate ? 0.1 : 0));
  return finding("causality_chain", "שרשרת סיבתיות", "analytical_conclusion", confidence, evidenceIds,
    evidenceIds.length
      ? "קיימות אינדיקציות מקוריות לאירוע עיכוב, אך הקשר הסיבתי נשאר מסקנה אנליטית ראשונית ודורש אימות מקצועי לפני קביעה סופית."
      : "אין מספיק ראיות ישירות לבניית שרשרת סיבתיות. האירוע נשאר מועמד חלש עד להוספת מקור תומך.",
    { causality_chain: evidenceIds.length ? "possible_causal_link" : "insufficient_basis", professional_review_required: true });
}

function analyzeNoticeStatus(context) {
  const evidenceIds = supportingEvidenceIds(context.evidence, NOTICE_TERMS);
  const status = evidenceIds.length ? "notice_indicated" : "notice_not_found";
  return finding("notice_status", "הודעות והתראות", evidenceIds.length ? "documented_fact" : "professional_review", evidenceIds.length ? 0.66 : 0.48, evidenceIds,
    evidenceIds.length
      ? "נמצאו סימנים להודעה או התראה במקורות המקושרים. נדרש לבדוק אם ההודעה עומדת בדרישות החוזה ובמועד."
      : "לא נמצאה ראיה ברורה להודעה בזמן במקורות הקיימים. זהו חוסר מהותי לבדיקה.",
    { notice_status: status, professional_review_required: !evidenceIds.length });
}

function analyzePossibleResponsibility(context) {
  const hasParty = Boolean(context.event.alleged_responsible_party);
  const evidenceIds = supportingEvidenceIds(context.evidence, [context.event.alleged_responsible_party, "responsible", "××—×¨×™×•×ª"].filter(Boolean));
  return finding("possible_responsibility", "אחריות אפשרית", "analytical_conclusion", hasParty ? 0.58 : 0.38, evidenceIds,
    hasParty
      ? `המקורות או העריכה האנושית מציינים גורם קשור: ${context.event.alleged_responsible_party}. אין לראות בכך קביעה משפטית סופית.`
      : "לא זוהה גורם נטען ברור. אין בסיס לייחוס אחריות מעבר לסימון חוסר לבדיקה.",
    { possible_responsibility: hasParty ? context.event.alleged_responsible_party : null, final_legal_responsibility: false, professional_review_required: true });
}

function analyzeConcurrentDelays(context) {
  const evidenceIds = supportingEvidenceIds(context.evidence, CONCURRENCY_TERMS);
  return finding("concurrent_delays", "עיכובים מקבילים", evidenceIds.length ? "analytical_conclusion" : "professional_review", evidenceIds.length ? 0.58 : 0.42, evidenceIds,
    evidenceIds.length
      ? "יש סימנים לעיכובים מקבילים או חופפים. אין לאחד השפעות או לספור ימים לפני בדיקת לו״ז מקצועית."
      : "לא נמצאו סימנים ברורים לעיכובים מקבילים במקורות הקיימים.",
    { concurrent_delays: evidenceIds.length ? "possible" : "not_identified", schedule_expert_required: evidenceIds.length });
}

function analyzeMitigation(context) {
  const evidenceIds = supportingEvidenceIds(context.evidence, MITIGATION_TERMS);
  const acceleration = /accelerat|expedite|×”××¦×”/.test(context.allText);
  return finding("mitigation_actions", "הקטנת נזק והאצה", evidenceIds.length ? "documented_fact" : "professional_review", evidenceIds.length ? 0.6 : 0.44, evidenceIds,
    evidenceIds.length
      ? "נמצאו סימנים לפעולות הקטנת נזק או האצה. יש לוודא מי יזם אותן ומה השפעתן בפועל."
      : "לא נמצאו פעולות הקטנת נזק או האצה במקורות המקושרים.",
    { mitigation_actions: evidenceIds.length ? "indicated" : "not_found", acceleration_indicators: acceleration ? "indicated" : "not_found" });
}

function analyzeAttackRisk(context, { notice, concurrency }) {
  const weakEvidence = context.evidence.filter((item) => item.supports_or_weakens === "weakens");
  const attackEvidenceIds = [...new Set([...supportingEvidenceIds(context.evidence, ATTACK_TERMS), ...weakEvidence.map((item) => item.id).filter(Boolean)])];
  const highGapCount = context.gaps.filter((item) => item.urgency === "high").length;
  const riskScore = attackEvidenceIds.length + highGapCount + (notice.metadata.notice_status === "notice_not_found" ? 1 : 0) + (concurrency.metadata.concurrent_delays === "possible" ? 1 : 0);
  const attackRisk = riskScore >= 3 ? "high" : riskScore === 2 ? "medium" : "low";
  return finding("counter_arguments", "תקיפת הטענה", "analytical_conclusion", attackRisk === "high" ? 0.72 : 0.56, attackEvidenceIds,
    "נבדקו נקודות תקיפה אפשריות: הודעה בזמן, Float, קריטיות, איחור קודם, חפיפה, ספירה כפולה וראיות מחלישות. אין בכך קביעה סופית אלא מפת סיכונים לבדיקה.",
    {
      attack_risk: attackRisk,
      contractor_possible_response: attackRisk === "high" ? "נדרש לחזק ציטוטים, הודעות בזמן וקישור ללוח הזמנים." : "הטענה ניתנת להמשך ביסוס, בכפוף לבדיקת מקורות ולו״ז.",
      checked: ["critical_path", "float", "prior_delay", "ready_front", "timely_notice", "double_count", "weakening_evidence"]
    });
}

function analyzeReadiness(context, { attack }) {
  const score = calculateDelayEventReadiness({ evidence: context.evidence, gaps: context.gaps, event: context.event, attackRisk: attack.metadata.attack_risk });
  return finding("readiness_score", "דירוג מוכנות", "calculation", 0.78, context.evidence.map((item) => item.id).filter(Boolean),
    `דירוג המוכנות חושב לפי מספר ראיות, ציטוטים, תאריכים, גורם נטען, חוסרים, ראיות מחלישות וסיכון תקיפה. הציון אינו קביעה משפטית או מקצועית סופית.`,
    { readiness_score: score, formula: "0.2 + evidence + quotes + dates + party - gaps - high_gaps - weakening_evidence +/- attack_risk" });
}

function analyzeQuality(context, { readiness, attack }) {
  const issues = [];
  if (!context.evidence.length) issues.push("claim_without_source");
  if (!context.event.start_date) issues.push("date_without_source");
  if (context.gaps.some((gap) => /×¡×ª×™×¨|contradiction/i.test(`${gap.missing_item} ${gap.why_it_matters}`))) issues.push("internal_contradiction");
  if (attack.metadata.checked?.includes("double_count") && /×›×¤×•×œ|double count/i.test(context.allText)) issues.push("possible_double_count");
  if (context.event.human_status !== "approved") issues.push("requires_human_approval");
  const professionalReviewRequired = issues.length > 0 || readiness.metadata.readiness_score < 0.7 || attack.metadata.attack_risk === "high";
  return finding("quality", "בקרת איכות", "professional_review", issues.length ? 0.7 : 0.62, context.evidence.map((item) => item.id).filter(Boolean),
    issues.length
      ? "נמצאו נקודות איכות שמחייבות בדיקה לפני שימוש בתיק תביעה."
      : "לא נמצאו כשלים בסיסיים, אך עדיין נדרשת בדיקה מקצועית לפני מסקנה סופית.",
    { issues, professional_review_required: professionalReviewRequired });
}

function finding(analysisKey, title, findingType, confidence, evidenceIds, explanation, metadata = {}) {
  return {
    finding_type: findingType,
    title,
    explanation,
    confidence: boundedConfidence(confidence),
    evidence_ids: evidenceIds,
    human_status: "candidate",
    metadata: { analysis_key: analysisKey, stage: 3, ...metadata }
  };
}

function supportingEvidenceIds(evidence = [], terms = []) {
  const normalizedTerms = terms.map((term) => String(term || "").toLowerCase()).filter(Boolean);
  if (!normalizedTerms.length) return [];
  return evidence
    .filter((item) => normalizedTerms.some((term) => `${item.quote || ""} ${item.excerpt || ""} ${item.what_it_supports || ""}`.toLowerCase().includes(term)))
    .map((item) => item.id)
    .filter(Boolean);
}

function candidateFromRecord(record, chronology, queryTerms) {
  const text = `${record.title || ""} ${record.content || ""}`.trim();
  const lower = text.toLowerCase();
  if (hasNegatedDelaySignal(lower)) return null;
  const termHits = DELAY_TERMS.filter((term) => lower.includes(term.toLowerCase()));
  const queryHit = queryTerms.length && queryTerms.some((term) => lower.includes(term));
  if (!termHits.length && !queryHit) return null;
  const date = normalizeDate(record.date || record.primary_date || record.created_at);
  const confidence = boundedConfidence(0.45 + Math.min(termHits.length * 0.08, 0.28) + (date ? 0.08 : 0));
  const sourceRecord = { ...record, content: record.content.slice(0, 1200) };
  return {
    event_key: stableEventKey(record, date),
    title: titleFromRecord(record, termHits),
    short_description: summarizeText(record.content || record.summary || record.title || "", 320),
    contractor_claim: summarizeText(record.content || "", 240),
    event_type: eventTypeFromText(lower),
    start_date: date,
    end_date: null,
    alleged_responsible_party: extractResponsibleParty(text),
    confidence,
    readiness_score: confidence >= 0.72 ? 0.45 : 0.25,
    human_status: "candidate",
    weak_candidate: confidence < 0.55,
    metadata: {
      stage: 2,
      detected_terms: termHits,
      source_count: 1,
      source_type: record.source_type
    },
    source_records: [sourceRecord],
    evidence: [{
      source_type: record.source_type,
      external_source_id: record.source_id || record.id,
      source_url: record.source_url || record.url || record.metadata?.source_url || record.metadata?.url || null,
      quote: quoteFromText(record.content),
      excerpt: summarizeText(record.content || record.title || "", 500),
      what_it_supports: "Source mentions a possible project delay, blocker, pending approval, or late dependency.",
      supports_or_weakens: "supports",
      confidence,
      metadata: {
        source_table: record.source_table,
        primary_date: date,
        title: record.title
      }
    }],
    gaps: [],
    contradictions: []
  };
}

async function maybeCollectMeetingEvidence({ config, candidate, dateFrom, dateTo }) {
  const hasMeetingSource = candidate.source_records.some((record) => /meeting/i.test(record.source_table || record.source_type || record.metadata?.source_table || ""));
  const shouldSearchMeeting = hasMeetingSource || /ישיב|meeting|minutes/i.test(`${candidate.title} ${candidate.short_description}`);
  if (!shouldSearchMeeting) return [];
  const result = await runMeetingEvidenceAgent({
    query: `${candidate.title}\n${candidate.short_description}`,
    keywords: DELAY_TERMS,
    dateFrom,
    dateTo,
    requireQuote: true
  }).catch(() => null);
  return result?.evidence || [];
}

function normalizeRequestedSources(sources) {
  const values = Array.isArray(sources) && sources.length ? sources : ["hybrid", "timeline", "graph"];
  const allowed = new Set(["hybrid", "timeline", "graph"]);
  return [...new Set(values.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
}

function normalizeSourceRows(value, sourceType) {
  const rows = Array.isArray(value) ? value : value?.data || value?.results || [];
  return rows.map((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const content = String(row.content || row.index_text || row.summary || row.title || row.text || metadata.summary || metadata.content || "");
    return {
      ...row,
      id: String(row.id || row.source_id || metadata.source_id || `${sourceType}_${Math.random().toString(16).slice(2)}`),
      source_id: String(row.source_id || metadata.source_id || row.id || ""),
      source_type: sourceType,
      source_table: row.source_table || metadata.source_table || sourceType,
      source_url: row.source_url || row.url || metadata.source_url || metadata.url || null,
      project_id: row.project_id || metadata.project_id || null,
      title: row.title || metadata.title || content.slice(0, 90),
      content,
      date: normalizeDate(row.primary_date || row.data_date || row.date || row.created_at || metadata.primary_date || metadata.date),
      metadata
    };
  }).filter((row) => row.content || row.title);
}

function rowWithinRange(row, dateFrom, dateTo) {
  const date = normalizeDate(row.date || row.primary_date || row.created_at);
  if (!date) return true;
  const time = Date.parse(date);
  if (dateFrom && time < Date.parse(dateFrom)) return false;
  if (dateTo && time > Date.parse(dateTo)) return false;
  return true;
}

function normalizeDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function tokenize(value) {
  return String(value || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length > 2);
}

function eventTypeFromText(lower) {
  if (/אישור|approve|approval|pending/.test(lower)) return "approval_delay";
  if (/חסר|missing|information|מידע/.test(lower)) return "missing_information";
  if (/ספק|supplier|vendor|קבלן/.test(lower)) return "supplier_blocker";
  return "delay_candidate";
}

function titleFromRecord(record, termHits) {
  const base = String(record.title || record.summary || record.content || "אירוע עיכוב מועמד").replace(/\s+/g, " ").trim();
  const title = base.length > 90 ? `${base.slice(0, 87)}...` : base;
  return title || `אירוע עיכוב מועמד${termHits[0] ? `: ${termHits[0]}` : ""}`;
}

function summarizeText(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function quoteFromText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const sentence = text.split(/(?<=[.!?])\s+/).find((part) => DELAY_TERMS.some((term) => part.toLowerCase().includes(term.toLowerCase())));
  return summarizeText(sentence || text, 500);
}

function extractResponsibleParty(text) {
  for (const pattern of RESPONSIBILITY_PATTERNS) {
    const match = String(text || "").match(pattern);
    if (match?.[1]) return summarizeText(match[1], 80);
  }
  return null;
}

function stableEventKey(record, date) {
  return `delay_event_${slug([date, record.source_table, record.source_id || record.id, record.title].filter(Boolean).join("_"))}`;
}

function mergeKey(candidate) {
  return slug(candidate.title).slice(0, 64);
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || `item_${Date.now()}`;
}

function boundedConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function hasNegatedDelaySignal(lower) {
  return /(?:ללא|אין|לא נמצאו|no|without)\s+(?:חסם|חסמים|עיכוב|עיכובים|איחור|delay|blocker|blocked)/i.test(lower);
}

function uniqueRecords(records = []) {
  return [...new Map(records.map((record) => [`${record.source_table || record.source_type}:${record.source_id || record.id}`, record])).values()];
}

function uniqueEvidence(items = []) {
  return [...new Map(items.map((item) => [`${item.source_type}:${item.external_source_id || item.source_id || ""}:${item.quote || item.excerpt || item.what_it_supports}`, item])).values()];
}

function compactCandidate(candidate) {
  return {
    event_key: candidate.event_key,
    title: candidate.title,
    start_date: candidate.start_date,
    confidence: candidate.confidence,
    evidence: candidate.evidence?.length || 0,
    weak_candidate: Boolean(candidate.weak_candidate)
  };
}

function workflowNode(id, label, kind, status, input, output) {
  return { id, label, kind, status, input: compactWorkflowLog(input), output: compactWorkflowLog(output) };
}

function compactWorkflowLog(value) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= 5000) return value;
  return { preview: `${text.slice(0, 5000)}...`, truncated: true };
}
