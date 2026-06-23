import React, { useState } from "react";
import "./signUp.css";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../config/supabase";

const DEFAULT_PIC =
  "https://ui-avatars.com/api/?name=User&background=7c3aed&color=fff&size=100";

const SignUp = () => {
  const navigate = useNavigate();
  const [uploadedImageUrl, setUploadedImageUrl] = useState(DEFAULT_PIC);
  const [signUpField, setSignUpField] = useState({
    channelName: "",
    userName: "",
    email: "",
    password: "",
    about: "",
    profilePic: DEFAULT_PIC,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleInputField = (event, name) => {
    setSignUpField({ ...signUpField, [name]: event.target.value });
    setError("");
  };

  const uploadImage = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const data = new FormData();
    data.append("file", files[0]);
    data.append("upload_preset", "youtube-clone");
    try {
      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/dwoqk0yue/image/upload",
        data,
      );
      const imageUrl = response.data.secure_url;
      setUploadedImageUrl(imageUrl);
      setSignUpField((prev) => ({ ...prev, profilePic: imageUrl }));
    } catch (err) {
      setError("Image upload failed. Please try again.");
    }
  };

  const handleSignUp = async () => {
    // ── Validation ──
    if (!signUpField.channelName.trim())
      return setError("Please enter a Channel Name.");
    if (!signUpField.userName.trim())
      return setError("Please enter a User Name.");
    if (!signUpField.email.trim())
      return setError("Please enter an Email.");
    if (!signUpField.password)
      return setError("Please enter a Password.");
    if (signUpField.password.length < 6)
      return setError("Password must be at least 6 characters.");

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // ── Step 1: Create auth user ──
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signUpField.email.trim(),
        password: signUpField.password,
      });

      console.log("Supabase signUp response → data:", data, "error:", signUpError);

      if (signUpError) throw signUpError;

      const user = data?.user;

      // Supabase silently returns a fake user with empty identities[] when email already exists
      if (!user) throw new Error(`Sign up failed — Supabase returned no user. Check console for details.`);
      if (user.identities && user.identities.length === 0) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      // ── Step 2: Insert profile row ──
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          username: signUpField.userName.trim(),
          profile_pic: signUpField.profilePic,
          about: signUpField.about.trim(),
          banner_pic: "",
        },
      ]);

      if (profileError) {
        // Log but don't block — auth user already created
        console.error("Profile insert error:", profileError.message);
      }

      // ── Step 3: Persist to localStorage ──
      localStorage.setItem("userId", user.id);
      localStorage.setItem("username", signUpField.channelName.trim());
      localStorage.setItem("userName", signUpField.userName.trim());
      localStorage.setItem("email", signUpField.email.trim());
      localStorage.setItem("profilePic", signUpField.profilePic);
      localStorage.setItem("about", signUpField.about.trim());

      // ── Step 4: Feedback & redirect ──
      const emailConfirmRequired = !data.session; // session is null when confirm email is ON
      if (emailConfirmRequired) {
        setSuccess(
          "Account created! Please check your email to confirm, then sign in.",
        );
        setLoading(false);
        setTimeout(() => navigate("/signin"), 3000);
      } else {
        // Email confirm is OFF in Supabase dashboard — user is immediately active
        setSuccess("Account created! Redirecting…");
        setLoading(false);
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || "Sign up failed. Please try again.");
    }
  };

  return (
    <div className="signUp">
      <div className="signup_card">
        <div className="signUp_title">
          <AccountCircleIcon
            sx={{ fontSize: "54px" }}
            className="login_youtubeImage"
          />
          Sign Up
        </div>

        <div className="signUp_Inputs">
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.channelName}
            onChange={(e) => handleInputField(e, "channelName")}
            placeholder="Channel Name *"
          />
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.userName}
            onChange={(e) => handleInputField(e, "userName")}
            placeholder="User Name *"
          />
          <input
            type="email"
            className="signUp_Inputs_inp"
            value={signUpField.email}
            onChange={(e) => handleInputField(e, "email")}
            placeholder="Email Address *"
          />
          <input
            type="password"
            className="signUp_Inputs_inp"
            value={signUpField.password}
            onChange={(e) => handleInputField(e, "password")}
            placeholder="Password * (min 6 chars)"
            onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
          />
          <input
            type="text"
            className="signUp_Inputs_inp"
            value={signUpField.about}
            onChange={(e) => handleInputField(e, "about")}
            placeholder="About Your Channel (optional)"
          />

          {/* Profile Picture Upload */}
          <div className="image_upload_signup">
            <input type="file" accept="image/*" onChange={uploadImage} />
            <div className="image_upload_signup_div">
              <img
                className="image_default_signup"
                src={uploadedImageUrl}
                alt="Profile Preview"
                onError={(e) => {
                  e.target.src = DEFAULT_PIC;
                }}
              />
            </div>
          </div>

          {/* Error / Success Messages */}
          {error && (
            <div
              style={{
                background: "#ff444422",
                border: "1px solid #ff4444",
                color: "#ff4444",
                padding: "10px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                width: "60%",
                textAlign: "center",
              }}
            >
              ❌ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: "#4caf5022",
                border: "1px solid #4caf50",
                color: "#4caf50",
                padding: "10px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                width: "60%",
                textAlign: "center",
              }}
            >
              ✅ {success}
            </div>
          )}

          <div className="signUpBtns">
            <div
              className="signUpBtn"
              onClick={!loading ? handleSignUp : undefined}
              style={{
                background: loading ? "#e9e3ff" : "transparent",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </div>
            <Link to={"/"} className="signUpBtn">
              Home Page
            </Link>
          </div>

          <p style={{ color: "#8b84c4", fontSize: "14px", marginTop: "8px" }}>
            Already have an account?{" "}
            <span
              onClick={() => navigate("/signin")}
              style={{
                color: "var(--zx-primary)",
                cursor: "pointer",
                fontWeight: "700",
              }}
            >
              Sign In
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;