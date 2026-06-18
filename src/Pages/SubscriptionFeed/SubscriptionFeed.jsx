import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Link } from "react-router-dom";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import "../../styles/libraryPages.css";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_KEY
);

const SubscriptionFeed = () => {
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState("all");
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    loadFeed();
  }, [username]);

  const loadFeed = async () => {
    setLoading(true);

    // 1. Get subscribed channels
    const { data: subs } = await supabase
      .from("subscribers")
      .select("subscribed_to")
      .eq("subscriber_id", username);

    if (!subs || subs.length === 0) {
      setLoading(false);
      return;
    }

    const channelNames = subs.map((s) => s.subscribed_to);
    setChannels(channelNames);

    // 2. Get latest videos from those channels
    const { data, error } = await supabase
      .from("videos")
      .select("id, title, thumbnail, views, uploaded_by, created_at")
      .in("uploaded_by", channelNames)
      .order("created_at", { ascending: false })
      .limit(60);

    if (!error && data) setVideos(data);
    setLoading(false);
  };

  const formatDate = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const filtered = activeChannel === "all"
    ? videos
    : videos.filter((v) => v.uploaded_by === activeChannel);

  return (
    <div className="lib-page">
      <div className="lib-header">
        <SubscriptionsIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Subscriptions</h1>
          <p className="lib-subtitle">Latest from channels you follow</p>
        </div>
      </div>

      {!username && (
        <div className="lib-empty">
          <p>Sign in to see videos from channels you subscribe to.</p>
        </div>
      )}

      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}

      {username && !loading && channels.length === 0 && (
        <div className="lib-empty">
          <SubscriptionsIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Subscribe to channels to see their latest videos here.</p>
        </div>
      )}

      {!loading && channels.length > 0 && (
        <>
          {/* Channel filter pills */}
          <div className="lib-pills">
            <button
              className={`lib-pill ${activeChannel === "all" ? "lib-pill-active" : ""}`}
              onClick={() => setActiveChannel("all")}
            >
              All
            </button>
            {channels.map((ch) => (
              <button
                key={ch}
                className={`lib-pill ${activeChannel === ch ? "lib-pill-active" : ""}`}
                onClick={() => setActiveChannel(ch)}
              >
                {ch}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="lib-empty">
              <p>No videos from this channel yet.</p>
            </div>
          ) : (
            <div className="lib-grid">
              {filtered.map((v) => (
                <Link to={`/video/${v.id}`} key={v.id} className="lib-card">
                  <div className="lib-thumb-wrap">
                    <img src={v.thumbnail || "https://via.placeholder.com/320x180?text=No+Thumbnail"} alt={v.title} className="lib-thumb" />
                  </div>
                  <div className="lib-card-info">
                    <p className="lib-card-title">{v.title}</p>
                    <p className="lib-card-meta">
                      {v.uploaded_by} · {Number(v.views ?? 0).toLocaleString()} views · {formatDate(v.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubscriptionFeed;