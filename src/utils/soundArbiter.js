// utils/soundArbiter.js
//
// Ensures at most one previewing card has sound on at any given moment
// across the whole page — Trending, Reels, Videos, and Posts on the
// Home feed all share this. Whenever a card successfully starts
// playing with sound, it "claims" the arbiter with a unique id and a
// `release` callback; if another card later claims it, the previous
// holder's `release` callback fires immediately so it can go quiet
// (mute its video, or pause its song — whatever "quiet" means for that
// card). This does NOT stop multiple cards from previewing at once —
// it only ever silences all but the most recent one.
//
// Contract every consumer follows (Home feed cards, PreviewThumb,
// ReelsStrip, Reels, Video, Profile post songs):
//   1. CLAIM only while genuinely audible — playing AND unmuted. A
//      muted autoplay fallback must not claim, or a silent card
//      would needlessly quiet everyone else.
//   2. RELEASE the moment you pause, mute, end or unmount.
//   3. When your `onLose` callback fires, go QUIET (mute yourself,
//      keep playing). That silence is temporary: do NOT write it to
//      `soundPrefs`, so the visitor's own mute choice is untouched.

let currentId = null;
let currentRelease = null;

// Call once a card has actually started playing with sound. `id`
// should be a stable, unique value for that card instance (a Symbol
// works well); `onLose` is called if/when another card takes over.
export const claimSound = (id, onLose) => {
  if (currentId && currentId !== id && typeof currentRelease === "function") {
    try {
      currentRelease();
    } catch (_) {
      /* no-op — a bad callback shouldn't break the new claimant */
    }
  }
  currentId = id;
  currentRelease = onLose;
};

// Call whenever a card stops wanting sound on its own (scrolled away,
// mouse left, manually muted, unmounted) — clears the claim only if
// this card is still the current holder, so it can't accidentally
// clear someone else's more recent claim.
export const releaseSound = (id) => {
  if (currentId === id) {
    currentId = null;
    currentRelease = null;
  }
};

// Shared mute preference — the visitor's OWN choice, sound-first
// (unmuted) until they mute something. It is read and written by
// every sound-producing surface, so muting or unmuting in one place
// carries to the rest of the app:
//   - Component/Shared/PreviewThumb.jsx (Profile tabs, reels strip)
//   - Reels.jsx (reel mute button)
//   - Video.jsx (native mute control + "Tap to unmute")
//   - Profile.js post-song player
//
// Only write it when the VISITOR mutes/unmutes — never for a mute the
// app applied itself (blocked autoplay, or another card taking over
// via claimSound).
export const soundPrefs = { muted: false };