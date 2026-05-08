import React, { useState, useRef, useEffect } from "react";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import "./reels.css";
import { Link, useLocation } from "react-router-dom";

export const reelsData = [
  {
    id: 1,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jyoti",
    username: "jyoti",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 2,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Laxminarayan",
    username: "laxminarayan",
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
    thumbnail: "https://picsum.photos/200/350?random=2",
    title: "My Favourite Movie",
    duration: "0:53",
    description: "Another awesome reel 🎬",
    likes: 98,
  },
  {
    id: 3,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Anuradha",
    username: "anuradha",
    profilePic: "https://randomuser.me/api/portraits/men/3.jpg",
    thumbnail: "https://picsum.photos/200/350?random=3",
    title: "Funny Moments",
    duration: "0:32",
    description: "Beautiful Flower 🌸",
    likes: 210,
  },
  {
    id: 4,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Karthik",
    username: "karthik",
    profilePic: "https://randomuser.me/api/portraits/women/4.jpg",
    thumbnail: "https://picsum.photos/200/350?random=4",
    title: "Travel Vlog",
    duration: "0:53",
    description: "Friday Vibes 🎉",
    likes: 175,
  },
  {
    id: 5,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 6,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jaynarayan",
    username: "jaynarayan",
    profilePic: "https://randomuser.me/api/portraits/women/6.jpg",
    thumbnail: "https://picsum.photos/200/350?random=6",
    title: "Evening Vibes",
    duration: "0:53",
    description: "Sample Reel 🎥",
    likes: 290,
  },
  {
    id: 7,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Gangeshwary",
    username: "gangeshwary",
    profilePic: "https://randomuser.me/api/portraits/men/7.jpg",
    thumbnail: "https://picsum.photos/200/350?random=7",
    title: "Morning Routine",
    duration: "0:32",
    description: "Cool Reel 🔥",
    likes: 415,
  },
  {
    id: 8,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Papa",
    username: "papa",
    profilePic: "https://randomuser.me/api/portraits/men/8.jpg",
    thumbnail: "https://picsum.photos/200/350?random=8",
    title: "Weekend Fun",
    duration: "0:53",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 9,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Mummy",
    username: "mummy",
    profilePic: "https://randomuser.me/api/portraits/women/9.jpg",
    thumbnail: "https://picsum.photos/200/350?random=9",
    title: "Kitchen Special",
    duration: "0:32",
    description: "Another awesome reel 🎬",
    likes: 98,
  },
  {
    id: 10,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Sandeep",
    username: "sandeep",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 210,
  },
  {
    id: 11,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Mandeep",
    username: "Mandeep",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 210,
  },
  {
    id: 12,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Tillu",
    username: "Tillu",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 210,
  },
  {
    id: 13,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Moti",
    username: "Moti",
    profilePic: "https://randomuser.me/api/portraits/men/10.jpg",
    thumbnail: "https://picsum.photos/200/350?random=10",
    title: "City Life",
    duration: "0:53",
    description: "Beautiful Bulb",
    likes: 210,
  },
  {
    id: 14,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Reena",
    username: "Reena",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 15,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Seema",
    username: "Seema",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 16,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Bipin",
    username: "Bipin",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 17,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Vivek",
    username: "Vivek",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 18,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Sheru",
    username: "Sheru",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 19,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Jiyalal",
    username: "Jiyalal",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 20,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Hiralal",
    username: "Hiralal",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
    thumbnail: "https://picsum.photos/200/350?random=1",
    title: "Big Buck Bunny",
    duration: "0:32",
    description: "This is a cool reel 🔥",
    likes: 120,
  },
  {
    id: 21,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 22,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 23,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 24,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 25,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 26,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 27,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 28,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 29,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 30,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 31,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 32,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 33,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 34,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 35,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 36,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 37,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 38,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 39,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 40,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 41,
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 42,
    src: "https://www.w3schools.com/html/movie.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 43,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 44,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
  {
    id: 45,
    src: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    user: "Shyamnarayan",
    username: "shyamnarayan",
    profilePic: "https://randomuser.me/api/portraits/men/5.jpg",
    thumbnail: "https://picsum.photos/200/350?random=5",
    title: "Nature Walk",
    duration: "0:32",
    description: "Unique Tea Making Procedure",
    likes: 340,
  },
];

// Add this helper function above ReelItem
const getVideoType = (src) => {
  if (src.includes(".mp4")) return "video/mp4";
  if (src.includes(".webm")) return "video/webm";
  if (src.includes(".mov")) return "video/quicktime";
  if (src.includes(".mkv")) return "video/x-matroska";
  if (src.includes(".avi")) return "video/x-msvideo";
  if (src.includes(".wmv")) return "video/x-ms-wmv";
  if (src.includes(".flv")) return "video/x-flv";
  return "video/mp4"; // default fallback
};

// ✅ ReelItem — NO navigate here, it belongs in the thumbnail list
const ReelItem = ({ reel }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const isMounted = useRef(true);
  const observerRef = useRef(null);
  const iconTimeoutRef = useRef(null);

  const isYouTube = (url) =>
    url.includes("youtube.com") || url.includes("youtu.be");

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

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
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
            onClick={handleVideoClick}
          >
            <source src={reel.src} type={getVideoType(reel.src)} />
            {/* WebM fallback if you have one */}
            Your browser does not support this video.
          </video>
        )}

        {!isYouTube(reel.src) && showIcon && (
          <div className="reel_play_icon">{isPlaying ? "▶" : "⏸"}</div>
        )}

        <div className="reel_actions">
          <div className="reel_action_btn" onClick={() => setLiked(!liked)}>
            <ThumbUpOutlinedIcon
              style={{ color: liked ? "#ff0000" : "white" }}
            />
            <span>{liked ? reel.likes + 1 : reel.likes}</span>
          </div>
          <div className="reel_action_btn">
            <ThumbDownAltOutlinedIcon style={{ color: "white" }} />
          </div>
          <div className="reel_action_btn">
            <ChatBubbleOutlineIcon style={{ color: "white" }} />
            <span>Comment</span>
          </div>
          <div className="reel_action_btn" onClick={toggleMute}>
            <ShareOutlinedIcon style={{ color: "white" }} />
            <span>Share</span>
          </div>
        </div>

        <div className="reel_info">
          <div className="reel_user">
            <Link to={`/profile/${reel.username}`}>
              <img
                src={reel.profilePic}
                alt="profile"
                className="reel_profile_pic"
              />
            </Link>
            <Link
              to={`/profile/${reel.username}`}
              style={{ textDecoration: "none", color: "white" }}
            >
              <span className="reel_username">{reel.user}</span>
            </Link>
            <button className="reel_subscribe_btn">Subscribe</button>
          </div>
          <div className="reel_description">{reel.description}</div>
        </div>
      </div>
    </div>
  );
};

// ✅ Reels — reads reelId from location state and scrolls to it
const Reels = () => {
  const location = useLocation();

  // ADD THIS
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault(); // ✅ stops footer appearing + stops page scroll
        e.stopPropagation();
      }

      if (e.code === "ArrowDown") {
        // Scroll to next reel
        const reelItems = document.querySelectorAll(".reel_item");
        for (let i = 0; i < reelItems.length; i++) {
          const rect = reelItems[i].getBoundingClientRect();
          if (rect.top >= 10) {
            // find first reel not yet fully scrolled past
            reelItems[i].scrollIntoView({ behavior: "smooth" });
            break;
          }
        }
      }

      if (e.code === "ArrowUp") {
        // Scroll to prev reel
        const reelItems = document.querySelectorAll(".reel_item");
        for (let i = reelItems.length - 1; i >= 0; i--) {
          const rect = reelItems[i].getBoundingClientRect();
          if (rect.top < -10) {
            // find last reel scrolled above viewport
            reelItems[i].scrollIntoView({ behavior: "smooth" });
            break;
          }
        }
      }

      if (e.code === "Space") {
        // Pause/play the currently visible video
        const videos = document.querySelectorAll(".reel_video");
        videos.forEach((vid) => {
          const rect = vid.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
          if (isVisible) {
            vid.paused ? vid.play() : vid.pause();
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="reels_container">
      {reelsData.map((reel) => (
        <ReelItem key={reel.id} reel={reel} />
      ))}
    </div>
  );
};

export default Reels;
