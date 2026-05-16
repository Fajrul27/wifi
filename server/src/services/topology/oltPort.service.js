const { PrismaClient } = require("@prisma/client");
const PppoeService = require("../admin/PppoeService");

const prisma = new PrismaClient();

class OltPortService {

  // =====================================================
  // CREATE OLT PORT
  // =====================================================

  async create(data) {

    if (!data.routerId || !data.name || !data.port) {
      throw new Error("routerId, name, dan port wajib diisi");
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
    // CHECK DUPLICATE PORT
    // =====================================================

    const existingPort = await prisma.oltPort.findFirst({
      where: {
        routerId,
        port: data.port.trim(),
      },
    });

    if (existingPort) {
      throw new Error("Port sudah digunakan pada router ini");
    }

    // =====================================================
    // CREATE
    // =====================================================

    return await prisma.oltPort.create({
      data: {
        routerId,

        name: data.name.trim(),
        port: data.port.trim(),

        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
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
      },
    });
  }

  // =====================================================
  // GET ALL OLT PORT
  // =====================================================

  async findAll() {

    return await prisma.oltPort.findMany({
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
            nodes: true,
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

    return await prisma.oltPort.findMany({
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
            nodes: true,
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

    const portId = Number(id);

    if (isNaN(portId)) {
      throw new Error("id tidak valid");
    }

    const port = await prisma.oltPort.findUnique({
      where: {
        id: portId,
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

        nodes: {
          select: {
            id: true,
            name: true,
            type: true,
            latitude: true,
            longitude: true,
            createdAt: true,
          },
        },

        _count: {
          select: {
            nodes: true,
          },
        },
      },
    });

    if (!port) {
      throw new Error("OLT Port tidak ditemukan");
    }

    return port;
  }

  // =====================================================
  // UPDATE
  // =====================================================

  async update(id, data) {

    const portId = Number(id);

    if (isNaN(portId)) {
      throw new Error("id tidak valid");
    }

    const existing = await prisma.oltPort.findUnique({
      where: {
        id: portId,
      },
    });

    if (!existing) {
      throw new Error("OLT Port tidak ditemukan");
    }

    // =====================================================
    // CHECK DUPLICATE PORT
    // =====================================================

    if (data.port) {

      const duplicate = await prisma.oltPort.findFirst({
        where: {
          routerId: existing.routerId,
          port: data.port.trim(),

          NOT: {
            id: portId,
          },
        },
      });

      if (duplicate) {
        throw new Error("Port sudah digunakan");
      }
    }

    // =====================================================
    // UPDATE
    // =====================================================

    return await prisma.oltPort.update({
      where: {
        id: portId,
      },

      data: {

        name: data.name?.trim(),
        port: data.port?.trim(),

        latitude: data.latitude,
        longitude: data.longitude,
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
      },
    });
  }

  // =====================================================
  // DELETE
  // =====================================================

  async delete(id) {

    const portId = Number(id);

    if (isNaN(portId)) {
      throw new Error("id tidak valid");
    }

    const port = await prisma.oltPort.findUnique({
      where: {
        id: portId,
      },

      include: {
        _count: {
          select: {
            nodes: true,
          },
        },
      },
    });

    if (!port) {
      throw new Error("OLT Port tidak ditemukan");
    }

    // =====================================================
    // PROTECT TOPOLOGY
    // =====================================================

    if (port._count.nodes > 0) {
      throw new Error("OLT Port sedang digunakan topology");
    }

    return await prisma.oltPort.delete({
      where: {
        id: portId,
      },
    });
  }

  // =====================================================
  // PORT USAGE / TOPOLOGY SUMMARY
  // =====================================================

  async getPortUsage(id) {

    const portId = Number(id);

    if (isNaN(portId)) {
      throw new Error("id tidak valid");
    }

    const port = await prisma.oltPort.findUnique({
      where: {
        id: portId,
      },

      include: {

        router: {
          select: {
            id: true,
            name: true,
            host: true,
            port: true,
            isOnline: true,
          },
        },

        nodes: {
          include: {

            _count: {
              select: {
                outgoingLinks: true,
                incomingLinks: true,
                clients: true,
              },
            },
          },
        },
      },
    });

    if (!port) {
      throw new Error("OLT Port tidak ditemukan");
    }

    // =====================================================
    // STATISTICS
    // =====================================================

    const totalNodes = port.nodes.length;

    const totalClients = port.nodes.reduce((acc, node) => {
      return acc + node._count.clients;
    }, 0);

    const totalLinks = port.nodes.reduce((acc, node) => {
      return (
        acc +
        node._count.outgoingLinks +
        node._count.incomingLinks
      );
    }, 0);

    const totalODC = port.nodes.filter(
      (node) => node.type === "ODC"
    ).length;

    const totalODP = port.nodes.filter(
      (node) => node.type === "ODP"
    ).length;

    return {
      portId: port.id,

      router: {
        id: port.router.id,
        name: port.router.name,
        host: port.router.host,
        port: port.router.port,
        isOnline: port.router.isOnline,
      },

      oltPort: port.port,

      statistics: {
        totalNodes,
        totalODC,
        totalODP,
        totalClients,
        totalLinks,
      },
    };
  }

  // =====================================================
  // SCAN ROUTER INTERFACES (AUTO DETECT)
  // =====================================================
  async scanRouterInterfaces(routerId) {
    const router = await prisma.router.findUnique({ where: { id: Number(routerId) } });
    if (!router) throw new Error("Router tidak ditemukan");

    const pppoeService = new PppoeService(router);
    await pppoeService.connect();
    
    // Ambil semua interface dari Mikrotik
    const interfaces = await pppoeService.client.write("/interface/print");
    
    // Ambil port yang sudah terdaftar di database
    const existingPorts = await prisma.oltPort.findMany({
      where: { routerId: Number(routerId) },
      select: { port: true }
    });
    const existingPortNames = existingPorts.map(p => p.port);

    // Filter interface yang belum ada di database
    const available = interfaces
      .filter(i => !existingPortNames.includes(i.name))
      .map(i => ({
        name: i.name,
        type: i.type,
        comment: i.comment || "",
        status: i.running === "true" ? "Running" : "Down"
      }));

    return available;
  }
}

module.exports = new OltPortService();
