const cron = require("node-cron");
const prisma = require("../utils/prisma");

// setiap jam 02:00
cron.schedule("0 2 * * *", async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // RouterMetric model no longer exists in schema,
    // logging cleanup is already handled gracefully by LogService.
    const result = { count: 0 };

    console.log(`🧹 Daily cleanup: ${result.count} records deleted`);
  } catch (err) {
    console.log("❌ Cron cleanup error:", err.message);
  }
});