import React, { useState, useRef } from "react";
import { supabase } from "../../config/supabase";
import axios from "axios";

const CLOUDINARY_CLOUD = "dwoqk0yue";
const CLOUDINARY_PRESET = "youtube-clone";

const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: "🌐" },
  { value: "friends", label: "Friends", icon: "👥" },
  { value: "only_me", label: "Only me", icon: "🔒" },
];

const FEELINGS = [
  "Happy 😊", "Excited 🤩", "Grateful 🙏", "Blessed ✨",
  "Motivated 💪", "Tired 😴", "Loved ❤️", "Proud 🎉",
];

const PostComposer = ({ currentUser, onPost }) => {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showFeelings, setShowFeelings] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const initials = currentUser.slice(0, 2).toUpperCase();
  const canPost = text.trim() || imageFile || linkUrl;

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleLinkInput = (val) => {
    setLinkUrl(val);
    if (!val) { setLinkPreview(null); return; }
    try {
      const domain = new URL(val).hostname;
      setLinkPreview({ url: val, domain, title: `Link from ${domain}`, desc: val });
    } catch {
      setLinkPreview(null);
    }
  };

  const uploadImageToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_PRESET);
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      data,
      {
        onUploadProgress: (e) =>
          setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      }
    );
    return res.data.secure_url;
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError("");
    setUploadProgress(0);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImageToCloudinary(imageFile);
      }

      const payload = {
        username: currentUser,
        text: text.trim() || null,
        image_url: imageUrl,
        link: linkPreview || null,
        feeling: feeling || null,
        privacy,
      };

      const { data, error: insertErr } = await supabase
        .from("posts")
        .insert(payload)
        .select()
        .single();

      if (insertErr) throw insertErr;

      onPost({
        ...data,
        myReaction: null,
        reactionCounts: {},
        comments: [],
        showComments: false,
      });

      // Reset
      setText("");
      clearImage();
      setLinkUrl("");
      setLinkPreview(null);
      setShowLinkInput(false);
      setFeeling("");
      setShowFeelings(false);
      setUploadProgress(0);
    } catch (err) {
      setError(err.message || "Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="pf-composer">
      <div className="pf-composer-top">
        <div className="pf-avatar">{initials}</div>
        <div className="pf-composer-body">
          <textarea
            className="pf-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`What's on your mind, ${currentUser}?`}
            rows={3}
          />

          {feeling && (
            <p className="pf-feeling-badge">— feeling {feeling}</p>
          )}

          {imagePreview && (
            <div className="pf-img-preview-wrap">
              <img src={imagePreview} alt="Preview" className="pf-img-preview" />
              <button className="pf-img-clear" onClick={clearImage} aria-label="Remove image">✕</button>
            </div>
          )}

          {showLinkInput && (
            <input
              type="url"
              className="pf-link-input"
              placeholder="Paste a URL…"
              value={linkUrl}
              onChange={(e) => handleLinkInput(e.target.value)}
            />
          )}

          {linkPreview && (
            <div className="pf-link-preview">
              <div className="pf-link-bar" />
              <div className="pf-link-body">
                <p className="pf-link-domain">{linkPreview.domain}</p>
                <p className="pf-link-title">{linkPreview.title}</p>
                <p className="pf-link-desc">{linkPreview.desc}</p>
              </div>
            </div>
          )}

          {posting && uploadProgress > 0 && (
            <div className="pf-progress-wrap">
              <div className="pf-progress-bar" style={{ width: `${uploadProgress}%` }} />
              <span className="pf-progress-label">{uploadProgress}%</span>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}
        </div>
      </div>

      {showFeelings && (
        <div className="pf-feelings-grid">
          {FEELINGS.map((f) => (
            <button
              key={f}
              className={`pf-feeling-btn ${feeling === f ? "active" : ""}`}
              onClick={() => { setFeeling(feeling === f ? "" : f); setShowFeelings(false); }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="pf-composer-footer">
        <div className="pf-attach-row">
          <label className="pf-attach-btn" title="Photo">
            📷
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
          </label>
          <button
            className="pf-attach-btn"
            title="Link"
            onClick={() => setShowLinkInput((v) => !v)}
          >🔗</button>
          <button
            className="pf-attach-btn"
            title="Feeling"
            onClick={() => setShowFeelings((v) => !v)}
          >😊</button>
        </div>

        <div className="pf-composer-actions">
          <select
            className="pf-privacy-select"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
          >
            {PRIVACY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.icon} {o.label}
              </option>
            ))}
          </select>

          <button
            className="pf-post-btn"
            onClick={handleSubmit}
            disabled={!canPost || posting}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;