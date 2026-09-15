import React from "react";
import { useNavigate } from "react-router-dom";
import LoginOptionsModal from "../../Component/LoginOptionsModal/LoginOptionsModal";

const SignInPage = () => {
  const navigate = useNavigate();

  return (
    <LoginOptionsModal onDismiss={() => navigate("/")} />
  );
};

export default SignInPage;