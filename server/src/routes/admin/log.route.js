const express = require("express");
const router = express.Router();
const logController = require("../../controllers/admin/log.controller");
const verifyToken = require("../../Middleware/auth.middleware");
const roleCheck = require("../../Middleware/role.middleware");

router.get("/", verifyToken, roleCheck(["ADMIN"]), logController.getRecentLogs);

module.exports = router;
