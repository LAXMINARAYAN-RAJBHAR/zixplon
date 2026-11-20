import React, { useState } from "react";

const SafeImage = ({ src, alt = "", className, style, fallbackStyle, hideOnFail = false }) => {
  // State is keyed to the src it belongs to, so a new src starts fresh.
  const [state, setState] = useState({ src, tries: 0, failed: false });
  const cur = state.src === src ? state : { src, tries: 0, failed: false };

  if (!src || cur.failed) {
    if (hideOnFail) return null;
    return (
      <div
        className={className}
        style={{
          ...style, minHeight: 140, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#fef2f2", color: "#b08585",
          fontSize: 13, fontWeight: 700, ...fallbackStyle,
        }}
      >
        🖼️ Image unavailable
      </div>
    );
  }

  return (
    <img
      src={cur.tries === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${cur.tries}`}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() =>
        setState(
          cur.tries < 1
            ? { src, tries: cur.tries + 1, failed: false }
            : { src, tries: cur.tries, failed: true },
        )
      }
    />
  );
};

export default SafeImage;