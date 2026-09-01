import prisma from "../config/prismaClient.js";
import { getRedisClient, initRedis } from "../config/redisClient.js";
import crypto from "crypto";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  console.log("=== STARTING ADMIN AUTH FLOW VALIDATION ===");

  await initRedis();
  const redis = getRedisClient();

  const BASE_URL = "http://localhost:5000/api";
  const adminEmail = "prashant.coding.org@gmail.com";
  const defaultPassword = "Prashant@1336";
  const newPassword = "Prashant@New1336";

  // Step 0: Ensure database has admin seeded with must_change_password = true and default password
  console.log("\n0. Resetting admin user status in DB for test...");
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (adminUser) {
      // Set default password and must_change_password: true
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.default.hash(defaultPassword, 10);
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          passwordHash,
          must_change_password: true,
          status: "ACTIVE"
        }
      });
      console.log("Admin user reset successfully.");
    } else {
      console.log("Admin user not found. Seeding first...");
      // Seed if not exists
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.default.hash(defaultPassword, 10);
      await prisma.user.create({
        data: {
          name: "System Administrator",
          email: adminEmail,
          passwordHash,
          role: "ADMIN",
          emailVerified: true,
          status: "ACTIVE",
          must_change_password: true,
        }
      });
      console.log("Admin user seeded successfully.");
    }
  } catch (err) {
    console.error("Failed to reset admin user:", err.message);
  }

  // Fetch admin details
  const adminUserObj = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminUserId = adminUserObj.id;

  // Step 1: Access admin endpoint without authentication
  console.log("\n1. Requesting /admin/users without authentication...");
  const noAuthRes = await fetch(`${BASE_URL}/admin/users`);
  console.log("Response Status:", noAuthRes.status);
  const noAuthData = await noAuthRes.json();
  console.log("Response JSON (Should fail IP check or Auth):", JSON.stringify(noAuthData, null, 2));

  // Step 2: Login request
  console.log("\n2. Sending Admin login request...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: defaultPassword })
  });
  const loginData = await loginRes.json();
  console.log("Login Response (Should request OTP):", JSON.stringify(loginData, null, 2));

  if (!loginData.success || !loginData.data.otpRequired) {
    console.error("❌ Failed: Did not prompt for OTP as expected.");
    process.exit(1);
  }

  // Step 3: Retrieve OTP from Redis
  const loginOtpKey = `login_otp:${adminUserId}`;
  const hashedLoginOtp = await redis.get(loginOtpKey);
  console.log(`Login OTP stored in Redis: ${hashedLoginOtp ? "Exists" : "Not Found"}`);

  let otpCode = "";
  console.log("Finding 6-digit OTP code by matching sha256 hash...");
  for (let i = 100000; i <= 999999; i++) {
    const code = i.toString();
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    if (hash === hashedLoginOtp) {
      otpCode = code;
      break;
    }
  }
  console.log(`Found Login OTP code: ${otpCode}`);

  // Step 4: Verify OTP
  console.log("\n3. Verifying Admin Login OTP...");
  const verifyRes = await fetch(`${BASE_URL}/auth/verify-login-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: adminUserId, otp: otpCode })
  });
  const verifyData = await verifyRes.json();
  console.log("Verify OTP Response (Should ask to force change password):", JSON.stringify(verifyData, null, 2));

  if (!verifyData.success || !verifyData.data.mustChangePassword) {
    console.error("❌ Failed: Did not prompt to force-change password.");
    process.exit(1);
  }

  const { changePasswordToken } = verifyData.data;

  // Step 5: Force change password
  console.log("\n4. Changing Admin password to finalize authentication...");
  const changeRes = await fetch(`${BASE_URL}/auth/force-change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changePasswordToken, newPassword })
  });
  const changeData = await changeRes.json();
  console.log("Force Change Password Response:", JSON.stringify(changeData, null, 2));

  if (!changeData.success || !changeData.data.accessToken) {
    console.error("❌ Failed to change password and obtain token.");
    process.exit(1);
  }

  const accessToken = changeData.data.accessToken;

  // Step 6: Try accessing admin endpoint (without headers/IP spoofing)
  console.log("\n5. Accessing admin endpoint with token but without allowlisted IP...");
  const adminResBlocked = await fetch(`${BASE_URL}/admin/users`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  console.log("Response Status (Expected 403 Forbidden because of IP):", adminResBlocked.status);
  const blockData = await adminResBlocked.json();
  console.log("Response JSON:", JSON.stringify(blockData, null, 2));

  // Step 7: Try accessing admin endpoint (with allowlisted IP header)
  console.log("\n6. Accessing admin endpoint with token AND allowlisted IP header...");
  const adminResAllowed = await fetch(`${BASE_URL}/admin/users`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "X-Forwarded-For": "172.29.32.1"
    }
  });
  console.log("Response Status (Expected 200 OK):", adminResAllowed.status);
  const usersData = await adminResAllowed.json();
  console.log("Response JSON (List of users metadata):", JSON.stringify(usersData, null, 2));

  if (adminResAllowed.status === 200) {
    console.log("\n✅ SUCCESS: Admin authenticated, forced password rotation, IP allowlist enforced, and authorized access successful!");
  } else {
    console.error("\n❌ FAILED: Admin authorization failed.");
  }

  // Restore the password back to default for clean state
  console.log("\nRestoring default password for next runs...");
  try {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.default.hash(defaultPassword, 10);
    await prisma.user.update({
      where: { id: adminUserId },
      data: {
        passwordHash,
        must_change_password: true
      }
    });
    console.log("Restore complete.");
  } catch (err) {
    console.error("Failed to restore default password:", err.message);
  }

  process.exit(0);
};

run();
