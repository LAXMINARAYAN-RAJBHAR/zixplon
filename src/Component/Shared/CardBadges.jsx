// /src/Component/Shared/CardBadges.jsx
import React from "react";
import "./MediaAttachPickers.css";

// Compact badge row for video/reel thumbnail cards — shows small icons
// when the content has an attached feeling, song, or location, without
// taking up much space. Pass only the fields that exist; each renders
// independently. `variant="dark"` is for badges sitting over a video
// thumbnail (needs a translucent dark pill for contrast); `variant="light"`
// is for badges sitting in a card's text/body area below the thumbnail.
const CardBadges = ({ feeling, song, locationName, variant = "dark" }) => {
  if (!feeling && !song && !locationName) return null;

  return (
    <div className={`map-card-badges map-card-badges--${variant}`}>
      {feeling && (
        <span className="map-card-badge" title={`Feeling ${feeling}`}>
          {feeling.match(/\p{Emoji}/u)?.[0] || "😊"}
        </span>
      )}
      {song && (
        <span className="map-card-badge" title={`${song.title} — ${song.artist}`}>
          🎵
        </span>
      )}
      {locationName && (
        <span className="map-card-badge" title={locationName}>
          📍
        </span>
      )}
    </div>
  );
};

export default CardBadges;