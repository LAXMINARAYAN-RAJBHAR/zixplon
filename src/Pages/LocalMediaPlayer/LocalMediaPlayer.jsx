import { useState, useRef, useEffect, useCallback } from "react";

const formatTime = (secs) => {
  if (!secs || isNaN(secs)) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
};

// ✅ Detect mobile immediately (not in useEffect) to avoid layout flicker
const checkMobile = () =>
  typeof window !== "undefined" && window.innerWidth <= 768;

export default function LocalMediaPlayer() {
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [currentObjectURL, setCurrentObjectURL] = useState(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  // ✅ Initialize synchronously so first render is already correct
  const [isMobile, setIsMobile] = useState(checkMobile);

  const mediaRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const hideTimer = useRef(null);
  const fileInputRef = useRef(null);

  const currentMedia = playlist[currentIndex];
  const isAudio = currentMedia?.type?.startsWith("audio");
  const isVideo = currentMedia?.type?.startsWith("video");
  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  // ✅ Update isMobile on resize
  useEffect(() => {
    const handler = () => setIsMobile(checkMobile());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ✅ Open playlist by default on desktop, closed on mobile
  useEffect(() => {
    setShowPlaylist(!isMobile);
  }, [isMobile]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing && isVideo) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing, isVideo]);

  useEffect(() => {
    if (!currentMedia) return;
    if (currentObjectURL) URL.revokeObjectURL(currentObjectURL);
    const url = URL.createObjectURL(currentMedia.file);
    setCurrentObjectURL(url);
    if (mediaRef.current) {
      mediaRef.current.src = url;
      mediaRef.current.load();
      if (playing) mediaRef.current.play().catch(() => {});
    }
    return () => URL.revokeObjectURL(url);
  }, [currentIndex, currentMedia?.file]);

  useEffect(() => {
    const m = mediaRef.current;
    if (!m) return;
    const onTime = () => {
      if (!seeking) setCurrentTime(m.currentTime);
    };
    const onDuration = () => setDuration(m.duration);
    const onEnded = () => {
      if (loop) {
        m.play();
        return;
      }
      if (shuffle) setCurrentIndex(Math.floor(Math.random() * playlist.length));
      else if (currentIndex < playlist.length - 1)
        setCurrentIndex((i) => i + 1);
      else setPlaying(false);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    m.addEventListener("timeupdate", onTime);
    m.addEventListener("durationchange", onDuration);
    m.addEventListener("ended", onEnded);
    m.addEventListener("play", onPlay);
    m.addEventListener("pause", onPause);
    return () => {
      m.removeEventListener("timeupdate", onTime);
      m.removeEventListener("durationchange", onDuration);
      m.removeEventListener("ended", onEnded);
      m.removeEventListener("play", onPlay);
      m.removeEventListener("pause", onPause);
    };
  }, [loop, shuffle, currentIndex, playlist.length, seeking]);

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume;
      mediaRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    const handleKey = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          seek(5);
          break;
        case "ArrowLeft":
          seek(-5);
          break;
        case "ArrowUp":
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case "ArrowDown":
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case "m":
        case "M":
          setMuted((m) => !m);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playing]);

  const handleFiles = (files) => {
    const mediaFiles = Array.from(files).filter(
      (f) => f.type.startsWith("video/") || f.type.startsWith("audio/"),
    );
    if (!mediaFiles.length) return;
    const newItems = mediaFiles.map((file, i) => ({
      id: Date.now() + i,
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      type: file.type,
      size: file.size,
    }));
    setPlaylist((prev) => {
      if (prev.length === 0) setCurrentIndex(0);
      return [...prev, ...newItems];
    });
  };

  const togglePlay = () => {
    if (!mediaRef.current || !currentMedia) return;
    if (playing) mediaRef.current.pause();
    else mediaRef.current.play().catch(() => {});
    resetHideTimer();
  };

  const seek = (delta) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(
      0,
      Math.min(duration, mediaRef.current.currentTime + delta),
    );
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (mediaRef.current) mediaRef.current.currentTime = val;
  };

  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      setFullscreen(true);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(
        document,
      );
      setFullscreen(false);
    }
  };

  const removeFromPlaylist = (id, e) => {
    e.stopPropagation();
    setPlaylist((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const next = prev.filter((p) => p.id !== id);
      if (idx <= currentIndex && currentIndex > 0)
        setCurrentIndex((i) => i - 1);
      return next;
    });
  };

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4];

  const Btn = ({
    onClick,
    active,
    children,
    title,
    style: extraStyle = {},
  }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none",
        border: "none",
        color: active ? "#e50914" : "#ccc",
        cursor: "pointer",
        padding: isMobile ? "6px 7px" : "4px 5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
        flexShrink: 0,
        WebkitTapHighlightColor: "transparent",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );

  const SeekBar = () => (
    <div
      style={{
        position: "relative",
        height: 20,
        display: "flex",
        alignItems: "center",
        marginBottom: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 3,
          background: "#2a2a2a",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          height: 3,
          width: `${progressPct}%`,
          background: "#e50914",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onMouseDown={() => setSeeking(true)}
        onMouseUp={() => setSeeking(false)}
        onTouchStart={() => setSeeking(true)}
        onTouchEnd={() => setSeeking(false)}
        onChange={handleSeek}
        style={{
          position: "absolute",
          width: "100%",
          height: 20,
          opacity: 0,
          cursor: "pointer",
          margin: 0,
        }}
      />
    </div>
  );

  const PlaylistPanel = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#111",
        ...(isMobile
          ? {
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: "58vh",
              zIndex: 100,
              borderTop: "1px solid #222",
              borderRadius: "18px 18px 0 0",
            }
          : {
              width: 290,
              borderLeft: "1px solid #1e1e1e",
              flexShrink: 0,
            }),
      }}
    >
      {/* drag handle on mobile */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: "#333",
              borderRadius: 2,
            }}
          />
        </div>
      )}

      {/* header */}
      <div
        style={{
          padding: "10px 16px 12px",
          borderBottom: "1px solid #1e1e1e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
          Playlist ({playlist.length})
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "#e50914",
              border: "none",
              borderRadius: 7,
              color: "#fff",
              padding: "7px 13px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              touchAction: "manipulation",
            }}
          >
            + Add Files
          </button>
          {playlist.length > 0 && (
            <button
              onClick={() => {
                setPlaylist([]);
                setCurrentIndex(0);
                setPlaying(false);
              }}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 7,
                color: "#666",
                padding: "7px 11px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Clear
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setShowPlaylist(false)}
              style={{
                background: "none",
                border: "none",
                color: "#555",
                fontSize: 26,
                cursor: "pointer",
                padding: "0 3px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {playlist.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#444",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎬</div>
            <p style={{ margin: "0 0 4px", color: "#555" }}>No files yet</p>
            <p style={{ margin: 0, fontSize: 12 }}>
              Tap "+ Add Files" to start
            </p>
          </div>
        ) : (
          playlist.map((item, i) => (
            <div
              key={item.id}
              onClick={() => {
                setCurrentIndex(i);
                if (isMobile) setShowPlaylist(false);
                setTimeout(() => {
                  if (mediaRef.current) {
                    mediaRef.current.currentTime = 0;
                    mediaRef.current.play().catch(() => {});
                  }
                }, 80);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                cursor: "pointer",
                background: i === currentIndex ? "#1c0000" : "transparent",
                borderLeft:
                  i === currentIndex
                    ? "3px solid #e50914"
                    : "3px solid transparent",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  background: "#1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i === currentIndex && playing ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 2,
                      alignItems: "flex-end",
                      height: 16,
                    }}
                  >
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: 3,
                          background: "#e50914",
                          borderRadius: 1,
                          height: `${8 + j * 3}px`,
                          animation: `eq ${0.4 + j * 0.1}s ease-in-out infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                ) : item.type.startsWith("video") ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#555">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#555">
                    <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    color: i === currentIndex ? "#fff" : "#aaa",
                    fontSize: 13,
                    margin: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: i === currentIndex ? 600 : 400,
                  }}
                >
                  {item.name}
                </p>
                <p style={{ color: "#555", fontSize: 11, margin: "2px 0 0" }}>
                  {item.type.split("/")[0]} · {formatSize(item.size)}
                </p>
              </div>
              <button
                onClick={(e) => removeFromPlaylist(item.id, e)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#333",
                  cursor: "pointer",
                  padding: "4px 6px",
                  fontSize: 20,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e50914")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {!isMobile && (
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #181818",
            fontSize: 10,
            color: "#2e2e2e",
            lineHeight: 1.9,
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#3a3a3a", fontWeight: 600 }}>Keys: </span>
          Space · ←/→ seek · ↑/↓ vol · M mute · F fullscreen
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes eq { from { transform: scaleY(0.4); } to { transform: scaleY(1.5); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #e50914; cursor: pointer; margin-top: -5px; }
        input[type=range]::-webkit-slider-runnable-track { height: 3px; background: #2a2a2a; border-radius: 2px; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      {/* ROOT wrapper */}
      <div
        ref={wrapperRef}
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          // ✅ Mobile: full viewport, fixed so navbar doesn't push it
          // ✅ Desktop: below navbar
          ...(isMobile
            ? {
                position: "fixed",
                top: 56,
                left: 0,
                right: 0,
                bottom: 56,
                zIndex: 50,
              }
            : {
                height: "calc(100vh - 60px)",
                marginTop: 50,
                position: "relative",
              }),
          background: "#0a0a0a",
          fontFamily: "'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ── PLAYER COLUMN ── */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            background: "#000",
            overflow: "hidden",
            minHeight: 0, // ✅ critical: lets flex child shrink
          }}
          onMouseMove={resetHideTimer}
        >
          {/* ── EMPTY STATE ── */}
          {!currentMedia && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#555",
                gap: 14,
                cursor: "pointer",
                padding: 32,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: isMobile ? 90 : 110,
                  height: isMobile ? 90 : 110,
                  borderRadius: "50%",
                  border: `2px dashed ${dragOver ? "#e50914" : "#2a2a2a"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "border-color 0.2s",
                }}
              >
                <svg
                  width={isMobile ? 32 : 44}
                  height={isMobile ? 32 : 44}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={dragOver ? "#e50914" : "#444"}
                  strokeWidth="1.5"
                >
                  <path
                    d="M12 16V4M12 4L8 8M12 4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p
                style={{
                  fontSize: isMobile ? 16 : 18,
                  color: dragOver ? "#e50914" : "#555",
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                {isMobile
                  ? "Tap to open a video or audio file"
                  : "Drop files here or click to browse"}
              </p>
              <p style={{ fontSize: 12, color: "#333", margin: 0 }}>
                MP4 · MKV · MOV · MP3 · WAV · FLAC
              </p>

              {isMobile && (
                <button
                  style={{
                    marginTop: 8,
                    background: "#e50914",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    padding: "13px 32px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    touchAction: "manipulation",
                  }}
                >
                  + Add Files
                </button>
              )}
            </div>
          )}

          {/* ── AUDIO VISUALIZER ── */}
          {currentMedia && isAudio && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg,#0a0a0a,#1a0000)",
                minHeight: 0,
                padding: 20,
              }}
            >
              <div
                style={{
                  width: isMobile ? 120 : 160,
                  height: isMobile ? 120 : 160,
                  borderRadius: "50%",
                  background: "#0f0f0f",
                  border: "3px solid #e50914",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {playing && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      animation: "spin 4s linear infinite",
                      background:
                        "conic-gradient(from 0deg,transparent 0%,#e5091420 50%,transparent 100%)",
                    }}
                  />
                )}
                <svg
                  width={isMobile ? 48 : 64}
                  height={isMobile ? 48 : 64}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#e50914"
                  strokeWidth="1.2"
                >
                  <path
                    d="M9 18V5l12-2v13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p
                style={{
                  color: "#fff",
                  fontSize: isMobile ? 16 : 20,
                  fontWeight: 600,
                  margin: "0 0 6px",
                  textAlign: "center",
                  maxWidth: 300,
                  padding: "0 16px",
                }}
              >
                {currentMedia.name}
              </p>
              <p style={{ color: "#555", fontSize: 12, margin: 0 }}>
                {formatSize(currentMedia.size)}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  marginTop: 20,
                  alignItems: "flex-end",
                  height: 36,
                }}
              >
                {Array.from({ length: isMobile ? 14 : 22 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      borderRadius: 2,
                      background: "#e50914",
                      minHeight: 6,
                      animation: playing
                        ? `eq ${0.4 + i * 0.04}s ease-in-out infinite alternate`
                        : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── VIDEO ── */}
          {currentMedia && isVideo && (
            <video
              ref={mediaRef}
              onClick={togglePlay}
              onTouchEnd={(e) => {
                e.preventDefault();
                resetHideTimer();
              }}
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: `brightness(${brightness}%)`,
                display: "block",
                minHeight: 0,
              }}
              playsInline
            />
          )}
          {currentMedia && isAudio && (
            <audio ref={mediaRef} style={{ display: "none" }} />
          )}

          {/* ── CONTROLS OVERLAY ── */}
          {currentMedia && (
            <div
              style={{
                position: isVideo ? "absolute" : "relative",
                bottom: 0,
                left: 0,
                right: 0,
                background: isVideo
                  ? "linear-gradient(transparent, rgba(0,0,0,0.96))"
                  : "#0d0d0d",
                padding: isMobile ? "24px 14px 14px" : "36px 16px 14px",
                opacity: isVideo ? (showControls ? 1 : 0) : 1,
                transition: "opacity 0.3s",
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={resetHideTimer}
            >
              <SeekBar />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  margin: "4px 0 8px",
                }}
              >
                <span style={{ color: "#aaa", fontSize: 11 }}>
                  {formatTime(currentTime)}
                </span>
                <span style={{ color: "#555", fontSize: 11 }}>
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 0 : 4,
                }}
              >
                {/* PREV */}
                <Btn
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  title="Previous"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 18V6h2v5.5l8.5-5v11l-8.5-5V18H6z" />
                  </svg>
                </Btn>

                {/* -10s desktop */}
                {!isMobile && (
                  <Btn onClick={() => seek(-10)} title="-10s">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                      </svg>
                      <span style={{ fontSize: 8 }}>10</span>
                    </div>
                  </Btn>
                )}

                {/* PLAY/PAUSE */}
                <button
                  onClick={togglePlay}
                  style={{
                    background: "#e50914",
                    border: "none",
                    borderRadius: "50%",
                    width: isMobile ? 44 : 46,
                    height: isMobile ? 44 : 46,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#fff",
                    flexShrink: 0,
                    margin: "0 4px",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {playing ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* +10s desktop */}
                {!isMobile && (
                  <Btn onClick={() => seek(10)} title="+10s">
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                      </svg>
                      <span style={{ fontSize: 8 }}>10</span>
                    </div>
                  </Btn>
                )}

                {/* NEXT */}
                <Btn
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(playlist.length - 1, i + 1))
                  }
                  title="Next"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18 6v12h-2v-5.5L7.5 18v-11L16 12.5V6h2z" />
                  </svg>
                </Btn>

                {/* VOLUME */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Btn
                    onClick={() =>
                      isMobile
                        ? setShowVolumeSlider((v) => !v)
                        : setMuted((m) => !m)
                    }
                    title="Volume"
                  >
                    {muted || volume === 0 ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </Btn>
                  {!isMobile && (
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        setMuted(false);
                      }}
                      style={{
                        width: 70,
                        accentColor: "#e50914",
                        cursor: "pointer",
                      }}
                    />
                  )}
                  {isMobile && showVolumeSlider && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "110%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "#1a1a1a",
                        borderRadius: 10,
                        padding: "12px 10px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        zIndex: 60,
                        boxShadow: "0 4px 24px rgba(0,0,0,0.8)",
                      }}
                    >
                      <span style={{ color: "#888", fontSize: 10 }}>
                        {Math.round((muted ? 0 : volume) * 100)}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={muted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          setMuted(false);
                        }}
                        style={{
                          writingMode: "vertical-lr",
                          direction: "rtl",
                          height: 90,
                          accentColor: "#e50914",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* TIME desktop */}
                {!isMobile && (
                  <span
                    style={{
                      color: "#ccc",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      marginLeft: 4,
                    }}
                  >
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                )}

                <div style={{ flex: 1 }} />

                {/* SHUFFLE */}
                <Btn
                  onClick={() => setShuffle((s) => !s)}
                  active={shuffle}
                  title="Shuffle"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                  </svg>
                </Btn>

                {/* LOOP */}
                <Btn
                  onClick={() => setLoop((l) => !l)}
                  active={loop}
                  title="Loop"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  </svg>
                </Btn>

                {/* SPEED */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeedMenu((s) => !s);
                    }}
                    style={{
                      background: "none",
                      border: "1px solid #2a2a2a",
                      borderRadius: 5,
                      color: speed !== 1 ? "#e50914" : "#888",
                      cursor: "pointer",
                      padding: "3px 7px",
                      fontSize: 11,
                      fontWeight: 700,
                      touchAction: "manipulation",
                    }}
                  >
                    {speed}x
                  </button>
                  {showSpeedMenu && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "110%",
                        right: 0,
                        background: "#161616",
                        border: "1px solid #2a2a2a",
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 6,
                        zIndex: 70,
                        minWidth: 110,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {speeds.map((s) => (
                        <div
                          key={s}
                          onClick={() => {
                            setSpeed(s);
                            setShowSpeedMenu(false);
                          }}
                          style={{
                            padding: isMobile ? "11px 16px" : "8px 18px",
                            cursor: "pointer",
                            fontSize: 13,
                            color: speed === s ? "#e50914" : "#bbb",
                            background: speed === s ? "#1e0000" : "transparent",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s}x {s === 1 ? "(normal)" : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BRIGHTNESS desktop */}
                {isVideo && !isMobile && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      marginLeft: 4,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#555">
                      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z" />
                    </svg>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      style={{
                        width: 58,
                        accentColor: "#e50914",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                )}

                {/* FULLSCREEN */}
                {isVideo && (
                  <Btn onClick={toggleFullscreen} title="Fullscreen">
                    {fullscreen ? (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                      </svg>
                    ) : (
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                      </svg>
                    )}
                  </Btn>
                )}

                {/* PLAYLIST toggle mobile */}
                {isMobile && (
                  <Btn
                    onClick={() => setShowPlaylist((p) => !p)}
                    active={showPlaylist}
                    title="Playlist"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                    </svg>
                  </Btn>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── DESKTOP PLAYLIST SIDEBAR ── */}
        {!isMobile && showPlaylist && <PlaylistPanel />}

        {/* ── DESKTOP TOGGLE BUTTON ── */}
        {!isMobile && (
          <button
            onClick={() => setShowPlaylist((p) => !p)}
            style={{
              position: "absolute",
              right: showPlaylist ? 298 : 8,
              bottom: 80,
              background: "#161616",
              border: "1px solid #2a2a2a",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#666",
              zIndex: 10,
              transition: "right 0.3s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path
                d={
                  showPlaylist
                    ? "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
                    : "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                }
              />
            </svg>
          </button>
        )}

        {/* ── MOBILE PLAYLIST BOTTOM SHEET ── */}
        {isMobile && showPlaylist && (
          <>
            <div
              onClick={() => setShowPlaylist(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.65)",
                zIndex: 90,
              }}
            />
            <PlaylistPanel />
          </>
        )}
      </div>

      {/* SINGLE FILE INPUT — no webkitdirectory, no duplicate */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  );
}