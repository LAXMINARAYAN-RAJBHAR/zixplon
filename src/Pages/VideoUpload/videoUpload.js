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

const VideoUpload = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const user = localStorage.getItem("username");
    if (!user) {
      navigate("/signup");
    }
  }, []);

  const [uploadMode, setUploadMode] = useState("video");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const currentUser = localStorage.getItem("username") || "";

  const [inputField, setInputField] = useState({
    title: "",
    description: "",
    videoLink: "",
    thumbnail: "",
    videoType: "",
  });

  const [loader, setLoader] = useState(false);
  const [thumbLoader, setThumbLoader] = useState(false);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [thumbSource, setThumbSource] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const durationRef = useRef("00:00");

  // ── Reset form when switching mode ──
  const switchMode = (mode) => {
    setUploadMode(mode);
    setInputField({
      title: "",
      description: "",
      videoLink: "",
      thumbnail: "",
      videoType: "",
    });
    setVideoUploaded(false);
    setImageUploaded(false);
    setThumbSource("");
    setError("");
    durationRef.current = "00:00";
  };

  // ── Get video duration ──
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

  // ── Capture thumbnail from video at 1 second ──
  const captureThumbnail = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            resolve(blob);
          },
          "image/jpeg",
          0.85,
        );
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // ── Upload thumbnail blob to Cloudinary ──
  const uploadThumbnailToCloudinary = async (blob) => {
    const data = new FormData();
    data.append("file", blob, "thumbnail.jpg");
    data.append("upload_preset", "youtube-clone");
    const res = await axios.post(
      "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
      data,
    );
    return res.data.secure_url;
  };

  const handleOnChangeInput = (event, name) => {
    setInputField({ ...inputField, [name]: event.target.value });
    setError("");
  };

  // ── Upload video + auto-capture thumbnail ──
  const uploadVideo = async (e) => {
    setLoader(true);
    setError("");
    setUploadProgress(0);
    const files = e.target.files;
    if (!files || files.length === 0) {
      setLoader(false);
      return;
    }
    const file = files[0];

    const MAX_SIZE = 4 * 1024 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("File too large. Maximum size is 4GB.");
      setLoader(false);
      return;
    }

    try {
      const [, thumbnailBlob] = await Promise.all([
        getVideoDuration(file),
        captureThumbnail(file),
      ]);

      const CLOUD_NAME = "dwoqk0yue";
      const UPLOAD_PRESET = "youtube-clone";
      const CHUNK_SIZE = 20 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let videoUrl = "";

      if (file.size <= CHUNK_SIZE) {
        const videoData = new FormData();
        videoData.append("file", file);
        videoData.append("upload_preset", UPLOAD_PRESET);
        const videoRes = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
          videoData,
          {
            onUploadProgress: (e) => {
              setUploadProgress(Math.round((e.loaded * 100) / e.total));
            },
            timeout: 0,
          },
        );
        videoUrl = videoRes.data.secure_url;
      } else {
        const uniqueUploadId = `uq_${Date.now()}`;
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
                const chunkProgress = e.loaded / e.total;
                const overall = Math.round(
                  ((chunkIndex + chunkProgress) / totalChunks) * 100,
                );
                setUploadProgress(overall);
              },
            },
          );

          if (chunkIndex === totalChunks - 1) {
            videoUrl = res.data.secure_url;
          }
        }
      }

      let thumbnailUrl = inputField.thumbnail;
      if (!imageUploaded) {
        thumbnailUrl = await uploadThumbnailToCloudinary(thumbnailBlob);
        setThumbSource("auto");
      }

      setInputField((prev) => ({
        ...prev,
        videoLink: videoUrl,
        thumbnail: thumbnailUrl,
      }));
      setVideoUploaded(true);
      setUploadProgress(100);
      setLoader(false);
    } catch (err) {
      setLoader(false);
      setUploadProgress(0);
      setError("Upload failed. Please try again.");
      console.log("Upload error:", err.response?.data || err);
    }
  };

  // ── Manual thumbnail upload ──
  const uploadManualThumbnail = async (e) => {
    setThumbLoader(true);
    setError("");
    const files = e.target.files;
    if (!files || files.length === 0) {
      setThumbLoader(false);
      return;
    }
    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "youtube-clone");
    try {
      const res = await axios.post(
        "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
        data,
      );
      setInputField((prev) => ({ ...prev, thumbnail: res.data.secure_url }));
      setImageUploaded(true);
      setThumbSource("manual");
      setThumbLoader(false);
    } catch (err) {
      setThumbLoader(false);
      setError("Thumbnail upload failed. Please try again.");
      console.log("Thumbnail error:", err.response?.data || err);
    }
  };

  // ── Save to Supabase ──
  const handleSubmit = async () => {
    if (!inputField.title) return setError("Please enter a title.");
    if (!inputField.description) return setError("Please enter a description.");
    if (!inputField.videoLink) return setError("Please upload a video.");
    if (uploadMode === "video" && !inputField.videoType)
      return setError("Please enter a category.");

    setSaving(true);
    setError("");

    try {
      if (uploadMode === "video") {
        const { error: videoError } = await supabase.from("videos").insert([
          {
            title: inputField.title,
            description: inputField.description,
            video_url: inputField.videoLink,
            thumbnail_url: inputField.thumbnail,
            category: inputField.videoType,
            channel: localStorage.getItem("username") || "Anonymous",
            duration: durationRef.current,
          },
        ]);
        if (videoError) throw videoError;
      } else {
        const reelInsertData = {
          title: inputField.title,
          description: inputField.description,
          video_url: inputField.videoLink,
          thumbnail: inputField.thumbnail,
          user: localStorage.getItem("username") || "Anonymous",
          username: (localStorage.getItem("username") || "anonymous")
            .toLowerCase()
            .replace(/\s+/g, ""),
          duration: durationRef.current,
          likes: 0,
          comments: 0,
        };
        const { error: reelError } = await supabase.from("reels").insert([reelInsertData]);
        if (reelError) {
          console.error("REEL INSERT ERROR:", JSON.stringify(reelError, null, 2));
          throw reelError;
        }
      }

      setSaving(false);
      setSubmitted(true);
    } catch (err) {
      setSaving(false);
      setError("Failed to save. Please try again.");
      console.log("FULL SAVE ERROR:", err);
    }
  };

  // ── Success Screen ──
  if (submitted)
    return (
      <div className="videoUpload">
        <div className="uploadBox">
          <div className="upload_success_screen">
            <CheckCircleOutlineIcon sx={{ fontSize: "64px", color: "#4caf50" }} />
            <h2>{uploadMode === "reel" ? "Reel" : "Video"} Uploaded Successfully!</h2>
            <p>Your {uploadMode === "reel" ? "reel" : "video"} is now live on ZIXPLON&reg;</p>
            <video
              src={inputField.videoLink}
              poster={inputField.thumbnail}
              controls
              className="upload_success_preview"
            />
            <h3>{inputField.title}</h3>
            <p className="upload_success_meta">
              {uploadMode === "video" ? `${inputField.videoType} • ` : ""}
              {inputField.description}
            </p>
            <div className="uploadBtns">
              <div
                className="uploadBtns-form"
                onClick={() => {
                  setSubmitted(false);
                  setInputField({ title: "", description: "", videoLink: "", thumbnail: "", videoType: "" });
                  setVideoUploaded(false);
                  setImageUploaded(false);
                  setThumbSource("");
                  durationRef.current = "00:00";
                }}
              >
                Upload Another
              </div>
              <div
                className="uploadBtns-form"
                onClick={() => navigate(uploadMode === "reel" ? "/reels" : "/")}
              >
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

        {/* ── Title ── */}
        <div className="uploadVideoTitle">
          <CloudUploadIcon sx={{ fontSize: "54px", color: "orange" }} />
          Upload
        </div>

        {/* ── Mode Toggle — Video | Shorts | 🔴 Record / Live ── */}
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
          {/* ✅ Record / Live tab */}
          <div
            className="upload_mode_btn"
            onClick={() => setShowRecordModal(true)}
            style={{ position: "relative", cursor: "pointer" }}
          >
            {/* Pulsing red dot */}
            <span style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#ff0000",
              animation: "recordPulse 1.2s infinite",
            }} />
            🔴 Record / Live
          </div>
        </div>

        {/* ✅ RecordModal — at root level so it renders as true fullscreen overlay */}
        {showRecordModal && (
          <RecordModal
            onClose={() => setShowRecordModal(false)}
            currentUser={currentUser}
          />
        )}

        <style>{`
          @keyframes recordPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.3); }
          }
        `}</style>

        {uploadMode === "reel" && (
          <p className="upload_mode_hint">
            Reels are short vertical videos — they will appear in the Reels / Shorts section.
          </p>
        )}

        {/* ── Form ── */}
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

          {/* ── Video Upload ── */}
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

          {/* ── Thumbnail Upload ── */}
          <div className="upload_file_row">
            <span className="upload_file_label">
              Thumbnail
              <span style={{ color: "#888", fontSize: "0.75rem", marginLeft: "6px" }}>
                (optional)
              </span>
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
            {thumbLoader && (
              <CircularProgress size={20} sx={{ color: "orange", ml: 1 }} />
            )}
          </div>

          {/* ── Thumbnail Preview ── */}
          {inputField.thumbnail && (
            <div className="upload_thumb_row">
              <img
                src={inputField.thumbnail}
                alt="Thumbnail preview"
                className="upload_thumb_preview"
              />
              <span style={{ color: "#888", fontSize: "0.78rem", marginTop: "4px" }}>
                {thumbSource === "manual"
                  ? "✏️ Custom thumbnail"
                  : "🎞️ Auto-captured from video"}
              </span>
            </div>
          )}

          {/* ── Upload Progress ── */}
          {loader && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CircularProgress size={28} sx={{ color: "orange" }} />
                <span style={{ color: "#aaa", fontSize: "0.9rem" }}>
                  Uploading... {uploadProgress}%
                </span>
              </Box>
              <div style={{ width: "100%", background: "#333", borderRadius: "8px", height: "8px" }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  background: "orange",
                  height: "100%",
                  borderRadius: "8px",
                  transition: "width 0.3s",
                }} />
              </div>
            </Box>
          )}

          {/* ── Error ── */}
          {error && <p className="upload_error_msg">{error}</p>}
        </div>

        {/* ── Buttons ── */}
        <div className="uploadBtns">
          <div
            className={`uploadBtns-form ${loader || saving || thumbLoader ? "uploadBtns-disabled" : ""}`}
            onClick={!loader && !saving && !thumbLoader ? handleSubmit : undefined}
          >
            {saving
              ? "Saving..."
              : loader
                ? "Uploading..."
                : `Upload ${uploadMode === "reel" ? "Reel" : "Video"}`}
          </div>
          <Link to={"/"} className="uploadBtns-form">
            Home
          </Link>
        </div>

      </div>
    </div>
  );
};

export default VideoUpload;