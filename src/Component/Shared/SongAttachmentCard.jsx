// /src/Component/Shared/SongAttachmentCard.jsx
import React, { useRef, useState, useEffect } from "react";
import "./MediaAttachPickers.css";
// Tracks whether the visitor has interacted with the page yet —
// browsers only allow unmuted audio autoplay after a user gesture, so
// this lets a blocked autoplay attempt retry the instant that happens
// anywhere on the page, instead of only on a tap directly on this card.
import { onUserInteract } from "../../utils/audioUnlock";

// Reusable mini "attached song" card — used in PostCard, Video.jsx, and
// Reels.jsx.
//
// Two modes:
//  - Standalone (default): manages its own <audio> element, tappable
//    play/pause button. Used on Posts, where there's no host video to
//    sync against. NEW: also supports scroll-driven autoplay via the
//    `active` prop — PostCard passes its own IntersectionObserver-
//    derived visibility flag in as `active`, so the song starts the
//    moment the post scrolls into view and stops the moment it scrolls
//    back out, mirroring PostVideo's `inView` behavior. The first
//    attempt after becoming visible tries to play with sound (there's
//    no sensible "muted" fallback for a song); if the browser refuses
//    it, playback is retried the instant the visitor next interacts
//    with the page anywhere.
//  - Synced (`synced` prop true): the PARENT owns an <audio> element and
//    controls actual playback (kept in lockstep with the host video's
//    play/pause/mute state, so the song autoplays along with the video/
//    reel). This card just reflects that state visually — `isPlaying`
//    is passed in, and the tappable play button is replaced with a
//    plain music-note indicator since tapping it wouldn't control
//    anything by itself. `active` is ignored in this mode — the parent
//    already decides when to play.
const SongAttachmentCard = ({
  song,
  onRemove,
  synced = false,
  isPlaying: externalIsPlaying = false,
  // Renamed to `visible` locally to avoid colliding with the existing
  // `active` variable further down (which means "currently audibly
  // playing", for the equalizer animation). The prop itself stays
  // named `active` so callers like PostCard don't need to change.
  active: visible = false,
}) => {
  const [playing, setPlaying] = useState(false);
  // True once a scroll-triggered autoplay attempt was refused by the
  // browser — lets the play button hint that a tap will add sound,
  // rather than silently doing nothing.
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const audioRef = useRef(null);
  // Holds the unsubscribe function for a pending "retry once the user
  // interacts with the page" registration, so a stale one from an
  // earlier visibility change never fires after this card no longer
  // wants to be playing.
  const unsubscribeInteractRef = useRef(null);

  useEffect(() => {
    if (synced) return;
    return () => {
      audioRef.current?.pause();
      unsubscribeInteractRef.current?.();
    };
  }, [synced]);

  // Scroll-driven autoplay/pause — standalone mode only. Mirrors
  // PostVideo's `inView`-driven playback: play the instant `visible`
  // turns true, pause the instant it turns false.
  useEffect(() => {
    if (synced) return;
    const el = audioRef.current;
    if (!el) return;

    unsubscribeInteractRef.current?.();
    unsubscribeInteractRef.current = null;

    if (!visible) {
      el.pause();
      setPlaying(false);
      setAutoplayBlocked(false);
      return;
    }

    el
      .play()
      .then(() => {
        setPlaying(true);
        setAutoplayBlocked(false);
      })
      .catch(() => {
        setPlaying(false);
        setAutoplayBlocked(true);
        // Browsers only blocked THIS attempt — the moment the visitor
        // interacts with the page anywhere, try again.
        unsubscribeInteractRef.current = onUserInteract(() => {
          const current = audioRef.current;
          if (!current) return;
          current
            .play()
            .then(() => {
              setPlaying(true);
              setAutoplayBlocked(false);
            })
            .catch(() => {});
        });
      });
  }, [visible, synced]);

  if (!song) return null;

  const toggle = () => {
    if (synced || !audioRef.current) return;
    unsubscribeInteractRef.current?.();
    unsubscribeInteractRef.current = null;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
      setAutoplayBlocked(false);
    }
  };

  const active = synced ? externalIsPlaying : playing;

  return (
    <div className="map-song-attachment">
      {!synced && (
        <audio
          ref={audioRef}
          src={song.url}
          onEnded={() => setPlaying(false)}
          preload="none"
        />
      )}
      {song.cover ? (
        <img src={song.cover} alt="" className="map-song-attachment-cover" />
      ) : (
        <div className="map-song-cover-fallback">🎵</div>
      )}
      {synced ? (
        <div
          className="map-song-attachment-play map-song-attachment-play--static"
          aria-label="Attached song"
        >
          🎵
        </div>
      ) : (
        <button
          type="button"
          className="map-song-attachment-play"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          title={autoplayBlocked ? "Tap to play with sound" : undefined}
        >
          {playing ? "⏸" : "▶"}
        </button>
      )}
      <div className="map-song-attachment-info">
        <div className="map-song-attachment-title">{song.title}</div>
        <div className="map-song-attachment-artist">{song.artist}</div>
      </div>
      {active && (
        <div className="map-song-attachment-eq">
          <span />
          <span />
          <span />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          className="map-song-attachment-remove"
          onClick={onRemove}
          aria-label="Remove song"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SongAttachmentCard;