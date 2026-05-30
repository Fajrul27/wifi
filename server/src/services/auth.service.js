const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const redis = require("../utils/redis");
const prisma = require("../utils/prisma");

/* =========================
   JWT GENERATOR
========================= */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

class AuthService {

  /* =========================
     LOGIN
  ========================= */
  static async login(identifier, password) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });

    if (!user) throw new Error("User tidak ditemukan");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Password salah");

    const token = generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  /* =========================
     GET PROFILE
  ========================= */
  static async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) throw new Error("User tidak ditemukan");

    return user;
  }

  /* =========================
     LOGOUT (BLACKLIST TOKEN)
  ========================= */
  static async logout(token) {
    if (!token) return;

    const decoded = jwt.decode(token);
    if (!decoded) return;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await redis.setEx(`blacklist:${token}`, ttl, "1");
    }
  }

  /* =========================
     CHECK BLACKLIST
  ========================= */
  static async isTokenBlacklisted(token) {
    const result = await redis.get(`blacklist:${token}`);
    return !!result;
  }
}

module.exports = AuthService;