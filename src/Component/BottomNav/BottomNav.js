import React from "react";
import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import SearchIcon from "@mui/icons-material/Search";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

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
          /* Push page content above bottom nav on mobile */
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
          <HomeIcon sx={{ fontSize: "24px", color: isActive("/") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/") ? activeColor : inactiveColor }}>Home</span>
        </Link>

        <Link to="/reels" className="bottom-nav-item">
          <SlideshowIcon sx={{ fontSize: "24px", color: isActive("/reels") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/reels") ? activeColor : inactiveColor }}>Shorts</span>
        </Link>

        <Link to="/?search=true" className="bottom-nav-item">
          <SearchIcon sx={{ fontSize: "24px", color: inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: inactiveColor }}>Search</span>
        </Link>

        <Link to="/763/upload" className="bottom-nav-item">
          <VideoCallIcon sx={{ fontSize: "24px", color: isActive("/763/upload") ? activeColor : inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: isActive("/763/upload") ? activeColor : inactiveColor }}>Upload</span>
        </Link>

        <Link to={currentUser ? `/user/${currentUser}` : "/signup"} className="bottom-nav-item">
          <AccountCircleIcon sx={{ fontSize: "24px", color: inactiveColor }} />
          <span className="bottom-nav-label" style={{ color: inactiveColor }}>
            {currentUser ? "Profile" : "Sign In"}
          </span>
        </Link>
      </nav>
    </>
  );
};

export default BottomNav;