// src/utils/deviceFeatures.js
// Small, dependency-free helpers for browser device features. Every helper
// feature-detects first and fails quietly, so callers can simply hide a
// button when the device can't do something.
import { useEffect } from "react";

// True on phones/tablets (coarse pointer). Used to show the 📷 button only
// where "capture" actually opens the camera.
export const isTouchDevice = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0));

// ── Vibration (Android browsers; silently ignored elsewhere) ──
export const vibrate = (pattern = 80) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* no-op */
  }
};

// ── Web Share ──
export const canShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

// Opens the native share sheet. Falls back to copying the text/link.
// Returns true if something was shared or copied.
export const shareContent = async ({ title, text, url } = {}) => {
  try {
    if (canShare()) {
      await navigator.share({ title, text, url });
      return true;
    }
    const fallback = [text, url].filter(Boolean).join(" ");
    if (fallback && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(fallback);
      return true;
    }
  } catch (err) {
    // AbortError = user closed the share sheet; not a failure.
    if (err?.name !== "AbortError") console.warn("Share failed:", err);
  }
  return false;
};

// ── Contact Picker (Android Chrome only) ──
export const canPickContacts = () =>
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  typeof window !== "undefined" &&
  "ContactsManager" in window;

// Resolves to [{ name: [], tel: [] }, ...] — empty if the user cancels.
export const pickContacts = async () => {
  try {
    return await navigator.contacts.select(["name", "tel"], { multiple: true });
  } catch {
    return [];
  }
};

// ── Clipboard: files (screenshots / copied images) from a paste event ──
export const getClipboardFiles = (e) =>
  Array.from(e?.clipboardData?.files || []).filter(Boolean);

// ── Screen Wake Lock: keeps the screen on while `active` is true ──
// Re-acquires the lock when the tab becomes visible again (browsers
// release it automatically when the tab is hidden).
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return undefined;
    }
    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied / unsupported / low battery — not critical */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}

// Distance in metres between two lat/lng points (haversine).
export const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};