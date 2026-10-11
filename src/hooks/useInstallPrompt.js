import { useEffect, useState } from "react";

const INSTALLED_KEY = "zixplon_pwa_installed";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // The browser only offers install when the app is NOT installed
    try {
      localStorage.removeItem(INSTALLED_KEY);
    } catch {}
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch {}
    notify();
  });
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  const [relatedInstalled, setRelatedInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);

    // Give the browser a moment to fire beforeinstallprompt before
    // deciding that install isn't available.
    const timer = setTimeout(() => setReady(true), 2500);

    // Detects an already-installed copy (Chrome/Edge) when the manifest
    // declares itself in related_applications.
    if (navigator.getInstalledRelatedApps) {
      navigator
        .getInstalledRelatedApps()
        .then((apps) => setRelatedInstalled(apps.length > 0))
        .catch(() => {});
    }

    return () => {
      listeners.delete(update);
      clearTimeout(timer);
    };
  }, []);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true);

  let flagInstalled = false;
  try {
    flagInstalled = localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {}

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
    installedInBrowser: !deferredPrompt && (relatedInstalled || flagInstalled),
    ready,
    isIOS,
    install,
  };
}