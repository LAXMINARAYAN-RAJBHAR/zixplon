import React, { useState, useEffect, useRef } from "react";
import "./homePage.css";
import { reelsData } from "../Reels/reels";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

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
  { id: 7679, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s", title: "Big Buck Bunny open-source film", duration: "09:56", channel: "Gangeshwary", tags: ["Film Criticisms", "Live"] },
  { id: 2, thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg", title: "Sample Video 2", duration: "30:00", channel: "Mummy", tags: ["Music"] },
  { id: 3, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s", title: "3d Lion Stock Photo", duration: "60:00", channel: "Papa", tags: ["AI"] },
  { id: 4, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s", title: "Sample Video 4", duration: "10:00", channel: "Karthik", tags: ["News"] },
  { id: 5, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s", title: "8k Wallpaper 3d Photos", duration: "18:00", channel: "Annu", tags: ["Astronomy"] },
  { id: 6, thumbnail: "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg", title: "3D Animation Solutions", duration: "08:00", channel: "Jyoti", tags: ["AI", "Web Development"] },
  { id: 7, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s", title: "3D Shapes | Types & Examples", duration: "28:00", channel: "Sarita", tags: ["Web Development"] },
  { id: 8, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s", title: "3d Graphics Pictures", duration: "20:00", channel: "Jaynarayan", tags: ["AI"] },
  { id: 9, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s", title: "Scenery 3d wallpaper", duration: "10:00", channel: "Shyamnarayan", tags: ["Astronomy"] },
  { id: 10, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s", title: "3D Nature Images", duration: "12:00", channel: "Rajbhar", tags: ["History"] },
  { id: 11, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s", title: "5,364,800+ 3d Images", duration: "13:30", channel: "Narayan", tags: ["AI"] },
  { id: 12, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s", title: "Understanding 3D Computer Graphics", duration: "20:50", channel: "Laxminarayan", tags: ["Web Development", "AI"] },
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
  { id: 1, user: "Ravi Kumar",    avatar: "RK", text: "This is absolutely amazing content! Keep it up 🔥", likes: 142, time: "2 days ago" },
  { id: 2, user: "Priya Sharma",  avatar: "PS", text: "Really informative, learned so much from this video.", likes: 87,  time: "1 day ago" },
  { id: 3, user: "Arjun Mehta",   avatar: "AM", text: "The editing on this is top notch. Subscribed!", likes: 56, time: "5 hours ago" },
  { id: 4, user: "Sneha Patel",   avatar: "SP", text: "Been waiting for a video like this!", likes: 34, time: "3 hours ago" },
  { id: 5, user: "Dev_Codes",     avatar: "DC", text: "Bookmarked this. Will rewatch multiple times 📌", likes: 29, time: "1 hour ago" },
  { id: 6, user: "NatureLover99", avatar: "NL", text: "The visuals are stunning. What camera do you use?", likes: 18, time: "45 mins ago" },
  { id: 7, user: "TechWithVik",   avatar: "TV", text: "Explained in the simplest way possible. Respect 🙏", likes: 11, time: "20 mins ago" },
];

const avatarColors = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9"];
const getColor = (str) => avatarColors[(str || "A").charCodeAt(0) % avatarColors.length];

/* ── responsive hook ── */
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

/* ─────────────────────────────────────────────────────────────
   SUGGESTION CARD
───────────────────────────────────────────────────────────── */
const SuggestionCard = ({ item, isActive, onClick, isMobile }) => {
  const isYT    = !!item.snippet;
  const thumb   = isYT ? item.snippet.thumbnails.medium.url : item.thumbnail;
  const title   = isYT ? item.snippet.title                 : item.title;
  const channel = isYT ? item.snippet.channelTitle          : item.channel;
  const duration = !isYT ? item.duration : null;
  const hasYTId  = isYT && !!item.id?.videoId;

  return (
    <div
      onClick={() => hasYTId && onClick()}
      style={{
        display: "flex", gap: "10px",
        marginBottom: "8px", borderRadius: "8px",
        padding: isMobile ? "8px 6px" : "6px",
        cursor: hasYTId ? "pointer" : "default",
        transition: "background 0.2s",
        background: isActive ? "#1e2a38" : "transparent",
        border: `1px solid ${isActive ? "#3ea6ff55" : "transparent"}`,
        opacity: hasYTId ? 1 : 0.55,
      }}
      onMouseEnter={e => { if (!isActive && hasYTId) e.currentTarget.style.background = "#1a1a1a"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ position: "relative", flexShrink: 0, width: isMobile ? "108px" : "120px", height: isMobile ? "61px" : "68px", borderRadius: "6px", overflow: "hidden", background: "#222" }}>
        <img src={thumb} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {isActive && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#3ea6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "10px", marginLeft: "2px", color: "#000" }}>▶</span>
            </div>
          </div>
        )}
        {duration && !isActive && (
          <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.85)", color: "#fff", fontSize: "10px", fontWeight: "600", padding: "1px 5px", borderRadius: "3px" }}>{duration}</div>
        )}
        {isYT && (
          <div style={{ position: "absolute", top: "4px", left: "4px", background: "#ff0000", color: "#fff", fontSize: "8px", fontWeight: "700", padding: "1px 5px", borderRadius: "3px" }}>▶ YT</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: isActive ? "#fff" : "#ccc", fontSize: isMobile ? "13px" : "12px", fontWeight: isActive ? "700" : "500", margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {title}
        </p>
        <p style={{ color: "#888", fontSize: "11px", margin: 0 }}>{channel}</p>
        {isActive && <p style={{ color: "#3ea6ff", fontSize: "10px", margin: "3px 0 0", fontWeight: "700" }}>▶ Now playing</p>}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   WATCH PAGE  (drop-in replacement — matches SearchResults style)
───────────────────────────────────────────────────────────── */
const WatchPage = ({ initialVideoId, initialTitle, initialChannel, onClose, suggestions }) => {
  const isMobile = useIsMobile();

  const [currentIndex, setCurrentIndex] = useState(() => {
    const i = suggestions.findIndex(s => s.id?.videoId === initialVideoId);
    return i >= 0 ? i : 0;
  });

  const [autoplay,    setAutoplay]    = useState(true);
  const [isLiked,     setIsLiked]     = useState(false);
  const [isDisliked,  setIsDisliked]  = useState(false);
  const [likeCount]                   = useState(() => Math.floor(Math.random() * 50000) + 1000);
  const [comments,    setComments]    = useState(MOCK_COMMENTS);
  const [newComment,  setNewComment]  = useState("");
  const [likedComments, setLikedComments] = useState(new Set());
  const [showFullDesc,  setShowFullDesc]  = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());

  const playerRef     = useRef(null);
  const autoplayRef   = useRef(autoplay);
  const indexRef      = useRef(currentIndex);
  const suggestionsRef = useRef(suggestions);

  useEffect(() => { autoplayRef.current   = autoplay;     }, [autoplay]);
  useEffect(() => { indexRef.current      = currentIndex; }, [currentIndex]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);

  const item        = suggestions[currentIndex] || null;
  const isYT        = item && !!item.snippet;
  const videoId     = (isYT && item.id?.videoId) ? item.id.videoId    : initialVideoId;
  const videoTitle  = isYT ? item.snippet.title        : (item?.title    ?? initialTitle);
  const channelName = isYT ? item.snippet.channelTitle  : (item?.channel  ?? initialChannel);
  const publishedAt = isYT ? item.snippet.publishedAt   : null;
  const description = isYT ? item.snippet.description   : null;

  /* ── Load YT IFrame API once ── */
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  /* ── Init / reinit player whenever videoId changes ── */
  useEffect(() => {
    if (!videoId) return;
    let pollInterval = null;

    const initPlayer = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
      const container = document.getElementById("hp-yt-player-container");
      if (container) {
        container.innerHTML = "";
        const div = document.createElement("div");
        div.id = "hp-yt-player";
        container.appendChild(div);
      }
      playerRef.current = new window.YT.Player("hp-yt-player", {
        height: isMobile ? "220" : "500",
        width:  "100%",
        videoId,
        playerVars: { autoplay: 1, rel: 0, enablejsapi: 1, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            pollInterval = setInterval(() => {
              if (!playerRef.current) return;
              try {
                if (playerRef.current.getPlayerState() === 0 && autoplayRef.current) {
                  clearInterval(pollInterval);
                  const next = indexRef.current + 1;
                  const sug  = suggestionsRef.current;
                  if (next < sug.length && sug[next].id?.videoId) goTo(next);
                }
              } catch (e) {}
            }, 1000);
          },
          onStateChange: (event) => {
            if (event.data === 0 && autoplayRef.current) {
              clearInterval(pollInterval);
              const next = indexRef.current + 1;
              const sug  = suggestionsRef.current;
              if (next < sug.length && sug[next].id?.videoId) goTo(next);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) initPlayer();
    else window.onYouTubeIframeAPIReady = initPlayer;

    return () => {
      clearInterval(pollInterval);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const goTo = (idx) => {
    setCurrentIndex(Math.max(0, Math.min(idx, suggestions.length - 1)));
    setIsLiked(false); setIsDisliked(false); setShowFullDesc(false);
  };

  const ytSuggestions  = suggestions.filter(s => s.id?.videoId);
  const hasPrev = ytSuggestions.some(s => suggestions.indexOf(s) < currentIndex);
  const hasNext = ytSuggestions.some(s => suggestions.indexOf(s) > currentIndex);

  const goPrev = () => {
    const rel = [...suggestions.slice(0, currentIndex)].reverse().findIndex(s => s.id?.videoId);
    if (rel >= 0) goTo(currentIndex - 1 - rel);
  };
  const goNext = () => {
    const rel = suggestions.slice(currentIndex + 1).findIndex(s => s.id?.videoId);
    if (rel >= 0) goTo(currentIndex + 1 + rel);
  };

  const handleSubscribe = (ch) => {
    setSubscribedChannels(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments(prev => [{ id: Date.now(), user: "You", avatar: "YO", text: newComment.trim(), likes: 0, time: "Just now" }, ...prev]);
    setNewComment("");
  };
  const toggleCommentLike = (id) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setComments(c => c.map(x => x.id === id ? { ...x, likes: x.likes - 1 } : x)); }
      else              { next.add(id);    setComments(c => c.map(x => x.id === id ? { ...x, likes: x.likes + 1 } : x)); }
      return next;
    });
  };

  /* ── Autoplay toggle UI ── */
  const AutoplayToggle = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ color: "#aaa", fontSize: "13px" }}>Autoplay</span>
      <div
        onClick={() => setAutoplay(a => !a)}
        style={{ width: "44px", height: "24px", background: autoplay ? "#ff0000" : "#555", borderRadius: "12px", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }}
      >
        <div style={{ width: "18px", height: "18px", background: "white", borderRadius: "50%", position: "absolute", top: "3px", left: autoplay ? "23px" : "3px", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
      </div>
      <span style={{ color: autoplay ? "#ff0000" : "#555", fontSize: "12px", fontWeight: "600" }}>{autoplay ? "ON" : "OFF"}</span>
    </div>
  );

  /* ── Player box using YT IFrame API ── */
  const PlayerBox = () => (
    <div style={{ borderRadius: isMobile ? "0" : "12px", overflow: "hidden", background: "#000" }}>
      <div id="hp-yt-player-container" style={{ width: "100%", height: isMobile ? "220px" : "500px" }}>
        <div id="hp-yt-player" />
      </div>
    </div>
  );

  /* ── Prev / Autoplay / Next bar ── */
  const NavBar = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#181818", borderRadius: "10px", padding: "10px 16px", marginTop: "10px" }}>
      <button onClick={goPrev} disabled={!hasPrev}
        style={{ display: "flex", alignItems: "center", gap: "6px", background: hasPrev ? "#272727" : "#2a2a2a", border: "none", color: hasPrev ? "white" : "#555", borderRadius: "20px", padding: "8px 18px", cursor: hasPrev ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: "600" }}
        onMouseEnter={e => { if (hasPrev) e.currentTarget.style.background = "#3a3a3a"; }}
        onMouseLeave={e => { e.currentTarget.style.background = hasPrev ? "#272727" : "#2a2a2a"; }}
      >⏮ Previous</button>

      <AutoplayToggle />

      <button onClick={goNext} disabled={!hasNext}
        style={{ display: "flex", alignItems: "center", gap: "6px", background: hasNext ? "#ff0000" : "#2a2a2a", border: "none", color: hasNext ? "white" : "#555", borderRadius: "20px", padding: "8px 18px", cursor: hasNext ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: "600" }}
        onMouseEnter={e => { if (hasNext) e.currentTarget.style.background = "#cc0000"; }}
        onMouseLeave={e => { e.currentTarget.style.background = hasNext ? "#ff0000" : "#2a2a2a"; }}
      >Next ⏭</button>
    </div>
  );

  /* ── Title + channel + actions ── */
  const MetaSection = () => (
    <>
      <div style={{ color: "white", fontWeight: "700", fontSize: isMobile ? "15px" : "18px", lineHeight: "1.4", marginTop: "14px" }}>
        {videoTitle}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
        {/* Channel */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(channelName)}&background=random&size=40`}
            alt={channelName}
            style={{ width: "40px", height: "40px", borderRadius: "50%" }}
          />
          <div>
            <div style={{ color: "white", fontWeight: "600", fontSize: "15px" }}>{channelName}</div>
            <div style={{ color: "#aaa", fontSize: "12px" }}>1.2M subscribers</div>
          </div>
          <button
            onClick={() => handleSubscribe(channelName)}
            style={{
              background: subscribedChannels.has(channelName) ? "#272727" : "white",
              color:      subscribedChannels.has(channelName) ? "white"   : "black",
              border: "none", borderRadius: "20px", padding: "8px 18px",
              fontWeight: "700", cursor: "pointer", fontSize: "14px", marginLeft: "8px",
            }}
          >
            {subscribedChannels.has(channelName) ? "✓ Subscribed" : "Subscribe"}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#272727", borderRadius: "20px", overflow: "hidden" }}>
            <button
              onClick={() => { setIsLiked(l => !l); if (isDisliked) setIsDisliked(false); }}
              style={{ background: isLiked ? "#3ea6ff22" : "transparent", border: "none", color: isLiked ? "#3ea6ff" : "white", padding: "8px 16px", cursor: "pointer", fontSize: "14px", borderRight: "1px solid #3a3a3a" }}
            >👍 {(likeCount + (isLiked ? 1 : 0)).toLocaleString()}</button>
            <button
              onClick={() => { setIsDisliked(d => !d); if (isLiked) setIsLiked(false); }}
              style={{ background: isDisliked ? "#ff444422" : "transparent", border: "none", color: isDisliked ? "#ff4444" : "white", padding: "8px 16px", cursor: "pointer", fontSize: "14px" }}
            >👎</button>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`); alert("Link copied!"); }}
            style={{ background: "#272727", border: "none", color: "white", borderRadius: "20px", padding: "8px 16px", cursor: "pointer", fontSize: "14px" }}
          >🔗 Share</button>
          <button
            onClick={onClose}
            style={{ background: "#272727", border: "none", color: "#aaa", borderRadius: "20px", padding: "8px 16px", cursor: "pointer", fontSize: "13px" }}
          >✕ Close</button>
        </div>
      </div>

      {/* Description */}
      {description !== null && (
        <div
          style={{ background: "#272727", borderRadius: "12px", padding: "14px 16px", marginTop: "14px", color: "#ccc", fontSize: "14px", lineHeight: "1.6", cursor: "pointer" }}
          onClick={() => setShowFullDesc(s => !s)}
        >
          {publishedAt && (
            <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px" }}>
              {new Date(publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
          <p style={{ margin: 0, display: showFullDesc ? "block" : "-webkit-box", WebkitLineClamp: showFullDesc ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: showFullDesc ? "visible" : "hidden" }}>
            {description || "No description available."}
          </p>
          <span style={{ color: "white", fontWeight: "600", fontSize: "13px", marginTop: "6px", display: "block" }}>
            {showFullDesc ? "Show less" : "...more"}
          </span>
        </div>
      )}
    </>
  );

  /* ── Comments ── */
  const CommentSection = () => (
    <div style={{ marginTop: "28px", paddingBottom: "40px" }}>
      <div style={{ color: "white", fontWeight: "600", fontSize: "16px", marginBottom: "20px" }}>
        {comments.length} Comments
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0, background: "#3a86ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "12px" }}>YO</div>
        <div style={{ flex: 1 }}>
          <input
            value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addComment()}
            placeholder="Add a comment..."
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #555", color: "white", fontSize: "14px", padding: "8px 0", outline: "none", boxSizing: "border-box" }}
            onFocus={e  => e.target.style.borderBottomColor = "#fff"}
            onBlur={e   => e.target.style.borderBottomColor = "#555"}
          />
          {newComment.trim() && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button onClick={() => setNewComment("")} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
              <button onClick={addComment} style={{ background: "#3ea6ff", border: "none", color: "black", borderRadius: "20px", padding: "6px 16px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}>Comment</button>
            </div>
          )}
        </div>
      </div>
      {comments.map(c => (
        <div key={c.id} style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0, background: getColor(c.avatar), display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: "700", fontSize: "11px" }}>{c.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ color: "white", fontWeight: "600", fontSize: "13px" }}>{c.user}</span>
              <span style={{ color: "#aaa", fontSize: "12px" }}>{c.time}</span>
            </div>
            <p style={{ color: "#ccc", fontSize: "14px", margin: "0 0 6px", lineHeight: "1.5" }}>{c.text}</p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => toggleCommentLike(c.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: likedComments.has(c.id) ? "#3ea6ff" : "#aaa", fontSize: "13px" }}>
                👍 {c.likes}
              </button>
              <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>👎</span>
              <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>Reply</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Related sidebar (desktop) ── */
  const RelatedSidebar = () => {
    const relatedList = suggestions.filter((_, i) => i !== currentIndex);
    return (
      <div style={{
        width: isMobile ? "100%" : "402px", flexShrink: 0,
        position: isMobile ? "relative" : "sticky", top: "0px",
        height: isMobile ? "auto" : "calc(100vh - 52px)",
        overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#555 transparent",
        background: "#0f0f0f", borderLeft: isMobile ? "none" : "1px solid #1e1e1e",
        padding: "12px 10px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <span style={{ color: "white", fontWeight: "700", fontSize: "14px" }}>Up Next</span>
          <AutoplayToggle />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {relatedList.map((s) => {
            const realIdx  = suggestions.indexOf(s);
            const isYTItem = !!s.snippet;
            const thumb    = isYTItem ? s.snippet.thumbnails.medium.url : s.thumbnail;
            const title    = isYTItem ? s.snippet.title                  : s.title;
            const channel  = isYTItem ? s.snippet.channelTitle           : s.channel;
            const hasVid   = isYTItem && !!s.id?.videoId;
            return (
              <div
                key={s.id?.videoId || s.id || realIdx}
                onClick={() => hasVid && goTo(realIdx)}
                style={{ display: "flex", gap: "8px", cursor: hasVid ? "pointer" : "default", borderRadius: "8px", padding: "4px", transition: "background 0.2s", opacity: hasVid ? 1 : 0.5 }}
                onMouseEnter={e => { if (hasVid) e.currentTarget.style.background = "#1e1e1e"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ position: "relative", flexShrink: 0, width: "168px", height: "94px", borderRadius: "8px", overflow: "hidden", background: "#222" }}>
                  <img src={thumb} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  {isYTItem && <div style={{ position: "absolute", top: "4px", left: "4px", background: "#ff0000", color: "#fff", fontSize: "8px", fontWeight: "700", padding: "1px 5px", borderRadius: "3px" }}>▶ YT</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                  <div style={{ color: "white", fontSize: "13px", fontWeight: "600", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "4px" }}>{title}</div>
                  <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "2px" }}>{channel}</div>
                  {isYTItem && s.snippet.publishedAt && (
                    <div style={{ color: "#aaa", fontSize: "12px" }}>
                      {new Date(s.snippet.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ════ MOBILE ════ */
  if (isMobile) {
    return (
      <>
        <style>{`
          .hp-watch-mobile { position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999; background:#0f0f0f; display:flex; flex-direction:column; font-family:'Segoe UI',sans-serif; height:100dvh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        `}</style>
        <div className="hp-watch-mobile">
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", background: "#111", borderBottom: "1px solid #1e1e1e", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>←</button>
            <span style={{ color: "#fff", fontWeight: "600", fontSize: "13px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoTitle}</span>
            <span style={{ background: "#ff0000", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "4px" }}>▶ YT</span>
          </div>
          <PlayerBox />
          <div style={{ padding: "0 12px" }}>
            <NavBar />
            <MetaSection />
            <CommentSection />
          </div>
          <RelatedSidebar />
        </div>
      </>
    );
  }

  /* ════ DESKTOP ════ */
  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#555;border-radius:4px;}`}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0f0f0f", display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden" }}>

        {/* Desktop top bar */}
        <div style={{ height: "52px", flexShrink: 0, background: "#111", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", padding: "0 16px", gap: "10px" }}>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px 10px", borderRadius: "6px", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#222"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#aaa"; }}
          >←</button>
          <div style={{ width: "1px", height: "20px", background: "#2a2a2a" }} />
          <span style={{ color: "white", fontWeight: "600", fontSize: "14px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoTitle}</span>
          <span style={{ background: "#ff0000", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "4px", flexShrink: 0 }}>▶ YouTube</span>
        </div>

        {/* Body: left content + right sidebar */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", minWidth: 0, scrollbarWidth: "thin", scrollbarColor: "#555 transparent" }}>
            <PlayerBox />
            <NavBar />
            <MetaSection />
            <CommentSection />
          </div>

          {/* Right */}
          <RelatedSidebar />
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   HOME PAGE
───────────────────────────────────────────────────────────── */
const HomePage = ({ sideNavbar }) => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState("All");
  const [ytVideos,   setYtVideos]   = useState([]);
  const [ytLoading,  setYtLoading]  = useState(false);
  const [watchVideo, setWatchVideo] = useState(null);

  const options = [
    "All","DD News", "Kapil Sharma Show", "Hindi Movies", "Hindi News","English News","Film Criticisms","Twenty20 Cricket","Music","Live",
    "Mixes","Gaming","Debates","Coke Studio India","Democracy","Pakistani Dramas","Pakistani Movies",
    "Comedy","Podcasts","Kapil Sharma Show","WWE","Superhero Movies","Dramedy","Web Development","Hollywood Movies","Dubbed Hollywood Movies","Web Series",
    "Professional Wrestling","Bhojpuri Cinema","Bhojpuri Songs","Superhero Movies","Astronomy",
    "AI","History","Geographical Videos","National Geography","Kapil Sharma Show","Indian Music","Indian Movies","Recently Uploaded","Watched",
  ];

  useEffect(() => { fetchYouTubeByTopic(selectedOption); }, [selectedOption]);

  const fetchYouTubeByTopic = async (topic) => {
    if (["All","Recently Uploaded","Watched"].includes(topic)) { setYtVideos([]); return; }
    setYtLoading(true); setYtVideos([]);
    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { part: "snippet", q: topic, type: "video", maxResults: 50, order: "relevance", key: API_KEYS[keyIndex] },
        });
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

  const openWatchPage = (videoId, title, channel) => {
    setWatchVideo({ videoId, title, channel });
    document.body.style.overflow = "hidden";
  };

  const closeWatchPage = () => {
    setWatchVideo(null);
    document.body.style.overflow = "unset";
  };

  const getSuggestions = () => [...ytVideos.slice(0, 20), ...videos.slice(0, 12)];
  const filteredVideos  = selectedOption === "All" ? videos : videos.filter(v => v.tags?.includes(selectedOption));

  const ShortsRow = ({ data, title }) => (
    <div className="homePage_shortsSection">
      <div className="homePage_shortsHeader"><span className="homePage_shortsTitle">🎬 {title}</span></div>
      <div className="homePage_shortsRow">
        {data.map(short => (
          <div key={short.id} className="homePage_shortCard" onClick={() => navigate("/reels", { state: { reelId: short.id } })} style={{ cursor: "pointer" }}>
            <div className="homePage_shortThumbnail">
              <img src={short.thumbnail} alt={short.user} className="homePage_shortImg" />
              <div className="homePage_shortPlay">▶</div>
              <div className="homePage_shortDuration">{short.duration}</div>
            </div>
            <div className="homePage_shortTitle">{short.title}</div>
            <Link to={`/user/${short.username}`} onClick={e => e.stopPropagation()} style={{ textDecoration: "none", color: "#aaa", fontSize: "13px" }}>
              <div className="homePage_shortUser">{short.user}</div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );

  const VideoCard = ({ video }) => (
    <div className="youtube_thumbnailBox">
      <Link to={`/video/${video.id}`} className="youtube_thumbnailWrapper">
        <img src={video.thumbnail} alt={video.title} className="youtube_thumbnailPic" />
        <div className="youtube_timingThumbnail">{video.duration}</div>
      </Link>
      <div className="youtubeTitleBox">
        <div className="youtubeBoxProfile">
          <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${video.channel}`} alt={video.channel} className="youtube_thumbnail_Profile" />
          <Link to={`/user/${video.channel.toLowerCase()}`} style={{ textDecoration: "none", color: "inherit" }}>
            <p className="youtube_ChannelName">{video.channel}</p>
          </Link>
        </div>
        <div className="youtubeVideoInfo">
          <p className="youtube_videoTitle">{video.title}</p>
          <p className="youtubeVideo_Views">3 Likes</p>
        </div>
      </div>
    </div>
  );

  const YouTubeVideoCard = ({ item }) => (
    <div className="youtube_thumbnailBox" style={{ cursor: "pointer" }} onClick={() => openWatchPage(item.id.videoId, item.snippet.title, item.snippet.channelTitle)}>
      <div className="youtube_thumbnailWrapper" style={{ position: "relative", display: "block" }}>
        <img src={item.snippet.thumbnails.medium.url} alt={item.snippet.title} className="youtube_thumbnailPic" />
        <div style={{ position: "absolute", top: "8px", left: "8px", background: "#ff0000", color: "white", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "4px" }}>▶ YouTube</div>
      </div>
      <div className="youtubeTitleBox">
        <div className="youtubeBoxProfile">
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.snippet.channelTitle)}&background=random&size=36`} alt={item.snippet.channelTitle} className="youtube_thumbnail_Profile" />
          <p className="youtube_ChannelName">{item.snippet.channelTitle}</p>
        </div>
        <div className="youtubeVideoInfo">
          <p className="youtube_videoTitle">{item.snippet.title}</p>
          <p className="youtubeVideo_Views">{new Date(item.snippet.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      </div>
    </div>
  );

  const SkeletonCard = () => (
    <div className="youtube_thumbnailBox">
      <div style={{ width: "100%", paddingTop: "56.25%", background: "#272727", borderRadius: "12px", animation: "pulse 1.5s infinite" }} />
      <div style={{ padding: "10px 4px", display: "flex", gap: "10px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#272727", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: "14px", background: "#272727", borderRadius: "4px", marginBottom: "8px", animation: "pulse 1.5s infinite" }} />
          <div style={{ height: "12px", background: "#272727", borderRadius: "4px", width: "60%", animation: "pulse 1.5s infinite" }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="homePage">
      <div className={`homePage_options ${sideNavbar ? "sidebar-open" : ""}`}>
        <div className="homePage_options_track">
          {options.map(item => (
            <div key={item} className="homePage_option" onClick={() => setSelectedOption(item)}
              style={{ cursor: "pointer", background: selectedOption === item ? "white" : "transparent", color: selectedOption === item ? "black" : "white", borderRadius: "8px", padding: "6px 12px", fontWeight: selectedOption === item ? "600" : "400", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className={`home_mainPage ${sideNavbar ? "sidebar-open" : "sidebar-closed"}`}>
        {selectedOption === "All" ? (
          Array.from({ length: Math.ceil(reelsData.length / 6) }).map((_, rowIndex) => {
            const start = rowIndex * 5; const end = start + 9;
            const vStart = rowIndex * 8; const vEnd = vStart + 12;
            return (
              <React.Fragment key={rowIndex}>
                <ShortsRow data={reelsData.slice(start, end)} title={rowIndex === 0 ? "Shorts" : "More Shorts"} />
                {filteredVideos.slice(vStart, vEnd).length > 0 && (
                  <div className="youtube_VideoGrid">
                    {filteredVideos.slice(vStart, vEnd).map(v => <VideoCard key={v.id} video={v} />)}
                  </div>
                )}
              </React.Fragment>
            );
          })
        ) : (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <span style={{ fontSize: "20px" }}>{ytLoading ? "⏳" : "🔎"}</span>
              <h2 style={{ color: "white", fontSize: "18px", fontWeight: "700", margin: 0 }}>{selectedOption}</h2>
              {ytLoading && <span style={{ color: "#aaa", fontSize: "13px" }}>— loading YouTube results...</span>}
            </div>
            {filteredVideos.length > 0 && (
              <div style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ background: "#272727", color: "#aaa", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px" }}>🎬 LOCAL VIDEOS</span>
                  <span style={{ color: "#555", fontSize: "12px" }}>{filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="youtube_VideoGrid">{filteredVideos.map(v => <VideoCard key={v.id} video={v} />)}</div>
              </div>
            )}
            {ytLoading && (
              <div style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ background: "#ff000022", color: "#ff4444", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px" }}>▶ YOUTUBE</span>
                  <span style={{ color: "#555", fontSize: "12px" }}>fetching...</span>
                </div>
                <div className="youtube_VideoGrid">{[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}</div>
              </div>
            )}
            {!ytLoading && ytVideos.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ background: "#ff000022", color: "#ff4444", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px" }}>▶ YOUTUBE</span>
                  <span style={{ color: "#555", fontSize: "12px" }}>{ytVideos.length} videos</span>
                </div>
                <div className="youtube_VideoGrid">{ytVideos.map(item => <YouTubeVideoCard key={item.id.videoId} item={item} />)}</div>
              </div>
            )}
            {!ytLoading && filteredVideos.length === 0 && ytVideos.length === 0 && (
              <div style={{ textAlign: "center", marginTop: "80px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
                <p style={{ color: "#555", fontSize: "16px" }}>No videos found for "<span style={{ color: "#aaa" }}>{selectedOption}</span>"</p>
                <p style={{ color: "#444", fontSize: "13px", marginTop: "8px" }}>Try selecting a different category</p>
              </div>
            )}
          </div>
        )}
      </div>

      {watchVideo && (
        <WatchPage
          initialVideoId={watchVideo.videoId}
          initialTitle={watchVideo.title}
          initialChannel={watchVideo.channel}
          onClose={closeWatchPage}
          suggestions={getSuggestions()}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
};

export default HomePage;