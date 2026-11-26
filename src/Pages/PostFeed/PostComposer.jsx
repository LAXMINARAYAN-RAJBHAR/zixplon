import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../config/supabase";
import axios from "axios";
import CommentMediaPicker from "../../Component/Shared/CommentMediaPicker";
import MusicPicker from "../../Component/Shared/MusicPicker";
import LocationPicker from "../../Component/Shared/LocationPicker";
import { uploadToR2, buildTransformUrl, uploadVideoToR2 } from "../../utils/mediaUpload";
import { getInitials } from "../../utils/initials";
// NEW (Reel mode): same moderation helper the Upload page (VideoUpload.jsx)
// uses when it saves a reel.
// NOTE: follower notifications for reels / videos are sent by the database
// triggers (trg_notify_subscribers_on_reel_upload / _video_upload), so
// nothing is sent from here — doing both used to notify every follower twice.
import { checkContent } from "../../Component/Moderation/useModerationFilter";
// NEW (Live / Record): the same record/go-live popup the Upload page uses.
// ⚠ Adjust this path to wherever RecordModal lives in your project — in
// VideoUpload.jsx it is imported as "../RecordModal/RecordModal".
import RecordModal from "../../Pages/RecordModal/RecordModal";
// NEW: i18n — t("key") follows the user's language preference (en / hi / mr).
import useT from "../../i18n";

// NOTE: no cap on image count anymore — ImageGrid/HomeImageGrid already
// render any number of images fine (4 visible tiles + a "+N" overlay for
// the rest, and PhotoViewer swipes through the full array). Uploads now
// go out sequentially regardless of count; a very large batch will just
// take proportionally longer and move the progress bar more slowly.
const MAX_VIDEO_MB = 4096; // adjust as needed — R2 has no per-request size ceiling like Vercel's function body did
const LINK_PREVIEW_DEBOUNCE_MS = 600;

// `label` is kept for reference; the UI shows t("privacy." + value).
const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", icon: "🌐" },
  { value: "friends", label: "Friends", icon: "👥" },
  { value: "only_me", label: "Only me", icon: "🔒" },
];

// NOTE: these exact strings are what gets saved with the post (and shown in
// the post header), so they stay English.
const FEELINGS = [
  "Happy 😊", "Excited 🤩", "Grateful 🙏", "Blessed ✨",
  "Motivated 💪", "Tired 😴", "Loved ❤️", "Proud 🎉",
];

// ─────────────────────────────────────────────────────────────────────────────
// captureThumbnail — v3: real frame from the video, every time it's possible.
//
// What changed vs v2:
//  • Tries several seek points (10% / 1s / 25% / 50% of the duration) instead
//    of a single 0.5s seek, because the very start of many videos is a black
//    fade-in frame.
//  • Measures each captured frame's brightness; if a frame is (almost) black
//    it tries the next seek point. If every point is dark, the BRIGHTEST
//    captured frame is used — still a real frame from the video.
//  • Downscales big frames (4K etc.) to max 1280px wide before JPEG encoding.
//  • Waits for the frame to actually be painted (requestVideoFrameCallback)
//    after each seek instead of relying on a play()/pause() trick.
//  • Callers now run this BEFORE the upload starts (not in parallel with it),
//    so a multi-GB upload can't starve the decoder and cause a timeout.
//
// It still rejects if the browser genuinely can't decode the file (e.g. an
// HEVC/H.265 .mov in a browser without that codec) — then the caller falls
// back to a generated cover so the post/reel always has *a* thumbnail.
// ─────────────────────────────────────────────────────────────────────────────
const BLACK_FRAME_THRESHOLD = 20; // average luminance (0–255) below this = "black"

const captureThumbnail = (file, { maxWidth = 1280, timeoutMs = 15000 } = {}) =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    // Attach off-screen (NOT display:none — some browsers skip decoding
    // frames for hidden video elements).
    video.style.position = "fixed";
    video.style.top = "-9999px";
    video.style.left = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    video.setAttribute("aria-hidden", "true");
    document.body.appendChild(video);

    let settled = false;
    let best = null; // { canvas, score } — brightest real frame seen so far

    const cleanup = () => {
      try { video.pause(); } catch (_) { }
      video.removeAttribute("src");
      try { video.load(); } catch (_) { }
      URL.revokeObjectURL(objectUrl);
      if (video.parentNode) video.parentNode.removeChild(video);
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const finishWith = async (canvas) => {
      if (settled) return;
      settled = true;
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      cleanup();
      if (blob) resolve(blob);
      else reject(new Error("Thumbnail capture failed."));
    };

    // Draw the current frame to a (downscaled) canvas.
    const drawFrame = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(1, maxWidth / vw);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas;
    };

    // Average luminance of a tiny copy of the frame (0 = black, 255 = white).
    const brightness = (canvas) => {
      try {
        const s = document.createElement("canvas");
        s.width = 24;
        s.height = 24;
        const sctx = s.getContext("2d");
        sctx.drawImage(canvas, 0, 0, 24, 24);
        const d = sctx.getImageData(0, 0, 24, 24).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        }
        return sum / (d.length / 4);
      } catch (_) {
        return 255; // can't measure → assume the frame is fine
      }
    };

    // Seek and resolve once `seeked` fires (or after 3s, so we never hang).
    const seekTo = (time) =>
      new Promise((res) => {
        let done = false;
        const finishSeek = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          video.removeEventListener("seeked", finishSeek);
          res();
        };
        const timer = setTimeout(finishSeek, 3000);
        video.addEventListener("seeked", finishSeek);
        try {
          video.currentTime = time;
        } catch (_) {
          finishSeek();
        }
      });

    // Wait until the seeked frame has actually been painted.
    const waitForFrame = () =>
      new Promise((res) => {
        let done = false;
        const go = () => {
          if (!done) { done = true; res(); }
        };
        setTimeout(go, 350);
        if ("requestVideoFrameCallback" in video) {
          video.requestVideoFrameCallback(go);
        }
      });

    const run = async () => {
      // Wait for the first decoded frame.
      await new Promise((res, rej) => {
        const to = setTimeout(
          () => rej(new Error("Video metadata timed out.")),
          8000
        );
        video.onloadeddata = () => { clearTimeout(to); res(); };
        video.onerror = () => {
          clearTimeout(to);
          rej(new Error("Failed to load video for thumbnail."));
        };
      });

      const dur = isFinite(video.duration) ? video.duration : 0;
      const clamp = (t) =>
        dur > 0 ? Math.min(Math.max(t, 0.05), Math.max(dur - 0.1, 0.05)) : t;
      const raw = dur > 0 ? [dur * 0.1, 1, dur * 0.25, dur * 0.5] : [0.1, 0.5, 1];
      const times = [...new Set(raw.map((t) => clamp(t).toFixed(2)))].map(Number);

      for (const time of times) {
        if (settled) return;
        await seekTo(time);
        await waitForFrame();
        if (settled) return;

        const canvas = drawFrame();
        if (!canvas) continue;

        const score = brightness(canvas);
        if (!best || score > best.score) best = { canvas, score };
        if (score >= BLACK_FRAME_THRESHOLD) break; // good frame — stop here
      }

      if (best) await finishWith(best.canvas);
      else fail(new Error("Could not read a frame from this video (unsupported format?)."));
    };

    // Overall safety net: use the best frame we have, otherwise give up.
    setTimeout(() => {
      if (settled) return;
      if (best) finishWith(best.canvas);
      else fail(new Error("Thumbnail capture timed out."));
    }, timeoutMs);

    video.src = objectUrl;
    video.load();
    run().catch(fail);
  });

// ─────────────────────────────────────────────────────────────────────────────
// NEW (Reel mode) helpers
// ─────────────────────────────────────────────────────────────────────────────

// Reads a video file's duration ("mm:ss" / "hh:mm:ss") and orientation from
// its metadata. Always resolves (error / stalled metadata → defaults).
const getVideoMeta = (file) =>
  new Promise((resolve) => {
    const fallback = { duration: "00:00", portrait: false };
    const el = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    el.preload = "metadata";

    const timer = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(fallback);
    }, 10000);

    el.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      const totalSec = Math.floor(el.duration) || 0;
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n) => String(n).padStart(2, "0");
      resolve({
        duration: hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`,
        portrait: el.videoHeight > el.videoWidth,
      });
    };
    el.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(fallback);
    };
    el.src = objectUrl;
  });

// Last-resort cover drawn on a canvas so a reel ALWAYS has a thumbnail,
// even when no frame could be captured (same idea as VideoUpload.jsx).
// Only used when captureThumbnail() above genuinely can't decode the file.
const generatePlaceholderThumbnail = (title, portrait) =>
  new Promise((resolve) => {
    const W = portrait ? 360 : 640;
    const H = portrait ? 640 : 360;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#b91c1c");
    gradient.addColorStop(1, "#f97316");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const r = Math.min(W, H) * 0.14;
    const cx = W / 2;
    const cy = H * 0.42;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.3, cy - r * 0.45);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.45);
    ctx.lineTo(cx + r * 0.5, cy);
    ctx.closePath();
    ctx.fill();

    const text = (title || "").trim();
    if (text) {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
      let shown = text;
      while (shown.length > 3 && ctx.measureText(shown).width > W * 0.86) {
        shown = shown.slice(0, -2);
      }
      if (shown !== text) shown = shown.trimEnd() + "…";
      ctx.fillText(shown, cx, H * 0.72);
    }

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(W * 0.04)}px sans-serif`;
    ctx.fillText("ZIXPLON", cx, H * 0.92);

    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });

const PostComposer = ({ currentUser, onPost, onReelPosted, onVideoPosted }) => {
  const { t } = useT();

  // NEW: what is being created — "post" (normal post), "reel" (saved to the
  // reels table) or "video" (saved to the videos table, like the Upload page).
  // "Live / Record" is not a mode: it opens the RecordModal popup instead.
  const [postAs, setPostAs] = useState("post");
  const [videoCategory, setVideoCategory] = useState("");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [successKind, setSuccessKind] = useState("reel");
  const [mediaTitle, setMediaTitle] = useState("");
  // NEW: how loud the video's own audio plays relative to an attached song.
  const [originalAudioVolume, setOriginalAudioVolume] = useState(1);
  // NEW: shown after a reel is shared.
  const [reelSuccess, setReelSuccess] = useState(false);

  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  // A GIF or sticker picked from CommentMediaPicker — { url, type }.
  // Already hosted by Giphy, so it needs no upload step; mutually
  // exclusive with images and video.
  const [gifStickerAttachment, setGifStickerAttachment] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showFeelings, setShowFeelings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [feeling, setFeeling] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  // Song ({ title, artist, cover, url }) and location-name attachments.
  const [song, setSong] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const fileRef = useRef();
  const videoRef = useRef();
  const linkDebounceRef = useRef(null);
  // Lets HomeHub's "+ Upload" -> "Post" menu item scroll this composer
  // into view and focus it, via the "zx:focus-composer" window event.
  const textareaRef = useRef();

  useEffect(() => {
    const focusComposer = () => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textareaRef.current?.focus();
    };
    window.addEventListener("zx:focus-composer", focusComposer);
    return () => {
      window.removeEventListener("zx:focus-composer", focusComposer);
      if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current);
    };
  }, []);

  const isReel = postAs === "reel";
  const isVideo = postAs === "video";
  // Reel and Video share the same "one uploaded video" behaviour.
  const isMedia = isReel || isVideo;
  const initials = getInitials(currentUser);

  const canPost = isMedia
    ? !!videoFile &&
      !!(mediaTitle.trim() || text.trim()) &&
      (!isVideo || !!videoCategory.trim())
    : text.trim() || imageFiles.length > 0 || videoFile || linkUrl || gifStickerAttachment;

  // NEW: switch between Post and Reel. A reel is a single video, so photos,
  // a GIF/sticker or a link can't come along — ask the user to remove them
  // first instead of silently throwing them away.
  const switchPostAs = (mode) => {
    if (mode === postAs || posting) return;
    setError("");
    setReelSuccess(false);
    if (mode === "reel" || mode === "video") {
      if (imageFiles.length > 0 || gifStickerAttachment || linkUrl) {
        setError(t("err.singleVideo", { kind: t("kind." + mode) }));
        return;
      }
      setShowLinkInput(false);
    }
    setPostAs(mode);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError("");

    if (videoFile) {
      setError(t("err.imagesOrVideoRemoveVideo"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (gifStickerAttachment) {
      setError(t("err.gifWithPhotos"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // No cap — every selected file gets added.
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageFiles((prev) => [...prev, { file, preview: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });

    if (fileRef.current) fileRef.current.value = "";
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (imageFiles.length > 0) {
      setError(t("err.imagesOrVideoRemoveImages"));
      if (videoRef.current) videoRef.current.value = "";
      return;
    }
    if (gifStickerAttachment) {
      setError(t("err.gifWithVideo"));
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("video/")) {
      setError(t("err.invalidVideo"));
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_VIDEO_MB) {
      setError(t("err.videoTooLarge", { gb: MAX_VIDEO_MB / 1024 }));
      if (videoRef.current) videoRef.current.value = "";
      return;
    }

    setVideoFile({ file, preview: URL.createObjectURL(file) });
    if (videoRef.current) videoRef.current.value = "";
  };

  const removeVideo = () => {
    if (videoFile?.preview) URL.revokeObjectURL(videoFile.preview);
    setVideoFile(null);
  };

  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setImageFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Picking a GIF/sticker from CommentMediaPicker. Blocked if images or a
  // video are already attached.
  const handleGifStickerSelect = ({ url, type }) => {
    setError("");
    if (isMedia) {
      setError(t("err.gifNotAllowed", { kind: t("kind." + postAs) }));
      return;
    }
    if (imageFiles.length > 0 || videoFile) {
      setError(t("err.gifWithMedia"));
      return;
    }
    setGifStickerAttachment({ url, type });
    setShowEmojiPicker(false);
  };

  const removeGifSticker = () => setGifStickerAttachment(null);

  // ── Real link preview: fetches Open Graph metadata from
  // /api/link-preview. Debounced so we don't hit the API on every
  // keystroke while the user is still typing/pasting the URL. ──
  const fetchLinkPreview = async (rawUrl) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      setLinkPreview(null);
      setFetchingPreview(false);
      return;
    }

    setFetchingPreview(true);
    try {
      const res = await axios.get("/api/link-preview", {
        params: { url: parsedUrl.toString() },
      });
      setLinkPreview(res.data);
    } catch {
      const domain = parsedUrl.hostname.replace(/^www\./, "");
      // NOTE: this title is saved with the post, so it stays English.
      setLinkPreview({
        url: parsedUrl.toString(),
        domain,
        title: `Link from ${domain}`,
        desc: parsedUrl.toString(),
        image: null,
      });
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleLinkInput = (val) => {
    setLinkUrl(val);

    if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current);

    if (!val.trim()) {
      setLinkPreview(null);
      setFetchingPreview(false);
      return;
    }

    linkDebounceRef.current = setTimeout(() => {
      fetchLinkPreview(val.trim());
    }, LINK_PREVIEW_DEBOUNCE_MS);
  };

  // ── Image upload — R2 ──
  const uploadImage = async (file, onProgress) => {
    const { url } = await uploadToR2(file, onProgress);
    return buildTransformUrl(url, { width: 800, quality: 85 });
  };

  // ── Thumbnail upload. format: "jpeg" (not the default "webp") because
  // this becomes the og:image for shared links, and WhatsApp's link-preview
  // crawler does not render webp images. `portrait` makes reel thumbnails
  // 360x640 instead of 16:9. ──
  const uploadThumbnail = async (blob, portrait = false) => {
    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
    const { url } = await uploadToR2(file);
    return buildTransformUrl(url, {
      width: portrait ? 360 : 640,
      height: portrait ? 640 : 360,
      fit: "cover",
      format: "jpeg",
    });
  };

  const resetAfterSuccess = () => {
    setText("");
    setMediaTitle("");
    clearAllImages();
    removeVideo();
    removeGifSticker();
    setLinkUrl("");
    setLinkPreview(null);
    setFetchingPreview(false);
    setShowLinkInput(false);
    setFeeling("");
    setShowFeelings(false);
    setSong(null);
    setLocationName(null);
    setShowMusicPicker(false);
    setShowLocationPicker(false);
    setOriginalAudioVolume(1);
    setVideoCategory("");
    setUploadProgress(0);
  };

  // ── NEW: share the picked video as a REEL or a VIDEO ──
  // Reel  → `reels` table (same payload as the Upload page's reel mode).
  // Video → `videos` table (same payload as the Upload page's video mode,
  //         including the required category).
  //
  // Follower notifications are NOT sent from here: the database triggers
  // on `reels` / `videos` already notify every follower on insert.
  const submitVideoContent = async () => {
    const title = mediaTitle.trim() || text.trim().slice(0, 60);
    const description = text.trim() || title;
    // `label` is used in error text; `kindLabel` is the word shown to THIS
    // user in their language.
    const label = isVideo ? "video" : "reel";
    const kindLabel = t("kind." + label);

    if (!videoFile) throw new Error(t("err.chooseVideo", { kind: kindLabel }));
    if (!title) throw new Error(t("err.addTitle", { kind: kindLabel }));
    if (isVideo && !videoCategory.trim()) throw new Error(t("err.addCategory"));

    // Same community-guidelines check the Upload page runs.
    // The error is tagged with `isModeration` (instead of matching its English
    // text) so it is still re-thrown after the message is translated.
    try {
      const { isClean, violatingWord } = await checkContent(
        title,
        description,
        isVideo ? videoCategory.trim() : "",
      );
      if (!isClean) {
        const modErr = new Error(t("err.moderation", { word: violatingWord }));
        modErr.isModeration = true;
        throw modErr;
      }
    } catch (moderationErr) {
      if (moderationErr?.isModeration) throw moderationErr;
      console.warn("Moderation check failed, proceeding:", moderationErr);
    }

    // ── Capture the thumbnail from the actual video FIRST (before the
    // upload starts), together with the duration/orientation metadata.
    // Running this while a large upload is in flight used to starve the
    // decoder and time out, which forced the generic placeholder cover. ──
    const [meta, capturedBlob] = await Promise.all([
      getVideoMeta(videoFile.file),
      captureThumbnail(videoFile.file).catch((err) => {
        console.warn("Thumbnail capture failed:", err.message);
        return null;
      }),
    ]);

    const { url: videoUrl } = await uploadVideoToR2(videoFile.file, (pct) =>
      setUploadProgress(pct)
    );

    // Use the frame captured from the video. Only if the browser genuinely
    // couldn't decode the file do we fall back to a generated cover so the
    // reel/video still gets a thumbnail.
    // Reels use portrait thumbnails when the video is portrait; long videos
    // are always 16:9.
    const portrait = isReel && meta.portrait;
    const thumbBlob = capturedBlob || (await generatePlaceholderThumbnail(title, portrait));
    if (!thumbBlob) throw new Error(t("err.thumbnail", { kind: kindLabel }));
    const thumbnailUrl = await uploadThumbnail(thumbBlob, portrait);

    const uploaderUsername = currentUser || "anonymous";
    let saved;

    if (isVideo) {
      const { data, error: videoError } = await supabase
        .from("videos")
        .insert([
          {
            title,
            description,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            category: videoCategory.trim(),
            channel: uploaderUsername,
            username: uploaderUsername,
            duration: meta.duration,
            song: song || null,
            location_name: locationName || null,
            feeling: feeling || null,
            original_audio_volume: song ? originalAudioVolume : 1,
          },
        ])
        .select()
        .single();
      if (videoError) throw new Error(videoError.message);
      saved = data;
    } else {
      const { data, error: reelError } = await supabase
        .from("reels")
        .insert([
          {
            title,
            description,
            video_url: videoUrl,
            thumbnail: thumbnailUrl,
            uploaded_by: uploaderUsername,
            username: uploaderUsername.toLowerCase().replace(/\s+/g, ""),
            duration: meta.duration,
            likes: 0,
            comments: 0,
            song: song || null,
            location_name: locationName || null,
            feeling: feeling || null,
            original_audio_volume: song ? originalAudioVolume : 1,
          },
        ])
        .select()
        .single();
      if (reelError) throw new Error(reelError.message);
      saved = data;
    }

    return saved;
  };

  const handleSubmit = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError("");
    setReelSuccess(false);
    setUploadProgress(0);

    try {
      // ── Reel / Video mode ──
      if (isMedia) {
        const saved = await submitVideoContent();
        resetAfterSuccess();
        setSuccessKind(isVideo ? "video" : "reel");
        setReelSuccess(true);
        if (isVideo) onVideoPosted?.(saved);
        else onReelPosted?.(saved);
        return;
      }

      // ── Normal post ──
      let imageUrls = [];
      let videoUrl = null;
      let thumbnailUrl = null;

      if (gifStickerAttachment) {
        // Already hosted by Giphy — no upload needed.
        imageUrls = [gifStickerAttachment.url];
      } else if (imageFiles.length > 0) {
        const total = imageFiles.length;
        for (let i = 0; i < total; i++) {
          const url = await uploadImage(imageFiles[i].file, (pct) => {
            const overall = Math.round(((i + pct / 100) / total) * 100);
            setUploadProgress(overall);
          });
          imageUrls.push(url);
        }
      } else if (videoFile) {
        // Capture the thumbnail from the video BEFORE the upload starts
        // (a big upload running at the same time can starve the decoder).
        // If capture fails we log it and continue — the post still goes
        // out with video_url set.
        const thumbnailBlob = await captureThumbnail(videoFile.file).catch((err) => {
          console.warn("Post video thumbnail capture failed:", err.message);
          return null;
        });

        const { url } = await uploadVideoToR2(videoFile.file, (pct) => {
          setUploadProgress(pct);
        });
        videoUrl = url;

        if (thumbnailBlob) {
          thumbnailUrl = await uploadThumbnail(thumbnailBlob);
        }
      }

      const payload = {
        username: currentUser,
        text: text.trim() || null,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl,
        // Requires: alter table posts add column thumbnail_url text;
        thumbnail_url: thumbnailUrl,
        link: linkPreview || null,
        feeling: feeling || null,
        // Requires:
        //   alter table posts add column song jsonb;
        //   alter table posts add column location_name text;
        song: song || null,
        location_name: locationName || null,
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

      resetAfterSuccess();
    } catch (err) {
      setError(
        err.message ||
        (isMedia
          ? t("err.shareFailed", { kind: t("kind." + postAs) })
          : t("err.postFailed"))
      );
    } finally {
      setPosting(false);
    }
  };

  const mediaAlreadyAttached = imageFiles.length > 0 || !!videoFile || !!gifStickerAttachment;

  const postLabel = posting
    ? isMedia ? t("composer.sharing") : t("composer.posting")
    : isReel
      ? t("composer.shareReel")
      : isVideo
        ? t("composer.shareVideo")
        : t("composer.postBtn");

  return (
    <div className="pf-composer">
      {/* NEW: Post / Reel / Video / Live switch */}
      <div className="pf-mode-toggle" role="tablist" aria-label={t("composer.create")}>
        {[
          { key: "post", label: `📝 ${t("composer.modePost")}` },
          { key: "reel", label: `🎬 ${t("composer.modeReel")}` },
          { key: "video", label: `📺 ${t("composer.modeVideo")}` },
        ].map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={postAs === m.key}
            className={`pf-mode-btn ${postAs === m.key ? "active" : ""}`}
            onClick={() => switchPostAs(m.key)}
            disabled={posting}
          >
            {m.label}
          </button>
        ))}
        {/* Live / Record isn't a mode — it opens the record / go-live popup. */}
        <button
          type="button"
          className="pf-mode-btn pf-mode-btn--live"
          onClick={() => setShowRecordModal(true)}
          disabled={posting}
        >
          <span className="pf-live-dot" aria-hidden="true" />
          {t("composer.liveRecord")}
        </button>
      </div>

      <div className="pf-composer-top">
        <div className="pf-avatar">{initials}</div>
        <div className="pf-composer-body">
          {/* NEW: title (Reel / Video) and category (Video only) */}
          {isMedia && (
            <input
              type="text"
              className="pf-link-input"
              placeholder={isVideo ? t("composer.videoTitle") : t("composer.reelTitle")}
              value={mediaTitle}
              onChange={(e) => setMediaTitle(e.target.value)}
              maxLength={100}
            />
          )}
          {isVideo && (
            <input
              type="text"
              className="pf-link-input"
              placeholder={t("composer.category")}
              value={videoCategory}
              onChange={(e) => setVideoCategory(e.target.value)}
              maxLength={40}
            />
          )}

          <textarea
            ref={textareaRef}
            className="pf-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isReel
                ? t("composer.describeReel")
                : isVideo
                  ? t("composer.describeVideo")
                  : t("composer.placeholder", { name: currentUser })
            }
            rows={3}
          />

          {isMedia && !videoFile && (
            <p className="pf-reel-hint">
              {isReel ? t("composer.hintReel") : t("composer.hintVideo")}
            </p>
          )}

          {feeling && (
            <p className="pf-feeling-badge">— {t("post.feeling")} {feeling}</p>
          )}

          {/* Small 🎵 line (same as the post card header) — removable. */}
          {song && (
            <p className="pf-feeling-badge">
              🎵 {song.title}
              {song.artist ? ` · ${song.artist}` : ""}{" "}
              <span
                style={{ cursor: "pointer", color: "#b08585", marginLeft: "4px" }}
                onClick={() => setSong(null)}
              >
                ✕
              </span>
            </p>
          )}

          {/* NEW (Reel mode): original-audio volume, only once a song is
              attached — lets the song be heard over the video's own sound. */}
          {isMedia && song && (
            <div className="pf-reel-volume">
              <div className="pf-reel-volume-row">
                <span>🔊 {t("composer.originalVolume")}</span>
                <b>{Math.round(originalAudioVolume * 100)}%</b>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(originalAudioVolume * 100)}
                onChange={(e) => setOriginalAudioVolume(Number(e.target.value) / 100)}
              />
            </div>
          )}

          {/* Attached location preview — removable */}
          {locationName && (
            <p className="pf-feeling-badge">
              📍 {t("post.at")} <b>{locationName}</b>{" "}
              <span
                style={{ cursor: "pointer", color: "#b08585", marginLeft: "4px" }}
                onClick={() => setLocationName(null)}
              >
                ✕
              </span>
            </p>
          )}

          {imageFiles.length > 0 && (
            <div className="pf-img-preview-grid">
              {imageFiles.map((img, idx) => (
                <div className="pf-img-preview-wrap" key={idx}>
                  <img src={img.preview} alt={`Preview ${idx + 1}`} className="pf-img-preview" />
                  <button
                    className="pf-img-clear"
                    onClick={() => removeImage(idx)}
                    aria-label={t("post.removeImage")}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {videoFile && (
            <div className="pf-video-preview-wrap">
              <video
                src={videoFile.preview}
                controls
                className="pf-video-preview"
              />
              <button
                className="pf-img-clear"
                onClick={removeVideo}
                aria-label={t("composer.removeVideo")}
              >
                ✕
              </button>
            </div>
          )}

          {/* GIF/sticker preview — same remove-button treatment. */}
          {gifStickerAttachment && (
            <div className="pf-img-preview-wrap pf-gif-preview-wrap">
              <img
                src={gifStickerAttachment.url}
                alt={gifStickerAttachment.type === "sticker" ? "sticker" : "GIF"}
                className={`pf-img-preview${gifStickerAttachment.type === "sticker" ? " pf-gif-preview--sticker" : ""}`}
              />
              <button
                className="pf-img-clear"
                onClick={removeGifSticker}
                aria-label={t("composer.removeGif")}
              >
                ✕
              </button>
            </div>
          )}

          {showLinkInput && !isMedia && (
            <input
              type="url"
              className="pf-link-input"
              placeholder={t("composer.pasteUrl")}
              value={linkUrl}
              onChange={(e) => handleLinkInput(e.target.value)}
            />
          )}

          {fetchingPreview && !isMedia && (
            <div className="pf-link-loading">{t("composer.fetchingPreview")}</div>
          )}

          {!fetchingPreview && linkPreview && !isMedia && (
            <div className="pf-link-preview">
              {linkPreview.image && (
                <img
                  src={linkPreview.image}
                  alt=""
                  className="pf-link-image"
                  loading="lazy"
                />
              )}
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

          {reelSuccess && (
            <p className="pf-reel-success">
              ✅ {successKind === "video" ? t("composer.liveVideo") : t("composer.liveReel")}{" "}
              <a href={successKind === "video" ? "/" : "/reels"}>
                {successKind === "video" ? t("composer.viewHome") : t("composer.viewReels")}
              </a>
            </p>
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
          {/* Photos aren't available in Reel mode. */}
          <label
            className="pf-attach-btn"
            title={t("composer.titlePhoto")}
            style={
              isMedia || videoFile || gifStickerAttachment
                ? { opacity: 0.4, cursor: "not-allowed" }
                : {}
            }
          >
            📷
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleImageSelect}
              disabled={isMedia || !!videoFile || !!gifStickerAttachment}
            />
          </label>

          <label
            className="pf-attach-btn"
            title={isMedia ? t("composer.chooseVideo") : t("composer.modeVideo")}
            style={
              imageFiles.length > 0 || gifStickerAttachment
                ? { opacity: 0.4, cursor: "not-allowed" }
                : {}
            }
          >
            🎥
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={handleVideoSelect}
              disabled={imageFiles.length > 0 || !!videoFile || !!gifStickerAttachment}
            />
          </label>

          {/* Links aren't available in Reel mode. */}
          <button
            className="pf-attach-btn"
            title={t("composer.titleLink")}
            onClick={() => setShowLinkInput((v) => !v)}
            disabled={isMedia}
            style={isMedia ? { opacity: 0.4, cursor: "not-allowed" } : {}}
          >🔗</button>
          <button
            className="pf-attach-btn"
            title={t("composer.titleFeeling")}
            onClick={() => setShowFeelings((v) => !v)}
          >😊</button>

          {/* Music attach trigger */}
          <div className="map-attach-trigger-wrap">
            <button
              type="button"
              className="pf-attach-btn"
              title={t("composer.titleMusic")}
              onClick={() => setShowMusicPicker((v) => !v)}
            >
              🎵
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

          {/* Location ("check in") attach trigger */}
          <div className="map-attach-trigger-wrap">
            <button
              type="button"
              className="pf-attach-btn"
              title={t("composer.titleCheckin")}
              onClick={() => setShowLocationPicker((v) => !v)}
            >
              📍
            </button>
            {showLocationPicker && (
              <LocationPicker
                anchor="left"
                position="bottom"
                onSelect={(name) => setLocationName(name)}
                onClose={() => setShowLocationPicker(false)}
              />
            )}
          </div>

          {/* Emoji / GIF / Sticker picker. In Reel mode GIF/sticker picks
              are refused (see handleGifStickerSelect); emoji still works.
              `data-cmp-trigger` stops the picker's outside-click handler
              from closing-then-reopening it when this button is tapped. */}
          <div className="pf-attach-wrap">
            <button
              className="pf-attach-btn"
              title={t("composer.titlePicker")}
              type="button"
              data-cmp-trigger
              onClick={() => setShowEmojiPicker((v) => !v)}
              style={mediaAlreadyAttached && !gifStickerAttachment ? { opacity: 0.4 } : {}}
            >
              🙂
            </button>
            {showEmojiPicker && (
              <CommentMediaPicker
                onEmojiSelect={(emoji) => setText((prev) => prev + emoji)}
                onMediaSelect={handleGifStickerSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {imageFiles.length > 0 && (
            <span className="pf-image-count">
              {t("composer.selected", { n: imageFiles.length })}
            </span>
          )}
        </div>

        <div className="pf-composer-actions">
          {/* Reels and Videos have no privacy setting, so the selector is hidden. */}
          {!isMedia && (
            <select
              className="pf-privacy-select"
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
            >
              {PRIVACY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.icon} {t("privacy." + o.value)}
                </option>
              ))}
            </select>
          )}

          <button
            className="pf-post-btn"
            onClick={handleSubmit}
            disabled={!canPost || posting}
          >
            {postLabel}
          </button>
        </div>
      </div>

      {showRecordModal && (
        <RecordModal
          onClose={() => setShowRecordModal(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default PostComposer;