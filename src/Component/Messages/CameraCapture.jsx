// src/Component/Messages/CameraCapture.jsx
// In-app camera: live preview, photo + video capture, front/back switch.
// Uses getUserMedia (real camera access + permission prompt) instead of the
// unreliable <input capture> hint. Needs HTTPS (or localhost).
//
// CHANGES in this version:
//  - If the microphone is denied/missing in Video mode, we still record
//    video (without sound) instead of failing the whole camera.
//  - MediaRecorder errors are caught + shown instead of failing silently.
//  - MediaRecorder is retried without options if the chosen mime/bitrate is
//    rejected by the browser.
//  - onFallback now receives the current mode ("photo" | "video") so the
//    parent can open an image OR video capture input.
//  - Better error messages (camera vs microphone).
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./CameraCapture.css";

const MAX_VIDEO_SECONDS = 60;

const pickVideoMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
};

const friendlyError = (err) => {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return "The camera needs a secure (https) connection.";
  }
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied. Allow camera and microphone access for this site in your browser settings (tap the lock icon in the address bar), then try again.";
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
  const [preview, setPreview] = useState(null); // { file, url, kind, seconds, size }
  const [notice, setNotice] = useState(""); // small non-blocking message

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
    setNotice("");

    (async () => {
      try {
        const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
        const wantAudio = mode === "video"; // mic is only requested for video

        // Opens the camera. If the microphone is the problem (denied or no
        // mic), retry with video only so recording still works (silent).
        const open = async (facingMode) => {
          const video = { ...size, facingMode };
          try {
            return await navigator.mediaDevices.getUserMedia({
              video,
              audio: wantAudio,
            });
          } catch (e) {
            if (
              wantAudio &&
              (e?.name === "NotAllowedError" || e?.name === "NotFoundError")
            ) {
              console.warn("Microphone unavailable, recording video only:", e);
              const s = await navigator.mediaDevices.getUserMedia({
                video,
                audio: false,
              });
              if (!cancelled) {
                setNotice("Microphone unavailable. Video will record without sound.");
              }
              return s;
            }
            throw e;
          }
        };

        // Ask for the exact lens first (so "back" really opens the back
        // camera); if the phone can't satisfy that, fall back to "ideal".
        let stream;
        try {
          stream = await open({ exact: facing });
        } catch (firstErr) {
          if (
            firstErr?.name === "NotAllowedError" ||
            firstErr?.name === "SecurityError"
          ) {
            throw firstErr;
          }
          stream = await open({ ideal: facing });
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
        console.error("Camera error:", err);
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
    if (rec && rec.state !== "inactive") {
      try {
        rec.requestData(); // flush whatever is buffered before stopping
      } catch {
        /* not supported everywhere — stop() still delivers data */
      }
      try {
        rec.stop();
      } catch (e) {
        console.error("MediaRecorder stop failed:", e);
      }
    }
    setRecording(false);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !canRecord) return;
    const mime = pickVideoMime();

    // Try with our preferred mime + bitrate; if the browser rejects that
    // combination, retry with plain defaults before giving up.
    let rec;
    try {
      rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 2500000, // keeps clips small enough to upload quickly
      });
    } catch (e1) {
      console.warn("MediaRecorder with options failed, retrying plain:", e1);
      try {
        rec = new MediaRecorder(stream);
      } catch (e2) {
        console.error("MediaRecorder unsupported:", e2);
        setNotice("Video recording isn't supported on this device.");
        return;
      }
    }

    setNotice("");
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onerror = (e) => {
      console.error("MediaRecorder error:", e.error || e);
      clearInterval(timerRef.current);
      setRecording(false);
      setNotice(`Recording failed (${e.error?.name || "unknown error"}). Please try again.`);
    };

    rec.onstop = () => {
      const type = (rec.mimeType || mime || "video/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type });
      // A real clip is far bigger than a few KB; anything tiny means the
      // phone didn't actually deliver video frames.
      if (blob.size < 2048) {
        setNotice(
          "Nothing was recorded. Please try again (hold still for a second or two before stopping).",
        );
        return;
      }
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `video-${Date.now()}.${ext}`, { type });
      setPreview({
        file,
        url: URL.createObjectURL(blob),
        kind: "video",
        seconds: secondsRef.current,
        size: blob.size,
      });
    };

    try {
      rec.start(1000); // deliver data every second instead of only at the end
    } catch (e) {
      console.error("MediaRecorder start failed:", e);
      setNotice("Couldn't start recording. Please try again.");
      return;
    }

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
                  onFallback(mode); // parent opens an image or video capture input
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
            <>
              <video
                key={preview.url}
                src={preview.url}
                className="cam-media"
                controls
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="cam-info">
                🎬 {fmt(preview.seconds || 0)} · {(preview.size / 1048576).toFixed(1)} MB
              </div>
            </>
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
        {notice && !preview && <div className="cam-notice">{notice}</div>}
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