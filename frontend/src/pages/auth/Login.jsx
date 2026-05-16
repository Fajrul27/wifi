import { useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await api.post("/auth/login", {
        identifier: email,
        password,
      });

      const user = res.data.user; // ✔ dari backend

      // ✔ REDIRECT BERDASARKAN ROLE
      if (user.role === "ADMIN") {
        navigate("/admin");
      } else if (user.role === "TEKNISI") {
        navigate("/teknisi");
      } else {
        navigate("/");
      }

    } catch (err) {
      setError(err.response?.data?.message || "Login gagal");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* BACKGROUND */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />

      {/* OVERLAY */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(15, 10, 30, 0.75)",
          zIndex: 1,
        }}
      />

      {/* CARD */}
      <div
        className="card border-0 shadow-lg p-4 p-md-5 mx-3"
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "rgba(255,255,255,0.95)",
          borderRadius: "16px",
          zIndex: 2,
        }}
      >
        <div className="text-center mb-4">
          <h2 className="fw-bold">InfraPanel</h2>
          <p className="text-muted small">
            Masuk untuk mengelola sistem
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {/* USERNAME / EMAIL */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Email / Username
            </label>

            <input
              type="text"
              className="form-control py-2"
              placeholder="admin / email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              Password
            </label>

            <div className="position-relative">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control py-2 pe-5"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="btn btn-sm position-absolute end-0 top-50 translate-middle-y me-2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="alert alert-danger py-2 small">
              {error}
            </div>
          )}

          {/* BUTTON */}
          <button
            type="submit"
            className="btn w-100 py-2 text-white"
            style={{ backgroundColor: "#6f42c1" }}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}