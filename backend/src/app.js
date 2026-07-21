import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import urlRoutes from "./routes/url.routes.js";
import authRoutes from "./routes/auth.routes.js";
import securityRoutes from "./routes/security.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { redirectUrl } from "./controllers/url.controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { validateShortCodeParam } from "./middlewares/validateShortCode.middleware.js";
import {
  createUrlLimiter,
  redirectLimiter,
} from "./middlewares/rateLimit.middleware.js";
import { config } from "./config/config.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SnapURL API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/urls", urlRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/analytics", analyticsRoutes);
app.get("/:shortCode", redirectLimiter, validateShortCodeParam, redirectUrl);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
