import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";

const getNotifStyle = (type) => {
  switch (type) {
    case "upload":     return { color: "#ff4444", icon: "🎬" };
    case "like":       return { color: "#ff9800", icon: "❤️" };
    case "comment":    return { color: "#2196f3", icon: "💬" };
    case "subscriber": return { color: "#4caf50", icon: "🔔" };
    case "post":       return { color: "#a78bfa", icon: "📝" };
    default:           return { color: "#aaa",    icon: "📢" };
  }
};

const timeAgo = (timestamp) => {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const PAGE_SIZE = 25;

const Notifications = ({ currentUser }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const mapRow = (n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    avatar: n.sender_username?.[0]?.toUpperCase() || "?",
    time: timeAgo(n.created_at),
    read: n.is_read,
    contentId: n.content_id ?? null,
    contentType: n.content_type ?? null,
  });

  // ── Initial load ──
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_username", currentUser)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data, error }) => {
        if (!error && data) {
          setNotifications(data.map(mapRow));
          setHasMore(data.length === PAGE_SIZE);
        }
        setLoading(false);
      });

    // ── Realtime: new notifications land at the top instantly ──
    const channel = supabase
      .channel("notifications-page-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_username=eq.${currentUser}`,
        },
        (payload) => {
          setNotifications((prev) => [mapRow(payload.new), ...prev]);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser]);

  const loadMore = async () => {
    if (!currentUser || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_username", currentUser)
      .order("created_at", { ascending: false })
      .range(notifications.length, notifications.length + PAGE_SIZE - 1);
    if (!error && data) {
      setNotifications((prev) => [...prev, ...data.map(mapRow)]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  const markOneRead = async (id) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = async () => {
    if (!currentUser) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_username", currentUser)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotifClick = (n) => {
    markOneRead(n.id);
    if (!n.contentId || !n.contentType) return;
    if (n.contentType === "reel") navigate(`/reels/${n.contentId}`);
    else if (n.contentType === "video") navigate(`/video/${n.contentId}`);
    else if (n.contentType === "post") navigate(`/post/${n.contentId}`);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ paddingTop: "80px", maxWidth: "700px", margin: "0 auto", padding: "80px 24px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ color: "white", margin: 0 }}>All Notifications</h2>
        {unreadCount > 0 && (
          <span
            onClick={markAllRead}
            style={{ color: "#3ea6ff", fontSize: "14px", cursor: "pointer", fontWeight: "500" }}
          >
            Mark all as read
          </span>
        )}
      </div>

      {!currentUser ? (
        <p style={{ color: "#aaa" }}>Log in to see your notifications.</p>
      ) : loading ? (
        <p style={{ color: "#aaa" }}>Loading...</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: "#aaa" }}>No notifications yet.</p>
      ) : (
        <>
          {notifications.map((n) => {
            const { color, icon } = getNotifStyle(n.type);
            return (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "14px",
                  padding: "14px 16px", marginBottom: "8px",
                  background: n.read ? "#1a1a1a" : "rgba(255,255,255,0.05)",
                  borderRadius: "10px", border: "1px solid #2a2a2a",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "50%",
                  background: color, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: "700",
                  fontSize: "16px", color: "white", flexShrink: 0,
                }}>
                  {n.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: n.read ? "#aaa" : "white", fontSize: "14px", lineHeight: "1.5" }}>
                    <span style={{ marginRight: "6px" }}>{icon}</span>
                    {n.message}
                  </p>
                  <span style={{ color: "#555", fontSize: "12px" }}>{n.time}</span>
                </div>
                {!n.read && (
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#3ea6ff", flexShrink: 0, marginTop: "6px" }} />
                )}
              </div>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  padding: "8px 20px", borderRadius: "20px", border: "1px solid #333",
                  background: "transparent", color: "#3ea6ff", cursor: "pointer", fontSize: "13px",
                }}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notifications;