import React, { useMemo, useState } from "react";

const STATUS_COLORS = {
  pending: { bg: "#fff7ed", color: "#f97316", border: "#fed7aa" },
  reviewed: { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" },
  removed: { bg: "#fef2f2", color: "#ef4444", border: "#fecaca" },
  dismissed: { bg: "#f0fdf4", color: "#22c55e", border: "#bbf7d0" },
};

const REASON_LABELS = {
  inappropriate: "🔞 Inappropriate", spam: "📢 Spam", hate_speech: "🚫 Hate Speech",
  violence: "⚠️ Violence", misinformation: "❌ Misinformation", copyright: "©️ Copyright",
  harassment: "😡 Harassment", child_safety: "🛡️ Child Safety", other: "📝 Other",
};

const PAGE = 15;
const isOpen = (r) => r.status === "pending" || r.status === "reviewed";

// Replaces the whole "reports" tab body (filter row + list).
// Reports on the same content are merged into ONE card with a count.
//
// Props:
//   reports, filterStatus, setFilterStatus
//   actionLoading            — string key from AdminPanel
//   canDestroy               — false for moderators (hides delete/ban)
//   onPreview(report)
//   onDeleteGroup(group)     — group = { reports, first }
//   onSetStatusGroup(group, status)
//   onBanUploader(report)
const AdminReportsPanel = ({
  reports, filterStatus, setFilterStatus, actionLoading, canDestroy,
  onPreview, onDeleteGroup, onSetStatusGroup, onBanUploader,
}) => {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE);

  // owner -> { total, removed }  (repeat-offender info)
  const offenders = useMemo(() => {
    const m = {};
    reports.forEach((r) => {
      const o = r.content_owner;
      if (!o) return;
      m[o] = m[o] || { total: 0, removed: 0 };
      m[o].total += 1;
      if (r.status === "removed") m[o].removed += 1;
    });
    return m;
  }, [reports]);

  const groups = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      const key = `${r.content_type}:${r.content_id}`;
      if (!map.has(key)) map.set(key, { key, reports: [] });
      map.get(key).reports.push(r);
    });
    const q = search.trim().toLowerCase();
    return [...map.values()]
      .map((g) => ({ ...g, first: g.reports.find(isOpen) || g.reports[0] })) // newest open report leads
      .filter((g) => filterStatus === "all" || g.reports.some((r) => r.status === filterStatus))
      .filter((g) =>
        !q ||
        g.reports.some((r) =>
          [r.content_title, r.content_owner, r.reporter_username, r.details]
            .some((v) => (v || "").toLowerCase().includes(q)),
        ),
      );
  }, [reports, filterStatus, search]);

  const shown = groups.slice(0, visible);

  return (
    <>
      <div className="admin_filter_row">
        {["all", "pending", "reviewed", "removed", "dismissed"].map((s) => (
          <button
            key={s}
            className={`admin_filter_btn ${filterStatus === s ? "active" : ""}`}
            onClick={() => { setFilterStatus(s); setVisible(PAGE); }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && <span className="admin_filter_count">{reports.filter((r) => r.status === s).length}</span>}
          </button>
        ))}
      </div>

      <input
        className="admin_word_input"
        style={{ marginBottom: 14 }}
        placeholder="Search by content title, uploader, reporter or details..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setVisible(PAGE); }}
      />

      {groups.length === 0 ? (
        <div className="admin_empty">
          <div style={{ fontSize: 48 }}>✅</div>
          <p>No {filterStatus === "all" ? "" : filterStatus} reports{search ? " match your search" : ""}</p>
        </div>
      ) : (
        <div className="admin_reports_list">
          {shown.map((g) => {
            const r = g.first;
            const open = g.reports.filter(isOpen);
            const status = open.length ? (open.some((x) => x.status === "pending") ? "pending" : "reviewed") : r.status;
            const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
            const off = offenders[r.content_owner];
            const reasons = [...new Set(g.reports.map((x) => REASON_LABELS[x.reason] || x.reason))];
            const busy = !!actionLoading;
            return (
              <div key={g.key} className="admin_report_card">
                <div className="admin_report_header">
                  <div className="admin_report_meta">
                    <span className="admin_report_type">{r.content_type.toUpperCase()}</span>
                    {g.reports.length > 1 && (
                      <span className="admin_report_count">{g.reports.length} reports</span>
                    )}
                    <span className="admin_report_reason">{reasons.join(" · ")}</span>
                    <span className="admin_report_status" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {status}
                    </span>
                  </div>
                  <span className="admin_report_time">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="admin_report_content">
                  <div className="admin_report_field">
                    <span className="admin_report_field_label">Content</span>
                    <span className="admin_report_field_value">"{r.content_title}"</span>
                  </div>
                  <div className="admin_report_field">
                    <span className="admin_report_field_label">Uploader</span>
                    <span className="admin_report_field_value">
                      @{r.content_owner}
                      {off && off.total > 1 && (
                        <span className="admin_offender_badge" title="All reports ever filed against this uploader">
                          {off.total} reports total · {off.removed} removed
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="admin_report_field">
                    <span className="admin_report_field_label">Reported by</span>
                    <span className="admin_report_field_value">
                      {[...new Set(g.reports.map((x) => `@${x.reporter_username}`))].join(", ")}
                    </span>
                  </div>
                  {g.reports.filter((x) => x.details).slice(0, 3).map((x) => (
                    <div key={x.id} className="admin_report_field">
                      <span className="admin_report_field_label">Details</span>
                      <span className="admin_report_field_value admin_report_details">{x.details}</span>
                    </div>
                  ))}
                  {r.admin_note && (
                    <div className="admin_report_field">
                      <span className="admin_report_field_label">Admin note</span>
                      <span className="admin_report_field_value" style={{ color: "#7c3aed", fontWeight: 700 }}>{r.admin_note}</span>
                    </div>
                  )}
                </div>

                {open.length > 0 && (
                  <div className="admin_report_actions">
                    <button className="admin_action_btn admin_action_btn--view" onClick={() => onPreview(r)}>▶ View Content</button>
                    {canDestroy && (
                      <>
                        <button className="admin_action_btn admin_action_btn--delete" onClick={() => onDeleteGroup(g)} disabled={busy}>
                          {actionLoading === r.id + "delete" ? "Deleting..." : "🗑️ Delete Content"}
                        </button>
                        <button className="admin_action_btn admin_action_btn--delete" onClick={() => onBanUploader(r)} disabled={busy}>
                          {actionLoading === r.id + "ban" ? "Banning..." : "🚫 Ban Uploader"}
                        </button>
                      </>
                    )}
                    <button className="admin_action_btn admin_action_btn--dismiss" onClick={() => onSetStatusGroup(g, "dismissed")} disabled={busy}>
                      {g.reports.length > 1 ? `✓ Dismiss all ${open.length}` : "✓ Dismiss"}
                    </button>
                    {status === "pending" && (
                      <button className="admin_action_btn admin_action_btn--review" onClick={() => onSetStatusGroup(g, "reviewed")} disabled={busy}>
                        👁 Mark Reviewed
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {groups.length > visible && (
        <div className="admin_visits_more_row">
          <button className="admin_add_word_btn" onClick={() => setVisible((v) => v + PAGE)}>
            Show more ({groups.length - visible} remaining)
          </button>
        </div>
      )}
    </>
  );
};

export default AdminReportsPanel;