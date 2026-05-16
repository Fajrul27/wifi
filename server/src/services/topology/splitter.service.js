const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class SplitterService {

  // =====================================================
  // CREATE SPLITTER (DI DALAM NODE ODC / ODP)
  // =====================================================
  async create(data) {

    if (!data.nodeId || !data.type || !data.outputPort) {
      throw new Error("nodeId, type, outputPort wajib diisi");
    }

    const node = await prisma.topologyNode.findUnique({
      where: { id: Number(data.nodeId) },
    });

    if (!node) {
      throw new Error("Node tidak ditemukan");
    }

    return await prisma.splitter.create({
      data: {
        nodeId: Number(data.nodeId),
        type: data.type,
        outputPort: Number(data.outputPort),
        name: data.name ?? null,
        description: data.description ?? null,
      },
      include: {
        node: true,
        outputs: true,
      },
    });
  }

  // =====================================================
  // GENERATE OUTPUT PORTS OTOMATIS
  // =====================================================
  async generateOutputs(splitterId) {

    const splitter = await prisma.splitter.findUnique({
      where: { id: Number(splitterId) },
    });

    if (!splitter) {
      throw new Error("Splitter tidak ditemukan");
    }

    const exists = await prisma.splitterOutput.findFirst({
      where: { splitterId: splitter.id },
    });

    if (exists) {
      throw new Error("Output sudah digenerate");
    }

    const data = [];

    for (let i = 1; i <= splitter.outputPort; i++) {
      data.push({
        splitterId: splitter.id,
        portNumber: i,
      });
    }

    return await prisma.splitterOutput.createMany({
      data,
    });
  }

  // =====================================================
  // GET ALL SPLITTER
  // =====================================================
  async findAll() {
    return await prisma.splitter.findMany({
      include: {
        node: true,
        outputs: {
          include: {
            client: true,
            targetNode: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });
  }

  // =====================================================
  // GET SPLITTER BY NODE
  // =====================================================
  async findByNode(nodeId) {
    return await prisma.splitter.findMany({
      where: {
        nodeId: Number(nodeId),
      },
      include: {
        outputs: true,
      },
    });
  }

  // =====================================================
  // ASSIGN OUTPUT KE CLIENT / NODE
  // =====================================================
  async assignOutput(outputId, data) {
    const id = Number(outputId);
    const clientId = data.clientId ? Number(data.clientId) : null;
    const targetNodeId = data.targetNodeId ? Number(data.targetNodeId) : null;

    const output = await prisma.splitterOutput.findUnique({
      where: { id },
      include: { splitter: true }
    });

    if (!output) throw new Error("Output tidak ditemukan");

    // Jalankan dalam Transaksi agar sinkron
    return await prisma.$transaction(async (tx) => {
      // 1. Validasi duplikasi jika ada clientId
      if (clientId) {
        const alreadyAssigned = await tx.splitterOutput.findFirst({
          where: { clientId, isUsed: true, NOT: { id } },
          include: { splitter: true }
        });

        if (alreadyAssigned) {
          throw new Error(`Pelanggan sudah terpasang di ${alreadyAssigned.splitter.name} port #${alreadyAssigned.portNumber}`);
        }

        // 2. Update status pelanggan (link ke node)
        await tx.pppoeUser.update({
          where: { id: clientId },
          data: { topologyNodeId: output.splitter.nodeId }
        });
      }

      // 3. Update status port splitter
      return await tx.splitterOutput.update({
        where: { id },
        data: {
          isUsed: true,
          targetNodeId: targetNodeId,
          clientId: clientId,
        },
        include: {
          client: true,
          targetNode: true,
          splitter: true,
        },
      });
    });
  }

  // =====================================================
  // UNASSIGN OUTPUT
  // =====================================================
  async unassignOutput(outputId) {
    const output = await prisma.splitterOutput.findUnique({
      where: { id: Number(outputId) },
      include: { client: true }
    });

    if (!output) {
      throw new Error("Output tidak ditemukan");
    }

    const clientId = output.clientId;

    // Update port
    const updated = await prisma.splitterOutput.update({
      where: { id: Number(outputId) },
      data: { isUsed: false, clientId: null, targetNodeId: null },
      include: { 
        splitter: { include: { node: true } },
        client: true,
        targetNode: true
      }
    });

    // Jika ada clientId, update PppoeUser dan DISABLE di Mikrotik
    if (clientId) {
      const user = await prisma.pppoeUser.update({
        where: { id: Number(clientId) },
        data: { topologyNodeId: null }
      });

      // 🔥 OTOMATIS: Matikan internet di Mikrotik
      try {
        const router = await prisma.router.findUnique({ where: { id: user.routerId } });
        if (router) {
          const PppoeService = require("../admin/PppoeService");
          const pppoeService = new PppoeService(router);
          await pppoeService.connect();
          
          // Cari .id di Mikrotik berdasarkan username
          const secrets = await pppoeService.client.write("/ppp/secret/print", [
            `?name=${user.username}`
          ]);
          
          if (secrets && secrets.length > 0) {
            await pppoeService.client.write("/ppp/secret/set", [
              `=.id=${secrets[0][".id"]}`,
              "=disabled=yes"
            ]);
            console.log(`[Provisioning] Disabled PPPoE user: ${user.username}`);
          }
        }
      } catch (err) {
        console.error("Gagal disable Mikrotik:", err.message);
      }
    }

    return updated;
  }

  // =====================================================
  // FIND BY CLIENT ID
  // =====================================================
  async findByClientId(clientId) {
    return await prisma.splitterOutput.findFirst({
      where: { clientId: Number(clientId), isUsed: true },
      include: { splitter: true }
    });
  }

  // =====================================================
  // DELETE SPLITTER
  // =====================================================
  async remove(splitterId) {
    const splitter = await prisma.splitter.findUnique({
      where: { id: Number(splitterId) },
    });
    if (!splitter) throw new Error("Splitter tidak ditemukan");

    // Hapus output dulu (cascade manual)
    await prisma.splitterOutput.deleteMany({
      where: { splitterId: Number(splitterId) },
    });

    return await prisma.splitter.delete({
      where: { id: Number(splitterId) },
    });
  }

}

module.exports = new SplitterService();