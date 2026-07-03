# Insight Agent – Phase 2 Implementation Spec

מסמך אפיון לסוכן המימוש הבא. משלים את `BIDOC-insight-agent-upgrade-plan-CORRECTED.md` (להלן "התוכנית") אחרי שמומשו עדיפויות P0–P7 + Trend Analyzer בסיסי + closure follow-up + observability.

**מצב נוכחי (2026-07-03):** הצנרת הדטרמיניסטית חיה ב-`src/subagents/insightPipeline.js` ומחוברת ב-`src/subagents/projectInsights.js`. מיפוי קוד מלא: `docs/insight-agent-gap-analysis.md`. 200 בדיקות עוברות ב-`test/run-tests.js` (יש 12 כשלים ותיקים בבדיקות UI שאינם קשורים).

**כללים מחייבים לכל המשימות** (מסעיפים 22, 25–29 בתוכנית):

- שינויים קטנים והדרגתיים; feature flag לכל רכיב חדש תחת `config.insights.*`.
- אין commit/push בלי בקשה מפורשת מהמשתמש.
- כל metric חדש: `metric_id`, `metric_version`, `analysis_window`, `calculation_timestamp`; נתון חסר = `null` + `insufficient_data`, לעולם לא אפס.
- דטרמיניזם: אותו קלט + אותו `referenceDate` ⇒ אותו פלט (יש בדיקת deepEqual קיימת — לשמר).
- שדות response חדשים הם תוספתיים בלבד; אין לשבור את חוזה ה-JSON של ה-UI (`findings`/`insights`/`workflowLog`).
- להוסיף בדיקות יחידה לכל רכיב, ממופות לבדיקות הקבלה בסעיף 16 של התוכנית.
- זהירות עברית: אותיות סופיות (ם≠מ) בכללי regex, ושלילה ("לא הושלם") — ראו `STATEMENT_RULES` ו-`NEGATED_CLOSURE` כתקדים.

---

## Task 1 – Cross-Window Trend Analyzer (השלמת P8)

**מטרה:**
השוואת מדדים מול תקופת בסיס *קודמת* לחלון הניתוח (חודש קודם וכו'), לא רק חצי-מול-חצי בתוך החלון.

**המצב הקיים:**
`computeTrendAnalysis` ב-`insightPipeline.js` מחשב מגמה עם `baseline_definition: "first_half_of_analysis_window"`, גרסה `insight-trend-v1`, מינימום מדגם 5 לכל תקופה.

**השינוי:**
1. ב-`runProjectInsightsAnalysis`: כאשר `config.insights.crossWindowTrend === true`, להריץ `collectIndexRecords` נוסף על חלון הבסיס `[from - (to-from), from)` (ללא findings — הרשומות משמשות רק לאנליטיקה).
2. להריץ את שלבי normalize→dedupe→cluster על רשומות הבסיס בנפרד, ולחשב את אותם מדדים באותה גרסת נוסחה.
3. להוסיף ל-`computeTrendAnalysis` מצב `baseline_definition: "previous_window"` עם `baselineEvidence` חיצוני.
4. תנאי תקפות (סעיף 27): אותה גרסת נוסחה, חלונות בני-השוואה באורכם, מדגם מינימלי, וכיסוי נתונים דומה — אם `dated_evidence_ratio` בין התקופות נבדל ביותר מ-0.25, לסמן `sample_status: "coverage_mismatch"` ולא לקבוע מגמה.

**קבצים צפויים:** `src/subagents/insightPipeline.js`, `src/subagents/projectInsights.js`, `test/run-tests.js`.

**תלויות:** אין.

**סיכון:** בינוני (מכפיל את סריקת האינדקס; לכן מאחורי דגל, ברירת מחדל כבוי).

**בדיקות:** מגמה בין שני חלונות מלאכותיים; אי-קביעת מגמה בעת פער כיסוי; דטרמיניזם.

**קריטריון קבלה:** בדיקת התוכנית Test 11 עוברת עם baseline של חודש קודם אמיתי, כולל ערכי בסיס, תקופות וגרסת נוסחה בפלט.

---

## Task 2 – Root Cause Hypothesis Engine (P9, סעיף 26)

**מטרה:**
אחרי שנמצא דפוס משמעותי, להפיק **השערות סיבתיות** (לא קביעות) עם ראיות תומכות, ראיות נגד, מידע חסר ורמת ודאות.

**המצב הקיים:**
`detectInsightPatterns` מחזיר דפוסים; אין שום לוגיקה סיבתית. הפרומפט כבר מכיל את הכלל "Do not invent causal relationships".

**השינוי:**
1. מודול חדש `src/subagents/rootCauseHypothesis.js` עם פונקציה `generateRootCauseHypotheses({ config, patterns, clusters, evidence, runId, emit })`.
2. שלב דטרמיניסטי: לכל דפוס מסוג `unfulfilled_commitment`/`persistent_open_issue`/`status_deterioration`, לאסוף "מועמדי גורם": ראיות מאשכולות אחרים באותם האשטגים/ישויות שקדמו כרונולוגית לדפוס (חלון 30 יום לפני `first_date`), מסווגות לקטגוריות הסעיף (תכנון, רכש, תיאום, החלטות, מידע חסר, כוח אדם, ביצוע, ספק, אישור, תלות חיצונית) לפי מילון מילות מפתח.
3. שלב LLM אופציונלי (מודל lite, קריאה אחת, JSON): מקבל את הדפוס + מועמדי הגורם ומחזיר עד 2 השערות לפי הסכמה בסעיף 26 של התוכנית (`hypothesis_id`, `classification: "inference"`, `supporting_evidence_ids`, `counter_evidence_ids`, `alternative_hypotheses`, `missing_evidence`, `confidence`, `requires_validation: true`, `status: "candidate"`). מותר להחזיר `no_supported_hypothesis`.
4. ולידציה בקוד אחרי ה-LLM: לפסול השערה שה-`supporting_evidence_ids` שלה לא קיימים בראיות שסופקו; לכפות `classification: "inference"` ו-`requires_validation: true` תמיד.
5. חיבור: אחרי `pattern_detection` ולפני הסינתזה; ההשערות נכנסות ל-payload כ-`root_cause_hypotheses` (הפרומפט הראשי כבר יודע לטפל בהן כ-inference — לעדכן את סעיף Authoritative Inputs בפרומפט). Feature flag: `config.insights.rootCauseHypotheses !== false`? לא — ברירת מחדל **כבוי** (`=== true`) עד כיול.
6. צומת workflow חדש `root_cause_hypotheses` + עדכון בדיקת רשימת הצמתים.

**קבצים צפויים:** `src/subagents/rootCauseHypothesis.js` (חדש), `src/subagents/projectInsights.js`, `src/prompts.js`, `test/run-tests.js`.

**תלויות:** אין (patterns ו-lineage כבר יציבים).

**סיכון:** בינוני-גבוה (קריאת LLM נוספת; סיכון להצגת השערה כעובדה — הוולידציה בקוד חייבת לכפות ניסוח inference).

**בדיקות:** בדיקת התוכנית Test 12 — עיכוב החלטה + מידע חסר מהיועץ ללא אמירה מפורשת ⇒ השערה בלבד עם `requires_validation: true`; מקרה ללא מועמדים ⇒ `no_supported_hypothesis`; ולידציה פוסלת ids מומצאים.

**קריטריון קבלה:** אף השערה אינה מוצגת בתובנה כעובדה; כל השערה כוללת ראיות + מידע חסר; ניתן להחזיר "אין השערה מבוססת".

---

## Task 3 – Executive Health Score (P10, סעיף 28)

**מטרה:**
ציון בריאות שקוף, מגורסן ובר-הסבר, עם ציוני משנה, כיסוי נתונים ו-critical gates.

**המצב הקיים:**
אין. קיימים המדדים ב-`computeInsightAnalytics` ו-`data_quality` שיכולים להזין dimensions.

**השינוי:**
1. מודול חדש `src/subagents/healthScore.js`, פונקציה `computeHealthScore({ analytics, clusters, patterns, analysisWindow })`, גרסה `project-health-v1`.
2. Dimensions ראשונים (רק אלה שיש להם נתונים באינדקס): `schedule` (מ-overdue_commitments + unfulfilled patterns), `coordination` (מ-contradictions + persistent issues), `decision_velocity` (מ-open decision-type clusters וגילם), `information_readiness` (מ-data_quality). **אין** dimension בטיחות/עלות עד שיש להם מקורות נתונים ייעודיים.
3. כללי חוסר נתונים (חובה, סעיף 28): `minimum coverage` לכל dimension (התחלה: `dated_evidence_ratio >= 0.5` ו-`evidence >= 10`); dimension בלי כיסוי ⇒ `score: null, status: "insufficient_data"`; פחות מ-2 dimensions תקפים ⇒ אין ציון כולל (`status: "not_computed"`); ציון כולל עם כיסוי חלקי ⇒ `status: "provisional"`.
4. Critical gates: דפוס `contradiction` על אשכול בטיחותי, או `unfulfilled_commitment` עם `days_past_commitment > 30` ⇒ `critical_flag` + cap לציון (למשל 60). אירוע קריטי לעולם לא נבלע בממוצע.
5. פורמט הפלט: בדיוק כמו הדוגמה בסעיף 28 של התוכנית (score, status, score_version, period, data_coverage, subscores, missing_dimensions, critical_flags, change_from_previous_period=null בשלב זה).
6. Feature flag `config.insights.healthScore === true` (ברירת מחדל כבוי). הצגה ב-UI — מחוץ לתחולת המשימה; להחזיר בשדה response `healthScore` בלבד.
7. **אסור** להזין את הציון כראיה לסינתזת התובנות (סעיף 13: "Do not use an Executive Health Score by itself as evidence").

**קבצים צפויים:** `src/subagents/healthScore.js` (חדש), `src/subagents/projectInsights.js`, `test/run-tests.js`.

**תלויות:** יציבות המדדים הקיימים; עדיף אחרי Task 1 (לצורך change_from_previous_period).

**סיכון:** בינוני (סיכון עיקרי: נתון חסר שמתורגם לציון "בריא").

**בדיקות:** בדיקות התוכנית Test 10 (אין דוחות ⇒ `insufficient_data`, לא 100), Test 13 (critical flag לא נבלע בממוצע), Test 16 (`score_version` בכל פלט); דטרמיניזם.

**קריטריון קבלה:** כל 4 הבדיקות עוברות; אפשר להסביר כל ציון מתוך subscores + coverage בלבד.

---

## Task 4 – העשרת גרף ו-Entity Resolution לאשכולות (P11)

**מטרה:**
קיבוץ לפי ישויות וקשרים אמיתיים (קבלן, אזור, תלות) ולא רק לפי האשטגים וחפיפת טוקנים.

**המצב הקיים:**
`clusterCanonicalEvents` מקבץ לפי stems + hashtags. `graphSearch` (`src/supabase.js`) ו-`summarizeGraphContext` (`src/projectGraph.js`) רצים **אחרי** הצנרת, בתוך `runExistingProjectTools`, ותוצאתם מגיעה רק ל-payload של ה-LLM.

**השינוי:**
1. לפצל את `runExistingProjectTools`: להוציא את קריאת ה-graph לשלב מוקדם יותר (לפני `runInsightEvidencePipeline`), או להריץ את הצנרת פעמיים (הרצה שנייה עם graph context) — להחליט לפי מדידת latency; הכיוון המועדף: graph קודם.
2. להוסיף ל-`runInsightEvidencePipeline` פרמטר `graphEdges` אופציונלי: זוגות (source_id ↔ source_id) עם סוג קשר.
3. ב-clustering: שני אירועים שהרשומות שלהם מחוברות בקשת גרף ⇒ מאוחדים לאשכול גם בלי חפיפת טקסט; לשמור `cluster.graph_edges` ל-lineage.
4. Entity resolution בסיסי: מילון ישויות מתוך הגרף (שמות קבלנים/ספקים/אנשים) + נרמול וריאציות כתיב עברי; להוסיף `entities` לסכמת הראיה (השדה כבר מוגדר בתוכנית, סעיף 5.3).
5. דפוס `dependency_risk` (סעיף 6.5): כאשר אשכול פתוח מחובר בגרף לאשכול אחר ⇒ דפוס עם ניסוח "נדרש לבדוק האם" (לעולם לא "חוסם את").
6. Feature flag: `config.insights.graphClustering === true` (ברירת מחדל כבוי עד בדיקת איכות הגרף).

**קבצים צפויים:** `src/subagents/insightPipeline.js`, `src/subagents/projectInsights.js`, `src/projectGraph.js`, `test/run-tests.js`.

**תלויות:** זמינות ואיכות ה-graph RPC בסביבת KAPAIM (לבדוק לפני תחילת עבודה — אם ה-RPC מדולג/ריק ברוב הריצות, לדחות את המשימה).

**תוצאת בדיקת האיכות (2026-07-03):** ה-RPC מחזיר נתונים באופן עקבי — 8 קשרים בכל אחת מ-4 הריצות האחרונות (`tool_context.graphContext`). המשימה עוברת את סף המימוש. **אבל**: `summarizeGraphContext` (ב-`src/projectGraph.js`) מחזיר תוויות טקסט (`graphNodeLabel`) ולא מזהי רשומות; כדי לחבר קשת גרף לאשכול נדרש קודם לבדוק את מבנה השורות הגולמיות של ה-RPC (האם `source_node`/`target_node` נושאים `node_id` בפורמט `sourceNodeId(sourceTable, sourceId)`), ולממש `extractGraphRecordEdges(rawResults)` שממפה קשתות לזוגות record keys. לא לממש את המיפוי בניחוש.

**סיכון:** בינוני (שינוי סדר שלבים בזרימה חיה).

**בדיקות:** בדיקת התוכנית Test 6 (תלות לא מוכחת ⇒ "נדרש לבדוק", לא "חוסם"); איחוד אשכולות דרך קשת גרף; אי-איחוד בלי קשת ובלי חפיפה.

**קריטריון קבלה:** אשכולות מאוחדים לפי קשרי גרף כשהדגל דולק, וכל תובנת תלות מנוסחת כ"נדרש לבדוק".

---

## Task 5 – הפרדת event_date מ-document_date (צד ingestion)

**מטרה:**
לסגור את הפער שסכמת הראיות כבר תומכת בו: תאריך האירוע ≠ תאריך המסמך שמדווח עליו.

**המצב הקיים:**
`buildInsightEvidence` ממלא את שניהם מאותו שדה (`primary_date`/`created_at`). מתועד כשאלה פתוחה ב-gap analysis.

**השינוי:**
1. בצד ה-ingestion (n8n שממלא את `data_index` בפרויקט KAPAIM `smxibuaowzuxkznuouwj`): להוסיף עמודות `event_date` ו-`document_date` (migration ידני דרך Supabase SQL Editor — **לא מקוד**; לצרף את ה-SQL להערות המשימה לפי כללי CLAUDE.md).
2. ב-`normalizeRecord` (`projectInsights.js`): להעדיף `record.event_date` כשקיים; fallback להתנהגות הנוכחית.
3. ב-`buildInsightEvidence`: למפות את שני השדות בנפרד כשקיימים.
4. כלל קדימות בתוכנית (סעיף 5.7) כבר ממומש על `event_date` — אין שינוי לוגי נוסף.

**קבצים צפויים:** `src/subagents/projectInsights.js`, `src/subagents/insightPipeline.js`, workflow n8n של האינדוקס (מחוץ לריפו), migration SQL ידני.

**תלויות:** גישה ל-workflow האינדוקס ב-n8n; אישור המשתמש ל-migration.

**סיכון:** נמוך בקוד, בינוני ב-ingestion.

**בדיקות:** רשומה עם `event_date` שונה מ-`document_date` ⇒ הראיה משקפת את שניהם; ציר הזמן ממוין לפי `event_date`.

**קריטריון קבלה:** התחייבות שמדווחת במסמך מאוחר ממוקמת בציר הזמן לפי מועד האירוע.

---

## Task 6 – מדדי איכות מצטברים (השלמת סעיף 17)

**מטרה:**
מדדים חוצי-ריצות: אחוז תובנות מרובות-מקורות, שיעור פסילות לפי סיבה, יחס findings→approved insights, יציבות בין ריצות.

**המצב הקיים:**
כל ריצה שומרת `observability` מלא (request, retrieval, pipeline, synthesis+rejectionReasons, versions, timing) בתוך `project_insight_runs` דרך ה-response. אין אגרגציה.

**השינוי:**
1. Endpoint חדש `GET /api/insights/quality-metrics?date_from&date_to`: קורא את הריצות מ-`project_insight_runs`, מחשב מהשדה `observability` (ומ-metadata של ריצות ישנות כשקיים): ממוצע accepted/rejected, היסטוגרמת סיבות פסילה, אחוז תובנות עם ≥2 ממצאים תומכים, אחוז ריצות עם retry של הסינתזה, ממוצע משך ריצה.
2. ללא טבלה חדשה (כלל קיים בזיכרון הפרויקט: אין טבלאות חדשות ל-insights בלי בקשה מפורשת).
3. הצגה ב-UI — משימת המשך נפרדת; בשלב זה API בלבד.
4. מדדים הדורשים שיפוט אנושי (precision, hallucination rate, דירוג מנהלי פרויקט — סעיף 17) — **לא לחשב אוטומטית**; להוסיף שדה `human_review` ל-metadata של ריצה ולהשאיר מקום ל-UI עתידי.

**קבצים צפויים:** `src/server.js`, `src/subagents/projectInsights.js` (אם חסר שדה), `test/run-tests.js`.

**תלויות:** אין.

**סיכון:** נמוך.

**בדיקות:** אגרגציה על ריצות מדומות; ריצות legacy בלי `observability` לא מפילות את החישוב.

**קריטריון קבלה:** ה-endpoint מחזיר מדדים תקינים על היסטוריית הריצות הקיימת בפרויקט.

---

## Task 7 – Cross Project Learning (P12, סעיף 29) — עתידי בלבד

**לא לממש** עד שיש: הרשאה מפורשת בין לקוחות, anonymization, minimum cohort, similarity model מתועד ו-normalization לפי סוג/שלב פרויקט (רשימת התנאים המלאה בסעיף 29). כרגע אין בכלל מבנה רב-פרויקטי בנתונים — המשימה חסומה מוצרית, לא טכנית. כל פלט עתידי חייב `historical_signal: "indicator_only"` ואסור שיחשוף שמות/ציטוטים מפרויקט אחר.

---

## סדר מומלץ לסוכן הבא

1. Task 5 (ingestion dates) — פותח דיוק לכל השאר, זול בקוד.
2. Task 1 (cross-window trend) — משלים את P8.
3. Task 2 (root cause hypotheses) — P9.
4. Task 4 (graph clustering) — P11, בכפוף לבדיקת איכות הגרף.
5. Task 3 (health score) — P10, אחרון לפי הוראת התוכנית ("רק לאחר שיש מדדים יציבים... benchmark ידני").
6. Task 6 (quality metrics) — אפשר במקביל לכל שלב.

## הערה תפעולית חשובה

קיים override של פרומפט `project_insights` ב-`agent_settings` ב-Supabase שגובר על הפרומפט המשודרג ב-`src/prompts.js`. מנגנון ה-retry בקוד מפצה, אבל כל שינוי פרומפט עתידי לא ישפיע בפועל עד שה-override יאופס ב-הגדרות → "סוכני AI". לוודא זאת לפני כל כיול פרומפט.
