console.log("OLT ROUTES LOADED");
const express = require("express");

const router = express.Router();

const oltController = require("../../../controllers/topology/olt/olt.controllers");

// =====================================================
// CREATE OLT
// =====================================================

router.post(
  "/olt",
  oltController.create
);

// =====================================================
// ADD PORTS
// =====================================================

router.post(
  "/olt/:id/ports",
  oltController.addPorts
);

// =====================================================
// DELETE PORT
// =====================================================

router.delete(
  "/olt/ports/:portId",
  oltController.deletePort.bind(oltController)
);

// =====================================================
// GET ALL OLT
// =====================================================

router.get(
  "/olt",
  oltController.findAll
);

// =====================================================
// GET BY ROUTER
// =====================================================

router.get(
  "/olt/router/:routerId",
  oltController.findByRouter
);

// =====================================================
// GET OLT SUMMARY
// =====================================================

router.get(
  "/olt/:id/summary",
  oltController.getSummary
);

// =====================================================
// GET BY ID
// =====================================================

router.get(
  "/olt/:id",
  oltController.findById
);

// =====================================================
// UPDATE OLT
// =====================================================

router.put(
  "/olt/:id",
  oltController.update
);

// =====================================================
// DELETE OLT
// =====================================================

router.delete(
  "/olt/:id",
  oltController.delete
);

// =====================================================
// BULK DELETE
// =====================================================

router.post(
  "/olt/bulk-delete",
  oltController.bulkDelete
);

module.exports = router;