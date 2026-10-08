import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import {
  ThreeDotMenu,
  ReportModal,
  shareContent,
  formatViews,
} from "../../Component/Shared/ContentMenu";
// NEW: shared always-mounted, preloading, buffer-hiding preview video.
import AutoPlayVideo from "../../Component/Shared/AutoPlayVideo";

const HOVER_PREVIEW_DELAY = 400; // ms

// NEW: compact count (1234 -> "1.2K") and short relative time ("3h ago"),
// matching the Facebook-style PostCard header / action pills.
const formatCount = (n) => {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};
const shortTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ── A single video card, interleaved into the Posts feed (one per Post,
// per the Post -> Video -> ReelsStrip sequence in PostFeed.jsx).
//
// NEW: the clip now autoplays (muted, looping) as soon as the card is
// scrolled meaningfully into view, on desktop AND mobile, and pauses +
// resets the moment it scrolls back out. Desktop hover-to-preview still
// works on top of that (hovering a card that's off-center previews it
// too). Shows views/likes/posted-time and a three-dots menu (Save to
// Watch Later, Add to Playlist, Go to Channel, Share, Report, and
// owner-only Delete) — matching VideoCard on the Home feed. ──
const VideoFeedCard = ({ video }) => {
  const navigate = useNavigate();
  // NEW: two independent reasons to play the clip — the pointer is
  // hovering it (desktop), or it's scrolled into view (all devices).
  // The preview plays whenever either is true.
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const previewing = hovering || inView;
  const [deleted, setDeleted] = useState(false);
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);

  const loggedInUsername = localStorage.getItem("username") || "";
  const isOwner = loggedInUsername && video?.username && video.username === loggedInUsername;

  // ── NEW: scroll-into-view detection ──
  // Fires once ≥60% of the card is on screen (same threshold the rest of
  // the app uses for "viewed"), and flips back off when it leaves.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !video?.src) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [video?.src]);

  // Playback itself now lives in <AutoPlayVideo>, which keeps one video
  // element mounted, preloads it before the card is on screen, and just
  // plays/pauses it as `previewing` flips — no more mounting a fresh
  // <video> (and waiting on it) at the moment of playback.

  // Clear any pending hover timer on unmount.
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

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

  // CHANGED: hover now only toggles `hovering` — the effect above is
  // what actually plays/pauses the <video>, so hover and scroll-into-view
  // can't fight each other (e.g. moving the mouse off a card that is
  // still scrolled into view no longer stops it).
  const onEnter = () => {
    if (!video.src) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setHovering(true), HOVER_PREVIEW_DELAY);
  };
  const onLeave = () => {
    clearTimeout(timeoutRef.current);
    setHovering(false);
  };

  const goToVideo = () => { incrementView(); navigate(`/video/${video.id}`); };

  // NEW: Facebook-style action pill "Share" (same payload as the ⋮ menu).
  const handleSharePill = (e) => {
    e.preventDefault();
    e.stopPropagation();
    shareContent({
      contentType: "video",
      contentId: video.short_id || video.id,
      title: video.title || "Video",
      text: `Watch "${video.title}" on Zixplon`,
    });
  };

  if (deleted) return null;

  const channelName = video.channel || video.username || "?";
  const initials = channelName.slice(0, 2).toUpperCase();

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
      ref={cardRef}
      className="pf-video-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={goToVideo}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return; // ignore keys from inner buttons/links
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToVideo(); }
      }}
    >
      <ThreeDotMenu items={menuItems} />

      {/* CHANGED: Facebook-style header — avatar, channel, and one
          compact meta line (short time · views · optional 🎵 song). */}
      <div className="pf-card-header">
        <Link
          to={`/user/${video.username}`}
          className="pf-avatar pf-avatar-green pf-avatar-link"
          title={`View ${channelName}'s profile`}
          onClick={(e) => e.stopPropagation()}
        >
          {initials}
        </Link>
        <div className="pf-card-meta">
          <p className="pf-card-author">
            <Link
              to={`/user/${video.username}`}
              className="pf-author-link"
              onClick={(e) => e.stopPropagation()}
            >
              {channelName}
            </Link>
          </p>
          <p className="pf-card-time">
            {video.created_at && <span>{shortTimeAgo(video.created_at)}&nbsp;·&nbsp;</span>}
            <span title={formatViews(viewCount)}>👁 {formatCount(viewCount)}</span>
            {/* Optional: shows only if the video row carries a song. */}
            {video.song?.title && (
              <>
                &nbsp;·&nbsp;
                <span
                  className="pf-card-song"
                  title={`${video.song.title}${video.song.artist ? " · " + video.song.artist : ""}`}
                >
                  🎵 {video.song.title}
                  {video.song.artist ? ` · ${video.song.artist}` : ""}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <p className="pf-video-card-title">{video.title}</p>

      <div className="pf-video-card-thumb-wrap">
        <span className="pf-video-card-badge">🎬 Video</span>
        {video.thumbnail && (
          <img src={video.thumbnail} alt={video.title} className="pf-video-card-thumb" loading="lazy" />
        )}
        {video.src ? (
          <AutoPlayVideo
            src={video.src}
            poster={video.thumbnail}
            active={previewing}
            className="pf-video-card-thumb"
          />
        ) : (
          !video.thumbnail && (
            <div className="pf-video-card-thumb pf-video-card-placeholder">🎬</div>
          )
        )}
        {video.duration && video.duration !== "00:00" && (
          <span className="pf-video-card-duration">{video.duration}</span>
        )}
      </div>

      {/* CHANGED: stats row replaced by grey pill buttons with counts
          (Facebook-style). Like keeps its existing behaviour. */}
      <div className="pf-video-card-actions">
        <button
          type="button"
          onClick={handleLike}
          className={"pf-video-card-pill" + (isLiked ? " liked" : "")}
        >
          <span>👍</span>
          <span className="pf-video-card-pill-label">Like</span>
          {likeCount > 0 && <span className="pf-video-card-pill-count">{formatCount(likeCount)}</span>}
        </button>
        <button
          type="button"
          className="pf-video-card-pill"
          onClick={(e) => { e.stopPropagation(); goToVideo(); }}
        >
          <span>▶</span>
          <span className="pf-video-card-pill-label">Watch</span>
        </button>
        <button type="button" className="pf-video-card-pill" onClick={handleSharePill}>
          <span>↗</span>
          <span className="pf-video-card-pill-label">Share</span>
        </button>
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