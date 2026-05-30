const TopologyService = require("../../../services/topology/odc-odp/TopologyService");
const prisma = require("../../../utils/prisma");
const { getRoadRoute } = require("../../../utils/routing");

class TopologyController {

  // =====================================================
  // CREATE ODC
  // =====================================================

  async createOdc(req, res) {
    try {
      const result = await TopologyService.createOdc(req.body);
      return res.json({ success: true, message: "ODC created successfully", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // UPDATE ODC
  // =====================================================

  async updateOdc(req, res) {
    try {
      const { id } = req.params;
      const result = await TopologyService.updateOdc(id, req.body);
      return res.json({ success: true, message: "ODC updated successfully", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // CREATE CHILD ODC
  // =====================================================

  async createOdcChild(req, res) {
    try {
      const { parentId } = req.params;
      const result = await TopologyService.createOdcChild(parentId, req.body);
      return res.json({ success: true, message: "Child ODC created successfully", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET ODC TREE
  // =====================================================

  async getOdcTree(req, res) {
    try {
      const { oltPortId } = req.params;
      const result = await TopologyService.getOdcTree(oltPortId);
      return res.json({ success: true, message: "ODC tree fetched", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // DELETE ODC
  // =====================================================

  async deleteOdc(req, res) {
    try {
      const { id } = req.params;
      const result = await TopologyService.deleteOdc(id);
      return res.json({ success: true, message: "ODC deleted", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // CREATE ODP
  // =====================================================

  async createOdp(req, res) {
    try {
      const result = await TopologyService.createOdp(req.body);
      return res.json({ success: true, message: "ODP created successfully", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // UPDATE ODP
  // =====================================================

  async updateOdp(req, res) {
    try {
      const { id } = req.params;
      const result = await TopologyService.updateOdp(id, req.body);
      return res.json({ success: true, message: "ODP updated successfully", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET ODP DETAIL
  // =====================================================

  async getOdpById(req, res) {
    try {
      const { id } = req.params;
      const result = await TopologyService.getOdpById(id);
      return res.json({ success: true, message: "ODP detail fetched", data: result });
    } catch (err) {
      return res.status(404).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // ASSIGN USER TO ODP PORT
  // =====================================================

  async assignUserToOdp(req, res) {
    try {
      const { odpId } = req.params;
      const { userId, odpPortId } = req.body;

      if (!userId || !odpPortId) {
        return res.status(400).json({ success: false, message: "userId dan odpPortId wajib diisi" });
      }

      const result = await TopologyService.assignUserToOdp(odpId, userId, odpPortId);
      return res.json({ success: true, message: "User assigned to ODP", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // UNASSIGN USER FROM ODP
  // =====================================================

  async unassignUserFromOdp(req, res) {
    try {
      const { userId } = req.params;
      const result = await TopologyService.unassignUserFromOdp(userId);
      return res.json({ success: true, message: "User unassigned from ODP", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // DELETE ODP
  // =====================================================

  async deleteOdp(req, res) {
    try {
      const { id } = req.params;
      const result = await TopologyService.deleteOdp(id);
      return res.json({ success: true, message: "ODP deleted", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET ODPs BY ODC PORT
  // =====================================================

  async getOdpsByPort(req, res) {
    try {
      const { portId } = req.params;
      const result = await TopologyService.getOdpsByPort(portId);
      return res.json({ success: true, message: "ODPs fetched", data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET AVAILABLE OLT PORTS (tanpa ODC)
  // =====================================================

  async getAvailablePorts(req, res) {
    try {
      const ports = await prisma.oltPort.findMany({
        where: { isUsed: false },
        include: { olt: true },
        orderBy: { id: "asc" },
      });
      return res.json({ success: true, data: ports });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET USERS BY ROUTER (lightweight - DB only, no Mikrotik sync)
  // =====================================================

  async getUsersByRouter(req, res) {
    try {
      const routerId = Number(req.params.routerId);
      if (isNaN(routerId)) {
        return res.status(400).json({ success: false, message: "routerId tidak valid" });
      }
      const users = await prisma.pppoeUser.findMany({
        where: { routerId },
        select: { id: true, username: true, profile: true, odpPortId: true },
        orderBy: { username: "asc" },
      });
      return res.json({ success: true, data: users });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // GET TOPOLOGY MAP (For Admin Dashboard)
  // =====================================================
  async getTopologyMap(req, res) {
    try {
      const odcs = await prisma.odc.findMany();
      const odps = await prisma.odp.findMany();
      const oltPorts = await prisma.oltPort.findMany({
        include: {
          olt: true
        }
      });

      const routeTasks = [];

      // ODC nodes
      const odcNodes = odcs.map(odc => {
        let parentLat = null;
        let parentLng = null;

        if (odc.oltPortId) {
          const port = oltPorts.find(p => p.id === odc.oltPortId);
          if (port && port.olt) {
            parentLat = port.olt.latitude;
            parentLng = port.olt.longitude;
          }
        } else if (odc.parentOdcId) {
          const parent = odcs.find(o => o.id === odc.parentOdcId);
          if (parent) {
            parentLat = parent.latitude;
            parentLng = parent.longitude;
          }
        }

        const node = {
          id: odc.id,
          name: odc.name,
          type: "ODC",
          latitude: odc.latitude,
          longitude: odc.longitude,
          oltPortId: odc.oltPortId,
          parentNodeId: odc.parentOdcId,
          roadCoordinates: null
        };

        if (parentLat !== null && parentLng !== null && odc.latitude !== null && odc.longitude !== null) {
          routeTasks.push(async () => {
            node.roadCoordinates = await getRoadRoute(
              Number(parentLat), Number(parentLng),
              Number(odc.latitude), Number(odc.longitude)
            );
          });
        }

        return node;
      });

      // ODP nodes
      const odpNodes = odps.map(odp => {
        let parentLat = null;
        let parentLng = null;

        if (odp.odcId) {
          const parent = odcs.find(o => o.id === odp.odcId);
          if (parent) {
            parentLat = parent.latitude;
            parentLng = parent.longitude;
          }
        }

        const node = {
          id: odp.id + 100000,
          name: odp.name,
          type: "ODP",
          latitude: odp.latitude,
          longitude: odp.longitude,
          oltPortId: null,
          parentNodeId: odp.odcId,
          roadCoordinates: null
        };

        if (parentLat !== null && parentLng !== null && odp.latitude !== null && odp.longitude !== null) {
          routeTasks.push(async () => {
            node.roadCoordinates = await getRoadRoute(
              Number(parentLat), Number(parentLng),
              Number(odp.latitude), Number(odp.longitude)
            );
          });
        }

        return node;
      });

      // Execute OSRM tasks in parallel with throttling managed by getRoadRoute
      await Promise.all(routeTasks.map(t => t()));

      const nodes = [...odcNodes, ...odpNodes];

      return res.json({
        success: true,
        total: nodes.length,
        data: nodes
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

}

module.exports = new TopologyController();