const jwt = require("jsonwebtoken");
const AuthService = require("../services/auth.service");

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) throw new Error("Unauthorized");

    const blacklisted = await AuthService.isTokenBlacklisted(token);
    if (blacklisted) throw new Error("Token expired");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};