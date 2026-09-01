const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const MAIN_STUDYCASE_SOURCE_PROJECT_ID = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
export const KAPAIM_STUDYCASE_PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";

function normalizeProjectId(value) {
  const id = String(value || "").trim().toLocaleLowerCase("en");
  return UUID_PATTERN.test(id) ? id : "";
}

export function isKapaimStudyCaseProjectId(value) {
  const id = normalizeProjectId(value);
  return id === KAPAIM_STUDYCASE_PROJECT_ID;
}

export function isKapaimStudyCaseTwin(value) {
  const id = normalizeProjectId(value);
  return id === KAPAIM_STUDYCASE_PROJECT_ID || id === MAIN_STUDYCASE_SOURCE_PROJECT_ID;
}

/**
 * Bidoc-facing lab reads use Kapaim public `contract_workspaces`.
 * MAIN is the activity-mapping twin, not a second contracts list.
 * Any other project id is hidden here; classify/persist still writes that id.
 */
export function resolvePublicContractProjectId(sourceProjectId) {
  const id = normalizeProjectId(sourceProjectId);
  if (!id || isKapaimStudyCaseTwin(id)) return KAPAIM_STUDYCASE_PROJECT_ID;
  return null;
}
