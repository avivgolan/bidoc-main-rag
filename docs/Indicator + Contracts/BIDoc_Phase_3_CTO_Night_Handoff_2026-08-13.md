# BiDoc Contracts Agent — Phase 3 CTO Night Handoff

- הוכן: 2026-08-13 00:03, Asia/Jerusalem
- יעד: המשך משמרת לילה מאותה נקודה בדיוק והחזרה מסודרת לבעל הפרויקט בבוקר
- Git root: `C:\Users\user\OneDrive - post.bgu.ac.il\Documents\GitHub\n8n\main-rag-backend\bidoc-main-rag`
- ענף: `feature/contracts-indicator-schedule-intelligence`
- HEAD בסיסי אחרון: `b66f1a7ed409c1ef65872d50d74b585ca392b37d`
- סטטוס כולל: Phase 3A–3G ממומשים עד גבול schema-only; תעודת היציאה החיה של Phase 3 עדיין חסרה

## 1. נקודת ההמשך במשפט אחד

Phase 3G ממומש, מוקשח ונבדק; מיגרציות ה־schema-only של Phase 3F history ושל Phase 3G guard כבר הוחלו ב־KAPAIM. שערי הכתיבה של 3F ושל 3G סגורים, יש `0` מיפויים ו־`0` אירועי ביקורת, וב־MAIN קיימת רק גרסת לוח אחת. כדי לסיים את Phase 3 צריך מיפוי אנושי אמיתי ומאושר על הגרסה הנוכחית, אחריו גרסת לוח אמיתית ומאוחרת יותר, preview לקריאה בלבד, ורק לאחר אישור נפרד — apply מבוקר ואימות idempotency.

## 2. כלל ההשתלטות החשוב ביותר

עץ העבודה מלוכלך במכוון ומכיל את כל עבודת Phase 3 שטרם נכנסה ל־commit. לפני יצירת קובץ handoff זה היו `45` נתיבים לא מחויבים: `13` קבצים tracked ששונו ו־`32` נתיבים untracked. קובץ זה מוסיף נתיב untracked נוסף.

בתחילת המשמרת יש להריץ:

```powershell
Set-Location -LiteralPath "C:\Users\user\OneDrive - post.bgu.ac.il\Documents\GitHub\n8n\main-rag-backend\bidoc-main-rag"
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
```

אסור לבצע `git reset`, ‏`git clean`, ‏`git checkout`, ‏`git switch`, ‏`git stash`, formatting רחב או החלפת ענף. אין לבצע commit, push, PR או deploy בלי הרשאה מפורשת. אין להניח שקובץ untracked אינו חשוב — המודולים, המיגרציות, ה־rollbacks ומסמכי Phase 3 נמצאים ביניהם.

## 3. מצב כל תת־שלב

| שלב | מצב נוכחי | מה הושלם | מה עדיין חסר |
| --- | --- | --- | --- |
| 3A | הושלם | ביקורת ארכיטקטורה, חוזה זהויות, ספי confidence, גבולות MAIN/KAPAIM וקריטריוני יציאה | אין |
| 3B | הושלם | mapper טהור ודטרמיניסטי, חלופות, חסמים, conflict handling, aliases והמשכיות בין fixtures | אין; אין מסמך checkpoint נפרד |
| 3C | הושלם | הקשחת `schedule_activity_map`, היסטוריה immutable, RPC אטומי, הרשאות service-role בלבד, SQL tests ו־rollback | אין |
| 3D | הושלם מרחוק | מיגרציות 3C הוחלו ונבדקו ב־KAPAIM, כולל index follow-up | אין; לא נוצר מיפוי |
| 3E | הושלם | API same-origin ובבעלות השרת לטעינת MAIN/KAPAIM ולבניית candidates ללא כתיבה | אין |
| 3F | הושלם עד schema-only | UI והחלטות בעברית, confirm/reject/correct/unmapped, סיבת סוקר והיסטוריה immutable; history RPC קיים מרחוק | gate לכתיבה חיה סגור; עדיין אין החלטה/מיפוי אמיתיים |
| 3F.1 | פעיל ומאומת | חוזים וטיוטות נשמרים, bucket פרטי, optimistic concurrency ופתיחה חוזרת ללא model call | החלפת המפתח שנחשף נשארה חוב אבטחה מומלץ |
| 3G | הושלם עד schema-only | preview/apply בבעלות השרת, exact counts, הגנות ambiguity, identity ו־TOCTOU, advisory lock, idempotency ו־rollback | מיפוי אנושי אמיתי, גרסת MAIN מאוחרת יותר, preview מוצלח, apply מאושר ותעודת יציאה חיה |

## 4. מזהים סמכותיים

| פריט | ערך |
| --- | --- |
| MAIN Supabase ref | `pmdnmzuqbcnzgkuhpfnx` |
| MAIN source project | `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7` |
| KAPAIM / APP DATA Supabase ref | `smxibuaowzuxkznuouwj` |
| KAPAIM Schedule project | `81b1cbac-8fcf-43c1-acdc-6b5c809de0e5` |
| מסלול UI | `http://localhost:4000/#contracts` |
| גרסת MAIN היחידה | `1776105870763_03.12.25.xml` |
| שם תצוגה | `לוז מעודכן 03.12.25` |
| `relevancy_date` | `2025-12-03` |
| `task_count` | `382` |
| PDF החוזה שנבדק | `C:\Users\user\OneDrive - post.bgu.ac.il\Desktop\Self Projects\Bidoc.ai\הסכם קבלן-סמל אולם תצוגה הרצליה גרסה לחתימה 1.11.pdf` |
| SHA-256 של ה־PDF | `0FF80EB28A157E748C02676B3C3897EA1FBBB1AD429F12E8AECE0EF062629DDA` |

## 5. מצב מרוחק מאומת

הספירות והמיגרציות להלן אומתו מחדש בלילה שבין 12 ל־13 באוגוסט, בקריאה בלבד.

### מיגרציות שכבר הוחלו — אין להחיל שוב

| תכלית | קובץ מקומי | רשומה מרוחקת ב־KAPAIM |
| --- | --- | --- |
| Phase 3 mapping review | `20260811170622_contracts_phase3_activity_mapping_review.sql` | `20260811170622` |
| Phase 3 project mapping FK index | `20260811171813_contracts_phase3_cover_project_mapping_fk.sql` | `20260811171813` |
| Phase 3F.1 saved workspaces | `20260812135210_contracts_phase3f1_saved_workspaces.sql` | `20260812152042` |
| Phase 3F history reader | `20260811214619_contracts_phase3f_mapping_review_history.sql` | `20260812200241` |
| Phase 3G manual/auto guard | `20260812194500_contracts_phase3g_auto_continuation_manual_guard.sql` | `20260812200652` |

אין להריץ `supabase db push`. שמות/זמני הרשומות המרוחקות שונים משמות הקבצים המקומיים בשני השלבים האחרונים, אך הסכימה כבר קיימת.

### מצב הנתונים

| משטח | ספירה |
| --- | ---: |
| active MAIN→KAPAIM project mappings | 1 |
| `schedule_activity_map` | 0 |
| `private.schedule_activity_mapping_review_events` | 0 |
| `private.contract_workspaces` | 1 |
| `private.contract_review_drafts` | 1 |
| private bucket `contracts-private` | 1 |
| PDF objects ב־bucket | 1 |
| `schedule_contract_milestones` | 0 |
| `schedule_contract_extensions` | 0 |
| `schedule_contract_conditions` | 0 |

ה־history RPC, ה־review RPC העטוף ו־Phase 3G guard קיימים. הפונקציות שנבדקו הן `SECURITY INVOKER`, עם `search_path=''`; `service_role` מורשה ו־`anon`/`authenticated` אינם מורשים ל־RPC הכתיבה. טבלת ההיסטוריה נמצאת ב־`private`, עם RLS וללא browser policy — מצב מכוון לשירות השרת בלבד.

## 6. מצב השרת ושערי ההפעלה

Snapshot אחרון:

- PID: `60996` (`node`), אבל בכל takeover יש לאתר מחדש את המאזין ולא להסתמך על PID ישן.
- `http://localhost:4000/login.html` החזיר HTTP `200`.
- stderr: `0` בתים.
- מספר אירועי `contract_model_call` בלוג: `8`; לאחר פתיחה מחדש והעלאה זהה הדלתא נשארה `0`.
- stdout: `C:\Users\user\AppData\Local\Temp\bidoc-codex-server-out.log`
- stderr: `C:\Users\user\AppData\Local\Temp\bidoc-codex-server-err.log`

ה־flags אינם נשמרים ב־`.env.local`; הם process-local. השרת הנוכחי הופעל עם שמירת 3F.1 בלבד ועם שער 3G סגור.

מצב בטוח:

```text
CONTRACTS_PHASE3F1_WORKSPACE_PERSISTENCE_APPROVED=TRUE
CONTRACTS_STORAGE_BUCKET=contracts-private

CONTRACTS_PHASE2_APPLY_APPROVED=FALSE
CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED=FALSE
CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED=FALSE
```

יש לשמור את 3F ואת 3G סגורים אלא אם התקבל אישור מפורש לפעולת כתיבה מסוימת. אין להדפיס, להעתיק או לתעד את `.env.local` או service-role key.

בדיקת שרת ללא שינוי מצב:

```powershell
netstat -ano -p TCP | Select-String ':4000'
Invoke-WebRequest -Uri "http://localhost:4000/login.html" -UseBasicParsing -TimeoutSec 5
```

אם נדרש restart, יש קודם לוודא במפורש שהמאזין הוא `node src/server.js`, לעצור רק אותו, ולהפעיל מחלון PowerShell שבו הוגדרו flags בטוחים. אין להגדיר gate כ־`TRUE` רק כדי לבדוק שהשרת עולה.

## 7. ראיות בדיקה אחרונות

| בדיקה | תוצאה |
| --- | --- |
| `npm.cmd run test:contracts:phase3g` | 25/25 עברו |
| `npm.cmd run test:contracts` | 96/96 עברו |
| `npm.cmd run test:schedule` | 47/47 עברו |
| `npm.cmd run test:contracts:phase3-db` | עבר; migration package קומפל והתנהגות DB אומתה |
| `npm.cmd run test:contracts:phase3g:db` | עבר; מרוץ PostgreSQL ידני מול `auto_continue` נשמר נכון |
| `npm.cmd run test:contracts:phase3g:rollback` | עבר; rollback לא־הרסני |
| `npm.cmd run react:build` | עבר |
| focused saved-workspace UI | 5/5 עברו |
| `git diff --check` | עבר; אזהרות LF→CRLF בלבד |

ה־suite הרחב `npm.cmd test` אינו מאומת כירוק כרגע. מסמכים ישנים מזכירים 12 כשלים שאינם שייכים לפרוסת Phase 3. אין לטעון full-suite green בלי להריץ ולסווג אותו מחדש.

בדיקות ה־DB משתמשות רק ב־Docker/PostgreSQL המקומי המבודד. אין להפנות אותן למסד המרוחק. להריץ ברצף, לא במקביל:

```powershell
npm.cmd run test:contracts:phase3g
npm.cmd run test:contracts
npm.cmd run test:schedule
npm.cmd run test:contracts:phase3-db
npm.cmd run test:contracts:phase3g:db
npm.cmd run test:contracts:phase3g:rollback
npm.cmd run react:build
git diff --check
```

אם Docker אינו נגיש, יש לדווח שהבדיקה לא הורצה; אין להחליף את היעד במסד המרוחק. סקריפט המרוץ עשוי ליצור את `tmp/contracts-phase3g-concurrency-auto.sql` ואת `tmp/contracts-phase3g-concurrency-manual.sql`; לאחר הצלחה ניתן למחוק רק את שני הקבצים האלה, תוך שמירה על `tmp/pdfs` וכל קובץ משתמש אחר.

## 8. מה קרה ב־Phase 3F.1

- ה־PDF המדויק חולץ ונשמר פעם אחת: workspace אחד, draft אחד, 12 candidates.
- טיוטת הסוקר נשמרה ב־revision `1`.
- הקריאה הראשונה יצרה 8 אירועי model call: שבע הצלחות ושגיאת timeout אחת ב־chunk 7; retry תחום עם `gpt-4o-mini` הצליח.
- reload + `פתח והמשך` שחזרו את החוזה והטיוטה ללא model call.
- העלאה חוזרת של אותם bytes שחזרה את אותו workspace ללא model call וללא עלות טוקנים נוספת.
- ה־bucket `contracts-private` הוא פרטי, מאפשר PDF בלבד ומוגבל ל־3,000,000 bytes.
- ה־service-role credential של KAPAIM הודפס בטעות לפלט פנימי בבדיקת preflight קודמת. המשתמש אישר להתקדם בלי rotation; ההחלפה/ביטול של המפתח נשארים חוב אבטחה מומלץ. אין להרחיב את החשיפה.

## 9. הוכחת הכשל הסגור שכבר בוצעה

נשלח preview חי לקריאה בלבד עבור MAIN project `652bf3e0-9a1e-47ca-b06f-cd8dc33907f7`:

- HTTP `409`
- code: `contracts_activity_mapping_reconciliation_previous_version_missing`
- סיבה: קיימת גרסת MAIN אחת בלבד.

נבדק גם apply כאשר gate סגור:

- HTTP `503`
- code: `contracts_activity_mapping_reconciliation_apply_not_approved`

לפני ואחרי הבדיקות נשארו `0` מיפויים, `0` אירועי היסטוריה ו־`0` שורות milestone/extension/condition. לא הופעל Schedule Engine ולא נוצרה התראה.

## 10. הסדר המדויק והיעיל להשלמת Phase 3

### אזהרת רצף קריטית

אין להעלות מיד גרסת לוח שנייה אם יש בידינו רק קובץ עתידי אחד והמטרה היא להוכיח `auto_continue`. כרגע אין מיפוי על הגרסה הקיימת. אם תועלה גרסה שנייה לפני שמיפוי אמיתי יאושר על גרסה `2025-12-03`, לא יהיה ל־3G מיפוי previous-version שאפשר להמשיך; ייתכן שיהיה צורך להמתין לגרסה שלישית.

הסדר המועדף:

1. **למצוא obligation חוזי אמיתי וראוי למיפוי.** אין להשתמש במועמד שנדחה או לסמן החלטה רק כדי לעבור בדיקה.
2. **לבנות decision packet לקריאה בלבד על גרסת MAIN הנוכחית.** להציג את הציטוט החוזי, הפעילות, UID, שם מקורי, outline, חלופות, confidence וחסמים בעברית.
3. **לקבל אישור אנושי/תחומי מפורש.** ה־CTO אינו אמור להמציא הכרעה משפטית או מוצרית. אם אין אישור — לעצור בנקודת ההחלטה.
4. **לאחר אישור נפרד בלבד:** לפתוח זמנית את `CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED=TRUE`, לשמור החלטת 3F אחת דרך ה־RPC/שרת בלבד, לסגור את השער ולהוכיח mapping + immutable history. אין SQL ידני.
5. **להשיג גרסת לוח אמיתית ומאוחרת מ־`2025-12-03` של אותו פרויקט.** עליה להכיל `file_id` חדש, `relevancy_date` סמכותי, כל המשימות, `task_count` מדויק וללא UID כפול.
6. **לפני upload חי:** לאמת שמסלול ההעלאה הנוכחי מתמיד גם metadata וגם tasks ל־MAIN `gantt_files_test`/`gantt_tasks_test`, ולא רק אובייקט Storage. מסמך ה־Schedule הישן מצביע על כך שגרסה קודמת התמידה לטבלאות בעוד מסלול חדש יותר עשוי לשמור רק ב־Storage. אם זו עדיין הבעיה, לטפל בה כפרוסת ingestion מקומית נפרדת עם בדיקות; אין לעקוף ב־INSERT ידני.
7. **לאחר הרשאת upload מפורשת:** להעלות את קובץ הלוח דרך המסלול הסמכותי, ולוודא שתי שורות file ושתי קבוצות tasks מלאות ב־MAIN.
8. **להריץ preview בלבד** ולבדוק version ordering, exact counts, duplicates, ambiguity, blockers ופעולות מתוכננות.
9. **לעצור לאישור apply.** preview מוצלח אינו הרשאה לכתוב.
10. **לאחר אישור apply נפרד בלבד:** לפתוח process-local את שער 3G, להריץ apply אחד, לחזור על הבקשה ולהוכיח idempotency, לסגור מיד את השער ולהפעיל מחדש.
11. **תעודת יציאה:** לאמת שהמיפוי הידני לא נדרס, אין duplicate mapping/event, אין Schedule arithmetic/target writes/alerts, והקונפליקט החוזי מול הלוח נשאר גלוי.

אם אין obligation אמיתי שאושר, אין מספיק נתוני עולם אמיתי לתעודת יציאה. זהו blocker נתונים/החלטה, לא תקלה בקוד.

## 11. preview — חוזה הבקשה

Endpoint:

```text
POST /api/contracts/activity-mapping/reconciliation/preview
```

הגוף היחיד המותר:

```json
{
  "sourceProjectId": "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7"
}
```

הנתיב דורש same-origin superadmin session. אסור לשלוח DB URL/key, רשימות tasks/mappings, reviewer, timestamps או החלטה מהדפדפן.

אפשר להשתמש ב־Chrome שכבר מחובר, או ב־PowerShell מבלי לשמור סיסמה בקובץ:

```powershell
$bidocOrigin = "http://localhost:4000"
$credential = Get-Credential -Message "BiDoc superadmin"
$bidocSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
  email = $credential.UserName
  password = $credential.GetNetworkCredential().Password
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$bidocOrigin/api/auth/login" `
  -WebSession $bidocSession `
  -ContentType "application/json; charset=utf-8" `
  -Body $loginBody

$previewBody = @{
  sourceProjectId = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$bidocOrigin/api/contracts/activity-mapping/reconciliation/preview" `
  -WebSession $bidocSession `
  -ContentType "application/json; charset=utf-8" `
  -Body $previewBody
```

בתוצאה מוצלחת יש לבדוק:

- `previousScheduleVersion.fileId` ו־`scheduleVersion.fileId` שונים ומתוארכים בסדר נכון.
- `sourceCounts` מתאימים ל־MAIN/KAPAIM.
- `blockers` ריק.
- `canApply === true`.
- `auditWritePerformed === false`.
- `operationalWritesPerformed === false`.
- `summary.pendingAutomaticContinuations > 0` עבור הוכחת המשכיות אמיתית.
- כל operation שומר UID, שם מנורמל ו־outline ומתייחס ל־document/candidate האמיתי שאושר.

אם preview מחזיר 0 operations כאשר mappings/history עדיין 0, זו תוצאה צפויה; אין לייצר מיפוי מלאכותי כדי לשנות אותה.

## 12. apply עתידי — לא לבצע ללא אישור מפורש

Endpoint:

```text
POST /api/contracts/activity-mapping/reconciliation/apply
```

אותו גוף יחיד מותר. apply דורש את `CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED=TRUE` כתהליך־מקומי.

לפני apply יש לשמור evidence bundle הכולל preview, versions, counts, operations, blockers, mappings/history before וסטטוס gate. לאחר apply:

1. לבדוק mapping/event counts.
2. להריץ שוב את אותו apply ולהוכיח שלא נוצר duplicate.
3. לוודא manual current-version decision לא נדרסה.
4. לוודא milestone/extension/condition/alert counts לא השתנו.
5. להסיר את gate ולהפעיל מחדש עם 3G סגור.
6. לעצור לפני consumer integration, שינוי Engine, alerts או Phase 4.

## 13. פעולות מותרות בלילה ללא הרחבת הרשאה

- ביקורת קוד/מסמכים לקריאה בלבד.
- בדיקות מקומיות ומבודדות.
- תיקון מקומי, ממוקד ומבוסס בדיקות של ingestion אם מוכח שמסלול ההעלאה אינו מתמיד לטבלאות MAIN.
- איתור ובדיקת קובץ לוח אמיתי בלי להעלותו.
- הכנת decision packet למיפוי אמיתי בלי לשמור החלטה.
- preview לקריאה בלבד אם שני המקורות כבר קיימים באופן סמכותי.
- עדכון מסמך hand-back ותוצאות בדיקה.

מסמך handoff זה אינו מעניק כשלעצמו הרשאה לפתוח gate, לכתוב מיפוי, להעלות לוח למערכת מרוחקת, לשנות DB, להריץ apply, לבצע commit/push/deploy או להתחיל Phase 4. אם קיימת הרשאה נפרדת מהמשתמש/בעל התחום, יש לתעד אותה במפורש לפני הפעולה.

## 14. פעולות אסורות

- אין לייצר schedule version, mapping, review event או approval מלאכותיים.
- אין לשנות MAIN/KAPAIM ישירות ב־SQL כדי לעקוף validation.
- אין להחיל שוב מיגרציות ואין להריץ `supabase db push`.
- אין לקבל browser-provided credentials, tasks, mappings, reviewer או `auto_continue` כאמת.
- אין לפתוח יחד את שערי 3F ו־3G.
- אין להשאיר gate פתוח בסיום המשמרת.
- אין לחבר Schedule consumers, לשנות Engine, לחשב תאריכים חוזיים או ליצור alerts במסגרת Phase 3.
- אין להשתמש בחוזה/מועמד שנדחה כדי לייצר success proof.
- אין להדפיס secrets.
- אין reset/clean/stash/checkout/commit/push/deploy בלי הרשאה.

## 15. קבצי מקור לפי סדר עדיפות

### מצב נוכחי

1. `docs/Indicator + Contracts/BIDoc_Phase_3_CTO_Night_Handoff_2026-08-13.md`
2. `docs/Indicator + Contracts/BIDoc_Phase_3G_Upload_Reconciliation_Checkpoint.md`
3. `bedrock/Memory/decisions/decisions.md`
4. `bedrock/Memory/schedule.md`
5. `docs/Indicator + Contracts/BIDoc_Phase_3F1_Saved_Contracts_and_Resume_Checkpoint.md`

### קוד

- `src/contracts/activityMapping.js`
- `src/contracts/activityMappingService.js`
- `src/contracts/activityMappingReview.js`
- `src/contracts/activityMappingReconciliation.js`
- `src/contracts/workspacePersistence.js`
- `src/scheduleIngestion.js`
- `src/server.js`
- `src/react/ContractsPage.jsx`
- `src/react/contractsHebrew.js`

### DB ובדיקות

- חמש מיגרציות Phase 3 תחת `supabase/migrations/`
- rollbacks תחת `supabase/rollbacks/`
- בדיקות SQL תחת `supabase/tests/`
- `scripts/verify-contracts-phase3g.mjs`
- `scripts/test-contracts-phase3g-concurrency.mjs`
- `scripts/test-contracts-phase3-db.mjs`
- `test/contracts-agent.tests.js`
- `test/ui/contracts-review.test.js`
- `package.json`

## 16. אזהרות על מסמכים ישנים

מסמך זה וה־Phase 3G checkpoint גוברים מבחינה תפעולית על משפטי סטטוס ישנים:

- Phase 3A ו־Phase 3F עדיין כוללים טקסט ישן שלפיו מיגרציית history לא הוחלה. היא כן הוחלה מאוחר יותר כרשומה `20260812200241`.
- טבלת ההשלמה הישנה ב־Phase 3A מזכירה Phase 3G ‏16/16 וללא restart/preview. המצב העדכני הוא 25/25, PID snapshot `60996`, preview ‏409 ו־apply gate probe ‏503.
- PID `39492` במסמך 3F.1 הוא היסטורי.
- אין להסיק מ־0 mappings ש־Phase 3 נכשל; הכתיבה נשמרה סגורה במכוון עד להחלטה אמיתית.

## 17. Checklist להחזרה בבוקר

יש להוסיף בסוף מסמך זה או למסמך hand-back נפרד:

- זמן התחלה/סיום.
- branch, HEAD ו־`git status --short --untracked-files=all`.
- רשימת קבצים ששונו והסיבה לכל שינוי.
- פעולות מקומיות ומרוחקות שבוצעו.
- מצב server/PID/HTTP/stderr.
- מצב כל gate בסיום.
- האם נמצא obligation אמיתי; מה הוחלט ומי אישר.
- האם נמצא/הועלה לוח אמיתי מאוחר יותר.
- `file_id`, ‏`relevancy_date`, ‏`task_count` וספירת task rows לכל גרסה.
- תוצאת preview המלאה או קוד הכשל.
- mapping/review-event/target/alert counts לפני ואחרי.
- כל בדיקה שהורצה ותוצאתה המדויקת.
- אישור שלא בוצעו פעולות אסורות.
- blocker נוכחי והצעד הבא המדויק.

## 18. תבנית hand-back

```text
זמן משמרת:
Branch / HEAD:
Git status:
קבצים ששונו:
פעולות מרוחקות:
גרסאות MAIN:
מיפוי אנושי מאושר:
תוצאת preview:
תוצאת apply (אם אושר במפורש):
ספירות לפני/אחרי:
תוצאות בדיקות:
מצב gates בסיום:
לא בוצעו commit/push/deploy/Schedule/alerts: כן/לא
חסם נוכחי:
הצעד הבא:
```

