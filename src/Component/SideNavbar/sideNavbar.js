import React from "react";
import "./sideNavbar.css";
import OtherHousesIcon from '@mui/icons-material/OtherHouses';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RecentActorsIcon from "@mui/icons-material/RecentActors";
import HistoryIcon from "@mui/icons-material/History";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import SmartDisplayIcon from "@mui/icons-material/SmartDisplay";
import WatchLaterIcon from "@mui/icons-material/WatchLater";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import { Link, useLocation } from "react-router-dom";

const SideNavbar = ({ sideNavbar }) => {
  const location = useLocation();

  // ✅ Helper: highlight active link
  const isActive = (path) => location.pathname === path;

  const activeStyle = {
    background: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
  };

  return (
    <div className={sideNavbar ? "home-sideNavbar" : "homeSideNavbarHide"}>

      {/* ── TOP SECTION ── */}
      <div className="home_sideNavbarTop">

        {/* Home */}
        <Link to="/" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/") ? activeStyle : {}}>
            <OtherHousesIcon />
            <div className="home_sideNavbarTopOptionTitle">Home</div>
          </div>
        </Link>

        {/* Shorts */}
        <Link to="/reels" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/reels") ? activeStyle : {}}>
            <SlideshowIcon />
            <div className="home_sideNavbarTopOptionTitle">Shorts</div>
          </div>
        </Link>

        {/* Subscription */}
        <Link to="/subscription" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/subscription") ? activeStyle : {}}>
            <SubscriptionsIcon />
            <div className="home_sideNavbarTopOptionTitle">Subscription</div>
          </div>
        </Link>

      </div>

      {/* ── MIDDLE SECTION ── */}
      <div className="home_sideNavbarMiddle">

        {/* You — not a link, just a label */}
        <div className="home_sideNavbarTopOption">
          <div className="home_sideNavbarTopOptionTitle">You</div>
          <ChevronRightIcon />
        </div>

        {/* Your Channel → goes to logged-in user's profile */}
        <Link to="/user/jyoti" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/user/jyoti") ? activeStyle : {}}>
            <RecentActorsIcon />
            <div className="home_sideNavbarTopOptionTitle">Your Channel</div>
          </div>
        </Link>

        {/* History */}
        <Link to="/history" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/history") ? activeStyle : {}}>
            <HistoryIcon />
            <div className="home_sideNavbarTopOptionTitle">History</div>
          </div>
        </Link>

        {/* Playlist */}
        <Link to="/playlist" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/playlist") ? activeStyle : {}}>
            <PlaylistAddIcon />
            <div className="home_sideNavbarTopOptionTitle">Playlist</div>
          </div>
        </Link>

        {/* Your Videos */}
        <Link to="/your-videos" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/your-videos") ? activeStyle : {}}>
            <SmartDisplayIcon />
            <div className="home_sideNavbarTopOptionTitle">Your videos</div>
          </div>
        </Link>

        {/* Watch Later */}
        <Link to="/watch-later" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/watch-later") ? activeStyle : {}}>
            <WatchLaterIcon />
            <div className="home_sideNavbarTopOptionTitle">Watch later</div>
          </div>
        </Link>

        {/* Liked Videos */}
        <Link to="/liked-videos" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/liked-videos") ? activeStyle : {}}>
            <ThumbUpIcon />
            <div className="home_sideNavbarTopOptionTitle">Liked videos</div>
          </div>
        </Link>

        {/* Your Clips */}
        <Link to="/your-clips" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/your-clips") ? activeStyle : {}}>
            <ContentCutIcon />
            <div className="home_sideNavbarTopOptionTitle">Your clips</div>
          </div>
        </Link>

      </div>

      {/* ── SUBSCRIPTIONS SECTION ── */}
      <div className="home_sideNavbarMiddle">

        <div className="home_sideNavbarTopOption">
          <div className="home_sideNavbarTopOptionTitleHeader">Subscription</div>
        </div>

        {/* Aaj Tak → goes to its channel profile */}
        <Link to="/user/aajtak" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/user/aajtak") ? activeStyle : {}}>
            <img
              className="home_sideNavbar_ImgLogo"
              src="https://tse4.mm.bing.net/th/id/OIP.Auy5e_yPpkpidVF_ZRz7aQAAAA?w=404&h=316&rs=1&pid=ImgDetMain&o=7&rm=3"
              alt="Aaj Tak"
            />
            <div className="home_sideNavbarTopOptionTitle">Aaj Tak</div>
          </div>
        </Link>

        {/* The LallanTop */}
        <Link to="/user/lallantop" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/user/lallantop") ? activeStyle : {}}>
            <img
              className="home_sideNavbar_ImgLogo"
              src="https://tse1.mm.bing.net/th/id/OIP.At5eXfjQ0jLiO7tRFBjI_QAAAA?rs=1&pid=ImgDetMain&o=7&rm=3"
              alt="The LallanTop"
            />
            <div className="home_sideNavbarTopOptionTitle">The LallanTop</div>
          </div>
        </Link>

        {/* NDTV India */}
        <Link to="/user/ndtvindia" className="home_sideNavbar_link">
          <div className="home_sideNavbarTopOption" style={isActive("/user/ndtvindia") ? activeStyle : {}}>
            <img
              className="home_sideNavbar_ImgLogo"
              src="https://logodix.com/logo/2131933.jpg"
              alt="NDTV India"
            />
            <div className="home_sideNavbarTopOptionTitle">NDTV India</div>
          </div>
        </Link>

      </div>
    </div>
  );
};

export default SideNavbar;