import React, { useState, useRef, useEffect } from "react";
import "./video.css";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ReplyIcon from "@mui/icons-material/Reply";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import useViewTracker from "../../Component/Reels/useViewTracker";

const getCloudinaryThumbnail = (videoUrl) => {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return null;
  return videoUrl
    .replace("/video/upload/", "/video/upload/so_1,vs_1/")
    .replace(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i, ".jpg");
};

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
  if (src.includes("cloudinary.com") || src.includes("supabase")) return false;
  const ext = src.split(".").pop().split("?")[0].toLowerCase();
  return ["avi", "wmv", "mkv", "flv"].includes(ext);
};

const hardcodedVideos = [
  {
    id: "hc_7679",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s",
    title: "Big Buck Bunny open-source film",
    duration: "09:56",
    channel: "Gangeshwary",
    username: "gangeshwary",
  },
  {
    id: "hc_2",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    title: "Sample Video 2",
    duration: "30:00",
    channel: "Mummy",
    username: "mummy",
  },
  {
    id: "hc_3",
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s",
    title: "3d Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    username: "papa",
  },
  {
    id: "hc_4",
    src: "https://download.samplelib.com/mp4/sample-5s.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s",
    title: "Sample Video 4",
    duration: "10:00",
    channel: "Karthik",
    username: "karthik",
  },
  {
    id: "hc_5",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s",
    title: "8k Wallpaper 3d Photos",
    duration: "18:00",
    channel: "Annu",
    username: "annu",
  },
  {
    id: "hc_6",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail:
      "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg",
    title: "3D Animation Solutions | Autodesk",
    duration: "08:00",
    channel: "Jyoti",
    username: "jyoti",
  },
  {
    id: "hc_7",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s",
    title: "3D Shapes | Types, Properties & Examples",
    duration: "28:00",
    channel: "Sarita",
    username: "sarita",
  },
  {
    id: "hc_8",
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s",
    title: "3d Graphics Pictures | Unsplash",
    duration: "20:00",
    channel: "Jaynarayan",
    username: "jaynarayan",
  },
  {
    id: "hc_9",
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s",
    title: "Scenery 3d wallpaper | homify",
    duration: "10:00",
    channel: "Shyamnarayan",
    username: "shyamnarayan",
  },
  {
    id: "hc_10",
    src: "https://media.w3.org/2010/05/bunny/movie.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s",
    title: "3D Nature Images | Adobe Stock",
    duration: "12:00",
    channel: "Rajbhar",
    username: "rajbhar",
  },
  {
    id: "hc_11",
    src: "https://media.w3.org/2010/05/sintel/movie.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s",
    title: "5,364,800+ 3d Images | iStock",
    duration: "13:30",
    channel: "Narayan",
    username: "narayan",
  },
  {
    id: "hc_12",
    src: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s",
    title: "Understanding 3D Computer Graphics",
    duration: "20:50",
    channel: "Laxminarayan",
    username: "laxminarayan",
  },
  {
    id: "hc_13",
    src: "https://samplelib.com/lib/preview/mp4/sample-10s.mp4",
    thumbnail: "https://picsum.photos/seed/lion1/320/180",
    title: "3D Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
    username: "papa",
  },
  {
    id: "hc_14",
    src: "https://samplelib.com/lib/preview/mp4/sample-15s.mp4",
    thumbnail: "https://picsum.photos/seed/tiger2/320/180",
    title: "Tiger in Wild",
    duration: "45:00",
    channel: "NatureTV",
    username: "naturetv",
  },
  {
    id: "hc_15",
    src: "https://samplelib.com/lib/preview/mp4/sample-20s.mp4",
    thumbnail: "https://picsum.photos/seed/forest3/320/180",
    title: "Forest Walk",
    duration: "30:00",
    channel: "EcoWorld",
    username: "ecoworld",
  },
  {
    id: "hc_16",
    src: "https://samplelib.com/lib/preview/mp4/sample-30s.mp4",
    thumbnail: "https://picsum.photos/seed/ocean4/320/180",
    title: "Ocean Waves",
    duration: "15:00",
    channel: "SeaLife",
    username: "sealife",
  },
  {
    id: "hc_17",
    src: "https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4",
    thumbnail: "https://picsum.photos/seed/mountain5/320/180",
    title: "Mountain Trek",
    duration: "20:00",
    channel: "Adventures",
    username: "adventures",
  },
  {
    id: "hc_18",
    src: "https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4",
    thumbnail: "https://picsum.photos/seed/city6/320/180",
    title: "City Lights",
    duration: "10:00",
    channel: "UrbanVibe",
    username: "urbanvibe",
  },
  {
    id: "hc_19",
    src: "https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-highway-down-a-mountain-41576-large.mp4",
    thumbnail: "https://picsum.photos/seed/sunset7/320/180",
    title: "Sunset Timelapse",
    duration: "05:00",
    channel: "SkyWatch",
    username: "skywatch",
  },
  {
    id: "hc_20",
    src: "https://assets.mixkit.co/videos/preview/mixkit-white-sand-beach-and-palm-trees-1564-large.mp4",
    thumbnail: "https://picsum.photos/seed/beach8/320/180",
    title: "Beach Day",
    duration: "12:00",
    channel: "SummerFun",
    username: "summerfun",
  },
  {
    id: "hc_21",
    src: "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4",
    thumbnail: "https://picsum.photos/seed/rain9/320/180",
    title: "Rainy Day",
    duration: "08:00",
    channel: "Chill",
    username: "chill",
  },
  {
    id: "hc_22",
    src: "https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-water-of-a-lake-18312-large.mp4",
    thumbnail: "https://picsum.photos/seed/snow10/320/180",
    title: "Snowfall",
    duration: "25:00",
    channel: "WinterMood",
    username: "wintermood",
  },
  {
    id: "hc_23",
    src: "https://assets.mixkit.co/videos/preview/mixkit-woman-running-above-the-camera-on-a-running-track-32807-large.mp4",
    thumbnail: "https://picsum.photos/seed/car11/320/180",
    title: "Sports Car Review",
    duration: "18:00",
    channel: "AutoDrive",
    username: "autodrive",
  },
  {
    id: "hc_24",
    src: "https://assets.mixkit.co/videos/preview/mixkit-countryside-meadow-4075-large.mp4",
    thumbnail: "https://picsum.photos/seed/food12/320/180",
    title: "Pasta Recipe",
    duration: "22:00",
    channel: "ChefLife",
    username: "cheflife",
  },
  {
    id: "hc_25",
    src: "https://assets.mixkit.co/videos/preview/mixkit-stars-in-night-sky-1610-large.mp4",
    thumbnail: "https://picsum.photos/seed/tech13/320/180",
    title: "Latest Gadgets",
    duration: "35:00",
    channel: "TechZone",
    username: "techzone",
  },
  {
    id: "hc_26",
    src: "https://assets.mixkit.co/videos/preview/mixkit-tiger-in-the-forest-751-large.mp4",
    thumbnail: "https://picsum.photos/seed/space14/320/180",
    title: "Space Exploration",
    duration: "40:00",
    channel: "NASAFan",
    username: "nasafan",
  },
  {
    id: "hc_27",
    src: "https://assets.mixkit.co/videos/preview/mixkit-waterfall-in-forest-2213-large.mp4",
    thumbnail: "https://picsum.photos/seed/dog15/320/180",
    title: "Cute Dogs Compilation",
    duration: "14:00",
    channel: "PetPals",
    username: "petpals",
  },
  {
    id: "hc_28",
    src: "https://assets.mixkit.co/videos/preview/mixkit-ocean-waves-under-sky-1234-large.mp4",
    thumbnail: "https://picsum.photos/seed/cat16/320/180",
    title: "Funny Cats",
    duration: "11:00",
    channel: "MeowTime",
    username: "meowtime",
  },
  {
    id: "hc_29",
    src: "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/workout17/320/180",
    title: "Morning Workout",
    duration: "28:00",
    channel: "FitLife",
    username: "fitlife",
  },
  {
    id: "hc_30",
    src: "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/yoga18/320/180",
    title: "Yoga for Beginners",
    duration: "45:00",
    channel: "ZenMode",
    username: "zenmode",
  },
  {
    id: "hc_31",
    src: "https://videos.pexels.com/video-files/3571264/3571264-hd_1280_720_50fps.mp4",
    thumbnail: "https://picsum.photos/seed/music19/320/180",
    title: "Lo-Fi Music Mix",
    duration: "60:00",
    channel: "LoFiBeats",
    username: "lofibeats",
  },
  {
    id: "hc_32",
    src: "https://videos.pexels.com/video-files/2792369/2792369-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/travel20/320/180",
    title: "Travel Vlog: Japan",
    duration: "55:00",
    channel: "GlobeTrotter",
    username: "globetrotter",
  },
  {
    id: "hc_33",
    src: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/art21/320/180",
    title: "Painting Tutorial",
    duration: "50:00",
    channel: "ArtStudio",
    username: "artstudio",
  },
  {
    id: "hc_34",
    src: "https://videos.pexels.com/video-files/4812205/4812205-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/code22/320/180",
    title: "Learn JavaScript",
    duration: "90:00",
    channel: "DevHQ",
    username: "devhq",
  },
  {
    id: "hc_35",
    src: "https://videos.pexels.com/video-files/3194277/3194277-hd_1280_720_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/bird23/320/180",
    title: "Birds of Paradise",
    duration: "16:00",
    channel: "WildBirds",
    username: "wildbirds",
  },
  {
    id: "hc_36",
    src: "https://videos.pexels.com/video-files/2098827/2098827-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/river24/320/180",
    title: "River Kayaking",
    duration: "32:00",
    channel: "OutdoorX",
    username: "outdoorx",
  },
  {
    id: "hc_37",
    src: "https://videos.pexels.com/video-files/4425279/4425279-hd_1920_1080_25fps.mp4",
    thumbnail: "https://picsum.photos/seed/night25/320/180",
    title: "Night Sky Photography",
    duration: "38:00",
    channel: "StarGazer",
    username: "stargazer",
  },
  {
    id: "hc_38",
    src: "https://videos.pexels.com/video-files/2711387/2711387-hd_1920_1080_30fps.mp4",
    thumbnail: "https://picsum.photos/seed/coffee26/320/180",
    title: "Coffee Art Tips",
    duration: "09:00",
    channel: "BrewMaster",
    username: "brewmaster",
  },
  {
    id: "hc_39",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/book27/320/180",
    title: "Book Review",
    duration: "20:00",
    channel: "ReadMore",
    username: "readmore",
  },
  {
    id: "hc_40",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/game28/320/180",
    title: "Gaming Highlights",
    duration: "42:00",
    channel: "ProGamer",
    username: "progamer",
  },
  {
    id: "hc_41",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/drone29/320/180",
    title: "Drone Footage",
    duration: "17:00",
    channel: "SkyView",
    username: "skyview",
  },
  {
    id: "hc_42",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/history30/320/180",
    title: "Ancient Civilizations",
    duration: "65:00",
    channel: "HistoryBuff",
    username: "historybuff",
  },
  {
    id: "hc_43",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/garden31/320/180",
    title: "Garden Tips",
    duration: "23:00",
    channel: "GreenThumb",
    username: "greenthumb",
  },
  {
    id: "hc_44",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/fish32/320/180",
    title: "Deep Sea Creatures",
    duration: "44:00",
    channel: "OceanDepth",
    username: "oceandepth",
  },
  {
    id: "hc_45",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/bike33/320/180",
    title: "Mountain Biking",
    duration: "31:00",
    channel: "BikePro",
    username: "bikepro",
  },
  {
    id: "hc_46",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/sky34/320/180",
    title: "Cloud Formations",
    duration: "07:00",
    channel: "WeatherNerd",
    username: "weathernerd",
  },
  {
    id: "hc_47",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/market35/320/180",
    title: "Street Market Tour",
    duration: "27:00",
    channel: "FoodieWalks",
    username: "foodiewalks",
  },
  {
    id: "hc_48",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/dance36/320/180",
    title: "Dance Choreography",
    duration: "13:00",
    channel: "DanceFloor",
    username: "dancefloor",
  },
  {
    id: "hc_49",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/photo37/320/180",
    title: "Photography Masterclass",
    duration: "75:00",
    channel: "LensCraft",
    username: "lenscraft",
  },
  {
    id: "hc_50",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/desk38/320/180",
    title: "Desk Setup Tour",
    duration: "19:00",
    channel: "SetupGoals",
    username: "setupgoals",
  },
  {
    id: "hc_51",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/swim39/320/180",
    title: "Swimming Tips",
    duration: "36:00",
    channel: "AquaLife",
    username: "aqualife",
  },
  {
    id: "hc_52",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/volcano40/320/180",
    title: "Volcanic Eruption",
    duration: "48:00",
    channel: "GeoWatch",
    username: "geowatch",
  },
  {
    id: "hc_53",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/farm41/320/180",
    title: "Farm Life Vlog",
    duration: "53:00",
    channel: "RuralDays",
    username: "ruraldays",
  },
  {
    id: "hc_54",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/robot42/320/180",
    title: "AI & Robotics",
    duration: "58:00",
    channel: "FutureTech",
    username: "futuretech",
  },
  {
    id: "hc_55",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/horse43/320/180",
    title: "Horse Riding Basics",
    duration: "41:00",
    channel: "EquineLife",
    username: "equinelife",
  },
  {
    id: "hc_56",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/dessert44/320/180",
    title: "Chocolate Cake Recipe",
    duration: "26:00",
    channel: "SweetBakes",
    username: "sweetbakes",
  },
  {
    id: "hc_57",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/waterfall45/320/180",
    title: "Waterfall Hike",
    duration: "33:00",
    channel: "NatureWalks",
    username: "naturewalks",
  },
  {
    id: "hc_58",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    thumbnail: "https://picsum.photos/seed/candle46/320/180",
    title: "DIY Candle Making",
    duration: "21:00",
    channel: "CraftCorner",
    username: "craftcorner",
  },
  {
    id: "hc_59",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumbnail: "https://picsum.photos/seed/castle47/320/180",
    title: "Castle Exploration",
    duration: "67:00",
    channel: "HistoricPlaces",
    username: "historicplaces",
  },
  {
    id: "hc_60",
    src: "https://www.w3schools.com/html/movie.mp4",
    thumbnail: "https://picsum.photos/seed/surf48/320/180",
    title: "Surfing Lessons",
    duration: "29:00",
    channel: "WaveRider",
    username: "waverider",
  },
  {
    id: "hc_61",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumbnail: "https://picsum.photos/seed/jungle49/320/180",
    title: "Jungle Safari",
    duration: "72:00",
    channel: "WildExplorer",
    username: "wildexplorer",
  },
  {
    id: "hc_62",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    thumbnail: "https://picsum.photos/seed/aurora50/320/180",
    title: "Northern Lights",
    duration: "15:00",
    channel: "ArcticVision",
    username: "arcticvision",
  },
];

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

  const [dbVideos, setDbVideos] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [autoPlay, setAutoPlay] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [disliked, setDisliked] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [allComments, setAllComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const loggedInUser = localStorage.getItem("username") || "Guest";
  const controlsTimer = useRef(null);
  const videoRef = useRef(null);
  const topRef = useRef(null);

  // ── View tracking: records a view after 10s, once per 15 days ──
  useViewTracker({
    contentId: id,
    contentType: "video",
    isPlaying: isVideoPlaying,
  });

  useEffect(() => {
    const fetchDbVideos = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setDbVideos(
          data.map((v) => ({
            id: String(v.id),
            src: v.video_url,
            thumbnail: v.thumbnail_url || getCloudinaryThumbnail(v.video_url),
            title: v.title,
            duration: v.duration || "00:00",
            channel: v.channel,
            username: v.username || v.channel?.toLowerCase() || "unknown",
            tags: [v.category || "All"],
            isDb: true,
          })),
        );
      }
      setDbLoading(false);
    };
    fetchDbVideos();
  }, []);

  // ── Load view count ──
  useEffect(() => {
    const loadViewCount = async () => {
      const { count } = await supabase
        .from("views")
        .select("id", { count: "exact", head: true })
        .match({ content_id: String(id), content_type: "video" });
      setViewCount(count ?? 0);
    };
    loadViewCount();
  }, [id]);

  const allVideos = [...dbVideos, ...hardcodedVideos];
  const comments = allComments.length > 0 ? allComments : defaultComments;

  const currentIndex = allVideos.findIndex((v) => String(v.id) === String(id));
  const video = allVideos[currentIndex];
  const nextVideo = allVideos[currentIndex + 1] || allVideos[0];
  const prevVideo =
    allVideos[currentIndex - 1] || allVideos[allVideos.length - 1];

  useEffect(() => {
    const loadSubscription = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId || !video) return;
      const channelUsername = video.username || video.channel?.toLowerCase();
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .match({ subscriber_id: userId, subscribed_to: channelUsername })
        .single();
      setIsSubscribed(!!data);
    };
    loadSubscription();
  }, [id, video?.username]);

  const handleSubscribe = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to subscribe");
      return;
    }
    const channelUsername = video.username || video.channel?.toLowerCase();
    if (userId === channelUsername) {
      alert("You cannot subscribe to yourself");
      return;
    }
    if (isSubscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .match({ subscriber_id: userId, subscribed_to: channelUsername });
      setIsSubscribed(false);
    } else {
      const { error } = await supabase
        .from("subscriptions")
        .insert({ subscriber_id: userId, subscribed_to: channelUsername });
      if (!error) setIsSubscribed(true);
    }
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

  const handleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to like");
      return;
    }
    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .match({
          user_id: userId,
          content_id: String(id),
          content_type: "video",
        });
      setLiked(false);
      setLikeCount((c) => c - 1);
    } else {
      await supabase.from("likes").insert({
        user_id: userId,
        content_id: String(id),
        content_type: "video",
      });
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
    const isDbVideo = video?.isDb;
    const shareUrl = isDbVideo
      ? `https://zixplon-tawny.vercel.app/api/og?type=video&id=${id}`
      : window.location.href;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const handleCommentSubmit = async () => {
    if (!message.trim()) return;
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to comment");
      return;
    }
    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id: userId,
        username: loggedInUser,
        content_id: String(id),
        content_type: "video",
        text: message,
      })
      .select()
      .single();
    if (!error && data) {
      setAllComments((prev) => [
        {
          id: data.id,
          user: data.username,
          text: data.text,
          date: data.created_at?.slice(0, 10),
        },
        ...prev,
      ]);
    }
    setMessage("");
  };

  useEffect(() => {
    const handleSpacebar = (e) => {
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
    const loadLikes = async () => {
      const userId = localStorage.getItem("userId");
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .match({ content_id: String(id), content_type: "video" });
      setLikeCount(count || 0);
      if (userId) {
        const { data } = await supabase
          .from("likes")
          .select("id")
          .match({
            user_id: userId,
            content_id: String(id),
            content_type: "video",
          })
          .single();
        setLiked(!!data);
      }
    };
    loadLikes();
  }, [id]);

  useEffect(() => {
    const loadComments = async () => {
      setCommentsLoading(true);
      const { data } = await supabase
        .from("comments")
        .select("*")
        .match({ content_id: String(id), content_type: "video" })
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setAllComments(
          data.map((c) => ({
            id: c.id,
            user: c.username,
            text: c.text,
            date: c.created_at?.slice(0, 10),
          })),
        );
      } else {
        setAllComments([]);
      }
      setCommentsLoading(false);
    };
    loadComments();
  }, [id]);

  useEffect(() => {
  setDisliked(false);
  setVideoError(false);
  setIsVideoPlaying(false);
  
  // scroll the video player into view
  setTimeout(() => {
    const player = document.querySelector(".video_player_wrapper");
    if (player) {
      player.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}, [id]);

  if (dbLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "white",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "4px solid #333",
            borderTop: "4px solid #ff4444",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#aaa", fontSize: "14px" }}>Loading video...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!video) {
    return (
      <div style={{ color: "white", padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
        <p style={{ fontSize: "18px", marginBottom: "8px" }}>Video not found</p>
        <p style={{ color: "#aaa", fontSize: "14px" }}>
          This video may have been removed or the link is incorrect.
        </p>
        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: "20px",
            background: "#ff4444",
            color: "white",
            border: "none",
            padding: "10px 24px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← Go Home
        </button>
      </div>
    );
  }

  const suggestions = allVideos.filter((v) => String(v.id) !== String(id));
  const formatName = video.src?.split(".").pop().split("?")[0].toUpperCase();

  return (
    <div className="video">
    <div ref={topRef} style={{ position: "absolute", top: 0 }} />
      <div className="videoPostSection">
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

          {isUnsupportedFormat(video.src) && !videoError && (
            <div
              style={{
                background: "#ff4444",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                ⚠️ <strong>{formatName}</strong> format may not be supported.
              </span>
              <button
                onClick={() => setVideoError(false)}
                style={{
                  background: "none",
                  border: "1px solid white",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: "4px",
                  padding: "2px 10px",
                  marginLeft: "12px",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {videoError && (
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
              ⚠️ This video could not be played. Please try a different format.
            </div>
          )}

          {/* ── onPlay/onPause track isVideoPlaying for view tracker ── */}
          <video
            ref={videoRef}
            key={video.id}
            controls
            autoPlay
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            className="video_youtube_video"
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
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
              className={`video_frame_btn video_like_btn ${liked ? "video_liked" : ""}`}
              onClick={handleLike}
              title="Like"
            >
              <span className="video_like_inner">
                <ThumbUpOutlinedIcon
                  fontSize="small"
                  style={{ color: liked ? "#ff0000" : "white" }}
                />
                <span>{likeCount}</span>
              </span>
              <span className="video_like_emoji">😊</span>
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
              <ReplyIcon fontSize="small" style={{ transform: "scaleX(-1)" }} />
              <span>Share</span>
            </div>
          </div>
        </div>

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

        <div className="video_youtubeAbout">
          <div className="video_uTubeTitle">{video.title}</div>

          {/* ── View count display ── */}
          <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "8px" }}>
            👁 {viewCount} {viewCount === 1 ? "view" : "views"}
          </div>

          <div className="youtube_video_ProfileBlock">
            <div className="youtube_video_ProfileBlock_left">
              <Link
                to={`/user/${video.username || video.channel?.toLowerCase()}`}
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
                  to={`/user/${video.username || video.channel?.toLowerCase()}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="youtubePostProfileName">{video.channel}</div>
                </Link>
                <div className="youtubePostProfileSubs">2024-07-09</div>
              </div>
              {loggedInUser !==
                (video.username || video.channel?.toLowerCase()) && (
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
              )}
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
              🔗 Link copied! Share on WhatsApp to see thumbnail preview
            </div>
          )}

          <div className="youtube_video_About">
            <div>2024-09-30</div>
            <div>This is the cool video</div>
          </div>

          <div className="youtubeCommentSection">
            <div className="youtubeCommentSectionTitle">
              {comments.length} Comments
            </div>
            <div className="youtubeSelfComment">
              <img
                className="video_youtubeSelfCommentProfile"
                src={
                  localStorage.getItem("profilePic") ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedInUser)}&background=ff0000&color=fff&size=40`
                }
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
              {commentsLoading ? (
                <p style={{ color: "#aaa", fontSize: "13px" }}>
                  Loading comments...
                </p>
              ) : (
                comments.map((c) => (
                  <div className="youtubeSelfComment" key={c.id}>
                    <img
                      className="video_youtubeSelfCommentProfile"
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.user)}&background=333&color=fff&size=40`}
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="videoSuggestions"
        style={{ overflowY: "scroll", scrollbarWidth: "none" }}
      >
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
