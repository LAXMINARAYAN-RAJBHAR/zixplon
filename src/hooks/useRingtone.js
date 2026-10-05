// src/hooks/useRingtone.js
import { useEffect } from "react";

const ring = typeof Audio !== "undefined" ? new Audio("/ringtone.mp3") : null;
if (ring) {
  ring.loop = true;
  ring.volume = 1; // maximum allowed by the browser
  ring.preload = "auto";
  // Never paused by usePauseMediaWhileOpen, so an incoming call still rings
  // while the chat panel is open.
  ring.dataset.keepPlaying = "1";
}

// Browsers block audio until the user has tapped the page at least once.
// This silently "unlocks" the audio element on the first interaction.
let unlocked = false;
const unlock = () => {
  if (unlocked || !ring) return;
  ring.muted = true;
  ring
    .play()
    .then(() => {
      ring.pause();
      ring.currentTime = 0;
      ring.muted = false;
      unlocked = true;
    })
    .catch(() => {});
};
if (typeof window !== "undefined") {
  ["pointerdown", "touchstart", "keydown"].forEach((evt) =>
    window.addEventListener(evt, unlock, { passive: true }),
  );
}

export function useRingtone(active) {
  useEffect(() => {
    if (!ring) return undefined;
    let vibTimer;

    if (active) {
      ring.currentTime = 0;
      ring.play().catch(() => {});
      if (navigator.vibrate) {
        navigator.vibrate([800, 400]);
        vibTimer = setInterval(() => navigator.vibrate([800, 400]), 1200);
      }
    }

    return () => {
      ring.pause();
      ring.currentTime = 0;
      clearInterval(vibTimer);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [active]);
}