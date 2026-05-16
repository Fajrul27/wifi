const topologyNodeService = require("../../services/topology/topology.service");
// =====================================================
// RESPONSE HELPER
// =====================================================

const response = (res, success, message, data = null) => {
  return res.json({
    success,
    message,
    data,
  });
};

// =====================================================
// CREATE NODE
// =====================================================

exports.create = async (req, res) => {
  try {
    const data = req.body;

    const result = await topologyNodeService.create(data);

    return response(res, true, "Node berhasil dibuat", result);

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// GET ALL
// =====================================================

exports.findAll = async (req, res) => {
  try {
    const result = await topologyNodeService.findAll();

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// GET BY ID
// =====================================================

exports.findById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await topologyNodeService.findById(id);

    return response(res, true, "OK", result);

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// GET ODC
// =====================================================

exports.findODC = async (req, res) => {
  try {
    const result = await topologyNodeService.findODC();

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// GET ODP
// =====================================================

exports.findODP = async (req, res) => {
  try {
    const result = await topologyNodeService.findODP();

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// UPDATE
// =====================================================

exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await topologyNodeService.update(id, req.body);

    return response(res, true, "Node berhasil diupdate", result);

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// DELETE
// =====================================================

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await topologyNodeService.delete(id);

    return response(res, true, "Node berhasil dihapus", result);

  } catch (error) {
    return response(res, false, error.message);
  }
};

// =====================================================
// PORT SUMMARY (ODC/ODP)
// =====================================================

exports.portSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await topologyNodeService.portSummary(id);

    return response(res, true, "OK", result);

  } catch (error) {
    return response(res, false, error.message);
  }
};