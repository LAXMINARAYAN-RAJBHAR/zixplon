import React, { useState, useRef, useEffect } from "react";
import "./video.css";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ShareIcon from "@mui/icons-material/Share";
import { Link, useParams, useNavigate } from "react-router-dom";

const getVideoType = (src) => {
  if (!src) return "video/mp4";
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  const types = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    wmv: "video/x-ms-wmv",
    flv: "video/x-flv",
    ogg: "video/ogg",
    ogv: "video/ogg",
  };
  return types[ext] || "video/mp4";
};

const isUnsupportedFormat = (src) => {
  if (!src) return false;
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  return ["avi", "wmv", "mkv", "flv"].includes(ext);
};

const videos = [
  {
    id: 7679,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s",
    title: "Big Buck Bunny open-source film",
    duration: "09:56",
    channel: "Gangeshwary",
  },
  {
    id: 2,
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    title: "Sample Video 2",
    duration: "30:00",
    channel: "Mummy",
  },
  {
    id: 3,
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s",
    title: "3d Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
  },
  {
    id: 4,
    src: "https://download.samplelib.com/mp4/sample-5s.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s",
    title: "Sample Video 4",
    duration: "10:00",
    channel: "Karthik",
  },
  {
    id: 5,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s",
    title: "8k Wallpaper 3d Photos",
    duration: "18:00",
    channel: "Annu",
  },
  {
    id: 6,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail:
      "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg",
    title: "3D Animation Solutions | Autodesk",
    duration: "08:00",
    channel: "Jyoti",
  },
  {
    id: 7,
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s",
    title: "3D Shapes | Types, Properties & Examples",
    duration: "28:00",
    channel: "Sarita",
  },
  {
    id: 8,
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s",
    title: "3d Graphics Pictures | Unsplash",
    duration: "20:00",
    channel: "Jaynarayan",
  },
  {
    id: 9,
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s",
    title: "Scenery 3d wallpaper | homify",
    duration: "10:00",
    channel: "Shyamnarayan",
  },
  {
    id: 10,
    src: "https://media.w3.org/2010/05/bunny/movie.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s",
    title: "3D Nature Images | Adobe Stock",
    duration: "12:00",
    channel: "Rajbhar",
  },
  {
    id: 11,
    src: "https://media.w3.org/2010/05/sintel/movie.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s",
    title: "5,364,800+ 3d Images | iStock",
    duration: "13:30",
    channel: "Narayan",
  },
  {
    id: 12,
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s",
    title: "Understanding 3D Computer Graphics",
    duration: "20:50",
    channel: "Laxminarayan",
  },
  {
    id: 13,
    src: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4",
    thumbnail: "https://picsum.photos/seed/lion1/320/180",
    title: "3D Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
  },
  {
    id: 14,
    src: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
    thumbnail: "https://picsum.photos/seed/tiger2/320/180",
    title: "Tiger in Wild",
    duration: "45:00",
    channel: "NatureTV",
  },
  {
    id: 15,
    src: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4",
    thumbnail: "https://picsum.photos/seed/forest3/320/180",
    title: "Forest Walk",
    duration: "30:00",
    channel: "EcoWorld",
  },
  {
    id: 16,
    src: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4",
    thumbnail: "https://picsum.photos/seed/ocean4/320/180",
    title: "Ocean Waves",
    duration: "15:00",
    channel: "SeaLife",
  },
  {
    id: 17,
    src: "https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4",
    thumbnail: "https://picsum.photos/seed/mountain5/320/180",
    title: "Mountain Trek",
    duration: "20:00",
    channel: "Adventures",
  },
  {
    id: 18,
    src: "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
    thumbnail: "https://picsum.photos/seed/city6/320/180",
    title: "City Lights",
    duration: "10:00",
    channel: "UrbanVibe",
  },
  {
    id: 19,
    src: "https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-highway-down-a-mountain-41576-large.mp4",
    thumbnail: "https://picsum.photos/seed/sunset7/320/180",
    title: "Sunset Timelapse",
    duration: "05:00",
    channel: "SkyWatch",
  },
  {
    id: 20,
    src: "https://assets.mixkit.co/videos/preview/mixkit-white-sand-beach-and-palm-trees-1564-large.mp4",
    thumbnail: "https://picsum.photos/seed/beach8/320/180",
    title: "Beach Day",
    duration: "12:00",
    channel: "SummerFun",
  },
  {
    id: 21,
    src: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4",
    thumbnail: "https://picsum.photos/seed/rain9/320/180",
    title: "Rainy Day",
    duration: "08:00",
    channel: "Chill",
  },
  {
    id: 22,
    src: "https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-water-of-a-lake-18312-large.mp4",
    thumbnail: "https://picsum.photos/seed/snow10/320/180",
    title: "Snowfall",
    duration: "25:00",
    channel: "WinterMood",
  },
  {
    id: 23,
    src: "https://assets.mixkit.co/videos/preview/mixkit-woman-running-above-the-camera-on-a-running-track-32807-large.mp4",
    thumbnail: "https://picsum.photos/seed/car11/320/180",
    title: "Sports Car Review",
    duration: "18:00",
    channel: "AutoDrive",
  },
  {
    id: 24,
    src: "https://assets.mixkit.co/videos/preview/mixkit-countryside-meadow-4075-large.mp4",
    thumbnail: "https://picsum.photos/seed/food12/320/180",
    title: "Pasta Recipe",
    duration: "22:00",
    channel: "ChefLife",
  },
  {
    id: 25,
    src: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-night-sky-1610-large.mp4",
    thumbnail: "https://picsum.photos/seed/tech13/320/180",
    title: "Latest Gadgets",
    duration: "35:00",
    channel: "TechZone",
  },
  {
    id: 26,
    src: "https://assets.mixkit.co/videos/preview/mixkit-tiger-in-the-forest-751-large.mp4",
    thumbnail: "https://picsum.photos/seed/space14/320/180",
    title: "Space Exploration",
    duration: "40:00",
    channel: "NASAFan",
  },
  {
    id: 27,
    src: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4",
    thumbnail: "https://picsum.photos/seed/dog15/320/180",
    title: "Cute Dogs Compilation",
    duration: "14:00",
    channel: "PetPals",
  },
  {
    id: 28,
    src: "https://assets.mixkit.co/videos/preview/mixkit-ocean-waves-under-sky-1234-large.mp4",
    thumbnail: "https://picsum.photos/seed/cat16/320/180",
    title: "Funny Cats",
    duration: "11:00",
    channel: "MeowTime",
  },
  {
    id: 29,
    src: "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/workout17/320/180",
    title: "Morning Workout",
    duration: "28:00",
    channel: "FitLife",
  },
  {
    id: 30,
    src: "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/yoga18/320/180",
    title: "Yoga for Beginners",
    duration: "45:00",
    channel: "ZenMode",
  },
  {
    id: 31,
    src: "https://videos.pexels.com/video-files/3571264/3571264-hd_1280_720_50fps.mp4",
    thumbnail: "https://picsum.photos/seed/music19/320/180",
    title: "Lo-Fi Music Mix",
    duration: "60:00",
    channel: "LoFiBeats",
  },
  {
    id: 32,
    src: "https://videos.pexels.com/video-files/2792369/2792369-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/travel20/320/180",
    title: "Travel Vlog: Japan",
    duration: "55:00",
    channel: "GlobeTrotter",
  },
  {
    id: 33,
    src: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/art21/320/180",
    title: "Painting Tutorial",
    duration: "50:00",
    channel: "ArtStudio",
  },
  {
    id: 34,
    src: "https://videos.pexels.com/video-files/4812205/4812205-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/code22/320/180",
    title: "Learn JavaScript",
    duration: "90:00",
    channel: "DevHQ",
  },
  {
    id: 35,
    src: "https://videos.pexels.com/video-files/3194277/3194277-hd_1280_720_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/bird23/320/180",
    title: "Birds of Paradise",
    duration: "16:00",
    channel: "WildBirds",
  },
  {
    id: 36,
    src: "https://videos.pexels.com/video-files/2098827/2098827-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/river24/320/180",
    title: "River Kayaking",
    duration: "32:00",
    channel: "OutdoorX",
  },
  {
    id: 37,
    src: "https://videos.pexels.com/video-files/4425279/4425279-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/night25/320/180",
    title: "Night Sky Photography",
    duration: "38:00",
    channel: "StarGazer",
  },
  {
    id: 38,
    src: "https://videos.pexels.com/video-files/2711387/2711387-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/coffee26/320/180",
    title: "Coffee Art Tips",
    duration: "09:00",
    channel: "BrewMaster",
  },
  {
    id: 39,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/book27/320/180",
    title: "Book Review",
    duration: "20:00",
    channel: "ReadMore",
  },
  {
    id: 40,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/game28/320/180",
    title: "Gaming Highlights",
    duration: "42:00",
    channel: "ProGamer",
  },
  {
    id: 41,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/drone29/320/180",
    title: "Drone Footage",
    duration: "17:00",
    channel: "SkyView",
  },
  {
    id: 42,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/history30/320/180",
    title: "Ancient Civilizations",
    duration: "65:00",
    channel: "HistoryBuff",
  },
  {
    id: 43,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/garden31/320/180",
    title: "Garden Tips",
    duration: "23:00",
    channel: "GreenThumb",
  },
  {
    id: 44,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/fish32/320/180",
    title: "Deep Sea Creatures",
    duration: "44:00",
    channel: "OceanDepth",
  },
  {
    id: 45,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/bike33/320/180",
    title: "Mountain Biking",
    duration: "31:00",
    channel: "BikePro",
  },
  {
    id: 46,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/sky34/320/180",
    title: "Cloud Formations",
    duration: "07:00",
    channel: "WeatherNerd",
  },
  {
    id: 47,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/market35/320/180",
    title: "Street Market Tour",
    duration: "27:00",
    channel: "FoodieWalks",
  },
  {
    id: 48,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/dance36/320/180",
    title: "Dance Choreography",
    duration: "13:00",
    channel: "DanceFloor",
  },
  {
    id: 49,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/photo37/320/180",
    title: "Photography Masterclass",
    duration: "75:00",
    channel: "LensCraft",
  },
  {
    id: 50,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/desk38/320/180",
    title: "Desk Setup Tour",
    duration: "19:00",
    channel: "SetupGoals",
  },
  {
    id: 51,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/swim39/320/180",
    title: "Swimming Tips",
    duration: "36:00",
    channel: "AquaLife",
  },
  {
    id: 52,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/volcano40/320/180",
    title: "Volcanic Eruption",
    duration: "48:00",
    channel: "GeoWatch",
  },
  {
    id: 53,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/farm41/320/180",
    title: "Farm Life Vlog",
    duration: "53:00",
    channel: "RuralDays",
  },
  {
    id: 54,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/robot42/320/180",
    title: "AI & Robotics",
    duration: "58:00",
    channel: "FutureTech",
  },
  {
    id: 55,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/horse43/320/180",
    title: "Horse Riding Basics",
    duration: "41:00",
    channel: "EquineLife",
  },
  {
    id: 56,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/dessert44/320/180",
    title: "Chocolate Cake Recipe",
    duration: "26:00",
    channel: "SweetBakes",
  },
  {
    id: 57,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/waterfall45/320/180",
    title: "Waterfall Hike",
    duration: "33:00",
    channel: "NatureWalks",
  },
  {
    id: 58,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/candle46/320/180",
    title: "DIY Candle Making",
    duration: "21:00",
    channel: "CraftCorner",
  },
  {
    id: 59,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/castle47/320/180",
    title: "Castle Exploration",
    duration: "67:00",
    channel: "HistoricPlaces",
  },
  {
    id: 60,
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/surf48/320/180",
    title: "Surfing Lessons",
    duration: "29:00",
    channel: "WaveRider",
  },
  {
    id: 61,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/jungle49/320/180",
    title: "Jungle Safari",
    duration: "72:00",
    channel: "WildExplorer",
  },
  {
    id: 62,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/aurora50/320/180",
    title: "Northern Lights",
    duration: "15:00",
    channel: "ArcticVision",
  },
];

// ✅ Paste defaultComments HERE — after videos array, before Video component
const defaultComments = [
  {
    id: 1,
    user: "UserName",
    text: "This is the cool web App Project",
    date: "2024-09-30",
  },
  {
    id: 2,
    user: "UserName",
    text: "This is the cool web App Project",
    date: "2024-09-30",
  },
];

const Video = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());
  const [message, setMessage] = useState("");
  const [autoPlay, setAutoPlay] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(32);
  const [shareToast, setShareToast] = useState(false);
  // With this — store comments keyed by video id:
  const [allComments, setAllComments] = useState({});

  const loggedInUser = localStorage.getItem("username") || "Guest"; // ✅ here

  // Derive current video's comments
  const comments = allComments[id] ?? defaultComments;

  const controlsTimer = useRef(null);
  const videoRef = useRef(null);

  const currentIndex = videos.findIndex((v) => v.id === Number(id));
  const video = videos[currentIndex];
  const nextVideo = videos[currentIndex + 1] || videos[0];
  const prevVideo = videos[currentIndex - 1] || videos[videos.length - 1];

  const isSubscribed = subscribedChannels.has(video.channel);

  const handleSubscribe = () => {
    setSubscribedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(video.channel)) {
        next.delete(video.channel);
      } else {
        next.add(video.channel);
      }
      return next;
    });
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  const handleVideoEnd = () => {
    if (autoPlay) navigate(`/video/${nextVideo.id}`);
  };

  const handleVideoError = () => setVideoError(true);

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      if (disliked) setDisliked(false);
    }
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);
      if (liked) {
        setLiked(false);
        setLikeCount((c) => c - 1);
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const handleCommentSubmit = () => {
    if (!message.trim()) return;
    const newComment = {
      id: Date.now(),
      user: loggedInUser, // ✅ dynamic
      text: message,
      date: new Date().toISOString().slice(0, 10),
    };
    setAllComments((prev) => ({
      ...prev,
      [id]: [newComment, ...(prev[id] ?? defaultComments)],
    }));
    setMessage("");
  };

  useEffect(() => {
  const handleSpacebar = (e) => {
    // ✅ Don't intercept spacebar if user is typing in an input/textarea
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      const vid = videoRef.current;
      if (!vid) return;
      vid.paused ? vid.play() : vid.pause();
    }
  };
  window.addEventListener("keydown", handleSpacebar);
  return () => window.removeEventListener("keydown", handleSpacebar);
}, []);

  useEffect(() => {
    setLiked(false);
    setDisliked(false);
    setLikeCount(32);
    setVideoError(false);
  }, [id]);

  if (!video)
    return <p style={{ color: "white", padding: "20px" }}>Video not found</p>;

  const suggestions = videos.filter((v) => v.id !== video.id);
  const formatName = video.src?.split(".").pop().split("?")[0].toUpperCase();

  return (
    <div className="video">
      <div className="videoPostSection">
        {/* ── video player ── */}
        <div
          className="video_player_wrapper"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseMove}
        >
          <div
            className={`video_controls_bar ${showControls ? "visible" : "hidden"}`}
          >
            <button
              className="video_nav_btn"
              onClick={() => navigate(`/video/${prevVideo.id}`)}
            >
              ⏮ Prev
            </button>
            <div className="video_autoplay_toggle">
              <span>Autoplay</span>
              <div
                className={`toggle_switch ${autoPlay ? "on" : "off"}`}
                onClick={() => setAutoPlay(!autoPlay)}
              >
                <div className="toggle_knob" />
              </div>
            </div>
            <button
              className="video_nav_btn"
              onClick={() => navigate(`/video/${nextVideo.id}`)}
            >
              Next ⏭
            </button>
          </div>

          {isUnsupportedFormat(video.src) && (
            <div
              style={{
                background: "#ff4444",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "14px",
              }}
            >
              ⚠️ <strong>{formatName}</strong> format is not supported in
              browsers. Please convert to MP4 or WebM using FFmpeg.
            </div>
          )}

          {videoError && !isUnsupportedFormat(video.src) && (
            <div
              style={{
                background: "#ff8800",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "14px",
              }}
            >
              ⚠️ This video could not be played. The format may not be supported
              by your browser.
            </div>
          )}

          <video
            ref={videoRef}
            key={video.id}
            controls
            autoPlay
            className="video_youtube_video"
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            preload="auto"
            poster={video.thumbnail}
          >
            <source src={video.src} type={getVideoType(video.src)} />
            Your browser does not support the video tag.
          </video>

          <div className="video_frame_actions">
            <div
              className={`video_frame_btn ${liked ? "active" : ""}`}
              onClick={handleLike}
              title="Like"
            >
              <ThumbUpOutlinedIcon fontSize="small" />
              <span>{likeCount}</span>
            </div>
            <div
              className={`video_frame_btn ${disliked ? "active" : ""}`}
              onClick={handleDislike}
              title="Dislike"
            >
              <ThumbDownAltOutlinedIcon fontSize="small" />
            </div>
            <div
              className="video_frame_btn"
              onClick={handleShare}
              title="Share"
            >
              <ShareIcon fontSize="small" />
              <span>Share</span>
            </div>
          </div>
        </div>

        {/* ── up next preview ── */}
        <Link
          to={`/video/${nextVideo.id}`}
          className="next_video_preview"
          style={{ textDecoration: "none" }}
        >
          <span className="next_video_label">▶ Up Next</span>
          <img
            src={nextVideo.thumbnail}
            alt={nextVideo.title}
            className="next_video_thumb"
          />
          <div className="next_video_info">
            <div className="next_video_title">{nextVideo.title}</div>
            <div className="next_video_channel">{nextVideo.channel}</div>
            <div className="next_video_duration">{nextVideo.duration}</div>
          </div>
        </Link>

        {/* ── video info ── */}
        <div className="video_youtubeAbout">
          <div className="video_uTubeTitle">{video.title}</div>

          <div className="youtube_video_ProfileBlock">
            <div className="youtube_video_ProfileBlock_left">
              <Link
                to={`/user/${video.channel.toLowerCase()}`}
                className="youtube_video_ProfileBlock_left_img"
              >
                <img
                  className="youtube_video_ProfileBlock_left_image"
                  src="https://th.bing.com/th/id/OIP.hA04LwcrDABDbCzqGof8iQHaHa?rs=1&pid=imgDetMain"
                  alt="profile"
                />
              </Link>
              <div className="youtubeVideo_subsView">
                <Link
                  to={`/user/${video.channel.toLowerCase()}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="youtubePostProfileName">{video.channel}</div>
                </Link>
                <div className="youtubePostProfileSubs">2024-07-09</div>
              </div>
              <div
                className="subscribeBtnYoutube"
                onClick={handleSubscribe}
                style={{
                  background: isSubscribed ? "#555" : "#ff0000",
                  cursor: "pointer",
                  color: "white",
                }}
              >
                {isSubscribed ? "Subscribed" : "Subscribe"}
              </div>
            </div>
          </div>

          {shareToast && (
            <div
              style={{
                position: "fixed",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#333",
                color: "#fff",
                padding: "8px 18px",
                borderRadius: "999px",
                fontSize: "13px",
                zIndex: 999,
              }}
            >
              Link copied to clipboard
            </div>
          )}

          <div className="youtube_video_About">
            <div>2024-09-30</div>
            <div>This is the cool video</div>
          </div>

          {/* ── comments ── */}
          <div className="youtubeCommentSection">
            <div className="youtubeCommentSectionTitle">
              {comments.length} Comments
            </div>

            <div className="youtubeSelfComment">
              <img
                className="video_youtubeSelfCommentProfile"
                src="https://th.bing.com/th/id/OIP.8gLtXrl4KYPfPA6QyMnlUwHaEK?w=304&h=180&c=7&pid=1.7"
                alt="self"
              />
              <div className="addAComment">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="addACommentInput"
                  placeholder="Add a comment"
                  onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                />
                <div className="cancelSubmitComment">
                  <div className="cancelcomment" onClick={() => setMessage("")}>
                    Cancel
                  </div>
                  <div className="cancelcomment" onClick={handleCommentSubmit}>
                    Comment
                  </div>
                </div>
              </div>
            </div>

            <div className="youtubeothersComments">
              {comments.map((c) => (
                <div className="youtubeSelfComment" key={c.id}>
                  <img
                    className="video_youtubeSelfCommentProfile"
                    src="https://th.bing.com/th/id/OIP.8gLtXrl4KYPfPA6QyMnlUwHaEK?w=304&h=180&c=7&pid=1.7"
                    alt="commenter"
                  />
                  <div className="others_commentSection">
                    <div className="others_commentSectionHeader">
                      <div className="channelName_comment">{c.user}</div>
                      <div className="commentTimingOthers">{c.date}</div>
                    </div>
                    <div className="otherCommentSectionComment">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── suggestions sidebar ── */}
      <div className="videoSuggestions">
        {suggestions.map((suggestion) => (
          <Link
            to={`/video/${suggestion.id}`}
            key={suggestion.id}
            className="videoSuggestionsBlock"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="video_suggestion_thumbnail">
              <img
                src={suggestion.thumbnail}
                className="video_suggestion_thumbnail_img"
                alt={suggestion.title}
              />
            </div>
            <div className="video_suggestions_About">
              <div className="video_suggestions_About_title">
                {suggestion.title}
              </div>
              <div className="video_suggestions_About_Profile">
                {suggestion.channel}
              </div>
              <div className="video_suggestions_About_Profile">
                {suggestion.duration}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Video;
