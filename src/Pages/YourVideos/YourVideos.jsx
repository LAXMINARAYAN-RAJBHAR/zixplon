import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import "../../styles/libraryPages.css";

const YourVideos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    const loadVideos = async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, likes, created_at")
        .eq("username", username)
        .order("created_at", { ascending: false });
      if (!error && data) setVideos(data);
      setLoading(false);
    };
    loadVideos();
  }, [username]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="lib-page">
      <div className="lib-header">
        <SmartDisplayIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Your Videos</h1>
          <p className="lib-subtitle">{videos.length} upload{videos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to manage your videos.</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && videos.length === 0 && (
        <div className="lib-empty">
          <SmartDisplayIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>You haven't uploaded any videos yet.</p>
          <Link to="/videoUpload" className="lib-cta-btn">Upload a video</Link>
        </div>
      )}
      {!loading && videos.length > 0 && (
        <div className="lib-list">
          {videos.map((v) => (
            <Link to={`/video/${v.id}`} key={v.id} className="lib-list-item">
              <div className="lib-list-thumb-wrap">
                <img
                  src={v.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                  alt={v.title}
                  className="lib-list-thumb"
                />
              </div>
              <div className="lib-list-info">
                <p className="lib-card-title">{v.title}</p>
                <p className="lib-card-meta">{formatDate(v.created_at)}</p>
                <p className="lib-card-meta">👍 {Number(v.likes ?? 0)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default YourVideos;