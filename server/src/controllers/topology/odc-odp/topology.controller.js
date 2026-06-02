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
          photoUrl: odc.photoUrl,
          photoUrl2: odc.photoUrl2,
          photoUrl3: odc.photoUrl3,
          whatsapp: odc.whatsapp,
          address: odc.address,
          roadCoordinates: null
        };

        if (odc.roadCoordinates) {
          try {
            node.roadCoordinates = JSON.parse(odc.roadCoordinates);
          } catch (e) {
            console.error("Failed to parse ODC roadCoordinates:", e);
          }
        }

        if (!node.roadCoordinates && parentLat !== null && parentLng !== null && odc.latitude !== null && odc.longitude !== null) {
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
          photoUrl: odp.photoUrl,
          photoUrl2: odp.photoUrl2,
          photoUrl3: odp.photoUrl3,
          whatsapp: odp.whatsapp,
          address: odp.address,
          roadCoordinates: null
        };

        if (odp.roadCoordinates) {
          try {
            node.roadCoordinates = JSON.parse(odp.roadCoordinates);
          } catch (e) {
            console.error("Failed to parse ODP roadCoordinates:", e);
          }
        }

        if (!node.roadCoordinates && parentLat !== null && parentLng !== null && odp.latitude !== null && odp.longitude !== null) {
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

  // =====================================================
  // SEARCH TOPOLOGY (ODC, ODP, USER)
  // =====================================================
  async searchTopology(req, res) {
    try {
      const q = req.query.q ? String(req.query.q).trim() : "";
      const routerId = req.query.routerId ? Number(req.query.routerId) : null;

      if (!q) {
        return res.json({ success: true, data: [] });
      }

      // Fetch all ODCs to resolve oltPortId recursively
      const odcs = await prisma.odc.findMany({
        include: {
          oltPort: { include: { olt: true } }
        }
      });

      // Helper function to find root oltPortId and parent path for an ODC
      const findOdcHierarchy = (odcId) => {
        const path = [];
        let curr = odcs.find(o => o.id === odcId);
        let oltPortId = null;
        let oltId = null;

        while (curr) {
          path.unshift(curr.id);
          if (curr.oltPortId) {
            oltPortId = curr.oltPortId;
            oltId = curr.oltPort?.oltId || null;
            break;
          }
          if (curr.parentOdcId) {
            curr = odcs.find(o => o.id === curr.parentOdcId);
          } else {
            break;
          }
        }
        return { oltPortId, oltId, path };
      };

      // 1. Search ODCs
      const matchedOdcs = odcs.filter(o => 
        o.name.toLowerCase().includes(q.toLowerCase()) && 
        (!routerId || (o.oltPort?.olt?.routerId === routerId || (o.parentOdcId && findOdcHierarchy(o.id).oltId === routerId)))
      );

      const odcResults = matchedOdcs.map(o => {
        const { oltPortId, path } = findOdcHierarchy(o.id);
        return {
          id: `odc-${o.id}`,
          name: o.name,
          type: "ODC",
          oltPortId,
          path,
          realId: o.id,
          label: `ODC: ${o.name}`
        };
      });

      // 2. Search ODPs
      const odps = await prisma.odp.findMany({
        where: {
          name: { contains: q, mode: "insensitive" }
        }
      });

      const odpResults = [];
      for (const odp of odps) {
        const { oltPortId, path } = findOdcHierarchy(odp.odcId);
        let matchesRouter = true;
        if (routerId && oltPortId) {
          const port = await prisma.oltPort.findUnique({
            where: { id: oltPortId },
            include: { olt: true }
          });
          if (port?.olt?.routerId !== routerId) {
            matchesRouter = false;
          }
        }
        if (matchesRouter) {
          odpResults.push({
            id: `odp-${odp.id}`,
            name: odp.name,
            type: "ODP",
            oltPortId,
            path,
            realId: odp.id,
            label: `ODP: ${odp.name}`
          });
        }
      }

      // 3. Search PPPoE Users
      const users = await prisma.pppoeUser.findMany({
        where: {
          username: { contains: q, mode: "insensitive" },
          ...(routerId ? { routerId } : {})
        },
        include: {
          odpPort: { include: { odp: true } }
        }
      });

      const userResults = [];
      for (const u of users) {
        if (u.odpPort?.odp) {
          const { oltPortId, path } = findOdcHierarchy(u.odpPort.odp.odcId);
          userResults.push({
            id: `user-${u.id}`,
            name: u.username,
            type: "USER",
            oltPortId,
            path,
            realId: u.id,
            label: `User: ${u.username} (di ODP ${u.odpPort.odp.name})`
          });
        }
      }

      const results = [...odcResults, ...odpResults, ...userResults].slice(0, 15);

      return res.json({ success: true, data: results });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // =====================================================
  // UPLOAD PHOTO
  // =====================================================

  async uploadPhoto(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No photo uploaded" });
      }
      return res.json({ 
        success: true, 
        message: "Photo uploaded successfully", 
        data: { photoUrl: req.file.path } 
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

}

module.exports = new TopologyController();