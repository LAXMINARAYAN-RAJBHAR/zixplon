import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import "./homeHub.css";
import { supabase } from "../../config/supabase";

// HomePageContent is the component App.js originally imported as `Home`
// from "./Pages/Home/home" (the home feed / trending carousel / grid).
// PostFeed is the same file already used by App.js's old "/feed" route.
import HomePageContent from "./home";
import PostFeed from "../PostFeed/PostFeed";
import UtilityPage from "../Utility/UtilityPage";

// Video's real route (same as the old goToUpload()). Reel and Live
// aren't separate menu items anymore — that page already lets the
// person choose Reel/Live/Video from within it.
const UPLOAD_ROUTES = {
  video: "/videoUpload",
};

// ── Tab registry ─────────────────────────────────────────────────────────
// The single source of truth for each tab's icon and the component it
// renders. The `home_hub_tabs` Supabase table (managed from
// AdminPanel.jsx's "Home Hub" tab) only ever controls label / visibility
// / order for a key defined here — it never determines WHAT mounts for
// a given key. Adding a genuinely new tab still requires a code change
// here; the admin panel can only show/hide/reorder/relabel these three.
const TAB_DEFS = {
  home: {
    icon: HomeOutlinedIcon,
    render: ({ sideNavbar }) => <HomePageContent sideNavbar={sideNavbar} />,
  },
  posts: {
    icon: NewspaperOutlinedIcon,
    render: ({ sideNavbar, currentUser }) => (
      <PostFeed sideNavbar={sideNavbar} currentUser={currentUser} />
    ),
  },
  utility: {
    icon: BoltOutlinedIcon,
    render: ({ sideNavbar, currentUser }) => (
      <UtilityPage sideNavbar={sideNavbar} currentUser={currentUser} />
    ),
  },
};

// Used until the DB config has loaded, and as a fallback if the fetch
// fails or the table comes back empty — HomeHub must never end up with
// zero visible tabs.
const FALLBACK_TABS = [
  { key: "home", label: "Home", is_visible: true, sort_order: 0 },
  { key: "posts", label: "Posts", is_visible: true, sort_order: 1 },
  { key: "utility", label: "Utility", is_visible: true, sort_order: 2 },
];

// ── HomeHub ──────────────────────────────────────────────────────────────
// Merged tab bar: Home / Posts / Utility, plus an Upload button. Which
// of the three tabs actually show — and in what order — is controlled
// live from the Admin Panel via the `home_hub_tabs` table.
//
// Active sub-tab is stored in the URL as ?tab=posts|utility (default, no
// param, is the Home feed) so back/forward and shared links still work.
// Switching tabs unmounts the inactive one — each tab owns its own
// Supabase queries/realtime subscriptions, so keeping more than one
// mounted at once would double up on network calls and background
// video playback for no benefit.
//
// currentUser is passed down from App.js (the single source of truth for
// auth state, kept in sync with the real Supabase session) and forwarded
// to PostFeed below, rather than PostFeed reading localStorage on its
// own — that split used to let the Posts tab and the rest of the app
// (e.g. the navbar's Upload button) disagree about whether you were
// logged in. Utility doesn't need currentUser forwarded the same way —
// it reads the session itself via supabase.auth.getUser() at the point
// of a transaction, same as RechargeForm/BillPaymentForm already do.
//
// STACKING ORDER: HomePageContent renders its own fixed category-chip
// bar (.homePage_options, in homePage.css) only when the Home sub-tab
// is active — Posts and Utility have no equivalent bar. Home/Posts/
// Utility/Upload should always render BELOW that chip row when it's
// present, but flush under the Navbar when it's not.
const HomeHub = ({ sideNavbar, currentUser }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Admin-controlled tab visibility/order ───────────────────────────
  const [tabsConfig, setTabsConfig] = useState(FALLBACK_TABS);
  const [tabsLoaded, setTabsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchTabs = async () => {
      const { data, error } = await supabase
        .from("home_hub_tabs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!active) return;
      if (!error && data && data.length > 0) {
        setTabsConfig(data);
      }
      setTabsLoaded(true);
    };

    fetchTabs();

    // Live updates: an admin toggling/reordering a tab in the Admin
    // Panel takes effect here within a second, no refresh needed.
    const channel = supabase
      .channel("home-hub-tabs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "home_hub_tabs" },
        fetchTabs,
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Tabs that should actually appear in the bar, in order. Falls back
  // to the full default set if an admin somehow hides all three.
  const effectiveTabs = useMemo(() => {
    const visible = tabsConfig
      .filter((t) => t.is_visible && TAB_DEFS[t.key])
      .sort((a, b) => a.sort_order - b.sort_order);
    return visible.length > 0 ? visible : FALLBACK_TABS;
  }, [tabsConfig]);

  const rawTab = searchParams.get("tab");
  const requestedTab = rawTab && TAB_DEFS[rawTab] ? rawTab : "home";
  const isRequestedVisible = effectiveTabs.some((t) => t.key === requestedTab);
  const activeTab = isRequestedVisible ? requestedTab : effectiveTabs[0].key;

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "home") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: false });
  };

  // If the tab currently in the URL just got hidden by an admin (or was
  // never a real tab), snap the URL over to whatever we fell back to —
  // once config has actually loaded, so we don't flash-redirect before
  // the real (possibly different) config arrives.
  useEffect(() => {
    if (!tabsLoaded) return;
    if (activeTab !== requestedTab) setTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsLoaded, activeTab, requestedTab]);

  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const uploadMenuRef = useRef(null);
  const uploadBtnRef = useRef(null);

  useEffect(() => {
    if (!showUploadMenu) return;
    const handleClickOutside = (e) => {
      if (
        uploadMenuRef.current &&
        !uploadMenuRef.current.contains(e.target) &&
        uploadBtnRef.current &&
        !uploadBtnRef.current.contains(e.target)
      ) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUploadMenu]);

  const requireLogin = () => {
    if (!currentUser) {
      window.dispatchEvent(new CustomEvent("openLogin"));
      return false;
    }
    return true;
  };

  const handleUploadPost = () => {
    if (!requireLogin()) return;
    setShowUploadMenu(false);

    const focusComposer = () => window.dispatchEvent(new CustomEvent("zx:focus-composer"));

    if (activeTab === "posts") {
      // Already there — PostComposer is already mounted, focus it now.
      focusComposer();
    } else {
      // Switching tabs (or deep-linking into Posts even if an admin has
      // hidden it from the tab bar — hidden just means "not advertised
      // in the nav", the route/composer itself still works) unmounts
      // the current tab and mounts PostFeed fresh — give it a tick to
      // actually render before trying to focus something inside it.
      setTab("posts");
      requestAnimationFrame(() => setTimeout(focusComposer, 60));
    }
  };

  const handleUploadVideo = () => {
    if (!requireLogin()) return;
    setShowUploadMenu(false);
    navigate(UPLOAD_ROUTES.video);
  };

  return (
    <div className="hh-wrap">
      <div
        className={
          "hh-tabbar" +
          (sideNavbar ? " sidebar-open" : "") +
          // Home tab renders homePage_options above this bar — push down.
          // Posts/Utility have no chip row — sit right under the Navbar.
          (activeTab === "home" ? " hh-tabbar-below-options" : "")
        }
      >
        {effectiveTabs.map((t) => {
          const Icon = TAB_DEFS[t.key].icon;
          return (
            <button
              key={t.key}
              className={"hh-tab-btn" + (activeTab === t.key ? " hh-tab-active" : "")}
              onClick={() => setTab(t.key)}
            >
              <Icon sx={{ fontSize: 18 }} />
              <span className="hh-tab-label">{t.label}</span>
            </button>
          );
        })}

        <div className="hh-upload-wrap">
          <button
            ref={uploadBtnRef}
            className="hh-upload-btn"
            onClick={() => setShowUploadMenu((v) => !v)}
            title="Upload"
            aria-haspopup="true"
            aria-expanded={showUploadMenu}
          >
            <AddCircleOutlineIcon sx={{ fontSize: 20 }} />
            <span>Upload</span>
          </button>

          {showUploadMenu && (
            <div className="hh-upload-menu" ref={uploadMenuRef}>
              <button className="hh-upload-menu-item" onClick={handleUploadPost}>
                <ArticleOutlinedIcon sx={{ fontSize: 18 }} />
                <span>Post</span>
              </button>
              <button className="hh-upload-menu-item" onClick={handleUploadVideo}>
                <VideocamOutlinedIcon sx={{ fontSize: 18 }} />
                <span>Video</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="hh-tab-content">
        {TAB_DEFS[activeTab].render({ sideNavbar, currentUser })}
      </div>
    </div>
  );
};

export default HomeHub;