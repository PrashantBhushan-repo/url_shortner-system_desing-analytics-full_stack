import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(process.env.PORT, 5000),
  baseUrl: process.env.BASE_URL || "http://localhost:5000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || "localhost",
    port: toNumber(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME || "url_shortener",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
  },

  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  rateLimit: {
    createUrl: {
      windowMs: toNumber(process.env.CREATE_URL_RATE_LIMIT_WINDOW_MS, 24 * 60 * 60 * 1000),
      max: toNumber(process.env.CREATE_URL_RATE_LIMIT_MAX, 5),
    },
    redirect: {
      windowMs: toNumber(process.env.REDIRECT_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      max: toNumber(process.env.REDIRECT_RATE_LIMIT_MAX, 100),
    },
  },

  cacheTtl: toNumber(process.env.CACHE_TTL_SECONDS, 6 * 60 * 60),
};
