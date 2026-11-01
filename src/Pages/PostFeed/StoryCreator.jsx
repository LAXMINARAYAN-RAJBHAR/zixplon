import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../config/supabase";
import MusicPicker from "../../Component/Shared/MusicPicker";
import {
  uploadToR2,
  buildTransformUrl,
  uploadVideoToR2,
} from "../../utils/mediaUpload";
import { normalizeLinkUrl } from "../../utils/safeUrl";

// ─────────────────────────────────────────────────────────────────────────
// StoryCreator — popup for sharing new stories.
//
// CHANGED: supports MULTIPLE photos / videos (up to MAX_ITEMS) in one go.
// Pick many files at once, then press ONE "Share" button. Each item
// becomes its own row in the `stories` table, inserted one at a time in
// the order shown so created_at keeps that order (the viewer plays a
// person's stories oldest -> newest). No database or viewer changes needed.
//
//   • Caption is per item.
//   • Music, link and the "AI-generated" label apply to every item.
//   • All files are uploaded first; only then are rows inserted, so a
//     failed upload doesn't leave half a story posted.
// ─────────────────────────────────────────────────────────────────────────

const MAX_ITEMS = 10;
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

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const StoryCreator = ({ currentUser, onClose, onCreated }) => {
  const [open, setOpen] = useState(false); // drives pop-in / pop-out
  // [{ id, file, preview, type, duration, caption }]
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(0); // which item is shown / being captioned
  const [song, setSong] = useState(null); // { title, artist, cover, url }
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(""); // "Uploading 2 of 5…"
  const [error, setError] = useState("");
  const closeTimerRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Pop in on the frame after mount so the CSS transition actually runs.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Free every preview object URL on unmount.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview));
    };
  }, []);

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

  // ── Adding files (first pick or "+ add more") ──
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setError("");

    const room = MAX_ITEMS - itemsRef.current.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_ITEMS} items to a story.`);
      return;
    }

    const problems = [];
    const picked = files.slice(0, room);
    if (files.length > room) {
      problems.push(
        `Only ${MAX_ITEMS} items fit in one story, so ${files.length - room} were skipped.`
      );
    }

    const accepted = [];
    for (const file of picked) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        problems.push(`"${file.name}" isn't a photo or video.`);
        continue;
      }

      let duration = null;
      if (isVideo) {
        duration = await readVideoDuration(file);
        if (duration && duration > MAX_VIDEO_SECONDS) {
          problems.push(
            `"${file.name}" is ${Math.round(duration)}s long (max ${MAX_VIDEO_SECONDS}s).`
          );
          continue;
        }
      }

      accepted.push({
        id: newId(),
        file,
        preview: URL.createObjectURL(file),
        type: isImage ? "image" : "video",
        duration,
        caption: "",
      });
    }

    if (accepted.length > 0) {
      const firstNewIndex = itemsRef.current.length;
      setItems((prev) => [...prev, ...accepted]);
      setSel(firstNewIndex);
    }
    if (problems.length > 0) setError(problems.join(" "));
  };

  const removeItem = (idx) => {
    if (posting) return;
    const target = itemsRef.current[idx];
    if (target) URL.revokeObjectURL(target.preview);
    const nextLen = itemsRef.current.length - 1;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setSel((s) => {
      if (nextLen <= 0) return 0;
      if (idx < s) return s - 1;
      return Math.min(s, nextLen - 1);
    });
    setError("");
  };

  const setCaptionForSelected = (value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === sel ? { ...it, caption: value } : it))
    );
  };

  const clearLink = () => {
    setLinkUrl("");
    setLinkLabel("");
    setShowLink(false);
  };

  const handleShare = async () => {
    if (items.length === 0 || posting) return;
    setError("");

    // Check the link BEFORE uploading, so a typo doesn't waste uploads.
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

    const queue = [...items]; // snapshot, in display order
    const total = queue.length;

    try {
      // 1) Upload everything first (sequentially, to keep progress simple
      //    and bandwidth sane).
      const uploaded = [];
      for (let i = 0; i < total; i++) {
        const it = queue[i];
        setStage(`Uploading ${i + 1} of ${total}…`);
        const onPct = (pct) =>
          setProgress(Math.round(((i + pct / 100) / total) * 100));

        let mediaUrl;
        if (it.type === "image") {
          const { url } = await uploadToR2(it.file, onPct);
          // Stories are shown full-screen, so a larger width than posts.
          mediaUrl = buildTransformUrl(url, { width: 1080, quality: 85 });
        } else {
          const { url } = await uploadVideoToR2(it.file, onPct);
          mediaUrl = url;
        }
        uploaded.push({ item: it, mediaUrl });
      }

      // 2) Insert the rows ONE AT A TIME, in order. (A single batch insert
      //    would give every row the same created_at and the play order
      //    would be undefined.)
      setStage("Sharing…");
      const created = [];
      try {
        for (const { item, mediaUrl } of uploaded) {
          const { data, error: insertErr } = await supabase
            .from("stories")
            .insert({
              username: currentUser,
              media_url: mediaUrl,
              media_type: item.type,
              caption: item.caption.trim() || null,
              duration_seconds: item.duration,
              song: song || null,
              ai_generated: aiGenerated,
              link_url: cleanLink,
              link_label: cleanLink ? linkLabel.trim() || null : null,
            })
            .select()
            .single();
          if (insertErr) throw insertErr;
          created.push({ row: data, itemId: item.id });
        }
      } catch (insertErr) {
        // Some may already be live — show them, and remove them from the
        // list so a retry doesn't post them twice.
        if (created.length > 0) {
          onCreated?.(created.map((c) => c.row));
          const postedIds = new Set(created.map((c) => c.itemId));
          setItems((prev) => prev.filter((it) => !postedIds.has(it.id)));
          setSel(0);
          throw new Error(
            `${created.length} of ${total} were shared, but the rest failed: ${
              insertErr.message || "please try again."
            }`
          );
        }
        throw insertErr;
      }

      onCreated?.(created.map((c) => c.row));
      animateClose();
    } catch (err) {
      setError(err.message || "Couldn't share your story. Please try again.");
    } finally {
      setPosting(false);
      setStage("");
    }
  };

  const current = items[sel];
  const atLimit = items.length >= MAX_ITEMS;

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
          {items.length === 0 ? (
            <label className="pf-story-drop">
              <span className="pf-story-drop-icon">🖼️</span>
              <b>Add photos or videos</b>
              <small>
                Select up to {MAX_ITEMS} at once · videos up to{" "}
                {MAX_VIDEO_SECONDS} seconds · visible for 24 hours
              </small>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <>
              {/* Large preview of the selected item */}
              <div className="pf-story-preview">
                {current.type === "image" ? (
                  <img key={current.id} src={current.preview} alt="Story preview" />
                ) : (
                  <video
                    key={current.id}
                    src={current.preview}
                    controls
                    muted
                    loop
                    playsInline
                  />
                )}
                {items.length > 1 && (
                  <span className="pf-story-preview-count">
                    {sel + 1} / {items.length}
                  </span>
                )}
              </div>

              {/* Thumbnail strip: switch, remove, add more */}
              <div className="pf-story-thumbs">
                {items.map((it, i) => (
                  <div
                    key={it.id}
                    className={`pf-story-thumb${i === sel ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="pf-story-thumb-main"
                      onClick={() => setSel(i)}
                      aria-label={`Show item ${i + 1}`}
                    >
                      {it.type === "image" ? (
                        <img src={it.preview} alt="" draggable={false} />
                      ) : (
                        <>
                          <video
                            src={`${it.preview}#t=0.1`}
                            preload="metadata"
                            muted
                            playsInline
                          />
                          <span className="pf-story-thumb-play">▶</span>
                        </>
                      )}
                    </button>
                    {!posting && (
                      <button
                        type="button"
                        className="pf-story-thumb-remove"
                        onClick={() => removeItem(i)}
                        aria-label={`Remove item ${i + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                {!atLimit && !posting && (
                  <label className="pf-story-thumb pf-story-thumb--add" title="Add more">
                    <span>+</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>

              {/* Caption for the selected item */}
              <input
                type="text"
                className="pf-story-caption-input"
                placeholder={
                  items.length > 1
                    ? `Caption for item ${sel + 1} (optional)…`
                    : "Add a caption (optional)…"
                }
                maxLength={CAPTION_MAX}
                value={current.caption}
                onChange={(e) => setCaptionForSelected(e.target.value)}
                disabled={posting}
              />

              {/* Music + Link (apply to all items) */}
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

              {items.length > 1 && (song || linkUrl.trim() || aiGenerated) && (
                <small className="pf-story-apply-note">
                  Music, link and the AI label are added to all {items.length} items.
                </small>
              )}

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

          {posting && (
            <div className="pf-progress-wrap">
              <div className="pf-progress-bar-track">
                <div
                  className="pf-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="pf-progress-label">{stage || `${progress}%`}</span>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}

          <button
            type="button"
            className="pf-post-btn pf-story-share-btn"
            onClick={handleShare}
            disabled={items.length === 0 || posting}
          >
            {posting
              ? "Sharing…"
              : items.length > 1
                ? `Share ${items.length} to story`
                : "Share to story"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StoryCreator;