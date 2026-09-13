import { useEffect, useRef } from "react";
import { supabase } from "../config/supabase";

// How often we "heartbeat" the current visit's last_active_at forward
// while the tab is visible. Duration = last_active_at - started_at, so
// this interval is the accuracy floor — 20s is a reasonable balance
// between granularity and write volume for a client-side approach.
const HEARTBEAT_INTERVAL_MS = 20000;

// Persists for the lifetime of the TAB (cleared when the tab closes,
// survives reloads/navigations within it) — this is what makes a
// single visit span multiple page loads instead of creating a new row
// every time the user navigates.
const SESSION_STORAGE_KEY = "zx_visit_session_id";

const makeSessionId = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── useVisitTracking ─────────────────────────────────────────────────
// Call once, near the top of App.js. Records one `site_visits` row per
// browser tab session, then periodically updates that row's
// last_active_at while the tab is actually visible/foregrounded (paused
// while backgrounded, so switching tabs doesn't inflate duration).
//
// Does NOT depend on catching beforeunload/pagehide to compute an
// accurate duration — those events are routinely skipped by mobile
// browsers (especially iOS Safari and installed PWAs), which is exactly
// why a heartbeat-based approach is used instead of a single
// insert-on-arrival / update-on-leave pair.
const useVisitTracking = (currentUser) => {
  const rowIdRef = useRef(null);

  // ── Start (or resume) this tab's visit row ──
  useEffect(() => {
    let cancelled = false;

    const startOrResumeVisit = async () => {
      let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) {
        sessionId = makeSessionId();
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }

      // A reload within the same tab re-runs this effect but reuses the
      // same sessionId — look for an existing row first so a reload
      // doesn't fragment one visit into several rows.
      const { data: existing } = await supabase
        .from("site_visits")
        .select("id")
        .eq("session_id", sessionId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        rowIdRef.current = existing.id;
        return;
      }

      const { data, error } = await supabase
        .from("site_visits")
        .insert({
          session_id: sessionId,
          user_id: localStorage.getItem("userId") || null,
          username: currentUser || null,
          entry_path: window.location.pathname,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();

      if (!error && data && !cancelled) {
        rowIdRef.current = data.id;
      }
    };

    startOrResumeVisit();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once per tab load only — currentUser changes
    // mid-session are handled by the separate effect below, which
    // updates the SAME row rather than re-triggering this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Heartbeat ──
  useEffect(() => {
    const heartbeat = async () => {
      if (!rowIdRef.current || document.visibilityState !== "visible") return;
      await supabase
        .from("site_visits")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", rowIdRef.current);
    };

    const intervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

    // Also beat immediately when the tab regains focus, so duration
    // doesn't silently stall while the person is on another tab/app.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // ── Keep username in sync if the person logs in mid-visit ──
  // Updates the SAME row (no new visit row created) so someone who
  // arrives anonymous and then logs in still shows as one continuous
  // visit, just retroactively attributed to their account.
  useEffect(() => {
    if (!rowIdRef.current || !currentUser) return;
    supabase
      .from("site_visits")
      .update({
        username: currentUser,
        user_id: localStorage.getItem("userId") || null,
      })
      .eq("id", rowIdRef.current);
  }, [currentUser]);
};

export default useVisitTracking;