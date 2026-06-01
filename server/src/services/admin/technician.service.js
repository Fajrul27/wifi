const bcrypt = require("bcrypt");
const prisma = require("../../utils/prisma");

class TechnicianService {

  /* =========================
     CREATE TEKNISI (ADMIN ONLY)
  ========================= */
  static async create(adminUser, data) {
    if (adminUser.role !== "ADMIN") {
      throw new Error("Akses ditolak");
    }

    const { username, email, password, status, area, phone } = data;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      throw new Error("Email atau username sudah digunakan");
    }

    const hashed = await bcrypt.hash(password, 10);

    return await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        role: "TEKNISI",
        status: status || "AKTIF",
        area: area || null,
        phone: phone || null,
      },
    });
  }

  /* =========================
     GET ALL TEKNISI
  ========================= */
  static async getAll() {
    return await prisma.user.findMany({
      where: { role: "TEKNISI" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        area: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  /* =========================
     GET BY ID TEKNISI
  ========================= */
  static async getById(id) {
    const user = await prisma.user.findUnique({
      where: { id, role: "TEKNISI" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        area: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User teknisi tidak ditemukan");
    }

    return user;
  }

  /* =========================
     UPDATE TEKNISI (ADMIN ONLY)
  ========================= */
  static async update(adminUser, id, data) {
    if (adminUser.role !== "ADMIN") {
      throw new Error("Akses ditolak");
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    // cek duplicate username/email (optional tapi bagus)
    if (data.username || data.email) {
      const existing = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                { email: data.email },
                { username: data.username },
              ],
            },
          ],
        },
      });

      if (existing) {
        throw new Error("Email atau username sudah digunakan");
      }
    }

    return await prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        email: data.email,
        ...(data.status !== undefined && { status: data.status }),
        ...(data.area !== undefined && { area: data.area }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.password && {
          password: await bcrypt.hash(data.password, 10),
        }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        area: true,
        phone: true,
      }
    });
  }

  /* =========================
     DELETE TEKNISI
  ========================= */
  static async delete(adminUser, id) {
    if (adminUser.role !== "ADMIN") {
      throw new Error("Akses ditolak");
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    return await prisma.user.delete({
      where: { id },
    });
  }
}

module.exports = TechnicianService;