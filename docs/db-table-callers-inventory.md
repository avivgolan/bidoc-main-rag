# מיפוי רכיבים לטבלאות Supabase

עודכן: 2026-08-08

> **CTO implementation lock — 2026-08-08:** The eight existing Schedule tables documented below are the canonical baseline and must be reused. Contracts work must not recreate, clone, rename, drop, or replace them, and must not execute DDL without separate approval. Re-audit the live schema and callers read-only immediately before implementation. See the [Contracts Agent and Schedule Intelligence implementation plan](<./Indicator + Contracts/BIDoc_Contracts_Agent_and_Schedule_Intelligence_Implementation_Plan.md>).

## פרויקטי Supabase והכינויים באפליקציה

| שם באפליקציה | שם ב-Supabase | Project ref | שימוש |
|---|---|---|---|
| App / MAIN | BiDoc MAIN | `pmdnmzuqbcnzgkuhpfnx` | הגדרות, היסטוריית צ׳אט, QA וגרף האפליקציה |
| APP DATA | KAPAIM | `smxibuaowzuxkznuouwj` | כל רכיב או סוכן שקורא מידע פרויקטלי, לרבות Schedule |
| Meta / Auth | BiDoc Meta | `pmdnmzuqbcnzgkuhpfnx` בהגדרה המקומית הנוכחית | אימות ו-`profiles` |

> `APP DATA` ו-`KAPAIM` הם שני שמות לאותו חיבור: `APP DATA` הוא השם בצד האפליקציה, ו-`KAPAIM` הוא שם הפרויקט ב-Supabase. בקוד החיבור נשמר תחת `contentSource`; אין חיבור או Key נפרד ל-Schedule.

## רכיבים וסוכנים

| רכיב / סוכן | טבלה או RPC שנקראים | פרויקט Supabase |
|---|---|---|
| Main Chat Agent — persistence | `chat_messages_gf`; `graph_nodes`; `graph_edges`; RPC `graph_search` | App / MAIN |
| Main Chat Agent — RAG | טבלת האינדקס ו-RPC ההיברידי שמוגדרים ב-APP DATA | APP DATA / KAPAIM |
| Settings / Config persistence | `agent_settings` | App / MAIN |
| Login / Superadmin authentication | `profiles` | Meta / Auth |
| QA Agent | `chat_messages_gf`; `qa_reports` | App / MAIN |
| Timeline API / UI — application graph | `timeline_event_links`; `timeline_entities`; `timeline_event_entities`; `timeline_graph_edges`; `graph_nodes`; `graph_edges` | App / MAIN |
| Timeline API / UI — source events | טבלת האינדקס וטבלת ההתראות שמוגדרות ב-APP DATA | APP DATA / KAPAIM |
| Project Insights Agent | `project_insight_runs`; טבלת האינדקס; טבלת ההתראות | APP DATA / KAPAIM |
| Project Insights Agent — graph context | `graph_nodes`; `graph_edges`; RPC `graph_search` | App / MAIN |
| Graph Enrichment Agent — destination | `graph_nodes`; `graph_edges` | App / MAIN |
| Graph Enrichment Agent — source scan | טבלת האינדקס; טבלת ההתראות | APP DATA / KAPAIM |
| Alert Agent | טבלת ההתראות ו-RPC ההתראות שמוגדרים ב-APP DATA | APP DATA / KAPAIM |
| Meeting Evidence Agent | `meetings_documents`; `meetings`; RPC `hybrid_match_meetings_documents` | APP DATA / KAPAIM |
| Exception Evidence Agent | `exceptions_report_documents` | APP DATA / KAPAIM |
| Consultant Report Evidence Agent | `consultants_reports_documents` | APP DATA / KAPAIM |
| Internal Meetings Content Agent | `meetings` או table override; RPC `match_<table>` | APP DATA / KAPAIM |
| Internal Emails Content Agent | `emails` או table override; `email_attachments`; RPC `match_<table>` | APP DATA / KAPAIM |
| Internal WhatsApp Content Agent | `whatsapp_analysis` או table override; `whatsapp_conversations`; RPC `match_<table>` | APP DATA / KAPAIM |
| Internal Financial Content Agent | `financial_transactions` או table override; `email_attachments`; RPC `match_<table>` | APP DATA / KAPAIM |
| Internal Safety Content Agent | `safety_reports` או table override; `email_attachments`; RPC `match_<table>` | APP DATA / KAPAIM |
| Data Query Agent | `data_index`; `financial_transactions`; `safety_reports`; `alerts`; `meetings`; `emails`; `exceptions_report`; `consultants_reports`; RPC `bidoc_data_query_data_index_v1`; fallback `exec_read_sql` | APP DATA / KAPAIM |
| Internal Indexing Agent — destination | טבלת האינדקס שמוגדרת ב-APP DATA | APP DATA / KAPAIM |
| Internal Indexing Agent — sources | `meetings`; `emails`; `safety_reports`; `consultants_reports`; `financial_transactions`; `whatsapp_analysis`; `whatsapp_conversations`; `other_documents` | APP DATA / KAPAIM |
| Delay Claim Agent — case data | `delay_claim_cases`; `delay_events`; `delay_event_evidence`; `delay_event_gaps`; `delay_event_findings`; `delay_event_change_log`; `delay_schedule_versions`; `delay_schedule_activities`; `delay_event_schedule_links`; `delay_cost_items`; `delay_claim_exports` | App / MAIN |
| Delay Claim Agent — evidence | טבלת האינדקס; `meetings_documents`; `meetings` | APP DATA / KAPAIM |
| Delay Claim Agent — graph | `graph_nodes`; `graph_edges`; RPC `graph_search` | App / MAIN |
| Schedule Agent — מקור העלאת לוח | `gantt_files_test`; `gantt_tasks_test` | App / MAIN |
| Schedule Agent — טבלאות מנוע קיימות | `schedule_calendars`; `schedule_contract_milestones`; `schedule_contract_extensions`; `schedule_contract_conditions`; `schedule_indicator_snapshots`; `schedule_alerts`; `schedule_activity_map`; `schedule_observed_events` | APP DATA / KAPAIM |
| Schedule Condition Resolver | `schedule_contract_milestones`; `schedule_contract_conditions`; `schedule_calendars` | APP DATA / KAPAIM |
| Connection Diagnostics | טבלאות App / MAIN לצד טבלת האינדקס, ההתראות וה-RPCs של APP DATA | App / MAIN + APP DATA / KAPAIM |

## אימות חי של טבלאות Schedule ב-KAPAIM

האימות המקורי בוצע מול PostgREST OpenAPI של הפרויקט `smxibuaowzuxkznuouwj` בתאריך 2026-08-05. אימות חוזר בוצע ב-2026-08-08 באמצעות בקשות `GET` ל-OpenAPI ובקשות `HEAD` עם `count=exact` בלבד. שני הפרויקטים החזירו HTTP 200, כל שמונת טבלאות ה-Schedule עדיין חשופות ל-Data API, והספירות לא השתנו. לא בוצעו DDL, RPC או כתיבת רשומות, ולא הודפסו credentials או ערכי רשומות.

| טבלה | מספר רשומות | עמודות |
|---|---:|---|
| `gantt_files` | 0 | `id`, `file_id`, `project_id`, `display_name`, `task_count`, `start_date`, `end_date`, `last_saved`, `uploaded_at`, `relevancy_date`, `created_at` |
| `gantt_tasks` | 0 | `id`, `file_id`, `project_id`, `task_uid`, `task_name`, `start_date`, `finish_date`, `percent_complete`, `is_summary`, `is_milestone`, `outline_level`, `content`, `summary`, `hashtags`, `metadata`, `embedding`, `item_status`, `created_at` |
| `schedule_calendars` | 1 | `id`, `project_id`, `name`, `working_weekdays`, `holidays`, `holidays_through`, `is_default`, `created_at` |
| `schedule_activity_map` | 0 | `id`, `project_id`, `canonical_key`, `alias`, `alias_source`, `match_method`, `confidence`, `status`, `confirmed_by`, `confirmed_at`, `created_at`, `updated_at` |
| `schedule_alerts` | 0 | `id`, `project_id`, `activity_key`, `indicator_snapshot_id`, `alert_type`, `title`, `description`, `severity_level`, `materiality_bucket`, `days_late`, `working_days_late`, `days_remaining`, `working_days_remaining`, `lifecycle_status`, `baselined`, `occurrence_group_id`, `resolution`, `first_detected_at`, `last_evaluated_at`, `reviewed_at`, `reviewed_by`, `resolved_at`, `created_at`, `updated_at` |
| `schedule_contract_conditions` | 0 | `id`, `project_id`, `condition_key`, `name`, `category`, `anchor_kind`, `anchor_description`, `offset_value`, `offset_unit`, `recurring`, `is_project_completion`, `penalty_ils_per_day`, `source_excerpt`, `source_page`, `confidence`, `status`, `trigger_event_date`, `trigger_source_table`, `trigger_source_id`, `resolved_milestone_key`, `written_by`, `metadata`, `created_at`, `updated_at` |
| `schedule_contract_extensions` | 0 | `id`, `project_id`, `milestone_key`, `extension_days`, `status`, `approved_date`, `approved_by`, `source_document_id`, `source_excerpt`, `confidence`, `written_by`, `metadata`, `created_at` |
| `schedule_contract_milestones` | 0 | `id`, `project_id`, `milestone_key`, `name`, `contract_date`, `is_project_completion`, `activity_key`, `source_document_id`, `source_excerpt`, `confidence`, `status`, `extractor_version`, `written_by`, `metadata`, `created_at`, `updated_at` |
| `schedule_indicator_snapshots` | 0 | `id`, `project_id`, `activity_key`, `milestone_key`, `as_of`, `status`, `days_late`, `working_days_late`, `days_remaining`, `working_days_remaining`, `basis`, `basis_date`, `confidence`, `engine_version`, `data_version`, `contract_version`, `payload`, `calculated_at` |
| `schedule_observed_events` | 0 | `id`, `project_id`, `activity_key`, `event_type`, `event_date`, `progress_percent`, `source_table`, `source_id`, `source_page`, `evidence_text`, `confidence`, `human_status`, `created_at` |

RPC רלוונטי שנמצא: `match_gantt_tasks`. מנוע הלו״ז הנוכחי קורא ישירות מהטבלאות ואינו תלוי ב-RPC זה.

> מסקנת האימות: הסכמה מלאה קיימת, אך `gantt_files` ו-`gantt_tasks` ריקות. לכן אין למנוע גרסת לוח או פעילויות לטעון. יש להעביר את הרשומות עצמן, לא רק את מבנה הטבלאות.

> מגבלת האימות: OpenAPI מאמת עמודות, טיפוסים, ברירות מחדל, nullability וחשיפה ל-Data API, אך אינו מוכיח את כל ה-PK/UK/FK/check constraints, האינדקסים, הטריגרים, ה-RLS, המדיניות, ההרשאות או הבעלות החיות. חיבור קטלוג PostgreSQL לקריאה בלבד אינו מוגדר ב-checkout הזה. נדרש export מאושר של הקטלוג לפני Phase 2; זו אינה הרשאה להריץ DDL.

בדיקת App / MAIN (`pmdnmzuqbcnzgkuhpfnx`) אימתה שהממשק כותב אל `gantt_files_test` (רשומה אחת) ואל `gantt_tasks_test` (382 רשומות). השמות `gantt_files` ו-`gantt_tasks` ללא `_test` אינם מופיעים בסכמת PostgREST של MAIN.

## כללי ניתוב

- כל מידע פרויקטלי נקרא באמצעות `APP DATA` (`contentSource`), למעט מקור ההעלאה של מנוע הלו״ז: `gantt_files_test` ו-`gantt_tasks_test` נקראים מ-App / MAIN משום שזה היעד שאליו ממשק ההעלאה כותב בפועל.
- Schedule אינו מחזיק URL, project ID או Key משלו.
- `src/supabase.js` הוא gateway משותף; הטבלאות שלו משויכות בטבלה למי שקורא לפונקציות שלו.
- שמות טבלת האינדקס, טבלת ההתראות וה-RPCs ניתנים לשינוי דרך APP DATA ב-Settings.
- טבלאות עם `table override` ניתנות לשינוי דרך הגדרות הסוכן.
- סקריפטי audit/provisioning וכלי בדיקה אינם נכללים כרכיבי מוצר.
