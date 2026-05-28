import React, { useState, useRef, useEffect } from "react";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import "./reels.css";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../config/supabase";

export const reelsData = [
  { id: 1, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Jyoti", username: "jyoti", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 2, src: "https://www.w3schools.com/html/movie.mp4", user: "Laxminarayan", username: "laxminarayan", profilePic: "https://randomuser.me/api/portraits/women/2.jpg", thumbnail: "https://picsum.photos/200/350?random=2", title: "My Favourite Movie", duration: "0:53", description: "Another awesome reel 🎬", likes: 0 },
  { id: 3, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Anuradha", username: "anuradha", profilePic: "https://randomuser.me/api/portraits/men/3.jpg", thumbnail: "https://picsum.photos/200/350?random=3", title: "Funny Moments", duration: "0:32", description: "Beautiful Flower 🌸", likes: 0 },
  { id: 4, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Karthik", username: "karthik", profilePic: "https://randomuser.me/api/portraits/women/4.jpg", thumbnail: "https://picsum.photos/200/350?random=4", title: "Travel Vlog", duration: "0:53", description: "Friday Vibes 🎉", likes: 0 },
  { id: 5, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Shyamnarayan", username: "shyamnarayan", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 6, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Jaynarayan", username: "jaynarayan", profilePic: "https://randomuser.me/api/portraits/women/6.jpg", thumbnail: "https://picsum.photos/200/350?random=6", title: "Evening Vibes", duration: "0:53", description: "Sample Reel 🎥", likes: 0 },
  { id: 7, src: "https://www.w3schools.com/html/movie.mp4", user: "Gangeshwary", username: "gangeshwary", profilePic: "https://randomuser.me/api/portraits/men/7.jpg", thumbnail: "https://picsum.photos/200/350?random=7", title: "Morning Routine", duration: "0:32", description: "Cool Reel 🔥", likes: 0 },
  { id: 8, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Papa", username: "papa", profilePic: "https://randomuser.me/api/portraits/men/8.jpg", thumbnail: "https://picsum.photos/200/350?random=8", title: "Weekend Fun", duration: "0:53", description: "This is a cool reel 🔥", likes: 0 },
  { id: 9, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Mummy", username: "mummy", profilePic: "https://randomuser.me/api/portraits/women/9.jpg", thumbnail: "https://picsum.photos/200/350?random=9", title: "Kitchen Special", duration: "0:32", description: "Another awesome reel 🎬", likes: 0 },
  { id: 10, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Sandeep", username: "sandeep", profilePic: "https://randomuser.me/api/portraits/men/10.jpg", thumbnail: "https://picsum.photos/200/350?random=10", title: "City Life", duration: "0:53", description: "Beautiful Bulb", likes: 0 },
  { id: 11, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Mandeep", username: "Mandeep", profilePic: "https://randomuser.me/api/portraits/men/10.jpg", thumbnail: "https://picsum.photos/200/350?random=10", title: "City Life", duration: "0:53", description: "Beautiful Bulb", likes: 0 },
  { id: 12, src: "https://www.w3schools.com/html/movie.mp4", user: "Tillu", username: "Tillu", profilePic: "https://randomuser.me/api/portraits/men/10.jpg", thumbnail: "https://picsum.photos/200/350?random=10", title: "City Life", duration: "0:53", description: "Beautiful Bulb", likes: 0 },
  { id: 13, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Moti", username: "Moti", profilePic: "https://randomuser.me/api/portraits/men/10.jpg", thumbnail: "https://picsum.photos/200/350?random=10", title: "City Life", duration: "0:53", description: "Beautiful Bulb", likes: 0 },
  { id: 14, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Reena", username: "Reena", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 15, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Seema", username: "Seema", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 16, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Bipin", username: "Bipin", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 17, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Vivek", username: "Vivek", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 18, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Sheru", username: "Sheru", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 19, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Jiyalal", username: "Jiyalal", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 20, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Hiralal", username: "Hiralal", profilePic: "https://randomuser.me/api/portraits/men/1.jpg", thumbnail: "https://picsum.photos/200/350?random=1", title: "Big Buck Bunny", duration: "0:32", description: "This is a cool reel 🔥", likes: 0 },
  { id: 21, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Ramnayan", username: "ramnayan", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 22, src: "https://www.w3schools.com/html/movie.mp4", user: "Sunil", username: "sunil", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 23, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Kuneel", username: "kuneel", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 24, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Sonu", username: "sonu", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 25, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Monu", username: "monu", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 26, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Algu", username: "algu", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 27, src: "https://www.w3schools.com/html/movie.mp4", user: "Gyandeep", username: "gyandeep", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 28, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Sharmila", username: "sharmila", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 29, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Urmila", username: "urmila", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 30, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Ghanshyam", username: "ghanshyam", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 31, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Kapil", username: "kapil", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 32, src: "https://www.w3schools.com/html/movie.mp4", user: "Chandresh", username: "chandresh", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 33, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Kuldeep", username: "kuldeep", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 34, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Reela", username: "reela", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 35, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Sunita", username: "sunita", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 36, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Anita", username: "anita", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 37, src: "https://www.w3schools.com/html/movie.mp4", user: "Guddu", username: "guddu", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 38, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Kripal", username: "kripal", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 39, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Suresh", username: "suresh", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 40, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Dinanath", username: "dinanath", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 41, src: "https://www.w3schools.com/html/mov_bbb.mp4", user: "Gorakhnath", username: "gorakhnath", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 42, src: "https://www.w3schools.com/html/movie.mp4", user: "Shambhu", username: "shambhu", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 43, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", user: "Diwakar", username: "diwakar", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 44, src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4", user: "Sudhakar", username: "sudhakar", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
  { id: 45, src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4", user: "Prabhakar", username: "prabhakar", profilePic: "https://randomuser.me/api/portraits/men/5.jpg", thumbnail: "https://picsum.photos/200/350?random=5", title: "Nature Walk", duration: "0:32", description: "Unique Tea Making Procedure", likes: 0 },
];

// ─────────────────────────────────────────────
// Helper: detect video MIME type from URL
// ─────────────────────────────────────────────
const getVideoType = (src) => {
  if (src.includes(".mp4")) return "video/mp4";
  if (src.includes(".webm")) return "video/webm";
  if (src.includes(".mov")) return "video/quicktime";
  if (src.includes(".mkv")) return "video/x-matroska";
  if (src.includes(".avi")) return "video/x-msvideo";
  if (src.includes(".wmv")) return "video/x-ms-wmv";
  if (src.includes(".flv")) return "video/x-flv";
  return "video/mp4";
};

// ─────────────────────────────────────────────
// Helper: fetch real like/dislike count from DB
// ─────────────────────────────────────────────
const fetchCount = async (contentId, contentType, reactionType) => {
  const { count } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .match({ content_id: String(contentId), content_type: contentType, reaction_type: reactionType });
  return Math.max(0, count ?? 0); // ← NEVER negative
};

// ─────────────────────────────────────────────
// ReelItem Component
// ─────────────────────────────────────────────
const ReelItem = ({ reel }) => {
  const videoRef       = useRef(null);
  const containerRef   = useRef(null);
  const isMounted      = useRef(true);
  const observerRef    = useRef(null);
  const iconTimeoutRef = useRef(null);

  const loggedInUser = localStorage.getItem("username") || "Guest";

  // ── State ──────────────────────────────────
  const [subscribed,       setSubscribed]       = useState(false);
  const [liked,            setLiked]            = useState(false);
  const [disliked,         setDisliked]         = useState(false);
  const [likeCount,        setLikeCount]        = useState(0);
  const [dislikeCount,     setDislikeCount]     = useState(0);
  const [likeCountLoading, setLikeCountLoading] = useState(true);
  const [isActing,         setIsActing]         = useState(false); // covers both like & dislike
  const [muted,            setMuted]            = useState(false);
  const [isPlaying,        setIsPlaying]        = useState(false);
  const [showIcon,         setShowIcon]         = useState(false);
  const [showComments,     setShowComments]     = useState(false);
  const [commentText,      setCommentText]      = useState("");
  const [comments,         setComments]         = useState([]);
  const [shareToast,       setShareToast]       = useState(false);

  // ── Load like/dislike counts + user status from DB ──
  useEffect(() => {
    const loadReactions = async () => {
      const userId = localStorage.getItem("userId");

      // Fetch total like count — Math.max(0,...) prevents any negative display
      const lCount = await fetchCount(reel.id, "reel", "like");
      const dCount = await fetchCount(reel.id, "reel", "dislike");
      setLikeCount(lCount);
      setDislikeCount(dCount);
      setLikeCountLoading(false);

      if (!userId) return;

      // Check if this user already liked
      const { data: likeData } = await supabase
        .from("likes")
        .select("id")
        .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" })
        .maybeSingle();
      setLiked(!!likeData);

      // Check if this user already disliked
      const { data: dislikeData } = await supabase
        .from("likes")
        .select("id")
        .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" })
        .maybeSingle();
      setDisliked(!!dislikeData);
    };

    loadReactions();
  }, [reel.id]);

  // ── Load subscription status ───────────────
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

  // ── Load comments ──────────────────────────
  useEffect(() => {
    const loadComments = async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .match({ content_id: String(reel.id), content_type: "reel" })
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setComments(data.map((c) => ({
          id:   c.id,
          user: c.username,
          text: c.text,
          date: c.created_at?.slice(0, 10),
        })));
      }
    };
    loadComments();
  }, [reel.id]);

  // ── Subscribe / Unsubscribe ────────────────
  const handleSubscribe = async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to subscribe"); return; }
    if (userId === reel.username) { alert("You cannot subscribe to yourself"); return; }
    if (subscribed) {
      await supabase.from("subscriptions").delete().match({ subscriber_id: userId, subscribed_to: reel.username });
      setSubscribed(false);
    } else {
      const { error } = await supabase.from("subscriptions").insert({ subscriber_id: userId, subscribed_to: reel.username });
      if (!error) setSubscribed(true);
    }
  };

  // ── Add Comment ────────────────────────────
  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to comment"); return; }
    const { data, error } = await supabase
      .from("comments")
      .insert({ user_id: userId, username: loggedInUser, content_id: String(reel.id), content_type: "reel", text: commentText })
      .select()
      .single();
    if (!error && data) {
      setComments((prev) => [{ id: data.id, user: data.username, text: data.text, date: data.created_at?.slice(0, 10) }, ...prev]);
    }
    setCommentText("");
  };

  // ── Share ──────────────────────────────────
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  // ── YouTube helpers ────────────────────────
  const isYouTube = (url) => url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const getEmbedUrl = (url) => {
    if (url.includes("youtube.com/shorts/")) { const id = url.split("/shorts/")[1].split("?")[0]; return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    if (url.includes("watch?v="))            { const id = url.split("watch?v=")[1].split("&")[0];  return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    if (url.includes("youtu.be/"))           { const id = url.split("youtu.be/")[1].split("?")[0]; return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1`; }
    return url;
  };

  // ── Intersection Observer ──────────────────
  useEffect(() => {
    if (isYouTube(reel.src)) return;
    isMounted.current = true;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (!isMounted.current) return;
      if (entry.isIntersecting) {
        document.querySelectorAll("video").forEach((v) => { if (v !== video) v.pause(); });
        video.muted = muted;
        video.play().catch(() => {});
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, { threshold: 0.7 });
    observerRef.current.observe(container);
    return () => {
      isMounted.current = false;
      observerRef.current?.disconnect();
      clearTimeout(iconTimeoutRef.current);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ""; }
    };
  }, []);

  // ── Play/Pause flash ───────────────────────
  const flashIcon = () => {
    setShowIcon(true);
    clearTimeout(iconTimeoutRef.current);
    iconTimeoutRef.current = setTimeout(() => setShowIcon(false), 800);
  };

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setIsPlaying(true); }
    else              { video.pause();                 setIsPlaying(false); }
    flashIcon();
  };

  // ── Like handler ───────────────────────────
  // NOTE: If your "likes" table does NOT have a reaction_type column yet,
  // add it: ALTER TABLE likes ADD COLUMN reaction_type TEXT DEFAULT 'like';
  const handleLike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to like"); return; }
    if (isActing) return;
    setIsActing(true);
    try {
      if (liked) {
        // Toggle off like
        await supabase.from("likes").delete()
          .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" });
        setLiked(false);
      } else {
        // Remove any existing dislike first (mutual exclusion)
        if (disliked) {
          await supabase.from("likes").delete()
            .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" });
          setDisliked(false);
        }
        // Add like
        await supabase.from("likes").upsert(
          { user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" },
          { onConflict: "user_id,content_id,content_type,reaction_type" }
        );
        setLiked(true);
      }
      // Re-fetch real counts from DB
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally {
      setIsActing(false);
    }
  };

  // ── Dislike handler ────────────────────────
  const handleDislike = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) { alert("Please login to react"); return; }
    if (isActing) return;
    setIsActing(true);
    try {
      if (disliked) {
        // Toggle off dislike
        await supabase.from("likes").delete()
          .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" });
        setDisliked(false);
      } else {
        // Remove any existing like first (mutual exclusion)
        if (liked) {
          await supabase.from("likes").delete()
            .match({ user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "like" });
          setLiked(false);
        }
        // Add dislike
        await supabase.from("likes").upsert(
          { user_id: userId, content_id: String(reel.id), content_type: "reel", reaction_type: "dislike" },
          { onConflict: "user_id,content_id,content_type,reaction_type" }
        );
        setDisliked(true);
      }
      // Re-fetch real counts from DB
      setLikeCount(await fetchCount(reel.id, "reel", "like"));
      setDislikeCount(await fetchCount(reel.id, "reel", "dislike"));
    } finally {
      setIsActing(false);
    }
  };

  // ── Render ─────────────────────────────────
  return (
    <div className="reel_item" id={`reel-${reel.id}`} ref={containerRef}>
      <div className="reel_video_wrapper">

        {isYouTube(reel.src) ? (
          <iframe className="reel_video" src={getEmbedUrl(reel.src)} frameBorder="0" allow="autoplay; fullscreen" allowFullScreen title={reel.title} />
        ) : (
          <video ref={videoRef} className="reel_video" loop muted={muted} playsInline onClick={handleVideoClick}>
            <source src={reel.src} type={getVideoType(reel.src)} />
            Your browser does not support this video.
          </video>
        )}

        {!isYouTube(reel.src) && showIcon && (
          <div className="reel_play_icon">{isPlaying ? "▶" : "⏸"}</div>
        )}

        <div className="reel_actions">

          {/* Like button */}
          <div
            className={`reel_action_btn reel_like_btn ${liked ? "reel_liked" : ""}`}
            onClick={handleLike}
            style={{ opacity: isActing ? 0.6 : 1, pointerEvents: isActing ? "none" : "auto" }}
          >
            <span className="reel_like_inner">
              <ThumbUpOutlinedIcon style={{ color: liked ? "#ff0000" : "white" }} />
              <span className="reel_like_count">
                {likeCountLoading ? "..." : likeCount}
              </span>
            </span>
            <span className="reel_like_emoji">😊</span>
          </div>

          {/* Dislike button — now fully wired up */}
          <div
            className={`reel_action_btn ${disliked ? "reel_disliked" : ""}`}
            onClick={handleDislike}
            style={{ opacity: isActing ? 0.6 : 1, pointerEvents: isActing ? "none" : "auto" }}
          >
            <ThumbDownAltOutlinedIcon style={{ color: disliked ? "#ff0000" : "white" }} />
          </div>

          {/* Comment button */}
          <div className="reel_action_btn" onClick={() => setShowComments((v) => !v)}>
            <ChatBubbleOutlineIcon style={{ color: showComments ? "#ff0000" : "white" }} />
            <span>{comments.length > 0 ? comments.length : "Comment"}</span>
          </div>

          {/* Share button */}
          <div className="reel_action_btn" onClick={handleShare}>
            <ShareOutlinedIcon style={{ color: "white" }} />
            <span>Share</span>
          </div>
        </div>

        {/* Comment panel */}
        {showComments && (
          <div className="reel_comment_panel">
            <div className="reel_comment_input_row">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit()}
                placeholder="Add a comment..."
                className="reel_comment_input"
              />
              <button className="reel_comment_submit" onClick={handleCommentSubmit}>Post</button>
            </div>
            <div className="reel_comment_list">
              {comments.length === 0 ? (
                <div className="reel_comment_item" style={{ color: "#aaa", fontSize: "13px" }}>No comments yet. Be the first!</div>
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

        {shareToast && <div className="reel_share_toast">Link copied to clipboard</div>}

        <div className="reel_info">
          <div className="reel_user">
            <Link to={`/user/${reel.username}`}>
              <img src={reel.profilePic} alt="profile" className="reel_profile_pic" />
            </Link>
            <Link to={`/user/${reel.username}`} style={{ textDecoration: "none", color: "white" }}>
              <span className="reel_username">{reel.user}</span>
            </Link>
            <button
              className="reel_subscribe_btn"
              onClick={handleSubscribe}
              style={{ background: subscribed ? "#555" : "#ff0000", color: "white" }}
            >
              {subscribed ? "Subscribed" : "Subscribe"}
            </button>
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
  const location = useLocation();
  const [dbReels, setDbReels] = useState([]);

  useEffect(() => {
    const fetchDbReels = async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setDbReels(data.map((r) => ({
          id:          `db_${r.id}`,
          src:         r.video_url,
          thumbnail:   r.thumbnail || "https://picsum.photos/200/350?random=99",
          title:       r.title || "Untitled",
          duration:    r.duration || "00:00",
          user:        r.user || r.username || "Unknown",
          username:    r.username || "unknown",
          profilePic:  `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
          description: r.description || "",
          likes:       0,
        })));
      }
    };
    fetchDbReels();

    const reelsSub = supabase
      .channel("reels-page-channel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reels" }, (payload) => {
        const r = payload.new;
        setDbReels((prev) => [{
          id:          `db_${r.id}`,
          src:         r.video_url,
          thumbnail:   r.thumbnail || "https://picsum.photos/200/350?random=99",
          title:       r.title || "Untitled",
          duration:    r.duration || "00:00",
          user:        r.user || r.username || "Unknown",
          username:    r.username || "unknown",
          profilePic:  `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`,
          description: r.description || "",
          likes:       0,
        }, ...prev]);
      })
      .subscribe();

    return () => supabase.removeChannel(reelsSub);
  }, []);

  const clickedReel = location.state?.clickedReel;

  const baseReels = React.useMemo(() => {
    const merged = [...dbReels, ...reelsData];
    const seen   = new Set();
    return merged.filter((r) => { const key = String(r.id); if (seen.has(key)) return false; seen.add(key); return true; });
  }, [dbReels]);

  // In your Reels component, update the allReels useMemo:

const allReels = React.useMemo(() => {
    if (!clickedReel) return baseReels;

    // Only show reels from the same user when coming from a profile
    const userReels = baseReels.filter(
      (r) => String(r.username).toLowerCase() === String(clickedReel.username).toLowerCase()
    );
    const rest = userReels.filter(
      (r) => String(r.id) !== String(clickedReel.id)
    );
    return [clickedReel, ...rest];
  }, [baseReels, clickedReel]);

  useEffect(() => {
    if (clickedReel) window.scrollTo({ top: 0, behavior: "instant" });
  }, [clickedReel?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) { e.preventDefault(); e.stopPropagation(); }
      if (e.code === "ArrowDown") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (r.top >= 10) { items[i].scrollIntoView({ behavior: "smooth" }); break; } }
      }
      if (e.code === "ArrowUp") {
        const items = document.querySelectorAll(".reel_item");
        for (let i = items.length - 1; i >= 0; i--) { const r = items[i].getBoundingClientRect(); if (r.top < -10) { items[i].scrollIntoView({ behavior: "smooth" }); break; } }
      }
      if (e.code === "Space") {
        document.querySelectorAll(".reel_video").forEach((vid) => {
          const r = vid.getBoundingClientRect();
          if (r.top >= 0 && r.bottom <= window.innerHeight) { vid.paused ? vid.play() : vid.pause(); }
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="reels_container">
      {allReels.map((reel) => <ReelItem key={reel.id} reel={reel} />)}
    </div>
  );
};

export default Reels;