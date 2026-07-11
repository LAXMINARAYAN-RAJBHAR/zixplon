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

  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef();

  const getOtherUser = (conv) =>
    conv.user_a === currentUser ? conv.user_b : conv.user_a;

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
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeConvo]);

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

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-panel" onClick={(e) => e.stopPropagation()}>
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
              <div className="mp-inbox-header">
                <span>Messages</span>
                <button className="mp-close-btn" onClick={onClose} aria-label="Close">✕</button>
              </div>
              {loadingConvos ? (
                <p className="mp-empty">Loading…</p>
              ) : conversations.length === 0 ? (
                <p className="mp-empty">No conversations yet.</p>
              ) : (
                conversations.map((conv) => {
                  const other = getOtherUser(conv);
                  const isActive = other === activeUsername;
                  return (
                    <div
                      key={conv.id}
                      className={`mp-convo-item ${isActive ? "active" : ""}`}
                      onClick={() => setActiveUsername(other)}
                    >
                      <div className="mp-convo-avatar">
                        {other.slice(0, 2).toUpperCase()}
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
                  <div className="mp-chat-header">
                    <button className="mp-back-btn" onClick={() => setActiveUsername(null)}>
                      ←
                    </button>
                    <div className="mp-convo-avatar">
                      {activeUsername.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="mp-chat-username">{activeUsername}</div>
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
                            <span className="mp-bubble-time">{timeShort(m.created_at)}</span>
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