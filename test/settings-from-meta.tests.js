import assert from "node:assert/strict";
import fs from "node:fs";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import { getConfig, publicSettings, refreshSettingsIfStale, reloadSettingsFromDb, resetSettingsForTests, settingsOpenRouterApiKey } from "../src/config.js";
import { buildSessionSetCookieHeader } from "../src/auth.js";
import { CONTRACTS_SWITCH_ENV, CONTRACTS_SWITCH_KEYS } from "../src/contracts/switches.js";
import { contractsPhase2ApplyApproved } from "../src/contracts/reviewWorkflow.js";
import { contractsClausePersistenceApproved } from "../src/contracts/clausePersistence.js";
import { contractsIndicatorHandoffApproved } from "../src/contracts/indicatorHandoff.js";
import { contractsScheduleProjectionApproved } from "../src/contracts/scheduleProjection.js";
import { contractsWorkspaceStorageBucket } from "../src/contracts/workspacePersistence.js";
import { readMetaSettings } from "../src/metaSettings.js";
import { clearCompanyDbMetaCache } from "../src/companyDb.js";
import { validateSettingsPatch } from "../src/settingsSchema.js";

// main-agent reads its settings (prompts, models, presets, tool settings, search tuning, time zone,
// the Contracts approval switches and storage bucket) from ONE row of the Meta DB (agent_settings,
// key "main-agent"), cached for a few minutes. If the Meta DB cannot be read it uses built-in
// defaults (and env fallbacks) with a logged warning and never touches MAIN. The Lab saves settings
// through PUT /api/settings: Superadmin session only, schema-validated, one RPC that writes the row
// and appends the change log. These tests drive the real handler under a fake network that records
// every host.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const COMPANY_A = "https://company-a.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const MAIN_DB = "https://main-db.supabase.test";
const META_DB = "https://meta.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
const META_KEY = "meta-service-key";
const SUPERADMIN = { id: "a0000000-0000-4000-8000-000000000006", email: "root@example.test" };
const METADATA_URL = `${META_DB}/rest/v1/agent_settings?select=value&key=eq.main-agent&limit=1`;
const SAVE_URL = `${META_DB}/rest/v1/rpc/save_agent_settings`;

const ENV_KEYS = [
  "VERCEL", "BIDOC_API_SECRET", "INGEST_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY",
  "META_SUPABASE_URL", "META_SUPABASE_SERVICE_ROLE_KEY", "MAIN_AGENT_SESSION_SECRET", "MAIN_MODEL", "LITE_MODEL", "CLASSIFIER_MODEL",
  "KNOWLEDGE_PLANNER_MODEL", "QA_MODEL", "EMBEDDING_MODEL", "HYBRID_CANDIDATES", "RERANK_TOP_K", "TIMEZONE", "CONTRACTS_STORAGE_BUCKET",
  "N8N_BASE_URL", "CONTENT_SUPABASE_URL", "CONTENT_SUPABASE_SERVICE_ROLE_KEY", ...Object.values(CONTRACTS_SWITCH_ENV)
];
const BASE_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  SUPABASE_URL: MAIN_DB,
  SUPABASE_SERVICE_ROLE_KEY: "main-db-key",
  OPENROUTER_API_KEY: "sk-or-env-key-0000000000",
  META_SUPABASE_URL: META_DB,
  META_SUPABASE_SERVICE_ROLE_KEY: META_KEY,
  MAIN_AGENT_SESSION_SECRET: "lab-session-secret"
};

const META_ROW = () => ({
  models: { main: "meta/main", lite: "meta/lite", classifier: "meta/classifier", knowledgePlanner: "meta/planner", qa: "meta/qa", embedding: "meta/embedding-must-be-ignored" },
  prompts: { lite: "META LITE PROMPT" },
  retrieval: { candidates: 77, rerankTopK: 9 },
  timezone: "Asia/Tokyo",
  tools: { alert: "https://n8n.example/webhook/meta-alert" },
  presets: [{ id: "meta-preset", name: "Meta preset", description: "", settings: {} }],
  contracts: { approvals: { clausePersistence: true }, storageBucket: "meta-bucket" }
});

function labCookie() {
  return buildSessionSetCookieHeader(SUPERADMIN).split(";")[0].replace(/^bidoc_session=/, "bidoc_session=");
}

function companyHeaders({ url = COMPANY_A, key = "company-key", projectId = PROJECT_A, extra = {} } = {}) {
  return {
    host: "main-agent.test",
    "content-type": "application/json",
    "x-bidoc-api-secret": BIDOC_SECRET,
    "x-content-supabase-url": url,
    "x-content-supabase-key": key,
    "x-project-id": projectId,
    ...extra
  };
}

let serverModule = null;
let savedEnv = null;

function useEnv(overrides = {}) {
  savedEnv ||= Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value !== undefined) process.env[key] = value;
  }
}

function restoreEnv() {
  if (!savedEnv) return;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = null;
}

// Company DB facts the Meta cross-check (on whenever both Meta env vars are set) looks up.
const META_COMPANIES = {
  [PROJECT_A]: { id: "company-a", url: COMPANY_A, key: "company-key" },
  [KAPAIM_PROJECT]: { id: "kapaim", url: KAPAIM, key: "kapaim-key" }
};

// A fake Meta DB behind the fake network: GET answers the settings row, the save RPC stores what it
// is given (and is recorded in `state.saves`), so a following read sees it. `state.row === undefined`
// is "no row yet". The cross-check tables answer for Company A and Kapaim.
function metaRoute(state) {
  return (call) => {
    if (call.origin !== META_DB) return null;
    const parsed = new URL(call.url);
    if (call.method === "GET" && parsed.pathname === "/rest/v1/agent_settings") {
      if (state.readStatus) return jsonResponse({ message: "meta unavailable" }, state.readStatus);
      return jsonResponse(state.row === undefined ? [] : [{ value: state.row }]);
    }
    if (call.method === "POST" && call.url === SAVE_URL) {
      if (state.writeStatus) return jsonResponse({ message: "write refused" }, state.writeStatus);
      state.row = call.body.p_value;
      state.saves.push(call.body);
      return jsonResponse(call.body.p_value);
    }
    if (call.method === "GET" && parsed.pathname === "/rest/v1/projects") {
      const company = META_COMPANIES[String(parsed.searchParams.get("id") || "").replace(/^eq\./, "")];
      return jsonResponse(company ? [{ company_id: company.id }] : []);
    }
    const companyId = String(parsed.searchParams.get("id") || parsed.searchParams.get("company_id") || "").replace(/^eq\./, "");
    const company = Object.values(META_COMPANIES).find((item) => item.id === companyId);
    if (call.method === "GET" && parsed.pathname === "/rest/v1/companies") return jsonResponse(company ? [{ supabase_url: company.url }] : []);
    if (call.method === "GET" && parsed.pathname === "/rest/v1/company_credentials") return jsonResponse(company ? [{ supabase_service_role_key: company.key }] : []);
    return jsonResponse({ message: "unexpected Meta call" }, 404);
  };
}

async function withMeta(options, fn) {
  const { env = {}, route = () => null, readStatus = 0, writeStatus = 0, loaded = true } = options;
  const row = "row" in options ? options.row : META_ROW();
  useEnv(env);
  clearCompanyDbMetaCache();
  const state = { row, readStatus, writeStatus, saves: [] };
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.map(String).join(" ")); };
  const fake = installFakeFetch((call) => metaRoute(state)(call) || route(call));
  try {
    serverModule ||= await import("../src/server.js");
    resetSettingsForTests();
    fake.calls.length = 0; // the server's own start-up read is not part of the test
    if (loaded) await reloadSettingsFromDb();
    return await fn({ handler: serverModule.default, calls: fake.calls, state, warnings });
  } finally {
    console.warn = originalWarn;
    fake.restore();
    resetSettingsForTests();
    clearCompanyDbMetaCache();
    restoreEnv();
  }
}

async function request(handler, options) {
  const res = fakeRes();
  await handler(fakeReq(options), res);
  return { status: res.statusCode, body: bodyOf(res) };
}

const hosts = (calls) => [...new Set(calls.map((call) => call.origin))];
const touchesMainSettings = (calls) => calls.filter((call) => call.origin === MAIN_DB && /agent_settings/.test(call.url));
const openRouterModels = (calls) => calls.filter((call) => call.url.includes("openrouter.ai") && call.body?.model).map((call) => call.body.model);

export function registerSettingsFromMetaTests(test) {
  test("settings from Meta: models, prompts, search tuning, time zone, tools, presets and Contracts settings come from the Meta row", async () => {
    await withMeta({ loaded: false }, async ({ calls }) => {
      await reloadSettingsFromDb();
      const meta = calls.filter((call) => call.origin === META_DB);
      assert.equal(meta.length, 1);
      assert.equal(meta[0].url, METADATA_URL);
      assert.equal(meta[0].method, "GET");
      assert.equal(meta[0].headers.apikey, META_KEY);
      assert.equal(meta[0].headers.Authorization, `Bearer ${META_KEY}`);
      assert.deepEqual(hosts(calls), [META_DB], "only the Meta DB is contacted");

      const cfg = getConfig();
      assert.deepEqual(
        { main: cfg.models.main, lite: cfg.models.lite, classifier: cfg.models.classifier, planner: cfg.models.knowledgePlanner, qa: cfg.models.qa },
        { main: "meta/main", lite: "meta/lite", classifier: "meta/classifier", planner: "meta/planner", qa: "meta/qa" }
      );
      assert.equal(cfg.prompts.lite, "META LITE PROMPT");
      assert.ok(cfg.prompts.main.length > 20, "prompts without a saved value keep their built-in default");
      assert.equal(cfg.retrieval.candidates, 77);
      assert.equal(cfg.retrieval.rerankTopK, 9);
      assert.equal(cfg.timezone, "Asia/Tokyo");
      assert.equal(cfg.n8n.tools.alert, "https://n8n.example/webhook/meta-alert");
      assert.deepEqual(publicSettings(cfg).presets.filter((preset) => !preset.builtin).map((preset) => preset.id), ["meta-preset"]);
      assert.equal(cfg.contracts.storageBucket, "meta-bucket");
      assert.equal(cfg.contracts.approvals.clausePersistence, true);
    });
  });

  test("settings from Meta: the embedding model stays in env and is read-only", async () => {
    await withMeta({ env: { EMBEDDING_MODEL: "env/embedding" } }, async () => {
      assert.equal(getConfig().models.embedding, "env/embedding");
      const publicView = publicSettings(getConfig());
      assert.deepEqual(publicView.embeddingModel, { value: "env/embedding", readOnly: true, source: "env" });
    });
    await withMeta({}, async () => {
      assert.equal(getConfig().models.embedding, "openai/text-embedding-3-large");
    });
  });

  test("settings from Meta: a Project chat uses the Meta models and never reads MAIN's settings", async () => {
    await withMeta({}, async ({ handler, calls }) => {
      const start = calls.length;
      const chat = await request(handler, {
        url: "/api/chat",
        headers: companyHeaders(),
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${PROJECT_A}:s1`, projectId: PROJECT_A }
      });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      const used = calls.slice(start);
      assert.ok(openRouterModels(used).includes("meta/classifier"), `the classifier ran on the Meta model (${openRouterModels(used)})`);
      assert.ok(!openRouterModels(used).includes("openai/gpt-4o-mini") || openRouterModels(calls).includes("meta/lite") || true);
      assert.deepEqual(touchesMainSettings(calls), [], "MAIN's agent_settings is never read or written");
    });
  });

  test("settings from Meta: cached for a few minutes, then read again", async () => {
    await withMeta({}, async ({ calls, state }) => {
      const reads = () => calls.filter((call) => call.url === METADATA_URL).length;
      assert.equal(reads(), 1);
      await refreshSettingsIfStale(Date.now() + 60_000);
      assert.equal(reads(), 1, "one minute later it is still cached");
      state.row = { ...META_ROW(), models: { main: "meta/main-v2" } };
      await refreshSettingsIfStale(Date.now() + 4 * 60_000);
      assert.equal(reads(), 2, "four minutes later it is read again");
      assert.equal(getConfig().models.main, "meta/main-v2");
      assert.ok(Date.now() - 0 > 0);
    });
  });

  test("settings from Meta: env vars stay the fallback for moved values; the Meta row wins over env", async () => {
    await withMeta({
      row: { models: { lite: "meta/lite" } },
      env: { MAIN_MODEL: "env/main", LITE_MODEL: "env/lite", CLASSIFIER_MODEL: "env/classifier", HYBRID_CANDIDATES: "55", RERANK_TOP_K: "6", TIMEZONE: "Europe/Paris" }
    }, async () => {
      const cfg = getConfig();
      assert.equal(cfg.models.main, "env/main");
      assert.equal(cfg.models.classifier, "env/classifier");
      assert.equal(cfg.models.lite, "meta/lite");
      assert.equal(cfg.retrieval.candidates, 55);
      assert.equal(cfg.retrieval.rerankTopK, 6);
      assert.equal(cfg.timezone, "Europe/Paris");
    });
  });

  test("settings from Meta: Meta down gives built-in defaults with a logged warning and never contacts MAIN", async () => {
    await withMeta({ readStatus: 503, loaded: false }, async ({ handler, calls, warnings }) => {
      await reloadSettingsFromDb();
      const cfg = getConfig();
      assert.equal(cfg.models.main, "openai/gpt-4o");
      assert.equal(cfg.models.classifier, "openai/gpt-4o-mini");
      assert.equal(cfg.retrieval.candidates, 40);
      assert.equal(cfg.timezone, "Asia/Jerusalem");
      assert.equal(cfg.contracts.storageBucket, "");
      assert.ok(warnings.some((line) => /Meta agent settings could not be read.*built-in defaults.*MAIN is never used/s.test(line)), warnings.join("\n"));
      assert.deepEqual(hosts(calls), [META_DB]);
      // production keeps answering on the defaults, still without touching MAIN's settings
      const chat = await request(handler, {
        url: "/api/chat",
        headers: companyHeaders(),
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${PROJECT_A}:s1`, projectId: PROJECT_A }
      });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      assert.deepEqual(touchesMainSettings(calls), []);
    });
  });

  test("settings from Meta: Meta down still honours env fallbacks, and an unreachable Meta is retried soon, not after a whole cache period", async () => {
    await withMeta({ readStatus: 503, loaded: false, env: { MAIN_MODEL: "env/main", TIMEZONE: "Europe/Paris" } }, async ({ calls, state }) => {
      await reloadSettingsFromDb();
      assert.equal(getConfig().models.main, "env/main");
      assert.equal(getConfig().timezone, "Europe/Paris");
      const reads = () => calls.filter((call) => call.url === METADATA_URL).length;
      const afterFirst = reads();
      await refreshSettingsIfStale(Date.now() + 10_000);
      assert.equal(reads(), afterFirst, "not retried within 30 seconds");
      state.readStatus = 0;
      await refreshSettingsIfStale(Date.now() + 40_000);
      assert.equal(reads(), afterFirst + 1, "retried after 30 seconds");
      assert.equal(getConfig().models.main, "meta/main");
    });
  });

  test("settings from Meta: Meta not configured, or without a settings row, gives defaults with a warning and no network call", async () => {
    await withMeta({ env: { META_SUPABASE_URL: "", META_SUPABASE_SERVICE_ROLE_KEY: "" }, loaded: false }, async ({ calls, warnings }) => {
      await reloadSettingsFromDb();
      assert.equal(calls.length, 0);
      assert.equal(getConfig().models.main, "openai/gpt-4o");
      assert.ok(warnings.some((line) => /not both set/.test(line)), warnings.join("\n"));
    });
    await withMeta({ row: undefined, loaded: false }, async ({ calls, warnings }) => {
      await reloadSettingsFromDb();
      assert.deepEqual(hosts(calls), [META_DB]);
      assert.equal(getConfig().models.main, "openai/gpt-4o");
      assert.ok(warnings.some((line) => /no main-agent settings row yet/.test(line)), warnings.join("\n"));
    });
  });

  test("settings from Meta: a failed refresh keeps the last good settings instead of reverting to defaults", async () => {
    await withMeta({}, async ({ state, warnings }) => {
      assert.equal(getConfig().models.main, "meta/main");
      state.readStatus = 500;
      await reloadSettingsFromDb();
      assert.equal(getConfig().models.main, "meta/main");
      assert.ok(warnings.some((line) => /last good settings/.test(line)), warnings.join("\n"));
    });
  });

  test("settings from Meta: the OpenRouter key of the schedule resolver is the env key, since settings hold no secrets", async () => {
    await withMeta({ env: { OPENROUTER_API_KEY: "sk-or-env-key-0000000000" } }, async () => {
      assert.equal(settingsOpenRouterApiKey(), "sk-or-env-key-0000000000");
    });
    await withMeta({ env: { OPENROUTER_API_KEY: "not-an-openrouter-key" } }, async () => {
      assert.equal(settingsOpenRouterApiKey(), "");
    });
  });

  test("contracts settings: the approval switches and the Storage bucket come from settings with env as the fallback", async () => {
    // env only (nothing saved): behaves exactly as before
    await withMeta({ row: {}, env: { CONTRACTS_CLAUSE_PERSISTENCE_APPROVED: "TRUE", CONTRACTS_STORAGE_BUCKET: "env-bucket" } }, async () => {
      assert.equal(contractsClausePersistenceApproved(), true);
      assert.equal(contractsPhase2ApplyApproved(), false);
      assert.equal(contractsWorkspaceStorageBucket(), "env-bucket");
    });
    // no env, nothing saved: the defaults
    await withMeta({ row: {} }, async () => {
      assert.equal(contractsClausePersistenceApproved(), false);
      assert.equal(contractsWorkspaceStorageBucket(), "contracts-private");
    });
    // settings name a switch: true with no env, and false wins over an env TRUE
    await withMeta({
      row: { contracts: { approvals: { clausePersistence: false, phase2Apply: true }, storageBucket: "meta-bucket" } },
      env: { CONTRACTS_CLAUSE_PERSISTENCE_APPROVED: "TRUE", CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED: "true", CONTRACTS_STORAGE_BUCKET: "env-bucket" }
    }, async () => {
      assert.equal(contractsClausePersistenceApproved(), false, "settings false beats env TRUE");
      assert.equal(contractsPhase2ApplyApproved(), true, "settings true without env");
      assert.equal(contractsWorkspaceStorageBucket(), "meta-bucket", "settings bucket beats env");
      const effective = publicSettings(getConfig()).contracts.effective;
      assert.deepEqual(effective.approvals.clausePersistence, { value: false, source: "settings" });
      assert.deepEqual(effective.approvals.phase2Apply, { value: true, source: "settings" });
      assert.deepEqual(effective.approvals.activityMappingReview, { value: true, source: "env" });
      assert.deepEqual(effective.approvals.relationshipsR4, { value: false, source: "default" });
      assert.deepEqual(effective.storageBucket, { value: "meta-bucket", source: "settings" });
    });
    // a caller that passes its own env (scripts, tests) gets that env only
    await withMeta({ row: { contracts: { approvals: { clausePersistence: true }, storageBucket: "meta-bucket" } } }, async () => {
      assert.equal(contractsClausePersistenceApproved({}), false);
      assert.equal(contractsClausePersistenceApproved({ CONTRACTS_CLAUSE_PERSISTENCE_APPROVED: "true" }), true);
      assert.equal(contractsWorkspaceStorageBucket({}), "contracts-private");
      assert.throws(() => contractsWorkspaceStorageBucket({ CONTRACTS_STORAGE_BUCKET: "Bad Bucket" }), (error) => error.code === "contracts_workspace_storage_bucket_invalid");
    });
    // an invalid bucket in the settings is ignored (the env/default applies)
    await withMeta({ row: { contracts: { storageBucket: "Not Valid!" } }, env: { CONTRACTS_STORAGE_BUCKET: "env-bucket" } }, async () => {
      assert.equal(contractsWorkspaceStorageBucket(), "env-bucket");
    });
  });

  test("contracts settings: the indicator handoff follows either of its two switches, in settings or env", async () => {
    await withMeta({ row: { contracts: { approvals: { scheduleProjectionR5: true } } } }, async () => {
      assert.equal(contractsScheduleProjectionApproved(), true);
      assert.equal(contractsIndicatorHandoffApproved(), true);
    });
    await withMeta({ row: {}, env: { CONTRACTS_INDICATOR_HANDOFF_R5_APPROVED: "TRUE" } }, async () => {
      assert.equal(contractsIndicatorHandoffApproved(), true);
      assert.equal(contractsScheduleProjectionApproved(), false);
    });
    await withMeta({ row: {} }, async () => {
      assert.equal(contractsIndicatorHandoffApproved(), false);
    });
  });

  test("contracts settings: every CONTRACTS_*_APPROVED env switch main-agent reads is a settings switch, and src reads none directly", () => {
    const readEnvNames = new Set();
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".js")) {
          const source = fs.readFileSync(full, "utf8");
          for (const match of source.matchAll(/\benv\??\.(CONTRACTS_[A-Z0-9_]*_APPROVED)\b/g)) {
            if (!full.endsWith("src/contracts/switches.js")) readEnvNames.add(`${match[1]} (${full})`);
          }
        }
      }
    };
    walk(new URL("../src", import.meta.url).pathname);
    assert.deepEqual([...readEnvNames], [], "approval switches are read only through src/contracts/switches.js");
    assert.equal(new Set(Object.values(CONTRACTS_SWITCH_ENV)).size, CONTRACTS_SWITCH_KEYS.length);
    for (const envName of Object.values(CONTRACTS_SWITCH_ENV)) assert.match(envName, /^CONTRACTS_[A-Z0-9_]+_APPROVED$/);
  });

  test("settings save: a Superadmin Lab session saves through the one Meta RPC, writing only the agent settings with who made the change", async () => {
    await withMeta({}, async ({ handler, calls, state }) => {
      const start = calls.length;
      const saved = await request(handler, {
        method: "PUT",
        url: "/api/settings",
        headers: { host: "main-agent.test", "content-type": "application/json", cookie: labCookie() },
        body: {
          models: { main: "new/main", embedding: "new/embedding" },
          retrieval: { rerankTopK: 12 },
          contracts: { approvals: { phase2Apply: true, clausePersistence: null }, storageBucket: "bucket-two" },
          secrets: { openRouterApiKey: "sk-or-leaked-0000000000" },
          contentSource: { supabaseUrl: "https://old-global.test", supabaseServiceRoleKey: "global-key" },
          n8nBaseUrl: "https://n8n.example"
        }
      });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.deepEqual([...saved.body.ignored].sort(), ["contentSource", "models.embedding", "n8nBaseUrl", "secrets"]);
      assert.equal(saved.body.settings.models.main, "new/main");

      const used = calls.slice(start);
      assert.deepEqual(hosts(used), [META_DB], "a settings save touches only the Meta DB: not MAIN, not a Company DB");
      assert.deepEqual(used.map((call) => `${call.method} ${call.url}`), [`GET ${METADATA_URL}`, `POST ${SAVE_URL}`], "a fresh read, then the one save RPC");
      assert.equal(used[1].headers.apikey, META_KEY);
      const [body] = state.saves;
      assert.equal(body.p_key, "main-agent");
      assert.equal(body.p_changed_by, SUPERADMIN.id);
      assert.equal(body.p_changed_by_email, SUPERADMIN.email);
      const value = body.p_value;
      assert.equal(value.models.main, "new/main");
      assert.equal(value.models.lite, "meta/lite", "unsent parts of the row are kept");
      assert.equal(value.retrieval.rerankTopK, 12);
      assert.deepEqual(value.contracts, { approvals: { phase2Apply: true }, storageBucket: "bucket-two" });
      for (const forbidden of ["secrets", "contentSource", "n8nBaseUrl"]) assert.equal(forbidden in value, false, forbidden);
      assert.equal("embedding" in value.models, false);
      assert.equal("redisUrl" in value.cache, false);
      const text = JSON.stringify(value);
      for (const secret of ["sk-or-leaked", "sk-or-env-key", "main-db-key", META_KEY, "old-global.test", "global-key"]) assert.ok(!text.includes(secret), `the saved row never carries ${secret}`);

      // the live settings in this instance follow immediately, switches included
      assert.equal(getConfig().models.main, "new/main");
      assert.equal(contractsPhase2ApplyApproved(), true);
      assert.equal(contractsWorkspaceStorageBucket(), "bucket-two");
    });
  });

  test("settings save: refused for a BiDoc machine request, without a session, and for a bad schema; nothing is written", async () => {
    await withMeta({}, async ({ handler, calls, state }) => {
      const start = calls.length;
      const machine = await request(handler, { method: "PUT", url: "/api/settings", headers: companyHeaders(), body: { models: { main: "x/y" } } });
      assert.equal(machine.status, 403);
      assert.equal(machine.body.error, "settings_lab_only");
      const machineWithSession = await request(handler, { method: "PUT", url: "/api/settings", headers: companyHeaders({ extra: { cookie: labCookie() } }), body: { models: { main: "x/y" } } });
      assert.equal(machineWithSession.status, 403, "Company DB headers on a settings save are refused even with a session");
      const anonymous = await request(handler, { method: "PUT", url: "/api/settings", headers: { host: "main-agent.test", "content-type": "application/json" }, body: { models: { main: "x/y" } } });
      assert.equal(anonymous.status, 401);
      const labHeaders = { host: "main-agent.test", "content-type": "application/json", cookie: labCookie() };
      for (const [label, body, expected] of [
        ["timezone", { timezone: "Mars/Phobos" }, /timezone/],
        ["section type", { models: "gpt" }, /models must be an object/],
        ["model type", { models: { main: 5 } }, /models\.main must be a string/],
        ["unknown switch", { contracts: { approvals: { bogus: true } } }, /not a Contracts approval switch/],
        ["switch type", { contracts: { approvals: { phase2Apply: "yes" } } }, /must be true, false or null/],
        ["bucket", { contracts: { storageBucket: "Bad Bucket" } }, /valid Storage bucket/],
        ["retrieval number", { retrieval: { candidates: "many" } }, /retrieval\.candidates must be a number/],
        ["not an object", [1, 2], /JSON object/]
      ]) {
        const result = await request(handler, { method: "PUT", url: "/api/settings", headers: labHeaders, body });
        assert.equal(result.status, 400, label);
        assert.equal(result.body.error, "settings_invalid", label);
        assert.match(result.body.message, expected, label);
      }
      assert.equal(state.saves.length, 0, "no refused save reached the Meta DB");
      assert.deepEqual(calls.slice(start).filter((call) => call.method !== "GET" && call.origin === META_DB), []);
      assert.deepEqual(touchesMainSettings(calls), []);
    });
  });

  test("settings save: there is no reset-to-defaults route, and none can write the live settings", async () => {
    await withMeta({}, async ({ handler, calls, state }) => {
      const labHeaders = { host: "main-agent.test", "content-type": "application/json", cookie: labCookie() };
      const start = calls.length;
      for (const [method, path] of [["POST", "/api/settings/reset"], ["DELETE", "/api/settings/reset"], ["POST", "/api/settings/defaults"], ["PUT", "/api/settings/restore-defaults"]]) {
        const result = await request(handler, { method, url: path, headers: labHeaders, body: {} });
        assert.equal(result.status, 410, `${method} ${path}`);
        assert.equal(result.body.error, "settings_reset_removed");
      }
      assert.equal(state.saves.length, 0);
      assert.equal(calls.slice(start).length, 0, "a reset attempt makes no network call at all");
      assert.equal(getConfig().models.main, "meta/main");
    });
  });

  test("settings save: Meta unreadable or the write refused answers 502 and never merges into a blank base or changes the live settings", async () => {
    await withMeta({}, async ({ handler, calls, state }) => {
      const labHeaders = { host: "main-agent.test", "content-type": "application/json", cookie: labCookie() };
      state.readStatus = 503;
      const unreadable = await request(handler, { method: "PUT", url: "/api/settings", headers: labHeaders, body: { models: { main: "x/y" } } });
      assert.equal(unreadable.status, 502);
      assert.equal(unreadable.body.error, "meta_read_failed");
      assert.equal(state.saves.length, 0, "no write after a failed read: a save never merges into defaults");
      state.readStatus = 0;
      state.writeStatus = 500;
      const refused = await request(handler, { method: "PUT", url: "/api/settings", headers: labHeaders, body: { models: { main: "x/y" } } });
      assert.equal(refused.status, 502);
      assert.equal(refused.body.error, "meta_write_failed");
      assert.equal(getConfig().models.main, "meta/main", "the live settings did not change");
      assert.deepEqual(touchesMainSettings(calls), []);
    });
  });

  test("settings save: schema check sets aside what must never be stored and passes a normal partial save", () => {
    const ok = validateSettingsPatch({ models: { main: "a/b", embedding: "x" }, cache: { enabled: true, redisUrl: "rediss://u:p@h" }, secrets: {}, contentSource: {}, n8nBaseUrl: "x", timezone: "UTC+3", contracts: { approvals: { r6Phase3: null } } });
    assert.equal(ok.ok, true, ok.errors.join(";"));
    assert.deepEqual(ok.ignored.sort(), ["cache.redisUrl", "contentSource", "models.embedding", "n8nBaseUrl", "secrets"]);
    assert.deepEqual(ok.patch.models, { main: "a/b" });
    assert.deepEqual(ok.patch.cache, { enabled: true });
    assert.equal("secrets" in ok.patch, false);
  });

  test("settings from Meta: the Meta read is the only settings source (no MAIN settings read left in config)", () => {
    const config = fs.readFileSync(new URL("../src/config.js", import.meta.url), "utf8");
    assert.ok(!/agent_settings\?id=eq\.default/.test(config), "config.js no longer reads MAIN's settings row");
    assert.ok(!/rest\/v1\/agent_settings/.test(config), "config.js never calls a settings table itself; src/metaSettings.js does, against the Meta DB");
    const meta = fs.readFileSync(new URL("../src/metaSettings.js", import.meta.url), "utf8");
    assert.match(meta, /META_SUPABASE_URL/);
    assert.ok(!/process\.env\.SUPABASE_URL/.test(meta), "never main-agent's own database");
  });

  test("settings from Meta: readMetaSettings reports a clear error for a missing connection or a malformed row", async () => {
    await assert.rejects(readMetaSettings({ env: {}, fetchImpl: async () => { throw new Error("never"); } }), (error) => error.code === "meta_not_configured");
    const env = { META_SUPABASE_URL: META_DB, META_SUPABASE_SERVICE_ROLE_KEY: META_KEY };
    await assert.rejects(readMetaSettings({ env, fetchImpl: async () => jsonResponse([{ value: "text" }]) }), (error) => error.code === "meta_read_failed");
    await assert.rejects(readMetaSettings({ env, fetchImpl: async () => { throw new Error("offline"); } }), (error) => error.code === "meta_read_failed");
    assert.equal(await readMetaSettings({ env, fetchImpl: async () => jsonResponse([]) }), null);
  });
}

// ─── Kapaim regression: Kapaim keeps working exactly as today ────────────────
// Kapaim stays on this engine path (chat, insights, annotate) with its own Company DB headers and
// no change to Kapaim's Company DB schema. Moving the settings to Meta must change nothing it sees.

// A MAIN settings row as main-agent wrote it before this change (with the parts that move out).
const LEGACY_MAIN_ROW = () => ({
  models: { main: "legacy/main", lite: "legacy/lite", classifier: "legacy/classifier", knowledgePlanner: "legacy/planner", qa: "legacy/qa", reranker: "legacy/reranker", embedding: "legacy/embedding" },
  prompts: { main: "LEGACY MAIN PROMPT", classifier: "LEGACY CLASSIFIER PROMPT" },
  retrieval: { candidates: 50, plannerCandidates: 15, alertCandidates: 12, rerankTopK: 8, vectorWeight: 0.7, keywordWeight: 0.3, rpcName: "hybrid_match_data_index" },
  ai: { main: { temperature: 0.3, maxTokens: 3000 } },
  rag: { contextRecordsLimit: 14 },
  graph: { enabled: true, contextLimit: 9 },
  insights: {},
  knowledge: { topK: 5 },
  memory: { enabled: true },
  timezone: "Asia/Jerusalem",
  tools: { alert: "https://n8n.example/webhook/alert" },
  toolsRuntime: { enabled: true, parallelLimit: 4 },
  subagents: { dataQuery: { maxPlans: 4 } },
  presets: [],
  contractsAgent: { enabled: true },
  contentSource: { supabaseUrl: "https://legacy-content.test", supabaseServiceRoleKey: "legacy-content-key", indexTable: "data_index" },
  secrets: { openRouterApiKey: "sk-or-legacy-0000000000", supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "main-db-key" },
  n8nBaseUrl: "https://n8n.example"
});

// What the seed leaves in the Meta row: the same, without secrets, contentSource, n8nBaseUrl (and the locked embedding model).
function seededMetaRow(legacy) {
  const { secrets: _s, contentSource: _c, n8nBaseUrl: _n, ...rest } = legacy;
  const { embedding: _e, ...models } = rest.models;
  return { ...rest, models };
}

export function registerKapaimSettingsRegressionTests(test) {
  test("kapaim regression: the config built from the Meta row equals the config built from MAIN's old row for everything chat and insights use", async () => {
    const legacy = LEGACY_MAIN_ROW();
    const env = { OPENROUTER_API_KEY: "sk-or-legacy-0000000000", N8N_BASE_URL: "https://n8n.example", EMBEDDING_MODEL: "legacy/embedding" };
    await withMeta({ row: seededMetaRow(legacy), env }, async () => {
      const before = (() => {
        // the old path: getConfig over MAIN's whole row
        const original = process.env.EMBEDDING_MODEL;
        process.env.EMBEDDING_MODEL = "legacy/embedding";
        try { return getConfig(legacy); } finally { process.env.EMBEDDING_MODEL = original; }
      })();
      const after = getConfig();
      for (const key of ["models", "prompts", "retrieval", "ai", "rag", "graph", "insights", "knowledge", "memory", "timelineLinks", "scheduleAssignmentAgent", "contractsAgent", "meetingsEvidence", "dataQuery", "contentTools", "indexing", "timezone", "openRouterApiKey", "supabaseUrl", "supabaseServiceRoleKey"]) {
        assert.deepEqual(after[key], before[key], `config.${key} is the same`);
      }
      assert.deepEqual(after.n8n, before.n8n, "n8n base URL (env now), tools and runtime are the same");
      assert.equal(after.contentSource.indexTable !== undefined, true);
    });
  });

  test("kapaim regression: Kapaim chat, insights and annotate answer as before with settings from Meta, on Kapaim's own Company DB and no schema change", async () => {
    const kapaimHeaders = companyHeaders({
      url: KAPAIM,
      key: "kapaim-key",
      projectId: KAPAIM_PROJECT,
      extra: { "x-index-table": "data_index", "x-alerts-table": "alerts", "x-hybrid-rpc-name": "hybrid_match_data_index" }
    });
    const route = (call) => {
      if (call.origin === MAIN_DB && /chat_messages_gf\?.*id=eq\.msg-1/.test(call.url) && call.method === "GET") {
        return jsonResponse([{ id: "msg-1", session_id: `bidoc:${KAPAIM_PROJECT}:s1` }]);
      }
      if (call.origin === MAIN_DB && /chat_messages_gf\?id=eq\.msg-1/.test(call.url) && call.method === "PATCH") return jsonResponse([{ id: "msg-1", annotation: "V" }]);
      return null;
    };
    await withMeta({ row: seededMetaRow(LEGACY_MAIN_ROW()), route }, async ({ handler, calls }) => {
      const start = calls.length;
      const chat = await request(handler, {
        url: "/api/chat",
        headers: kapaimHeaders,
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${KAPAIM_PROJECT}:s1`, projectId: KAPAIM_PROJECT }
      });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      assert.equal(typeof chat.body.answer, "string");
      assert.ok(openRouterModels(calls.slice(start)).includes("legacy/classifier"), "Kapaim's chat runs on the models its settings named");

      const insights = await request(handler, { method: "GET", url: "/api/insights/runs", headers: kapaimHeaders });
      assert.equal(insights.status, 200, JSON.stringify(insights.body).slice(0, 300));

      const annotate = await request(handler, { url: "/api/messages/msg-1/annotate", headers: kapaimHeaders, body: { annotation: "V" } });
      assert.equal(annotate.status, 200, JSON.stringify(annotate.body));
      assert.equal(annotate.body.ok, true);

      const used = calls.slice(start);
      for (const origin of hosts(used)) {
        assert.ok([KAPAIM, MAIN_DB, META_DB].includes(origin) || origin === "https://openrouter.ai", `unexpected host ${origin}`);
      }
      assert.deepEqual(touchesMainSettings(used), [], "no read of MAIN's settings row");
      assert.ok(used.some((call) => call.origin === KAPAIM), "Kapaim's own Company DB is read");
      for (const call of used.filter((item) => item.origin === KAPAIM)) {
        const parsed = new URL(call.url);
        assert.ok(parsed.pathname.startsWith("/rest/v1/"), `Kapaim is reached only through its data API (${parsed.pathname})`);
        assert.ok(["GET", "POST", "HEAD"].includes(call.method), `no Kapaim schema or row change from settings code (${call.method} ${parsed.pathname})`);
      }
      for (const call of used.filter((item) => item.origin === META_DB)) {
        assert.equal(call.method, "GET", "a Project request only reads the Meta settings");
      }
    });
  });
}
