import express from "express";
import cors from "cors";

import urlRoutes from "./routes/url.routes.js";
import { redirectUrl } from "./controllers/url.controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { validateShortCodeParam } from "./middlewares/validateShortCode.middleware.js";
import { globalLimiter } from "./middlewares/rateLimit.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(globalLimiter);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SnapURL API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/urls", urlRoutes);

app.get("/:shortCode", validateShortCodeParam, redirectUrl);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
