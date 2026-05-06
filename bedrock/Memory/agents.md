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

Documents all 5 agents in the pipeline: their role, model, prompt location, and routing logic.

## The 5 Agents

### 1. Smart Classifier (`classifier`)
- **Model:** `openai/gpt-4o-mini`
- **File:** `src/classifier.js`, prompt in `src/prompts.js`
- **Role:** Classifies every incoming message as `CHAT` or `RAG`. Also picks tools, urgency, date range, hashtags, and professional flag.
- **Fallback:** If OpenRouter fails → `heuristicClassification()` in `src/heuristics.js` (regex-based, no API)
- **CHAT triggers:** greetings, small talk, time/date questions
- **RAG triggers:** anything project-related (money, safety, decisions, materials, emails, etc.)
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
- **Role:** Only runs when classifier sets `professional: true`. Searches local Knowledge Base files (`bedrock/` or `knowledge/` dir), creates a planning brief for the Main RAG Agent.
- **Output:** `domain_summary`, `relevant_terms`, `decision_criteria`, `rag_queries`, `recommended_tools`, `risks_or_cautions`
- **Fallback:** If no KB matches → skipped. If no API key → local text fallback.

## Routing Logic

```
classification.type === "CHAT"  →  runLiteAgent()
classification.type === "RAG"   →  runRagAgent()
  classification.professional === true  →  runKnowledgePlanner() first
```

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
