// /src/Component/Shared/LocationPicker.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
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

const PANEL_MAX_HEIGHT = 320; // must match .map-picker's max-height in CSS
const VIEWPORT_MARGIN = 12;   // breathing room from the screen edge

const LocationPicker = ({ onSelect, onClose, anchor = "left", position = "top" }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  // NEW: same auto-flip/clamp logic as MusicPicker — see its comment
  // for the full explanation. Fixes the panel opening upward from a
  // trigger near the top of the page and getting clipped by the
  // viewport/sticky header.
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
      className={`map-picker map-picker--${anchor} map-picker-${resolvedPosition}`}
      // NEW: inline max-height overrides the CSS default with whatever
      // actually fits in the space measured above.
      style={{ maxHeight: panelMaxHeight }}
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