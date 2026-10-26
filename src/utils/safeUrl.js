// src/utils/safeUrl.js
//
// Turns whatever someone typed into a safe, clickable web address.
//  - "zixplon.in/abc"           -> "https://zixplon.in/abc"
//  - "https://example.com"      -> "https://example.com/"
//  - "javascript:alert(1)"      -> null  (only http / https are allowed)
//  - "hello"                    -> null  (needs a dot, like a real domain)
//
// Used when a story is created AND again when it is shown, so a bad value
// can never become a clickable link even if it got into the database.

export const normalizeLinkUrl = (raw) => {
  let value = (raw || "").trim();
  if (!value) return null;

  // No scheme typed -> assume https://
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = "https://" + value;

  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
};

// "https://www.example.com/page" -> "example.com"
export const linkDisplayHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};