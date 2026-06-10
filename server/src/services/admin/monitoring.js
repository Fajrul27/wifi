const { RouterOSAPI } = require("node-routeros");
const prisma = require("../../utils/prisma");
const redis = require("../../utils/redis");
const { broadcast } = require("../../utils/socket");
const { decrypt } = require("../../utils/crypto");
const PppoeService = require("./PppoeService");

const clients = new Map();
const workers = new Map();
const pppoeServices = new Map();

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================
   SAFE CLOSE HELPER
========================= */
async function closeClientSafely(client) {
  if (!client) return;
  try {
    await Promise.race([
      client.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Close Timeout")), 2000))
    ]);
  } catch (err) {
    console.warn("[MONITOR] Safe close timeout/error, destroying connector:", err.message);
    try {
      if (client.connector) {
        client.connector.destroy();
      }
    } catch (e) {}
    client.connected = false;
    client.connecting = false;
    client.closing = false;
  }
}

/* =========================
   CLEANUP
========================= */
async function cleanupRouter(id) {
  const worker = workers.get(id);
  if (worker?.stop) worker.stop();

  workers.delete(id);

  const pppoeService = pppoeServices.get(id);
  if (pppoeService) {
    try {
      pppoeService.stopAutoRealtime();
    } catch {}
    pppoeServices.delete(id);
  }

  const client = clients.get(id);
  if (client) {
    await closeClientSafely(client);
    clients.delete(id);
  }

  console.log(`[MONITOR] cleaned router ${id}`);
}

/* =========================
   CLIENT
========================= */
async function getClient(router) {
  const existing = clients.get(router.id);
  if (existing?.connected) return existing;

  const client = new RouterOSAPI({
    host: router.host,
    user: router.username,
    password: decrypt(router.password),
    port: router.port || 8728,
    timeout: 10,
  });

  client.on("error", (e) =>
    console.error(`[RouterOS ${router.id} ERROR]`, e?.message || String(e))
  );

  client.on("close", () =>
    console.warn(`[RouterOS ${router.id} CLOSED]`)
  );

  try {
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection Timeout")), 10000);
    });
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    await closeClientSafely(client).catch(() => {});
    throw err;
  }

  clients.set(router.id, client);

  console.log(`✅ Connected: ${router.name}`);

  return client;
}

/* =========================
   WRITE WITH TIMEOUT
========================= */
async function writeWithTimeout(client, path, params, timeoutMs = 15000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Write Timeout (Router disconnected?)")), timeoutMs);
  });

  const req = params ? client.write(path, params) : client.write(path);
  
  try {
    return await Promise.race([req, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/* =========================
   SYSTEM
========================= */
async function getSystem(client) {
  const res = await writeWithTimeout(client, "/system/resource/print");
  const d = res?.[0] || {};

  return {
    cpuLoad: Number(d["cpu-load"] || 0),
    freeMemory: Number(d["free-memory"] || 0),
    totalMemory: Number(d["total-memory"] || 0),
    uptime: d["uptime"] || "-",
    version: d["version"] || "-",
    boardName: d["board-name"] || "-",
  };
}

/* =========================
   TRAFFIC (🔥 PPPoE STYLE CONTRACT)
========================= */
async function getTraffic(client, iface = "ether1") {
  const res = await writeWithTimeout(client, "/interface/monitor-traffic", [
    `=interface=${iface}`,
    "=once",
  ]);

  const d = res?.[0] || {};

  return {
    rxBps: Number(d["rx-bits-per-second"] || 0),
    txBps: Number(d["tx-bits-per-second"] || 0),
  };
}

/* =========================
   REDIS
========================= */
async function saveRealtime(routerId, data) {
  await redis.set(
    `router:${routerId}:realtime`,
    JSON.stringify(data),
    { EX: 30 }
  );
}

/* =========================
   WORKER LOOP
========================= */
async function startRouterWorker(router) {
  if (workers.has(router.id)) return;

  let running = true;

  console.log(`[MONITOR] starting router ${router.id}`);

  // Start PPPoE realtime monitoring
  try {
    const pppoeService = new PppoeService(router);
    pppoeService.startAutoRealtime();
    pppoeServices.set(router.id, pppoeService);
  } catch (err) {
    console.error(`[PPPOE MONITOR ERROR ${router.id}]`, err.message);
  }

  const loop = async () => {
    while (running) {
      try {
        const client = await getClient(router);

        const system = await getSystem(client);
        const traffic = await getTraffic(
          client,
          router.interface || "ether1"
        );

        const realtime = {
          routerId: router.id,
          routerName: router.name,
          isOnline: true,
          system,

          // 🔥 SAME FORMAT AS PPPoE STYLE
          traffic: {
            rxBps: traffic.rxBps,
            txBps: traffic.txBps,
          },

          updatedAt: Date.now(),
        };

        await saveRealtime(router.id, realtime);

        await prisma.router.update({
          where: { id: router.id },
          data: {
            isOnline: true,
            lastSeen: new Date(),
          },
        });

        broadcast({
          type: "router-realtime",
          routerId: router.id,
          data: realtime,
        });

        if (global.io) {
          const room = `router:${router.id}`;
          global.io.to(room).emit("router-status", {
            routerId: router.id,
            isOnline: true,
          });
        }

        await delay(2000);
      } catch (err) {
        console.warn(`⚠️ Router OFFLINE: ${router.name}`, err.message || err);

        const offline = {
          routerId: router.id,
          routerName: router.name,
          isOnline: false,
          updatedAt: Date.now(),
        };

        await saveRealtime(router.id, offline);

        try {
          await prisma.router.update({
            where: { id: router.id },
            data: { isOnline: false },
          });
        } catch {}

        const client = clients.get(router.id);
        if (client) {
          await closeClientSafely(client);
          clients.delete(router.id);
        }

        broadcast({
          type: "router-status",
          routerId: router.id,
          data: { isOnline: false },
        });

        if (global.io) {
          const room = `router:${router.id}`;
          global.io.to(room).emit("router-status", {
            routerId: router.id,
            isOnline: false,
          });
        }

        await delay(5000);
      }
    }
  };

  loop().catch(async (err) => {
    console.error(`[WORKER CRASH ${router.id}]`, err.message);
    await cleanupRouter(router.id);
  });

  workers.set(router.id, {
    stop: () => (running = false),
  });
}

/* =========================
   AUTO MONITOR
========================= */
async function startAutoMonitor() {
  console.log("🚀 Auto Monitor Started");

  const routers = await prisma.router.findMany();

  for (const r of routers) {
    await startRouterWorker(r);
  }

  setInterval(async () => {
    const routers = await prisma.router.findMany();

    for (const r of routers) {
      if (!workers.has(r.id)) {
        await startRouterWorker(r);
      }
    }
  }, 10000);
}

startAutoMonitor.stopRouterWorker = async (id) => {
  await cleanupRouter(id);
};

startAutoMonitor.startRouterWorker = async (router) => {
  await startRouterWorker(router);
};

startAutoMonitor.stop = async () => {
  for (const id of Array.from(workers.keys())) {
    await cleanupRouter(id);
  }
};

module.exports = startAutoMonitor;