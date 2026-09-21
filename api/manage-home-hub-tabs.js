// api/manage-home-hub-tabs.js
//
// Mirrors the auth pattern your existing api/manage-admin.js already
// uses (verify the caller's Supabase access token server-side, check
// admin status, then use the SERVICE ROLE key to do the actual write —
// never the anon key, and never trust a client-side isAdmin check
// alone). I haven't seen manage-admin.js itself, so this re-implements
// that pattern from how AdminPanel.jsx calls it (callApi: POST,
// `Authorization: Bearer <token>`, JSON body). Adjust the admin-check
// block below to match whatever manage-admin.js actually does if it
// differs from this.
//
// Actions:
//   { action: "list" }                                   -> { tabs, overrides }
//   { action: "toggle", key, is_visible }                 -> { ok }
//   { action: "reorder", updates: [{ key, sort_order }] } -> { ok }
//   { action: "rename", key, label }                      -> { ok }
//   { action: "set_audience", key, audience }             -> { ok }
//     audience: 'everyone' | 'logged_in' | 'guests_only'
//   { action: "set_rollout", key, rollout_percent }        -> { ok }
//     rollout_percent: 0-100, the stable slice of matching viewers who
//     see the tab (see hashToPercent() in HomeHub.jsx for the bucketing)
//   { action: "add_override", key, username, show }        -> { ok }
//     Force a specific username in (show: true) or out (show: false),
//     overriding is_visible/audience/rollout_percent entirely.
//   { action: "remove_override", key, username }           -> { ok }

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Same hardcoded root-admin fallback as AdminPanel.jsx's ADMIN_EMAILS —
// keep these two lists in sync.
const ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getCallerEmail(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user.email.trim().toLowerCase();
}

async function isAdmin(email) {
  if (!email) return false;
  if (ADMIN_EMAILS.includes(email)) return true;

  // Matches the admin_users table implied by AdminPanel.jsx's Admins
  // tab (a.email, a.root, a.added_by, a.created_at).
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getCallerEmail(req);
  const admin = await isAdmin(email);
  if (!admin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { action } = req.body || {};

  try {
    if (action === "list") {
      const [{ data: tabs, error: tabsErr }, { data: overrides, error: overridesErr }] =
        await Promise.all([
          supabaseAdmin.from("home_hub_tabs").select("*").order("sort_order", { ascending: true }),
          supabaseAdmin.from("home_hub_tab_overrides").select("*").order("created_at", { ascending: false }),
        ]);
      if (tabsErr) throw tabsErr;
      if (overridesErr) throw overridesErr;
      return res.status(200).json({ tabs: tabs || [], overrides: overrides || [] });
    }

    if (action === "toggle") {
      const { key, is_visible } = req.body;
      if (!key || typeof is_visible !== "boolean") {
        return res.status(400).json({ error: "key and is_visible are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tabs")
        .update({ is_visible })
        .eq("key", key);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "reorder") {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "updates array is required" });
      }
      for (const u of updates) {
        const { error } = await supabaseAdmin
          .from("home_hub_tabs")
          .update({ sort_order: u.sort_order })
          .eq("key", u.key);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "set_audience") {
      const { key, audience } = req.body;
      const VALID = ["everyone", "logged_in", "guests_only"];
      if (!key || !VALID.includes(audience)) {
        return res.status(400).json({ error: "key and a valid audience are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tabs")
        .update({ audience })
        .eq("key", key);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "rename") {
      const { key, label } = req.body;
      if (!key || !label) {
        return res.status(400).json({ error: "key and label are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tabs")
        .update({ label })
        .eq("key", key);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "set_rollout") {
      const { key, rollout_percent } = req.body;
      const pct = Number(rollout_percent);
      if (!key || !Number.isInteger(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: "key and rollout_percent (0-100) are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tabs")
        .update({ rollout_percent: pct })
        .eq("key", key);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "add_override") {
      const { key, username, show } = req.body;
      if (!key || !username || typeof show !== "boolean") {
        return res.status(400).json({ error: "key, username, and show are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tab_overrides")
        .upsert({ tab_key: key, username: username.trim(), show }, { onConflict: "tab_key,username" });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === "remove_override") {
      const { key, username } = req.body;
      if (!key || !username) {
        return res.status(400).json({ error: "key and username are required" });
      }
      const { error } = await supabaseAdmin
        .from("home_hub_tab_overrides")
        .delete()
        .eq("tab_key", key)
        .eq("username", username);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[manage-home-hub-tabs] error:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}