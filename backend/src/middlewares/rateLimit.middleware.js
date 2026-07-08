    import rateLimit from "express-rate-limit";
    import RedisStore from "rate-limit-redis";
    import { getRedisClient } from "../config/redisClient.js";
    import { config } from "../config/config.js";
    import { AppError } from "../utils/AppError.js";

    const createLimiter = (options) => {
      const limiterOptions = {
        windowMs: options.windowMs,
        max: options.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next) => {
          res.setHeader("Retry-After", Math.ceil(options.windowMs / 1000));
          next(new AppError(options.message || "Too many requests. Please try again later.", 429));
        },
      };

  const client = getRedisClient();
  if (client) {
    try {
      limiterOptions.store = new RedisStore({
        sendCommand: (command, ...args) => client.call(command, ...args),
        prefix: `rate_limit:${options.prefix}:`,
      });
    } catch (err) {
      console.warn(`Redis store unavailable for ${options.prefix}, using memory store:`, err.message);
    }
  }

  return rateLimit(limiterOptions);
};

export const createUrlLimiter = createLimiter({
  windowMs: config.rateLimit.createUrl.windowMs,
  max: config.rateLimit.createUrl.max,
  prefix: "create_url",
  message: "Too many URL creation requests. Free tier allows 5 URLs per day.",
});

export const redirectLimiter = createLimiter({
  windowMs: config.rateLimit.redirect.windowMs,
  max: config.rateLimit.redirect.max,
  prefix: "redirect",
  message: "Too many redirect requests. Please slow down.",
});
