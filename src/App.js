import "./App.css";
import Navbar from "./Component/Navbar/navbar";
import Home from "./Pages/Home/home";
import { useState, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Video from "./Pages/Video/video";
import Profile from "./Pages/Profile/profile";
import VideoUpload from "./Pages/VideoUpload/videoUpload";
import SignUp from "./Pages/SignUp/signUp";
import Reels from "./Component/Reels/reels";
import Footer from "./Component/Footer/footer";
import YouTubeSearch from "./Component/YouTubeSearch/youTubeSearch";
import SearchResults from "./Component/SearchResults/searchResults";
import Notifications from "./Component/Notifications/notifications";
import ComingSoon from "./Pages/ComingSoon/comingSoon";
import ScrollToTop from "./ScrollToTop";
import LiveTVPage from "./Pages/LiveTV/LiveTVPage";
import LocalMediaPlayer from "./Pages/LocalMediaPlayer/LocalMediaPlayer";
import TermsAndConditions from "./Pages/TermsAndConditions/termsAndConditions";
import Feedback from "./Pages/Feedback/feedback";
import Help from "./Pages/Help/help";
import ContactSupport from "./Pages/ContactSupport/contactSupport";
import ReportProblem from "./Pages/ReportProblem/reportProblem";
import { supabase } from "./config/supabase";
import BottomNav from "./Component/BottomNav/BottomNav";
import PostFeed from "./Pages/PostFeed/PostFeed";
import {
  AboutPage,
  PrivacyPolicyPage,
  DmcaPage,
  CommunityGuidelinesPage,
  AdvertisePage,
} from "./Pages/ZixplonPages";
import LikedVideos      from "./Pages/LikedVideos/LikedVideos";
import YourVideos       from "./Pages/YourVideos/YourVideos";
import WatchLater       from "./Pages/WatchLater/WatchLater";
import History          from "./Pages/History/History";
import SubscriptionFeed from "./Pages/SubscriptionFeed/SubscriptionFeed";
import Playlist         from "./Pages/Playlist/Playlist";
import YourClips        from "./Pages/YourClips/YourClips";
import SideNavbar       from "./Component/SideNavbar/sideNavbar";

// ── Loading Screen ────────────────────────────────────────────────────────────
const LoadingScreen = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 1800);
    const doneTimer = setTimeout(() => onFinish && onFinish(), 2300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: fade ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        style={{ width: "180px", height: "180px", display: "block" }}
      >
        <rect x="0" y="0" width="512" height="512" rx="110" ry="110" fill="#CC0000" />
        <rect x="0" y="0" width="512" height="260" rx="110" ry="110" fill="#E81515" opacity="0.55" />
        <polygon
          points="108,108 404,108 404,178 220,334 404,334 404,404 108,404 108,334 292,178 108,178"
          fill="#FFFFFF"
        />
      </svg>

      <p
        style={{
          marginTop: "24px",
          color: "#ffffff",
          fontSize: "26px",
          fontWeight: "800",
          fontFamily: "'Outfit', 'Nunito', sans-serif",
          letterSpacing: "6px",
          textTransform: "uppercase",
          opacity: 0.92,
          margin: "24px 0 0",
        }}
      >
        ZIXPLON
      </p>

      <div style={{ display: "flex", gap: "8px", marginTop: "40px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#CC0000",
              animation: `bounce 1s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
};

// ── Exit Toast ────────────────────────────────────────────────────────────────
const ExitToast = ({ visible }) => (
  <div
    style={{
      position: "fixed",
      bottom: "80px",
      left: "50%",
      transform: `translateX(-50%) translateY(${visible ? "0" : "20px"})`,
      background: "rgba(30, 30, 40, 0.92)",
      color: "#fff",
      padding: "12px 24px",
      borderRadius: "24px",
      fontSize: "14px",
      fontWeight: "500",
      fontFamily: "'Outfit', 'Nunito', sans-serif",
      letterSpacing: "0.3px",
      zIndex: 99999,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.25s ease, transform 0.25s ease",
      pointerEvents: "none",
      whiteSpace: "nowrap",
      boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    }}
  >
    Press back again to exit
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const location = useLocation();
  const [appReady, setAppReady] = useState(false);
  const [sideNavbar, setSideNavbar] = useState(true);
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || null,
  );

  // ── Exit-on-back state ──
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef(null);
  const backPressedOnce = useRef(false);

  // ── Supabase warmup ──
  useEffect(() => {
    supabase.from("videos").select("id").limit(1).then(() => {});
  }, []);

  // ── Single auth effect — profiles table is always source of truth ──
  useEffect(() => {
    const resolveUsername = async (u) => {
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("username, profile_pic, about")
          .eq("id", u.id)
          .maybeSingle();

        // ── Auto-create profile for Google OAuth users who have none ──
        if (!profileRow) {
          const autoName =
            u.user_metadata?.name ||
            u.user_metadata?.full_name ||
            u.user_metadata?.channelName ||
            u.user_metadata?.username ||
            u.email?.split("@")[0];

          const autoPic =
            u.user_metadata?.avatar_url ||
            u.user_metadata?.picture ||
            "";

          await supabase.from("profiles").upsert(
            [{
              id: u.id,
              username: autoName,
              profile_pic: autoPic,
              about: "",
              banner_pic: "",
            }],
            { onConflict: "id" }
          );

          // Use the auto-created values
          localStorage.setItem("username", autoName);
          localStorage.setItem("userId", u.id);
          localStorage.setItem("email", u.email || "");
          if (autoPic) localStorage.setItem("profilePic", autoPic);
          return autoName;
        }

        const name =
          profileRow?.username ||
          localStorage.getItem("username") ||
          u.user_metadata?.channelName ||
          u.user_metadata?.username ||
          u.user_metadata?.full_name ||
          u.email?.split("@")[0];

        const pic =
          profileRow?.profile_pic ||
          localStorage.getItem("profilePic") ||
          u.user_metadata?.profilePic ||
          u.user_metadata?.avatar_url ||
          u.user_metadata?.picture ||
          "";

        const about =
          profileRow?.about ||
          localStorage.getItem("about") ||
          u.user_metadata?.about ||
          "";

        localStorage.setItem("username", name);
        localStorage.setItem("userId", u.id);
        localStorage.setItem("email", u.email || "");
        if (pic) localStorage.setItem("profilePic", pic);
        if (about) localStorage.setItem("about", about);

        return name;
      } catch (e) {
        return (
          localStorage.getItem("username") ||
          u.user_metadata?.channelName ||
          u.email?.split("@")[0]
        );
      }
    };

    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const name = await resolveUsername(session.user);
        setCurrentUser(name);
        if (window.location.hash?.includes("access_token")) {
          window.history.replaceState({}, document.title, "/");
        }
      }
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          // ── LOGOUT — synchronous ──
          setCurrentUser(null);
          localStorage.removeItem("username");
          localStorage.removeItem("email");
          localStorage.removeItem("userId");
          localStorage.removeItem("profilePic");
          localStorage.removeItem("about");
          localStorage.removeItem("channelName");
          localStorage.removeItem("userName");
          return;
        }
        // ── LOGIN — async profile resolve ──
        resolveUsername(session.user).then((name) => {
          setCurrentUser(name);
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Mobile back-button exit logic ─────────────────────────────────────────
  // ── Mobile back-button exit logic ─────────────────────────────────────────
useEffect(() => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;

  const isHome = location.pathname === "/";

  if (!isHome) {
    backPressedOnce.current = false;
    setShowExitToast(false);
    clearTimeout(exitToastTimer.current);
    return;
  }

  // Push sentinel so back press is catchable
  window.history.pushState({ zixplonExit: true }, "", "/");

  const handlePopState = () => {
    if (backPressedOnce.current) {
      // Second back press — exit app
      clearTimeout(exitToastTimer.current);
      setShowExitToast(false);
      backPressedOnce.current = false;
      // Re-push so app stays alive briefly while closing
      window.history.pushState({ zixplonExit: true }, "", "/");
      // Navigate away to close (works in Android WebView/PWA)
      setTimeout(() => {
        window.location.href = "about:blank";
      }, 50);
      return;
    }

    // First back press — show toast, re-push sentinel
    backPressedOnce.current = true;
    setShowExitToast(true);
    // Re-push sentinel so next back is also catchable
    window.history.pushState({ zixplonExit: true }, "", "/");

    clearTimeout(exitToastTimer.current);
    exitToastTimer.current = setTimeout(() => {
      backPressedOnce.current = false;
      setShowExitToast(false);
    }, 2000);
  };

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
    clearTimeout(exitToastTimer.current);
  };
}, [location.pathname]);
  // ──────────────────────────────────────────────────────────────────────────

  const [notifications, setNotifications] = useState([
    { id: 1, type: "upload",     message: "TechWorld uploaded: 'React 19 Features'",      time: "2m ago",  read: false, avatar: "T" },
    { id: 2, type: "like",       message: "Alex liked your video 'My Portfolio Tour'",    time: "10m ago", read: false, avatar: "A" },
    { id: 3, type: "comment",    message: "Sara commented: 'Great content!'",                time: "25m ago", read: false, avatar: "S" },
    { id: 4, type: "subscriber", message: "John subscribed to your channel",              time: "1h ago",  read: false, avatar: "J" },
    { id: 5, type: "upload",     message: "CodeWithMe uploaded: 'Node.js Crash Course'",  time: "2h ago",  read: true,  avatar: "C" },
    { id: 6, type: "like",       message: "Priya liked your video 'CSS Animations'",      time: "3h ago",  read: true,  avatar: "P" },
  ]);

  const hideFooter =
    ["/youtube", "/local-player", "/videoUpload"].includes(location.pathname) ||
    location.pathname.startsWith("/reels") ||
    location.pathname.endsWith("/upload");

  if (!appReady) {
    return <LoadingScreen onFinish={() => setAppReady(true)} />;
  }

  return (
    <div
      className="App"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#f0f4ff",
        width: "100%",
      }}
    >
      <ScrollToTop />

      {/* Mobile exit toast */}
      <ExitToast visible={showExitToast} />

      <Navbar
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        setSideNavbarFunc={setSideNavbar}
        sideNavbar={sideNavbar}
        notifications={notifications}
        setNotifications={setNotifications}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f0f4ff" }}>
        <SideNavbar sideNavbar={sideNavbar} />
        <Routes>
          <Route path="/"               element={<Home sideNavbar={sideNavbar} />} />
          <Route path="/video/:id"      element={<Video sideNavbar={sideNavbar} />} />
          <Route path="/user/:username" element={<Profile sideNavbar={sideNavbar} />} />
          <Route path="/videoUpload"    element={<VideoUpload />} />
          <Route path="/:id/upload"     element={<VideoUpload />} />
          <Route path="/signup"         element={<SignUp />} />
          <Route path="/reels"          element={<Reels />} />
          <Route path="/reels/:id"      element={<Reels />} />
          <Route path="/search"         element={<SearchResults />} />
          <Route path="/youtube"        element={<YouTubeSearch />} />
          <Route path="/notifications"  element={<Notifications notifications={notifications} />} />

          <Route path="/history"        element={<History      currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/playlist"       element={<Playlist     currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/your-videos"    element={<YourVideos   currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/watch-later"    element={<WatchLater   currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/liked-videos"   element={<LikedVideos  currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/your-clips"     element={<YourClips    currentUser={currentUser} sideNavbar={sideNavbar} />} />
          <Route path="/subscription"   element={<SubscriptionFeed currentUser={currentUser} sideNavbar={sideNavbar} />} />

          <Route path="/live-tv"        element={<LiveTVPage sideNavbar={sideNavbar} />} />
          <Route path="/local-player"   element={<LocalMediaPlayer sideNavbar={sideNavbar} />} />
          <Route path="/terms-and-conditions"  element={<TermsAndConditions />} />
          <Route path="/feedback"              element={<Feedback />} />
          <Route path="/help"                  element={<Help />} />
          <Route path="/contact"               element={<ContactSupport />} />
          <Route path="/report"                element={<ReportProblem />} />
          <Route path="/about"                 element={<AboutPage />} />
          <Route path="/privacy-policy"        element={<PrivacyPolicyPage />} />
          <Route path="/dmca"                  element={<DmcaPage />} />
          <Route path="/community-guidelines"  element={<CommunityGuidelinesPage />} />
          <Route path="/advertise"             element={<AdvertisePage />} />
          <Route path="/feed"                  element={<PostFeed sideNavbar={sideNavbar} />} />
        </Routes>
      </div>

      <BottomNav currentUser={currentUser} />
      {!hideFooter && <Footer sideNavbar={sideNavbar} />}
    </div>
  );
}

export default App;