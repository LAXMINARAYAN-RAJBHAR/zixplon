import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import PlaylistPlayIcon from "@mui/icons-material/PlaylistPlay";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import "../../styles/libraryPages.css";

const Playlist = ({ currentUser, sideNavbar }) => {
  const username = currentUser || "";
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setPlaylists([]); return; }
    loadPlaylists();
  }, [username]);

  const loadPlaylists = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("playlists")
      .select("id, title, description, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false });
    if (!error && data) setPlaylists(data);
    setLoading(false);
  };

  const openPlaylist = async (pl) => {
    const { data } = await supabase
      .from("playlist_items")
      .select("id, added_at, videos(id, title, thumbnail_url, username)")
      .eq("playlist_id", pl.id)
      .order("added_at", { ascending: false });
    setSelected({ playlist: pl, items: (data || []).filter((i) => i.videos) });
  };

  const createPlaylist = async () => {
    if (!newTitle.trim()) return;
    const { data, error } = await supabase
      .from("playlists")
      .insert({ username, title: newTitle.trim() })
      .select()
      .single();
    if (!error && data) {
      setPlaylists((prev) => [data, ...prev]);
      setNewTitle("");
      setCreating(false);
    }
  };

  const deletePlaylist = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this playlist?")) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selected?.playlist?.id === id) setSelected(null);
  };

  const removeFromPlaylist = async (itemId) => {
    await supabase.from("playlist_items").delete().eq("id", itemId);
    setSelected((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== itemId) }));
  };

  if (selected) {
    return (
      <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
        <div className="lib-header">
          <button className="lib-back-btn" onClick={() => setSelected(null)}>← Back</button>
          <PlaylistPlayIcon className="lib-header-icon" />
          <div>
            <h1 className="lib-title">{selected.playlist.title}</h1>
            <p className="lib-subtitle">{selected.items.length} video{selected.items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {selected.items.length === 0 ? (
          <div className="lib-empty">
            <PlaylistPlayIcon style={{ fontSize: 48, opacity: 0.3 }} />
            <p>This playlist is empty.</p>
          </div>
        ) : (
          <div className="lib-list">
            {selected.items.map((item, idx) => (
              <div key={item.id} className="lib-list-item">
                <span className="lib-list-index">{idx + 1}</span>
                <Link to={`/video/${item.videos.id}`} className="lib-list-inner">
                  <div className="lib-list-thumb-wrap">
                    <img src={item.videos.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"} alt={item.videos.title} className="lib-list-thumb" />
                  </div>
                  <div className="lib-list-info">
                    <p className="lib-card-title">{item.videos.title}</p>
                    <p className="lib-card-meta">{item.videos.username}</p>
                  </div>
                </Link>
                <button className="lib-remove-btn" onClick={() => removeFromPlaylist(item.id)}><DeleteOutlineIcon /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <PlaylistAddIcon className="lib-header-icon" />
        <div style={{ flex: 1 }}>
          <h1 className="lib-title">Playlists</h1>
          <p className="lib-subtitle">{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</p>
        </div>
        {username && <button className="lib-cta-btn" onClick={() => setCreating(true)}><AddIcon style={{ fontSize: 18 }} /> New</button>}
      </div>

      {creating && (
        <div className="lib-create-box">
          <input
            className="lib-input"
            placeholder="Playlist name..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
            autoFocus
          />
          <button className="lib-cta-btn" onClick={createPlaylist}>Create</button>
          <button className="lib-remove-btn" onClick={() => { setCreating(false); setNewTitle(""); }}><CloseIcon /></button>
        </div>
      )}

      {!username && <div className="lib-empty"><p>Sign in to create and manage playlists.</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && playlists.length === 0 && !creating && (
        <div className="lib-empty">
          <PlaylistAddIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>No playlists yet. Create one to get started.</p>
        </div>
      )}
      {!loading && playlists.length > 0 && (
        <div className="lib-pl-grid">
          {playlists.map((pl) => (
            <div key={pl.id} className="lib-pl-card" onClick={() => openPlaylist(pl)}>
              <div className="lib-pl-icon-wrap"><PlaylistPlayIcon style={{ fontSize: 36, color: "var(--zx-primary)" }} /></div>
              <div className="lib-pl-info">
                <p className="lib-card-title">{pl.title}</p>
                {pl.description && <p className="lib-card-meta">{pl.description}</p>}
              </div>
              <button className="lib-remove-btn" onClick={(e) => deletePlaylist(pl.id, e)}><DeleteOutlineIcon /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Playlist;