const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    // 🔥 FIX: ambil dari COOKIE, bukan Authorization header
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    // 1. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Token tidak valid" });
    }

    // 2. Check blacklist
    const blacklisted = await prisma.blacklistedToken.findUnique({
      where: { token },
    });

    if (blacklisted) {
      return res.status(401).json({ message: "Token sudah di-logout" });
    }

    // 3. Attach user ke request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };

    next();

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = authMiddleware;