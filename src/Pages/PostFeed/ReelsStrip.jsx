import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { ThreeDotMenu, ReportModal, shareContent } from "../../Component/Shared/ContentMenu";
// Shared hover-preview thumbnail — sound-first autoplay, attached
// song synced to the clip, and a mute button that never triggers the
// card's navigation. See Component/Shared/PreviewThumb.jsx.
import PreviewThumb from "../../Component/Shared/PreviewThumb";
// NEW: shared always-mounted, preloading, buffer-hiding preview video.
import AutoPlayVideo from "../../Component/Shared/AutoPlayVideo";

const PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD_PX = 300;

// NEW: card width in px. Change this one number to resize the cards.
// (Previously ~140px in the stylesheet; now 170px.)
const CARD_WIDTH = 170;

// NEW: size overrides, injected with the strip. Higher specificity
// (.pf-reels-strip ...) means they win over the existing stylesheet
// without editing it. Once you're happy, you can move these into your
// CSS file and delete this block.
const CARD_SIZE_CSS = `
.pf-reels-strip .pf-reel-card {
  width: ${CARD_WIDTH}px;
  flex: 0 0 ${CARD_WIDTH}px;
}
.pf-reels-strip .pf-reel-thumb-wrap {
  width: 100%;
  height: auto;
  aspect-ratio: 9 / 16;
}
.pf-reels-strip .pf-reel-title { font-size: 14px; }
`;

// Also carries song / location / feeling / audio mix / etc.
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

// NEW: Fisher–Yates shuffle (returns a new array).
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// NEW: one random base per page load, shared by every strip, so strips
// with different `startOffset`s stay on different slices of the feed.
const SESSION_RANDOM_BASE = Math.random();

// ── One reel card in the strip. Desktop hovers-to-preview (the clip
// plays over the thumbnail, sound-first, with the attached song in sync
// and a mute button); touch screens just show the static thumbnail (or
// the video's own first frame if no thumbnail exists) and rely on the
// tap to open the reel. Carries a three-dots menu (Share, Go to
// Profile, Report, and owner-only Delete) — matching the video/reel
// cards on the Home feed. The hover logic lives in <PreviewThumb>.
//
// NEW: scroll-into-view autoplay. Each card reports to the strip
// whether it's ≥60% on screen; the strip picks ONE card (the leftmost
// visible one) as `autoplay`, and only that card plays a muted looping
// clip over its thumbnail — so a row of several visible reels never
// decodes several videos at once. Hovering a card (desktop) hands
// control to PreviewThumb's own sound-first preview instead. ──
const ReelStripCard = ({
  reel,
  previewId,
  index,
  autoplay,
  onVisibilityChange,
  viewCount,
  navigate,
  loggedInUsername,
  onReport,
  onDeleted,
}) => {
  const isOwner = loggedInUsername && reel.username && reel.username === loggedInUsername;
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // NEW: report this card's visibility up to the strip. IntersectionObserver
  // with the default (viewport) root already accounts for the strip's own
  // horizontal overflow clipping, so a card half scrolled out of the
  // track reports a low ratio and isn't treated as visible.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !reel.src) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        onVisibilityChange(
          previewId,
          index,
          entry.isIntersecting && entry.intersectionRatio >= 0.6,
        ),
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      onVisibilityChange(previewId, index, false);
    };
  }, [previewId, index, reel.src, onVisibilityChange]);

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

  // Scroll autoplay only runs while this card is the strip's chosen
  // one AND the pointer isn't on it (hover has its own preview).
  const showAutoplay = autoplay && !hovered && !!reel.src;

  return (
    <div
      ref={cardRef}
      className="pf-reel-card"
      style={{ position: "relative" }}
      onClick={goToReel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        {reel.thumbnail && (
          <img
            src={reel.thumbnail}
            alt={reel.title}
            className="pf-reel-thumb"
            loading="lazy"
          />
        )}

        {/* CHANGED: one always-mounted video per card (no more mounting
            a fresh <video> when autoplay starts). It preloads once the
            card is within ~400px of the screen, plays muted while this
            card is the strip's active one, and cross-fades in over the
            thumbnail only when actually playing — so no buffering is
            ever visible. With no thumbnail it shows its own first frame. */}
        {reel.src ? (
          <AutoPlayVideo
            src={reel.src}
            poster={reel.thumbnail}
            active={showAutoplay}
            className="pf-reel-thumb"
          />
        ) : (
          !reel.thumbnail && (
            <div className="pf-reel-thumb pf-reel-thumb-placeholder">🎬</div>
          )
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

// ── The strip. Fully self-contained: fetches its own first page (from a
// random starting point, shifted by `startOffset` so multiple strips
// interleaved down the feed each show a different slice), shuffles each
// page, then keeps loading further pages as the user scrolls it
// horizontally. Owns its own report modal so a report from any card in
// this strip has somewhere to render. ──
const ReelsStrip = ({ startOffset = 0, wrapAround = true }) => {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(startOffset);
  const loadingRef = useRef(false);
  const trackRef = useRef(null);
  // NEW: total reel count, fetched once so we can pick a random offset.
  const totalRef = useRef(null);
  const loggedInUsername = localStorage.getItem("username") || "";

  // Unique per-strip id, so preview ids stay unique even when several
  // strips (or a wrapped-around duplicate of the same reel) are on
  // screen — the shared sound arbiter tells previews apart by id.
  const stripIdRef = useRef(Math.random().toString(36).slice(2));

  // NEW: scroll-autoplay bookkeeping. visibleRef maps previewId -> card
  // index for every card currently ≥60% on screen; activeKey is the
  // leftmost of those, i.e. the one card allowed to autoplay.
  const visibleRef = useRef(new Map());
  const [activeKey, setActiveKey] = useState(null);

  const handleVisibilityChange = useCallback((key, idx, visible) => {
    if (visible) visibleRef.current.set(key, idx);
    else visibleRef.current.delete(key);

    let bestKey = null;
    let bestIdx = Infinity;
    visibleRef.current.forEach((i, k) => {
      if (i < bestIdx) {
        bestIdx = i;
        bestKey = k;
      }
    });
    setActiveKey(bestKey);
  }, []);

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

  // Takes the full prefixed ids (e.g. "db_123") end-to-end, matching
  // how Reels.jsx / ReelItem identify content everywhere else (likes,
  // views, comments). Views are written with the prefixed content_id.
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

    // NEW: first load only — find how many reels exist, then jump to a
    // random spot so the strip looks different on every refresh.
    if (totalRef.current === null) {
      try {
        const { count } = await supabase
          .from("reels")
          .select("id", { count: "exact", head: true });
        totalRef.current = count || 0;
      } catch (_) {
        totalRef.current = 0;
      }
      if (totalRef.current > 0) {
        offsetRef.current =
          (Math.floor(SESSION_RANDOM_BASE * totalRef.current) + startOffset) %
          totalRef.current;
      }
    }

    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offsetRef.current, offsetRef.current + PAGE_SIZE - 1);

    if (!error && data && data.length > 0) {
      // NEW: shuffle each page before appending.
      const mapped = shuffle(data.map(mapReelRow));
      setReels((prev) => [...prev, ...mapped]);
      fetchViewCountsFor(mapped.map((r) => r.id));
      offsetRef.current += data.length;
      if (data.length < PAGE_SIZE) {
        if (wrapAround) {
          offsetRef.current = 0;
        } else {
          setHasMore(false);
        }
      }
    } else if (wrapAround && offsetRef.current > 0) {
      // NEW: a random offset can land past the end — wrap to the start
      // instead of showing an empty strip.
      offsetRef.current = 0;
    } else {
      setHasMore(false);
    }

    loadingRef.current = false;
    setLoading(false);
  }, [hasMore, wrapAround, fetchViewCountsFor, startOffset]);

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
      <style>{CARD_SIZE_CSS}</style>
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
        {reels.map((r, i) => {
          const previewId = `${stripIdRef.current}-${r.id}-${i}`;
          return (
            <ReelStripCard
              key={`${r.id}-${i}`}
              reel={r}
              previewId={previewId}
              index={i}
              autoplay={activeKey === previewId}
              onVisibilityChange={handleVisibilityChange}
              viewCount={viewCounts[r.id] ?? 0}
              navigate={navigate}
              loggedInUsername={loggedInUsername}
              onReport={setReportTarget}
              onDeleted={handleDeleted}
            />
          );
        })}
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