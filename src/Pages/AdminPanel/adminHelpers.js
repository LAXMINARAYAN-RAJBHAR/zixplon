import { supabase } from "../../config/supabase";

// Writes one row to admin_audit_log. Never throws — a failed log must not
// block the moderation action that already succeeded.
export const logAdminAction = async (action, targetType, targetLabel, reason = "", meta = {}) => {
  try {
    const { error } = await supabase.rpc("log_admin_action", {
      p_action: action,
      p_target_type: targetType,
      p_target_label: targetLabel,
      p_reason: reason || "",
      p_meta: meta,
    });
    if (error) console.warn("[admin] audit log failed:", error.message);
  } catch (e) {
    console.warn("[admin] audit log failed:", e.message);
  }
};

// 'root' | 'admin' | 'moderator' | null
export const fetchMyRole = async () => {
  try {
    const { data, error } = await supabase.rpc("my_admin_role");
    return error ? null : data;
  } catch {
    return null;
  }
};

// Short two-tone beep via WebAudio (no audio file needed).
export const playBeep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.12);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* autoplay blocked — ignore */
  }
};

export const notifyNewReport = (report) => {
  playBeep();
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🚩 New report on ZIXPLON", {
        body: `${(report?.content_type || "content").toUpperCase()} · ${report?.reason || ""}`,
      });
    }
  } catch {
    /* ignore */
  }
};

// Pulls every row of a table in pages (Supabase caps one request at 1,000).
const PAGE = 1000;
export const fetchAllRows = async (table, orderCol = "id") => {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
};

export const fmtDateTime = (v) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";