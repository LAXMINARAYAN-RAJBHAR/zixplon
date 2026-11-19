import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { fmtDateTime } from "./adminHelpers";

// One place for everything about a user: account info, content counts,
// recent uploads, reports filed against them, and their ban reason.
// Props: user (row from /api/user-login-info), locationLabel, onClose
const AdminUserDetail = ({ user, locationLabel = "—", onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const uname = user.username;
    const count = (table, col = "username", val = uname) =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq(col, val);

    (async () => {
      if (!uname) {
        if (active) { setData({}); setLoading(false); }
        return;
      }
      const [videos, reels, posts, comments, againstCount, againstRows, filedCount, recent, ban] =
        await Promise.all([
          count("videos"),
          count("reels"),
          count("posts"),
          count("post_comments"),
          count("reports", "content_owner"),
          supabase.from("reports").select("id,reason,status,content_title,created_at")
            .eq("content_owner", uname).order("created_at", { ascending: false }).limit(10),
          count("reports", "reporter_username"),
          supabase.from("videos").select("id,title,created_at").eq("username", uname)
            .order("created_at", { ascending: false }).limit(5),
          user.id ? supabase.rpc("admin_ban_list") : Promise.resolve({ data: [] }),
        ]);
      if (!active) return;
      setData({
        videos: videos.count ?? 0,
        reels: reels.count ?? 0,
        posts: posts.count ?? 0,
        comments: comments.count ?? 0,
        against: againstCount.count ?? 0,
        filed: filedCount.count ?? 0,
        reports: againstRows.data || [],
        recent: recent.data || [],
        ban: (ban.data || []).find((b) => b.user_id === user.id) || null,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user.id, user.username]);

  const stat = (label, value) => (
    <div className="admin_stat_card" key={label}>
      <div className="admin_stat_value" style={{ fontSize: 22 }}>{value}</div>
      <div className="admin_stat_label">{label}</div>
    </div>
  );

  return (
    <div className="admin_modal_backdrop" onClick={onClose}>
      <div className="admin_modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin_modal_head">
          <div>
            <div className="admin_user_mgmt_name">{user.username ? `@${user.username}` : user.email}</div>
            <div className="admin_admin_meta">{user.email}</div>
          </div>
          <button className="admin_word_remove" style={{ fontSize: 24 }} onClick={onClose} title="Close">×</button>
        </div>

        <div className="admin_admin_meta" style={{ margin: "6px 0 12px", lineHeight: 1.7 }}>
          Login: {(user.providers || []).join(", ") || "—"}<br />
          Last login: {fmtDateTime(user.last_sign_in_at)}<br />
          Created: {fmtDateTime(user.created_at)}<br />
          IP: {user.last_ip || "—"} · 📍 {locationLabel}<br />
          Device: {user.last_device || "—"}
        </div>

        {user.is_banned && (
          <div className="admin_ban_note">
            🚫 Banned{data?.ban?.banned_at ? ` on ${fmtDateTime(data.ban.banned_at)}` : ""}
            {data?.ban?.banned_by ? ` by ${data.ban.banned_by}` : ""}
            {data?.ban?.reason ? ` — reason: ${data.ban.reason}` : " — no reason recorded"}
          </div>
        )}

        {loading ? (
          <div className="admin_loading" style={{ padding: 24 }}><div className="admin_spinner" /></div>
        ) : !user.username ? (
          <p className="admin_words_hint">This account has no username yet, so there is no activity to show.</p>
        ) : (
          <>
            <div className="admin_stats" style={{ marginBottom: 14 }}>
              {stat("Videos", data.videos)}
              {stat("Reels", data.reels)}
              {stat("Posts", data.posts)}
              {stat("Comments", data.comments)}
              {stat("Reports against", data.against)}
              {stat("Reports filed", data.filed)}
            </div>

            <h4 className="admin_installs_card_title">Reports against this user</h4>
            {data.reports.length === 0 ? (
              <p className="admin_words_hint">None</p>
            ) : (
              data.reports.map((r) => (
                <div key={r.id} className="admin_admin_meta" style={{ marginBottom: 4 }}>
                  {fmtDateTime(r.created_at)} · {r.reason} · <strong>{r.status}</strong> · “{(r.content_title || "").slice(0, 50)}”
                </div>
              ))
            )}

            <h4 className="admin_installs_card_title" style={{ marginTop: 14 }}>Latest videos</h4>
            {data.recent.length === 0 ? (
              <p className="admin_words_hint">None</p>
            ) : (
              data.recent.map((v) => (
                <div key={v.id} className="admin_admin_meta" style={{ marginBottom: 4 }}>
                  {fmtDateTime(v.created_at)} · {(v.title || "").slice(0, 60)}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetail;