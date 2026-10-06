import React, { useRef, useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────
// AutoPlayVideo — shared, "buffer-hiding" preview video for feed cards
// (VideoFeedCard, ReelsStrip). Save as:
//   src/Component/Shared/AutoPlayVideo.jsx
//
// Why it exists: mounting a brand-new <video> at the moment a card
// should start playing makes the browser connect, fetch the header,
// download the first chunk and decode — that wait is the visible
// "buffering". This component fixes that three ways:
//
//   1. ONE element, kept mounted. It's never created/destroyed on
//      hover or scroll; the parent just flips `active`, and we call
//      play()/pause() on the same element (like PostVideo does).
//   2. PRELOAD AHEAD. Once the card is within ~400px of the screen
//      (any direction, so it works for vertical feeds AND the
//      horizontal reels strip) the source is attached with
//      preload="auto", so the first seconds are already buffered by
//      the time the card is actually on screen. Cards further away
//      load nothing at all, so a long strip doesn't download every
//      clip. (Data Saver users get preload="metadata" instead.)
//   3. HIDE THE WAIT. If a poster/thumbnail is given, the video stays
//      invisible until the browser reports it is actually playing,
//      then cross-fades in over the thumbnail the parent renders
//      underneath — so the person never sees a spinner or black frame.
//      With no poster, the video itself shows its first frame.
//
// Always muted (browsers block unmuted autoplay). Parent should render
// this inside a position:relative wrapper; it fills it absolutely and
// ignores pointer events so taps still hit the card underneath.
// ─────────────────────────────────────────────────────────────────────

const NEAR_MARGIN = "400px";

const AutoPlayVideo = ({ src, poster, active, className = "", style }) => {
  const videoRef = useRef(null);
  const [near, setNear] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Start loading once the card is near the viewport (and keep it loaded
  // afterwards, so scrolling back doesn't re-download from zero).
  useEffect(() => {
    const node = videoRef.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  // Play / pause the SAME element as `active` changes.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !near) return;
    if (active) {
      v.muted = true;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      try {
        v.pause();
        v.currentTime = 0;
      } catch (_) {}
      setPlaying(false);
    }
  }, [active, near]);

  const saveData =
    typeof navigator !== "undefined" && navigator.connection?.saveData;
  const preload = near ? (saveData ? "metadata" : "auto") : "none";

  const visible = !poster || (active && playing);

  return (
    <video
      ref={videoRef}
      src={near ? src : undefined}
      muted
      loop
      playsInline
      preload={preload}
      className={className}
      aria-hidden="true"
      onPlaying={() => setPlaying(true)}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
};

export default AutoPlayVideo;