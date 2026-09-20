import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import NewspaperOutlinedIcon from "@mui/icons-material/NewspaperOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import "./homeHub.css";

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

// ── HomeHub ──────────────────────────────────────────────────────────────
// Merged tab bar: Home / Posts / Utility, plus an Upload button.
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
  const rawTab = searchParams.get("tab");
  const activeTab =
    rawTab === "posts" ? "posts" : rawTab === "utility" ? "utility" : "home";

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

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "home") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: false });
  };

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
      // Switching from Home/Utility unmounts the current tab and mounts
      // PostFeed fresh — give it a tick to actually render before
      // trying to focus something inside it.
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
        <button
          className={"hh-tab-btn" + (activeTab === "home" ? " hh-tab-active" : "")}
          onClick={() => setTab("home")}
        >
          <HomeOutlinedIcon sx={{ fontSize: 18 }} />
          <span className="hh-tab-label">Home</span>
        </button>
        <button
          className={"hh-tab-btn" + (activeTab === "posts" ? " hh-tab-active" : "")}
          onClick={() => setTab("posts")}
        >
          <NewspaperOutlinedIcon sx={{ fontSize: 18 }} />
          <span className="hh-tab-label">Posts</span>
        </button>
        <button
          className={"hh-tab-btn" + (activeTab === "utility" ? " hh-tab-active" : "")}
          onClick={() => setTab("utility")}
        >
          <BoltOutlinedIcon sx={{ fontSize: 18 }} />
          <span className="hh-tab-label">Utility</span>
        </button>

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
        {activeTab === "home" ? (
          <HomePageContent sideNavbar={sideNavbar} />
        ) : activeTab === "posts" ? (
          <PostFeed sideNavbar={sideNavbar} currentUser={currentUser} />
        ) : (
          <UtilityPage sideNavbar={sideNavbar} currentUser={currentUser} />
        )}
      </div>
    </div>
  );
};

export default HomeHub;