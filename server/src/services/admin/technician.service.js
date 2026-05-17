const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class TechnicianService {

  /* =========================
     CREATE TEKNISI / USER (ADMIN ONLY)
  ========================= */
  static async create(adminUser, username, email, password, role = "TEKNISI") {
    if (adminUser.role !== "ADMIN") {
      throw new Error("Akses ditolak");
    }

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
        role,
      },
    });
  }

  /* =========================
     GET ALL USERS (EXCEPT MAIN ADMIN)
  ========================= */
  static async getAll() {
    return await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  /* =========================
     UPDATE TEKNISI / USER (ADMIN ONLY)
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
        ...(data.role && { role: data.role }),
        ...(data.password && {
          password: await bcrypt.hash(data.password, 10),
        }),
      },
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