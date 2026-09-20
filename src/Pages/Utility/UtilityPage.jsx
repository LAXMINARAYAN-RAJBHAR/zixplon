import React from "react";
import { useNavigate } from "react-router-dom";
import "./UtilityPage.css";

const utilityOptions = [
  { label: "Mobile Recharge", icon: "📱", path: "/utility/recharge" },
  { label: "DTH", icon: "📺", path: "/utility/dth" },
  { label: "Electricity Bill", icon: "💡", path: "/utility/electricity" },
  { label: "Gift Cards", icon: "🎁", path: "/utility/giftcards" },
];

const UtilityPage = () => {
  const navigate = useNavigate();

  return (
    <div className="utility-page">
      <h2>Utility Services</h2>
      <div className="utility-grid">
        {utilityOptions.map((opt) => (
          <div
            key={opt.label}
            className="utility-tile"
            onClick={() => navigate(opt.path)}
          >
            <div className="utility-icon">{opt.icon}</div>
            <span>{opt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UtilityPage;