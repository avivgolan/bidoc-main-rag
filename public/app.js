import {
  adjacentTimelineRange,
  buildTimelineEventsUrl,
  canCommitTimelineRequest,
  isTimelineAbortError,
  isTimelineRangeCovered,
  isTimelineTimeoutError,
  mergeTimelineEvents,
  mergeTimelineRanges,
  timelineMonthRange,
  timelineRangeKey
} from "./timelineData.js?v=20260610-uifix2";
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
  { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", x: 3098, y: 176, description: "Calls configured external n8n tool webhooks." },
  { id: "source_quality", label: "Source Quality", kind: "router", x: 3314, y: 176, description: "Scores the reliability and freshness of retrieved/tool sources." },
  { id: "conflict_detection", label: "Conflict Detection", kind: "router", x: 3530, y: 176, description: "Highlights possible contradictions across sources before synthesis." },
  { id: "main_agent", label: "Main RAG Agent", kind: "ai", x: 3746, y: 176, description: "Synthesizes the final grounded answer from retrieval, tools and plans." },
  { id: "update_message", label: "Update DB", kind: "database", x: 3962, y: 92, description: "Updates chat_messages_gf with the final answer and status." },

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
  ["alert_agent", "n8n_tools"],
  ["alert_agent", "source_quality"],
  ["reranker", "n8n_tools"],
  ["n8n_tools", "source_quality"],
  ["source_quality", "conflict_detection"],
  ["conflict_detection", "main_agent"],
  ["main_agent", "update_message"]
].map(([from, to]) => ({ from, to }));

const $ = (id) => document.getElementById(id);
const TIMELINE_UI_VERSION = "V1.5";
const MOBILE_SHELL_QUERY = "(max-width: 980px)";

const timelineState = {
  events: [], resolution: "month", activeTags: new Set(),
  calYear: null, calMonth: null, calSelectedDate: null, calFocusedDate: null,
  source: "index",
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
  safeInitStep("evaluation", wireEvaluation);
  safeInitStep("reset", wireReset);
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
      saveStatus.textContent = "שומר…";
      try {
        await api(`/api/subagents/${encodeURIComponent(agent.id)}/config`, {
          method: "PUT",
          body: {
            table: card.querySelector(".subagent-table").value,
            model: card.querySelector(".subagent-model").value,
            systemPrompt: card.querySelector(".subagent-prompt").value
          }
        });
        const refreshed = await api("/api/settings");
        state.settings = refreshed.settings ?? refreshed;
        saveStatus.textContent = "✓ נשמר";
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
  $("liveRunStatus").textContent = `רץ: ${runId}`;
  state.runEvents = [];
  state.fullLogVisible = false;
  if ($("fullLogView")) { $("fullLogView").hidden = true; $("fullLogView").textContent = ""; }
  if ($("liveRunList")) $("liveRunList").hidden = false;
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
  const row = document.createElement("details");
  row.className = `liveRunItem ${item.step === "error" ? "error" : ""}`;
  const summary = document.createElement("summary");
  const time = item.time ? new Date(item.time).toLocaleTimeString("he-IL") : "";
  summary.textContent = `${time} · ${item.step} · ${item.message}`;
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

function wireWorkflow() {
  $("clearWorkflow").addEventListener("click", () => {
    state.lastWorkflow = null;
    state.currentWorkflowMessageId = null;
    state.runEvents = [];
    state.fullLogVisible = false;
    $("liveRunList").innerHTML = "";
    $("liveRunStatus").textContent = "ממתין לבקשה";
    if ($("fullLogView")) { $("fullLogView").hidden = true; $("fullLogView").textContent = ""; }
    if ($("liveRunList")) $("liveRunList").hidden = false;
    renderWorkflowAiReport(null);
    renderWorkflow(null);
  });

  $("toggleFullLog").addEventListener("click", () => {
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

  $("copyLog").addEventListener("click", async () => {
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
}

function renderWorkflow(workflow) {
  const inspector = $("workflowInspector");
  if (inspector) inspector.innerHTML = '<div class="workflowInspectorEmpty">בחר רכיב בגרף כדי לראות Input / Output.</div>';

  if (_cy) { _cy.destroy(); _cy = null; }

  const view = buildWorkflowView(workflow);
  const hasRun = Boolean(workflow?.nodes?.length);
  renderCacheMetrics(workflow?.cacheMetrics || null);
  $("workflowHint").style.display = hasRun ? "none" : "block";
  $("workflowBoard").classList.toggle("hasWorkflow", hasRun);

  if (!hasRun || !view.nodes.length) return;

  const elements = view.nodes.map((node) => ({
    group: "nodes",
    data: { id: node.id, label: node.label, subtitle: node.id, kind: node.kind, status: node.status, nodeData: node }
  })).concat(view.edges.map((edge) => ({
    group: "edges",
    data: { id: `${edge.from}_${edge.to}`, source: edge.from, target: edge.to, active: edge.active ? true : false }
  })));

  const graphOptions = {
    container: $("workflowCy"),
    elements,
    style: cytoscapeStyle()
  };
  try {
    _cy = cytoscape({
      ...graphOptions,
      layout: { name: "dagre", rankDir: "LR", nodeSep: 50, rankSep: 90, padding: 48, animate: false }
    });
  } catch (error) {
    console.warn("Dagre workflow layout is unavailable; using the built-in breadthfirst layout.", error);
    _cy?.destroy();
    _cy = cytoscape({
      ...graphOptions,
      layout: { name: "breadthfirst", directed: true, circle: false, spacingFactor: 1.2, padding: 48, animate: false }
    });
  }

  _cy.on("tap", "node", (evt) => {
    renderWorkflowInspector(evt.target.data("nodeData"));
  });

  if (view.nodes[0]) renderWorkflowInspector(view.nodes[0]);

  pulseErrorNodes(_cy);
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

function pulseErrorNodes(cy) {
  const errorNodes = cy.nodes('[status="error"]');
  if (!errorNodes.length) return;
  const step = (nodes, big) => {
    nodes.animate(
      { style: { "border-width": big ? 5.5 : 3.5, "shadow-blur": big ? 36 : 22 } },
      { duration: 700, easing: "ease-in-out", complete: () => { if (cy.destroyed()) return; step(nodes, !big); } }
    );
  };
  step(errorNodes, true);
}

function cytoscapeStyle() {
  const kindColor = {
    trigger: "#148c72", code: "#2e6b24", database: "#6a4c93",
    memory: "#1a5a8c", ai: "#148c72", router: "#b07d1a",
    vector: "#1a5a8c", tool: "#b07d1a"
  };
  return [
    {
      selector: "node",
      style: {
        shape: "round-rectangle",
        width: 148, height: 64,
        "background-color": (e) => kindColor[e.data("kind")] || "#2a3d28",
        "border-width": 2, "border-color": "#3a5238",
        color: "#e4ede0",
        "font-family": "Inter, system-ui, sans-serif",
        "text-valign": "center", "text-halign": "center",
        "text-wrap": "wrap", "text-max-width": "132px",
        label: (e) => `${e.data("label")}\n${e.data("subtitle")}`,
        "line-height": 1.5, "font-size": 12
      }
    },
    {
      selector: "node[status='done']",
      style: {
        "border-color": "#8ee0c8", "border-width": 2.5,
        "shadow-blur": 14, "shadow-color": "rgb(142 224 200 / 0.45)",
        "shadow-offset-x": 0, "shadow-offset-y": 0, "shadow-opacity": 1
      }
    },
    {
      selector: "node[status='error']",
      style: {
        "background-color": "#3d1212",
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
      const input = runtime?.input ?? { description: node.description || "", configured_component: true };
      const output = runtime?.output ?? { status: "not used in the last run" };
      return {
        ...node,
        ...(runtime || {}),
        x: hasRun ? undefined : node.x,
        y: hasRun ? undefined : node.y,
        label: runtime?.label || node.label,
        kind: runtime?.kind || node.kind,
        status: runtime?.status || "idle",
        used: runtimeIds.has(node.id),
        disconnected: false,
        input,
        output
      };
    });

  for (const runtime of runtimeNodes.values()) {
    if (!templateIds.has(runtime.id)) nodes.push({ ...runtime, used: true });
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

function renderWorkflowInspector(node) {
  const inspector = $("workflowInspector");
  if (!inspector) return;
  inspector.innerHTML = `
    <header class="workflowInspectorHeader">
      <span class="workflowIcon ${escapeHtml(node.kind)}">${iconForNode(node.kind)}</span>
      <div>
        <strong>${escapeHtml(node.label)}</strong>
        <small>${escapeHtml(node.id)} · ${statusLabel(node.status)}</small>
      </div>
    </header>
    <details open>
      <summary>Input</summary>
      <pre>${escapeHtml(JSON.stringify(node.input, null, 2))}</pre>
    </details>
    <details open>
      <summary>Output</summary>
      <pre>${escapeHtml(JSON.stringify(node.output, null, 2))}</pre>
    </details>
  `;
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

  $("saveSettings").addEventListener("click", async () => {
    const body = readSettingsForm();
    $("saveSettings").disabled = true;
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
      $("saveSettings").disabled = false;
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
    const body = {
      models: state.settings?.models || {},
      retrieval: state.settings?.retrieval || {},
      knowledge: state.settings?.knowledge || {},
      contentSource: state.settings?.contentSource || {},
      timelineLinks: readLinkAgentSettingsFromForm(),
      secrets: {},
      n8nBaseUrl: state.settings?.n8nBaseUrl || "",
      timezone: state.settings?.timezone || "UTC+3",
      tools: Object.fromEntries(n8nTools.map((tool) => [tool, state.settings?.tools?.[tool]?.url || ""])),
      subagents: state.settings?.subagents || {}
    };
    const result = await api("/api/settings", { method: "PUT", body });
    state.settings = result.settings;
    applyLinkAgentSettingsToForm();
    showToast("הגדרות סוכן הקשרים נשמרו");
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
  $("hybridRpcName").value = state.settings.retrieval.rpcName;
  $("hybridCandidates").value = state.settings.retrieval.candidates;
  setInputValue("plannerCandidates", state.settings.retrieval.plannerCandidates ?? 20);
  setInputValue("alertCandidates", state.settings.retrieval.alertCandidates ?? 20);
  $("rerankTopK").value = state.settings.retrieval.rerankTopK;
  $("vectorWeight").value = state.settings.retrieval.vectorWeight;
  $("keywordWeight").value = state.settings.retrieval.keywordWeight;
  setInputValue("tlLimitInput", state.settings.retrieval.timelineLimit ?? 1000);
  if ($("knowledgeTriggerKeywords")) {
    $("knowledgeTriggerKeywords").value = (state.settings.knowledge?.triggerKeywords || []).join("\n");
  }
  applyAdvancedAiSettingsToForm();
  $("n8nBaseUrl").value = state.settings.n8nBaseUrl || "";
  if ($("timezone")) $("timezone").value = state.settings.timezone || "UTC+3";
  $("openRouterApiKey").value = "";
  $("openRouterApiKey").placeholder = state.settings.secrets.openRouterApiKey || "sk-or-...";
  $("supabaseUrl").value = state.settings.secrets.supabaseUrl || "";
  $("supabaseServiceRoleKey").value = "";
  $("supabaseServiceRoleKey").placeholder = state.settings.secrets.supabaseServiceRoleKey || "eyJ...";
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
  const body = {
    ...readSettingsForm(),
    presets: [...customSettingsPresets(), preset]
  };
  if (button) button.disabled = true;
  try {
    const result = await api("/api/settings", { method: "PUT", body });
    applySettingsResponse(result.settings);
    state.settingsDirty = false;
    if (input) input.value = "";
    const select = $("settingsPresetSelect");
    if (select) {
      select.value = preset.id;
      renderSelectedSettingsPresetMeta();
    }
    setSettingsSaveState("הפריסט החדש נשמר יחד עם ההגדרות ב-Supabase.", "saved");
    showToast(`הפריסט "${name}" נשמר בהצלחה`);
  } catch (error) {
    setSettingsSaveState("שמירת הפריסט נכשלה. הטופס נשאר כפי שהוא.", "error");
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
  document.querySelectorAll(".advancedSettings .compactSettingsGrid label, .retrievalSettingsCard .compactSettingsGrid label").forEach((label) => {
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
    toolsSafetyPrecheckEnabled: "כאשר פעיל, שאלות דחופות או בטיחותיות מפעילות בדיקה מוקדמת לפני שאר הכלים."
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
    renderRunHistoryStrip(runs || []);
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
    item.className = `runHistoryItem${hasError ? " hasError" : ""}${hasAiReport ? " hasAiReport" : ""}`;
    item.dataset.runId = run.id;
    const time = run.created_at ? timeAgo(new Date(run.created_at)) : "";
    const msg = (run.user_message || "").slice(0, 60);
    const kindLabel = run.kind === "link_agent" ? "סוכן הקשרים" : "צ׳אט";
    item.innerHTML = `
      <div class="rhTime">${escapeHtml(time)}</div>
      <div class="rhMsg">${escapeHtml(msg)}</div>
      <small>${escapeHtml(kindLabel)}</small>
      ${hasError ? '<div class="rhErr">⚠ שגיאה בריצה</div>' : ""}
      ${hasAiReport ? '<div class="rhAiReport">דוח AI</div>' : ""}
    `;
    item.addEventListener("click", () => showHistoricalRun(run, item));
    listEl.append(item);
  }
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
  body.innerHTML = qaReportHtml(report);
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

async function runTimelineLoad({ source, range, replace = false, refreshRelated = false, cursor = null, reason = "range" }) {
  abortActiveTimelineRequest();
  const requestId = ++timelineState.requestId;
  const controller = new AbortController();
  timelineState.controller = controller;
  timelineState.loading = true;
  timelineState.loadingStartedAt = Date.now();
  timelineState.lastLoad = { source, range, replace, refreshRelated, cursor, reason };
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
      sort: "desc"
    }), { signal: controller.signal });
    if (!canCommitTimelineRequest(requestId, timelineState.requestId, source, getActiveTimelineSource())) return false;

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
    const rangeKey = timelineRangeKey(source, range);
    timelineState.paginationByRange.set(rangeKey, {
      nextCursor: eventResult.page?.nextCursor || null,
      hasMore: Boolean(eventResult.page?.hasMore),
      range,
      source
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
      if (!canCommitTimelineRequest(requestId, timelineState.requestId, source, getActiveTimelineSource())) return false;
      if (linksResult) timelineState.linksBySource[source] = linksResult.links || [];

      setTimelineLoadingStep("טוען הצעות");
      const suggestionsResult = await loadTimelineSuggestions(source, controller.signal).catch((error) => {
        if (isTimelineAbortError(error) || isTimelineTimeoutError(error)) throw error;
        timelineDebug("suggestions failed", { error: error.message });
        return null;
      });
      if (!canCommitTimelineRequest(requestId, timelineState.requestId, source, getActiveTimelineSource())) return false;
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
    if (!canCommitTimelineRequest(requestId, timelineState.requestId, source, getActiveTimelineSource())) return false;
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
  if (isTimelineRangeCovered(timelineState.loadedRanges[source], range)) return true;
  const rangeKey = timelineRangeKey(source, range);
  if (timelineState.pendingRangeKeys.has(rangeKey)) return false;
  timelineState.pendingRangeKeys.add(rangeKey);
  try {
    return await runTimelineLoad({
      source,
      range,
      replace: false,
      refreshRelated: false,
      cursor: null,
      reason
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
    reason: "pagination"
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
  for (const [key, pagination] of timelineState.paginationByRange.entries()) {
    if (key.startsWith(`${source}|`) && pagination?.hasMore) return true;
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
  metaBtn.setAttribute("aria-expanded", "false");
  metaBtn.setAttribute("aria-controls", "tlMetaBox");
  metaBtn.textContent = "הצג metadata";
  metaBtn.addEventListener("click", () => {
    const existing = metaSection.querySelector(".tlMetaBox");
    if (existing) {
      existing.remove();
      metaBtn.textContent = "הצג metadata";
      metaBtn.setAttribute("aria-expanded", "false");
      return;
    }
    const box = buildTimelineMetadataPanel(ev.metadata);
    box.id = "tlMetaBox";
    metaSection.appendChild(box);
    metaBtn.textContent = "הסתר metadata";
    metaBtn.setAttribute("aria-expanded", "true");
  });
  metaSection.appendChild(buildTimelineLinksPanel(ev));
  metaSection.appendChild(metaBtn);
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
  const linksPanel = clone.querySelector(".tlLinksPanel");
  const linksBody = clone.querySelector(".tlLinksBody");
  const linksToggle = clone.querySelector(".tlLinksToggle");
  if (linksPanel && linksBody && linksToggle) {
    linksPanel.dataset.expanded = "true";
    linksBody.hidden = false;
    linksToggle.setAttribute("aria-expanded", "true");
    linksToggle.setAttribute("aria-label", "מזער קשרים");
  }
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
    // Previously this flow was draft-only: השינויים טרם נשמרו ב-Supabase.
    state.settingsDirty = false;
    setSettingsSaveState("קובץ ההגדרות יובא ונשמר ב-Supabase.", "saved");
    showToast("קובץ ההגדרות יובא ונשמר בהצלחה");
  } catch (error) {
    showToast(`שגיאה בטעינת קובץ הגדרות: ${error.message}`, "error");
  } finally {
    input.value = "";
    button.removeAttribute("aria-disabled");
  }
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
  reportEl.innerHTML = qaReportHtml(normalizedReport);
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
