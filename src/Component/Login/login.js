import React, { useState, useEffect } from "react";
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
    setEmail("");
    setPassword("");
    setError("");
    setSuccess("");
    setMode("login");
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return setError("Please enter email and password.");
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) return setError(err.message);
    const user = data.user;
    const name = user.user_metadata?.channelName || user.user_metadata?.username || email.split("@")[0];
    localStorage.setItem("username", name);
    localStorage.setItem("email", email);
    localStorage.setItem("userId", user.id);
    if (user.user_metadata?.profilePic) localStorage.setItem("profilePic", user.user_metadata.profilePic);
    if (user.user_metadata?.about) localStorage.setItem("about", user.user_metadata.about);
    onLoginSuccess(name, user);
    setLoginModal();
  };

  const handleForgot = async () => {
    if (!email) return setError("Please enter your email.");
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (err) return setError(err.message);
    setSuccess("Password reset email sent! Check your inbox.");
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://zixplon-tawny.vercel.app/" },
    });
  };

  return (
    <div className="login" onClick={(e) => e.target === e.currentTarget && setLoginModal()}>
      <div className="login_card">

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
        <div style={{
          display: "flex",
          width: "60%",
          marginTop: "20px",
          borderBottom: "1px solid #ddd6fe",
        }}>
          {["login", "forgot"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); setSuccess(""); }}
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
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="Email Address"
            type="email"
            autoComplete="email"
            autoFocus
          />
          {mode === "login" && (
            <input
              className="userNameLoginUserName"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Password"
              type="password"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            color: "#dc2626",
            fontSize: "13px",
            marginTop: "10px",
            background: "#fee2e2",
            padding: "8px 14px",
            borderRadius: "6px",
            width: "60%",
            textAlign: "center",
          }}>❌ {error}</div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            color: "#16a34a",
            fontSize: "13px",
            marginTop: "10px",
            background: "#dcfce7",
            padding: "8px 14px",
            borderRadius: "6px",
            width: "60%",
            textAlign: "center",
          }}>✅ {success}</div>
        )}

        {/* Buttons */}
        <div className="login_buttons" style={{
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          width: "60%",
        }}>
          {/* Primary Action */}
          <button
            onClick={mode === "login" ? handleLogin : handleForgot}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#c4b5fd" : "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "25px",
              padding: "12px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Send Reset Email"}
          </button>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            style={{
              width: "100%",
              background: "white",
              color: "#1a1a3e",
              border: "1.5px solid #ddd6fe",
              borderRadius: "25px",
              padding: "11px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Sign Up + Cancel */}
          <div style={{ display: "flex", width: "100%", gap: "10px" }}>
            <Link
              to="/signup"
              onClick={setLoginModal}
              style={{
                flex: 1,
                border: "1.5px solid #7c3aed",
                borderRadius: "25px",
                padding: "10px",
                textAlign: "center",
                color: "#7c3aed",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Sign Up
            </Link>
            <button
              onClick={setLoginModal}
              style={{
                flex: 1,
                background: "none",
                border: "1.5px solid #ddd6fe",
                borderRadius: "25px",
                padding: "10px",
                color: "#9ca3af",
                fontSize: "14px",
                cursor: "pointer",
              }}
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