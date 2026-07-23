import crypto from "node:crypto";

// Login wall for the standalone (same-origin) UI — restricted to bidoc superadmins.
// Cross-tenant calls from the bidoc web app (x-content-supabase-url + x-bidoc-api-secret)
// are a separate, already-authenticated path and are not affected by this module.

const COOKIE_NAME = "bidoc_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SUPERADMIN_ROLE = "סופראדמין";

function sessionSecret() {
  return process.env.MAIN_AGENT_SESSION_SECRET || process.env.BIDOC_API_SECRET || "";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64) {
  const secret = sessionSecret();
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function createSessionCookieValue(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: SUPERADMIN_ROLE,
    exp: Date.now() + SESSION_TTL_MS
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifySessionCookieValue(value) {
  if (!value || !sessionSecret()) return null;
  const parts = String(value).split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload?.exp || Date.now() > payload.exp) return null;
  if (payload.role !== SUPERADMIN_ROLE) return null;
  return payload;
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

export function getSuperadminSession(req) {
  const cookies = parseCookies(req);
  return verifySessionCookieValue(cookies[COOKIE_NAME]);
}

export function buildSessionSetCookieHeader(user) {
  const value = createSessionCookieValue(user);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildLogoutSetCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ─── Authenticate against bidoc's own (meta) Supabase Auth + profiles table ────
// Reuses the exact same users/roles bidoc itself uses ("סופראדמין" role),
// so there is no separate user store to maintain for this login wall.

export async function authenticateAgainstBidoc(email, password) {
  const url = String(process.env.BIDOC_META_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.BIDOC_META_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    throw new Error("BIDOC_META_SUPABASE_URL / BIDOC_META_SUPABASE_ANON_KEY are not configured on this deployment");
  }
  if (!email || !password) throw new Error("נדרשים אימייל וסיסמה");

  const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password })
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.msg || "פרטי התחברות שגויים");
  }

  const userId = tokenJson.user?.id;
  const profileRes = await fetch(`${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${tokenJson.access_token}` }
  });
  const profileJson = await profileRes.json().catch(() => []);
  const role = Array.isArray(profileJson) ? profileJson[0]?.role : null;
  if (role !== SUPERADMIN_ROLE) {
    throw new Error("הגישה למערכת זו מוגבלת למשתמשי סופראדמין בלבד");
  }

  return { id: userId, email: tokenJson.user?.email || email };
}
