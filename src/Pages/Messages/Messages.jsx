import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import "./Messages.css";

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

const Messages = () => {
  const { username: activeUsername } = useParams();
  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username") || "";

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

  // ── Load conversation list ──
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
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchConversations]);

  // ── Get-or-create + load conversation for activeUsername ──
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

  // ── Realtime subscribe to messages in the active conversation ──
  useEffect(() => {
    if (!activeConvo) return;

    const channel = supabase
      .channel(`dm-${activeConvo.id}`)
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

  if (!currentUser) {
    return (
      <div className="msg-page">
        <div className="msg-login-prompt">
          <p>🔒 Please log in to use Messages</p>
          <button onClick={() => window.dispatchEvent(new CustomEvent("openLogin"))}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-page">
      {/* ── Conversation list ── */}
      <div className={`msg-inbox ${activeUsername ? "msg-inbox-hidden-mobile" : ""}`}>
        <div className="msg-inbox-header">Messages</div>
        {loadingConvos ? (
          <p className="msg-empty">Loading…</p>
        ) : conversations.length === 0 ? (
          <p className="msg-empty">No conversations yet.</p>
        ) : (
          conversations.map((conv) => {
            const other = getOtherUser(conv);
            const isActive = other === activeUsername;
            return (
              <div
                key={conv.id}
                className={`msg-convo-item ${isActive ? "active" : ""}`}
                onClick={() => navigate(`/messages/${other}`)}
              >
                <div className="msg-convo-avatar">
                  {other.slice(0, 2).toUpperCase()}
                </div>
                <div className="msg-convo-meta">
                  <div className="msg-convo-name">{other}</div>
                  <div className="msg-convo-last">
                    {conv.last_message || "No messages yet"}
                  </div>
                </div>
                <div className="msg-convo-time">{timeAgo(conv.last_message_at)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Chat window ── */}
      <div className={`msg-chat-window ${!activeUsername ? "msg-chat-hidden-mobile" : ""}`}>
        {!activeUsername ? (
          <div className="msg-placeholder">Select a conversation to start chatting</div>
        ) : (
          <>
            <div className="msg-chat-header">
              <button className="msg-back-btn" onClick={() => navigate("/messages")}>
                ←
              </button>
              <div className="msg-convo-avatar">
                {activeUsername.slice(0, 2).toUpperCase()}
              </div>
              <div className="msg-chat-username">{activeUsername}</div>
            </div>

            <div className="msg-chat-body">
              {loadingMessages ? (
                <p className="msg-empty">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="msg-empty">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg-bubble-row ${m.sender_username === currentUser ? "mine" : ""}`}
                  >
                    <div className="msg-bubble">
                      <span>{m.text}</span>
                      <span className="msg-bubble-time">{timeShort(m.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="msg-chat-input-row">
              <input
                className="msg-chat-input"
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="msg-send-btn"
                onClick={handleSend}
                disabled={!text.trim() || sending}
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Messages;