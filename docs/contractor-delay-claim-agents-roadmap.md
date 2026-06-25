# אפיון מדורג: מערך סוכנים לתיק תביעת עיכוב מצד הקבלן

תאריך: 2026-06-24  
מטרה: להפוך את רעיון מערך הסוכנים לתכנית ביצוע מדורגת שמתאימה לאפליקציית BIDoc הקיימת.

## 1. מצב קיים באפליקציה

האפליקציה הנוכחית היא SPA פשוטה ב-`public/` מעל שרת Node.js ב-`src/server.js`.

נקודות חיבור קיימות שצריך להשתמש בהן:

- שרת API מרכזי: `src/server.js`.
- תצורת מערכת, מודלים, Supabase, כלים וסוכני משנה: `src/config.js`.
- צינור הצ'אט הראשי: `src/agent.js`.
- חיפוש RAG היברידי מול Content Supabase: `hybridSearch` ב-`src/supabase.js`.
- Project Graph קיים: טבלאות `graph_nodes`, `graph_edges`, endpoint `GET /api/graph`, ומסך `#graph`.
- Timeline קיים: מסך `#timeline`, endpoint קומפקטי `GET /api/timeline/events`, קישורי אירועים, Knowledge Graph, חיפוש, pagination ותמיכה במובייל.
- Workflow קיים: הצגת צמתי ריצה, Run history, QA report, ולוגים של סוכנים.
- מסך Subagents קיים: `#subagents` ב-`public/index.html` ו-`loadSubAgents()` ב-`public/app.js`.
- סוכן התראות קיים: `src/subagents/alert.js`.
- סוכן ראיות מישיבות כבר קיים: `src/subagents/meeting.js`.
- אפיון סוכן ראיות מישיבות קיים: `docs/meeting-evidence-agent-spec.md`.
- סוכן הראיות מישיבות כבר מחובר חלקית ל-Main Agent דרך `meeting_evidence_search`.
- בדיקות קיימות:
  - בדיקות Node: `test/run-tests.js`.
  - בדיקות UI עם Playwright: `test/ui/`.

מסקנת תכנון: אין לבנות מערכת חדשה ונפרדת. יש להרחיב את BIDoc סביב ישויות חדשות של "תיק עיכוב", "אירוע עיכוב", "ראיה", "חוסר", "מסקנה", ו"סטטוס אישור".

## 2. עקרונות ביצוע

- כל טענה חייבת להחזיק מקור, ציטוט או הפניה.
- כל מסקנה אנליטית חייבת לכלול רמת ביטחון.
- יש להפריד בין:
  - עובדה מתועדת
  - חישוב
  - מסקנה אנליטית
  - נושא לבדיקה מקצועית
- אין לקבוע אחריות משפטית, זכאות כספית או השפעה על המסלול הקריטי ללא בסיס מספק.
- כל אירוע עיכוב יקבל מזהה קבוע.
- כל שינוי אנושי באירוע יישמר כהיסטוריית שינוי.
- יש להציג גם ראיות שמחזקות את הקבלן וגם ראיות שמחלישות אותו.
- יש להימנע מספירה כפולה של ימים, אירועים ועלויות.
- בכל שלב יש לשלב את Workflow כדי לראות מה כל סוכן עשה.

## 3. שלב 1 - תשתית תיק עיכוב ומודל נתונים

### מטרה

להוסיף לאפליקציה שכבת נתונים בסיסית לניהול תיק תביעת עיכוב: תיקים, מקורות, אירועי עיכוב, ראיות, חוסרים, מסקנות והיסטוריית שינויים.

### למה זה ראשון

בלי מודל נתונים יציב אי אפשר להפעיל סוכנים בצורה אמינה. הסוכנים צריכים לכתוב לאותו מבנה, והמסכים צריכים לאפשר אישור, תיקון ודחייה של הממצאים.

### רכיבים לביצוע

- ליצור SQL migration ב-`supabase/` עבור טבלאות App Supabase חדשות:
  - `delay_claim_cases`
  - `delay_claim_sources`
  - `delay_events`
  - `delay_event_evidence`
  - `delay_event_gaps`
  - `delay_event_findings`
  - `delay_event_change_log`
- להוסיף פונקציות CRUD ב-`src/supabase.js`.
- להוסיף endpoints ב-`src/server.js`:
  - `GET /api/delay-claims`
  - `POST /api/delay-claims`
  - `GET /api/delay-claims/:caseId/events`
  - `POST /api/delay-claims/:caseId/events`
  - `PATCH /api/delay-events/:eventId`
  - `POST /api/delay-events/:eventId/evidence`
  - `POST /api/delay-events/:eventId/change-log`
- להוסיף מסך בסיסי ב-SPA:
  - טאב חדש או תת-טאב בשם "תיק עיכוב".
  - רשימת אירועים.
  - כרטיס אירוע.
  - סטטוס אישור אנושי: מועמד, מאושר, נדחה, דורש בדיקה.
- להוסיף בדיקות Node ל-validation ול-API.

### גבולות השלב

לא להפעיל עדיין סוכני ניתוח מורכבים. בשלב הזה רק מכינים תשתית ויכולת ניהול ידנית.

### פרומפט ביצוע ל-Codex

```text
אתה עובד בתוך פרויקט BIDoc הקיים.

מטרת המשימה:
להוסיף תשתית נתונים ו-API לניהול תיק תביעת עיכוב מצד הקבלן, בלי לבנות מערכת נפרדת.

לפני ביצוע:
1. קרא את AGENTS.md.
2. הרץ bedrock sync אם נדרש.
3. קרא את:
   - bedrock/Memory/MEMORY.md
   - bedrock/Memory/stack.md
   - bedrock/Memory/chat.md
   - bedrock/Memory/subagents.md
   - bedrock/Memory/timeline.md
4. בדוק את הקבצים:
   - src/server.js
   - src/supabase.js
   - src/config.js
   - public/index.html
   - public/app.js
   - public/styles.css
   - test/run-tests.js

דרישות:
1. צור migration חדש בתיקיית supabase עבור טבלאות:
   - delay_claim_cases
   - delay_claim_sources
   - delay_events
   - delay_event_evidence
   - delay_event_gaps
   - delay_event_findings
   - delay_event_change_log

2. כל טבלת אירועים/ראיות/מסקנות חייבת לתמוך ב:
   - מזהה יציב
   - case_id
   - source references
   - confidence
   - status
   - created_at
   - updated_at
   - metadata jsonb

3. הוסף ל-src/supabase.js פונקציות App Supabase עבור:
   - יצירת תיק
   - שליפת תיקים
   - יצירת אירוע עיכוב
   - עדכון אירוע
   - שליפת אירועים לתיק
   - הוספת ראיה לאירוע
   - הוספת חוסר לאירוע
   - כתיבת change log

4. הוסף endpoints ב-src/server.js:
   - GET /api/delay-claims
   - POST /api/delay-claims
   - GET /api/delay-claims/:caseId/events
   - POST /api/delay-claims/:caseId/events
   - PATCH /api/delay-events/:eventId
   - POST /api/delay-events/:eventId/evidence
   - POST /api/delay-events/:eventId/change-log

5. הוסף UI בסיסי:
   - טאב "תיק עיכוב"
   - רשימת אירועי עיכוב
   - כרטיס פרטי אירוע
   - כפתורי סטטוס: אשר, דחה, דורש בדיקה
   - הצגת רמת ביטחון וראיות מקושרות

6. שמור על הסגנון הקיים של public/app.js ו-public/styles.css.

7. הוסף בדיקות Node ממוקדות עבור:
   - ולידציית payload של אירוע
   - יצירת DTO נקי
   - מניעת סטטוס לא חוקי
   - כתיבת change log בעת שינוי סטטוס

כללי אמינות:
- אל תמציא מסקנות משפטיות.
- אל תחשב ימים או אחריות בשלב הזה.
- אל תשבור את Timeline, Chat, Settings, Subagents או Workflow.
- אל תשמור secrets.

בסיום:
1. הרץ את בדיקות Node הרלוונטיות.
2. עדכן Bedrock Memory אם נוספה תשתית בפועל.
3. דווח אילו קבצים שונו ואילו בדיקות הורצו.
```

## 4. שלב 2 - MVP סוכני מקורות, כרונולוגיה, אירועים וראיות

### מטרה

להפעיל סוכנים שמאתרים מועמדים לאירועי עיכוב מתוך המידע שכבר קיים ב-Content Supabase, Timeline, Project Graph וסוכן הישיבות.

### רכיבים לביצוע

- סוכן מיפוי מקורות.
- סוכן כרונולוגיה.
- סוכן איתור אירועי עיכוב.
- סוכן איחוד אירועים בסיסי.
- סוכן ראיות.
- סוכן חוסרים וסתירות בסיסי.
- Workflow node ייעודי לכל סוכן.
- כתיבה ל-`delay_events`, `delay_event_evidence`, `delay_event_gaps`.

### חיבור למערכת הקיימת

- להשתמש ב-`hybridSearch` לשליפת מסמכים מ-Content Supabase.
- להשתמש ב-`GET /api/timeline/events` או בפונקציות השליפה הקיימות כדי להפיק כרונולוגיה.
- להשתמש ב-Project Graph כדי לזהות קשרים בין מסמכים, תאריכים, ספקים, נושאים ואירועים.
- להשתמש ב-`runMeetingEvidenceAgent` כאשר מקור או תוצאה קשורים ל-`meetings_documents`.

### גבולות השלב

לא לבצע עדיין ניתוח מסלול קריטי, Float, עלויות או זכאות. רק לאתר, לארגן, לאחד ולבסס ראיות.

### פרומפט ביצוע ל-Codex

```text
אתה עובד בתוך פרויקט BIDoc הקיים.

מטרת המשימה:
לבנות MVP של סוכני תיק עיכוב שמייצרים אירועי עיכוב מועמדים עם ראיות, חוסרים וכרונולוגיה.

תנאי מקדים:
שלב 1 כבר יצר טבלאות ו-API עבור delay_claim_cases, delay_events, evidence, gaps ו-change log.

לפני ביצוע:
בדוק את:
- src/agent.js
- src/subagents/alert.js
- src/subagents/meeting.js
- src/supabase.js
- src/server.js
- src/timelineGraph.js
- src/projectGraph.js
- public/app.js
- docs/meeting-evidence-agent-spec.md

דרישות:
1. צור מודול חדש:
   - src/subagents/delayClaim.js

2. המודול יכלול פונקציות נפרדות:
   - mapDelaySources()
   - buildDelayChronology()
   - detectDelayEventCandidates()
   - mergeDelayEventCandidates()
   - collectDelayEvidence()
   - detectDelayGapsAndContradictions()

3. הוסף endpoint:
   - POST /api/delay-claims/:caseId/analyze

4. ה-endpoint יקבל:
   - caseId
   - projectId אופציונלי
   - dateFrom/dateTo אופציונלי
   - focusQuery אופציונלי
   - sources אופציונלי

5. הסוכנים ישתמשו ב:
   - hybridSearch עבור תוכן כללי
   - Project Graph עבור קשרים
   - Timeline עבור רצף תאריכים
   - Meeting Evidence Agent עבור ציטוטים מישיבות

6. לכל אירוע מועמד יש לשמור:
   - event_key יציב
   - title
   - short_description
   - contractor_claim
   - event_type
   - start_date
   - end_date
   - alleged_responsible_party
   - confidence
   - readiness_score ראשוני אם יש מספיק נתונים
   - human_status = candidate

7. לכל ראיה יש לשמור:
   - source_type
   - source_id
   - source_url אם יש
   - quote או excerpt
   - what_it_supports
   - supports_or_weakens
   - confidence

8. לכל חוסר יש לשמור:
   - missing_item
   - why_it_matters
   - affected_event_id
   - urgency

9. הוסף Workflow log:
   - source_mapping
   - chronology
   - delay_detection
   - event_merge
   - evidence_collection
   - gaps_contradictions
   - write_results

10. הוסף UI להרצת ניתוח:
   - כפתור "נתח תיק"
   - מצב טעינה
   - הצגת כמה אירועים/ראיות/חוסרים נוצרו
   - קישור לפתיחת האירועים שנוצרו

כללי אמינות:
- אין ליצור אירוע ללא ראיה אחת לפחות או סימון ברור שהוא מועמד חלש.
- אין לאחד אירועים אם התאריכים או המקורות סותרים בלי לשמור את הסתירה.
- אין להציג אחריות כקביעה סופית.
- יש להציג ראיות מחזקות ומחלישות.

בדיקות:
- הוסף בדיקות Node לסוכני זיהוי ואיחוד עם fixtures.
- הוסף בדיקת UI אחת לפחות להרצת analyze במוק.

בסיום:
הרץ בדיקות רלוונטיות ועדכן Bedrock Memory.
```

## 5. שלב 3 - סוכני ניתוח עומק ודירוג מוכנות

### מטרה

להפוך אירועים מועמדים לאירועים מנותחים: סיבתיות, הודעות, אחריות אפשרית, עיכובים מקבילים, הקטנת נזק, תקיפת טענה ודירוג מוכנות.

### רכיבים לביצוע

- סוכן שרשרת סיבתיות.
- סוכן הודעות והתרעות.
- סוכן אחריות.
- סוכן עיכובים מקבילים.
- סוכן הקטנת נזק והאצה.
- סוכן תקיפת הטענה.
- סוכן דירוג מוכנות.
- סוכן בקרת איכות.

### חיבור למערכת הקיימת

- להשתמש בממצאים שנשמרו בשלב 2.
- להשתמש ב-Workflow להצגת כל שכבת ניתוח.
- להשתמש בסוכן הישיבות לאימות ציטוטים.
- להשתמש ב-Project Graph לזיהוי קשרים בין אירועים, גורמים, מסמכים ותאריכים.

### גבולות השלב

לא לחשב עדיין השפעה סופית על מסלול קריטי או סכומי נזק. כן מותר לסמן "דורש מומחה לו״ז" או "דורש בדיקת עורך דין".

### פרומפט ביצוע ל-Codex

```text
אתה עובד בתוך פרויקט BIDoc הקיים.

מטרת המשימה:
להוסיף סוכני ניתוח עומק לאירועי תיק עיכוב קיימים, תוך שמירה על הפרדה בין עובדה, חישוב, מסקנה ונושא לבדיקה מקצועית.

תנאי מקדים:
שלבים 1-2 כבר קיימים ויש אירועי delay_events עם ראיות וחוסרים.

דרישות:
1. הרחב את src/subagents/delayClaim.js או פצל למודולים ממוקדים אם הקובץ גדול מדי:
   - src/subagents/delayClaim/causality.js
   - src/subagents/delayClaim/notices.js
   - src/subagents/delayClaim/responsibility.js
   - src/subagents/delayClaim/concurrency.js
   - src/subagents/delayClaim/mitigation.js
   - src/subagents/delayClaim/attack.js
   - src/subagents/delayClaim/readiness.js
   - src/subagents/delayClaim/quality.js

2. הוסף endpoint:
   - POST /api/delay-events/:eventId/analyze

3. הניתוח יחזיר וישמור:
   - causality_chain
   - notice_status
   - possible_responsibility
   - concurrent_delays
   - mitigation_actions
   - acceleration_indicators
   - counter_arguments
   - contractor_possible_response
   - readiness_score
   - attack_risk
   - professional_review_required

4. כל שדה אנליטי חייב לכלול:
   - finding_type: documented_fact | calculation | analytical_conclusion | professional_review
   - confidence
   - evidence_ids
   - explanation

5. סוכן תקיפת הטענה חייב לבדוק:
   - האם הפעילות הייתה קריטית
   - האם היה Float
   - האם הקבלן היה באיחור קודם
   - האם הייתה חזית מוכנה
   - האם הייתה הודעה בזמן
   - האם קיימת ספירה כפולה
   - האם יש ראיות שמחלישות את הקבלן

6. סוכן בקרת איכות חייב לסמן:
   - טענה ללא מקור
   - תאריך ללא מקור
   - סתירה פנימית
   - ספירת ימים כפולה
   - אירוע שדורש אישור אנושי

7. עדכן UI במסך אירוע:
   - לשונית שרשרת סיבתיות
   - לשונית הודעות
   - לשונית עיכובים מקבילים
   - לשונית טענות נגד
   - לשונית חוסרים
   - מדד מוכנות
   - סיכון להתקפה

8. עדכן Workflow:
   - causality_agent
   - notice_agent
   - responsibility_agent
   - concurrency_agent
   - mitigation_agent
   - attack_agent
   - readiness_agent
   - quality_agent

כללי אמינות:
- אין לקבוע אחריות משפטית סופית.
- אין לקבוע שהאירוע השפיע על המסירה בלי נתוני לו״ז מספיקים.
- יש לציין "דורש בדיקה מקצועית" במקום מסקנה סופית כשאין בסיס מספק.
- אין להסתיר מידע שמחליש את הטענה.

בדיקות:
- בדיקות יחידה לדירוג readiness.
- בדיקות יחידה לזיהוי טענות ללא מקור.
- בדיקת UI למסך אירוע עם ניתוח מלא במוק.

בסיום:
הרץ בדיקות רלוונטיות ועדכן Bedrock Memory.
```

## 6. שלב 4 - לו״ז, עלויות ותוצרי תביעה

### מטרה

להוסיף שכבת ניתוח מתקדמת עבור לוחות זמנים, Float, מסלול קריטי, עלויות, ותוצרים מסודרים לעורך דין ולמומחה לו״ז.

### רכיבים לביצוע

- סוכן ניתוח לוחות זמנים.
- סוכן עלויות ונזקים.
- סוכן יצירת תוצרי תביעה.
- Dashboard ראשי לתיק.
- ייצוא תוצרים.

### חיבור למערכת הקיימת

- להשתמש ב-Timeline לציר זמן.
- להשתמש ב-Project Graph לקשרים בין אירועים, פעילויות, מסמכים ועלויות.
- להשתמש במסך Workflow לבקרת תהליך.
- להשתמש במבנה האירועים והראיות שכבר נבנה בשלבים 1-3.

### גבולות השלב

המערכת לא מחליפה מומחה לו״ז או עורך דין. היא מכינה תיק בדיקה, מציפה סיכונים ומארגנת ראיות.

### פרומפט ביצוע ל-Codex

```text
אתה עובד בתוך פרויקט BIDoc הקיים.

מטרת המשימה:
להוסיף לתיק העיכוב שכבת לו״ז, עלויות ותוצרי תביעה, בלי לקבוע מסקנות משפטיות או מקצועיות סופיות.

תנאי מקדים:
שלבים 1-3 קיימים, ויש אירועי delay_events עם ראיות, חוסרים, ניתוח סיבתיות ודירוג מוכנות.

דרישות:
1. הרחב את מודל הנתונים עם migration חדש עבור:
   - delay_schedule_versions
   - delay_schedule_activities
   - delay_event_schedule_links
   - delay_cost_items
   - delay_claim_exports

2. הוסף פונקציות ב-src/supabase.js:
   - שמירת גרסת לו״ז
   - שליפת פעילויות
   - קישור אירוע לפעילות
   - שמירת עלות
   - יצירת רשומת export

3. הוסף סוכנים:
   - scheduleAnalysisAgent
   - costDamageAgent
   - claimOutputAgent

4. סוכן לו״ז חייב:
   - לזהות גרסאות לו״ז
   - לזהות פעילויות ואבני דרך
   - לקשר אירוע לפעילויות מושפעות
   - לסמן אם אין מספיק נתונים
   - לא לקבוע critical path impact בלי בסיס
   - להציג Float רק אם קיים מקור או חישוב ברור

5. סוכן עלויות חייב:
   - לזהות עלויות קשורות לאירועים
   - לסווג עלות ישירה/עקיפה/אומדן
   - לקשר למסמך תומך
   - לזהות כפילויות
   - לא לחשב זכאות כספית סופית

6. סוכן תוצרים חייב לייצר:
   - תקציר הנהלה
   - כרונולוגיה מלאה
   - רשימת אירועי עיכוב
   - כרטיס אירוע מפורט
   - רשימת חוסרים
   - רשימת ראיות
   - מסמך הכנה לעורך דין
   - מסמך הכנה למומחה לו״ז

7. הוסף Dashboard למסך תיק עיכוב:
   - מועד מסירה חוזי
   - מועד מסירה בפועל
   - ימי איחור כולל אם יש מספיק נתונים
   - מספר אירועים
   - אירועים חזקים
   - אירועים חלשים
   - אירועים שדורשים חקירה
   - מסמכים חסרים
   - מדד מוכנות כללי
   - פעולות מומלצות

8. הוסף ייצוא Markdown או JSON לתוצרים.

כללי אמינות:
- אין לקבוע זכאות כספית סופית.
- אין לקבוע אחריות משפטית סופית.
- אין לקבוע השפעה על מסלול קריטי ללא נתוני לו״ז מספקים.
- כל חישוב חייב לכלול נוסחה או הסבר.
- כל תוצר חייב לשמור קישור לראיות המקור.

בדיקות:
- בדיקות יחידה לחישובי ימים ו-Float כאשר קיים input ברור.
- בדיקות כפילות עלויות.
- בדיקת UI ל-Dashboard.
- בדיקת export בסיסית.

בסיום:
הרץ בדיקות רלוונטיות ועדכן Bedrock Memory.
```

## 7. המלצת סדר עבודה

הסדר המומלץ:

1. לבצע את שלב 1 בלבד.
2. לבדוק שה-UI וה-API עובדים ידנית.
3. לבצע את שלב 2 ולראות שנוצרים אירועים אמיתיים עם ראיות.
4. לתת למשתמש לערוך ולאשר כמה אירועים.
5. רק אחרי שיש אירועים מאושרים לעבור לשלב 3.
6. את שלב 4 לבצע רק כשיש לוחות זמנים, עלויות ומסמכים מתאימים.

## 8. סיכוני פיתוח

- שלב 2 עלול להחזיר יותר מדי אירועים אם אין סינון טוב.
- שלב 3 עלול ליצור מסקנות חזקות מדי אם לא אוכפים `finding_type` ו-`confidence`.
- שלב 4 מסוכן בלי דאטה איכותי של לו״ז ועלויות.
- חיבור לא נכון ל-Content Supabase עלול לערבב בין פרויקטים.
- שימוש לא זהיר ב-Meeting Evidence Agent עלול להציג ציטוטים ארוכים מדי או לא רלוונטיים.

## 9. הגדרת הצלחה לפיילוט

הפיילוט ייחשב מוצלח אם המערכת מצליחה:

- לזהות אירועי עיכוב מועמדים.
- לקשר כל אירוע לראיות.
- להציג חוסרים וסתירות.
- להפריד בין עובדה למסקנה.
- להראות אילו אירועים חזקים ואילו חלשים.
- לאפשר אישור, דחייה ועריכה אנושית.
- לייצר בסיס עבודה מסודר לקבלן, לעורך דין ולמומחה לו״ז.
