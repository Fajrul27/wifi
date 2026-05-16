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
    const data = await routerService.update(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE
exports.deleteRouter = async (req, res) => {
  await routerService.delete(req.params.id);
  res.json({ message: "Deleted" });
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