const startAutoMonitor = require("../../services/admin/monitoring");
const { PrismaClient } = require("@prisma/client");
const redis = require("../../utils/redis");

const prisma = new PrismaClient();

// =========================
// MONITOR STATE (SAFE LOCK)
// =========================
let monitorStarted = false;

// =========================
// SAFE JSON PARSER
// =========================
function safeParse(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// =========================
// START MONITORING
// =========================
exports.startMonitor = async (req, res) => {
  try {
    // 🔥 double-safe lock (avoid race condition)
    if (monitorStarted) {
      return res.status(409).json({
        success: false,
        message: "Monitoring sudah berjalan",
      });
    }

    monitorStarted = true; // lock FIRST (important)

    await startAutoMonitor();

    return res.json({
      success: true,
      message: "Auto monitoring started (realtime only)",
    });
  } catch (err) {
    monitorStarted = false; // rollback lock if failed

    return res.status(500).json({
      success: false,
      message: "Gagal start monitoring",
      error: err.message,
    });
  }
};

// =========================
// STOP MONITORING
// =========================
exports.stopMonitor = async (req, res) => {
  try {
    monitorStarted = false;

    if (typeof startAutoMonitor?.stop === "function") {
      await startAutoMonitor.stop();
    }

    return res.json({
      success: true,
      message: "Monitoring stopped",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Gagal stop monitoring",
      error: err.message,
    });
  }
};

// =========================
// GET ROUTERS (WITH REALTIME)
// =========================
exports.getRouters = async (req, res) => {
  try {
    const routers = await prisma.router.findMany({
      include: { pppoeUsers: true },
    });

    const result = await Promise.all(
      routers.map(async (router) => {
        const realtimeRaw = await redis.get(
          `router:${router.id}:realtime`
        );

        return {
          ...router,
          realtime: safeParse(realtimeRaw) || {
            isOnline: false,
            traffic: {
              rx: { value: 0, unit: "bps", formatted: "0" },
              tx: { value: 0, unit: "bps", formatted: "0" },
            },
          },
        };
      })
    );

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Gagal ambil router",
      error: err.message,
    });
  }
};

// =========================
// GET ROUTER BY ID
// =========================
exports.getRouterById = async (req, res) => {
  try {
    const routerId = Number(req.params.id);

    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { pppoeUsers: true },
    });

    if (!router) {
      return res.status(404).json({
        success: false,
        message: "Router tidak ditemukan",
      });
    }

    const realtime = safeParse(
      await redis.get(`router:${routerId}:realtime`)
    );

    return res.json({
      success: true,
      data: {
        ...router,
        realtime: realtime || {
          isOnline: false,
          traffic: {
            rx: { value: 0, unit: "bps", formatted: "0" },
            tx: { value: 0, unit: "bps", formatted: "0" },
          },
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error get router",
      error: err.message,
    });
  }
};

// =========================
// GET SINGLE REALTIME
// =========================
exports.getRouterRealtime = async (req, res) => {
  try {
    const routerId = Number(req.params.id);

    const realtime = safeParse(
      await redis.get(`router:${routerId}:realtime`)
    );

    return res.json({
      success: true,
      data: realtime || {
        routerId,
        isOnline: false,
        traffic: {
          rx: { value: 0, unit: "bps", formatted: "0" },
          tx: { value: 0, unit: "bps", formatted: "0" },
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Gagal ambil realtime",
      error: err.message,
    });
  }
};

// =========================
// GET ALL REALTIME
// =========================
exports.getAllRealtime = async (req, res) => {
  try {
    const routers = await prisma.router.findMany({
      select: { id: true, name: true },
    });

    const result = await Promise.all(
      routers.map(async (router) => {
        const realtime = safeParse(
          await redis.get(`router:${router.id}:realtime`)
        );

        return {
          routerId: router.id,
          routerName: router.name,
          realtime: realtime || {
            isOnline: false,
            traffic: {
              rx: { value: 0, unit: "bps", formatted: "0" },
              tx: { value: 0, unit: "bps", formatted: "0" },
            },
          },
        };
      })
    );

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Gagal ambil realtime routers",
      error: err.message,
    });
  }
};