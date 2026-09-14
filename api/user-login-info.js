/**
 * ZIXPLON — admin-only endpoint: per-user login method, last login
 * time, last known IP/device, and ban status.
 *
 * "Login method" comes from Supabase auth.users' identities (Google,
 * Email/Password, etc). Actual passwords are NEVER retrievable here or
 * anywhere else — Supabase stores only one-way hashes, not even
 * Supabase itself can recover a plaintext password.
 *
 * "Last IP" / "Last device" come from the most recent site_visits row
 * for that username (see useVisitTracking.js + api/record-visit-ip.js).
 * These reflect the most recent WEBSITE VISIT, not necessarily the
 * exact moment of the last login — close enough for moderation
 * purposes, but worth knowing if precision matters.
 *
 * "is_banned" / "banned_until" come straight from Supabase auth (see
 * api/moderate-user.js, which is what actually sets/clears this).
 *
 * Required env vars (same as api/manage-admin.js):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Keep in sync with ADMIN_EMAILS in AdminPanel.jsx / manage-admin.js.
const ROOT_ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

async function callerIsAdmin(accessToken) {
  if (!accessToken) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user?.email) return false;
  const email = data.user.email.trim().toLowerCase();
  if (ROOT_ADMIN_EMAILS.includes(email)) return true;
  const { data: row } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!row;
}

// Pulls every auth user via the Admin API, paginating until exhausted.
// Capped at 20 pages (2000 users at perPage=100) as a sanity ceiling —
// raise this if ZIXPLON's user base grows past that.
async function listAllAuthUsers() {
  const perPage = 100;
  let page = 1;
  const all = [];
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all.push(...(data?.users || []));
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

const PROVIDER_LABELS = {
  google: "Google",
  email: "Email/Password",
  facebook: "Facebook",
  apple: "Apple",
  github: "GitHub",
};
const providerLabel = (p) => PROVIDER_LABELS[p] || p;

// Supabase represents "not banned" as banned_until being null OR a
// timestamp already in the past (can happen right after an unban, or
// with a short ban that expired naturally).
const isCurrentlyBanned = (bannedUntil) => {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!(await callerIsAdmin(token))) {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const [authUsers, profilesRes, visitsRes] = await Promise.all([
      listAllAuthUsers(),
      supabaseAdmin.from("profiles").select("id, username"),
      supabaseAdmin
        .from("site_visits")
        .select("username, ip_address, user_agent, started_at")
        .order("started_at", { ascending: false })
        .limit(5000),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (visitsRes.error) throw visitsRes.error;

    const usernameById = new Map((profilesRes.data || []).map((p) => [p.id, p.username]));

    // Latest visit per username — visits are already ordered newest
    // first, so the first one seen per username wins.
    const latestVisitByUsername = new Map();
    for (const v of visitsRes.data || []) {
      if (!v.username || latestVisitByUsername.has(v.username)) continue;
      latestVisitByUsername.set(v.username, v);
    }

    const rows = authUsers.map((u) => {
      const username = usernameById.get(u.id) || null;
      const identityProviders = Array.from(
        new Set((u.identities || []).map((i) => i.provider)),
      );
      const providers = identityProviders.length
        ? identityProviders.map(providerLabel)
        : [providerLabel(u.app_metadata?.provider || "email")];
      const latestVisit = username ? latestVisitByUsername.get(username) : null;

      return {
        id: u.id,
        email: u.email || "",
        username,
        providers,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        last_ip: latestVisit?.ip_address || null,
        last_device: latestVisit?.user_agent || null,
        last_seen_at: latestVisit?.started_at || null,
        banned_until: u.banned_until || null,
        is_banned: isCurrentlyBanned(u.banned_until),
      };
    });

    return res.status(200).json({ users: rows });
  } catch (e) {
    console.error("[user-login-info]", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}