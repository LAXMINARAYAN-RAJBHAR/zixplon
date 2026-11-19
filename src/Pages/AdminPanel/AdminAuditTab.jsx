import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { fmtDateTime } from "./adminHelpers";

const PAGE = 50;

const AdminAuditTab = ({ showToast = () => {} }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [search, setSearch] = useState("");

  const load = async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : rows.length;
    const { data, error } = await supabase.rpc("admin_audit_list", { p_limit: PAGE, p_offset: offset });
    if (error) {
      showToast(`❌ ${error.message} (run 1_admin_upgrade.sql?)`);
    } else {
      setRows((prev) => (reset ? data : [...prev, ...data]));
      setMore((data || []).length === PAGE);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) =>
        [r.admin_email, r.action, r.target_label, r.reason].some((v) => (v || "").toLowerCase().includes(q)),
      )
    : rows;

  return (
    <div className="admin_visitors_section">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          className="admin_word_input"
          style={{ maxWidth: 300 }}
          placeholder="Search admin, action, target or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="admin_add_word_btn" onClick={() => load(true)} disabled={loading}>↻ Refresh</button>
      </div>

      {shown.length === 0 ? (
        <div className="admin_empty">
          <div style={{ fontSize: 48 }}>📜</div>
          <p>{loading ? "Loading..." : "No admin actions recorded yet"}</p>
        </div>
      ) : (
        <div className="admin_visits_table_wrap">
          <table className="admin_visits_table">
            <thead>
              <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td>{r.admin_email}</td>
                  <td><span className="admin_audit_action">{r.action.replace(/_/g, " ")}</span></td>
                  <td>{r.target_label || "—"}</td>
                  <td className="admin_visits_path" title={r.reason || ""}>{r.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {more && !q && (
        <div className="admin_visits_more_row">
          <button className="admin_add_word_btn" onClick={() => load(false)} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAuditTab;