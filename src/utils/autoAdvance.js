// src/utils/autoAdvance.js
//
// Shared helper for "when this video ends, play the next one" in the Posts
// feed. Finds the next playable item (a post video or a feed video card)
// BELOW `fromEl` and scrolls it to the centre of the screen. Each item's own
// autoplay-on-scroll logic (PostCard's mediaInView, VideoFeedCard's inView)
// then starts it — so nothing here touches playback directly.
//
// Returns true if it advanced, false if there is nothing after `fromEl`
// (the caller should then replay its own video instead).

const FEED_MEDIA = ".pf-feed .pf-card-video-wrap, .pf-feed .pf-video-card";

export function advanceToNextFeedMedia(fromEl) {
  if (!fromEl) return false;

  const next = Array.from(document.querySelectorAll(FEED_MEDIA)).find(
    (m) =>
      !fromEl.contains(m) &&
      fromEl.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

  if (!next) return false;

  next.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}