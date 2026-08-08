# Insight Agent – Gap Analysis (מול BIDOC-insight-agent-upgrade-plan-CORRECTED.md)

תאריך: 2026-07-02

## 1. סיכום הארכיטקטורה הקיימת

- Entry point: `POST /api/insights/analyze` ב-`src/server.js` (סביב שורה 261) → `runProjectInsightsAnalysis` ב-`src/subagents/projectInsights.js`.
- הזרימה הקיימת (לפי `runProjectInsightsAnalysis`):
  1. `primeFromAlerts` – התראות נותנות כיוון חיפוש (האשטגים + מונחים + שאילתה נגזרת, עם עידון LLM אופציונלי).
  2. `collectIndexRecords` – סריקת אינדקס התוכן דרך `fetchTimelineEventPage` (`src/supabase.js`).
  3. `buildHashtagContext` – האשטגים נבחרים/מובילים כ-boost.
  4. `searchFocusRecords` – `hybridSearch` כשיש שאילתת מיקוד.
  5. `dedupeRecords` + `sortRecordsByHashtagBoost` – איחוד לפי `sourceKey` ומיון.
  6. `runExistingProjectTools` – Graph Search, Alert Agent, כלי n8n, Source Quality, Conflict Detection.
  7. `generateProjectInsights` – קריאת LLM אחת שמחזירה `findings` (עם `evidence_record_indexes`) ו-`insights` (עם `supporting_finding_ids`).
  8. `buildProjectInsightsWorkflowLog` – לוג צמתים ל-UI.
- שכבת התמדה: `project_insight_runs` (Supabase, פרויקט KAPAIM).

## 2. טבלת השוואה: רכיב רצוי מול המצב בקוד

| רכיב רצוי | מצב בקוד | מיקום בקוד | מה קיים בפועל | הפער | פעולה מומלצת |
|---|---|---|---|---|---|
| Query Understanding | קיים חלקית | `primeFromAlerts`, פרמטרים `focusQuery/dateFrom/dateTo` ב-`projectInsights.js` | כיוון חיפוש מהתראות + שאילתת משתמש | אין סיווג סוג בקשה (עובדתית/סיכום/תובנות) | דחוי; ה-endpoint ייעודי לתובנות בלבד |
| Retrieval Planner | קיים חלקית | `runProjectInsightsAnalysis` שלבים 1–4 | hashtag + hybrid + index scan + graph + alerts + n8n | אין follow-up searches ואין חיפוש ראיות סגירה יזום | שלב עתידי (P11) |
| Evidence Collector/Normalizer | לא קיים | — | `normalizeRecord` מנרמל שדות רשומה, אך אין evidence schema: אין evidence_type, אין statement type, אין event_date נפרד מ-document_date, אין expected_date | הפער המרכזי | **מומש עכשיו** ב-`src/subagents/insightPipeline.js` (`buildInsightEvidence`) |
| Source lineage (primary/derived) | לא קיים | — | התראות ורשומות אינדקס מטופלות כשוות | ספירת מקורות מנופחת | **מומש עכשיו**: `lineage.origin_type` + `independent_source_count` |
| Deduplication (near-dup, canonical events) | קיים חלקית | `dedupeRecords` ב-`projectInsights.js` | איחוד לפי מפתח מקור בלבד (`source_table:source_id:id:title`) | אין זיהוי near-duplicates ואין אירועים קנוניים | **מומש עכשיו**: `dedupeInsightEvidence` |
| Topic/Entity Clustering | לא קיים | — | הקיבוץ היחיד הוא לפי סיגנל מילות-מפתח (`detectProjectFindings`) | אין אשכולות נושא | **מומש עכשיו**: `clusterCanonicalEvents` |
| Timeline Builder + latest status + closure + contradiction | לא קיים | — | אין ציר זמן פר נושא | דפוסי זמן בלתי ניתנים לזיהוי | **מומש עכשיו**: ציר זמן בתוך כל אשכול, `latest_status`, `closed`, `contradiction` |
| Analytics Engine דטרמיניסטי | לא קיים | — | אין מדדים מחושבים; המודל מקבל רשומות גולמיות | LLM "מחשב" בעצמו | **מומש עכשיו**: `computeInsightAnalytics` (open/closed, age, days past due, recurrence, independent sources, coverage; `insufficient_data` במקום אפס; `analytics_version`) |
| Pattern Detection (כללים מפורשים) | לא קיים | — | אין כללי unfulfilled commitment / deterioration / persistence / contradiction / closure | דפוסים תלויים ב-LLM בלבד | **מומש עכשיו**: `detectInsightPatterns` |
| Insight Synthesizer | קיים חלקית | `generateProjectInsights` + פרומפט `project_insights` ב-`src/prompts.js` | שתי שכבות findings/insights עם ציטוט ראיות | הפרומפט לא מקבל analytics/clusters/patterns ולא אוכף כללי ראיה-הסקה | **עודכן עכשיו**: payload מובנה + פרומפט משודרג (סעיף 13 בתוכנית, מותאם לחוזה ה-JSON הקיים) |
| Insight Critic + סיבות פסילה | לא קיים | — | אין ולידציה אחרי ה-LLM מעבר לנרמול שדות (`normalizeAiInsights` מסנן insights בלי טקסט וממפה supporting ids) | תובנות חלשות/סגורות עוברות | **מומש עכשיו**: `critiqueAndRankInsights` עם rejection reasons |
| Ranking + מגבלת 3–5 | קיים חלקית | מיון לפי severity ב-`detectProjectFindings`; `slice(0,8)` ב-`normalizeAiInsights` | אין score מגורסן | **מומש עכשיו**: `insight-ranking-v1` + cap 5 |
| Root Cause Hypothesis Engine | לא קיים | — | — | עתידי (P9) — רק אחרי ש-patterns ו-lineage יציבים |
| Trend Analyzer | לא קיים | — | קיים `runQaTrendAnalysis` ב-`src/qaAgent.js` אבל הוא על ריצות QA, לא על ראיות פרויקט | עתידי (P8), כתת-רכיב של analytics |
| Executive Health Score | לא קיים | — | — | עתידי (P10) |
| Cross Project Learning | לא קיים | — | — | עתידי (P12) |
| Observability | קיים חלקית | `trace`/`emit` + `buildProjectInsightsWorkflowLog` + `runLog.js` | לוג צמתים חי ל-UI | אין מדדי איכות מצטברים | הצמתים החדשים נוספו ללוג; מדדים מצטברים בהמשך |

## 3. סיכונים וכפילויות שנמצאו

- `detectProjectFindings` (סיגנלים דטרמיניסטיים) כבר אינו בשימוש בזרימה הראשית — `generateProjectInsights` הוא המסלול היחיד ל-findings. הפונקציה מיוצאת ונבדקת בטסטים; נשמרה כ-fallback לוגי אך אינה מחוברת. (קיים אך לא מחובר לזרימה.)
- `parseInsightJson` שומר תאימות לפורמט legacy (מערך תובנות) — לא למחוק.
- ספירת מקורות: התראה שנוצרה ממסמך נספרה כרשומה עצמאית. טופל דרך lineage.
- אין הבחנה בין "אין נתונים" ל"אפס" בשום מקום בזרימה הישנה. טופל ב-analytics עם `insufficient_data`.

## 4. רכיבים ממוחזרים

- `normalizeRecord` / `sourceKey` / `normalizeRecordTags` / `topHashtagsFromRecords` — נשארים המקור לנרמול רשומות; ה-pipeline החדש מקבל רשומות מנורמלות.
- `toProjectInsightEvidence` — ממשיך לשמש להצגת ראיות ב-UI.
- `annotateToolCall`/`buildSourceQualitySummary`/`detectConflicts` (`src/sourceQuality.js`) — ללא שינוי.
- `chatCompletion`/`extractJsonObject` (`src/openrouter.js`) — ללא שינוי.

## 5. תוכנית יישום לפי עדיפויות (מה מומש בסבב זה)

| עדיפות בתוכנית | סטטוס |
|---|---|
| P0 מיפוי קוד | הושלם (מסמך זה) |
| P1 ולידציה שעוצרת ממצאים-כתובנות | מומש — critic + פרומפט |
| P2 Evidence schema + lineage | מומש — `insightPipeline.js` |
| P3 Deduplication + Timeline | מומש |
| P4 Clustering | מומש (דטרמיניסטי, hashtags + חפיפת טוקנים) |
| P5 Analytics בסיסי | מומש (open/closed, age, days past due, independent sources, recurrence, coverage) |
| P6 Pattern detection | מומש (5 דפוסים ראשונים) |
| P7 Critic + ranking | מומש (בסיסי, כולל rejection reasons) |
| P8–P12 | לא מומש — עתידי בהתאם לתוכנית |

## 6. שאלות פתוחות

- אין בנתוני האינדקס הפרדה אמינה בין `event_date` ל-`document_date`; כיום שניהם נגזרים מ-`primary_date`/`created_at`. נדרש שדה ייעודי בצד ה-ingestion כדי לסגור את זה במלואו.
- זיהוי ישויות (קבלן/ספק/אחראי) מבוסס כרגע על האשטגים בלבד; entity resolution אמיתי דורש מילון ישויות פרויקטלי או שימוש בגרף.
