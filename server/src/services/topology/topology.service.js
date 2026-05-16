const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class TopologyNodeService {

  // =====================================================
  // CREATE NODE (ODC / ODP)
  // =====================================================

  async create(data) {

    if (!data.name || !data.type) {
      throw new Error("name dan type wajib diisi");
    }

    const type = data.type;

    const allowedTypes = ["ODC", "ODP"];
    if (!allowedTypes.includes(type)) {
      throw new Error("type hanya boleh ODC atau ODP");
    }

    // =====================================================
    // ODC wajib OLT PORT
    // =====================================================

    if (type === "ODC" && !data.oltPortId) {
      throw new Error("ODC wajib memiliki oltPortId");
    }

    // =====================================================
    // VALIDASI OLT PORT
    // =====================================================

    if (data.oltPortId) {
      const oltPort = await prisma.oltPort.findUnique({
        where: { id: Number(data.oltPortId) }
      });

      if (!oltPort) {
        throw new Error("OLT Port tidak ditemukan");
      }
    }

    // =====================================================
    // PARENT NODE VALIDATION
    // =====================================================

    let parentNode = null;

    if (data.parentNodeId) {

      const parentId = Number(data.parentNodeId);

      parentNode = await prisma.topologyNode.findUnique({
        where: { id: parentId }
      });

      if (!parentNode) {
        throw new Error("Parent node tidak ditemukan");
      }

      // RULE FTTH:
      // ODC → ODC (boleh backbone)
      // ODC → ODP (boleh)
      // ODP → tidak boleh jadi parent

      if (parentNode.type === "ODP") {
        throw new Error("ODP tidak boleh menjadi parent node");
      }

      if (type === "ODP" && parentNode.type !== "ODC") {
        throw new Error("ODP hanya boleh dari ODC");
      }

      if (type === "ODC" && parentNode.type === "ODP") {
        throw new Error("ODC tidak boleh dari ODP");
      }
    }

    // =====================================================
    // DUPLICATE NAME
    // =====================================================

    const existing = await prisma.topologyNode.findFirst({
      where: { name: data.name.trim() }
    });

    if (existing) {
      throw new Error("Nama node sudah digunakan");
    }

    // =====================================================
    // CREATE NODE
    // =====================================================

    const node = await prisma.topologyNode.create({
      data: {
        name: data.name.trim(),
        type,

        oltPortId: data.oltPortId ? Number(data.oltPortId) : null,

        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,

        description: data.description ?? null,
      },

      include: {
        oltPort: {
          include: {
            router: true
          }
        },
        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      }
    });

    // =====================================================
    // AUTO CREATE LINK (PARENT → NODE)
    // =====================================================

    if (parentNode) {

      await prisma.topologyLink.create({
        data: {
          fromNodeId: parentNode.id,
          toNodeId: node.id,

          cableType: data.cableType || "BACKBONE_12_CORE",
          totalCore: data.totalCore || 12,
          distanceMeter: data.distanceMeter ?? null,
        }
      });
    }

    if (data.splitterType) {
      const splitterService = require("./splitter.service");
      const portsMap = {
        SPLITTER_1_2: 2, SPLITTER_1_4: 4, SPLITTER_1_8: 8,
        SPLITTER_1_16: 16, SPLITTER_1_32: 32, SPLITTER_1_64: 64
      };
      const outputPort = portsMap[data.splitterType] || 8;
      const newSplitter = await splitterService.create({
        nodeId: node.id,
        type: data.splitterType,
        outputPort,
        name: `Splitter ${node.name}`,
        description: `Splitter bawaan ${node.name}`
      });
      await splitterService.generateOutputs(newSplitter.id);
    }

    return node;
  }

  // =====================================================
  // GET ALL
  // =====================================================

  async findAll() {
    return prisma.topologyNode.findMany({
      include: {
        oltPort: { include: { router: true } },

        outgoingLinks: {
          include: { toNode: true }
        },

        incomingLinks: {
          include: { fromNode: true }
        },

        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      },

      orderBy: { id: "desc" }
    });
  }

  // =====================================================
  // GET BY ID
  // =====================================================

  async findById(id) {

    const nodeId = Number(id);
    if (isNaN(nodeId)) throw new Error("id tidak valid");

    const node = await prisma.topologyNode.findUnique({
      where: { id: nodeId },

      include: {
        oltPort: { include: { router: true } },

        outgoingLinks: { include: { toNode: true } },
        incomingLinks: { include: { fromNode: true } },

        splitters: true,
        clients: true,

        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      }
    });

    if (!node) throw new Error("Topology node tidak ditemukan");

    return node;
  }

  // =====================================================
  // ODC ONLY
  // =====================================================

  async findODC() {
    return prisma.topologyNode.findMany({
      where: { type: "ODC" },

      include: {
        oltPort: { include: { router: true } },

        outgoingLinks: { include: { toNode: true } },

        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      },

      orderBy: { id: "desc" }
    });
  }

  // =====================================================
  // ODP ONLY
  // =====================================================

  async findODP() {
    return prisma.topologyNode.findMany({
      where: { type: "ODP" },

      include: {
        incomingLinks: { include: { fromNode: true } },

        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      },

      orderBy: { id: "desc" }
    });
  }

  // =====================================================
  // UPDATE NODE
  // =====================================================

  async update(id, data) {

    const nodeId = Number(id);
    if (isNaN(nodeId)) throw new Error("id tidak valid");

    const node = await prisma.topologyNode.findUnique({
      where: { id: nodeId }
    });

    if (!node) throw new Error("Topology node tidak ditemukan");

    // duplicate name
    if (data.name) {

      const duplicate = await prisma.topologyNode.findFirst({
        where: {
          name: data.name.trim(),
          NOT: { id: nodeId }
        }
      });

      if (duplicate) {
        throw new Error("Nama node sudah digunakan");
      }
    }

    // validate olt
    if (data.oltPortId) {

      const olt = await prisma.oltPort.findUnique({
        where: { id: Number(data.oltPortId) }
      });

      if (!olt) throw new Error("OLT Port tidak ditemukan");
    }

    return prisma.topologyNode.update({
      where: { id: nodeId },

      data: {
        name: data.name?.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
        oltPortId: data.oltPortId !== undefined
          ? Number(data.oltPortId)
          : undefined
      },

      include: {
        oltPort: { include: { router: true } }
      }
    });
  }

  // =====================================================
  // DELETE NODE
  // =====================================================

  async delete(id) {

    const nodeId = Number(id);
    if (isNaN(nodeId)) throw new Error("id tidak valid");

    const node = await prisma.topologyNode.findUnique({
      where: { id: nodeId },

      include: {
        _count: {
          select: {
            outgoingLinks: true,
            incomingLinks: true,
            clients: true
          }
        }
      }
    });

    if (!node) throw new Error("Topology node tidak ditemukan");

    // Prisma schema sudah memiliki onDelete: Cascade untuk TopologyLink dan Splitter,
    // serta onDelete: SetNull untuk PppoeUser.topologyNodeId.
    // Penghapusan node akan otomatis membersihkan relasi secara aman.

    return prisma.topologyNode.delete({
      where: { id: nodeId }
    });
  }

  // =====================================================
  // PORT SUMMARY (ODC / ODP)
  // =====================================================
  async portSummary(nodeId) {
    const node = await prisma.topologyNode.findUnique({
      where: { id: Number(nodeId) },
      include: {
        splitters: {
          include: {
            outputs: {
              include: {
                client: { select: { id: true, username: true, isOnline: true } },
                targetNode: { select: { id: true, name: true, type: true } },
              }
            }
          }
        }
      }
    });

    if (!node) throw new Error("Node tidak ditemukan");

    let totalPorts = 0;
    let usedPorts = 0;
    const portDetails = [];

    for (const splitter of node.splitters) {
      for (const output of splitter.outputs) {
        totalPorts++;
        if (output.isUsed) usedPorts++;
        portDetails.push({
          portId: output.id,
          portNumber: output.portNumber,
          splitterName: splitter.name || `Splitter #${splitter.id}`,
          splitterType: splitter.type,
          isUsed: output.isUsed,
          connectedTo: output.client
            ? { type: 'client', id: output.client.id, name: output.client.username, isOnline: output.client.isOnline }
            : output.targetNode
            ? { type: 'node', id: output.targetNode.id, name: output.targetNode.name, nodeType: output.targetNode.type }
            : null,
        });
      }
    }

    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      totalPorts,
      usedPorts,
      freePorts: totalPorts - usedPorts,
      utilization: totalPorts > 0 ? Math.round((usedPorts / totalPorts) * 100) : 0,
      ports: portDetails,
    };
  }
}

module.exports = new TopologyNodeService();