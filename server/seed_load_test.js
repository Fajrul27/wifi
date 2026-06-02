require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { encrypt } = require("./src/utils/crypto");

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting load test seeding...");

  // 1. Clean up old load test data to prevent duplicates
  console.log("🧹 Cleaning up old load test data...");
  await prisma.user.deleteMany({
    where: {
      username: { startsWith: "loadtest_user" }
    }
  });

  await prisma.pppoeUser.deleteMany({
    where: {
      username: { startsWith: "loadtest_pppoe" }
    }
  });

  await prisma.odpPort.deleteMany({
    where: {
      odp: {
        name: { startsWith: "ODP_LoadTest" }
      }
    }
  });

  await prisma.odp.deleteMany({
    where: {
      name: { startsWith: "ODP_LoadTest" }
    }
  });

  await prisma.odcPort.deleteMany({
    where: {
      odc: {
        name: { startsWith: "ODC_LoadTest" }
      }
    }
  });

  await prisma.odc.deleteMany({
    where: {
      name: { startsWith: "ODC_LoadTest" }
    }
  });

  await prisma.oltPort.deleteMany({
    where: {
      olt: {
        name: { startsWith: "OLT_LoadTest" }
      }
    }
  });

  await prisma.olt.deleteMany({
    where: {
      name: { startsWith: "OLT_LoadTest" }
    }
  });

  await prisma.router.deleteMany({
    where: {
      name: { startsWith: "Router_LoadTest" }
    }
  });

  // 2. Hash password once to save CPU time
  console.log("🔑 Hashing password for 1000 mock web users...");
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 3. Create mock Router
  console.log("📡 Creating mock Router...");
  const baseLat = -6.2000;
  const baseLng = 106.8166;

  const router = await prisma.router.create({
    data: {
      name: "Router_LoadTest_1",
      host: "192.168.99.1",
      username: "admin",
      password: encrypt("password"),
      port: 8728,
      latitude: baseLat,
      longitude: baseLng,
      isOnline: true,
    }
  });

  // 4. Create OLT
  console.log("🗼 Creating mock OLT...");
  const olt = await prisma.olt.create({
    data: {
      routerId: router.id,
      name: "OLT_LoadTest_1",
      latitude: baseLat,
      longitude: baseLng,
    }
  });

  // Create OLT Ports
  console.log("🔌 Creating OLT Ports...");
  const oltPorts = [];
  for (let i = 1; i <= 8; i++) {
    const port = await prisma.oltPort.create({
      data: {
        oltId: olt.id,
        index: i,
        isUsed: false,
      }
    });
    oltPorts.push(port);
  }

  // 5. Create 10 ODCs (4 root ODCs, 6 child ODCs)
  console.log("📦 Creating mock ODCs & Ports...");
  const odcs = [];
  
  // 4 Root ODCs
  for (let i = 0; i < 4; i++) {
    const odcLat = baseLat + Math.sin(i) / 100;
    const odcLng = baseLng + Math.cos(i) / 100;
    const roadCoords = JSON.stringify([[baseLat, baseLng], [odcLat, odcLng]]);

    const rootOdc = await prisma.odc.create({
      data: {
        oltPortId: oltPorts[i].id,
        name: `ODC_LoadTest_Root_${i + 1}`,
        latitude: odcLat,
        longitude: odcLng,
        splitRatio: "ONE_TO_16",
        roadCoordinates: roadCoords,
      }
    });

    // Mark OLT port as used
    await prisma.oltPort.update({
      where: { id: oltPorts[i].id },
      data: { isUsed: true }
    });

    // Create ODC Ports
    const capacity = 16;
    const ports = [];
    for (let p = 1; p <= capacity; p++) {
      const port = await prisma.odcPort.create({
        data: {
          odcId: rootOdc.id,
          index: p,
          isUsed: false,
          connectionType: "NONE",
        }
      });
      ports.push(port);
    }
    rootOdc.ports = ports;
    odcs.push(rootOdc);
  }

  // 6 Child ODCs (linked to Root ODCs)
  for (let i = 0; i < 6; i++) {
    const parentOdc = odcs[i % 4];
    const parentPort = parentOdc.ports[Math.floor(i / 4)]; // Use first or second port of parent

    const odcLat = parentOdc.latitude + Math.sin(i + 10) / 300;
    const odcLng = parentOdc.longitude + Math.cos(i + 10) / 300;
    const roadCoords = JSON.stringify([[parentOdc.latitude, parentOdc.longitude], [odcLat, odcLng]]);

    const childOdc = await prisma.odc.create({
      data: {
        parentOdcId: parentOdc.id,
        name: `ODC_LoadTest_Child_${i + 1}`,
        latitude: odcLat,
        longitude: odcLng,
        splitRatio: "ONE_TO_16",
        roadCoordinates: roadCoords,
      }
    });

    // Update parent port
    await prisma.odcPort.update({
      where: { id: parentPort.id },
      data: {
        isUsed: true,
        connectionType: "ODC",
        connectedOdcId: childOdc.id,
      }
    });

    // Fix stale RAM state: update in-memory parentPort properties so it is not re-selected for ODP
    parentPort.isUsed = true;
    parentPort.connectionType = "ODC";
    parentPort.connectedOdcId = childOdc.id;

    // Create ODC Ports
    const capacity = 16;
    const ports = [];
    for (let p = 1; p <= capacity; p++) {
      const port = await prisma.odcPort.create({
        data: {
          odcId: childOdc.id,
          index: p,
          isUsed: false,
          connectionType: "NONE",
        }
      });
      ports.push(port);
    }
    childOdc.ports = ports;
    odcs.push(childOdc);
  }

  // 6. Create 100 ODPs distributed across the 10 ODCs (10 ODPs per ODC)
  console.log("🗺️ Creating 100 ODPs...");
  const odps = [];
  let odpCount = 0;

  for (let o = 0; o < odcs.length; o++) {
    const odc = odcs[o];
    // Find unused ports
    const unusedPorts = odc.ports.filter(p => p.connectionType === "NONE" && !p.isUsed).slice(0, 10);

    for (let j = 0; j < unusedPorts.length; j++) {
      odpCount++;
      const port = unusedPorts[j];
      const odpLat = odc.latitude + Math.sin(odpCount) / 1000;
      const odpLng = odc.longitude + Math.cos(odpCount) / 1000;
      const roadCoords = JSON.stringify([[odc.latitude, odc.longitude], [odpLat, odpLng]]);

      const odp = await prisma.odp.create({
        data: {
          odcId: odc.id,
          name: `ODP_LoadTest_${odpCount}`,
          latitude: odpLat,
          longitude: odpLng,
          splitRatio: "ONE_TO_16",
          roadCoordinates: roadCoords,
        }
      });

      // Update ODC port
      await prisma.odcPort.update({
        where: { id: port.id },
        data: {
          isUsed: true,
          connectionType: "ODP",
          connectedOdpId: odp.id,
        }
      });

      // Update in-memory port properties for consistency
      port.isUsed = true;
      port.connectionType = "ODP";
      port.connectedOdpId = odp.id;

      // Create ODP Ports
      const ports = [];
      for (let p = 1; p <= 16; p++) {
        const op = await prisma.odpPort.create({
          data: {
            odpId: odp.id,
            index: p,
            isUsed: false,
          }
        });
        ports.push(op);
      }
      odp.ports = ports;
      odps.push(odp);
    }
  }

  // 7. Create 1000 PPPoE Users distributed evenly across ODPs (10 users per ODP)
  console.log("👥 Creating 1000 PPPoE Users...");
  const pppoeUserData = [];
  let userCount = 0;

  for (let o = 0; o < odps.length; o++) {
    const odp = odps[o];
    for (let u = 0; u < 10; u++) {
      userCount++;
      const port = odp.ports[u];
      const userLat = odp.latitude + Math.sin(userCount) / 5000;
      const userLng = odp.longitude + Math.cos(userCount) / 5000;
      const roadCoords = JSON.stringify([[odp.latitude, odp.longitude], [userLat, userLng]]);

      // Update ODP Port
      await prisma.odpPort.update({
        where: { id: port.id },
        data: { isUsed: true }
      });

      // Prepare PPPoE user record
      pppoeUserData.push({
        routerId: router.id,
        username: `loadtest_pppoe_${userCount}`,
        odpPortId: port.id,
        latitude: userLat,
        longitude: userLng,
        isOnline: Math.random() > 0.15, // 85% online, 15% offline
        profile: "Profile_LoadTest",
        localAddress: `10.10.10.${Math.floor(userCount / 254) + 1}`,
        remoteAddress: `10.10.10.${(userCount % 254) + 1}`,
        roadCoordinates: roadCoords,
      });
    }
  }

  // Bulk insert PPPoE users (very fast)
  await prisma.pppoeUser.createMany({
    data: pppoeUserData
  });

  // 8. Create 1000 Web Users (k6 login test accounts: loadtest_user_1 to loadtest_user_1000)
  console.log("👷 Creating 1000 Mock Web/Technician Users (for k6 authentication)...");
  const webUserData = [];
  for (let i = 1; i <= 1000; i++) {
    webUserData.push({
      username: `loadtest_user_${i}`,
      email: `loadtest_user_${i}@loadtest.com`,
      password: hashedPassword,
      role: "TEKNISI",
      isVerified: true,
      status: "AKTIF",
      area: "Area Load Test",
      phone: `08123456${String(i).padStart(4, '0')}`,
    });
  }

  await prisma.user.createMany({
    data: webUserData
  });

  console.log("\n✅ Seeding completed successfully!");
  console.log(`================ SUMMARY OF CREATED LOAD TEST DATA ================`);
  console.log(`- 1 Router: Router_LoadTest_1`);
  console.log(`- 1 OLT: OLT_LoadTest_1 (with 8 Ports)`);
  console.log(`- 10 ODCs: ODC_LoadTest_Root_1-4 and ODC_LoadTest_Child_1-6`);
  console.log(`- 100 ODPs: ODP_LoadTest_1-100`);
  console.log(`- 1000 PPPoE Users: loadtest_pppoe_1-1000 (distributed across ODPs)`);
  console.log(`- 1000 Web Users: loadtest_user_1-1000 (Password: password123)`);
  console.log(`===================================================================`);
}

main()
  .catch((e) => {
    console.error("❌ Error in load test seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
