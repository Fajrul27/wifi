const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class FiberAssignmentService {

  // =====================================================
  // ASSIGN CLIENT KE FIBER
  // =====================================================
  async assignClientToFiber(clientId, outputId) {

    const output = await prisma.splitterOutput.findUnique({
      where: { id: Number(outputId) },
      include: {
        splitter: {
          include: {
            node: true,
          },
        },
      },
    });

    if (!output) throw new Error("Output tidak ditemukan");

    if (output.isUsed) throw new Error("Output sudah dipakai");

    const client = await prisma.pppoeUser.findUnique({
      where: { id: Number(clientId) },
    });

    if (!client) throw new Error("Client tidak ditemukan");

    // =====================================================
    // VALIDASI NODE TYPE (FTTH RULE)
    // =====================================================
    const node = output.splitter.node;

    if (!node) throw new Error("Node tidak ditemukan");

    if (!["ODC", "ODP"].includes(node.type)) {
      throw new Error("Node bukan ODC/ODP");
    }

    // =====================================================
    // ATOMIC UPDATE (ANTI DOUBLE ASSIGN)
    // =====================================================
    await prisma.$transaction([

      prisma.splitterOutput.update({
        where: { id: Number(outputId) },
        data: {
          isUsed: true,
          clientId: Number(clientId),
          targetNodeId: node.id,
        },
      }),

      prisma.pppoeUser.update({
        where: { id: Number(clientId) },
        data: {
          topologyNodeId: node.id,
        },
      }),

    ]);

    return {
      success: true,
      message: "Client berhasil di-assign ke fiber",
    };
  }

  // =====================================================
  // UNASSIGN
  // =====================================================
  async unassignClient(outputId) {

    const output = await prisma.splitterOutput.findUnique({
      where: { id: Number(outputId) },
    });

    if (!output) throw new Error("Output tidak ditemukan");

    if (!output.clientId) throw new Error("Output belum ada client");

    const clientId = output.clientId;

    await prisma.$transaction([

      prisma.splitterOutput.update({
        where: { id: Number(outputId) },
        data: {
          isUsed: false,
          clientId: null,
          targetNodeId: null,
        },
      }),

      prisma.pppoeUser.update({
        where: { id: clientId },
        data: {
          topologyNodeId: null,
        },
      }),

    ]);

    return {
      success: true,
      message: "Client berhasil dilepas dari fiber",
    };
  }
}

module.exports = new FiberAssignmentService();