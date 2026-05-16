const express = require("express");
const router = express.Router();

const TechnicianController = require("../../controllers/admin/technician.controller");
const authMiddleware = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");

/* =========================
   CREATE TEKNISI
   ADMIN ONLY
========================= */
router.post(
  "/technicians",
  authMiddleware,
  authorize(["ADMIN"]),
  TechnicianController.create
);

/* =========================
   GET ALL TEKNISI
   ADMIN ONLY
========================= */
router.get(
  "/technicians",
  authMiddleware,
  authorize(["ADMIN"]),
  TechnicianController.getAll
);

/* =========================
   GET BY ID TEKNISI
   ADMIN ONLY
========================= */
router.get(
  "/technicians/:id",
  authMiddleware,
  authorize(["ADMIN"]),
  TechnicianController.getById
);

/* =========================
   UPDATE TEKNISI
   ADMIN ONLY
========================= */
router.put(
  "/technicians/:id",
  authMiddleware,
  authorize(["ADMIN"]),
  TechnicianController.update
);

/* =========================
   DELETE TEKNISI
   ADMIN ONLY
========================= */
router.delete(
  "/technicians/:id",
  authMiddleware,
  authorize(["ADMIN"]),
  TechnicianController.delete
);

module.exports = router;