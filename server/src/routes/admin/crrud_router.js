const express = require("express");
const router = express.Router();

const controller = require("../../controllers/admin/crrud_router");

router.post("/", controller.createRouter);
router.get("/", controller.getRouters);
router.get("/:id", controller.getRouterById);
router.put("/:id", controller.updateRouter);
router.delete("/:id", controller.deleteRouter);

// 🔌 manual test koneksi
router.post("/:id/test-connection", controller.testConnection);

module.exports = router;