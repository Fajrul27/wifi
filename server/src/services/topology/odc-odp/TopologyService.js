const prisma = require("../../../utils/prisma");

// =====================================================
// UTIL
// =====================================================

const toInt = (val, label) => {
  const n = Number(val);

  if (isNaN(n)) {
    throw new Error(`${label} tidak valid`);
  }

  return n;
};

const SPLIT_MAP = {
  ONE_TO_2: 2,
  ONE_TO_4: 4,
  ONE_TO_8: 8,
  ONE_TO_16: 16,
  ONE_TO_32: 32,
  ONE_TO_64: 64,
};

// =====================================================
// TOPOLOGY SERVICE (MANUAL PORT VERSION)
// =====================================================

class TopologyService {

  // =====================================================
  // CREATE ODC
  // =====================================================

async createOdc(data) {
  if (!data) {
    throw new Error("Request body kosong");
  }

  if (!data.name || !data.oltPortId || !data.splitRatio) {
    throw new Error("name, oltPortId, splitRatio wajib diisi");
  }

  const oltPortId = toInt(data.oltPortId, "oltPortId");

  const capacity = SPLIT_MAP[data.splitRatio];
  if (!capacity) {
    throw new Error("splitRatio tidak valid");
  }

  // ambil OLT port (VALIDASI SAJA)
  const oltPort = await prisma.oltPort.findUnique({
    where: { id: oltPortId },
  });

  if (!oltPort) {
    throw new Error("OLT Port tidak ditemukan");
  }

  if (oltPort.isUsed) {
    throw new Error("OLT Port sudah digunakan oleh ODC lain");
  }

  // =========================
  // TRANSACTION SAFE WRITE
  // =========================
  const odc = await prisma.$transaction(async (tx) => {

    const toCoord = (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);

    const created = await tx.odc.create({
      data: {
        name: data.name.trim(),
        oltPortId,
        splitRatio: data.splitRatio,
        latitude: toCoord(data.latitude),
        longitude: toCoord(data.longitude),
      },
    });

    await tx.oltPort.update({
      where: { id: oltPortId },
      data: { isUsed: true },
    });

    await tx.odcPort.createMany({
      data: Array.from({ length: capacity }).map((_, i) => ({
        odcId: created.id,
        index: i + 1,
        isUsed: false,
        connectionType: "NONE",
        connectedOdcId: null,
        connectedOdpId: null,
      })),
    });

    return created; // ⚠️ JANGAN include di dalam tx
  });

  // =========================
  // AMBIL DATA FINAL (AMAN)
  // =========================
  const result = await prisma.odc.findUnique({
    where: { id: odc.id },
    include: {
      ports: true,
    },
  });

  return result;
}

  // =====================================================
  // CREATE CHILD ODC (MANUAL PORT)
  // =====================================================

  async createOdcChild(parentId, data) {

    const id = toInt(parentId, "parentId");

    if (
      !data.name ||
      !data.splitRatio ||
      !data.odcPortId
    ) {
      throw new Error(
        "name, splitRatio, odcPortId wajib diisi"
      );
    }

    const odcPortId = toInt(
      data.odcPortId,
      "odcPortId"
    );

    const capacity = SPLIT_MAP[data.splitRatio];

    if (!capacity) {
      throw new Error("splitRatio tidak valid");
    }

    return prisma.$transaction(async (tx) => {

      const parent = await tx.odc.findUnique({
        where: {
          id,
        },
      });

      if (!parent) {
        throw new Error("Parent ODC tidak ditemukan");
      }

      const port = await tx.odcPort.findUnique({
        where: {
          id: odcPortId,
        },
      });

      if (!port || port.odcId !== id) {
        throw new Error("Port ODC tidak valid");
      }

      if (port.isUsed) {
        throw new Error("Port ODC sudah digunakan");
      }

      const toCoord = (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);

      const child = await tx.odc.create({
        data: {
          name: data.name.trim(),
          oltPortId: null,           // Child ODC TIDAK punya oltPortId
          parentOdcId: parent.id,   // Identifikasi via parentOdcId
          splitRatio: data.splitRatio,
          latitude: toCoord(data.latitude),
          longitude: toCoord(data.longitude),
        },
      });

      await tx.odcPort.update({
        where: {
          id: port.id,
        },
        data: {
          isUsed: true,
          connectionType: "ODC",
          connectedOdcId: child.id,
        },
      });

      await tx.odcPort.createMany({
        data: Array.from({ length: capacity }).map((_, i) => ({
          odcId: child.id,
          index: i + 1,
          isUsed: false,
          connectionType: "NONE",
          connectedOdcId: null,
          connectedOdpId: null,
        })),
      });

      return tx.odc.findUnique({
        where: {
          id: child.id,
        },
        include: {
          ports: true,
        },
      });
    });
  }

  // =====================================================
  // GET ODC TREE (RECURSIVE)
  // =====================================================

  async getOdcTree(oltPortId) {

    const id = toInt(oltPortId, "oltPortId");

    // Ambil hanya ROOT ODC (yang langsung terhubung ke OLT port)
    // Child ODC tidak memiliki oltPortId — mereka diidentifikasi via parentOdcId
    const rootOdcs = await prisma.odc.findMany({
      where: {
        oltPortId: id,
        parentOdcId: null,   // ← pastikan hanya root
      },
      include: {
        ports: { orderBy: { index: "asc" } },
        odps: {
          include: {
            ports: { include: { user: true }, orderBy: { index: "asc" } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    // Ambil semua ODC lain via parentOdcId (rekursif)
    const buildSubtree = async (odcList) => {
      const result = [];
      for (const odc of odcList) {
        const children = await prisma.odc.findMany({
          where: { parentOdcId: odc.id },
          include: {
            ports: { orderBy: { index: "asc" } },
            odps: {
              include: {
                ports: { include: { user: true }, orderBy: { index: "asc" } },
              },
            },
          },
          orderBy: { id: "asc" },
        });
        const childrenWithSub = await buildSubtree(children);

        // Kumpulkan connectedOdpId dari ports
        const odpIds = odc.ports
          .filter(p => p.connectionType === "ODP" && p.connectedOdpId)
          .map(p => p.connectedOdpId);

        let odpMap = {};
        if (odpIds.length > 0) {
          const odps = await prisma.odp.findMany({
            where: { id: { in: odpIds } },
            include: { ports: { include: { user: true }, orderBy: { index: "asc" } } },
          });
          for (const odp of odps) odpMap[odp.id] = odp;
        }

        for (const port of odc.ports) {
          port.connectedOdp = (port.connectionType === "ODP" && port.connectedOdpId)
            ? (odpMap[port.connectedOdpId] ?? null)
            : null;
        }

        result.push({ ...odc, children: childrenWithSub });
      }
      return result;
    };

    return buildSubtree(rootOdcs);
  }

  // =====================================================
  // UPDATE ODC
  // =====================================================

  async updateOdc(id, data) {

    const odcId = toInt(id, "id");

    return prisma.$transaction(async (tx) => {

      const odc = await tx.odc.findUnique({
        where: {
          id: odcId,
        },
      });

      if (!odc) {
        throw new Error("ODC tidak ditemukan");
      }

      // =================================================
      // CHANGE SPLIT RATIO
      // =================================================

      if (
        data.splitRatio &&
        data.splitRatio !== odc.splitRatio
      ) {

        const usedPort = await tx.odcPort.count({
          where: {
            odcId,
            isUsed: true,
          },
        });

        if (usedPort > 0) {
          throw new Error(
            "Tidak bisa ubah splitRatio, port masih digunakan"
          );
        }

        await tx.odcPort.deleteMany({
          where: {
            odcId,
          },
        });

        const capacity = SPLIT_MAP[data.splitRatio];

        if (!capacity) {
          throw new Error("splitRatio tidak valid");
        }

        await tx.odcPort.createMany({
          data: Array.from({ length: capacity }).map((_, i) => ({
            odcId,
            index: i + 1,
            isUsed: false,
            connectionType: "NONE",
            connectedOdcId: null,
            connectedOdpId: null,
          })),
        });
      }

      const toCoordUpdate = (v) =>
        v === undefined ? undefined : (v === null || v === "" ? null : Number(v));

      return tx.odc.update({
        where: {
          id: odcId,
        },
        data: {
          name: data.name?.trim(),
          latitude: toCoordUpdate(data.latitude),
          longitude: toCoordUpdate(data.longitude),
          splitRatio: data.splitRatio,
        },
      });
    });
  }

  // =====================================================
  // DELETE ODC
  // =====================================================

 async deleteOdc(id) {

  const odcId = toInt(id, "id");

  return prisma.$transaction(async (tx) => {

    const odc = await tx.odc.findUnique({
      where: { id: odcId },
      include: { ports: true },
    });

    if (!odc) {
      throw new Error("ODC tidak ditemukan");
    }

    const hasUsedPort = odc.ports.some((p) => p.isUsed);

    const userCount = await tx.pppoeUser.count({
      where: {
        odpPort: {
          odp: { odcId },
        },
      },
    });

    if (hasUsedPort || userCount > 0) {
      throw new Error("ODC masih digunakan di topology");
    }

    // =====================================================
    // RELEASE PARENT OLT PORT (hanya untuk root ODC)
    // =====================================================
    if (odc.oltPortId) {
      await tx.oltPort.update({
        where: { id: odc.oltPortId },
        data: { isUsed: false },
      });
    }

    // Release parent ODC port yang mereferensikan ODC ini (untuk child ODC)
    await tx.odcPort.updateMany({
      where: { connectedOdcId: odcId },
      data: {
        isUsed: false,
        connectionType: "NONE",
        connectedOdcId: null,
      },
    });

    await tx.odcPort.deleteMany({
      where: { odcId },
    });

    return tx.odc.delete({
      where: { id: odcId },
    });
  });
}

  // =====================================================
  // CREATE ODP (MANUAL PORT)
  // =====================================================

  async createOdp(data) {
  if (
    !data.name ||
    !data.odcId ||
    !data.splitRatio ||
    !data.odcPortId
  ) {
    throw new Error(
      "name, odcId, splitRatio, odcPortId wajib diisi"
    );
  }

  const odcId = toInt(data.odcId, "odcId");
  const odcPortId = toInt(data.odcPortId, "odcPortId");

  const capacity = SPLIT_MAP[data.splitRatio];

  if (!capacity) {
    throw new Error("splitRatio tidak valid");
  }

  return prisma.$transaction(async (tx) => {

    // =====================================================
    // CHECK ODC
    // =====================================================
    const odc = await tx.odc.findUnique({
      where: { id: odcId },
    });

    if (!odc) {
      throw new Error("ODC tidak ditemukan");
    }

    // =====================================================
    // CHECK ODC PORT
    // =====================================================
    const port = await tx.odcPort.findUnique({
      where: { id: odcPortId },
    });

    if (!port || port.odcId !== odcId) {
      throw new Error("Port ODC tidak valid");
    }

    if (port.isUsed) {
      throw new Error("Port ODC sudah digunakan");
    }

    // =====================================================
    // CREATE ODP
    // =====================================================
    const toCoord = (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);

    const odp = await tx.odp.create({
      data: {
        name: data.name.trim(),
        odcId,
        splitRatio: data.splitRatio,
        latitude: toCoord(data.latitude),
        longitude: toCoord(data.longitude),
      },
    });

    // =====================================================
    // UPDATE ODC PORT (IMPORTANT FIX)
    // =====================================================
    await tx.odcPort.update({
      where: { id: port.id },
      data: {
        isUsed: true,
        connectionType: "ODP",
        connectedOdpId: odp.id,
      },
    });

    // =====================================================
    // CREATE ODP PORTS
    // =====================================================
    await tx.odpPort.createMany({
      data: Array.from({ length: capacity }).map((_, i) => ({
        odpId: odp.id,
        index: i + 1,
        isUsed: false,
      })),
    });

    // =====================================================
    // RETURN FULL DATA
    // =====================================================
    return tx.odp.findUnique({
      where: { id: odp.id },
      include: {
        odc: true,
        ports: {
          include: { user: true },
          orderBy: { index: "asc" }
        },
      },
    });
  });
}

  // =====================================================
  // UPDATE ODP
  // =====================================================

  async updateOdp(id, data) {

    const odpId = toInt(id, "id");

    return prisma.$transaction(async (tx) => {

      const odp = await tx.odp.findUnique({
        where: {
          id: odpId,
        },
        include: {
          ports: true,
        },
      });

      if (!odp) {
        throw new Error("ODP tidak ditemukan");
      }

      // =================================================
      // CHANGE SPLIT RATIO
      // =================================================

      if (
        data.splitRatio &&
        data.splitRatio !== odp.splitRatio
      ) {

        const usedPort = await tx.odpPort.count({
          where: {
            odpId,
            isUsed: true,
          },
        });

        if (usedPort > 0) {
          throw new Error(
            "Tidak bisa ubah splitRatio, port masih digunakan"
          );
        }

        await tx.odpPort.deleteMany({
          where: {
            odpId,
          },
        });

        const capacity = SPLIT_MAP[data.splitRatio];

        if (!capacity) {
          throw new Error("splitRatio tidak valid");
        }

        await tx.odpPort.createMany({
          data: Array.from({ length: capacity }).map((_, i) => ({
            odpId,
            index: i + 1,
            isUsed: false,
          })),
        });
      }

      const toCoordUpdate = (v) =>
        v === undefined ? undefined : (v === null || v === "" ? null : Number(v));

      return tx.odp.update({
        where: {
          id: odpId,
        },
        data: {
          name: data.name?.trim(),
          latitude: toCoordUpdate(data.latitude),
          longitude: toCoordUpdate(data.longitude),
          splitRatio: data.splitRatio,
        },
        include: {
          odc: true,
          ports: {
            include: { user: true },
            orderBy: { index: "asc" }
          },
        },
      });
    });
  }

  // =====================================================
  // GET ODP DETAIL
  // =====================================================

  async getOdpById(id) {

    const odpId = toInt(id, "id");

    const odp = await prisma.odp.findUnique({
      where: {
        id: odpId,
      },
      include: {
        odc: true,
        ports: {
          include: { user: true },
          orderBy: { index: "asc" }
        },
      },
    });

    if (!odp) {
      throw new Error("ODP tidak ditemukan");
    }

    return odp;
  }

  // =====================================================
  // ASSIGN USER TO ODP (MANUAL PORT)
  // =====================================================

  async assignUserToOdp(odpId, userId, odpPortId) {

    const id = toInt(odpId, "odpId");

    const uid = toInt(userId, "userId");

    const portId = toInt(
      odpPortId,
      "odpPortId"
    );

    return prisma.$transaction(async (tx) => {

      const user = await tx.pppoeUser.findUnique({
        where: {
          id: uid,
        },
      });

      if (!user) {
        throw new Error("User tidak ditemukan");
      }

      if (user.odpPortId) {
        throw new Error("User sudah memiliki ODP port");
      }

      const port = await tx.odpPort.findUnique({
        where: {
          id: portId,
        },
      });

      if (!port || port.odpId !== id) {
        throw new Error("Port ODP tidak valid");
      }

      if (port.isUsed) {
        throw new Error("Port ODP sudah digunakan");
      }

      await tx.odpPort.update({
        where: {
          id: port.id,
        },
        data: {
          isUsed: true,
        },
      });

      return tx.pppoeUser.update({
        where: {
          id: uid,
        },
        data: {
          odpPort: {
            connect: {
              id: port.id,
            },
          },
        },
      });
    });
  }

  // =====================================================
  // UNASSIGN USER
  // =====================================================

  async unassignUserFromOdp(userId) {

    const id = toInt(userId, "userId");

    return prisma.$transaction(async (tx) => {

      const user = await tx.pppoeUser.findUnique({
        where: {
          id,
        },
      });

      if (!user) {
        throw new Error("User tidak ditemukan");
      }

      if (!user.odpPortId) {
        throw new Error("User tidak memiliki ODP port");
      }

      await tx.odpPort.update({
        where: {
          id: user.odpPortId,
        },
        data: {
          isUsed: false,
        },
      });

      return tx.pppoeUser.update({
        where: {
          id,
        },
        data: {
          odpPort: {
            disconnect: true,
          },
        },
      });
    });
  }


  // =====================================================
  // GET ODP BY ODC PORT
  // =====================================================

// =====================================================
// GET ODPs BY ODC PORT
// =====================================================

async getOdpsByPort(portId) {

  const id = toInt(portId, "portId");

  // cek port
  const port = await prisma.odcPort.findUnique({
    where: {
      id,
    },
  });

  if (!port) {
    throw new Error("Port tidak ditemukan");
  }

  // jika port tidak connect ke ODP
  if (
    port.connectionType !== "ODP" ||
    !port.connectedOdpId
  ) {
    return [];
  }

  // ambil ODP berdasarkan connectedOdpId
  const odp = await prisma.odp.findUnique({
    where: {
      id: port.connectedOdpId,
    },
    include: {
      ports: {
        include: { user: true },
        orderBy: { index: "asc" }
      },
      odc: true,
    },
  });

  if (!odp) {
    return [];
  }

  return [odp];
}


  // =====================================================
  // DELETE ODP
  // =====================================================

  async deleteOdp(id) {

    const odpId = toInt(id, "id");

    return prisma.$transaction(async (tx) => {

      const odp = await tx.odp.findUnique({
        where: {
          id: odpId,
        },
        include: {
          ports: true,
        },
      });

      if (!odp) {
        throw new Error("ODP tidak ditemukan");
      }

      const usedPort = odp.ports.some(
        (p) => p.isUsed
      );

      if (usedPort) {
        throw new Error("ODP masih memiliki user");
      }

      // release ODC port
      await tx.odcPort.updateMany({
        where: {
          connectedOdpId: odpId,
        },
        data: {
          isUsed: false,
          connectionType: "NONE",
          connectedOdpId: null,
        },
      });

      await tx.pppoeUser.updateMany({
        where: {
          odpPort: {
            odpId,
          },
        },
        data: {
          odpPortId: null,
        },
      });

      await tx.odpPort.deleteMany({
        where: {
          odpId,
        },
      });

      return tx.odp.delete({
        where: {
          id: odpId,
        },
      });
    });
  }
}

module.exports = new TopologyService();