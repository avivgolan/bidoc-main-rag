import { getConfig, initSettings, loadEnv, supabaseHeaders } from "../src/config.js";
import { contentSupabaseConfig } from "../src/supabase.js";

loadEnv();
await initSettings();

const config = getConfig();
const inspectMain = process.argv.includes("--main");
const connection = inspectMain
  ? {
      // MAIN settings persistence deliberately prefers the server bootstrap
      // credentials. Use that same verified connection for this read-only
      // schema check; never print either value.
      supabaseUrl: process.env.SUPABASE_URL || config.supabaseUrl,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || config.supabaseServiceRoleKey
    }
  : contentSupabaseConfig(config);
if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
  throw new Error(`${inspectMain ? "App / MAIN" : "APP DATA"} is not configured`);
}

const schemaResponse = await fetch(`${connection.supabaseUrl}/rest/v1/`, {
  headers: {
    ...supabaseHeaders(connection.supabaseServiceRoleKey),
    Accept: "application/openapi+json"
  }
});
const schemaText = await schemaResponse.text();
const schema = schemaText ? JSON.parse(schemaText) : {};
if (!schemaResponse.ok) {
  throw new Error(schema?.message || `${inspectMain ? "App / MAIN" : "APP DATA"} schema request failed: ${schemaResponse.status}`);
}

const definitions = schema.definitions || schema.components?.schemas || {};
const schedulePattern = /(gantt|schedule|calendar|milestone|contract|alert)/i;
const tableNames = inspectMain
  ? Object.keys(definitions).filter((name) => /gantt/i.test(name)).sort()
  : Object.keys(definitions).filter((name) => schedulePattern.test(name)).sort();
const tables = [];

for (const table of tableNames) {
  const response = await fetch(
    `${connection.supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=id`,
    {
      method: "HEAD",
      headers: {
        ...supabaseHeaders(connection.supabaseServiceRoleKey),
        Prefer: "count=exact",
        Range: "0-0"
      }
    }
  );
  const contentRange = response.headers.get("content-range") || "";
  const total = contentRange.includes("/") ? contentRange.split("/").pop() : null;
  tables.push({
    table,
    rows: total && total !== "*" ? Number(total) : null,
    columns: Object.keys(definitions[table]?.properties || {}).sort(),
    dataApiStatus: response.status
  });
}

const rpcNames = Object.keys(schema.paths || {})
  .filter((path) => path.startsWith("/rpc/") && schedulePattern.test(path))
  .map((path) => path.slice("/rpc/".length))
  .sort();

const projectRef = new URL(connection.supabaseUrl).hostname.split(".")[0];
console.log(JSON.stringify({ source: inspectMain ? "App / MAIN" : "APP DATA / KAPAIM", projectRef, tables, rpcNames }, null, 2));
