import React, { useState, useRef, useEffect } from "react";

const RETRY_DELAYS = [800, 2000, 4000]; // ms before each retry

const withRetry = (url, n) =>
  n === 0 ? url : `${url}${url.includes("?") ? "&" : "?"}retry=${n}`;

const SafeImage = ({
  src,
  fallbackSrc,
  alt = "",
  className,
  style,
  fallbackStyle,
  hideOnFail = false,
}) => {
  const fresh = { src, attempt: 0, fb: false, failed: false };
  const [st, setSt] = useState(fresh);
  const cur = st.src === src ? st : fresh; // new src starts clean
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleError = () => {
    if (cur.attempt < RETRY_DELAYS.length) {
      timer.current = setTimeout(
        () => setSt({ ...cur, src, attempt: cur.attempt + 1 }),
        RETRY_DELAYS[cur.attempt],
      );
    } else if (fallbackSrc && !cur.fb) {
      setSt({ src, attempt: 0, fb: true, failed: false });
    } else {
      setSt({ ...cur, src, failed: true });
    }
  };

  const retryNow = (e) => {
    e.stopPropagation();
    setSt({ src, attempt: 0, fb: false, failed: false });
  };

  if (!src || cur.failed) {
    if (hideOnFail) return null;
    return (
      <div
        className={className}
        onClick={src ? retryNow : undefined}
        title={src ? "Tap to retry" : undefined}
        style={{
          ...style, minHeight: 140, display: "flex", alignItems: "center",
          justifyContent: "center", background: "#fef2f2", color: "#b08585",
          fontSize: 13, fontWeight: 700, cursor: src ? "pointer" : "default",
          ...fallbackStyle,
        }}
      >
        🖼️ Image unavailable{src ? " · tap to retry" : ""}
      </div>
    );
  }

  const base = cur.fb ? fallbackSrc : src;

  return (
    <img
      src={withRetry(base, cur.attempt)}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
};

export default SafeImage;