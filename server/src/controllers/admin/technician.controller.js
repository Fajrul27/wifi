const TechnicianService = require("../../services/admin/technician.service");

class TechnicianController {

  /* =========================
     CREATE TEKNISI
  ========================= */
  static async create(req, res) {
    try {
      const { username, email, password } = req.body;

      const user = await TechnicianService.create(
        req.user,
        username,
        email,
        password
      );

      return res.json({
        success: true,
        message: "Teknisi berhasil dibuat",
        data: user,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     GET ALL TEKNISI
  ========================= */
  static async getAll(req, res) {
    try {
      const data = await TechnicianService.getAll();

      return res.json({
        success: true,
        data,
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     GET BY ID TEKNISI
  ========================= */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const user = await TechnicianService.getById(parseInt(id));

      return res.json({
        success: true,
        data: user,
      });

    } catch (err) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     UPDATE TEKNISI
  ========================= */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { username, email, password } = req.body;

      const user = await TechnicianService.update(
        req.user,
        parseInt(id),
        { username, email, password }
      );

      return res.json({
        success: true,
        message: "Teknisi berhasil diupdate",
        data: user,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     DELETE TEKNISI
  ========================= */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      await TechnicianService.delete(req.user, parseInt(id));

      return res.json({
        success: true,
        message: "Teknisi berhasil dihapus",
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }
}

module.exports = TechnicianController;