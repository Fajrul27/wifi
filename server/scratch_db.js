const prisma = require('./src/utils/prisma');
require('dotenv').config();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  try {
    const odcs = await prisma.odc.findMany({
      include: {
        oltPort: {
          include: {
            olt: true
          }
        }
      }
    });
    console.log("Fetched ODC records count:", odcs.length);
    console.log("ODC Details:");
    odcs.forEach(o => {
      console.log(`- ID: ${o.id}, Name: ${o.name}, oltPortId: ${o.oltPortId}, parentOdcId: ${o.parentOdcId}, latitude: ${o.latitude}, longitude: ${o.longitude}`);
      if (o.oltPort) {
        console.log(`  - Associated Port: ID ${o.oltPort.id}, Index ${o.oltPort.index}, OLT: ${o.oltPort.olt?.name}, Lat: ${o.oltPort.olt?.latitude}, Lng: ${o.oltPort.olt?.longitude}`);
      }
    });
  } catch (err) {
    console.error("Database query failed:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
