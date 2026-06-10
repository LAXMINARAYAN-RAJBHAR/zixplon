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

  const activeColor = "#7c3aed";
  const inactiveColor = "#8b84c4";

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
            height: 60px;
            background: #ffffff;
            border-top: 2px solid #e0d4ff;
            box-shadow: 0 -4px 20px rgba(124, 58, 237, 0.10);
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
            position: relative;
            transition: transform 0.15s;
          }

          .bottom-nav-item:active {
            transform: scale(0.92);
          }

          /* Active indicator pill above icon */
          .bottom-nav-item.active-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 3px;
            background: linear-gradient(90deg, #7c3aed, #a855f7);
            border-radius: 0 0 3px 3px;
          }

          .bottom-nav-label {
            font-size: 10px;
            font-weight: 700;
            font-family: 'Nunito', sans-serif;
            letter-spacing: 0.2px;
            transition: color 0.15s;
          }

          /* Active icon gets a soft purple glow background */
          .bottom-nav-icon-wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 26px;
            border-radius: 14px;
            transition: background 0.2s;
          }

          .bottom-nav-item.active-item .bottom-nav-icon-wrap {
            background: rgba(124, 58, 237, 0.12);
          }

          .homePage,
          .video,
          .reels_container,
          .videoUpload,
          .signUp,
          .footer {
            padding-bottom: 68px !important;
          }
        }
      `}</style>

      <nav className="bottom-nav">
        <Link
          to="/"
          className={`bottom-nav-item${isActive("/") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <HomeIcon sx={{ fontSize: "22px", color: isActive("/") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/") ? activeColor : inactiveColor }}>
            Home
          </span>
        </Link>

        <Link
          to="/reels"
          className={`bottom-nav-item${isActive("/reels") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <SlideshowIcon sx={{ fontSize: "22px", color: isActive("/reels") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/reels") ? activeColor : inactiveColor }}>
            Shorts
          </span>
        </Link>

        <Link
          to="/local-player"
          className={`bottom-nav-item${isActive("/local-player") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <FolderOpenIcon sx={{ fontSize: "22px", color: isActive("/local-player") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/local-player") ? activeColor : inactiveColor }}>
            Player
          </span>
        </Link>

        <Link
          to="/feed"
          className={`bottom-nav-item${isActive("/feed") ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <NewspaperIcon sx={{ fontSize: "22px", color: isActive("/feed") ? activeColor : inactiveColor }} />
          </div>
          <span className="bottom-nav-label" style={{ color: isActive("/feed") ? activeColor : inactiveColor }}>
            Posts
          </span>
        </Link>

        <Link
          to={currentUser ? `/user/${currentUser}` : "/signup"}
          className={`bottom-nav-item${isActive(`/user/${currentUser}`) ? " active-item" : ""}`}
        >
          <div className="bottom-nav-icon-wrap">
            <AccountCircleIcon
              sx={{
                fontSize: "22px",
                color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor,
              }}
            />
          </div>
          <span
            className="bottom-nav-label"
            style={{ color: isActive(`/user/${currentUser}`) ? activeColor : inactiveColor }}
          >
            {currentUser ? "Profile" : "Sign In"}
          </span>
        </Link>
      </nav>
    </>
  );
};

export default BottomNav;