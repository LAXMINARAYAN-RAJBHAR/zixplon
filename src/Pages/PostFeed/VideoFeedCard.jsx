import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

const HOVER_PREVIEW_DELAY = 400; // ms

// ── A single video card, interleaved into the Posts feed (one per Post,
// per the Post -> Video -> ReelsStrip sequence in PostFeed.jsx). Desktop
// hovers-to-preview (muted, looping clip in place of the thumbnail);
// mobile just shows the static thumbnail (or the video's own first
// frame if there's no thumbnail_url) and relies on the tap to open it.
// Clicking navigates to the full video page — no inline playback here,
// same as tapping a video card anywhere else in the app. ──
const VideoFeedCard = ({ video }) => {
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);

  const onEnter = () => {
    if (!video.src) return;
    timeoutRef.current = setTimeout(() => {
      setPreviewing(true);
      videoRef.current?.play().catch(() => {});
    }, HOVER_PREVIEW_DELAY);
  };

  const onLeave = () => {
    clearTimeout(timeoutRef.current);
    setPreviewing(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch (_) {}
    }
  };

  const goToVideo = () => navigate(`/video/${video.id}`);

  return (
    <div
      className="pf-video-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={goToVideo}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToVideo();
        }
      }}
    >
      <span className="pf-video-card-badge">🎬 Video</span>

      <div className="pf-video-card-thumb-wrap">
        {video.thumbnail ? (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              className="pf-video-card-thumb"
              style={{ opacity: previewing ? 0 : 1 }}
              loading="lazy"
            />
            {previewing && video.src && (
              <video
                ref={videoRef}
                src={video.src}
                muted
                loop
                playsInline
                preload="metadata"
                className="pf-video-card-thumb pf-video-card-thumb-video"
              />
            )}
          </>
        ) : video.src ? (
          <video
            ref={videoRef}
            src={video.src}
            muted
            loop
            playsInline
            preload="metadata"
            className="pf-video-card-thumb"
          />
        ) : (
          <div className="pf-video-card-thumb pf-video-card-placeholder">🎬</div>
        )}
        {video.duration && video.duration !== "00:00" && (
          <span className="pf-video-card-duration">{video.duration}</span>
        )}
      </div>

      <div className="pf-video-card-body">
        <p className="pf-video-card-title">{video.title}</p>
        <Link
          to={`/user/${video.username}`}
          className="pf-video-card-channel"
          onClick={(e) => e.stopPropagation()}
        >
          {video.channel || video.username}
        </Link>
      </div>
    </div>
  );
};

export default VideoFeedCard;