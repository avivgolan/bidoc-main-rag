# n8n Agents Migration — מפרט מעבר מדורג לסוכנים פנימיים

מסמך אפיון למעבר סוכני/כלי n8n לסוכנים פנימיים בקוד (`src/subagents/*`), בהמשך להחלטה האסטרטגית מ-2026-07-03 (זיכרון הפרויקט: `bedrock/Memory/MEMORY.md`). תבנית העבודה המוכחת: `src/subagents/graphEnrichment.js` — מודול פנימי, feature flag, run events, dry-run לפני החלה, אימות חי.

**מצב נוכחי (2026-07-04):** מופו כל נקודות המגע של `callN8nTool` (`src/tools.js`) ונבדק המצב החי ב-Supabase (App `pmdnmzuqbcnzgkuhpfnx` + Content/Kapaim `smxibuaowzuxkznuouwj`).

---

## 1. מיפוי — מה עובר היום דרך n8n

### 1.1 צרכני `callN8nTool` בקוד

| נקודת קריאה | מיקום | מה קורה |
|---|---|---|
| זרימת הצ'אט | `src/agent.js` (`callProjectTool`, ~שורה 740) | כל כלי שאינו `data_query`/`meeting_evidence_search`/`alert` נופל ל-webhook של n8n |
| Project Insights | `src/subagents/projectInsights.js` (`runExistingProjectTools`, ~שורה 648) | כל `TOOL_NAMES` פרט ל-`alert`/`meeting_evidence_search`, מסונן ע"י `toolsRuntime.enabled` |
| בדיקת כלי מה-UI | `src/server.js` (`/api/tools/:name/test`, ~שורה 663) | קריאה ישירה לכלי בודד |
| דיאגנוסטיקה | `src/server.js` (~שורה 1978) | "connection test" לכל כלי |

### 1.2 רשימת הכלים (`TOOL_NAMES`, `src/config.js:384`) ומעמדם

| כלי | מעמד היום | טבלת תוכן ב-Kapaim | הערות |
|---|---|---|---|
| `alert` | **כבר פנימי** (`src/subagents/alert.js`; הצ'אט מיירט לפני n8n) | `alerts` | `alertAgentEnabled=false` כרגע בהגדרות החיות |
| `meeting_evidence_search` | **כבר פנימי** (`src/subagents/meeting.js`) | `meetings_documents` | |
| `data_query` | **פנימי מיסודו** (לא ב-`TOOL_NAMES`) | כל טבלאות התוכן | התבנית לכלי שאילתה פנימי |
| `meetings` | n8n webhook — **מת בפועל** | `meetings` (508 שורות) | |
| `emails` | n8n webhook — **מת בפועל** | `emails` (3,784) | |
| `whatsapp_messages` | n8n webhook — **מת בפועל** | `whatsapp_analysis` / `whatsapp_messages` | |
| `financial_transactions` | n8n webhook — **מת בפועל** | `financial_transactions` (46) | |
| `consultants_reports` | n8n webhook — **מת בפועל** | `consultants_reports` (4) | |
| `exceptions_report` | n8n webhook — **מת בפועל** | `exceptions_report` | |
| `quality_control` | n8n webhook — **מת בפועל** | `quality_control` | |
| `safety_report` | n8n webhook — **מת בפועל** | `safety_reports` (40) | עדיין נקרא ב-safety precheck בדחיפות HIGH — ונכשל |
| `submittals` | n8n webhook — **מת בפועל** | **אין טבלה כזו ב-Kapaim** | כנראה שריד; לוודא מול המשתמש |

**"מת בפועל" — ממצא חי (2026-07-04):** ב-`agent_settings` (App Supabase):
- `toolsRuntime.enabled = false` ⇒ ב-insights כל כלי ה-n8n מסוננים; בצ'אט הפילטר בשורה `agent.js:433` מסנן את כולם.
- `n8nBaseUrl = ""` וכל `tools.<name>.url` הוא אובייקט מקונן מושחת שמסתיים ב-`"[object Object]"` — כלומר גם קריאה ישירה (בדיקת כלי, דיאגנוסטיקה, safety precheck) נכשלת על `fetch` עם URL לא-תקין.
- מסקנה: **תשעת כלי השאילתה של n8n לא תורמים כלום לריצות היום.** המערכת רצה בפועל על: hybrid search, graph search, knowledge base, והסוכנים הפנימיים (alert, data_query, meeting evidence, insights pipeline, graph enrichment).

**באג צדדי שהתגלה (חובה לתקן):** צורת `tools` שנשמרת ל-`agent_settings` עוברת עטיפה חוזרת — `publicSettings` מחזיר `{configured, url}` per tool, וכששומרים את זה בחזרה נוצר קינון `{url:{url:{...}}}`. `resolveToolUrl` (`config.js:563`) מחזיר את האובייקט כמות שהוא (truthy) במקום מחרוזת. ראו משימה M1.

### 1.3 מה n8n עדיין עושה באמת (מחוץ ל-TOOL_NAMES)

צנרות ה-ingestion שממלאות את טבלאות התוכן ב-Kapaim — אלה חיות וקריטיות:

| צנרת | טבלאות יעד | תלות חיצונית |
|---|---|---|
| קליטת מיילים (Outlook) | `emails`, `filtered_emails`, `email_attachments` | OAuth של Microsoft |
| עיבוד מסמכים (OneDrive/SharePoint) | `other_documents`, `big_token_documents`, `drive_folder_queue` | OAuth + הורדת קבצים |
| קליטת WhatsApp | `whatsapp_*` (messages, conversations, group_chats) | ספק WhatsApp |
| ניתוח שיחות WhatsApp | `whatsapp_analysis` | LLM |
| יצירת התראות | `alerts`, `alert_configurations` | LLM |
| **סוכן האינדוקס** | **`data_index`** | LLM + embeddings |

**סוכן האינדוקס — הממצא המרכזי למימוש הראשון:** קורא שורות חדשות מ-7 טבלאות מקור וכותב ל-`data_index` (2,299 שורות): מעתיק `summary`/`hashtags`/כותרת מהמקור, קובע `primary_date` מתאריך המקור (למשל `meeting_date`), בונה `index_text` תבניתי ("מקור/תאריך/כותרת/תגיות/תקציר"), ומחשב embedding (text-embedding-3-large, 3072 מימדים). קיים אילוץ ייחודיות `data_index_source_unique (source_table, source_id)` ⇒ upsert בטוח דרך PostgREST.

מצב הנתונים (נבדק חי):

- **`event_date`/`document_date`: 0 מתוך 2,299 מלאות** — העמודות נוספו ב-migration ב-2026-07-03, הקוד כבר מעדיף אותן, אף אחד לא ממלא. זה הפער שסגירתו היא המטרה המיידית.
- דלתא של שורות לא-מאונדקסות: קטנה — financial 7, safety 8, other_documents 1. מיילים: רק `relevance_status in (project_related, multi_project)` מאונדקסים (362); 3,422 `no_clear_project` מוחרגים **בכוונה** — כלל שחובה לשמר.
- 22 שורות `whatsapp_analysis` ב-data_index הן יתומות (שורת המקור נמחקה) — לא באג של האינדוקס.
- `primary_date` חסר ב-449/547 שורות whatsapp — פער איכות שהסוכן הפנימי יוכל לסגור בהמשך.
- תאריכי מקור זמינים לכל טבלה: `meeting_date`, `received_date`, `report_date`, `transaction_date`; ל-`other_documents` יש רק `created_at` (+תאריכים בשם הקובץ); ל-`whatsapp_analysis` יש `created_at` ו-`deadlines_json`.

---

## 2. כללים מחייבים לכל המשימות

(ירושה מ-`docs/insight-agent-phase2-spec.md` ומהתבנית של graphEnrichment)

- שינויים קטנים והדרגתיים; feature flag לכל התנהגות אוטומטית חדשה.
- **אין commit/push בלי בקשה מפורשת מהמשתמש.**
- **אין migrations מקוד** — SQL ידני דרך Supabase SQL Editor בלבד (כלל CLAUDE.md).
- כל פעולת כתיבה ל-DB חי: **dry-run כברירת מחדל**, החלה רק אחרי בדיקת התוכנית, אימות חי אחרי החלה.
- קריאה מפורשת ל-endpoint = הסכמה; דגל config שולט רק על התנהגות **אוטומטית** (תקדים `POST /api/graph/enrich`).
- כתיבות מסומנות בתג גרסה ב-metadata (תקדים `metadata.enrichment = "graph-enrichment-v1"`) כדי לאפשר שאילתה/ניקוי ממוקדים.
- אידמפוטנטיות: הרצה חוזרת לא יוצרת כפילויות (upsert על מפתח ייחודי; מצב incremental מדלג על קיים).
- run events (`emitRunEvent`) לכל שלב; שדות response חדשים תוספתיים בלבד.
- בדיקות יחידה לכל רכיב ב-`test/run-tests.js`; זהירות עברית (אותיות סופיות, שלילה) בכל rule/regex.
- עלות/latency: קריאות LLM במודל lite, ב-batch, עם תקרת רשומות לריצה (תקדים: 3-concurrent batches של 15).

---

## Phase A — סוכן האינדוקס הפנימי (המימוש הראשון)

### Task A1 — Internal Indexing Agent: מילוי תאריכים + אינדוקס אינקרמנטלי

**מטרה:**
מודול פנימי `src/subagents/indexing.js` שמחליף את workflow האינדוקס של n8n עבור שני צרכים: (א) backfill של `event_date`/`document_date` ל-2,299 השורות הקיימות; (ב) אינדוקס אינקרמנטלי של שורות מקור חדשות. סגירת Task 5 מ-`insight-agent-phase2-spec.md` בצד ה-ingestion.

**המצב הקיים:**
`data_index` נכתב רק ע"י n8n. `normalizeRecord`/`buildInsightEvidence` כבר מעדיפים `event_date`/`document_date` כשאינם null. `createEmbedding` קיים ב-`src/openrouter.js`; גישה ל-Content Supabase דרך `contentSupabaseConfig` (`src/supabase.js:729`).

**השינוי:**

1. **מיפוי מקורות דקלרטיבי** — `SOURCE_TABLE_SPECS`: לכל טבלת מקור — עמודת id, עמודת תאריך-מסמך, עמודת תאריך-אירוע, שדות כותרת/תקציר/תגיות, שדות provenance (`mail_id`, `attachment_id`, `source_url`), וכלל רלוונטיות (מיילים: `relevance_status in (project_related, multi_project)`).

2. **כללי תאריכים דטרמיניסטיים** (גרסה `index-dates-v1`, נשמרת ב-`metadata.dates_version`):
   - `document_date` = התאריך הטבעי של המסמך/הודעה: `received_date` (מיילים), `report_date` (בטיחות/יועצים), `meeting_date` (פגישות — תאריך הפרוטוקול), `transaction_date` (פיננסי), תאריך משיחה (whatsapp), אחרת null.
   - `event_date` = תאריך האירוע המתואר: `meeting_date` (הפגישה היא האירוע), `report_date` (סיור/בדיקה), `transaction_date`; מיילים/מסמכים/whatsapp — **null** (אין להמציא; fallback הקיים בקוד ל-`primary_date` כבר מטפל).
   - נתון חסר = null, לעולם לא תאריך ingestion (`created_at` של 2026-05/06 הוא זמן קליטה, לא תאריך מסמך — למעט other_documents שאין להם דבר אחר, ושם **נשאיר null** בשלב זה).
   - חילוץ `event_date` מטקסט בעזרת lite-LLM עם grounding — **מחוץ לתחולה** של A1; משימת המשך A2.

3. **`runIndexDatesBackfill({ config, dryRun = true, limit })`** — קורא שורות `data_index` עם `event_date is null and document_date is null`, מצליב מול טבלת המקור, מחשב תאריכים לפי הכללים, ומחזיר תוכנית `{ source_table, source_id, event_date, document_date }`. ב-apply: PATCH per-batch שמעדכן **רק** את שתי העמודות (לא נוגע ב-embedding/summary). תג: `metadata.dates_version`.

4. **`runIncrementalIndexing({ config, dryRun = true, limit })`** — לכל טבלת מקור: שליפת שורות שאינן ב-`data_index` (anti-join על `source_id` דרך שאילתת keys), בניית שורת אינדקס מלאה (העתקת title/summary/hashtags מהמקור; `index_text` לפי התבנית הקיימת; `primary_date` מתאריך המקור; `event_date`/`document_date` לפי הכללים; embedding דרך `createEmbedding` עם `config.retrieval.embeddingModel`), upsert עם `on_conflict=source_table,source_id` ו-`ignoreDuplicates` כדי לא לדרוס שורות n8n. תג: `metadata.indexing = "internal-indexing-v1"`.
   - אם `summary`/`hashtags` חסרים במקור — בשלב A1 לאנדקס עם מה שיש (title + טקסט גולמי); יצירת summary ב-LLM היא חלק מ-A3.

5. **Endpoints:** `POST /api/index/backfill-dates` ו-`POST /api/index/run` (שניהם `{ dryRun, limit }`; dry-run ברירת מחדל; קריאה מפורשת = הסכמה). רישום ריצה ב-run history (`kind: "indexing"`) + run events.

6. **הפעלה אוטומטית מדורגת (עתידי, מאחורי דגל):** `config.indexing.autoIndexing === true` ⇒ הרצת incremental קצרה ותחומה בתחילת ריצת insights, לפי התקדים של `enrichEntities` (14 יום אחרונים, limit קטן). ברירת מחדל **כבוי** עד כיול.

7. **דו-קיום עם n8n:** ה-upsert האידמפוטנטי מאפשר לשני הכותבים לרוץ במקביל בלי כפילויות (האילוץ הייחודי מגן). כיבוי ה-workflow ב-n8n — החלטת משתמש נפרדת אחרי תקופת הרצה מקבילה.

**קבצים צפויים:** `src/subagents/indexing.js` (חדש), `src/server.js`, `src/config.js` (נרמול `settings.indexing`), `src/supabase.js` (helpers לכתיבת content אם חסר), `test/run-tests.js`.

**תלויות:** אין. העמודות כבר קיימות (migration הוחל 2026-07-03).

**סיכון:** בינוני — כתיבה ראשונה של הקוד ל-DB התוכן של Kapaim. מוקטן ע"י: dry-run ברירת מחדל, עדכון עמודות-יעד בלבד ב-backfill, `ignoreDuplicates` באינדוקס, תגי גרסה, ואימות SQL לפני/אחרי.

**בדיקות:** כללי תאריכים per-table (כולל null כשאין מקור); דטרמיניזם; anti-join לא מחזיר שורות קיימות; מייל `no_clear_project` לא מאונדקס; בניית `index_text` תואמת את התבנית הקיימת; dry-run לא כותב.

**קריטריון קבלה:** אחרי backfill חי — `event_date`/`document_date` מלאות לכל השורות שיש להן תאריך מקור (מדגם מאומת מול טבלאות המקור); ריצת insights מציבה התחייבות שדווחה במסמך מאוחר לפי מועד האירוע (Task 5 acceptance); הרצת incremental שנייה מדלגת על הכל ("up to date").

### Task A2 — חילוץ event_date מטקסט (אופציונלי, לא מתוזמן)

**הבהרה (2026-07-05, אחרי שאלת המשתמש):** זו לא כפילות מול n8n — אף גורם לא כותב היום את תאריך האירוע שמתואר *בתוך* הטקסט (מייל מ-30.3 שמדווח על אירוע מ-15.3 יושב על ציר הזמן ב-30.3). זה מידע חדש, אבל **נחמד-שיהיה**: ה-fallback לתאריך המסמך עובד. אם ימומש בעתיד, לשקול קודם את החלופה הזולה — הוספת שדה פלט `event_date` לסוכן הניתוח שכבר רץ בקליטת n8n — לפני בניית מחלץ פנימי (batch lite-LLM עם ציטוט grounding, דגל `config.indexing.llmEventDates`). **לא מתוזמן עד צורך אמיתי.**

### ~~Task A3 — אינדוקס מסמכים ללא summary מוכן~~ — בוטל (2026-07-05)

**נמחק אחרי בירור שרשרת הנתונים:** התקצירים וההאשטגים נוצרים ע"י סוכני ה-**קליטה** של n8n ונשמרים בטבלאות המקור; ה-indexer (של n8n ושלנו) רק מעתיק. כל עוד הקליטה נשארת ב-n8n (Phase C), כל שורה מגיעה עם תקציר מוכן — אין תרחיש של "מסמך בלי summary". המשמעות: **אין תלות של כיבוי workflow האינדוקס ב-A3** — הסוכן הפנימי מכסה את האינדוקס במלואו כבר היום.

---

## Phase B — פרישת כלי השאילתה המתים

### Task B1 — כלי שאילתה פנימיים על טבלאות התוכן

**מטרה:** להחליף את 9 ה-webhooks המתים במסלול פנימי אחד: retrieval ישיר מטבלת התוכן המתאימה (REST, read-only, עם סינון תאריכים) + סיכום lite-LLM אופציונלי — בתבנית `alert.js`/`dataQuery.js`. `callProjectTool` ינתב פנימית במקום ליפול ל-`callN8nTool`; חוזה ה-response (`{toolName, ok, data, sources}`) נשמר, כך שה-UI, ה-workflow log וה-QA לא נשברים.

**סדר עדיפות פנימי (עודכן 2026-07-04, לפי בדיקת תוכן חיה):** `meetings` ראשון — המקור היחיד שעשיר וגם מוטמע במלואו (508 שורות, 100% embeddings+summaries) → `whatsapp_messages` (525/449) ו-`emails` (362/358) → `financial_transactions` (46) / `safety_reports` (40, רק 8 embeddings) → `consultants_reports` (4) / `exceptions_report` (1) / `quality_control` (0) כשיהיה בהם תוכן → `submittals` (אין טבלה — לברר אם למחוק מ-`TOOL_NAMES`). הנימוק המקורי ל-safety-first (קריסת ה-precheck) התייתר אחרי M1.

**ממצא תשתיתי (2026-07-04):** פונקציות ה-`match_<table>` הקיימות ב-Kapaim שבורות לנתונים האלה — הן מסננות `metadata @> filter`, אבל `metadata` בטבלאות התוכן הוא jsonb מסוג מחרוזת, כך שגם פילטר ריק מחזיר 0 שורות. לכן עמוד השדרה של הכלים הפנימיים הוא `match_data_index(query_embedding, match_count, filter, p_project_id, p_source_table)` — כתוב נכון (`filter = '{}' OR ...`), מסנן `source_table` על עמודה אמיתית, ורץ על `data_index` שהסוכן הפנימי (A1) מתחזק; העשרת שדות מובנים נעשית בשליפה נוספת משורת המקור.

**דגל:** `config.tools.internalRuntime === true` per-tool fallback; הכלים המתים ממילא לא מחזירים כלום, אז הסיכון נמוך. דיאגנוסטיקה ובדיקת-כלי ב-UI עוברות לבדוק את המסלול הפנימי.

### Task M2 — שליטה מלאה בסוכנים הפנימיים מעמוד ההגדרות

**מטרה:**
נראות ושליטה מלאה לכל סוכן פנימי בנפרד מעמוד ההגדרות: הפעלה/כיבוי per-tool, פרמטרי אחזור, בחירת מודל, ועריכת פרומפט — בלי deploy ובלי קריאות API ידניות.

**המצב הקיים (2026-07-05):**
- `toolsRuntime.internalTools` הוא דגל גלובלי יחיד, הודלק דרך `PUT /api/settings` ידני, ואינו חשוף בשום מקום ב-UI. אין שליטה per-tool.
- כלי התוכן הפנימיים (פגישות, מיילים, וואטסאפ, פיננסי, בטיחות) הם **retrieval-only** — אין בהם קריאת LLM, ולכן אין להם פרומפט. "עריכת פרומפט" מחייבת קודם להוסיף שלב ניסוח.
- תקדימים קיימים: כרטיסי subagent בטאב Subagents (Alert, Data Query) עם טופס draft + כפתור בדיקה; עריכת פרומפטים של סוכני הצ'אט ב"סוכני AI" דרך `AGENT_DEFINITIONS` + overrides ב-`agent_settings`.
- עמוד ההגדרות הוא React island (`src/react/`) — שינוי UI מחייב `npm run react:build`; סקשן הכלים עדיין מציג שדות webhook URL של n8n ככלי העיקרי.
- שמירת הגדרות מה-UI אינה מוחקת מפתחות שהטופס לא שולח (מיזוג משמר) — אומת חי.

**השינוי:**

1. **סכמת הגדרות** `settings.subagents.contentTools`, מנורמלת ב-`config.js` (`normalizeContentToolsSettings`), ברירות מחדל מ-`CONTENT_TOOL_SPECS`:
   ```json
   {
     "internalTools": true,
     "perTool": {
       "meetings": { "enabled": true, "topK": 12, "answerSynthesis": false, "model": "", "prompt": "" }
     }
   }
   ```
   `toolsRuntime.internalTools` נשמר לאחור-תאימות (הדגל הגלובלי OR הסכמה החדשה); `isInternalContentTool` מתחשב גם ב-`perTool.<name>.enabled === false`.

2. **שלב ניסוח אופציונלי per-tool** (`answerSynthesis`): אחרי האחזור, קריאת lite-LLM אחת שמנסחת מהתוצאות תשובה תמציתית (תבנית `alert.js`), עם מודל ופרומפט הניתנים לעריכה. **הוחלט במימוש (2026-07-05):** פרומפטי ברירת המחדל יושבים ב-`DEFAULT_TOOL_PROMPTS` (`contentTools.js`) והפרומפט הנערך נשמר ב-`perTool.<tool>.prompt` — התקדים של `subagents.alert.systemPrompt`, לא `AGENT_DEFINITIONS` (חוסך שינויי models-map ו-react:build). ברירת מחדל **כבוי** — retrieval-only כמו היום; התוצאה הגולמית נשמרת ב-`data` גם כשהניסוח דולק (שדה `answer` תוספתי, כמו alert).

3. **סוכן האינדוקס** מקבל כרטיס משלו: `autoIndexing` (הרצה תחומה בתחילת ריצות insights), לימיטים, וכפתורי dry-run/הרצה מה-UI; בעתיד (A2) — מתג `llmEventDates` ופרומפט החילוץ.

4. **UI (React island):** בטאב Subagents כרטיס לכל סוכן פנימי — מתג הפעלה, topK, מתג ניסוח, בחירת מודל (dropdown OpenRouter קיים), textarea פרומפט, וכפתור "בדיקה" שמריץ את הכלי עם טיוטת ההגדרות (דרך `body.internal` + פרמטרי draft). בסקשן ה-webhooks: כלי עם מימוש פנימי מסומן "רץ פנימית — URL לא נדרש" והשדה מוסתר/מושבת.

5. **שמירה** דרך זרימת ה-Save הראשית בלבד (`/api/settings`) — כרטיסים הם draft-only, לפי הכלל הקיים ש-`agent_settings` נכתב רק ממסלול `settings_save`.

**קבצים צפויים:** `src/config.js`, `src/prompts.js`, `src/subagents/contentTools.js`, `src/server.js`, `src/react/` (island ההגדרות/Subagents) + `npm run react:build`, `test/run-tests.js`.

**תלויות:** B1 (קיים). לא תלוי ב-A2/A3.

**סיכון:** בינוני — כשמדליקים ניסוח לכל 5 הכלים נוספות עד 5 קריאות LLM לריצת צ'אט (עלות/latency); לכן per-tool, ברירת מחדל כבוי, וכיול הדרגתי. סיכון UI נמוך (תבנית כרטיסים קיימת).

**בדיקות:** נרמול הסכמה וברירות מחדל; `enabled=false` per-tool גובר על הדגל הגלובלי; ניסוח כבוי ⇒ אפס קריאות LLM בכלי; פרומפט override גובר על ברירת המחדל; חוזה ה-response נשמר (שדה `answer` תוספתי בלבד).

**קריטריון קבלה:** מהעמוד בלבד אפשר לכבות סוכן בודד, לשנות topK, להדליק ניסוח, להחליף מודל ולערוך פרומפט — והשינוי משתקף בריצת צ'אט חיה ובכרטיס הבדיקה בלי deploy.

### Task M1 — תיקון השחתת `tools` בהגדרות (היגיינה, לא תלוי בשאר)

`resolveToolUrl` יקשיח: לקבל רק מחרוזת (אובייקט ⇒ חילוץ `url` רקורסיבי או ""); נרמול השמירה יפרק `{configured, url}` חזרה למחרוזת; ניקוי חד-פעמי של הרשומה המושחתת ב-`agent_settings` (דרך מסך ההגדרות או SQL ידני מתועד). בלי זה, כל בדיקת כלים תיכשל על URL לא-תקין גם אחרי B1.

---

## Phase C — צנרות ingestion (נשארות ב-n8n בשלב זה)

קליטת מיילים/OneDrive/WhatsApp והתראות תלויות ב-OAuth וטריגרים חיצוניים שנוחים ב-n8n ואין להם תשתית מקבילה בקוד (Vercel serverless ללא cron מוגדר). **לא מהגרים עכשיו.** קריטריוני מעבר עתידיים: (א) תשתית scheduling (Vercel Cron / worker); (ב) גישה ישירה ל-APIs (Graph API וכו') עם ניהול סודות; (ג) ערך מוכח מהמעבר (כמו סגירת תאריכים באינדוקס). סוכן האינדוקס (A1) הוא החוליה היחידה בשרשרת ה-ingestion שאין לה תלות חיצונית — ולכן הוא הראשון.

---

## סדר מומלץ (עודכן 2026-07-05)

1. ~~**A1** — סוכן האינדוקס + backfill תאריכים~~ ✅ בוצע (כולל dateJoin לוואטסאפ).
2. ~~**M1** — תיקון השחתת ההגדרות~~ ✅ בוצע.
3. ~~**B1** — כלי שאילתה פנימיים~~ ✅ פגישות, מיילים, וואטסאפ, פיננסי, בטיחות — פעילים.
4. ~~**M2** — שליטה מלאה בסוכנים מעמוד ההגדרות~~ ✅ בוצע (כרטיסים בטאב Subagents + פס שמירה שתיקן את רגרסיית השמירה של דרפטים; נותר ליטוש: סימון "רץ פנימית" בשדות ה-webhook שבסקשן הכלים ב-React island).
5. ~~**B2** — סוכני תוכן מתמחים v2~~ ✅ בוצע (2026-07-05): הארכיטקטורה של B1 (כל הכלים על `data_index`) הוחלפה לפי החלטת המשתמש — כל סוכן רץ על **טבלת המקור שלו** (עריכה בהגדרות, ריק = ברירת מחדל): וקטורי דרך `match_<table>` המתוקן ∪ רגל טקסט ilike (מכסה שורות לא-מוטמעות), פילטר תאריכים על עמודת התאריך של הטבלה (וואטסאפ דרך join השיחות), **ניתוח דומייני דטרמיניסטי** (`contentAnalysis.js`: החלטות/סטטוסים, שולחים/קטגוריות, משימות+דדליינים, סכומים לפי סוג/ספק, ליקויים לפי חומרה; `analyzeGeneric` לטבלה מוחלפת עם introspection+cache ב-`contentRetrieval.js`), ו**ניסוח ברירת מחדל דלוק** עם פרומפט מומחה per-tool. Migration `fix_match_rpc_empty_filter` תיקן 12 פונקציות `match_*` (באג `metadata @> filter` על jsonb-string; שתיים כבר היו מתוקנות; `match_data_index` לא נגוע). חוזה ה-response נשמר; `analysis`/`retrieval` תוספתיים. `data_index` משרת מעתה רק את ה-RAG הראשי/timeline/insights.
5. **כיבוי workflow האינדוקס ב-n8n** — אין עוד תלות טכנית (A3 בוטל; הסוכן הפנימי מכסה). דורש: תקופת הרצה מקבילה + הדלקת `autoIndexing` (או תזמון) כדי ששורות חדשות ייקלטו בלי טריגר ידני + החלטת משתמש.
6. **A2** — אופציונלי, לא מתוזמן (ראו במשימה).
7. **Phase C** — קליטה נשארת ב-n8n; רק אחרי החלטת משתמש ותשתית scheduling.

## שאלות פתוחות — הוכרעו (2026-07-05)

- `submittals`: **נשאר.** המשתמש מתכנן להכניס דאטה בקרוב; כשתקום טבלת submittals ב-Kapaim, מוסיפים רישום ב-`CONTENT_TOOL_SPECS` + כרטיס (רבע שעה) והכלי הופך לסוכן מומחה שישי... שביעי.
- כיבוי workflow האינדוקס ב-n8n: **נדחה עד החלטת משתמש.** המצב הקבוע כרגע: ה-workflow של n8n ממשיך לרוץ, `autoIndexing` שלנו כבוי, דו-קיום בטוח דרך ה-upsert האידמפוטנטי. אין תלות טכנית שמחכה.
- Alert Agent: **הוחזר לפעולה (2026-07-05)** — מכוון ל-`alerts` ב-Kapaim, כולל תיקוני threshold והעשרת תאריכים ב-`alert.js`.
