const express = require("express");

const router = express.Router();

const controller = require(
  "../../controllers/admin/pppoe.controller"
);
const authorize = require("../../Middleware/role.middleware");

const adminOnly = authorize(["ADMIN"]);

/* =========================
   ENGINE CONTROL
========================= */

// sync + start realtime engine
router.post(
  "/:routerId/sync",
  adminOnly,
  controller.sync
);

// realtime engine status
router.get(
  "/:routerId/realtime",
  controller.getRealtimeStatus
);

/* =========================
   PPP PROFILES
========================= */

// list mikrotik ppp profiles
router.get(
  "/:routerId/profiles",
  controller.getProfiles
);

/* =========================
   USER LOCATION
========================= */

// update customer gps location
router.put(
  "/:routerId/user/:id/location",
  adminOnly,
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
   PPPoE USER MANAGEMENT
========================= */

// get detail user
router.get(
  "/:routerId/user/:username",
  controller.getUser
);

// add user
router.post(
  "/:routerId/user",
  adminOnly,
  controller.addUser
);

// edit user
router.put(
  "/:routerId/user/:username",
  adminOnly,
  controller.updateUser
);

// kick user
router.post(
  "/:routerId/user/:username/kick",
  adminOnly,
  controller.kickUser
);

// delete user
router.delete(
  "/:routerId/user/:username",
  adminOnly,
  controller.deleteUser
);



/* =========================
   USERS (DB + REALTIME)
========================= */

// HARUS PALING BAWAH
router.get(
  "/:routerId",
  controller.getUsers
);

module.exports = router;
