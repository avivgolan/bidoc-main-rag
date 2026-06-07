---
id: schedule
name: Schedule Knowledge Agent
description: Delays, blockers, schedule control, dependencies, critical path, and supplier delay analysis.
tags:
  - delays
  - blockers
  - schedule
  - dependencies
  - critical_path
  - supplier_delay
  - עיכובים
  - חסמים
  - לוחות_זמנים
  - תלויות
keywords:
  - delay
  - delayed supplier
  - supplier delay
  - blocker
  - blockers
  - schedule
  - critical path
  - dependency
  - dependencies
  - מי היה הספק שגרם לעיכוב
  - הספק שגרם לעיכוב
  - הספק המעכב
  - ספק מעכב
  - ספק שהתעכב
  - מי אחראי לעיכוב
  - גורם העיכוב
  - גורמי עיכוב
  - עיכוב
  - עיכובים
  - חסם
  - חסמים
  - לוח זמנים
  - לו"ז
  - תלות
  - תלויות
---

# Schedule Knowledge

Use this agent when the user asks about project delays, blockers, schedule risk, supplier delay, dependencies, or the critical path.

In a construction project, a delay is not only a late date. A delay usually has a cause, an affected activity, an owner, a dependency, and an impact on following work. When the user asks "who was the delayed supplier", the useful interpretation is: identify supplier/vendor entities connected to delayed work, blocked activities, late delivery, missing approval, or schedule risk in project evidence.

בעברית, שאלות כמו "מי היה הספק שגרם לעיכוב", "מי הספק שהתעכב", "מה גרם לעיכוב", "מי אחראי לעיכוב" או "מה היה גורם העיכוב" צריכות להפעיל ניתוח לו"ז. המטרה אינה רק למצוא את המילה עיכוב, אלא לזהות את הגורם המקצועי שקשור לעיכוב: ספק, קבלן משנה, יועץ, גורם מאשר, מסירה מאוחרת, חוסר באישור, חסם ביצוע או תלות בין פעילויות.

כאשר מופיעה שאלה על הספק שגרם לעיכוב, יש לחפש בפרויקט ישויות מסוג ספק או קבלן משנה שמופיעות ליד ניסוחים כמו התעכב, גרם לעיכוב, באיחור, חסם את העבודה, לא סיפק בזמן, ממתינים לתשובה, ממתינים לאישור, ממתינים למסירה, חסר חומר, חסר שרטוט, חסר אישור או פעילות שלא יכולה להתחיל. אם יש כמה ספקים קשורים, יש להפריד בין ספק שגרם לעיכוב בפועל לבין ספק שרק הוזכר בהקשר של סיכון לו"ז.

## What To Look For

- Supplier, subcontractor, vendor, consultant, or contractor names connected to delay language.
- Activities that cannot start because another party has not finished, approved, delivered, answered, or released something.
- Words such as delay, delayed, late, blocked, hold, waiting, dependency, critical path, postponed, stuck, and overdue.
- Hebrew terms such as עיכוב, מתעכב, באיחור, חסם, חסמים, תלות, ממתינים, תקוע, לו"ז, לוח זמנים.
- Dates that show planned versus actual timing, or messages that say an item is still pending.
- Links between a delayed item and downstream work: access, procurement, approvals, shop drawings, delivery, installation, inspection, or handover.

## חיפוש בעברית

- ספק או קבלן משנה שמופיע ליד "עיכוב", "לעיכוב", "גרם לעיכוב", "התעכב", "הספק המעכב", "ספק מעכב", "באיחור" או "לא הגיע בזמן".
- גורם שמחזיק פעילות אחרת: "ממתינים לספק", "ממתינים לאישור", "ממתינים לתשובה", "טרם התקבל", "לא סופק", "חסר חומר", "חסר שרטוט", "חסר אישור".
- קשר בין הספק לבין פעילות מושפעת: אספקה, התקנה, אישור, בדיקה, שחרור שטח, גישה לאתר, עבודת המשך או מסירה.
- אחריות לעיכוב צריכה להיקבע רק אם יש ראיה בפרויקט שמחברת בין הספק לבין החסם. אם יש רק אזכור כללי, יש לומר "נראה קשור לעיכוב" ולא לקבוע שהוא גרם לעיכוב.

## Reasoning Guidance

Classify the issue as schedule-related when the question is about delay causes, delayed suppliers, blocked tasks, dependencies, or timing impact. Use the project graph to connect suppliers, events, documents, approvals, and topics. Use retrieval results to confirm the actual project facts before naming a delayed supplier.

If the evidence only suggests a possible delay, say that the supplier appears connected to schedule risk rather than stating it as a confirmed delay. Separate the professional interpretation from the project evidence.

כאשר המשתמש שואל "מי היה הספק שגרם לעיכוב", התשובה צריכה להיבנות בשלבים: קודם לזהות מועמדים שהם ספקים או קבלני משנה, אחר כך לבדוק אילו מהם מופיעים עם שפת עיכוב, ואז לוודא שיש קשר לראיות פרויקט כמו מייל, התראה, פגישה, מסמך, גרף קשרים או אירוע Timeline. אין להסיק אחריות רק בגלל שהשם מופיע ליד המילה עיכוב; צריך קשר סיבתי או תפעולי ברור.

## Useful Follow-Up Queries

- delayed supplier
- supplier delay
- schedule blocker
- critical path delay
- pending approval blocking work
- procurement delay
- delivery delay
- מי הספק שהתעכב
- מי היה הספק שגרם לעיכוב
- הספק שגרם לעיכוב
- הספק המעכב
- מי אחראי לעיכוב
- חסמים בפרויקט
- גורמי עיכוב
