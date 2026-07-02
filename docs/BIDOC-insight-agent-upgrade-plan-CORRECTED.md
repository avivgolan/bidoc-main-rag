# BIDOC – תוכנית שדרוג סוכן התובנות ובדיקת פערים מול הקוד הקיים

## מטרת המסמך

מסמך זה מגדיר את הארכיטקטורה הרצויה עבור **סוכן התובנות של BIDOC**.

המטרה היא לעבור ממנגנון שמחזיר בעיקר ממצאים, תוצאות חיפוש וסיכומי מסמכים — למנגנון שמפיק **תובנות ניהוליות מבוססות ראיות**, באמצעות חיבור בין מספר מקורות, בניית ציר זמן, זיהוי דפוסים והערכת המשמעות לפרויקט.

יש להשתמש במסמך זה כדי:

1. לבדוק מה כבר קיים בקוד.
2. לזהות פערים בין המימוש בפועל לבין הארכיטקטורה הרצויה.
3. לזהות רכיבים קיימים שניתן למחזר.
4. להציע תוכנית יישום הדרגתית.
5. להימנע משכתוב מיותר של חלקים שכבר עובדים.

---

# הוראות לקודקס

בצע בדיקה מלאה של הקוד הקיים מול התוכנית במסמך זה.

## שלב ראשון – מחקר בלבד

בשלב הראשון:

- אל תשנה קוד.
- אל תיצור קבצי מימוש חדשים.
- אל תמחק רכיבים קיימים.
- אל תניח שרכיב חסר לפני שחיפשת אותו בכל הפרויקט.
- בדוק גם קוד, פרומפטים, schemas, migrations, services, workers, agents, tests ו־configuration.
- חפש רכיבים בעלי שמות שונים שמבצעים בפועל את אותה פונקציה.
- עקוב אחר ה־flow המלא מהבקשה של המשתמש ועד לתשובה הסופית.
- זהה היכן מתבצע כל שלב: retrieval, filtering, clustering, reasoning, ranking ו־formatting.

## תוצר הבדיקה הנדרש

צור קובץ בשם:

```text
insight-agent-gap-analysis.md
```

הקובץ חייב לכלול:

1. סיכום הארכיטקטורה הקיימת.
2. מפת הזרימה הקיימת מקצה לקצה.
3. טבלה המשווה בין כל דרישה במסמך לבין המימוש בפועל.
4. ציון לכל רכיב:
   - קיים וממומש
   - קיים חלקית
   - קיים אך לא מחובר לזרימה
   - לא קיים
   - לא ניתן לקבוע
5. הפניות מדויקות לקבצים, פונקציות, מחלקות ושורות רלוונטיות.
6. סיכונים ובעיות במימוש הנוכחי.
7. רכיבים שניתן למחזר.
8. כפילויות או לוגיקה מתחרה.
9. תוכנית יישום לפי סדר עדיפויות.
10. רשימת שאלות פתוחות רק כאשר לא ניתן להסיק את התשובה מהקוד.

## פורמט טבלת ההשוואה

| רכיב רצוי | מצב בקוד | מיקום בקוד | מה קיים בפועל | הפער | פעולה מומלצת |
|---|---|---|---|---|---|
| Evidence Collector | קיים חלקית | `path/to/file` | תיאור | תיאור | תיאור |

## דרישת אמינות

כל קביעה לגבי הקוד חייבת לכלול הפניה לקובץ או לרכיב שמוכיח אותה.

אין לכתוב:

> נראה שיש...

ללא הוכחה מהקוד.

כאשר לא נמצאה הוכחה מספקת, יש לכתוב:

> לא נמצאה הוכחה במקומות שנבדקו.

---

# 1. הבעיה הנוכחית

כיום סוכן התובנות משתמש בעיקר ב:

- חיפוש לפי האשטגים.
- חיפוש כללי או סמנטי באינדקס.
- העברת הממצאים למודל.
- ניסוח תשובה על בסיס תוצאות החיפוש.

התוצאה היא שבמקרים רבים מתקבלת רשימה של:

- אירועים.
- עדכונים.
- משימות.
- התחייבויות.
- אזכורים חוזרים.
- ציטוטים ממסמכים.
- סיכומים של תוצאות חיפוש.

אלו הם **ממצאים**, אך לא בהכרח **תובנות**.

---

# 2. ההבחנה בין ממצא לתובנה

## ממצא

מידע ישיר שהופיע במקור אחד.

דוגמה:

> בישיבה מ־12.6 הקבלן התחייב לסיים את מחיצות קומה 4 עד 18.6.

## ממצא נוסף

> בדוח הפיקוח מ־22.6 המחיצות עדיין בביצוע.

## תובנה

> ההתחייבות להשלמת מחיצות קומה 4 לא קוימה, והעבודה נותרה פתוחה גם לאחר המועד שנקבע. יש לבדוק את השפעת העיכוב על כניסת קבלני המערכות והגמר ולקבל מועד השלמה מעודכן.

## נוסחת התובנה

```text
INSIGHT =
EVIDENCE
+ CONNECTION
+ PROJECT IMPLICATION
+ REQUIRED ATTENTION
```

בעברית:

```text
תובנה =
ראיות
+ הקשר בין הראיות
+ משמעות לפרויקט
+ פעולה או תשומת לב נדרשת
```

---

# 3. עקרונות יסוד

## 3.1 החיפוש אינו מייצר תובנות

מנועי החיפוש צריכים לאתר את חומר הגלם בלבד.

תפקידם:

- למצוא מסמכים.
- למצוא רשומות.
- למצוא ישויות.
- למצוא אירועים.
- למצוא עדכונים קשורים.
- למצוא קשרים בגרף.
- למצוא נתוני לו״ז, החלטות והתחייבויות.

תפקידם אינו להחליט לבדם מהי התובנה.

## 3.2 אין להעביר רשימה שטוחה של תוצאות ישירות למודל

לפני יצירת התובנה נדרשים:

1. נרמול.
2. סינון.
3. הסרת כפילויות.
4. קיבוץ לפי נושא וישויות.
5. בניית ציר זמן.
6. זיהוי קשרים.
7. יצירת תובנות מועמדות.
8. ביקורת ודירוג.

## 3.3 לא כל אשכול ראיות חייב להפיק תובנה

כאשר אין משמעות ניהולית חדשה, אין להציג את התוכן כתובנה.

עדיף להחזיר שלוש תובנות חזקות מאשר עשר תובנות חלשות.

---

# 4. הארכיטקטורה הרצויה

```text
User Request
     │
     ▼
Query Understanding
     │
     ▼
Retrieval Planning
     │
     ├── Hashtag Search
     ├── Vector / Semantic Search
     ├── Keyword / Full-text Search
     ├── SQL / Structured Data Search
     ├── Timeline / Schedule Search
     └── Graph Search
             │
             ▼
      Evidence Collector
             │
             ▼
      Evidence Normalizer
             │
             ▼
       Deduplication
             │
             ▼
 Topic + Entity Clustering
             │
             ▼
       Timeline Builder
             │
             ▼
       Analytics Engine
             │
             ├── Snapshot Metrics
             ├── Trend Analyzer
             ├── Recurrence Analyzer
             ├── Dependency Statistics
             └── Data Quality & Coverage
             │
             ▼
 Pattern / Relationship Detection
             │
             ▼
 Root Cause Hypothesis Engine
             │
             ▼
      Insight Synthesizer
             │
             ▼
        Insight Critic
             │
             ▼
      Ranking + Filtering
             │
             ▼
      Top Management Insights

Analytics Engine ───────────────► Executive Health Score
Pattern Detection ──────────────► Executive Health Score

Historical Pattern Store ───────► Cross Project Learning
                                   (future, indicator only)
```

## עקרונות ארכיטקטוניים

- `Analytics Engine` מבצע חישובים דטרמיניסטיים בלבד ואינו מייצר תובנות טקסטואליות.
- `Trend Analyzer` הוא תת־רכיב של `Analytics Engine`, ולא מנוע מקביל שמחשב שוב את אותם מדדים.
- `Root Cause Hypothesis Engine` מייצר השערות סיבתיות בלבד, עם ראיות, ראיות נגד, מידע חסר ורמת ודאות.
- `Executive Health Score` הוא פלט מחושב ושקוף. הוא אינו מסקנה של LLM ואינו מחליף תובנות ניהוליות.
- `Cross Project Learning` הוא שכבה עתידית לזיהוי דמיון בלבד. מידע מפרויקט אחר אינו ראיה לפרויקט הנוכחי.
- כל רכיב חייב לשמר `source lineage`, חלון זמן, גרסת נוסחה ורמת כיסוי נתונים.

# 5. רכיבי המערכת

## 5.1 Query Understanding

הרכיב מנתח את בקשת המשתמש ומגדיר:

- נושא.
- טווח זמן.
- סוגי סיכונים רלוונטיים.
- ישויות מרכזיות.
- אזורים בפרויקט.
- קבלנים או ספקים.
- האם נדרש חיפוש רחב או ממוקד.
- האם נדרש מידע היסטורי להשוואה.
- האם השאלה דורשת תובנות, ממצאים, סיכום או חיפוש ישיר.

### דרישות

- לזהות שאלת תובנות במפורש.
- לא להשתמש באותה אסטרטגיית retrieval לכל שאלה.
- להפריד בין:
  - שאלה עובדתית.
  - בקשת חיפוש.
  - בקשת סיכום.
  - בקשת תובנות.
  - בקשת סיכונים.
  - בקשת השוואה לאורך זמן.

---

## 5.2 Retrieval Planner

מטרתו להחליט אילו מנגנוני חיפוש להפעיל.

### מקורות אפשריים

- Hashtag index.
- Vector index.
- Full-text index.
- SQL tables.
- Documents.
- Emails.
- Meeting summaries.
- Supervision reports.
- Schedule rows.
- Alerts.
- Graph database.
- Tool results.

### דרישות

- לא להסתמך רק על האשטגים.
- להרחיב חיפוש לפי ישויות וקשרים.
- לבצע חיפושי המשך כאשר נמצא נושא משמעותי.
- לחפש גם מידע קודם וגם מידע מאוחר יותר.
- לחפש סימני סגירה או שינוי סטטוס.
- לשלב structured retrieval עם semantic retrieval.

---

## 5.3 Evidence Collector

הרכיב מרכז את כל התוצאות למבנה אחיד.

### מבנה מוצע

```json
{
  "evidence_id": "unique-id",
  "source_id": "source-record-id",
  "source_type": "meeting | email | report | schedule | alert | document",
  "document_id": "document-id",
  "document_name": "filename.pdf",
  "page": 12,
  "webview_link": "https://...",
  "event_date": "2026-06-12",
  "document_date": "2026-06-13",
  "subject": "מחיצות קומה 4",
  "location": "קומה 4",
  "entities": [
    {
      "type": "contractor",
      "name": "קבלן גבס"
    }
  ],
  "evidence_type": "commitment",
  "status": "open",
  "text": "הקבלן התחייב לסיים עד 18.6",
  "expected_date": "2026-06-18",
  "confidence": 0.92,
  "retrieval_method": [
    "hashtag",
    "vector"
  ]
}
```

### דרישות

- שמירה על מזהי מקור.
- שמירה על תאריך האירוע בנפרד מתאריך המסמך.
- שמירה על סוג הראיה.
- שמירה על סטטוס.
- שמירה על קישורים, שם קובץ ומספר עמוד.
- מניעת אובדן metadata במהלך המעבר בין השלבים.

---

## 5.4 Evidence Normalizer

הרכיב ממיר תוצאות ממקורות שונים לסכמה אחידה.

### עליו לזהות

- נושא.
- מיקום בפרויקט.
- גורם אחראי.
- תאריך אירוע.
- תאריך דיווח.
- מועד התחייבות.
- מועד יעד.
- סטטוס.
- סוג מקור.
- סוג אמירה.

### סוגי אמירה

- `confirmed_fact`
- `reported_claim`
- `commitment`
- `request`
- `decision`
- `warning`
- `estimate`
- `question`
- `status_update`
- `closure`
- `contradiction`

### כלל חשוב

אין להתייחס אל:

- התחייבות כאילו הושלמה.
- בקשה כאילו אושרה.
- הערכה כאילו היא עובדה.
- דיווח בודד כאילו הוא אמת מוחלטת.
- היעדר אזכור כהוכחה לסגירה.

---

## 5.5 Deduplication

אותו אירוע עשוי להופיע במספר מקומות:

- בפרוטוקול ישיבה.
- בסיכום ישיבה.
- במייל המשך.
- בדוח פיקוח.
- בהתראה שנוצרה מאותו מסמך.
- בגרסה מעודכנת של מסמך.

### דרישות

- לזהות duplicate records.
- לזהות near-duplicates.
- לזהות מקורות נגזרים מאותו מקור.
- לא לספור סיכום של מסמך כאישור עצמאי למסמך עצמו.
- לשמר את כל ההפניות למקורות גם כאשר הרשומות ממוזגות.
- להבחין בין כפילות לבין אישור ממקור בלתי תלוי.

### מבנה מוצע לאחר מיזוג

```json
{
  "canonical_event_id": "event-123",
  "canonical_text": "הקבלן התחייב לסיים את המחיצות עד 18.6",
  "source_records": [
    "meeting-123",
    "summary-123",
    "alert-456"
  ],
  "independent_source_count": 1
}
```

---

## 5.6 Topic and Entity Clustering

יש לקבץ ממצאים לפי האירוע או הנושא האמיתי, ולא רק לפי דמיון טקסטואלי.

### בסיסי קיבוץ

- נושא.
- פעילות.
- אזור.
- קומה.
- קבלן.
- ספק.
- מסמך.
- החלטה.
- התחייבות.
- ליקוי.
- סיכון.
- תלות.
- אבן דרך.
- פריט תקציבי.

### דוגמה למבנה אשכול

```json
{
  "cluster_id": "partitions-floor-4",
  "topic": "מחיצות קומה 4",
  "locations": ["קומה 4"],
  "entities": ["קבלן גבס", "מנהל הפרויקט"],
  "related_activities": ["מערכות", "גמרים"],
  "evidence_ids": [
    "evidence-1",
    "evidence-2"
  ]
}
```

### דרישות

- אותו נושא עם ניסוחים שונים צריך להיכנס לאותו אשכול.
- נושאים דומים אך נפרדים צריכים להישאר מופרדים.
- להשתמש בקשרים מהגרף כאשר הם קיימים.
- לא להסתמך על embedding similarity בלבד.
- לשלב מזהים, ישויות, מיקום, תאריכים והקשרים.

---

## 5.7 Timeline Builder

בתוך כל אשכול יש לבנות ציר זמן.

### מטרות

- לזהות מה קרה קודם ומה קרה אחר כך.
- לזהות התחייבות ולאחריה אי־עמידה.
- לזהות שינוי סטטוס.
- לזהות הידרדרות.
- לזהות סגירה.
- לזהות מידע סותר.
- לזהות נושא שלא השתנה לאורך זמן.

### מבנה מוצע

```json
{
  "cluster_id": "partitions-floor-4",
  "timeline": [
    {
      "date": "2026-06-12",
      "type": "commitment",
      "text": "הקבלן התחייב לסיים עד 18.6",
      "evidence_id": "evidence-1"
    },
    {
      "date": "2026-06-22",
      "type": "status_update",
      "text": "המחיצות עדיין בביצוע",
      "evidence_id": "evidence-2"
    }
  ],
  "latest_known_status": "open"
}
```

### כלל קדימות

כאשר קיים עדכון מאוחר יותר, אסור להציג סטטוס ישן כאילו הוא הסטטוס הנוכחי.

---


## 5.8 Analytics Engine

הרכיב מקבל ראיות מנורמלות, אירועים קנוניים, אשכולות וצירי זמן ומחשב מדדים דטרמיניסטיים.

הוא אינו מפעיל LLM ואינו מנסח תובנות.

תחומי האחריות:

- מדדי מצב נוכחי.
- מדדי זמן ומשך.
- ניתוח מגמות.
- מדדי הישנות.
- סטטיסטיקות תלויות.
- איכות וכיסוי נתונים.
- הכנת קלט מובנה ל־Pattern Detection ול־Executive Health Score.

המפרט המלא מופיע בסעיף 25.

## 5.9 Root Cause Hypothesis Engine

הרכיב מנסה לזהות הסברים סיבתיים אפשריים לאחר שנמצא דפוס משמעותי.

הוא אינו קובע סיבת שורש כעובדה.

כל השערה חייבת לכלול:

- ראיות תומכות.
- ראיות נגד, כאשר קיימות.
- מידע חסר.
- רמת ודאות.
- סימון `requires_validation`.
- ניסוח מפורש כ־Inference.

המפרט המלא מופיע בסעיף 26.

## 5.10 Trend Analyzer

`Trend Analyzer` הוא תת־רכיב של `Analytics Engine`.

אין ליצור עבורו pipeline מקביל או schema מתחרה, אלא אם ה־Gap Analysis מוכיח שקיימת הצדקה טכנית ברורה להפרדה.

המפרט המלא מופיע בסעיף 27.

## 5.11 Executive Health Score

הרכיב מחשב ציון בריאות שקוף, מוסבר ובר־השוואה על בסיס מדדים מחושבים.

הוא חייב לכלול:

- ציוני משנה.
- גרסת נוסחה.
- חלון זמן.
- כיסוי נתונים.
- טיפול מפורש בנתונים חסרים.
- דגלים קריטיים שאינם נבלעים בממוצע.
- הסבר לשינוי ביחס לתקופה קודמת.

המפרט המלא מופיע בסעיף 28.

## 5.12 Cross Project Learning

שכבה עתידית שמזהה דפוסים דומים בפרויקטים קודמים.

היא אינה מעבירה ראיות בין פרויקטים ואינה משתמשת במידע היסטורי כהוכחה למצב בפרויקט הנוכחי.

המפרט המלא מופיע בסעיף 29.

# 6. מנגנון זיהוי דפוסים

על המערכת לחפש דפוסים מוגדרים, ולא להסתמך רק על שאלה כללית למודל.

## 6.1 התחייבות שלא קוימה

### תנאים

- קיימת התחייבות או מועד יעד.
- קיים עדכון מאוחר יותר.
- העדכון מראה שהפעולה לא הושלמה, נדחתה או עדיין פתוחה.

### תוצאה

תובנה אפשרית של אי־עמידה בהתחייבות.

---

## 6.2 הידרדרות סטטוס

### תנאים

- קיים סטטוס מוקדם.
- קיים סטטוס מאוחר.
- הסטטוס המאוחר גרוע יותר.

### דוגמאות

- תקין → בסיכון.
- בביצוע → נעצר.
- צפוי בזמן → צפוי באיחור.
- חסר חלקית → חסר במלואו.

---

## 6.3 נושא פתוח שחוזר לאורך זמן

### תנאים

- אותו נושא מופיע במספר תאריכים.
- אין ראיית סגירה אמינה.
- הנושא עדיין רלוונטי לפי העדכון האחרון.

---

## 6.4 סטייה מלוח זמנים

### תנאים אפשריים

- actual מול baseline.
- forecast מול milestone.
- committed date מול completion date.
- דיווח סטטוס מול התאריך המתוכנן.

### כלל

אין לקבוע שיש איחור ללא נקודת השוואה ברורה.

---

## 6.5 סיכון תלות

### תנאים

- פעילות או אישור אחד קשורים לפעילות אחרת.
- הנושא הראשון עדיין פתוח.
- הקשר בין הפעילויות קיים בראיות או בגרף.

### כלל

כאשר התלות אינה מוכחת, יש לנסח:

> נדרש לבדוק האם העיכוב משפיע על...

ולא:

> העיכוב חוסם את...

---

## 6.6 סתירה בין מקורות

### דוגמאות

- מקור אחד מדווח שהעבודה הושלמה.
- מקור אחר מדווח שהיא עדיין פתוחה.
- מופיעים תאריכי יעד שונים.
- קיימת מחלוקת לגבי אחראי.
- קיימות כמויות שונות.

### דרישות

- להציג את הסתירה.
- לא לבחור גרסה ללא בסיס.
- לסמן את התובנה כ־`דורש אימות` או `מידע סותר`.

---

## 6.7 אישור ממספר מקורות

כאשר מקורות עצמאיים שונים מצביעים על אותו סיכון:

- יש להעלות את רמת הוודאות.
- יש לשמור הפניה לכל מקור.
- יש לוודא שלא מדובר במסמך וסיכום שנגזר ממנו.

---

## 6.8 החלטה חסרה

### סימנים

- מחכים לאישור.
- מחכים לתכנון.
- מחכים לתשובה.
- אין גורם אחראי.
- לא התקבלה הכרעה.
- הפעילות אינה יכולה להתקדם.

---

## 6.9 כשל תפעולי חוזר

### דוגמאות

- מחסור בכוח אדם במספר שבועות.
- חוסר במסמכים בכמה תחומים.
- התחייבויות חוזרות שלא מבוצעות.
- אי־דיווח יומי חוזר.
- ליקויי בטיחות מסוג דומה במספר אזורים.

---

## 6.10 סיכון מתהווה

מספר ממצאים חלשים עשויים יחד ליצור סיכון משמעותי.

### דוגמה

- ירידה בכוח אדם.
- האטה בתפוקה.
- מספר פעילויות קריטיות פתוחות.
- מועד אבן דרך מתקרב.

כל ממצא בנפרד אינו בהכרח תובנה, אך החיבור ביניהם עשוי להיות תובנה.

---

## 6.11 ראיית סגירה

כאשר קיים מקור מאוחר ואמין שמוכיח שהנושא נפתר:

- יש לעדכן את הסטטוס ל־`נפתר`.
- אין להמשיך להציג את הנושא כסיכון פעיל.
- ניתן להציג תובנת סגירה רק אם היא רלוונטית לבקשה.

---

# 7. Insight Synthesizer

תפקיד הרכיב הוא ליצור תובנות מועמדות מתוך אשכולות הראיות.

## דרישות לתובנה תקינה

כל תובנה צריכה לענות על:

1. מה קרה או השתנה?
2. אילו ראיות תומכות בכך?
3. מה הקשר בין הראיות?
4. למה זה חשוב לפרויקט?
5. מה נדרש לבדוק, להחליט או לבצע?

## כלל מינימום

מומלץ שתובנה תתבסס על לפחות שתי ראיות מחוברות.

אפשר לאפשר תובנה ממקור יחיד רק כאשר מדובר ב:

- אירוע בטיחות משמעותי.
- סטייה מפורשת בלוח זמנים.
- חריגה תקציבית מפורשת.
- החלטה רשמית.
- עצירת עבודה.
- סיכון מפורש ממקור סמכותי.
- אירוע חד־משמעי ובעל משמעות ניהולית.

---

# 8. Insight Critic

סוכן או רכיב ביקורת נפרד צריך לבדוק כל תובנה מועמדת.

## בדיקות חובה

- האם זו באמת תובנה או רק סיכום?
- האם קיימת ראיה מזוהה?
- האם חוברו מספר ממצאים?
- האם הסטטוס האחרון נלקח בחשבון?
- האם יש כפילות עם תובנה אחרת?
- האם המשמעות הניהולית מוצדקת?
- האם הומצא קשר סיבתי?
- האם התובנה עדיין פעילה?
- האם רמת הוודאות מתאימה?
- האם ההמלצה נובעת מהראיות?
- האם ניתן לקצר בלי לאבד משמעות?

## סיבות לפסילה

- פרפרזה של תוצאת חיפוש.
- מקור לא מזוהה.
- inference שמוצג כעובדה.
- מידע ישן שהוחלף בעדכון חדש.
- אין משמעות ניהולית.
- אין פעולה או תשומת לב נדרשת.
- כפילות.
- נושא שכבר נסגר.
- מסקנה חזקה מדי ביחס לראיות.

---

# 9. Ranking and Filtering

לאחר הביקורת יש לדרג את התובנות.

## מדדי דירוג מוצעים

- חומרה.
- דחיפות.
- חוזק הראיות.
- מספר מקורות עצמאיים.
- משך הזמן שהנושא פתוח.
- הישנות.
- השפעה על לוח זמנים.
- השפעה בטיחותית.
- השפעה תקציבית.
- השפעה על איכות.
- מספר פעילויות מושפעות.
- קרבה לאבן דרך.
- צורך בהחלטת הנהלה.

## מודל ניקוד אפשרי

```text
insight_score =
severity_weight
+ urgency_weight
+ evidence_strength
+ recurrence_weight
+ schedule_impact
+ safety_impact
+ financial_impact
+ management_attention
- uncertainty_penalty
- duplication_penalty
- stale_information_penalty
```

אין חובה להשתמש בנוסחה קשיחה, אך חייב להיות מנגנון דירוג ברור ועקבי.

## מגבלת תוצאות

ברירת מחדל:

```text
3–5 תובנות חזקות
```

אין להוסיף תובנות חלשות רק כדי להגיע לכמות קבועה.

---

# 10. מבנה הפלט הרצוי

```markdown
## [כותרת תובנה ניהולית קצרה]

**התובנה:**  
הסבר קצר שמחבר בין הראיות ומציג את המסקנה.

**הראיות:**  
- מקור, תאריך, אירוע ופרט רלוונטי.
- מקור נוסף, תאריך והעדכון המאוחר יותר.

**המשמעות לפרויקט:**  
ההשפעה האפשרית על לוח זמנים, איכות, בטיחות, עלות, תיאום או התחייבויות.

**פעולה מומלצת:**  
בדיקה, החלטה, הסלמה, מעקב או הקצאת אחריות.

**רמת ודאות:** גבוהה / בינונית / נמוכה

**סטטוס:** פעיל / דורש אימות / נפתר / מידע סותר

**מקורות:**  
שם קובץ, מזהה רשומה, עמוד וקישור WebView כאשר קיימים.
```

---

# 11. הפרדה בין עובדה, הסקה והשפעה אפשרית

## Confirmed

מידע שנכתב במפורש בראיות.

## Inferred

מסקנה לוגית שנוצרה מחיבור בין ראיות.

## Potential Impact

השפעה סבירה אך לא מוכחת.

### ניסוחים מומלצים

- `הראיות מצביעות על...`
- `נמצא פער בין...`
- `לא נמצאה ראיה לכך שהנושא נסגר.`
- `קיים חשש כי...`
- `הדבר עשוי להשפיע על...`
- `נדרש לבדוק האם...`
- `המקורות מציגים מידע סותר לגבי...`

### ניסוחים אסורים ללא הוכחה

- `העיכוב גרם ל...`
- `הפעילות חסומה בגלל...`
- `הקבלן אחראי ל...`
- `הנושא נפתר...`
- `קיימת חריגה...`

אלא אם הדבר מופיע בראיות או נגזר מחישוב מוסמך.

---

# 12. כלל אין־תובנה

כאשר נמצאו ממצאים רלוונטיים אך אין מספיק ראיות לחיבור משמעותי:

```text
נמצאו ממצאים רלוונטיים, אך אין כרגע מספיק ראיות מחוברות כדי להפיק מהם תובנה ניהולית מבוססת.
```

לאחר מכן יש להציג:

- הממצאים החזקים ביותר.
- מה חסר כדי להסיק תובנה.
- אילו חיפושי המשך נדרשים.
- אילו תאריכים, מקורות או סטטוסים חסרים.

---

# 13. הפרומפט המוצע לסוכן התובנות

```text
# Identity

You are the BIDOC Construction Project Insight Synthesis Agent.

Your role is not to list retrieved findings.

Your role is to identify meaningful project-management insights by connecting evidence from multiple project records.

You operate exclusively on evidence supplied in the current request.

# Core Principle

A retrieved record is a finding, not necessarily an insight.

An insight must explain:

1. What happened or changed.
2. Which evidence supports it.
3. How the evidence is connected.
4. Why it matters to the project.
5. What should be checked, decided, or acted upon.

Use the following model:

INSIGHT = EVIDENCE + CONNECTION + PROJECT IMPLICATION + REQUIRED ATTENTION

Do not present isolated findings as insights.

# Authoritative Inputs

Use only:

- hashtag_results
- retrieval_results
- retrieval_context
- graph_context
- project_graph_findings
- analytics_context
- trend_metrics
- root_cause_hypotheses
- tool_results
- explicit project information supplied in the current request

Do not use general knowledge as project evidence.

Do not fabricate missing facts, dates, causes, dependencies, statuses, or conclusions.

Treat `analytics_context` and `trend_metrics` as deterministic calculated support only when they include a metric definition, analysis window, data coverage, and formula version.

Do not recalculate metrics in the model when a deterministic value is supplied.

Treat `root_cause_hypotheses` as inference candidates, never as confirmed causes.

Do not use an Executive Health Score by itself as evidence for a project fact or insight.

# Analysis Process

Perform the following process internally before producing the answer.

## Step 1: Normalize the evidence

For every retrieved item, identify when available:

- subject or issue
- project area
- responsible party
- event date
- document date
- commitment date
- required completion date
- reported status
- source type
- source identifier
- related activities or entities

Distinguish between:

- confirmed fact
- reported claim
- commitment
- request
- decision
- warning
- estimate
- unresolved question

Do not treat a request, estimate, or commitment as a completed fact.

## Step 2: Remove duplicates

Records may repeat the same information across:

- meeting summaries
- supervision reports
- emails
- schedule records
- alerts
- document versions

Merge records that describe the same underlying event.

Do not count repeated wording as independent confirmation unless the records originate from genuinely independent updates or sources.

## Step 3: Create evidence clusters

Group records that refer to the same:

- issue
- activity
- contractor
- location
- dependency
- decision
- document requirement
- safety event
- budget item
- schedule risk

Create a chronological timeline inside each cluster.

Prefer connected evidence over isolated semantic similarity.

## Step 4: Search for insight patterns

Look specifically for the following patterns.

### Unfulfilled commitment

A party committed to an action or date, but a later record shows that it remained incomplete, delayed, or unresolved.

### Status deterioration

The latest status is worse than an earlier status.

### Persistent unresolved issue

The same issue appears repeatedly over time without evidence of closure.

### Schedule deviation

Actual progress, forecast dates, or reported status differ from the baseline, approved schedule, milestone, or previous commitment.

### Dependency risk

One unresolved activity, approval, document, supplier, or contractor may block another activity.

State this as a potential dependency unless the dependency is explicitly documented.

### Contradiction

Different sources report conflicting dates, statuses, quantities, responsibility, or completion claims.

Do not choose one version unless the evidence clearly supports it.

### Cross-source corroboration

Independent sources describe the same risk, delay, shortage, or unresolved issue.

### Missing decision

Work cannot continue, or uncertainty persists, because an approval, response, design decision, or responsible party is missing.

### Recurring operational failure

The same category of issue appears in multiple areas, dates, contractors, or reporting periods.

### Emerging risk

Several individually minor findings combine into a meaningful project risk.

### Closure evidence

A previously reported problem has credible later evidence showing that it was resolved.

Do not continue presenting a resolved issue as active.

## Step 5: Use deterministic analytics and hypotheses carefully

When analytics are supplied:

- use them to support timing, frequency, recurrence, duration, trend, coverage, and ranking;
- verify that the metric window matches the user request;
- do not treat missing data as zero;
- do not compare metrics from different formula versions without explicit normalization;
- do not convert a metric into an insight without project-management meaning.

When root-cause hypotheses are supplied:

- label them as inference;
- include supporting evidence and missing evidence;
- mention alternative explanations when material;
- omit the hypothesis when support is too weak.

## Step 6: Validate each candidate insight

A candidate may be presented as an insight only when it passes all relevant checks:

- It is supported by identifiable project evidence.
- It adds meaning beyond restating the evidence.
- It is still relevant according to the latest available record.
- It is not a duplicate of another insight.
- It has a project-management implication.
- Its confidence level matches the strength of the evidence.

Prefer insights supported by at least two connected records.

A single record may support an insight only when it contains a clear and authoritative event, deviation, decision, safety issue, or explicit project risk.

## Step 7: Rank the insights

Rank candidates using:

- severity
- urgency
- evidence strength
- recurrence
- schedule impact
- safety impact
- financial impact
- number of affected activities
- need for management action

Return only the highest-value insights.

Do not fill the response with weak insights merely to reach a target count.

# Evidence and Inference Rules

Clearly separate:

- Confirmed: directly stated in the evidence.
- Inferred: logically derived from connected evidence.
- Potential impact: plausible but not confirmed.

Never present an inference or potential impact as a confirmed fact.

Use cautious language such as:

- "הדבר עשוי להשפיע על..."
- "קיים חשש כי..."
- "לא נמצאה ראיה לכך ש..."
- "נדרש לבדוק האם..."
- "המקורות מציגים מידע סותר..."

Do not invent causal relationships.

Do not claim that one activity blocks another unless:

- the dependency appears explicitly in the evidence; or
- it is clearly labeled as a dependency that requires verification.

# Output Requirements

Respond in professional, natural Hebrew.

Return no more than 5 significant insights unless explicitly requested otherwise.

For each insight use the following structure:

## [Short management-oriented insight title]

**התובנה:**  
A concise synthesis explaining what was identified across the evidence.

**הראיות:**  
List the specific connected records, dates, sources, and relevant facts.

**המשמעות לפרויקט:**  
Explain the schedule, safety, cost, quality, coordination, contractual, or operational implication.

**פעולה מומלצת:**  
State the concrete check, decision, escalation, ownership assignment, or follow-up required.

**רמת ודאות:** גבוהה / בינונית / נמוכה

**סטטוס:** פעיל / דורש אימות / נפתר / מידע סותר

**מקורות:**  
Provide the supplied source identifiers, filenames, page numbers, WebView links, or record identifiers whenever available.

# Prohibited Output

Do not:

- produce a list titled "insights" that merely paraphrases search results;
- repeat the same issue from several documents as separate insights;
- treat document frequency alone as proof of importance;
- infer completion from an intention or commitment;
- infer delay without a relevant expected date, baseline, commitment, or comparison point;
- describe old information as current when a newer status exists;
- hide conflicts between sources;
- create recommendations unrelated to the supplied evidence;
- expose private chain-of-thought.

# No-Insight Rule

When the supplied evidence contains findings but does not support meaningful insights, state:

"נמצאו ממצאים רלוונטיים, אך אין כרגע מספיק ראיות מחוברות כדי להפיק מהם תובנה ניהולית מבוססת."

Then provide:

- the strongest available findings;
- which missing evidence prevents synthesis;
- the follow-up searches required to validate possible insights.

# Final Quality Check

Before answering, silently verify:

1. Is every insight more than a summary?
2. Does every insight connect evidence?
3. Is the latest available status represented?
4. Are fact, inference, and potential impact separated?
5. Is there an actionable management implication?
6. Are duplicates removed?
7. Are weak candidates omitted?

If any answer is no, revise or remove the candidate.
```

---

# 14. מודל נתונים מוצע לאשכול ראיות

```json
{
  "cluster_id": "cluster-uuid",
  "topic": "מחיצות קומה 4",
  "category": "schedule_risk",
  "analysis_window": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "timezone": "Asia/Jerusalem"
  },
  "entities": [
    {
      "entity_id": "contractor-123",
      "type": "contractor",
      "name": "קבלן גבס"
    }
  ],
  "locations": [
    "קומה 4"
  ],
  "timeline": [
    {
      "date": "2026-06-12",
      "event_type": "commitment",
      "status": "open",
      "text": "הקבלן התחייב לסיים עד 18.6",
      "source_id": "meeting-123",
      "source_lineage": {
        "origin_type": "primary",
        "derived_from": null
      },
      "document_name": "meeting-2026-06-12.pdf",
      "page": 4
    },
    {
      "date": "2026-06-22",
      "event_type": "status_update",
      "status": "in_progress",
      "text": "המחיצות עדיין בביצוע",
      "source_id": "report-456",
      "source_lineage": {
        "origin_type": "primary",
        "derived_from": null
      },
      "document_name": "supervision-2026-06-22.pdf",
      "page": 7
    }
  ],
  "latest_status": "in_progress",
  "candidate_patterns": [
    "unfulfilled_commitment",
    "schedule_deviation"
  ],
  "analytics": {
    "age_days": 18,
    "days_past_commitment": 4,
    "occurrence_count": 2,
    "independent_source_count": 2,
    "data_coverage": 0.91,
    "trend": "deteriorating"
  },
  "data_quality": {
    "missing_fields": [],
    "contradiction_count": 0,
    "lineage_complete": true
  }
}
```

## כללי הסכמה

- `analytics` מכיל תוצאות מחושבות בלבד.
- כל מדד חייב להיות קשור לחלון זמן מוגדר.
- אין לשמור מסקנת LLM כשדה אנליטי.
- `source_lineage` נדרש כדי להבדיל בין מקור עצמאי לבין סיכום, alert או נגזרת של אותו מקור.
- נתון חסר נשמר כ־`null` או כמצב `insufficient_data`, ולא כאפס.

# 15. מודל נתונים מוצע לתובנה

```json
{
  "insight_id": "insight-uuid",
  "title": "אי־עמידה במועד השלמת מחיצות קומה 4",
  "category": "schedule_risk",
  "summary": "המועד שהתחייב עליו הקבלן חלף, ובעדכון מאוחר יותר העבודה עדיין דווחה בביצוע.",
  "confirmed_facts": [
    "ב־12.6 ניתנה התחייבות לסיום עד 18.6.",
    "ב־22.6 העבודה עדיין דווחה בביצוע."
  ],
  "supporting_metrics": {
    "days_past_commitment": 4,
    "independent_source_count": 2,
    "topic_occurrence_count": 2
  },
  "inference": "ההתחייבות לא קוימה במועד.",
  "root_cause_hypothesis_ids": [
    "hypothesis-789"
  ],
  "potential_impact": "ייתכן עיכוב בכניסת עבודות המשך בקומה.",
  "recommended_action": "לקבל מועד השלמה מעודכן ולבדוק השפעה על פעילויות ההמשך.",
  "confidence": "high",
  "status": "active",
  "severity": "medium",
  "urgency": "high",
  "evidence_ids": [
    "evidence-1",
    "evidence-2"
  ],
  "analysis_window": {
    "from": "2026-06-01",
    "to": "2026-06-30"
  },
  "score": 82,
  "score_version": "insight-ranking-v1"
}
```

## כללים

- `supporting_metrics` מחזק את התובנה אך אינו מחליף ראיות.
- `root_cause_hypothesis_ids` מפנה להשערות בלבד; אין להציג אותן כעובדות.
- ציון הדירוג חייב לכלול גרסה כדי לאפשר השוואה ובדיקת regression.
- `Executive Health Score` אינו נשמר כתובנה ואינו משמש לבדו כהוכחה לתובנה.

# 16. בדיקות קבלה

## Test 1 – ממצא יחיד ללא משמעות ניהולית

### קלט

> בדוח נכתב שהתקיימה ישיבת תיאום.

### תוצאה רצויה

אין להציג זאת כתובנה.

---

## Test 2 – התחייבות שלא קוימה

### קלט

- 1.6: הקבלן התחייב לסיים עד 5.6.
- 9.6: העבודה עדיין פתוחה.

### תוצאה רצויה

תובנה על אי־עמידה בהתחייבות.

---

## Test 3 – מידע כפול

### קלט

- פרוטוקול ישיבה.
- סיכום אוטומטי של אותו פרוטוקול.
- alert שנוצר מאותו פרוטוקול.

### תוצאה רצויה

אירוע קנוני אחד, לא שלושה מקורות עצמאיים.

---

## Test 4 – מידע סותר

### קלט

- מייל: העבודה הושלמה.
- דוח מאוחר יותר: העבודה עדיין בביצוע.

### תוצאה רצויה

תובנה שמציגה סתירה ודורשת אימות.

---

## Test 5 – נושא שנפתר

### קלט

- 1.6: חסר אישור.
- 5.6: האישור התקבל.
- 8.6: הפעילות החלה.

### תוצאה רצויה

אין להציג את חוסר האישור כסיכון פעיל.

---

## Test 6 – תלות שאינה מוכחת

### קלט

- פעילות א' באיחור.
- פעילות ב' קשורה לאותו אזור.
- אין ראיה מפורשת לתלות.

### תוצאה רצויה

יש לכתוב שנדרש לבדוק השפעה אפשרית, ולא לקבוע חסימה.

---

## Test 7 – תובנה ממקור יחיד משמעותי

### קלט

> צו הפסקת עבודה הוצא לאזור.

### תוצאה רצויה

מותר להפיק תובנה גם ממקור יחיד, בתנאי שהמקור מזוהה ואמין.

---

## Test 8 – שאלה רחבה

### קלט

> מה התובנות החשובות בפרויקט השבוע?

### תוצאה רצויה

- חיפוש רחב במספר מקורות.
- קיבוץ לפי נושא.
- השוואה לעדכונים קודמים.
- 3–5 תובנות בלבד.
- דירוג לפי חומרה ודחיפות.

---

## Test 9 – חישוב דטרמיניסטי

### קלט

אותה קבוצת אירועים, באותו חלון זמן, בשתי הרצות נפרדות.

### תוצאה רצויה

`Analytics Engine` מחזיר בדיוק את אותם המדדים בשתי ההרצות.

---

## Test 10 – נתון חסר אינו אפס

### קלט

אין דוחות בטיחות בתקופת הבדיקה.

### תוצאה רצויה

- `safety_score` אינו 100.
- המדד מסומן `insufficient_data`.
- כיסוי הנתונים מוצג במפורש.

---

## Test 11 – מגמה עם חלון השוואה

### קלט

- 12 נושאים פתוחים בחודש קודם.
- 18 נושאים פתוחים בחודש הנוכחי.
- אותה הגדרת מדד ואותו אופן איסוף.

### תוצאה רצויה

המגמה מסומנת כהחמרה, כולל ערכי הבסיס, התקופות והנוסחה.

---

## Test 12 – השערת סיבת שורש ללא הוכחה מלאה

### קלט

- החלטה מתעכבת.
- נמצא מידע חסר מהיועץ.
- לא נמצאה אמירה מפורשת שזה הגורם לעיכוב.

### תוצאה רצויה

- נוצרת לכל היותר השערה.
- ההשערה מסומנת `inference`.
- `requires_validation` הוא `true`.
- המערכת אינה מציגה את הסיבה כעובדה.

---

## Test 13 – אירוע קריטי מול ציון ממוצע

### קלט

רוב המדדים תקינים, אך קיים צו הפסקת עבודה פעיל.

### תוצאה רצויה

- מופיע `critical_flag`.
- הציון אינו מסתיר את האירוע.
- מופעל כלל cap או override בהתאם לגרסת הנוסחה.

---

## Test 14 – השוואה בין פרויקטים

### קלט

פרויקט נוכחי ופרויקט היסטורי מסוג או שלב שונים.

### תוצאה רצויה

אין להציג אותם כהשוואה תקפה ללא normalization והסבר לבסיס הדמיון.

---

## Test 15 – מקור נגזר אינו מקור עצמאי

### קלט

מסמך מקור, summary שלו ו־alert שנוצר מה־summary.

### תוצאה רצויה

`independent_source_count = 1`.

---

## Test 16 – שינוי נוסחה

### קלט

אותם נתונים מחושבים עם שתי גרסאות Health Score.

### תוצאה רצויה

כל פלט כולל `score_version`, ואין להשוות ציונים מגרסאות שונות ללא התאמה מפורשת.

# 17. תצפיות ומדדים

יש לתעד לכל הרצה:

- query.
- request type.
- analysis window.
- retrieval plan.
- מספר תוצאות מכל מקור.
- מספר תוצאות לפני deduplication.
- מספר אירועים לאחר deduplication.
- מספר מקורות עצמאיים.
- מספר clusters.
- מספר candidate patterns.
- מספר root-cause hypotheses.
- מספר candidate insights.
- מספר תובנות שנפסלו.
- סיבת הפסילה.
- דירוג התובנות.
- מקורות לכל תובנה.
- analytics metrics שהועברו לסינתזה.
- גרסת נוסחאות analytics.
- גרסת ranking.
- גרסת Health Score.
- data coverage לכל תחום.
- missing-data states.
- critical flags.
- latency לכל שלב.
- token usage לכל שלב שמפעיל מודל.
- האם נעשה שימוש בגרף.
- האם נעשה חיפוש המשך.
- האם נמצאה ראיית סגירה.
- האם נמצאה סתירה.
- האם נוצרה השערת סיבת שורש.
- האם נעשה שימוש במידע בין־פרויקטלי.

## מדדי איכות לתובנות

- אחוז תובנות שמחברות שני מקורות או יותר.
- אחוז תובנות עם פעולה מומלצת.
- אחוז תובנות עם מקור מלא.
- שיעור כפילויות.
- שיעור תובנות שהתבררו כישנות.
- שיעור hallucination.
- precision של תובנות משמעותיות.
- recall של סיכונים ידועים.
- דירוג ידני של מנהלי פרויקט.
- יחס בין findings לבין approved insights.

## מדדי איכות אנליטיים

- reproducibility: אותה קלט מחזיר אותו פלט.
- אחוז מדדים עם הגדרת חלון זמן.
- אחוז מדדים עם גרסת נוסחה.
- אחוז מדדים עם כיסוי נתונים ידוע.
- שיעור נתונים חסרים שסומנו נכון.
- סטייה מול חישוב reference בבדיקות.
- שיעור מקורות נגזרים שזוהו נכון.
- שיעור מגמות שכוללות תקופת בסיס תקפה.

## מדדי איכות להשערות סיבתיות

- אחוז השערות עם ראיות תומכות.
- אחוז השערות עם `missing_evidence`.
- אחוז השערות שסומנו כעובדה בטעות.
- שיעור השערות שאושרו או הופרכו בבדיקה אנושית.

## מדדי Health Score

- כיסוי הנתונים לכל dimension.
- מספר critical flags.
- רגישות הציון לנתון חסר.
- יציבות הציון על אותה תקופה.
- יכולת להסביר שינוי בין תקופות.
- שיעור השוואות שנפסלו בגלל חוסר normalization.

# 18. אסטרטגיית יישום הדרגתית

## Phase 1 – Audit

- מיפוי הקוד הקיים.
- איתור כל רכיבי retrieval.
- איתור פרומפטים קיימים.
- איתור schemas.
- איתור מנגנוני deduplication.
- איתור שימוש בגרף.
- איתור ranking ו־critic קיימים.
- איתור חישובים אנליטיים קיימים.
- איתור מנגנוני scoring ומגמות.
- איתור קוד השוואה בין פרויקטים.

## Phase 2 – Structured Evidence

- יצירת Evidence schema אחיד.
- שמירת metadata מלאה.
- הפרדת event date מ־document date.
- סיווג סוגי ראיות.
- שימור source lineage.
- סימון primary מול derived sources.
- הגדרת analysis windows.

## Phase 3 – Clustering and Timeline

- deduplication.
- entity resolution.
- topic clustering.
- timeline builder.
- latest-status detection.
- closure detection.
- contradiction detection.

## Phase 4 – Deterministic Analytics

- הגדרת metric registry.
- חישובי snapshot.
- duration metrics.
- recurrence metrics.
- data quality and coverage.
- Trend Analyzer כתת־רכיב.
- גרסאות נוסחה.
- unit tests לחישובים.

## Phase 5 – Pattern and Hypothesis Detection

- pattern detectors.
- dependency signals.
- Root Cause Hypothesis Engine.
- supporting and counter evidence.
- missing-evidence handling.
- confidence calibration.

## Phase 6 – Insight Generation

- insight synthesizer.
- fact / inference / impact separation.
- שילוב metrics כתמיכה בלבד.
- structured insight output.

## Phase 7 – Critic and Ranking

- critic.
- rejection reasons.
- scoring.
- top insights filtering.
- stale insight prevention.
- regression evaluation.

## Phase 8 – Executive Health Score

- הגדרת dimensions.
- נוסחת scoring שקופה.
- missing-data rules.
- coverage thresholds.
- critical gates.
- score explanation.
- period-over-period comparison.
- normalization rules.

## Phase 9 – Evaluation and Observability

- test fixtures.
- regression tests.
- benchmark questions.
- human review.
- observability dashboard.
- metric and score version tracking.

## Phase 10 – Cross Project Learning (עתידי)

- הרשאות ובידוד מידע.
- anonymization.
- similarity criteria.
- minimum comparison cohort.
- normalization לפי סוג ושלב.
- indicator-only output.

# 19. סדר עדיפויות מומלץ

## Priority 0 – להבין את הקוד הקיים

אין להתחיל שכתוב לפני מיפוי מלא.

## Priority 1 – לעצור את ההצגה של ממצאים כתובנות

להוסיף validation בסיסי:

- יותר מסיכום.
- מקור מזוהה.
- משמעות ניהולית.
- סטטוס עדכני.
- ללא כפילות.

## Priority 2 – Evidence schema, metadata ו־source lineage

ללא metadata אמין לא ניתן לבנות תובנות, analytics או ציונים שניתנים לבדיקה.

## Priority 3 – Deduplication ו־timeline

אלו הרכיבים החשובים ביותר לזיהוי שינוי, אי־עמידה, הישנות וסגירה.

## Priority 4 – Clustering

חיבור נכון בין תוצאות חיפוש.

## Priority 5 – Analytics Engine בסיסי

תחילה יש ליישם:

- open vs closed.
- age of open issue.
- days past due.
- independent source count.
- recurrence count.
- data coverage.

אין להתחיל מ־Health Score לפני שמדדים אלה יציבים ומבוקרים.

## Priority 6 – Pattern detection

כללים מפורשים לתבניות תובנה.

## Priority 7 – Critic ו־ranking

שיפור precision והצגת התובנות החשובות בלבד.

## Priority 8 – Trend Analyzer

רק לאחר שיש מדדים עקביים, חלונות זמן וגרסאות נוסחה.

## Priority 9 – Root Cause Hypothesis Engine

רק לאחר ש־Pattern Detection וה־source lineage אמינים.

## Priority 10 – Executive Health Score

רק לאחר שיש:

- מדדים יציבים.
- data coverage.
- missing-data rules.
- critical gates.
- נוסחה מתועדת.
- benchmark ידני.

## Priority 11 – Graph enrichment

שימוש בקשרים כדי לזהות תלויות, גורמים ונושאים מחוברים.

ניתן לקדם רכיב זה מוקדם יותר אם כבר קיימת תשתית גרף יציבה בקוד.

## Priority 12 – Cross Project Learning

רכיב עתידי בלבד, לאחר השלמת הרשאות, אנונימיזציה ו־normalization.

# 20. שאלות שה־Gap Analysis צריך לענות עליהן

## Flow ו־Retrieval

1. מהו entry point של בקשת תובנות?
2. איזה agent מקבל את הבקשה?
3. מי מחליט באילו כלים להשתמש?
4. כיצד מתבצע חיפוש האשטגים?
5. כיצד מתבצע חיפוש סמנטי?
6. האם יש full-text search?
7. האם יש חיפוש SQL מובנה?
8. האם נעשה שימוש בגרף?
9. האם קיימים follow-up searches?
10. כיצד מוגדר חלון הזמן לכל חיפוש?

## Evidence ו־Lineage

11. האם תוצאות החיפוש עוברות normalization?
12. האם קיימת evidence schema?
13. האם נשמרים source IDs?
14. האם נשמרים filename, page ו־WebView link?
15. האם קיימת הפרדה בין event date ל־document date?
16. האם נשמר `source_lineage`?
17. האם המערכת מבחינה בין primary source לבין derived source?
18. האם קיים deduplication?
19. האם deduplication מבדיל בין מקור עצמאי למקור נגזר?
20. האם קיים entity resolution?
21. האם קיים clustering?
22. האם קיים timeline builder?
23. האם המערכת מזהה latest status?
24. האם קיימת closure detection?
25. האם קיימת contradiction detection?

## Patterns ו־Insights

26. האם קיימת commitment tracking?
27. האם קיימת schedule comparison?
28. האם קיימת dependency analysis?
29. האם קיימת הפרדה בין fact, inference ו־potential impact?
30. האם קיים insight critic?
31. האם קיימת סיבת פסילה לתובנה?
32. האם קיים ranking?
33. האם קיימת מגבלת top insights?
34. האם קיימים tests שמבדילים בין finding ל־insight?
35. האם קיימים tests למידע סותר?
36. האם קיימים tests לסגירת נושא?
37. האם קיימים tests לכפילויות?

## Analytics

38. האם קיימים חישובים דטרמיניסטיים?
39. היכן מוגדר כל metric?
40. האם קיימת metric registry או לוגיקה מפוזרת?
41. האם כל metric כולל analysis window?
42. האם כל metric כולל גרסת נוסחה?
43. כיצד מטופלים null ונתונים חסרים?
44. האם חוסר מידע מתורגם בטעות לאפס?
45. האם קיימים data coverage metrics?
46. האם קיימים recurrence metrics?
47. האם קיימים duration metrics?
48. האם קיימים open vs closed metrics?
49. האם קיימת כפילות בין analytics לבין prompts של LLM?
50. האם המודל מחשב בעצמו נתונים שכבר ניתן לחשב בקוד?

## Trends

51. האם קיים Trend Analyzer?
52. האם הוא תת־רכיב של analytics או pipeline מתחרה?
53. כיצד מוגדרת תקופת הבסיס?
54. האם ניתן להשוות רק בין מדדים מאותה גרסה?
55. האם יש minimum sample size?
56. האם קיימת הבחנה בין שינוי אמיתי לבין שינוי בכיסוי הנתונים?

## Root Cause Hypotheses

57. האם קיימת לוגיקה סיבתית?
58. האם היא מציגה השערות או קביעות?
59. האם כל השערה כוללת supporting evidence?
60. האם נשמר counter evidence?
61. האם נשמר missing evidence?
62. האם קיים `requires_validation`?
63. האם ניתן להחזיר `no supported hypothesis`?

## Executive Health Score

64. האם קיים Health Score?
65. האם הנוסחה מתועדת וגרסתית?
66. האם מוצגים subscores?
67. האם מוצג data coverage?
68. כיצד נתונים חסרים משפיעים על הציון?
69. האם קיימים critical gates או caps?
70. האם אירוע חמור יכול להיעלם בממוצע?
71. האם ניתן להסביר כל שינוי בציון?
72. האם קיימים normalization rules להשוואה בין פרויקטים?
73. האם נעשית השוואה בין ציונים מגרסאות שונות?

## Cross Project Learning

74. האם קיימת גישה למידע מפרויקטים אחרים?
75. כיצד נאכפות הרשאות בין לקוחות?
76. האם קיימת anonymization?
77. כיצד מוגדר project similarity?
78. האם קיימת התאמה לפי סוג, גודל ושלב?
79. האם מידע היסטורי מוצג כאינדיקציה בלבד?
80. האם קיימת מניעה לחשיפת שמות, ספקים או נתונים מפרויקט אחר?

## קוד, תפעול ובדיקות

81. האם קיימת observability לכל שלב?
82. אילו חלקים קיימים אך אינם מחוברים לזרימה?
83. אילו פרומפטים מתנגשים?
84. האם יש כמה implementations לאותו flow?
85. האם יש קוד legacy שעדיין מופעל?
86. האם קיימות נוסחאות כפולות במקומות שונים?
87. האם קיימים feature flags?
88. האם קיימים benchmark fixtures?
89. האם ניתן לשחזר ריצה מלאה?
90. מהו השינוי הקטן ביותר שייתן שיפור משמעותי?

# 21. פורמט תוכנית היישום שקודקס צריך להציע

לאחר ה־Gap Analysis, יש להציע תוכנית עבודה.

לכל משימה:

```markdown
## Task [number] – [name]

**מטרה:**  
מה השינוי אמור להשיג.

**המצב הקיים:**  
מה קיים כיום בקוד.

**השינוי:**  
מה יש להוסיף, לשנות או לחבר.

**קבצים צפויים:**  
רשימת קבצים שעשויים להשתנות.

**תלויות:**  
רכיבים שנדרשים לפני ביצוע המשימה.

**סיכון:**  
נמוך / בינוני / גבוה.

**בדיקות:**  
כיצד נוכיח שהשינוי עובד.

**קריטריון קבלה:**  
תוצאה מדידה וברורה.
```

---

# 22. כללי זהירות לשלב המימוש

כאשר יינתן אישור לעבור ממחקר למימוש:

- לבצע שינויים קטנים והדרגתיים.
- לא להחליף את כל הזרימה בבת אחת.
- לשמר backward compatibility כאשר אפשר.
- להוסיף feature flags לרכיבים חדשים.
- להוסיף logging לפני שינוי התנהגות.
- להוסיף tests לפני refactor משמעותי.
- לא לשנות schema ללא migration.
- לא למחוק prompt קיים לפני השוואת תוצאות.
- לשמור source lineage מקצה לקצה.
- להציג diff ברור לכל שינוי.
- לא לבצע commit או push ללא בקשה מפורשת.

---

# 23. תוצר סופי רצוי של המערכת

המערכת לא צריכה לומר רק:

> נמצאו מספר אזכורים למחיצות קומה 4.

היא צריכה לומר:

> הקבלן התחייב להשלים את מחיצות קומה 4 עד 18.6, אך בדוח מ־22.6 העבודה עדיין דווחה בביצוע. מדובר באי־עמידה במועד ההתחייבות. יש לקבל מועד מעודכן ולבדוק השפעה אפשרית על עבודות המערכות והגמר בקומה.

ובתוך התשובה להציג:

- הראיות.
- התאריכים.
- המקורות.
- הסטטוס האחרון.
- רמת הוודאות.
- המשמעות.
- הפעולה המומלצת.

---

# 24. הגדרת הצלחה

שדרוג סוכן התובנות ייחשב מוצלח כאשר:

1. רוב התשובות אינן רשימות של ממצאים.
2. כל תובנה מחברת בין ראיות או מציגה אירוע יחיד בעל משמעות חריגה.
3. תובנות ישנות או פתורות אינן מוצגות כפעילות.
4. כפילויות אינן מנפחות את החשיבות.
5. עובדה, הסקה והשפעה אפשרית מופרדות.
6. מוצגים רק הסיכונים והדפוסים החשובים.
7. לכל תובנה יש מקור ברור.
8. לכל תובנה יש משמעות ניהולית.
9. לכל תובנה יש פעולה מומלצת או צורך בהחלטה.
10. מנהל פרויקט יכול להבין מה דורש תשומת לב בלי לקרוא את כל המסמכים.
11. כל metric דטרמיניסטי ניתן לשחזור מאותו קלט.
12. לכל metric יש חלון זמן, הגדרה וגרסת נוסחה.
13. נתון חסר אינו מתורגם אוטומטית לאפס או למצב תקין.
14. Trend Analyzer אינו מחשב לוגיקה כפולה במקביל ל־Analytics Engine.
15. כל השערת סיבת שורש מסומנת כהשערה וכוללת ראיות ומידע חסר.
16. ניתן להחזיר שאין סיבת שורש מבוססת.
17. Health Score כולל subscores, כיסוי נתונים וגרסת נוסחה.
18. אירועים קריטיים אינם נבלעים בתוך ציון ממוצע.
19. ניתן להסביר מדוע הציון השתנה בין תקופות.
20. השוואה בין פרויקטים נעשית רק לאחר normalization מתאים.
21. מידע מפרויקט אחר אינו מוצג כהוכחה לפרויקט הנוכחי.
22. כל output שומר source lineage מקצה לקצה.

# 25. Analytics Engine

## מטרה

להוסיף שכבת חישוב אנליטית בין `Timeline Builder` לבין `Pattern Detection`.

השכבה:

- אינה מייצרת תובנות.
- אינה מפעילה LLM.
- אינה ממציאה סטטוסים או תאריכים.
- מחשבת מדדים ניתנים לשחזור.
- מעבירה אובייקט מובנה ל־Pattern Detection, ל־Insight Synthesizer ול־Executive Health Score.

## קלט נדרש

הקלט אינו רק timeline. הוא כולל:

- normalized evidence.
- canonical events לאחר deduplication.
- topic and entity clusters.
- timelines.
- source lineage.
- analysis window.
- project metadata הנדרש לנרמול.

## מבנה פנימי

```text
Analytics Engine
├── Snapshot Metrics
├── Duration Metrics
├── Recurrence Analyzer
├── Trend Analyzer
├── Dependency Statistics
├── Decision & Closure Metrics
├── Procurement & Information Readiness
└── Data Quality & Coverage
```

`Trend Analyzer` הוא תת־רכיב של Analytics Engine ואינו מנוע מקביל.

## מדדים אפשריים

- Topic Frequency.
- Entity Frequency.
- Discipline Frequency.
- Open vs Closed Issues.
- Oldest Open Issue.
- Average Decision Time.
- Median Decision Time.
- Average Closure Time.
- Median Closure Time.
- Meeting Resolution Rate.
- Procurement Readiness.
- Information Completeness.
- Recurrence Statistics.
- Dependency Statistics.
- Independent Source Count.
- Source Quality and Coverage Statistics.

## Source Quality and Coverage

אין לחשב `Source Reliability Score` כללי ללא ground truth.

במקום זאת יש לחשב:

- metadata completeness.
- freshness.
- primary vs derived source ratio.
- independent source count.
- contradiction rate.
- temporal coverage.
- discipline coverage.
- source-lineage completeness.
- unresolved missing fields.

## כללי חישוב

- כל metric חייב לכלול `metric_id`.
- כל metric חייב לכלול `metric_version`.
- כל metric חייב לכלול `analysis_window`.
- כל metric חייב לכלול `calculation_timestamp`.
- כאשר אין מספיק מידע, הערך הוא `null` והסטטוס הוא `insufficient_data`.
- אין להשתמש באפס כתחליף למידע חסר.
- יש להעדיף median לצד average במדדי זמן.
- יש לשמור numerator ו־denominator במדדי יחס.
- יש להגדיר timezone אחיד.
- אותה קלט ואותה גרסת נוסחה חייבות להחזיר אותו פלט.

## פלט מוצע

```json
{
  "analytics_version": "analytics-v1",
  "analysis_window": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "timezone": "Asia/Jerusalem"
  },
  "project_metrics": {
    "open_issues": {
      "value": 18,
      "status": "calculated",
      "metric_version": "open-issues-v1"
    },
    "average_closure_days": {
      "value": 7.4,
      "median": 5,
      "sample_size": 23,
      "status": "calculated",
      "metric_version": "closure-time-v1"
    }
  },
  "patterns": {},
  "trends": {},
  "dependencies": {},
  "data_quality": {
    "coverage": 0.78,
    "missing_dimensions": [
      "cost"
    ],
    "derived_source_ratio": 0.31,
    "lineage_complete": true
  }
}
```

## גבולות אחריות

ה־Analytics Engine אינו:

- קובע למה אירוע התרחש.
- מנסח המלצה.
- מחליט אם ממצא הוא תובנה.
- מציג metric כתוצאה ניהולית ללא הקשר.
- משלים נתון חסר בעזרת LLM.

# 26. Root Cause Hypothesis Engine

## מטרה

לאחר זיהוי דפוס משמעותי, המערכת יכולה לנסות לזהות **השערות סיבתיות אפשריות**.

שם הרכיב הוא `Root Cause Hypothesis Engine`, ולא `Root Cause Engine`, משום שהמערכת אינה רשאית לקבוע סיבת שורש ללא ראיות ישירות ומספקות.

## שאלות שהרכיב מנסה לענות עליהן

- אילו גורמים עשויים להסביר את הדפוס?
- האם אותו גורם מופיע לפני הבעיה במספר מקרים?
- האם קיימת שרשרת ראיות שמחברת גורם לתוצאה?
- האם קיימות ראיות נגד?
- איזה מידע חסר כדי לאשר או להפריך את ההשערה?

## קטגוריות אפשריות

- תכנון.
- רכש.
- תיאום.
- החלטות.
- מידע חסר.
- כוח אדם.
- ביצוע.
- ספק.
- אישור.
- תלות חיצונית.

הקטגוריות מסייעות לקיבוץ בלבד ואינן הוכחה לסיבתיות.

## כללי אמינות

- הפלט תמיד מסומן `inference`.
- אין חובה להחזיר השערה.
- יש לאפשר תשובה `no_supported_hypothesis`.
- כל השערה חייבת לכלול supporting evidence.
- יש לכלול counter evidence כאשר קיים.
- יש לכלול missing evidence.
- יש לציין alternative hypotheses כאשר קיימות.
- אין להסתמך על תדירות בלבד כהוכחה לסיבתיות.
- אין להסיק שכיוון כרונולוגי מוכיח קשר סיבתי.
- אין להשתמש בידע כללי על ענף הבנייה כראיה לפרויקט.

## פלט מוצע

```json
{
  "hypothesis_id": "hypothesis-789",
  "pattern_id": "pattern-456",
  "hypothesis": "ייתכן שהעיכוב באישור נובע ממידע חסר מהיועץ",
  "classification": "inference",
  "category": "information_gap",
  "supporting_evidence_ids": [
    "evidence-123",
    "evidence-456"
  ],
  "counter_evidence_ids": [],
  "alternative_hypotheses": [
    "עיכוב בזמינות הגורם המאשר"
  ],
  "missing_evidence": [
    "לא נמצאה אמירה ישירה של הגורם המאשר לגבי סיבת העיכוב"
  ],
  "confidence": "medium",
  "requires_validation": true,
  "status": "candidate"
}
```

## ניסוח מותר

> הראיות מעלות אפשרות שהעיכוב קשור למידע חסר מהיועץ, אך לא נמצאה הוכחה ישירה לסיבתיות ונדרש אימות.

## ניסוח אסור

> העיכוב נגרם בגלל היועץ.

אלא אם הדבר נאמר במפורש במקור מוסמך ומגובה בראיות.

# 27. Trend Analyzer

## מעמד ארכיטקטוני

`Trend Analyzer` הוא תת־רכיב של `Analytics Engine`.

אין לבנות מנוע מגמות עצמאי שמחשב מחדש metrics שכבר מחושבים ב־Analytics Engine, אלא אם ה־Gap Analysis מוכיח צורך טכני ומגדיר מקור אמת יחיד.

## מטרות

- להשוות מדד בין חלונות זמן.
- לזהות שיפור, הידרדרות או יציבות.
- לזהות שינוי בקצב ולא רק שינוי בכמות.
- להבדיל בין שינוי אמיתי לבין שינוי בכיסוי הנתונים.

## דוגמאות

- מספר נושאים פתוחים לאורך זמן.
- שינוי בקצב סגירת החלטות.
- עלייה או ירידה בכמות RFI.
- שינוי בקצב אישורי רכש.
- שינוי בקצב סגירת ליקויים.
- שינוי במשך הזמן הממוצע לקבלת החלטה.
- שינוי בהישנות נושאים לפי תחום או גורם.

## תנאי תקפות

מגמה תקפה רק כאשר:

- המדד מחושב באותה גרסת נוסחה.
- חלונות הזמן בני־השוואה.
- קיימת הגדרת baseline.
- קיים sample size מינימלי.
- כיסוי הנתונים דומה או שהשינוי בכיסוי מוסבר.
- אין שינוי מהותי בסיווגים או במקורות ללא התאמה.

## פלט מוצע

```json
{
  "metric_id": "open_issues",
  "metric_version": "open-issues-v1",
  "current_period": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "value": 18,
    "coverage": 0.81
  },
  "baseline_period": {
    "from": "2026-05-01",
    "to": "2026-05-31",
    "value": 12,
    "coverage": 0.79
  },
  "absolute_change": 6,
  "percentage_change": 50,
  "direction": "deteriorating",
  "sample_status": "valid",
  "confidence": "high"
}
```

## שימוש בתובנות

המגמה משמשת ראיה תומכת לתובנה.

אין להציג:

> קיימת הידרדרות בפרויקט.

רק משום שמדד אחד עלה, ללא פירוש, הקשר ובדיקת איכות הנתונים.

# 28. Executive Health Score

## מטרה

לחשב ציון בריאות לפרויקט באמצעות מדדים דטרמיניסטיים, שקופים וגרסתיים.

הציון אינו מבוסס על התרשמות חופשית של LLM.

## עקרונות

- הציון הוא כלי סיכום, לא תחליף לתובנות.
- כל ציון חייב להיות ניתן להסבר.
- כל ציון חייב לכלול ציוני משנה.
- כל ציון חייב לכלול גרסת נוסחה.
- כל ציון חייב לכלול חלון זמן.
- כל ציון חייב לכלול data coverage.
- נתון חסר אינו מצב תקין.
- אירוע קריטי אינו נבלע בתוך ממוצע.

## Dimensions אפשריים

- Schedule.
- Safety.
- Quality.
- Procurement.
- Coordination.
- Information Readiness.
- Decision Velocity.
- Recurrence.
- Execution Readiness.
- Cost, רק כאשר קיימים נתונים מספקים.

## טיפול בנתונים חסרים

כאשר אין מספיק מידע בתחום:

```json
{
  "dimension": "safety",
  "score": null,
  "status": "insufficient_data",
  "coverage": 0.18
}
```

אין להחזיר `100` רק משום שלא נמצאו אירועים.

יש להגדיר:

- minimum coverage לחישוב dimension.
- minimum dimensions לחישוב ציון כולל.
- האם לבצע weight redistribution.
- מתי הציון הכולל מסומן `provisional`.
- מתי אין לחשב ציון כלל.

## Critical Gates

אירועים קריטיים יכולים להפעיל:

- `critical_flag`.
- cap לציון המרבי.
- override לסטטוס.
- הצגה נפרדת שאינה מושפעת מהממוצע.

דוגמאות:

- צו הפסקת עבודה.
- תאונת בטיחות חמורה.
- milestone קריטי באיחור מהותי.
- פעילות קריטית חסומה.
- חריגה תקציבית קריטית מוכחת.

## פלט מוצע

```json
{
  "score": 83,
  "status": "provisional",
  "score_version": "project-health-v1.2",
  "period": {
    "from": "2026-06-01",
    "to": "2026-06-30"
  },
  "data_coverage": 0.76,
  "confidence": "medium",
  "subscores": {
    "schedule": {
      "score": 72,
      "coverage": 0.91
    },
    "safety": {
      "score": null,
      "coverage": 0.18,
      "status": "insufficient_data"
    },
    "procurement": {
      "score": 68,
      "coverage": 0.74
    },
    "coordination": {
      "score": 81,
      "coverage": 0.86
    },
    "information_readiness": {
      "score": 75,
      "coverage": 0.82
    }
  },
  "missing_dimensions": [
    "cost"
  ],
  "critical_flags": [],
  "change_from_previous_period": {
    "previous_score": 87,
    "delta": -4,
    "main_drivers": [
      "ירידה במוכנות רכש",
      "עלייה במשך סגירת החלטות"
    ]
  }
}
```

## השוואה בין פרויקטים

אין להשוות raw scores ללא normalization.

יש להתחשב לפחות ב:

- סוג הפרויקט.
- שלב הפרויקט.
- גודל.
- משך.
- כמות קבלנים.
- תדירות דיווח.
- כיסוי נתונים.
- שיטת התקשרות.
- גרסת נוסחה.

השוואה שאינה עומדת בתנאים תסומן `not_comparable`.

# 29. Cross Project Learning (עתידי)

## מטרה

לזהות דפוסים דומים בפרויקטים קודמים ולספק אינדיקציה מוקדמת בלבד.

אין להשתמש במידע מפרויקט אחר כהוכחה למצב בפרויקט הנוכחי.

## תנאי הפעלה

- קיימת הרשאה מפורשת לשימוש בנתונים.
- קיימת הפרדה מלאה בין לקוחות.
- מידע רגיש עובר anonymization.
- קיים minimum comparison cohort.
- מוגדר similarity model שקוף.
- מתבצע normalization לפי סוג ושלב.
- תוצאת ההשוואה מסומנת `indicator_only`.

## בסיסי דמיון אפשריים

- project type.
- project stage.
- size.
- discipline.
- issue pattern.
- procurement model.
- schedule phase.
- contractor structure.
- reporting coverage.

## פלט מוצע

```json
{
  "similar_pattern": "עיכוב חוזר באישור חומרי גמר",
  "comparison_basis": {
    "project_type": "commercial",
    "project_stage": "finishes",
    "discipline": "architecture",
    "pattern": "approval_delay"
  },
  "matching_projects_count": 4,
  "minimum_cohort_met": true,
  "current_project_evidence_ids": [
    "evidence-1",
    "evidence-2"
  ],
  "historical_signal": "indicator_only",
  "historical_data_anonymized": true,
  "confidence": "medium"
}
```

## ניסוחים מותרים

- `נמצא דפוס הדומה לדפוסים אנונימיים בפרויקטים דומים.`
- `בפרויקטים בעלי מאפיינים דומים נצפתה מגמה דומה; זהו אות השוואתי בלבד.`
- `ההשוואה אינה מהווה ראיה למצב בפרויקט הנוכחי.`

## איסורים

- אין לחשוף שמות של לקוחות, אנשים, קבלנים או ספקים מפרויקט אחר.
- אין להעביר מסמכים או ציטוטים בין פרויקטים.
- אין להציג תוצאה היסטורית כתחזית ודאית.
- אין להשוות פרויקטים שאינם בני־השוואה.
- אין להשתמש בפרויקט יחיד כבסיס למסקנה כללית.

