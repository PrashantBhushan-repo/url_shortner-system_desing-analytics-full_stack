import app from "./src/app.js";
import { config } from "./src/config/config.js";
import { initRedis, closeRedisConnection } from "./src/config/redisClient.js";

const startServer = async () => {
  await initRedis();

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await closeRedisConnection();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

startServer();
