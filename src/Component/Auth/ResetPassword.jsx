import React, { useState } from "react";
import { supabase } from "../../config/supabase";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import "./resetPassword.css";

const ResetPassword = ({ setResetModal }) => {
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      return setError("Please fill in both fields.");
    }
    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSaving(false);

    if (updateError) {
      return setError(updateError.message || "Could not update password. The link may have expired — request a new one.");
    }

    setDone(true);
    setTimeout(() => setResetModal(false), 2500);
  };

  return (
    <div className="reset_password_overlay">
      <div className="reset_password_card">
        <div className="titleCard_login">Set New Password</div>

        {!done ? (
          <>
            <div className="loginCredentials">
              <div className="password_input_wrapper">
                <input
                  className="userNameLoginUserName"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="New Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password_toggle_btn"
                  onClick={() => setShowPassword((p) => !p)}
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

              <input
                className="userNameLoginUserName"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Confirm New Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && <div className="login_feedback login_feedback--error">❌ {error}</div>}

            <div className="login_buttons">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="login_btn_primary"
                style={{
                  background: saving ? "#c4b5fd" : "#7c3aed",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Set New Password"}
              </button>
            </div>
          </>
        ) : (
          <div className="login_feedback login_feedback--success">
            ✅ Password updated!
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;