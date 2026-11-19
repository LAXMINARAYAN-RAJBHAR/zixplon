import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import { BarChart, RankList } from "./AdminCharts";

const dayLabel = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

// Props:
//   hideZero      — same "Hide 0s visits" setting as the Visitors tab
//   installPerDay — installStats?.per_day from the Installs tab (optional)
//   countries     — [{ label, value }] top countries, built in AdminPanel from IP geo
const AdminAnalyticsTab = ({ hideZero = true, installPerDay = [], countries = [], showToast = () => {} }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async (d = days) => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("admin_analytics", { p_days: d, p_hide_zero: hideZero });
    if (error) showToast(`❌ ${error.message} (run 1_admin_upgrade.sql?)`);
    else setData(res);
    setLoading(false);
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, hideZero]);

  const visits = (data?.visits_per_day || []).map((r) => ({ label: dayLabel(r.day), value: r.visits }));
  const sessions = (data?.visits_per_day || []).map((r) => ({ label: dayLabel(r.day), value: r.sessions }));
  const signups = (data?.signups_per_day || []).map((r) => ({ label: dayLabel(r.day), value: r.signups }));
  const pages = (data?.top_pages || []).map((r) => ({ label: r.path, value: r.visits }));
  const installs = (installPerDay || []).map((r) => ({ label: dayLabel(r.day), value: r.installs })).reverse();

  return (
    <div className="admin_visitors_section">
      <div className="admin_filter_row">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`admin_filter_btn ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>
            Last {d} days
          </button>
        ))}
        <button className="admin_add_word_btn" style={{ marginLeft: "auto" }} onClick={() => load()} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {loading && !data ? (
        <div className="admin_loading"><div className="admin_spinner" /><p>Loading analytics...</p></div>
      ) : (
        <>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">Visits per day</h3>
            <BarChart data={visits} />
          </div>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">Unique sessions per day</h3>
            <BarChart data={sessions} color="#3b82f6" />
          </div>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">New signups per day</h3>
            <BarChart data={signups} color="#22c55e" emptyText="No signups in this range" />
          </div>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">Installs per day (last 30 days)</h3>
            <BarChart data={installs} color="#f97316" emptyText="Open the Installs tab once to load install data" />
          </div>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">Top entry pages</h3>
            <RankList data={pages} />
          </div>
          <div className="admin_installs_card">
            <h3 className="admin_installs_card_title">Top countries (from users' last IP)</h3>
            <RankList data={countries} emptyText="Open the Users or Logins tab once so locations can be looked up" />
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsTab;