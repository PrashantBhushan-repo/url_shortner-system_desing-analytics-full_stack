import prisma from "../config/prismaClient.js";
import { initRedis, getRedisClient } from "../config/redisClient.js";

const run = async () => {
  console.log("Checking database and Redis connections...");

  // 1. Check Redis
  const redisConnected = await initRedis();
  if (redisConnected) {
    console.log("✅ Redis: Connected successfully");
    const client = getRedisClient();
    await client.set("test_key", "connection_ok", "EX", 10);
    const val = await client.get("test_key");
    console.log(`✅ Redis: Get/Set test: val = ${val}`);
  } else {
    console.error("❌ Redis: Connection failed");
  }

  // 2. Check Database via Prisma
  try {
    const userCount = await prisma.user.count();
    console.log(`✅ Database: Connected successfully. User count = ${userCount}`);
  } catch (err) {
    console.error("❌ Database: Connection failed:", err.message);
  }

  process.exit(0);
};

run();
