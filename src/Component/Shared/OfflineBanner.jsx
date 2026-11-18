import React, { useEffect, useState } from "react";

// Small bar shown at the bottom while the user has no connection, plus an
// "Update available" bar when a new version of the site has been downloaded.
// Render <OfflineBanner /> once, e.g. at the bottom of App.js.

export const useOnline = () => {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
};

const bar = {
  position: "fixed",
  left: "50%",
  bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", // above the mobile nav
  transform: "translateX(-50%)",
  zIndex: 100005,
  display: "flex",
  alignItems: "center",
  gap: 12,
  maxWidth: "calc(100vw - 24px)",
  padding: "10px 16px",
  borderRadius: 999,
  color: "#fff",
  fontFamily: "'Nunito', sans-serif",
  fontSize: 13,
  fontWeight: 700,
  boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
};

const OfflineBanner = () => {
  const online = useOnline();
  const [waitingWorker, setWaitingWorker] = useState(null);

  // index.js dispatches this when a new service worker is waiting.
  useEffect(() => {
    const onUpdate = (e) => setWaitingWorker(e.detail);
    window.addEventListener("zx:sw-update", onUpdate);
    return () => window.removeEventListener("zx:sw-update", onUpdate);
  }, []);

  const applyUpdate = () => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    waitingWorker?.addEventListener("statechange", (e) => {
      if (e.target.state === "activated") window.location.reload();
    });
  };

  if (!online) {
    return (
      <div style={{ ...bar, background: "rgba(26,20,20,0.92)" }} role="status">
        <span>📡 You're offline — showing saved content</span>
      </div>
    );
  }

  if (waitingWorker) {
    return (
      <div style={{ ...bar, background: "#dc2626" }} role="status">
        <span>New version available</span>
        <button
          type="button"
          onClick={applyUpdate}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "6px 14px",
            background: "#fff",
            color: "#dc2626",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Update
        </button>
      </div>
    );
  }

  return null;
};

export default OfflineBanner;