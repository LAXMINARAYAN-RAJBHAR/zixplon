import React, { useState, useEffect } from "react";
import "./profile.css";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { Link, useParams, useNavigate } from "react-router-dom";
import { reelsData } from "../../Component/Reels/reels";
import { supabase } from "../../config/supabase";

const allVideos = [
  { id: 7679, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s", title: "Big Buck Bunny open-source film", duration: "09:56", channel: "Gangeshwary" },
  { id: 2, thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg", title: "Sample Video 2", duration: "30:00", channel: "Mummy" },
  { id: 3, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s", title: "3d Lion Stock Photo", duration: "60:00", channel: "Papa" },
  { id: 4, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s", title: "Sample Video 4", duration: "10:00", channel: "Karthik" },
  { id: 5, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s", title: "8k Wallpaper 3d Photos", duration: "18:00", channel: "Annu" },
  { id: 6, thumbnail: "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg", title: "3D Animation Solutions", duration: "08:00", channel: "Jyoti" },
  { id: 7, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s", title: "3D Shapes | Types & Examples", duration: "28:00", channel: "Sarita" },
  { id: 8, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s", title: "3d Graphics Pictures", duration: "20:00", channel: "Jaynarayan" },
  { id: 9, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s", title: "Scenery 3d wallpaper", duration: "10:00", channel: "Shyamnarayan" },
  { id: 10, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s", title: "3D Nature Images", duration: "12:00", channel: "Rajbhar" },
  { id: 11, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s", title: "5,364,800+ 3d Images", duration: "13:30", channel: "Narayan" },
  { id: 12, thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s", title: "Understanding 3D Computer Graphics", duration: "20:50", channel: "Laxminarayan" },
];

const matchesKey = (candidate = "", key = "") => {
  if (!candidate || !key) return false;
  const c = candidate.toLowerCase();
  return c === key || c.replace(/\s+/g, "_") === key || c.replace(/\s+/g, ".") === key;
};

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const getUserGradient = (name = "") => {
  const colors = [
    ["#1a1a2e", "#e94560"], ["#0f0c29", "#302b63"], ["#134e5e", "#71b280"],
    ["#373b44", "#4286f4"], ["#c94b4b", "#4b134f"], ["#11998e", "#38ef7d"],
    ["#f46b45", "#eea849"], ["#4776e6", "#8e54e9"], ["#1d4350", "#a43931"], ["#134e5e", "#71b280"],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const pair = colors[Math.abs(hash) % colors.length];
  const angle = (Math.abs(hash) % 60) + 120;
  return `linear-gradient(${angle}deg, ${pair[0]}, ${pair[1]})`;
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ src, onClose }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
      <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "20px", background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: "22px", width: "40px", height: "40px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      <img src={src} alt="Full size" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "8px", boxShadow: "0 8px 48px rgba(0,0,0,0.8)", cursor: "default" }} />
    </div>
  );
};

// ─── Profile Post Card ────────────────────────────────────────────────────────
const ProfilePostCard = ({ post, isOwner, onDelete }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const totalReactions = Object.values(post.reactionCounts || {}).reduce((a, b) => a + b, 0);
  return (
    <>
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "16px", marginBottom: "14px", position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg,#ff4444,#cc0000)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "700", fontSize: "14px", flexShrink: 0 }}>
            {(post.username || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ color: "white", fontWeight: "600", fontSize: "14px" }}>
              {post.username}
              {post.feeling && <span style={{ color: "#aaa", fontWeight: "400", fontSize: "13px" }}> — feeling {post.feeling}</span>}
            </div>
            <div style={{ color: "#888", fontSize: "12px" }}>
              {timeAgo(post.created_at)}
              {post.privacy === "only_me" && " · 🔒"}
              {post.privacy === "friends" && " · 👥"}
              {post.privacy === "public" && " · 🌐"}
            </div>
          </div>
          {isOwner && (
            <button onClick={() => onDelete(post.id)} title="Delete post" style={{ marginLeft: "auto", background: "rgba(200,0,0,0.15)", border: "1px solid rgba(200,0,0,0.3)", color: "#ff6666", borderRadius: "8px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" }}>
              🗑️ Delete
            </button>
          )}
        </div>
        {/* Text */}
        {post.text && <p style={{ color: "#e0e0e0", fontSize: "14px", lineHeight: "1.6", margin: "0 0 12px" }}>{post.text}</p>}
        {/* Image */}
        {post.image_url && (
          <img src={post.image_url} alt="Post" onClick={() => setLightboxSrc(post.image_url)}
            style={{ width: "100%", maxHeight: "400px", objectFit: "cover", borderRadius: "8px", cursor: "zoom-in", marginBottom: "12px", display: "block" }} />
        )}
        {/* Link preview */}
        {post.link && (
          <a href={post.link.url} target="_blank" rel="noreferrer" style={{ display: "block", background: "#111", border: "1px solid #333", borderRadius: "8px", padding: "12px", textDecoration: "none", marginBottom: "12px" }}>
            <div style={{ color: "#888", fontSize: "11px", marginBottom: "4px" }}>{post.link.domain}</div>
            <div style={{ color: "#3ea6ff", fontSize: "14px", fontWeight: "600" }}>{post.link.title}</div>
          </a>
        )}
        {/* Stats bar */}
        <div style={{ display: "flex", gap: "16px", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #2a2a2a" }}>
          <span style={{ color: "#aaa", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
            <ThumbUpOutlinedIcon style={{ fontSize: "16px" }} /> {totalReactions}
          </span>
          <button onClick={() => setShowComments((v) => !v)} style={{ background: "none", border: "none", color: "#aaa", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}>
            <ChatBubbleOutlineIcon style={{ fontSize: "16px" }} />
            {post.comments?.length || 0} comment{post.comments?.length !== 1 ? "s" : ""}
          </button>
        </div>
        {/* Comments */}
        {showComments && post.comments?.length > 0 && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {post.comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>
                  {(c.username || "?").slice(0, 2).toUpperCase()}
                </div>
                <div style={{ background: "#262626", borderRadius: "8px", padding: "6px 10px", flex: 1 }}>
                  <div style={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}>{c.username}</div>
                  <div style={{ color: "#ccc", fontSize: "13px" }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

// ─── Main Profile Component ───────────────────────────────────────────────────
const Profile = ({ sideNavbar }) => {
  const { username } = useParams();
  const key = username?.toLowerCase();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("videos");
  const [user, setUser] = useState(null);
  const [dbVideos, setDbVideos] = useState([]);
  const [dbReels, setDbReels] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoCounts, setVideoCounts] = useState({});
  const [reelCounts, setReelCounts] = useState({});

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editPic, setEditPic] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const lsUsername = localStorage.getItem("username");
      const lsProfilePic = localStorage.getItem("profilePic");
      const lsAbout = localStorage.getItem("about");
      const lsEmail = localStorage.getItem("email");
      const lsBannerPic = localStorage.getItem("bannerPic");

      if (lsUsername && matchesKey(lsUsername, key)) {
        const { data: ownerProfile } = await supabase.from("profiles").select("banner_pic, profile_pic, about").eq("username", lsUsername).maybeSingle();
        const bannerPic = ownerProfile?.banner_pic || lsBannerPic || null;
        const profilePic = ownerProfile?.profile_pic || lsProfilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(lsUsername)}&background=ff0000&color=fff&size=120&length=2`;
        const about = ownerProfile?.about || lsAbout || `${lsUsername}'s channel`;
        if (bannerPic) localStorage.setItem("bannerPic", bannerPic);
        if (profilePic) localStorage.setItem("profilePic", profilePic);
        if (about) localStorage.setItem("about", about);
        setUser({ name: lsUsername, handle: `@${lsUsername}`, profilePic, about, email: lsEmail, isOwner: true, bannerPic });
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        const authUsername = authUser?.user_metadata?.channelName || authUser?.user_metadata?.username;
        if (authUsername && matchesKey(authUsername, key)) {
          const { data: ownerProfile } = await supabase.from("profiles").select("banner_pic, profile_pic, about").eq("username", authUsername).maybeSingle();
          const bannerPic = ownerProfile?.banner_pic || authUser.user_metadata?.bannerPic || lsBannerPic || null;
          const profilePic = ownerProfile?.profile_pic || authUser.user_metadata?.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUsername)}&background=ff0000&color=fff&size=120`;
          const about = ownerProfile?.about || authUser.user_metadata?.about || `${authUsername}'s channel`;
          setUser({ name: authUsername, handle: `@${authUsername}`, profilePic, about, email: authUser.email, isOwner: true, bannerPic });
          localStorage.setItem("username", authUsername);
          if (profilePic) localStorage.setItem("profilePic", profilePic);
          if (about) localStorage.setItem("about", about);
          if (bannerPic) localStorage.setItem("bannerPic", bannerPic);
        } else {
          let foundUser = null;
          const { data: profileRow } = await supabase.from("profiles").select("username, banner_pic, profile_pic, about").eq("username", key).maybeSingle();
          if (profileRow) {
            foundUser = { name: profileRow.username, handle: `@${profileRow.username}`, profilePic: profileRow.profile_pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileRow.username)}&background=ff0000&color=fff&size=120`, about: profileRow.about || `${profileRow.username}'s channel`, bannerPic: profileRow.banner_pic || null, isOwner: false };
          }
          if (!foundUser) {
            const { data: videoUserData } = await supabase.from("videos").select("channel, username").limit(200);
            if (videoUserData) {
              const match = videoUserData.find((v) => matchesKey(v.username, key) || matchesKey(v.channel, key));
              if (match) foundUser = { name: match.channel || match.username, handle: `@${match.username || match.channel}`, profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.channel || match.username)}&background=ff0000&color=fff&size=120`, about: `${match.channel || match.username}'s channel`, bannerPic: null, isOwner: false };
            }
          }
          if (!foundUser) {
            const { data: reelUserData } = await supabase.from("reels").select("username, user").limit(200);
            if (reelUserData) {
              const match = reelUserData.find((r) => matchesKey(r.username, key));
              if (match) foundUser = { name: match.user || match.username, handle: `@${match.username}`, profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.user || match.username)}&background=ff0000&color=fff&size=120`, about: `${match.user || match.username}'s channel`, bannerPic: null, isOwner: false };
            }
          }
          if (!foundUser) {
            const reelUser = reelsData.find((r) => matchesKey(r.username, key));
            if (reelUser) foundUser = { name: reelUser.user, handle: `@${reelUser.username}`, profilePic: reelUser.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${reelUser.user}`, about: `${reelUser.user}'s channel`, bannerPic: null, isOwner: false };
          }
          setUser(foundUser || null);
        }
      }

      // Fetch videos
      const { data: vData } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (vData) {
        setDbVideos(vData.filter((v) => matchesKey(v.username, key) || matchesKey(v.channel, key)).map((v) => ({ id: v.id, src: v.video_url, thumbnail: v.thumbnail_url, title: v.title, duration: v.duration || "00:00", channel: v.channel })));
        const ids = vData.map((v) => String(v.id));
        const [{ data: vLikes }, { data: vViews }] = await Promise.all([
          supabase.from("likes").select("content_id").eq("content_type", "video").in("content_id", ids),
          supabase.from("views").select("content_id").eq("content_type", "video").in("content_id", ids),
        ]);
        const counts = {};
        ids.forEach((id) => { counts[id] = { likes: vLikes?.filter((l) => l.content_id === id).length || 0, views: vViews?.filter((v) => v.content_id === id).length || 0 }; });
        setVideoCounts(counts);
      }

      // Fetch reels
      const { data: rData } = await supabase.from("reels").select("*").order("created_at", { ascending: false });
      if (rData) {
        setDbReels(rData.filter((r) => matchesKey(r.username, key)).map((r) => ({ id: `db_${r.id}`, dbId: r.id, src: r.video_url, thumbnail: r.thumbnail || "https://picsum.photos/200/350?random=99", title: r.title || "Untitled", duration: r.duration || "00:00", description: r.description || "", username: r.username, user: r.user || r.username, profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${r.username || "user"}`, likes: 0 })));
        const ids = rData.map((r) => `db_${r.id}`);
        const [{ data: rLikes }, { data: rViews }] = await Promise.all([
          supabase.from("likes").select("content_id").eq("content_type", "reel").in("content_id", ids),
          supabase.from("views").select("content_id").eq("content_type", "reel").in("content_id", ids),
        ]);
        const counts = {};
        ids.forEach((id) => { counts[id] = { likes: rLikes?.filter((l) => l.content_id === id).length || 0, views: rViews?.filter((v) => v.content_id === id).length || 0 }; });
        setReelCounts(counts);
      }

      // Fetch posts
      const { data: postsData } = await supabase
        .from("posts")
        .select(`*, post_reactions ( type, username ), post_comments ( id, text, username, created_at )`)
        .eq("username", key)
        .order("created_at", { ascending: false });
      if (postsData) {
        const currentUser = localStorage.getItem("username") || "";
        setUserPosts(postsData.map((p) => ({
          ...p,
          myReaction: p.post_reactions?.find((r) => r.username === currentUser)?.type || null,
          reactionCounts: p.post_reactions?.reduce((acc, r) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {}),
          comments: (p.post_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        })));
      }

      setLoading(false);
    };
    loadProfile();
  }, [key]);

  const hardcodedReels = reelsData.filter((r) => r.username?.toLowerCase() === key);
  const hardcodedVideos = allVideos.filter((v) => v.channel?.toLowerCase() === key);
  const allUserVideos = [...dbVideos, ...hardcodedVideos];
  const allUserReels = [...dbReels, ...hardcodedReels];

  const handleSaveProfile = async () => {
    const newName = editName.trim() || user.name;
    const newAbout = editAbout.trim() || user.about;
    const newPic = editPic.trim() || user.profilePic;
    localStorage.setItem("username", newName);
    localStorage.setItem("about", newAbout);
    localStorage.setItem("profilePic", newPic);
    await supabase.from("profiles").upsert({ username: newName, profile_pic: newPic, about: newAbout, banner_pic: user.bannerPic || null }, { onConflict: "username" });
    await supabase.auth.updateUser({ data: { channelName: newName, about: newAbout, profilePic: newPic } });
    setUser((prev) => ({ ...prev, name: newName, about: newAbout, profilePic: newPic, handle: `@${newName}` }));
    setShowEditProfile(false); setEditName(""); setEditAbout(""); setEditPic("");
  };

  const confirmDelete = (type, id, dbId, title) => setDeleteTarget({ type, id, dbId, title });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, dbId } = deleteTarget;
    if (type === "video") { await supabase.from("videos").delete().eq("id", id); setDbVideos((prev) => prev.filter((v) => v.id !== id)); }
    else if (type === "reel") { await supabase.from("reels").delete().eq("id", dbId); setDbReels((prev) => prev.filter((r) => r.dbId !== dbId)); }
    setDeleteTarget(null);
  };

  const handleDeletePost = async (postId) => {
    await supabase.from("posts").delete().eq("id", postId).eq("username", key);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "white", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: "40px", height: "40px", border: "4px solid #333", borderTop: "4px solid #ff4444", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ color: "white", padding: "40px", textAlign: "center", marginTop: "56px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>👤</div>
        <h2>No profile exists for "@{username}"</h2>
        <p style={{ color: "#aaa" }}>This user hasn't signed up yet.</p>
        <Link to="/" style={{ color: "#3ea6ff", textDecoration: "none", fontSize: "14px" }}>← Go Home</Link>
      </div>
    );
  }

  const tabStyle = (tab) => ({
    padding: "10px 20px", background: "none", border: "none",
    borderBottom: activeTab === tab ? "2px solid #ff0000" : "2px solid transparent",
    color: activeTab === tab ? "white" : "#aaa",
    fontWeight: activeTab === tab ? "700" : "400",
    fontSize: "14px", cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.3px",
  });

  return (
    <div className="profile">
      <SideNavbar sideNavbar={sideNavbar} />
      <div className={sideNavbar ? "profile_page" : "profile_page_inactive"}>

        {/* Banner */}
        <div style={{ width: "100%", height: "180px", borderRadius: "12px", marginBottom: "20px", position: "relative", overflow: "hidden", background: "#111", cursor: user.isOwner ? "pointer" : "default" }}
          onClick={() => user.isOwner && document.getElementById("bannerInput").click()}>
          {user.bannerPic ? (
            <img src={user.bannerPic} alt="channel banner" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <>
              <div style={{ position: "absolute", inset: 0, background: getUserGradient(user.name) }} />
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.05), transparent 60%)" }} />
            </>
          )}
          {user.isOwner && (
            <div style={{ position: "absolute", bottom: "10px", right: "14px", background: "rgba(0,0,0,0.6)", color: "white", fontSize: "12px", padding: "5px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
              🖼️ {user.bannerPic ? "Change Banner" : "Add Banner"}
            </div>
          )}
          <input type="file" id="bannerInput" accept="image/*" style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              const formData = new FormData();
              formData.append("file", file); formData.append("upload_preset", "youtube-clone");
              try {
                const res = await fetch("https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload", { method: "POST", body: formData });
                const data = await res.json(); const url = data.secure_url;
                localStorage.setItem("bannerPic", url);
                await supabase.auth.updateUser({ data: { bannerPic: url } });
                await supabase.from("profiles").upsert({ username: localStorage.getItem("username"), banner_pic: url, profile_pic: localStorage.getItem("profilePic") || user.profilePic, about: localStorage.getItem("about") || user.about }, { onConflict: "username" });
                setUser((prev) => ({ ...prev, bannerPic: url }));
              } catch { alert("Banner upload failed. Try again."); }
            }}
          />
        </div>

        {/* Top Section */}
        <div className="profile_top_section">
          <div className="profile_top_section_profile">
            <img className="profile_top_section_img" src={user.profilePic} alt={user.name}
              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff0000&color=fff&size=120&length=2`; }} />
          </div>
          <div className="profile_top_section_About">
            <div className="profile_top_section_About_Name">{user.name}</div>
            <div className="profile_top_section_info">
              {user.handle} · {allUserVideos.length} videos · {allUserReels.length} reels · {userPosts.length} posts
            </div>
            <div className="profile_top_section_info">{user.about}</div>
            {user.isOwner && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                <Link to="/763/upload" style={{ background: "#ff0000", color: "white", border: "none", borderRadius: "20px", padding: "8px 20px", fontSize: "14px", fontWeight: "600", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
                  + Upload Video / Reel
                </Link>
                <button onClick={() => { setEditName(user.name); setEditAbout(user.about); setEditPic(user.profilePic); setShowEditProfile(true); }}
                  style={{ background: "#272727", color: "white", border: "1px solid #555", borderRadius: "20px", padding: "8px 20px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                  ✏️ Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", borderBottom: "1px solid #2a2a2a", marginBottom: "24px", marginTop: "8px", gap: "4px" }}>
          <button style={tabStyle("videos")} onClick={() => setActiveTab("videos")}>🎬 Videos ({allUserVideos.length})</button>
          <button style={tabStyle("reels")} onClick={() => setActiveTab("reels")}>📱 Reels ({allUserReels.length})</button>
          <button style={tabStyle("posts")} onClick={() => setActiveTab("posts")}>📝 Posts ({userPosts.length})</button>
        </div>

        {/* Videos Tab */}
        {activeTab === "videos" && (
          allUserVideos.length === 0
            ? <div style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}>No videos uploaded yet.</div>
            : <div className="profileVideos">
                {allUserVideos.map((video) => (
                  <div key={video.id} style={{ position: "relative" }}>
                    <Link to={`/video/${video.id}`} className="profileVideo_block">
                      <div className="profileVideo_block_thumbnail reel-thumb" style={{ position: "relative" }}>
                        <img className="profileVideo_block_thumbnail_img" src={video.thumbnail} alt={video.title} />
                        <span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.75)", color: "white", fontSize: "11px", padding: "2px 5px", borderRadius: "4px" }}>{video.duration}</span>
                      </div>
                      <div className="profileVideo_block_detail">
                        <div className="profileVideo_block_detai_name">{video.title}</div>
                        <div className="profileVideo_block_detai_about">{video.channel}</div>
                        <div style={{ color: "#aaa", fontSize: "12px", marginTop: "4px", display: "flex", gap: "10px" }}>
                          <span>👁 {videoCounts[String(video.id)]?.views ?? 0}</span>
                          <span>👍 {videoCounts[String(video.id)]?.likes ?? 0}</span>
                        </div>
                      </div>
                    </Link>
                    {user.isOwner && !String(video.id).startsWith("hard_") && typeof video.id === "number" && (
                      <button onClick={() => confirmDelete("video", video.id, null, video.title)} title="Delete video" style={deleteBtn}>🗑️</button>
                    )}
                  </div>
                ))}
              </div>
        )}

        {/* Reels Tab */}
        {activeTab === "reels" && (
          allUserReels.length === 0
            ? <div style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}>No reels uploaded yet.</div>
            : <div className="profileVideos">
                {allUserReels.map((reel) => (
                  <div key={reel.id} style={{ position: "relative" }}>
                    <div className="profileVideo_block" style={{ cursor: "pointer" }}
                      onClick={() => navigate("/reels", { state: { clickedReel: { ...reel, user: reel.user || user.name, username: reel.username || key, profilePic: reel.profilePic || user.profilePic, likes: reel.likes || 0 } } })}>
                      <div className="profileVideo_block_thumbnail" style={{ position: "relative" }}>
                        <img className="profileVideo_block_thumbnail_img" src={reel.thumbnail} alt={reel.title} />
                        <span style={{ position: "absolute", top: "6px", left: "6px", background: "rgba(0,0,0,0.7)", color: "white", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>🎬 Reel</span>
                        <span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.7)", color: "white", fontSize: "11px", padding: "2px 5px", borderRadius: "4px" }}>{reel.duration}</span>
                      </div>
                      <div className="profileVideo_block_detail">
                        <div className="profileVideo_block_detai_name">{reel.title}</div>
                        <div className="profileVideo_block_detai_about">{reel.description}</div>
                        <div style={{ color: "#aaa", fontSize: "12px", marginTop: "4px", display: "flex", gap: "10px" }}>
                          <span>👁 {reelCounts[`db_${reel.dbId}`]?.views ?? 0}</span>
                          <span>👍 {reelCounts[String(reel.dbId)]?.likes ?? 0}</span>
                        </div>
                      </div>
                    </div>
                    {user.isOwner && reel.id.startsWith("db_") && (
                      <button onClick={() => confirmDelete("reel", reel.id, reel.dbId, reel.title)} title="Delete reel" style={deleteBtn}>🗑️</button>
                    )}
                  </div>
                ))}
              </div>
        )}

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            {userPosts.length === 0
              ? <div style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}><div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div><p>No posts yet.</p></div>
              : userPosts.map((post) => (
                  <ProfilePostCard key={post.id} post={post} isOwner={user.isOwner} onDelete={handleDeletePost} />
                ))
            }
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div style={{ background: "#212121", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "440px", border: "1px solid #333", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ color: "white", margin: 0, fontSize: "20px" }}>✏️ Edit Profile</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <img src={editPic || user.profilePic} alt="preview" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ff0000" }}
                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editName || user.name)}&background=ff0000&color=fff&size=72`; }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>Paste Image URL</p>
                <input value={editPic} onChange={(e) => setEditPic(e.target.value)} placeholder="https://..." style={{ width: "100%", background: "#2a2a2a", border: "1px solid #444", borderRadius: "8px", color: "white", padding: "8px 12px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>Or upload a new photo:</p>
              <input type="file" accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  setEditLoading(true);
                  const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", "youtube-clone");
                  try { const res = await fetch("https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload", { method: "POST", body: formData }); const data = await res.json(); setEditPic(data.secure_url); }
                  catch { alert("Upload failed. Try again."); }
                  setEditLoading(false);
                }} style={{ color: "#aaa", fontSize: "13px" }} />
              {editLoading && <p style={{ color: "#ff9800", fontSize: "12px", margin: "4px 0 0" }}>Uploading photo...</p>}
            </div>
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>Channel Name</p>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={user.name} style={{ width: "100%", background: "#2a2a2a", border: "1px solid #444", borderRadius: "8px", color: "white", padding: "10px 12px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>About</p>
              <input value={editAbout} onChange={(e) => setEditAbout(e.target.value)} placeholder={user.about} style={{ width: "100%", background: "#2a2a2a", border: "1px solid #444", borderRadius: "8px", color: "white", padding: "10px 12px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleSaveProfile} disabled={editLoading} style={{ flex: 1, background: editLoading ? "#555" : "#ff0000", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "700", cursor: editLoading ? "not-allowed" : "pointer" }}>
                {editLoading ? "Uploading..." : "Save Changes"}
              </button>
              <button onClick={() => { setShowEditProfile(false); setEditName(""); setEditAbout(""); setEditPic(""); }} style={{ flex: 1, background: "none", border: "1px solid #555", color: "#aaa", borderRadius: "8px", padding: "12px", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ background: "#212121", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "380px", border: "1px solid #555", display: "flex", flexDirection: "column", gap: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "40px" }}>🗑️</div>
            <h2 style={{ color: "white", margin: 0, fontSize: "18px" }}>Delete {deleteTarget.type}?</h2>
            <p style={{ color: "#aaa", fontSize: "14px", margin: 0 }}>
              "<strong style={{ color: "white" }}>{deleteTarget.title}</strong>" will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDelete} style={{ flex: 1, background: "#cc0000", color: "white", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>Yes, Delete</button>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, background: "none", border: "1px solid #555", color: "#aaa", borderRadius: "8px", padding: "12px", fontSize: "14px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const deleteBtn = { position: "absolute", top: "6px", right: "6px", background: "rgba(200,0,0,0.85)", border: "none", borderRadius: "6px", color: "white", fontSize: "14px", padding: "4px 7px", cursor: "pointer", zIndex: 10, lineHeight: 1 };

export default Profile;