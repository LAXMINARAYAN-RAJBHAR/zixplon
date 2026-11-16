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
//
// How often it shows is controlled by DOUBLE_TAP_HINT_MAX_SHOWS below. The
// number of hints already shown is remembered in localStorage, so people who
// have seen it a few times aren't nagged forever.
// ─────────────────────────────────────────────────────────────────────────────

// Set to Infinity to show the hint on EVERY video/reel, or 0 to turn it off.
export const DOUBLE_TAP_HINT_MAX_SHOWS = 5;

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
    /* storage unavailable — hint simply isn't remembered */
  }
};

const DoubleTapHint = ({ contentKey, active }) => {
  const [visible, setVisible] = useState(false);
  const shownForKeyRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Not allowed right now (paused, already liked, comments open, ...)
    if (!active) {
      clearTimeout(timerRef.current);
      setVisible(false);
      return;
    }

    // Already shown for this video/reel — don't replay it.
    if (shownForKeyRef.current === contentKey) return;

    const count = readCount();
    if (count >= DOUBLE_TAP_HINT_MAX_SHOWS) return;

    shownForKeyRef.current = contentKey;
    writeCount(count + 1);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, [active, contentKey]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

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
        {isTouch ? "Double tap to like" : "Double click to like"}
      </div>
    </div>
  );
};

export default DoubleTapHint;