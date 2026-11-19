import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { logAdminAction, fmtDateTime } from "./adminHelpers";

const PAGE = 25;
const KINDS = [
  { key: "videos", label: "🎬 Videos", textCol: "title" },
  { key: "reels", label: "📱 Reels", textCol: "title" },
  { key: "posts", label: "📝 Posts", textCol: "text" },
];

// Browse and delete ANY video / reel / post, not only reported ones.
const AdminContentTab = ({ canDestroy = true, showToast = () => {} }) => {
  const [kind, setKind] = useState("videos");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const cfg = KINDS.find((k) => k.key === kind);

  const load = async () => {
    setLoading(true);
    let q = supabase.from(kind).select("*", { count: "exact" });
    if (query) q = q.or(`${cfg.textCol}.ilike.%${query.replace(/[%,()]/g, "")}%,username.ilike.%${query.replace(/[%,()]/g, "")}%`);
    const { data, count, error } = await q
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) showToast(`❌ ${error.message}`);
    else {
      setRows(data || []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, query, page]);

  const submitSearch = () => {
    setPage(0);
    setQuery(search.trim());
  };

  const remove = async (row) => {
    const label = (row[cfg.textCol] || "").toString().slice(0, 60) || `#${row.id}`;
    if (!window.confirm(`Delete this ${kind.slice(0, -1)} by @${row.username}?\n\n"${label}"\n\nThis cannot be undone.`)) return;
    const reason = window.prompt("Reason (saved in the audit log):", "") ?? "";
    setBusyId(row.id);
    const { error } = await supabase.from(kind).delete().eq("id", row.id);
    if (error) showToast(`❌ ${error.message}`);
    else {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setTotal((t) => Math.max(0, t - 1));
      logAdminAction("delete_content", "content", `${kind.slice(0, -1)}: ${label} (@${row.username})`, reason, { id: row.id });
      showToast("🗑️ Deleted");
    }
    setBusyId(null);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="admin_visitors_section">
      <div className="admin_filter_row">
        {KINDS.map((k) => (
          <button
            key={k.key}
            className={`admin_filter_btn ${kind === k.key ? "active" : ""}`}
            onClick={() => { setKind(k.key); setPage(0); }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          className="admin_word_input"
          style={{ maxWidth: 300 }}
          placeholder={`Search ${cfg.textCol} or username...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitSearch()}
        />
        <button className="admin_add_word_btn" onClick={submitSearch}>Search</button>
        <span className="admin_words_hint" style={{ alignSelf: "center" }}>{total} total</span>
      </div>

      {loading ? (
        <div className="admin_loading"><div className="admin_spinner" /><p>Loading...</p></div>
      ) : rows.length === 0 ? (
        <div className="admin_empty"><div style={{ fontSize: 48 }}>📭</div><p>Nothing found</p></div>
      ) : (
        <div className="admin_visits_table_wrap">
          <table className="admin_visits_table">
            <thead>
              <tr><th>{cfg.textCol === "title" ? "Title" : "Text"}</th><th>User</th><th>Posted</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="admin_visits_path" style={{ maxWidth: 320 }} title={r[cfg.textCol] || ""}>
                    {(r[cfg.textCol] || "—").toString().slice(0, 90)}
                  </td>
                  <td>@{r.username}</td>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>
                    {canDestroy && (
                      <button
                        className="admin_action_btn admin_action_btn--delete"
                        onClick={() => remove(r)}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? "..." : "🗑️ Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin_pager">
        <button className="admin_add_word_btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span className="admin_words_hint">Page {page + 1} of {pages}</span>
        <button className="admin_add_word_btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
};

export default AdminContentTab;