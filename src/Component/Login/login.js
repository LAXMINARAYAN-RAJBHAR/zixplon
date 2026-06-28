import React, { useState, useEffect, useCallback } from "react";
import "./login.css";
import { Link } from "react-router-dom";
import { supabase } from "../../config/supabase";

const Login = ({ setLoginModal, onLoginSuccess }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
    setSuccess("");
  }, []);

  // Prevent body scroll while modal is open (important on mobile)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleLogin = useCallback(async () => {
    if (!email || !password) return setError("Please enter email and password.");
    setLoading(true);
    setError("");

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setLoading(false); return setError(err.message); }

    const user = data.user;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("username, profile_pic, about")
      .eq("id", user.id)
      .maybeSingle();

    // Prefer profile row username, fallback to metadata, fallback to email prefix
    const name =
      profileRow?.username ||
      user.user_metadata?.channelName ||
      user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split("@")[0];

    const pic =
      profileRow?.profile_pic ||
      user.user_metadata?.profilePic ||
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      "";

    const about =
      profileRow?.about ||
      user.user_metadata?.about ||
      "";

    // Clear all auth keys first
    ["username", "userId", "email", "profilePic", "about", "channelName", "userName"].forEach(
      (k) => localStorage.removeItem(k)
    );

    // Set with consistent keys
    localStorage.setItem("username", name);
    localStorage.setItem("channelName", name); // some components read channelName
    localStorage.setItem("email", email);
    localStorage.setItem("userId", user.id);
    if (pic) localStorage.setItem("profilePic", pic);
    if (about) localStorage.setItem("about", about);

    setLoading(false);
    onLoginSuccess(name, user);
    setLoginModal();
  }, [email, password, onLoginSuccess, setLoginModal]);

  const handleForgot = useCallback(async () => {
    if (!email) return setError("Please enter your email.");
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) return setError(err.message);
    setSuccess("Password reset email sent! Check your inbox.");
  }, [email]);

  const handleGoogleLogin = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://zixplon-tawny.vercel.app/" },
    });
  }, []);

  // Only close on mousedown on the backdrop itself — prevents accidental closes on mobile
  const handleOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) setLoginModal();
  }, [setLoginModal]);

  // Mobile: touchend on backdrop
  const handleOverlayTouchEnd = useCallback((e) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setLoginModal();
    }
  }, [setLoginModal]);

  // Unified button tap handler — prevents ghost click double-fire on mobile
  const makeTapHandler = (fn) => ({
    onClick: fn,
    onTouchEnd: (e) => { e.preventDefault(); fn(); },
  });

  return (
    <div
      className="login"
      onMouseDown={handleOverlayMouseDown}
      onTouchEnd={handleOverlayTouchEnd}
    >
      <div className="login_card" onMouseDown={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>

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
              {...makeTapHandler(() => { setMode(m); setError(""); setSuccess(""); })}
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

        {/* Inputs — NO autoFocus (causes mobile keyboard popup remount) */}
        <div className="loginCredentials">
          <input
            className="userNameLoginUserName"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Email Address"
            type="email"
            autoComplete="email"
            inputMode="email"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {mode === "login" && (
            <input
              className="userNameLoginUserName"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="login_feedback login_feedback--error">
            ❌ {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="login_feedback login_feedback--success">
            ✅ {success}
          </div>
        )}

        {/* Buttons */}
        <div className="login_buttons">
          <button
            {...makeTapHandler(mode === "login" ? handleLogin : handleForgot)}
            disabled={loading}
            className="login_btn_primary"
            style={{
              background: loading ? "#c4b5fd" : "#7c3aed",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Send Reset Email"}
          </button>

          <button
            {...makeTapHandler(handleGoogleLogin)}
            className="login_btn_google"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div className="login_btn_row">
            <Link
              to="/signup"
              onClick={setLoginModal}
              className="login_btn_signup"
            >
              Sign Up
            </Link>
            <button
              {...makeTapHandler(setLoginModal)}
              className="login_btn_cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;