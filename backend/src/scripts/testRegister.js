import prisma from "../config/prismaClient.js";

const run = async () => {
  const email = "prashant.llm.00@gmail.com";

  console.log("Cleaning up user from DB first in case it exists...");
  try {
    await prisma.user.deleteMany({
      where: { email: email.toLowerCase() }
    });
    console.log("Cleanup complete.");
  } catch (err) {
    console.log("No user to clean up or delete failed:", err.message);
  }

  const url = "http://localhost:5000/api/auth/register";
  const payload = {
    name: "Prashant Test",
    email,
    password: "Password123!"
  };

  console.log("Sending registration request...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("✅ Registration response:", JSON.stringify(data, null, 2));

    console.log("Retrying registration request with same email (should re-send OTP code)...");
    const retryRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const retryData = await retryRes.json();
    console.log("✅ Retry registration response:", JSON.stringify(retryData, null, 2));

  } catch (err) {
    console.error("❌ Registration request failed:", err.message);
  }

  process.exit(0);
};

run();
