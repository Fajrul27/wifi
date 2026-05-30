const routerService = require("../../services/admin/MikroTikService");

// CREATE
exports.createRouter = async (req, res) => {
  try {
    const router = await routerService.create(req.body);
    res.json(router);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL
exports.getRouters = async (req, res) => {
  const data = await routerService.findAll();
  res.json(data);
};

// GET BY ID
exports.getRouterById = async (req, res) => {
  const data = await routerService.findById(req.params.id);
  if (!data) return res.status(404).json({ message: "Not found" });
  res.json(data);
};

// UPDATE
exports.updateRouter = async (req, res) => {
  try {
    const routerId = Number(req.params.id);

    // Stop old worker and clear cache
    try {
      const monitoring = require("../../services/admin/monitoring");
      const pppoeController = require("./pppoe.controller");

      if (monitoring.stopRouterWorker) {
        await monitoring.stopRouterWorker(routerId);
      }
      if (pppoeController.clearService) {
        pppoeController.clearService(routerId);
      }
    } catch (e) {
      console.error("Error stopping worker during update:", e);
    }

    const data = await routerService.update(req.params.id, req.body);

    // Start new worker with new config
    try {
      const monitoring = require("../../services/admin/monitoring");
      const updatedRouter = await routerService.findRawById(routerId);
      if (updatedRouter && monitoring.startRouterWorker) {
        await monitoring.startRouterWorker(updatedRouter);
      }
    } catch (e) {
      console.error("Error restarting worker during update:", e);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE
exports.deleteRouter = async (req, res) => {
  try {
    const routerId = Number(req.params.id);

    // Stop worker and clear cache
    try {
      const monitoring = require("../../services/admin/monitoring");
      const pppoeController = require("./pppoe.controller");

      if (monitoring.stopRouterWorker) {
        await monitoring.stopRouterWorker(routerId);
      }
      if (pppoeController.clearService) {
        pppoeController.clearService(routerId);
      }
    } catch (e) {
      console.error("Error stopping worker during delete:", e);
    }

    await routerService.delete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// TEST CONNECTION
exports.testConnection = async (req, res) => {
  try {
    const result = await routerService.testConnection(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};