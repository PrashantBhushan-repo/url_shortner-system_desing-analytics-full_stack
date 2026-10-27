import prisma from "./prismaClient.js";
import { getJwtSecret } from "../utils/auth.utils.js";
import { createSocketAuthorization } from "../utils/socketAuthorization.js";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { config } from "./config.js";
import jwt from "jsonwebtoken";

let io = null;

const redisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableOfflineQueue: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

export const initSocket = (httpServer) => {
  // Create redis clients for socket.io adapter
  const pubClient = new Redis(config.redisUrl, redisOptions);
  pubClient.on("error", () => {});
  const subClient = pubClient.duplicate();
  subClient.on("error", () => {});

  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  try {
    io.adapter(createAdapter(pubClient, subClient));
  } catch (adapterErr) {
    console.warn("Socket.io Redis adapter fallback to in-memory:", adapterErr.message);
  }

  const access = createSocketAuthorization({
    verifyToken: token => jwt.verify(token, getJwtSecret()),
    findUser: id => prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, tokenVersion: true } }),
    findUrl: id => prisma.url.findUnique({ where: { id }, select: { id: true, user_id: true } }),
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) throw new Error("Authentication required");
      socket.accessToken = token;
      socket.user = await access.authenticate(token);
      next();
    } catch { next(new Error("Authentication required")); }
  });
  io.on("connection", socket => {
    const expiration = socket.user.expiresAt ? setTimeout(() => socket.disconnect(true), Math.max(0, socket.user.expiresAt - Date.now())) : null;
    socket.on("join-url", async (rawId, ack) => {
      try {
        await access.authorizeRoom(socket.accessToken, rawId);
        await socket.join(`url:${BigInt(rawId)}`);
        if (typeof ack === "function") ack({ success: true });
      } catch {
        if (typeof ack === "function") ack({ success: false, message: "Link unavailable" });
        socket.emit("analytics-error", { message: "Link unavailable" });
      }
    });
    socket.on("leave-url", rawId => { if (/^\d+$/.test(String(rawId))) socket.leave(`url:${BigInt(rawId)}`); });
    socket.on("disconnect", () => clearTimeout(expiration));
  });

  // Subscribe directly to redis worker pub/sub channel
  const redisSub = new Redis(config.redisUrl, redisOptions);
  redisSub.on("error", () => {});
  redisSub.psubscribe("ws:url:*", (err) => {
    if (err) {
      console.warn("Redis worker pubsub channel offline:", err.message);
    }
  });

  redisSub.on("pmessage", (pattern, channel, message) => {
    try {
      const parsed = JSON.parse(message);
      const urlId = parsed.urlId;
      if (io && urlId) {
        // Broadcast the live tick payload to the specific URL room
        io.to(`url:${urlId}`).emit("click-tick", parsed);
      }
    } catch (err) {
      console.error("Failed to parse Redis message:", err.message);
    }
  });

  return io;
};

export const getIo = () => io;
