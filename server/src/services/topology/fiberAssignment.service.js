const prisma = require("../../utils/prisma");

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

    if (client && client.routerId) {
      try {
        const router = await prisma.router.findUnique({ where: { id: client.routerId } });
        if (router) {
          const monitoring = require("../admin/monitoring");
          const pppoeService = monitoring.getPppoeService(router);
          await pppoeService.connect();
          
          // Cari & Enable di /ppp/secret
          const secrets = await pppoeService.write("/ppp/secret/print", [
            `?name=${client.username}`
          ]);
          if (secrets && secrets.length > 0) {
            await pppoeService.write("/ppp/secret/set", [
              `=.id=${secrets[0][".id"]}`,
              "=disabled=no"
            ]);
            console.log(`[Provisioning] Enabled PPPoE user secret: ${client.username}`);
          }
        }
      } catch (err) {
        console.error("Gagal enable Mikrotik saat pasang di fiberAssignment:", err.message);
      }
    }

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

    const user = await prisma.pppoeUser.findUnique({ where: { id: clientId } });
    if (user && user.routerId) {
      try {
        const router = await prisma.router.findUnique({ where: { id: user.routerId } });
        if (router) {
          const monitoring = require("../admin/monitoring");
          const pppoeService = monitoring.getPppoeService(router);
          await pppoeService.connect();
          
          // Cari & Pastikan Enable di /ppp/secret
          const secrets = await pppoeService.write("/ppp/secret/print", [
            `?name=${user.username}`
          ]);
          if (secrets && secrets.length > 0) {
            await pppoeService.write("/ppp/secret/set", [
              `=.id=${secrets[0][".id"]}`,
              "=disabled=no"
            ]);
            console.log(`[Provisioning] Maintained PPPoE user secret active (Option B): ${user.username}`);
          }
        }
      } catch (err) {
        console.error("Gagal maintain Mikrotik (Option B) di fiberAssignment:", err.message);
      }
    }

    return {
      success: true,
      message: "Client berhasil dilepas dari fiber",
    };
  }
}

module.exports = new FiberAssignmentService();