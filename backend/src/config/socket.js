import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { config } from "./config.js";
import jwt from "jsonwebtoken";

let io = null;

export const initSocket = (httpServer) => {
  // Create redis clients for socket.io adapter
  const pubClient = new Redis(config.redisUrl);
  const subClient = pubClient.duplicate();

  io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Middleware to authenticate socket connections using JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (User: ${socket.user?.id})`);

    // Listen for users joining/leaving specific URL rooms
    socket.on("join-url", (urlId) => {
      socket.join(`url:${urlId}`);
      console.log(`User ${socket.user.id} joined room url:${urlId}`);
    });

    socket.on("leave-url", (urlId) => {
      socket.leave(`url:${urlId}`);
      console.log(`User ${socket.user.id} left room url:${urlId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  // Subscribe directly to redis worker pub/sub channel
  const redisSub = new Redis(config.redisUrl);
  redisSub.psubscribe("ws:url:*", (err) => {
    if (err) {
      console.error("Failed to subscribe to Redis worker channel:", err.message);
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
