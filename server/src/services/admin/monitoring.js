const { PrismaClient } = require("@prisma/client");
const PppoeService = require("./PppoeService");
const redis = require("../../utils/redis");
const { RouterOSAPI } = require("node-routeros");
const { decrypt } = require("../../utils/crypto");

const prisma = new PrismaClient();

// Map: routerId -> PppoeService instance
const pppoeServices = new Map();

// Map: routerId -> RouterOS monitoring worker
const workers = new Map();

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================
   DAPATKAN / BUAT PppoeService
========================= */
function getPppoeService(router) {
  if (!pppoeServices.has(router.id)) {
    pppoeServices.set(router.id, new PppoeService(router));
  }
  return pppoeServices.get(router.id);
}

/* =========================
   WORKER LOOP PER ROUTER
   (Monitoring sistem + otomatis start PPPoE sync)
========================= */
async function startRouterWorker(router) {
  if (workers.has(router.id)) return;

  let running = true;
  console.log(`[MONITOR] 🚀 Starting worker for router: ${router.name} (${router.host})`);

  // ─── Otomatis start PPPoE realtime loop ───
  // Ini memastikan sync jalan TANPA perlu klik tombol atau restart FE/BE
  const pppoeService = getPppoeService(router);
  pppoeService.startAutoRealtime();

  const loop = async () => {
    while (running) {
      try {
        // Gunakan pppoeService.write agar tidak membuat koneksi baru dan tidak memicu API reset di Mikrotik
        let system = null;
        try {
          const res = await pppoeService.write("/system/resource/print");
          const d = res?.[0] || {};
          system = {
            cpuLoad: Number(d["cpu-load"] || 0),
            freeMemory: Number(d["free-memory"] || 0),
            totalMemory: Number(d["total-memory"] || 0),
            uptime: d["uptime"] || "-",
            version: d["version"] || "-",
            boardName: d["board-name"] || "-",
          };
        } catch { }

        let traffic = { rxBps: 0, txBps: 0 };
        try {
          const res = await pppoeService.write("/interface/monitor-traffic", [
            `=interface=${router.interface || "ether1"}`,
            "=once",
          ]);
          const d = res?.[0] || {};
          traffic = {
            rxBps: Number(d["rx-bits-per-second"] || 0),
            txBps: Number(d["tx-bits-per-second"] || 0),
          };
        } catch { }

        const realtime = {
          routerId: router.id,
          routerName: router.name,
          isOnline: true,
          system,
          traffic,
          updatedAt: Date.now(),
        };

        // Simpan ke Redis & broadcast ke frontend
        try {
          await redis.set(
            `router:${router.id}:realtime`,
            JSON.stringify(realtime),
            { EX: 30 }
          );
        } catch { }

        await prisma.router.update({
          where: { id: router.id },
          data: { isOnline: true, lastSeen: new Date() },
        });

        if (global.io) {
          global.io.emit("router-realtime", { routerId: router.id, data: realtime });
        }

        await delay(3000);

      } catch (err) {
        // ─── Router tidak bisa diakses ───
        console.warn(`[MONITOR] ⚠️ Router OFFLINE: ${router.name} (${router.host}) — ${err.message}`);

        const offline = {
          routerId: router.id,
          routerName: router.name,
          isOnline: false,
          updatedAt: Date.now(),
        };

        try {
          await redis.set(
            `router:${router.id}:realtime`,
            JSON.stringify(offline),
            { EX: 30 }
          );
        } catch { }

        try {
          await prisma.router.update({
            where: { id: router.id },
            data: { isOnline: false },
          });
        } catch { }

        if (global.io) {
          global.io.emit("router-status", {
            routerId: router.id,
            data: { isOnline: false }
          });
        }

        // Tunggu 5 detik lalu coba lagi
        // PppoeService juga punya loop reconnect-nya sendiri di sini
        await delay(5000);
      }
    }
  };

  loop().catch(async (err) => {
    console.error(`[WORKER CRASH ${router.id}]`, err.message);
    workers.delete(router.id);

    // Restart worker setelah crash
    setTimeout(() => startRouterWorker(router), 10000);
  });

  workers.set(router.id, {
    stop: () => {
      running = false;
      // Stop PPPoE service juga
      const svc = pppoeServices.get(router.id);
      if (svc) svc.stopAutoRealtime();
    },
  });
}

/* =========================
   STOP WORKER
========================= */
async function stopRouterWorker(id) {
  const worker = workers.get(id);
  if (worker?.stop) worker.stop();
  workers.delete(id);

  const svc = pppoeServices.get(id);
  if (svc) svc.stopAutoRealtime();
  pppoeServices.delete(id);

  console.log(`[MONITOR] Worker router ${id} dihentikan.`);
}

/* =========================
   AUTO MONITOR - ENTRY POINT
   Dipanggil saat server start dari index.js
========================= */
async function startAutoMonitor() {
  console.log("📡 Auto Monitor Starting...");

  // Ambil semua router dari DB dan start worker-nya
  const routers = await prisma.router.findMany();
  for (const r of routers) {
    await startRouterWorker(r);
  }

  console.log(`✅ Auto Monitor aktif untuk ${routers.length} router.`);
  console.log(`✅ PPPoE Auto-Sync aktif — tidak perlu restart FE/BE.`);

  // Cek setiap 10 detik apakah ada router baru yang perlu di-monitor
  setInterval(async () => {
    try {
      const routers = await prisma.router.findMany();
      for (const r of routers) {
        if (!workers.has(r.id)) {
          console.log(`[MONITOR] Router baru ditemukan: ${r.name}, memulai worker...`);
          await startRouterWorker(r);
        }
      }
    } catch (err) {
      console.error("[MONITOR] Gagal cek router baru:", err.message);
    }
  }, 10000);
}

module.exports = startAutoMonitor;
module.exports.stopRouterWorker = stopRouterWorker;
module.exports.getPppoeService = getPppoeService;