import React, { useState } from "react";
import { supabase } from "../../config/supabase";
import { MenuItem, Select, TextField, Button, CircularProgress } from "@mui/material";
import UtilityHeader from "./UtilityHeader";
import {
  createRazorpayOrder,
  processBillPayment,
  openRazorpayCheckout,
  logUtilityTransaction,
} from "./utilityApi";

const billers = [
  { code: "ELEC", label: "Electricity" },
  { code: "GAS", label: "Piped Gas" },
  { code: "WATER", label: "Water" },
  { code: "BROADBAND", label: "Broadband" },
];

const BillPaymentForm = () => {
  const [billerType, setBillerType] = useState("");
  const [consumerNumber, setConsumerNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handlePay = async () => {
    if (!billerType || !consumerNumber || !amount) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const order = await createRazorpayOrder(amount);

      openRazorpayCheckout({
        order,
        description: `${billerType} bill for ${consumerNumber}`,
        prefillContact: user.phone || "",
        onDismiss: () => setLoading(false),
        onSuccess: async (paymentResponse) => {
          const result = await processBillPayment({
            billerType,
            consumerNumber,
            amount,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
          });

          const finalStatus = result.success ? "success" : "failed";
          setStatus(finalStatus);

          await logUtilityTransaction(supabase, {
            user_id: user.id,
            type: "bill_payment",
            operator: billerType,
            amount: Number(amount),
            status: finalStatus,
            provider_ref: result.providerRef || paymentResponse.razorpay_payment_id,
          });

          setLoading(false);
        },
      });
    } catch (err) {
      console.error("Bill payment error:", err);
      setStatus("failed");
      setLoading(false);
    }
  };

  return (
    <div className="bill-payment-form" style={{ maxWidth: 400, margin: "0 auto", padding: "80px 16px 24px" }}>
      <UtilityHeader title="Bill Payment" />

      <Select
        fullWidth
        displayEmpty
        value={billerType}
        onChange={(e) => setBillerType(e.target.value)}
        style={{ marginTop: 16, marginBottom: 8 }}
      >
        <MenuItem value="" disabled>Select Biller Type</MenuItem>
        {billers.map((b) => (
          <MenuItem key={b.code} value={b.code}>{b.label}</MenuItem>
        ))}
      </Select>

      <TextField
        label="Consumer / Account Number"
        fullWidth
        margin="normal"
        value={consumerNumber}
        onChange={(e) => setConsumerNumber(e.target.value)}
      />

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
        onClick={handlePay}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Pay Bill"}
      </Button>

      {status === "success" && <p style={{ color: "green" }}>Payment successful!</p>}
      {status === "failed" && <p style={{ color: "red" }}>Payment failed. Please try again.</p>}
    </div>
  );
};

export default BillPaymentForm;