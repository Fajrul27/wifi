const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("❌ Redis reconnect failed");
        return new Error("Retry exhausted");
      }
      return Math.min(retries * 200, 3000);
    },
  },
});

redis.on("connect", () => {
  console.log("🟡 Redis connecting...");
});

redis.on("ready", () => {
  console.log("🟢 Redis ready");
});

redis.on("error", (err) => {
  console.error("🔴 Redis Error:", err.message);
});

redis.on("end", () => {
  console.log("⚠️ Redis disconnected");
});

(async () => {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
  } catch (err) {
    console.error("❌ Redis initial failed:", err.message);
  }
})();

module.exports = redis;