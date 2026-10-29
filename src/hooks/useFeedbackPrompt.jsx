import React, { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useFeedbackPrompt — decides WHEN to ask "Interested / Not interested?".
//
// Instead of listing those options in the ⋮ menu of every video/reel, the
// prompt appears only when ALL of these are true:
//   1. The visitor has come across a NEW profile — the first video/reel from
//      this creator in this browser session.
//   2. They have already gone through at least `minItems` videos/reels
//      (counted separately for "video" and "reel").
//   3. At least `minItems` items have passed since the last prompt, so it
//      never feels spammy.
//   4. The creator hasn't been asked about in the last CREATOR_COOLDOWN_DAYS
//      (remembered across sessions, shared by videos and reels).
//   5. The caller hasn't set `disabled` (own content, guest, already rated,
//      feedback not loaded, already connected to the creator…).
//
// It shows after SHOW_DELAY_MS of watching (only if the tab is visible) and
// hides itself after AUTO_HIDE_MS or when the visitor presses Esc.
//
// Place this file at: src/hooks/useFeedbackPrompt.jsx
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_ITEMS_BEFORE_PROMPT = 3; // "at least 2 or 3 videos" → change here
export const CREATOR_COOLDOWN_DAYS = 7; // don't ask about the same creator again for this long
const SHOW_DELAY_MS = 3000;
const AUTO_HIDE_MS = 9000;
const DAY_MS = 24 * 60 * 60 * 1000;

const SESSION_KEY = (type) => `zx_fbprompt_${type}`;
const COOLDOWN_KEY = "zx_fbprompt_creators";

// ── Safe storage helpers (storage can be blocked, e.g. private mode) ──
const readJSON = (getStore, key) => {
  try {
    return JSON.parse(getStore().getItem(key) || "null");
  } catch {
    return null;
  }
};

const writeJSON = (getStore, key, value) => {
  try {
    getStore().setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const session = () => window.sessionStorage;
const local = () => window.localStorage;

// Per-section progress for this browser tab session.
//   order:        { [itemId]: n }  → n-th item gone through (0-based)
//   count:        how many distinct items have been gone through
//   creatorFirst: { [creator]: itemId } → which item first introduced them
//   prompted:     creators already prompted this session
//   lastPromptAt: index of the item the last prompt was shown on
const readSession = (type) => {
  const s = readJSON(session, SESSION_KEY(type));
  if (s && s.order && typeof s.count === "number" && s.creatorFirst && Array.isArray(s.prompted)) {
    return s;
  }
  return { order: {}, count: 0, creatorFirst: {}, prompted: [], lastPromptAt: -1000 };
};

const writeSession = (type, state) => writeJSON(session, SESSION_KEY(type), state);

// Cross-session "already asked about this creator" memory.
const readCooldowns = (cooldownDays) => {
  const all = readJSON(local, COOLDOWN_KEY);
  const now = Date.now();
  const fresh = {};
  if (all && typeof all === "object") {
    Object.entries(all).forEach(([who, ts]) => {
      if (typeof ts === "number" && now - ts < cooldownDays * DAY_MS) fresh[who] = ts;
    });
  }
  return fresh;
};

const rememberCreator = (who, cooldownDays) => {
  const fresh = readCooldowns(cooldownDays);
  fresh[who] = Date.now();
  writeJSON(local, COOLDOWN_KEY, fresh);
};

export default function useFeedbackPrompt({
  type, // "video" | "reel"
  itemId, // current video / reel id
  creator, // uploader username
  active = true, // is this item actually on screen right now?
  disabled = false, // own content, guest, already rated, feedback not loaded…
  minItems = MIN_ITEMS_BEFORE_PROMPT,
  cooldownDays = CREATOR_COOLDOWN_DAYS,
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
    const state = readSession(type);
    if (state.order[id] === undefined) {
      state.order[id] = state.count;
      state.count += 1;
    }
    if (!state.creatorFirst[who]) state.creatorFirst[who] = id;
    writeSession(type, state);

    const index = state.order[id]; // items gone through BEFORE this one
    const isNewProfile = state.creatorFirst[who] === id;
    const watchedEnough = index >= minItems;
    const spacedOut = index - state.lastPromptAt > minItems;

    if (
      disabled ||
      !isNewProfile ||
      !watchedEnough ||
      !spacedOut ||
      state.prompted.includes(who) ||
      readCooldowns(cooldownDays)[who]
    ) {
      return;
    }

    let hideTimer;
    const showTimer = setTimeout(() => {
      // Don't pop up while the tab is in the background.
      if (typeof document !== "undefined" && document.hidden) return;

      const fresh = readSession(type);
      if (fresh.prompted.includes(who)) return;
      fresh.prompted.push(who);
      fresh.lastPromptAt = fresh.order[id] ?? index;
      writeSession(type, fresh);
      rememberCreator(who, cooldownDays);

      setVisible(true);
      hideTimer = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [type, itemId, creator, active, disabled, minItems, cooldownDays]);

  return { visible, dismiss };
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackPrompt — the small glass card. Positioning is passed in via `style`
// (the parent decides where it sits inside the player).
// ─────────────────────────────────────────────────────────────────────────────
const pillBase = {
  border: "none",
  borderRadius: 999,
  padding: "8px 14px",
  minHeight: 34,
  fontSize: 12,
  fontWeight: 800,
  fontFamily: "'Nunito', sans-serif",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
  touchAction: "manipulation",
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
  // Esc closes the prompt (desktop).
  useEffect(() => {
    if (!visible || !onDismiss) return;
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      role="group"
      aria-label="Interested or not interested"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        zIndex: 32,
        background: "rgba(12, 8, 35, 0.86)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 16,
        padding: "10px 12px",
        color: "#fff",
        fontFamily: "'Nunito', sans-serif",
        boxShadow: "0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.2)",
        animation: reduceMotion ? "none" : "zxFbPromptIn 0.28s ease both",
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
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {creator}
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
            fontSize: 16,
            lineHeight: 1,
            cursor: "pointer",
            padding: 4,
            margin: -4,
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