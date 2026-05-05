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
  eventSource: null
};

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
  $("refreshHistory").addEventListener("click", loadHistory);
  await loadSettings();
  await loadHistory();
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $(button.dataset.tab).classList.add("active");
    });
  });
}

function wireChat() {
  $("sessionId").addEventListener("change", () => localStorage.setItem("sessionId", $("sessionId").value));
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
}

function wireWorkflow() {
  $("clearWorkflow").addEventListener("click", () => {
    state.lastWorkflow = null;
    renderWorkflow(null);
  });
}

function renderWorkflow(workflow) {
  const board = $("workflowBoard");
  const nodesLayer = $("workflowNodes");
  const cables = $("workflowCables");
  nodesLayer.innerHTML = "";
  cables.innerHTML = "";

  if (!workflow?.nodes?.length) {
    $("workflowHint").style.display = "block";
    board.classList.remove("hasWorkflow");
    return;
  }

  $("workflowHint").style.display = "none";
  board.classList.add("hasWorkflow");

  const positions = layoutWorkflow(workflow.nodes);
  board.style.minHeight = `${Math.max(...Object.values(positions).map((position) => position.y)) + 360}px`;

  for (const node of workflow.nodes) {
    const position = positions[node.id] || { x: 40, y: 40 };
    const element = document.createElement("article");
    element.className = `workflowNode ${node.kind} ${node.status}`;
    element.id = `workflow_${node.id}`;
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.innerHTML = `
      <div class="workflowNodeHeader">
        <span class="workflowIcon">${iconForNode(node.kind)}</span>
        <strong>${escapeHtml(node.label)}</strong>
        <span class="workflowStatus">${statusLabel(node.status)}</span>
      </div>
      <details open>
        <summary>Input</summary>
        <pre>${escapeHtml(JSON.stringify(node.input, null, 2))}</pre>
      </details>
      <details open>
        <summary>Output</summary>
        <pre>${escapeHtml(JSON.stringify(node.output, null, 2))}</pre>
      </details>
    `;
    nodesLayer.append(element);
  }

  requestAnimationFrame(() => drawCables(workflow.edges || [], positions));
}

function layoutWorkflow(nodes) {
  const order = nodes.map((node) => node.id);
  const positions = {};
  const colWidth = 360;
  const rowHeight = 430;
  const startX = 32;
  const startY = 28;
  order.forEach((id, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    positions[id] = {
      x: startX + col * colWidth,
      y: startY + row * rowHeight
    };
  });
  return positions;
}

function drawCables(edges, positions) {
  const cables = $("workflowCables");
  const board = $("workflowBoard");
  const boardRect = board.getBoundingClientRect();
  cables.setAttribute("width", board.scrollWidth);
  cables.setAttribute("height", board.scrollHeight);
  cables.setAttribute("viewBox", `0 0 ${board.scrollWidth} ${board.scrollHeight}`);

  for (const edge of edges) {
    const from = $(`workflow_${edge.from}`);
    const to = $(`workflow_${edge.to}`);
    if (!from || !to) continue;
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const start = {
      x: fromRect.left - boardRect.left + board.scrollLeft + fromRect.width,
      y: fromRect.top - boardRect.top + board.scrollTop + 42
    };
    const end = {
      x: toRect.left - boardRect.left + board.scrollLeft,
      y: toRect.top - boardRect.top + board.scrollTop + 42
    };
    const distance = Math.max(80, Math.abs(end.x - start.x) / 2);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + distance} ${start.y}, ${end.x - distance} ${end.y}, ${end.x} ${end.y}`);
    path.setAttribute("class", "workflowCable");
    cables.append(path);
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
      tools: Object.fromEntries(n8nTools.map((tool) => [tool, $(`tool_${tool}`).value]))
    };
    await api("/api/settings", { method: "PUT", body });
    await loadSettings();
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
  $("modelClassifier").value = state.settings.models.classifier;
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
    item.textContent = `${session.sessionId} - ${session.status || ""}`;
    item.addEventListener("click", async () => {
      $("sessionId").value = session.sessionId;
      localStorage.setItem("sessionId", session.sessionId);
      await loadSessionMessages(session.sessionId);
      document.querySelector('[data-tab="chat"]').click();
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
