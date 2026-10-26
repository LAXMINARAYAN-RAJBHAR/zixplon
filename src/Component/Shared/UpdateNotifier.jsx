import React, { useEffect, useState, useCallback } from "react";
import { BUILD_ID } from "../../buildInfo";
import "./UpdateNotifier.css";

const CHECK_EVERY_MS = 5 * 60 * 1000; // 5 minutes
const DISMISS_KEY = "zx_update_dismissed";

const UpdateNotifier = () => {
  const [newId, setNewId] = useState(null);

  const check = useCallback(async () => {
    if (BUILD_ID === "dev") return; // nothing to compare against locally
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.id || data.id === BUILD_ID) return;
      if (sessionStorage.getItem(DISMISS_KEY) === data.id) return;
      setNewId(data.id);
    } catch {
      /* offline or blocked: try again next time */
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [check]);

  const handleRefresh = async () => {
    try {
      // Clear any service worker / cache storage so the new files load
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore: reload anyway */
    }
    window.location.reload();
  };

  const handleLater = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, newId);
    } catch {
      /* ignore */
    }
    setNewId(null);
  };

  if (!newId) return null;

  return (
    <div className="zx-update-banner" role="status" aria-live="polite">
      <span className="zx-update-text">
        🚀 A new version of ZIXPLON is available.
      </span>
      <button type="button" className="zx-update-btn" onClick={handleRefresh}>
        Refresh
      </button>
      <button
        type="button"
        className="zx-update-later"
        onClick={handleLater}
        aria-label="Dismiss"
      >
        Later
      </button>
    </div>
  );
};

export default UpdateNotifier;