import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "../config/redisClient.js";

export const attachSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: true, credentials: true },
  });

  const pubClient = getRedisClient()?.duplicate();
  const subClient = getRedisClient()?.duplicate();

  if (pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
  }

  io.on("connection", (socket) => {
    socket.on("join-room", ({ roomType, roomId }) => {
      if (roomType === "url") {
        socket.join(`url:${roomId}`);
      }
      if (roomType === "account") {
        socket.join(`account:${roomId}`);
      }
    });
  });

  subClient?.on("pmessage", (_pattern, _channel, message) => {
    try {
      const payload = JSON.parse(message);
      io.to(`url:${payload.urlId}`).emit("analytics:update", payload);
    } catch {
      // ignore malformed payloads
    }
  });

  subClient?.psubscribe("ws:*", () => {
    console.log("Socket.io live analytics subscription active");
  });

  return io;
};
