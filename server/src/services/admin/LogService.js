const prisma = require("../../utils/prisma");

class LogService {
  static pruneTimer = null;

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

      // Debounce pruning to run at most once every 30 seconds to prevent DB overloading
      if (!LogService.pruneTimer) {
        LogService.pruneTimer = setTimeout(() => {
          LogService.pruneTimer = null;
          LogService.pruneOldLogs().catch(() => {});
        }, 30000);
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
  static async getRecentLogs(take = 100) {
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

  /**
   * Delete logs beyond the 100 most recent (called after each addLog)
   */
  static async pruneOldLogs() {
    try {
      // Get the 100th log's id
      const logs = await prisma.systemLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: 100,
        take: 1,
        select: { id: true },
      });

      if (logs.length === 0) return; // fewer than 100 logs, nothing to prune

      const cutoffId = logs[0].id;

      await prisma.systemLog.deleteMany({
        where: { id: { lte: cutoffId } },
      });
    } catch (err) {
      // Non-critical — just log silently
      console.error("[LogService] Prune error:", err.message);
    }
  }

}

module.exports = LogService;
