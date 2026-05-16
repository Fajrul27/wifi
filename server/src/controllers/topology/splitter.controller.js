const splitterService = require("../../services/topology/splitter.service");

const response = (res, success, message, data = null) => {
  return res.json({ success, message, data });
};

// =====================================================
// CREATE SPLITTER
// =====================================================
exports.create = async (req, res) => {
  try {

    const result = await splitterService.create(req.body);

    return response(
      res,
      true,
      "Splitter berhasil dibuat",
      result
    );

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

// =====================================================
// GENERATE OUTPUT
// =====================================================
exports.generateOutputs = async (req, res) => {
  try {

    const { id } = req.params;

    const result = await splitterService.generateOutputs(id);

    return response(
      res,
      true,
      "Output berhasil dibuat",
      result
    );

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

// =====================================================
// GET ALL
// =====================================================
exports.findAll = async (req, res) => {
  try {

    const result = await splitterService.findAll();

    return res.json({
      success: true,
      total: result.length,
      data: result,
    });

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

// =====================================================
// GET BY NODE
// =====================================================
exports.findByNode = async (req, res) => {
  try {

    const result = await splitterService.findByNode(
      req.params.nodeId
    );

    return res.json({
      success: true,
      data: result,
    });

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

// =====================================================
// ASSIGN OUTPUT
// =====================================================
exports.assignOutput = async (req, res) => {
  try {

    const { id } = req.params;

    const result = await splitterService.assignOutput(
      id,
      req.body
    );

    return response(
      res,
      true,
      "Output berhasil diassign",
      result
    );

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

// =====================================================
// UNASSIGN OUTPUT
// =====================================================
exports.unassignOutput = async (req, res) => {
  try {

    const { id } = req.params;

    const result = await splitterService.unassignOutput(id);

    return response(
      res,
      true,
      "Output berhasil di-unassign",
      result
    );

  } catch (err) {

    return response(
      res,
      false,
      err.message
    );
  }
};

exports.findByClient = async (req, res) => {
  try {
    const result = await splitterService.findByClientId(req.params.clientId);
    return response(res, true, "Data port ditemukan", result);
  } catch (err) {
    return response(res, false, err.message);
  }
};

exports.forceResetUser = async (req, res) => {
  try {
    const { clientId } = req.params;
    await prisma.pppoeUser.update({
      where: { id: Number(clientId) },
      data: { topologyNodeId: null }
    });
    return response(res, true, "Status pelanggan berhasil direset paksa.");
  } catch (err) {
    return response(res, false, err.message);
  }
};

// =====================================================
// DELETE SPLITTER
// =====================================================
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await splitterService.remove(id);
    return response(res, true, "Splitter berhasil dihapus");
  } catch (err) {
    return response(res, false, err.message);
  }
};