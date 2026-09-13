import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export const formatViews = (n) => {
  if (!n || n === 0) return "0 views";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M views";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K views";
  return n + " views";
};

export const formatTimeAgo = (dateString) => {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return diffMin + (diffMin === 1 ? " minute ago" : " minutes ago");
  if (diffHour < 24) return diffHour + (diffHour === 1 ? " hour ago" : " hours ago");
  if (diffDay < 30) return diffDay + (diffDay === 1 ? " day ago" : " days ago");
  if (diffMonth < 12) return diffMonth + (diffMonth === 1 ? " month ago" : " months ago");
  return diffYear + (diffYear === 1 ? " year ago" : " years ago");
};

export const buildShareUrl = (contentType, contentId) =>
  `https://zixplon.in/api/og?type=${contentType}&id=${contentId}`;

export const shareContent = ({ contentType, contentId, title, text }) => {
  const url = buildShareUrl(contentType, contentId);
  if (navigator.share) {
    navigator
      .share({ title: title || "Zixplon", text: text || title || "Check this out on Zixplon", url })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(url);
    alert("Link copied!");
  }
};

export const REPORT_REASONS = [
  "Spam or misleading",
  "Nudity or sexual content",
  "Violent or graphic content",
  "Harassment or bullying",
  "Hate speech or symbols",
  "False information",
  "Copyright infringement",
  "Something else",
];

const DropdownPortal = ({ wrapperRef, menuRef, children }) => {
  const [style, setStyle] = useState({});

  React.useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const recalc = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const menuWidth = 230;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > vw - 8) left = vw - menuWidth - 8;
      let top = rect.bottom + 6;
      const estimatedHeight = 220;
      if (top + estimatedHeight > vh - 8) top = rect.top - estimatedHeight - 6;
      setStyle({ position: "fixed", top: top + "px", left: left + "px", width: menuWidth + "px", zIndex: 99999 });
    };
    recalc();
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [wrapperRef]);

  return createPortal(<div ref={menuRef} style={style}>{children}</div>, document.body);
};

// Generic "⋮" button + dropdown — shared by every card type, everywhere.
export const ThreeDotMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      const clickedWrapper = wrapperRef.current && wrapperRef.current.contains(e.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!clickedWrapper && !clickedMenu) setOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="save-menu-wrapper"
      style={{ position: "absolute", top: "8px", right: "8px", zIndex: 11 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        title="More options"
        style={{
          background: open ? "rgba(124,58,237,0.22)" : "rgba(0,0,0,0.55)",
          border: "none", color: "white", borderRadius: "8px",
          padding: "5px 6px", cursor: "pointer", display: "flex", alignItems: "center",
        }}
      >
        <span style={{ fontSize: 17, lineHeight: 1 }}>⋮</span>
      </button>

      {open && (
        <DropdownPortal wrapperRef={wrapperRef} menuRef={menuRef}>
          <div
            style={{
              minWidth: "230px", background: "#ffffff", borderRadius: "14px",
              boxShadow: "0 8px 32px rgba(76,69,137,0.28), 0 2px 8px rgba(0,0,0,0.14)",
              border: "1.5px solid #e0d4ff", overflow: "hidden",
            }}
          >
            {items.map((item, idx) => (
              <button
                key={item.id}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { item.onClick(e); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "10px",
                  padding: "11px 16px", background: item.active ? "#f7f0ff" : "transparent",
                  border: "none",
                  borderTop: idx === items.length - 1 && item.danger ? "1px solid #fee2e2" : idx > 0 ? "1px solid #f5f0ff" : "none",
                  color: item.danger ? "#ef4444" : "#1e1b4b",
                  fontSize: "14px", fontWeight: item.active ? "700" : "600",
                  fontFamily: "Outfit, sans-serif", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </DropdownPortal>
      )}
    </div>
  );
};

// Shared "Report this content" dialog — writes to the same `reports`
// table the rest of the app uses (content_type, content_id, reason,
// details, reporter_username, created_at).
export const ReportModal = ({ target, onClose, onSubmit, submitting }) => {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (target) { setReason(null); setDetails(""); }
  }, [target]);

  if (!target) return null;

  return createPortal(
    <div className="zx-report-overlay" onClick={onClose}>
      <div className="zx-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zx-report-header">
          <span>Report {target.contentType}</span>
          <button className="zx-report-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="zx-report-sub">
          {target.title ? `"${target.title}"` : "Help us understand what's wrong with this content."}
        </p>
        <div className="zx-report-reasons">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className={"zx-report-reason" + (reason === r ? " active" : "")}
              onClick={() => setReason(r)}
            >
              <span className="zx-report-radio">{reason === r && "✓"}</span>
              {r}
            </button>
          ))}
        </div>
        <textarea
          className="zx-report-details"
          placeholder="Add more details (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />
        <div className="zx-report-actions">
          <button type="button" className="zx-report-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="zx-report-submit"
            disabled={!reason || submitting}
            onClick={() => onSubmit(reason, details)}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};