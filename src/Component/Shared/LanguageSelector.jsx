import React, { useState, useEffect } from "react";
import {
  LANGUAGES,
  getLangPreference,
  setLangPreference,
  subscribeLangPreference,
} from "../../utils/languagePreference";

// A small "Language" dropdown. Drop it into a settings page, the profile
// menu, or the side navbar:
//
//   <LanguageSelector />
//
// Options: Auto (follow the device language), English only, or one of the
// regional languages. It reuses the existing `.pf-privacy-select` styling
// from PostFeed.css; pass `className` to restyle it.
const LanguageSelector = ({ className = "pf-privacy-select", label = "Language · भाषा" }) => {
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

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "'Nunito', sans-serif",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span>🌐 {label}</span>
      <select className={className} value={value} onChange={onChange}>
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