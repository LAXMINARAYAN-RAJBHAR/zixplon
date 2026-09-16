import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import {
  fetchGroupMembers,
  sendGroupMessage,
  markGroupRead,
  leaveGroup,
} from "../../utils/groupChat";
import { URL_SPLIT_REGEX, isUrlToken, extractFirstUrl, truncateUrlDisplay } from "../../utils/linkPreview";
import LinkPreviewCard from "./LinkPreviewCard";
import AddMembersModal from "./AddMembersModal";
import EmojiGifStickerPicker from "./EmojiGifStickerPicker";
import "./GroupChatWindow.css";
import { playSendSound, playReceiveSound } from "../../utils/soundEffects";
import { uploadAttachmentToR2 } from "../../utils/mediaUpload";

// ── Typing indicator tuning (mirrors MessagesPanel's 1:1 chat) ──
const TYPING_STOP_DELAY_MS = 1500;
const TYPING_AUTO_CLEAR_MS = 4000;

// ── Report reasons (mirrors MessagesPanel's 1:1 report modal) ──
const REPORT_REASONS = [
  "Nudity or sexual content",
  "Involves a minor",
  "Harassment or threats",
  "Spam",
  "Other",
];

// Hard cap on how many files can be queued in one send — mirrors
// MessagesPanel's MAX_ATTACHMENTS.
const MAX_ATTACHMENTS = 10;

const timeShort = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Short label used for a reply/forward preview when the source message
// has no text (e.g. it's an attachment-only message). Mirrors the same
// helper in MessagesPanel.jsx.
const attachmentPreviewLabel = (type, name) => {
  if (type === "image") return "📷 Photo";
  if (type === "video") return "🎥 Video";
  if (type === "voice") return "🎤 Voice message";
  if (type === "gif") return "🎬 GIF";
  if (type === "sticker") return "🏷️ Sticker";
  if (type === "file") return `📎 ${name || "Attachment"}`;
  return "Message";
};

// Splits group message text into URL / plain-text segments so links are
// clickable, mirroring MessagesPanel's renderMessageText but without the
// emoji-halo styling (group bubbles don't currently have that treatment).
const renderGroupMessageText = (str, mine) => {
  if (!str) return null;

  const parts = str.split(URL_SPLIT_REGEX).filter((p) => p !== undefined && p !== "");

  return parts.map((part, i) =>
    isUrlToken(part) ? (
      <a
        key={i}
        href={part.startsWith("www.") ? `https://${part}` : part}
        target="_blank"
        rel="noopener noreferrer"
        className={`gcw-inline-link${mine ? " mine" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        🔗 {truncateUrlDisplay(part)}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

// Formats the set of currently-typing member usernames into a readable
// line, WhatsApp-group style: "Alice is typing…", "Alice and Bob are
// typing…", or "3 people are typing…" once it gets crowded.
const formatTypingLabel = (usernames) => {
  const names = Array.from(usernames);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
};

const TypingBubble = () => (
  <div className="gcw-bubble-row">
    <div className="gcw-typing-bubble" aria-label="typing">
      <span />
      <span />
      <span />
    </div>
  </div>
);

// ── Small upload-progress bar shown over an in-flight attachment,
// whether that's a chip in the compose tray or a bubble already in the
// message list that's still uploading. ──
const UploadProgressBar = ({ progress, status }) => (
  <div className={`gcw-pending-progress-wrap ${status === "error" ? "error" : ""}`}>
    <div
      className={`gcw-pending-progress-bar ${status === "error" ? "error" : ""}`}
      style={{ width: `${status === "error" ? 100 : Math.max(4, progress)}%` }}
    />
    <span className="gcw-pending-progress-label">
      {status === "error" ? "Failed" : `${Math.round(progress)}%`}
    </span>
  </div>
);

let optimisticCounter = 0;
const makeTempId = () => `temp-${Date.now()}-${++optimisticCounter}`;
let attachmentIdCounter = 0;
const makeAttachmentId = () => `att-${Date.now()}-${++attachmentIdCounter}`;

const GroupChatWindow = ({ group, currentUser, onBack, onClose, onGroupDeleted }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  // Queue of not-yet-sent attachments (images/videos/files picked
  // together). Each item tracks its own upload `progress` (0-100) and
  // `status` ("pending" | "uploading" | "error") — mirrors
  // MessagesPanel's pendingAttachments.
  const [pendingAttachments, setPendingAttachments] = useState([]);

  // ── Emoji / GIF / Sticker picker ──
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef();
  const emojiBtnRef = useRef();

  // ── Group options ("⋮" header menu — currently just Delete Group) ──
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const groupMenuRef = useRef();
  const groupMenuBtnRef = useRef();

  // ── Reply ──
  const [replyTarget, setReplyTarget] = useState(null);

  // ── Forward (targets a 1:1 conversation, searched by username) ──
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardQuery, setForwardQuery] = useState("");
  const [forwardResults, setForwardResults] = useState([]);
  const [searchingForward, setSearchingForward] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [forwardedTo, setForwardedTo] = useState(null); // username, briefly shown as confirmation

  // ── Inline editing ──
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  // ── Per-message "⋮" action menu (Reply / Forward / Edit / Report / Delete) ──
  const [openMenuFor, setOpenMenuFor] = useState(null);

  // ── Reporting ──
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // ── Optimistic send tracking ──
  // Maps a temp (optimistic) message id -> true while it's still
  // in-flight, so the realtime INSERT listener knows to reconcile
  // instead of appending a duplicate. Was a single ref before; now a
  // Set, since multiple attachments can be uploading/sending at once.
  const pendingOptimisticIdsRef = useRef(new Set());

  // ── Typing indicator state ──
  const [typingUsers, setTypingUsers] = useState(new Set());
  const typingChannelRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const autoClearTimersRef = useRef({});

  const fileInputRef = useRef();
  const bottomRef = useRef();
  const inputRef = useRef();
  const membersPanelRef = useRef();
  const membersTriggerRef = useRef();

  // Whether the currently logged-in user is an admin of this group —
  // gates the Delete Group option in the "⋮" menu below.
  const isAdmin = members.find((m) => m.username === currentUser)?.is_admin;

  const loadMembers = useCallback(() => {
    fetchGroupMembers(group.id).then(setMembers);
  }, [group.id]);

  useEffect(() => {
    // Switching groups invalidates any in-progress reply — the quoted
    // message belongs to the group we're leaving.
    setReplyTarget(null);

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setLoading(false);
      markGroupRead(group.id, currentUser);
    };
    load();
    loadMembers();
  }, [group.id, currentUser, loadMembers]);

  // ── Realtime listener ──
  useEffect(() => {
    const channel = supabase
      .channel(`group-messages-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => {
          const incoming = payload.new;
          let wasAppended = false;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;

            // If this is our own message coming back from Realtime,
            // reconcile it with whichever optimistic placeholder is
            // still waiting for it (matched on attachment_url once the
            // upload finished, or the oldest still-uploading one as a
            // fallback) instead of appending a duplicate.
            if (incoming.sender_username === currentUser && pendingOptimisticIdsRef.current.size > 0) {
              const placeholder = prev.find(
                (m) =>
                  pendingOptimisticIdsRef.current.has(m.id) &&
                  (m.attachment_url || null) === (incoming.attachment_url || null) &&
                  (m.text || null) === (incoming.text || null),
              );
              if (placeholder) {
                pendingOptimisticIdsRef.current.delete(placeholder.id);
                return prev.map((m) => (m.id === placeholder.id ? incoming : m));
              }
            }

            wasAppended = true;
            return [...prev, incoming];
          });
          if (wasAppended && incoming.sender_username !== currentUser) {
            playReceiveSound();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
          );
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id, currentUser]);

  // Keep the member list live if someone else adds/removes people while
  // this window is open (e.g. another admin adding members concurrently).
  useEffect(() => {
    const channel = supabase
      .channel(`group-members-${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${group.id}` },
        () => loadMembers(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [group.id, loadMembers]);

  // ── Typing indicator: broadcast channel scoped to this group ──
  useEffect(() => {
    setTypingUsers(new Set());
    Object.values(autoClearTimersRef.current).forEach(clearTimeout);
    autoClearTimersRef.current = {};
    clearTimeout(stopTypingTimeoutRef.current);

    const channel = supabase.channel(`typing:group:${group.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.username === currentUser) return;
        const { username, typing } = payload;

        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (typing) next.add(username);
          else next.delete(username);
          return next;
        });

        clearTimeout(autoClearTimersRef.current[username]);
        if (typing) {
          autoClearTimersRef.current[username] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(username);
              return next;
            });
          }, TYPING_AUTO_CLEAR_MS);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      Object.values(autoClearTimersRef.current).forEach(clearTimeout);
      autoClearTimersRef.current = {};
      clearTimeout(stopTypingTimeoutRef.current);
    };
  }, [group.id, currentUser]);

  const handleTypingInput = () => {
    const channel = typingChannelRef.current;
    if (!channel) return;

    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { username: currentUser, typing: true },
    });

    clearTimeout(stopTypingTimeoutRef.current);
    stopTypingTimeoutRef.current = setTimeout(() => {
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { username: currentUser, typing: false },
      });
    }, TYPING_STOP_DELAY_MS);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Close the members panel when tapping/clicking anywhere outside it.
  useEffect(() => {
    if (!showMembers) return;
    const handleClickOutside = (e) => {
      if (
        membersPanelRef.current &&
        !membersPanelRef.current.contains(e.target) &&
        membersTriggerRef.current &&
        !membersTriggerRef.current.contains(e.target)
      ) {
        setShowMembers(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMembers]);

  // Close the group options "⋮" menu when tapping/clicking outside it.
  useEffect(() => {
    if (!showGroupMenu) return;
    const handleClickOutside = (e) => {
      if (
        groupMenuRef.current &&
        !groupMenuRef.current.contains(e.target) &&
        groupMenuBtnRef.current &&
        !groupMenuBtnRef.current.contains(e.target)
      ) {
        setShowGroupMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGroupMenu]);

  // Close the "⋮" action menu when tapping/clicking anywhere outside it.
  useEffect(() => {
    if (!openMenuFor) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest(".gcw-menu") && !e.target.closest(".gcw-menu-trigger")) {
        setOpenMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuFor]);

  // Close the emoji/GIF/sticker picker when tapping/clicking outside it.
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

  // ── Forward: search profiles by username while the picker is open ──
  useEffect(() => {
    if (!forwardTarget) return;
    const query = forwardQuery.trim();
    if (!query) {
      setForwardResults([]);
      setSearchingForward(false);
      return;
    }

    setSearchingForward(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", `%${query}%`)
        .neq("username", currentUser)
        .limit(8);

      if (!error) setForwardResults(data || []);
      setSearchingForward(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [forwardQuery, forwardTarget, currentUser]);

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

  // Updates the live upload progress shown ON an optimistic bubble
  // that's already in the message list (as opposed to still sitting in
  // the compose tray) — used while its file is uploading.
  const updateOptimisticProgress = (tempId, progress) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, _progress: progress } : m)),
    );
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Sends ONE attachment (already uploaded or about to be) as its own
  // optimistic bubble that appears immediately, fills in a live
  // progress bar while uploadAttachmentToR2 reports progress, then
  // reconciles with the real row once the insert completes. Returns
  // true/false for success so the batch loop in handleSend can track
  // failures without aborting the rest of the queue.
  const sendOneAttachment = async (att, { captionText, reply_to_id, reply_to_text, reply_to_sender }) => {
    const tempId = makeTempId();
    pendingOptimisticIdsRef.current.add(tempId);

    const optimisticMessage = {
      id: tempId,
      group_id: group.id,
      sender_username: currentUser,
      text: captionText,
      attachment_url: null,
      attachment_type: att.type,
      attachment_name: att.name,
      attachment_size: att.size,
      reply_to_id,
      reply_to_text,
      reply_to_sender,
      forwarded: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
      _uploading: true,
      _progress: 0,
      _previewUrl: att.previewUrl,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    let attachment_url;
    try {
      const uploaded = await uploadAttachmentToR2(att.file, (pct) =>
        updateOptimisticProgress(tempId, pct),
      );
      attachment_url = uploaded.url;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingOptimisticIdsRef.current.delete(tempId);
      alert(`"${att.name}" failed to upload: ${err?.message || "please try again."}`);
      return false;
    }

    // Upload done — fill in the real URL and drop the "_uploading" flag
    // so the bubble switches from the progress overlay to the normal
    // attachment rendering (image/video/file) right away, even before
    // the DB insert below resolves.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, attachment_url, _uploading: false, _progress: 100 } : m,
      ),
    );

    try {
      const sentMessage = await sendGroupMessage({
        groupId: group.id,
        senderUsername: currentUser,
        text: captionText || "",
        attachmentUrl: attachment_url,
        attachmentType: att.type,
        attachmentName: att.name,
        attachmentSize: att.size,
        replyToId: reply_to_id,
        replyToText: reply_to_text,
        replyToSender: reply_to_sender,
      });

      if (sentMessage && sentMessage.id) {
        pendingOptimisticIdsRef.current.delete(tempId);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? sentMessage : m)));
      }
      // If sentMessage came back empty (RLS denies select, etc.), the
      // bubble stays as the optimistic version — the realtime INSERT
      // listener above will reconcile it once that event arrives.
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingOptimisticIdsRef.current.delete(tempId);
      alert(`"${att.name}" failed to send: ${err?.message || "please try again."}`);
      return false;
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && pendingAttachments.length === 0) || sending) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");

    // Snapshot the reply target now — it gets cleared right after the
    // first optimistic bubble is appended.
    const replyTargetSnapshot = replyTarget;
    const reply_to_id = replyTargetSnapshot?.id || null;
    const reply_to_sender = replyTargetSnapshot?.sender_username || null;
    const reply_to_text = replyTargetSnapshot
      ? replyTargetSnapshot.text
        ? replyTargetSnapshot.text.slice(0, 120)
        : attachmentPreviewLabel(
            replyTargetSnapshot.attachment_type,
            replyTargetSnapshot.attachment_name,
          )
      : null;
    setReplyTarget(null);

    // Sending counts as "done typing" — clear the debounce and notify
    // the group right away instead of waiting out the delay. Wrapped in
    // its own try/catch: this is a nice-to-have side effect, and must
    // never be allowed to block or break the actual message send below.
    try {
      clearTimeout(stopTypingTimeoutRef.current);
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { username: currentUser, typing: false },
      });
    } catch {
      /* no-op — typing indicator is best-effort, never critical */
    }

    if (pendingAttachments.length === 0) {
      // Text-only send — optimistic append first (before anything that
      // could throw), same "never simply invisible" guarantee as before.
      const tempId = makeTempId();
      pendingOptimisticIdsRef.current.add(tempId);
      const optimisticMessage = {
        id: tempId,
        group_id: group.id,
        sender_username: currentUser,
        text: trimmed,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
        reply_to_id,
        reply_to_text,
        reply_to_sender,
        forwarded: false,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      playSendSound();

      try {
        const sentMessage = await sendGroupMessage({
          groupId: group.id,
          senderUsername: currentUser,
          text: trimmed,
          attachmentUrl: null,
          attachmentType: null,
          attachmentName: null,
          attachmentSize: null,
          replyToId: reply_to_id,
          replyToText: reply_to_text,
          replyToSender: reply_to_sender,
        });
        if (sentMessage && sentMessage.id) {
          pendingOptimisticIdsRef.current.delete(tempId);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? sentMessage : m)));
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        pendingOptimisticIdsRef.current.delete(tempId);
        setText(trimmed);
        alert(`Failed to send: ${err?.message || "please try again."}`);
      } finally {
        setSending(false);
      }
      return;
    }

    // One or more attachments queued: send each as its own optimistic
    // bubble with a live progress bar, one at a time, so the group sees
    // them arrive individually instead of the whole batch appearing to
    // hang until every file finishes uploading. The typed caption (if
    // any) rides along with the FIRST attachment only.
    const batch = pendingAttachments;
    playSendSound();

    for (let i = 0; i < batch.length; i++) {
      const att = batch[i];
      const ok = await sendOneAttachment(att, {
        captionText: i === 0 ? trimmed || null : null,
        reply_to_id: i === 0 ? reply_to_id : null,
        reply_to_text: i === 0 ? reply_to_text : null,
        reply_to_sender: i === 0 ? reply_to_sender : null,
      });
      if (ok) {
        setPendingAttachments((prev) => prev.filter((a) => a.id !== att.id));
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      }
    }

    setSending(false);
  };

  // Sends a GIF or sticker picked from EmojiGifStickerPicker straight
  // away — no upload needed since Giphy already hosts the media, and no
  // pre-send preview stage (tapping a GIF/sticker sends it immediately).
  // Mirrors handleSend's optimistic-append pattern above, just without
  // the upload step.
  const sendGroupMedia = async (url, type) => {
    if (!url || sending) return;
    setSending(true);

    const replyTargetSnapshot = replyTarget;
    const reply_to_id = replyTargetSnapshot?.id || null;
    const reply_to_sender = replyTargetSnapshot?.sender_username || null;
    const reply_to_text = replyTargetSnapshot
      ? replyTargetSnapshot.text
        ? replyTargetSnapshot.text.slice(0, 120)
        : attachmentPreviewLabel(
            replyTargetSnapshot.attachment_type,
            replyTargetSnapshot.attachment_name,
          )
      : null;

    const tempId = makeTempId();
    pendingOptimisticIdsRef.current.add(tempId);
    const optimisticMessage = {
      id: tempId,
      group_id: group.id,
      sender_username: currentUser,
      text: null,
      attachment_url: url,
      attachment_type: type, // "gif" | "sticker"
      attachment_name: null,
      attachment_size: null,
      reply_to_id,
      reply_to_text,
      reply_to_sender,
      forwarded: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    playSendSound();
    setReplyTarget(null);

    try {
      clearTimeout(stopTypingTimeoutRef.current);
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { username: currentUser, typing: false },
      });
    } catch {
      /* no-op — typing indicator is best-effort, never critical */
    }

    try {
      const sentMessage = await sendGroupMessage({
        groupId: group.id,
        senderUsername: currentUser,
        text: "",
        attachmentUrl: url,
        attachmentType: type,
        attachmentName: null,
        attachmentSize: null,
        replyToId: reply_to_id,
        replyToText: reply_to_text,
        replyToSender: reply_to_sender,
      });

      if (sentMessage && sentMessage.id) {
        pendingOptimisticIdsRef.current.delete(tempId);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? sentMessage : m)),
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingOptimisticIdsRef.current.delete(tempId);
      alert(`Failed to send: ${err?.message || "please try again."}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave "${group.name}"?`)) return;
    await leaveGroup(group.id, currentUser);
    onBack();
  };

  // ── Delete group (admins only) ──
  // Removes the group entirely — all messages, all memberships, and the
  // group row itself — for EVERY member, not just the person deleting
  // it. Distinct from "Leave group" (members-panel button above), which
  // only removes the current user from an otherwise-untouched group.
  const handleDeleteGroup = async () => {
    if (deletingGroup) return;
    const confirmed = window.confirm(
      `Delete "${group.name}" for everyone? This permanently removes the group and all its messages. This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingGroup(true);
    try {
      const { error: msgErr } = await supabase
        .from("group_messages")
        .delete()
        .eq("group_id", group.id);
      if (msgErr) throw msgErr;

      const { error: memberErr } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", group.id);
      if (memberErr) throw memberErr;

      const { error: groupErr } = await supabase
        .from("groups")
        .delete()
        .eq("id", group.id);
      if (groupErr) throw groupErr;

      // Let the parent (MessagesPanel) know so it can close this window
      // and refresh its group list — the group object it's holding is
      // now stale.
      if (onGroupDeleted) onGroupDeleted();
      else onBack();
    } catch (err) {
      setDeletingGroup(false);
      alert(`Failed to delete group: ${err?.message || "please try again."}`);
    }
  };

  // ── Reply ──
  const startReply = (m) => {
    setReplyTarget(m);
    inputRef.current?.focus();
  };

  const cancelReply = () => setReplyTarget(null);

  // ── Forward ──
  const openForward = (message) => {
    setForwardTarget(message);
    setForwardQuery("");
    setForwardResults([]);
    setForwardedTo(null);
  };

  const closeForward = () => {
    if (forwarding) return;
    setForwardTarget(null);
    setForwardQuery("");
    setForwardResults([]);
    setForwardedTo(null);
  };

  // Forwards forwardTarget out of the group and into a 1:1 conversation
  // with targetUsername, creating that conversation first if it doesn't
  // exist yet.
  const forwardToUser = async (targetUsername) => {
    if (!forwardTarget || forwarding) return;
    setForwarding(true);

    const [user_a, user_b] = [currentUser, targetUsername].sort();

    let { data: convo } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle();

    if (!convo) {
      // Forwarding to someone you've never talked to is still an
      // unsolicited first message — starts as a pending request too,
      // same as MessagesPanel.jsx's loadOrCreate/forwardToConversation.
      const { data: created } = await supabase
        .from("conversations")
        .insert({
          user_a,
          user_b,
          status: "pending",
          initiated_by: currentUser,
        })
        .select()
        .single();
      convo = created;
    }

    if (!convo) {
      setForwarding(false);
      alert("Couldn't start that conversation. Please try again.");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: convo.id,
      sender_username: currentUser,
      text: forwardTarget.text || null,
      attachment_url: forwardTarget.attachment_url || null,
      attachment_type: forwardTarget.attachment_type || null,
      attachment_name: forwardTarget.attachment_name || null,
      attachment_size: forwardTarget.attachment_size || null,
      forwarded: true,
    });

    if (error) {
      setForwarding(false);
      alert(`Failed to forward message: ${error.message || "please try again."}`);
      return;
    }

    const previewText =
      forwardTarget.text ||
      attachmentPreviewLabel(forwardTarget.attachment_type, forwardTarget.attachment_name);
    await supabase
      .from("conversations")
      .update({
        last_message: previewText,
        last_message_at: new Date().toISOString(),
        last_message_sender: currentUser,
      })
      .eq("id", convo.id);

    setForwarding(false);
    setForwardedTo(targetUsername);
    // Brief confirmation, then close the picker.
    setTimeout(() => {
      setForwardTarget(null);
      setForwardQuery("");
      setForwardResults([]);
      setForwardedTo(null);
    }, 900);
  };

  // ── Inline editing ──
  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (message) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.text) {
      cancelEdit();
      return;
    }

    const editedAt = new Date().toISOString();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, text: trimmed, edited_at: editedAt } : m,
      ),
    );
    setEditingId(null);
    setEditText("");

    await supabase
      .from("group_messages")
      .update({ text: trimmed, edited_at: editedAt })
      .eq("id", message.id);
  };

  // ── Delete message (delete for everyone) ──
  const deleteMessage = async (message) => {
    const confirmed = window.confirm("Delete this message for everyone?");
    if (!confirmed) return;

    const deletedAt = new Date().toISOString();
    if (editingId === message.id) cancelEdit();

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              deleted_at: deletedAt,
              text: null,
              attachment_url: null,
              attachment_type: null,
              attachment_name: null,
              attachment_size: null,
            }
          : m,
      ),
    );

    await supabase
      .from("group_messages")
      .update({
        deleted_at: deletedAt,
        text: null,
        attachment_url: null,
        attachment_type: null,
        attachment_name: null,
        attachment_size: null,
      })
      .eq("id", message.id);
  };

  // ── Reporting ──
  const openReport = (message) => {
    setReportTarget(message);
    setReportReason("");
    setReportSubmitted(false);
  };

  const closeReport = () => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setReportSubmitting(false);
    setReportSubmitted(false);
  };

  // Mirrors MessagesPanel's submitReport — inserts into the shared
  // "reports" table that AdminPanel already reads, tagged content_type
  // "group_message" so moderation can tell the two apart.
  const submitReport = async () => {
    if (!reportTarget || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);

    const { error } = await supabase.from("reports").insert({
      content_type: "group_message",
      content_id: String(reportTarget.id),
      content_title: reportTarget.text?.slice(0, 80) || "Message",
      content_owner: reportTarget.sender_username,
      reporter_username: currentUser,
      reason: reportReason,
      details: reportTarget.attachment_url
        ? `Attachment: ${reportTarget.attachment_type || "file"} (group: ${group.name})`
        : `Group: ${group.name}`,
      status: "pending",
    });

    setReportSubmitting(false);

    if (error) {
      console.error("Group message report submission failed:", error);
      alert(`Failed to submit report: ${error.message || "please try again."}`);
      return;
    }

    setReportSubmitted(true);
  };

  const typingLabel = formatTypingLabel(typingUsers);
  const isUploadingAny = pendingAttachments.some((a) => a.status === "uploading");

  return (
    <div className="gcw-window">
      <div className="gcw-header">
        <button className="gcw-back-btn" onClick={onBack}>←</button>
        <div className="gcw-avatar">{group.name.slice(0, 2).toUpperCase()}</div>
        <div className="gcw-title" ref={membersTriggerRef} onClick={() => setShowMembers((v) => !v)}>
          <span className="gcw-name">{group.name}</span>
          <span className="gcw-member-count">
            {typingLabel || `${members.length} members`}
          </span>
        </div>
        <button
          className="gcw-header-add-btn"
          onClick={() => setShowAddMembers(true)}
          aria-label="Add members"
          title="Add members"
        >
          👤＋
        </button>

        {/* NEW: group options menu — currently just Delete Group,
            restricted to admins. Kept separate from the members panel's
            "Leave group" button since deleting is a much more
            destructive, everyone-affecting action. */}
        <div className="gcw-menu-wrap">
          <button
            ref={groupMenuBtnRef}
            className="gcw-header-menu-btn"
            onClick={() => setShowGroupMenu((v) => !v)}
            aria-label="Group options"
            title="More"
          >
            ⋮
          </button>
          {showGroupMenu && (
            <div className="gcw-group-menu" ref={groupMenuRef}>
              {isAdmin ? (
                <button
                  type="button"
                  className="gcw-group-menu-item danger"
                  onClick={() => {
                    setShowGroupMenu(false);
                    handleDeleteGroup();
                  }}
                  disabled={deletingGroup}
                >
                  🗑 {deletingGroup ? "Deleting…" : "Delete Group"}
                </button>
              ) : (
                <div className="gcw-group-menu-empty">
                  Only admins can delete this group
                </div>
              )}
            </div>
          )}
        </div>

        <button className="gcw-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {showMembers && (
        <div className="gcw-members-panel" ref={membersPanelRef}>
          <div className="gcw-members-panel-header">
            <span>Members</span>
            <button className="gcw-add-member-btn" onClick={() => setShowAddMembers(true)}>
              ＋ Add
            </button>
          </div>
          {members.map((m) => (
            <div key={m.username} className="gcw-member-row">
              <div className="gcw-avatar-sm">{m.username.slice(0, 2).toUpperCase()}</div>
              <span>{m.username}</span>
              {m.is_admin && <span className="gcw-admin-tag">Admin</span>}
            </div>
          ))}
          <button className="gcw-leave-btn" onClick={handleLeaveGroup}>Leave group</button>
        </div>
      )}

      {showAddMembers && (
        <AddMembersModal
          group={group}
          currentUser={currentUser}
          existingUsernames={members.map((m) => m.username)}
          onClose={() => setShowAddMembers(false)}
          onAdded={() => {
            setShowAddMembers(false);
            loadMembers();
          }}
        />
      )}

      <div className="gcw-body">
        {loading ? (
          <p className="gcw-empty">Loading messages…</p>
        ) : messages.length === 0 && typingUsers.size === 0 ? (
          <p className="gcw-empty">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_username === currentUser;
            const hasContent = !!(m.text || m.attachment_url || m._uploading);
            // While an attachment is uploading, use the local blob preview
            // instead of attachment_url (which is still null at that point).
            const displayUrl = m._uploading ? m._previewUrl : m.attachment_url;
            return (
              <div key={m.id} className={`gcw-bubble-row ${mine ? "mine" : ""}`}>
                <div className="gcw-bubble-stack">
                  {editingId !== m.id && !m.deleted_at && hasContent && !m._uploading && (
                    <div className="gcw-bubble-actions">
                      <div className="gcw-menu-wrap">
                        <button
                          type="button"
                          className="gcw-bubble-action-btn gcw-menu-trigger"
                          onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                          aria-label="More options"
                          title="More"
                        >
                          ⋮
                        </button>

                        {openMenuFor === m.id && (
                          <div className={`gcw-menu ${mine ? "mine" : ""}`}>
                            <button
                              type="button"
                              className="gcw-menu-item"
                              onClick={() => {
                                startReply(m);
                                setOpenMenuFor(null);
                              }}
                            >
                              ↩ Reply
                            </button>
                            <button
                              type="button"
                              className="gcw-menu-item"
                              onClick={() => {
                                openForward(m);
                                setOpenMenuFor(null);
                              }}
                            >
                              ➡ Forward
                            </button>
                            {mine && m.text && !m.attachment_url && (
                              <button
                                type="button"
                                className="gcw-menu-item"
                                onClick={() => {
                                  startEdit(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                ✎ Edit
                              </button>
                            )}
                            {!mine && (
                              <button
                                type="button"
                                className="gcw-menu-item"
                                onClick={() => {
                                  openReport(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                🚩 Report
                              </button>
                            )}
                            {mine && (
                              <button
                                type="button"
                                className="gcw-menu-item danger"
                                onClick={() => {
                                  deleteMessage(m);
                                  setOpenMenuFor(null);
                                }}
                              >
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`gcw-bubble ${m.attachment_type === "sticker" ? "gcw-bubble-sticker-wrap" : ""} ${
                      m._uploading ? "gcw-bubble-uploading" : ""
                    }`}
                  >
                    {!mine && <div className="gcw-sender-name">{m.sender_username}</div>}
                    {m.deleted_at ? (
                      <span className="gcw-deleted-text">🚫 This message was deleted</span>
                    ) : editingId === m.id ? (
                      <div className="gcw-edit-box">
                        <input
                          className="gcw-edit-input"
                          value={editText}
                          autoFocus
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit(m);
                            }
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        <div className="gcw-edit-actions">
                          <button onClick={() => saveEdit(m)}>Save</button>
                          <button onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {m.forwarded && <div className="gcw-forwarded-tag">↪ Forwarded</div>}

                        {m.reply_to_id && (
                          <div className={`gcw-reply-quote ${mine ? "mine" : ""}`}>
                            <span className="gcw-reply-quote-sender">
                              {m.reply_to_sender === currentUser ? "You" : m.reply_to_sender}
                            </span>
                            <span className="gcw-reply-quote-text">{m.reply_to_text}</span>
                          </div>
                        )}

                        {/* Uploading placeholder: local preview + live
                            progress bar for images/videos; a small
                            labelled bar for files (no local preview). */}
                        {m._uploading ? (
                          <div className="gcw-uploading-attachment">
                            {(m.attachment_type === "image" || m.attachment_type === "video") && displayUrl ? (
                              m.attachment_type === "image" ? (
                                <img src={displayUrl} alt="uploading" className="gcw-bubble-image" />
                              ) : (
                                <video src={displayUrl} muted className="gcw-bubble-video" />
                              )
                            ) : (
                              <div className="gcw-uploading-file-chip">
                                📎 {m.attachment_name || "Attachment"}
                              </div>
                            )}
                            <UploadProgressBar progress={m._progress || 0} status="uploading" />
                          </div>
                        ) : (
                          <>
                            {m.attachment_url && m.attachment_type === "image" && (
                              <img
                                src={m.attachment_url}
                                alt="attachment"
                                className="gcw-bubble-image"
                                onClick={() => window.open(m.attachment_url, "_blank")}
                              />
                            )}
                            {m.attachment_url && m.attachment_type === "video" && (
                              <video src={m.attachment_url} controls className="gcw-bubble-video" />
                            )}
                            {m.attachment_url && m.attachment_type === "gif" && (
                              <img src={m.attachment_url} alt="GIF" className="gcw-bubble-gif" />
                            )}
                            {m.attachment_url && m.attachment_type === "sticker" && (
                              <img src={m.attachment_url} alt="sticker" className="gcw-bubble-sticker" />
                            )}
                            {m.attachment_url && m.attachment_type === "file" && (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gcw-bubble-file"
                              >
                                📎 {m.attachment_name || "Attachment"}
                                {m.attachment_size ? ` · ${formatFileSize(m.attachment_size)}` : ""}
                              </a>
                            )}
                          </>
                        )}

                        {m.text && <span>{renderGroupMessageText(m.text, mine)}</span>}
                        {m.text && !m._uploading && extractFirstUrl(m.text) && (
                          <LinkPreviewCard url={extractFirstUrl(m.text)} mine={mine} classPrefix="gcw" />
                        )}
                        <span className="gcw-bubble-time">
                          {m.edited_at && <span className="gcw-edited-tag">edited </span>}
                          {m._uploading ? "Sending…" : timeShort(m.created_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {typingUsers.size > 0 && <TypingBubble />}
        <div ref={bottomRef} />
      </div>

      {replyTarget && (
        <div className="gcw-reply-preview">
          <div className="gcw-reply-preview-bar" />
          <div className="gcw-reply-preview-content">
            <span className="gcw-reply-preview-sender">
              Replying to {replyTarget.sender_username === currentUser ? "yourself" : replyTarget.sender_username}
            </span>
            <span className="gcw-reply-preview-text">
              {replyTarget.text
                ? replyTarget.text.slice(0, 80)
                : attachmentPreviewLabel(replyTarget.attachment_type, replyTarget.attachment_name)}
            </span>
          </div>
          <button
            type="button"
            className="gcw-reply-preview-close"
            onClick={cancelReply}
            aria-label="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}

      {/* NEW: multi-file compose tray — mirrors MessagesPanel's. Each
          queued attachment gets its own chip with a thumbnail/name, a
          remove button, and — while handleSend is working through the
          batch — a live progress bar. */}
      {pendingAttachments.length > 0 && (
        <div className="gcw-pending-attachments-row">
          <div className="gcw-pending-attachments-scroll">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className={`gcw-pending-attachment-chip ${
                  att.status === "error" ? "gcw-pending-error" : ""
                }`}
              >
                {att.type === "image" && <img src={att.previewUrl} alt="preview" />}
                {att.type === "video" && <video src={att.previewUrl} muted />}
                {att.type === "file" &&
                  (() => (
                    <div className="gcw-pending-file-chip">
                      <span>📎</span>
                      <span className="gcw-pending-file-label" title={att.name}>
                        {att.name}
                      </span>
                    </div>
                  ))()}

                {(att.status === "uploading" || att.status === "error") && (
                  <UploadProgressBar progress={att.progress} status={att.status} />
                )}

                <button
                  type="button"
                  className="gcw-pending-remove"
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
            <button type="button" className="gcw-pending-clear-all" onClick={clearAllPendingAttachments}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="gcw-input-row">
        <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} multiple />
        <button
          className="gcw-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
        >
          📎
        </button>

        <button
          type="button"
          ref={emojiBtnRef}
          className="gcw-icon-btn"
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
              sendGroupMedia(url, type);
            }}
          />
        )}

        <input
          ref={inputRef}
          className="gcw-text-input"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTypingInput();
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className="gcw-send-btn"
          onClick={handleSend}
          disabled={sending || (!text.trim() && pendingAttachments.length === 0)}
        >
          ➤
        </button>
      </div>

      {forwardTarget && (
        <div className="gcw-overlay" onClick={closeForward}>
          <div className="gcw-forward-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="gcw-forward-title">Forward message</h3>
            <p className="gcw-forward-preview">
              {forwardTarget.text
                ? `"${forwardTarget.text.slice(0, 80)}"`
                : attachmentPreviewLabel(forwardTarget.attachment_type, forwardTarget.attachment_name)}
            </p>

            {forwardedTo ? (
              <p className="gcw-forward-success">✓ Forwarded to {forwardedTo}</p>
            ) : (
              <>
                <input
                  type="text"
                  className="gcw-forward-search"
                  placeholder="Search people…"
                  value={forwardQuery}
                  onChange={(e) => setForwardQuery(e.target.value)}
                  autoFocus
                />
                <div className="gcw-forward-results">
                  {searchingForward ? (
                    <p className="gcw-empty gcw-empty-small">Searching…</p>
                  ) : forwardQuery.trim() && forwardResults.length === 0 ? (
                    <p className="gcw-empty gcw-empty-small">No matches</p>
                  ) : (
                    forwardResults.map((p) => (
                      <div
                        key={p.username}
                        className="gcw-forward-result-row"
                        onClick={() => !forwarding && forwardToUser(p.username)}
                        style={{ opacity: forwarding ? 0.6 : 1, cursor: forwarding ? "default" : "pointer" }}
                      >
                        <div className="gcw-avatar-sm">{p.username.slice(0, 2).toUpperCase()}</div>
                        <span>{p.username}</span>
                      </div>
                    ))
                  )}
                </div>
                <button className="gcw-forward-cancel" onClick={closeForward} disabled={forwarding}>
                  {forwarding ? "Forwarding…" : "Cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {reportTarget && (
        <div className="gcw-overlay" onClick={closeReport}>
          <div className="gcw-forward-panel" onClick={(e) => e.stopPropagation()}>
            {reportSubmitted ? (
              <>
                <h3 className="gcw-forward-title">Report submitted</h3>
                <p className="gcw-forward-preview">
                  Thanks — our team will review this. You can close this now.
                </p>
                <button className="gcw-forward-cancel" onClick={closeReport}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h3 className="gcw-forward-title">Report this message</h3>
                <p className="gcw-forward-preview">
                  From {reportTarget.sender_username}. This will be sent to our moderation team.
                </p>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    style={{ display: "block", padding: "6px 0", fontSize: 13 }}
                  >
                    <input
                      type="radio"
                      name="gcwReportReason"
                      checked={reportReason === r}
                      onChange={() => setReportReason(r)}
                    />{" "}
                    {r}
                  </label>
                ))}
                <button
                  className="gcw-forward-cancel"
                  style={{ marginTop: 10 }}
                  onClick={submitReport}
                  disabled={!reportReason || reportSubmitting}
                >
                  {reportSubmitting ? "Submitting…" : "Submit Report"}
                </button>
                <button
                  className="gcw-forward-cancel"
                  style={{ marginTop: 8 }}
                  onClick={closeReport}
                  disabled={reportSubmitting}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChatWindow;