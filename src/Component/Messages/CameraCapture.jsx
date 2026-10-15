// src/Component/Messages/CameraCapture.jsx
// In-app camera: live preview, photo + video capture, front/back switch.
// Uses getUserMedia (real camera access + permission prompt) instead of the
// unreliable <input capture> hint. Needs HTTPS (or localhost).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./CameraCapture.css";

const MAX_VIDEO_SECONDS = 60;

const pickVideoMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
};

const friendlyError = (err) => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "The camera needs a secure (https) connection.";
  }
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera access for this site in your browser settings (tap the lock icon in the address bar), then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is being used by another app. Close it and try again.";
    default:
      return "Couldn't open the camera. Please try again.";
  }
};

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const CameraCapture = ({ onCapture, onClose, onFallback }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  const [mode, setMode] = useState("photo"); // "photo" | "video"
  const [facing, setFacing] = useState("environment"); // "environment" | "user"
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState(null); // { file, url, kind }

  const canRecord = typeof MediaRecorder !== "undefined";

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // (Re)start the camera whenever facing/mode changes; pause while previewing.
  useEffect(() => {
    stopStream();
    if (preview) return undefined;

    let cancelled = false;
    setReady(false);
    setError("");

    (async () => {
      try {
        // Ask for the exact lens first (so "back" really opens the back
        // camera); if the phone can't satisfy that, fall back to "ideal".
        const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
        const audio = mode === "video"; // mic is only requested for video
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...size, facingMode: { exact: facing } },
            audio,
          });
        } catch (firstErr) {
          if (firstErr?.name === "NotAllowedError" || firstErr?.name === "SecurityError") {
            throw firstErr;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { ...size, facingMode: { ideal: facing } },
            audio,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [facing, mode, preview]);

  // Release everything on unmount.
  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.onstop = null;
          rec.stop();
        } catch {
          /* no-op */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // Free the preview blob URL when it's replaced / discarded.
  useEffect(
    () => () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPreview({ file, url: URL.createObjectURL(file), kind: "image" });
      },
      "image/jpeg",
      0.9,
    );
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !canRecord) return;
    const mime = pickVideoMime();

    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      setError("Video recording isn't supported on this device.");
      return;
    }

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = (rec.mimeType || mime || "video/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video-${Date.now()}.${ext}`, { type });
      setPreview({ file, url: URL.createObjectURL(blob), kind: "video" });
    };

    rec.start();
    recorderRef.current = rec;
    secondsRef.current = 0;
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= MAX_VIDEO_SECONDS) stopRecording();
    }, 1000);
  };

  const handleShutter = () => {
    if (mode === "photo") takePhoto();
    else if (recording) stopRecording();
    else startRecording();
  };

  const handleUse = () => {
    if (!preview) return;
    onCapture(preview.file);
    onClose();
  };

  const handleClose = () => {
    if (recording) {
      const rec = recorderRef.current;
      if (rec) rec.onstop = null; // discard instead of previewing
      stopRecording();
    }
    onClose();
  };

  return createPortal(
    <div
      className="cam-overlay"
      role="dialog"
      aria-label="Camera"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cam-top">
        <button type="button" className="cam-btn" onClick={handleClose} aria-label="Close camera">
          ✕
        </button>
        {recording && <span className="cam-rec">● {fmt(seconds)}</span>}
        {!preview && !error && (
          <button
            type="button"
            className="cam-btn"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            disabled={recording}
            aria-label="Switch camera"
            title="Switch camera"
          >
            🔄
          </button>
        )}
      </div>

      <div className="cam-stage">
        {error ? (
          <div className="cam-error">
            <p>{error}</p>
            {onFallback && (
              <button
                type="button"
                className="cam-pill"
                onClick={() => {
                  onClose();
                  onFallback();
                }}
              >
                Use phone camera app instead
              </button>
            )}
          </div>
        ) : preview ? (
          preview.kind === "image" ? (
            <img src={preview.url} alt="Captured" className="cam-media" />
          ) : (
            <video src={preview.url} controls playsInline className="cam-media" />
          )
        ) : (
          <video
            ref={videoRef}
            className={`cam-media ${facing === "user" ? "mirror" : ""}`}
            autoPlay
            muted
            playsInline
          />
        )}
        {!preview && !error && !ready && <div className="cam-loading">Opening camera…</div>}
      </div>

      <div className="cam-bottom">
        {preview ? (
          <div className="cam-actions">
            <button type="button" className="cam-pill" onClick={() => setPreview(null)}>
              Retake
            </button>
            <button type="button" className="cam-pill primary" onClick={handleUse}>
              Use {preview.kind === "image" ? "photo" : "video"}
            </button>
          </div>
        ) : (
          !error && (
            <>
              {canRecord && (
                <div className="cam-modes">
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
              )}
              <button
                type="button"
                className={`cam-shutter ${mode === "video" ? "video" : ""} ${recording ? "recording" : ""}`}
                onClick={handleShutter}
                disabled={!ready}
                aria-label={
                  mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Start recording"
                }
              />
            </>
          )
        )}
      </div>
    </div>,
    document.body,
  );
};

export default CameraCapture;