import React, { useState, useEffect } from "react";
import "./AdminPanel.css";
import { supabase } from "../../config/supabase";
import { Link } from "react-router-dom";
// SheetJS — generates the .xlsx workbook entirely client-side and
// triggers a browser download via XLSX.writeFile. Requires the "xlsx"
// package to be installed: `npm install xlsx`.
import * as XLSX from "xlsx";
// jsPDF + jspdf-autotable — generates the .pdf report entirely
// client-side. Requires both packages installed:
// `npm install jspdf jspdf-autotable`
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Root admin(s) ────────────────────────────────────────────────────────────
// Hardcoded fallback so the app can never be locked out even if the
// admin_users table is empty, unreachable, or something goes wrong with
// the API route below. Anyone in this list is ALWAYS an admin, and can
// never be removed via the Admins tab (see revokeAdmin's guard and the
// matching guard in api/manage-admin.js).
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

// Truncates long free-text fields (post text, comment text) so a
// single row never blows out a table's column width in either export.
const truncate = (str, max = 80) => {
  if (!str) return "";
  const s = String(str);
  return s.length > max ? s.slice(0, max) + "…" : s;
};

// Formats a duration in seconds as "Xh Ym" / "Xm Ys" / "Xs" for
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

// Very light client-side email shape check for the Admins form. The
// real validation of "does this look like an email" ultimately happens
// server-side (Supabase auth itself will reject a malformed address on
// account creation) — this is just to stop obviously-empty/garbage
// submissions before making a network call.
const looksLikeEmail = (v) => /\S+@\S+\.\S+/.test(v);

const AdminPanel = () => {
  const currentUser = localStorage.getItem("username") || "";

  // ── Auth check, step 1: Supabase auth-session email ──
  // Profile.js's own PATH 2 (Supabase auth-session login, as opposed to
  // the localStorage-cache login path) never calls
  // localStorage.setItem("email", ...) — it only persists username/
  // channelName/profilePic/about. An admin who authenticated through
  // that path would have an empty localStorage "email" and get bounced
  // to "Access Denied" with no indication why. We check the live
  // Supabase session's email (the same source Profile.js's PATH 2
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
  const isHardcodedAdmin = ADMIN_EMAILS.includes(localEmail) || ADMIN_EMAILS.includes(authEmail);

  // ── Auth check, step 2: DB-backed admin_users table ──
  // admin_users has no RLS policies granting client access on purpose —
  // it's only ever read/written via api/manage-admin.js using the
  // service-role key server-side. So membership is checked by asking
  // that API ("action: check"), not by querying the table directly.
  // Hardcoded admins skip this round-trip entirely.
  const [dbAdminChecked, setDbAdminChecked] = useState(false);
  const [isDbAdmin,      setIsDbAdmin]      = useState(false);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  const callManageAdmin = async (body) => {
    const token = await getAccessToken();
    const res = await fetch("/api/manage-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  useEffect(() => {
    if (!authChecked) return;
    if (isHardcodedAdmin) {
      // Already an admin via the hardcoded list — no need to ask the API.
      setIsDbAdmin(true);
      setDbAdminChecked(true);
      return;
    }
    let active = true;
    callManageAdmin({ action: "check" })
      .then((r) => { if (active) setIsDbAdmin(!!r.isAdmin); })
      .catch(() => { if (active) setIsDbAdmin(false); })
      .finally(() => { if (active) setDbAdminChecked(true); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authEmail]);

  const isAdmin = isHardcodedAdmin || isDbAdmin;

  const [reports,       setReports]       = useState([]);
  const [bannedWords,   setBannedWords]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState("reports");
  const [filterStatus,  setFilterStatus]  = useState("pending");
  const [newWord,       setNewWord]       = useState("");
  const [wordSaving,    setWordSaving]    = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast,         setToast]         = useState("");
  // Separate loading flags for each export button, so exporting to
  // Excel doesn't grey out the PDF button (and vice versa) — each kicks
  // off its own independent data fetch + file generation.
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf,   setExportingPdf]   = useState(false);
  // "Visitors" tab data — populated lazily the first time that tab
  // is opened (see the activeTab effect below), not on initial mount,
  // since site_visits can grow large and most admin visits won't need it.
  const [visits,        setVisits]        = useState([]);
  const [visitsLoading, setVisitsLoading]  = useState(false);
  const [visitsLoaded,  setVisitsLoaded]   = useState(false);

  // ── "Admins" tab state ──────────────────────────────────────────────────
  const [admins,           setAdmins]           = useState([]);
  const [adminsLoading,    setAdminsLoading]    = useState(false);
  const [adminsLoaded,     setAdminsLoaded]     = useState(false);
  const [newAdminEmail,    setNewAdminEmail]    = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [grantLoading,     setGrantLoading]     = useState(false);
  const [revokingEmail,    setRevokingEmail]    = useState(null);

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

  // ── Admins tab: list / grant / revoke ───────────────────────────────────────
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const { admins: rows } = await callManageAdmin({ action: "list" });
      setAdmins(rows || []);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setAdminsLoading(false);
    setAdminsLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "admins" && !adminsLoaded && !adminsLoading) {
      fetchAdmins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Grants admin access for newAdminEmail. If newAdminPassword is set,
  // the API first tries to create a brand-new Supabase auth account
  // with that email/password (email_confirm: true, so they can log in
  // immediately with no email verification step) — if an account with
  // that email already exists, the API just skips creation and grants
  // admin to the existing account. So this one form covers both "make
  // an existing user an admin" and "create a new admin from scratch".
  const grantAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || grantLoading) return;
    if (!looksLikeEmail(email)) {
      showToast("❌ Enter a valid email address");
      return;
    }
    if (newAdminPassword && newAdminPassword.length < 6) {
      showToast("❌ Password must be at least 6 characters");
      return;
    }
    setGrantLoading(true);
    try {
      const r = await callManageAdmin({
        action: "grant",
        email,
        password: newAdminPassword || undefined,
      });
      showToast(
        r.createdAccount
          ? `✅ Account created & admin granted for ${email}`
          : `✅ Admin access granted for ${email}`
      );
      setNewAdminEmail("");
      setNewAdminPassword("");
      fetchAdmins();
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setGrantLoading(false);
  };

  const revokeAdmin = async (email) => {
    if (ADMIN_EMAILS.includes(email)) return; // guarded in UI too, belt & suspenders
    setRevokingEmail(email);
    try {
      await callManageAdmin({ action: "remove", email });
      setAdmins((prev) => prev.filter((a) => a.email !== email));
      showToast(`"${email}" removed from admins`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setRevokingEmail(null);
  };

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

  // ── Still resolving auth (Supabase session email AND/OR the
  // DB-backed admin check) — avoid flashing "Access Denied" for admins
  // whose access only lives in the live session or the admin_users
  // table (see the notes above). ──
  if (!authChecked || !dbAdminChecked) {
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
          {/* Export to Excel — pulls users + videos/reels/posts/
              comments/likes/views and downloads a multi-sheet .xlsx
              workbook. See fetchExportData()/exportToExcel() above. */}
          <button
            className="admin_export_btn"
            onClick={exportToExcel}
            disabled={exportingExcel}
          >
            {exportingExcel ? "⏳ Exporting..." : "⬇ Export to Excel"}
          </button>
          {/* Export to PDF — same underlying data as the Excel
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
        {/* site_visits totals + recent sessions — see fetchVisits/
            visitStats above and useVisitTracking.js for how rows land
            in this table. */}
        <button className={`admin_tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
          📈 Visitors
        </button>
        {/* Grant/revoke admin access — backed by the admin_users table
            via api/manage-admin.js. See the Admins tab section below. */}
        <button className={`admin_tab ${activeTab === "admins" ? "active" : ""}`} onClick={() => setActiveTab("admins")}>
          👑 Admins {admins.length > 0 && <span className="admin_badge" style={{ background: "#7c3aed" }}>{admins.length}</span>}
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
      ) : activeTab === "admins" ? (
        /* ── Admins Tab ── */
        <div className="admin_admins_section">
          <div className="admin_grant_card">
            <h3 className="admin_grant_title">Grant admin access</h3>
            <p className="admin_words_hint">
              Enter an email to make that person an admin. If they don't have an
              account yet, set a password too and one will be created for them —
              leave it blank if they already have an account.
            </p>
            <div className="admin_grant_row">
              <input
                type="email"
                className="admin_word_input"
                placeholder="person@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                disabled={grantLoading}
              />
              <input
                type="password"
                className="admin_word_input"
                placeholder="New password (optional)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                disabled={grantLoading}
              />
              <button className="admin_add_word_btn" onClick={grantAdmin} disabled={grantLoading}>
                {grantLoading ? "Granting..." : "+ Grant Admin"}
              </button>
            </div>
          </div>

          <h3 className="admin_grant_title" style={{ marginTop: "22px" }}>Current admins</h3>
          {adminsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading admins...</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="admin_empty">
              <div style={{ fontSize: "48px" }}>👑</div>
              <p>No admins found</p>
            </div>
          ) : (
            <div className="admin_admins_list">
              {admins.map((a) => (
                <div key={a.email} className="admin_admin_row">
                  <div>
                    <div className="admin_admin_email">
                      {a.email}
                      {(a.root || ADMIN_EMAILS.includes(a.email)) && (
                        <span className="admin_admin_root_badge">ROOT</span>
                      )}
                    </div>
                    {a.added_by && (
                      <div className="admin_admin_meta">
                        added by {a.added_by}
                        {a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString("en-IN")}` : ""}
                      </div>
                    )}
                  </div>
                  {!(a.root || ADMIN_EMAILS.includes(a.email)) && (
                    <button
                      className="admin_action_btn admin_action_btn--delete"
                      onClick={() => revokeAdmin(a.email)}
                      disabled={revokingEmail === a.email}
                    >
                      {revokingEmail === a.email ? "Removing..." : "Remove"}
                    </button>
                  )}
                </div>
              ))}
            </div>
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