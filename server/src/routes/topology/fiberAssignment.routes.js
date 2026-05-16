const express = require("express");
const router = express.Router();

const controller = require("../../controllers/topology/fiberAssignment.controller");

// =====================================================
// ASSIGN CLIENT TO FIBER
// =====================================================
router.post("/assign", controller.assignClientToFiber);

// =====================================================
// UNASSIGN CLIENT FROM OUTPUT
// =====================================================
router.delete("/unassign/:outputId", controller.unassignClient);

module.exports = router;