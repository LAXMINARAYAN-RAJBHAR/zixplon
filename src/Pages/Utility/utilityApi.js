// Wrapper functions for Razorpay order creation + calling your backend recharge/bill endpoints

export const createRazorpayOrder = async (amountInRupees) => {
  const res = await fetch("/api/create-razorpay-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Number(amountInRupees) * 100 }), // paise
  });

  if (!res.ok) throw new Error("Failed to create Razorpay order");
  return res.json();
};

export const processRecharge = async ({ mobile, operator, amount, razorpay_payment_id }) => {
  const res = await fetch("/api/process-recharge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, operator, amount, razorpay_payment_id }),
  });

  if (!res.ok) throw new Error("Recharge request failed");
  return res.json();
};

export const processBillPayment = async ({ billerType, consumerNumber, amount, razorpay_payment_id }) => {
  const res = await fetch("/api/process-bill-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ billerType, consumerNumber, amount, razorpay_payment_id }),
  });

  if (!res.ok) throw new Error("Bill payment request failed");
  return res.json();
};

export const openRazorpayCheckout = ({ order, description, prefillContact, onSuccess, onDismiss }) => {
  const options = {
    key: process.env.REACT_APP_RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: "INR",
    order_id: order.id,
    name: "Zixplon",
    description,
    handler: onSuccess,
    modal: { ondismiss: onDismiss },
    prefill: { contact: prefillContact },
    theme: { color: "#dc2626" },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
};

export const logUtilityTransaction = async (supabase, { user_id, type, operator, amount, status, provider_ref }) => {
  return supabase.from("utility_transactions").insert({
    user_id,
    type,
    operator,
    amount,
    status,
    provider_ref,
  });
};