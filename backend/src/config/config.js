import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 5000),
  baseUrl: process.env.BASE_URL || "http://localhost:5000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  jwt: {
    secret: process.env.JWT_SECRET || null,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresDays: toNumber(process.env.JWT_REFRESH_EXPIRES_DAYS, 30),
  },

  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || "localhost",
    port: toNumber(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME || "url_shortener",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
  },

  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  smtp: {
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: toNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASS || "",
    emailFrom: process.env.FROM_EMAIL || "",
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },

  rateLimit: {
    createUrl: {
      windowMs: toNumber(process.env.CREATE_URL_RATE_LIMIT_WINDOW_MS, 24 * 60 * 60 * 1000),
      max: toNumber(process.env.CREATE_URL_RATE_LIMIT_MAX, 100),
    },
    redirect: {
      windowMs: toNumber(process.env.REDIRECT_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      max: toNumber(process.env.REDIRECT_RATE_LIMIT_MAX, 100),
    },
  },

  cacheTtl: toNumber(process.env.CACHE_TTL_SECONDS, 6 * 60 * 60),
};
