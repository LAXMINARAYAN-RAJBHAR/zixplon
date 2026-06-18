import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import "../../styles/libraryPages.css";
import { supabase } from "../../config/supabase";

const LikedVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    const fetch = async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("video_id, videos(id, title, thumbnail, views, uploaded_by, created_at)")
        .eq("username", username)
        .eq("reaction_type", "like")
        .order("id", { ascending: false });

      if (!error && data) {
        setVideos(data.map((r) => r.videos).filter(Boolean));
      }
      setLoading(false);
    };
    fetch();
  }, [username]);

  return (
    <div className="lib-page">
      <div className="lib-header">
        <ThumbUpIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Liked Videos</h1>
          <p className="lib-subtitle">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {!username && (
        <div className="lib-empty">
          <p>Sign in to see videos you've liked.</p>
        </div>
      )}

      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}

      {username && !loading && videos.length === 0 && (
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
                <img src={v.thumbnail || "https://via.placeholder.com/320x180?text=No+Thumbnail"} alt={v.title} className="lib-thumb" />
              </div>
              <div className="lib-card-info">
                <p className="lib-card-title">{v.title}</p>
                <p className="lib-card-meta">{v.uploaded_by} · {Number(v.views ?? 0).toLocaleString()} views</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LikedVideos;