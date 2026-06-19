import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import "../../styles/libraryPages.css";

const LikedVideos = ({ currentUser, sideNavbar }) => {
  const username              = currentUser || "";
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setVideos([]); return; }
    loadLiked();
  }, [username]);

  const loadLiked = async () => {
    setLoading(true);
    setError("");

    const { data: likeRows, error: likeErr } = await supabase
      .from("likes")
      .select("content_id")
      .eq("user_id", username)
      .eq("content_type", "video");

    if (likeErr) { setError(`Likes fetch error: ${likeErr.message}`); setLoading(false); return; }
    if (!likeRows || likeRows.length === 0) { setVideos([]); setLoading(false); return; }

    const videoIds = likeRows.map((r) => r.content_id);

    const { data, error: vidErr } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, likes, username, created_at")
      .in("id", videoIds)
      .order("created_at", { ascending: false });

    if (vidErr) { setError(`Videos fetch error: ${vidErr.message}`); setLoading(false); return; }
    if (data) setVideos(data);
    setLoading(false);
  };

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <ThumbUpIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Liked Videos</h1>
          <p className="lib-subtitle">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to see videos you've liked.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && !error && videos.length === 0 && (
        <div className="lib-empty">
          <ThumbUpIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Videos you like will appear here.</p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="lib-grid">
          {videos.map((v) => (
            <Link to={`/video/${v.id}`} key={v.id} className="lib-card">
              <div className="lib-thumb-wrap">
                <img
                  src={v.thumbnail_url || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
                  alt={v.title}
                  className="lib-thumb"
                />
              </div>
              <div className="lib-card-info">
                <p className="lib-card-title">{v.title}</p>
                <p className="lib-card-meta">{v.username} · 👍 {Number(v.likes ?? 0)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LikedVideos;