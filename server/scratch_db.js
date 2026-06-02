const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const routerCount = await prisma.router.count();
  const odcCount = await prisma.odc.count();
  const odpCount = await prisma.odp.count();
  const odpPortCount = await prisma.odpPort.count();
  const activeOdpPorts = await prisma.odpPort.count({ where: { isUsed: true } });
  const pppoeUserCount = await prisma.pppoeUser.count();
  const pppoeWithOdp = await prisma.pppoeUser.count({ where: { NOT: { odpPortId: null } } });
  const childOdcCount = await prisma.odc.count({ where: { NOT: { parentOdcId: null } } });
  const rootOdcCount = await prisma.odc.count({ where: { parentOdcId: null } });

  console.log("=== DB DATA ANALYSIS ===");
  console.log("Routers count:", routerCount);
  console.log("Root ODC count:", rootOdcCount);
  console.log("Child ODC count:", childOdcCount);
  console.log("Total ODC count:", odcCount);
  console.log("Total ODP count:", odpCount);
  console.log("Total ODP Ports count:", odpPortCount);
  console.log("Active ODP Ports (isUsed=true):", activeOdpPorts);
  console.log("Total PPPoE Users in DB:", pppoeUserCount);
  console.log("PPPoE Users mapped to an ODP Port in DB:", pppoeWithOdp);

  // Let's check a few ODC ports connectionType
  const odcPortsConnectionType = await prisma.odcPort.groupBy({
    by: ['connectionType'],
    _count: { id: true }
  });
  console.log("\nODC Port ConnectionType distribution:");
  console.log(odcPortsConnectionType);

  // Let's inspect if any PPPoE users are mapped to ODPs that belong to child ODCs
  const childOdcs = await prisma.odc.findMany({
    where: { NOT: { parentOdcId: null } },
    select: { id: true, name: true }
  });
  console.log("\nChild ODCs sample:");
  console.log(childOdcs.slice(0, 5));

  // Let's check how many ODPs are under child ODCs
  const childOdcIds = childOdcs.map(c => c.id);
  const odpsUnderChildOdc = await prisma.odp.count({
    where: { odcId: { in: childOdcIds } }
  });
  console.log("\nODPs under Child ODCs:", odpsUnderChildOdc);
}

main().catch(console.error).finally(() => prisma.$disconnect());
