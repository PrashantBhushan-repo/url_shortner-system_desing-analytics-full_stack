import express from "express";
import cors from "cors";
import helmet from "helmet";

import urlRoutes from "./routes/url.routes.js";
import { redirectUrl } from "./controllers/url.controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { validateShortCodeParam } from "./middlewares/validateShortCode.middleware.js";
import { redirectLimiter } from "./middlewares/rateLimit.middleware.js";
import { config } from "./config/config.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SnapURL API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/urls", urlRoutes);
app.get("/:shortCode", redirectLimiter, validateShortCodeParam, redirectUrl);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
