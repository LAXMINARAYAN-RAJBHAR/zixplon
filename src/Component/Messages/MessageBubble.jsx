// src/Component/Messages/MessageBubble.jsx
//
// One chat row, extracted from MessagesPanel and wrapped in React.memo so
// a keystroke / typing event / tick on ONE message no longer re-renders
// every bubble in the list.
//
// Memo only works if props are referentially stable. MessagesPanel passes:
//   - `m`          the message object (changes only when that message changes)
//   - `actions`    ONE stable object (see bubbleActions in the patch guide)
//   - `currentUser`, plus plain booleans for per-row UI state.
//
// Extra message fields used here (client-only, never saved to the DB):
//   _status: "sending" | "failed"   optimistic-send state
//   _key:    stable React key that survives temp-id -> real-id swaps

import React, { memo, useRef, useState } from "react";
import {
  renderMessageText,
  isEmojiOnlyMessage,
  getFileTypeInfo,
  formatFileSize,
  timeShort,
  parseCall,
  callLogLabel,
  isMissedCallLog,
  LocationCard,
  VoiceMessagePlayer,
} from "./messageUtils";
import { extractFirstUrl } from "../../utils/linkPreview";
import LinkPreviewCard from "./LinkPreviewCard";
import { canShare, vibrate } from "../../utils/deviceFeatures";

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;
const SWIPE_REPLY_PX = 70;

// Inline editor keeps its own text state, so typing in it never
// re-renders the rest of the list.
const EditBox = ({ initial, onSave, onCancel }) => {
  const [value, setValue] = useState(initial);
  return (
    <div className="mp-edit-box">
      <input
        className="mp-edit-input"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(value);
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="mp-edit-actions">
        <button onClick={() => onSave(value)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

const Ticks = ({ m, actions }) => {
  if (m._status === "sending") {
    return <span className="mp-ticks mp-ticks-sending" title="Sending">🕓</span>;
  }
  if (m._status === "failed") {
    return (
      <button
        type="button"
        className="mp-retry"
        onClick={(e) => {
          e.stopPropagation();
          actions.retry(m);
        }}
      >
        ⚠ Not sent · Retry
      </button>
    );
  }
  const status = m.seen_at ? "seen" : m.delivered_at ? "delivered" : "sent";
  return (
    <span className={`mp-ticks mp-ticks-${status}`}>
      {status === "sent" ? "✓" : "✓✓"}
    </span>
  );
};

const MessageBubble = ({
  m,
  currentUser,
  actions,
  selectMode,
  selectable,
  isSelected,
  highlighted,
  isEditing,
  menuOpen,
  reactionOpen,
}) => {
  const mine = m.sender_username === currentUser;

  // ── Long-press (open menu) + swipe-right (reply) on touch devices ──
  const touchRef = useRef({ x: 0, y: 0, timer: null, fired: false });

  const clearPress = () => {
    clearTimeout(touchRef.current.timer);
    touchRef.current.timer = null;
  };

  const hasContent = !!(m.text || m.attachment_url);
  const canInteract =
    !selectMode && !isEditing && !m.deleted_at && !m._status && hasContent;

  const onTouchStart = (e) => {
    if (!canInteract) return;
    const t = e.touches[0];
    touchRef.current = {
      x: t.clientX,
      y: t.clientY,
      fired: false,
      timer: setTimeout(() => {
        touchRef.current.fired = true;
        vibrate(15);
        actions.toggleMenu(m.id);
      }, LONG_PRESS_MS),
    };
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const { x, y } = touchRef.current;
    if (Math.abs(t.clientX - x) > MOVE_CANCEL_PX || Math.abs(t.clientY - y) > MOVE_CANCEL_PX) {
      clearPress();
    }
  };

  const onTouchEnd = (e) => {
    clearPress();
    if (!canInteract || touchRef.current.fired) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (dx > SWIPE_REPLY_PX && Math.abs(dy) < 30) {
      vibrate(10);
      actions.reply(m);
    }
  };

  // ── Call-history rows: a small centered line, no menu ──
  if (m.attachment_type === "call") {
    return (
      <div className="mp-call-log-row">
        <span className={`mp-call-log ${isMissedCallLog(m, mine) ? "missed" : ""}`}>
          {parseCall(m).video ? "📹" : "📞"} {callLogLabel(m, mine)} · {timeShort(m.created_at)}
        </span>
      </div>
    );
  }

  const fileInfo = m.attachment_type === "file" ? getFileTypeInfo(m.attachment_name) : null;
  const reactionEntries = Object.entries(m.reactions || {}).filter(([, users]) => users.length > 0);
  const emojiOnly = !!m.text && !m.attachment_url && isEmojiOnlyMessage(m.text);
  const firstUrl = m.text && !isEmojiOnlyMessage(m.text) ? extractFirstUrl(m.text) : null;

  const rowClass = [
    "mp-bubble-row",
    mine && "mine",
    selectMode && "mp-selecting",
    selectMode && !selectable && "mp-select-disabled",
    isSelected && "mp-selected",
    highlighted && "mp-msg-highlight",
  ]
    .filter(Boolean)
    .join(" ");

  const bubbleClass = [
    "mp-bubble",
    m.attachment_url && "mp-bubble-has-attachment",
    m.attachment_type === "voice" && "mp-bubble-has-voice",
    m.attachment_type === "sticker" && "mp-bubble-sticker-wrap",
    emojiOnly && "mp-bubble-emoji-only",
    m.deleted_at && "mp-bubble-deleted",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-msg-id={m.id}
      className={rowClass}
      onClick={selectMode ? () => actions.toggleSelect(m) : undefined}
    >
      {selectMode && (
        <span
          className={`mp-select-check ${isSelected ? "checked" : ""} ${selectable ? "" : "disabled"}`}
          aria-hidden="true"
        >
          {isSelected ? "✓" : ""}
        </span>
      )}

      <div className="mp-bubble-stack">
        {/* Hover buttons (desktop). Not shown for unsent messages. */}
        {canInteract && (
          <div className="mp-bubble-actions">
            <button
              type="button"
              className="mp-bubble-action-btn mp-react-trigger"
              onClick={() => actions.toggleReactionPicker(m.id)}
              aria-label="React"
            >
              🙂
            </button>

            <div className="mp-menu-wrap">
              <button
                type="button"
                className="mp-bubble-action-btn mp-menu-trigger"
                onClick={() => actions.toggleMenu(m.id)}
                aria-label="More options"
                title="More"
              >
                ⋮
              </button>

              {menuOpen && (
                <div className={`mp-menu ${mine ? "mine" : ""}`}>
                  <button type="button" className="mp-menu-item" onClick={() => actions.reply(m)}>
                    ↩ Reply
                  </button>
                  <button type="button" className="mp-menu-item" onClick={() => actions.forward(m)}>
                    ➡ Forward
                  </button>
                  {mine && m.text && !m.attachment_url && (
                    <button type="button" className="mp-menu-item" onClick={() => actions.startEdit(m)}>
                      ✎ Edit
                    </button>
                  )}
                  {canShare() && (
                    <button type="button" className="mp-menu-item" onClick={() => actions.share(m)}>
                      📤 Share
                    </button>
                  )}
                  {selectable && (
                    <button type="button" className="mp-menu-item" onClick={() => actions.enterSelect(m)}>
                      ☑ Select
                    </button>
                  )}
                  <button type="button" className="mp-menu-item" onClick={() => actions.hide(m)}>
                    🙈 Hide for me
                  </button>
                  {!mine && (
                    <button type="button" className="mp-menu-item" onClick={() => actions.report(m)}>
                      🚩 Report
                    </button>
                  )}
                  {mine && (
                    <button type="button" className="mp-menu-item danger" onClick={() => actions.remove(m)}>
                      🗑 Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {reactionOpen && !m.deleted_at && (
          <div className={`mp-reaction-picker ${mine ? "mine" : ""}`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="mp-reaction-picker-btn"
                onClick={() => actions.react(m, emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div
          className={bubbleClass}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={clearPress}
        >
          {m.deleted_at ? (
            <span className="mp-deleted-text">🚫 This message was deleted</span>
          ) : isEditing ? (
            <EditBox
              initial={m.text || ""}
              onSave={(value) => actions.saveEdit(m, value)}
              onCancel={actions.cancelEdit}
            />
          ) : (
            <>
              {m.forwarded && <div className="mp-forwarded-tag">↪ Forwarded</div>}

              {m.reply_to_id && (
                <div
                  className={`mp-reply-quote ${mine ? "mine" : ""}`}
                  role="button"
                  tabIndex={0}
                  title="Go to original message"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.jump(m.reply_to_id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      actions.jump(m.reply_to_id);
                    }
                  }}
                >
                  <span className="mp-reply-quote-sender">
                    {m.reply_to_sender === currentUser ? "You" : m.reply_to_sender}
                  </span>
                  <span className="mp-reply-quote-text">{m.reply_to_text}</span>
                </div>
              )}

              {m.attachment_url && m.attachment_type === "image" && (
                <img
                  src={m.attachment_url}
                  alt="attachment"
                  className="mp-bubble-image"
                  loading="lazy"
                  decoding="async"
                  onClick={() => actions.openImage(m.attachment_url)}
                  onDoubleClick={() => actions.react(m, "❤️")}
                />
              )}

              {m.attachment_url && m.attachment_type === "video" && (
                <video
                  src={m.attachment_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="mp-bubble-video"
                />
              )}

              {m.attachment_url && m.attachment_type === "gif" && (
                <img
                  src={m.attachment_url}
                  alt="GIF"
                  className="mp-bubble-gif"
                  loading="lazy"
                  onDoubleClick={() => actions.react(m, "❤️")}
                />
              )}

              {m.attachment_url && m.attachment_type === "sticker" && (
                <img
                  src={m.attachment_url}
                  alt="sticker"
                  className="mp-bubble-sticker"
                  loading="lazy"
                  onDoubleClick={() => actions.react(m, "❤️")}
                />
              )}

              {m.attachment_url && m.attachment_type === "voice" && (
                <VoiceMessagePlayer src={m.attachment_url} mine={mine} />
              )}

              {m.attachment_url && m.attachment_type === "location" && (
                <LocationCard message={m} mine={mine} />
              )}

              {m.attachment_url && m.attachment_type === "file" && (
                <a
                  href={m.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mp-bubble-file"
                  style={{ "--file-color": fileInfo.color }}
                >
                  <span className="mp-file-icon">{fileInfo.icon}</span>
                  <span className="mp-file-meta">
                    <span className="mp-file-name" title={m.attachment_name}>
                      {m.attachment_name || "Attachment"}
                    </span>
                    <span className="mp-file-sub">
                      {fileInfo.label}
                      {m.attachment_size ? ` · ${formatFileSize(m.attachment_size)}` : ""}
                    </span>
                  </span>
                  <span className="mp-file-download">⬇</span>
                </a>
              )}

              {m.text &&
                (emojiOnly || isEmojiOnlyMessage(m.text) ? (
                  <span className="mp-emoji-only-text">{m.text}</span>
                ) : (
                  <span>{renderMessageText(m.text, mine)}</span>
                ))}

              {firstUrl && <LinkPreviewCard url={firstUrl} mine={mine} classPrefix="mp" />}

              <span className="mp-bubble-footer">
                {m.edited_at && <span className="mp-edited-tag">edited</span>}
                <span className="mp-bubble-time">{timeShort(m.created_at)}</span>
                {mine && <Ticks m={m} actions={actions} />}
              </span>
            </>
          )}
        </div>

        {reactionEntries.length > 0 && !m.deleted_at && (
          <div className={`mp-reactions-row ${mine ? "mine" : ""}`}>
            {reactionEntries.map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                className={`mp-reaction-pill ${users.includes(currentUser) ? "mine-reacted" : ""}`}
                onClick={() => actions.react(m, emoji)}
                title={users.join(", ")}
              >
                {emoji} {users.length > 1 ? users.length : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MessageBubble);