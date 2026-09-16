// /src/Component/Shared/MusicPicker.jsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import "./MediaAttachPickers.css";

// Fallback catalog — used only if the `songs` table doesn't exist yet
// AND no search term has been typed.
const FALLBACK_SONGS = [
  { title: "Sunny Days", artist: "Lo-Fi Collective", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg" },
  { title: "Night Drive", artist: "Synthwave Kid", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/light_rain.ogg" },
  { title: "Golden Hour", artist: "Aria Waves", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/wind.ogg" },
  { title: "Street Beat", artist: "DJ Nova", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/city_traffic.ogg" },
];

const PANEL_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 12;
const PAGE_SIZE = 20;
const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

// NEW: region presets. `country` picks the iTunes storefront (this is
// what actually gates Bollywood/regional availability — it was
// silently defaulting to "us" before). `hint` is an optional keyword
// appended to the user's query to nudge results toward a language,
// since iTunes' API has no direct language filter.
const REGIONS = [
  { id: "bollywood", label: "🇮🇳 Bollywood", country: "in", hint: "" },
  { id: "hollywood", label: "🇺🇸 Hollywood", country: "us", hint: "" },
  { id: "punjabi",   label: "Punjabi",        country: "in", hint: "punjabi" },
  { id: "tamil",     label: "Tamil",          country: "in", hint: "tamil" },
  { id: "telugu",    label: "Telugu",         country: "in", hint: "telugu" },
];

// NEW: unlimited catalog search, now storefront-aware. Same free,
// no-key, CORS-enabled Apple endpoint as before — the only change is
// the `country` param, which is what actually unlocks Bollywood and
// regional Indian results instead of the US-only catalog.
const searchItunes = async (term, country) => {
  const q = term.trim();
  const res = await fetch(
    `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(q)}&country=${country}&media=music&limit=25`,
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
  // NEW: defaults to Bollywood/India storefront, since that's the
  // catalog missing before — pick whichever default suits your userbase.
  const [regionId, setRegionId] = useState("bollywood");
  const region = REGIONS.find((r) => r.id === regionId);

  const [songs, setSongs] = useState(FALLBACK_SONGS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const ref = useRef(null);
  const listRef = useRef(null);

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

  // ── Search (debounced) — re-runs on query OR region change, since
  // switching region should re-search with the new storefront/hint
  // immediately if there's already a query typed. ──
  useEffect(() => {
    if (!isSearching) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const term = region.hint ? `${query.trim()} ${region.hint}` : query.trim();
        const results = await searchItunes(term, region.country);
        setSongs(results);
      } catch (_) {
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, isSearching, regionId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filtered = songs;

  return (
    <div
      ref={ref}
      className={`map-picker map-picker--${anchor} map-picker-${resolvedPosition}`}
      style={{ maxHeight: panelMaxHeight }}
    >
      {/* NEW: region chips — only meaningful while searching, since the
          empty-state trending list still comes from Supabase, not iTunes. */}
      <div className="map-region-chips">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`map-region-chip${regionId === r.id ? " active" : ""}`}
            onClick={() => setRegionId(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <input
        className="map-picker-search"
        placeholder={`Search ${region.label.replace(/^\S+\s/, "")} songs or artists…`}
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