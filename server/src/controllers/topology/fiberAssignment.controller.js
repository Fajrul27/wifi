const fiberAssignmentService = require("../../services/topology/fiberAssignment.service");

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
// ASSIGN CLIENT TO FIBER
// =====================================================
exports.assignClientToFiber = async (req, res) => {
  try {
    const { clientId, outputId } = req.body;

    const result = await fiberAssignmentService.assignClientToFiber(
      clientId,
      outputId
    );

    return response(res, true, "Client berhasil di-assign ke fiber", result);

  } catch (err) {
    return response(res, false, err.message);
  }
};

// =====================================================
// UNASSIGN CLIENT
// =====================================================
exports.unassignClient = async (req, res) => {
  try {
    const { outputId } = req.params;

    const result = await fiberAssignmentService.unassignClient(outputId);

    return response(res, true, "Client berhasil dilepas", result);

  } catch (err) {
    return response(res, false, err.message);
  }
};