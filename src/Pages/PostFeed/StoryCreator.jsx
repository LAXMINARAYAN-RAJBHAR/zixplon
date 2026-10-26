import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../config/supabase";
import MusicPicker from "../../Component/Shared/MusicPicker";
import {
  uploadToR2,
  buildTransformUrl,
  uploadVideoToR2,
} from "../../utils/mediaUpload";
// NEW: sanitises the typed link (adds https://, blocks javascript: etc.)
import { normalizeLinkUrl } from "../../utils/safeUrl";

// ─────────────────────────────────────────────────────────────────────────
// StoryCreator — popup for sharing a new story (one photo OR one video
// plus an optional caption, music, a link, and an "AI-generated" label).
// Reuses the `.pf-modal-*` popup styles from PostFeed.composer-popup.css,
// so it pops in / out the same way the Post Composer does.
//
// Uploads go through the same R2 helpers as PostComposer. The finished
// row is inserted into the `stories` table (see the story SQL files);
// the strip refreshes itself through onCreated + realtime.
//
// NEW: optional link. Needs story_link_migration.sql (adds link_url and
// link_label columns to `stories`).
// ─────────────────────────────────────────────────────────────────────────

const MAX_VIDEO_SECONDS = 60;
const CAPTION_MAX = 200;
const LINK_LABEL_MAX = 30;
const CLOSE_ANIMATION_MS = 200;

// Reads a video's length without uploading it. Resolves null if the
// browser can't read the metadata (the upload is still allowed then).
const readVideoDuration = (file) =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (d) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });

const StoryCreator = ({ currentUser, onClose, onCreated }) => {
  const [open, setOpen] = useState(false); // drives pop-in / pop-out
  const [media, setMedia] = useState(null); // { file, preview, type, duration }
  const [caption, setCaption] = useState("");
  const [song, setSong] = useState(null); // { title, artist, cover, url }
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  // NEW: optional link shown on the story as a tappable button
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const closeTimerRef = useRef(null);

  // Pop in on the frame after mount so the CSS transition actually runs.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Free the preview object URL when the file changes / on unmount.
  useEffect(() => {
    return () => {
      if (media?.preview) URL.revokeObjectURL(media.preview);
    };
  }, [media]);

  const animateClose = () => {
    setOpen(false);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  // Closing mid-upload is blocked so a story can't be half-shared.
  const requestClose = () => {
    if (posting) return;
    animateClose();
  };

  // Scroll lock + Esc to close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !posting) animateClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posting]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("Please choose a photo or a video.");
      return;
    }

    let duration = null;
    if (isVideo) {
      duration = await readVideoDuration(file);
      if (duration && duration > MAX_VIDEO_SECONDS) {
        setError(
          `That video is ${Math.round(duration)}s long. Stories can be up to ${MAX_VIDEO_SECONDS}s.`
        );
        return;
      }
    }

    setMedia({
      file,
      preview: URL.createObjectURL(file),
      type: isImage ? "image" : "video",
      duration,
    });
  };

  const removeMedia = () => {
    if (posting) return;
    setMedia(null);
    setError("");
  };

  const clearLink = () => {
    setLinkUrl("");
    setLinkLabel("");
    setShowLink(false);
  };

  const handleShare = async () => {
    if (!media || posting) return;
    setError("");

    // NEW: check the link BEFORE uploading, so a typo doesn't waste an upload.
    let cleanLink = null;
    if (linkUrl.trim()) {
      cleanLink = normalizeLinkUrl(linkUrl);
      if (!cleanLink) {
        setShowLink(true);
        setError(
          "That link doesn't look right. Use a web address like zixplon.in/page or https://example.com."
        );
        return;
      }
    }

    setPosting(true);
    setProgress(0);

    try {
      let mediaUrl;
      if (media.type === "image") {
        const { url } = await uploadToR2(media.file, (pct) =>
          setProgress(Math.round(pct))
        );
        // Stories are shown full-screen, so a larger width than posts (800).
        mediaUrl = buildTransformUrl(url, { width: 1080, quality: 85 });
      } else {
        const { url } = await uploadVideoToR2(media.file, (pct) =>
          setProgress(Math.round(pct))
        );
        mediaUrl = url;
      }

      const { data, error: insertErr } = await supabase
        .from("stories")
        .insert({
          username: currentUser,
          media_url: mediaUrl,
          media_type: media.type,
          caption: caption.trim() || null,
          duration_seconds: media.duration,
          // Needs story_extras_migration.sql
          song: song || null,
          ai_generated: aiGenerated,
          // Needs story_link_migration.sql
          link_url: cleanLink,
          link_label: cleanLink ? linkLabel.trim() || null : null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      onCreated?.(data);
      animateClose();
    } catch (err) {
      setError(err.message || "Couldn't share your story. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return createPortal(
    <div
      className={`pf-modal-overlay${open ? " open" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className="pf-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Create story"
      >
        <div className="pf-modal-header">
          <span className="pf-modal-title">Create story</span>
          <button
            type="button"
            className="pf-modal-close"
            onClick={requestClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="pf-story-create-body">
          {!media ? (
            <label className="pf-story-drop">
              <span className="pf-story-drop-icon">🖼️</span>
              <b>Add a photo or video</b>
              <small>
                Videos up to {MAX_VIDEO_SECONDS} seconds · visible for 24 hours
              </small>
              <input
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="pf-story-preview">
              {media.type === "image" ? (
                <img src={media.preview} alt="Story preview" />
              ) : (
                <video
                  src={media.preview}
                  controls
                  muted
                  loop
                  playsInline
                />
              )}
              {!posting && (
                <button
                  type="button"
                  className="pf-img-clear"
                  onClick={removeMedia}
                  aria-label="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {media && (
            <>
              <input
                type="text"
                className="pf-story-caption-input"
                placeholder="Add a caption (optional)…"
                maxLength={CAPTION_MAX}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={posting}
              />

              {/* Music + Link */}
              <div className="pf-story-addons">
                <div className="pf-story-addon-wrap">
                  <button
                    type="button"
                    className="pf-story-addon-btn"
                    onClick={() => setShowMusicPicker((v) => !v)}
                    disabled={posting}
                  >
                    🎵 {song ? "Change music" : "Add music"}
                  </button>
                  {showMusicPicker && (
                    <MusicPicker
                      anchor="left"
                      position="bottom"
                      onSelect={(s) => setSong(s)}
                      onClose={() => setShowMusicPicker(false)}
                    />
                  )}
                </div>

                {song && (
                  <span className="pf-story-song-chip">
                    🎵 {song.title}
                    {song.artist ? ` · ${song.artist}` : ""}
                    <button
                      type="button"
                      onClick={() => setSong(null)}
                      aria-label="Remove music"
                      disabled={posting}
                    >
                      ✕
                    </button>
                  </span>
                )}

                {/* NEW: link */}
                <div className="pf-story-addon-wrap">
                  <button
                    type="button"
                    className="pf-story-addon-btn"
                    onClick={() => setShowLink((v) => !v)}
                    disabled={posting}
                  >
                    🔗 {linkUrl.trim() ? "Edit link" : "Add link"}
                  </button>
                </div>
              </div>

              {/* NEW: link fields */}
              {showLink && (
                <>
                  <input
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pf-story-caption-input"
                    placeholder="Paste a link (e.g. zixplon.in/page)…"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value);
                      setError("");
                    }}
                    disabled={posting}
                  />
                  <input
                    type="text"
                    className="pf-story-caption-input"
                    placeholder="Button text (optional, e.g. Watch now)"
                    maxLength={LINK_LABEL_MAX}
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    disabled={posting}
                  />
                  {(linkUrl || linkLabel) && (
                    <button
                      type="button"
                      className="pf-story-addon-btn"
                      onClick={clearLink}
                      disabled={posting}
                    >
                      ✕ Remove link
                    </button>
                  )}
                </>
              )}

              <label className="pf-story-ai-toggle">
                <input
                  type="checkbox"
                  checked={aiGenerated}
                  onChange={(e) => setAiGenerated(e.target.checked)}
                  disabled={posting}
                />
                <span>
                  <b>This contains AI-generated content</b>
                  <small>Viewers will see an "AI-generated" label on your story.</small>
                </span>
              </label>
            </>
          )}

          {posting && progress > 0 && (
            <div className="pf-progress-wrap">
              <div className="pf-progress-bar-track">
                <div
                  className="pf-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="pf-progress-label">{progress}%</span>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}

          <button
            type="button"
            className="pf-post-btn pf-story-share-btn"
            onClick={handleShare}
            disabled={!media || posting}
          >
            {posting ? "Sharing…" : "Share to story"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StoryCreator;