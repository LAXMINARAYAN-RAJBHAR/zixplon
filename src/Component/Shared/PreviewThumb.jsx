// Component/Shared/PreviewThumb.jsx
//
// Wraps a thumbnail. After a short hover it plays the clip over the
// thumbnail, sound-first: tries unmuted, falls back to a muted loop if
// the browser blocks it, and retries with sound on the visitor's next
// interaction. An attached song plays in sync with the clip, and the
// clip's own volume follows the creator's mix. The mute button never
// triggers the surrounding <Link> / card click.
//
// Sound coordination follows utils/soundArbiter.js:
//  - the preview CLAIMS sound only while it is actually playing
//    unmuted (not while it is in the muted-autoplay fallback), and
//    releases the claim whenever it is muted or goes away;
//  - if another card claims sound, this preview goes QUIET (mutes its
//    clip and song) but keeps playing, exactly as the arbiter's
//    contract describes. It never stops the preview.
//
// Only devices with a real hover pointer preview; on touch screens a
// tap simply navigates as before.

import React, { useState, useRef, useEffect } from "react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import Hls from "hls.js";
import { onUserInteract } from "../../utils/audioUnlock";
import { claimSound, releaseSound, soundPrefs } from "../../utils/soundArbiter";
import "./PreviewThumb.css";

const HOVER_DELAY_MS = 300;

const isHlsSource = (src) => !!src && /\.m3u8(\?.*)?$/i.test(src);

const canHover = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(hover: hover)").matches;

const PreviewThumb = ({
  id,
  src,
  song,
  originalVolume = 1,
  className,
  style,
  children,
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const hlsRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const autoMutedRef = useRef(false);
  const unsubRef = useRef(null);

  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(soundPrefs.muted);
  const [progress, setProgress] = useState(0);

  const stopPreview = () => {
    clearTimeout(hoverTimerRef.current);
    setActive(false);
    setPlaying(false);
    setProgress(0);
  };

  const handleEnter = () => {
    if (!src || !canHover()) return;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setActive(true), HOVER_DELAY_MS);
  };

  useEffect(() => {
    if (!active) return;
    const vid = videoRef.current;
    if (!vid) return;
    const audio = audioRef.current;

    autoMutedRef.current = false;
    vid.volume = song ? originalVolume : 1;

    if (isHlsSource(src)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 10, enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(vid);
        hlsRef.current = hls;
      } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
        vid.src = src;
      }
    }

    // Another card took over the sound: go quiet, keep playing. The
    // visitor's saved mute preference (soundPrefs) is left untouched,
    // so this is a temporary silence, not a mute they chose.
    const goQuiet = () => {
      vid.muted = true;
      if (audio) audio.muted = true;
      setMuted(true);
    };

    // Claim the arbiter only while genuinely audible; release it the
    // moment this preview is muted (by the visitor, by the autoplay
    // fallback, or by goQuiet above — in which case the claim already
    // belongs to someone else and releaseSound is a safe no-op).
    const syncClaim = () => {
      if (!vid.paused && !vid.muted) claimSound(id, goQuiet);
      else releaseSound(id);
    };

    const syncPlay = () => {
      if (!audio) return;
      audio.currentTime = 0;
      audio.muted = vid.muted;
      audio.play().catch(() => {});
    };
    const syncPause = () => audio?.pause();
    const syncMute = () => {
      if (audio) audio.muted = vid.muted;
      syncClaim();
    };
    const onPlaying = () => {
      setPlaying(true);
      syncClaim();
    };
    const onTime = () => {
      if (vid.duration) setProgress((vid.currentTime / vid.duration) * 100);
    };

    vid.addEventListener("play", syncPlay);
    vid.addEventListener("pause", syncPause);
    vid.addEventListener("volumechange", syncMute);
    vid.addEventListener("playing", onPlaying);
    vid.addEventListener("timeupdate", onTime);

    const start = () => {
      vid.muted = soundPrefs.muted;
      setMuted(soundPrefs.muted);
      vid.play().catch(() => {
        // Browser blocked unmuted autoplay -> muted loop, then retry
        // with sound after the visitor's next interaction.
        vid.muted = true;
        autoMutedRef.current = true;
        setMuted(true);
        vid.play().catch(() => {});
        unsubRef.current = onUserInteract(() => {
          if (!autoMutedRef.current) return;
          autoMutedRef.current = false;
          vid.muted = soundPrefs.muted;
          setMuted(soundPrefs.muted);
        });
      });
    };
    if (vid.readyState >= 2) start();
    else vid.addEventListener("loadeddata", start, { once: true });

    return () => {
      vid.removeEventListener("play", syncPlay);
      vid.removeEventListener("pause", syncPause);
      vid.removeEventListener("volumechange", syncMute);
      vid.removeEventListener("playing", onPlaying);
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("loadeddata", start);
      unsubRef.current?.();
      unsubRef.current = null;
      autoMutedRef.current = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      vid.pause();
      audio?.pause();
      releaseSound(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, src, id]);

  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  const toggleMute = (e) => {
    e.preventDefault(); // don't follow a surrounding <Link>
    e.stopPropagation(); // don't trigger a surrounding card's onClick
    autoMutedRef.current = false;
    unsubRef.current?.();
    unsubRef.current = null;
    const next = !muted;
    soundPrefs.muted = next;
    setMuted(next);
    // Changing vid.muted fires "volumechange", which also mirrors the
    // change onto the song and claims / releases the arbiter.
    if (videoRef.current) videoRef.current.muted = next;
    if (audioRef.current) audioRef.current.muted = next;
  };

  return (
    <div
      className={className}
      style={{ position: "relative", ...style }}
      onMouseEnter={handleEnter}
      onMouseLeave={stopPreview}
    >
      {children}

      {active && (
        <video
          ref={videoRef}
          src={isHlsSource(src) ? undefined : src}
          loop
          playsInline
          preload="auto"
          className="preview_video"
          style={{ opacity: playing ? 1 : 0 }}
        />
      )}

      {active && song?.url && (
        <audio
          ref={audioRef}
          src={song.url}
          loop
          preload="auto"
          style={{ display: "none" }}
        />
      )}

      {active && (
        <>
          <button
            type="button"
            className="preview_mute_btn"
            onClick={toggleMute}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={muted ? "Unmute preview" : "Mute preview"}
          >
            {muted ? (
              <VolumeOffIcon sx={{ fontSize: 16 }} />
            ) : (
              <VolumeUpIcon sx={{ fontSize: 16 }} />
            )}
          </button>
          {song && (
            <div className="preview_song_badge">
              🎵 {song.title}
              {song.artist ? ` · ${song.artist}` : ""}
            </div>
          )}
          <div className="preview_progress">
            <div
              className="preview_progress_fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PreviewThumb;