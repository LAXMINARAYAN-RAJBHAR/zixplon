import { supabase } from "../config/supabase";

const DEVICE_KEY = "zixplon_device_id";
const LAST_OPEN_KEY = "zixplon_last_open_logged";

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function getPlatform() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac/i.test(ua)) return "mac";
  if (/linux/i.test(ua)) return "linux";
  return "other";
}

export async function logInstallEvent(event) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await supabase.from("pwa_installs").insert([
      {
        device_id: getDeviceId(),
        event,
        user_id: session?.user?.id ?? null,
        platform: getPlatform(),
        user_agent: navigator.userAgent.slice(0, 300),
      },
    ]);
  } catch {
    // Tracking must never break the app
  }
}

// Logs one "standalone_open" per device per day, only when the app is
// running as an installed app (not in a normal browser tab).
export function trackStandaloneOpen() {
  try {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (!isStandalone) return;

    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LAST_OPEN_KEY) === today) return;
    localStorage.setItem(LAST_OPEN_KEY, today);

    logInstallEvent("standalone_open");
  } catch {}
}