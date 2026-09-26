// utils/audioUnlock.js
//
// Browsers block autoplay of unmuted <audio>/<video> until the visitor
// has interacted with the page at least once (a click, tap, or
// keypress ANYWHERE on the page — it doesn't have to be on the media
// element itself). Muted video autoplay is always allowed, which is
// why PostVideo can fall back to a silent loop with no visible
// problem — but a song attachment has no useful "muted" fallback, so
// without this, `audio.play()` just fails silently on first load,
// every time, until the user manually taps something.
//
// This module tracks that one-time unlock globally (per page load) and
// lets any component register a callback to retry playback the moment
// it happens, instead of only retrying on that component's own click.

let unlocked = false;
const pendingCallbacks = new Set();

const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"];

const markUnlocked = () => {
  if (unlocked) return;
  unlocked = true;
  pendingCallbacks.forEach((fn) => {
    try {
      fn();
    } catch (_) {
      /* no-op — a bad callback shouldn't break the others */
    }
  });
  pendingCallbacks.clear();
  UNLOCK_EVENTS.forEach((evt) =>
    window.removeEventListener(evt, markUnlocked),
  );
};

if (typeof window !== "undefined") {
  UNLOCK_EVENTS.forEach((evt) =>
    window.addEventListener(evt, markUnlocked, { once: true, passive: true }),
  );
}

// Whether the page has already seen a qualifying user gesture.
export const hasUserInteracted = () => unlocked;

// Registers `fn` to run the moment the page becomes unlocked. If it's
// already unlocked, `fn` runs immediately (synchronously) instead of
// being queued, so callers don't need to branch on hasUserInteracted()
// themselves.
export const onUserInteract = (fn) => {
  if (unlocked) {
    fn();
    return () => {};
  }
  pendingCallbacks.add(fn);
  return () => pendingCallbacks.delete(fn); // unsubscribe, for cleanup
};