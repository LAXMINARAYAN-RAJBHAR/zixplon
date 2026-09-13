import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import {
  ThreeDotMenu,
  ReportModal,
  shareContent,
  formatViews,
  formatTimeAgo,
} from "../../Component/Shared/ContentMenu";

const HOVER_PREVIEW_DELAY = 400; // ms

// ── A single video card, interleaved into the Posts feed (one per Post,
// per the Post -> Video -> ReelsStrip sequence in PostFeed.jsx). Desktop
// hovers-to-preview (muted, looping clip in place of the thumbnail);
// mobile just shows the static thumbnail (or the video's own first
// frame if there's no thumbnail_url) and relies on the tap to open it.
// Shows views/likes/posted-time and a three-dots menu (Save to Watch
// Later, Add to Playlist, Go to Channel, Share, Report, and owner-only
// Delete) — matching VideoCard on the Home feed. ──
const VideoFeedCard = ({ video }) => {
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);

  const loggedInUsername = localStorage.getItem("username") || "";
  const isOwner = loggedInUsername && video?.username && video.username === loggedInUsername;

  // ── Views ──
  const [viewCount, setViewCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!video?.id) return;
      const { count } = await supabase
        .from("views")
        .select("content_id", { count: "exact", head: true })
        .eq("content_type", "video")
        .eq("content_id", String(video.id));
      if (!cancelled) setViewCount(count || 0);
    })();
    return () => { cancelled = true; };
  }, [video?.id]);

  const incrementView = async () => {
    if (!video?.id) return;
    const storageKey = `lastViewed_video_${video.id}`;
    const lastViewed = localStorage.getItem(storageKey);
    const now = Date.now();
    if (lastViewed && now - parseInt(lastViewed, 10) < 24 * 60 * 60 * 1000) return;
    localStorage.setItem(storageKey, String(now));
    localStorage.setItem(`viewed_video_${video.id}`, "true");
    setViewCount((c) => c + 1);
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      await supabase.from("views").upsert(
        { user_id: userId, content_id: String(video.id), content_type: "video", viewed_at: new Date().toISOString() },
        { onConflict: "user_id,content_id,content_type" },
      );
    } catch (_) {}
  };

  // ── Likes — seeded from video.likes (fetched in bulk by PostFeed.jsx's
  // fetchMoreVideos), then kept in sync with this user's own like/unlike. ──
  const [likeCount, setLikeCount] = useState(video?.likes ?? 0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    setLikeCount(video?.likes ?? 0);
  }, [video?.likes]);

  useEffect(() => {
    (async () => {
      const userId = localStorage.getItem("userId");
      if (!userId || !video?.id) return;
      const { data } = await supabase
        .from("likes").select("id")
        .match({ user_id: userId, content_id: String(video.id), content_type: "video" })
        .maybeSingle();
      setIsLiked(!!data);
    })();
  }, [video?.id]);

  const handleLike = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to like"); return; }
    try {
      if (isLiked) {
        await supabase.from("likes").delete().match({ user_id: userId, content_id: String(video.id), content_type: "video" });
        await supabase.rpc("decrement_likes", { p_table: "videos", p_id: video.id });
        setIsLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await supabase.from("likes").insert({ user_id: userId, content_id: String(video.id), content_type: "video" });
        await supabase.rpc("increment_likes", { p_table: "videos", p_id: video.id });
        setIsLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (_) {}
  };

  // ── Watch Later ──
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    (async () => {
      const username = localStorage.getItem("username");
      if (!username || !video?.id) return;
      const { data } = await supabase
        .from("watch_later").select("video_id")
        .eq("username", username).eq("video_id", video.id).maybeSingle();
      setIsSaved(!!data);
    })();
  }, [video?.id]);

  const handleToggleWatchLater = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const username = localStorage.getItem("username");
    if (!username) { alert("Please login to save videos"); return; }
    if (isSaved) {
      await supabase.from("watch_later").delete().eq("username", username).eq("video_id", video.id);
      setIsSaved(false);
    } else {
      await supabase.from("watch_later").insert({ username, video_id: video.id });
      setIsSaved(true);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    if (error) alert("Failed to delete video.");
    else setDeleted(true);
  };

  // ── Report ──
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const submitReport = async (reason, details) => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        content_id: String(reportTarget.contentId),
        content_type: reportTarget.contentType,
        reason, details: details || null,
        reporter_username: loggedInUsername || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert("Thanks — your report has been submitted for review.");
      setReportTarget(null);
    } catch (_) {
      alert("Couldn't submit the report right now. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

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
      try { videoRef.current.pause(); videoRef.current.currentTime = 0; } catch (_) {}
    }
  };

  const goToVideo = () => { incrementView(); navigate(`/video/${video.id}`); };

  if (deleted) return null;

  const menuItems = [
    {
      id: "watch-later",
      icon: <span style={{ fontSize: 15 }}>{isSaved ? "🔖" : "📑"}</span>,
      label: isSaved ? "Saved to Watch Later" : "Save to Watch Later",
      active: isSaved,
      onClick: handleToggleWatchLater,
    },
    {
      id: "playlist",
      icon: <span style={{ fontSize: 15 }}>➕</span>,
      label: "Add to Playlist",
      onClick: (e) => { e.preventDefault(); e.stopPropagation(); navigate("/playlist", { state: { addVideoId: video.id } }); },
    },
    {
      id: "channel",
      icon: <span style={{ fontSize: 15 }}>👤</span>,
      label: "Go to Channel",
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        navigate("/user/" + (video.username || (video.channel || "").toLowerCase() || "unknown"));
      },
    },
    {
      id: "share",
      icon: <span style={{ fontSize: 15 }}>🔗</span>,
      label: "Share",
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        shareContent({ contentType: "video", contentId: video.short_id || video.id, title: video.title || "Video", text: `Watch "${video.title}" on Zixplon` });
      },
    },
    {
      id: "report",
      icon: <span style={{ fontSize: 15 }}>🚩</span>,
      label: "Report video",
      onClick: (e) => { e.preventDefault(); e.stopPropagation(); setReportTarget({ contentType: "video", contentId: video.id, title: video.title }); },
    },
    ...(isOwner
      ? [{ id: "delete", icon: <span style={{ fontSize: 15 }}>🗑️</span>, label: "Delete video", danger: true, onClick: handleDelete }]
      : []),
  ];

  return (
    <div
      className="pf-video-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={goToVideo}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToVideo(); } }}
    >
      <span className="pf-video-card-badge">🎬 Video</span>
      <ThreeDotMenu items={menuItems} />

      <div className="pf-video-card-thumb-wrap">
        {video.thumbnail ? (
          <>
            <img src={video.thumbnail} alt={video.title} className="pf-video-card-thumb" style={{ opacity: previewing ? 0 : 1 }} loading="lazy" />
            {previewing && video.src && (
              <video ref={videoRef} src={video.src} muted loop playsInline preload="metadata" className="pf-video-card-thumb pf-video-card-thumb-video" />
            )}
          </>
        ) : video.src ? (
          <video ref={videoRef} src={video.src} muted loop playsInline preload="metadata" className="pf-video-card-thumb" />
        ) : (
          <div className="pf-video-card-thumb pf-video-card-placeholder">🎬</div>
        )}
        {video.duration && video.duration !== "00:00" && (
          <span className="pf-video-card-duration">{video.duration}</span>
        )}
      </div>

      <div className="pf-video-card-body">
        <p className="pf-video-card-title">{video.title}</p>
        <Link to={`/user/${video.username}`} className="pf-video-card-channel" onClick={(e) => e.stopPropagation()}>
          {video.channel || video.username}
        </Link>
        <div className="pf-video-card-stats">
          <span>👁 {formatViews(viewCount)}</span>
          <button onClick={handleLike} className={"pf-video-card-like" + (isLiked ? " liked" : "")}>
            👍 {likeCount}
          </button>
          {video.created_at && <span>{formatTimeAgo(video.created_at)}</span>}
        </div>
      </div>

      <ReportModal
        target={reportTarget}
        onClose={() => !reportSubmitting && setReportTarget(null)}
        onSubmit={submitReport}
        submitting={reportSubmitting}
      />
    </div>
  );
};

export default VideoFeedCard;