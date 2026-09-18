// /src/Component/Shared/SongAttachmentCard.jsx
import React, { useRef, useState, useEffect } from "react";
import "./MediaAttachPickers.css";

// Reusable mini "attached song" card — used in PostCard, Video.jsx, and
// Reels.jsx.
//
// Two modes:
//  - Standalone (default): manages its own <audio> element, tappable
//    play/pause button. Used on Posts, where there's no host video to
//    sync against.
//  - Synced (`synced` prop true): the PARENT owns an <audio> element and
//    controls actual playback (kept in lockstep with the host video's
//    play/pause/mute state, so the song autoplays along with the video/
//    reel). This card just reflects that state visually — `isPlaying`
//    is passed in, and the tappable play button is replaced with a
//    plain music-note indicator since tapping it wouldn't control
//    anything by itself.
const SongAttachmentCard = ({
  song,
  onRemove,
  synced = false,
  isPlaying: externalIsPlaying = false,
}) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (synced) return;
    return () => audioRef.current?.pause();
  }, [synced]);

  if (!song) return null;

  const toggle = () => {
    if (synced || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const active = synced ? externalIsPlaying : playing;

  return (
    <div className="map-song-attachment">
      {!synced && (
        <audio
          ref={audioRef}
          src={song.url}
          onEnded={() => setPlaying(false)}
          preload="none"
        />
      )}
      {song.cover ? (
        <img src={song.cover} alt="" className="map-song-attachment-cover" />
      ) : (
        <div className="map-song-cover-fallback">🎵</div>
      )}
      {synced ? (
        <div
          className="map-song-attachment-play map-song-attachment-play--static"
          aria-label="Attached song"
        >
          🎵
        </div>
      ) : (
        <button
          type="button"
          className="map-song-attachment-play"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
      )}
      <div className="map-song-attachment-info">
        <div className="map-song-attachment-title">{song.title}</div>
        <div className="map-song-attachment-artist">{song.artist}</div>
      </div>
      {active && (
        <div className="map-song-attachment-eq">
          <span />
          <span />
          <span />
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