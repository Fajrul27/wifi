const AuthService = require("../services/auth.service");

class AuthController {

  /* =========================
     LOGIN
  ========================= */
  static async login(req, res) {
    try {
      const { identifier, password } = req.body;

      const result = await AuthService.login(identifier, password);

      res.cookie("token", result.token, {
        httpOnly: true,
        secure: false, // production: true (HTTPS)
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: "Login success",
        user: result.user,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     LOGOUT
  ========================= */
  static async logout(req, res) {
    try {
      const token = req.cookies?.token;

      if (token) {
        await AuthService.logout(token);
      }

      res.clearCookie("token");

      return res.json({
        success: true,
        message: "Logout berhasil",
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  }

  /* =========================
     ME (PROFILE)
  ========================= */
  static async me(req, res) {
    try {
      // ambil dari DB biar selalu up-to-date
      const user = await AuthService.getProfile(req.user.userId);

      return res.json({
        success: true,
        user,
      });

    } catch (err) {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }
  }
}

module.exports = AuthController;