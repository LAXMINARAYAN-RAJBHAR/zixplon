import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../config/supabase";

const RecordModal = ({ onClose, currentUser }) => {
  const [mode, setMode] = useState(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [preview, setPreview] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("All");
  const [cameraFacing, setCameraFacing] = useState("user");
  const [micOn, setMicOn] = useState(true);
  const [liveViewers] = useState(() => Math.floor(Math.random() * 80) + 5);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const CLOUDINARY_CLOUD_NAME = "dwoqk0yue";
  const CLOUDINARY_UPLOAD_PRESET = "youtube-clone";

  const categories = [
    "All","Music","Gaming","Sports","Tech","News","Comedy",
    "Cooking","Travel","AI","Web Development","Astronomy",
    "History","Live","Mixes","Indian Music","DD News",
  ];

  const startCamera = async (facing = cameraFacing, mic = micOn) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mic,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Camera/mic access denied. Please allow in browser settings.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (mode) startCamera();
    return () => stopCamera();
    // eslint-disable-next-line
  }, [mode]);

  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording, paused]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setPreview(URL.createObjectURL(blob));
    };
    mr.start(200);
    mediaRecorderRef.current = mr;
    setRecording(true);
    setPaused(false);
    setTimer(0);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    stopCamera();
    setRecording(false);
    setPaused(false);
  };

  const retake = () => {
    setPreview(null);
    setRecordedBlob(null);
    setTimer(0);
    setTitle("");
    setUploadDone(false);
    startCamera();
  };

  const downloadVideo = () => {
    if (!recordedBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(recordedBlob);
    a.download = `zixplon_${Date.now()}.webm`;
    a.click();
  };

  const uploadVideo = async () => {
    if (!recordedBlob || !title.trim()) {
      alert("Please enter a title before uploading.");
      return;
    }
    if (!currentUser) {
      alert("Please login to upload.");
      return;
    }
    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", recordedBlob, `rec_${Date.now()}.webm`);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("resource_type", "video");

      setUploadProgress(30);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: "POST", body: formData }
      );

      const data = await res.json();

      if (!data.secure_url) {
        throw new Error(data.error?.message || "Cloudinary upload failed");
      }

      setUploadProgress(70);

      const videoUrl = data.secure_url;
      const thumbnailUrl = data.secure_url
        .replace("/upload/", "/upload/so_0/")
        .replace(".webm", ".jpg");

      const { error } = await supabase.from("videos").insert({
  title: title.trim(),
  video_url: videoUrl,
  thumbnail_url: thumbnailUrl,
  channel: currentUser,
  category: category,
  duration: formatTime(timer),
  created_at: new Date().toISOString(),
});

      if (error) throw error;

      setUploadProgress(100);
      setUploadDone(true);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const flipCamera = () => {
    const newFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(newFacing);
    startCamera(newFacing, micOn);
  };

  const toggleMic = () => {
    const newMic = !micOn;
    setMicOn(newMic);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = newMic));
    }
  };

  // ── Mode selection screen ──
  if (!mode) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, maxWidth: "420px" }}>
          <div style={headerStyle}>
            <span style={{ color: "white", fontWeight: "700", fontSize: "18px" }}>
              🎥 Create Video
            </span>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>
          <div style={{ display: "flex", gap: "16px", padding: "24px" }}>
            <ModeCard
              icon="🔴"
              title="Record Video"
              desc="Record a video now, preview it, then upload"
              onClick={() => setMode("record")}
            />
            <ModeCard
              icon="📡"
              title="Go Live"
              desc="Start a live stream visible to all users"
              onClick={() => setMode("live")}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Preview screen ──
  if (preview) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, maxWidth: "640px" }}>
          <div style={headerStyle}>
            <span style={{ color: "white", fontWeight: "700", fontSize: "16px" }}>
              📽 Preview — {formatTime(timer)}
            </span>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <video
              src={preview}
              controls
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              style={{
                width: "100%",
                borderRadius: "10px",
                background: "#000",
                maxHeight: "320px",
              }}
            />
            {!uploadDone ? (
              <>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter video title *"
                  style={inputStyle}
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ ...inputStyle, marginTop: "10px" }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}>
                  <ActionBtn onClick={retake} bg="#272727" color="white">
                    🔄 Retake
                  </ActionBtn>
                  <ActionBtn onClick={downloadVideo} bg="#272727" color="white">
                    ⬇ Download
                  </ActionBtn>
                  <ActionBtn
                    onClick={uploadVideo}
                    bg="#ff0000"
                    color="white"
                    disabled={uploading}
                  >
                    {uploading
                      ? `Uploading ${uploadProgress}%...`
                      : "⬆ Upload to ZIXPLON"}
                  </ActionBtn>
                </div>
                {uploading && (
                  <div style={{
                    marginTop: "12px",
                    background: "#222",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "6px",
                      background: "#ff0000",
                      width: `${uploadProgress}%`,
                      transition: "width 0.4s",
                    }} />
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "40px" }}>✅</div>
                <p style={{
                  color: "white",
                  fontWeight: "600",
                  fontSize: "16px",
                  marginTop: "10px",
                }}>
                  Uploaded successfully!
                </p>
                <p style={{ color: "#aaa", fontSize: "13px" }}>
                  Your video is now live on ZIXPLON
                </p>
                <ActionBtn
                  onClick={onClose}
                  bg="#ff0000"
                  color="white"
                  style={{ marginTop: "16px" }}
                >
                  Done
                </ActionBtn>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Camera / Live screen ──
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: "680px" }}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {mode === "live" && (
              <span style={{
                background: "#ff0000",
                color: "white",
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "4px",
                animation: "pulse 1.2s infinite",
              }}>
                ● LIVE
              </span>
            )}
            <span style={{ color: "white", fontWeight: "700", fontSize: "16px" }}>
              {mode === "live"
                ? `📡 Live Stream · ${liveViewers} watching`
                : "🎥 Record Video"}
            </span>
            {recording && (
              <span style={{ color: "#ff4444", fontWeight: "700", fontSize: "14px" }}>
                {formatTime(timer)}
              </span>
            )}
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} style={closeBtnStyle}>
            ✕
          </button>
        </div>

        <div style={{ position: "relative", background: "#000" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              maxHeight: "380px",
              objectFit: "cover",
              display: "block",
            }}
          />
          {recording && (
            <div style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              background: paused ? "#ff9800" : "#ff0000",
              color: "white",
              fontSize: "11px",
              fontWeight: "700",
              padding: "3px 10px",
              borderRadius: "4px",
              animation: paused ? "none" : "pulse 1s infinite",
            }}>
              {paused ? "⏸ PAUSED" : "● REC"}
            </div>
          )}
          <div style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            gap: "8px",
          }}>
            <IconBtn onClick={flipCamera} title="Flip camera">🔄</IconBtn>
            <IconBtn onClick={toggleMic} title={micOn ? "Mute mic" : "Unmute mic"}>
              {micOn ? "🎤" : "🔇"}
            </IconBtn>
          </div>
        </div>

        <div style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}>
          {mode === "record" && (
            <>
              {!recording ? (
                <ActionBtn onClick={startRecording} bg="#ff0000" color="white">
                  ● Start Recording
                </ActionBtn>
              ) : (
                <>
                  {!paused ? (
                    <ActionBtn onClick={pauseRecording} bg="#ff9800" color="white">
                      ⏸ Pause
                    </ActionBtn>
                  ) : (
                    <ActionBtn onClick={resumeRecording} bg="#4caf50" color="white">
                      ▶ Resume
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={stopRecording} bg="#272727" color="white">
                    ⏹ Stop & Preview
                  </ActionBtn>
                </>
              )}
            </>
          )}

          {mode === "live" && (
            <>
              {!recording ? (
                <ActionBtn onClick={startRecording} bg="#ff0000" color="white">
                  📡 Go Live
                </ActionBtn>
              ) : (
                <ActionBtn onClick={stopRecording} bg="#272727" color="white">
                  ⏹ End Stream & Preview
                </ActionBtn>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
};

// ── Small reusable components ──
const ModeCard = ({ icon, title, desc, onClick }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1,
      background: "#1a1a1a",
      border: "1px solid #333",
      borderRadius: "12px",
      padding: "20px 16px",
      cursor: "pointer",
      textAlign: "center",
      transition: "all 0.2s",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.border = "1px solid #ff0000";
      e.currentTarget.style.background = "#1f0000";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.border = "1px solid #333";
      e.currentTarget.style.background = "#1a1a1a";
    }}
  >
    <div style={{ fontSize: "32px", marginBottom: "10px" }}>{icon}</div>
    <div style={{
      color: "white",
      fontWeight: "700",
      fontSize: "15px",
      marginBottom: "6px",
    }}>
      {title}
    </div>
    <div style={{ color: "#aaa", fontSize: "12px", lineHeight: "1.5" }}>{desc}</div>
  </div>
);

const ActionBtn = ({ onClick, bg, color, children, disabled, style }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? "#333" : bg,
      color: disabled ? "#666" : color,
      border: "none",
      borderRadius: "20px",
      padding: "9px 20px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: "700",
      fontSize: "14px",
      transition: "opacity 0.2s",
      ...style,
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
  >
    {children}
  </button>
);

const IconBtn = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: "rgba(0,0,0,0.6)",
      border: "1px solid #555",
      borderRadius: "8px",
      padding: "6px 10px",
      cursor: "pointer",
      fontSize: "16px",
    }}
  >
    {children}
  </button>
);

// ── Styles ──
const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.85)",
  zIndex: 999999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

const modalStyle = {
  background: "#0f0f0f",
  borderRadius: "16px",
  border: "1px solid #333",
  width: "100%",
  boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 20px",
  borderBottom: "1px solid #222",
  background: "#111",
};

const closeBtnStyle = {
  background: "#272727",
  border: "none",
  color: "#aaa",
  cursor: "pointer",
  fontSize: "16px",
  borderRadius: "50%",
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const inputStyle = {
  width: "100%",
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: "8px",
  color: "white",
  fontSize: "14px",
  padding: "10px 14px",
  outline: "none",
  boxSizing: "border-box",
  marginTop: "14px",
};

export default RecordModal;