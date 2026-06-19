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
  const username                    = currentUser || "";
  const [playlists, setPlaylists]   = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [newTitle, setNewTitle]     = useState("");
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!username) { setLoading(false); setPlaylists([]); return; }
    loadPlaylists();
  }, [username]);

  const loadPlaylists = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("playlists")
      .select("id, title, description, created_at")
      .eq("username", username)
      .order("created_at", { ascending: false });
    if (err) { setError(`Playlists fetch error: ${err.message}`); }
    else if (data) setPlaylists(data);
    setLoading(false);
  };

  const openPlaylist = async (pl) => {
    // ── Step 1: fetch playlist_items rows ──────────────────────────────
    const { data: itemRows, error: itemErr } = await supabase
      .from("playlist_items")
      .select("id, added_at, video_id")
      .eq("playlist_id", pl.id)
      .order("added_at", { ascending: false });

    if (itemErr || !itemRows || itemRows.length === 0) {
      setSelected({ playlist: pl, items: [] });
      return;
    }

    // ── Step 2: fetch matching videos ───────────────────────────────────
    const videoIds = itemRows.map((r) => r.video_id);
    const { data: videoRows } = await supabase
      .from("videos")
      .select("id, title, thumbnail_url, username")
      .in("id", videoIds);

    const videoMap = {};
    (videoRows || []).forEach((v) => { videoMap[v.id] = v; });

    const items = itemRows
      .filter((r) => videoMap[r.video_id])
      .map((r) => ({ ...r, video: videoMap[r.video_id] }));

    setSelected({ playlist: pl, items });
  };

  const createPlaylist = async () => {
    if (!newTitle.trim()) return;
    const { data, error: err } = await supabase
      .from("playlists")
      .insert({ username, title: newTitle.trim() })
      .select()
      .single();
    if (!err && data) {
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

  // ── Detail view ─────────────────────────────────────────────────────────
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
                <Link to={`/video/${item.video.id}`} className="lib-list-inner">
                  <div className="lib-list-thumb-wrap">
                    <img
                      src={item.video.thumbnail_url || "https://via.placeholder.com/160x90?text=No+Thumbnail"}
                      alt={item.video.title}
                      className="lib-list-thumb"
                    />
                  </div>
                  <div className="lib-list-info">
                    <p className="lib-card-title">{item.video.title}</p>
                    <p className="lib-card-meta">{item.video.username}</p>
                  </div>
                </Link>
                <button className="lib-remove-btn" onClick={() => removeFromPlaylist(item.id)}>
                  <DeleteOutlineIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────
  return (
    <div className={`lib-page ${sideNavbar ? "" : "sidebar-collapsed"}`}>
      <div className="lib-header">
        <PlaylistAddIcon className="lib-header-icon" />
        <div style={{ flex: 1 }}>
          <h1 className="lib-title">Playlists</h1>
          <p className="lib-subtitle">{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</p>
        </div>
        {username && (
          <button className="lib-cta-btn" onClick={() => setCreating(true)}>
            <AddIcon style={{ fontSize: 18 }} /> New
          </button>
        )}
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
          <button className="lib-remove-btn" onClick={() => { setCreating(false); setNewTitle(""); }}>
            <CloseIcon />
          </button>
        </div>
      )}

      {!username && <div className="lib-empty"><p>Sign in to create and manage playlists.</p></div>}
      {error      && <div className="lib-empty" style={{ color: "#ef4444" }}><p>{error}</p></div>}
      {username && loading && <div className="lib-loading"><div className="lib-spinner" /></div>}
      {username && !loading && !error && playlists.length === 0 && !creating && (
        <div className="lib-empty">
          <PlaylistAddIcon style={{ fontSize: 48, opacity: 0.3 }} />
          <p>No playlists yet. Create one to get started.</p>
        </div>
      )}

      {!loading && playlists.length > 0 && (
        <div className="lib-pl-grid">
          {playlists.map((pl) => (
            <div key={pl.id} className="lib-pl-card" onClick={() => openPlaylist(pl)}>
              <div className="lib-pl-icon-wrap">
                <PlaylistPlayIcon style={{ fontSize: 36, color: "var(--zx-primary)" }} />
              </div>
              <div className="lib-pl-info">
                <p className="lib-card-title">{pl.title}</p>
                {pl.description && <p className="lib-card-meta">{pl.description}</p>}
              </div>
              <button className="lib-remove-btn" onClick={(e) => deletePlaylist(pl.id, e)}>
                <DeleteOutlineIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Playlist;