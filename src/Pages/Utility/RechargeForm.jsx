import React, { useState } from "react";
import { supabase } from "../../config/supabase"; // adjust to your actual client path
import { MenuItem, Select, TextField, Button, CircularProgress } from "@mui/material";
import UtilityHeader from "./UtilityHeader";

const operators = [
  { code: "AT", label: "Airtel" },
  { code: "JI", label: "Jio" },
  { code: "VI", label: "Vi (Vodafone Idea)" },
  { code: "BS", label: "BSNL" },
];

const RechargeForm = () => {
  const [mobile, setMobile] = useState("");
  const [operator, setOperator] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'failed' | null

  const handleRecharge = async () => {
    if (!mobile || !operator || !amount) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 2. Create a Razorpay order for the recharge amount (via your backend/edge function)
      const orderRes = await fetch("/api/create-razorpay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) * 100 }), // paise
      });
      const order = await orderRes.json();

      // 3. Open Razorpay checkout
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        order_id: order.id,
        name: "Zixplon Recharge",
        description: `Recharge for ${mobile}`,
        handler: async (paymentResponse) => {
          // 4. Payment succeeded — now call your recharge provider (Robocheck/PaySprint) via backend
          const rechargeRes = await fetch("/api/process-recharge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mobile,
              operator,
              amount,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
            }),
          });
          const rechargeResult = await rechargeRes.json();

          const finalStatus = rechargeResult.success ? "success" : "failed";
          setStatus(finalStatus);

          // 5. Log transaction in Supabase
          await supabase.from("utility_transactions").insert({
            user_id: user.id,
            type: "recharge",
            operator,
            amount: Number(amount),
            status: finalStatus,
            provider_ref: rechargeResult.providerRef || paymentResponse.razorpay_payment_id,
          });

          setLoading(false);
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        prefill: { contact: mobile },
        theme: { color: "#dc2626" }, // matches your Zixplon accent
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Recharge error:", err);
      setStatus("failed");
      setLoading(false);
    }
  };

  return (
    <div className="recharge-form" style={{ maxWidth: 400, margin: "0 auto", padding: "80px 16px 24px" }}>
      <UtilityHeader title="Mobile Recharge" />

      <TextField
        label="Mobile Number"
        fullWidth
        margin="normal"
        value={mobile}
        onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
        inputProps={{ maxLength: 10 }}
      />

      <Select
        fullWidth
        displayEmpty
        value={operator}
        onChange={(e) => setOperator(e.target.value)}
        style={{ marginTop: 16, marginBottom: 8 }}
      >
        <MenuItem value="" disabled>Select Operator</MenuItem>
        {operators.map((op) => (
          <MenuItem key={op.code} value={op.code}>{op.label}</MenuItem>
        ))}
      </Select>

      <TextField
        label="Amount (₹)"
        fullWidth
        margin="normal"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <Button
        fullWidth
        variant="contained"
        style={{ marginTop: 16, backgroundColor: "#dc2626" }}
        onClick={handleRecharge}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Recharge Now"}
      </Button>

      {status === "success" && <p style={{ color: "green" }}>Recharge successful!</p>}
      {status === "failed" && <p style={{ color: "red" }}>Recharge failed. Please try again.</p>}
    </div>
  );
};

export default RechargeForm;