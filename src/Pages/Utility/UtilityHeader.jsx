import React from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";

const UtilityHeader = ({ title }) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <button
        onClick={() => navigate("/utility")}
        aria-label="Back to Utility"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
        }}
      >
        <ArrowBackIosNewIcon style={{ fontSize: 18, color: "#9e1226" }} />
      </button>
      <h3 style={{ margin: 0 }}>{title}</h3>
    </div>
  );
};

export default UtilityHeader;