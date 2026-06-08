const { Server } = require("socket.io");
const redis = require("../utils/redis");

const debugSocket = process.env.DEBUG_SOCKET === "true";
const debugLog = (...args) => {
  if (debugSocket) console.log(...args);
};

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  debugLog("Socket.IO running");

  io.on("connection", (socket) => {
    debugLog("Client connected:", socket.id);

    socket.on("join-router", (routerId) => {
      const room = `router:${String(routerId)}`;
      socket.join(room);
      debugLog("Joined room:", room);
    });

    socket.on("leave-router", (routerId) => {
      const room = `router:${String(routerId)}`;
      socket.leave(room);
      debugLog("Left room:", room);
    });

    socket.on("disconnect", () => {
      debugLog("Client disconnected:", socket.id);
    });
  });

  const sub = redis.duplicate();

  async function startSubscriber() {
    try {
      if (!sub.isOpen) {
        await sub.connect();
      }
      debugLog("Redis subscriber ready");

      await sub.pSubscribe("pppoe:*", (message, channel) => {
        let payload;
        try {
          payload = JSON.parse(message);
        } catch (err) {
          console.error("Invalid JSON from Redis:", message);
          return;
        }

        const routerId = channel.split(":")[1];
        const room = `router:${routerId}`;
        debugLog("Emit to room:", room);

        io.to(room).emit("pppoe-update", payload);
        io.to(room).emit("pppoe-realtime", payload);
      });
    } catch (err) {
      console.error("Redis subscriber failed:", err.message);
      setTimeout(startSubscriber, 3000);
    }
  }

  startSubscriber();

  return io;
}

module.exports = initSocket;
