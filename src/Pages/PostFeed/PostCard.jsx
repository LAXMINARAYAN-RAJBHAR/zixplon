import React, { useState, useRef, useEffect } from "react";

const REACTIONS = [
  { key: "like",  emoji: "👍", label: "Like",  color: "#1877f2" },
  { key: "love",  emoji: "❤️", label: "Love",  color: "#e0245e" },
  { key: "haha",  emoji: "😂", label: "Haha",  color: "#f5a623" },
  { key: "wow",   emoji: "😮", label: "Wow",   color: "#f5a623" },
  { key: "sad",   emoji: "😢", label: "Sad",   color: "#f5a623" },
  { key: "angry", emoji: "😡", label: "Angry", color: "#e05e00" },
];

const PRIVACY_ICON = { public: "🌐", friends: "👥", only_me: "🔒" };

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const PostCard = ({
  post, currentUser,
  onReaction, onComment, onToggleComments, onShare, onDelete,
}) => {
  const [commentText, setCommentText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const pickerRef = useRef();
  const shareRef = useRef();
  const menuRef = useRef();

  const initials = (post.username || "?").slice(0, 2).toUpperCase();
  const totalReactions = Object.values(post.reactionCounts || {}).reduce((a, b) => a + b, 0);
  const myReact = REACTIONS.find((r) => r.key === post.myReaction);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false);
      if (shareRef.current && !shareRef.current.contains(e.target)) setShowShareMenu(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
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
    navigator.clipboard?.writeText(`https://zixplon.app/post/${post.id}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  return (
    <div className="pf-card">
      {/* Header */}
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
            >⋯</button>
            {showMenu && (
              <div className="pf-dropdown">
                <button
                  className="pf-dropdown-item pf-dropdown-danger"
                  onClick={() => { onDelete(post.id); setShowMenu(false); }}
                >🗑️ Delete post</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="pf-card-body">
        {post.text && <p className="pf-card-text">{post.text}</p>}

        {post.image_url && (
          <img
            src={post.image_url}
            alt="Post"
            className="pf-card-image"
            loading="lazy"
          />
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

      {/* Reaction summary */}
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
            {post.comments?.length || 0} comment{post.comments?.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="pf-action-bar">
        {/* Like with reaction picker */}
        <div className="pf-action-wrap" ref={pickerRef}>
          <button
            className={`pf-action-btn ${post.myReaction ? "pf-action-active" : ""}`}
            style={myReact ? { color: myReact.color } : {}}
            onClick={() => {
              if (post.myReaction) onReaction(post.id, post.myReaction);
              else setShowPicker((v) => !v);
            }}
            onMouseEnter={() => setShowPicker(true)}
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
                  onClick={() => { onReaction(post.id, r.key); setShowPicker(false); }}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="pf-action-btn"
          onClick={() => onToggleComments(post.id)}
        >
          💬 <span>Comment</span>
        </button>

        {/* Share */}
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
                onClick={() => { onShare(post.id); setShowShareMenu(false); }}
              >📢 Share to feed</button>
              <button className="pf-dropdown-item" onClick={handleCopyLink}>
                {copied ? "✅ Copied!" : "🔗 Copy link"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments section */}
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
              placeholder="Write a comment… (Enter to send)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleCommentSubmit}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;