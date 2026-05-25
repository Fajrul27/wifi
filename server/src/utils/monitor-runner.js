const prisma = require("@prisma/client").PrismaClient;
const MikroTikService = require("../services/admin/MikroTikService");

const db = new prisma();

async function startAllRouters() {
  const routers = await db.router.findMany();

  routers.forEach((router) => {
    const service = new MikroTikService(router);

    // 🔥 realtime stream tiap router
    service.startStream(5000);
  });
}

startAllRouters();