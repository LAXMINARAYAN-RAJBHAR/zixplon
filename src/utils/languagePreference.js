// Language preference — one place that stores and reads the user's chosen
// language, so any component can follow it.
//
//   "auto"  (nothing stored) → follow the phone / browser language
//   "en"                     → English only
//   "mr", "hi", …            → that regional language (+ English)
//
// Stored in localStorage under "zx_lang". Changing it fires a window event,
// so components that subscribe (see subscribeLangPreference) update at once —
// every visible post card switches language without a reload.

const KEY = "zx_lang";
const EVENT = "zx:lang-change";

// Native names, so people can find their own language.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "or", label: "ଓଡ଼ିଆ (Odia)" },
  { code: "as", label: "অসমীয়া (Assamese)" },
  { code: "ur", label: "اردو (Urdu)" },
];

// "auto" when nothing is stored.
export const getLangPreference = () => {
  try {
    return localStorage.getItem(KEY) || "auto";
  } catch (_) {
    return "auto";
  }
};

export const setLangPreference = (code) => {
  try {
    if (!code || code === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, code);
  } catch (_) { }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { code } }));
};

// Calls `callback` whenever the preference changes (in this tab, or in
// another tab). Returns an unsubscribe function.
export const subscribeLangPreference = (callback) => {
  const onStorage = (e) => {
    if (e.key === KEY || e.key === null) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
};