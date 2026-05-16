const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanup() {
  console.log("Starting cleanup of duplicate assignments...");
  
  // Ambil semua output yang terpakai oleh client
  const assignedOutputs = await prisma.splitterOutput.findMany({
    where: { 
      isUsed: true,
      clientId: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  const seenClients = new Set();
  let cleanedCount = 0;

  for (const output of assignedOutputs) {
    if (seenClients.has(output.clientId)) {
      // Ini duplikat, lepaskan
      await prisma.splitterOutput.update({
        where: { id: output.id },
        data: {
          isUsed: false,
          clientId: null,
          targetNodeId: null
        }
      });
      cleanedCount++;
    } else {
      seenClients.add(output.clientId);
    }
  }

  console.log(`Cleanup finished. Removed ${cleanedCount} duplicate assignments.`);
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
