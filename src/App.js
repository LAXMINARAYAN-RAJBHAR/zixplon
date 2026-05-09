import "./App.css";
import Navbar from "./Component/Navbar/navbar";
import Home from "./Pages/Home/home";
import { useState } from "react";
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

function AppContent() {
  const location = useLocation();
  const [sideNavbar, setSideNavbar] = useState(false);

  // ✅ Notifications state lifted here so both Navbar and Notifications page share it
  const [notifications, setNotifications] = useState([
    { id: 1, type: "upload",     message: "TechWorld uploaded: 'React 19 Features'",     time: "2m ago",  read: false, avatar: "T" },
    { id: 2, type: "like",       message: "Alex liked your video 'My Portfolio Tour'",   time: "10m ago", read: false, avatar: "A" },
    { id: 3, type: "comment",    message: "Sara commented: 'Great content! 🔥'",         time: "25m ago", read: false, avatar: "S" },
    { id: 4, type: "subscriber", message: "John subscribed to your channel",             time: "1h ago",  read: false, avatar: "J" },
    { id: 5, type: "upload",     message: "CodeWithMe uploaded: 'Node.js Crash Course'", time: "2h ago",  read: true,  avatar: "C" },
    { id: 6, type: "like",       message: "Priya liked your video 'CSS Animations'",     time: "3h ago",  read: true,  avatar: "P" },
  ]);

  const hideFooter = ["/youtube", "/reels"].includes(location.pathname);

  return (
    <div className="App">
      {/* ✅ Pass notifications + setNotifications to Navbar */}
      <Navbar
        setSideNavbarFunc={setSideNavbar}
        sideNavbar={sideNavbar}
        notifications={notifications}
        setNotifications={setNotifications}
      />
      <Routes>
        <Route path="/" element={<Home sideNavbar={sideNavbar} />} />
        <Route path="/video/:id" element={<Video />} />
        <Route path="/user/:id" element={<Profile sideNavbar={sideNavbar} />} />
        <Route path="/:id/upload" element={<VideoUpload />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reels" element={<Reels />} />
        <Route path="/profile/:username" element={<Profile sideNavbar={sideNavbar} />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/youtube" element={<YouTubeSearch />} />
        {/* ✅ Pass notifications to Notifications page */}
        <Route path="/notifications" element={<Notifications notifications={notifications} />} />
      </Routes>
      {!hideFooter && <Footer />}
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;