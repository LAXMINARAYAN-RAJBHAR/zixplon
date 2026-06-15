import React, { useState, useRef, useEffect } from "react";
import "./videoUpload.css";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { supabase } from "../../config/supabase";
import RecordModal from "../RecordModal/RecordModal";

const INITIAL_FIELDS = {
  title: "",
  description: "",
  videoLink: "",
  thumbnail: "",
  videoType: "",
};

const VideoUpload = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("username");
    if (!user) navigate("/signup");
  }, []);

  const [uploadMode, setUploadMode] = useState("video");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const currentUser = localStorage.getItem("username") || "";

  const [inputField, setInputField] = useState({ ...INITIAL_FIELDS });

  const [loader, setLoader] = useState(false);
  const [thumbLoader, setThumbLoader] = useState(false);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [thumbSource, setThumbSource] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Speed & ETA tracking ──
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const uploadStartTime = useRef(null);
  const uploadedBytesRef = useRef(0);

  const durationRef = useRef("00:00");

  // ── Wake Lock — keeps screen on during upload ──
  const wakeLockRef = useRef(null);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("Wake Lock not available:", err.message);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && loader && wakeLockRef.current === null) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loader]);

  const resetState = () => {
    setInputField({ ...INITIAL_FIELDS });
    setVideoUploaded(false);
    setImageUploaded(false);
    setThumbSource("");
    setError("");
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining("");
    uploadStartTime.current = null;
    uploadedBytesRef.current = 0;
    durationRef.current = "00:00";
  };

  const switchMode = (mode) => {
    setUploadMode(mode);
    resetState();
  };

  // ── Speed & ETA calculator ──
  const updateSpeedAndETA = (loadedBytes, totalBytes) => {
    if (!uploadStartTime.current) return;
    const elapsed = (Date.now() - uploadStartTime.current) / 1000;
    if (elapsed < 1) return;
    const speedBps = loadedBytes / elapsed;
    const speedMBps = speedBps / (1024 * 1024);
    const remaining = totalBytes - loadedBytes;
    const remainSecs = remaining / speedBps;
    setUploadSpeed(speedMBps.toFixed(1));
    if (remainSecs > 3600) {
      setTimeRemaining(`~${Math.ceil(remainSecs / 3600)}h remaining`);
    } else if (remainSecs > 60) {
      setTimeRemaining(`~${Math.ceil(remainSecs / 60)} min remaining`);
    } else {
      setTimeRemaining(`~${Math.ceil(remainSecs)} sec remaining`);
    }
  };

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      videoEl.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoEl.src);
        const totalSec = Math.floor(videoEl.duration);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        durationRef.current =
          hrs > 0
            ? `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
            : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        resolve(durationRef.current);
      };
      videoEl.src = URL.createObjectURL(file);
    });
  };

  // ── FIXED: Reliable thumbnail capture ──
  // Waits for an actual decoded frame before drawing to canvas, so the
  // captured image is never a black/blank frame. Uses
  // requestVideoFrameCallback where available (Chrome/Edge/Android),
  // falls back to a short delay on browsers without it (Safari/Firefox).
  const captureThumbnail = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      let settled = false;

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      const finish = (result, err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (err) reject(err);
        else resolve(result);
      };

      const grabFrame = () => {
        try {
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) {
              finish(null, new Error("Thumbnail capture failed."));
              return;
            }
            finish(blob, null);
          }, "image/jpeg", 0.85);
        } catch (err) {
          finish(null, err);
        }
      };

      video.onloadedmetadata = () => {
        // Pick a safe seek point: 1s in, or the midpoint for very short clips
        const dur = video.duration || 0;
        const seekTo = dur > 2 ? 1 : dur / 2;
        try {
          video.currentTime = seekTo || 0.1;
        } catch (_) {
          // If setting currentTime throws, just try grabbing directly
          grabFrame();
        }
      };

      video.onseeked = () => {
        if ("requestVideoFrameCallback" in video) {
          video.requestVideoFrameCallback(() => grabFrame());
        } else {
          // Give the browser a moment to actually paint the seeked frame
          setTimeout(grabFrame, 200);
        }
      };

      video.onerror = () => {
        finish(null, new Error("Failed to load video for thumbnail."));
      };

      // Absolute safety timeout — never hang forever
      setTimeout(() => {
        if (!settled) finish(null, new Error("Thumbnail capture timed out."));
      }, 8000);

      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const uploadThumbnailToCloudinary = async (blob) => {
    const data = new FormData();
    data.append("file", blob, "thumbnail.jpg");
    data.append("upload_preset", "youtube-clone");
    const res = await axios.post(
      "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload", data,
    );
    return res.data.secure_url;
  };

  const handleOnChangeInput = (event, name) => {
    setInputField((prev) => ({ ...prev, [name]: event.target.value }));
    setError("");
  };

  const uploadToCloudinary = async (file) => {
    const CLOUD_NAME = "dwoqk0yue";
    const UPLOAD_PRESET = "youtube-clone";
    const CHUNK_SIZE = 20 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    if (file.size <= CHUNK_SIZE) {
      const videoData = new FormData();
      videoData.append("file", file);
      videoData.append("upload_preset", UPLOAD_PRESET);
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
        videoData,
        {
          onUploadProgress: (e) => {
            setUploadProgress(Math.round((e.loaded * 100) / e.total));
            updateSpeedAndETA(e.loaded, file.size);
          },
          timeout: 0,
        },
      );
      return res.data.secure_url;
    }

    const uniqueUploadId = `uq_${Date.now()}`;
    let videoUrl = "";
    let totalUploaded = 0;
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkData = new FormData();
      chunkData.append("file", chunk);
      chunkData.append("upload_preset", UPLOAD_PRESET);
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
        chunkData,
        {
          headers: {
            "X-Unique-Upload-Id": uniqueUploadId,
            "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
          },
          timeout: 0,
          onUploadProgress: (e) => {
            const overall = Math.round(
              ((chunkIndex + e.loaded / e.total) / totalChunks) * 100,
            );
            setUploadProgress(overall);
            updateSpeedAndETA(totalUploaded + e.loaded, file.size);
          },
        },
      );
      totalUploaded += end - start;
      if (chunkIndex === totalChunks - 1) videoUrl = res.data.secure_url;
    }
    return videoUrl;
  };

  const uploadToSupabase = async (file) => {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const folder = uploadMode === "reel" ? "reels" : "videos";
    const { error } = await supabase.storage
      .from("media")
      .upload(`${folder}/${fileName}`, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(`Storage error: ${error.message}`);
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(`${folder}/${fileName}`);
    return urlData.publicUrl;
  };

  // ── Fallback: derive a thumbnail URL from Cloudinary's video transformation ──
  // Used only if client-side captureThumbnail fails completely.
  const buildCloudinaryFallbackThumbnail = (videoUrl) => {
    try {
      return videoUrl
        .replace(/\.(mp4|webm|mov|mkv|m4v)$/i, ".jpg")
        .replace("/video/upload/", "/video/upload/so_1,w_640,h_360,c_fill/");
    } catch (_) {
      return "";
    }
  };

  const uploadVideo = async (e) => {
    setLoader(true);
    setError("");
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining("");
    uploadStartTime.current = Date.now();
    uploadedBytesRef.current = 0;

    await requestWakeLock();

    const files = e.target.files;
    if (!files || files.length === 0) { setLoader(false); return; }
    const file = files[0];

    if (file.size > 4 * 1024 * 1024 * 1024) {
      setError("File too large. Maximum size is 4GB.");
      setLoader(false);
      return;
    }

    try {
      const [, thumbnailBlob] = await Promise.all([
        getVideoDuration(file),
        captureThumbnail(file).catch((err) => {
          console.warn("Client-side thumbnail capture failed:", err.message);
          return null;
        }),
      ]);

      const videoUrl = await uploadToCloudinary(file);

      let thumbnailUrl = inputField.thumbnail;
      if (!imageUploaded) {
        if (thumbnailBlob) {
          thumbnailUrl = await uploadThumbnailToCloudinary(thumbnailBlob);
          setThumbSource("auto");
        } else {
          // Client-side capture failed (e.g. black frame / unsupported browser)
          // — fall back to a Cloudinary-generated thumbnail from the uploaded video.
          const fallback = buildCloudinaryFallbackThumbnail(videoUrl);
          thumbnailUrl = fallback || thumbnailUrl;
          setThumbSource("auto");
        }
      }

      setInputField((prev) => ({ ...prev, videoLink: videoUrl, thumbnail: thumbnailUrl }));
      setVideoUploaded(true);
      setUploadProgress(100);
      setLoader(false);
      releaseWakeLock();
    } catch (err) {
      setLoader(false);
      setUploadProgress(0);
      setTimeRemaining("");
      setError(err.message || "Upload failed. Please try again.");
      console.error("Upload error:", err);
      releaseWakeLock();
    }
  };

  const uploadManualThumbnail = async (e) => {
    setThumbLoader(true);
    setError("");
    const files = e.target.files;
    if (!files || files.length === 0) { setThumbLoader(false); return; }
    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "youtube-clone");
    try {
      const res = await axios.post("https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload", data);
      setInputField((prev) => ({ ...prev, thumbnail: res.data.secure_url }));
      setImageUploaded(true);
      setThumbSource("manual");
      setThumbLoader(false);
    } catch (err) {
      setThumbLoader(false);
      setError("Thumbnail upload failed. Please try again.");
    }
  };

  // ── Notify all subscribers when content is uploaded ──
  const notifySubscribers = async (title, type) => {
    const uploaderUsername = localStorage.getItem("username");
    if (!uploaderUsername) return;

    const { data: subUsers } = await supabase
      .from("subscriptions")
      .select("subscriber_username")
      .eq("subscribed_to", uploaderUsername);

    if (!subUsers || subUsers.length === 0) return;

    const notifications = subUsers
      .filter((s) => s.subscriber_username)
      .map((s) => ({
        recipient_username: s.subscriber_username,
        sender_username: uploaderUsername,
        type: "upload",
        message: `${uploaderUsername} uploaded a new ${type}: "${title}"`,
        is_read: false,
      }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  };

  const handleSubmit = async () => {
    if (!inputField.title)       return setError("Please enter a title.");
    if (!inputField.description) return setError("Please enter a description.");
    if (!inputField.videoLink)   return setError("Please upload a video first.");
    if (uploadMode === "video" && !inputField.videoType)
      return setError("Please enter a category.");

    setSaving(true);
    setError("");

    try {
      if (uploadMode === "video") {
        const { error: videoError } = await supabase.from("videos").insert([{
          title:         inputField.title,
          description:   inputField.description,
          video_url:     inputField.videoLink,
          thumbnail_url: inputField.thumbnail,
          category:      inputField.videoType,
          channel:       localStorage.getItem("username") || "Anonymous",
          username:      localStorage.getItem("username") || "anonymous",
          duration:      durationRef.current,
        }]);
        if (videoError) throw new Error(videoError.message);
      } else {
        const { error: reelError } = await supabase.from("reels").insert([{
          title:       inputField.title,
          description: inputField.description,
          video_url:   inputField.videoLink,
          thumbnail:   inputField.thumbnail,
          uploaded_by: localStorage.getItem("username") || "Anonymous",
          username:    (localStorage.getItem("username") || "anonymous").toLowerCase().replace(/\s+/g, ""),
          duration:    durationRef.current,
          likes:       0,
          comments:    0,
        }]);
        if (reelError) throw new Error(reelError.message);
      }

      await notifySubscribers(
        inputField.title,
        uploadMode === "reel" ? "reel" : "video"
      );

      setSaving(false);
      setSubmitted(true);
    } catch (err) {
      setSaving(false);
      setError(err.message || "Failed to save. Please try again.");
      console.error("Save error:", err);
    }
  };

  if (submitted)
    return (
      <div className="videoUpload">
        <div className="uploadBox">
          <div className="upload_success_screen">
            <CheckCircleOutlineIcon sx={{ fontSize: "64px", color: "#4caf50" }} />
            <h2>{uploadMode === "reel" ? "Reel" : "Video"} Uploaded Successfully!</h2>
            <p>Your {uploadMode === "reel" ? "reel" : "video"} is now live on ZIXPLON&reg;</p>
            <video src={inputField.videoLink} poster={inputField.thumbnail} controls className="upload_success_preview" />
            <h3>{inputField.title}</h3>
            <p className="upload_success_meta">
              {uploadMode === "video" ? `${inputField.videoType} • ` : ""}
              {inputField.description}
            </p>
            <div className="uploadBtns">
              <div className="uploadBtns-form" onClick={() => { setSubmitted(false); resetState(); }}>
                Upload Another
              </div>
              <div className="uploadBtns-form" onClick={() => navigate(uploadMode === "reel" ? "/reels" : "/")}>
                {uploadMode === "reel" ? "Go to Reels" : "Go Home"}
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
          Upload
        </div>

        <div className="upload_mode_toggle">
          <div
            className={`upload_mode_btn ${uploadMode === "video" ? "active" : ""}`}
            onClick={() => switchMode("video")}
          >
            🎬 Video
          </div>
          <div
            className={`upload_mode_btn ${uploadMode === "reel" ? "active" : ""}`}
            onClick={() => switchMode("reel")}
          >
            📱 Shorts
          </div>
          <div
            className="upload_mode_btn"
            onClick={() => setShowRecordModal(true)}
            style={{ position: "relative", cursor: "pointer" }}
          >
            <span style={{
              position: "absolute", top: "-4px", right: "-4px",
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#ff0000", animation: "recordPulse 1.2s infinite",
            }} />
            🔴 Record / Live
          </div>
        </div>

        {showRecordModal && (
          <RecordModal onClose={() => setShowRecordModal(false)} currentUser={currentUser} />
        )}

        <style>{`
          @keyframes recordPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(1.3); }
          }
        `}</style>

        {uploadMode === "reel" && (
          <p className="upload_mode_hint">
            Reels are short vertical videos — they appear in the Reels / Shorts section.
          </p>
        )}

        <div className="uploadForm">
          <input
            type="text"
            value={inputField.title}
            onChange={(e) => handleOnChangeInput(e, "title")}
            placeholder={uploadMode === "reel" ? "Reel Title" : "Title of Video"}
            className="uploadFormInputs"
          />
          <input
            type="text"
            value={inputField.description}
            onChange={(e) => handleOnChangeInput(e, "description")}
            placeholder="Description"
            className="uploadFormInputs"
          />
          {uploadMode === "video" && (
            <input
              type="text"
              value={inputField.videoType}
              onChange={(e) => handleOnChangeInput(e, "videoType")}
              placeholder="Category (e.g. Music, Gaming, News)"
              className="uploadFormInputs"
            />
          )}

          <div className="upload_file_row">
            <span className="upload_file_label">
              {uploadMode === "reel" ? "Reel Video" : "Video"}
            </span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/*"
              onChange={uploadVideo}
              style={{ display: "none" }}
              id="videoInput"
            />
            <span
              className="upload_file_btn"
              onClick={() => document.getElementById("videoInput").click()}
            >
              {videoUploaded
                ? `✅ Change ${uploadMode === "reel" ? "Reel" : "Video"}`
                : `🎬 Choose ${uploadMode === "reel" ? "Reel" : "Video"}`}
            </span>
          </div>

          <div className="upload_file_row">
            <span className="upload_file_label">
              Thumbnail
              <span style={{ color: "#888", fontSize: "0.75rem", marginLeft: "6px" }}>(optional)</span>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadManualThumbnail}
              style={{ display: "none" }}
              id="thumbnailInput"
            />
            <span
              className="upload_file_btn"
              onClick={() => document.getElementById("thumbnailInput").click()}
            >
              {imageUploaded ? "✅ Change Thumbnail" : "📷 Choose Image"}
            </span>
            {thumbLoader && <CircularProgress size={20} sx={{ color: "orange", ml: 1 }} />}
          </div>

          {inputField.thumbnail && (
            <div className="upload_thumb_row">
              <img src={inputField.thumbnail} alt="Thumbnail preview" className="upload_thumb_preview" />
              <span style={{ color: "#888", fontSize: "0.78rem", marginTop: "4px" }}>
                {thumbSource === "manual" ? "✏️ Custom thumbnail" : "🎞️ Auto-captured from video"}
              </span>
            </div>
          )}

          {loader && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CircularProgress size={28} sx={{ color: "orange" }} />
                <span style={{ color: "#aaa", fontSize: "0.9rem" }}>
                  ☁️ Uploading to Zixplon...
                </span>
              </Box>

              <div style={{ width: "100%", background: "#333", borderRadius: "8px", height: "8px" }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  background: "orange",
                  height: "100%", borderRadius: "8px", transition: "width 0.3s",
                }} />
              </div>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666", fontSize: "0.8rem" }}>
                  {uploadProgress}% complete
                  {uploadSpeed > 0 ? ` • ${uploadSpeed} MB/s` : ""}
                </span>
                {timeRemaining && (
                  <span style={{
                    color: "orange",
                    fontSize: "0.8rem", fontWeight: 500,
                  }}>
                    ⏱ {timeRemaining}
                  </span>
                )}
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
            {saving
              ? "Saving..."
              : loader
                ? `Uploading... ${uploadProgress}%`
                : `Upload ${uploadMode === "reel" ? "Reel" : "Video"}`}
          </div>
          <Link to={"/"} className="uploadBtns-form">Home</Link>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;