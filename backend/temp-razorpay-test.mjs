import dotenv from 'dotenv';
import Razorpay from 'razorpay';

// Load dotenv from .env
dotenv.config();

// Print keys to see what was parsed (obscuring secrets)
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log("Parsed Key ID:", keyId);
console.log("Parsed Key Secret (length):", keySecret ? keySecret.length : 0);

if (!keyId || !keySecret) {
  console.error("Keys are missing from .env!");
  process.exit(1);
}

const rzp = new Razorpay({
  key_id: keyId,
  key_secret: keySecret
});

try {
  console.log("Attempting to fetch orders from Razorpay...");
  const orders = await rzp.orders.all({ count: 1 });
  console.log("Connection successful! Orders count fetched:", orders.items?.length);
  console.log("SUCCESS: Razorpay credentials are valid.");
} catch (err) {
  console.error("Razorpay API call failed:", err);
}
