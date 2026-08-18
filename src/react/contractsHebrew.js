const ROLE_LABELS = Object.freeze({
  contractual_completion: "השלמת ומסירת העבודות",
  contractual_commencement: "תחילת העבודה החוזית",
  contractual_obligation: "התחייבות חוזית",
  fixed_completion: "מועד השלמה חוזי קבוע",
  daily_delay_charge: "חיוב יומי בגין איחור בהשלמה",
  exceptional_event_notice: "הודעה בכתב על אירוע חריג",
  weekly_waste_removal: "פינוי שבועי של פסולת בנייה",
  monthly_payment_chain: "בדיקת חשבון חודשי ותשלום",
  owner_requested_delay_relief: "דחיית מועד עקב עיכוב שביקש המזמין",
  approved_extension: "הארכת מועד מאושרת",
  completion_inspection: "בדיקת השלמת העבודות",
  manager_set_corrections: "תיקונים במועד שיקבע המפקח",
  performance_bond_delivery: "מסירת ערבות ביצוע",
  performance_bond_renewal: "הארכת ערבות ביצוע",
  notice_service: "מועד קבלת הודעה לפי אופן המסירה"
});

const ACTION_LABELS = Object.freeze({
  contractual_completion: "השלם ומסור את העבודות",
  contractual_commencement: "התחל את העבודות במועד החוזי",
  contractual_obligation: "בצע את ההתחייבות החוזית",
  fixed_completion: "השלם את העבודות במועד החוזי הקבוע",
  daily_delay_charge: "שלם חיוב יומי בגין איחור בהשלמה",
  exceptional_event_notice: "מסור הודעה בכתב על אירוע חריג",
  weekly_waste_removal: "פנה פסולת בנייה שהצטברה",
  monthly_payment_chain: "בדוק את החשבון החודשי ושלם את הסכום המאושר",
  owner_requested_delay_relief: "אפשר דחייה מתאימה בגין עיכוב מזכה שביקש המזמין",
  approved_extension: "החל את הארכת המועד המאושרת",
  completion_inspection: "השלם את בדיקת העבודות",
  manager_set_corrections: "השלם את התיקונים בתוך התקופה שיקבע המפקח",
  performance_bond_delivery: "מסור את ערבות הביצוע",
  performance_bond_renewal: "הארך את ערבות הביצוע לפני פקיעתה",
  notice_service: "קבע את מועד קבלת ההודעה לפי אופן המסירה"
});

const GATE_LABELS = Object.freeze({
  authority_unverified: "סמכות המסמך טרם אומתה",
  human_review_required: "נדרשת סקירה אנושית",
  project_binding_unreviewed: "קישור הפרויקט טרם נבדק",
  commencement_event_missing: "חסר אירוע תחילת עבודה",
  trigger_event_missing: "חסר אירוע מפעיל",
  execution_date_unverified: "מועד החתימה טרם אומת",
  inspection_start_event_missing: "חסר אירוע תחילת בדיקה",
  inspection_start_due_missing: "מועד תחילת הבדיקה אינו ידוע",
  bond_expiry_event_missing: "חסר מועד פקיעת הערבות",
  working_calendar_missing: "חסר לוח ימי עבודה מאושר",
  calendar_semantics_unresolved: "משמעות הימים טרם הוכרעה",
  subday_deadline_not_storable_as_date: "לא ניתן לשמור מועד קצר מיום כתאריך",
  compliance_engine_not_approved: "מנוע בדיקת הציות טרם אושר",
  recurring_occurrence_history_not_supported: "היסטוריית מופעים חוזרים עדיין אינה נתמכת",
  compound_rule_not_supported: "כלל חוזי מורכב עדיין אינו נתמך",
  approval_guard_not_supported: "תנאי האישור עדיין אינו נתמך",
  extension_event_missing: "חסר אירוע הארכת מועד",
  quantified_days_missing: "חסר מספר ימים מפורש",
  entitlement_review_required: "נדרשת בדיקת זכאות",
  extension_approval_review_required: "נדרשת בדיקת אישור הארכה",
  existing_milestone_identity_required: "נדרש זיהוי של אבן דרך קיימת",
  offset_missing: "חסר מרווח זמן",
  future_manager_decision_required: "נדרשת החלטה עתידית של המפקח",
  negative_offset_not_supported: "מרווח זמן שלילי אינו נתמך",
  branching_rule_not_supported: "כלל מסועף עדיין אינו נתמך",
  channel_specific_clock_not_supported: "מנגנון זמנים לפי ערוץ מסירה עדיין אינו נתמך",
  material_value_conflict: "קיימת סתירה בערך מהותי",
  contract_conflict_unresolved: "סתירה חוזית טרם נפתרה",
  responsible_party_unverified: "זהות הגורם האחראי טרם אומתה",
  beneficiary_unverified: "זהות הגורם הזכאי טרם אומתה",
  unreadable_pdf_page: "עמוד בחוזה אינו קריא"
});

const MAPPING_BLOCKER_LABELS = Object.freeze({
  human_review_required: "נדרשת סקירה אנושית",
  project_mapping_inactive: "קישור הפרויקט אינו פעיל",
  schedule_version_conflict: "קיימת סתירה בגרסת לוח הזמנים",
  trigger_evidence_unreviewed: "ראיות האירוע המפעיל טרם נבדקו",
  no_mapping_candidate: "לא נמצאה פעילות מתאימה",
  ambiguous_candidates: "נמצאו כמה חלופות בעלות התאמה זהה",
  canonical_alias_conflict: "קיימת סתירה בזהות הפעילות הקבועה",
  invalid_canonical_key: "זהות הפעילות הקבועה אינה תקינה",
  previous_activity_not_found: "הפעילות מהגרסה הקודמת לא נמצאה",
  current_activity_not_found: "הפעילות בגרסה הנוכחית לא נמצאה",
  duplicate_previous_task_uid: "מזהה פעילות כפול בגרסה הקודמת",
  duplicate_current_task_uid: "מזהה פעילות כפול בגרסה הנוכחית",
  identity_continuity_requires_review: "רציפות זהות הפעילות דורשת סקירה",
  summary_activity_requires_review: "פעילות סיכום דורשת סקירה מפורשת",
  prior_mapping_confidence_below_continuity_gate: "רמת הביטחון הקודמת נמוכה מסף הרציפות"
});

const PROMOTION_BLOCKER_LABELS = Object.freeze({
  schema_reuse_not_approved: "שימוש חוזר במבנה הנתונים טרם אושר",
  project_namespace_not_approved: "מרחב מזהי הפרויקט טרם אושר",
  review_audit_persistence_not_approved: "שמירת יומן הסקירה טרם אושרה",
  atomic_promotion_not_approved: "הקידום האטומי טרם אושר",
  permission_model_not_approved: "מודל ההרשאות טרם אושר",
  source_extraction_mode_invalid: "מצב החילוץ אינו מתאים לקידום",
  document_version_missing: "חסרה גרסת מסמך מזוהה",
  review_batch_missing: "חסרה קבוצת החלטות סקירה",
  review_batch_id_missing: "חסר מזהה לקבוצת הסקירה",
  reviewer_identity_invalid: "זהות הסוקר אינה תקינה",
  review_timestamp_invalid: "מועד הסקירה אינו תקין",
  review_reason_insufficient: "נימוק הסקירה קצר מדי",
  document_authority_not_approved: "סמכות המסמך טרם אושרה",
  project_mapping_missing: "חסר קישור בין הפרויקטים",
  project_mapping_not_approved: "קישור הפרויקטים טרם אושר",
  schedule_project_id_invalid: "מזהה פרויקט לוח הזמנים אינו תקין",
  source_project_id_missing: "חסר מזהה פרויקט המקור",
  source_project_id_invalid: "מזהה פרויקט המקור אינו תקין",
  source_project_binding_mismatch: "פרויקט המקור אינו תואם לקישור שנבדק",
  project_mapping_approver_missing: "חסרה זהות מאשר קישור הפרויקטים",
  project_mapping_timestamp_invalid: "מועד אישור קישור הפרויקטים אינו תקין",
  cross_database_mapping_reason_missing: "חסר נימוק לקישור בין מאגרי הנתונים",
  unsupported_review_action: "פעולת הסקירה אינה נתמכת",
  candidate_storage_target_not_operational: "יעד השמירה עדיין אינו תפעולי",
  review_confidence_invalid: "רמת הביטחון של הסקירה אינה תקינה",
  exact_evidence_missing: "חסרה ראיה מדויקת מן החוזה",
  conflict_review_missing: "חסרה החלטה מפורשת בסתירה",
  conflict_selection_not_exclusive: "יש לבחור חלופה יחידה מתוך הסתירה",
  fixed_milestone_date_invalid: "מועד אבן הדרך אינו תקין",
  condition_anchor_missing: "חסר אירוע עוגן לתנאי",
  condition_offset_invalid: "מרווח הזמן של התנאי אינו תקין",
  condition_direction_not_supported: "כיוון מרווח הזמן אינו נתמך",
  condition_offset_unit_not_approved: "יחידת הזמן של התנאי טרם אושרה",
  extension_days_invalid: "מספר ימי ההארכה אינו תקין",
  extension_unit_not_supported: "יחידת הארכת המועד אינה נתמכת",
  extension_approval_invalid: "אישור הארכת המועד אינו תקין",
  extension_milestone_identity_missing: "חסרה אבן הדרך שאליה שייכת ההארכה",
  review_decision_missing: "חסרה החלטת סוקר",
  transaction_batch_blocked: "קבוצת הקידום חסומה"
});

const INDICATOR_HANDOFF_REASON_LABELS = Object.freeze({
  reviewed_indicator_impact: "החלטה חוזית שנבדקה וסומנה כרלוונטית ל־Indicator",
  no_indicator_impact: "החלטה חוזית שנבדקה ואינה דורשת טיפול של Indicator",
  indicator_suitability_unknown: "ההתאמה ל־Indicator טרם הוכרעה בסקירת ההחלטה",
  indicator_suitability_invalid: "ערך ההתאמה ל־Indicator אינו תקין",
  decision_not_reviewed: "ההחלטה עדיין אינה בגרסת אישור או תיקון סופית",
  decision_inactive: "החלטה שנדחתה, פוצלה, מוזגה או הוחלפה אינה נמסרת ל־Indicator",
  decision_conflict_unresolved: "ההחלטה מכילה סתירה שלא הוכרעה",
  decision_conflict_not_reviewed: "זוהתה סתירה שטרם סומנה כבדוקה"
});

const ERROR_LABELS = Object.freeze({
  contracts_model_provider_timeout: "ספק הבינה המלאכותית לא השלים את החילוץ בזמן. לא נשמרה תוצאה חלקית; בניסיון הבא המערכת תשתמש מחדש רק בחלקים שכבר אומתו.",
  contracts_model_time_budget_exceeded: "חילוץ החוזה חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_model_provider_failed: "ספק הבינה המלאכותית לא הצליח להשלים את חילוץ החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_ai_unavailable: "שירות הבינה המלאכותית לחילוץ חוזים אינו מוגדר כעת בצד השרת.",
  contracts_promotion_migration_missing: "תשתית שמירת הסקירה אינה זמינה כעת בצד השרת.",
  contracts_activity_mapping_history_migration_missing: "היסטוריית החלטות המיפוי עדיין אינה זמינה בצד השרת.",
  contracts_activity_mapping_review_migration_missing: "תשתית שמירת החלטות המיפוי עדיין אינה זמינה בצד השרת.",
  contracts_activity_mapping_review_apply_not_approved: "שמירת החלטות מיפוי מושבתת בצד השרת.",
  contracts_activity_mapping_review_selection_stale: "הפעילות שנבחרה כבר אינה מופיעה בחלופות העדכניות. יש לרענן ולבחור מחדש.",
  contracts_activity_mapping_review_conflict_unresolved: "יש לפתור את הסתירה במפורש לפני אישור או תיקון.",
  contracts_activity_mapping_review_blocked: "המיפוי עדיין חסום ואינו בטוח לשמירה.",
  contracts_activity_mapping_context_not_found: "לא נמצא קישור פעיל ומאושר בין פרויקט המקור לפרויקט לוח הזמנים.",
  contracts_activity_mapping_schedule_not_found: "לא נמצאה גרסת לוח זמנים מאושרת לפרויקט.",
  contracts_activity_mapping_database_missing: "חיבור השרת למאגר לוח הזמנים אינו מוגדר.",
  contracts_activity_mapping_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מסד הנתונים שבבעלות השרת.",
  contracts_workspace_persistence_not_enabled: "שמירת חוזים קבועה עדיין אינה מופעלת בצד השרת.",
  contracts_workspace_migration_missing: "תשתית החוזים השמורים עדיין אינה זמינה ב-APP DATA/KAPAIM.",
  contracts_workspace_database_missing: "חיבור השרת למאגר החוזים השמורים אינו מוגדר.",
  contracts_workspace_storage_bucket_missing: "דלי האחסון הפרטי לחוזים עדיין לא הוגדר.",
  contracts_workspace_storage_bucket_not_private: "דלי אחסון החוזים חייב להיות פרטי לפני שניתן לשמור מסמכים.",
  contracts_workspace_storage_upload_failed: "שמירת קובץ ה-PDF הפרטי נכשלה. תוצאת החילוץ לא נרשמה כחוזה שמור.",
  contracts_workspace_storage_failed: "בדיקת אחסון החוזים נכשלה בצד השרת.",
  contracts_workspace_conflict: "החוזה השמור השתנה או מתנגש עם גרסה קיימת. יש לרענן ולנסות שוב.",
  contracts_workspace_not_found: "החוזה השמור לא נמצא או שאינו זמין עוד.",
  contracts_workspace_timeout: "שמירת החוזה חרגה ממגבלת הזמן. אפשר לרענן את רשימת החוזים ולבדוק אם נשמר.",
  contracts_workspace_transport_failed: "השרת לא הצליח להגיע למאגר החוזים השמורים.",
  contracts_workspace_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר החוזים שבבעלות השרת.",
  contracts_clause_persistence_not_enabled: "שמירת כל תוצאת סוכן החוזים עדיין אינה מופעלת בצד השרת.",
  contracts_clause_persistence_not_found: "חילוץ הסעיפים השמור לא נמצא או שאינו זמין עוד.",
  contracts_clause_persistence_timeout: "שמירת חילוץ הסעיפים חרגה ממגבלת הזמן. אפשר לרענן את רשימת החילוצים ולבדוק אם נשמר.",
  contracts_clause_persistence_response_invalid: "השמירה הושלמה אך תוצאת חילוץ הסעיפים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
  contracts_clause_persistence_storage_upload_failed: "שמירת קובץ ה־PDF הפרטי נכשלה, ולכן חילוץ הסעיפים לא נרשם.",
  contracts_clause_persistence_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר חילוצי הסעיפים שבבעלות השרת.",
  contracts_relationships_not_enabled: "שמירת הצעות הקשר של סוכן הקשרים עדיין אינה מופעלת בצד השרת.",
  contracts_relationships_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוסס סוכן הקשרים לא נמצא.",
  contracts_relationships_request_invalid: "בקשת סוכן הקשרים אינה תקינה.",
  contracts_relationships_response_invalid: "תוצאת סוכן הקשרים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
  contracts_relationships_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר הקשרים שבבעלות השרת.",
  contracts_relationship_review_not_enabled: "שמירת הצעות הקשר וסקירת R4.2A עדיין אינן מופעלות בצד השרת.",
  contracts_relationship_review_migration_missing: "מיגרציית R4.2A לשמירת הצעות קשר וסקירתן עדיין אינה זמינה ב־KAPAIM.",
  contracts_relationship_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת סקירת הקשרים לא נמצא.",
  contracts_relationship_review_request_invalid: "החלטת סקירת הקשר אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
  contracts_relationship_review_analysis_incomplete: "הניתוח לא נשמר משום שסיווג או בדיקה ספקנית לא הושלמו לכל הזוגות. אפשר להריץ שוב.",
  contracts_relationship_review_stale: "הצעת הקשר השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
  contracts_relationship_review_conflict: "התיקון מתנגש בקשר קיים או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
  contracts_relationship_review_rpc_failed: "מאגר KAPAIM דחה את שמירת סקירת הקשר. פרטי הדחייה נרשמו בטרמינל השרת.",
  contracts_relationship_review_response_invalid: "תוצאת סקירת הקשרים שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
  contracts_decisions_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר ההחלטות שבבעלות השרת.",
  contracts_decision_review_not_enabled: "יצירת הצעות החלטה וסקירת R4.2B עדיין אינן מופעלות בצד השרת.",
  contracts_decision_review_migration_missing: "מיגרציית R4.2B להצעות החלטה ולסקירתן עדיין אינה זמינה ב־KAPAIM.",
  contracts_decision_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססות הצעות ההחלטה לא נמצא.",
  contracts_decision_review_request_invalid: "החלטת הסקירה אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
  contracts_decision_review_stale: "הצעת ההחלטה השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
  contracts_decision_review_conflict: "הסקירה מתנגשת בהחלטה קיימת או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
  contracts_decision_review_rpc_failed: "מאגר KAPAIM דחה את שמירת הצעת ההחלטה או הסקירה. פרטי הדחייה נרשמו בטרמינל השרת.",
  contracts_decision_review_response_invalid: "תוצאת סקירת ההחלטות שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
  contracts_decision_relationship_review_incomplete: "יש לסיים את הסקירה של כל קשרי R4.2A לפני יצירת הצעות החלטה.",
  contracts_decision_normalization_input_invalid: "הסעיפים או הקשרים השמורים אינם מתאימים ליצירת הצעות החלטה בטוחה.",
  contracts_decision_normalization_unavailable: "מפתח המודל של סוכן ההחלטות אינו זמין בצד השרת.",
  contracts_decision_normalization_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של R4.2B. לא נשמרה תוצאה חלקית.",
  contracts_decision_normalization_time_budget_exceeded: "יצירת הצעות ההחלטה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_decision_normalization_provider_failed: "ספק הבינה המלאכותית לא השלים את יצירת הצעות ההחלטה. לא נשמרה תוצאה חלקית.",
  contracts_decision_normalization_output_invalid: "המודל החזיר הצעת החלטה שאינה עומדת בכללי R4.2B. לא נשמרה תוצאה חלקית.",
  contracts_decision_normalization_incomplete: "הניתוח לא נשמר משום שלא הושלמה הצעת החלטה תקינה לכל קבוצת סעיפים.",
  contracts_decision_normalization_ungrounded_party: "המודל ציין גורם שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
  contracts_decision_normalization_temporal_invalid: "המודל החזיר כלל זמנים שאינו מעוגן במלואו בסעיפי המקור. ההצעה נדחתה.",
  contracts_decision_normalization_ungrounded_numeric_fact: "המודל הוסיף פרט מספרי שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
  contracts_decision_lineage_not_enabled: "פעולות הפיצול והמיזוג של R4.2C עדיין אינן מופעלות בצד השרת.",
  contracts_decision_lineage_migration_missing: "מיגרציית R4.2C לפיצול, מיזוג ושמירת יוחסין עדיין אינה זמינה ב־KAPAIM.",
  contracts_decision_lineage_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת פעולת הפיצול או המיזוג לא נמצא.",
  contracts_decision_lineage_request_invalid: "בקשת הפיצול או המיזוג אינה תקינה. יש לבדוק את הראיות, השדות והנימוק בעברית.",
  contracts_decision_lineage_stale: "אחת ההחלטות השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את הגרסה החדשה יותר.",
  contracts_decision_lineage_conflict: "לא ניתן לשמור את הפיצול או המיזוג משום שהראיות או היוחסין אינם תואמים עוד למצב השמור.",
  contracts_decision_lineage_rpc_failed: "מאגר KAPAIM דחה את פעולת הפיצול או המיזוג. פרטי הדחייה נרשמו בטרמינל השרת.",
  contracts_decision_lineage_response_invalid: "תוצאת R4.2C שחזרה מ־KAPAIM אינה שלמה או אינה תקינה. לא הוצגה תוצאה חלקית.",
  contracts_indicator_handoff_not_enabled: "ערכת המסירה ל־Indicator עדיין אינה מופעלת בצד השרת.",
  contracts_indicator_handoff_request_invalid: "בקשת ערכת המסירה ל־Indicator אינה תקינה.",
  contracts_indicator_handoff_source_invalid: "החלטות R4.2 השמורות אינן שלמות מספיק למסירה בטוחה ל־Indicator.",
  contracts_indicator_handoff_safety_violation: "ערכת המסירה נעצרה משום שגבול האפס־כתיבות או ספירת ההחלטות לא נשמר.",
  contracts_workspace_rpc_failed: "מאגר KAPAIM דחה את שמירת חילוץ הסעיפים. פרטי הדחייה נרשמו בטרמינל של השרת.",
  contracts_response_too_large: "חילוץ הסעיפים הושלם, אך התוצאה גדולה ממגבלת התצוגה של השרת.",
  contracts_clause_enrichment_unavailable: "מפתח המודל של סוכן החוזים אינו זמין בצד השרת. יש לבדוק את OPENROUTER_API_KEY ולהפעיל מחדש את השרת.",
  contracts_clause_enrichment_token_budget_exceeded: "החוזה חרג מתקציב הפלט המוגדר להעשרת הסעיפים. לא נשמרה תוצאה חלקית.",
  contracts_clause_enrichment_time_budget_exceeded: "העשרת כל סעיפי החוזה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_clause_enrichment_provider_failed: "ספק הבינה המלאכותית לא השלים את העשרת סעיפי החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_clause_enrichment_ungrounded_numeric_fact: "המודל הוסיף לתקציר מספר שאינו מופיע בסעיף המקור. התוצאה נדחתה ולא נשמר מידע לא מבוסס.",
  contracts_semantic_relationships_not_enabled: "תצוגת קשרי R4.1 אינה מופעלת בשרת. יש לבדוק את האישור המקומי ולהפעיל מחדש את השרת.",
  contracts_semantic_relationships_unavailable: "מפתח המודל של סוכן הקשרים אינו זמין בצד השרת. יש לבדוק את ההגדרה ולהפעיל מחדש את השרת.",
  contracts_semantic_relationships_request_invalid: "בקשת תצוגת הקשרים אינה תקינה. יש לרענן את העמוד ולנסות שוב.",
  contracts_semantic_relationships_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של קשרי R4.1. לא נשמרה תוצאה חלקית.",
  contracts_semantic_relationships_time_budget_exceeded: "ניתוח הקשרים חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_semantic_relationships_provider_failed: "ספק הבינה המלאכותית לא השלים את סיווג זוגות הסעיפים. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_semantic_relationships_verifier_failed: "הבדיקה הספקנית של הצעות הקשר לא הושלמה. ההצעות שלא אומתו אינן מוצגות; אפשר להריץ שוב.",
  contracts_semantic_relationships_json_invalid: "ספק הבינה המלאכותית החזיר סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_semantic_relationships_schema_invalid: "ספק הבינה המלאכותית החזיר מבנה סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
  contracts_semantic_relationships_verifier_json_invalid: "הבדיקה הספקנית החזירה תשובה לא תקינה. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
  contracts_semantic_relationships_verifier_schema_invalid: "הבדיקה הספקנית החזירה מבנה לא תקין. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
  contracts_semantic_relationships_response_invalid: "תוצאת סוכן הקשרים חרגה מגבולות הבטיחות של R4.1 ולכן נדחתה ולא נשמרה."
});

const STORAGE_LABELS = Object.freeze({
  candidate_for_schedule_contract_milestones: "מועמד לאבן דרך חוזית",
  candidate_for_schedule_contract_extensions: "מועמד להארכת מועד חוזית",
  candidate_for_schedule_contract_conditions: "מועמד לתנאי חוזי ממתין",
  dry_run_only: "סקירה בלבד — ללא יעד תפעולי"
});

const EVIDENCE_KIND_LABELS = Object.freeze({
  contract_source: "ציטוט מדויק מן החוזה",
  preferred_activity_key_exact: "התאמה מלאה למזהה פעילות מועדף",
  preferred_task_uid_exact: "התאמה מלאה למזהה משימה",
  normalized_name_exact: "התאמה מלאה בשם הפעילות",
  token_overlap: "חפיפה במונחי הפעילות",
  milestone_preference: "התאמה להעדפת אבן דרך",
  outline_level_preference: "התאמה לרמת ההיררכיה",
  summary_activity_penalty: "הפחתת ביטחון משום שזו פעילות סיכום",
  confirmed_alias_owner: "זהות פעילות שכבר אושרה",
  conflicting_alias_owners: "סתירה בין זהויות פעילות קיימות",
  invalid_canonical_owner: "זהות פעילות קיימת אינה תקינה"
});

const UNIT_LABELS = Object.freeze({
  day: "ימים",
  calendar_day: "ימים קלנדריים",
  calendar_days: "ימים קלנדריים",
  working_day: "ימי עבודה",
  working_days: "ימי עבודה",
  week: "שבועות",
  weeks: "שבועות",
  month: "חודשים",
  months: "חודשים",
  hour: "שעות",
  hours: "שעות"
});

const DIRECTION_LABELS = Object.freeze({
  after: "לאחר האירוע המפעיל",
  before: "לפני האירוע המפעיל"
});

export function contractRoleLabel(role) {
  return ROLE_LABELS[role] || "עובדה חוזית הדורשת סקירה";
}

export function contractActionLabel(candidateOrRole) {
  const role = typeof candidateOrRole === "string" ? candidateOrRole : candidateOrRole?.role;
  return ACTION_LABELS[role] || "בדוק את העובדה החוזית מול הראיה המקורית";
}

export function contractGateLabel(gate) {
  return GATE_LABELS[gate] || "נדרש בירור נוסף לפני קידום";
}

export function mappingBlockerLabel(blocker) {
  return MAPPING_BLOCKER_LABELS[blocker] || contractGateLabel(blocker);
}

export function promotionBlockerLabel(blocker) {
  const value = String(blocker || "");
  if (value.startsWith("review_gate_unresolved:")) {
    return `חסם סקירה טרם נפתר: ${contractGateLabel(value.slice("review_gate_unresolved:".length))}`;
  }
  if (value.startsWith("unknown_review_candidate:")) return "התקבלה החלטה עבור מועמד שאינו קיים בחילוץ הנוכחי";
  if (value.startsWith("duplicate_review_decision:")) return "נמצאו כמה החלטות עבור אותו מועמד";
  return PROMOTION_BLOCKER_LABELS[value] || "הקידום חסום ונדרשת בדיקה נוספת";
}

export function contractsIndicatorHandoffReasonLabelHe(value) {
  return INDICATOR_HANDOFF_REASON_LABELS[String(value || "")]
    || "נדרשת בדיקה נוספת לפני מסירה ל־Indicator";
}

export function contractsIndicatorHandoffStatusLabelHe(value) {
  return ({
    suitable: "מתאימה למסירה ל־Indicator",
    not_suitable: "אינה מתאימה למסירה",
    requires_review: "דורשת סקירה חוזית"
  })[value] || "מצב מסירה לא ידוע";
}

export function storageDispositionLabel(value) {
  return STORAGE_LABELS[value] || "אין יעד תפעולי מאושר בשלב זה";
}

export function mappingActionLabel(action) {
  return ({ confirm: "אישור", reject: "דחייה", correct: "תיקון", unmapped: "ללא מיפוי" })[action] || "החלטת סקירה";
}

export function mappingStateLabel(state) {
  return ({
    suggested: "הוצעו חלופות לסקירה",
    blocked: "חסום עד לפתרון מפורש",
    unmapped: "לא נמצאה חלופה",
    not_required: "לא נדרש קישור לפעילות",
    pending_trigger: "ממתין לאימות האירוע המפעיל",
    manually_confirmed: "אושר ידנית",
    auto_confirmed: "המשכיות זהות אושרה אוטומטית",
    rejected: "נדחה"
  })[state] || "מצב דורש בדיקה";
}

export function reviewPlanStatusLabel(status) {
  return ({ transaction_ready: "מוכן לטרנזקציה", blocked: "חסום", rejected: "נדחה" })[status] || "מצב טרם נקבע";
}

export function mappingEvidenceKindLabel(kind) {
  return EVIDENCE_KIND_LABELS[kind] || "ראיית התאמה ללוח הזמנים";
}

export function contractUnitLabel(unit) {
  return UNIT_LABELS[unit] || "יחידות זמן";
}

export function contractDirectionLabel(direction) {
  return DIRECTION_LABELS[direction] || "ביחס לאירוע המפעיל";
}

export function contractsDecisionCategoryLabelHe(value) {
  return ({
    scope_and_execution: "היקף וביצוע",
    commencement_and_completion: "תחילה והשלמה",
    stage_acceptance_and_handover: "קבלת שלב ומסירה",
    payment_and_commercial: "תשלום ומסחר",
    notice_and_communication: "הודעות ותקשורת",
    change_and_approval: "שינוי ואישור",
    bond_and_security: "ערבויות ובטוחות",
    warranty_and_defects: "אחריות וליקויים",
    recurring_compliance: "ציות חוזר",
    delay_extension_and_consequence: "עיכוב, הארכה ותוצאה",
    termination_and_remedy: "סיום ותרופה",
    document_and_information_obligation: "מסמכים ומידע",
    other: "אחר"
  })[value] || "קטגוריה לא ידועה";
}

export function contractsDecisionReviewLabelHe(value) {
  return ({
    proposed: "ממתינה לסקירה",
    approved: "אושרה",
    corrected: "תוקנה ואושרה",
    rejected: "נדחתה",
    unresolved: "סומנה כלא פתורה",
    split: "פוצלה",
    merged: "מוזגה",
    superseded: "הוחלפה בגרסה חדשה"
  })[value] || "מצב סקירה לא ידוע";
}

export function contractsScheduleImpactLabelHe(value) {
  return ({ yes: "עשויה להשפיע על לוח הזמנים", no: "ללא השפעה על לוח הזמנים", unknown: "השפעה על לוח הזמנים טרם הוכרעה" })[value]
    || "השפעה לא ידועה";
}

export function contractsTemporalKindLabelHe(value) {
  return ({
    none: "ללא כלל זמן",
    fixed: "מועד קבוע",
    relative: "מועד יחסי",
    recurring: "כלל חוזר",
    extension: "הארכת מועד",
    consequence: "תוצאה של איחור"
  })[value] || "סוג זמן לא ידוע";
}

export function formatHebrewDateTime(value) {
  if (!value) return "מועד לא זמין";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "מועד לא זמין";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function contractsUiError(error) {
  if (error?.name === "AbortError") return "הפעולה חרגה ממגבלת הזמן. אפשר לנסות שוב.";
  return ERROR_LABELS[error?.code] || "הפעולה נכשלה. אפשר לנסות שוב או לבדוק את הגדרות השרת.";
}
