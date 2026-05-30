const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class LogService {
  /**
   * Add a new system log
   * @param {string} message 
   * @param {string} type 'info' | 'success' | 'warning' | 'danger'
   */
  static async addLog(message, type = "info") {
    try {
      const log = await prisma.systemLog.create({
        data: {
          message,
          type,
        },
      });

      // Emit to all connected clients
      if (global.io) {
        global.io.emit("new-system-log", log);
      }

      return log;
    } catch (err) {
      console.error("[LogService] Failed to add log:", err);
    }
  }

  /**
   * Get recent logs
   * @param {number} take Number of logs to fetch
   */
  static async getRecentLogs(take = 50) {
    try {
      return await prisma.systemLog.findMany({
        take,
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (err) {
      console.error("[LogService] Failed to get logs:", err);
      return [];
    }
  }
}

module.exports = LogService;
