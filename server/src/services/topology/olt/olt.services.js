const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

class OltService {

  // =====================================================
  // CREATE OLT
  // =====================================================

  async create(data) {

    if (
      !data.routerId ||
      !data.name ||
      data.latitude === undefined ||
      data.longitude === undefined
    ) {
      throw new Error(
        "routerId, name, latitude, longitude wajib diisi"
      );
    }

    const routerId = Number(data.routerId);

    if (isNaN(routerId)) {
      throw new Error("routerId tidak valid");
    }

    // =====================================================
    // CHECK ROUTER
    // =====================================================

    const router = await prisma.router.findUnique({
      where: {
        id: routerId,
      },
    });

    if (!router) {
      throw new Error("Router tidak ditemukan");
    }

    // =====================================================
    // CHECK DUPLICATE OLT
    // =====================================================

    const existing = await prisma.olt.findFirst({
      where: {
        routerId,
        name: data.name.trim(),
      },
    });

    if (existing) {
      throw new Error("OLT sudah ada pada router ini");
    }

    // =====================================================
    // CREATE OLT
    // =====================================================

    return await prisma.olt.create({
      data: {
        routerId,

        name: data.name.trim(),

        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
      },

      include: {
        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
            latitude: true,
            longitude: true,
            lastSeen: true,
          },
        },

        ports: {
          include: {
            odcs: true,
          },
        },

        _count: {
          select: {
            ports: true,
          },
        },
      },
    });
  }

// =====================================================
// ADD PORTS
// =====================================================

async addPorts(oltId, data) {

  const id = Number(oltId);

  if (isNaN(id)) {
    throw new Error("oltId tidak valid");
  }

  const olt = await prisma.olt.findUnique({
    where: {
      id,
    },
  });

  if (!olt) {
    throw new Error("OLT tidak ditemukan");
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  if (
    !Array.isArray(data.ports) ||
    data.ports.length === 0
  ) {
    throw new Error("ports wajib diisi");
  }

  // =====================================================
  // FORMAT PORTS
  // =====================================================

  const ports = data.ports
    .map((item) => Number(item))
    .filter((item) => !isNaN(item));

  // =====================================================
  // REMOVE DUPLICATE INPUT
  // =====================================================

  const uniquePorts = [...new Set(ports)];

  // =====================================================
  // CHECK EXISTING PORT
  // =====================================================

  const existingPorts = await prisma.oltPort.findMany({
    where: {
      oltId: id,

      index: {
        in: uniquePorts,
      },
    },
  });

  const existingIndexes = existingPorts.map(
    (item) => item.index
  );

  const newPorts = uniquePorts.filter(
    (item) => !existingIndexes.includes(item)
  );

  if (newPorts.length === 0) {
    throw new Error("Semua port sudah ada");
  }

  // =====================================================
  // CREATE PORTS
  // =====================================================

  await prisma.oltPort.createMany({
    data: newPorts.map((index) => ({
      oltId: id,
      index,
    })),
  });

  return await prisma.olt.findUnique({
    where: {
      id,
    },

    include: {
      router: {
        select: {
          id: true,
          name: true,
          host: true,
          port: true,
          isOnline: true,
          latitude: true,
          longitude: true,
          lastSeen: true,
        },
      },

      ports: {
        include: {
          odcs: true,
        },

        orderBy: {
          index: "asc",
        },
      },

      _count: {
        select: {
          ports: true,
        },
      },
    },
  });
}

  // =====================================================
  // DELETE PORT
  // =====================================================

  async deletePort(portId) {

    const id = Number(portId);

    if (isNaN(id)) {
      throw new Error("portId tidak valid");
    }

    const port = await prisma.oltPort.findUnique({
      where: {
        id,
      },

      include: {
        odcs: true,
      },
    });

    if (!port) {
      throw new Error("Port tidak ditemukan");
    }

    // =====================================================
    // CHECK USED
    // =====================================================

    if (port.odc) {
      throw new Error(
        `Port ${port.index} sedang digunakan topology`
      );
    }

    // =====================================================
    // DELETE
    // =====================================================

    return await prisma.oltPort.delete({
      where: {
        id,
      },
    });
  }

  // =====================================================
  // GET ALL OLT
  // =====================================================

  async findAll() {

    return await prisma.olt.findMany({
      include: {
        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
            latitude: true,
            longitude: true,
            lastSeen: true,
          },
        },

        _count: {
          select: {
            ports: true,
          },
        },
      },

      orderBy: {
        id: "desc",
      },
    });
  }

  // =====================================================
  // GET BY ROUTER
  // =====================================================

  async findByRouter(routerId) {

    const id = Number(routerId);

    if (isNaN(id)) {
      throw new Error("routerId tidak valid");
    }

    return await prisma.olt.findMany({
      where: {
        routerId: id,
      },

      include: {
        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
            latitude: true,
            longitude: true,
            lastSeen: true,
          },
        },

        _count: {
          select: {
            ports: true,
          },
        },
      },

      orderBy: {
        id: "desc",
      },
    });
  }

  // =====================================================
  // GET BY ID
  // =====================================================

  async findById(id) {

    const oltId = Number(id);

    if (isNaN(oltId)) {
      throw new Error("id tidak valid");
    }

    const olt = await prisma.olt.findUnique({
      where: {
        id: oltId,
      },

      include: {
        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
            latitude: true,
            longitude: true,
            lastSeen: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        ports: {
          include: {
            odcs: true,
          },

          orderBy: {
            index: "asc",
          },
        },

        _count: {
          select: {
            ports: true,
          },
        },
      },
    });

    if (!olt) {
      throw new Error("OLT tidak ditemukan");
    }

    return olt;
  }

  // =====================================================
  // UPDATE OLT
  // =====================================================

  async update(id, data) {

    const oltId = Number(id);

    if (isNaN(oltId)) {
      throw new Error("id tidak valid");
    }

    const existing = await prisma.olt.findUnique({
      where: {
        id: oltId,
      },
    });

    if (!existing) {
      throw new Error("OLT tidak ditemukan");
    }

    // =====================================================
    // CHECK DUPLICATE NAME
    // =====================================================

    if (data.name) {

      const duplicate = await prisma.olt.findFirst({
        where: {
          routerId: existing.routerId,

          name: data.name.trim(),

          NOT: {
            id: oltId,
          },
        },
      });

      if (duplicate) {
        throw new Error("Nama OLT sudah digunakan");
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    return await prisma.olt.update({
      where: {
        id: oltId,
      },

      data: {
        name: data.name?.trim(),

        latitude:
          data.latitude !== undefined
            ? Number(data.latitude)
            : undefined,

        longitude:
          data.longitude !== undefined
            ? Number(data.longitude)
            : undefined,
      },

      include: {
        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
            latitude: true,
            longitude: true,
            lastSeen: true,
          },
        },

        _count: {
          select: {
            ports: true,
          },
        },
      },
    });
  }

  // =====================================================
  // DELETE OLT
  // =====================================================

  async delete(id) {

    const oltId = Number(id);

    if (isNaN(oltId)) {
      throw new Error("id tidak valid");
    }

    const olt = await prisma.olt.findUnique({
      where: {
        id: oltId,
      },

      include: {
        ports: {
          include: {
            odcs: true,
          },
        },
      },
    });

    if (!olt) {
      throw new Error("OLT tidak ditemukan");
    }

    // =====================================================
    // CHECK USED PORT
    // =====================================================

    const usedPort = olt.ports.find(
      (port) => port.odc
    );

    if (usedPort) {
      throw new Error(
        `OLT tidak bisa dihapus karena port ${usedPort.index} masih digunakan topology`
      );
    }

    // =====================================================
    // DELETE OLT
    // =====================================================

    return await prisma.olt.delete({
      where: {
        id: oltId,
      },
    });
  }

  // =====================================================
  // BULK DELETE
  // =====================================================

  async bulkDelete(ids = []) {

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("ids wajib diisi");
    }

    const parsedIds = ids.map(Number);

    const olts = await prisma.olt.findMany({
      where: {
        id: {
          in: parsedIds,
        },
      },

      include: {
        ports: {
          include: {
            odcs: true,
          },
        },
      },
    });

    for (const olt of olts) {

      const usedPort = olt.ports.find(
        (port) => port.odc
      );

      if (usedPort) {
        throw new Error(
          `OLT ${olt.name} tidak bisa dihapus karena port ${usedPort.index} sedang digunakan`
        );
      }
    }

    return await prisma.olt.deleteMany({
      where: {
        id: {
          in: parsedIds,
        },
      },
    });
  }

  // =====================================================
  // OLT SUMMARY
  // =====================================================

  async getSummary(id) {

    const oltId = Number(id);

    if (isNaN(oltId)) {
      throw new Error("id tidak valid");
    }

    const olt = await prisma.olt.findUnique({
      where: {
        id: oltId,
      },

      include: {
        router: true,

        ports: {
          include: {
            odcs: true,
          },
        },
      },
    });

    if (!olt) {
      throw new Error("OLT tidak ditemukan");
    }

    const totalPorts = olt.ports.length;

    const usedPorts = olt.ports.filter(
      (port) => port.odc
    ).length;

    const unusedPorts = totalPorts - usedPorts;

    return {
      oltId: olt.id,

      name: olt.name,

      router: olt.router,

      statistics: {
        totalPorts,
        usedPorts,
        unusedPorts,
      },
    };
  }
}

module.exports = new OltService();