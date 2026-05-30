const LogService = require("../../services/admin/LogService");

const getRecentLogs = async (req, res) => {
  try {
    const logs = await LogService.getRecentLogs(50);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRecentLogs,
};
