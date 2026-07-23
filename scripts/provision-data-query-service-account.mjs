import { getConfig, loadEnv, supabaseHeaders } from "../src/config.js";
import { contentSupabaseConfig } from "../src/supabase.js";

loadEnv();
const config = getConfig();
const connection = contentSupabaseConfig(config);
const email = String(config.dataQueryServiceEmail || "").trim().toLowerCase();
const password = String(config.dataQueryServicePassword || "");

if (config.contentSource?.usesAppSupabase === true) {
  throw new Error(
    "Refusing to provision Data Query in App/MAIN Supabase. Set explicit CONTENT_SUPABASE_URL and CONTENT_SUPABASE_SERVICE_ROLE_KEY first"
  );
}
if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
  throw new Error("Content Supabase URL and server API key are required");
}
if (!email || !password) {
  throw new Error("Set DATA_QUERY_SUPABASE_SERVICE_EMAIL and DATA_QUERY_SUPABASE_SERVICE_PASSWORD first");
}

const headers = {
  ...supabaseHeaders(connection.supabaseServiceRoleKey),
  Authorization: `Bearer ${connection.supabaseServiceRoleKey}`
};

let user = await findUser(email);
if (!user) {
  user = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { data_query_role: "bidoc_data_query" }
    })
  });
} else {
  user = await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
    method: "PUT",
    body: JSON.stringify({
      password,
      email_confirm: true,
      app_metadata: {
        ...(user.app_metadata || {}),
        data_query_role: "bidoc_data_query"
      }
    })
  });
}

console.log(`Data Query service account is ready: ${user.email} (${user.id})`);

async function findUser(targetEmail) {
  const pageSize = 100;
  for (let page = 1; page <= 100; page += 1) {
    const data = await adminRequest(`/auth/v1/admin/users?page=${page}&per_page=${pageSize}`);
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((item) => String(item.email || "").toLowerCase() === targetEmail);
    if (match) return match;
    if (users.length < pageSize) return null;
  }
  throw new Error("Could not finish scanning Supabase Auth users");
}

async function adminRequest(path, options = {}) {
  const response = await fetch(`${connection.supabaseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data?.msg || data?.message || `Supabase Auth admin request failed: ${response.status}`);
  return data;
}
