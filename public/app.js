import {
  adjacentTimelineRange,
  buildTimelineEventsUrl,
  canCommitTimelineRequest,
  isTimelineAbortError,
  isTimelineRangeCovered,
  isTimelineTimeoutError,
  mergeTimelineEvents,
  mergeTimelineRanges,
  normalizeTimelineOrigins,
  timelineMonthRange,
  timelineOriginSignature,
  timelineRangeKey,
  toggleTimelineOriginSelection
} from "./timelineData.js?v=20260621-origin1";
import {
  createTimelineSearchController,
  timelineEventMatchesQuery
} from "./timelineSearch.js?v=20260610-uifix2";
import {
  calDaysInMonth, calClampDay, calDateKey,
  calNavigateByDays, calNavigateByMonths, calWeekBoundary
} from "./calendarHelpers.js?v=20260610-cal1";

const SUB_AGENTS = [
  {
    id: "alert",
    label: "סוכן התראות",
    description: "מאחזר התראות ובעיות קריטיות פתוחות מבסיס הנתונים. תומך בחיפוש סמנטי ובסינון לפי תאריך.",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    endpoint: "/api/subagents/alert",
    defaults: {
      table: "alerts_embeddings_gf",
      model: "openai/gpt-4o",
      systemPrompt: `# סוכן התראות — מצב אחזור מהיר\n\n## זהות\nאתה סוכן משנה שמאחזר התראות פרויקט ובעיות קריטיות פתוחות.\nהחזר נתונים יעיל. ללא הקדמות, ללא סיכומים, ללא מילוי.\n\n## פורמט פלט\nפלט רשימה בלבד. ללא טקסט הקדמה.\n\n* [התראה] <תאריך> — <סוג_התראה>\n  * תיאור: <תיאור>\n  * סטטוס: <סטטוס>\n  * עדיפות: <עדיפות>\n  * מקור: <קישור אם קיים, אחרת ->\n\n## Fallback\nאם לא נמצאו נתונים: "לא נמצאו התראות רלוונטיות."`
    }
  },
];

// Specialist content agents (spec B2) — each agent searches ITS OWN Content-DB
// table (vector + text), runs domain analysis, and returns a phrased answer.
// Settings live under settings.subagents.contentTools.perTool.<id>.
const CONTENT_TOOL_CARDS = [
  { id: "meetings", label: "סוכן פגישות פנימי", sourceTable: "meetings", desc: "מומחה פגישות: חיפוש במאגר הפגישות + ניתוח החלטות, סטטוסים ומשתתפים." },
  { id: "emails", label: "סוכן מיילים פנימי", sourceTable: "emails", desc: "מומחה תכתובת: חיפוש במאגר המיילים הרלוונטיים + ניתוח שולחים, קטגוריות וכיוון." },
  { id: "whatsapp_messages", label: "סוכן וואטסאפ פנימי", sourceTable: "whatsapp_analysis", desc: "מומחה שיחות שטח: חיפוש בניתוחי השיחות + משימות פתוחות, דדליינים והחלטות." },
  { id: "financial_transactions", label: "סוכן פיננסי פנימי", sourceTable: "financial_transactions", desc: "מומחה כספים: חיפוש בעסקאות + סכימות לפי סוג, ספקים מובילים וסטטוסים." },
  { id: "safety_report", label: "סוכן בטיחות פנימי", sourceTable: "safety_reports", desc: "מומחה בטיחות: חיפוש בדוחות + סיכום ליקויים לפי חומרה ורמת סיכון." }
];
const CONTENT_TOOL_DEFAULTS = { enabled: true, topK: 12, answerSynthesis: true, model: "", prompt: "", table: "" };

const MEETINGS_EVIDENCE_DEFAULTS = {
  enabled: true,
  model: "",
  rpcName: "hybrid_match_meetings_documents",
  table: "meetings_documents",
  matchCount: 20,
  matchThreshold: 0.3,
  vectorWeight: 0.55,
  textWeight: 0.25,
  keywordWeight: 0.15,
  metadataWeight: 0.05,
  adjacentChunks: 1,
  requireQuote: true,
  timeoutMs: 10000
};

const DATA_QUERY_DEFAULTS = {
  enabled: true,
  maxPlans: 5,
  maxRowsPerPlan: 200,
  timeoutMsPerPlan: 8000,
  totalTimeoutMs: 20000,
  runCacheEnabled: true,
  runCacheTtlMs: 60000,
  allowedTables: [],
  allowedSchemas: ["content"],
  plannerEnabled: true,
  plannerModel: "",
  plannerTimeoutMs: 30000
};

const n8nTools = [
  "alert",
  "meetings",
  "emails",
  "whatsapp_messages",
  "financial_transactions",
  "consultants_reports",
  "exceptions_report",
  "quality_control",
  "safety_report",
  "submittals"
];
const tools = [
  "hybrid_search",
  ...n8nTools
];
const diagnosticGroups = [
  {
    id: "core",
    label: "שירותי ליבה",
    description: "OpenRouter והחיבור הראשי של האפליקציה",
    checks: [
      ["openrouter_chat", "OpenRouter Chat"],
      ["openrouter_embeddings", "OpenRouter Embeddings"],
      ["app_supabase_rest", "App Supabase REST"]
    ]
  },
  {
    id: "data",
    label: "מקורות מידע",
    description: "Content Supabase, גרף הפרויקט ומאגר הידע",
    checks: [
      ["content_supabase_index_table", "Content Supabase Index Table"],
      ["content_supabase_alerts_table", "Content Supabase Alerts Table"],
      ["content_supabase_hybrid_rpc", "Content Supabase Hybrid RPC"],
      ["content_supabase_alerts_rpc", "Content Supabase Alerts RPC"],
      ["app_graph_tables", "Project Graph Tables"],
      ["app_graph_search_rpc", "Project Graph Search RPC"],
      ["knowledge_base", "Local Knowledge Base"]
    ]
  },
  {
    id: "agents",
    label: "סוכני AI",
    description: "בדיקת המודל המוגדר לכל סוכן",
    checks: [
      ["agent_classifier", "Classifier Agent"],
      ["agent_knowledge_planner", "Knowledge Planner Agent"],
      ["agent_main", "Main Agent"],
      ["agent_lite", "Lite Agent"],
      ["agent_reranker", "Reranker Agent"],
      ["agent_alert", "Alert Agent"],
      ["agent_qa", "QA / AI Report Agent"]
    ]
  },
  {
    id: "tools",
    label: "כלי N8N",
    description: "Webhooks חיצוניים שמופעלים לפי סוג השאלה",
    checks: [
      ["tool_alert", "N8N Alerts"],
      ["tool_meetings", "N8N Meetings"],
      ["tool_emails", "N8N Emails"],
      ["tool_whatsapp_messages", "N8N WhatsApp"],
      ["tool_financial_transactions", "N8N Financial"],
      ["tool_consultants_reports", "N8N Consultants"],
      ["tool_exceptions_report", "N8N Exceptions"],
      ["tool_quality_control", "N8N Quality"],
      ["tool_safety_report", "N8N Safety"],
      ["tool_submittals", "N8N Submittals"]
    ]
  }
];
const chatPromptFields = {
  classifier: "chatPrompt_classifier",
  knowledge_planner: "chatPrompt_knowledge_planner",
  main: "chatPrompt_main",
  lite: "chatPrompt_lite",
  reranker: "chatPrompt_reranker",
  qa: "chatPrompt_qa"
};
const aiSettingAgents = ["classifier", "knowledgePlanner", "main", "lite", "reranker", "alert", "qa"];

const state = {
  settings: null,
  lastWorkflow: null,
  currentWorkflowMessageId: null,
  eventSource: null,
  agents: [],
  openRouterModels: [],
  openRouterModelsFallback: false,
  agentRuntime: {},
  selectedKnowledgeDocument: null,
  selectedKnowledgeAgent: "schedule",
  knowledgeAgents: [],
  workflowCardsExpanded: true,
  workflowFilters: { query: "", status: "", errorsOnly: false, issue: "" },
  workflowCompare: { baseRun: null, compareRun: null, summary: null },
  runHistory: [],
  runEvents: [],
  fullLogVisible: false,
  chatProgress: null,
  chatRequest: null,
  chatSessions: [],
  chatAttachments: [],
  chatSourcesEnabled: true,
  deepResearchEnabled: false,
  composerMenuOpen: false,
  settingsDirty: false,
  delayClaims: [],
  selectedDelayClaimId: null,
  delayEvents: [],
  selectedDelayEventId: null,
  delayAnalyzeRunning: false,
  projectInsightsRunning: false,
  delayEventAnalyzeRunning: false,
  delayPackageRunning: false,
  lastProjectInsights: null,
  projectInsightsScannedKeys: [],
  projectInsightsRuns: 0,
  projectInsightHistory: [],
  projectInsightHistoryExpanded: false,
  selectedProjectInsightRunId: null,
  selectedInsightHashtags: [],
  lastDelayAnalysis: null,
  lastDelayEventAnalysis: null,
  lastDelayPackage: null,
  projectGraph: { nodes: [], edges: [], stats: null }
};

let _cy = null;
let _graphCy = null;

const WORKFLOW_TEMPLATE_NODES = [
  { id: "chat_input", label: "Chat Trigger", kind: "trigger", x: 70, y: 92, description: "Receives the user message and session id." },
  { id: "sanitize", label: "Sanitize Message", kind: "code", x: 286, y: 92, description: "Redacts prompt-injection patterns before any AI call." },
  { id: "save_message", label: "Save Message", kind: "database", x: 502, y: 92, description: "Creates the processing row in chat_messages_gf." },
  { id: "classifier", label: "Smart Classifier", kind: "ai", x: 718, y: 92, description: "Classifies CHAT/RAG, urgency, tools, dates, professional and investigation flags." },
  { id: "knowledge_vocabulary", label: "Knowledge Vocabulary", kind: "router", x: 934, y: 92, description: "Checks configured professional vocabulary terms that can activate the Knowledge Base planner." },
  { id: "memory", label: "Chat Memory", kind: "memory", x: 1150, y: 92, description: "Loads recent session history and local conversation summary after routing classification." },
  { id: "switch", label: "Traffic Switch", kind: "router", x: 1366, y: 92, description: "Routes the request to Lite Agent or the RAG path." },

  { id: "lite_agent", label: "Lite Agent", kind: "ai", x: 1586, y: 10, description: "Handles greetings, small talk, and general non-project answers." },
  { id: "safety_precheck", label: "Safety Precheck", kind: "tool", x: 1586, y: 176, description: "Runs safety_report and alert before retrieval when urgency is high." },
  { id: "investigation", label: "Investigation Mode", kind: "router", x: 1802, y: 176, description: "Builds a deeper inspection plan for root-cause and responsibility questions." },
  { id: "knowledge_planner", label: "Professional Knowledge Agent", kind: "ai", x: 2018, y: 176, description: "Uses the Knowledge Base as planning guidance for professional questions." },
  { id: "hybrid_search", label: "Hybrid Search", kind: "vector", x: 2234, y: 176, description: "Runs vector + keyword retrieval against Supabase with date and hashtag filters." },
  { id: "graph_search", label: "Project Graph Search", kind: "database", x: 2450, y: 176, description: "Finds project graph relationships around retrieved records." },
  { id: "reranker", label: "OpenRouter Reranker", kind: "ai", x: 2666, y: 176, description: "Reorders retrieved records by relevance to the user question." },
  { id: "alert_agent", label: "Alert Agent", kind: "ai", x: 2882, y: 176, description: "Runs the local Alert subagent with the query and structured date range." },
  { id: "data_query", label: "Data Query Agent", kind: "database", x: 3098, y: 176, description: "Runs approved read-only Query Plans against allowlisted Supabase tables." },
  { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", x: 3314, y: 176, description: "Calls configured external n8n tool webhooks." },
  { id: "source_quality", label: "Source Quality", kind: "router", x: 3530, y: 176, description: "Scores the reliability and freshness of retrieved/tool sources." },
  { id: "conflict_detection", label: "Conflict Detection", kind: "router", x: 3746, y: 176, description: "Highlights possible contradictions across sources before synthesis." },
  { id: "main_agent", label: "Main RAG Agent", kind: "ai", x: 3962, y: 176, description: "Synthesizes the final grounded answer from retrieval, tools and plans." },
  { id: "update_message", label: "Update DB", kind: "database", x: 4178, y: 92, description: "Updates chat_messages_gf with the final answer and status." },

  { id: "settings", label: "Settings", kind: "database", x: 70, y: 438, disconnected: true, description: "Configuration screen. Not part of a chat run." },
  { id: "knowledge_manager", label: "Knowledge Manager", kind: "database", x: 286, y: 438, disconnected: true, description: "Uploads and manages KB documents. Not part of a chat run unless the planner reads KB data." },
  { id: "tool_tester", label: "Tool Tester", kind: "tool", x: 502, y: 438, disconnected: true, description: "Manual test panel for tools and evaluations. Not part of automatic chat routing." },
  { id: "reset_server", label: "Reset Server", kind: "tool", x: 718, y: 438, disconnected: true, description: "Local restart helper for testing. Isolated from the agent pipeline." }
];

const WORKFLOW_TEMPLATE_EDGES = [
  ["chat_input", "sanitize"],
  ["sanitize", "save_message"],
  ["save_message", "classifier"],
  ["classifier", "knowledge_vocabulary"],
  ["knowledge_vocabulary", "memory"],
  ["memory", "switch"],
  ["switch", "lite_agent"],
  ["lite_agent", "update_message"],
  ["switch", "safety_precheck"],
  ["switch", "investigation"],
  ["safety_precheck", "investigation"],
  ["safety_precheck", "alert_agent"],
  ["switch", "knowledge_planner"],
  ["knowledge_vocabulary", "knowledge_planner"],
  ["safety_precheck", "knowledge_planner"],
  ["alert_agent", "investigation"],
  ["alert_agent", "knowledge_planner"],
  ["alert_agent", "hybrid_search"],
  ["investigation", "knowledge_planner"],
  ["switch", "hybrid_search"],
  ["safety_precheck", "hybrid_search"],
  ["investigation", "hybrid_search"],
  ["knowledge_planner", "hybrid_search"],
  ["hybrid_search", "graph_search"],
  ["graph_search", "reranker"],
  ["reranker", "alert_agent"],
  ["reranker", "data_query"],
  ["data_query", "alert_agent"],
  ["data_query", "n8n_tools"],
  ["alert_agent", "n8n_tools"],
  ["alert_agent", "source_quality"],
  ["reranker", "n8n_tools"],
  ["n8n_tools", "source_quality"],
  ["source_quality", "conflict_detection"],
  ["conflict_detection", "main_agent"],
  ["main_agent", "update_message"]
].map(([from, to]) => ({ from, to }));

const $ = (id) => document.getElementById(id);
function splitCsv(value) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
const TIMELINE_UI_VERSION = "V1.6";
const MOBILE_SHELL_QUERY = "(max-width: 980px)";

const timelineState = {
  events: [], resolution: "month", activeTags: new Set(),
  calYear: null, calMonth: null, calSelectedDate: null, calFocusedDate: null,
  source: "index",
  activeOrigins: new Set(),
  selectedEventId: null,
  searchQuery: "",
  viewportStart: null,
  visibleListFields: new Set(),
  links: [],
  suggestions: [],
  suggestionsLoaded: false,
  suggestionsMode: "rules",
  eventsBySource: { index: [], alerts: [] },
  linksBySource: { index: [], alerts: [] },
  suggestionsBySource: { index: [], alerts: [] },
  suggestionModesBySource: { index: "rules", alerts: "rules" },
  relatedLoadedSources: new Set(),
  loadedRanges: { index: [], alerts: [] },
  pendingRangeKeys: new Set(),
  paginationByRange: new Map(),
  activeRangeKey: null,
  requestId: 0,
  controller: null,
  timeoutId: null,
  loadingTimer: null,
  loadingStartedAt: 0,
  loading: false,
  loadingStep: "",
  lastLoad: null,
  searchPending: false,
  searchController: null,
  advancedControlsOpen: null,
  aiCollapsed: null,
  resizeBound: false,
  dropdownListenersBound: false,
  delegatedControlsBound: false,
  openDropdown: null,
  lastDropdownTriggerId: null,
  linksPanelExpanded: false,
  activeModalPanel: null,
  hoverTooltipState: null
};

init();

function safeInitStep(name, fn) {
  try {
    return fn();
  } catch (error) {
    console.error(`Init step failed: ${name}`, error);
    return null;
  }
}

async function init() {
  startNewSession({ showToast: false });
  safeInitStep("tool options", () => tools.forEach((tool) => $("toolSelect").append(new Option(tool, tool))));
  safeInitStep("advanced ai controls", enhanceAdvancedAiControls);
  safeInitStep("parameter info controls", enhanceParameterInfoControls);
  safeInitStep("timeline", wireTimeline);
  safeInitStep("shell", wireShell);
  safeInitStep("tabs", wireTabs);
  safeInitStep("chat", wireChat);
  safeInitStep("settings", wireSettings);
  safeInitStep("tools", wireTools);
  safeInitStep("workflow", wireWorkflow);
  safeInitStep("agents", wireAgents);
  safeInitStep("knowledge", wireKnowledge);
  safeInitStep("delay claims", wireDelayClaims);
  safeInitStep("evaluation", wireEvaluation);
  safeInitStep("reset", wireReset);
  safeInitStep("logout", wireLogout);
  safeInitStep("project graph", wireProjectGraph);
  safeInitStep("link agent", wireLinkAgent);
  safeInitStep("qa", wireQa);
  safeInitStep("history refresh", () => $("refreshHistory").addEventListener("click", loadHistory));
  safeInitStep("chat sessions", refreshChatSessions);

  // Restore tab from URL hash, then load initial data
  const initialTab = location.hash.slice(1) || "chat";
  activateTab(initialTab, false, { skipData: true });
  if (!location.hash) history.replaceState({ tab: "chat" }, "", "#chat");

  // Always load settings first (other tabs may depend on it).
  await loadSettings();
  // Model list is needed for the Agents tab selects; previously we skipped this
  // when initialTab==="agents", and activateTab raced before loadSettings.
  await loadOpenRouterModels();
  await loadKnowledgeDocuments();
  await loadHistory();
  const initialLoader = TAB_LOADERS[initialTab];
  if (initialLoader && !["settings", "knowledge", "history"].includes(initialTab)) {
    await initialLoader();
  }
  requestAnimationFrame(() => renderWorkflow(state.lastWorkflow));
}

function createSessionId() {
  const random = Math.random().toString(16).slice(2, 10);
  return `local_${Date.now()}_${random}`;
}

function setCurrentSession(sessionId) {
  $("sessionId").value = sessionId;
  localStorage.setItem("sessionId", sessionId);
}

function startNewSession(options = {}) {
  const { showToast: shouldShowToast = true } = options;
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  setCurrentSession(createSessionId());
  $("messages").innerHTML = "";
  $("messages").setAttribute("aria-busy", "false");
  $("chatWelcome")?.removeAttribute("hidden");
  if ($("chatTitle")) $("chatTitle").textContent = "מרחב העבודה של הפרויקט";
  setChatRunning(false);
  state.lastWorkflow = null;
  state.runEvents = [];
  state.fullLogVisible = false;
  state.chatProgress = null;
  if ($("liveRunList")) $("liveRunList").innerHTML = "";
  if ($("liveRunStatus")) $("liveRunStatus").textContent = "ממתין לבקשה";
  if ($("fullLogView")) {
    $("fullLogView").hidden = true;
    $("fullLogView").textContent = "";
  }
  resetAgentRuntime();
  renderAgents();
  requestAnimationFrame(() => renderWorkflow(null));
  if (shouldShowToast) showToast("נפתחה שיחה חדשה");
}

const TAB_LOADERS = {
  settings:   () => state.settingsDirty ? Promise.resolve() : loadSettings(),
  agents:     () => loadAgentsTabData(),
  subagents:  () => loadSubAgents(),
  insights:   () => { loadProjectInsightHistory(); loadHashtagChart(); renderProjectInsightsResults(); renderProjectInsightsStatus(); },
  knowledge:  () => loadKnowledgeDocuments(),
  history:    () => loadHistory(),
  timeline:   () => loadTimeline(),
  graph:      () => loadProjectGraph(),
  linkAgent:  () => loadLinkAgent(),
  qa:         () => loadQaList(),
  workflow:   () => loadRunHistory()
};

async function loadAgentsTabData() {
  await refreshAgentsFromApi();
  await loadOpenRouterModels();
}

// ─── Internal content tool cards (spec M2) ───────────────────────────────────

function contentToolDraft(toolId) {
  return {
    ...CONTENT_TOOL_DEFAULTS,
    ...(state.settings?.subagents?.contentTools?.perTool?.[toolId] || {})
  };
}

function stageContentToolDraft(toolId, updated) {
  const contentTools = state.settings?.subagents?.contentTools || {};
  state.settings = {
    ...(state.settings || {}),
    subagents: {
      ...(state.settings?.subagents || {}),
      contentTools: {
        ...contentTools,
        perTool: { ...(contentTools.perTool || {}), [toolId]: updated }
      }
    }
  };
  state.settingsDirty = true;
  markSubagentsDirty();
}

function renderContentToolCards(list, models) {
  const internalToolsOn = state.settings?.toolsRuntime?.internalTools === true;
  const master = document.createElement("div");
  master.className = "subagent-card";
  master.innerHTML = `
    <div class="subagent-header">
      <span class="subagent-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
      <span class="subagent-name">כלים פנימיים — מתג ראשי</span>
      <span class="subagent-status ${internalToolsOn ? "status-ok" : "status-warn"}">${internalToolsOn ? "פעיל" : "כבוי"}</span>
    </div>
    <p class="subagent-desc">כשהמתג דולק, כלי הפרויקט (פגישות, מיילים, וואטסאפ, פיננסי, בטיחות) רצים בקוד פנימי מול מסד הנתונים במקום דרך n8n. אפשר לכבות כל סוכן בנפרד בכרטיס שלו.</p>
    <div class="subagent-config">
      <label class="subagent-config-label">
        <input type="checkbox" class="ct-master" ${internalToolsOn ? "checked" : ""} /> הפעל כלים פנימיים
      </label>
    </div>
  `;
  master.querySelector(".ct-master").addEventListener("change", (event) => {
    state.settings = {
      ...(state.settings || {}),
      toolsRuntime: { ...(state.settings?.toolsRuntime || {}), internalTools: event.target.checked }
    };
    state.settingsDirty = true;
    markSubagentsDirty();
  });
  list.append(master);

  for (const tool of CONTENT_TOOL_CARDS) {
    const cfg = contentToolDraft(tool.id);
    const modelOptions = models.map((m) =>
      `<option value="${m.id}" ${m.id === (cfg.model || "") ? "selected" : ""}>${m.id}</option>`
    ).join("");
    const card = document.createElement("div");
    card.className = "subagent-card";
    card.innerHTML = `
      <div class="subagent-header">
        <span class="subagent-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <span class="subagent-name">${tool.label}</span>
        <span class="subagent-status ${cfg.enabled !== false ? "status-ok" : "status-warn"}">${cfg.enabled !== false ? "פעיל" : "כבוי"}</span>
      </div>
      <p class="subagent-desc">${tool.desc}</p>
      <p class="subagent-desc ct-source">קורא ישירות מ: <code>${cfg.table || tool.sourceTable}</code> (המאגר של הסוכן ב-Content DB)</p>
      <div class="subagent-config">
        <label class="subagent-config-label">
          <input type="checkbox" class="ct-enabled" ${cfg.enabled !== false ? "checked" : ""} /> הפעל סוכן
        </label>
        <label class="subagent-config-label">טבלת מקור (ריק = ${tool.sourceTable})
          <input class="ct-table" list="contentToolTables" value="${cfg.table || ""}" placeholder="${tool.sourceTable}" />
        </label>
        <label class="subagent-config-label">מספר תוצאות (topK)
          <input type="number" class="ct-topk" value="${cfg.topK || 12}" min="1" max="50" />
        </label>
        <label class="subagent-config-label">
          <input type="checkbox" class="ct-synthesis" ${cfg.answerSynthesis ? "checked" : ""} /> ניסוח תשובה (קריאת AI נוספת)
        </label>
        <label class="subagent-config-label">מודל ניסוח (ריק = Lite)
          <select class="ct-model"><option value="">— מודל Lite —</option>${modelOptions}</select>
        </label>
        <label class="subagent-config-label wide">פרומפט ניסוח (ריק = ברירת מחדל)
          <textarea class="ct-prompt" rows="5" spellcheck="false" placeholder="השאר ריק כדי להשתמש בפרומפט ברירת המחדל של הסוכן">${cfg.prompt || ""}</textarea>
        </label>
        <button class="ct-save">עדכן בטופס</button>
        <span class="ct-save-status"></span>
      </div>
      <div class="subagent-test">
        <input class="ct-query" placeholder="שאילתת בדיקה…" />
        <input class="ct-from" placeholder="מתאריך (YYYY-MM-DD)" />
        <input class="ct-to" placeholder="עד תאריך (YYYY-MM-DD)" />
        <button class="ct-run">בדוק עם הטיוטה</button>
      </div>
      <pre class="subagent-result">אין תוצאה עדיין.</pre>
    `;
    const readDraft = () => ({
      enabled: card.querySelector(".ct-enabled").checked,
      table: card.querySelector(".ct-table").value.trim(),
      topK: Number(card.querySelector(".ct-topk").value) || 12,
      answerSynthesis: card.querySelector(".ct-synthesis").checked,
      model: card.querySelector(".ct-model").value,
      prompt: card.querySelector(".ct-prompt").value
    });
    card.querySelector(".ct-table").addEventListener("change", () => {
      const source = card.querySelector(".ct-source code");
      if (source) source.textContent = card.querySelector(".ct-table").value.trim() || tool.sourceTable;
    });
    card.querySelector(".ct-save").addEventListener("click", () => {
      stageContentToolDraft(tool.id, readDraft());
      const status = card.querySelector(".ct-save-status");
      status.textContent = "✓ עודכן בטופס";
      setTimeout(() => { status.textContent = ""; }, 2500);
    });
    card.querySelector(".ct-run").addEventListener("click", async () => {
      const resultEl = card.querySelector(".subagent-result");
      resultEl.textContent = "מריץ…";
      try {
        const result = await api(`/api/tools/${encodeURIComponent(tool.id)}/test`, {
          method: "POST",
          body: {
            internal: true,
            query: card.querySelector(".ct-query").value,
            date_from: card.querySelector(".ct-from").value || null,
            date_to: card.querySelector(".ct-to").value || null,
            overrides: readDraft()
          }
        });
        const parts = [];
        if (result.answer) parts.push(result.answer);
        if (result.data?.analysis) parts.push(`--- ניתוח ---\n${JSON.stringify(result.data.analysis, null, 2)}`);
        if (result.data?.retrieval?.warnings?.length) parts.push(`אזהרות אחזור: ${result.data.retrieval.warnings.join(", ")}`);
        if (!result.answer) parts.push(JSON.stringify(result.data?.results?.slice(0, 5) ?? result, null, 2));
        resultEl.textContent = parts.join("\n\n");
      } catch (error) {
        resultEl.textContent = `שגיאה: ${error.message}`;
      }
    });
    list.append(card);
  }
  populateContentToolTablesDatalist();
}

// Fills the shared datalist from already-authorized saved settings. Phase 1
// protects schema introspection with a server secret, so browser code no longer
// calls that privileged endpoint directly.
let _contentTablesDatalistLoaded = false;
async function populateContentToolTablesDatalist() {
  let datalist = document.getElementById("contentToolTables");
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = "contentToolTables";
    document.body.append(datalist);
  }
  if (_contentTablesDatalistLoaded) return;
  const dataQueryTables = state.settings?.subagents?.dataQuery?.tables || [];
  const contentToolTables = Object.values(state.settings?.subagents?.contentTools?.perTool || {}).map((item) => item?.table);
  const tables = [...dataQueryTables.map((item) => item?.table), ...contentToolTables].filter(Boolean);
  datalist.innerHTML = [...new Set(tables)].sort().map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
  _contentTablesDatalistLoaded = tables.length > 0;
}

function renderIndexingCard(list) {
  const cfg = { autoIndexing: false, incrementalLimit: 40, ...(state.settings?.subagents?.indexing || {}) };
  const card = document.createElement("div");
  card.className = "subagent-card";
  card.innerHTML = `
    <div class="subagent-header">
      <span class="subagent-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></span>
      <span class="subagent-name">סוכן אינדוקס פנימי</span>
      <span class="subagent-status ${cfg.autoIndexing ? "status-ok" : "status-warn"}">${cfg.autoIndexing ? "אוטומטי" : "ידני"}</span>
    </div>
    <p class="subagent-desc">מאנדקס רשומות מקור חדשות ל-data_index וממלא תאריכי אירוע/מסמך. Dry-run מציג תוכנית בלי לכתוב; "הרץ אינדוקס" כותב בפועל.</p>
    <p class="subagent-desc ct-source">קורא מ: <code>meetings</code>, <code>emails</code>, <code>whatsapp_analysis</code>, <code>financial_transactions</code>, <code>safety_reports</code>, <code>consultants_reports</code>, <code>other_documents</code> · כותב ל: <code>data_index</code></p>
    <div class="subagent-config">
      <label class="subagent-config-label">
        <input type="checkbox" class="ix-auto" ${cfg.autoIndexing ? "checked" : ""} /> אינדוקס אוטומטי בריצות תובנות
      </label>
      <label class="subagent-config-label">תקרת שורות לריצה
        <input type="number" class="ix-limit" value="${cfg.incrementalLimit || 40}" min="1" max="200" />
      </label>
      <button class="ix-save">עדכן בטופס</button>
      <span class="ix-save-status"></span>
    </div>
    <div class="subagent-test">
      <button class="ix-dry-dates">Dry-run תאריכים</button>
      <button class="ix-dry-run">Dry-run אינדוקס</button>
      <button class="ix-apply">הרץ אינדוקס עכשיו</button>
      <button class="ix-emb-dry">Dry-run השלמת embeddings</button>
      <button class="ix-emb-apply">השלם embeddings</button>
    </div>
    <pre class="subagent-result">אין תוצאה עדיין.</pre>
  `;
  card.querySelector(".ix-save").addEventListener("click", () => {
    state.settings = {
      ...(state.settings || {}),
      subagents: {
        ...(state.settings?.subagents || {}),
        indexing: {
          autoIndexing: card.querySelector(".ix-auto").checked,
          incrementalLimit: Number(card.querySelector(".ix-limit").value) || 40
        }
      }
    };
    state.settingsDirty = true;
    markSubagentsDirty();
    const status = card.querySelector(".ix-save-status");
    status.textContent = "✓ עודכן בטופס";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
  const runIndexing = async (path, body) => {
    const resultEl = card.querySelector(".subagent-result");
    resultEl.textContent = "מריץ…";
    try {
      const result = await api(path, { method: "POST", body });
      const { sample, ...summary } = result;
      resultEl.textContent = JSON.stringify(summary, null, 2);
    } catch (error) {
      resultEl.textContent = `שגיאה: ${error.message}`;
    }
  };
  card.querySelector(".ix-dry-dates").addEventListener("click", () => runIndexing("/api/index/backfill-dates", { dryRun: true }));
  card.querySelector(".ix-dry-run").addEventListener("click", () => runIndexing("/api/index/run", { dryRun: true }));
  card.querySelector(".ix-apply").addEventListener("click", () => runIndexing("/api/index/run", {
    dryRun: false,
    limit: Number(card.querySelector(".ix-limit").value) || 40
  }));
  card.querySelector(".ix-emb-dry").addEventListener("click", () => runIndexing("/api/index/embeddings", { dryRun: true }));
  card.querySelector(".ix-emb-apply").addEventListener("click", () => runIndexing("/api/index/embeddings", { dryRun: false }));
  list.append(card);
}

function markSubagentsDirty() {
  const status = $("subagentsSaveStatus");
  if (status) status.textContent = "יש שינויים שטרם נשמרו ב-Supabase.";
}

// The settings page is a React island with its own save; subagent drafts are
// persisted from here with a partial PUT (the server merges sections).
function wireSubagentsSaveBar() {
  const button = $("subagentsSaveAll");
  if (!button || button.dataset.wired) return;
  button.dataset.wired = "1";
  button.addEventListener("click", async () => {
    const status = $("subagentsSaveStatus");
    button.disabled = true;
    if (status) status.textContent = "שומר ב-Supabase…";
    try {
      const result = await api("/api/settings", {
        method: "PUT",
        body: {
          subagents: state.settings?.subagents || {},
          toolsRuntime: state.settings?.toolsRuntime || {}
        }
      });
      if (result?.settings) state.settings = result.settings;
      state.settingsDirty = false;
      if (status) status.textContent = "✓ נשמר ב-Supabase";
      showToast("הגדרות הסוכנים נשמרו");
      setTimeout(() => { if (status) status.textContent = ""; }, 3000);
    } catch (error) {
      if (status) status.textContent = `שגיאה: ${error.message}`;
      showToast(`שגיאה בשמירה: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function loadSubAgents() {
  const list = $("subagentsList");
  list.innerHTML = "";
  const models = state.openRouterModels.length
    ? state.openRouterModels
    : [{ id: "openai/gpt-4o" }, { id: "openai/gpt-4o-mini" }, { id: "anthropic/claude-sonnet-4-5" }];

  for (const agent of SUB_AGENTS) {
    const saved = state.settings?.subagents?.[agent.id] || {};
    const curTable = saved.table || agent.defaults?.table || "";
    const curModel = saved.model || agent.defaults?.model || "";
    const curPrompt = saved.systemPrompt || agent.defaults?.systemPrompt || "";
    const isConfigured = !!(agent.endpoint);

    const modelOptions = models.map((m) =>
      `<option value="${m.id}" ${m.id === curModel ? "selected" : ""}>${m.id}</option>`
    ).join("");

    const card = document.createElement("div");
    card.className = "subagent-card";
    card.innerHTML = `
      <div class="subagent-header">
        <span class="subagent-icon">${agent.icon}</span>
        <span class="subagent-name">${agent.label}</span>
        <span class="subagent-status ${isConfigured ? "status-ok" : "status-warn"}">
          ${isConfigured ? "פעיל" : "לא מוגדר"}
        </span>
      </div>
      <p class="subagent-desc">${agent.description}</p>

      <div class="subagent-config">
        <label class="subagent-config-label">טבלת Supabase
          <input class="subagent-table" value="${curTable}" placeholder="alerts_embeddings_gf" />
        </label>
        <label class="subagent-config-label">מודל
          <select class="subagent-model">${modelOptions}</select>
        </label>
        <label class="subagent-config-label wide">System Prompt
          <textarea class="subagent-prompt" rows="7" spellcheck="false">${curPrompt}</textarea>
        </label>
        <button class="subagent-save">שמור הגדרות</button>
        <span class="subagent-save-status"></span>
      </div>

      <div class="subagent-test">
        <input class="subagent-query" placeholder="שאילתת בדיקה…" />
        <input class="subagent-date" placeholder="סינון תאריך (אופציונלי)" />
        <button class="subagent-run">הרץ</button>
      </div>
      <pre class="subagent-result">אין תוצאה עדיין.</pre>
    `;

    card.querySelector(".subagent-save").addEventListener("click", async () => {
      const saveBtn = card.querySelector(".subagent-save");
      const saveStatus = card.querySelector(".subagent-save-status");
      saveBtn.disabled = true;
      saveStatus.textContent = "מעדכן בטופס…";
      try {
        state.settings = {
          ...(state.settings || {}),
          subagents: {
            ...(state.settings?.subagents || {}),
            [agent.id]: {
            table: card.querySelector(".subagent-table").value,
            model: card.querySelector(".subagent-model").value,
            systemPrompt: card.querySelector(".subagent-prompt").value
            }
          }
        };
        state.settingsDirty = true;
        setSettingsSaveState("יש שינויים בטופס שטרם נשמרו ב-Supabase.", "dirty");
        saveStatus.textContent = "✓ עודכן בטופס";
        showToast("הגדרות הסאב-אייג'נט נטענו לטופס. לחץ שמור כדי לעדכן את Supabase");
        setTimeout(() => { saveStatus.textContent = ""; }, 2500);
      } catch (error) {
        saveStatus.textContent = `שגיאה: ${error.message}`;
      } finally {
        saveBtn.disabled = false;
      }
    });

    card.querySelector(".subagent-run").addEventListener("click", async () => {
      const query = card.querySelector(".subagent-query").value;
      const date_filter = card.querySelector(".subagent-date").value;
      const resultEl = card.querySelector(".subagent-result");
      resultEl.textContent = "מריץ…";
      const endpoint = agent.endpoint || `/api/tools/${encodeURIComponent(agent.id)}/test`;
      const result = await api(endpoint, {
        method: "POST",
        body: { query, date_filter, sessionId: $("sessionId").value },
      });
      resultEl.textContent = result.answer ?? JSON.stringify(result, null, 2);
    });

    list.append(card);
  }

  // Meeting Evidence Agent card (custom settings panel)
  const meCfg = { ...MEETINGS_EVIDENCE_DEFAULTS, ...(state.settings?.subagents?.meetingsEvidence || {}) };
  const meModels = models.map((m) =>
    `<option value="${m.id}" ${m.id === (meCfg.model || "") ? "selected" : ""}>${m.id}</option>`
  ).join("");
  const meCard = document.createElement("div");
  meCard.className = "subagent-card";
  meCard.innerHTML = `
    <div class="subagent-header">
      <span class="subagent-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
      <span class="subagent-name">Meeting Evidence Agent</span>
      <span class="subagent-status ${meCfg.enabled ? "status-ok" : "status-warn"}">${meCfg.enabled ? "פעיל" : "כבוי"}</span>
    </div>
    <p class="subagent-desc">מאתר ראיות מתוך סיכומי ישיבות בטבלת meetings_documents. מחזיר ציטוטים מדויקים עם מידע מקור. מופעל אוטומטית כשהשאילתה עוסקת בישיבות.</p>
    <div class="subagent-config">
      <label class="subagent-config-label">
        <input type="checkbox" id="meEnabled" ${meCfg.enabled ? "checked" : ""} /> הפעל סוכן
      </label>
      <label class="subagent-config-label">מודל (ריק = מודל ראשי)
        <select id="meModel"><option value="">— מודל ראשי —</option>${meModels}</select>
      </label>
      <label class="subagent-config-label">RPC Name
        <input id="meRpcName" value="${meCfg.rpcName}" />
      </label>
      <label class="subagent-config-label">מספר תוצאות (matchCount)
        <input type="number" id="meMatchCount" value="${meCfg.matchCount}" min="1" max="100" />
      </label>
      <label class="subagent-config-label">סף דמיון מינימלי (matchThreshold)
        <input type="number" id="meMatchThreshold" value="${meCfg.matchThreshold}" min="0" max="1" step="0.05" />
      </label>
      <label class="subagent-config-label">משקל וקטורי (vectorWeight)
        <input type="number" id="meVectorWeight" value="${meCfg.vectorWeight}" min="0" max="1" step="0.05" />
      </label>
      <label class="subagent-config-label">משקל טקסט (textWeight)
        <input type="number" id="meTextWeight" value="${meCfg.textWeight}" min="0" max="1" step="0.05" />
      </label>
      <label class="subagent-config-label">משקל מילות מפתח (keywordWeight)
        <input type="number" id="meKeywordWeight" value="${meCfg.keywordWeight}" min="0" max="1" step="0.05" />
      </label>
      <label class="subagent-config-label">משקל metadata (metadataWeight)
        <input type="number" id="meMetadataWeight" value="${meCfg.metadataWeight}" min="0" max="1" step="0.05" />
      </label>
      <label class="subagent-config-label">צ'אנקים סמוכים (adjacentChunks)
        <input type="number" id="meAdjacentChunks" value="${meCfg.adjacentChunks}" min="0" max="3" />
      </label>
      <label class="subagent-config-label">
        <input type="checkbox" id="meRequireQuote" ${meCfg.requireQuote ? "checked" : ""} /> חייב ציטוט
      </label>
      <label class="subagent-config-label">Timeout (ms)
        <input type="number" id="meTimeoutMs" value="${meCfg.timeoutMs}" min="1000" max="60000" step="1000" />
      </label>
      <button id="meSaveBtn">שמור הגדרות</button>
      <span id="meSaveStatus"></span>
    </div>
  `;
  meCard.querySelector("#meSaveBtn").addEventListener("click", () => {
    const updated = {
      enabled: meCard.querySelector("#meEnabled").checked,
      model: meCard.querySelector("#meModel").value || null,
      rpcName: meCard.querySelector("#meRpcName").value.trim() || MEETINGS_EVIDENCE_DEFAULTS.rpcName,
      matchCount: Number(meCard.querySelector("#meMatchCount").value) || MEETINGS_EVIDENCE_DEFAULTS.matchCount,
      matchThreshold: Number(meCard.querySelector("#meMatchThreshold").value),
      vectorWeight: Number(meCard.querySelector("#meVectorWeight").value),
      textWeight: Number(meCard.querySelector("#meTextWeight").value),
      keywordWeight: Number(meCard.querySelector("#meKeywordWeight").value),
      metadataWeight: Number(meCard.querySelector("#meMetadataWeight").value),
      adjacentChunks: Number(meCard.querySelector("#meAdjacentChunks").value),
      requireQuote: meCard.querySelector("#meRequireQuote").checked,
      timeoutMs: Number(meCard.querySelector("#meTimeoutMs").value) || MEETINGS_EVIDENCE_DEFAULTS.timeoutMs
    };
    state.settings = {
      ...(state.settings || {}),
      subagents: { ...(state.settings?.subagents || {}), meetingsEvidence: updated }
    };
    state.settingsDirty = true;
    setSettingsSaveState("יש שינויים בטופס שטרם נשמרו ב-Supabase.", "dirty");
    meCard.querySelector("#meSaveStatus").textContent = "✓ עודכן בטופס";
    showToast("הגדרות Meeting Evidence Agent נטענו לטופס. לחץ שמור כדי לעדכן את Supabase");
    setTimeout(() => { meCard.querySelector("#meSaveStatus").textContent = ""; }, 2500);
  });
  list.append(meCard);

  renderContentToolCards(list, models);
  renderIndexingCard(list);
  wireSubagentsSaveBar();

  const dqCfg = { ...DATA_QUERY_DEFAULTS, ...(state.settings?.subagents?.dataQuery || {}) };
  const dqCard = document.createElement("div");
  dqCard.className = "subagent-card dataQueryInfoCard";
  dqCard.innerHTML = `
    <div class="subagent-header">
      <span class="subagent-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg></span>
      <span class="subagent-name">Data Query Agent</span>
      <span class="subagent-status ${dqCfg.enabled ? "status-ok" : "status-warn"}">${dqCfg.enabled ? "פעיל" : "כבוי"}</span>
    </div>
    <p class="subagent-desc">Content-DB-only metrics agent. Contract data-query.v2 accepts scoped, typed Query Plans, narrows caller budgets, deduplicates identical plans within one run, and routes semantic/citation questions to retrieval agents. Exact database access uses a short-lived managed service identity; direct API calls require the server-side BIDOC_API_SECRET.</p>
    <div class="subagent-config">
      <label class="subagent-config-label toggleLabel">
        <input type="checkbox" id="dqEnabled" ${dqCfg.enabled ? "checked" : ""} /> הפעל סוכן
      </label>
      <label class="subagent-config-label toggleLabel">
        <input type="checkbox" id="dqPlannerEnabled" ${dqCfg.plannerEnabled !== false ? "checked" : ""} /> LLM planner
      </label>
      <label class="subagent-config-label">Planner model
        <select id="dqPlannerModel"><option value="">— Knowledge/Main model —</option>${models.map((m) => `<option value="${m.id}" ${m.id === (dqCfg.plannerModel || "") ? "selected" : ""}>${m.id}</option>`).join("")}</select>
      </label>
      <label class="subagent-config-label">Planner timeout (ms)
        <input type="number" id="dqPlannerTimeoutMs" value="${dqCfg.plannerTimeoutMs || DATA_QUERY_DEFAULTS.plannerTimeoutMs}" min="5000" max="90000" step="1000" />
      </label>
      <label class="subagent-config-label">Max plans
        <input type="number" id="dqMaxPlans" value="${dqCfg.maxPlans}" min="1" max="10" />
      </label>
      <label class="subagent-config-label">Max rows per plan
        <input type="number" id="dqMaxRowsPerPlan" value="${dqCfg.maxRowsPerPlan}" min="1" max="1000" />
      </label>
      <label class="subagent-config-label">Plan timeout (ms)
        <input type="number" id="dqTimeoutMsPerPlan" value="${dqCfg.timeoutMsPerPlan}" min="1000" max="60000" step="1000" />
      </label>
      <label class="subagent-config-label">Total timeout (ms)
        <input type="number" id="dqTotalTimeoutMs" value="${dqCfg.totalTimeoutMs}" min="1000" max="120000" step="1000" />
      </label>
      <label class="subagent-config-label toggleLabel">
        <input type="checkbox" id="dqRunCacheEnabled" ${dqCfg.runCacheEnabled !== false ? "checked" : ""} /> Run-local dedup cache
      </label>
      <label class="subagent-config-label">Run cache TTL (ms)
        <input type="number" id="dqRunCacheTtlMs" value="${dqCfg.runCacheTtlMs || DATA_QUERY_DEFAULTS.runCacheTtlMs}" min="1000" max="300000" step="1000" />
      </label>
      <div class="dqTablesPicker">
        <div class="dqTablesHeader">
          <span>טבלאות Content מורשות — מנוהלות בהגדרות המאובטחות. הסוכן משתמש רק במה שמסומן.</span>
        </div>
        <input type="search" id="dqTableSearch" placeholder="חיפוש טבלה..." autocomplete="off" />
        <div id="dqTablesStatus" class="dqTablesStatus"></div>
        <div id="dqTablesList" class="dqTablesList"></div>
      </div>
      <button id="dqSaveBtn">שמור הגדרות</button>
      <span id="dqSaveStatus"></span>
    </div>
    <p class="subagent-desc">בדיקה תפעולית מתבצעת דרך הצ׳אט הראשי או דרך <code>POST /api/subagents/data-query</code> עם כותרת <code>X-Bidoc-Api-Secret</code>.</p>
  `;
  // --- DB table picker state & rendering ---
  const dqSavedSelection = (Array.isArray(dqCfg.tables) ? dqCfg.tables : [])
    .map((t) => ({
      connection: "content",
      schema: String(t.schema || "public"),
      table: String(t.table || t.name || ""),
      columns: Array.isArray(t.columns) ? t.columns.map(String) : []
    }))
    .filter((t) => t.table);
  const dqCheckedKeys = new Set(dqSavedSelection.map((t) => `${t.connection}.${t.table}`));
  const dqColumnsByKey = new Map(dqSavedSelection.map((t) => [`${t.connection}.${t.table}`, t.columns]));
  const dqConnLabel = () => "מאגר תוכן";
  function dqDisplayConnections() {
    const byConn = {};
    for (const t of dqSavedSelection) (byConn[t.connection] ||= []).push({ name: t.table, columns: t.columns });
    return Object.entries(byConn).map(([key, tables]) => ({ key, label: dqConnLabel(key), schema: "public", tables }));
  }
  function dqCollectSelectedTables() {
    return [...dqCheckedKeys].map((key) => {
      const idx = key.indexOf(".");
      return { connection: key.slice(0, idx), schema: "public", table: key.slice(idx + 1), columns: dqColumnsByKey.get(key) || [] };
    }).filter((t) => t.table);
  }
  function dqUpdateStatus() {
    const statusEl = dqCard.querySelector("#dqTablesStatus");
    const total = dqDisplayConnections().reduce((sum, c) => sum + c.tables.length, 0);
    statusEl.textContent = dqSavedSelection.length
      ? `מוגדרות ${total} טבלאות Content · נבחרו ${dqCheckedKeys.size}`
      : "אין טבלאות Content מאושרות בהגדרות.";
  }
  function dqRenderTablesList() {
    const listEl = dqCard.querySelector("#dqTablesList");
    const filter = (dqCard.querySelector("#dqTableSearch").value || "").trim().toLowerCase();
    listEl.innerHTML = "";
    for (const conn of dqDisplayConnections()) {
      const tables = conn.tables.filter((t) => !filter || t.name.toLowerCase().includes(filter));
      if (!tables.length) continue;
      const group = document.createElement("div");
      group.className = "dqTableGroup";
      const head = document.createElement("div");
      head.className = "dqTableGroupHead";
      head.innerHTML = `<strong>${escapeHtml(conn.label)}</strong> <small>(${tables.length})</small>`;
      const allBtn = document.createElement("button");
      allBtn.type = "button"; allBtn.textContent = "בחר הכל";
      allBtn.addEventListener("click", () => { for (const t of tables) { const k = `${conn.key}.${t.name}`; dqCheckedKeys.add(k); dqColumnsByKey.set(k, t.columns || []); } dqRenderTablesList(); dqUpdateStatus(); });
      const noneBtn = document.createElement("button");
      noneBtn.type = "button"; noneBtn.textContent = "נקה";
      noneBtn.addEventListener("click", () => { for (const t of tables) dqCheckedKeys.delete(`${conn.key}.${t.name}`); dqRenderTablesList(); dqUpdateStatus(); });
      head.append(allBtn, noneBtn);
      group.append(head);
      for (const t of tables) {
        const key = `${conn.key}.${t.name}`;
        if (!dqColumnsByKey.has(key)) dqColumnsByKey.set(key, t.columns || []);
        const row = document.createElement("label");
        row.className = "dqTableRow";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = dqCheckedKeys.has(key);
        cb.addEventListener("change", () => { if (cb.checked) dqCheckedKeys.add(key); else dqCheckedKeys.delete(key); dqUpdateStatus(); });
        const name = document.createElement("span"); name.className = "dqTableName"; name.textContent = t.name;
        const cols = document.createElement("small"); cols.textContent = `${(t.columns || []).length} עמודות`;
        row.append(cb, name, cols);
        group.append(row);
      }
      listEl.append(group);
    }
    if (!listEl.children.length) listEl.innerHTML = '<div class="dqTablesEmpty">אין טבלאות להצגה.</div>';
  }
  dqCard.querySelector("#dqTableSearch").addEventListener("input", dqRenderTablesList);
  dqRenderTablesList();
  dqUpdateStatus();

  dqCard.querySelector("#dqSaveBtn").addEventListener("click", () => {
    const updated = {
      enabled: dqCard.querySelector("#dqEnabled").checked,
      plannerEnabled: dqCard.querySelector("#dqPlannerEnabled").checked,
      plannerModel: dqCard.querySelector("#dqPlannerModel").value || "",
      plannerTimeoutMs: Number(dqCard.querySelector("#dqPlannerTimeoutMs").value) || DATA_QUERY_DEFAULTS.plannerTimeoutMs,
      maxPlans: Number(dqCard.querySelector("#dqMaxPlans").value) || DATA_QUERY_DEFAULTS.maxPlans,
      maxRowsPerPlan: Number(dqCard.querySelector("#dqMaxRowsPerPlan").value) || DATA_QUERY_DEFAULTS.maxRowsPerPlan,
      timeoutMsPerPlan: Number(dqCard.querySelector("#dqTimeoutMsPerPlan").value) || DATA_QUERY_DEFAULTS.timeoutMsPerPlan,
      totalTimeoutMs: Number(dqCard.querySelector("#dqTotalTimeoutMs").value) || DATA_QUERY_DEFAULTS.totalTimeoutMs,
      runCacheEnabled: dqCard.querySelector("#dqRunCacheEnabled").checked,
      runCacheTtlMs: Number(dqCard.querySelector("#dqRunCacheTtlMs").value) || DATA_QUERY_DEFAULTS.runCacheTtlMs,
      tables: dqCollectSelectedTables(),
      allowedTables: dqCollectSelectedTables().map((item) => item.table),
      allowedSchemas: ["content"]
    };
    state.settings = {
      ...(state.settings || {}),
      subagents: { ...(state.settings?.subagents || {}), dataQuery: updated }
    };
    state.settingsDirty = true;
    setSettingsSaveState("יש שינויים בטופס שטרם נשמרו ב-Supabase.", "dirty");
    dqCard.querySelector("#dqSaveStatus").textContent = "✓ עודכן בטופס";
    showToast("Data Query Agent settings were loaded into the draft. Save Settings to persist.");
    setTimeout(() => { dqCard.querySelector("#dqSaveStatus").textContent = ""; }, 2500);
  });
  list.append(dqCard);
  enhanceParameterInfoControls();
}

async function refreshAgentsFromApi() {
  try {
    const { agents } = await api("/api/agents");
    if (Array.isArray(agents) && agents.length) {
      state.agents = agents;
      resetAgentRuntime();
      renderAgents();
    }
  } catch (_) {
    // keep existing agents from settings
  }
}

function activateTab(tabId, pushHistory = true, options = {}) {
  const { skipData = false } = options;
  const button = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const panel  = $(tabId);
  if (!button || !panel) return;
  document.querySelectorAll(".tab, .panel").forEach((el) => el.classList.remove("active"));
  button.classList.add("active");
  panel.classList.add("active");
  updateMobileActiveTabLabel(tabId);
  closeSidebar();
  if (pushHistory && location.hash !== `#${tabId}`) {
    history.pushState({ tab: tabId }, "", `#${tabId}`);
  }
  if (!skipData) TAB_LOADERS[tabId]?.();
  if (tabId === "workflow") {
    requestAnimationFrame(() => renderWorkflow(state.lastWorkflow));
  }
}

window.__bidocActivateTab = activateTab;
window.__bidocSetWorkflowFromReact = (result = {}) => {
  state.lastWorkflow = result.workflowLog || null;
  state.currentWorkflowMessageId = result.runId || null;
  if (state.lastWorkflow) renderWorkflow(state.lastWorkflow);
  loadRunHistory().catch(() => {});
};

function isMobileShellViewport() {
  return window.matchMedia(MOBILE_SHELL_QUERY).matches;
}

function updateMobileActiveTabLabel(tabId) {
  const activeLabel = $("mobileActiveTabLabel");
  const source = document.querySelector(`.tab[data-tab="${tabId}"] .tabLabel`);
  if (activeLabel && source?.textContent?.trim()) {
    activeLabel.textContent = source.textContent.trim();
  }
}

function setSidebarOpen(open) {
  $("appShell")?.classList.toggle("sidebarOpen", open);
  document.body.classList.toggle("shellOverlayOpen", open);
  $("toggleSidebar")?.setAttribute("aria-expanded", String(open));
  if (open) closeChatDrawer();
}

function closeSidebar() {
  setSidebarOpen(false);
}

function wireShell() {
  $("toggleSidebar")?.addEventListener("click", () => {
    const open = !$("appShell")?.classList.contains("sidebarOpen");
    setSidebarOpen(open);
  });
  $("sidebarBackdrop")?.addEventListener("click", closeSidebar);
  window.matchMedia(MOBILE_SHELL_QUERY).addEventListener("change", (event) => {
    if (!event.matches) closeSidebar();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeSidebar();
    closeChatDrawer();
  });
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
  window.addEventListener("popstate", (event) => {
    const tabId = event.state?.tab || location.hash.slice(1) || "chat";
    activateTab(tabId, false);
  });
}

function wireChat() {
  $("newSession")?.addEventListener("click", () => {
    startNewSession();
    activateTab("chat");
    $("messageInput").focus();
    closeChatDrawer();
  });

  $("toggleChatDrawer")?.addEventListener("click", () => {
    const open = !$("chat").classList.contains("drawerOpen");
    if (open && isMobileShellViewport()) closeSidebar();
    $("chat").classList.toggle("drawerOpen", open);
    $("toggleChatDrawer").setAttribute("aria-expanded", String(open));
  });
  $("closeChatDrawer")?.addEventListener("click", closeChatDrawer);
  $("chatDrawerBackdrop")?.addEventListener("click", closeChatDrawer);
  $("chatHistorySearch")?.addEventListener("input", renderChatDrawer);

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      $("messageInput").value = button.dataset.prompt || "";
      resizeChatInput();
      $("messageInput").focus();
    });
  });

  const savedDraft = localStorage.getItem("bidocChatDraft");
  if (savedDraft) $("messageInput").value = savedDraft;
  resizeChatInput();
  $("messageInput").addEventListener("input", () => {
    localStorage.setItem("bidocChatDraft", $("messageInput").value);
    resizeChatInput();
  });
  $("messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      $("chatForm").requestSubmit($("chatForm").querySelector("button[type=submit]"));
    }
  });

  $("attachChatFile")?.addEventListener("click", () => $("chatFileInput")?.click());
  $("chatFileInput")?.addEventListener("change", async () => {
    const file = $("chatFileInput").files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      showToast("הקובץ גדול מדי. ניתן לצרף קובץ טקסט עד 1 MB.", "error");
      $("chatFileInput").value = "";
      return;
    }
    try {
      state.chatAttachments = [{ name: file.name, size: file.size, content: await file.text() }];
      renderComposerContext();
      showToast("הקובץ יצורף כהקשר לשאלה הבאה");
    } catch {
      showToast("לא ניתן היה לקרוא את הקובץ", "error");
    }
    $("chatFileInput").value = "";
  });
  $("toggleProjectSources")?.addEventListener("click", () => {
    state.chatSourcesEnabled = !state.chatSourcesEnabled;
    toggleComposerTool($("toggleProjectSources"), state.chatSourcesEnabled);
    renderComposerContext();
  });
  $("toggleDeepResearch")?.addEventListener("click", () => {
    state.deepResearchEnabled = !state.deepResearchEnabled;
    toggleComposerTool($("toggleDeepResearch"), state.deepResearchEnabled);
    renderComposerContext();
  });
  $("toggleComposerMenu")?.addEventListener("click", () => {
    setComposerMenuOpen(!state.composerMenuOpen);
  });
  document.addEventListener("click", (event) => {
    if (!state.composerMenuOpen) return;
    const composer = $("chatForm");
    if (!composer || composer.contains(event.target)) return;
    setComposerMenuOpen(false);
  });

  $("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.chatRequest) {
      state.chatRequest.abort();
      state.eventSource?.close();
      return;
    }
    const message = $("messageInput").value.trim();
    if (!message) return;
    setComposerMenuOpen(false);
    if (!$("sessionId").value) setCurrentSession(createSessionId());
    const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    $("messageInput").value = "";
    localStorage.removeItem("bidocChatDraft");
    resizeChatInput();
    $("chatWelcome")?.setAttribute("hidden", "");
    const userNode = addMessage(message, "user", { editable: true });
    const pending = addProgressMessage();
    state.chatProgress = { runId, node: pending, lastText: "מבין את הבקשה…" };
    const requestController = new AbortController();
    state.chatRequest = requestController;
    setChatRunning(true);
    startLiveRun(runId);
    try {
      const result = await api("/api/chat", {
        method: "POST",
        body: {
          message,
          sessionId: $("sessionId").value,
          runId,
          sourcesEnabled: state.chatSourcesEnabled,
          deepResearch: state.deepResearchEnabled,
          attachments: state.chatAttachments.map(({ name, content }) => ({ name, content }))
        },
        timeoutMs: 120000,
        signal: requestController.signal
      });
      clearChatProgress(pending);
      pending.className = "message assistant";
      renderMessageContent(pending, result.answer || "לא התקבלה תשובה.", "assistant");
      if (state.chatProgress?.node === pending) state.chatProgress = null;
      attachAssistantActions(pending, {
        messageId: result.messageId,
        answer: result.answer || "",
        question: message,
        sources: result.sources || [],
        annotation: null
      });
      renderSources(pending, result.sources || []);
      renderFollowUps(pending, result.followUps || defaultFollowUps(result));
      appendDebug(pending, result);
      state.lastWorkflow = result.workflowLog || null;
      state.currentWorkflowMessageId = result.messageId || null;
      if ($("chatTitle")) $("chatTitle").textContent = conversationTitle(message);
      state.chatAttachments = [];
      renderComposerContext();
      await refreshChatSessions();
      try {
        renderWorkflow(state.lastWorkflow);
        loadRunHistory();
      } catch (renderError) {
        console.error("Chat response rendered, but workflow UI refresh failed", renderError);
        appendLiveRunEvent({
          step: "client",
          message: "Workflow UI refresh failed",
          data: { error: renderError.message },
          time: new Date().toISOString()
        });
      }
    } catch (error) {
      clearChatProgress(pending);
      if (state.chatProgress?.node === pending) state.chatProgress = null;
      if (error.name === "AbortError" || /בוטלה/.test(error.message)) {
        renderCancelledMessage(pending);
      } else {
        renderChatError(pending, error, message, userNode);
      }
      appendLiveRunEvent({ step: "client", message: "Request failed", data: { error: error.message }, time: new Date().toISOString() });
    } finally {
      if (state.chatProgress?.node === pending) state.chatProgress = null;
      if (state.chatRequest === requestController) {
        state.chatRequest = null;
        setChatRunning(false);
      }
      $("messageInput").focus();
    }
  });
}

function closeChatDrawer() {
  $("chat")?.classList.remove("drawerOpen");
  $("toggleChatDrawer")?.setAttribute("aria-expanded", "false");
}

function toggleComposerTool(button, active) {
  button?.classList.toggle("active", active);
  button?.setAttribute("aria-pressed", String(active));
}

function resizeChatInput() {
  const input = $("messageInput");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

function setChatRunning(running) {
  $("chatForm")?.classList.toggle("running", running);
  $("messages")?.setAttribute("aria-busy", String(running));
  if ($("sendMessage")) $("sendMessage").setAttribute("aria-label", running ? "עצור יצירה" : "שלח הודעה");
}

function setComposerMenuOpen(open) {
  state.composerMenuOpen = open;
  $("chatForm")?.classList.toggle("composerMenuOpen", open);
  $("toggleComposerMenu")?.setAttribute("aria-expanded", String(open));
}

function renderComposerContext() {
  const container = $("composerContext");
  if (!container) return;
  container.innerHTML = "";
  const chips = [];
  if (state.chatSourcesEnabled) chips.push({ label: "מקורות הפרויקט", removable: false });
  if (state.deepResearchEnabled) chips.push({ label: "חקירה מעמיקה", removable: false });
  for (const file of state.chatAttachments) chips.push({ label: file.name, removable: true });
  for (const chip of chips) {
    const node = document.createElement("span");
    node.className = "contextChip";
    node.append(document.createTextNode(chip.label));
    if (chip.removable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `הסר ${chip.label}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        state.chatAttachments = state.chatAttachments.filter((item) => item.name !== chip.label);
        renderComposerContext();
      });
      node.append(remove);
    }
    container.append(node);
  }
  container.hidden = !chips.length;
}

function startLiveRun(runId) {
  if (state.eventSource) state.eventSource.close();
  document.querySelectorAll(".runHistoryItem.active").forEach((el) => el.classList.remove("active"));
  $("liveRunList").innerHTML = "";
  renderOpenRouterMetrics(null);
  $("liveRunStatus").textContent = `רץ: ${runId}`;
  state.runEvents = [];
  state.fullLogVisible = false;
  if ($("fullLogView")) { $("fullLogView").hidden = true; $("fullLogView").textContent = ""; }
  if ($("liveRunList")) $("liveRunList").hidden = false;
  $("liveRun")?.classList.remove("collapsed");
  resetAgentRuntime();
  renderAgents();
  appendLiveRunEvent({ step: "client", message: "Opening live log", data: { runId }, time: new Date().toISOString() });
  state.eventSource = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  state.eventSource.addEventListener("log", (event) => {
    const item = JSON.parse(event.data);
    appendLiveRunEvent(item);
    if (item.step === "complete" || item.step === "error") {
      $("liveRunStatus").textContent = item.step === "complete" ? "הסתיים" : "שגיאה";
      setTimeout(() => state.eventSource?.close(), 500);
    }
  });
  state.eventSource.onerror = () => {
    $("liveRunStatus").textContent = "הלוג נותק או הסתיים";
  };
}

function appendLiveRunEvent(item) {
  updateAgentRuntime(item);
  updateChatProgress(item);
  state.runEvents.push(item);
  if (item?.data?.openrouter) renderOpenRouterMetrics(summarizeLiveOpenRouterUsage());
  const row = document.createElement("details");
  row.className = `liveRunItem ${item.step === "error" ? "error" : ""}`;
  const summary = document.createElement("summary");
  const time = item.time ? new Date(item.time).toLocaleTimeString("he-IL") : "";
  const usage = item?.data?.openrouter;
  summary.textContent = usage
    ? `${time} · ${item.step} · ${usage.actual_model || usage.requested_model || "OpenRouter"} · ${formatOpenRouterNumber(usage.prompt_tokens)}/${formatOpenRouterNumber(usage.completion_tokens)} tok · ${formatOpenRouterCost(usage.cost)} · ${formatOpenRouterSpeed(usage.tokens_per_second)}`
    : `${time} · ${item.step} · ${item.message}`;
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(item.data || {}, null, 2);
  row.append(summary, pre);
  $("liveRunList").append(row);
  row.scrollIntoView({ block: "end" });
  if (state.fullLogVisible) refreshFullLogView();
}

function updateChatProgress(item) {
  const progress = state.chatProgress;
  if (!progress?.node?.isConnected) return;
  if (item?.step === "client" || item?.step === "complete" || item?.step === "error") return;
  const text = progressTextForRunEvent(item);
  if (!text) return;
  const label = progress.node.querySelector(".progressLabel");
  if (label) label.textContent = text;
  const timeline = progress.node.querySelector(".progressTimeline");
  if (timeline && ![...timeline.children].some((node) => node.textContent === text)) {
    const step = document.createElement("div");
    step.className = "progressStep";
    step.textContent = text;
    timeline.append(step);
  }
  progress.lastText = text;
  progress.node.scrollIntoView({ block: "end" });
}

function clearChatProgress(node) {
  node?.classList.remove("progress", "progressCard");
}

function addProgressMessage() {
  const node = document.createElement("div");
  node.className = "message assistant progress progressCard";
  node.innerHTML = `
    <div class="progressHeader">
      <span class="progressSpinner" aria-hidden="true"></span>
      <span class="progressLabel">מבין את הבקשה…</span>
      <button class="progressDetailsButton" type="button" aria-expanded="false">הצג פרטים</button>
    </div>
    <div class="progressTimeline"><div class="progressStep">הבקשה התקבלה</div></div>
  `;
  node.querySelector(".progressDetailsButton").addEventListener("click", (event) => {
    const open = node.classList.toggle("detailsOpen");
    event.currentTarget.setAttribute("aria-expanded", String(open));
    event.currentTarget.textContent = open ? "הסתר פרטים" : "הצג פרטים";
  });
  $("messages").append(node);
  node.scrollIntoView({ block: "end" });
  return node;
}

function progressTextForRunEvent(item) {
  const step = String(item?.step || "");
  const message = String(item?.message || "");
  const tool = toolNameFromRunEvent(item);

  if (step === "complete" || step === "created" || step === "local_memory" || step === "update_message") return "";
  if (step === "client" && !/failed|error/i.test(message)) return "";
  if (step === "error" || /failed|error/i.test(message)) return "ממשיך לבדוק...";
  if (tool) return progressTextForTool(tool);

  return {
    classifier: "מבין את הבקשה...",
    memory: "בודק את היסטוריית השיחה...",
    knowledge_vocabulary: "בודק מאגר ידע...",
    knowledge_planner: "בודק מאגר ידע...",
    hybrid_search: "בודק מאגר פרויקט...",
    alert_agent: "בודק מול סוכן התראות...",
    reranker: "מסדר את הממצאים...",
    source_quality: "בודק אמינות מקורות...",
    conflict_detection: "בודק אמינות מקורות...",
    main_agent: "מרכיב תשובה...",
    lite_agent: "מרכיב תשובה...",
    safety_precheck: "בודק אירועי בטיחות...",
    n8n_tools: "בודק מול סוכני הפרויקט...",
    switch: "בוחר את מסלול הבדיקה...",
    sanitize: "מכין את הבקשה...",
    save_message: "פותח ריצה חדשה...",
    investigation: "בודק לעומק את הממצאים..."
  }[step] || "ממשיך לבדוק...";
}

function toolNameFromRunEvent(item) {
  const message = String(item?.message || "");
  const data = item?.data || {};
  const explicitTool = String(data.toolName || data.tool || "").trim();
  if (explicitTool) return explicitTool;

  const toolMatch = message.match(/\b(?:Tool|tool|precheck)\s+([a-z_]+)\b/i);
  if (toolMatch) return toolMatch[1];

  const tools = Array.isArray(data.tools) ? data.tools : [];
  if (tools.length === 1) return String(tools[0] || "").trim();
  if (tools.includes("alert")) return "alert";
  if (tools.includes("meetings")) return "meetings";
  if (tools.includes("emails")) return "emails";
  if (tools.includes("whatsapp_messages")) return "whatsapp_messages";
  return "";
}

function progressTextForTool(tool) {
  return {
    alert: "בודק מול סוכן התראות...",
    meetings: "בודק מול סוכן ישיבות...",
    emails: "בודק מול מיילים...",
    whatsapp_messages: "בודק מול הודעות וואטסאפ...",
    safety_report: "בודק אירועי בטיחות...",
    financial_transactions: "בודק נתונים פיננסיים...",
    consultants_reports: "בודק דוחות יועצים...",
    exceptions_report: "בודק דוח חריגים...",
    quality_control: "בודק בקרת איכות...",
    schedule: "בודק לוחות זמנים...",
    submittals: "בודק אישורי חומרים..."
  }[tool] || "בודק מול סוכני הפרויקט...";
}

function buildFullLogText() {
  return state.runEvents.map((item) => {
    const time = item.time ? new Date(item.time).toLocaleTimeString("he-IL") : "??:??:??";
    const step = (item.step || "").padEnd(20);
    const msg  = (item.message || "").padEnd(40);
    const data = Object.keys(item.data || {}).length
      ? JSON.stringify(item.data)
      : "";
    return `[${time}] ${step} ${msg} ${data}`.trimEnd();
  }).join("\n");
}

function refreshFullLogView() {
  const el = $("fullLogView");
  if (!el) return;
  el.textContent = buildFullLogText();
  el.scrollTop = el.scrollHeight;
}

function wireAgents() {
  $("refreshModels")?.addEventListener("click", loadOpenRouterModels);
}

function resetAgentRuntime() {
  state.agentRuntime = Object.fromEntries(
    (state.agents || [])
      .filter((agent) => agent && agent.id)
      .map((agent) => [agent.id, { status: "idle", lastMessage: "ממתין", input: null, output: null }])
  );
}

function updateAgentRuntime(item) {
  if (item.step === "complete" || item.step === "error") {
    const finalStatus = item.step === "complete" ? "done" : "error";
    state.agentRuntime = Object.fromEntries(
      Object.entries(state.agentRuntime).map(([agentId, runtime]) => [
        agentId,
        runtime.status === "thinking"
          ? { ...runtime, status: finalStatus, lastMessage: item.message || runtime.lastMessage, output: item.data || runtime.output }
          : runtime
      ])
    );
    renderAgents();
    return;
  }
  const agentId = agentIdForStep(item.step);
  if (!agentId) return;
  const current = state.agentRuntime[agentId] || { status: "idle", lastMessage: "ממתין" };
  const status = statusForRunEvent(item);
  state.agentRuntime[agentId] = {
    ...current,
    status,
    lastMessage: item.message || current.lastMessage,
    input: status === "thinking" ? item.data || current.input : current.input,
    output: status !== "thinking" ? item.data || current.output : current.output
  };
  renderAgents();
}

function agentIdForStep(step) {
  return {
    classifier: "classifier",
    knowledge_planner: "knowledge_planner",
    lite_agent: "lite",
    main_agent: "main",
    reranker: "reranker"
  }[step] || null;
}

function statusForRunEvent(item) {
  if (item.step === "error" || /failed|missing/i.test(item.message || "")) return "error";
  if (/calling|classifying|running/i.test(item.message || "")) return "thinking";
  if (/completed|received|fallback/i.test(item.message || "")) return "done";
  return "thinking";
}

function renderAgents() {
  const grid = $("agentGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const agents = (state.agents || []).filter((agent) => agent && agent.id);
  if (!agents.length) {
    grid.textContent = "טוען סוכנים...";
    return;
  }
  for (const agent of agents) {
    const runtime = state.agentRuntime[agent.id] || { status: "idle", lastMessage: "ממתין" };
    const card = document.createElement("article");
    card.className = `agentCard ${runtime.status}`;
    card.innerHTML = `
      <header>
        <div>
          <strong>${escapeHtml(agent.name)}</strong>
          <span>${escapeHtml(agent.description || "")}</span>
        </div>
        <mark>${agentStatusLabel(runtime.status)}</mark>
      </header>
      <div class="agentMeta">
        <span>Step: ${escapeHtml(agent.step || "")}</span>
        <span>Model: ${escapeHtml(agent.model || "")}</span>
      </div>
      <details open>
        <summary>פרומפט פעיל</summary>
        <pre class="agentPromptPreview">${escapeHtml(agent.prompt || "")}</pre>
      </details>
      <details>
        <summary>לוג אחרון של הסוכן</summary>
        <pre>${escapeHtml(JSON.stringify({
          status: runtime.status,
          message: runtime.lastMessage,
          input: runtime.input,
          output: runtime.output
        }, null, 2))}</pre>
      </details>
    `;
    grid.append(card);
  }
}

async function loadOpenRouterModels() {
  if ($("modelListStatus")) $("modelListStatus").textContent = "טוען רשימת מודלים מ-OpenRouter...";
  try {
    const result = await api("/api/openrouter/models");
    state.openRouterModels = result.models || [];
    state.openRouterModelsFallback = Boolean(result.fallback);
    if ($("modelListStatus")) {
      $("modelListStatus").textContent = result.fallback
        ? `OpenRouter לא החזיר רשימה כרגע, מוצגת רשימת גיבוי. ${result.error || ""}`.trim()
        : `נטענו ${state.openRouterModels.length} מודלים מ-OpenRouter.`;
    }
  } catch (error) {
    state.openRouterModels = [];
    if ($("modelListStatus")) $("modelListStatus").textContent = `לא ניתן לטעון מודלים: ${error.message}`;
  }
  renderAgents();
  applyModelSelectsToSettingsForm();
  applyLinkAgentSettingsToForm();
}

function modelOptions(selectedModel) {
  const models = (state.openRouterModels || []).filter((model) => model && model.id);
  if (selectedModel && !models.some((model) => model.id === selectedModel)) {
    models.unshift({ id: selectedModel, name: selectedModel, contextLength: null, pricing: null });
  }
  if (!models.length) {
    return `<option value="${escapeHtml(selectedModel)}">${escapeHtml(selectedModel || "אין רשימת מודלים זמינה")}</option>`;
  }
  return models.map((model) => {
    const label = `${model.name || model.id}${model.contextLength ? ` · ${Number(model.contextLength).toLocaleString()} ctx` : ""}`;
    return `<option value="${escapeHtml(model.id)}" ${model.id === selectedModel ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function fillModelSelect(select, selectedModel) {
  if (!select) return;
  select.innerHTML = modelOptionsWithPricing(selectedModel);
  select.value = selectedModel || "";
}

function modelOptionsWithPricing(selectedModel) {
  const models = (state.openRouterModels || []).filter((model) => model && model.id);
  if (selectedModel && !models.some((model) => model.id === selectedModel)) {
    models.unshift({ id: selectedModel, name: selectedModel, contextLength: null, pricing: null });
  }
  if (!models.length) {
    return `<option value="${escapeHtml(selectedModel)}">${escapeHtml(selectedModel || "No models available")}</option>`;
  }
  return models.map((model) => {
    const label = [
      model.name || model.id,
      formatContextLength(model.contextLength),
      formatModelPricing(model.pricing)
    ].filter(Boolean).join(" · ");
    return `<option value="${escapeHtml(model.id)}" ${model.id === selectedModel ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function formatContextLength(contextLength) {
  const value = Number(contextLength);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)}M ctx`;
  if (value >= 1_000) return `${trimNumber(value / 1_000)}K ctx`;
  return `${value.toLocaleString()} ctx`;
}

function formatModelPricing(pricing = {}) {
  const input = pricePerMillion(pricing?.prompt ?? pricing?.input);
  const output = pricePerMillion(pricing?.completion ?? pricing?.output);
  return [
    input != null ? `in $${formatPrice(input)}/M` : "",
    output != null ? `out $${formatPrice(output)}/M` : ""
  ].filter(Boolean).join(" · ");
}

function pricePerMillion(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number * 1_000_000;
}

function formatPrice(value) {
  if (value === 0) return "0";
  if (value < 0.01) return value.toPrecision(2);
  if (value < 1) return trimNumber(value.toFixed(4));
  return trimNumber(value.toFixed(2));
}

function trimNumber(value) {
  return String(value).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function applyModelSelectsToSettingsForm() {
  const models = state.settings?.models || {};
  fillModelSelect($("modelClassifier"), models.classifier || "");
  fillModelSelect($("modelKnowledgePlanner"), models.knowledgePlanner || "");
  fillModelSelect($("modelMain"), models.main || "");
  fillModelSelect($("modelLite"), models.lite || "");
  fillModelSelect($("modelEmbedding"), models.embedding || "");
  fillModelSelect($("modelReranker"), models.reranker || "");
  fillModelSelect($("modelQa"), models.qa || models.main || "");
}

function agentStatusLabel(status) {
  return {
    idle: "ממתין",
    thinking: "חושב",
    done: "סיים",
    error: "שגיאה"
  }[status] || status;
}

function wireKnowledge() {
  $("refreshKnowledge").addEventListener("click", loadKnowledgeDocuments);
  $("uploadKnowledge").addEventListener("click", uploadKnowledgeDocument);
  $("deleteKnowledge").addEventListener("click", deleteSelectedKnowledgeDocument);
  $("runKnowledgeSearch").addEventListener("click", runKnowledgeSearch);
}

function wireReset() {
  $("restartServer").addEventListener("click", restartServer);
}

function wireLogout() {
  const button = $("logoutButton");
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — redirect to login regardless
    }
    location.href = "/login.html";
  });
}

function wireEvaluation() {
  const input = $("evaluationCases");
  if (!input) return;
  input.value = JSON.stringify(defaultEvaluationCases(), null, 2);
  $("runEvaluation").addEventListener("click", runEvaluation);
}

function defaultEvaluationCases() {
  return [
    {
      message: "שלום, מי אתה?",
      expectedType: "CHAT"
    },
    {
      message: "תראה לי חשבונית 500",
      expectedType: "RAG",
      expectedTools: ["financial_transactions"]
    },
    {
      message: "יש בעיית בטיחות באתר?",
      expectedType: "RAG",
      expectedTools: ["safety_report", "alert"]
    },
    {
      message: "איך מחליטים אם ליקוי בטיחותי דורש עצירת עבודה?",
      expectedType: "RAG",
      expectedProfessional: true
    }
  ];
}

async function runEvaluation() {
  const button = $("runEvaluation");
  const summary = $("evaluationSummary");
  const results = $("evaluationResults");
  button.disabled = true;
  summary.textContent = "מריץ בדיקות...";
  results.innerHTML = "";
  try {
    const cases = JSON.parse($("evaluationCases").value || "[]");
    const output = await api("/api/evaluations/run", {
      method: "POST",
      body: { cases, sessionId: `eval_${Date.now()}` }
    });
    summary.textContent = `${output.passed}/${output.total} עברו · ${output.failed} נכשלו`;
    results.innerHTML = "";
    for (const item of output.results || []) {
      const card = document.createElement("article");
      card.className = `evaluationCard ${item.ok ? "passed" : "failed"}`;
      card.innerHTML = `
        <header>
          <strong>${escapeHtml(item.ok ? "עבר" : "נכשל")} · ${escapeHtml(item.message || "")}</strong>
          <span>${escapeHtml(item.runId || "")}</span>
        </header>
        <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
      `;
      results.append(card);
    }
  } catch (error) {
    summary.textContent = `שגיאה בהרצת בדיקות: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function restartServer() {
  const button = $("restartServer");
  const status = $("restartStatus");
  button.disabled = true;
  status.textContent = "שולח בקשת restart לשרת...";
  try {
    await api("/api/system/restart", { method: "POST", body: {} });
    status.textContent = "השרת נסגר ועולה מחדש. ממתין לחיבור...";
    await waitForServer();
    status.textContent = "השרת חזר. מרענן את האפליקציה...";
    setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    status.textContent = `שגיאה בהפעלת restart: ${error.message}`;
    button.disabled = false;
  }
}

async function waitForServer() {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The server is expected to be unavailable while restarting.
    }
    $("restartStatus").textContent = `ממתין לחזרת השרת... ניסיון ${attempt}/30`;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error("השרת לא חזר בזמן הצפוי. הפעל אותו ידנית דרך CMD.");
}

async function loadKnowledgeDocuments() {
  const list = $("knowledgeList");
  if (!list) return;
  await loadKnowledgeAgents();
  const agentId = state.selectedKnowledgeAgent || "schedule";
  const result = await api(`/api/knowledge/documents?agentId=${encodeURIComponent(agentId)}`);
  list.innerHTML = "";
  if (!result.documents?.length) {
    list.textContent = "אין מסמכים עדיין.";
    return;
  }
  for (const item of result.documents) {
    const button = document.createElement("button");
    button.className = `knowledgeItem${item.readOnly ? " readOnly" : ""}`;
    const sourceLabel = item.source === "agent" ? "Built-in agent" : "Uploaded";
    const readOnlyLabel = item.readOnly ? "read-only" : "editable";
    button.innerHTML = `
      <strong>${escapeHtml(item.filename)}</strong>
      <span>${Number(item.size || 0).toLocaleString()} bytes · ${escapeHtml(new Date(item.updatedAt).toLocaleString("he-IL"))}</span>
      <small>${escapeHtml(sourceLabel)} · ${escapeHtml(readOnlyLabel)}</small>
    `;
    button.addEventListener("click", () => openKnowledgeDocument(item.filename, item.agentId, item.source));
    list.append(button);
  }
}

async function loadKnowledgeAgents() {
  if (state.knowledgeAgents.length) {
    renderKnowledgeAgents();
    return;
  }
  const result = await api("/api/knowledge/agents");
  state.knowledgeAgents = result.agents || [];
  if (!state.knowledgeAgents.some((agent) => agent.id === state.selectedKnowledgeAgent)) {
    state.selectedKnowledgeAgent = state.knowledgeAgents[0]?.id || "schedule";
  }
  renderKnowledgeAgents();
}

function renderKnowledgeAgents() {
  const wrap = $("knowledgeAgents");
  const select = $("knowledgeAgentSelect");
  if (select) {
    select.innerHTML = "";
    for (const agent of state.knowledgeAgents) {
      select.append(new Option(agent.name, agent.id, agent.id === state.selectedKnowledgeAgent, agent.id === state.selectedKnowledgeAgent));
    }
    select.onchange = () => {
      state.selectedKnowledgeAgent = select.value || "schedule";
      state.selectedKnowledgeDocument = null;
      $("knowledgePreviewTitle").textContent = "תצוגת מסמך";
      $("knowledgePreview").textContent = "בחר מסמך מהרשימה.";
      $("deleteKnowledge").disabled = true;
      loadKnowledgeDocuments();
    };
  }
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const agent of state.knowledgeAgents) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `knowledgeAgentCard ${agent.id === state.selectedKnowledgeAgent ? "active" : ""}`;
    const tagText = (agent.tags || []).join(", ");
    button.title = [agent.name, agent.description || "", tagText].filter(Boolean).join("\n");
    button.innerHTML = `
      <strong>${escapeHtml(agent.name)}</strong>
      <span>${escapeHtml(agent.description || "")}</span>
      <small>${escapeHtml(tagText)}</small>
    `;
    button.addEventListener("click", () => {
      state.selectedKnowledgeAgent = agent.id;
      state.selectedKnowledgeDocument = null;
      $("knowledgePreviewTitle").textContent = "תצוגת מסמך";
      $("knowledgePreview").textContent = "בחר מסמך מהרשימה.";
      $("deleteKnowledge").disabled = true;
      renderKnowledgeAgents();
      loadKnowledgeDocuments();
    });
    wrap.append(button);
  }
}

async function uploadKnowledgeDocument() {
  const file = $("knowledgeFile").files?.[0];
  if (!file) return;
  $("uploadKnowledge").disabled = true;
  try {
    const content = await file.text();
    await api("/api/knowledge/documents", {
      method: "POST",
      body: { filename: file.name, content, agentId: state.selectedKnowledgeAgent || "schedule" }
    });
    $("knowledgeFile").value = "";
    await loadKnowledgeDocuments();
    showToast(`"${file.name}" הועלה בהצלחה`);
  } catch (error) {
    showToast(`שגיאה בהעלאה: ${error.message}`, "error");
  } finally {
    $("uploadKnowledge").disabled = false;
  }
}

async function openKnowledgeDocument(filename, agentId = state.selectedKnowledgeAgent, source = "") {
  const sourceParam = source ? `&source=${encodeURIComponent(source)}` : "";
  const result = await api(`/api/knowledge/documents/${encodeURIComponent(filename)}?agentId=${encodeURIComponent(agentId || "schedule")}${sourceParam}`);
  const document = result.document || {};
  state.selectedKnowledgeDocument = {
    filename: document.filename || filename,
    agentId: document.agentId || agentId || "schedule",
    source: document.source || source || "upload",
    readOnly: Boolean(document.readOnly)
  };
  state.selectedKnowledgeAgent = result.document.agentId || agentId || "schedule";
  $("knowledgePreviewTitle").textContent = result.document.filename;
  $("knowledgePreview").textContent = result.document.content || "";
  $("deleteKnowledge").disabled = Boolean(result.document.readOnly);
}

async function deleteSelectedKnowledgeDocument() {
  if (!state.selectedKnowledgeDocument) return;
  if (state.selectedKnowledgeDocument.readOnly) return;
  const filename = state.selectedKnowledgeDocument.filename;
  const agentId = state.selectedKnowledgeDocument.agentId || state.selectedKnowledgeAgent || "schedule";
  const source = state.selectedKnowledgeDocument.source || "upload";
  $("deleteKnowledge").disabled = true;
  try {
    await api(`/api/knowledge/documents/${encodeURIComponent(filename)}?agentId=${encodeURIComponent(agentId)}&source=${encodeURIComponent(source)}`, { method: "DELETE" });
    state.selectedKnowledgeDocument = null;
    $("knowledgePreviewTitle").textContent = "תצוגת מסמך";
    $("knowledgePreview").textContent = "בחר מסמך מהרשימה.";
    await loadKnowledgeDocuments();
    showToast(`"${filename}" נמחק בהצלחה`);
  } catch (error) {
    $("deleteKnowledge").disabled = false;
    showToast(`שגיאה במחיקה: ${error.message}`, "error");
  }
}

async function runKnowledgeSearch() {
  $("knowledgeSearchResult").textContent = "מחפש...";
  try {
    const result = await api("/api/knowledge/search", {
      method: "POST",
      body: {
        query: $("knowledgeQuery").value,
        tags: $("knowledgeTags").value,
        agentId: $("knowledgeAgentSelect")?.value || state.selectedKnowledgeAgent || "schedule",
        topK: Number($("knowledgeTopK").value || 6)
      }
    });
    $("knowledgeSearchResult").textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    $("knowledgeSearchResult").textContent = error.message;
  }
}

// var (not let): init() runs at the top of the file before this line executes,
// and a let binding here is still in its temporal dead zone at that point.
var _workflowWired = false;
function wireWorkflow() {
  // The workflow page is rendered by a React island that may mount after init().
  // Guard so this binds exactly once, and only after the DOM actually exists.
  if (_workflowWired) return;
  if (!$("clearWorkflow")) return;
  _workflowWired = true;

  $("liveRunHeader")?.addEventListener("click", () => {
    $("liveRun")?.classList.toggle("collapsed");
  });

  $("clearWorkflow")?.addEventListener("click", () => {
    state.lastWorkflow = null;
    state.currentWorkflowMessageId = null;
    state.runEvents = [];
    state.fullLogVisible = false;
    clearWorkflowCompare(false);
    $("liveRunList").innerHTML = "";
    $("liveRunStatus").textContent = "ממתין לבקשה";
    if ($("fullLogView")) { $("fullLogView").hidden = true; $("fullLogView").textContent = ""; }
    if ($("liveRunList")) $("liveRunList").hidden = false;
    renderWorkflowAiReport(null);
    renderWorkflow(null);
  });

  $("toggleFullLog")?.addEventListener("click", () => {
    state.fullLogVisible = !state.fullLogVisible;
    const listEl = $("liveRunList");
    const logEl  = $("fullLogView");
    const btn    = $("toggleFullLog");
    if (state.fullLogVisible) {
      refreshFullLogView();
      listEl.hidden = true;
      logEl.hidden  = false;
      btn.textContent = "לוג רגיל";
    } else {
      listEl.hidden = false;
      logEl.hidden  = true;
      btn.textContent = "לוג מלא";
    }
  });

  $("copyLog")?.addEventListener("click", async () => {
    const text = buildFullLogText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("הלוג הועתק ללוח");
    } catch {
      showToast("לא ניתן להעתיק", "error");
    }
  });
  $("runAiReport")?.addEventListener("click", runWorkflowAiReport);
  $("fitWorkflow")?.addEventListener("click", fitWorkflowToScreen);
  $("toggleWorkflowCards")?.addEventListener("click", () => {
    state.workflowCardsExpanded = !state.workflowCardsExpanded;
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowSearch")?.addEventListener("input", (event) => {
    state.workflowFilters.query = event.target.value || "";
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowStatusFilter")?.addEventListener("change", (event) => {
    state.workflowFilters.status = event.target.value || "";
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowErrorsOnly")?.addEventListener("click", () => {
    state.workflowFilters.errorsOnly = !state.workflowFilters.errorsOnly;
    state.workflowFilters.issue = "";
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowSlowNodes")?.addEventListener("click", () => {
    state.workflowFilters.issue = state.workflowFilters.issue === "slow" ? "" : "slow";
    state.workflowFilters.errorsOnly = false;
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowExpensiveNodes")?.addEventListener("click", () => {
    state.workflowFilters.issue = state.workflowFilters.issue === "expensive" ? "" : "expensive";
    state.workflowFilters.errorsOnly = false;
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowFallbackNodes")?.addEventListener("click", () => {
    state.workflowFilters.issue = state.workflowFilters.issue === "fallback" ? "" : "fallback";
    state.workflowFilters.errorsOnly = false;
    renderWorkflow(state.lastWorkflow);
  });
  $("workflowRegressionNodes")?.addEventListener("click", () => {
    state.workflowFilters.issue = state.workflowFilters.issue === "regression" ? "" : "regression";
    state.workflowFilters.errorsOnly = false;
    renderWorkflow(state.lastWorkflow);
  });
  $("clearWorkflowCompare")?.addEventListener("click", () => clearWorkflowCompare());
  $("resetWorkflowFilters")?.addEventListener("click", () => {
    state.workflowFilters = { query: "", status: "", errorsOnly: false, issue: "" };
    if ($("workflowSearch")) $("workflowSearch").value = "";
    if ($("workflowStatusFilter")) $("workflowStatusFilter").value = "";
    renderWorkflow(state.lastWorkflow);
  });
}

// Called by the React WorkflowPage island after it mounts, so wiring + rendering
// happen regardless of whether init() ran before or after the island mounted.
window.__bidocInitWorkflow = () => {
  wireWorkflow();
  if (state?.runHistory?.length) renderRunHistoryStrip(state.runHistory);
  if (state?.lastWorkflow) renderWorkflow(state.lastWorkflow);
};

function renderWorkflow(workflow) {
  const inspector = $("workflowInspector");
  if (inspector) inspector.innerHTML = '<div class="workflowInspectorEmpty">בחר רכיב בגרף כדי לראות Input / Output.</div>';

  if (_cy) { _cy.destroy(); _cy = null; }

  const view = buildWorkflowView(workflow);
  const hasRun = Boolean(workflow?.nodes?.length);
  renderWorkflowMetrics(workflow);
  renderOpenRouterMetrics(workflow?.openRouterUsage?.totals || null);
  $("workflowHint").style.display = hasRun ? "none" : "block";
  $("workflowBoard").classList.toggle("hasWorkflow", hasRun);
  $("workflowToolbar")?.toggleAttribute("hidden", !hasRun);
  const toggleCards = $("toggleWorkflowCards");
  if (toggleCards) toggleCards.textContent = state.workflowCardsExpanded ? "Collapse" : "Expand";
  const compareSummary = workflowCompareSummary(view.nodes, view.edges);
  state.workflowCompare.summary = compareSummary;
  renderWorkflowCompareSummary(compareSummary);

  if (!hasRun || !view.nodes.length) return;
  const filterSummary = workflowFilterSummary(view.nodes);
  renderWorkflowFilterControls(filterSummary);

  const visibleNodeIds = new Set(view.nodes.map((node) => node.id));
  const renderableRemovedEdges = (compareSummary.removedEdges || [])
    .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));
  const elements = view.nodes.map((node) => ({
    group: "nodes",
    data: {
      id: node.id,
      label: node.label,
      subtitle: node.id,
      kind: node.kind,
      status: node.status,
      nodeData: node,
      expanded: state.workflowCardsExpanded,
      cardWidth: state.workflowCardsExpanded ? 430 : 280,
      cardHeight: state.workflowCardsExpanded ? 310 : 126,
      compareState: compareSummary.nodeStates.get(node.id) || "",
      cardLabel: workflowNodeCardLabel(node, state.workflowCardsExpanded, compareSummary.nodeStates.get(node.id) || ""),
      cardSvg: generateNodeCardSvg(
        node, 
        state.workflowCardsExpanded, 
        compareSummary.nodeStates.get(node.id) || "",
        compareSummary.regressionNodes.has(node.id)
      ),
      regression: compareSummary.regressionNodes.has(node.id),
      filtered: !filterSummary.matches.has(node.id),
      searchMatch: filterSummary.searchMatches.has(node.id),
      issueMatch: filterSummary.issueMatches.has(node.id),
      fallback: filterSummary.fallbackMatches.has(node.id)
    }
  })).concat(view.edges.map((edge) => ({
    group: "edges",
    data: {
      id: `${edge.from}_${edge.to}`,
      source: edge.from,
      target: edge.to,
      active: edge.active ? true : false,
      edgeData: edge,
      compareState: compareSummary.edgeStates.get(edgeKey(edge)) || "",
      regression: compareSummary.removedEdges.some((removed) => edgeKey(removed) === edgeKey(edge)),
      filtered: !filterSummary.matches.has(edge.from) || !filterSummary.matches.has(edge.to),
      fallback: filterSummary.fallbackMatches.has(edge.from) || filterSummary.fallbackMatches.has(edge.to) || Boolean(edge.fallback)
    }
  }))).concat(renderableRemovedEdges.map((edge) => ({
    group: "edges",
    data: {
      id: `${edge.from}_${edge.to}_removed`,
      source: edge.from,
      target: edge.to,
      active: false,
      edgeData: { ...edge, removed: true },
      compareState: "removed",
      filtered: !filterSummary.matches.has(edge.from) || !filterSummary.matches.has(edge.to),
      fallback: Boolean(edge.fallback)
    }
  })));

  const graphOptions = {
    container: $("workflowCy"),
    elements,
    style: cytoscapeStyle()
  };
  try {
    _cy = cytoscape({
      ...graphOptions,
      layout: { name: "dagre", rankDir: "LR", nodeSep: 72, rankSep: state.workflowCardsExpanded ? 190 : 120, padding: 90, animate: false }
    });
  } catch (error) {
    console.warn("Dagre workflow layout is unavailable; using the built-in breadthfirst layout.", error);
    _cy?.destroy();
    _cy = cytoscape({
      ...graphOptions,
      layout: { name: "breadthfirst", directed: true, circle: false, spacingFactor: state.workflowCardsExpanded ? 1.9 : 1.25, padding: 90, animate: false }
    });
  }

  _cy.on("tap", "node", (evt) => {
    const node = evt.target.data("nodeData");
    const action = workflowNodeCardActionAt(evt.target, evt.position);
    if (action === "log") {
      renderWorkflowInspector(node, { focus: "logs" });
      const count = workflowLogsForNode(node.id).length;
      showToast(count ? `מוצגים ${count} לוגים לרכיב` : "אין לוגים שמורים לרכיב הזה", count ? "success" : "error");
      return;
    }
    if (action === "copy") {
      copyWorkflowNodePayload(node);
      return;
    }
    renderWorkflowInspector(node);
  });
  _cy.on("tap", "edge", (evt) => {
    renderWorkflowEdgeInspector(evt.target.data("edgeData"), view);
  });

  const firstVisible = view.nodes.find((node) => filterSummary.matches.has(node.id)) || view.nodes[0];
  if (firstVisible) renderWorkflowInspector(firstVisible);
  requestAnimationFrame(() => focusWorkflowStart(firstVisible?.id));

  pulseErrorNodes(_cy);
}

function workflowFilterSummary(nodes) {
  const filters = state.workflowFilters || {};
  const query = normalizeWorkflowQuery(filters.query);
  const matches = new Set();
  const searchMatches = new Set();
  const issueMatches = new Set();
  const fallbackMatches = new Set(nodes.filter(workflowNodeHasFallback).map((node) => node.id));
  const regressionMatches = new Set(state.workflowCompare?.summary?.regressionNodes?.keys?.() || []);
  for (const node of nodes) {
    const metrics = workflowNodeMetrics(node);
    const searchOk = !query || workflowNodeSearchText(node).includes(query);
    const statusOk = !filters.status || node.status === filters.status;
    const errorOk = !filters.errorsOnly || node.status === "error" || Boolean(workflowNodeErrorText(node));
    const issueOk = !filters.issue
      || (filters.issue === "slow" && metrics.durationMs >= 1500)
      || (filters.issue === "expensive" && metrics.costValue !== null && metrics.costValue >= 0.0001)
      || (filters.issue === "fallback" && fallbackMatches.has(node.id))
      || (filters.issue === "regression" && regressionMatches.has(node.id));
    if (searchOk && statusOk && errorOk && issueOk) matches.add(node.id);
    if (query && searchOk) searchMatches.add(node.id);
    if (filters.issue && issueOk) issueMatches.add(node.id);
  }
  const active = Boolean(query || filters.status || filters.errorsOnly || filters.issue);
  return { matches, searchMatches, issueMatches, fallbackMatches, regressionMatches, active, count: matches.size, total: nodes.length };
}

function renderWorkflowFilterControls(summary) {
  const filters = state.workflowFilters || {};
  if ($("workflowSearch") && $("workflowSearch").value !== filters.query) $("workflowSearch").value = filters.query || "";
  if ($("workflowStatusFilter") && $("workflowStatusFilter").value !== filters.status) $("workflowStatusFilter").value = filters.status || "";
  $("workflowErrorsOnly")?.classList.toggle("active", Boolean(filters.errorsOnly));
  $("workflowSlowNodes")?.classList.toggle("active", filters.issue === "slow");
  $("workflowExpensiveNodes")?.classList.toggle("active", filters.issue === "expensive");
  $("workflowFallbackNodes")?.classList.toggle("active", filters.issue === "fallback");
  $("workflowRegressionNodes")?.classList.toggle("active", filters.issue === "regression");
  const summaryEl = $("workflowIssueSummary");
  if (summaryEl) {
    const fallbackLabel = summary.fallbackMatches?.size ? ` · ${summary.fallbackMatches.size} fallback` : "";
    summaryEl.textContent = summary.active
      ? `${summary.count}/${summary.total} matches`
      : `${summary.total} nodes${fallbackLabel}`;
  }
}

function workflowCompareSummary(nodes, edges) {
  const baseWorkflow = state.workflowCompare?.baseRun?.workflow_log;
  const activeWorkflow = state.workflowCompare?.compareRun?.workflow_log || state.lastWorkflow;
  const active = Boolean(baseWorkflow?.nodes?.length && activeWorkflow?.nodes?.length);
  const empty = {
    active: false,
    nodeStates: new Map(),
    edgeStates: new Map(),
    addedEdges: [],
    removedEdges: [],
    performance: null,
    regressions: [],
    regressionNodes: new Map(),
    added: 0,
    changed: 0,
    same: 0,
    removed: 0,
    routeAdded: 0,
    routeRemoved: 0,
    baseLabel: "",
    compareLabel: ""
  };
  if (!active) return empty;

  const baseNodes = new Map((baseWorkflow.nodes || []).map((node) => [node.id, node]));
  const currentNodes = new Map(nodes.map((node) => [node.id, node]));
  const nodeStates = new Map();
  let added = 0;
  let changed = 0;
  let same = 0;
  for (const node of nodes) {
    const baseNode = baseNodes.get(node.id);
    if (!baseNode) {
      nodeStates.set(node.id, "added");
      added += 1;
    } else if (workflowCompareFingerprint(baseNode) !== workflowCompareFingerprint(node)) {
      nodeStates.set(node.id, "changed");
      changed += 1;
    } else {
      nodeStates.set(node.id, "same");
      same += 1;
    }
  }
  const removed = [...baseNodes.keys()].filter((id) => !currentNodes.has(id)).length;

  const baseEdges = new Set((baseWorkflow.edges || []).map(edgeKey));
  const currentEdges = new Set(edges.map(edgeKey));
  const edgeStates = new Map();
  const addedEdges = [];
  let routeAdded = 0;
  for (const edge of edges) {
    const key = edgeKey(edge);
    if (!baseEdges.has(key)) {
      edgeStates.set(key, "added");
      addedEdges.push(edge);
      routeAdded += 1;
    } else {
      edgeStates.set(key, "same");
    }
  }
  const removedEdgeKeys = [...baseEdges].filter((key) => !currentEdges.has(key));
  const baseEdgeByKey = new Map((baseWorkflow.edges || []).map((edge) => [edgeKey(edge), edge]));
  const removedEdges = removedEdgeKeys.map((key) => baseEdgeByKey.get(key) || workflowEdgeFromKey(key)).filter(Boolean);
  for (const edge of removedEdges) edgeStates.set(edgeKey(edge), "removed");
  const routeRemoved = removedEdges.length;
  const performance = workflowPerformanceDiff(baseWorkflow.nodes || [], nodes);
  const regressionSummary = workflowRegressionSummary({
    baseNodes,
    currentNodes,
    nodes,
    removedEdges,
    performance
  });

  return {
    active: true,
    nodeStates,
    edgeStates,
    addedEdges,
    removedEdges,
    performance,
    regressions: regressionSummary.regressions,
    regressionNodes: regressionSummary.regressionNodes,
    added,
    changed,
    same,
    removed,
    routeAdded,
    routeRemoved,
    baseLabel: workflowRunCompareLabel(state.workflowCompare.baseRun),
    compareLabel: workflowRunCompareLabel(state.workflowCompare.compareRun)
  };
}

function workflowCompareFingerprint(node) {
  return safeWorkflowJson({
    status: node?.status || "",
    input: node?.input ?? null,
    output: node?.output ?? null,
    openrouter: (node?.openrouter || []).map((call) => ({
      status: call.status,
      model: call.model,
      prompt_tokens: call.prompt_tokens,
      completion_tokens: call.completion_tokens,
      cost: call.cost,
      error: call.error
    }))
  });
}

function workflowRunCompareLabel(run) {
  if (!run) return "";
  const prefix = run.created_at ? timeAgo(new Date(run.created_at)) : "run";
  return `${prefix} - ${String(run.user_message || run.id || "").slice(0, 34)}`;
}

function workflowEdgeFromKey(key) {
  const [from, to] = String(key || "").split("->");
  return from && to ? { from, to, active: false, removed: true } : null;
}

function edgeLabel(edge) {
  return `${edge?.from || "?"} -> ${edge?.to || "?"}`;
}

function workflowPerformanceDiff(baseNodes, currentNodes) {
  const base = workflowPerformanceTotals(baseNodes);
  const current = workflowPerformanceTotals(currentNodes);
  return {
    base,
    current,
    durationDeltaMs: current.durationMs - base.durationMs,
    tokenDelta: current.totalTokens - base.totalTokens,
    costDelta: current.costValue !== null && base.costValue !== null ? current.costValue - base.costValue : null
  };
}

function workflowPerformanceTotals(nodes) {
  const metrics = (nodes || []).map(workflowNodeMetrics);
  const knownCosts = metrics.filter((item) => item.costValue !== null);
  const costValue = knownCosts.length ? knownCosts.reduce((sum, item) => sum + Number(item.costValue || 0), 0) : null;
  return {
    durationMs: metrics.reduce((sum, item) => sum + Number(item.durationMs || 0), 0),
    promptTokens: metrics.reduce((sum, item) => sum + Number(item.promptTokens || 0), 0),
    completionTokens: metrics.reduce((sum, item) => sum + Number(item.completionTokens || 0), 0),
    totalTokens: metrics.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0),
    costValue
  };
}

function workflowSignedDelta(value, formatter) {
  if (!Number.isFinite(value) || value === 0) return "0";
  return `${value > 0 ? "+" : "-"}${formatter(Math.abs(value))}`;
}

function workflowRegressionSummary({ baseNodes, currentNodes, nodes, removedEdges, performance }) {
  const regressions = [];
  const regressionNodes = new Map();
  const addRegression = (nodeId, type, message, severity = "warning") => {
    const item = { nodeId, type, message, severity };
    regressions.push(item);
    if (!nodeId) return;
    if (!regressionNodes.has(nodeId)) regressionNodes.set(nodeId, []);
    regressionNodes.get(nodeId).push(item);
  };

  for (const node of nodes) {
    const baseNode = baseNodes.get(node.id);
    if (!baseNode) continue;
    const baseMetrics = workflowNodeMetrics(baseNode);
    const currentMetrics = workflowNodeMetrics(node);
    const baseFallback = workflowNodeHasFallbackInRun(baseNode, state.workflowCompare.baseRun);
    const currentFallback = workflowNodeHasFallback(node);

    if (baseNode.status !== "error" && node.status === "error") {
      addRegression(node.id, "new_error", "Node changed from non-error to error", "critical");
    }
    if (!baseFallback && currentFallback) {
      addRegression(node.id, "new_fallback", "Fallback appeared in compare run", "warning");
    }
    if (baseMetrics.durationMs > 0 && currentMetrics.durationMs > baseMetrics.durationMs * 1.35 && currentMetrics.durationMs - baseMetrics.durationMs >= 500) {
      addRegression(node.id, "slower", `Duration increased by ${workflowSignedDelta(currentMetrics.durationMs - baseMetrics.durationMs, formatOpenRouterDuration)}`);
    }
    if (baseMetrics.totalTokens > 0 && currentMetrics.totalTokens > baseMetrics.totalTokens * 1.35 && currentMetrics.totalTokens - baseMetrics.totalTokens >= 250) {
      addRegression(node.id, "more_tokens", `Token use increased by ${workflowSignedDelta(currentMetrics.totalTokens - baseMetrics.totalTokens, (value) => value.toLocaleString())}`);
    }
    if (baseMetrics.costValue !== null && currentMetrics.costValue !== null && currentMetrics.costValue > baseMetrics.costValue * 1.35 && currentMetrics.costValue - baseMetrics.costValue >= 0.0001) {
      addRegression(node.id, "higher_cost", `Cost increased by ${workflowSignedDelta(currentMetrics.costValue - baseMetrics.costValue, formatOpenRouterCost)}`);
    }
  }

  for (const nodeId of baseNodes.keys()) {
    if (!currentNodes.has(nodeId)) addRegression(nodeId, "node_removed", "Node was present in base run and is missing in compare run");
  }
  for (const edge of removedEdges || []) {
    addRegression(edge.from || "", "route_removed", `Route removed: ${edgeLabel(edge)}`);
  }
  if (performance?.durationDeltaMs > 2500) addRegression("", "run_slower", `Run duration increased by ${workflowSignedDelta(performance.durationDeltaMs, formatOpenRouterDuration)}`);
  return { regressions, regressionNodes };
}

function workflowNodeHasFallbackInRun(node, run) {
  if (!node) return false;
  const nodeIds = new Set([node.id, workflowCanonicalStep(node.id)]);
  const hasFallbackEvent = [
    ...(run?.workflow_log?.trace || []),
    ...(run?.run_events || [])
  ].some((entry) => {
    const step = workflowCanonicalStep(entry?.step || entry?.node_id || entry?.data?.node_id || "");
    if (!nodeIds.has(step)) return false;
    return entry?.fallback === true
      || entry?.data?.fallback === true
      || /fallback/i.test(entry?.message || "")
      || /fallback/i.test(entry?.error || "");
  });
  return hasFallbackEvent
    || workflowPayloadHasFallback(node.input)
    || workflowPayloadHasFallback(node.output)
    || /fallback/i.test(`${node.id} ${node.label || ""}`);
}

function renderWorkflowCompareSummary(summary = state.workflowCompare?.summary) {
  const summaryEl = $("workflowCompareSummary");
  const clearButton = $("clearWorkflowCompare");
  const active = Boolean(summary?.active);
  if (clearButton) clearButton.hidden = !active;
  if (!summaryEl) return;
  summaryEl.hidden = !active;
  if (!active) {
    summaryEl.textContent = "";
    return;
  }
  summaryEl.innerHTML = `
    <strong>Compare Runs</strong>
    <span>${escapeHtml(summary.baseLabel || "Base")} -> ${escapeHtml(summary.compareLabel || "Compare")}</span>
    <b>${summary.changed} changed</b>
    <b>${summary.added} added</b>
    <b>${summary.removed} removed</b>
    <b>${summary.routeAdded + summary.routeRemoved} route diffs</b>
    <b class="${summary.regressions.length ? "hasRegressions" : ""}">${summary.regressions.length} regressions</b>
    ${renderWorkflowRegressionSummary(summary)}
    ${renderWorkflowPerformanceSummary(summary.performance)}
    ${renderWorkflowRouteDiffSummary(summary)}
  `;
}

function renderWorkflowPerformanceSummary(performance) {
  if (!performance) return "";
  return `
    <div class="workflowPerformanceSummary">
      <span class="${performance.durationDeltaMs > 0 ? "worse" : performance.durationDeltaMs < 0 ? "better" : ""}">
        Duration ${escapeHtml(workflowSignedDelta(performance.durationDeltaMs, formatOpenRouterDuration))}
      </span>
      <span class="${performance.tokenDelta > 0 ? "worse" : performance.tokenDelta < 0 ? "better" : ""}">
        Tokens ${escapeHtml(workflowSignedDelta(performance.tokenDelta, (value) => value.toLocaleString()))}
      </span>
      <span class="${performance.costDelta > 0 ? "worse" : performance.costDelta < 0 ? "better" : ""}">
        Cost ${escapeHtml(performance.costDelta === null ? "n/a" : workflowSignedDelta(performance.costDelta, formatOpenRouterCost))}
      </span>
    </div>
  `;
}

function renderWorkflowRegressionSummary(summary) {
  if (!summary?.regressions?.length) return "";
  return `
    <div class="workflowRegressionSummary">
      ${summary.regressions.slice(0, 5).map((item) => `
        <span class="${escapeHtml(item.severity || "warning")}">
          ${escapeHtml(item.nodeId ? `${item.nodeId}: ${item.message}` : item.message)}
        </span>
      `).join("")}
    </div>
  `;
}

function renderWorkflowRouteDiffSummary(summary) {
  const routeDiffs = [...(summary.addedEdges || []), ...(summary.removedEdges || [])];
  if (!routeDiffs.length) return "";
  return `
    <div class="workflowRouteDiffSummary">
      ${(summary.addedEdges || []).slice(0, 3).map((edge) => `<span class="added">+ ${escapeHtml(edgeLabel(edge))}</span>`).join("")}
      ${(summary.removedEdges || []).slice(0, 3).map((edge) => `<span class="removed">- ${escapeHtml(edgeLabel(edge))}</span>`).join("")}
    </div>
  `;
}

function workflowCompareLabel(compareState) {
  return {
    added: "Compare: Added in this run",
    changed: "Compare: Changed from base",
    same: "Compare: Same as base"
  }[compareState] || "";
}

function normalizeWorkflowQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function workflowNodeSearchText(node) {
  return [
    node.id,
    node.label,
    node.kind,
    node.status,
    formatWorkflowPreview(node.input),
    formatWorkflowPreview(node.output),
    workflowNodeErrorText(node)
  ].join(" ").toLowerCase();
}

function workflowNodeHasFallback(node) {
  if (!node) return false;
  const nodeIds = new Set([node.id, workflowCanonicalStep(node.id)]);
  const hasFallbackEvent = [
    ...(state.lastWorkflow?.trace || []),
    ...(state.runEvents || [])
  ].some((entry) => {
    const step = workflowCanonicalStep(entry?.step || entry?.node_id || entry?.data?.node_id || "");
    if (!nodeIds.has(step)) return false;
    return entry?.fallback === true
      || entry?.data?.fallback === true
      || /fallback/i.test(entry?.message || "")
      || /fallback/i.test(entry?.error || "");
  });
  return hasFallbackEvent
    || workflowPayloadHasFallback(node.input)
    || workflowPayloadHasFallback(node.output)
    || /fallback/i.test(`${node.id} ${node.label || ""}`);
}

function workflowCanonicalStep(step) {
  const normalized = String(step || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return {
    mainagent: "main_agent",
    main_agent: "main_agent",
    liteagent: "lite_agent",
    lite_agent: "lite_agent",
    knowledgeplanner: "knowledge_planner",
    knowledge_planner: "knowledge_planner"
  }[normalized] || normalized;
}

function workflowPayloadHasFallback(value, depth = 0) {
  if (!value || depth > 5) return false;
  if (typeof value === "string") return /\bfallback\b/i.test(value) && value.length < 800;
  if (typeof value !== "object") return false;
  if (value.fallback === true || value.used_fallback === true || value.cache_fallback === true) return true;
  for (const [key, child] of Object.entries(value)) {
    if (/fallback/i.test(key) && child !== false && child !== null && child !== undefined) return true;
    if (typeof child === "object" && workflowPayloadHasFallback(child, depth + 1)) return true;
  }
  return false;
}

function fitWorkflowToScreen() {
  if (!_cy || _cy.destroyed()) return;
  _cy.fit(_cy.elements(), 40);
  const minReadableZoom = state.workflowCardsExpanded ? 0.72 : 0.9;
  if (_cy.zoom() < minReadableZoom) _cy.zoom(minReadableZoom);
  if (_cy.zoom() > 1.05) _cy.zoom(1.05);
  focusWorkflowStart();
}

function focusWorkflowStart(nodeId = null) {
  if (!_cy || _cy.destroyed()) return;
  const first = nodeId ? _cy.getElementById(nodeId) : _cy.nodes().sort((a, b) => a.position("x") - b.position("x"))[0];
  if (!first?.length) return;
  const targetZoom = state.workflowCardsExpanded ? 0.92 : 1.05;
  _cy.zoom(targetZoom);
  _cy.center(first);
  _cy.panBy({ x: 210, y: 0 });
}

function escapeXml(unsafe) {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function nodeIconMeta(kind, label) {
  const n = String(label || "").toLowerCase();
  if (n.includes("trigger") || n.includes("chat"))
    return { abbr: "CH", color: "#148c72" };
  if (n.includes("sanitize") || n.includes("shield"))
    return { abbr: "SA", color: "#327356" };
  if (n.includes("save") || n.includes("store"))
    return { abbr: "DB", color: "#6a4c93" };
  if (n.includes("classif"))
    return { abbr: "CL", color: "#1a5a8c" };
  if (n.includes("knowledge") || n.includes("retrieval"))
    return { abbr: "KB", color: "#327356" };
  if (n.includes("agent") || n.includes("main"))
    return { abbr: "AI", color: "#148c72" };
  if (n.includes("cache"))
    return { abbr: "CA", color: "#b07d1a" };
  if (n.includes("memory"))
    return { abbr: "ME", color: "#1a5a8c" };
  if (n.includes("fallback"))
    return { abbr: "FB", color: "#cc3333" };
  const kindMap = {
    trigger: { abbr: "TR", color: "#148c72" },
    code:    { abbr: "CD", color: "#2e6b24" },
    database:{ abbr: "DB", color: "#6a4c93" },
    memory:  { abbr: "ME", color: "#1a5a8c" },
    ai:      { abbr: "AI", color: "#148c72" },
    router:  { abbr: "RT", color: "#b07d1a" },
    vector:  { abbr: "VE", color: "#1a5a8c" },
    tool:    { abbr: "TL", color: "#b07d1a" }
  };
  return kindMap[kind] || { abbr: "ND", color: "#3a5238" };
}

function getNodeCardAccentColor(node, compareState, regression) {
  if (regression) return "#e05555";
  if (node.status === "error") return "#e05555";
  if (compareState === "added") return "#22c27a";
  if (compareState === "changed") return "#e0a020";
  if (node.status === "skipped") return "#9aaa96";
  if (workflowNodeHasFallback(node)) return "#e08a20";
  if (node.status === "done") return "#22c27a";
  return nodeIconMeta(node.kind, node.label).color;
}

function workflowNodeCardActionAt(cyNode, position) {
  if (!state.workflowCardsExpanded || !cyNode || !position) return "";
  const width = Number(cyNode.data("cardWidth") || 430);
  const height = Number(cyNode.data("cardHeight") || 310);
  const center = cyNode.position();
  const x = position.x - (center.x - width / 2);
  const y = position.y - (center.y - height / 2);
  if (x < 0 || y < 0 || x > width || y > height) return "";

  const padL = 14;
  const buttonY = 50;
  const buttonH = 20;
  if (y < buttonY || y > buttonY + buttonH) return "";
  if (x >= padL && x <= padL + 46) return "log";
  if (x >= padL + 54 && x <= padL + 106) return "copy";
  return "";
}

async function copyWorkflowNodePayload(node) {
  if (!node) return;
  try {
    await copyTextToClipboard(workflowNodeCopyText(node));
    showToast("נתוני הרכיב הועתקו ללוח");
  } catch (error) {
    console.warn("Workflow node copy failed", error);
    showToast("לא ניתן להעתיק את נתוני הרכיב", "error");
  }
}

function workflowNodeCopyText(node) {
  const metrics = workflowNodeMetrics(node);
  return safeWorkflowJson({
    id: node.id,
    label: node.label,
    kind: node.kind,
    status: node.status,
    metrics: {
      duration: metrics.duration,
      tokens: metrics.tokens,
      cost: metrics.cost,
      calls: metrics.calls
    },
    input: node.input ?? null,
    output: node.output ?? null,
    openrouter: Array.isArray(node.openrouter) ? node.openrouter : [],
    logs: workflowLogsForNode(node.id)
  });
}

function generateNodeCardSvg(node, expanded, compareState = "", regression = false) {
  const width = expanded ? 430 : 280;
  const height = expanded ? 310 : 126;
  const accent = getNodeCardAccentColor(node, compareState, regression);
  const iconMeta = nodeIconMeta(node.kind, node.label);
  const metrics = workflowNodeMetrics(node);

  let badgeText = String(node.status).toUpperCase();
  let badgeBg = "#e8f5e9"; let badgeFg = "#2e7d52";
  if (node.status === "done") {
    if (node.id === "cache" || node.kind === "database") {
      const out = String(JSON.stringify(node.output) || "").toLowerCase();
      if (out.includes("miss")) { badgeText = "MISS"; badgeBg = "#fdecea"; badgeFg = "#c0392b"; }
      else if (out.includes("hit")) { badgeText = "HIT"; badgeBg = "#e8f5e9"; badgeFg = "#2e7d52"; }
      else { badgeText = "SUCCESS"; }
    } else if (node.id === "local_memory" || node.id === "memory") {
      badgeText = "UPDATED"; badgeBg = "#e3f2fd"; badgeFg = "#1565c0";
    } else { badgeText = "SUCCESS"; }
  } else if (node.status === "error") {
    badgeText = "FAILED"; badgeBg = "#fdecea"; badgeFg = "#c0392b";
  } else if (node.status === "skipped") {
    badgeText = "SKIPPED"; badgeBg = "#f5f5f5"; badgeFg = "#757575";
  } else {
    badgeBg = "#fff8e1"; badgeFg = "#b07d1a";
  }

  const title = escapeXml(node.label);
  const kindLabel = escapeXml(node.kind || node.id);
  const duration = escapeXml(metrics.duration);
  const tokens = escapeXml(metrics.tokens);
  const cost = escapeXml(metrics.cost);
  const calls = escapeXml(metrics.calls);
  const abbr = escapeXml(iconMeta.abbr);
  const iconBg = escapeXml(iconMeta.color);

  let compareBanner = "";
  if (compareState) {
    const lbl = workflowCompareLabel(compareState);
    if (lbl) compareBanner = `<div class="compare-banner">${escapeXml(lbl)}</div>`;
  }

  const header = `
    <div class="header">
      <div class="title-group">
        <div class="icon-box" style="background:${iconBg}">${abbr}</div>
        <div class="titles">
          <strong class="title">${title}</strong>
          <span class="subtitle">${kindLabel}</span>
        </div>
      </div>
      <div class="status-group">
        <span class="badge" style="background:${escapeXml(badgeBg)};color:${escapeXml(badgeFg)}">${badgeText}</span>
        <span class="dur">${duration}</span>
      </div>
    </div>`;

  let body = "";
  if (expanded) {
    const inp = escapeXml(clipWorkflowBlock(formatWorkflowPreview(node.input), 120));
    const out = escapeXml(clipWorkflowBlock(formatWorkflowPreview(node.output), 120));
    body = `
      <div class="btn-row">
        <div class="btn">&#128196; Log</div>
        <div class="btn">&#128203; Copy</div>
      </div>
      <div class="sec-label">INPUT</div>
      <div class="sec-box">${inp}</div>
      <div class="sec-label">OUTPUT</div>
      <div class="sec-box">${out}</div>`;
  }

  const footer = `<div class="footer">Tokens ${tokens} &nbsp;·&nbsp; Cost ${cost} &nbsp;·&nbsp; Calls ${calls}</div>`;

  const html = `
    <div class="card" style="border-left:4px solid ${accent}">
      ${compareBanner}
      ${header}
      ${body}
      ${footer}
    </div>`;

  const css = `<style>
    *{box-sizing:border-box;margin:0;padding:0}
    .card{width:${width}px;height:${height}px;background:#ffffff;border:1px solid #dde5da;border-radius:10px;padding:11px 12px 10px 10px;font-family:Segoe UI,system-ui,sans-serif;display:flex;flex-direction:column;gap:0;box-shadow:0 2px 8px rgba(30,60,40,0.10);overflow:hidden}
    .header{display:flex;justify-content:space-between;align-items:flex-start;gap:6px;flex-shrink:0}
    .title-group{display:flex;align-items:center;gap:8px;min-width:0;flex:1}
    .icon-box{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:#fff;letter-spacing:0;flex-shrink:0;line-height:1}
    .titles{display:flex;flex-direction:column;gap:1px;min-width:0}
    .title{font-size:12.5px;font-weight:700;color:#18261f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .subtitle{font-size:10px;color:#7a9180;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .status-group{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
    .badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;text-transform:uppercase;white-space:nowrap;letter-spacing:0.03em}
    .dur{font-size:10px;color:#9aaa96;font-weight:600}
    .btn-row{display:flex;gap:6px;margin-top:8px;flex-shrink:0}
    .btn{font-size:10px;font-weight:700;color:#5a7a68;background:#f2f7f4;border:1px solid #c8ddd2;border-radius:5px;padding:3px 9px;cursor:pointer}
    .sec-label{font-size:9px;font-weight:800;color:#9aaa96;text-transform:uppercase;letter-spacing:0.07em;margin-top:7px;margin-bottom:3px;flex-shrink:0}
    .sec-box{background:#f5f8f5;border:1px solid #e0eadf;border-radius:6px;padding:5px 7px;font-size:10px;font-family:Consolas,monospace;color:#2a3d30;white-space:pre-wrap;word-break:break-all;overflow:hidden;height:50px;flex-shrink:0}
    .footer{margin-top:auto;padding-top:7px;border-top:1px solid #ecf2ea;font-size:10px;color:#9aaa96;font-weight:600;flex-shrink:0}
    .compare-banner{background:#fffbea;border:1px solid #f0d060;color:#8a6800;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;margin-bottom:5px;text-align:center;flex-shrink:0}
  </style>`;

  // Pure SVG — no foreignObject (Chrome blocks it in background-image)
  const W = width, H = height;
  const aW = 4, padL = aW + 10, padR = 10, innerW = W - padL - padR;
  const iconSize = 28, iconX = padL, iconY = 12;
  const textX = iconX + iconSize + 8;
  const badgeW = Math.min(badgeText.length * 6.2 + 14, 74);
  const badgeH = 17, badgeX = W - padR - badgeW, badgeY = iconY + 1;
  const titleMaxChars = Math.floor((badgeX - textX - 6) / 7);
  const titleClipped = escapeXml(clipWorkflowLine(node.label || "", titleMaxChars));
  const kindLabelClipped = escapeXml((node.kind || node.id || "").substring(0, 16));
  const footerLineY = H - 22, footerTextY = H - 8;
  const footerStr = `Tokens ${tokens}  ·  Cost ${cost}  ·  Calls ${calls}`;
  const uid = `n${Math.random().toString(36).slice(2, 7)}`;
  const p = [];

  p.push(`<defs><clipPath id="${uid}"><rect x="0" y="0" width="${W}" height="${H}" rx="10"/></clipPath></defs>`);
  p.push(`<g clip-path="url(#${uid})"><rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/><rect x="0" y="0" width="${aW}" height="${H}" fill="${accent}"/></g>`);
  p.push(`<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="9.5" fill="none" stroke="#dde5da" stroke-width="1"/>`);

  // Icon box
  p.push(`<rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="6" fill="${iconBg}"/>`);
  p.push(`<text x="${iconX + iconSize/2}" y="${iconY + 18}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="8" font-weight="900" fill="white">${abbr}</text>`);

  // Title + kind
  p.push(`<text x="${textX}" y="${iconY + 13}" font-family="'Segoe UI',system-ui,sans-serif" font-size="12.5" font-weight="700" fill="#18261f">${titleClipped}</text>`);
  p.push(`<text x="${textX}" y="${iconY + 26}" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" fill="#7a9180">${kindLabelClipped}</text>`);

  // Badge + duration
  p.push(`<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="4" fill="${badgeBg}"/>`);
  p.push(`<text x="${badgeX + badgeW/2}" y="${badgeY + 11.5}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" font-weight="800" fill="${badgeFg}">${escapeXml(badgeText)}</text>`);
  p.push(`<text x="${W - padR}" y="${badgeY + badgeH + 12}" text-anchor="end" font-family="'Segoe UI',system-ui,sans-serif" font-size="9.5" fill="#9aaa96" font-weight="600">${duration}</text>`);

  if (expanded) {
    const btnY = iconY + iconSize + 10;
    p.push(`<rect x="${padL}" y="${btnY}" width="46" height="20" rx="4" fill="#f2f7f4" stroke="#c8ddd2" stroke-width="1"/>`);
    p.push(`<text x="${padL+23}" y="${btnY+13}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" font-weight="700" fill="#5a7a68">Log</text>`);
    p.push(`<rect x="${padL+54}" y="${btnY}" width="52" height="20" rx="4" fill="#f2f7f4" stroke="#c8ddd2" stroke-width="1"/>`);
    p.push(`<text x="${padL+80}" y="${btnY+13}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="10" font-weight="700" fill="#5a7a68">Copy</text>`);

    const charsPerLine = Math.floor(innerW / 5.8);
    const inpLabelY = btnY + 32, inpBoxY = inpLabelY + 13, inpBoxH = 60;
    p.push(`<text x="${padL}" y="${inpLabelY}" font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" font-weight="800" fill="#9aaa96" letter-spacing="0.5">INPUT</text>`);
    p.push(`<rect x="${padL}" y="${inpBoxY}" width="${innerW}" height="${inpBoxH}" rx="5" fill="#f5f8f5" stroke="#e0eadf" stroke-width="1"/>`);
    formatWorkflowPreview(node.input).split("\n").slice(0, 4).forEach((line, i) => {
      p.push(`<text x="${padL+6}" y="${inpBoxY+14+i*12}" font-family="Consolas,'Courier New',monospace" font-size="9.5" fill="#2a3d30">${escapeXml(clipWorkflowLine(line, charsPerLine))}</text>`);
    });

    const outLabelY = inpBoxY + inpBoxH + 10, outBoxY = outLabelY + 13;
    const outBoxH = Math.max(footerLineY - outBoxY - 8, 30);
    p.push(`<text x="${padL}" y="${outLabelY}" font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" font-weight="800" fill="#9aaa96" letter-spacing="0.5">OUTPUT</text>`);
    p.push(`<rect x="${padL}" y="${outBoxY}" width="${innerW}" height="${outBoxH}" rx="5" fill="#f5f8f5" stroke="#e0eadf" stroke-width="1"/>`);
    formatWorkflowPreview(node.output).split("\n").slice(0, 4).forEach((line, i) => {
      p.push(`<text x="${padL+6}" y="${outBoxY+14+i*12}" font-family="Consolas,'Courier New',monospace" font-size="9.5" fill="#2a3d30">${escapeXml(clipWorkflowLine(line, charsPerLine))}</text>`);
    });
  }

  if (compareState) {
    const lbl = workflowCompareLabel(compareState);
    if (lbl) {
      p.push(`<rect x="${padL}" y="${footerLineY-20}" width="${innerW}" height="15" rx="3" fill="#fffbea" stroke="#f0d060" stroke-width="1"/>`);
      p.push(`<text x="${W/2}" y="${footerLineY-9}" text-anchor="middle" font-family="'Segoe UI',system-ui,sans-serif" font-size="8.5" font-weight="700" fill="#8a6800">${escapeXml(lbl)}</text>`);
    }
  }

  p.push(`<line x1="${padL}" y1="${footerLineY}" x2="${W-padR}" y2="${footerLineY}" stroke="#ecf2ea" stroke-width="1"/>`);
  p.push(`<text x="${padL}" y="${footerTextY}" font-family="'Segoe UI',system-ui,sans-serif" font-size="9.5" fill="#9aaa96" font-weight="600">${escapeXml(footerStr)}</text>`);

  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${p.join("")}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svgOut);
}

function workflowNodeCardLabel(node, expanded, compareState = "") {
  const metrics = workflowNodeMetrics(node);
  const status = statusLabel(node.status);
  const header = `[${iconForNode(node.kind)}] ${node.label}`;
  const subheader = `${node.id} · ${status} · Duration ${metrics.duration}`;
  const footer = `Tokens ${metrics.tokens} · Cost ${metrics.cost} · Calls ${metrics.calls}`;
  const errorText = workflowNodeErrorText(node);
  const compareText = workflowCompareLabel(compareState);

  if (!expanded) {
    return [
      header,
      subheader,
      compareText,
      workflowNodeHasFallback(node) ? "Fallback route used" : "",
      footer,
      errorText ? `Error: ${clipWorkflowLine(errorText, 56)}` : ""
    ].filter(Boolean).join("\n");
  }

  return [
    header,
    subheader,
    compareText,
    workflowNodeHasFallback(node) ? "Fallback route used" : "",
    `Input (${workflowPayloadSourceText(node, "input")})`,
    clipWorkflowBlock(formatWorkflowPreview(node.input), 190),
    `Output (${workflowPayloadSourceText(node, "output")})`,
    clipWorkflowBlock(formatWorkflowPreview(node.output), 210),
    footer,
    errorText ? `Error: ${clipWorkflowLine(errorText, 92)}` : ""
  ].filter(Boolean).join("\n");
}

function workflowPayloadSourceText(node, direction) {
  const source = node?.payloadSource?.[direction] || "";
  if (source === "node.input" || source === "node.output") return "captured";
  if (source === "nodeDetails") return "details";
  if (source === "not_captured") return "not captured";
  return "unknown";
}

function workflowNodeMetrics(node) {
  const calls = Array.isArray(node.openrouter) ? node.openrouter : [];
  const completed = calls.filter((call) => call.status === "done");
  const durationMs = completed.reduce((sum, call) => sum + Number(call.duration_ms || 0), 0);
  const promptTokens = completed.reduce((sum, call) => sum + Number(call.prompt_tokens || 0), 0);
  const completionTokens = completed.reduce((sum, call) => sum + Number(call.completion_tokens || 0), 0);
  const knownCosts = completed.filter((call) => call.cost !== null && call.cost !== undefined && Number.isFinite(Number(call.cost)));
  const cost = knownCosts.length ? knownCosts.reduce((sum, call) => sum + Number(call.cost || 0), 0) : null;
  return {
    calls: calls.length ? String(calls.length) : "0",
    durationMs,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    costValue: cost,
    duration: durationMs > 0 ? formatOpenRouterDuration(durationMs) : "—",
    tokens: promptTokens || completionTokens ? `${promptTokens.toLocaleString()}/${completionTokens.toLocaleString()}` : "—",
    cost: cost !== null ? formatOpenRouterCost(cost) : "—"
  };
}

function formatWorkflowPreview(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return maskSensitivePreview(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value.preview && typeof value.preview === "string") return maskSensitivePreview(value.preview);
  try {
    return maskSensitivePreview(JSON.stringify(value, null, 2));
  } catch {
    return maskSensitivePreview(String(value));
  }
}

function maskSensitivePreview(text) {
  return String(text)
    .replace(/(authorization|api[_-]?key|token|secret|password)(["'\s:=-]+)([^"',\s}]+)/gi, "$1$2[masked]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[masked]");
}

function clipWorkflowBlock(text, maxChars) {
  const compact = String(text || "—")
    .replace(/\s+/g, " ")
    .trim();
  return clipWorkflowLine(compact, maxChars);
}

function clipWorkflowLine(text, maxChars) {
  const value = String(text || "—");
  return value.length > maxChars ? `${value.slice(0, Math.max(0, maxChars - 1))}…` : value;
}

function workflowNodeErrorText(node) {
  const values = [node.output, node.input];
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const error = value.error || value.message || value.reason;
    if (error && (node.status === "error" || value.error)) return String(error);
  }
  const failedCall = (Array.isArray(node.openrouter) ? node.openrouter : []).find((call) => call.status === "error" || call.error);
  return failedCall?.error || "";
}

function renderWorkflowMetrics(workflow) {
  const panel = $("workflowMetricCards");
  if (!panel) return;
  const hasRun = Boolean(workflow?.nodes?.length);
  panel.hidden = !hasRun;
  if (!hasRun) return;

  const or = workflow?.openRouterUsage?.totals || {};
  const cache = workflow?.cacheMetrics || {};
  const nodes = workflow?.nodes || [];

  // Tokens
  const totalTokens = (Number(or.prompt_tokens || 0) + Number(or.completion_tokens || 0));
  $("wfMetric_totalTokens").textContent = totalTokens.toLocaleString();
  const avgTokens = calcHistoryAvg((r) => {
    const t = r.workflow_log?.openRouterUsage?.totals;
    return t ? Number(t.prompt_tokens || 0) + Number(t.completion_tokens || 0) : null;
  });
  $("wfMetricSub_totalTokens").textContent = avgTokens !== null ? `ממוצע ריצה ${avgTokens.toLocaleString()}` : "—";

  // Cost
  const cost = or.cost != null ? Number(or.cost) : null;
  $("wfMetric_totalCost").textContent = cost !== null ? formatOpenRouterCost(cost) : "—";
  const avgCost = calcHistoryAvg((r) => {
    const c = r.workflow_log?.openRouterUsage?.totals?.cost;
    return c != null ? Number(c) : null;
  });
  $("wfMetricSub_totalCost").textContent = avgCost !== null ? `ממוצע ריצה ${formatOpenRouterCost(avgCost)}` : "—";

  // Latency (total duration from nodes)
  const doneNodes = nodes.filter((n) => n.status === "done" || n.status === "error");
  const totalDurationMs = doneNodes.reduce((sum, n) => {
    const calls = Array.isArray(n.openrouter) ? n.openrouter : [];
    return sum + calls.reduce((s, c) => s + Number(c.duration_ms || 0), 0);
  }, 0);
  $("wfMetric_latency").textContent = totalDurationMs > 0 ? formatOpenRouterDuration(totalDurationMs) : "—";
  const avgLatency = calcHistoryAvg((r) => {
    const ns = r.workflow_log?.nodes || [];
    const ms = ns.reduce((sum, n) => {
      const calls = Array.isArray(n.openrouter) ? n.openrouter : [];
      return sum + calls.reduce((s, c) => s + Number(c.duration_ms || 0), 0);
    }, 0);
    return ms > 0 ? ms : null;
  });
  $("wfMetricSub_latency").textContent = avgLatency !== null ? `ממוצע ריצה ${formatOpenRouterDuration(avgLatency)}` : "—";

  // Cache hit rate
  const hitRate = Number(cache.cache_hit_rate || 0);
  $("wfMetric_cacheHitRate").textContent = `${hitRate.toFixed(1)}%`;
  const totalRuns = (state.runHistory || []).length;
  const hitRuns = (state.runHistory || []).filter((r) => (r.workflow_log?.cacheMetrics?.cache_hits || 0) > 0).length;
  $("wfMetricSub_cacheHitRate").textContent = totalRuns ? `${hitRuns}/${totalRuns} ריצות` : "—";

  // Cache HIT/MISS
  const hits = Number(cache.cache_hits || 0);
  const misses = Number(cache.cache_misses || 0);
  $("wfMetric_cache").textContent = `HIT ${hits} / ${misses} MISS`;
  $("wfMetricSub_cache").textContent = `פחות ${totalRuns || 0} ריצות`;

  // Success rate
  const total = nodes.length;
  const successful = nodes.filter((n) => n.status === "done").length;
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 100;
  $("wfMetric_successRate").textContent = `${successRate}%`;
  $("wfMetricSub_successRate").textContent = `ריצות ${totalRuns}/${totalRuns}`;
}

function calcHistoryAvg(accessor) {
  const history = state.runHistory || [];
  const values = history.map(accessor).filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function renderCacheMetrics(metrics) {
  const panel = $("cacheMetrics");
  if (!panel) return;
  panel.hidden = !metrics;
  if (!metrics) return;
  $("cacheHitRate").textContent = `${Number(metrics.cache_hit_rate || 0).toFixed(1)}%`;
  $("cacheTotalHits").textContent = String(metrics.cache_hits || 0);
  $("cacheTotalMisses").textContent = String(metrics.cache_misses || 0);
  $("cacheCostSaved").textContent = `$${Number(metrics.estimated_cost_saved || 0).toFixed(4)}`;
}

function renderOpenRouterMetrics(metrics) {
  const panel = $("openRouterMetrics");
  if (!panel) return;
  panel.hidden = !metrics;
  if (!metrics) return;
  $("openRouterCalls").textContent = Number(metrics.successful_calls ?? metrics.calls ?? 0).toLocaleString();
  $("openRouterInputTokens").textContent = Number(metrics.prompt_tokens || 0).toLocaleString();
  $("openRouterOutputTokens").textContent = Number(metrics.completion_tokens || 0).toLocaleString();
  $("openRouterCost").textContent = formatOpenRouterCost(metrics.cost);
  $("openRouterSpeed").textContent = formatOpenRouterSpeed(metrics.output_tokens_per_second);
}

function summarizeLiveOpenRouterUsage() {
  const calls = state.runEvents
    .map((event) => event?.data?.openrouter)
    .filter(Boolean);
  const completed = calls.filter((call) => call.status === "done");
  const durationMs = completed.reduce((sum, call) => sum + Number(call.duration_ms || 0), 0);
  const completionTokens = completed.reduce((sum, call) => sum + Number(call.completion_tokens || 0), 0);
  const knownCosts = completed.filter((call) => call.cost !== null && call.cost !== undefined && Number.isFinite(Number(call.cost)));
  return {
    calls: calls.length,
    successful_calls: completed.length,
    prompt_tokens: completed.reduce((sum, call) => sum + Number(call.prompt_tokens || 0), 0),
    completion_tokens: completionTokens,
    cost: knownCosts.length ? knownCosts.reduce((sum, call) => sum + Number(call.cost || 0), 0) : null,
    output_tokens_per_second: completionTokens > 0 && durationMs > 0
      ? completionTokens / (durationMs / 1000)
      : null
  };
}

function pulseErrorNodes(cy) {
  const errorNodes = cy.nodes('[status="error"]');
  if (!errorNodes.length) return;
  const step = (nodes, big) => {
    try {
      nodes.animate(
        { style: { "border-width": big ? 5.5 : 3.5 } },
        { duration: 700, easing: "ease-in-out", complete: () => { if (cy.destroyed()) return; step(nodes, !big); } }
      );
    } catch (error) {
      console.warn("Workflow error pulse animation skipped", error);
    }
  };
  step(errorNodes, true);
}

function cytoscapeStyle() {
  return [
    {
      selector: "node",
      style: {
        shape: "round-rectangle",
        width: "data(cardWidth)", height: "data(cardHeight)",
        "background-color": "transparent",
        "border-width": 0,
        "background-image": (e) => e.data("cardSvg"),
        "background-fit": "contain",
        "background-clip": "node",
        label: ""
      }
    },
    {
      selector: "node[status='done']",
      style: {
        "shadow-blur": 10, "shadow-color": "rgba(38,201,154,0.25)",
        "shadow-offset-x": 0, "shadow-offset-y": 0, "shadow-opacity": 1
      }
    },
    {
      selector: "node[status='skipped']",
      style: {
        opacity: 0.76
      }
    },
    {
      selector: "node[?filtered]",
      style: {
        opacity: 0.18,
        "shadow-opacity": 0
      }
    },
    {
      selector: "node[?searchMatch], node[?issueMatch]",
      style: {
        "border-color": "#f4c36a",
        "border-width": 4,
        "shadow-blur": 24,
        "shadow-color": "rgb(244 195 106 / 0.52)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "node[?fallback]",
      style: {
        "border-color": "#f59f3a",
        "border-width": 4,
        "background-color": "#2a2115",
        color: "#fff3dc",
        "shadow-blur": 24,
        "shadow-color": "rgb(245 159 58 / 0.55)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "node[compareState = 'added']",
      style: {
        "border-color": "#78d88f",
        "border-width": 4,
        "background-color": "#15261b",
        "shadow-blur": 24,
        "shadow-color": "rgb(120 216 143 / 0.48)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "node[compareState = 'changed']",
      style: {
        "border-color": "#f4c36a",
        "border-width": 4,
        "background-color": "#272315",
        "shadow-blur": 24,
        "shadow-color": "rgb(244 195 106 / 0.52)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "node[?regression]",
      style: {
        "border-color": "#ff7878",
        "border-width": 5,
        "background-color": "#2b1717",
        "shadow-blur": 28,
        "shadow-color": "rgb(255 120 120 / 0.58)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "node[status='error']",
      style: {
        "background-color": "#2b1717",
        "border-color": "#ff3333", "border-width": 3.5,
        "shadow-blur": 22, "shadow-color": "rgb(255 51 51 / 0.65)",
        "shadow-offset-x": 0, "shadow-offset-y": 0, "shadow-opacity": 1
      }
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#f4c36a", "border-width": 3,
        "shadow-blur": 16, "shadow-color": "rgb(244 195 106 / 0.5)",
        "shadow-offset-x": 0, "shadow-offset-y": 0, "shadow-opacity": 1
      }
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": "rgb(202 213 195 / 0.28)",
        "target-arrow-color": "rgb(202 213 195 / 0.28)",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "line-style": "dashed",
        "line-dash-pattern": [7, 6],
        opacity: 0.55
      }
    },
    {
      selector: "edge[?filtered]",
      style: {
        opacity: 0.14,
        "line-color": "rgb(202 213 195 / 0.16)",
        "target-arrow-color": "rgb(202 213 195 / 0.16)"
      }
    },
    {
      selector: "edge[?fallback]",
      style: {
        width: 3.4,
        "line-color": "#f59f3a",
        "target-arrow-color": "#f59f3a",
        "line-style": "solid",
        opacity: 1,
        "shadow-blur": 10,
        "shadow-color": "rgb(245 159 58 / 0.45)",
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        "shadow-opacity": 1
      }
    },
    {
      selector: "edge[compareState = 'added']",
      style: {
        width: 3.4,
        "line-color": "#78d88f",
        "target-arrow-color": "#78d88f",
        "line-style": "solid",
        opacity: 1
      }
    },
    {
      selector: "edge[compareState = 'removed']",
      style: {
        width: 3,
        "line-color": "#ff7878",
        "target-arrow-color": "#ff7878",
        "line-style": "dashed",
        "line-dash-pattern": [3, 5],
        opacity: 0.86
      }
    },
    {
      selector: "edge[?active]",
      style: {
        width: 2.8,
        "line-color": "#8ee0c8",
        "target-arrow-color": "#8ee0c8",
        "line-style": "solid",
        opacity: 1,
        "shadow-blur": 8, "shadow-color": "rgb(142 224 200 / 0.4)",
        "shadow-offset-x": 0, "shadow-offset-y": 0, "shadow-opacity": 1
      }
    },
    {
      selector: "edge[compareState = 'added']",
      style: {
        width: 3.4,
        "line-color": "#78d88f",
        "target-arrow-color": "#78d88f",
        "line-style": "solid",
        opacity: 1
      }
    },
    {
      selector: "edge[compareState = 'removed']",
      style: {
        width: 3,
        "line-color": "#ff7878",
        "target-arrow-color": "#ff7878",
        "line-style": "dashed",
        "line-dash-pattern": [3, 5],
        opacity: 0.86
      }
    }
  ];
}

function buildWorkflowView(workflow) {
  const runtimeNodes = new Map((workflow?.nodes || []).map((node) => [node.id, node]));
  const runtimeIds = new Set(runtimeNodes.keys());
  const activeEdgeKeys = new Set((workflow?.edges || []).map(edgeKey));
  const hasRun = runtimeIds.size > 0;
  const templateIds = new Set(WORKFLOW_TEMPLATE_NODES.map((node) => node.id));

  // When a run has happened: only show nodes that actually executed (no disconnected, no idle).
  // When no run yet: show nothing (hint is displayed instead).
  const nodes = WORKFLOW_TEMPLATE_NODES
    .filter((node) => !node.disconnected && (!hasRun || runtimeIds.has(node.id)))
    .map((node) => {
      const runtime = runtimeNodes.get(node.id);
      return normalizeWorkflowNodePayloads({
        ...node,
        ...(runtime || {}),
        x: hasRun ? undefined : node.x,
        y: hasRun ? undefined : node.y,
        label: runtime?.label || node.label,
        kind: runtime?.kind || node.kind,
        status: runtime?.status || "idle",
        used: runtimeIds.has(node.id),
        disconnected: false
      }, workflow);
    });

  for (const runtime of runtimeNodes.values()) {
    if (!templateIds.has(runtime.id)) nodes.push(normalizeWorkflowNodePayloads({ ...runtime, used: true }, workflow));
  }

  // Only draw edges where both endpoints are in the rendered set.
  const visibleIds = new Set(nodes.map((n) => n.id));
  const edgeKeys = new Set();
  const edges = [];
  for (const edge of WORKFLOW_TEMPLATE_EDGES) {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
    const key = edgeKey(edge);
    edgeKeys.add(key);
    edges.push({ ...edge, active: activeEdgeKeys.has(key) });
  }
  for (const edge of workflow?.edges || []) {
    const key = edgeKey(edge);
    if (!edgeKeys.has(key) && visibleIds.has(edge.from) && visibleIds.has(edge.to)) {
      edges.push({ ...edge, active: true });
    }
  }

  return { nodes, edges, activeEdgeKeys };
}

function normalizeWorkflowNodePayloads(node, workflow) {
  const details = workflow?.nodeDetails?.[node.id] || null;
  const hasOwnInput = Object.prototype.hasOwnProperty.call(node, "input");
  const hasOwnOutput = Object.prototype.hasOwnProperty.call(node, "output");
  const detailInput = workflowNodeDetailPayload(details, "input");
  const detailOutput = workflowNodeDetailPayload(details, "output");
  return {
    ...node,
    input: hasOwnInput ? node.input : detailInput,
    output: hasOwnOutput ? node.output : detailOutput,
    payloadSource: {
      input: hasOwnInput ? "node.input" : detailInput === null ? "not_captured" : "nodeDetails",
      output: hasOwnOutput ? "node.output" : detailOutput === null ? "not_captured" : "nodeDetails"
    }
  };
}

function workflowNodeDetailPayload(details, direction) {
  if (!details) return null;
  if (Object.prototype.hasOwnProperty.call(details, direction)) return details[direction];
  if (direction === "output" && Object.prototype.hasOwnProperty.call(details, "summary")) {
    const payload = { summary: details.summary };
    if (Object.prototype.hasOwnProperty.call(details, "output")) payload.output = details.output;
    return payload;
  }
  const logs = Array.isArray(details.logs) ? details.logs : [];
  if (!logs.length) return null;
  const selected = direction === "input" ? logs[0] : logs[logs.length - 1];
  if (!selected?.data) return null;
  return {
    from_run_event: selected.message || selected.step || direction,
    data: selected.data
  };
}

function renderWorkflowInspector(node, options = {}) {
  const inspector = $("workflowInspector");
  if (!inspector) return;
  const openRouterCalls = Array.isArray(node.openrouter) ? node.openrouter : [];
  const metrics = workflowNodeMetrics(node);
  const compareState = state.workflowCompare?.summary?.nodeStates?.get(node.id) || "";
  const focusLogs = options.focus === "logs";
  inspector.innerHTML = `
    <header class="workflowInspectorHeader">
      <span class="workflowIcon ${escapeHtml(node.kind)}">${iconForNode(node.kind)}</span>
      <div>
        <strong>${escapeHtml(node.label)}</strong>
        <small>${escapeHtml(node.id)} · ${statusLabel(node.status)}</small>
      </div>
    </header>
    <section class="workflowInspectorMetrics">
      <span><small>Duration</small><b>${escapeHtml(metrics.duration)}</b></span>
      <span><small>Tokens</small><b>${escapeHtml(metrics.tokens)}</b></span>
      <span><small>Cost</small><b>${escapeHtml(metrics.cost)}</b></span>
      <span><small>Calls</small><b>${escapeHtml(metrics.calls)}</b></span>
    </section>
    ${renderWorkflowCompareNotice(node, compareState)}
    ${renderWorkflowRegressionNotice(node)}
    ${renderWorkflowPerformanceDiff(node)}
    ${renderWorkflowPayloadDiff(node)}
    ${workflowNodeHasFallback(node) ? '<div class="workflowFallbackNotice">Fallback route used in this step</div>' : ""}
    ${workflowNodeErrorText(node) ? `<div class="workflowNodeError">${escapeHtml(workflowNodeErrorText(node))}</div>` : ""}
    ${renderOpenRouterCallDetails(openRouterCalls)}
    <details open>
      <summary>Input <span class="workflowPayloadSource">${escapeHtml(workflowPayloadSourceText(node, "input"))}</span></summary>
      <pre>${escapeHtml(safeWorkflowJson(node.input))}</pre>
    </details>
    <details open>
      <summary>Output <span class="workflowPayloadSource">${escapeHtml(workflowPayloadSourceText(node, "output"))}</span></summary>
      <pre>${escapeHtml(safeWorkflowJson(node.output))}</pre>
    </details>
    ${renderWorkflowSources(node)}
    ${renderWorkflowLogsForNode(node.id, { open: focusLogs })}
    <details>
      <summary>Raw JSON</summary>
      <pre>${escapeHtml(safeWorkflowJson(node))}</pre>
    </details>
  `;
  if (focusLogs) inspector.querySelector(".workflowNodeLogsDetails")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function renderWorkflowCompareNotice(node, compareState) {
  if (!state.workflowCompare?.summary?.active || !compareState) return "";
  const baseNode = (state.workflowCompare.baseRun?.workflow_log?.nodes || []).find((item) => item.id === node.id);
  const baseMetrics = baseNode ? workflowNodeMetrics(baseNode) : null;
  const currentMetrics = workflowNodeMetrics(node);
  const title = workflowCompareLabel(compareState).replace("Compare: ", "");
  return `
    <div class="workflowCompareNotice ${escapeHtml(compareState)}">
      <strong>${escapeHtml(title)}</strong>
      <span>Status ${escapeHtml(baseNode?.status || "new")} -> ${escapeHtml(node.status || "unknown")}</span>
      ${baseMetrics ? `<span>Duration ${escapeHtml(baseMetrics.duration)} -> ${escapeHtml(currentMetrics.duration)}</span>` : ""}
      ${baseMetrics ? `<span>Tokens ${escapeHtml(baseMetrics.tokens)} -> ${escapeHtml(currentMetrics.tokens)}</span>` : ""}
    </div>
  `;
}

function renderWorkflowRegressionNotice(node) {
  const regressions = state.workflowCompare?.summary?.regressionNodes?.get(node.id) || [];
  if (!regressions.length) return "";
  return `
    <section class="workflowRegressionNotice">
      <header>
        <strong>Regression indicators</strong>
        <span>${regressions.length} issue${regressions.length === 1 ? "" : "s"}</span>
      </header>
      <div>
        ${regressions.map((item) => `
          <span class="${escapeHtml(item.severity || "warning")}">
            <b>${escapeHtml(item.type)}</b>
            <small>${escapeHtml(item.message)}</small>
          </span>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWorkflowPerformanceDiff(node) {
  if (!state.workflowCompare?.summary?.active) return "";
  const baseNode = (state.workflowCompare.baseRun?.workflow_log?.nodes || []).find((item) => item.id === node.id);
  if (!baseNode) return "";
  const baseMetrics = workflowNodeMetrics(baseNode);
  const currentMetrics = workflowNodeMetrics(node);
  const durationDelta = currentMetrics.durationMs - baseMetrics.durationMs;
  const tokenDelta = currentMetrics.totalTokens - baseMetrics.totalTokens;
  const costDelta = currentMetrics.costValue !== null && baseMetrics.costValue !== null
    ? currentMetrics.costValue - baseMetrics.costValue
    : null;
  return `
    <section class="workflowPerformanceDiff">
      <header>
        <strong>Performance diff</strong>
        <span>Base -> Compare</span>
      </header>
      <div class="workflowPerformanceDiffGrid">
        ${renderWorkflowPerformanceDiffMetric("Duration", baseMetrics.duration, currentMetrics.duration, workflowSignedDelta(durationDelta, formatOpenRouterDuration), durationDelta)}
        ${renderWorkflowPerformanceDiffMetric("Tokens", baseMetrics.tokens, currentMetrics.tokens, workflowSignedDelta(tokenDelta, (value) => value.toLocaleString()), tokenDelta)}
        ${renderWorkflowPerformanceDiffMetric("Cost", baseMetrics.cost, currentMetrics.cost, costDelta === null ? "n/a" : workflowSignedDelta(costDelta, formatOpenRouterCost), costDelta)}
      </div>
    </section>
  `;
}

function renderWorkflowPerformanceDiffMetric(label, baseValue, currentValue, delta, numericDelta) {
  const direction = numericDelta === null || numericDelta === 0 ? "" : numericDelta > 0 ? "worse" : "better";
  return `
    <span class="${direction}">
      <small>${escapeHtml(label)}</small>
      <b>${escapeHtml(baseValue)} -> ${escapeHtml(currentValue)}</b>
      <em>${escapeHtml(delta)}</em>
    </span>
  `;
}

function renderWorkflowPayloadDiff(node) {
  if (!state.workflowCompare?.summary?.active) return "";
  const baseNode = (state.workflowCompare.baseRun?.workflow_log?.nodes || []).find((item) => item.id === node.id);
  if (!baseNode) {
    return `
      <section class="workflowPayloadDiff added">
        <header>
          <strong>Payload diff</strong>
          <span>New node in compare run</span>
        </header>
      </section>
    `;
  }
  const inputDiff = workflowPayloadDiffRows(baseNode.input, node.input);
  const outputDiff = workflowPayloadDiffRows(baseNode.output, node.output);
  return `
    <section class="workflowPayloadDiff">
      <header>
        <strong>Payload diff</strong>
        <span>${inputDiff.total + outputDiff.total} changed fields</span>
      </header>
      ${renderWorkflowPayloadDiffGroup("Input", inputDiff, baseNode.input, node.input)}
      ${renderWorkflowPayloadDiffGroup("Output", outputDiff, baseNode.output, node.output)}
    </section>
  `;
}

function renderWorkflowPayloadDiffGroup(label, diff, basePayload, currentPayload) {
  const rows = diff.rows.slice(0, 16).map((row) => `
    <div class="workflowPayloadDiffRow ${escapeHtml(row.type)}">
      <b>${escapeHtml(row.type)}</b>
      <span>${escapeHtml(row.path)}</span>
      <small>${escapeHtml(row.before)} -> ${escapeHtml(row.after)}</small>
    </div>
  `).join("");
  const empty = '<div class="workflowPayloadDiffEmpty">No payload changes in this section</div>';
  const overflow = diff.total > diff.rows.length
    ? `<div class="workflowPayloadDiffEmpty">${diff.total - diff.rows.length} more changes hidden</div>`
    : "";
  return `
    <details class="workflowPayloadDiffGroup" ${diff.total ? "open" : ""}>
      <summary>${escapeHtml(label)} diff · ${diff.total}</summary>
      <div class="workflowPayloadDiffRows">${rows || empty}${overflow}</div>
      <div class="workflowPayloadDiffPair">
        <div>
          <b>Base ${escapeHtml(label)}</b>
          <pre>${escapeHtml(safeWorkflowJson(basePayload))}</pre>
        </div>
        <div>
          <b>Compare ${escapeHtml(label)}</b>
          <pre>${escapeHtml(safeWorkflowJson(currentPayload))}</pre>
        </div>
      </div>
    </details>
  `;
}

function workflowPayloadDiffRows(baseValue, currentValue, path = "$", rows = []) {
  if (rows.length >= 16) return { rows, total: rows.length };
  if (workflowPayloadDiffEqual(baseValue, currentValue)) return { rows, total: rows.length };
  const baseIsObject = baseValue && typeof baseValue === "object";
  const currentIsObject = currentValue && typeof currentValue === "object";
  if (!baseIsObject || !currentIsObject || Array.isArray(baseValue) !== Array.isArray(currentValue)) {
    rows.push({
      type: baseValue === undefined ? "added" : currentValue === undefined ? "removed" : "changed",
      path,
      before: workflowPayloadDiffPreview(baseValue),
      after: workflowPayloadDiffPreview(currentValue)
    });
    return { rows, total: rows.length };
  }
  const keys = Array.isArray(baseValue) || Array.isArray(currentValue)
    ? [...Array(Math.max(baseValue?.length || 0, currentValue?.length || 0)).keys()]
    : [...new Set([...Object.keys(baseValue || {}), ...Object.keys(currentValue || {})])].sort();
  let total = rows.length;
  for (const key of keys) {
    const childPath = Array.isArray(baseValue) || Array.isArray(currentValue) ? `${path}[${key}]` : `${path}.${key}`;
    const before = baseValue?.[key];
    const after = currentValue?.[key];
    if (workflowPayloadDiffEqual(before, after)) continue;
    total += 1;
    if (rows.length < 16) workflowPayloadDiffRows(before, after, childPath, rows);
  }
  return { rows, total };
}

function workflowPayloadDiffEqual(left, right) {
  if (left === right) return true;
  return safeWorkflowJson(left) === safeWorkflowJson(right);
}

function workflowPayloadDiffPreview(value) {
  if (value === undefined) return "(missing)";
  if (value === null) return "null";
  if (typeof value === "string") return clipWorkflowLine(maskSensitivePreview(value), 80);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return clipWorkflowLine(formatWorkflowPreview(value), 100);
}

function renderWorkflowEdgeInspector(edge, view) {
  const inspector = $("workflowInspector");
  if (!inspector || !edge) return;
  const source = view.nodes.find((node) => node.id === edge.from);
  const target = view.nodes.find((node) => node.id === edge.to);
  const routeState = edge.removed ? "removed" : state.workflowCompare?.summary?.edgeStates?.get(edgeKey(edge)) || "";
  inspector.innerHTML = `
    <header class="workflowInspectorHeader">
      <span class="workflowIcon tool">EDGE</span>
      <div>
        <strong>${escapeHtml(source?.label || edge.from)} -> ${escapeHtml(target?.label || edge.to)}</strong>
        <small>${escapeHtml(edge.from)} Â· ${escapeHtml(edge.to)} Â· ${edge.active ? "active" : "inactive"}</small>
      </div>
    </header>
    <section class="workflowInspectorMetrics">
      <span><small>Source</small><b>${escapeHtml(edge.from)}</b></span>
      <span><small>Target</small><b>${escapeHtml(edge.to)}</b></span>
      <span><small>Status</small><b>${edge.active ? "Active" : "Skipped"}</b></span>
      <span><small>Mapping</small><b>${escapeHtml(workflowMappingSummary(source?.output, target?.input))}</b></span>
    </section>
    ${renderWorkflowRouteDiff(edge, routeState)}
    <details open>
      <summary>Payload from source output</summary>
      <pre>${escapeHtml(safeWorkflowJson(source?.output || {}))}</pre>
    </details>
    <details open>
      <summary>Target input</summary>
      <pre>${escapeHtml(safeWorkflowJson(target?.input || {}))}</pre>
    </details>
    <details>
      <summary>Raw edge JSON</summary>
      <pre>${escapeHtml(safeWorkflowJson(edge))}</pre>
    </details>
  `;
}

function renderWorkflowRouteDiff(edge, routeState) {
  if (!state.workflowCompare?.summary?.active) return "";
  const summary = state.workflowCompare.summary;
  const label = {
    added: "Route added in compare run",
    removed: "Route removed from compare run",
    same: "Route unchanged"
  }[routeState] || "Route changed";
  return `
    <section class="workflowRouteDiff ${escapeHtml(routeState || "changed")}">
      <header>
        <strong>Route diff</strong>
        <span>${escapeHtml(label)}</span>
      </header>
      <div class="workflowRouteDiffGrid">
        <span><small>Selected edge</small><b>${escapeHtml(edgeLabel(edge))}</b></span>
        <span><small>Added routes</small><b>${summary.routeAdded}</b></span>
        <span><small>Removed routes</small><b>${summary.routeRemoved}</b></span>
      </div>
      ${renderWorkflowRouteDiffList("Added", summary.addedEdges, "added")}
      ${renderWorkflowRouteDiffList("Removed", summary.removedEdges, "removed")}
    </section>
  `;
}

function renderWorkflowRouteDiffList(label, edges, type) {
  if (!edges?.length) return "";
  return `
    <div class="workflowRouteDiffList ${escapeHtml(type)}">
      <b>${escapeHtml(label)}</b>
      ${edges.slice(0, 8).map((edge) => `<span>${escapeHtml(edgeLabel(edge))}</span>`).join("")}
    </div>
  `;
}

function workflowMappingSummary(sourceOutput, targetInput) {
  const sourceKeys = sourceOutput && typeof sourceOutput === "object" ? Object.keys(sourceOutput).slice(0, 4) : [];
  const targetKeys = targetInput && typeof targetInput === "object" ? Object.keys(targetInput).slice(0, 4) : [];
  if (!sourceKeys.length && !targetKeys.length) return "preview only";
  return `${sourceKeys.join(", ") || "output"} -> ${targetKeys.join(", ") || "input"}`;
}

function workflowLogsForNode(nodeId) {
  return [
    ...(state.lastWorkflow?.trace || []),
    ...(state.runEvents || [])
  ].filter((entry) => entry?.step === nodeId || entry?.node_id === nodeId || entry?.data?.node_id === nodeId);
}

function renderWorkflowLogsForNode(nodeId, options = {}) {
  const entries = workflowLogsForNode(nodeId);
  if (!entries.length) return "";
  return `
    <details class="workflowNodeLogsDetails" ${options.open ? "open" : ""}>
      <summary>Logs for node (${entries.length})</summary>
      <div class="workflowNodeLogs">
        ${entries.slice(-12).map((entry) => `
          <div>
            <b>${escapeHtml(entry.step || nodeId)}</b>
            <span>${escapeHtml(entry.message || entry.status || entry.type || "")}</span>
            ${entry.data ? `<pre>${escapeHtml(safeWorkflowJson(entry.data))}</pre>` : ""}
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderWorkflowSources(node) {
  const sources = collectWorkflowSources(node.output);
  if (!sources.length) return "";
  return `
    <details open>
      <summary>Sources (${sources.length})</summary>
      <div class="workflowSourceList">
        ${sources.slice(0, 8).map((source) => `
          <div>
            <strong>${escapeHtml(source.title || source.id || source.source_table || "Source")}</strong>
            ${source.source_url ? `<a href="${escapeHtml(source.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.source_url)}</a>` : ""}
            ${source.summary || source.text ? `<small>${escapeHtml(clipWorkflowLine(source.summary || source.text, 180))}</small>` : ""}
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function collectWorkflowSources(value) {
  const sources = [];
  const visit = (item, depth = 0) => {
    if (!item || depth > 4) return;
    if (Array.isArray(item)) {
      for (const child of item.slice(0, 30)) visit(child, depth + 1);
      return;
    }
    if (typeof item !== "object") return;
    if (item.source_url || item.url || item.source_table || item.source_id) {
      sources.push({
        ...item,
        source_url: item.source_url || item.url || "",
        text: item.text || item.content || item.index_text || ""
      });
    }
    for (const key of ["sources", "records", "results", "documents", "rows", "items"]) {
      if (item[key]) visit(item[key], depth + 1);
    }
  };
  visit(value);
  return sources;
}

function safeWorkflowJson(value) {
  try {
    return maskSensitivePreview(JSON.stringify(value ?? null, null, 2));
  } catch {
    return maskSensitivePreview(String(value));
  }
}

function renderOpenRouterCallDetails(calls) {
  if (!calls.length) return "";
  return `
    <section class="openRouterCallList">
      <h3>OpenRouter usage</h3>
      ${calls.map((call, index) => `
        <article class="openRouterCall ${call.status === "error" ? "error" : ""}">
          <header>
            <strong>${escapeHtml(call.actual_model || call.requested_model || "Unknown model")}</strong>
            <span>${calls.length > 1 ? `Call ${index + 1}` : escapeHtml(call.kind || "model")}</span>
          </header>
          <div class="openRouterCallGrid">
            <span><small>Input</small><b>${formatOpenRouterNumber(call.prompt_tokens)}</b></span>
            <span><small>Output</small><b>${formatOpenRouterNumber(call.completion_tokens)}</b></span>
            <span><small>Cost</small><b>${formatOpenRouterCost(call.cost)}</b></span>
            <span><small>Time</small><b>${formatOpenRouterDuration(call.duration_ms)}</b></span>
            <span><small>Speed</small><b>${formatOpenRouterSpeed(call.tokens_per_second)}</b></span>
            <span><small>Finish</small><b>${escapeHtml(call.finish_reason || call.status || "—")}</b></span>
          </div>
          ${call.generation_id ? `<div class="openRouterGenerationId" title="${escapeHtml(call.generation_id)}">ID: ${escapeHtml(call.generation_id)}</div>` : ""}
          ${call.error ? `<div class="openRouterCallError">${escapeHtml(call.error)}</div>` : ""}
        </article>
      `).join("")}
    </section>
  `;
}

function formatOpenRouterNumber(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—";
}

function formatOpenRouterCost(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const cost = Number(value);
  return cost < 0.0001 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
}

function formatOpenRouterDuration(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const milliseconds = Number(value);
  return milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(2)} s`;
}

function formatOpenRouterSpeed(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} tok/s` : "—";
}

function wireDelayClaims() {
  initProjectInsightsDefaults();
  $("refreshDelayClaims")?.addEventListener("click", loadDelayClaims);
  $("runProjectInsightsAnalysis")?.addEventListener("click", runProjectInsightsAnalysisFromUi);
  $("expandProjectInsightsAnalysis")?.addEventListener("click", () => runProjectInsightsAnalysisFromUi({ expansion: true }));
  // Evidence toggle (event delegation — works for dynamically rendered cards)
  document.querySelector("#insights")?.addEventListener("click", (e) => {
    const toggle = e.target.closest(".insightEvidenceToggle");
    if (!toggle) return;
    const ev = toggle.nextElementSibling;
    if (!ev) return;
    const collapsed = ev.dataset.collapsed === "true";
    ev.dataset.collapsed = collapsed ? "false" : "true";
    toggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
  });
  $("refreshHashtagChart")?.addEventListener("click", loadHashtagChart);
  $("toggleProjectInsightsHistory")?.addEventListener("click", toggleProjectInsightHistory);
  $("refreshProjectInsightsHistory")?.addEventListener("click", () => loadProjectInsightHistory({ force: true }));
  // Reload chart when date range changes
  let _chartDebounce;
  const reloadChartOnDateChange = () => { clearTimeout(_chartDebounce); _chartDebounce = setTimeout(loadHashtagChart, 400); };
  $("projectInsightsFrom")?.addEventListener("change", reloadChartOnDateChange);
  $("projectInsightsTo")?.addEventListener("change", reloadChartOnDateChange);
  // Ctrl+Enter on focus query → run; Ctrl+Shift+Enter → expand
  $("projectInsightsQuery")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) {
        if (!$("expandProjectInsightsAnalysis")?.disabled) runProjectInsightsAnalysisFromUi({ expansion: true });
      } else {
        runProjectInsightsAnalysisFromUi();
      }
    }
  });
  $("delayClaimForm")?.addEventListener("submit", createDelayClaimFromForm);
  $("delayEventForm")?.addEventListener("submit", createDelayEventFromForm);
  $("runDelayClaimAnalysis")?.addEventListener("click", runDelayClaimAnalysisFromUi);
  $("runDelayClaimPackage")?.addEventListener("click", runDelayClaimPackageFromUi);
}

function initProjectInsightsDefaults() {
  if ($("projectInsightsFrom") && !$("projectInsightsFrom").value) $("projectInsightsFrom").value = "2024-02-01";
  if ($("projectInsightsTo") && !$("projectInsightsTo").value) $("projectInsightsTo").value = "2026-01-01";
}

async function runProjectInsightsAnalysisFromUi({ expansion = false } = {}) {
  if (state.projectInsightsRunning) return;
  const button = $("runProjectInsightsAnalysis");
  const expandButton = $("expandProjectInsightsAnalysis");
  state.projectInsightsRunning = true;
  const agentCard = document.querySelector(".projectInsightsAgent");
  if (agentCard) agentCard.dataset.running = "true";
  if (!expansion) {
    state.lastProjectInsights = null;
    state.projectInsightsScannedKeys = [];
    state.projectInsightsRuns = 0;
    state.selectedProjectInsightRunId = null;
    renderProjectInsightsResults();
  }
  const excluded = expansion ? state.projectInsightsScannedKeys : [];
  const runId = `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  renderProjectInsightsStatus(expansion
    ? `מרחיב תשובה ומדלג על ${excluded.length.toLocaleString()} מקורות שכבר נותחו...`
    : "מריץ ניתוח על נתוני האינדקס...");
  startInsightsLiveRun(runId);
  // Show skeleton cards while loading
  const resultsContainer = $("projectInsightsResults");
  if (resultsContainer && !expansion) {
    resultsContainer.innerHTML = `<div class="projectInsightsSynthesized"><div class="projectInsightsSectionHeader"><h3>תובנות AI</h3><span>מנתח...</span></div><div class="projectInsightsResultsGrid">${Array(3).fill('<div class="insightSkeleton"></div>').join("")}</div></div>`;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "מנתח...";
  }
  if (expandButton) {
    expandButton.disabled = true;
    expandButton.textContent = expansion ? "מרחיב..." : "הרחב תשובה";
  }
  try {
    const result = await api("/api/insights/analyze", {
      method: "POST",
      // Deep-engine runs (trend baseline scan, hypothesis LLM calls, synthesis retry)
      // can pass 5 minutes; keep the client attached rather than erroring early.
      timeoutMs: 900_000,
      body: {
        runId,
        focusQuery: $("projectInsightsQuery")?.value || "",
        dateFrom: $("projectInsightsFrom")?.value || null,
        dateTo: $("projectInsightsTo")?.value || null,
        limit: Number($("projectInsightsLimit")?.value || 350),
        selectedHashtags: state.selectedInsightHashtags || [],
        hashtagMode: "boost",
        insights: collectInsightEngineFlags(),
        excludeSourceKeys: excluded,
        expansion,
        parentRunId: expansion ? state.lastProjectInsights?.runId || state.selectedProjectInsightRunId || null : null
      }
    });
    state.lastProjectInsights = expansion
      ? mergeProjectInsightsResults(state.lastProjectInsights, result)
      : result;
    state.projectInsightsScannedKeys = mergeUnique([
      ...state.projectInsightsScannedKeys,
      ...(result.scannedSourceKeys || [])
    ]);
    state.projectInsightsRuns += 1;
    state.selectedProjectInsightRunId = state.lastProjectInsights?.runId || result.runId || null;
    state.lastWorkflow = result.workflowLog || null;
    state.currentWorkflowMessageId = result.runId || null;
    if (state.lastWorkflow) renderWorkflow(state.lastWorkflow);
    await loadRunHistory();
    await loadProjectInsightHistory();
    renderProjectInsightsStatus();
    renderProjectInsightHistory();
    renderProjectInsightsResults();
    showToast(expansion ? "התשובה הורחבה" : "ניתוח התובנות הסתיים");
    // Auto-scroll to results
    setTimeout(() => $("projectInsightsResults")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  } catch (error) {
    state.lastProjectInsights = expansion && state.lastProjectInsights
      ? { ...state.lastProjectInsights, expansionError: error.message }
      : { ok: false, error: error.message };
    renderProjectInsightsStatus();
    renderProjectInsightsResults();
    showToast(`ניתוח תובנות נכשל: ${error.message}`, "error");
  } finally {
    stopInsightsLiveRun();
    state.projectInsightsRunning = false;
    const agentCardFinal = document.querySelector(".projectInsightsAgent");
    if (agentCardFinal) delete agentCardFinal.dataset.running;
    if (button) {
      button.disabled = false;
      button.textContent = "נתח את הפרויקט";
    }
    if (expandButton) {
      expandButton.disabled = !state.lastProjectInsights || state.lastProjectInsights.ok === false;
      expandButton.textContent = "הרחב תשובה";
    }
  }
}

// Per-run engine toggles (phase-2): only true flags are sent; undefined is dropped
// by JSON.stringify so an empty selection keeps the persisted config defaults.
function collectInsightEngineFlags() {
  const flags = {};
  if ($("insightsFlagTrend")?.checked) flags.crossWindowTrend = true;
  if ($("insightsFlagRootCause")?.checked) flags.rootCauseHypotheses = true;
  if ($("insightsFlagHealth")?.checked) flags.healthScore = true;
  if ($("insightsFlagGraph")?.checked) flags.graphClustering = true;
  return Object.keys(flags).length ? flags : undefined;
}

function mergeProjectInsightsResults(previous, next) {
  if (!previous || previous.ok === false) return next;
  const previousFindings = normalizeProjectFindings(previous, { legacyInsightsAsFindings: true });
  const nextFindings = normalizeProjectFindings(next);
  const previousInsights = normalizeProjectInsights(previous);
  const nextInsights = normalizeProjectInsights(next);
  return {
    ...next,
    summary: {
      ...(next.summary || {}),
      totalRecords: Number(previous.summary?.totalRecords || 0) + Number(next.summary?.totalRecords || 0),
      sourceCounts: mergeSourceCounts(previous.summary?.sourceCounts, next.summary?.sourceCounts),
      expandedRuns: Number(previous.summary?.expandedRuns || 1) + 1
    },
    findings: dedupeProjectFindingCards([...previousFindings, ...nextFindings]),
    insights: dedupeProjectInsightCards([...previousInsights, ...nextInsights]),
    recordsSample: [...(previous.recordsSample || []), ...(next.recordsSample || [])].slice(0, 24),
    scannedSourceKeys: mergeUnique([...(previous.scannedSourceKeys || []), ...(next.scannedSourceKeys || [])]),
    expansionRuns: [...(previous.expansionRuns || []), next]
  };
}

function normalizeProjectFindings(result = {}, { legacyInsightsAsFindings = false } = {}) {
  if (Array.isArray(result.findings)) return result.findings;
  if (Array.isArray(result.metadata?.findings)) return result.metadata.findings;
  const cards = Array.isArray(result.insights) ? result.insights : [];
  if (!legacyInsightsAsFindings && !result.legacy) return [];
  if (cards.some((item) => Array.isArray(item?.supporting_finding_ids) && item.supporting_finding_ids.length)) return [];
  return cards.map((item, index) => legacyInsightToFinding(item, index));
}

function normalizeProjectInsights(result = {}) {
  const cards = Array.isArray(result.insights) ? result.insights : [];
  if (!cards.length) return [];
  if (Array.isArray(result.findings) || Array.isArray(result.metadata?.findings)) return cards;
  return cards.filter((item) => Array.isArray(item?.supporting_finding_ids) && item.supporting_finding_ids.length);
}

function legacyInsightToFinding(item = {}, index = 0) {
  return {
    ...item,
    id: item.id && String(item.id).startsWith("finding_") ? item.id : `legacy_finding_${index + 1}`,
    finding: item.finding || item.insight || "",
    statement: item.statement || item.finding || item.insight || "",
    human_status: item.human_status || "new",
    legacy: true
  };
}

function mergeSourceCounts(first = {}, second = {}) {
  const merged = { ...(first || {}) };
  for (const [key, value] of Object.entries(second || {})) {
    merged[key] = Number(merged[key] || 0) + Number(value || 0);
  }
  return merged;
}

function dedupeProjectInsightCards(insights = []) {
  const seen = new Set();
  const output = [];
  for (const insight of insights) {
    const evidenceKey = (insight.evidence || []).map((item) => [item.source_table, item.source_id, item.id].filter(Boolean).join(":")).join("|");
    const supportKey = Array.isArray(insight.supporting_finding_ids) ? insight.supporting_finding_ids.join("|") : "";
    const key = [insight.category, insight.title, supportKey, evidenceKey || insight.finding || insight.insight].filter(Boolean).join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(insight);
  }
  return output;
}

function dedupeProjectFindingCards(findings = []) {
  const seen = new Set();
  const output = [];
  for (const finding of findings) {
    const evidenceKey = (finding.evidence || []).map((item) => [item.source_table, item.source_id, item.id].filter(Boolean).join(":")).join("|");
    const key = [finding.id, finding.category, finding.title, evidenceKey || finding.finding || finding.statement].filter(Boolean).join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
}

function mergeUnique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toggleInsightHashtag(tag) {
  const clean = String(tag || "").trim().replace(/^#+/, "");
  if (!clean) return;
  const current = Array.isArray(state.selectedInsightHashtags) ? state.selectedInsightHashtags : [];
  state.selectedInsightHashtags = current.includes(clean)
    ? current.filter((item) => item !== clean)
    : [...current, clean].slice(0, 8);
}

async function loadHashtagChart({ sortAlpha = false, source = loadHashtagChart._source || "alerts" } = {}) {
  loadHashtagChart._source = source;
  const canvas = $("hashtagChartCanvas");
  const empty = $("hashtagChartEmpty");
  if (!canvas) return;
  try {
    const dateFrom = $("projectInsightsFrom")?.value || "";
    const dateTo = $("projectInsightsTo")?.value || "";
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("source", source);
    const result = await api(`/api/insights/hashtags?${params}`, { timeoutMs: 15_000 });
    const all = Array.isArray(result.hashtags) ? result.hashtags : [];
    let hashtags = all.slice(0, 30);
    if (sortAlpha) hashtags = [...hashtags].sort((a, b) => a.tag.localeCompare(b.tag, "he"));

    // Inject chart controls if not already present
    const wrap = canvas.parentElement;
    let controlBar = wrap?.previousElementSibling;
    if (!controlBar || !controlBar.classList.contains("insightsChartControls")) {
      controlBar = document.createElement("div");
      controlBar.className = "insightsChartControls";
      wrap?.parentElement?.insertBefore(controlBar, wrap);
    }
    const totalLabel = result.total != null ? `${result.total} רשומות · ` : "";
    const selected = Array.isArray(state.selectedInsightHashtags) ? state.selectedInsightHashtags : [];
    const selectedHtml = selected.length
      ? `<div class="insightsSelectedHashtags">${selected.map((tag) => `<button type="button" class="insightsSelectedHashtag" data-hashtag="${escapeHtml(tag)}">#${escapeHtml(tag)} ×</button>`).join("")}<button type="button" class="insightsClearHashtags" id="clearInsightHashtags">נקה</button></div>`
      : `<div class="insightsSelectedHashtags is-empty">לחץ על עמודת hashtag כדי לחזק אותה בניתוח הבא</div>`;
    controlBar.innerHTML = `
      <span class="insightsChartTotalBadge">${totalLabel}${all.length} האשטגים</span>
      <div class="insightsChartSourceToggle">
        <button class="insightsChartSortBtn" aria-pressed="${source === "alerts" ? "true" : "false"}" id="hashtagSourceAlerts">Alerts</button>
        <button class="insightsChartSortBtn" aria-pressed="${source === "index" ? "true" : "false"}" id="hashtagSourceIndex">אינדקס</button>
      </div>
      <div class="insightsChartSortGroup">
        <button class="insightsChartSortBtn" aria-pressed="${sortAlpha ? "true" : "false"}" id="hashtagSortAlpha">א-ב</button>
        <button class="insightsChartSortBtn" aria-pressed="${!sortAlpha ? "true" : "false"}" id="hashtagSortCount">כמות</button>
      </div>
      ${selectedHtml}
    `;
    controlBar.querySelector("#hashtagSortAlpha")?.addEventListener("click", () => loadHashtagChart({ sortAlpha: true }));
    controlBar.querySelector("#hashtagSortCount")?.addEventListener("click", () => loadHashtagChart({ sortAlpha: false }));
    controlBar.querySelector("#hashtagSourceAlerts")?.addEventListener("click", () => loadHashtagChart({ source: "alerts" }));
    controlBar.querySelector("#hashtagSourceIndex")?.addEventListener("click", () => loadHashtagChart({ source: "index" }));
    controlBar.querySelector("#clearInsightHashtags")?.addEventListener("click", () => {
      state.selectedInsightHashtags = [];
      loadHashtagChart({ sortAlpha, source });
    });
    controlBar.querySelectorAll(".insightsSelectedHashtag").forEach((button) => {
      button.addEventListener("click", () => {
        toggleInsightHashtag(button.dataset.hashtag || "");
        loadHashtagChart({ sortAlpha, source });
      });
    });

    if (!hashtags.length) {
      canvas.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    canvas.hidden = false;
    if (empty) empty.hidden = true;
    drawHashtagBarChart(canvas, hashtags, { selectedHashtags: state.selectedInsightHashtags });
    attachChartTooltip(canvas, hashtags, { sortAlpha, source });
  } catch {
    canvas.hidden = true;
    if (empty) { empty.hidden = false; empty.textContent = "שגיאה בטעינת נתוני האשטגים."; }
  }
}

function attachChartTooltip(canvas, hashtags, { sortAlpha = false, source = "alerts" } = {}) {
  // Remove previous listener
  canvas._tooltipCleanup?.();
  let tooltip = document.querySelector(".insightsChartTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "insightsChartTooltip";
    document.body.appendChild(tooltip);
  }

  function getBarIndex(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const W = rect.width;
    const n = hashtags.length;
    const PAD_LEFT = 8, PAD_RIGHT = 8;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const barW = Math.max(4, Math.floor((chartW / n) * 0.72));
    const gap = (chartW - barW * n) / (n + 1);
    for (let i = 0; i < n; i++) {
      const bx = PAD_LEFT + gap + i * (barW + gap);
      if (x >= bx && x <= bx + barW) return i;
    }
    return -1;
  }

  const onMove = (e) => {
    const i = getBarIndex(e);
    if (i < 0) { tooltip.classList.remove("visible"); return; }
    tooltip.textContent = `#${hashtags[i].tag}: ${hashtags[i].count}`;
    tooltip.style.left = (e.clientX + 12) + "px";
    tooltip.style.top  = (e.clientY - 28) + "px";
    tooltip.classList.add("visible");
  };
  const onLeave = () => tooltip.classList.remove("visible");
  const onClick = (e) => {
    const i = getBarIndex(e);
    if (i < 0) return;
    toggleInsightHashtag(hashtags[i]?.tag || "");
    loadHashtagChart({ sortAlpha, source });
  };

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
  canvas.addEventListener("click", onClick);
  canvas._tooltipCleanup = () => {
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
    canvas.removeEventListener("click", onClick);
  };
}

function drawHashtagBarChart(canvas, hashtags, { selectedHashtags = [] } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || canvas.offsetWidth || 600;
  const H = 220;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const PAD_TOP = 16, PAD_BOTTOM = 52, PAD_LEFT = 8, PAD_RIGHT = 8;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const n = hashtags.length;
  const maxCount = Math.max(...hashtags.map((item) => Number(item.count || 0)), 1);
  const barW = Math.max(4, Math.floor((chartW / n) * 0.72));
  const gap = (chartW - barW * n) / (n + 1);
  const selectedSet = new Set((selectedHashtags || []).map((tag) => String(tag).toLowerCase()));

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  const gridLines = 4;
  ctx.strokeStyle = "rgba(120,216,143,0.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD_TOP + (chartH / gridLines) * i;
    ctx.beginPath(); ctx.moveTo(PAD_LEFT, y); ctx.lineTo(W - PAD_RIGHT, y); ctx.stroke();
  }

  hashtags.forEach(({ tag, count }, i) => {
    const selected = selectedSet.has(String(tag || "").toLowerCase());
    const x = PAD_LEFT + gap + i * (barW + gap);
    const barH = Math.max(2, Math.round((count / maxCount) * chartH));
    const y = PAD_TOP + chartH - barH;

    // Bar gradient
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, selected ? "#ffd166" : "#5eefc0");
    grad.addColorStop(1, selected ? "#d29922" : "#3f8d68");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = "rgba(255,209,102,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Count label on top
    ctx.fillStyle = "#c8f5d8";
    ctx.font = `600 11px Assistant, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(count, x + barW / 2, y - 4);

    // Hashtag label below
    ctx.save();
    ctx.translate(x + barW / 2, PAD_TOP + chartH + 8);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#8aab94";
    ctx.font = `12px Assistant, sans-serif`;
    ctx.textAlign = "right";
    const label = tag.length > 14 ? tag.slice(0, 13) + "…" : tag;
    ctx.fillText("#" + label, 0, 0);
    ctx.restore();
  });
}

async function loadProjectInsightHistory({ force = false } = {}) {
  const list = $("projectInsightsHistoryList");
  if (!list) return;
  syncProjectInsightHistoryPanel();
  if (!force && state.projectInsightHistory.length) {
    renderProjectInsightHistory();
    return;
  }
  list.textContent = "טוען היסטוריה...";
  try {
    const result = await api("/api/insights/runs?limit=30", { timeoutMs: 20_000 });
    state.projectInsightHistory = Array.isArray(result.runs) ? result.runs : [];
    renderProjectInsightHistory();
  } catch (error) {
    list.innerHTML = `<div class="projectInsightEmpty">לא ניתן לטעון היסטוריה: ${escapeHtml(error.message)}</div>`;
  }
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "לפני רגע";
  if (diff < 3600) return `לפני ${Math.round(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.round(diff / 3600)} שעות`;
  if (diff < 86400 * 7) return `לפני ${Math.round(diff / 86400)} ימים`;
  return new Date(dateStr).toLocaleDateString("he-IL");
}

function renderProjectInsightHistory() {
  const list = $("projectInsightsHistoryList");
  if (!list) return;
  const runs = Array.isArray(state.projectInsightHistory) ? state.projectInsightHistory : [];
  syncProjectInsightHistoryPanel();
  if (!runs.length) {
    list.innerHTML = '<div class="projectInsightEmpty">אין עדיין ריצות תובנות שמורות.</div>';
    return;
  }
  list.innerHTML = runs.map((run) => {
    const runId = run.run_id || run.runId || "";
    const normalized = normalizeProjectInsightRun(run);
    const insightsCount = Array.isArray(normalized.insights) ? normalized.insights.length : 0;
    const findingsCount = Array.isArray(normalized.findings) ? normalized.findings.length : 0;
    const scannedCount = Array.isArray(run.scanned_source_keys) ? run.scanned_source_keys.length : 0;
    const focus = run.focus_query || run.summary?.focusQuery || "סריקת אינדקס כללית";
    const active = runId && runId === state.selectedProjectInsightRunId;
    const isError = run.status === "error";
    const statusLabel = isError ? "נכשל" : run.is_expansion ? "הרחבה" : "ריצה";
    const statusColor = isError ? "color:var(--i-red)" : run.is_expansion ? "color:var(--i-blue)" : "color:var(--i-green-hi)";
    return `
      <button type="button" class="projectInsightsHistoryItem" data-run-id="${escapeHtml(runId)}" aria-pressed="${active ? "true" : "false"}">
        <span>
          <strong>${escapeHtml(focus)}</strong>
          <small>${insightsCount} תובנות · ${findingsCount} ממצאים · ${scannedCount.toLocaleString()} מקורות</small>
          <small style="${statusColor}">${escapeHtml(statusLabel)} · ${relativeTime(run.created_at)}</small>
        </span>
      </button>
    `;
  }).join("");
  // Delegated once on the container: async refreshes re-render the buttons, and
  // per-button listeners were lost with them (first click after a refresh was swallowed).
  if (!list.dataset.delegated) {
    list.dataset.delegated = "true";
    list.addEventListener("click", (event) => {
      const button = event.target.closest(".projectInsightsHistoryItem");
      if (!button) return;
      const currentRuns = Array.isArray(state.projectInsightHistory) ? state.projectInsightHistory : [];
      const run = currentRuns.find((item) => String(item.run_id || item.runId) === String(button.dataset.runId));
      if (run) selectProjectInsightRun(run);
    });
  }
}

function syncProjectInsightHistoryPanel() {
  const panel = document.querySelector(".projectInsightsHistoryPanel");
  const list = $("projectInsightsHistoryList");
  const toggle = $("toggleProjectInsightsHistory");
  if (!panel || !list || !toggle) return;
  const expanded = state.projectInsightHistoryExpanded === true;
  const runs = Array.isArray(state.projectInsightHistory) ? state.projectInsightHistory : [];
  panel.dataset.collapsed = expanded ? "false" : "true";
  list.hidden = !expanded;
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.textContent = expanded ? "הסתר היסטוריה" : buildProjectInsightHistoryToggleLabel(runs);
}

function buildProjectInsightHistoryToggleLabel(runs) {
  const count = Array.isArray(runs) ? runs.length : 0;
  if (!count) return "הצג היסטוריה";
  return `הצג היסטוריה (${count})`;
}

function toggleProjectInsightHistory() {
  state.projectInsightHistoryExpanded = !state.projectInsightHistoryExpanded;
  syncProjectInsightHistoryPanel();
  if (state.projectInsightHistoryExpanded && !state.projectInsightHistory.length) {
    loadProjectInsightHistory({ force: true });
  }
}

function selectProjectInsightRun(run) {
  const normalized = normalizeProjectInsightRun(run);
  state.selectedProjectInsightRunId = normalized.runId;
  state.lastProjectInsights = normalized;
  state.projectInsightsScannedKeys = Array.isArray(run.scanned_source_keys) ? run.scanned_source_keys : [];
  state.projectInsightsRuns = Number(normalized.summary?.expandedRuns || run.metadata?.runCount || (run.is_expansion ? 2 : 1) || 1);
  if ($("projectInsightsQuery")) $("projectInsightsQuery").value = run.focus_query || normalized.summary?.focusQuery || "";
  if ($("projectInsightsFrom") && (run.date_from || normalized.summary?.dateFrom)) $("projectInsightsFrom").value = run.date_from || normalized.summary.dateFrom;
  if ($("projectInsightsTo") && (run.date_to || normalized.summary?.dateTo)) $("projectInsightsTo").value = run.date_to || normalized.summary.dateTo;
  if ($("projectInsightsLimit") && run.source_limit) $("projectInsightsLimit").value = String(run.source_limit);
  state.lastWorkflow = normalized.workflowLog || null;
  state.currentWorkflowMessageId = normalized.runId || null;
  if (state.lastWorkflow) renderWorkflow(state.lastWorkflow);
  renderProjectInsightsStatus();
  renderProjectInsightsResults();
  renderProjectInsightHistory();
  showToast("דוח תובנות נטען מההיסטוריה");
}

function normalizeProjectInsightRun(run = {}) {
  const summary = run.summary && typeof run.summary === "object" ? run.summary : {};
  const metadata = run.metadata && typeof run.metadata === "object" ? run.metadata : {};
  const normalizedEnvelope = { ...run, metadata };
  const findings = normalizeProjectFindings(normalizedEnvelope, { legacyInsightsAsFindings: true });
  const insights = normalizeProjectInsights(normalizedEnvelope);
  return {
    ok: run.status !== "error",
    error: run.error || "",
    runId: run.run_id || run.runId || "",
    summary: {
      ...summary,
      focusQuery: summary.focusQuery || run.focus_query || "",
      dateFrom: summary.dateFrom || run.date_from || null,
      dateTo: summary.dateTo || run.date_to || null
    },
    findings,
    insights,
    toolContext: run.tool_context || run.toolContext || {},
    workflowLog: run.workflow_log || run.workflowLog || null,
    recordsSample: Array.isArray(metadata.recordsSample) ? metadata.recordsSample : [],
    scannedSourceKeys: Array.isArray(run.scanned_source_keys) ? run.scanned_source_keys : [],
    hasMore: Boolean(metadata.hasMore),
    // Phase-2 engine outputs persisted in metadata (older runs simply lack them).
    healthScore: metadata.healthScore || null,
    analytics: metadata.trends ? { trends: metadata.trends } : (run.analytics || null),
    rootCauseHypotheses: Array.isArray(metadata.rootCauseHypotheses) ? metadata.rootCauseHypotheses : []
  };
}

const INSIGHTS_STEP_LABELS = {
  created: "פותח ריצה חדשה...",
  alerts_priming: "לומד מההתראות ומכוון את החיפוש...",
  index_scan: "סורק את נתוני האינדקס...",
  hashtag_analysis: "מנתח האשטגים...",
  focus_retrieval: "מאחזר מקורות ממוקדים...",
  focus_retrieval_warning: "חיפוש ממוקד נכשל, ממשיך עם סריקת אינדקס...",
  evidence_normalization: "מנרמל ראיות ומסווג אמירות...",
  deduplication: "מאחד כפילויות לאירועים קנוניים...",
  clustering_timeline: "בונה אשכולות וצירי זמן...",
  analytics_engine: "מחשב מדדים דטרמיניסטיים...",
  pattern_detection: "מזהה דפוסי תובנה...",
  closure_followup: "מחפש ראיות סגירה מאוחרות...",
  trend_analysis: "משווה מול התקופה הקודמת...",
  root_cause_hypotheses: "בוחן השערות סיבת שורש...",
  health_score: "מחשב ציון בריאות...",
  graph_search: "בודק גרף קשרים...",
  alert_agent: "בודק מול סוכן התראות...",
  n8n_tools: "בודק מול סוכני הפרויקט...",
  source_quality: "בודק אמינות מקורות...",
  conflict_detection: "מזהה סתירות בין מקורות...",
  signal_detection: "מזהה ממצאים...",
  ai_synthesis: "מסנתז תובנות עם AI...",
  ai_synthesis_warning: "סינתזת AI נכשלה, עובר לניתוח דטרמיניסטי...",
  insight_critic: "מבקר ומסנן תובנות...",
  insight_ranking: "מדרג ומסדר תובנות..."
};

function insightsStepLabel(item) {
  const step = String(item?.step || "");
  if (step === "complete" || step === "error" || step === "client" || step === "persistence_warning") return "";
  return INSIGHTS_STEP_LABELS[step] || "";
}

function renderProjectInsightsLiveSteps() {
  const el = $("projectInsightsStatus");
  if (!el) return;
  const steps = state.insightsLiveSteps || [];
  if (!steps.length) return;
  el.dataset.state = "running";
  el.innerHTML = `
    <div class="insightsLiveSteps">
      ${steps.map((label, i) => {
        const isLast = i === steps.length - 1;
        return `<div class="insightsLiveStep ${isLast ? "active" : "done"}">
          <span class="insightsLiveStepIcon">${isLast ? '<span class="progressSpinner" aria-hidden="true"></span>' : "✓"}</span>
          <span>${escapeHtml(label)}</span>
        </div>`;
      }).join("")}
    </div>
  `;
}

function pushInsightsLiveStep(item) {
  const label = insightsStepLabel(item);
  if (!label) return;
  if (!Array.isArray(state.insightsLiveSteps)) state.insightsLiveSteps = [];
  if (state.insightsLiveSteps[state.insightsLiveSteps.length - 1] === label) return;
  state.insightsLiveSteps.push(label);
  renderProjectInsightsLiveSteps();
}

function startInsightsLiveRun(runId) {
  stopInsightsLiveRun();
  state.insightsLiveSteps = [];
  try {
    state.insightsEventSource = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
  } catch {
    state.insightsEventSource = null;
    return;
  }
  state.insightsEventSource.addEventListener("log", (event) => {
    let item;
    try { item = JSON.parse(event.data); } catch { return; }
    if (item.step === "complete" || item.step === "error") { stopInsightsLiveRun(); return; }
    pushInsightsLiveStep(item);
  });
  state.insightsEventSource.onerror = () => {};
}

function stopInsightsLiveRun() {
  if (state.insightsEventSource) {
    state.insightsEventSource.close();
    state.insightsEventSource = null;
  }
}

function renderProjectInsightsStatus(override = "") {
  const el = $("projectInsightsStatus");
  if (!el) return;
  const expandButton = $("expandProjectInsightsAnalysis");
  if (override) {
    el.textContent = override;
    el.dataset.state = "running";
    if (expandButton) expandButton.disabled = true;
    return;
  }
  const result = state.lastProjectInsights;
  if (!result) {
    el.innerHTML = "לחץ <strong>נתח את הפרויקט</strong> להרצת סוכן התובנות · <kbd style=\"display:inline-flex;align-items:center;height:16px;padding:0 4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;font-size:10px;font-family:monospace;color:var(--i-text-sub)\">Ctrl+Enter</kbd>";
    el.dataset.state = "idle";
    if (expandButton) expandButton.disabled = true;
    return;
  }
  if (result.ok === false) {
    el.textContent = `שגיאה: ${result.error || "ניתוח התובנות נכשל"}`;
    el.dataset.state = "error";
    if (expandButton) expandButton.disabled = true;
    return;
  }
  const summary = result.summary || {};
  const sourceCount = Object.keys(summary.sourceCounts || {}).length;
  const scannedCount = state.projectInsightsScannedKeys.length || (result.scannedSourceKeys || []).length || Number(summary.totalRecords || 0);
  const runCount = state.projectInsightsRuns || summary.expandedRuns || 1;
  const findingsCount = normalizeProjectFindings(result, { legacyInsightsAsFindings: true }).length;
  const insightsCount = normalizeProjectInsights(result).length;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <strong>נותחו ${Number(summary.totalRecords || 0).toLocaleString()} מקורות</strong>
        <span class="insightStatusPill">${insightsCount} תובנות</span>
        <span class="insightStatusPill">${findingsCount} ממצאים</span>
        <span class="insightStatusPill">${sourceCount} סוגי מקור</span>
        <span class="insightStatusPill">${runCount} ריצות</span>
        ${result.runId ? `<button type="button" class="delayWorkflowLink" data-tab-target="workflow" style="font-size:11px;padding:2px 8px;height:20px;border-radius:999px;background:var(--i-blue-soft);border:1px solid rgba(56,139,253,0.3);color:var(--i-blue);cursor:pointer;font-weight:600">פתח Workflow</button>` : ""}
      </div>
      <span style="font-size:11px;color:var(--i-text-muted)">${summary.dateFrom || ""} – ${summary.dateTo || ""}${result.expansionError ? ` · שגיאת הרחבה: ${escapeHtml(result.expansionError)}` : ""}</span>
    </div>
  `;
  el.dataset.state = "done";
  if (expandButton) expandButton.disabled = state.projectInsightsRunning || !scannedCount;
  el.querySelector(".delayWorkflowLink")?.addEventListener("click", () => activateTab("workflow"));
}

function renderProjectInsightsResults() {
  const container = $("projectInsightsResults");
  if (!container) return;
  const result = state.lastProjectInsights;
  if (!result) {
    container.innerHTML = `
      <div class="insightsWelcome">
        <div class="insightsWelcomeIcon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </div>
        <h4>הרץ ניתוח AI על נתוני הפרויקט</h4>
        <p>סוכן התובנות סורק את האינדקס, מזהה דפוסים, חסמים, החלטות פתוחות וסיכונים — ומציג אותם כתובנות עם ראיות מהמקור.</p>
        <button type="button" onclick="document.querySelector('#runProjectInsightsAnalysis')?.click()">נתח את הפרויקט</button>
        <span class="insightsKbHint">או לחץ <kbd>Ctrl</kbd>+<kbd>Enter</kbd> בשדה המיקוד</span>
      </div>`;
    return;
  }
  if (result.ok === false) {
    container.innerHTML = "";
    return;
  }
  const findings = normalizeProjectFindings(result, { legacyInsightsAsFindings: true });
  const insights = normalizeProjectInsights(result);
  const enginePanels = renderInsightEnginePanels(result);
  if (!insights.length && !findings.length && !enginePanels) {
    container.innerHTML = '<div class="projectInsightEmpty">לא נמצאו אותות מספיק חזקים באינדקס עבור הסריקה הזו. אפשר ללחוץ על הרחב תשובה כדי לסרוק מקורות נוספים.</div>';
    return;
  }
  container.innerHTML = enginePanels + renderProjectInsightsEnvelope({ insights, findings });
}

// Panels for the phase-2 engines: health score, trend analysis, root-cause
// hypotheses. Rendered only when the run actually produced them.
function renderInsightEnginePanels(result = {}) {
  const panels = [
    renderHealthScorePanel(result.healthScore),
    renderTrendPanel(result.analytics?.trends),
    renderHypothesesPanel(result.rootCauseHypotheses)
  ].filter(Boolean);
  return panels.length ? `<section class="insightEnginePanels">${panels.join("")}</section>` : "";
}

function renderHealthScorePanel(healthScore) {
  if (!healthScore) return "";
  const dimensionLabels = {
    schedule: "לוח זמנים",
    coordination: "תיאום",
    decision_velocity: "מהירות החלטות",
    information_readiness: "מוכנות מידע"
  };
  const statusLabels = {
    calculated: "מחושב",
    provisional: "חלקי (כיסוי נתונים לא מלא)",
    not_computed: "לא חושב — אין מספיק נתונים"
  };
  const subscores = Object.entries(healthScore.subscores || {}).map(([key, dim]) => {
    const label = dimensionLabels[key] || key;
    if (dim.score == null) {
      return `<div class="healthSubscore" data-missing="true"><span>${escapeHtml(label)}</span><small>אין מספיק נתונים</small></div>`;
    }
    return `<div class="healthSubscore"><span>${escapeHtml(label)}</span><div class="healthSubscoreBar"><i style="width:${Math.max(2, dim.score)}%"></i></div><b>${dim.score}</b></div>`;
  }).join("");
  const flags = (healthScore.critical_flags || []).map((flag) => {
    const flagLabels = {
      commitment_overdue_30d: "התחייבות באיחור של 30+ יום",
      safety_contradiction: "מידע סותר בנושא בטיחות",
      open_safety_issue: "נושא בטיחות פתוח"
    };
    const parts = [flagLabels[flag.flag] || flag.flag, flag.topic].filter(Boolean);
    return `<span class="healthCriticalFlag">${escapeHtml(parts.join(" · "))}</span>`;
  }).join("");
  return `
    <article class="enginePanel healthScorePanel" data-status="${escapeHtml(healthScore.status || "")}">
      <header>
        <div>
          <span>ציון בריאות הפרויקט <small>${escapeHtml(healthScore.score_version || "")}</small></span>
          <h4>${healthScore.score != null ? healthScore.score : "—"}</h4>
        </div>
        <div class="healthScoreMeta">
          <b>${escapeHtml(statusLabels[healthScore.status] || healthScore.status || "")}</b>
          ${healthScore.data_coverage != null ? `<small>כיסוי נתונים: ${Math.round(healthScore.data_coverage * 100)}%</small>` : ""}
          ${healthScore.critical_cap_applied ? '<small class="healthCapNote">הציון הוגבל בגלל אירוע קריטי</small>' : ""}
        </div>
      </header>
      ${subscores ? `<div class="healthSubscores">${subscores}</div>` : ""}
      ${flags ? `<div class="healthCriticalFlags">${flags}</div>` : ""}
      <p class="enginePanelHint">הציון הוא כלי סיכום מחושב — הוא אינו ראיה ואינו מחליף את התובנות עצמן.</p>
    </article>`;
}

function renderTrendPanel(trends) {
  if (!trends || !Array.isArray(trends.metrics) || !trends.metrics.length) return "";
  const isCrossWindow = trends.baseline_definition === "previous_window";
  if (!isCrossWindow && trends.status !== "calculated") return "";
  const metricLabels = {
    open_statements: "אמירות פתוחות",
    closure_statements: "דיווחי סגירה",
    new_topics: "נושאים חדשים",
    evidence_volume: "נפח ראיות"
  };
  const assessmentMeta = {
    deteriorating: { label: "החמרה", tone: "bad" },
    improving: { label: "שיפור", tone: "good" },
    stable: { label: "יציב", tone: "neutral" },
    unknown: { label: "לא חד-משמעי", tone: "neutral" }
  };
  const rows = trends.metrics.map((metric) => {
    const meta = assessmentMeta[metric.assessment] || assessmentMeta.unknown;
    const arrow = metric.direction === "up" ? "▲" : metric.direction === "down" ? "▼" : "—";
    return `
      <div class="trendRow" data-tone="${meta.tone}">
        <span>${escapeHtml(metricLabels[metric.metric_id] || metric.metric_id)}</span>
        <small>${metric.baseline_period?.value ?? "—"} ← ${metric.current_period?.value ?? "—"}</small>
        <b>${arrow} ${escapeHtml(meta.label)}</b>
        ${metric.sample_status !== "valid" ? `<small class="trendSampleNote">${escapeHtml(metric.sample_status === "coverage_mismatch" ? "פער כיסוי נתונים" : "מדגם קטן")}</small>` : ""}
      </div>`;
  }).join("");
  const baselineText = isCrossWindow
    ? `מול התקופה הקודמת (${escapeHtml(trends.metrics[0]?.baseline_period?.from || "")} – ${escapeHtml(trends.metrics[0]?.baseline_period?.to || "")})`
    : "בתוך חלון הניתוח (מחצית ראשונה מול שנייה)";
  return `
    <article class="enginePanel trendPanel" data-status="${escapeHtml(trends.status || "")}">
      <header>
        <div>
          <span>מגמות <small>${escapeHtml(trends.trend_version || "")}</small></span>
          <h4>${escapeHtml(baselineText)}</h4>
        </div>
        ${trends.status !== "calculated" ? `<b class="trendStatusNote">${escapeHtml(trends.status === "coverage_mismatch" ? "השוואה לא תקפה — פער כיסוי" : "מדגם לא מספיק")}</b>` : ""}
      </header>
      <div class="trendRows">${rows}</div>
    </article>`;
}

function renderHypothesesPanel(hypotheses) {
  if (!Array.isArray(hypotheses) || !hypotheses.length) return "";
  const confidenceLabels = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };
  const cards = hypotheses.map((item) => `
    <div class="hypothesisCard">
      <header>
        <span class="hypothesisBadge">השערה — דורש אימות</span>
        <small>ודאות: ${escapeHtml(confidenceLabels[item.confidence] || item.confidence || "")}</small>
      </header>
      <p>${escapeHtml(item.hypothesis || "")}</p>
      ${Array.isArray(item.missing_evidence) && item.missing_evidence.length ? `
        <div class="hypothesisMissing"><b>מה חסר כדי לאשר או להפריך:</b><ul>${item.missing_evidence.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul></div>` : ""}
      ${Array.isArray(item.alternative_hypotheses) && item.alternative_hypotheses.length ? `
        <div class="hypothesisAlternatives"><b>הסברים חלופיים:</b> ${escapeHtml(item.alternative_hypotheses.join(" · "))}</div>` : ""}
    </div>`).join("");
  return `
    <article class="enginePanel hypothesesPanel">
      <header>
        <div>
          <span>השערות סיבת שורש</span>
          <h4>${hypotheses.length} השערות — כולן דורשות אימות</h4>
        </div>
      </header>
      <div class="hypothesisCards">${cards}</div>
      <p class="enginePanelHint">השערות הן הסקה בלבד ואינן קביעת סיבה. סדר כרונולוגי אינו הוכחה לסיבתיות.</p>
    </article>`;
}

function renderProjectInsightsEnvelope({ insights = [], findings = [] } = {}) {
  const findingsById = new Map(findings.map((finding) => [String(finding.id || ""), finding]));
  const linkedFindingIds = new Set();
  for (const insight of insights) {
    for (const id of insight.supporting_finding_ids || []) linkedFindingIds.add(String(id));
  }
  const orphanFindings = findings.filter((finding) => !linkedFindingIds.has(String(finding.id || "")));
  const insightHtml = insights.length
    ? `<div class="projectInsightsResultsGrid">${insights.map((insight) => renderProjectInsightCardWithFindings(insight, findingsById)).join("")}</div>`
    : '<div class="projectInsightEmpty">נמצאו ממצאים, אבל אין עדיין מספיק חיבור ביניהם כדי לקרוא לזה תובנה. אפשר להרחיב תשובה כדי להכניס מקורות נוספים לסינתזה.</div>';
  const orphanHtml = orphanFindings.length
    ? `<section class="projectFindingsSection">
        <div class="projectInsightsSectionHeader">
          <h3>ממצאים שלא הפכו לתובנה</h3>
          <span>${orphanFindings.length} ממצאים</span>
        </div>
        <div class="projectFindingsList">${orphanFindings.map((finding) => renderProjectFindingCard(finding)).join("")}</div>
      </section>`
    : "";
  return `
    <section class="projectInsightsSynthesized">
      <div class="projectInsightsSectionHeader">
        <h3>תובנות AI</h3>
        <span>${insights.length} תובנות מסונתזות</span>
      </div>
      ${insightHtml}
    </section>
    ${orphanHtml}
  `;
}

function renderProjectInsightCardWithFindings(insight, findingsById = new Map()) {
  const evidence = Array.isArray(insight.evidence) ? insight.evidence.slice(0, 4) : [];
  const supportingFindings = (insight.supporting_finding_ids || [])
    .map((id) => findingsById.get(String(id)))
    .filter(Boolean);
  return `
    <article class="projectInsightCard" data-severity="${escapeHtml(insight.severity || "medium")}">
      <header>
        <div>
          <span>תובנה · ${escapeHtml(projectInsightCategoryLabel(insight.category))}</span>
          <h4>${escapeHtml(insight.title || "תובנה")}</h4>
        </div>
        <strong>${formatConfidence(insight.confidence)}</strong>
      </header>
      <p>${escapeHtml(insight.insight || insight.finding || "")}</p>
      ${insight.why_it_matters ? `<div class="projectInsightWhy"><b>למה זה חשוב</b><span>${escapeHtml(insight.why_it_matters)}</span></div>` : ""}
      ${insight.recommended_action ? `<div class="projectInsightAction"><b>פעולה מומלצת</b><span>${escapeHtml(insight.recommended_action)}</span></div>` : ""}
      ${insight.uncertainty ? `<div class="projectInsightUncertainty"><b>אי ודאות</b><span>${escapeHtml(insight.uncertainty)}</span></div>` : ""}
      ${supportingFindings.length ? `
        <div class="projectInsightSupport">
          <b>ממצאים שתומכים בתובנה</b>
          ${supportingFindings.map((finding) => renderProjectFindingCard(finding, { compact: true })).join("")}
        </div>
      ` : ""}
      <label class="projectInsightStatusControl">סטטוס
        <select>
          <option value="new" ${(insight.human_status || "new") === "new" ? "selected" : ""}>חדש</option>
          <option value="reviewing" ${insight.human_status === "reviewing" ? "selected" : ""}>בבדיקה</option>
          <option value="accepted" ${insight.human_status === "accepted" ? "selected" : ""}>אושר</option>
          <option value="dismissed" ${insight.human_status === "dismissed" ? "selected" : ""}>נדחה</option>
        </select>
      </label>
      ${evidence.length ? `
        <button type="button" class="insightEvidenceToggle" aria-expanded="false" aria-controls="evidence_${Math.random().toString(36).slice(2)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          ${evidence.length} מקורות ראיה
        </button>
        <div class="projectInsightEvidence" data-collapsed="true">
          ${evidence.map((item) => `
            <div>
              <b>${escapeHtml(item.title || item.source_id || "מקור")}</b>
              <small>${escapeHtml([item.source_table, item.date ? String(item.date).slice(0, 10) : ""].filter(Boolean).join(" · "))}</small>
              <span>${escapeHtml(item.excerpt || "")}</span>
              ${item.source_url ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">פתח מקור</a>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderProjectFindingCard(finding, { compact = false } = {}) {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence.slice(0, compact ? 2 : 4) : [];
  return `
    <article class="projectFindingCard" data-severity="${escapeHtml(finding.severity || "medium")}" data-compact="${compact ? "true" : "false"}">
      <header>
        <div>
          <span>ממצא · ${escapeHtml(projectInsightCategoryLabel(finding.category))}</span>
          <h4>${escapeHtml(finding.title || "ממצא")}</h4>
        </div>
        <strong>${formatConfidence(finding.confidence)}</strong>
      </header>
      <p>${escapeHtml(finding.statement || finding.finding || "")}</p>
      ${!compact && finding.recommended_action ? `<div class="projectInsightAction"><b>פעולה מומלצת</b><span>${escapeHtml(finding.recommended_action)}</span></div>` : ""}
      ${evidence.length ? `
        <div class="projectInsightEvidence">
          ${evidence.map((item) => `
            <div>
              <b>${escapeHtml(item.title || item.source_id || "מקור")}</b>
              <small>${escapeHtml([item.source_table, item.date ? String(item.date).slice(0, 10) : ""].filter(Boolean).join(" · "))}</small>
              <span>${escapeHtml(item.excerpt || "")}</span>
              ${item.source_url ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">פתח מקור</a>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderProjectInsightCard(insight) {
  const evidence = Array.isArray(insight.evidence) ? insight.evidence.slice(0, 4) : [];
  return `
    <article class="projectInsightCard" data-severity="${escapeHtml(insight.severity || "medium")}">
      <header>
        <div>
          <span>${escapeHtml(projectInsightCategoryLabel(insight.category))}</span>
          <h4>${escapeHtml(insight.title || "תובנה")}</h4>
        </div>
        <strong>${formatConfidence(insight.confidence)}</strong>
      </header>
      <p>${escapeHtml(insight.finding || "")}</p>
      ${insight.why_it_matters ? `<div class="projectInsightWhy"><b>למה זה חשוב</b><span>${escapeHtml(insight.why_it_matters)}</span></div>` : ""}
      ${insight.recommended_action ? `<div class="projectInsightAction"><b>פעולה מומלצת</b><span>${escapeHtml(insight.recommended_action)}</span></div>` : ""}
      <label class="projectInsightStatusControl">סטטוס
        <select>
          <option value="new" ${(insight.human_status || "new") === "new" ? "selected" : ""}>חדש</option>
          <option value="reviewing" ${insight.human_status === "reviewing" ? "selected" : ""}>בבדיקה</option>
          <option value="accepted" ${insight.human_status === "accepted" ? "selected" : ""}>אושר</option>
          <option value="dismissed" ${insight.human_status === "dismissed" ? "selected" : ""}>נדחה</option>
        </select>
      </label>
      <div class="projectInsightEvidence">
        ${evidence.map((item) => `
          <div>
            <b>${escapeHtml(item.title || item.source_id || "מקור")}</b>
            <small>${escapeHtml([item.source_table, item.date ? String(item.date).slice(0, 10) : ""].filter(Boolean).join(" · "))}</small>
            <span>${escapeHtml(item.excerpt || "")}</span>
            ${item.source_url ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">פתח מקור</a>` : ""}
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function projectInsightCategoryLabel(category) {
  const labels = {
    risk: "סיכון",
    blocker: "חסם",
    decision: "החלטות",
    gap: "חוסרים",
    missing_info: "מידע חסר",
    repeated_topic: "נושא חוזר",
    commercial: "מסחרי",
    quality: "איכות",
    quality_safety: "איכות ובטיחות",
    entity: "גורם מרכזי"
  };
  return labels[category] || "תובנה";
}

async function loadDelayClaims() {
  if (!$("delayClaimsList")) return;
  $("delayClaimsList").innerHTML = '<div class="delayClaimEmpty">טוען תיקי עיכוב...</div>';
  try {
    const result = await api("/api/delay-claims");
    state.delayClaims = result.claims || [];
    if (!state.selectedDelayClaimId && state.delayClaims.length) state.selectedDelayClaimId = state.delayClaims[0].id;
    renderDelayClaims();
    if (state.selectedDelayClaimId) await loadDelayEvents(state.selectedDelayClaimId);
    else renderDelayClaimContent();
  } catch (error) {
    $("delayClaimsList").innerHTML = `<div class="delayClaimEmpty">שגיאה בטעינת תיקים: ${escapeHtml(error.message)}</div>`;
    renderDelayClaimContent();
  }
}

async function createDelayClaimFromForm(event) {
  event.preventDefault();
  const title = $("delayClaimTitle")?.value?.trim();
  if (!title) return;
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api("/api/delay-claims", {
      method: "POST",
      body: {
        title,
        project_id: $("delayClaimProjectId")?.value || null,
        description: $("delayClaimDescription")?.value || null,
        human_status: "candidate",
        confidence: 0
      }
    });
    event.currentTarget.reset();
    state.selectedDelayClaimId = result.claim?.id || null;
    showToast("תיק עיכוב נוצר");
    await loadDelayClaims();
  } catch (error) {
    showToast(`יצירת תיק נכשלה: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadDelayEvents(caseId) {
  if (!caseId) return;
  $("delayEventsList").innerHTML = '<div class="delayClaimEmpty">טוען אירועים...</div>';
  try {
    const result = await api(`/api/delay-claims/${encodeURIComponent(caseId)}/events`);
    state.delayEvents = result.events || [];
    if (!state.delayEvents.some((item) => item.id === state.selectedDelayEventId)) {
      state.selectedDelayEventId = state.delayEvents[0]?.id || null;
    }
    renderDelayClaimContent();
  } catch (error) {
    $("delayEventsList").innerHTML = `<div class="delayClaimEmpty">שגיאה בטעינת אירועים: ${escapeHtml(error.message)}</div>`;
  }
}

async function createDelayEventFromForm(event) {
  event.preventDefault();
  const caseId = state.selectedDelayClaimId;
  const title = $("delayEventTitle")?.value?.trim();
  if (!caseId || !title) return;
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api(`/api/delay-claims/${encodeURIComponent(caseId)}/events`, {
      method: "POST",
      body: {
        title,
        start_date: $("delayEventStart")?.value || null,
        end_date: $("delayEventEnd")?.value || null,
        event_type: $("delayEventType")?.value || null,
        confidence: Number($("delayEventConfidence")?.value || 0),
        contractor_claim: $("delayEventClaim")?.value || null,
        short_description: $("delayEventDescription")?.value || null,
        human_status: "candidate"
      }
    });
    event.currentTarget.reset();
    if ($("delayEventConfidence")) $("delayEventConfidence").value = "0";
    state.selectedDelayEventId = result.event?.id || null;
    showToast("אירוע עיכוב נוסף");
    await loadDelayEvents(caseId);
  } catch (error) {
    showToast(`יצירת אירוע נכשלה: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

function renderDelayClaims() {
  const list = $("delayClaimsList");
  if (!list) return;
  if (!state.delayClaims.length) {
    list.innerHTML = '<div class="delayClaimEmpty">אין תיקי עיכוב עדיין.</div>';
    return;
  }
  list.innerHTML = "";
  for (const claim of state.delayClaims) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `delayClaimItem ${claim.id === state.selectedDelayClaimId ? "active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(claim.title || "תיק ללא שם")}</strong>
      <span>${escapeHtml(claim.project_id || claim.case_key || "")}</span>
      <small>${delayStatusLabel(claim.human_status)} · ${formatConfidence(claim.confidence)}</small>
    `;
    button.addEventListener("click", async () => {
      state.selectedDelayClaimId = claim.id;
      state.selectedDelayEventId = null;
      renderDelayClaims();
      await loadDelayEvents(claim.id);
    });
    list.append(button);
  }
}

function renderDelayClaimContent() {
  const claim = selectedDelayClaim();
  $("delayClaimEmpty").hidden = Boolean(claim);
  $("delayClaimContent").hidden = !claim;
  if (!claim) return;
  $("delayClaimActiveTitle").textContent = claim.title || "";
  $("delayClaimActiveMeta").textContent = [claim.project_id, claim.description].filter(Boolean).join(" · ");
  $("delayClaimActiveStatus").textContent = delayStatusLabel(claim.human_status);
  $("delayClaimActiveStatus").dataset.status = claim.human_status || "candidate";
  renderDelayAnalyzeStatus();
  renderDelayPackageStatus();
  renderDelayEvents();
  renderDelayEventInspector();
}

async function runDelayClaimAnalysisFromUi() {
  const claim = selectedDelayClaim();
  if (!claim || state.delayAnalyzeRunning) return;
  const button = $("runDelayClaimAnalysis");
  state.delayAnalyzeRunning = true;
  state.lastDelayAnalysis = null;
  renderDelayAnalyzeStatus("מריץ ניתוח תיק...");
  if (button) {
    button.disabled = true;
    button.textContent = "מנתח...";
  }
  try {
    const result = await api(`/api/delay-claims/${encodeURIComponent(claim.id)}/analyze`, {
      method: "POST",
      timeoutMs: 120_000,
      body: {
        projectId: claim.project_id || null,
        focusQuery: $("delayAnalyzeQuery")?.value || "",
        dateFrom: $("delayAnalyzeFrom")?.value || null,
        dateTo: $("delayAnalyzeTo")?.value || null,
        sources: ["hybrid", "timeline", "graph"]
      }
    });
    state.lastDelayAnalysis = result;
    state.selectedDelayEventId = result.saved?.eventIds?.[0] || state.selectedDelayEventId;
    showToast("ניתוח תיק הסתיים");
    await loadDelayEvents(claim.id);
    renderDelayAnalyzeStatus();
  } catch (error) {
    state.lastDelayAnalysis = { ok: false, error: error.message };
    renderDelayAnalyzeStatus();
    showToast(`ניתוח תיק נכשל: ${error.message}`, "error");
  } finally {
    state.delayAnalyzeRunning = false;
    if (button) {
      button.disabled = false;
      button.textContent = "נתח תיק";
    }
  }
}

function renderDelayAnalyzeStatus(override = "") {
  const el = $("delayAnalyzeStatus");
  if (!el) return;
  if (override) {
    el.textContent = override;
    el.dataset.state = "running";
    return;
  }
  const result = state.lastDelayAnalysis;
  if (!result) {
    el.textContent = "טרם הורץ ניתוח.";
    el.dataset.state = "idle";
    return;
  }
  if (result.ok === false) {
    el.textContent = `שגיאה: ${result.error || "ניתוח נכשל"}`;
    el.dataset.state = "error";
    return;
  }
  const saved = result.saved || {};
  el.innerHTML = `
    <strong>ניתוח הסתיים</strong>
    <span>${saved.events || 0} אירועים · ${saved.evidence || 0} ראיות · ${saved.gaps || 0} חוסרים</span>
    ${result.runId ? `<button type="button" class="delayWorkflowLink" data-tab-target="workflow">פתח Workflow</button>` : ""}
  `;
  el.dataset.state = "done";
  el.querySelector(".delayWorkflowLink")?.addEventListener("click", () => activateTab("workflow"));
}

async function runDelayClaimPackageFromUi() {
  const claim = selectedDelayClaim();
  if (!claim || state.delayPackageRunning) return;
  const button = $("runDelayClaimPackage");
  state.delayPackageRunning = true;
  state.lastDelayPackage = null;
  renderDelayPackageStatus("מכין חבילת תיק...");
  if (button) {
    button.disabled = true;
    button.textContent = "מכין...";
  }
  try {
    const result = await api(`/api/delay-claims/${encodeURIComponent(claim.id)}/package`, {
      method: "POST",
      timeoutMs: 120_000,
      body: {
        contractualCompletionDate: $("delayContractualCompletion")?.value || null,
        actualCompletionDate: $("delayActualCompletion")?.value || null,
        exportType: $("delayPackageExportType")?.value || "markdown"
      }
    });
    state.lastDelayPackage = result;
    showToast("חבילת תיק הופקה");
    renderDelayPackageStatus();
  } catch (error) {
    state.lastDelayPackage = { ok: false, error: error.message };
    renderDelayPackageStatus();
    showToast(`הפקת חבילת תיק נכשלה: ${error.message}`, "error");
  } finally {
    state.delayPackageRunning = false;
    if (button) {
      button.disabled = false;
      button.textContent = "הכן חבילת תיק";
    }
  }
}

function renderDelayPackageStatus(override = "") {
  const status = $("delayPackageStatus");
  const dashboard = $("delayPackageDashboard");
  if (!status) return;
  if (override) {
    status.textContent = override;
    status.dataset.state = "running";
    if (dashboard) dashboard.innerHTML = "";
    return;
  }
  const result = state.lastDelayPackage;
  if (!result) {
    status.textContent = "טרם הופקה חבילת תיק.";
    status.dataset.state = "idle";
    if (dashboard) dashboard.innerHTML = "";
    return;
  }
  if (result.ok === false) {
    status.textContent = result.error || "הפקת חבילת תיק נכשלה.";
    status.dataset.state = "error";
    if (dashboard) dashboard.innerHTML = "";
    return;
  }
  const data = result.dashboard || {};
  status.innerHTML = `
    <strong>חבילת תיק הופקה</strong>
    <span>${result.export?.export_type || "markdown"} · ${result.saved?.scheduleActivities || 0} פעילויות · ${result.saved?.costItems || 0} עלויות · ${data.total_delay_days ?? "ללא"} ימי איחור</span>
    ${result.runId ? `<button type="button" class="delayWorkflowLink" data-tab-target="workflow">פתח Workflow</button>` : ""}
  `;
  status.dataset.state = "done";
  status.querySelector(".delayWorkflowLink")?.addEventListener("click", () => activateTab("workflow"));
  if (dashboard) dashboard.innerHTML = renderDelayPackageDashboard(data);
}

function renderDelayPackageDashboard(data = {}) {
  const actions = Array.isArray(data.recommended_actions) ? data.recommended_actions : [];
  return `
    <div class="delayPackageStats">
      <div><span>אירועים</span><strong>${Number(data.total_events || 0)}</strong></div>
      <div><span>חזקים</span><strong>${Number(data.strong_events || 0)}</strong></div>
      <div><span>חלשים</span><strong>${Number(data.weak_events || 0)}</strong></div>
      <div><span>דורשים בדיקה</span><strong>${Number(data.needs_review_events || 0)}</strong></div>
      <div><span>מסמכים חסרים</span><strong>${Number(data.missing_documents || 0)}</strong></div>
      <div><span>מוכנות כללית</span><strong>${Math.round(Number(data.readiness_score || 0) * 100)}%</strong></div>
    </div>
    <div class="delayPackageActions">
      <strong>פעולות מומלצות</strong>
      ${actions.length ? `<ul>${actions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>אין פעולות מומלצות נוספות.</p>"}
    </div>
  `;
}

function renderDelayEvents() {
  const list = $("delayEventsList");
  if (!list) return;
  $("delayEventsCount").textContent = `${state.delayEvents.length} אירועים`;
  if (!state.delayEvents.length) {
    list.innerHTML = '<div class="delayClaimEmpty">אין אירועים בתיק הזה.</div>';
    return;
  }
  list.innerHTML = "";
  for (const item of state.delayEvents) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `delayEventItem ${item.id === state.selectedDelayEventId ? "active" : ""}`;
    button.innerHTML = `
      <span class="delayStatusBadge" data-status="${escapeHtml(item.human_status || "candidate")}">${delayStatusLabel(item.human_status)}</span>
      <strong>${escapeHtml(item.title || "אירוע ללא שם")}</strong>
      <span>${escapeHtml(delayEventDateRange(item))}</span>
      <small>${formatConfidence(item.confidence)} · ${(item.evidence || []).length} ראיות · ${(item.gaps || []).length} חוסרים</small>
    `;
    button.addEventListener("click", () => {
      state.selectedDelayEventId = item.id;
      renderDelayEvents();
      renderDelayEventInspector();
    });
    list.append(button);
  }
}

function renderDelayEventInspector() {
  const panel = $("delayEventInspector");
  const item = selectedDelayEvent();
  if (!panel) return;
  if (!item) {
    panel.innerHTML = '<div class="workflowInspectorEmpty">בחר אירוע כדי לראות פרטים, ראיות וסטטוס.</div>';
    return;
  }
  const findings = item.findings || [];
  const findingMap = new Map(findings.map((finding) => [finding.metadata?.analysis_key, finding]));
  const readiness = Number(item.readiness_score ?? findingMap.get("readiness_score")?.metadata?.readiness_score ?? 0);
  const attackRisk = item.metadata?.stage3_analysis?.attack_risk || findingMap.get("counter_arguments")?.metadata?.attack_risk || "not_analyzed";
  const professionalReview = item.metadata?.stage3_analysis?.professional_review_required ?? findingMap.get("quality")?.metadata?.professional_review_required;
  const findingTabs = [
    ["causality_chain", "שרשרת סיבתיות"],
    ["notice_status", "הודעות"],
    ["concurrent_delays", "עיכובים מקבילים"],
    ["counter_arguments", "טענות נגד"],
    ["quality", "חוסרים"]
  ].map(([key, label]) => renderDelayFindingTab(label, findingMap.get(key))).join("");
  const evidenceRows = (item.evidence || []).map((evidence) => `
    <div class="delayEvidenceRow">
      <strong>${escapeHtml(evidence.supports_or_weakens === "weakens" ? "מחליש" : evidence.supports_or_weakens === "neutral" ? "ניטרלי" : "מחזק")}</strong>
      <p>${escapeHtml(evidence.quote || evidence.excerpt || evidence.what_it_supports || "ראיה ללא טקסט")}</p>
      <small>${escapeHtml(evidence.source_type || "")} ${formatConfidence(evidence.confidence)}</small>
    </div>
  `).join("");
  panel.innerHTML = `
    <header class="workflowInspectorHeader">
      <span class="workflowIcon database">Delay</span>
      <div>
        <strong>${escapeHtml(item.title || "")}</strong>
        <small>${escapeHtml(item.event_key || item.id)}</small>
      </div>
    </header>
    <div class="delayInspectorBody">
      <div class="delayInspectorMeta">
        <span class="delayStatusBadge" data-status="${escapeHtml(item.human_status || "candidate")}">${delayStatusLabel(item.human_status)}</span>
        <span>${formatConfidence(item.confidence)}</span>
        <span>${escapeHtml(delayEventDateRange(item))}</span>
      </div>
      <p>${escapeHtml(item.short_description || item.contractor_claim || "אין תיאור עדיין.")}</p>
      <div class="delayStatusActions">
        <button type="button" data-status="approved">אשר</button>
        <button type="button" data-status="rejected" class="dangerButton">דחה</button>
        <button type="button" data-status="needs_review">דורש בדיקה</button>
        <button type="button" data-status="candidate">מועמד</button>
      </div>
      <section class="delayDeepAnalysis">
        <div class="delayClaimSectionHeader">
          <div>
            <h3>ניתוח עומק</h3>
            <p class="hint">שלב 3 מסמן סיכונים, חוסרים ומוכנות. אין כאן קביעה משפטית או לו״זית סופית.</p>
          </div>
          <button id="runDelayEventAnalysis" type="button" ${state.delayEventAnalyzeRunning ? "disabled" : ""}>${state.delayEventAnalyzeRunning ? "מנתח..." : "נתח אירוע"}</button>
        </div>
        <div class="delayReadinessGrid">
          <div class="delayReadinessMeter">
            <span>מוכנות</span>
            <strong>${Math.round(readiness * 100)}%</strong>
            <div><i style="width:${Math.round(readiness * 100)}%"></i></div>
          </div>
          <div class="delayRiskBox" data-risk="${escapeHtml(String(attackRisk))}">
            <span>סיכון תקיפה</span>
            <strong>${escapeHtml(delayAttackRiskLabel(attackRisk))}</strong>
          </div>
          <div class="delayRiskBox">
            <span>בדיקה מקצועית</span>
            <strong>${professionalReview === false ? "לא סומנה" : "נדרשת"}</strong>
          </div>
        </div>
        <div class="delayFindingTabs">${findingTabs || '<div class="delayClaimEmpty">עוד אין ניתוח עומק לאירוע הזה.</div>'}</div>
      </section>
      <form class="delayEvidenceForm" id="delayEvidenceForm">
        <h3>הוסף ראיה</h3>
        <label>ציטוט או תקציר
          <textarea id="delayEvidenceText" rows="3" required></textarea>
        </label>
        <label>מה הראיה תומכת או מחלישה
          <input id="delayEvidenceSupports" />
        </label>
        <label>כיוון
          <select id="delayEvidenceDirection">
            <option value="supports">מחזק</option>
            <option value="weakens">מחליש</option>
            <option value="neutral">ניטרלי</option>
          </select>
        </label>
        <label>רמת ביטחון
          <input id="delayEvidenceConfidence" type="number" min="0" max="1" step="0.05" value="0" />
        </label>
        <button type="submit">שמור ראיה</button>
      </form>
      <section class="delayEvidenceList">
        <h3>ראיות מקושרות</h3>
        ${evidenceRows || '<div class="delayClaimEmpty">אין ראיות מקושרות עדיין.</div>'}
      </section>
    </div>
  `;
  panel.querySelectorAll(".delayStatusActions button").forEach((button) => {
    button.addEventListener("click", () => updateDelayEventStatus(item.id, button.dataset.status));
  });
  panel.querySelector("#runDelayEventAnalysis")?.addEventListener("click", () => runDelayEventAnalysisFromUi(item.id));
  panel.querySelector("#delayEvidenceForm")?.addEventListener("submit", addDelayEvidenceFromForm);
}

async function runDelayEventAnalysisFromUi(eventId) {
  if (!eventId || state.delayEventAnalyzeRunning) return;
  state.delayEventAnalyzeRunning = true;
  state.lastDelayEventAnalysis = null;
  renderDelayEventInspector();
  try {
    const result = await api(`/api/delay-events/${encodeURIComponent(eventId)}/analyze`, {
      method: "POST",
      timeoutMs: 120_000,
      body: {}
    });
    state.lastDelayEventAnalysis = result;
    showToast("ניתוח אירוע הסתיים");
    await loadDelayEvents(state.selectedDelayClaimId);
  } catch (error) {
    state.lastDelayEventAnalysis = { ok: false, error: error.message };
    showToast(`ניתוח אירוע נכשל: ${error.message}`, "error");
  } finally {
    state.delayEventAnalyzeRunning = false;
    renderDelayEventInspector();
  }
}

function renderDelayFindingTab(label, finding) {
  if (!finding) {
    return `
      <article class="delayFindingTab empty">
        <strong>${escapeHtml(label)}</strong>
        <p>טרם נותח.</p>
      </article>
    `;
  }
  return `
    <article class="delayFindingTab">
      <strong>${escapeHtml(label)}</strong>
      <p>${escapeHtml(finding.explanation || "אין הסבר.")}</p>
      <small>${escapeHtml(delayFindingTypeLabel(finding.finding_type))} · ${formatConfidence(finding.confidence)}</small>
    </article>
  `;
}

async function updateDelayEventStatus(eventId, status) {
  try {
    await api(`/api/delay-events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: { human_status: status, changed_by: "ui" }
    });
    showToast("סטטוס האירוע עודכן");
    await loadDelayEvents(state.selectedDelayClaimId);
  } catch (error) {
    showToast(`עדכון סטטוס נכשל: ${error.message}`, "error");
  }
}

async function addDelayEvidenceFromForm(event) {
  event.preventDefault();
  const delayEvent = selectedDelayEvent();
  if (!delayEvent) return;
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await api(`/api/delay-events/${encodeURIComponent(delayEvent.id)}/evidence`, {
      method: "POST",
      body: {
        quote: $("delayEvidenceText")?.value || "",
        what_it_supports: $("delayEvidenceSupports")?.value || "",
        supports_or_weakens: $("delayEvidenceDirection")?.value || "supports",
        confidence: Number($("delayEvidenceConfidence")?.value || 0),
        human_status: "candidate"
      }
    });
    showToast("ראיה נוספה לאירוע");
    await loadDelayEvents(state.selectedDelayClaimId);
  } catch (error) {
    showToast(`שמירת ראיה נכשלה: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

function selectedDelayClaim() {
  return state.delayClaims.find((claim) => claim.id === state.selectedDelayClaimId) || null;
}

function selectedDelayEvent() {
  return state.delayEvents.find((item) => item.id === state.selectedDelayEventId) || null;
}

function delayStatusLabel(status) {
  return ({
    candidate: "מועמד",
    approved: "מאושר",
    rejected: "נדחה",
    needs_review: "דורש בדיקה"
  })[status] || "מועמד";
}

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "ביטחון לא צוין";
  return `ביטחון ${Math.round(number * 100)}%`;
}

function delayEventDateRange(item = {}) {
  if (item.start_date && item.end_date) return `${item.start_date} - ${item.end_date}`;
  return item.start_date || item.end_date || "ללא תאריך";
}

function delayAttackRiskLabel(value) {
  return ({ high: "גבוה", medium: "בינוני", low: "נמוך", not_analyzed: "לא נותח" })[value] || value || "לא נותח";
}

function delayFindingTypeLabel(value) {
  return ({
    documented_fact: "עובדה מתועדת",
    calculation: "חישוב",
    analytical_conclusion: "מסקנה אנליטית",
    professional_review: "לבדיקה מקצועית"
  })[value] || value || "ממצא";
}

function wireProjectGraph() {
  $("refreshGraph")?.addEventListener("click", loadProjectGraph);
  for (const id of ["graphNodeType", "graphEdgeType", "graphLimit"]) {
    $(id)?.addEventListener("change", loadProjectGraph);
  }
  $("graphQuery")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadProjectGraph();
  });
}

async function loadProjectGraph() {
  if (!$("projectGraphCy")) return;
  $("graphSummary").textContent = "טוען גרף...";
  $("projectGraphInspector").innerHTML = '<div class="workflowInspectorEmpty">טוען קשרים...</div>';
  try {
    const params = new URLSearchParams({
      limit: $("graphLimit")?.value || "300",
      nodeType: $("graphNodeType")?.value || "",
      edgeType: $("graphEdgeType")?.value || "",
      q: $("graphQuery")?.value || ""
    });
    state.projectGraph = await api(`/api/graph?${params.toString()}`);
    renderProjectGraph();
  } catch (error) {
    $("graphSummary").textContent = `שגיאה בטעינת הגרף: ${error.message}`;
    $("projectGraphInspector").innerHTML = `<div class="workflowInspectorEmpty">${escapeHtml(error.message)}</div>`;
  }
}

function renderProjectGraph() {
  const graph = state.projectGraph || { nodes: [], edges: [], stats: null };
  if (_graphCy) { _graphCy.destroy(); _graphCy = null; }
  const summary = graph.skipped
    ? `הגרף לא זמין: ${graph.reason || "אין נתונים"}`
    : `${graph.stats?.nodeCount || 0} nodes · ${graph.stats?.edgeCount || 0} edges`;
  $("graphSummary").textContent = summary;
  $("projectGraphInspector").innerHTML = renderGraphStats(graph.stats, graph.reason);
  if (!graph.nodes?.length) return;

  const elements = graph.nodes.map((node) => ({
    group: "nodes",
    data: {
      id: node.id,
      label: node.label,
      nodeType: node.node_type,
      entityKind: node.entity_kind || node.node_type,
      sourceTable: node.source_table || "",
      sourceId: node.source_id || "",
      graphData: node
    }
  })).concat((graph.edges || []).map((edge) => ({
    group: "edges",
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.edge_kind || edge.edge_type,
      edgeType: edge.edge_type,
      edgeKind: edge.edge_kind || edge.edge_type,
      confidence: Number(edge.confidence || edge.weight || 0.5),
      graphData: edge
    }
  })));

  _graphCy = cytoscape({
    container: $("projectGraphCy"),
    elements,
    style: projectGraphStyle(),
    layout: { name: "cose", animate: false, fit: true, padding: 36, nodeRepulsion: 9000, idealEdgeLength: 130 }
  });
  _graphCy.on("tap", "node", (evt) => renderProjectGraphInspector("node", evt.target.data("graphData")));
  _graphCy.on("tap", "edge", (evt) => renderProjectGraphInspector("edge", evt.target.data("graphData")));
}

function renderGraphStats(stats = {}, reason = "") {
  if (reason) return `<div class="workflowInspectorEmpty">${escapeHtml(reason)}</div>`;
  const nodeTypes = (stats?.entityKinds || stats?.nodeTypes || []).slice(0, 10).map((item) => `<span>${escapeHtml(item.name)} <b>${item.count}</b></span>`).join("");
  const edgeTypes = (stats?.edgeKinds || stats?.edgeTypes || []).slice(0, 10).map((item) => `<span>${escapeHtml(item.name)} <b>${item.count}</b></span>`).join("");
  return `
    <div class="graphStats">
      <strong>${stats?.nodeCount || 0} nodes · ${stats?.edgeCount || 0} edges</strong>
      <div>${nodeTypes || "<span>אין node types</span>"}</div>
      <div>${edgeTypes || "<span>אין edge types</span>"}</div>
    </div>
  `;
}

function renderProjectGraphInspector(kind, item = {}) {
  const title = kind === "edge" ? item.edge_kind || item.edge_type : item.label;
  const rows = kind === "edge"
    ? {
        type: item.edge_type,
        relation: item.edge_kind,
        source: item.source,
        target: item.target,
        confidence: item.confidence,
        weight: item.weight,
        evidence: item.evidence_text
      }
    : {
        type: item.node_type,
        kind: item.entity_kind,
        id: item.id,
        source_table: item.source_table,
        source_id: item.source_id,
        event_date: item.event_date
      };
  $("projectGraphInspector").innerHTML = `
    <header class="workflowInspectorHeader">
      <span class="workflowIcon database">${kind === "edge" ? "EDGE" : "NODE"}</span>
      <div>
        <strong>${escapeHtml(title || item.id || "")}</strong>
        <small>${escapeHtml(kind)}</small>
      </div>
    </header>
    <details open>
      <summary>Details</summary>
      <pre>${escapeHtml(JSON.stringify(rows, null, 2))}</pre>
    </details>
    <details>
      <summary>Metadata</summary>
      <pre>${escapeHtml(JSON.stringify(item.metadata || {}, null, 2))}</pre>
    </details>
  `;
}

function projectGraphStyle() {
  const nodeColor = {
    event:            "#4fa8d8",
    alert:            "#f06060",
    hashtag:          "#26c99a",
    topic:            "#26c99a",
    risk:             "#ffab40",
    vendor:           "#b07fff",
    supplier:         "#b07fff",
    source_table:     "#78909c",
    source:           "#78909c",
    quote:            "#4db6ac",
    invoice:          "#ff8a65",
    person:           "#29b6f6",
    document:         "#66bb6a",
    attachment:       "#81c784",
    email:            "#42a5f5",
    category:         "#ffd54f",
    status:           "#90a4ae",
    date:             "#80cbc4",
    transaction_type: "#ffcc80",
    submitter:        "#ce93d8"
  };
  const nodeBorder = {
    event:            "#7ec8ec",
    alert:            "#ff8a80",
    hashtag:          "#5eefc0",
    topic:            "#5eefc0",
    risk:             "#ffd180",
    vendor:           "#d0a8ff",
    supplier:         "#d0a8ff",
    source_table:     "#b0bec5",
    source:           "#b0bec5",
    quote:            "#80cbc4",
    invoice:          "#ffab91",
    person:           "#81d4fa",
    document:         "#a5d6a7",
    attachment:       "#c8e6c9",
    email:            "#90caf9",
    category:         "#ffe082",
    status:           "#b0bec5",
    date:             "#b2dfdb",
    transaction_type: "#ffe0b2",
    submitter:        "#e1bee7"
  };
  const getColor  = (e) => nodeColor[e.data("entityKind")]  || nodeColor[e.data("nodeType")]  || "#78909c";
  const getBorder = (e) => nodeBorder[e.data("entityKind")] || nodeBorder[e.data("nodeType")] || "#b0bec5";
  return [
    {
      selector: "node",
      style: {
        shape: "ellipse",
        width: 44,
        height: 44,
        "background-color": getColor,
        "background-opacity": 0.92,
        "border-width": 2,
        "border-color": getBorder,
        "border-opacity": 0.8,
        "shadow-blur": 18,
        "shadow-color": getColor,
        "shadow-opacity": 0.45,
        "shadow-offset-x": 0,
        "shadow-offset-y": 0,
        color: "#e8f0f8",
        "text-outline-color": "#080e1a",
        "text-outline-width": 2,
        label: (e) => String(e.data("label") || e.id()).slice(0, 36),
        "font-size": 10.5,
        "font-weight": 600,
        "text-wrap": "wrap",
        "text-max-width": 100,
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 8,
        "transition-property": "border-width, shadow-blur, shadow-opacity",
        "transition-duration": "180ms"
      }
    },
    {
      selector: "node:active, node:hover",
      style: {
        "border-width": 3,
        "shadow-blur": 32,
        "shadow-opacity": 0.72
      }
    },
    {
      selector: "edge",
      style: {
        width: (e) => Math.max(1, Math.min(4, Number(e.data("confidence") || 0.5) * 4)),
        "line-color": "rgba(148,163,184,0.28)",
        "target-arrow-color": "rgba(148,163,184,0.4)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.9,
        "curve-style": "bezier",
        "line-opacity": 0.7,
        label: "data(label)",
        "font-size": 8,
        color: "rgba(189,208,228,0.7)",
        "text-outline-color": "#080e1a",
        "text-outline-width": 1.5,
        "text-rotation": "autorotate"
      }
    },
    {
      selector: ":selected",
      style: {
        "border-color": "#ffd54f",
        "border-width": 3,
        "shadow-color": "#ffd54f",
        "shadow-blur": 24,
        "shadow-opacity": 0.65,
        "line-color": "rgba(255,213,79,0.6)",
        "target-arrow-color": "rgba(255,213,79,0.8)"
      }
    }
  ];
}

function edgeKey(edge) {
  return `${edge.from}->${edge.to}`;
}

function iconForNode(kind) {
  return {
    trigger: "▶", code: "{}", database: "DB", memory: "MEM",
    ai: "AI", router: "↯", vector: "IDX", tool: "API"
  }[kind] || "•";
}

function statusLabel(status) {
  return {
    idle: "ממתין",
    done: "בוצע",
    error: "שגיאה",
    skipped: "דולג",
    disconnected: "לא מחובר"
  }[status] || status;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appendDebug(messageNode, result) {
  const failed = (result.toolCalls || []).filter((call) => !call.ok);
  if (!failed.length) return;
  const details = document.createElement("details");
  details.className = "debug";
  const summary = document.createElement("summary");
  summary.textContent = "פרטי שגיאה טכניים";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(
    failed.map((call) => ({
      toolName: call.toolName,
      error: call.error,
      skipped: call.skipped,
      rawQuery: call.rawQuery
    })),
    null,
    2
  );
  details.append(summary, pre);
  messageNode.append(details);
}

function wireSettings() {
  $("exportSettings")?.addEventListener("click", exportSettingsFile);
  $("importSettings")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    $("settingsImportFile")?.click();
  });
  $("settingsImportFile")?.addEventListener("change", importSettingsFile);
  $("applySettingsPreset")?.addEventListener("click", applySelectedSettingsPreset);
  $("saveSettingsPreset")?.addEventListener("click", saveCurrentSettingsAsPreset);
  $("settingsPresetSelect")?.addEventListener("change", renderSelectedSettingsPresetMeta);
  $("settings")?.addEventListener("input", markSettingsDraftChanged);
  $("settings")?.addEventListener("change", (event) => {
    if (event.target?.id !== "settingsImportFile") markSettingsDraftChanged();
  });

  $("saveSettings")?.addEventListener("click", async () => {
    const body = readSettingsForm();
    if ($("saveSettings")) $("saveSettings").disabled = true;
    setSettingsSaveState("שומר את כל ההגדרות ב-Supabase...", "saving");
    try {
      const result = await api("/api/settings", { method: "PUT", body });
      applySettingsResponse(result.settings);
      state.settingsDirty = false;
      setSettingsSaveState("כל ההגדרות נשמרו ב-Supabase.", "saved");
      showToast("ההגדרות נשמרו בהצלחה");
    } catch (error) {
      setSettingsSaveState("השמירה נכשלה. השינויים עדיין נמצאים בטופס ולא נמחקו.", "error");
      showToast(`שגיאה בשמירה: ${error.message}`, "error");
    } finally {
      if ($("saveSettings")) $("saveSettings").disabled = false;
    }
  });

  $("reloadSettings")?.addEventListener("click", async () => {
    $("reloadSettings").disabled = true;
    try {
      const result = await api("/api/settings/reload", { method: "POST", body: {} });
      applySettingsResponse(result.settings);
      state.settingsDirty = false;
      setSettingsSaveState("ההגדרות המוצגות נטענו מחדש מ-Supabase.", "saved");
      showToast("ההגדרות נטענו מחדש מ-Supabase");
    } catch (error) {
      showToast(`שגיאה ברענון: ${error.message}`, "error");
    } finally {
      $("reloadSettings").disabled = false;
    }
  });
}

function readSettingsForm() {
  return {
    models: {
      classifier: $("modelClassifier").value,
      knowledgePlanner: $("modelKnowledgePlanner").value,
      main: $("modelMain").value,
      lite: $("modelLite").value,
      embedding: $("modelEmbedding").value,
      reranker: $("modelReranker").value,
      qa: $("modelQa")?.value || $("modelMain").value
    },
    retrieval: {
      rpcName: $("hybridRpcName").value,
      candidates: Number($("hybridCandidates").value || 40),
      plannerCandidates: Number($("plannerCandidates")?.value || 20),
      alertCandidates: Number($("alertCandidates")?.value || 20),
      rerankTopK: Number($("rerankTopK").value || 10),
      vectorWeight: Number($("vectorWeight").value || 0),
      keywordWeight: Number($("keywordWeight").value || 0),
      timelineLimit: Number($("tlLimitInput")?.value || 1000),
      timelineDaysBack: Number($("tlDaysInput")?.value || 1825)
    },
    ai: readAiSettingsFromForm(),
    rag: {
      contextRecordsLimit: Number($("ragContextRecordsLimit")?.value || 12),
      chunkTextLimit: Number($("ragChunkTextLimit")?.value || 1800),
      plannerExtraQueriesLimit: Number($("ragPlannerExtraQueriesLimit")?.value || 0)
    },
    graph: {
      enabled: Boolean($("graphEnabled")?.checked),
      searchLimit: Number($("graphSearchLimit")?.value || 30),
      contextLimit: Number($("graphContextLimit")?.value || 12),
      expandedForListQuestions: Boolean($("graphExpandedForListQuestions")?.checked)
    },
    cache: {
      enabled: Boolean($("cacheEnabled")?.checked),
      provider: $("cacheProvider")?.value || "memory",
      redisUrl: $("cacheRedisUrl")?.value || "",
      namespace: state.settings?.cache?.namespace || "bidoc:cache:",
      memoryMaxEntries: Number($("cacheMemoryMaxEntries")?.value || 10000),
      timeoutMs: Number(state.settings?.cache?.timeoutMs || 5000)
    },
    knowledge: {
      triggerKeywords: parseMultilineList($("knowledgeTriggerKeywords")?.value || ""),
      agentLimit: Number($("knowledgeAgentLimit")?.value || 2),
      topK: Number($("knowledgeTopKSetting")?.value || 4),
      chunkSize: Number($("knowledgeChunkSize")?.value || 1800)
    },
    prompts: readChatPromptFieldsFromSettingsForm(),
    contentSource: {
      supabaseUrl: $("contentSupabaseUrl")?.value || "",
      supabaseServiceRoleKey: $("contentSupabaseServiceRoleKey")?.value || "",
      hybridRpcName: $("contentHybridRpcName")?.value || $("hybridRpcName").value,
      indexTable: $("contentIndexTable")?.value || "",
      alertsTable: $("contentAlertsTable")?.value || "",
      alertsRpcName: $("contentAlertsRpcName")?.value || ""
    },
    secrets: {
      openRouterApiKey: $("openRouterApiKey").value,
      supabaseUrl: $("supabaseUrl").value,
      supabaseServiceRoleKey: $("supabaseServiceRoleKey").value
    },
    n8nBaseUrl: $("n8nBaseUrl").value,
    timezone: $("timezone").value,
    toolsRuntime: {
      enabled: Boolean($("toolsEnabled")?.checked),
      parallelLimit: Number($("toolsParallelLimit")?.value || 6),
      alertAgentEnabled: Boolean($("toolsAlertAgentEnabled")?.checked),
      safetyPrecheckEnabled: Boolean($("toolsSafetyPrecheckEnabled")?.checked)
    },
    tools: Object.fromEntries(n8nTools.map((tool) => [tool, $(`tool_${tool}`).value])),
    timelineLinks: state.settings?.timelineLinks || {},
    subagents: state.settings?.subagents || {},
    presets: customSettingsPresets()
  };
}

function wireLinkAgent() {
  $("saveLinkAgent")?.addEventListener("click", saveLinkAgentSettings);
  $("testLinkAgent")?.addEventListener("click", testLinkAgentSettings);
}

async function loadLinkAgent() {
  if (!state.settings) await loadSettings();
  if (!state.openRouterModels.length) await loadOpenRouterModels();
  applyLinkAgentSettingsToForm();
}

function applyLinkAgentSettingsToForm() {
  const settings = state.settings?.timelineLinks || {};
  fillModelSelect($("linkAgentModel"), settings.model || state.settings?.models?.reranker || "");
  if ($("linkAgentSuggestionLimit")) $("linkAgentSuggestionLimit").value = settings.suggestionLimit ?? 12;
  if ($("linkAgentSemanticTopK")) $("linkAgentSemanticTopK").value = settings.semanticTopK ?? 8;
  if ($("linkAgentTimeWindowDays")) $("linkAgentTimeWindowDays").value = settings.timeWindowDays ?? 120;
  if ($("linkAgentMinConfidence")) $("linkAgentMinConfidence").value = settings.minConfidence ?? 0.42;
  if ($("linkAgentUseSemanticSearch")) $("linkAgentUseSemanticSearch").checked = settings.useSemanticSearch !== false;
  if ($("linkAgentUseGraphFallback")) $("linkAgentUseGraphFallback").checked = settings.useGraphFallback !== false;
  if ($("linkAgentPrompt")) $("linkAgentPrompt").value = settings.prompt || "";
  if ($("linkAgentIgnoredTerms")) $("linkAgentIgnoredTerms").value = (settings.ignoredTerms || []).join("\n");
}

function readLinkAgentSettingsFromForm() {
  return {
    model: $("linkAgentModel")?.value || "",
    prompt: $("linkAgentPrompt")?.value || "",
    suggestionLimit: Number($("linkAgentSuggestionLimit")?.value || 12),
    semanticTopK: Number($("linkAgentSemanticTopK")?.value || 8),
    timeWindowDays: Number($("linkAgentTimeWindowDays")?.value || 120),
    minConfidence: Number($("linkAgentMinConfidence")?.value || 0.42),
    useSemanticSearch: Boolean($("linkAgentUseSemanticSearch")?.checked),
    useGraphFallback: Boolean($("linkAgentUseGraphFallback")?.checked),
    ignoredTerms: parseMultilineList($("linkAgentIgnoredTerms")?.value || "")
  };
}

async function saveLinkAgentSettings() {
  const button = $("saveLinkAgent");
  button.disabled = true;
  try {
    state.settings = {
      ...(state.settings || {}),
      timelineLinks: readLinkAgentSettingsFromForm(),
      presets: state.settings?.presets || []
    };
    state.settingsDirty = true;
    applyLinkAgentSettingsToForm();
    setSettingsSaveState("יש שינויים בטופס שטרם נשמרו ב-Supabase.", "dirty");
    showToast("הגדרות סוכן הקשרים נטענו לטופס. לחץ שמור כדי לעדכן את Supabase");
  } catch (error) {
    showToast(`שגיאה בשמירה: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function testLinkAgentSettings() {
  const resultBox = $("linkAgentTestResult");
  const eventId = $("linkAgentTestEventId")?.value?.trim();
  const source = $("linkAgentTestSource")?.value || "index";
  if (!eventId) {
    resultBox.textContent = "צריך להזין Event ID.";
    return;
  }
  resultBox.textContent = "בודק...";
  try {
    await saveLinkAgentSettings();
    if (state.settingsDirty) {
      resultBox.textContent = "יש לשמור את עמוד ההגדרות הראשי לפני הרצת בדיקת סוכן הקשרים.";
      return;
    }
    const runId = startLinkAgentLiveRun();
    const result = await api(`/api/timeline/link-suggestions?source=${encodeURIComponent(source)}&smart=1&eventId=${encodeURIComponent(eventId)}&limit=${encodeURIComponent($("linkAgentSuggestionLimit")?.value || 12)}&runId=${encodeURIComponent(runId)}`);
    applyLinkAgentWorkflow(result);
    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultBox.textContent = error.message;
  }
}

function startLinkAgentLiveRun() {
  const runId = `link_agent_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  startLiveRun(runId);
  if ($("liveRunStatus")) $("liveRunStatus").textContent = `סוכן הקשרים רץ: ${runId}`;
  renderWorkflow(null);
  return runId;
}

function applyLinkAgentWorkflow(result) {
  if (!result?.workflowLog) return;
  state.lastWorkflow = result.workflowLog;
  const events = (result.workflowLog.trace || []).map((item) => ({
    id: item.id || `${item.time}_${item.step}`,
    time: item.time || new Date().toISOString(),
    step: item.step,
    message: item.message,
    data: item.data || {}
  }));
  state.runEvents = [];
  const liveRunList = $("liveRunList");
  if (liveRunList) {
    liveRunList.innerHTML = "";
    liveRunList.hidden = false;
    for (const item of events) appendLiveRunEvent(item);
  }
  if ($("liveRunStatus")) $("liveRunStatus").textContent = "סוכן הקשרים · ריצה אחרונה";
  renderWorkflow(state.lastWorkflow);
}

function wireTools() {
  $("runTool").addEventListener("click", async () => {
    $("toolResult").textContent = "מריץ...";
    try {
      const result = await api(`/api/tools/${encodeURIComponent($("toolSelect").value)}/test`, {
        method: "POST",
        body: {
          query: $("toolQuery").value,
          date_filter: $("toolDateFilter").value,
          hashtags: $("toolHashtags").value,
          sessionId: $("sessionId").value
        }
      });
      $("toolResult").textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      $("toolResult").textContent = error.message;
    }
  });

  $("runConnectionDiagnostics")?.addEventListener("click", runConnectionDiagnostics);
  $("connectionDiagnostics")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-diagnostic-id]");
    if (button) runConnectionDiagnostics([button.dataset.diagnosticId]);
  });
  renderConnectionDiagnostics([]);
}

async function runConnectionDiagnostics(ids = []) {
  const button = $("runConnectionDiagnostics");
  const container = $("connectionDiagnostics");
  const selectedIds = Array.isArray(ids) ? ids : [];
  if (!selectedIds.length) button.disabled = true;
  setDiagnosticLoading(selectedIds);
  try {
    const result = await api("/api/diagnostics/connections", { method: "POST", body: { ids: selectedIds } });
    renderConnectionDiagnostics(result.results || [], { merge: Boolean(selectedIds.length) });
  } catch (error) {
    if (!selectedIds.length) {
      container.innerHTML = `<div class="diagnosticCard error"><strong>בדיקת החיבורים נכשלה</strong><small>${escapeHtml(error.message)}</small></div>`;
    }
  } finally {
    button.disabled = false;
  }
}

function renderConnectionDiagnostics(results, { merge = false } = {}) {
  const container = $("connectionDiagnostics");
  const previous = merge ? new Map(
    [...container.querySelectorAll("[data-diagnostic-card][data-ok]")].map((card) => [
      card.dataset.diagnosticCard,
      {
        id: card.dataset.diagnosticCard,
        label: card.dataset.label,
        group: card.dataset.group,
        ok: card.dataset.ok === "true",
        status: card.dataset.status,
        ms: Number(card.dataset.ms || 0),
        details: card.dataset.details ? JSON.parse(card.dataset.details) : null,
        error: card.dataset.error || ""
      }
    ])
  ) : new Map();
  for (const result of results) previous.set(result.id, result);
  const resultMap = previous;
  container.innerHTML = "";

  for (const group of diagnosticGroups) {
    const section = document.createElement("section");
    section.className = "diagnosticGroup";
    section.innerHTML = `
      <header class="diagnosticGroupHeader">
        <div><h3>${escapeHtml(group.label)}</h3><p>${escapeHtml(group.description)}</p></div>
        <span>${group.checks.length} רכיבים</span>
      </header>
      <div class="diagnosticsGrid"></div>
    `;
    const grid = section.querySelector(".diagnosticsGrid");
    for (const [id, label] of group.checks) {
      grid.append(buildDiagnosticCard(resultMap.get(id) || { id, label, group: group.id, pending: true }));
    }
    container.append(section);
  }
  updateDiagnosticSummary([...resultMap.values()]);
}

function buildDiagnosticCard(item) {
  const card = document.createElement("article");
  card.className = `diagnosticCard ${item.loading ? "loading" : item.pending ? "idle" : item.ok ? "ok" : "error"}`;
  card.dataset.diagnosticCard = item.id;
  card.dataset.label = item.label;
  card.dataset.group = item.group || "";
  if (!item.pending && !item.loading) {
    card.dataset.ok = String(Boolean(item.ok));
    card.dataset.status = item.status || "";
    card.dataset.ms = String(item.ms || 0);
    card.dataset.details = JSON.stringify(item.details || null);
    card.dataset.error = item.error || "";
  }
  const status = item.loading ? "בודק..." : item.pending ? "טרם נבדק" : item.ok ? "תקין" : diagnosticStatusLabel(item.status);
  const output = item.loading
    ? "מתבצעת בדיקת חיבור..."
    : item.pending
      ? "לחץ על כפתור הבדיקה כדי לבדוק רכיב זה."
      : JSON.stringify(item.ok ? item.details : { status: item.status, error: item.error }, null, 2);
  card.innerHTML = `
      <div class="diagnosticTop">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(status)}</span>
      </div>
      <div class="diagnosticMeta">
        <small>${item.pending || item.loading ? "" : `${item.ms ?? 0}ms`}</small>
        <button class="iconButton diagnosticRunButton" type="button" data-diagnostic-id="${escapeHtml(item.id)}" title="בדוק רכיב" aria-label="בדוק ${escapeHtml(item.label)}">↻</button>
      </div>
      <pre>${escapeHtml(output)}</pre>
  `;
  return card;
}

function setDiagnosticLoading(ids) {
  const selected = ids.length
    ? ids
    : diagnosticGroups.flatMap((group) => group.checks.map(([id]) => id));
  for (const id of selected) {
    const card = document.querySelector(`[data-diagnostic-card="${CSS.escape(id)}"]`);
    if (!card) continue;
    card.className = "diagnosticCard loading";
    card.querySelector(".diagnosticTop span").textContent = "בודק...";
    card.querySelector("pre").textContent = "מתבצעת בדיקת חיבור...";
    card.querySelector("button").disabled = true;
  }
}

function updateDiagnosticSummary(results) {
  const summary = $("diagnosticSummary");
  const completed = results.filter((item) => !item.pending && !item.loading);
  if (!completed.length) {
    summary.textContent = "טרם הורצו בדיקות.";
    summary.className = "diagnosticSummary";
    return;
  }
  const ok = completed.filter((item) => item.ok).length;
  const failed = completed.length - ok;
  summary.textContent = `${ok} תקינים · ${failed} דורשים טיפול · ${completed.length} נבדקו`;
  summary.className = `diagnosticSummary ${failed ? "hasErrors" : "allOk"}`;
}

function diagnosticStatusLabel(status) {
  return {
    auth_error: "בעיית מפתח / הרשאה",
    billing_or_quota: "קרדיטים / מגבלה",
    missing_rpc_or_schema: "RPC או סכימה חסרים",
    missing_table_or_column: "טבלה או עמודה חסרה",
    missing_config: "חסר קונפיגורציה",
    network_error: "בעיית רשת / חסימה",
    error: "שגיאה"
  }[status] || "שגיאה";
}

async function loadSettings() {
  const settings = await api("/api/settings");
  applySettingsResponse(settings);
  state.settingsDirty = false;
  setSettingsSaveState("ההגדרות המוצגות נטענו מ-Supabase.", "saved");
}

function applySettingsResponse(settings) {
  state.settings = settings;
  let agents = settings?.agents;
  if (!Array.isArray(agents) || !agents.length) {
    agents = [];
  }
  state.agents = agents;
  resetAgentRuntime();
  applySettingsToForm();
  renderAgents();
}

function applySettingsToForm() {
  if (!state.settings) return;
  renderSettingsPresetControls();
  applyModelSelectsToSettingsForm();
  applyChatPromptFieldsToSettingsForm();
  if ($("hybridRpcName")) $("hybridRpcName").value = state.settings.retrieval.rpcName;
  if ($("hybridCandidates")) $("hybridCandidates").value = state.settings.retrieval.candidates;
  setInputValue("plannerCandidates", state.settings.retrieval.plannerCandidates ?? 20);
  setInputValue("alertCandidates", state.settings.retrieval.alertCandidates ?? 20);
  if ($("rerankTopK")) $("rerankTopK").value = state.settings.retrieval.rerankTopK;
  if ($("vectorWeight")) $("vectorWeight").value = state.settings.retrieval.vectorWeight;
  if ($("keywordWeight")) $("keywordWeight").value = state.settings.retrieval.keywordWeight;
  setInputValue("tlLimitInput", state.settings.retrieval.timelineLimit ?? 1000);
  if ($("knowledgeTriggerKeywords")) {
    $("knowledgeTriggerKeywords").value = (state.settings.knowledge?.triggerKeywords || []).join("\n");
  }
  applyAdvancedAiSettingsToForm();
  if ($("n8nBaseUrl")) $("n8nBaseUrl").value = state.settings.n8nBaseUrl || "";
  if ($("timezone")) $("timezone").value = state.settings.timezone || "Asia/Jerusalem";
  if ($("openRouterApiKey")) {
    $("openRouterApiKey").value = "";
    $("openRouterApiKey").placeholder = state.settings.secrets.openRouterApiKey || "sk-or-...";
  }
  if ($("supabaseUrl")) $("supabaseUrl").value = state.settings.secrets.supabaseUrl || "";
  if ($("supabaseServiceRoleKey")) {
    $("supabaseServiceRoleKey").value = "";
    $("supabaseServiceRoleKey").placeholder = state.settings.secrets.supabaseServiceRoleKey || "eyJ...";
  }
  const contentSource = state.settings.contentSource || {};
  if ($("contentSupabaseUrl")) $("contentSupabaseUrl").value = contentSource.supabaseUrl || "";
  if ($("contentSupabaseServiceRoleKey")) {
    $("contentSupabaseServiceRoleKey").value = "";
    $("contentSupabaseServiceRoleKey").placeholder = contentSource.supabaseServiceRoleKey || "sb_secret_...";
  }
  if ($("contentHybridRpcName")) $("contentHybridRpcName").value = contentSource.hybridRpcName || state.settings.retrieval.rpcName || "";
  if ($("contentIndexTable")) $("contentIndexTable").value = contentSource.indexTable || "";
  if ($("contentAlertsTable")) $("contentAlertsTable").value = contentSource.alertsTable || "";
  if ($("contentAlertsRpcName")) $("contentAlertsRpcName").value = contentSource.alertsRpcName || "";

  if ($("toolSettings")) {
    $("toolSettings").innerHTML = "";
    for (const tool of n8nTools) {
      const label = document.createElement("label");
      label.textContent = tool;
      const input = document.createElement("input");
      input.id = `tool_${tool}`;
      input.placeholder = `${tool} webhook URL`;
      input.value = state.settings.tools[tool]?.url || "";
      label.append(input);
      $("toolSettings").append(label);
    }
  }

  const configured = Object.entries(state.settings.tools).filter(([, value]) => value.configured).length;
  $("configStatus").innerHTML = [
    `OpenRouter: ${state.settings.openRouterConfigured ? "מוגדר" : "חסר"}`,
    `App DB: ${state.settings.supabaseConfigured ? "מוגדר" : "חסר"}`,
    `Content DB: ${state.settings.contentSupabaseConfigured ? "מוגדר" : "חסר"}`,
    `Tools: ${configured}/${n8nTools.length}`
  ].join("<br>");
  renderSettingsSourceStatus();
  applyLinkAgentSettingsToForm();
  renderAgents();
}

function applyChatPromptFieldsToSettingsForm() {
  const byId = Object.fromEntries((state.agents || []).map((agent) => [agent.id, agent]));
  for (const [agentId, fieldId] of Object.entries(chatPromptFields)) {
    const field = $(fieldId);
    if (!field) continue;
    field.value = state.settings?.prompts?.[agentId] || byId[agentId]?.prompt || "";
  }
}

function markSettingsDraftChanged() {
  state.settingsDirty = true;
  setSettingsSaveState("יש שינויים בטופס שטרם נשמרו ב-Supabase.", "dirty");
}

function renderSettingsPresetControls() {
  const select = $("settingsPresetSelect");
  const meta = $("settingsPresetMeta");
  if (!select) return;
  const currentValue = select.value;
  const presets = Array.isArray(state.settings?.presets) ? state.settings.presets : [];
  select.innerHTML = "";
  if (!presets.length) {
    select.append(new Option("אין פריסטים זמינים", ""));
    select.disabled = true;
    if (meta) meta.textContent = "עדיין אין פריסטים זמינים.";
    return;
  }
  select.disabled = false;
  select.append(new Option("בחר פריסט...", ""));
  for (const preset of presets) {
    const label = preset.builtin ? `${preset.name} · מובנה` : `${preset.name} · מותאם`;
    select.append(new Option(label, preset.id));
  }
  const nextValue = presets.some((preset) => preset.id === currentValue) ? currentValue : "";
  select.value = nextValue;
  renderSelectedSettingsPresetMeta();
}

function renderSelectedSettingsPresetMeta() {
  const meta = $("settingsPresetMeta");
  if (!meta) return;
  const preset = selectedSettingsPreset();
  if (!preset) {
    meta.textContent = "בחר פריסט כדי לראות מה הוא משנה.";
    return;
  }
  meta.textContent = preset.description || "פריסט מוכן לטעינה לתוך הטופס.";
}

function selectedSettingsPreset() {
  const presetId = $("settingsPresetSelect")?.value || "";
  return (state.settings?.presets || []).find((item) => item.id === presetId) || null;
}

async function applySelectedSettingsPreset() {
  const preset = selectedSettingsPreset();
  if (!preset) {
    showToast("צריך לבחור פריסט קודם.", "error");
    return;
  }
  const nextSettings = mergeSettingsDraft(state.settings || {}, preset.settings || {});
  state.settings = nextSettings;
  applySettingsToForm();
  state.settingsDirty = true;
  setSettingsSaveState(`הפריסט "${preset.name}" נטען לטופס. כדי לשמור אותו למערכת יש ללחוץ על "שמור".`, "dirty");
  showToast(`הפריסט "${preset.name}" נטען לטופס`);
}

async function saveCurrentSettingsAsPreset() {
  const input = $("newSettingsPresetName");
  const button = $("saveSettingsPreset");
  const name = String(input?.value || "").trim();
  if (!name) {
    showToast("צריך להזין שם לפריסט החדש.", "error");
    input?.focus();
    return;
  }
  const preset = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: "פריסט מותאם אישית שנשמר מתוך עמוד ההגדרות",
    settings: buildSettingsPresetSnapshot()
  };
  if (button) button.disabled = true;
  try {
    state.settings = {
      ...(state.settings || {}),
      presets: [...customSettingsPresets(), preset]
    };
    applySettingsToForm();
    state.settingsDirty = true;
    if (input) input.value = "";
    const select = $("settingsPresetSelect");
    if (select) {
      select.value = preset.id;
      renderSelectedSettingsPresetMeta();
    }
    setSettingsSaveState("הפריסט החדש נטען לטופס. לחץ שמור כדי לעדכן את Supabase.", "dirty");
    showToast(`הפריסט "${name}" נוסף לטופס. לחץ שמור כדי לשמור אותו`);
  } catch (error) {
    setSettingsSaveState("הוספת הפריסט נכשלה. הטופס נשאר כפי שהוא.", "error");
    showToast(`שגיאה בשמירת פריסט: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function customSettingsPresets() {
  return (state.settings?.presets || []).filter((preset) => !preset.builtin);
}

function buildSettingsPresetSnapshot() {
  const current = readSettingsForm();
  return {
    models: cloneJson(current.models || {}),
    prompts: cloneJson(current.prompts || {}),
    retrieval: cloneJson(current.retrieval || {}),
    ai: cloneJson(current.ai || {}),
    rag: cloneJson(current.rag || {}),
    graph: cloneJson(current.graph || {}),
    cache: cloneJson(current.cache || {}),
    knowledge: cloneJson(current.knowledge || {}),
    timelineLinks: cloneJson(current.timelineLinks || {}),
    timezone: current.timezone || "",
    toolsRuntime: cloneJson(current.toolsRuntime || {}),
    subagents: cloneJson(current.subagents || {})
  };
}

function mergeSettingsDraft(base, patch) {
  const next = cloneJson(base || {});
  for (const [key, value] of Object.entries(patch || {})) {
    if (Array.isArray(value)) {
      next[key] = cloneJson(value);
      continue;
    }
    if (value && typeof value === "object") {
      next[key] = mergeSettingsDraft(next[key] && typeof next[key] === "object" ? next[key] : {}, value);
      continue;
    }
    if (value !== undefined && value !== "") {
      next[key] = value;
    }
  }
  return next;
}

function setSettingsSaveState(message, status = "saved") {
  const node = $("settingsSaveState");
  if (!node) return;
  node.textContent = message;
  node.dataset.state = status;
}

function applyAdvancedAiSettingsToForm() {
  const ai = state.settings?.ai || {};
  for (const agent of aiSettingAgents) {
    const values = ai[agent] || {};
    setInputValue(`ai_${agent}_temperature`, values.temperature);
    setInputValue(`ai_${agent}_maxTokens`, values.maxTokens);
    setInputValue(`ai_${agent}_timeoutMs`, values.timeoutMs);
    setInputValue(`ai_${agent}_topP`, values.topP);
    setInputValue(`ai_${agent}_frequencyPenalty`, values.frequencyPenalty);
    setInputValue(`ai_${agent}_presencePenalty`, values.presencePenalty);
    setInputValue(`ai_${agent}_seed`, values.seed ?? "");
  }
  setInputValue("ragContextRecordsLimit", state.settings?.rag?.contextRecordsLimit);
  setInputValue("ragChunkTextLimit", state.settings?.rag?.chunkTextLimit);
  setInputValue("ragPlannerExtraQueriesLimit", state.settings?.rag?.plannerExtraQueriesLimit);
  setInputValue("graphSearchLimit", state.settings?.graph?.searchLimit);
  setInputValue("graphContextLimit", state.settings?.graph?.contextLimit);
  setCheckboxValue("graphEnabled", state.settings?.graph?.enabled !== false);
  setCheckboxValue("graphExpandedForListQuestions", state.settings?.graph?.expandedForListQuestions !== false);
  setInputValue("knowledgeAgentLimit", state.settings?.knowledge?.agentLimit);
  setInputValue("knowledgeTopKSetting", state.settings?.knowledge?.topK);
  setInputValue("knowledgeChunkSize", state.settings?.knowledge?.chunkSize);
  setInputValue("toolsParallelLimit", state.settings?.toolsRuntime?.parallelLimit);
  setCheckboxValue("toolsEnabled", state.settings?.toolsRuntime?.enabled !== false);
  setCheckboxValue("toolsAlertAgentEnabled", state.settings?.toolsRuntime?.alertAgentEnabled !== false);
  setCheckboxValue("toolsSafetyPrecheckEnabled", state.settings?.toolsRuntime?.safetyPrecheckEnabled !== false);
  setCheckboxValue("cacheEnabled", state.settings?.cache?.enabled !== false);
  setInputValue("cacheProvider", state.settings?.cache?.provider || "memory");
  setInputValue("cacheMemoryMaxEntries", state.settings?.cache?.memoryMaxEntries || 10000);
  if ($("cacheRedisUrl")) {
    $("cacheRedisUrl").value = "";
    $("cacheRedisUrl").placeholder = state.settings?.cache?.redisUrl || "redis://default:password@host:6379";
  }
}

function readAiSettingsFromForm() {
  return Object.fromEntries(aiSettingAgents.map((agent) => [agent, {
    temperature: Number($(`ai_${agent}_temperature`)?.value || 0),
    maxTokens: Number($(`ai_${agent}_maxTokens`)?.value || 4096),
    timeoutMs: Number($(`ai_${agent}_timeoutMs`)?.value || 90_000),
    topP: Number($(`ai_${agent}_topP`)?.value || 1),
    frequencyPenalty: Number($(`ai_${agent}_frequencyPenalty`)?.value || 0),
    presencePenalty: Number($(`ai_${agent}_presencePenalty`)?.value || 0),
    seed: optionalNumberFromInput(`ai_${agent}_seed`)
  }]));
}

function enhanceAdvancedAiControls() {
  for (const agent of aiSettingAgents) {
    const grid = $(`ai_${agent}_timeoutMs`)?.closest(".compactSettingsGrid");
    if (!grid || grid.dataset.enhanced === "true") continue;
    grid.dataset.enhanced = "true";
    grid.append(
      advancedNumberLabel("Top P", `ai_${agent}_topP`, { min: 0, max: 1, step: 0.05 }),
      advancedNumberLabel("Frequency Penalty", `ai_${agent}_frequencyPenalty`, { min: -2, max: 2, step: 0.1 }),
      advancedNumberLabel("Presence Penalty", `ai_${agent}_presencePenalty`, { min: -2, max: 2, step: 0.1 }),
      advancedNumberLabel("Seed", `ai_${agent}_seed`, { step: 1, placeholder: "ריק = ללא seed" })
    );
  }
  enhanceParameterInfoControls();
}

function advancedNumberLabel(text, id, attrs = {}) {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) input.setAttribute(key, value);
  }
  label.append(input);
  return label;
}

function enhanceParameterInfoControls() {
  document.querySelectorAll(".advancedSettings .compactSettingsGrid label, .retrievalSettingsCard .compactSettingsGrid label, .dataQueryInfoCard .subagent-config-label").forEach((label) => {
    if (label.dataset.infoEnhanced === "true") return;
    const control = label.querySelector("input, select, textarea");
    if (!control?.id) return;
    const title = parameterLabelText(label, control);
    const explanation = parameterExplanation(control.id, title);
    if (!explanation) return;
    label.dataset.infoEnhanced = "true";

    const row = document.createElement("span");
    row.className = "parameterLabelRow";

    if (label.classList.contains("toggleLabel")) {
      row.append(control);
    }

    const text = document.createElement("span");
    text.className = "parameterLabelText";
    text.textContent = title;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "parameterInfoButton";
    button.setAttribute("aria-label", `מידע על ${title}`);
    button.setAttribute("aria-expanded", "false");
    button.textContent = "i";

    const info = document.createElement("span");
    info.className = "parameterInfoText";
    info.hidden = true;
    info.textContent = explanation;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = !info.hidden;
      info.hidden = isOpen;
      button.setAttribute("aria-expanded", String(!isOpen));
      label.classList.toggle("infoOpen", !isOpen);
    });

    row.append(text, button);
    removeDirectTextNodes(label);
    label.prepend(row);
    if (!label.classList.contains("toggleLabel")) label.append(control);
    label.append(info);
  });
}

function parameterLabelText(label, control) {
  const direct = [...label.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .join(" ");
  if (direct) return direct;
  return control.id
    .replace(/^ai_[^_]+_/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function removeDirectTextNodes(label) {
  [...label.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) node.remove();
  });
}

function parameterExplanation(id, title) {
  if (id.includes("_temperature")) return "קובע כמה התשובה תהיה יצירתית או צפויה. ערך נמוך נותן תשובות יציבות ומדויקות יותר; ערך גבוה נותן ניסוח מגוון יותר.";
  if (id.includes("_maxTokens")) return "מגביל את אורך התשובה שהמודל יכול לייצר. ערך גבוה מאפשר תשובה מפורטת יותר, אבל יכול לעלות יותר ולקחת יותר זמן.";
  if (id.includes("_timeoutMs")) return "כמה זמן המערכת תחכה לתשובת המודל לפני שהיא מחשיבה את הקריאה כתקועה. נמדד במילישניות.";
  if (id.includes("_topP")) return "מסנן את בחירת המילים של המודל לפי הסתברות. לרוב משאירים 1; ערך נמוך הופך את התשובה לצפויה יותר.";
  if (id.includes("_frequencyPenalty")) return "מפחית חזרה על מילים או ביטויים שכבר הופיעו הרבה. שימושי כשרואים תשובות שחוזרות על עצמן.";
  if (id.includes("_presencePenalty")) return "מעודד את המודל לפתוח נושאים חדשים במקום להישאר רק על אותם ביטויים. בפרויקט מקצועי לרוב משאירים קרוב ל-0.";
  if (id.includes("_seed")) return "מספר קבוע שמנסה להפוך תשובות לחזרתיות יותר באותם תנאים. לא כל מודל מבטיח דטרמיניזם מלא.";
  const explanations = {
    hybridCandidates: "כמה שורות כל חיפוש היברידי ראשי יבקש מ-Supabase. ערך גבוה מגדיל כיסוי, אך מוסיף זמן, עומס ועלות דירוג.",
    plannerCandidates: "כמה שורות תוחזרנה מכל שאילתת חיפוש נוספת שה-Knowledge Planner יוצר. הכמות הכוללת יכולה להיות מספר השאילתות כפול ערך זה.",
    alertCandidates: "כמה התראות סוכן Alerts יבקש מפונקציית החיפוש לפני סינון תאריכים וסיכום התוצאה.",
    rerankTopK: "כמה מהשורות שנמצאו יישארו לאחר דירוג הרלוונטיות. רק התוצאות המדורגות ביותר ממשיכות לשלבים הבאים.",
    ragContextRecordsLimit: "כמה מקורות אחרי החיפוש והדירוג ייכנסו בפועל לסוכן הראשי. יותר מקורות נותנים כיסוי רחב יותר אבל עלולים להעמיס.",
    ragChunkTextLimit: "כמה תווים מכל מקור ייכנסו לפרומפט. ערך גבוה נותן יותר הקשר מכל מקור, אבל מגדיל עלות וזמן.",
    ragPlannerExtraQueriesLimit: "כמה שאילתות נוספות Knowledge Planner רשאי להריץ מעבר לשאלה המקורית.",
    graphSearchLimit: "כמה קשרים/צמתים לחפש בגרף סביב תוצאות ה-RAG.",
    graphContextLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט.",
    graphEnabled: "כאשר פעיל, הצ׳אט משתמש בגרף הפרויקט כדי לזהות קשרים בין אירועים, ספקים, נושאים וסיכונים.",
    graphExpandedForListQuestions: "בשאלות כמו 'מי', 'מה עוד', או 'רשימה', מאפשר להכניס יותר קשרי גרף כדי לא לפספס מועמדים.",
    knowledgeAgentLimit: "כמה סוכני Knowledge Base מקומיים אפשר לבחור לשאלה אחת.",
    knowledgeTopKSetting: "כמה קטעי ידע מקומי יוחזרו מכל סוכן ידע שנבחר.",
    knowledgeChunkSize: "האורך המקסימלי של כל קטע ידע מקומי שנכנס לתכנון החיפוש.",
    toolsParallelLimit: "כמה כלי N8N אפשר להריץ במקביל באותה שאלה.",
    toolsEnabled: "כאשר כבוי, הצ׳אט לא יקרא לכלי N8N חיצוניים, אבל RAG ו-Graph עדיין יכולים לעבוד.",
    toolsAlertAgentEnabled: "כאשר פעיל, סוכן ההתראות יכול למשוך ולסכם נתונים מטבלת alerts.",
    toolsSafetyPrecheckEnabled: "כאשר פעיל, שאלות דחופות או בטיחותיות מפעילות בדיקה מוקדמת לפני שאר הכלים.",
    dqEnabled: "מפעיל או מכבה את סוכן השאילתות. כשכבוי הסוכן לא ירוץ כלל ולא יחזיר מדדים.",
    dqPlannerEnabled: "כשפעיל, מודל שפה (LLM) מתכנן את שאילתת הנתונים. כשכבוי נעשה שימוש במתכנן היוריסטי דטרמיניסטי בלבד, ללא קריאת מודל.",
    dqPlannerModel: "המודל שמתכנן את השאילתה. ברירת המחדל משתמשת במודל ה-Knowledge/Main של המערכת.",
    dqPlannerTimeoutMs: "כמה זמן לחכות לתשובת מתכנן ה-LLM לפני נפילה למתכנן ההיוריסטי. נמדד במילישניות.",
    dqMaxPlans: "מספר תוכניות השאילתה המקסימלי שהסוכן רשאי להריץ בשאלה אחת. מגביל עומס ועלות.",
    dqMaxRowsPerPlan: "מספר השורות המקסימלי שכל תוכנית שאילתה תמשוך מ-Supabase לפני חישוב מקומי.",
    dqTimeoutMsPerPlan: "כמה זמן לחכות לכל שאילתת Supabase בודדת לפני שמחשיבים אותה ככושלת. נמדד במילישניות.",
    dqTotalTimeoutMs: "תקרת זמן כוללת לכל תוכניות השאילתה יחד באותה ריצה. נמדד במילישניות.",
  };
  return explanations[id] || `הגדרה מתקדמת עבור ${title}.`;
}

function optionalNumberFromInput(id) {
  const value = $(id)?.value;
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function setInputValue(id, value) {
  const input = $(id);
  if (input && value !== undefined && value !== null) input.value = value;
}

function setCheckboxValue(id, checked) {
  const input = $(id);
  if (input) input.checked = Boolean(checked);
}

function readChatPromptFieldsFromSettingsForm() {
  const prompts = {};
  for (const [agentId, fieldId] of Object.entries(chatPromptFields)) {
    const field = $(fieldId);
    if (field) prompts[agentId] = field.value || "";
  }
  return prompts;
}

function renderSettingsSourceStatus() {
  const target = $("settingsSourceStatus");
  if (!target || !state.settings?.settingsStore) return;
  const store = state.settings.settingsStore;
  const source = store.secretSources || {};
  target.innerHTML = `
    <div class="settingsSourceRow">
      <strong>שמירת הגדרות</strong>
      <span class="${store.write?.ok || store.loadedFromSupabase ? "ok" : "error"}">${settingsStoreLabel(store)}</span>
    </div>
    <div class="settingsSourceGrid">
      <span>OpenRouter Key: <b>${secretSourceLabel(source.openRouterApiKey)}</b></span>
      <span>App DB URL: <b>${secretSourceLabel(source.supabaseUrl)}</b></span>
      <span>App DB Service Role: <b>${secretSourceLabel(source.supabaseServiceRoleKey)}</b></span>
      <span>Content DB URL: <b>${secretSourceLabel(source.contentSupabaseUrl)}</b></span>
      <span>Content DB Service Role: <b>${secretSourceLabel(source.contentSupabaseServiceRoleKey)}</b></span>
      <span>Content Key Role: <b>${escapeHtml(state.settings.contentSource?.keyRole || "")}</b></span>
      <span>Content RPC: <b>${escapeHtml(state.settings.contentSource?.hybridRpcName || "")}</b></span>
      <span>Content Tables: <b>${escapeHtml([state.settings.contentSource?.indexTable, state.settings.contentSource?.alertsTable].filter(Boolean).join(" / "))}</b></span>
      <span>קריאה אחרונה: <b>${store.read?.ok ? "תקינה" : "נכשלה"}</b></span>
    </div>
    ${store.write?.error ? `<small>${escapeHtml(store.write.error)}</small>` : ""}
  `;
}

function settingsStoreLabel(store) {
  if (store.write?.ok) return "נשמר ב-Supabase";
  if (store.loadedFromSupabase) return "נטען מ-Supabase";
  return "לא אומת שנשמר";
}

function secretSourceLabel(source) {
  return {
    supabase_settings: "Supabase agent_settings",
    runtime_settings: "Runtime cache",
    env: ".env / environment",
    app_supabase_fallback: "App DB fallback",
    missing: "חסר"
  }[source] || source || "לא ידוע";
}

function parseMultilineList(value) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadHistory() {
  const result = await api("/api/sessions");
  state.chatSessions = result.sessions || [];
  renderChatDrawer();
  $("historyList").innerHTML = "";
  if (!result.sessions.length) {
    $("historyList").textContent = "אין היסטוריה להצגה או ש-Supabase עדיין לא מוגדר.";
    return;
  }
  for (const session of result.sessions) {
    const item = document.createElement("button");
    item.className = "historyItem";
    const date = session.created_at ? new Date(session.created_at).toLocaleString("he-IL") : "";
    item.innerHTML = `
      <strong>${escapeHtml(session.user_message || "שיחה ללא כותרת")}</strong>
      <span>${escapeHtml(date)} · ${escapeHtml(session.status || "")}</span>
      <small>${escapeHtml(session.sessionId || session.session_id || "")}</small>
    `;
    item.addEventListener("click", async () => {
      const sessionId = session.sessionId || session.session_id;
      setCurrentSession(sessionId);
      await loadSessionMessages(sessionId);
      activateTab("chat");
    });
    $("historyList").append(item);
  }
}

async function loadRunHistory() {
  const listEl = $("runHistoryList");
  if (!listEl) return;
  try {
    const { runs } = await api("/api/run-history?limit=30");
    state.runHistory = runs || [];
    renderRunHistoryStrip(state.runHistory);
  } catch {
    listEl.innerHTML = '<div class="runHistoryEmpty">שגיאה בטעינת היסטוריה</div>';
  }
}

function renderRunHistoryStrip(runs) {
  const listEl = $("runHistoryList");
  if (!listEl) return;
  if (!runs.length) {
    listEl.innerHTML = '<div class="runHistoryEmpty">אין ריצות שמורות</div>';
    return;
  }
  listEl.innerHTML = "";
  for (const run of runs) {
    const hasError = (run.workflow_log?.nodes || []).some((n) => n.status === "error");
    const hasAiReport = Boolean(run.workflow_log?.ai_report);
    const item = document.createElement("div");
    const isBase = state.workflowCompare?.baseRun?.id === run.id;
    const isCompare = state.workflowCompare?.compareRun?.id === run.id;
    item.className = `runHistoryItem${hasError ? " hasError" : ""}${hasAiReport ? " hasAiReport" : ""}${isBase ? " compareBase" : ""}${isCompare ? " compareCurrent" : ""}`;
    item.dataset.runId = run.id;
    const time = run.created_at ? timeAgo(new Date(run.created_at)) : "";
    const msg = (run.user_message || "").slice(0, 60);
    const kindLabel = run.kind === "link_agent"
      ? "סוכן הקשרים"
      : run.kind === "project_insights_analysis"
        ? "דוח תובנות"
        : run.kind === "data_query"
          ? "סוכן שאילתות"
          : "צ׳אט";
    item.innerHTML = `
      <div class="rhTime">${escapeHtml(time)}</div>
      <div class="rhMsg">${escapeHtml(msg)}</div>
      <small>${escapeHtml(kindLabel)}</small>
      <div class="runHistoryCompareActions">
        <button type="button" data-compare-role="base">${isBase ? "Base *" : "Base"}</button>
        <button type="button" data-compare-role="compare">${isCompare ? "Compare *" : "Compare"}</button>
      </div>
      ${hasError ? '<div class="rhErr">⚠ שגיאה בריצה</div>' : ""}
      ${hasAiReport ? '<div class="rhAiReport">דוח AI</div>' : ""}
    `;
    item.querySelectorAll("[data-compare-role]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        setWorkflowCompareRole(run, button.dataset.compareRole);
      });
    });
    item.addEventListener("click", () => showHistoricalRun(run, item));
    listEl.append(item);
  }
}

function setWorkflowCompareRole(run, role) {
  if (!run?.workflow_log?.nodes?.length) {
    showToast("No workflow data for this run", "error");
    return;
  }
  if (role === "base") {
    state.workflowCompare.baseRun = run;
  } else {
    state.workflowCompare.compareRun = run;
    showHistoricalRun(run, null);
  }
  if (!state.workflowCompare.compareRun && state.lastWorkflow) {
    state.workflowCompare.compareRun = { workflow_log: state.lastWorkflow, id: state.currentWorkflowMessageId };
  }
  renderRunHistoryStrip(state.runHistory || []);
  renderWorkflow(state.workflowCompare.compareRun?.workflow_log || state.lastWorkflow);
}

function clearWorkflowCompare(shouldRender = true) {
  state.workflowCompare = { baseRun: null, compareRun: null, summary: null };
  renderWorkflowCompareSummary(null);
  if (state.runHistory?.length) renderRunHistoryStrip(state.runHistory);
  if (shouldRender) renderWorkflow(state.lastWorkflow);
}

function showHistoricalRun(run, itemEl) {
  document.querySelectorAll(".runHistoryItem.active").forEach((el) => el.classList.remove("active"));
  if (itemEl) itemEl.classList.add("active");

  const events = run.run_events || [];
  const liveRunList = $("liveRunList");
  const liveRunStatus = $("liveRunStatus");
  const fullLogView = $("fullLogView");

  state.runEvents = [];
  if (liveRunList) {
    liveRunList.innerHTML = "";
    liveRunList.hidden = false;
    for (const ev of events) {
      appendLiveRunEvent(ev);
    }
  }
  if (liveRunStatus) liveRunStatus.textContent = `היסטוריה · ${timeAgo(new Date(run.created_at))}`;
  if (fullLogView) { fullLogView.hidden = true; fullLogView.textContent = ""; }
  state.lastWorkflow = run.workflow_log || null;
  state.currentWorkflowMessageId = run.id || null;
  state.fullLogVisible = false;
  renderWorkflow(run.workflow_log || null);
  renderWorkflowAiReport(run.workflow_log?.ai_report || null);
}

async function runWorkflowAiReport() {
  const messageId = state.currentWorkflowMessageId;
  if (!messageId) {
    showToast("אין ריצה נבחרת לדוח AI", "error");
    return;
  }
  const button = $("runAiReport");
  const panel = $("workflowAiReport");
  const status = $("workflowAiReportStatus");
  const body = $("workflowAiReportBody");
  if (button) button.disabled = true;
  if (panel) panel.hidden = false;
  if (status) status.textContent = "מריץ סוכן QA...";
  if (body) body.innerHTML = '<div class="qaRunning">מריץ דוח AI על הלוג וזרימת העבודה...</div>';
  try {
    const result = await api(`/api/ai-report/${encodeURIComponent(messageId)}/run`, { method: "POST", body: {} });
    renderWorkflowAiReport(result.report || null);
    if (state.lastWorkflow && result.report) {
      state.lastWorkflow = { ...state.lastWorkflow, ai_report: result.report };
    }
    showToast("דוח AI הסתיים");
    await loadRunHistory();
  } catch (error) {
    if (body) body.innerHTML = `<div class="qaError">שגיאה: ${escapeHtml(error.message)}</div>`;
    if (status) status.textContent = "נכשל";
    showToast("דוח AI נכשל", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function renderWorkflowAiReport(reportEnvelope) {
  const panel = $("workflowAiReport");
  const status = $("workflowAiReportStatus");
  const body = $("workflowAiReportBody");
  if (!panel || !status || !body) return;
  if (!reportEnvelope) {
    panel.hidden = true;
    status.textContent = "ממתין להרצה";
    body.innerHTML = "";
    return;
  }
  const report = reportEnvelope.report || reportEnvelope;
  panel.hidden = false;
  status.textContent = reportEnvelope.generated_at
    ? `נוצר ${new Date(reportEnvelope.generated_at).toLocaleString("he-IL")}`
    : "דוח שמור";
  body.innerHTML = qaReportHtmlFull(report);
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.floor(min / 60);
  if (h < 24) return `לפני ${h} שעות`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}

async function loadSessionMessages(sessionId) {
  const result = await api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
  $("messages").innerHTML = "";
  $("chatWelcome")?.setAttribute("hidden", "");
  for (const row of result.messages) {
    if (row.user_message) addMessage(row.user_message, "user", { editable: true });
    if (row.ai_response) {
      const node = addMessage(row.ai_response, "assistant");
      attachAssistantActions(node, {
        messageId: row.id,
        answer: row.ai_response,
        question: row.user_message || "",
        sources: [],
        annotation: row.annotation || null
      });
    }
  }
  if (!result.messages.length) $("chatWelcome")?.removeAttribute("hidden");
}

function addMessage(text, role, options = {}) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  renderMessageContent(node, text, role);
  if (role === "user" && options.editable) attachUserActions(node, text);
  $("messages").append(node);
  node.scrollIntoView({ block: "end" });
  return node;
}

function renderMessageContent(node, text, role) {
  node.textContent = "";
  if (role !== "assistant") {
    const body = document.createElement("div");
    body.className = "messageBody";
    body.textContent = String(text || "");
    node.append(body);
    return;
  }
  const body = document.createElement("div");
  body.className = "messageBody";
  body.innerHTML = renderChatMarkdown(String(text || ""));
  node.append(body);
}

function renderChatMarkdown(value) {
  const codeBlocks = [];
  let text = String(value || "").replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code data-language="${escapeHtml(language || "text")}">${escapeHtml(code.trim())}</code></pre>`);
    return token;
  });
  text = escapeHtml(text);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
    const cleaned = cleanChatUrl(url).url;
    return cleaned ? `<a href="${escapeHtml(cleaned)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  text = text.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, prefix, rawUrl) => {
    const { url, suffix } = cleanChatUrl(rawUrl);
    return url ? `${prefix}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">פתיחת מקור</a>${escapeHtml(suffix)}` : `${prefix}${rawUrl}`;
  });
  text = text
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  const lines = text.split("\n");
  const output = [];
  let listType = "";
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const tableSeparator = lines[lineIndex + 1];
    if (line.includes("|") && /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(tableSeparator || "")) {
      if (listType) {
        output.push(`</${listType}>`);
        listType = "";
      }
      const headers = markdownTableCells(line);
      const rows = [];
      lineIndex += 2;
      while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
        rows.push(markdownTableCells(lines[lineIndex]));
        lineIndex += 1;
      }
      lineIndex -= 1;
      output.push(`<div class="messageTableWrap"><table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)/);
    const nextType = bullet ? "ul" : numbered ? "ol" : "";
    if (nextType) {
      if (listType !== nextType) {
        if (listType) output.push(`</${listType}>`);
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${bullet?.[1] || numbered?.[1]}</li>`);
      continue;
    }
    if (listType) {
      output.push(`</${listType}>`);
      listType = "";
    }
    if (!line.trim()) continue;
    if (/^@@CODE_BLOCK_\d+@@$/.test(line) || /^<(h[2-4]|blockquote|pre)/.test(line)) output.push(line);
    else output.push(`<p>${line}</p>`);
  }
  if (listType) output.push(`</${listType}>`);
  return output.join("").replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)] || "");
}

function markdownTableCells(line) {
  return String(line).trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function cleanChatUrl(rawUrl) {
  let url = String(rawUrl || "").trim();
  let suffix = "";
  while (/[.,;:!?]$/.test(url)) {
    suffix = url.slice(-1) + suffix;
    url = url.slice(0, -1);
  }
  if (url.endsWith(")") && countCharacters(url, "(") < countCharacters(url, ")")) {
    suffix = ")" + suffix;
    url = url.slice(0, -1);
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return { url: "", suffix: "" };
    return { url: parsed.href, suffix };
  } catch {
    return { url: "", suffix: "" };
  }
}

function countCharacters(value, character) {
  return [...String(value || "")].filter((item) => item === character).length;
}

function iconButton(label, svg) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "messageAction";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = svg;
  return button;
}

function attachUserActions(node, text) {
  const actions = document.createElement("div");
  actions.className = "messageActions";
  const edit = iconButton("ערוך הודעה", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>');
  edit.addEventListener("click", () => {
    $("messageInput").value = text;
    localStorage.setItem("bidocChatDraft", text);
    resizeChatInput();
    $("messageInput").focus();
  });
  actions.append(edit);
  node.append(actions);
}

function attachAssistantActions(node, { messageId, answer, question, annotation = null }) {
  const actions = document.createElement("div");
  actions.className = "messageActions";
  const copy = iconButton("העתק תשובה", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/></svg>');
  copy.addEventListener("click", async () => {
    await copyTextToClipboard(answer);
    showToast("התשובה הועתקה");
  });
  const retry = iconButton("צור תשובה מחדש", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>');
  retry.addEventListener("click", () => {
    $("messageInput").value = question;
    resizeChatInput();
    $("chatForm").requestSubmit($("sendMessage"));
  });
  actions.append(copy, retry);

  if (messageId) {
    const like = iconButton("תשובה מועילה", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3M14 9V5a3 3 0 0 0-3-3l-4 9v11h11a2 2 0 0 0 2-2l1-8a2 2 0 0 0-2-3Z"/></svg>');
    const dislike = iconButton("תשובה לא מועילה", '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3M10 15v4a3 3 0 0 0 3 3l4-9V2H6a2 2 0 0 0-2 2l-1 8a2 2 0 0 0 2 3Z"/></svg>');
    like.classList.toggle("active-like", annotation === "V");
    dislike.classList.toggle("active-dislike", annotation === "X");
    const vote = async (value) => {
      const activeClass = value === "V" ? "active-like" : "active-dislike";
      const next = (value === "V" ? like : dislike).classList.contains(activeClass) ? null : value;
      like.classList.toggle("active-like", next === "V");
      dislike.classList.toggle("active-dislike", next === "X");
      await api(`/api/messages/${encodeURIComponent(messageId)}/annotate`, { method: "POST", body: { annotation: next } }).catch(() => {
        showToast("לא ניתן היה לשמור את המשוב", "error");
      });
    };
    like.addEventListener("click", () => vote("V"));
    dislike.addEventListener("click", () => vote("X"));
    actions.append(like, dislike);
  }
  node.append(actions);
}

function normalizeSource(source, index) {
  const url = cleanChatUrl(typeof source === "string" ? source : source?.url || "").url;
  if (!url) return null;
  let hostname = "";
  try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return {
    url,
    title: source?.title || source?.label || source?.name || `מקור ${index + 1}`,
    type: source?.type || hostname || "מסמך"
  };
}

function renderSources(node, sources) {
  const normalized = (sources || []).map(normalizeSource).filter(Boolean);
  if (!normalized.length) return;
  const container = document.createElement("div");
  container.className = "sourceCards";
  container.setAttribute("aria-label", "מקורות לתשובה");
  normalized.slice(0, 6).forEach((source) => {
    const link = document.createElement("a");
    link.className = "sourceCard";
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = `<span>${escapeHtml(source.title)}</span><small>${escapeHtml(source.type)}</small>`;
    container.append(link);
  });
  node.append(container);
}

function defaultFollowUps(result) {
  if (result?.type === "CHAT") return [];
  return ["הצג רק נושאים שדורשים פעולה", "מה המקורות המרכזיים למסקנה?", "סכם את זה לעדכון הנהלה"];
}

function renderFollowUps(node, followUps) {
  if (!Array.isArray(followUps) || !followUps.length) return;
  const container = document.createElement("div");
  container.className = "sourceCards followUps";
  followUps.slice(0, 3).forEach((text) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sourceCard";
    button.textContent = String(text);
    button.addEventListener("click", () => {
      $("messageInput").value = String(text);
      resizeChatInput();
      $("messageInput").focus();
    });
    container.append(button);
  });
  node.append(container);
}

function renderCancelledMessage(node) {
  node.className = "message assistant";
  renderMessageContent(node, "היצירה נעצרה. התהליך בשרת עשוי להסתיים ברקע.", "assistant");
}

function renderChatError(node, error, message) {
  node.className = "message assistant errorMessage";
  node.innerHTML = `<div class="messageBody"><strong>לא הצלחתי להשלים את הבדיקה.</strong><p>${escapeHtml(error.message)}</p></div>`;
  const actions = document.createElement("div");
  actions.className = "messageErrorActions";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "נסה שוב";
  retry.addEventListener("click", () => {
    $("messageInput").value = message;
    resizeChatInput();
    $("chatForm").requestSubmit($("sendMessage"));
  });
  actions.append(retry);
  node.append(actions);
}

function attachAnnotation(node, messageId, current = null) {
  const bar = document.createElement("div");
  bar.className = "annotation-bar";
  const like = document.createElement("button");
  like.className = "annotation-btn" + (current === "V" ? " active-like" : "");
  like.title = "לייק";
  like.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
  const dislike = document.createElement("button");
  dislike.className = "annotation-btn" + (current === "X" ? " active-dislike" : "");
  dislike.title = "דיסלייק";
  dislike.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;
  async function vote(annotation) {
    const next = like.classList.contains("active-like") && annotation === "V" ? null
                : dislike.classList.contains("active-dislike") && annotation === "X" ? null
                : annotation;
    like.classList.toggle("active-like", next === "V");
    dislike.classList.toggle("active-dislike", next === "X");
    await api(`/api/messages/${encodeURIComponent(messageId)}/annotate`, {
      method: "POST", body: { annotation: next }
    }).catch(() => {});
  }
  like.addEventListener("click", () => vote("V"));
  dislike.addEventListener("click", () => vote("X"));
  bar.append(like, dislike);
  node.append(bar);
}

function showToast(message, type = "success") {
  const container = $("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.append(toast);
  setTimeout(() => {
    toast.classList.add("fadeOut");
    toast.addEventListener("animationend", () => toast.remove());
  }, 3000);
}

// ---- TIMELINE ---- (state declaration moved below)

function getTimelineInitialRange() {
  const fromInput = $("tlFromDate")?.value;
  const toInput = $("tlToDate")?.value;
  const now = new Date();
  const to = toInput ? new Date(toInput + "T23:59:59") : now;
  const from = fromInput ? new Date(fromInput + "T00:00:00") : new Date(new Date(to).setFullYear(to.getFullYear() - 5));
  return { from: from.toISOString(), to: to.toISOString() };
}

function getTimelineLoadLimit() {
  return Math.max(50, Math.min(5000, Number($("tlLimitInput")?.value) || 1000));
}

function initTimelineDateInputs() {
  const toInput = $("tlToDate");
  const fromInput = $("tlFromDate");
  if (!toInput || !fromInput) return;
  const now = new Date();
  if (!toInput.value) toInput.value = now.toISOString().slice(0, 10);
  if (!fromInput.value) {
    const fiveYearsAgo = new Date(now);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fromInput.value = fiveYearsAgo.toISOString().slice(0, 10);
  }
}

function timelineDebug(message, data = {}) {
  console.debug("[timeline]", message, data);
}

async function loadTimeline(options = {}) {
  const source = getActiveTimelineSource();
  const hasSourceEvents = timelineState.eventsBySource[source].length > 0;
  if (!options.force && !options.range && hasSourceEvents) {
    syncTimelineSourceState(source);
    renderTimelineFilters();
    renderTimeline();
    return true;
  }
  const range = options.range || getTimelineInitialRange();
  return runTimelineLoad({
    source,
    range,
    replace: options.replace ?? !hasSourceEvents,
    refreshRelated: options.refreshRelated ?? !timelineState.relatedLoadedSources.has(source),
    cursor: options.cursor || null,
    reason: options.reason || "initial"
  });
}

async function runTimelineLoad({ source, range, replace = false, refreshRelated = false, cursor = null, reason = "range", origins = getTimelineOriginsForSource(source) }) {
  abortActiveTimelineRequest();
  const requestId = ++timelineState.requestId;
  const requestOrigins = source === "index" ? normalizeTimelineOrigins(origins) : [];
  const canCommit = () => canCommitTimelineRequest(
    requestId,
    timelineState.requestId,
    source,
    getActiveTimelineSource(),
    requestOrigins,
    getTimelineOriginsForSource(getActiveTimelineSource())
  );
  const controller = new AbortController();
  timelineState.controller = controller;
  timelineState.loading = true;
  timelineState.loadingStartedAt = Date.now();
  timelineState.lastLoad = { source, range, replace, refreshRelated, cursor, reason, origins: requestOrigins };
  let timedOut = false;
  timelineState.timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort("timeout");
  }, 20_000);
  startTimelineLoadingStatus("טוען אירועים");
  updateTimelineSourceButtons();
  if (!timelineState.events.length) renderTimelineInitialSkeleton();

  try {
    const eventResult = await api(buildTimelineEventsUrl({
      source,
      from: range.from,
      to: range.to,
      limit: getTimelineLoadLimit(),
      cursor,
      sort: "desc",
      origins: requestOrigins
    }), { signal: controller.signal });
    if (!canCommit()) return false;

    const incoming = (eventResult.events || []).map((event) => ({ ...event, source }));
    timelineState.eventsBySource[source] = replace
      ? mergeTimelineEvents([], incoming)
      : mergeTimelineEvents(timelineState.eventsBySource[source], incoming);
    timelineState.events = timelineState.eventsBySource[source];
    timelineState.loadedRanges[source] = replace
      ? mergeTimelineRanges([], range)
      : mergeTimelineRanges(timelineState.loadedRanges[source], range);
    if (replace) {
      for (const key of timelineState.paginationByRange.keys()) {
        if (key.startsWith(`${source}|`)) timelineState.paginationByRange.delete(key);
      }
    }
    const rangeKey = timelineRangeKey(source, range, requestOrigins);
    timelineState.paginationByRange.set(rangeKey, {
      nextCursor: eventResult.page?.nextCursor || null,
      hasMore: Boolean(eventResult.page?.hasMore),
      range,
      source,
      origins: requestOrigins
    });
    timelineState.activeRangeKey = rangeKey;
    preserveTimelineSelection();
    initializeTimelineCalendar();
    renderTimelineFilters();
    renderTimeline();

    if (refreshRelated) {
      setTimelineLoadingStep("טוען קשרים");
      const linksResult = await loadTimelineLinks(source, controller.signal).catch((error) => {
        if (isTimelineAbortError(error) || isTimelineTimeoutError(error)) throw error;
        timelineDebug("links failed", { error: error.message });
        return null;
      });
      if (!canCommit()) return false;
      if (linksResult) timelineState.linksBySource[source] = linksResult.links || [];

      setTimelineLoadingStep("טוען הצעות");
      const suggestionsResult = await loadTimelineSuggestions(source, controller.signal).catch((error) => {
        if (isTimelineAbortError(error) || isTimelineTimeoutError(error)) throw error;
        timelineDebug("suggestions failed", { error: error.message });
        return null;
      });
      if (!canCommit()) return false;
      if (suggestionsResult) {
        timelineState.suggestionsBySource[source] = suggestionsResult.suggestions || [];
        timelineState.suggestionModesBySource[source] = suggestionsResult.mode || "rules";
      }
      timelineState.relatedLoadedSources.add(source);
    }

    setTimelineLoadingStep("מכין את התצוגה");
    syncTimelineSourceState(source);
    renderTimelineFilters();
    renderTimeline();
    finishTimelineLoading(requestId);
    return true;
  } catch (error) {
    if (!canCommit()) return false;
    if (timedOut || isTimelineTimeoutError(error)) {
      showTimelineLoadFailure("הטעינה נמשכה יותר מ־20 שניות.", "timeout");
    } else if (isTimelineAbortError(error)) {
      showTimelineCancelled();
    } else {
      console.error("Timeline error:", error);
      showTimelineLoadFailure(error.kind === "http"
        ? "השרת החזיר שגיאה בעת טעינת ציר הזמן."
        : "לא ניתן להתחבר לשרת ציר הזמן.", error.kind || "network");
    }
    return false;
  } finally {
    if (requestId === timelineState.requestId) clearTimelineRequestResources();
  }
}

async function loadTimelineLinks(source = getActiveTimelineSource(), signal) {
  return api(`/api/timeline/links?source=${encodeURIComponent(source)}`, { signal });
}

async function loadTimelineSuggestions(source = getActiveTimelineSource(), signal) {
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(source)}`, { signal });
}

async function loadSmartTimelineSuggestions() {
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(getActiveTimelineSource())}&smart=1`);
}

async function loadSmartTimelineSuggestionsForEvent(eventId, runId = "") {
  const runParam = runId ? `&runId=${encodeURIComponent(runId)}` : "";
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(getActiveTimelineSource())}&smart=1&eventId=${encodeURIComponent(eventId)}&limit=12${runParam}`);
}

async function refreshTimelineLinks({ rerender = true } = {}) {
  const source = getActiveTimelineSource();
  const result = await loadTimelineLinks();
  timelineState.linksBySource[source] = result.links || [];
  timelineState.links = timelineState.linksBySource[source];
  const suggestions = await loadTimelineSuggestions().catch(() => ({ suggestions: [] }));
  timelineState.suggestionsBySource[source] = suggestions.suggestions || [];
  timelineState.suggestions = timelineState.suggestionsBySource[source];
  timelineState.suggestionModesBySource[source] = suggestions.mode || "rules";
  timelineState.suggestionsLoaded = true;
  timelineState.suggestionsMode = suggestions.mode || "rules";
  timelineState.relatedLoadedSources.add(source);
  if (rerender) renderTimeline();
  return timelineState.links;
}

function getActiveTimelineSource() {
  return timelineState.source === "alerts" ? "alerts" : "index";
}

function getTimelineOriginsForSource(source = getActiveTimelineSource()) {
  return source === "index" ? normalizeTimelineOrigins(timelineState.activeOrigins) : [];
}

function getActiveTimelineOriginSignature() {
  return timelineOriginSignature(getTimelineOriginsForSource());
}

function syncTimelineSourceState(source = getActiveTimelineSource()) {
  timelineState.events = timelineState.eventsBySource[source] || [];
  timelineState.links = timelineState.linksBySource[source] || [];
  timelineState.suggestions = timelineState.suggestionsBySource[source] || [];
  timelineState.suggestionsLoaded = timelineState.relatedLoadedSources.has(source);
  timelineState.suggestionsMode = timelineState.suggestionModesBySource[source] || "rules";
  updateTimelineLoadMore();
}

function initializeTimelineCalendar() {
  if (timelineState.calYear !== null && timelineState.calMonth !== null) return;
  const newest = timelineState.events[0] ? new Date(timelineState.events[0].date) : new Date();
  timelineState.calYear = newest.getFullYear();
  timelineState.calMonth = newest.getMonth();
}

function preserveTimelineSelection() {
  if (!timelineState.selectedEventId) return;
  const exists = timelineState.events.some((event) => String(event.id) === String(timelineState.selectedEventId));
  if (!exists) timelineState.selectedEventId = null;
}

function updateTimelineSourceButtons() {
  document.querySelectorAll(".tlSrcBtn").forEach((button) => {
    const selected = button.dataset.src === timelineState.source;
    button.classList.toggle("active", selected);
    button.classList.toggle("loading", selected && timelineState.loading);
    button.setAttribute("aria-pressed", String(selected));
  });
  const refresh = $("refreshTimeline");
  if (refresh) refresh.disabled = timelineState.loading;
  updateTimelineOriginButtons();
}

function updateTimelineOriginButtons() {
  const container = $("timelineOriginFilters");
  if (!container) return;
  container.hidden = getActiveTimelineSource() !== "index";
  container.setAttribute("aria-busy", String(timelineState.loading));
  const selectedOrigins = new Set(getTimelineOriginsForSource("index"));
  container.querySelectorAll(".tlOriginBtn").forEach((button) => {
    const selected = button.dataset.origin === "all"
      ? selectedOrigins.size === 0
      : selectedOrigins.has(button.dataset.origin);
    button.classList.toggle("active", selected);
    button.classList.toggle("loading", selected && timelineState.loading);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function abortActiveTimelineRequest() {
  if (timelineState.controller && !timelineState.controller.signal.aborted) {
    timelineState.controller.abort("replaced");
  }
  clearTimelineRequestResources();
  timelineState.loading = false;
  $("timelineContainer")?.setAttribute("aria-busy", "false");
  updateTimelineSourceButtons();
}

function clearTimelineRequestResources() {
  if (timelineState.timeoutId) clearTimeout(timelineState.timeoutId);
  if (timelineState.loadingTimer) clearInterval(timelineState.loadingTimer);
  timelineState.timeoutId = null;
  timelineState.loadingTimer = null;
  timelineState.controller = null;
}

function startTimelineLoadingStatus(step) {
  timelineState.loadingStep = step;
  const status = $("timelineLoadStatus");
  if (!status) return;
  status.hidden = false;
  status.className = "timelineLoadStatus loading";
  status.setAttribute("aria-live", "polite");
  status.innerHTML = `
    <span class="timelineLoadSpinner" aria-hidden="true"></span>
    <span class="timelineLoadMessage" id="timelineLoadMessage"></span>
    <span class="timelineLoadElapsed" id="timelineLoadElapsed" aria-hidden="true"></span>
    <button type="button" class="timelineCancelBtn" id="timelineCancel" aria-label="ביטול טעינת ציר הזמן">ביטול</button>
  `;
  $("timelineCancel")?.addEventListener("click", cancelTimelineLoad);
  $("timelineContainer")?.setAttribute("aria-busy", "true");
  setTimelineLoadingStep(step);
  timelineState.loadingTimer = setInterval(updateTimelineElapsed, 1000);
}

function setTimelineLoadingStep(step) {
  timelineState.loadingStep = step;
  const message = $("timelineLoadMessage");
  if (message) message.textContent = step;
  updateTimelineElapsed();
}

function updateTimelineElapsed() {
  const elapsed = $("timelineLoadElapsed");
  if (!elapsed) return;
  const seconds = Math.max(0, Math.floor((Date.now() - timelineState.loadingStartedAt) / 1000));
  elapsed.textContent = `${seconds} שניות`;
}

function finishTimelineLoading(requestId) {
  if (requestId !== timelineState.requestId) return;
  timelineState.loading = false;
  const status = $("timelineLoadStatus");
  if (status) status.hidden = true;
  $("timelineContainer")?.setAttribute("aria-busy", "false");
  updateTimelineSourceButtons();
  updateTimelineLoadMore();
}

function showTimelineCancelled() {
  timelineState.loading = false;
  renderTimelineStatusMessage("הטעינה בוטלה.", "cancelled");
  updateTimelineSourceButtons();
}

function showTimelineLoadFailure(message, kind) {
  timelineState.loading = false;
  renderTimelineStatusMessage(message, `error ${kind}`);
  updateTimelineSourceButtons();
}

function renderTimelineStatusMessage(message, className) {
  const status = $("timelineLoadStatus");
  if (!status) return;
  status.hidden = false;
  status.className = `timelineLoadStatus ${className}`;
  status.innerHTML = `
    <span class="timelineLoadMessage">${escapeHtml(message)}</span>
    <button type="button" class="timelineRetryBtn" id="timelineRetry">נסה שוב</button>
  `;
  $("timelineContainer")?.setAttribute("aria-busy", "false");
  const retry = $("timelineRetry");
  retry?.addEventListener("click", retryTimelineLoad);
  retry?.focus();
}

function retryTimelineLoad() {
  if (!timelineState.lastLoad || timelineState.loading) return;
  runTimelineLoad(timelineState.lastLoad);
}

function cancelTimelineLoad() {
  if (!timelineState.loading) return;
  timelineState.requestId += 1;
  timelineState.controller?.abort("user");
  clearTimelineRequestResources();
  showTimelineCancelled();
  $("refreshTimeline")?.focus();
}

function renderTimelineInitialSkeleton() {
  const container = $("timelineContainer");
  if (!container || timelineState.events.length) return;
  container.innerHTML = `
    <div class="timelineSkeleton" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
  `;
}

async function ensureTimelineRange(range, { reason = "range" } = {}) {
  const source = getActiveTimelineSource();
  const origins = getTimelineOriginsForSource(source);
  if (isTimelineRangeCovered(timelineState.loadedRanges[source], range)) return true;
  const rangeKey = timelineRangeKey(source, range, origins);
  if (timelineState.pendingRangeKeys.has(rangeKey)) return false;
  timelineState.pendingRangeKeys.add(rangeKey);
  try {
    return await runTimelineLoad({
      source,
      range,
      replace: false,
      refreshRelated: false,
      cursor: null,
      reason,
      origins
    });
  } finally {
    timelineState.pendingRangeKeys.delete(rangeKey);
  }
}

async function loadMoreTimelineEvents() {
  if (timelineState.loading || !timelineState.activeRangeKey) return;
  const pagination = timelineState.paginationByRange.get(timelineState.activeRangeKey);
  if (!pagination?.hasMore || !pagination.nextCursor) return;
  await runTimelineLoad({
    source: pagination.source,
    range: pagination.range,
    replace: false,
    refreshRelated: false,
    cursor: pagination.nextCursor,
    reason: "pagination",
    origins: pagination.origins
  });
}

function updateTimelineLoadMore() {
  const bar = $("timelineLoadMoreBar");
  const button = $("timelineLoadMore");
  if (!bar || !button) return;
  const pagination = timelineState.activeRangeKey
    ? timelineState.paginationByRange.get(timelineState.activeRangeKey)
    : null;
  bar.hidden = !pagination?.hasMore;
  button.disabled = timelineState.loading;
  button.textContent = timelineState.loading && pagination?.hasMore ? "טוען..." : "טען עוד";
}

function timelineSourceHasMore(source = getActiveTimelineSource()) {
  const prefix = `${source}|${source === "index" ? getActiveTimelineOriginSignature() : "all"}|`;
  for (const [key, pagination] of timelineState.paginationByRange.entries()) {
    if (key.startsWith(prefix) && pagination?.hasMore) return true;
  }
  return false;
}

function initializeTimelineSearchController() {
  if (timelineState.searchController) timelineState.searchController.dispose();
  timelineState.searchController = createTimelineSearchController({
    delay: 250,
    onPending(pending) {
      timelineState.searchPending = pending;
      updateTimelineCount();
    },
    onApply(value) {
      timelineState.searchQuery = value;
      timelineState.searchPending = false;
      renderTimeline();
    }
  });
}

function scheduleTimelineSearch(value) {
  timelineState.searchController?.schedule(value);
}

function clearTimelineSearch({ resetInput = false } = {}) {
  timelineState.searchController?.dispose();
  timelineState.searchPending = false;
  timelineState.searchQuery = "";
  if (resetInput) {
    const input = $("timelineSearch");
    if (input) input.value = "";
  }
}

function failTimelineAction(error) {
  console.error("Timeline UI action failed:", error);
  timelineState.loading = false;
  clearTimelineRequestResources();
  $("timelineContainer")?.setAttribute("aria-busy", "false");
  updateTimelineSourceButtons();
  renderTimelineStatusMessage("אירעה תקלה בפעולת ציר הזמן.", "error action");
}

function reconcileTimelineSelection(events) {
  if (!timelineState.selectedEventId) return;
  const exists = events.some((event) => String(event.id) === String(timelineState.selectedEventId));
  if (!exists) timelineState.selectedEventId = null;
}

function scrollTimelineDetailIntoViewIfNeeded(panel) {
  const rect = panel.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const offscreenTop = rect.top < 0;
  const offscreenBottom = rect.bottom > viewportHeight;
  if (offscreenTop || offscreenBottom) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const absoluteTop = window.scrollY + rect.top;
    const topOffset = 16;
    const targetTop = Math.max(0, absoluteTop - topOffset);
    window.scrollTo({ top: targetTop, behavior: reducedMotion ? "auto" : "smooth" });
  }
}

function isTimelineDropdownOpen(name) {
  return timelineState.openDropdown === name;
}

function setTimelineDropdownState(name, open, { focusTrigger = false } = {}) {
  timelineState.openDropdown = open ? name : null;
  if (open) timelineState.lastDropdownTriggerId = name === "tags" ? "tlTagsBtn" : "tlFieldsBtn";
  const tagsBtn = $("tlTagsBtn");
  const tagsDropdown = $("tlTagsDropdown");
  const fieldsBtn = $("tlFieldsBtn");
  const fieldsDropdown = $("tlFieldsPicker");
  if (tagsBtn && tagsDropdown) {
    const isOpen = open && name === "tags";
    tagsBtn.classList.toggle("open", isOpen);
    tagsBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    tagsDropdown.hidden = !isOpen;
  }
  if (fieldsBtn && fieldsDropdown) {
    const isOpen = open && name === "fields";
    fieldsBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    fieldsDropdown.hidden = !isOpen;
  }
  if (!open && focusTrigger) $(timelineState.lastDropdownTriggerId)?.focus();
}

function closeTimelineDropdowns(options = {}) {
  setTimelineDropdownState("", false, options);
}

function bindTimelineDropdownListeners() {
  const timeline = $("timeline");
  timeline?.addEventListener("click", (event) => {
    const tagsBtn = event.target.closest("#tlTagsBtn");
    if (tagsBtn) {
      event.stopPropagation();
      setTimelineDropdownState("tags", !isTimelineDropdownOpen("tags"));
      return;
    }
    const fieldsBtn = event.target.closest("#tlFieldsBtn");
    if (fieldsBtn) {
      event.stopPropagation();
      setTimelineDropdownState("fields", !isTimelineDropdownOpen("fields"));
      return;
    }
  });
  document.addEventListener("click", (event) => {
    if (!timelineState.openDropdown) return;
    if (event.target.closest(".tlTagsDropdownWrap") || event.target.closest(".tlFieldsPicker") || event.target.closest(".tlFieldsBtn")) return;
    closeTimelineDropdowns();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !timelineState.openDropdown) return;
    event.preventDefault();
    closeTimelineDropdowns({ focusTrigger: true });
  });
}

function requestAdjacentTimelineRange(direction) {
  const source = getActiveTimelineSource();
  const ranges = mergeTimelineRanges(timelineState.loadedRanges[source]);
  if (!ranges.length || timelineState.loading) return;
  const boundaryRange = direction === "before" ? ranges[0] : ranges.at(-1);
  const duration = getTimelineWindowMs(timelineState.resolution);
  const range = adjacentTimelineRange(boundaryRange, direction, duration);
  ensureTimelineRange(range, { reason: `viewport-${direction}` });
}

function renderTimelineFilters() {
  const allTags = [...new Set(timelineState.events.flatMap((e) => e.tags))].sort();
  const bar = $("timelineFilters");
  if (!bar) return;
  bar.innerHTML = "";
  if (!allTags.length) return;
  const clearBtn = Object.assign(document.createElement("button"), {
    className: "tagChip" + (timelineState.activeTags.size === 0 ? " active" : ""),
    textContent: "הכל"
  });
  clearBtn.type = "button";
  clearBtn.addEventListener("click", () => { timelineState.activeTags.clear(); renderTimelineFilters(); renderTimeline(); });
  bar.appendChild(clearBtn);
  for (const tag of allTags) {
    const isAlerts = timelineState.source === "alerts";
    const color = isAlerts ? getTagColor(tag) : null;
    const btn = Object.assign(document.createElement("button"), {
      className: "tagChip" + (timelineState.activeTags.has(tag) ? " active" : "") + (isAlerts ? " tagChipColored" : ""),
      textContent: tag
    });
    btn.type = "button";
    if (color) {
      btn.style.setProperty("--chip-color", color);
      if (timelineState.activeTags.has(tag)) {
        btn.style.background = color;
        btn.style.borderColor = color;
        btn.style.color = "#fff";
      }
    }
    btn.addEventListener("click", () => {
      if (timelineState.activeTags.has(tag)) timelineState.activeTags.delete(tag);
      else timelineState.activeTags.add(tag);
      renderTimelineFilters(); renderTimeline();
    });
    bar.appendChild(btn);
  }
  if (isTimelineDropdownOpen("tags")) setTimelineDropdownState("tags", true);
}

function renderTimeline() {
  applyTimelineResponsiveState();
  if (timelineState.resolution === "cal") renderCalendar();
  else renderFuturisticTimeline();
  updateTimelineCount();
  updateTimelineLoadMore();
}

function getTimelineResponsiveWidth() {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const panelWidth = $("timeline")?.getBoundingClientRect?.().width || 0;
  const containerWidth = $("timelineContainer")?.getBoundingClientRect?.().width || 0;
  const contentWidth = Math.max(panelWidth, containerWidth, 0);
  return contentWidth > 0 ? Math.min(viewportWidth, contentWidth) : viewportWidth;
}

function getTimelineViewportKind() {
  const width = getTimelineResponsiveWidth();
  if (width <= 375) return "phone-narrow";
  if (width <= 768) return "phone-compact";
  if (width <= 980) return "tablet-stacked";
  return "desktop";
}

function getTimelineGraphMode() {
  if (timelineState.resolution === "cal") return "hidden";
  const kind = getTimelineViewportKind();
  if (kind === "phone-narrow") return "hidden";
  if (kind === "phone-compact") return "compact";
  if (kind === "tablet-stacked") return "secondary";
  return "full";
}

function getTimelineResponsiveSnapshot() {
  return {
    viewport: getTimelineViewportKind(),
    graphMode: getTimelineGraphMode()
  };
}

function isTimelineAdvancedControlsOpen() {
  if (typeof timelineState.advancedControlsOpen === "boolean") return timelineState.advancedControlsOpen;
  return getTimelineViewportKind() === "desktop" || getTimelineViewportKind() === "tablet-stacked";
}

function isTimelineAiCollapsed() {
  if (typeof timelineState.aiCollapsed === "boolean") return timelineState.aiCollapsed;
  return getTimelineViewportKind() !== "desktop";
}

function setTimelineAdvancedControls(open) {
  timelineState.advancedControlsOpen = open;
  const container = $("timelineAdvancedControls");
  const button = $("tlAdvancedToggle");
  if (container) container.hidden = !open;
  if (button) button.setAttribute("aria-expanded", String(open));
}

function setTimelineAiCollapsed(collapsed) {
  timelineState.aiCollapsed = collapsed;
  const panel = $("tlAiPanel");
  const button = panel?.querySelector(".tlAiCollapseBtn");
  if (panel) panel.dataset.collapsed = collapsed ? "true" : "false";
  if (button) {
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? "ניתוח AI ▸" : "ניתוח AI ▾";
  }
}

function applyTimelineResponsiveState() {
  const panel = $("timeline");
  if (!panel) return;
  panel.dataset.viewport = getTimelineViewportKind();
  panel.dataset.mobileGraph = getTimelineGraphMode();
  panel.dataset.advancedOpen = isTimelineAdvancedControlsOpen() ? "true" : "false";
  panel.dataset.aiCollapsed = isTimelineAiCollapsed() ? "true" : "false";
  setTimelineAdvancedControls(isTimelineAdvancedControlsOpen());
}

function getFilteredTimelineEvents() {
  const query = timelineState.searchQuery;
  return timelineState.events.filter((event) => {
    const matchesTags = !timelineState.activeTags.size || event.tags.some((tag) => timelineState.activeTags.has(tag));
    if (!matchesTags) return false;
    return timelineEventMatchesQuery(event, query);
  });
}

function updateTimelineCount() {
  const countEl = $("timelineCount");
  if (!countEl) return;
  const versionLabel = ` · ${TIMELINE_UI_VERSION}`;
  if (timelineState.searchPending) {
    countEl.textContent = `מחפש...${versionLabel}`;
    return;
  }
  const totalEvents = timelineState.events.length;
  const filteredEvents = getFilteredTimelineEvents().length;
  const hasAdditionalPages = timelineSourceHasMore();
  const baseLabel = timelineState.searchQuery
    ? `${filteredEvents} מתוך ${totalEvents} אירועים`
    : `${totalEvents} אירועים`;
  const scopedLabel = hasAdditionalPages ? `${baseLabel} · החיפוש חל על הנתונים שנטענו בלבד` : baseLabel;
  countEl.textContent = `${scopedLabel}${versionLabel}`;
  return;
  if (timelineState.searchPending) {
    countEl.textContent = "מחפש...";
    return;
  }
  const total = timelineState.events.length;
  const filtered = getFilteredTimelineEvents().length;
  const hasMore = timelineSourceHasMore();
  const base = timelineState.searchQuery
    ? `${filtered} מתוך ${total} אירועים`
    : `${total} אירועים`;
  countEl.textContent = hasMore ? `${base} · החיפוש חל על הנתונים שנטענו בלבד` : base;
}

function renderFuturisticTimeline() {
  const container = $("timelineContainer");
  const filtered = getFilteredTimelineEvents();

  container.innerHTML = "";
  if (!filtered.length) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#2e4050;font-size:13px;">אין אירועים להצגה</div>';
    return;
  }

  const dates = filtered.map(e => new Date(e.date)).filter(d => !isNaN(d));
  if (!dates.length) return;
  const viewport = getTimelineViewport(dates);
  const visibleEvents = filterEventsByDateRange(filtered, viewport.start, viewport.end);
  const buckets = buildTimelineBuckets(viewport.start, viewport.end, timelineState.resolution);
  timelineDebug("render", {
    resolution: timelineState.resolution,
    totalEvents: filtered.length,
    visibleEvents: visibleEvents.length,
    viewportStart: viewport.start.toISOString(),
    viewportEnd: viewport.end.toISOString()
  });

  const dark = document.createElement("div");
  dark.className = "tlDark";
  dark.appendChild(buildTimelineGraphRegion(visibleEvents, buckets, filtered, viewport));
  dark.appendChild(buildPanelsLayer(visibleEvents));
  container.appendChild(dark);

  reconcileTimelineSelection(filtered);
  const selected = timelineState.selectedEventId
    ? visibleEvents.find(e => e.id === timelineState.selectedEventId)
    : (!timelineState.searchQuery && !timelineState.activeTags.size
      ? visibleEvents[Math.min(visibleEvents.length - 1, Math.floor(visibleEvents.length * 0.58))]
      : null);
  if (selected) selectTlEvent(selected, false);
}

function buildTimelineGraphRegion(visibleEvents, buckets, filtered, viewport) {
  const region = document.createElement("section");
  region.className = "tlGraphRegion";
  region.dataset.mode = getTimelineGraphMode();
  region.setAttribute("aria-label", "תצוגת ציר זמן גרפית");
  if (region.dataset.mode === "hidden") {
    const note = document.createElement("div");
    note.className = "tlGraphMobileNote";
    note.textContent = "במסך צר הרשימה והלוח קודמים לגרף. הגרף זמין בתצוגה רחבה יותר.";
    region.appendChild(note);
    return region;
  }
  region.appendChild(buildWaveLayer(visibleEvents, buckets, viewport.start, viewport.end));
  region.appendChild(buildStripLayer(filtered, viewport));
  return region;
}

function getTimelineViewport(dates) {
  const minMs = Math.min(...dates.map(d => d.getTime()));
  const maxMs = Math.max(...dates.map(d => d.getTime()));
  const fullStart = startOfDay(new Date(minMs));
  const fullEnd = endOfDay(new Date(maxMs));
  const totalMs = Math.max(1, fullEnd - fullStart);
  const windowMs = Math.min(totalMs, getTimelineWindowMs(timelineState.resolution));
  const maxOffsetMs = Math.max(0, totalMs - windowMs);
  if (timelineState.viewportStart === null || !Number.isFinite(timelineState.viewportStart)) {
    timelineState.viewportStart = 1;
  }
  timelineState.viewportStart = clamp(timelineState.viewportStart, 0, 1);
  const offsetMs = maxOffsetMs * timelineState.viewportStart;
  const start = new Date(fullStart.getTime() + offsetMs);
  const end = new Date(start.getTime() + windowMs);
  return {
    fullStart,
    fullEnd,
    start,
    end,
    totalMs,
    windowMs,
    windowLeftPct: maxOffsetMs ? (offsetMs / totalMs) * 100 : 0,
    windowWidthPct: Math.min(100, (windowMs / totalMs) * 100)
  };
}

function getTimelineWindowMs(resolution) {
  const DAY = 86400000;
  if (resolution === "day") return 14 * DAY;
  if (resolution === "week") return 12 * 7 * DAY;
  return 12 * 31 * DAY;
}

function filterEventsByDateRange(events, start, end) {
  return events.filter((event) => {
    const date = new Date(event.date);
    return !isNaN(date) && date >= start && date <= end;
  });
}

function buildTimelineBuckets(start, end, resolution) {
  const buckets = [];
  const cursor = startOfBucket(start, resolution);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = addBucket(bucketStart, resolution);
    buckets.push({ start: bucketStart, end: bucketEnd, label: formatTimelineBucketLabel(bucketStart, resolution) });
    cursor.setTime(bucketEnd.getTime());
  }
  if (!buckets.length) buckets.push({ start: new Date(start), end: new Date(end), label: formatTimelineBucketLabel(start, resolution) });
  return buckets;
}

function startOfBucket(date, resolution) {
  const d = startOfDay(date);
  if (resolution === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (resolution === "week") {
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  return d;
}

function addBucket(date, resolution) {
  const next = new Date(date);
  if (resolution === "month") next.setMonth(next.getMonth() + 1);
  else if (resolution === "week") next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + 1);
  return next;
}

function formatTimelineBucketLabel(date, resolution) {
  if (resolution === "month") return date.toLocaleDateString("he-IL", { month: "short" });
  if (resolution === "week") return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

function findTimelineBucketIndex(buckets, date) {
  return buckets.findIndex(bucket => date >= bucket.start && date < bucket.end);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildWaveLayer(events, buckets, minDate, maxDate) {
  const wrap = document.createElement("div");
  wrap.className = "tlWave";
  const NS = "http://www.w3.org/2000/svg";
  const VW = 1000, VH = 220;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "tlWaveSvg");

  // Per-bucket color computation (for spectrum gradient)
  const _bcMap = new Map();
  for (const ev of events) {
    const d = new Date(ev.date);
    const i = findTimelineBucketIndex(buckets, d);
    if (i >= 0) { if (!_bcMap.has(i)) _bcMap.set(i,[]); _bcMap.get(i).push(ev); }
  }
  const bucketColors = buckets.map((_,i) => mixEventColors(_bcMap.get(i) || []));

  // Defs
  const defs = document.createElementNS(NS, "defs");

  // Horizontal spectrum gradient
  const specGrad = document.createElementNS(NS,"linearGradient");
  specGrad.setAttribute("id","tlSpec"); specGrad.setAttribute("gradientUnits","userSpaceOnUse");
  specGrad.setAttribute("x1","0"); specGrad.setAttribute("y1","0");
  specGrad.setAttribute("x2",VW); specGrad.setAttribute("y2","0");
  bucketColors.forEach((color,i) => {
    const s = document.createElementNS(NS,"stop");
    s.setAttribute("offset",`${((i+0.5)/buckets.length*100).toFixed(1)}%`);
    s.setAttribute("stop-color",color);
    specGrad.appendChild(s);
  });

  // Vertical fade mask (preserves the wave silhouette)
  const fadeMG = document.createElementNS(NS,"linearGradient");
  fadeMG.setAttribute("id","tlFadeM"); fadeMG.setAttribute("x1","0"); fadeMG.setAttribute("y1","0");
  fadeMG.setAttribute("x2","0"); fadeMG.setAttribute("y2","1");
  [{o:"0%",a:.38},{o:"55%",a:.16},{o:"100%",a:0}].forEach(({o,a}) => {
    const s = document.createElementNS(NS,"stop");
    s.setAttribute("offset",o); s.setAttribute("stop-color","white"); s.setAttribute("stop-opacity",a);
    fadeMG.appendChild(s);
  });
  const fadeMask = document.createElementNS(NS,"mask"); fadeMask.setAttribute("id","tlVM");
  const fadeR = document.createElementNS(NS,"rect"); fadeR.setAttribute("width",VW); fadeR.setAttribute("height",VH);
  fadeR.setAttribute("fill","url(#tlFadeM)"); fadeMask.appendChild(fadeR);

  const filt = document.createElementNS(NS, "filter");
  filt.setAttribute("id","tlGlow"); filt.setAttribute("x","-20%"); filt.setAttribute("y","-20%");
  filt.setAttribute("width","140%"); filt.setAttribute("height","140%");
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation","3"); blur.setAttribute("result","b");
  const merge = document.createElementNS(NS, "feMerge");
  ["b","SourceGraphic"].forEach(v => { const n = document.createElementNS(NS,"feMergeNode"); n.setAttribute("in",v); merge.appendChild(n); });
  filt.appendChild(blur); filt.appendChild(merge);
  [specGrad, fadeMG, fadeMask, filt].forEach(n => defs.appendChild(n));
  svg.appendChild(defs);

  // Background + grid
  const bg = document.createElementNS(NS,"rect"); bg.setAttribute("width",VW); bg.setAttribute("height",VH); bg.setAttribute("fill","#080b14"); svg.appendChild(bg);
  for (let i = 0; i <= buckets.length; i++) {
    const x = (i / buckets.length) * VW;
    const g = document.createElementNS(NS,"line"); g.setAttribute("x1",x); g.setAttribute("y1",25); g.setAttribute("x2",x); g.setAttribute("y2",VH-20); g.setAttribute("stroke","rgba(255,255,255,.04)"); g.setAttribute("stroke-width","0.5"); svg.appendChild(g);
  }

  // Density wave
  const dens = buckets.map(() => 0);
  for (const ev of events) {
    const d = new Date(ev.date);
    const i = findTimelineBucketIndex(buckets, d);
    if (i >= 0) dens[i]++;
  }
  const maxD = Math.max(...dens, 1);
  const norm = dens.map(d => d / maxD);
  const BASE = VH - 32, AMP = VH * 0.56;

  const wpts = norm.map((v, i) => ({ x: ((i + 0.5) / buckets.length) * VW, y: BASE - v * AMP }));
  const allPts = [{ x: 0, y: BASE }, ...wpts, { x: VW, y: BASE }];
  const pd = catmullRom(allPts);

  // Spectrum analyzer bars — one per bucket, colored + fading downward
  const barW = VW / buckets.length;
  for (let i = 0; i < buckets.length; i++) {
    const density = norm[i] || 0;
    if (density < 0.015) continue;
    const color = bucketColors[i];
    const barH = density * AMP;
    const barX = i * barW;
    const barY = BASE - barH;
    const gid = `tlBG_${i}`;
    const bg = document.createElementNS(NS,"linearGradient");
    bg.setAttribute("id",gid); bg.setAttribute("gradientUnits","userSpaceOnUse");
    bg.setAttribute("x1","0"); bg.setAttribute("y1",barY);
    bg.setAttribute("x2","0"); bg.setAttribute("y2",BASE);
    [{o:"0%",a:.75},{o:"60%",a:.28},{o:"100%",a:.03}].forEach(({o,a}) => {
      const s = document.createElementNS(NS,"stop");
      s.setAttribute("offset",o); s.setAttribute("stop-color",color); s.setAttribute("stop-opacity",a);
      bg.appendChild(s);
    });
    defs.appendChild(bg);
    const bar = document.createElementNS(NS,"rect");
    bar.setAttribute("x", barX + 1.5);
    bar.setAttribute("y", barY);
    bar.setAttribute("width", Math.max(1, barW - 3));
    bar.setAttribute("height", barH);
    bar.setAttribute("fill", `url(#${gid})`);
    bar.setAttribute("rx","2");
    svg.appendChild(bar);
  }

  // Smooth wave silhouette (low opacity, ties everything together)
  const fill = document.createElementNS(NS,"path"); fill.setAttribute("d", pd + ` L${VW},${VH} L0,${VH} Z`); fill.setAttribute("fill","url(#tlSpec)"); fill.setAttribute("opacity","0.08"); svg.appendChild(fill);

  // Glowing stroke
  const stroke = document.createElementNS(NS,"path"); stroke.setAttribute("d",pd); stroke.setAttribute("fill","none"); stroke.setAttribute("stroke","url(#tlSpec)"); stroke.setAttribute("stroke-width","1.8"); stroke.setAttribute("opacity","0.9"); stroke.setAttribute("filter","url(#tlGlow)"); svg.appendChild(stroke);
  const hl = document.createElementNS(NS,"line"); hl.setAttribute("x1",0); hl.setAttribute("y1",BASE); hl.setAttribute("x2",VW); hl.setAttribute("y2",BASE); hl.setAttribute("stroke","rgba(255,255,255,.05)"); hl.setAttribute("stroke-width","0.5"); hl.setAttribute("stroke-dasharray","4 4"); svg.appendChild(hl);
  wrap.appendChild(svg);

  // Year badge
  const yr = document.createElement("div"); yr.className = "tlYearBadge";
  yr.textContent = minDate.getFullYear() === maxDate.getFullYear() ? String(minDate.getFullYear()) : `${minDate.getFullYear()} – ${maxDate.getFullYear()}`;
  wrap.appendChild(yr);

  // Month labels
  const bar = document.createElement("div"); bar.className = "tlMonthBar";
  buckets.forEach(bucket => { const l = document.createElement("div"); l.className = "tlMonthTick"; l.textContent = bucket.label; bar.appendChild(l); });
  wrap.appendChild(bar);

  // Event nodes — cluster by active resolution bucket
  const nodesWrap = document.createElement("div"); nodesWrap.className = "tlNodes";
  const byBucket = new Map();
  for (const ev of events) {
    const d = new Date(ev.date);
    const i = findTimelineBucketIndex(buckets, d);
    if (i < 0) continue;
    if (!byBucket.has(i)) byBucket.set(i, []); byBucket.get(i).push(ev);
  }
  for (const [bucketIndex, evs] of byBucket) {
    const bucket = buckets[bucketIndex];
    if (!bucket) continue;
    const density = norm[bucketIndex] ?? 0;
    const waveYpct = ((BASE - density * AMP) / VH) * 100;
    const xBase = ((bucketIndex + 0.5) / buckets.length) * 100;
    const show = evs.length > 6 ? evs.slice(0, 1) : evs.slice(0, 4);
    const isCluster = evs.length > 6;
    for (let k2 = 0; k2 < show.length; k2++) {
      const ev = show[k2];
      const type = classifyEvent(ev);
      const spread = show.length > 1 ? ((k2 / (show.length - 1)) - 0.5) * (0.75 / buckets.length) * 100 : 0;
      const xPct = xBase + spread;
      const yPct = waveYpct - 9 - (k2 % 2) * 4;
      const node = document.createElement("div");
      node.className = `tlNode ${timelineTypeClass(type)}` + (isCluster ? " tlCluster" : "");
      if (!isCluster && timelineHasSuggestions(ev)) node.classList.add("tlHasSuggestion");
      node.style.left = `${xPct}%`; node.style.top = `${yPct}%`;
      if (isCluster) {
        buildClusterPieNode(node, evs);
      } else {
        applyNodeColor(node, type);
        node.textContent = getEventIcon(type);
      }
      node.dataset.eventId = isCluster ? "" : ev.id;
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      const nodeLabel = isCluster ? `${evs.length} אירועים ב${bucket.label}` : ((ev.content || "").slice(0, 60) || ev.tags.join(", ") || "אירוע");
      node.setAttribute("aria-label", nodeLabel);
      const handler = () => {
        if (!isCluster) {
          selectTlEvent(ev, true, { source: "graph" });
          return;
        }
        const activeClusterEvent = getTimelineTooltipActiveEvent(node, evs) || evs[0];
        selectTlEvent(activeClusterEvent, true, { source: "graph" });
      };
      node.addEventListener("mouseenter", () => showTimelineNodeTooltip(node, isCluster ? evs : [ev]));
      node.addEventListener("mouseleave", hideTimelineNodeTooltip);
      node.addEventListener("focus", () => showTimelineNodeTooltip(node, isCluster ? evs : [ev]));
      node.addEventListener("blur", hideTimelineNodeTooltip);
      node.addEventListener("wheel", (event) => {
        if ((isCluster ? evs.length : 1) < 2) return;
        event.preventDefault();
        showTimelineNodeTooltip(node, evs);
        cycleTimelineNodeTooltip(event.deltaY > 0 ? 1 : -1);
      }, { passive: false });
      node.addEventListener("click", handler);
      node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); } });
      nodesWrap.appendChild(node);
      // connector line
      const line = document.createElement("div"); line.className = "tlNodeLine";
      line.style.left = `${xPct}%`; line.style.top = `${waveYpct}%`;
      line.style.height = `${Math.max(0, yPct - waveYpct) + 9}%`;
      line.style.color = getTypeColor(type);
      nodesWrap.appendChild(line);
    }
  }
  wrap.appendChild(nodesWrap);
  return wrap;
}

function buildStripLayer(events, viewport) {
  const strip = document.createElement("div"); strip.className = "tlStrip";
  const inner = document.createElement("div"); inner.className = "tlStripInner";
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS,"svg"); svg.setAttribute("class","tlStripSvg"); svg.setAttribute("viewBox","0 0 1000 48"); svg.setAttribute("preserveAspectRatio","none");
  const bg = document.createElementNS(NS,"rect"); bg.setAttribute("width","1000"); bg.setAttribute("height","48"); bg.setAttribute("fill","#050709"); svg.appendChild(bg);
  const buckets = buildTimelineBuckets(viewport.fullStart, viewport.fullEnd, timelineState.resolution);
  const dens = buckets.map(() => 0);
  for (const ev of events) { const d = new Date(ev.date); if (isNaN(d)) continue; const i = findTimelineBucketIndex(buckets, d); if (i >= 0) dens[i]++; }
  const maxD = Math.max(...dens, 1); const bw = 1000 / buckets.length;
  dens.forEach((v, i) => {
    if (!v) return;
    const h = (v / maxD) * 38;
    const r = document.createElementNS(NS,"rect"); r.setAttribute("x", i*bw+1); r.setAttribute("y", 48-h); r.setAttribute("width", bw-2); r.setAttribute("height", h); r.setAttribute("fill","#00c9a7"); r.setAttribute("opacity","0.22"); r.setAttribute("rx","1"); svg.appendChild(r);
  });
  const bl = document.createElementNS(NS,"line"); bl.setAttribute("x1","0"); bl.setAttribute("y1","47"); bl.setAttribute("x2","1000"); bl.setAttribute("y2","47"); bl.setAttribute("stroke","rgba(255,255,255,.06)"); bl.setAttribute("stroke-width","0.5"); svg.appendChild(bl);
  inner.appendChild(svg);
  const today = new Date();
  if (today >= viewport.fullStart && today <= viewport.fullEnd) {
    const pct = ((today - viewport.fullStart) / viewport.totalMs) * 100;
    const nl = document.createElement("div"); nl.className = "tlNowLine"; nl.style.left = `${pct}%`; inner.appendChild(nl);
    const lbl = document.createElement("div"); lbl.className = "tlNowLabel"; lbl.textContent = "היום"; lbl.style.left = `${pct + 0.5}%`; inner.appendChild(lbl);
  }
  const winPct = viewport.windowWidthPct;
  const win = document.createElement("div"); win.className = "tlStripWindow"; win.style.left = `${viewport.windowLeftPct}%`; win.style.width = `${winPct}%`;
  win.setAttribute("role", "slider");
  win.setAttribute("aria-label", "גלילת ציר הזמן");
  win.setAttribute("aria-valuemin", "0");
  win.setAttribute("aria-valuemax", "100");
  win.setAttribute("aria-valuenow", String(Math.round(viewport.windowLeftPct)));
  wireTimelineStripDrag(inner, win, winPct);
  inner.appendChild(win);
  strip.appendChild(inner);
  return strip;
}

function wireTimelineStripDrag(track, windowEl, windowWidthPct) {
  const maxLeftPct = Math.max(0, 100 - windowWidthPct);
  let dragOffsetPx = 0;
  let dragTrackRect = null;

  const setViewportFromLeftPct = (leftPct, directionHint = "") => {
    const clampedLeft = clamp(leftPct, 0, maxLeftPct);
    timelineState.viewportStart = maxLeftPct ? clampedLeft / maxLeftPct : 0;
    timelineDebug("viewport", { resolution: timelineState.resolution, viewportStart: timelineState.viewportStart });
    renderTimeline();
    if (directionHint) requestAdjacentTimelineRange(directionHint);
    else if (maxLeftPct && clampedLeft <= 0.5) requestAdjacentTimelineRange("before");
    else if (maxLeftPct && clampedLeft >= maxLeftPct - 0.5) requestAdjacentTimelineRange("after");
  };

  const leftPctFromClient = (clientX) => {
    const rect = dragTrackRect || track.getBoundingClientRect();
    if (!rect.width) return 0;
    return ((clientX - rect.left - dragOffsetPx) / rect.width) * 100;
  };

  const onMove = (event) => setViewportFromLeftPct(leftPctFromClient(event.clientX));
  const stopDrag = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
    dragTrackRect = null;
    windowEl.classList.remove("dragging");
  };

  windowEl.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = windowEl.getBoundingClientRect();
    dragTrackRect = track.getBoundingClientRect();
    dragOffsetPx = event.clientX - rect.left;
    windowEl.classList.add("dragging");
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", stopDrag, { once: true });
    document.addEventListener("pointercancel", stopDrag, { once: true });
  });

  track.addEventListener("pointerdown", (event) => {
    if (event.target === windowEl) return;
    dragTrackRect = track.getBoundingClientRect();
    dragOffsetPx = (windowWidthPct / 100) * dragTrackRect.width / 2;
    const directionHint = event.clientX < dragTrackRect.left + dragTrackRect.width / 2 ? "before" : "after";
    setViewportFromLeftPct(leftPctFromClient(event.clientX), maxLeftPct ? "" : directionHint);
    dragTrackRect = null;
  });

  windowEl.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentLeft = maxLeftPct * (timelineState.viewportStart ?? 0);
    const step = event.shiftKey ? 10 : 3;
    if (event.key === "Home") setViewportFromLeftPct(0, "before");
    else if (event.key === "End") setViewportFromLeftPct(maxLeftPct, "after");
    else setViewportFromLeftPct(currentLeft + (event.key === "ArrowRight" ? step : -step));
  });
}

function buildPanelsLayer(events) {
  const panels = document.createElement("div"); panels.className = "tlPanels";
  const primary = document.createElement("div"); primary.className = "tlPrimaryColumn";
  const secondary = document.createElement("div"); secondary.className = "tlSecondaryColumn";
  primary.appendChild(buildListPanel(events));

  const detail = document.createElement("div"); detail.className = "tlDetail"; detail.id = "tlDetailPanel";
  detail.innerHTML = `<div class="tlDetailEmpty"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg><span>לחץ על אירוע לפרטים</span></div>`;
  decorateTimelinePanelForExpand(detail, "detail", "פרטי אירוע");
  primary.appendChild(detail);
  secondary.appendChild(buildAiPanel(events));
  panels.append(primary, secondary);
  return panels;
}

function buildListPanel(events) {
  const wrap = document.createElement("div"); wrap.className = "tlListWrap";

  // --- field picker toolbar ---
  const toolbar = document.createElement("div"); toolbar.className = "tlListToolbar";
  const fieldsBtn = document.createElement("button"); fieldsBtn.className = "tlFieldsBtn"; fieldsBtn.textContent = "שדות תצוגה ▾";
  fieldsBtn.type = "button";
  fieldsBtn.id = "tlFieldsBtn";
  fieldsBtn.setAttribute("aria-expanded", isTimelineDropdownOpen("fields") ? "true" : "false");
  fieldsBtn.setAttribute("aria-controls", "tlFieldsPicker");
  toolbar.appendChild(fieldsBtn);
  wrap.appendChild(toolbar);

  const picker = document.createElement("div"); picker.className = "tlFieldsPicker"; picker.hidden = !isTimelineDropdownOpen("fields");
  picker.id = "tlFieldsPicker";
  picker.setAttribute("role", "menu");
  const allFields = collectAllMetaFields(events);
  if (allFields.length) {
    const sections = [{ id: "orig", title: "original_data" }, { id: "meta", title: "metadata" }];
    for (const sec of sections) {
      const secFields = allFields.filter(f => f.section === sec.id);
      if (!secFields.length) continue;
      const secHdr = document.createElement("div"); secHdr.className = "tlFieldsSecHdr"; secHdr.textContent = sec.title; picker.appendChild(secHdr);
      for (const f of secFields) {
        const row = document.createElement("label"); row.className = "tlFieldRow";
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = timelineState.visibleListFields.has(f.key);
        cb.dataset.fieldKey = f.key;
        row.appendChild(cb);
        const lbl = document.createElement("span"); lbl.textContent = f.label; row.appendChild(lbl);
        picker.appendChild(row);
      }
    }
  } else {
    picker.textContent = "אין שדות זמינים";
  }
  wrap.appendChild(picker);
  picker.addEventListener("change", (event) => {
    const cb = event.target.closest('input[type="checkbox"][data-field-key]');
    if (!cb) return;
    if (cb.checked) timelineState.visibleListFields.add(cb.dataset.fieldKey);
    else timelineState.visibleListFields.delete(cb.dataset.fieldKey);
    renderTimeline();
  });

  // --- virtual list ---
  const list = buildVirtualList(events);
  list.id = "tlListPanel";
  wrap.appendChild(list);
  decorateTimelinePanelForExpand(wrap, "list", "רשימת אירועים");
  return wrap;
}

const TL_HEM = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const TL_VL_ITEM_H = 58;
const TL_VL_HDR_H = 32;
const TL_VL_BUFFER = 6;

function buildVirtualList(events) {
  // Narrow layout uses height:auto so the container is unbounded ? fall back to static list
  if (window.innerWidth <= 980) return buildStaticList(events);

  const rows = [];
  const grouped = new Map();
  for (const ev of events) {
    const d = new Date(ev.date);
    if (isNaN(d)) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!grouped.has(k)) grouped.set(k, []); grouped.get(k).push(ev);
  }
  let y = 0;
  for (const [k, evs] of grouped) {
    const [yr, mo] = k.split("-").map(Number);
    rows.push({ type: "hdr", label: `${TL_HEM[mo-1]} ${yr} ? ${evs.length}`, y, h: TL_VL_HDR_H });
    y += TL_VL_HDR_H;
    for (const ev of evs) {
      rows.push({ type: "item", ev, y, h: TL_VL_ITEM_H });
      y += TL_VL_ITEM_H;
    }
  }
  const totalH = y;

  const outer = document.createElement("div");
  outer.className = "tlList";
  outer.style.cssText = "display:block;position:relative;";

  if (!rows.length) {
    outer.innerHTML = '<div style="padding:20px 13px;color:#2e4050;font-size:12px;">??? ???????</div>';
    return outer;
  }

  const spacer = document.createElement("div");
  spacer.style.cssText = `height:${totalH}px;position:relative;`;
  outer.appendChild(spacer);

  let rafId = null;
  function renderVisible() {
    rafId = null;
    const st = outer.scrollTop;
    const viewH = outer.clientHeight || 400;

    let lo = 0, hi = rows.length - 1, start = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].y + rows[mid].h <= st) { start = mid + 1; lo = mid + 1; } else hi = mid - 1;
    }
    start = Math.max(0, start - TL_VL_BUFFER);
    let end = start;
    while (end < rows.length && rows[end].y < st + viewH) end++;
    end = Math.min(rows.length - 1, end + TL_VL_BUFFER);

    spacer.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = start; i <= end; i++) {
      const row = rows[i];
      let el;
      if (row.type === "hdr") {
        el = document.createElement("div"); el.className = "tlListGroup"; el.textContent = row.label;
      } else {
        el = buildEventListItem(row.ev);
        if (timelineState.selectedEventId === row.ev.id) el.classList.add("tlListActive");
      }
      el.style.position = "absolute";
      el.style.top = row.y + "px";
      el.style.width = "100%";
      frag.appendChild(el);
    }
    spacer.appendChild(frag);
  }

  outer.addEventListener("scroll", () => {
    if (!rafId) rafId = requestAnimationFrame(renderVisible);
  }, { passive: true });

  outer._scrollToEventId = (eventId) => {
    const idx = rows.findIndex(r => r.type === "item" && String(r.ev.id) === String(eventId));
    if (idx < 0) return;
    const row = rows[idx];
    const center = row.y - (outer.clientHeight / 2 - row.h / 2);
    outer.scrollTop = Math.max(0, center);
  };

  requestAnimationFrame(renderVisible);
  return outer;
}
function buildStaticList(events) {
  const viewport = getTimelineViewportKind();
  const CAP = viewport === "phone-narrow" ? 40 : viewport === "phone-compact" ? 80 : viewport === "tablet-stacked" ? 120 : 300;
  const outer = document.createElement("div");
  outer.className = "tlList";
  const grouped = new Map();

  for (const ev of events.slice(0, CAP)) {
    const d = new Date(ev.date);
    const key = isNaN(d) ? "undated" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ev);
  }

  for (const [key, evs] of grouped) {
    const hdr = document.createElement("div");
    hdr.className = "tlListGroup";
    if (key === "undated") hdr.textContent = `??? ????? ? ${evs.length}`;
    else {
      const [yr, mo] = key.split("-").map(Number);
      hdr.textContent = `${TL_HEM[mo - 1]} ${yr} ? ${evs.length}`;
    }
    outer.appendChild(hdr);

    for (const ev of evs) {
      const item = buildEventListItem(ev);
      if (timelineState.selectedEventId === ev.id) item.classList.add("tlListActive");
      outer.appendChild(item);
    }
  }

  if (events.length > CAP) {
    const cap = document.createElement("div");
    cap.className = "tlListCap";
    cap.textContent = `???? ${CAP} ???? ${events.length} ???????`;
    outer.appendChild(cap);
  }

  outer._scrollToEventId = (eventId) => {
    const item = outer.querySelector(`.tlListItem[data-event-id="${eventId}"]`);
    if (!item) return;
    const itemTop = item.offsetTop;
    const itemBottom = itemTop + item.offsetHeight;
    const viewTop = outer.scrollTop;
    const viewBottom = viewTop + outer.clientHeight;
    if (itemTop < viewTop) {
      outer.scrollTo({ top: itemTop, behavior: "smooth" });
    } else if (itemBottom > viewBottom) {
      outer.scrollTo({ top: Math.max(0, itemBottom - outer.clientHeight), behavior: "smooth" });
    }
  };
  return outer;
}
function buildEventListItem(ev) {
  const d = new Date(ev.date); const type = classifyEvent(ev);
  const item = document.createElement("div"); item.className = "tlListItem"; item.dataset.eventId = ev.id;
  if (timelineHasSuggestions(ev)) item.classList.add("tlHasSuggestion");
  const dot = document.createElement("div"); dot.className = "tlListDot"; dot.style.background = getTypeColor(type);
  const inner = document.createElement("div"); inner.style.cssText = "flex:1;min-width:0;";
  const metaEl = document.createElement("div"); metaEl.className = "tlListMeta"; metaEl.textContent = `${d.toLocaleDateString("he-IL",{day:"numeric",month:"short"})} · ${timelineEventTypeLabel(type)}`;
  const title = document.createElement("div"); title.className = "tlListTitle"; title.textContent = timelineEventTitle(ev) || "ללא כותרת";
  const txt = document.createElement("div"); txt.className = "tlListText"; txt.textContent = (ev.content || getMailSummarize(ev) || ev.tags.join(", ") || "—").slice(0, 180);
  inner.appendChild(metaEl); inner.appendChild(title); inner.appendChild(txt);
  const suggestionCount = timelineSuggestionCount(ev);
  if (suggestionCount) {
    const badge = document.createElement("div"); badge.className = "tlSuggestionBadge"; badge.textContent = `${suggestionCount} הצעות קישור`; inner.appendChild(badge);
  }
  for (const fk of timelineState.visibleListFields) {
    const val = formatFieldValue(getFieldValue(ev, fk)); if (!val) continue;
    const row = document.createElement("div"); row.className = "tlListFieldRow";
    const keyEl = document.createElement("span"); keyEl.className = "tlListFieldKey"; keyEl.textContent = fk.replace("orig.", "");
    const valEl = document.createElement("span"); valEl.className = "tlListFieldVal"; valEl.textContent = val;
    row.appendChild(keyEl); row.appendChild(valEl); inner.appendChild(row);
  }
  item.appendChild(dot); item.appendChild(inner);
  item.setAttribute("role", "button"); item.setAttribute("tabindex", "0");
  item.setAttribute("aria-label", (ev.content || ev.tags.join(", ") || "אירוע").slice(0, 80));
  item.addEventListener("click", () => selectTlEvent(ev, true, { source: "list" }));
  item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTlEvent(ev, true, { source: "list", fromKeyboard: true }); } });
  return item;
}

function buildAiPanel(events) {
  const panel = document.createElement("div"); panel.className = "tlAi"; panel.id = "tlAiPanel";
  panel.dataset.collapsed = isTimelineAiCollapsed() ? "true" : "false";

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "tlAiCollapseBtn";
  collapseBtn.setAttribute("aria-expanded", String(!isTimelineAiCollapsed()));
  collapseBtn.setAttribute("aria-controls", "tlAiPanel");
  collapseBtn.textContent = isTimelineAiCollapsed() ? "ניתוח AI ▸" : "ניתוח AI ▾";
  collapseBtn.addEventListener("click", () => {
    setTimelineAiCollapsed(panel.dataset.collapsed !== "true");
  });
  panel.appendChild(collapseBtn);

  const total = events.length;
  const suggestedEvents = timelineSuggestionEventIds().size;
  const types = {};
  for (const ev of events) { const t = classifyEvent(ev); types[t] = (types[t]||0)+1; }
  const allTags = [...new Set(events.flatMap(e => e.tags))];
  const topType = Object.entries(types).sort((a,b) => b[1]-a[1])[0];
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
  const dayRange = dates.length ? Math.round((Math.max(...dates.map(d=>d.getTime())) - Math.min(...dates.map(d=>d.getTime()))) / 86400000) : 0;
  const typeLabels = { meeting:"פגישות", document:"מסמכים", alert:"התראות", email:"אימייל", decision:"החלטות", default:"כללי", critical:"קריטי" };

  panel.appendChild(mkAiCard("סה״כ אירועים", String(total), `${allTags.length} תגיות ייחודיות`));
  panel.appendChild(mkAiCard("הצעות קישור", String(timelineState.suggestions.length || 0), `${suggestedEvents} אירועים מסומנים`));
  if (topType) panel.appendChild(mkAiCard("קטגוריה מובילה", String(topType[1]), typeLabels[topType[0]] || topType[0]));
  if (dayRange) panel.appendChild(mkAiCard("טווח זמן", `${dayRange}`, "ימים של פעילות"));

  const div = document.createElement("div"); div.className = "tlAiDivider"; panel.appendChild(div);

  for (const [type, count] of Object.entries(types).sort((a,b)=>b[1]-a[1]).slice(0,5)) {
    const pct = Math.round(count/total*100);
    const c = document.createElement("div"); c.className = "tlAiCard";
    c.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><span style="font-size:10.5px;color:#5a7080;">${typeLabels[type]||type}</span><span style="font-size:11px;color:#c8d8e8;font-weight:700;">${count}</span></div><div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${getTypeColor(type)};border-radius:2px;opacity:.7;"></div></div>`;
    panel.appendChild(c);
  }
  decorateTimelinePanelForExpand(panel, "summary", "סיכום");
  return panel;
}

function mkAiCard(label, val, sub) {
  const c = document.createElement("div"); c.className = "tlAiCard";
  c.innerHTML = `<div class="tlAiLabel">${escapeHtml(label)}</div><div class="tlAiVal">${escapeHtml(val)}</div><div class="tlAiSub">${escapeHtml(sub)}</div>`;
  return c;
}

function selectTlEvent(ev, scroll = true, { fromKeyboard = false, source = "unknown" } = {}) {
  timelineState.selectedEventId = ev.id;
  document.querySelectorAll(".tlListItem").forEach(el => el.classList.toggle("tlListActive", el.dataset.eventId === ev.id));
  if (scroll) $("tlListPanel")?._scrollToEventId?.(ev.id);
  document.querySelectorAll(".tlNode[data-event-id]").forEach(el => el.classList.toggle("tlSel", el.dataset.eventId === ev.id));
  document.querySelectorAll(".tlCard[data-event-id]").forEach((el) => {
    const selected = el.dataset.eventId === String(ev.id);
    el.classList.toggle("selected", selected);
    el.setAttribute("aria-selected", selected ? "true" : "false");
    el.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const panel = $("tlDetailPanel"); if (!panel) return;
  const timelinePanel = $("timeline");
  const compactViewport = ["phone-narrow", "phone-compact"].includes(timelinePanel?.dataset.viewport || "");
  const type = classifyEvent(ev);
  const color = getTypeColor(type);
  const d = new Date(ev.date);
  const dateStr = isNaN(d) ? "" : d.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const title = (ev.content || "").slice(0, 90) || ev.tags.slice(0,3).join(", ") || "ללא כותרת";
  const typeLabels = { meeting:"פגישה", document:"מסמך", alert:"התראה", email:"אימייל", decision:"החלטה", default:"אירוע", critical:"קריטי" };
  panel.innerHTML = `
    <div class="tlDetailHdr">
      <div class="tlDetailIcon" style="background:${hexA(color,.14)};color:${color};">${getEventIcon(type)}</div>
      <div style="flex:1;min-width:0;">
        <div class="tlDetailDate">${escapeHtml(dateStr)} · ${typeLabels[type]||type}</div>
        <div class="tlDetailTitle" id="tlDetailTitle" tabindex="-1" role="heading" aria-level="2">${escapeHtml(title)}</div>
      </div>
    </div>
    <div class="tlDetailBody">${escapeHtml(ev.content || "אין תוכן זמין.")}</div>
    ${getMailCategory(ev) ? `<div class="tlMailSumLabel">mail_category</div><div class="tlMailCatBadge">${escapeHtml(getMailCategory(ev))}</div>` : ""}
    ${getMailSummarize(ev) ? `<div class="tlMailSumLabel">mail_summarize</div><div class="tlMailSumBody">${escapeHtml(getMailSummarize(ev))}</div>` : ""}
    ${ev.tags.length ? `<div class="tlDetailTags">${ev.tags.map(t => `<span class="tlDetailTag" style="background:${hexA(color,.13)};color:${color};border:1px solid ${hexA(color,.28)};">#${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    <div class="tlMetaSection" id="tlMetaSection"></div>
  `;
  const metaSection = panel.querySelector("#tlMetaSection");
  const metaBtn = document.createElement("button");
  metaBtn.type = "button";
  metaBtn.className = "tlMetaBtn";
  metaBtn.id = "tlMetaBtn";
  metaBtn.setAttribute("aria-expanded", "true");
  metaBtn.setAttribute("aria-controls", "tlMetaBox");
  metaBtn.textContent = "???? metadata";
  const metaBox = buildTimelineMetadataPanel(ev.metadata);
  metaBox.id = "tlMetaBox";
  metaBtn.addEventListener("click", () => {
    const willExpand = metaBox.hidden;
    metaBox.hidden = !willExpand;
    metaBtn.textContent = willExpand ? "???? metadata" : "??? metadata";
    metaBtn.setAttribute("aria-expanded", willExpand ? "true" : "false");
  });
  metaSection.appendChild(metaBtn);
  metaSection.appendChild(metaBox);
  metaSection.appendChild(buildTimelineLinksPanel(ev));
  decorateTimelinePanelForExpand(panel, "detail", "פרטי אירוע");
  if (fromKeyboard) {
    requestAnimationFrame(() => $("tlDetailTitle")?.focus());
  } else if (compactViewport && source === "graph") {
    requestAnimationFrame(() => panel.scrollIntoView({ block: "start", behavior: "smooth" }));
  } else if (scroll) {
    scrollTimelineDetailIntoViewIfNeeded(panel);
  }
}

function buildTimelineLinkRow(link, ev) {
  const row = document.createElement("div");
  row.className = "tlLinkRow";
  const isOutgoing = String(link.source_event_id) === String(ev.id) && link.source_event_source === getTimelineEventSource(ev);
  const otherTitle = isOutgoing ? link.target_title : link.source_title;
  const meta = [
    isOutgoing ? "????" : "????",
    relationLabel(link.relation_type),
    formatTimelineLinkDuration(link),
    link.approver ? `????: ${link.approver}` : ""
  ].filter(Boolean).join(" · ");
  const text = document.createElement("div");
  text.className = "tlLinkText";
  text.innerHTML = `<strong>${escapeHtml(otherTitle || "????? ????")}</strong><span>${escapeHtml(meta)}</span>${link.note ? `<small>${escapeHtml(link.note)}</small>` : ""}`;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "tlLinkDelete";
  del.textContent = "???";
  del.addEventListener("click", async () => {
    del.disabled = true;
    try {
      await api(`/api/timeline/links/${encodeURIComponent(link.id)}`, { method: "DELETE" });
      await refreshTimelineLinks();
    } catch (error) {
      showToast(`????? ?????? ???: ${error.message}`, "error");
      del.disabled = false;
    }
  });
  row.append(text, del);
  return row;
}

function buildTimelineMetadataPanel(metadata) {
  const box = document.createElement("div");
  box.className = "tlMetaBox";
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || !Object.keys(metadata).length) {
    const empty = document.createElement("div");
    empty.className = "tlMetaEmpty";
    empty.textContent = "אין metadata לרשומה זו";
    box.appendChild(empty);
    return box;
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (value == null || value === "") continue;
    const row = document.createElement("div");
    row.className = "tlMetaRow";

    const keyEl = document.createElement("div");
    keyEl.className = "tlMetaKey";
    keyEl.textContent = key;

    const valueEl = document.createElement("div");
    valueEl.className = "tlMetaVal";
    appendTimelineMetadataValue(valueEl, value);

    row.append(keyEl, valueEl);
    box.appendChild(row);
  }
  if (!box.children.length) {
    const empty = document.createElement("div");
    empty.className = "tlMetaEmpty";
    empty.textContent = "אין metadata זמין להצגה";
    box.appendChild(empty);
  }
  return box;
}

function appendTimelineMetadataValue(container, value) {
  if (Array.isArray(value)) {
    if (!value.length) {
      container.textContent = "—";
      return;
    }
    const list = document.createElement("div");
    list.className = "tlMetaList";
    for (const item of value) {
      const chip = document.createElement("span");
      chip.className = "tlMetaChip";
      chip.textContent = formatTimelineMetadataPrimitive(item);
      list.appendChild(chip);
    }
    container.appendChild(list);
    return;
  }
  if (typeof value === "object" && value !== null) {
    const pre = document.createElement("pre");
    pre.className = "tlMetaJson";
    pre.textContent = JSON.stringify(value, null, 2);
    container.appendChild(pre);
    return;
  }
  container.textContent = formatTimelineMetadataPrimitive(value);
}

function formatTimelineMetadataPrimitive(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return String(value);
}

function buildTimelineLinkForm(sourceEvent) {
  const form = document.createElement("form");
  form.className = "tlLinkForm";
  const candidates = timelineState.events.filter((event) => event.id !== sourceEvent.id);
  form.innerHTML = `
    <div class="tlFormGrid">
      <label>????? ???<select name="target">${candidates.map((event) => `<option value="${escapeHtml(String(event.id))}">${escapeHtml(shortEventOption(event))}</option>`).join("")}</select></label>
      <label>??? ???<select name="relation">
        ${Object.entries(timelineRelationLabels()).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
      </select></label>
      <label>?? ????<input name="approver" placeholder="?? ?????, ?? ????" /></label>
      <label>????<input name="note" placeholder="???? ????" /></label>
    </div>
    <button type="submit" ${candidates.length ? "" : "disabled"}>??? ?????</button>
  `;
  const targetSelect = form.elements.target;
  const approverInput = form.elements.approver;
  const fillApprover = () => {
    const target = findTimelineEventById(targetSelect.value);
    if (target && !approverInput.value) approverInput.value = extractTimelineApprover(target);
  };
  targetSelect?.addEventListener("change", fillApprover);
  fillApprover();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const target = findTimelineEventById(form.elements.target.value);
    if (!target) return;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      await saveTimelineLinkFromEvents({
        sourceEvent,
        targetEvent: target,
        relationType: form.elements.relation.value,
        approver: form.elements.approver.value,
        note: form.elements.note.value
      });
      showToast("???? ????");
      await refreshTimelineLinks();
    } catch (error) {
      showToast(`????? ?????? ???: ${error.message}`, "error");
      submit.disabled = false;
    }
  });
  return form;
}

function buildTimelineSuggestionsPanel(currentEvent) {
  const wrap = document.createElement("div");
  wrap.className = "tlSuggestions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tlSuggestBtn";
  btn.textContent = timelineState.suggestionsMode === "smart" ? "רענן הצעות חכמות" : "בדוק הצעות חכמות";
  const list = document.createElement("div");
  list.className = "tlSuggestList";
  btn.textContent = timelineState.suggestionsMode === "smart" ? "רענן הצעות חכמות" : "בדוק הצעות חכמות";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    list.textContent = "בודק הצעות...";
    try {
      list.textContent = "בודק סמנטית עם הגרף והמודל...";
      const runId = startLinkAgentLiveRun();
      const result = await loadSmartTimelineSuggestionsForEvent(currentEvent.id, runId);
      applyLinkAgentWorkflow(result);
      timelineState.suggestions = mergeTimelineSuggestionState(timelineState.suggestions, result.suggestions || []);
      timelineState.suggestionsLoaded = true;
      timelineState.suggestionsMode = result.mode || "smart";
      btn.textContent = "רענן הצעות חכמות";
      renderTimelineSuggestions(list, currentEvent);
    } catch (error) {
      list.textContent = `שגיאה: ${error.message}`;
    } finally {
      btn.disabled = false;
    }
  });
  wrap.append(btn, list);
  if (timelineState.suggestionsLoaded) renderTimelineSuggestions(list, currentEvent);
  return wrap;
}

function buildTimelineLinksPanel(ev) {
  const panel = document.createElement("div");
  panel.className = "tlLinksPanel";
  panel.dataset.expanded = timelineState.linksPanelExpanded ? "true" : "false";

  const header = document.createElement("div");
  header.className = "tlLinksHeader";

  const title = document.createElement("div");
  title.className = "tlLinksTitle";
  title.innerHTML = `<strong>קשרים</strong><span>${timelineLinksForEvent(ev).length} קשרים</span>`;
  header.appendChild(title);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tlLinksToggle";
  toggle.setAttribute("aria-expanded", timelineState.linksPanelExpanded ? "true" : "false");
  toggle.setAttribute("aria-controls", "tlLinksBody");
  toggle.setAttribute("aria-label", timelineState.linksPanelExpanded ? "מזער קשרים" : "הרחב קשרים");
  toggle.innerHTML = `<span aria-hidden="true">⌄</span>`;
  header.appendChild(toggle);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "tlLinksBody";
  body.id = "tlLinksBody";
  body.hidden = !timelineState.linksPanelExpanded;

  toggle.addEventListener("click", () => {
    timelineState.linksPanelExpanded = !timelineState.linksPanelExpanded;
    panel.dataset.expanded = timelineState.linksPanelExpanded ? "true" : "false";
    body.hidden = !timelineState.linksPanelExpanded;
    toggle.setAttribute("aria-expanded", timelineState.linksPanelExpanded ? "true" : "false");
    toggle.setAttribute("aria-label", timelineState.linksPanelExpanded ? "מזער קשרים" : "הרחב קשרים");
  });

  const list = document.createElement("div");
  list.className = "tlLinksList";
  const links = timelineLinksForEvent(ev);
  if (!links.length) {
    const empty = document.createElement("div");
    empty.className = "tlLinksEmpty";
    empty.textContent = "אין עדיין קשרים לאירוע הזה.";
    list.appendChild(empty);
  } else {
    for (const link of links) list.appendChild(buildTimelineLinkRow(link, ev));
  }

  body.appendChild(list);
  body.appendChild(buildTimelineLinkForm(ev));
  body.appendChild(buildTimelineSuggestionsPanel(ev));
  panel.appendChild(body);
  return panel;
}

function decorateTimelinePanelForExpand(panel, kind, label) {
  if (!panel || panel.querySelector(":scope > .tlPanelExpandBtn")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tlPanelExpandBtn";
  button.dataset.tlExpand = kind;
  button.setAttribute("aria-label", `פתח חלון גדול: ${label}`);
  button.title = `פתח חלון גדול: ${label}`;
  button.innerHTML = `<span aria-hidden="true">⤢</span>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTimelinePanelModal(kind, label);
  });
  panel.appendChild(button);
}

function ensureTimelinePanelModal() {
  let modal = $("tlPanelModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "tlPanelModal";
  modal.className = "tlPanelModal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="tlPanelModalBackdrop" data-close="true"></div>
    <div class="tlPanelModalDialog" role="dialog" aria-modal="true" aria-labelledby="tlPanelModalTitle">
      <div class="tlPanelModalHeader">
        <h3 id="tlPanelModalTitle"></h3>
        <button type="button" class="tlPanelModalClose" aria-label="סגור חלון">×</button>
      </div>
      <div class="tlPanelModalBody" id="tlPanelModalBody"></div>
    </div>
  `;
  modal.addEventListener("click", (event) => {
    if (event.target?.dataset?.close === "true") closeTimelinePanelModal();
  });
  modal.querySelector(".tlPanelModalClose")?.addEventListener("click", closeTimelinePanelModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeTimelinePanelModal();
  });
  document.body.appendChild(modal);
  return modal;
}

function buildTimelineModalPanel(kind) {
  if (kind === "list") return buildListPanel(getFilteredTimelineEvents());
  if (kind === "summary") return buildAiPanel(getFilteredTimelineEvents());
  const detail = $("tlDetailPanel");
  if (!detail) return null;
  const clone = detail.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll(".tlPanelExpandBtn").forEach((node) => node.remove());
  return clone;
}

function openTimelinePanelModal(kind, label) {
  const modal = ensureTimelinePanelModal();
  const title = $("tlPanelModalTitle");
  const body = $("tlPanelModalBody");
  if (!modal || !title || !body) return;
  const content = buildTimelineModalPanel(kind);
  if (!content) return;
  content.classList.add("tlModalPanelContent");
  content.querySelectorAll(".tlPanelExpandBtn").forEach((node) => node.remove());
  title.textContent = label;
  body.innerHTML = "";
  body.appendChild(content);
  timelineState.activeModalPanel = kind;
  modal.hidden = false;
  document.body.classList.add("tlModalOpen");
  modal.querySelector(".tlPanelModalClose")?.focus();
}

function closeTimelinePanelModal() {
  const modal = $("tlPanelModal");
  if (!modal) return;
  modal.hidden = true;
  timelineState.activeModalPanel = null;
  const body = $("tlPanelModalBody");
  if (body) body.innerHTML = "";
  document.body.classList.remove("tlModalOpen");
}

function renderTimelineSuggestions(container, currentEvent) {
  const currentSource = getTimelineEventSource(currentEvent);
  const items = timelineState.suggestions.filter((item) =>
    (item.source_event_source === currentSource && String(item.source_event_id) === String(currentEvent.id)) ||
    (item.target_event_source === currentSource && String(item.target_event_id) === String(currentEvent.id))
  );
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = "אין הצעות רלוונטיות לאירוע הזה כרגע.";
    return;
  }
  for (const suggestion of items.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "tlSuggestRow";
    row.innerHTML = `
      <div><strong>${escapeHtml(suggestion.source_title)}</strong><span>← ${escapeHtml(suggestion.target_title)}</span><small>${escapeHtml(formatTimelineLinkDuration(suggestion))}${suggestion.approver ? ` · מאשר: ${escapeHtml(suggestion.approver)}` : ""}</small></div>
    `;
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "שמור";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await api("/api/timeline/links", { method: "POST", body: suggestion });
        showToast("ההצעה נשמרה כקשר");
        await refreshTimelineLinks();
      } catch (error) {
        showToast(`שגיאה בשמירת הצעה: ${error.message}`, "error");
        save.disabled = false;
      }
    });
    row.appendChild(save);
    container.appendChild(row);
  }
}

function timelineLinksForEvent(ev) {
  const source = getTimelineEventSource(ev);
  return (timelineState.links || []).filter((link) =>
    (link.source_event_source === source && String(link.source_event_id) === String(ev.id)) ||
    (link.target_event_source === source && String(link.target_event_id) === String(ev.id))
  );
}

function timelineSuggestionsForEvent(ev) {
  const source = getTimelineEventSource(ev);
  return (timelineState.suggestions || []).filter((item) =>
    (item.source_event_source === source && String(item.source_event_id) === String(ev.id)) ||
    (item.target_event_source === source && String(item.target_event_id) === String(ev.id))
  );
}

function mergeTimelineSuggestionState(current = [], incoming = []) {
  const byKey = new Map();
  for (const item of [...current, ...incoming]) {
    if (!item) continue;
    const key = [
      item.source_event_source,
      item.source_event_id,
      item.target_event_source,
      item.target_event_id,
      item.relation_type
    ].join("|");
    const previous = byKey.get(key);
    if (!previous || Number(item.score || 0) > Number(previous.score || 0)) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

function timelineHasSuggestions(ev) {
  return timelineSuggestionCount(ev) > 0;
}

function timelineSuggestionCount(ev) {
  return timelineSuggestionsForEvent(ev).length;
}

function timelineSuggestionEventIds() {
  const ids = new Set();
  const source = getActiveTimelineSource();
  for (const item of timelineState.suggestions || []) {
    if (item.source_event_source === source) ids.add(String(item.source_event_id));
    if (item.target_event_source === source) ids.add(String(item.target_event_id));
  }
  return ids;
}

function getTimelineEventSource(ev) {
  return ev?.source === "alerts" ? "alerts" : getActiveTimelineSource();
}

function findTimelineEventById(id) {
  return timelineState.events.find((event) => String(event.id) === String(id));
}

function saveTimelineLinkFromEvents({ sourceEvent, targetEvent, relationType, approver, note }) {
  return api("/api/timeline/links", {
    method: "POST",
    body: {
      source_event_source: getTimelineEventSource(sourceEvent),
      source_event_id: sourceEvent.id,
      target_event_source: getTimelineEventSource(targetEvent),
      target_event_id: targetEvent.id,
      relation_type: relationType,
      source_date: sourceEvent.date,
      target_date: targetEvent.date,
      source_title: timelineEventTitle(sourceEvent),
      target_title: timelineEventTitle(targetEvent),
      approver,
      note
    }
  });
}

async function exportSettingsFile() {
  const button = $("exportSettings");
  if (!button) return;
  button.disabled = true;
  try {
    const data = await api("/api/settings/export");
    const json = `${JSON.stringify(data, null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `bidoc-settings-${stamp}.json`;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("קובץ ההגדרות ירד למחשב");
  } catch (error) {
    showToast(`שגיאה בהורדת קובץ הגדרות: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

async function importSettingsFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  const button = $("importSettings");
  if (!button) return;
  button.setAttribute("aria-disabled", "true");
  try {
    const text = await file.text();
    if (!text.trim()) throw new Error("הקובץ ריק");
    let body;
    try {
      body = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("הקובץ אינו קובץ JSON תקין");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("קובץ ההגדרות חייב להכיל אובייקט JSON");
    }
    const result = await api("/api/settings/import", { method: "POST", body });
    applySettingsResponse(result.settings);
    applyImportedSecretValues(result.draft);
    state.settingsDirty = true;
    setSettingsSaveState("הקובץ נטען לטופס. השינויים טרם נשמרו ב-Supabase.", "dirty");
    showToast("הקובץ נטען לטופס. לחץ שמור כדי לעדכן את Supabase");
  } catch (error) {
    showToast(`שגיאה בטעינת קובץ הגדרות: ${error.message}`, "error");
  } finally {
    input.value = "";
    button.removeAttribute("aria-disabled");
  }
}

function applyImportedSecretValues(draft = {}) {
  if ($("openRouterApiKey")) $("openRouterApiKey").value = draft.secrets?.openRouterApiKey || "";
  if ($("supabaseUrl")) $("supabaseUrl").value = draft.secrets?.supabaseUrl || "";
  if ($("supabaseServiceRoleKey")) $("supabaseServiceRoleKey").value = draft.secrets?.supabaseServiceRoleKey || "";
  if ($("contentSupabaseServiceRoleKey")) $("contentSupabaseServiceRoleKey").value = draft.contentSource?.supabaseServiceRoleKey || "";
  if ($("cacheRedisUrl")) $("cacheRedisUrl").value = draft.cache?.redisUrl || "";
}

async function refreshChatSessions() {
  const list = $("chatDrawerList");
  if (list && !state.chatSessions.length) {
    list.innerHTML = '<div class="chatDrawerEmpty">טוען שיחות…</div>';
  }
  try {
    const result = await api("/api/sessions");
    state.chatSessions = result.sessions || [];
    renderChatDrawer();
  } catch (error) {
    if (list) {
      list.innerHTML = `<div class="chatDrawerEmpty">לא ניתן לטעון את השיחות כרגע.<br>${escapeHtml(error.message)}</div>`;
    }
  }
}

function renderChatDrawer() {
  const list = $("chatDrawerList");
  if (!list) return;
  const query = String($("chatHistorySearch")?.value || "").trim().toLocaleLowerCase("he");
  const sessions = state.chatSessions.filter((session) =>
    !query || String(session.user_message || "").toLocaleLowerCase("he").includes(query)
  );
  list.innerHTML = "";
  if (!sessions.length) {
    list.innerHTML = `<div class="chatDrawerEmpty">${query ? "לא נמצאו שיחות מתאימות" : "אין שיחות שמורות עדיין"}</div>`;
    return;
  }
  for (const session of sessions) {
    const sessionId = session.sessionId || session.session_id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chatDrawerItem${sessionId === $("sessionId").value ? " active" : ""}`;
    const title = conversationTitle(session.user_message || "שיחה ללא כותרת");
    const date = session.created_at
      ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(session.created_at))
      : "";
    button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(date)}</span>`;
    button.addEventListener("click", async () => {
      setCurrentSession(sessionId);
      await loadSessionMessages(sessionId);
      if ($("chatTitle")) $("chatTitle").textContent = title;
      renderChatDrawer();
      closeChatDrawer();
    });
    list.append(button);
  }
}

function conversationTitle(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 52 ? `${text.slice(0, 49)}…` : text || "שיחה חדשה";
}

function timelineRelationLabels() {
  return {
    quote_sent: "הצעת מחיר נשלחה",
    quote_approved: "הצעת מחיר אושרה",
    invoice_sent: "חשבונית נשלחה",
    payment_received: "תשלום התקבל",
    change_order: "חריג / שינוי",
    related: "קשור"
  };
}

function relationLabel(type) {
  return timelineRelationLabels()[type] || type || "קשור";
}

function timelineEventTypeLabel(type) {
  return {
    meeting: "פגישה",
    document: "מסמך",
    alert: "התראה",
    email: "אימייל",
    decision: "החלטה",
    critical: "קריטי",
    default: "אירוע"
  }[type] || type || "אירוע";
}

function timelineEventTitle(event) {
  return (event?.content || getMailSummarize(event) || event?.tags?.join(", ") || "אירוע ללא כותרת").slice(0, 180);
}

function timelineEventSummary(event) {
  const summary = event?.metadata?.summary
    || event?.metadata?.alert_description
    || event?.metadata?.question
    || getMailSummarize(event)
    || event?.content
    || "";
  return String(summary || "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function formatTimelineTooltipDate(event) {
  const date = new Date(event?.date);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function ensureTimelineNodeTooltip() {
  let tooltip = $("tlNodeTooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "tlNodeTooltip";
  tooltip.className = "tlNodeTooltip";
  tooltip.hidden = true;
  tooltip.innerHTML = `
    <div class="tlNodeTooltipDate"></div>
    <div class="tlNodeTooltipTitle"></div>
    <div class="tlNodeTooltipSummary"></div>
    <div class="tlNodeTooltipFooter" hidden>
      <span class="tlNodeTooltipIndex"></span>
      <span class="tlNodeTooltipHint">גלגל בעכבר למעבר בין אירועים</span>
    </div>
  `;
  tooltip.addEventListener("mouseenter", () => {
    if (timelineState.hoverTooltipState) timelineState.hoverTooltipState.insideTooltip = true;
  });
  tooltip.addEventListener("mouseleave", () => {
    if (timelineState.hoverTooltipState) timelineState.hoverTooltipState.insideTooltip = false;
    hideTimelineNodeTooltip();
  });
  tooltip.addEventListener("wheel", (event) => {
    if (!timelineState.hoverTooltipState?.events?.length || timelineState.hoverTooltipState.events.length < 2) return;
    event.preventDefault();
    cycleTimelineNodeTooltip(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  document.body.appendChild(tooltip);
  return tooltip;
}

function showTimelineNodeTooltip(anchor, events) {
  if (!anchor || !events?.length) return;
  const prev = timelineState.hoverTooltipState;
  timelineState.hoverTooltipState = {
    anchor,
    events,
    index: prev?.anchor === anchor && prev?.events?.length === events.length ? prev.index : 0,
    insideTooltip: false
  };
  renderTimelineNodeTooltip();
}

function getTimelineTooltipActiveEvent(anchor, events) {
  const state = timelineState.hoverTooltipState;
  if (!state || state.anchor !== anchor || !state.events?.length) return null;
  if (state.events.length !== events.length) return null;
  return state.events[state.index] || state.events[0] || null;
}

function cycleTimelineNodeTooltip(step) {
  if (!timelineState.hoverTooltipState?.events?.length || timelineState.hoverTooltipState.events.length < 2) return;
  const total = timelineState.hoverTooltipState.events.length;
  timelineState.hoverTooltipState.index = (timelineState.hoverTooltipState.index + step + total) % total;
  renderTimelineNodeTooltip();
}

function renderTimelineNodeTooltip() {
  const tooltip = ensureTimelineNodeTooltip();
  const state = timelineState.hoverTooltipState;
  if (!tooltip || !state?.anchor || !state.events?.length) return;
  const event = state.events[state.index] || state.events[0];
  const rect = state.anchor.getBoundingClientRect();
  const dateEl = tooltip.querySelector(".tlNodeTooltipDate");
  const titleEl = tooltip.querySelector(".tlNodeTooltipTitle");
  const summaryEl = tooltip.querySelector(".tlNodeTooltipSummary");
  const footerEl = tooltip.querySelector(".tlNodeTooltipFooter");
  const indexEl = tooltip.querySelector(".tlNodeTooltipIndex");
  if (dateEl) dateEl.textContent = formatTimelineTooltipDate(event);
  if (titleEl) titleEl.textContent = event?.metadata?.title || timelineEventTitle(event);
  if (summaryEl) summaryEl.textContent = timelineEventSummary(event) || "ללא תיאור נוסף";
  const multiple = state.events.length > 1;
  if (footerEl) footerEl.hidden = !multiple;
  if (indexEl) indexEl.textContent = multiple ? `${state.index + 1} / ${state.events.length}` : "";
  tooltip.hidden = false;
  tooltip.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  tooltip.style.top = `${Math.round(rect.top - 12)}px`;
}

function hideTimelineNodeTooltip() {
  const tooltip = $("tlNodeTooltip");
  const state = timelineState.hoverTooltipState;
  if (state?.insideTooltip) return;
  if (tooltip) tooltip.hidden = true;
  timelineState.hoverTooltipState = null;
}

function shortEventOption(event) {
  const date = new Date(event.date);
  const dateText = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("he-IL");
  return `${dateText} · ${timelineEventTitle(event).slice(0, 72)}`;
}

function formatTimelineLinkDuration(link) {
  const days = Number.isFinite(Number(link.durationDays)) ? Number(link.durationDays) : daysBetweenTimelineDates(link.source_date, link.target_date);
  if (days === null) return "";
  if (days === 0) return "באותו יום";
  if (days === 1) return "עבר יום אחד";
  return `עברו ${days} ימים`;
}

function daysBetweenTimelineDates(sourceDate, targetDate) {
  const start = new Date(sourceDate);
  const end = new Date(targetDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function extractTimelineApprover(event) {
  const value = `${event?.content || ""} ${JSON.stringify(event?.metadata || {})}`;
  const patterns = [
    /(?:אושר(?:ה)?\s+על\s+ידי|אושר(?:ה)?\s+ע"י|מאשר[:\s]+|אישר[:\s]+)\s*([א-תA-Za-z][א-תA-Za-z .'-]{1,60})/i,
    /(?:approved\s+by|approver[:\s]+)\s*([A-Za-z][A-Za-z .'-]{1,60})/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].replace(/[.,;:|]+.*$/, "").replace(/\s+/g, " ").trim().slice(0, 80);
  }
  return "";
}

// ---- Wave helper: Catmull-Rom ----
function catmullRom(pts) {
  if (pts.length < 2) return `M ${pts[0]?.x||0} ${pts[0]?.y||0}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0,i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(pts.length-1,i+2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function mkGrad(NS, id, stops) {
  const g = document.createElementNS(NS,"linearGradient"); g.setAttribute("id",id); g.setAttribute("x1","0"); g.setAttribute("y1","0"); g.setAttribute("x2","0"); g.setAttribute("y2","1");
  for (const s of stops) { const el = document.createElementNS(NS,"stop"); el.setAttribute("offset",s.o); el.setAttribute("stop-color",s.c); el.setAttribute("stop-opacity",String(s.a)); g.appendChild(el); }
  return g;
}

// ---- Event classification ----
const TYPE_COLORS = { meeting:"#a855f7", document:"#10b981", alert:"#f97316", email:"#3b82f6", decision:"#f59e0b", critical:"#ef4444", default:"#00c9a7" };

const ALERT_TAG_COLORS = {
  "עדכון":        "#06b6d4",
  "איכות":        "#a855f7",
  "עיכוב":        "#f59e0b",
  "אירוע בטיחות": "#ef4444",
};
const TAG_PALETTE = ["#06b6d4","#a855f7","#f59e0b","#ef4444","#10b981","#3b82f6","#f97316","#ec4899","#84cc16","#8b5cf6","#14b8a6","#f43f5e"];

function getTagColor(tag) {
  if (ALERT_TAG_COLORS[tag]) return ALERT_TAG_COLORS[tag];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function _parseOriginalData(ev) {
  if (!ev.metadata) return null;
  try {
    const orig = ev.metadata.original_data;
    return typeof orig === "string" ? JSON.parse(orig) : (orig || null);
  } catch { return null; }
}
function getMailSummarize(ev) {
  return ev.metadata?.mail_summarize || _parseOriginalData(ev)?.mail_summarize || null;
}
function getMailCategory(ev) {
  return ev.metadata?.mail_category || _parseOriginalData(ev)?.mail_category || null;
}

function collectAllMetaFields(events) {
  const fields = new Map();
  const sample = events.length > 50 ? events.slice(0, 50) : events;
  for (const ev of sample) {
    if (!ev.metadata) continue;
    for (const k of Object.keys(ev.metadata)) {
      if (k !== "original_data" && !fields.has(k)) fields.set(k, { key: k, label: k, section: "meta" });
    }
    const orig = _parseOriginalData(ev);
    if (orig) {
      for (const k of Object.keys(orig)) {
        const fk = `orig.${k}`;
        if (!fields.has(fk)) fields.set(fk, { key: fk, label: k, section: "orig" });
      }
    }
  }
  return [...fields.values()].sort((a, b) => a.label.localeCompare(b.label, "he"));
}

function getFieldValue(ev, key) {
  if (key.startsWith("orig.")) return _parseOriginalData(ev)?.[key.slice(5)] ?? null;
  return ev.metadata?.[key] ?? null;
}

function formatFieldValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "כן" : "לא";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);
  const s = String(val).trim();
  return s || null;
}

function classifyEvent(ev) {
  if (ev.source === "alert" || ev.source === "alerts") return ev.tags[0] || "התראה";
  const tags = ev.tags.map(t => t.toLowerCase());
  if (tags.some(t => /פגישה|ישיבה|meeting|zoom|call/.test(t)))    return "meeting";
  if (tags.some(t => /מסמך|דוח|תכנ|document|report|plan/.test(t))) return "document";
  if (tags.some(t => /התראה|alert|warning|risk|סיכון|חריג/.test(t))) return "alert";
  if (tags.some(t => /אימייל|email|mail|הודעה/.test(t)))            return "email";
  if (tags.some(t => /החלטה|decision|approval|אישור/.test(t)))      return "decision";
  if (tags.some(t => /קריטי|critical|urgent|דחוף/.test(t)))         return "critical";
  return ev.tags[0] || "default";
}

function getEventIcon(type) {
  return { meeting:"M", document:"D", alert:"!", email:"@", decision:"OK", critical:"!", default:"•" }[type] || "⚑";
}

function getTypeColor(type) { return TYPE_COLORS[type] || getTagColor(type); }

function timelineTypeClass(type) {
  return TYPE_COLORS[type] ? `tl-${type}` : "tl-tag";
}

function mixEventColors(evs) {
  if (!evs.length) return "#00c9a7";
  const counts = {};
  for (const ev of evs) { const t = classifyEvent(ev); counts[t] = (counts[t] || 0) + 1; }
  const total = evs.length;
  let r = 0, g = 0, b = 0;
  for (const [type, count] of Object.entries(counts)) {
    const hex = getTypeColor(type).replace("#","");
    r += parseInt(hex.slice(0,2),16) * count / total;
    g += parseInt(hex.slice(2,4),16) * count / total;
    b += parseInt(hex.slice(4,6),16) * count / total;
  }
  return `#${Math.round(r).toString(16).padStart(2,"0")}${Math.round(g).toString(16).padStart(2,"0")}${Math.round(b).toString(16).padStart(2,"0")}`;
}

function applyNodeColor(node, type) {
  if (TYPE_COLORS[type]) return; // handled by CSS class
  const c = getTagColor(type);
  node.style.background = hexA(c, 0.22);
  node.style.borderColor = hexA(c, 0.55);
  node.style.color = c;
}

function buildClusterPieNode(node, evs) {
  const counts = {};
  for (const ev of evs) {
    const t = classifyEvent(ev);
    counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = evs.length;
  const size = 32;
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 0.75;
  const innerR = outerR * 0.50;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", size); svg.setAttribute("height", size);
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";

  if (entries.length === 1) {
    const color = getTypeColor(entries[0][0]);
    const circ = document.createElementNS(SVG_NS, "circle");
    circ.setAttribute("cx", cx); circ.setAttribute("cy", cy); circ.setAttribute("r", outerR);
    circ.setAttribute("fill", hexA(color, 0.22));
    circ.setAttribute("stroke", hexA(color, 0.55));
    circ.setAttribute("stroke-width", "1.5");
    svg.appendChild(circ);
    node.style.color = color;
  } else {
    let angle0 = -Math.PI / 2;
    for (const [type, count] of entries) {
      const sweep = (count / total) * Math.PI * 2;
      const angle1 = angle0 + sweep;
      const color = getTypeColor(type);
      const cos0 = Math.cos(angle0), sin0 = Math.sin(angle0);
      const cos1 = Math.cos(angle1), sin1 = Math.sin(angle1);
      const large = sweep > Math.PI ? 1 : 0;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", [
        `M${cx + outerR * cos0} ${cy + outerR * sin0}`,
        `A${outerR} ${outerR} 0 ${large} 1 ${cx + outerR * cos1} ${cy + outerR * sin1}`,
        `L${cx + innerR * cos1} ${cy + innerR * sin1}`,
        `A${innerR} ${innerR} 0 ${large} 0 ${cx + innerR * cos0} ${cy + innerR * sin0}`,
        "Z"
      ].join(" "));
      path.setAttribute("fill", color);
      path.setAttribute("opacity", "0.82");
      svg.appendChild(path);
      angle0 = angle1;
    }
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", cx); ring.setAttribute("cy", cy); ring.setAttribute("r", outerR);
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "rgba(255,255,255,0.1)");
    ring.setAttribute("stroke-width", "1");
    svg.appendChild(ring);
    node.style.color = getTypeColor(entries[0][0]);
  }

  node.style.background = "rgba(5,15,25,0.72)";
  node.style.border = "none";
  node.appendChild(svg);

  const label = document.createElement("span");
  label.style.cssText = "position:relative;z-index:1;font-size:10px;font-weight:700;color:inherit;";
  label.textContent = String(total);
  node.appendChild(label);
}

function hexA(hex, alpha) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return hex;
  return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
}

// ---- Calendar accessibility helpers ----
const CAL_DAY_FULL = ["יום ראשון","יום שני","יום שלישי","יום רביעי","יום חמישי","יום שישי","שבת"];
const CAL_DAY_SHORT = ["א","ב","ג","ד","ה","ו","ש"];
let _calLiveRegion = null;

function calAnnounce(text) {
  if (!_calLiveRegion) {
    _calLiveRegion = document.createElement("div");
    _calLiveRegion.setAttribute("aria-live", "polite");
    _calLiveRegion.setAttribute("aria-atomic", "true");
    _calLiveRegion.className = "srOnly";
    document.body.appendChild(_calLiveRegion);
  }
  _calLiveRegion.textContent = "";
  requestAnimationFrame(() => { _calLiveRegion.textContent = text; });
}

// ---- Calendar ----
function renderCalendar() {
  applyTimelineResponsiveState();
  const container = $("timelineContainer");
  const filtered = getFilteredTimelineEvents();

  const year  = timelineState.calYear  ?? new Date().getFullYear();
  const month = timelineState.calMonth ?? new Date().getMonth();

  const byDay = new Map();
  for (const ev of filtered) {
    const d = new Date(ev.date);
    if (isNaN(d)) continue;
    const key = calDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }

  container.innerHTML = "";

  // ── Nav bar ──
  const monthName = new Date(year, month, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const nav = document.createElement("div");
  nav.className = "calNav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button"; prevBtn.className = "calNavBtn"; prevBtn.id = "calPrev";
  prevBtn.setAttribute("aria-label", "החודש הקודם"); prevBtn.innerHTML = "&#8250;";

  const titleSpan = document.createElement("span");
  titleSpan.className = "calNavTitle"; titleSpan.textContent = monthName;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button"; nextBtn.className = "calNavBtn"; nextBtn.id = "calNext";
  nextBtn.setAttribute("aria-label", "החודש הבא"); nextBtn.innerHTML = "&#8249;";

  prevBtn.addEventListener("click", () => navigateTimelineCalendar(-1));
  nextBtn.addEventListener("click", () => navigateTimelineCalendar(1));
  nav.append(prevBtn, titleSpan, nextBtn);
  container.appendChild(nav);

  // ── Grid ──
  const daysInMonth = calDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayKey = calDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Resolve focused date for this month (roving tabindex anchor)
  let focusedKey = timelineState.calFocusedDate;
  {
    const todayInMonth = today.getFullYear() === year && today.getMonth() === month;
    if (!focusedKey) {
      focusedKey = todayInMonth ? todayKey : calDateKey(year, month, 1);
    } else {
      const parts = focusedKey.split("-").map(Number);
      if (parts[0] !== year || parts[1] !== month + 1) {
        const prevDay = parts[2];
        focusedKey = calDateKey(year, month, calClampDay(year, month, prevDay));
      }
    }
    timelineState.calFocusedDate = focusedKey;
  }

  const grid = document.createElement("div");
  grid.className = "calGrid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", monthName);
  grid.setAttribute("aria-busy", "false");

  // Column headers row (role="row" with display:contents preserves CSS grid)
  const hdrRow = document.createElement("div");
  hdrRow.setAttribute("role", "row");
  hdrRow.style.display = "contents";
  for (let i = 0; i < 7; i++) {
    const col = document.createElement("div");
    col.setAttribute("role", "columnheader");
    col.setAttribute("aria-label", CAL_DAY_FULL[i]);
    col.className = "calDayLabel";
    const abbr = document.createElement("abbr");
    abbr.title = CAL_DAY_FULL[i];
    abbr.textContent = CAL_DAY_SHORT[i];
    col.appendChild(abbr);
    hdrRow.appendChild(col);
  }
  grid.appendChild(hdrRow);

  // Week rows
  const totalCells = firstDay + daysInMonth;
  const totalRows = Math.ceil(totalCells / 7);
  let cellIndex = 0;

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.style.display = "contents";

    for (let colIdx = 0; colIdx < 7; colIdx++, cellIndex++) {
      const dayNum = cellIndex - firstDay + 1;
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");

      if (cellIndex < firstDay || dayNum > daysInMonth) {
        cell.className = "calCell empty";
        cell.setAttribute("aria-hidden", "true");
      } else {
        const key = calDateKey(year, month, dayNum);
        const dayEvents = byDay.get(key) || [];
        const isSelected = timelineState.calSelectedDate === key;
        const isToday = key === todayKey;
        const isFocused = key === focusedKey;

        cell.className = "calCell"
          + (dayEvents.length ? " has-events" : "")
          + (isSelected ? " selected" : "")
          + (isToday ? " today" : "");
        cell.dataset.dateKey = key;
        cell.setAttribute("tabindex", isFocused ? "0" : "-1");
        cell.setAttribute("aria-selected", isSelected ? "true" : "false");
        if (isToday) cell.setAttribute("aria-current", "date");

        const fullDate = new Date(year, month, dayNum).toLocaleDateString("he-IL", {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        });
        const evLabel = dayEvents.length
          ? `, ${dayEvents.length} ${dayEvents.length === 1 ? "אירוע" : "אירועים"}`
          : "";
        cell.setAttribute("aria-label", fullDate + evLabel);

        const numEl = document.createElement("div");
        numEl.className = "calCellNum";
        numEl.setAttribute("aria-hidden", "true");
        numEl.textContent = dayNum;
        cell.appendChild(numEl);

        if (dayEvents.length) {
          const dots = document.createElement("div");
          dots.className = "calDots";
          dots.setAttribute("aria-hidden", "true");
          for (let i = 0; i < Math.min(dayEvents.length, 5); i++) {
            const dot = document.createElement("div"); dot.className = "calDot"; dots.appendChild(dot);
          }
          if (dayEvents.length > 5) {
            const more = document.createElement("span");
            more.style.cssText = "font-size:10px;color:var(--text-muted);line-height:6px;";
            more.textContent = `+${dayEvents.length - 5}`;
            dots.appendChild(more);
          }
          cell.appendChild(dots);
        }

        cell.addEventListener("click", () => calSelectDay(key, dayEvents));
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault(); e.stopPropagation();
            calSelectDay(key, dayEvents);
          }
        });
      }
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  container.appendChild(grid);
  wireCalendarKeyboard(grid, year, month);

  reconcileTimelineSelection(filtered);

  if (timelineState.calSelectedDate) {
    const selEvents = byDay.get(timelineState.calSelectedDate) || [];
    container.appendChild(buildCalDayPanel(timelineState.calSelectedDate, selEvents));
  }

  const detail = document.createElement("div");
  detail.className = "tlDetail calDetail";
  detail.id = "tlDetailPanel";
  detail.innerHTML = `<div class="tlDetailEmpty"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg><span>לחץ על אירוע לפרטים</span></div>`;
  decorateTimelinePanelForExpand(detail, "detail", "פרטי אירוע");
  container.appendChild(detail);
  container.appendChild(buildAiPanel(filtered));

  const daySelection = timelineState.calSelectedDate ? (byDay.get(timelineState.calSelectedDate) || []) : [];
  const selected = timelineState.selectedEventId
    ? daySelection.find((e) => String(e.id) === String(timelineState.selectedEventId))
    : null;
  if (selected) selectTlEvent(selected, false);
}

function calSelectDay(key, dayEvents) {
  const wasSelected = timelineState.calSelectedDate === key;
  timelineState.calFocusedDate = key;
  timelineState.calSelectedDate = wasSelected ? null : key;
  if (wasSelected) timelineState.selectedEventId = null;
  renderCalendar();
}

function wireCalendarKeyboard(gridEl, year, month) {
  gridEl.addEventListener("keydown", async (e) => {
    const NAV_KEYS = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"];
    if (!NAV_KEYS.includes(e.key)) return;
    const focusedEl = gridEl.querySelector("[data-date-key][tabindex='0']") || document.activeElement;
    const currentKey = focusedEl?.dataset?.dateKey;
    if (!currentKey) return;
    e.preventDefault();
    const parts = currentKey.split("-").map(Number);
    const cy = parts[0], cm = parts[1] - 1, cd = parts[2];
    let next;
    // RTL layout: ArrowLeft moves forward (+1 day), ArrowRight moves backward (-1 day)
    if      (e.key === "ArrowLeft")  next = calNavigateByDays(cy, cm, cd, 1);
    else if (e.key === "ArrowRight") next = calNavigateByDays(cy, cm, cd, -1);
    else if (e.key === "ArrowDown")  next = calNavigateByDays(cy, cm, cd, 7);
    else if (e.key === "ArrowUp")    next = calNavigateByDays(cy, cm, cd, -7);
    else if (e.key === "Home")       next = calWeekBoundary(cy, cm, cd, "start");
    else if (e.key === "End")        next = calWeekBoundary(cy, cm, cd, "end");
    else if (e.key === "PageUp")     next = e.shiftKey ? calNavigateByMonths(cy, cm, cd, -12) : calNavigateByMonths(cy, cm, cd, -1);
    else if (e.key === "PageDown")   next = e.shiftKey ? calNavigateByMonths(cy, cm, cd, 12)  : calNavigateByMonths(cy, cm, cd, 1);
    if (!next) return;
    const nextKey = calDateKey(next.year, next.month, next.day);
    timelineState.calFocusedDate = nextKey;
    if (next.year !== year || next.month !== month) {
      await navigateToCalMonth(next.year, next.month);
    } else {
      const nextCell = gridEl.querySelector(`[data-date-key="${nextKey}"]`);
      if (nextCell) {
        focusedEl.setAttribute("tabindex", "-1");
        nextCell.setAttribute("tabindex", "0");
        nextCell.focus();
      }
    }
  });
}

async function navigateToCalMonth(year, month, { clearSelection = false } = {}) {
  const grid = document.querySelector(".calGrid");
  const prevBtn = $("calPrev"), nextBtn = $("calNext");
  if (grid) grid.setAttribute("aria-busy", "true");
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;
  const loaded = await ensureTimelineRange(timelineMonthRange(year, month), { reason: "calendar" });
  if (!loaded) {
    if (grid) grid.setAttribute("aria-busy", "false");
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
    return false;
  }
  timelineState.calYear = year;
  timelineState.calMonth = month;
  if (clearSelection) timelineState.calSelectedDate = null;
  const monthName = new Date(year, month, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  renderCalendar();
  calAnnounce(monthName);
  requestAnimationFrame(() => {
    const key = timelineState.calFocusedDate;
    if (key) document.querySelector(`[data-date-key="${key}"]`)?.focus();
  });
  return true;
}

async function navigateTimelineCalendar(direction) {
  const prevDay = timelineState.calFocusedDate ? parseInt(timelineState.calFocusedDate.split("-")[2], 10) : 1;
  const next = calNavigateByMonths(timelineState.calYear, timelineState.calMonth, prevDay, direction);
  timelineState.calFocusedDate = calDateKey(next.year, next.month, calClampDay(next.year, next.month, prevDay));
  await navigateToCalMonth(next.year, next.month, { clearSelection: true });
}

function buildCalDayPanel(dateKey, events) {
  const panel = document.createElement("div");
  panel.className = "calDayPanel";
  panel.id = "calDayPanel";

  const d = new Date(dateKey);
  const dateLabel = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const countLabel = events.length
    ? ` · ${events.length} ${events.length === 1 ? "אירוע" : "אירועים"}`
    : "";

  const titleEl = document.createElement("h2");
  titleEl.className = "calDayPanelTitle";
  titleEl.id = "calDayPanelTitle";
  titleEl.textContent = dateLabel + countLabel;
  panel.appendChild(titleEl);

  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "calDayEmpty";
    empty.textContent = "אין אירועים ביום זה";
    panel.appendChild(empty);
    return panel;
  }

  const list = document.createElement("ul");
  list.className = "calEventList";
  list.setAttribute("role", "list");
  list.setAttribute("aria-labelledby", "calDayPanelTitle");

  for (const ev of events) {
    const li = document.createElement("li");
    li.className = "calEventListItem";
    li.setAttribute("role", "listitem");
    li.appendChild(buildEventCard(ev, dateKey));
    list.appendChild(li);
  }

  // Arrow/Escape navigation within the list
  list.addEventListener("keydown", (e) => {
    if (!["ArrowUp","ArrowDown","Home","End","Escape"].includes(e.key)) return;
    e.preventDefault();
    const cards = [...list.querySelectorAll(".tlCard")];
    const idx = cards.findIndex((c) => c === document.activeElement);
    if (e.key === "Escape") {
      document.querySelector(`[data-date-key="${dateKey}"]`)?.focus();
    } else if (e.key === "ArrowDown") {
      cards[(idx + 1) % cards.length]?.focus();
    } else if (e.key === "ArrowUp") {
      cards[(idx - 1 + cards.length) % cards.length]?.focus();
    } else if (e.key === "Home") {
      cards[0]?.focus();
    } else if (e.key === "End") {
      cards[cards.length - 1]?.focus();
    }
  });

  panel.appendChild(list);
  return panel;
}

function buildEventCard(ev, sourceDateKey = null) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "tlCard";
  card.dataset.eventId = ev.id;
  if (sourceDateKey) card.dataset.sourceDateKey = sourceDateKey;

  const d = new Date(ev.date);
  const dateStr = isNaN(d) ? "" : d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
  const type = classifyEvent(ev);
  const typeLabels = { meeting:"פגישה", document:"מסמך", alert:"התראה", email:"אימייל", decision:"החלטה", default:"אירוע", critical:"קריטי" };
  const typeLabel = typeLabels[type] || type;
  const excerpt = (ev.content || "").slice(0, 80).replace(/\n/g, " ");
  card.setAttribute("aria-label", [dateStr, typeLabel, excerpt || ev.tags.join(", ") || "אירוע"].filter(Boolean).join(", "));
  card.setAttribute("aria-pressed", timelineState.selectedEventId === ev.id ? "true" : "false");

  const fullExcerpt = (ev.content || "").slice(0, 140).replace(/\n/g, " ");
  card.innerHTML = `<div class="tlCardDate">${escapeHtml(dateStr)}</div><div class="tlCardContent">${escapeHtml(fullExcerpt)}${ev.content && ev.content.length > 140 ? "..." : ""}</div>${ev.tags.length ? `<div class="tlCardTags"></div>` : ""}`;
  if (ev.tags.length) {
    const tagsEl = card.querySelector(".tlCardTags");
    for (const t of ev.tags) {
      const chip = document.createElement("span"); chip.className = "tagBadge"; chip.textContent = "#" + t;
      tagsEl.appendChild(chip);
    }
  }
  if (timelineState.selectedEventId === ev.id) card.classList.add("selected");

  // e.detail === 0 means keyboard activation (Enter/Space on a <button>)
  card.addEventListener("click", (e) => {
    const fromKeyboard = e.detail === 0;
    selectTlEvent(ev, !fromKeyboard, { fromKeyboard, source: "calendar" });
  });

  return card;
}

async function handleTimelineSourceSwitch(source) {
  if (!source || source === timelineState.source) return;
  abortActiveTimelineRequest();
  timelineState.requestId += 1;
  timelineState.source = source;
  timelineState.activeTags.clear();
  timelineState.viewportStart = null;
  timelineState.calSelectedDate = null;
  clearTimelineSearch({ resetInput: true });
  syncTimelineSourceState(getActiveTimelineSource());
  updateTimelineSourceButtons();
  renderTimelineFilters();
  renderTimeline();
  await loadTimeline({
    force: true,
    replace: true,
    refreshRelated: true,
    range: getTimelineInitialRange(),
    reason: "source"
  });
}

async function handleTimelineOriginToggle(origin) {
  if (getActiveTimelineSource() !== "index") return;
  const nextOrigins = toggleTimelineOriginSelection(getTimelineOriginsForSource("index"), origin);
  if (timelineOriginSignature(nextOrigins) === getActiveTimelineOriginSignature()) return;

  abortActiveTimelineRequest();
  timelineState.requestId += 1;
  timelineState.activeOrigins = new Set(nextOrigins);
  timelineState.eventsBySource.index = [];
  timelineState.events = [];
  timelineState.loadedRanges.index = [];
  timelineState.pendingRangeKeys.clear();
  timelineState.activeRangeKey = null;
  timelineState.viewportStart = null;
  for (const key of timelineState.paginationByRange.keys()) {
    if (key.startsWith("index|")) timelineState.paginationByRange.delete(key);
  }
  updateTimelineOriginButtons();
  updateTimelineLoadMore();
  await loadTimeline({
    force: true,
    replace: true,
    refreshRelated: false,
    range: getTimelineInitialRange(),
    reason: "origins"
  });
}

async function handleTimelineResolutionSwitch(resolution, button = null) {
  if (!resolution) return;
  document.querySelectorAll(".resBtn").forEach((b) => {
    const active = b === button || b.dataset.res === resolution;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });
  timelineState.resolution = resolution;
  timelineState.viewportStart = null;
  timelineDebug("resolution", { resolution: timelineState.resolution });
  if (timelineState.resolution === "cal") {
    initializeTimelineCalendar();
    await ensureTimelineRange(timelineMonthRange(timelineState.calYear, timelineState.calMonth), { reason: "calendar" });
  }
  renderTimeline();
}

function toggleTimelineTagByLabel(label) {
  if (!label || label === "הכל") {
    timelineState.activeTags.clear();
  } else if (timelineState.activeTags.has(label)) {
    timelineState.activeTags.delete(label);
  } else {
    timelineState.activeTags.add(label);
  }
  renderTimelineFilters();
  renderTimeline();
}

function toggleTimelineField(fieldKey, checked) {
  if (!fieldKey) return;
  if (checked) timelineState.visibleListFields.add(fieldKey);
  else timelineState.visibleListFields.delete(fieldKey);
  renderTimeline();
}

function wireTimelineDelegatedControls() {
  if (timelineState.delegatedControlsBound) return;
  timelineState.delegatedControlsBound = true;

  document.addEventListener("click", async (event) => {
    const root = event.target.closest("#timeline.active");
    if (!root) return;
    const sourceBtn = event.target.closest(".tlSrcBtn");
    if (sourceBtn) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await handleTimelineSourceSwitch(sourceBtn.dataset.src);
      } catch (error) {
        failTimelineAction(error);
      }
      return;
    }
    const originBtn = event.target.closest(".tlOriginBtn");
    if (originBtn) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await handleTimelineOriginToggle(originBtn.dataset.origin);
      } catch (error) {
        failTimelineAction(error);
      }
      return;
    }
    const resBtn = event.target.closest(".resBtn");
    if (resBtn) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await handleTimelineResolutionSwitch(resBtn.dataset.res, resBtn);
      } catch (error) {
        failTimelineAction(error);
      }
      return;
    }
    const refreshBtn = event.target.closest("#refreshTimeline");
    if (refreshBtn) {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (!timelineState.loading) {
          await loadTimeline({
            force: true,
            replace: true,
            refreshRelated: true,
            range: getTimelineInitialRange(),
            reason: "refresh"
          });
        }
      } catch (error) {
        failTimelineAction(error);
      }
      return;
    }
    const tagsBtn = event.target.closest("#tlTagsBtn");
    if (tagsBtn) {
      event.preventDefault();
      event.stopPropagation();
      setTimelineDropdownState("tags", !isTimelineDropdownOpen("tags"));
      return;
    }
    const fieldsBtn = event.target.closest("#tlFieldsBtn");
    if (fieldsBtn) {
      event.preventDefault();
      event.stopPropagation();
      setTimelineDropdownState("fields", !isTimelineDropdownOpen("fields"));
      return;
    }
    const tagChip = event.target.closest("#timelineFilters .tagChip");
    if (tagChip) {
      event.preventDefault();
      event.stopPropagation();
      toggleTimelineTagByLabel(tagChip.textContent.trim());
      return;
    }
    const card = event.target.closest(".tlCard[data-event-id]");
    if (card) {
      const ev = timelineState.events.find((item) => String(item.id) === String(card.dataset.eventId));
      if (ev) {
        event.preventDefault();
        event.stopPropagation();
        // e.detail === 0 means keyboard activation (Enter/Space on <button>).
        // Pass fromKeyboard so focus moves to the detail title for accessibility.
        const fromKeyboard = event.detail === 0;
        selectTlEvent(ev, !fromKeyboard, { fromKeyboard, source: "calendar" });
      }
      return;
    }
  }, true);

  document.addEventListener("change", (event) => {
    const fieldInput = event.target.closest('#tlFieldsPicker input[type="checkbox"][data-field-key]');
    if (!fieldInput) return;
    toggleTimelineField(fieldInput.dataset.fieldKey, fieldInput.checked);
  }, true);
}

function wireTimeline() {
  wireTimelineDelegatedControls();
  initializeTimelineSearchController();
  initTimelineDateInputs();
  applyTimelineResponsiveState();
  document.querySelectorAll(".tlSrcBtn").forEach(btn => {
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(btn.classList.contains("active")));
    btn.addEventListener("click", async () => {
      try {
        await handleTimelineSourceSwitch(btn.dataset.src);
      } catch (error) {
        failTimelineAction(error);
      }
    });
  });

  $("timelineResolution")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".resBtn"); if (!btn) return;
    try {
      await handleTimelineResolutionSwitch(btn.dataset.res, btn);
    } catch (error) {
      failTimelineAction(error);
    }
  });
  document.querySelectorAll(".resBtn").forEach(b => {
    b.type = "button";
    b.setAttribute("aria-pressed", b.classList.contains("active") ? "true" : "false");
  });
  $("refreshTimeline")?.setAttribute("aria-label", "רענן ציר זמן");
  $("refreshTimeline")?.addEventListener("click", () => {
    try {
      if (timelineState.loading) return;
      loadTimeline({
        force: true,
        replace: true,
        refreshRelated: true,
        range: getTimelineInitialRange(),
        reason: "refresh"
      });
    } catch (error) {
      failTimelineAction(error);
    }
  });
  $("timelineLoadMore")?.addEventListener("click", loadMoreTimelineEvents);
  $("tlAdvancedToggle")?.addEventListener("click", () => {
    setTimelineAdvancedControls(!isTimelineAdvancedControlsOpen());
    $("timeline")?.setAttribute("data-advanced-open", isTimelineAdvancedControlsOpen() ? "true" : "false");
  });
  $("tlApplyFetch")?.addEventListener("click", async () => {
    if (state.settings?.retrieval) {
      state.settings.retrieval.timelineLimit = getTimelineLoadLimit();
    }
    try {
      await loadTimeline({ force: true, replace: true, refreshRelated: true, range: getTimelineInitialRange(), reason: "fetch-params" });
    } catch (error) {
      failTimelineAction(error);
    }
  });
  $("timelineSearch")?.addEventListener("input", (event) => scheduleTimelineSearch(event.target.value || ""));
  if (!timelineState.dropdownListenersBound) {
    bindTimelineDropdownListeners();
    timelineState.dropdownListenersBound = true;
  }
  if (!timelineState.resizeBound) {
    timelineState.resizeBound = true;
    window.addEventListener("resize", () => {
      const panel = $("timeline");
      const previousViewport = panel?.dataset.viewport || "";
      const previousGraphMode = panel?.dataset.mobileGraph || "";
      const nextSnapshot = getTimelineResponsiveSnapshot();
      if (previousViewport === nextSnapshot.viewport && previousGraphMode === nextSnapshot.graphMode) {
        return;
      }
      const wasAdvanced = typeof timelineState.advancedControlsOpen === "boolean";
      const wasAi = typeof timelineState.aiCollapsed === "boolean";
      if (!wasAdvanced) timelineState.advancedControlsOpen = null;
      if (!wasAi) timelineState.aiCollapsed = null;
      applyTimelineResponsiveState();
      renderTimeline();
    }, { passive: true });
  }
}

// ── QA ────────────────────────────────────────────────────────────────────────

function wireQa() {
  $("refreshQa")?.addEventListener("click", loadQaList);
  $("trendQa")?.addEventListener("click", runTrendAnalysis);
  $("qaMessageFilter")?.addEventListener("change", loadQaList);
}

let qaLoadRequestId = 0;

async function loadQaList() {
  const list = $("qaList");
  const refreshButton = $("refreshQa");
  const requestId = ++qaLoadRequestId;
  list.textContent = "טוען...";
  if (refreshButton) refreshButton.disabled = true;
  let messages;
  try {
    const filter = $("qaMessageFilter")?.value || "all";
    const result = await api(`/api/qa/messages?filter=${encodeURIComponent(filter)}&limit=30`, { timeoutMs: 20_000 });
    if (requestId !== qaLoadRequestId) return;
    messages = result.messages || [];
  } catch (err) {
    if (requestId !== qaLoadRequestId) return;
    list.textContent = `שגיאה: ${escapeHtml(err.message)}`;
    return;
  } finally {
    if (requestId === qaLoadRequestId && refreshButton) refreshButton.disabled = false;
  }

  list.innerHTML = "";

  if (!messages.length) {
    list.innerHTML = '<p class="hint" style="padding:20px">לא נמצאו שיחות מתאימות לסינון.</p>';
    return;
  }

  for (const msg of messages) {
    const card = document.createElement("div");
    card.className = "qaCard";

    const date = msg.created_at ? new Date(msg.created_at).toLocaleString("he-IL") : "";
    const safeId = escapeHtml(msg.id);

    card.innerHTML = `
      <div class="qaCardHeader">
        <div class="qaCardMeta">
          <span class="qaCardDate">${escapeHtml(date)}</span>
          ${msg.annotation === "X" ? '<span class="qaDislikedBadge">דיסלייק</span>' : ""}
        </div>
        <button class="qaRunBtn" data-id="${safeId}">הרץ QA</button>
      </div>
      <div class="qaQuestion"><strong>שאלה:</strong> ${escapeHtml((msg.user_message || "").slice(0, 250))}</div>
      <div class="qaAnswer"><strong>תשובה:</strong> ${escapeHtml((msg.ai_response || "").slice(0, 350))}</div>
      <textarea class="qaFeedbackInput" placeholder="תאר מה הייתה הבעיה (אופציונלי)..."></textarea>
      <div class="qaReport" id="qaReport_${safeId}"></div>
    `;

    card.querySelector(".qaRunBtn").addEventListener("click", () => runQa(msg.id, card));
    list.append(card);
    if (msg.qa_report) renderQaReport(msg.qa_report, msg.id, card);
  }
}

async function runQa(messageId, card) {
  const btn = card.querySelector(".qaRunBtn");
  const reportEl = card.querySelector(`#qaReport_${messageId}`);
  const feedbackText = card.querySelector(".qaFeedbackInput")?.value?.trim() || "";
  btn.disabled = true;
  btn.textContent = "מנתח...";
  reportEl.innerHTML = '<div class="qaRunning">מריץ ניתוח QA...</div>';

  try {
    const result = await api(`/api/qa/${encodeURIComponent(messageId)}/run`, {
      method: "POST",
      body: feedbackText ? { userFeedback: feedbackText } : {}
    });
    renderQaReport(result.report, messageId, card);
    showToast("ניתוח QA הסתיים");
  } catch (err) {
    reportEl.innerHTML = `<div class="qaError">שגיאה: ${escapeHtml(err.message)}</div>`;
    showToast("ניתוח QA נכשל", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "הרץ QA מחדש";
  }
}

function renderQaReport(report, messageId, card) {
  const reportEl = card.querySelector(`#qaReport_${messageId}`);
  if (!report || !reportEl) return;
  const normalizedReport = report.report || report;
  reportEl.innerHTML = qaReportHtmlFull(normalizedReport);
  const copyButton = reportEl.querySelector(".qaCopyReport");
  copyButton?.addEventListener("click", async () => {
    copyButton.disabled = true;
    try {
      await copyTextToClipboard(formatQaReportText(normalizedReport));
      copyButton.textContent = "הועתק";
      showToast("דוח ה-QA הועתק");
      window.setTimeout(() => {
        copyButton.textContent = "העתק דוח";
        copyButton.disabled = false;
      }, 1400);
    } catch (error) {
      copyButton.disabled = false;
      showToast(`שגיאה בהעתקת הדוח: ${error.message}`, "error");
    }
  });
}

function qaReportHtml(report) {
  const sevClass = { high: "qaHigh", medium: "qaMedium", low: "qaLow" };
  const sevLabel = { high: "גבוה", medium: "בינוני", low: "נמוך" };

  const stepRows = (report.step_issues || []).map((issue) => `
    <div class="qaStepIssue ${sevClass[issue.severity] || ""}">
      <div class="qaStepIssueHeader">
        <strong>${escapeHtml(issue.label || issue.step)}</strong>
        <span class="qaStepSeverity">${escapeHtml(sevLabel[issue.severity] || issue.severity)}</span>
      </div>
      <p>${escapeHtml(issue.issue)}</p>
    </div>
  `).join("");

  const recs = (report.recommendations || []).map((rec) => `<li>${escapeHtml(rec)}</li>`).join("");
  const rootCauses = (report.root_cause_steps || []).map((s) => `<code>${escapeHtml(s)}</code>`).join(", ");

  return `
    <div class="qaReportBox">
      <div class="qaReportActions">
        <button class="qaCopyReport" type="button" title="העתק את הדוח כטקסט">העתק דוח</button>
      </div>
      <div class="qaReportHeader">
        <span class="qaOverallSeverity ${sevClass[report.overall_severity] || ""}">חומרה: ${escapeHtml(sevLabel[report.overall_severity] || report.overall_severity || "")}</span>
        <span class="qaAnswerQuality">איכות: ${escapeHtml(report.answer_quality || "")}</span>
        <span class="qaConfidence">ביטחון: ${escapeHtml(report.confidence || "")}</span>
      </div>
      <p class="qaSummary">${escapeHtml(report.summary || "")}</p>
      ${rootCauses ? `<div class="qaSection"><strong>שלבים שנכשלו:</strong> ${rootCauses}</div>` : ""}
      ${stepRows ? `<div class="qaSection"><strong>ממצאים לפי שלב:</strong><div class="qaStepList">${stepRows}</div></div>` : ""}
      ${recs ? `<div class="qaSection"><strong>המלצות:</strong><ul class="qaRecs">${recs}</ul></div>` : ""}
    </div>
  `;
}

function qaReportHtmlFull(report = {}) {
  const sevClass = { high: "qaHigh", medium: "qaMedium", low: "qaLow" };
  const stepRows = (report.step_issues || []).map((issue) => `
    <div class="qaStepIssue ${sevClass[issue.severity] || ""}">
      <div class="qaStepIssueHeader">
        <strong>${escapeHtml(issue.label || issue.step || "Step")}</strong>
        <span class="qaStepSeverity">${escapeHtml(issue.severity || "")}</span>
      </div>
      <p>${escapeHtml(issue.issue || "")}</p>
    </div>
  `).join("");
  const recs = (report.recommendations || []).map((rec) => `<li>${escapeHtml(rec)}</li>`).join("");
  const rootCauses = (report.root_cause_steps || []).map((s) => `<code>${escapeHtml(s)}</code>`).join(", ");
  const fullAudit = qaFullAuditHtml(report);

  return `
    <div class="qaReportBox">
      <div class="qaReportActions">
        <button class="qaCopyReport" type="button" title="Copy the QA report as text">Copy report</button>
      </div>
      <div class="qaReportHeader">
        <span class="qaOverallSeverity ${sevClass[report.overall_severity] || ""}">severity: ${escapeHtml(report.overall_severity || "")}</span>
        <span class="qaAnswerQuality">quality: ${escapeHtml(report.answer_quality || "")}</span>
        <span class="qaConfidence">confidence: ${escapeHtml(report.confidence || "")}</span>
      </div>
      <p class="qaSummary">${escapeHtml(report.summary || "")}</p>
      ${rootCauses ? `<div class="qaSection"><strong>Root cause steps:</strong> ${rootCauses}</div>` : ""}
      ${stepRows ? `<div class="qaSection"><strong>Step findings:</strong><div class="qaStepList">${stepRows}</div></div>` : ""}
      ${recs ? `<div class="qaSection"><strong>Recommendations:</strong><ul class="qaRecs">${recs}</ul></div>` : ""}
      ${fullAudit}
    </div>
  `;
}

function qaFullAuditHtml(report = {}) {
  const hasFullAudit = [
    "agent_audit",
    "pipeline_timeline",
    "retrieval_review",
    "grounding_review",
    "cost_review"
  ].some((key) => report[key] !== undefined && report[key] !== null);
  if (!hasFullAudit) return "";

  const agentAudit = Array.isArray(report.agent_audit) ? report.agent_audit : [];
  const timeline = Array.isArray(report.pipeline_timeline) ? report.pipeline_timeline : [];
  const retrieval = report.retrieval_review || {};
  const grounding = report.grounding_review || {};
  const cost = report.cost_review || {};
  const stats = [
    ["agent_audit", `${agentAudit.length} steps`],
    ["pipeline_timeline", `${timeline.length} events`],
    ["retrieval_review.coverage", retrieval.coverage || "not available"],
    ["grounding_review.faithfulness", grounding.faithfulness || "not available"],
    ["cost_review.total_tokens", qaDisplayValue(cost.total_tokens)],
    ["cost_review.total_cost_usd", qaCostValue(cost.total_cost_usd)]
  ];

  return `
    <section class="qaFullAudit" data-qa-full-audit>
      <div class="qaFullAuditHeader">
        <div>
          <h4>Full QA Audit</h4>
          <p>All compact report fields plus the structured Phase 3 audit variables.</p>
        </div>
      </div>
      <div class="qaAuditStats">
        ${stats.map(([label, value]) => `
          <div class="qaAuditStat">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>
      ${qaAgentAuditHtml(agentAudit)}
      ${qaPipelineTimelineHtml(timeline)}
      ${qaReviewHtml("Retrieval Review", "retrieval_review", [
        ["coverage", retrieval.coverage],
        ["evidence_found", retrieval.evidence_found],
        ["evidence_missing", retrieval.evidence_missing],
        ["ranking_notes", retrieval.ranking_notes],
        ["source_notes", retrieval.source_notes]
      ])}
      ${qaReviewHtml("Grounding Review", "grounding_review", [
        ["faithfulness", grounding.faithfulness],
        ["supported_claims", grounding.supported_claims],
        ["unsupported_or_weak_claims", grounding.unsupported_or_weak_claims],
        ["citation_issues", grounding.citation_issues],
        ["internal_exposure_risks", grounding.internal_exposure_risks]
      ])}
      ${qaReviewHtml("Cost Review", "cost_review", [
        ["total_tokens", cost.total_tokens],
        ["total_cost_usd", cost.total_cost_usd],
        ["highest_cost_steps", cost.highest_cost_steps],
        ["context_size_risks", cost.context_size_risks],
        ["cost_recommendations", cost.cost_recommendations]
      ])}
      <details class="qaRawReport">
        <summary>Raw QA JSON</summary>
        <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
      </details>
    </section>
  `;
}

function qaAgentAuditHtml(agentAudit = []) {
  if (!agentAudit.length) return "";
  return `
    <section class="qaAuditSection">
      <h5>Agent Audit</h5>
      <div class="qaAgentAuditList">
        ${agentAudit.map((item) => `
          <article class="qaAgentAuditItem">
            <div class="qaAgentAuditHeader">
              <div>
                <strong>${escapeHtml(item.label || item.step || "Unknown step")}</strong>
                <code>${escapeHtml(item.step || "")}</code>
              </div>
              <div class="qaAuditBadges">
                ${qaBadge("status", item.status)}
                ${qaBadge("decision", item.decision_quality)}
              </div>
            </div>
            ${item.mission ? `<p class="qaAuditText"><b>Mission:</b> ${escapeHtml(item.mission)}</p>` : ""}
            ${item.what_happened ? `<p class="qaAuditText"><b>What happened:</b> ${escapeHtml(item.what_happened)}</p>` : ""}
            <div class="qaAuditGrid">
              ${qaAuditField("input_summary", item.input_summary)}
              ${qaAuditField("output_summary", item.output_summary)}
              ${qaAuditField("metrics", qaMetricsText(item.metrics))}
            </div>
            ${qaInlineList("evidence_used", item.evidence_used)}
            ${qaInlineList("issues", item.issues)}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function qaPipelineTimelineHtml(timeline = []) {
  if (!timeline.length) return "";
  return `
    <section class="qaAuditSection">
      <h5>Pipeline Timeline</h5>
      <ol class="qaTimelineList">
        ${timeline.map((item) => `
          <li>
            <span class="qaTimelineStep">${escapeHtml(item.step || "")}</span>
            ${qaBadge("status", item.status)}
            <span>${escapeHtml(item.result || "")}</span>
            ${item.duration_ms !== null && item.duration_ms !== undefined ? `<small>${escapeHtml(`${item.duration_ms} ms`)}</small>` : ""}
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function qaReviewHtml(title, key, fields = []) {
  const hasContent = fields.some(([, value]) => Array.isArray(value) ? value.length : value !== undefined && value !== null && value !== "");
  if (!hasContent) return "";
  return `
    <section class="qaAuditSection" data-qa-review="${escapeHtml(key)}">
      <h5>${escapeHtml(title)}</h5>
      <div class="qaReviewGrid">
        ${fields.map(([label, value]) => `
          <div class="qaReviewRow">
            <span>${escapeHtml(label)}</span>
            <div>${qaReviewValue(value)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function qaReviewValue(value) {
  if (Array.isArray(value)) return value.length ? `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<em>None</em>";
  return `<strong>${escapeHtml(qaDisplayValue(value))}</strong>`;
}

function qaAuditField(label, value) {
  if (!value) return "";
  return `
    <div class="qaAuditField">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value)}</p>
    </div>
  `;
}

function qaInlineList(label, items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <div class="qaAuditInlineList">
      <span>${escapeHtml(label)}</span>
      ${items.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}
    </div>
  `;
}

function qaBadge(label, value) {
  if (!value) return "";
  return `<span class="qaAuditBadge">${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
}

function qaMetricsText(metrics = {}) {
  if (!metrics || typeof metrics !== "object") return "";
  return [
    metrics.model ? `model ${metrics.model}` : "",
    metrics.tokens !== null && metrics.tokens !== undefined ? `tokens ${metrics.tokens}` : "",
    metrics.cost_usd !== null && metrics.cost_usd !== undefined ? `cost ${qaCostValue(metrics.cost_usd)}` : "",
    metrics.latency_ms !== null && metrics.latency_ms !== undefined ? `latency ${metrics.latency_ms} ms` : ""
  ].filter(Boolean).join(" | ");
}

function qaDisplayValue(value) {
  if (value === null || value === undefined || value === "") return "not available";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(8)));
  return String(value);
}

function qaCostValue(value) {
  if (value === null || value === undefined || value === "") return "not available";
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(8)}` : String(value);
}

function formatQaReportText(report = {}) {
  const severityLabels = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };
  const lines = [
    "דוח QA",
    "",
    `חומרה: ${severityLabels[report.overall_severity] || report.overall_severity || "לא צוין"}`,
    `איכות תשובה: ${report.answer_quality || "לא צוינה"}`,
    `רמת ביטחון: ${report.confidence || "לא צוינה"}`,
    "",
    "סיכום:",
    report.summary || "אין סיכום."
  ];
  if (report.root_cause_steps?.length) {
    lines.push("", "שלבים שנכשלו:", ...report.root_cause_steps.map((step) => `- ${step}`));
  }
  if (report.step_issues?.length) {
    lines.push("", "ממצאים לפי שלב:");
    for (const issue of report.step_issues) {
      const severity = severityLabels[issue.severity] || issue.severity || "לא צוין";
      lines.push(`- ${issue.label || issue.step || "שלב"} [${severity}]: ${issue.issue || ""}`);
    }
  }
  if (report.recommendations?.length) {
    lines.push("", "המלצות:", ...report.recommendations.map((recommendation) => `- ${recommendation}`));
  }
  return lines.join("\n").trim();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("הדפדפן חסם את ההעתקה");
}

async function runTrendAnalysis() {
  const btn = $("trendQa");
  const trendEl = $("qaTrendReport");
  btn.disabled = true;
  btn.textContent = "מנתח מגמות...";
  trendEl.hidden = false;
  trendEl.innerHTML = '<div class="qaRunning">מריץ ניתוח מגמות על כל דוחות ה-QA...</div>';

  try {
    const result = await api("/api/qa/trends", { method: "POST" });
    renderTrendReport(result.trend);
    showToast("דוח מגמות הושלם");
  } catch (err) {
    trendEl.innerHTML = `<div class="qaError">שגיאה: ${escapeHtml(err.message)}</div>`;
    showToast("ניתוח מגמות נכשל", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "דוח מגמות";
  }
}

function renderTrendReport(trend) {
  const trendEl = $("qaTrendReport");
  if (!trend || !trendEl) return;

  const healthClass = { critical: "qaHigh", poor: "qaHigh", fair: "qaMedium", good: "qaLow" };
  const healthLabel = { critical: "קריטי", poor: "גרוע", fair: "בינוני", good: "טוב" };

  const stepsRows = (trend.top_failure_steps || []).map((s) => `
    <div class="trendStepRow">
      <code>${escapeHtml(s.step)}</code>
      <span class="trendStepBar" style="width:${Math.round(s.pct)}%"></span>
      <span>${s.count} כישלונות (${Math.round(s.pct)}%)</span>
    </div>
  `).join("");

  const patterns = (trend.patterns || []).map((p) => `
    <div class="trendPattern">
      <strong>${escapeHtml(p.title)}</strong>
      <span class="trendPatternCount">${p.affected_reports} דוחות</span>
      <p>${escapeHtml(p.description)}</p>
    </div>
  `).join("");

  const recs = (trend.recommendations || []).map((r) => `
    <div class="trendRec ${r.priority === "high" ? "qaHigh" : r.priority === "medium" ? "qaMedium" : "qaLow"}">
      <span class="trendRecPriority">${r.priority === "high" ? "גבוה" : r.priority === "medium" ? "בינוני" : "נמוך"}</span>
      <div>
        <strong>${escapeHtml(r.target_step || "")}</strong>
        <p>${escapeHtml(r.action)}</p>
      </div>
    </div>
  `).join("");

  const aqBreak = trend.answer_quality_breakdown || {};
  const aqItems = Object.entries(aqBreak).map(([k, v]) =>
    v ? `<span class="trendAqItem">${escapeHtml(k)}: ${v}</span>` : ""
  ).join("");

  trendEl.innerHTML = `
    <div class="trendReportBox">
      <div class="trendReportHeader">
        <h3>דוח מגמות QA</h3>
        <span class="qaOverallSeverity ${healthClass[trend.overall_health] || ""}">
          בריאות מערכת: ${escapeHtml(healthLabel[trend.overall_health] || trend.overall_health || "")}
        </span>
        <span class="trendTotal">${trend.total_reports || 0} דוחות נותחו</span>
      </div>
      ${stepsRows ? `<div class="trendSection"><strong>שלבים עם הכי הרבה כישלונות:</strong><div class="trendStepList">${stepsRows}</div></div>` : ""}
      ${patterns ? `<div class="trendSection"><strong>דפוסים שחוזרים:</strong><div class="trendPatternList">${patterns}</div></div>` : ""}
      ${aqItems ? `<div class="trendSection"><strong>פילוח איכות תשובות:</strong><div class="trendAqBreak">${aqItems}</div></div>` : ""}
      ${recs ? `<div class="trendSection"><strong>המלצות עדיפות:</strong><div class="trendRecList">${recs}</div></div>` : ""}
    </div>
  `;
}

async function api(path, options = {}) {
  const timeoutSignal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : null;
  const signal = options.signal && timeoutSignal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : options.signal || timeoutSignal || undefined;
  try {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const httpError = new Error(data.error || `Request failed with status ${response.status}`);
      httpError.name = "HttpError";
      httpError.kind = "http";
      httpError.status = response.status;
      throw httpError;
    }
    return data;
  } catch (error) {
    if (timeoutSignal?.aborted && !options.signal?.aborted) {
      const timeoutError = new Error("הבקשה נמשכה יותר מדי זמן.");
      timeoutError.name = "TimeoutError";
      timeoutError.kind = "timeout";
      throw timeoutError;
    }
    if (error.name === "AbortError" || options.signal?.aborted) {
      const abortError = new Error("הבקשה בוטלה.");
      abortError.name = "AbortError";
      abortError.kind = "cancelled";
      throw abortError;
    }
    if (error.kind === "http") throw error;
    if (error instanceof TypeError) {
      const networkError = new Error("לא ניתן להתחבר לשרת.");
      networkError.name = "NetworkError";
      networkError.kind = "network";
      throw networkError;
    }
    throw error;
  }
}
