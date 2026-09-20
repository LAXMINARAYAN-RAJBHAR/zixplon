import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { mobile, operator, amount, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!mobile || !operator || !amount || !razorpay_payment_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Verify Razorpay payment signature (only if you pass order_id + signature from frontend)
    if (razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, error: "Payment verification failed" });
      }
    }

    // 2. Call your recharge provider's API (example shape — replace with actual Robocheck/PaySprint endpoint + auth)
    const providerRes = await fetch("https://api.yourrechargeaggregator.com/recharge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RECHARGE_API_KEY}`,
      },
      body: JSON.stringify({
        mobile,
        operator,
        amount,
        client_ref: razorpay_payment_id, // idempotency / tracking
      }),
    });

    const providerData = await providerRes.json();

    // 3. Normalize provider response — adjust field names to match actual provider docs
    if (providerData.status === "SUCCESS" || providerData.success === true) {
      return res.status(200).json({
        success: true,
        providerRef: providerData.transaction_id || providerData.txnId,
      });
    } else {
      return res.status(200).json({
        success: false,
        error: providerData.message || "Recharge failed at provider",
      });
    }
  } catch (err) {
    console.error("Recharge processing error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}