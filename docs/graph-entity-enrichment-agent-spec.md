# אפיון: סוכן העשרת גרף בישויות (Graph Entity Enrichment Agent)

תאריך: 2026-07-03
סטטוס: מוכן למימוש
הקשר: תנאי מקדים ל-Task 4 (אשכולות מבוססי גרף) ב-`docs/insight-agent-phase2-spec.md`.

## הקשר אסטרטגי

**כיוון מוצרי מחייב: סוכני n8n מוחלפים בהדרגה בסוכנים פנימיים בקוד.** סוכן זה הוא סוכן פנימי מלא — מודול ב-`src/subagents/`, ללא תלות ב-n8n, לפי התבנית הקיימת (run events, workflow log, feature flag). אין לממש אותו כ-webhook או workflow חיצוני.

## הבעיה (מגובה בבדיקת נתונים, 2026-07-03)

בדיקת תוכן הגרף בפועל (`listProjectGraph`, 1000 שורות):

| מה נמצא | כמות |
|---|---|
| צומתי alert | 675 |
| צומתי hashtag | 127 |
| צומתי event | 107 |
| צומתי document | 12 |
| **צומתי ישות אמיתית (אדם/קבלן/ספק/ארגון/מיקום)** | **0** |
| קשתות `mentions` → hashtag | 981 |
| קשתות `mentions` → ישות אמיתית | 0 |
| קשתות רשומה↔רשומה | 0 |

בלי ישויות אמיתיות, קיבוץ דרך הגרף שקול לקיבוץ לפי האשטגים (שכבר קיים בצנרת התובנות), וזיהוי תלויות ("קבלן X מעכב גם את Y") בלתי אפשרי.

## מה כבר קיים בקוד (למחזר, לא לכתוב מחדש)

| רכיב | מיקום | מה הוא עושה | הפער |
|---|---|---|---|
| `buildGraphRowsFromRecords` + `extractGraphEntities` | `src/projectGraph.js` | **כבר יודע** לבנות צומתי person/supplier/company + קשתות `mentions_person`/`has_vendor` — אבל רק משדות metadata (`people`, `mentioned_responsibles`, `vendor_name`, `transaction_submitter`) | שדות ה-metadata האלה ריקים בנתוני KAPAIM — לכן אין ישויות בגרף |
| `extractTimelineEntities` | `src/timelineGraph.js` | חילוץ דטרמיניסטי מהטקסט: `extractApprover` (מאשרים), `extractLikelyCompanies` (חברות), quote/invoice regex | משמש רק את גרף ציר-הזמן (טבלאות נפרדות), לא את גרף הפרויקט |
| `upsertProjectGraphData` | `src/supabase.js` | upsert אידמפוטנטי ל-`graph_nodes`/`graph_edges` (מפתח צומת: `sourceNodeId(kind, name)`) | — |
| `POST /api/timeline/graph/rebuild` | `src/server.js` (~שורה 998) | טריגר קיים שבונה את שני הגרפים מכל הרשומות | לא כולל חילוץ ישויות מטקסט |
| `chatCompletion` + `extractJsonObject` | `src/openrouter.js` | קריאות LLM עם timeout שמכסה גם את גוף התשובה | — |
| תבנית סוכן פנימי | `src/subagents/alert.js`, `projectInsights.js` | run events, feature flags, deterministic + LLM tiers | — |

## Task G1 – מודול הסוכן

**מטרה:**
`src/subagents/graphEnrichment.js` — סוכן שמחלץ ישויות אמיתיות מטקסט הרשומות ומעשיר את `graph_nodes`/`graph_edges`, כדי לפתוח את Task 4.

**השינוי:**

1. **פונקציה ראשית** `runGraphEnrichment({ config, source = "index", dateFrom, dateTo, limit = 200, mode = "incremental", runId, emit })`:
   - שולפת רשומות (`fetchTimelineEvents` / `fetchAlertsTimelineEvents`).
   - `incremental`: מדלגת על רשומות שכבר יש להן קשת ישות בגרף (בדיקה לפי `metadata.source_id` בקשתות קיימות); `backfill`: הכל.
   - מפעילה חילוץ דו-שכבתי (סעיף 2), נרמול (סעיף 3), ואז `upsertProjectGraphData`.

2. **חילוץ דו-שכבתי:**
   - **שכבה דטרמיניסטית (חינם):** למחזר את `extractApprover` ו-`extractLikelyCompanies` מ-`timelineGraph.js` + שדות ה-metadata הקיימים ב-`extractGraphEntities` כשהם מלאים.
   - **שכבת LLM (batch):** קריאה אחת לכל 15–20 רשומות, מודל lite, `response_format: json_object`, טמפרטורה 0.1. סכמה:
     ```json
     {"records":[{"index":0,"entities":[{"name":"string","kind":"contractor|person|supplier|organization|location","role":"string","evidence":"ציטוט קצר מהטקסט"}]}]}
     ```
   - **כלל עיגון (חובה):** ישות שה-`evidence` שלה אינו מופיע כתת-מחרוזת בטקסט הרשומה — נפסלת בקוד. אין ישויות מומצאות.

3. **נרמול ו-entity resolution:**
   - נרמול שם: הסרת ניקוד, רווחים כפולים, תארים ("מר", "אינג'", "חב'"), ה"א הידיעה בתחילת מילה, סיומות בע"מ/בעמ.
   - מיזוג וריאנטים לפי שם מנורמל (`person:יוסי-כהן` ← "יוסי כהן", "מר יוסי כהן").
   - **blocklist** מילים גנריות שאינן ישות: קבלן, ספק, מנהל, לקוח, מזמין, יועץ, מפקח (ללא שם צמוד) — נדחות.
   - שם באורך < 2 מילים ו< 4 תווים — נדחה, פרט למותגים מוכרים ברשימת allowlist בהגדרות.

4. **כתיבה לגרף:** צומתי ישות (`node_type` לפי kind, `entity_kind` זהה, `label` = השם הקנוני, `source_table/source_id = null`) + קשתות `mentions` מהרשומה לישות, עם `confidence` (0.85 דטרמיניסטי / 0.7 LLM) ו-`evidence_text` = הציטוט. אידמפוטנטי — הרצה כפולה לא מכפילה.

5. **Feature flag:** `config.insights.graphEnrichment === true` (ברירת מחדל כבוי; להוסיף ל-`normalizeInsightsSettings` ב-`src/config.js`).

**קבצים צפויים:** `src/subagents/graphEnrichment.js` (חדש), `src/config.js`, `src/timelineGraph.js` (ייצוא של הפונקציות הממוחזרות אם אינן מיוצאות), `test/run-tests.js`.

**סיכון:** בינוני (כתיבה לגרף; ממותן באידמפוטנטיות וב-flag).

**בדיקות:**
- נרמול ממזג וריאנטים ("מר יוסי כהן" + "יוסי כהן" → צומת אחד).
- כלל העיגון פוסל ישות עם evidence שלא בטקסט.
- blocklist דוחה "קבלן" בודד ומקבל "קבלן גבס אחים לוי".
- אידמפוטנטיות: שתי הרצות → אותם מזהי צמתים, ללא כפילות קשתות.
- שכבת ה-LLM ניתנת לבדיקה עם mock (כמו `planDataQueryWithLlm` בטסטים הקיימים).

**קריטריון קבלה:** אחרי הרצת backfill על נתוני KAPAIM, `listProjectGraph` מחזיר צומתי ישות אמיתיים עם קשתות `mentions` מרשומות, וכל ישות נושאת evidence מהטקסט.

## Task G2 – טריגר והפעלה

**מטרה:** להריץ את ההעשרה בלי n8n.

**השינוי:**
1. `POST /api/graph/enrich` — body: `{ source, dateFrom, dateTo, limit, mode }`, מוגן `checkBidocSecretForRead`, מחזיר סיכום (רשומות שנסרקו, ישויות שנוצרו לפי kind, קריאות LLM, נפסלו לפי סיבה) + run events.
2. הרחבת `POST /api/timeline/graph/rebuild` עם `enrichEntities: true` אופציונלי שמריץ את הסוכן אחרי הבנייה הבסיסית.
3. כפתור "העשר ישויות" בטאב הגרף ב-UI — אופציונלי, שלב נפרד.

**קריטריון קבלה:** קריאת API אחת מריצה העשרה מלאה ומחזירה סיכום שקוף.

## Task G3 – חיבור ל-Task 4 (אחרי G1+G2)

עם ישויות אמיתיות בגרף, לממש את Task 4 לפי האפיון הקיים ב-`insight-agent-phase2-spec.md`, עם העדכונים:
- המיפוי קשת→רשומה: דרך `graph_nodes.source_table` + `source_id` (קיימים ומאומתים).
- איחוד אשכולות: co-mention של ישות אמיתית (לא hashtag), עם **הגנת hub** — ישות המחוברת ליותר מ-6 רשומות אינה סיגנל איחוד.
- דפוס `dependency_risk`: שני אשכולות פתוחים שחולקים ישות ← "נדרש לבדוק האם" + `requires_validation: true`.
- ה-`entities` של אשכול נכנסים לסכמת הראיות (השדה כבר מוגדר בתוכנית המקורית, סעיף 5.3).

## סדר ותלויות

```text
G1 (מודול) ── G2 (טריגר) ── backfill על נתוני אמת ── בדיקת איכות ישויות ── G3 (= Task 4)
```

אין לממש את G3 לפני בדיקת איכות ידנית של הישויות שחולצו (רשימת 20 הישויות המחוברות ביותר — האם הן אמיתיות ולא רעש).

## כללי זהירות

- כל הכללים המחייבים מ-`insight-agent-phase2-spec.md` חלים (feature flags, דטרמיניזם בשכבה הלא-LLM, אין commit בלי אישור).
- זהירות עברית: אותיות סופיות ושלילה בכללי regex (ראו `STATEMENT_RULES` ב-`insightPipeline.js` כתקדים).
- ה-LLM מחלץ בלבד — לעולם לא ממציא; כלל העיגון נאכף בקוד, לא בפרומפט.
- עלות: ~1 קריאת lite לכל 15–20 רשומות; backfill מלא על ~1,000 רשומות ≈ 50–70 קריאות. להריץ backfill פעם אחת ואז incremental בלבד.
