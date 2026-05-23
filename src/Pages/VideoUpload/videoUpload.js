import React, { useState, useRef } from "react";
import "./videoUpload.css";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { supabase } from "../../config/supabase";

const VideoUpload = () => {
  const navigate = useNavigate();

  const [inputField, setInputField] = useState({
    title:       "",
    description: "",
    videoLink:   "",
    thumbnail:   "",
    videoType:   "",
  });

  const [loader, setLoader]                     = useState(false);
  const [thumbLoader, setThumbLoader]           = useState(false);
  const [videoUploaded, setVideoUploaded]       = useState(false);
  const [imageUploaded, setImageUploaded]       = useState(false); // manual thumb
  const [submitted, setSubmitted]               = useState(false);
  const [error, setError]                       = useState("");
  const [saving, setSaving]                     = useState(false);
  const [thumbSource, setThumbSource]           = useState(""); // "auto" | "manual"

  const durationRef = useRef("00:00");

  // ── Get video duration ──
  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const videoEl   = document.createElement("video");
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

  // ── Capture thumbnail from video at 1 second ──
  const captureThumbnail = (file) => {
    return new Promise((resolve) => {
      const video  = document.createElement("video");
      const canvas = document.createElement("canvas");
      video.preload     = "metadata";
      video.muted       = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, "image/jpeg", 0.85);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  // ── Upload thumbnail blob to Cloudinary ──
  const uploadThumbnailToCloudinary = async (blob) => {
    const data = new FormData();
    data.append("file", blob, "thumbnail.jpg");
    data.append("upload_preset", "youtube-clone");
    const response = await axios.post(
      "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
      data
    );
    return response.data.secure_url;
  };

  const handleOnChangeInput = (event, name) => {
    setInputField({ ...inputField, [name]: event.target.value });
    setError("");
  };

  // ── Upload video + auto-capture thumbnail ──
  const uploadVideo = async (e) => {
    setLoader(true);
    setError("");

    const files = e.target.files;
    if (!files || files.length === 0) { setLoader(false); return; }

    const file = files[0];

    try {
      const [, thumbnailBlob] = await Promise.all([
        getVideoDuration(file),
        captureThumbnail(file),
      ]);

      // Upload video
      const videoData = new FormData();
      videoData.append("file", file);
      videoData.append("upload_preset", "youtube-clone");
      const videoResponse = await axios.post(
        "https://api.cloudinary.com/v1_1/dwoqk0yue/video/upload",
        videoData
      );
      const videoUrl = videoResponse.data.secure_url;

      // Upload auto-captured thumbnail (only if user hasn't manually set one)
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
      setLoader(false);
    } catch (err) {
      setLoader(false);
      setError("Upload failed. Please try again.");
      console.log("Upload error:", err.response?.data || err);
    }
  };

  // ── Manual thumbnail upload (optional) ──
  const uploadManualThumbnail = async (e) => {
    setThumbLoader(true);
    setError("");

    const files = e.target.files;
    if (!files || files.length === 0) { setThumbLoader(false); return; }

    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "youtube-clone");

    try {
      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
        data
      );
      const url = response.data.secure_url;
      setInputField((prev) => ({ ...prev, thumbnail: url }));
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
    if (!inputField.title)       return setError("Please enter a video title.");
    if (!inputField.description) return setError("Please enter a description.");
    if (!inputField.videoType)   return setError("Please enter a category.");
    if (!inputField.videoLink)   return setError("Please upload a video.");

    setSaving(true);
    setError("");

    try {
      const { error: dbError } = await supabase
        .from("videos")
        .insert([{
          title:         inputField.title,
          description:   inputField.description,
          video_url:     inputField.videoLink,
          thumbnail_url: inputField.thumbnail,
          category:      inputField.videoType,
          channel:       localStorage.getItem("username") || "Anonymous",
          duration:      durationRef.current,
        }]);

      if (dbError) throw dbError;

      setSaving(false);
      setSubmitted(true);
    } catch (err) {
      setSaving(false);
      setError("Failed to save video. Please try again.");
      console.log(err);
    }
  };

  // ── Success Screen ──
  if (submitted) return (
    <div className="videoUpload">
      <div className="uploadBox">
        <div className="upload_success_screen">
          <CheckCircleOutlineIcon sx={{ fontSize: "64px", color: "#4caf50" }} />
          <h2>Video Uploaded Successfully!</h2>
          <p>Your video is now live on ZIXPLON&reg;</p>
          <video
            src={inputField.videoLink}
            poster={inputField.thumbnail}
            controls
            className="upload_success_preview"
          />
          <h3>{inputField.title}</h3>
          <p className="upload_success_meta">{inputField.videoType} • {inputField.description}</p>
          <div className="uploadBtns">
            <div className="uploadBtns-form" onClick={() => {
              setSubmitted(false);
              setInputField({ title: "", description: "", videoLink: "", thumbnail: "", videoType: "" });
              setVideoUploaded(false);
              setImageUploaded(false);
              setThumbSource("");
              durationRef.current = "00:00";
            }}>
              Upload Another
            </div>
            <div className="uploadBtns-form" onClick={() => navigate("/")}>
              Go Home
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
          Upload Video
        </div>

        {/* ── Form ── */}
        <div className="uploadForm">
          <input
            type="text"
            value={inputField.title}
            onChange={(e) => handleOnChangeInput(e, "title")}
            placeholder="Title of Video"
            className="uploadFormInputs"
          />
          <input
            type="text"
            value={inputField.description}
            onChange={(e) => handleOnChangeInput(e, "description")}
            placeholder="Description"
            className="uploadFormInputs"
          />
          <input
            type="text"
            value={inputField.videoType}
            onChange={(e) => handleOnChangeInput(e, "videoType")}
            placeholder="Category (e.g. Music, Gaming, News)"
            className="uploadFormInputs"
          />

          {/* ── Video Upload ── */}
          <div className="upload_file_row">
            <span className="upload_file_label">Video</span>
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
              {videoUploaded ? "✅ Change Video" : "🎬 Choose Video"}
            </span>
          </div>

          {/* ── Thumbnail Row (auto preview + optional manual override) ── */}
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

            {/* Thumbnail loader */}
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

          {/* ── Video/Upload Loader ── */}
          {loader && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <CircularProgress size={28} sx={{ color: "orange" }} aria-label="Loading…" />
              <span style={{ color: "#aaa", fontSize: "0.9rem" }}>
                Uploading video & capturing thumbnail...
              </span>
            </Box>
          )}

          {/* ── Error ── */}
          {error && <p className="upload_error_msg">{error}</p>}
        </div>

        {/* ── Buttons ── */}
        <div className="uploadBtns">
          <div
            className={`uploadBtns-form ${(loader || saving || thumbLoader) ? "uploadBtns-disabled" : ""}`}
            onClick={!loader && !saving && !thumbLoader ? handleSubmit : undefined}
          >
            {saving ? "Saving..." : loader ? "Uploading..." : "Upload"}
          </div>
          <Link to={"/"} className="uploadBtns-form">Home</Link>
        </div>

      </div>
    </div>
  );
};

export default VideoUpload;