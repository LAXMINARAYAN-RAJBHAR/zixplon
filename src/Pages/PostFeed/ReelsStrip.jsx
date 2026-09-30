import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { ThreeDotMenu, ReportModal, shareContent } from "../../Component/Shared/ContentMenu";
// NEW: shared hover-preview thumbnail — sound-first autoplay, attached
// song synced to the clip, and a mute button that never triggers the
// card's navigation. See Component/Shared/PreviewThumb.jsx.
import PreviewThumb from "../../Component/Shared/PreviewThumb";

const PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD_PX = 300;

// CHANGED: also carries song / location / feeling / audio mix / etc.
// These ride along in the `clickedReel` handoff to /reels, so a reel
// opened from the strip keeps its song, location and feeling instead of
// losing them. (The rows come from `select("*")`, so no query change is
// needed — the columns just have to exist on the reels table.)
const mapReelRow = (r) => ({
  id: "db_" + r.id,
  dbId: r.id,
  short_id: r.short_id,
  src: r.video_url,
  thumbnail: r.thumbnail || null,
  title: r.title || "Untitled",
  duration: r.duration || "00:00",
  user: r.user || r.username || "Unknown",
  username: r.username || "unknown",
  description: r.description || "",
  created_at: r.created_at || null,
  remixed_from_id: r.remixed_from_id || null,
  remixed_from_username: r.remixed_from_username || null,
  song: r.song || null,
  location_name: r.location_name || null,
  feeling: r.feeling || null,
  original_audio_volume: r.original_audio_volume ?? 1,
});

const formatViews = (n) => {
  if (!n || n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
};

// ── One reel card in the strip. Desktop hovers-to-preview (the clip
// plays over the thumbnail, sound-first, with the attached song in sync
// and a mute button); touch screens just show the static thumbnail (or
// the video's own first frame if no thumbnail exists) and rely on the
// tap to open the reel. Carries a three-dots menu (Share, Go to
// Profile, Report, and owner-only Delete) — matching the video/reel
// cards on the Home feed.
//
// CHANGED: the hover logic (timer, muted-only <video>, play/pause) that
// used to live here is now handled by <PreviewThumb>. Hovering is
// therefore tied to the thumbnail itself rather than the whole card. ──
const ReelStripCard = ({ reel, previewId, viewCount, navigate, loggedInUsername, onReport, onDeleted }) => {
  const isOwner = loggedInUsername && reel.username && reel.username === loggedInUsername;

  const goToReel = () => navigate(`/reels/${reel.id}`, { state: { clickedReel: reel } });

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    const { error } = await supabase.from("reels").delete().eq("id", reel.dbId);
    if (error) alert("Failed to delete reel.");
    else onDeleted(reel.dbId);
  };

  const menuItems = [
    {
      id: "share",
      icon: <span style={{ fontSize: 15 }}>🔗</span>,
      label: "Share",
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        shareContent({
          contentType: "reel",
          contentId: reel.dbId,
          title: reel.title,
          text: `Watch "${reel.title}" on Zixplon`,
        });
      },
    },
    {
      id: "profile",
      icon: <span style={{ fontSize: 15 }}>👤</span>,
      label: "Go to Profile",
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        navigate("/user/" + (reel.username || "unknown"));
      },
    },
    {
      id: "report",
      icon: <span style={{ fontSize: 15 }}>🚩</span>,
      label: "Report reel",
      onClick: (e) => {
        e.preventDefault(); e.stopPropagation();
        onReport({ contentType: "reel", contentId: reel.dbId, title: reel.title });
      },
    },
    ...(isOwner
      ? [{
          id: "delete",
          icon: <span style={{ fontSize: 15 }}>🗑️</span>,
          label: "Delete reel",
          danger: true,
          onClick: handleDelete,
        }]
      : []),
  ];

  return (
    <div
      className="pf-reel-card"
      style={{ position: "relative" }}
      onClick={goToReel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goToReel(); } }}
    >
      <ThreeDotMenu items={menuItems} />

      <PreviewThumb
        id={previewId}
        src={reel.src}
        song={reel.song}
        originalVolume={reel.original_audio_volume}
        className="pf-reel-thumb-wrap"
      >
        {reel.thumbnail ? (
          <img
            src={reel.thumbnail}
            alt={reel.title}
            className="pf-reel-thumb"
            loading="lazy"
          />
        ) : reel.src ? (
          <video
            src={reel.src}
            muted
            loop
            playsInline
            preload="metadata"
            className="pf-reel-thumb"
          />
        ) : (
          <div className="pf-reel-thumb pf-reel-thumb-placeholder">🎬</div>
        )}
        <span className="pf-reel-play-badge">▶</span>
        {reel.duration && reel.duration !== "00:00" && (
          <span className="pf-reel-duration">{reel.duration}</span>
        )}
        <span className="pf-reel-viewcount">👁 {formatViews(viewCount)}</span>
      </PreviewThumb>

      <div className="pf-reel-title">{reel.title}</div>
      <Link
        to={`/user/${reel.username}`}
        className="pf-reel-user"
        onClick={(e) => e.stopPropagation()}
      >
        @{reel.user}
      </Link>
    </div>
  );
};

// ── The strip. Fully self-contained: fetches its own first page starting
// at `startOffset` (so multiple strips interleaved down the feed each
// show a different slice of reels instead of repeating the same ones),
// then keeps loading further pages as the user scrolls it horizontally.
// Owns its own report modal so a report from any card in this strip has
// somewhere to render. ──
const ReelsStrip = ({ startOffset = 0, wrapAround = true }) => {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(startOffset);
  const loadingRef = useRef(false);
  const trackRef = useRef(null);
  const loggedInUsername = localStorage.getItem("username") || "";

  // NEW: unique per-strip id, so preview ids stay unique even when
  // several strips (or a wrapped-around duplicate of the same reel) are
  // on screen — the shared sound arbiter tells previews apart by id.
  const stripIdRef = useRef(Math.random().toString(36).slice(2));

  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const submitReport = async (reason, details) => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        content_id: String(reportTarget.contentId),
        content_type: reportTarget.contentType,
        reason,
        details: details || null,
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

  // FIXED: this used to receive raw numeric `dbId`s and query the
  // `views` table with them directly. But views are written with the
  // *prefixed* content_id (e.g. "db_123" — same convention ReelItem in
  // Reels.jsx uses via `reel.id`), so `.in("content_id", ["123", ...])`
  // never matched any row and every count silently fell back to 0.
  // Also fixed a related bug where `Number(row.content_id)` on a
  // prefixed id like "db_123" produced NaN, which would have broken
  // the counts map even if the query above had matched.
  // Now takes the full prefixed ids (e.g. "db_123") end-to-end, matching
  // how Reels.jsx / ReelItem identify content everywhere else (likes,
  // views, comments).
  const fetchViewCountsFor = useCallback(async (fullIds) => {
    if (!fullIds || fullIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("views")
        .select("content_id")
        .eq("content_type", "reel")
        .in("content_id", fullIds.map(String));

      const counts = {};
      fullIds.forEach((id) => {
        counts[id] = 0;
      });
      if (!error && data) {
        data.forEach((row) => {
          const id = row.content_id;
          counts[id] = (counts[id] || 0) + 1;
        });
      }
      setViewCounts((prev) => ({ ...prev, ...counts }));
    } catch (_) {
      /* view counts are a nice-to-have — never block the strip on this */
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

    if (!error && data && data.length > 0) {
      const mapped = data.map(mapReelRow);
      setReels((prev) => [...prev, ...mapped]);
      // FIXED: pass the prefixed `id` (e.g. "db_123"), not the raw
      // numeric `dbId` — see fetchViewCountsFor above for why.
      fetchViewCountsFor(mapped.map((r) => r.id));
      offsetRef.current += data.length;
      if (data.length < PAGE_SIZE) {
        if (wrapAround) {
          offsetRef.current = 0;
        } else {
          setHasMore(false);
        }
      }
    } else {
      setHasMore(false);
    }

    loadingRef.current = false;
    setLoading(false);
  }, [hasMore, wrapAround, fetchViewCountsFor]);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const distanceFromEnd = el.scrollWidth - el.scrollLeft - el.clientWidth;
    if (distanceFromEnd < LOAD_MORE_THRESHOLD_PX) {
      loadPage();
    }
  };

  const handleDeleted = (dbId) => {
    setReels((prev) => prev.filter((r) => r.dbId !== dbId));
  };

  if (reels.length === 0 && !loading) return null;

  return (
    <div className="pf-reels-strip">
      <div className="pf-reels-strip-header">
        <span className="pf-reels-strip-zbadge">Z</span>
        <span className="pf-reels-strip-title">Reels</span>
        <Link to="/reels" className="pf-reels-strip-viewall">
          See all
        </Link>
      </div>
      <div
        className="pf-reels-strip-track"
        ref={trackRef}
        onScroll={handleScroll}
      >
        {reels.map((r, i) => (
          <ReelStripCard
            key={`${r.id}-${i}`}
            reel={r}
            previewId={`${stripIdRef.current}-${r.id}-${i}`}
            // FIXED: read the count keyed by the prefixed `r.id`
            // (matches how fetchViewCountsFor now stores it), not by
            // the raw numeric `r.dbId`.
            viewCount={viewCounts[r.id] ?? 0}
            navigate={navigate}
            loggedInUsername={loggedInUsername}
            onReport={setReportTarget}
            onDeleted={handleDeleted}
          />
        ))}
        {loading && (
          <div className="pf-reel-card pf-reel-card-loading">
            <div className="pf-reel-thumb-wrap pf-reel-thumb-placeholder">
              …
            </div>
          </div>
        )}
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

export default ReelsStrip;