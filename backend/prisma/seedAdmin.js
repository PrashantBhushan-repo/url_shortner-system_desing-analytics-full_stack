import { PrismaClient } from "../src/generated/prisma/index.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME;

  if (!email || !password || !name) {
    console.error("❌ CRITICAL: Missing ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, or ADMIN_SEED_NAME in environment configuration.");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // 2. Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (existingUser) {
    console.warn(`⚠️ WARNING: Account with email '${normalizedEmail}' already exists. Promoting it to administrator and updating seed credentials.`);

    const user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: name.trim(),
        passwordHash,
        role: "ADMIN",
        emailVerified: true,
        status: "ACTIVE",
        must_change_password: true,
      },
    });

    const freePlan = await prisma.plan.findUnique({
      where: { key: "free" },
    });

    if (!freePlan) {
      console.warn("⚠️ WARNING: 'free' subscription plan not found in database. Please run general seeding first.");
    } else {
      const existingSubscription = await prisma.subscription.findFirst({
        where: { user_id: user.id },
      });

      if (!existingSubscription) {
        await prisma.subscription.create({
          data: {
            user_id: user.id,
            plan_id: freePlan.id,
            billing_cycle: "MONTHLY",
            status: "ACTIVE",
            started_at: new Date(),
          },
        });
        console.log("✅ Provisioned default free subscription for administrator.");
      }
    }

    console.log(`🚀 Administrative account '${normalizedEmail}' successfully promoted to ADMIN.`);
    return;
  }

  console.log(`🌱 Provisioning administrative account: ${normalizedEmail}`);

  // 3. Create administrator user record directly
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "ADMIN",
      emailVerified: true,
      status: "ACTIVE",
      must_change_password: true,
    },
  });

  // 4. Provision corresponding free subscription to prevent downstream errors
  const freePlan = await prisma.plan.findUnique({
    where: { key: "free" },
  });

  if (!freePlan) {
    console.warn("⚠️ WARNING: 'free' subscription plan not found in database. Please run general seeding first.");
  } else {
    await prisma.subscription.create({
      data: {
        user_id: user.id,
        plan_id: freePlan.id,
        billing_cycle: "MONTHLY",
        status: "ACTIVE",
        started_at: new Date(),
      },
    });
    console.log("✅ Provisioned default free subscription for administrator.");
  }

  console.log(`🚀 Administrative account '${normalizedEmail}' successfully provisioned. Forced password change on first sign-in active.`);
}

main()
  .catch((err) => {
    console.error("❌ Error running admin seed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
