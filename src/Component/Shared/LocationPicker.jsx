// /src/Component/Shared/LocationPicker.jsx
import React, { useState, useEffect, useRef } from "react";
import "./MediaAttachPickers.css";

// Free, no-key reverse/forward geocoding via OpenStreetMap Nominatim.
// Swap for Google Places if you have an API key and want richer results —
// just replace fetchSuggestions()/reverseGeocode() below.
const fetchSuggestions = async (q) => {
  if (!q.trim()) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
  );
  const data = await res.json();
  return data.map((d) => d.display_name);
};

const reverseGeocode = async (lat, lng) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
  );
  const data = await res.json();
  return data.display_name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
};

const LocationPicker = ({ onSelect, onClose, anchor = "left", position = "top" }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setSuggestions(await fetchSuggestions(query));
      } catch (_) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const name = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          onSelect(name);
          onClose();
        } catch (_) {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const shortenName = (full) => full.split(",").slice(0, 3).join(",").trim();

  return (
    <div
      ref={ref}
      className={`map-picker map-picker--${anchor} map-picker-${position}`}
    >
      <button
        type="button"
        className="map-loc-current-btn"
        onClick={useCurrentLocation}
        disabled={locating}
      >
        📍 {locating ? "Finding you…" : "Use current location"}
      </button>

      <input
        className="map-picker-search"
        placeholder="Search for a place…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) {
            onSelect(shortenName(query.trim()));
            onClose();
          }
        }}
        autoFocus
      />

      <div className="map-picker-list">
        {loading ? (
          <div className="map-picker-empty">Searching…</div>
        ) : suggestions.length === 0 ? (
          query.trim() ? (
            <div
              className="map-loc-row"
              onClick={() => { onSelect(query.trim()); onClose(); }}
            >
              📍 Use “{query.trim()}”
            </div>
          ) : (
            <div className="map-picker-empty">Type to search a place</div>
          )
        ) : (
          suggestions.map((s, i) => (
            <div
              className="map-loc-row"
              key={i}
              onClick={() => { onSelect(shortenName(s)); onClose(); }}
            >
              📍 {shortenName(s)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LocationPicker;