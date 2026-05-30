const express = require("express");

const router = express.Router();

const oltPortController = require("../../controllers/topology/oltPort.controller");


// =====================================================
// CREATE
// =====================================================

router.post(
  "/",
  oltPortController.create
);


// =====================================================
// GET ALL
// =====================================================

router.get(
  "/",
  oltPortController.findAll
);


// =====================================================
// GET BY ROUTER
// =====================================================

router.get(
  "/router/:routerId",
  oltPortController.findByRouter
);


// =====================================================
// GET BY ID
// =====================================================

router.get(
  "/:id",
  oltPortController.findById
);


// =====================================================
// UPDATE
// =====================================================

router.put(
  "/:id",
  oltPortController.update
);


// =====================================================
// DELETE
// =====================================================

router.delete(
  "/:id",
  oltPortController.delete
);


// =====================================================
// PORT USAGE
// =====================================================

router.get(
  "/:id/usage",
  oltPortController.getPortUsage
);


router.get(
  "/router/:routerId/scan",
  oltPortController.scanRouterInterfaces
);


module.exports = router;

