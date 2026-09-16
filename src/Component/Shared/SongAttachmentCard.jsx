// /src/Component/Shared/SongAttachmentCard.jsx
import React, { useRef, useState, useEffect } from "react";
import "./MediaAttachPickers.css";

// Reusable mini audio player for an attached song — used in PostCard,
// Video.jsx, and Reels.jsx. `compact` renders as a small pill (good for
// composer previews / reel overlays); default renders the full card.
const SongAttachmentCard = ({ song, onRemove }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  if (!song) return null;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <div className="map-song-attachment">
      <audio
        ref={audioRef}
        src={song.url}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
      {song.cover ? (
        <img src={song.cover} alt="" className="map-song-attachment-cover" />
      ) : (
        <div className="map-song-cover-fallback">🎵</div>
      )}
      <button
        type="button"
        className="map-song-attachment-play"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <div className="map-song-attachment-info">
        <div className="map-song-attachment-title">{song.title}</div>
        <div className="map-song-attachment-artist">{song.artist}</div>
      </div>
      {playing && (
        <div className="map-song-attachment-eq">
          <span /><span /><span />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          className="map-song-attachment-remove"
          onClick={onRemove}
          aria-label="Remove song"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SongAttachmentCard;