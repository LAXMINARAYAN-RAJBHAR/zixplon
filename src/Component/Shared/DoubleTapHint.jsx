import React, { useEffect, useRef, useState } from "react";
import "./DoubleTapHint.css";

// ─────────────────────────────────────────────────────────────────────────────
// DoubleTapHint — a short "double tap to like" animation (a hand tapping
// twice, ripple rings, then a heart pop) with a caption, shown over a
// video or reel. Used by Video.jsx and Reels.jsx.
//
// Put it INSIDE the positioned (position: relative/absolute) box that holds
// the video. It never blocks taps (pointer-events: none).
//
// Props
//   contentKey  id of the video/reel — the hint plays once per item.
//   active      true while the hint is allowed to show (e.g. the item is
//               playing and not already liked). When it turns false the
//               hint disappears immediately.
// ─────────────────────────────────────────────────────────────────────────────

// How many hints a device sees in total before they stop.
//   Infinity → show on EVERY video / reel (default)
//   5        → only the first 5 items ever, then never again
//   0        → turned off
// The running total is kept in localStorage under STORAGE_KEY; it is only
// read/written when this is a finite number.
export const DOUBLE_TAP_HINT_MAX_SHOWS = Infinity;

// Set to true to log what the hint is deciding in the browser console.
const DEBUG = false;

const STORAGE_KEY = "zixplon_double_tap_hint_count";
const SHOW_MS = 2800; // keep in sync with the dtHintFade duration in the CSS

const readCount = () => {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
};

const writeCount = (n) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* storage unavailable — the total simply isn't remembered */
  }
};

const DoubleTapHint = ({ contentKey, active }) => {
  const [visible, setVisible] = useState(false);
  // The last item we already decided to show the hint for, so pausing /
  // resuming the same video (or scrolling a reel away and back) does not
  // replay it.
  const decidedKeyRef = useRef(null);

  // 1) DECIDE whether to show the hint now.
  useEffect(() => {
    if (DEBUG) {
      console.log("[DoubleTapHint] decide", {
        active,
        contentKey,
        alreadyDecided: decidedKeyRef.current === contentKey,
        count: readCount(),
        max: DOUBLE_TAP_HINT_MAX_SHOWS,
      });
    }

    // Not allowed right now (paused, already liked, comments open, ...)
    if (!active) {
      setVisible(false);
      return;
    }

    // Already shown for this video/reel — don't replay it.
    if (decidedKeyRef.current === contentKey) return;

    const limited = Number.isFinite(DOUBLE_TAP_HINT_MAX_SHOWS);
    const count = limited ? readCount() : 0;
    if (count >= DOUBLE_TAP_HINT_MAX_SHOWS) return;

    decidedKeyRef.current = contentKey;
    if (limited) writeCount(count + 1);
    setVisible(true);
  }, [active, contentKey]);

  // 2) HIDE it again after the animation has finished. This is a separate
  //    effect with its own cleanup, so the timer is always re-created
  //    correctly (including when React StrictMode re-runs effects in dev).
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible, contentKey]);

  if (!visible) return null;

  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;

  return (
    // key restarts the animation if the item changes while it is visible
    <div className="dt_hint" key={contentKey} aria-hidden="true">
      <div className="dt_hint_icon">
        <span className="dt_hint_ring dt_hint_ring--1" />
        <span className="dt_hint_ring dt_hint_ring--2" />
        <span className="dt_hint_hand">👆</span>
        <span className="dt_hint_heart">❤️</span>
      </div>
      <div className="dt_hint_caption">
        {isTouch ? "Double tap to like" : "Double Click to Like"}
      </div>
    </div>
  );
};

export default DoubleTapHint;