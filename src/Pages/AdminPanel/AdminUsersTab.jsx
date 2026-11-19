import React, { useMemo, useState } from "react";

const PAGE = 25;

// Replaces the whole Users tab body.
// Props:
//   rows, loading, onRefresh
//   isUserOnline(u), geoLabelFor(ip), exportLocation(ip)
//   rootEmails            — ADMIN_EMAILS (protected from every action)
//   canDestroy            — false for moderators (actions hidden)
//   moderatingId, removeContentMap, toggleRemoveContent(id)
//   onBan(user, reason), onUnban(user), onDelete(user)
//   onBulkBan(users, reason), onBulkUnban(users)
//   onOpenDetail(user)
const AdminUsersTab = ({
  rows, loading, onRefresh, isUserOnline, geoLabelFor, exportLocation, rootEmails, canDestroy,
  moderatingId, removeContentMap, toggleRemoveContent, onBan, onUnban, onDelete,
  onBulkBan, onBulkUnban, onOpenDetail,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const isRoot = (u) => rootEmails.includes((u.email || "").toLowerCase());

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (filter === "online" && !isUserOnline(u)) return false;
      if (filter === "banned" && !u.is_banned) return false;
      if (!q) return true;
      return (
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        exportLocation(u.last_ip).toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter, isUserOnline, exportLocation]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = list.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const onlineCount = rows.filter(isUserOnline).length;

  const selectable = slice.filter((u) => !isRoot(u));
  const allOnPageSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const selectedUsers = rows.filter((u) => selected.has(u.id) && !isRoot(u));

  const toggle = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      selectable.forEach((u) => (allOnPageSelected ? n.delete(u.id) : n.add(u.id)));
      return n;
    });

  const askReason = (what) => {
    const r = window.prompt(`Reason for ${what} (saved in the audit log, optional):`, "");
    return r === null ? null : r.trim(); // null = cancelled
  };

  const runBulk = async (kind) => {
    const targets = selectedUsers.filter((u) => (kind === "ban" ? !u.is_banned : u.is_banned));
    if (!targets.length) return;
    setBulkBusy(true);
    if (kind === "ban") {
      const reason = askReason(`banning ${targets.length} users`);
      if (reason !== null) await onBulkBan(targets, reason);
    } else {
      await onBulkUnban(targets);
    }
    setSelected(new Set());
    setBulkBusy(false);
  };

  const banOne = (u) => {
    const reason = askReason(`banning ${u.username ? "@" + u.username : u.email}`);
    if (reason !== null) onBan(u, reason);
  };

  if (loading) {
    return <div className="admin_loading"><div className="admin_spinner" /><p>Loading users...</p></div>;
  }

  return (
    <div className="admin_users_mgmt_section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <input
          type="text"
          className="admin_word_input"
          style={{ maxWidth: 280 }}
          placeholder="Search by username, email or location..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
        <span className="admin_words_hint admin_users_online_summary" style={{ margin: 0 }}>
          🟢 {onlineCount} online · {rows.length} total
        </span>
        <button className="admin_add_word_btn" onClick={onRefresh}>↻ Refresh</button>
      </div>

      <div className="admin_filter_row">
        {[["all", "All"], ["online", "Online"], ["banned", "Banned"]].map(([k, l]) => (
          <button key={k} className={`admin_filter_btn ${filter === k ? "active" : ""}`} onClick={() => { setFilter(k); setPage(0); }}>
            {l}
          </button>
        ))}
        {canDestroy && selectable.length > 0 && (
          <label className="admin_user_remove_content_label" style={{ marginLeft: "auto" }}>
            <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} />
            select page
          </label>
        )}
      </div>

      {canDestroy && selectedUsers.length > 0 && (
        <div className="admin_bulk_bar">
          <strong>{selectedUsers.length} selected</strong>
          <button className="admin_action_btn admin_action_btn--delete" disabled={bulkBusy} onClick={() => runBulk("ban")}>
            {bulkBusy ? "..." : "🚫 Ban selected"}
          </button>
          <button className="admin_action_btn admin_action_btn--dismiss" disabled={bulkBusy} onClick={() => runBulk("unban")}>
            ✓ Unban selected
          </button>
          <button className="admin_action_btn" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="admin_empty"><div style={{ fontSize: 48 }}>👥</div><p>No users found</p></div>
      ) : (
        <div className="admin_users_mgmt_list">
          {slice.map((u, i) => {
            const root = isRoot(u);
            const busy = moderatingId === u.id;
            const online = isUserOnline(u);
            return (
              <div key={u.id} className="admin_user_mgmt_row">
                <div className="admin_user_mgmt_left">
                  {canDestroy && (
                    <input type="checkbox" disabled={root} checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                  )}
                  <div className="admin_user_serial">{safePage * PAGE + i + 1}</div>
                  <div className="admin_user_mgmt_info">
                    <div className="admin_user_mgmt_name">
                      <button className="admin_name_link" onClick={() => onOpenDetail(u)} title="Open user details">
                        {u.username ? `@${u.username}` : u.email}
                      </button>
                      {root && <span className="admin_admin_root_badge">ROOT</span>}
                      {u.is_banned && <span className="admin_user_banned_badge">BANNED</span>}
                      <span className={`admin_user_status ${online ? "online" : "offline"}`}>
                        <span className="admin_user_status_dot" />{online ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className="admin_admin_meta">
                      {u.email} · {(u.providers || []).join(", ")}
                      {u.last_sign_in_at ? ` · last login ${new Date(u.last_sign_in_at).toLocaleDateString("en-IN")}` : " · never logged in"}
                    </div>
                    <div className="admin_admin_meta admin_user_location" title={u.last_ip ? `IP: ${u.last_ip}` : "No IP recorded"}>
                      📍 {geoLabelFor(u.last_ip)}
                    </div>
                  </div>
                </div>

                {canDestroy && !root && (
                  <div className="admin_user_mgmt_actions">
                    <label className="admin_user_remove_content_label">
                      <input type="checkbox" checked={!!removeContentMap[u.id]} onChange={() => toggleRemoveContent(u.id)} disabled={busy} />
                      also delete their content
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {u.is_banned ? (
                        <button className="admin_action_btn admin_action_btn--dismiss" onClick={() => onUnban(u)} disabled={busy}>
                          {busy ? "..." : "✓ Unban"}
                        </button>
                      ) : (
                        <button className="admin_action_btn admin_action_btn--delete" onClick={() => banOne(u)} disabled={busy}>
                          {busy ? "..." : "🚫 Ban"}
                        </button>
                      )}
                      <button className="admin_action_btn admin_action_btn--delete" onClick={() => onDelete(u)} disabled={busy}>
                        {busy ? "..." : "🗑️ Delete Account"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="admin_pager">
        <button className="admin_add_word_btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</button>
        <span className="admin_words_hint">{list.length} users · page {safePage + 1} of {pages}</span>
        <button className="admin_add_word_btn" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Next →</button>
      </div>
    </div>
  );
};

export default AdminUsersTab;