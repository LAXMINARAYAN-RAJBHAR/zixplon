import React, { useEffect, useState } from "react";
import { supabase } from "../../config/supabase";
import "./ReportPreviewModal.css";

// Which table each report type lives in (mirrors deleteContent in AdminPanel.jsx)
const tableFor = (type) =>
  type === "message" ? "direct_messages"
  : type === "reel" ? "reels"
  : type === "video" ? "videos"
  : "posts";

// Column names differ between tables, so check the common ones.
const pick = (row, keys) => {
  for (const k of keys) if (row?.[k]) return row[k];
  return null;
};

const ReportPreviewModal = ({ report, onClose, onDelete, onDismiss, busy }) => {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const rawId = String(report.content_id).replace("db_", "");
      const { data, error: err } = await supabase
        .from(tableFor(report.content_type))
        .select("*")
        .eq("id", rawId)
        .maybeSingle();
      if (!active) return;
      if (err) setError(err.message);
      setRow(data || null);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [report.id, report.content_id, report.content_type]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const videoUrl = pick(row, ["video_url", "videoUrl", "url", "video", "src"]);
  const poster   = pick(row, ["thumbnail", "thumbnail_url", "thumb", "poster"]);
  const imageUrl = pick(row, ["image_url", "image", "media_url", "photo_url"]);
  const text     = pick(row, ["text", "caption", "description"]);
  const title    = pick(row, ["title"]);

  // Direct messages keep attachments in separate columns
  const attUrl  = row?.attachment_url;
  const attType = row?.attachment_type || "";

  const renderMedia = () => {
    if (report.content_type === "message") {
      if (row?.deleted_at) return <p className="admin_preview_note">This message was already deleted.</p>;
      return (
        <>
          {text && <p className="admin_preview_text">{text}</p>}
          {attUrl && attType.startsWith("image") && <img className="admin_preview_img" src={attUrl} alt="attachment" />}
          {attUrl && attType.startsWith("video") && <video className="admin_preview_video" src={attUrl} controls playsInline />}
          {attUrl && !attType.startsWith("image") && !attType.startsWith("video") && (
            <a href={attUrl} target="_blank" rel="noreferrer" className="admin_preview_link">
              📎 {row.attachment_name || "Open attachment"}
            </a>
          )}
        </>
      );
    }

    return (
      <>
        {title && <h4 className="admin_preview_title">{title}</h4>}
        {videoUrl && (
          <video className="admin_preview_video" src={videoUrl} poster={poster || undefined} controls playsInline preload="metadata" />
        )}
        {!videoUrl && imageUrl && <img className="admin_preview_img" src={imageUrl} alt="reported content" />}
        {text && <p className="admin_preview_text">{text}</p>}
        {!videoUrl && !imageUrl && !text && (
          <p className="admin_preview_note">No playable media found in this record. See the raw data below.</p>
        )}
      </>
    );
  };

  return (
    <div className="admin_preview_backdrop" onClick={onClose}>
      <div className="admin_preview_modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="admin_preview_header">
          <div>
            <div className="admin_preview_kicker">{report.content_type.toUpperCase()} · reported for "{report.reason}"</div>
            <div className="admin_admin_meta">
              Reported by @{report.reporter_username}
              {report.content_owner ? ` · uploaded by @${report.content_owner}` : ""}
            </div>
          </div>
          <button className="admin_word_remove" onClick={onClose} title="Close" style={{ fontSize: 22 }}>×</button>
        </div>

        <div className="admin_preview_body">
          {report.details && (
            <div className="admin_preview_reporter_note">
              <strong>Reporter's details:</strong> {report.details}
            </div>
          )}

          {loading ? (
            <div className="admin_loading"><div className="admin_spinner" /><p>Loading content...</p></div>
          ) : error ? (
            <p className="admin_preview_note">❌ Couldn't load this content: {error}</p>
          ) : !row ? (
            <p className="admin_preview_note">
              This content no longer exists. It may have been deleted already, so there is nothing left to review.
              You can dismiss the report.
            </p>
          ) : (
            <>
              {renderMedia()}
              <details className="admin_preview_raw">
                <summary>Raw data</summary>
                <pre>{JSON.stringify(row, null, 2)}</pre>
              </details>
            </>
          )}
        </div>

        <div className="admin_preview_footer">
          <button className="admin_action_btn admin_action_btn--delete" onClick={onDelete} disabled={busy || !row}>
            🗑️ Delete Content
          </button>
          <button className="admin_action_btn admin_action_btn--dismiss" onClick={onDismiss} disabled={busy}>
            ✓ Dismiss Report
          </button>
          <button className="admin_action_btn admin_action_btn--review" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPreviewModal;