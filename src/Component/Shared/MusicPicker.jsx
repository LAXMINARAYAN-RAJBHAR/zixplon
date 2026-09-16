// /src/Component/Shared/MusicPicker.jsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import "./MediaAttachPickers.css";

// Fallback catalog — used only if the `songs` table doesn't exist yet
// AND no search term has been typed. Once the user types anything,
// iTunes search takes over (see searchItunes below), so this list no
// longer caps how much music is reachable.
const FALLBACK_SONGS = [
  { title: "Sunny Days", artist: "Lo-Fi Collective", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg" },
  { title: "Night Drive", artist: "Synthwave Kid", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/light_rain.ogg" },
  { title: "Golden Hour", artist: "Aria Waves", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/wind.ogg" },
  { title: "Street Beat", artist: "DJ Nova", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/city_traffic.ogg" },
];

const PANEL_MAX_HEIGHT = 320; // must match .map-picker's max-height in CSS
const VIEWPORT_MARGIN = 12;   // breathing room from the screen edge
const PAGE_SIZE = 20;         // rows fetched per Supabase "trending" page
const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

// NEW: unlimited catalog search. Apple's Search API is free, needs no
// key, allows CORS from the browser, and returns a 30s previewUrl per
// track — a direct drop-in for the { title, artist, cover, url } shape
// this component already uses everywhere else (rows, preview button,
// SongAttachmentCard, etc).
const searchItunes = async (term) => {
  const res = await fetch(
    `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&media=music&limit=25`,
  );
  const data = await res.json();
  return (data.results || [])
    .filter((r) => r.previewUrl)
    .map((r) => ({
      title: r.trackName,
      artist: r.artistName,
      cover: r.artworkUrl100 ? r.artworkUrl100.replace("100x100bb", "300x300bb") : null,
      url: r.previewUrl,
    }));
};

const MusicPicker = ({ onSelect, onClose, anchor = "left", position = "top" }) => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState(FALLBACK_SONGS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const ref = useRef(null);
  const listRef = useRef(null);

  // NEW: pagination state for the no-search "trending" view, and a flag
  // for whether we're currently showing search results (which are
  // never paginated — a fresh query just replaces the list).
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const isSearching = query.trim().length > 0;

  const [resolvedPosition, setResolvedPosition] = useState(position);
  const [panelMaxHeight, setPanelMaxHeight] = useState(PANEL_MAX_HEIGHT);

  useLayoutEffect(() => {
    const wrap = ref.current?.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;

    let finalPosition = position;
    if (position === "bottom" && spaceAbove < PANEL_MAX_HEIGHT && spaceBelow > spaceAbove) {
      finalPosition = "top";
    } else if (position === "top" && spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow) {
      finalPosition = "bottom";
    }
    setResolvedPosition(finalPosition);

    const available = finalPosition === "bottom" ? spaceAbove : spaceBelow;
    setPanelMaxHeight(Math.max(160, Math.min(PANEL_MAX_HEIGHT, available)));
  }, [position]);

  // ── Trending/browse page loader (Supabase "songs" table) ──
  const loadPage = useCallback(async (pageNum) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist, cover_url, preview_url")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error || !data) throw error || new Error("no data");

      if (data.length === 0 && pageNum === 0) {
        // Table exists but is empty — nothing to paginate; keep the
        // static fallback list so the picker isn't blank.
        setUsingFallback(true);
        setSongs(FALLBACK_SONGS);
        setHasMore(false);
        return;
      }

      const mapped = data.map((s) => ({
        title: s.title,
        artist: s.artist,
        cover: s.cover_url || null,
        url: s.preview_url,
      }));

      setUsingFallback(false);
      setSongs((prev) => (pageNum === 0 ? mapped : [...prev, ...mapped]));
      setHasMore(data.length === PAGE_SIZE);
    } catch (_) {
      // Table may not exist yet — fall back to the static list, and
      // don't try to paginate further.
      if (pageNum === 0) {
        setUsingFallback(true);
        setSongs(FALLBACK_SONGS);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  // ── Search (debounced) — switches the list to iTunes results ──
  useEffect(() => {
    if (!isSearching) return; // empty query: trending list above handles it
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchItunes(query.trim());
        setSongs(results);
      } catch (_) {
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, isSearching]);

  // NEW: infinite scroll — only active for the trending (non-search,
  // non-fallback) list, since search results are a fixed batch and the
  // static fallback has nothing more to fetch.
  const handleScroll = () => {
    if (isSearching || usingFallback || loadingMore || !hasMore) return;
    const el = listRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      loadPage(nextPage);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePreview = (url) => {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch(() => {});
    audio.onended = () => setPlayingUrl(null);
    audioRef.current = audio;
    setPlayingUrl(url);
  };

  // When browsing the trending list (not searching), client-side filter
  // is no longer needed — pagination + the query itself now drives what
  // shows. `songs` already IS the right list for either mode.
  const filtered = songs;

  return (
    <div
      ref={ref}
      className={`map-picker map-picker--${anchor} map-picker-${resolvedPosition}`}
      style={{ maxHeight: panelMaxHeight }}
    >
      <input
        className="map-picker-search"
        placeholder="Search any song or artist…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="map-picker-list" ref={listRef} onScroll={handleScroll}>
        {loading ? (
          <div className="map-picker-empty">
            {isSearching ? "Searching…" : "Loading songs…"}
          </div>
        ) : filtered.length === 0 ? (
          <div className="map-picker-empty">No songs found</div>
        ) : (
          <>
            {filtered.map((s, i) => (
              <div
                className="map-song-row"
                key={`${s.title}-${s.artist}-${i}`}
                onClick={() => {
                  audioRef.current?.pause();
                  onSelect(s);
                  onClose();
                }}
              >
                {s.cover ? (
                  <img src={s.cover} alt="" className="map-song-cover" />
                ) : (
                  <div className="map-song-cover-fallback">🎵</div>
                )}
                <div className="map-song-meta">
                  <div className="map-song-title">{s.title}</div>
                  <div className="map-song-artist">{s.artist}</div>
                </div>
                <button
                  type="button"
                  className="map-song-preview-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreview(s.url);
                  }}
                  title="Preview"
                >
                  {playingUrl === s.url ? "⏸" : "▶"}
                </button>
              </div>
            ))}
            {loadingMore && (
              <div className="map-picker-empty">Loading more…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MusicPicker;