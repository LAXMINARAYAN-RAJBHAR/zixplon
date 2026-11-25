import React, { useState, useEffect, useCallback, useRef } from "react";
import "./login.css";
import { Link } from "react-router-dom";
import { supabase } from "../../config/supabase";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { EXPECTED_GOOGLE_EMAIL_KEY } from "../../utils/googleEmailCheck";

/**
 * Call this AFTER the Google OAuth redirect, wherever you handle the session
 * (e.g. inside supabase.auth.onAuthStateChange in App.jsx).
 *
 * Returns { mismatch: boolean, expected: string, actual: string }.
 * If mismatch is true, show a message and (optionally) sign the user out.
 */
export const checkGoogleEmailMatch = (session) => {
  let expected = "";
  try {
    expected = (sessionStorage.getItem(EXPECTED_GOOGLE_EMAIL_KEY) || "")
      .trim()
      .toLowerCase();
    sessionStorage.removeItem(EXPECTED_GOOGLE_EMAIL_KEY); // one-time check
  } catch (_) {}

  const actual = (session?.user?.email || "").trim().toLowerCase();

  return {
    mismatch: Boolean(expected && actual && expected !== actual),
    expected,
    actual,
  };
};

const Login = ({ setLoginModal, onLoginSuccess }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Refs to always read latest values (fixes stale closure on mobile) ──
  const emailRef = useRef(email);
  const passwordRef = useRef(password);
  useEffect(() => { emailRef.current = email; }, [email]);
  useEffect(() => { passwordRef.current = password; }, [password]);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, []);

  // ── Ask the database which provider this email uses ────────────────────
  // Needs the `auth_provider_for` SQL function (see instructions).
  // If the function doesn't exist or fails, we return "unknown" and show
  // the generic message — we never guess.
  const getAuthProvider = async (emailToCheck) => {
    try {
      const { data, error: rpcErr } = await supabase.rpc("auth_provider_for", {
        p_email: emailToCheck,
      });
      if (rpcErr) return "unknown";
      return data || "unknown"; // 'google' | 'email' | 'none' | other
    } catch (_) {
      return "unknown";
    }
  };

  const handleLogin = useCallback(async () => {
    // Read from refs — guaranteed fresh even on mobile tap lag
    const currentEmail = emailRef.current.trim();
    const currentPassword = passwordRef.current;

    if (!currentEmail || !currentPassword) {
      return setError("Please enter email and password.");
    }

    setLoading(true);
    setError("");
    setErrorType("");

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });

      if (err) {
        setLoading(false);
        const msg = err.message?.toLowerCase() || "";

        if (
          err.code === "email_not_confirmed" ||
          msg.includes("email not confirmed")
        ) {
          setErrorType("unconfirmed");
          setError(
            "Your email is not confirmed yet. Please check your inbox and click the confirmation link."
          );
          return;
        }

        if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid_credentials") ||
          err.code === "invalid_credentials"
        ) {
          // ── Real provider check instead of guessing from the profiles table ──
          const provider = await getAuthProvider(currentEmail);

          if (provider === "google") {
            // Account exists and is Google-only (no email/password identity)
            setErrorType("google");
            setError(
              "This email is registered with Google. Please use 'Continue with Google' to sign in."
            );
          } else {
            // Wrong password, unregistered email, or unknown — same message
            // for all of them, so we don't reveal which emails have accounts.
            setErrorType("generic");
            setError(
              "Incorrect email or password. If you signed up with Google, use 'Continue with Google'."
            );
          }
          return;
        }

        setErrorType("generic");
        setError(err.message || "Login failed. Please try again.");
        return;
      }

      const user = data.user;
      if (!user) {
        setLoading(false);
        setErrorType("generic");
        return setError("Login failed. Please try again.");
      }

      // ── Profile fetch ───────────────────────────────────────────────────
      let profileRow = null;
      try {
        const { data: pData } = await supabase
          .from("profiles")
          .select("username, profile_pic, about")
          .eq("id", user.id)
          .maybeSingle();
        profileRow = pData;
      } catch (_) {}

      const name =
        profileRow?.username ||
        user.user_metadata?.channelName ||
        user.user_metadata?.username ||
        currentEmail.split("@")[0];

      const pic =
        profileRow?.profile_pic ||
        user.user_metadata?.profilePic ||
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        "";

      const about = profileRow?.about || user.user_metadata?.about || "";

      // Clear then set — prevents stale key bleed
      ["username","userId","email","profilePic","about","channelName","userName"]
        .forEach(k => localStorage.removeItem(k));

      localStorage.setItem("username", name);
      localStorage.setItem("email", currentEmail);
      localStorage.setItem("userId", user.id);
      if (pic) localStorage.setItem("profilePic", pic);
      if (about) localStorage.setItem("about", about);

      setLoading(false);
      onLoginSuccess(name, user);
      setLoginModal();
    } catch (e) {
      setLoading(false);
      setErrorType("generic");
      setError("Something went wrong. Please try again.");
    }
  }, [onLoginSuccess, setLoginModal]); // email/password are read from refs

  const handleForgot = useCallback(async () => {
    const currentEmail = emailRef.current.trim();
    if (!currentEmail) return setError("Please enter your email.");
    setLoading(true);
    setError("");
    setErrorType("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo: window.location.origin + "/#/reset-password",
      });
      setLoading(false);
      if (err) return setError(err.message);
      setSuccess("Password reset email sent! Check your inbox.");
    } catch (e) {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setError("");
    setErrorType("");

    const typedEmail = emailRef.current.trim();

    // Remember the typed email so it can be compared after the redirect
    try {
      if (typedEmail) {
        sessionStorage.setItem(EXPECTED_GOOGLE_EMAIL_KEY, typedEmail);
      } else {
        sessionStorage.removeItem(EXPECTED_GOOGLE_EMAIL_KEY);
      }
    } catch (_) {}

    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/",
          queryParams: {
            // Pre-selects (or prompts to add) the email the user typed
            ...(typedEmail && { login_hint: typedEmail }),
            // Always let the user pick/add an account; remove this line if you
            // want Google to go straight to the hinted account.
            prompt: "select_account",
          },
        },
      });
      if (oauthErr) {
        setErrorType("generic");
        setError(oauthErr.message);
      }
    } catch (e) {
      setErrorType("generic");
      setError("Google login failed. Please try again.");
    }
  }, []);

  // ── Use onPointerDown on overlay to prevent mobile tap-through ──────────
  const handleOverlayPointerDown = useCallback(
    (e) => {
      if (e.target === e.currentTarget) setLoginModal();
    },
    [setLoginModal]
  );

  return (
    <div
      className="login"
      onPointerDown={handleOverlayPointerDown}
    >
      <div className="login_card" onPointerDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="titleCard_login">
          <div style={{
            background: "#ff0000",
            borderRadius: "8px",
            padding: "4px 10px",
            fontWeight: "800",
            color: "white",
            fontSize: "20px",
          }}>Z</div>
          {mode === "forgot" ? "Reset Password" : "Login"}
        </div>

        {/* Mode Tabs */}
        <div className="login_tab_bar">
          {["login", "forgot"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setErrorType("");
                setSuccess("");
                setShowPassword(false);
              }}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                color: mode === m ? "#7c3aed" : "#9ca3af",
                fontWeight: mode === m ? "700" : "400",
                fontSize: "14px",
                padding: "8px",
                cursor: "pointer",
                borderBottom: mode === m ? "2px solid #7c3aed" : "2px solid transparent",
              }}
            >
              {m === "login" ? "Sign In" : "Forgot Password"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="loginCredentials">
          <input
            className="userNameLoginUserName"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); setErrorType(""); }}
            onBlur={(e) => { emailRef.current = e.target.value.trim(); }}
            placeholder="Email Address"
            type="email"
            autoComplete="email"
            inputMode="email"
          />
          {mode === "login" && (
            <div className="password_input_wrapper">
              <input
                className="userNameLoginUserName"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); setErrorType(""); }}
                onBlur={(e) => { passwordRef.current = e.target.value; }}
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                type="button"
                className="password_toggle_btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <VisibilityOff sx={{ fontSize: "20px" }} />
                ) : (
                  <Visibility sx={{ fontSize: "20px" }} />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="login_feedback login_feedback--error"
            style={{
              background:
                errorType === "google" ? "#fff3e0"
                : errorType === "unconfirmed" ? "#e8f4fd"
                : "#fef2f2",
              borderLeft: `4px solid ${
                errorType === "google" ? "#f97316"
                : errorType === "unconfirmed" ? "#3b82f6"
                : "#ef4444"
              }`,
              color:
                errorType === "google" ? "#c2410c"
                : errorType === "unconfirmed" ? "#1d4ed8"
                : "#dc2626",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              lineHeight: "1.5",
            }}
          >
            {errorType === "google" && (
              <>
                <div style={{ fontWeight: "700", marginBottom: "4px" }}>
                  🔑 Google Account Detected
                </div>
                <div>{error}</div>
                <button
                  onClick={handleGoogleLogin}
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "7px 14px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    color: "#374151",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Sign in with Google instead
                </button>
              </>
            )}
            {errorType === "unconfirmed" && (
              <>
                <div style={{ fontWeight: "700", marginBottom: "4px" }}>📧 Email Not Confirmed</div>
                <div>{error}</div>
              </>
            )}
            {(errorType === "generic" || !errorType) && <>❌ {error}</>}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="login_feedback login_feedback--success">✅ {success}</div>
        )}

        {/* Buttons */}
        <div className="login_buttons">
          <button
            onClick={mode === "login" ? handleLogin : handleForgot}
            disabled={loading}
            className="login_btn_primary"
            style={{
              background: loading ? "#c4b5fd" : "#7c3aed",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Send Reset Email"}
          </button>

          <button onClick={handleGoogleLogin} className="login_btn_google">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div className="login_btn_row">
            <Link to="/signup" onClick={setLoginModal} className="login_btn_signup">
              Sign Up
            </Link>
            <button onClick={setLoginModal} className="login_btn_cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;