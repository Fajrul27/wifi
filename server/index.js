const express = require("express");
const http = require("http");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

require("./src/cron/cleanupMetrics");

/* =========================
   BIGINT FIX 🔥 (WAJIB)
========================= */
BigInt.prototype.toJSON = function () {
  return this.toString();
};

/* =========================
   ROUTES
========================= */
const authRoutes = require("./src/routes/auth");
const crudTeknisiRoutes = require("./src/routes/admin/crud_teknisi");
const crudRouter = require("./src/routes/admin/crrud_router");
const pppoeUser = require("./src/routes/admin/pppoe");
const monitoring = require("./src/routes/admin/monitoring");
const speedProfileRoutes = require("./src/routes/admin/speedProfile");
const topologyRoutes = require('./src/routes/topology/topology.routes');
const oltPortRoutes = require('./src/routes/topology/oltPort.routes');
const fiberAssignmentRoutes = require("./src/routes/topology/fiberAssignment.routes");
const splitter = require("./src/routes/topology/splitter.routes");

/* =========================
   SOCKET INIT
========================= */
const initSocket = require("./src/socket");

/* =========================
   MONITOR SERVICE (AUTO)
========================= */
const startAutoMonitoring = require("./src/services/admin/monitoring");

const app = express();
const server = http.createServer(app);

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:5001",
    ],
    credentials: true,
  })
);

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    socket: "enabled",
    time: new Date().toISOString(),
  });
});

/* =========================
   ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/admin", crudTeknisiRoutes);
app.use("/api/routers", crudRouter);
app.use("/api/pppoe", pppoeUser);
app.use("/api/monitoring", monitoring);

app.use('/api/topology', topologyRoutes);
app.use("/api/olt-ports", oltPortRoutes);
app.use("/api/fiber", fiberAssignmentRoutes);
app.use("/api/splitter", splitter);
app.use("/api/speed-profiles", speedProfileRoutes);
/* =========================
   SOCKET INIT (SAFE)
========================= */
const io = initSocket(server);
global.io = io;

/* =========================
   START MONITORING AFTER SERVER READY
========================= */
server.listen(process.env.PORT || 3000, async () => {
  console.log(`🚀 Server running on ports ${process.env.PORT || 3000}`);
  console.log(`⚡ Socket.IO enabled`);

  // 🔥 START AUTO MONITOR (EVENT-DRIVEN)
  try {
    await startAutoMonitoring();
    console.log("📡 Auto Monitoring Started");
  } catch (err) {
    console.error("❌ Monitoring failed:", err.message);
  }
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route tidak ditemukan",
  });
});

/* =========================
   GLOBAL ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});