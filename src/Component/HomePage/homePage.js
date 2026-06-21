import React, { useState, useEffect, useRef } from "react";
import "./homePage.css";
import { reelsData } from "../Reels/reels";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";

const API_KEYS = [
  process.env.REACT_APP_YOUTUBE_KEY_1,
  process.env.REACT_APP_YOUTUBE_KEY_2,
  process.env.REACT_APP_YOUTUBE_KEY_3,
  process.env.REACT_APP_YOUTUBE_KEY_4,
  process.env.REACT_APP_YOUTUBE_KEY_5,
  process.env.REACT_APP_YOUTUBE_KEY_6,
];
let currentKeyIndex = 0;

const videos = [
  {
    id: 7679,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s",
    title: "Big Buck Bunny open-source film",
    duration: "09:56",
    channel: "Gangeshwary",
    tags: ["Film Criticisms", "Live"],
  },
  {
    id: 2,
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    title: "Sample Video 2",
    duration: "30:00",
    channel: "Mummy",
    tags: ["Music"],
  },
  {
    id: 3,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s",
    title: "3d Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    tags: ["AI"],
  },
  {
    id: 4,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s",
    title: "Sample Video 4",
    duration: "10:00",
    channel: "Karthik",
    tags: ["News"],
  },
  {
    id: 5,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s",
    title: "8k Wallpaper 3d Photos",
    duration: "18:00",
    channel: "Annu",
    tags: ["Astronomy"],
  },
  {
    id: 6,
    thumbnail:
      "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg",
    title: "3D Animation Solutions",
    duration: "08:00",
    channel: "Jyoti",
    tags: ["AI", "Web Development"],
  },
  {
    id: 7,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s",
    title: "3D Shapes | Types & Examples",
    duration: "28:00",
    channel: "Sarita",
    tags: ["Web Development"],
  },
  {
    id: 8,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s",
    title: "3d Graphics Pictures",
    duration: "20:00",
    channel: "Jaynarayan",
    tags: ["AI"],
  },
  {
    id: 9,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s",
    title: "Scenery 3d wallpaper",
    duration: "10:00",
    channel: "Shyamnarayan",
    tags: ["Astronomy"],
  },
  {
    id: 10,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s",
    title: "3D Nature Images",
    duration: "12:00",
    channel: "Rajbhar",
    tags: ["History"],
  },
  {
    id: 11,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s",
    title: "5,364,800+ 3d Images",
    duration: "13:30",
    channel: "Narayan",
    tags: ["AI"],
  },
  {
    id: 12,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s",
    title: "Understanding 3D Computer Graphics",
    duration: "20:50",
    channel: "Laxminarayan",
    tags: ["Web Development", "AI"],
  },
  { id: 13, thumbnail: "https://picsum.photos/seed/lion1/320/180", title: "3D Lion Stock Photo", duration: "60:00", channel: "Papa", tags: ["Film Criticisms"] },
  { id: 14, thumbnail: "https://picsum.photos/seed/tiger2/320/180", title: "Tiger in Wild", duration: "45:00", channel: "NatureTV", tags: ["History"] },
  { id: 15, thumbnail: "https://picsum.photos/seed/forest3/320/180", title: "Forest Walk", duration: "30:00", channel: "EcoWorld", tags: ["Live"] },
  { id: 16, thumbnail: "https://picsum.photos/seed/ocean4/320/180", title: "Ocean Waves", duration: "15:00", channel: "SeaLife", tags: ["Live"] },
  { id: 17, thumbnail: "https://picsum.photos/seed/mountain5/320/180", title: "Mountain Trek", duration: "20:00", channel: "Adventures", tags: ["Live"] },
  { id: 18, thumbnail: "https://picsum.photos/seed/city6/320/180", title: "City Lights", duration: "10:00", channel: "UrbanVibe", tags: ["News"] },
  { id: 19, thumbnail: "https://picsum.photos/seed/sunset7/320/180", title: "Sunset Timelapse", duration: "05:00", channel: "SkyWatch", tags: ["Astronomy"] },
  { id: 20, thumbnail: "https://picsum.photos/seed/beach8/320/180", title: "Beach Day", duration: "12:00", channel: "SummerFun", tags: ["Live"] },
  { id: 21, thumbnail: "https://picsum.photos/seed/rain9/320/180", title: "Rainy Day", duration: "08:00", channel: "Chill", tags: ["Music"] },
  { id: 22, thumbnail: "https://picsum.photos/seed/snow10/320/180", title: "Snowfall", duration: "25:00", channel: "WinterMood", tags: ["Live"] },
  { id: 23, thumbnail: "https://picsum.photos/seed/car11/320/180", title: "Sports Car Review", duration: "18:00", channel: "AutoDrive", tags: ["News"] },
  { id: 24, thumbnail: "https://picsum.photos/seed/food12/320/180", title: "Pasta Recipe", duration: "22:00", channel: "ChefLife", tags: ["Mixes"] },
  { id: 25, thumbnail: "https://picsum.photos/seed/tech13/320/180", title: "Latest Gadgets", duration: "35:00", channel: "TechZone", tags: ["AI", "Web Development"] },
  { id: 26, thumbnail: "https://picsum.photos/seed/space14/320/180", title: "Space Exploration", duration: "40:00", channel: "NASAFan", tags: ["Astronomy"] },
  { id: 27, thumbnail: "https://picsum.photos/seed/dog15/320/180", title: "Cute Dogs Compilation", duration: "14:00", channel: "PetPals", tags: ["Comedy"] },
  { id: 28, thumbnail: "https://picsum.photos/seed/cat16/320/180", title: "Funny Cats", duration: "11:00", channel: "MeowTime", tags: ["Comedy"] },
  { id: 29, thumbnail: "https://picsum.photos/seed/workout17/320/180", title: "Morning Workout", duration: "28:00", channel: "FitLife", tags: ["Live"] },
  { id: 30, thumbnail: "https://picsum.photos/seed/yoga18/320/180", title: "Yoga for Beginners", duration: "45:00", channel: "ZenMode", tags: ["Live"] },
  { id: 31, thumbnail: "https://picsum.photos/seed/music19/320/180", title: "Lo-Fi Music Mix", duration: "60:00", channel: "LoFiBeats", tags: ["Music", "Mixes"] },
  { id: 32, thumbnail: "https://picsum.photos/seed/travel20/320/180", title: "Travel Vlog: Japan", duration: "55:00", channel: "GlobeTrotter", tags: ["Live"] },
  { id: 33, thumbnail: "https://picsum.photos/seed/art21/320/180", title: "Painting Tutorial", duration: "50:00", channel: "ArtStudio", tags: ["Mixes"] },
  { id: 34, thumbnail: "https://picsum.photos/seed/code22/320/180", title: "Learn JavaScript", duration: "90:00", channel: "DevHQ", tags: ["Web Development"] },
  { id: 35, thumbnail: "https://picsum.photos/seed/bird23/320/180", title: "Birds of Paradise", duration: "16:00", channel: "WildBirds", tags: ["History"] },
  { id: 36, thumbnail: "https://picsum.photos/seed/river24/320/180", title: "River Kayaking", duration: "32:00", channel: "OutdoorX", tags: ["Live"] },
  { id: 37, thumbnail: "https://picsum.photos/seed/night25/320/180", title: "Night Sky Photography", duration: "38:00", channel: "StarGazer", tags: ["Astronomy"] },
  { id: 38, thumbnail: "https://picsum.photos/seed/coffee26/320/180", title: "Coffee Art Tips", duration: "09:00", channel: "BrewMaster", tags: ["Mixes"] },
  { id: 39, thumbnail: "https://picsum.photos/seed/book27/320/180", title: "Book Review", duration: "20:00", channel: "ReadMore", tags: ["History"] },
  { id: 40, thumbnail: "https://picsum.photos/seed/game28/320/180", title: "Gaming Highlights", duration: "42:00", channel: "ProGamer", tags: ["Gaming"] },
  { id: 41, thumbnail: "https://picsum.photos/seed/drone29/320/180", title: "Drone Footage", duration: "17:00", channel: "SkyView", tags: ["Astronomy"] },
  { id: 42, thumbnail: "https://picsum.photos/seed/history30/320/180", title: "Ancient Civilizations", duration: "65:00", channel: "HistoryBuff", tags: ["History"] },
  { id: 43, thumbnail: "https://picsum.photos/seed/garden31/320/180", title: "Garden Tips", duration: "23:00", channel: "GreenThumb", tags: ["Live"] },
  { id: 44, thumbnail: "https://picsum.photos/seed/fish32/320/180", title: "Deep Sea Creatures", duration: "44:00", channel: "OceanDepth", tags: ["History"] },
  { id: 45, thumbnail: "https://picsum.photos/seed/bike33/320/180", title: "Mountain Biking", duration: "31:00", channel: "BikePro", tags: ["Live"] },
  { id: 46, thumbnail: "https://picsum.photos/seed/sky34/320/180", title: "Cloud Formations", duration: "07:00", channel: "WeatherNerd", tags: ["Astronomy"] },
  { id: 47, thumbnail: "https://picsum.photos/seed/market35/320/180", title: "Street Market Tour", duration: "27:00", channel: "FoodieWalks", tags: ["DD News"] },
  { id: 48, thumbnail: "https://picsum.photos/seed/dance36/320/180", title: "Dance Choreography", duration: "13:00", channel: "DanceFloor", tags: ["Indian Music", "Music"] },
  { id: 49, thumbnail: "https://picsum.photos/seed/photo37/320/180", title: "Photography Masterclass", duration: "75:00", channel: "LensCraft", tags: ["Mixes"] },
  { id: 50, thumbnail: "https://picsum.photos/seed/desk38/320/180", title: "Desk Setup Tour", duration: "19:00", channel: "SetupGoals", tags: ["Web Development"] },
  { id: 51, thumbnail: "https://picsum.photos/seed/swim39/320/180", title: "Swimming Tips", duration: "36:00", channel: "AquaLife", tags: ["Live"] },
  { id: 52, thumbnail: "https://picsum.photos/seed/volcano40/320/180", title: "Volcanic Eruption", duration: "48:00", channel: "GeoWatch", tags: ["Astronomy", "News"] },
  { id: 53, thumbnail: "https://picsum.photos/seed/farm41/320/180", title: "Farm Life Vlog", duration: "53:00", channel: "RuralDays", tags: ["DD News"] },
  { id: 54, thumbnail: "https://picsum.photos/seed/robot42/320/180", title: "AI & Robotics", duration: "58:00", channel: "FutureTech", tags: ["AI"] },
  { id: 55, thumbnail: "https://picsum.photos/seed/horse43/320/180", title: "Horse Riding Basics", duration: "41:00", channel: "EquineLife", tags: ["Live"] },
  { id: 56, thumbnail: "https://picsum.photos/seed/dessert44/320/180", title: "Chocolate Cake Recipe", duration: "26:00", channel: "SweetBakes", tags: ["Mixes"] },
  { id: 57, thumbnail: "https://picsum.photos/seed/waterfall45/320/180", title: "Waterfall Hike", duration: "33:00", channel: "NatureWalks", tags: ["Live"] },
  { id: 58, thumbnail: "https://picsum.photos/seed/candle46/320/180", title: "DIY Candle Making", duration: "21:00", channel: "CraftCorner", tags: ["Mixes"] },
  { id: 59, thumbnail: "https://picsum.photos/seed/castle47/320/180", title: "Castle Exploration", duration: "67:00", channel: "HistoricPlaces", tags: ["History"] },
  { id: 60, thumbnail: "https://picsum.photos/seed/surf48/320/180", title: "Surfing Lessons", duration: "29:00", channel: "WaveRider", tags: ["Live"] },
  { id: 61, thumbnail: "https://picsum.photos/seed/jungle49/320/180", title: "Jungle Safari", duration: "72:00", channel: "WildExplorer", tags: ["History"] },
  { id: 62, thumbnail: "https://picsum.photos/seed/aurora50/320/180", title: "Northern Lights", duration: "15:00", channel: "ArcticVision", tags: ["Astronomy"] },
];

const MOCK_COMMENTS = [
  { id: 1, user: "Ravi Kumar", avatar: "RK", text: "This is absolutely amazing content! Keep it up 🔥", likes: 142, time: "2 days ago" },
  { id: 2, user: "Priya Sharma", avatar: "PS", text: "Really informative, learned so much from this video.", likes: 87, time: "1 day ago" },
  { id: 3, user: "Arjun Mehta", avatar: "AM", text: "The editing on this is top notch. Subscribed!", likes: 56, time: "5 hours ago" },
  { id: 4, user: "Sneha Patel", avatar: "SP", text: "Been waiting for a video like this!", likes: 34, time: "3 hours ago" },
  { id: 5, user: "Dev_Codes", avatar: "DC", text: "Bookmarked this. Will rewatch multiple times 📌", likes: 29, time: "1 hour ago" },
  { id: 6, user: "NatureLover99", avatar: "NL", text: "The visuals are stunning. What camera do you use?", likes: 18, time: "45 mins ago" },
  { id: 7, user: "TechWithVik", avatar: "TV", text: "Explained in the simplest way possible. Respect 🙏", likes: 11, time: "20 mins ago" },
];

const avatarColors = ["#7c3aed","#f43f5e","#f97316","#06b6d4","#10b981","#eab308","#a855f7","#3b82f6","#ec4899","#14b8a6"];
const getColor = (str) => avatarColors[(str || "A").charCodeAt(0) % avatarColors.length];

const formatViews = (n) => {
  if (!n || n === 0) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
  return n + " views";
};

// ✅ NEW: relative "time ago" formatter for video/reel upload timestamps
const formatTimeAgo = (dateString) => {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return diffMin + (diffMin === 1 ? " minute ago" : " minutes ago");
  if (diffHour < 24) return diffHour + (diffHour === 1 ? " hour ago" : " hours ago");
  if (diffDay < 30) return diffDay + (diffDay === 1 ? " day ago" : " days ago");
  if (diffMonth < 12) return diffMonth + (diffMonth === 1 ? " month ago" : " months ago");
  return diffYear + (diffYear === 1 ? " year ago" : " years ago");
};

const isWatched = (contentType, contentId, watchedContentIds) => {
  const localKey = `viewed_${contentType}_${contentId}`;
  if (localStorage.getItem(localKey) === "true") return true;
  return watchedContentIds.has(`${contentType}_${String(contentId)}`);
};

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

// ─── MOBILE TAB DEFINITIONS ─────────────────────────────────
const MOBILE_TABS = [
  { id: "shorts", label: "Shorts", icon: "📱" },
  { id: "videos", label: "Videos", icon: "🎬" },
  { id: "movies", label: "Movies", icon: "🎥" },
  { id: "live",   label: "Live",   icon: "🔴" },
];

// ─── SWIPE HOOK ──────────────────────────────────────────────
const useSwipeTabs = (onSwipeLeft, onSwipeRight, threshold = 50, verticalLimit = 80) => {
  const touchStart = useRef(null);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = Math.abs(t.clientY - touchStart.current.y);
    touchStart.current = null;
    if (dy > verticalLimit) return;
    if (dx < -threshold) onSwipeLeft();
    if (dx >  threshold) onSwipeRight();
  };

  return { onTouchStart, onTouchEnd };
};

// ─── TRENDING STRIP ──────────────────────────────────────────
const MobileTrendingStrip = ({ dbVideos, dbReels = [], onVideoClick, onReelClick }) => {
  const trendingVideos = [
    ...dbVideos.slice(0, 6).map(v => ({ ...v, _type: 'video' })),
    ...dbReels.slice(0, 5).map(r => ({ ...r, _type: 'reel', thumbnail: r.thumbnail, title: r.title, channel: r.user })),
    ...dbVideos.filter(v => v.tags?.some(t => ['Hindi Movies','Hollywood Movies','Bhojpuri Cinema','Superhero Movies','Pakistani Movies'].includes(t))).slice(0, 3).map(v => ({ ...v, _type: 'movie' })),
    ...dbVideos.filter(v => v.tags?.includes('Live')).slice(0, 2).map(v => ({ ...v, _type: 'live' })),
  ].slice(0, 16);

  if (trendingVideos.length === 0) return null;

  const TYPE_BADGE = {
    video: { label: '🎬', bg: '#7c3aed' },
    reel:  { label: '📱', bg: '#f97316' },
    movie: { label: '🎥', bg: '#f43f5e' },
    live:  { label: '🔴', bg: '#ef4444' },
  };

  return (
    <div className="mobile-trending-strip">
      <div className="mobile-trending-label">
        <span>Z</span>
        <span>Trending Now</span>
      </div>
      <div className="mobile-trending-track-wrapper">
        <div className="mobile-trending-track">
          {trendingVideos.map((v, i) => {
            const badge = TYPE_BADGE[v._type] || TYPE_BADGE.video;
            return (
              <div
                key={`trending_${v._type}_${v.id}_${i}`}
                className="mobile-trending-card"
                onClick={() => {
                  if (v._type === 'reel') onReelClick && onReelClick(v);
                  else onVideoClick && onVideoClick(v);
                }}
              >
                <span className="mobile-trending-rank">#{i + 1}</span>
                <span style={{ position:'absolute', top:5, right:5, background:badge.bg, color:'#fff', fontSize:'9px', fontWeight:'800', padding:'2px 5px', borderRadius:'4px', zIndex:4 }}>{badge.label}</span>
                <img src={v.thumbnail} alt={v.title} className="mobile-trending-card-thumb" />
                <div className="mobile-trending-card-info">
                  <div className="mobile-trending-card-title">{v.title}</div>
                  <div className="mobile-trending-card-channel">{v.channel || v.user}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SHORT CARD ──────────────────────────────────────────────
const ShortCard = ({ short, incrementView, viewCounts, handleDeleteReel, navigate, watchedContentIds }) => {
  const cardRef = useRef(null);
  const firedRef = useRef(false);

  // ✅ FIX: Check age (7 days) + watched status + sessionStorage fresh list
  const [showNew, setShowNew] = useState(() => {
    if (!short.dbId) return false;
    if (isWatched("reel", short.dbId, watchedContentIds)) return false;
    if (short.created_at) {
      const age = Date.now() - new Date(short.created_at).getTime();
      return age <= 7 * 24 * 60 * 60 * 1000;
    }
    // Realtime-inserted reels may not have created_at yet — check sessionStorage fresh list
    const fresh = (() => { try { return JSON.parse(sessionStorage.getItem("zixplon_fresh_reels") || "[]"); } catch { return []; } })();
    return fresh.includes(String("db_" + short.dbId));
  });

  useEffect(() => {
    if (!short.dbId) return;
    firedRef.current = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6 && !firedRef.current) {
        firedRef.current = true;
        localStorage.setItem(`viewed_reel_${short.dbId}`, "true");
        localStorage.setItem(`lastViewed_reel_${short.dbId}`, String(Date.now()));
        setShowNew(false);
        incrementView(String(short.dbId), "reel");
      }
    }, { threshold: 0.6 });
    const el = cardRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [short.dbId, incrementView]);

  // ✅ FIX: Re-evaluate showNew when watchedContentIds changes, including age check
  useEffect(() => {
    if (!short.dbId) return;
    if (isWatched("reel", short.dbId, watchedContentIds)) { setShowNew(false); return; }
    if (short.created_at) {
      const age = Date.now() - new Date(short.created_at).getTime();
      setShowNew(age <= 7 * 24 * 60 * 60 * 1000);
    }
  }, [watchedContentIds, short.dbId]);

  const vcKey = short.id ? "reel_" + short.id : null;

  return (
    <div
      ref={cardRef}
      className="homePage_shortCard"
      style={{ cursor: "pointer", position: "relative" }}
      onClick={() => {
        if (short.dbId) {
          localStorage.setItem(`viewed_reel_${short.dbId}`, "true");
          localStorage.setItem(`lastViewed_reel_${short.dbId}`, String(Date.now()));
          setShowNew(false);
          incrementView(String(short.dbId), "reel");
        }
        navigate("/reels/" + short.id, { state: { clickedReel: short } });
      }}
    >
      <div className="homePage_shortThumbnail">
        <img src={short.thumbnail} alt={short.title || short.user} className="homePage_shortImg" />
        <div className="homePage_shortPlay">▶</div>
        <div className="homePage_shortDuration">{short.duration}</div>
        {showNew && (
          <div style={{ position:"absolute", top:"8px", left:"8px", background:"linear-gradient(135deg,#f43f5e,#f97316)", color:"white", fontSize:"10px", fontWeight:"800", padding:"2px 7px", borderRadius:"5px", zIndex:2 }}>New</div>
        )}
        {short.dbId && (
          <div style={{ position:"absolute", bottom:"4px", left:"4px", background:"rgba(30,27,75,0.82)", color:"white", fontSize:"10px", fontWeight:"700", padding:"2px 6px", borderRadius:"5px" }}>
            👁 {formatViews(vcKey ? (viewCounts[vcKey] ?? 0) : 0)}
          </div>
        )}
      </div>
      <div className="homePage_shortTitle">{short.title}</div>
      <Link to={"/user/" + short.username} onClick={(e) => e.stopPropagation()} style={{ textDecoration:"none", color:"#a855f7", fontSize:"13px" }}>
        <div className="homePage_shortUser">{short.user}</div>
      </Link>
    </div>
  );
};

// ─── ADD TO PLAYLIST MENU ──────────────────────────────────
const PlaylistMenuButton = ({ videoId, playlistsCache, setPlaylistsCache }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [memberIds, setMemberIds] = useState(new Set()); // playlist ids that already contain this video
  const menuRef = useRef(null);
  const username = localStorage.getItem("username") || "";

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
        setNewTitle("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const ensurePlaylistsLoaded = async () => {
    if (playlistsCache) return playlistsCache;
    const { data } = await supabase
      .from("playlists")
      .select("id, title")
      .eq("username", username)
      .order("created_at", { ascending: false });
    const list = data || [];
    setPlaylistsCache(list);
    return list;
  };

  const loadMembership = async (list) => {
    if (!list.length) { setMemberIds(new Set()); return; }
    const { data } = await supabase
      .from("playlist_items")
      .select("playlist_id")
      .eq("video_id", videoId)
      .in("playlist_id", list.map((p) => p.id));
    setMemberIds(new Set((data || []).map((r) => r.playlist_id)));
  };

  const toggleMenu = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!username) { alert("Please login to use playlists"); return; }
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    const list = await ensurePlaylistsLoaded();
    await loadMembership(list);
    setLoading(false);
  };

  const togglePlaylist = async (e, playlistId) => {
    e.preventDefault();
    e.stopPropagation();
    const inPlaylist = memberIds.has(playlistId);
    if (inPlaylist) {
      await supabase.from("playlist_items").delete().eq("playlist_id", playlistId).eq("video_id", videoId);
      setMemberIds((prev) => { const next = new Set(prev); next.delete(playlistId); return next; });
    } else {
      await supabase.from("playlist_items").insert({ playlist_id: playlistId, video_id: videoId });
      setMemberIds((prev) => new Set(prev).add(playlistId));
    }
  };

  const createAndAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTitle.trim()) return;
    const { data, error } = await supabase
      .from("playlists")
      .insert({ username, title: newTitle.trim() })
      .select()
      .single();
    if (!error && data) {
      const updatedList = [data, ...(playlistsCache || [])];
      setPlaylistsCache(updatedList);
      await supabase.from("playlist_items").insert({ playlist_id: data.id, video_id: videoId });
      setMemberIds((prev) => new Set(prev).add(data.id));
      setNewTitle("");
      setCreating(false);
    }
  };

  return (
    <div ref={menuRef} style={{ position: "absolute", top: "8px", right: "8px", zIndex: 11 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={toggleMenu}
        title="More options"
        style={{ background: "rgba(0,0,0,0.6)", border: "none", color: "white", borderRadius: "8px", padding: "5px", cursor: "pointer", display: "flex", alignItems: "center" }}
      >
        <MoreVertIcon style={{ fontSize: 17 }} />
      </button>

      {open && (
        <div style={{ position: "absolute", top: "32px", right: 0, width: "220px", background: "#ffffff", border: "1.5px solid #e0d4ff", borderRadius: "12px", boxShadow: "0 8px 24px rgba(76,69,137,0.18)", padding: "8px", maxHeight: "260px", overflowY: "auto" }}>
          <div style={{ color: "#4c4589", fontSize: "12px", fontWeight: "800", padding: "4px 8px 8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <PlaylistAddIcon style={{ fontSize: 15 }} /> Save to playlist
          </div>

          {loading && <div style={{ padding: "10px 8px", color: "#8b84c4", fontSize: "13px" }}>Loading…</div>}

          {!loading && (playlistsCache || []).length === 0 && !creating && (
            <div style={{ padding: "6px 8px 10px", color: "#8b84c4", fontSize: "13px" }}>No playlists yet.</div>
          )}

          {!loading && (playlistsCache || []).map((pl) => {
            const checked = memberIds.has(pl.id);
            return (
              <div
                key={pl.id}
                onClick={(e) => togglePlaylist(e, pl.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#1e1b4b", fontWeight: "600" }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = "#f7f0ff")}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.title}</span>
                {checked && <CheckIcon style={{ fontSize: 16, color: "#7c3aed", flexShrink: 0 }} />}
              </div>
            );
          })}

          <div style={{ borderTop: "1px solid #f0ebff", marginTop: "6px", paddingTop: "6px" }}>
            {!creating ? (
              <div
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCreating(true); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#7c3aed", fontWeight: "700" }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = "#f7f0ff")}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
              >
                <AddIcon style={{ fontSize: 16 }} /> New playlist
              </div>
            ) : (
              <div style={{ display: "flex", gap: "6px", padding: "4px" }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndAdd(e)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Playlist name"
                  style={{ flex: 1, minWidth: 0, border: "1.5px solid #e0d4ff", borderRadius: "8px", padding: "6px 8px", fontSize: "12px", outline: "none", fontFamily: "Outfit, sans-serif" }}
                />
                <button onClick={createAndAdd} style={{ background: "#7c3aed", border: "none", color: "white", borderRadius: "8px", padding: "0 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Add</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── WATCH PAGE ──────────────────────────────────────────────
const WatchPage = ({ initialVideoId, initialTitle, initialChannel, onClose, suggestions, onIncrementView }) => {
  const isMobile = useIsMobile();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const i = suggestions.findIndex((s) => s.id?.videoId === initialVideoId);
    return i >= 0 ? i : 0;
  });
  const [autoplay, setAutoplay] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount] = useState(() => Math.floor(Math.random() * 50000) + 1000);
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState("");
  const [likedComments, setLikedComments] = useState(new Set());
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());

  const item = suggestions[currentIndex] || null;
  const isYT = item && !!item.snippet;
  const videoId = isYT && item.id?.videoId ? item.id.videoId : initialVideoId;
  const videoTitle = isYT ? item.snippet.title : (item?.title ?? initialTitle);
  const channelName = isYT ? item.snippet.channelTitle : (item?.channel ?? initialChannel);
  const publishedAt = isYT ? item.snippet.publishedAt : null;
  const description = isYT ? item.snippet.description : null;

  const goTo = (idx) => {
    const clampedIdx = Math.max(0, Math.min(idx, suggestions.length - 1));
    const target = suggestions[clampedIdx];
    if (target && onIncrementView) {
      const isYTItem = !!target.snippet;
      if (!isYTItem && target.src && target.id) onIncrementView(String(target.id), "video");
    }
    setCurrentIndex(clampedIdx);
    setIsLiked(false);
    setIsDisliked(false);
    setShowFullDesc(false);
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < suggestions.length - 1;
  const goPrev = () => { if (hasPrev) goTo(currentIndex - 1); };
  const goNext = () => { if (hasNext) goTo(currentIndex + 1); };

  const autoplayRef = useRef(autoplay);
  useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);
  const hasNextRef = useRef(hasNext);
  useEffect(() => { hasNextRef.current = hasNext; }, [hasNext]);
  const goNextRef = useRef(goNext);
  useEffect(() => { goNextRef.current = goNext; });

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "infoDelivery" && data.info && data.info.playerState === 0) {
          if (autoplayRef.current && hasNextRef.current) goNextRef.current();
        }
      } catch (_) {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSubscribe = (ch) => {
    setSubscribedChannels((prev) => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [{ id: Date.now(), user: "You", avatar: "YO", text: newComment.trim(), likes: 0, time: "Just now" }, ...prev]);
    setNewComment("");
  };

  const toggleCommentLike = (id) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setComments((c) => c.map((x) => (x.id === id ? { ...x, likes: x.likes - 1 } : x)));
      } else {
        next.add(id);
        setComments((c) => c.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)));
      }
      return next;
    });
  };

  const WP = { bg:"#f0f4ff", surface:"#ffffff", surface2:"#f7f0ff", border:"#e0d4ff", primary:"#7c3aed", primary2:"#a855f7", text:"#1e1b4b", text2:"#4c4589", text3:"#8b84c4", accent:"#f43f5e" };

  const Player = () => (
    <div style={{ width:"100%", position:"relative", paddingBottom:"56.25%", height:0, overflow:"hidden", background:"#1e1b4b", borderRadius:isMobile?"0":"16px", flexShrink:0 }}>
      <iframe key={videoId} src={"https://www.youtube.com/embed/"+videoId+"?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"} title={videoTitle} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none", display:"block" }} />
    </div>
  );

  const AutoplayToggle = () => (
    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
      <span style={{ color:WP.text3, fontSize:"13px" }}>Autoplay</span>
      <div onClick={() => setAutoplay((a) => !a)} style={{ width:"44px", height:"24px", background:autoplay?WP.primary:"#d1d5db", borderRadius:"12px", cursor:"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
        <div style={{ width:"18px", height:"18px", background:"white", borderRadius:"50%", position:"absolute", top:"3px", left:autoplay?"23px":"3px", transition:"left 0.3s", boxShadow:"0 1px 4px rgba(0,0,0,0.25)" }} />
      </div>
      <span style={{ color:autoplay?WP.primary:"#9ca3af", fontSize:"12px", fontWeight:"700" }}>{autoplay?"ON":"OFF"}</span>
    </div>
  );

  const NavBar = () => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:WP.surface2, borderRadius:"12px", padding:"10px 16px", marginTop:"10px", gap:"8px", border:"1px solid "+WP.border }}>
      <button onClick={goPrev} disabled={!hasPrev} style={{ background:hasPrev?WP.surface:"#f3f4f6", border:"1.5px solid "+(hasPrev?WP.border:"#e5e7eb"), color:hasPrev?WP.text:"#9ca3af", borderRadius:"20px", padding:"8px 18px", cursor:hasPrev?"pointer":"not-allowed", fontSize:"14px", fontWeight:"700", whiteSpace:"nowrap" }}>⏮ Previous</button>
      <AutoplayToggle />
      <button onClick={goNext} disabled={!hasNext} style={{ background:hasNext?WP.primary:"#f3f4f6", border:"none", color:hasNext?"white":"#9ca3af", borderRadius:"20px", padding:"8px 18px", cursor:hasNext?"pointer":"not-allowed", fontSize:"14px", fontWeight:"700", whiteSpace:"nowrap" }}>Next ⏭</button>
    </div>
  );

  const MetaSection = () => (
    <div style={{ padding:isMobile?"0 12px":"0" }}>
      <div style={{ color:WP.text, fontWeight:"700", fontSize:isMobile?"15px":"18px", lineHeight:"1.4", marginTop:"14px" }}>{videoTitle}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", marginTop:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <img src={"https://ui-avatars.com/api/?name="+encodeURIComponent(channelName)+"&background=random&size=40"} alt={channelName} style={{ width:"40px", height:"40px", borderRadius:"50%", flexShrink:0 }} />
          <div>
            <div style={{ color:WP.text, fontWeight:"700", fontSize:"15px" }}>{channelName}</div>
            <div style={{ color:WP.text3, fontSize:"12px" }}>1.2M subscribers</div>
          </div>
          <button onClick={() => handleSubscribe(channelName)} style={{ background:subscribedChannels.has(channelName)?WP.surface2:WP.primary, color:subscribedChannels.has(channelName)?WP.primary:"white", border:"1.5px solid "+WP.primary, borderRadius:"20px", padding:"8px 18px", fontWeight:"700", cursor:"pointer", fontSize:"14px", marginLeft:"4px", whiteSpace:"nowrap" }}>
            {subscribedChannels.has(channelName)?"✓ Subscribed":"Subscribe"}
          </button>
        </div>
      </div>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"12px" }}>
        <div style={{ display:"flex", background:WP.surface2, borderRadius:"20px", overflow:"hidden", border:"1.5px solid "+WP.border }}>
          <button onClick={() => { setIsLiked((l)=>!l); if(isDisliked) setIsDisliked(false); }} style={{ background:isLiked?"#ede9fe":"transparent", border:"none", color:isLiked?WP.primary:WP.text2, padding:"8px 16px", cursor:"pointer", fontSize:"14px", borderRight:"1px solid "+WP.border, fontWeight:"600" }}>👍 {(likeCount+(isLiked?1:0)).toLocaleString()}</button>
          <button onClick={() => { setIsDisliked((d)=>!d); if(isLiked) setIsLiked(false); }} style={{ background:isDisliked?"#fff1f2":"transparent", border:"none", color:isDisliked?WP.accent:WP.text2, padding:"8px 16px", cursor:"pointer", fontSize:"14px", fontWeight:"600" }}>👎</button>
        </div>
        <button onClick={() => { navigator.clipboard.writeText("https://www.youtube.com/watch?v="+videoId); alert("Link copied!"); }} style={{ background:WP.surface2, border:"1.5px solid "+WP.border, color:WP.text2, borderRadius:"20px", padding:"8px 16px", cursor:"pointer", fontSize:"14px", fontWeight:"600" }}>🔗 Share</button>
        <button onClick={onClose} style={{ background:WP.surface2, border:"1.5px solid "+WP.border, color:WP.text3, borderRadius:"20px", padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>✕ Close</button>
      </div>
      {description !== null && (
        <div onClick={() => setShowFullDesc((s)=>!s)} style={{ background:WP.surface2, borderRadius:"12px", padding:"14px 16px", marginTop:"14px", color:WP.text2, fontSize:"14px", lineHeight:"1.6", cursor:"pointer", border:"1px solid "+WP.border }}>
          {publishedAt && <div style={{ color:WP.text3, fontSize:"13px", marginBottom:"6px" }}>{new Date(publishedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div>}
          <p style={{ margin:0, display:showFullDesc?"block":"-webkit-box", WebkitLineClamp:showFullDesc?"unset":2, WebkitBoxOrient:"vertical", overflow:showFullDesc?"visible":"hidden" }}>{description||"No description available."}</p>
          <span style={{ color:WP.primary, fontWeight:"700", fontSize:"13px", marginTop:"6px", display:"block" }}>{showFullDesc?"Show less":"...more"}</span>
        </div>
      )}
    </div>
  );

  const CommentSection = () => (
    <div style={{ padding:isMobile?"0 12px 40px":"0 0 40px" }}>
      <div style={{ color:WP.text, fontWeight:"700", fontSize:"16px", margin:"28px 0 20px" }}>{comments.length} Comments</div>
      <div style={{ display:"flex", gap:"12px", marginBottom:"24px" }}>
        <div style={{ width:"36px", height:"36px", borderRadius:"50%", flexShrink:0, background:WP.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:"800", fontSize:"12px" }}>YO</div>
        <div style={{ flex:1 }}>
          <input value={newComment} onChange={(e)=>setNewComment(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addComment()} placeholder="Add a comment..." style={{ width:"100%", background:"transparent", border:"none", borderBottom:"2px solid "+WP.border, color:WP.text, fontSize:"14px", padding:"8px 0", outline:"none", boxSizing:"border-box", fontFamily:"Outfit, sans-serif" }} onFocus={(e)=>(e.target.style.borderBottomColor=WP.primary)} onBlur={(e)=>(e.target.style.borderBottomColor=WP.border)} />
          {newComment.trim()&&(<div style={{ display:"flex", justifyContent:"flex-end", gap:"8px", marginTop:"8px" }}>
            <button onClick={()=>setNewComment("")} style={{ background:"none", border:"none", color:WP.text3, cursor:"pointer", fontSize:"14px", fontWeight:"600" }}>Cancel</button>
            <button onClick={addComment} style={{ background:WP.primary, border:"none", color:"white", borderRadius:"20px", padding:"6px 16px", cursor:"pointer", fontWeight:"700", fontSize:"14px" }}>Comment</button>
          </div>)}
        </div>
      </div>
      {comments.map((c) => (
        <div key={c.id} style={{ display:"flex", gap:"12px", marginBottom:"20px" }}>
          <div style={{ width:"36px", height:"36px", borderRadius:"50%", flexShrink:0, background:getColor(c.avatar), display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:"800", fontSize:"11px" }}>{c.avatar}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"4px" }}>
              <span style={{ color:WP.text, fontWeight:"700", fontSize:"13px" }}>{c.user}</span>
              <span style={{ color:WP.text3, fontSize:"12px" }}>{c.time}</span>
            </div>
            <p style={{ color:WP.text2, fontSize:"14px", margin:"0 0 6px", lineHeight:"1.5" }}>{c.text}</p>
            <div style={{ display:"flex", gap:"12px" }}>
              <button onClick={()=>toggleCommentLike(c.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:likedComments.has(c.id)?WP.primary:WP.text3, fontSize:"13px", fontWeight:"600" }}>👍 {c.likes}</button>
              <span style={{ color:WP.text3, fontSize:"13px", cursor:"pointer" }}>👎</span>
              <span style={{ color:WP.text3, fontSize:"13px", cursor:"pointer", fontWeight:"600" }}>Reply</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const RelatedSidebar = () => {
    const relatedList = suggestions.filter((_, i) => i !== currentIndex);
    return (
      <div style={{ width:isMobile?"100%":"402px", flexShrink:0, overflowY:isMobile?"visible":"auto", scrollbarWidth:"thin", scrollbarColor:WP.border+" transparent", background:WP.surface, borderLeft:isMobile?"none":"2px solid "+WP.border, padding:"12px 10px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
          <span style={{ color:WP.text, fontWeight:"800", fontSize:"14px" }}>Up Next</span>
          <AutoplayToggle />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {relatedList.map((s) => {
            const realIdx = suggestions.indexOf(s);
            const isYTItem = !!s.snippet;
            const thumb = isYTItem ? s.snippet.thumbnails.medium.url : s.thumbnail;
            const title = isYTItem ? s.snippet.title : s.title;
            const channel = isYTItem ? s.snippet.channelTitle : s.channel;
            const hasVid = (isYTItem && !!s.id?.videoId) || (!isYTItem && !!s.src);
            return (
              <div key={s.id?.videoId||s.id||realIdx} onClick={()=>hasVid&&goTo(realIdx)} style={{ display:"flex", gap:"8px", cursor:hasVid?"pointer":"default", borderRadius:"10px", padding:"6px", transition:"background 0.2s", opacity:hasVid?1:0.5, border:"1px solid transparent" }} onMouseEnter={(e)=>{ if(hasVid){ e.currentTarget.style.background=WP.surface2; e.currentTarget.style.borderColor=WP.border; }}} onMouseLeave={(e)=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; }}>
                <div style={{ position:"relative", flexShrink:0, width:"168px", height:"94px", borderRadius:"10px", overflow:"hidden", background:"#e8e0ff" }}>
                  <img src={thumb} alt={title} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                  {isYTItem && <div style={{ position:"absolute", top:"4px", left:"4px", background:"#ef4444", color:"#fff", fontSize:"9px", fontWeight:"800", padding:"2px 6px", borderRadius:"4px" }}>▶ YT</div>}
                </div>
                <div style={{ flex:1, minWidth:0, paddingTop:"2px" }}>
                  <div style={{ color:WP.text, fontSize:"13px", fontWeight:"600", lineHeight:"1.4", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", marginBottom:"4px" }}>{title}</div>
                  <div style={{ color:WP.text3, fontSize:"12px", marginBottom:"2px", fontWeight:"600" }}>{channel}</div>
                  {isYTItem&&s.snippet?.publishedAt&&(<div style={{ color:WP.text3, fontSize:"12px" }}>{new Date(s.snippet.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <>
        <style>{".hp-watch-root{position:fixed;top:55px;left:0;right:0;bottom:0;z-index:999;background:#f0f4ff;display:flex;flex-direction:column;font-family:'Outfit',sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch;}.hp-watch-root *{-webkit-transform:none !important;}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>
        <div className="hp-watch-root">
          <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", background:"#ffffff", borderBottom:"2px solid #e0d4ff", flexShrink:0 }}>
            <button onClick={onClose} style={{ background:"#f7f0ff", border:"1.5px solid #e0d4ff", color:"#7c3aed", fontSize:"13px", cursor:"pointer", padding:"6px 12px", borderRadius:"20px", fontWeight:"700" }}>← Back</button>
            <span style={{ color:"#1e1b4b", fontWeight:"700", fontSize:"13px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{videoTitle}</span>
            <span style={{ background:"#ef4444", color:"#fff", fontSize:"10px", fontWeight:"800", padding:"2px 8px", borderRadius:"5px" }}>▶ YT</span>
          </div>
          <Player />
          <div style={{ padding:"0 12px" }}><NavBar /></div>
          <MetaSection />
          <CommentSection />
          <div style={{ borderTop:"8px solid #f0f4ff", marginTop:"8px" }}><RelatedSidebar /></div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#e0d4ff;border-radius:4px;}"}</style>
      <div style={{ position:"fixed", top:"55px", left:"0", right:"0", bottom:"0", zIndex:999, background:"#f0f4ff", display:"flex", flexDirection:"column", fontFamily:"'Outfit', sans-serif", overflow:"hidden" }}>
        <div style={{ height:"52px", flexShrink:0, background:"#ffffff", borderBottom:"2px solid #e0d4ff", display:"flex", alignItems:"center", padding:"0 16px", gap:"10px", boxShadow:"0 2px 12px rgba(124,58,237,0.06)" }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#8b84c4", cursor:"pointer", fontSize:"22px", lineHeight:1, padding:"4px 10px", borderRadius:"8px", transition:"all 0.2s" }} onMouseEnter={(e)=>{ e.currentTarget.style.background="#f7f0ff"; e.currentTarget.style.color="#7c3aed"; }} onMouseLeave={(e)=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="#8b84c4"; }}>←</button>
          <div style={{ width:"1px", height:"20px", background:"#e0d4ff" }} />
          <span style={{ color:"#1e1b4b", fontWeight:"700", fontSize:"14px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{videoTitle}</span>
          <span style={{ background:"#ef4444", color:"#fff", fontSize:"11px", fontWeight:"800", padding:"3px 10px", borderRadius:"5px", flexShrink:0 }}>▶ YouTube</span>
        </div>
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", minWidth:0, scrollbarWidth:"thin", scrollbarColor:"#e0d4ff transparent" }}>
            <Player />
            <NavBar />
            <MetaSection />
            <CommentSection />
          </div>
          <div style={{ width:"402px", flexShrink:0, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:"#e0d4ff transparent" }}>
            <RelatedSidebar />
          </div>
        </div>
      </div>
    </>
  );
};

// ─── HOME PAGE ───────────────────────────────────────────────
const HomePage = ({ sideNavbar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [selectedOption, setSelectedOption] = useState("All");
  const [mobileTab, setMobileTab] = useState("shorts");

  // ── Swipe to change tabs ──────────────────────────────────
  const TAB_IDS = MOBILE_TABS.map((t) => t.id);
  const goNextTab = () => {
    setMobileTab((cur) => {
      const idx = TAB_IDS.indexOf(cur);
      return idx < TAB_IDS.length - 1 ? TAB_IDS[idx + 1] : cur;
    });
  };
  const goPrevTab = () => {
    setMobileTab((cur) => {
      const idx = TAB_IDS.indexOf(cur);
      return idx > 0 ? TAB_IDS[idx - 1] : cur;
    });
  };
  const swipeHandlers = useSwipeTabs(goNextTab, goPrevTab);

  const searchQuery = (() => {
    const params = new URLSearchParams(location.search);
    return (params.get("q") || "").trim().toLowerCase();
  })();

  const optionsTrackRef = useRef(null);
  const autoScrollRef = useRef(null);
  const isPausedRef = useRef(false);
  const [ytVideos, setYtVideos] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [watchVideo, setWatchVideo] = useState(null);
  const [dbVideos, setDbVideos] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbReels, setDbReels] = useState([]);
  const [viewCounts, setViewCounts] = useState({});
  const [watchedContentIds, setWatchedContentIds] = useState(new Set());
  // ── Watch Later: tracks video IDs (as strings) the current user has saved ──
  const [watchLaterIds, setWatchLaterIds] = useState(new Set());
  // ── Add to Playlist: shared cache of this user's playlists, loaded lazily on first menu open ──
  const [playlistsCache, setPlaylistsCache] = useState(null);
  const loggedInUsername = localStorage.getItem("username") || "";

  // ✅ FIX: Wrapped in useCallback for stable reference across effects
  const loadWatchedIds = React.useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    const { data } = await supabase.from("views").select("content_id, content_type").eq("user_id", userId);
    if (data) {
      const ids = new Set(data.map((r) => `${r.content_type}_${r.content_id}`));
      setWatchedContentIds(ids);
    }
  }, []);

  // ── Load this user's Watch Later list so bookmark icons reflect saved state ──
  useEffect(() => {
    const loadWatchLater = async () => {
      const username = localStorage.getItem("username");
      if (!username) return;
      const { data } = await supabase.from("watch_later").select("video_id").eq("username", username);
      if (data) setWatchLaterIds(new Set(data.map((r) => String(r.video_id))));
    };
    loadWatchLater();
  }, []);

  // ✅ FIX: Added 30s interval poll + loadWatchedIds in dep array
  useEffect(() => {
    loadWatchedIds();
    const handleVisibility = () => { if (document.visibilityState === "visible") loadWatchedIds(); };
    const handleFocus = () => loadWatchedIds();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    // Poll every 30s for long sessions
    const interval = setInterval(loadWatchedIds, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [loadWatchedIds]);

  const incrementView = async (contentId, contentType) => {
    const storageKey = `lastViewed_${contentType}_${contentId}`;
    const lastViewed = localStorage.getItem(storageKey);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (lastViewed && now - parseInt(lastViewed, 10) < TWENTY_FOUR_HOURS) return;
    localStorage.setItem(storageKey, String(now));
    localStorage.setItem(`viewed_${contentType}_${contentId}`, "true");
    const key = `${contentType}_${contentId}`;
    setViewCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      await supabase.from("views").upsert({ user_id: userId, content_id: String(contentId), content_type: contentType, viewed_at: new Date().toISOString() }, { onConflict: "user_id,content_id,content_type" });
    } catch (_) {}
  };

  const fetchViewCounts = async (ids, contentType) => {
    if (!ids || !ids.length) return;
    try {
      const { data, error } = await supabase.from("views").select("content_id").eq("content_type", contentType).in("content_id", ids.map(String));
      const map = {};
      ids.forEach((id) => { map[contentType + "_" + id] = 0; });
      if (!error && data) { data.forEach((r) => { const k = contentType + "_" + r.content_id; map[k] = (map[k] || 0) + 1; }); }
      setViewCounts((prev) => ({ ...prev, ...map }));
    } catch (_) {}
  };

  const options = ["All","DD News","Kapil Sharma Show","Hindi Movies","Hindi News","English News","Film Criticisms","Twenty20 Cricket","Music","Live","Mixes","Gaming","Debates","Coke Studio India","Democracy","Pakistani Dramas","Pakistani Movies","Comedy","Podcasts","WWE","Superhero Movies","Dramedy","Web Development","Hollywood Movies","Dubbed Hollywood Movies","Web Series","Professional Wrestling","Bhojpuri Cinema","Bhojpuri Songs","Astronomy","AI","History","Geographical Videos","National Geography","Indian Music","Indian Movies","Recently Uploaded","Watched"];

  useEffect(() => {
    const fetchDbVideos = async () => {
      setDbLoading(true);
      const { data, error } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        // ✅ NEW: include created_at so we can show the upload date/time on each video card
        const formatted = data.map((v) => ({ id:v.id, src:v.video_url, thumbnail:v.thumbnail_url, title:v.title, duration:v.duration||"00:00", channel:v.channel, username:v.username||v.channel?.toLowerCase()||"unknown", tags:[v.category||"All"], likes:v.likes??0, created_at:v.created_at||null }));
        const videoIds = formatted.map((v) => String(v.id));
        const { data: likesData } = await supabase.from("likes").select("content_id").eq("content_type","video").in("content_id", videoIds);
        if (likesData) {
          const likesMap = {};
          likesData.forEach((row) => { likesMap[row.content_id] = (likesMap[row.content_id] || 0) + 1; });
          setDbVideos(formatted.map((v) => ({ ...v, likes: likesMap[String(v.id)] ?? v.likes ?? 0 })));
        } else { setDbVideos(formatted); }
        fetchViewCounts(formatted.map((v) => v.id), "video");
      }
      setDbLoading(false);
    };
    fetchDbVideos();

    const subscription = supabase.channel("videos-channel")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"videos" }, (payload) => {
        const v = payload.new;
        // ✅ NEW: include created_at on realtime-inserted videos too
        const newVideo = { id:v.id, src:v.video_url, thumbnail:v.thumbnail_url, title:v.title, duration:v.duration||"00:00", channel:v.channel, username:v.username||v.channel?.toLowerCase()||"unknown", tags:[v.category||"All"], likes:v.likes??0, created_at:v.created_at||null };
        setDbVideos((prev) => [newVideo, ...prev]);
        // ✅ FIX: Fetch view counts and refresh watched IDs for new video
        fetchViewCounts([v.id], "video");
        loadWatchedIds();
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"videos" }, (payload) => { setDbVideos((prev) => prev.filter((v) => v.id !== payload.old.id)); })
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, [loadWatchedIds]);

  useEffect(() => {
    const fetchDbReels = async () => {
      const { data, error } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      if (!error && data) {
        const formatted = data.map((r) => ({ id:"db_"+r.id, dbId:r.id, src:r.video_url, thumbnail:r.thumbnail||"https://picsum.photos/200/350?random=99", title:r.title||"Untitled", duration:r.duration||"00:00", user:r.user||r.username||"Unknown", username:r.username||"unknown", profilePic:"https://api.dicebear.com/7.x/initials/svg?seed="+(r.username||"user"), description:r.description||"", likes:r.likes??0, created_at:r.created_at||null }));
        setDbReels(formatted);
        fetchViewCounts(formatted.map((r) => r.id), "reel");
      }
    };
    fetchDbReels();

    const reelsSub = supabase.channel("reels-channel")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"reels" }, (payload) => {
        const r = payload.new;
        const newReel = { id:"db_"+r.id, dbId:r.id, src:r.video_url, thumbnail:r.thumbnail||"https://picsum.photos/200/350?random=99", title:r.title||"Untitled", duration:r.duration||"00:00", user:r.user||r.username||"Unknown", username:r.username||"unknown", profilePic:"https://api.dicebear.com/7.x/initials/svg?seed="+(r.username||"user"), description:r.description||"", likes:r.likes||0, created_at:r.created_at||null };
        setDbReels((prev) => [newReel, ...prev]);
        // ✅ FIX: Fetch view counts and refresh watched IDs for new reel
        fetchViewCounts([r.id], "reel");
        loadWatchedIds();
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"reels" }, (payload) => { setDbReels((prev) => prev.filter((r) => r.dbId !== payload.old.id)); })
      .subscribe();
    return () => supabase.removeChannel(reelsSub);
  }, [loadWatchedIds]);

  const allVideos = [...dbVideos, ...videos.map((v) => ({ ...v, id: typeof v.id === "number" ? `static_${v.id}` : v.id }))];
  const allReels  = [...dbReels,  ...reelsData.map((r) => ({ ...r, id: typeof r.id === "number" ? `static_${r.id}` : r.id }))];

  useEffect(() => {
    if (searchQuery) fetchYouTubeByTopic(searchQuery);
    else fetchYouTubeByTopic(selectedOption);
  }, [selectedOption, searchQuery]);

  useEffect(() => {
    const track = optionsTrackRef.current;
    if (!track) return;
    let pos = 0;
    const speed = 0.6;
    const step = () => {
      if (!isPausedRef.current) {
        pos += speed;
        if (pos >= track.scrollWidth - track.clientWidth) pos = 0;
        track.scrollLeft = pos;
      }
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
    return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
  }, []);

  const fetchYouTubeByTopic = async (topic) => {
    if (["All","Recently Uploaded","Watched"].includes(topic)) { setYtVideos([]); return; }
    setYtLoading(true);
    setYtVideos([]);
    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", { params:{ part:"snippet", q:topic, type:"video", maxResults:50, order:"relevance", key:API_KEYS[keyIndex] } });
        currentKeyIndex = keyIndex;
        setYtVideos(res.data.items || []);
        break;
      } catch (err) {
        if (err.response?.status === 403) { currentKeyIndex = (keyIndex + 1) % API_KEYS.length; continue; }
        break;
      }
    }
    setYtLoading(false);
  };

  const openWatchPage = (videoId, title, channel, dbVideoId = null) => {
    if (dbVideoId) incrementView(String(dbVideoId), "video");
    setWatchVideo({ videoId, title, channel });
  };
  const closeWatchPage = () => setWatchVideo(null);
  const getSuggestions = () => [...ytVideos.slice(0, 20), ...allVideos.slice(0, 12)];
  const filteredVideos = selectedOption === "All" ? allVideos : allVideos.filter((v) => v.tags?.includes(selectedOption));
  const searchActive = searchQuery.length > 0;

  const scoreVideo = (v) => {
    let score = 0;
    const words = searchQuery.split(/\s+/).filter(Boolean);
    const title = (v.title || "").toLowerCase();
    const channel = (v.channel || "").toLowerCase();
    const tags = (v.tags || []).map((t) => t.toLowerCase());
    const description = (v.description || "").toLowerCase();
    for (const w of words) {
      if (title.includes(w)) score += 4;
      if (tags.some((t) => t.includes(w))) score += 3;
      if (channel.includes(w)) score += 2;
      if (description.includes(w)) score += 1;
    }
    return score;
  };

  const searchedLocalVideos = searchActive
    ? [...dbVideos.map((v) => ({ ...v, isUploaded: true })), ...videos.map((v) => ({ ...v, id: typeof v.id === "number" ? `static_${v.id}` : v.id }))]
        .map((v) => ({ ...v, _score: scoreVideo(v) })).filter((v) => v._score > 0).sort((a, b) => b._score - a._score)
    : [];

  const searchedReels = searchActive
    ? allReels.filter((r) => { const q = searchQuery; return (r.title||"").toLowerCase().includes(q)||(r.user||"").toLowerCase().includes(q)||(r.username||"").toLowerCase().includes(q)||(r.description||"").toLowerCase().includes(q); })
    : [];

  const handleLikeVideo = async (e, videoId) => {
    e.preventDefault(); e.stopPropagation();
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to like"); return; }
    try {
      const { data: existing } = await supabase.from("likes").select("id").match({ user_id:userId, content_id:String(videoId), content_type:"video" }).maybeSingle();
      if (existing) {
        await supabase.from("likes").delete().match({ user_id:userId, content_id:String(videoId), content_type:"video" });
        await supabase.rpc("decrement_likes", { p_table:"videos", p_id:videoId });
        setDbVideos((prev) => prev.map((v) => v.id===videoId ? { ...v, likes:Math.max(0,(v.likes||0)-1) } : v));
      } else {
        await supabase.from("likes").insert({ user_id:userId, content_id:String(videoId), content_type:"video" });
        await supabase.rpc("increment_likes", { p_table:"videos", p_id:videoId });
        setDbVideos((prev) => prev.map((v) => v.id===videoId ? { ...v, likes:(v.likes||0)+1 } : v));
      }
    } catch (_) {}
  };

  const handleDeleteVideo = async (e, videoId) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    const { error } = await supabase.from("videos").delete().eq("id", videoId);
    if (!error) setDbVideos((prev) => prev.filter((v) => v.id !== videoId));
    else alert("Failed to delete video.");
  };

  const handleDeleteReel = async (e, dbId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    const { error } = await supabase.from("reels").delete().eq("id", dbId);
    if (!error) setDbReels((prev) => prev.filter((r) => r.dbId !== dbId));
    else alert("Failed to delete reel.");
  };

  // ── Watch Later toggle: only valid for DB-backed videos (watch_later.video_id
  // joins against the real `videos` table, same constraint as History) ──
  const handleToggleWatchLater = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    const username = localStorage.getItem("username");
    if (!username) { alert("Please login to save videos"); return; }

    const idStr = String(videoId);
    if (watchLaterIds.has(idStr)) {
      await supabase.from("watch_later").delete().eq("username", username).eq("video_id", videoId);
      setWatchLaterIds((prev) => { const next = new Set(prev); next.delete(idStr); return next; });
    } else {
      await supabase.from("watch_later").insert({ username, video_id: videoId });
      setWatchLaterIds((prev) => new Set(prev).add(idStr));
    }
  };

  const ShortsRow = ({ data, title }) => (
    <div className="homePage_shortsSection">
      <div className="homePage_shortsHeader">
        <span className="homePage_shortsTitle">
          <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", background:"linear-gradient(135deg,#e53935,#f97316)", color:"white", fontWeight:"900", fontSize:"15px", fontFamily:"Arial Black, sans-serif", borderRadius:"6px", marginRight:"0px", flexShrink:0, verticalAlign:"middle" }}>Z</span>
          {title}
        </span>
      </div>
      <div className="homePage_shortsRow">
        {data.map((short) => (<ShortCard key={short.id} short={short} incrementView={incrementView} viewCounts={viewCounts} handleDeleteReel={handleDeleteReel} navigate={navigate} watchedContentIds={watchedContentIds} />))}
      </div>
    </div>
  );

  const VideoCard = ({ video, isUploaded = false, showDelete = false }) => {
    const showNew = isUploaded && !isWatched("video", video.id, watchedContentIds);
    const isOwner = showDelete && isUploaded && loggedInUsername && video.username === loggedInUsername;
    const isSaved = watchLaterIds.has(String(video.id));
    return (
      <div className="youtube_thumbnailBox" style={{ position:"relative" }}>
        {isOwner && (<button onClick={(e)=>handleDeleteVideo(e,video.id)} title="Delete video" style={{ position:"absolute", top:"8px", right:"8px", zIndex:10, background:"rgba(239,68,68,0.92)", border:"none", color:"white", borderRadius:"8px", padding:"4px 8px", cursor:"pointer", fontSize:"11px", fontWeight:"800", boxShadow:"0 2px 8px rgba(239,68,68,0.4)" }}>🗑 Delete</button>)}
        {isUploaded && (
          <button
            onClick={(e) => handleToggleWatchLater(e, video.id)}
            title={isSaved ? "Remove from Watch Later" : "Save to Watch Later"}
            style={{
              position: "absolute",
              top: "8px",
              right: isOwner ? "118px" : "44px",
              zIndex: 10,
              background: "rgba(0,0,0,0.6)",
              border: "none",
              color: "white",
              borderRadius: "8px",
              padding: "5px 7px",
              cursor: "pointer",
              fontSize: "15px",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isSaved ? <BookmarkIcon style={{ fontSize: 16, color: "#7c3aed" }} /> : <BookmarkBorderIcon style={{ fontSize: 16 }} />}
          </button>
        )}
        {/* ── Add to Playlist (⋮ menu) — only for real DB-backed videos ── */}
        {isUploaded && (
          <PlaylistMenuButton videoId={video.id} playlistsCache={playlistsCache} setPlaylistsCache={setPlaylistsCache} />
        )}
        <Link to={"/video/"+video.id} className="youtube_thumbnailWrapper" onClick={()=>{ if(isUploaded) incrementView(video.id,"video"); }}>
          <img src={video.thumbnail} alt={video.title} className="youtube_thumbnailPic" />
          <div className="youtube_timingThumbnail">{video.duration}</div>
          {showNew && (<div style={{ position:"absolute", top:"8px", left:"8px", background:"linear-gradient(135deg,#f43f5e,#f97316)", color:"white", fontSize:"10px", fontWeight:"800", padding:"2px 7px", borderRadius:"5px", zIndex:2 }}>New</div>)}
          <div className="youtube_playOverlay"><div className="youtube_playButton">▶</div></div>
        </Link>
        <div className="youtubeTitleBox">
          <div className="youtubeBoxProfile">
            <img src={"https://api.dicebear.com/7.x/initials/svg?seed="+video.channel} alt={video.channel} className="youtube_thumbnail_Profile" />
            <Link to={"/user/"+(video.username||video.channel.toLowerCase())} style={{ textDecoration:"none", color:"inherit" }}><p className="youtube_ChannelName">{video.channel}</p></Link>
          </div>
          <div className="youtubeVideoInfo">
            <p className="youtube_videoTitle">{video.title}</p>
            <p className="youtubeVideo_Views" style={{ display:"flex", gap:"10px", alignItems:"center" }}>
              {isUploaded ? (<><span>👁 {formatViews(viewCounts["video_"+video.id]??0)}</span><span style={{ color:"#d1d5db", fontSize:"11px" }}>•</span><button onClick={(e)=>handleLikeVideo(e,video.id)} style={{ background:"none", border:"none", color:"#8b84c4", cursor:"pointer", fontSize:"inherit", padding:0, display:"flex", alignItems:"center", gap:"3px", fontWeight:"600" }}>👍 {video.likes??0} Likes</button></>) : (<span>👍 3 Likes</span>)}
            </p>
            {/* ✅ NEW: upload date/time, shown for real uploaded videos only */}
            {isUploaded && video.created_at && (
              <p className="youtubeVideo_UploadDate" style={{ color:"#a8a3d6", fontSize:"12px", margin:"3px 0 0", fontWeight:"500" }}>
                {formatTimeAgo(video.created_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const YouTubeVideoCard = ({ item }) => (
    <div className="youtube_thumbnailBox" style={{ cursor:"pointer" }} onClick={()=>openWatchPage(item.id.videoId, item.snippet.title, item.snippet.channelTitle)}>
      <div className="youtube_thumbnailWrapper" style={{ position:"relative", display:"block" }}>
        <img src={item.snippet.thumbnails.medium.url} alt={item.snippet.title} className="youtube_thumbnailPic" />
        <div style={{ position:"absolute", top:"8px", left:"8px", background:"#ef4444", color:"white", fontSize:"10px", fontWeight:"800", padding:"2px 7px", borderRadius:"5px" }}>▶ YouTube</div>
      </div>
      <div className="youtubeTitleBox">
        <div className="youtubeBoxProfile">
          <img src={"https://ui-avatars.com/api/?name="+encodeURIComponent(item.snippet.channelTitle)+"&background=random&size=36"} alt={item.snippet.channelTitle} className="youtube_thumbnail_Profile" />
          <p className="youtube_ChannelName">{item.snippet.channelTitle}</p>
        </div>
        <div className="youtubeVideoInfo">
          <p className="youtube_videoTitle">{item.snippet.title}</p>
          <p className="youtubeVideo_Views">{new Date(item.snippet.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
        </div>
      </div>
    </div>
  );

  const SkeletonCard = () => (
    <div className="youtube_thumbnailBox" style={{ border:"2px solid #e0d4ff" }}>
      <div style={{ width:"100%", paddingTop:"56.25%", background:"linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)", backgroundSize:"400px 100%", borderRadius:"0", animation:"shimmer 1.4s infinite" }} />
      <div style={{ padding:"10px 12px", display:"flex", gap:"10px", background:"#fff" }}>
        <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)", backgroundSize:"400px 100%", flexShrink:0, animation:"shimmer 1.4s infinite" }} />
        <div style={{ flex:1 }}>
          <div style={{ height:"13px", background:"linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)", backgroundSize:"400px 100%", borderRadius:"6px", marginBottom:"8px", animation:"shimmer 1.4s infinite" }} />
          <div style={{ height:"12px", background:"linear-gradient(90deg,#e8e0ff 25%,#f3eeff 50%,#e8e0ff 75%)", backgroundSize:"400px 100%", borderRadius:"6px", width:"60%", animation:"shimmer 1.4s infinite" }} />
        </div>
      </div>
    </div>
  );

  const SectionLabel = ({ color, bg, text, count }) => (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
      <span style={{ background:bg, color:color, fontSize:"11px", fontWeight:"800", padding:"4px 12px", borderRadius:"20px", fontFamily:"Nunito, sans-serif", letterSpacing:"0.3px" }}>{text}</span>
      {count!==undefined&&(<span style={{ color:"#8b84c4", fontSize:"12px", fontWeight:"600" }}>{count} video{count!==1?"s":""}</span>)}
    </div>
  );

  const movieTags = ["Hindi Movies","Hollywood Movies","Dubbed Hollywood Movies","Pakistani Movies","Bhojpuri Cinema","Film Criticisms","Superhero Movies","Indian Movies"];
  const movieVideos = allVideos.filter((v) => v.tags?.some((t) => movieTags.includes(t)));
  const liveVideos  = allVideos.filter((v) => v.tags?.includes("Live"));

  const SearchResultsPanel = () => (
    <div className="search-results-panel">
      <div style={{ marginBottom:"20px" }}>
        <h2 style={{ color:"#1e1b4b", fontSize:"18px", fontWeight:"800", margin:"0 0 6px", fontFamily:"Nunito, sans-serif" }}>🔍 Results for "{searchQuery}"</h2>
        <span style={{ color:"#8b84c4", fontSize:"13px", fontWeight:"600" }}>{searchedLocalVideos.length} local videos · {searchedReels.length} reels · {ytVideos.length} YouTube</span>
      </div>
      {searchedReels.length>0&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#f97316" bg="#fff7ed" text="🎬 REELS" count={searchedReels.length} /><div className="homePage_shortsRow">{searchedReels.map((short)=>(<ShortCard key={short.id} short={short} incrementView={incrementView} viewCounts={viewCounts} handleDeleteReel={handleDeleteReel} navigate={navigate} watchedContentIds={watchedContentIds} />))}</div></div>)}
      {searchedLocalVideos.length>0&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#4c4589" bg="#f0f4ff" text="🎬 LOCAL VIDEOS" count={searchedLocalVideos.length} /><div className="youtube_VideoGrid">{searchedLocalVideos.map((v)=>(<VideoCard key={v.id} video={v} isUploaded={v.isUploaded||false} showDelete={v.isUploaded} />))}</div></div>)}
      {ytLoading&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#ef4444" bg="#fff1f2" text="▶ YOUTUBE — searching..." /><div className="youtube_VideoGrid">{[...Array(8)].map((_,i)=>(<SkeletonCard key={i} />))}</div></div>)}
      {!ytLoading&&ytVideos.length>0&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#ef4444" bg="#fff1f2" text="▶ YOUTUBE" count={ytVideos.length} /><div className="youtube_VideoGrid">{ytVideos.map((item)=>(<YouTubeVideoCard key={item.id.videoId} item={item} />))}</div></div>)}
      {!ytLoading&&searchedLocalVideos.length===0&&searchedReels.length===0&&ytVideos.length===0&&(<div style={{ textAlign:"center", marginTop:"80px" }}><div style={{ fontSize:"48px", marginBottom:"16px" }}>🔍</div><p style={{ color:"#8b84c4", fontSize:"16px", fontWeight:"600" }}>No results for "<span style={{ color:"#7c3aed" }}>{searchQuery}</span>"</p><p style={{ color:"#c4bfdf", fontSize:"13px", marginTop:"8px" }}>Try different keywords</p></div>)}
    </div>
  );

  const renderMobileTabContent = () => {
    switch (mobileTab) {
      case "shorts":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            {allReels.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#8b84c4" }}><div style={{ fontSize:"36px", marginBottom:"10px" }}>📱</div><p style={{ margin:0, fontWeight:"600" }}>No shorts yet</p></div>
            ) : (
              <>
                <div className="mobile-tab-section-head">All Shorts ({allReels.length})</div>
                <div className="homePage_shortsRow">{allReels.map((short)=>(<ShortCard key={short.id} short={short} incrementView={incrementView} viewCounts={viewCounts} handleDeleteReel={handleDeleteReel} navigate={navigate} watchedContentIds={watchedContentIds} />))}</div>
              </>
            )}
          </div>
        );
      case "videos":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            {dbVideos.length > 0 && (<><div className="mobile-tab-section-head">Uploaded ({dbVideos.length})</div><div className="youtube_VideoGrid" style={{ marginBottom:"16px" }}>{dbVideos.map((v)=>(<VideoCard key={v.id} video={v} isUploaded={true} showDelete={true} />))}</div></>)}
            <div className="mobile-tab-section-head">All Videos ({videos.length})</div>
            <div className="youtube_VideoGrid">
              {dbLoading&&[...Array(4)].map((_,i)=>(<SkeletonCard key={i} />))}
              {videos.map((v)=>(<VideoCard key={typeof v.id==="number"?`static_${v.id}`:v.id} video={{ ...v, id:typeof v.id==="number"?`static_${v.id}`:v.id }} />))}
            </div>
          </div>
        );
      case "movies":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            <div className="mobile-tab-section-head">Movies ({movieVideos.length||videos.length})</div>
            {movieVideos.length > 0 ? (
              <div className="youtube_VideoGrid">{movieVideos.map((v)=>(<VideoCard key={v.id} video={v} isUploaded={dbVideos.some((d)=>d.id===v.id)} />))}</div>
            ) : (
              <div className="youtube_VideoGrid">{videos.map((v)=>(<VideoCard key={typeof v.id==="number"?`static_${v.id}`:v.id} video={{ ...v, id:typeof v.id==="number"?`static_${v.id}`:v.id }} />))}</div>
            )}
          </div>
        );
      case "live":
        return (
          <div className="mobile-tab-content" {...swipeHandlers}>
            <div className="mobile-live-badge"><span className="mobile-live-dot" />LIVE NOW</div>
            {liveVideos.length > 0 ? (
              <><div className="mobile-tab-section-head">Live Videos ({liveVideos.length})</div><div className="youtube_VideoGrid">{liveVideos.map((v)=>(<VideoCard key={v.id} video={v} isUploaded={dbVideos.some((d)=>d.id===v.id)} />))}</div></>
            ) : (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#8b84c4" }}><div style={{ fontSize:"36px", marginBottom:"10px" }}>🔴</div><p style={{ margin:0, fontWeight:"600" }}>No live videos right now</p></div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="homePage">
      <div className={"homePage_options"+(sideNavbar?" sidebar-open":"")}>
        <div className="homePage_options_track" ref={optionsTrackRef}
          onMouseEnter={()=>{ isPausedRef.current=true; }}
          onMouseLeave={()=>{ isPausedRef.current=false; }}
          onTouchStart={()=>{ isPausedRef.current=true; }}
          onTouchEnd={()=>{ setTimeout(()=>{ isPausedRef.current=false; },1500); }}
          onMouseDown={(e)=>{
            isPausedRef.current=true;
            const startX=e.pageX-optionsTrackRef.current.offsetLeft;
            const startScroll=optionsTrackRef.current.scrollLeft;
            const onMove=(ev)=>{ const x=ev.pageX-optionsTrackRef.current.offsetLeft; optionsTrackRef.current.scrollLeft=startScroll-(x-startX); };
            const onUp=()=>{ document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); setTimeout(()=>{ isPausedRef.current=false; },1500); };
            document.addEventListener("mousemove",onMove);
            document.addEventListener("mouseup",onUp);
          }}
          style={{ cursor:"grab", userSelect:"none" }}
        >
          {options.map((item)=>(
            <div key={item} className="homePage_option" onClick={()=>setSelectedOption(item)}
              style={{ cursor:"pointer", background:selectedOption===item?"rgba(124,58,237,0.08)":"transparent", color:selectedOption===item?"#7c3aed":"#4c4589", borderRadius:selectedOption===item?"8px":"0", padding:"6px 14px", fontWeight:selectedOption===item?"800":"600", transition:"all 0.2s", whiteSpace:"nowrap", userSelect:"none" }}
            >{item}</div>
          ))}
        </div>
      </div>

      <div className={"home_mainPage"+(sideNavbar?" sidebar-open":" sidebar-closed")}>
        {searchActive && <SearchResultsPanel />}

        {!searchActive && (
          <MobileTrendingStrip dbVideos={allVideos} dbReels={allReels} onVideoClick={(v)=>navigate(`/video/${v.id}`)} onReelClick={(r)=>navigate("/reels/"+r.id,{state:{clickedReel:r}})} />
        )}

        {!searchActive && (
          <div className="mobile-tab-bar">
            {MOBILE_TABS.map((tab)=>(
              <button key={tab.id} className={"mobile-tab-btn"+(mobileTab===tab.id?" active":"")} onClick={()=>setMobileTab(tab.id)}>
                <span className="mobile-tab-icon">{tab.icon}</span>
                <span className="mobile-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {!searchActive && renderMobileTabContent()}

        {/* ── DESKTOP LAYOUT ── */}
        {!searchActive && (selectedOption === "All" ? (
          <>
            {(()=>{
              const allVids=[...dbVideos.map((v)=>({...v,isUploaded:true})),...videos.map((v)=>({...v,id:typeof v.id==="number"?`static_${v.id}`:v.id}))];
              const rows=[];
              const totalRows=Math.ceil(allVids.length/12);
              for(let rowIndex=0;rowIndex<totalRows;rowIndex++){
                const rowReels=allReels.slice(rowIndex*9,rowIndex*9+9);
                rows.push(
                  <React.Fragment key={rowIndex}>
                    {rowReels.length>0&&(<ShortsRow data={rowReels} title={rowIndex===0?"Shorts":"More Shorts"} />)}
                    <div className="youtube_VideoGrid">
                      {rowIndex===0&&dbLoading&&[...Array(4)].map((_,i)=>(<SkeletonCard key={i} />))}
                      {allVids.slice(rowIndex*12,rowIndex*12+12).map((v)=>(<VideoCard key={v.id} video={v} isUploaded={v.isUploaded||false} />))}
                    </div>
                  </React.Fragment>
                );
              }
              return rows;
            })()}
          </>
        ) : (
          <div style={{ padding:"16px 0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
              <span style={{ fontSize:"22px" }}>{ytLoading?"⏳":"🔎"}</span>
              <h2 style={{ color:"#1e1b4b", fontSize:"18px", fontWeight:"800", margin:0, fontFamily:"Nunito, sans-serif" }}>{selectedOption}</h2>
              {ytLoading&&(<span style={{ color:"#8b84c4", fontSize:"13px", fontWeight:"600" }}>— loading YouTube results...</span>)}
            </div>
            {dbVideos.filter((v)=>v.tags?.includes(selectedOption)).length>0&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#f97316" bg="#fff7ed" text="⬆ UPLOADED VIDEOS" count={dbVideos.filter((v)=>v.tags?.includes(selectedOption)).length} /><div className="youtube_VideoGrid">{dbVideos.filter((v)=>v.tags?.includes(selectedOption)).map((v)=>(<VideoCard key={v.id} video={v} isUploaded={true} />))}</div></div>)}
            {videos.filter((v)=>v.tags?.includes(selectedOption)).length>0&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#4c4589" bg="#f0f4ff" text="🎬 LOCAL VIDEOS" count={videos.filter((v)=>v.tags?.includes(selectedOption)).length} /><div className="youtube_VideoGrid">{videos.filter((v)=>v.tags?.includes(selectedOption)).map((v)=>(<VideoCard key={typeof v.id==="number"?`static_${v.id}`:v.id} video={{...v,id:typeof v.id==="number"?`static_${v.id}`:v.id}} />))}</div></div>)}
            {ytLoading&&(<div style={{ marginBottom:"40px" }}><SectionLabel color="#ef4444" bg="#fff1f2" text="▶ YOUTUBE" /><div className="youtube_VideoGrid">{[...Array(8)].map((_,i)=>(<SkeletonCard key={i} />))}</div></div>)}
            {!ytLoading&&ytVideos.length>0&&(<div><SectionLabel color="#ef4444" bg="#fff1f2" text="▶ YOUTUBE" count={ytVideos.length} /><div className="youtube_VideoGrid">{ytVideos.map((item)=>(<YouTubeVideoCard key={item.id.videoId} item={item} />))}</div></div>)}
            {!ytLoading&&filteredVideos.length===0&&ytVideos.length===0&&(<div style={{ textAlign:"center", marginTop:"80px" }}><div style={{ fontSize:"48px", marginBottom:"16px" }}>📭</div><p style={{ color:"#8b84c4", fontSize:"16px", fontWeight:"600" }}>No videos found for "<span style={{ color:"#7c3aed" }}>{selectedOption}</span>"</p><p style={{ color:"#c4bfdf", fontSize:"13px", marginTop:"8px" }}>Try selecting a different category</p></div>)}
          </div>
        ))}
      </div>

      {watchVideo && (
        <WatchPage initialVideoId={watchVideo.videoId} initialTitle={watchVideo.title} initialChannel={watchVideo.channel} onClose={closeWatchPage} suggestions={getSuggestions()} onIncrementView={incrementView} />
      )}
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}"}</style>
    </div>
  );
};

export default HomePage;