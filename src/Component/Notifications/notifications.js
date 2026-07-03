import React from "react";
import { useNavigate } from "react-router-dom";

const getNotifStyle = (type) => {
  switch (type) {
    case "upload":     return { color: "#ff4444", icon: "🎬" };
    case "like":       return { color: "#ff9800", icon: "❤️" };
    case "comment":    return { color: "#2196f3", icon: "💬" };
    case "subscriber": return { color: "#4caf50", icon: "🔔" };
    default:           return { color: "#aaa",    icon: "📢" };
  }
};

const Notifications = ({ notifications = [] }) => {
  const navigate = useNavigate();

  const handleNotifClick = (n) => {
    if (n.type === "upload" && n.videoId) {
      navigate(`/watch/${n.videoId}`); // match your actual video/reel route
    } else if (n.type === "comment" && n.videoId) {
      navigate(`/watch/${n.videoId}#comments`);
    } else if (n.type === "subscriber" && n.channelId) {
      navigate(`/channel/${n.channelId}`);
    }
    // mark as read here too, e.g. markNotificationRead(n.id)
  };

  return (
    <div style={{ paddingTop: "80px", maxWidth: "700px", margin: "0 auto", padding: "80px 24px 24px" }}>
      <h2 style={{ color: "white", marginBottom: "20px" }}>All Notifications</h2>

      {notifications.length === 0 ? (
        <p style={{ color: "#aaa" }}>No notifications yet.</p>
      ) : (
        notifications.map((n) => {
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
                cursor: "pointer", // add this so it visually signals clickable
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
        })
      )}
    </div>
  );
};

export default Notifications;