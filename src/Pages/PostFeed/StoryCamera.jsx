import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────────────────
// StoryCamera — full-screen webcam for stories on laptops / desktops.
//
// Phones keep using the native camera app (file input with `capture`).
// This opens the webcam with getUserMedia (needs HTTPS or localhost).
// Photo mode takes a still; Video mode records with MediaRecorder up to
// MAX_VIDEO_SECONDS. The result goes to onCapture(file, { type, duration }).
// ─────────────────────────────────────────────────────────────────────────

const MAX_VIDEO_SECONDS = 60;

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m)) || ""
  );
};

const errorMessage = (err) => {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access is blocked. Click the camera icon in the address bar, allow the camera, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is being used by another app. Close it and try again.";
    default:
      return "Couldn't open the camera. Please try again.";
  }
};

const StoryCamera = ({ startMode = "photo", onCapture, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secsRef = useRef(0);
  const discardRef = useRef(false);

  const [mode, setMode] = useState(startMode);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Open (or re-open) the camera when the mode changes. The microphone is
  // only requested for video mode.
  useEffect(() => {
    if (recording) return;
    let dead = false;
    setReady(false);
    setError("");

    const open = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera. Use the Gallery option instead.");
        return;
      }
      stopStream();
      const video = { width: { ideal: 1280 }, height: { ideal: 720 } };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: mode === "video" });
      } catch (first) {
        try {
          // Microphone refused or missing — still allow a silent video.
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (second) {
          if (!dead) setError(errorMessage(first?.name === "NotAllowedError" ? first : second));
          return;
        }
      }
      if (dead) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const el = videoRef.current;
      if (el) {
        el.srcObject = stream;
        el.play().catch(() => { });
      }
      setReady(true);
    };
    open();

    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Stop everything on unmount.
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      discardRef.current = true;
      if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
      stopStream();
    },
    []
  );

  // Esc closes the camera (not the whole popup).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !recording) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [recording, onClose]);

  const takePhoto = () => {
    const el = videoRef.current;
    if (!el || !ready || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d").drawImage(el, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't take the photo. Please try again.");
          return;
        }
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file, { type: "image", duration: null });
      },
      "image/jpeg",
      0.92
    );
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state === "recording") recRef.current.stop();
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !ready) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Video recording isn't supported in this browser.");
      return;
    }
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      setError("Video recording isn't supported in this browser.");
      return;
    }

    chunksRef.current = [];
    discardRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      clearInterval(timerRef.current);
      setRecording(false);
      if (discardRef.current) return;
      const fullType = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type: fullType });
      if (!blob.size) {
        setError("Nothing was recorded. Please try again.");
        return;
      }
      const baseType = fullType.split(";")[0];
      const ext = baseType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `camera-${Date.now()}.${ext}`, { type: baseType });
      onCapture(file, { type: "video", duration: Math.max(1, secsRef.current) });
    };

    rec.start(250); // small timeslice so chunks arrive while recording
    recRef.current = rec;
    secsRef.current = 0;
    setSecs(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      secsRef.current += 1;
      setSecs(secsRef.current);
      if (secsRef.current >= MAX_VIDEO_SECONDS) stopRecording();
    }, 1000);
  };

  const onShutter = () => {
    if (mode === "photo") takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  };

  return createPortal(
    <div className="story-cam" role="dialog" aria-modal="true" aria-label="Camera">
      <video ref={videoRef} className="story-cam-video mirrored" playsInline muted autoPlay />

      <div className="story-cam-top">
        <button type="button" className="story-cam-btn" onClick={onClose} disabled={recording} aria-label="Close camera">
          ✕
        </button>
        {recording && (
          <span className="story-cam-timer">
            ● {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </span>
        )}
        <span className="story-cam-spacer" />
      </div>

      {error && <p className="story-cam-error">{error}</p>}

      <div className="story-cam-bottom">
        <div className="story-cam-modes">
          <button
            type="button"
            className={mode === "photo" ? "active" : ""}
            onClick={() => setMode("photo")}
            disabled={recording}
          >
            Photo
          </button>
          <button
            type="button"
            className={mode === "video" ? "active" : ""}
            onClick={() => setMode("video")}
            disabled={recording}
          >
            Video
          </button>
        </div>
        <button
          type="button"
          className={`story-cam-shutter${mode === "video" ? " video" : ""}${recording ? " recording" : ""}`}
          // Inline size so no other stylesheet can stretch the button.
          style={{ flex: "none", width: 74, height: 74, minHeight: 74, maxHeight: 74, aspectRatio: "1 / 1" }}
          onClick={onShutter}
          disabled={!ready && !recording}
          aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Start recording"}
        />
      </div>
    </div>,
    document.body
  );
};

export default StoryCamera;