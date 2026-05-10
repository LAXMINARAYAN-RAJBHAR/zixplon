import React from "react";
import "./profile.css";
import SideNavbar from "../../Component/SideNavbar/sideNavbar";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import { Link, useParams } from "react-router-dom";
import { reelsData } from "../../Component/Reels/reels";

// ✅ Moved videos data here (or import from a shared file)
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
  { id: 13, thumbnail: "https://picsum.photos/seed/lion1/320/180", title: "3D Lion Stock Photo", duration: "60:00", channel: "Papa" },
  { id: 14, thumbnail: "https://picsum.photos/seed/tiger2/320/180", title: "Tiger in Wild", duration: "45:00", channel: "NatureTV" },
  { id: 15, thumbnail: "https://picsum.photos/seed/forest3/320/180", title: "Forest Walk", duration: "30:00", channel: "EcoWorld" },
  { id: 16, thumbnail: "https://picsum.photos/seed/ocean4/320/180", title: "Ocean Waves", duration: "15:00", channel: "SeaLife" },
  { id: 17, thumbnail: "https://picsum.photos/seed/mountain5/320/180", title: "Mountain Trek", duration: "20:00", channel: "Adventures" },
  { id: 18, thumbnail: "https://picsum.photos/seed/city6/320/180", title: "City Lights", duration: "10:00", channel: "UrbanVibe" },
  { id: 19, thumbnail: "https://picsum.photos/seed/sunset7/320/180", title: "Sunset Timelapse", duration: "05:00", channel: "SkyWatch" },
  { id: 20, thumbnail: "https://picsum.photos/seed/beach8/320/180", title: "Beach Day", duration: "12:00", channel: "SummerFun" },
  { id: 21, thumbnail: "https://picsum.photos/seed/rain9/320/180", title: "Rainy Day", duration: "08:00", channel: "Chill" },
  { id: 22, thumbnail: "https://picsum.photos/seed/snow10/320/180", title: "Snowfall", duration: "25:00", channel: "WinterMood" },
  { id: 23, thumbnail: "https://picsum.photos/seed/car11/320/180", title: "Sports Car Review", duration: "18:00", channel: "AutoDrive" },
  { id: 24, thumbnail: "https://picsum.photos/seed/food12/320/180", title: "Pasta Recipe", duration: "22:00", channel: "ChefLife" },
  { id: 25, thumbnail: "https://picsum.photos/seed/tech13/320/180", title: "Latest Gadgets", duration: "35:00", channel: "TechZone" },
  { id: 26, thumbnail: "https://picsum.photos/seed/space14/320/180", title: "Space Exploration", duration: "40:00", channel: "NASAFan" },
  { id: 27, thumbnail: "https://picsum.photos/seed/dog15/320/180", title: "Cute Dogs Compilation", duration: "14:00", channel: "PetPals" },
  { id: 28, thumbnail: "https://picsum.photos/seed/cat16/320/180", title: "Funny Cats", duration: "11:00", channel: "MeowTime" },
  { id: 29, thumbnail: "https://picsum.photos/seed/workout17/320/180", title: "Morning Workout", duration: "28:00", channel: "FitLife" },
  { id: 30, thumbnail: "https://picsum.photos/seed/yoga18/320/180", title: "Yoga for Beginners", duration: "45:00", channel: "ZenMode" },
  { id: 31, thumbnail: "https://picsum.photos/seed/music19/320/180", title: "Lo-Fi Music Mix", duration: "60:00", channel: "LoFiBeats" },
  { id: 32, thumbnail: "https://picsum.photos/seed/travel20/320/180", title: "Travel Vlog: Japan", duration: "55:00", channel: "GlobeTrotter" },
  { id: 33, thumbnail: "https://picsum.photos/seed/art21/320/180", title: "Painting Tutorial", duration: "50:00", channel: "ArtStudio" },
  { id: 34, thumbnail: "https://picsum.photos/seed/code22/320/180", title: "Learn JavaScript", duration: "90:00", channel: "DevHQ" },
  { id: 35, thumbnail: "https://picsum.photos/seed/bird23/320/180", title: "Birds of Paradise", duration: "16:00", channel: "WildBirds" },
  { id: 36, thumbnail: "https://picsum.photos/seed/river24/320/180", title: "River Kayaking", duration: "32:00", channel: "OutdoorX" },
  { id: 37, thumbnail: "https://picsum.photos/seed/night25/320/180", title: "Night Sky Photography", duration: "38:00", channel: "StarGazer" },
  { id: 38, thumbnail: "https://picsum.photos/seed/coffee26/320/180", title: "Coffee Art Tips", duration: "09:00", channel: "BrewMaster" },
  { id: 39, thumbnail: "https://picsum.photos/seed/book27/320/180", title: "Book Review", duration: "20:00", channel: "ReadMore" },
  { id: 40, thumbnail: "https://picsum.photos/seed/game28/320/180", title: "Gaming Highlights", duration: "42:00", channel: "ProGamer" },
  { id: 41, thumbnail: "https://picsum.photos/seed/drone29/320/180", title: "Drone Footage", duration: "17:00", channel: "SkyView" },
  { id: 42, thumbnail: "https://picsum.photos/seed/history30/320/180", title: "Ancient Civilizations", duration: "65:00", channel: "HistoryBuff" },
  { id: 43, thumbnail: "https://picsum.photos/seed/garden31/320/180", title: "Garden Tips", duration: "23:00", channel: "GreenThumb" },
  { id: 44, thumbnail: "https://picsum.photos/seed/fish32/320/180", title: "Deep Sea Creatures", duration: "44:00", channel: "OceanDepth" },
  { id: 45, thumbnail: "https://picsum.photos/seed/bike33/320/180", title: "Mountain Biking", duration: "31:00", channel: "BikePro" },
  { id: 46, thumbnail: "https://picsum.photos/seed/sky34/320/180", title: "Cloud Formations", duration: "07:00", channel: "WeatherNerd" },
  { id: 47, thumbnail: "https://picsum.photos/seed/market35/320/180", title: "Street Market Tour", duration: "27:00", channel: "FoodieWalks" },
  { id: 48, thumbnail: "https://picsum.photos/seed/dance36/320/180", title: "Dance Choreography", duration: "13:00", channel: "DanceFloor" },
  { id: 49, thumbnail: "https://picsum.photos/seed/photo37/320/180", title: "Photography Masterclass", duration: "75:00", channel: "LensCraft" },
  { id: 50, thumbnail: "https://picsum.photos/seed/desk38/320/180", title: "Desk Setup Tour", duration: "19:00", channel: "SetupGoals" },
  { id: 51, thumbnail: "https://picsum.photos/seed/swim39/320/180", title: "Swimming Tips", duration: "36:00", channel: "AquaLife" },
  { id: 52, thumbnail: "https://picsum.photos/seed/volcano40/320/180", title: "Volcanic Eruption", duration: "48:00", channel: "GeoWatch" },
  { id: 53, thumbnail: "https://picsum.photos/seed/farm41/320/180", title: "Farm Life Vlog", duration: "53:00", channel: "RuralDays" },
  { id: 54, thumbnail: "https://picsum.photos/seed/robot42/320/180", title: "AI & Robotics", duration: "58:00", channel: "FutureTech" },
  { id: 55, thumbnail: "https://picsum.photos/seed/horse43/320/180", title: "Horse Riding Basics", duration: "41:00", channel: "EquineLife" },
  { id: 56, thumbnail: "https://picsum.photos/seed/dessert44/320/180", title: "Chocolate Cake Recipe", duration: "26:00", channel: "SweetBakes" },
  { id: 57, thumbnail: "https://picsum.photos/seed/waterfall45/320/180", title: "Waterfall Hike", duration: "33:00", channel: "NatureWalks" },
  { id: 58, thumbnail: "https://picsum.photos/seed/candle46/320/180", title: "DIY Candle Making", duration: "21:00", channel: "CraftCorner" },
  { id: 59, thumbnail: "https://picsum.photos/seed/castle47/320/180", title: "Castle Exploration", duration: "67:00", channel: "HistoricPlaces" },
  { id: 60, thumbnail: "https://picsum.photos/seed/surf48/320/180", title: "Surfing Lessons", duration: "29:00", channel: "WaveRider" },
  { id: 61, thumbnail: "https://picsum.photos/seed/jungle49/320/180", title: "Jungle Safari", duration: "72:00", channel: "WildExplorer" },
  { id: 62, thumbnail: "https://picsum.photos/seed/aurora50/320/180", title: "Northern Lights", duration: "15:00", channel: "ArcticVision" },
];

const buildUsersData = () => {
  const users = {
    // ✅ Manually added subscription channels
    aajtak: {
      name: "Aaj Tak",
      handle: "@aajtak",
      profilePic: "https://tse4.mm.bing.net/th/id/OIP.Auy5e_yPpkpidVF_ZRz7aQAAAA?w=404&h=316&rs=1&pid=ImgDetMain&o=7&rm=3",
      about: "India's No.1 Hindi News Channel",
    },
    lallantop: {
      name: "The LallanTop",
      handle: "@lallantop",
      profilePic: "https://tse1.mm.bing.net/th/id/OIP.At5eXfjQ0jLiO7tRFBjI_QAAAA?rs=1&pid=ImgDetMain&o=7&rm=3",
      about: "Digital news platform by India Today Group",
    },
    ndtvindia: {
      name: "NDTV India",
      handle: "@ndtvindia",
      profilePic: "https://logodix.com/logo/2131933.jpg",
      about: "India's most trusted Hindi news channel",
    },
  };

  // From reelsData
  reelsData.forEach((reel) => {
    const key = reel.username?.toLowerCase();
    if (!key) return;
    if (!users[key]) {
      users[key] = {
        name: reel.user,
        handle: `@${reel.username}`,
        profilePic: reel.profilePic,
        about: `${reel.user}'s channel`,
      };
    }
  });

  // From allVideos (channel name as username key)
  allVideos.forEach((video) => {
    const key = video.channel?.toLowerCase();
    if (!key) return;
    if (!users[key]) {
      users[key] = {
        name: video.channel,
        handle: `@${video.channel.toLowerCase()}`,
        profilePic: `https://api.dicebear.com/7.x/initials/svg?seed=${video.channel}`,
        about: `${video.channel}'s channel`,
      };
    }
  });

  return users;
};

const usersData = buildUsersData();

const Profile = ({ sideNavbar }) => {
  const { username } = useParams();
  const key = username?.toLowerCase();
  const user = usersData[key];

  // ✅ Match reels by username
  const userReels = reelsData.filter(
    (r) => r.username?.toLowerCase() === key
  );

  // ✅ Match videos by channel name
  const userVideos = allVideos.filter(
    (v) => v.channel?.toLowerCase() === key
  );

  if (!user) {
    return (
      <div style={{ color: "white", padding: "20px", textAlign: "center" }}>
        <h2>User not found!</h2>
        <p style={{ color: "#aaa" }}>No profile exists for "@{username}"</p>
      </div>
    );
  }

  return (
    <div className="profile">
      <SideNavbar sideNavbar={sideNavbar} />

      <div className={sideNavbar ? "profile_page" : "profile_page_inactive"}>

        {/* ── Top Section ── */}
        <div className="profile_top_section">
          <div className="profile_top_section_profile">
            <img
              className="profile_top_section_img"
              src={user.profilePic}
              alt={user.name}
            />
          </div>
          <div className="profile_top_section_About">
            <div className="profile_top_section_About_Name">{user.name}</div>
            <div className="profile_top_section_info">
              {user.handle} · {userVideos.length} videos · {userReels.length} reels
            </div>
            <div className="profile_top_section_info">{user.about}</div>
          </div>
        </div>

        {/* ── Videos Section ── */}
        {userVideos.length > 0 && (
          <div className="profile_videos">
            <div className="profile_videos_title">
              Videos ({userVideos.length}) &nbsp; <ArrowRightIcon />
            </div>
            <div className="profileVideos">
              {userVideos.map((video) => (
                <Link
                  to={`/video/${video.id}`}
                  key={video.id}
                  className="profileVideo_block"
                >
                  <div className="profileVideo_block_thumbnail" style={{ position: "relative" }}>
                    <img
                      className="profileVideo_block_thumbnail_img"
                      src={video.thumbnail}
                      alt={video.title}
                    />
                    <span style={{
                      position: "absolute", bottom: "6px", right: "6px",
                      background: "rgba(0,0,0,0.75)", color: "white",
                      fontSize: "11px", padding: "2px 5px", borderRadius: "4px"
                    }}>
                      {video.duration}
                    </span>
                  </div>
                  <div className="profileVideo_block_detail">
                    <div className="profileVideo_block_detai_name">{video.title}</div>
                    <div className="profileVideo_block_detai_about">{video.channel}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Reels Section ── */}
        {userReels.length > 0 && (
          <div className="profile_videos" style={{ marginTop: "30px" }}>
            <div className="profile_videos_title">
              Reels ({userReels.length}) &nbsp; <ArrowRightIcon />
            </div>
            <div className="profileVideos">
              {userReels.map((reel) => (
                <Link
                  to="/reels"
                  key={reel.id}
                  className="profileVideo_block"
                  state={{ reelId: reel.id }}
                >
                  <div className="profileVideo_block_thumbnail" style={{ position: "relative" }}>
                    <img
                      className="profileVideo_block_thumbnail_img"
                      src={reel.thumbnail}
                      alt={reel.title}
                    />
                    <span style={{
                      position: "absolute", top: "6px", left: "6px",
                      background: "rgba(0,0,0,0.7)", color: "white",
                      fontSize: "10px", padding: "2px 6px",
                      borderRadius: "4px", fontWeight: "600"
                    }}>
                      🎬 Reel
                    </span>
                    <span style={{
                      position: "absolute", bottom: "6px", right: "6px",
                      background: "rgba(0,0,0,0.7)", color: "white",
                      fontSize: "11px", padding: "2px 5px", borderRadius: "4px"
                    }}>
                      {reel.duration}
                    </span>
                  </div>
                  <div className="profileVideo_block_detail">
                    <div className="profileVideo_block_detai_name">{reel.title}</div>
                    <div className="profileVideo_block_detai_about">{reel.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {userVideos.length === 0 && userReels.length === 0 && (
          <div style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}>
            No videos or reels uploaded yet.
          </div>
        )}

      </div>
    </div>
  );
};

export default Profile;