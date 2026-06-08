const prisma = require("./prisma");

async function broadcastTopologyUpdate() {
  if (!global.io) return;
  try {
    // 1. Fetch OLT ports formatted
    const rawOltPorts = await prisma.oltPort.findMany({
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
      orderBy: { id: "desc" },
    });

    const oltPorts = rawOltPorts.map(p => ({
      id: p.id,
      routerId: p.olt?.routerId,
      name: p.olt ? `${p.olt.name} - Port ${p.index}` : `Port ${p.index}`,
      oltName: p.olt?.name || '',
      portNumber: p.index,
      port: `PON ${p.index}`,
      latitude: p.olt?.latitude,
      longitude: p.olt?.longitude,
      isUsed: p.isUsed,
      roadCoordinates: p.roadCoordinates ? JSON.parse(p.roadCoordinates) : null,
      createdAt: p.createdAt,
      router: p.olt?.router
    }));

    // 2. Fetch ODC and ODP nodes formatted
    const odcs = await prisma.odc.findMany();
    const odps = await prisma.odp.findMany();

    const odcNodes = odcs.map(odc => {
      return {
        id: odc.id,
        name: odc.name,
        type: "ODC",
        latitude: odc.latitude,
        longitude: odc.longitude,
        oltPortId: odc.oltPortId,
        parentNodeId: odc.parentOdcId,
        photoUrl: odc.photoUrl,
        photoUrl2: odc.photoUrl2,
        photoUrl3: odc.photoUrl3,
        whatsapp: odc.whatsapp,
        address: odc.address,
        roadCoordinates: odc.roadCoordinates ? JSON.parse(odc.roadCoordinates) : null
      };
    });

    const odpNodes = odps.map(odp => {
      return {
        id: odp.id + 100000,
        name: odp.name,
        type: "ODP",
        latitude: odp.latitude,
        longitude: odp.longitude,
        oltPortId: null,
        parentNodeId: odp.odcId,
        photoUrl: odp.photoUrl,
        photoUrl2: odp.photoUrl2,
        photoUrl3: odp.photoUrl3,
        whatsapp: odp.whatsapp,
        address: odp.address,
        roadCoordinates: odp.roadCoordinates ? JSON.parse(odp.roadCoordinates) : null
      };
    });

    const nodes = [...odcNodes, ...odpNodes];

    // Emit topology status update to all connected clients
    global.io.emit("topology-status-realtime", { nodes, oltPorts });
  } catch (err) {
    console.error("Failed to broadcast topology update:", err);
  }
}

module.exports = { broadcastTopologyUpdate };
