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

const state = {
  settings: null,
  lastWorkflow: null,
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
  chatProgress: null
};

let _cy = null;

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
  { id: "reranker", label: "OpenRouter Reranker", kind: "ai", x: 2450, y: 176, description: "Reorders retrieved records by relevance to the user question." },
  { id: "alert_agent", label: "Alert Agent", kind: "ai", x: 2666, y: 176, description: "Runs the local Alert subagent with the query and structured date range." },
  { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", x: 2882, y: 176, description: "Calls configured external n8n tool webhooks." },
  { id: "source_quality", label: "Source Quality", kind: "router", x: 3098, y: 176, description: "Scores the reliability and freshness of retrieved/tool sources." },
  { id: "conflict_detection", label: "Conflict Detection", kind: "router", x: 3314, y: 176, description: "Highlights possible contradictions across sources before synthesis." },
  { id: "main_agent", label: "Main RAG Agent", kind: "ai", x: 3530, y: 176, description: "Synthesizes the final grounded answer from retrieval, tools and plans." },
  { id: "update_message", label: "Update DB", kind: "database", x: 3746, y: 92, description: "Updates chat_messages_gf with the final answer and status." },

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
  ["hybrid_search", "reranker"],
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

init();

async function init() {
  startNewSession({ showToast: false });
  tools.forEach((tool) => $("toolSelect").append(new Option(tool, tool)));
  wireTabs();
  wireChat();
  wireSettings();
  wireTools();
  wireWorkflow();
  wireAgents();
  wireKnowledge();
  wireEvaluation();
  wireReset();
  wireTimeline();
  wireLinkAgent();
  wireQa();
  $("refreshHistory").addEventListener("click", loadHistory);

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
  settings:   () => loadSettings(),
  agents:     () => loadAgentsTabData(),
  subagents:  () => loadSubAgents(),
  knowledge:  () => loadKnowledgeDocuments(),
  history:    () => loadHistory(),
  timeline:   () => loadTimeline(),
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
  if (pushHistory && location.hash !== `#${tabId}`) {
    history.pushState({ tab: tabId }, "", `#${tabId}`);
  }
  if (!skipData) TAB_LOADERS[tabId]?.();
  if (tabId === "workflow") {
    requestAnimationFrame(() => renderWorkflow(state.lastWorkflow));
  }
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
  });

  // Ctrl+Enter (or Cmd+Enter on Mac) submits the form
  $("messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      $("chatForm").requestSubmit($("chatForm").querySelector("button[type=submit]"));
    }
  });

  $("chatForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("messageInput").value.trim();
    if (!message) return;
    if (!$("sessionId").value) setCurrentSession(createSessionId());
    const runId = `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    $("messageInput").value = "";
    addMessage(message, "user");
    const pending = addMessage("מבין את הבקשה...", "assistant");
    pending.classList.add("progress");
    state.chatProgress = { runId, node: pending, lastText: pending.textContent };
    startLiveRun(runId);
    const button = event.submitter;
    button.disabled = true;
    try {
      const result = await api("/api/chat", {
        method: "POST",
        body: { message, sessionId: $("sessionId").value, runId },
        timeoutMs: 120000
      });
      clearChatProgress(pending);
      pending.textContent = result.answer || "לא התקבלה תשובה.";
      if (result.messageId) attachAnnotation(pending, result.messageId);
      appendDebug(pending, result);
      state.lastWorkflow = result.workflowLog || null;
      renderWorkflow(state.lastWorkflow);
      loadRunHistory();
    } catch (error) {
      clearChatProgress(pending);
      if (state.chatProgress?.node === pending) state.chatProgress = null;
      pending.textContent = `שגיאה: ${error.message}`;
      appendLiveRunEvent({ step: "client", message: "Request failed", data: { error: error.message }, time: new Date().toISOString() });
    } finally {
      if (state.chatProgress?.node === pending) state.chatProgress = null;
      button.disabled = false;
    }
  });
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
  const text = progressTextForRunEvent(item);
  if (!text) return;
  progress.node.textContent = text;
  progress.lastText = text;
  progress.node.scrollIntoView({ block: "end" });
}

function clearChatProgress(node) {
  node?.classList.remove("progress");
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
  $("refreshModels").addEventListener("click", loadOpenRouterModels);
  $("saveAgents").addEventListener("click", async () => {
    const prompts = Object.fromEntries(
      state.agents.map((agent) => [agent.id, $(`agentPrompt_${agent.id}`)?.value || agent.prompt || ""])
    );
    const models = Object.fromEntries(
      state.agents.map((agent) => [agent.modelKey, $(`agentModel_${agent.id}`)?.value || agent.model || ""])
    );
    $("saveAgents").disabled = true;
    try {
      const result = await api("/api/agents", { method: "PUT", body: { prompts, models } });
      state.agents = result.agents || [];
      renderAgents();
      showToast("הסוכנים נשמרו בהצלחה");
    } catch (error) {
      showToast(`שגיאה בשמירה: ${error.message}`, "error");
    } finally {
      $("saveAgents").disabled = false;
    }
  });
}

function resetAgentRuntime() {
  state.agentRuntime = Object.fromEntries(
    state.agents.map((agent) => [agent.id, { status: "idle", lastMessage: "ממתין", input: null, output: null }])
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
  const draftPrompts = Object.fromEntries(
    state.agents.map((agent) => [agent.id, $(`agentPrompt_${agent.id}`)?.value])
  );
  const draftModels = Object.fromEntries(
    state.agents.map((agent) => [agent.id, $(`agentModel_${agent.id}`)?.value])
  );
  grid.innerHTML = "";
  if (!state.agents.length) {
    grid.textContent = "טוען סוכנים...";
    return;
  }
  for (const agent of state.agents) {
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
      </div>
      <label>Model
        <select id="agentModel_${escapeHtml(agent.id)}">
          ${modelOptions(draftModels[agent.id] || agent.model || "")}
        </select>
      </label>
      <label>Prompt
        <textarea id="agentPrompt_${escapeHtml(agent.id)}" rows="10" spellcheck="false">${escapeHtml(draftPrompts[agent.id] ?? agent.prompt ?? "")}</textarea>
      </label>
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
  applyLinkAgentSettingsToForm();
}

function modelOptions(selectedModel) {
  const models = [...state.openRouterModels];
  if (selectedModel && !models.some((model) => model.id === selectedModel)) {
    models.unshift({ id: selectedModel, name: selectedModel, contextLength: null });
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
  select.innerHTML = modelOptions(selectedModel);
  select.value = selectedModel || "";
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
    button.className = "knowledgeItem";
    button.innerHTML = `
      <strong>${escapeHtml(item.filename)}</strong>
      <span>${Number(item.size || 0).toLocaleString()} bytes · ${escapeHtml(new Date(item.updatedAt).toLocaleString("he-IL"))}</span>
    `;
    button.addEventListener("click", () => openKnowledgeDocument(item.filename, item.agentId));
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
    button.innerHTML = `
      <strong>${escapeHtml(agent.name)}</strong>
      <span>${escapeHtml(agent.description || "")}</span>
      <small>${escapeHtml((agent.tags || []).slice(0, 6).join(", "))}</small>
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

async function openKnowledgeDocument(filename, agentId = state.selectedKnowledgeAgent) {
  const result = await api(`/api/knowledge/documents/${encodeURIComponent(filename)}?agentId=${encodeURIComponent(agentId || "schedule")}`);
  state.selectedKnowledgeDocument = filename;
  state.selectedKnowledgeAgent = result.document.agentId || agentId || "schedule";
  $("knowledgePreviewTitle").textContent = result.document.filename;
  $("knowledgePreview").textContent = result.document.content || "";
  $("deleteKnowledge").disabled = false;
}

async function deleteSelectedKnowledgeDocument() {
  if (!state.selectedKnowledgeDocument) return;
  const filename = state.selectedKnowledgeDocument;
  $("deleteKnowledge").disabled = true;
  try {
    await api(`/api/knowledge/documents/${encodeURIComponent(filename)}?agentId=${encodeURIComponent(state.selectedKnowledgeAgent || "schedule")}`, { method: "DELETE" });
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
    state.runEvents = [];
    state.fullLogVisible = false;
    $("liveRunList").innerHTML = "";
    $("liveRunStatus").textContent = "ממתין לבקשה";
    if ($("fullLogView")) { $("fullLogView").hidden = true; $("fullLogView").textContent = ""; }
    if ($("liveRunList")) $("liveRunList").hidden = false;
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
}

function renderWorkflow(workflow) {
  const inspector = $("workflowInspector");
  if (inspector) inspector.innerHTML = '<div class="workflowInspectorEmpty">בחר רכיב בגרף כדי לראות Input / Output.</div>';

  if (_cy) { _cy.destroy(); _cy = null; }

  const view = buildWorkflowView(workflow);
  const hasRun = Boolean(workflow?.nodes?.length);
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

  _cy = cytoscape({
    container: $("workflowCy"),
    elements,
    style: cytoscapeStyle(),
    layout: { name: "dagre", rankDir: "LR", nodeSep: 50, rankSep: 90, padding: 48, animate: false }
  });

  _cy.on("tap", "node", (evt) => {
    renderWorkflowInspector(evt.target.data("nodeData"));
  });

  if (view.nodes[0]) renderWorkflowInspector(view.nodes[0]);

  pulseErrorNodes(_cy);
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
  $("saveSettings").addEventListener("click", async () => {
    const body = {
      models: {
        classifier: $("modelClassifier").value,
        knowledgePlanner: $("modelKnowledgePlanner").value,
        main: $("modelMain").value,
        lite: $("modelLite").value,
        embedding: $("modelEmbedding").value,
        reranker: $("modelReranker").value
      },
      retrieval: {
        rpcName: $("hybridRpcName").value,
        candidates: Number($("hybridCandidates").value || 40),
        rerankTopK: Number($("rerankTopK").value || 10),
        vectorWeight: Number($("vectorWeight").value || 0.65),
        keywordWeight: Number($("keywordWeight").value || 0.35)
      },
      knowledge: {
        triggerKeywords: parseMultilineList($("knowledgeTriggerKeywords")?.value || "")
      },
      secrets: {
        openRouterApiKey: $("openRouterApiKey").value,
        supabaseUrl: $("supabaseUrl").value,
        supabaseServiceRoleKey: $("supabaseServiceRoleKey").value
      },
      n8nBaseUrl: $("n8nBaseUrl").value,
      timezone: $("timezone").value,
      tools: Object.fromEntries(n8nTools.map((tool) => [tool, $(`tool_${tool}`).value]))
    };
    $("saveSettings").disabled = true;
    try {
      await api("/api/settings", { method: "PUT", body });
      await loadSettings();
      showToast("ההגדרות נשמרו בהצלחה");
    } catch (error) {
      showToast(`שגיאה בשמירה: ${error.message}`, "error");
    } finally {
      $("saveSettings").disabled = false;
    }
  });

  $("reloadSettings")?.addEventListener("click", async () => {
    $("reloadSettings").disabled = true;
    try {
      const result = await api("/api/settings/reload", { method: "POST", body: {} });
      state.settings = result.settings;
      applySettingsToForm();
      showToast("ההגדרות נטענו מחדש מ-Supabase");
    } catch (error) {
      showToast(`שגיאה ברענון: ${error.message}`, "error");
    } finally {
      $("reloadSettings").disabled = false;
    }
  });
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
    const result = await api(`/api/timeline/link-suggestions?source=${encodeURIComponent(source)}&smart=1&eventId=${encodeURIComponent(eventId)}&limit=${encodeURIComponent($("linkAgentSuggestionLimit")?.value || 12)}`);
    resultBox.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    resultBox.textContent = error.message;
  }
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
}

async function runConnectionDiagnostics() {
  const button = $("runConnectionDiagnostics");
  const container = $("connectionDiagnostics");
  button.disabled = true;
  container.innerHTML = '<div class="diagnosticCard idle">מריץ בדיקות חיבור...</div>';
  try {
    const result = await api("/api/diagnostics/connections", { method: "POST", body: {} });
    renderConnectionDiagnostics(result.results || []);
  } catch (error) {
    container.innerHTML = `<div class="diagnosticCard error"><strong>בדיקת החיבורים נכשלה</strong><small>${escapeHtml(error.message)}</small></div>`;
  } finally {
    button.disabled = false;
  }
}

function renderConnectionDiagnostics(results) {
  const container = $("connectionDiagnostics");
  if (!results.length) {
    container.innerHTML = '<div class="diagnosticCard error">לא התקבלו תוצאות בדיקה.</div>';
    return;
  }
  container.innerHTML = "";
  for (const item of results) {
    const card = document.createElement("article");
    card.className = `diagnosticCard ${item.ok ? "ok" : "error"}`;
    card.innerHTML = `
      <div class="diagnosticTop">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${item.ok ? "תקין" : diagnosticStatusLabel(item.status)}</span>
      </div>
      <small>${item.ms ?? 0}ms</small>
      <pre>${escapeHtml(JSON.stringify(item.ok ? item.details : { status: item.status, error: item.error }, null, 2))}</pre>
    `;
    container.append(card);
  }
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
  state.settings = await api("/api/settings");
  let agents = state.settings.agents;
  if (!Array.isArray(agents) || !agents.length) {
    try {
      agents = (await api("/api/agents")).agents || [];
    } catch {
      agents = [];
    }
  }
  state.agents = agents;
  resetAgentRuntime();
  applySettingsToForm();
  renderAgents();
}

function applySettingsToForm() {
  if (!state.settings) return;
  $("modelClassifier").value = state.settings.models.classifier;
  $("modelKnowledgePlanner").value = state.settings.models.knowledgePlanner;
  $("modelMain").value = state.settings.models.main;
  $("modelLite").value = state.settings.models.lite;
  $("modelEmbedding").value = state.settings.models.embedding;
  $("modelReranker").value = state.settings.models.reranker;
  $("hybridRpcName").value = state.settings.retrieval.rpcName;
  $("hybridCandidates").value = state.settings.retrieval.candidates;
  $("rerankTopK").value = state.settings.retrieval.rerankTopK;
  $("vectorWeight").value = state.settings.retrieval.vectorWeight;
  $("keywordWeight").value = state.settings.retrieval.keywordWeight;
  if ($("knowledgeTriggerKeywords")) {
    $("knowledgeTriggerKeywords").value = (state.settings.knowledge?.triggerKeywords || []).join("\n");
  }
  $("n8nBaseUrl").value = state.settings.n8nBaseUrl || "";
  if ($("timezone")) $("timezone").value = state.settings.timezone || "UTC+3";
  $("openRouterApiKey").value = "";
  $("openRouterApiKey").placeholder = state.settings.secrets.openRouterApiKey || "sk-or-...";
  $("supabaseUrl").value = state.settings.secrets.supabaseUrl || "";
  $("supabaseServiceRoleKey").value = "";
  $("supabaseServiceRoleKey").placeholder = state.settings.secrets.supabaseServiceRoleKey || "eyJ...";

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
    `Supabase: ${state.settings.supabaseConfigured ? "מוגדר" : "חסר"}`,
    `Tools: ${configured}/${n8nTools.length}`
  ].join("<br>");
  renderSettingsSourceStatus();
  applyLinkAgentSettingsToForm();
  renderAgents();
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
      <span>Supabase URL: <b>${secretSourceLabel(source.supabaseUrl)}</b></span>
      <span>Supabase Service Role: <b>${secretSourceLabel(source.supabaseServiceRoleKey)}</b></span>
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
    missing: "חסר"
  }[source] || source || "לא ידוע";
}

function parseMultilineList(value) {
  return String(value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadHistory() {
  const result = await api("/api/sessions");
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
    const item = document.createElement("div");
    item.className = "runHistoryItem" + (hasError ? " hasError" : "");
    item.dataset.runId = run.id;
    const time = run.created_at ? timeAgo(new Date(run.created_at)) : "";
    const msg = (run.user_message || "").slice(0, 60);
    item.innerHTML = `
      <div class="rhTime">${escapeHtml(time)}</div>
      <div class="rhMsg">${escapeHtml(msg)}</div>
      ${hasError ? '<div class="rhErr">⚠ שגיאה בריצה</div>' : ""}
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
  state.fullLogVisible = false;
  renderWorkflow(run.workflow_log || null);
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
  for (const row of result.messages) {
    if (row.user_message) addMessage(row.user_message, "user");
    if (row.ai_response) {
      const node = addMessage(row.ai_response, "assistant");
      if (row.id) attachAnnotation(node, row.id, row.annotation || null);
    }
  }
}

function addMessage(text, role) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  $("messages").append(node);
  node.scrollIntoView({ block: "end" });
  return node;
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

// ---- TIMELINE ----
const timelineState = {
  events: [], resolution: "month", activeTags: new Set(),
  calYear: null, calMonth: null, calSelectedDate: null,
  source: "index",
  selectedEventId: null,
  searchQuery: "",
  viewportStart: null,
  visibleListFields: new Set(),
  links: [],
  suggestions: [],
  suggestionsLoaded: false,
  suggestionsMode: "rules"
};

function timelineDebug(message, data = {}) {
  console.debug("[timeline]", message, data);
}

async function loadTimeline() {
  const container = $("timelineContainer");
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#2e4050;font-size:13px;">טוען...</div>';
  const endpoint = timelineState.source === "alerts" ? "/api/timeline/alerts" : "/api/timeline";
  try {
    const [{ events }, linksResult, suggestionsResult] = await Promise.all([
      api(endpoint),
      loadTimelineLinks().catch((error) => ({ links: [], error })),
      loadTimelineSuggestions().catch((error) => ({ suggestions: [], error }))
    ]);
    timelineState.events = (events || []).map((event) => ({ ...event, source: getActiveTimelineSource() }));
    timelineState.links = linksResult.links || [];
    timelineState.suggestions = suggestionsResult.suggestions || [];
    timelineState.suggestionsLoaded = true;
    timelineState.suggestionsMode = suggestionsResult.mode || "rules";
    timelineState.calYear = null;
    timelineState.calMonth = null;
    timelineState.calSelectedDate = null;
    if (timelineState.events.length) {
      const last = new Date(timelineState.events[timelineState.events.length - 1].date);
      timelineState.calYear = last.getFullYear();
      timelineState.calMonth = last.getMonth();
    }
    renderTimelineFilters();
    renderTimeline();
    $("timelineCount").textContent = `${timelineState.events.length} אירועים`;
  } catch (e) {
    console.error("Timeline error:", e);
    container.innerHTML = `<p style="padding:24px;color:#fb923c;">שגיאה בטעינת ציר הזמן. נסה לרענן.</p>`;
  }
}

async function loadTimelineLinks() {
  return api(`/api/timeline/links?source=${encodeURIComponent(getActiveTimelineSource())}`);
}

async function loadTimelineSuggestions() {
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(getActiveTimelineSource())}`);
}

async function loadSmartTimelineSuggestions() {
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(getActiveTimelineSource())}&smart=1`);
}

async function loadSmartTimelineSuggestionsForEvent(eventId) {
  return api(`/api/timeline/link-suggestions?source=${encodeURIComponent(getActiveTimelineSource())}&smart=1&eventId=${encodeURIComponent(eventId)}&limit=12`);
}

async function refreshTimelineLinks({ rerender = true } = {}) {
  const result = await loadTimelineLinks();
  timelineState.links = result.links || [];
  const suggestions = await loadTimelineSuggestions().catch(() => ({ suggestions: [] }));
  timelineState.suggestions = suggestions.suggestions || [];
  timelineState.suggestionsLoaded = true;
  timelineState.suggestionsMode = suggestions.mode || "rules";
  if (rerender) renderTimeline();
  return timelineState.links;
}

function getActiveTimelineSource() {
  return timelineState.source === "alerts" ? "alerts" : "index";
}

function renderTimelineFilters() {
  const allTags = [...new Set(timelineState.events.flatMap((e) => e.tags))].sort();
  const bar = $("timelineFilters");
  if (!bar) return;
  const dropdown = $("tlTagsDropdown");
  const wasOpen = dropdown && !dropdown.hidden;
  bar.innerHTML = "";
  if (!allTags.length) return;
  const clearBtn = Object.assign(document.createElement("button"), {
    className: "tagChip" + (timelineState.activeTags.size === 0 ? " active" : ""),
    textContent: "הכל"
  });
  clearBtn.addEventListener("click", () => { timelineState.activeTags.clear(); renderTimelineFilters(); renderTimeline(); });
  bar.appendChild(clearBtn);
  for (const tag of allTags) {
    const isAlerts = timelineState.source === "alerts";
    const color = isAlerts ? getTagColor(tag) : null;
    const btn = Object.assign(document.createElement("button"), {
      className: "tagChip" + (timelineState.activeTags.has(tag) ? " active" : "") + (isAlerts ? " tagChipColored" : ""),
      textContent: tag
    });
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
  if (wasOpen && dropdown) { dropdown.hidden = false; $("tlTagsBtn")?.classList.add("open"); }
}

function renderTimeline() {
  if (timelineState.resolution === "cal") renderCalendar();
  else renderFuturisticTimeline();
  updateTimelineCount();
}

function getFilteredTimelineEvents() {
  const query = timelineState.searchQuery.trim().toLowerCase();
  return timelineState.events.filter((event) => {
    const matchesTags = !timelineState.activeTags.size || event.tags.some((tag) => timelineState.activeTags.has(tag));
    if (!matchesTags) return false;
    if (!query) return true;
    const haystack = [
      event.content || "",
      ...(event.tags || []),
      String(event.id || ""),
      event.date || ""
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function updateTimelineCount() {
  const total = timelineState.events.length;
  const filtered = getFilteredTimelineEvents().length;
  $("timelineCount").textContent = filtered === total ? `${total} אירועים` : `${filtered} / ${total} אירועים`;
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
  dark.appendChild(buildWaveLayer(visibleEvents, buckets, viewport.start, viewport.end));
  dark.appendChild(buildStripLayer(filtered, viewport));
  dark.appendChild(buildPanelsLayer(visibleEvents));
  container.appendChild(dark);

  const selected = timelineState.selectedEventId
    ? visibleEvents.find(e => e.id === timelineState.selectedEventId)
    : visibleEvents[Math.min(visibleEvents.length - 1, Math.floor(visibleEvents.length * 0.58))];
  if (selected) selectTlEvent(selected, false);
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
    const d = new Date(ev.date); if (isNaN(d)) continue;
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
    const d = new Date(ev.date); if (isNaN(d)) continue;
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
    const d = new Date(ev.date); if (isNaN(d)) continue;
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
      const handler = () => isCluster ? selectTlEvent(evs[0]) : selectTlEvent(ev);
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

  const setViewportFromLeftPct = (leftPct) => {
    const clampedLeft = clamp(leftPct, 0, maxLeftPct);
    timelineState.viewportStart = maxLeftPct ? clampedLeft / maxLeftPct : 0;
    timelineDebug("viewport", { resolution: timelineState.resolution, viewportStart: timelineState.viewportStart });
    renderTimeline();
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
    setViewportFromLeftPct(leftPctFromClient(event.clientX));
    dragTrackRect = null;
  });

  windowEl.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentLeft = maxLeftPct * (timelineState.viewportStart ?? 0);
    const step = event.shiftKey ? 10 : 3;
    if (event.key === "Home") setViewportFromLeftPct(0);
    else if (event.key === "End") setViewportFromLeftPct(maxLeftPct);
    else setViewportFromLeftPct(currentLeft + (event.key === "ArrowRight" ? step : -step));
  });
}

function buildPanelsLayer(events) {
  const panels = document.createElement("div"); panels.className = "tlPanels";
  panels.appendChild(buildListPanel(events));

  const detail = document.createElement("div"); detail.className = "tlDetail"; detail.id = "tlDetailPanel";
  detail.innerHTML = `<div class="tlDetailEmpty"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg><span>לחץ על אירוע לפרטים</span></div>`;
  panels.appendChild(detail);
  panels.appendChild(buildAiPanel(events));
  return panels;
}

function buildListPanel(events) {
  const wrap = document.createElement("div"); wrap.className = "tlListWrap";

  // --- field picker toolbar ---
  const toolbar = document.createElement("div"); toolbar.className = "tlListToolbar";
  const fieldsBtn = document.createElement("button"); fieldsBtn.className = "tlFieldsBtn"; fieldsBtn.textContent = "שדות ▾";
  toolbar.appendChild(fieldsBtn);
  wrap.appendChild(toolbar);

  const picker = document.createElement("div"); picker.className = "tlFieldsPicker"; picker.hidden = true;
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
        cb.addEventListener("change", () => {
          if (cb.checked) timelineState.visibleListFields.add(f.key);
          else timelineState.visibleListFields.delete(f.key);
          renderTimeline();
        });
        row.appendChild(cb);
        const lbl = document.createElement("span"); lbl.textContent = f.label; row.appendChild(lbl);
        picker.appendChild(row);
      }
    }
  } else {
    picker.textContent = "אין שדות זמינים";
  }
  wrap.appendChild(picker);

  fieldsBtn.addEventListener("click", (e) => { e.stopPropagation(); picker.hidden = !picker.hidden; });
  document.addEventListener("click", () => { picker.hidden = true; }, { capture: false });

  // --- list ---
  const list = document.createElement("div"); list.className = "tlList"; list.id = "tlListPanel";
  const grouped = new Map();
  for (const ev of events) {
    const d = new Date(ev.date); if (isNaN(d)) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!grouped.has(k)) grouped.set(k,[]); grouped.get(k).push(ev);
  }
  const HEM = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  for (const [k, evs] of grouped) {
    const [yr, mo] = k.split("-").map(Number);
    const hdr = document.createElement("div"); hdr.className = "tlListGroup"; hdr.textContent = `${HEM[mo-1]} ${yr} · ${evs.length}`; list.appendChild(hdr);
    for (const ev of evs) {
      const d = new Date(ev.date); const type = classifyEvent(ev);
      const item = document.createElement("div"); item.className = "tlListItem"; item.dataset.eventId = ev.id;
      if (timelineHasSuggestions(ev)) item.classList.add("tlHasSuggestion");
      const dot = document.createElement("div"); dot.className = "tlListDot"; dot.style.background = getTypeColor(type);
      const inner = document.createElement("div"); inner.style.cssText = "flex:1;min-width:0;";
      const metaEl = document.createElement("div"); metaEl.className = "tlListMeta"; metaEl.textContent = d.toLocaleDateString("he-IL",{day:"numeric",month:"short"});
      const txt = document.createElement("div"); txt.className = "tlListText"; txt.textContent = ev.content || getMailSummarize(ev) || ev.tags.join(", ") || "—";
      inner.appendChild(metaEl); inner.appendChild(txt);
      const suggestionCount = timelineSuggestionCount(ev);
      if (suggestionCount) {
        const badge = document.createElement("div");
        badge.className = "tlSuggestionBadge";
        badge.textContent = `${suggestionCount} הצעות קישור`;
        inner.appendChild(badge);
      }
      for (const fk of timelineState.visibleListFields) {
        const val = formatFieldValue(getFieldValue(ev, fk));
        if (!val) continue;
        const row = document.createElement("div"); row.className = "tlListFieldRow";
        const keyEl = document.createElement("span"); keyEl.className = "tlListFieldKey"; keyEl.textContent = fk.replace("orig.", "");
        const valEl = document.createElement("span"); valEl.className = "tlListFieldVal"; valEl.textContent = val;
        row.appendChild(keyEl); row.appendChild(valEl); inner.appendChild(row);
      }
      item.appendChild(dot); item.appendChild(inner);
      item.setAttribute("role", "button"); item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", (ev.content || ev.tags.join(", ") || "אירוע").slice(0, 80));
      item.addEventListener("click", () => selectTlEvent(ev));
      item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTlEvent(ev); } });
      list.appendChild(item);
    }
  }
  wrap.appendChild(list);
  return wrap;
}

function buildAiPanel(events) {
  const panel = document.createElement("div"); panel.className = "tlAi";
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
  return panel;
}

function mkAiCard(label, val, sub) {
  const c = document.createElement("div"); c.className = "tlAiCard";
  c.innerHTML = `<div class="tlAiLabel">${escapeHtml(label)}</div><div class="tlAiVal">${escapeHtml(val)}</div><div class="tlAiSub">${escapeHtml(sub)}</div>`;
  return c;
}

function selectTlEvent(ev, scroll = true) {
  timelineState.selectedEventId = ev.id;
  document.querySelectorAll(".tlListItem").forEach(el => el.classList.toggle("tlListActive", el.dataset.eventId === ev.id));
  document.querySelectorAll(".tlNode[data-event-id]").forEach(el => el.classList.toggle("tlSel", el.dataset.eventId === ev.id));
  const panel = $("tlDetailPanel"); if (!panel) return;
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
        <div class="tlDetailTitle">${escapeHtml(title)}</div>
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
  metaBtn.className = "tlMetaBtn";
  metaBtn.textContent = "הצג metadata";
  metaBtn.addEventListener("click", () => {
    const existing = metaSection.querySelector(".tlMetaBox");
    if (existing) { existing.remove(); metaBtn.textContent = "הצג metadata"; return; }
    const box = document.createElement("pre");
    box.className = "tlMetaBox";
    box.textContent = ev.metadata != null ? JSON.stringify(ev.metadata, null, 2) : "(אין metadata לרשומה זו)";
    metaSection.appendChild(box);
    metaBtn.textContent = "הסתר metadata";
  });
  metaSection.appendChild(buildTimelineLinksPanel(ev));
  metaSection.appendChild(metaBtn);
  if (scroll) { const listItem = document.querySelector(`.tlListItem[data-event-id="${ev.id}"]`); listItem?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}

function buildTimelineLinksPanel(ev) {
  const panel = document.createElement("div");
  panel.className = "tlLinksPanel";
  const title = document.createElement("div");
  title.className = "tlLinksTitle";
  title.innerHTML = `<strong>קשרים</strong><span>${timelineLinksForEvent(ev).length} קשרים</span>`;
  panel.appendChild(title);

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
  panel.appendChild(list);
  panel.appendChild(buildTimelineLinkForm(ev));
  panel.appendChild(buildTimelineSuggestionsPanel(ev));
  return panel;
}

function buildTimelineLinkRow(link, ev) {
  const row = document.createElement("div");
  row.className = "tlLinkRow";
  const isOutgoing = String(link.source_event_id) === String(ev.id) && link.source_event_source === getTimelineEventSource(ev);
  const otherTitle = isOutgoing ? link.target_title : link.source_title;
  const meta = [
    isOutgoing ? "יוצא" : "נכנס",
    relationLabel(link.relation_type),
    formatTimelineLinkDuration(link),
    link.approver ? `מאשר: ${link.approver}` : ""
  ].filter(Boolean).join(" · ");
  const text = document.createElement("div");
  text.className = "tlLinkText";
  text.innerHTML = `<strong>${escapeHtml(otherTitle || "אירוע קשור")}</strong><span>${escapeHtml(meta)}</span>${link.note ? `<small>${escapeHtml(link.note)}</small>` : ""}`;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "tlLinkDelete";
  del.textContent = "מחק";
  del.addEventListener("click", async () => {
    del.disabled = true;
    try {
      await api(`/api/timeline/links/${encodeURIComponent(link.id)}`, { method: "DELETE" });
      await refreshTimelineLinks();
    } catch (error) {
      showToast(`שגיאה במחיקת קשר: ${error.message}`, "error");
      del.disabled = false;
    }
  });
  row.append(text, del);
  return row;
}

function buildTimelineLinkForm(sourceEvent) {
  const form = document.createElement("form");
  form.className = "tlLinkForm";
  const candidates = timelineState.events.filter((event) => event.id !== sourceEvent.id);
  form.innerHTML = `
    <div class="tlFormGrid">
      <label>אירוע יעד<select name="target">${candidates.map((event) => `<option value="${escapeHtml(String(event.id))}">${escapeHtml(shortEventOption(event))}</option>`).join("")}</select></label>
      <label>סוג קשר<select name="relation">
        ${Object.entries(timelineRelationLabels()).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}
      </select></label>
      <label>מי אישר<input name="approver" placeholder="שם המאשר, אם ידוע" /></label>
      <label>הערה<input name="note" placeholder="הערה קצרה" /></label>
    </div>
    <button type="submit" ${candidates.length ? "" : "disabled"}>קשר אירוע</button>
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
      showToast("הקשר נשמר");
      await refreshTimelineLinks();
    } catch (error) {
      showToast(`שגיאה בשמירת קשר: ${error.message}`, "error");
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
      const result = await loadSmartTimelineSuggestionsForEvent(currentEvent.id);
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

function timelineEventTitle(event) {
  return (event?.content || getMailSummarize(event) || event?.tags?.join(", ") || "אירוע ללא כותרת").slice(0, 180);
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
  for (const ev of events) {
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

// ---- Calendar ----
function renderCalendar() {
  const container = $("timelineContainer");
  const filtered = getFilteredTimelineEvents();

  const year  = timelineState.calYear  ?? new Date().getFullYear();
  const month = timelineState.calMonth ?? new Date().getMonth();

  const byDay = new Map();
  for (const ev of filtered) {
    const d = new Date(ev.date);
    if (isNaN(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(ev);
  }

  container.innerHTML = "";

  const nav = document.createElement("div");
  nav.className = "calNav";
  const monthName = new Date(year, month, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  nav.innerHTML = `
    <button class="calNavBtn" id="calPrev">&#8250;</button>
    <span class="calNavTitle">${escapeHtml(monthName)}</span>
    <button class="calNavBtn" id="calNext">&#8249;</button>
  `;
  nav.querySelector("#calPrev").addEventListener("click", () => {
    if (timelineState.calMonth === 0) { timelineState.calMonth = 11; timelineState.calYear--; }
    else timelineState.calMonth--;
    timelineState.calSelectedDate = null;
    renderCalendar();
  });
  nav.querySelector("#calNext").addEventListener("click", () => {
    if (timelineState.calMonth === 11) { timelineState.calMonth = 0; timelineState.calYear++; }
    else timelineState.calMonth++;
    timelineState.calSelectedDate = null;
    renderCalendar();
  });
  container.appendChild(nav);

  const grid = document.createElement("div");
  grid.className = "calGrid";
  for (const lbl of ["א", "ב", "ג", "ד", "ה", "ו", "ש"]) {
    const el = document.createElement("div");
    el.className = "calDayLabel";
    el.textContent = lbl;
    grid.appendChild(el);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calCell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayEvents = byDay.get(key) || [];
    const isSelected = timelineState.calSelectedDate === key;
    const cell = document.createElement("div");
    cell.className = "calCell" + (dayEvents.length ? " has-events" : "") + (isSelected ? " selected" : "");

    const numEl = document.createElement("div");
    numEl.className = "calCellNum";
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (dayEvents.length) {
      const dots = document.createElement("div");
      dots.className = "calDots";
      const maxDots = Math.min(dayEvents.length, 5);
      for (let i = 0; i < maxDots; i++) {
        const dot = document.createElement("div");
        dot.className = "calDot";
        dots.appendChild(dot);
      }
      if (dayEvents.length > 5) {
        const more = document.createElement("span");
        more.style.cssText = "font-size:10px;color:var(--text-muted);line-height:6px;";
        more.textContent = `+${dayEvents.length - 5}`;
        dots.appendChild(more);
      }
      cell.appendChild(dots);
      cell.addEventListener("click", () => {
        timelineState.calSelectedDate = isSelected ? null : key;
        renderCalendar();
      });
    }
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  if (timelineState.calSelectedDate && byDay.has(timelineState.calSelectedDate)) {
    const panel = document.createElement("div");
    panel.className = "calDayPanel";
    const selDate = new Date(timelineState.calSelectedDate);
    const titleEl = document.createElement("div");
    titleEl.className = "calDayPanelTitle";
    titleEl.textContent = selDate.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    panel.appendChild(titleEl);
    for (const ev of byDay.get(timelineState.calSelectedDate)) panel.appendChild(buildEventCard(ev));
    container.appendChild(panel);
  }
}

function buildEventCard(ev) {
  const card = document.createElement("div"); card.className = "tlCard";
  const d = new Date(ev.date);
  const dateStr = isNaN(d) ? "" : d.toLocaleDateString("he-IL",{day:"numeric",month:"short",year:"numeric"});
  const excerpt = (ev.content || "").slice(0, 140).replace(/\n/g," ");
  card.innerHTML = `<div class="tlCardDate">${escapeHtml(dateStr)}</div><div class="tlCardContent">${escapeHtml(excerpt)}${ev.content && ev.content.length > 140 ? "..." : ""}</div>${ev.tags.length ? `<div class="tlCardTags"></div>` : ""}`;
  if (ev.tags.length) {
    const tagsEl = card.querySelector(".tlCardTags");
    for (const t of ev.tags) {
      const chip = document.createElement("span"); chip.className = "tagBadge"; chip.textContent = "#"+t;
      tagsEl.appendChild(chip);
    }
  }
  return card;
}

function wireTimeline() {
  document.querySelectorAll(".tlSrcBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.src === timelineState.source) return;
      document.querySelectorAll(".tlSrcBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      timelineState.source = btn.dataset.src;
      timelineState.activeTags.clear();
      timelineState.viewportStart = null;
      timelineState.selectedEventId = null;
      loadTimeline();
    });
  });

  $("timelineResolution")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".resBtn"); if (!btn) return;
    document.querySelectorAll(".resBtn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
    btn.classList.add("active"); btn.setAttribute("aria-pressed", "true");
    timelineState.resolution = btn.dataset.res;
    timelineState.viewportStart = null;
    timelineState.selectedEventId = null;
    timelineDebug("resolution", { resolution: timelineState.resolution });
    renderTimeline();
  });
  document.querySelectorAll(".resBtn").forEach(b => b.setAttribute("aria-pressed", b.classList.contains("active") ? "true" : "false"));
  $("refreshTimeline")?.setAttribute("aria-label", "רענן ציר זמן");
  $("refreshTimeline")?.addEventListener("click", loadTimeline);
  $("timelineSearch")?.addEventListener("input", (event) => {
    timelineState.searchQuery = event.target.value || "";
    timelineState.selectedEventId = null;
    renderTimeline();
  });

  const tagsBtn = $("tlTagsBtn");
  const tagsDropdown = $("tlTagsDropdown");
  if (tagsBtn && tagsDropdown) {
    tagsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !tagsDropdown.hidden;
      tagsDropdown.hidden = open;
      tagsBtn.classList.toggle("open", !open);
    });
    document.addEventListener("click", () => {
      tagsDropdown.hidden = true;
      tagsBtn.classList.remove("open");
    });
  }
}

// ── QA ────────────────────────────────────────────────────────────────────────

function wireQa() {
  $("refreshQa")?.addEventListener("click", loadQaList);
  $("trendQa")?.addEventListener("click", runTrendAnalysis);
}

async function loadQaList() {
  const list = $("qaList");
  list.textContent = "טוען...";
  let messages;
  try {
    const result = await api("/api/qa/dislikes");
    messages = result.messages || [];
  } catch (err) {
    list.textContent = `שגיאה: ${escapeHtml(err.message)}`;
    return;
  }

  list.innerHTML = "";

  if (!messages.length) {
    list.innerHTML = '<p class="hint" style="padding:20px">אין הודעות שנדחו עדיין.</p>';
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

    loadExistingQaReport(msg.id, card);
  }
}

async function loadExistingQaReport(messageId, card) {
  try {
    const result = await api(`/api/qa/${encodeURIComponent(messageId)}/report`);
    if (result.report) renderQaReport(result.report, messageId, card);
  } catch (_) {
    // 404 = no report yet
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

  reportEl.innerHTML = `
    <div class="qaReportBox">
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
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;
  try {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller?.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("הבקשה נתקעה יותר מדי זמן. נסה שוב או בדוק את חיבורי השירותים.");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
