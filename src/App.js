import "./App.css";
import Navbar from "./Component/Navbar/navbar";
// FIX: "/" now renders HomeHub (Home feed + Posts as sub-tabs, Upload as
// an in-tab button) instead of the old standalone Home page — see
// src/Pages/Home/HomeHub.jsx. The old `Home` import/route is removed.
import HomeHub from "./Pages/Home/HomeHub";
import { useState, useEffect, useRef, useCallback } from "react";
import { Route, Routes, useLocation, Navigate, Link } from "react-router-dom";
import Video from "./Pages/Video/video";
import Profile from "./Pages/Profile/profile";
import VideoUpload from "./Pages/VideoUpload/videoUpload";
import SignUp from "./Pages/SignUp/signUp";
import Reels from "./Component/Reels/reels";
import Footer from "./Component/Footer/footer";
import SearchResults from "./Component/SearchResults/searchResults";
import Notifications from "./Component/Notifications/notifications";
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
import {
  AboutPage,
  PrivacyPolicyPage,
  DmcaPage,
  CommunityGuidelinesPage,
  AdvertisePage,
} from "./Pages/ZixplonPages";
import LikedVideos from "./Pages/LikedVideos/LikedVideos";
import YourVideos from "./Pages/YourVideos/YourVideos";
import WatchLater from "./Pages/WatchLater/WatchLater";
import History from "./Pages/History/History";
import SubscriptionFeed from "./Pages/SubscriptionFeed/SubscriptionFeed";
import Playlist from "./Pages/Playlist/Playlist";
import YourClips from "./Pages/YourClips/YourClips";
import SideNavbar from "./Component/SideNavbar/sideNavbar";
import LoginOptionsModal from "./Component/LoginOptionsModal/LoginOptionsModal";
import AdminPanel from "./Pages/AdminPanel/AdminPanel";
import LiveBrowser from "./Component/Live/LiveViewer";
import MessagesPanel from "./Pages/Messages/MessagesPanel";
import { PresenceProvider } from "./context/PresenceContext";
// NEW: voice calling. CallProvider owns the call state, the incoming-call
// ringtone/notification and the full-screen call overlay, so calls ring on
// any page even when the Messages panel is closed. MessagesPanel only
// reads startCall from it via useCallContext(). See src/context/CallContext.jsx.
import { CallProvider } from "./context/CallContext";
import UtilityPage from "./Pages/Utility/UtilityPage";
import RechargeForm from "./Pages/Utility/RechargeForm";
import BillPaymentForm from "./Pages/Utility/BillPaymentForm";
import TransactionHistory from "./Pages/Utility/TransactionHistory";
import useRequireUsernameSetup from "./hooks/useRequireUsernameSetup";
// NEW: records a `site_visits` row per browser tab and heartbeats its
// duration — see src/hooks/useVisitTracking.js and the "Visitors" tab
// in AdminPanel.jsx.
import useVisitTracking from "./hooks/useVisitTracking";
// NEW: lightweight admin check used ONLY to decide whether to show the
// floating Admin Panel button below. The actual /admin route is
// protected independently by AdminPanel.jsx's own (authoritative) check
// — this hook just controls a UI shortcut, not access itself.
import useIsAdmin from "./hooks/useIsAdmin";
import UsernameSetupModal from "./Component/Auth/UsernameSetupModal";
import ExploreGrid from "./Pages/Explore/ExploreGrid";
// NEW: /tag/:tag — every post containing a given #hashtag. See
// src/Pages/Hashtag/HashtagPage.jsx. Clicking a #hashtag or @mention
// anywhere ExpandableText is used (post text, comments, reel/video
// descriptions) now routes here (or to /user/:username for mentions,
// which already existed).
import HashtagPage from "./Pages/Hashtag/HashtagPage";
// NEW: password-reset completion modal. Supabase's client uses
// flowType: 'implicit' (kept deliberately for mobile Google OAuth — see
// config/supabase.js), so a recovery link's tokens arrive as a raw
// #access_token hash rather than a routable ?code= param. Rather than a
// dedicated /reset-password route (which HashRouter can't reliably match
// against that hash shape), we listen for the PASSWORD_RECOVERY event
// in the auth effect below and pop this modal on top of whatever page
// the user landed on.
import ResetPassword from "./Component/Auth/ResetPassword";
import SignInPage from "./Pages/SignIn/SignInPage";
// NEW: shareable PWA install page — https://zixplon-tawny.vercel.app/install.
// Importing it also loads src/hooks/useInstallPrompt.js at app start, which
// registers the `beforeinstallprompt` listener early so the event isn't
// missed while the loading screen is showing.
import InstallPage from "./Pages/Install/InstallPage";
// NEW: shared links (/s/reel/<code>, /s/video/<code>, /s/post/<code>) and a
// catch-all "not found" page so an unknown URL never renders a blank screen.
import ShareRedirect, { NotFoundPage } from "./Pages/Share/ShareRedirect";
// NEW: "A new version is available — Refresh" banner. Compares this
// bundle's BUILD_ID (src/buildInfo.js) with /version.json on the server;
// both are written by scripts/generate-version.cjs on every build.
import UpdateNotifier from "./Component/Shared/UpdateNotifier";
import OfflineBanner from "./Component/Shared/OfflineBanner";
// NEW: compares the email typed in the Login form with the Google account
// the user actually picked after the OAuth redirect.
import {
  checkGoogleEmailMatch,
  EXPECTED_GOOGLE_EMAIL_KEY,
} from "./utils/googleEmailCheck";

// ── FeedRedirect ──────────────────────────────────────────────────────────
// FIX: old links to /feed?post=<id> — from the navbar's post-notification
// click handler, and from the Home tab's own post-preview cards in
// homePage.jsx — carry a `post` query param so the destination knows
// which post to scroll to and highlight. A bare `<Navigate to="/?tab=posts" />`
// silently dropped that param, so clicking a specific post landed you on
// the top of the Posts tab instead of that post. This preserves whatever
// query string was already on /feed (post=..., or anything else) and just
// forces `tab=posts` onto it.
const FeedRedirect = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", "posts");
  return <Navigate to={`/?${params.toString()}`} replace />;
};

// ── Google Identity Services (One Tap) config ──────────────────────────────
// TODO: replace with the SAME OAuth Client ID configured under
// Supabase → Authentication → Providers → Google → "Client ID".
// Also add your ZIXPLON origin(s) (e.g. https://zixplon-tawny.vercel.app)
// to "Authorized JavaScript origins" in the Google Cloud Console for this
// Client ID, or One Tap will silently refuse to display.
const GOOGLE_CLIENT_ID = "578212794302-0pbugtvmlfo5k0pq1ph9fki82nnj9srl.apps.googleusercontent.com";

// Generates a nonce pair for the OIDC sign-in, as recommended by Supabase
// when using signInWithIdToken — protects against token replay.
async function generateNonce() {
  const rawNonce =
    (crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`;
  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(rawNonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { rawNonce, hashedNonce };
}

// ── Loading Screen ────────────────────────────────────────────────────────────
// NEW animated version: red glow + ripples, the red Z tile springs in, the
// Z is drawn as an outline then fills white, a shine sweeps across, a thin
// ring spins around the logo, the letters Z-I-X-P-L-O-N rise in one by one
// and a progress bar fills before the screen fades out. Same `onFinish`
// contract as before. Respects the "reduce motion" system setting.
const LOADER_LETTERS = "ZIXPLON".split("");

const LoadingScreen = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 2000);
    const doneTimer = setTimeout(() => onFinish && onFinish(), 2500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      className="zxl-root"
      style={{
        // ── FIX: use fixed + explicit 100vw/100vh instead of inset:0
        // so TV browsers (which mishandle inset + height:100% on #root)
        // still stretch this overlay to the full screen correctly ──
        position: "fixed",
        top: "0px",
        left: "0px",
        right: "0px",
        bottom: "0px",
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(ellipse at center, #1a0508 0%, #000000 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "0px",
        padding: "0px",
        zIndex: 9999,
        overflow: "hidden",
        opacity: fade ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Logo stage */}
      <div className="zxl-stage">
        <span className="zxl-glow" />
        <span className="zxl-pulse zxl-pulse-1" />
        <span className="zxl-pulse zxl-pulse-2" />

        {/* Spinning ring */}
        <svg className="zxl-ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle
            cx="120"
            cy="120"
            r="112"
            fill="none"
            stroke="#E81515"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="90 614"
          />
        </svg>

        {/* Logo — crisp inline SVG, never blurs */}
        <svg
          className="zxl-logo"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          role="img"
          aria-label="Zixplon"
        >
          <defs>
            <clipPath id="zxl-clip">
              <rect x="0" y="0" width="512" height="512" rx="110" ry="110" />
            </clipPath>
            <linearGradient id="zxl-shine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Red rounded square */}
          <rect x="0" y="0" width="512" height="512" rx="110" ry="110" fill="#CC0000" />
          {/* Top shine */}
          <rect x="0" y="0" width="512" height="260" rx="110" ry="110" fill="#E81515" opacity="0.55" />

          {/* Z: outline draws first... */}
          <polygon
            className="zxl-z-draw"
            points="108,108 404,108 404,178 220,334 404,334 404,404 108,404 108,334 292,178 108,178"
            pathLength="1"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          {/* ...then the solid white Z fades in over it */}
          <polygon
            className="zxl-z-fill"
            points="108,108 404,108 404,178 220,334 404,334 404,404 108,404 108,334 292,178 108,178"
            fill="#FFFFFF"
          />

          {/* Shine sweep */}
          <g clipPath="url(#zxl-clip)">
            <g className="zxl-sweep">
              <rect
                x="-200"
                y="-100"
                width="110"
                height="720"
                fill="url(#zxl-shine)"
                transform="rotate(20 -145 256)"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* App name — letters rise in one by one */}
      <div className="zxl-word" aria-label="ZIXPLON">
        {LOADER_LETTERS.map((ch, i) => (
          <span key={i} style={{ animationDelay: `${1.1 + i * 0.08}s` }}>
            {ch}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div className="zxl-bar">
        <span />
      </div>

      <style>{`
        .zxl-stage {
          position: relative;
          width: 220px; height: 220px;
          display: flex; align-items: center; justify-content: center;
        }
        .zxl-logo {
          width: 160px; height: 160px; display: block; position: relative; z-index: 2;
          animation: zxl-pop 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
        }
        .zxl-glow {
          position: absolute; width: 260px; height: 260px; border-radius: 50%;
          background: radial-gradient(circle, rgba(220,20,20,0.55), transparent 65%);
          animation: zxl-glow 1.8s ease-in-out infinite;
        }
        .zxl-pulse {
          position: absolute; width: 160px; height: 160px; border-radius: 36px;
          border: 2px solid rgba(232,21,21,0.7);
          animation: zxl-pulse 1.8s ease-out infinite;
        }
        .zxl-pulse-2 { animation-delay: 0.9s; }
        .zxl-ring {
          position: absolute; width: 220px; height: 220px; z-index: 1;
          animation: zxl-spin 1.4s linear infinite;
        }
        .zxl-z-draw {
          stroke-dasharray: 1; stroke-dashoffset: 0;
          animation: zxl-draw 0.9s ease-in-out 0.35s both, zxl-hide 0.3s ease 1.2s forwards;
        }
        .zxl-z-fill { animation: zxl-fillin 0.45s ease 1s both; }
        .zxl-sweep  { animation: zxl-sweep 0.9s ease-in-out 1.35s both; }

        .zxl-word {
          display: flex; gap: 6px; margin-top: 30px;
          color: #fff; font-size: 26px; font-weight: 800;
          font-family: 'Outfit', 'Nunito', sans-serif;
          letter-spacing: 6px; text-transform: uppercase;
        }
        .zxl-word span { display: inline-block; animation: zxl-letter 0.5s ease both; }

        .zxl-bar {
          width: 180px; height: 4px; margin-top: 34px;
          background: rgba(255,255,255,0.12); border-radius: 4px; overflow: hidden;
        }
        .zxl-bar span {
          display: block; height: 100%; width: 100%; border-radius: 4px;
          background: linear-gradient(90deg, #CC0000, #ff5a3c);
          transform-origin: left;
          animation: zxl-bar 2s cubic-bezier(0.3, 0.6, 0.3, 1) both;
        }

        @keyframes zxl-pop     { from { transform: scale(0.3) rotate(-12deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes zxl-draw    { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes zxl-hide    { to { opacity: 0; } }
        @keyframes zxl-fillin  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zxl-sweep   { from { transform: translateX(0); } to { transform: translateX(820px); } }
        @keyframes zxl-spin    { to { transform: rotate(360deg); } }
        @keyframes zxl-glow    { 0%,100% { transform: scale(0.9); opacity: 0.6; } 50% { transform: scale(1.1); opacity: 1; } }
        @keyframes zxl-pulse   { from { transform: scale(1); opacity: 0.8; } to { transform: scale(1.7); opacity: 0; } }
        @keyframes zxl-letter  { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 0.95; } }
        @keyframes zxl-bar     { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        /* "Reduce motion" setting: show the finished logo, no movement */
        @media (prefers-reduced-motion: reduce) {
          .zxl-root * { animation: none !important; }
          .zxl-z-draw { opacity: 0; }
          .zxl-sweep, .zxl-pulse, .zxl-ring { display: none; }
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

// ── NEW: Wrong Google account notice ─────────────────────────────────────────
// Shown when the Google account the user picked after the OAuth redirect
// differs from the email they typed in the Login form. The session has
// already been signed out by the time this renders.
const WrongGoogleAccountNotice = ({ expected, actual, onClose }) => (
  <div
    role="alert"
    style={{
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      width: "min(440px, 92%)",
      background: "#fff3e0",
      borderLeft: "4px solid #f97316",
      color: "#c2410c",
      padding: "12px 16px",
      borderRadius: "10px",
      fontSize: "14px",
      lineHeight: 1.5,
      fontFamily: "'Outfit', 'Nunito', sans-serif",
      zIndex: 1000000,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      boxSizing: "border-box",
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: "4px" }}>Different Google account selected</div>
    <div>
      You entered {expected}, but signed in with Google as {actual}. You have
      been signed out. Please try again and choose {expected}
      {" "}(use “Use another account” if it isn’t in the list).
    </div>
    <button
      onClick={onClose}
      style={{
        marginTop: "10px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "6px 14px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        color: "#374151",
      }}
    >
      Got it
    </button>
  </div>
);

// ── Floating Admin Panel Button ─────────────────────────────────────────────
// Only rendered when useIsAdmin() resolves true for the logged-in user
// (root email OR granted via the admin_users table). This is purely a
// UI shortcut to reach /admin — the route itself is independently
// protected by AdminPanel.jsx's own auth check, so this button being
// visible/hidden has no bearing on actual access control.
const AdminFab = () => (
  <Link
    to="/admin"
    title="Admin Panel"
    style={{
      position: "fixed",
      bottom: "90px",
      right: "20px",
      width: "48px",
      height: "48px",
      borderRadius: "50%",
      background: "#dc2626",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
      boxShadow: "0 4px 16px rgba(220,38,38,0.4)",
      zIndex: 9998,
      textDecoration: "none",
    }}
  >
    🛡️
  </Link>
);

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const location = useLocation();
  const [appReady, setAppReady] = useState(() =>
    ["/about", "/privacy-policy", "/terms-and-conditions"].includes(window.location.pathname)
  );
  const [sideNavbar, setSideNavbar] = useState(false);
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || null,
  );

  // ── Auto-login-detect: session check + login options modal ──
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // ── NEW: Password recovery modal — set true when the auth listener
  // below catches a PASSWORD_RECOVERY event (user clicked a reset-email
  // link). Rendered as a floating modal, same pattern as LoginOptionsModal
  // and UsernameSetupModal below. ──
  const [showResetPassword, setShowResetPassword] = useState(false);

  // ── NEW: wrong-Google-account check ──
  // returnedFromOAuthRef: true only if this page load came back from an
  //   OAuth redirect (tokens in the hash, or ?code=). Captured once on
  //   first render, before the hash is cleaned. Without this, a stale
  //   "typed email" left in sessionStorage by an abandoned Google attempt
  //   could wrongly sign out a legitimate user on a later reload.
  // googleCheckDoneRef: the typed-email check runs once per page load
  //   (checkGoogleEmailMatch consumes its sessionStorage key).
  // googleMismatchTokenRef: access token of the rejected session, so BOTH
  //   getSession() and onAuthStateChange() skip it, without blocking a
  //   later legitimate login in the same page load.
  const [googleMismatch, setGoogleMismatch] = useState(null);
  const returnedFromOAuthRef = useRef(
    window.location.hash.includes("access_token") ||
      new URLSearchParams(window.location.search).has("code")
  );
  const googleCheckDoneRef = useRef(false);
  const googleMismatchTokenRef = useRef(null);

  // ── Google One Tap state ──
  const [oneTapAttempted, setOneTapAttempted] = useState(false);
  const oneTapCancelledRef = useRef(false);

  // ── Exit-on-back state ──
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef(null);
  const backPressedOnce = useRef(false);

  // ── Messages floating panel state ──
  const [showMessagesPanel, setShowMessagesPanel] = useState(false);
  const [messagesActiveUser, setMessagesActiveUser] = useState(null);

  // ── Mirrors showMessagesPanel in a ref so the mobile back-button
  // popstate handler (defined inside a useEffect with a stable dependency
  // array) can read the CURRENT value instead of a stale closed-over one.
  // Also used to suppress App's own exit-toast logic while a pop event is
  // actually being consumed by MessagesPanel closing itself — see the
  // handlePopState guard below for why this is needed. ──
  const showMessagesPanelRef = useRef(false);
  useEffect(() => {
    showMessagesPanelRef.current = showMessagesPanel;
    // If the panel just opened, clear any exit-toast countdown that might
    // still be armed from an earlier home back-press, so opening Messages
    // never inherits a half-finished "press back again to exit" state.
    if (showMessagesPanel) {
      backPressedOnce.current = false;
      setShowExitToast(false);
      clearTimeout(exitToastTimer.current);
    }
  }, [showMessagesPanel]);

  // ── Username setup prompt: fires when a logged-in user still has an
  // auto-generated fallback username (e.g. "user_41859fe2") ──
  const { needsSetup: needsUsernameSetup, markComplete: markUsernameSetupComplete } =
    useRequireUsernameSetup(currentUser);

  // ── starts/resumes this tab's visit tracking and keeps it
  // heartbeating in the background for the rest of the session. See
  // src/hooks/useVisitTracking.js and AdminPanel.jsx's "Visitors" tab. ──
  useVisitTracking(currentUser);

  // ── NEW: resolves whether the logged-in user is an admin, purely to
  // decide whether to render the floating Admin Panel button (AdminFab)
  // below. See src/hooks/useIsAdmin.js. ──
  const { isAdmin } = useIsAdmin(currentUser);

  // ── Supabase warmup ──
  useEffect(() => {
    supabase.from("videos").select("id").limit(1).then(() => { });
  }, []);

  // ── Global listener: opens the Messages panel from anywhere (sidebar,
  // a post's kebab menu, etc) without navigating/unmounting the current
  // page. Optional detail.username opens directly into that conversation. ──
  useEffect(() => {
    const handler = (e) => {
      setMessagesActiveUser(e.detail?.username || null);
      setShowMessagesPanel(true);
    };
    window.addEventListener("openMessages", handler);
    return () => window.removeEventListener("openMessages", handler);
  }, []);

  // ── NEW: returns true if this session belongs to a Google account
  // different from the email the user typed before the redirect. On the
  // first mismatch it signs the user out (this device only) and shows the
  // notice. Safe to call from both getSession() and onAuthStateChange().
  // The check only runs when this page load really came back from an
  // OAuth redirect; otherwise any stale saved email is discarded. ──
  const isWrongGoogleAccount = useCallback((session) => {
    if (!session?.user) return false;

    if (!googleCheckDoneRef.current) {
      googleCheckDoneRef.current = true;

      if (!returnedFromOAuthRef.current) {
        // Not coming back from Google: discard any stale saved email.
        try {
          sessionStorage.removeItem(EXPECTED_GOOGLE_EMAIL_KEY);
        } catch (_) {}
      } else {
        const { mismatch, expected, actual } = checkGoogleEmailMatch(session);
        if (mismatch) {
          googleMismatchTokenRef.current = session.access_token;
          setGoogleMismatch({ expected, actual });
          // Deferred: Supabase advises against calling its auth methods
          // synchronously inside onAuthStateChange (can deadlock).
          setTimeout(() => {
            supabase.auth.signOut({ scope: "local" });
          }, 0);
        }
      }
    }

    return (
      googleMismatchTokenRef.current !== null &&
      session.access_token === googleMismatchTokenRef.current
    );
  }, []);

  // ── Shared: resolve/create the profile row for a Supabase auth user ──
  // Used by both the session-restore effect and the Google One Tap callback.
  const resolveUsername = useCallback(async (u) => {
    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("username, profile_pic, about")
        .eq("id", u.id)
        .maybeSingle();

      // ── Auto-create profile for Google OAuth / One Tap users who have none ──
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
  }, []);

  // ── Single auth effect — profiles table is always source of truth ──
  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        alert(`getSession error: ${error.message}`);
      }

      // ── Check for OAuth error returned in the URL (hash or query) ──
      const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
      const queryParams = new URLSearchParams(window.location.search);
      const oauthError =
        hashParams.get("error_description") || queryParams.get("error_description");
      if (oauthError) {
        alert(`OAuth redirect error: ${decodeURIComponent(oauthError)}`);
      }

      if (session?.user) {
        // NEW: reject a Google session that doesn't match the typed email
        if (isWrongGoogleAccount(session)) {
          if (window.location.hash?.includes("access_token")) {
            window.history.replaceState({}, document.title, "/");
          }
          setSessionChecked(true);
          return;
        }

        const name = await resolveUsername(session.user);
        setCurrentUser(name);
        setShowLoginModal(false);
        if (window.location.hash?.includes("access_token")) {
          window.history.replaceState({}, document.title, "/");
        }
      } else if (oauthError && !error) {
        alert("No session was created after Google redirect.");
      }
      // NOTE: we no longer decide showLoginModal here. When there's no
      // session, the Google One Tap effect below runs next and only falls
      // back to the manual LoginOptionsModal if One Tap can't be shown.
      setSessionChecked(true);
    });

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // NEW: password-recovery link was clicked — Supabase has already
        // established a temporary recovery session from the URL's
        // #access_token hash. Pop the reset-password modal; the hash
        // cleanup below (inside the session?.user branch that already
        // runs for any session) takes care of scrubbing the tokens from
        // the address bar, same as it already does for OAuth logins.
        if (event === "PASSWORD_RECOVERY") {
          setShowResetPassword(true);
        }

        if (!session) {
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

        // NEW: reject a Google session that doesn't match the typed email
        if (isWrongGoogleAccount(session)) {
          if (window.location.hash?.includes("access_token")) {
            window.history.replaceState({}, document.title, "/");
          }
          return;
        }

        resolveUsername(session.user).then((name) => {
          setCurrentUser(name);
          setShowLoginModal(false);
          if (window.location.hash?.includes("access_token")) {
            window.history.replaceState({}, document.title, "/");
          }
        });
      }
    );

    return () => subscription.unsubscribe();
  }, [resolveUsername, isWrongGoogleAccount]);

  // ── Load the Google Identity Services script once ──
  useEffect(() => {
    if (document.getElementById("google-identity-script")) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.id = "google-identity-script";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // ── Google One Tap: silently detect a Google account already signed
  // into the browser and log the user straight in. Falls back to the
  // existing LoginOptionsModal if One Tap can't be displayed (no Google
  // session in the browser, user opted out, FedCM blocked, etc). ──
  // NEW: "/install" added so the shared PWA install link opens cleanly,
  // without One Tap or the login modal appearing on top of it.
  const suppressAutoModalRoutes = ["/signup", "/install", "/about", "/privacy-policy", "/terms-and-conditions"];

  useEffect(() => {
    if (!sessionChecked || currentUser) return;
    if (oneTapAttempted) return;
    if (suppressAutoModalRoutes.includes(location.pathname)) return;
    // NEW: don't auto-sign the user straight back in with One Tap right
    // after we rejected a wrong Google account — let them read the notice.
    if (googleMismatch) return;

    // Don't race with an in-flight OAuth redirect that's still resolving
    // its own #access_token hash (this is the exact race you're chasing
    // on mobile PWA — One Tap must not touch it). This also correctly
    // covers a PASSWORD_RECOVERY link, since that arrives with the same
    // #access_token hash shape.
    const hasAuthPayload =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      new URLSearchParams(window.location.search).has("code");
    if (hasAuthPayload) return;

    oneTapCancelledRef.current = false;

    const fallbackToModal = () => {
      const dismissed = sessionStorage.getItem("zixplon_login_dismissed") === "1";
      setShowLoginModal(!dismissed);
    };

    const tryOneTap = async () => {
      // GIS script loads async — wait up to ~4s for it to be ready.
      let attempts = 0;
      while (!window.google?.accounts?.id && attempts < 40) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      if (oneTapCancelledRef.current) return;

      if (!window.google?.accounts?.id) {
        setOneTapAttempted(true);
        fallbackToModal();
        return;
      }

      const { rawNonce, hashedNonce } = await generateNonce();

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: rawNonce,
            });
            if (error) {
              console.error("One Tap sign-in error:", error.message);
              fallbackToModal();
              return;
            }
            if (data?.user) {
              const name = await resolveUsername(data.user);
              setCurrentUser(name);
              setShowLoginModal(false);
            }
          } catch (e) {
            console.error("One Tap sign-in exception:", e);
            fallbackToModal();
          }
        },
        nonce: hashedNonce,
        auto_select: true,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });

      window.google.accounts.id.prompt((notification) => {
        setOneTapAttempted(true);
        const wasShown =
          typeof notification.isDisplayed === "function"
            ? notification.isDisplayed()
            : false;
        if (!wasShown) {
          // No Google session in this browser, user previously dismissed
          // One Tap too many times, FedCM disabled, etc — use our modal.
          fallbackToModal();
        }
      });
    };

    tryOneTap();

    return () => {
      oneTapCancelledRef.current = true;
      if (window.google?.accounts?.id?.cancel) {
        window.google.accounts.id.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, currentUser, location.pathname]);

  // ── Mobile back-button exit logic ─────────────────────────────────────────
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // ── Don't touch history if an OAuth redirect hash/code is still present ──
    const hasAuthPayload =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("error") ||
      new URLSearchParams(window.location.search).has("code");
    if (hasAuthPayload) return;

    const isHome = location.pathname === "/";
    if (!isHome) {
      backPressedOnce.current = false;
      setShowExitToast(false);
      clearTimeout(exitToastTimer.current);
      return;
    }

    window.history.pushState({ zixplonExit: true }, "", "/");

    const handlePopState = (e) => {
      // MessagesPanel owns the back-stack whenever it's open. This needs to
      // check showMessagesPanelRef (not just e.state.mpDepth) because the
      // *closing* pop (depth 1 -> 0) lands on App's own "/" history entry,
      // which has no mpDepth on it at all — only the ref tells us the panel
      // was still open when this pop happened.
      if (
        showMessagesPanelRef.current ||
        (e.state && Object.prototype.hasOwnProperty.call(e.state, "mpDepth"))
      ) {
        return;
      }

      if (backPressedOnce.current) {
        clearTimeout(exitToastTimer.current);
        setShowExitToast(false);
        backPressedOnce.current = false;
        window.history.pushState({ zixplonExit: true }, "", "/");
        setTimeout(() => {
          window.location.href = "about:blank";
        }, 50);
        return;
      }

      backPressedOnce.current = true;
      setShowExitToast(true);
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

  const isUtilityTab =
    location.pathname === "/" &&
    new URLSearchParams(location.search).get("tab") === "utility";

  // NEW: the Posts tab is "/" with ?tab=posts. The side navbar is hidden
  // there and the content-shift margin is zeroed so the feed uses the
  // full page width. (Pathname alone can't tell Home and Posts apart.)
  const isPostsTab =
    location.pathname === "/" &&
    new URLSearchParams(location.search).get("tab") === "posts";

  // NEW: "/install" added so the PWA install page has no footer.
  const hideFooter =
    ["/youtube", "/local-player", "/videoUpload", "/install"].includes(location.pathname) ||
    location.pathname.startsWith("/reels") ||
    location.pathname.endsWith("/upload") ||
    location.pathname.startsWith("/utility") ||
    isUtilityTab;

  // Don't stack the auto-login modal on top of the dedicated signup/login page
  const shouldShowLoginModal =
    sessionChecked &&
    showLoginModal &&
    !currentUser &&
    !suppressAutoModalRoutes.includes(location.pathname);

  const handleDismissLoginModal = () => {
    sessionStorage.setItem("zixplon_login_dismissed", "1");
    setShowLoginModal(false);
  };

  // ── FIX: render LoadingScreen BEFORE the main App div so it is a direct
  // child of <body> via the React root — this bypasses any height/overflow
  // constraints on #root that confuse TV browser fixed positioning ──
  if (!appReady) {
    return <LoadingScreen onFinish={() => setAppReady(true)} />;
  }

  return (
    <PresenceProvider currentUser={currentUser}>
      {/* NEW: CallProvider sits inside PresenceProvider and gets the same
          currentUser the rest of the app uses, so it starts/stops listening
          for calls automatically on login/logout. It renders the call
          overlay itself, above everything else on the page. */}
      <CallProvider currentUser={currentUser}>
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

          {/* NEW: shown when the Google account picked after the redirect
            doesn't match the email typed in the Login form. */}
          {googleMismatch && (
            <WrongGoogleAccountNotice
              expected={googleMismatch.expected}
              actual={googleMismatch.actual}
              onClose={() => {
                setGoogleMismatch(null);
                // Let the normal login prompt come back after the notice.
                setShowLoginModal(true);
              }}
            />
          )}

          {/* NEW: "New version available — Refresh" banner. Checks
            /version.json on load, every 5 minutes, and whenever the tab
            regains focus; only appears after a new deploy. */}
          <UpdateNotifier />

          {/* Auto login detect: Google One Tap tries first (silent, no click
            needed); if it can't be shown, this modal is the fallback */}
          {shouldShowLoginModal && (
            <LoginOptionsModal onDismiss={handleDismissLoginModal} />
          )}

          {/* NEW: Password recovery modal — takes priority over the login
            modal / username setup so a user coming in from a reset-email
            link sees the "set new password" form immediately, on top of
            whatever page they landed on. */}
          {showResetPassword && (
            <ResetPassword setResetModal={setShowResetPassword} />
          )}

          {/* Username setup prompt — shown when a logged-in user still has
            an auto-generated fallback username (e.g. "user_41859fe2").
            Takes priority over the Messages panel so a user can't hide
            behind chat while leaving their username unset. */}
          {currentUser && needsUsernameSetup && (
            <UsernameSetupModal
              onComplete={() => {
                markUsernameSetupComplete();
                window.location.reload();
              }}
            />
          )}

          {/* Floating Messages panel — opened via the "openMessages" custom
            event (sidebar click, a post's "Message" option, etc). Renders
            on top of whatever page is currently active, without navigating
            away or unmounting it. */}
          {showMessagesPanel && (
            <MessagesPanel
              initialUsername={messagesActiveUser}
              onClose={() => setShowMessagesPanel(false)}
            />
          )}

          {/* Floating Admin Panel shortcut — only visible to admins.
            See useIsAdmin() above and src/hooks/useIsAdmin.js. */}
          {currentUser && isAdmin && <AdminFab />}

          <Navbar
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            setSideNavbarFunc={setSideNavbar}
            sideNavbar={sideNavbar}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#f0f4ff" }}>
            {/* CHANGED: the side navbar is not rendered on the Posts tab. */}
            {!isPostsTab && <SideNavbar sideNavbar={sideNavbar} />}

            {/* ── FIX: content-shift wrapper ──
              Reserves left space for the sidebar so page content never
              renders underneath it. Sidebar is ALWAYS visible on desktop
              (275px expanded / 72px collapsed icon-only strip) EXCEPT on
              the Posts tab, where it is hidden and this margin is 0.
              On mobile the sidebar is display:none (handled by the
              .zx-content-shift media query in App.css). */}
            <div
              className="zx-content-shift"
              style={{
                marginLeft: isPostsTab ? "0px" : sideNavbar ? "275px" : "72px",
                transition: "margin-left 0.2s ease",
                minHeight: "calc(100vh - 56px)",
              }}
            >
              <Routes>
                {/* FIX: "/" now renders the merged HomeHub — Home feed and
                  Posts as in-page sub-tabs (?tab=home / ?tab=posts), with
                  Upload as a button inside that tab bar rather than its
                  own nav entry. See src/Pages/Home/HomeHub.jsx.
                  currentUser is now passed through so Posts (and its
                  Upload/comment/react actions) uses the SAME auth state
                  as the rest of the app instead of reading localStorage
                  independently. */}
                <Route path="/" element={<HomeHub sideNavbar={sideNavbar} currentUser={currentUser} />} />
                <Route path="/video/:id" element={<Video sideNavbar={sideNavbar} />} />
                <Route path="/user/:username" element={<Profile sideNavbar={sideNavbar} />} />
                <Route path="/videoUpload" element={<VideoUpload />} />
                <Route path="/:id/upload" element={<VideoUpload />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/reels" element={<Reels />} />
                <Route path="/reels/:id" element={<Reels />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/notifications" element={<Notifications currentUser={currentUser} />} />

                <Route path="/history" element={<History currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/playlist" element={<Playlist currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/your-videos" element={<YourVideos currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/watch-later" element={<WatchLater currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/liked-videos" element={<LikedVideos currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/your-clips" element={<YourClips currentUser={currentUser} sideNavbar={sideNavbar} />} />
                <Route path="/subscription" element={<SubscriptionFeed currentUser={currentUser} sideNavbar={sideNavbar} />} />

                <Route path="/live-tv" element={<LiveTVPage sideNavbar={sideNavbar} />} />
                <Route path="/local-player" element={<LocalMediaPlayer sideNavbar={sideNavbar} />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/help" element={<Help />} />
                <Route path="/contact" element={<ContactSupport />} />
                <Route path="/report" element={<ReportProblem />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/dmca" element={<DmcaPage />} />
                <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
                <Route path="/advertise" element={<AdvertisePage />} />
                {/* FIX: /feed is now folded into HomeHub as the "Posts"
                  sub-tab. Old bookmarks/shared links to /feed still work
                  — they're redirected straight to /?tab=posts instead of
                  rendering a separate standalone page. */}
                <Route path="/feed" element={<FeedRedirect />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/live" element={<LiveBrowser currentUser={currentUser} />} />
                <Route path="/foryou" element={<ExploreGrid />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/utility" element={<div style={{ paddingTop: 80 }}><UtilityPage /></div>} />
                <Route path="/utility/recharge" element={<RechargeForm />} />
                <Route path="/utility/electricity" element={<BillPaymentForm />} />
                <Route path="/utility/history" element={<TransactionHistory />} />
                {/* NEW: hashtag pages — /tag/:tag. Linked from every
                  #hashtag rendered via ExpandableText/linkifyText. */}
                <Route path="/tag/:tag" element={<HashtagPage sideNavbar={sideNavbar} currentUser={currentUser} />} />
                {/* NEW: shareable PWA install page. Share this link:
                  https://zixplon-tawny.vercel.app/install */}
                <Route path="/install" element={<InstallPage />} />
                {/* NEW: shared links from /api/og -> real page. */}
                <Route path="/s/:type/:code" element={<ShareRedirect />} />
                {/* NEW: anything else shows a message instead of a blank page. */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </div>

          <BottomNav currentUser={currentUser} />
          <OfflineBanner />
          {!hideFooter && <Footer sideNavbar={sideNavbar} />}
        </div>
      </CallProvider>
    </PresenceProvider>
  );
}

export default App;