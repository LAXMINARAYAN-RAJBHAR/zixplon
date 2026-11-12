import React, { useState, useEffect } from "react";
import {
  getLangPreference,
  subscribeLangPreference,
} from "../../utils/languagePreference";

// Facebook-style inline "Are you interested in this post?" card.
// Renders INSIDE the post card (under the media, above the action bar).
//
// LANGUAGE: shown as "<regional language> · English". The regional language
// follows the USER, not a fixed choice:
//   1. the `lang` prop, if given, else
//   2. the user's saved choice (utils/languagePreference, set by the
//      <LanguageSelector /> dropdown; "en" = English only), else
//   3. the first supported non-English language in the browser/phone
//      language list (navigator.languages), else
//   4. English only.
// Supported codes: mr hi gu bn ta te kn ml pa or as ur
//
// ⚠ Have a native speaker of each language review these strings before
// shipping — short UI labels are easy to get subtly wrong.
//
// Props:
//   lang?               — language code override, e.g. "hi"
//   onInterested()      — "Interested" tapped
//   onNotInterested()   — "Not interested" tapped
//   onUndo(answer)      — Undo tapped ("interested" | "not_interested")
//   onDismiss()         — optional: ✕ on the thank-you line

const STRINGS = {
  en: {
    question: "Are you interested in this post?",
    yes: "Interested",
    no: "Not interested",
    thanks: "Thanks for your feedback",
    undo: "Undo",
  },
  mr: {
    question: "तुम्हाला या पोस्टमध्ये रुची आहे का?",
    yes: "रुची आहे",
    no: "रुची नाही",
    thanks: "धन्यवाद",
    undo: "पूर्ववत करा",
  },
  hi: {
    question: "क्या आपको इस पोस्ट में रुचि है?",
    yes: "रुचि है",
    no: "रुचि नहीं है",
    thanks: "धन्यवाद",
    undo: "पूर्ववत करें",
  },
  gu: {
    question: "શું તમને આ પોસ્ટમાં રસ છે?",
    yes: "રસ છે",
    no: "રસ નથી",
    thanks: "આભાર",
    undo: "પૂર્વવત્ કરો",
  },
  bn: {
    question: "আপনি কি এই পোস্টে আগ্রহী?",
    yes: "আগ্রহী",
    no: "আগ্রহী নই",
    thanks: "ধন্যবাদ",
    undo: "পূর্বাবস্থায় ফেরান",
  },
  ta: {
    question: "இந்த இடுகையில் உங்களுக்கு ஆர்வம் உள்ளதா?",
    yes: "ஆர்வம் உள்ளது",
    no: "ஆர்வம் இல்லை",
    thanks: "நன்றி",
    undo: "செயல்தவிர்",
  },
  te: {
    question: "ఈ పోస్ట్‌పై మీకు ఆసక్తి ఉందా?",
    yes: "ఆసక్తి ఉంది",
    no: "ఆసక్తి లేదు",
    thanks: "ధన్యవాదాలు",
    undo: "రద్దు చేయి",
  },
  kn: {
    question: "ಈ ಪೋಸ್ಟ್‌ನಲ್ಲಿ ನಿಮಗೆ ಆಸಕ್ತಿ ಇದೆಯೇ?",
    yes: "ಆಸಕ್ತಿ ಇದೆ",
    no: "ಆಸಕ್ತಿ ಇಲ್ಲ",
    thanks: "ಧನ್ಯವಾದಗಳು",
    undo: "ರದ್ದುಮಾಡಿ",
  },
  ml: {
    question: "ഈ പോസ്റ്റിൽ നിങ്ങൾക്ക് താൽപ്പര്യമുണ്ടോ?",
    yes: "താൽപ്പര്യമുണ്ട്",
    no: "താൽപ്പര്യമില്ല",
    thanks: "നന്ദി",
    undo: "പഴയപടിയാക്കുക",
  },
  pa: {
    question: "ਕੀ ਤੁਹਾਨੂੰ ਇਸ ਪੋਸਟ ਵਿੱਚ ਦਿਲਚਸਪੀ ਹੈ?",
    yes: "ਦਿਲਚਸਪੀ ਹੈ",
    no: "ਦਿਲਚਸਪੀ ਨਹੀਂ",
    thanks: "ਧੰਨਵਾਦ",
    undo: "ਅਣਡੂ ਕਰੋ",
  },
  or: {
    question: "ଏହି ପୋଷ୍ଟରେ ଆପଣଙ୍କର ଆଗ୍ରହ ଅଛି କି?",
    yes: "ଆଗ୍ରହ ଅଛି",
    no: "ଆଗ୍ରହ ନାହିଁ",
    thanks: "ଧନ୍ୟବାଦ",
    undo: "ପୂର୍ବବତ୍ କରନ୍ତୁ",
  },
  as: {
    question: "আপুনি এই পোষ্টটোত আগ্ৰহী নে?",
    yes: "আগ্ৰহী",
    no: "আগ্ৰহী নহয়",
    thanks: "ধন্যবাদ",
    undo: "পূৰ্বাৱস্থালৈ ঘূৰাওক",
  },
  ur: {
    question: "کیا آپ کو اس پوسٹ میں دلچسپی ہے؟",
    yes: "دلچسپی ہے",
    no: "دلچسپی نہیں ہے",
    thanks: "شکریہ",
    undo: "واپس کریں",
  },
};

// Right-to-left languages (their text is isolated so it doesn't scramble
// the " · English" part of the line).
const RTL_LANGS = new Set(["ur"]);

const baseCode = (code) => String(code || "").toLowerCase().split("-")[0];

// Returns a supported NON-English code, or null (→ English only).
const detectRegionalLang = (override) => {
  // 1. An explicit choice (prop, or the saved preference) always wins —
  //    including "en", which means "English only, ignore the device language".
  const explicit = override || getLangPreference();
  if (explicit && explicit !== "auto") {
    const code = baseCode(explicit);
    if (code === "en") return null;
    if (STRINGS[code]) return code;
  }

  // 2. Otherwise follow the phone / browser language list.
  const candidates = [];
  if (typeof navigator !== "undefined") {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    else if (navigator.language) candidates.push(navigator.language);
  }
  for (const c of candidates) {
    const code = baseCode(c);
    if (code !== "en" && STRINGS[code]) return code;
  }
  return null;
};

// "<regional> · English", or just English when there is no regional match.
// RTL text is wrapped in Unicode isolates (U+2067 … U+2069) so it keeps its
// own direction inside the left-to-right line.
const both = (regional, key) => {
  if (!regional) return STRINGS.en[key];
  const native = STRINGS[regional][key];
  const shown = RTL_LANGS.has(regional) ? `\u2067${native}\u2069` : native;
  return `${shown} · ${STRINGS.en[key]}`;
};

const InlineInterestPrompt = ({ lang, onInterested, onNotInterested, onUndo, onDismiss }) => {
  const [answer, setAnswer] = useState(null); // null | "interested" | "not_interested"
  // Re-render when the user changes their language preference.
  const [, bump] = useState(0);
  useEffect(() => subscribeLangPreference(() => bump((n) => n + 1)), []);
  const regional = detectRegionalLang(lang);

  const choose = (value) => {
    setAnswer(value);
    if (value === "interested") onInterested?.();
    else onNotInterested?.();
  };

  const undo = () => {
    const previous = answer;
    setAnswer(null);
    onUndo?.(previous);
  };

  if (answer) {
    return (
      <div className="pf-interest pf-interest--done" role="status">
        <div className="pf-interest-done-text">
          <b>{both(regional, "thanks")}</b>
        </div>
        <div className="pf-interest-done-actions">
          <button type="button" className="pf-interest-undo" onClick={undo}>
            {both(regional, "undo")}
          </button>
          {onDismiss && (
            <button
              type="button"
              className="pf-interest-close"
              onClick={onDismiss}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-interest" role="group" aria-label="Post feedback">
      <p className="pf-interest-question">{both(regional, "question")}</p>
      <button
        type="button"
        className="pf-interest-btn"
        onClick={() => choose("interested")}
      >
        {both(regional, "yes")}
      </button>
      <button
        type="button"
        className="pf-interest-btn"
        onClick={() => choose("not_interested")}
      >
        {both(regional, "no")}
      </button>
    </div>
  );
};

export default InlineInterestPrompt;