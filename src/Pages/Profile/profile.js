import React, { useState, useEffect } from "react";
import "./profile.css";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import { Link, useParams } from "react-router-dom";
import { reelsData } from "../../Component/Reels/reels";
import { supabase } from "../../config/supabase";

const allVideos = [
  {
    id: 7679,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu-l3JR0guZspKsBZkVoakjkQ-qxUCCpkQnw&s",
    title: "Big Buck Bunny open-source film",
    duration: "09:56",
    channel: "Gangeshwary",
  },
  {
    id: 2,
    thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg",
    title: "Sample Video 2",
    duration: "30:00",
    channel: "Mummy",
  },
  {
    id: 3,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwyNTbTLzlbDj6RSQdV6imNyxNywT3pchKKg&s",
    title: "3d Lion Stock Photo",
    duration: "60:00",
    channel: "Papa",
  },
  {
    id: 4,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpWv_QvC-7P4_8Ubbg2rwn0Om4APOgf6B3yA&s",
    title: "Sample Video 4",
    duration: "10:00",
    channel: "Karthik",
  },
  {
    id: 5,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZleDiTkppd2k7GVmREMQRs8D8JBbNXuuxUA&s",
    title: "8k Wallpaper 3d Photos",
    duration: "18:00",
    channel: "Annu",
  },
  {
    id: 6,
    thumbnail:
      "https://damassets.autodesk.net/content/dam/autodesk/www/industry/3d-animation/create-beautiful-3d-animations-thumb-1204x677.jpg",
    title: "3D Animation Solutions",
    duration: "08:00",
    channel: "Jyoti",
  },
  {
    id: 7,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMxQZtpZz8NgMYzzNMiBm-n4h2oGYovjK2lQ&s",
    title: "3D Shapes | Types & Examples",
    duration: "28:00",
    channel: "Sarita",
  },
  {
    id: 8,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSK5izd-jLAR_UjqnUULPW42Pv_LIpL0W60cQ&s",
    title: "3d Graphics Pictures",
    duration: "20:00",
    channel: "Jaynarayan",
  },
  {
    id: 9,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN6EQg2_-8zTqUk1YRvLpJinJk67VF0wEZfg&s",
    title: "Scenery 3d wallpaper",
    duration: "10:00",
    channel: "Shyamnarayan",
  },
  {
    id: 10,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRS5r-8k6FyUEN9OYQu5WgyyNqT8lrqgw7dCQ&s",
    title: "3D Nature Images",
    duration: "12:00",
    channel: "Rajbhar",
  },
  {
    id: 11,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQeUzhAtZL9ElXiENfplVjR5dCJsUQUG2NuXg&s",
    title: "5,364,800+ 3d Images",
    duration: "13:30",
    channel: "Narayan",
  },
  {
    id: 12,
    thumbnail:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdcK3NWfTM_cOjFOH6ArcBdUbu29e0AVjFZw&s",
    title: "Understanding 3D Computer Graphics",
    duration: "20:50",
    channel: "Laxminarayan",
  },
];

const Profile = ({ sideNavbar }) => {
  const { username } = useParams();
  const key = username?.toLowerCase();

  const [user, setUser] = useState(null);
  const [dbVideos, setDbVideos] = useState([]);
  const [dbReels, setDbReels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editPic, setEditPic] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);

      const loggedInUsername = localStorage.getItem("username");
      const loggedInProfilePic = localStorage.getItem("profilePic");
      const loggedInAbout = localStorage.getItem("about");
      const loggedInEmail = localStorage.getItem("email");

      // Normalize key for comparison
      const normalizedKey = key?.toLowerCase().replace(/\s+/g, "_");

      // ── Check if this is the logged-in user ──
      const isLoggedInUser =
        loggedInUsername &&
        (loggedInUsername.toLowerCase() === key ||
          loggedInUsername.toLowerCase().replace(/\s+/g, "_") === key ||
          loggedInUsername.toLowerCase().replace(/\s+/g, ".") === key);

      if (isLoggedInUser) {
        setUser({
          name: loggedInUsername,
          handle: `@${loggedInUsername}`,
          profilePic:
            loggedInProfilePic ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(loggedInUsername)}&background=ff0000&color=fff&size=120`,
          about: loggedInAbout || `${loggedInUsername}'s channel`,
          email: loggedInEmail,
          isOwner: true,
        });
      } else {
        // ── Try Supabase auth user ──
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        const authUsername =
          authUser?.user_metadata?.channelName ||
          authUser?.user_metadata?.username;

        const isAuthUser =
          authUsername &&
          (authUsername.toLowerCase() === key ||
            authUsername.toLowerCase().replace(/\s+/g, "_") === key ||
            authUsername.toLowerCase().replace(/\s+/g, ".") === key);

        if (isAuthUser) {
          setUser({
            name: authUsername,
            handle: `@${authUsername}`,
            profilePic:
              authUser.user_metadata?.profilePic ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(authUsername)}&background=ff0000&color=fff&size=120`,
            about: authUser.user_metadata?.about || `${authUsername}'s channel`,
            email: authUser.email,
            isOwner: true,
          });
        } else {
          // ── Try to find user from DB videos ──
          const { data: videoUserData } = await supabase
            .from("videos")
            .select("channel, username")
            .limit(100);

          let foundUser = null;

          if (videoUserData) {
            const match = videoUserData.find((v) => {
              const uname = (v.username || "").toLowerCase();
              const cname = (v.channel || "").toLowerCase();
              return (
                uname === key ||
                uname.replace(/\s+/g, "_") === key ||
                uname.replace(/\s+/g, ".") === key ||
                cname === key ||
                cname.replace(/\s+/g, "_") === key ||
                cname.replace(/\s+/g, ".") === key
              );
            });
            if (match) {
              foundUser = {
                name: match.channel || match.username,
                handle: `@${match.username || match.channel}`,
                profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.channel || match.username)}&background=ff0000&color=fff&size=120`,
                about: `${match.channel || match.username}'s channel`,
                isOwner: false,
              };
            }
          }

          // ── Try reels DB ──
          if (!foundUser) {
            const { data: reelUserData } = await supabase
              .from("reels")
              .select("username, user")
              .limit(100);

            if (reelUserData) {
              const match = reelUserData.find((r) => {
                const uname = (r.username || "").toLowerCase();
                return (
                  uname === key ||
                  uname.replace(/\s+/g, "_") === key ||
                  uname.replace(/\s+/g, ".") === key
                );
              });
              if (match) {
                foundUser = {
                  name: match.user || match.username,
                  handle: `@${match.username}`,
                  profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(match.user || match.username)}&background=ff0000&color=fff&size=120`,
                  about: `${match.user || match.username}'s channel`,
                  isOwner: false,
                };
              }
            }
          }

          // ── Try hardcoded reelsData ──
          if (!foundUser) {
            const reelUser = reelsData.find((r) => {
              const uname = (r.username || "").toLowerCase();
              return (
                uname === key ||
                uname.replace(/\s+/g, "_") === key ||
                uname.replace(/\s+/g, ".") === key
              );
            });
            if (reelUser) {
              foundUser = {
                name: reelUser.user,
                handle: `@${reelUser.username}`,
                profilePic:
                  reelUser.profilePic ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${reelUser.user}`,
                about: `${reelUser.user}'s channel`,
                isOwner: false,
              };
            }
          }

          setUser(foundUser || null);
        }
      }

      // ── Fetch DB videos for this user ──
      const { data: vData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (vData) {
        setDbVideos(
          vData
            .filter((v) => {
              const uname = (v.username || "").toLowerCase();
              const cname = (v.channel || "").toLowerCase();
              return (
                uname === key ||
                uname.replace(/\s+/g, "_") === key ||
                uname.replace(/\s+/g, ".") === key ||
                cname === key ||
                cname.replace(/\s+/g, "_") === key ||
                cname.replace(/\s+/g, ".") === key
              );
            })
            .map((v) => ({
              id: v.id,
              src: v.video_url,
              thumbnail: v.thumbnail_url,
              title: v.title,
              duration: v.duration || "00:00",
              channel: v.channel,
            })),
        );
      }

      // ── Fetch DB reels for this user ──
      const { data: rData } = await supabase
        .from("reels")
        .select("*")
        .order("created_at", { ascending: false });

      if (rData) {
        setDbReels(
          rData
            .filter((r) => {
              const uname = (r.username || "").toLowerCase();
              return (
                uname === key ||
                uname.replace(/\s+/g, "_") === key ||
                uname.replace(/\s+/g, ".") === key
              );
            })
            .map((r) => ({
              id: r.id,
              src: r.video_url,
              thumbnail:
                r.thumbnail || "https://picsum.photos/200/350?random=99",
              title: r.title || "Untitled",
              duration: r.duration || "00:00",
              description: r.description || "",
              username: r.username,
            })),
        );
      }

      setLoading(false);
    };

    loadProfile();
  }, [key]);

  const hardcodedReels = reelsData.filter(
    (r) => r.username?.toLowerCase() === key,
  );
  const hardcodedVideos = allVideos.filter(
    (v) => v.channel?.toLowerCase() === key,
  );
  const allUserVideos = [...dbVideos, ...hardcodedVideos];
  const allUserReels = [...dbReels, ...hardcodedReels];

  const handleSaveProfile = async () => {
    const newName = editName.trim() || user.name;
    const newAbout = editAbout.trim() || user.about;
    const newPic = editPic.trim() || user.profilePic;

    localStorage.setItem("username", newName);
    localStorage.setItem("about", newAbout);
    localStorage.setItem("profilePic", newPic);

    await supabase.auth.updateUser({
      data: { channelName: newName, about: newAbout, profilePic: newPic },
    });

    setUser((prev) => ({
      ...prev,
      name: newName,
      about: newAbout,
      profilePic: newPic,
      handle: `@${newName}`,
    }));

    setShowEditProfile(false);
    setEditName("");
    setEditAbout("");
    setEditPic("");
  };

  if (loading) {
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
            width: "40px",
            height: "40px",
            border: "4px solid #333",
            borderTop: "4px solid #ff4444",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          color: "white",
          padding: "40px",
          textAlign: "center",
          marginTop: "56px",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>👤</div>
        <h2>No profile exists for "@{username}"</h2>
        <p style={{ color: "#aaa" }}>This user hasn't signed up yet.</p>
        <Link
          to="/"
          style={{ color: "#3ea6ff", textDecoration: "none", fontSize: "14px" }}
        >
          ← Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="profile">
      <SideNavbar sideNavbar={sideNavbar} />

      <div className={sideNavbar ? "profile_page" : "profile_page_inactive"}>
        {/* ── Banner ── */}
        <div
          style={{
            width: "100%",
            height: "180px",
            background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
            borderRadius: "12px",
            marginBottom: "20px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 30% 50%, rgba(255,0,0,0.15), transparent 60%)",
            }}
          />
        </div>

        {/* ── Top Section ── */}
        <div className="profile_top_section">
          <div className="profile_top_section_profile">
            <img
              className="profile_top_section_img"
              src={user.profilePic}
              alt={user.name}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff0000&color=fff&size=120`;
              }}
            />
          </div>
          <div className="profile_top_section_About">
            <div className="profile_top_section_About_Name">{user.name}</div>
            <div className="profile_top_section_info">
              {user.handle} · {allUserVideos.length} videos ·{" "}
              {allUserReels.length} reels
            </div>
            <div className="profile_top_section_info">{user.about}</div>

            {user.isOwner && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "8px",
                }}
              >
                <Link
                  to="/763/upload"
                  style={{
                    background: "#ff0000",
                    color: "white",
                    border: "none",
                    borderRadius: "20px",
                    padding: "8px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  + Upload Video / Reel
                </Link>
                <button
                  onClick={() => {
                    setEditName(user.name);
                    setEditAbout(user.about);
                    setEditPic(user.profilePic);
                    setShowEditProfile(true);
                  }}
                  style={{
                    background: "#272727",
                    color: "white",
                    border: "1px solid #555",
                    borderRadius: "20px",
                    padding: "8px 20px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  ✏️ Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Videos Section ── */}
        {allUserVideos.length > 0 && (
          <div className="profile_videos">
            <div className="profile_videos_title">
              Videos ({allUserVideos.length}) &nbsp;
              <ArrowRightIcon />
            </div>
            <div className="profileVideos">
              {allUserVideos.map((video) => (
                <Link
                  to={`/video/${video.id}`}
                  key={video.id}
                  className="profileVideo_block"
                >
                  <div
                    className="profileVideo_block_thumbnail"
                    style={{ position: "relative" }}
                  >
                    <img
                      className="profileVideo_block_thumbnail_img"
                      src={video.thumbnail}
                      alt={video.title}
                    />
                    <span
                      style={{
                        position: "absolute",
                        bottom: "6px",
                        right: "6px",
                        background: "rgba(0,0,0,0.75)",
                        color: "white",
                        fontSize: "11px",
                        padding: "2px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {video.duration}
                    </span>
                  </div>
                  <div className="profileVideo_block_detail">
                    <div className="profileVideo_block_detai_name">
                      {video.title}
                    </div>
                    <div className="profileVideo_block_detai_about">
                      {video.channel}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Reels Section ── */}
        {allUserReels.length > 0 && (
          <div className="profile_videos" style={{ marginTop: "30px" }}>
            <div className="profile_videos_title">
              Reels ({allUserReels.length}) &nbsp;
              <ArrowRightIcon />
            </div>
            <div className="profileVideos">
              {allUserReels.map((reel) => (
                <Link
                  to="/reels"
                  key={reel.id}
                  className="profileVideo_block"
                  state={{ reelId: reel.id }}
                >
                  <div
                    className="profileVideo_block_thumbnail"
                    style={{ position: "relative" }}
                  >
                    <img
                      className="profileVideo_block_thumbnail_img"
                      src={reel.thumbnail}
                      alt={reel.title}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: "6px",
                        left: "6px",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "600",
                      }}
                    >
                      🎬 Reel
                    </span>
                    <span
                      style={{
                        position: "absolute",
                        bottom: "6px",
                        right: "6px",
                        background: "rgba(0,0,0,0.7)",
                        color: "white",
                        fontSize: "11px",
                        padding: "2px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {reel.duration}
                    </span>
                  </div>
                  <div className="profileVideo_block_detail">
                    <div className="profileVideo_block_detai_name">
                      {reel.title}
                    </div>
                    <div className="profileVideo_block_detai_about">
                      {reel.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {allUserVideos.length === 0 && allUserReels.length === 0 && (
          <div
            style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}
          >
            No videos or reels uploaded yet.
          </div>
        )}
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) =>
            e.target === e.currentTarget && setShowEditProfile(false)
          }
        >
          <div
            style={{
              background: "#212121",
              borderRadius: "16px",
              padding: "32px",
              width: "100%",
              maxWidth: "440px",
              border: "1px solid #333",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h2 style={{ color: "white", margin: 0, fontSize: "20px" }}>
              ✏️ Edit Profile
            </h2>

            {/* Profile pic preview */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <img
                src={editPic || user.profilePic}
                alt="preview"
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #ff0000",
                }}
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(editName || user.name)}&background=ff0000&color=fff&size=72`;
                }}
              />
              <div style={{ flex: 1 }}>
                <p
                  style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}
                >
                  Paste Image URL
                </p>
                <input
                  value={editPic}
                  onChange={(e) => setEditPic(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: "100%",
                    background: "#2a2a2a",
                    border: "1px solid #444",
                    borderRadius: "8px",
                    color: "white",
                    padding: "8px 12px",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Upload photo */}
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>
                Or upload a new photo:
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setEditLoading(true);
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("upload_preset", "youtube-clone");
                  try {
                    const res = await fetch(
                      "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
                      { method: "POST", body: formData },
                    );
                    const data = await res.json();
                    setEditPic(data.secure_url);
                  } catch {
                    alert("Upload failed. Try again.");
                  }
                  setEditLoading(false);
                }}
                style={{ color: "#aaa", fontSize: "13px" }}
              />
              {editLoading && (
                <p
                  style={{
                    color: "#ff9800",
                    fontSize: "12px",
                    margin: "4px 0 0",
                  }}
                >
                  Uploading photo...
                </p>
              )}
            </div>

            {/* Channel Name */}
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>
                Channel Name
              </p>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={user.name}
                style={{
                  width: "100%",
                  background: "#2a2a2a",
                  border: "1px solid #444",
                  borderRadius: "8px",
                  color: "white",
                  padding: "10px 12px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* About */}
            <div>
              <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 6px" }}>
                About
              </p>
              <input
                value={editAbout}
                onChange={(e) => setEditAbout(e.target.value)}
                placeholder={user.about}
                style={{
                  width: "100%",
                  background: "#2a2a2a",
                  border: "1px solid #444",
                  borderRadius: "8px",
                  color: "white",
                  padding: "10px 12px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSaveProfile}
                disabled={editLoading}
                style={{
                  flex: 1,
                  background: editLoading ? "#555" : "#ff0000",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: editLoading ? "not-allowed" : "pointer",
                }}
              >
                {editLoading ? "Uploading..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  setShowEditProfile(false);
                  setEditName("");
                  setEditAbout("");
                  setEditPic("");
                }}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid #555",
                  color: "#aaa",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
