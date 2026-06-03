import React from "react";
import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import SearchIcon from "@mui/icons-material/Search";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import NewspaperIcon from "@mui/icons-material/Newspaper";

const BottomNav = ({ currentUser }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const activeColor = "#ff0000";
  const inactiveColor = "#aaa";

  return (
    <>
      <style>{`
        .bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: #0f0f0f;
            border-top: 1px solid #222;
            z-index: 9999;
            align-items: center;
            justify-content: space-around;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            text-decoration: none;
            flex: 1;
            padding: 6px 0;
            cursor: pointer;
          }
          .bottom-nav-label {
            font-size: 10px;
            font-weight: 500;
          }
          .homePage,
          .video,
          .reels_container,
          .videoUpload,
          .signUp,
          .footer {
            padding-bottom: 64px !important;
          }
        }
      `}</style>

      <nav className="bottom-nav">
        <Link to="/" className="bottom-nav-item">
          <HomeIcon sx={{ fontSize: "22px", color: isActive("/") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/") ? activeColor : inactiveColor }}>Home</span>
        </Link>

        <Link to="/reels" className="bottom-nav-item">
          <SlideshowIcon sx={{ fontSize: "22px", color: isActive("/reels") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/reels") ? activeColor : inactiveColor }}>Shorts</span>
        </Link>

        <Link to="/local-player" className="bottom-nav-item">
          <FolderOpenIcon sx={{ fontSize: "22px", color: isActive("/local-player") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/local-player") ? activeColor : inactiveColor }}>Player</span>
        </Link>

        <Link to="/feed" className="bottom-nav-item">
  <NewspaperIcon sx={{ fontSize: "22px", color: isActive("/feed") ? activeColor : inactiveColor }} />
  <span className="bottom-nav-label" style={{ color: isActive("/feed") ? activeColor : inactiveColor }}>Posts</span>
</Link>

        <Link to={currentUser ? `/user/${currentUser}` : "/signup"} className="bottom-nav-item">
          <AccountCircleIcon sx={{ fontSize: "22px", color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor }}>
            {currentUser ? "Profile" : "Sign In"}
          </span>
        </Link>
      </nav>
    </>
  );
};

export default BottomNav;