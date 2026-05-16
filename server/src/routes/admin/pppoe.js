const express = require("express");

const router = express.Router();

const controller = require(
  "../../controllers/admin/pppoe.controller"
);

/* =========================
   ENGINE CONTROL
========================= */

// sync + start realtime engine
router.post(
  "/:routerId/sync",
  controller.sync
);

// realtime engine status
router.get(
  "/:routerId/realtime",
  controller.getRealtimeStatus
);

/* =========================
   USER LOCATION
========================= */

// update customer gps location
// harus di atas route "/:routerId"
router.put(
  "/:routerId/user/:id/location",
  controller.updateLocation
);

/* =========================
   LIVE MONITORING
========================= */

// active pppoe users
router.get(
  "/:routerId/active",
  controller.getActiveUsers
);

// interface realtime traffic
router.get(
  "/:routerId/interface",
  controller.getInterfaceStats
);

/* =========================
   USERS (DB + REALTIME)
========================= */

// list users + realtime rx tx
// HARUS PALING BAWAH
router.get(
  "/:routerId",
  controller.getUsers
);

/* =========================
   CRUD USER (Mikrotik + DB)
========================= */

// Daftar profile dari Mikrotik (untuk dropdown)
router.get("/:routerId/profiles", controller.getProfiles);

// Tambah user baru
router.post("/:routerId/user", controller.createUser);

// Edit user LENGKAP (password + profile + lokasi)
router.put("/:routerId/user/:id/full", controller.updateUserFull);

// Edit user (password, profile, comment)
router.put("/:routerId/user/:id", controller.updateUser);

// Hapus user
router.delete("/:routerId/user/:id", controller.deleteUser);

// Kick / putuskan sesi aktif
router.post("/:routerId/user/:id/kick", controller.kickUser);

module.exports = router;
