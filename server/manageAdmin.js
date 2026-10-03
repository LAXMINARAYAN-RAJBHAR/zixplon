import { createClient } from "@supabase/supabase-js";

// ── Service-role Supabase client — SERVER-SIDE ONLY ─────────────────────────
// Set these two in Vercel → Project Settings → Environment Variables.
// SUPABASE_SERVICE_ROLE_KEY is the "service_role" secret from
// Supabase → Project Settings → API → Project API keys. Never prefix
// it with REACT_APP_ — that would bundle it into client-side JS and
// give anyone full database access.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Baked-in fallback so the app can never be locked out of its own admin
// panel even if the admin_users table is empty, unreachable, or gets
// wiped by mistake. Keep this in sync with AdminPanel.jsx's ADMIN_EMAILS.
const ROOT_ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

// Resolves the calling user's email from their access token, and
// whether that email counts as an admin (root list OR admin_users row).
// Every action below (including "check") requires this to pass first —
// this route is the only thing with permission to read/write
// admin_users or create auth users, so it must independently verify the
// caller rather than trusting anything the client claims about itself.
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { email: callerEmail, isAdmin: callerIsAdmin } = await resolveCaller(token);

  if (!callerIsAdmin) {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { action, email, password } = req.body || {};

  try {
    // ── "check": does the CALLER (from the token) count as an admin? ──
    // Used by AdminPanel.jsx on load to decide whether to render the
    // panel for a user who isn't in the hardcoded ADMIN_EMAILS list.
    // We already know the answer is "yes" here (callerIsAdmin passed
    // the gate above), so this just echoes it back.
    if (action === "check") {
      return res.status(200).json({ isAdmin: true, email: callerEmail });
    }

    // ── "list": every current admin, root + DB-backed ──
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("admin_users")
        .select("email, added_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const dbEmails = new Set((data || []).map((r) => r.email));
      const rootRows = ROOT_ADMIN_EMAILS
        .filter((e) => !dbEmails.has(e)) // avoid duplicate rows if a root admin also got upserted into admin_users
        .map((e) => ({ email: e, added_by: "owner", created_at: null, root: true }));

      return res.status(200).json({ admins: [...rootRows, ...(data || [])] });
    }

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    // ── "remove": revoke admin access ──
    if (action === "remove") {
      if (ROOT_ADMIN_EMAILS.includes(normalizedEmail)) {
        return res.status(400).json({ error: "Can't remove the root admin" });
      }
      const { error } = await supabaseAdmin
        .from("admin_users")
        .delete()
        .eq("email", normalizedEmail);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── "grant" (default): create-if-needed + add to admin_users ──
    // If a password was supplied, try to create a brand-new Supabase
    // auth account for this email. email_confirm: true skips the
    // verification-email step so the new admin can log in right away.
    // If an account with this email already exists, createUser() will
    // error — we treat that as fine and just fall through to granting
    // admin on the existing account, so the same form covers "make an
    // existing user an admin" and "create a new admin from scratch".
    if (action === "grant" || !action) {
      let createdAccount = false;

      if (password) {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
        });
        if (createErr) {
          const alreadyExists = /already.*registered|already.*exists|already been registered/i.test(
            createErr.message || ""
          );
          if (!alreadyExists) throw createErr;
        } else {
          createdAccount = true;
        }
      }

      const { error: upsertErr } = await supabaseAdmin
        .from("admin_users")
        .upsert(
          { email: normalizedEmail, added_by: callerEmail || "unknown" },
          { onConflict: "email" }
        );
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, createdAccount });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error("[manage-admin]", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}