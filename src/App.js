import "./App.css";
import Navbar from "./Component/Navbar/navbar";
import Home from "./Pages/Home/home";
import { useState, useEffect } from "react";
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

function App() {
  const location = useLocation();
  const [sideNavbar, setSideNavbar] = useState(true);
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || null,
  );

  // ── Warm up Supabase connection on app load ──
  useEffect(() => {
    supabase.from("videos").select("id").limit(1).then(() => {});
  }, []);

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const user = session.user;
        const name =
          user.user_metadata?.channelName ||
          user.user_metadata?.full_name ||
          user.user_metadata?.username ||
          user.email?.split("@")[0];
        const pic =
          user.user_metadata?.profilePic ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          "";
        localStorage.setItem("username", name);
        localStorage.setItem("email", user.email);
        localStorage.setItem("userId", user.id);
        if (pic) localStorage.setItem("profilePic", pic);
        setCurrentUser(name);
        if (
          window.location.hash &&
          window.location.hash.includes("access_token")
        ) {
          window.history.replaceState({}, document.title, "/");
        }
      }
    };
    handleAuthRedirect();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        const name =
          localStorage.getItem("username") ||
          u.user_metadata?.channelName ||
          u.user_metadata?.username ||
          u.user_metadata?.full_name ||
          u.email?.split("@")[0];
        setCurrentUser(name);
        localStorage.setItem("username", name);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const name =
          localStorage.getItem("username") ||
          u.user_metadata?.channelName ||
          u.user_metadata?.username ||
          u.user_metadata?.full_name ||
          u.email?.split("@")[0];
        setCurrentUser(name);
        localStorage.setItem("username", name);
      } else {
        setCurrentUser(null);
        localStorage.removeItem("username");
        localStorage.removeItem("email");
        localStorage.removeItem("userId");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "upload",
      message: "TechWorld uploaded: 'React 19 Features'",
      time: "2m ago",
      read: false,
      avatar: "T",
    },
    {
      id: 2,
      type: "like",
      message: "Alex liked your video 'My Portfolio Tour'",
      time: "10m ago",
      read: false,
      avatar: "A",
    },
    {
      id: 3,
      type: "comment",
      message: "Sara commented: 'Great content! 🔥'",
      time: "25m ago",
      read: false,
      avatar: "S",
    },
    {
      id: 4,
      type: "subscriber",
      message: "John subscribed to your channel",
      time: "1h ago",
      read: false,
      avatar: "J",
    },
    {
      id: 5,
      type: "upload",
      message: "CodeWithMe uploaded: 'Node.js Crash Course'",
      time: "2h ago",
      read: true,
      avatar: "C",
    },
    {
      id: 6,
      type: "like",
      message: "Priya liked your video 'CSS Animations'",
      time: "3h ago",
      read: true,
      avatar: "P",
    },
  ]);

  const hideFooter = ["/youtube", "/reels"].includes(location.pathname);

  return (
    <div
      className="App"
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <ScrollToTop />
      <Navbar
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        setSideNavbarFunc={setSideNavbar}
        sideNavbar={sideNavbar}
        notifications={notifications}
        setNotifications={setNotifications}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/" element={<Home sideNavbar={sideNavbar} />} />
          <Route path="/video/:id" element={<Video />} />
          <Route
            path="/user/:username"
            element={<Profile sideNavbar={sideNavbar} />}
          />
          {/* Fixed: BottomNav links to /videoUpload, route now matches */}
          <Route path="/videoUpload" element={<VideoUpload />} />
          <Route path="/upload" element={<VideoUpload />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/reels/:id" element={<Reels />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/youtube" element={<YouTubeSearch />} />
          <Route
            path="/notifications"
            element={<Notifications notifications={notifications} />}
          />
          <Route
            path="/history"
            element={<ComingSoon title="History" sideNavbar={sideNavbar} />}
          />
          <Route
            path="/playlist"
            element={<ComingSoon title="Playlist" sideNavbar={sideNavbar} />}
          />
          <Route
            path="/your-videos"
            element={<ComingSoon title="Your Videos" sideNavbar={sideNavbar} />}
          />
          <Route
            path="/watch-later"
            element={<ComingSoon title="Watch Later" sideNavbar={sideNavbar} />}
          />
          <Route
            path="/liked-videos"
            element={
              <ComingSoon title="Liked Videos" sideNavbar={sideNavbar} />
            }
          />
          <Route
            path="/your-clips"
            element={<ComingSoon title="Your Clips" sideNavbar={sideNavbar} />}
          />
          <Route
            path="/subscription"
            element={
              <ComingSoon title="Subscription" sideNavbar={sideNavbar} />
            }
          />
          <Route
            path="/live-tv"
            element={<LiveTVPage sideNavbar={sideNavbar} />}
          />
          <Route
            path="/local-player"
            element={<LocalMediaPlayer sideNavbar={sideNavbar} />}
          />
          <Route
            path="/terms-and-conditions"
            element={<TermsAndConditions />}
          />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/help" element={<Help />} />
          <Route path="/contact" element={<ContactSupport />} />
          <Route path="/report" element={<ReportProblem />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/dmca" element={<DmcaPage />} />
          <Route
            path="/community-guidelines"
            element={<CommunityGuidelinesPage />}
          />
          <Route path="/advertise" element={<AdvertisePage />} />
          <Route path="/feed" element={<PostFeed sideNavbar={sideNavbar} />} />
        </Routes>
      </div>

      {/* ✅ BottomNav OUTSIDE Routes — only visible on mobile */}
      <BottomNav currentUser={currentUser} />

      {/* ✅ Footer receives sideNavbar to adjust left margin */}
      {!hideFooter && <Footer sideNavbar={sideNavbar} />}
    </div>
  );
}

export default App;