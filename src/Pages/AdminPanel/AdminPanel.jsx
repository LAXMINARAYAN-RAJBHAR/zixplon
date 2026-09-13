import React, { useState, useEffect } from "react";
import "./AdminPanel.css";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
// NEW: SheetJS — generates the .xlsx workbook entirely client-side and
// triggers a browser download via XLSX.writeFile. Requires the "xlsx"
// package to be installed: `npm install xlsx`.
import * as XLSX from "xlsx";
// NEW: jsPDF + jspdf-autotable — generates the .pdf report entirely
// client-side. Requires both packages installed:
// `npm install jspdf jspdf-autotable`
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// RENAMED from ADMIN_USERNAMES — the check below has only ever compared
// against an email address, never a username, so the old name was
// misleading about what actually gates access here.
// ── Change this to your admin email address(es) ────────────────────────────
const ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

const STATUS_COLORS = {
  pending:   { bg: "#fff7ed", color: "#f97316", border: "#fed7aa" },
  reviewed:  { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" },
  removed:   { bg: "#fef2f2", color: "#ef4444", border: "#fecaca" },
  dismissed: { bg: "#f0fdf4", color: "#22c55e", border: "#bbf7d0" },
};

const REASON_LABELS = {
  inappropriate:  "🔞 Inappropriate",
  spam:           "📢 Spam",
  hate_speech:    "🚫 Hate Speech",
  violence:       "⚠️ Violence",
  misinformation: "❌ Misinformation",
  copyright:      "©️ Copyright",
  harassment:     "😡 Harassment",
  child_safety:   "🛡️ Child Safety",
  other:          "📝 Other",
};

// NEW: truncates long free-text fields (post text, comment text) so a
// single row never blows out a table's column width in either export.
const truncate = (str, max = 80) => {
  if (!str) return "";
  const s = String(str);
  return s.length > max ? s.slice(0, max) + "…" : s;
};

// NEW: formats a duration in seconds as "Xh Ym" / "Xm Ys" / "Xs" for
// the Visitors tab. Durations here come from last_active_at -
// started_at on a site_visits row (see useVisitTracking.js) — accurate
// to within one heartbeat interval (20s), not to the exact second.
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

const AdminPanel = () => {
  const currentUser = localStorage.getItem("username") || "";

  // ── FIX: admin check no longer trusts localStorage("email") alone.
  // Profile.js's own PATH 2 (Supabase auth-session login, as opposed to
  // the localStorage-cache login path) never calls
  // localStorage.setItem("email", ...) — it only persists username/
  // channelName/profilePic/about. An admin who authenticated through
  // that path would have an empty localStorage "email" and get bounced
  // to "Access Denied" with no indication why. We now also check the
  // live Supabase session's email (the same source Profile.js's PATH 2
  // itself reads from), and gate rendering on that check completing so
  // we don't flash "Access Denied" before it resolves.
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail,   setAuthEmail]   = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser()
      .then(({ data }) => {
        if (!active) return;
        setAuthEmail((data?.user?.email || "").trim().toLowerCase());
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const localEmail = (localStorage.getItem("email") || "").trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(localEmail) || ADMIN_EMAILS.includes(authEmail);

  const [reports,       setReports]       = useState([]);
  const [bannedWords,   setBannedWords]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState("reports");
  const [filterStatus,  setFilterStatus]  = useState("pending");
  const [newWord,       setNewWord]       = useState("");
  const [wordSaving,    setWordSaving]    = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast,         setToast]         = useState("");
  // NEW: separate loading flags for each export button, so exporting to
  // Excel doesn't grey out the PDF button (and vice versa) — each kicks
  // off its own independent data fetch + file generation.
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf,   setExportingPdf]   = useState(false);
  // NEW: "Visitors" tab data — populated lazily the first time that tab
  // is opened (see the activeTab effect below), not on initial mount,
  // since site_visits can grow large and most admin visits won't need it.
  const [visits,        setVisits]        = useState([]);
  const [visitsLoading, setVisitsLoading]  = useState(false);
  const [visitsLoaded,  setVisitsLoaded]   = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReports(data);
  };

  const fetchBannedWords = async () => {
    const { data } = await supabase
      .from("banned_words")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setBannedWords(data);
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([fetchReports(), fetchBannedWords()]).finally(() => setLoading(false));

    // Realtime for new reports
    const channel = supabase
      .channel("admin-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
        fetchReports();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin]);

  // ── Report actions ──────────────────────────────────────────────────────────
  const updateReportStatus = async (reportId, status, adminNote = "") => {
    setActionLoading(reportId + status);
    const { error } = await supabase
      .from("reports")
      .update({ status, admin_note: adminNote || null, reviewed_at: new Date().toISOString() })
      .eq("id", reportId);
    if (!error) {
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status, admin_note: adminNote } : r));
      showToast(`Report marked as ${status}`);
    }
    setActionLoading(null);
  };

  // Deletes the underlying reported content and closes the report.
  // "message" reports are handled separately from video/reel/post
  // reports: those live in direct_messages (not videos/reels/posts), and
  // getting soft-deleted (deleted_at + fields cleared) rather than a hard
  // row delete, matching MessagesPanel's own deleteMessage() behavior.
  // Without this explicit branch, a message report's content_type
  // ("message") would fall through to the `: "posts"` default below and
  // attempt to delete a row from the posts table using a message's id —
  // silently touching the wrong table.
  const deleteContent = async (report) => {
    setActionLoading(report.id + "delete");
    try {
      if (report.content_type === "message") {
        const { error } = await supabase
          .from("direct_messages")
          .update({
            deleted_at: new Date().toISOString(),
            text: null,
            attachment_url: null,
            attachment_type: null,
            attachment_name: null,
            attachment_size: null,
            reactions: {},
          })
          .eq("id", report.content_id);
        if (error) throw error;
        await updateReportStatus(report.id, "removed", "Message deleted by admin");
        showToast(`✅ Message deleted and report closed`);
        setActionLoading(null);
        return;
      }

      const table = report.content_type === "reel" ? "reels"
        : report.content_type === "video" ? "videos"
        : "posts";

      // Strip db_ prefix for reels
      const rawId = String(report.content_id).replace("db_", "");
      await supabase.from(table).delete().eq("id", rawId);
      await updateReportStatus(report.id, "removed", "Content deleted by admin");
      showToast(`✅ Content deleted and report closed`);
    } catch (e) {
      showToast("❌ Failed to delete content");
    }
    setActionLoading(null);
  };

  // ── Banned words actions ────────────────────────────────────────────────────
  // FIX: this previously pushed a fake `{ id: Date.now(), ... }` row into
  // state instead of the row Supabase actually created. removeBannedWord()
  // deletes by that same `id`, so every removal was calling
  // `.delete().eq("id", <fake Date.now() id>)` — a match for no real row.
  // The chip vanished from the UI, but the word was NEVER actually removed
  // from the banned_words table, so it silently kept blocking uploads.
  // Selecting the inserted row back (same pattern used for comment/post
  // inserts elsewhere in the app) fixes that at the source.
  const addBannedWord = async () => {
    const word = newWord.trim().toLowerCase();
    if (!word || wordSaving) return;
    setWordSaving(true);
    const { data, error } = await supabase
      .from("banned_words")
      .insert({ word, added_by: currentUser })
      .select()
      .single();
    if (!error && data) {
      setBannedWords((prev) => [data, ...prev]);
      setNewWord("");
      showToast(`"${word}" added to banned list`);
    } else {
      showToast("Word already exists or error occurred");
    }
    setWordSaving(false);
  };

  const removeBannedWord = async (id, word) => {
    const { error } = await supabase.from("banned_words").delete().eq("id", id);
    if (error) {
      console.error("removeBannedWord error:", error);
      showToast("❌ Failed to remove word");
      return;
    }
    setBannedWords((prev) => prev.filter((w) => w.id !== id));
    showToast(`"${word}" removed`);
  };

  // ── Visitors tab ─────────────────────────────────────────────────────────────
  // Pulls every site_visits row client-side (same pattern the rest of
  // this file already uses for reports/banned_words) and derives totals
  // in JS: unique sessions (distinct session_id), logged-in vs guest
  // split, and average duration. For a very large table this should
  // move to a Postgres view/RPC that pre-aggregates — flagged here for
  // when that becomes necessary, but fine for moderate traffic as-is.
  const fetchVisits = async () => {
    setVisitsLoading(true);
    const { data, error } = await supabase
      .from("site_visits")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(2000);
    if (!error && data) setVisits(data);
    setVisitsLoading(false);
    setVisitsLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "visitors" && !visitsLoaded && !visitsLoading) {
      fetchVisits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const visitStats = React.useMemo(() => {
    const totalVisits = visits.length;
    const uniqueSessions = new Set(visits.map((v) => v.session_id)).size;
    const loggedIn = visits.filter((v) => !!v.username).length;
    const guests = totalVisits - loggedIn;
    const durationsSec = visits.map((v) => {
      const start = new Date(v.started_at).getTime();
      const last = new Date(v.last_active_at).getTime();
      return Math.max(0, (last - start) / 1000);
    });
    const avgDurationSec = durationsSec.length
      ? durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length
      : 0;
    return { totalVisits, uniqueSessions, loggedIn, guests, avgDurationSec };
  }, [visits]);

  // ── Shared export data fetcher ──────────────────────────────────────────────
  // Pulls every table both exports rely on (profiles, videos, reels,
  // posts, post_reactions, post_comments, likes, views) in parallel, and
  // builds the same per-user summary rows used by both the Excel and PDF
  // exports below, so that logic only lives in one place.
  //
  // ASSUMPTIONS (update these table/column names if your schema differs):
  //  - profiles.id matches auth.users.id, which is also what's stored as
  //    likes.user_id and views.user_id elsewhere in this app (see
  //    homePage.js's handleLikeVideo / incrementView).
  //  - videos/reels/posts/post_comments/post_reactions all key off a
  //    plain `username` text column (not a foreign key to profiles.id) —
  //    matches every other query in this codebase.
  //  - There is currently no persisted "video comments" / "reel
  //    comments" table in what's been shared (MOCK_COMMENTS in
  //    homePage.js is hardcoded client-side data, not a Supabase table),
  //    so only post-level comments are exported. If you do have a real
  //    table for those, tell me its name and I'll add it to both exports.
  const fetchExportData = async () => {
    const [
      { data: profiles,      error: profilesErr },
      { data: videos,        error: videosErr },
      { data: reels,         error: reelsErr },
      { data: posts,         error: postsErr },
      { data: postComments,  error: postCommentsErr },
      { data: postReactions, error: postReactionsErr },
      { data: likes,         error: likesErr },
      { data: views,         error: viewsErr },
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("videos").select("*"),
      supabase.from("reels").select("*"),
      supabase.from("posts").select("*"),
      supabase.from("post_comments").select("*"),
      supabase.from("post_reactions").select("*"),
      supabase.from("likes").select("*"),
      supabase.from("views").select("*"),
    ]);

    const firstError =
      profilesErr || videosErr || reelsErr || postsErr ||
      postCommentsErr || postReactionsErr || likesErr || viewsErr;
    if (firstError) throw firstError;

    const usersSheet = (profiles || []).map((p) => {
      const username = p.username;
      return {
        Username: username || "",
        About: p.about || "",
        "Profile Pic URL": p.profile_pic || "",
        Joined: p.created_at ? new Date(p.created_at).toLocaleString("en-IN") : "",
        "Videos Uploaded": (videos || []).filter((v) => v.username === username).length,
        "Reels Uploaded": (reels || []).filter((r) => r.username === username).length,
        "Posts Made": (posts || []).filter((po) => po.username === username).length,
        "Post Comments Made": (postComments || []).filter((c) => c.username === username).length,
        "Post Reactions Given": (postReactions || []).filter((r) => r.username === username).length,
        "Video/Reel Likes Given": (likes || []).filter((l) => l.user_id === p.id).length,
        "Content Views Logged": (views || []).filter((v) => v.user_id === p.id).length,
      };
    });

    return { profiles, videos, reels, posts, postComments, postReactions, likes, views, usersSheet };
  };

  // ── Export to Excel ──────────────────────────────────────────────────────────
  // Builds a multi-sheet .xlsx workbook — one "Users" summary sheet plus
  // one raw-data sheet per table — and downloads it via XLSX.writeFile.
  const exportToExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const { videos, reels, posts, postComments, postReactions, likes, views, usersSheet } =
        await fetchExportData();

      const wb = XLSX.utils.book_new();
      const addSheet = (rows, name) => {
        // Cap each sheet at Excel's row limit just in case a table is huge.
        const safeRows = (rows || []).slice(0, 1_048_575);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safeRows), name);
      };

      addSheet(usersSheet,     "Users");
      addSheet(videos,         "Videos");
      addSheet(reels,          "Reels");
      addSheet(posts,          "Posts");
      addSheet(postComments,   "Post Comments");
      addSheet(postReactions,  "Post Reactions");
      addSheet(likes,          "Likes");
      addSheet(views,          "Views");

      const filename = `zixplon_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast("✅ Excel export downloaded");
    } catch (e) {
      console.error("[admin] Excel export failed:", e);
      showToast(`❌ Excel export failed: ${e.message || "unknown error"}`);
    } finally {
      setExportingExcel(false);
    }
  };

  // ── Export to PDF ────────────────────────────────────────────────────────────
  // Builds a landscape, multi-page PDF report — one table per section —
  // via jspdf-autotable. Unlike the Excel export, columns here are
  // trimmed down to what's readable on a printed page rather than every
  // raw field (a PDF page is much narrower than a spreadsheet column
  // set), and long free-text fields are truncated via truncate() above.
  const exportToPDF = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { videos, reels, posts, postComments, postReactions, likes, views, usersSheet } =
        await fetchExportData();

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const PRIMARY_RGB = [158, 18, 38]; // matches --zx-primary

      const addSectionTitle = (text) => {
        doc.setFontSize(16);
        doc.setTextColor(...PRIMARY_RGB);
        doc.text(text, 40, 40);
      };

      const addTable = (head, body) => {
        autoTable(doc, {
          startY: 55,
          head: [head],
          body,
          styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
          headStyles: { fillColor: PRIMARY_RGB, textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [254, 242, 242] }, // matches --zx-surface2
          margin: { left: 40, right: 40 },
        });
      };

      // ── Users summary ──
      addSectionTitle("ZIXPLON — Users Summary");
      addTable(
        ["Username", "Joined", "Videos", "Reels", "Posts", "Comments", "Reactions", "Likes Given", "Views Logged"],
        usersSheet.map((u) => [
          u.Username,
          u.Joined,
          u["Videos Uploaded"],
          u["Reels Uploaded"],
          u["Posts Made"],
          u["Post Comments Made"],
          u["Post Reactions Given"],
          u["Video/Reel Likes Given"],
          u["Content Views Logged"],
        ]),
      );

      // ── Videos ──
      doc.addPage();
      addSectionTitle("Videos");
      addTable(
        ["Title", "Username", "Category", "Duration", "Likes", "Uploaded"],
        (videos || []).map((v) => [
          truncate(v.title, 50),
          v.username || "",
          v.category || "",
          v.duration || "",
          v.likes ?? 0,
          v.created_at ? new Date(v.created_at).toLocaleDateString("en-IN") : "",
        ]),
      );

      // ── Reels ──
      doc.addPage();
      addSectionTitle("Reels");
      addTable(
        ["Title", "Username", "Duration", "Likes", "Uploaded"],
        (reels || []).map((r) => [
          truncate(r.title, 50),
          r.username || "",
          r.duration || "",
          r.likes ?? 0,
          r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN") : "",
        ]),
      );

      // ── Posts ──
      doc.addPage();
      addSectionTitle("Posts");
      addTable(
        ["Username", "Text", "Posted"],
        (posts || []).map((p) => [
          p.username || "",
          truncate(p.text, 90),
          p.created_at ? new Date(p.created_at).toLocaleDateString("en-IN") : "",
        ]),
      );

      // ── Post Comments ──
      doc.addPage();
      addSectionTitle("Post Comments");
      addTable(
        ["Username", "Comment", "Posted"],
        (postComments || []).map((c) => [
          c.username || "",
          truncate(c.text, 90),
          c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "",
        ]),
      );

      // ── Post Reactions ──
      doc.addPage();
      addSectionTitle("Post Reactions");
      addTable(
        ["Username", "Reaction Type", "Post ID"],
        (postReactions || []).map((r) => [r.username || "", r.type || "", String(r.post_id ?? "")]),
      );

      // ── Likes (videos/reels) ──
      doc.addPage();
      addSectionTitle("Likes (Videos / Reels)");
      addTable(
        ["User ID", "Content Type", "Content ID"],
        (likes || []).map((l) => [String(l.user_id ?? ""), l.content_type || "", String(l.content_id ?? "")]),
      );

      // ── Views ──
      doc.addPage();
      addSectionTitle("Content Views");
      addTable(
        ["User ID", "Content Type", "Content ID", "Viewed At"],
        (views || []).map((v) => [
          String(v.user_id ?? ""),
          v.content_type || "",
          String(v.content_id ?? ""),
          v.viewed_at ? new Date(v.viewed_at).toLocaleString("en-IN") : "",
        ]),
      );

      const filename = `zixplon_export_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      showToast("✅ PDF export downloaded");
    } catch (e) {
      console.error("[admin] PDF export failed:", e);
      showToast(`❌ PDF export failed: ${e.message || "unknown error"}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Still resolving the Supabase auth-session check — avoid flashing
  // "Access Denied" for admins whose email only lives in the live session
  // (see the authChecked note above). ──
  if (!authChecked) {
    return (
      <div className="admin_blocked">
        <div className="admin_spinner" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin_blocked">
        <div className="admin_blocked_icon">🔒</div>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        <Link to="/" className="admin_back_btn">← Go Home</Link>
      </div>
    );
  }

  const filteredReports = reports.filter((r) => filterStatus === "all" ? true : r.status === filterStatus);
  const pendingCount    = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="admin_panel">
      {/* Toast */}
      {toast && <div className="admin_toast">{toast}</div>}

      {/* Header */}
      <div className="admin_header">
        <div>
          <h1 className="admin_title">🛡️ Admin Panel</h1>
          <p className="admin_subtitle">ZIXPLON Content Moderation</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {/* NEW: Export to Excel — pulls users + videos/reels/posts/
              comments/likes/views and downloads a multi-sheet .xlsx
              workbook. See fetchExportData()/exportToExcel() above. */}
          <button
            className="admin_export_btn"
            onClick={exportToExcel}
            disabled={exportingExcel}
          >
            {exportingExcel ? "⏳ Exporting..." : "⬇ Export to Excel"}
          </button>
          {/* NEW: Export to PDF — same underlying data as the Excel
              export, rendered as a printable multi-page report instead.
              See exportToPDF() above. */}
          <button
            className="admin_export_btn admin_export_btn--pdf"
            onClick={exportToPDF}
            disabled={exportingPdf}
          >
            {exportingPdf ? "⏳ Exporting..." : "⬇ Export to PDF"}
          </button>
          <Link to="/" className="admin_back_btn">← Back to ZIXPLON</Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="admin_stats">
        {[
          { label: "Pending",   value: reports.filter((r) => r.status === "pending").length,   color: "#f97316" },
          { label: "Reviewed",  value: reports.filter((r) => r.status === "reviewed").length,  color: "#3b82f6" },
          { label: "Removed",   value: reports.filter((r) => r.status === "removed").length,   color: "#ef4444" },
          { label: "Dismissed", value: reports.filter((r) => r.status === "dismissed").length, color: "#22c55e" },
          { label: "Total",     value: reports.length,                                          color: "#7c3aed" },
        ].map((s) => (
          <div key={s.label} className="admin_stat_card">
            <div className="admin_stat_value" style={{ color: s.color }}>{s.value}</div>
            <div className="admin_stat_label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="admin_tabs">
        <button className={`admin_tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
          🚩 Reports {pendingCount > 0 && <span className="admin_badge">{pendingCount}</span>}
        </button>
        <button className={`admin_tab ${activeTab === "words" ? "active" : ""}`} onClick={() => setActiveTab("words")}>
          🔤 Banned Words ({bannedWords.length})
        </button>
        {/* NEW: site_visits totals + recent sessions — see fetchVisits/
            visitStats above and useVisitTracking.js for how rows land
            in this table. */}
        <button className={`admin_tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
          📈 Visitors
        </button>
      </div>

      {loading ? (
        <div className="admin_loading">
          <div className="admin_spinner" />
          <p>Loading...</p>
        </div>
      ) : activeTab === "reports" ? (
        <>
          {/* Status filter */}
          <div className="admin_filter_row">
            {["all", "pending", "reviewed", "removed", "dismissed"].map((s) => (
              <button
                key={s}
                className={`admin_filter_btn ${filterStatus === s ? "active" : ""}`}
                onClick={() => setFilterStatus(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && <span className="admin_filter_count">{reports.filter((r) => r.status === s).length}</span>}
              </button>
            ))}
          </div>

          {/* Reports list */}
          {filteredReports.length === 0 ? (
            <div className="admin_empty">
              <div style={{ fontSize: "48px" }}>✅</div>
              <p>No {filterStatus === "all" ? "" : filterStatus} reports</p>
            </div>
          ) : (
            <div className="admin_reports_list">
              {filteredReports.map((report) => {
                const sc = STATUS_COLORS[report.status] || STATUS_COLORS.pending;
                return (
                  <div key={report.id} className="admin_report_card">
                    {/* Card header */}
                    <div className="admin_report_header">
                      <div className="admin_report_meta">
                        <span className="admin_report_type">{report.content_type.toUpperCase()}</span>
                        <span className="admin_report_reason">{REASON_LABELS[report.reason] || report.reason}</span>
                        <span className="admin_report_status" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {report.status}
                        </span>
                      </div>
                      <span className="admin_report_time">
                        {new Date(report.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>

                    {/* Content info */}
                    <div className="admin_report_content">
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Content</span>
                        <span className="admin_report_field_value">"{report.content_title}"</span>
                      </div>
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Uploader</span>
                        <span className="admin_report_field_value">@{report.content_owner}</span>
                      </div>
                      <div className="admin_report_field">
                        <span className="admin_report_field_label">Reported by</span>
                        <span className="admin_report_field_value">@{report.reporter_username}</span>
                      </div>
                      {report.details && (
                        <div className="admin_report_field">
                          <span className="admin_report_field_label">Details</span>
                          <span className="admin_report_field_value admin_report_details">{report.details}</span>
                        </div>
                      )}
                      {report.admin_note && (
                        <div className="admin_report_field">
                          <span className="admin_report_field_label">Admin note</span>
                          <span className="admin_report_field_value" style={{ color: "#7c3aed", fontWeight: 700 }}>{report.admin_note}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions — only show if pending or reviewed */}
                    {(report.status === "pending" || report.status === "reviewed") && (
                      <div className="admin_report_actions">
                        <button
                          className="admin_action_btn admin_action_btn--delete"
                          onClick={() => deleteContent(report)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "delete" ? "Deleting..." : "🗑️ Delete Content"}
                        </button>
                        <button
                          className="admin_action_btn admin_action_btn--dismiss"
                          onClick={() => updateReportStatus(report.id, "dismissed")}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "dismissed" ? "..." : "✓ Dismiss"}
                        </button>
                        {report.status === "pending" && (
                          <button
                            className="admin_action_btn admin_action_btn--review"
                            onClick={() => updateReportStatus(report.id, "reviewed")}
                            disabled={!!actionLoading}
                          >
                            {actionLoading === report.id + "reviewed" ? "..." : "👁 Mark Reviewed"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : activeTab === "visitors" ? (
        /* ── Visitors Tab ── */
        <div className="admin_visitors_section">
          {visitsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading visitor data...</p>
            </div>
          ) : (
            <>
              <div className="admin_stats" style={{ marginBottom: "20px" }}>
                {[
                  { label: "Total Visits",   value: visitStats.totalVisits,   color: "#7c3aed" },
                  { label: "Unique Sessions", value: visitStats.uniqueSessions, color: "#3b82f6" },
                  { label: "Logged-in",      value: visitStats.loggedIn,      color: "#22c55e" },
                  { label: "Guests",         value: visitStats.guests,        color: "#f97316" },
                  { label: "Avg. Duration",  value: formatDuration(visitStats.avgDurationSec), color: "#ef4444" },
                ].map((s) => (
                  <div key={s.label} className="admin_stat_card">
                    <div className="admin_stat_value" style={{ color: s.color, fontSize: typeof s.value === "string" ? "20px" : "28px" }}>
                      {s.value}
                    </div>
                    <div className="admin_stat_label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <p className="admin_words_hint" style={{ margin: 0 }}>
                  Showing the {visits.length} most recent visits. Duration is accurate to within ~20s (heartbeat interval).
                </p>
                <button className="admin_add_word_btn" onClick={fetchVisits} disabled={visitsLoading}>
                  ↻ Refresh
                </button>
              </div>

              {visits.length === 0 ? (
                <div className="admin_empty">
                  <div style={{ fontSize: "48px" }}>📭</div>
                  <p>No visits recorded yet</p>
                </div>
              ) : (
                <div className="admin_visits_table_wrap">
                  <table className="admin_visits_table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Entry Page</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.slice(0, 300).map((v) => {
                        const durationSec = Math.max(
                          0,
                          (new Date(v.last_active_at).getTime() - new Date(v.started_at).getTime()) / 1000,
                        );
                        return (
                          <tr key={v.id}>
                            <td>{v.username ? `@${v.username}` : "Guest"}</td>
                            <td>
                              {new Date(v.started_at).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                            </td>
                            <td>{formatDuration(durationSec)}</td>
                            <td className="admin_visits_path">{v.entry_path || "/"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Banned Words Tab ── */
        <div className="admin_words_section">
          {/* Add word */}
          <div className="admin_add_word_row">
            <input
              type="text"
              className="admin_word_input"
              placeholder="Add a new banned word or phrase..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBannedWord()}
              disabled={wordSaving}
            />
            <button className="admin_add_word_btn" onClick={addBannedWord} disabled={wordSaving}>
              {wordSaving ? "Adding..." : "+ Add"}
            </button>
          </div>
          <p className="admin_words_hint">These words are automatically blocked at upload time. Case-insensitive.</p>

          {/* Words grid */}
          <div className="admin_words_grid">
            {bannedWords.map((w) => (
              <div key={w.id} className="admin_word_chip">
                <span className="admin_word_text">{w.word}</span>
                <button className="admin_word_remove" onClick={() => removeBannedWord(w.id, w.word)} title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;