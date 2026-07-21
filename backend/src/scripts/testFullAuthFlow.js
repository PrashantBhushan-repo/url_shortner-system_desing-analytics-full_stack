import prisma from "../config/prismaClient.js";
import { getRedisClient, initRedis } from "../config/redisClient.js";
import crypto from "crypto";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const email = "prashant.llm.00@gmail.com";
  const password = "Password123!";

  console.log("1. Init Redis & Clean up user from DB...");
  await initRedis();
  const redis = getRedisClient();

  try {
    await prisma.user.deleteMany({
      where: { email: email.toLowerCase() }
    });
    console.log("Cleanup complete.");
  } catch (err) {
    console.log("No user to clean up:", err.message);
  }

  const BASE_URL = "http://localhost:5000/api";

  // Step 1: Register
  console.log("\n2. Sending registration request...");
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Prashant Test", email, password })
  });
  const regData = await regRes.json();
  console.log("Registration Response:", JSON.stringify(regData, null, 2));

  const userId = regData.data.userId;

  // Retrieve OTP from Redis
  const otpKey = `email_verify:${userId}`;
  const hashedOtp = await redis.get(otpKey);
  console.log(`Email verify OTP stored in Redis: ${hashedOtp ? "Exists" : "Not Found"}`);

  // Let's find the correct 6-digit code by matching the sha256 hash (or we can cheat and look at how it hashes. Since hashOtp uses sha256 of otp, let's hash every 6-digit number to find it or we can just fetch it since we know how it's generated! Wait, in testConnections we can just scan, but hashing all 6-digit numbers in node takes 0.05 seconds! Let's do that to get the actual 6-digit OTP!)
  console.log("Finding 6-digit OTP from Redis hash...");
  let otpCode = "";
  for (let i = 100000; i <= 999999; i++) {
    const code = i.toString();
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    if (hash === hashedOtp) {
      otpCode = code;
      break;
    }
  }
  console.log(`Found OTP code: ${otpCode}`);

  // Step 2: Verify email
  console.log("\n3. Verifying email...");
  const verifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, otp: otpCode })
  });
  console.log("Verify Email Response:", await verifyRes.json());

  // Step 3: Login
  console.log("\n4. Logging in...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  console.log("Login Response (should request 2FA):", JSON.stringify(loginData, null, 2));

  // Retrieve Login OTP from Redis
  const loginOtpKey = `login_otp:${userId}`;
  const hashedLoginOtp = await redis.get(loginOtpKey);
  let loginOtpCode = "";
  for (let i = 100000; i <= 999999; i++) {
    const code = i.toString();
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    if (hash === hashedLoginOtp) {
      loginOtpCode = code;
      break;
    }
  }
  console.log(`Found Login OTP code: ${loginOtpCode}`);

  // Step 4: Verify login OTP
  console.log("\n5. Verifying Login OTP...");
  const verifyLoginRes = await fetch(`${BASE_URL}/auth/verify-login-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, otp: loginOtpCode })
  });

  const cookies = verifyLoginRes.headers.get("set-cookie") || "";
  const verifyLoginData = await verifyLoginRes.json();
  console.log("Verify Login Response:", JSON.stringify(verifyLoginData, null, 2));
  console.log("Set-Cookie header received:", cookies);

  const accessToken = verifyLoginData.data.accessToken;

  // Extract refreshToken from cookie
  const cookieMatch = cookies.match(/refreshToken=([^;]+)/);
  const refreshToken = cookieMatch ? cookieMatch[1] : "";
  console.log("Extracted Refresh Token:", refreshToken);

  // Step 5: Fetch active sessions
  console.log("\n6. Fetching active sessions...");
  const sessionsRes = await fetch(`${BASE_URL}/security/sessions`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Cookie": `refreshToken=${refreshToken}`
    }
  });
  const sessionsData = await sessionsRes.json();
  console.log("Active Sessions Response:", JSON.stringify(sessionsData, null, 2));

  // Step 6: Fetch login history
  console.log("\n7. Fetching login history...");
  const historyRes = await fetch(`${BASE_URL}/security/login-history`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Cookie": `refreshToken=${refreshToken}`
    }
  });
  console.log("Login History Response:", JSON.stringify(await historyRes.json(), null, 2));

  // Step 7: Silent Refresh
  console.log("\n8. Refreshing token (rotating refresh token)...");
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `refreshToken=${refreshToken}`
    }
  });
  const refreshData = await refreshRes.json();
  const newCookies = refreshRes.headers.get("set-cookie") || "";
  console.log("Refresh Response:", JSON.stringify(refreshData, null, 2));
  console.log("New Set-Cookie header received:", newCookies);

  // Step 8: Replay Attack test (reusing old refresh token)
  console.log("\n9. Replay Attack test: Reusing revoked refresh token...");
  const replayRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `refreshToken=${refreshToken}`
    }
  });
  console.log("Replay Response (should be 401 & terminate session):", JSON.stringify(await replayRes.json(), null, 2));

  console.log("\nAuthentication & Authorization Flow Validation Completed!");
  process.exit(0);
};

run();
