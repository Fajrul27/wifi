const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// setiap jam 02:00
cron.schedule("0 2 * * *", async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.routerMetric.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log(`🧹 Daily cleanup: ${result.count} records deleted`);
  } catch (err) {
    console.log("❌ Cron cleanup error:", err.message);
  }
});