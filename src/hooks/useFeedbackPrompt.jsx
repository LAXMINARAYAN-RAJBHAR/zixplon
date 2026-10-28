import React, { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useFeedbackPrompt — decides WHEN to ask "Interested / Not interested?".
//
// Instead of listing those options in the ⋮ menu of every video/reel, the
// prompt appears only when ALL of these are true:
//   1. The visitor has come across a NEW profile — the first video/reel
//      from this creator in this browser session.
//   2. They have already gone through at least MIN_ITEMS_BEFORE_PROMPT
//      videos/reels (counted separately for "video" and "reel").
//   3. At least MIN_ITEMS_BEFORE_PROMPT items have passed since the last
//      prompt, so it never feels spammy.
//   4. The item is not their own, they are logged in, and they haven't
//      already marked it Interested / Not interested.
// It shows after SHOW_DELAY_MS of watching and hides itself after
// AUTO_HIDE_MS. Progress is kept in sessionStorage, so it carries across
// the Video page, the Reels page and refreshes within the same tab session.
//
// Place this file at: src/hooks/useFeedbackPrompt.jsx
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_ITEMS_BEFORE_PROMPT = 3; // "at least 2 or 3 videos" → change here
const SHOW_DELAY_MS = 3000;
const AUTO_HIDE_MS = 9000;

const storageKey = (type) => `zx_fbprompt_${type}`;

const readState = (type) => {
  try {
    const s = JSON.parse(sessionStorage.getItem(storageKey(type)) || "null");
    if (s && Array.isArray(s.seen)) return s;
  } catch {
    /* ignore */
  }
  return { seen: [], creatorFirst: {}, prompted: [], lastPromptAt: -1000 };
};

const writeState = (type, state) => {
  try {
    sessionStorage.setItem(storageKey(type), JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

export default function useFeedbackPrompt({
  type, // "video" | "reel"
  itemId, // current video / reel id
  creator, // uploader username
  active = true, // is this item actually on screen right now?
  disabled = false, // own content, guest, already rated, feedback not loaded…
}) {
  const [visible, setVisible] = useState(false);
  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    setVisible(false);
    if (!active || !itemId || !creator) return;

    const id = String(itemId);
    const who = String(creator).toLowerCase();

    // Register this item as "gone through" (once) and remember which item
    // first introduced this creator.
    const state = readState(type);
    if (!state.seen.includes(id)) state.seen.push(id);
    if (!state.creatorFirst[who]) state.creatorFirst[who] = id;
    writeState(type, state);

    const index = state.seen.indexOf(id); // items gone through BEFORE this one
    const isNewProfile = state.creatorFirst[who] === id;
    const watchedEnough = index >= MIN_ITEMS_BEFORE_PROMPT;
    const spacedOut = index - state.lastPromptAt > MIN_ITEMS_BEFORE_PROMPT;

    if (
      disabled ||
      !isNewProfile ||
      !watchedEnough ||
      !spacedOut ||
      state.prompted.includes(who)
    ) {
      return;
    }

    let hideTimer;
    const showTimer = setTimeout(() => {
      const fresh = readState(type);
      if (fresh.prompted.includes(who)) return;
      fresh.prompted.push(who);
      fresh.lastPromptAt = fresh.seen.indexOf(id);
      writeState(type, fresh);
      setVisible(true);
      hideTimer = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [type, itemId, creator, active, disabled]);

  return { visible, dismiss };
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackPrompt — the small glass card. Positioning is passed in via `style`
// (the parent decides where it sits inside the player).
// ─────────────────────────────────────────────────────────────────────────────
const pillBase = {
  border: "none",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 11,
  fontWeight: 800,
  fontFamily: "'Nunito', sans-serif",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const FeedbackPrompt = ({
  visible,
  creator,
  kind = "video", // "video" | "reel"
  onInterested,
  onNotInterested,
  onDismiss,
  style,
}) => {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Interested or not interested"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 32,
        background: "rgba(12, 8, 35, 0.84)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 16,
        padding: "10px 12px",
        color: "#fff",
        fontFamily: "'Nunito', sans-serif",
        boxShadow:
          "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.2)",
        animation: "zxFbPromptIn 0.28s ease both",
        ...style,
      }}
    >
      <style>{`@keyframes zxFbPromptIn {
        from { opacity: 0; transform: translateY(10px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }`}</style>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            New: {creator}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
            Interested in {kind}s like this?
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            lineHeight: 1,
            cursor: "pointer",
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onInterested}
          style={{
            ...pillBase,
            background: "linear-gradient(135deg, #dc2626, #ef4444)",
          }}
        >
          👍 Interested
        </button>
        <button
          type="button"
          onClick={onNotInterested}
          style={{
            ...pillBase,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          🚫 Not interested
        </button>
      </div>
    </div>
  );
};