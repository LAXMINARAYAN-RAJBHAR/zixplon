import React, { useState, useRef, useEffect } from "react";

const REACTIONS = [
  { key: "like", emoji: "👍", label: "Like", color: "#1877f2" },
  { key: "love", emoji: "❤️", label: "Love", color: "#e0245e" },
  { key: "haha", emoji: "😂", label: "Haha", color: "#f5a623" },
  { key: "wow", emoji: "😮", label: "Wow", color: "#f5a623" },
  { key: "sad", emoji: "😢", label: "Sad", color: "#f5a623" },
  { key: "angry", emoji: "😡", label: "Angry", color: "#e05e00" },
];

const PRIVACY_ICON = { public: "🌐", friends: "👥", only_me: "🔒" };

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const Lightbox = ({ images, startIndex = 0, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const [autoPlay, setAutoPlay] = useState(false);

  const next = (e) => {
    e?.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  };

  const prev = (e) => {
    e?.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };

  // Auto-advance through all images in sequence
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [autoPlay, images.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setAutoPlay((a) => !a);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, images.length]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "16px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "white",
          fontSize: "24px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          zIndex: 2,
        }}
      >
        ✕
      </button>

      {/* Play / Pause slideshow */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoPlay((a) => !a);
          }}
          aria-label={autoPlay ? "Pause slideshow" : "Play slideshow"}
          style={{
            position: "absolute",
            top: "16px",
            right: "70px",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "white",
            fontSize: "18px",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          {autoPlay ? "⏸" : "▶"}
        </button>
      )}

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              fontSize: "28px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ‹
          </button>

          <button
            onClick={next}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "white",
              fontSize: "28px",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Image */}
      <img
        src={images[index]}
        alt={`Image ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "92vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: "8px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.8)",
          cursor: "default",
        }}
      />

      {/* Dot indicators */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "8px",
          }}
        >
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to image ${i + 1}`}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: i === index ? "#ffffff" : "rgba(255,255,255,0.35)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "white",
            fontSize: "14px",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            background: "rgba(255,255,255,0.1)",
            padding: "4px 12px",
            borderRadius: "12px",
          }}
        >
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

const PostCard = ({
  post,
  currentUser,
  onReaction,
  onComment,
  onToggleComments,
  onShare,
  onDelete,
}) => {
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxData, setLightboxData] = useState(null); // { images: [], startIndex: 0 }
  const pickerRef = useRef();
  const shareRef = useRef();
  const menuRef = useRef();

  const initials = (post.username || "?").slice(0, 2).toUpperCase();
  const totalReactions = Object.values(post.reactionCounts || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const myReact = REACTIONS.find((r) => r.key === post.myReaction);

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowPicker(false);
      if (shareRef.current && !shareRef.current.contains(e.target))
        setShowShareMenu(false);
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCommentSubmit = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (commentText.trim()) {
        onComment(post.id, commentText);
        setCommentText("");
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard
      ?.writeText(`https://zixplon.app/post/${post.id}`)
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  return (
    <>
      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          startIndex={lightboxData.startIndex}
          onClose={() => setLightboxData(null)}
        />
      )}

      <div className="pf-card">
        <div className="pf-card-header">
          <div className="pf-avatar pf-avatar-green">{initials}</div>
          <div className="pf-card-meta">
            <p className="pf-card-author">
              {post.username}
              {post.feeling && (
                <span className="pf-card-feeling"> — feeling {post.feeling}</span>
              )}
            </p>
            <p className="pf-card-time">
              {timeAgo(post.created_at)}&nbsp;
              {PRIVACY_ICON[post.privacy] || "🌐"}
            </p>
          </div>

          {post.username === currentUser && (
            <div className="pf-menu-wrap" ref={menuRef}>
              <button
                className="pf-icon-btn"
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Post options"
              >
                ⋯
              </button>
              {showMenu && (
                <div className="pf-dropdown">
                  <button
                    className="pf-dropdown-item pf-dropdown-danger"
                    onClick={() => {
                      onDelete(post.id);
                      setShowMenu(false);
                    }}
                  >
                    🗑️ Delete post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pf-card-body">
          {post.text && <p className="pf-card-text">{post.text}</p>}

          {post.image_urls && post.image_urls.length > 0 ? (
            <div className={`pf-img-grid pf-img-grid-${Math.min(post.image_urls.length, 4)}`}>
              {post.image_urls.slice(0, 4).map((url, idx) => (
                <div
                  className="pf-img-grid-item"
                  key={idx}
                  onClick={() =>
                    setLightboxData({ images: post.image_urls, startIndex: idx })
                  }
                >
                  <img src={url} alt={`Post image ${idx + 1}`} loading="lazy" />
                  {idx === 3 && post.image_urls.length > 4 && (
                    <div className="pf-img-grid-more">
                      +{post.image_urls.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            post.image_url && (
              <img
                src={post.image_url}
                alt="Post"
                className="pf-card-image"
                loading="lazy"
                onClick={() =>
                  setLightboxData({ images: [post.image_url], startIndex: 0 })
                }
                style={{ cursor: "zoom-in" }}
              />
            )
          )}

          {post.link && (
            <a
              href={post.link.url}
              target="_blank"
              rel="noreferrer"
              className="pf-link-preview"
            >
              <div className="pf-link-bar" />
              <div className="pf-link-body">
                <p className="pf-link-domain">{post.link.domain}</p>
                <p className="pf-link-title">{post.link.title}</p>
                <p className="pf-link-desc">{post.link.desc}</p>
              </div>
            </a>
          )}
        </div>

        {totalReactions > 0 && (
          <div className="pf-reaction-summary">
            <div className="pf-reaction-emojis">
              {Object.entries(post.reactionCounts || {})
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k]) => {
                  const r = REACTIONS.find((x) => x.key === k);
                  return r ? <span key={k}>{r.emoji}</span> : null;
                })}
              <span className="pf-reaction-count">{totalReactions}</span>
            </div>
            <button
              className="pf-text-btn"
              onClick={() => onToggleComments(post.id)}
            >
              {post.comments?.length || 0} comment
              {post.comments?.length !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        <div className="pf-action-bar">
          <div className="pf-action-wrap" ref={pickerRef}>
            <button
              className={`pf-action-btn ${post.myReaction ? "pf-action-active" : ""}`}
              style={myReact ? { color: myReact.color } : {}}
              onClick={() => {
                if (!currentUser || currentUser === "anonymous") {
                  window.dispatchEvent(new CustomEvent("openLogin"));
                  return;
                }
                if (post.myReaction) onReaction(post.id, post.myReaction);
                else setShowPicker((v) => !v);
              }}
              onMouseEnter={() => {
                if (currentUser && currentUser !== "anonymous")
                  setShowPicker(true);
              }}
            >
              {myReact ? myReact.emoji : "👍"}
              <span>{myReact ? myReact.label : "Like"}</span>
            </button>
            {showPicker && (
              <div
                className="pf-reaction-picker"
                onMouseLeave={() => setShowPicker(false)}
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r.key}
                    className="pf-reaction-pick-btn"
                    title={r.label}
                    onClick={() => {
                      onReaction(post.id, r.key);
                      setShowPicker(false);
                    }}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="pf-action-btn"
            onClick={() => {
              if (!currentUser || currentUser === "anonymous") {
                window.dispatchEvent(new CustomEvent("openLogin"));
                return;
              }
              onToggleComments(post.id);
            }}
          >
            💬 <span>Comment</span>
          </button>

          <div className="pf-action-wrap" ref={shareRef}>
            <button
              className="pf-action-btn"
              onClick={() => setShowShareMenu((v) => !v)}
            >
              🔁 <span>Share</span>
            </button>
            {showShareMenu && (
              <div className="pf-dropdown pf-dropdown-up">
                <button
                  className="pf-dropdown-item"
                  onClick={() => {
                    onShare(post.id);
                    setShowShareMenu(false);
                  }}
                >
                  📢 Share to feed
                </button>
                <button className="pf-dropdown-item" onClick={handleCopyLink}>
                  {copied ? "✅ Copied!" : "🔗 Copy link"}
                </button>
              </div>
            )}
          </div>
        </div>

        {post.showComments && (
          <div className="pf-comments-section">
            {(post.comments || []).map((c) => (
              <div className="pf-comment" key={c.id}>
                <div className="pf-avatar pf-avatar-sm pf-avatar-amber">
                  {(c.username || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="pf-comment-bubble">
                  <p className="pf-comment-author">{c.username}</p>
                  <p className="pf-comment-text">{c.text}</p>
                </div>
              </div>
            ))}

            <div className="pf-comment-input-row">
              <div className="pf-avatar pf-avatar-sm">
                {currentUser.slice(0, 2).toUpperCase()}
              </div>
              <input
                className="pf-comment-input"
                placeholder={
                  !currentUser || currentUser === "anonymous"
                    ? "Login to comment…"
                    : "Write a comment… (Enter to send)"
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleCommentSubmit}
                disabled={!currentUser || currentUser === "anonymous"}
                style={
                  !currentUser || currentUser === "anonymous"
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : {}
                }
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PostCard;