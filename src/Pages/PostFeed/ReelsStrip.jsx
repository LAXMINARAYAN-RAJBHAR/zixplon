import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../config/supabase";

const HOVER_PREVIEW_DELAY = 350; // ms
const PAGE_SIZE = 10;
// How close to the right edge (px) triggers loading the next page —
// fires a little before the user actually hits the end so more cards
// are ready by the time they get there.
const LOAD_MORE_THRESHOLD_PX = 300;

const mapReelRow = (r) => ({
  id: "db_" + r.id,
  dbId: r.id,
  src: r.video_url,
  thumbnail: r.thumbnail || null,
  title: r.title || "Untitled",
  duration: r.duration || "00:00",
  user: r.user || r.username || "Unknown",
  username: r.username || "unknown",
});

// ── View count formatting — mirrors formatViews() used elsewhere in the
// app (homePage.js, PostFeed.jsx) so counts read consistently everywhere. ──
const formatViews = (n) => {
  if (!n || n === 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
};

// ── One reel card in the strip. Desktop hovers-to-preview (muted, looping
// clip in place of the thumbnail); mobile just shows the static thumbnail
// (or the video's own first frame if no thumbnail_url exists) and relies
// on the tap to open the reel. Clicking/tapping navigates into the full
// Reels swipe player, passing the reel object as `clickedReel` state so
// it opens instantly there instead of waiting on a fresh fetch — same
// pattern Homepage's ShortCard uses today. ──
const ReelStripCard = ({ reel, viewCount, navigate }) => {
  const [previewing, setPreviewing] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);

  const onEnter = () => {
    if (!reel.src) return;
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

  const goToReel = () => {
    navigate(`/reels/${reel.id}`, { state: { clickedReel: reel } });
  };

  return (
    <div
      className="pf-reel-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={goToReel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToReel();
        }
      }}
    >
      <div className="pf-reel-thumb-wrap">
        {reel.thumbnail ? (
          <>
            <img
              src={reel.thumbnail}
              alt={reel.title}
              className="pf-reel-thumb"
              style={{ opacity: previewing ? 0 : 1 }}
              loading="lazy"
            />
            {previewing && reel.src && (
              <video
                ref={videoRef}
                src={reel.src}
                muted
                loop
                playsInline
                preload="metadata"
                className="pf-reel-thumb pf-reel-thumb-video"
              />
            )}
          </>
        ) : reel.src ? (
          <video
            ref={videoRef}
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
        {/* NEW: view count badge, bottom-left — mirrors Homepage's
            ShortCard (👁 count), sourced from the "views" table tallied
            per reel in ReelsStrip's loadPage below. */}
        <span className="pf-reel-viewcount">👁 {formatViews(viewCount)}</span>
      </div>
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
// then keeps loading further pages as the user scrolls it horizontally —
// an infinite strip, not a fixed batch. `wrapAround` (default true) means
// once the underlying reels table is exhausted, it loops back to offset 0
// instead of just stopping, so the strip never visibly "runs out" — set
// it to false if you'd rather it stop at the real end of the table. ──
const ReelsStrip = ({ startOffset = 0, wrapAround = true }) => {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  // NEW: view counts keyed by reel dbId (number) -> count. Fetched
  // alongside each page of reels rather than one-by-one per card, so a
  // page of 10 reels costs one extra query, not ten.
  const [viewCounts, setViewCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(startOffset);
  const loadingRef = useRef(false);
  const trackRef = useRef(null);

  // Fetches the view count for a batch of reels (by their numeric dbId)
  // from the shared "views" table, same content_type: "reel" rows the
  // rest of the app already writes via incrementView(). Tallies rows
  // client-side into a { dbId: count } map and merges it into state.
  const fetchViewCountsFor = useCallback(async (dbIds) => {
    if (!dbIds || dbIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("views")
        .select("content_id")
        .eq("content_type", "reel")
        .in("content_id", dbIds.map(String));

      const counts = {};
      dbIds.forEach((id) => {
        counts[id] = 0;
      });
      if (!error && data) {
        data.forEach((row) => {
          const id = Number(row.content_id);
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
      fetchViewCountsFor(mapped.map((r) => r.dbId));
      offsetRef.current += data.length;
      if (data.length < PAGE_SIZE) {
        // Hit the real end of the table.
        if (wrapAround) {
          offsetRef.current = 0; // loop back around for the next page
        } else {
          setHasMore(false);
        }
      }
    } else {
      // Empty page — either genuinely out of reels, or (if wrapping) the
      // table itself is empty. Either way, stop trying.
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
            viewCount={viewCounts[r.dbId] ?? 0}
            navigate={navigate}
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
    </div>
  );
};

export default ReelsStrip;