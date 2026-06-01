const express = require("express");
const router = express.Router();

const TopologyController = require("../../../controllers/topology/odc-odp/topology.controller");

// =====================================================
// ====================== ODC ==========================
// =====================================================

router.get("/", TopologyController.getTopologyMap);
router.post("/odc", TopologyController.createOdc);

router.put("/odc/:id", TopologyController.updateOdc);

router.post("/odc/:parentId/child", TopologyController.createOdcChild);

router.get("/odc/tree/:oltPortId", TopologyController.getOdcTree);

router.delete("/odc/:id", TopologyController.deleteOdc);

router.get( "/odps/by-port/:portId",TopologyController.getOdpsByPort);
// =====================================================
// ====================== ODP ==========================
// =====================================================

router.post("/odp", TopologyController.createOdp);

router.put("/odp/:id", TopologyController.updateOdp);

router.post("/odp/:odpId/assign", TopologyController.assignUserToOdp);

router.post("/odp/unassign/:userId", TopologyController.unassignUserFromOdp);

router.get("/odp/:id", TopologyController.getOdpById);

router.delete("/odp/:id", TopologyController.deleteOdp);

router.get("/ports/available", TopologyController.getAvailablePorts);

router.get("/users/:routerId", TopologyController.getUsersByRouter);

// =====================================================
// ====================== PHOTO ========================
// =====================================================

const { upload } = require("../../../utils/cloudinary");
router.post("/photo", function(req, res, next) {
    upload.single("photo")(req, res, function(err) {
        if (err) {
            return res.status(400).json({ success: false, message: "Upload gagal: " + err.message });
        }
        TopologyController.uploadPhoto(req, res);
    });
});

module.exports = router;