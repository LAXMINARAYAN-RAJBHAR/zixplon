import React, { useState, useRef, useEffect } from "react";
import { sendBroadcastMessage } from "../../utils/broadcast";
import EmojiGifStickerPicker from "./EmojiGifStickerPicker";
import "./BroadcastComposeWindow.css";
import { uploadAttachmentToR2 } from "../../utils/mediaUpload";

// Hard cap on how many files can be queued in one send — mirrors
// MessagesPanel's / GroupChatWindow's MAX_ATTACHMENTS.
const MAX_ATTACHMENTS = 10;

let attachmentIdCounter = 0;
const makeAttachmentId = () => `att-${Date.now()}-${++attachmentIdCounter}`;

// ── Small upload-progress bar shown over a queued attachment while it
// uploads (shared shape with MessagesPanel/GroupChatWindow). ──
const UploadProgressBar = ({ progress, status }) => (
  <div className={`bcw-pending-progress-wrap ${status === "error" ? "error" : ""}`}>
    <div
      className={`bcw-pending-progress-bar ${status === "error" ? "error" : ""}`}
      style={{ width: `${status === "error" ? 100 : Math.max(4, progress)}%` }}
    />
    <span className="bcw-pending-progress-label">
      {status === "error" ? "Failed" : `${Math.round(progress)}%`}
    </span>
  </div>
);

const BroadcastComposeWindow = ({ list, currentUser, onBack, onClose }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // Queue of not-yet-sent attachments (images/videos/files picked
  // together). Each item tracks its own upload `progress` (0-100) and
  // `status` ("pending" | "uploading" | "error") — mirrors
  // MessagesPanel's pendingAttachments.
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [results, setResults] = useState([]); // [{ label, sentCount, failed }] — one per attachment/text sent, most recent last
  const fileInputRef = useRef();
  const inputRef = useRef();

  // ── Emoji / GIF / Sticker picker ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef();
  const emojiBtnRef = useRef();

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const recipients = (list.broadcast_recipients || []).map((r) => r.username);

  // ── Multi-file attachment picking (mirrors MessagesPanel) ──
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const room = MAX_ATTACHMENTS - pendingAttachments.length;
    if (room <= 0) {
      alert(`You can attach up to ${MAX_ATTACHMENTS} files at once.`);
      return;
    }
    if (files.length > room) {
      alert(`Only ${room} more file${room === 1 ? "" : "s"} can be added (max ${MAX_ATTACHMENTS} per send).`);
    }

    const accepted = files.slice(0, room);
    const newAttachments = [];
    for (const file of accepted) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`"${file.name}" is too large. Max size is 25MB.`);
        continue;
      }
      const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
      const previewUrl = type !== "file" ? URL.createObjectURL(file) : null;
      newAttachments.push({
        id: makeAttachmentId(),
        file,
        previewUrl,
        type,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "pending",
      });
    }
    if (newAttachments.length) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const removePendingAttachment = (id) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const clearAllPendingAttachments = () => {
    setPendingAttachments((prev) => {
      prev.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  };

  const updateAttachmentProgress = (id, progress, status = "uploading") => {
    setPendingAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, progress, status } : a)),
    );
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const attachmentLabel = (type, name) => {
    if (type === "image") return "📷 Photo";
    if (type === "video") return "🎥 Video";
    if (type === "file") return `📎 ${name || "Attachment"}`;
    return "Message";
  };

  const handleSend = async () => {
    if ((!text.trim() && pendingAttachments.length === 0) || sending) return;
    setSending(true);
    setResults([]);
    const trimmed = text.trim();

    if (pendingAttachments.length === 0) {
      // Text-only broadcast — original fast path.
      try {
        const res = await sendBroadcastMessage({
          broadcastId: list.id,
          senderUsername: currentUser,
          recipientUsernames: recipients,
          text: trimmed,
          attachmentUrl: null,
          attachmentType: null,
          attachmentName: null,
          attachmentSize: null,
        });
        setResults([{ label: "Message", sentCount: res.sentCount, failed: res.failed }]);
        setText("");
      } catch (err) {
        alert(`Failed to send broadcast: ${err?.message || "please try again."}`);
      } finally {
        setSending(false);
      }
      return;
    }

    // One or more attachments queued: upload + broadcast them ONE AT A
    // TIME, each with its own progress bar, so the sender can see each
    // file go out individually rather than the whole batch appearing to
    // hang. The typed caption (if any) rides along with the FIRST
    // attachment only, same convention as MessagesPanel/GroupChatWindow.
    const batch = pendingAttachments;
    const batchResults = [];

    for (let i = 0; i < batch.length; i++) {
      const att = batch[i];
      updateAttachmentProgress(att.id, 0, "uploading");

      let uploaded;
      try {
        uploaded = await uploadAttachmentToR2(att.file, (pct) =>
          updateAttachmentProgress(att.id, pct, "uploading"),
        );
      } catch (err) {
        updateAttachmentProgress(att.id, 0, "error");
        alert(`"${att.name}" failed to upload: ${err?.message || "please try again."}`);
        continue;
      }

      const captionText = i === 0 ? trimmed : "";

      try {
        const res = await sendBroadcastMessage({
          broadcastId: list.id,
          senderUsername: currentUser,
          recipientUsernames: recipients,
          text: captionText,
          attachmentUrl: uploaded.url,
          attachmentType: att.type,
          attachmentName: att.name,
          attachmentSize: att.size,
        });
        batchResults.push({
          label: captionText || attachmentLabel(att.type, att.name),
          sentCount: res.sentCount,
          failed: res.failed,
        });
      } catch (err) {
        updateAttachmentProgress(att.id, 100, "error");
        alert(`"${att.name}" failed to send: ${err?.message || "please try again."}`);
        continue;
      }

      // Sent successfully — drop it from the tray.
      setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id));
      if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
    }

    if (batchResults.length) {
      setResults(batchResults);
      setText("");
    }
    setSending(false);
  };

  // Sends a GIF or sticker to every recipient immediately — no upload
  // needed since Giphy already hosts the media, mirrors handleSend but
  // skips the attachment-upload branch.
  const sendMedia = async (url, type) => {
    if (!url || sending) return;
    setSending(true);
    setResults([]);
    try {
      const res = await sendBroadcastMessage({
        broadcastId: list.id,
        senderUsername: currentUser,
        recipientUsernames: recipients,
        text: "",
        attachmentUrl: url,
        attachmentType: type, // "gif" | "sticker"
        attachmentName: null,
        attachmentSize: null,
      });
      setResults([{ label: type === "gif" ? "🎬 GIF" : "🏷️ Sticker", sentCount: res.sentCount, failed: res.failed }]);
    } catch (err) {
      alert(`Failed to send broadcast: ${err?.message || "please try again."}`);
    } finally {
      setSending(false);
    }
  };

  const isUploadingAny = pendingAttachments.some((a) => a.status === "uploading");

  return (
    <div className="bcw-window">
      <div className="bcw-header">
        <button className="bcw-back-btn" onClick={onBack}>←</button>
        <div className="bcw-avatar">📢</div>
        <div className="bcw-title">
          <span className="bcw-name">{list.name}</span>
          <span className="bcw-recipient-count">{recipients.length} recipients</span>
        </div>
        <button className="bcw-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="bcw-body">
        <div className="bcw-info-banner">
          Messages sent here go to each person individually — they won't see
          each other or know this was a broadcast.
        </div>

        <div className="bcw-recipients-list">
          {recipients.map((r) => (
            <span key={r} className="bcw-recipient-chip">{r}</span>
          ))}
        </div>

        {results.length > 0 && (
          <div className="bcw-results">
            {results.map((r, i) => (
              <div key={i} className="bcw-result">
                ✓ {r.label !== "Message" ? `${r.label} — ` : ""}Sent to {r.sentCount} of {recipients.length}
                {r.failed.length > 0 && (
                  <div className="bcw-result-failed">Failed: {r.failed.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NEW: multi-file compose tray — mirrors MessagesPanel/GroupChatWindow's. */}
      {pendingAttachments.length > 0 && (
        <div className="bcw-pending-attachments-row">
          <div className="bcw-pending-attachments-scroll">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className={`bcw-pending-attachment-chip ${
                  att.status === "error" ? "bcw-pending-error" : ""
                }`}
              >
                {att.type === "image" && <img src={att.previewUrl} alt="preview" />}
                {att.type === "video" && <video src={att.previewUrl} muted />}
                {att.type === "file" && (
                  <div className="bcw-pending-file-chip">
                    <span>📎</span>
                    <span className="bcw-pending-file-label" title={att.name}>
                      {att.name}
                    </span>
                  </div>
                )}

                {(att.status === "uploading" || att.status === "error") && (
                  <UploadProgressBar progress={att.progress} status={att.status} />
                )}

                <button
                  type="button"
                  className="bcw-pending-remove"
                  onClick={() => removePendingAttachment(att.id)}
                  aria-label="Remove attachment"
                  disabled={att.status === "uploading"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {pendingAttachments.length > 1 && !isUploadingAny && (
            <button type="button" className="bcw-pending-clear-all" onClick={clearAllPendingAttachments}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="bcw-input-row">
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} multiple />
        <button
          className="bcw-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
        >
          📎
        </button>

        <button
          type="button"
          ref={emojiBtnRef}
          className="bcw-icon-btn"
          onClick={() => setShowEmojiPicker((v) => !v)}
          aria-label="Emoji, GIFs and stickers"
        >
          😀
        </button>

        {showEmojiPicker && (
          <EmojiGifStickerPicker
            ref={emojiPickerRef}
            onEmojiSelect={(emoji) => insertEmoji(emoji)}
            onMediaSelect={({ url, type }) => {
              setShowEmojiPicker(false);
              sendMedia(url, type);
            }}
          />
        )}

        <input
          ref={inputRef}
          className="bcw-text-input"
          placeholder="Compose broadcast message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="bcw-send-btn"
          onClick={handleSend}
          disabled={sending || (!text.trim() && pendingAttachments.length === 0)}
        >
          {sending ? "…" : "➤"}
        </button>
      </div>
    </div>
  );
};

export default BroadcastComposeWindow;