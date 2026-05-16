const express = require("express");
const router = express.Router();

const controller = require("../../controllers/topology/splitter.controller");

// CREATE SPLITTER
router.post("/", controller.create);

// GENERATE OUTPUT PORTS
router.post("/:id/generate", controller.generateOutputs);

// GET ALL
router.get("/", controller.findAll);

// GET BY NODE
router.get("/node/:nodeId", controller.findByNode);

// ASSIGN OUTPUT
router.put("/output/:id/assign", controller.assignOutput);
router.put("/output/:id/unassign", controller.unassignOutput);
router.get("/output/client/:clientId", controller.findByClient);
router.post("/user/:clientId/force-reset", controller.forceResetUser);

// DELETE SPLITTER
router.delete("/:id", controller.remove);

module.exports = router;