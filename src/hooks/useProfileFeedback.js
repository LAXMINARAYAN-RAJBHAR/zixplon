import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../config/supabase";

// ─────────────────────────────────────────────────────────────────────────
// useProfileFeedback — remembers "Interested / Not interested" per PROFILE
// (a username), for the logged-in viewer.
//
//   feedbackOf(username)  -> "interested" | "not_interested" | null
//   isHidden(username)    -> true once the viewer chose "Not interested"
//   shouldAsk(username)   -> true if the viewer hasn't answered and hasn't
//                            snoozed the prompt recently
//   set(username, value)  -> save "interested" / "not_interested"
//   clear(username)       -> forget the answer (used by Undo)
//   snooze(username)      -> "Not now": don't ask again for 7 days
//
// Stored in localStorage (instant, per browser) and mirrored to the
// `profile_feedback` table (see profile_feedback_migration.sql) so the
// choice follows the person across devices. If the table doesn't exist
// yet, the database calls just log a warning and localStorage keeps
// working.
//
// Logged-out visitors: everything is a no-op (shouldAsk is always false).
// ─────────────────────────────────────────────────────────────────────────

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const storageKey = (user) => `zx_profile_feedback_${user}`;

// Shape: { [username]: { value: "interested" | "not_interested" | null,
//                        snoozedUntil: number | null } }
const readLocal = (user) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(user)) || "{}");
  } catch {
    return {};
  }
};

const writeLocal = (user, map) => {
  try {
    localStorage.setItem(storageKey(user), JSON.stringify(map));
  } catch (_) { }
};

const useProfileFeedback = (currentUser) => {
  const enabled = !!currentUser && currentUser !== "anonymous";
  const [map, setMap] = useState({});
  const mapRef = useRef({});

  const commit = useCallback(
    (next) => {
      mapRef.current = next;
      setMap(next);
      if (enabled) writeLocal(currentUser, next);
    },
    [enabled, currentUser]
  );

  // Load: localStorage first (instant), then merge what the database has.
  useEffect(() => {
    if (!enabled) {
      mapRef.current = {};
      setMap({});
      return;
    }

    const local = readLocal(currentUser);
    mapRef.current = local;
    setMap(local);

    let cancelled = false;
    supabase
      .from("profile_feedback")
      .select("target_username, value")
      .eq("viewer_username", currentUser)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("profile_feedback load skipped:", error.message);
          return;
        }
        const merged = { ...mapRef.current };
        (data || []).forEach((row) => {
          merged[row.target_username] = {
            ...(merged[row.target_username] || {}),
            value: row.value,
          };
        });
        commit(merged);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentUser]);

  const feedbackOf = useCallback(
    (username) => map[username]?.value || null,
    [map]
  );

  const isHidden = useCallback(
    (username) => map[username]?.value === "not_interested",
    [map]
  );

  const shouldAsk = useCallback(
    (username) => {
      if (!enabled || !username) return false;
      const entry = mapRef.current[username];
      if (entry?.value) return false;
      if (entry?.snoozedUntil && entry.snoozedUntil > Date.now()) return false;
      return true;
    },
    [enabled]
  );

  const set = useCallback(
    (username, value) => {
      if (!enabled || !username) return;
      commit({
        ...mapRef.current,
        [username]: { value, snoozedUntil: null },
      });
      supabase
        .from("profile_feedback")
        .upsert(
          { viewer_username: currentUser, target_username: username, value },
          { onConflict: "viewer_username,target_username" }
        )
        .then(({ error }) => {
          if (error) console.warn("profile_feedback save skipped:", error.message);
        });
    },
    [enabled, currentUser, commit]
  );

  const clear = useCallback(
    (username) => {
      if (!enabled || !username) return;
      const next = { ...mapRef.current };
      delete next[username];
      commit(next);
      supabase
        .from("profile_feedback")
        .delete()
        .match({ viewer_username: currentUser, target_username: username })
        .then(({ error }) => {
          if (error) console.warn("profile_feedback clear skipped:", error.message);
        });
    },
    [enabled, currentUser, commit]
  );

  const snooze = useCallback(
    (username) => {
      if (!enabled || !username) return;
      commit({
        ...mapRef.current,
        [username]: {
          ...(mapRef.current[username] || {}),
          value: mapRef.current[username]?.value || null,
          snoozedUntil: Date.now() + SNOOZE_MS,
        },
      });
    },
    [enabled, commit]
  );

  return { feedbackOf, isHidden, shouldAsk, set, clear, snooze };
};

export default useProfileFeedback;