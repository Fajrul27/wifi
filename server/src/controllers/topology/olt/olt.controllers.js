const oltService = require("../../../services/topology/olt/olt.services");

class OltController {

  // =====================================================
  // HELPER ERROR RESPONSE
  // =====================================================

  handleError(res, err) {
    const message = err.message || "Internal Server Error";

    if (message.includes("tidak ditemukan")) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("sudah ada") ||
      message.includes("sudah digunakan") ||
      message.includes("sedang digunakan")
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }

  // =====================================================
  // CREATE OLT
  // =====================================================

  create = async (req, res) => {
    try {
      const result = await oltService.create(req.body);

      return res.status(201).json({
        success: true,
        message: "OLT berhasil dibuat",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // ADD PORTS
  // =====================================================

  addPorts = async (req, res) => {
    try {
      const result = await oltService.addPorts(
        req.params.id,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: "Port berhasil ditambahkan",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // DELETE PORT
  // =====================================================

  deletePort = async (req, res) => {
    try {
      const result = await oltService.deletePort(
        req.params.portId
      );

      return res.status(200).json({
        success: true,
        message: "Port berhasil dihapus",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // GET ALL OLT
  // =====================================================

  findAll = async (req, res) => {
    try {
      const result = await oltService.findAll();

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // GET BY ROUTER
  // =====================================================

  findByRouter = async (req, res) => {
    try {
      const result = await oltService.findByRouter(
        req.params.routerId
      );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // GET BY ID
  // =====================================================

  findById = async (req, res) => {
    try {
      const result = await oltService.findById(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // UPDATE OLT
  // =====================================================

  update = async (req, res) => {
    try {
      const result = await oltService.update(
        req.params.id,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "OLT berhasil diupdate",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // DELETE OLT
  // =====================================================

  delete = async (req, res) => {
    try {
      const result = await oltService.delete(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message: "OLT berhasil dihapus",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // BULK DELETE
  // =====================================================

  bulkDelete = async (req, res) => {
    try {
      const result = await oltService.bulkDelete(
        req.body.ids
      );

      return res.status(200).json({
        success: true,
        message: "OLT berhasil dihapus",
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };

  // =====================================================
  // OLT SUMMARY
  // =====================================================

  getSummary = async (req, res) => {
    try {
      const result = await oltService.getSummary(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (err) {
      return this.handleError(res, err);
    }
  };
}

module.exports = new OltController();