import React, { useState, useRef } from "react";
import { supabase } from "../../config/supabase";
import axios from "axios";

const CLOUDINARY_CLOUD = "dwoqk0yue";
const CLOUDINARY_PRESET = "youtube-clone";

const MAX_IMAGES = 6;

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
  const [imageFiles, setImageFiles] = useState([]); // [{ file, preview }]
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
  const canPost = text.trim() || imageFiles.length > 0 || linkUrl;

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError("");

    const remainingSlots = MAX_IMAGES - imageFiles.length;
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_IMAGES} images.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Only ${remainingSlots} more image(s) can be added (max ${MAX_IMAGES}).`);
    }

    filesToAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageFiles((prev) => [...prev, { file, preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setImageFiles([]);
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

  const uploadImageToCloudinary = async (file, onProgress) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", CLOUDINARY_PRESET);
    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      data,
      {
        onUploadProgress: (e) => onProgress(Math.round((e.loaded * 100) / e.total)),
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
      let imageUrls = [];
      if (imageFiles.length > 0) {
        const total = imageFiles.length;
        for (let i = 0; i < total; i++) {
          const url = await uploadImageToCloudinary(imageFiles[i].file, (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgress(overall);
          });
          imageUrls.push(url);
        }
      }

      const payload = {
        username: currentUser,
        text: text.trim() || null,
        image_url: imageUrls[0] || null, // backward compatibility
        image_urls: imageUrls.length > 0 ? imageUrls : null,
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
      clearAllImages();
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

          {imageFiles.length > 0 && (
            <div className="pf-img-preview-grid">
              {imageFiles.map((img, idx) => (
                <div className="pf-img-preview-wrap" key={idx}>
                  <img src={img.preview} alt={`Preview ${idx + 1}`} className="pf-img-preview" />
                  <button
                    className="pf-img-clear"
                    onClick={() => removeImage(idx)}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
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
              <div className="pf-progress-bar-track">
                <div className="pf-progress-bar" style={{ width: `${uploadProgress}%` }} />
              </div>
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
              multiple
              style={{ display: "none" }}
              onChange={handleImageSelect}
              disabled={imageFiles.length >= MAX_IMAGES}
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
          {imageFiles.length > 0 && (
            <span className="pf-image-count">{imageFiles.length}/{MAX_IMAGES}</span>
          )}
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