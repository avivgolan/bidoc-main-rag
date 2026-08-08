# BIDoc Schedule Intelligence Engine

## אפיון מנוע אינדיקציית לוחות זמנים

**גרסה:** 3.0
**סטטוס:** אפיון מיושר לקוד ולדאטה בפועל
**מערכת:** BIDoc — `bidoc-main-rag`
**שם רכיב:** `Schedule Intelligence Service` (מנוע: `Schedule Intelligence Engine`)
**גרסת מנוע:** `schedule-engine.v1`
**חוזה פלט:** `schedule-indicator.v1`
**מדידת מצב קיים:** 2026-08-04

> **מקורות שמוזגו למסמך זה:** `BIDoc_Schedule_Intelligence_Engine_Spec.md` v1.0, `..._v1.1.md` (פרק 19 — שירות ליבה וכלל 001), וסקירת קוד ודאטה חיה מ-2026-08-04. זהו המסמך הקנוני היחיד.

## CTO binding implementation addendum — 2026-08-08

This addendum records implementation constraints confirmed by the CTO and overrides conflicting implementation/runbook wording later in this document:

1. The existing Schedule Engine calculation logic is a protected, already implemented baseline. Contracts work is additive and must not rewrite, replace, refactor, or silently change src/scheduleEngine.js, src/scheduleCalendar.js, basis priority, extension behavior, date arithmetic, status, confidence, severity, lookup, or sweep.
2. The existing eight CTO-created tables are canonical and must be reused: schedule_calendars, schedule_contract_milestones, schedule_contract_extensions, schedule_contract_conditions, schedule_indicator_snapshots, schedule_alerts, schedule_activity_map, and schedule_observed_events.
3. No duplicate/replacement Schedule table and no unapproved CREATE, ALTER, DROP, TRUNCATE, index, trigger, function, RLS, grant, policy, permission, or backfill operation is authorized.
4. Before Contracts implementation, perform a read-only live schema/caller audit, approve a field-level reuse matrix, and capture the existing Schedule regression/golden-output baseline.
5. Contracts facts enter through an additive validator/writer using existing table contracts. If a required fact cannot be represented safely, keep it non-operational and request a separate bounded exception; do not change the Engine or schema automatically.
6. The historical SQL blocks below are schema-reference material only. They are not an executable provisioning or rollback runbook for the current environment.

Controlling implementation plan: [BIDoc Contracts Agent and Schedule Intelligence Implementation Plan](./BIDoc_Contracts_Agent_and_Schedule_Intelligence_Implementation_Plan.md)

---

## 0. מה השתנה

### 0.1 מה נקלט מ-v1.1

v1.1 היה ה-v1.0 המקורי בתוספת פרק 19. הפרק הזה נקלט במלואו, ובחלקו הועלה לרמת עיקרון.

| מ-v1.1                                                                            | לאן נכנס                                                       | הערה                                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| מסגור כ-**Core Service** ו-Single Source of Truth                     | סעיף 1.1                                                          | חיזק את מה שגרסה 2.0 ניסחה חלש מדי                                                        |
| **כלל 001** — אין חישובי לו״ז מחוץ לשירות         | **סעיף 1.4** — הועלה לרמת עיקרון מחייב | v1.1 מיקם אותו כשורה אחת בסוף; הוא חשוב מכדי להיקבר שם                     |
| רשימת הצרכנים (Chat / Document / Mail / Meeting / Insight / Dashboard) | סעיף 3.7                                                          | מופתה לקבצים אמיתיים ברפו — חלק מהשמות ב-v1.1 אינם סוכנים קיימים |
| חובת הצ׳אט לפנות לשירות לפני ניסוח תשובה         | סעיף 3.7                                                          | אומצה כלשונה                                                                                           |
| `EvaluateEmail`, `GetProjectScheduleHealth`                                    | סעיף 4.4                                                          | שני מסלולים שלא היו בגרסה 2.0                                                                |
| שרשרת ה-Workflow                                                             | סעיף 4.6                                                          | "Event Publication" הוחלף — אין תשתית הודעות במערכת                                     |

**ממצא שנוסף בעקבות כלל 001:** הכלל כבר מופר בקוד היום. הפירוט בסעיף 1.4.

### 0.2 מה השתנה מ-v1.0

גרסה 1.0 נכתבה כאפיון עצמאי, בלי התייחסות לקוד ולדאטה הקיימים. גרסה 2.0 יישרה אותה.

| #  | שינוי                                                                                                                                                                                                                                                                                                       |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | **נוספה המטרה הראשית** — שכבת האמת שסוכנים אחרים שואלים. בגרסה 1.0 זה הופיע כמשפט אחד בסעיף המטרה ולא היה לו חוזה, לא צרכנים מוגדרים ולא זרימה. עכשיו זה פרק 3, ליבת המסמך. |
| 2  | **נוסף הפרימיטיב `daysRemaining` / `daysLate`** — גרסה 1.0 החזירה רק סטיות בדיעבד. אי אפשר היה לענות "כמה ימים נשארו למשימה", שזו השאלה שסוכן ההתראות שואל.                                               |
| 3  | **נוספו `asOf` וסמנטיקת "נכון לתאריך"** — בלי זה החישוב לא דטרמיניסטי ולא ניתן לשחזור.                                                                                                                                                       |
| 4  | **מודל הנתונים יושר** — `gantt_tasks` כמקור אמת ללוח הקבלן, `delay_schedule_*` כשכבת ניתוח. גרסה 1.0 המציאה סכימה שלישית שמתעלמת משתיהן.                                                                                  |
| 5  | **ה-API יושר** — `/internal/...` לא קיים במערכת. הכל עובר דרך `/api/...` ב-[`src/server.js`](../src/server.js).                                                                                                                                                          |
| 6  | **TypeScript הוסר** — הפרויקט הוא ESM JS נטו בלי build step. החוזים מוגדרים כ-JSON + `contractVersion`, בתבנית `data-query.v2`.                                                                                                                               |
| 7  | **נוסף פיצול App DB / Content DB** — המערכת מולטי-טננטית. גרסה 1.0 לא הזכירה זאת כלל.                                                                                                                                                                         |
| 8  | **Event Bus הוחלף** — אין תשתית הודעות במערכת. הוחלף בסריקה מתוזמנת + `runLog`.                                                                                                                                                                              |
| 9  | **כל רכיב סומן בשער נתונים** — 🟢 / 🟡 / 🔴 לפי מה שניתן לחשב היום.                                                                                                                                                                                                 |
| 10 | **נוסף פרק בקרת רעש** — בלעדיו ההרצה הראשונה מייצרת מאות התראות ביום אחד.                                                                                                                                                                          |

---

## 1. מטרת המנוע

### 1.1 המטרה הראשית: שירות ליבה ו-Single Source of Truth

**המנוע אינו מוצר קצה. הוא שירות ליבה (Core Service) שכל שאר המערכת נשענת עליו, והמקור היחיד לאמת בכל הנוגע ללוחות זמנים.**

היום אף סוכן ב-BIDoc לא מסוגל לענות על השאלה "האם המשימה הזו באיחור". סוכן ההתראות מייצר התראת עיכוב רק כאשר בן אדם כתב במסמך שיש עיכוב. משימה שעברה את התאריך שלה בשקט, בלי שאיש דיווח עליה, לא מייצרת שום סימן במערכת.

המנוע נועד לסגור בדיוק את הפער הזה. הוא מספק לכל סוכן שני מספרים שאין לאף אחד מהם היום:

- **`daysLate`** — בכמה ימים הפעילות כבר חרגה.
- **`daysRemaining`** — כמה ימים נותרו לה עד המועד.

מרגע שהמספרים האלה זמינים, סוכן ההתראות יכול לייצר התראה על עיכוב **שאיש לא דיווח עליו**, ולציין בהתראה כמה ימים נותרו לפני שהמשימה תחרוג — במקום להמתין שמישהו יכתוב על כך מייל.

הפירוט המלא של החוזה נמצא ב**פרק 3**, שהוא ליבת המסמך.

### 1.2 שלושת צירי הזמן

המנוע משווה בין שלושה צירים:

| ציר                        | מקור                                                                                                  | מצב היום                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **הציר החוזי** | התחייבויות ואבני דרך מחייבות לפי החוזה ושינויים מאושרים   | 🔴 לא קיים בשום טבלה     |
| **לוח הקבלן**   | הלוח שהקבלן יצר ומעדכן, כולל היסטוריית גרסאות                       | 🟡 גרסה אחת בלבד            |
| **ציר BIDoc**        | ציר שנבנה משוטף ממסמכים, מיילים, דוחות, ישיבות ודיווחי שטח | 🟡 קיים כטקסט לא מובנה |

### 1.3 גבולות אחריות

**המנוע אחראי על:** קליטת שלושת הצירים, התאמת פעילויות בין מקורות, ניהול גרסאות, שמירת אירועי אמת שנצפו, חישוב סטיות ותחזיות, זיהוי סתירות, החזרת אינדיקציה אחידה, ושמירת הסבר וראיות לכל תוצאה.

**המנוע אינו אחראי על:** עריכת קובצי MPP או Primavera, החלפת תוכנת ניהול הפרויקט, אישור משפטי של הארכת זמן, החלטה אוטומטית אם טענת קבלן מוצדקת, יצירת אמת ללא מקור, או שינוי לוח קבלן שהתקבל מהלקוח.

**המנוע גם אינו יוצר התראות בעצמו.** הוא מחזיר אינדיקציה; סוכן ההתראות מחליט מה לעשות איתה. ההפרדה הזו מכוונת — היא מונעת מצב שבו שני רכיבים מייצרים התראות במקביל.

### 1.4 כלל ארכיטקטוני 001

> **Rule 001 — אין לבצע חישובי לוחות זמנים מחוץ ל-Schedule Intelligence Service.**
>
> אף סוכן, אף נוד ב-n8n ואף רכיב UI אינו מחשב באופן עצמאי איחור, ימים שנותרו, חריגה, סטייה או תחזית. כולם פונים לשירות.

הכלל אינו סגנוני. חישוב לו״ז שמתבצע בשני מקומות מייצר שני מספרים שונים לאותה שאלה, ובמערכת שנועדה לשמש בתביעת עיכוב מול קבלן זו חשיפה ממשית.

#### הכלל כבר מופר היום

הפרה קיימת בקוד, ויש לטפל בה כחלק מהמימוש:

```
insightPipeline.js:269   days_past_commitment = max(0, reference - cluster.expected_date)
insightPipeline.js:293   overdue_commitments  = metric(overdue.length, "overdue-commitments-v1")
        ↓
healthScore.js:81        scheduleDimension()  ← ציון "לוח זמנים" בבריאות הפרויקט
healthScore.js:121       flag "commitment_overdue_30d"  (OVERDUE_CRITICAL_DAYS = 30)
```

[`insightPipeline.js`](../src/subagents/insightPipeline.js) גוזר `expected_date` מהתחייבויות שחולצו ממסמכים, ומחשב מהן פיגור. [`healthScore.js`](../src/subagents/healthScore.js) בונה מהן ממד "לוח זמנים" בציון בריאות הפרויקט. **אף אחד משני החישובים האלה לא ראה מעולם את לוח הקבלן.**

התוצאה היא שהמערכת מחזיקה כבר היום שתי אמיתות לו״ז מקבילות ובלתי תלויות. ההפרש ביניהן אינו תיאורטי: `expected_date` מגיע ממה שמישהו הבטיח במסמך, בעוד `finish_date` מגיע מהלוח הפורמלי, והשניים נבדלים כמעט תמיד.

#### מסלול התיישרות

1. **שלב 1–2:** המנוע קם ורץ במקביל. אין נגיעה ב-`insightPipeline` — לא שוברים את מה שעובד.
2. **שלב 3:** `scheduleDimension` ב-`healthScore.js` עובר לצרוך את `GetProjectScheduleHealth` במקום את `overdue_commitments`.
3. **שלב 4:** `days_past_commitment` נשאר, אך מסומן במפורש כ**מדד התחייבויות** ולא כמדד לוח זמנים. השם המטעה משתנה ל-`days_past_stated_commitment`.
4. הפער בין השניים — התחייבות במסמך מול הלוח הפורמלי — הופך בעצמו לממצא מדווח (סעיף 8).

**החזקת שני המדדים לגיטימית. הצגתם כאותו דבר אינה.**

#### ציר שלישי שהתגלה: `project_intelligence_items`

ב-Content DB קיימת תת-מערכת נוספת עם 383 פריטים, ובהם `due_date`, `status`, `date_basis` ו-`confidence` (סעיף 2.1). **היא אינה מפרה את כלל 001** — היא מאחסנת תאריכי יעד אך אינה מחשבת מהם איחור; `needs_attention` נגזר מאיכות הנתונים ולא מחלוף התאריך.

אבל היא ממחישה את אותה בעיה מזווית אחרת: **281 התחייבויות פתוחות עברו את מועדן ואיש אינו יודע.** הפריטים נוצרים, מקבלים תאריך, ונשארים ב-`status = "unknown"` לנצח.

**ההחלטה: היא מזינה את המנוע ואינה מתחרה בו** (סעיף 6.2). הצירים נשארים נפרדים — התחייבות מוואטסאפ אינה משימה בלוח הקבלן — אך שניהם נמדדים באותה אריתמטיקה, ב-`scheduleEngine.js`.

---

## 2. מצב קיים באפליקציה

כל המספרים בפרק זה נמדדו ישירות מול שני המסדים ב-2026-08-04. **סעיף 2.1 הוא מסד היעד** לפי הכרעה 14.1.

### 2.1 Content DB — Kapaim `smxibuaowzuxkznuouwj`

```
projects                              1
gantt_files                           0   ← ריק
gantt_tasks                           0   ← ריק
alerts                            2,178
alert_configurations                 50
data_index                        2,610
emails                            7,163
meetings                            442
daily_work_log                        0   ← ריק
project_intelligence_items          383
project_intelligence_sources        359
project_intelligence_status_events  384
```

#### לוח הקבלן — הסכימה מוכנה, הטבלה ריקה

`gantt_files` ו-`gantt_tasks` קיימות ואף **עשירות יותר** מהגרסאות שב-App DB. `gantt_tasks` כאן כוללת, מעבר לשדות הלו״ז, גם `item_status`, `hashtags`, `summary`, `content`, `metadata` ו-`embedding` — כלומר היא מוכנה לחיפוש סמנטי כמו שאר טבלאות התוכן.

**עדיין אין בה `predecessors`.** סעיף 6.7 חסום ללא קשר לטעינת הדאטה.

#### התראות — 2,178 שורות, אפס אריתמטיקת תאריכים

| `alert_type`          |      כמות |
| ----------------------- | ------------: |
| התראה              |           908 |
| עדכון              |           563 |
| **עיכוב**    | **272** |
| חריג                |           216 |
| איכות              |           176 |
| אירוע בטיחות |            43 |

`alert_configurations` מכילה **50 תצורות** — מטריצה של `alert_type` × `document_type` (meetings, emails, whatsapp, daily-work-log, safety-reports, consultant-reports, quality-control, exceptions, financial-documents, other). `severity_level` משתנה לפי סוג המסמך, ו-`עיכוב` מקבל 4 בעקביות.

**אבל כל 50 התצורות הן שאלות על תוכן מסמך. אף אחת אינה משווה תאריך לתאריך.** גם תצורות ה-`עיכוב` מבקשות לחלץ את המספר מהטקסט:

> "האם החריג כולל ימי ביצוע נוספים, עיכוב, תלות או השפעה על לו״ז? אם כן, **ציין מספר ימים**, גורם העיכוב, השפעה ופעולה נדרשת."

מספר הימים מגיע ממה שמישהו כתב, לא מהשוואה ללוח. זו בדיוק המסקנה של סעיף 1.1, והיא מתקיימת גם בסט המורחב של 50.

#### תשתית מניעת רעש שכבר קיימת בטבלת ההתראות

`alerts` ב-Content DB עשירה משמעותית מ-`alerts_gf`, ומחזיקה שדות שסעיף 3.6 היה אמור להמציא:

| עמודה                    | שימוש למנוע                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `occurrence_group_id`       | קיבוץ הופעות חוזרות — בדיוק "התראה אחת פר פעילות" |
| `lifecycle_status`          | מחזור חיים של התראה — פתיחה, עדכון, סגירה                |
| `analysis_fingerprint`      | idempotency על הניתוח                                                            |
| `configuration_fingerprint` | זיהוי שינוי בתצורה שמצדיק חישוב מחדש                      |
| `alert_configuration_id`    | FK לתצורה שיצרה את ההתראה                                             |
| `is_relevant`               | סינון אנושי                                                                    |
| `data_date`                 | **`timestamptz`** ולא `text` כמו ב-`alerts_gf`                        |

**מסקנה: סעיף 3.6 לא בונה מנגנון דדופליקציה חדש — הוא משתמש בקיים.**

#### ציר ההתחייבויות — `project_intelligence_*`, מאוכלס ופעיל

תת-מערכת שלא הייתה מוכרת לאפיון עד כה, ומחזיקה 383 פריטים:

| `kind`   | `status`  | סה״כ | עם`due_date` | **תאריך היעד חלף** | `needs_attention` |
| ---------- | ----------- | -------: | ---------------: | -----------------------------------: | ------------------: |
| commitment | unknown     |      325 |              245 |                        **245** |                  80 |
| commitment | in_progress |       27 |               26 |                         **26** |                   1 |
| commitment | completed   |       17 |               15 |                                   15 |                   2 |
| commitment | open        |       11 |               11 |                         **10** |                  10 |
| decision   | recorded    |        3 |                0 |                                    0 |                   1 |

**281 התחייבויות פתוחות עברו את תאריך היעד שלהן. רק 91 מסומנות `needs_attention`.** ו-325 מתוך 383 נמצאות בסטטוס `unknown` — המערכת חילצה התחייבות ותאריך יעד, ומעולם לא סגרה את הלולאה.

`needs_attention` **אינו** נגזר מחלוף התאריך; `attention_reasons` מכיל ערכים כמו `missing_owner` ו-`deadline_without_task` — כלומר סיבות איכות-נתונים, לא איחור.

מקור התאריכים:

```
date_basis = whatsapp_structured        236
date_basis = null                        50
date_basis = whatsapp_deadlines_json     11
```

הטבלה גוזרת את רובה המכריע מוואטסאפ, והפריטים הם משימות מיקרו — "לאסוף דוגמאות מקוריות", "לעדכן על חזרה לעבודה בתחום מיזוג וחשמל".

> **זהו ציר ההתחייבויות המוצהרות, לא לוח הקבלן.** הוא קטגורית זהה ל-`expected_date` של [`insightPipeline`](../src/subagents/insightPipeline.js) שנדון בסעיף 1.4: מה שמישהו הבטיח, לא מה שהלוח קובע. הוא **מזין** את המנוע (סעיף 6.2) ואינו מתחרה בו.

הטבלה כוללת `confidence`, `field_confidence` (jsonb), `superseded`, `withdrawn`, `corrected`, `extraction_method`, `extractor_version` ו-`fingerprint` — מודל בשל שסעיף 6.2 יאמץ במקום להגדיר מחדש.

### 2.2 App DB — MAIN `pmdnmzuqbcnzgkuhpfnx`

מסד ההגדרות של הסוכן. **לא מסד היעד**, אבל שם יושבת הדאטה שצריכה לעבור.

```
gantt_files_test              1        ← הדאטה שצריכה לעבור ל-Content DB
gantt_tasks_test            382
alerts_gf                 3,042        ← סט legacy
alert_configurations_gf       4        ← סט legacy, לעומת 50 ב-Content
daily_work_log_gf           176        ← לעומת 0 ב-Content
delay_claim_cases             1
delay_events                  0
delay_schedule_versions       0
delay_schedule_activities     0
```

הקובץ היחיד ב-`gantt_files_test`:

| שדה                         | ערך                         |
| ------------------------------ | ------------------------------ |
| `display_name`               | לוז מעודכן 03.12.25   |
| `file_id`                    | `1776105870763_03.12.25.xml` |
| `start_date` → `end_date` | 2025-09-28 → 2026-04-29       |
| `relevancy_date`             | 2025-12-03                     |
| `task_count`                 | 382                            |

> **הערה קריטית:** הלוח הסתיים ב-2026-04-29. נכון ל-2026-08-04 — **כשלושה חודשים אחרי** — יש בו משימות עם `percent_complete = 0` שתאריך היעד שלהן חלף מזמן, ולא נוצרה עליהן שום התראה. בצירוף 281 ההתחייבויות שעברו את מועדן בסעיף 2.1, זו ההוכחה המעשית לצורך במנוע.

`delay_schedule_activities` כוללת כבר `float_days`, `is_critical`, `duration_days`, `confidence` ו-`human_status`. הסכימה מוכנה, אין בה נתונים. הקוד שכותב אליה: [`delayClaim.js`](../src/subagents/delayClaim.js).

### 2.3 מה חסר

| חסר                                               | השלכה                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **טעינת לוח הקבלן ל-Content DB** | ללא זה המנוע רואה לוח ריק. צעד 8 בסעיף 5.5.                                            |
| טבלת אבני דרך חוזיות                | אין ציר חוזי.`contract_variance_days` לא בר-חישוב.                                            |
| גרסה שנייה של לוח קבלן             | `schedule_slippage_days` ו-`hidden_slippage` לא ברי-חישוב.                                          |
| תלויות בין משימות                     | `gantt_tasks` בשני המסדים ללא `predecessors`. Float, נתיב קריטי והפצה חסומים. |
| `daily_work_log` ריקה ב-Content DB            | מקור הראיות הישיר ביותר לציר BIDoc אינו זמין במסד היעד.                    |
| מיפוי פעילות ↔ מסמך                  | אי אפשר לקשר "עיכוב באספקת אריח" למשימת לו״ז.                                   |
| טבלת Snapshots                                   | אין היסטוריית חישובים ואין Audit.                                                           |
| לוח שנה עבודה                             | חישוב ימי עבודה (א׳–ה׳, חגי ישראל) לא אפשרי.                                      |
| `days_late` / `days_remaining` על התראות | ההתראה לא נושאת מספרים.                                                                         |

### 2.4 ממצא אבטחה שהתגלה בסריקה

ב-Content DB **13 טבלאות עם RLS מושבת** — ביניהן `graph_nodes`, `graph_edges`, `timeline_entities`, `timeline_event_entities`, `timeline_graph_edges` וכל טבלאות `jul_8_backup_*`. טבלה ללא RLS חשופה במלואה לתפקידי `anon` ו-`authenticated`, כלומר לכל מי שמחזיק ב-anon key.

זה **אינו** חלק מהאפיון ואינו נגרם ממנו, אבל הוא רלוונטי לסעיף 5.5 צעד 5: הטבלאות החדשות של המנוע נוצרות עם RLS מופעל, ולכן אינן מצטרפות לרשימה. הטיפול ב-13 הקיימות הוא החלטה נפרדת.

### 2.5 מקרא שערי נתונים

כל רכיב במסמך מסומן:

- 🟢 **מיושם** — קיים בקוד או בדאטה ועובד.
- 🟡 **בר-מימוש היום** — ניתן לבנות עם הדאטה הקיימת, בלי תלות חיצונית.
- 🟠 **חסום-פענוח** — הדאטה **קיימת בקובץ המקור** ואינה נשמרת ל-DB. נפתח בהרחבת הפרסר בקליינט, בלי תלות בקבלן. ראו סעיף 6.1.
- 🔴 **חסום-דאטה** — הנתון אינו קיים בשום מקור. מחייב קלט חיצוני.

---

## 3. חוזה הצריכה לסוכנים

זהו הפרק המרכזי של המסמך.

### 3.1 שלושה מצבי צריכה

המנוע נצרך בשלוש דרכים שונות. ההבחנה ביניהן חיונית — רק אחת מהן מאפשרת לייצר התראה על עיכוב שאיש לא דיווח עליו.

#### מצב א׳ — `lookup` (משיכה נקודתית) 🟡

סוכן מחזיק פעילות ורוצה לדעת מה מצבה.

```
GET /api/schedule/indicator?projectId=...&activityKey=...&asOf=2026-08-04
```

שימוש טיפוסי: הצ׳אט נשאל "מה מצב אישורי החשמל" והסוכן הראשי צריך את המצב העובדתי לפני שהוא מנסח תשובה.

#### מצב ב׳ — `sweep` (סריקה יזומה) 🟡

**זהו המצב שפותח את היכולת שחסרה היום.**

הסוכן אינו יודע מראש איזו פעילות מעניינת אותו. הוא שואל את המנוע *מה חורג*, והמנוע מחזיר רשימה.

```
POST /api/schedule/sweep
{
  "projectId": "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7",
  "asOf": "2026-08-04",
  "filters": {
    "isLate": true,
    "minDaysLate": 1,
    "dueWithinWorkingDays": 7,
    "excludeSummary": true,
    "minConfidence": 0.55
  }
}
```

בלי המצב הזה סוכן ההתראות נשאר תגובתי בלבד — הוא יכול רק להעשיר התראות שכבר נוצרו מטקסט. עם המצב הזה הוא הופך יזום.

#### מצב ג׳ — `enrich` (העשרת מסמך) 🔴

סוכן מחזיק מסמך או התראה בטקסט חופשי ורוצה לצרף אליהם מספרים.

```
POST /api/schedule/evaluate-document
{
  "projectId": "...",
  "documentId": "doc_456",
  "activityCandidates": ["אספקת אריח השלמה", "אודיטוריום"],
  "asOf": "2026-08-04"
}
```

**שער:** חסום עד שקיים מיפוי פעילויות (סעיף 6.3).

### 3.2 הפרימיטיב: `ScheduleIndicator`

כל שלושת המצבים מחזירים את אותו אובייקט. `sweep` מחזיר מערך שלו.

```json
{
  "contractVersion": "schedule-indicator.v1",
  "engineVersion": "schedule-engine.v1",
  "projectId": "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7",
  "asOf": "2026-08-04",
  "calculatedAt": "2026-08-04T17:12:04+03:00",

  "subject": {
    "kind": "activity",
    "activityKey": "gantt:1776105870763_03.12.25.xml:9",
    "name": "אישור גופי תאורה",
    "isSummary": false,
    "isMilestone": false,
    "outlineLevel": 3,
    "sourceType": "contractor_schedule",
    "sourceVersionId": "1776105870763_03.12.25.xml"
  },

  "timing": {
    "plannedStart": "2025-12-02",
    "plannedFinish": "2025-12-21",
    "observedStart": null,
    "observedFinish": null,
    "forecastFinish": null,
    "percentComplete": 0
  },

  "lateness": {
    "isLate": true,
    "daysLate": 226,
    "workingDaysLate": 162,
    "daysRemaining": null,
    "workingDaysRemaining": null,
    "basis": "contractor_planned_finish",
    "basisDate": "2025-12-21"
  },

  "status": "delayed_vs_contractor",

  "variances": {
    "fromContractDays": null,
    "fromCurrentScheduleDays": 226,
    "contractorVersionSlippageDays": null,
    "milestoneImpactDays": null,
    "remainingFloatDays": null
  },

  "confidence": { "score": 0.62, "level": "medium" },

  "impact": {
    "affectsMilestone": null,
    "affectsProjectFinish": null,
    "affectedMilestoneIds": [],
    "affectedActivityIds": []
  },

  "explanation": "תאריך הסיום המתוכנן בלוח הקבלן היחיד שנקלט הוא 2025-12-21. נכון ל-2026-08-04 חלפו 226 ימים קלנדריים (162 ימי עבודה) ואחוז הביצוע המדווח הוא 0. לא נמצאה ראיה לתחילת ביצוע.",

  "evidence": [
    {
      "evidenceId": "gantt:1776105870763_03.12.25.xml:9",
      "kind": "contractor_schedule",
      "filename": "לוז מעודכן 03.12.25",
      "eventDate": "2025-12-21",
      "excerpt": "אישור גופי תאורה — 2025-12-02 עד 2025-12-21, 0% ביצוע"
    }
  ],

  "gates": {
    "contractAxis": "missing",
    "scheduleVersions": 1,
    "dependencies": "missing",
    "observedEvents": "missing"
  }
}
```

#### הגדרות מחייבות

**`basis`** — התאריך שמולו נמדדת החריגה. סדר עדיפויות:

1. `contract_finish` — אם קיימת אבן דרך חוזית מקושרת.
2. `contractor_planned_finish` — אחרת, `finish_date` מהגרסה הנוכחית של לוח הקבלן.
3. `forecast_finish` — אחרת, אם קיימת תחזית.
4. אם אין אף אחד מהם: `status = "insufficient_data"` וכל שדות `lateness` מוחזרים `null`.

**`daysLate`** ו-**`daysRemaining`** הם **סותרים הדדית**. לכל היותר אחד מהם מקבל ערך:

```
אם הפעילות הושלמה (observedFinish קיים):
    daysLate = null
    daysRemaining = null
    completionVariance = observedFinish - basisDate
אחרת אם asOf > basisDate:
    daysLate = asOf - basisDate            (> 0 תמיד)
    daysRemaining = null
אחרת:
    daysLate = null
    daysRemaining = basisDate - asOf       (>= 0)
```

הכלל הזה מחייב. סוכן שמקבל `daysLate = 0` מסיק שהמשימה בזמן — לכן ערך `0` אסור בשדה הזה, ו-`null` הוא הייצוג היחיד ל"לא באיחור".

**`workingDaysLate` / `workingDaysRemaining`** — אותו חישוב לפי לוח שנה עבודה (סעיף 6.6). כאשר לוח השנה לא מוגדר, שני השדות `null` והשדות הקלנדריים בלבד מוחזרים.

**`asOf`** — חובה. ברירת מחדל: התאריך המקומי של הפרויקט מ-[`getProjectDateTime(config.timezone)`](../src/clock.js). אין להשתמש ב-`new Date()` ישירות; אזור הזמן של הפרויקט הוא `Asia/Jerusalem` ולא של השרת.

**דטרמיניזם:** אותו `projectId` + `activityKey` + `asOf` + אותה גרסת דאטה מחזירים תמיד תוצאה זהה בית-בבית.

### 3.3 סוכן ההתראות — הזרימה המלאה

זהו הצרכן העיקרי. הוא צורך את המנוע בשני כיוונים.

#### כיוון א׳ — יזום: יצירת התראות על חריגות שאיש לא דיווח עליהן 🟡

```
סריקה מתוזמנת (יומית)
  │
  ├─ POST /api/schedule/sweep  { asOf: היום, filters: {...} }
  │     → מערך ScheduleIndicator
  │
  ├─ סינון רעש (סעיף 3.6)
  │     → רק אינדיקטורים שעברו סף מהותיות ולא דווחו כבר
  │
  ├─ גזירת חומרה מהמספרים (סעיף 3.4)
  │
  └─ כתיבת שורות ל-schedule_alerts  ← טבלה בבעלות המנוע (סעיף 5.4)
        activity_key · days_late · days_remaining · indicator_snapshot_id
        טבלת alerts של האפליקציה אינה נכתבת ואינה משתנה
```

**זה מה שלא קיים היום.** משימה כמו `אישור גופי תאורה` — 0% ביצוע, תאריך יעד שחלף לפני 226 יום — מייצרת התראה בלי שאיש כתב עליה מילה.

#### כיוון ב׳ — תגובתי: העשרת התראה קיימת 🔴

```
מסמך נכנס
  │
  ├─ ארבע תצורות ההתראה הקיימות רצות כרגיל (ללא שינוי)
  │     → "שקד אבו חצירה עדכן על עיכוב של 3 שבועות באספקת אריח"
  │
  ├─ POST /api/schedule/evaluate-document
  │     activityCandidates: ["אספקת אריח השלמה"]
  │
  └─ אם נמצאה התאמה בביטחון מספק:
        ההתראה נשמרת עם days_late אמיתי ועם קישור למשימה,
        ו-severity_level נגזר מהמספר במקום להיות קבוע 3
```

**שער:** חסום על מיפוי הפעילויות. עד אז כיוון א׳ עובד לבדו, וזה מספיק ל-MVP.

#### כללי שימוש מחייבים לסוכן ההתראות

1. **אין להתריע על `insufficient_data`.** אינדיקטור בלי `basisDate` אינו עדות לעיכוב.
2. **אין להתריע על `is_summary = true`.** משימות סיכום הן ריכוז של ילדיהן; התראה עליהן משכפלת את ההתראות על הילדים.
3. **אין להתריע כאשר `confidence.level = "low"`** אלא אם המשתמש הגדיר אחרת במפורש.
4. **ההתראה חייבת לשאת `indicator_snapshot_id`.** בלעדיו אי אפשר להסביר בדיעבד למה היא נוצרה.
5. **אין לנסח את המספר מחדש בטקסט חופשי.** `days_late` הוא עמודה, לא משפט. הניסוח הלשוני נגזר ממנה, לא להפך.

### 3.4 גזירת חומרה מהמספרים

מחליף את `severity_level` הקבוע. הספים ניתנים להגדרה ברמת פרויקט.

| תנאי                                                               | `severity_level`         |
| ---------------------------------------------------------------------- | -------------------------- |
| אבן דרך חוזית חרגה, או`affectsProjectFinish = true` | 5                          |
| `workingDaysLate > 14`                                               | 4                          |
| `workingDaysLate` בין 1 ל-14                                     | 3                          |
| `workingDaysRemaining <= 3` ו-`percentComplete < 50`              | 3                          |
| `workingDaysRemaining <= 7` ו-`percentComplete < 25`              | 2                          |
| אחרת                                                               | לא מייצר התראה |

### 3.5 סוגי התראה של המנוע

שני סוגים, ב-`schedule_alerts` בלבד. **`alert_configurations` אינה נוגעת בהם** — הם נוצרים ממנוע דטרמיניסטי ולא מ-LLM שקורא מסמך, ולכן אין להם `query_text` ואין להם מקום בטבלת התצורות.

| `alert_type`           | מתי                                                          |
| ------------------------ | --------------------------------------------------------------- |
| `schedule_breach`      | `lateness.isLate = true` ועבר סף מהותיות         |
| `schedule_approaching` | `daysRemaining` מתחת לסף וההתקדמות נמוכה |

הסוג הקיים `עיכוב` ב-`alerts` **נשאר כמות שהוא ואינו נוגע למנוע.** הוא מייצג עיכוב שדווח על ידי בן אדם.

ההבחנה מהותית: "הקבלן הודיע על עיכוב" ו"המשימה חרגה בפועל" הם שני דברים שונים, ולעיתים סותרים. **הפרדת הטבלאות הופכת את ההבחנה למובנית** — אין צורך בעמודת `detected_by` כדי לדעת מי יצר מה. סתירה בין השניים היא בעצמה ממצא (סעיף 8).

### 3.6 בקרת רעש

בלי הפרק הזה ההרצה הראשונה מייצרת מאות התראות באותו יום ומאבדת את אמון המשתמש.

> **המנגנון מוגדר ב-`schedule_alerts` שלנו** (סעיף 5.4) — `occurrence_group_id`, `lifecycle_status`, `materiality_bucket`, `baselined`. הוא **אינו** מסתמך על העמודות בעלות אותם שמות בטבלת `alerts` של האפליקציה; הן נמדדו והיוו השראה לעיצוב, אך מדיניות הבידוד אוסרת להישען עליהן.

**א. אתחול היסטורי (Backlog Bootstrap).** ההרצה הראשונה על פרויקט קיים **אינה** מייצרת התראה פר משימה. היא מייצרת התראת סיכום אחת, ומסמנת את כל שאר החריגות כ-`baselined`. רק חריגות שנוצרות או שמחמירות אחרי האתחול מייצרות התראות.

> על הדאטה הקיימת: הלוח הסתיים ב-2026-04-29 ונכון ל-2026-08-04 חלק ניכר מ-382 המשימות חורגות, ובמקביל 281 התחייבויות ב-`project_intelligence_items` עברו את מועדן. בלי הכלל הזה ההרצה הראשונה מייצרת מאות התראות בבת אחת.

**ב. התראה אחת פר פעילות.** מיושם דרך `occurrence_group_id` — כל החריגות של אותה פעילות חולקות מזהה קבוצה `schedule:{activity_key}`. חריגה שנמשכת אינה מייצרת התראה חדשה בכל יום.

**ג. פתיחה מחדש רק בשינוי מהותי.** התראה קיימת מתעדכנת, ולא נוצרת מחדש, אלא אם:

- החריגה חצתה סף חומרה חדש, **או**
- `daysLate` גדל ביותר מ-`materialChangeDays` (ברירת מחדל: 7 ימי עבודה), **או**
- הסטטוס השתנה מהותית (למשל `at_risk` → `milestone_delayed`).

**ד. סגירה אוטומטית.** כאשר `observedFinish` נקלט או שהפעילות ירדה מהלוח, ההתראה נסגרת עם הסבר ואינה נמחקת.

### 3.7 מפת הצרכנים

v1.1 מנה שישה צרכנים מושגיים. חלקם אינם סוכנים קיימים ברפו — הטבלה ממפה כל אחד לקוד האמיתי שיצרוך את השירות.

| צרכן (v1.1)          | הקוד בפועל                                                                                                                  | מה הוא מקבל                                                                               | מצב                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------ |
| —                       | [`subagents/alert.js`](../src/subagents/alert.js)                                                                                   | **הצרכן העיקרי** — פרק 3.3                                                    | 🟡                       |
| **Chat Agent**     | [`agent.js`](../src/agent.js)                                                                                                       | אינדיקטור לכל פעילות שהוזכרה בשאלה, לפני ניסוח התשובה | 🟡                       |
| **Document Agent** | [`subagents/indexing.js`](../src/subagents/indexing.js) + [`contentAnalysis.js`](../src/subagents/contentAnalysis.js)              | האם הפעילות שזוהתה במסמך בזמן, בסיכון או באיחור             | 🔴 תלוי במיפוי |
| **Mail Agent**     | אין סוכן ייעודי; מיילים נקלטים דרך`indexing` ומוגשים דרך הכלי `emails`                 | האם תוכן המייל משנה תחזית                                                     | 🔴 תלוי במיפוי |
| **Meeting Agent**  | [`subagents/meeting.js`](../src/subagents/meeting.js)                                                                               | עדכון התחייבויות וחסמים → טריגר לחישוב מחדש                   | 🔴 תלוי במיפוי |
| **Insight Agent**  | [`subagents/projectInsights.js`](../src/subagents/projectInsights.js), [`insightPipeline.js`](../src/subagents/insightPipeline.js) | **קורא בלבד** — אינו מחשב לו״ז. ראו סעיף 1.4                     | 🟡                       |
| **Dashboard**      | [`react/InsightsPage.jsx`](../src/react/InsightsPage.jsx), [`healthScore.js`](../src/subagents/healthScore.js)                     | `GetProjectScheduleHealth` במקום `overdue_commitments`                                    | 🟡                       |
| —                       | [`subagents/delayClaim.js`](../src/subagents/delayClaim.js)                                                                         | הציר הכמותי לתיק התביעה; ממלא את`delay_schedule_*`                     | 🔴                       |
| —                       | [`subagents/dataQuery.js`](../src/subagents/dataQuery.js)                                                                           | ראו הסייג להלן                                                                         | 🟡                       |
| —                       | [`qaAgent.js`](../src/qaAgent.js)                                                                                                   | מאמת שתשובות על לוחות זמנים תואמות את האינדיקטור          | 🟡                       |

#### חובת הצ׳אט

**כל שאלה של המשתמש על מצב משימה, עיכובים, חריגות, אבני דרך או תחזיות נשלחת תחילה ל-Schedule Intelligence Service, ורק לאחר מכן הצ׳אט מנסח תשובה.**

הצ׳אט אינו רשאי לענות על שאלת לו״ז מתוך קטע מסמך שנשלף ב-RAG. קטע מסמך מספר מה מישהו *כתב*; האינדיקטור אומר מה *קרה*. כאשר השניים סותרים, התשובה נשענת על האינדיקטור והסתירה מדווחת.

#### הסייג של Data Query

`dataQuery` עונה על שאלות כמותיות ב-SQL ישירות מול הדאטה. שאלה כמו "כמה משימות באיחור" ניתנת למענה ב-SQL — **וזו הפרה של כלל 001**, כי היא מייצרת מספר שני לאותה שאלה.

**מחייב:** שאלה שנופלת תחת קטגוריית לו״ז מנותבת ל-Schedule Intelligence ולא ל-`dataQuery`. הניתוב נעשה במסווג ([`classifier.js`](../src/classifier.js)) ולא בתוך `dataQuery` עצמו. `dataQuery` נשאר אחראי על שאלות כמותיות שאינן לו״ז — כספים, כמויות, ספירות.

---

## 4. ארכיטקטורה בקוד

### 4.1 קבצים

```
src/
  scheduleEngine.js              חישוב דטרמיניסטי טהור. ללא I/O, ללא LLM, ללא Date.now().
                                 כל הפונקציות מקבלות asOf כפרמטר. ניתן לבדיקה מלאה ביוניט.
  scheduleCalendar.js            ימי עבודה, חגים, המרות קלנדרי↔עבודה.
  subagents/
    schedule.js                  תזמור: טעינת נתונים, קריאה למנוע, שמירת Snapshot,
                                 בניית workflowNode ל-runLog.
    scheduleMapping.js           מיפוי פעילות↔מסמך. נשען על graph_nodes/timeline_entities.
    scheduleIngestion.js         קליטת גרסאות לוח ונרמול ל-NormalizedTimelineEntry.
test/
  schedule-engine.test.js        וקטורי בדיקה דטרמיניסטיים
```

**מדוע `scheduleEngine.js` הוא קובץ נפרד וטהור:** זו ההפרדה שגרסה 1.0 הגדירה נכון בסעיף 2.1 ויש לשמר אותה. ה-LLM מחלץ; הוא לא מחשב. חישוב סטייה שעובר דרך מודל שפה אינו ניתן לשחזור ואינו ניתן להגנה מול קבלן.

### 4.2 הפרדת AI מחישוב

| שכבה                       | אחריות                                                                                                                                                   | מותר לה                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **AI Extraction**        | חילוץ מטקסט: שמות פעילויות, תאריכים, התחייבויות, דיווחי התקדמות, חסמים, תלויות מילוליות | להציע ולתת ציון ביטחון |
| **Deterministic Engine** | השוואת תאריכים, סטיות, ימי עבודה, Float, השפעה על אבני דרך, סיווג סטטוס, שקלול ביטחון             | לחשב ולהכריע                   |

ה-AI לעולם אינו קובע את הסטייה הסופית. הוא מייצר קלט מסומן-ביטחון שהמנוע מכריע עליו.

### 4.3 מודל שלושת המסדים

המערכת מולטי-טננטית בשלוש שכבות. המודל אומת מול הדאטה ב-2026-08-04.

```
┌─ Meta DB  (adkouyuuacafabvidtoc)  "Bidoc Meta DB" ─────────── מישור בקרה
│    companies · projects · projects_registry
│    profiles · user_project_roles          ← מאגר המשתמשים וההרשאות
│    company_credentials                    ← ניתוב: company_id → מפתח ה-Content DB
└────────────────────────────────────────────────────────────────────────
                              │  ניתוב לפי חברה
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─ Content DB: Kapaim ────────┐   ┌─ Content DB: MAIN ─────────────────┐
│  smxibuaowzuxkznuouwj       │   │  pmdnmzuqbcnzgkuhpfnx              │
│  חברה: Kapaim               │   │  חברה: חברת בנייה אביב ובניו        │
│  פרויקט: סמל - החושלים 15    │   │  פרויקט: פרויקט כללי                │
│  יש company_credentials     │   │  אין credentials → fallback         │
└─────────────────────────────┘   │  + משמש כ-App DB של הסוכן:          │
                                  │    agent_settings, knowledge        │
                                  └────────────────────────────────────┘
```

**הניתוב הוא ברמת חברה ולא ברמת פרויקט.** `company_credentials(company_id, supabase_service_role_key)` קובע לאיזה Supabase פונים. חברה ללא רשומת credentials נופלת ל-App DB — זהו בדיוק `usesAppSupabase` ב-[`config.js:920`](../src/config.js).

**`projects.id` עקבי בין Meta DB לבין ה-Content DB** ואינו דורש מיפוי (סעיף 14.5).

**MAIN ממלא שני תפקידים בו-זמנית** — App DB של הסוכן, וגם Content DB בפועל של חברת "אביב ובניו" שאין לה credentials. זהו מקור הבלבול שבגללו סעיף 2 נמדד תחילה מול המסד הלא נכון.

> **פתוח:** `BIDOC_META_SUPABASE_URL` מכוון היום ל-MAIN. ההתחברות עובדת משום ש-MAIN מחזיקה עותק `profiles` עם סופראדמין — אבל מאגר המשתמשים הקנוני, כולל `user_project_roles`, נמצא ב-**Meta DB**. יישור זה מחוץ להיקף האפיון, ורשום כחוב.

**החלטה:** כל טבלאות המנוע יושבות ב-**Content DB** של הפרויקט, לצד `gantt_tasks` ו-`alerts`. הן נתוני פרויקט, לא הגדרות מערכת.

**מחייב:**

- כל גישה לדאטה עוברת דרך `contentSupabaseRequest`, לעולם לא דרך `sbFetch` של ה-App DB.
- כל קריאה נושאת `project_id`. אין ברירת מחדל.
- אין להשתמש ב-Service Role של ה-App DB לקריאת נתוני פרויקט.

> **פתוח — ראו סעיף 14.1.** בסביבה המקומית `CONTENT_SUPABASE_URL` לא מוגדר ולכן ה-Content נופל ל-App DB, ושם נמצאות `gantt_*_test`. ב-Kapaim הטבלה `gantt_tasks` קיימת אך ריקה. יש להכריע איזו טבלה קנונית לפני מימוש.

### 4.4 API

הכל תחת `/api/`, בהתאם ל-[`server.js`](../src/server.js). אין `/internal/` במערכת.

| שם לוגי (v1.1)         | Method   | Route                                      | מצב | תיאור                                                                               |
| ---------------------------- | -------- | ------------------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| `GetActivityStatus`        | `GET`  | `/api/schedule/indicator?kind=activity`  | 🟡     | אינדיקטור לפעילות                                                        |
| `GetMilestoneStatus`       | `GET`  | `/api/schedule/indicator?kind=milestone` | 🔴     | אינדיקטור לאבן דרך                                                       |
| —                           | `POST` | `/api/schedule/sweep`                    | 🟡     | סריקת חריגות לפי פילטרים                                            |
| `EvaluateDocument`         | `POST` | `/api/schedule/evaluate-source`          | 🔴     | הערכת מסמך מול הלוח                                                      |
| `EvaluateEmail`            | `POST` | `/api/schedule/evaluate-source`          | 🔴     | אותו מסלול,`sourceType: "email"`                                              |
| `GetProjectScheduleHealth` | `GET`  | `/api/schedule/health`                   | 🟡     | תמונת לו״ז מצטברת ברמת פרויקט                                   |
| —                           | `POST` | `/api/schedule/recalculate`              | 🟡     | חישוב מחדש לפרויקט או לתת-קבוצה                                |
| —                           | `GET`  | `/api/schedule/versions`                 | 🟡     | גרסאות לוח שנקלטו                                                         |
| —                           | `GET`  | `/api/schedule/conditions`               | 🟢     | התניות חוזיות שממתינות לאירוע מפעיל                       |
| —                           | `POST` | `/api/schedule/conditions/resolve`       | 🟢     | איתור אירוע דרך מנוע הצ׳אט וקידום מבוקר לאבן דרך |
| —                           | `POST` | `/api/subagents/schedule`                | 🟡     | הפעלה ישירה מה-UI, בתבנית`/api/subagents/alert`                      |

**החלטה — `EvaluateDocument` ו-`EvaluateEmail` הם מסלול אחד.** v1.1 מנה אותם בנפרד. ההבדל ביניהם הוא בסוג המקור בלבד, לא בלוגיקה: שניהם מקבלים מועמדי פעילות מטקסט ומחזירים אינדיקטורים. מסלול נפרד לכל סוג מקור מוביל ל-`evaluate-meeting`, `evaluate-whatsapp` וכן הלאה. במקום זאת:

```json
POST /api/schedule/evaluate-source
{
  "projectId": "...",
  "sourceType": "email",
  "sourceTable": "emails",
  "sourceId": "8821",
  "activityCandidates": ["אספקת אריח השלמה"],
  "asOf": "2026-08-04"
}
```

`sourceType` נשמר ב-`schedule_observed_events.source_table` ומאפשר לשקלל ביטחון לפי סוג המקור (סעיף 7) — דוח פיקוח חתום אינו שווה בערכו להודעת ווטסאפ.

**`GetProjectScheduleHealth`** מחזיר תמונת פרויקט מצטברת: מספר פעילויות באיחור, סך ימי איחור, החריגה הגדולה ביותר, אבני דרך בסיכון, ותאריך הגרסה האחרונה של הלוח. זהו המסלול שמחליף את `overdue_commitments` בציון בריאות הפרויקט (סעיף 1.4).

**אימות:** ללא שינוי. קריאות same-origin דורשות סשן סופראדמין; קריאות cross-tenant דורשות `x-bidoc-api-secret` ו-`x-content-supabase-url`. השער הקיים ב-[`server.js:160`](../src/server.js) מכסה כל מסלול שאינו `/api/auth/` — אין צורך בשער ייעודי.

**חוזה תשובה:** כל תשובה נושאת `contractVersion: "schedule-indicator.v1"`, בתבנית `data-query.v2`. שינוי שובר → העלאת גרסה.

### 4.5 חישוב מחדש

גרסה 1.0 הניחה Event Bus ותור משימות. אין תשתית כזו במערכת.

**במקום זאת:**

1. **סריקה מתוזמנת** — הרצה יומית של `sweep` על כל פרויקט פעיל. זהו טריגר החישוב העיקרי.
2. **חישוב לפי דרישה** — `POST /api/schedule/recalculate`, מופעל מה-UI או בסיום קליטת גרסת לוח.
3. **חישוב עצל** — `lookup` על פעילות שה-Snapshot שלה ישן מ-TTL מחשב מחדש בזמן אמת.

**אירועים שמחייבים חישוב מחדש:** קליטת גרסת לוח חדשה, קליטת מסמך חדש, זיהוי אירוע התקדמות, שינוי מיפוי פעילות, אישור או דחיית ראיה, עדכון לוח שנה, שינוי אבן דרך חוזית, אישור הארכת זמן, שינוי קשר תלות, עדכון אחוז ביצוע, שינוי סטטוס חסם.

**מחייב:** נעילה פר פרויקט כדי למנוע חישובים מקבילים, `idempotency` על סמך `(projectId, asOf, dataVersion)`, ותיעוד זמן ריצה ומספר פעילויות שחושבו ב-`runLog`.

### 4.6 שרשרת העיבוד

השרשרת מ-v1.1, עם התאמה אחת: **אין שלב Event Publication.** אין תשתית הודעות במערכת, והוספתה רק לצורך זה אינה מוצדקת. במקומה — כתיבת Snapshot, וצריכה במשיכה.

```
מסמך / מייל / ישיבה / דוח יומי
        │
        ▼
  AI Extraction                    ← מחלץ מועמדי פעילות, תאריכים, התקדמות, חסמים
        │                             (מציע בלבד; אינו מחשב)
        ▼
  Schedule Intelligence Service
        │
        ▼
  Timeline Calculation             ← scheduleEngine.js — דטרמיניסטי טהור
        │
        ▼
  Indicator Snapshot               ← schedule_indicator_snapshots
        │
        ├─── sweep  ────────────►  סוכן ההתראות (יזום)
        ├─── lookup ────────────►  צ׳אט, Document, Mail, Meeting
        └─── health ────────────►  Insights, Dashboard
```

#### סדר החישוב הפנימי

1. טעינת הפעילות.
2. טעינת הציר החוזי התקף. 🔴
3. טעינת גרסת לוח הקבלן הנוכחית.
4. טעינת גרסה קודמת לצורך Slippage. 🔴
5. טעינת אירועי BIDoc העדכניים. 🔴
6. בדיקת מיפוי הפעילות. 🔴
7. חישוב תאריך נצפה או חזוי.
8. חישוב סטיות.
9. בדיקת Float וקשרים. 🔴
10. הפצת השפעה לאבני דרך. 🔴
11. סיווג סטטוס.
12. חישוב רמת ביטחון.
13. יצירת הסבר.
14. שמירת Snapshot.

**שלב 15 המקורי — "פרסום אירוע לשאר הסוכנים" — בוטל.** הצרכנים מושכים מה-Snapshot; אין דחיפה.

השלבים המסומנים 🔴 מדולגים בשלב 1–2 של ה-MVP. דילוג על שלב אינו מייצר `null` שקט — הוא נרשם ב-`gates` שבתוך האינדיקטור (סעיף 3.2), כך שהצרכן יודע מה לא נבדק.

---

## 5. מודל נתונים

### 5.1 ההחלטה: מקור מול שכבת ניתוח

| שכבה             | טבלאות                           | תפקיד                                                                                     |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **מקור**   | `gantt_files`, `gantt_tasks`       | הקליטה הגולמית של לוח הקבלן.**לא נגזרת, לא נדרסת.** |
| **מנוע**   | `schedule_*` (חדשות)            | ציר חוזי, אירועים נצפים, מיפוי, Snapshots, לוח שנה               |
| **ניתוח** | `delay_schedule_*`, `delay_events` | תיק תביעה. נטענות**מתוך** המנוע, לא במקומו.               |

המנוע קורא מ-`gantt_tasks`, מחשב, וכותב Snapshot. `delay_schedule_versions` / `delay_schedule_activities` ממשיכות לשרת את [`delayClaim.js`](../src/subagents/delayClaim.js) ומתמלאות מפלט המנוע במקום מ-LLM.

### 5.2 מיפוי `gantt_tasks` למודל האחיד

```
activityKey       = `gantt:${file_id}:${task_uid}`
sourceType        = "contractor_schedule"
sourceVersionId   = file_id
plannedStart      = start_date
plannedFinish     = finish_date
percentComplete   = percent_complete
isSummary         = is_summary
outlineLevel      = outline_level
durationDays      = חישוב מ-start/finish לפי לוח השנה
totalFloatDays    = null        ← אין נתון
predecessors      = []          ← אין נתון
```

**שתי אנומליות שנמדדו ויש לטפל בהן:**

1. **`is_milestone` אינו אמין.** ב-`gantt_tasks_test`, המשימות `צו תחילת עבודה` ו-`קבלת תכנון-אבן דרך א'- בינוי` הן אבני דרך לכל דבר אך מסומנות `is_milestone: false`. **כלל:** פעילות שבה `start_date == finish_date` תטופל כאבן דרך גם אם הדגל כבוי, והמקור לקביעה יירשם ב-`explanation`.
2. **`percent_complete` על משימות סיכום הוא רולאפ משוקלל.** נמדד: `אישורי חשמל` (`is_summary: true`) מציג 9% בעוד ילדיו מציגים 25/0/0/0/23. **כלל:** סטטוס משימת סיכום נגזר מילדיה ולא מחושב ישירות, ומשימות סיכום אינן מייצרות התראות.

### 5.3 טבלאות חדשות

> **CTO lock — existing tables:** All eight Schedule tables in this section already exist. The SQL below is historical schema-reference material only. Do not run the CREATE statements, recreate/copy the tables, or use this section as deployment instructions. Audit the live schema read-only and reuse it. Any additive DDL requires a separate, exact CTO-approved change request.

> לפי [`CLAUDE.md`](../CLAUDE.md): **מיגרציות לעולם אינן רצות מהקוד.** ה-SQL מיועד להרצה ידנית ב-Supabase SQL Editor.

```sql
-- ── הציר החוזי ────────────────────────────────────────────────────────────────
create table if not exists schedule_contract_milestones (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null,
  milestone_key         text not null,   -- מפתח יציב מהסוכן הכותב; בסיס ה-idempotency
  name                  text not null,
  contract_date         date not null,   -- התאריך החוזי המקורי. לעולם לא משתנה.
  is_project_completion boolean not null default false,
  activity_key          text,            -- קישור לפעילות בלוח, אם ידוע
  status                text not null default 'active',
                        -- active | superseded | cancelled
  source_document_id    text,
  source_excerpt        text,            -- הציטוט מהחוזה שממנו נגזר התאריך
  confidence            numeric not null default 1.0,
  written_by            text not null,   -- מזהה הסוכן שכתב את השורה
  extractor_version     text,
  metadata              jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (project_id, milestone_key),
  constraint schedule_contract_milestones_status_ck
    check (status in ('active','superseded','cancelled'))
);

create index if not exists schedule_contract_milestones_active_idx
  on schedule_contract_milestones (project_id, contract_date)
  where status = 'active';

-- ── הארכות זמן מאושרות ────────────────────────────────────────────────────────
-- טבלה נפרדת ולא עמודת סקלר: בפרויקט אמיתי יש כמה הארכות, לכל אחת מסמך,
-- מאשר ותאריך. סקלר בודד מוחק את ההיסטוריה — וזה בדיוק מה שצריך להוכיח בתביעה.
-- append-only.
create table if not exists schedule_contract_extensions (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  milestone_key      text not null,
  extension_days     int not null,
  approved_date      date,
  approved_by        text,
  status             text not null default 'approved',
                     -- approved | claimed | rejected
  source_document_id text,
  source_excerpt     text,
  confidence         numeric not null default 1.0,
  written_by         text not null,
  metadata           jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  constraint schedule_contract_extensions_status_ck
    check (status in ('approved','claimed','rejected'))
);

create index if not exists schedule_contract_extensions_milestone_idx
  on schedule_contract_extensions (project_id, milestone_key, status);

create unique index if not exists schedule_contract_extensions_uk
  on schedule_contract_extensions (project_id, milestone_key, source_document_id, extension_days)
  where source_document_id is not null;

-- ── מאגר התניות ממתינות (סעיף 6.8א) ──────────────────────────────────────────
-- התחייבויות יחסיות שממתינות לאירוע מפעיל ("אישור תוך שבוע משליחת הצעת
-- המחיר"). פתרון תאריך מקדם אותן לשורה ב-schedule_contract_milestones;
-- שורת התניה עצמה לעולם אינה נמדדת על ידי המנוע.
create table if not exists schedule_contract_conditions (
  id                     uuid primary key default gen_random_uuid(),
  project_id             uuid not null,
  condition_key          text not null,
  name                   text not null,
  category               text not null,   -- execution|payment|notice|guarantee|insurance|warranty|other
  anchor_kind            text not null default 'event',
                         -- event | schedule_task | milestone | unspecified
  anchor_description     text not null,   -- העוגן כלשונו: "מרגע שליחת הצעת המחיר"
  offset_value           numeric,
  offset_unit            text,            -- hours|working_days|calendar_days|weeks|months
  recurring              boolean not null default false,
  status                 text not null default 'pending',
                         -- pending | resolved | dismissed | expired
  resolved_milestone_key text,            -- לאן קודמה כשנפתרה
  trigger_source_table   text,
  trigger_source_id      text,
  trigger_event_date     date,
  is_project_completion  boolean not null default false,
  penalty_ils_per_day    numeric,
  source_page            int,
  source_excerpt         text not null,
  confidence             numeric not null default 0.8,
  written_by             text not null,
  metadata               jsonb not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (project_id, condition_key)
);

create index if not exists schedule_conditions_pending_idx
  on schedule_contract_conditions (project_id, status, category);

-- ── ציר BIDoc: אירועים נצפים ──────────────────────────────────────────────────
create table if not exists schedule_observed_events (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  activity_key       text,
  event_type         text not null,
  event_date         date not null,
  progress_percent   numeric,
  confidence         numeric not null default 0.5,
  source_table       text,
  source_id          text,
  source_page        int,
  evidence_text      text,
  human_status       text not null default 'auto',
  created_at         timestamptz not null default now()
);

create index if not exists schedule_observed_events_activity_idx
  on schedule_observed_events (project_id, activity_key, event_date desc);

-- אילוץ חלקי ולא `unique (...)` רגיל: ב-PostgreSQL שני NULL נחשבים שונים זה מזה
-- באילוץ ייחודיות, ולכן אילוץ על עמודות שעשויות להיות NULL אינו מונע כפילויות.
create unique index if not exists schedule_observed_events_source_uk
  on schedule_observed_events (project_id, source_table, source_id, event_type, event_date)
  where source_table is not null and source_id is not null;

-- ── מיפוי פעילויות ────────────────────────────────────────────────────────────
create table if not exists schedule_activity_map (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  canonical_key      text not null,
  alias              text not null,
  alias_source       text not null,
  match_method       text not null,
  confidence         numeric not null default 0.5,
  status             text not null default 'suggested',
  confirmed_by       uuid,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),  -- צעד 3 מחבר אליה טריגר
  unique (project_id, canonical_key, alias, alias_source)
);

-- ── Snapshots ─────────────────────────────────────────────────────────────────
create table if not exists schedule_indicator_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  activity_key       text,
  milestone_key      text,
  as_of              date not null,
  status             text not null,
  days_late          int,
  days_remaining     int,
  working_days_late  int,
  working_days_remaining int,
  basis              text,
  basis_date         date,
  confidence         numeric,
  payload            jsonb not null,
  engine_version     text not null,
  contract_version   text not null default 'schedule-indicator.v1',
  data_version       text,
  calculated_at      timestamptz not null default now(),
  -- Snapshot מתייחס לפעילות או לאבן דרך, לעולם לא לשתיהן ולא לאף אחת מהן.
  constraint schedule_snapshots_subject_ck
    check (num_nonnulls(activity_key, milestone_key) = 1)
);

create index if not exists schedule_snapshots_late_idx
  on schedule_indicator_snapshots (project_id, as_of desc, days_late desc nulls last);

-- שני אינדקסים חלקיים במקום אילוץ ייחודיות אחד. אילוץ שכולל עמודה NULL-able
-- אינו אוכף דבר, ובלעדיהם ניתן לכתוב את אותו Snapshot פעמיים — מה ששובר את
-- ה-idempotency שקריטריון קבלה 1 דורש.
create unique index if not exists schedule_snapshots_activity_uk
  on schedule_indicator_snapshots (project_id, activity_key, as_of, engine_version)
  where activity_key is not null;

create unique index if not exists schedule_snapshots_milestone_uk
  on schedule_indicator_snapshots (project_id, milestone_key, as_of, engine_version)
  where milestone_key is not null;

-- ── לוח שנה עבודה ─────────────────────────────────────────────────────────────
create table if not exists schedule_calendars (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null,
  name               text not null default 'default',
  working_weekdays   int[] not null default '{0,1,2,3,4}',  -- א׳=0 .. ש׳=6, כמו extract(dow)
  holidays           date[] not null default '{}',
  -- עד איזה תאריך רשימת החגים נבדקה. חישוב ימי עבודה שחורג מעבר לתאריך הזה
  -- מסומן כבלתי מהימן — אחרת חג שלא הוזן נספר כיום עבודה ומנפח את workingDaysLate.
  holidays_through   date,
  is_default         boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (project_id, name)
);
```

#### חוזה הכתיבה לציר החוזי

**האפיון הזה מגדיר את הטבלאות בלבד. סוכנים אחרים, מחוץ להיקף המסמך, מזריקים אליהן את הדאטה.** המנוע קורא ואינו כותב.

**מה הסוכן הכותב מספק — עובדות בלבד:**

| שדה                                      |        חובה        | הערה                                                                                                                                            |
| ------------------------------------------- | :---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_id`                              |           ✅           | מזהה Content DB                                                                                                                                 |
| `milestone_key`                           |           ✅           | מפתח יציב. אותה אבן דרך מאותו חוזה חייבת לקבל אותו מפתח בכל הרצה — זה בסיס ה-idempotency |
| `name`                                    |           ✅           |                                                                                                                                                     |
| `contract_date`                           |           ✅           | התאריך החוזי המקורי                                                                                                                |
| `written_by`                              |           ✅           | מזהה הסוכן. בלעדיו אי אפשר לייחס שורה שגויה למקורה                                                         |
| `source_document_id` + `source_excerpt` |       מומלץ       | בלי ציטוט אין Auditability (סעיף 9)                                                                                                  |
| `activity_key`                            |   אופציונלי   | קישור לפעילות בלוח.**בלעדיו `milestone_impact_days` לא בר-חישוב**                                            |
| `confidence`                              | ברירת מחדל 1.0 | להוריד כשהתאריך נגזר מפרשנות ולא מציטוט מפורש                                                                |

**עדכון אבן דרך מתבצע ב-`upsert` על `(project_id, milestone_key)`.** תאריך שהשתנה בעקבות תיקון חוזי אינו יוצר שורה חדשה — הוא מעדכן את הקיימת. שורה שאינה רלוונטית עוד מסומנת `status = 'superseded'` ואינה נמחקת.

**הארכות זמן נכתבות ל-`schedule_contract_extensions` ולעולם לא כעדכון של `contract_date`.** `contract_date` הוא עובדה היסטורית קפואה; הארכה היא אירוע נפרד עם מסמך ומאשר משלו.

#### למה אין עמודת `effective_date`

הגרסה הקודמת של הסעיף הגדירה `effective_date` כעמודה מחושבת. **היא הוסרה.**

```
effective_date = contract_date + Σ(extension_days where status = 'approved')
```

זהו **חישוב לוח זמנים**, ולכן לפי כלל 001 (סעיף 1.4) הוא שייך ל-`scheduleEngine.js` בלבד. אחסונו כעמודה היה מייצר מקור אמת שני שאפשר לו לסטות — בדיוק הכשל שכלל 001 נועד למנוע.

המנוע מחשב אותו בזמן קריאה ומחזיר אותו בתוך `ScheduleIndicator.lateness.basisDate` עם `basis = "contract_finish"`.

**החלוקה עקבית עם סעיף 4.2:** הסוכן הכותב מחלץ עובדות מטקסט. המנוע מחשב.

### 5.4 טבלת ההתראות של המנוע

#### מדיניות בידוד — מחייבת

> **המנוע אינו משנה ואינו כותב לאף טבלה שהאפליקציה כותבת אליה.**
>
> לא `ALTER`, לא `INSERT`, לא `UPDATE`. `alerts`, `gantt_files`, `gantt_tasks`, `project_intelligence_items`, `data_index`, `daily_work_log`, `emails`, `meetings` — **קריאה בלבד**.

גרסה קודמת של הסעיף הרחיבה את `alerts` בשש עמודות. **בוטל.** `alerts` נכתבת על ידי מנגנון יצירת ההתראות של האפליקציה, ולכן היא מחוץ לתחום.

המנוע מחזיק טבלת פלט משלו.

```sql
create table if not exists schedule_alerts (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null,
  activity_key          text not null,
  alert_type            text not null,
                        -- schedule_breach | schedule_approaching
  severity_level        smallint not null,
  days_late             int,
  days_remaining        int,
  working_days_late     int,   -- השוואת שינוי מהותי (3.6ג) נעשית בימי עבודה
  working_days_remaining int,
  indicator_snapshot_id uuid not null,
  title                 text not null,
  description           text not null,

  -- מחזור חיים ובקרת רעש (סעיף 3.6). מוגדרים כאן במלואם ואינם
  -- מסתמכים על occurrence_group_id / lifecycle_status של טבלת alerts.
  occurrence_group_id   text not null,
  lifecycle_status      text not null default 'open',
                        -- open | updated | resolved | dismissed
  baselined             boolean not null default false,
  materiality_bucket    int,
  first_detected_at     date not null,
  last_evaluated_at     date not null,
  resolved_at           date,
  resolution            text,

  reviewed_by           uuid,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint schedule_alerts_type_ck
    check (alert_type in ('schedule_breach','schedule_approaching')),
  constraint schedule_alerts_lifecycle_ck
    check (lifecycle_status in ('open','updated','resolved','dismissed')),
  -- אכיפת כלל 3.2 ברמת המסד: days_late = 0 אסור, ושני השדות לא מלאים יחד
  constraint schedule_alerts_numbers_ck
    check ((days_late is null or days_late > 0)
           and num_nonnulls(days_late, days_remaining) <= 1)
);

-- התראה פתוחה אחת לכל פעילות וסוג. הבסיס לכלל 3.6ב.
create unique index if not exists schedule_alerts_open_uk
  on schedule_alerts (project_id, activity_key, alert_type)
  where lifecycle_status in ('open','updated');

create index if not exists schedule_alerts_triage_idx
  on schedule_alerts (project_id, lifecycle_status, severity_level desc, days_late desc nulls last);
```

#### מה השתנה בעקבות המדיניות

| היה                                                                                | עכשיו                                                                                                              |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `detected_by = 'schedule_engine'` בטבלת `alerts`                             | **מיותר.** הפרדה מוחלטת — כל שורה ב-`schedule_alerts` היא מהמנוע, בהגדרה |
| שימוש חוזר ב-`occurrence_group_id` ו-`lifecycle_status` הקיימים | מוגדרים כאן במלואם                                                                                      |
| `alerts_activity_idx` על טבלת `alerts`                                      | `schedule_alerts_open_uk` על הטבלה שלנו                                                                    |

**סוגי ההתראה עברו לאנגלית** — `schedule_breach` ו-`schedule_approaching` במקום `חריגה מלו״ז` ו-`לו״ז מתקרב`. הערכים העבריים היו נחוצים כדי להשתלב ב-`alert_configurations` הקיימת; משאין שילוב, מפתח יציב עדיף על טקסט מוצג. התרגום לעברית נעשה ב-UI.

#### המחיר, במפורש

**התראות המנוע לא יופיעו במסך ההתראות של אפליקציית BiDoc.** הן מוצגות במסכי סעיף 15 בבק-אופיס בלבד.

זו תוצאה ישירה של המדיניות ולא פשרה טכנית. אם יידרש שילוב עתידי, הוא ייעשה בקריאה מ-`schedule_alerts` על ידי האפליקציה — לא בכתיבה שלנו אליה.

> `alerts_gf` ב-App DB היא סט legacy. אין להריץ עליה דבר.

---

### 5.5 Runbook מיגרציה

#### שני פרופילים, אותו runbook

המנוע אינו קשור לטבלה מסוימת (סעיף 14.1). ה-runbook רץ מול **הפרופיל הפעיל**, ואותם צעדים בדיוק חלים על שניהם:

|                                 | פרופיל`dev`                         | פרופיל`content`                                   |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| **מסד**                | MAIN —`pmdnmzuqbcnzgkuhpfnx`             | Content DB של הפרויקט —`smxibuaowzuxkznuouwj` |
| **טבלת קבצים**   | `gantt_files_test`                        | `gantt_files`                                           |
| **טבלת משימות** | `gantt_tasks_test`                        | `gantt_tasks`                                           |
| **מצב הדאטה**     | **382 שורות, זמין היום** | ריק — תלוי בשרשרת קליינט→DB          |
| **מתי**                | פיתוח ובדיקות עכשיו        | הפעלה בפרודקשן                               |

**הפרופיל נקבע בהגדרות ולא בקוד:**

```json
"schedule": {
  "sourceProfile": "dev",
  "filesTable": "gantt_files_test",
  "tasksTable": "gantt_tasks_test",
  "useContentDb": false
}
```

`scheduleIngestion.js` הוא **הרכיב היחיד שקורא את ההגדרה הזו**. `scheduleEngine.js` מקבל מערך משימות מנורמל ואינו יודע מאיזו טבלה הוא הגיע (סעיף 4.1). מעבר מ-`dev` ל-`content` הוא שינוי הגדרה, לא שינוי קוד.

#### כללי הרצה

|                             |                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **אופן הרצה** | ידנית ב-Supabase SQL Editor. לעולם לא מהקוד ([`CLAUDE.md`](../CLAUDE.md))                                      |
| **חזרתיות**    | **פר מסד.** להריץ פעם אחת על MAIN לפיתוח, ופעם נוספת על כל Content DB בפרודקשן |
| **סדר**            | הצעדים תלויים זה בזה. אין לדלג                                                                            |

טבלאות המנוע (`schedule_*`) נוצרות **באותו מסד שבו יושב המקור הפעיל**. Snapshot חייב לשבת ליד הלוח שהוא מתאר; פיצול בין מסדים שובר את ה-FK ואת האפשרות לשאילתת join.

כל צעד כולל שאילתת אימות. אין להמשיך לצעד הבא לפני שהאימות עבר.

> **רישום ביצוע — MAIN (פרופיל `dev`), 2026-08-05:** ה-runbook הורץ במלואו כמיגרציה `schedule_intelligence_runbook_v1`. אימות 9a: `7 | 5 | 3 | 7`. צעד 6: `alerts` ללא עמודות מנוע ו-582 שורות ללא שינוי. צעד 7: לוח שנה א׳–ה׳ נזרע לפרויקט `652bf3e0…` עם `holidays_through = null`. צעד 9b/9c: כפילות Snapshot נחסמה ואילוץ הנושא אכף את שני הכיוונים. **Content DB (Kapaim) טרם הורץ** — יידרש לפני מעבר לפרופיל `content`.
>
> **תוספת — 2026-08-05 (מאוחר יותר):** מיגרציה `schedule_contract_conditions_pool` הוסיפה את טבלת ההתניות (סעיף 6.8א) — סה"כ 8 טבלאות מנוע ב-MAIN. יובאו 76 התניות מרישום חוזה סמל (חילוץ סוכן חיצוני, `written_by='external_agent_csv'`). בהרצה עתידית של ה-runbook יש לכלול גם טבלה זו (טריגר `updated_at` + RLS).

---

#### צעד 0 — בדיקות מוקדמות

לפני כל שינוי, לוודא שאנחנו על המסד הנכון ושהסכימה הקיימת היא מה שאנחנו מניחים.

```sql
-- 0a. זיהוי הפרופיל שעליו אתה נמצא בפועל.
-- dev     → gantt_tasks_test קיימת (MAIN)
-- content → רק gantt_tasks קיימת
-- ודא שהתוצאה תואמת לפרופיל שהתכוונת אליו לפני שממשיכים.
select to_regclass('public.gantt_tasks_test') as dev_profile,
       to_regclass('public.gantt_tasks')      as content_profile;

-- 0b. אילו טבלאות רלוונטיות קיימות
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('projects','gantt_files','gantt_tasks','alerts','daily_work_log')
order by table_name;

-- 0c. סכימת ה-Gantt הקיימת
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name in ('gantt_files','gantt_tasks')
order by table_name, ordinal_position;

-- 0d. ספירות פתיחה — לתיעוד לפני/אחרי
select 'gantt_files' as t, count(*) from gantt_files
union all select 'gantt_tasks',                count(*) from gantt_tasks
union all select 'alerts',                     count(*) from alerts
union all select 'alert_configurations',       count(*) from alert_configurations
union all select 'project_intelligence_items', count(*) from project_intelligence_items
order by 1;
```

**ערכי ייחוס שנמדדו ב-2026-08-04 מול Kapaim:**

```
alert_configurations         50
alerts                    2,178
gantt_files                   0
gantt_tasks                   0
project_intelligence_items  383
```

**סכימת `gantt_tasks` ב-Content DB אומתה והיא תקינה** — ואף עשירה מזו שב-App DB:

```
project_id | file_id | task_uid | task_name | start_date | finish_date
percent_complete | is_summary | is_milestone | outline_level
+ item_status | hashtags | summary | content | metadata | embedding
```

**אין צורך להוסיף עמודות.** ששת השדות הנוספים מיועדים לחיפוש סמנטי ואינם נדרשים למנוע. עדיין אין `predecessors` — סעיף 6.7 נשאר חסום.

**עצירה:** אם 0c מגלה שהסכימה השתנתה מאז המדידה — לעצור ולעדכן את סעיף 5.2 לפני שממשיכים. אין ליצור או לשנות את `gantt_tasks` בסקריפט הזה; היא בבעלות נתיב הקליטה, לא המנוע.

---

#### צעד 1 — פונקציית `updated_at`

שלוש מהטבלאות מגדירות `updated_at`. בלי טריגר הערך נשאר קפוא על זמן היצירה.

```sql
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

**אימות:**

```sql
select proname from pg_proc where proname = 'set_updated_at';
```

---

#### צעד 2 — יצירת הטבלאות

להריץ את ששת ה-`create table` מסעיף 5.3 **ואת `schedule_alerts` מסעיף 5.4** — כלשונם ובסדר שבו הם מופיעים, כולל האינדקסים והאינדקסים החלקיים.

**אימות:**

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like 'schedule\_%'
order by table_name;
-- מצופה: 7 שורות
```

```sql
-- אימות שהאינדקסים החלקיים אכן נוצרו. בלעדיהם ה-idempotency ובקרת הרעש שבורים.
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in ('schedule_snapshots_activity_uk',
                    'schedule_snapshots_milestone_uk',
                    'schedule_observed_events_source_uk',
                    'schedule_contract_extensions_uk',
                    'schedule_alerts_open_uk');
-- מצופה: 5 שורות
```

---

#### צעד 3 — חיבור הטריגרים

```sql
drop trigger if exists set_updated_at on schedule_contract_milestones;
create trigger set_updated_at before update on schedule_contract_milestones
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on schedule_activity_map;
create trigger set_updated_at before update on schedule_activity_map
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on schedule_alerts;
create trigger set_updated_at before update on schedule_alerts
  for each row execute function set_updated_at();
```

> `schedule_observed_events`, `schedule_indicator_snapshots`, `schedule_contract_extensions` ו-`schedule_calendars` הן append-only ואין להן `updated_at`. Snapshot אינו מתעדכן — נוסף חדש (סעיף 9). `schedule_alerts` **כן** מתעדכנת, כי התראה נמשכת מתעדכנת ואינה נוצרת מחדש (סעיף 3.6ג).

**אימות:**

```sql
select event_object_table, trigger_name
from information_schema.triggers
where trigger_name = 'set_updated_at'
order by event_object_table;
-- מצופה: 3 שורות
```

---

#### צעד 4 — מפתחות זרים ל-`projects`

**מותנה.** להריץ רק אם צעד 0b מצא טבלת `projects`.

```sql
select to_regclass('public.projects');
```

אם החזיר ערך שאינו `null`:

```sql
alter table schedule_contract_milestones
  add constraint schedule_contract_milestones_project_fk
  foreign key (project_id) references projects(id) on delete cascade;

alter table schedule_observed_events
  add constraint schedule_observed_events_project_fk
  foreign key (project_id) references projects(id) on delete cascade;

alter table schedule_activity_map
  add constraint schedule_activity_map_project_fk
  foreign key (project_id) references projects(id) on delete cascade;

alter table schedule_indicator_snapshots
  add constraint schedule_indicator_snapshots_project_fk
  foreign key (project_id) references projects(id) on delete cascade;

alter table schedule_calendars
  add constraint schedule_calendars_project_fk
  foreign key (project_id) references projects(id) on delete cascade;
```

אם `projects` אינה קיימת ב-Content DB: **לדלג**, ולרשום זאת כחוב. `project_id` נשאר `not null` ונאכף באפליקציה.

---

#### צעד 5 — RLS

```sql
alter table schedule_contract_milestones  enable row level security;
alter table schedule_contract_extensions  enable row level security;
alter table schedule_observed_events      enable row level security;
alter table schedule_activity_map         enable row level security;
alter table schedule_indicator_snapshots  enable row level security;
alter table schedule_calendars            enable row level security;
alter table schedule_alerts               enable row level security;
```

**במכוון לא מוגדרת אף מדיניות.** RLS פעיל ללא policy משמעו דחייה מלאה של `anon` ו-`authenticated`, בעוד `service_role` עוקף RLS מעצם הגדרתו. זו בדיוק ההתנהגות הרצויה: רק השרת ניגש לטבלאות האלה, והדפדפן לעולם לא.

**אין להוסיף policy ל-`authenticated`** לפני שמודל ההרשאות של הפרויקט אומת. Policy רחבה מדי כאן חושפת נתוני לו״ז של פרויקט אחד למשתמשי פרויקט אחר.

**אימות:**

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'schedule\_%';
-- מצופה: rowsecurity = true בכל חמש
```

```sql
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename like 'schedule\_%';
-- מצופה: 0 שורות
```

---

#### צעד 6 — אימות שטבלת `alerts` לא נגעה

**הצעד הזה אינו משנה דבר. הוא מאמת שלא שינינו.**

הגרסה הקודמת של ה-runbook הריצה כאן שישה `ALTER` על `alerts`. **בוטל** בעקבות מדיניות הבידוד (סעיף 5.4). `schedule_alerts` נוצרה כבר בצעד 2.

```sql
-- 6a. הטבלה שלנו קיימת
select to_regclass('public.schedule_alerts') as must_exist;
```

```sql
-- 6b. טבלת האפליקציה נקייה מכל עמודה שהמנוע היה עשוי להוסיף.
-- כל תוצאה שאינה 0 פירושה שהרצת גרסה ישנה של הצעד הזה — ראה rollback בצעד 10.
select count(*) as must_be_zero
from information_schema.columns
where table_schema = 'public' and table_name = 'alerts'
  and column_name in ('activity_key','days_late','days_remaining',
                      'indicator_snapshot_id','detected_by','baselined');
```

```sql
-- 6c. ספירת ההתראות הקיימות — חייבת להישאר זהה לצעד 0d לאורך כל ה-runbook
select count(*) from alerts;
```

---

#### צעד 7 — לוח שנה ברירת מחדל

```sql
insert into schedule_calendars
  (project_id, name, working_weekdays, holidays, holidays_through, is_default)
values
  ('<PROJECT_UUID>', 'default', '{0,1,2,3,4}', '{}', null, true)
on conflict (project_id, name) do nothing;
```

`working_weekdays` בקידוד `extract(dow)`: `0` ראשון עד `6` שבת. `{0,1,2,3,4}` הוא שבוע עבודה א׳–ה׳.

> **`holidays_through = null` הוא מכוון ומשמעותי.** כל עוד רשימת החגים ריקה, חג נספר כיום עבודה ו-`workingDaysLate` יוצא **מנופח**. המנוע מחויב לסמן חישוב שחורג מעבר ל-`holidays_through` כבלתי מהימן ולהוריד `confidence`. מילוי החגים הוא משימה תפעולית שנתית, לא משימת פיתוח.

**אימות:**

```sql
select project_id, name, working_weekdays, holidays_through, is_default
from schedule_calendars;
```

---

#### צעד 8 — אימות מקור הלוח

**אין העברת דאטה בין מסדים.** בפרופיל `dev` הלוח כבר קיים; בפרופיל `content` הוא מגיע מהקליינט. בשני המקרים הצעד הזה הוא **אימות בלבד**.

| פרופיל | מצב                                 | פעולה                                                                                                                                  |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`      | 382 שורות ב-`gantt_tasks_test` | אין פעולה. עבור לאימות.                                                                                                   |
| `content`  | ריק                                 | הקליינט מעלה XML, מפרסר וכותב ל-`gantt_files` / `gantt_tasks`. **הצעד ממתין לשרשרת הזו.** |

> **אין להעביר שורות ידנית מ-`_test` ל-Content DB.** מעבר לכך שזה עוקף את נתיב הפענוח, ה-382 שורות שייכות לפרויקט `652bf3e0…` של חברת "אביב ובניו" — לא לפרויקט של Kapaim (סעיף 14.5). העברה תשייך לוח של פרויקט אחד לפרויקט אחר.

**אימות** — החלף `<TASKS>` ו-`<FILES>` בשמות הטבלאות של הפרופיל:

```sql
select count(*) from <TASKS>;   -- dev: 382
select count(*) from <FILES>;   -- dev: 1
select min(start_date), max(finish_date) from <TASKS>;
-- dev: 2025-09-28 .. 2026-04-29
```

```sql
-- שתי אנומליות הדאטה מסעיף 5.2 — יש לוודא ששתיהן קיימות בכל מקור
select count(*) from <TASKS> where start_date = finish_date and is_milestone = false;
-- מצופה: > 0 — אבני דרך שהדגל שלהן כבוי

select count(*) from <TASKS> where is_summary = true;
-- מצופה: > 0 — אלה לא מייצרות התראות
```

**עצירה:** אם `count` הוא 0 בפרופיל `content` — השרשרת קליינט→DB לא סגרה. אין לעקוף זאת בטעינה ידנית; יש לתקן את השרשרת. המנוע יחזיר `sweep` ריק עד שתיסגר.

---

#### צעד 9 — אימות מקצה לקצה

```sql
-- 9a. מבנה שלם
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name like 'schedule\_%')          as tables,
  (select count(*) from pg_indexes
     where schemaname='public' and indexname like 'schedule\_%\_uk')          as unique_idx,
  (select count(*) from information_schema.triggers
     where trigger_name='set_updated_at')                                     as triggers,
  (select count(*) from pg_tables
     where schemaname='public' and tablename like 'schedule\_%' and rowsecurity) as rls;
-- מצופה: 7 | 5 | 3 | 7
```

```sql
-- 9b. הוכחת ה-idempotency. הכנסה כפולה של אותו Snapshot חייבת להיכשל.
insert into schedule_indicator_snapshots
  (project_id, activity_key, as_of, status, payload, engine_version)
values
  ('<PROJECT_UUID>', 'test:idempotency', current_date, 'on_track',
   '{}'::jsonb, 'schedule-engine.v1');

-- ההרצה השנייה של אותה פקודה חייבת להחזיר:
-- ERROR: duplicate key value violates unique constraint "schedule_snapshots_activity_uk"

delete from schedule_indicator_snapshots where activity_key = 'test:idempotency';
```

```sql
-- 9c. הוכחת אילוץ הנושא. שתי הפקודות חייבות להיכשל.
insert into schedule_indicator_snapshots
  (project_id, as_of, status, payload, engine_version)
values ('<PROJECT_UUID>', current_date, 'on_track', '{}'::jsonb, 'schedule-engine.v1');
-- ERROR: schedule_snapshots_subject_ck  (אף נושא לא צוין)

insert into schedule_indicator_snapshots
  (project_id, activity_key, milestone_key, as_of, status, payload, engine_version)
values ('<PROJECT_UUID>', 'a', 'm', current_date, 'on_track', '{}'::jsonb, 'schedule-engine.v1');
-- ERROR: schedule_snapshots_subject_ck  (שני נושאים)
```

**צעד 9b הוא קריטריון קבלה 1 בפועל.** אם ההכנסה הכפולה מצליחה — האינדקסים החלקיים לא נוצרו, ויש לחזור לצעד 2.

---

#### צעד 10 — Rollback

> **DO NOT EXECUTE THIS HISTORICAL ROLLBACK.** The Schedule tables now exist and may contain configuration, snapshots, alerts, mappings, evidence, and human review state. The DROP statements below are reference-only and are superseded by the CTO lock dated 2026-08-08. Any real rollback requires a new, non-destructive, data-preserving plan and explicit approval.

```sql
-- כל טבלאות המנוע. זהו ה-rollback המלא.
drop table if exists schedule_alerts              cascade;
drop table if exists schedule_indicator_snapshots cascade;
drop table if exists schedule_activity_map        cascade;
drop table if exists schedule_observed_events     cascade;
drop table if exists schedule_contract_extensions cascade;
drop table if exists schedule_contract_milestones cascade;
drop table if exists schedule_calendars           cascade;
drop function if exists set_updated_at();
```

**ה-rollback בטוח לחלוטין ואינו נוגע באף טבלה של האפליקציה.** זהו הרווח הישיר ממדיניות הבידוד: `alerts`, `gantt_*`, `project_intelligence_*` וכל השאר אינם מופיעים כאן, כי מעולם לא נגענו בהן.

מה שאובד: התראות המנוע וה-Snapshots. שניהם **נגזרים** וניתנים לחישוב מחדש מהמקורות — למעט `reviewed_by` / `resolution` שהם קלט אנושי. אם היו הכרעות ידניות, כדאי לייצא את `schedule_alerts` לפני ההרצה.

```sql
-- rollback היסטורי — רק אם הרצת גרסה ישנה של צעד 6 שהוסיפה עמודות ל-alerts.
-- צעד 6b מזהה זאת. ⚠️ מוחק את הערכים שנכתבו לעמודות האלה.
alter table alerts drop constraint if exists alerts_schedule_numbers_ck;
drop index if exists alerts_activity_idx;
alter table alerts drop column if exists activity_key;
alter table alerts drop column if exists days_late;
alter table alerts drop column if exists days_remaining;
alter table alerts drop column if exists indicator_snapshot_id;
alter table alerts drop column if exists detected_by;
alter table alerts drop column if exists baselined;
```

> `gantt_tasks` ו-`gantt_files` אינן חלק מה-rollback. הן מקור, לא נגזרת, ואינן בבעלותנו.

---

## 6. רכיבי המנוע

### 6.1 Schedule Ingestion Service 🟡

#### נתיב הקליטה הקיים — אומת 2026-08-04, והוא אינו מה שהונח

**האפליקציה אינה כותבת את לוח הזמנים לשום טבלה. היא שומרת את ה-XML ב-Storage וה-UI מפענח אותו בדפדפן.**

שרשרת הראיות:

| # | ממצא                                                                                                                                                                          |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | העלאה שבוצעה ב-2026-08-04 18:38 UTC יצרה אובייקט ב-**Meta DB**: `assets/gantt/81b1cbac…/1785868733109_MS_Project_24.12.23.xml`, 232,902 בתים |
| 2 | ל-Meta DB**אין טבלאות gantt כלל** — 12 טבלאות בסך הכל, כולן מישור בקרה                                                               |
| 3 | `gantt_files` / `gantt_tasks` ב-Kapaim: 0 שורות, מעולם לא נכתבו                                                                                             |
| 4 | `gantt_tasks_test` ב-MAIN: נכתבה לאחרונה 2026-04-13, ללא שינוי מאז                                                                                      |
| 5 | ה-UI מציג 102 משימות מקובץ שאין לו ולו שורה אחת באף מסד                                                                                     |

מבנה הנתיב ב-Storage:

```
bucket: assets
path:   gantt/{project_id}/{epoch_ms}_{original_filename}
```

**מסקנה: קיימות שתי גרסאות התנהגות.** הקובץ הישן (`1776105870763_03.12.25.xml`, 3.2MB) יושב ב-Storage של MAIN **וגם** נשמר ל-`gantt_*_test` — כלומר גרסה קודמת של האפליקציה כן התמידה לטבלאות. הגרסה הנוכחית מעלה ל-Storage בלבד.

#### חלוקת האחריות

**הפענוח מתבצע בקליינט והתוצאה נשמרת ב-DB. המנוע הוא השכבה השנייה מעל זה.**

```
קליינט:  XML → Storage (assets/gantt/{project_id}/…) → פענוח → gantt_files / gantt_tasks
                                                                      │
בק-אופיס:                                              scheduleEngine ┘  ← אנחנו
```

**המנוע אינו מפענח XML ואינו ניגש ל-Storage.** הוא קורא `gantt_tasks` בלבד. אין לבנות פרסר MS Project ברפו הזה.

#### מה יושב בקובץ המקור ונזרק בפענוח

**נמדד ישירות על `1776105870763_03.12.25.xml` (3.2MB, 383 בלוקי `<Task>`) ב-2026-08-04.** הקובץ הורד מ-Storage ונסרק. זה מה שקיים בו:

| שדה ב-XML                                          |                      מופעים | נשמר ל-DB? | מה זה פותח                                                   |
| ------------------------------------------------------ | --------------------------------: | :-------------: | -------------------------------------------------------------------- |
| `PredecessorLink` + `PredecessorUID` + `LinkLag` | **475** ב-311 משימות |       ❌       | **כל סעיף 6.7** — תלויות, הפצת עיכובים |
| `TotalSlack`                                         |                               383 |       ❌       | Float כולל, לכל משימה                                    |
| `FreeSlack`                                          |                               383 |       ❌       | Float חופשי                                                     |
| `Critical`                                           |                               383 |       ❌       | **נתיב קריטי מחושב מראש**                    |
| `ActualStart`                                        |                               170 |       ❌       | ציר ביצוע בפועל, ישירות מהלוח                |
| `ActualFinish`                                       |                                89 |       ❌       | סגירת פעילויות ודאית                               |
| `ActualDuration`                                     |                               383 |       ❌       | קצב ביצוע                                                    |
| `WBS` + `OutlineNumber`                            |                               383 |       ❌       | **מיפוי פעילויות** (סעיף 6.3)                 |
| `Duration`                                           |                               385 |       ❌       | משך מתוכנן                                                  |
| `ConstraintType` / `ConstraintDate`                |                          383 / 48 |       ❌       | אילוצי תאריך                                              |
| `EarlyStart` / `LateFinish`                        |                               383 |       ❌       | ערכי CPM                                                         |
| `Calendar` + `WeekDay` + `Exception`             |                        2 / 16 / 2 |       ❌       | **לוח שנה עבודה כולל חגים** (סעיף 6.6)  |
| `Assignment`                                         |                               328 |       ❌       | משאבים                                                         |
| `Baseline`                                           |                       **0** |       —       | **הדבר היחיד שבאמת חסר**                      |

**המסקנה משנה את רוב שערי הנתונים במסמך.** מה שסומן עד כה 🔴 "חסום-דאטה" אינו חסום בדאטה — **הדאטה קיימת בקובץ ונזרקת בפענוח.** הפרסר של הקליינט שומר 10 עמודות מתוך עשרות.

זו אינה בקשה מהקבלן ואינה תלויה בגורם חיצוני. זו הרחבה של מה שהפרסר כבר קורא.

#### הבקשה המדויקת להרחבת הפענוח

לפי סדר תשואה:

1. **`PredecessorLink`** → טבלת קשרים חדשה. פותח לבדו את 6.7, את ה-Float ואת הנתיב הקריטי.
2. **`TotalSlack` / `FreeSlack` / `Critical`** → שלוש עמודות ב-`gantt_tasks`. חוסכות חישוב CPM עצמאי — MS Project כבר חישב.
3. **`ActualStart` / `ActualFinish`** → שתי עמודות. **170 ו-89 ערכים אמיתיים** שהופכים חלק מציר BIDoc ממיותר.
4. **`WBS`** → עמודה אחת. משפרת מהותית את מיפוי הפעילויות.
5. **`Calendar` / `Exception`** → מזין את `schedule_calendars` במקום הזנה ידנית של חגים.

`Baseline` נעדר מהקובץ הזה — זו הבקשה היחידה שאכן צריכה להגיע מהקבלן.

> נתיב הפענוח **אינו נמצא ברפו הזה** — חיפוש `gantt` ב-`src/` מחזיר אפס תוצאות.

מה שנקלט בפועל, לפי השורה היחידה שנמדדה:

| שדה                        | ערך                         | מקור                                                                        |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `file_id`                   | `1776105870763_03.12.25.xml` | חותמת epoch במילישניות + שם הקובץ המקורי            |
| `display_name`              | לוז מעודכן 03.12.25   | תווית אנושית                                                         |
| `task_count`                | 382                            | דנורמליזציה של מספר המשימות                             |
| `start_date` / `end_date` | 2025-09-28 / 2026-04-29        | מעטפת הלוח                                                             |
| `last_saved`                | 2026-04-13T17:40Z              | חותמת השמירה האחרונה**מתוך** ה-XML של MS Project |
| `uploaded_at`               | 2026-04-13T18:44Z              | מתי הקובץ הגיע ל-BiDoc                                             |
| `relevancy_date`            | 2025-12-03                     | התאריך שאליו הלוח רלוונטי (Data Date)                     |

#### הגרסאות כבר נתמכות בסכימה

`gantt_tasks.file_id` הוא מפתח זר ל-`gantt_files.file_id`, ולכן `file_id` ייחודי. בתוספת חותמת ה-epoch שבשמו, **כל העלאה מייצרת `file_id` חדש ושורת `gantt_files` נפרדת.** כלומר ניהול הגרסאות שסעיף זה דורש כבר קיים במבנה — פשוט הועלה עד היום קובץ אחד.

זו הסיבה שהמנוע אינו צריך שכבת קליטה משלו. הוא צריך רק:

- לזהות איזו גרסה היא `current` — הגרסה בעלת `relevancy_date` המאוחר ביותר.
- לשמור על הגרסאות הקודמות. **אין דריסה.**
- לסמן `source_conflict` אם שתי גרסאות נושאות אותו `relevancy_date`.

#### שלושה תאריכים, ולא לבלבל ביניהם

`relevancy_date` ≠ `last_saved` ≠ `uploaded_at`. בדוגמה שנמדדה הפער ביניהם הוא **ארבעה חודשים** — לוח שרלוונטי ל-03.12.2025 נשמר ב-13.04.2026 והועלה באותו יום.

**מחייב:** השוואת גרסאות לצורך `schedule_slippage_days` מסתדרת לפי `relevancy_date` ולא לפי `uploaded_at`. בניתוח לוחות זמנים ה-Data Date הוא הקובע — לוח שהועלה מאוחר יותר אינו בהכרח מתאר מצב מאוחר יותר.

#### מה הקליטה הקיימת לא לוכדת

זו רשימת הבקשה המדויקת להרחבת נתיב הקליטה:

| חסר                                           | מה נחסם בלעדיו                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `predecessors` / קשרי גומלין         | כל סעיף 6.7 — Float, נתיב קריטי, הפצת עיכובים          |
| תאריכי Baseline                            | הבחנה בין הלוח המקורי לנוכחי בתוך אותה גרסה   |
| `actual_start` / `actual_finish`             | ציר הביצוע בפועל מגיע רק ממסמכים במקום מהלוח |
| `duration` ו-`total_float` / `free_float` | חישוב עצמאי במקום קריאה ישירה                            |
| קוד WBS, אזור, קומה, מקצוע       | מיפוי פעילויות (סעיף 6.3) נשען על שם בלבד            |
| לוח שנה מתוך ה-XML                    | ימי העבודה מוגדרים ידנית במקום להגיע מהמקור  |

#### השלכה מהכרעה 14.1

נתיב הקליטה כותב היום ל-App DB, אל טבלאות `_test`. ההכרעה היא ש**המנוע קורא מ-Content DB בלבד**.

**כל עוד נתיב הקליטה לא הופנה מחדש, כל העלאה עתידית של לוח תמשיך לנחות במסד שהמנוע אינו קורא ממנו** — והמנוע יראה לוח ריק לנצח. זו משימה באפליקציית BiDoc, לא ברפו הזה, והיא תנאי לשלב 1.

**שער:** ברגע שתיטען גרסה שנייה, `schedule_slippage_days` ו-`hidden_slippage` הופכים ברי-חישוב **בלי שינוי קוד נוסף** מעבר ללוגיקת ההשוואה. זהו הצעד היחיד בעל התשואה הגבוהה ביותר במסמך.

### 6.2 Evidence Extraction Service 🟡

חילוץ אירועי אמת מטקסט לא מובנה אל `schedule_observed_events`.

מקורות זמינים **ב-Content DB**, לפי סדר ערך:

| מקור                       |  שורות | הערה                                                                                                                                 |
| ------------------------------ | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `project_intelligence_items` |         383 | **המקור הבשל ביותר** — כבר מחולץ, עם `due_date`, `owner_text`, `confidence` ו-`field_confidence` |
| `emails`                     |       7,163 |                                                                                                                                          |
| `data_index`                 |       2,610 | האינדקס המאוחד                                                                                                              |
| `alerts`                     |       2,178 | מהן 272 מסוג`עיכוב`                                                                                                        |
| `meetings`                   |         442 |                                                                                                                                          |
| `daily_work_log`             | **0** | המקור הישיר ביותר לביצוע בשטח —**ריק ב-Content DB**                                                  |

**`project_intelligence_items` נקלט ולא מחושב מחדש.** מיפוי ישיר:

```
kind = "commitment"  →  event_type = "commitment"
due_date             →  event_date
status               →  progress hint  (unknown / open / in_progress / completed)
confidence           →  confidence
superseded/withdrawn →  התעלמות מהפריט
fingerprint          →  מפתח דדופליקציה
```

חילוץ מחדש של אותן 383 התחייבויות מהטקסט הגולמי הוא בזבוז, וגרוע מכך — הוא ייצר ערכים שונים במקצת ויפר את כלל 001.

סוגי אירועים: `planned_start`, `planned_finish`, `observed_start`, `observed_finish`, `progress_update`, `delay_notice`, `blocker_started`, `blocker_resolved`, `commitment`, `forecast_statement`, `resource_shortage`, `material_delay`, `decision_pending`, `activity_cancelled`.

```json
{
  "event_type": "observed_start",
  "activity_candidate": "טיח קומת קרקע",
  "event_date": "2026-05-18",
  "confidence": 0.92,
  "source_table": "daily_work_log",
  "source_id": "142",
  "evidence_text": "הקבלן החל היום בעבודות טיח בקומת הקרקע"
}
```

**מחייב:** האירוע נשמר עם `confidence` ועם הציטוט המקורי. אירוע בלי ראיה טקסטואלית אינו נשמר.

### 6.3 Activity Mapping Service 🔴

זיהוי שמונחים שונים מתייחסים לאותה פעילות — למשל `אספקת אריח השלמה` בהתראה מול `ריצוף אודיטוריום` בלוח.

**שער:** חסום. אין טבלת מיפוי ואין נתוני WBS/אזור/קומה/מקצוע ב-`gantt_tasks` — רק `task_name` ו-`outline_level`.

**מה כן זמין לבנייה עליו:** `outline_level` מספק היררכיה; `graph_nodes` / `graph_edges` / `timeline_entities` מספקים ישויות מחולצות; [`timelineGraph.js`](../src/timelineGraph.js) כבר מממש ניקוד דמיון בין אירועים לפי ישויות משותפות.

סטטוסי מיפוי: `auto_confirmed`, `suggested`, `manually_confirmed`, `rejected`, `unmapped`.

**מחייב:** כל מיפוי אוטומטי נושא ציון ביטחון. מיפוי מתחת ל-0.80 אינו מפעיל התראה בלי אישור אנושי — מיפוי שגוי מייצר התראה על המשימה הלא נכונה, וזה גרוע מהיעדר התראה.

### 6.4 Forecast Engine 🟡

מחושב כאשר אין `observedFinish`.

| שיטה                           | נוסחה                                                               | שער                            |
| ---------------------------------- | ------------------------------------------------------------------------ | --------------------------------- |
| לפי אחוז התקדמות     | `משך חזוי כולל = ימים שעברו / אחוז ביצוע` | 🟡`percent_complete` קיים   |
| לפי קצב ביצוע           | `משך נותר = כמות נותרת / קצב ממוצע`            | 🔴 אין נתוני כמויות |
| לפי התחייבות במסמך | תאריך מפורש שחולץ מטקסט                              | 🟡 תלוי בסעיף 6.2        |
| לפי חסם                      | התחלה נדחית עד פתרון החסם                           | 🟡 תלוי בסעיף 6.2        |
| לפי פעילות קודמת     | `FS` — התחלה לא מקדימה סיום קודמת               | 🔴 אין תלויות            |

כל תחזית מחזירה: תאריך, שיטת חישוב, רמת ביטחון, הנחות, מקורות ראיה, וזמן החישוב.

**מחייב:** תחזית לפי אחוז התקדמות עם `percentComplete = 0` היא חלוקה באפס. במקרה זה `forecastFinish = null` והסטטוס נגזר מ-`plannedFinish` בלבד. זה בדיוק המצב של רוב המשימות החורגות בדאטה הקיימת.

### 6.5 Variance Engine 🟡

```
contract_variance_days        = bidoc_forecast_finish - contract_finish              🔴
current_schedule_variance_days = bidoc_forecast_finish - contractor_current_finish   🟡
schedule_slippage_days        = contractor_current_finish - contractor_previous_finish 🔴
observed_variance_days        = observed_finish - relevant_planned_finish            🟡
milestone_impact_days         = forecast_milestone_finish - contractual_milestone_finish 🔴
```

שני מצבי חישוב נתמכים: ימים קלנדריים וימי עבודה. שניהם מוחזרים תמיד; הצרכן בוחר.

### 6.6 לוח שנה עבודה 🟡

- ברירת מחדל: **א׳–ה׳ ימי עבודה, ו׳–ש׳ סוף שבוע** (`working_weekdays = {0,1,2,3,4}`).
- חגי ישראל נשמרים ב-`schedule_calendars.holidays` ומוזנים ידנית או מיובאים פעם בשנה.
- בהיעדר לוח שנה מוגדר: כל שדות `workingDays*` מוחזרים `null`, והשדות הקלנדריים בלבד תקפים. **אין להניח לוח שנה שלא הוגדר.**

### 6.7 Dependency Propagation Engine 🟠

**שער: הדאטה קיימת במקור ואינה נשמרת.** לא חסם-דאטה אלא חסם-פענוח — הבדל מהותי.

הקובץ שנמדד מכיל **475 `PredecessorLink` הפרוסים על 311 מתוך 383 המשימות**, כל אחד עם `PredecessorUID`, `Type` ו-`LinkLag`. בנוסף `TotalSlack`, `FreeSlack` ו-`Critical` קיימים ל**כל** 383 המשימות — כלומר MS Project כבר חישב את ה-Float ואת הנתיב הקריטי, ואין צורך לחשב CPM עצמאי.

הפרסר של הקליינט אינו שומר אף אחד מהם (סעיף 6.1).

**מה שיידרש כשהשדות יישמרו:** תמיכה ב-`FS` / `SS` / `FF` / `SF`, ב-Lag חיובי וב-Lead שלילי, שמירת מקור הקשר וגרסת הלוח, ורמת ביטחון נפרדת לקשר שנגזר ממסמך ולא מלוח פורמלי.

כללי יסוד לכשיאופשר:

- חריגה הקטנה מה-Float אינה מסומנת אוטומטית כעיכוב פרויקט.
- חריגה מעבר ל-Float מופצת לפעילויות תלויות.
- נשמרות גם החריגה המקומית וגם ההשפעה המצטברת.

**עד אז:** `remainingFloatDays`, `affectsMilestone` ו-`affectsProjectFinish` מוחזרים `null` — **לא `false`**. `false` הוא טענה שהמנוע אינו יכול להצדיק.

### 6.8א מאגר התניות חוזיות ממתינות 🟡

**הבעיה:** רוב ההתחייבויות בחוזה אינן תאריך — הן כלל יחסי שממתין לאירוע מפעיל: "אישור תוך שבוע משליחת הצעת המחיר", "תיקון תוך 14 יום מקבלת הודעה", "ערבות חדשה תוך 7 ימים מחילוט". נמדד על חוזה אמיתי: 74 מתוך 78 התחייבויות הזמן הן כאלה. `schedule_contract_milestones` דורשת `contract_date not null` — אין להן מקום שם, ואסור שיהיה: תאריך לא-פתור אינו אבן דרך.

**הפתרון:** טבלת פול — `schedule_contract_conditions`. ההתניה נשמרת כהגדרה יחסית מלאה (עוגן מילולי + offset + יחידה) ויושבת בסטטוס `pending` בלי להשפיע על שום חישוב.

**מחזור החיים:**

```
סוכן החוזים כותב ─► pending (הפול)
                       │  אירוע מפעיל: מסמך נכנס / אירוע שטח / משימת גאנט
                       ▼  שהותאמו לעוגן של ההתניה
                    resolved
                       │  פתרון התאריך: אך ורק scheduleCalendar.js (כלל 001)
                       ▼
        שורה חדשה ב-schedule_contract_milestones
        (written_by='condition_resolver', metadata.condition_key)
                       │
                       ▼
        המנוע מודד daysRemaining/daysLate כרגיל ⟵ התראות ⟵ צירים
```

- `anchor_kind`: `event` (מסמך/אירוע שטח) | `schedule_task` (נקודה בלוח הקבלן) | `milestone` (אבן דרך אחרת) | `unspecified`.
- התניות מחזוריות (`recurring`) — למשל "פינוי פסולת שבועי" — נשארות בפול לתמיד; כל הפעלה מייצרת מופע.
- סטטוסים: `pending` | `resolved` | `dismissed` | `expired`.
- **Resolver סוכני זמין:** `scheduleConditionResolver.js` עובר שורה־שורה, מתכנן שאלת איתור, מעביר אותה למסלול ה-RAG המלא של הצ׳אט במצב אפמרלי, ומאמת תאריך + ציטוט + מקור. רק ראיה בביטחון `>=0.8` מקודמת אוטומטית. החיפוש מחויב ל-`project_id_filter`; מסד ישן שאינו תומך בסינון נכשל סגור ואינו מרחיב את החיפוש לכל החברה.
- החישוב של ה-offset נשאר דטרמיניסטי ב-`scheduleCalendar.js`/Resolver ואינו מבוצע על ידי LLM. תוצאה עמומה, סותרת, ללא מקור, ללא ציטוט או ללא לוח עבודה נדרָש נשארת `pending` לבדיקה.
- ההפעלה הראשית נעשית מפורשות מכפתור AI הצמוד לכל שורה בטבלת ההתניות. הבקשה כוללת `conditionId`, השרת טוען ומעבד רק את אותה שורה, ושאלת החיפוש נבנית רק מהעוגן, הכלל והמקור החוזי שלה. ה-API שומר גם יכולת batch מוגבלת ל-25 לשימוש תפעולי עתידי, אך ה-UI אינו מפעיל batch. שאלות פנימיות אינן נשמרות בהיסטוריית הצ׳אט ואינן נכנסות לזיכרון השיחה.
- מקור ה־OpenRouter של Resolver זה הוא **אך ורק** `MAIN.public.agent_settings` (`data.secrets.openRouterApiKey`). בכל לחיצת שורה השרת מרענן את הרשומה לפני ההפעלה. אין fallback ל־`OPENROUTER_API_KEY` מה־env במסלול זה; מפתח חסר ב־Settings עוצר את ההפעלה במפורש.

**שער:** 🟢 עבור פתרון התניות מבוסס ראיה דרך הצ׳אט. מיפוי אבן־דרך↔פעילות קבלן עדיין נפרד ותלוי בסעיף 6.3; גם בלעדיו אבן הדרך מוצגת כשורת milestone וכדגל חוזי גלובלי.

### 6.8 Status Classification Engine 🟡

| סטטוס                                                            | שער                      |
| --------------------------------------------------------------------- | --------------------------- |
| `on_track`, `watch`, `at_risk`                                  | 🟡                          |
| `delayed_vs_contractor`                                             | 🟡                          |
| `completed_late`, `completed_on_time`                             | 🟡 תלוי ב-6.2          |
| `not_started`, `blocked`                                          | 🟡 תלוי ב-6.2          |
| `insufficient_data`                                                 | 🟢                          |
| `source_conflict`                                                   | 🟡                          |
| `delayed_vs_contract`, `milestone_at_risk`, `milestone_delayed` | 🔴 אין ציר חוזי   |
| `hidden_slippage`                                                   | 🔴 גרסה אחת בלבד |

כללי סיווג:

```
אם אין basisDate:                                    insufficient_data
אם observedFinish קיים:                              completed_late / completed_on_time
אם asOf > basisDate:                                 delayed_vs_contract | delayed_vs_contractor
אם forecastFinish > basisDate:                       at_risk
אם daysRemaining < atRiskBufferDays ו-progress נמוך: at_risk
אם contractor_current_finish מאוחר משמעותית
   מהגרסה הקודמת בלי הודעת עיכוב:                    hidden_slippage
אחרת:                                                on_track
```

הספים ניתנים להגדרה ברמת מערכת או פרויקט, דרך `agent_settings`.

---

## 7. רמת ביטחון

ציון בין `0` ל-`1`.

| גורם                                | השפעה |
| --------------------------------------- | ---------- |
| מקור רשמי חתום              | גבוהה |
| דוח פיקוח עדכני            | גבוהה |
| לוח קבלן רשמי                | גבוהה |
| מספר מקורות תומכים      | מעלה   |
| מקור ישן                         | מוריד |
| סתירה בין מקורות          | מוריד |
| הערכה כללית ללא תאריך | מוריד |
| אישור משתמש                   | מעלה   |
| התאמת פעילות לא ודאית | מוריד |

רמות: `high` 0.80–1.00 | `medium` 0.55–0.79 | `low` 0.00–0.54

**מחייב:** המנוע לא יחזיר תחזית כעובדה ודאית כאשר הביטחון נמוך. סוכן ההתראות אינו מתריע על `low` ללא הגדרה מפורשת (סעיף 3.3).

**גורם נוסף שנדרש מהדאטה הקיימת:** לוח שגרסתו ישנה מ-90 יום מוריד ביטחון. הלוח היחיד שנקלט הוא מ-2025-12-03; נכון ל-2026-08-04 הוא בן 244 יום. כל אינדיקטור שנשען עליו בלבד אינו יכול לקבל `high`.

---

## 8. סתירות

דוגמאות:

- לוח הקבלן מציג 100% אך דוח פיקוח מציין שהעבודה בביצוע.
- מסמך אחד מציין התחלה, אחר מציין שהפעילות טרם התחילה.
- שתי גרסאות לוח סומנו כגרסה נוכחית.
- **התראת `עיכוב` שדווחה על ידי אדם אינה תואמת אינדיקטור `on_track`** — סתירה שהמנוע חושף בין הציר המדווח לציר המחושב, ובעלת ערך גבוה במיוחד.
- **התחייבות במסמך מול הלוח הפורמלי** — `expected_date` שחולץ מהתחייבות (`insightPipeline`) מוקדם או מאוחר מ-`finish_date` שבלוח. הפער אינו תקלה: הוא מתעד שהקבלן התחייב למשהו שאינו תואם את הלוח שהגיש. ראו סעיף 1.4.

בכל סתירה: אין למחוק מקורות, יש לסמן `source_conflict`, להוריד `confidence`, לשמור את כל הראיות, להציג מה בדיוק סותר, וניתן לפתוח משימת Review למשתמש.

---

## 9. Auditability

כל תוצאה חייבת להיות ניתנת להסבר. נשמר ב-`schedule_indicator_snapshots.payload`:

אילו מקורות שימשו, איזו גרסת לוח שימשה, אילו נוסחאות הופעלו, אילו הנחות הונחו, איזו גרסת מנוע ביצעה את החישוב, מתי בוצע, האם משתמש שינה או אישר נתון, ומה השתנה לעומת החישוב הקודם.

**מחייב:** התראה שנוצרה מהמנוע חייבת להצביע על Snapshot קיים. Snapshot אינו נמחק — רק נוסף.

---

## 10. ביצועים ו-Cache

- החישוב מתבצע ברמת פעילות, ומצטבר ברמת פרויקט.
- התוצאות נשמרות כ-Snapshots. **שאילתת סוכן קוראת Snapshot אחרון ואינה מפעילה חישוב מלא.**
- חישוב מחדש מתבצע רק לפעילויות שהושפעו ולצאצאיהן.
- Cache דרך [`src/cache.js`](../src/cache.js) הקיים, `namespace: "bidoc:schedule:"`.
- מפתח Cache: `(projectId, activityKey, asOf, dataVersion, engineVersion)`. `asOf` בתוך המפתח — אחרת תשובת אתמול מוחזרת היום.
- נעילה פר פרויקט למניעת חישובים מקבילים.
- תיעוד זמן ריצה ומספר פעילויות שחושבו ב-[`runLog`](../src/runLog.js).

**סדר גודל:** 382 פעילויות בפרויקט. חישוב מלא הוא פעולה זולה. אין צורך באופטימיזציה מוקדמת — יש צורך בנכונות.

---

## 11. ניטור

זמן חישוב ממוצע לפרויקט, מספר פעילויות ללא מיפוי, מספר סתירות פתוחות, אחוז פעילויות עם `confidence` נמוך, מספר תחזיות שהשתנו, גודל שינוי תחזית ממוצע, מספר אבני דרך בסיכון, שגיאות Import, זמן שעבר מאז גרסת הלוח האחרונה, זמן שעבר מאז ראיית שטח אחרונה.

**מדדים ייעודיים להתראות:**

- מספר התראות שנוצרו מהמנוע לעומת מ-LLM (`detected_by`).
- אחוז התראות מנוע שנדחו על ידי משתמש — מדד הרעש המרכזי.
- מספר פעילויות חורגות שלא הפכו להתראה בגלל `baselined`.

---

## 12. MVP

מוגדר מחדש לפי מה שניתן לחשב על הדאטה הקיימת.

### שלב 1 — האינדיקטור הבסיסי 🟡

מספק ערך מיידי ואינו תלוי בשום נתון חדש.

1. `scheduleEngine.js` — חישוב טהור של `daysLate` / `daysRemaining` מול `plannedFinish`.
2. `scheduleCalendar.js` — ימי עבודה, ברירת מחדל א׳–ה׳.
3. קריאת `gantt_tasks` ונרמול לפי סעיף 5.2, כולל שתי אנומליות הדאטה.
4. סטטוסים: `on_track`, `at_risk`, `delayed_vs_contractor`, `insufficient_data`, `not_started`.
5. `schedule_indicator_snapshots` + כתיבה.
6. `GET /api/schedule/indicator` + `POST /api/schedule/sweep`.
7. בדיקות דטרמיניסטיות עם `asOf` קבוע.

**קריטריון סיום:** קריאה אחת מחזירה את רשימת הפעילויות החורגות בפרויקט עם מספר ימים לכל אחת.

### שלב 2 — סוכן ההתראות מתחבר 🟡

זה השלב שסוגר את הפער שהוגדר בסעיף 1.1.

1. שני סוגי ההתראה החדשים.
2. הרחבת טבלת ההתראות (סעיף 5.4).
3. סריקה יומית → יצירת התראות.
4. בקרת רעש מלאה (סעיף 3.6), כולל אתחול היסטורי.
5. גזירת חומרה מהמספרים (סעיף 3.4).

**קריטריון סיום:** משימה שעברה את תאריך היעד ואיש לא כתב עליה מייצרת התראה עם `days_late` נכון, ובלי שיטפון של מאות התראות ביום הראשון.

### שלב 3 — ציר חוזי וגרסאות 🔴

1. `schedule_contract_milestones` + מסך הזנה.
2. קליטת גרסה שנייה של לוח קבלן.
3. `schedule_slippage_days`, `hidden_slippage`.
4. סטטוסים `delayed_vs_contract`, `milestone_delayed`.
5. `GET /api/schedule/health`, ומעבר של `scheduleDimension` ב-[`healthScore.js`](../src/subagents/healthScore.js) לצרוך אותו במקום את `overdue_commitments` (סעיף 1.4).

**סעיפים 1–4 תלויים בקלט מהלקוח, לא בפיתוח.**

### שלב 4 — ציר BIDoc ומיפוי 🔴

1. `schedule_observed_events` + חילוץ מ-`daily_work_log`.
2. `schedule_activity_map` על בסיס הגרף הקיים.
3. `POST /api/schedule/evaluate-document`.
4. העשרת התראות טקסטואליות (כיוון ב׳).
5. זיהוי סתירות בין הציר המדווח למחושב.

### שלב 5 — תלויות 🔴

תלויות, Float, נתיב קריטי, הפצה בגרף. **חסום עד שייטען לוח עם `predecessors`.**

---

## 13. קריטריוני קבלה

### שלב 1

1. אותה קריאה עם אותו `asOf` מחזירה תוצאה זהה בית-בבית.
2. `daysLate` ו-`daysRemaining` לעולם אינם מקבלים ערך בו-זמנית.
3. `daysLate` לעולם אינו `0` — היעדר איחור מיוצג ב-`null` בלבד.
4. פעילות בלי `basisDate` מקבלת `insufficient_data` ולא `on_track`.
5. `remainingFloatDays` ו-`affectsMilestone` מוחזרים `null` ולא `false`.
6. `is_summary` אינו מייצר התראה.
7. פעילות עם `start_date == finish_date` מטופלת כאבן דרך גם כש-`is_milestone = false`.
8. חישוב ימי עבודה מדלג על ו׳–ש׳ ועל חגים מוגדרים.
9. בהיעדר לוח שנה, שדות `workingDays*` מוחזרים `null`.
10. כל תוצאה כוללת `confidence`, ראיות, `engineVersion` ו-`asOf`.
11. `sweep` על הדאטה הקיימת מחזיר את המשימות שעברו את 2026-04-29 עם 0% ביצוע.

### שלב 2

12. משימה חורגת שאיש לא דיווח עליה מייצרת התראה עם `days_late` תקין.
13. חריגה נמשכת אינה מייצרת התראה חדשה בכל יום.
14. ההרצה הראשונה על פרויקט קיים אינה מייצרת יותר מהתראת סיכום אחת.
15. כל התראת מנוע מצביעה על `indicator_snapshot_id` קיים.
16. `severity_level` נגזר מהמספרים ואינו קבוע פר סוג.
17. סגירת פעילות סוגרת את ההתראה עם הסבר ואינה מוחקת אותה.
18. **`alerts`, `gantt_files`, `gantt_tasks`, `project_intelligence_items`, `data_index`, `daily_work_log`, `emails` ו-`meetings` זהות בסכימה ובמספר השורות לפני ההרצה ואחריה.** ניתן לאימות בצעד 6b/6c של סעיף 5.5. המנוע קורא מהן בלבד.

### כלל 001

19. שאלת לו״ז בצ׳אט מפעילה קריאה לשירות לפני ניסוח התשובה — ניתן לאימות ב-`runLog` של הריצה.
20. אין בקוד חישוב איחור, ימים שנותרו או סטייה מחוץ ל-`scheduleEngine.js`. ניתן לאימות בסריקת חיפוש על הפרשי תאריכים.
21. שאלה כמותית על לו״ז מנותבת ל-Schedule Intelligence ולא ל-`dataQuery`.
22. `overdue_commitments` ו-`days_past_commitment` אינם מוצגים כמדדי לוח זמנים בשום ממשק.
23. כאשר האינדיקטור והמסמך סותרים, התשובה נשענת על האינדיקטור והסתירה מדווחת.

### כללי

24. כל קריאה נושאת `project_id`; אין ברירת מחדל.
25. **`scheduleEngine.js` אינו מכיל אף גישה ל-Supabase, ל-`fetch` או ל-`process.env`.** ניתן לאימות בסריקת קובץ. החלפת `schedule.tasksTable` בהגדרות מפנה את המנוע למקור אחר בלי שינוי קוד.
26. אותה קבוצת משימות מנורמלת מחזירה אותה תוצאה בשני הפרופילים.
27. כל גישה לדאטה עוברת דרך שכבת הטעינה בלבד.
28. Service Role אינו נחשף לדפדפן.
29. הסבר וראיות מכבדים את הרשאות המסמך המקורי; אין להחזיר ציטוט ממסמך שהמשתמש אינו מורשה לראות.
30. כל שינוי ידני מתועד עם `user_id` וזמן.
31. המנוע אינו דורס גרסאות לוח קודמות.

---

## 14. פתוחות להכרעה

### 14.1 איזו טבלת Gantt קנונית — ✅ הוכרע 2026-08-04

**ההכרעה: המנוע אינו קשור לטבלה. המקור הוא פרמטר הגדרה.**

הכרעה קודמת באותו יום קבעה "Content DB בלבד", אך התברר שהדאטה היחידה שקיימת בפועל יושבת דווקא בטבלאות `_test` שנפסלו. במקום לבחור צד, המקור הופך להגדרה.

| שכבה                 | יודעת מאיזו טבלה?                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `scheduleEngine.js`    | **לא.** מקבלת מערך משימות מנורמל ומחזירה אינדיקטורים. פונקציה טהורה. |
| `scheduleIngestion.js` | **כן.** הרכיב היחיד שקורא `schedule.filesTable` / `schedule.tasksTable`.                             |
| כל השאר            | לא.                                                                                                                           |

שני הפרופילים מוגדרים בסעיף 5.5:

- **`dev`** → MAIN, `gantt_*_test`, 382 שורות זמינות **היום**.
- **`content`** → Content DB, `gantt_files` / `gantt_tasks`, ריק עד שהשרשרת קליינט→DB תיסגר.

**הרווח:** פיתוח ובדיקות מתחילים מיד מול דאטה אמיתית, בלי להמתין לשרשרת הקליטה. המעבר לפרודקשן הוא שינוי הגדרה אחד, לא שכתוב.

**המחיר:** `scheduleEngine.js` אסור שיכיל ולו גישה אחת ל-Supabase. זו כבר דרישה בסעיף 4.1, וכעת היא גם תנאי לניידות המקור. **קריטריון קבלה 20 מאמת זאת.**

**חוב פתוח:** `daily_work_log` ריקה ב-Content DB בעוד `daily_work_log_gf` ב-App DB מחזיקה 176 שורות. זהו מקור הראיות המרכזי לציר BIDoc (סעיף 6.2), ושלב 4 ב-MVP חסום עד שיאוכלס.

### 14.2 האם `alerts` או `alerts_gf`

`alerts_gf` מחזיקה 3,042 שורות ב-App DB; [`alert.js`](../src/subagents/alert.js) מכוון ל-`alerts` ב-Kapaim. יש להכריע לאן המנוע כותב.

### 14.3 מי מזין את הציר החוזי — ✅ הוכרע 2026-08-05

**סוכן חיצוני, מחוץ להיקף האפיון הזה.**

האפיון מגדיר את `schedule_contract_milestones` ואת `schedule_contract_extensions` (סעיף 5.3) ואת חוזה הכתיבה אליהן. הוא **אינו** מגדיר את הסוכן שמחלץ את התאריכים מהחוזה ואינו אחראי עליו.

**מה שהאפיון הזה כן מחייב מהסוכן החיצוני:**

1. `milestone_key` יציב — אותה אבן דרך תקבל אותו מפתח בכל הרצה.
2. `written_by` מאוכלס בכל שורה.
3. הארכות נכתבות ל-`schedule_contract_extensions` ולעולם לא כעדכון של `contract_date`.
4. **אין לכתוב `effective_date`.** הוא מחושב במנוע בלבד — כלל 001.

**סיכון שנשאר פתוח:** אם הסוכן החיצוני יכתוב `milestone_key` לא יציב, כל הרצה תיצור אבני דרך כפולות והמנוע ידווח חריגות שגויות. אין למנוע דרך להגן על עצמו מפני זה מלבד סף `confidence`. שווה תיאום מול הצוות שבונה אותו.

### 14.4 האם לבקש `predecessors` מהקבלן

כל סעיף 6.7, ה-Float והנתיב הקריטי תלויים בזה. זו בקשה תפעולית מהקבלן, לא משימת פיתוח — ייצוא MPP/XML עם קשרי גומלין.

### 14.5 זהות הפרויקט — ✅ נפתר 2026-08-04

**אין בעיית מיפוי מזהים. `projects.id` עקבי בין Meta DB לבין ה-Content DB.**

הבדיקה ב-`projects_registry` שב-Meta DB העלתה שמדובר ב**שני פרויקטים שונים של שתי חברות שונות**, ולא בפרויקט אחד עם שני מזהים:

| `projects.id`                          | שם                                    | חברה                                | Content DB                |
| ---------------------------------------- | --------------------------------------- | --------------------------------------- | ------------------------- |
| `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7` | פרויקט כללי                   | חברת בנייה אביב ובניו | **MAIN** (fallback) |
| `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5` | סמל - החושלים 15 הרצליה | Kapaim                                  | **Kapaim**          |

**המשמעות לצעד 8:** הגאנט `1776105870763_03.12.25.xml` שייך ל**"פרויקט כללי"** של חברת "אביב ובניו" — לא לפרויקט של Kapaim. העברת השורות ל-Content DB של Kapaim תשייך לוח זמנים של פרויקט אחד לפרויקט אחר.

**ההמלצה השתנתה בהתאם:** אין להעביר את השורות. יש להעלות את ה-XML מחדש דרך אפליקציית BiDoc אל הפרויקט הנכון — אפשרות א׳ בצעד 8, שהייתה ממילא המומלצת.

> **שים לב לסחיפת שמות:** `projects_registry` מכנה את `81b1cbac…` בשם "Kapaim" בעוד `projects` מכנה אותו "סמל - החושלים 15 הרצליה". השם אינו מזהה יציב; רק ה-`id` הוא.

### 14.6 גורלו של `overdue_commitments`

סעיף 1.4 מציע להשאיר את המדד ולשנות את שמו ל-`days_past_stated_commitment`. חלופה: לבטל אותו לחלוטין ולהישען על המנוע בלבד.

**ההמלצה היא להשאיר.** התחייבות שניתנה במסמך היא נתון בעל ערך משפטי בתיק תביעה — לעיתים חזק יותר מהלוח הפורמלי. מה שאסור הוא להציג אותה כמדד לוח זמנים.

**נדרשת הכרעה** לפני שלב 4, כי היא משפיעה על סכימת ה-Insights ועל ה-Dashboard.

### 14.7 תדירות הסריקה ומי מריץ אותה

אין תשתית תזמון ברפו. אפשרויות: Vercel Cron, n8n, או הפעלה ידנית מה-UI בשלב ראשון.

---

## 15. ממשק ניהול

### 15.1 למה זה חלק מהאפיון ולא תוספת

חמישה מקומות במסמך מניחים שבן אדם פועל, בלי להגדיר היכן:

| סעיף | ההנחה                                                                       | מה חסר                       |
| -------- | -------------------------------------------------------------------------------- | --------------------------------- |
| 6.3      | מיפוי עובר מ-`suggested` ל-`manually_confirmed` או `rejected` | תור אישור                 |
| 8        | "ניתן לפתוח משימת Review למשתמש" בסתירה                | תור Review                     |
| 3.6      | אתחול היסטורי מסמן חריגות כ-`baselined`                 | מסך שמראה מה הושתק |
| 6.6      | `holidays` ו-`holidays_through` מוזנים ידנית                     | מסך הזנה                   |
| 7        | "אישור משתמש מעלה`confidence`"                                   | מקום לאשר                 |

בנוסף, **קריטריון קבלה 30** דורש שכל שינוי ידני יתועד עם `user_id` — אך אין מקום לבצע שינוי ידני.

**חסימה קונקרטית:** בלי תור האישור, אף מיפוי לא יעבור את סף 0.80 שסעיף 6.3 מחייב, ו**שלב 4 ב-MVP אינו ניתן להשלמה**.

**והנימוק המהותי:** המנוע הוא הרכיב הראשון במערכת שמייצר **קביעה** ולא ציטוט. RAG מחזיר מקור שאפשר לבדוק; כאן המערכת אומרת "המשימה באיחור 226 יום". אם המשתמש חולק על כך, חייב להיות מקום שמראה לו את החישוב, את ה-`basis` ואת ההנחות. בלי מסך הפעילות הבודדת, `explanation` ו-`evidence` שהמנוע מייצר אינם נראים לאיש — וכל סעיף 9 הופך תיאורטי.

### 15.2 שילוב בממשק הקיים

| היבט     | החלטה                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| ניתוב   | טאב`#schedule` בתבנית הקיימת — [`app.js:375`](../public/app.js)                                                |
| טעינה   | loader ייעודי בכניסה לטאב, כמו`#insights` ו-`#knowledge`                                                  |
| קובץ     | `src/react/SchedulePage.jsx`, בתבנית [`InsightsPage.jsx`](../src/react/InsightsPage.jsx)                                 |
| אימות   | השער הקיים בלבד — סשן סופראדמין ([`server.js:160`](../src/server.js)). **אין שער חדש.** |
| נתונים | **אך ורק דרך `/api/schedule/*`.** אין גישה ישירה ל-Supabase מהדפדפן.                          |
| עיצוב   | מערכת העיצוב הקיימת, RTL, עברית                                                                             |

### 15.3 מסלולי API נוספים

מרחיבים את סעיף 4.4. נדרשים למסכי התורים.

| Method   | Route                                      | תיאור                                                |
| -------- | ------------------------------------------ | --------------------------------------------------------- |
| `GET`  | `/api/schedule/mapping?status=suggested` | הצעות מיפוי הממתינות לאישור       |
| `POST` | `/api/schedule/mapping/{id}/confirm`     | אישור — מעדכן ל-`manually_confirmed`        |
| `POST` | `/api/schedule/mapping/{id}/reject`      | דחייה                                                |
| `GET`  | `/api/schedule/conflicts`                | סתירות פתוחות                                 |
| `POST` | `/api/schedule/conflicts/{id}/resolve`   | הכרעה ידנית + נימוק                        |
| `GET`  | `/api/schedule/baselined`                | חריגות שהושתקו באתחול ההיסטורי |

כל פעולת כתיבה מתעדת `user_id` וזמן (קריטריון 30).

### 15.4 המסכים

#### 15.4.1 סקירה 🟡

מקור: `GET /api/schedule/health`.

מציג: מספר פעילויות באיחור, סך ימי איחור, החריגה הגדולה ביותר, אבני דרך בסיכון, גרסת הלוח הנוכחית ו**גילה בימים**.

> גיל הלוח הוא מדד ראשון במעלה ולא נתון משני. לוח בן 244 יום, כמו זה שנמדד, הופך כל אינדיקטור שנשען עליו לבלתי אמין (סעיף 7). הוא מוצג בראש המסך, לא בתחתיתו.

#### 15.4.2 חריגות 🟡

מקור: `POST /api/schedule/sweep`.

טבלה ממוינת לפי `daysLate` יורד. עמודות: שם פעילות, סטטוס, `daysLate` או `daysRemaining`, `percentComplete`, `basis`, `confidence`.

פילטרים: סטטוס, טווח סטייה, רמת ביטחון, קומה, מקצוע, אבן דרך.

**זהו המסך שעונה על "מה בוער היום".** הוא גם מסך האימות המעשי של שלב 1 — אם הוא ריק בזמן שהלוח הסתיים לפני חודשים, משהו במנוע שגוי.

#### 15.4.3 פעילות בודדת 🟡

מקור: `GET /api/schedule/indicator`.

מציג את מלוא ה-`ScheduleIndicator`: כל התאריכים, ה-`basis` וה-`basisDate` שמולם נמדדה החריגה, ה-`explanation` המילולי, הראיות עם קישור למקור, ו**את בלוק ה-`gates`**.

`gates` אינו מידע פנימי לניפוי שגיאות. הוא אומר למשתמש **מה לא נבדק** — שאין ציר חוזי, שיש גרסת לוח אחת, שאין תלויות. בלעדיו המשתמש מניח שהמערכת בדקה הכל.

#### 15.4.4 מיפוי — תור אישור 🔴

מקור: `GET /api/schedule/mapping?status=suggested`.

לכל הצעה: הטקסט המקורי, הפעילות המוצעת, שיטת ההתאמה, ציון ביטחון. פעולות: אישור, דחייה, בחירת פעילות אחרת.

**זהו המסך שחוסם את שלב 4.** בלעדיו כל מיפוי נשאר מתחת לסף 0.80 ולעולם לא מפעיל התראה.

#### 15.4.5 סתירות — תור Review 🔴

מקור: `GET /api/schedule/conflicts`.

מציג את שני המקורות הסותרים זה מול זה, מה בדיוק סותר, ופעולת הכרעה עם נימוק חובה.

הסתירה בעלת הערך הגבוה ביותר, לפי סעיף 8: **התראת `עיכוב` שדווחה על ידי אדם מול אינדיקטור `on_track`.** היא מקבלת סימון נפרד ובולט — היא מצביעה על פער בין מה שמדווח בשטח למה שהלוח אומר, ובתיק תביעה זה ממצא מרכזי.

#### 15.4.6 לוח שנה — בהגדרות הקיימות 🟡

`working_weekdays`, `holidays`, `holidays_through` שייכים לטאב ההגדרות ולא לטאב לוח הזמנים.

**חובה:** כאשר `holidays_through` ריק או ישן מהתאריך הנבדק, המסך מציג אזהרה מפורשת ש**חישובי ימי העבודה מנופחים** — חג שלא הוזן נספר כיום עבודה.

### 15.5 כללי תצוגה מחייבים

1. **`null` לעולם לא מוצג כ-`0`.** `daysLate = null` פירושו "לא באיחור"; `0` הוא ערך אסור (סעיף 3.2). תצוגה שגויה כאן הופכת משימה תקינה לחריגה.
2. **אין להציג מספר בלי ה-`basis` שלו.** "226 יום באיחור" חסר משמעות בלי "מול תאריך הסיום בלוח הקבלן מ-2025-12-21".
3. **`gates` נראים תמיד**, לא מוסתרים מאחורי הרחבה.
4. **`confidence = low` מסומן ויזואלית** ובאופן שונה מ-`high`.
5. **`insufficient_data` אינו מוצג כ-`on_track`.** שני מצבים שונים; מיזוגם משדר ביטחון שאין.
6. **אין חישוב בדפדפן.** הממשק מציג את מה שהמנוע החזיר ואינו גוזר ימים, סטיות או סטטוסים מתאריכים. **כלל 001 חל גם על ה-UI.**

### 15.6 מסכים לפי שלב ב-MVP

| שלב | מסכים                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| 1      | חריגות + פעילות בודדת.**מסך החריגות הוא אמצעי האימות של השלב.**  |
| 2      | סקירה +`baselined`. בלי לראות מה הושתק, אתחול היסטורי הוא קופסה שחורה. |
| 3      | הזנת לוח שנה בהגדרות                                                                                 |
| 4      | תור מיפוי + תור סתירות                                                                               |

### 15.7 קריטריוני קבלה לממשק

מתווספים לסעיף 13.

32. `daysLate = null` מוצג כ"בזמן" ולא כ-`0`.
33. כל מספר סטייה מוצג לצד ה-`basis` וה-`basisDate` שלו.
34. בלוק ה-`gates` נראה בכל מסך פעילות בודדת.
35. `insufficient_data` מובחן ויזואלית מ-`on_track`.
36. הממשק אינו מבצע אף חישוב תאריכים — ניתן לאימות בסריקת קוד הפרונט.
37. אישור או דחיית מיפוי מתעדים `user_id` וזמן, ומשנים את `confidence` בהתאם לסעיף 7.
38. הכרעת סתירה מחייבת נימוק ואינה מוחקת אף מקור.
39. מסך החריגות על הדאטה הקיימת מחזיר את המשימות שחרגו — תוצאה ריקה היא כשל.
40. אזהרת `holidays_through` מוצגת כשרשימת החגים חסרה.
