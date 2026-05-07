---
note_type: branch-note
project: bidoc agent
branch: agents
status: active
last_updated: 2026-05-07
tags:
  - agents
  - prompts
  - openrouter
  - routing
---

# Branch: Agents

## Purpose

Documents all 5 agents in the pipeline: their role, model, prompt location, routing logic, and information-transfer boundaries.

## The 5 Agents

### 1. Smart Classifier (`classifier`)
- **Model:** `openai/gpt-4o-mini`
- **File:** `src/classifier.js`, prompt in `src/prompts.js`
- **Role:** Classifies every incoming message as `CHAT` or `RAG`. Also picks tools, urgency, date range, hashtags, and professional flag.
- **Output fields:** `type`, `complexity`, `tool_hint`, `urgency`, `date_from`, `date_to`, `hashtags`, `professional`, `professional_reason`, `knowledge_tags`, `investigation`, `investigation_reason`
- **Fallback:** If OpenRouter fails → `heuristicClassification()` in `src/heuristics.js` (regex-based, no API)
- **CHAT triggers:** greetings, small talk, time/date questions
- **RAG triggers:** anything project-related (money, safety, decisions, materials, emails, etc.)
- **Professional triggers:** Domain/project-management concepts such as `חסמים`, blockers, constraints, risks, dependencies, decision criteria, methodology, standards, and glossary terms set `professional: true` so the Knowledge Planner runs before RAG.
- **Local enforcement:** After the LLM classifier returns, `runChatPipeline()` applies `enforceProfessionalKnowledgeMode()`. This corrects model misses for professional concepts (notably `חסמים`) and emits `Professional Knowledge mode enforced locally`.
- **Key fix (2026-05-07):** Supabase was caching old classifier prompt → always returned CHAT. Fixed by migration that clears stored defaults.

### 2. Lite Agent (`lite`)
- **Model:** `openai/gpt-4o-mini`
- **File:** `src/agent.js` → `runLiteAgent()`
- **Role:** Handles CHAT messages. Greetings, small talk, time/date questions.
- **Time fix:** System message prepended with `SYSTEM TIME: <current datetime>` hardcoded at runtime (bypasses Supabase-stored old prompt). Uses `getProjectDateTime(config.timezone)` from `src/clock.js`.
- **Fallback (no API key):** Returns hardcoded Hebrew greeting.

### 3. Main RAG Agent (`main`)
- **Model:** `openai/gpt-4o` (or as configured in Settings)
- **File:** `src/agent.js` → `runRagAgent()` → `synthesizeAnswer()`
- **Role:** Synthesises final answer from vector search results + n8n tool results + memory.
- **Input:** `retrieval_context`, `retrieval_results`, `tool_results`, `knowledge_plan`, `sources`
- **Boundary:** `knowledge_plan` is planning guidance only. Final factual claims must come from project retrieval/tool results, memory, or explicit user input.
- **Source review:** Receives `source_quality` and `potential_conflicts`; prompt instructs it to qualify low-quality evidence and mention possible conflicts.
- **Investigation:** Receives `investigation_plan` for complex causal/accountability questions and must include a concise "מה בדקתי" section.
- **No-data handling:** When hybrid_search fails and no tools return data, a `noDataNote` is appended to the system prompt instructing the model to still return a formatted response explaining the failure.
- **Fallback (no API key or empty response):** `fallbackRagAnswer()` — structured Hebrew fallback with ⚠️ reason note.

### 4. OpenRouter Reranker (`reranker`)
- **Model:** `openai/gpt-4o-mini`
- **File:** `src/openrouter.js` → `rerankWithLlm()`
- **Role:** Re-ranks hybrid search results by semantic relevance. Returns JSON `{ranked: [{index, relevance, reason}]}`.
- **Fallback:** If reranker fails, uses original hybrid search order (top `rerankTopK` results).

### 5. Professional Knowledge Agent (`knowledge_planner`)
- **Model:** `openai/gpt-4o`
- **File:** `src/agent.js` → `runKnowledgePlanner()`
- **Storage/search:** `src/knowledge.js` reads `.txt`/`.md` documents from Supabase table `knowledge_documents`, chunks text by paragraphs, then scores by query tokens, phrases, and tags.
- **Role:** Only runs when classifier sets `professional: true`. Searches the Knowledge Base and creates a planning brief for the Main RAG Agent.
- **Output:** `domain_summary`, `relevant_terms`, `decision_criteria`, `rag_queries`, `recommended_tools`, `risks_or_cautions`
- **Planner effect:** `rag_queries` can trigger up to two extra Hybrid Search queries after the raw user query. `recommended_tools` are merged into the n8n tool order when they are valid project tools.
- **Fallback:** If KB search fails or no KB matches → skipped. If no API key → local text fallback.
- **Important boundary:** The knowledge plan is professional guidance only. Main RAG Agent must not treat it as project evidence.

## Routing Logic

```
classification.type === "CHAT"  →  runLiteAgent()
classification.type === "RAG"   →  runRagAgent()
  classification.urgency === "HIGH"     →  safety_report + alert precheck before retrieval
  classification.investigation === true →  build investigation plan before synthesis
  classification.professional === true  →  runKnowledgePlanner() before Hybrid Search
  raw user query                         →  always first Hybrid Search query
  knowledge_plan.rag_queries             →  optional extra Hybrid Search queries after raw query
  all tool/retrieval calls                →  source quality score + conflict scan before answer
```

## Workflow Visualization

- The Workflow tab keeps a static template of the full system graph in `public/app.js`.
- Latest run logs are merged into that template: used nodes become active, unused nodes remain idle, and only runtime edges are highlighted.
- Management-only surfaces such as Settings, Knowledge Manager, Tool Tester, and Reset Server are shown as disconnected dashed nodes because they are not automatic chat-pipeline components.
- RAG runtime edges now include `n8n_tools → source_quality → conflict_detection → main_agent`, matching the source review steps before final synthesis.

## Diagnostics

- Tools tab includes Connection Diagnostics via `POST /api/diagnostics/connections`.
- It tests OpenRouter Chat, OpenRouter Embeddings, Supabase REST (`chat_messages_gf`), and Supabase Hybrid RPC separately.
- This is used to distinguish OpenRouter auth/account errors such as `User not found` from Supabase REST/RPC/schema problems.
- Settings tab displays secret sources (`Supabase agent_settings`, `.env / environment`, runtime cache, or missing), reports Supabase settings write status, and exposes `POST /api/settings/reload` for manual refresh from Supabase.

## Model Configuration

Models are stored in Supabase `agent_settings.data.models`. Defaults in `src/config.js`:
```js
classifier:       "openai/gpt-4o-mini"
knowledgePlanner: "openai/gpt-4o"
main:             "openai/gpt-4o"
lite:             "openai/gpt-4o-mini"
embedding:        "openai/text-embedding-3-large"
reranker:         "openai/gpt-4o-mini"
```

**Warning:** Using expensive models (e.g. `gpt-5.5-pro`) without enough OpenRouter credits causes `synthesizeAnswer` to fail. Always check credits at openrouter.ai/settings/credits.

## Prompt Management

- All default prompts live in `src/prompts.js` → `AGENT_DEFINITIONS`
- Prompts can be edited per-agent in the **Agents** tab of the UI
- Customised prompts (those differing from defaults) are stored in Supabase
- Default prompts are NEVER stored in Supabase (migration `__prompts_clean_v1` ensures this)
- `renderPrompt(template, values)` fills `{{placeholder}}` tokens at runtime

## Recent Changes

- 2026-05-07 — Added Tools connection diagnostics for OpenRouter Chat, OpenRouter Embeddings, Supabase REST, and Supabase Hybrid RPC.
- 2026-05-07 — Added Settings source/status UI and manual reload from Supabase for `agent_settings`.
- 2026-05-07 — Classifier professional detection now treats `חסמים` / blockers / constraints as Knowledge Planner questions.
- 2026-05-07 — Added local post-classifier enforcement so Knowledge Planner still runs when the LLM classifier misses `professional=true`.
- 2026-05-07 — Workflow visualization changed from run-only graph to persistent system map with active/idle/disconnected states and real runtime cable highlighting.
- 2026-05-07 — Added Memory Summary and Investigation Mode; complex questions now pass an investigation plan to Main RAG and conversation context is summarized outside the raw message window.
- 2026-05-07 — Added source quality scoring, possible conflict detection, and Evaluation Mode for repeatable routing/source checks.
- 2026-05-07 — Hardened agent information boundaries: Knowledge Plan is guidance only, safety precheck runs before retrieval for HIGH urgency, and planner queries/tools now influence RAG/tools without replacing the raw user query.
- 2026-05-07 — Added `knowledge_planner` as first-class editable agent with model selection in the Agents tab.
- 2026-05-07 — Classifier schema expanded with `professional`, `professional_reason`, and `knowledge_tags`.
- 2026-05-07 — Professional Knowledge Agent connected before Hybrid Search for professional RAG questions.
