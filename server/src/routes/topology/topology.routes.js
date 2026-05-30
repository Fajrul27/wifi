const express = require("express");
const router = express.Router();

const controller = require("../../controllers/topology/topology.controller");

// =====================================================
// NODE ROUTES (ODC / ODP)
// =====================================================

// CREATE NODE
router.post("/", controller.create);

// GET ALL NODE
router.get("/", controller.findAll);

// GET ODC ONLY
router.get("/odc", controller.findODC);

// GET ODP ONLY
router.get("/odp", controller.findODP);

// GET PORT SUMMARY
router.get("/:id/ports", controller.portSummary);

// GET BY ID
router.get("/:id", controller.findById);

// UPDATE NODE
router.put("/:id", controller.update);

// DELETE NODE
router.delete("/:id", controller.remove);

module.exports = router;