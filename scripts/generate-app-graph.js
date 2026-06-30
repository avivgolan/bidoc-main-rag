import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "bedrock", "Outputs", "app-graph");
const srcDir = path.join(root, "src");
const publicDir = path.join(root, "public");

const nodes = new Map();
const edges = new Map();

function addNode(id, label, type, extra = {}) {
  if (!nodes.has(id)) {
    nodes.set(id, { id, label, type, ...extra });
    return nodes.get(id);
  }
  Object.assign(nodes.get(id), extra);
  return nodes.get(id);
}

function addEdge(source, target, type, extra = {}) {
  if (!source || !target || source === target) return;
  const id = `${source}->${target}:${type}`;
  if (!edges.has(id)) edges.set(id, { id, source, target, type, ...extra });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full, predicate));
    else if (predicate(full)) output.push(full);
  }
  return output;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function fileNodeId(file) {
  return `file:${rel(file)}`;
}

function normalizeImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return `external:${specifier.split("/")[0]}`;
  let resolved = path.resolve(path.dirname(fromFile), specifier);
  if (!path.extname(resolved)) resolved += ".js";
  return fs.existsSync(resolved) ? fileNodeId(resolved) : `missing:${rel(resolved)}`;
}

function firstHeading(text) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function addExternalNodes() {
  addNode("external:OpenRouter", "OpenRouter", "external", {
    summary: "Chat, embeddings, reranking, models list."
  });
  addNode("external:App Supabase", "App Supabase", "external", {
    summary: "Settings, messages, run history, QA, graph tables."
  });
  addNode("external:Content Supabase", "Content Supabase", "external", {
    summary: "RAG index, alerts, timeline events, content RPCs."
  });
  addNode("external:n8n", "n8n webhooks", "external", {
    summary: "Optional external tools such as meetings, emails, safety and quality reports."
  });
  addNode("external:Browser", "Browser", "external", {
    summary: "Plain SPA runtime."
  });
}

function addDomainNodes() {
  const domains = [
    ["domain:Chat Pipeline", "Chat Pipeline", "domain", "Sanitize, classify, retrieve, tool-call, synthesize, persist."],
    ["domain:Workflow QA", "Workflow QA", "domain", "Run history, Cytoscape workflow canvas, QA reports and comparisons."],
    ["domain:Timeline", "Timeline", "domain", "Timeline events, links, graph rebuild and UI browsing."],
    ["domain:Project Graph", "Project Graph", "domain", "Semantic entity graph over project data."],
    ["domain:Insights", "Insights", "domain", "Index-first project insight analysis and history."],
    ["domain:Delay Claims", "Delay Claims", "domain", "Delay claim cases, events, analysis and packages."],
    ["domain:Knowledge Base", "Knowledge Base", "domain", "Local agent knowledge documents and search."],
    ["domain:Settings", "Settings", "domain", "Runtime config, model prompts, presets, diagnostics."],
    ["domain:Subagents", "Subagents", "domain", "Alert, Data Query, Meeting Evidence, Delay Claim, Project Insights agents."]
  ];
  for (const [id, label, type, summary] of domains) addNode(id, label, type, { summary });
}

function scanSourceFiles() {
  const files = [
    ...walk(srcDir, (file) => file.endsWith(".js")),
    ...walk(publicDir, (file) => file.endsWith(".js") || file.endsWith(".html") || file.endsWith(".css"))
  ];

  for (const file of files) {
    const relative = rel(file);
    const text = fs.readFileSync(file, "utf8");
    const type = relative.startsWith("public/") ? "frontend-file" : "backend-file";
    addNode(fileNodeId(file), relative, type, {
      path: relative,
      lines: text.split(/\r?\n/).length,
      summary: firstHeading(text)
    });
  }

  for (const file of files.filter((item) => item.endsWith(".js"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) {
      const target = normalizeImport(file, match[1].split("?")[0]);
      addNode(target, target.replace(/^(file:|external:|missing:)/, ""), target.startsWith("external:") ? "external" : "file");
      addEdge(fileNodeId(file), target, "imports");
    }
  }
}

function scanHtmlPanels() {
  const html = readText("public/index.html");
  for (const match of html.matchAll(/<button[^>]*class="[^"]*\btab\b[^"]*"[^>]*data-tab="([^"]+)"/g)) {
    const tab = match[1];
    const id = `panel:${tab}`;
    addNode(id, `#${tab}`, "frontend-panel", { summary: "SPA navigation panel." });
    addEdge("file:public/index.html", id, "declares");
    addEdge("file:public/app.js", id, "controls");
    addEdge("external:Browser", id, "renders");
  }
}

function scanApiRoutes() {
  const server = readText("src/server.js");
  for (const line of server.split(/\r?\n/)) {
    const match = line.match(/req\.method\s*===\s*["']([A-Z]+)["'][\s\S]*?url\.pathname(?:\.startsWith\(\s*["']([^"']+)["']\s*\)|\s*===\s*["']([^"']+)["'])/);
    if (!match) continue;
    const method = match[1];
    const route = match[2] || match[3];
    const id = `api:${method} ${route}`;
    addNode(id, `${method} ${route}`, "api-route", { method, route });
    addEdge("file:src/server.js", id, "handles");
  }

  const clientFiles = ["public/app.js", "public/timelineData.js"];
  for (const relative of clientFiles) {
    const text = readText(relative);
    for (const match of text.matchAll(/(?:api|fetch|EventSource)\((?:`|["'])(\/api\/[^`"')?${}]+)/g)) {
      const route = match[1].replace(/\$\{.*$/, "").replace(/\?$/, "");
      const target = route.startsWith("/api/runs/") ? "api:GET /api/runs/" : findApiNode(route);
      addEdge(`file:${relative}`, target || `api:* ${route}`, "calls");
      if (!target) addNode(`api:* ${route}`, `* ${route}`, "api-route", { route });
    }
  }
}

function findApiNode(route) {
  const direct = [...nodes.values()].find((node) => node.type === "api-route" && node.route === route);
  if (direct) return direct.id;
  const prefix = [...nodes.values()]
    .filter((node) => node.type === "api-route" && route.startsWith(node.route))
    .sort((a, b) => b.route.length - a.route.length)[0];
  return prefix?.id || null;
}

function connectKnownArchitecture() {
  const pairs = [
    ["external:Browser", "file:public/index.html", "loads"],
    ["file:public/index.html", "file:public/app.js", "loads"],
    ["file:public/app.js", "file:public/styles.css", "styles"],
    ["file:src/server.js", "domain:Chat Pipeline", "orchestrates"],
    ["file:src/agent.js", "domain:Chat Pipeline", "implements"],
    ["file:src/classifier.js", "domain:Chat Pipeline", "supports"],
    ["file:src/tools.js", "domain:Chat Pipeline", "supports"],
    ["file:src/sourceQuality.js", "domain:Chat Pipeline", "supports"],
    ["file:src/cache.js", "domain:Chat Pipeline", "supports"],
    ["file:src/runLog.js", "domain:Workflow QA", "feeds"],
    ["file:src/qaAgent.js", "domain:Workflow QA", "implements"],
    ["file:src/qaSummary.js", "domain:Workflow QA", "supports"],
    ["file:public/app.js", "domain:Workflow QA", "renders"],
    ["file:src/timelineLinks.js", "domain:Timeline", "implements"],
    ["file:src/timelineGraph.js", "domain:Timeline", "implements"],
    ["file:public/timelineData.js", "domain:Timeline", "supports"],
    ["file:public/timelineSearch.js", "domain:Timeline", "supports"],
    ["file:src/projectGraph.js", "domain:Project Graph", "implements"],
    ["file:src/supabase.js", "domain:Project Graph", "persists"],
    ["file:src/subagents/projectInsights.js", "domain:Insights", "implements"],
    ["file:src/subagents/delayClaim.js", "domain:Delay Claims", "implements"],
    ["file:src/knowledge.js", "domain:Knowledge Base", "implements"],
    ["file:src/config.js", "domain:Settings", "implements"],
    ["file:src/subagents/alert.js", "domain:Subagents", "implements"],
    ["file:src/subagents/dataQuery.js", "domain:Subagents", "implements"],
    ["file:src/subagents/meeting.js", "domain:Subagents", "implements"],
    ["file:src/subagents/delayClaim.js", "domain:Subagents", "implements"],
    ["file:src/subagents/projectInsights.js", "domain:Subagents", "implements"],
    ["file:src/openrouter.js", "external:OpenRouter", "calls"],
    ["file:src/supabase.js", "external:App Supabase", "calls"],
    ["file:src/supabase.js", "external:Content Supabase", "calls"],
    ["file:src/tools.js", "external:n8n", "calls"],
    ["file:src/subagents/alert.js", "external:Content Supabase", "calls"],
    ["file:src/subagents/dataQuery.js", "external:Content Supabase", "calls"],
    ["file:src/subagents/meeting.js", "external:Content Supabase", "calls"],
    ["file:src/subagents/projectInsights.js", "external:n8n", "calls"]
  ];
  for (const pair of pairs) addEdge(...pair);

  const panelDomains = {
    chat: "domain:Chat Pipeline",
    workflow: "domain:Workflow QA",
    timeline: "domain:Timeline",
    graph: "domain:Project Graph",
    insights: "domain:Insights",
    knowledge: "domain:Knowledge Base",
    settings: "domain:Settings",
    subagents: "domain:Subagents",
    tools: "domain:Settings",
    qa: "domain:Workflow QA"
  };
  for (const [panel, domain] of Object.entries(panelDomains)) {
    addEdge(`panel:${panel}`, domain, "surfaces");
  }
}

function connectApiDomains() {
  const routeDomains = [
    [/\/api\/chat|\/api\/sessions|\/api\/messages/, "domain:Chat Pipeline"],
    [/\/api\/runs|\/api\/run-history|\/api\/qa|\/api\/ai-report/, "domain:Workflow QA"],
    [/\/api\/timeline/, "domain:Timeline"],
    [/\/api\/graph/, "domain:Project Graph"],
    [/\/api\/insights/, "domain:Insights"],
    [/\/api\/delay-claims|\/api\/delay-events/, "domain:Delay Claims"],
    [/\/api\/knowledge/, "domain:Knowledge Base"],
    [/\/api\/settings|\/api\/agents|\/api\/diagnostics|\/api\/openrouter|\/api\/tools|\/api\/system/, "domain:Settings"],
    [/\/api\/subagents/, "domain:Subagents"]
  ];
  for (const node of nodes.values()) {
    if (node.type !== "api-route") continue;
    const domain = routeDomains.find(([regex]) => regex.test(node.route || node.label))?.[1];
    if (domain) addEdge(node.id, domain, "serves");
  }
}

function makeHtml(data) {
  const encoded = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Bidoc App Architecture Graph</title>
<style>
  :root { color-scheme: light; --bg:#f6f4ee; --ink:#17221b; --muted:#66756b; --line:#cfd8cf; --panel:#ffffff; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.45 "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--ink); }
  header { padding: 18px 22px 10px; border-bottom: 1px solid #dde4dc; background: rgba(255,255,255,.78); position: sticky; top: 0; z-index: 3; backdrop-filter: blur(10px); }
  h1 { margin: 0 0 6px; font-size: 22px; }
  .meta { color: var(--muted); display: flex; gap: 16px; flex-wrap: wrap; }
  .layout { display: grid; grid-template-columns: 300px minmax(0,1fr); min-height: calc(100vh - 82px); }
  aside { border-right: 1px solid #dde4dc; background: #fffdf8; padding: 16px; overflow: auto; }
  main { position: relative; min-height: 760px; overflow: hidden; }
  label { display: block; margin: 12px 0 6px; font-weight: 700; }
  input, select { width: 100%; padding: 9px 10px; border: 1px solid #cbd6cb; border-radius: 7px; background: white; color: var(--ink); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  button { border: 1px solid #cbd6cb; border-radius: 999px; background: white; color: var(--ink); padding: 6px 10px; cursor: pointer; }
  button.active { background: #1f6f45; color: white; border-color: #1f6f45; }
  .details { margin-top: 16px; padding: 12px; border: 1px solid #dfe6df; border-radius: 8px; background: white; min-height: 130px; }
  .details h2 { margin: 0 0 8px; font-size: 16px; }
  .details code { display:block; white-space: pre-wrap; color: #415148; }
  svg { width: 100%; height: calc(100vh - 82px); min-height: 760px; display: block; background: radial-gradient(circle at 20% 10%, #fff 0, #f6f4ee 38%, #edf2ec 100%); }
  .edge { stroke: #97a897; stroke-width: 1.25; fill: none; marker-end: url(#arrow); opacity: .78; }
  .edge.dim, .node.dim { opacity: .12; }
  .node rect { stroke: rgba(20,40,25,.22); stroke-width: 1; rx: 8; filter: drop-shadow(0 4px 10px rgba(20,40,25,.08)); }
  .node text { pointer-events: none; fill: #17221b; }
  .node .label { font-weight: 750; font-size: 12px; }
  .node .type { font-size: 10px; fill: #5e6f65; }
  .node.selected rect { stroke: #1f6f45; stroke-width: 2.5; }
  .legend { margin-top: 12px; display: grid; gap: 6px; color: var(--muted); }
  .swatch { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
</style>
</head>
<body>
<header>
  <h1>Bidoc App Architecture Graph</h1>
  <div class="meta"><span>${data.nodes.length} nodes</span><span>${data.edges.length} edges</span><span>Generated ${data.generated}</span></div>
</header>
<div class="layout">
  <aside>
    <label for="q">Search</label>
    <input id="q" placeholder="file, API, domain, component..." />
    <label for="type">Node type</label>
    <select id="type"><option value="">All</option></select>
    <div class="chips"><button class="active" data-edge="">All edges</button><button data-edge="imports">imports</button><button data-edge="calls">calls</button><button data-edge="serves">serves</button><button data-edge="implements">implements</button></div>
    <div class="legend" id="legend"></div>
    <div class="details" id="details"><h2>Select a node</h2><p>Click a box in the graph to inspect its files, role and relationships.</p></div>
  </aside>
  <main><svg id="graph" role="img" aria-label="Application architecture graph"></svg></main>
</div>
<script>
const data = ${encoded};
const colors = {
  "domain": "#dff1e5", "api-route": "#e6eefc", "backend-file": "#fff4d6", "frontend-file": "#f6e7ff",
  "frontend-panel": "#e8f7f5", "external": "#fce7e7", "file": "#f4f4f4"
};
const typeSelect = document.querySelector("#type");
const q = document.querySelector("#q");
const details = document.querySelector("#details");
let activeEdge = "";
let selected = null;
const types = [...new Set(data.nodes.map(n => n.type))].sort();
for (const type of types) typeSelect.insertAdjacentHTML("beforeend", '<option value="'+type+'">'+type+'</option>');
document.querySelector("#legend").innerHTML = types.map(t => '<span><i class="swatch" style="background:'+color(t)+'"></i>'+t+'</span>').join("");
document.querySelectorAll("[data-edge]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("[data-edge]").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeEdge = btn.dataset.edge;
  render();
}));
q.addEventListener("input", render);
typeSelect.addEventListener("change", render);
function color(type) { return colors[type] || "#eeeeee"; }
function visibleNode(n) {
  const query = q.value.trim().toLowerCase();
  if (typeSelect.value && n.type !== typeSelect.value) return false;
  if (!query) return true;
  return [n.id,n.label,n.type,n.path,n.summary].filter(Boolean).join(" ").toLowerCase().includes(query);
}
function layout(nodes) {
  const rank = { external:0, "frontend-file":1, "frontend-panel":2, "api-route":3, domain:4, "backend-file":5, file:5 };
  const grouped = {};
  for (const n of nodes) (grouped[rank[n.type] ?? 6] ||= []).push(n);
  const positions = new Map();
  const colW = 250, rowH = 78, x0 = 42, y0 = 38;
  Object.entries(grouped).forEach(([col, items]) => {
    items.sort((a,b) => a.label.localeCompare(b.label));
    items.forEach((n, i) => positions.set(n.id, { x: x0 + Number(col) * colW, y: y0 + i * rowH }));
  });
  return positions;
}
function wrapLabel(s, max = 28) {
  if (s.length <= max) return [s];
  const parts = s.split(/[\\/ ]/);
  const lines = [];
  let line = "";
  for (const part of parts) {
    const next = line ? line + " " + part : part;
    if (next.length > max && line) { lines.push(line); line = part; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}
function render() {
  const svg = document.querySelector("#graph");
  const visible = data.nodes.filter(visibleNode);
  const visibleIds = new Set(visible.map(n => n.id));
  const links = data.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target) && (!activeEdge || e.type === activeEdge));
  const pos = layout(visible);
  const maxY = Math.max(760, ...[...pos.values()].map(p => p.y + 70));
  const maxX = Math.max(1200, ...[...pos.values()].map(p => p.x + 210));
  svg.setAttribute("viewBox", "0 0 " + maxX + " " + maxY);
  svg.innerHTML = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#97a897"/></marker></defs>';
  for (const e of links) {
    const a = pos.get(e.source), b = pos.get(e.target);
    if (!a || !b) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const x1 = a.x + 210, y1 = a.y + 30, x2 = b.x, y2 = b.y + 30;
    path.setAttribute("d", "M"+x1+","+y1+" C"+(x1+70)+","+y1+" "+(x2-70)+","+y2+" "+x2+","+y2);
    path.setAttribute("class", "edge");
    path.dataset.type = e.type;
    svg.appendChild(path);
  }
  for (const n of visible) {
    const p = pos.get(n.id);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "node" + (selected === n.id ? " selected" : ""));
    g.setAttribute("transform", "translate("+p.x+","+p.y+")");
    g.addEventListener("click", () => selectNode(n.id));
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "210"); rect.setAttribute("height", "60"); rect.setAttribute("fill", color(n.type));
    g.appendChild(rect);
    wrapLabel(n.label).forEach((line, i) => {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "10"); text.setAttribute("y", String(20 + i * 14)); text.setAttribute("class", "label");
      text.textContent = line; g.appendChild(text);
    });
    const type = document.createElementNS("http://www.w3.org/2000/svg", "text");
    type.setAttribute("x", "10"); type.setAttribute("y", "51"); type.setAttribute("class", "type");
    type.textContent = n.type; g.appendChild(type);
    svg.appendChild(g);
  }
}
function selectNode(id) {
  selected = id;
  const n = data.nodes.find(node => node.id === id);
  const incoming = data.edges.filter(e => e.target === id).length;
  const outgoing = data.edges.filter(e => e.source === id).length;
  details.innerHTML = '<h2>'+escapeHtml(n.label)+'</h2><p><b>'+n.type+'</b> · incoming '+incoming+' · outgoing '+outgoing+'</p>' +
    (n.summary ? '<p>'+escapeHtml(n.summary)+'</p>' : '') +
    '<code>'+escapeHtml(n.path || n.route || n.id)+'</code>';
  render();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[ch]));
}
render();
</script>
</body>
</html>`;
}

addExternalNodes();
addDomainNodes();
scanSourceFiles();
scanHtmlPanels();
scanApiRoutes();
connectKnownArchitecture();
connectApiDomains();

const graph = {
  schema: "bidoc-app-architecture/v1",
  generated: new Date().toISOString(),
  nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
  edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
  stats: {
    node_count: nodes.size,
    edge_count: edges.size
  }
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "app-graph.json"), `${JSON.stringify(graph, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "index.html"), makeHtml(graph));
console.log(`Wrote ${path.relative(root, path.join(outDir, "app-graph.json"))}`);
console.log(`Wrote ${path.relative(root, path.join(outDir, "index.html"))}`);
console.log(`${graph.stats.node_count} nodes, ${graph.stats.edge_count} edges`);
