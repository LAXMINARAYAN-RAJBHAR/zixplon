import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

const YouTubeSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);
  const location = useLocation();
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([
    {
      id: 1,
      user: "Rahul",
      text: "Amazing video! 🔥",
      time: "2 days ago",
      likes: 24,
    },
    {
      id: 2,
      user: "Priya",
      text: "Loved this content!",
      time: "1 day ago",
      likes: 12,
    },
    {
      id: 3,
      user: "Amit",
      text: "Very informative, thanks!",
      time: "5 hours ago",
      likes: 5,
    },
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchFromNav = params.get("search");
    if (searchFromNav) {
      setQuery(searchFromNav);
      searchWithQuery(searchFromNav);
    } else {
      loadDefaultVideos();
    }
  }, [location.search]);

  const searchWithQuery = async (q) => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q,
            type: "video",
            maxResults: 20,
            key: API_KEY,
          },
        },
      );
      setResults(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Something went wrong");
    }
    setLoading(false);
  };

  const loadDefaultVideos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: "trending videos 2025",
            type: "video",
            maxResults: 20,
            key: API_KEY,
          },
        },
      );
      setResults(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        background: "#0f0f0f",
        minHeight: "100vh",
        paddingTop: "70px",
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      {/* ERROR */}
      {error && (
        <div
          style={{
            background: "#ff4444",
            color: "white",
            padding: "12px 20px",
            margin: "10px 20px",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
            padding: "20px",
          }}
        >
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                background: "#272727",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "100%",
                  paddingTop: "56.25%",
                  background: "#3a3a3a",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <div style={{ padding: "12px" }}>
                <div
                  style={{
                    height: "14px",
                    background: "#3a3a3a",
                    borderRadius: "4px",
                    marginBottom: "8px",
                  }}
                />
                <div
                  style={{
                    height: "12px",
                    background: "#3a3a3a",
                    borderRadius: "4px",
                    width: "60%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIDEO PLAYER MODAL */}
      {selectedVideo && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            overflowY: "auto",
            fontFamily: "Roboto, Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "900px",
              margin: "0 auto",
              padding: "70px 20px 40px",
            }}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={() => {
                setSelectedVideo(null);
                setSelectedVideoIndex(null);
              }}
              style={{
                position: "fixed",
                top: "80px",
                right: "20px",
                background: "#272727",
                border: "none",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                zIndex: 1001,
              }}
            >
              ✕
            </button>

            {/* PREV / NEXT */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <button
                onClick={() => {
                  const prevIndex = selectedVideoIndex - 1;
                  if (prevIndex >= 0) {
                    setSelectedVideo(results[prevIndex].id.videoId);
                    setSelectedVideoIndex(prevIndex);
                    setComment("");
                  }
                }}
                disabled={selectedVideoIndex === 0}
                style={{
                  background: selectedVideoIndex === 0 ? "#333" : "#ff0000",
                  border: "none",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: selectedVideoIndex === 0 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                ⏮ Prev
              </button>

              <span style={{ color: "#aaa", fontSize: "14px" }}>
                {selectedVideoIndex + 1} / {results.length}
              </span>

              <button
                onClick={() => {
                  const nextIndex = selectedVideoIndex + 1;
                  if (nextIndex < results.length) {
                    setSelectedVideo(results[nextIndex].id.videoId);
                    setSelectedVideoIndex(nextIndex);
                    setComment("");
                  }
                }}
                disabled={selectedVideoIndex === results.length - 1}
                style={{
                  background:
                    selectedVideoIndex === results.length - 1
                      ? "#333"
                      : "#ff0000",
                  border: "none",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor:
                    selectedVideoIndex === results.length - 1
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "14px",
                }}
              >
                Next ⏭
              </button>
            </div>

            {/* IFRAME */}
            <iframe
              width="100%"
              height="500"
              src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
              allow="autoplay; fullscreen"
              allowFullScreen
              style={{ borderRadius: "12px", border: "none", display: "block" }}
              title="YouTube Player"
            />

            {/* VIDEO TITLE */}
            {results[selectedVideoIndex] && (
              <>
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "18px",
                      lineHeight: "1.4",
                    }}
                  >
                    {results[selectedVideoIndex].snippet.title}
                  </div>
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: "13px",
                      marginTop: "6px",
                    }}
                  >
                    {new Date(
                      results[selectedVideoIndex].snippet.publishedAt,
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>

                {/* CHANNEL + SUBSCRIBE + LIKE/DISLIKE */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "16px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid #272727",
                  }}
                >
                  {/* CHANNEL INFO + SUBSCRIBE */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <img
                      src={`https://ui-avatars.com/api/?name=${results[selectedVideoIndex].snippet.channelTitle}&background=random&size=40`}
                      alt="channel"
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          color: "white",
                          fontWeight: "600",
                          fontSize: "15px",
                        }}
                      >
                        {results[selectedVideoIndex].snippet.channelTitle}
                      </div>
                      <div style={{ color: "#aaa", fontSize: "12px" }}>
                        1.2M subscribers
                      </div>
                    </div>
                    <button
                      onClick={() => setSubscribed(!subscribed)}
                      style={{
                        background: subscribed ? "#272727" : "white",
                        color: subscribed ? "white" : "black",
                        border: "none",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontSize: "14px",
                        marginLeft: "8px",
                      }}
                    >
                      {subscribed ? "✓ Subscribed" : "Subscribe"}
                    </button>
                  </div>

                  {/* LIKE / DISLIKE / SHARE */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {/* LIKE */}
                    <button
                      onClick={() => setLiked(!liked)}
                      style={{
                        background: liked ? "#3ea6ff22" : "#272727",
                        border: liked
                          ? "1px solid #3ea6ff"
                          : "1px solid transparent",
                        color: liked ? "#3ea6ff" : "white",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      👍 {liked ? "1.1K" : "1.1K"}
                    </button>

                    {/* DISLIKE */}
                    <button
                      onClick={() => setDisliked(!disliked)}
                      style={{
                        background: disliked ? "#ff444422" : "#272727",
                        border: disliked
                          ? "1px solid #ff4444"
                          : "1px solid transparent",
                        color: disliked ? "#ff4444" : "white",
                        borderRadius: "20px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      👎
                    </button>

                    {/* SHARE */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `https://www.youtube.com/watch?v=${selectedVideo}`,
                        );
                        alert("Link copied to clipboard!");
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
                  </div>
                </div>

                {/* DESCRIPTION */}
                <div
                  style={{
                    background: "#272727",
                    borderRadius: "12px",
                    padding: "14px",
                    marginTop: "16px",
                    color: "#ccc",
                    fontSize: "14px",
                    lineHeight: "1.6",
                  }}
                >
                  <strong style={{ color: "white" }}>Description</strong>
                  <p style={{ marginTop: "8px" }}>
                    {results[selectedVideoIndex].snippet.description ||
                      "No description available."}
                  </p>
                </div>

                {/* COMMENT SECTION */}
                <div style={{ marginTop: "24px" }}>
                  <div
                    style={{
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    💬 Comments
                  </div>

                  {/* ADD COMMENT */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "24px",
                    }}
                  >
                    <img
                      src="https://athenabpo.com/wp-content/uploads/2016/09/Headshot-Blank-Person-Circle-300x300.gif"
                      alt="user"
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && comment.trim()) {
                            setComments([
                              {
                                id: Date.now(),
                                text: comment,
                                user: "You",
                                time: "Just now",
                                likes: 0,
                              },
                              ...comments,
                            ]);
                            setComment("");
                          }
                        }}
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
                      />
                      {comment.trim() && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
                          <button
                            onClick={() => setComment("")}
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
                            onClick={() => {
                              setComments([
                                {
                                  id: Date.now(),
                                  text: comment,
                                  user: "You",
                                  time: "Just now",
                                  likes: 0,
                                },
                                ...comments,
                              ]);
                              setComment("");
                            }}
                            style={{
                              background: "#3ea6ff",
                              border: "none",
                              color: "black",
                              borderRadius: "20px",
                              padding: "6px 16px",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                            }}
                          >
                            Comment
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COMMENTS LIST */}
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        gap: "12px",
                        marginBottom: "20px",
                      }}
                    >
                      <img
                        src={`https://ui-avatars.com/api/?name=${c.user}&background=random&size=36`}
                        alt={c.user}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              color: "white",
                              fontWeight: "600",
                              fontSize: "13px",
                            }}
                          >
                            {c.user}
                          </span>
                          <span style={{ color: "#aaa", fontSize: "12px" }}>
                            {c.time}
                          </span>
                        </div>
                        <div
                          style={{
                            color: "#ccc",
                            fontSize: "14px",
                            marginTop: "4px",
                          }}
                        >
                          {c.text}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            marginTop: "6px",
                          }}
                        >
                          <span
                            style={{
                              color: "#aaa",
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            👍 {c.likes}
                          </span>
                          <span
                            style={{
                              color: "#aaa",
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            👎
                          </span>
                          <span
                            style={{
                              color: "#aaa",
                              fontSize: "13px",
                              cursor: "pointer",
                            }}
                          >
                            Reply
                          </span>
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

      {/* RESULTS GRID */}
      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
            padding: "20px",
          }}
        >
          {results.map((item) => (
            <div
              key={item.id.videoId}
              onClick={() => {
                const index = results.indexOf(item);
                setSelectedVideo(item.id.videoId);
                setSelectedVideoIndex(index);
              }}
              style={{ cursor: "pointer" }}
            >
              {/* THUMBNAIL */}
              <div
                style={{
                  position: "relative",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={item.snippet.thumbnails.medium.url}
                  alt={item.snippet.title}
                  style={{
                    width: "100%",
                    display: "block",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                  }}
                />
                {/* PLAY OVERLAY */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "rgba(0,0,0,0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(0,0,0,0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(0,0,0,0)")
                  }
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      background: "rgba(255,0,0,0.9)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                  >
                    ▶
                  </div>
                </div>
              </div>

              {/* VIDEO INFO */}
              <div
                style={{ display: "flex", gap: "12px", padding: "12px 4px" }}
              >
                {/* CHANNEL PIC */}
                <img
                  src={`https://ui-avatars.com/api/?name=${item.snippet.channelTitle}&background=random&size=36`}
                  alt="channel"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  {/* TITLE */}
                  <div
                    style={{
                      color: "white",
                      fontWeight: "600",
                      fontSize: "14px",
                      lineHeight: "1.4",
                      marginBottom: "4px",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.snippet.title}
                  </div>
                  {/* CHANNEL */}
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: "13px",
                      marginBottom: "2px",
                    }}
                  >
                    {item.snippet.channelTitle}
                  </div>
                  {/* DATE */}
                  <div style={{ color: "#aaa", fontSize: "12px" }}>
                    {new Date(item.snippet.publishedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <p
          style={{
            color: "#888",
            textAlign: "center",
            marginTop: "100px",
            fontSize: "16px",
          }}
        >
          🔍 Search for any YouTube video using the search bar above
        </p>
      )}

      {/* PULSE ANIMATION */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default YouTubeSearch;
