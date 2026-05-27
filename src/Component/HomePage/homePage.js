import React, { useState, useEffect, useRef } from "react";
import "./homePage.css";
import { reelsData } from "../Reels/reels";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";

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
  {
    id: 13,
    thumbnail: "https://picsum.photos/seed/lion1/320/180",
    title: "3D Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    tags: ["Film Criticisms"],
  },
  {
    id: 14,
    thumbnail: "https://picsum.photos/seed/tiger2/320/180",
    title: "Tiger in Wild",
    duration: "45:00",
    channel: "NatureTV",
    tags: ["History"],
  },
  {
    id: 15,
    thumbnail: "https://picsum.photos/seed/forest3/320/180",
    title: "Forest Walk",
    duration: "30:00",
    channel: "EcoWorld",
    tags: ["Live"],
  },
  {
    id: 16,
    thumbnail: "https://picsum.photos/seed/ocean4/320/180",
    title: "Ocean Waves",
    duration: "15:00",
    channel: "SeaLife",
    tags: ["Live"],
  },
  {
    id: 17,
    thumbnail: "https://picsum.photos/seed/mountain5/320/180",
    title: "Mountain Trek",
    duration: "20:00",
    channel: "Adventures",
    tags: ["Live"],
  },
  {
    id: 18,
    thumbnail: "https://picsum.photos/seed/city6/320/180",
    title: "City Lights",
    duration: "10:00",
    channel: "UrbanVibe",
    tags: ["News"],
  },
  {
    id: 19,
    thumbnail: "https://picsum.photos/seed/sunset7/320/180",
    title: "Sunset Timelapse",
    duration: "05:00",
    channel: "SkyWatch",
    tags: ["Astronomy"],
  },
  {
    id: 20,
    thumbnail: "https://picsum.photos/seed/beach8/320/180",
    title: "Beach Day",
    duration: "12:00",
    channel: "SummerFun",
    tags: ["Live"],
  },
  {
    id: 21,
    thumbnail: "https://picsum.photos/seed/rain9/320/180",
    title: "Rainy Day",
    duration: "08:00",
    channel: "Chill",
    tags: ["Music"],
  },
  {
    id: 22,
    thumbnail: "https://picsum.photos/seed/snow10/320/180",
    title: "Snowfall",
    duration: "25:00",
    channel: "WinterMood",
    tags: ["Live"],
  },
  {
    id: 23,
    thumbnail: "https://picsum.photos/seed/car11/320/180",
    title: "Sports Car Review",
    duration: "18:00",
    channel: "AutoDrive",
    tags: ["News"],
  },
  {
    id: 24,
    thumbnail: "https://picsum.photos/seed/food12/320/180",
    title: "Pasta Recipe",
    duration: "22:00",
    channel: "ChefLife",
    tags: ["Mixes"],
  },
  {
    id: 25,
    thumbnail: "https://picsum.photos/seed/tech13/320/180",
    title: "Latest Gadgets",
    duration: "35:00",
    channel: "TechZone",
    tags: ["AI", "Web Development"],
  },
  {
    id: 26,
    thumbnail: "https://picsum.photos/seed/space14/320/180",
    title: "Space Exploration",
    duration: "40:00",
    channel: "NASAFan",
    tags: ["Astronomy"],
  },
  {
    id: 27,
    thumbnail: "https://picsum.photos/seed/dog15/320/180",
    title: "Cute Dogs Compilation",
    duration: "14:00",
    channel: "PetPals",
    tags: ["Comedy"],
  },
  {
    id: 28,
    thumbnail: "https://picsum.photos/seed/cat16/320/180",
    title: "Funny Cats",
    duration: "11:00",
    channel: "MeowTime",
    tags: ["Comedy"],
  },
  {
    id: 29,
    thumbnail: "https://picsum.photos/seed/workout17/320/180",
    title: "Morning Workout",
    duration: "28:00",
    channel: "FitLife",
    tags: ["Live"],
  },
  {
    id: 30,
    thumbnail: "https://picsum.photos/seed/yoga18/320/180",
    title: "Yoga for Beginners",
    duration: "45:00",
    channel: "ZenMode",
    tags: ["Live"],
  },
  {
    id: 31,
    thumbnail: "https://picsum.photos/seed/music19/320/180",
    title: "Lo-Fi Music Mix",
    duration: "60:00",
    channel: "LoFiBeats",
    tags: ["Music", "Mixes"],
  },
  {
    id: 32,
    thumbnail: "https://picsum.photos/seed/travel20/320/180",
    title: "Travel Vlog: Japan",
    duration: "55:00",
    channel: "GlobeTrotter",
    tags: ["Live"],
  },
  {
    id: 33,
    thumbnail: "https://picsum.photos/seed/art21/320/180",
    title: "Painting Tutorial",
    duration: "50:00",
    channel: "ArtStudio",
    tags: ["Mixes"],
  },
  {
    id: 34,
    thumbnail: "https://picsum.photos/seed/code22/320/180",
    title: "Learn JavaScript",
    duration: "90:00",
    channel: "DevHQ",
    tags: ["Web Development"],
  },
  {
    id: 35,
    thumbnail: "https://picsum.photos/seed/bird23/320/180",
    title: "Birds of Paradise",
    duration: "16:00",
    channel: "WildBirds",
    tags: ["History"],
  },
  {
    id: 36,
    thumbnail: "https://picsum.photos/seed/river24/320/180",
    title: "River Kayaking",
    duration: "32:00",
    channel: "OutdoorX",
    tags: ["Live"],
  },
  {
    id: 37,
    thumbnail: "https://picsum.photos/seed/night25/320/180",
    title: "Night Sky Photography",
    duration: "38:00",
    channel: "StarGazer",
    tags: ["Astronomy"],
  },
  {
    id: 38,
    thumbnail: "https://picsum.photos/seed/coffee26/320/180",
    title: "Coffee Art Tips",
    duration: "09:00",
    channel: "BrewMaster",
    tags: ["Mixes"],
  },
  {
    id: 39,
    thumbnail: "https://picsum.photos/seed/book27/320/180",
    title: "Book Review",
    duration: "20:00",
    channel: "ReadMore",
    tags: ["History"],
  },
  {
    id: 40,
    thumbnail: "https://picsum.photos/seed/game28/320/180",
    title: "Gaming Highlights",
    duration: "42:00",
    channel: "ProGamer",
    tags: ["Gaming"],
  },
  {
    id: 41,
    thumbnail: "https://picsum.photos/seed/drone29/320/180",
    title: "Drone Footage",
    duration: "17:00",
    channel: "SkyView",
    tags: ["Astronomy"],
  },
  {
    id: 42,
    thumbnail: "https://picsum.photos/seed/history30/320/180",
    title: "Ancient Civilizations",
    duration: "65:00",
    channel: "HistoryBuff",
    tags: ["History"],
  },
  {
    id: 43,
    thumbnail: "https://picsum.photos/seed/garden31/320/180",
    title: "Garden Tips",
    duration: "23:00",
    channel: "GreenThumb",
    tags: ["Live"],
  },
  {
    id: 44,
    thumbnail: "https://picsum.photos/seed/fish32/320/180",
    title: "Deep Sea Creatures",
    duration: "44:00",
    channel: "OceanDepth",
    tags: ["History"],
  },
  {
    id: 45,
    thumbnail: "https://picsum.photos/seed/bike33/320/180",
    title: "Mountain Biking",
    duration: "31:00",
    channel: "BikePro",
    tags: ["Live"],
  },
  {
    id: 46,
    thumbnail: "https://picsum.photos/seed/sky34/320/180",
    title: "Cloud Formations",
    duration: "07:00",
    channel: "WeatherNerd",
    tags: ["Astronomy"],
  },
  {
    id: 47,
    thumbnail: "https://picsum.photos/seed/market35/320/180",
    title: "Street Market Tour",
    duration: "27:00",
    channel: "FoodieWalks",
    tags: ["DD News"],
  },
  {
    id: 48,
    thumbnail: "https://picsum.photos/seed/dance36/320/180",
    title: "Dance Choreography",
    duration: "13:00",
    channel: "DanceFloor",
    tags: ["Indian Music", "Music"],
  },
  {
    id: 49,
    thumbnail: "https://picsum.photos/seed/photo37/320/180",
    title: "Photography Masterclass",
    duration: "75:00",
    channel: "LensCraft",
    tags: ["Mixes"],
  },
  {
    id: 50,
    thumbnail: "https://picsum.photos/seed/desk38/320/180",
    title: "Desk Setup Tour",
    duration: "19:00",
    channel: "SetupGoals",
    tags: ["Web Development"],
  },
  {
    id: 51,
    thumbnail: "https://picsum.photos/seed/swim39/320/180",
    title: "Swimming Tips",
    duration: "36:00",
    channel: "AquaLife",
    tags: ["Live"],
  },
  {
    id: 52,
    thumbnail: "https://picsum.photos/seed/volcano40/320/180",
    title: "Volcanic Eruption",
    duration: "48:00",
    channel: "GeoWatch",
    tags: ["Astronomy", "News"],
  },
  {
    id: 53,
    thumbnail: "https://picsum.photos/seed/farm41/320/180",
    title: "Farm Life Vlog",
    duration: "53:00",
    channel: "RuralDays",
    tags: ["DD News"],
  },
  {
    id: 54,
    thumbnail: "https://picsum.photos/seed/robot42/320/180",
    title: "AI & Robotics",
    duration: "58:00",
    channel: "FutureTech",
    tags: ["AI"],
  },
  {
    id: 55,
    thumbnail: "https://picsum.photos/seed/horse43/320/180",
    title: "Horse Riding Basics",
    duration: "41:00",
    channel: "EquineLife",
    tags: ["Live"],
  },
  {
    id: 56,
    thumbnail: "https://picsum.photos/seed/dessert44/320/180",
    title: "Chocolate Cake Recipe",
    duration: "26:00",
    channel: "SweetBakes",
    tags: ["Mixes"],
  },
  {
    id: 57,
    thumbnail: "https://picsum.photos/seed/waterfall45/320/180",
    title: "Waterfall Hike",
    duration: "33:00",
    channel: "NatureWalks",
    tags: ["Live"],
  },
  {
    id: 58,
    thumbnail: "https://picsum.photos/seed/candle46/320/180",
    title: "DIY Candle Making",
    duration: "21:00",
    channel: "CraftCorner",
    tags: ["Mixes"],
  },
  {
    id: 59,
    thumbnail: "https://picsum.photos/seed/castle47/320/180",
    title: "Castle Exploration",
    duration: "67:00",
    channel: "HistoricPlaces",
    tags: ["History"],
  },
  {
    id: 60,
    thumbnail: "https://picsum.photos/seed/surf48/320/180",
    title: "Surfing Lessons",
    duration: "29:00",
    channel: "WaveRider",
    tags: ["Live"],
  },
  {
    id: 61,
    thumbnail: "https://picsum.photos/seed/jungle49/320/180",
    title: "Jungle Safari",
    duration: "72:00",
    channel: "WildExplorer",
    tags: ["History"],
  },
  {
    id: 62,
    thumbnail: "https://picsum.photos/seed/aurora50/320/180",
    title: "Northern Lights",
    duration: "15:00",
    channel: "ArcticVision",
    tags: ["Astronomy"],
  },
];

const MOCK_COMMENTS = [
  {
    id: 1,
    user: "Ravi Kumar",
    avatar: "RK",
    text: "This is absolutely amazing content! Keep it up 🔥",
    likes: 142,
    time: "2 days ago",
  },
  {
    id: 2,
    user: "Priya Sharma",
    avatar: "PS",
    text: "Really informative, learned so much from this video.",
    likes: 87,
    time: "1 day ago",
  },
  {
    id: 3,
    user: "Arjun Mehta",
    avatar: "AM",
    text: "The editing on this is top notch. Subscribed!",
    likes: 56,
    time: "5 hours ago",
  },
  {
    id: 4,
    user: "Sneha Patel",
    avatar: "SP",
    text: "Been waiting for a video like this!",
    likes: 34,
    time: "3 hours ago",
  },
  {
    id: 5,
    user: "Dev_Codes",
    avatar: "DC",
    text: "Bookmarked this. Will rewatch multiple times 📌",
    likes: 29,
    time: "1 hour ago",
  },
  {
    id: 6,
    user: "NatureLover99",
    avatar: "NL",
    text: "The visuals are stunning. What camera do you use?",
    likes: 18,
    time: "45 mins ago",
  },
  {
    id: 7,
    user: "TechWithVik",
    avatar: "TV",
    text: "Explained in the simplest way possible. Respect 🙏",
    likes: 11,
    time: "20 mins ago",
  },
];

const avatarColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
];
const getColor = (str) =>
  avatarColors[(str || "A").charCodeAt(0) % avatarColors.length];

// Format view counts like YouTube: 1.2K, 3.4M, etc.
const formatViews = (n) => {
  if (!n || n === 0) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
  return n + " views";
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

// =============================================================
//  WATCH PAGE (YouTube embed overlay)
// =============================================================
const WatchPage = ({
  initialVideoId,
  initialTitle,
  initialChannel,
  onClose,
  suggestions,
}) => {
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
  const channelName = isYT
    ? item.snippet.channelTitle
    : (item?.channel ?? initialChannel);
  const publishedAt = isYT ? item.snippet.publishedAt : null;
  const description = isYT ? item.snippet.description : null;

  const goTo = (idx) => {
    setCurrentIndex(Math.max(0, Math.min(idx, suggestions.length - 1)));
    setIsLiked(false);
    setIsDisliked(false);
    setShowFullDesc(false);
  };

  const hasPrev = suggestions.slice(0, currentIndex).some((s) => s.id?.videoId);
  const hasNext = suggestions
    .slice(currentIndex + 1)
    .some((s) => s.id?.videoId);

  const goPrev = () => {
    const rel = [...suggestions.slice(0, currentIndex)]
      .reverse()
      .findIndex((s) => s.id?.videoId);
    if (rel >= 0) goTo(currentIndex - 1 - rel);
  };
  const goNext = () => {
    const rel = suggestions
      .slice(currentIndex + 1)
      .findIndex((s) => s.id?.videoId);
    if (rel >= 0) goTo(currentIndex + 1 + rel);
  };

  const handleSubscribe = (ch) => {
    setSubscribedChannels((prev) => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments((prev) => [
      {
        id: Date.now(),
        user: "You",
        avatar: "YO",
        text: newComment.trim(),
        likes: 0,
        time: "Just now",
      },
      ...prev,
    ]);
    setNewComment("");
  };

  const toggleCommentLike = (id) => {
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setComments((c) =>
          c.map((x) => (x.id === id ? { ...x, likes: x.likes - 1 } : x)),
        );
      } else {
        next.add(id);
        setComments((c) =>
          c.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)),
        );
      }
      return next;
    });
  };

  const Player = () => (
    <div
      style={{
        width: "100%",
        position: "relative",
        paddingBottom: "56.25%",
        height: 0,
        overflow: "hidden",
        background: "#000",
        borderRadius: isMobile ? "0" : "12px",
        flexShrink: 0,
      }}
    >
      <iframe
        key={videoId}
        src={
          "https://www.youtube.com/embed/" +
          videoId +
          "?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
        }
        title={videoTitle}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );

  const AutoplayToggle = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ color: "#aaa", fontSize: "13px" }}>Autoplay</span>
      <div
        onClick={() => setAutoplay((a) => !a)}
        style={{
          width: "44px",
          height: "24px",
          background: autoplay ? "#ff0000" : "#555",
          borderRadius: "12px",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.3s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            background: "white",
            borderRadius: "50%",
            position: "absolute",
            top: "3px",
            left: autoplay ? "23px" : "3px",
            transition: "left 0.3s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>
      <span
        style={{
          color: autoplay ? "#ff0000" : "#555",
          fontSize: "12px",
          fontWeight: "600",
        }}
      >
        {autoplay ? "ON" : "OFF"}
      </span>
    </div>
  );

  const NavBar = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#181818",
        borderRadius: "10px",
        padding: "10px 16px",
        marginTop: "10px",
        gap: "8px",
      }}
    >
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        style={{
          background: hasPrev ? "#272727" : "#2a2a2a",
          border: "none",
          color: hasPrev ? "white" : "#555",
          borderRadius: "20px",
          padding: "8px 18px",
          cursor: hasPrev ? "pointer" : "not-allowed",
          fontSize: "14px",
          fontWeight: "600",
          whiteSpace: "nowrap",
        }}
      >
        ⏮ Previous
      </button>
      <AutoplayToggle />
      <button
        onClick={goNext}
        disabled={!hasNext}
        style={{
          background: hasNext ? "#ff0000" : "#2a2a2a",
          border: "none",
          color: hasNext ? "white" : "#555",
          borderRadius: "20px",
          padding: "8px 18px",
          cursor: hasNext ? "pointer" : "not-allowed",
          fontSize: "14px",
          fontWeight: "600",
          whiteSpace: "nowrap",
        }}
      >
        Next ⏭
      </button>
    </div>
  );

  const MetaSection = () => (
    <div style={{ padding: isMobile ? "0 12px" : "0" }}>
      <div
        style={{
          color: "white",
          fontWeight: "700",
          fontSize: isMobile ? "15px" : "18px",
          lineHeight: "1.4",
          marginTop: "14px",
        }}
      >
        {videoTitle}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(channelName) +
              "&background=random&size=40"
            }
            alt={channelName}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{ color: "white", fontWeight: "600", fontSize: "15px" }}
            >
              {channelName}
            </div>
            <div style={{ color: "#aaa", fontSize: "12px" }}>
              1.2M subscribers
            </div>
          </div>
          <button
            onClick={() => handleSubscribe(channelName)}
            style={{
              background: subscribedChannels.has(channelName)
                ? "#272727"
                : "white",
              color: subscribedChannels.has(channelName) ? "white" : "black",
              border: "none",
              borderRadius: "20px",
              padding: "8px 18px",
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "14px",
              marginLeft: "4px",
              whiteSpace: "nowrap",
            }}
          >
            {subscribedChannels.has(channelName) ? "✓ Subscribed" : "Subscribe"}
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginTop: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#272727",
            borderRadius: "20px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => {
              setIsLiked((l) => !l);
              if (isDisliked) setIsDisliked(false);
            }}
            style={{
              background: isLiked ? "#3ea6ff22" : "transparent",
              border: "none",
              color: isLiked ? "#3ea6ff" : "white",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
              borderRight: "1px solid #3a3a3a",
            }}
          >
            👍 {(likeCount + (isLiked ? 1 : 0)).toLocaleString()}
          </button>
          <button
            onClick={() => {
              setIsDisliked((d) => !d);
              if (isLiked) setIsLiked(false);
            }}
            style={{
              background: isDisliked ? "#ff444422" : "transparent",
              border: "none",
              color: isDisliked ? "#ff4444" : "white",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            👎
          </button>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              "https://www.youtube.com/watch?v=" + videoId,
            );
            alert("Link copied!");
          }}
          style={{
            background: "#272727",
            border: "none",
            color: "white",
            borderRadius: "20px",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          🔗 Share
        </button>
        <button
          onClick={onClose}
          style={{
            background: "#272727",
            border: "none",
            color: "#aaa",
            borderRadius: "20px",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          ✕ Close
        </button>
      </div>
      {description !== null && (
        <div
          onClick={() => setShowFullDesc((s) => !s)}
          style={{
            background: "#272727",
            borderRadius: "12px",
            padding: "14px 16px",
            marginTop: "14px",
            color: "#ccc",
            fontSize: "14px",
            lineHeight: "1.6",
            cursor: "pointer",
          }}
        >
          {publishedAt && (
            <div
              style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px" }}
            >
              {new Date(publishedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}
          <p
            style={{
              margin: 0,
              display: showFullDesc ? "block" : "-webkit-box",
              WebkitLineClamp: showFullDesc ? "unset" : 2,
              WebkitBoxOrient: "vertical",
              overflow: showFullDesc ? "visible" : "hidden",
            }}
          >
            {description || "No description available."}
          </p>
          <span
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: "13px",
              marginTop: "6px",
              display: "block",
            }}
          >
            {showFullDesc ? "Show less" : "...more"}
          </span>
        </div>
      )}
    </div>
  );

  const CommentSection = () => (
    <div style={{ padding: isMobile ? "0 12px 40px" : "0 0 40px" }}>
      <div
        style={{
          color: "white",
          fontWeight: "600",
          fontSize: "16px",
          margin: "28px 0 20px",
        }}
      >
        {comments.length} Comments
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            flexShrink: 0,
            background: "#3a86ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: "700",
            fontSize: "12px",
          }}
        >
          YO
        </div>
        <div style={{ flex: 1 }}>
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addComment()}
            placeholder="Add a comment..."
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #555",
              color: "white",
              fontSize: "14px",
              padding: "8px 0",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderBottomColor = "#fff")}
            onBlur={(e) => (e.target.style.borderBottomColor = "#555")}
          />
          {newComment.trim() && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => setNewComment("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={addComment}
                style={{
                  background: "#3ea6ff",
                  border: "none",
                  color: "black",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "14px",
                }}
              >
                Comment
              </button>
            </div>
          )}
        </div>
      </div>
      {comments.map((c) => (
        <div
          key={c.id}
          style={{ display: "flex", gap: "12px", marginBottom: "20px" }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              flexShrink: 0,
              background: getColor(c.avatar),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontWeight: "700",
              fontSize: "11px",
            }}
          >
            {c.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span
                style={{ color: "white", fontWeight: "600", fontSize: "13px" }}
              >
                {c.user}
              </span>
              <span style={{ color: "#aaa", fontSize: "12px" }}>{c.time}</span>
            </div>
            <p
              style={{
                color: "#ccc",
                fontSize: "14px",
                margin: "0 0 6px",
                lineHeight: "1.5",
              }}
            >
              {c.text}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => toggleCommentLike(c.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: likedComments.has(c.id) ? "#3ea6ff" : "#aaa",
                  fontSize: "13px",
                }}
              >
                👍 {c.likes}
              </button>
              <span
                style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}
              >
                👎
              </span>
              <span
                style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}
              >
                Reply
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const RelatedSidebar = () => {
    const relatedList = suggestions.filter((_, i) => i !== currentIndex);
    return (
      <div
        style={{
          width: isMobile ? "100%" : "402px",
          flexShrink: 0,
          overflowY: isMobile ? "visible" : "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#555 transparent",
          background: "#0f0f0f",
          borderLeft: isMobile ? "none" : "1px solid #1e1e1e",
          padding: "12px 10px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <span style={{ color: "white", fontWeight: "700", fontSize: "14px" }}>
            Up Next
          </span>
          <AutoplayToggle />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {relatedList.map((s) => {
            const realIdx = suggestions.indexOf(s);
            const isYTItem = !!s.snippet;
            const thumb = isYTItem
              ? s.snippet.thumbnails.medium.url
              : s.thumbnail;
            const title = isYTItem ? s.snippet.title : s.title;
            const channel = isYTItem ? s.snippet.channelTitle : s.channel;
            const hasVid = isYTItem && !!s.id?.videoId;
            return (
              <div
                key={s.id?.videoId || s.id || realIdx}
                onClick={() => hasVid && goTo(realIdx)}
                style={{
                  display: "flex",
                  gap: "8px",
                  cursor: hasVid ? "pointer" : "default",
                  borderRadius: "8px",
                  padding: "4px",
                  transition: "background 0.2s",
                  opacity: hasVid ? 1 : 0.5,
                }}
                onMouseEnter={(e) => {
                  if (hasVid) e.currentTarget.style.background = "#1e1e1e";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    width: "168px",
                    height: "94px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    background: "#222",
                  }}
                >
                  <img
                    src={thumb}
                    alt={title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  {isYTItem && (
                    <div
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "4px",
                        background: "#ff0000",
                        color: "#fff",
                        fontSize: "8px",
                        fontWeight: "700",
                        padding: "1px 5px",
                        borderRadius: "3px",
                      }}
                    >
                      ▶ YT
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
                  <div
                    style={{
                      color: "white",
                      fontSize: "13px",
                      fontWeight: "600",
                      lineHeight: "1.4",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      marginBottom: "4px",
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: "12px",
                      marginBottom: "2px",
                    }}
                  >
                    {channel}
                  </div>
                  {isYTItem && s.snippet?.publishedAt && (
                    <div style={{ color: "#aaa", fontSize: "12px" }}>
                      {new Date(s.snippet.publishedAt).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
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

  if (isMobile) {
    return (
      <>
        <style>
          {
            ".hp-watch-root{position:fixed;top:55px;left:0;right:0;bottom:0;z-index:999;background:#0f0f0f;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch;}.hp-watch-root *{-webkit-transform:none !important;}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"
          }
        </style>
        <div className="hp-watch-root">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "#111",
              borderBottom: "1px solid #1e1e1e",
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "#272727",
                border: "none",
                color: "#fff",
                fontSize: "13px",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "20px",
                fontWeight: "600",
              }}
            >
              ← Back
            </button>
            <span
              style={{
                color: "#fff",
                fontWeight: "600",
                fontSize: "13px",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {videoTitle}
            </span>
            <span
              style={{
                background: "#ff0000",
                color: "#fff",
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              ▶ YT
            </span>
          </div>
          <Player />
          <div style={{ padding: "0 12px" }}>
            <NavBar />
          </div>
          <MetaSection />
          <CommentSection />
          <div style={{ borderTop: "8px solid #181818", marginTop: "8px" }}>
            <RelatedSidebar />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>
        {
          "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#555;border-radius:4px;}"
        }
      </style>
      <div
        style={{
          position: "fixed",
          top: "55px",
          left: "0",
          right: "0",
          bottom: "0",
          zIndex: 999,
          background: "#0f0f0f",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "52px",
            flexShrink: 0,
            background: "#111",
            borderBottom: "1px solid #1e1e1e",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "22px",
              lineHeight: 1,
              padding: "4px 10px",
              borderRadius: "6px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#222";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "#aaa";
            }}
          >
            ←
          </button>
          <div
            style={{ width: "1px", height: "20px", background: "#2a2a2a" }}
          />
          <span
            style={{
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {videoTitle}
          </span>
          <span
            style={{
              background: "#ff0000",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "700",
              padding: "3px 10px",
              borderRadius: "4px",
              flexShrink: 0,
            }}
          >
            ▶ YouTube
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              minWidth: 0,
              scrollbarWidth: "thin",
              scrollbarColor: "#555 transparent",
            }}
          >
            <Player />
            <NavBar />
            <MetaSection />
            <CommentSection />
          </div>
          <div
            style={{
              width: "402px",
              flexShrink: 0,
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#555 transparent",
            }}
          >
            <RelatedSidebar />
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================
//  HOME PAGE
// =============================================================
const HomePage = ({ sideNavbar }) => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState("All");
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

  const [watchedVideos, setWatchedVideos] = useState(() => {
    try {
      const stored = localStorage.getItem("watchedVideos");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const loggedInUsername = localStorage.getItem("username") || "";

  // ── Increment a view count (optimistic + persisted) ──────────
  const incrementView = async (contentId, contentType) => {
    const key = contentType + "_" + contentId;
    setViewCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    try {
      await supabase.rpc("increment_view_count", {
        p_content_id: String(contentId),
        p_content_type: contentType,
      });
    } catch (_) {
      // fail silently
    }
  };

  // ── Mark video watched → removes "New" badge ─────────────────
  const markAsWatched = (videoId) => {
    setWatchedVideos((prev) => {
      const next = new Set(prev);
      next.add(String(videoId));
      try {
        localStorage.setItem("watchedVideos", JSON.stringify([...next]));
      } catch (_) {}
      return next;
    });
  };

  // ── Fetch stored view counts from Supabase ───────────────────
  const fetchViewCounts = async (ids, contentType) => {
    if (!ids || !ids.length) return;
    try {
      const { data, error } = await supabase
        .from("view_counts")
        .select("content_id, count")
        .eq("content_type", contentType)
        .in("content_id", ids.map(String));

      if (error) {
        // Table might not exist — seed zeros so UI shows "0 views"
        const map = {};
        ids.forEach((id) => {
          map[contentType + "_" + id] = 0;
        });
        setViewCounts((prev) => ({ ...prev, ...map }));
        return;
      }

      // Start with 0 for ALL ids, then overwrite with real counts
      const map = {};
      ids.forEach((id) => {
        map[contentType + "_" + id] = 0;
      });
      if (data) {
        data.forEach((r) => {
          map[contentType + "_" + r.content_id] = r.count;
        });
      }
      setViewCounts((prev) => ({ ...prev, ...map }));
    } catch (_) {
      // Seed zeros on any error
      const map = {};
      ids.forEach((id) => {
        map[contentType + "_" + id] = 0;
      });
      setViewCounts((prev) => ({ ...prev, ...map }));
    }
  };

  // ── Category options list ────────────────────────────────────
  const options = [
    "All",
    "DD News",
    "Kapil Sharma Show",
    "Hindi Movies",
    "Hindi News",
    "English News",
    "Film Criticisms",
    "Twenty20 Cricket",
    "Music",
    "Live",
    "Mixes",
    "Gaming",
    "Debates",
    "Coke Studio India",
    "Democracy",
    "Pakistani Dramas",
    "Pakistani Movies",
    "Comedy",
    "Podcasts",
    "WWE",
    "Superhero Movies",
    "Dramedy",
    "Web Development",
    "Hollywood Movies",
    "Dubbed Hollywood Movies",
    "Web Series",
    "Professional Wrestling",
    "Bhojpuri Cinema",
    "Bhojpuri Songs",
    "Astronomy",
    "AI",
    "History",
    "Geographical Videos",
    "National Geography",
    "Indian Music",
    "Indian Movies",
    "Recently Uploaded",
    "Watched",
  ];

  // ── Fetch DB videos ──────────────────────────────────────────
  useEffect(() => {
    const fetchDbVideos = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const formatted = data.map((v) => ({
          id: v.id,
          src: v.video_url,
          thumbnail: v.thumbnail_url,
          title: v.title,
          duration: v.duration || "00:00",
          channel: v.channel,
          username: v.username || v.channel?.toLowerCase() || "unknown",
          tags: [v.category || "All"],
          likes: v.likes ?? 0,   // ← ADD THIS
        }));
        setDbVideos(formatted);
        fetchViewCounts(
          formatted.map((v) => v.id),
          "video",
        );
      }
      setDbLoading(false);
    };
    fetchDbVideos();

    const subscription = supabase
      .channel("videos-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        (payload) => {
          const v = payload.new;
          setDbVideos((prev) => [
            {
              id: v.id,
              src: v.video_url,
              thumbnail: v.thumbnail_url,
              title: v.title,
              duration: v.duration || "00:00",
              channel: v.channel,
              username: v.username || v.channel?.toLowerCase() || "unknown",
              tags: [v.category || "All"],
            },
            ...prev,
          ]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "videos" },
        (payload) => {
          setDbVideos((prev) => prev.filter((v) => v.id !== payload.old.id));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(subscription);
  }, []);

  // ── Fetch DB reels ───────────────────────────────────────────
  useEffect(() => {
    const fetchDbReels = async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const formatted = data.map((r) => ({
          id: "db_" + r.id,
          dbId: r.id,
          src: r.video_url,
          thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99",
          title: r.title || "Untitled",
          duration: r.duration || "00:00",
          user: r.user || r.username || "Unknown",
          username: r.username || "unknown",
          profilePic:
            "https://api.dicebear.com/7.x/initials/svg?seed=" +
            (r.username || "user"),
          description: r.description || "",
          likes: r.likes ?? 0,   // ← already there, make sure it's not null
        }));
        setDbReels(formatted);
        fetchViewCounts(
          formatted.map((r) => r.dbId),
          "reel",
        );
      }
    };
    fetchDbReels();

    const reelsSub = supabase
      .channel("reels-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reels" },
        (payload) => {
          const r = payload.new;
          setDbReels((prev) => [
            {
              id: "db_" + r.id,
              dbId: r.id,
              src: r.video_url,
              thumbnail:
                r.thumbnail || "https://picsum.photos/200/350?random=99",
              title: r.title || "Untitled",
              duration: r.duration || "00:00",
              user: r.user || r.username || "Unknown",
              username: r.username || "unknown",
              profilePic:
                "https://api.dicebear.com/7.x/initials/svg?seed=" +
                (r.username || "user"),
              description: r.description || "",
              likes: r.likes || 0,
            },
            ...prev,
          ]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reels" },
        (payload) => {
          setDbReels((prev) => prev.filter((r) => r.dbId !== payload.old.id));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(reelsSub);
  }, []);

  const allVideos = [...dbVideos, ...videos];
  const allReels = [...dbReels, ...reelsData];

  useEffect(() => {
    fetchYouTubeByTopic(selectedOption);
  }, [selectedOption]);

  // ── Auto-scroll category bar ─────────────────────────────────
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
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, []);

  // ── YouTube search ───────────────────────────────────────────
  const fetchYouTubeByTopic = async (topic) => {
    if (["All", "Recently Uploaded", "Watched"].includes(topic)) {
      setYtVideos([]);
      return;
    }
    setYtLoading(true);
    setYtVideos([]);
    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              q: topic,
              type: "video",
              maxResults: 50,
              order: "relevance",
              key: API_KEYS[keyIndex],
            },
          },
        );
        currentKeyIndex = keyIndex;
        setYtVideos(res.data.items || []);
        break;
      } catch (err) {
        if (err.response?.status === 403) {
          currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        break;
      }
    }
    setYtLoading(false);
  };

  const openWatchPage = (videoId, title, channel) =>
    setWatchVideo({ videoId, title, channel });
  const closeWatchPage = () => setWatchVideo(null);
  const getSuggestions = () => [
    ...ytVideos.slice(0, 20),
    ...allVideos.slice(0, 12),
  ];
  const filteredVideos =
    selectedOption === "All"
      ? allVideos
      : allVideos.filter((v) => v.tags?.includes(selectedOption));

      const handleLikeVideo = async (e, videoId) => {
  e.preventDefault();
  e.stopPropagation();
  try {
    await supabase.rpc("increment_likes", {
      p_table: "videos",
      p_id: videoId,
    });
    setDbVideos((prev) =>
      prev.map((v) => v.id === videoId ? { ...v, likes: (v.likes || 0) + 1 } : v)
    );
  } catch (_) {}
};

  // ── Delete video ─────────────────────────────────────────────
  const handleDeleteVideo = async (e, videoId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this video? This cannot be undone.")) return;
    const { error } = await supabase.from("videos").delete().eq("id", videoId);
    if (!error) setDbVideos((prev) => prev.filter((v) => v.id !== videoId));
    else alert("Failed to delete video.");
  };

  // ── Delete reel ──────────────────────────────────────────────
  const handleDeleteReel = async (e, dbId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this reel? This cannot be undone.")) return;
    const { error } = await supabase.from("reels").delete().eq("id", dbId);
    if (!error) setDbReels((prev) => prev.filter((r) => r.dbId !== dbId));
    else alert("Failed to delete reel.");
  };

  // ── Shorts / Reels row ───────────────────────────────────────
  const ShortsRow = ({ data, title }) => (
    <div className="homePage_shortsSection">
      <div className="homePage_shortsHeader">
        <span className="homePage_shortsTitle">🎬 {title}</span>
      </div>
      <div className="homePage_shortsRow">
        {data.map((short) => {
          const isOwner =
            loggedInUsername && short.username === loggedInUsername;
          const vcKey = short.dbId ? "reel_" + short.dbId : null;
          const views = vcKey ? viewCounts[vcKey] : undefined;
          
          return (
            <div
              key={short.id}
              className="homePage_shortCard"
              style={{ cursor: "pointer", position: "relative" }}
              onClick={() => {
                if (short.dbId) incrementView(short.dbId, "reel");
                navigate("/reels", { state: { clickedReel: short } });
              }}
            >
              {isOwner && short.dbId && (
                <button
                  onClick={(e) => handleDeleteReel(e, short.dbId)}
                  title="Delete reel"
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    zIndex: 10,
                    background: "rgba(220,38,38,0.85)",
                    border: "none",
                    color: "white",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "13px",
                    lineHeight: 1,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  🗑
                </button>
              )}
              <div className="homePage_shortThumbnail">
                <img
                  src={short.thumbnail}
                  alt={short.user}
                  className="homePage_shortImg"
                />
                <div className="homePage_shortPlay">▶</div>
                <div className="homePage_shortDuration">{short.duration}</div>
                {short.dbId && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      left: "4px",
                      background: "rgba(0,0,0,0.75)",
                      color: "white",
                      fontSize: "10px",
                      fontWeight: "600",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    👁 {formatViews(views ?? 0)}
                  </div>
                )}
              </div>
              <div className="homePage_shortTitle">{short.title}</div>
              <Link
                to={"/user/" + short.username}
                onClick={(e) => e.stopPropagation()}
                style={{
                  textDecoration: "none",
                  color: "#aaa",
                  fontSize: "13px",
                }}
              >
                <div className="homePage_shortUser">{short.user}</div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Video card ───────────────────────────────────────────────
  const VideoCard = ({ video, isUploaded = false }) => {
    const isNew = isUploaded && !watchedVideos.has(String(video.id));
    const isOwner =
      isUploaded && loggedInUsername && video.username === loggedInUsername;
    const vcKey = "video_" + video.id;
    const views = viewCounts[vcKey];

    return (
      <div className="youtube_thumbnailBox" style={{ position: "relative" }}>
        {isOwner && (
          <button
            onClick={(e) => handleDeleteVideo(e, video.id)}
            title="Delete video"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              zIndex: 10,
              background: "rgba(220,38,38,0.9)",
              border: "none",
              color: "white",
              borderRadius: "6px",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            🗑 Delete
          </button>
        )}
        <Link
          to={"/video/" + video.id}
          className="youtube_thumbnailWrapper"
          onClick={() => {
            markAsWatched(video.id);
            if (isUploaded) incrementView(video.id, "video");
          }}
        >
          <img
            src={video.thumbnail}
            alt={video.title}
            className="youtube_thumbnailPic"
          />
          <div className="youtube_timingThumbnail">{video.duration}</div>
          {isNew && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "8px",
                background: "#ff6600",
                color: "white",
                fontSize: "10px",
                fontWeight: "700",
                padding: "2px 7px",
                borderRadius: "4px",
              }}
            >
              New
            </div>
          )}
          <div className="youtube_playOverlay">
            <div className="youtube_playButton">▶</div>
          </div>
        </Link>
        <div className="youtubeTitleBox">
          <div className="youtubeBoxProfile">
            <img
              src={
                "https://api.dicebear.com/7.x/initials/svg?seed=" +
                video.channel
              }
              alt={video.channel}
              className="youtube_thumbnail_Profile"
            />
            <Link
              to={"/user/" + video.channel.toLowerCase()}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <p className="youtube_ChannelName">{video.channel}</p>
            </Link>
          </div>
          <div className="youtubeVideoInfo">
            <p className="youtube_videoTitle">{video.title}</p>
            <p
  className="youtubeVideo_Views"
  style={{ display: "flex", gap: "10px", alignItems: "center" }}
>
  {isUploaded ? (
    <>
      <span>👁 {formatViews(views ?? 0)}</span>
      <span style={{ color: "#aaa", fontSize: "11px" }}>•</span>
      <button
        onClick={(e) => handleLikeVideo(e, video.id)}
        style={{
          background: "none",
          border: "none",
          color: "#aaa",
          cursor: "pointer",
          fontSize: "inherit",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}
      >
        👍 {video.likes ?? 0} Likes
      </button>
    </>
  ) : (
    <span>👍 3 Likes</span>
  )}
</p>
          </div>
        </div>
      </div>
    );
  };

  // ── YouTube video card ───────────────────────────────────────
  const YouTubeVideoCard = ({ item }) => (
    <div
      className="youtube_thumbnailBox"
      style={{ cursor: "pointer" }}
      onClick={() =>
        openWatchPage(
          item.id.videoId,
          item.snippet.title,
          item.snippet.channelTitle,
        )
      }
    >
      <div
        className="youtube_thumbnailWrapper"
        style={{ position: "relative", display: "block" }}
      >
        <img
          src={item.snippet.thumbnails.medium.url}
          alt={item.snippet.title}
          className="youtube_thumbnailPic"
        />
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            background: "#ff0000",
            color: "white",
            fontSize: "10px",
            fontWeight: "700",
            padding: "2px 7px",
            borderRadius: "4px",
          }}
        >
          ▶ YouTube
        </div>
      </div>
      <div className="youtubeTitleBox">
        <div className="youtubeBoxProfile">
          <img
            src={
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(item.snippet.channelTitle) +
              "&background=random&size=36"
            }
            alt={item.snippet.channelTitle}
            className="youtube_thumbnail_Profile"
          />
          <p className="youtube_ChannelName">{item.snippet.channelTitle}</p>
        </div>
        <div className="youtubeVideoInfo">
          <p className="youtube_videoTitle">{item.snippet.title}</p>
          <p className="youtubeVideo_Views">
            {new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Skeleton loader card ─────────────────────────────────────
  const SkeletonCard = () => (
    <div className="youtube_thumbnailBox">
      <div
        style={{
          width: "100%",
          paddingTop: "56.25%",
          background: "#272727",
          borderRadius: "12px",
          animation: "pulse 1.5s infinite",
        }}
      />
      <div style={{ padding: "10px 4px", display: "flex", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#272727",
            flexShrink: 0,
            animation: "pulse 1.5s infinite",
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: "14px",
              background: "#272727",
              borderRadius: "4px",
              marginBottom: "8px",
              animation: "pulse 1.5s infinite",
            }}
          />
          <div
            style={{
              height: "12px",
              background: "#272727",
              borderRadius: "4px",
              width: "60%",
              animation: "pulse 1.5s infinite",
            }}
          />
        </div>
      </div>
    </div>
  );

  const SectionLabel = ({ color, bg, text, count }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "14px",
      }}
    >
      <span
        style={{
          background: bg,
          color: color,
          fontSize: "12px",
          fontWeight: "700",
          padding: "3px 10px",
          borderRadius: "20px",
        }}
      >
        {text}
      </span>
      {count !== undefined && (
        <span style={{ color: "#555", fontSize: "12px" }}>
          {count} video{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="homePage">
      <div className={"homePage_options" + (sideNavbar ? " sidebar-open" : "")}>
        <div
          className="homePage_options_track"
          ref={optionsTrackRef}
          onMouseEnter={() => {
            isPausedRef.current = true;
          }}
          onMouseLeave={() => {
            isPausedRef.current = false;
          }}
          onTouchStart={() => {
            isPausedRef.current = true;
          }}
          onTouchEnd={() => {
            setTimeout(() => {
              isPausedRef.current = false;
            }, 1500);
          }}
          onMouseDown={(e) => {
            isPausedRef.current = true;
            const startX = e.pageX - optionsTrackRef.current.offsetLeft;
            const startScroll = optionsTrackRef.current.scrollLeft;
            const onMove = (ev) => {
              const x = ev.pageX - optionsTrackRef.current.offsetLeft;
              optionsTrackRef.current.scrollLeft = startScroll - (x - startX);
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
              setTimeout(() => {
                isPausedRef.current = false;
              }, 1500);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          style={{ cursor: "grab", userSelect: "none" }}
        >
          {options.map((item) => (
            <div
              key={item}
              className="homePage_option"
              onClick={() => setSelectedOption(item)}
              style={{
                cursor: "pointer",
                background: selectedOption === item ? "white" : "transparent",
                color: selectedOption === item ? "black" : "white",
                borderRadius: "8px",
                padding: "6px 12px",
                fontWeight: selectedOption === item ? "600" : "400",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div
        className={
          "home_mainPage" + (sideNavbar ? " sidebar-open" : " sidebar-closed")
        }
      >
        {selectedOption === "All" ? (
          <>
            {(() => {
              const allVids = [
                ...dbVideos.map((v) => ({ ...v, isUploaded: true })),
                ...videos,
              ];
              const rows = [];
              const totalRows = Math.ceil(allVids.length / 12);
              for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
                const vStart = rowIndex * 12;
                const vEnd = vStart + 12;
                const reelStart = rowIndex * 10;
                const reelEnd = reelStart + 10;
                const rowReels = allReels.slice(reelStart, reelEnd);
                rows.push(
                  <React.Fragment key={rowIndex}>
                    {rowReels.length > 0 && (
                      <ShortsRow
                        data={rowReels}
                        title={rowIndex === 0 ? "Shorts" : "More Shorts"}
                      />
                    )}
                    <div className="youtube_VideoGrid">
                      {rowIndex === 0 &&
                        dbLoading &&
                        [...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                      {allVids.slice(vStart, vEnd).map((v) => (
                        <VideoCard
                          key={v.id}
                          video={v}
                          isUploaded={v.isUploaded || false}
                        />
                      ))}
                    </div>
                  </React.Fragment>,
                );
              }
              return rows;
            })()}
          </>
        ) : (
          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <span style={{ fontSize: "20px" }}>
                {ytLoading ? "⏳" : "🔎"}
              </span>
              <h2
                style={{
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "700",
                  margin: 0,
                }}
              >
                {selectedOption}
              </h2>
              {ytLoading && (
                <span style={{ color: "#aaa", fontSize: "13px" }}>
                  — loading YouTube results...
                </span>
              )}
            </div>
            {dbVideos.filter((v) => v.tags?.includes(selectedOption)).length >
              0 && (
              <div style={{ marginBottom: "40px" }}>
                <SectionLabel
                  color="#ff6600"
                  bg="#ff660022"
                  text="⬆ UPLOADED VIDEOS"
                  count={
                    dbVideos.filter((v) => v.tags?.includes(selectedOption))
                      .length
                  }
                />
                <div className="youtube_VideoGrid">
                  {dbVideos
                    .filter((v) => v.tags?.includes(selectedOption))
                    .map((v) => (
                      <VideoCard key={v.id} video={v} isUploaded={true} />
                    ))}
                </div>
              </div>
            )}
            {videos.filter((v) => v.tags?.includes(selectedOption)).length >
              0 && (
              <div style={{ marginBottom: "40px" }}>
                <SectionLabel
                  color="#aaa"
                  bg="#272727"
                  text="🎬 LOCAL VIDEOS"
                  count={
                    videos.filter((v) => v.tags?.includes(selectedOption))
                      .length
                  }
                />
                <div className="youtube_VideoGrid">
                  {videos
                    .filter((v) => v.tags?.includes(selectedOption))
                    .map((v) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                </div>
              </div>
            )}
            {ytLoading && (
              <div style={{ marginBottom: "40px" }}>
                <SectionLabel color="#ff4444" bg="#ff000022" text="▶ YOUTUBE" />
                <div className="youtube_VideoGrid">
                  {[...Array(8)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </div>
            )}
            {!ytLoading && ytVideos.length > 0 && (
              <div>
                <SectionLabel
                  color="#ff4444"
                  bg="#ff000022"
                  text="▶ YOUTUBE"
                  count={ytVideos.length}
                />
                <div className="youtube_VideoGrid">
                  {ytVideos.map((item) => (
                    <YouTubeVideoCard key={item.id.videoId} item={item} />
                  ))}
                </div>
              </div>
            )}
            {!ytLoading &&
              filteredVideos.length === 0 &&
              ytVideos.length === 0 && (
                <div style={{ textAlign: "center", marginTop: "80px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    📭
                  </div>
                  <p style={{ color: "#555", fontSize: "16px" }}>
                    No videos found for "
                    <span style={{ color: "#aaa" }}>{selectedOption}</span>"
                  </p>
                  <p
                    style={{
                      color: "#444",
                      fontSize: "13px",
                      marginTop: "8px",
                    }}
                  >
                    Try selecting a different category
                  </p>
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
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>
    </div>
  );
};

export default HomePage;
