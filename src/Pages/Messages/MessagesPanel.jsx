import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import "./MessagesPanel.css";

const EMOJI_ONLY_REGEX = /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;

const isEmojiOnlyMessage = (str) => {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  return EMOJI_ONLY_REGEX.test(trimmed) && Array.from(trimmed).length <= 6;
};

const EMOJI_SPLIT_REGEX =
  /(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?)/gu;
const EMOJI_TEST_REGEX =
  /^\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\ufe0f?$/u;

const renderMessageText = (str, mine) => {
  if (!str) return null;
  const parts = str.split(EMOJI_SPLIT_REGEX).filter((p) => p !== "");
  return parts.map((part, i) =>
    EMOJI_TEST_REGEX.test(part) ? (
      <span key={i} className={mine ? "mp-inline-emoji-halo" : ""}>
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

// ── Maps a filename's extension to an icon + label + brand color ──
const getFileTypeInfo = (filename) => {
  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  const map = {
    pdf:  { icon: "📕", label: "PDF",   color: "#e11d48" },
    doc:  { icon: "📘", label: "DOC",   color: "#2563eb" },
    docx: { icon: "📘", label: "DOCX",  color: "#2563eb" },
    xls:  { icon: "📗", label: "XLS",   color: "#15803d" },
    xlsx: { icon: "📗", label: "XLSX",  color: "#15803d" },
    ppt:  { icon: "📙", label: "PPT",   color: "#ea580c" },
    pptx: { icon: "📙", label: "PPTX",  color: "#ea580c" },
    txt:  { icon: "📄", label: "TXT",   color: "#64748b" },
    zip:  { icon: "🗜️", label: "ZIP",  color: "#7c3aed" },
    rar:  { icon: "🗜️", label: "RAR",  color: "#7c3aed" },
    csv:  { icon: "📊", label: "CSV",   color: "#15803d" },
  };
  return map[ext] || { icon: "📎", label: ext ? ext.toUpperCase() : "FILE", color: "#9e1226" };
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CLOUDINARY_CLOUD_NAME = "dwoqk0yue";
const CLOUDINARY_UPLOAD_PRESET = "youtube-clone";

const EMOJI_LIST = [
  "😀","😁","😂","🤣","😊","😍","😘","😜","🤔","🙄",
  "😴","🤗","🥳","😎","🤩","🥺","😭","😡","🤯","🤝",
  "👍","👎","👏","🙏","💪","🔥","✨","🎉","❤️","💔",
  "💯","👀","🙌","🤷","😅","😇","🤤","😬","🥶","🤒",
  "🎂","🎁","☕","🍕","🍔","🍿","⚽","🏀","🎮","📸",
];

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const timeShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const attachmentTypeFromFile = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

const uploadToCloudinary = async (file, resourceType) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
};

const MessagesPanel = ({ initialUsername, onClose }) => {
  const currentUser = localStorage.getItem("username") || "";

  const [activeUsername, setActiveUsername] = useState(initialUsername || null);
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");
  const [profileResults, setProfileResults] = useState([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);

  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef();
  const emojiBtnRef = useRef();

  const fileInputRef = useRef();
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl, type, name, size }
  const [uploading, setUploading] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const bottomRef = useRef();
  const panelRef = useRef();
  const inputRef = useRef();

  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isMobile = () => window.innerWidth <= 768;

  const handleDragStart = (e) => {
    if (isMobile()) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    setPosition({ x: rect.left, y: rect.top });
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const panel = panelRef.current;
      const w = panel?.offsetWidth || 700;
      const h = panel?.offsetHeight || 560;

      let x = clientX - dragOffset.current.x;
      let y = clientY - dragOffset.current.y;

      x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - h - 8));

      setPosition({ x, y });
    };

    const handleUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const getOtherUser = (conv) =>
    conv.user_a === currentUser ? conv.user_b : conv.user_a;

  const getTickStatus = (m) => {
    if (m.seen_at) return "seen";
    if (m.delivered_at) return "delivered";
    return "sent";
  };

  const isConvoUnread = (conv) => {
    if (!conv.last_message_at) return false;
    if (!conv.last_message_sender || conv.last_message_sender === currentUser) return false;
    const myLastRead = conv.user_a === currentUser ? conv.last_read_a : conv.last_read_b;
    if (!myLastRead) return true;
    return new Date(conv.last_message_at) > new Date(myLastRead);
  };

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUser } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`dm-global-delivery-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new;
          if (msg.sender_username !== currentUser && !msg.delivered_at) {
            await supabase
              .from("direct_messages")
              .update({ delivered_at: new Date().toISOString() })
              .eq("id", msg.id)
              .is("delivered_at", null);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_a.eq.${currentUser},user_b.eq.${currentUser}`)
      .order("last_message_at", { ascending: false });
    setConversations(data || []);
    setLoadingConvos(false);
  }, [currentUser]);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("conversations-realtime-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchConversations]);

  useEffect(() => {
    const query = inboxSearch.trim();
    if (!query || !currentUser) {
      setProfileResults([]);
      setSearchingProfiles(false);
      return;
    }

    setSearchingProfiles(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", `%${query}%`)
        .neq("username", currentUser)
        .limit(8);

      if (!error) setProfileResults(data || []);
      setSearchingProfiles(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [inboxSearch, currentUser]);

  useEffect(() => {
    if (!activeUsername || !currentUser) {
      setActiveConvo(null);
      setMessages([]);
      return;
    }

    let active = true;

    const loadOrCreate = async () => {
      setLoadingMessages(true);
      const [user_a, user_b] = [currentUser, activeUsername].sort();

      let { data: convo } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_a", user_a)
        .eq("user_b", user_b)
        .maybeSingle();

      if (!convo) {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ user_a, user_b })
          .select()
          .single();
        convo = created;
      }

      if (!active || !convo) return;
      setActiveConvo(convo);

      const myReadKey = convo.user_a === currentUser ? "last_read_a" : "last_read_b";
      const nowIso = new Date().toISOString();
      supabase
        .from("conversations")
        .update({ [myReadKey]: nowIso })
        .eq("id", convo.id)
        .then(() => {
          setConversations((prev) =>
            prev.map((c) => (c.id === convo.id ? { ...c, [myReadKey]: nowIso } : c)),
          );
        });

      const { data: msgs } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: true });

      if (active) {
        setMessages(msgs || []);
        setLoadingMessages(false);
      }
    };

    loadOrCreate();

    return () => {
      active = false;
    };
  }, [activeUsername, currentUser]);

  useEffect(() => {
    if (!activeConvo) return;

    const channel = supabase
      .channel(`dm-panel-${activeConvo.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConvo.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConvo.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
          );
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeConvo]);

  useEffect(() => {
    if (!activeConvo || !currentUser) return;

    const unseen = messages.filter((m) => m.sender_username !== currentUser && !m.seen_at);
    if (unseen.length === 0) return;

    const ids = unseen.map((m) => m.id);
    const nowIso = new Date().toISOString();

    supabase
      .from("direct_messages")
      .update({ seen_at: nowIso, delivered_at: nowIso })
      .in("id", ids)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(m.id)
              ? { ...m, seen_at: m.seen_at || nowIso, delivered_at: m.delivered_at || nowIso }
              : m,
          ),
        );
      });
  }, [messages, activeConvo, currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Max size is 25MB.");
      return;
    }

    const type = attachmentTypeFromFile(file);
    const previewUrl = type === "image" || type === "video" ? URL.createObjectURL(file) : null;
    setPendingAttachment({ file, previewUrl, type, name: file.name, size: file.size });
  };

  const clearPendingAttachment = () => {
    if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
  };

  const handleSend = async () => {
    if ((!text.trim() && !pendingAttachment) || !activeConvo || sending || uploading) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");

    let attachment_url = null;
    let attachment_type = null;
    let attachment_name = null;
    let attachment_size = null;

    try {
      if (pendingAttachment) {
        setUploading(true);
        const resourceType =
          pendingAttachment.type === "image" ? "image"
          : pendingAttachment.type === "video" ? "video"
          : "raw";
        attachment_url = await uploadToCloudinary(pendingAttachment.file, resourceType);
        attachment_type = pendingAttachment.type;
        attachment_name = pendingAttachment.name;
        attachment_size = pendingAttachment.size;
        setUploading(false);
      }
    } catch (err) {
      setUploading(false);
      setSending(false);
      setText(trimmed);
      alert("Attachment upload failed. Please try again.");
      return;
    }

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: activeConvo.id,
      sender_username: currentUser,
      text: trimmed || null,
      attachment_url,
      attachment_type,
      attachment_name,
      attachment_size,
    });

    if (!error) {
      const previewText =
        trimmed ||
        (attachment_type === "image" ? "📷 Photo"
          : attachment_type === "video" ? "🎥 Video"
          : `📎 ${attachment_name || "Attachment"}`);
      await supabase
        .from("conversations")
        .update({
          last_message: previewText,
          last_message_at: new Date().toISOString(),
          last_message_sender: currentUser,
        })
        .eq("id", activeConvo.id);
      clearPendingAttachment();
    } else {
      setText(trimmed);
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const panelStyle = position
    ? { position: "fixed", left: position.x, top: position.y, right: "auto", bottom: "auto", margin: 0 }
    : undefined;

  const normalizedSearch = inboxSearch.trim().toLowerCase();
  const filteredConversations = normalizedSearch
    ? conversations.filter((conv) => {
        const other = getOtherUser(conv).toLowerCase();
        const lastMsg = (conv.last_message || "").toLowerCase();
        return other.includes(normalizedSearch) || lastMsg.includes(normalizedSearch);
      })
    : conversations;

  const existingUsernames = new Set(conversations.map((c) => getOtherUser(c)));
  const newProfileResults = profileResults.filter((p) => !existingUsernames.has(p.username));

  const startChatWith = (username) => {
    setInboxSearch("");
    setActiveUsername(username);
  };

  return (
    <div
      className={`mp-overlay ${!currentUser ? "mp-overlay-center" : ""}`}
      onClick={(e) => {
        if (!dragging) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`mp-panel ${dragging ? "mp-dragging" : ""} ${!currentUser ? "mp-panel-login" : ""}`}
        style={currentUser ? panelStyle : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {!currentUser ? (
          <div className="mp-login-prompt">
            <p>🔒 Please log in to use Messages</p>
            <button onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}>
              Login
            </button>
            <button className="mp-close-btn-alt" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className={`mp-inbox ${activeUsername ? "mp-inbox-hidden-mobile" : ""}`}>
              <div
                className="mp-inbox-header mp-drag-handle"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <span>Messages</span>
                <button className="mp-close-btn" onClick={onClose} aria-label="Close">✕</button>
              </div>

              <div className="mp-inbox-search-row">
                <svg className="mp-inbox-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  className="mp-inbox-search-input"
                  placeholder="Search people or messages"
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                />
                {inboxSearch && (
                  <button
                    type="button"
                    className="mp-inbox-search-clear"
                    onClick={() => setInboxSearch("")}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {loadingConvos ? (
                <p className="mp-empty">Loading…</p>
              ) : conversations.length === 0 && !normalizedSearch ? (
                <p className="mp-empty">No conversations yet.</p>
              ) : (
                <>
                  {filteredConversations.length === 0 &&
                  newProfileResults.length === 0 &&
                  !searchingProfiles &&
                  normalizedSearch ? (
                    <p className="mp-empty">No matches for "{inboxSearch}"</p>
                  ) : (
                    filteredConversations.map((conv) => {
                      const other = getOtherUser(conv);
                      const isActive = other === activeUsername;
                      const isOnline = onlineUsers.has(other);
                      const unread = isConvoUnread(conv);
                      return (
                        <div
                          key={conv.id}
                          className={`mp-convo-item ${isActive ? "active" : ""} ${unread ? "mp-convo-unread" : ""}`}
                          onClick={() => setActiveUsername(other)}
                        >
                          <div className="mp-convo-avatar">
                            {other.slice(0, 2).toUpperCase()}
                            <span className={`mp-status-dot ${isOnline ? "online" : "offline"}`} />
                          </div>
                          <div className="mp-convo-meta">
                            <div className="mp-convo-name">{other}</div>
                            <div className="mp-convo-last">
                              {conv.last_message || "No messages yet"}
                            </div>
                          </div>
                          <div className="mp-convo-right">
                            <div className="mp-convo-time">{timeAgo(conv.last_message_at)}</div>
                            {unread && <span className="mp-unread-dot" />}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {normalizedSearch && (searchingProfiles || newProfileResults.length > 0) && (
                    <>
                      <div className="mp-inbox-section-label">Start new chat</div>
                      {searchingProfiles ? (
                        <p className="mp-empty mp-empty-small">Searching…</p>
                      ) : (
                        newProfileResults.map((p) => (
                          <div
                            key={p.username}
                            className="mp-convo-item mp-profile-result"
                            onClick={() => startChatWith(p.username)}
                          >
                            <div className="mp-convo-avatar">
                              {p.username.slice(0, 2).toUpperCase()}
                              <span className={`mp-status-dot ${onlineUsers.has(p.username) ? "online" : "offline"}`} />
                            </div>
                            <div className="mp-convo-meta">
                              <div className="mp-convo-name">{p.username}</div>
                              <div className="mp-convo-last">Tap to start chatting</div>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className={`mp-chat-window ${!activeUsername ? "mp-chat-hidden-mobile" : ""}`}>
              {!activeUsername ? (
                <div className="mp-placeholder">
                  <span>Select a conversation to start chatting</span>
                  <button className="mp-close-btn-desktop" onClick={onClose} aria-label="Close">✕</button>
                </div>
              ) : (
                <>
                  <div
                    className="mp-chat-header mp-drag-handle"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    <button
                      className="mp-back-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveUsername(null);
                      }}
                    >
                      ←
                    </button>
                    <div className="mp-convo-avatar">
                      {activeUsername.slice(0, 2).toUpperCase()}
                      <span className={`mp-status-dot ${onlineUsers.has(activeUsername) ? "online" : "offline"}`} />
                    </div>
                    <div className="mp-chat-username">
                      <span className="mp-chat-username-text">{activeUsername}</span>
                      <span className={`mp-chat-status ${onlineUsers.has(activeUsername) ? "online" : "offline"}`}>
                        {onlineUsers.has(activeUsername) ? "Online" : "Offline"}
                      </span>
                    </div>
                    <button className="mp-close-btn" onClick={onClose} aria-label="Close">✕</button>
                  </div>

                  <div className="mp-chat-body">
                    {loadingMessages ? (
                      <p className="mp-empty">Loading messages…</p>
                    ) : messages.length === 0 ? (
                      <p className="mp-empty">No messages yet. Say hello!</p>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender_username === currentUser;
                        const fileInfo = m.attachment_type === "file" ? getFileTypeInfo(m.attachment_name) : null;
                        return (
                          <div key={m.id} className={`mp-bubble-row ${mine ? "mine" : ""}`}>
                            <div
                              className={`mp-bubble ${m.attachment_url ? "mp-bubble-has-attachment" : ""} ${
                                m.text && !m.attachment_url && isEmojiOnlyMessage(m.text)
                                  ? "mp-bubble-emoji-only"
                                  : ""
                              }`}
                            >
                              {m.attachment_url && m.attachment_type === "image" && (
                                <img
                                  src={m.attachment_url}
                                  alt="attachment"
                                  className="mp-bubble-image"
                                  onClick={() => window.open(m.attachment_url, "_blank")}
                                />
                              )}

                              {m.attachment_url && m.attachment_type === "video" && (
                                <video src={m.attachment_url} controls className="mp-bubble-video" />
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
                                (isEmojiOnlyMessage(m.text) ? (
                                  <span className="mp-emoji-only-text">{m.text}</span>
                                ) : (
                                  <span>{renderMessageText(m.text, mine)}</span>
                                ))}

                              <span className="mp-bubble-footer">
                                <span className="mp-bubble-time">{timeShort(m.created_at)}</span>
                                {mine && (
                                  <span className={`mp-ticks mp-ticks-${getTickStatus(m)}`}>
                                    {getTickStatus(m) === "sent" ? "✓" : "✓✓"}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {pendingAttachment && (
                    <div className="mp-pending-attachment">
                      {pendingAttachment.type === "image" && (
                        <img src={pendingAttachment.previewUrl} alt="preview" />
                      )}
                      {pendingAttachment.type === "video" && (
                        <video src={pendingAttachment.previewUrl} />
                      )}
                      {pendingAttachment.type === "file" && (() => {
                        const info = getFileTypeInfo(pendingAttachment.name);
                        return (
                          <span className="mp-pending-file-name" style={{ "--file-color": info.color }}>
                            <span className="mp-file-icon">{info.icon}</span>
                            {pendingAttachment.name}
                            <span className="mp-file-sub"> · {info.label} · {formatFileSize(pendingAttachment.size)}</span>
                          </span>
                        );
                      })()}
                      <button
                        className="mp-pending-remove"
                        onClick={clearPendingAttachment}
                        aria-label="Remove attachment"
                      >
                        ✕
                      </button>
                      {uploading && <span className="mp-pending-uploading">Uploading…</span>}
                    </div>
                  )}

                  <div className="mp-chat-input-row">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
                    />
                    <button
                      type="button"
                      className="mp-icon-btn"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach file"
                    >
                      📎
                    </button>

                    <button
                      type="button"
                      ref={emojiBtnRef}
                      className="mp-icon-btn"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      aria-label="Emoji"
                    >
                      😀
                    </button>

                    {showEmojiPicker && (
                      <div className="mp-emoji-picker" ref={emojiPickerRef}>
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="mp-emoji-btn"
                            onClick={() => insertEmoji(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    <input
                      ref={inputRef}
                      className="mp-chat-input"
                      placeholder="Type a message…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className="mp-send-btn"
                      onClick={handleSend}
                      disabled={(!text.trim() && !pendingAttachment) || sending || uploading}
                    >
                      ➤
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesPanel;