const TopologyService = require("../../../services/topology/odc-odp/TopologyService");

class TopologyController {

  // =====================================================
  // ====================== ODC ==========================
  // =====================================================

  async createOdc(req, res) {
    try {

      const result = await TopologyService.createOdc(req.body);

      return res.json({
        success: true,
        message: "ODC created successfully",
        data: result,
      });

    } catch (err) {

      return res.status(500).json({
  success: false,
  message: err.message,
  stack: process.env.NODE_ENV === "development" ? err.stack : undefined
});

    }
  }

  async updateOdc(req, res) {
    try {

      const { id } = req.params;

      const result = await TopologyService.updateOdc(id, req.body);

      return res.json({
        success: true,
        message: "ODC updated successfully",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // CREATE CHILD ODC (MANUAL PORT)
  // =====================================================

  async createOdcChild(req, res) {
    try {

      const { parentId } = req.params;

      /*
        BODY:
        {
          name,
          splitRatio,
          odcPortId,
          latitude,
          longitude
        }
      */

      const result = await TopologyService.createOdcChild(
        parentId,
        req.body
      );

      return res.json({
        success: true,
        message: "Child ODC created successfully",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // ODC TREE
  // =====================================================

  async getOdcTree(req, res) {
    try {

      const { oltPortId } = req.params;

      const result = await TopologyService.getOdcTree(oltPortId);

      return res.json({
        success: true,
        message: "ODC tree fetched",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // DELETE ODC
  // =====================================================

  async deleteOdc(req, res) {
    try {

      const { id } = req.params;

      const result = await TopologyService.deleteOdc(id);

      return res.json({
        success: true,
        message: "ODC deleted",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // ====================== ODP ==========================
  // =====================================================

  // =====================================================
  // CREATE ODP (MANUAL PORT)
  // =====================================================

  async createOdp(req, res) {
    try {

      /*
        BODY:
        {
          name,
          odcId,
          splitRatio,
          odcPortId,
          latitude,
          longitude
        }
      */

      const result = await TopologyService.createOdp(req.body);

      return res.json({
        success: true,
        message: "ODP created successfully",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // UPDATE ODP
  // =====================================================

  async updateOdp(req, res) {
    try {

      const { id } = req.params;

      const result = await TopologyService.updateOdp(id, req.body);

      return res.json({
        success: true,
        message: "ODP updated successfully",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // GET ODP DETAIL
  // =====================================================

  async getOdpById(req, res) {
    try {

      const { id } = req.params;

      const result = await TopologyService.getOdpById(id);

      return res.json({
        success: true,
        message: "ODP detail fetched",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // ASSIGN USER TO ODP (MANUAL PORT)
  // =====================================================

  async assignUserToOdp(req, res) {
    try {

      const { odpId } = req.params;

      /*
        BODY:
        {
          userId,
          odpPortId
        }
      */

      const { userId, odpPortId } = req.body;

      const result = await TopologyService.assignUserToOdp(
        odpId,
        userId,
        odpPortId
      );

      return res.json({
        success: true,
        message: "User assigned to ODP",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // UNASSIGN USER
  // =====================================================

  async unassignUserFromOdp(req, res) {
    try {

      const { userId } = req.params;

      const result = await TopologyService.unassignUserFromOdp(userId);

      return res.json({
        success: true,
        message: "User unassigned from ODP",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

  // =====================================================
  // DELETE ODP
  // =====================================================

  async deleteOdp(req, res) {
    try {

      const { id } = req.params;

      const result = await TopologyService.deleteOdp(id);

      return res.json({
        success: true,
        message: "ODP deleted",
        data: result,
      });

    } catch (err) {

      return res.status(400).json({
        success: false,
        message: err.message,
      });

    }
  }

// =====================================================
// GET ODPs BY PORT
// =====================================================

async getOdpsByPort(req, res) {
  try {

    const { portId } = req.params;

    const result = await TopologyService.getOdpsByPort(portId);

    return res.json({
      success: true,
      message: "ODPs fetched",
      data: result,
    });

  } catch (err) {

    return res.status(400).json({
      success: false,
      message: err.message,
    });

  }
}


async getAvailablePorts(req, res) {
  try {
    const ports = await prisma.oltPort.findMany({
      where: {
        odcs: {
          none: {}
        }
      },
      include: {
        olt: true
      }
    });

    res.json({
      success: true,
      data: ports
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}


}

module.exports = new TopologyController();