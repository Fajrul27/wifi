const { Server } = require("socket.io");
const redis = require("../utils/redis");

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  console.log("⚡ Socket.IO running");

  /* =========================
     CLIENT CONNECTION
  ========================= */
  io.on("connection", (socket) => {
    console.log("🟢 Client connected:", socket.id);

    socket.on("join-router", (routerId) => {
      const room = `router:${String(routerId)}`;

      socket.join(room);

      console.log("📡 Joined room:", room);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });

  /* =========================
     REDIS SUBSCRIBER (FIXED)
  ========================= */

  const sub = redis.duplicate();

  async function startSubscriber() {
    try {
      await sub.connect();
      console.log("🟡 Redis subscriber ready");

      // ⚠️ DEBUG: pastikan subscribe hidup
      await sub.pSubscribe("pppoe:*", (message, channel) => {
        console.log("🔥 REDIS EVENT:", channel);

        let payload;
        try {
          payload = JSON.parse(message);
        } catch (err) {
          console.error("❌ Invalid JSON from Redis:", message);
          return;
        }

        const routerId = channel.split(":")[1];
        const room = `router:${routerId}`;

        console.log("📤 EMIT TO ROOM:", room);

        io.to(room).emit("pppoe-update", payload);
      });

    } catch (err) {
      console.error("❌ Redis subscriber failed:", err.message);

      // auto retry biar production aman
      setTimeout(startSubscriber, 3000);
    }
  }

  startSubscriber();

  return io;
}

module.exports = initSocket;