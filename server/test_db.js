const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const routers = await prisma.router.findMany();
  console.log("Routers in DB:", routers);
  process.exit(0);
}
run();
