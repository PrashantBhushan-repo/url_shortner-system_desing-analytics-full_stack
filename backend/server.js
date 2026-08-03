import { config } from "./src/config/config.js";
import { initRedis, closeRedisConnection } from "./src/config/redisClient.js";
import { initSocket } from "./src/config/socket.js";
import { fork } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, "worker", "index.js");

const startServer = async () => {
  await initRedis();

  // Fork worker process so it runs in a separate process automatically
  let workerProcess = null;
  if (process.env.DISABLE_CHILD_WORKER !== "true") {
    console.log("Starting background ingestion worker process...");
    workerProcess = fork(workerPath, [], {
      env: { ...process.env, IS_CHILD_WORKER: "true" },
      stdio: "inherit"
    });

    workerProcess.on("error", (err) => {
      console.error("Worker process error:", err);
    });
  }

  const { default: app } = await import("./src/app.js");

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  initSocket(server);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.port} is already in use. Stop the other process or change PORT in .env.`,
      );
      console.error(`On Windows: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F`);
    } else {
      console.error("Server error:", err);
    }
    if (workerProcess) workerProcess.kill("SIGTERM");
    process.exit(1);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    if (workerProcess) workerProcess.kill("SIGTERM");
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
