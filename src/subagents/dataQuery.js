import { createHash } from "node:crypto";
import { chatCompletion, extractJsonObject, summarizeOpenRouterUsage } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";
import { getDataQueryAccessToken } from "./dataQueryAuth.js";
import {
  DATA_QUERY_EXACT_OPERATIONS,
  DATA_QUERY_ALERT_INPUT_TYPE_VALUES,
  DATA_QUERY_ALERT_ITEM_STATUS,
  DATA_QUERY_ALERT_SEVERITY_LEVEL,
  DATA_QUERY_ALERT_TYPE_VALUES,
  DATA_QUERY_EMAIL_CATEGORY_VALUES,
  DATA_QUERY_EMAIL_DIRECTION_VALUES,
  DATA_QUERY_EMAIL_ITEM_STATUS,
  DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE,
  DATA_QUERY_EMAIL_RELEVANCE_VALUES,
  DATA_QUERY_CONSULTANT_REPORT_ITEM_STATUS_VALUES,
  DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES,
  DATA_QUERY_EXCEPTION_URGENCY_VALUES,
  DATA_QUERY_LOOKUP_OPERATIONS,
  DATA_QUERY_MANAGED_READ_TRANSPORT,
  DATA_QUERY_MEETING_STATUS_VALUES,
  canonicalizeDataQueryAlertInputType,
  canonicalizeDataQueryAlertType,
  canonicalizeDataQuerySafetyRisk,
  dataQuerySafetyRiskRawValues,
  dataQueryTablePolicy,
  inferDataQueryField,
  validateDataQueryFilterValue
} from "./dataQueryMetadata.js";
import {
  analyzeHebrewEmailRelevance,
  analyzeHebrewExceptionIntent,
  analyzeHebrewConsultantReportIntent,
  normalizeDataQueryHebrewQuestion,
  normalizeHebrewEmailMetricQuestion,
  normalizeHebrewExceptionMetricQuestion,
  normalizeHebrewConsultantReportMetricQuestion
} from "./dataQueryHebrewLexicon.js";
import {
  DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT,
  DATA_QUERY_FINANCIAL_TRANSACTION_TYPE_VALUES,
  analyzeDataQueryFinancialTransactionType,
  dataQueryFinancialTransactionTypeFilter,
  isDataQueryFinancialAllListIntent
} from "./dataQueryFinancialLexicon.js";

export const DATA_QUERY_DEFAULTS = {
  enabled: true,
  maxPlans: 5,
  maxRowsPerPlan: 200,
  timeoutMsPerPlan: 8000,
  totalTimeoutMs: 20000,
  runCacheEnabled: true,
  runCacheTtlMs: 60000,
  allowedTables: [],
  allowedSchemas: ["content"],
  tables: [],
  plannerEnabled: true,
  plannerModel: "",
  plannerTimeoutMs: 30000
};

export const DATA_QUERY_CONTRACT_VERSION = "data-query.v2";

export const DATA_QUERY_CALLER_SOURCES = new Set([
  "main_agent",
  "project_insights",
  "delay_claim",
  "workflow_qa",
  "api"
]);

export const DATA_QUERY_QUANTITATIVE_PATTERN = /כמה|מספר|ספור|ספירה|פילוח|ממוצע|מגמה|לפי סטטוס|לפי תאריך|לפי חומרה|מה הכי הרבה|השוואה בין|תמונת מצב|מדד|\b(?:counts?|how many|number of|breakdown|break\s+down|average|trend|by status|by date|by severity|compare|distribution|total|sum|kpi)\b|\btop(?:\s+\d+)?\b/iu;

const DATA_QUERY_SEMANTIC_PATTERN = /ציטוט|צטט|מי אמר|מי השתתף|מה נאמר|הצג.{0,20}(?:מקור|ראיה)|ראיות|למה|מדוע|סיבה|הסבר|מה הוחלט|הוחלט|החלט(?:ה|ות)|התחייב|משתתפ|נוכח|נוכחות|נימוק|רציונל|מועד|דדליין|סכם|סיכום|תמצת|תמצית|תובנ(?:ה|ות)|ניתוח|מידע\s+כולל|גורם שורש|אחראי|cite|citation|quote|who (?:said|attended|participated)|what (?:did|was).{0,30}say|what was (?:decided|discussed|raised|covered)|decid(?:e|ed|ing|ion|ions)|commitments?|participants?|attendees?|attendance|rationale|deadlines?|due\s+dates?|reason|cause|show.{0,20}(?:source|evidence)|evidence|why|explain|describ(?:e|ed|ing)|summari[sz]e|insights?|analy[sz](?:e|ed|ing|is)|overview|root cause|responsib/iu;
const DATA_QUERY_MEETING_SEMANTIC_DETAIL_PATTERN = /מה\s+עלה|על\s+מה\s+דיברו|what\s+was\s+(?:discussed|raised|covered)/iu;
const DATA_QUERY_LOOKUP_TARGET_PATTERN = /\b(?:invoice|invoices|transaction|transactions|payment|payments|receipt|receipts|meeting|meetings|email|emails|message|messages|conversation|conversations|report|reports|alert|alerts|exception|exceptions|change\s+order|change\s+orders|record|records|document|documents)\b|חשבוני(?:ת|ות)|עסק(?:ה|אות)|תשלו(?:ם|מים)|קבל(?:ה|ות)|ישיב(?:ה|ות)|פגיש(?:ה|ות)|מייל(?:ים)?|הודע(?:ה|ות)|שיח(?:ה|ות)|דוח(?:ות)?|דו["״]?ח(?:ות)?|התרא(?:ה|ות)|חריגים|רשומ(?:ה|ות)|מסמ(?:ך|כים)/iu;
const DATA_QUERY_LOOKUP_TEMPORAL_WINDOW_PATTERN = /\b(?:last|previous|first)\s+(?:day|week|month|quarter|year)\b|(?:ביום|בשבוע|בחודש|ברבעון|בשנה)\s+(?:ה)?(?:אחרון|אחרונה|ראשון|ראשונה)/iu;
const DATA_QUERY_LOOKUP_SORT_ONLY_PATTERN = /\b(?:newest|oldest|latest|earliest)\s+first\b/iu;
const DATA_QUERY_LOOKUP_UNPARSED_NUMBER_PATTERN = /\b(?:twenty[-\s](?:six|seven|eight|nine)|thirty|forty|fifty|sixty|seventy|eighty|ninety|thousand|million)\b|(?:עשרים\s+ו?(?:שש|שישה|שבע|שבעה|שמונה|תשע|תשעה)|שלושים|ארבעים|חמישים|מאה|אלף|מיליון)/iu;
const DATA_QUERY_LOOKUP_ENGLISH_TARGET = "(?:invoices?|transactions?|payments?|receipts?|meetings?|emails?|messages?|conversations?|reports?|alerts?|exceptions?|change\\s+orders?|records?|documents?)";
const DATA_QUERY_LOOKUP_HEBREW_TARGET = "(?:חשבוני(?:ת|ות)|עסק(?:ה|אות)|תשלו(?:ם|מים)|קבל(?:ה|ות)|ישיב(?:ה|ות)|פגיש(?:ה|ות)|מייל(?:ים)?|הודע(?:ה|ות)|שיח(?:ה|ות)|דוח(?:ות)?|דו[\"״]?ח(?:ות)?|התרא(?:ה|ות)|חריגים|רשומ(?:ה|ות)|מסמ(?:ך|כים))";
const DATA_QUERY_BET_PREFIXED_LATEST_INVOICE_PATTERN = /^\s*מה\s+עלה\s+בחשבונית\s+ה?אחרונה\s*[?.!]?\s*$/iu;
const DATA_QUERY_BET_PREFIXED_INVOICE_REFERENCE_PATTERN = /בחשבוני(?:ת|ות)(?=\s|[?.!,]|$)/iu;
const DATA_QUERY_FINANCIAL_SEMANTIC_DETAIL_PATTERN = /מה\s+(?:כתוב|עלה)|אילו\s+(?:פריטים|שורות|סעיפים)|(?:של|מאת)\s+ספק|\bwhat\b.{0,45}\b(?:contain|say|mean|include|items?|details?)\b|\bfrom\s+(?:a\s+)?(?:supplier|vendor)\b/iu;
const DATA_QUERY_FINANCIAL_DOCUMENT_PATTERN = /\bfinancial\s+(?:documents?|records?)\b|(?:מסמ(?:ך|כים)|רשומ(?:ה|ות))\s+פיננס(?:י|ית|יים|יות|ים)/iu;
const DATA_QUERY_SAFETY_REPORT_PATTERN = /\bsafety\s+reports?\b|(?:דוח(?:ות)?|דו["״]?ח(?:ות)?)\s+(?:ה)?בטיחות/iu;
const DATA_QUERY_SAFETY_WORKER_AGGREGATE_PATTERN = /\b(?:total|sum|average|avg|minimum|min|maximum|max)\b.{0,30}\bworkers?\b|\bworkers?\b.{0,30}\b(?:total|sum|average|avg|minimum|min|maximum|max)\b|סך.{0,20}עובדים|סכום.{0,20}עובדים|ממוצע.{0,20}עובדים|מינימום.{0,20}עובדים|מקסימום.{0,20}עובדים/iu;
const DATA_QUERY_SAFETY_RESOLUTION_PATTERN = /\bunresolved\b|\bresolved\b|\bopen\b|\bclosed\b|לא\s+נפתר|לא\s+טופל|פתוח(?:ים|ות)?|סגור(?:ים|ות)?|נפתר(?:ו|ה)?|טופל(?:ו|ה)?/iu;
const DATA_QUERY_SAFETY_SEMANTIC_DEFECT_PATTERN = /\bwhat\b.{0,50}\bdefects?\b|\b(?:describe|explain|summarize)\b.{0,50}\bdefects?\b|\bdefect\s+details?\b|אילו.{0,40}ליקוי|מה.{0,40}ליקוי|תאר.{0,40}ליקוי|פרט.{0,40}ליקוי/iu;
const DATA_QUERY_MEETING_DECISION_METRIC_PATTERN = /\b(?:how\s+many|count|number\s+of|percentage|percent)\b.{0,55}\bmeetings?\b.{0,55}\b(?:decisions?|commitments?|action\s+items?|deadlines?|responsibilit(?:y|ies))\b|\b(?:how\s+many|count|number\s+of|percentage|percent)\b.{0,55}\b(?:decisions?|commitments?|action\s+items?|deadlines?|responsibilit(?:y|ies))\b.{0,55}\bmeetings?\b|\bmeetings?\b.{0,55}\b(?:with|containing|having)\b.{0,25}\b(?:decisions?|commitments?|action\s+items?|deadlines?|responsibilit(?:y|ies))\b|כמה.{0,45}ישיב(?:ה|ות).{0,45}(?:החלט|התחייב|משימ|מועד|אחריות)|כמה.{0,45}(?:החלט|התחייב|משימ|מועד|אחריות).{0,45}ישיב(?:ה|ות)|ישיב(?:ה|ות).{0,45}(?:עם|שמכיל).{0,25}(?:החלט|התחייב|משימ|מועד|אחריות)/iu;
const DATA_QUERY_MEETING_ATTENDANCE_METRIC_PATTERN = /\b(?:how\s+many|count|number\s+of|unique|distinct)\b.{0,55}\b(?:meeting\s+)?(?:attendees?|participants?|people|persons?)\b|\bmeetings?\b.{0,45}\b(?:attended\s+by|with\s+attendees?|with\s+participants?)\b|כמה.{0,45}(?:משתתפ|נוכח|אנש)|(?:משתתפ|נוכח).{0,45}ישיב/iu;
const DATA_QUERY_MEETING_INGESTION_TIME_PATTERN = /\b(?:created_at|creation|ingestion|ingested|created)\b.{0,60}\bmeetings?\b|\bmeetings?\b.{0,60}\b(?:created_at|creation|ingestion|ingested|created)\b|(?:created_at|יצירה|קליטה|נקלט).{0,60}ישיב|ישיב.{0,60}(?:created_at|יצירה|קליטה|נקלט)/iu;
const DATA_QUERY_MEETING_SCOPE_FIELD_PATTERN = /\b(?:project_id|project\s+id|meeting\s+id|record\s+id|attachment\s+id|mail\s+id|filename|file\s+name)\b|(?:מזהה\s+(?:פרויקט|ישיבה|רשומה|קובץ|מצורף|מייל)|שם\s+קובץ)/iu;
const DATA_QUERY_MEETING_UNAPPROVED_QUALIFIER_PATTERN = /\bmeetings?\b.{0,45}\b(?:about|regarding|concerning|for\s+project|from\s+project|with\s+subject|whose\s+subject|containing|attended\s+by|organized\s+by|led\s+by)\b|\b(?:project|person|vendor|contractor|manager)\b.{0,35}\bmeetings?\b|ישיב(?:ה|ות).{0,45}(?:בנושא|לגבי|בקשר\s+ל|בפרויקט|של\s+פרויקט|בהשתתפות|עם\s+משתתפ|שמכיל)|(?:פרויקט|אדם|ספק|קבלן|מנהל).{0,35}ישיב/iu;
const DATA_QUERY_MEETING_MIXED_LATEST_DECISION_PATTERN = /^(?:(?:what|when)\s+(?:was|is)\s+the\s+(?:latest|most\s+recent)\s+meeting\s*,?\s+(?:and\s+)?what\s+was\s+(?:decided|discussed|raised|covered)\s+in\s+(?:it|that(?:\s+same)?\s+meeting|the\s+same\s+meeting)|(?:מה|מתי)\s+הייתה\s+הישיבה\s+האחרונה\s+ומה\s+(?:הוחלט\s+באותה\s+ישיבה|עלה\s+בה|נאמר\s+בה|נדון\s+בה|דובר\s+בה|היה\s+בה))\s*[?.!]*$/iu;
const DATA_QUERY_EMAIL_SEMANTIC_DETAIL_PATTERN = /\b(?:what|which)\b.{0,45}\bemails?\b.{0,45}\b(?:request(?:ed|s)?|approv(?:e|ed|al|als)|reject(?:ed|ion|ions)?|say|said|mean|discuss(?:ed)?|contain(?:ed|s)?|summari[sz](?:e|ed)|intent|body|subject|quote)\b|\bemails?\b.{0,55}\b(?:request(?:ed|s)?|approv(?:e|ed|al|als)|reject(?:ed|ion|ions)?|say|said|mean|discuss(?:ed)?|contain(?:ed|s)?|summari[sz](?:e|ed)|intent|body|subject|quote)\b|(?:מה|אילו).{0,45}מייל(?:ים)?.{0,45}(?:ביקש|אישר|אישור|דחה|דחייה|נאמר|נכתב|תוכן|נושא|סיכום|כוונה|ציטוט)|מייל(?:ים)?.{0,55}(?:ביקש|אישר|אישור|דחה|דחייה|נאמר|נכתב|תוכן|נושא|סיכום|כוונה|ציטוט)/iu;
const DATA_QUERY_EMAIL_TIMELINE_IMPACT_PATTERN = /\b(?:what|which)\b.{0,30}\bemails?\b.{0,55}\b(?:affect|impact|delay|change|threaten|block)(?:s|ed|ing)?\b.{0,35}\b(?:project\s+)?(?:timeline|schedule|deadline|milestone)s?\b|\bemails?\b.{0,55}\b(?:affect|impact|delay|change|threaten|block)(?:s|ed|ing)?\b.{0,35}\b(?:project\s+)?(?:timeline|schedule|deadline|milestone)s?\b|(?:אילו|מה).{0,30}מייל(?:ים)?.{0,55}(?:משפיע|משפיעים|השפיע|מעכב|מעכבים|עיכב|משנה|משנים|שינה|מסכן|מסכנים|חוסם|חוסמים).{0,35}(?:לוח\s+הזמנים|הלו[״"]?ז|מועד|אבן\s+דרך)|מייל(?:ים)?.{0,55}(?:משפיע|משפיעים|השפיע|מעכב|מעכבים|עיכב|משנה|משנים|שינה|מסכן|מסכנים|חוסם|חוסמים).{0,35}(?:לוח\s+הזמנים|הלו[״"]?ז|מועד|אבן\s+דרך)/iu;
const DATA_QUERY_EMAIL_SPAM_PATTERN = /\b(?:spam|junk(?:\s+mail)?|unsolicited)\b|(?:דואר\s+זבל|ספאם|זבל)/iu;
const DATA_QUERY_EMAIL_PII_PATTERN = /\b(?:unique|distinct|how\s+many|count|number\s+of)\b.{0,35}\b(?:senders?|recipients?|people|persons?|email\s+addresses?)\b|\bemails?\b.{0,40}\b(?:from|sent\s+by|to|received\s+by)\b.{0,35}\b(?:person|vendor|contractor|company|manager|sender|recipient)\b|כמה.{0,35}(?:שולח|נמען|אנש|כתובות)|מייל(?:ים)?.{0,40}(?:מאת|נשלח\s+על\s+ידי|אל).{0,35}(?:אדם|ספק|קבלן|חברה|מנהל|שולח|נמען)/iu;
const DATA_QUERY_EMAIL_ATTACHMENT_DETAIL_PATTERN = /\b(?:how\s+many|count|list|show)\b.{0,35}\battachments?\b|\battachment\b.{0,30}\b(?:names?|filenames?|links?|urls?|documents?)\b|כמה.{0,35}(?:קבצים|מצורפים)|(?:שם|שמות|קישור|קישורים).{0,25}(?:קובץ|מצורף)/iu;
const DATA_QUERY_EMAIL_ATTACHMENT_FLAG_METRIC_PATTERN = /\b(?:how\s+many|count|number\s+of)\s+(?:the\s+)?(?:project[-\s]?related\s+)?emails?\s+(?:with|without)\s+attachments?(?:\s+are\s+there)?\b|כמה\s+מייל(?:ים)?\s+(?:עם|ללא|בלי)\s+(?:קובץ|קבצים|מצורף|מצורפים)/iu;
const DATA_QUERY_EMAIL_INGESTION_TIME_PATTERN = /\b(?:created_at|creation|ingestion|ingested|created)\b.{0,60}\bemails?\b|\bemails?\b.{0,60}\b(?:created_at|creation|ingestion|ingested|created)\b|(?:created_at|יצירה|קליטה|נקלט).{0,60}מייל|מייל.{0,60}(?:created_at|יצירה|קליטה|נקלט)/iu;
const DATA_QUERY_EMAIL_SCOPE_FIELD_PATTERN = /\b(?:project_id|project\s+id|email\s+id|record\s+id|mail\s+id|conversation\s+id)\b|מזהה\s+(?:פרויקט|מייל|רשומה|שיחה)/iu;
const DATA_QUERY_EXCEPTION_REPORT_PATTERN = /\b(?:exception|exceptions|exception\s+reports?|change\s+orders?|additional\s+work|extra\s+costs?|contract\s+deviations?|irregularit(?:y|ies))\b|(?:[בלמכושה])?(?:ה)?חריגים(?=\s|[?.!,;]|$)/iu;
const DATA_QUERY_CONSULTANT_REPORT_PATTERN = /\bconsultant(?:'s)?\s+reports?\b|\bconsultancy\s+reports?\b|(?:דוח(?:ות)?|דו[״"']?ח(?:ות)?)\s+(?:ה)?יוע(?:ץ|צים)|חוות\s+דעת\s+(?:של\s+)?(?:ה)?יוע(?:ץ|צים)/iu;
const DATA_QUERY_CONSULTANT_SEMANTIC_DETAIL_PATTERN = /\b(?:recommendations?|recommended|proposed\s+actions?|topic|speciali[sz]ation|summari[sz]e|summary|what\s+did\s+the\s+consultant\s+say)\b|(?:המלצות?|המליץ|המליצה|פעולות?\s+מוצעות?|נושא\s+הדוח|תחום\s+התמחות|סכ(?:ם|מי)|תקציר)/iu;
const DATA_QUERY_CONSULTANT_MIXED_LATEST_PATTERN = /(?:latest|most\s+recent|last|אחרון|האחרון|אחרונה|האחרונה).{0,60}(?:consultant|יועץ).{0,80}(?:summari[sz]|recommend|סכ|המלצ)|(?:consultant|יועץ).{0,60}(?:latest|most\s+recent|last|אחרון|האחרון|אחרונה|האחרונה).{0,80}(?:summari[sz]|recommend|סכ|המלצ)/iu;
const DATA_QUERY_CONSULTANT_INGESTION_TIME_PATTERN = /\b(?:created_at|creation|ingestion|ingested|created)\b.{0,60}\bconsultant\s+reports?\b|\bconsultant\s+reports?\b.{0,60}\b(?:created_at|creation|ingestion|ingested|created)\b|(?:created_at|זמן\s+קליטה|יצירה|קליטה|נקלט).{0,60}(?:דוח|דוחות).{0,20}יוע(?:ץ|צים)|(?:דוח|דוחות).{0,20}יוע(?:ץ|צים).{0,60}(?:created_at|זמן\s+קליטה|יצירה|קליטה|נקלט)/iu;
const DATA_QUERY_CONSULTANT_IDENTITY_PATTERN = /\b(?:consultant|company|vendor)\s+(?:name|names)|\b(?:group|count|break\s*down).{0,40}\bby\s+consultant\b|שם\s+(?:ה)?יועץ|לפי\s+(?:ה)?יועץ/iu;
const DATA_QUERY_CONSULTANT_CATEGORY_PATTERN = /\b(?:group|count|break\s*down).{0,45}\bby\s+(?:speciali[sz]ation|topic)\b|לפי\s+(?:תחום\s+התמחות|נושא)/iu;
const DATA_QUERY_CONSULTANT_IMPLEMENTATION_PATTERN = /\b(?:implementation\s+status|implemented|completed|approved|rejected|open|closed|resolved)\b|סטטוס\s+יישום|יוש(?:ם|מה|מו)|בוצע(?:ה|ו)?|הושל(?:ם|מה|מו)|אושר(?:ה|ו)?|נדח(?:ה|ו)|פתוח|סגור/iu;
const DATA_QUERY_CONSULTANT_SCOPE_FIELD_PATTERN = /\b(?:project_id|report\s+id|record\s+id|attachment\s+id|mail\s+id|filename|file\s+name)\b|מזהה\s+(?:פרויקט|דוח|רשומה|מצורף|מייל)|שם\s+קובץ/iu;
const DATA_QUERY_EXCEPTION_SEMANTIC_DETAIL_PATTERN = /\b(?:why|explain|describe|evidence|reason|cause|consequence|impact|responsib|approv|reject|narrative|summary|subject)\w*\b.{0,70}\b(?:exceptions?|change\s+orders?)\b|\b(?:exceptions?|change\s+orders?)\b.{0,70}\b(?:why|explain|describe|evidence|reason|cause|consequence|impact|responsib|approv|reject|narrative|summary|subject)\w*\b|(?:למה|מדוע|הסבר|תאר(?=\s|[?.!,;]|$)|ראיות|סיבה|גורם|השלכה|השפעה|אחריות|אישור|דחייה|נושא|סיכום|תמצת|תמצית).{0,70}חריגים|חריגים.{0,70}(?:למה|מדוע|הסבר|תאר(?=\s|[?.!,;]|$)|ראיות|סיבה|גורם|השלכה|השפעה|אחריות|אישור|דחייה|נושא|סיכום|תמצת|תמצית)/iu;
const DATA_QUERY_EXCEPTION_AMOUNT_PATTERN = /\b(?:(?:total|average|avg|sum(?:\s+of)?)\s+)?(?:requested\s+)?(?:amount|amounts|money|cost|costs|price|prices|currency|vat|profit)\b.{0,60}\b(?:exceptions?|change\s+orders?)\b|\b(?:exceptions?|change\s+orders?)\b.{0,60}\b(?:(?:total|average|avg|sum(?:\s+of)?)\s+)?(?:requested\s+)?(?:amount|amounts|money|cost|costs|price|prices|currency|vat|profit)\b|(?:סכום|סכומים|עלות|עלויות|מחיר|כסף|מטבע|מע[״"]?מ|רווח).{0,60}חריגים|חריגים.{0,60}(?:סכום|סכומים|עלות|עלויות|מחיר|כסף|מטבע|מע[״"]?מ|רווח)/iu;
const DATA_QUERY_EXCEPTION_EXECUTION_DAYS_PATTERN = /\b(?:execution|completion|implementation)\s+(?:days?|time|duration)\b.{0,50}\b(?:exceptions?|change\s+orders?)\b|\b(?:exceptions?|change\s+orders?)\b.{0,50}\b(?:execution|completion|implementation)\s+(?:days?|time|duration)\b|(?:ימי\s+ביצוע|זמן\s+ביצוע|משך\s+ביצוע).{0,50}חריגים|חריגים.{0,50}(?:ימי\s+ביצוע|זמן\s+ביצוע|משך\s+ביצוע)/iu;
const DATA_QUERY_EXCEPTION_IDENTITY_PATTERN = /\b(?:exceptions?|change\s+orders?)\b.{0,45}\b(?:by|per|for\s+each|from)\s+(?:inspectors?|managers?|contractors?|compan(?:y|ies)|vendors?)\b|\b(?:inspectors?|managers?|contractors?|compan(?:y|ies)|vendors?)\b.{0,45}\b(?:exceptions?|change\s+orders?)\b|חריגים.{0,45}(?:לפי|של)\s+(?:מפקח|מפקחת|מפקחים|מנהל|מנהלת|קבלן|קבלנית|קבלנים|חברה|חברות|ספק|ספקים)|(?:מפקח|מפקחת|מפקחים|מנהל|מנהלת|קבלן|קבלנית|קבלנים|חברה|חברות|ספק|ספקים).{0,45}חריגים/iu;
const DATA_QUERY_EXCEPTION_CATEGORY_PATTERN = /\b(?:exceptions?|change\s+orders?)\b.{0,35}\b(?:by\s+category|categories|category\s+breakdown)\b|\b(?:category|categories)\b.{0,35}\b(?:exceptions?|change\s+orders?)\b|חריגים.{0,35}(?:לפי\s+קטגור|קטגוריות|פילוח\s+קטגור)|(?:קטגוריה|קטגוריות).{0,35}חריגים/iu;
const DATA_QUERY_EXCEPTION_SCOPE_FIELD_PATTERN = /\b(?:project_id|project\s+id|exception\s+id|record\s+id|attachment\s+id|mail\s+id|exception\s+number)\b|מזהה\s+(?:פרויקט|חריג|רשומה|קובץ|מצורף|מייל)|מספר\s+חריג/iu;
const DATA_QUERY_EXCEPTION_INGESTION_TIME_PATTERN = /\b(?:created_at|creation|ingestion|ingested|created)\b.{0,60}\b(?:exceptions?|change\s+orders?)\b|\b(?:exceptions?|change\s+orders?)\b.{0,60}\b(?:created_at|creation|ingestion|ingested|created)\b|(?:created_at|יצירה|קליטה|נקלט).{0,60}חריגים|חריגים.{0,60}(?:created_at|יצירה|קליטה|נקלט)/iu;
const DATA_QUERY_EXCEPTION_LIFECYCLE_PATTERN = /\b(?:approved|rejected|open|closed|resolved|unresolved|pending|completed|cancelled|canceled)\b.{0,50}\b(?:exceptions?|change\s+orders?)\b|\b(?:exceptions?|change\s+orders?)\b.{0,50}\b(?:approved|rejected|open|closed|resolved|unresolved|pending|completed|cancelled|canceled)\b|(?:אושר|אושרה|אושרו|נדחה|נדחתה|נדחו|פתוח|פתוחים|סגור|סגורים|נפתר|לא\s+נפתר|ממתין|הושלם|בוטל).{0,50}חריגים|חריגים.{0,50}(?:אושר|אושרה|אושרו|נדחה|נדחתה|נדחו|פתוח|פתוחים|סגור|סגורים|נפתר|לא\s+נפתר|ממתין|הושלם|בוטל)/iu;
const DATA_QUERY_EXCEPTION_MIXED_LATEST_PATTERN = /^(?:(?:what|which)\s+(?:is|was)|show|give\s+me)\s+the\s+(?:latest|most\s+recent)\s+(?:exception(?:\s+report)?|change\s+order)\s*,?\s+(?:and\s+)?(?:why|explain|describe|summari[sz]e|what\s+(?:happened|caused|was\s+the\s+reason))|^(?:(?:מה|מהו|מהי|איזה)\s+|(?:הצג|הראה|תראה|תאר)(?:\s+לי)?\s+(?:את\s+)?)(?:דוח\s+)?(?:ה)?חריג(?:ים)?\s+(?:ה)?אחרו(?:ן|נה)\s+ו(?:למה|מדוע|מה\s+(?:קרה|הסיבה)|הסבר|תאר|סכם|תמצת)(?:\s+לי)?(?:\s+(?:אותו|אותה))?/iu;
const DATA_QUERY_ALERT_SEMANTIC_SEVERITY_PATTERN = /\b(?:critical|high|medium|low|urgent|urgency|highest|lowest|severe|major|minor|moderate)\b.{0,30}\b(?:severity|alerts?)\b|\b(?:severity|alerts?)\b.{0,30}\b(?:critical|high|medium|low|urgent|urgency|highest|lowest|severe|major|minor|moderate)\b|(?:קריטי|קריטית|גבוה|גבוהה|בינוני|בינונית|נמוך|נמוכה|דחוף|דחופה|חמור|חמורה|משמעותי|משמעותית|קל(?:ה)?(?=\s|[?.!,]|$)|מתון|מתונה|הכי\s+חמור).{0,30}(?:חומרה|התרא)|(?:חומרה|התרא).{0,30}(?:קריטי|קריטית|גבוה|גבוהה|בינוני|בינונית|נמוך|נמוכה|דחוף|דחופה|חמור|חמורה|משמעותי|משמעותית|קל(?:ה)?(?=\s|[?.!,]|$)|מתון|מתונה)/iu;
const DATA_QUERY_ALERT_UNAPPROVED_STORED_SEVERITY_PATTERN = /\b(?:stored\s+)?severity(?:\s+level)?\s+(?:equals?\s+|is\s+)?(?!3\b)\d+\b|(?:רמת\s+)?חומרה\s+(?:שמורה\s+)?(?:היא\s+)?(?!3\b)\d+\b/iu;
const DATA_QUERY_ALERT_SEVERITY_ARITHMETIC_PATTERN = /\b(?:average|avg|sum|total|minimum|min|maximum|max|top(?:\s+\d+)?)\b.{0,30}\b(?:alert\s+)?severity\b|\b(?:alert\s+)?severity\b.{0,30}\b(?:average|avg|sum|total|minimum|min|maximum|max|top(?:\s+\d+)?)\b|(?:ממוצע|סכום|סך|מינימום|מקסימום).{0,30}(?:חומרת\s+התראות|רמת\s+חומרה)|(?:חומרת\s+התראות|רמת\s+חומרה).{0,30}(?:ממוצע|סכום|סך|מינימום|מקסימום)/iu;
const DATA_QUERY_ALERT_LIFECYCLE_PATTERN = /\b(?:open|closed|resolved|unresolved|active|inactive|acknowledged|unacknowledged|escalated|pending|completed|complete|new|in[-\s]?progress|cancelled|canceled)\b|פתוח(?:ים|ות)?|סגור(?:ים|ות)?|נפתר(?:ו|ה)?|לא\s+נפתר|פעיל(?:ים|ות)?|לא\s+פעיל|אושר(?:ו|ה)?|הוסלמ(?:ו|ה)?|ממתינ(?:ים|ות)?|הושלמ(?:ו|ה)?|חדש(?:ים|ות)?|בתהליך|בביצוע|בוטל(?:ו|ה)?/iu;
const DATA_QUERY_ALERT_UNVERIFIED_STATUS_PATTERN = /\b(?:alerts?\s+by\s+status|by\s+alert\s+status|alert\s+status)\b|התרא(?:ה|ות).{0,20}לפי\s+סטטוס|לפי\s+סטטוס\s+התרא/iu;
const DATA_QUERY_ALERT_UNIQUE_SOURCE_PATTERN = /\b(?:unique|distinct)\s+(?:incidents?|issues?|messages?|emails?|documents?|attachments?|sources?)\b|\b(?:how\s+many|count|number\s+of)\b.{0,30}\b(?:incidents?|issues?|messages?|emails?|documents?|attachments?|sources?)\b.{0,40}\b(?:produced?|triggered?|generated?|caused?|created?)\b.{0,20}\balerts?\b|\b(?:count|how\s+many)\s+(?:incidents?|issues?|messages?|emails?|documents?|attachments?|sources?)\s+that\s+(?:produced?|triggered?|generated?|caused?|created?)\s+alerts?\b|כמה\s+(?:אירועים|תקריות|בעיות|הודעות|מיילים|מסמכים|קבצים|מקורות)(?:\s+(?:ייחודיים|שונים))?.{0,40}(?:יצרו|הפיקו|גרמו|הפעילו)\s+התרא/iu;
const DATA_QUERY_ALERT_DISTINCT_VALUE_PATTERN = /\b(?:how\s+many\s+)?(?:unique|distinct)\s+(?:alert\s+)?(?:types?|categories|input\s+types?|statuses|severity\s+levels?)\b|כמה\s+(?:סוגי\s+התראות|קטגוריות|סוגי\s+קלט|סטטוסים|רמות\s+חומרה)\s+(?:ייחודיים|שונים)?/iu;
const DATA_QUERY_ALERT_UNSUPPORTED_GRANULARITY_PATTERN = /\b(?:by|per)\s+(?:hour|week|quarter|year)s?\b|\b(?:hourly|weekly|quarterly|yearly|annual)\b|לפי\s+(?:שעה|שבוע|רבעון|שנה)|(?:שעתי|שבועי|רבעוני|שנתי)/iu;
const DATA_QUERY_ALERT_NUMERIC_AGGREGATE_PATTERN = /\b(?:average|avg|mean|sum|minimum|min|maximum|max)\b.{0,40}\balerts?\b|\balerts?\b.{0,40}\b(?:average|avg|mean|sum|minimum|min|maximum|max)\b|\btop(?:\s+\d+)?\b.{0,40}\b(?:alerts?|alert\s+types?|alert\s+input\s+types?|days?|months?)\b|\b(?:most|least)\s+alerts?\b|(?:ממוצע|סכום|מינימום|מקסימום).{0,40}התרא|התרא.{0,40}(?:ממוצע|סכום|מינימום|מקסימום)|(?:שלושת|חמשת|עשרת)\s+(?:סוגי\s+ההתראות|הימים|החודשים).{0,20}(?:המובילים|עם\s+הכי\s+הרבה)/iu;
const DATA_QUERY_ALERT_SOURCE_LINK_PATTERN = /\b(?:source|document)\s+links?\b|\blink(?:s)?\s+to\s+(?:the\s+)?sources?\b|\balerts?\b.{0,30}\b(?:have|with|containing)\b.{0,15}\b(?:links?|data_link|source\s+urls?)\b|קישור(?:ים)?\s+(?:למקור|למסמך|למקורות|למסמכים)|התרא(?:ה|ות).{0,30}(?:עם|מכילות).{0,15}קישור/iu;
const DATA_QUERY_ALERT_SEMANTIC_DETAIL_PATTERN = /\b(?:why|explain|describe|evidence|reason|cause|valid|correct|important|actionable|recommend|responsib)\w*\b.{0,60}\balerts?\b|\balerts?\b.{0,60}\b(?:why|explain|describe|evidence|reason|cause|valid|correct|important|actionable|recommend|responsib|descriptions?|summar(?:y|ies)|corrective\s+actions?)\w*\b|\b(?:alert\s+)?(?:descriptions?|summar(?:y|ies)|recommendations?|evidence|reasons?|responsibility|corrective\s+actions?)\b.{0,50}\balerts?\b|\b(?:what\s+action\s+should\s+we\s+take|recommend\s+(?:a\s+)?corrective\s+action)\b.{0,50}\balerts?\b|(?:למה|מדוע|הסבר|תאר|ראיות|סיבה|גורם|תקף|נכון|חשוב|פעולה|המלצה|אחראי|תיאור|סיכום).{0,60}התרא|התרא.{0,60}(?:למה|מדוע|הסבר|תאר|ראיות|סיבה|גורם|תקף|נכון|חשוב|פעולה|המלצה|אחראי|תיאור|סיכום)/iu;
const DATA_QUERY_ALERT_HEBREW_LATEST_RAISED_WHY_PATTERN = /^(?:מה|מהי)\s+(?:ה)?התראה\s+(?:ה)?אחרונה\s+שעלתה\s+ולמה\s+היא\s+עלתה\s*[?.!]*$/iu;
const DATA_QUERY_ALERT_SEMANTIC_FILTER_PATTERN = /\b(?:valid|correct|important|actionable)\s+alerts?\b|\balerts?\b.{0,30}\b(?:are|that\s+are|which\s+are|considered|deemed|have|with)\b.{0,20}\b(?:valid|correct|important|actionable|descriptions?|summar(?:y|ies)|recommendations?|evidence|reasons?|responsib\w*)\b|(?:תקפות|נכונות|חשובות|ברות\s+פעולה)\s+התראות|התרא(?:ה|ות).{0,35}(?:תקפ|נכו|חשוב|פעולה|תיאור|סיכום|המלצ|ראי|סיב|אחרא)/iu;
const DATA_QUERY_ALERT_INGESTION_TIME_PATTERN = /\b(?:created_at|creation|ingestion|ingested|created)\b.{0,60}\balerts?\b|\balerts?\b.{0,60}\b(?:created_at|creation|ingestion|ingested|created)\b|(?:created_at|יצירה|קליטה|נקלט).{0,60}התרא|התרא.{0,60}(?:created_at|יצירה|קליטה|נקלט)/iu;
const DATA_QUERY_ALERT_EXCLUDED_STATUS_PATTERN = /\balerts?\b.{0,35}\b(?:have|with|containing)\b.{0,15}\b(?:a\s+)?status(?:\s+value)?\b|\bstatus\b.{0,30}\b(?:present|populated|missing|null|empty)\b.{0,30}\balerts?\b|התרא(?:ה|ות).{0,30}(?:עם|ללא).{0,15}סטטוס/iu;
const DATA_QUERY_ALERT_SCOPE_FIELD_PATTERN = /\b(?:project_id|project\s+id|alert\s+id|record\s+id)\b|(?:מזהה\s+פרויקט|מזהה\s+התראה|מזהה\s+רשומה)/iu;
const DATA_QUERY_ALERT_AMBIGUOUS_QUALIFIER_PATTERN = /\bsafety\s+alerts?\b|\breport\s+alerts?\b|\balerts?\s+from\s+reports?\b|התראות\s+בטיחות(?!\s+מסוג\s+אירוע)|התראות\s+מדוחות/iu;
const DATA_QUERY_ALERT_UNDATED_PATTERN = /\bundated\s+alerts?\b|\balerts?\b.{0,30}\b(?:(?:have|with)\s+no|without|missing|null)\b.{0,12}\b(?:data_)?date\b|\balerts?\b.{0,20}\bdata_date\s+(?:is\s+)?null\b|התרא(?:ה|ות).{0,30}(?:ללא|חסר|חסרות).{0,12}תאריך|התרא(?:ה|ות).{0,20}data_date\s+null/iu;
const DATA_QUERY_ALERT_DATED_COUNT_PATTERN = /\b(?:how\s+many|count|number\s+of|total)\b.{0,30}\bdated\s+alerts?\b|\b(?:how\s+many|count|number\s+of|total)\b.{0,30}\balerts?\b.{0,20}\b(?:have|with)\b.{0,10}\b(?:a\s+)?date\b|כמה.{0,30}התראות.{0,20}(?:עם|בעלות)\s+תאריך/iu;
const DATA_QUERY_MANAGED_READ_TABLES = new Set(["financial_transactions", "safety_reports", "alerts", "meetings", "emails", "exceptions_report", "consultants_reports"]);
const DATA_QUERY_MANAGED_READ_PATHS = new Map([
  ["financial_transactions", "financial_transactions"],
  ["safety_reports", "safety_reports"],
  ["alerts", "alerts"],
  ["meetings", "meetings"],
  ["emails", "emails"],
  ["exceptions_report", "exceptions_report"],
  ["consultants_reports", "consultants_reports"]
]);
const DATA_QUERY_PROJECT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_QUERY_UNSAFE_IDENTITY_CHARACTERS = /[\u0000-\u001f\u007f]/;
const DATA_QUERY_MAX_ATTACHMENT_ID_LENGTH = 2048;
const DATA_QUERY_RUN_CACHE = new Map();

const READ_OPERATIONS = new Set([...DATA_QUERY_EXACT_OPERATIONS, ...DATA_QUERY_LOOKUP_OPERATIONS]);
const FILTER_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const DANGEROUS_SQL = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call)\b|;|--|\/\*/i;
const DATA_QUERY_CALLER_SCOPE_FILTER = Symbol("data_query_caller_scope_filter");

export function dataQuerySettings(config = getConfig()) {
  const saved = readLocalSettings().subagents?.dataQuery || {};
  const raw = { ...DATA_QUERY_DEFAULTS, ...saved };
  // When the user has scanned the real DB and picked tables, the manifest and
  // allowlists are derived from that selection; otherwise fall back to the
  // single canonical exact data_index contract.
  // This agent is restricted to the CONTENT connection only — it must never touch
  // the main/app Supabase. Any "app" selection is dropped and the manifest is
  // filtered to content tables.
  const selectionTables = normalizeSelectionTables(raw.tables).filter((item) => item.connection === "content");
  const hasSelection = selectionTables.length > 0;
  const builtInManifest = buildDataQueryManifest(config);
  const selectedManifest = hasSelection
    ? buildDataQueryManifestFromSelection(selectionTables, config)
    : [];
  // Saved table selections predate the reviewed financial policy in existing
  // deployments. Keep those user selections intact, but merge the credential-
  // gated built-in financial contract so an old data_index-only setting cannot
  // silently disable the approved exact route.
  const requiredBuiltIns = builtInManifest.filter((table) =>
    DATA_QUERY_MANAGED_READ_TABLES.has(table.tableName) && dataQueryExactAvailable(table)
  );
  const manifest = mergeDataQueryManifest(
    hasSelection ? [...selectedManifest, ...requiredBuiltIns] : builtInManifest
  ).filter((table) => table.schemaAlias === "content");
  const allowedTables = [...new Set(manifest.map((table) => table.tableName))];
  const allowedSchemas = ["content"];
  return {
    enabled: raw.enabled !== false,
    maxPlans: clampNumber(raw.maxPlans, 1, 10, DATA_QUERY_DEFAULTS.maxPlans),
    maxRowsPerPlan: clampNumber(raw.maxRowsPerPlan, 1, 1000, DATA_QUERY_DEFAULTS.maxRowsPerPlan),
    timeoutMsPerPlan: clampNumber(raw.timeoutMsPerPlan, 1000, 60000, DATA_QUERY_DEFAULTS.timeoutMsPerPlan),
    totalTimeoutMs: clampNumber(raw.totalTimeoutMs, 1000, 120000, DATA_QUERY_DEFAULTS.totalTimeoutMs),
    runCacheEnabled: raw.runCacheEnabled !== false,
    runCacheTtlMs: clampNumber(raw.runCacheTtlMs, 1000, 300000, DATA_QUERY_DEFAULTS.runCacheTtlMs),
    allowedTables,
    allowedSchemas,
    tables: selectionTables,
    usingSelection: hasSelection,
    plannerEnabled: raw.plannerEnabled !== false,
    plannerModel: String(raw.plannerModel || "").trim(),
    plannerTimeoutMs: clampNumber(raw.plannerTimeoutMs, 5000, 90000, DATA_QUERY_DEFAULTS.plannerTimeoutMs),
    manifest
  };
}

function mergeDataQueryManifest(tables = []) {
  const merged = new Map();
  for (const table of tables) {
    const key = `${table.schemaAlias}.${table.tableName}`;
    // Later reviewed built-ins replace same-name saved selections while Map
    // preserves the user's existing table order.
    merged.set(key, table);
  }
  return [...merged.values()];
}

export function dataQueryLookupAvailable(settings = {}, lookup = null) {
  return (Array.isArray(settings.manifest) ? settings.manifest : []).some((table) =>
    table.schemaAlias === "content" &&
    dataQueryExactAvailable(table) &&
    table.lookupPolicy?.enabled === true &&
    (!lookup || (Boolean(lookup.targetTable) && table.tableName === lookup.targetTable)) &&
    (!lookup?.operation || table.lookupPolicy.operations?.includes(lookup.operation))
  );
}

function dataQueryExactAvailable(table) {
  if (table?.exactRpc) return true;
  return DATA_QUERY_MANAGED_READ_TABLES.has(table?.tableName) &&
    table?.exactTransport === DATA_QUERY_MANAGED_READ_TRANSPORT;
}

function dataQueryReadCredentialsConfigured(config = {}) {
  const safeConfig = config || {};
  const managedIdentity = Boolean(
    String(safeConfig.dataQueryServiceEmail || "").trim() &&
    String(safeConfig.dataQueryServicePassword || "")
  );
  return managedIdentity || Boolean(String(safeConfig.dataQueryReadAccessToken || "").trim());
}

function activateDataQueryPolicy(policy, config) {
  if (!policy?.managedReadTransport) return policy;
  const active = dataQueryReadCredentialsConfigured(config);
  return {
    ...policy,
    exactTransport: active ? policy.managedReadTransport : null,
    executionContract: {
      ...(policy.executionContract || {}),
      status: active ? "active" : "dormant"
    }
  };
}

// Normalizes the user's saved table picks: [{ connection, schema, table, columns[] }].
export function normalizeSelectionTables(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const table = String(item?.table || item?.name || "").trim();
    if (!table) continue;
    const connection = String(item?.connection || item?.schema || "content").trim() || "content";
    const key = `${connection}.${table}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      connection,
      schema: String(item?.schema || "public").trim() || "public",
      table,
      columns: Array.isArray(item?.columns) ? [...new Set(item.columns.map((col) => String(col).trim()).filter(Boolean))] : []
    });
  }
  return out;
}

// Builds manifest entries from the user's real-table selection, reusing tableDef
// so date/numeric/groupable heuristics are derived from the real column names.
export function buildDataQueryManifestFromSelection(tables = [], config = null) {
  return normalizeSelectionTables(tables).map((item) => {
    const policy = activateDataQueryPolicy(dataQueryTablePolicy(item.table, item.columns), config);
    return tableDef(
      item.connection,
      item.table,
      item.description || `Selected table ${item.schema}.${item.table}`,
      item.columns,
      policy || {}
    );
  });
}

// Introspects a Supabase connection through the PostgREST OpenAPI root (no SQL,
// no migration) and returns the real tables and their columns.
export async function introspectSupabaseTables(connection, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) {
    throw new Error("Supabase connection is not configured");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let data;
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/`, {
      signal: controller.signal,
      headers: { ...supabaseHeaders(connection.supabaseServiceRoleKey), Accept: "application/openapi+json" }
    });
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.message || `Introspection failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
  return parseOpenApiTables(data);
}

// Parses a PostgREST OpenAPI/Swagger document into [{ name, columns[] }].
export function parseOpenApiTables(doc = {}) {
  const defs = doc.definitions || doc.components?.schemas || {};
  const tables = [];
  for (const [name, schema] of Object.entries(defs)) {
    const columns = Object.keys(schema?.properties || {});
    if (!columns.length) continue;
    tables.push({ name, columns });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDataQueryManifest(config = getConfig()) {
  // Do not inherit hybrid-search embedding tables when the optional UI
  // selection is missing. The fallback contains only reviewed built-in
  // contracts; financial reads activate only when dedicated Data Query
  // credentials are configured.
  const indexTable = "data_index";
  const contentTable = (tableName, description, fields, options = {}) => tableDef("content", tableName, description, fields, options);
  const financialPolicy = activateDataQueryPolicy(dataQueryTablePolicy("financial_transactions"), config);
  const safetyPolicy = activateDataQueryPolicy(dataQueryTablePolicy("safety_reports"), config);
  const alertsPolicy = activateDataQueryPolicy(dataQueryTablePolicy("alerts"), config);
  const meetingsPolicy = activateDataQueryPolicy(dataQueryTablePolicy("meetings"), config);
  const emailsPolicy = activateDataQueryPolicy(dataQueryTablePolicy("emails"), config);
  const exceptionsPolicy = activateDataQueryPolicy(dataQueryTablePolicy("exceptions_report"), config);
  const consultantsPolicy = activateDataQueryPolicy(dataQueryTablePolicy("consultants_reports"), config);

  return [
    contentTable(indexTable, "Content index records", ["id", "created_at", "primary_date", "title", "summary", "source_table", "source_id", "project_id", "item_status", "severity_or_risk", "mail_id", "attachment_id", "source_url"], dataQueryTablePolicy(indexTable) || {
      defaultDateField: "primary_date"
    }),
    contentTable(
      "financial_transactions",
      "Financial transaction metadata",
      (financialPolicy?.fields || []).map((field) => field.name),
      financialPolicy || {}
    ),
    contentTable(
      "safety_reports",
      "Safety report structured metadata and typed counters",
      (safetyPolicy?.fields || []).map((field) => field.name),
      safetyPolicy || {}
    ),
    contentTable(
      "alerts",
      "Alert structured metadata with opaque stored severity and status labels",
      (alertsPolicy?.fields || []).map((field) => field.name),
      alertsPolicy || {}
    ),
    contentTable(
      "meetings",
      "Meeting structured metadata; content and personal data remain evidence-only",
      (meetingsPolicy?.fields || []).map((field) => field.name),
      meetingsPolicy || {}
    ),
    contentTable(
      "emails",
      "Project-related email metadata; content and personal data remain retrieval-only",
      (emailsPolicy?.fields || []).map((field) => field.name),
      emailsPolicy || {}
    ),
    contentTable(
      "exceptions_report",
      "Exception-report metadata; identities, monetary values, and narrative remain excluded",
      (exceptionsPolicy?.fields || []).map((field) => field.name),
      exceptionsPolicy || {}
    ),
    contentTable(
      "consultants_reports",
      "Consultant-report metadata; identity and narrative remain excluded",
      (consultantsPolicy?.fields || []).map((field) => field.name),
      consultantsPolicy || {}
    )
  ];
}

export async function runDataQueryAgent(input = {}) {
  const config = input.config || getConfig();
  const configuredSettings = { ...dataQuerySettings(config), ...(input.settings || {}) };
  const normalizedCaller = normalizeDataQueryCaller(input, configuredSettings);
  const settings = normalizedCaller.settings;
  const caller = normalizedCaller.caller;
  const requestedMetrics = normalizeStringList(input.requestedMetrics || input.requested_metrics || []);
  settings.requestedMetrics = requestedMetrics;
  const warnings = [...normalizedCaller.warnings];
  const now = typeof input.now === "function" ? input.now : Date.now;
  const deadlineAt = now() + settings.totalTimeoutMs;
  if (!settings.enabled) {
    return dataQueryResponse({ status: "skipped", answer: "Data Query Agent is disabled.", warnings: [...warnings, "disabled"], confidence: 0, caller });
  }

  const question = String(input.question || input.query || "").trim();
  if (!question) {
    return dataQueryResponse({ status: "needs_clarification", answer: "Question is required.", warnings: [...warnings, "missing_question"], confidence: 0, caller });
  }

  const routing = classifyDataQueryCapability(question, {
    hasExplicitPlan: Boolean(input.queryPlan),
    settings
  });
  if (normalizedCaller.errors.length) {
    return dataQueryResponse({
      status: "needs_clarification",
      answer: normalizedCaller.errors.join("; "),
      warnings: [...warnings, ...normalizedCaller.errors.map((error) => `invalid_caller_scope:${error}`)],
      confidence: 0,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  if (!routing.supported) {
    return dataQueryResponse({
      status: routing.status || "needs_clarification",
      answer: routing.suggestedAgent
        ? `${routing.reason} Suggested route: ${routing.suggestedAgent}.`
        : routing.reason,
      warnings: [...warnings, routing.warning],
      confidence: 0,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  if (
    routing.metricScope?.targetTable === "alerts" &&
    routing.metricScope?.requiredFilters?.some((filter) =>
      filter.field === "data_date" && filter.op === "is" && filter.value === null
    ) &&
    (routing.metricScope.operation === "timeseries" || caller.dateFrom || caller.dateTo)
  ) {
    const conflictRouting = {
      ...routing,
      supported: false,
      status: "not_computable",
      reason: "Undated alerts cannot be assigned to a data_date period. A null-date filter cannot be combined with a date scope or time series.",
      warning: "alert_undated_temporal_conflict_not_computable",
      suggestedAgent: null
    };
    return dataQueryResponse({
      status: "not_computable",
      answer: conflictRouting.reason,
      warnings: [...warnings, conflictRouting.warning],
      confidence: 0,
      caller,
      routing: conflictRouting,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  if (
    ["alerts", "meetings", "emails"].includes(routing.metricScope?.targetTable) &&
    routing.metricScope?.dateScopeRequirement &&
    (
      (routing.metricScope.dateScopeRequirement === "both" && (!caller.dateFrom || !caller.dateTo)) ||
      (routing.metricScope.dateScopeRequirement === "from" && !caller.dateFrom) ||
      (routing.metricScope.dateScopeRequirement === "to" && !caller.dateTo)
    )
  ) {
    const meetingDateScope = routing.metricScope.targetTable === "meetings";
    const emailDateScope = routing.metricScope.targetTable === "emails";
    const dateRouting = {
      ...routing,
      supported: false,
      status: "not_computable",
      reason: meetingDateScope
        ? "The meeting question contains a date qualifier, but no normalized caller date scope was supplied. The qualifier was not dropped."
        : emailDateScope
          ? "The email question contains a date qualifier, but no normalized caller date scope was supplied. The qualifier was not dropped."
          : "The alert question contains a date qualifier, but no normalized caller date scope was supplied. The qualifier was not dropped.",
      warning: meetingDateScope
        ? "meeting_date_scope_not_resolved"
        : emailDateScope
          ? "email_date_scope_not_resolved"
          : "alert_date_scope_not_resolved",
      suggestedAgent: null
    };
    return dataQueryResponse({
      status: "not_computable",
      answer: dateRouting.reason,
      warnings: [...warnings, dateRouting.warning],
      confidence: 0,
      caller,
      routing: dateRouting,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  if (Array.isArray(routing.warnings)) {
    warnings.push(...routing.warnings);
  }

  const scopedInput = {
    ...input,
    context: {
      ...(input.context || {}),
      ...caller,
      budget: caller.budget,
      ...(routing.lookup ? { lookupIntent: routing.lookup } : {}),
      ...(routing.metricScope ? { metricScope: routing.metricScope } : {})
    },
    requestedMetrics
  };
  const planned = await resolveQueryPlan({ input: scopedInput, config, settings, question, warnings, deadlineAt, now });
  if (now() >= deadlineAt) {
    return dataQueryResponse({ status: "error", answer: "Data Query Agent exceeded its total deadline during planning.", warnings: [...warnings, "total_timeout_exceeded"], confidence: 0, planner: planned.source, queryPlan: planned.plan, caller, routing });
  }
  const scopedPlan = applyDataQueryCallerScope(planned.plan, caller, settings);
  warnings.push(...scopedPlan.warnings);
  if (scopedPlan.errors.length) {
    return dataQueryResponse({
      status: "needs_clarification",
      answer: scopedPlan.errors.join("; "),
      warnings: [...warnings, ...scopedPlan.errors],
      confidence: 0,
      planner: planned.source,
      queryPlan: scopedPlan.plan,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  planned.plan = scopedPlan.plan;
  const plan = planned.plan;
  const validationSettings = routing.lookup
    ? { ...settings, expectedLookup: routing.lookup }
    : routing.metricScope
      ? { ...settings, expectedMetricScope: routing.metricScope }
      : settings;
  let validation = validateQueryPlan(plan, validationSettings);
  if (!validation.ok && !validation.plans.length && planned.source === "llm") {
    warnings.push(...validation.warnings, ...validation.errors);
    warnings.push("llm_plan_rejected_fallback_used");
    const fallbackPlan = buildHeuristicQueryPlan({ question, context: scopedInput.context, requestedMetrics, settings });
    const scopedFallback = applyDataQueryCallerScope(fallbackPlan, caller, settings);
    warnings.push(...scopedFallback.warnings, ...scopedFallback.errors);
    const fallbackValidation = scopedFallback.errors.length
      ? { ok: false, plans: [], warnings: scopedFallback.warnings, errors: scopedFallback.errors }
      : validateQueryPlan(scopedFallback.plan, validationSettings);
    if (fallbackValidation.plans.length) {
      validation = fallbackValidation;
      planned.plan = scopedFallback.plan;
      planned.source = "heuristic_fallback";
    }
  }
  warnings.push(...validation.warnings);
  if (!validation.ok && !validation.plans.length) {
    return dataQueryResponse({
      status: validation.status || "error",
      answer: validation.errors.join("; "),
      warnings: [...warnings, ...validation.errors],
      confidence: Math.min(Number(plan.confidence || 0.2), 0.4),
      queryPlan: planned.plan,
      planner: planned.source,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }

  const results = await executeQueryPlans({
    config,
    settings,
    plans: validation.plans,
    fetchRows: input.fetchRows,
    fetchExact: input.fetchExact,
    caller,
    deadlineAt,
    now
  });
  warnings.push(...results.warnings);
  const synthesis = synthesizeDataQueryAnswer({ question, plan: planned.plan, planResults: results.plans, warnings });
  const metrics = synthesis.metrics;
  const machineResult = buildDataQueryMachineResult({ requestedMetrics, planResults: results.plans, metrics, caller });
  const hasSuccessfulPlan = results.plans.some((item) => item.status === "ok");
  const hasPartialResult = results.plans.some((item) => item.status !== "ok" || item.truncated || item.sampled);
  return dataQueryResponse({
    status: hasSuccessfulPlan ? (hasPartialResult ? "partial" : "ok") : "error",
    answer: synthesis.answer,
    metrics,
    plans: results.plans.map((item) => ({
      id: item.id,
      requestId: item.requestId || null,
      operation: item.operation,
      table: item.table,
      status: item.status,
      rows: Array.isArray(item.rows) ? item.rows.length : 0,
      cardinality: item.cardinality,
      exactness: item.exactness,
      truncated: item.truncated,
      sampled: item.sampled,
      cacheHit: item.cacheHit === true,
      provenance: item.provenance,
      summary: item.summary,
      error: item.error || undefined
    })),
    tablesUsed: [...new Set(results.plans.filter((item) => item.status === "ok").map((item) => item.table))],
    confidence: Number(planned.plan.confidence || synthesis.confidence || 0.65),
    warnings,
    rawResultsPreview: {},
    queryPlan: planned.plan,
    planner: planned.source,
    caller,
    routing,
    machineResult
  });
}

async function resolveQueryPlan({ input, config, settings, question, warnings, deadlineAt, now }) {
  if (input.queryPlan && typeof input.queryPlan === "object") {
    return { plan: input.queryPlan, source: "provided" };
  }
  if (typeof input.planWithLlm === "function") {
    try {
      const remainingMs = Math.max(1, deadlineAt - now());
      return {
        plan: await runWithinDeadline(
          () => input.planWithLlm({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], config, settings }),
          remainingMs,
          "data query planning"
        ),
        source: "llm"
      };
    } catch (error) {
      warnings.push(`llm_planner_failed: ${error.message}`);
    }
  }
  // Lookup intent is already parsed into a fixed operation, target, exact
  // discriminator, order, and bound. The production LLM planner adds latency
  // and can only drift from this deterministic contract. An explicit injected
  // planner above remains available for contract tests.
  if (input.context?.lookupIntent) {
    return {
      plan: buildHeuristicQueryPlan({
        question,
        context: input.context || {},
        requestedMetrics: input.requestedMetrics || [],
        settings
      }),
      source: "heuristic"
    };
  }
  if (input.context?.metricScope) {
    const heuristicPlan = buildHeuristicQueryPlan({
      question,
      context: input.context || {},
      requestedMetrics: input.requestedMetrics || [],
      settings
    });
    if (heuristicPlan.plans.length) {
      return { plan: heuristicPlan, source: "heuristic" };
    }
  }
  if (settings.plannerEnabled !== false && !input.disableLlmPlanner && config.openRouterApiKey) {
    try {
      const remainingMs = Math.max(1, deadlineAt - now());
      return {
        plan: await runWithinDeadline(
          () => planDataQueryWithLlm({
            config,
            settings,
            question,
            context: input.context || {},
            requestedMetrics: input.requestedMetrics || [],
            telemetry: input.telemetry || null,
            timeoutMs: Math.min(settings.plannerTimeoutMs, remainingMs)
          }),
          remainingMs,
          "data query planning"
        ),
        source: "llm"
      };
    } catch (error) {
      warnings.push(`llm_planner_failed: ${error.message}`);
    }
  } else if (settings.plannerEnabled === false) {
    warnings.push("llm_planner_disabled");
  } else if (!config.openRouterApiKey) {
    warnings.push("llm_planner_skipped_missing_openrouter_key");
  }
  return {
    plan: buildHeuristicQueryPlan({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], settings }),
    source: "heuristic"
  };
}

export async function planDataQueryWithLlm({
  config = getConfig(),
  settings = dataQuerySettings(config),
  question = "",
  context = {},
  requestedMetrics = [],
  telemetry = null,
  chatComplete = chatCompletion,
  timeoutMs = settings.plannerTimeoutMs || DATA_QUERY_DEFAULTS.plannerTimeoutMs
} = {}) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const manifest = settings.manifest
    .filter((table) => (settings.allowedSchemas || []).includes(table.schemaAlias))
    .filter((table) => !settings.allowedTables.length || settings.allowedTables.includes(table.tableName))
    .map((table) => ({
      schema: table.schemaAlias,
      table: table.tableName,
      description: table.description,
      fields: table.fields.filter((field) => field.queryable !== false).map((field) => ({
        name: field.name,
        type: field.type,
        selectable: field.selectable,
        orderable: field.orderable,
        filterOps: field.filterOps,
        groupable: field.groupable,
        aggregations: field.aggregations,
        dateSemantics: field.dateSemantics
      })),
      dateFields: table.dateFields,
      groupableFields: table.groupableFields,
      numericFields: table.numericFields,
      defaultDateField: table.defaultDateField,
      allowedOperations: table.allowedOperations,
      exactOperations: table.exactOperations || [],
      lookupPolicy: dataQueryExactAvailable(table) && table.lookupPolicy?.enabled
        ? {
            operations: table.lookupPolicy.operations,
            defaultOrderField: table.lookupPolicy.defaultOrderField,
            orderableFields: table.lookupPolicy.orderableFields,
            stableIdField: table.lookupPolicy.stableIdField,
            maxRows: table.lookupPolicy.maxRows,
            allRowsMax: table.lookupPolicy.allRowsMax
          }
        : null
    }));
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey,
    model,
    temperature: 0,
    maxTokens: 2200,
    timeoutMs,
    responseFormat: { type: "json_object" },
    telemetry,
    messages: [
      { role: "system", content: DATA_QUERY_PLANNER_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          question,
          context,
          requestedMetrics,
          limits: {
            maxPlans: settings.maxPlans,
            maxRowsPerPlan: settings.maxRowsPerPlan,
            allowedOperations: [...READ_OPERATIONS]
          },
          schemaManifest: manifest
        }, null, 2)
      }
    ]
  });
  return normalizeLlmQueryPlan(extractJsonObject(content), question, settings);
}

const DATA_QUERY_PLANNER_PROMPT = `You are the Data Query Agent planner for BIDoc.

Return ONLY one valid JSON object. Do not include Markdown.

You do not write SQL. You do not call functions. You only choose a safe Query Plan from the supplied schemaManifest.

Allowed operations: count, group_count, aggregate, timeseries, top_n, distinct, lookup_latest, lookup_earliest, lookup_last_n.

Hard rules:
- Use only tables in schemaManifest.
- Use only fields listed under each table and obey each field's selectable, filterOps, groupable, and aggregations metadata.
- Every plan must include a stable id, schema, table, operation, limit, and reason.
- When requestedMetrics is non-empty, copy the matching requested metric id into requestId on each plan. Never invent a different requestId.
- limit must be a positive number no larger than maxRowsPerPlan.
- Do not include rawSql, sql, join, joins, semicolons, comments, or SQL keywords.
- If a JOIN would be required, return no executable join; either split into separate plans or add warning "unsupported_join_required".
- If no table is suitable, return {"question": "...", "intent": "needs_clarification", "plans": [], "confidence": 0.2, "warnings": ["needs_clarification"]}.
- Prefer group_count for "by status/date/severity/type" questions.
- Prefer aggregate for count/avg/min/max/sum metrics, but request avg/min/max/sum only when the field explicitly lists that aggregation.
- Exact quantitative operations are available only when listed in exactOperations. Otherwise return no plan with warning "not_computable".
- Use lookup_latest, lookup_earliest, or lookup_last_n only when that operation is listed in exactOperations and lookupPolicy is present.
- For a lookup, use only selectable output fields. Include lookupPolicy.defaultOrderField and lookupPolicy.stableIdField in select.
- For lookup_latest use limit 1 and descending order. For lookup_earliest use limit 1 and ascending order. For lookup_last_n use the requested bounded limit and descending order.
- A lookup order must use lookupPolicy.defaultOrderField first and lookupPolicy.stableIdField second. top_n remains grouped counts and never means latest records.
- When context.lookupIntent is present, preserve its operation, direction, bounded limit, and every requiredFilters entry exactly.
- Use date filters from context only on dateFields/defaultDateField.

Output shape:
{
  "question": "string",
  "intent": "string",
  "plans": [
    {
      "id": "stable_snake_case",
      "requestId": "requested_metric_id_or_null",
      "schema": "content",
      "table": "table_name",
      "operation": "count|group_count|aggregate|timeseries|top_n|distinct|lookup_latest|lookup_earliest|lookup_last_n",
      "select": ["field"],
      "metrics": [{"type":"count|avg|min|max|sum","field":"numeric_field","as":"metric_name"}],
      "filters": [{"field":"field","op":"eq|neq|gt|gte|lt|lte|ilike|in|is","value":"value"}],
      "groupBy": ["field"],
      "orderBy": [{"field":"field_or_metric_alias","direction":"asc|desc"}],
      "limit": 100,
      "reason": "short reason"
    }
  ],
  "confidence": 0.0,
  "warnings": []
}`;

function normalizeLlmQueryPlan(value = {}, question, settings) {
  const plans = Array.isArray(value.plans) ? value.plans : [];
  return {
    question: String(value.question || question || ""),
    intent: String(value.intent || (plans.length ? "metric_lookup" : "needs_clarification")),
    plans: plans.slice(0, settings.maxPlans).map((plan, index) => ({
      id: String(plan.id || `plan_${index + 1}`).trim(),
      requestId: String(plan.requestId || plan.request_id || "").trim() || null,
      schema: String(plan.schema || plan.schemaAlias || "content").trim(),
      table: String(plan.table || plan.tableName || "").trim(),
      operation: String(plan.operation || "select").trim(),
      select: Array.isArray(plan.select) ? plan.select.map(String) : [],
      metrics: Array.isArray(plan.metrics) ? plan.metrics : [],
      filters: Array.isArray(plan.filters) ? plan.filters : [],
      groupBy: Array.isArray(plan.groupBy) ? plan.groupBy.map(String) : [],
      orderBy: Array.isArray(plan.orderBy) ? plan.orderBy : [],
      limit: plan.limit,
      reason: String(plan.reason || "")
    })),
    confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0.5))),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : []
  };
}

export function buildHeuristicQueryPlan({ question, context = {}, requestedMetrics = [], settings = dataQuerySettings() } = {}) {
  const text = normalizeDataQueryHebrewQuestion(question).toLowerCase();
  const plans = [];
  const add = (plan) => plans.push(plan);
  const dateFrom = context.dateFrom || context.date_from || null;
  const dateTo = context.dateTo || context.date_to || null;
  const dateFilters = (field) => [
    ...(dateFrom ? [{ field, op: "gte", value: dateFrom }] : []),
    ...(dateTo ? [{ field, op: "lte", value: dateTo }] : [])
  ];
  const lookupIntent = context.lookupIntent || parseDataQueryLookupIntent(question);
  if (lookupIntent) {
    const lookupTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === lookupIntent.targetTable &&
      dataQueryExactAvailable(item) &&
      item.lookupPolicy?.enabled &&
      item.lookupPolicy.operations.includes(lookupIntent.operation)
    );
    if (lookupTable) {
      const orderField = lookupTable.lookupPolicy.defaultOrderField;
      const stableIdField = lookupTable.lookupPolicy.stableIdField;
      const selectedFields = [
        stableIdField,
        orderField,
        ...lookupTable.fields.filter((field) => field.selectable).map((field) => field.name)
      ].filter((field, index, all) => field && all.indexOf(field) === index)
        .slice(0, lookupTable.tableName === "safety_reports" ? 12 : 8);
      add({
        id: `${lookupIntent.operation}_${lookupTable.tableName}`,
        schema: lookupTable.schemaAlias,
        table: lookupTable.tableName,
        operation: lookupIntent.operation,
        select: selectedFields,
        filters: [
          ...dateFilters(orderField),
          ...(lookupIntent.requiredFilters || []).map((filter) => ({ ...filter }))
        ],
        orderBy: [
          { field: orderField, direction: lookupIntent.order },
          { field: stableIdField, direction: lookupIntent.order }
        ],
        limit: lookupIntent.operation === "lookup_last_n" ? lookupIntent.limit : 1,
        reason: "Deterministic structured lookup requested."
      });
    }
  }
  const metricScope = context.metricScope || parseDataQueryMetricScope(question);
  if (
    !lookupIntent &&
    metricScope?.targetTable === "financial_transactions" &&
    ["invoice", "financial_transaction_type", "financial_document"].includes(metricScope.recordKind)
  ) {
    const financialTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "financial_transactions" &&
      dataQueryExactAvailable(item)
    );
    if (financialTable) {
      const invoiceMetric = metricScope.recordKind === "invoice";
      const typedMetric = metricScope.recordKind === "financial_transaction_type";
      const metricPrefix = invoiceMetric
        ? "invoice"
        : typedMetric
          ? `financial_type_${metricScope.financialType?.key || "unknown"}`
          : "financial_document";
      const base = {
        schema: financialTable.schemaAlias,
        table: financialTable.tableName,
        filters: (metricScope.requiredFilters || []).map((filter) => ({ ...filter })),
        limit: Math.min(100, financialTable.maxLimit, settings.maxRowsPerPlan),
        reason: invoiceMetric
          ? "Deterministic invoice metric requested."
          : typedMetric
            ? "Deterministic financial transaction-type metric requested."
            : "Deterministic whole-table financial-document metric requested."
      };
      if (/\bby\s+(?:transaction\s+)?types?\b|לפי\s+סוג/iu.test(text)) {
        add({ ...base, id: `${metricPrefix}s_by_type`, operation: "group_count", groupBy: ["transaction_type"] });
      } else if (/\bby\s+status\b|לפי\s+סטטוס|לפי\s+מצב/iu.test(text)) {
        add({ ...base, id: `${metricPrefix}s_by_status`, operation: "group_count", groupBy: ["status"] });
      } else if (/\bby\s+currenc(?:y|ies)\b|לפי\s+מטבע/iu.test(text)) {
        add({ ...base, id: `${metricPrefix}s_by_currency`, operation: "group_count", groupBy: ["currency"] });
      } else if (/\bhow\s+many\b|\bcount\b|כמה/iu.test(text)) {
        add({ ...base, id: `${metricPrefix}_count`, operation: "count" });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "safety_reports") {
    const safetyTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "safety_reports" &&
      dataQueryExactAvailable(item)
    );
    if (safetyTable && !metricScope.notComputableReason) {
      const base = {
        schema: safetyTable.schemaAlias,
        table: safetyTable.tableName,
        filters: (metricScope.requiredFilters || []).map((filter) => ({ ...filter })),
        limit: Math.min(100, safetyTable.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic safety-report metric requested."
      };
      if (metricScope.operation === "group_count") {
        add({
          ...base,
          id: `safety_reports_by_${metricScope.groupField}`,
          operation: "group_count",
          groupBy: [metricScope.groupField]
        });
      } else if (metricScope.operation === "timeseries") {
        add({
          ...base,
          id: "safety_report_time_series",
          operation: "timeseries",
          dateField: "report_date",
          granularity: metricScope.granularity || "day"
        });
      } else if (metricScope.operation === "aggregate") {
        add({
          ...base,
          id: "safety_defect_totals",
          operation: "aggregate",
          metrics: (metricScope.metrics || []).map((metric) => ({ ...metric }))
        });
      } else {
        add({
          ...base,
          id: "safety_report_count",
          operation: "count"
        });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "alerts") {
    const alertsTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "alerts" &&
      dataQueryExactAvailable(item)
    );
    if (alertsTable && !metricScope.notComputableReason) {
      const base = {
        schema: alertsTable.schemaAlias,
        table: alertsTable.tableName,
        filters: [
          ...dateFilters("data_date"),
          ...(metricScope.requiredFilters || []).map((filter) => ({ ...filter }))
        ],
        limit: Math.min(alertsTable.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic alert metadata metric requested."
      };
      if (metricScope.operation === "group_count") {
        add({
          ...base,
          id: `alerts_by_${metricScope.groupField}`,
          operation: "group_count",
          groupBy: [metricScope.groupField]
        });
      } else if (metricScope.operation === "timeseries") {
        add({
          ...base,
          id: "alert_time_series",
          operation: "timeseries",
          dateField: "data_date",
          granularity: metricScope.granularity || "day"
        });
      } else {
        add({
          ...base,
          id: "alert_count",
          operation: "count"
        });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "meetings") {
    const meetingsTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "meetings" &&
      dataQueryExactAvailable(item)
    );
    if (meetingsTable && !metricScope.notComputableReason) {
      const base = {
        schema: meetingsTable.schemaAlias,
        table: meetingsTable.tableName,
        filters: [
          ...dateFilters("meeting_date"),
          ...(metricScope.requiredFilters || []).map((filter) => ({ ...filter }))
        ],
        limit: Math.min(meetingsTable.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic meeting metadata metric requested."
      };
      if (metricScope.operation === "group_count") {
        add({
          ...base,
          id: "meetings_by_status",
          operation: "group_count",
          groupBy: ["status"]
        });
      } else if (metricScope.operation === "distinct") {
        add({
          ...base,
          id: "meeting_status_values",
          operation: "distinct",
          select: ["status"]
        });
      } else if (metricScope.operation === "timeseries") {
        add({
          ...base,
          id: "meeting_time_series",
          operation: "timeseries",
          dateField: "meeting_date",
          granularity: metricScope.granularity || "day"
        });
      } else {
        add({
          ...base,
          id: "meeting_count",
          operation: "count"
        });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "emails") {
    const emailsTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "emails" &&
      dataQueryExactAvailable(item)
    );
    if (emailsTable && !metricScope.notComputableReason) {
      const base = {
        schema: emailsTable.schemaAlias,
        table: emailsTable.tableName,
        filters: [
          ...dateFilters("received_date"),
          ...(metricScope.requiredFilters || []).map((filter) => ({ ...filter }))
        ],
        limit: Math.min(emailsTable.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic project-related email metadata metric requested."
      };
      if (metricScope.operation === "group_count") {
        add({
          ...base,
          id: `emails_by_${metricScope.groupField}`,
          operation: "group_count",
          groupBy: [metricScope.groupField]
        });
      } else if (metricScope.operation === "distinct") {
        add({
          ...base,
          id: "email_category_values",
          operation: "distinct",
          select: ["mail_category"]
        });
      } else if (metricScope.operation === "timeseries") {
        add({
          ...base,
          id: "email_time_series",
          operation: "timeseries",
          dateField: "received_date",
          granularity: metricScope.granularity || "day"
        });
      } else {
        add({
          ...base,
          id: "email_count",
          operation: "count"
        });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "exceptions_report") {
    const exceptionsTable = settings.manifest.find((item) =>
      item.schemaAlias === "content" &&
      item.tableName === "exceptions_report" &&
      dataQueryExactAvailable(item)
    );
    if (exceptionsTable && !metricScope.notComputableReason) {
      const base = {
        schema: exceptionsTable.schemaAlias,
        table: exceptionsTable.tableName,
        filters: [
          ...dateFilters("exception_date"),
          ...(metricScope.requiredFilters || []).map((filter) => ({ ...filter }))
        ],
        limit: Math.min(exceptionsTable.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic exception-report metadata metric requested."
      };
      if (metricScope.operation === "group_count") {
        add({
          ...base,
          id: `exceptions_by_${metricScope.groupField}`,
          operation: "group_count",
          groupBy: [metricScope.groupField]
        });
      } else if (metricScope.operation === "timeseries") {
        add({
          ...base,
          id: "exception_time_series",
          operation: "timeseries",
          dateField: "exception_date",
          granularity: metricScope.granularity || "day"
        });
      } else if (metricScope.operation === "aggregate") {
        add({
          ...base,
          id: "exception_requested_amount_coverage",
          operation: "aggregate",
          metrics: (metricScope.metrics || []).map((metric) => ({ ...metric })),
          reason: "Exact coverage-qualified subtotal of populated requested amount values."
        });
      } else {
        add({
          ...base,
          id: "exception_count",
          operation: "count"
        });
      }
    }
  }
  if (!lookupIntent && metricScope?.targetTable === "consultants_reports") {
    const table = settings.manifest.find((item) => item.schemaAlias === "content" && item.tableName === "consultants_reports" && dataQueryExactAvailable(item));
    if (table && !metricScope.notComputableReason) {
      const base = {
        schema: table.schemaAlias,
        table: table.tableName,
        filters: [...dateFilters("report_date"), ...(metricScope.requiredFilters || []).map((filter) => ({ ...filter }))],
        limit: Math.min(table.maxLimit, settings.maxRowsPerPlan),
        reason: "Deterministic consultant-report metadata metric requested."
      };
      if (metricScope.operation === "group_count") add({ ...base, id: "consultants_by_item_status", operation: "group_count", groupBy: ["item_status"] });
      else if (metricScope.operation === "timeseries") add({ ...base, id: "consultant_report_time_series", operation: "timeseries", dateField: "report_date", granularity: metricScope.granularity || "day" });
      else add({ ...base, id: "consultant_report_count", operation: "count" });
    }
  }
  return {
    question,
    intent: plans.length > 1 ? "multi_metric_summary" : "metric_lookup",
    plans: plans.slice(0, settings.maxPlans || 5).map((plan, index) => ({
      ...plan,
      requestId: normalizeStringList(requestedMetrics)[index] || plan.id
    })),
    confidence: plans.length ? 0.72 : 0.25,
    warnings: plans.length ? [] : ["low_confidence_no_table_selected"]
  };
}

export function validateQueryPlan(queryPlan = {}, settings = dataQuerySettings()) {
  const warnings = Array.isArray(queryPlan.warnings) ? [...queryPlan.warnings] : [];
  const errors = [];
  if (containsDangerousSql(queryPlan)) errors.push("Query plan contains forbidden SQL text");
  const rawPlans = Array.isArray(queryPlan.plans) ? queryPlan.plans : [];
  if (!rawPlans.length) {
    return { ok: false, status: "needs_clarification", plans: [], warnings, errors: ["No query plans were selected"] };
  }
  if (rawPlans.length > settings.maxPlans) warnings.push(`maxPlans exceeded; using first ${settings.maxPlans}`);
  const expectedFinancialTypeLookup = settings.expectedLookup?.targetTable === "financial_transactions" &&
    ["invoice", "financial_transaction_type"].includes(settings.expectedLookup?.recordKind);
  const expectedFinancialTypeMetric = settings.expectedMetricScope?.targetTable === "financial_transactions" &&
    ["invoice", "financial_transaction_type"].includes(settings.expectedMetricScope?.recordKind);
  const expectedAttestedIntent = (["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(settings.expectedLookup?.targetTable) || expectedFinancialTypeLookup)
    ? settings.expectedLookup
    : (["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(settings.expectedMetricScope?.targetTable) || expectedFinancialTypeMetric)
      ? settings.expectedMetricScope
      : null;
  if (expectedAttestedIntent && rawPlans.length !== 1) {
    return {
      ok: false,
      status: "not_computable",
      plans: [],
      warnings,
      errors: [`${expectedAttestedIntent.targetTable} intent requires exactly one attested plan`]
    };
  }
  const tableMap = new Map(settings.manifest.map((item) => [`${item.schemaAlias}.${item.tableName}`, item]));
  const allowedTables = new Set(settings.allowedTables.length ? settings.allowedTables : settings.manifest.map((item) => item.tableName));
  const allowedSchemas = new Set(settings.allowedSchemas || DATA_QUERY_DEFAULTS.allowedSchemas);
  const accepted = [];

  const requestedMetricIds = normalizeStringList(settings.requestedMetrics || []);
  const requestedMetricSet = new Set(requestedMetricIds);
  for (const [planIndex, original] of rawPlans.slice(0, settings.maxPlans).entries()) {
    const plan = normalizePlan(original, settings);
    if (plan.table === "alerts") normalizeAlertPlanFilterAliases(plan);
    const planErrors = [];
    const expectedLookup = settings.expectedLookup || null;
    const expectedMetricScope = settings.expectedMetricScope || null;
    if (!plan.id) planErrors.push("plan id is required");
    if (!plan.requestId && requestedMetricIds[planIndex]) plan.requestId = requestedMetricIds[planIndex];
    if (plan.requestId && requestedMetricSet.size && !requestedMetricSet.has(plan.requestId)) planErrors.push(`requestId ${plan.requestId} was not requested by the caller`);
    if (expectedLookup) {
      if (plan.operation !== expectedLookup.operation) {
        planErrors.push(`lookup intent requires operation ${expectedLookup.operation}`);
      }
      if (expectedLookup.targetTable && plan.table !== expectedLookup.targetTable) {
        planErrors.push(`lookup intent requires table ${expectedLookup.targetTable}`);
      }
      if (Number(plan.limit) !== Number(expectedLookup.limit)) {
        planErrors.push(`lookup intent requires limit ${expectedLookup.limit}`);
      }
      for (const requiredFilter of expectedLookup.requiredFilters || []) {
        const hasExactFilter = plan.filters.some((filter) =>
          filter.field === requiredFilter.field &&
          filter.op === requiredFilter.op &&
          JSON.stringify(filter.value) === JSON.stringify(requiredFilter.value)
        );
        if (!hasExactFilter) {
          planErrors.push(`lookup intent requires exact filter ${requiredFilter.field}.${requiredFilter.op}`);
        }
      }
      for (const forbiddenField of expectedLookup.forbiddenFilterFields || []) {
        if (plan.filters.some((filter) =>
          filter.field === forbiddenField && filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true
        )) {
          planErrors.push(`lookup intent forbids filter ${forbiddenField}`);
        }
      }
    }
    if (expectedMetricScope) {
      if (expectedMetricScope.targetTable && plan.table !== expectedMetricScope.targetTable) {
        planErrors.push(`metric intent requires table ${expectedMetricScope.targetTable}`);
      }
      if (expectedMetricScope.operation && plan.operation !== expectedMetricScope.operation) {
        planErrors.push(`metric intent requires operation ${expectedMetricScope.operation}`);
      }
      if (
        expectedMetricScope.groupField &&
        (plan.groupBy.length !== 1 || plan.groupBy[0] !== expectedMetricScope.groupField)
      ) {
        planErrors.push(`metric intent requires exact group field ${expectedMetricScope.groupField}`);
      }
      if (Array.isArray(expectedMetricScope.metrics) && expectedMetricScope.metrics.length) {
        const expectedMetrics = expectedMetricScope.metrics.map((metric) => stableStringify(metric)).sort();
        const actualMetrics = plan.metrics.map((metric) => stableStringify(metric)).sort();
        if (stableStringify(actualMetrics) !== stableStringify(expectedMetrics)) {
          planErrors.push("metric intent requires the exact approved metric definitions");
        }
      }
      if (expectedMetricScope.targetTable === "alerts" && expectedMetricScope.operation === "timeseries") {
        if (plan.dateField !== "data_date") {
          planErrors.push("alert timeseries intent requires canonical data_date");
        }
        if ((plan.granularity || "day") !== (expectedMetricScope.granularity || "day")) {
          planErrors.push(`alert timeseries intent requires granularity ${expectedMetricScope.granularity || "day"}`);
        }
      }
      if (expectedMetricScope.targetTable === "meetings" && expectedMetricScope.operation === "timeseries") {
        if (plan.dateField !== "meeting_date") {
          planErrors.push("meeting timeseries intent requires canonical meeting_date");
        }
        if ((plan.granularity || "day") !== (expectedMetricScope.granularity || "day")) {
          planErrors.push(`meeting timeseries intent requires granularity ${expectedMetricScope.granularity || "day"}`);
        }
      }
      if (expectedMetricScope.targetTable === "meetings" && expectedMetricScope.operation === "distinct") {
        if (
          expectedMetricScope.distinctField !== "status" ||
          plan.select.length !== 1 ||
          plan.select[0] !== "status" ||
          plan.groupBy.length !== 0
        ) {
          planErrors.push("meeting distinct intent requires exactly the approved stored status field");
        }
      }
      if (expectedMetricScope.targetTable === "emails" && expectedMetricScope.operation === "timeseries") {
        if (plan.dateField !== "received_date") {
          planErrors.push("email timeseries intent requires canonical received_date");
        }
        if ((plan.granularity || "day") !== (expectedMetricScope.granularity || "day")) {
          planErrors.push(`email timeseries intent requires granularity ${expectedMetricScope.granularity || "day"}`);
        }
      }
      if (expectedMetricScope.targetTable === "exceptions_report" && expectedMetricScope.operation === "timeseries") {
        if (plan.dateField !== "exception_date") {
          planErrors.push("exception timeseries intent requires canonical exception_date");
        }
        if ((plan.granularity || "day") !== (expectedMetricScope.granularity || "day")) {
          planErrors.push(`exception timeseries intent requires granularity ${expectedMetricScope.granularity || "day"}`);
        }
      }
      if (expectedMetricScope.targetTable === "consultants_reports" && expectedMetricScope.operation === "timeseries") {
        if (plan.dateField !== "report_date") planErrors.push("consultant-report timeseries intent requires report_date");
        if ((plan.granularity || "day") !== (expectedMetricScope.granularity || "day")) planErrors.push(`consultant-report timeseries intent requires granularity ${expectedMetricScope.granularity || "day"}`);
      }
      if (expectedMetricScope.targetTable === "emails" && expectedMetricScope.operation === "distinct") {
        if (
          expectedMetricScope.distinctField !== "mail_category" ||
          plan.select.length !== 1 ||
          plan.select[0] !== "mail_category" ||
          plan.groupBy.length !== 0
        ) {
          planErrors.push("email distinct intent requires exactly the approved mail_category field");
        }
      }
      for (const requiredFilter of expectedMetricScope.requiredFilters || []) {
        const hasExactFilter = plan.filters.some((filter) =>
          filter.field === requiredFilter.field &&
          filter.op === requiredFilter.op &&
          JSON.stringify(filter.value) === JSON.stringify(requiredFilter.value)
        );
        if (!hasExactFilter) {
          planErrors.push(`metric intent requires exact filter ${requiredFilter.field}.${requiredFilter.op}`);
        }
      }
      for (const forbiddenField of expectedMetricScope.forbiddenFilterFields || []) {
        if (plan.filters.some((filter) =>
          filter.field === forbiddenField && filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true
        )) {
          planErrors.push(`metric intent forbids filter ${forbiddenField}`);
        }
      }
    }
    const expectedManagedFilters = (["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(expectedLookup?.targetTable) || expectedFinancialTypeLookup)
      ? expectedLookup.requiredFilters || []
      : (["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(expectedMetricScope?.targetTable) || expectedFinancialTypeMetric)
        ? expectedMetricScope.requiredFilters || []
        : null;
    if (expectedManagedFilters) {
      for (const filter of plan.filters) {
        const required = expectedManagedFilters.some((item) =>
          filter.field === item.field &&
          filter.op === item.op &&
          stableStringify(filter.value) === stableStringify(item.value)
        );
        if (!required && filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true) {
          planErrors.push(`${expectedLookup?.targetTable || expectedMetricScope?.targetTable} intent forbids unrequested filter ${filter.field}.${filter.op}`);
        }
      }
    }
    if (!READ_OPERATIONS.has(plan.operation)) planErrors.push(`operation ${plan.operation || "missing"} is not allowed`);
    if (!allowedSchemas.has(plan.schema)) planErrors.push(`schema ${plan.schema} is not allowed`);
    if (!allowedTables.has(plan.table)) planErrors.push(`table ${plan.table} is not allowed`);
    const table = tableMap.get(`${plan.schema}.${plan.table}`);
    if (!table) planErrors.push(`table ${plan.schema}.${plan.table} is not in the manifest`);
    if (plan.table === "emails") {
      const relevanceFilters = plan.filters.filter((filter) => filter.field === "relevance_status");
      const hasFixedProjectRelatedScope = relevanceFilters.length === 1 &&
        relevanceFilters[0].op === "in" &&
        stableStringify([...(relevanceFilters[0].value || [])].sort()) ===
          stableStringify([...DATA_QUERY_EMAIL_RELEVANCE_VALUES].sort());
      const expectedNoClearScope = expectedMetricScope?.targetTable === "emails" &&
        expectedMetricScope?.operation === "count" &&
        (expectedMetricScope.requiredFilters || []).some((filter) =>
          filter.field === "relevance_status" &&
          filter.op === "eq" &&
          filter.value === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE
        );
      const hasAttestedNoClearScope = expectedNoClearScope &&
        plan.operation === "count" &&
        relevanceFilters.length === 1 &&
        relevanceFilters[0].op === "eq" &&
        relevanceFilters[0].value === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE;
      if (!hasFixedProjectRelatedScope && !hasAttestedNoClearScope) {
        planErrors.push("email plans require the fixed project-related predicate or an attested no-clear-project count predicate");
      }
    }
    if (!Number.isFinite(Number(plan.limit)) || Number(plan.limit) <= 0) planErrors.push("limit is required");
    if (plan.join || plan.joins?.length) planErrors.push("joins are not supported");
    if (plan.rawSql || plan.sql) planErrors.push("raw SQL is not supported");
    if (table) {
      if (DATA_QUERY_EXACT_OPERATIONS.has(plan.operation) && !dataQueryExactAvailable(table)) {
        planErrors.push(`operation ${plan.operation} is not computable because ${table.tableName} has no approved exact analytics transport`);
      } else if (DATA_QUERY_EXACT_OPERATIONS.has(plan.operation) && !table.exactOperations?.includes(plan.operation)) {
        planErrors.push(`operation ${plan.operation} is not computable because it is outside the approved ${table.tableName} operation allowlist`);
      }
      if (DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
        if (
          !dataQueryExactAvailable(table) ||
          !table.exactOperations?.includes(plan.operation) ||
          !table.lookupPolicy?.enabled ||
          !table.lookupPolicy.operations.includes(plan.operation)
        ) {
          planErrors.push(`operation ${plan.operation} is not computable because ${table.tableName} has no approved exact lookup contract`);
        } else {
          planErrors.push(...normalizeLookupPlan(plan, table, settings));
        }
      }
      const fieldErrors = validatePlanFields(plan, table);
      planErrors.push(...fieldErrors);
      if (!DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
        plan.limit = Math.min(Number(plan.limit), table.maxLimit, settings.maxRowsPerPlan);
      }
    }
    if (planErrors.length) {
      warnings.push(`${plan.id || "unnamed"} rejected: ${planErrors.join(", ")}`);
    } else {
      accepted.push(plan);
    }
  }

  return {
    ok: accepted.length > 0 && errors.length === 0,
    status: accepted.length ? "partial" : (warnings.some((warning) => /not computable|exact analytics (?:RPC|transport)|exact lookup contract/i.test(warning)) ? "not_computable" : "error"),
    plans: errors.length ? [] : accepted,
    warnings,
    errors
  };
}

export async function executeQueryPlans({ config = getConfig(), settings = dataQuerySettings(config), plans = [], fetchRows = null, fetchExact = null, caller = null, deadlineAt = null, now = Date.now } = {}) {
  const warnings = [];
  const output = [];
  const startedAt = now();
  const hasExternalDeadline = deadlineAt !== null && deadlineAt !== undefined && Number.isFinite(Number(deadlineAt));
  const effectiveDeadline = hasExternalDeadline ? Number(deadlineAt) : startedAt + settings.totalTimeoutMs;
  for (const plan of plans) {
    const table = settings.manifest.find((item) => item.schemaAlias === plan.schema && item.tableName === plan.table);
    const lookupCacheAllowed = !DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation) || table?.lookupPolicy?.cacheable === true;
    const cacheKey = caller?.runId && settings.runCacheEnabled !== false && lookupCacheAllowed
      ? `${caller.runId}:${dataQueryPlanSignature(plan)}`
      : null;
    const cached = cacheKey ? readDataQueryRunCache(cacheKey, now()) : null;
    if (cached) {
      if (!warnings.includes("served_from_run_cache")) warnings.push("served_from_run_cache");
      output.push(successfulPlanResult(plan, cached, true));
      continue;
    }
    const remainingMs = Math.max(0, effectiveDeadline - now());
    if (remainingMs <= 0) {
      warnings.push(`${plan.id}: total timeout exceeded`);
      output.push(failedPlanResult(plan, "total timeout exceeded", "Plan skipped after total timeout."));
      continue;
    }
    try {
      let execution;
      if (fetchExact) {
        execution = normalizeExactExecution(await fetchExact(plan), plan);
      } else if (fetchRows) {
        const rows = await fetchRows(plan);
        execution = exactExecutionFromTrustedRows(plan, rows);
      } else {
        execution = await fetchExactPlan({ config, settings, plan, timeoutMs: Math.min(settings.timeoutMsPerPlan, remainingMs) });
      }
      if (execution.truncated) warnings.push(`${plan.id}: result truncated at ${plan.limit} row(s)`);
      if (execution.sampled) warnings.push(`${plan.id}: sampled result`);
      if (cacheKey) writeDataQueryRunCache(cacheKey, execution, now(), settings.runCacheTtlMs);
      output.push(successfulPlanResult(plan, execution, false));
    } catch (error) {
      warnings.push(`${plan.id}: ${error.message}`);
      output.push(failedPlanResult(plan, error.message));
    }
  }
  return { plans: output, warnings };
}

function normalizeAlertPlanFilterAliases(plan) {
  plan.filters = (plan.filters || []).map((filter) => {
    if (filter.field === "alert_type" && filter.op !== "is") {
      if (filter.op === "in" && Array.isArray(filter.value)) {
        const canonical = filter.value.map((value) => canonicalizeDataQueryAlertType(value));
        return canonical.every(Boolean) ? { ...filter, value: [...new Set(canonical)] } : filter;
      }
      const canonical = canonicalizeDataQueryAlertType(filter.value);
      return canonical ? { ...filter, value: canonical } : filter;
    }
    if (filter.field === "input_data_type" && filter.op !== "is") {
      if (filter.op === "in" && Array.isArray(filter.value)) {
        const canonical = filter.value.map((value) => canonicalizeDataQueryAlertInputType(value));
        return canonical.every(Boolean) ? { ...filter, value: [...new Set(canonical)] } : filter;
      }
      const canonical = canonicalizeDataQueryAlertInputType(filter.value);
      return canonical ? { ...filter, value: canonical } : filter;
    }
    return filter;
  });
}

function successfulPlanResult(plan, execution, cacheHit) {
  return {
    id: plan.id,
    requestId: plan.requestId || null,
    operation: plan.operation,
    table: plan.table,
    status: "ok",
    ...cloneDataQueryValue(execution),
    cacheHit,
    provenance: planProvenance(plan, execution),
    summary: summarizePlanResult(plan, execution.rows, execution)
  };
}

export function dataQueryPlanSignature(plan = {}) {
  const normalized = normalizePlan(plan, { maxRowsPerPlan: Number.MAX_SAFE_INTEGER });
  return createHash("sha256").update(stableStringify({
    schema: normalized.schema,
    table: normalized.table,
    operation: normalized.operation,
    select: normalized.select,
    filters: [...normalized.filters].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    groupBy: normalized.groupBy,
    metrics: normalized.metrics,
    orderBy: normalized.orderBy,
    dateField: normalized.dateField || null,
    granularity: normalized.granularity || null,
    limit: normalized.limit
  })).digest("hex");
}

export function clearDataQueryRunCache() {
  DATA_QUERY_RUN_CACHE.clear();
}

function readDataQueryRunCache(key, now) {
  const entry = DATA_QUERY_RUN_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    DATA_QUERY_RUN_CACHE.delete(key);
    return null;
  }
  return cloneDataQueryValue(entry.execution);
}

function writeDataQueryRunCache(key, execution, now, ttlMs) {
  const ttl = clampNumber(ttlMs, 1000, 300000, DATA_QUERY_DEFAULTS.runCacheTtlMs);
  DATA_QUERY_RUN_CACHE.set(key, { execution: cloneDataQueryValue(execution), expiresAt: now + ttl });
  if (DATA_QUERY_RUN_CACHE.size > 500) {
    for (const [entryKey, entry] of DATA_QUERY_RUN_CACHE) {
      if (entry.expiresAt <= now || DATA_QUERY_RUN_CACHE.size > 400) DATA_QUERY_RUN_CACHE.delete(entryKey);
      if (DATA_QUERY_RUN_CACHE.size <= 400) break;
    }
  }
}

function cloneDataQueryValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function applyDataQueryCallerScope(queryPlan = {}, caller = {}, settings = dataQuerySettings()) {
  const warnings = [];
  const errors = [];
  const plans = (Array.isArray(queryPlan.plans) ? queryPlan.plans : []).map((original) => {
    const plan = { ...original, filters: Array.isArray(original.filters) ? original.filters.map((filter) => ({ ...filter })) : [] };
    const tableName = String(plan.table || plan.tableName || "").trim();
    const schema = String(plan.schema || plan.schemaAlias || "content").trim();
    const table = settings.manifest?.find((item) => item.schemaAlias === schema && item.tableName === tableName);
    if (!table) return plan;
    const callerScopedManagedTable = ["alerts", "meetings", "financial_transactions", "exceptions_report", "consultants_reports"].includes(tableName);
    const callerScopedDateTable = ["alerts", "meetings", "emails", "financial_transactions", "exceptions_report", "consultants_reports"].includes(tableName);

    if (caller.projectId) {
      if (!table.allowedFields.includes("project_id")) {
        errors.push(`${plan.id || tableName}: project_scope_not_supported`);
      } else {
        if (callerScopedManagedTable && plan.filters.some((filter) => filter.field === "project_id")) {
          const scopeName = tableName === "meetings"
            ? "meeting"
            : tableName === "financial_transactions"
              ? "financial_transaction"
              : tableName === "exceptions_report"
                ? "exception"
              : tableName === "consultants_reports"
                ? "consultant_report"
                : "alert";
          errors.push(`${plan.id || tableName}: ${scopeName}_project_scope_must_come_from_caller`);
          plan.filters = plan.filters.filter((filter) => filter.field !== "project_id");
        }
        const projectFilter = { field: "project_id", op: "eq", value: caller.projectId };
        if (callerScopedManagedTable) markDataQueryCallerScopeFilter(projectFilter);
        appendUniqueFilter(plan.filters, projectFilter);
      }
    } else if (callerScopedManagedTable && plan.filters.some((filter) => filter.field === "project_id")) {
      const scopeName = tableName === "meetings"
        ? "meeting"
        : tableName === "financial_transactions"
          ? "financial_transaction"
          : tableName === "exceptions_report"
            ? "exception"
          : tableName === "consultants_reports"
            ? "consultant_report"
            : "alert";
      errors.push(`${plan.id || tableName}: ${scopeName}_project_scope_must_come_from_caller`);
    }

    if (caller.dateFrom || caller.dateTo) {
      const dateField = table.dateFields.includes(plan.dateField) ? plan.dateField : table.defaultDateField;
      const definition = table.fields?.find((field) => field.name === dateField);
      if (!dateField || !table.dateFields.includes(dateField) || !definition) {
        errors.push(`${plan.id || tableName}: date_scope_not_supported`);
      } else {
        if (caller.dateFrom) {
          removeMirroredScopeFilter(plan.filters, dateField, ["gte", "gt"], caller.dateFrom);
          const dateFromFilter = { field: dateField, op: "gte", value: caller.dateFrom };
          if (callerScopedDateTable) markDataQueryCallerScopeFilter(dateFromFilter);
          appendUniqueFilter(plan.filters, dateFromFilter);
        }
        if (caller.dateTo) {
          removeMirroredScopeFilter(plan.filters, dateField, ["lte", "lt"], caller.dateTo);
          const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(caller.dateTo);
          if (definition.type === "timestamptz" && dateOnly) {
            const dateToFilter = { field: dateField, op: "lt", value: nextUtcDate(caller.dateTo) };
            if (callerScopedDateTable) markDataQueryCallerScopeFilter(dateToFilter);
            appendUniqueFilter(plan.filters, dateToFilter);
          } else {
            const dateToFilter = { field: dateField, op: "lte", value: caller.dateTo };
            if (callerScopedDateTable) markDataQueryCallerScopeFilter(dateToFilter);
            appendUniqueFilter(plan.filters, dateToFilter);
          }
        }
        warnings.push(`${plan.id || tableName}: caller_date_scope_applied`);
      }
    }
    return plan;
  });
  return { plan: { ...queryPlan, plans }, warnings: [...new Set(warnings)], errors: [...new Set(errors)] };
}

function markDataQueryCallerScopeFilter(filter) {
  Object.defineProperty(filter, DATA_QUERY_CALLER_SCOPE_FILTER, {
    value: true,
    enumerable: false
  });
  return filter;
}

function appendUniqueFilter(filters, candidate) {
  if (!filters.some((filter) => stableStringify(filter) === stableStringify(candidate))) filters.push(candidate);
}

function removeMirroredScopeFilter(filters, field, operators, value) {
  for (let index = filters.length - 1; index >= 0; index -= 1) {
    const filter = filters[index];
    if (filter.field === field && operators.includes(filter.op) && String(filter.value) === String(value)) filters.splice(index, 1);
  }
}

function nextUtcDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function tableDef(schemaAlias, tableName, description, fields, options = {}) {
  const fieldDefinitions = (options.fields || fields.map(inferDataQueryField))
    .filter((definition) => definition?.name && fields.includes(definition.name));
  const queryableFields = fieldDefinitions.filter((definition) => definition.queryable !== false);
  const allowedFields = queryableFields.map((definition) => definition.name);
  const dateFields = options.dateFields || queryableFields.filter((definition) => ["date", "timestamptz"].includes(definition.type)).map((definition) => definition.name);
  const numericFields = options.numericFields || queryableFields.filter((definition) => definition.aggregations?.length).map((definition) => definition.name);
  const rawLookupPolicy = options.lookupPolicy && typeof options.lookupPolicy === "object" ? options.lookupPolicy : null;
  const lookupPolicy = rawLookupPolicy
    ? {
        enabled: rawLookupPolicy.enabled === true,
        operations: [...new Set((rawLookupPolicy.operations || [...DATA_QUERY_LOOKUP_OPERATIONS]).filter((operation) => DATA_QUERY_LOOKUP_OPERATIONS.has(operation)))],
        defaultOrderField: String(rawLookupPolicy.defaultOrderField || options.defaultDateField || dateFields[0] || "").trim(),
        orderableFields: [...new Set((rawLookupPolicy.orderableFields || queryableFields.filter((definition) => definition.orderable).map((definition) => definition.name)).filter((field) => allowedFields.includes(field)))],
        stableIdField: String(rawLookupPolicy.stableIdField || "id").trim(),
        maxRows: clampNumber(rawLookupPolicy.maxRows, 1, 200, 50),
        allRowsMax: clampNumber(rawLookupPolicy.allRowsMax, 1, 200, rawLookupPolicy.maxRows || 50),
        cacheable: rawLookupPolicy.cacheable === true
      }
    : null;
  const declaredExactOperations = [...new Set(
    (options.declaredExactOperations || [...DATA_QUERY_EXACT_OPERATIONS])
      .filter((operation) => DATA_QUERY_EXACT_OPERATIONS.has(operation))
  )];
  const exactTransport = options.exactTransport || null;
  const exactEnabled = Boolean(options.exactRpc || exactTransport);
  const exactOperations = [
    ...(exactEnabled ? declaredExactOperations : []),
    ...(exactEnabled && lookupPolicy?.enabled ? lookupPolicy.operations : [])
  ];
  return {
    schemaAlias,
    tableName,
    description,
    allowedFields: [...new Set(allowedFields)],
    fields: fieldDefinitions,
    dateFields,
    searchableFields: options.searchableFields || queryableFields.filter((definition) => definition.filterOps.includes("ilike")).map((definition) => definition.name),
    groupableFields: options.groupableFields || queryableFields.filter((definition) => definition.groupable).map((definition) => definition.name),
    numericFields,
    defaultDateField: options.defaultDateField || dateFields[0] || "created_at",
    defaultLimit: options.defaultLimit || 100,
    maxLimit: options.maxLimit || 1000,
    allowedOperations: options.allowedOperations || [...READ_OPERATIONS],
    exactRpc: options.exactRpc || null,
    exactTransport,
    declaredExactOperations,
    exactOperations: [...new Set(exactOperations)],
    lookupPolicy,
    executionContract: options.executionContract || null,
    valueNormalization: options.valueNormalization || null,
    notComputableCapabilities: options.notComputableCapabilities || null
  };
}

export function normalizeDataQueryCaller(input = {}, settings = DATA_QUERY_DEFAULTS) {
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const warnings = [];
  const errors = [];
  const rawSource = String(input.source || context.source || "").trim();
  const source = DATA_QUERY_CALLER_SOURCES.has(rawSource) ? rawSource : "api";
  if (!DATA_QUERY_CALLER_SOURCES.has(rawSource)) warnings.push("unknown_caller_source");

  const runId = normalizeCallerId(input.runId || input.run_id || context.runId || context.run_id, "runId", warnings);
  const callerNodeId = normalizeCallerId(input.callerNodeId || input.caller_node_id || context.callerNodeId || context.caller_node_id, "callerNodeId", warnings);
  const dateFrom = normalizeScopeDate(input.dateFrom || input.date_from || context.dateFrom || context.date_from, "dateFrom", errors);
  const dateTo = normalizeScopeDate(input.dateTo || input.date_to || context.dateTo || context.date_to, "dateTo", errors);
  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) errors.push("dateFrom must not be after dateTo");

  const projectId = normalizeOptionalString(input.projectId || input.project_id || context.projectId || context.project_id);
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    errors.push("projectId must be a UUID");
  }
  const caseId = normalizeOptionalString(input.caseId || input.case_id || context.caseId || context.case_id);
  if (caseId) errors.push("caseId scope is not supported by the Content data_index contract");

  const rawBudget = {
    ...(context.budget && typeof context.budget === "object" ? context.budget : {}),
    ...(input.budget && typeof input.budget === "object" ? input.budget : {})
  };
  if (input.maxPlans !== undefined && rawBudget.maxPlans === undefined) rawBudget.maxPlans = input.maxPlans;
  const budgetFields = [
    ["maxPlans", 1],
    ["maxRowsPerPlan", 1],
    ["timeoutMsPerPlan", 1],
    ["totalTimeoutMs", 1],
    ["plannerTimeoutMs", 1]
  ];
  const effectiveSettings = { ...settings };
  const budget = {};
  for (const [field, minimum] of budgetFields) {
    const configured = Number(settings[field] ?? DATA_QUERY_DEFAULTS[field]);
    const requested = rawBudget[field];
    if (requested === undefined || requested === null || requested === "") {
      effectiveSettings[field] = configured;
      budget[field] = configured;
      continue;
    }
    const parsed = Number(requested);
    if (!Number.isFinite(parsed) || parsed < minimum) {
      warnings.push(`invalid_budget_ignored:${field}`);
      effectiveSettings[field] = configured;
      budget[field] = configured;
      continue;
    }
    if (parsed > configured) warnings.push(`budget_expansion_ignored:${field}`);
    const narrowed = Math.min(configured, Math.floor(parsed));
    effectiveSettings[field] = narrowed;
    budget[field] = narrowed;
  }

  return {
    caller: {
      version: 1,
      source,
      runId,
      callerNodeId,
      dateFrom,
      dateTo,
      projectId,
      caseId,
      budget
    },
    settings: effectiveSettings,
    warnings,
    errors
  };
}

export function parseDataQueryLookupIntent(question) {
  const financialTypeAnalysis = analyzeDataQueryFinancialTransactionType(question);
  const text = normalizeDataQueryHebrewQuestion(question);
  const financialType = DATA_QUERY_FINANCIAL_DOCUMENT_PATTERN.test(text)
    ? null
    : financialTypeAnalysis.match;
  if (!text || (!financialType && !DATA_QUERY_LOOKUP_TARGET_PATTERN.test(text))) return null;
  if (DATA_QUERY_LOOKUP_TEMPORAL_WINDOW_PATTERN.test(text) || DATA_QUERY_LOOKUP_SORT_ONLY_PATTERN.test(text)) return null;
  if (
    financialType &&
    DATA_QUERY_FINANCIAL_SEMANTIC_DETAIL_PATTERN.test(text) &&
    !DATA_QUERY_BET_PREFIXED_LATEST_INVOICE_PATTERN.test(text)
  ) return null;
  const allRequested = Boolean(financialType && isDataQueryFinancialAllListIntent(question));
  const direction = allRequested
    ? "latest"
    : financialType
      ? dataQueryFinancialLookupDirection(text)
      : dataQueryLookupDirection(text);
  if (!direction) return null;
  const explicitLimit = extractDataQueryLookupLimit(text);
  const targetTable = dataQueryLookupTargetTable(text, financialType);
  const pluralAlertDefault = targetTable === "alerts" &&
    direction === "latest" &&
    explicitLimit === null &&
    /\balerts\b|התראות/iu.test(text);
  const pluralEmailDefault = targetTable === "emails" &&
    direction === "latest" &&
    explicitLimit === null &&
    /\bemails\b|מיילים/iu.test(text);
  const pluralExceptionDefault = targetTable === "exceptions_report" &&
    direction === "latest" &&
    explicitLimit === null &&
    (/\b(?:exceptions|change\s+orders)\b/iu.test(text) ||
      (/חריגים/iu.test(text) && !/דוח\s+(?:ה)?חריגים/iu.test(text)));
  const pluralConsultantDefault = targetTable === "consultants_reports" &&
    direction === "latest" && explicitLimit === null && /\bconsultant\s+reports\b|דוחות\s+(?:ה)?יועצים/iu.test(text);
  const limit = allRequested
    ? DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT
    : explicitLimit === null
      ? (pluralAlertDefault || pluralEmailDefault || pluralExceptionDefault || pluralConsultantDefault ? 5 : 1)
      : explicitLimit;
  const recordKind = targetTable === "safety_reports"
    ? "safety_report"
    : targetTable === "alerts"
      ? "alert"
      : targetTable === "meetings"
        ? "meeting"
        : targetTable === "emails"
          ? "email"
        : targetTable === "exceptions_report"
          ? "exception_report"
        : targetTable === "consultants_reports"
          ? "consultant_report"
        : dataQueryFinancialRecordKind(text, financialType);
  const alertMetricScope = recordKind === "alert" ? dataQueryAlertMetricScope(text) : null;
  const alertGroupedLookup = recordKind === "alert" && Boolean(alertMetricScope?.groupField);
  const financialTypeFilter = dataQueryFinancialTransactionTypeFilter(financialType);
  return {
    kind: "lookup",
    operation: direction === "earliest"
      ? "lookup_earliest"
      : (limit > 1 ? "lookup_last_n" : "lookup_latest"),
    direction,
    order: direction === "earliest" ? "asc" : "desc",
    limit,
    explicitLimit: explicitLimit !== null,
    allRequested,
    targetTable,
    recordKind,
    financialType,
    requiredFilters: financialTypeFilter
      ? [financialTypeFilter]
      : recordKind === "alert"
        ? alertMetricScope.requiredFilters
        : recordKind === "email"
          ? [{ field: "relevance_status", op: "in", value: DATA_QUERY_EMAIL_RELEVANCE_VALUES }]
        : [],
    forbiddenFilterFields: recordKind === "financial_document"
      ? ["transaction_type"]
      : recordKind === "alert"
        ? ["status", "created_at", "input_data_id", "data_link"]
        : recordKind === "meeting"
          ? [
              "created_at",
              "subject",
              "item_status",
              "decisions_made",
              "attendances",
              "attachment_id",
              "mail_id",
              "document_filename"
            ]
        : recordKind === "email"
          ? [
              "created_at",
              "project_id",
              "mail_id",
              "conversationid",
              "sender_name",
              "sender_mail",
              "other_recipients",
              "subject",
              "summary",
              "mail_summarize",
              "mail_body",
              "content",
              "hashtags",
              "metadata",
              "embedding"
            ]
        : recordKind === "exception_report"
          ? [
              "created_at",
              "project_id",
              "exception_number",
              "supervision_company",
              "inspector",
              "project_manager",
              "exception_subject",
              "execution_days",
              "requested_amount_ex_vat",
              "vat_amount",
              "total_amount_incl_vat",
              "main_contractor_profit",
              "mail_id",
              "attachment_id",
              "hashtags",
              "summary",
              "content",
              "metadata",
              "embedding"
            ]
        : recordKind === "consultant_report"
          ? [
              "created_at", "project_id", "consultant_name", "specialization", "report_topic",
              "main_recommendations", "proposed_actions", "implementation_status", "mail_id",
              "attachment_id", "document_name", "hashtags", "summary", "content", "metadata", "embedding"
            ]
        : [],
    unsupportedReason: DATA_QUERY_LOOKUP_UNPARSED_NUMBER_PATTERN.test(text)
      ? "unparsed_lookup_limit"
      : allRequested && explicitLimit !== null
        ? "all_lookup_with_explicit_limit"
      : alertGroupedLookup
        ? "alert_grouped_lookup_not_supported"
      : recordKind === "alert" && dataQueryAlertLookupHasUnapprovedModifier(text, alertMetricScope)
        ? "unapproved_alert_lookup_qualifier"
      : recordKind === "meeting" && dataQueryMeetingLookupHasUnapprovedModifier(text)
        ? "unapproved_meeting_lookup_qualifier"
      : recordKind === "email" && dataQueryEmailLookupHasUnapprovedModifier(text)
        ? "unapproved_email_lookup_qualifier"
      : recordKind === "exception_report" && dataQueryExceptionLookupHasUnapprovedModifier(text)
        ? "unapproved_exception_lookup_qualifier"
      : recordKind === "consultant_report" && (
          DATA_QUERY_CONSULTANT_IDENTITY_PATTERN.test(text) ||
          DATA_QUERY_CONSULTANT_CATEGORY_PATTERN.test(text) ||
          DATA_QUERY_CONSULTANT_IMPLEMENTATION_PATTERN.test(text) ||
          DATA_QUERY_CONSULTANT_SCOPE_FIELD_PATTERN.test(text)
        )
        ? "unapproved_consultant_lookup_qualifier"
      : direction === "earliest" && explicitLimit !== null && explicitLimit > 1
        ? "earliest_n_not_supported"
        : null
  };
}

function dataQueryAlertCountGrammar(text) {
  const normalized = String(text || "")
    .trim()
    .replace(/^(?:please\s+)?(?:show|give)\s+(?:me\s+)?/iu, "")
    .replace(/[?.!,;]+$/u, "")
    .trim();
  const englishModifier = "(?:delay|update|warning|exception|anomaly|quality|safety[-\\s]?event|email|relevant|irrelevant|non[-\\s]?relevant|meeting[-\\s]?summary\\s+attachment|safety[-\\s]?report\\s+attachment|exception[-\\s]?report\\s+attachment|stored\\s+severity\\s+level\\s+3|being[-\\s]?handled|undated)";
  const alertType = "(?:alerts?|updates?|warnings?|delays?|exceptions?|anomal(?:y|ies)|quality|safety[-\\s]?events?)";
  const inputType = "(?:emails?|meeting[-\\s]?summary\\s+attachments?|safety[-\\s]?report\\s+attachments?|exception[-\\s]?report\\s+attachments?)";
  const month = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";
  const dateAtom = `(?:${month}(?:\\s+\\d{4})?|\\d{4}(?:-\\d{2}(?:-\\d{2})?)?|today|yesterday|this\\s+(?:day|week|month|year)|last\\s+(?:day|week|month|year))`;
  const dateTail = `(?:\\s+(?:(?:in|during|on|since|before|after)\\s+${dateAtom}|between\\s+${dateAtom}\\s+and\\s+${dateAtom}|from\\s+${dateAtom}\\s+to\\s+${dateAtom}))?`;
  const harmlessTail = `(?:\\s+(?:(?:are|were)\\s+there|d(?:o|id)\\s+we\\s+have|occurred|exist(?:s)?|(?:are\\s+)?in\\s+the\\s+system))?${dateTail}`;
  const lead = `(?:how\\s+many|(?:what\\s+is\\s+)?(?:the\\s+)?number\\s+of|count|total(?:\\s+number\\s+of)?)`;
  const englishPatterns = [
    new RegExp(`^${lead}\\s+(?:${englishModifier}\\s+)?alerts?${harmlessTail}$`, "iu"),
    new RegExp(`^(?:${englishModifier}\\s+)?alerts?\\s+(?:count|total)${dateTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:of\\s+type|with\\s+type)\\s+${alertType}${harmlessTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:from|with\\s+input\\s+type)\\s+${inputType}${harmlessTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:have|with)\\s+stored\\s+severity\\s+level\\s+3${harmlessTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:have|with)\\s+stored\\s+relevance\\s+flag\\s+(?:true|false)${harmlessTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:are\\s+)?being[-\\s]?handled${dateTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:have|with)\\s+stored\\s+(?:item\\s+)?status\\s+(?:is\\s+)?being[-\\s]?handled${dateTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:(?:have|with)\\s+no\\s+|without\\s+(?:a\\s+)?|missing\\s+(?:the\\s+)?)(?:data_)?date${harmlessTail}$`, "iu"),
    new RegExp(`^${lead}\\s+alerts?\\s+(?:with\\s+)?data_date\\s+(?:is\\s+)?null${harmlessTail}$`, "iu")
  ];
  if (englishPatterns.some((pattern) => pattern.test(normalized))) return true;
  const hebrewMonth = "(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)";
  const hebrewPatterns = [
    /^(?:(?:כמה|מספר|סך(?:\s+כל)?)\s+(?:ה)?התרא(?:ה|ות)(?:\s+(?:יש(?:\s+במערכת)?|קיימות(?:\s+במערכת)?))?|מה\s+מספר\s+(?:ה)?התרא(?:ה|ות))$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+מסוג\s+(?:עדכון|התראה|עיכוב|חריג|איכות|אירוע\s+בטיחות)(?:\s+יש)?$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+בטיפול(?:\s+יש)?$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+(?:ללא|חסרות)\s+תאריך(?:\s+יש)?$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+(?:מ|מתוך|מסוג\s+קלט)\s*(?:מייל(?:ים)?|קבצי?\s+סיכו(?:ם|מי)\s+ישיב(?:ה|ות)?|קבצי?\s+דוח(?:ות)?\s+(?:בטיחות|חריג))(?:\s+יש)?$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+עם\s+(?:רמת\s+)?חומרה\s+(?:שמורה\s+)?3(?:\s+יש)?$/iu,
    /^כמה\s+(?:ה)?התרא(?:ה|ות)\s+(?:עם\s+(?:דגל\s+)?רלוונטיות\s+(?:אמת|שקר)|לא\s+רלוונטיות|רלוונטיות)(?:\s+יש)?$/iu,
    new RegExp(`^כמה\\s+(?:ה)?התרא(?:ה|ות)(?:\\s+היו)?\\s+ב${hebrewMonth}(?:\\s+\\d{4})?$`, "iu"),
    /^כמה\s+(?:ה)?התרא(?:ה|ות)(?:\s+היו)?\s+בין\s+(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(?:ל|עד)\s*(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})$/iu
  ];
  return hebrewPatterns.some((pattern) => pattern.test(normalized));
}

function dataQueryAlertMetricGrammar(text, metricScope) {
  if (metricScope?.operation === "count") return dataQueryAlertCountGrammar(text);
  const normalized = String(text || "")
    .trim()
    .replace(/^(?:please\s+)?/iu, "")
    .replace(/[?.!,;]+$/u, "")
    .trim();
  const modifier = "(?:delay|update|warning|exception|anomaly|quality|safety[-\\s]?event|email|relevant|irrelevant|non[-\\s]?relevant|meeting[-\\s]?summary\\s+attachment|safety[-\\s]?report\\s+attachment|exception[-\\s]?report\\s+attachment|stored\\s+severity\\s+level\\s+3|being[-\\s]?handled|undated)";
  const entity = `(?:${modifier}\\s+)?alerts?`;
  if (metricScope?.operation === "group_count") {
    const group = "(?:(?:alert\\s+)?(?:type|types|category|kind)|stored\\s+severity(?:\\s+level)?|input\\s+type|technical\\s+origin|stored\\s+(?:item\\s+)?status|stored\\s+relevance(?:\\s+flag)?)";
    const patterns = [
      new RegExp(`^(?:break\\s+down|show\\s+(?:the\\s+)?breakdown\\s+of)\\s+${entity}\\s+by\\s+${group}$`, "iu"),
      new RegExp(`^show\\s+(?:the\\s+)?(?:distribution|breakdown|counts?)\\s+of\\s+${entity}\\s+by\\s+${group}$`, "iu"),
      new RegExp(`^(?:show\\s+)?(?:the\\s+)?distribution\\s+of\\s+(?:alert\\s+types?|input\\s+types?|stored\\s+severity\\s+levels?|stored\\s+item\\s+statuses|stored\\s+relevance\\s+flags?)$`, "iu"),
      new RegExp(`^(?:show\\s+)?(?:the\\s+)?alert\\s+type\\s+distribution$`, "iu"),
      new RegExp(`^show\\s+alert\\s+count\\s+for\\s+each\\s+${group}$`, "iu"),
      new RegExp(`^(?:how\\s+many|count)\\s+${entity}\\s+(?:for\\s+each|per|by)\\s+${group}$`, "iu"),
      new RegExp(`^${entity}\\s+(?:breakdown|distribution)\\s+(?:by\\s+)?${group}$`, "iu")
    ];
    if (patterns.some((pattern) => pattern.test(normalized))) return true;
    return /^(?:פילוח|התפלגות)\s+(?:ה)?התרא(?:ה|ות)\s+לפי\s+(?:סוג(?:\s+התראה)?|רמת\s+חומרה\s+שמורה|סוג\s+קלט|סטטוס\s+פריט\s+שמור|דגל\s+רלוונטיות\s+שמור)$|^(?:פילוח|התפלגות)\s+(?:סוגי\s+התראות|סוגי\s+קלט\s+של\s+התראות|דגלי\s+רלוונטיות\s+של\s+התראות|רמות\s+חומרה\s+שמורות\s+של\s+התראות)$/iu.test(normalized);
  }
  if (metricScope?.operation === "timeseries") {
    const patterns = [
      new RegExp(`^(?:show\\s+)?(?:the\\s+)?(?:daily|monthly)?\\s*(?:trend|time\\s*series|breakdown|counts?|distribution)\\s+(?:of\\s+)?${entity}$`, "iu"),
      new RegExp(`^(?:show\\s+)?(?:daily|monthly)\\s+${entity}\\s+counts?$`, "iu"),
      new RegExp(`^(?:show\\s+)?(?:the\\s+)?${entity}\\s+(?:(?:daily|monthly)\\s+)?(?:trend|time\\s*series|over\\s+time|by\\s+date)$`, "iu"),
      new RegExp(`^break\\s+down\\s+${entity}\\s+by\\s+(?:day|month|date)$`, "iu"),
      new RegExp(`^how\\s+many\\s+${entity}\\s+(?:per|by)\\s+(?:day|month)$`, "iu")
    ];
    if (patterns.some((pattern) => pattern.test(normalized))) return true;
    return /^(?:הצג\s+)?(?:מגמה|סדרת\s+זמן|פילוח)\s+(?:של\s+)?(?:ה)?התרא(?:ה|ות)(?:\s+לפי\s+(?:יום|חודש|תאריך))?$|^כמה\s+(?:ה)?התרא(?:ה|ות)\s+לפי\s+(?:יום|חודש)$/iu.test(normalized);
  }
  return false;
}

function dataQueryAlertMixedExactSemantic(text, lookupCandidate) {
  const connector = /\s*(?:\b(?:and|also|plus|then)\b|[?!.,;])\s*(?=(?:why|explain|describe|show\s+evidence|give\s+evidence|summari[sz]e|recommend|who\s+is\s+responsible|מה|למה|מדוע|הסבר|תאר|הצג|סכם|המלץ))/iu;
  const exactClause = String(text || "").split(connector)[0].trim();
  const exactLead = lookupCandidate
    ? /\b(?:latest|newest|most\s+recent|last|earliest|oldest|first)\b|(?:אחרונ|ראשונ|עדכני|מוקדם)/iu.test(exactClause)
    : dataQueryAlertCountGrammar(exactClause);
  if (!exactLead) return false;
  return connector.test(String(text || "")) ||
    /\balerts?\b.{0,45}\b(?:and|also|plus|then)\b.{0,35}\b(?:why|explain|describe|evidence|reason|cause|recommend|responsib|summary|corrective)\w*\b|התרא(?:ה|ות).{0,45}(?:וגם|בנוסף|ו).{0,35}(?:למה|מדוע|הסבר|תיאור|ראיות|סיבה|גורם|המלצה|אחראי|סיכום)/iu.test(text);
}

function dataQueryAlertLookupHasUnapprovedModifier(text, metricScope = null) {
  if (DATA_QUERY_ALERT_HEBREW_LATEST_RAISED_WHY_PATTERN.test(String(text || "").trim())) return false;
  const semanticConnector = /\s*(?:\b(?:and|also|plus|then)\b|[?!.,;])\s*(?=(?:why|explain|describe|show\s+evidence|give\s+evidence|summari[sz]e|recommend|who\s+is\s+responsible|מה|למה|מדוע|הסבר|תאר|הצג|סכם|המלץ))/iu;
  const lookupClause = String(text || "").split(semanticConnector)[0].trim();
  const normalizedLookupClause = lookupClause.replace(/[?.!,;]+$/u, "").trim();
  const numberToken = dataQueryLookupNumberToken();
  const englishLead = "(?:(?:please\\s+)?(?:(?:show|display|list)(?:\\s+me)?|give\\s+me)\\s+|what\\s+(?:is|are)\\s+)?";
  const englishDirection = "(?:latest|newest|most\\s+recent|last|earliest|oldest|first)";
  const englishModifier = "(?:delay|update|warning|exception|anomaly|quality|safety[-\\s]?event|email|relevant|irrelevant|non[-\\s]?relevant|meeting[-\\s]?summary\\s+attachment|safety[-\\s]?report\\s+attachment|exception[-\\s]?report\\s+attachment|stored\\s+severity\\s+level\\s+3|being[-\\s]?handled)";
  const englishType = "(?:alerts?|updates?|warnings?|delays?|exceptions?|anomal(?:y|ies)|quality|safety[-\\s]?events?)";
  const englishInput = "(?:emails?|meeting[-\\s]?summary\\s+attachments?|safety[-\\s]?report\\s+attachments?|exception[-\\s]?report\\s+attachments?)";
  const englishAllowedTail = `(?:\\s+(?:(?:of\\s+type|with\\s+type)\\s+${englishType}|(?:from|with\\s+input\\s+type)\\s+${englishInput}|(?:with\\s+)?stored\\s+(?:severity\\s+level\\s+3|relevance\\s+flag\\s+(?:true|false)|item\\s+status\\s+being[-\\s]?handled)))?`;
  const approvedEnglishShape = [
    new RegExp(`^${englishLead}(?:the\\s+)?${englishDirection}(?:\\s+${numberToken})?\\s+(?:${englishModifier}\\s+)?alerts?${englishAllowedTail}$`, "iu"),
    new RegExp(`^${englishLead}(?:the\\s+)?${numberToken}\\s+${englishDirection}\\s+(?:${englishModifier}\\s+)?alerts?${englishAllowedTail}$`, "iu")
  ].some((pattern) => pattern.test(normalizedLookupClause));
  if (/\balerts?\b/iu.test(normalizedLookupClause) && !approvedEnglishShape) return true;

  const hebrewDirectionShape = "(?:ה)?(?:אחרו(?:ן|נה|נים|נות)|הכי\\s+חדש(?:ה|ים|ות)?|עדכני(?:ת|ים|ות)?|ראשו(?:ן|נה|נים|נות)|הכי\\s+מוקד(?:ם|מת|מים|מות)|המוקד(?:ם|מת)\\s+ביותר|היש(?:ן|נה)\\s+ביותר)";
  const hebrewWord = `[\\p{L}\\p{N}"׳'-]+`;
  const hebrewShape = new RegExp(
    `^(?:(?:נא\\s+)?(?:הצג|הראה)(?:\\s+לי)?\\s+(?:את\\s+)?)?(?:${numberToken}\\s+)?(?:ה)?התרא(?:ה|ות)(?:\\s+${hebrewWord}){0,4}\\s+${hebrewDirectionShape}(?:\\s+${hebrewWord}){0,6}$`,
    "iu"
  );
  if (/(?:ה)?התרא(?:ה|ות)/iu.test(normalizedLookupClause) && !hebrewShape.test(normalizedLookupClause)) return true;
  const match = lookupClause.match(
    /\b(?:latest|newest|most\s+recent|last|earliest|oldest|first)(?:\s+(?:\d{1,6}|one[-\s]hundred|hundred|dozen|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[-\s](?:one|two|three|four|five))?|one|two|three|four|five|six|seven|eight|nine|ten))?\s+([^?.!,]{0,60}?)\s*alerts?\b/iu
  );
  const modifier = String(match?.[1] || "").trim().replace(/\s+/g, " ");
  const unapprovedPrefix = Boolean(match && modifier) &&
    !/^(?:delay|update|warning|exception|anomaly|quality|safety[-\s]?event|email|relevant|irrelevant|non[-\s]?relevant|meeting[-\s]?summary\s+attachment|safety[-\s]?report\s+attachment|exception[-\s]?report\s+attachment|stored\s+severity\s+level\s+3|being[-\s]?handled|dated)$/iu.test(modifier);
  const englishTail = lookupClause.match(/\balerts?\b(.*)$/iu)?.[1]?.trim().replace(/[?.!,;]+$/u, "").trim() || "";
  const approvedEnglishTail = !englishTail ||
    /^(?:of\s+type|with\s+type)\s+(?:alerts?|updates?|warnings?|delays?|exceptions?|anomal(?:y|ies)|quality|safety[-\s]?events?)$/iu.test(englishTail) ||
    /^(?:from|with\s+input\s+type)\s+(?:emails?|meeting[-\s]?summary\s+attachments?|safety[-\s]?report\s+attachments?|exception[-\s]?report\s+attachments?)$/iu.test(englishTail) ||
    /^(?:with\s+)?stored\s+(?:severity\s+level\s+3|relevance\s+flag\s+(?:true|false)|item\s+status\s+being[-\s]?handled)$/iu.test(englishTail);
  const hebrewDirectionPattern = "(?:ה?אחרו(?:ן|נה|נים|נות)|הכי\\s+חדש(?:ה|ים|ות)?|עדכני(?:ת|ים|ות)?|ה?ראשו(?:ן|נה|נים|נות)|הכי\\s+מוקד(?:ם|מת|מים|מות)|המוקד(?:ם|מת)\\s+ביותר|היש(?:ן|נה)\\s+ביותר)";
  const hebrewDirection = lookupClause.match(new RegExp(`${hebrewDirectionPattern}(.*)$`, "iu"));
  const hebrewTail = hebrewDirection?.[1]?.trim().replace(/[?.!,;]+$/u, "").trim() || "";
  const hebrewMiddle = lookupClause.match(new RegExp(`(?:ה)?התרא(?:ה|ות)\\s+(.*?)\\s+${hebrewDirectionPattern}`, "iu"))?.[1]?.trim() || "";
  const typedFilterFields = new Set((metricScope?.requiredFilters || []).map((filter) => filter?.field));
  const approvedHebrewTail = !hebrewTail || (
    (typedFilterFields.has("alert_type") && /^מסוג\s+(?:עדכון|התראה|עיכוב|חריג|איכות|אירוע\s+בטיחות)$/iu.test(hebrewTail)) ||
    (typedFilterFields.has("input_data_type") && /^(?:מ|מתוך|מסוג\s+קלט)\s*(?:מייל(?:ים)?|קבצי?\s+סיכו(?:ם|מי)\s+ישיב(?:ה|ות)?|קבצי?\s+דוח(?:ות)?\s+(?:בטיחות|חריג))$/iu.test(hebrewTail))
  );
  const approvedHebrewMiddle = !hebrewMiddle ||
    (typedFilterFields.has("alert_type") && /^(?:מסוג\s+)?(?:ה)?(?:עדכון|התראה|עיכוב|חריג|איכות|אירוע(?:י)?\s+בטיחות)$/iu.test(hebrewMiddle)) ||
    (typedFilterFields.has("input_data_type") && /^(?:מ|מתוך|מסוג\s+קלט)?\s*(?:מייל(?:ים)?|קבצי?\s+סיכו(?:ם|מי)\s+ישיב(?:ה|ות)?|קבצי?\s+דוח(?:ות)?\s+(?:בטיחות|חריג))$/iu.test(hebrewMiddle)) ||
    (typedFilterFields.has("severity_level") && /^(?:עם\s+)?(?:רמת\s+)?חומרה\s+(?:שמורה\s+)?3$/iu.test(hebrewMiddle)) ||
    (typedFilterFields.has("item_status") && /^(?:ב)?טיפול$/iu.test(hebrewMiddle)) ||
    (typedFilterFields.has("is_relevant") && /^(?:לא\s+)?רלוונטי(?:ת|ות|ים)?$/iu.test(hebrewMiddle));
  return unapprovedPrefix || !approvedEnglishTail || !approvedHebrewTail || !approvedHebrewMiddle;
}

function dataQueryMeetingLookupHasUnapprovedModifier(text) {
  const raw = String(text || "").trim();
  if (DATA_QUERY_MEETING_MIXED_LATEST_DECISION_PATTERN.test(raw)) return false;
  const normalized = raw.replace(/[?.!,;]+$/u, "").trim();
  const number = dataQueryLookupNumberToken();
  const direction = "(?:latest|newest|most\\s+recent|last|earliest|oldest|first)";
  const english = [
    new RegExp(`^(?:(?:please\\s+)?(?:show|give)(?:\\s+me)?|(?:what|which)\\s+(?:is|was))\\s+(?:the\\s+)?${direction}(?:\\s+${number})?\\s+meetings?$`, "iu"),
    new RegExp(`^(?:(?:please\\s+)?(?:show|give)(?:\\s+me)?\\s+)?(?:the\\s+)?${number}\\s+${direction}\\s+meetings$`, "iu")
  ];
  const hebrew = /^(?:(?:הצג|הראה)(?:\s+לי)?\s+(?:את\s+)?|מהי\s+|(?:מה|מתי)\s+הייתה\s+)?(?:[\p{L}\d]+\s+)?(?:ה)?(?:ישיב(?:ה|ות)|פגיש(?:ה|ות))\s+(?:ה?אחרו(?:נה|נות)|ה?ראשו(?:נה|נות)|הכי\s+חדשה|הכי\s+מוקדמת)$/iu;
  return !english.some((pattern) => pattern.test(normalized)) && !hebrew.test(normalized);
}

function dataQueryEmailLookupHasUnapprovedModifier(text) {
  const normalized = String(text || "").trim().replace(/[?.!,;]+$/u, "").trim();
  const number = dataQueryLookupNumberToken();
  const direction = "(?:latest|newest|most\\s+recent|last|earliest|oldest|first)";
  const english = [
    new RegExp(`^(?:(?:please\\s+)?(?:show|list|give)(?:\\s+me)?\\s+)?(?:the\\s+)?${direction}(?:\\s+${number})?\\s+(?:project[-\\s]?related\\s+)?emails?$`, "iu"),
    new RegExp(`^(?:(?:please\\s+)?(?:show|list|give)(?:\\s+me)?\\s+)?(?:the\\s+)?${number}\\s+${direction}\\s+(?:project[-\\s]?related\\s+)?emails?$`, "iu"),
    /^(?:when\s+(?:was|did)|what\s+is)\s+the\s+(?:latest|newest|most\s+recent|earliest|oldest|first)\s+(?:project[-\s]?related\s+)?email(?:\s+(?:arrive|received))?$/iu
  ];
  const hebrew = /^(?:(?:הצג|הראה)(?:\s+לי)?\s+(?:את\s+)?(?:[\p{L}\d]+\s+)?(?:ה)?מייל(?:ים)?\s+(?:ה)?(?:אחרון|אחרונה|אחרונים|אחרונות|ראשון|ראשונה|ראשונים|ראשונות)|מתי\s+(?:התקבל|הגיע)\s+(?:ה)?מייל\s+(?:ה)?(?:אחרון|ראשון)|מה\s+(?:ה)?מייל\s+(?:ה)?(?:אחרון|ראשון)\s+שמופיע)$/iu;
  return !english.some((pattern) => pattern.test(normalized)) && !hebrew.test(normalized);
}

function dataQueryExceptionLookupHasUnapprovedModifier(text) {
  const raw = String(text || "").trim();
  if (DATA_QUERY_EXCEPTION_MIXED_LATEST_PATTERN.test(raw)) return false;
  const normalized = normalizeHebrewExceptionMetricQuestion(raw).grammarText
    .replace(/[?.!,;]+$/u, "")
    .trim();
  const number = dataQueryLookupNumberToken();
  const direction = "(?:latest|newest|most\\s+recent|last|earliest|oldest|first)";
  const english = [
    new RegExp(`^(?:(?:please\\s+)?(?:show|list|give)(?:\\s+me)?\\s+)?(?:the\\s+)?${direction}(?:\\s+${number})?\\s+(?:exception(?:\\s+reports?)?s?|change\\s+orders?)$`, "iu"),
    new RegExp(`^(?:(?:please\\s+)?(?:show|list|give)(?:\\s+me)?\\s+)?(?:the\\s+)?${number}\\s+${direction}\\s+(?:exception(?:\\s+reports?)?s?|change\\s+orders?)$`, "iu"),
    /^(?:when|what)\s+(?:was|is)\s+the\s+(?:latest|newest|most\s+recent|earliest|oldest|first)\s+(?:exception|change\s+order)$/iu
  ];
  const hebrew = new RegExp(
    `^(?:(?:הצג|הראה|תראה)(?:\\s+לי)?\\s+(?:את\\s+)?(?:${number}\\s+)?(?:(?:דוח|דוחות)\\s+)?(?:ה)?חריגים\\s+(?:ה)?(?:אחרון|אחרונה|אחרונים|אחרונות|ראשון|ראשונה|ראשונים|ראשונות)|(?:מה|מהו|מהי|מתי)\\s+(?:היה|הייתה|הוא|היא)?\\s*(?:(?:דוח|דוחות)\\s+)?(?:ה)?חריגים\\s+(?:ה)?(?:אחרון|אחרונה|ראשון|ראשונה))$`,
    "iu"
  );
  return !english.some((pattern) => pattern.test(normalized)) && !hebrew.test(normalized);
}

export function classifyDataQueryCapability(question, {
  hasExplicitPlan = false,
  hasDataQueryHint = false,
  settings = null,
  lookupAvailable = false,
  lookupMaxRows = 50
} = {}) {
  const financialTypeAnalysis = analyzeDataQueryFinancialTransactionType(question);
  const text = normalizeDataQueryHebrewQuestion(question);
  const metricScope = parseDataQueryMetricScope(question);
  const quantitativeTarget = dataQueryLookupTargetTable(text, financialTypeAnalysis.match);
  const parsedLookupCandidate = parseDataQueryLookupIntent(question);
  const lookupCandidate = parsedLookupCandidate?.allRequested
    ? {
        ...parsedLookupCandidate,
        limit: dataQueryLookupMaxRows(settings, parsedLookupCandidate, lookupMaxRows)
      }
    : parsedLookupCandidate;
  const explicitlyQuantitative = DATA_QUERY_QUANTITATIVE_PATTERN.test(text);
  const approvedAlertMetricGrammar = quantitativeTarget === "alerts" &&
    ["count", "group_count", "timeseries"].includes(metricScope?.operation) &&
    dataQueryAlertMetricGrammar(text, metricScope);
  const approvedMeetingMetricGrammar = quantitativeTarget === "meetings" &&
    ["count", "group_count", "distinct", "timeseries"].includes(metricScope?.operation) &&
    dataQueryMeetingMetricGrammar(text, metricScope);
  const approvedEmailMetricGrammar = quantitativeTarget === "emails" &&
    ["count", "group_count", "distinct", "timeseries"].includes(metricScope?.operation) &&
    dataQueryEmailMetricGrammar(text, metricScope);
  const approvedExceptionMetricGrammar = quantitativeTarget === "exceptions_report" &&
    ["count", "group_count", "aggregate", "timeseries"].includes(metricScope?.operation) &&
    dataQueryExceptionMetricGrammar(text, metricScope);
  const approvedConsultantMetricGrammar = quantitativeTarget === "consultants_reports" &&
    ["count", "group_count", "timeseries"].includes(metricScope?.operation) &&
    dataQueryConsultantMetricGrammar(text, metricScope);
  const quantitative = hasExplicitPlan ||
    explicitlyQuantitative ||
    approvedAlertMetricGrammar ||
    approvedMeetingMetricGrammar ||
    approvedEmailMetricGrammar ||
    approvedExceptionMetricGrammar ||
    approvedConsultantMetricGrammar ||
    (quantitativeTarget === "exceptions_report" && dataQueryExceptionCountApprovalMixed(text)) ||
    (hasDataQueryHint && !["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(quantitativeTarget));
  const exactSafetyDefectAggregate = quantitativeTarget === "safety_reports" &&
    metricScope?.operation === "aggregate" &&
    Array.isArray(metricScope.metrics) &&
    metricScope.metrics.length > 0;
  const semanticText = financialTypeAnalysis.match?.key === "price_quote"
    ? text.replace(/\bprice\s+quotes?\b/giu, "")
    : text;
  const semantic = DATA_QUERY_SEMANTIC_PATTERN.test(semanticText) ||
    (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_SEMANTIC_DETAIL_PATTERN.test(text)) ||
    (quantitativeTarget === "meetings" && DATA_QUERY_MEETING_SEMANTIC_DETAIL_PATTERN.test(text)) ||
    (quantitativeTarget === "emails" && DATA_QUERY_EMAIL_SEMANTIC_DETAIL_PATTERN.test(text)) ||
    (quantitativeTarget === "emails" && DATA_QUERY_EMAIL_TIMELINE_IMPACT_PATTERN.test(text)) ||
    (quantitativeTarget === "exceptions_report" && DATA_QUERY_EXCEPTION_SEMANTIC_DETAIL_PATTERN.test(text)) ||
    (quantitativeTarget === "consultants_reports" && DATA_QUERY_CONSULTANT_SEMANTIC_DETAIL_PATTERN.test(text)) ||
    (
      quantitativeTarget === "safety_reports" &&
      DATA_QUERY_SAFETY_SEMANTIC_DEFECT_PATTERN.test(text) &&
      !exactSafetyDefectAggregate
    );
  const mixedSafetyQuestion = semantic &&
    explicitlyQuantitative &&
    quantitativeTarget === "safety_reports";
  const mixedAlertQuestion = semantic &&
    quantitativeTarget === "alerts" &&
    dataQueryAlertMixedExactSemantic(text, lookupCandidate);
  const mixedMeetingQuestion = semantic &&
    quantitativeTarget === "meetings" &&
    Boolean(lookupCandidate) &&
    DATA_QUERY_MEETING_MIXED_LATEST_DECISION_PATTERN.test(text);
  const mixedEmailQuestion = semantic &&
    quantitativeTarget === "emails" &&
    dataQueryEmailMixedExactSemantic(text, lookupCandidate);
  const mixedExceptionSameRecordQuestion = semantic &&
    quantitativeTarget === "exceptions_report" &&
    dataQueryExceptionMixedExactSemantic(text, lookupCandidate);
  const mixedExceptionApprovalQuestion = quantitativeTarget === "exceptions_report" &&
    dataQueryExceptionCountApprovalMixed(text);
  const mixedExceptionQuestion = mixedExceptionSameRecordQuestion || mixedExceptionApprovalQuestion;
  const mixedConsultantQuestion = semantic && quantitativeTarget === "consultants_reports" &&
    dataQueryConsultantMixedExactSemantic(text, lookupCandidate);

  if (!quantitativeTarget && /\b(?:how\s+many|count|number\s+of)\s+consultants?\b|^כמה\s+יועצים(?:\s+יש)?[?.!]*$/iu.test(text)) {
    return { supported: false, status: "not_computable", recognized: true, domain: "unsupported_question", intent: null, lookup: null, metricScope: null, reason: "The question asks about consultant people, not consultant-report rows; no approved personnel count exists.", warning: "consultant_people_count_not_computable", suggestedAgent: null };
  }

  const consultantReportQuestion = quantitativeTarget === "consultants_reports" || DATA_QUERY_CONSULTANT_REPORT_PATTERN.test(text) || analyzeHebrewConsultantReportIntent(text).intent === "consultant_report";
  if (consultantReportQuestion && DATA_QUERY_CONSULTANT_INGESTION_TIME_PATTERN.test(text)) {
    const ingestionMetricScope = metricScope?.targetTable === "consultants_reports" ? metricScope : dataQueryConsultantMetricScope(text);
    return { supported: false, status: "not_computable", domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics", intent: lookupCandidate ? "lookup" : "metrics", lookup: lookupCandidate, metricScope: lookupCandidate ? null : ingestionMetricScope, reason: "Consultant-report created_at and ingestion time are excluded; report_date is the only canonical business date.", warning: "consultant_ingestion_time_not_computable", suggestedAgent: null };
  }
  if (quantitativeTarget === "consultants_reports" && DATA_QUERY_CONSULTANT_SCOPE_FIELD_PATTERN.test(text)) {
    return { supported: false, status: "not_computable", domain: "content_metadata_metrics", intent: lookupCandidate ? "lookup" : "metrics", lookup: null, metricScope, reason: "Project, report, attachment, mail, and filename identifiers are internal and unavailable as exact filters or display values.", warning: "consultant_identity_field_not_queryable", suggestedAgent: null };
  }
  if (quantitativeTarget === "consultants_reports" && DATA_QUERY_CONSULTANT_IDENTITY_PATTERN.test(text)) {
    return { supported: false, status: "not_computable", domain: "content_metadata_metrics", intent: "metrics", lookup: null, metricScope, reason: "Consultant identity is excluded from exact grouping and filtering.", warning: "consultant_identity_grouping_not_computable", suggestedAgent: null };
  }
  if (quantitativeTarget === "consultants_reports" && DATA_QUERY_CONSULTANT_CATEGORY_PATTERN.test(text)) {
    return { supported: false, status: "not_computable", domain: "content_metadata_metrics", intent: "metrics", lookup: null, metricScope, reason: "Specialization and report topic are free text and require semantic interpretation.", warning: "consultant_category_not_computable", suggestedAgent: "consultants_reports" };
  }
  if (quantitativeTarget === "consultants_reports" && DATA_QUERY_CONSULTANT_IMPLEMENTATION_PATTERN.test(text)) {
    return { supported: false, status: "not_computable", domain: "content_metadata_metrics", intent: "metrics", lookup: null, metricScope, reason: "Implementation status is blank in the audited source and the stored item status does not prove approval, completion, or implementation.", warning: "consultant_implementation_status_not_computable", suggestedAgent: "consultants_reports" };
  }
  if (quantitativeTarget === "consultants_reports" && lookupCandidate?.unsupportedReason === "unapproved_consultant_lookup_qualifier" && !mixedConsultantQuestion) {
    return { supported: false, status: "not_computable", domain: "content_structured_lookup", intent: "lookup", lookup: null, metricScope, reason: "The consultant-report lookup contains a qualifier outside the approved metadata contract.", warning: "consultant_unapproved_lookup_not_computable", suggestedAgent: "consultants_reports" };
  }

  if (
    financialTypeAnalysis.ambiguous &&
    !semantic &&
    (explicitlyQuantitative || isDataQueryFinancialAllListIntent(question))
  ) {
    return {
      supported: false,
      status: "not_computable",
      recognized: true,
      domain: "content_metadata_metrics",
      intent: null,
      lookup: null,
      metricScope: null,
      reason: "The wording can describe either a financial transaction type or another project domain. Ask explicitly for the financial transaction type.",
      warning: "financial_transaction_type_requires_qualifier",
      suggestedAgent: null
    };
  }

  if (quantitativeTarget === "emails" && DATA_QUERY_EMAIL_INGESTION_TIME_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: lookupCandidate ? { ...lookupCandidate, targetTable: "emails", recordKind: "email" } : null,
      metricScope: lookupCandidate ? null : (metricScope || dataQueryEmailMetricScope(text)),
      reason: "Email creation or ingestion time is not the approved business date; received_date is the only exact email date.",
      warning: "email_ingestion_time_not_computable",
      suggestedAgent: null
    };
  }
  if (
    (quantitativeTarget === "emails" || /\bemails?\b|מייל(?:ים)?/iu.test(text)) &&
    DATA_QUERY_EMAIL_SCOPE_FIELD_PATTERN.test(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: lookupCandidate ? { ...lookupCandidate, targetTable: "emails", recordKind: "email" } : null,
      metricScope: lookupCandidate ? null : (metricScope || dataQueryEmailMetricScope(text)),
      reason: "Email, conversation, and project identifiers are internal execution fields, not user-queryable filters or display values.",
      warning: "email_scope_field_not_queryable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "emails" && explicitlyQuantitative && DATA_QUERY_EMAIL_PII_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Sender and recipient identities and addresses are excluded personal data and cannot be counted or filtered by Data Query.",
      warning: "email_pii_metric_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "emails" &&
    explicitlyQuantitative &&
    DATA_QUERY_EMAIL_ATTACHMENT_DETAIL_PATTERN.test(text) &&
    !DATA_QUERY_EMAIL_ATTACHMENT_FLAG_METRIC_PATTERN.test(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Data Query may count email rows by the stored attachment-existence flag, but attachment rows, filenames, document counts, and links are outside the approved contract.",
      warning: "email_attachment_documents_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "emails" && metricScope?.notComputableReason === "email_multidimensional_timeseries_not_computable") {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Email time series may use one day or month dimension only; splitting the series by another field is outside the approved contract.",
      warning: "email_multidimensional_timeseries_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "emails" && metricScope?.notComputableReason === "email_no_clear_scope_count_only") {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Emails with no clear project association support an explicit count only; grouping, lookup, and content interpretation remain outside this exact contract.",
      warning: "email_no_clear_scope_count_only",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "emails" && explicitlyQuantitative && DATA_QUERY_EMAIL_SPAM_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The relevance_status field does not establish whether an email is spam. no_clear_project cannot be interpreted as spam or junk mail.",
      warning: "email_spam_not_equivalent_to_relevance",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "exceptions_report" && DATA_QUERY_EXCEPTION_INGESTION_TIME_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: lookupCandidate ? { ...lookupCandidate, targetTable: "exceptions_report", recordKind: "exception_report" } : null,
      metricScope: lookupCandidate ? null : metricScope,
      reason: "Exception created_at and ingestion time are excluded; exception_date is the only canonical business date.",
      warning: "exception_ingestion_time_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "exceptions_report" && DATA_QUERY_EXCEPTION_SCOPE_FIELD_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: lookupCandidate ? { ...lookupCandidate, targetTable: "exceptions_report", recordKind: "exception_report" } : null,
      metricScope: lookupCandidate ? null : metricScope,
      reason: "Exception, project, attachment, mail, and exception-number identifiers are internal or non-unique and are unavailable as exact filters or display values.",
      warning: "exception_identity_field_not_queryable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "exceptions_report" && explicitlyQuantitative && DATA_QUERY_EXCEPTION_EXECUTION_DAYS_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Execution-time metrics are not computable because execution_days is populated in only one audited row and is otherwise missing.",
      warning: "exception_execution_days_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "exceptions_report" && explicitlyQuantitative && DATA_QUERY_EXCEPTION_IDENTITY_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Inspector and manager fields are personal data, and company groupings are identifying in this small dataset; they are excluded from Data Query.",
      warning: "exception_identity_grouping_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "exceptions_report" && explicitlyQuantitative && DATA_QUERY_EXCEPTION_CATEGORY_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The source has no approved stored exception-category field; subjects and hashtags require semantic interpretation.",
      warning: "exception_category_not_computable",
      suggestedAgent: "hybrid_search"
    };
  }
  if (
    quantitativeTarget === "exceptions_report" &&
    explicitlyQuantitative &&
    DATA_QUERY_EXCEPTION_LIFECYCLE_PATTERN.test(text) &&
    !mixedExceptionApprovalQuestion
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The audited item_status is an opaque stored processing label and does not prove approval, rejection, open, closed, resolved, or completed lifecycle state.",
      warning: "exception_lifecycle_status_not_computable",
      suggestedAgent: "hybrid_search"
    };
  }
  if (quantitativeTarget === "exceptions_report" && metricScope?.notComputableReason) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The exception request is ambiguous, negative, or combines unsupported dimensions and cannot be normalized safely.",
      warning: metricScope.notComputableReason,
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "exceptions_report" &&
    lookupCandidate?.unsupportedReason === "unapproved_exception_lookup_qualifier" &&
    !mixedExceptionQuestion
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_structured_lookup",
      intent: "lookup",
      lookup: null,
      metricScope,
      reason: "The exception lookup contains a content, identity, company, amount, or lifecycle qualifier outside the approved metadata contract.",
      warning: "exception_unapproved_lookup_not_computable",
      suggestedAgent: "hybrid_search"
    };
  }
  if (
    quantitativeTarget === "emails" &&
    lookupCandidate?.unsupportedReason === "unapproved_email_lookup_qualifier"
  ) {
    return {
      supported: false,
      domain: "semantic_or_citation",
      intent: null,
      lookup: null,
      metricScope: null,
      reason: "The email request includes content or identity qualifiers outside the exact metadata contract and must use retrieval.",
      warning: "email_unapproved_lookup_route_elsewhere",
      suggestedAgent: "emails"
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    metricScope?.requiredFilters?.some((filter) =>
      filter.field === "data_date" && filter.op === "is" && filter.value === null
    ) &&
    (metricScope.operation === "timeseries" || Boolean(metricScope.dateScopeRequirement))
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Undated alerts cannot be assigned to a data_date period. A null-date filter cannot be combined with a date scope or time series.",
      warning: "alert_undated_temporal_conflict_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "meetings" && DATA_QUERY_MEETING_ATTENDANCE_METRIC_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Meeting attendee and participant metrics require excluded personal-content interpretation and are not computable from the approved meeting metadata.",
      warning: "meeting_attendance_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "meetings" && DATA_QUERY_MEETING_DECISION_METRIC_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Meeting decision presence and decision counts require semantic interpretation of excluded meeting content.",
      warning: "meeting_decision_presence_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "meetings" && DATA_QUERY_MEETING_INGESTION_TIME_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: null,
      metricScope,
      reason: "Meeting created_at and ingestion time are excluded and may not replace the canonical meeting_date business time.",
      warning: "meeting_ingestion_time_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "meetings" && DATA_QUERY_MEETING_SCOPE_FIELD_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: null,
      metricScope,
      reason: "Meeting, project, attachment, mail, and filename identifiers are internal execution fields, not user-queryable filters or display values.",
      warning: "meeting_scope_field_not_queryable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_INGESTION_TIME_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: null,
      metricScope,
      reason: "Alert created_at and ingestion time are excluded and may not replace the canonical data_date business time.",
      warning: "alert_ingestion_time_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_AMBIGUOUS_QUALIFIER_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: null,
      metricScope,
      reason: "The alert qualifier is ambiguous. Ask explicitly for safety-event alert type or safety-report attachment input type.",
      warning: "alert_ambiguous_qualifier_requires_clarification",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_SCOPE_FIELD_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: lookupCandidate ? "content_structured_lookup" : "content_metadata_metrics",
      intent: lookupCandidate ? "lookup" : "metrics",
      lookup: null,
      metricScope,
      reason: "Alert and project identifiers are internal execution fields, not user-queryable filters or display values.",
      warning: "alert_scope_field_not_queryable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    DATA_QUERY_ALERT_DATED_COUNT_PATTERN.test(text) &&
    !DATA_QUERY_ALERT_UNDATED_PATTERN.test(text) &&
    !lookupCandidate
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "A non-null dated-alert count is not an approved direct filter. Use an explicit date range or request undated completeness accounting.",
      warning: "alert_dated_filter_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    DATA_QUERY_ALERT_EXCLUDED_STATUS_PATTERN.test(text) &&
    !dataQueryAlertStoredStatusIntent(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The excluded alert status field is empty in the audited source and cannot be used for presence or lifecycle metrics.",
      warning: "alert_excluded_status_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    lookupCandidate?.unsupportedReason === "unapproved_alert_lookup_qualifier" &&
    !DATA_QUERY_ALERT_SOURCE_LINK_PATTERN.test(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_structured_lookup",
      intent: "lookup",
      lookup: null,
      metricScope,
      reason: "The alert lookup contains a qualifier that is not part of the approved typed filter vocabulary.",
      warning: "alert_unapproved_lookup_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    lookupCandidate?.unsupportedReason === "alert_grouped_lookup_not_supported"
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_structured_lookup",
      intent: "lookup",
      lookup: null,
      metricScope,
      reason: "Latest or earliest alert per group is outside the approved bounded lookup contract.",
      warning: "alert_grouped_lookup_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    metricScope?.notComputableReason === "alert_multidimensional_timeseries_not_computable"
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Alert time series may use one day or month dimension only; splitting the series by another field is outside the approved contract.",
      warning: "alert_multidimensional_timeseries_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "safety_reports" &&
    explicitlyQuantitative &&
    DATA_QUERY_SAFETY_WORKER_AGGREGATE_PATTERN.test(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Worker counts are per-report snapshots and are not semantically additive across safety reports.",
      warning: "safety_worker_aggregate_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "safety_reports" &&
    explicitlyQuantitative &&
    DATA_QUERY_SAFETY_RESOLUTION_PATTERN.test(text) &&
    !mixedSafetyQuestion
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The approved safety-report fields do not define a trustworthy report-level resolved or unresolved status.",
      warning: "safety_resolution_status_not_computable",
      suggestedAgent: "safety_report"
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    (
      DATA_QUERY_ALERT_SEMANTIC_SEVERITY_PATTERN.test(text) ||
      DATA_QUERY_ALERT_UNAPPROVED_STORED_SEVERITY_PATTERN.test(text) ||
      DATA_QUERY_ALERT_SEVERITY_ARITHMETIC_PATTERN.test(text)
    )
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Stored alert severity level 3 has no audited critical, high, medium, low, urgency, highest, or lowest meaning.",
      warning: "alert_semantic_severity_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    (
      DATA_QUERY_ALERT_LIFECYCLE_PATTERN.test(text) ||
      (DATA_QUERY_ALERT_UNVERIFIED_STATUS_PATTERN.test(text) && !dataQueryAlertStoredStatusIntent(text))
    )
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The approved alert fields do not define a trustworthy open, closed, resolved, active, acknowledged, or escalated lifecycle status.",
      warning: "alert_lifecycle_status_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_UNIQUE_SOURCE_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Unique source records are not computable because stored alert source identifiers have no approved identity or relationship contract.",
      warning: "alert_unique_sources_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_DISTINCT_VALUE_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Distinct alert vocabulary cardinalities are outside the approved alert operation contract; request a full approved one-field breakdown instead.",
      warning: "alert_distinct_values_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_UNSUPPORTED_GRANULARITY_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Alert time series are approved only by calendar day or calendar month; the requested granularity is outside the typed contract.",
      warning: "alert_time_granularity_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_NUMERIC_AGGREGATE_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Alert averages, sums, minima, maxima, rankings, and top-N analytics are outside the approved typed contract.",
      warning: "alert_numeric_aggregate_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "alerts" && DATA_QUERY_ALERT_SOURCE_LINK_PATTERN.test(text)) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_structured_lookup",
      intent: "lookup",
      lookup: null,
      metricScope,
      reason: "Verified alert source links are unavailable because the exact alert contract has no authorization-bound source resolver.",
      warning: "alert_source_links_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "meetings" &&
    quantitative &&
    ["count", "group_count", "distinct", "timeseries"].includes(metricScope?.operation) &&
    !mixedMeetingQuestion &&
    !dataQueryMeetingMetricGrammar(text, metricScope)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The request does not match the approved positive grammar for meeting metadata and may contain an unsupported qualifier, lifecycle meaning, or counted entity.",
      warning: "meeting_unapproved_metric_not_computable",
      suggestedAgent: null
    };
  }
  if (semantic && !mixedSafetyQuestion && !mixedAlertQuestion && !mixedMeetingQuestion && !mixedEmailQuestion && !mixedExceptionQuestion && !mixedConsultantQuestion) {
    const suggestedAgent = /עיכוב|תביעה|אחריות|delay|claim|responsib|root cause|גורם שורש/i.test(text)
      ? "delay_claim"
      : /פגישה|ישיבה|meeting|minutes|quote|ציטוט/i.test(text)
        ? "meeting_evidence"
        : quantitativeTarget === "safety_reports"
          ? "safety_report"
          : quantitativeTarget === "alerts" || DATA_QUERY_ALERT_SEMANTIC_DETAIL_PATTERN.test(text)
            ? "alert"
          : quantitativeTarget === "emails" || DATA_QUERY_EMAIL_SEMANTIC_DETAIL_PATTERN.test(text)
            ? "emails"
          : quantitativeTarget === "exceptions_report" || DATA_QUERY_EXCEPTION_SEMANTIC_DETAIL_PATTERN.test(text)
            ? "hybrid_search"
          : quantitativeTarget === "consultants_reports" || DATA_QUERY_CONSULTANT_SEMANTIC_DETAIL_PATTERN.test(text)
            ? "consultants_reports"
          : "hybrid_search";
    return {
      supported: false,
      domain: "semantic_or_citation",
      intent: null,
      lookup: null,
      metricScope: null,
      reason: "Data Query supports structured metadata metrics, not semantic interpretation or citation retrieval.",
      warning: "semantic_question_route_elsewhere",
      suggestedAgent
    };
  }
  if (
    quantitativeTarget === "meetings" &&
    lookupCandidate?.unsupportedReason === "unapproved_meeting_lookup_qualifier" &&
    !mixedMeetingQuestion
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_structured_lookup",
      intent: "lookup",
      lookup: null,
      metricScope,
      reason: "The meeting lookup contains a qualifier that is not part of the approved typed metadata vocabulary.",
      warning: "meeting_unapproved_lookup_not_computable",
      suggestedAgent: "meeting_evidence"
    };
  }
  if (
    quantitativeTarget === "alerts" &&
    explicitlyQuantitative &&
    ["count", "group_count", "timeseries"].includes(metricScope?.operation) &&
    !mixedAlertQuestion &&
    !dataQueryAlertMetricGrammar(text, metricScope)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The request does not match the approved positive grammar for counting alert rows and may contain an unsupported qualifier or counted entity.",
      warning: "alert_unapproved_metric_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "emails" &&
    quantitative &&
    ["count", "group_count", "distinct", "timeseries"].includes(metricScope?.operation) &&
    !mixedEmailQuestion &&
    !dataQueryEmailMetricGrammar(text, metricScope)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The request does not match the approved positive grammar for project-related email metadata and may contain an unsupported qualifier or counted entity.",
      warning: "email_unapproved_metric_not_computable",
      suggestedAgent: null
    };
  }
  if (
    quantitativeTarget === "exceptions_report" &&
    quantitative &&
    ["count", "group_count", "timeseries"].includes(metricScope?.operation) &&
    !mixedExceptionQuestion &&
    !dataQueryExceptionMetricGrammar(text, metricScope)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "The request does not match the approved positive grammar for exception metadata and may include an unsupported adjacent meaning or qualifier.",
      warning: "exception_unapproved_metric_not_computable",
      suggestedAgent: null
    };
  }
  if (quantitativeTarget === "consultants_reports" && quantitative && ["count", "group_count", "timeseries"].includes(metricScope?.operation) && !mixedConsultantQuestion && !dataQueryConsultantMetricGrammar(text, metricScope)) {
    return { supported: false, status: "not_computable", domain: "content_metadata_metrics", intent: "metrics", lookup: null, metricScope, reason: "The request does not match the approved positive grammar for consultant-report metadata.", warning: "consultant_unapproved_metric_not_computable", suggestedAgent: null };
  }
  if (
    dataQueryLookupTargetTable(text) === "financial_transactions" &&
    /\b(?:amount|sum|average|avg|money|value)\b|סכום|ממוצע/iu.test(text)
  ) {
    return {
      supported: false,
      status: "not_computable",
      domain: "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      reason: "Financial amount metrics are not computable because the approved numeric amount fields are unpopulated.",
      warning: "financial_amount_not_computable",
      suggestedAgent: null
    };
  }
  if (
    DATA_QUERY_BET_PREFIXED_INVOICE_REFERENCE_PATTERN.test(text) &&
    !DATA_QUERY_BET_PREFIXED_LATEST_INVOICE_PATTERN.test(text)
  ) {
    return {
      supported: false,
      domain: "unsupported_question",
      intent: null,
      lookup: null,
      metricScope,
      reason: "This invoice-content wording is not an approved structured metric or bounded lookup.",
      warning: "non_quantitative_question_route_elsewhere",
      suggestedAgent: "hybrid_search"
    };
  }
  const lookup = lookupCandidate;
  if (lookup) {
    const suggestedAgent = dataQueryLookupSuggestedAgent(lookup.targetTable);
    if (!lookup.targetTable) {
      return {
        supported: false,
        ...(["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(lookup.targetTable) ? { status: "not_computable" } : {}),
        recognized: true,
        domain: "content_structured_lookup",
        intent: "lookup",
        lookup,
        reason: "The lookup target is ambiguous and does not map to one approved table contract.",
        warning: "ambiguous_lookup_target",
        suggestedAgent: ["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(lookup.targetTable) ? null : suggestedAgent
      };
    }
    const effectiveMaxRows = dataQueryLookupMaxRows(settings, lookup, lookupMaxRows);
    if (
      lookup.unsupportedReason ||
      !Number.isInteger(lookup.limit) ||
      lookup.limit < 1 ||
      lookup.limit > effectiveMaxRows
    ) {
      return {
        supported: false,
        ...(["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(lookup.targetTable) ? { status: "not_computable" } : {}),
        recognized: true,
        domain: "content_structured_lookup",
        intent: "lookup",
        lookup,
        reason: `The requested lookup cardinality is unsupported; use a latest/earliest record or 1-${effectiveMaxRows} latest records.`,
        warning: "invalid_lookup_limit",
        suggestedAgent: ["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(lookup.targetTable) ? null : suggestedAgent
      };
    }
    const available = settings
      ? dataQueryLookupAvailable(settings, lookup)
      : lookupAvailable === true;
    if (!available) {
      return {
        supported: false,
        recognized: true,
        domain: "content_structured_lookup",
        intent: "lookup",
        lookup,
        reason: `The ${lookup.targetTable} lookup is recognized, but no approved typed lookup contract is enabled for it.`,
        warning: "structured_lookup_not_available",
        suggestedAgent
      };
    }
    return {
      supported: true,
      recognized: true,
      domain: (mixedAlertQuestion || mixedMeetingQuestion || mixedEmailQuestion || mixedExceptionQuestion || mixedConsultantQuestion) ? "content_mixed_exact_semantic" : "content_structured_lookup",
      intent: "lookup",
      lookup,
      mixed: mixedAlertQuestion || mixedMeetingQuestion || mixedEmailQuestion || mixedExceptionQuestion || mixedConsultantQuestion,
      reason: mixedAlertQuestion
        ? "The request combines an approved exact alert lookup with semantic alert evidence."
        : mixedMeetingQuestion
          ? "The request combines an approved exact meeting lookup with semantic evidence from that same meeting."
        : mixedEmailQuestion
          ? "The request combines approved project-related email metadata with semantic email retrieval."
        : mixedExceptionQuestion
          ? "The request combines an exact exception lookup with semantic evidence from the same attested exception record."
        : "The request is a deterministic structured record lookup over approved Content metadata.",
      warning: null,
      suggestedAgent: null
    };
  }
  if (quantitative && quantitativeTarget && settings) {
    const targetTable = (Array.isArray(settings.manifest) ? settings.manifest : [])
      .find((table) => table.schemaAlias === "content" && table.tableName === quantitativeTarget);
    const hasExactMetrics = Boolean(
      dataQueryExactAvailable(targetTable) &&
      targetTable.exactOperations?.some((operation) => DATA_QUERY_EXACT_OPERATIONS.has(operation))
    );
    if (!hasExactMetrics) {
      return {
        supported: false,
        status: "not_computable",
        recognized: true,
        domain: "content_metadata_metrics",
        intent: "metrics",
        lookup: null,
        metricScope,
        reason: `The ${quantitativeTarget} metrics request is recognized, but no approved typed exact analytics contract is enabled for it.`,
        warning: "structured_metrics_not_available",
        suggestedAgent: dataQueryLookupSuggestedAgent(quantitativeTarget)
      };
    }
  }
  if (quantitative) {
    const mixed = mixedSafetyQuestion || mixedAlertQuestion || mixedMeetingQuestion || mixedEmailQuestion || mixedExceptionQuestion;
    return {
      supported: true,
      domain: mixed ? "content_mixed_exact_semantic" : "content_metadata_metrics",
      intent: "metrics",
      lookup: null,
      metricScope,
      mixed,
      mixedKind: mixedExceptionApprovalQuestion
        ? "exception_count_approval_evidence"
        : mixedExceptionSameRecordQuestion
          ? "exception_latest_same_record_evidence"
          : null,
      reason: mixedSafetyQuestion
        ? "The request combines an approved exact safety metric with semantic defect evidence."
        : mixedAlertQuestion
          ? "The request combines an approved exact alert metric with semantic alert evidence."
        : mixedMeetingQuestion
          ? "The request combines an approved exact meeting lookup with semantic evidence from that same meeting."
        : mixedEmailQuestion
          ? "The request combines an approved exact project-related email metric with semantic email retrieval."
        : mixedExceptionQuestion
          ? "The request combines approved exception metadata with semantic evidence."
        : "The request is a structured quantitative question over approved Content metadata.",
      warning: null,
      warnings: mixedSafetyQuestion && DATA_QUERY_SAFETY_RESOLUTION_PATTERN.test(text)
        ? ["safety_resolution_status_not_computable"]
        : [],
      suggestedAgent: null
    };
  }
  return {
    supported: false,
    domain: "unsupported_question",
    intent: null,
      lookup: null,
      metricScope,
    reason: "The request does not identify a supported quantitative metric.",
    warning: "non_quantitative_question_route_elsewhere",
    suggestedAgent: "hybrid_search"
  };
}

export function parseDataQueryMetricScope(question) {
  const financialTypeAnalysis = analyzeDataQueryFinancialTransactionType(question);
  const text = normalizeDataQueryHebrewQuestion(question);
  const financialType = DATA_QUERY_FINANCIAL_DOCUMENT_PATTERN.test(text)
    ? null
    : financialTypeAnalysis.match;
  const targetTable = dataQueryLookupTargetTable(text, financialType);
  if (targetTable === "safety_reports") {
    return dataQuerySafetyMetricScope(text);
  }
  if (targetTable === "alerts") {
    return dataQueryAlertMetricScope(text);
  }
  if (targetTable === "meetings") {
    return dataQueryMeetingMetricScope(text);
  }
  if (targetTable === "emails") {
    return dataQueryEmailMetricScope(text);
  }
  if (targetTable === "exceptions_report") {
    return dataQueryExceptionMetricScope(text);
  }
  if (targetTable === "consultants_reports") {
    return dataQueryConsultantMetricScope(text);
  }
  const recordKind = targetTable === "financial_transactions"
    ? dataQueryFinancialRecordKind(text, financialType)
    : null;
  const financialTypeFilter = dataQueryFinancialTransactionTypeFilter(financialType);
  return targetTable
    ? {
        targetTable,
        recordKind,
        financialType,
        requiredFilters: financialTypeFilter
          ? [financialTypeFilter]
          : [],
        forbiddenFilterFields: recordKind === "financial_document"
          ? ["transaction_type"]
          : []
      }
    : null;
}

function dataQueryMeetingMetricScope(text) {
  const groupField = /\b(?:break\s+down|breakdown|distribution)\b.{0,30}\bmeetings?\b.{0,20}\bby\s+(?:stored\s+)?status\b|\bmeetings?\s+by\s+(?:stored\s+)?status\b|\bby\s+(?:stored\s+)?meeting\s+status\b|(?:פלח|פילוח).{0,30}ישיב(?:ה|ות).{0,20}לפי\s+(?:ה)?סטטוס\s+(?:ה)?שמור|ישיב(?:ה|ות)\s+לפי\s+(?:ה)?סטטוס\s+(?:ה)?שמור/iu.test(text)
    ? "status"
    : null;
  const distinctStatus = /\b(?:how\s+many\s+)?(?:unique|distinct)\s+(?:stored\s+)?(?:meeting\s+)?statuses\b|כמה.{0,25}סטטוס(?:ים)?\s+(?:שמור(?:ים)?\s+)?(?:ייחודיים|שונים)|(?:הצג|רשום).{0,15}סטטוס(?:ים)?.{0,20}(?:ייחודיים|שונים).{0,20}(?:של\s+)?(?:ה)?ישיב(?:ה|ות)/iu.test(text);
  const wantsTimeSeries = /\btime\s*series\b|\btrend\b|\bover\s+time\b|\bby\s+date\b|\b(?:by|per)\s+(?:day|month)\b|\b(?:daily|monthly)\s+(?:meetings?|breakdown|counts?|distribution)\b|מגמה|לאורך\s+זמן|לפי\s+תאריך|לפי\s+יום|לפי\s+חודש/iu.test(text);
  const status = dataQueryMeetingStatusIntent(text);
  const operation = distinctStatus
    ? "distinct"
    : wantsTimeSeries
      ? "timeseries"
      : groupField
        ? "group_count"
        : "count";
  return {
    targetTable: "meetings",
    recordKind: "meeting",
    operation,
    groupField: operation === "group_count" ? groupField : null,
    distinctField: operation === "distinct" ? "status" : null,
    granularity: operation === "timeseries" && /\bmonth(?:ly)?\b|חודש/iu.test(text) ? "month" : "day",
    metrics: [],
    requiredFilters: status ? [{ field: "status", op: "eq", value: status }] : [],
    dateScopeRequirement: dataQueryAlertDateScopeRequirement(text),
    forbiddenFilterFields: [
      "created_at",
      "subject",
      "item_status",
      "decisions_made",
      "attendances",
      "attachment_id",
      "mail_id",
      "document_filename"
    ],
    notComputableReason: null
  };
}

function dataQueryMeetingStatusIntent(text) {
  const normalized = String(text || "");
  const matches = DATA_QUERY_MEETING_STATUS_VALUES.filter((value) => normalized.includes(value));
  return matches.length === 1 ? matches[0] : null;
}

function dataQueryMeetingMetricGrammar(text, metricScope = null) {
  const normalized = String(text || "")
    .trim()
    .replace(/^(?:please\s+)?/iu, "")
    .replace(/[?.!,;]+$/u, "")
    .trim();
  if (DATA_QUERY_MEETING_UNAPPROVED_QUALIFIER_PATTERN.test(normalized)) return false;
  if (metricScope?.operation === "group_count") {
    return /^(?:break\s+down|show\s+(?:the\s+)?(?:breakdown|distribution|counts?)\s+of)\s+(?:the\s+)?meetings?\s+by\s+(?:the\s+)?(?:stored\s+)?(?:meeting\s+)?status$|^(?:show\s+)?(?:the\s+)?meetings?\s+(?:breakdown|distribution)\s+by\s+(?:the\s+)?(?:stored\s+)?(?:meeting\s+)?status$|^meetings?\s+by\s+(?:stored\s+)?status$|^(?:פלח|פילוח|התפלגות)\s+(?:את\s+)?(?:ה)?ישיב(?:ה|ות)\s+לפי\s+(?:ה)?סטטוס(?:\s+(?:ה)?שמור)?$/iu.test(normalized);
  }
  if (metricScope?.operation === "distinct") {
    return /^(?:how\s+many\s+)?(?:unique|distinct)\s+(?:stored\s+)?(?:meeting\s+)?statuses(?:\s+are\s+there)?$|^(?:show|list)(?:\s+the)?\s+(?:unique|distinct)\s+(?:stored\s+)?(?:meeting\s+)?statuses$|^כמה\s+סטטוס(?:ים)?(?:\s+של\s+ישיבות)?(?:\s+שמור(?:ים)?)?\s+(?:ייחודיים|שונים)(?:\s+יש)?$|^(?:הצג|רשום)\s+(?:את\s+)?(?:ה)?סטטוס(?:ים)?\s+(?:ה)?שמור(?:ים)?\s+(?:ה)?(?:ייחודיים|שונים)\s+של\s+(?:ה)?ישיב(?:ה|ות)$/iu.test(normalized);
  }
  if (metricScope?.operation === "timeseries") {
    return /^(?:show\s+)?(?:the\s+)?(?:daily|monthly)\s+meetings?\s+(?:counts?|breakdown|distribution|trend)$|^(?:show\s+)?(?:the\s+)?meetings?\s+(?:trend|time\s*series|over\s+time|by\s+date)$|^break\s+down\s+meetings?\s+by\s+(?:day|month|date)$|^how\s+many\s+meetings?\s+(?:per|by)\s+(?:day|month)$|^(?:הצג\s+)?(?:מגמה|סדרת\s+זמן|פילוח)\s+(?:של\s+)?(?:ה)?ישיב(?:ה|ות)(?:\s+לפי\s+(?:יום|חודש|תאריך))?$|^כמה\s+ישיב(?:ה|ות)\s+לפי\s+(?:יום|חודש)$/iu.test(normalized);
  }
  if (metricScope?.requiredFilters?.length) {
    const statusValues = DATA_QUERY_MEETING_STATUS_VALUES.join("|");
    return new RegExp(
      `^(?:(?:how\\s+many|count|number\\s+of)\\s+(?:the\\s+)?meetings?)(?:\\s+(?:have|with|in))?\\s+(?:the\\s+)?(?:stored\\s+)?(?:meeting\\s+)?status(?:\\s+(?:is|equals?))?\\s+(?:${statusValues})$|^כמה\\s+ישיב(?:ה|ות)(?:\\s+יש)?\\s+(?:עם|ב)?\\s*(?:ה)?סטטוס(?:\\s+(?:ה)?שמור)?\\s+(?:${statusValues})(?:\\s+יש)?$`,
      "iu"
    ).test(normalized);
  }
  const month = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";
  const dateAtom = `(?:${month}(?:\\s+\\d{4})?|\\d{4}(?:-\\d{2}(?:-\\d{2})?)?|today|yesterday|this\\s+(?:day|week|month|year)|last\\s+(?:day|week|month|year))`;
  const dateTail = `(?:\\s+(?:(?:in|during|on|since|after|before)\\s+${dateAtom}|between\\s+${dateAtom}\\s+(?:and|to)\\s+${dateAtom}|from\\s+${dateAtom}\\s+to\\s+${dateAtom}))?`;
  const english = new RegExp(
    `^(?:how\\s+many\\s+meetings?(?:\\s+(?:are\\s+there|were\\s+held|took\\s+place))?|(?:count|number\\s+of|total\\s+number\\s+of)\\s+(?:the\\s+)?meetings?)${dateTail}$`,
    "iu"
  );
  const hebrew = /^(?:כמה\s+ישיב(?:ה|ות)(?:\s+(?:יש|היו|התקיימו))?|מה\s+מספר\s+(?:ה)?ישיב(?:ה|ות))(?:\s+(?:(?:במהלך|מאז|אחרי|לפני)\s+(?:\d{4}|\d{4}-\d{2}(?:-\d{2})?)|בין\s+(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(?:ל|עד)\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})))?$/iu;
  return english.test(normalized) || hebrew.test(normalized);
}

function dataQueryEmailMetricScope(text) {
  const groupField = dataQueryEmailGroupField(text);
  const distinctCategories = /\b(?:show|list|what\s+are|how\s+many)\b.{0,25}\b(?:unique|distinct)\b.{0,20}\bemail\s+categories\b|\b(?:unique|distinct)\s+email\s+categories\b|(?:הצג|רשום|כמה).{0,25}(?:קטגוריות).{0,20}(?:ייחודיות|שונות)/iu.test(text);
  const wantsTimeSeries = /\btime\s*series\b|\btrend\b|\bover\s+time\b|\bby\s+date\b|\b(?:by|per)\s+(?:day|month)\b|\b(?:daily|monthly)\s+(?:emails?|breakdown|counts?|distribution)\b|מגמה|לאורך\s+זמן|לפי\s+תאריך|לפי\s+יום|לפי\s+חודש/iu.test(text);
  const category = dataQueryEmailCategoryIntent(text);
  const direction = /\b(?:inbound|incoming|received)\s+emails?\b|מייל(?:ים)?\s+(?:נכנס|נכנסים|שהתקבלו)/iu.test(text)
    ? "inbound"
    : /\b(?:outbound|outgoing|sent)\s+emails?\b|מייל(?:ים)?\s+(?:יוצא|יוצאים|שנשלחו)/iu.test(text)
      ? "outbound"
      : null;
  const attachmentState = /\bemails?\s+with\s+attachments?\b|מייל(?:ים)?\s+(?:עם|הכוללים)\s+(?:קובץ|קבצים|מצורף|מצורפים)/iu.test(text)
    ? true
    : /\bemails?\s+without\s+attachments?\b|מייל(?:ים)?\s+(?:ללא|בלי)\s+(?:קובץ|קבצים|מצורף|מצורפים)/iu.test(text)
      ? false
      : null;
  const storedStatus = /\b(?:being[-\s]?handled|stored\s+item\s+status\s+being[-\s]?handled)\b|בטיפול/iu.test(text)
      ? DATA_QUERY_EMAIL_ITEM_STATUS
      : null;
  const relevanceScope = dataQueryEmailRelevanceScope(text);
  const operation = distinctCategories
    ? "distinct"
    : wantsTimeSeries
      ? "timeseries"
      : groupField
        ? "group_count"
        : "count";
  return {
    targetTable: "emails",
    recordKind: "email",
    operation,
    groupField: operation === "group_count" ? groupField : null,
    distinctField: operation === "distinct" ? "mail_category" : null,
    granularity: operation === "timeseries" && /\bmonth(?:ly)?\b|חודש/iu.test(text) ? "month" : "day",
    metrics: [],
    requiredFilters: [
      relevanceScope === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE
        ? { field: "relevance_status", op: "eq", value: DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE }
        : { field: "relevance_status", op: "in", value: DATA_QUERY_EMAIL_RELEVANCE_VALUES },
      ...(category ? [{ field: "mail_category", op: "eq", value: category }] : []),
      ...(direction ? [{ field: "direction", op: "eq", value: direction }] : []),
      ...(attachmentState !== null ? [{ field: "has_attachments", op: "eq", value: attachmentState }] : []),
      ...(storedStatus ? [{ field: "item_status", op: "eq", value: storedStatus }] : [])
    ],
    dateScopeRequirement: dataQueryAlertDateScopeRequirement(text),
    forbiddenFilterFields: [
      "created_at",
      "project_id",
      "mail_id",
      "conversationid",
      "sender_name",
      "sender_mail",
      "other_recipients",
      "subject",
      "summary",
      "mail_summarize",
      "mail_body",
      "content",
      "hashtags",
      "metadata",
      "embedding"
    ],
    notComputableReason: relevanceScope === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE && (
      operation !== "count" || category || direction || attachmentState !== null || storedStatus
    )
      ? "email_no_clear_scope_count_only"
      : wantsTimeSeries && groupField
        ? "email_multidimensional_timeseries_not_computable"
        : null
  };
}

function dataQueryEmailRelevanceScope(text) {
  const normalized = String(text || "");
  const hebrewIntent = analyzeHebrewEmailRelevance(normalized).intent;
  if (
    /\b(?:non[-\s]?relevant|irrelevant|not\s+relevant)\s+emails?\b|\bemails?\b.{0,35}\b(?:not\s+(?:clearly\s+)?related\s+to|not\s+associated\s+with|without\s+a\s+clear|(?:have|with)\s+(?:unknown|unclear))\b.{0,25}\bproject\b|\bno[-\s]?clear[-\s]?project\b/iu.test(normalized) ||
    hebrewIntent === "no_clear_project"
  ) return DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE;
  return "project_related_scope";
}

function dataQueryEmailGroupField(text) {
  if (/\bby\s+(?:email\s+)?categor(?:y|ies)\b|\bemail\s+category\s+(?:breakdown|distribution)\b|לפי\s+קטגור(?:יה|יות)|פילוח.{0,20}קטגור/iu.test(text)) return "mail_category";
  if (/\bby\s+(?:email\s+)?direction\b|\b(?:inbound|outbound)\s+distribution\b|לפי\s+כיוון|פילוח.{0,20}(?:נכנס|יוצא)/iu.test(text)) return "direction";
  if (/\bby\s+attachment\s+(?:state|status|presence)\b|\bwith\s+vs\.?\s+without\s+attachments\b|לפי\s+(?:מצב\s+)?(?:קבצים\s+)?מצורפים|עם\s+וללא\s+מצורפים/iu.test(text)) return "has_attachments";
  if (/\bby\s+(?:stored\s+)?(?:item\s+)?status\b|לפי\s+סטטוס\s+(?:פריט\s+)?שמור/iu.test(text)) return "item_status";
  if (/\bby\s+(?:stored\s+)?relevance(?:\s+status)?\b|לפי\s+(?:סטטוס\s+)?רלוונטיות/iu.test(text)) return "relevance_status";
  return null;
}

function dataQueryEmailCategoryIntent(text) {
  const rawMatches = DATA_QUERY_EMAIL_CATEGORY_VALUES.filter((value) => String(text || "").includes(value));
  if (rawMatches.length === 1) return rawMatches[0];
  const aliases = [
    ["אישורים והיתרים", /\b(?:approval|permit)s?\s+emails?\b/iu],
    ["חוזים והתקשרויות", /\b(?:contract|engagement)s?\s+emails?\b/iu],
    ["כספים וחשבונאות", /\b(?:finance|financial|accounting)\s+emails?\b/iu],
    ["לוחות זמנים", /\b(?:schedule|timeline)\s+emails?\b/iu],
    ["מיילים לניתוח או חיזוי", /\b(?:analysis|forecast(?:ing)?)\s+emails?\b/iu],
    ["תיעוד והחלטות", /\b(?:documentation|decision)s?\s+emails?\b/iu],
    ["תקשורת כללית", /\bgeneral\s+communication\s+emails?\b/iu]
  ].filter(([, pattern]) => pattern.test(text));
  return aliases.length === 1 ? aliases[0][0] : null;
}

function dataQueryEmailMetricGrammar(text, metricScope = null) {
  const normalized = String(text || "")
    .trim()
    .replace(/^(?:please\s+)?/iu, "")
    .replace(/[?.!,;]+$/u, "")
    .trim();
  const hebrewMetric = normalizeHebrewEmailMetricQuestion(normalized);
  const grammarText = hebrewMetric.grammarText
    .replace(/\b(?:relevant|project[-\s]?related)\s+emails?\b/iu, "emails")
    .replace(/\bemails?\s+(?:(?:related|relevant)\s+to|for)\s+the\s+project\b/iu, "emails")
    .replace(/\bemails?\s+(?:that\s+)?belong(?:s|ing)?\s+to\s+the\s+project\b/iu, "emails")
    .replace(/\s+(?:out\s+of\s+all\s+emails?|מתוך\s+כל\s+(?:ה)?מיילים?)$/iu, "")
    .replace(/\s+(?:(?:are|were)\s+)?in\s+the\s+system$|\s+במערכת$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (
    DATA_QUERY_EMAIL_PII_PATTERN.test(normalized) ||
    (DATA_QUERY_EMAIL_ATTACHMENT_DETAIL_PATTERN.test(normalized) && !DATA_QUERY_EMAIL_ATTACHMENT_FLAG_METRIC_PATTERN.test(normalized))
  ) return false;
  const noClearScope = metricScope?.requiredFilters?.some((filter) =>
    filter.field === "relevance_status" &&
    filter.op === "eq" &&
    filter.value === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE
  );
  const hebrewCount = /^(?:כמה\s+מייל(?:ים)?(?:\s+(?:יש|התקבלו|נשלחו))?|מה\s+מספר\s+(?:ה)?מייל(?:ים)?)(?:\s+(?:נכנסים|יוצאים|שנשלחו|שהתקבלו|בטיפול))?(?:\s+(?:עם|ללא|בלי)\s+(?:קובץ|קבצים|מצורף|מצורפים))?(?:\s+(?:בקטגוריה|מסוג)\s+.+)?(?:\s+(?:במהלך|מאז|אחרי|לפני|בין)\s+.+)?$/iu;
  if (noClearScope) {
    return /^(?:how\s+many|count|number\s+of|total\s+number\s+of)\s+(?:the\s+)?(?:non[-\s]?relevant|irrelevant|not\s+relevant)\s+emails?(?:\s+are\s+there)?$|^(?:how\s+many|count|number\s+of)\s+emails?\s+(?:are\s+)?(?:not\s+(?:clearly\s+)?related\s+to|not\s+associated\s+with|without\s+a\s+clear\s+association\s+to|(?:have|with)\s+(?:unknown|unclear)\s+(?:relevance\s+to|association\s+with))\s+the\s+project(?:\s+are\s+there)?$/iu.test(normalized) ||
      (hebrewMetric.intent === "no_clear_project" && hebrewCount.test(grammarText));
  }
  if (metricScope?.operation === "group_count") {
    return /^(?:break\s+down|show\s+(?:the\s+)?(?:breakdown|distribution|counts?)\s+of)\s+(?:the\s+)?(?:project[-\s]?related\s+)?emails?\s+by\s+(?:email\s+)?(?:category|direction|attachment\s+(?:state|status|presence)|stored\s+item\s+status|stored\s+relevance(?:\s+status)?)$|^(?:פלח|פילוח|התפלגות)\s+(?:את\s+)?(?:ה)?מייל(?:ים)?\s+לפי\s+(?:קטגור(?:יה|יות)|כיוון|(?:מצב\s+)?מצורפים|סטטוס\s+(?:פריט\s+)?שמור|(?:סטטוס\s+)?רלוונטיות)$/iu.test(grammarText);
  }
  if (metricScope?.operation === "distinct") {
    return /^(?:(?:show|list|what\s+are)\s+(?:the\s+)?|how\s+many\s+)(?:unique|distinct)\s+email\s+categories(?:\s+are\s+there)?$|^(?:הצג|רשום)\s+(?:את\s+)?(?:ה)?קטגוריות\s+(?:ה)?(?:ייחודיות|שונות)\s+של\s+(?:ה)?מיילים$|^כמה\s+קטגוריות\s+(?:ייחודיות|שונות)\s+יש\s+(?:ל)?מיילים$/iu.test(grammarText);
  }
  if (metricScope?.operation === "timeseries") {
    return /^(?:show\s+)?(?:the\s+)?(?:daily|monthly)\s+(?:project[-\s]?related\s+)?emails?\s+(?:counts?|breakdown|distribution|trend)$|^(?:show\s+)?(?:the\s+)?(?:project[-\s]?related\s+)?emails?\s+(?:trend|time\s*series|over\s+time|by\s+date)$|^break\s+down\s+(?:project[-\s]?related\s+)?emails?\s+by\s+(?:day|month|date)$|^(?:הצג\s+)?(?:מגמה|סדרת\s+זמן|פילוח)\s+(?:של\s+)?(?:ה)?מייל(?:ים)?(?:\s+לפי\s+(?:יום|חודש|תאריך))?$/iu.test(grammarText);
  }
  const englishCount = /^(?:how\s+many\s+(?:project[-\s]?related\s+)?emails?(?:\s+(?:are\s+there|arrived|were\s+received))?|(?:count|number\s+of|total\s+number\s+of)\s+(?:the\s+)?(?:project[-\s]?related\s+)?emails?)(?:\s+(?:with|without)\s+attachments?)?(?:\s+(?:inbound|outbound|incoming|outgoing|received|sent|being[-\s]?handled|of\s+(?:the\s+)?(?:approval|permit|contract|engagement|finance|financial|accounting|schedule|timeline|analysis|forecast(?:ing)?|documentation|decision|general\s+communication)\s+category))?(?:\s+(?:in|during|on|since|after|before|between|from).+)?$/iu;
  const englishDirectionCount = /^(?:how\s+many|count|number\s+of)\s+(?:the\s+)?(?:inbound|outbound|incoming|outgoing|received|sent)\s+(?:project[-\s]?related\s+)?emails?(?:\s+are\s+there)?$/iu;
  return englishCount.test(grammarText) || hebrewCount.test(grammarText) ||
    DATA_QUERY_EMAIL_ATTACHMENT_FLAG_METRIC_PATTERN.test(grammarText) || englishDirectionCount.test(grammarText);
}

function dataQueryEmailMixedExactSemantic(text, lookupCandidate) {
  if (lookupCandidate) return false;
  const connector = /\s*(?:\b(?:and|also|plus|then)\b|[?!.,;])\s*(?=(?:what|which|why|explain|describe|show|give|summari[sz]e|recommend|who|מה|אילו|למה|מדוע|הסבר|תאר|הצג|סכם|מי))/iu;
  const parts = String(text || "").split(connector);
  if (parts.length < 2) return false;
  const exactClause = parts[0].trim();
  const scope = dataQueryEmailMetricScope(exactClause);
  return scope.operation === "count" && dataQueryEmailMetricGrammar(exactClause, scope);
}

function dataQueryExceptionMetricScope(text) {
  const normalized = normalizeHebrewExceptionMetricQuestion(text);
  const requestedAmountCoverage = DATA_QUERY_EXCEPTION_AMOUNT_PATTERN.test(normalized.normalizedText) &&
    !DATA_QUERY_EXCEPTION_EXECUTION_DAYS_PATTERN.test(normalized.normalizedText);
  const groupField = /\b(?:break\s+down|breakdown|distribution|group)\b.{0,35}\b(?:exceptions?|exception\s+reports?|change\s+orders?)\b.{0,20}\bby\s+(?:stored\s+)?urgency\b|\b(?:exceptions?|exception\s+reports?|change\s+orders?)\s+by\s+(?:stored\s+)?urgency\b|פילוח\s+חריגים\s+לפי\s+דחיפות/iu.test(normalized.grammarText)
    ? "urgency_level"
    : /\b(?:break\s+down|breakdown|distribution|group)\b.{0,35}\b(?:exceptions?|exception\s+reports?|change\s+orders?)\b.{0,20}\bby\s+(?:(?:stored\s+)?item\s+)?status\b|\b(?:exceptions?|exception\s+reports?|change\s+orders?)\s+by\s+(?:(?:stored\s+)?item\s+)?status\b|פילוח\s+חריגים\s+לפי\s+סטטוס/iu.test(normalized.grammarText)
      ? "item_status"
      : null;
  const wantsTimeSeries = /\btime\s*series\b|\btrend\b|\bover\s+time\b|\bby\s+date\b|\b(?:by|per)\s+(?:day|month)\b|\b(?:daily|monthly)\s+(?:exceptions?|breakdown|counts?|distribution)\b|מגמה|לאורך\s+זמן|לפי\s+תאריך|לפי\s+יום|לפי\s+חודש/iu.test(normalized.grammarText);
  const undated = /\bundated\s+(?:exceptions?|exception\s+reports?|change\s+orders?)\b|\b(?:exceptions?|exception\s+reports?|change\s+orders?)\b.{0,25}\b(?:without|missing|null|have\s+no|with\s+no)\b.{0,12}\bdate\b|חריגים.{0,25}(?:ללא|אין|חסר|חסרי|חסרות)\s+תאריך/iu.test(normalized.grammarText);
  const storedUrgency = /\bstored\s+urgency\s+(?:is\s+)?not\s+specified\b|חריגים.{0,25}(?:דחיפות\s+)?לא\s+צוין/iu.test(normalized.grammarText)
    ? DATA_QUERY_EXCEPTION_URGENCY_VALUES[0]
    : null;
  const storedStatus = /\b(?:stored\s+item\s+status\s+)?being[-\s]?handled\b|חריגים.{0,25}בטיפול/iu.test(normalized.grammarText)
    ? DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES[0]
    : null;
  const operation = requestedAmountCoverage ? "aggregate" : wantsTimeSeries ? "timeseries" : groupField ? "group_count" : "count";
  return {
    targetTable: "exceptions_report",
    recordKind: "exception_report",
    operation,
    groupField: operation === "group_count" ? groupField : null,
    granularity: operation === "timeseries" && /\bmonth(?:ly)?\b|חודש/iu.test(normalized.grammarText) ? "month" : "day",
    metrics: requestedAmountCoverage ? [
      { type: "count", field: null, as: "total_exception_rows" },
      { type: "count", field: "requested_amount_ex_vat", as: "exceptions_with_requested_amount" },
      { type: "sum", field: "requested_amount_ex_vat", as: "partial_requested_amount_ex_vat" }
    ] : [],
    requiredFilters: [
      ...(storedUrgency ? [{ field: "urgency_level", op: "eq", value: storedUrgency }] : []),
      ...(storedStatus ? [{ field: "item_status", op: "eq", value: storedStatus }] : []),
      ...(undated ? [{ field: "exception_date", op: "is", value: null }] : [])
    ],
    dateScopeRequirement: dataQueryAlertDateScopeRequirement(normalized.grammarText),
    forbiddenFilterFields: [
      "created_at", "project_id", "exception_number", "supervision_company", "inspector",
      "project_manager", "exception_subject", "execution_days", "requested_amount_ex_vat",
      "vat_amount", "total_amount_incl_vat", "main_contractor_profit", "mail_id",
      "attachment_id", "hashtags", "summary", "content", "metadata", "embedding"
    ],
    notComputableReason: wantsTimeSeries && groupField
      ? "exception_multidimensional_timeseries_not_computable"
      : normalized.intent === "exclude" || normalized.ambiguous
        ? "exception_ambiguous_or_negative_scope_not_computable"
        : null
  };
}

function dataQueryExceptionMetricGrammar(text, metricScope = null) {
  const normalized = normalizeHebrewExceptionMetricQuestion(text);
  const englishEntity = /\b(?:exceptions?|exception\s+reports?|change\s+orders?)\b/iu.test(normalized.normalizedText);
  if ((normalized.intent !== "exception_report" && !englishEntity) || normalized.ambiguous) return false;
  const grammarText = normalized.grammarText
    .replace(/[?.!,;]+$/u, "")
    .trim();
  if (metricScope?.operation === "aggregate") {
    return DATA_QUERY_EXCEPTION_AMOUNT_PATTERN.test(normalized.normalizedText);
  }
  if (metricScope?.operation === "group_count") {
    return /^(?:group|break\s+down|show\s+(?:the\s+)?(?:breakdown|distribution|counts?)\s+of)\s+(?:the\s+)?(?:exceptions?|exception\s+reports?|change\s+orders?)\s+by\s+(?:stored\s+)?(?:urgency|item\s+status|status)$|^פילוח\s+חריגים\s+לפי\s+(?:דחיפות|סטטוס)$/iu.test(grammarText);
  }
  if (metricScope?.operation === "timeseries") {
    return /^(?:show\s+)?(?:the\s+)?(?:daily|monthly)?\s*(?:exceptions?|change\s+orders?)\s+(?:trend|time\s*series|over\s+time|by\s+date|counts?\s+by\s+(?:day|month))$|^(?:הצג\s+)?(?:מגמה|סדרת\s+זמן|פילוח)\s+(?:של\s+)?חריגים(?:\s+לפי\s+(?:יום|חודש|תאריך))?$/iu.test(grammarText);
  }
  return /^(?:how\s+many|count|number\s+of|total\s+number\s+of)\s+(?:the\s+)?(?:exceptions?|exception\s+reports?|change\s+orders?)(?:\s+(?:are\s+there|exist|occurred))?(?:\s+(?:have\s+no|with\s+no|without|missing)\s+(?:a\s+)?date)?(?:\s+(?:in|during|on|since|after|before|between|from).+)?$|^כמה\s+חריגים(?:\s+(?:יש|היו|קיימים|בטיפול|ללא\s+תאריך))?(?:\s+(?:במהלך|מאז|אחרי|לפני|בין)\s+.+)?$/iu.test(grammarText);
}

function dataQueryExceptionMixedExactSemantic(text, lookupCandidate) {
  return Boolean(lookupCandidate) && DATA_QUERY_EXCEPTION_MIXED_LATEST_PATTERN.test(String(text || "").trim());
}

function dataQueryExceptionCountApprovalMixed(text) {
  const value = String(text || "").trim();
  const hasEntity = /\b(?:exceptions?|change\s+orders?)\b|חריגים/iu.test(value);
  const hasSubmittedMeaning = /\b(?:submitted|filed|raised)\b|הוגש(?:ו|ה)?/iu.test(value);
  const hasApprovalMeaning = /\b(?:approved|accepted|approval)\b|(?:אושר|אושרה|אושרו|מאושר|מאושרים)/iu.test(value);
  const hasCountMeaning = /\b(?:how\s+many|total(?:\s+number)?|number\s+of|which|what)\b|(?:כמה|אילו|מה\s+מתוכם|סך\s*הכל|סהכ)/iu.test(value);
  return hasEntity && hasSubmittedMeaning && hasApprovalMeaning && hasCountMeaning;
}

function dataQueryConsultantMetricScope(text) {
  const normalized = normalizeHebrewConsultantReportMetricQuestion(text);
  const value = normalized.grammarText;
  const groupField = /\b(?:group|break\s*down|distribution).{0,40}\bconsultant\s+reports?\b.{0,25}\bby\s+(?:stored\s+)?(?:item\s+)?status\b|פילוח\s+דוחות\s+(?:ה)?יועצים\s+לפי\s+סטטוס/iu.test(value)
    ? "item_status" : null;
  const wantsTimeSeries = /\b(?:trend|time\s*series|over\s+time|by\s+date|per\s+(?:day|month)|daily|monthly)\b|מגמה|לאורך\s+זמן|לפי\s+(?:תאריך|יום|חודש)/iu.test(value);
  const undated = /\bundated\s+consultant\s+reports?\b|\bconsultant\s+reports?\b.{0,25}\b(?:without|missing|no)\s+(?:a\s+)?date\b|דוחות\s+(?:ה)?יועצים.{0,25}(?:ללא|חסר)\s+תאריך/iu.test(value);
  const storedStatus = /\bconsultant\s+reports?\b.{0,25}\bbeing[-\s]?handled\b|דוחות\s+(?:ה)?יועצים.{0,25}בטיפול/iu.test(value)
    ? DATA_QUERY_CONSULTANT_REPORT_ITEM_STATUS_VALUES[0] : null;
  return {
    targetTable: "consultants_reports",
    recordKind: "consultant_report",
    operation: wantsTimeSeries ? "timeseries" : groupField ? "group_count" : "count",
    groupField,
    granularity: wantsTimeSeries && /\bmonth(?:ly)?\b|חודש/iu.test(value) ? "month" : "day",
    requiredFilters: [
      ...(storedStatus ? [{ field: "item_status", op: "eq", value: storedStatus }] : []),
      ...(undated ? [{ field: "report_date", op: "is", value: null }] : [])
    ],
    dateScopeRequirement: dataQueryAlertDateScopeRequirement(value),
    forbiddenFilterFields: [
      "created_at", "project_id", "consultant_name", "specialization", "report_topic",
      "main_recommendations", "proposed_actions", "implementation_status", "mail_id",
      "attachment_id", "document_name", "hashtags", "summary", "content", "metadata", "embedding"
    ],
    notComputableReason: normalized.intent === "exclude" || normalized.ambiguous
      ? "consultant_ambiguous_or_negative_scope_not_computable"
      : wantsTimeSeries && groupField ? "consultant_multidimensional_timeseries_not_computable" : null
  };
}

function dataQueryConsultantMetricGrammar(text, scope = null) {
  const normalized = normalizeHebrewConsultantReportMetricQuestion(text);
  const value = normalized.grammarText.replace(/[?.!,;]+$/u, "").trim();
  if (normalized.intent === "exclude" || normalized.ambiguous || !DATA_QUERY_CONSULTANT_REPORT_PATTERN.test(value)) return false;
  if (scope?.operation === "group_count") {
    return /^(?:group|break\s*down|show\s+(?:the\s+)?(?:breakdown|distribution))\s+(?:the\s+)?consultant\s+reports?\s+by\s+(?:stored\s+)?(?:item\s+)?status$|^פילוח\s+דוחות\s+(?:ה)?יועצים\s+לפי\s+סטטוס$/iu.test(value);
  }
  if (scope?.operation === "timeseries") {
    return /^(?:show\s+)?(?:the\s+)?(?:daily|monthly)?\s*consultant\s+reports?\s+(?:trend|time\s*series|over\s+time|by\s+date)$|^(?:הצג\s+)?(?:מגמה|סדרת\s+זמן)\s+של\s+דוחות\s+(?:ה)?יועצים(?:\s+לפי\s+(?:יום|חודש|תאריך))?$/iu.test(value);
  }
  return /^(?:how\s+many|count|number\s+of|total\s+number\s+of)\s+(?:the\s+)?consultant\s+reports?(?:\s+(?:are\s+there|exist))?(?:\s+(?:are\s+)?(?:without|missing)\s+(?:a\s+)?date)?(?:\s+(?:in|during|on|since|after|before|between|from).+)?$|^כמה\s+דוחות\s+(?:ה)?יועצים(?:\s+(?:יש|קיימים|בטיפול|ללא\s+תאריך))?(?:\s+(?:במהלך|מאז|אחרי|לפני|בין)\s+.+)?$/iu.test(value);
}

function dataQueryConsultantMixedExactSemantic(text, lookupCandidate) {
  return Boolean(lookupCandidate) && DATA_QUERY_CONSULTANT_MIXED_LATEST_PATTERN.test(String(text || ""));
}

function dataQueryAlertMetricScope(text) {
  const groupField = dataQueryAlertGroupField(text);
  const wantsTimeSeries = /\btime\s*series\b|\btrend\b|\bover\s+time\b|\bby\s+date\b|\b(?:by|per)\s+(?:day|month)\b|\b(?:daily|monthly)\s+(?:alerts?|breakdown|counts?|distribution)\b|\balerts?\s+(?:daily|monthly)\b|מגמה|לאורך\s+זמן|לפי\s+תאריך|לפי\s+יום|לפי\s+חודש/iu.test(text);
  const operation = wantsTimeSeries
    ? "timeseries"
    : groupField
      ? "group_count"
      : "count";
  const alertType = dataQueryAlertTypeIntent(text);
  const inputType = dataQueryAlertInputTypeIntent(text);
  const storedSeverity = dataQueryAlertStoredSeverityIntent(text);
  const storedStatus = dataQueryAlertStoredStatusIntent(text);
  const relevance = dataQueryAlertRelevanceIntent(text);
  const undated = DATA_QUERY_ALERT_UNDATED_PATTERN.test(text);
  const requiredFilters = [
    ...(alertType ? [{ field: "alert_type", op: "eq", value: alertType }] : []),
    ...(inputType ? [{ field: "input_data_type", op: "eq", value: inputType }] : []),
    ...(storedSeverity !== null ? [{ field: "severity_level", op: "eq", value: storedSeverity }] : []),
    ...(storedStatus ? [{ field: "item_status", op: "eq", value: storedStatus }] : []),
    ...(relevance !== null ? [{ field: "is_relevant", op: "eq", value: relevance }] : []),
    ...(undated ? [{ field: "data_date", op: "is", value: null }] : [])
  ];
  return {
    targetTable: "alerts",
    recordKind: "alert",
    operation,
    groupField: operation === "group_count" ? groupField : null,
    granularity: operation === "timeseries" && /\bmonth(?:ly)?\b|חודש/iu.test(text) ? "month" : "day",
    metrics: [],
    requiredFilters,
    dateScopeRequirement: dataQueryAlertDateScopeRequirement(text),
    forbiddenFilterFields: ["status", "created_at", "input_data_id", "data_link"],
    notComputableReason: wantsTimeSeries && groupField
      ? "alert_multidimensional_timeseries_not_computable"
      : null
  };
}

function dataQueryAlertDateScopeRequirement(text) {
  const dateAtom = "(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\\s+\\d{4})?|\\d{4}(?:-\\d{2}(?:-\\d{2})?)?|today|yesterday|this\\s+(?:day|week|month|year)|last\\s+(?:day|week|month|year))";
  if (new RegExp(`\\b(?:since|after)\\s+${dateAtom}\\b`, "iu").test(text) || /(?:מאז|אחרי)\s+(?:\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu.test(text)) return "from";
  if (new RegExp(`\\bbefore\\s+${dateAtom}\\b`, "iu").test(text) || /לפני\s+(?:\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/iu.test(text)) return "to";
  if (
    new RegExp(`\\b(?:in|during|on)\\s+${dateAtom}\\b|\\bbetween\\s+${dateAtom}.{1,30}\\b(?:and|to)\\s+${dateAtom}\\b|\\bfrom\\s+${dateAtom}\\s+to\\s+${dateAtom}\\b|\\bdate\\s+range\\b`, "iu").test(text) ||
    /(?:ב|במהלך)(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:\s+\d{4})?|בין\s+(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/iu.test(text)
  ) return "both";
  return null;
}

function dataQueryAlertGroupField(text) {
  if (/\bby\s+(?:alert\s+)?(?:type|category|kind)\b|\b(?:alert\s+type\s+distribution|distribution\s+of\s+alert\s+types?|(?:for\s+each|per)\s+(?:alert\s+)?type)\b|לפי\s+סוג(?:\s+התראה)?|לפי\s+קטגור(?:יה|יית\s+התראה)|פילוח\s+סוגי\s+התראות/iu.test(text)) return "alert_type";
  if (/\bby\s+(?:stored\s+)?severity(?:\s+level)?\b|\b(?:(?:stored\s+)?severity\s+distribution(?:\s+of\s+alerts?)?|(?:for\s+each|per)\s+(?:stored\s+)?severity\s+level)\b|לפי\s+(?:רמת\s+)?חומרה(?:\s+שמורה)?|פילוח\s+(?:לפי\s+)?רמות\s+חומרה/iu.test(text)) return "severity_level";
  if (/\bby\s+(?:input|source)\s+type\b|\bby\s+technical\s+origin\b|\b(?:input\s+type\s+distribution|distribution\s+of\s+input\s+types?|(?:for\s+each|per)\s+input\s+type)\b|לפי\s+סוג\s+(?:קלט|מקור)|לפי\s+מקור\s+טכני|פילוח\s+סוגי\s+קלט/iu.test(text)) return "input_data_type";
  if (/\bby\s+(?:stored\s+)?(?:item\s+)?status\b|\b(?:stored\s+item\s+status\s+distribution|distribution\s+of\s+stored\s+item\s+statuses|(?:for\s+each|per)\s+stored\s+item\s+status)\b|לפי\s+סטטוס\s+(?:פריט\s+)?שמור|לפי\s+מצב\s+פריט\s+שמור|פילוח\s+סטטוס\s+פריט\s+שמור/iu.test(text)) return "item_status";
  if (/\bby\s+(?:stored\s+)?relevance(?:\s+flag)?\b|\b(?:relevance\s+flag\s+distribution|distribution\s+of\s+(?:stored\s+)?relevance\s+flags|(?:for\s+each|per)\s+(?:stored\s+)?relevance\s+flag)\b|לפי\s+(?:דגל\s+)?רלוונטיות(?:\s+שמור)?|פילוח\s+דגלי\s+רלוונטיות/iu.test(text)) return "is_relevant";
  return null;
}

function dataQueryAlertTypeIntent(text) {
  const candidates = [
    ["עדכון", /\bupdates?\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+updates?\b|התרא(?:ה|ות)\s+(?:מסוג\s+)?עדכון(?:ים)?|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+עדכון/iu],
    ["התראה", /\bwarning\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+(?:alerts?|warnings?)\b|התרא(?:ה|ות)\s+מסוג\s+התרא(?:ה|ות)|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+התרא(?:ה|ות)/iu],
    ["עיכוב", /\bdelay\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+delays?\b|התרא(?:ה|ות)\s+(?:מסוג\s+)?עיכוב(?:ים)?|התרא(?:ה|ות)\s+(?:ה)?עיכוב\s+(?:ה)?(?:אחרונ|ראשונ)|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+עיכוב/iu],
    ["חריג", /\b(?:exception|anomaly)\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+(?:exceptions?|anomal(?:y|ies))\b|התרא(?:ה|ות)\s+(?:מסוג\s+)?חריג(?:ה|ים|ות)?|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+חריג/iu],
    ["איכות", /\bquality\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+quality\b|התרא(?:ה|ות)\s+(?:מסוג\s+)?איכות|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+איכות/iu],
    ["אירוע בטיחות", /\bsafety[-\s]?event\s+alerts?\b|\balerts?\s+(?:of\s+type|with\s+type)\s+safety\s+events?\b|התרא(?:ה|ות)\s+(?:מסוג\s+)?אירוע(?:י)?\s+בטיחות|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}מסוג\s+אירוע(?:י)?\s+בטיחות/iu]
  ];
  const matches = candidates.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
  return matches.length === 1 ? canonicalizeDataQueryAlertType(matches[0]) : null;
}

function dataQueryAlertInputTypeIntent(text) {
  const candidates = [
    ["email", /\bemail\s+alerts?\b|\balerts?\s+(?:from|with\s+input\s+type)\s+emails?\b|התרא(?:ה|ות)\s+(?:מ|מתוך|מסוג\s+קלט)\s*מייל(?:ים)?|התרא(?:ה|ות).{0,30}(?:אחרונ|ראשונ).{0,12}(?:מ|מתוך|מסוג\s+קלט)\s*מייל/iu],
    ["attachment/meeting_summary", /\bmeeting[-\s]?summary\s+attachment\s+alerts?\b|\balerts?\s+from\s+meeting[-\s]?summary\s+attachments?\b|התרא(?:ה|ות).{0,20}קבצי?\s+סיכו(?:ם|מי)\s+ישיב/iu],
    ["attachment/safety_report", /\bsafety[-\s]?report\s+attachment\s+alerts?\b|\balerts?\s+from\s+safety[-\s]?report\s+attachments?\b|התרא(?:ה|ות).{0,20}קבצי?\s+דוח(?:ות)?\s+בטיחות/iu],
    ["attachment/exception_report", /\bexception[-\s]?report\s+attachment\s+alerts?\b|\balerts?\s+from\s+exception[-\s]?report\s+attachments?\b|התרא(?:ה|ות).{0,20}קבצי?\s+דוח(?:ות)?\s+חריג/iu]
  ];
  const matches = candidates.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
  return matches.length === 1 ? canonicalizeDataQueryAlertInputType(matches[0]) : null;
}

function dataQueryAlertStoredSeverityIntent(text) {
  return /\b(?:stored\s+)?severity(?:\s+level)?\s+(?:equals?\s+|is\s+)?3\b|(?:רמת\s+)?חומרה\s+(?:שמורה\s+)?(?:היא\s+)?3\b/iu.test(text)
    ? DATA_QUERY_ALERT_SEVERITY_LEVEL
    : null;
}

function dataQueryAlertStoredStatusIntent(text) {
  return /\b(?:stored\s+)?(?:item\s+)?status\s+(?:is\s+)?being\s+handled\b|\bbeing[-\s]?handled\s+alerts?\b|\balerts?\b.{0,20}\b(?:are\s+)?being[-\s]?handled\b|התרא(?:ה|ות).{0,20}ב(?:סטטוס\s+)?טיפול|סטטוס\s+(?:פריט\s+)?שמור.{0,12}בטיפול/iu.test(text)
    ? DATA_QUERY_ALERT_ITEM_STATUS
    : null;
}

function dataQueryAlertRelevanceIntent(text) {
  if (/\b(?:stored\s+)?relevance(?:\s+flag)?\s+(?:is\s+)?false\b|\b(?:non[-\s]?relevant|irrelevant|not\s+relevant)\s+alerts?\b|התרא(?:ה|ות)\s+עם\s+(?:דגל\s+)?רלוונטיות\s+שקר|התרא(?:ה|ות)\s+לא\s+רלוונטי(?:ות|ים)?/iu.test(text)) return false;
  if (/\b(?:stored\s+)?relevance(?:\s+flag)?\s+(?:is\s+)?(?:true|relevant)\b|\brelevant\s+alerts?\b|התרא(?:ה|ות)\s+עם\s+(?:דגל\s+)?רלוונטיות\s+אמת|התרא(?:ה|ות)\s+רלוונטי(?:ות|ים)?/iu.test(text)) return true;
  return null;
}

function dataQuerySafetyMetricScope(text) {
  const risk = dataQuerySafetyRiskIntent(text);
  const asksDefects = /\bdefects?\b|ליקוי(?:ים|י|ות)?|מפגע(?:ים|י|ות)?/iu.test(text);
  const asksDefectMetric = asksDefects && (
    /\b(?:how\s+many|total|sum)\b.{0,40}\bdefects?\b|\bdefects?\b.{0,40}\b(?:total|sum)\b/iu.test(text) ||
    /כמה.{0,40}ליקוי|סך.{0,40}ליקוי|סכום.{0,40}ליקוי/iu.test(text)
  );
  const defectMetrics = asksDefectMetric ? dataQuerySafetyDefectMetrics(text) : [];
  const groupField = dataQuerySafetyGroupField(text);
  const wantsTimeSeries = /\btime\s*series\b|\btrend\b|\bover\s+time\b|\bby\s+date\b|מגמה|לאורך\s+זמן|לפי\s+תאריך|לפי\s+יום|לפי\s+חודש/iu.test(text);
  const workerAggregate = DATA_QUERY_SAFETY_WORKER_AGGREGATE_PATTERN.test(text);
  const operation = defectMetrics.length
    ? "aggregate"
    : wantsTimeSeries
      ? "timeseries"
      : groupField
        ? "group_count"
        : "count";
  return {
    targetTable: "safety_reports",
    recordKind: "safety_report",
    operation,
    groupField: operation === "group_count" ? groupField : null,
    granularity: operation === "timeseries" && /\bmonth(?:ly)?\b|חודש/iu.test(text) ? "month" : "day",
    metrics: operation === "aggregate" ? defectMetrics : [],
    requiredFilters: risk
      ? [{ field: "risk_level", op: "eq", value: risk }]
      : [],
    forbiddenFilterFields: ["resolved"],
    resolutionStatusRequested: DATA_QUERY_SAFETY_RESOLUTION_PATTERN.test(text),
    notComputableReason: workerAggregate
      ? "worker headcounts are per-report snapshots and are not semantically additive across reports"
      : null
  };
}

function dataQuerySafetyGroupField(text) {
  if (/\bby\s+risk(?:\s+level)?\b|לפי\s+רמת\s+סיכון|לפי\s+סיכון/iu.test(text)) return "risk_level";
  if (/\bby\s+(?:site\s+)?grade\b|לפי\s+ציון|לפי\s+דירוג/iu.test(text)) return "site_grade";
  if (/\bby\s+(?:site|location)\b|לפי\s+אתר|לפי\s+מיקום/iu.test(text)) return "site_location";
  if (/\bby\s+(?:item\s+)?status\b|לפי\s+סטטוס|לפי\s+מצב/iu.test(text)) return "item_status";
  return null;
}

function dataQuerySafetyRiskIntent(text) {
  const candidates = [
    ["high", /\bhigh[-\s]?risk\b|\brisk(?:\s+level)?\s+(?:is\s+)?high\b|סיכון.{0,12}גבוה(?:ה)?|ברמת\s+סיכון\s+גבוה(?:ה)?/iu],
    ["medium", /\bmedium[-\s]?risk\b|\brisk(?:\s+level)?\s+(?:is\s+)?medium\b|סיכון.{0,12}בינוני(?:ת)?|ברמת\s+סיכון\s+בינוני(?:ת)?/iu],
    ["low", /\blow[-\s]?risk\b|\brisk(?:\s+level)?\s+(?:is\s+)?low\b|סיכון.{0,12}נמוך(?:ה)?|ברמת\s+סיכון\s+נמוך(?:ה)?/iu],
    ["unknown", /\bunknown[-\s]?risk\b|\brisk(?:\s+level)?\s+(?:is\s+)?unknown\b|סיכון.{0,12}לא\s+ידוע(?:ה)?/iu]
  ];
  const matches = candidates.filter(([, pattern]) => pattern.test(text)).map(([value]) => value);
  return matches.length === 1 ? matches[0] : null;
}

function dataQuerySafetyDefectMetrics(text) {
  const definitions = [
    {
      field: "life_threatening_defects",
      as: "life_threatening_defects_total",
      pattern: /\blife[-\s]?threatening\b|מסכ(?:ן|נת|ני|נות)\s+חיים/iu
    },
    {
      field: "severe_defects",
      as: "severe_defects_total",
      pattern: /\bsevere\b|\bserious\b|חמור(?:ים|ות|ה)?/iu
    },
    {
      field: "medium_defects",
      as: "medium_defects_total",
      pattern: /\bmedium\b|בינוני(?:ים|ות|ת)?/iu
    },
    {
      field: "minor_defects",
      as: "minor_defects_total",
      pattern: /\bminor\b|\blow[-\s]?severity\b|קל(?:ים|ות|ה)?/iu
    }
  ];
  const selected = definitions.filter((definition) => definition.pattern.test(text));
  const allRequested = /\b(?:all|total)\s+(?:typed\s+)?defects?\b|סך\s+(?:כל\s+)?הליקויים|כל\s+הליקויים/iu.test(text);
  return (allRequested || !selected.length ? definitions : selected).map((definition) => ({
    type: "sum",
    field: definition.field,
    as: definition.as
  }));
}

function dataQueryLookupDirection(text) {
  const numberToken = dataQueryLookupNumberToken();
  const englishWord = "[\\p{L}\\p{N}_'-]+";
  const latestEnglish = [
    new RegExp(`\\b(?:latest|newest|most\\s+recent|last)(?:\\s+${numberToken})?\\s+(?:${englishWord}\\s+){0,3}${DATA_QUERY_LOOKUP_ENGLISH_TARGET}\\b`, "iu"),
    new RegExp(`\\b${numberToken}\\s+(?:latest|newest|most\\s+recent)\\s+(?:${englishWord}\\s+){0,3}${DATA_QUERY_LOOKUP_ENGLISH_TARGET}\\b`, "iu")
  ];
  const earliestEnglish = [
    new RegExp(`\\b(?:earliest|oldest|first)(?:\\s+${numberToken})?\\s+(?:${englishWord}\\s+){0,3}${DATA_QUERY_LOOKUP_ENGLISH_TARGET}\\b`, "iu"),
    new RegExp(`\\b${numberToken}\\s+(?:earliest|oldest|first)\\s+(?:${englishWord}\\s+){0,3}${DATA_QUERY_LOOKUP_ENGLISH_TARGET}\\b`, "iu")
  ];
  const hebrewWord = "[\\p{L}\"״'-]+";
  const latestHebrew = new RegExp(
    `(?:^|\\s)(?:${numberToken}\\s+)?(?:ה)?${DATA_QUERY_LOOKUP_HEBREW_TARGET}(?:\\s+${hebrewWord}){0,3}\\s+(?:ה?אחרו(?:ן|נה|נים|נות)|הכי\\s+חדש(?:ה|ים|ות)?|עדכני(?:ת|ים|ות)?)(?=\\s|[?.!,]|$)`,
    "iu"
  );
  const earliestHebrew = new RegExp(
    `(?:^|\\s)(?:${numberToken}\\s+)?(?:ה)?${DATA_QUERY_LOOKUP_HEBREW_TARGET}(?:\\s+${hebrewWord}){0,3}\\s+(?:ה?ראשו(?:ן|נה|נים|נות)|הכי\\s+מוקד(?:ם|מת|מים|מות)|המוקד(?:ם|מת)\\s+ביותר|היש(?:ן|נה)\\s+ביותר)(?=\\s|[?.!,]|$)`,
    "iu"
  );
  const hasLatest = latestEnglish.some((pattern) => pattern.test(text)) ||
    latestHebrew.test(text) ||
    DATA_QUERY_BET_PREFIXED_LATEST_INVOICE_PATTERN.test(text);
  const hasEarliest = earliestEnglish.some((pattern) => pattern.test(text)) || earliestHebrew.test(text);
  if (hasLatest === hasEarliest) return null;
  return hasEarliest ? "earliest" : "latest";
}

function dataQueryFinancialLookupDirection(text) {
  const latest = /\b(?:latest|newest|most\s+recent|last)\b|(?:ה)?אחרו(?:ן|נה|נים|נות)|הכי\s+חדש(?:ה|ים|ות)?|העדכני(?:ת|ים|ות)?\s+ביותר/iu.test(text);
  const earliest = /\b(?:earliest|oldest|first)\b|(?:ה)?ראשו(?:ן|נה|נים|נות)|הכי\s+מוקד(?:ם|מת|מים|מות)|היש(?:ן|נה)\s+ביותר/iu.test(text);
  if (latest === earliest) return null;
  return earliest ? "earliest" : "latest";
}

function dataQueryLookupTargetTable(text, financialType = null) {
  if (DATA_QUERY_CONSULTANT_REPORT_PATTERN.test(text) && !DATA_QUERY_SAFETY_REPORT_PATTERN.test(text) && !DATA_QUERY_EXCEPTION_REPORT_PATTERN.test(text)) {
    return "consultants_reports";
  }
  const targets = new Set();
  const financialDocumentTarget = DATA_QUERY_FINANCIAL_DOCUMENT_PATTERN.test(text);
  const alertTarget = /\balerts?\b|התרא(?:ה|ות)/iu.test(text);
  const alertInputQualifier = alertTarget && (
    /\b(?:email|meeting[-\s]?summary\s+attachment|safety[-\s]?report\s+attachment|exception[-\s]?report\s+attachment)\s+alerts?\b|\balerts?\s+from\s+(?:emails?|meeting[-\s]?summary\s+attachments?|safety[-\s]?report\s+attachments?|exception[-\s]?report\s+attachments?)\b/iu.test(text) ||
    /התרא(?:ה|ות).{0,25}(?:מייל|קבצי?\s+סיכו(?:ם|מי)\s+ישיב|קבצי?\s+דוח(?:ות)?\s+(?:בטיחות|חריג))/iu.test(text)
  );
  if (alertTarget) targets.add("alerts");
  if (!alertInputQualifier && DATA_QUERY_SAFETY_REPORT_PATTERN.test(text)) targets.add("safety_reports");
  if (financialType || financialDocumentTarget || /\b(?:invoices?|transactions?|payments?|receipts?)\b|חשבוני(?:ת|ות)|עסק(?:ה|אות)|תשלו(?:ם|מים)|קבל(?:ה|ות)/iu.test(text)) targets.add("financial_transactions");
  if (!alertInputQualifier && /\bmeetings?\b|ישיב(?:ה|ות)|פגיש(?:ה|ות)/iu.test(text)) targets.add("meetings");
  if (!alertInputQualifier && /\bemails?\b|מייל(?:ים)?/iu.test(text)) targets.add("emails");
  if (!financialType && !alertInputQualifier && DATA_QUERY_EXCEPTION_REPORT_PATTERN.test(text)) targets.add("exceptions_report");
  if (!alertInputQualifier && (DATA_QUERY_CONSULTANT_REPORT_PATTERN.test(text) || analyzeHebrewConsultantReportIntent(text).intent === "consultant_report")) targets.add("consultants_reports");
  if (/\bconversations?\b|שיח(?:ה|ות)/iu.test(text)) targets.add("whatsapp_analysis");
  if (!alertTarget && !financialDocumentTarget && /\b(?:records?|documents?)\b|רשומ(?:ה|ות)|מסמ(?:ך|כים)/iu.test(text)) targets.add("data_index");
  return targets.size === 1 ? [...targets][0] : null;
}

function dataQueryFinancialRecordKind(text, financialType = null) {
  const normalized = String(text || "");
  if (DATA_QUERY_FINANCIAL_DOCUMENT_PATTERN.test(normalized)) return "financial_document";
  const matchedType = financialType || analyzeDataQueryFinancialTransactionType(normalized).match;
  if (matchedType) return matchedType.key === "invoice" ? "invoice" : "financial_transaction_type";
  return /\binvoices?\b|חשבוני(?:ת|ות)/iu.test(normalized) ? "invoice" : null;
}

function dataQueryLookupSuggestedAgent(targetTable) {
  const routes = {
    financial_transactions: "financial_transactions",
    meetings: "meetings",
    emails: "emails",
    exceptions_report: "hybrid_search",
    consultants_reports: "consultants_reports",
    whatsapp_analysis: "whatsapp_messages",
    safety_reports: "safety_report",
    alerts: "alert",
    data_index: "hybrid_search"
  };
  return routes[targetTable] || "hybrid_search";
}

function dataQueryLookupMaxRows(settings, lookup, fallback) {
  const table = (Array.isArray(settings?.manifest) ? settings.manifest : [])
    .find((item) => item.tableName === lookup?.targetTable && item.lookupPolicy);
  const allFinancialRows = lookup?.allRequested === true && lookup?.targetTable === "financial_transactions";
  const candidates = (allFinancialRows
    ? [table?.lookupPolicy?.allRowsMax, table?.maxLimit, DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT]
    : [
        table?.lookupPolicy?.maxRows,
        table?.maxLimit,
        settings?.maxRowsPerPlan,
        ...(table ? [] : [fallback])
      ])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.min(...candidates) : 50;
}

function extractDataQueryLookupLimit(text) {
  const numberToken = dataQueryLookupNumberToken();
  const patterns = [
    new RegExp(`\\b(?:last|latest|newest|most\\s+recent|earliest|oldest|first)\\s+(${numberToken})(?=\\s|[?.!,]|$)`, "iu"),
    new RegExp(`(?:^|\\s)(${numberToken})\\s+(?:most\\s+recent|latest|newest|earliest|oldest|first)(?=\\s|[?.!,]|$)`, "iu"),
    new RegExp(`(?:^|\\s)(${numberToken})\\s+(?:\\S+\\s+){0,4}(?:ה?אחרונים|ה?אחרונות|ה?ראשונים|ה?ראשונות)(?=\\s|[?.!,]|$)`, "iu")
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = dataQueryNumberWord(match[1]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function dataQueryLookupNumberToken() {
  return "(?:\\d{1,6}|one[-\\s]hundred|hundred|dozen|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[-\\s](?:one|two|three|four|five))?|one|two|three|four|five|six|seven|eight|nine|ten|עשרים(?:\\s+ו?(?:אחד|אחת|שניים|שתיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש))?|אחד\\s+עשר|אחת\\s+עשרה|שניים\\s+עשר|שתיים\\s+עשרה|שנים\\s+עשר|שתים\\s+עשרה|שלושה\\s+עשר|שלוש\\s+עשרה|ארבעה\\s+עשר|ארבע\\s+עשרה|חמישה\\s+עשר|חמש\\s+עשרה|שישה\\s+עשר|שש\\s+עשרה|שבעה\\s+עשר|שבע\\s+עשרה|שמונה\\s+עשר|שמונה\\s+עשרה|תשעה\\s+עשר|תשע\\s+עשרה|עשרים|אחד|אחת|שני|שתי|שניים|שתיים|שלושה|שלוש|שלושת|ארבעה|ארבע|ארבעת|חמישה|חמש|חמשת|שישה|שש|ששת|שבעה|שבע|שבעת|שמונה|שמונת|תשעה|תשע|תשעת|עשרה|עשר|עשרת)";
}

function dataQueryNumberWord(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (/^\d{1,6}$/.test(normalized)) return Number(normalized);
  const englishCompound = normalized.replace(/\s+/g, "-");
  if (["hundred", "one-hundred"].includes(englishCompound)) return 100;
  if (englishCompound === "dozen") return 12;
  const twentyMatch = englishCompound.match(/^twenty(?:-(one|two|three|four|five))?$/);
  if (twentyMatch) {
    return 20 + ({ one: 1, two: 2, three: 3, four: 4, five: 5 }[twentyMatch[1]] || 0);
  }
  const hebrewTwenty = normalized.match(/^עשרים(?:\s+ו?(אחד|אחת|שניים|שתיים|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש))?$/);
  if (hebrewTwenty) {
    return 20 + ({
      אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שלושה: 3, שלוש: 3,
      ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5
    }[hebrewTwenty[1]] || 0);
  }
  const values = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19,
    אחד: 1, אחת: 1, שני: 2, שתי: 2, שניים: 2, שתיים: 2, שלושה: 3, שלוש: 3,
    שלושת: 3, ארבעה: 4, ארבע: 4, ארבעת: 4, חמישה: 5, חמש: 5, חמשת: 5,
    שישה: 6, שש: 6, ששת: 6, שבעה: 7, שבע: 7, שבעת: 7, שמונה: 8, שמונת: 8,
    תשעה: 9, תשע: 9, תשעת: 9, עשרה: 10, עשר: 10, עשרת: 10,
    "אחד עשר": 11, "אחת עשרה": 11, "שניים עשר": 12, "שתיים עשרה": 12,
    "שנים עשר": 12, "שתים עשרה": 12, "שלושה עשר": 13, "שלוש עשרה": 13,
    "ארבעה עשר": 14, "ארבע עשרה": 14, "חמישה עשר": 15, "חמש עשרה": 15,
    "שישה עשר": 16, "שש עשרה": 16, "שבעה עשר": 17, "שבע עשרה": 17,
    "שמונה עשר": 18, "שמונה עשרה": 18, "תשעה עשר": 19, "תשע עשרה": 19,
    עשרים: 20
  };
  return values[normalized] ?? null;
}

function normalizeCallerId(value, field, warnings) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    warnings.push(`invalid_caller_id_ignored:${field}`);
    return null;
  }
  return normalized;
}

function normalizeScopeDate(value, field, errors) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  if (Number.isNaN(Date.parse(normalized))) {
    errors.push(`${field} must be a valid date`);
    return null;
  }
  return normalized;
}

function normalizeOptionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizePlan(plan = {}, settings = dataQuerySettings()) {
  return {
    ...plan,
    id: String(plan.id || "").trim(),
    requestId: String(plan.requestId || plan.request_id || "").trim() || null,
    schema: String(plan.schema || plan.schemaAlias || "content").trim(),
    table: String(plan.table || plan.tableName || "").trim(),
    operation: String(plan.operation || "select").trim(),
    filters: Array.isArray(plan.filters) ? plan.filters : [],
    select: Array.isArray(plan.select) ? plan.select : [],
    metrics: Array.isArray(plan.metrics) ? plan.metrics : [],
    groupBy: Array.isArray(plan.groupBy) ? plan.groupBy : [],
    orderBy: Array.isArray(plan.orderBy) ? plan.orderBy : [],
    limit: plan.limit === undefined || plan.limit === null || plan.limit === ""
      ? null
      : Number(plan.limit)
  };
}

function normalizeLookupPlan(plan, table, settings) {
  const errors = [];
  const policy = table.lookupPolicy;
  const expectedDirection = plan.operation === "lookup_earliest" ? "asc" : "desc";
  const allRequested = settings.expectedLookup?.allRequested === true &&
    settings.expectedLookup?.targetTable === "financial_transactions" &&
    plan.table === "financial_transactions";
  const policyMaxRows = allRequested ? policy.allRowsMax : policy.maxRows;
  const maxRows = Math.min(
    policyMaxRows || policy.maxRows,
    table.maxLimit,
    allRequested ? DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT : settings.maxRowsPerPlan
  );
  plan.allRequested = allRequested;
  const rawOrder = plan.orderBy || [];
  if (rawOrder.length > 2) errors.push("lookup orderBy supports only a primary field and stable tie-breaker");
  const primary = rawOrder[0] || { field: policy.defaultOrderField, direction: expectedDirection };
  if (!policy.orderableFields.includes(primary.field)) errors.push(`lookup order field ${primary.field || "missing"} is not allowed`);
  if (primary.field !== policy.defaultOrderField) {
    errors.push(`lookup order field must be the canonical ${policy.defaultOrderField}`);
  }
  if (primary.direction && !["asc", "desc"].includes(primary.direction)) errors.push(`lookup order direction ${primary.direction} is not allowed`);
  if (primary.direction && primary.direction !== expectedDirection) {
    errors.push(`${plan.operation} requires ${expectedDirection} ordering`);
  }
  const secondary = rawOrder[1];
  if (secondary?.field && secondary.field !== policy.stableIdField) {
    errors.push(`lookup tie-breaker must be ${policy.stableIdField}`);
  }
  if (secondary?.direction && !["asc", "desc"].includes(secondary.direction)) {
    errors.push(`lookup tie-breaker direction ${secondary.direction} is not allowed`);
  }
  if (secondary?.direction && secondary.direction !== expectedDirection) {
    errors.push(`lookup tie-breaker requires ${expectedDirection} ordering`);
  }
  plan.orderBy = [
    { field: primary.field || policy.defaultOrderField, direction: expectedDirection, nulls: "last" },
    { field: policy.stableIdField, direction: expectedDirection, nulls: "last" }
  ];

  if (!plan.select.length) errors.push("lookup requires selected output fields");
  if (!plan.select.includes(plan.orderBy[0].field)) errors.push(`lookup select must include order field ${plan.orderBy[0].field}`);
  if (!plan.select.includes(policy.stableIdField)) errors.push(`lookup select must include stable id field ${policy.stableIdField}`);
  if (plan.groupBy.length) errors.push("lookup does not support groupBy");
  if (plan.metrics.length) errors.push("lookup does not support metrics");

  if (["lookup_latest", "lookup_earliest"].includes(plan.operation)) {
    if (Number(plan.limit) !== 1) errors.push(`${plan.operation} requires limit 1`);
    plan.limit = 1;
  } else if (!Number.isInteger(Number(plan.limit)) || Number(plan.limit) < 1 || Number(plan.limit) > maxRows) {
    errors.push(`lookup_last_n limit must be between 1 and ${maxRows}`);
  } else {
    plan.limit = Number(plan.limit);
  }
  return errors;
}

function validatePlanFields(plan, table) {
  const errors = [];
  const allowed = new Set(table.allowedFields);
  const groupable = new Set(table.groupableFields);
  const allowedOps = new Set(table.allowedOperations);
  const fieldMap = new Map((table.fields || []).map((definition) => [definition.name, definition]));
  if (!allowedOps.has(plan.operation)) errors.push(`operation ${plan.operation} is not allowed for ${table.tableName}`);
  for (const field of plan.select || []) {
    if (!allowed.has(field)) errors.push(`field ${field} is not allowed`);
    else if (!fieldMap.get(field)?.selectable) errors.push(`field ${field} is not selectable`);
  }
  if ((plan.groupBy || []).length > 2) errors.push("at most two group fields are supported");
  if (table.tableName === "alerts") {
    if (plan.operation === "group_count" && (plan.groupBy || []).length !== 1) {
      errors.push("alerts group_count requires exactly one approved group field");
    }
    if (plan.operation !== "group_count" && (plan.groupBy || []).length) {
      errors.push(`alerts operation ${plan.operation} does not accept group fields`);
    }
    if ((plan.metrics || []).length) errors.push("alerts does not support numeric aggregate metrics");
  }
  if (table.tableName === "meetings" && !DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    if (plan.operation === "group_count" && (plan.groupBy.length !== 1 || plan.groupBy[0] !== "status")) {
      errors.push("meetings group_count requires exactly the approved stored status field");
    }
    if (plan.operation !== "group_count" && plan.groupBy.length) {
      errors.push(`meetings operation ${plan.operation} does not accept group fields`);
    }
    if (plan.operation === "distinct" && (plan.select.length !== 1 || plan.select[0] !== "status")) {
      errors.push("meetings distinct requires exactly the approved stored status field");
    }
    if (plan.operation !== "distinct" && plan.select.length) {
      errors.push(`meetings operation ${plan.operation} does not accept selected output fields`);
    }
    if (plan.orderBy.length) errors.push(`meetings operation ${plan.operation} does not accept caller-defined ordering`);
    if (plan.metrics.length) errors.push("meetings does not support numeric aggregate metrics");
  }
  if (table.tableName === "exceptions_report" && !DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    if (
      plan.operation === "group_count" &&
      (plan.groupBy.length !== 1 || !["urgency_level", "item_status"].includes(plan.groupBy[0]))
    ) {
      errors.push("exceptions_report group_count requires exactly one approved urgency or item-status field");
    }
    if (plan.operation !== "group_count" && plan.groupBy.length) {
      errors.push(`exceptions_report operation ${plan.operation} does not accept group fields`);
    }
    if (plan.select.length) errors.push(`exceptions_report operation ${plan.operation} does not accept selected output fields`);
    if (plan.orderBy.length) errors.push(`exceptions_report operation ${plan.operation} does not accept caller-defined ordering`);
    const approvedAmountMetrics = [
      { type: "count", field: null, as: "total_exception_rows" },
      { type: "count", field: "requested_amount_ex_vat", as: "exceptions_with_requested_amount" },
      { type: "sum", field: "requested_amount_ex_vat", as: "partial_requested_amount_ex_vat" }
    ];
    if (plan.operation === "aggregate") {
      const expected = approvedAmountMetrics.map((metric) => stableStringify(metric)).sort();
      const actual = plan.metrics.map((metric) => stableStringify({
        type: metric.type,
        field: metric.field ?? null,
        as: metric.as
      })).sort();
      if (stableStringify(actual) !== stableStringify(expected)) {
        errors.push("exceptions_report aggregate requires the fixed requested-amount coverage metrics");
      }
    } else if (plan.metrics.length) {
      errors.push("exceptions_report supports numeric metrics only for the fixed requested-amount coverage aggregate");
    }
  }
  if (table.tableName === "consultants_reports" && !DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    if (plan.operation === "group_count" && (plan.groupBy.length !== 1 || plan.groupBy[0] !== "item_status")) errors.push("consultants_reports group_count requires the approved stored item-status field");
    if (plan.operation !== "group_count" && plan.groupBy.length) errors.push(`consultants_reports operation ${plan.operation} does not accept group fields`);
    if (plan.select.length) errors.push(`consultants_reports operation ${plan.operation} does not accept selected output fields`);
    if (plan.orderBy.length) errors.push(`consultants_reports operation ${plan.operation} does not accept caller-defined ordering`);
    if (plan.metrics.length) errors.push("consultants_reports does not support numeric aggregate metrics");
  }
  for (const field of plan.groupBy || []) if (!groupable.has(field)) errors.push(`group field ${field} is not allowed`);
  for (const filter of plan.filters || []) {
    if (!allowed.has(filter.field)) errors.push(`filter field ${filter.field} is not allowed`);
    if (!FILTER_OPS.has(filter.op)) {
      errors.push(`filter op ${filter.op} is not allowed`);
    } else if (allowed.has(filter.field)) {
      const valueError = validateDataQueryFilterValue(fieldMap.get(filter.field), filter.op, filter.value);
      if (valueError) errors.push(`filter ${filter.field}: ${valueError}`);
      if (
        ["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(table.tableName) &&
        fieldMap.get(filter.field)?.runtimeScopeOnly === true &&
        filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true
      ) {
        errors.push(`${table.tableName} filter ${filter.field} is reserved for validated caller scope`);
      }
      if (table.tableName === "alerts" && filter.field === "is_relevant" && typeof filter.value !== "boolean") {
        errors.push("alerts relevance filter requires a boolean value");
      }
    }
  }
  for (const order of plan.orderBy || []) {
    const field = order.field;
    if (!allowed.has(field) && field !== "count" && !plan.metrics?.some((metric) => metric.as === field)) errors.push(`order field ${field} is not allowed`);
    if (!["asc", "desc"].includes(order.direction)) errors.push(`order direction ${order.direction || "missing"} is not allowed`);
  }
  for (const metric of plan.metrics || []) {
    if (!["count", "avg", "min", "max", "sum"].includes(metric.type)) errors.push(`metric ${metric.type} is not allowed`);
    if (metric.as && !/^[a-z][a-z0-9_]{0,62}$/i.test(metric.as)) errors.push(`metric alias ${metric.as} is invalid`);
    if (metric.type === "count" && metric.field) {
      const definition = fieldMap.get(metric.field);
      if (!definition || definition.queryable === false) errors.push(`metric count field ${metric.field} is not allowed`);
    } else if (metric.type !== "count") {
      const definition = fieldMap.get(metric.field);
      if (definition?.notComputableReason) {
        errors.push(`metric ${metric.type} is not computable for field ${metric.field}: ${definition.notComputableReason}`);
      } else if (!definition?.aggregations?.includes(metric.type)) {
        errors.push(`metric ${metric.type} is not allowed for field ${metric.field}`);
      }
    }
  }
  if (plan.operation === "distinct" && !(plan.select?.[0] || plan.groupBy?.[0])) errors.push("distinct requires one selected or group field");
  if (plan.operation === "top_n" && !plan.groupBy?.length) errors.push("top_n requires at least one group field");
  if (plan.operation === "timeseries") {
    const dateField = plan.dateField || plan.filters?.find((filter) => table.dateFields.includes(filter.field))?.field || table.defaultDateField;
    if (!table.dateFields.includes(dateField)) errors.push(`timeseries field ${dateField} is not a declared date field`);
    if (!["day", "month"].includes(plan.granularity || "day")) errors.push(`timeseries granularity ${plan.granularity} is not allowed`);
  }
  return errors;
}

export function dataQuerySupabaseHeaders(config, extra = {}) {
  const connection = contentSupabaseConfig(config);
  const accessToken = String(config?.dataQueryReadAccessToken || "").trim();
  if (!accessToken) {
    throw new Error("DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN is missing");
  }
  return {
    ...supabaseHeaders(connection.supabaseServiceRoleKey),
    Authorization: `Bearer ${accessToken}`,
    ...extra
  };
}

export async function resolveDataQuerySupabaseHeaders(
  config,
  extra = {},
  { fetchImpl = fetch, now = Date.now } = {}
) {
  const connection = contentSupabaseConfig(config);
  const accessToken = await getDataQueryAccessToken(config, { fetchImpl, now });
  return {
    ...supabaseHeaders(connection.supabaseServiceRoleKey),
    Authorization: `Bearer ${accessToken}`,
    ...extra
  };
}

export async function fetchExactPlan({ config, settings, plan, timeoutMs = settings.timeoutMsPerPlan, fetchImpl = fetch, now = Date.now }) {
  const connection = contentSupabaseConfig(config);
  const table = settings.manifest.find((item) => item.schemaAlias === plan.schema && item.tableName === plan.table);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) throw new Error(`${plan.schema} Supabase is not configured`);
  if (table?.exactTransport === DATA_QUERY_MANAGED_READ_TRANSPORT) {
    return fetchManagedPostgrestRead({ config, connection, table, plan, timeoutMs, fetchImpl, now });
  }
  if (!table?.exactRpc) throw new Error(`${plan.table} has no approved exact analytics transport`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    p_operation: plan.operation,
    p_filters: plan.filters || [],
    p_group_by: plan.groupBy || [],
    p_metrics: plan.metrics || [],
    p_select: plan.select || [],
    p_date_field: plan.dateField || table.defaultDateField || null,
    p_granularity: plan.granularity || "day",
    p_order_by: plan.orderBy || [],
    p_limit: plan.limit
  };
  const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(table.exactRpc)}`, {
    method: "POST",
    signal: controller.signal,
    headers: await resolveDataQuerySupabaseHeaders(
      config,
      { "Content-Type": "application/json" },
      { fetchImpl, now }
    ),
    body: JSON.stringify(body)
  }).finally(() => clearTimeout(timeout));
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || `Exact analytics request failed: ${response.status}`);
  return normalizeExactExecution(Array.isArray(data) && data.length === 1 ? data[0] : data, plan);
}

async function fetchManagedPostgrestRead({ config, connection, table, plan, timeoutMs, fetchImpl, now }) {
  const approvedTableName = dataQueryManagedReadTableName(table, plan);
  const normalizedPlan = normalizeManagedReadPlan(approvedTableName, plan);
  const effectivePlan = normalizedPlan.operation === "timeseries"
    ? {
        ...normalizedPlan,
        dateField: normalizedPlan.dateField || table.defaultDateField,
        granularity: normalizedPlan.granularity || "day"
      }
    : normalizedPlan;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = await resolveDataQuerySupabaseHeaders(
      config,
      { Accept: "application/json", Prefer: "count=exact" },
      { fetchImpl, now }
    );
    if (effectivePlan.operation === "count") {
      const response = await fetchManagedPostgrestPage({
        connection,
        tableName: approvedTableName,
        plan: effectivePlan,
        method: "HEAD",
        select: ["id"],
        limit: 1,
        offset: 0,
        headers,
        signal: controller.signal,
        fetchImpl
      });
      return normalizeExactExecution({
        operation: effectivePlan.operation,
        rows: [{ count: response.total }],
        cardinality: response.total,
        result_rows: 1,
        exactness: "exact",
        truncated: false,
        sampled: false
      }, effectivePlan);
    }
    if (DATA_QUERY_LOOKUP_OPERATIONS.has(effectivePlan.operation)) {
      const executionSelect = ["meetings", "exceptions_report", "consultants_reports"].includes(approvedTableName)
        ? [...new Set([...(effectivePlan.select || []), "project_id", "attachment_id"])]
        : effectivePlan.select;
      const response = await fetchManagedPostgrestPage({
        connection,
        tableName: approvedTableName,
        plan: effectivePlan,
        method: "GET",
        select: executionSelect,
        limit: effectivePlan.limit,
        offset: 0,
        headers,
        signal: controller.signal,
        fetchImpl
      });
      const normalizedRows = normalizeManagedReadRows(approvedTableName, response.rows);
      if (approvedTableName === "alerts") {
        attestAlertLookupRows(effectivePlan, normalizedRows, response.total);
      } else if (approvedTableName === "meetings") {
        attestMeetingLookupRows(effectivePlan, normalizedRows, response.total);
      } else if (approvedTableName === "emails") {
        attestEmailLookupRows(effectivePlan, normalizedRows, response.total);
      } else if (approvedTableName === "exceptions_report") {
        attestExceptionLookupRows(effectivePlan, normalizedRows, response.total);
      } else if (approvedTableName === "consultants_reports") {
        attestConsultantReportLookupRows(effectivePlan, normalizedRows, response.total);
      }
      const truncated = effectivePlan.allRequested === true && response.total > normalizedRows.length;
      return normalizeExactExecution({
        operation: effectivePlan.operation,
        rows: normalizedRows,
        cardinality: response.total,
        result_rows: response.rows.length,
        exactness: truncated ? "truncated" : "exact",
        truncated,
        sampled: false
      }, effectivePlan);
    }

    const scanPlan = {
      ...effectivePlan,
      orderBy: [{ field: "id", direction: "asc" }]
    };
    const select = [...new Set([
      ...dataQueryManagedReadFields(effectivePlan),
      "id",
      ...(approvedTableName === "alerts"
        ? ["data_date", "alert_type", "severity_level", "input_data_type", "item_status", "is_relevant"]
        : approvedTableName === "meetings"
          ? ["meeting_date", "status", "project_id", "attachment_id"]
          : approvedTableName === "emails"
            ? ["received_date", "mail_category", "direction", "has_attachments", "relevance_status", "item_status"]
          : approvedTableName === "exceptions_report"
            ? ["exception_date", "urgency_level", "item_status", "project_id", "attachment_id"]
          : approvedTableName === "consultants_reports"
            ? ["report_date", "item_status", "project_id", "attachment_id"]
          : [])
    ])];
    const pageSize = 1000;
    const maxRows = 5000;
    const rows = [];
    let total = null;
    for (let offset = 0; ; offset += pageSize) {
      const response = await fetchManagedPostgrestPage({
        connection,
        tableName: approvedTableName,
        plan: scanPlan,
        method: "GET",
        select,
        limit: pageSize,
        offset,
        headers,
        signal: controller.signal,
        fetchImpl
      });
      if (total !== null && response.total !== total) {
        throw new Error("not computable: managed read total changed during the complete scan");
      }
      total = response.total;
      if (total > maxRows) {
        throw new Error(`not computable: managed read scan exceeds ${maxRows} rows`);
      }
      if (!response.rows.length && rows.length < total) {
        throw new Error("not computable: managed read ended before the exact total was reached");
      }
      rows.push(...normalizeManagedReadRows(approvedTableName, response.rows));
      if (rows.length > total) {
        throw new Error("not computable: managed read returned more rows than its exact total");
      }
      if (rows.length >= total) break;
    }
    if (rows.length !== total) {
      throw new Error("not computable: managed read did not reconcile with its exact total");
    }
    if (["alerts", "meetings", "emails", "exceptions_report", "consultants_reports"].includes(approvedTableName)) {
      const stableIds = rows.map((row) => row?.id);
      if (stableIds.some((id) => id === null || id === undefined || id === "") || new Set(stableIds.map(String)).size !== stableIds.length) {
        throw new Error("not computable: managed read stable identities are missing or duplicated");
      }
    }
    return exactExecutionFromTrustedRows(effectivePlan, rows);
  } finally {
    clearTimeout(timeout);
  }
}

function attestMeetingLookupRows(plan, rows, total) {
  const expectedRows = Math.min(Number(total), Number(plan.limit));
  if (rows.length !== expectedRows) {
    throw new Error("not computable: meeting lookup did not return the expected bounded cardinality");
  }
  const ids = rows.map((row) => row?.id);
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new Error("not computable: meeting lookup stable identities are duplicated");
  }
  if (rows.some((row) => row?.meeting_date === null || row?.meeting_date === undefined || row?.meeting_date === "")) {
    throw new Error("not computable: meeting lookup returned an undated row");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (compareDataQueryLookupRows(rows[index - 1], rows[index], plan.orderBy) > 0) {
      throw new Error("not computable: meeting lookup rows violate the approved stable ordering");
    }
  }
}

function attestAlertLookupRows(plan, rows, total) {
  const expectedRows = Math.min(Number(total), Number(plan.limit));
  if (rows.length !== expectedRows) {
    throw new Error("not computable: alert lookup did not return the expected bounded cardinality");
  }
  const ids = rows.map((row) => row?.id);
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new Error("not computable: alert lookup stable identities are duplicated");
  }
  if (rows.some((row) => row?.data_date === null || row?.data_date === undefined || row?.data_date === "")) {
    throw new Error("not computable: alert lookup returned an undated row");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (compareDataQueryLookupRows(rows[index - 1], rows[index], plan.orderBy) > 0) {
      throw new Error("not computable: alert lookup rows violate the approved stable ordering");
    }
  }
}

function attestEmailLookupRows(plan, rows, total) {
  const expectedRows = Math.min(Number(total), Number(plan.limit));
  if (rows.length !== expectedRows) {
    throw new Error("not computable: email lookup did not return the expected bounded cardinality");
  }
  const ids = rows.map((row) => row?.id);
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new Error("not computable: email lookup stable identities are duplicated");
  }
  if (rows.some((row) => row?.received_date === null || row?.received_date === undefined || row?.received_date === "")) {
    throw new Error("not computable: email lookup returned a row without received_date");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (compareDataQueryLookupRows(rows[index - 1], rows[index], plan.orderBy) > 0) {
      throw new Error("not computable: email lookup rows violate the approved stable ordering");
    }
  }
}

function attestExceptionLookupRows(plan, rows, total) {
  const expectedRows = Math.min(Number(total), Number(plan.limit));
  if (rows.length !== expectedRows) {
    throw new Error("not computable: exception lookup did not return the expected bounded cardinality");
  }
  const ids = rows.map((row) => row?.id);
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new Error("not computable: exception lookup stable identities are duplicated");
  }
  if (rows.some((row) => row?.exception_date === null || row?.exception_date === undefined || row?.exception_date === "")) {
    throw new Error("not computable: exception lookup returned an undated row");
  }
  for (let index = 1; index < rows.length; index += 1) {
    if (compareDataQueryLookupRows(rows[index - 1], rows[index], plan.orderBy) > 0) {
      throw new Error("not computable: exception lookup rows violate the approved stable ordering");
    }
  }
}

function attestConsultantReportLookupRows(plan, rows, total) {
  const expectedRows = Math.min(Number(total), Number(plan.limit));
  if (rows.length !== expectedRows) throw new Error("not computable: consultant-report lookup did not return the expected bounded cardinality");
  const ids = rows.map((row) => row?.id);
  if (new Set(ids.map(String)).size !== ids.length) throw new Error("not computable: consultant-report stable identities are duplicated");
  if (rows.some((row) => row?.report_date === null || row?.report_date === undefined || row?.report_date === "")) throw new Error("not computable: consultant-report lookup returned an undated row");
  for (let index = 1; index < rows.length; index += 1) {
    if (compareDataQueryLookupRows(rows[index - 1], rows[index], plan.orderBy) > 0) throw new Error("not computable: consultant-report lookup rows violate the approved stable ordering");
  }
}

async function fetchManagedPostgrestPage({
  connection,
  tableName,
  plan,
  method,
  select,
  limit,
  offset,
  headers,
  signal,
  fetchImpl
}) {
  if (!["GET", "HEAD"].includes(method)) throw new Error("Managed PostgREST transport is read-only");
  if (!DATA_QUERY_MANAGED_READ_TABLES.has(tableName)) {
    throw new Error("Managed PostgREST table is not approved");
  }
  const params = new URLSearchParams();
  params.set("select", [...new Set((select || []).filter(Boolean))].join(","));
  for (const filter of plan.filters || []) {
    params.append(filter.field, dataQueryPostgrestFilter(filter));
  }
  if (DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    if (tableName === "safety_reports") params.append("report_date", "not.is.null");
    if (tableName === "alerts") params.append("data_date", "not.is.null");
    if (tableName === "meetings") params.append("meeting_date", "not.is.null");
    if (tableName === "emails") params.append("received_date", "not.is.null");
    if (tableName === "exceptions_report") params.append("exception_date", "not.is.null");
    if (tableName === "consultants_reports") params.append("report_date", "not.is.null");
  }
  if (plan.orderBy?.length) {
    params.set("order", plan.orderBy.map((order) =>
      `${order.field}.${order.direction === "asc" ? "asc" : "desc"}.nullslast`
    ).join(","));
  }
  params.set("limit", String(limit));
  if (offset > 0) params.set("offset", String(offset));
  const fixedPath = DATA_QUERY_MANAGED_READ_PATHS.get(tableName);
  if (!fixedPath) throw new Error("Managed PostgREST table path is not approved");
  const response = await fetchImpl(
    `${connection.supabaseUrl}/rest/v1/${fixedPath}?${params.toString()}`,
    { method, signal, headers }
  );
  const text = method === "HEAD" ? "" : await response.text();
  let data = [];
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Managed PostgREST read returned invalid JSON");
    }
  }
  if (!response.ok) {
    throw new Error(`Managed PostgREST read failed with status ${response.status}`);
  }
  if (method === "GET" && !Array.isArray(data)) {
    throw new Error("Managed PostgREST read returned an invalid row payload");
  }
  const total = dataQueryContentRangeTotal(response.headers);
  if (total === null) {
    throw new Error("Managed PostgREST read is missing the exact Content-Range total");
  }
  return { rows: method === "GET" ? data : [], total };
}

function dataQueryManagedReadTableName(table, plan) {
  const tableName = String(table?.tableName || "");
  const fixedPath = DATA_QUERY_MANAGED_READ_PATHS.get(tableName);
  const matchesReviewedContract = Boolean(
    fixedPath &&
    table?.executionContract?.table === tableName &&
    plan?.table === tableName
  );
  if (
    table?.exactTransport !== DATA_QUERY_MANAGED_READ_TRANSPORT ||
    plan?.schema !== "content" ||
    !matchesReviewedContract
  ) {
    if (DATA_QUERY_MANAGED_READ_TABLES.has(String(table?.executionContract?.table || ""))) {
      throw new Error(`Managed PostgREST reads are approved only for content.${table.executionContract.table}`);
    }
    throw new Error("Managed PostgREST reads are approved only for reviewed Content table contracts");
  }
  return tableName;
}

function normalizeManagedReadPlan(tableName, plan) {
  if (tableName === "financial_transactions") {
    const allowedTypes = new Set(DATA_QUERY_FINANCIAL_TRANSACTION_TYPE_VALUES);
    const typeFilters = (plan.filters || []).filter((filter) => filter.field === "transaction_type");
    for (const filter of typeFilters) {
      const values = filter.op === "in" ? filter.value : [filter.value];
      if (
        !["eq", "in"].includes(filter.op) ||
        !Array.isArray(values) ||
        !values.length ||
        values.some((value) => !allowedTypes.has(value))
      ) {
        throw new Error("Financial transaction type filter is outside the approved vocabulary");
      }
    }
    if (plan.allRequested === true && typeFilters.length !== 1) {
      throw new Error("Complete financial lists require one approved transaction-type predicate");
    }
    return { ...plan, filters: (plan.filters || []).map((filter) => ({ ...filter })) };
  }
  if (tableName === "emails") {
    assertEmailManagedReadPlan(plan);
    return { ...plan, filters: (plan.filters || []).map((filter) => ({ ...filter })) };
  }
  if (tableName === "exceptions_report") {
    assertExceptionManagedReadPlan(plan);
    return { ...plan, filters: (plan.filters || []).map((filter) => ({ ...filter })) };
  }
  if (tableName === "consultants_reports") {
    assertConsultantReportManagedReadPlan(plan);
    return { ...plan, filters: (plan.filters || []).map((filter) => ({ ...filter })) };
  }
  if (tableName === "alerts") {
    const filters = (plan.filters || []).map((filter) => {
      if (filter.field === "alert_type" && filter.op !== "is") {
        const values = filter.op === "in" ? filter.value : [filter.value];
        const canonical = (Array.isArray(values) ? values : []).map(canonicalizeDataQueryAlertType);
        if (!canonical.length || canonical.some((value) => !value)) {
          throw new Error("Alert type filter is outside the approved vocabulary");
        }
        return filter.op === "in"
          ? { ...filter, value: [...new Set(canonical)] }
          : { ...filter, value: canonical[0] };
      }
      if (filter.field === "input_data_type" && filter.op !== "is") {
        const values = filter.op === "in" ? filter.value : [filter.value];
        const canonical = (Array.isArray(values) ? values : []).map(canonicalizeDataQueryAlertInputType);
        if (!canonical.length || canonical.some((value) => !value)) {
          throw new Error("Alert input type filter is outside the approved vocabulary");
        }
        return filter.op === "in"
          ? { ...filter, value: [...new Set(canonical)] }
          : { ...filter, value: canonical[0] };
      }
      return { ...filter };
    });
    return { ...plan, filters };
  }
  if (tableName !== "safety_reports") return plan;
  const filters = (plan.filters || []).flatMap((filter) => {
    if (filter.field !== "risk_level" || filter.op === "is") return [{ ...filter }];
    const requested = filter.op === "in" ? filter.value : [filter.value];
    const rawValues = [...new Set(
      (Array.isArray(requested) ? requested : [])
        .flatMap((value) => dataQuerySafetyRiskRawValues(value))
    )];
    if (!rawValues.length) {
      throw new Error("Safety risk filter is outside the approved canonical vocabulary");
    }
    return [{ field: "risk_level", op: "in", value: rawValues }];
  });
  return { ...plan, filters };
}

function assertEmailManagedReadPlan(plan) {
  const approvedFields = new Set([
    "id",
    "received_date",
    "mail_category",
    "direction",
    "has_attachments",
    "relevance_status",
    "item_status"
  ]);
  const planFields = [
    ...(plan.select || []),
    ...(plan.groupBy || []),
    ...(plan.metrics || []).map((metric) => metric.field).filter(Boolean),
    ...(plan.orderBy || []).map((order) => order.field).filter(Boolean),
    plan.dateField
  ].filter(Boolean);
  if (planFields.some((field) => !approvedFields.has(field))) {
    throw new Error("Email managed read requested a field outside the PII-safe metadata projection");
  }
  for (const filter of plan.filters || []) {
    if (filter.field === "project_id") {
      if (filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true) {
        throw new Error("Email project scope must come from validated caller scope");
      }
      continue;
    }
    if (!approvedFields.has(filter.field)) {
      throw new Error("Email managed read requested an unapproved filter field");
    }
  }
  const relevanceFilters = (plan.filters || []).filter((filter) => filter.field === "relevance_status");
  const approvedRelevance = relevanceFilters.length === 1 &&
    relevanceFilters[0].op === "in" &&
    stableStringify([...(relevanceFilters[0].value || [])].sort()) === stableStringify([...DATA_QUERY_EMAIL_RELEVANCE_VALUES].sort());
  const approvedNoClearCount = plan.operation === "count" &&
    relevanceFilters.length === 1 &&
    relevanceFilters[0].op === "eq" &&
    relevanceFilters[0].value === DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE;
  if (!approvedRelevance && !approvedNoClearCount) {
    throw new Error("Email managed read requires the fixed project-related predicate or the count-only no-clear-project predicate");
  }
}

function assertExceptionManagedReadPlan(plan) {
  const approvedMetadataFields = new Set(["id", "exception_date", "urgency_level", "item_status"]);
  const approvedMetricFields = new Set(["requested_amount_ex_vat"]);
  const internalExecutionFields = new Set(["project_id", "attachment_id"]);
  const projectionFields = [
    ...(plan.select || []),
    ...(plan.groupBy || []),
    ...(plan.orderBy || []).map((order) => order.field).filter(Boolean),
    plan.dateField
  ].filter(Boolean);
  const metricFields = (plan.metrics || []).map((metric) => metric.field).filter(Boolean);
  if (projectionFields.some((field) => !approvedMetadataFields.has(field))) {
    throw new Error("Exception managed read requested a field outside the approved metadata projection");
  }
  if (metricFields.some((field) => !approvedMetricFields.has(field))) {
    throw new Error("Exception managed read requested an unapproved aggregate field");
  }
  for (const filter of plan.filters || []) {
    if (filter.field === "project_id") {
      if (filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true) {
        throw new Error("Exception project scope must come from validated caller scope");
      }
      continue;
    }
    if (!approvedMetadataFields.has(filter.field) || internalExecutionFields.has(filter.field)) {
      throw new Error("Exception managed read requested an unapproved filter field");
    }
  }
}

function assertConsultantReportManagedReadPlan(plan) {
  const approvedMetadataFields = new Set(["id", "report_date", "item_status"]);
  const projectionFields = [
    ...(plan.select || []), ...(plan.groupBy || []),
    ...(plan.orderBy || []).map((order) => order.field).filter(Boolean), plan.dateField
  ].filter(Boolean);
  if (projectionFields.some((field) => !approvedMetadataFields.has(field))) throw new Error("Consultant-report managed read requested a field outside the approved metadata projection");
  if ((plan.metrics || []).some((metric) => metric.field)) throw new Error("Consultant-report managed read does not support numeric aggregate fields");
  for (const filter of plan.filters || []) {
    if (filter.field === "project_id") {
      if (filter[DATA_QUERY_CALLER_SCOPE_FILTER] !== true) throw new Error("Consultant-report project scope must come from validated caller scope");
      continue;
    }
    if (!approvedMetadataFields.has(filter.field)) throw new Error("Consultant-report managed read requested an unapproved filter field");
  }
}

function normalizeManagedReadRows(tableName, rows) {
  if (tableName === "alerts") {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const validId = Object.prototype.hasOwnProperty.call(row || {}, "id") &&
        /^\d+$/.test(String(row.id)) &&
        Number(row.id) > 0;
      const validAlertType = Object.prototype.hasOwnProperty.call(row || {}, "alert_type") &&
        DATA_QUERY_ALERT_TYPE_VALUES.includes(row.alert_type);
      const validInputType = Object.prototype.hasOwnProperty.call(row || {}, "input_data_type") &&
        DATA_QUERY_ALERT_INPUT_TYPE_VALUES.includes(row.input_data_type);
      const validSeverity = Object.prototype.hasOwnProperty.call(row || {}, "severity_level") &&
        typeof row.severity_level === "number" &&
        row.severity_level === DATA_QUERY_ALERT_SEVERITY_LEVEL;
      const validStatus = Object.prototype.hasOwnProperty.call(row || {}, "item_status") &&
        row.item_status === DATA_QUERY_ALERT_ITEM_STATUS;
      const validRelevance = Object.prototype.hasOwnProperty.call(row || {}, "is_relevant") &&
        typeof row.is_relevant === "boolean";
      const hasDate = Object.prototype.hasOwnProperty.call(row || {}, "data_date");
      const validDate = hasDate && (
        row.data_date === null || row.data_date === "" || !Number.isNaN(Date.parse(String(row.data_date)))
      );
      if (!validId || !validAlertType || !validInputType || !validSeverity || !validStatus || !validRelevance || !validDate) {
        throw new Error("Alert row is outside the approved typed vocabulary");
      }
      return { ...row };
    });
  }
  if (tableName === "meetings") {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const validId = Object.prototype.hasOwnProperty.call(row || {}, "id") &&
        /^\d+$/.test(String(row.id)) &&
        Number(row.id) > 0;
      const normalizedProjectId = typeof row?.project_id === "string"
        ? row.project_id.trim().toLowerCase()
        : "";
      const validProjectId = Object.prototype.hasOwnProperty.call(row || {}, "project_id") &&
        DATA_QUERY_PROJECT_UUID_PATTERN.test(normalizedProjectId);
      const normalizedAttachmentId = typeof row?.attachment_id === "string"
        ? row.attachment_id.trim()
        : "";
      const validAttachmentId = Object.prototype.hasOwnProperty.call(row || {}, "attachment_id") &&
        normalizedAttachmentId.length > 0 &&
        normalizedAttachmentId.length <= DATA_QUERY_MAX_ATTACHMENT_ID_LENGTH &&
        !DATA_QUERY_UNSAFE_IDENTITY_CHARACTERS.test(normalizedAttachmentId);
      const hasMeetingDate = Object.prototype.hasOwnProperty.call(row || {}, "meeting_date");
      const validMeetingDate = hasMeetingDate &&
        row.meeting_date !== null &&
        row.meeting_date !== "" &&
        !Number.isNaN(Date.parse(String(row.meeting_date)));
      const validStatus = Object.prototype.hasOwnProperty.call(row || {}, "status") &&
        DATA_QUERY_MEETING_STATUS_VALUES.includes(row.status);
      if (!validId || !validProjectId || !validAttachmentId || !validMeetingDate || !validStatus) {
        throw new Error("Meeting row is outside the approved typed vocabulary");
      }
      return {
        ...row,
        project_id: normalizedProjectId,
        attachment_id: normalizedAttachmentId
      };
    });
  }
  if (tableName === "emails") {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const validId = Object.prototype.hasOwnProperty.call(row || {}, "id") &&
        /^\d+$/.test(String(row.id)) &&
        Number(row.id) > 0;
      const validDate = Object.prototype.hasOwnProperty.call(row || {}, "received_date") &&
        row.received_date !== null &&
        row.received_date !== "" &&
        !Number.isNaN(Date.parse(String(row.received_date)));
      const validDirection = Object.prototype.hasOwnProperty.call(row || {}, "direction") &&
        DATA_QUERY_EMAIL_DIRECTION_VALUES.includes(row.direction);
      const validCategory = Object.prototype.hasOwnProperty.call(row || {}, "mail_category") &&
        DATA_QUERY_EMAIL_CATEGORY_VALUES.includes(row.mail_category);
      const validAttachmentState = Object.prototype.hasOwnProperty.call(row || {}, "has_attachments") &&
        typeof row.has_attachments === "boolean";
      const validRelevance = Object.prototype.hasOwnProperty.call(row || {}, "relevance_status") &&
        DATA_QUERY_EMAIL_RELEVANCE_VALUES.includes(row.relevance_status);
      const validStatus = Object.prototype.hasOwnProperty.call(row || {}, "item_status") &&
        row.item_status === DATA_QUERY_EMAIL_ITEM_STATUS;
      if (!validId || !validDate || !validDirection || !validCategory || !validAttachmentState || !validRelevance || !validStatus) {
        throw new Error("Email row is outside the approved typed project-related vocabulary");
      }
      return { ...row };
    });
  }
  if (tableName === "exceptions_report") {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const validId = Object.prototype.hasOwnProperty.call(row || {}, "id") && /^\d+$/.test(String(row.id)) && Number(row.id) > 0;
      const normalizedProjectId = typeof row?.project_id === "string" ? row.project_id.trim().toLowerCase() : "";
      const projectPresent = Object.prototype.hasOwnProperty.call(row || {}, "project_id");
      const validProjectId = !projectPresent || DATA_QUERY_PROJECT_UUID_PATTERN.test(normalizedProjectId);
      const normalizedAttachmentId = typeof row?.attachment_id === "string" ? row.attachment_id.trim() : "";
      const attachmentPresent = Object.prototype.hasOwnProperty.call(row || {}, "attachment_id");
      const validAttachmentId = !attachmentPresent || (
        normalizedAttachmentId.length > 0 &&
        normalizedAttachmentId.length <= DATA_QUERY_MAX_ATTACHMENT_ID_LENGTH &&
        !DATA_QUERY_UNSAFE_IDENTITY_CHARACTERS.test(normalizedAttachmentId)
      );
      const hasDate = Object.prototype.hasOwnProperty.call(row || {}, "exception_date");
      const validDate = hasDate && (row.exception_date === null || row.exception_date === "" || !Number.isNaN(Date.parse(String(row.exception_date))));
      const validUrgency = Object.prototype.hasOwnProperty.call(row || {}, "urgency_level") && DATA_QUERY_EXCEPTION_URGENCY_VALUES.includes(row.urgency_level);
      const validStatus = Object.prototype.hasOwnProperty.call(row || {}, "item_status") && DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES.includes(row.item_status);
      const amountPresent = Object.prototype.hasOwnProperty.call(row || {}, "requested_amount_ex_vat");
      const amountValue = row?.requested_amount_ex_vat;
      const validAmount = !amountPresent || amountValue === null || amountValue === "" || (Number.isFinite(Number(amountValue)) && Number(amountValue) >= 0);
      if (!validId || !validProjectId || !validAttachmentId || !validDate || !validUrgency || !validStatus || !validAmount) {
        throw new Error("Exception row is outside the approved typed vocabulary");
      }
      return {
        ...row,
        ...(projectPresent ? { project_id: normalizedProjectId } : {}),
        ...(attachmentPresent ? { attachment_id: normalizedAttachmentId } : {})
      };
    });
  }
  if (tableName === "consultants_reports") {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      const validId = Object.prototype.hasOwnProperty.call(row || {}, "id") && /^\d+$/.test(String(row.id)) && Number(row.id) > 0;
      const normalizedProjectId = typeof row?.project_id === "string" ? row.project_id.trim().toLowerCase() : "";
      const projectPresent = Object.prototype.hasOwnProperty.call(row || {}, "project_id");
      const validProjectId = !projectPresent || DATA_QUERY_PROJECT_UUID_PATTERN.test(normalizedProjectId);
      const normalizedAttachmentId = typeof row?.attachment_id === "string" ? row.attachment_id.trim() : "";
      const attachmentPresent = Object.prototype.hasOwnProperty.call(row || {}, "attachment_id");
      const validAttachmentId = !attachmentPresent || (normalizedAttachmentId.length > 0 && normalizedAttachmentId.length <= DATA_QUERY_MAX_ATTACHMENT_ID_LENGTH && !DATA_QUERY_UNSAFE_IDENTITY_CHARACTERS.test(normalizedAttachmentId));
      const hasDate = Object.prototype.hasOwnProperty.call(row || {}, "report_date");
      const validDate = hasDate && (row.report_date === null || row.report_date === "" || !Number.isNaN(Date.parse(String(row.report_date))));
      const validStatus = Object.prototype.hasOwnProperty.call(row || {}, "item_status") && DATA_QUERY_CONSULTANT_REPORT_ITEM_STATUS_VALUES.includes(row.item_status);
      if (!validId || !validProjectId || !validAttachmentId || !validDate || !validStatus) throw new Error("Consultant-report row is outside the approved typed vocabulary");
      return { ...row, ...(projectPresent ? { project_id: normalizedProjectId } : {}), ...(attachmentPresent ? { attachment_id: normalizedAttachmentId } : {}) };
    });
  }
  if (tableName !== "safety_reports") return rows;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row || {}, "risk_level")) return row;
    return {
      ...row,
      risk_level: canonicalizeDataQuerySafetyRisk(row.risk_level) || "unknown"
    };
  });
}

function dataQueryManagedReadFields(plan) {
  const fields = [
    ...(plan.select || []),
    ...(plan.groupBy || []),
    ...(plan.metrics || []).map((metric) => metric.field).filter(Boolean),
    plan.dateField
  ].filter(Boolean);
  return [...new Set(fields.length ? fields : ["id"])];
}

function dataQueryPostgrestFilter(filter) {
  if (!FILTER_OPS.has(filter.op)) throw new Error(`PostgREST filter op ${filter.op} is not allowed`);
  if (filter.op === "in") {
    const values = (filter.value || []).map((value) => dataQueryPostgrestScalar(value, true));
    return `in.(${values.join(",")})`;
  }
  return `${filter.op}.${dataQueryPostgrestScalar(filter.value, false)}`;
}

function dataQueryPostgrestScalar(value, quoteSpecial) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  const text = String(value);
  if (quoteSpecial && /[\s,"()]/.test(text)) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return text;
}

function dataQueryContentRangeTotal(headers) {
  const value = typeof headers?.get === "function" ? headers.get("content-range") : null;
  const match = String(value || "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function derivePlanRows(plan, rows = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const lookupDateField = plan.table === "safety_reports"
    ? "report_date"
    : plan.table === "alerts"
      ? "data_date"
    : plan.table === "meetings"
      ? "meeting_date"
      : plan.table === "emails"
        ? "received_date"
      : plan.table === "exceptions_report"
        ? "exception_date"
      : plan.table === "consultants_reports"
        ? "report_date"
      : null;
  const data = lookupDateField && DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)
    ? sourceRows.filter((row) => row?.[lookupDateField] !== null && row?.[lookupDateField] !== undefined && row?.[lookupDateField] !== "")
    : sourceRows;
  if (DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    const executionSelect = [
      ...(plan.select || []),
      ...(["meetings", "exceptions_report", "consultants_reports"].includes(plan.table) ? ["project_id", "attachment_id"] : [])
    ];
    return [...data]
      .sort((left, right) => compareDataQueryLookupRows(left, right, plan.orderBy))
      .map((row) => Object.fromEntries(
        [...new Set(executionSelect)]
          .filter((field) => Object.prototype.hasOwnProperty.call(row, field))
          .map((field) => [field, row[field]])
      ));
  }
  if (plan.operation === "count") return [{ count: data.length }];
  if (plan.operation === "distinct") {
    const field = plan.select?.[0] || plan.groupBy?.[0];
    return [...new Set(data.map((row) => row[field]).filter((value) => value !== null && value !== undefined))]
      .map((value) => ({ [field]: value }));
  }
  if (plan.operation === "top_n") {
    return data.slice(0, plan.limit);
  }
  if (plan.operation === "group_count") {
    return groupRows(data, plan.groupBy, (items) => ({ count: items.length }));
  }
  if (plan.operation === "aggregate") {
    const aggregate = (items) => Object.fromEntries((plan.metrics || [{ type: "count", as: "count" }]).map((metric) => [metric.as || metric.type, computeMetric(metric, items)]));
    return plan.groupBy?.length ? groupRows(data, plan.groupBy, aggregate) : [aggregate(data)];
  }
  if (plan.operation === "timeseries") {
    const dateField = plan.dateField || plan.filters?.[0]?.field || "created_at";
    const grouped = groupRows(data.map((row) => ({
      ...row,
      period: row?.[dateField] === null || row?.[dateField] === undefined || row?.[dateField] === ""
        ? "undated"
        : dataQueryUtcCalendarPeriod(row[dateField], plan.granularity)
    })), ["period"], (items) => ({ count: items.length }));
    if (["alerts", "exceptions_report", "consultants_reports"].includes(plan.table)) {
      if (!grouped.some((row) => row.period === "undated")) grouped.push({ period: "undated", count: 0 });
      grouped.sort((left, right) => {
        if (left.period === "undated") return 1;
        if (right.period === "undated") return -1;
        return String(left.period).localeCompare(String(right.period));
      });
    }
    return grouped;
  }
  return data;
}

function dataQueryUtcCalendarPeriod(value, granularity = "day") {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("not computable: canonical date could not be normalized to UTC");
  }
  return parsed.toISOString().slice(0, granularity === "month" ? 7 : 10);
}

function compareDataQueryLookupRows(left, right, orderBy = []) {
  for (const order of orderBy) {
    const leftValue = left?.[order.field];
    const rightValue = right?.[order.field];
    const leftNull = leftValue === null || leftValue === undefined || leftValue === "";
    const rightNull = rightValue === null || rightValue === undefined || rightValue === "";
    if (leftNull || rightNull) {
      if (leftNull && rightNull) continue;
      return leftNull ? 1 : -1;
    }
    const comparison = compareDataQueryValues(leftValue, rightValue);
    if (comparison !== 0) return order.direction === "asc" ? comparison : -comparison;
  }
  return 0;
}

function compareDataQueryValues(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  const leftDate = Date.parse(String(left));
  const rightDate = Date.parse(String(right));
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate;
  return String(left).localeCompare(String(right), "en", { numeric: true, sensitivity: "base" });
}

export function normalizeExactExecution(payload, plan = {}) {
  if (!payload || typeof payload !== "object") throw new Error("Exact analytics RPC returned an invalid payload");
  const payloadOperation = String(payload.operation || "").trim();
  if (!payloadOperation) {
    throw new Error("Exact analytics RPC response is missing its operation attestation");
  }
  if (plan.operation && payloadOperation !== plan.operation) {
    throw new Error(`Exact analytics RPC operation mismatch: expected ${plan.operation}, received ${payloadOperation}`);
  }
  if (payload.exactness === "not_computable") {
    throw new Error("Exact analytics RPC reported that the plan is not computable");
  }
  if (!["exact", "truncated", "sampled"].includes(payload.exactness)) {
    throw new Error("Exact analytics RPC returned invalid exactness");
  }
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  const maxRows = Number.isInteger(Number(plan.limit)) && Number(plan.limit) > 0 ? Number(plan.limit) : rawRows.length;
  const rows = rawRows.slice(0, maxRows);
  const exactness = payload.exactness;
  const cardinality = payload.cardinality === null || payload.cardinality === undefined
    ? null
    : Number(payload.cardinality);
  if (cardinality !== null && (!Number.isFinite(cardinality) || cardinality < 0)) throw new Error("Exact analytics RPC returned invalid cardinality");
  return {
    rows,
    cardinality,
    resultRows: DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)
      ? rows.length
      : Number.isFinite(Number(payload.result_rows)) ? Number(payload.result_rows) : rows.length,
    exactness,
    truncated: payload.truncated === true || exactness === "truncated",
    sampled: payload.sampled === true || exactness === "sampled",
    operation: payloadOperation
  };
}

function exactExecutionFromTrustedRows(plan, rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const derived = derivePlanRows(plan, sourceRows);
  if (DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation)) {
    const bounded = derived.slice(0, plan.limit);
    const truncated = plan.allRequested === true && sourceRows.length > bounded.length;
    return {
      rows: bounded,
      cardinality: sourceRows.length,
      resultRows: bounded.length,
      exactness: truncated ? "truncated" : "exact",
      truncated,
      sampled: false,
      operation: plan.operation
    };
  }
  const truncated = derived.length > plan.limit;
  return {
    rows: derived.slice(0, plan.limit),
    cardinality: sourceRows.length,
    resultRows: derived.length,
    exactness: truncated ? "truncated" : "exact",
    truncated,
    sampled: false,
    operation: plan.operation
  };
}

function failedPlanResult(plan, error, summary = "Plan failed.") {
  return {
    id: plan.id,
    requestId: plan.requestId || null,
    operation: plan.operation,
    table: plan.table,
    status: "error",
    rows: [],
    cardinality: null,
    resultRows: 0,
    exactness: /not computable/i.test(error) ? "not_computable" : null,
    truncated: false,
    sampled: false,
    provenance: planProvenance(plan),
    summary,
    error
  };
}

function planProvenance(plan, execution = {}) {
  const filters = (plan.filters || []).map((filter) => ({ field: filter.field, op: filter.op }));
  const filterSignature = createHash("sha256").update(JSON.stringify(plan.filters || [])).digest("hex").slice(0, 16);
  return {
    connection: "content",
    schema: "public",
    table: plan.table,
    requestId: plan.requestId || null,
    operation: plan.operation,
    filters,
    filterSignature,
    select: plan.select || [],
    groupBy: plan.groupBy || [],
    metricDefinitions: (plan.metrics || []).map((metric) => ({ type: metric.type, field: metric.field || null, as: metric.as || metric.type })),
    cardinality: execution.cardinality ?? null,
    exactness: execution.exactness || null
  };
}

function groupRows(rows, fields = [], reducer) {
  const groupFields = fields.length ? fields : ["_all"];
  const groups = new Map();
  for (const row of rows) {
    const key = groupFields.map((field) => field === "_all" ? "all" : String(row[field] ?? "unknown")).join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, items]) => ({
    ...Object.fromEntries(groupFields.map((field, index) => [field, key.split("|")[index]]).filter(([field]) => field !== "_all")),
    ...reducer(items)
  }));
}

function computeMetric(metric, rows) {
  if (metric.type === "count") {
    return metric.field
      ? rows.filter((row) => row?.[metric.field] !== null && row?.[metric.field] !== undefined && row?.[metric.field] !== "").length
      : rows.length;
  }
  const values = rows.map((row) => Number(row[metric.field])).filter(Number.isFinite);
  if (metric.type === "sum" && rows.length === 0) return 0;
  if (!values.length) return null;
  if (metric.type === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (metric.type === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (metric.type === "min") return Math.min(...values);
  if (metric.type === "max") return Math.max(...values);
  return null;
}

function synthesizeDataQueryAnswer({ planResults = [], warnings = [] }) {
  const metrics = buildDataQueryMetrics(planResults);
  const ok = planResults.filter((item) => item.status === "ok");
  const failed = planResults.filter((item) => item.status !== "ok");
  const lookupRecords = ok
    .filter((item) => DATA_QUERY_LOOKUP_OPERATIONS.has(item.operation))
    .reduce((sum, item) => sum + item.rows.length, 0);
  const preview = metrics.slice(0, 6).map((metric) => `${metric.label}: ${formatMetricValue(metric.value)} (${metric.exactness})`).join("; ");
  const answer = metrics.length
    ? `${preview}${metrics.length > 6 ? `; and ${metrics.length - 6} more metric(s)` : ""}.`
    : lookupRecords
      ? `Data Query Agent returned ${lookupRecords} structured lookup record(s) in the machine result.`
    : ok.length
      ? `Data Query Agent returned ${ok.reduce((sum, item) => sum + item.rows.length, 0)} result row(s); no scalar metric was requested.`
      : "Data Query Agent could not execute an approved plan.";
  return {
    answer: failed.length || warnings.length ? `${answer} Warnings: ${[...warnings, ...failed.map((item) => item.error)].filter(Boolean).join("; ")}` : answer,
    metrics,
    confidence: ok.length ? 0.72 : 0.2
  };
}

export function buildDataQueryMetrics(planResults = []) {
  const metrics = [];
  for (const result of planResults) {
    if (result.status !== "ok") continue;
    const provenance = result.provenance || {};
    const groupFields = provenance.groupBy || [];
    if (result.operation === "count") {
      metrics.push(metricRecord(result, "count", result.rows[0]?.count ?? 0, {}));
      continue;
    }
    if (["group_count", "top_n", "timeseries"].includes(result.operation)) {
      for (const row of result.rows) {
        const group = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "count"));
        metrics.push(metricRecord(result, "count", row.count ?? 0, group));
      }
      continue;
    }
    if (result.operation === "distinct") {
      const field = groupFields[0] || provenance.select?.[0] || "value";
      metrics.push(metricRecord(result, `distinct_${field}`, result.resultRows ?? result.rows.length, {}));
      continue;
    }
    if (result.operation === "aggregate") {
      const definitions = provenance.metricDefinitions?.length ? provenance.metricDefinitions : [{ type: "count", field: null, as: "count" }];
      for (const row of result.rows) {
        const group = Object.fromEntries(groupFields.map((field) => [field, row[field]]));
        for (const definition of definitions) {
          metrics.push(metricRecord(result, definition.as, row[definition.as], group, definition));
        }
      }
    }
  }
  return metrics;
}

export function buildDataQueryMachineResult({ requestedMetrics = [], planResults = [], metrics = [], caller = null } = {}) {
  const requested = normalizeStringList(requestedMetrics);
  const keys = requested.length
    ? requested
    : [...new Set(planResults.map((plan) => plan.requestId || plan.id).filter(Boolean))];
  const metricsByRequestId = {};
  const recordsByRequestId = {};
  const planStatusByRequestId = {};

  keys.forEach((requestId, index) => {
    const explicit = planResults.filter((plan) => plan.requestId === requestId || plan.id === requestId);
    const fallback = explicit.length ? explicit : (requested.length && planResults[index] ? [planResults[index]] : []);
    const planIds = new Set(fallback.map((plan) => plan.id));
    metricsByRequestId[requestId] = metrics
      .filter((metric) => planIds.has(metric.planId))
      .map((metric) => ({ ...metric }));
    recordsByRequestId[requestId] = fallback
      .filter((plan) => plan.status === "ok" && DATA_QUERY_LOOKUP_OPERATIONS.has(plan.operation))
      .flatMap((plan) => {
        const selected = new Set([
          ...(plan.provenance?.select || []),
          ...(["meetings", "exceptions_report", "consultants_reports"].includes(plan.table) ? ["project_id", "attachment_id"] : [])
        ]);
        return (plan.rows || []).map((row, index) => ({
          id: `${requestId}__${plan.id}__record_${index + 1}`,
          planId: plan.id,
          requestId,
          operation: plan.operation,
          ordinal: index + 1,
          exactness: plan.exactness || null,
          source: {
            connection: "content",
            schema: "public",
            table: plan.table
          },
          record: Object.fromEntries(
            Object.entries(row || {})
              .filter(([field]) =>
                selected.has(field) &&
                !(["alerts"].includes(plan.table) && ["id", "project_id"].includes(field))
              )
              .map(([field, value]) => [field, cloneDataQueryValue(value)])
          )
        }));
      });
    planStatusByRequestId[requestId] = fallback.map((plan) => ({
      planId: plan.id,
      status: plan.status,
      exactness: plan.exactness || null,
      cardinality: plan.cardinality ?? null,
      truncated: plan.truncated === true,
      sampled: plan.sampled === true,
      cacheHit: plan.cacheHit === true
    }));
  });

  return {
    contractVersion: DATA_QUERY_CONTRACT_VERSION,
    source: caller?.source || "api",
    requestedMetrics: requested,
    metricsByRequestId,
    recordsByRequestId,
    planStatusByRequestId
  };
}

export function summarizeDataQueryMachineResultForWorkflow(machineResult = {}) {
  const metricsByRequestId = machineResult.metricsByRequestId && typeof machineResult.metricsByRequestId === "object"
    ? machineResult.metricsByRequestId
    : {};
  const recordsByRequestId = machineResult.recordsByRequestId && typeof machineResult.recordsByRequestId === "object"
    ? machineResult.recordsByRequestId
    : {};
  const planStatuses = Object.values(machineResult.planStatusByRequestId || {})
    .flatMap((statuses) => Array.isArray(statuses) ? statuses : [])
    .map((status) => ({
      status: status?.status || null,
      operation: status?.operation || null,
      exactness: status?.exactness || null,
      truncated: status?.truncated === true,
      sampled: status?.sampled === true,
      rows: Number.isFinite(Number(status?.rows)) ? Number(status.rows) : 0,
      cardinality: status?.cardinality ?? null,
      cacheHit: status?.cacheHit === true
    }));
  const records = Object.values(recordsByRequestId)
    .flatMap((items) => Array.isArray(items) ? items : []);
  return {
    contractVersion: machineResult.contractVersion || DATA_QUERY_CONTRACT_VERSION,
    source: machineResult.source || "api",
    requestCount: new Set([...Object.keys(metricsByRequestId), ...Object.keys(recordsByRequestId)]).size,
    requestedMetricCount: Array.isArray(machineResult.requestedMetrics) ? machineResult.requestedMetrics.length : 0,
    metrics: summarizeDataQueryMetricsForWorkflow(Object.values(metricsByRequestId).flatMap((items) => Array.isArray(items) ? items : [])),
    planStatuses,
    recordCount: records.length,
    recordFields: [...new Set(records.flatMap((item) => Object.keys(item?.record || {})))]
  };
}

export function summarizeDataQueryMetricsForWorkflow(metrics = [], fallbackRequestId = null) {
  return (Array.isArray(metrics) ? metrics : []).map((metric) => ({
    requestIdPresent: Boolean(metric.requestId || fallbackRequestId),
    planIdPresent: Boolean(metric.planId),
    operation: metric.operation || null,
    exactness: metric.exactness || null,
    valuePresent: metric.value !== null && metric.value !== undefined,
    groupFields: Object.keys(metric.group || {}),
    cardinality: metric.cardinality ?? null,
    source: metric.source ? {
      connection: metric.source.connection || null,
      schema: metric.source.schema || null,
      table: metric.source.table || null
    } : null
  }));
}

export function summarizeDataQueryRoutingForWorkflow(routing = {}) {
  const summarizeScope = (scope) => scope && typeof scope === "object"
    ? {
        targetTable: scope.targetTable || null,
        recordKind: scope.recordKind || null,
        operation: scope.operation || null,
        groupField: scope.groupField || null,
        granularity: scope.granularity || null,
        dateScopeRequirement: ["from", "to", "both"].includes(scope.dateScopeRequirement)
          ? scope.dateScopeRequirement
          : null,
        requiredFilters: (scope.requiredFilters || []).map((filter) => ({
          field: filter.field || null,
          op: filter.op || null
        })),
        forbiddenFilterFields: Array.isArray(scope.forbiddenFilterFields)
          ? [...scope.forbiddenFilterFields]
          : [],
        metricFields: (scope.metrics || []).map((metric) => metric.field).filter(Boolean),
        resolutionStatusRequested: scope.resolutionStatusRequested === true
      }
    : null;
  return {
    supported: routing.supported === true,
    status: routing.status || null,
    domain: routing.domain || null,
    intent: routing.intent || null,
    mixed: routing.mixed === true,
    recognized: routing.recognized === true,
    warning: routing.warning || null,
    warnings: summarizeDataQueryWarningsForWorkflow(routing.warnings || []),
    lookup: summarizeScope(routing.lookup),
    metricScope: summarizeScope(routing.metricScope),
    suggestedAgent: routing.suggestedAgent || null
  };
}

function metricRecord(result, alias, value, group, definition = null) {
  const groupHash = Object.keys(group).length
    ? createHash("sha256").update(JSON.stringify(group)).digest("hex").slice(0, 12)
    : "all";
  const exactness = value === null || value === undefined ? "not_computable" : result.exactness;
  const groupLabel = Object.entries(group).map(([key, item]) => `${key}=${item ?? "null"}`).join(", ");
  const metricNamespace = result.requestId || result.provenance?.requestId || result.id;
  return {
    id: `${metricNamespace}__${alias}__${groupHash}`,
    planId: result.id,
    requestId: result.requestId || result.provenance?.requestId || null,
    label: `${result.table}.${alias}${groupLabel ? ` [${groupLabel}]` : ""}`,
    value: value ?? null,
    operation: result.operation,
    exactness,
    group,
    definition: definition || { type: alias, field: null, as: alias },
    source: {
      connection: "content",
      schema: "public",
      table: result.table
    },
    filters: result.provenance?.filters || [],
    filterSignature: result.provenance?.filterSignature || null,
    cardinality: result.cardinality
  };
}

function formatMetricValue(value) {
  if (value === null || value === undefined) return "not computable";
  if (typeof value === "number") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
  return String(value);
}

function summarizePlanResult(plan, rows, execution = {}) {
  const exactness = execution.exactness ? ` (${execution.exactness})` : "";
  if (plan.operation === "group_count") return `Grouped ${plan.table} by ${(plan.groupBy || []).join(", ")}${exactness}.`;
  if (plan.operation === "aggregate") return `Aggregated ${plan.table}${exactness}.`;
  if (plan.operation === "count") return `Counted ${plan.table}${exactness}.`;
  return `Read ${rows.length} row(s) from ${plan.table}${exactness}.`;
}

function dataQueryResponse({ status, answer, metrics = [], plans = [], tablesUsed = [], confidence = 0, warnings = [], rawResultsPreview = {}, queryPlan = null, planner = null, caller = null, routing = null, machineResult = null }) {
  return {
    contractVersion: DATA_QUERY_CONTRACT_VERSION,
    status,
    answer,
    metrics,
    plans,
    tablesUsed,
    confidence,
    warnings,
    rawResultsPreview,
    queryPlan,
    planner,
    caller,
    routing,
    machineResult: machineResult || buildDataQueryMachineResult({ metrics, caller })
  };
}

// Builds a workflow-graph log from a Data Query Agent response so a direct
// subagent test renders the same way a chat-invoked run does in the Workflow tab.
export function buildDataQueryWorkflowLog(result = {}, { question = "", context = {}, openRouterCalls = [] } = {}) {
  const queryPlan = result.queryPlan && typeof result.queryPlan === "object" ? result.queryPlan : {};
  const plannedPlans = Array.isArray(queryPlan.plans) ? queryPlan.plans : [];
  const redactedQueryPlan = dataQueryQueryPlanForWorkflow(queryPlan);
  const redactedQuestion = summarizeDataQueryQuestionForWorkflow(question);
  const executedPlans = Array.isArray(result.plans) ? result.plans : [];
  const planner = result.planner || "unknown";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const redactedWarnings = summarizeDataQueryWarningsForWorkflow(warnings);
  const usedFallback = warnings.includes("llm_plan_rejected_fallback_used") || planner === "heuristic_fallback";
  const errored = result.status === "error";
  const routedElsewhere = result.routing?.supported === false;
  const caller = result.caller || context || {};

  const nodes = [
    { id: "dq_input", label: "Question Input", kind: "trigger", status: "done" },
    { id: "dq_routing", label: "Capability Router", kind: "router", status: "done" },
    {
      id: "dq_planner",
      label: planner === "llm" ? "LLM Query Planner" : "Heuristic Planner",
      kind: planner === "llm" ? "ai" : "router",
      status: routedElsewhere ? "skipped" : plannedPlans.length ? "done" : "error",
      ...(usedFallback ? { fallback: true } : {})
    },
    { id: "dq_validation", label: "Plan Validation", kind: "router", status: routedElsewhere ? "skipped" : executedPlans.length ? "done" : "error" }
  ];
  const edges = [
    { from: "dq_input", to: "dq_routing" },
    { from: "dq_routing", to: "dq_planner" },
    { from: "dq_planner", to: "dq_validation" }
  ];

  executedPlans.forEach((plan, index) => {
    const nodeId = `dq_exec_${index + 1}`;
    nodes.push({
      id: nodeId,
      label: `Execute · ${plan.table}`,
      kind: "database",
      status: plan.status === "ok" ? "done" : "error"
    });
    edges.push({ from: "dq_validation", to: nodeId });
    edges.push({ from: nodeId, to: "dq_synthesis" });
  });
  if (!executedPlans.length) edges.push({ from: "dq_validation", to: "dq_synthesis" });

  nodes.push({ id: "dq_synthesis", label: "Answer Synthesis", kind: "router", status: errored ? "error" : "done" });
  nodes.push({ id: "dq_output", label: "Data Query Output", kind: "output", status: errored ? "error" : "done" });
  edges.push({ from: "dq_synthesis", to: "dq_output" });

  const nodeDetails = {
    dq_input: {
      summary: redactedQuestion.present
        ? `Question redacted (${redactedQuestion.characterCount} characters)`
        : "(no question)",
      input: { question: redactedQuestion, context: summarizeDataQueryCallerForWorkflow(caller) },
      output: { intent: queryPlan.intent || null, contractVersion: result.contractVersion || DATA_QUERY_CONTRACT_VERSION }
    },
    dq_routing: {
      summary: result.routing?.reason || "Structured quantitative route accepted.",
      input: { source: caller.source || "api", callerNodeIdPresent: Boolean(caller.callerNodeId) },
      output: summarizeDataQueryRoutingForWorkflow(
        result.routing || { supported: true, domain: "content_metadata_metrics" }
      )
    },
    dq_planner: {
      summary: `Planner: ${planner}; ${plannedPlans.length} plan(s) proposed${usedFallback ? " (fallback used)" : ""}`,
      output: redactedQueryPlan,
      logs: redactedWarnings.filter((warning) => /planner|heuristic|fallback|plan_rejected/i.test(warning)).map((message) => ({ step: "dq_planner", message }))
    },
    dq_validation: {
      summary: `${executedPlans.length} plan(s) accepted for execution`,
      output: { acceptedPlans: executedPlans.map((p) => ({ table: p.table, operation: p.operation, status: p.status, rows: p.rows, cardinality: p.cardinality, exactness: p.exactness })) },
      logs: redactedWarnings.filter((warning) => /reject|budget|limit|forbidden|not_computable/i.test(warning)).map((message) => ({ step: "dq_validation", message }))
    },
    dq_synthesis: {
      summary: `status: ${result.status}; synthesis values retained only in machine metrics`,
      output: {
        metrics: summarizeDataQueryMetricsForWorkflow(result.metrics || []),
        machineResult: summarizeDataQueryMachineResultForWorkflow(result.machineResult || {}),
        tablesUsed: result.tablesUsed || [],
        confidence: result.confidence
      }
    },
    dq_output: {
      summary: `status: ${result.status}; ${(result.metrics || []).length} metric(s); ${(result.tablesUsed || []).length} table(s)`,
      output: {
        status: result.status,
        warnings: redactedWarnings,
        metrics: summarizeDataQueryMetricsForWorkflow(result.metrics || [])
      }
    }
  };
  executedPlans.forEach((plan, index) => {
    const planned = dataQueryPlanForWorkflow(plannedPlans.find((p) => p.id === plan.id) || { id: plan.id, table: plan.table });
    nodeDetails[`dq_exec_${index + 1}`] = {
      summary: plan.summary || `Read from ${plan.table}`,
      input: planned,
      output: {
        rows: plan.rows,
        cardinality: plan.cardinality ?? null,
        exactness: plan.exactness || null,
        truncated: plan.truncated === true,
        status: plan.status,
        error: plan.error ? "execution_failed" : null,
        // Workflow history stores structure, never source row values.
        fields: [...new Set([...(planned.select || []), ...(planned.groupBy || []), ...(planned.metrics || []).map((metric) => metric.as || metric.field).filter(Boolean)])]
      }
    };
  });

  const calls = Array.isArray(openRouterCalls) ? openRouterCalls : [];
  for (const node of nodes) {
    const nodeCalls = calls.filter((call) => call.step === node.id);
    if (nodeCalls.length) node.openrouter = nodeCalls;
  }

  return {
    nodes,
    edges,
    nodeDetails,
    openRouterUsage: summarizeOpenRouterUsage(calls),
    summary: {
      planner,
      status: result.status,
      contractVersion: result.contractVersion || DATA_QUERY_CONTRACT_VERSION,
      callerSource: caller.source || "api",
      callerNodeIdPresent: Boolean(caller.callerNodeId),
      parentRunIdPresent: Boolean(caller.runId),
      tablesUsed: result.tablesUsed || [],
      metrics: (result.metrics || []).length,
      cacheHits: executedPlans.filter((plan) => plan.cacheHit).length,
      warnings: warnings.length,
      fallback: usedFallback
    }
  };
}

export function summarizeDataQueryQuestionForWorkflow(question) {
  const text = String(question || "");
  return {
    redacted: true,
    present: Boolean(text.trim()),
    characterCount: text.length,
    language: /[\u0590-\u05ff]/u.test(text) ? "he" : "other"
  };
}

export function summarizeDataQueryCallerForWorkflow(caller = {}) {
  return {
    source: caller.source || "api",
    runIdPresent: Boolean(caller.runId),
    callerNodeIdPresent: Boolean(caller.callerNodeId),
    scopes: {
      dateFrom: Boolean(caller.dateFrom),
      dateTo: Boolean(caller.dateTo),
      project: Boolean(caller.projectId),
      case: Boolean(caller.caseId)
    },
    budget: caller.budget && typeof caller.budget === "object"
      ? cloneDataQueryValue(caller.budget)
      : null
  };
}

export function summarizeDataQueryWarningsForWorkflow(warnings = []) {
  const categories = (Array.isArray(warnings) ? warnings : []).map((warning) => {
    const value = String(warning || "");
    if (/semantic_question_route_elsewhere/.test(value)) return "semantic_question_route_elsewhere";
    if (/structured_lookup_not_available/.test(value)) return "structured_lookup_not_available";
    if (/ambiguous_lookup_target/.test(value)) return "ambiguous_lookup_target";
    if (/invalid_lookup_limit/.test(value)) return "invalid_lookup_limit";
    if (/safety_worker_aggregate_not_computable/.test(value)) return "safety_worker_aggregate_not_computable";
    if (/safety_resolution_status_not_computable/.test(value)) return "safety_resolution_status_not_computable";
    if (/meeting_attendance_not_computable/.test(value)) return "meeting_attendance_not_computable";
    if (/meeting_decision_presence_not_computable/.test(value)) return "meeting_decision_presence_not_computable";
    if (/meeting_ingestion_time_not_computable/.test(value)) return "meeting_ingestion_time_not_computable";
    if (/meeting_scope_field_not_queryable/.test(value)) return "meeting_scope_field_not_queryable";
    if (/meeting_unapproved_lookup_not_computable/.test(value)) return "meeting_unapproved_lookup_not_computable";
    if (/meeting_unapproved_metric_not_computable/.test(value)) return "meeting_unapproved_metric_not_computable";
    if (/meeting_date_scope_not_resolved/.test(value)) return "meeting_date_scope_not_resolved";
    if (/exception_amount_not_computable/.test(value)) return "exception_amount_not_computable";
    if (/exception_execution_days_not_computable/.test(value)) return "exception_execution_days_not_computable";
    if (/exception_identity_grouping_not_computable/.test(value)) return "exception_identity_grouping_not_computable";
    if (/exception_category_not_computable/.test(value)) return "exception_category_not_computable";
    if (/exception_lifecycle_status_not_computable/.test(value)) return "exception_lifecycle_status_not_computable";
    if (/exception_.*not_computable/.test(value)) return "exception_not_computable";
    if (/not computable|exact .* contract|exact analytics RPC/i.test(value)) return "not_computable";
    if (/plan_rejected|rejected/i.test(value)) return "plan_rejected";
    if (/fallback/i.test(value)) return "planner_fallback";
    if (/planner|llm/i.test(value)) return "planner_warning";
    if (/timeout|deadline/i.test(value)) return "timeout";
    if (/budget/i.test(value)) return "budget_warning";
    if (/forbidden|not allowed/i.test(value)) return "forbidden_plan";
    if (/cache/i.test(value)) return "cache_notice";
    return "execution_warning";
  });
  return [...new Set(categories)];
}

function dataQueryQueryPlanForWorkflow(queryPlan = {}) {
  return {
    intent: queryPlan.intent || null,
    confidence: Number.isFinite(Number(queryPlan.confidence)) ? Number(queryPlan.confidence) : null,
    warnings: summarizeDataQueryWarningsForWorkflow(queryPlan.warnings || []),
    plans: (Array.isArray(queryPlan.plans) ? queryPlan.plans : []).map(dataQueryPlanForWorkflow)
  };
}

function dataQueryPlanForWorkflow(plan = {}) {
  return {
    schema: plan.schema || plan.schemaAlias || "content",
    table: plan.table || plan.tableName || null,
    operation: plan.operation || null,
    select: Array.isArray(plan.select) ? [...plan.select] : [],
    filters: (Array.isArray(plan.filters) ? plan.filters : []).map((filter) => ({ field: filter.field, op: filter.op })),
    groupBy: Array.isArray(plan.groupBy) ? [...plan.groupBy] : [],
    metrics: (Array.isArray(plan.metrics) ? plan.metrics : []).map((metric) => ({
      type: metric.type,
      field: metric.field || null
    })),
    orderBy: (Array.isArray(plan.orderBy) ? plan.orderBy : []).map((order) => ({
      field: order.field,
      direction: order.direction
    })),
    limit: Number.isFinite(Number(plan.limit)) ? Number(plan.limit) : null
  };
}

function containsDangerousSql(value) {
  const plans = Array.isArray(value?.plans) ? value.plans : [];
  return plans.some((plan) => {
    if (plan?.rawSql !== undefined || plan?.sql !== undefined) return true;
    if (/^(?:insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call)$/i.test(String(plan?.operation || ""))) {
      return true;
    }
    const typedPlanText = JSON.stringify({
      schema: plan?.schema,
      table: plan?.table,
      select: plan?.select,
      filters: plan?.filters,
      groupBy: plan?.groupBy,
      metrics: plan?.metrics,
      orderBy: plan?.orderBy,
      join: plan?.join,
      joins: plan?.joins
    });
    return /;|--|\/\*/.test(typedPlanText);
  });
}

function normalizeStringList(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]+/) : [];
  return [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function runWithinDeadline(factory, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(factory),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} exceeded the total timeout`)), Math.max(1, timeoutMs));
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// RETIRED IN PHASE 0: the legacy SQL-pipeline helpers remain temporarily for
// source-history compatibility, but they are deliberately private. No server
// route or UI control can call them, and the exec_read_sql RPC is removed by
// the Phase 0/1 hardening migration. The typed Query Plan path above is the
// only supported runtime.
// ============================================================================

const DATA_QUERY_PIPELINE_STEPS = [
  { id: "user_question", label: "User Question" },
  { id: "schema_inspection", label: "Schema Inspection" },
  { id: "field_selection", label: "Field & Table Selection" },
  { id: "sql_generation", label: "SQL Generation" },
  { id: "sql_execution", label: "SQL Execution" },
  { id: "calculation", label: "Server-side Calculation" },
  { id: "result", label: "Quantitative Result" }
];

const SQL_FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge|comment|vacuum|analyze|reindex|cluster|lock|listen|notify|set|reset|begin|commit|rollback|savepoint|prepare|execute|deallocate|refresh)\b/i;

// Defense-in-depth SQL guard (the DB read-only role is the primary guarantee).
function validateReadOnlySql(sql, { allowedTables = [] } = {}) {
  const errors = [];
  const text = String(sql || "").trim().replace(/;\s*$/, "");
  if (!text) return { ok: false, errors: ["empty sql"], sql: "", tables: [] };
  if (/;/.test(text)) errors.push("multiple statements are not allowed");
  if (!/^(select|with)\b/i.test(text)) errors.push("only SELECT/WITH queries are allowed");
  if (SQL_FORBIDDEN.test(text)) errors.push("write/DDL keywords are not allowed");
  if (/--|\/\*/.test(text)) errors.push("SQL comments are not allowed");
  const refs = [...text.matchAll(/\b(?:from|join)\s+("?[A-Za-z_][\w.]*"?)/gi)]
    .map((m) => m[1].replace(/"/g, "").split(".").pop());
  if (allowedTables.length) {
    const blocked = [...new Set(refs.filter((r) => !allowedTables.includes(r)))];
    if (blocked.length) errors.push(`tables not in your selection: ${blocked.join(", ")}`);
  }
  return { ok: errors.length === 0, errors, sql: text, tables: [...new Set(refs)] };
}

function pipelineConnection(_connKey, config) {
  // The Data Query Agent is restricted to the content connection only — never the main/app DB.
  const c = contentSupabaseConfig(config);
  return { schema: "content", supabaseUrl: c.supabaseUrl, supabaseServiceRoleKey: c.supabaseServiceRoleKey };
}

// Runs read-only SQL through the exec_read_sql Postgres RPC (created via migration).
async function execReadSql({ connection, sql, maxRows = 200, timeoutMs = 8000, fetchImpl = fetch }) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) {
    throw new Error("Supabase connection is not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/rpc/exec_read_sql`, {
      method: "POST",
      signal: controller.signal,
      headers: { ...supabaseHeaders(connection.supabaseServiceRoleKey), "Content-Type": "application/json" },
      body: JSON.stringify({ q: sql, max_rows: maxRows })
    });
    const txt = await response.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!response.ok) {
      const msg = data?.message || data?.hint || data?.error || `exec_read_sql failed: ${response.status}`;
      if (response.status === 404 || /could not find|exec_read_sql|schema cache/i.test(String(msg))) {
        throw new Error("exec_read_sql RPC is missing — run the Supabase migration first");
      }
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data == null ? [] : [data]);
  } finally {
    clearTimeout(timer);
  }
}

function truncateSampleValue(value) {
  if (typeof value === "string") return value.length > 140 ? `${value.slice(0, 140)}…` : value;
  if (value && typeof value === "object") return JSON.stringify(value).slice(0, 140);
  return value;
}

// Fetches a few real rows so the LLM can ground SQL in actual column contents
// (e.g. discover that a `hashtags` column holds Hebrew tags). Read-only REST, no migration.
async function fetchTableSamples({ connection, table, limit = 3, timeoutMs = 6000, fetchImpl = fetch }) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${limit}`, {
      signal: controller.signal,
      headers: supabaseHeaders(connection.supabaseServiceRoleKey)
    });
    const txt = await response.text();
    const data = txt ? JSON.parse(txt) : [];
    if (!response.ok || !Array.isArray(data)) return [];
    return data.map((row) => Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, truncateSampleValue(v)])));
  } catch (_) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const FIELD_SELECTION_PROMPT = `You select the data sources for a read-only analytics agent.
Given a user question and the availableSchema (tables with their columns), choose the MINIMAL set of tables and columns needed to answer it.
Return ONLY one JSON object: {"connection":"app|content","tables":[{"table":"name","columns":["col"]}],"reason":"short"}.
Rules: use only tables and columns that appear in availableSchema; all chosen tables must belong to the SAME connection.
Choose the table whose columns and sample values ACTUALLY contain what the question needs — not the one whose name merely sounds related. Inspect each table's sample rows.
If the question is about hashtags, tags, topics, or labels, pick a table that has a hashtags/tags/keywords/category column (confirm it exists in the samples); do not pick a table that lacks such a column. Include that column among the chosen columns.`;

const SQL_GENERATION_PROMPT = `You write ONE read-only PostgreSQL query for an analytics agent.
Return ONLY one JSON object: {"sql":"...","reason":"short"}.
Hard rules: a single statement; it MUST start with SELECT or WITH; no semicolons; no comments; never use INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE or any write/DDL.
Use only the provided tables and columns. For quantitative questions prefer aggregates (count, sum, avg, min, max, group by). Always include an explicit LIMIT no larger than maxRows. PostgreSQL dialect only.

Ground your query in the provided sample rows — they show the REAL format and values of each column. Do not invent enum values or assume a column means what its name suggests; check the samples.
When the question is about a topic, subject, label, or tag (e.g. counting items "about delays"), find the column that actually holds tags/hashtags/keywords/categories from the samples and filter it with case-insensitive text matching (e.g. col ILIKE '%term%'); if that column is a Postgres array use term = ANY(col); if it is JSON/JSONB use the appropriate containment. Prefer this over guessing a status/type enum column.`;

function normalizeFieldSelection(parsed = {}, schema = {}) {
  const available = new Map();
  for (const conn of schema.connections || []) {
    for (const t of conn.tables || []) available.set(`${conn.key}.${t.name}`, { connection: conn.key, columns: t.columns || [] });
  }
  let connection = String(parsed.connection || "").trim();
  const tables = [];
  for (const t of Array.isArray(parsed.tables) ? parsed.tables : []) {
    const name = String(t.table || t.name || "").trim();
    if (!name) continue;
    const conn = connection || (schema.connections?.[0]?.key) || "app";
    const meta = available.get(`${conn}.${name}`) || [...available.entries()].find(([k]) => k.endsWith(`.${name}`))?.[1];
    if (!meta) continue;
    if (!connection) connection = meta.connection;
    const cols = (Array.isArray(t.columns) ? t.columns : []).map(String).filter((c) => meta.columns.includes(c));
    tables.push({ table: name, columns: cols.length ? cols : meta.columns.slice(0, 12) });
  }
  return { connection: connection || "app", tables, reason: String(parsed.reason || "") };
}

function computeQuantitativeMetrics(rows = []) {
  const metrics = [{ id: "row_count", label: "row count", value: rows.length }];
  if (!rows.length) return metrics;
  const keys = Object.keys(rows[0] || {});
  for (const key of keys) {
    const values = rows.map((r) => r[key]);
    const numeric = values.map(Number).filter(Number.isFinite);
    if (numeric.length === values.length && numeric.length) {
      const sum = numeric.reduce((s, v) => s + v, 0);
      metrics.push({ id: `${key}_sum`, label: `${key} sum`, value: Number(sum.toFixed(4)) });
      metrics.push({ id: `${key}_avg`, label: `${key} avg`, value: Number((sum / numeric.length).toFixed(4)) });
      metrics.push({ id: `${key}_min`, label: `${key} min`, value: Math.min(...numeric) });
      metrics.push({ id: `${key}_max`, label: `${key} max`, value: Math.max(...numeric) });
    } else {
      const distinct = new Set(values.map((v) => String(v ?? "null")));
      if (distinct.size > 1 && distinct.size <= Math.min(20, rows.length)) {
        const groups = {};
        for (const v of values) groups[String(v ?? "null")] = (groups[String(v ?? "null")] || 0) + 1;
        metrics.push({ id: `${key}_breakdown`, label: `${key} breakdown`, value: groups });
      }
    }
  }
  return metrics;
}

function buildQuantitativeAnswer({ rowCount = 0, metrics = [] }) {
  const parts = [`התקבלו ${rowCount} שורות.`];
  for (const m of metrics) {
    if (m.id === "row_count") continue;
    if (m.value && typeof m.value === "object") {
      parts.push(`${m.label}: ${Object.entries(m.value).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    } else {
      parts.push(`${m.label}: ${m.value}`);
    }
  }
  return parts.join(" ");
}

function stepUserQuestion(state) {
  const question = String(state.question || "").trim();
  const context = state.context && typeof state.context === "object" ? state.context : {};
  return { step: "user_question", output: { question, context }, state: { ...state, question, context } };
}

async function stepSchemaInspection({ state, config, settings, fetchImpl }) {
  let connections = [];
  if (settings.tables?.length) {
    const byConn = {};
    for (const t of settings.tables) (byConn[t.connection] ||= []).push({ name: t.table, columns: t.columns || [] });
    connections = Object.entries(byConn).map(([key, tables]) => ({ key, tables }));
    // The selection is bounded, so sample each table now — this makes Field & Table
    // Selection data-aware (e.g. it can tell which table actually has a hashtags column).
    for (const conn of connections) {
      const c = pipelineConnection(conn.key, config);
      for (const t of conn.tables.slice(0, 15)) {
        t.samples = await fetchTableSamples({ connection: c, table: t.name, limit: 2, fetchImpl });
      }
    }
  } else {
    const seen = new Set();
    for (const key of ["content"]) {
      const conn = pipelineConnection(key, config);
      if (!conn.supabaseUrl || !conn.supabaseServiceRoleKey || seen.has(conn.supabaseUrl)) continue;
      seen.add(conn.supabaseUrl);
      try { connections.push({ key, tables: await introspectSupabaseTables(conn, { fetchImpl }) }); } catch (_) { /* skip */ }
    }
  }
  const output = { connections, tableCount: connections.reduce((s, c) => s + c.tables.length, 0), source: settings.tables?.length ? "selection" : "live_scan" };
  return { step: "schema_inspection", output, state: { ...state, schema: output } };
}

async function stepFieldSelection({ state, config, settings, telemetry, chatComplete, fetchImpl }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const schema = state.schema || (await stepSchemaInspection({ state, config, settings, fetchImpl })).output;
  const manifest = (schema.connections || []).map((c) => ({ connection: c.key, tables: c.tables.map((t) => ({ table: t.name, columns: t.columns, samples: (t.samples || []).slice(0, 2) })) }));
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey, model, temperature: 0, maxTokens: 1200,
    timeoutMs: settings.plannerTimeoutMs, responseFormat: { type: "json_object" }, telemetry,
    messages: [
      { role: "system", content: FIELD_SELECTION_PROMPT },
      { role: "user", content: JSON.stringify({ question: state.question, context: state.context || {}, availableSchema: manifest }) }
    ]
  });
  const selection = normalizeFieldSelection(extractJsonObject(content), schema);
  if (!selection.tables.length) throw new Error("no relevant tables were selected for this question");
  // Ground the next step in real data: pull a few sample rows for the chosen tables
  // so SQL Generation can see actual values (e.g. how a hashtags column is formatted).
  const conn = pipelineConnection(selection.connection, config);
  for (const t of selection.tables) {
    t.samples = await fetchTableSamples({ connection: conn, table: t.table, limit: 3, fetchImpl });
  }
  return { step: "field_selection", output: selection, state: { ...state, schema, selection } };
}

async function stepSqlGeneration({ state, config, settings, telemetry, chatComplete }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const selection = state.selection;
  if (!selection?.tables?.length) throw new Error("run Field & Table Selection first");
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey, model, temperature: 0, maxTokens: 900,
    timeoutMs: settings.plannerTimeoutMs, responseFormat: { type: "json_object" }, telemetry,
    messages: [
      { role: "system", content: SQL_GENERATION_PROMPT },
      { role: "user", content: JSON.stringify({ question: state.question, context: state.context || {}, connection: selection.connection, tables: selection.tables, maxRows: settings.maxRowsPerPlan }) }
    ]
  });
  const parsed = extractJsonObject(content);
  const validation = validateReadOnlySql(parsed.sql || "", { allowedTables: selection.tables.map((t) => t.table) });
  const output = { sql: validation.sql, reason: String(parsed.reason || ""), valid: validation.ok, errors: validation.errors, connection: selection.connection };
  return { step: "sql_generation", output, state: { ...state, sql: output } };
}

async function stepSqlExecution({ state, config, settings, fetchImpl }) {
  const sqlInfo = state.sql;
  if (!sqlInfo?.sql) throw new Error("run SQL Generation first");
  const allowedTables = (state.selection?.tables || []).map((t) => t.table);
  const validation = validateReadOnlySql(sqlInfo.sql, { allowedTables });
  if (!validation.ok) throw new Error(`unsafe SQL rejected: ${validation.errors.join("; ")}`);
  const connection = pipelineConnection(sqlInfo.connection || state.selection?.connection || "app", config);
  const rows = await execReadSql({ connection, sql: validation.sql, maxRows: settings.maxRowsPerPlan, timeoutMs: settings.timeoutMsPerPlan, fetchImpl });
  const output = { rowCount: rows.length, rows: rows.slice(0, settings.maxRowsPerPlan), preview: rows.slice(0, 5) };
  return { step: "sql_execution", output, state: { ...state, execution: output } };
}

function stepCalculation({ state }) {
  const rows = state.execution?.rows || [];
  const metrics = computeQuantitativeMetrics(rows);
  const output = { rowCount: rows.length, metrics };
  return { step: "calculation", output, state: { ...state, calculation: output } };
}

function stepResult({ state }) {
  const metrics = state.calculation?.metrics || computeQuantitativeMetrics(state.execution?.rows || []);
  const rowCount = state.execution?.rowCount ?? 0;
  const answer = buildQuantitativeAnswer({ rowCount, metrics });
  const output = { answer, metrics, rowCount };
  return { step: "result", output, state: { ...state, result: output } };
}

async function runDataQueryStep({ step, state = {}, config = getConfig(), settings = dataQuerySettings(config), telemetry = null, chatComplete = chatCompletion, fetchImpl = fetch } = {}) {
  switch (step) {
    case "user_question": return stepUserQuestion(state);
    case "schema_inspection": return stepSchemaInspection({ state, config, settings, fetchImpl });
    case "field_selection": return stepFieldSelection({ state, config, settings, telemetry, chatComplete, fetchImpl });
    case "sql_generation": return stepSqlGeneration({ state, config, settings, telemetry, chatComplete });
    case "sql_execution": return stepSqlExecution({ state, config, settings, fetchImpl });
    case "calculation": return stepCalculation({ state });
    case "result": return stepResult({ state });
    default: throw new Error(`unknown step: ${step}`);
  }
}

async function runDataQueryPipeline({ question, context = {}, config = getConfig(), settings = dataQuerySettings(config), telemetry = null, onStep = null, chatComplete = chatCompletion, fetchImpl = fetch } = {}) {
  let state = { question: String(question || "").trim(), context: context || {} };
  const steps = [];
  for (const def of DATA_QUERY_PIPELINE_STEPS) {
    try {
      const res = await runDataQueryStep({ step: def.id, state, config, settings, telemetry, chatComplete, fetchImpl });
      state = res.state;
      const entry = { id: def.id, label: def.label, status: "ok", output: res.output };
      steps.push(entry);
      if (typeof onStep === "function") onStep(entry);
    } catch (error) {
      const entry = { id: def.id, label: def.label, status: "error", error: error.message };
      steps.push(entry);
      if (typeof onStep === "function") onStep(entry);
      break;
    }
  }
  return { steps, state, status: steps.some((s) => s.status === "error") ? "error" : "ok" };
}
