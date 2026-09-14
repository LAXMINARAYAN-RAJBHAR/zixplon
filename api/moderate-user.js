/**
 * ZIXPLON — admin-only endpoint: ban, unban, or permanently delete a
 * user account, optionally removing all of their uploaded content
 * (videos, reels, posts, comments, reactions) at the same time.
 *
 * Actions:
 *   "ban"    — disables the account's ability to log in/authenticate
 *              (Supabase auth ban), without touching their existing
 *              content unless removeContent is also passed.
 *   "unban"  — lifts a ban, restoring normal login.
 *   "delete" — permanently deletes the auth account AND its profiles
 *              row. This cannot be undone. Pass removeContent: true to
 *              also delete everything they've ever posted/uploaded.
 *
 * The caller can identify the target user by EITHER userId (from
 * api/user-login-info.js rows) OR username (e.g. a report's
 * content_owner field, which is a username string, not a user id) —
 * username is resolved to an id via the profiles table server-side.
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

async function resolveCaller(accessToken) {
  if (!accessToken) return { email: null, isAdmin: false };
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user?.email) return { email: null, isAdmin: false };
  const email = data.user.email.trim().toLowerCase();
  if (ROOT_ADMIN_EMAILS.includes(email)) return { email, isAdmin: true };
  const { data: row } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return { email, isAdmin: !!row };
}

// Resolves a target to an auth user id — either the id was already
// given, or a username needs a profiles lookup first.
async function resolveTargetUserId({ userId, username }) {
  if (userId) return userId;
  if (!username) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return data?.id || null;
}

// Resolves a target to a username — needed for content cleanup, since
// videos/reels/posts/etc. all key off username text, not the auth id.
async function resolveTargetUsername({ userId, username }) {
  if (username) return username;
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username || null;
}

// Deletes every piece of content a username has ever created across
// the app's tables. Uses allSettled so one table failing (e.g. a stray
// FK constraint) doesn't stop the rest from being cleaned up — this is
// a moderation action where "mostly removed" is far better than "not
// removed because one table errored first."
async function removeAllContentForUser(username) {
  const results = await Promise.allSettled([
    supabaseAdmin.from("videos").delete().eq("username", username),
    supabaseAdmin.from("reels").delete().eq("username", username),
    supabaseAdmin.from("posts").delete().eq("username", username),
    supabaseAdmin.from("post_comments").delete().eq("username", username),
    supabaseAdmin.from("post_reactions").delete().eq("username", username),
  ]);
  const failures = results
    .map((r, i) => (r.status === "rejected" ? { table: i, reason: r.reason } : null))
    .filter(Boolean);
  if (failures.length) {
    console.warn("[moderate-user] partial content cleanup failure:", failures);
  }
}

// Supabase's ban_duration accepts a duration string. There's no
// built-in "forever" — 100 years is the conventional way admin tools
// express a permanent ban against this API.
const PERMANENT_BAN_DURATION = "876000h";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { isAdmin } = await resolveCaller(token);
  if (!isAdmin) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { action, userId, username, removeContent } = req.body || {};
  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }
  if (!userId && !username) {
    return res.status(400).json({ error: "userId or username is required" });
  }

  try {
    if (action === "ban" || action === "unban") {
      const targetId = await resolveTargetUserId({ userId, username });
      if (!targetId) return res.status(404).json({ error: "User not found" });

      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
        ban_duration: action === "ban" ? PERMANENT_BAN_DURATION : "none",
      });
      if (error) throw error;

      if (action === "ban" && removeContent) {
        const targetUsername = await resolveTargetUsername({ userId: targetId, username });
        if (targetUsername) await removeAllContentForUser(targetUsername);
      }

      return res.status(200).json({ ok: true, action });
    }

    if (action === "delete") {
      const targetId = await resolveTargetUserId({ userId, username });
      if (!targetId) return res.status(404).json({ error: "User not found" });

      // Root admins can never be deleted through this endpoint, even by
      // another admin — same protection pattern as manage-admin.js.
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
      const targetEmail = (targetUser?.user?.email || "").trim().toLowerCase();
      if (ROOT_ADMIN_EMAILS.includes(targetEmail)) {
        return res.status(400).json({ error: "Can't delete the root admin account" });
      }

      if (removeContent) {
        const targetUsername = await resolveTargetUsername({ userId: targetId, username });
        if (targetUsername) await removeAllContentForUser(targetUsername);
      }

      // Remove the profiles row first — it isn't guaranteed to cascade
      // automatically just because profiles.id matches the auth id.
      await supabaseAdmin.from("profiles").delete().eq("id", targetId);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (error) throw error;

      return res.status(200).json({ ok: true, action });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error("[moderate-user]", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}