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
  runEvents: [],
  fullLogVisible: false
};

const WORKFLOW_NODE_WIDTH = 152;
const WORKFLOW_NODE_HEIGHT = 124;

const $ = (id) => document.getElementById(id);

init();

async function init() {
  $("sessionId").value = localStorage.getItem("sessionId") || `local_${Date.now()}`;
  localStorage.setItem("sessionId", $("sessionId").value);
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
  if (initialTab !== "knowledge") await loadKnowledgeDocuments();
  if (initialTab !== "history")   await loadHistory();
}

const TAB_LOADERS = {
  settings:  () => loadSettings(),
  agents:    () => loadAgentsTabData(),
  knowledge: () => loadKnowledgeDocuments(),
  history:   () => loadHistory()
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
  if (tabId === "workflow" && state.lastWorkflow) {
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
  $("sessionId").addEventListener("change", () => localStorage.setItem("sessionId", $("sessionId").value));

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
  const result = await api("/api/knowledge/documents");
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
    button.addEventListener("click", () => openKnowledgeDocument(item.filename));
    list.append(button);
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
      body: { filename: file.name, content }
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

async function openKnowledgeDocument(filename) {
  const result = await api(`/api/knowledge/documents/${encodeURIComponent(filename)}`);
  state.selectedKnowledgeDocument = filename;
  $("knowledgePreviewTitle").textContent = result.document.filename;
  $("knowledgePreview").textContent = result.document.content || "";
  $("deleteKnowledge").disabled = false;
}

async function deleteSelectedKnowledgeDocument() {
  if (!state.selectedKnowledgeDocument) return;
  const filename = state.selectedKnowledgeDocument;
  $("deleteKnowledge").disabled = true;
  try {
    await api(`/api/knowledge/documents/${encodeURIComponent(filename)}`, { method: "DELETE" });
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

  if (!workflow?.nodes?.length) {
    $("workflowHint").style.display = "block";
    board.classList.remove("hasWorkflow");
    return;
  }

  $("workflowHint").style.display = "none";
  board.classList.add("hasWorkflow");

  const positions = layoutWorkflow(workflow.nodes, workflow.edges || []);
  const bounds = workflowBounds(positions);
  board.style.minHeight = `${Math.max(660, bounds.height + 120)}px`;
  nodesLayer.style.width = `${Math.max(1180, bounds.width + 420)}px`;
  nodesLayer.style.height = `${Math.max(620, bounds.height + 120)}px`;

  workflow.nodes.forEach((node, index) => {
    const position = positions[node.id] || { x: 40, y: 40 };
    const element = document.createElement("button");
    element.type = "button";
    element.className = `workflowNode ${node.kind} ${node.status} ${index === 0 ? "selected" : ""}`;
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

  if (workflow.nodes[0]) renderWorkflowInspector(workflow.nodes[0]);

  requestAnimationFrame(() => drawCables(workflow.edges || [], positions));
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

function drawCables(edges, positions) {
  const cables = $("workflowCables");
  const board = $("workflowBoard");
  cables.innerHTML = `
    <defs>
      <marker id="workflowArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
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
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + distance} ${start.y}, ${end.x - distance} ${end.y}, ${end.x} ${end.y}`);
    path.setAttribute("class", "workflowCable");
    path.setAttribute("marker-end", "url(#workflowArrow)");
    cables.append(path);

    const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitPath.setAttribute("d", path.getAttribute("d"));
    hitPath.setAttribute("class", "workflowCable workflowCableGlow");
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
    done: "בוצע",
    error: "שגיאה",
    skipped: "דולג"
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
  renderAgents();
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
      $("sessionId").value = sessionId;
      localStorage.setItem("sessionId", sessionId);
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
