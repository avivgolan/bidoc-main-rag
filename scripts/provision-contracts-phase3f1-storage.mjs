import { getConfig, initSettings, loadEnv, supabaseHeaders, supabaseKeyRole } from "../src/config.js";
import { scheduleSupabaseConfig } from "../src/scheduleIngestion.js";

const TARGET_HOST = "smxibuaowzuxkznuouwj.supabase.co";
const BUCKET = "contracts-private";
const FILE_SIZE_LIMIT = 3_000_000;
const ALLOWED_MIME_TYPES = ["application/pdf"];

if (!process.argv.includes("--create")) {
  throw new Error("Refusing to provision Storage without the explicit --create argument.");
}

loadEnv();
await initSettings();

const connection = scheduleSupabaseConfig(getConfig(), "app_data");
const host = new URL(connection.supabaseUrl).hostname;
const keyRole = supabaseKeyRole(connection.supabaseServiceRoleKey);
if (host !== TARGET_HOST || keyRole !== "service_role") {
  throw new Error("APP DATA must resolve to the dedicated KAPAIM service-role connection.");
}

const headers = supabaseHeaders(connection.supabaseServiceRoleKey);

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Storage returned invalid JSON with status ${response.status}.`);
  }
}

async function getBucket() {
  const response = await fetch(`${connection.supabaseUrl}/storage/v1/bucket/${encodeURIComponent(BUCKET)}`, {
    method: "GET",
    headers
  });
  return { response, data: await readJson(response) };
}

function isMissingBucket({ response, data }) {
  return response.status === 404
    || (response.status === 400 && /(?:no\s*such\s*bucket|bucket\s+not\s+found)/iu.test(
      String(data?.error || data?.code || data?.message || "")
    ));
}

async function waitForBucket() {
  let current;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    current = await getBucket();
    if (!isMissingBucket(current)) return current;
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return current;
}

let created = false;
let current = await getBucket();
const missing = isMissingBucket(current);

if (missing) {
  const response = await fetch(`${connection.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: FILE_SIZE_LIMIT,
      allowed_mime_types: ALLOWED_MIME_TYPES
    })
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(`Storage bucket creation failed with status ${response.status}: ${String(data?.message || data?.error || "unknown error").slice(0, 300)}`);
  }
  created = true;
  current = await waitForBucket();
  if (isMissingBucket(current)) {
    throw new Error("Storage accepted the bucket creation request but the bucket is still absent.");
  }
}

if (!current.response.ok) {
  throw new Error(`Storage bucket verification failed with status ${current.response.status}: ${String(current.data?.message || current.data?.error || current.data?.code || "unknown error").slice(0, 300)}`);
}

const allowedMimeTypes = current.data?.allowed_mime_types ?? current.data?.allowedMimeTypes;
const fileSizeLimit = Number(current.data?.file_size_limit ?? current.data?.fileSizeLimit);
if (
  current.data?.name !== BUCKET
  || current.data?.public !== false
  || !Array.isArray(allowedMimeTypes)
  || allowedMimeTypes.length !== 1
  || allowedMimeTypes[0] !== "application/pdf"
  || fileSizeLimit !== FILE_SIZE_LIMIT
) {
  throw new Error("Storage bucket exists but does not match the Phase 3F.1 safety contract.");
}

console.log(JSON.stringify({
  ok: true,
  created,
  host,
  bucket: current.data.name,
  public: current.data.public,
  allowedMimeTypes,
  fileSizeLimit
}));
