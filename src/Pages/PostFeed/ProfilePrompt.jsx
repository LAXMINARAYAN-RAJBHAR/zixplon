import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { getInitials } from "../../utils/initials";

// ─────────────────────────────────────────────────────────────────────────
// ProfilePrompt — the small popup that asks "Interested in <profile>?" the
// first time a post from a new profile is on screen. It floats at the
// bottom of the screen and does NOT block the feed (no dark backdrop), so
// scrolling past it is fine; ✕ ("Not now") snoozes it for 7 days.
//
// ProfileFeedbackToast — the confirmation after answering. For
// "Not interested" it carries an Undo button.
//
// Both render through a portal into <body>. Styles: PostFeed.profile-prompt.css
// ─────────────────────────────────────────────────────────────────────────

const TOAST_MS = 6000;

const ProfilePrompt = ({ username, onInterested, onNotInterested, onDismiss }) => {
  // Esc = "Not now"
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return createPortal(
    <div
      className="pf-profile-prompt"
      role="dialog"
      aria-label={`Interested in ${username}?`}
    >
      <button
        type="button"
        className="pf-profile-prompt-x"
        onClick={onDismiss}
        aria-label="Not now"
        title="Not now"
      >
        ✕
      </button>

      <div className="pf-profile-prompt-top">
        <Link
          to={`/user/${username}`}
          className="pf-avatar pf-avatar-green pf-avatar-link"
          title={`View ${username}'s profile`}
        >
          {getInitials(username)}
        </Link>
        <div className="pf-profile-prompt-text">
          <b>Interested in {username}?</b>
          <small>
            This profile is new in your feed. We'll show you more or fewer of
            their posts based on your answer.
          </small>
        </div>
      </div>

      <div className="pf-profile-prompt-actions">
        <button
          type="button"
          className="pf-profile-prompt-btn no"
          onClick={onNotInterested}
        >
          🚫 Not interested
        </button>
        <button
          type="button"
          className="pf-profile-prompt-btn yes"
          onClick={onInterested}
        >
          👍 Interested
        </button>
      </div>
    </div>,
    document.body
  );
};

export const ProfileFeedbackToast = ({ toast, onUndo, onClose }) => {
  // Restarts the timer whenever a new answer comes in (toast.key changes).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const hiding = toast.value === "not_interested";

  return createPortal(
    <div className="pf-profile-toast" role="status">
      <span>
        {hiding
          ? `🚫 Hiding posts from ${toast.username}`
          : `👍 Noted — you're interested in ${toast.username}`}
      </span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </div>,
    document.body
  );
};

export default ProfilePrompt;