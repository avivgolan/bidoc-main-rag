# תרשים מערכת הצ׳אט

מסמך זה מתאר את כל החיבורים האפשריים בין רכיבי הצ׳אט: הממשק, השרת, הסוכנים, המודלים, מקורות הדאטה, הגרף, כלי N8N ודוח ה-AI.

## תרשים זרימה

```mermaid
flowchart LR
  User["משתמש"] --> ChatUI["ממשק צ׳אט"]
  ChatUI --> ChatApi["POST /api/chat"]
  ChatApi --> Pipeline["runChatPipeline"]

  subgraph Settings["Settings - הגדרות שמשפיעות על הצ׳אט"]
    OpenRouterKey["OpenRouter API Key"]
    ModelSelects["בחירת מודלים לכל סוכן"]
    AgentPrompts["פרומפטים לכל סוכן"]
    AiParams["Temperature / Max Tokens / Timeout"]
    RagSettings["Hybrid Search / RAG Context Budget"]
    GraphSettings["Graph Context"]
    KnowledgeSettings["Knowledge Base Vocabulary"]
    ContentSettings["Content Supabase"]
    ToolSettings["N8N / Alert / Safety toggles"]
  end

  Settings -.-> Pipeline
  Settings -.-> OpenRouter["OpenRouter"]
  Settings -.-> AppDb["App Supabase"]
  Settings -.-> ContentDb["Content Supabase"]

  subgraph AppDb["App Supabase - מצב אפליקטיבי"]
    AgentSettings["agent_settings"]
    ChatMessages["chat_messages_gf"]
    QaReports["qa_reports"]
    GraphNodes["graph_nodes"]
    GraphEdges["graph_edges"]
    TimelineLinks["timeline_event_links"]
    TimelineEntities["timeline_entities"]
    TimelineGraph["timeline_graph_edges"]
  end

  subgraph ContentDb["Content Supabase - מקור תוכן"]
    DataIndex["data_index"]
    Alerts["alerts"]
    HybridRpc["hybrid_match_data_index RPC"]
    AlertsRpc["alerts RPC / alerts table"]
  end

  subgraph OpenRouter["OpenRouter"]
    EmbeddingModel["Embedding model"]
    ClassifierModel["Classifier model"]
    PlannerModel["Knowledge Planner model"]
    LiteModel["Lite model"]
    RerankerModel["Reranker model"]
    MainModel["Main model"]
    AlertModel["Alert Agent model"]
    QaModel["QA / AI Report model"]
  end

  subgraph Pipeline["Chat Pipeline"]
    Input["chat_input"]
    Sanitize["sanitize"]
    SaveMessage["save_message"]
    Classifier["classifier"]
    Vocabulary["knowledge_vocabulary"]
    Memory["memory"]
    Router["switch: CHAT or RAG"]

    LiteAgent["Lite Agent"]
    SafetyPrecheck["Safety Precheck"]
    AlertAgent["Alert Agent"]
    Investigation["Investigation Mode"]
    Planner["Knowledge Planner"]
    HybridSearch["Hybrid Search"]
    PlannerExtraQueries["Planner extra RAG queries"]
    RelaxedRetry["Relaxed hashtag retry"]
    GraphSearch["Graph Search"]
    Reranker["Reranker"]
    N8NTools["N8N Tools"]
    SourceQuality["Source Quality"]
    ConflictDetection["Conflict Detection"]
    MainAgent["Main Agent"]
    UpdateMessage["update_message"]
  end

  Pipeline --> Input --> Sanitize --> SaveMessage --> Classifier --> Vocabulary --> Memory --> Router
  SaveMessage --> ChatMessages
  Memory --> ChatMessages
  Classifier --> ClassifierModel
  Vocabulary --> KnowledgeSettings

  Router -->|CHAT| LiteAgent --> UpdateMessage
  LiteAgent --> LiteModel

  Router -->|RAG| Investigation --> Planner --> HybridSearch
  Router -. high urgency .-> SafetyPrecheck
  SafetyPrecheck -. if needed .-> AlertAgent
  Router -. alert intent .-> AlertAgent
  Planner --> PlannerModel
  Planner --> LocalKb["Local Knowledge Base"]

  HybridSearch --> EmbeddingModel
  HybridSearch --> HybridRpc
  HybridRpc --> DataIndex
  PlannerExtraQueries --> HybridSearch
  HybridSearch -. no results .-> RelaxedRetry --> HybridSearch

  HybridSearch --> GraphSearch
  GraphSearch --> GraphNodes
  GraphSearch --> GraphEdges
  GraphSearch --> TimelineEntities
  GraphSearch --> TimelineGraph

  HybridSearch --> Reranker
  GraphSearch --> Reranker
  Reranker --> RerankerModel

  AlertAgent --> AlertModel
  AlertAgent --> AlertsRpc
  AlertsRpc --> Alerts

  Reranker --> N8NTools
  AlertAgent --> N8NTools
  N8NTools --> MeetingsTool["meetings"]
  N8NTools --> EmailTool["emails"]
  N8NTools --> WhatsAppTool["whatsapp"]
  N8NTools --> FinanceTool["financial"]
  N8NTools --> ConsultantsTool["consultants"]
  N8NTools --> ExceptionsTool["exceptions"]
  N8NTools --> QualityTool["quality"]
  N8NTools --> SafetyTool["safety"]
  N8NTools --> SubmittalsTool["submittals"]

  N8NTools --> SourceQuality
  Reranker --> SourceQuality
  GraphSearch --> SourceQuality
  SourceQuality --> ConflictDetection --> MainAgent --> UpdateMessage
  MainAgent --> MainModel
  UpdateMessage --> ChatMessages

  subgraph Workflow["Workflow UI - זרימת עבודה"]
    WorkflowPage["עמוד זרימת עבודה"]
    LiveLog["לוג ריצה חי"]
    FlowGraph["תרשים שלבי הריצה"]
    RunHistory["היסטוריית ריצות"]
    AiReportButton["כפתור דוח AI"]
  end

  Pipeline --> LiveLog
  Pipeline --> FlowGraph
  ChatMessages --> RunHistory
  WorkflowPage --> AiReportButton

  subgraph AiReport["AI Report / QA Agent"]
    AiReportApi["POST /api/ai-report/:messageId/run"]
    QaAgent["QA Agent"]
    QaPrompt["QA prompt"]
    QaOutput["דוח AI"]
  end

  AiReportButton --> AiReportApi --> QaAgent
  QaAgent --> QaModel
  QaAgent --> QaPrompt
  QaAgent --> ChatMessages
  QaAgent --> LiveLog
  QaAgent --> QaOutput
  QaOutput --> QaReports
  QaOutput --> ChatMessages
  QaOutput --> RunHistory

  subgraph GraphPage["Graph Page"]
    GraphUi["עמוד גרף"]
    GraphApi["GET /api/graph"]
    GraphCanvas["תצוגת קשרים"]
  end

  GraphUi --> GraphApi
  GraphApi --> GraphNodes
  GraphApi --> GraphEdges
  GraphApi --> GraphCanvas
```

## מקרא

- חץ מלא: זרימה רגילה של מידע בזמן ריצת צ׳אט.
- חץ מקווקו: רכיב אופציונלי שמופעל לפי הגדרות, סוג שאלה או תוצאה.
- Settings לא מפעיל תשובה בעצמו, אבל הוא שולט במודלים, בפרומפטים, בכמות ההקשר, בגרף, ב-N8N ובמקורות התוכן.

## רכיבים מרכזיים

- `Classifier` מחליט אם השאלה היא צ׳אט קצר או RAG, ומחזיר גם hashtags, טווח תאריכים ורמזים לכלים.
- `Knowledge Planner` מוסיף תכנון מקצועי ושאילתות RAG נוספות כשזוהתה שאלה מקצועית.
- `Hybrid Search` מושך תוכן מ-Content Supabase דרך embedding ו-RPC היברידי.
- `Graph Search` מוסיף קשרים מ-App Supabase סביב תוצאות RAG, אירועים, התראות, נושאים וסיכונים.
- `Reranker` מדרג את המקורות לפני שהם נכנסים לתשובה.
- `Main Agent` מקבל את השאלה, המקורות, הקשרים מהגרף, תוצאות הכלים והנחיות האיכות ומייצר תשובה.
- `QA Agent` מופעל מכפתור “דוח AI” ומנתח את כל הלוג של הריצה כדי להציע איך לשפר אותה.

## מקורות דאטה

- App Supabase שומר מצב אפליקטיבי: הגדרות, היסטוריית צ׳אט, דוחות AI, גרף וקישורי timeline.
- Content Supabase משמש לשליפת תוכן בלבד: `data_index`, `alerts`, חיפוש היברידי ו-alerts.
- OpenRouter מספק את כל קריאות המודל: classifier, planner, main, lite, reranker, alert, QA ו-embeddings.
- N8N הוא שכבת כלים חיצונית אופציונלית עבור מקורות כמו פגישות, אימיילים, וואטסאפ, כספים, איכות ובטיחות.

## קבצים מרכזיים בקוד

- `src/agent.js` - זרימת הצ׳אט הראשית.
- `src/openrouter.js` - קריאות מודלים ו-embeddings.
- `src/supabase.js` - App Supabase, Content Supabase, חיפוש, גרף ודוחות.
- `src/qaAgent.js` - סוכן דוח AI.
- `src/subagents/alert.js` - סוכן ההתראות.
- `public/app.js` - UI של הצ׳אט, Workflow, Settings ו-Graph.
