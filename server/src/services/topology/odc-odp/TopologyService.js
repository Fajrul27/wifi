const prisma = require("../../../utils/prisma");


const { deleteImage } = require("../../../utils/cloudinary");
const { getRoadRoute } = require("../../../utils/routing");

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

    let roadCoordsVal = null;
    if (oltPortId && data.latitude && data.longitude) {
      const port = await tx.oltPort.findUnique({
        where: { id: oltPortId },
        include: { olt: true }
      });
      if (port && port.olt && port.olt.latitude !== null && port.olt.longitude !== null) {
        try {
          const coords = await getRoadRoute(
            Number(port.olt.latitude), Number(port.olt.longitude),
            Number(data.latitude), Number(data.longitude)
          );
          if (coords) roadCoordsVal = JSON.stringify(coords);
        } catch (e) {
          console.error("Failed to compute road route for new ODC:", e);
        }
      }
    }

    const created = await tx.odc.create({
      data: {
        name: data.name.trim(),
        oltPortId,
        splitRatio: data.splitRatio,
        latitude: toCoord(data.latitude),
        longitude: toCoord(data.longitude),
        roadCoordinates: roadCoordsVal,
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

      let roadCoordsVal = null;
      if (parent.latitude !== null && parent.longitude !== null && data.latitude && data.longitude) {
        try {
          const coords = await getRoadRoute(
            Number(parent.latitude), Number(parent.longitude),
            Number(data.latitude), Number(data.longitude)
          );
          if (coords) roadCoordsVal = JSON.stringify(coords);
        } catch (e) {
          console.error("Failed to compute road route for new child ODC:", e);
        }
      }

      const child = await tx.odc.create({
        data: {
          name: data.name.trim(),
          oltPortId: null,           // Child ODC TIDAK punya oltPortId
          parentOdcId: parent.id,   // Identifikasi via parentOdcId
          splitRatio: data.splitRatio,
          latitude: toCoord(data.latitude),
          longitude: toCoord(data.longitude),
          roadCoordinates: roadCoordsVal,
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

    // Fetch ALL ODCs with their ports and ODPs in ONE SINGLE BULK QUERY
    const allOdcs = await prisma.odc.findMany({
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

    // Build parent-child mapping and filter root ODCs in RAM
    const rootOdcs = [];
    const childMap = new Map(); // parentOdcId -> children list

    for (const odc of allOdcs) {
      if (odc.oltPortId === id && odc.parentOdcId === null) {
        rootOdcs.push(odc);
      }
      if (odc.parentOdcId !== null) {
        if (!childMap.has(odc.parentOdcId)) {
          childMap.set(odc.parentOdcId, []);
        }
        childMap.get(odc.parentOdcId).push(odc);
      }
    }

    // Collect all ODP IDs connected to ODC ports to fetch details in bulk
    const connectedOdpIds = new Set();
    for (const odc of allOdcs) {
      for (const port of odc.ports) {
        if (port.connectionType === "ODP" && port.connectedOdpId) {
          connectedOdpIds.add(port.connectedOdpId);
        }
      }
    }

    const odpDetailsMap = new Map();
    if (connectedOdpIds.size > 0) {
      const odps = await prisma.odp.findMany({
        where: { id: { in: Array.from(connectedOdpIds) } },
        include: { ports: { include: { user: true }, orderBy: { index: "asc" } } },
      });
      for (const odp of odps) {
        odpDetailsMap.set(odp.id, odp);
      }
    }

    // Populate connectedOdp for all ODC ports in-memory
    for (const odc of allOdcs) {
      for (const port of odc.ports) {
        port.connectedOdp = (port.connectionType === "ODP" && port.connectedOdpId)
          ? (odpDetailsMap.get(port.connectedOdpId) ?? null)
          : null;
      }
    }

    // Recursively build tree completely in-memory (O(N) complexity)
    const buildSubtreeInMemory = (odcList) => {
      const result = [];
      for (const odc of odcList) {
        const children = childMap.get(odc.id) || [];
        const childrenWithSub = buildSubtreeInMemory(children);
        result.push({ ...odc, children: childrenWithSub });
      }
      return result;
    };

    return buildSubtreeInMemory(rootOdcs);
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

      if (data.photoUrl !== undefined && odc.photoUrl && data.photoUrl !== odc.photoUrl) {
          deleteImage(odc.photoUrl);
      }
      if (data.photoUrl2 !== undefined && odc.photoUrl2 && data.photoUrl2 !== odc.photoUrl2) {
          deleteImage(odc.photoUrl2);
      }
      if (data.photoUrl3 !== undefined && odc.photoUrl3 && data.photoUrl3 !== odc.photoUrl3) {
          deleteImage(odc.photoUrl3);
      }

      let roadCoordsVal = data.roadCoordinates;
      const finalLat = data.latitude !== undefined ? toCoordUpdate(data.latitude) : (odc.latitude !== null ? Number(odc.latitude) : null);
      const finalLng = data.longitude !== undefined ? toCoordUpdate(data.longitude) : (odc.longitude !== null ? Number(odc.longitude) : null);
      
      const isMoved = (data.latitude !== undefined && toCoordUpdate(data.latitude) !== (odc.latitude !== null ? Number(odc.latitude) : null)) ||
                      (data.longitude !== undefined && toCoordUpdate(data.longitude) !== (odc.longitude !== null ? Number(odc.longitude) : null));

      if (roadCoordsVal === null || (isMoved && !data.roadCoordinates)) {
        let parentLat = null;
        let parentLng = null;
        if (odc.oltPortId) {
          const port = await tx.oltPort.findUnique({
            where: { id: odc.oltPortId },
            include: { olt: true }
          });
          if (port && port.olt && port.olt.latitude !== null && port.olt.longitude !== null) {
            parentLat = Number(port.olt.latitude);
            parentLng = Number(port.olt.longitude);
          }
        } else if (odc.parentOdcId) {
          const parentOdc = await tx.odc.findUnique({ where: { id: odc.parentOdcId } });
          if (parentOdc && parentOdc.latitude !== null && parentOdc.longitude !== null) {
            parentLat = Number(parentOdc.latitude);
            parentLng = Number(parentOdc.longitude);
          }
        }
        
        if (parentLat !== null && parentLng !== null && finalLat !== null && finalLng !== null) {
          const { getRoadRoute } = require("../../../utils/routing");
          const coords = await getRoadRoute(parentLat, parentLng, finalLat, finalLng);
          if (coords) {
            roadCoordsVal = JSON.stringify(coords);
          }
        }
      }

      return tx.odc.update({
        where: {
          id: odcId,
        },
        data: {
          name: data.name?.trim(),
          latitude: toCoordUpdate(data.latitude),
          longitude: toCoordUpdate(data.longitude),
          splitRatio: data.splitRatio,
          ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
          ...(data.photoUrl2 !== undefined && { photoUrl2: data.photoUrl2 }),
          ...(data.photoUrl3 !== undefined && { photoUrl3: data.photoUrl3 }),
          ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
          ...(data.address !== undefined && { address: data.address }),
          roadCoordinates: roadCoordsVal,
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
    });

    if (!odc) {
      throw new Error("ODC tidak ditemukan");
    }
    
    if (odc.photoUrl) deleteImage(odc.photoUrl);
    if (odc.photoUrl2) deleteImage(odc.photoUrl2);
    if (odc.photoUrl3) deleteImage(odc.photoUrl3);

    // =====================================================
    // RECURSIVE: Collect ALL descendant ODC IDs
    // =====================================================
    const collectAllDescendantIds = async (rootId) => {
      const all = [];
      const queue = [rootId];
      while (queue.length > 0) {
        const current = queue.shift();
        const children = await tx.odc.findMany({
          where: { parentOdcId: current },
          select: { id: true },
        });
        for (const c of children) {
          all.push(c.id);
          queue.push(c.id);
        }
      }
      return all;
    };

    const descendantIds = await collectAllDescendantIds(odcId);
    const allOdcIds = [odcId, ...descendantIds];

    // =====================================================
    // 1. Unassign all users from ODP ports under these ODCs
    // =====================================================
    const odpsToDelete = await tx.odp.findMany({
      where: { odcId: { in: allOdcIds } },
      select: { id: true },
    });
    const odpIdsToDelete = odpsToDelete.map((o) => o.id);

    if (odpIdsToDelete.length > 0) {
      // Unassign users
      await tx.pppoeUser.updateMany({
        where: { odpPort: { odpId: { in: odpIdsToDelete } } },
        data: { odpPortId: null },
      });
      // Delete ODP ports
      await tx.odpPort.deleteMany({
        where: { odpId: { in: odpIdsToDelete } },
      });
      // Delete ODPs
      await tx.odp.deleteMany({
        where: { id: { in: odpIdsToDelete } },
      });
    }

    // =====================================================
    // 2. Delete all ODC ports for all affected ODCs
    // =====================================================
    await tx.odcPort.deleteMany({
      where: { odcId: { in: allOdcIds } },
    });

    // Release any parent ODC port that references this ODC
    await tx.odcPort.updateMany({
      where: { connectedOdcId: { in: allOdcIds } },
      data: {
        isUsed: false,
        connectionType: "NONE",
        connectedOdcId: null,
      },
    });

    // =====================================================
    // 3. Delete descendant ODCs first (leaves → root order)
    // =====================================================
    if (descendantIds.length > 0) {
      await tx.odc.deleteMany({
        where: { id: { in: descendantIds } },
      });
    }

    // =====================================================
    // 4. Release OLT port (for root ODC)
    // =====================================================
    if (odc.oltPortId) {
      await tx.oltPort.update({
        where: { id: odc.oltPortId },
        data: { isUsed: false },
      });
    }

    // =====================================================
    // 5. Delete root ODC
    // =====================================================
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

    let roadCoordsVal = null;
    if (odc.latitude !== null && odc.longitude !== null && data.latitude && data.longitude) {
      try {
        const coords = await getRoadRoute(
          Number(odc.latitude), Number(odc.longitude),
          Number(data.latitude), Number(data.longitude)
        );
        if (coords) roadCoordsVal = JSON.stringify(coords);
      } catch (e) {
        console.error("Failed to compute road route for new ODP:", e);
      }
    }

    const odp = await tx.odp.create({
      data: {
        name: data.name.trim(),
        odcId,
        splitRatio: data.splitRatio,
        latitude: toCoord(data.latitude),
        longitude: toCoord(data.longitude),
        roadCoordinates: roadCoordsVal,
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

      if (data.photoUrl !== undefined && odp.photoUrl && data.photoUrl !== odp.photoUrl) {
          deleteImage(odp.photoUrl);
      }
      if (data.photoUrl2 !== undefined && odp.photoUrl2 && data.photoUrl2 !== odp.photoUrl2) {
          deleteImage(odp.photoUrl2);
      }
      if (data.photoUrl3 !== undefined && odp.photoUrl3 && data.photoUrl3 !== odp.photoUrl3) {
          deleteImage(odp.photoUrl3);
      }

      let roadCoordsVal = data.roadCoordinates;
      const finalLat = data.latitude !== undefined ? toCoordUpdate(data.latitude) : (odp.latitude !== null ? Number(odp.latitude) : null);
      const finalLng = data.longitude !== undefined ? toCoordUpdate(data.longitude) : (odp.longitude !== null ? Number(odp.longitude) : null);
      
      const isMoved = (data.latitude !== undefined && toCoordUpdate(data.latitude) !== (odp.latitude !== null ? Number(odp.latitude) : null)) ||
                      (data.longitude !== undefined && toCoordUpdate(data.longitude) !== (odp.longitude !== null ? Number(odp.longitude) : null));

      if (roadCoordsVal === null || (isMoved && !data.roadCoordinates)) {
        let parentLat = null;
        let parentLng = null;
        if (odp.odcId) {
          const parent = await tx.odc.findUnique({ where: { id: odp.odcId } });
          if (parent && parent.latitude !== null && parent.longitude !== null) {
            parentLat = Number(parent.latitude);
            parentLng = Number(parent.longitude);
          }
        }
        
        if (parentLat !== null && parentLng !== null && finalLat !== null && finalLng !== null) {
          const { getRoadRoute } = require("../../../utils/routing");
          const coords = await getRoadRoute(parentLat, parentLng, finalLat, finalLng);
          if (coords) {
            roadCoordsVal = JSON.stringify(coords);
          }
        }
      }

      return tx.odp.update({
        where: {
          id: odpId,
        },
        data: {
          name: data.name?.trim(),
          latitude: toCoordUpdate(data.latitude),
          longitude: toCoordUpdate(data.longitude),
          splitRatio: data.splitRatio,
          ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
          ...(data.photoUrl2 !== undefined && { photoUrl2: data.photoUrl2 }),
          ...(data.photoUrl3 !== undefined && { photoUrl3: data.photoUrl3 }),
          ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
          ...(data.address !== undefined && { address: data.address }),
          roadCoordinates: roadCoordsVal,
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
        where: { id: odpId },
        include: { ports: true },
      });

      if (!odp) {
        throw new Error("ODP tidak ditemukan");
      }
      
      if (odp.photoUrl) deleteImage(odp.photoUrl);
      if (odp.photoUrl2) deleteImage(odp.photoUrl2);
      if (odp.photoUrl3) deleteImage(odp.photoUrl3);

      // Force-unassign all users from this ODP's ports (do NOT block delete)
      const portIds = odp.ports.map((p) => p.id);
      if (portIds.length > 0) {
        await tx.pppoeUser.updateMany({
          where: { odpPortId: { in: portIds } },
          data: { odpPortId: null },
        });
      }

      // Release ODC port that references this ODP
      await tx.odcPort.updateMany({
        where: { connectedOdpId: odpId },
        data: {
          isUsed: false,
          connectionType: "NONE",
          connectedOdpId: null,
        },
      });

      // Delete ODP ports
      await tx.odpPort.deleteMany({
        where: { odpId },
      });

      return tx.odp.delete({
        where: { id: odpId },
      });
    });
  }
}

module.exports = new TopologyService();