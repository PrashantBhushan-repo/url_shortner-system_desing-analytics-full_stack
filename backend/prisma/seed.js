import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

const plansData = [
  {
    key: "free",
    name: "Free",
    description: "Essential URL shortening features for personal use.",
    price_monthly: 0,
    price_quarterly: null,
    price_yearly: null,
    currency: "INR",
    is_active: true,
    sort_order: 0,
    limit: {
      max_urls: 50,
      analytics_retention_days: 7,
      custom_alias_allowed: false,
      custom_domain_allowed: false,
      custom_expiry_allowed: false,
      qr_code_allowed: false,
      password_protected_links: false,
      geo_analytics: false,
      device_browser_analytics: false,
      utm_builder: false,
      api_access: false,
      csv_export: false,
      bulk_url_creation: false,
      webhooks_allowed: false,
      team_members_allowed: 0, // 0 = no team support
      api_rate_limit_per_min: null, // feature not available
      priority_support: false,
    }
  },
  {
    key: "starter",
    name: "Starter",
    description: "Expanded limits and retention for creators and bloggers.",
    price_monthly: 14900, // INR 149.00
    price_quarterly: 39900, // INR 399.00
    price_yearly: 149900, // INR 1499.00
    currency: "INR",
    is_active: true,
    sort_order: 1,
    limit: {
      max_urls: 500,
      analytics_retention_days: 90,
      custom_alias_allowed: false,
      custom_domain_allowed: false,
      custom_expiry_allowed: false,
      qr_code_allowed: false,
      password_protected_links: false,
      geo_analytics: false,
      device_browser_analytics: false,
      utm_builder: false,
      api_access: false,
      csv_export: false,
      bulk_url_creation: false,
      webhooks_allowed: false,
      team_members_allowed: 0,
      api_rate_limit_per_min: null,
      priority_support: false,
    }
  },
  {
    key: "pro",
    name: "Pro",
    description: "Professional capabilities, analytics, and custom brand domains.",
    price_monthly: 39900, // INR 399.00
    price_quarterly: 109900, // INR 1099.00
    price_yearly: 399900, // INR 3999.00
    currency: "INR",
    is_active: true,
    sort_order: 2,
    limit: {
      max_urls: null, // null = unlimited
      analytics_retention_days: 365,
      custom_alias_allowed: true,
      custom_domain_allowed: true,
      custom_expiry_allowed: true,
      qr_code_allowed: true,
      password_protected_links: true,
      geo_analytics: true,
      device_browser_analytics: true,
      utm_builder: true,
      api_access: true,
      csv_export: true,
      bulk_url_creation: true,
      webhooks_allowed: true,
      team_members_allowed: 0,
      api_rate_limit_per_min: 60, // Assumption: 60 API requests/min on Pro plan
      priority_support: false,
    }
  },
  {
    key: "business",
    name: "Business",
    description: "Collab tools, unlimited history, webhooks, and maximum speeds.",
    price_monthly: 99900, // INR 999.00
    price_quarterly: 279900, // INR 2799.00
    price_yearly: 999900, // INR 9999.00
    currency: "INR",
    is_active: true,
    sort_order: 3,
    limit: {
      max_urls: null,
      analytics_retention_days: null, // null = unlimited retention
      custom_alias_allowed: true,
      custom_domain_allowed: true,
      custom_expiry_allowed: true,
      qr_code_allowed: true,
      password_protected_links: true,
      geo_analytics: true,
      device_browser_analytics: true,
      utm_builder: true,
      api_access: true,
      csv_export: true,
      bulk_url_creation: true,
      webhooks_allowed: true,
      team_members_allowed: 10, // Assumption: 10 team seats
      api_rate_limit_per_min: 300, // Assumption: 300 API requests/min
      priority_support: true,
    }
  }
];

async function main() {
  console.log("🌱 Seeding subscription plans...");

  // 1. Seed Plan & PlanLimit (Idempotent using upsert)
  for (const item of plansData) {
    const { limit, ...planInfo } = item;
    
    const plan = await prisma.plan.upsert({
      where: { key: planInfo.key },
      update: planInfo,
      create: planInfo,
    });

    await prisma.planLimit.upsert({
      where: { plan_id: plan.id },
      update: {
        ...limit,
      },
      create: {
        plan_id: plan.id,
        ...limit,
      }
    });

    console.log(`✅ Plan "${plan.name}" successfully seeded/updated.`);
  }

  // 2. Backfill existing users with free subscription
  console.log("👤 Backfilling existing users with Free subscriptions...");
  const freePlan = await prisma.plan.findUnique({ where: { key: "free" } });
  if (!freePlan) throw new Error("Free plan not found in database.");

  const users = await prisma.user.findMany({
    include: {
      subscriptions: {
        where: { status: "ACTIVE" }
      }
    }
  });

  let backfillCount = 0;
  for (const user of users) {
    if (user.subscriptions.length === 0) {
      await prisma.subscription.create({
        data: {
          user_id: user.id,
          plan_id: freePlan.id,
          billing_cycle: "MONTHLY",
          status: "ACTIVE",
          started_at: new Date(),
        }
      });
      backfillCount++;
    }
  }
  console.log(`✅ Backfilled ${backfillCount} users with default Free subscription.`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
