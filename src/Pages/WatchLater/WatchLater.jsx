import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import WatchLaterIcon from "@mui/icons-material/WatchLater";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import "../../styles/libraryPages.css";

const WatchLater = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    loadItems();
  }, [username]);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("watch_later")
      .select("id, added_at, videos(id, title, thumbnail_url, likes, username)")
      .eq("username", username)
      .order("added_at", { ascending: false });
    if (!error && data) setItems(data.filter((i) => i.videos));
    setLoading(false);
  };

  const removeItem = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.from("watch_later").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="lib-page">
      <div className="lib-header">
        <WatchLaterIcon className="lib-header-icon" />
        <div>
          <h1 className="lib-title">Watch Later</h1>
          <p className="lib-subtitle">{items.length} saved</p>
        </div>
      </div>

      {!username && <div className="lib-empty"><p>Sign in to save videos for later.</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && items.length === 0 && (
        <div className="lib-empty">
          <WatchLaterIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>Save videos to watch them later.</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="lib-list">
          {items.map((item) => (
            <Link to={`/video/${item.videos.id}`} key={item.id} className="lib-list-item">
              <div className="lib-list-thumb-wrap">
                <img
                  src={item.videos.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                  alt={item.videos.title}
                  className="lib-list-thumb"
                />
              </div>
              <div className="lib-list-info">
                <p className="lib-card-title">{item.videos.title}</p>
                <p className="lib-card-meta">{item.videos.username}</p>
              </div>
              <button className="lib-remove-btn" onClick={(e) => removeItem(item.id, e)} title="Remove">
                <DeleteOutlineIcon />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchLater;