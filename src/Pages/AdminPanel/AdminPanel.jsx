import React, { useState, useEffect } from "react";
import "./AdminPanel.css";
// NEW: styles for the Users tab serial number + online/offline indicator.
// Kept in its own file so the existing AdminPanel.css doesn't need editing.
import "./AdminPanelUsersStatus.css";
// NEW: styles for the Installs tab (PWA install stats).
import "./AdminPanelInstalls.css";
// NEW: styles for the upgrade components (pager, modal, bulk bar, etc.).
import "./AdminPanelUpgrades.css";
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
// the merged "Export Report" menu. Requires:
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
import ReportPreviewModal from "./ReportPreviewModal";
// NEW: upgrade components
import AdminReportsPanel from "./AdminReportsPanel";
import AdminUsersTab from "./AdminUsersTab";
import AdminLoginsTable from "./AdminLoginsTable";
import AdminUserDetail from "./AdminUserDetail";
import AdminAnalyticsTab from "./AdminAnalyticsTab";
import AdminAuditTab from "./AdminAuditTab";
import AdminContentTab from "./AdminContentTab";
import { BarChart } from "./AdminCharts";
import { logAdminAction, fetchMyRole, notifyNewReport, fetchAllRows } from "./adminHelpers";

// ── Root admin(s) ────────────────────────────────────────────────────────────
// Hardcoded fallback so the app can never be locked out even if the
// admin_users table is empty, unreachable, or something goes wrong with
// the API route below. Anyone in this list is ALWAYS an admin, and can
// never be removed via the Admins tab or deleted via the Users tab.
const ADMIN_EMAILS = ["laxminarayan.rajbhar@gmail.com"];

// A user counts as "online" if their site_visits row heartbeat
// (sent every ~20s by useVisitTracking.js) was updated within this window.
// 60s = three missed heartbeats before someone flips to Offline.
const ONLINE_WINDOW_MS = 60 * 1000;

// Visitors tab paging + date filter. Supabase caps a single request at
// 1,000 rows, so we load in pages and use exact COUNT queries for the totals.
const VISITS_PAGE = 300;
const VISIT_RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];
// Returns an ISO timestamp for the start of the range, or null for "all".
const visitRangeStart = (key) => {
  const now = new Date();
  if (key === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (key === "7d") return new Date(Date.now() - 7 * 86400000).toISOString();
  if (key === "30d") return new Date(Date.now() - 30 * 86400000).toISOString();
  return null;
};

// ── IP → approximate location ────────────────────────────────────────────────
// The Logins/Users data only contains each user's last IP address, so the
// location shown is derived from that IP (city/region/country level — it is
// approximate, and can point to the ISP's hub rather than the user's exact
// spot, especially on mobile data or VPNs).
//
// Lookups use ipwho.is (free, HTTPS, CORS-enabled, no API key). Results are
// cached in localStorage for 7 days so each IP is only looked up once.
//
// NOTE: this sends your users' IP addresses to a third-party service from
// the admin's browser. If the API route returns `last_geo` per user (see the
// patch guide, step 16) those results are used first and this is only a fallback.
const GEO_CACHE_KEY = "zx_admin_ip_geo_v1";
const GEO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GEO_CONCURRENCY = 4;

// Private / loopback / link-local addresses can't be geolocated.
const isPrivateIp = (ip) =>
  !ip ||
  ip === "::1" ||
  /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
  /^(fc|fd|fe80)/i.test(ip);

const readGeoCache = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
    const now = Date.now();
    const out = {};
    Object.entries(raw).forEach(([ip, v]) => {
      if (v && !v.failed && now - v.t < GEO_TTL_MS) out[ip] = v;
    });
    return out;
  } catch {
    return {};
  }
};

const writeGeoCache = (cache) => {
  try {
    const persist = {};
    Object.entries(cache).forEach(([ip, v]) => {
      if (v && !v.failed) persist[ip] = v; // never persist failures — retry next time
    });
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(persist));
  } catch {
    /* storage full / blocked — ignore */
  }
};

// Returns { t, city, region, country, cc } or { t, failed: true }.
const lookupIp = async (ip) => {
  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,country_code`,
    );
    const j = await res.json();
    if (!j || j.success === false) return { t: Date.now(), failed: true };
    return {
      t: Date.now(),
      city: j.city || "",
      region: j.region || "",
      country: j.country || "",
      cc: j.country_code || "",
    };
  } catch {
    return { t: Date.now(), failed: true };
  }
};

// "India" → 🇮🇳 (regional-indicator pair from the ISO country code)
const flagEmoji = (cc) =>
  cc && /^[A-Za-z]{2}$/.test(cc)
    ? String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)))
    : "";

// Plain "City, Region, Country" text (no flag) — used for UI, search & exports.
const geoText = (g) => {
  if (!g || g.failed) return "";
  const parts = [g.city, g.region, g.country].filter(Boolean);
  return parts.filter((p, i) => parts.indexOf(p) === i).join(", ");
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

// Downloads an in-memory Blob as a file — shared by the Word exports
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

// A report that still needs a decision.
const isOpenReport = (r) => r.status === "pending" || r.status === "reviewed";

const AdminPanel = () => {
  const currentUser = localStorage.getItem("username") || "";

  // ── Auth check, step 1: Supabase auth-session email ──
  const [authChecked, setAuthChecked] = useState(false);
  const [authEmail, setAuthEmail] = useState("");

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
  const [isDbAdmin, setIsDbAdmin] = useState(false);

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

  const callManageAdmin = (body) => callApi("/api/manage-admin", body);
  const callUserLoginInfo = () => callApi("/api/user-login-info", {});
  const callModerateUser = (body) => callApi("/api/moderate-user", body);
  const callManageHomeHub = (body) => callApi("/api/manage-home-hub-tabs", body);

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

  // ── NEW: role (root / admin / moderator) ────────────────────────────────
  // NOTE: this only hides buttons in the UI. Enforce the same rule in the
  // /api routes (reject role === "moderator") so it can't be bypassed.
  const [role, setRole] = useState(null);
  useEffect(() => {
    if (!isAdmin) return;
    if (isHardcodedAdmin) {
      setRole("root");
      return;
    }
    fetchMyRole().then((r) => setRole(r || "admin"));
  }, [isAdmin, isHardcodedAdmin]);
  const isRootAdmin = role === "root";
  const canDestroy = role === "root" || role === "admin"; // moderators: review reports only

  const [reports, setReports] = useState([]);
  const [bannedWords, setBannedWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("reports");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [newWord, setNewWord] = useState("");
  const [wordSaving, setWordSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState("");
  const [previewReport, setPreviewReport] = useState(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Merged export menu state (Full report / Logins only × Excel / Word / PDF)
  const [exportingWord, setExportingWord] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportScope, setExportScope] = useState("all"); // "all" | "logins"
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsLoaded, setVisitsLoaded] = useState(false);
  // Date filter, exact counts (null until loaded) and "load more" state
  const [visitRange, setVisitRange] = useState("all");
  const [visitsTotal, setVisitsTotal] = useState(null);
  const [visitsLoggedIn, setVisitsLoggedIn] = useState(null);
  const [visitsLoadingMore, setVisitsLoadingMore] = useState(false);
  // NEW: whole-range aggregates from the admin_visit_stats() RPC
  // (unique sessions + avg. duration over ALL visits, not just loaded rows).
  const [visitAgg, setVisitAgg] = useState(null);
  // Hide visits whose duration is 0s (left before the first ~20s
  // heartbeat — bots / instant bounces). Filtered in the DATABASE via the
  // generated `duration_seconds` column, so the cards, the counts and the
  // table all agree. `zeroHidden` = how many are currently hidden.
  const [hideZeroVisits, setHideZeroVisits] = useState(true);
  const [zeroHidden, setZeroHidden] = useState(null);

  // ── "Installs" tab state (PWA install stats) ────────────────────────────
  // Filled by the pwa_install_stats() Supabase function (admin-only).
  const [installStats, setInstallStats] = useState(null);
  const [installsLoading, setInstallsLoading] = useState(false);
  const [installsLoaded, setInstallsLoaded] = useState(false);
  const [installsError, setInstallsError] = useState("");

  // ── "Admins" tab state ──────────────────────────────────────────────────
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminsLoaded, setAdminsLoaded] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("admin"); // NEW
  const [grantLoading, setGrantLoading] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState(null);

  // ── "Logins" tab state ───────────────────────────────────────────────────
  const [loginRows, setLoginRows] = useState([]);
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginsLoaded, setLoginsLoaded] = useState(false);
  const [exportingLoginsXlsx, setExportingLoginsXlsx] = useState(false);
  const [exportingLoginsWord, setExportingLoginsWord] = useState(false);
  const [exportingLoginsPdf, setExportingLoginsPdf] = useState(false);

  // ── "Users" tab state ────────────────────────────────────────────────────
  // Reuses the same data source as the Logins tab (api/user-login-info.js
  // returns everything needed: username, email, ban status). Kept as a
  // SEPARATE fetch/loaded flag from the Logins tab so opening one doesn't
  // silently also mark the other as "loaded" with stale data — each tab
  // refreshes independently.
  const [userRows, setUserRows] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [moderatingId, setModeratingId] = useState(null); // userId currently being acted on
  const [removeContentMap, setRemoveContentMap] = useState({}); // userId -> bool, "also delete content" checkbox state
  // Lowercase usernames that currently have a fresh site_visits heartbeat.
  const [onlineUsernames, setOnlineUsernames] = useState(new Set());
  // Total registered users for the header counter (cheap head-count query).
  const [profilesTotal, setProfilesTotal] = useState(null);
  // NEW: user detail modal
  const [detailUser, setDetailUser] = useState(null);

  // IP → location cache shared by the Users and Logins tabs.
  //   ipGeo            — ip -> { city, region, country, cc } | { failed: true }
  //   geoAttemptedRef  — IPs already queued this session (prevents re-fetch loops)
  const [ipGeo, setIpGeo] = useState(() => readGeoCache());
  const geoAttemptedRef = React.useRef(new Set());

  // ── NEW: header toggles ──────────────────────────────────────────────────
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("zx_admin_sound") !== "0");
  const soundRef = React.useRef(soundOn); // lets the realtime callback read the latest value
  soundRef.current = soundOn;

  // ── NEW: banned words search + bulk import ───────────────────────────────
  const [wordSearch, setWordSearch] = useState("");
  const [bulkWords, setBulkWords] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── "Home Hub" tab state ─────────────────────────────────────────────────
  // Controls which tabs show in HomeHub.jsx's tab bar (Home/Posts/Utility)
  // and in what order. Writes go through /api/manage-home-hub-tabs (same
  // admin-token pattern as callManageAdmin) rather than direct client
  // writes, since the home_hub_tabs table's RLS only grants SELECT to
  // the anon/authenticated roles.
  const [hubTabs, setHubTabs] = useState([]);
  const [hubTabsLoading, setHubTabsLoading] = useState(false);
  const [hubTabsLoaded, setHubTabsLoaded] = useState(false);
  const [hubTabBusyKey, setHubTabBusyKey] = useState(null);
  const [hubOverrides, setHubOverrides] = useState([]); // [{tab_key, username, show}]
  const [expandedHubKey, setExpandedHubKey] = useState(null); // which tab's override panel is open
  const [overrideDraft, setOverrideDraft] = useState({ username: "", show: true });
  const [overrideSaving, setOverrideSaving] = useState(false);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        fetchReports();
        if (soundRef.current) notifyNewReport(payload.new); // NEW: sound + desktop notification
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
      const rep = reports.find((r) => r.id === reportId);
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status, admin_note: adminNote } : r));
      // NEW: audit log
      logAdminAction(
        `report_${status}`,
        "report",
        rep ? `${rep.content_type}: ${rep.content_title}` : String(reportId),
        adminNote,
        { report_id: reportId },
      );
      showToast(`Report marked as ${status}`);
    }
    setActionLoading(null);
  };

  // CHANGED: asks for confirmation, writes an audit-log entry and returns
  // true when the content was actually deleted.
  const deleteContent = async (report) => {
    if (!window.confirm(
      `Delete this ${report.content_type}?\n\n"${report.content_title}" by @${report.content_owner}\n\nThis cannot be undone.`,
    )) return false;

    setActionLoading(report.id + "delete");
    let ok = false;
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
      } else {
        const table = report.content_type === "reel" ? "reels"
          : report.content_type === "video" ? "videos"
            : "posts";
        const rawId = String(report.content_id).replace("db_", "");
        const { error } = await supabase.from(table).delete().eq("id", rawId);
        if (error) throw error;
        await updateReportStatus(report.id, "removed", "Content deleted by admin");
      }
      logAdminAction(
        "delete_content",
        "content",
        `${report.content_type}: ${report.content_title} (@${report.content_owner})`,
        "from report",
        { report_id: report.id },
      );
      showToast("✅ Content deleted and report closed");
      ok = true;
    } catch (e) {
      showToast("❌ Failed to delete content");
    }
    setActionLoading(null);
    return ok;
  };

  // NEW: grouped card — delete the content once, then close every other
  // open report that was filed against the same content.
  const deleteGroup = async (g) => {
    const ok = await deleteContent(g.first);
    if (!ok) return;
    for (const r of g.reports.filter((x) => x.id !== g.first.id && isOpenReport(x))) {
      await updateReportStatus(r.id, "removed", "Content deleted by admin");
    }
  };

  // NEW: dismiss / mark-reviewed every open report in a grouped card.
  const setGroupStatus = async (g, status) => {
    for (const r of g.reports.filter(isOpenReport)) await updateReportStatus(r.id, status);
  };

  // NEW: saves the ban reason. Looks the user id up by username when only a
  // username is known (e.g. banning from a report card).
  const recordBan = async (userId, username, reason) => {
    let id = userId;
    if (!id && username) {
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      id = data?.id;
    }
    if (id) {
      await supabase.rpc("record_ban", { p_user_id: id, p_username: username || null, p_reason: reason || "" });
    }
  };

  // CHANGED: bans the account that uploaded/owns the reported content,
  // directly from a report card, now with a reason (saved in the audit log
  // and the ban list). Resolves the target purely by username
  // (report.content_owner) — the server looks up the actual auth user id via
  // the profiles table. Does NOT delete their content.
  const banUploaderFromReport = async (report) => {
    if (!report.content_owner) return;
    const reason = window.prompt(
      `Ban @${report.content_owner}? They will no longer be able to log in. Existing content is NOT deleted.\n\nReason (saved in the audit log):`,
      "",
    );
    if (reason === null) return; // cancelled

    setActionLoading(report.id + "ban");
    try {
      await callModerateUser({ action: "ban", username: report.content_owner, reason });
      await recordBan(null, report.content_owner, reason);
      logAdminAction("ban_user", "user", `@${report.content_owner}`, reason, { from_report: report.id });
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
      logAdminAction("add_banned_word", "word", word);
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
    logAdminAction("remove_banned_word", "word", word);
    showToast(`"${word}" removed`);
  };

  // NEW: paste a list (one per line or comma-separated) and add them all at once.
  const importBannedWords = async () => {
    const words = [...new Set(bulkWords.split(/[\n,]+/).map((w) => w.trim().toLowerCase()).filter(Boolean))];
    const existing = new Set(bannedWords.map((w) => (w.word || "").toLowerCase()));
    const fresh = words.filter((w) => !existing.has(w));
    if (!fresh.length) {
      showToast("No new words to add");
      return;
    }
    setWordSaving(true);
    const { data, error } = await supabase
      .from("banned_words")
      .insert(fresh.map((word) => ({ word, added_by: currentUser })))
      .select();
    if (error) {
      showToast(`❌ ${error.message}`);
    } else {
      setBannedWords((prev) => [...(data || []), ...prev]);
      setBulkWords("");
      setBulkOpen(false);
      logAdminAction("bulk_add_banned_words", "word", `${(data || []).length} words`);
      showToast(`✅ Added ${(data || []).length} words`);
    }
    setWordSaving(false);
  };

  // ── Visitors tab ─────────────────────────────────────────────────────────────
  // Loads the first page + exact counts for the chosen date range.
  // NOTE: always call as fetchVisits() or fetchVisits("7d") — never pass it
  // straight to onClick, or the click event would be used as the range.
  //
  // When `hideZero` is on, visits with duration_seconds = 0 are excluded in
  // the DATABASE query (page + both counts), so the cards, the "Showing X of Y"
  // line and the table all agree. A fourth, unfiltered count is only used to
  // tell the admin how many were hidden. CHANGED: a fifth call, the
  // admin_visit_stats() RPC, supplies unique sessions + avg. duration for the
  // WHOLE range (falls back to loaded rows if the SQL hasn't been run).
  const fetchVisits = async (range = visitRange, hideZero = hideZeroVisits) => {
    setVisitsLoading(true);
    const since = visitRangeStart(range);
    const inRange = (q) => (since ? q.gte("started_at", since) : q);
    const scoped = (q) => {
      q = inRange(q);
      return hideZero ? q.gt("duration_seconds", 0) : q;
    };

    const [pageRes, totalRes, loggedInRes, allRes, aggRes] = await Promise.all([
      scoped(supabase.from("site_visits").select("*"))
        .order("started_at", { ascending: false })
        .range(0, VISITS_PAGE - 1),
      scoped(supabase.from("site_visits").select("id", { count: "exact", head: true })),
      scoped(
        supabase.from("site_visits").select("id", { count: "exact", head: true }).not("username", "is", null),
      ),
      hideZero
        ? inRange(supabase.from("site_visits").select("id", { count: "exact", head: true }))
        : Promise.resolve(null),
      supabase.rpc("admin_visit_stats", { p_since: since, p_hide_zero: hideZero }),
    ]);

    // Column missing (the duration_seconds SQL hasn't been run yet)?
    // Fall back to showing everything instead of an empty tab.
    if (hideZero && pageRes.error) {
      showToast("❌ Run the duration_seconds SQL first — showing all visits");
      setHideZeroVisits(false);
      setVisitsLoading(false);
      return fetchVisits(range, false);
    }

    if (!pageRes.error && pageRes.data) setVisits(pageRes.data);
    setVisitsTotal(totalRes.error ? null : totalRes.count);
    setVisitsLoggedIn(loggedInRes.error ? null : loggedInRes.count);
    setVisitAgg(aggRes && !aggRes.error ? aggRes.data : null);
    setZeroHidden(
      hideZero && allRes && !allRes.error && !totalRes.error
        ? Math.max(0, allRes.count - totalRes.count)
        : null,
    );
    setVisitsLoading(false);
    setVisitsLoaded(true);
  };

  const changeVisitRange = (range) => {
    if (range === visitRange) return;
    setVisitRange(range);
    fetchVisits(range);
  };

  // Flips the "Hide 0s visits" checkbox and reloads with the new value.
  const toggleHideZeroVisits = () => {
    const next = !hideZeroVisits;
    setHideZeroVisits(next);
    fetchVisits(visitRange, next);
  };

  // Appends the next page. New visits arriving mid-session can shift the
  // offsets, so rows are de-duplicated by id.
  const loadMoreVisits = async () => {
    if (visitsLoadingMore) return;
    setVisitsLoadingMore(true);
    const since = visitRangeStart(visitRange);
    let q = supabase.from("site_visits").select("*");
    if (since) q = q.gte("started_at", since);
    if (hideZeroVisits) q = q.gt("duration_seconds", 0);
    const { data, error } = await q
      .order("started_at", { ascending: false })
      .range(visits.length, visits.length + VISITS_PAGE - 1);
    if (!error && data) {
      setVisits((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...data.filter((v) => !seen.has(v.id))];
      });
    } else if (error) {
      showToast(`❌ ${error.message}`);
    }
    setVisitsLoadingMore(false);
  };

  useEffect(() => {
    if (activeTab === "visitors" && !visitsLoaded && !visitsLoading) {
      fetchVisits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // NEW: auto-refresh Reports / Visitors every 30s when the header toggle is on.
  useEffect(() => {
    if (!isAdmin || !autoRefresh) return;
    const id = setInterval(() => {
      if (activeTab === "reports") fetchReports();
      if (activeTab === "visitors") fetchVisits();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, autoRefresh, activeTab, visitRange, hideZeroVisits]);

  // Total / logged-in / guests / unique sessions / avg. duration come from
  // exact database aggregates over the whole date range (CHANGED). If the
  // admin_visit_stats() SQL hasn't been run, unique sessions and avg. duration
  // fall back to the loaded rows only.
  const visitStats = React.useMemo(() => {
    const totalVisits = visitAgg?.total ?? visitsTotal ?? visits.length;
    const uniqueSessions = visitAgg?.unique_sessions ?? new Set(visits.map((v) => v.session_id)).size;
    const loggedIn = visitAgg?.logged_in ?? visitsLoggedIn ?? visits.filter((v) => !!v.username).length;
    const guests = Math.max(0, totalVisits - loggedIn);
    const durationsSec = visits.map((v) => {
      const start = new Date(v.started_at).getTime();
      const last = new Date(v.last_active_at).getTime();
      return Math.max(0, (last - start) / 1000);
    });
    const avgDurationSec =
      visitAgg?.avg_seconds ??
      (durationsSec.length ? durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length : 0);
    return { totalVisits, uniqueSessions, loggedIn, guests, avgDurationSec };
  }, [visits, visitsTotal, visitsLoggedIn, visitAgg]);

  // ── Installs tab — PWA install stats ───────────────────────────────────────
  // Calls the admin-only pwa_install_stats() Supabase function. The raw
  // pwa_installs table is insert-only for the public, so it cannot be read
  // directly from the browser.
  const fetchInstalls = async () => {
    setInstallsLoading(true);
    setInstallsError("");
    try {
      const { data, error } = await supabase.rpc("pwa_install_stats");
      if (error) throw error;
      setInstallStats(data || null);
    } catch (e) {
      setInstallsError(e.message || "Failed to load install stats");
      showToast(`❌ ${e.message || "Failed to load install stats"}`);
    }
    setInstallsLoading(false);
    setInstallsLoaded(true);
  };

  useEffect(() => {
    if (activeTab === "installs" && !installsLoaded && !installsLoading) {
      fetchInstalls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      // NEW: only root can hand out the moderator role (enforced in SQL too).
      if (isRootAdmin && newAdminRole === "moderator") {
        const { error } = await supabase.rpc("set_admin_role", { p_email: email, p_role: "moderator" });
        if (error) showToast(`⚠️ Admin granted, but role not set: ${error.message}`);
      }
      logAdminAction("grant_admin", "admin", email, "", { role: newAdminRole });
      showToast(
        r.createdAccount
          ? `✅ Account created & admin granted for ${email}`
          : `✅ Admin access granted for ${email}`
      );
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminRole("admin");
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
      logAdminAction("remove_admin", "admin", email);
      showToast(`"${email}" removed from admins`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setRevokingEmail(null);
  };

  // NEW: seeds the location cache from `last_geo` when the API returns it
  // (server-side lookup, patch guide step 16). Harmless if it doesn't.
  const seedGeo = (users) =>
    setIpGeo((prev) => {
      const n = { ...prev };
      (users || []).forEach((u) => {
        if (u.last_ip && u.last_geo && !n[u.last_ip]) n[u.last_ip] = { t: Date.now(), ...u.last_geo };
      });
      return n;
    });

  // ── Logins tab: login method + last login + IP/device per user ─────────────
  const fetchLogins = async () => {
    setLoginsLoading(true);
    try {
      const [{ users }] = await Promise.all([callUserLoginInfo(), fetchOnlineUsers()]);
      seedGeo(users);
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
    seedGeo(users);
    setLoginRows(users || []);
    setLoginsLoaded(true);
    return users || [];
  };

  // Location text for exports. Empty string when the IP hasn't been
  // looked up yet (open the Logins/Users tab first so lookups can run).
  const exportLocation = (ip) => {
    if (!ip) return "";
    if (isPrivateIp(ip)) return "Local network";
    return geoText(ipGeo[ip]);
  };

  const loginRowsToTableData = (rows) =>
    rows.map((r) => [
      r.username || "—",
      r.email || "—",
      (r.providers || []).join(", "),
      r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("en-IN") : "Never",
      r.last_ip || "—",
      exportLocation(r.last_ip) || "—",
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
        Location: exportLocation(r.last_ip),
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
      const headerCells = ["Username", "Email", "Login Method", "Last Login", "Last IP", "Location", "Last Device"];

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
        head: [["Username", "Email", "Login Method", "Last Login", "Last IP", "Location", "Last Device"]],
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

  // ── Users tab: ban/unban/delete + online status ────────────────────────────
  // Reads which usernames have a site_visits heartbeat within the last
  // ONLINE_WINDOW_MS. Same direct-client read the Visitors tab already uses.
  const fetchOnlineUsers = async () => {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const { data, error } = await supabase
      .from("site_visits")
      .select("username")
      .not("username", "is", null)
      .gte("last_active_at", since);
    if (!error && data) {
      setOnlineUsernames(new Set(data.map((v) => v.username.toLowerCase())));
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const [{ users }] = await Promise.all([callUserLoginInfo(), fetchOnlineUsers()]);
      seedGeo(users);
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

  // Online status + header total load as soon as the admin panel opens and
  // refresh every 20s on EVERY tab (header counter), not only on Users / Logins.
  useEffect(() => {
    if (!isAdmin) return;
    fetchOnlineUsers();
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (!error && count != null) setProfilesTotal(count);
      });
    const id = setInterval(fetchOnlineUsers, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Look up the location of every not-yet-known IP shown on the Users /
  // Logins tabs (max GEO_CONCURRENCY requests at a time). Already-cached and
  // already-attempted IPs are skipped, so this is cheap to re-run.
  useEffect(() => {
    if (activeTab !== "users" && activeTab !== "logins") return;

    const ips = [...new Set([...userRows, ...loginRows].map((r) => r.last_ip).filter(Boolean))].filter(
      (ip) => !isPrivateIp(ip) && !ipGeo[ip] && !geoAttemptedRef.current.has(ip),
    );
    if (!ips.length) return;

    ips.forEach((ip) => geoAttemptedRef.current.add(ip));
    const queue = [...ips];

    const worker = async () => {
      while (queue.length) {
        const ip = queue.shift();
        const entry = await lookupIp(ip);
        setIpGeo((prev) => ({ ...prev, [ip]: entry }));
      }
    };
    for (let i = 0; i < Math.min(GEO_CONCURRENCY, ips.length); i++) worker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userRows, loginRows]);

  // Persist successful lookups so reopening the panel is instant.
  useEffect(() => {
    writeGeoCache(ipGeo);
  }, [ipGeo]);

  // What to show in the UI for an IP's location.
  const geoLabelFor = (ip) => {
    if (!ip) return "—";
    if (isPrivateIp(ip)) return "Local network";
    const g = ipGeo[ip];
    if (!g) return "Looking up…";
    if (g.failed) return "Unknown";
    const text = geoText(g);
    if (!text) return "Unknown";
    const flag = flagEmoji(g.cc);
    return flag ? `${flag} ${text}` : text;
  };

  const toggleRemoveContent = (userId) => {
    setRemoveContentMap((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // CHANGED: takes an optional reason (collected by AdminUsersTab), saves it
  // to the ban list and writes an audit-log entry.
  const banUser = async (user, reason = "") => {
    const label = user.username ? `@${user.username}` : user.email;
    const wipe = !!removeContentMap[user.id];
    const confirmed = window.confirm(
      `Ban ${label}? They will no longer be able to log in.${wipe ? " Their videos, reels, and posts will ALSO be permanently deleted." : ""}`,
    );
    if (!confirmed) return;

    setModeratingId(user.id);
    try {
      await callModerateUser({
        action: "ban",
        userId: user.id,
        username: user.username,
        removeContent: wipe,
        reason,
      });
      await recordBan(user.id, user.username, reason);
      logAdminAction("ban_user", "user", label, reason, { removeContent: wipe });
      setUserRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_banned: true } : u)));
      showToast(`🚫 ${label} banned`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  const unbanUser = async (user) => {
    const label = user.username ? `@${user.username}` : user.email;
    setModeratingId(user.id);
    try {
      await callModerateUser({ action: "unban", userId: user.id, username: user.username });
      await supabase.rpc("clear_ban", { p_user_id: user.id });
      logAdminAction("unban_user", "user", label);
      setUserRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_banned: false } : u)));
      showToast(`✅ ${label} unbanned`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  const deleteUserAccount = async (user) => {
    const label = user.username ? `@${user.username}` : user.email;
    const wipeContent = !!removeContentMap[user.id];
    const confirmed = window.confirm(
      `Permanently delete the account for ${label}? This cannot be undone.${wipeContent ? " Their videos, reels, and posts will ALSO be permanently deleted." : " Their existing content will be kept but no longer tied to a valid login."
      }`,
    );
    if (!confirmed) return;
    const reason = window.prompt("Reason (saved in the audit log, optional):", "") ?? "";

    setModeratingId(user.id);
    try {
      await callModerateUser({
        action: "delete",
        userId: user.id,
        username: user.username,
        removeContent: wipeContent,
      });
      await supabase.rpc("clear_ban", { p_user_id: user.id });
      logAdminAction("delete_account", "user", label, reason, { removeContent: wipeContent });
      setUserRows((prev) => prev.filter((u) => u.id !== user.id));
      showToast("🗑️ Account deleted");
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setModeratingId(null);
  };

  // NEW: bulk ban / unban (sequential, so one failure doesn't stop the rest).
  const bulkBan = async (users, reason) => {
    if (!window.confirm(`Ban ${users.length} users? They will no longer be able to log in.`)) return;
    let ok = 0;
    for (const u of users) {
      try {
        await callModerateUser({ action: "ban", userId: u.id, username: u.username, reason });
        await recordBan(u.id, u.username, reason);
        setUserRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: true } : x)));
        ok++;
      } catch (e) {
        showToast(`❌ ${u.username || u.email}: ${e.message}`);
      }
    }
    logAdminAction("bulk_ban", "user", `${ok} users`, reason, { users: users.map((u) => u.username || u.email) });
    showToast(`🚫 ${ok} of ${users.length} banned`);
  };

  const bulkUnban = async (users) => {
    let ok = 0;
    for (const u of users) {
      try {
        await callModerateUser({ action: "unban", userId: u.id, username: u.username });
        await supabase.rpc("clear_ban", { p_user_id: u.id });
        setUserRows((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: false } : x)));
        ok++;
      } catch (e) {
        showToast(`❌ ${u.username || u.email}: ${e.message}`);
      }
    }
    logAdminAction("bulk_unban", "user", `${ok} users`, "", { users: users.map((u) => u.username || u.email) });
    showToast(`✅ ${ok} of ${users.length} unbanned`);
  };

  // Online helpers for the Users + Logins tabs.
  const isUserOnline = (u) =>
    !!u.username && onlineUsernames.has(u.username.toLowerCase());

  // Header counter values. Total uses the full user list once the Users
  // tab has loaded it (so both numbers always agree), otherwise a quick count.
  const headerOnline = onlineUsernames.size;
  const headerTotal = usersLoaded ? userRows.length : profilesTotal;

  // NEW: top countries for the Analytics tab, built from the IP lookups above.
  // (Must stay above the early returns below — it's a hook.)
  const countryCounts = React.useMemo(() => {
    const src = userRows.length ? userRows : loginRows;
    const m = {};
    src.forEach((r) => {
      const g = r.last_ip && ipGeo[r.last_ip];
      if (g && !g.failed && g.country) {
        const k = `${flagEmoji(g.cc)} ${g.country}`.trim();
        m[k] = (m[k] || 0) + 1;
      }
    });
    return Object.entries(m)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [userRows, loginRows, ipGeo]);

  // ── Home Hub tab: fetch / toggle / reorder ──────────────────────────────
  const fetchHubTabs = async () => {
    setHubTabsLoading(true);
    try {
      const { tabs, overrides } = await callManageHomeHub({ action: "list" });
      setHubTabs((tabs || []).slice().sort((a, b) => a.sort_order - b.sort_order));
      setHubOverrides(overrides || []);
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

  const setHubTabRollout = async (tab, pct) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 100));
    if (clamped === (tab.rollout_percent ?? 100)) return;
    setHubTabBusyKey(tab.key);
    try {
      await callManageHomeHub({ action: "set_rollout", key: tab.key, rollout_percent: clamped });
      setHubTabs((prev) => prev.map((t) => (t.key === tab.key ? { ...t, rollout_percent: clamped } : t)));
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setHubTabBusyKey(null);
  };

  const addHubOverride = async (tabKey) => {
    const username = overrideDraft.username.trim();
    if (!username || overrideSaving) return;
    setOverrideSaving(true);
    try {
      await callManageHomeHub({ action: "add_override", key: tabKey, username, show: overrideDraft.show });
      setHubOverrides((prev) => [
        { tab_key: tabKey, username, show: overrideDraft.show },
        ...prev.filter((o) => !(o.tab_key === tabKey && o.username === username)),
      ]);
      setOverrideDraft({ username: "", show: true });
      showToast(`@${username} ${overrideDraft.show ? "forced into" : "forced out of"} this tab`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setOverrideSaving(false);
  };

  const removeHubOverride = async (tabKey, username) => {
    setOverrideSaving(true);
    try {
      await callManageHomeHub({ action: "remove_override", key: tabKey, username });
      setHubOverrides((prev) => prev.filter((o) => !(o.tab_key === tabKey && o.username === username)));
      showToast(`Override for @${username} removed`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setOverrideSaving(false);
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

  // ── Shared export data fetcher (full-report Excel/Word/PDF export) ─────────
  // CHANGED: every table is read in pages of 1,000 (fetchAllRows), so exports
  // are no longer silently cut off at Supabase's 1,000-row request limit.
  // If a table has no `id` column, pass another one, e.g.
  // fetchAllRows("views", "viewed_at").
  const fetchExportData = async () => {
    const [profiles, videos, reels, posts, postComments, postReactions, likes, views] =
      await Promise.all([
        fetchAllRows("profiles"),
        fetchAllRows("videos"),
        fetchAllRows("reels"),
        fetchAllRows("posts"),
        fetchAllRows("post_comments"),
        fetchAllRows("post_reactions"),
        fetchAllRows("likes"),
        fetchAllRows("views"),
      ]);

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
        Location: exportLocation(login?.last_ip),
        "Last Device": login?.last_device || "",
        "Account Status": login?.is_banned ? "Banned" : "Active",
      };
    });

    return { profiles, videos, reels, posts, postComments, postReactions, likes, views, usersSheet };
  };

  // ── Full report → Excel ─────────────────────────────────────────────────────
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

      addSheet(usersSheet, "Users");
      addSheet(videos, "Videos");
      addSheet(reels, "Reels");
      addSheet(posts, "Posts");
      addSheet(postComments, "Post Comments");
      addSheet(postReactions, "Post Reactions");
      addSheet(likes, "Likes");
      addSheet(views, "Views");

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

  // ── Full report → PDF ───────────────────────────────────────────────────────
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
        ["Username", "Videos", "Reels", "Posts", "Comments", "Login Method", "Last Login", "Location", "Status"],
        usersSheet.map((u) => [
          u.Username,
          u["Videos Uploaded"],
          u["Reels Uploaded"],
          u["Posts Made"],
          u["Post Comments Made"],
          u["Login Method"],
          u["Last Login"],
          u.Location,
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

  // ── Full report → Word ──────────────────────────────────────────────────────
  const exportToWord = async () => {
    if (exportingWord) return;
    setExportingWord(true);
    try {
      const { videos, reels, posts, postComments, postReactions, likes, views, usersSheet } =
        await fetchExportData();

      const MAX_ROWS = 1000; // keeps the .docx a sane size
      const day = (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "");

      const section = (title, head, body) => {
        const headerRow = new TableRow({
          tableHeader: true,
          children: head.map((h) =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
          ),
        });
        const rows = body.slice(0, MAX_ROWS).map(
          (cells) =>
            new TableRow({
              children: cells.map((c) => new TableCell({ children: [new Paragraph(String(c ?? ""))] })),
            }),
        );
        const parts = [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] }),
        ];
        if (body.length > MAX_ROWS) {
          parts.push(new Paragraph({
            text: `Showing the first ${MAX_ROWS} of ${body.length} rows. Use the Excel export for the complete data.`,
          }));
        }
        return parts;
      };

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "ZIXPLON — Full Report", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Generated ${new Date().toLocaleString("en-IN")}`, spacing: { after: 200 } }),
            ...section("Users Summary",
              ["Username", "Videos", "Reels", "Posts", "Comments", "Login Method", "Last Login", "Location", "Status"],
              usersSheet.map((u) => [u.Username, u["Videos Uploaded"], u["Reels Uploaded"], u["Posts Made"],
                u["Post Comments Made"], u["Login Method"], u["Last Login"], u.Location, u["Account Status"]])),
            ...section("Videos", ["Title", "Username", "Category", "Duration", "Likes", "Uploaded"],
              (videos || []).map((v) => [truncate(v.title, 50), v.username, v.category, v.duration, v.likes ?? 0, day(v.created_at)])),
            ...section("Reels", ["Title", "Username", "Duration", "Likes", "Uploaded"],
              (reels || []).map((r) => [truncate(r.title, 50), r.username, r.duration, r.likes ?? 0, day(r.created_at)])),
            ...section("Posts", ["Username", "Text", "Posted"],
              (posts || []).map((p) => [p.username, truncate(p.text, 90), day(p.created_at)])),
            ...section("Post Comments", ["Username", "Comment", "Posted"],
              (postComments || []).map((c) => [c.username, truncate(c.text, 90), day(c.created_at)])),
            ...section("Post Reactions", ["Username", "Reaction Type", "Post ID"],
              (postReactions || []).map((r) => [r.username, r.type, r.post_id])),
            ...section("Likes (Videos / Reels)", ["User ID", "Content Type", "Content ID"],
              (likes || []).map((l) => [l.user_id, l.content_type, l.content_id])),
            ...section("Content Views", ["User ID", "Content Type", "Content ID", "Viewed At"],
              (views || []).map((v) => [v.user_id, v.content_type, v.content_id,
                v.viewed_at ? new Date(v.viewed_at).toLocaleString("en-IN") : ""])),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `zixplon_export_${new Date().toISOString().slice(0, 10)}.docx`);
      showToast("✅ Word export downloaded");
    } catch (e) {
      console.error("[admin] Word export failed:", e);
      showToast(`❌ Word export failed: ${e.message || "unknown error"}`);
    } finally {
      setExportingWord(false);
    }
  };

  // True while ANY of the six export jobs is running (disables the menu button).
  const exportingAny =
    exportingExcel || exportingPdf || exportingWord ||
    exportingLoginsXlsx || exportingLoginsWord || exportingLoginsPdf;

  // Single entry point for the merged "Export Report" menu in the header.
  const runExport = (format) => {
    setExportMenuOpen(false);
    const full = exportScope === "all";
    logAdminAction("export_report", "export", `${full ? "full" : "logins"} · ${format}`); // NEW
    if (format === "xlsx") return full ? exportToExcel() : exportLoginsToExcel();
    if (format === "docx") return full ? exportToWord() : exportLoginsToWord();
    return full ? exportToPDF() : exportLoginsToPDF();
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

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  // Widest platform bar = 100% (guards against divide-by-zero)
  const platformMax = Math.max(1, ...((installStats?.by_platform || []).map((p) => p.devices)));

  // NEW: banned words filtered by the search box
  const shownWords = bannedWords.filter((w) =>
    (w.word || "").toLowerCase().includes(wordSearch.trim().toLowerCase()),
  );

  return (
    <div className="admin_panel">
      {toast && <div className="admin_toast">{toast}</div>}

      {previewReport && (
        <ReportPreviewModal
          report={previewReport}
          busy={!!actionLoading}
          onClose={() => setPreviewReport(null)}
          onDelete={async () => {
            await deleteContent(previewReport);
            setPreviewReport(null);
          }}
          onDismiss={async () => {
            await updateReportStatus(previewReport.id, "dismissed");
            setPreviewReport(null);
          }}
        />
      )}

      {/* NEW: user detail modal (opened from the Users tab) */}
      {detailUser && (
        <AdminUserDetail
          user={detailUser}
          locationLabel={geoLabelFor(detailUser.last_ip)}
          onClose={() => setDetailUser(null)}
        />
      )}

      <div className="admin_header">
        <div>
          {/* Live online / total counter + role next to the title */}
          <div className="admin_title_row">
            <h1 className="admin_title">🛡️ Admin Panel</h1>
            <span className="admin_online_pill" title="Logged-in users active in the last 60 seconds">
              🟢 {headerOnline} online · {headerTotal ?? "…"} total
            </span>
            {role && <span className="admin_role_pill">{role}</span>}
          </div>
          <p className="admin_subtitle">ZIXPLON Content Moderation</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {/* NEW: auto-refresh + new-report alerts */}
          <label className="admin_toggle_chip" title="Refresh Reports / Visitors every 30 seconds">
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
            Auto-refresh
          </label>
          <label className="admin_toggle_chip" title="Sound + desktop notification for new reports">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={() => {
                const next = !soundOn;
                setSoundOn(next);
                localStorage.setItem("zx_admin_sound", next ? "1" : "0");
                if (next && "Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission();
                }
              }}
            />
            Alerts
          </label>

          {/* Merged export: pick scope (Full report / Logins only), then format.
              Hidden for moderators — exports contain emails and IPs. */}
          {canDestroy && (
            <div className="admin_export_menu_wrap">
              <button
                className="admin_export_btn"
                onClick={() => setExportMenuOpen((o) => !o)}
                disabled={exportingAny}
              >
                {exportingAny ? "⏳ Exporting..." : "⬇ Export Report ▾"}
              </button>

              {exportMenuOpen && (
                <>
                  <div className="admin_export_menu_backdrop" onClick={() => setExportMenuOpen(false)} />
                  <div className="admin_export_menu">
                    <div className="admin_export_scope">
                      <button className={exportScope === "all" ? "active" : ""} onClick={() => setExportScope("all")}>
                        Full report
                      </button>
                      <button className={exportScope === "logins" ? "active" : ""} onClick={() => setExportScope("logins")}>
                        Logins only
                      </button>
                    </div>
                    <button className="admin_export_item" onClick={() => runExport("xlsx")}>📗 Excel (.xlsx)</button>
                    <button className="admin_export_item" onClick={() => runExport("docx")}>📘 Word (.docx)</button>
                    <button className="admin_export_item" onClick={() => runExport("pdf")}>📕 PDF (.pdf)</button>
                    <p className="admin_export_hint">
                      {exportScope === "all"
                        ? "Users, videos, reels, posts, comments, reactions, likes and views."
                        : "Username, email, login method, last login, IP, location and device."}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <Link to="/" className="admin_back_btn">← Back to ZIXPLON</Link>
        </div>
      </div>

      <div className="admin_stats">
        {[
          { label: "Pending", value: reports.filter((r) => r.status === "pending").length, color: "#f97316" },
          { label: "Reviewed", value: reports.filter((r) => r.status === "reviewed").length, color: "#3b82f6" },
          { label: "Removed", value: reports.filter((r) => r.status === "removed").length, color: "#ef4444" },
          { label: "Dismissed", value: reports.filter((r) => r.status === "dismissed").length, color: "#22c55e" },
          { label: "Total", value: reports.length, color: "#7c3aed" },
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
        {/* NEW: browse / delete any video, reel or post */}
        <button className={`admin_tab ${activeTab === "content" ? "active" : ""}`} onClick={() => setActiveTab("content")}>
          🎬 Content
        </button>
        <button className={`admin_tab ${activeTab === "visitors" ? "active" : ""}`} onClick={() => setActiveTab("visitors")}>
          📈 Visitors
        </button>
        {/* NEW: charts — visits, sessions, signups, installs, top pages, top countries */}
        <button className={`admin_tab ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>
          📊 Analytics
        </button>
        {/* Everything below is hidden from moderators (PII / destructive tools). */}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "installs" ? "active" : ""}`} onClick={() => setActiveTab("installs")}>
            📲 Installs
          </button>
        )}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "admins" ? "active" : ""}`} onClick={() => setActiveTab("admins")}>
            👑 Admins {admins.length > 0 && <span className="admin_badge" style={{ background: "#7c3aed" }}>{admins.length}</span>}
          </button>
        )}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "logins" ? "active" : ""}`} onClick={() => setActiveTab("logins")}>
            🔐 Logins
          </button>
        )}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
            👥 Users
          </button>
        )}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "hub" ? "active" : ""}`} onClick={() => setActiveTab("hub")}>
            🏠 Home Hub
          </button>
        )}
        {/* NEW: who did what, and why */}
        {canDestroy && (
          <button className={`admin_tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
            📜 Audit Log
          </button>
        )}
      </div>

      {loading ? (
        <div className="admin_loading">
          <div className="admin_spinner" />
          <p>Loading...</p>
        </div>
      ) : activeTab === "reports" ? (
        <AdminReportsPanel
          reports={reports}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          actionLoading={actionLoading}
          canDestroy={canDestroy}
          onPreview={setPreviewReport}
          onDeleteGroup={deleteGroup}
          onSetStatusGroup={setGroupStatus}
          onBanUploader={banUploaderFromReport}
        />
      ) : activeTab === "analytics" ? (
        <AdminAnalyticsTab
          hideZero={hideZeroVisits}
          installPerDay={installStats?.per_day || []}
          countries={countryCounts}
          showToast={showToast}
        />
      ) : activeTab === "content" ? (
        <AdminContentTab canDestroy={canDestroy} showToast={showToast} />
      ) : activeTab === "audit" && canDestroy ? (
        <AdminAuditTab showToast={showToast} />
      ) : activeTab === "visitors" ? (
        <div className="admin_visitors_section">
          {visitsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading visitor data...</p>
            </div>
          ) : (
            <>
              <div className="admin_filter_row">
                {VISIT_RANGES.map((r) => (
                  <button
                    key={r.key}
                    className={`admin_filter_btn ${visitRange === r.key ? "active" : ""}`}
                    onClick={() => changeVisitRange(r.key)}
                  >
                    {r.label}
                  </button>
                ))}

                {/* Ignore visits that lasted 0s (left before the first
                    ~20s heartbeat). Inline styles, so no CSS file change. */}
                <label
                  title="Hide visits that ended before the first ~20s heartbeat (bots / instant bounces)"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginLeft: "auto",
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--zx-text2)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hideZeroVisits}
                    onChange={toggleHideZeroVisits}
                    style={{ accentColor: "var(--zx-primary)" }}
                  />
                  Hide 0s visits
                </label>
              </div>

              <div className="admin_stats" style={{ marginBottom: "20px" }}>
                {[
                  { label: "Total Visits", value: visitStats.totalVisits, color: "#7c3aed" },
                  { label: "Unique Sessions", value: visitStats.uniqueSessions, color: "#3b82f6" },
                  { label: "Logged-in", value: visitStats.loggedIn, color: "#22c55e" },
                  { label: "Guests", value: visitStats.guests, color: "#f97316" },
                  { label: "Avg. Duration", value: formatDuration(visitStats.avgDurationSec), color: "#ef4444" },
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
                  Showing {visits.length} of {visitStats.totalVisits} visits
                  ({VISIT_RANGES.find((r) => r.key === visitRange)?.label.toLowerCase()}).
                  Duration is accurate to within ~20s (heartbeat interval).
                  {hideZeroVisits && zeroHidden != null && ` ${zeroHidden} visits under ~20s (0s) are hidden.`}
                  {/* Only true when the admin_visit_stats() SQL hasn't been run. */}
                  {!visitAgg && visits.length < visitStats.totalVisits &&
                    ` Unique sessions and avg. duration are based on the ${visits.length} loaded visits; the other three cards cover all ${visitStats.totalVisits}.`}
                </p>
                <button className="admin_add_word_btn" onClick={() => fetchVisits()} disabled={visitsLoading}>
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
                      {visits.map((v) => {
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

              {visitsTotal != null && visits.length < visitsTotal && (
                <div className="admin_visits_more_row">
                  <button className="admin_add_word_btn" onClick={loadMoreVisits} disabled={visitsLoadingMore}>
                    {visitsLoadingMore
                      ? "Loading..."
                      : `Load ${Math.min(VISITS_PAGE, visitsTotal - visits.length)} more (${visitsTotal - visits.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : activeTab === "installs" && canDestroy ? (
        /* ── Installs Tab — PWA install stats ── */
        <div className="admin_visitors_section">
          {installsLoading ? (
            <div className="admin_loading">
              <div className="admin_spinner" />
              <p>Loading install stats...</p>
            </div>
          ) : !installStats ? (
            <div className="admin_empty">
              <div style={{ fontSize: "48px" }}>📲</div>
              <p>{installsError || "No install data yet"}</p>
              <p className="admin_words_hint" style={{ textAlign: "center" }}>
                If this says the function doesn't exist, run the pwa_install_stats()
                SQL in the Supabase SQL editor.
              </p>
              <button className="admin_add_word_btn" onClick={fetchInstalls}>↻ Retry</button>
            </div>
          ) : (
            <>
              <div className="admin_stats" style={{ marginBottom: "20px" }}>
                {[
                  { label: "Installs", value: installStats.installs ?? 0, color: "#7c3aed" },
                  { label: "App Users", value: installStats.app_users ?? 0, color: "#3b82f6" },
                  { label: "Active Today", value: installStats.active_today ?? 0, color: "#22c55e" },
                  { label: "Active 7d", value: installStats.active_7d ?? 0, color: "#f97316" },
                  { label: "Active 30d", value: installStats.active_30d ?? 0, color: "#ef4444" },
                ].map((s) => (
                  <div key={s.label} className="admin_stat_card">
                    <div className="admin_stat_value" style={{ color: s.color }}>{s.value}</div>
                    <div className="admin_stat_label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
                <p className="admin_words_hint" style={{ margin: 0 }}>
                  Installs = devices that fired the install event. App Users = devices that have
                  opened the installed app (also covers iOS and installs from before tracking).
                  Uninstalls can't be detected, so "Active" is the more honest number.
                </p>
                <button className="admin_add_word_btn" onClick={fetchInstalls} disabled={installsLoading}>
                  ↻ Refresh
                </button>
              </div>

              <div className="admin_installs_card">
                <h3 className="admin_installs_card_title">Devices by platform</h3>
                {(installStats.by_platform || []).length === 0 ? (
                  <p className="admin_words_hint">No data yet</p>
                ) : (
                  (installStats.by_platform || []).map((p) => (
                    <div key={p.platform} className="admin_installs_bar_row">
                      <span className="admin_installs_bar_label">{p.platform}</span>
                      <div className="admin_installs_bar_track">
                        <div
                          className="admin_installs_bar_fill"
                          style={{ width: `${(p.devices / platformMax) * 100}%` }}
                        />
                      </div>
                      <span className="admin_installs_bar_count">{p.devices}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="admin_installs_card">
                <h3 className="admin_installs_card_title">Installs per day (last 30 days)</h3>
                {/* CHANGED: chart instead of a table. per_day looks newest-first,
                    so it is reversed to read oldest → newest left to right. */}
                <BarChart
                  data={[...(installStats.per_day || [])].reverse().map((d) => ({
                    label: new Date(d.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
                    value: d.installs,
                  }))}
                  emptyText="No installs recorded in the last 30 days"
                />
              </div>

              <div className="admin_installs_card">
                <h3 className="admin_installs_card_title">Recent events</h3>
                {(installStats.recent || []).length === 0 ? (
                  <p className="admin_words_hint">No events yet</p>
                ) : (
                  <div className="admin_visits_table_wrap">
                    <table className="admin_visits_table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>User</th>
                          <th>Platform</th>
                          <th>Device</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(installStats.recent || []).map((r, i) => (
                          <tr key={`${r.created_at}-${i}`}>
                            <td>
                              <span className={`admin_installs_event ${r.event}`}>
                                {r.event === "installed" ? "Installed" : "App opened"}
                              </span>
                            </td>
                            <td>{r.username ? `@${r.username}` : "Guest"}</td>
                            <td style={{ textTransform: "capitalize" }}>{r.platform || "—"}</td>
                            <td>{r.device || "—"}</td>
                            <td>
                              {new Date(r.created_at).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : activeTab === "admins" && canDestroy ? (
        <div className="admin_admins_section">
          <div className="admin_grant_card">
            <h3 className="admin_grant_title">Grant admin access</h3>
            <p className="admin_words_hint">
              Enter an email to make that person an admin. If they don't have an
              account yet, set a password too and one will be created for them —
              leave it blank if they already have an account.
              {isRootAdmin && " Moderators can review reports and browse content, but can't ban, delete or manage admins."}
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
              {/* NEW: only root can choose the moderator role */}
              {isRootAdmin && (
                <select
                  className="admin_hub_audience_select"
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  disabled={grantLoading}
                >
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                </select>
              )}
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
                      {/* NEW: shown when the API's list returns the role column */}
                      {a.role === "moderator" && <span className="admin_role_pill">moderator</span>}
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
      ) : activeTab === "logins" && canDestroy ? (
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
                  IP/device reflect the user's most recent site visit. Location is
                  approximate and derived from that IP (city level; VPNs and mobile
                  carriers can show a different city). Use "Export Report" at the
                  top to download this list.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button className="admin_add_word_btn" onClick={fetchLogins} disabled={loginsLoading}>
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {loginRows.length === 0 ? (
                <div className="admin_empty">
                  <div style={{ fontSize: "48px" }}>🔐</div>
                  <p>No login data found</p>
                </div>
              ) : (
                /* CHANGED: filters, sorting, search and paging live in this component */
                <AdminLoginsTable
                  rows={loginRows}
                  isUserOnline={isUserOnline}
                  geoLabelFor={geoLabelFor}
                  exportLocation={exportLocation}
                />
              )}
            </>
          )}
        </div>
      ) : activeTab === "users" && canDestroy ? (
        /* ── Users Tab: ban / unban / delete any account + online status ──
           CHANGED: filters, paging, bulk ban/unban and the detail view live
           in AdminUsersTab. */
        <AdminUsersTab
          rows={userRows}
          loading={usersLoading}
          onRefresh={fetchUsers}
          isUserOnline={isUserOnline}
          geoLabelFor={geoLabelFor}
          exportLocation={exportLocation}
          rootEmails={ADMIN_EMAILS}
          canDestroy={canDestroy}
          moderatingId={moderatingId}
          removeContentMap={removeContentMap}
          toggleRemoveContent={toggleRemoveContent}
          onBan={banUser}
          onUnban={unbanUser}
          onDelete={deleteUserAccount}
          onBulkBan={bulkBan}
          onBulkUnban={bulkUnban}
          onOpenDetail={setDetailUser}
        />
      ) : activeTab === "hub" && canDestroy ? (
        /* ── Home Hub Tab: show/hide/reorder HomeHub.jsx's tabs ── */
        <div className="admin_hub_section">
          <p className="admin_words_hint">
            Controls which tabs appear in the homepage's tab bar, in what
            order, and to whom — by audience, by a rollout percentage, or
            by forcing specific usernames in/out with the 👤 button per
            row. Changes apply live — no redeploy needed. At least one
            tab always stays visible for every viewer; over-restricting
            all of them falls back to showing everything rather than
            leaving the homepage empty.
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
                const tabOverrides = hubOverrides.filter((o) => o.tab_key === t.key);
                const isExpanded = expandedHubKey === t.key;
                return (
                  <div key={t.key} className="admin_hub_group">
                    <div className="admin_hub_row">
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

                      {/* CHANGED: saves on blur / Enter instead of on every keystroke
                          (typing "50" used to fire two requests: 5, then 50). */}
                      <div className="admin_hub_rollout">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="admin_hub_rollout_input"
                          key={`${t.key}-${t.rollout_percent ?? 100}`}
                          defaultValue={t.rollout_percent ?? 100}
                          disabled={busy}
                          onBlur={(e) => setHubTabRollout(t, parseInt(e.target.value, 10))}
                          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                          title="Percent of matching viewers who see this tab (press Enter or click away to save)"
                        />
                        <span className="admin_hub_rollout_pct">%</span>
                      </div>

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

                      <button
                        className="admin_hub_expand_btn"
                        onClick={() => setExpandedHubKey(isExpanded ? null : t.key)}
                        title="Per-user targeting"
                      >
                        👤 {tabOverrides.length > 0 ? tabOverrides.length : ""} {isExpanded ? "▲" : "▼"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="admin_hub_overrides_panel">
                        <p className="admin_words_hint" style={{ margin: "0 0 10px" }}>
                          Force specific usernames in or out of "{t.label}", regardless of the
                          visibility/audience/rollout settings above.
                        </p>

                        <div className="admin_hub_override_add_row">
                          <input
                            type="text"
                            className="admin_word_input"
                            placeholder="username"
                            value={overrideDraft.username}
                            onChange={(e) => setOverrideDraft((d) => ({ ...d, username: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && addHubOverride(t.key)}
                            disabled={overrideSaving}
                          />
                          <select
                            className="admin_hub_audience_select"
                            value={overrideDraft.show ? "show" : "hide"}
                            onChange={(e) => setOverrideDraft((d) => ({ ...d, show: e.target.value === "show" }))}
                            disabled={overrideSaving}
                          >
                            <option value="show">Force show</option>
                            <option value="hide">Force hide</option>
                          </select>
                          <button
                            className="admin_add_word_btn"
                            onClick={() => addHubOverride(t.key)}
                            disabled={overrideSaving || !overrideDraft.username.trim()}
                          >
                            {overrideSaving ? "..." : "+ Add"}
                          </button>
                        </div>

                        {tabOverrides.length === 0 ? (
                          <p className="admin_words_hint" style={{ marginTop: "10px" }}>No per-user overrides for this tab.</p>
                        ) : (
                          <div className="admin_hub_override_list">
                            {tabOverrides.map((o) => (
                              <div key={o.username} className="admin_hub_override_chip">
                                <span>
                                  @{o.username} — <strong>{o.show ? "forced visible" : "forced hidden"}</strong>
                                </span>
                                <button
                                  className="admin_word_remove"
                                  onClick={() => removeHubOverride(t.key, o.username)}
                                  disabled={overrideSaving}
                                  title="Remove override"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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

          {/* NEW: search + paste-a-list import */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="admin_word_input"
              style={{ maxWidth: 260 }}
              placeholder="Search banned words..."
              value={wordSearch}
              onChange={(e) => setWordSearch(e.target.value)}
            />
            <button className="admin_add_word_btn" onClick={() => setBulkOpen((o) => !o)}>
              {bulkOpen ? "Cancel" : "📋 Paste a list"}
            </button>
          </div>
          {bulkOpen && (
            <>
              <textarea
                className="admin_bulk_words"
                placeholder="One word or phrase per line, or comma-separated"
                value={bulkWords}
                onChange={(e) => setBulkWords(e.target.value)}
              />
              <button
                className="admin_add_word_btn"
                onClick={importBannedWords}
                disabled={wordSaving || !bulkWords.trim()}
              >
                {wordSaving ? "Importing..." : "Import words"}
              </button>
            </>
          )}

          <div className="admin_words_grid">
            {shownWords.map((w) => (
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