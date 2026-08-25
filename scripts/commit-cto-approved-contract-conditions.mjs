import { createHash } from "node:crypto";
import { getConfig, loadEnv, reloadSettingsFromDb, supabaseHeaders } from "../src/config.js";
import { getSavedContractsClauseWorkspace } from "../src/contracts/clausePersistence.js";
import { resolveIndicatorProjectContext } from "../src/indicator/contractConditions.js";
import { contentSupabaseConfig } from "../src/supabase.js";

const WORKSPACE_ID = "4ff258bd-29ac-4aa9-a148-ac1bfcc7b8aa";
const SOURCE_PROJECT_ID = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
const COMMIT = process.argv.includes("--commit");
const REPAIR_METADATA = process.argv.includes("--repair-metadata");
const UPDATE_ACTION_DESCRIPTIONS = process.argv.includes("--update-action-descriptions");

// These are the eight individual terms reviewed with the CTO on 2026-08-25.
// They deliberately use a manual, deterministic key rather than pretending a
// new Contracts decision has already been reviewed through the app UI.
const APPROVED_CONDITIONS = [
  {
    clauseKey: "3.6",
    name: "הכנת לוח זמנים מפורט",
    actionDescriptionHe: "הקבלן נדרש להגיש למזמין לוח זמנים מפורט לביצוע העבודות.",
    category: "notice",
    triggerKind: "חתימת ההסכם",
    anchorDescription: "חתימת החוזה",
    offsetValue: 10,
    offsetUnit: "calendar_days"
  },
  {
    clauseKey: "3.8",
    name: "תגבור צוות עובדים לפי דרישת המזמין",
    actionDescriptionHe: "הקבלן נדרש לתגבר את צוות העובדים כאשר המזמין דורש זאת.",
    category: "execution",
    triggerKind: "קבלת הודעה",
    anchorDescription: "דרישה מפורשת של המזמין לתגבור צוות העובדים",
    offsetValue: 2,
    offsetUnit: "working_days"
  },
  {
    clauseKey: "8.2",
    name: "אחריות הקבלן לטיב העבודות והחומרים",
    actionDescriptionHe: "הקבלן אחראי לטיב העבודות והחומרים גם לאחר סיום העבודות.",
    category: "warranty",
    triggerKind: "בדיקה או מסירה",
    anchorDescription: "מועד סיום העבודות בשלמות",
    offsetValue: 12,
    offsetUnit: "months"
  },
  {
    clauseKey: "8.5",
    name: "החזר הוצאות למזמין עבור תיקון ליקויים",
    actionDescriptionHe: "הקבלן נדרש להשיב למזמין הוצאות שהוצאו לתיקון ליקויים.",
    category: "other",
    triggerKind: "קבלת הודעה",
    anchorDescription: "דרישה ראשונה של המזמין",
    offsetValue: 7,
    offsetUnit: "calendar_days"
  },
  {
    clauseKey: "8.10.2.1",
    name: "תיקון פגם במערכות תומכות",
    actionDescriptionHe: "הקבלן נדרש לתקן פגם במערכות תומכות בתוך 12 שעות מקבלת הודעת המפקח.",
    category: "warranty",
    triggerKind: "קבלת הודעה",
    anchorDescription: "קבלת הודעת המפקח",
    offsetValue: 12,
    offsetUnit: "hours"
  },
  {
    clauseKey: "8.10.2.1",
    name: "תיקון פגם במערכות רלוונטיות",
    actionDescriptionHe: "הקבלן נדרש לתקן פגם במערכות רלוונטיות בתוך 7 ימים מקבלת הודעת המפקח.",
    category: "warranty",
    triggerKind: "קבלת הודעה",
    anchorDescription: "קבלת הודעת המפקח",
    offsetValue: 7,
    offsetUnit: "calendar_days"
  },
  {
    clauseKey: "8.10.2.4",
    name: "בדיקה נוספת של טיב העבודות",
    actionDescriptionHe: "הקבלן נדרש לאפשר בדיקה נוספת של טיב העבודות במשך תקופת האחריות.",
    category: "warranty",
    triggerKind: "בדיקה או מסירה",
    anchorDescription: "מסירת תעודת השלמה לפרויקט או לחלק ממנו",
    offsetValue: 24,
    offsetUnit: "months"
  },
  {
    clauseKey: "15.3",
    name: "חזקת מסירה של הודעות בדואר רשום",
    actionDescriptionHe: "הודעה שנשלחה בדואר רשום תיחשב כאילו נמסרה לצד השני לאחר חלוף התקופה החוזית.",
    category: "notice",
    triggerKind: "מסירת מסמך",
    anchorDescription: "תאריך משלוח הדואר הרשום",
    offsetValue: 5,
    offsetUnit: "calendar_days"
  }
];

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

function sourceExcerpt(clause) {
  const value = String(clause?.rawText || "").trim();
  if (!value) throw new Error(`Missing immutable source text for clause ${clause?.clauseKey || "unknown"}.`);
  return value;
}

function buildRows({ savedWorkspace, scheduleProjectId }) {
  const clauses = new Map((savedWorkspace.preview?.clauses || []).map((clause) => [String(clause.clauseKey), clause]));
  const documentVersionId = String(savedWorkspace.preview?.document?.documentVersionId || "").trim();
  const filename = String(savedWorkspace.preview?.document?.filename || "").trim();
  if (!documentVersionId || !filename) throw new Error("The saved workspace lacks document identity.");
  return APPROVED_CONDITIONS.map((condition) => {
    const clause = clauses.get(condition.clauseKey);
    if (!clause) throw new Error(`Approved clause ${condition.clauseKey} is missing from the saved workspace.`);
    const deterministicKey = sha256([
      "contracts-temporal-cto-review.v1", documentVersionId, condition.clauseKey,
      condition.name, condition.anchorDescription, condition.offsetValue, condition.offsetUnit
    ].join("\u001f"));
    return {
      project_id: scheduleProjectId,
      condition_key: `cto-approved-temporal:${deterministicKey}`,
      name: condition.name,
      category: condition.category,
      anchor_kind: "event",
      anchor_description: condition.anchorDescription,
      offset_value: condition.offsetValue,
      offset_unit: condition.offsetUnit,
      recurring: false,
      is_project_completion: false,
      penalty_ils_per_day: null,
      source_excerpt: sourceExcerpt(clause),
      source_page: Number.isInteger(Number(clause.pageStart)) ? Number(clause.pageStart) : null,
      confidence: 1,
      status: "pending",
      trigger_event_date: null,
      trigger_source_table: null,
      trigger_source_id: null,
      resolved_milestone_key: null,
      written_by: "contracts_agent_cto_approved",
      source_contract_decision_id: null,
      metadata: {
        sync_version: "contracts-temporal-cto-review.v1",
        approval_basis: "cto_approved_structure_and_candidate_list_2026-08-25",
        // This must not be named contracts_workspace_id: the V1 sync treats
        // that key as an Indicator-owned row and dismisses pending rows that
        // lack a reviewed source_contract_decision_id.
        source_contracts_workspace_id: WORKSPACE_ID,
        source_project_id: SOURCE_PROJECT_ID,
        document_version_id: documentVersionId,
        source_filename: filename,
        source_clause_key: condition.clauseKey,
        action_description_he: condition.actionDescriptionHe,
        trigger_kind: condition.triggerKind,
        confidence_basis: "cto_review"
      }
    };
  });
}

async function requestJson(url, { method = "GET", headers, body } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || `APP DATA request failed (${response.status}).`);
  return payload;
}

loadEnv();
await reloadSettingsFromDb();
const config = getConfig();
const appData = contentSupabaseConfig(config);
if (!appData.supabaseUrl || !appData.supabaseServiceRoleKey) throw new Error("APP DATA is not configured.");

const [savedWorkspace, projectContext] = await Promise.all([
  getSavedContractsClauseWorkspace({ config, workspaceId: WORKSPACE_ID }),
  resolveIndicatorProjectContext({ config, projectId: SOURCE_PROJECT_ID })
]);
if (projectContext.sourceProjectId !== SOURCE_PROJECT_ID || !projectContext.scheduleProjectId) {
  throw new Error("The active source-to-Schedule project mapping is missing or changed.");
}
const rows = buildRows({ savedWorkspace, scheduleProjectId: projectContext.scheduleProjectId });
const baseUrl = trimSlash(appData.supabaseUrl);
const headers = supabaseHeaders(appData.supabaseServiceRoleKey, {
  "Content-Type": "application/json",
  Prefer: "return=representation"
});
const encodedKeys = rows.map((row) => `condition_key.eq.${encodeURIComponent(row.condition_key)}`).join(",");
const existing = await requestJson(
  `${baseUrl}/rest/v1/schedule_contract_conditions?project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&or=(${encodedKeys})&select=id,condition_key,name,status,metadata`,
  { headers }
);
if (REPAIR_METADATA) {
  if (existing.length !== rows.length) {
    throw new Error(`Refusing metadata repair: expected ${rows.length} rows, found ${existing.length}.`);
  }
  const repaired = [];
  for (const condition of existing) {
    const metadata = { ...(condition.metadata || {}) };
    const legacyWorkspaceId = metadata.contracts_workspace_id;
    delete metadata.contracts_workspace_id;
    metadata.source_contracts_workspace_id = legacyWorkspaceId || WORKSPACE_ID;
    const updated = await requestJson(
      `${baseUrl}/rest/v1/schedule_contract_conditions?id=eq.${encodeURIComponent(condition.id)}`,
      { method: "PATCH", headers, body: { metadata } }
    );
    if (!Array.isArray(updated) || updated.length !== 1) {
      throw new Error(`Could not repair metadata for condition ${condition.id}.`);
    }
    repaired.push(updated[0]);
  }
  if (repaired.some((row) => row.metadata?.contracts_workspace_id || row.metadata?.source_contracts_workspace_id !== WORKSPACE_ID)) {
    throw new Error("Metadata repair verification failed.");
  }
  console.log(JSON.stringify({
    mode: "metadata_repaired",
    repairedCount: repaired.length,
    ids: repaired.map((row) => row.id)
  }, null, 2));
  process.exit(0);
}
if (UPDATE_ACTION_DESCRIPTIONS) {
  if (existing.length !== rows.length) {
    throw new Error(`Refusing action-description update: expected ${rows.length} rows, found ${existing.length}.`);
  }
  const expectedRows = new Map(rows.map((row) => [row.condition_key, row]));
  const updated = [];
  for (const condition of existing) {
    const expected = expectedRows.get(condition.condition_key);
    if (!expected) throw new Error(`Unexpected approved-condition key ${condition.condition_key}.`);
    const metadata = { ...(condition.metadata || {}), action_description_he: expected.metadata.action_description_he };
    const response = await requestJson(
      `${baseUrl}/rest/v1/schedule_contract_conditions?id=eq.${encodeURIComponent(condition.id)}`,
      { method: "PATCH", headers, body: { metadata } }
    );
    if (!Array.isArray(response) || response.length !== 1) {
      throw new Error(`Could not update the action description for condition ${condition.id}.`);
    }
    updated.push(response[0]);
  }
  if (updated.some((row) => !String(row.metadata?.action_description_he || "").trim())) {
    throw new Error("Action-description update verification failed.");
  }
  console.log(JSON.stringify({
    mode: "action_descriptions_updated",
    updatedCount: updated.length,
    ids: updated.map((row) => row.id)
  }, null, 2));
  process.exit(0);
}
if (existing.length > 0) {
  throw new Error(`Refusing to write: ${existing.length} approved-condition key(s) already exist. Re-run is not an implicit update.`);
}

if (!COMMIT) {
  console.log(JSON.stringify({
    mode: "dry_run",
    workspaceId: WORKSPACE_ID,
    scheduleProjectId: projectContext.scheduleProjectId,
    existingCount: existing.length,
    insertCount: rows.length,
    rows: rows.map(({ source_excerpt, ...row }) => ({ ...row, source_excerpt_length: source_excerpt.length }))
  }, null, 2));
} else {
  const inserted = await requestJson(`${baseUrl}/rest/v1/schedule_contract_conditions`, {
    method: "POST",
    headers,
    body: rows
  });
  if (!Array.isArray(inserted) || inserted.length !== rows.length) {
    throw new Error(`Unexpected insert result: expected ${rows.length} rows, received ${Array.isArray(inserted) ? inserted.length : 0}.`);
  }
  const ids = inserted.map((row) => row.id).filter(Boolean);
  const verification = await requestJson(
    `${baseUrl}/rest/v1/schedule_contract_conditions?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,condition_key,name,category,anchor_kind,anchor_description,offset_value,offset_unit,recurring,status,trigger_event_date,trigger_source_table,trigger_source_id,resolved_milestone_key,source_page,source_contract_decision_id,written_by,metadata&order=name.asc`,
    { headers }
  );
  if (verification.length !== rows.length
      || verification.some((row) => row.status !== "pending"
        || row.trigger_event_date !== null
        || row.trigger_source_table !== null
        || row.trigger_source_id !== null
        || row.resolved_milestone_key !== null
        || row.anchor_kind !== "event"
        || row.source_contract_decision_id !== null
        || row.written_by !== "contracts_agent_cto_approved")) {
    throw new Error("Post-write verification failed: the inserted conditions do not preserve the approved unresolved-state contract.");
  }
  console.log(JSON.stringify({
    mode: "committed",
    workspaceId: WORKSPACE_ID,
    scheduleProjectId: projectContext.scheduleProjectId,
    insertedCount: inserted.length,
    verification
  }, null, 2));
}
