# אפיון מוצר וטכני — שדרוג מסך Workflow QA ב־BiDoc

**שם הפיצ'ר:** Visual Agent Workflow Inspector  
**מערכת:** BiDoc  
**מסך יעד:** זרימת עבודה / Workflow  
**מטרת המסמך:** להגדיר במדויק את השדרוג הנדרש למסך בדיקות הריצה של סוכנים, כך שכל שלב בתהליך יוצג ככרטיסיית Debug מלאה הכוללת Input, Output, סטטוס, זמני ריצה ומידע תפעולי — ישירות על גבי תרשים ה־Workflow.

---

## 1. תקציר

מסך ה־Workflow הקיים מציג כיום שני עולמות נפרדים:

1. תרשים זרימה של הרכיבים בתחתית המסך.
2. לוגים, נתוני ריצה ומדדים באזורים נפרדים מעל התרשים.

מבנה זה מחייב את המשתמש לעבור בין אזורים במסך, לגלול, לפתוח פרטים ולנסות להבין ידנית איזה Input נכנס לכל רכיב ואיזה Output יצא ממנו.

השדרוג המבוקש יהפוך את תרשים ה־Workflow ל־**Visual Execution Inspector**:

- כל Node יוצג ככרטיסייה.
- בחלק העליון של הכרטיסייה יוצג ה־Input שנכנס לרכיב.
- בחלק התחתון יוצג ה־Output שהרכיב החזיר.
- בכותרת יוצגו שם הרכיב, סוגו, הסטטוס וזמן הביצוע.
- בתחתית יוצגו Tokens, עלות, Cache, מספר ניסיונות ונתוני Debug נוספים.
- הקווים בין הרכיבים יציגו מה עבר בפועל בין השלבים.
- ניתן יהיה להבין את כל הריצה מתוך ה־Canvas, ללא מעבר בין אזורים נפרדים במסך.

---

## 2. מטרות

### 2.1 מטרה ראשית

לאפשר למשתמש לבצע QA מלא לריצת סוכנים מתוך מבט אחד על תרשים ה־Workflow.

### 2.2 מטרות משנה

- לזהות במהירות באיזה Node התחילה תקלה.
- לראות האם המידע הועבר נכון בין רכיב לרכיב.
- להבין האם Classifier ניתב נכון את הבקשה.
- לזהות Output חסר, שגוי או מקוצר.
- לזהות Fallback, Retry, Timeout או Cache hit.
- להשוות בין שתי ריצות ולראות באיזה שלב נוצר ההבדל.
- לצמצם מעבר בין לוגים, חלונות ועמודים.
- להקטין משמעותית את זמן האבחון של תקלות.

---

## 3. בעיות במצב הקיים

### 3.1 הפרדה בין הגרף לנתוני הריצה

הגרף מציג את המבנה, אך לא את המידע שעבר בפועל בכל שלב.

### 3.2 קושי במעקב אחר Payload

לא ניתן לראות באופן מיידי:

- מה נכנס לרכיב.
- מה יצא ממנו.
- מה הועבר לרכיב הבא.
- האם בוצע שינוי או איבוד מידע בדרך.

### 3.3 צורך בגלילה ובמעבר בין אזורים

המשתמש נדרש לעבור בין:

- רשימת הריצות.
- לוג הריצה.
- מדדים.
- תרשים ה־Workflow.
- חלון פרטים נוסף.

### 3.4 לוגים שאינם ממופים ויזואלית

שורות כגון:

- `main_agent failed`
- `source_quality scored`
- `cache miss`
- `fallback used`

מופיעות כרשימה, אך אינן מחוברות בצורה ברורה ל־Node הרלוונטי.

### 3.5 קושי בזיהוי מקור התקלה

כאשר התוצאה הסופית אינה נכונה, קשה לדעת האם הבעיה הייתה:

- ב־Input הראשוני.
- בניקוי הטקסט.
- בסיווג.
- ב־Prompt.
- בשליפת הידע.
- בתוצאת Agent.
- במיפוי בין רכיבים.
- ב־Fallback.

---

## 4. קונספט הממשק החדש

המסך החדש יתבסס על Canvas אינטראקטיבי בסגנון Node-Based Workflow Debugger.

כל רכיב בתהליך יהיה גם:

1. רכיב בתרשים.
2. יחידת Debug.
3. תצוגת Input.
4. תצוגת Output.
5. יחידת מדידה.
6. נקודת זיהוי תקלות.

### עיקרון מרכזי

> כל Node חייב לאפשר להבין מה נכנס אליו, מה הוא עשה ומה יצא ממנו — בלי לפתוח מסך נפרד.

---

## 5. מבנה כללי של המסך

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Run Selector | Compare | Search | Filters | Zoom | Fit | Auto Layout │
├───────────────┬──────────────────────────────────────────────────────┤
│               │                                                      │
│ Run History   │                 Workflow Canvas                      │
│               │                                                      │
│ Run 104 ✓     │   [Node] → [Node] → [Node]                           │
│ Run 103 ⚠     │                  ↓                                   │
│ Run 102 ✕     │              [Node] → [Node]                         │
│               │                                                      │
├───────────────┴──────────────────────────────────────────────────────┤
│ Duration | Tokens | Cost | Calls | Cache | Errors | Warnings         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. אזורי הממשק

## 6.1 סרגל עליון

הסרגל העליון יהיה Sticky ויכלול:

- בחירת ריצה.
- מזהה ריצה.
- תאריך ושעת ריצה.
- סטטוס כללי.
- משך הריצה.
- חיפוש Node.
- חיפוש ערך בתוך Input או Output.
- סינון לפי סוג רכיב.
- סינון לפי סטטוס.
- הצגת Errors only.
- הצגת Warnings only.
- כפתור Compare Runs.
- כפתור Fit to Screen.
- Zoom In.
- Zoom Out.
- Reset Zoom.
- Auto Layout.
- Expand All.
- Collapse All.
- Raw Mode.
- Export Run.

### התנהגות

- הסרגל נשאר קבוע בעת גלילה.
- שינוי ריצה מעדכן את כל הכרטיסיות.
- בחירת Compare מפצלת כל כרטיסייה לתצוגת Previous / Current או מציגה Diff.

---

## 6.2 היסטוריית ריצות

הפאנל הצדדי יציג:

- זמן הריצה.
- השאלה המקורית.
- סטטוס.
- משך.
- עלות.
- מספר שגיאות.
- מספר אזהרות.
- Agent ראשי שנבחר.
- האם הופעל Fallback.

### תצוגת פריט

```text
מה הוחלט בישיבה האחרונה?
Run #104
03:56:28
✓ Success · 4.8s · $0.0044
```

### צבעי סטטוס

- ירוק — Success.
- אדום — Failed.
- כתום — Warning / Partial / Fallback.
- כחול — Running.
- אפור — Cancelled / Skipped.

### התנהגות

- לחיצה על ריצה טוענת את הריצה לתוך ה־Canvas.
- Hover מציג תקציר.
- הריצה הפעילה מסומנת בבירור.
- ניתן להצמיד ריצות חשובות.
- ניתן לבחור שתי ריצות להשוואה.

---

## 6.3 Workflow Canvas

ה־Canvas הוא האזור המרכזי במסך.

### דרישות

- Pan באמצעות גרירת הרקע.
- Zoom באמצעות גלגלת או קיצורי מקלדת.
- Fit to screen.
- Mini map אופציונלי.
- Auto layout.
- שמירת מיקום Nodes לכל Workflow.
- תמיכה ב־RTL ברמת הממשק, אך שמירה על זרימת התהליך בהתאם להגדרת ה־Workflow.
- אפשרות לשנות כיוון:
  - ימין לשמאל.
  - שמאל לימין.
  - מלמעלה למטה.

### ברירת מחדל מומלצת

במערכת עברית:

- ה־Sidebar נשאר בצד ימין.
- התרשים עצמו יכול לזרום משמאל לימין כדי לשמור על סטנדרט טכני מוכר.
- הטקסט בתוך הכרטיסיות מיושר לפי סוג התוכן.

---

## 7. מבנה כרטיסיית Node

כל Node יוצג ככרטיסייה בעלת חמישה אזורים:

```text
┌───────────────────────────────────────────────┐
│ Header                                        │
├───────────────────────────────────────────────┤
│ Input                                         │
├───────────────────────────────────────────────┤
│ Processing / Decision                         │
├───────────────────────────────────────────────┤
│ Output                                        │
├───────────────────────────────────────────────┤
│ Metrics / Debug Footer                        │
└───────────────────────────────────────────────┘
```

---

## 7.1 Header

הכותרת תציג:

- אייקון לפי סוג הרכיב.
- שם תצוגה.
- שם טכני.
- סוג הרכיב.
- סטטוס.
- משך ביצוע.
- מספר הפעלה.
- מספר Retry.
- כפתור פתיחה / סגירה.
- תפריט פעולות.

### דוגמה

```text
Smart Classifier
classifier · Success · 86ms
```

### תפריט פעולות

- Open Full Details.
- Copy Node ID.
- Copy Input.
- Copy Output.
- Copy Raw JSON.
- Pin Node.
- Focus Node.
- Compare Node.
- Re-run From Here, אם המערכת תומכת בכך.
- Open Logs.

---

## 7.2 אזור Input

האזור העליון בגוף הכרטיסייה יציג את הנתונים שנכנסו בפועל לרכיב.

### כותרת

```text
INPUT
```

### סוגי מידע אפשריים

- טקסט משתמש.
- System Prompt.
- Conversation History.
- Variables.
- Project ID.
- User ID.
- Retrieved context.
- Tool arguments.
- Model parameters.
- Memory.
- Documents.
- Previous Node output.
- Metadata.

### עקרונות תצוגה

- לא להציג JSON גולמי כברירת מחדל.
- לבצע Pretty Rendering לפי סוג הנתון.
- שדות חשובים תמיד גלויים.
- שדות ארוכים מקוצרים.
- ניתן לפתוח כל שדה בנפרד.
- ערכים חסרים מסומנים.
- ניתן להעתיק כל שדה.
- ניתן לעבור ל־Raw JSON.

### דוגמה

```text
INPUT

User Message
"מה הוחלט בישיבה האחרונה?"

Project
Project 17

History
6 messages

Context
12 chunks
```

### שדות רגישים

שדות רגישים יוצגו בצורה מוסתרת כברירת מחדל:

```text
api_key: ••••••••••••
```

---

## 7.3 אזור Processing / Decision

אזור זה יוצג רק כאשר יש ערך עסקי להצגת ההחלטה הפנימית של הרכיב.

### דוגמאות

#### Classifier

```text
DECISION

Intent
meeting_summary

Confidence
0.94

Selected Route
meeting_summary_agent
```

#### Retrieval

```text
RETRIEVAL

Query
"החלטות ישיבה אחרונה"

Index
meetings_index

Top K
12

Filters
project_id = 17
```

#### Agent

```text
EXECUTION

Model
openai/gpt-4o

Temperature
0.2

Tools Available
4

Tools Used
2
```

### הערה

אין להציג Chain of Thought פנימי.  
יש להציג רק נתונים תפעוליים, החלטות מפורשות, Tool Calls, Routes ו־Structured Outputs.

---

## 7.4 אזור Output

האזור התחתון בגוף הכרטיסייה יציג את התוצאה שהרכיב החזיר בפועל.

### כותרת

```text
OUTPUT
```

### סוגי Output

- Text.
- JSON.
- Classification.
- Route.
- Documents.
- Chunks.
- Tool result.
- SQL result.
- Error.
- Warning.
- Boolean.
- Array.
- Memory update.
- Final answer.

### דוגמה — Classifier

```text
OUTPUT

Category
MEETING_SPECIFIC

Route
meeting_summary_agent

Confidence
94%
```

### דוגמה — Retrieval

```text
OUTPUT

12 chunks retrieved
4 source documents

Top Result
פרוטוקול ישיבה 18.06.2026
Score: 0.91
```

### דוגמה — Error

```text
OUTPUT

ERROR
Main Agent failed

Reason
Timeout after 30 seconds

Fallback
local_memory_answer
```

### דרישות

- Output שגוי או ריק יודגש.
- Output ארוך יוצג במצב מקוצר.
- מספר התווים הנוספים יוצג.
- ניתן לפתוח Modal או Drawer לתצוגה מלאה.
- קישורים למסמכים יהיו לחיצים.
- אובייקטים יוצגו בצורה היררכית.
- Arrays יוצגו כרשימה או טבלה בהתאם לתוכן.

---

## 7.5 Footer של הכרטיסייה

ה־Footer יציג מדדים תפעוליים:

- Duration.
- Input Tokens.
- Output Tokens.
- Total Tokens.
- Cost.
- Model Calls.
- Tool Calls.
- Cache status.
- Retry count.
- Start time.
- End time.
- Source count.
- Warning count.

### דוגמה

```text
86ms · 432 tokens · $0.001 · Cache miss
```

### מצב Compact

במצב Compact יוצגו רק:

- Duration.
- Cost.
- Tokens.
- Status.

---

## 8. מצבי תצוגה לכרטיסיות

## 8.1 Compact

מיועד להבנת הזרימה הכללית.

יוצגו:

- שם.
- סוג.
- סטטוס.
- Input מקוצר.
- Output מקוצר.
- זמן.
- עלות.

## 8.2 Expanded

ברירת המחדל למסך QA.

יוצגו:

- Input מפורט.
- Decision.
- Output מפורט.
- Metrics.
- שגיאות ואזהרות.

## 8.3 Raw Debug

יוצגו:

- Raw Input JSON.
- Raw Output JSON.
- Prompt.
- Model config.
- Headers.
- Tool Calls.
- Trace metadata.
- Internal IDs.
- Timestamps.

## 8.4 Focus Mode

לחיצה כפולה על Node תפתח אותו במרכז המסך ותעמעם את שאר ה־Workflow.

יוצגו גם:

- ה־Node הקודם.
- ה־Node הבא.
- ה־Payload הנכנס.
- ה־Payload היוצא.
- כל הלוגים הרלוונטיים.

---

## 9. חיבורים בין Nodes

החיבורים אינם רק קווים גרפיים. כל Edge מייצג מידע שעבר בפועל.

### מידע שיוצג על הקו

- סוג החיבור.
- שם ה־Port.
- Route.
- מספר פריטים.
- גודל Payload.
- Condition.
- האם החיבור הופעל.
- האם החיבור דולג.
- האם מדובר ב־Fallback.
- זמן מעבר.

### דוגמאות

```text
route: schedule_agent
```

```text
12 retrieved chunks
```

```text
fallback
```

```text
condition: confidence < 0.7
```

### צבעים

- ירוק — מסלול שהופעל בהצלחה.
- כחול — מסלול רגיל.
- כתום — Fallback או Warning.
- אדום — מסלול שנכשל.
- אפור מקווקו — מסלול שלא הופעל.
- סגול — Tool Call או Agent delegation.

### אינטראקציה

לחיצה על Edge תפתח Payload Inspector הכולל:

- Source Node.
- Target Node.
- Raw payload.
- Mapped payload.
- Fields removed.
- Fields added.
- Fields changed.
- Payload size.
- Timestamp.

---

## 10. סוגי Nodes ותצוגה ייעודית

## 10.1 Trigger Node

Input:

- User message.
- User metadata.
- Session.
- Project.
- Attachments.

Output:

- Normalized event object.

## 10.2 Sanitizer Node

Input:

- Original message.

Output:

- Cleaned message.
- Removed characters.
- Normalized fields.
- Security flags.

## 10.3 Save Message Node

Input:

- Message.
- Session.
- User.

Output:

- Record ID.
- Save status.
- Database latency.

## 10.4 Classifier Node

Input:

- Message.
- Context.
- Candidate categories.

Output:

- Category.
- Intent.
- Confidence.
- Route.
- Explanation summary, אם קיים Structured Output מפורש.

## 10.5 Knowledge Vocabulary Node

Input:

- Query.
- Domain.
- Existing terms.

Output:

- Normalized query.
- Added synonyms.
- Detected professional terms.
- Expanded search terms.

## 10.6 Memory Node

Input:

- Session history.
- Current message.

Output:

- Relevant memories.
- Updated memory.
- Memory record ID.
- Write status.

## 10.7 Retrieval Node

Input:

- Query.
- Filters.
- Project ID.
- Index.
- Top K.

Output:

- Chunks.
- Sources.
- Scores.
- Retrieval duration.
- Deduplication result.

## 10.8 Agent Node

Input:

- Prompt.
- Context.
- History.
- Tools.
- Model parameters.

Output:

- Text answer.
- Structured answer.
- Tool calls.
- Citations.
- Finish reason.

## 10.9 Tool Node

Input:

- Tool name.
- Arguments.

Output:

- Tool response.
- Error.
- Duration.
- Returned records.

## 10.10 Database Node

Input:

- Query.
- Parameters.

Output:

- Rows.
- Execution time.
- Database errors.
- Empty result warning.

## 10.11 Fallback Node

Input:

- Original request.
- Failure reason.
- Partial result.

Output:

- Fallback answer.
- Fallback source.
- Fallback quality flag.

## 10.12 Final Answer Node

Input:

- Agent output.
- Sources.
- Formatting rules.

Output:

- Final user answer.
- Citations.
- Validation status.
- Safety checks.
- Delivery status.

---

## 11. סטטוסים

כל Node יקבל סטטוס אחד ראשי:

```ts
type NodeStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "failed"
  | "skipped"
  | "cached"
  | "cancelled";
```

### משמעות

| Status | משמעות |
|---|---|
| pending | טרם הופעל |
| running | נמצא כרגע בריצה |
| success | הסתיים בהצלחה |
| warning | הסתיים עם חריגה או תוצאה חלקית |
| failed | נכשל |
| skipped | לא הופעל בגלל תנאי |
| cached | התוצאה התקבלה מה־Cache |
| cancelled | הריצה בוטלה |

---

## 12. שגיאות ואזהרות

### שגיאה

שגיאה חייבת להציג:

- Error type.
- Error message.
- Stack trace, במצב Raw.
- Node ID.
- Attempt number.
- Retry status.
- Fallback status.
- Timestamp.
- Related logs.

### אזהרה

דוגמאות:

- Confidence נמוך.
- Output ריק.
- מעט מקורות.
- Score נמוך.
- Timeout קרוב.
- Prompt גדול מדי.
- Context truncated.
- Missing field.
- Invalid JSON repaired.
- Fallback used.
- Cost חריג.
- זמן ריצה חריג.

### התנהגות

- Node עם שגיאה ייפתח אוטומטית.
- המסך יבצע Focus ל־Node הראשון שנכשל.
- שגיאות יוצגו גם בסרגל סיכום.
- לחיצה על שגיאה תנווט ל־Node.

---

## 13. השוואת ריצות

### מטרה

לאפשר לזהות באיזה שלב שתי ריצות התחילו להתנהג בצורה שונה.

### אופן הפעלה

1. המשתמש בוחר Run A.
2. המשתמש בוחר Run B.
3. לוחץ Compare.
4. כל Node מציג Diff.

### Diff בתוך Node

```text
Confidence
0.94 → 0.61

Route
meeting_summary_agent → fallback

Chunks
12 → 3

Duration
860ms → 4.2s
```

### סוגי שינוי

- Added.
- Removed.
- Changed.
- Unchanged.
- Missing in one run.
- Status changed.
- Cost regression.
- Performance regression.

### הדגשה

- ירוק — שיפור.
- אדום — הידרדרות.
- כתום — שינוי משמעותי.
- אפור — ללא שינוי.

### השוואת מבנה

אם Node קיים רק בריצה אחת:

```text
Only in Run B
```

אם Route שונה, המסלול החדש יודגש ב־Canvas.

---

## 14. חיפוש וסינון

### חיפוש

ניתן לחפש לפי:

- Node name.
- Node type.
- Input value.
- Output value.
- Error message.
- Route.
- Model.
- Tool.
- Source document.
- Run ID.

### פילטרים

- Errors only.
- Warnings only.
- Agents only.
- Tools only.
- Retrieval only.
- Database only.
- Slow nodes.
- Expensive nodes.
- Cache misses.
- Fallbacks.
- Nodes with empty output.
- Nodes with low confidence.

### ספים

המשתמש יוכל להגדיר:

- Slow node מעל X שניות.
- Expensive node מעל Y דולר.
- Low confidence מתחת ל־Z.
- Low retrieval score מתחת לערך מוגדר.
- Large prompt מעל מספר Tokens.

---

## 15. סרגל סיכום ריצה

במקום כרטיסי מדדים גדולים באמצע המסך, המדדים יוצגו בסרגל Sticky תחתון או עליון.

### נתונים

- Total duration.
- Total nodes.
- Successful nodes.
- Failed nodes.
- Warnings.
- Model calls.
- Tool calls.
- Input tokens.
- Output tokens.
- Total cost.
- Cache hits.
- Cache misses.
- Estimated cost saved.
- Final status.

### דוגמה

```text
4.8s | 11 Nodes | 1 Error | 2 Warnings | 23,454 In | 1,552 Out | $0.0044
```

---

## 16. Drawer לפרטים מלאים

למרות שהמידע העיקרי מופיע בכרטיסייה, מידע ארוך ייפתח ב־Drawer צדדי.

### Tabs

- Summary.
- Input.
- Output.
- Raw.
- Prompt.
- Tool Calls.
- Sources.
- Logs.
- Metrics.
- Compare.

### דרישות

- ה־Drawer אינו מחליף את הכרטיסייה.
- הכרטיסייה תמיד מציגה את התקציר הקריטי.
- ה־Drawer מיועד לפרטים ארוכים בלבד.
- פתיחת Drawer אינה מאבדת את מיקום ה־Canvas.

---

## 17. Live Execution Mode

כאשר ריצה פעילה כעת:

- Node נוכחי יקבל אנימציית Running.
- Edge פעיל יודגש.
- Input יוצג מיד כאשר הרכיב התחיל.
- Output יתווסף כאשר הרכיב הסתיים.
- Duration יתעדכן בזמן אמת.
- Logs ישויכו בזמן אמת ל־Node.
- Failed Node יעצור או יפעיל Fallback בהתאם לזרימה.

### אין להשתמש

- באנימציות מהבהבות.
- בצבעים חזקים מדי.
- בתזוזת Layout במהלך הריצה.

---

## 18. מודל נתונים מוצע

```ts
interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  userQuery?: string;
  projectId?: string;
  sessionId?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  modelCalls: number;
  toolCalls: number;
  cacheHits: number;
  cacheMisses: number;
  errors: RunIssue[];
  warnings: RunIssue[];
  nodes: NodeExecution[];
  edges: EdgeExecution[];
}
```

```ts
interface NodeExecution {
  id: string;
  nodeDefinitionId: string;
  displayName: string;
  technicalName: string;
  type: NodeType;
  status: NodeStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  attempt: number;
  retryCount: number;
  input: unknown;
  normalizedInput?: unknown;
  decision?: unknown;
  output?: unknown;
  rawOutput?: unknown;
  error?: ExecutionError;
  warnings?: RunIssue[];
  metrics: NodeMetrics;
  model?: ModelExecution;
  toolCalls?: ToolCallExecution[];
  sourceIds?: string[];
  position?: {
    x: number;
    y: number;
  };
}
```

```ts
interface EdgeExecution {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  status: "used" | "unused" | "failed" | "fallback";
  label?: string;
  condition?: string;
  payload?: unknown;
  mappedPayload?: unknown;
  payloadSizeBytes?: number;
  transferredAt?: string;
}
```

```ts
interface NodeMetrics {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  cacheStatus?: "hit" | "miss" | "none";
  modelCalls?: number;
  toolCalls?: number;
  recordsRead?: number;
  recordsWritten?: number;
  sourceCount?: number;
}
```

```ts
interface ExecutionError {
  code?: string;
  type: string;
  message: string;
  stack?: string;
  retryable?: boolean;
  fallbackUsed?: boolean;
  fallbackNodeId?: string;
}
```

---

## 19. הפרדה בין Workflow Definition ל־Workflow Execution

יש להפריד בין:

### Workflow Definition

המבנה הקבוע של התהליך:

- Nodes.
- Connections.
- Conditions.
- Positions.
- Names.
- Types.
- Configuration.

### Workflow Execution

המידע של ריצה מסוימת:

- Status.
- Input.
- Output.
- Duration.
- Cost.
- Error.
- Route used.
- Tool calls.
- Logs.

### יתרון

אותו Workflow יכול להציג ריצות שונות בלי לשכפל את הגדרת התרשים.

---

## 20. API מוצע

## 20.1 קבלת רשימת ריצות

```http
GET /api/workflows/:workflowId/runs
```

### פרמטרים

- status.
- dateFrom.
- dateTo.
- search.
- projectId.
- page.
- limit.

## 20.2 קבלת ריצה מלאה

```http
GET /api/workflow-runs/:runId
```

### Response

- Run metadata.
- Nodes.
- Edges.
- Issues.
- Metrics.
- Workflow version.

## 20.3 קבלת פרטי Node

```http
GET /api/workflow-runs/:runId/nodes/:nodeId
```

משמש לטעינה עצלה של מידע כבד.

## 20.4 קבלת Raw Payload של Edge

```http
GET /api/workflow-runs/:runId/edges/:edgeId/payload
```

## 20.5 השוואת ריצות

```http
GET /api/workflow-runs/compare?runA=:runA&runB=:runB
```

## 20.6 Live Events

```http
GET /api/workflow-runs/:runId/events
```

באמצעות:

- WebSocket.
- Server-Sent Events.

---

## 21. שמירת לוגים ו־Trace

כל אירוע חייב להיות מקושר ל־Run ול־Node.

### שדות חובה

- run_id.
- workflow_id.
- workflow_version.
- node_id.
- node_type.
- event_type.
- timestamp.
- status.
- input_snapshot.
- output_snapshot.
- duration_ms.
- token_usage.
- cost.
- model.
- tool.
- error.
- parent_node_id.
- trace_id.
- span_id.

### Trace Hierarchy

```text
Workflow Run
└── Main Agent
    ├── Classifier
    ├── Retrieval
    │   ├── Query Rewrite
    │   └── Vector Search
    └── Final Answer
```

---

## 22. מיפוי לוגים ל־Nodes

שורת לוג לעולם לא תישאר ללא שיוך.

### דוגמה

במקום:

```text
main_agent failed, using fallback
```

יש לשמור:

```json
{
  "run_id": "run_104",
  "node_id": "main_agent",
  "event_type": "node_failed",
  "message": "Main Agent failed, using fallback",
  "fallback_node_id": "local_memory"
}
```

### תוצאה בממשק

- Node של Main Agent מסומן באדום.
- Edge ל־Fallback מסומן בכתום.
- Fallback Node מסומן כ־Warning או Success with fallback.
- סיכום הריצה מסומן כ־Partial Success.

---

## 23. עקרונות עיצוב

### 23.1 סגנון

- נקי.
- טכני.
- מודרני.
- צפוף אך קריא.
- דומה לכלי Workflow מתקדמים.
- ללא עומס קישוטי.

### 23.2 כרטיסיות

- Border עדין.
- Shadow מינימלי.
- Radius בינוני.
- Header מובחן.
- חלוקה ברורה בין Input ל־Output.
- Padding עקבי.
- Monospace ל־JSON וקוד.
- Sans-serif לטקסט רגיל.

### 23.3 צבעים

הצבעים ישמשו למשמעות, לא לקישוט.

- Neutral background.
- Green success.
- Red error.
- Orange warning.
- Blue active/tool.
- Purple agent/model.
- Gray skipped/inactive.

### 23.4 נגישות

- אין להסתמך רק על צבע.
- כל סטטוס כולל אייקון וטקסט.
- Contrast תקין.
- תמיכה בניווט מקלדת.
- Tooltips לכל אייקון.
- Focus state ברור.

---

## 24. מידות מומלצות

### Node Compact

- רוחב: 280–340px.
- גובה: 160–240px.

### Node Expanded

- רוחב: 380–480px.
- גובה: דינמי, עד 620px לפני מעבר לגלילה פנימית.

### מגבלות

- אין לאפשר Node ברוחב בלתי מוגבל.
- אין לאפשר Output ארוך להגדיל את הכרטיסייה ללא סוף.
- גלילה פנימית תופעל רק לאחר גובה מקסימלי.
- Header ו־Footer נשארים Sticky בתוך Node גבוה.

---

## 25. ביצועים

### דרישות

- Canvas עם עד 100 Nodes חייב להישאר אינטראקטיבי.
- טעינת ריצה רגילה עד 2 שניות.
- שינוי Zoom חלק.
- אין לבצע Render מלא לכל ה־JSON בריצה.
- Raw data ייטען רק לפי דרישה.
- Nodes מחוץ ל־Viewport יכולים לעבור Virtualization.
- מידע ארוך ייטען Lazy.
- Logs כבדים ייטענו לפי Node.

### אופטימיזציות

- Memoization.
- Virtualized lists.
- Collapsed data by default.
- Debounced search.
- Indexed run storage.
- Separate summary payload from full payload.
- Payload compression.
- Pagination להיסטוריית ריצות.

---

## 26. אבטחה ופרטיות

- הסתרת API keys.
- הסתרת Authorization headers.
- הסתרת Tokens סודיים.
- אפשרות למסך שדות לפי רשימת Denylist.
- הרשאות צפייה ב־Raw data.
- Audit log לפתיחת מידע רגיש.
- מידע אישי יוצג בהתאם להרשאות המשתמש.
- Export יכבד את מדיניות ההסתרה.
- אין לשמור Prompt או Output רגיש ללא מדיניות Retention.

---

## 27. Export

ניתן יהיה לייצא:

- Run summary.
- Full run JSON.
- Node JSON.
- Error report.
- Comparison report.
- Screenshot של ה־Workflow.
- Markdown QA report.
- PDF, בשלב עתידי.

### Markdown QA Report

יכלול:

- שאלה.
- סטטוס.
- מסלול.
- Nodes.
- שגיאות.
- אזהרות.
- זמנים.
- Tokens.
- עלות.
- Sources.
- Final answer.

---

## 28. קיצורי מקלדת

| פעולה | קיצור |
|---|---|
| חיפוש | Ctrl/Cmd + F |
| Fit to screen | F |
| Zoom in | + |
| Zoom out | - |
| Reset zoom | 0 |
| Expand selected | Enter |
| Close drawer | Esc |
| Focus selected | Space |
| Next issue | N |
| Previous issue | Shift + N |
| Errors only | E |
| Compare | C |

---

## 29. User Stories

### US-01

כמשתמש QA, אני רוצה לראות בתוך כל Node מה נכנס ומה יצא, כדי לזהות תקלות בלי לעבור ללוג נפרד.

### US-02

כמפתח, אני רוצה ללחוץ על Edge ולראות את ה־Payload שעבר, כדי לוודא שהמיפוי בין הרכיבים תקין.

### US-03

כמנהל מוצר, אני רוצה לזהות במהירות Fallback, כדי להבין מדוע המשתמש קיבל תשובה חלופית.

### US-04

כמשתמש QA, אני רוצה להשוות בין שתי ריצות, כדי לראות באיזה Node התחיל שינוי ההתנהגות.

### US-05

כמפתח, אני רוצה לראות Tokens, Cost ו־Duration לכל Node, כדי לזהות רכיבים איטיים או יקרים.

### US-06

כמשתמש, אני רוצה לסנן Errors only, כדי להגיע מיד ל־Nodes הבעייתיים.

### US-07

כמשתמש QA, אני רוצה לראות את המקורות שהוחזרו ב־Retrieval Node, כדי לבדוק איכות שליפה.

### US-08

כמפתח, אני רוצה לפתוח Raw JSON רק בעת הצורך, כדי לשמור על ממשק נקי.

---

## 30. קריטריוני קבלה

## 30.1 Node Card

- [ ] כל Node מציג שם, סוג וסטטוס.
- [ ] כל Node מציג Input.
- [ ] כל Node מציג Output.
- [ ] כל Node מציג Duration.
- [ ] רכיבי LLM מציגים Tokens ועלות.
- [ ] Output ארוך מתקצר בצורה מבוקרת.
- [ ] ניתן לפתוח תצוגה מלאה.
- [ ] ניתן להעתיק Input ו־Output.
- [ ] ניתן לפתוח Raw JSON.
- [ ] שגיאה מוצגת בתוך ה־Node.

## 30.2 Canvas

- [ ] ניתן לבצע Pan.
- [ ] ניתן לבצע Zoom.
- [ ] קיים Fit to screen.
- [ ] קיים Auto layout.
- [ ] ה־Canvas שומר מיקום.
- [ ] המסלול הפעיל מודגש.
- [ ] מסלולים שלא הופעלו מוצגים באפור.
- [ ] Fallback מוצג בצבע שונה.

## 30.3 Edges

- [ ] Edge מציג Label.
- [ ] ניתן ללחוץ על Edge.
- [ ] ניתן לראות Payload.
- [ ] ניתן לראות שינויי Mapping.
- [ ] Edge מציג אם הופעל או דולג.

## 30.4 Runs

- [ ] ניתן לבחור ריצה.
- [ ] רשימת הריצות מציגה סטטוס.
- [ ] ניתן לחפש ריצה.
- [ ] ניתן לסנן ריצות.
- [ ] ניתן לבחור שתי ריצות להשוואה.

## 30.5 Errors

- [ ] Node שנכשל מסומן.
- [ ] מוצגת סיבת השגיאה.
- [ ] מוצג Retry.
- [ ] מוצג Fallback.
- [ ] לחיצה על Error מעבירה ל־Node.
- [ ] הריצה מסומנת Partial Success כאשר הופעל Fallback.

## 30.6 Performance

- [ ] ריצה רגילה נטענת בתוך 2 שניות.
- [ ] Zoom ו־Pan נשארים חלקים.
- [ ] Raw data נטען Lazy.
- [ ] אין Render מלא למידע שאינו גלוי.

---

## 31. שלבי פיתוח מומלצים

## שלב 1 — MVP

מטרת השלב: להפוך כל Node לכרטיסיית Input / Output.

כולל:

- Node cards.
- Header.
- Input preview.
- Output preview.
- Status.
- Duration.
- Tokens.
- Cost.
- Expand / Collapse.
- Error display.
- Fit to screen.
- בחירת ריצה.

לא כולל:

- Compare.
- Live mode.
- Edge payload diff.
- Export מתקדם.

## שלב 2 — QA Inspector

כולל:

- Drawer.
- Raw JSON.
- Search.
- Filters.
- Edge payload.
- Errors only.
- Slow / Expensive nodes.
- Logs per Node.
- Source rendering.
- Fallback visualization.

## שלב 3 — Compare Runs

כולל:

- בחירת שתי ריצות.
- Node diff.
- Payload diff.
- Route diff.
- Performance diff.
- Regression indicators.

## שלב 4 — Live Trace

כולל:

- Live Node states.
- Streaming logs.
- Real-time metrics.
- Running edge animation.
- Stop run.
- Re-run from Node, אם הארכיטקטורה מאפשרת.

---

## 32. רכיבי Frontend מוצעים

```text
WorkflowInspectorPage
├── WorkflowToolbar
├── RunHistoryPanel
├── WorkflowCanvas
│   ├── WorkflowNodeCard
│   │   ├── NodeHeader
│   │   ├── NodeInputSection
│   │   ├── NodeDecisionSection
│   │   ├── NodeOutputSection
│   │   └── NodeMetricsFooter
│   ├── WorkflowEdge
│   ├── CanvasControls
│   └── MiniMap
├── RunSummaryBar
├── NodeDetailsDrawer
├── EdgePayloadDrawer
├── CompareRunsPanel
└── IssueNavigator
```

---

## 33. טכנולוגיה אפשרית

אם המסך הקיים מבוסס React:

- React Flow או ספריית Canvas מקבילה.
- Zustand או Redux לניהול State.
- TanStack Query לטעינת ריצות.
- Monaco Editor או JSON Viewer ל־Raw JSON.
- SSE או WebSocket ל־Live Execution.
- Virtualization לרשימות ולוגים.

### הערה

הבחירה ב־React Flow אינה חובה, אך היא מתאימה במיוחד ל:

- Custom Nodes.
- Custom Edges.
- Zoom.
- Pan.
- Handles.
- Auto layout.
- Mini map.
- Interaction events.

---

## 34. החלטות מוצר מומלצות

### ברירת מחדל

- מצב Expanded.
- הצגת Input ו־Output מקוצרים.
- הצגת Metrics בסיסיים.
- הסתרת Raw JSON.
- הצגת המסלול שהופעל בלבד בצורה מודגשת.
- מסלולים שלא הופעלו נשארים גלויים אך עמומים.

### כאשר קיימת שגיאה

- Focus ל־Node הראשון שנכשל.
- פתיחת אזור Output.
- הצגת Error.
- הדגשת Edge נכנס ויוצא.
- הצגת Fallback, אם הופעל.

### כאשר Output ארוך

- להציג Preview.
- להציג סוג תוכן.
- להציג מספר תווים.
- לאפשר Expand.
- לא להגדיל את כל ה־Workflow.

---

## 35. דברים שאין לעשות

- אין להציג את כל ה־JSON בכל Node כברירת מחדל.
- אין להשתמש בצבע שונה לכל Node ללא משמעות.
- אין להזיז Nodes אוטומטית במהלך ריצה.
- אין להסתיר מסלולים שלא הופעלו לחלוטין.
- אין להציג שגיאה רק בלוג כללי.
- אין לנתק בין לוג לבין Node.
- אין לאפשר Output ארוך להרחיב את הכרטיסייה ללא הגבלה.
- אין להסתמך רק על Hover למידע קריטי.
- אין להציג מידע רגיש ללא Masking.
- אין להציג Chain of Thought פנימי.

---

## 36. תוצאה צפויה

לאחר השדרוג, המשתמש יוכל לפתוח ריצה ולענות בתוך שניות על השאלות הבאות:

- מה הייתה בקשת המשתמש?
- כיצד הבקשה נוקתה או שונתה?
- איזה סיווג התקבל?
- לאיזה Agent הבקשה נותבה?
- איזה Context נשלף?
- אילו מסמכים נמצאו?
- מה נשלח למודל?
- מה המודל החזיר?
- האם הופעל Tool?
- האם הייתה שגיאה?
- האם הופעל Fallback?
- איפה בדיוק השתנתה התוצאה?
- כמה זמן וכסף צרך כל שלב?
- מדוע התשובה הסופית יצאה כפי שיצאה?

הממשק החדש יהפוך את תרשים ה־Workflow מכלי תצוגה פסיבי לכלי QA, Debug ו־Observability מלא.

---

## 37. הגדרת הצלחה

הפיצ'ר ייחשב מוצלח כאשר:

- ניתן לאבחן את רוב תקלות הריצה מתוך ה־Canvas בלבד.
- זמן איתור מקור תקלה מתקצר משמעותית.
- אין צורך לעבור ידנית בין הגרף ללוגים לצורך בדיקה רגילה.
- כל שגיאה ממופה ל־Node.
- כל מעבר מידע ממופה ל־Edge.
- המשתמש יכול להבין את הריצה מתחילתה ועד סופה במבט אחד.
