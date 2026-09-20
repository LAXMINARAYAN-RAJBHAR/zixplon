import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount } = req.body; // amount in paise, already multiplied on frontend

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `recharge_${Date.now()}`,
    });

    return res.status(200).json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    return res.status(500).json({ error: "Failed to create order" });
  }
}