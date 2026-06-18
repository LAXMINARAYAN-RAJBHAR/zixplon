import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import HistoryIcon from "@mui/icons-material/History";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import "../../styles/libraryPages.css";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

// ─── Call this from your Video.jsx when a video starts playing ───
// import { logHistory } from "../pages/History";
export const logHistory = async (username, videoId) => {
  if (!username || !videoId) return;
  await supabase.from("history").insert({ username, video_id: videoId });
};

const History = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    loadHistory();
  }, [username]);

  const loadHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("history")
      .select("id, watched_at, video_id, videos(id, title, thumbnail, views, uploaded_by)")
      .eq("username", username)
      .order("watched_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      const valid = data.filter((h) => h.videos);
      // Group by date label
      const byDate = {};
      valid.forEach((h) => {
        const label = getDateLabel(h.watched_at);
        if (!byDate[label]) byDate[label] = [];
        byDate[label].push(h);
      });
      setGroups(Object.entries(byDate));
    }
    setLoading(false);
  };

  const getDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear all watch history?")) return;
    await supabase.from("history").delete().eq("username", username);
    setGroups([]);
  };

  const totalCount = groups.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className="lib-page">
      <div className="lib-header">
        <HistoryIcon className="lib-header-icon" />
        <div style={{ flex: 1 }}>
          <h1 className="lib-title">Watch History</h1>
          <p className="lib-subtitle">{totalCount} video{totalCount !== 1 ? "s" : ""} watched</p>
        </div>
        {totalCount > 0 && (
          <button className="lib-danger-btn" onClick={clearHistory}>
            <DeleteSweepIcon /> Clear all
          </button>
        )}
      </div>

      {!username && (
        <div className="lib-empty">
          <p>Sign in to see your watch history.</p>
        </div>
      )}

      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}

      {username && !loading && groups.length === 0 && (
        <div className="lib-empty">
          <HistoryIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Videos you watch will appear here.</p>
        </div>
      )}

      {!loading && groups.map(([label, items]) => (
        <div key={label} className="lib-group">
          <p className="lib-group-label">{label}</p>
          <div className="lib-list">
            {items.map((h) => (
              <Link to={`/video/${h.videos.id}`} key={h.id} className="lib-list-item">
                <div className="lib-list-thumb-wrap">
                  <img src={h.videos.thumbnail || "https://via.placeholder.com/160x90?text=No+Thumbnail"} alt={h.videos.title} className="lib-list-thumb" />
                </div>
                <div className="lib-list-info">
                  <p className="lib-card-title">{h.videos.title}</p>
                  <p className="lib-card-meta">
                    {h.videos.uploaded_by} · {Number(h.videos.views ?? 0).toLocaleString()} views
                  </p>
                  <p className="lib-card-meta" style={{ fontSize: 11 }}>
                    {new Date(h.watched_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;