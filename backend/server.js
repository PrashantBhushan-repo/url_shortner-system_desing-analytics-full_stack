import { config } from "./src/config/config.js";
import { initRedis, closeRedisConnection } from "./src/config/redisClient.js";

const startServer = async () => {
  await initRedis();

  const { default: app } = await import("./src/app.js");

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.port} is already in use. Stop the other process or change PORT in .env.`,
      );
      console.error(`On Windows: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F`);
    } else {
      console.error("Server error:", err);
    }
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
