// Tiny i18n layer for Zixplon — no extra packages.
//
//   const { t } = useT();
//   t("post.like")                         → "Like" / "पसंद करें" / "लाईक"
//   t("time.minutesAgo", { n: 5 })         → "5m ago" / "5 मि. पहले" / …
//
// Language comes from utils/languagePreference (the <LanguageSelector />
// dropdown): an explicit choice wins, otherwise the phone / browser language,
// otherwise English. A language with no locale file yet, or a key missing from
// a locale file, falls back to English, so nothing ever shows as blank.
//
// To add a language: create locales/<code>.js (copy en.js), import it below,
// add it to LOCALES.

import { useState, useEffect, useCallback } from "react";
import {
  getLangPreference,
  subscribeLangPreference,
} from "../utils/languagePreference";
import en from "./locales/en";
import hi from "./locales/hi";
import mr from "./locales/mr";
import bn from "./locales/bn";
import gu from "./locales/gu";
import ta from "./locales/ta";
import te from "./locales/te";
import kn from "./locales/kn";
import ml from "./locales/ml";
import pa from "./locales/pa";
import or from "./locales/or";
import asm from "./locales/as"; // `as` is a reserved word, so it is imported as `asm`
import ur from "./locales/ur";

// Keys MUST match the `code` values in LANGUAGES (utils/languagePreference.js).
const LOCALES = {
  en,
  hi,
  mr,
  bn,
  gu,
  ta,
  te,
  kn,
  ml,
  pa,
  or,
  as: asm,
  ur,
};

// Languages written right-to-left.
const RTL_LANGS = new Set(["ur"]);

const baseCode = (code) => String(code || "").toLowerCase().split("-")[0];

export const resolveLang = () => {
  const pref = getLangPreference();
  if (pref && pref !== "auto") {
    const code = baseCode(pref);
    return LOCALES[code] ? code : "en";
  }
  if (typeof navigator !== "undefined") {
    const list = Array.isArray(navigator.languages)
      ? navigator.languages
      : [navigator.language];
    for (const c of list) {
      const code = baseCode(c);
      if (LOCALES[code]) return code;
    }
  }
  return "en";
};

export const translate = (lang, key, vars) => {
  const raw = (LOCALES[lang] && LOCALES[lang][key]) ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : ""
  );
};

// React hook: returns { t, lang } and re-renders whenever the language
// preference changes, so every mounted component switches at once.
export const useT = () => {
  const [lang, setLang] = useState(resolveLang);

  useEffect(
    () => subscribeLangPreference(() => setLang(resolveLang())),
    []
  );

  // Keep <html lang> and text direction in step with the language
  // (Urdu is right-to-left).
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  return { t, lang };
};

export default useT;