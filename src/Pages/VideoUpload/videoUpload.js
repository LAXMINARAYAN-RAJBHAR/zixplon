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

  const [uploadMode, setUploadMode]           = useState("video");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const currentUser = localStorage.getItem("username") || "";

  const [inputField, setInputField] = useState({ ...INITIAL_FIELDS });

  const [loader, setLoader]                   = useState(false);
  const [thumbLoader, setThumbLoader]         = useState(false);
  const [videoUploaded, setVideoUploaded]     = useState(false);
  const [imageUploaded, setImageUploaded]     = useState(false);
  const [submitted, setSubmitted]             = useState(false);
  const [error, setError]                     = useState("");
  const [saving, setSaving]                   = useState(false);
  const [thumbSource, setThumbSource]         = useState("");
  const [uploadProgress, setUploadProgress]   = useState(0);
  const [archiveItemId, setArchiveItemId]     = useState("");
  const [activeProvider, setActiveProvider]   = useState("");
  const [archiveStatus, setArchiveStatus]     = useState("");

  // ── Speed & ETA tracking ──
  const [uploadSpeed, setUploadSpeed]       = useState(0);
  const [timeRemaining, setTimeRemaining]   = useState("");
  const uploadStartTime                     = useRef(null);
  const uploadedBytesRef                    = useRef(0);

  const durationRef = useRef("00:00");

  const resetState = () => {
    setInputField({ ...INITIAL_FIELDS });
    setVideoUploaded(false);
    setImageUploaded(false);
    setThumbSource("");
    setError("");
    setArchiveItemId("");
    setActiveProvider("");
    setUploadProgress(0);
    setArchiveStatus("");
    setUploadSpeed(0);
    setTimeRemaining("");
    uploadStartTime.current   = null;
    uploadedBytesRef.current  = 0;
    durationRef.current       = "00:00";
  };

  const switchMode = (mode) => {
    setUploadMode(mode);
    resetState();
  };

  // ── Speed & ETA calculator ──
  const updateSpeedAndETA = (loadedBytes, totalBytes) => {
    if (!uploadStartTime.current) return;
    const elapsed = (Date.now() - uploadStartTime.current) / 1000; // seconds
    if (elapsed < 1) return; // wait at least 1s before calculating
    const speedBps   = loadedBytes / elapsed;
    const speedMBps  = speedBps / (1024 * 1024);
    const remaining  = totalBytes - loadedBytes;
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

  // ── Auto-select provider based on file size ──
  const autoSelectProvider = (file) => {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB < 500) return "cloudinary";
    return "archive";
  };

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      videoEl.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoEl.src);
        const totalSec = Math.floor(videoEl.duration);
        const hrs  = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        durationRef.current = hrs > 0
          ? `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`
          : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
        resolve(durationRef.current);
      };
      videoEl.src = URL.createObjectURL(file);
    });
  };

  const captureThumbnail = (file) => {
    return new Promise((resolve) => {
      const video  = document.createElement("video");
      const canvas = document.createElement("canvas");
      video.preload     = "metadata";
      video.muted       = true;
      video.playsInline = true;
      video.onloadeddata = () => { video.currentTime = 1; };
      video.onseeked = () => {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, "image/jpeg", 0.85);
      };
      video.src = URL.createObjectURL(file);
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
    const CLOUD_NAME    = "dwoqk0yue";
    const UPLOAD_PRESET = "youtube-clone";
    const CHUNK_SIZE    = 20 * 1024 * 1024;
    const totalChunks   = Math.ceil(file.size / CHUNK_SIZE);

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
      const end   = Math.min(start + CHUNK_SIZE, file.size);
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
            const overall = Math.round(((chunkIndex + e.loaded / e.total) / totalChunks) * 100);
            setUploadProgress(overall);
            updateSpeedAndETA(totalUploaded + e.loaded, file.size);
          },
        },
      );
      totalUploaded += (end - start);
      if (chunkIndex === totalChunks - 1) videoUrl = res.data.secure_url;
    }
    return videoUrl;
  };

  const uploadToSupabase = async (file) => {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const folder   = uploadMode === "reel" ? "reels" : "videos";
    const { error } = await supabase.storage
      .from("media")
      .upload(`${folder}/${fileName}`, file, { cacheControl: "3600", upsert: false });
    if (error) throw new Error(`Storage error: ${error.message}`);
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(`${folder}/${fileName}`);
    return urlData.publicUrl;
  };

  const sanitizeForHeader = (str) =>
    str.replace(/[^\w\s\-.,!?()]/g, "").trim() || "Untitled";

  const uploadToArchive = async (file, titleOverride = "") => {
    const ACCESS_KEY = process.env.REACT_APP_ARCHIVE_ACCESS;
    const SECRET_KEY = process.env.REACT_APP_ARCHIVE_SECRET;

    if (!ACCESS_KEY || !SECRET_KEY) {
      throw new Error(
        "Internet Archive API keys are missing. Add REACT_APP_ARCHIVE_ACCESS and REACT_APP_ARCHIVE_SECRET to your .env file and restart."
      );
    }

    const username = (localStorage.getItem("username") || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const identifier = `zixplon-${username}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    const fileName = file.name
      .replace(/\s+/g, "_")
      .replace(/[^\w.\-]/g, "");

    setArchiveItemId(identifier);
    setArchiveStatus("Connecting to Archive.org...");

    // ── SPEED FIX: 200MB chunks (was 50MB) — fewer round-trips to USA ──
    const CHUNK_SIZE  = 200 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    // ── SPEED FIX: 6 parallel uploads (was 3) ──
    const PARALLEL    = 6;

    const safeTitle = sanitizeForHeader(titleOverride || file.name);
    const safeDesc  = sanitizeForHeader(inputField.description || "Uploaded via ZIXPLON");

    let totalUploadedBytes = 0;

    const uploadChunk = (chunkIndex) => {
      return new Promise((resolve, reject) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkFileName =
          totalChunks === 1
            ? fileName
            : `${fileName}.part${String(chunkIndex).padStart(4, "0")}`;

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `https://s3.us.archive.org/${identifier}/${chunkFileName}`);

        xhr.setRequestHeader("Authorization", `LOW ${ACCESS_KEY}:${SECRET_KEY}`);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-archive-meta-mediatype", "movies");
        xhr.setRequestHeader("x-archive-meta-title", safeTitle);
        xhr.setRequestHeader("x-archive-meta-description", safeDesc);
        xhr.setRequestHeader("x-archive-meta-subject", "zixplon;video");
        xhr.setRequestHeader("x-archive-auto-make-bucket", "1");
        xhr.setRequestHeader(
          "x-archive-meta-licenseurl",
          "http://creativecommons.org/licenses/by/4.0/"
        );

        let chunkUploaded = 0;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            chunkUploaded = e.loaded;
            const overall = Math.round(
              ((chunkIndex + e.loaded / e.total) / totalChunks) * 100
            );
            setUploadProgress(overall);
            setArchiveStatus(
              `Uploading part ${chunkIndex + 1} of ${totalChunks}...`
            );
            // Speed & ETA — cumulative bytes sent so far
            updateSpeedAndETA(totalUploadedBytes + chunkUploaded, file.size);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            totalUploadedBytes += (end - start);
            resolve(chunkFileName);
          } else {
            console.error(
              `Archive chunk ${chunkIndex} failed`,
              xhr.status,
              xhr.responseText
            );
            let reason = `Status ${xhr.status}`;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(xhr.responseText, "text/xml");
              const msg = doc.querySelector("Message, Error")?.textContent;
              if (msg) reason = msg;
            } catch (_) {}
            reject(new Error(`Archive upload failed: ${reason}`));
          }
        };

        xhr.onerror = () => {
          console.error(`Network/CORS error on chunk ${chunkIndex}`);
          reject(
            new Error(
              "Network error uploading to Archive.org. This may be a CORS issue — consider proxying through your backend."
            )
          );
        };

        xhr.send(chunk);
      });
    };

    const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);

    for (let i = 0; i < chunkIndices.length; i += PARALLEL) {
      const batch = chunkIndices.slice(i, i + PARALLEL);
      await Promise.all(batch.map((idx) => uploadChunk(idx)));
    }

    setUploadProgress(100);
    setArchiveStatus("Upload complete! Processing on Archive.org...");
    setTimeRemaining("");

    return totalChunks === 1
      ? `https://archive.org/download/${identifier}/${fileName}`
      : `https://archive.org/download/${identifier}/${fileName}.part0000`;
  };

  const uploadVideo = async (e) => {
    setLoader(true);
    setError("");
    setUploadProgress(0);
    setArchiveStatus("");
    setUploadSpeed(0);
    setTimeRemaining("");
    uploadStartTime.current  = Date.now();
    uploadedBytesRef.current = 0;

    const files = e.target.files;
    if (!files || files.length === 0) { setLoader(false); return; }
    const file = files[0];

    if (file.size > 4 * 1024 * 1024 * 1024) {
      setError("File too large. Maximum size is 4GB.");
      setLoader(false);
      return;
    }

    const selectedProvider = autoSelectProvider(file);
    setActiveProvider(selectedProvider);

    try {
      const [, thumbnailBlob] = await Promise.all([
        getVideoDuration(file),
        captureThumbnail(file),
      ]);

      let videoUrl = "";
      if (selectedProvider === "supabase") {
        videoUrl = await uploadToSupabase(file);
        setUploadProgress(100);
      } else if (selectedProvider === "cloudinary") {
        videoUrl = await uploadToCloudinary(file);
      } else if (selectedProvider === "archive") {
        videoUrl = await uploadToArchive(file, inputField.title);
      }

      let thumbnailUrl = inputField.thumbnail;
      if (!imageUploaded) {
        thumbnailUrl = await uploadThumbnailToCloudinary(thumbnailBlob);
        setThumbSource("auto");
      }

      setInputField((prev) => ({ ...prev, videoLink: videoUrl, thumbnail: thumbnailUrl }));
      setVideoUploaded(true);
      setUploadProgress(100);
      setLoader(false);
    } catch (err) {
      setLoader(false);
      setUploadProgress(0);
      setArchiveStatus("");
      setTimeRemaining("");
      setError(err.message || "Upload failed. Please try again.");
      console.error("Upload error:", err);
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
        if (videoError) {
          console.error("Supabase videos error:", videoError);
          throw new Error(videoError.message);
        }
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
        if (reelError) {
          console.error("Supabase reels error:", reelError);
          throw new Error(reelError.message);
        }
      }
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
            {activeProvider === "archive" && archiveItemId && (
              <a
                href={`https://archive.org/details/${archiveItemId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#3ea6ff", fontSize: "13px", marginBottom: "12px", display: "block", textDecoration: "none" }}
              >
                🏛️ View on Internet Archive →
              </a>
            )}
            <video src={inputField.videoLink} poster={inputField.thumbnail} controls className="upload_success_preview" />
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
                  resetState();
                }}
              >
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

              {/* Status line */}
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <CircularProgress size={28} sx={{ color: "orange" }} />
                <span style={{ color: "#aaa", fontSize: "0.9rem" }}>
                  {activeProvider === "archive"
                    ? `🏛️ ${archiveStatus || "Uploading to Archive.org..."}`
                    : `☁️ Uploading to Cloudinary...`}
                </span>
              </Box>

              {/* Progress bar */}
              <div style={{ width: "100%", background: "#333", borderRadius: "8px", height: "8px" }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  background: activeProvider === "archive" ? "#3ea6ff" : "orange",
                  height: "100%", borderRadius: "8px", transition: "width 0.3s",
                }} />
              </div>

              {/* Speed & ETA row */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#666", fontSize: "0.8rem" }}>
                  {uploadProgress}% complete
                  {uploadSpeed > 0 ? ` • ${uploadSpeed} MB/s` : ""}
                </span>
                {timeRemaining && (
                  <span style={{
                    color: activeProvider === "archive" ? "#3ea6ff" : "orange",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                  }}>
                    ⏱ {timeRemaining}
                  </span>
                )}
              </Box>

              {activeProvider === "archive" && (
                <p style={{ color: "#555", fontSize: "11px", margin: 0 }}>
                  ⚠️ Large files may take several minutes from India to US servers. Do not close this tab.
                </p>
              )}
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