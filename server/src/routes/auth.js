const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

/* =========================
   AUTH BASIC
========================= */

// LOGIN
router.post("/login", AuthController.login);

// LOGOUT
router.post("/logout", authMiddleware, AuthController.logout);

// ME (current user)
router.get("/me", authMiddleware, AuthController.me);

module.exports = router;