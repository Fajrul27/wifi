const express = require("express");
const router = express.Router();

const monitorController = require("../../controllers/admin/monitoring");

// =========================
// MONITOR CONTROL
// =========================
router.post("/monitor/start", monitorController.startMonitor);
router.post("/monitor/stop", monitorController.stopMonitor);

// =========================
// ROUTER MANAGEMENT
// =========================
router.get("/routers", monitorController.getRouters);
router.get("/routers/:id", monitorController.getRouterById);

// =========================
// REALTIME ENDPOINTS (REDIS)
// =========================
router.get("/routers/realtime/all", monitorController.getAllRealtime);
router.get("/routers/:id/realtime", monitorController.getRouterRealtime);

module.exports = router;