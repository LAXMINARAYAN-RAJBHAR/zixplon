import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../config/supabase";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import "./LoginOptionsModal.css";

// Google OAuth Client ID (the same one already configured in Supabase's
// Google provider). Add to .env as REACT_APP_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

// Loads Google Identity Services once (safe to call repeatedly). Doing it
// here means index.html does not need a <script> tag.
const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let script = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Could not load Google sign-in. Check your connection."))
    );
  });

export default function LoginOptionsModal({ onDismiss }) {
  const [mode, setMode] = useState("options"); // 'options' | 'email'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // CHANGED: Google sign-in no longer redirects through
  // <project>.supabase.co. Google's own button returns an ID token to this
  // page, which is handed to Supabase. The account chooser therefore shows
  // this site instead of the Supabase address.
  const handleGoogleCredential = async ({ credential }) => {
    setError("");
    const { error: idTokenError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: credential,
    });
    if (idTokenError) setError(idTokenError.message);
    // On success, App.js's onAuthStateChange listener updates currentUser
    // and closes this modal automatically.
  };

  // Render Google's button whenever the "options" view is showing.
  useEffect(() => {
    if (mode !== "options") return;

    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in is not configured (missing REACT_APP_GOOGLE_CLIENT_ID).");
      return;
    }

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleBtnRef.current) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          ux_mode: "popup",
        });

        // Google's button accepts a pixel width between 200 and 400.
        const slotWidth = googleBtnRef.current.offsetWidth || 280;
        const width = Math.min(400, Math.max(200, Math.floor(slotWidth)));

        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          width,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    }
    // On success, App.js's onAuthStateChange listener updates currentUser
    // and closes this modal automatically — no need to call onDismiss here.
  };

  return (
    <div className="login-modal-backdrop" onClick={onDismiss}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onDismiss} aria-label="Close">×</button>

        {mode === "options" && (
          <>
            <h2>Sign in to ZIXPLON</h2>
            <p className="login-modal-subtitle">Pick a way to continue</p>

            {/* Google renders its official "Continue with Google" button here. */}
            <div
              ref={googleBtnRef}
              style={{
                width: "100%",
                minHeight: "44px",
                display: "flex",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            />

            <button className="login-option-btn email" onClick={() => setMode("email")}>
              Continue with Email
            </button>

            <button className="login-option-btn skip" onClick={onDismiss}>
              Continue browsing without signing in
            </button>

            {error && <p className="login-modal-error">{error}</p>}
          </>
        )}

        {mode === "email" && (
          <form onSubmit={handleEmailLogin}>
            <h2>Sign in with Email</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="login-modal-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-modal-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <VisibilityOff sx={{ fontSize: "18px" }} />
                ) : (
                  <Visibility sx={{ fontSize: "18px" }} />
                )}
              </button>
            </div>
            {error && <p className="login-modal-error">{error}</p>}
            <button type="submit" className="login-option-btn google" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button type="button" className="login-option-btn skip" onClick={() => setMode("options")}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}