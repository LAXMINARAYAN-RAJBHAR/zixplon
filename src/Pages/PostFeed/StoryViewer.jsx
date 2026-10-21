import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";

// ─────────────────────────────────────────────────────────────────────────
// StoryViewer — full-screen, Instagram/Facebook-style story player.
//
//   • Progress segments across the top, one per story of the current person.
//   • Photos last 5 seconds; videos play to the end.
//   • Tap the left side to go back, anywhere else to go forward.
//   • Press and hold to pause; release to resume.
//   • ← / → / Esc on a keyboard; ‹ › buttons on desktop.
//   • Reaching the end of one person's stories continues into the next
//     person's, and closes after the last one.
//   • Your own stories get a delete button.
//
// `groups` is a snapshot taken when the viewer opened:
//   [{ username, stories: [{ id, media_url, media_type, caption, created_at }] }]
// ─────────────────────────────────────────────────────────────────────────

const IMAGE_DURATION_MS = 5000;
const HOLD_MS = 200;

const isHlsSource = (src) => !!src && /\.m3u8(\?.*)?$/i.test(src);

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const StoryViewer = ({
  groups,
  startGroup = 0,
  startStory = 0,
  currentUser,
  onViewed,
  onDelete, // async (story) => boolean
  onClose,
}) => {
  const [data, setData] = useState(groups);
  const [gIdx, setGIdx] = useState(startGroup);
  const [sIdx, setSIdx] = useState(startStory);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);

  const videoRef = useRef(null);
  const elapsedRef = useRef(0);
  const holdTimerRef = useRef(null);
  const heldRef = useRef(false);

  const group = data[gIdx];
  const story = group?.stories[sIdx];
  const isVideo = story?.media_type === "video";
  const isOwn = !!story && story.username === currentUser;

  // ── Navigation ──
  const goNext = () => {
    if (sIdx < group.stories.length - 1) {
      setSIdx(sIdx + 1);
    } else if (gIdx < data.length - 1) {
      setGIdx(gIdx + 1);
      setSIdx(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (sIdx > 0) {
      setSIdx(sIdx - 1);
    } else if (gIdx > 0) {
      setGIdx(gIdx - 1);
      setSIdx(0);
    } else {
      // Already at the very first story — just restart it.
      elapsedRef.current = 0;
      setProgress(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  };

  // ── Reset timing whenever the story changes ──
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setPaused(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Mark as viewed ──
  useEffect(() => {
    if (story) onViewed?.(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Photo timer (pausable) ──
  useEffect(() => {
    if (!story || story.media_type !== "image" || paused) return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      elapsedRef.current += now - last;
      last = now;
      const p = Math.min(1, elapsedRef.current / IMAGE_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  // ── Video: HLS source (plain mp4 uses the src attribute directly) ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo || !isHlsSource(story.media_url)) return;
    let hls;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(story.media_url);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      vid.src = story.media_url;
    }
    return () => hls?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Video: progress + auto-advance ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;
    const onTime = () => {
      if (vid.duration) setProgress(vid.currentTime / vid.duration);
    };
    const onEnd = () => goNext();
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("ended", onEnd);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  // ── Video: play / pause (sound on by default — opening a story is a
  // user gesture; if the browser still refuses, fall back to muted) ──
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isVideo) return;
    if (paused) {
      vid.pause();
      return;
    }
    vid.muted = muted;
    const attempt = vid.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        vid.muted = true;
        setMuted(true);
        vid.play().catch(() => {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, story?.id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // ── Keyboard + scroll lock ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(holdTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gIdx, sIdx, data]);

  // ── Tap / hold on the media area ──
  const handlePointerDown = () => {
    heldRef.current = false;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, HOLD_MS);
  };

  const handlePointerUp = (e) => {
    clearTimeout(holdTimerRef.current);
    if (heldRef.current) {
      heldRef.current = false;
      setPaused(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) goPrev();
    else goNext();
  };

  const handlePointerCancel = () => {
    clearTimeout(holdTimerRef.current);
    if (heldRef.current) {
      heldRef.current = false;
      setPaused(false);
    }
  };

  // ── Delete (own stories only) ──
  const handleDelete = async () => {
    if (!isOwn || !onDelete) return;
    setPaused(true);
    if (!window.confirm("Delete this story?")) {
      setPaused(false);
      return;
    }
    const ok = await onDelete(story);
    if (!ok) {
      setPaused(false);
      return;
    }

    const nextData = data
      .map((g, i) =>
        i === gIdx
          ? { ...g, stories: g.stories.filter((s) => s.id !== story.id) }
          : g
      )
      .filter((g) => g.stories.length > 0);

    if (nextData.length === 0) {
      onClose();
      return;
    }

    const groupStillHasStories = group.stories.length > 1;
    if (groupStillHasStories) {
      setData(nextData);
      setSIdx(Math.min(sIdx, group.stories.length - 2));
    } else if (gIdx >= nextData.length) {
      onClose();
    } else {
      setData(nextData);
      setSIdx(0);
    }
    setPaused(false);
  };

  if (!group || !story) return null;

  return createPortal(
    <div className="pf-story-viewer" role="dialog" aria-modal="true" aria-label="Story viewer">
      <button
        type="button"
        className="pf-story-nav pf-story-nav-prev"
        onClick={goPrev}
        aria-label="Previous story"
      >
        ‹
      </button>

      <div className="pf-story-stage">
        {/* Progress segments */}
        <div className="pf-story-bars">
          {group.stories.map((s, i) => (
            <div className="pf-story-bar" key={s.id}>
              <div
                className="pf-story-bar-fill"
                style={{
                  width:
                    i < sIdx ? "100%" : i === sIdx ? `${progress * 100}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="pf-story-head">
          <span className="pf-avatar pf-avatar-sm pf-avatar-green">
            {(group.username || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="pf-story-user">{group.username}</span>
          <span className="pf-story-time">{timeAgo(story.created_at)}</span>
          <span className="pf-story-spacer" />
          {isVideo && (
            <button
              type="button"
              className="pf-story-head-btn"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              className="pf-story-head-btn"
              onClick={handleDelete}
              aria-label="Delete story"
              title="Delete story"
            >
              🗑
            </button>
          )}
          <button
            type="button"
            className="pf-story-head-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Media — keyed by story id so each story mounts a fresh element */}
        <div className="pf-story-media">
          {isVideo ? (
            <video
              key={story.id}
              ref={videoRef}
              src={isHlsSource(story.media_url) ? undefined : story.media_url}
              playsInline
              preload="auto"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <img key={story.id} src={story.media_url} alt="" draggable={false} />
          )}
        </div>

        {story.caption && <div className="pf-story-caption">{story.caption}</div>}

        {/* Invisible tap / hold layer */}
        <div
          className="pf-story-tap"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <button
        type="button"
        className="pf-story-nav pf-story-nav-next"
        onClick={goNext}
        aria-label="Next story"
      >
        ›
      </button>
    </div>,
    document.body
  );
};

export default StoryViewer;