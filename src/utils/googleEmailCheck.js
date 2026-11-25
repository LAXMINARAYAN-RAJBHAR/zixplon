// Key used to remember which email the user typed before the Google redirect
export const EXPECTED_GOOGLE_EMAIL_KEY = "zx_expected_google_email";

/**
 * Call AFTER the Google OAuth redirect.
 * Returns { mismatch, expected, actual }. Reads the saved email once,
 * then clears it.
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
    mismatch: Boolean(expected && actual && expected !== actual),
    expected,
    actual,
  };
};