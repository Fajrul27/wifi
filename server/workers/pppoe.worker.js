const MikrotikService = require("../src/services/mikrotik.service");
const prisma = require("../src/utils/prisma");
const redis = require("../src/utils/redis");
const pLimit = require("p-limit");

const INTERVAL = 5000;
const CONCURRENCY = 5;

const limit = pLimit(CONCURRENCY);

let isRunning = false;

/* =========================
   PROCESS ROUTER (FIXED)
========================= */
async function processRouter(router) {
  try {
    // 🔥 ambil data dashboard
    const data = await MikrotikService.cacheDashboard(router.id);

    // 🔥 PUBLISH KE REDIS (INI YANG HILANG SEBELUMNYA)
    await redis.publish(
      `pppoe:${router.id}`,
      JSON.stringify(data)
    );

    console.log(`✔ router ${router.id} published`);
  } catch (err) {
    console.log(`✖ router ${router.id}: ${err.message}`);
  }
}

/* =========================
   CORE WORKER LOOP
========================= */
async function tick() {
  if (isRunning) {
    console.log("⏳ skip tick (still running)");
    return;
  }

  isRunning = true;

  try {
    const routers = await prisma.router.findMany();

    if (!routers.length) {
      console.log("⚠ no routers found");
      return;
    }

    await Promise.all(
      routers.map((r) =>
        limit(() => processRouter(r))
      )
    );

  } catch (err) {
    console.error("❌ worker error:", err.message);
  } finally {
    isRunning = false;
  }
}

/* =========================
   START WORKER
========================= */
function start() {
  console.log("🚀 ENTERPRISE WORKER STARTED");

  tick();
  setInterval(tick, INTERVAL);
}

start();