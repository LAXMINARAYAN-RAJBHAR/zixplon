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
// docx — generates a .docx (Word) report entirely client-side, used by
// the Logins tab's "Export to Word" button. Requires:
// `npm install docx`
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
} from "docx";

// ── Root admin(s) ────────────────────────────────────────────────────────────
// Hardcoded fallback so the app can never be locked out even if the
// admin_users table is empty, unreachable, or something goes wrong with
// the API route below. Anyone in this list is ALWAYS an admin, and can
// never be removed via the Admins tab or deleted via the Users tab.
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

// Truncates long free-text fields (post text, comment text, user-agent
// strings) so a single row never blows out a table's column width in
// either export.
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

// Downloads an in-memory Blob as a file — shared by the Word export
// below (jsPDF and XLSX have their own built-in .save()/.writeFile()).
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const AdminPanel = () => {
  const currentUser = localStorage.getItem("username") || "";

  // ── Auth check, step 1: Supabase auth-session email ──
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
  const [dbAdminChecked, setDbAdminChecked] = useState(false);
  const [isDbAdmin,      setIsDbAdmin]      = useState(false);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  };

  const callApi = async (path, body) => {
    const token = await getAccessToken();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  const callManageAdmin    = (body) => callApi("/api/manage-admin", body);
  const callUserLoginInfo  = () => callApi("/api/user-login-info", {});
  const callModerateUser   = (body) => callApi("/api/moderate-user", body);
  const callManageHomeHub  = (body) => callApi("/api/manage-home-hub-tabs", body);

  useEffect(() => {
    if (!authChecked) return;
    if (isHardcodedAdmin) {
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
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf,   setExportingPdf]   = useState(false);
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

  // ── "Logins" tab state ───────────────────────────────────────────────────
  const [loginRows,          setLoginRows]          = useState([]);
  const [loginsLoading,      setLoginsLoading]      = useState(false);
  const [loginsLoaded,       setLoginsLoaded]       = useState(false);
  const [exportingLoginsXlsx, setExportingLoginsXlsx] = useState(false);
  const [exportingLoginsWord, setExportingLoginsWord] = useState(false);
  const [exportingLoginsPdf,  setExportingLoginsPdf]  = useState(false);

  // ── "Users" tab state ────────────────────────────────────────────────────
  // Reuses the same data source as the Logins tab (api/user-login-info.js
  // returns everything needed: username, email, ban status). Kept as a
  // SEPARATE fetch/loaded flag from the Logins tab so opening one doesn't
  // silently also mark the other as "loaded" with stale data — each tab
  // refreshes independently.
  const [userRows,        setUserRows]        = useState([]);
  const [usersLoading,    setUsersLoading]    = useState(false);
  const [usersLoaded,     setUsersLoaded]     = useState(false);
  const [userSearch,      setUserSearch]      = useState("");
  const [moderatingId,    setModeratingId]    = useState(null); // userId currently being acted on
  const [removeContentMap, setRemoveContentMap] = useState({}); // userId -> bool, "also delete content" checkbox state

  // ── "Home Hub" tab state ─────────────────────────────────────────────────
  // Controls which tabs show in HomeHub.jsx's tab bar (Home/Posts/Utility)
  // and in what order. Writes go through /api/manage-home-hub-tabs (same
  // admin-token pattern as callManageAdmin) rather than direct client
  // writes, since the home_hub_tabs table's RLS only grants SELECT to
  // the anon/authenticated roles.
  const [hubTabs,        setHubTabs]        = useState([]);
  const [hubTabsLoading, setHubTabsLoading] = useState(false);
  const [hubTabsLoaded,  setHubTabsLoaded]  = useState(false);
  const [hubTabBusyKey,  setHubTabBusyKey]  = useState(null);

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

      const rawId = String(report.content_id).replace("db_", "");
      await supabase.from(table).delete().eq("id", rawId);
      await updateReportStatus(report.id, "removed", "Content deleted by admin");
      showToast(`✅ Content deleted and report closed`);
    } catch (e) {
      showToast("❌ Failed to delete content");
    }
    setActionLoading(null);
  };

  // NEW: bans the account that uploaded/owns the reported content,
  // directly from a report card. Resolves the target purely by
  // username (report.content_owner) — the server looks up the actual
  // auth user id via the profiles table. Does NOT delete their content;
  // use the existing "Delete Content" button for the reported item, or
  // the Users tab for a full content wipe.
  const banUploaderFromReport = async (report) => {
    if (!report.content_owner) return;
    const confirmed = window.confirm(
      `Ban @${report.content_owner}? They will no longer be able to log in. This does not delete their existing content.`,
    );
    if (!confirmed) return;

    setActionLoading(report.id + "ban");
    try {
      await callModerateUser({ action: "ban", username: report.content_owner });
      showToast(`🚫 @${report.content_owner} has been banned`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setActionLoading(null);
  };

  // ── Banned words actions ────────────────────────────────────────────────────
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
    if (ADMIN_EMAILS.includes(email)) return;
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

  // ── Logins tab: login method + last login + IP/device per user ─────────────
  const fetchLogins = async () => {
    setLoginsLoading(true);
    try {
      const { users } = await callUserLoginInfo();
      setLoginRows(users || []);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setLoginsLoading(false);
    setLoginsLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "logins" && !loginsLoaded && !loginsLoading) {
      fetchLogins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const ensureLoginRows = async () => {
    if (loginRows.length) return loginRows;
    const { users } = await callUserLoginInfo();
    setLoginRows(users || []);
    setLoginsLoaded(true);
    return users || [];
  };

  const loginRowsToTableData = (rows) =>
    rows.map((r) => [
      r.username || "—",
      r.email || "—",
      (r.providers || []).join(", "),
      r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-IN") : "Never",
      r.last_ip || "—",
      truncate(r.last_device, 60) || "—",
    ]);

  const exportLoginsToExcel = async () => {
    if (exportingLoginsXlsx) return;
    setExportingLoginsXlsx(true);
    try {
      const rows = await ensureLoginRows();
      const sheetRows = rows.map((r) => ({
        Username: r.username || "",
        Email: r.email || "",
        "Login Method": (r.providers || []).join(", "),
        "Last Login": r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-IN") : "Never",
        "Last IP": r.last_ip || "",
        "Last Device": r.last_device || "",
        "Account Created": r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "",
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), "Logins");
      XLSX.writeFile(wb, `zixplon_logins_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast("✅ Excel report downloaded");
    } catch (e) {
      showToast(`❌ Excel export failed: ${e.message}`);
    }
    setExportingLoginsXlsx(false);
  };

  const exportLoginsToWord = async () => {
    if (exportingLoginsWord) return;
    setExportingLoginsWord(true);
    try {
      const rows = await ensureLoginRows();
      const headerCells = ["Username", "Email", "Login Method", "Last Login", "Last IP", "Last Device"];

      const headerRow = new TableRow({
        children: headerCells.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            }),
        ),
      });

      const bodyRows = loginRowsToTableData(rows).map(
        (cells) =>
          new TableRow({
            children: cells.map((text) => new TableCell({ children: [new Paragraph(String(text))] })),
          }),
      );

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: "ZIXPLON — User Login Report", heading: HeadingLevel.HEADING_1 }),
              new Paragraph({
                text: `Generated ${new Date().toLocaleString("en-IN")} · ${rows.length} users`,
                spacing: { after: 200 },
              }),
              new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `zixplon_logins_${new Date().toISOString().slice(0, 10)}.docx`);
      showToast("✅ Word report downloaded");
    } catch (e) {
      console.error("[admin] Word export failed:", e);
      showToast(`❌ Word export failed: ${e.message || "unknown error"}`);
    }
    setExportingLoginsWord(false);
  };

  const exportLoginsToPDF = async () => {
    if (exportingLoginsPdf) return;
    setExportingLoginsPdf(true);
    try {
      const rows = await ensureLoginRows();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const PRIMARY_RGB = [158, 18, 38];

      doc.setFontSize(16);
      doc.setTextColor(...PRIMARY_RGB);
      doc.text("ZIXPLON — User Login Report", 40, 40);

      autoTable(doc, {
        startY: 55,
        head: [["Username", "Email", "Login Method", "Last Login", "Last IP", "Last Device"]],
        body: loginRowsToTableData(rows),
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: { fillColor: PRIMARY_RGB, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 40, right: 40 },
      });

      doc.save(`zixplon_logins_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast("✅ PDF report downloaded");
    } catch (e) {
      console.error("[admin] Logins PDF export failed:", e);
      showToast(`❌ PDF export failed: ${e.message || "unknown error"}`);
    }
    setExportingLoginsPdf(false);
  };

  // ── Users tab: search + ban/unban/delete ────────────────────────────────────
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { users } = await callUserLoginInfo();
      setUserRows(users || []);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setUsersLoading(false);
    setUsersLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "users" && !usersLoaded && !usersLoading) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggleRemoveContent = (userId) => {
    setRemoveContentMap((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const banUser = async (user) => {
    const confirmed = window.confirm(
      `Ban ${user.username ? `@${user.username}` : user.email}? They will no longer be able to log in.${
        removeContentMap[user.id] ? " Their videos, reels, and posts will ALSO be permanently deleted." : ""
      }`,
    );
    if (!confirmed) return;

    setModeratingId(user.id);
    try {
      await callModerateUser({
        action: "ban",
        userId: user.id,
        username: user.username,
        removeContent: !!removeContentMap[user.id],
      });
      setUserRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_banned: true } : u)));
      showToast(`🚫 ${user.username ? `@${user.username}` : user.email} banned`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  const unbanUser = async (user) => {
    setModeratingId(user.id);
    try {
      await callModerateUser({ action: "unban", userId: user.id, username: user.username });
      setUserRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_banned: false } : u)));
      showToast(`✅ ${user.username ? `@${user.username}` : user.email} unbanned`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  const deleteUserAccount = async (user) => {
    const wipeContent = !!removeContentMap[user.id];
    const confirmed = window.confirm(
      `Permanently delete the account for ${user.username ? `@${user.username}` : user.email}? This cannot be undone.${
        wipeContent ? " Their videos, reels, and posts will ALSO be permanently deleted." : " Their existing content will be kept but no longer tied to a valid login."
      }`,
    );
    if (!confirmed) return;

    setModeratingId(user.id);
    try {
      await callModerateUser({
        action: "delete",
        userId: user.id,
        username: user.username,
        removeContent: wipeContent,
      });
      setUserRows((prev) => prev.filter((u) => u.id !== user.id));
      showToast(`🗑️ Account deleted`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUserRows = normalizedUserSearch
    ? userRows.filter(
        (u) =>
          (u.username || "").toLowerCase().includes(normalizedUserSearch) ||
          (u.email || "").toLowerCase().includes(normalizedUserSearch),
      )
    : userRows;

  // ── Home Hub tab: fetch / toggle / reorder ──────────────────────────────
  const fetchHubTabs = async () => {
    setHubTabsLoading(true);
    try {
      const { tabs } = await callManageHomeHub({ action: "list" });
      setHubTabs((tabs || []).slice().sort((a, b) => a.sort_order - b.sort_order));
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setHubTabsLoading(false);
    setHubTabsLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "hub" && !hubTabsLoaded && !hubTabsLoading) {
      fetchHubTabs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggleHubTabVisibility = async (tab) => {
    setHubTabBusyKey(tab.key);
    const nextVisible = !tab.is_visible;
    try {
      await callManageHomeHub({ action: "toggle", key: tab.key, is_visible: nextVisible });
      setHubTabs((prev) => prev.map((t) => (t.key === tab.key ? { ...t, is_visible: nextVisible } : t)));
      showToast(`"${tab.label}" ${nextVisible ? "shown" : "hidden"} on the homepage`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setHubTabBusyKey(null);
  };

  const AUDIENCE_LABELS = {
    everyone: "Everyone",
    logged_in: "Logged-in only",
    guests_only: "Guests only",
  };

  const setHubTabAudience = async (tab, audience) => {
    if (audience === tab.audience) return;
    setHubTabBusyKey(tab.key);
    try {
      await callManageHomeHub({ action: "set_audience", key: tab.key, audience });
      setHubTabs((prev) => prev.map((t) => (t.key === tab.key ? { ...t, audience } : t)));
      showToast(`"${tab.label}" now shown to: ${AUDIENCE_LABELS[audience]}`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setHubTabBusyKey(null);
  };

  const moveHubTab = async (tab, direction) => {
    const idx = hubTabs.findIndex((t) => t.key === tab.key);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= hubTabs.length) return;

    const reordered = hubTabs.slice();
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const updates = reordered.map((t, i) => ({ key: t.key, sort_order: i }));

    setHubTabBusyKey(tab.key);
    try {
      await callManageHomeHub({ action: "reorder", updates });
      setHubTabs(reordered.map((t, i) => ({ ...t, sort_order: i })));
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setHubTabBusyKey(null);
  };

  // ── Shared export data fetcher (existing header Excel/PDF export) ──────────
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

    let loginByUsername = new Map();
    try {
      const { users: loginData } = await callUserLoginInfo();
      loginByUsername = new Map(
        (loginData || []).filter((r) => r.username).map((r) => [r.username, r]),
      );
    } catch (e) {
      console.warn("[admin] login info unavailable for export:", e.message);
    }

    const usersSheet = (profiles || []).map((p) => {
      const username = p.username;
      const login = loginByUsername.get(username);
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
        "Login Method": login ? (login.providers || []).join(", ") : "",
        "Last Login": login?.last_sign_in_at ? new Date(login.last_sign_in_at).toLocaleString("en-IN") : "",
        "Last IP": login?.last_ip || "",
        "Last Device": login?.last_device || "",
        "Account Status": login?.is_banned ? "Banned" : "Active",
      };
    });

    return { profiles, videos, reels, posts, postComments, postReactions, likes, views, usersSheet };
  };

  // ── Export to Excel (header button) ─────────────────────────────────────────
  const exportToExcel = async () => {
    if (exportingExcel) return;
    setExportingExcel(true);
    try {
      const { videos, reels, posts, postComments, postReactions, likes, views, usersSheet } =
        await fetchExportData();

      const wb = XLSX.utils.book_new();
      const addSheet = (rows, name) => {
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

  // ── Export to PDF (header button) ───────────────────────────────────────────
  const exportToPDF = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { videos, reels, posts, postComments, postReactions, likes, views, usersSheet } =
        await fetchExportData();

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const PRIMARY_RGB = [158, 18, 38];

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
          alternateRowStyles: { fillColor: [254, 242, 242] },
          margin: { left: 40, right: 40 },
        });
      };

      addSectionTitle("ZIXPLON — Users Summary");
      addTable(
        ["Username", "Videos", "Reels", "Posts", "Comments", "Login Method", "Last Login", "Status"],
        usersSheet.map((u) => [
          u.Username,
          u["Videos Uploaded"],
          u["Reels Uploaded"],
          u["Posts Made"],
          u["Post Comments Made"],
          u["Login Method"],
          u["Last Login"],
          u["Account Status"],
        ]),
      );

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

      doc.addPage();
      addSectionTitle("Post Reactions");
      addTable(
        ["Username", "Reaction Type", "Post ID"],
        (postReactions || []).map((r) => [r.username || "", r.type || "", String(r.post_id ?? "")]),
      );

      doc.addPage();
      addSectionTitle("Likes (Videos / Reels)");
      addTable(
        ["User ID", "Content Type", "Content ID"],
        (likes || []).map((l) => [String(l.user_id ?? ""), l.content_type || "", String(l.content_id ?? "")]),
      );

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
      {toast && <div className="admin_toast">{toast}</div>}

      <div className="admin_header">
        <div>
          <h1 className="admin_title">🛡️ Admin Panel</h1>
          <p className="admin_subtitle">ZIXPLON Content Moderation</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="admin_export_btn" onClick={exportToExcel} disabled={exportingExcel}>
            {exportingExcel ? "⏳ Exporting..." : "⬇ Export to Excel"}
          </button>
          <button className="admin_export_btn admin_export_btn--pdf" onClick={exportToPDF} disabled={exportingPdf}>
            {exportingPdf ? "⏳ Exporting..." : "⬇ Export to PDF"}
          </button>
          <Link to="/" className="admin_back_btn">← Back to ZIXPLON</Link>
        </div>
      </div>

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

      <div className="admin_tabs">
        <button className={`admin_tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
          🚩 Reports {pendingCount > 0 && <span className="admin_badge">{pendingCount}</span>}
        </button>
        <button className={`admin_tab ${activeTab === "words" ? "active" : ""}`} onClick={() => setActiveTab("words")}>
          🔤 Banned Words ({bannedWords.length})
        </button>
        <button className={`admin_tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
          📈 Visitors
        </button>
        <button className={`admin_tab ${activeTab === "admins" ? "active" : ""}`} onClick={() => setActiveTab("admins")}>
          👑 Admins {admins.length > 0 && <span className="admin_badge" style={{ background: "#7c3aed" }}>{admins.length}</span>}
        </button>
        <button className={`admin_tab ${activeTab === "logins" ? "active" : ""}`} onClick={() => setActiveTab("logins")}>
          🔐 Logins
        </button>
        {/* NEW: ban/unban/delete any user account. See api/moderate-user.js. */}
        <button className={`admin_tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
          👥 Users
        </button>
        {/* NEW: show/hide/reorder HomeHub.jsx's Home/Posts/Utility tabs. */}
        <button className={`admin_tab ${activeTab === "hub" ? "active" : ""}`} onClick={() => setActiveTab("hub")}>
          🏠 Home Hub
        </button>
      </div>

      {loading ? (
        <div className="admin_loading">
          <div className="admin_spinner" />
          <p>Loading...</p>
        </div>
      ) : activeTab === "reports" ? (
        <>
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

                    {(report.status === "pending" || report.status === "reviewed") && (
                      <div className="admin_report_actions">
                        <button
                          className="admin_action_btn admin_action_btn--delete"
                          onClick={() => deleteContent(report)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "delete" ? "Deleting..." : "🗑️ Delete Content"}
                        </button>
                        {/* NEW: bans the reported content's owner outright. */}
                        <button
                          className="admin_action_btn admin_action_btn--delete"
                          onClick={() => banUploaderFromReport(report)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === report.id + "ban" ? "Banning..." : "🚫 Ban Uploader"}
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
      ) : activeTab === "logins" ? (
        <div className="admin_visitors_section">
          {loginsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading login info...</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <p className="admin_words_hint" style={{ margin: 0 }}>
                  Login method comes from each account's sign-in provider. Passwords
                  are never retrievable — Supabase stores only irreversible hashes.
                  IP/device reflect the user's most recent site visit.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button className="admin_add_word_btn" onClick={fetchLogins} disabled={loginsLoading}>
                    ↻ Refresh
                  </button>
                  <button className="admin_export_btn" onClick={exportLoginsToExcel} disabled={exportingLoginsXlsx}>
                    {exportingLoginsXlsx ? "⏳..." : "⬇ Excel"}
                  </button>
                  <button className="admin_export_btn" style={{ background: "#2563eb", borderColor: "#2563eb" }} onClick={exportLoginsToWord} disabled={exportingLoginsWord}>
                    {exportingLoginsWord ? "⏳..." : "⬇ Word"}
                  </button>
                  <button className="admin_export_btn admin_export_btn--pdf" onClick={exportLoginsToPDF} disabled={exportingLoginsPdf}>
                    {exportingLoginsPdf ? "⏳..." : "⬇ PDF"}
                  </button>
                </div>
              </div>

              {loginRows.length === 0 ? (
                <div className="admin_empty">
                  <div style={{ fontSize: "48px" }}>🔐</div>
                  <p>No login data found</p>
                </div>
              ) : (
                <div className="admin_visits_table_wrap">
                  <table className="admin_visits_table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Login Method</th>
                        <th>Last Login</th>
                        <th>Last IP</th>
                        <th>Last Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginRows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.username ? `@${r.username}` : r.email}</td>
                          <td>{(r.providers || []).join(", ")}</td>
                          <td>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-IN") : "Never"}</td>
                          <td>{r.last_ip || "—"}</td>
                          <td className="admin_visits_path" title={r.last_device || ""}>
                            {truncate(r.last_device, 40) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "users" ? (
        /* ── Users Tab: ban / unban / delete any account ── */
        <div className="admin_users_mgmt_section">
          {usersLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading users...</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <input
                  type="text"
                  className="admin_word_input"
                  style={{ maxWidth: "280px" }}
                  placeholder="Search by username or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <button className="admin_add_word_btn" onClick={fetchUsers} disabled={usersLoading}>
                  ↻ Refresh
                </button>
              </div>

              {filteredUserRows.length === 0 ? (
                <div className="admin_empty">
                  <div style={{ fontSize: "48px" }}>👥</div>
                  <p>No users found</p>
                </div>
              ) : (
                <div className="admin_users_mgmt_list">
                  {filteredUserRows.map((u) => {
                    const isRoot = ADMIN_EMAILS.includes((u.email || "").toLowerCase());
                    const busy = moderatingId === u.id;
                    return (
                      <div key={u.id} className="admin_user_mgmt_row">
                        <div className="admin_user_mgmt_info">
                          <div className="admin_user_mgmt_name">
                            {u.username ? `@${u.username}` : u.email}
                            {isRoot && <span className="admin_admin_root_badge">ROOT</span>}
                            {u.is_banned && <span className="admin_user_banned_badge">BANNED</span>}
                          </div>
                          <div className="admin_admin_meta">
                            {u.email} · {(u.providers || []).join(", ")}
                            {u.last_sign_in_at
                              ? ` · last login ${new Date(u.last_sign_in_at).toLocaleDateString("en-IN")}`
                              : " · never logged in"}
                          </div>
                        </div>

                        {!isRoot && (
                          <div className="admin_user_mgmt_actions">
                            <label className="admin_user_remove_content_label">
                              <input
                                type="checkbox"
                                checked={!!removeContentMap[u.id]}
                                onChange={() => toggleRemoveContent(u.id)}
                                disabled={busy}
                              />
                              also delete their content
                            </label>
                            <div style={{ display: "flex", gap: "8px" }}>
                              {u.is_banned ? (
                                <button
                                  className="admin_action_btn admin_action_btn--dismiss"
                                  onClick={() => unbanUser(u)}
                                  disabled={busy}
                                >
                                  {busy ? "..." : "✓ Unban"}
                                </button>
                              ) : (
                                <button
                                  className="admin_action_btn admin_action_btn--delete"
                                  onClick={() => banUser(u)}
                                  disabled={busy}
                                >
                                  {busy ? "..." : "🚫 Ban"}
                                </button>
                              )}
                              <button
                                className="admin_action_btn admin_action_btn--delete"
                                onClick={() => deleteUserAccount(u)}
                                disabled={busy}
                              >
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
            </>
          )}
        </div>
      ) : activeTab === "hub" ? (
        /* ── Home Hub Tab: show/hide/reorder HomeHub.jsx's tabs ── */
        <div className="admin_hub_section">
          <p className="admin_words_hint">
            Controls which tabs appear in the homepage's tab bar, in what
            order, and to whom. Changes apply live — no redeploy needed.
            At least one tab always stays visible for every viewer;
            hiding or over-restricting all of them falls back to showing
            everything rather than leaving the homepage empty.
          </p>

          {hubTabsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading tab config...</p>
            </div>
          ) : hubTabs.length === 0 ? (
            <div className="admin_empty">
              <div style={{ fontSize: "48px" }}>🏠</div>
              <p>No tab config found — run the home_hub_tabs migration</p>
            </div>
          ) : (
            <div className="admin_hub_list">
              {hubTabs.map((t, i) => {
                const busy = hubTabBusyKey === t.key;
                return (
                  <div key={t.key} className="admin_hub_row">
                    <div className="admin_hub_reorder">
                      <button
                        className="admin_hub_reorder_btn"
                        onClick={() => moveHubTab(t, -1)}
                        disabled={busy || i === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="admin_hub_reorder_btn"
                        onClick={() => moveHubTab(t, 1)}
                        disabled={busy || i === hubTabs.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="admin_hub_info">
                      <div className="admin_hub_label">{t.label}</div>
                      <div className="admin_admin_meta">key: {t.key}</div>
                    </div>

                    <select
                      className="admin_hub_audience_select"
                      value={t.audience || "everyone"}
                      onChange={(e) => setHubTabAudience(t, e.target.value)}
                      disabled={busy}
                      title="Who this tab is shown to"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="logged_in">Logged-in only</option>
                      <option value="guests_only">Guests only</option>
                    </select>

                    <label className={`admin_hub_toggle ${t.is_visible ? "on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={t.is_visible}
                        onChange={() => toggleHubTabVisibility(t)}
                        disabled={busy}
                      />
                      <span className="admin_hub_toggle_track">
                        <span className="admin_hub_toggle_thumb" />
                      </span>
                      <span className="admin_hub_toggle_label">{t.is_visible ? "Visible" : "Hidden"}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="admin_words_section">
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