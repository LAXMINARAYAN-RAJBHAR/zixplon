import React, { useMemo, useState } from "react";

const PAGE = 50;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "online", label: "Online" },
  { key: "banned", label: "Banned" },
  { key: "never", label: "Never logged in" },
];
const SORTS = [
  { key: "recent", label: "Latest login" },
  { key: "oldest", label: "Oldest login" },
  { key: "name", label: "Username A–Z" },
  { key: "created", label: "Newest account" },
];

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

// Replaces the table inside the Logins tab (keep your hint paragraph + Refresh button).
const AdminLoginsTable = ({ rows, isUserOnline, geoLabelFor, exportLocation }) => {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (filter === "online" && !isUserOnline(r)) return false;
      if (filter === "banned" && !r.is_banned) return false;
      if (filter === "never" && r.last_sign_in_at) return false;
      if (!q) return true;
      return [r.username, r.email, (r.providers || []).join(" "), r.last_ip, exportLocation(r.last_ip)]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
    const t = (v) => (v ? new Date(v).getTime() : 0);
    out = [...out].sort((a, b) => {
      if (sort === "oldest") return t(a.last_sign_in_at) - t(b.last_sign_in_at);
      if (sort === "name") return (a.username || a.email || "").localeCompare(b.username || b.email || "");
      if (sort === "created") return t(b.created_at) - t(a.created_at);
      return t(b.last_sign_in_at) - t(a.last_sign_in_at);
    });
    return out;
  }, [rows, filter, sort, search, isUserOnline, exportLocation]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const slice = list.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <>
      <div className="admin_filter_row">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`admin_filter_btn ${filter === f.key ? "active" : ""}`}
            onClick={() => { setFilter(f.key); setPage(0); }}
          >
            {f.label}
          </button>
        ))}
        <select
          className="admin_hub_audience_select"
          style={{ marginLeft: "auto" }}
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(0); }}
        >
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <input
        className="admin_word_input"
        style={{ marginBottom: 12 }}
        placeholder="Search username, email, method, IP or location..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
      />

      {list.length === 0 ? (
        <div className="admin_empty"><div style={{ fontSize: 48 }}>🔐</div><p>No matching logins</p></div>
      ) : (
        <div className="admin_visits_table_wrap">
          <table className="admin_visits_table">
            <thead>
              <tr>
                <th>#</th><th>User</th><th>Status</th><th>Login Method</th>
                <th>Last Login</th><th>Last IP</th><th>Location</th><th>Last Device</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const online = isUserOnline(r);
                return (
                  <tr key={r.id}>
                    <td><span className="admin_user_serial">{list.length - (safePage * PAGE + i)}</span></td>
                    <td>{r.username ? `@${r.username}` : r.email}{r.is_banned && <span className="admin_user_banned_badge" style={{ marginLeft: 6 }}>BANNED</span>}</td>
                    <td>
                      <span className={`admin_user_status ${online ? "online" : "offline"}`}>
                        <span className="admin_user_status_dot" />{online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td>{(r.providers || []).join(", ")}</td>
                    <td>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-IN") : "Never"}</td>
                    <td>{r.last_ip || "—"}</td>
                    <td className="admin_user_location_cell" title={r.last_ip ? `IP: ${r.last_ip}` : ""}>{geoLabelFor(r.last_ip)}</td>
                    <td className="admin_visits_path" title={r.last_device || ""}>{truncate(r.last_device, 40) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin_pager">
        <button className="admin_add_word_btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</button>
        <span className="admin_words_hint">{list.length} users · page {safePage + 1} of {pages}</span>
        <button className="admin_add_word_btn" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Next →</button>
      </div>
    </>
  );
};

export default AdminLoginsTable;