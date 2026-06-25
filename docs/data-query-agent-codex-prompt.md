# פרומפט ל-Codex: Data Query Agent

תאריך: 2026-06-26  
שם מוצע לסוכן: `Data Query Agent`  
מטרה: להוסיף ל-BIDoc סוכן משנה שמקבל שאלה, בוחר טבלה או כמה טבלאות רלוונטיות, בונה תכנית שאילתות בטוחה, מריץ שאילתות קריאה בלבד, ומחזיר תשובה מעובדת לסוכן שביקש ממנו.

## פרומפט מוכן להעתקה ל-Codex

```text
אתה עובד בתוך פרויקט BIDoc הקיים.

מטרת המשימה:
להוסיף סוכן משנה חדש בשם Data Query Agent.

הסוכן יקבל שאלה מהסוכן הראשי או מקריאת API ישירה, יבין אילו טבלאות בדאטה בייס מתאימות לענות עליה, יבנה Query Plan בטוח, יריץ שאילתות קריאה בלבד, יבצע אגרגציות/חישובים פשוטים, ויחזיר תשובה מעובדת עם מדדים, טבלאות ששימשו, אזהרות ורמת ביטחון.

הסוכן חייב לתמוך גם ב-Multi Query:
- כמה טבלאות באותה משימה.
- כמה שאילתות שונות באותה משימה.
- איחוד תוצאות לתשובה אחת.
- החזרת כמה פרמטרים/מדדים במקביל.

לפני ביצוע:
1. קרא את AGENTS.md.
2. הרץ bedrock sync --project . אם נדרש לפי הוראות הפרויקט.
3. קרא:
   - bedrock/Memory/MEMORY.md
   - bedrock/Memory/stack.md
   - bedrock/Memory/chat.md
   - bedrock/Memory/subagents.md
   - bedrock/Memory/insights.md
   - bedrock/Memory/delay-claims.md
4. בדוק את הקבצים:
   - src/server.js
   - src/agent.js
   - src/tools.js
   - src/config.js
   - src/supabase.js
   - src/subagents/alert.js
   - src/subagents/meeting.js
   - src/subagents/projectInsights.js
   - public/index.html
   - public/app.js
   - public/styles.css
   - test/run-tests.js
   - test/ui/helpers/setup.js

חשוב:
הסוכן עוסק ב-Supabase ולכן יש לבדוק את הנחיות Supabase העדכניות הרלוונטיות לפני שינויי DB/RPC.
אין לחשוף service role key ל-client.
אין להוסיף SECURITY DEFINER ב-public כדי לעקוף הרשאות.
אם צריך RPC חדש, העדף פונקציה מצומצמת לקריאה בלבד, עם allowlist, timeout, limit ואודיט.

ארכיטקטורת ביצוע נדרשת:

1. קובץ סוכן חדש:
   - src/subagents/dataQuery.js

2. endpoint לבדיקה והרצה ישירה:
   - POST /api/subagents/data-query

3. חיבור לסוכן הראשי:
   - להוסיף tool פנימי בשם data_query.
   - הסוכן הראשי יקרא לו כאשר שאלה דורשת ספירה, פילוח, מדדים, מגמות, השוואה, איתור חריגים, או מידע מבני מתוך טבלאות.

4. Workflow:
   להוסיף נראות בריצה עם nodes:
   - data_query_table_selection
   - data_query_plan
   - data_query_execution
   - data_query_synthesis

5. Settings/Subagents:
   להוסיף הגדרות תחת settings.subagents.dataQuery:
   - enabled: boolean
   - maxPlans: number, default 5
   - maxRowsPerPlan: number, default 200
   - timeoutMsPerPlan: number, default 8000
   - totalTimeoutMs: number, default 20000
   - allowedTables: array
   - allowedSchemas: array, default ["app", "content"] או המיפוי הקיים בפרויקט
   - allowRawSql: false כברירת מחדל
   - allowJoins: false בשלב ראשון
   - allowAggregations: true
   - requireHumanApprovalForRawSql: true

כללי בטיחות חובה:

1. ברירת מחדל אינה raw SQL.
   המודל לא מריץ SQL ישירות.
   המודל מחזיר Query Plan JSON בלבד.

2. הקוד בשרת מתרגם את ה-Query Plan לשאילתות בטוחות.

3. מותרות רק פעולות קריאה:
   - select
   - count
   - group_count
   - aggregate
   - timeseries
   - top_n
   - distinct

4. אסור לחלוטין:
   - INSERT
   - UPDATE
   - DELETE
   - DROP
   - ALTER
   - CREATE
   - TRUNCATE
   - GRANT
   - REVOKE
   - COPY
   - CALL לפונקציות לא מאושרות
   - SQL שמכיל ; בתוך plan
   - SQL שמכיל הערות -- או /* */

5. כל טבלה חייבת להיות ב-allowlist.

6. כל שדה select/filter/group/order חייב להיות ב-schema manifest מאושר.

7. כל plan חייב לכלול limit.

8. כל plan חייב לקבל id יציב.

9. אם יש יותר מדי plans, להגביל ל-maxPlans ולהחזיר warning.

10. אם plan אחד נכשל, לא להפיל את כל המשימה. החזר תשובה חלקית עם warnings.

11. אם השאלה דורשת JOIN או SQL מורכב:
    - בשלב ראשון החזר unsupported_join_required.
    - הצע plan מפוצל לכמה שאילתות נפרדות.
    - אל תבנה JOIN חופשי.

12. אם הסוכן לא בטוח איזו טבלה מתאימה:
    - החזר status: needs_clarification או low_confidence.
    - אל תריץ שאילתות ניחוש רחבות.

מבנה קלט ל-runDataQueryAgent:

{
  "question": "מה מצב הפרויקט מבחינת עיכובים, חוסרים והתראות?",
  "context": {
    "dateFrom": "2026-06-01",
    "dateTo": "2026-06-26",
    "projectId": null,
    "caseId": null,
    "source": "main_agent"
  },
  "requestedMetrics": [],
  "maxPlans": 5
}

מבנה Query Plan:

{
  "question": "מה מצב הפרויקט מבחינת עיכובים, חוסרים והתראות?",
  "intent": "multi_metric_summary",
  "plans": [
    {
      "id": "delay_events_by_status",
      "schema": "app",
      "table": "delay_events",
      "operation": "aggregate",
      "metrics": [
        { "type": "count", "as": "events_count" },
        { "type": "avg", "field": "readiness_score", "as": "avg_readiness_score" }
      ],
      "filters": [
        { "field": "created_at", "op": "gte", "value": "2026-06-01" }
      ],
      "groupBy": ["human_status"],
      "orderBy": [
        { "field": "events_count", "direction": "desc" }
      ],
      "limit": 100,
      "reason": "השאלה דורשת תמונת מצב של אירועי עיכוב לפי סטטוס."
    },
    {
      "id": "delay_gaps_by_urgency",
      "schema": "app",
      "table": "delay_event_gaps",
      "operation": "group_count",
      "filters": [
        { "field": "created_at", "op": "gte", "value": "2026-06-01" }
      ],
      "groupBy": ["urgency"],
      "limit": 100,
      "reason": "השאלה דורשת ספירת חוסרים לפי דחיפות."
    },
    {
      "id": "alerts_by_severity",
      "schema": "content",
      "table": "alerts",
      "operation": "group_count",
      "filters": [
        { "field": "data_date", "op": "gte", "value": "2026-06-01" }
      ],
      "groupBy": ["severity_level", "item_status"],
      "limit": 100,
      "reason": "השאלה כוללת התראות פתוחות וחומרה."
    }
  ],
  "confidence": 0.86,
  "warnings": []
}

מבנה פלט מהסוכן:

{
  "status": "ok",
  "answer": "נמצאו 18 אירועי עיכוב, 7 חוסרים פתוחים ו-4 התראות ברמת חומרה גבוהה. רוב אירועי העיכוב עדיין בסטטוס candidate.",
  "metrics": [
    { "id": "events_count", "label": "אירועי עיכוב", "value": 18 },
    { "id": "open_gaps", "label": "חוסרים פתוחים", "value": 7 },
    { "id": "high_alerts", "label": "התראות חמורות", "value": 4 }
  ],
  "plans": [
    {
      "id": "delay_events_by_status",
      "table": "delay_events",
      "status": "ok",
      "rows": 4,
      "summary": "ספירת אירועי עיכוב לפי סטטוס."
    }
  ],
  "tablesUsed": ["delay_events", "delay_event_gaps", "alerts"],
  "confidence": 0.86,
  "warnings": [],
  "rawResultsPreview": {}
}

טבלאות מאושרות ראשוניות:

App Supabase:
- chat_messages_gf
- qa_reports
- graph_nodes
- graph_edges
- timeline_event_links
- delay_claim_cases
- delay_events
- delay_event_evidence
- delay_event_gaps
- delay_event_findings
- delay_event_change_log
- delay_schedule_versions
- delay_schedule_activities
- delay_event_schedule_links
- delay_cost_items
- delay_claim_exports
- project_insight_runs

Content Supabase:
- הטבלה המוגדרת ב-config.contentSource.indexTable
- הטבלה המוגדרת ב-config.contentSource.alertsTable
- meetings_documents אם קיים ומאושר

דרישות schema manifest:

1. ליצור manifest פנימי בקוד, למשל:
   - DATA_QUERY_TABLES

2. לכל טבלה להגדיר:
   - schemaAlias: app | content
   - tableName
   - description
   - allowedFields
   - dateFields
   - searchableFields
   - groupableFields
   - numericFields
   - defaultDateField
   - defaultLimit
   - maxLimit
   - allowedOperations

3. אין להשתמש בשדה שלא מוגדר ב-manifest.

4. אם טבלה קיימת בהגדרות Content Supabase בשם דינמי, לפתור אותה דרך config ולא להקשיח שם ישן.

מימוש שאילתות:

1. העדף שימוש ב-PostgREST דרך supabaseFetch/contentSupabaseConfig כאשר אפשר:
   - select
   - filters
   - order
   - limit

2. עבור אגרגציות שאי אפשר לבצע טוב דרך REST:
   - בצע שליפה מוגבלת ואז aggregate בקוד, אם נפח הנתונים קטן.
   - או צור RPC קריאה בלבד, מצומצם ומאושר, אם חייבים.

3. אין להוסיף executor שמריץ raw SQL חופשי מהמודל.

4. אם בכל זאת נדרש raw SQL בעתיד:
   - לא בשלב הזה.
   - יש להגדיר RPC נפרד עם allowlist.
   - יש לבדוק שאין מילים אסורות.
   - יש להוסיף timeout ו-limit.
   - יש לתעד audit.

מתי הסוכן צריך לרוץ:

1. כאשר הסוכן הראשי מזהה שאלות כמו:
   - כמה
   - ספור
   - פילוח
   - ממוצע
   - מגמה
   - לפי סטטוס
   - לפי תאריך
   - לפי חומרה
   - מה הכי הרבה
   - השוואה בין
   - תמונת מצב
   - KPI

2. כאשר Project Insights צריך מדדים כמותיים לצד findings.

3. כאשר Delay Claim צריך סיכומי סטטוס ולא מסקנות משפטיות.

4. כאשר Workflow QA צריך סטטיסטיקות על ריצות, כשלים או עלויות.

מתי לא להריץ:

- שאלה שדורשת הבנת תוכן סמנטי מתוך מסמכים עדיפה ל-hybridSearch.
- שאלה שדורשת ציטוט מדויק מישיבה עדיפה ל-Meeting Evidence Agent.
- שאלה שדורשת התראות תוכן פתוחות עדיפה קודם ל-Alert Agent.
- שאלה שדורשת פעולה או שינוי DB אינה נתמכת.

חיבור ל-Main Agent:

1. הוסף data_query ל-TOOL_NAMES רק אם נדרש על ידי buildToolOrder.
2. עדכן classifier/planner כך שיוכל להמליץ על data_query.
3. עדכן callProjectTool ב-src/agent.js:
   - אם toolName === "data_query", קרא ל-runDataQueryAgent.
4. הוסף את התוצאה ל-toolCalls.
5. עדכן prompt synthesis כך שהסוכן הראשי ישתמש במדדים אך לא יציג אותם כעובדות ללא ציון מקור טבלה.

חיבור ל-Workflow:

ב-buildWorkflowLog הוסף node ייעודי כאשר data_query הופעל:

- label: Data Query Agent
- kind: database
- status: done/skipped/error
- input:
  - question
  - requested plans
  - allowed tables
- output:
  - plans executed
  - rows returned
  - metrics
  - warnings

UI:

במסך Subagents הוסף כרטיס Data Query Agent:
- enabled
- maxPlans
- maxRowsPerPlan
- timeoutMsPerPlan
- totalTimeoutMs
- allowedTables preview
- test question textarea
- run test button
- result preview

אין לשמור דרך endpoint config של subagent.
כמו שאר הסוכנים, שינוי הגדרות הוא draft בטופס ונשמר רק דרך /api/settings.

בדיקות נדרשות:

1. בדיקות יחידה ל-validator:
   - דוחה table לא מאושרת.
   - דוחה field לא מאושר.
   - דוחה operation מסוכנת.
   - מחייב limit.
   - מגביל maxPlans.
   - מגביל maxRowsPerPlan.

2. בדיקות יחידה ל-executor:
   - group_count על rows mock.
   - aggregate count/avg/min/max/sum.
   - timeseries לפי יום/חודש אם מיושם.
   - partial failure מחזיר warning ולא מפיל הכל.

3. בדיקות API:
   - POST /api/subagents/data-query עם שאלה פשוטה.
   - multi-query עם שתי טבלאות במוק.
   - שאילתה לא מאושרת מחזירה 400 או status error מסודר.

4. בדיקות אינטגרציה עם Main Agent, אם החיבור נעשה באותה משימה:
   - שאלה "כמה אירועי עיכוב יש לפי סטטוס" מפעילה data_query.
   - Workflow כולל node של Data Query Agent.

5. בדיקות UI בסיסיות:
   - כרטיס Subagents מוצג.
   - שינוי שדות הופך את Settings ל-dirty.
   - בדיקת סוכן במוק מציגה metrics/warnings.

כללי איכות:

- שמור על הסגנון הקיים של הפרויקט: Node ESM, בלי framework חדש.
- אל תוסיף dependency אם אפשר להימנע.
- אל תשבור Chat, Timeline, Insights, Delay Claims, Settings, Workflow או Subagents קיימים.
- אל תחשוף secrets ל-client.
- אל תכניס raw SQL לתשובת הסוכן למשתמש אלא אם זה summary מנוקה ולא query מלא.
- כל תשובה צריכה לכלול tablesUsed ו-confidence.
- כל תשובה חלקית צריכה לכלול warnings.

גבולות גרסה ראשונה:

כן לבצע:
- Query Plan JSON.
- allowlist לטבלאות ושדות.
- multi-query עד 5 plans.
- SELECT/aggregate בטוח.
- endpoint בדיקה.
- חיבור אופציונלי ל-Main Agent.
- Workflow node.
- UI הגדרות בסיסי.
- בדיקות.

לא לבצע:
- raw SQL חופשי.
- JOIN חופשי.
- כתיבה ל-DB.
- יצירת views ציבוריים.
- SECURITY DEFINER ב-public.
- החלטות משפטיות/כספיות/מקצועיות מתוך מדדים בלבד.

בסיום:
1. הרץ בדיקות רלוונטיות.
2. אם נוספה תשתית בפועל, עדכן bedrock/Memory/subagents.md ואולי bedrock/Memory/chat.md.
3. הרץ bedrock sync --project .
4. דווח:
   - אילו קבצים שונו.
   - אילו endpoints נוספו.
   - אילו בדיקות הורצו.
   - אילו מגבלות נשארו.
```

## הערת אפיון

הבחירה החשובה כאן היא להפריד בין שני שלבים:

1. **תכנון שאילתה על ידי מודל**  
   המודל בוחר טבלאות, שדות, מדדים ופילטרים ומחזיר JSON.

2. **ביצוע שאילתה על ידי קוד בטוח**  
   הקוד בשרת מאמת allowlist, limit, operation ושדות, ורק אז מריץ קריאה.

כך מקבלים גמישות של סוכן SQL בלי לפתוח פתח להרצת SQL מסוכן.

---

# Stage 2 — לוגיקת צוות + יחסים רב-טבלאיים

תאריך: 2026-06-26
סטטוס: אפיון (v1 כבר ממומש ב-`src/subagents/dataQuery.js`).

Stage 2 לא משנה את ליבת הבטיחות של v1. הוא מוסיף שתי יכולות שמונחות על אותה תשתית:

1. **חוזה בין-סוכני (team-work logic)** — איך סוכני משנה אחרים קוראים ל-Data Query Agent, מה הם מעבירים, ואיך נמנעת עבודה כפולה.
2. **יחסים רב-טבלאיים (safe relations / client-side join)** — איך עונים על שאלה שמערבת שתי טבלאות מקושרות בלי SQL JOIN, על ידי `linked plans` ואיחוד בקוד.

עיקרון-על: **Data Query Agent הוא ספק נתונים משותף (shared data provider).** הוא לא מקבל החלטות עסקיות/משפטיות, לא קורא לסוכנים אחרים, ולא יוצר תלות מעגלית. סוכנים אחרים קוראים *אליו*, אף פעם לא להפך.

## חלק א׳ — חוזה בין-סוכני

### א.1 מעטפת קריאה אחידה (call envelope)

כל קורא — הסוכן הראשי או סוכן משנה — מעביר אובייקט קלט אחד. מרחיבים את `context` הקיים ב-v1 בלי לשבור אותו:

```json
{
  "question": "כמה אירועי עיכוב פתוחים יש לפי סטטוס, ועם כמה ראיות כל אחד?",
  "context": {
    "dateFrom": "2026-06-01",
    "dateTo": "2026-06-26",
    "projectId": null,
    "caseId": null,
    "source": "delay_claim",        // מי קורא: main_agent | project_insights | delay_claim | workflow_qa | api
    "runId": "run_8f3a...",          // מזהה הריצה האב, להצמדה ל-Workflow ול-dedup
    "callerNodeId": "delay_stage3",  // אופציונלי: ה-node שממנו נקראנו, ל-nesting בגרף
    "budget": { "maxPlans": 3 }      // אופציונלי: הקורא יכול לצמצם את התקציב שלו
  },
  "requestedMetrics": ["events_by_status", "evidence_per_event"]
}
```

כללי המעטפת:
- `source` הוא **חובה** בקריאות פנימיות. הוא משמש ל-routing, ל-audit וב-Workflow node label.
- `budget` יכול רק **לצמצם** את ה-`maxPlans`/`maxRowsPerPlan` של ההגדרות, לעולם לא להרחיב מעבר ל-`dataQuerySettings`.
- `runId` הוא הציר שמחבר dedup + Workflow nesting (ראה א.3, א.4).
- אם `source` לא מוכר — להתייחס כאל `api` ולהוסיף warning `unknown_caller_source`.

### א.2 חוזה החזרה (response contract שעליו הקוראים נשענים)

הפלט נשאר זהה ל-v1 (`status / answer / metrics / plans / tablesUsed / confidence / warnings`), עם שתי תוספות שמייצבות את החוזה לצרכני-מכונה:

```json
{
  "status": "ok",
  "metrics": [ { "id": "events_by_status.candidate", "label": "candidate", "value": 11 } ],
  "tablesUsed": ["delay_events", "delay_event_evidence"],
  "confidence": 0.84,
  "warnings": [],
  "machineResult": {
    "metricsByRequestId": {
      "events_by_status": [ { "human_status": "candidate", "count": 11 } ],
      "evidence_per_event": [ { "event_id": "...", "count": 4 } ]
    }
  },
  "queryPlan": { "...": "..." }
}
```

- `machineResult.metricsByRequestId` ממפה כל פריט ב-`requestedMetrics` לתוצאה המובנית שלו. כך Insights/Delay Claim צורכים מספרים בלי לפרסר את ה-`answer` בשפה טבעית.
- **חוזה ערכים**: `status` ∈ `ok | partial | needs_clarification | error | skipped`. צרכן-מכונה חייב לטפל ב-`partial` (יש `warnings`, חלק מה-plans נכשלו) בלי להתייחס אליו כשגיאה.
- `answer` בשפה טבעית הוא **לתצוגה בלבד**. סוכן אחר לעולם לא מסיק מספרים מ-`answer`, רק מ-`machineResult`.

### א.3 מי קורא ולמה — מטריצת ה-routing

| קורא (`source`) | מתי קורא ל-Data Query | מה הוא מבקש | מה הוא *לא* מבקש |
|---|---|---|---|
| `main_agent` | שאלת משתמש כמותית (כמה/פילוח/מגמה/השוואה) | מדדים גולמיים לסינתזה | פרשנות מקצועית |
| `project_insights` | צריך KPI כמותי לצד ה-findings האיכותיים | ספירות/ממוצעים על אותו חלון תאריכים של ה-run | findings סמנטיים (אלה שלו) |
| `delay_claim` | סיכומי סטטוס/מונים על `delay_*` | ספירות אירועים/ראיות/חוסרים לפי סטטוס | מסקנות משפטיות/critical-path |
| `workflow_qa` | סטטיסטיקות ריצה/כשל/עלות | מונים על `chat_messages_gf`/`qa_reports` | תוכן שיחה |

כלל אנטי-מעגליות (חובה): Data Query Agent **לא** קורא ל-`project_insights`, `delay_claim`, `alert`, או `meeting_evidence`. אם שאלה דורשת תוכן סמנטי/ציטוט — מחזיר `status: needs_clarification` עם `warnings: ["semantic_question_route_elsewhere"]` והצעת ה-`source` המתאים, ונותן לקורא להחליט. ראה את גבולות "מתי לא להריץ" ב-v1.

### א.4 מניעת כפילות (per-run dedup cache)

בעיה: באותו `runId`, הסוכן הראשי וגם Insights יכולים לבקש "אירועי עיכוב לפי סטטוס" — שתי שליפות זהות.

פתרון: cache קצר-טווח ברמת ה-run.
- חתימת plan = hash דטרמיניסטי של `{schema, table, operation, select, filters, groupBy, metrics, limit}` אחרי נורמליזציה (אותה נורמליזציה של `normalizePlan`).
- מפתח cache = `${runId}:${planSignature}`.
- TTL קצר (ברירת מחדל 60s) או חיים-של-run; נשמר בזיכרון התהליך בלבד (תואם ל-stateless של Vercel — לא נשמר ל-Supabase).
- פגיעת cache מחזירה את התוצאה עם `warnings: ["served_from_run_cache"]` ולא נספרת מול `totalTimeoutMs`.
- ללא `runId` — אין cache (התנהגות v1 נשמרת).

הגדרות חדשות תחת `settings.subagents.dataQuery`:
- `runCacheEnabled: true`
- `runCacheTtlMs: 60000`

### א.5 נראות ב-Workflow כשקריאה היא מסוכן-משנה

כש-`source !== "main_agent"`, ה-Data Query node נתלה **כ-child** מתחת ל-node של הקורא, באמצעות `callerNodeId`/`runId`, במקום כ-node שורש. כך הגרף מראה: `delay_stage3 → data_query`. אם אין `callerNodeId` — node שורש כמו ב-v1. תואם לדפוס `parent_run_id` שכבר קיים ב-`project_insight_runs`.

## חלק ב׳ — יחסים רב-טבלאיים (safe relations / client-side join)

עדיין **אין SQL JOIN**. שאלה רב-טבלאית מקושרת נענית על ידי `linked plans`: plan ראשון שולף מפתחות, plan שני מסונן עליהם ב-`in`, והאיחוד נעשה בקוד לפי יחס מוצהר.

### ב.1 הצהרת יחסים ב-manifest

מרחיבים את `tableDef`/`buildDataQueryManifest` בשדה `relations` — allowlist של קשרים מותרים בלבד:

```js
app("delay_events", "...", [...fields], {
  relations: [
    { name: "case",     toSchema: "app", toTable: "delay_claim_cases",   localField: "case_id",  foreignField: "id", cardinality: "many_to_one" },
    { name: "evidence", toSchema: "app", toTable: "delay_event_evidence", localField: "id",       foreignField: "event_id", cardinality: "one_to_many" }
  ]
});
```

כללי manifest:
- אסור יחס שלא הוצהר ב-`relations`. אין גילוי FK אוטומטי.
- `localField`/`foreignField` חייבים להיות ב-`allowedFields` של שתי הטבלאות.
- שני צדי היחס חייבים לעבור את אותו `allowedSchemas`/`allowedTables` של ההגדרות.

יחסים ראשוניים מוצהרים (לפי הסכימה הקיימת):
- `delay_events.case_id → delay_claim_cases.id`
- `delay_event_evidence.event_id → delay_events.id`
- `delay_event_gaps.event_id → delay_events.id`
- `delay_event_findings.event_id → delay_events.id`
- `delay_schedule_activities.schedule_version_id → delay_schedule_versions.id`
- `graph_edges.from_node_id → graph_nodes.id` , `graph_edges.to_node_id → graph_nodes.id`

### ב.2 מבנה Query Plan עם linked plans

מוסיפים בלוק `links` ברמת התוכנית (לא בתוך plan בודד). אין שדה `join`/`joins`/`rawSql` — אלה עדיין נדחים על ידי ה-validator הקיים.

```json
{
  "intent": "relational_summary",
  "plans": [
    {
      "id": "open_events",
      "schema": "app", "table": "delay_events", "operation": "select",
      "select": ["id", "human_status"],
      "filters": [{ "field": "human_status", "op": "eq", "value": "candidate" }],
      "limit": 100, "reason": "אירועי עיכוב פתוחים"
    },
    {
      "id": "evidence_for_open",
      "schema": "app", "table": "delay_event_evidence", "operation": "group_count",
      "groupBy": ["event_id"],
      "limit": 200, "reason": "ספירת ראיות לכל אירוע פתוח",
      "dependsOn": "open_events"
    }
  ],
  "links": [
    {
      "id": "events_with_evidence",
      "relation": "evidence",
      "leftPlan": "open_events",
      "rightPlan": "evidence_for_open",
      "on": { "leftField": "id", "rightField": "event_id" },
      "type": "left",
      "as": "evidence_count_per_event"
    }
  ]
}
```

זרימת ביצוע:
1. בונים גרף תלויות מ-`dependsOn` ומריצים plans ב-topological order.
2. plan עם `dependsOn` מקבל מ-validator/executor פילטר `in` אוטומטי על מפתחות שחזרו מה-plan האב (לפי היחס המוצהר). זה ממיר "JOIN" ל-"filter על תוצאת קודמתה".
3. אחרי ביצוע, `links` מבצע איחוד **בקוד** (כמו `groupRows`): left-join/inner-join לפי `on`, ומחזיר טבלת תוצאה אחת תחת `as`.

### ב.3 כללי בטיחות ל-links (חובה)

1. `relation` חייב להתאים ליחס מוצהר ב-manifest בין `leftPlan.table` ל-`rightPlan.table`. אחרת — דחייה עם `relation_not_allowed`.
2. `on.leftField`/`on.rightField` חייבים להתאים בדיוק ל-`localField`/`foreignField` של היחס המוצהר. אין `on` חופשי.
3. **תקרת fan-out**: מספר המפתחות הייחודיים שמועברים כ-`in` מה-left ל-right מוגבל ל-`maxJoinKeys` (ברירת מחדל 200). חריגה → קיצוץ + `warning: join_keys_truncated`.
4. עומק שרשרת: עד `maxLinkDepth` (ברירת מחדל 2). מונע fan-out מדורג.
5. גילוי מעגלי ב-`dependsOn` → דחייה עם `circular_dependency`.
6. כל ה-plans בשרשרת עדיין כפופים ל-`maxRowsPerPlan` ול-`totalTimeoutMs` הקיימים.
7. עדיין אין `INSERT/UPDATE/...`, אין RPC SQL חופשי, אין `;`/`--`/`/* */` — כל כללי v1 בתוקף.

הגדרות חדשות תחת `settings.subagents.dataQuery`:
- `allowRelations: true`
- `maxJoinKeys: 200`
- `maxLinkDepth: 2`

### ב.4 fallback כשיחס לא נתמך

- אם המודל מבקש JOIN שאין לו יחס מוצהר → `unsupported_join_required` (כמו v1), והצעת פיצול לשני plans נפרדים ללא link.
- אם יש יחס אבל ה-fan-out ענק → להריץ את ה-plans בנפרד, להחזיר אותם לא-מאוחדים, ולהוסיף `warning: join_skipped_high_cardinality`. עדיף תשובה חלקית על פני שתיקה.

## בדיקות נדרשות ל-Stage 2

חוזה בין-סוכני:
1. `source` חסר בקריאה פנימית → warning `unknown_caller_source`, עדיין רץ.
2. `budget.maxPlans` מצמצם, אבל לא יכול להרחיב מעבר להגדרות.
3. dedup: שתי קריאות עם אותו `runId` + plan זהה → השנייה מחזירה `served_from_run_cache` ולא שולפת שוב (mock על `fetchRows`).
4. `machineResult.metricsByRequestId` ממפה נכון כל `requestedMetrics`.
5. שאלה סמנטית → `needs_clarification` עם הצעת `source` חלופי, בלי שליפה.

יחסים:
6. `relation` לא מוצהר → `relation_not_allowed`.
7. `on` שלא תואם ל-FK המוצהר → דחייה.
8. `dependsOn`: plan ב נוסף עם פילטר `in` שנגזר מתוצאת plan א (mock).
9. left-join בקוד מחזיר שורות left גם בלי התאמה ב-right.
10. `maxJoinKeys` חורג → `join_keys_truncated`.
11. תלות מעגלית → `circular_dependency`.

## גבולות Stage 2

כן:
- מעטפת `source`/`runId`/`budget` + חוזה `machineResult`.
- dedup ברמת run בזיכרון.
- Workflow nesting תחת הקורא.
- linked plans + client-side join לפי יחסים מוצהרים.

לא (נשאר ל-Stage 3+):
- RPC קריאה-בלבד לאגרגציה בקנה מידה (טבלאות ענק).
- raw SQL מאושר.
- cache חוצה-runs/persisted.
- כל כתיבה ל-DB.

