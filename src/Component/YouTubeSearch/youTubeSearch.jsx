import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

const API_KEYS = [
  process.env.REACT_APP_YOUTUBE_KEY_1,
  process.env.REACT_APP_YOUTUBE_KEY_2,
  process.env.REACT_APP_YOUTUBE_KEY_3,
  process.env.REACT_APP_YOUTUBE_KEY_4,
  process.env.REACT_APP_YOUTUBE_KEY_5,
];

let currentKeyIndex = 0;
const cache = {};

const defaultQueries = [
  "trending videos 2025",
  "viral videos 2025",
  "new movies 2025",
  "latest music 2025",
  "funny videos 2025",
];

const YouTubeSearch = () => {
  const [autoplay, setAutoplay] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    { id: 1, user: "Rahul", text: "Amazing video! 🔥", time: "2 days ago", likes: 24 },
    { id: 2, user: "Priya", text: "Loved this content!", time: "1 day ago", likes: 12 },
    { id: 3, user: "Amit", text: "Very informative, thanks!", time: "5 hours ago", likes: 5 },
  ]);
  const location = useLocation();
  const autoplayRef = React.useRef(autoplay);

  // ✅ Keep ref in sync with state
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  // ✅ Listen for video end
  useEffect(() => {
    if (!selectedVideo) return;
    const handleMessage = (event) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "onStateChange" && data.info === 0) {
          if (!autoplayRef.current) return;
          const n = selectedVideoIndex + 1;
          if (n < results.length) {
            setSelectedVideo(results[n].id.videoId);
            setSelectedVideoIndex(n);
            setComment("");
            setLiked(false);
            setDisliked(false);
          }
        }
      } catch (e) {}
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedVideo, selectedVideoIndex, results]);

  // ✅ Load on page visit with random query
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchFromNav = params.get("search");
    if (searchFromNav) {
      setQuery(searchFromNav);
      searchWithQuery(searchFromNav, true);
    } else {
      // ✅ Pick random query each time
      const randomQuery = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
      searchWithQuery(randomQuery, true);
    }
  }, [location.search]);

  const searchWithQuery = async (q, forceRefresh = false) => {
    if (cache[q] && !forceRefresh) {
      setResults(cache[q]);
      return;
    }
    setLoading(true);
    setError("");

    for (let i = 0; i < API_KEYS.length; i++) {
      const keyIndex = (currentKeyIndex + i) % API_KEYS.length;
      try {
        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              q,
              type: "video",
              maxResults: 50,
              order: "date",
              key: API_KEYS[keyIndex],
            },
          }
        );
        currentKeyIndex = keyIndex;
        cache[q] = res.data.items;
        setResults(res.data.items);
        setLoading(false);
        return;
      } catch (err) {
        if (err.response?.status === 403) {
          currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
          continue;
        }
        setError(err.response?.data?.error?.message || "Something went wrong");
        break;
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", paddingTop: "70px", fontFamily: "Roboto, Arial, sans-serif" }}>

      {error && (
        <div style={{ background: "#ff4444", color: "white", padding: "12px 20px", margin: "10px 20px", borderRadius: "6px", fontSize: "14px" }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", padding: "20px" }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ background: "#272727", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ width: "100%", paddingTop: "56.25%", background: "#3a3a3a", animation: "pulse 1.5s infinite" }} />
              <div style={{ padding: "12px" }}>
                <div style={{ height: "14px", background: "#3a3a3a", borderRadius: "4px", marginBottom: "8px" }} />
                <div style={{ height: "12px", background: "#3a3a3a", borderRadius: "4px", width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.95)", zIndex: 1000, overflowY: "auto", fontFamily: "Roboto, Arial, sans-serif" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", padding: "70px 20px 40px" }}>

            <button
              onClick={() => { setSelectedVideo(null); setSelectedVideoIndex(null); }}
              style={{ position: "fixed", top: "80px", right: "20px", background: "#272727", border: "none", color: "white", fontSize: "20px", cursor: "pointer", borderRadius: "50%", width: "40px", height: "40px", zIndex: 1001 }}
            >✕</button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <button
                onClick={() => { const p = selectedVideoIndex - 1; if (p >= 0) { setSelectedVideo(results[p].id.videoId); setSelectedVideoIndex(p); setComment(""); } }}
                disabled={selectedVideoIndex === 0}
                style={{ background: selectedVideoIndex === 0 ? "#333" : "#ff0000", border: "none", color: "white", padding: "8px 16px", borderRadius: "6px", cursor: selectedVideoIndex === 0 ? "not-allowed" : "pointer", fontSize: "14px" }}
              >⏮ Prev</button>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#aaa", fontSize: "13px" }}>Autoplay</span>
                <div onClick={() => setAutoplay(!autoplay)}
                  style={{ width: "42px", height: "24px", background: autoplay ? "#ff0000" : "#555", borderRadius: "12px", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
                  <div style={{ width: "18px", height: "18px", background: "white", borderRadius: "50%", position: "absolute", top: "3px", left: autoplay ? "21px" : "3px", transition: "left 0.3s" }} />
                </div>
              </div>

              {/* <span style={{ color: "#aaa", fontSize: "14px" }}>{selectedVideoIndex + 1} / {results.length}</span> */}

              <button
                onClick={() => { const n = selectedVideoIndex + 1; if (n < results.length) { setSelectedVideo(results[n].id.videoId); setSelectedVideoIndex(n); setComment(""); } }}
                disabled={selectedVideoIndex === results.length - 1}
                style={{ background: selectedVideoIndex === results.length - 1 ? "#333" : "#ff0000", border: "none", color: "white", padding: "8px 16px", borderRadius: "6px", cursor: selectedVideoIndex === results.length - 1 ? "not-allowed" : "pointer", fontSize: "14px" }}
              >Next ⏭</button>
            </div>

            <div style={{ position: "relative" }} id="video-wrapper">
              <iframe
                id="yt-iframe"
                width="100%" height="500"
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`}
                allow="autoplay; fullscreen"
                allowFullScreen
                style={{ borderRadius: "12px", border: "none", display: "block" }}
                title="YouTube Player"
              />
              <div className="floating-controls"
                style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.75)", borderRadius: "30px", padding: "8px 20px", display: "flex", alignItems: "center", gap: "16px", opacity: 0, transition: "opacity 0.3s", pointerEvents: "none", zIndex: 10, backdropFilter: "blur(6px)" }}>
                <button onClick={() => { const p = selectedVideoIndex - 1; if (p >= 0) { setSelectedVideo(results[p].id.videoId); setSelectedVideoIndex(p); } }}
                  style={{ background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}>⏮</button>
                {/* <span style={{ color: "white", fontSize: "13px" }}>{selectedVideoIndex + 1} / {results.length}</span> */}
                <button onClick={() => { const n = selectedVideoIndex + 1; if (n < results.length) { setSelectedVideo(results[n].id.videoId); setSelectedVideoIndex(n); } }}
                  style={{ background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}>⏭</button>
                <button onClick={() => document.getElementById("yt-iframe")?.requestFullscreen?.()}
                  style={{ background: "none", border: "none", color: "white", fontSize: "18px", cursor: "pointer" }}>⛶</button>
              </div>
            </div>

            {results[selectedVideoIndex] && (
              <>
                <div style={{ marginTop: "16px" }}>
                  <div style={{ color: "white", fontWeight: "bold", fontSize: "18px", lineHeight: "1.4" }}>
                    {results[selectedVideoIndex].snippet.title}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "13px", marginTop: "6px" }}>
                    {new Date(results[selectedVideoIndex].snippet.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginTop: "16px", paddingBottom: "16px", borderBottom: "1px solid #272727" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img src={`https://ui-avatars.com/api/?name=${results[selectedVideoIndex].snippet.channelTitle}&background=random&size=40`} alt="channel"
                      style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                    <div>
                      <div style={{ color: "white", fontWeight: "600", fontSize: "15px" }}>{results[selectedVideoIndex].snippet.channelTitle}</div>
                      <div style={{ color: "#aaa", fontSize: "12px" }}>1.2M subscribers</div>
                    </div>
                    <button onClick={() => setSubscribed(!subscribed)}
                      style={{ background: subscribed ? "#272727" : "white", color: subscribed ? "white" : "black", border: "none", borderRadius: "20px", padding: "8px 16px", fontWeight: "600", cursor: "pointer", fontSize: "14px", marginLeft: "8px" }}>
                      {subscribed ? "✓ Subscribed" : "Subscribe"}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setLiked(!liked); if (disliked) setDisliked(false); }}
                      style={{ background: liked ? "#3ea6ff22" : "#272727", border: liked ? "1px solid #3ea6ff" : "1px solid transparent", color: liked ? "#3ea6ff" : "white", borderRadius: "20px", padding: "8px 16px", cursor: "pointer", fontSize: "14px" }}>
                      👍 1.1K
                    </button>
                    <button onClick={() => { setDisliked(!disliked); if (liked) setLiked(false); }}
                      style={{ background: disliked ? "#ff444422" : "#272727", border: disliked ? "1px solid #ff4444" : "1px solid transparent", color: disliked ? "#ff4444" : "white", borderRadius: "20px", padding: "8px 16px", cursor: "pointer", fontSize: "14px" }}>
                      👎
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${selectedVideo}`); alert("Link copied!"); }}
                      style={{ background: "#272727", border: "none", color: "white", borderRadius: "20px", padding: "8px 16px", cursor: "pointer", fontSize: "14px" }}>
                      🔗 Share
                    </button>
                  </div>
                </div>

                <div style={{ background: "#272727", borderRadius: "12px", padding: "14px", marginTop: "16px", color: "#ccc", fontSize: "14px", lineHeight: "1.6" }}>
                  <strong style={{ color: "white" }}>Description</strong>
                  <p style={{ marginTop: "8px" }}>{results[selectedVideoIndex].snippet.description || "No description available."}</p>
                </div>

                <div style={{ marginTop: "24px" }}>
                  <div style={{ color: "white", fontWeight: "bold", fontSize: "16px", marginBottom: "16px" }}>💬 Comments</div>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                    <img src="https://athenabpo.com/wp-content/uploads/2016/09/Headshot-Blank-Person-Circle-300x300.gif" alt="user"
                      style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { setComments([{ id: Date.now(), text: comment, user: "You", time: "Just now", likes: 0 }, ...comments]); setComment(""); } }}
                        placeholder="Add a comment..."
                        style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #555", color: "white", fontSize: "14px", padding: "8px 0", outline: "none", boxSizing: "border-box" }} />
                      {comment.trim() && (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                          <button onClick={() => setComment("")} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
                          <button onClick={() => { setComments([{ id: Date.now(), text: comment, user: "You", time: "Just now", likes: 0 }, ...comments]); setComment(""); }}
                            style={{ background: "#3ea6ff", border: "none", color: "black", borderRadius: "20px", padding: "6px 16px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>
                            Comment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {comments.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                      <img src={`https://ui-avatars.com/api/?name=${c.user}&background=random&size=36`} alt={c.user}
                        style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ color: "white", fontWeight: "600", fontSize: "13px" }}>{c.user}</span>
                          <span style={{ color: "#aaa", fontSize: "12px" }}>{c.time}</span>
                        </div>
                        <div style={{ color: "#ccc", fontSize: "14px", marginTop: "4px" }}>{c.text}</div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>👍 {c.likes}</span>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>👎</span>
                          <span style={{ color: "#aaa", fontSize: "13px", cursor: "pointer" }}>Reply</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", padding: "20px" }}>
          {results.map((item) => (
            <div key={item.id.videoId}
              onClick={() => { const index = results.indexOf(item); setSelectedVideo(item.id.videoId); setSelectedVideoIndex(index); setLiked(false); setDisliked(false); setSubscribed(false); }}
              style={{ cursor: "pointer" }}>
              <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden" }}>
                <img src={item.snippet.thumbnails.medium.url} alt={item.snippet.title}
                  style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.3)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0)"}>
                  <div style={{ width: "50px", height: "50px", background: "rgba(255,0,0,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>▶</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", padding: "12px 4px" }}>
                <img src={`https://ui-avatars.com/api/?name=${item.snippet.channelTitle}&background=random&size=36`} alt="channel"
                  style={{ width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontWeight: "600", fontSize: "14px", lineHeight: "1.4", marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {item.snippet.title}
                  </div>
                  <div style={{ color: "#aaa", fontSize: "13px", marginBottom: "2px" }}>{item.snippet.channelTitle}</div>
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    {new Date(item.snippet.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "100px", fontSize: "16px" }}>
          🔍 Search for any YouTube video using the search bar above
        </p>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        #video-wrapper:hover .floating-controls { opacity: 1 !important; pointer-events: all !important; }
        @media (display-mode: fullscreen) { .floating-controls { opacity: 1 !important; pointer-events: all !important; } }
      `}</style>
    </div>
  );
};

export default YouTubeSearch;