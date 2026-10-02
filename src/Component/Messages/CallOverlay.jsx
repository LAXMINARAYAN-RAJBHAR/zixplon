// src/Component/Messages/CallOverlay.jsx
import React from "react";
import "./CallOverlay.css";

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

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function CallOverlay({
  call,
  muted,
  seconds,
  error,
  audioBlocked,
  onAccept,
  onHangUp,
  onToggleMute,
  onEnableAudio,
  onDismissError,
}) {
  const toast = error ? (
    <div className="zx-call-toast" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onDismissError}>
        Dismiss
      </button>
    </div>
  ) : null;

  if (!call) return toast;

  const name = call.peer || "Zixplon user";
  const status = {
    incoming: "Incoming voice call",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: fmt(seconds),
  }[call.status];
  const pulsing = call.status === "incoming" || call.status === "ringing";

  return (
    <>
      {toast}
      <div className="zx-call" role="dialog" aria-modal="true" aria-label={`Voice call with ${name}`}>
        <div className="zx-call__body">
          <div className={`zx-call__avatar${pulsing ? " is-pulsing" : ""}`}>
            <span>{name.slice(0, 2).toUpperCase()}</span>
          </div>
          <h2 className="zx-call__name">{name}</h2>
          <p className="zx-call__status" aria-live="polite">
            {status}
          </p>
          {audioBlocked && call.status === "connected" && (
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
            <button
              type="button"
              className="zx-call__btn is-accept"
              onClick={onAccept}
              aria-label="Accept call"
              autoFocus
            >
              <Icon d={PATH_CALL} />
              <span>Accept</span>
            </button>
          </div>
        ) : (
          <div className="zx-call__controls">
            <button
              type="button"
              className={`zx-call__btn is-mute${muted ? " is-on" : ""}`}
              onClick={onToggleMute}
              disabled={call.status !== "connected"}
              aria-pressed={muted}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              <Icon d={muted ? PATH_MIC_OFF : PATH_MIC} />
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>
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