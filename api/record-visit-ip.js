/**
 * ZIXPLON — records the caller's IP address (as seen server-side) onto
 * an existing site_visits row. Browser JS cannot reliably determine its
 * own public IP, so useVisitTracking.js calls this right after creating
 * a new visit row, and this reads the real IP from Vercel's forwarded
 * headers instead.
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

// x-forwarded-for can be a comma-separated chain (client, proxy1,
// proxy2, ...) when multiple hops are involved — the first entry is
// the original client's IP. Vercel populates this reliably.
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { visitId } = req.body || {};
  if (!visitId) {
    return res.status(400).json({ error: "visitId required" });
  }

  const ip = getClientIp(req);
  if (!ip) {
    // Non-critical — just skip silently rather than erroring the
    // caller, since this must never block visit tracking.
    return res.status(200).json({ ok: true, skipped: true });
  }

  try {
    const { error } = await supabaseAdmin
      .from("site_visits")
      .update({ ip_address: ip })
      .eq("id", visitId);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[record-visit-ip]", e);
    // Still return 200 — a failure here should never surface as a
    // visible error to the visitor; it just means IP tracking is
    // incomplete for this one visit.
    return res.status(200).json({ ok: false });
  }
}