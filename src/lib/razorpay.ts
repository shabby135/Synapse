import "server-only";

import Razorpay from "razorpay";

let razorpayClient: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId) {
    throw new Error(
      "RAZORPAY_KEY_ID is not configured."
    );
  }

  if (!keySecret) {
    throw new Error(
      "RAZORPAY_KEY_SECRET is not configured."
    );
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayClient;
}