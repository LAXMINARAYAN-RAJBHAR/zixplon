import React, { useState, useRef, useEffect } from "react";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ReplyIcon from "@mui/icons-material/Reply";
import "./reels.css";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../config/supabase";
import useViewTracker from "./useViewTracker";

export const reelsData = [
  {
    id: "rc_1",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jyoti",
    username: "jyoti",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_2",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Laxminarayan",
    username: "laxminarayan",
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
    thumbnail: "https://picsum.photos/200/350?random=2",
    title: "My Favourite Movie",
    duration: "0:53",
    description: "Another awesome reel 🎬",
    likes: 0,
  },
  {
    id: "rc_3",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Anuradha",
    username: "anuradha",
    profilePic: "https://randomuser.me/api/portraits/men/3.jpg",
    thumbnail: "https://picsum.photos/200/350?random=3",
    title: "Funny Moments",
    duration: "0:32",
    description: "Beautiful Flower 🌸",
    likes: 0,
  },
  {
    id: "rc_4",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Karthik",
    username: "karthik",
    profilePic: "https://randomuser.me/api/portraits/women/4.jpg",
    thumbnail: "https://picsum.photos/200/350?random=4",
    title: "Travel Vlog",
    duration: "0:53",
    description: "Friday Vibes 🎉",
    likes: 0,
  },
  {
    id: "rc_5",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_6",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jaynarayan",
    username: "jaynarayan",
    profilePic: "https://randomuser.me/api/portraits/women/6.jpg",
    thumbnail: "https://picsum.photos/200/350?random=6",
    title: "Evening Vibes",
    duration: "0:53",
    description: "Sample Reel 🎥",
    likes: 0,
  },
  {
    id: "rc_7",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Gangeshwary",
    username: "gangeshwary",
    profilePic: "https://randomuser.me/api/portraits/men/7.jpg",
    thumbnail: "https://picsum.photos/200/350?random=7",
    title: "Morning Routine",
    duration: "0:32",
    description: "Cool Reel 🔥",
    likes: 0,
  },
  {
    id: "rc_8",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Papa",
    username: "papa",
    profilePic: "https://randomuser.me/api/portraits/men/8.jpg",
    thumbnail: "https://picsum.photos/200/350?random=8",
    title: "Weekend Fun",
    duration: "0:53",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_9",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Mummy",
    username: "mummy",
    profilePic: "https://randomuser.me/api/portraits/women/9.jpg",
    thumbnail: "https://picsum.photos/200/350?random=9",
    title: "Kitchen Special",
    duration: "0:32",
    description: "Another awesome reel 🎬",
    likes: 0,
  },
  {
    id: "rc_10",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Sandeep",
    username: "sandeep",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 0,
  },
  {
    id: "rc_11",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Mandeep",
    username: "mandeep",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 0,
  },
  {
    id: "rc_12",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Tillu",
    username: "tillu",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 0,
  },
  {
    id: "rc_13",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Moti",
    username: "moti",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 0,
  },
  {
    id: "rc_14",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Reena",
    username: "reena",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_15",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Seema",
    username: "seema",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_16",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Bipin",
    username: "bipin",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_17",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Vivek",
    username: "vivek",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_18",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Sheru",
    username: "sheru",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_19",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jiyalal",
    username: "jiyalal",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_20",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Hiralal",
    username: "hiralal",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 0,
  },
  {
    id: "rc_21",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Ramnayan",
    username: "ramnayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_22",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Sunil",
    username: "sunil",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_23",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Kuneel",
    username: "kuneel",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_24",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Sonu",
    username: "sonu",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_25",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Monu",
    username: "monu",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_26",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Algu",
    username: "algu",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_27",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Gyandeep",
    username: "gyandeep",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_28",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Sharmila",
    username: "sharmila",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_29",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Urmila",
    username: "urmila",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_30",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Ghanshyam",
    username: "ghanshyam",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_31",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Kapil",
    username: "kapil",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_32",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Chandresh",
    username: "chandresh",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_33",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Kuldeep",
    username: "kuldeep",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_34",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Reela",
    username: "reela",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_35",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Sunita",
    username: "sunita",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_36",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Anita",
    username: "anita",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_37",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Guddu",
    username: "guddu",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_38",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Kripal",
    username: "kripal",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_39",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Suresh",
    username: "suresh",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_40",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Dinanath",
    username: "dinanath",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_41",
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Gorakhnath",
    username: "gorakhnath",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_42",
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shambhu",
    username: "shambhu",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_43",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Diwakar",
    username: "diwakar",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_44",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Sudhakar",
    username: "sudhakar",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
  {
    id: "rc_45",
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Prabhakar",
    username: "prabhakar",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 0,
  },
];

const getVideoType = (src) => {
  if (!src) return "video/mp4";
  if (src.includes(".mp4")) return "video/mp4";
  if (src.includes(".webm")) return "video/webm";
  if (src.includes(".mov")) return "video/quicktime";
  if (src.includes(".mkv")) return "video/x-matroska";
  if (src.includes(".avi")) return "video/x-msvideo";
  if (src.includes(".wmv")) return "video/x-ms-wmv";
  if (src.includes(".flv")) return "video/x-flv";
  return "video/mp4";
};

const fetchCount = async (contentId, contentType, reactionType) => {
  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .match({
      content_id: String(contentId),
      content_type: contentType,
      reaction_type: reactionType,
    });
  return Math.max(0, count ?? 0);
};

// ─────────────────────────────────────────────
// ReelItem Component
// ─────────────────────────────────────────────
const ReelItem = ({ reel, allReels }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const isMounted = useRef(true);
  const observerRef = useRef(null);
  const iconTimeoutRef = useRef(null);
  const commentPanelRef = useRef(null); // ← NEW

  const loggedInUser = localStorage.getItem("username") || "Guest";

  const [subscribed, setSubscribed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [likeCountLoading, setLikeCountLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [shareToast, setShareToast] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  // ── Close comments panel on outside click ── NEW
  useEffect(() => {
    if (!showComments) return;
    const handleOutsideClick = (e) => {
      if (
        commentPanelRef.current &&
        !commentPanelRef.current.contains(e.target)
      ) {
        setShowComments(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showComments]);

  useEffect(() => {
    const loadReactions = async () => {
      const userId = localStorage.getItem("userId");
      const lCount = await fetchCount(reel.id, "reel", "like");
      const dCount = await fetchCount(reel.id, "reel", "dislike");
      setLikeCount(lCount);
      setDislikeCount(dCount);
      setLikeCountLoading(false);
      if (!userId) return;
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .match({
          user_id: userId,
          content_id: String(reel.id),
          content_type: "reel",
          reaction_type: "like",
        })
        .maybeSingle();
      setLiked(!!likeData);
      const { data: dislikeData } = await supabase
        .from("likes")
        .select("id")
        .match({
          user_id: userId,
          content_id: String(reel.id),
          content_type: "reel",
          reaction_type: "dislike",
        })
        .maybeSingle();
      setDisliked(!!dislikeData);
    };
    loadReactions();
  }, [reel.id]);

  useEffect(() => {
    const loadViewCount = async () => {
      const { count } = await supabase
        .from("views")
        .select("id", { count: "exact", head: true })
        .match({ content_id: String(reel.id), content_type: "reel" });
      setViewCount(count ?? 0);
    };
    loadViewCount();
  }, [reel.id]);

  useEffect(() => {
    const loadSubscription = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .match({ subscriber_id: userId, subscribed_to: reel.username })
        .maybeSingle();
      setSubscribed(!!data);
    };
    loadSubscription();
  }, [reel.username]);

  useEffect(() => {
    const loadComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .match({ content_id: String(reel.id), content_type: "reel" })
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setComments(
          data.map((c) => ({
            id: c.id,
            user: c.username,
            text: c.text,
            date: c.created_at?.slice(0, 10),
          })),
        );
      }
    };
    loadComments();
  }, [reel.id]);

  useViewTracker({ contentId: reel.id, contentType: "reel", isPlaying });

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to subscribe");
      return;
    }
    if (userId === reel.username) {
      alert("You cannot subscribe to yourself");
      return;
    }
    if (subscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .match({ subscriber_id: userId, subscribed_to: reel.username });
      setSubscribed(false);
    } else {
      const { error } = await supabase
  .from("subscriptions")
  .insert({
    subscriber_id: userId,
    subscriber_username: localStorage.getItem("username"), // 👈 add this
    subscribed_to: reel.username,
  });
      if (!error) setSubscribed(true);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
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
        content_id: String(reel.id),
        content_type: "reel",
        text: commentText,
      })
      .select()
      .single();
    if (!error && data) {
      setComments((prev) => [
        {
          id: data.id,
          user: data.username,
          text: data.text,
          date: data.created_at?.slice(0, 10),
        },
        ...prev,
      ]);
    }
    setCommentText("");
  };

  const handleShare = () => {
    const isDbReel = String(reel.id).startsWith("db_");
    const dbId = isDbReel ? String(reel.id).replace("db_", "") : null;
    const url = isDbReel
      ? `https://zixplon-tawny.vercel.app/api/og?type=reel&id=${dbId}`
      : `https://zixplon-tawny.vercel.app/reels/${reel.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const isYouTube = (url) =>
    url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const getEmbedUrl = (url) => {
    if (url.includes("youtube.com/shorts/")) {
      const id = url.split("/shorts/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`;
    }
    if (url.includes("watch?v=")) {
      const id = url.split("watch?v=")[1].split("&")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`;
    }
    return url;
  };

  useEffect(() => {
    if (isYouTube(reel.src)) return;
    isMounted.current = true;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (!isMounted.current) return;
        if (entry.isIntersecting) {
          window.history.replaceState(null, "", `/reels/${reel.id}`);
          document.querySelectorAll("video").forEach((v) => {
            if (v !== video) v.pause();
          });
          video.muted = muted;
          video.play().catch(() => {});
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.7 },
    );
    observerRef.current.observe(container);
    return () => {
      isMounted.current = false;
      observerRef.current?.disconnect();
      clearTimeout(iconTimeoutRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, []);

  const flashIcon = () => {
    setShowIcon(true);
    clearTimeout(iconTimeoutRef.current);
    iconTimeoutRef.current = setTimeout(() => setShowIcon(false), 800);
  };

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    flashIcon();
  };

  const handleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to like");
      return;
    }
    if (isActing) return;
    setIsActing(true);
    try {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .match({
            user_id: userId,
            content_id: String(reel.id),
            content_type: "reel",
            reaction_type: "like",
          });
        setLiked(false);
      } else {
        if (disliked) {
          await supabase
            .from("likes")
            .delete()
            .match({
              user_id: userId,
              content_id: String(reel.id),
              content_type: "reel",
              reaction_type: "dislike",
            });
          setDisliked(false);
        }
        await supabase.from("likes").upsert(
          {
            user_id: userId,
            content_id: String(reel.id),
            content_type: "reel",
            reaction_type: "like",
          },
          { onConflict: "user_id,content_id,content_type,reaction_type" },
        );
        setLiked(true);
      }
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally {
      setIsActing(false);
    }
  };

  const handleDislike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      alert("Please login to react");
      return;
    }
    if (isActing) return;
    setIsActing(true);
    try {
      if (disliked) {
        await supabase
          .from("likes")
          .delete()
          .match({
            user_id: userId,
            content_id: String(reel.id),
            content_type: "reel",
            reaction_type: "dislike",
          });
        setDisliked(false);
      } else {
        if (liked) {
          await supabase
            .from("likes")
            .delete()
            .match({
              user_id: userId,
              content_id: String(reel.id),
              content_type: "reel",
              reaction_type: "like",
            });
          setLiked(false);
        }
        await supabase.from("likes").upsert(
          {
            user_id: userId,
            content_id: String(reel.id),
            content_type: "reel",
            reaction_type: "dislike",
          },
          { onConflict: "user_id,content_id,content_type,reaction_type" },
        );
        setDisliked(true);
      }
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="reel_item" id={`reel-${reel.id}`} ref={containerRef}>
      <div className="reel_video_wrapper">
        {isYouTube(reel.src) ? (
          <iframe
            className="reel_video"
            src={getEmbedUrl(reel.src)}
            frameBorder="0"
            allow="autoplay; fullscreen"
            allowFullScreen
            title={reel.title}
          />
        ) : (
          <video
            ref={videoRef}
            className="reel_video"
            loop
            muted={muted}
            playsInline
            poster={reel.thumbnail}
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            onClick={handleVideoClick}
          >
            <source src={reel.src} type={getVideoType(reel.src)} />
            Your browser does not support this video.
          </video>
        )}

        {!isYouTube(reel.src) && showIcon && (
          <div className="reel_play_icon">{isPlaying ? "▶" : "⏸"}</div>
        )}

        <div className="reel_actions">
          <div
            className={`reel_action_btn reel_like_btn ${liked ? "reel_liked" : ""}`}
            onClick={handleLike}
            style={{
              opacity: isActing ? 0.6 : 1,
              pointerEvents: isActing ? "none" : "auto",
            }}
          >
            <span className="reel_like_inner">
              <ThumbUpOutlinedIcon
                style={{ color: liked ? "#ff0000" : "white" }}
              />
              <span className="reel_like_count">
                {likeCountLoading ? "..." : likeCount}
              </span>
            </span>
            <span className="reel_like_emoji">😊</span>
          </div>

          <div
            className={`reel_action_btn ${disliked ? "reel_disliked" : ""}`}
            onClick={handleDislike}
            style={{
              opacity: isActing ? 0.6 : 1,
              pointerEvents: isActing ? "none" : "auto",
            }}
          >
            <ThumbDownAltOutlinedIcon
              style={{ color: disliked ? "#ff0000" : "white" }}
            />
          </div>

          <div
            className="reel_action_btn"
            onClick={() => setShowComments((v) => !v)}
          >
            <ChatBubbleOutlineIcon
              style={{ color: showComments ? "#ff0000" : "white" }}
            />
            <span>{comments.length > 0 ? comments.length : "Comment"}</span>
          </div>

          <div className="reel_action_btn" onClick={handleShare}>
            <ReplyIcon style={{ color: "white", transform: "scaleX(-1)" }} />
            <span>Share</span>
          </div>
        </div>

        {showComments && (
          <div className="reel_comment_panel" ref={commentPanelRef}>
            {" "}
            {/* ← ref added */}
            <div className="reel_comment_input_row">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                placeholder="Add a comment..."
                className="reel_comment_input"
              />
              <button
                className="reel_comment_submit"
                onClick={handleCommentSubmit}
              >
                Post
              </button>
            </div>
            <div className="reel_comment_list">
              {comments.length === 0 ? (
                <div
                  className="reel_comment_item"
                  style={{ color: "#aaa", fontSize: "13px" }}
                >
                  No comments yet. Be the first!
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="reel_comment_item">
                    <span className="reel_comment_user">{c.user}</span>
                    <span className="reel_comment_text">{c.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {shareToast && (
          <div className="reel_share_toast">Link copied to clipboard ✓</div>
        )}

        <div className="reel_info">
          <div className="reel_user">
            <Link to={`/user/${reel.username}`}>
              <img
                src={reel.profilePic}
                alt="profile"
                className="reel_profile_pic"
              />
            </Link>
            <Link
              to={`/user/${reel.username}`}
              style={{ textDecoration: "none", color: "white" }}
            >
              <span className="reel_username">{reel.user}</span>
            </Link>
            {loggedInUser !== reel.username && (
              <button
                className="reel_subscribe_btn"
                onClick={handleSubscribe}
                style={{
                  background: subscribed ? "#555" : "#ff0000",
                  color: "white",
                }}
              >
                {subscribed ? "Subscribed" : "Subscribe"}
              </button>
            )}
          </div>
          <div className="reel_description">{reel.description}</div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Reels Page Component
// ─────────────────────────────────────────────
const Reels = () => {
  const { id } = useParams();
  const location = useLocation();
  const [dbReels, setDbReels] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const fetchDbReels = async () => {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setDbReels(
          data.map((r) => ({
            id: `db_${r.id}`,
            src: r.video_url,
            thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99",
            title: r.title || "Untitled",
            duration: r.duration || "00:00",
            user: r.user || r.username || "Unknown",
            username: r.username || "unknown",
            profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
            description: r.description || "",
            likes: 0,
          })),
        );
      }
      setDbLoading(false);
    };
    fetchDbReels();

    const reelsSub = supabase
      .channel("reels-page-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reels" },
        (payload) => {
          const r = payload.new;
          setDbReels((prev) => [
            {
              id: `db_${r.id}`,
              src: r.video_url,
              thumbnail:
                r.thumbnail || "https://picsum.photos/200/350?random=99",
              title: r.title || "Untitled",
              duration: r.duration || "00:00",
              user: r.user || r.username || "Unknown",
              username: r.username || "unknown",
              profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
              description: r.description || "",
              likes: 0,
            },
            ...prev,
          ]);
        },
      )
      .subscribe();

    return () => supabase.removeChannel(reelsSub);
  }, []);

  const baseReels = React.useMemo(() => {
    const merged = [...dbReels, ...reelsData];
    const seen = new Set();
    return merged.filter((r) => {
      const key = String(r.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dbReels]);

  const allReels = React.useMemo(() => {
    if (id) {
      const target = baseReels.find((r) => String(r.id) === String(id));
      if (target)
        return [
          target,
          ...baseReels.filter((r) => String(r.id) !== String(id)),
        ];
    }
    const clickedReel = location.state?.clickedReel;
    if (clickedReel) {
      const rest = baseReels.filter(
        (r) => String(r.id) !== String(clickedReel.id),
      );
      return [clickedReel, ...rest];
    }
    return baseReels;
  }, [baseReels, id, location.state]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.code === "ArrowDown") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = 0; i < items.length; i++) {
          const r = items[i].getBoundingClientRect();
          if (r.top >= 10) {
            items[i].scrollIntoView({ behavior: "smooth" });
            break;
          }
        }
      }
      if (e.code === "ArrowUp") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = items.length - 1; i >= 0; i--) {
          const r = items[i].getBoundingClientRect();
          if (r.top < -10) {
            items[i].scrollIntoView({ behavior: "smooth" });
            break;
          }
        }
      }
      if (e.code === "Space") {
        document.querySelectorAll(".reel_video").forEach((vid) => {
          const r = vid.getBoundingClientRect();
          if (r.top >= 0 && r.bottom <= window.innerHeight) {
            vid.paused ? vid.play() : vid.pause();
          }
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
        <p style={{ color: "#aaa", fontSize: "14px" }}>Loading reels...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="reels_container">
      {allReels.map((reel) => (
        <ReelItem key={reel.id} reel={reel} allReels={allReels} />
      ))}
    </div>
  );
};

export default Reels;
