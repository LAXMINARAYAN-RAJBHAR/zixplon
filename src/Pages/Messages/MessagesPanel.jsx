import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../config/supabase";
import "./MessagesPanel.css";

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

  // ── Presence: who's currently online ──
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const bottomRef = useRef();
  const panelRef = useRef();

  // ── Drag-to-move state ──
  const [position, setPosition] = useState(null); // null = default docked position
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isMobile = () => window.innerWidth <= 768;

  const handleDragStart = (e) => {
    if (isMobile()) return; // keep full-screen behavior on mobile
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragOffset.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };

    // Lock in current rect as explicit left/top so it doesn't jump
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

      // Keep panel within viewport bounds
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

  const getOtherUser = (conv) =>
    conv.user_a === currentUser ? conv.user_b : conv.user_a;

  const getTickStatus = (m) => {
    if (m.seen_at) return "seen";
    if (m.delivered_at) return "delivered";
    return "sent";
  };

  // ── Presence: announce this client & track everyone who's online ──
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

  // ── Global: mark messages "delivered" the instant this client receives them,
  //    regardless of which conversation (if any) is currently open ──
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
        }
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
        () => fetchConversations()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchConversations]);

  // ── Debounced profile search: lets the user find & start a chat with
  //    anyone on Zixplon, not just people they already have a conversation with ──
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
        }
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
            prev.map((m) => (m.id === payload.new.id ? payload.new : m))
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeConvo]);

  // ── Mark incoming messages as "seen" while this conversation is open ──
  useEffect(() => {
    if (!activeConvo || !currentUser) return;

    const unseen = messages.filter(
      (m) => m.sender_username !== currentUser && !m.seen_at
    );
    if (unseen.length === 0) return;

    const ids = unseen.map((m) => m.id);
    const nowIso = new Date().toISOString();

    supabase
      .from("direct_messages")
      .update({ seen_at: nowIso, delivered_at: nowIso })
      .in("id", ids)
      .then(() => {
        // Reflect locally right away in case the realtime UPDATE event lags
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(m.id)
              ? { ...m, seen_at: m.seen_at || nowIso, delivered_at: m.delivered_at || nowIso }
              : m
          )
        );
      });
  }, [messages, activeConvo, currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !activeConvo || sending) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: activeConvo.id,
      sender_username: currentUser,
      text: trimmed,
    });

    if (!error) {
      await supabase
        .from("conversations")
        .update({ last_message: trimmed, last_message_at: new Date().toISOString() })
        .eq("id", activeConvo.id);
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
    ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto",
        margin: 0,
      }
    : undefined;

  // ── Filter conversations by username OR last message content ──
  const normalizedSearch = inboxSearch.trim().toLowerCase();
  const filteredConversations = normalizedSearch
    ? conversations.filter((conv) => {
        const other = getOtherUser(conv).toLowerCase();
        const lastMsg = (conv.last_message || "").toLowerCase();
        return other.includes(normalizedSearch) || lastMsg.includes(normalizedSearch);
      })
    : conversations;

  // ── Profiles found by search that don't already have a conversation ──
  const existingUsernames = new Set(conversations.map((c) => getOtherUser(c)));
  const newProfileResults = profileResults.filter(
    (p) => !existingUsernames.has(p.username)
  );

  const startChatWith = (username) => {
    setInboxSearch("");
    setActiveUsername(username);
  };

  return (
    <div
      className={`mp-overlay ${!currentUser ? "mp-overlay-center" : ""}`}
      onClick={(e) => {
        // Only close if the click is the backdrop itself, not while dragging
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
            {/* ── Inbox list ── */}
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
                      return (
                        <div
                          key={conv.id}
                          className={`mp-convo-item ${isActive ? "active" : ""}`}
                          onClick={() => setActiveUsername(other)}
                        >
                          <div className="mp-convo-avatar">
                            {other.slice(0, 2).toUpperCase()}
                            {isOnline && <span className="mp-online-dot" />}
                          </div>
                          <div className="mp-convo-meta">
                            <div className="mp-convo-name">{other}</div>
                            <div className="mp-convo-last">
                              {conv.last_message || "No messages yet"}
                            </div>
                          </div>
                          <div className="mp-convo-time">{timeAgo(conv.last_message_at)}</div>
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
                              {onlineUsers.has(p.username) && <span className="mp-online-dot" />}
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

            {/* ── Chat window ── */}
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
                      {onlineUsers.has(activeUsername) && <span className="mp-online-dot" />}
                    </div>
                    <div className="mp-chat-username">
                      <span className="mp-chat-username-text">{activeUsername}</span>
                      <span className={`mp-chat-status ${onlineUsers.has(activeUsername) ? "online" : ""}`}>
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
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`mp-bubble-row ${m.sender_username === currentUser ? "mine" : ""}`}
                        >
                          <div className="mp-bubble">
                            <span>{m.text}</span>
                            <span className="mp-bubble-footer">
                              <span className="mp-bubble-time">{timeShort(m.created_at)}</span>
                              {m.sender_username === currentUser && (
                                <span className={`mp-ticks mp-ticks-${getTickStatus(m)}`}>
                                  {getTickStatus(m) === "sent" ? "✓" : "✓✓"}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <div className="mp-chat-input-row">
                    <input
                      className="mp-chat-input"
                      placeholder="Type a message…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      className="mp-send-btn"
                      onClick={handleSend}
                      disabled={!text.trim() || sending}
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