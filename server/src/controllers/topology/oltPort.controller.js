
// controllers/olt-port.controller.js

const oltPortService = require("../../services/topology/oltPort.service");

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

      return res.status(200).json({
        success: true,
        total: result.length,
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

