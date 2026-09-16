// /src/Component/Shared/MusicPicker.jsx
import React, { useState, useEffect, useRef } from "react";
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

const MusicPicker = ({ onSelect, onClose, anchor = "left", position = "top" }) => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState(FALLBACK_SONGS);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);
  const ref = useRef(null);

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
      className={`map-picker map-picker--${anchor} map-picker-${position}`}
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