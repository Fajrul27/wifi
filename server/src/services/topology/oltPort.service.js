const prisma = require("../../utils/prisma");
const PppoeService = require("../admin/PppoeService");

class OltPortService {

  // =====================================================
  // CREATE OLT PORT
  // =====================================================

  async create(data) {

    if (!data.oltId || data.index === undefined) {
      throw new Error("oltId dan index wajib diisi");
    }

    const oltId = Number(data.oltId);
    const index = Number(data.index);

    if (isNaN(oltId) || isNaN(index)) {
      throw new Error("oltId dan index harus berupa angka");
    }

    // =====================================================
    // CHECK OLT EXISTS
    // =====================================================

    const olt = await prisma.olt.findUnique({
      where: {
        id: oltId,
      },
    });

    if (!olt) {
      throw new Error("OLT tidak ditemukan");
    }

    // =====================================================
    // CHECK DUPLICATE PORT
    // =====================================================

    const existingPort = await prisma.oltPort.findFirst({
      where: {
        oltId,
        index,
      },
    });

    if (existingPort) {
      throw new Error("Port dengan index ini sudah ada pada OLT ini");
    }

    // =====================================================
    // CREATE
    // =====================================================

    return await prisma.oltPort.create({
      data: {
        oltId,
        index,
        isUsed: data.isUsed ?? false,
        roadCoordinates: data.roadCoordinates ?? null,
      },

      include: {
        olt: {
          select: {
            id: true,
            name: true,
            routerId: true,
            latitude: true,
            longitude: true,
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
        },
        odcs: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });
  }

  // =====================================================
  // GET ALL OLT PORT
  // =====================================================

  async findAll() {
    const ports = await prisma.oltPort.findMany({
      include: {
        olt: {
          select: {
            routerId: true,
            name: true,
            latitude: true,
            longitude: true,
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
              }
            }
          }
        }
      },
      orderBy: {
        id: "desc",
      },
    });

    return ports.map(p => ({
      id: p.id,
      routerId: p.olt?.routerId,
      name: p.olt ? `${p.olt.name} - Port ${p.index}` : `Port ${p.index}`,
      oltName: p.olt?.name || '',
      portNumber: p.index,
      port: `PON ${p.index}`,
      latitude: p.olt?.latitude,
      longitude: p.olt?.longitude,
      isUsed: p.isUsed,
      roadCoordinates: p.roadCoordinates,
      createdAt: p.createdAt,
      router: p.olt?.router
    }));
  }

  // =====================================================
  // GET BY ROUTER
  // =====================================================

  async findByRouter(routerId) {

    const id = Number(routerId);

    if (isNaN(id)) {
      throw new Error("routerId tidak valid");
    }

    const ports = await prisma.oltPort.findMany({
      where: {
        olt: {
          routerId: id,
        },
      },
      include: {
        olt: {
          select: {
            routerId: true,
            name: true,
            latitude: true,
            longitude: true,
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
              }
            }
          }
        }
      },
      orderBy: {
        id: "desc",
      },
    });

    return ports.map(p => ({
      id: p.id,
      routerId: p.olt.routerId,
      name: `${p.olt.name} - Port ${p.index}`,
      oltName: p.olt.name,
      portNumber: p.index,
      port: `PON ${p.index}`,
      latitude: p.olt.latitude,
      longitude: p.olt.longitude,
      isUsed: p.isUsed,
      roadCoordinates: p.roadCoordinates,
      createdAt: p.createdAt,
      router: p.olt.router
    }));
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
        olt: {
          select: {
            id: true,
            name: true,
            routerId: true,
            latitude: true,
            longitude: true,
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
        },

        odcs: {
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
            odcs: true,
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
    // UPDATE
    // =====================================================

    let roadCoordsVal = data.roadCoordinates;

    return await prisma.oltPort.update({
      where: {
        id: portId,
      },
      data: {
        roadCoordinates: roadCoordsVal !== undefined ? roadCoordsVal : undefined,
      },

      include: {
        olt: {
          select: {
            id: true,
            name: true,
            routerId: true,
            latitude: true,
            longitude: true,
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
        },
        odcs: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
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
            odcs: true,
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

    if (port._count.odcs > 0) {
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
    
    // Ambil port yang sudah terdaftar di database melalui OLT
    const existingOlts = await prisma.olt.findMany({
      where: { routerId: Number(routerId) },
      include: {
        ports: {
          select: { index: true }
        }
      }
    });

    // Collect semua index yang sudah digunakan
    const existingIndices = existingOlts.flatMap(olt => olt.ports.map(p => p.index));

    // Filter interface yang belum ada di database
    const available = interfaces
      .filter(i => !existingIndices.includes(Number(i.name)))
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
