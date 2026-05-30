const { RouterOSAPI } = require("node-routeros");
const { encrypt, decrypt } = require("../../utils/crypto");
const prisma = require("../../utils/prisma");

class RouterService {

  // =========================
  // SANITIZE (FOR API RESPONSE)
  // =========================
  sanitize(router) {
    if (!router) return null;

    const { password, ...clean } = router;
    return clean;
  }

  // =========================
  // CREATE (ENCRYPT PASSWORD)
  // =========================
  async create(data) {
    const router = await prisma.router.create({
      data: {
        name: data.name,
        host: data.host,
        username: data.username,
        password: encrypt(data.password), // 🔐 encrypted
        port: Number(data.port) || 8728,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    });

    return this.sanitize(router);
  }

  // =========================
  // FIND ALL (SAFE)
  // =========================
  async findAll() {
    const routers = await prisma.router.findMany({
      orderBy: { createdAt: "desc" },
    });

    return routers.map(r => this.sanitize(r));
  }

  // =========================
  // FIND SAFE (NO PASSWORD)
  // =========================
  async findById(id) {
    const router = await prisma.router.findUnique({
      where: { id: Number(id) },
    });

    return this.sanitize(router);
  }

  // =========================
  // FIND RAW (FOR INTERNAL USE ONLY)
  // =========================
  async findRawById(id) {
    return prisma.router.findUnique({
      where: { id: Number(id) },
    });
  }

  // =========================
  // GET ROUTER READY FOR CONNECTION
  // =========================
  async getConnectionData(id) {
    const router = await this.findRawById(id);

    if (!router) return null;

    return {
      ...router,
      password: decrypt(router.password), // 🔓 decrypt ONLY here
    };
  }

  // =========================
  // UPDATE
  // =========================
  async update(id, data) {
    const existing = await prisma.router.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      throw new Error("Router tidak ditemukan");
    }

    const payload = {
      name: data.name ?? existing.name,
      host: data.host ?? existing.host,
      username: data.username ?? existing.username,
      port: Number(data.port) || existing.port,
      latitude: data.latitude ?? existing.latitude,
      longitude: data.longitude ?? existing.longitude,
    };

    if (data.password?.trim()) {
      payload.password = encrypt(data.password);
    }

    const updated = await prisma.router.update({
      where: { id: Number(id) },
      data: payload,
    });

    return this.sanitize(updated);
  }

  // =========================
  // DELETE
  // =========================
  async delete(id) {
    const routerId = Number(id);

    const existing = await prisma.router.findUnique({
      where: { id: routerId },
    });

    if (!existing) {
      throw new Error("Router tidak ditemukan");
    }

    return prisma.router.delete({
      where: { id: routerId },
    });
  }

  // =========================
  // TEST CONNECTION (FIXED)
  // =========================
  async testConnection(id) {
    const router = await this.getConnectionData(id);

    if (!router) {
      throw new Error("Router tidak ditemukan");
    }

    const client = new RouterOSAPI({
      host: router.host,
      user: router.username,
      password: router.password, // 🔓 already decrypted
      port: router.port || 8728,
      timeout: 10000,
    });

    let isOnline = false;

    try {
      await client.connect();
      isOnline = true;
      await client.close();
    } catch (err) {
      console.error("Router connection failed:", err.message);
    }

    try {
      await prisma.router.update({
        where: { id: router.id },
        data: {
          isOnline,
          lastSeen: isOnline ? new Date() : router.lastSeen,
        },
      });
    } catch (err) {
      console.error("Failed update router status:", err.message);
    }

    return {
      routerId: router.id,
      isOnline,
      lastSeen: isOnline ? new Date() : router.lastSeen,
    };
  }
}

module.exports = new RouterService();