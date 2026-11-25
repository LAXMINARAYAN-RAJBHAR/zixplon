// src/utils/googleEmailCheck.js

// Key used to remember which email the user typed before the Google redirect
export const EXPECTED_GOOGLE_EMAIL_KEY = "zx_expected_google_email";

// Gmail ignores dots and "+tag" suffixes, so treat those as the same account.
const normalizeEmail = (e) => {
  const v = (e || "").trim().toLowerCase();
  const [local, domain] = v.split("@");
  if (!domain) return v;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return local.split("+")[0].replace(/\./g, "") + "@gmail.com";
  }
  return v;
};

/**
 * Call AFTER the Google OAuth redirect.
 * Returns { mismatch, expected, actual }. Reads the saved email once,
 * then clears it. `expected` / `actual` are the raw (trimmed, lowercased)
 * values so they can be shown to the user.
 */
export const checkGoogleEmailMatch = (session) => {
  let expected = "";
  try {
    expected = (sessionStorage.getItem(EXPECTED_GOOGLE_EMAIL_KEY) || "")
      .trim()
      .toLowerCase();
    sessionStorage.removeItem(EXPECTED_GOOGLE_EMAIL_KEY);
  } catch (_) {}

  const actual = (session?.user?.email || "").trim().toLowerCase();

  return {
    mismatch: Boolean(
      expected && actual && normalizeEmail(expected) !== normalizeEmail(actual)
    ),
    expected,
    actual,
  };
};