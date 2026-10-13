import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../config/supabase";

const TOAST_MS = 4000;
const keyOf = (type, id) => `${type}:${String(id)}`;

/**
 * Interested / Not interested for posts, videos and reels.
 * ONE instance serves all three content types (types: "post" | "video" | "reel").
 * Loads the current user's feedback in a single query on mount.
 *
 *   const fb = useContentFeedback();
 *   fb.isHidden("post", id)            -> boolean
 *   fb.feedbackOf("reel", id)          -> "interested" | "not_interested" | null
 *   fb.toggleInterested("video", id)
 *   fb.markNotInterested("post", id)
 *   <FeedbackToast fb={fb} />          -> render once per page
 */
export default function useContentFeedback() {
  const username = localStorage.getItem("username") || "";

  const [map, setMap] = useState({}); // { "post:12": "interested" | "not_interested" }
  const mapRef = useRef({});
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null); // { message, undo: {type,id} | null }
  const toastTimer = useRef(null);

  const commit = (next) => {
    mapRef.current = next;
    setMap(next);
  };

  // ── Load everything this user has marked, once ──
  useEffect(() => {
    if (!username) {
      commit({});
      setLoaded(true);
      return;
    }
    let active = true;
    supabase
      .from("content_feedback")
      .select("content_type, content_id, feedback")
      .eq("username", username)
      .limit(5000)
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) {
          const next = {};
          data.forEach((r) => (next[keyOf(r.content_type, r.content_id)] = r.feedback));
          commit(next);
        }
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flash = useCallback((message, undo = null) => {
    setToast({ message, undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  // Optimistic write with rollback.
  const save = useCallback(
    async (type, id, feedback) => {
      const k = keyOf(type, id);
      const prev = mapRef.current[k];
      commit({ ...mapRef.current, [k]: feedback });

      const { error } = await supabase.from("content_feedback").upsert(
        { username, content_type: type, content_id: String(id), feedback },
        { onConflict: "username,content_type,content_id" },
      );
      if (error) {
        console.error("content_feedback upsert failed:", error);
        const rolled = { ...mapRef.current };
        if (prev) rolled[k] = prev;
        else delete rolled[k];
        commit(rolled);
        return false;
      }
      return true;
    },
    [username],
  );

  const clear = useCallback(
    async (type, id) => {
      const k = keyOf(type, id);
      const prev = mapRef.current[k];
      const without = { ...mapRef.current };
      delete without[k];
      commit(without);

      const { error } = await supabase
        .from("content_feedback")
        .delete()
        .eq("username", username)
        .eq("content_type", type)
        .eq("content_id", String(id));
      if (error) {
        console.error("content_feedback delete failed:", error);
        if (prev) commit({ ...mapRef.current, [k]: prev });
        return false;
      }
      return true;
    },
    [username],
  );

  const toggleInterested = useCallback(
    async (type, id) => {
      if (!username) return flash("Please log in first");
      if (mapRef.current[keyOf(type, id)] === "interested") {
        const ok = await clear(type, id);
        flash(ok ? "Removed" : "Something went wrong");
      } else {
        const ok = await save(type, id, "interested");
        flash(ok ? "We'll show you more like this" : "Something went wrong");
      }
    },
    [username, clear, save, flash],
  );

  const markNotInterested = useCallback(
    async (type, id) => {
      if (!username) return flash("Please log in first");
      const ok = await save(type, id, "not_interested");
      if (ok) flash("Got it. We'll show you less like this", { type, id });
      else flash("Something went wrong");
    },
    [username, save, flash],
  );

  const undoNotInterested = useCallback(async () => {
    const undo = toast?.undo;
    dismissToast();
    if (undo) await clear(undo.type, undo.id);
  }, [toast, clear, dismissToast]);

  return {
    loaded,
    feedbackOf: (type, id) => map[keyOf(type, id)] || null,
    isHidden: (type, id) => map[keyOf(type, id)] === "not_interested",
    // Snapshot of hidden ids for one type (used by Reels so the reel you're
    // watching doesn't vanish mid-scroll).
    hiddenIds: (type) => {
      const out = new Set();
      const prefix = `${type}:`;
      Object.entries(map).forEach(([k, v]) => {
        if (v === "not_interested" && k.startsWith(prefix)) out.add(k.slice(prefix.length));
      });
      return out;
    },
    toggleInterested,
    markNotInterested,
    undoNotInterested,
    toast,
    dismissToast,
  };
}

/** Render ONCE per page, so it survives the hidden card unmounting. */
export function FeedbackToast({ fb }) {
  if (!fb?.toast) return null;
  const { message, undo } = fb.toast;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#333",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 8,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 13,
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      }}
    >
      <span>{message}</span>
      {undo && (
        <button
          type="button"
          onClick={fb.undoNotInterested}
          style={{
            background: "none",
            border: "none",
            color: "#60a5fa",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
            fontSize: 13,
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}