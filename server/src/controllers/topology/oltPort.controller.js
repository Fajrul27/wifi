
// controllers/olt-port.controller.js

const oltPortService = require("../../services/topology/oltPort.service");
const { getRoadRoute } = require("../../utils/routing");

class OltPortController {

  // =====================================================
  // CREATE
  // =====================================================

  async create(req, res) {
    try {

      const result = await oltPortService.create(req.body);

      return res.status(201).json({
        success: true,
        message: "OLT Port berhasil dibuat",
        data: result,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // GET ALL
  // =====================================================

  async findAll(req, res) {
    try {

      const result = await oltPortService.findAll();

      return res.status(200).json({
        success: true,
        total: result.length,
        data: result,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // GET BY ROUTER
  // =====================================================

  async findByRouter(req, res) {
    try {

      const result = await oltPortService.findByRouter(
        req.params.routerId
      );

      const routeTasks = [];

      const portsWithRoutes = result.map(port => {
        const portObj = {
          ...port,
          roadCoordinates: null
        };

        if (port.roadCoordinates) {
          try {
            portObj.roadCoordinates = JSON.parse(port.roadCoordinates);
          } catch (e) {
            console.error("Failed to parse roadCoordinates:", e);
          }
        }

        if (!portObj.roadCoordinates) {
          const rLat = port.router?.latitude;
          const rLng = port.router?.longitude;
          const oLat = port.latitude;
          const oLng = port.longitude;

          if (rLat !== null && rLng !== null && oLat !== null && oLng !== null && 
              rLat !== undefined && rLng !== undefined && oLat !== undefined && oLng !== undefined) {
            routeTasks.push(async () => {
              portObj.roadCoordinates = await getRoadRoute(
                Number(rLat), Number(rLng),
                Number(oLat), Number(oLng)
              );
            });
          }
        }

        return portObj;
      });

      await Promise.all(routeTasks.map(t => t()));

      return res.status(200).json({
        success: true,
        total: portsWithRoutes.length,
        data: portsWithRoutes,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // GET BY ID
  // =====================================================

  async findById(req, res) {
    try {

      const result = await oltPortService.findById(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {

      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // UPDATE
  // =====================================================

  async update(req, res) {
    try {

      const result = await oltPortService.update(
        req.params.id,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "OLT Port berhasil diupdate",
        data: result,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // DELETE
  // =====================================================

  async delete(req, res) {
    try {

      const result = await oltPortService.delete(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message: "OLT Port berhasil dihapus",
        data: result,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // =====================================================
  // PORT USAGE
  // =====================================================

  async getPortUsage(req, res) {
    try {

      const result = await oltPortService.getPortUsage(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  async scanRouterInterfaces(req, res) {
    try {
      const result = await oltPortService.scanRouterInterfaces(req.params.routerId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new OltPortController();

