// /src/Component/Shared/MusicPicker.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { supabase } from "../../config/supabase";
import "./MediaAttachPickers.css";

// Fallback catalog — used if a `songs` table doesn't exist yet, or a
// search matches nothing there. Swap/extend freely; shape must match
// { title, artist, cover, url }.
const FALLBACK_SONGS = [
  { title: "Sunny Days", artist: "Lo-Fi Collective", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg" },
  { title: "Night Drive", artist: "Synthwave Kid", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/light_rain.ogg" },
  { title: "Golden Hour", artist: "Aria Waves", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/wind.ogg" },
  { title: "Street Beat", artist: "DJ Nova", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&q=60", url: "https://actions.google.com/sounds/v1/ambiences/city_traffic.ogg" },
];

const PANEL_MAX_HEIGHT = 320; // must match .map-picker's max-height in CSS
const VIEWPORT_MARGIN = 12;   // breathing room from the screen edge

const MusicPicker = ({ onSelect, onClose, anchor = "left", position = "top" }) => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState(FALLBACK_SONGS);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const ref = useRef(null);

  // NEW: resolvedPosition/panelMaxHeight — the `position` prop is a
  // preference, not a guarantee. Composers can sit right under a sticky
  // header (no room to open upward) or near the bottom of a tall page
  // (no room to open downward). On mount, measure actual space above vs.
  // below the trigger and flip + clamp height so the panel always stays
  // fully on-screen instead of getting clipped, as it was doing when
  // opened from a trigger near the top of the viewport.
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

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("songs")
          .select("title, artist, cover_url, preview_url")
          .order("created_at", { ascending: false })
          .limit(40);
        if (!error && data && data.length > 0) {
          setSongs(
            data.map((s) => ({
              title: s.title,
              artist: s.artist,
              cover: s.cover_url || null,
              url: s.preview_url,
            })),
          );
        }
      } catch (_) {
        // table may not exist yet — fallback list already set
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const filtered = songs.filter(
    (s) =>
      !query.trim() ||
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.artist.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      ref={ref}
      className={`map-picker map-picker--${anchor} map-picker-${resolvedPosition}`}
      // NEW: inline max-height overrides the CSS default (320px) with
      // whatever actually fits in the space we measured above — this
      // is the belt-and-braces guard for viewports too short for even
      // the flipped side to fit the full 320px.
      style={{ maxHeight: panelMaxHeight }}
    >
      <input
        className="map-picker-search"
        placeholder="Search songs or artists…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="map-picker-list">
        {loading ? (
          <div className="map-picker-empty">Loading songs…</div>
        ) : filtered.length === 0 ? (
          <div className="map-picker-empty">No songs found</div>
        ) : (
          filtered.map((s, i) => (
            <div
              className="map-song-row"
              key={`${s.title}-${i}`}
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
          ))
        )}
      </div>
    </div>
  );
};

export default MusicPicker;