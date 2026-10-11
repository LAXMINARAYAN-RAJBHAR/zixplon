import { useEffect, useState } from "react";

let deferredPrompt = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

export function useInstallPrompt() {
  const [, force] = useState(0);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    return () => listeners.delete(update);
  }, []);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  const install = async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    force((n) => n + 1);
    return outcome; // "accepted" | "dismissed"
  };

  return {
    canInstall: !!deferredPrompt,
    isInstalled: isStandalone,
    isIOS,
    install,
  };
}