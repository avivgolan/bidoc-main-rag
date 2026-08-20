const COMMIT_SHA_KEYS = ["VERCEL_GIT_COMMIT_SHA", "GIT_COMMIT_SHA", "COMMIT_SHA"];

function normalizedCommitSha(env = {}) {
  const rawValue = COMMIT_SHA_KEYS.map((key) => env[key]).find(Boolean);
  const value = String(rawValue || "").trim();
  return /^[0-9a-f]{7,64}$/iu.test(value) ? value.toLowerCase() : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildVersionInfo(env = process.env) {
  const fullSha = normalizedCommitSha(env);
  const environment = String(env.VERCEL_ENV || env.NODE_ENV || "local").trim().toLowerCase() || "local";
  return {
    version: fullSha ? fullSha.slice(0, 7) : "local",
    fullSha: fullSha || "local",
    environment
  };
}

export function injectBuildVersion(html, info = buildVersionInfo()) {
  const title = `${info.environment} · ${info.fullSha}`;
  return String(html)
    .replaceAll("__BIDOC_BUILD_VERSION__", escapeHtml(info.version))
    .replaceAll("__BIDOC_BUILD_TITLE__", escapeHtml(title));
}
