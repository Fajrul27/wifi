const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const ports = await prisma.oltPort.findMany({
    include: { olt: true }
  });
  console.log("Ports:", JSON.stringify(ports, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
