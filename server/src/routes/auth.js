const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/auth.controller");
const authMiddleware = require("../Middleware/auth.middleware");
const authorize = require("../Middleware/role.middleware");

/* =========================
   AUTH BASIC
========================= */

// LOGIN
router.post("/login", AuthController.login);

// LOGOUT
router.post("/logout", authMiddleware, AuthController.logout);

// ME (current user)
router.get("/me", authMiddleware, AuthController.me);

// UPDATE PROFILE
router.put("/profile", authMiddleware, AuthController.updateProfile);

module.exports = router;