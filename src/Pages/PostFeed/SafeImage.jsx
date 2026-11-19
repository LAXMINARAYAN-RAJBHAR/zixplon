import React, { useState } from "react";

const SafeImage = ({ src, alt = "", className, style, hideOnFail = false }) => {
  const [tries, setTries] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (hideOnFail) return null;
    return (
      <div
        className={className}
        style={{
          ...style, minHeight: 140, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#fef2f2", color: "#b08585",
          fontSize: 13, fontWeight: 700,
        }}
      >
        🖼️ Image unavailable
      </div>
    );
  }

  return (
    <img
      src={tries === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${tries}`}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => (tries < 1 ? setTries(tries + 1) : setFailed(true))}
    />
  );
};

export default SafeImage;