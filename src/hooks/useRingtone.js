// src/hooks/useRingtone.js
import { useEffect } from "react";

const ring = typeof Audio !== "undefined" ? new Audio("/ringtone.mp3") : null;
if (ring) {
  ring.loop = true;
  ring.preload = "auto";
  ring.dataset.keepPlaying = "1";
}

let unlocked = false;
let ringing = false; // true while a call is ringing (set by the hook below)

const UNLOCK_EVENTS = ["pointerdown", "touchstart", "keydown"];
const removeUnlockListeners = () =>
  UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock));

const reportPlayError = (err) => {
  if (err?.name === "NotSupportedError") {
    console.error("[ringtone] /ringtone.mp3 is missing, empty or not valid audio.");
  } else if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
    console.warn("[ringtone] play failed:", err);
  }
  // NotAllowedError = autoplay blocked, expected before the first tap.
};

// Browsers only allow audio after a tap/key press. Use the first one to unlock.
function unlock() {
  if (unlocked || !ring) return;

  // A call is already ringing but was blocked: this tap lets it start now.
  if (ringing) {
    ring
      .play()
      .then(() => {
        unlocked = true;
        removeUnlockListeners();
      })
      .catch(reportPlayError);
    return;
  }

  ring.muted = true;
  ring
    .play()
    .then(() => {
      ring.muted = false;
      unlocked = true;
      removeUnlockListeners();
      // If a call started while we were unlocking, leave it playing.
      if (!ringing) {
        ring.pause();
        ring.currentTime = 0;
      }
    })
    .catch((err) => {
      ring.muted = false; // never leave the element muted after a failure
      reportPlayError(err);
    });
}

if (typeof window !== "undefined") {
  UNLOCK_EVENTS.forEach((evt) =>
    window.addEventListener(evt, unlock, { passive: true }),
  );
}

export function useRingtone(active) {
  useEffect(() => {
    if (!ring) return undefined;
    let vibTimer;

    if (active) {
      ringing = true;
      ring.muted = false;
      ring.currentTime = 0;
      ring.play().catch(reportPlayError);
      if (navigator.vibrate) {
        navigator.vibrate([800, 400]);
        vibTimer = setInterval(() => navigator.vibrate([800, 400]), 1200);
      }
    }

    return () => {
      ringing = false;
      ring.pause();
      ring.currentTime = 0;
      clearInterval(vibTimer);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [active]);
}