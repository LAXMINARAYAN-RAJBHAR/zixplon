// src/Component/Messages/CallOverlay.jsx
// Voice + video call screen. Voice calls look exactly as before; video
// calls show the other person full-screen with your own camera as a small
// picture-in-picture, plus camera on/off and flip-camera buttons.
import React, { useEffect, useRef, useState } from "react";
import "./CallOverlay.css";
import "./CallOverlayVideo.css";
import { isTouchDevice } from "../../utils/deviceFeatures";

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);

const PATH_CALL =
  "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";
const PATH_END =
  "M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z";
const PATH_MIC =
  "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z";
const PATH_MIC_OFF =
  "M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z";
const PATH_VIDEO =
  "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z";
const PATH_VIDEO_OFF =
  "M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z";
const PATH_FLIP =
  "M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z";

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function CallOverlay({
  call,
  muted,
  seconds,
  error,
  audioBlocked,
  stageText,
  // video
  cameraOn,
  facing,
  localVideo,
  remoteVideo,
  remoteCamOff,
  remoteHasVideoPub, // true once the other person has published a video track
  onAccept,
  onHangUp,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onEnableAudio,
  onDismissError,
}) {
  const remoteRef = useRef(null);
  const localRef = useRef(null);

  // While an outgoing VIDEO call is ringing, show my own camera full screen
  // (like WhatsApp). It's released as soon as the call starts connecting, so
  // the call library can take over the camera.
  const previewRef = useRef(null);
  const [previewOn, setPreviewOn] = useState(false);
  const wantPreview =
    !!call && call.role === "caller" && call.status === "ringing" && !!call.video;

  useEffect(() => {
    if (!wantPreview) return undefined;
    let stream = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const el = previewRef.current;
        if (el) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
        setPreviewOn(true);
      } catch (_) {
        /* no preview (permission/busy) - the call itself still works */
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (previewRef.current) previewRef.current.srcObject = null;
      setPreviewOn(false);
    };
  }, [wantPreview]);

  const showRemote = !!call && !!remoteVideo && !remoteCamOff;
  const showLocal = !!call && !!localVideo && !!cameraOn;

  // Attach LiveKit video tracks to the <video> elements.
  useEffect(() => {
    const el = remoteRef.current;
    if (!el || !remoteVideo || !showRemote) return undefined;
    remoteVideo.attach(el);
    return () => {
      remoteVideo.detach(el);
    };
  }, [remoteVideo, showRemote]);

  useEffect(() => {
    const el = localRef.current;
    if (!el || !localVideo || !showLocal) return undefined;
    localVideo.attach(el);
    return () => {
      localVideo.detach(el);
    };
  }, [localVideo, showLocal]);

  const toast = error ? (
    <div className="zx-call-toast" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onDismissError}>
        Dismiss
      </button>
    </div>
  ) : null;

  if (!call) return toast;

  const isVideo = !!call.video || !!cameraOn || !!remoteVideo;
  const kind = isVideo ? "video" : "voice";
  const name = call.peer || "Zixplon user";
  const status = {
    incoming: `Incoming ${kind} call`,
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected:
      remoteVideo && remoteCamOff
        ? `${fmt(seconds)} · their camera is off`
        : // Only "waiting" while their video is really on its way. If they
          // answered with voice only, they never publish video, so just show the timer.
          call.video && remoteHasVideoPub && !remoteVideo
          ? `${fmt(seconds)} · waiting for their video…`
          : fmt(seconds),
  }[call.status];
  const pulsing = call.status === "incoming" || call.status === "ringing";
  const connected = call.status === "connected";

  return (
    <>
      {toast}
      <div
        className={`zx-call${isVideo ? " zx-call--video" : ""}${showRemote ? " has-remote" : ""}${wantPreview && previewOn ? " has-preview" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${isVideo ? "Video" : "Voice"} call with ${name}`}
      >
        {wantPreview && (
          <video
            ref={previewRef}
            className="zx-call__preview"
            autoPlay
            muted
            playsInline
          />
        )}
        {showRemote && <video ref={remoteRef} className="zx-call__remote" autoPlay playsInline />}
        {showLocal && (
          <video
            ref={localRef}
            className={`zx-call__local${facing === "user" ? " is-mirror" : ""}`}
            autoPlay
            muted
            playsInline
          />
        )}

        <div className="zx-call__body">
          <div className={`zx-call__avatar${pulsing ? " is-pulsing" : ""}`}>
            <span>{name.slice(0, 2).toUpperCase()}</span>
          </div>
          <h2 className="zx-call__name">{name}</h2>
          <p className="zx-call__status" aria-live="polite">
            {status}
          </p>
          {call.status === "connecting" && stageText && (
            <p className="zx-call__stage">{stageText}</p>
          )}
          {audioBlocked && connected && (
            <button type="button" className="zx-call__audio" onClick={onEnableAudio}>
              Tap to turn on call audio
            </button>
          )}
        </div>

        {call.status === "incoming" ? (
          <div className="zx-call__controls">
            <button type="button" className="zx-call__btn is-decline" onClick={onHangUp} aria-label="Decline call">
              <Icon d={PATH_END} />
              <span>Decline</span>
            </button>
            {call.video && (
              <button
                type="button"
                className="zx-call__btn is-mute"
                onClick={() => onAccept({ video: false })}
                aria-label="Answer with voice only"
              >
                <Icon d={PATH_CALL} />
                <span>Voice only</span>
              </button>
            )}
            <button
              type="button"
              className="zx-call__btn is-accept"
              onClick={() => onAccept()}
              aria-label={call.video ? "Accept video call" : "Accept call"}
              autoFocus
            >
              <Icon d={call.video ? PATH_VIDEO : PATH_CALL} />
              <span>Accept</span>
            </button>
          </div>
        ) : (
          <div className="zx-call__controls">
            <button
              type="button"
              className={`zx-call__btn is-mute${muted ? " is-on" : ""}`}
              onClick={onToggleMute}
              disabled={!connected}
              aria-pressed={muted}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              <Icon d={muted ? PATH_MIC_OFF : PATH_MIC} />
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>

            {/* Camera on/off. On a voice call this upgrades it to video. */}
            <button
              type="button"
              className={`zx-call__btn is-mute${connected && !cameraOn ? " is-on" : ""}`}
              onClick={onToggleCamera}
              disabled={!connected}
              aria-pressed={connected && !cameraOn}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            >
              <Icon d={cameraOn || !connected ? PATH_VIDEO : PATH_VIDEO_OFF} />
              <span>{!connected || cameraOn ? "Camera" : "Camera off"}</span>
            </button>

            {cameraOn && isTouchDevice() && (
              <button
                type="button"
                className="zx-call__btn is-mute"
                onClick={onSwitchCamera}
                aria-label="Switch camera"
              >
                <Icon d={PATH_FLIP} />
                <span>Flip</span>
              </button>
            )}

            <button
              type="button"
              className="zx-call__btn is-decline"
              onClick={onHangUp}
              aria-label={call.status === "ringing" ? "Cancel call" : "End call"}
            >
              <Icon d={PATH_END} />
              <span>{call.status === "ringing" ? "Cancel" : "End"}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}