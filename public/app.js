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
  fullLogVisible: false
};

const WORKFLOW_NODE_WIDTH = 152;
const WORKFLOW_NODE_HEIGHT = 124;

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
  { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", x: 2666, y: 176, description: "Calls configured external n8n tool webhooks." },
  { id: "source_quality", label: "Source Quality", kind: "router", x: 2882, y: 176, description: "Scores the reliability and freshness of retrieved/tool sources." },
  { id: "conflict_detection", label: "Conflict Detection", kind: "router", x: 3098, y: 176, description: "Highlights possible contradictions across sources before synthesis." },
  { id: "main_agent", label: "Main RAG Agent", kind: "ai", x: 3314, y: 176, description: "Synthesizes the final grounded answer from retrieval, tools and plans." },
  { id: "update_message", label: "Update DB", kind: "database", x: 3530, y: 92, description: "Updates chat_messages_gf with the final answer and status." },

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
  ["switch", "knowledge_planner"],
  ["knowledge_vocabulary", "knowledge_planner"],
  ["safety_precheck", "knowledge_planner"],
  ["investigation", "knowledge_planner"],
  ["switch", "hybrid_search"],
  ["safety_precheck", "hybrid_search"],
  ["investigation", "hybrid_search"],
  ["knowledge_planner", "hybrid_search"],
  ["hybrid_search", "reranker"],
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
  settings:  () => loadSettings(),
  agents:    () => loadAgentsTabData(),
  knowledge: () => loadKnowledgeDocuments(),
  history:   () => loadHistory(),
  timeline:  () => loadTimeline()
};

async function loadAgentsTabData() {
  await refreshAgentsFromApi();
  await loadOpenRouterModels();
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
    const pending = addMessage("חושב...", "assistant");
    startLiveRun(runId);
    const button = event.submitter;
    button.disabled = true;
    try {
      const result = await api("/api/chat", {
        method: "POST",
        body: { message, sessionId: $("sessionId").value, runId }
      });
      pending.textContent = result.answer || "לא התקבלה תשובה.";
      appendDebug(pending, result);
      state.lastWorkflow = result.workflowLog || null;
      renderWorkflow(state.lastWorkflow);
    } catch (error) {
      pending.textContent = `שגיאה: ${error.message}`;
      appendLiveRunEvent({ step: "client", message: "Request failed", data: { error: error.message }, time: new Date().toISOString() });
    } finally {
      button.disabled = false;
    }
  });
}

function startLiveRun(runId) {
  if (state.eventSource) state.eventSource.close();
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
  const board = $("workflowBoard");
  const nodesLayer = $("workflowNodes");
  const cables = $("workflowCables");
  const inspector = $("workflowInspector");
  nodesLayer.innerHTML = "";
  cables.innerHTML = "";
  if (inspector) inspector.innerHTML = '<div class="workflowInspectorEmpty">בחר רכיב בגרף כדי לראות Input / Output.</div>';

  const view = buildWorkflowView(workflow);
  const hasRun = Boolean(workflow?.nodes?.length);
  $("workflowHint").style.display = hasRun ? "none" : "block";
  board.classList.toggle("hasWorkflow", hasRun);

  const positions = layoutWorkflow(view.nodes, view.edges);
  const bounds = workflowBounds(positions);
  board.style.minHeight = `${Math.max(660, bounds.height + 120)}px`;
  nodesLayer.style.width = `${Math.max(1180, bounds.width + 420)}px`;
  nodesLayer.style.height = `${Math.max(620, bounds.height + 120)}px`;

  view.nodes.forEach((node, index) => {
    const position = positions[node.id] || { x: 40, y: 40 };
    const element = document.createElement("button");
    element.type = "button";
    element.className = [
      "workflowNode",
      node.kind,
      node.status,
      node.used ? "used" : "unused",
      node.disconnected ? "disconnected" : "",
      index === 0 ? "selected" : ""
    ].filter(Boolean).join(" ");
    element.id = `workflow_${node.id}`;
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.setAttribute("aria-label", node.label);
    element.innerHTML = `
      <span class="workflowNodeHalo"></span>
      <span class="workflowIcon">${iconForNode(node.kind)}</span>
      <span class="workflowNodeText">
        <strong>${escapeHtml(node.label)}</strong>
        <small>${escapeHtml(node.id)}</small>
      </span>
      <span class="workflowStatus">${statusLabel(node.status)}</span>
    `;
    element.addEventListener("click", () => {
      document.querySelectorAll(".workflowNode").forEach((item) => item.classList.remove("selected"));
      element.classList.add("selected");
      renderWorkflowInspector(node);
    });
    nodesLayer.append(element);
  });

  if (view.nodes[0]) renderWorkflowInspector(view.nodes[0]);

  requestAnimationFrame(() => drawCables(view.edges, positions, view.activeEdgeKeys));
}

function buildWorkflowView(workflow) {
  const runtimeNodes = new Map((workflow?.nodes || []).map((node) => [node.id, node]));
  const runtimeIds = new Set(runtimeNodes.keys());
  const activeEdgeKeys = new Set((workflow?.edges || []).map(edgeKey));
  const templateIds = new Set(WORKFLOW_TEMPLATE_NODES.map((node) => node.id));
  const nodes = WORKFLOW_TEMPLATE_NODES.map((node) => {
    const runtime = runtimeNodes.get(node.id);
    const input = runtime?.input ?? { description: node.description || "", configured_component: true };
    const output = runtime?.output ?? (node.disconnected
      ? { isolated: true, reason: "This management component is not connected to automatic chat runs." }
      : { status: "not used in the last run" });
    return {
      ...node,
      ...(runtime || {}),
      label: runtime?.label || node.label,
      kind: runtime?.kind || node.kind,
      status: runtime?.status || (node.disconnected ? "disconnected" : "idle"),
      used: runtimeIds.has(node.id),
      disconnected: Boolean(node.disconnected),
      input,
      output
    };
  });

  for (const runtime of runtimeNodes.values()) {
    if (!templateIds.has(runtime.id)) nodes.push({ ...runtime, used: true });
  }

  const edgeKeys = new Set();
  const edges = [];
  for (const edge of WORKFLOW_TEMPLATE_EDGES) {
    const key = edgeKey(edge);
    edgeKeys.add(key);
    edges.push({ ...edge, active: activeEdgeKeys.has(key) });
  }
  for (const edge of workflow?.edges || []) {
    const key = edgeKey(edge);
    if (!edgeKeys.has(key)) edges.push({ ...edge, active: true });
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

function layoutWorkflow(nodes, edges = []) {
  if (nodes.some((node) => Number.isFinite(node.x) && Number.isFinite(node.y))) {
    return Object.fromEntries(nodes.map((node) => [
      node.id,
      Number.isFinite(node.x) && Number.isFinite(node.y)
        ? { x: node.x, y: node.y }
        : { x: 40, y: 40 }
    ]));
  }
  const order = topologicalWorkflowOrder(nodes, edges);
  const positions = {};
  const colWidth = 210;
  const rowHeight = 150;
  const startX = 70;
  const startY = 86;
  order.forEach((id, index) => {
    const row = index % 2;
    const col = Math.floor(index / 2);
    positions[id] = {
      x: startX + col * colWidth,
      y: startY + row * rowHeight
    };
  });
  return positions;
}

function topologicalWorkflowOrder(nodes, edges) {
  const ids = nodes.map((node) => node.id);
  const byId = new Set(ids);
  const incoming = Object.fromEntries(ids.map((id) => [id, 0]));
  const outgoing = Object.fromEntries(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    incoming[edge.to] += 1;
    outgoing[edge.from].push(edge.to);
  }
  const queue = ids.filter((id) => incoming[id] === 0);
  const ordered = [];
  while (queue.length) {
    const id = queue.shift();
    ordered.push(id);
    for (const next of outgoing[id]) {
      incoming[next] -= 1;
      if (incoming[next] === 0) queue.push(next);
    }
  }
  return ordered.length === ids.length ? ordered : ids;
}

function workflowBounds(positions) {
  const values = Object.values(positions);
  if (!values.length) return { width: 0, height: 0 };
  return {
    width: Math.max(...values.map((position) => position.x)) + WORKFLOW_NODE_WIDTH + 70,
    height: Math.max(...values.map((position) => position.y)) + WORKFLOW_NODE_HEIGHT + 70
  };
}

function edgeKey(edge) {
  return `${edge.from}->${edge.to}`;
}

function drawCables(edges, positions, activeEdgeKeys = new Set()) {
  const cables = $("workflowCables");
  const board = $("workflowBoard");
  cables.innerHTML = `
    <defs>
      <marker id="workflowArrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z"></path>
      </marker>
      <marker id="workflowArrowDormant" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z"></path>
      </marker>
    </defs>
  `;
  cables.setAttribute("width", board.scrollWidth);
  cables.setAttribute("height", board.scrollHeight);
  cables.setAttribute("viewBox", `0 0 ${board.scrollWidth} ${board.scrollHeight}`);

  for (const edge of edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) continue;
    const start = {
      x: from.x + WORKFLOW_NODE_WIDTH,
      y: from.y + WORKFLOW_NODE_HEIGHT / 2
    };
    const end = {
      x: to.x,
      y: to.y + WORKFLOW_NODE_HEIGHT / 2
    };
    const distance = Math.max(70, Math.abs(end.x - start.x) / 2);
    const active = Boolean(edge.active || activeEdgeKeys.has(edgeKey(edge)));
    const cableClass = active ? "active" : "dormant";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + distance} ${start.y}, ${end.x - distance} ${end.y}, ${end.x} ${end.y}`);
    path.setAttribute("class", `workflowCable ${cableClass}`);
    path.setAttribute("marker-end", active ? "url(#workflowArrowActive)" : "url(#workflowArrowDormant)");
    cables.append(path);

    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.setAttribute("d", path.getAttribute("d"));
    hitPath.setAttribute("class", `workflowCable workflowCableGlow ${cableClass}`);
    cables.insertBefore(hitPath, path);
  }
}

function iconForNode(kind) {
  return {
    trigger: "▶",
    code: "{}",
    database: "DB",
    memory: "MEM",
    ai: "AI",
    router: "↯",
    vector: "IDX",
    tool: "API"
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
  $("openRouterApiKey").value = state.settings.secrets.openRouterApiKey || "";
  $("supabaseUrl").value = state.settings.secrets.supabaseUrl || "";
  $("supabaseServiceRoleKey").value = state.settings.secrets.supabaseServiceRoleKey || "";

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

async function loadSessionMessages(sessionId) {
  const result = await api(`/api/sessions/${encodeURIComponent(sessionId)}/messages`);
  $("messages").innerHTML = "";
  for (const row of result.messages) {
    if (row.user_message) addMessage(row.user_message, "user");
    if (row.ai_response) addMessage(row.ai_response, "assistant");
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
  selectedEventId: null,
  searchQuery: "",
  viewportStart: null
};

function timelineDebug(message, data = {}) {
  console.debug("[timeline]", message, data);
}

async function loadTimeline() {
  const container = $("timelineContainer");
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#2e4050;font-size:13px;">טוען...</div>';
  try {
    const { events } = await api("/api/timeline");
    timelineState.events = events || [];
    if (timelineState.events.length && timelineState.calYear === null) {
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
  clearBtn.addEventListener("click", () => { timelineState.activeTags.clear(); renderTimelineFilters(); renderTimeline(); });
  bar.appendChild(clearBtn);
  for (const tag of allTags) {
    const btn = Object.assign(document.createElement("button"), {
      className: "tagChip" + (timelineState.activeTags.has(tag) ? " active" : ""),
      textContent: "#" + tag
    });
    btn.addEventListener("click", () => {
      if (timelineState.activeTags.has(tag)) timelineState.activeTags.delete(tag);
      else timelineState.activeTags.add(tag);
      renderTimelineFilters(); renderTimeline();
    });
    bar.appendChild(btn);
  }
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

  // Defs
  const defs = document.createElementNS(NS, "defs");
  const grad = mkGrad(NS, "tlWG", [{o:"0%",c:"#00c9a7",a:.32},{o:"60%",c:"#0d4a3a",a:.14},{o:"100%",c:"#080b14",a:0}]);
  const grad2 = mkGrad(NS, "tlWG2", [{o:"0%",c:"#3b82f6",a:.14},{o:"100%",c:"#080b14",a:0}]);
  const filt = document.createElementNS(NS, "filter");
  filt.setAttribute("id","tlGlow"); filt.setAttribute("x","-20%"); filt.setAttribute("y","-20%");
  filt.setAttribute("width","140%"); filt.setAttribute("height","140%");
  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("stdDeviation","3"); blur.setAttribute("result","b");
  const merge = document.createElementNS(NS, "feMerge");
  ["b","SourceGraphic"].forEach(v => { const n = document.createElementNS(NS,"feMergeNode"); n.setAttribute("in",v); merge.appendChild(n); });
  filt.appendChild(blur); filt.appendChild(merge);
  [grad, grad2, filt].forEach(n => defs.appendChild(n));
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

  const fill = document.createElementNS(NS,"path"); fill.setAttribute("d", pd + ` L${VW},${VH} L0,${VH} Z`); fill.setAttribute("fill","url(#tlWG)"); svg.appendChild(fill);
  const fill2pts = allPts.map((p,i) => ({ x: p.x, y: Math.min(BASE, p.y + (norm[Math.max(0,i-1)] || 0) * 14 + 10) }));
  const f2 = document.createElementNS(NS,"path"); f2.setAttribute("d", catmullRom(fill2pts) + ` L${VW},${VH} L0,${VH} Z`); f2.setAttribute("fill","url(#tlWG2)"); f2.setAttribute("opacity","0.65"); svg.appendChild(f2);
  const stroke = document.createElementNS(NS,"path"); stroke.setAttribute("d",pd); stroke.setAttribute("fill","none"); stroke.setAttribute("stroke","#00c9a7"); stroke.setAttribute("stroke-width","1.2"); stroke.setAttribute("opacity","0.65"); stroke.setAttribute("filter","url(#tlGlow)"); svg.appendChild(stroke);
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
      node.className = `tlNode tl-${type}` + (isCluster ? " tlCluster" : "");
      node.style.left = `${xPct}%`; node.style.top = `${yPct}%`;
      node.textContent = isCluster ? String(evs.length) : getEventIcon(type);
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
      const dot = document.createElement("div"); dot.className = "tlListDot"; dot.style.background = getTypeColor(type);
      const wrap = document.createElement("div"); wrap.style.cssText = "flex:1;min-width:0;";
      const meta = document.createElement("div"); meta.className = "tlListMeta"; meta.textContent = d.toLocaleDateString("he-IL",{day:"numeric",month:"short"});
      const txt = document.createElement("div"); txt.className = "tlListText"; txt.textContent = ev.content || ev.tags.join(", ") || "—";
      wrap.appendChild(meta); wrap.appendChild(txt); item.appendChild(dot); item.appendChild(wrap);
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", (ev.content || ev.tags.join(", ") || "אירוע").slice(0, 80));
      item.addEventListener("click", () => selectTlEvent(ev));
      item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTlEvent(ev); } });
      list.appendChild(item);
    }
  }
  return list;
}

function buildAiPanel(events) {
  const panel = document.createElement("div"); panel.className = "tlAi";
  const total = events.length;
  const types = {};
  for (const ev of events) { const t = classifyEvent(ev); types[t] = (types[t]||0)+1; }
  const allTags = [...new Set(events.flatMap(e => e.tags))];
  const topType = Object.entries(types).sort((a,b) => b[1]-a[1])[0];
  const dates = events.map(e => new Date(e.date)).filter(d => !isNaN(d));
  const dayRange = dates.length ? Math.round((Math.max(...dates.map(d=>d.getTime())) - Math.min(...dates.map(d=>d.getTime()))) / 86400000) : 0;
  const typeLabels = { meeting:"פגישות", document:"מסמכים", alert:"התראות", email:"אימייל", decision:"החלטות", default:"כללי", critical:"קריטי" };

  panel.appendChild(mkAiCard("סה״כ אירועים", String(total), `${allTags.length} תגיות ייחודיות`));
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
    ${ev.tags.length ? `<div class="tlDetailTags">${ev.tags.map(t => `<span class="tlDetailTag" style="background:${hexA(color,.13)};color:${color};border:1px solid ${hexA(color,.28)};">#${escapeHtml(t)}</span>`).join("")}</div>` : ""}
  `;
  if (scroll) { const listItem = document.querySelector(`.tlListItem[data-event-id="${ev.id}"]`); listItem?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
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

function classifyEvent(ev) {
  const tags = ev.tags.map(t => t.toLowerCase());
  if (tags.some(t => /פגישה|ישיבה|meeting|zoom|call/.test(t)))    return "meeting";
  if (tags.some(t => /מסמך|דוח|תכנ|document|report|plan/.test(t))) return "document";
  if (tags.some(t => /התראה|alert|warning|risk|סיכון|חריג/.test(t))) return "alert";
  if (tags.some(t => /אימייל|email|mail|הודעה/.test(t)))            return "email";
  if (tags.some(t => /החלטה|decision|approval|אישור/.test(t)))      return "decision";
  if (tags.some(t => /קריטי|critical|urgent|דחוף/.test(t)))         return "critical";
  return "default";
}

function getEventIcon(type) {
  return { meeting:"M", document:"D", alert:"!", email:"@", decision:"OK", critical:"!", default:"•" }[type] || "•";
}

function getTypeColor(type) { return TYPE_COLORS[type] || TYPE_COLORS.default; }

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
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
