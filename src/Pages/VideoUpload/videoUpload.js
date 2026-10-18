import React, { useState, useRef, useEffect } from "react";
import "./videoUpload.css";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { supabase } from "../../config/supabase";
import RecordModal from "../RecordModal/RecordModal";
import { checkContent } from "../../Component/Moderation/useModerationFilter";
import { notifyConnections } from "../../utils/notifications";
import { uploadToR2, buildTransformUrl, uploadVideoToR2 } from "../../utils/mediaUpload";
import MusicPicker from "../../Component/Shared/MusicPicker";
import LocationPicker from "../../Component/Shared/LocationPicker";
import SongAttachmentCard from "../../Component/Shared/SongAttachmentCard";

const INITIAL_FIELDS = {
  title: "",
  description: "",
  videoLink: "",
  thumbnail: "",
  videoType: "",
};

// NEW: same feeling list Posts use (PostComposer.jsx), reused here so
// Videos/Reels can attach a "— feeling X" badge the same way a Post can.
const FEELINGS = [
  "Happy 😊", "Excited 🤩", "Grateful 🙏", "Blessed ✨",
  "Motivated 💪", "Tired 😴", "Loved ❤️", "Proud 🎉",
];

// NEW: resolves true only if the URL actually loads as an image. Used to
// verify a transformed thumbnail URL before it is saved to the database,
// so a dead transform URL never ends up as thumbnail_url.
const imageLoads = (url, timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (!url) { resolve(false); return; }
    const img = new Image();
    const t = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });

// ─────────────────────────────────────────────────────────────────────────
// AUTOMATIC THUMBNAIL — rewritten so a thumbnail is ALWAYS produced.
//
// Previously captureThumbnail() tried a single moment in the video, could
// return a solid-black frame (frame not decoded yet) or time out on some
// files, and handleSubmit() then refused to save until the user picked an
// image by hand.
//
// Now there are three layers, tried in order:
//   1. captureBestThumbnail(): grabs frames at several points in the video
//      (10% / 25% / 50% / 75%), checks each one for "black or blank"
//      (brightness + contrast), and keeps the best. It stops early as soon
//      as it finds a good frame.
//   2. generatePlaceholderThumbnail(): if nothing usable could be captured
//      (unsupported codec, a genuinely black video, a stalled file), a
//      branded cover image with the title is drawn on a canvas instead.
//   3. handleSubmit() re-runs steps 1-2 if, for any reason, no thumbnail
//      exists yet — so saving is never blocked on a missing thumbnail.
// ─────────────────────────────────────────────────────────────────────────

const THUMB_MAX_SIDE = 640; // longest side of the captured image, in px

const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.85) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

// Average brightness + contrast of the video's current frame, measured on a
// tiny 32x18 sample. A black / undecoded frame has both near zero.
const frameStats = (video) => {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 18;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, 32, 18);
  const { data } = ctx.getImageData(0, 0, 32, 18);
  let sum = 0;
  let sumSq = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += luma;
    sumSq += luma * luma;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return { mean, std };
};

// Resolves once the browser has actually presented a frame (or after a short
// safety timeout), so drawImage() never reads a stale/black buffer.
const waitForFrame = (video, timeoutMs = 700) =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) { done = true; resolve(); }
    };
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(finish);
    else requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, timeoutMs);
  });

const seekVideo = (video, time, timeoutMs = 4000) =>
  new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) { resolve(); return; }
    let done = false;
    let timer;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    timer = setTimeout(finish, timeoutMs);
    video.addEventListener("seeked", finish);
    try {
      video.currentTime = time;
    } catch (_) {
      finish();
    }
  });

// Briefly plays then pauses, which forces the browser to really decode and
// present the frame at the current position (a plain seek on an off-screen
// video often leaves a black buffer).
const decodeCurrentFrame = async (video) => {
  try {
    await Promise.race([
      video.play(),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch (_) { /* autoplay refused - grab whatever is there */ }
  await waitForFrame(video);
  try { video.pause(); } catch (_) {}
};

// Resolves { blob, portrait } for the best frame found, or null if nothing
// usable could be captured. Never rejects.
const captureBestThumbnail = (file) =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-hidden", "true");
    // Attached to the DOM (off-screen, not display:none) - detached or
    // hidden videos often skip decoding and give black frames.
    Object.assign(video.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "160px",
      height: "90px",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(video);

    const url = URL.createObjectURL(file);
    let best = null;
    let finished = false;
    let hardTimer;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimer);
      try { video.pause(); } catch (_) {}
      video.removeAttribute("src");
      try { video.load(); } catch (_) {}
      URL.revokeObjectURL(url);
      if (video.parentNode) video.parentNode.removeChild(video);
      // A frame scoring this low is effectively black/blank - treat it as a
      // failed capture so the generated cover is used instead.
      resolve(best && best.score > 6 ? { blob: best.blob, portrait: best.portrait } : null);
    };

    hardTimer = setTimeout(finish, 25000);

    (async () => {
      try {
        // Wait for the first decodable frame.
        await new Promise((res) => {
          const t = setTimeout(res, 10000);
          const done = () => { clearTimeout(t); res(); };
          video.addEventListener("loadeddata", done, { once: true });
          video.addEventListener("error", done, { once: true });
          video.src = url;
          video.load();
        });

        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
          finish();
          return;
        }

        const dur = video.duration;
        const times =
          isFinite(dur) && dur > 0
            ? [dur * 0.1, dur * 0.25, dur * 0.5, dur * 0.75]
                .map((t) => Math.min(Math.max(t, 0.1), Math.max(dur - 0.1, 0.1)))
                .filter((t, i, arr) => arr.indexOf(t) === i)
            : [0.1, 1];

        for (const t of times) {
          if (finished) return;
          await seekVideo(video, t);
          await decodeCurrentFrame(video);

          const w = video.videoWidth;
          const h = video.videoHeight;
          if (!w || !h) continue;

          const { mean, std } = frameStats(video);
          const score = mean + std;

          if (!best || score > best.score) {
            const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(w, h));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await canvasToBlob(canvas);
            if (blob) best = { blob, score, portrait: h > w };
          }

          // Good enough (not dark, not flat) - stop looking.
          if (mean > 25 && std > 10) break;
        }
      } catch (err) {
        console.warn("Thumbnail capture error:", err && err.message);
      }
      finish();
    })();
  });

// Last-resort cover image drawn on a canvas, so there is ALWAYS a thumbnail.
const generatePlaceholderThumbnail = async (title, portrait) => {
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

  // Play button
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

  // Title (one line, trimmed)
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

  // Brand mark
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(W * 0.04)}px sans-serif`;
  ctx.fillText("ZIXPLON", cx, H * 0.92);

  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error("Couldn't generate a cover image.");
  return { blob, portrait };
};

const resolveFeature = (state) => {
  if (!state) return { mode: null, data: null };
  if (state.remixData)       return { mode: "remix",       data: state.remixData };
  if (state.soundData)       return { mode: "sound",       data: state.soundData };
  if (state.collabData)      return { mode: "collab",      data: state.collabData };
  if (state.greenScreenData) return { mode: "greenscreen", data: state.greenScreenData };
  if (state.cutData)         return { mode: "cut",         data: state.cutData };
  return { mode: null, data: null };
};

const featureDefaults = (mode, data) => {
  switch (mode) {
    case "remix":       return { title: `Remix of "${data.remixed_from_title}"`,        description: `🎬 Remixed from @${data.remixed_from_username}` };
    case "sound":       return { title: `Using sound from "${data.sound_from_title}"`,  description: `🎵 Sound by @${data.sound_from_username}` };
    case "collab":      return { title: `Collab with @${data.collab_with_username}`,    description: `🤝 Collab response to "${data.collab_with_title}"` };
    case "greenscreen": return { title: `Green Screen — "${data.bg_reel_title}"`,       description: `💚 Using background from @${data.bg_reel_username}` };
    case "cut":         return { title: `Cut from "${data.cut_from_title}"`,            description: `✂️ Cut by @${data.cut_from_username}` };
    default:            return { title: "", description: "" };
  }
};

const featureBanner = (mode, data) => {
  switch (mode) {
    case "remix":       return { emoji: "🎬", label: "Remixing",        title: `"${data.remixed_from_title}"`, by: `@${data.remixed_from_username}`, thumb: data.remixed_from_thumbnail, color: "#a855f7", hint: "Upload your own video response. Your remix will credit the original creator." };
    case "sound":       return { emoji: "🎵", label: "Using Sound From", title: `"${data.sound_from_title}"`,  by: `@${data.sound_from_username}`,    thumb: data.sound_from_thumbnail,    color: "#f97316", hint: "Upload your video. The original sound will be credited automatically." };
    case "collab":      return { emoji: "🤝", label: "Collabing With",   title: `"${data.collab_with_title}"`, by: `@${data.collab_with_username}`,   thumb: data.collab_with_thumbnail,   color: "#06b6d4", hint: "Upload your side of the collab. Both creators will be credited." };
    case "greenscreen": return { emoji: "💚", label: "Green Screen BG",  title: `"${data.bg_reel_title}"`,     by: `@${data.bg_reel_username}`,       thumb: data.bg_reel_thumbnail,       color: "#22c55e", hint: "Upload your video recorded against the green screen background." };
    case "cut":         return { emoji: "✂️", label: "Cutting From",     title: `"${data.cut_from_title}"`,    by: `@${data.cut_from_username}`,      thumb: data.cut_from_thumbnail,      color: "#f43f5e", hint: "Upload your edited cut. Original creator will be credited." };
    default:            return null;
  }
};

const VideoUpload = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { mode: featureMode, data: featureData } = resolveFeature(location.state);
  const isFeatureMode = !!featureMode;
  const banner        = featureBanner(featureMode, featureData);
  const defaults      = featureDefaults(featureMode, featureData);
  const remixData     = featureMode === "remix" ? featureData : null;

  useEffect(() => {
    const user = localStorage.getItem("username");
    if (!user) navigate("/signup");
  }, []);

  const [uploadMode,      setUploadMode]      = useState(isFeatureMode ? "reel" : "video");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const currentUser = localStorage.getItem("username") || "";

  const [inputField, setInputField] = useState({
    ...INITIAL_FIELDS,
    title:       defaults.title,
    description: defaults.description,
  });

  const [loader,          setLoader]          = useState(false);
  const [thumbLoader,     setThumbLoader]     = useState(false);
  const [videoUploaded,   setVideoUploaded]   = useState(false);
  const [imageUploaded,   setImageUploaded]   = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [error,           setError]           = useState("");
  const [saving,          setSaving]          = useState(false);
  // "auto" (captured from the video) | "generated" (cover drawn by us)
  // | "manual" (picked by the user) | ""
  const [thumbSource,     setThumbSource]     = useState("");
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadSpeed,     setUploadSpeed]     = useState(0);
  const [timeRemaining,   setTimeRemaining]   = useState("");
  // ── Local, client-side preview of the picked video file. This is
  // independent of server-side thumbnail capture/upload, so the user
  // always gets a visual "your video is in" confirmation the moment
  // it finishes uploading — even if auto thumbnail capture fails. ──
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  // NEW: song ({ title, artist, cover, url }) and location-name
  // attachments — Facebook/Instagram-style "attach music" / "check in",
  // shared across both Video and Reel upload modes (and any of the
  // feature modes, since they all flow through this same form).
  const [song, setSong] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // NEW: "feeling" attachment — same idea, same FEELINGS list used by
  // Posts, so a video/reel can say "— feeling Happy 😊" the same way a
  // Post can.
  const [feeling, setFeeling] = useState("");
  const [showFeelings, setShowFeelings] = useState(false);

  // NEW: creator-side audio mix — how loud the video's OWN audio
  // should play relative to the attached song. Only meaningful once a
  // song is attached; defaults to 1 (full volume, i.e. unchanged from
  // today's behavior) so uploads without a song are unaffected. Stored
  // per video/reel and applied on playback in Video.jsx / Reels.jsx.
  const [originalAudioVolume, setOriginalAudioVolume] = useState(1);

  const uploadStartTime  = useRef(null);
  const uploadedBytesRef = useRef(0);
  const durationRef      = useRef("00:00");
  const wakeLockRef      = useRef(null);
  const localPreviewRef  = useRef(""); // mirrors localPreviewUrl for safe cleanup
  // NEW: the picked video file (kept so handleSubmit can still produce a
  // thumbnail if the one made during upload is somehow missing) and its
  // orientation (used to size reel thumbnails portrait instead of 16:9).
  const fileRef          = useRef(null);
  const portraitRef      = useRef(null);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch (err) { console.warn("Wake Lock not available:", err.message); }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && loader && wakeLockRef.current === null)
        await requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loader]);

  // Revoke any local blob preview URL on unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  const clearLocalPreview = () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = "";
    setLocalPreviewUrl("");
  };

  const resetState = () => {
    setInputField({ ...INITIAL_FIELDS });
    setVideoUploaded(false);
    setImageUploaded(false);
    setThumbSource("");
    setError("");
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining("");
    setSong(null);
    setLocationName(null);
    setShowMusicPicker(false);
    setShowLocationPicker(false);
    setFeeling("");
    setShowFeelings(false);
    setOriginalAudioVolume(1);
    uploadStartTime.current  = null;
    uploadedBytesRef.current = 0;
    durationRef.current      = "00:00";
    fileRef.current          = null;
    portraitRef.current      = null;
    clearLocalPreview();
  };

  const switchMode = (mode) => { setUploadMode(mode); resetState(); };

  const updateSpeedAndETA = (loadedBytes, totalBytes) => {
    if (!uploadStartTime.current) return;
    const elapsed    = (Date.now() - uploadStartTime.current) / 1000;
    if (elapsed < 1) return;
    const speedBps   = loadedBytes / elapsed;
    const speedMBps  = speedBps / (1024 * 1024);
    const remaining  = totalBytes - loadedBytes;
    const remainSecs = remaining / speedBps;
    setUploadSpeed(speedMBps.toFixed(1));
    if (remainSecs > 3600)    setTimeRemaining(`~${Math.ceil(remainSecs / 3600)}h remaining`);
    else if (remainSecs > 60) setTimeRemaining(`~${Math.ceil(remainSecs / 60)} min remaining`);
    else                       setTimeRemaining(`~${Math.ceil(remainSecs)} sec remaining`);
  };

  // CHANGED: also records the video's orientation, and always resolves
  // (error / stalled metadata) so the upload can never hang waiting on it.
  const getVideoDuration = (file) => new Promise((resolve) => {
    const videoEl = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    videoEl.preload = "metadata";

    const timer = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      resolve(durationRef.current);
    }, 10000);

    videoEl.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      portraitRef.current = videoEl.videoHeight > videoEl.videoWidth;
      const totalSec = Math.floor(videoEl.duration) || 0;
      const hrs  = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      durationRef.current = hrs > 0
        ? `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`
        : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
      resolve(durationRef.current);
    };
    videoEl.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(durationRef.current);
    };
    videoEl.src = objectUrl;
  });

  // ── Thumbnail upload — goes through R2 (small file, fine for /api/upload) ──
  //
  // CHANGED: the transformed URL is verified to actually load as an image
  // before it is returned; if it doesn't, the raw uploaded JPEG is used
  // instead of saving a dead URL. NEW: reels get a portrait (360x640)
  // thumbnail instead of being cropped to 16:9.
  const uploadThumbnail = async (blob, portrait = false) => {
    const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
    const { url } = await uploadToR2(file);
    // format: "jpeg" is required here (not the default "webp") because this
    // thumbnail becomes the og:image for shared video/reel links, and
    // WhatsApp's link-preview crawler does not render webp images.
    const transformedUrl = buildTransformUrl(url, {
      width:  portrait ? 360 : 640,
      height: portrait ? 640 : 360,
      fit: "cover",
      format: "jpeg",
    });
    if (await imageLoads(transformedUrl)) return transformedUrl;
    console.warn("Transformed thumbnail didn't load; using the raw uploaded JPEG instead.");
    return url;
  };

  // NEW: turns a captured frame (or null) into an uploaded thumbnail URL,
  // falling back to a generated cover image. Never throws; returns
  // { url: "", source: "" } only if even the fallback upload failed.
  const buildAndUploadThumbnail = async (captured, titleForCover) => {
    const portrait =
      uploadMode === "reel" && !!(captured?.portrait ?? portraitRef.current);

    if (captured?.blob) {
      try {
        return { url: await uploadThumbnail(captured.blob, portrait), source: "auto" };
      } catch (err) {
        console.warn("Captured thumbnail upload failed:", err && err.message);
      }
    }

    try {
      const generated = await generatePlaceholderThumbnail(titleForCover, portrait);
      return { url: await uploadThumbnail(generated.blob, portrait), source: "generated" };
    } catch (err) {
      console.warn("Generated thumbnail failed:", err && err.message);
    }

    return { url: "", source: "" };
  };

  const handleOnChangeInput = (event, name) => {
    setInputField((prev) => ({ ...prev, [name]: event.target.value }));
    setError("");
  };

  const uploadVideo = async (e) => {
    setLoader(true); setError(""); setUploadProgress(0); setUploadSpeed(0); setTimeRemaining("");
    uploadStartTime.current  = Date.now();
    uploadedBytesRef.current = 0;
    await requestWakeLock();
    const files = e.target.files;
    if (!files || files.length === 0) { setLoader(false); return; }
    const file = files[0];
    if (file.size > 4 * 1024 * 1024 * 1024) { setError("File too large. Maximum size is 4GB."); setLoader(false); return; }

    fileRef.current = file;
    portraitRef.current = null;

    // Show a confirmation preview immediately from the local file — this
    // does not depend on thumbnail capture or any network call, so it
    // always shows up the moment the upload finishes.
    clearLocalPreview();
    const localUrl = URL.createObjectURL(file);
    localPreviewRef.current = localUrl;
    setLocalPreviewUrl(localUrl);

    try {
      // Duration + thumbnail capture run IN PARALLEL WITH the upload, so
      // neither delays it.
      const durationPromise = getVideoDuration(file);
      const thumbPromise = captureBestThumbnail(file);

      const { url: videoUrl } = await uploadVideoToR2(file, (pct) => {
        setUploadProgress(pct);
        updateSpeedAndETA((pct / 100) * file.size, file.size);
      });

      // Video is uploaded - now finish the thumbnail (usually already done).
      setThumbLoader(true);
      await durationPromise;

      // CHANGED: only keep an existing thumbnail if it was picked by hand;
      // an earlier AUTO thumbnail belongs to the previous video and must
      // not be reused for this one.
      let thumbnailUrl = imageUploaded ? inputField.thumbnail : "";
      if (!imageUploaded) {
        const captured = await thumbPromise;
        const result = await buildAndUploadThumbnail(captured, inputField.title);
        thumbnailUrl = result.url;
        setThumbSource(result.source);
      }

      setInputField((prev) => ({ ...prev, videoLink: videoUrl, thumbnail: thumbnailUrl }));
      setVideoUploaded(true); setUploadProgress(100); setLoader(false); setThumbLoader(false); releaseWakeLock();
    } catch (err) {
      setLoader(false); setThumbLoader(false); setUploadProgress(0); setTimeRemaining("");
      setError(err.message || "Upload failed. Please try again.");
      console.error("Upload error:", err); releaseWakeLock();
    }
  };

  // ── Manual thumbnail upload — goes to R2 ──
  const uploadManualThumbnail = async (e) => {
    setThumbLoader(true); setError("");
    const files = e.target.files;
    if (!files || files.length === 0) { setThumbLoader(false); return; }
    try {
      const { url } = await uploadToR2(files[0]);
      const portrait = uploadMode === "reel" && !!portraitRef.current;
      // format: "jpeg" — same reasoning as uploadThumbnail() above, this
      // also ends up as the shared-link og:image.
      const transformedUrl = buildTransformUrl(url, {
        width:  portrait ? 360 : 640,
        height: portrait ? 640 : 360,
        fit: "cover",
        format: "jpeg",
      });
      // Only use the transformed URL if it actually loads; otherwise keep
      // the raw uploaded image.
      const finalUrl = (await imageLoads(transformedUrl)) ? transformedUrl : url;
      setInputField((prev) => ({ ...prev, thumbnail: finalUrl }));
      setImageUploaded(true); setThumbSource("manual"); setThumbLoader(false);
    } catch (err) {
      setThumbLoader(false);
      setError("Thumbnail upload failed. Please try again.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Connection notifications on upload now go through the SHARED helper
  // (src/utils/notifications.js) instead of a locally duplicated copy —
  // see notifyConnections(...) calls inside handleSubmit below. This keeps
  // the UUID-vs-username connection resolution logic in exactly one place
  // so future fixes (RLS issues, resolution edge cases, etc.) don't have
  // to be made twice and can't silently drift apart between call sites.
  // ─────────────────────────────────────────────────────────────────────────

  const notifyRemixedCreator = async (title, contentId) => {
    if (!remixData) return;
    const remixerUsername = localStorage.getItem("username");
    await supabase.from("notifications").insert({
      recipient_username: remixData.remixed_from_username,
      sender_username:    remixerUsername,
      type:               "upload",
      message:            `@${remixerUsername} remixed your reel "${remixData.remixed_from_title}" with "${title}" 🎬`,
      is_read:            false,
      content_id:         contentId,
      content_type:       "reel",
    });
  };

  const notifyFeatureCreator = async (title, contentId) => {
    const senderUsername = localStorage.getItem("username");
    const notifMap = {
      sound:       { to: featureData?.sound_from_username,  msg: `@${senderUsername} used your sound in "${title}" 🎵` },
      collab:      { to: featureData?.collab_with_username, msg: `@${senderUsername} posted a collab response to "${featureData?.collab_with_title}": "${title}" 🤝` },
      greenscreen: { to: featureData?.bg_reel_username,     msg: `@${senderUsername} used your reel as a green screen background in "${title}" 💚` },
      cut:         { to: featureData?.cut_from_username,    msg: `@${senderUsername} cut your reel into "${title}" ✂️` },
    };
    const notif = notifMap[featureMode];
    if (!notif || !notif.to || notif.to === senderUsername) return;
    await supabase.from("notifications").insert({
      recipient_username: notif.to,
      sender_username:    senderUsername,
      type:               "upload",
      message:            notif.msg,
      is_read:            false,
      content_id:         contentId,
      content_type:       "reel",
    });
  };

  // ── handleSubmit — with moderation check INSIDE the function ──────────────
  const handleSubmit = async () => {
    if (!inputField.title)       return setError("Please enter a title.");
    if (!inputField.description) return setError("Please enter a description.");
    if (!inputField.videoLink)   return setError("Please upload a video first.");
    if (uploadMode === "video" && !isFeatureMode && !inputField.videoType)
      return setError("Please enter a category.");

    setSaving(true);
    setError("");

    // CHANGED: a missing thumbnail no longer blocks saving. If none exists
    // yet (e.g. the upload-time one failed to upload), capture one from the
    // picked file now, and fall back to a generated cover - so every saved
    // video/reel has a thumbnail_url.
    let thumbnailUrl = inputField.thumbnail;
    if (!thumbnailUrl) {
      const captured = fileRef.current
        ? await captureBestThumbnail(fileRef.current)
        : null;
      const result = await buildAndUploadThumbnail(captured, inputField.title);
      thumbnailUrl = result.url;
      if (thumbnailUrl) {
        setInputField((prev) => ({ ...prev, thumbnail: thumbnailUrl }));
        setThumbSource(result.source);
      }
    }
    if (!thumbnailUrl) {
      setSaving(false);
      return setError("Couldn't create a thumbnail automatically. Please check your connection or choose a thumbnail image.");
    }

    try {
      const { isClean, violatingWord } = await checkContent(
        inputField.title,
        inputField.description,
        inputField.videoType || ""
      );
      if (!isClean) {
        setSaving(false);
        setError(`❌ Content violates community guidelines (contains "${violatingWord}"). Please review our Community Guidelines before uploading.`);
        return;
      }
    } catch (moderationErr) {
      console.warn("Moderation check failed, proceeding:", moderationErr);
    }

    try {
      const uploaderUsername = localStorage.getItem("username") || "anonymous";

      if (uploadMode === "video" && !isFeatureMode) {
        const videoPayload = {
          title:         inputField.title,
          description:   inputField.description,
          video_url:     inputField.videoLink,
          thumbnail_url: thumbnailUrl,
          category:      inputField.videoType,
          channel:       localStorage.getItem("username") || "Anonymous",
          username:      uploaderUsername,
          duration:      durationRef.current,
          // NEW — requires:
          //   alter table videos add column song jsonb;
          //   alter table videos add column location_name text;
          //   alter table videos add column feeling text;
          //   alter table videos add column original_audio_volume numeric default 1;
          song:          song || null,
          location_name: locationName || null,
          feeling:       feeling || null,
          // Only meaningful with a song attached — otherwise stored as
          // the neutral default (full volume, unchanged playback).
          original_audio_volume: song ? originalAudioVolume : 1,
        };

        const { data: newVideo, error: videoError } = await supabase
          .from("videos")
          .insert([videoPayload])
          .select()
          .single();
        if (videoError) throw new Error(videoError.message);

        await notifyConnections(uploaderUsername, {
          type: "video",
          message: `${uploaderUsername} uploaded a new video: "${inputField.title}"`,
          contentId: newVideo.id,
          contentType: "video",
        });
      } else {
        const reelPayload = {
          title:       inputField.title,
          description: inputField.description,
          video_url:   inputField.videoLink,
          thumbnail:   thumbnailUrl,
          uploaded_by: localStorage.getItem("username") || "Anonymous",
          username:    uploaderUsername.toLowerCase().replace(/\s+/g, ""),
          duration:    durationRef.current,
          likes:       0,
          comments:    0,
          // NEW — requires:
          //   alter table reels add column song jsonb;
          //   alter table reels add column location_name text;
          //   alter table reels add column feeling text;
          //   alter table reels add column original_audio_volume numeric default 1;
          song:          song || null,
          location_name: locationName || null,
          feeling:       feeling || null,
          original_audio_volume: song ? originalAudioVolume : 1,
        };

        if (featureMode === "remix" && featureData) {
          reelPayload.remixed_from_id       = featureData.remixed_from_id;
          reelPayload.remixed_from_username = featureData.remixed_from_username;
        }

        const { data: newReel, error: reelError } = await supabase
          .from("reels")
          .insert([reelPayload])
          .select()
          .single();
        if (reelError) throw new Error(reelError.message);

        if (featureMode === "remix") await notifyRemixedCreator(inputField.title, newReel.id);
        else if (featureMode)        await notifyFeatureCreator(inputField.title, newReel.id);

        await notifyConnections(uploaderUsername, {
          type: "reel",
          message: `${uploaderUsername} uploaded a new reel: "${inputField.title}"`,
          contentId: newReel.id,
          contentType: "reel",
        });
      }

      setSaving(false);
      setSubmitted(true);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Failed to save. Please try again.");
      console.error("Save error:", err);
    }
  };

  const uploadLabel = isFeatureMode
    ? (banner?.emoji + " " + banner?.label)
    : uploadMode === "reel" ? "Upload Reel" : "Upload Video";

  const submitLabel = saving
    ? "Saving..."
    : loader
      ? `Uploading... ${uploadProgress}%`
      : thumbLoader
        ? "Creating thumbnail..."
        : isFeatureMode
          ? `Post ${banner?.emoji}`
          : `Upload ${uploadMode === "reel" ? "Reel" : "Video"}`;

  // The server-generated thumbnail is a real IMAGE and can go through
  // an <img> tag. localPreviewUrl is a blob URL of the VIDEO FILE itself
  // (not an image) — it must be rendered with a <video> element, never
  // <img>, or the browser shows a broken-image icon.
  const hasServerThumb = !!inputField.thumbnail;

  if (submitted) return (
    <div className="videoUpload">
      <div className="uploadBox">
        <div className="upload_success_screen">
          <CheckCircleOutlineIcon sx={{ fontSize: "64px", color: "#4caf50" }} />
          <h2>{isFeatureMode ? banner?.label : uploadMode === "reel" ? "Reel" : "Video"} Uploaded Successfully!</h2>
          <p>Your {isFeatureMode ? featureMode : uploadMode === "reel" ? "reel" : "video"} is now live on ZIXPLON&reg;</p>
          {isFeatureMode && (
            <p style={{ fontSize: "13px", color: "#7c3aed", fontWeight: 700 }}>
              {banner?.emoji} {banner?.label} {banner?.by}
            </p>
          )}
          <video src={inputField.videoLink} poster={inputField.thumbnail || undefined} controls className="upload_success_preview" />
          <h3>{inputField.title}</h3>
          <p className="upload_success_meta">
            {uploadMode === "video" && !isFeatureMode ? `${inputField.videoType} • ` : ""}
            {inputField.description}
          </p>
          {(song || locationName || feeling) && (
            <p className="upload_success_meta" style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              {feeling && <span>— feeling {feeling}</span>}
              {song && (
                <span>
                  🎵 {song.title} · {song.artist}
                  {originalAudioVolume < 1 && ` (original audio at ${Math.round(originalAudioVolume * 100)}%)`}
                </span>
              )}
              {locationName && <span>📍 {locationName}</span>}
            </p>
          )}
          <div className="uploadBtns">
            <div className="uploadBtns-form" onClick={() => { setSubmitted(false); resetState(); }}>Upload Another</div>
            <div className="uploadBtns-form" onClick={() => navigate(isFeatureMode || uploadMode === "reel" ? "/reels" : "/")}>
              {isFeatureMode || uploadMode === "reel" ? "Go to Reels" : "Go Home"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="videoUpload">
      <div className="uploadBox">

        <div className="uploadVideoTitle">
          <CloudUploadIcon sx={{ fontSize: "54px", color: "orange" }} />
          {isFeatureMode ? `${banner?.emoji} ${banner?.label}` : "Upload"}
        </div>

        {isFeatureMode && banner && (
          <div className="upload_feature_banner" style={{ "--feature-color": banner.color }}>
            <img src={banner.thumb} alt="source" className="upload_feature_thumb" />
            <div className="upload_feature_banner_text">
              <span className="upload_feature_label" style={{ color: banner.color }}>
                {banner.emoji} {banner.label}
              </span>
              <span className="upload_feature_title">{banner.title}</span>
              <span className="upload_feature_by">by {banner.by}</span>
            </div>
          </div>
        )}

        {!isFeatureMode && (
          <div className="upload_mode_toggle">
            <div className={`upload_mode_btn ${uploadMode === "video" ? "active" : ""}`} onClick={() => switchMode("video")}>🎬 Video</div>
            <div className={`upload_mode_btn ${uploadMode === "reel"  ? "active" : ""}`} onClick={() => switchMode("reel")}>📱 Shorts</div>
            <div className="upload_mode_btn" onClick={() => setShowRecordModal(true)} style={{ position:"relative", cursor:"pointer" }}>
              <span style={{ position:"absolute", top:"-4px", right:"-4px", width:"8px", height:"8px", borderRadius:"50%", background:"#ff0000", animation:"recordPulse 1.2s infinite" }} />
              🔴 Record / Live
            </div>
          </div>
        )}

        {showRecordModal && <RecordModal onClose={() => setShowRecordModal(false)} currentUser={currentUser} />}

        <style>{`
          @keyframes recordPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(1.3); }
          }
        `}</style>

        {isFeatureMode && banner?.hint && <p className="upload_mode_hint">{banner.hint}</p>}
        {!isFeatureMode && uploadMode === "reel" && (
          <p className="upload_mode_hint">Reels are short vertical videos — they appear in the Reels / Shorts section.</p>
        )}

        <div className="uploadForm">
          <input
            type="text"
            value={inputField.title}
            onChange={(e) => handleOnChangeInput(e, "title")}
            placeholder={isFeatureMode ? `${banner?.emoji} Title` : uploadMode === "reel" ? "Reel Title" : "Title of Video"}
            className="uploadFormInputs"
          />
          <input
            type="text"
            value={inputField.description}
            onChange={(e) => handleOnChangeInput(e, "description")}
            placeholder="Description"
            className="uploadFormInputs"
          />
          {uploadMode === "video" && !isFeatureMode && (
            <input
              type="text"
              value={inputField.videoType}
              onChange={(e) => handleOnChangeInput(e, "videoType")}
              placeholder="Category (e.g. Music, Gaming, News)"
              className="uploadFormInputs"
            />
          )}

          {/* NEW: Music + Location + Feeling attachments — shown for
              both Video and Reel modes (and feature modes, since they
              share this form). */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
            {song && (
              <SongAttachmentCard song={song} onRemove={() => setSong(null)} />
            )}

            {/* NEW: creator-side audio mix — only shown once a song is
                attached, since it's meaningless otherwise. Turning this
                down lowers the ORIGINAL video's volume relative to the
                song, so the attached song can actually be heard over
                whatever audio was already in the clip. */}
            {song && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  background: "var(--zx-surface2)",
                  border: "2px solid var(--zx-border)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "'Nunito', sans-serif",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "var(--zx-text2)",
                    }}
                  >
                    🔊 Original video volume
                  </span>
                  <span
                    style={{
                      fontFamily: "'Nunito', sans-serif",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "var(--zx-primary)",
                    }}
                  >
                    {Math.round(originalAudioVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(originalAudioVolume * 100)}
                  onChange={(e) => setOriginalAudioVolume(Number(e.target.value) / 100)}
                  style={{ width: "100%", accentColor: "var(--zx-primary)" }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--zx-text3)",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Turn this down so your song comes through clearly over the video's own sound.
                </span>
              </div>
            )}

            {locationName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "var(--zx-primary)",
                }}
              >
                📍 at {locationName}
                <span
                  style={{ cursor: "pointer", color: "var(--zx-text3)" }}
                  onClick={() => setLocationName(null)}
                >
                  ✕
                </span>
              </div>
            )}
            {feeling && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "var(--zx-primary)",
                }}
              >
                — feeling {feeling}
                <span
                  style={{ cursor: "pointer", color: "var(--zx-text3)" }}
                  onClick={() => setFeeling("")}
                >
                  ✕
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div className="map-attach-trigger-wrap">
                <span
                  className="upload_file_btn"
                  onClick={() => setShowMusicPicker((v) => !v)}
                >
                  🎵 {song ? "Change Song" : "Add Music"}
                </span>
                {showMusicPicker && (
                  <MusicPicker
                    anchor="left"
                    position="bottom"
                    onSelect={(s) => setSong(s)}
                    onClose={() => setShowMusicPicker(false)}
                  />
                )}
              </div>

              <div className="map-attach-trigger-wrap">
                <span
                  className="upload_file_btn"
                  onClick={() => setShowLocationPicker((v) => !v)}
                >
                  📍 {locationName ? "Change Location" : "Add Location"}
                </span>
                {showLocationPicker && (
                  <LocationPicker
                    anchor="left"
                    position="bottom"
                    onSelect={(name) => setLocationName(name)}
                    onClose={() => setShowLocationPicker(false)}
                  />
                )}
              </div>

              {/* NEW: Feeling picker trigger */}
              <div className="map-attach-trigger-wrap">
                <span
                  className="upload_file_btn"
                  onClick={() => setShowFeelings((v) => !v)}
                >
                  😊 {feeling ? "Change Feeling" : "Add Feeling"}
                </span>
                {showFeelings && (
                  <div
                    className="map-picker map-picker--left map-picker-bottom"
                    style={{ padding: "10px" }}
                  >
                    <div className="pf-feelings-grid" style={{ margin: 0 }}>
                      {FEELINGS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`pf-feeling-btn ${feeling === f ? "active" : ""}`}
                          onClick={() => {
                            setFeeling(feeling === f ? "" : f);
                            setShowFeelings(false);
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="upload_file_row">
            <span className="upload_file_label">
              {isFeatureMode ? `${banner?.emoji} Your Video` : uploadMode === "reel" ? "Reel Video" : "Video"}
            </span>
            <input type="file" accept="video/mp4,video/webm,video/*" onChange={uploadVideo} style={{ display:"none" }} id="videoInput" />
            <span className="upload_file_btn" onClick={() => document.getElementById("videoInput").click()}>
              {videoUploaded ? "✅ Change Video" : "🎬 Choose Video"}
            </span>
          </div>

          <div className="upload_file_row">
            <span className="upload_file_label">
              Thumbnail
              <span style={{ color:"#888", fontSize:"0.75rem", marginLeft:"6px" }}>(created automatically — optional)</span>
            </span>
            <input type="file" accept="image/*" onChange={uploadManualThumbnail} style={{ display:"none" }} id="thumbnailInput" />
            <span className="upload_file_btn" onClick={() => document.getElementById("thumbnailInput").click()}>
              {imageUploaded ? "✅ Change Thumbnail" : "📷 Choose Image"}
            </span>
            {thumbLoader && <CircularProgress size={20} sx={{ color:"orange", ml:1 }} />}
          </div>

          {(hasServerThumb || localPreviewUrl) && (
            <div className="upload_thumb_row">
              {hasServerThumb ? (
                <img src={inputField.thumbnail} alt="Thumbnail preview" className="upload_thumb_preview" />
              ) : (
                <video
                  src={localPreviewUrl}
                  className="upload_thumb_preview"
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
              <span style={{ color:"#888", fontSize:"0.78rem", marginTop:"4px" }}>
                {thumbSource === "manual"
                  ? "✏️ Custom thumbnail"
                  : thumbSource === "generated"
                    ? "🖼️ Auto-generated cover (a frame couldn't be captured)"
                    : hasServerThumb
                      ? "🎞️ Auto-captured from video"
                      : thumbLoader
                        ? "⏳ Creating thumbnail…"
                        : "📼 Preview (thumbnail will be created when you post)"}
              </span>
            </div>
          )}

          {loader && (
            <Box sx={{ display:"flex", flexDirection:"column", gap:"8px", width:"100%" }}>
              <Box sx={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <CircularProgress size={28} sx={{ color:"orange" }} />
                <span style={{ color:"#aaa", fontSize:"0.9rem" }}>☁️ Uploading to ZIXPLON...</span>
              </Box>
              <div style={{ width:"100%", background:"#333", borderRadius:"8px", height:"8px" }}>
                <div style={{ width:`${uploadProgress}%`, background:"orange", height:"100%", borderRadius:"8px", transition:"width 0.3s" }} />
              </div>
              <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ color:"#666", fontSize:"0.8rem" }}>
                  {uploadProgress}% complete{uploadSpeed > 0 ? ` • ${uploadSpeed} MB/s` : ""}
                </span>
                {timeRemaining && <span style={{ color:"orange", fontSize:"0.8rem", fontWeight:500 }}>⏱ {timeRemaining}</span>}
              </Box>
            </Box>
          )}

          {error && <p className="upload_error_msg">{error}</p>}
        </div>

        <div className="uploadBtns">
          <div
            className={`uploadBtns-form ${loader || saving || thumbLoader ? "uploadBtns-disabled" : ""}`}
            onClick={!loader && !saving && !thumbLoader ? handleSubmit : undefined}
          >
            {submitLabel}
          </div>
          {isFeatureMode ? (
            <div className="uploadBtns-form" onClick={() => navigate(-1)}>Cancel</div>
          ) : (
            <Link to={"/"} className="uploadBtns-form">Home</Link>
          )}
        </div>

      </div>
    </div>
  );
};

export default VideoUpload;