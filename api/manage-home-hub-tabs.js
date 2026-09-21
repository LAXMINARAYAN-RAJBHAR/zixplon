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
//   { action: "list" }                                   -> { tabs }
//   { action: "toggle", key, is_visible }                 -> { ok }
//   { action: "reorder", updates: [{ key, sort_order }] } -> { ok }
//   { action: "rename", key, label }                      -> { ok }

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
      const { data, error } = await supabaseAdmin
        .from("home_hub_tabs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return res.status(200).json({ tabs: data || [] });
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

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[manage-home-hub-tabs] error:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}