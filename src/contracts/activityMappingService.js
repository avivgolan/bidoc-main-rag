import { supabaseHeaders } from "../config.js";
import { loadScheduleSource, pickCurrentVersion, scheduleSupabaseConfig } from "../scheduleIngestion.js";
import { buildContractActivityMappingCandidates } from "./activityMapping.js";
import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_ACTIVITY_MAPPING_API_VERSION = "contracts-activity-mapping-api.phase3e.v1";
export const CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC = "bidoc_contracts_resolve_mapping_context_v1";
export const CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS = 30_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CLIENT_DATABASE_OVERRIDE_KEYS = new Set([
  "alertstable",
  "credentials",
  "database",
  "databaseconfig",
  "databaseconnection",
  "databasecredentials",
  "contentdatabaseurl",
  "contentsource",
  "contentsupabasekey",
  "contentsupabaseservicerolekey",
  "contentsupabaseurl",
  "databasekey",
  "databaseurl",
  "hybridrpcname",
  "indextable",
  "servicerolekey",
  "supabasekey",
  "supabase",
  "supabaseconfig",
  "supabasecredentials",
  "supabaseservicerolekey",
  "supabaseurl"
]);
const CLIENT_DATABASE_OVERRIDE_HEADERS = new Set([
  "x-alerts-table",
  "x-content-supabase-key",
  "x-content-supabase-url",
  "x-hybrid-rpc-name",
  "x-index-table"
]);
const MAPPING_COLUMNS = [
  "id",
  "canonical_key",
  "alias",
  "alias_source",
  "match_method",
  "confidence",
  "status",
  "confirmed_by",
  "confirmed_at",
  "created_at",
  "updated_at"
].join(",");

function mappingApiError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function normalizeOverrideKey(value) {
  return String(value || "").replace(/[^a-z0-9]/giu, "").toLocaleLowerCase("en");
}

function collectClientOverridePaths(value, path = "body", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  const entries = value instanceof URLSearchParams
    ? [...value.keys()].map((key) => [key, null])
    : Object.entries(value);
  const matches = [];
  for (const [key, nested] of entries) {
    const nextPath = `${path}.${key}`;
    if (CLIENT_DATABASE_OVERRIDE_KEYS.has(normalizeOverrideKey(key))) matches.push(nextPath);
    matches.push(...collectClientOverridePaths(nested, nextPath, seen));
  }
  return matches;
}

function unexpectedKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/**
 * Phase 3E mapping routes are deliberately single-tenant. Browser-provided
 * database URLs, keys, table names, or RPC names can never alter their routing.
 */
export function assertNoClientDatabaseOverrides({ headers = {}, query = null, body = null } = {}) {
  const headerNames = Object.keys(headers || {}).map((key) => String(key).toLocaleLowerCase("en"));
  const headerMatches = headerNames
    .filter((key) => CLIENT_DATABASE_OVERRIDE_HEADERS.has(key))
    .map((key) => `headers.${key}`);
  const matches = [
    ...headerMatches,
    ...collectClientOverridePaths(query, "query"),
    ...collectClientOverridePaths(body, "body")
  ];
  if (matches.length) {
    throw mappingApiError(
      "contracts_activity_mapping_database_override_rejected",
      "Activity-mapping APIs use server-owned MAIN and KAPAIM connections; client database overrides are not accepted.",
      400
    );
  }
}

export function parseActivityMappingListRequest({ headers = {}, query = null } = {}) {
  assertNoClientDatabaseOverrides({ headers, query });
  const keys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  const unsupported = keys.filter((key) => key !== "sourceProjectId");
  if (unsupported.length) {
    throw mappingApiError(
      "contracts_activity_mapping_request_field_unsupported",
      `Unsupported activity-list query field: ${unsupported.sort()[0]}.`,
      400
    );
  }
  const sourceProjectId = query instanceof URLSearchParams
    ? query.get("sourceProjectId")
    : query?.sourceProjectId;
  return { sourceProjectId: normalizeActivityMappingSourceProjectId(sourceProjectId) };
}

export function parseActivityMappingCandidateRequest({ headers = {}, query = null, body = null } = {}) {
  assertNoClientDatabaseOverrides({ headers, query, body });
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw mappingApiError(
      "contracts_activity_mapping_request_invalid",
      "The activity-mapping candidate request must be a JSON object.",
      400
    );
  }
  const unsupportedBody = unexpectedKeys(body, new Set(["sourceProjectId", "obligation"]));
  const queryKeys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  if (unsupportedBody.length || queryKeys.length) {
    const field = [...unsupportedBody.map((key) => `body.${key}`), ...queryKeys.map((key) => `query.${key}`)].sort()[0];
    throw mappingApiError(
      "contracts_activity_mapping_request_field_unsupported",
      `Unsupported activity-candidate request field: ${field}.`,
      400
    );
  }
  return {
    sourceProjectId: normalizeActivityMappingSourceProjectId(body.sourceProjectId),
    obligation: body.obligation
  };
}

export function normalizeActivityMappingSourceProjectId(value) {
  const sourceProjectId = String(value || "").trim().toLocaleLowerCase("en");
  if (!UUID_PATTERN.test(sourceProjectId)) {
    throw mappingApiError(
      "contracts_activity_mapping_source_project_invalid",
      "sourceProjectId must be an authoritative MAIN project UUID.",
      400
    );
  }
  return sourceProjectId;
}

function unwrapSingleResult(value) {
  if (Array.isArray(value) && value.length === 1) return value[0];
  return value;
}

async function readResponseJson(response, { code, message }) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw mappingApiError(code, message, 502, error);
  }
}

async function appDataRequest({
  config,
  path,
  options = {},
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS
}) {
  const connection = scheduleSupabaseConfig(config, "app_data");
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
    throw mappingApiError(
      "contracts_activity_mapping_database_missing",
      "APP DATA/KAPAIM is not configured for the Contracts activity-mapping service.",
      503
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS));
  let response;
  try {
    response = await fetchImpl(
      `${String(connection.supabaseUrl).replace(/\/+$/u, "")}${path}`,
      {
        method: options.method || "GET",
        signal: controller.signal,
        headers: supabaseHeaders(connection.supabaseServiceRoleKey, options.headers || {}),
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      }
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw mappingApiError(
      timedOut ? "contracts_activity_mapping_timeout" : "contracts_activity_mapping_transport_failed",
      timedOut
        ? "The Contracts activity-mapping database request timed out."
        : "The Contracts activity-mapping database request failed.",
      timedOut ? 504 : 502,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
  const result = await readResponseJson(response, {
    code: "contracts_activity_mapping_response_invalid",
    message: "The Contracts activity-mapping database returned invalid JSON."
  });
  if (!response.ok) {
    const databaseCode = String(result?.code || "");
    const missingContext = databaseCode === "23503"
      || /no active approved main-to-kapaim project mapping exists/iu.test(String(result?.message || ""));
    const missingSurface = response.status === 404 || ["PGRST202", "42883"].includes(databaseCode);
    throw mappingApiError(
      missingContext
        ? "contracts_activity_mapping_context_not_found"
        : missingSurface
          ? "contracts_activity_mapping_migration_missing"
          : "contracts_activity_mapping_database_failed",
      missingContext
        ? "No active approved MAIN-to-KAPAIM mapping exists for sourceProjectId."
        : missingSurface
          ? "The approved Contracts Phase 3 mapping database surface is unavailable in APP DATA/KAPAIM."
          : String(result?.message || result?.hint || `Activity-mapping database request failed with status ${response.status}.`).slice(0, 1000),
      missingContext ? 404 : missingSurface ? 503 : 502
    );
  }
  if (options.includeExactCount === true) {
    const contentRange = String(response.headers?.get?.("content-range") || "");
    const match = contentRange.match(/\/(\d+)$/u);
    return { data: result, exactCount: match ? Number(match[1]) : null };
  }
  return result;
}

function normalizeProjectContext(value, sourceProjectId) {
  const context = unwrapSingleResult(value);
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw mappingApiError(
      "contracts_activity_mapping_context_invalid",
      "The approved project-mapping resolver returned an invalid context.",
      502
    );
  }
  const normalized = {
    sourceSystem: String(context.sourceSystem || ""),
    sourceProjectId: String(context.sourceProjectId || "").toLocaleLowerCase("en"),
    scheduleProjectId: String(context.scheduleProjectId || "").toLocaleLowerCase("en"),
    projectMappingId: String(context.projectMappingId || "").toLocaleLowerCase("en"),
    mappingStatus: String(context.mappingStatus || "")
  };
  if (
    normalized.sourceSystem !== "main"
    || normalized.sourceProjectId !== sourceProjectId
    || !UUID_PATTERN.test(normalized.scheduleProjectId)
    || !UUID_PATTERN.test(normalized.projectMappingId)
    || normalized.mappingStatus !== "active"
  ) {
    throw mappingApiError(
      "contracts_activity_mapping_context_invalid",
      "The approved project-mapping resolver returned a context that does not match the requested MAIN project.",
      502
    );
  }
  return normalized;
}

function publicTask(task) {
  return {
    activityKey: String(task.activityKey || ""),
    taskUid: Number(task.taskUid ?? task.stableKey),
    name: String(task.name || ""),
    outlineLevel: Number(task.outlineLevel),
    isSummary: task.isSummary === true,
    isMilestone: task.isMilestone === true,
    plannedStart: task.plannedStart ?? null,
    plannedFinish: task.plannedFinish ?? null,
    sourceVersionId: String(task.sourceVersionId || "")
  };
}

function publicMapping(row) {
  return {
    mappingId: String(row.id || ""),
    canonicalKey: String(row.canonical_key || ""),
    alias: String(row.alias || ""),
    aliasSource: String(row.alias_source || ""),
    matchMethod: String(row.match_method || ""),
    confidence: Number(row.confidence),
    status: String(row.status || ""),
    confirmedBy: row.confirmed_by ?? null,
    confirmedAt: row.confirmed_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function mapperMapping(mapping) {
  return {
    canonicalKey: mapping.canonicalKey,
    alias: mapping.alias,
    aliasSource: mapping.aliasSource,
    matchMethod: mapping.matchMethod,
    confidence: mapping.confidence,
    status: mapping.status
  };
}

export async function loadContractActivityMappingState({
  config,
  sourceProjectId: sourceProjectIdInput,
  fetchImpl = fetch,
  loadScheduleSourceImpl = loadScheduleSource,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS,
  includePreviousVersion = false
} = {}) {
  const sourceProjectId = normalizeActivityMappingSourceProjectId(sourceProjectIdInput);
  const rawContext = await appDataRequest({
    config,
    path: `/rest/v1/rpc/${CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC}`,
    options: { method: "POST", body: { p_source_project_id: sourceProjectId } },
    fetchImpl,
    timeoutMs
  });
  const projectContext = normalizeProjectContext(rawContext, sourceProjectId);
  let source;
  try {
    source = await loadScheduleSourceImpl({
      config,
      projectId: projectContext.sourceProjectId,
      includeExactCounts: includePreviousVersion,
      fetchImpl
    });
  } catch (error) {
    if (error instanceof ContractsAgentError) throw error;
    throw mappingApiError(
      "contracts_activity_mapping_schedule_source_failed",
      "The authoritative MAIN Gantt source could not be loaded.",
      502,
      error
    );
  }
  if (!source?.scheduleMeta?.sourceVersionId) {
    throw mappingApiError(
      "contracts_activity_mapping_schedule_not_found",
      "No authoritative Gantt version exists in MAIN for sourceProjectId.",
      404
    );
  }
  const mappingRows = await appDataRequest({
    config,
    path: `/rest/v1/schedule_activity_map?select=${MAPPING_COLUMNS}&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&order=updated_at.desc,id.asc`,
    options: includePreviousVersion
      ? { headers: { Prefer: "count=exact" }, includeExactCount: true }
      : {},
    fetchImpl,
    timeoutMs
  });
  const mappingData = includePreviousVersion ? mappingRows?.data : mappingRows;
  if (!Array.isArray(mappingData)) {
    throw mappingApiError(
      "contracts_activity_mapping_state_invalid",
      "APP DATA/KAPAIM returned an invalid activity-mapping state.",
      502
    );
  }
  const activities = Array.isArray(source.tasks) ? source.tasks.map(publicTask) : [];
  const previousActivities = Array.isArray(source.previousTasks) ? source.previousTasks.map(publicTask) : [];
  const selectedVersions = pickCurrentVersion(Array.isArray(source.files) ? source.files : []);
  const currentFile = selectedVersions.current;
  const previousFile = selectedVersions.previous;
  const previousVersionPeers = previousFile
    ? (source.files || []).filter((file) => (
        file?.file_id !== currentFile?.file_id
        && file?.file_id !== previousFile.file_id
        && previousFile.relevancy_date != null
        && String(file?.relevancy_date ?? "") === String(previousFile.relevancy_date)
      ))
    : [];
  const declaredTaskCount = (file) => {
    if (file?.task_count === null || file?.task_count === undefined || file?.task_count === "") return null;
    const count = Number(file.task_count);
    return Number.isInteger(count) && count >= 0 ? count : null;
  };
  const existingMappings = mappingData.map(publicMapping);
  return {
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_API_VERSION,
    mode: "read_only",
    projectContext,
    scheduleVersion: {
      fileId: String(source.scheduleMeta.sourceVersionId),
      relevancyDate: source.scheduleMeta.relevancyDate ?? null,
      versionConflict: source.scheduleMeta.versionConflict === true
    },
    ...(includePreviousVersion
      ? {
          previousScheduleVersion: previousFile
            ? {
                fileId: String(previousFile.file_id),
                relevancyDate: previousFile.relevancy_date ?? null,
                versionConflict: previousFile.relevancy_date == null || previousVersionPeers.length > 0
              }
            : null,
          sourceCompleteness: {
            versionDeclaredCount: source.exactCounts?.files ?? null,
            versionRowsLoaded: Array.isArray(source.files) ? source.files.length : 0,
            currentVersionSelectionMatches: Boolean(
              currentFile
              && String(currentFile.file_id) === String(source.scheduleMeta.sourceVersionId)
            ),
            currentDeclaredTaskCount: declaredTaskCount(currentFile),
            currentLoadedTaskCount: activities.length,
            currentExactTaskCount: source.exactCounts?.currentTasks ?? null,
            previousDeclaredTaskCount: declaredTaskCount(previousFile),
            previousLoadedTaskCount: previousActivities.length,
            previousExactTaskCount: source.exactCounts?.previousTasks ?? null,
            mappingDeclaredCount: mappingRows.exactCount,
            mappingLoadedCount: existingMappings.length
          },
          sourceVersions: (source.files || []).map((file) => ({
            fileId: file?.file_id ?? null,
            projectId: file?.project_id ?? null,
            relevancyDate: file?.relevancy_date ?? null
          })),
          previousActivities
        }
      : {}),
    counts: {
      activities: activities.length,
      existingMappings: existingMappings.length
    },
    activities,
    existingMappings,
    operationalWritesPerformed: false
  };
}

export async function buildContractActivityMappingCandidatesFromSources({
  config,
  sourceProjectId,
  obligation,
  fetchImpl = fetch,
  loadScheduleSourceImpl = loadScheduleSource,
  timeoutMs = CONTRACTS_ACTIVITY_MAPPING_TIMEOUT_MS
} = {}) {
  const state = await loadContractActivityMappingState({
    config,
    sourceProjectId,
    fetchImpl,
    loadScheduleSourceImpl,
    timeoutMs
  });
  const candidateBundle = buildContractActivityMappingCandidates({
    projectContext: state.projectContext,
    obligation,
    scheduleVersion: state.scheduleVersion,
    tasks: state.activities,
    existingMappings: state.existingMappings.map(mapperMapping)
  });
  return {
    apiVersion: CONTRACTS_ACTIVITY_MAPPING_API_VERSION,
    mode: "read_only",
    candidateBundle,
    sourceCounts: state.counts,
    operationalWritesPerformed: false
  };
}
