import { useState, useEffect, useRef } from "react";

/**
 * "⋯" menu with Interested / Not interested for a single card.
 * `fb` is the object returned by useContentFeedback(type) in the parent feed.
 */
export default function FeedbackMenu({ id, fb }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const interested = fb.feedbackOf(id) === "interested";

  // Close when clicking / tapping outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="More options"
        aria-expanded={open}
        style={triggerStyle}
      >
        ⋯
      </button>

      {open && (
        <div role="menu" style={menuStyle} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            role="menuitem"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              fb.toggleInterested(id);
            }}
          >
            {interested ? "✓ Interested" : "👍 Interested"}
          </button>
          <button
            type="button"
            role="menuitem"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              fb.markNotInterested(id); // feed filters it out via fb.isHidden
            }}
          >
            🚫 Not interested
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Render ONCE per feed (not per card) so the message and Undo button
 * stay visible even after the hidden card has been removed from the list.
 */
export function FeedbackToast({ fb }) {
  if (!fb.toast) return null;
  const { message, undoId } = fb.toast;
  return (
    <div role="status" style={toastStyle}>
      <span>{message}</span>
      {undoId != null && (
        <button type="button" style={undoStyle} onClick={() => fb.undoNotInterested(undoId)}>
          Undo
        </button>
      )}
    </div>
  );
}

const triggerStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 20,
  lineHeight: 1,
  padding: "2px 8px",
  color: "inherit",
};

const menuStyle = {
  position: "absolute",
  right: 0,
  top: "100%",
  zIndex: 1000,
  background: "#222",
  color: "#fff",
  borderRadius: 8,
  minWidth: 180,
  overflow: "hidden",
  boxShadow: "0 4px 16px rgba(0,0,0,.5)",
};

const itemStyle = {
  display: "block",
  width: "100%",
  padding: "12px 16px",
  textAlign: "left",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontSize: 14,
};

const toastStyle = {
  position: "fixed",
  bottom: 80,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#333",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 8,
  zIndex: 999999,
  display: "flex",
  alignItems: "center",
  gap: 14,
  fontSize: 13,
  boxShadow: "0 4px 16px rgba(0,0,0,.4)",
};

const undoStyle = {
  background: "none",
  border: "none",
  color: "#60a5fa",
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  fontSize: 13,
};