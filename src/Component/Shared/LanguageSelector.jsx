import React, { useState, useEffect } from "react";
import {
  LANGUAGES,
  getLangPreference,
  setLangPreference,
  subscribeLangPreference,
} from "../../utils/languagePreference";

// Compact language picker. The real <select> sits invisibly on top of what
// you see, so tapping it opens the native dropdown (desktop + mobile).
//
//   <LanguageSelector iconOnly />   → just a small 🌐 circle (takes no row)
//   <LanguageSelector />            → a "🌐 EN ▼" pill
//
// Options: Auto (follow the device language), English only, or one of the
// regional languages.

// "বাংলা (Bengali)" -> "বাংলা"
const nativeName = (label) => String(label || "").split(" (")[0].trim();

const shortLabel = (value) => {
  if (value === "auto") return "Auto";
  if (value === "en") return "EN";
  const lang = LANGUAGES.find((l) => l.code === value);
  return lang ? nativeName(lang.label) : "Auto";
};

const LanguageSelector = ({ className = "", iconOnly = false }) => {
  const [value, setValue] = useState(getLangPreference);

  // Stay in sync if the preference is changed elsewhere.
  useEffect(
    () => subscribeLangPreference(() => setValue(getLangPreference())),
    []
  );

  const onChange = (e) => {
    setValue(e.target.value);
    setLangPreference(e.target.value);
  };

  const shell = iconOnly
    ? {
        width: 34,
        height: 34,
        justifyContent: "center",
        borderRadius: "50%",
        fontSize: 17,
        padding: 0,
      }
    : {
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
      };

  return (
    <label
      className={className}
      title={`Language · भाषा — ${shortLabel(value)}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        border: "1px solid #f3c6c6",
        background: "#fff",
        color: "#7a2e2e",
        fontFamily: "'Nunito', sans-serif",
        fontWeight: 700,
        lineHeight: 1.4,
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...shell,
      }}
    >
      <span aria-hidden="true">🌐</span>
      {!iconOnly && (
        <>
          <span>{shortLabel(value)}</span>
          <span aria-hidden="true" style={{ fontSize: 8, opacity: 0.6 }}>
            ▼
          </span>
        </>
      )}

      <select
        aria-label="Language"
        value={value}
        onChange={onChange}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          fontSize: 16, // avoids iOS zoom-on-focus
        }}
      >
        <option value="auto">Auto (device language)</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code === "en" ? "English only" : l.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSelector;