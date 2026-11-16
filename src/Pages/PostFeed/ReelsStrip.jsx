import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import { ThreeDotMenu, ReportModal, shareContent } from "../../Component/Shared/ContentMenu";
// Shared hover-preview thumbnail — sound-first autoplay, attached
// song synced to the clip, and a mute button that never triggers the
// card's navigation. See Component/Shared/PreviewThumb.jsx.
import PreviewThumb from "../../Component/Shared/PreviewThumb";
// NEW: shared always-mounted, preloading, buffer-hiding preview video.
import AutoPlayVideo from "../../Component/Shared/AutoPlayVideo";
// NEW: once the strip has auto-advanced far enough, hand off to the next
// video / post video below it in the feed.
import { advanceToNextFeedMedia } from "../../utils/autoAdvance";
// NEW: server-ranked reels (see feed_ranking.sql) + "seen" tracking.
import { markSeen, fetchRankedIds } from "../../utils/seenContent";

const PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD_PX = 300;

// When a page turns out to be mostly reels that are already shown (in this
// strip or in another strip), keep scanning until at least this many NEW
// reels were found (or the whole table was scanned).
const MIN_NEW_PER_LOAD = 6;
// Safety cap on pages scanned in one load.
const MAX_PAGES_PER_LOAD = 6;

// ids of reels currently shown by ANY strip on the page. Each strip claims
// what it loads and releases it when it unmounts, so two strips never show
// the same reel at the same time.
const claimedReelIds = new Set();

// How many cards the strip plays through on its own (each time a clip
// ends) before handing off to the next item in the feed.
const MAX_AUTO_ADVANCE = 4;

// Card width in px. Change this one number to resize the cards.
const CARD_WIDTH = 170;

// Size overrides, injected with the strip.
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

// ── One reel card in the strip (wrapped in React.memo). ──
const ReelStripCard = memo(function ReelStripCard({
  reel,
  previewId,
  index,
  autoplay,
  onVisibilityChange,
  onEnded,
  viewCount,
  navigate,
  loggedInUsername,
  onReport,
  onDeleted,
  onProfileView,
}) {
  const isOwner = loggedInUsername && reel.username && reel.username === loggedInUsername;
  const cardRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // Report this card's visibility up to the strip.
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !reel.src) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        // Remember it, so the next refresh shows unseen reels first.
        if (visible) markSeen("reel", reel.dbId);
        onVisibilityChange(previewId, index, visible);
      },
      { threshold: [0, 0.6, 1] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      onVisibilityChange(previewId, index, false);
    };
  }, [previewId, index, reel.src, reel.dbId, onVisibilityChange]);

  // This card is the one the user is looking at.
  useEffect(() => {
    if (autoplay && reel.username && onProfileView) onProfileView(reel.username);
  }, [autoplay, reel.username, onProfileView]);

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

  // Only the autoplaying card may move the strip on.
  const handleEnded = () => (showAutoplay ? onEnded(cardRef.current) : false);

  const songLabel =
    typeof reel.song === "string"
      ? reel.song
      : reel.song?.title
        ? `${reel.song.title}${reel.song.artist ? " · " + reel.song.artist : ""}`
        : "";

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

        {reel.src ? (
          <AutoPlayVideo
            src={reel.src}
            poster={reel.thumbnail}
            active={showAutoplay}
            className="pf-reel-thumb"
            onEnded={handleEnded}
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
      {songLabel && (
        <div className="pf-reel-song" title={songLabel}>
          🎵 {songLabel}
        </div>
      )}
    </div>
  );
});

// ── The strip. Fully self-contained: fetches its own pages and keeps
// loading further pages as the user scrolls it horizontally. ──
const ReelsStrip = ({
  startOffset = 0,
  wrapAround = true,
  fb,
  onProfileView,
  isProfileHidden,
}) => {
  const navigate = useNavigate();
  const isFirstStrip = startOffset === 0;
  const [reels, setReels] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  // Starts as true, so the header and skeleton cards show immediately
  // while the first page loads. If the server has no reels, the strip
  // disappears once loading finishes.
  const [loading, setLoading] = useState(true);
  const cursorRef = useRef(null);
  const loadingRef = useRef(false);
  const trackRef = useRef(null);
  const stripRef = useRef(null);
  const autoAdvancedRef = useRef(0);
  const loggedInUsername = localStorage.getItem("username") || "";

  const doneRef = useRef(false);
  const ownIdsRef = useRef(new Set());
  const epochRef = useRef(0);

  const stripIdRef = useRef(Math.random().toString(36).slice(2));

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

  // A clip in the strip ended. Scroll to the next card, or hand off to the
  // next feed item after MAX_AUTO_ADVANCE cards.
  const handleCardEnded = useCallback((cardEl) => {
    const track = trackRef.current;
    const next = cardEl?.nextElementSibling;

    if (
      track &&
      next &&
      !next.classList.contains("pf-reel-card-loading") &&
      autoAdvancedRef.current < MAX_AUTO_ADVANCE
    ) {
      autoAdvancedRef.current += 1;
      track.scrollBy({
        left:
          next.getBoundingClientRect().left -
          track.getBoundingClientRect().left,
        behavior: "smooth",
      });
      return true;
    }

    autoAdvancedRef.current = 0;
    return advanceToNextFeedMedia(stripRef.current);
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
      /* view counts are a nice-to-have */
    }
  }, []);

  const loadPage = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const epoch = epochRef.current;
    const dead = () => epoch !== epochRef.current;

    try {
      const fresh = [];
      let pages = 0;

      while (
        !doneRef.current &&
        fresh.length < MIN_NEW_PER_LOAD &&
        pages++ < MAX_PAGES_PER_LOAD
      ) {
        let ranked;
        try {
          ranked = await fetchRankedIds("reel", {
            limit: PAGE_SIZE,
            cursor: cursorRef.current,
            // a different shuffle per strip; only the first one pins
            seedOffset: startOffset,
            pin: isFirstStrip,
          });
        } catch (_) {
          break; // try again on the next scroll
        }
        if (dead()) return;

        if (ranked.ids.length === 0) {
          doneRef.current = true;
          break;
        }

        // Reserve reels BEFORE fetching them, so two strips loading at the
        // same time can never take the same reel.
        const wanted = [];
        for (const id of ranked.ids) {
          if (ownIdsRef.current.has(id) || claimedReelIds.has(id)) continue;
          ownIdsRef.current.add(id);
          claimedReelIds.add(id);
          wanted.push(id);
        }
        const release = (ids) =>
          ids.forEach((id) => {
            ownIdsRef.current.delete(id);
            claimedReelIds.delete(id);
          });

        let rows = [];
        if (wanted.length > 0) {
          const { data, error } = await supabase
            .from("reels")
            .select("*")
            .in("id", wanted);
          if (dead()) return;
          if (error) {
            release(wanted);
            break;
          }
          rows = data || [];
        }

        // Keep the server's order; free any id whose row no longer exists.
        const byId = new Map(rows.map((r) => [String(r.id), r]));
        wanted.forEach((id) => {
          const row = byId.get(id);
          if (!row) {
            release([id]);
            return;
          }
          fresh.push(row);
        });

        cursorRef.current = ranked.next;
        if (ranked.done) doneRef.current = true;
        if (!wrapAround && ranked.done) doneRef.current = true;
      }

      if (fresh.length > 0) {
        const mapped = fresh.map(mapReelRow);
        setReels((prev) => [...prev, ...mapped]);
        fetchViewCountsFor(mapped.map((r) => r.id));
      }
    } finally {
      if (!dead()) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [wrapAround, fetchViewCountsFor, startOffset, isFirstStrip]);

  useEffect(() => {
    loadPage();

    return () => {
      epochRef.current += 1;
      loadingRef.current = false;
      ownIdsRef.current.forEach((id) => claimedReelIds.delete(id));
      ownIdsRef.current = new Set();
      cursorRef.current = null;
      doneRef.current = false;
    };
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

  const handleDeleted = useCallback((dbId) => {
    setReels((prev) => prev.filter((r) => r.dbId !== dbId));
  }, []);

  if (reels.length === 0 && !loading) return null;

  // Drop reels hidden earlier via "Not interested", and reels from profiles
  // answered "Not interested" in the profile prompt.
  const visibleReels = reels.filter(
    (r) => !fb?.isHidden("reel", r.dbId) && !isProfileHidden?.(r.username),
  );

  return (
    <div className="pf-reels-strip" ref={stripRef}>
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
        onPointerDown={() => {
          autoAdvancedRef.current = 0;
        }}
      >
        {visibleReels.map((r, i) => {
          const previewId = `${stripIdRef.current}-${r.id}-${i}`;
          return (
            <ReelStripCard
              key={r.id}
              reel={r}
              previewId={previewId}
              index={i}
              autoplay={activeKey === previewId}
              onVisibilityChange={handleVisibilityChange}
              onEnded={handleCardEnded}
              viewCount={viewCounts[r.id] ?? 0}
              navigate={navigate}
              loggedInUsername={loggedInUsername}
              onReport={setReportTarget}
              onDeleted={handleDeleted}
              onProfileView={onProfileView}
            />
          );
        })}

        {/* CHANGED: shimmer skeleton cards instead of one grey "…" card.
            4 on the first load, 1 while loading more. Keep the
            `pf-reel-card-loading` class — handleCardEnded uses it so the
            strip never auto-advances onto a skeleton. */}
        {loading &&
          (reels.length === 0 ? [1, 2, 3, 4] : [1]).map((n) => (
            <div className="pf-reel-card pf-reel-card-loading" key={`sk-${n}`}>
              <div className="pf-reel-thumb-wrap pf-sk" />
              <div className="pf-sk pf-sk-line" style={{ width: "80%", marginTop: 8 }} />
              <div className="pf-sk pf-sk-line" style={{ width: "45%", height: 10, marginTop: 6 }} />
            </div>
          ))}
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