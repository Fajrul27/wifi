import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
        setForm({
          username: res.data.user.username || "",
          email: res.data.user.email || "",
          password: "",
        });
      } catch (err) {
        console.log(err);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put("/auth/me", form);
      setUser(res.data.user);
      setForm(prev => ({ ...prev, password: "" }));
      showToast("Profil berhasil diperbarui!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || err.message, "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
          <div className={`toast show align-items-center text-white bg-${toast.type} border-0 shadow-lg`} role="alert">
            <div className="d-flex">
              <div className="toast-body d-flex align-items-center">
                <i className={`bi bi-${toast.type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill'} me-2 fs-5`}></i>
                {toast.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(prev => ({ ...prev, show: false }))}></button>
            </div>
          </div>
        </div>
      )}

      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ background: "#ffffff" }}>
            {/* Header Banner */}
            <div style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              height: "140px",
              position: "relative"
            }}>
              <div style={{
                position: "absolute",
                bottom: "-50px",
                left: "40px",
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                width: "100px", height: "100px",
                borderRadius: "50%",
                border: "4px solid #ffffff",
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#ffffff", fontSize: "2.5rem", fontWeight: "bold"
              }}>
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
            </div>

            <div className="card-body" style={{ padding: "60px 40px 40px" }}>
              <div className="d-flex justify-content-between align-items-start mb-5">
                <div>
                  <h3 className="fw-bold mb-1 text-dark">{user?.username || "Loading..."}</h3>
                  <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-pill fw-semibold">
                    <i className="bi bi-shield-check me-1"></i> {user?.role || "USER"}
                  </span>
                </div>
                <div className="text-muted small">
                  <i className="bi bi-calendar3 me-1"></i> Terdaftar sejak: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                </div>
              </div>

              <form onSubmit={handleSave}>
                <div className="row g-4 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-secondary small mb-2">
                      <i className="bi bi-person-fill me-1 text-primary"></i> Username
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold text-secondary small mb-2">
                      <i className="bi bi-envelope-fill me-1 text-primary"></i> Email Address
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-12">
                    <label className="form-label fw-bold text-secondary small mb-2">
                      <i className="bi bi-shield-lock-fill me-1 text-primary"></i> Ganti Password <span className="text-muted fw-normal">(Opsional)</span>
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-lg bg-light border-0 px-3 py-2 rounded-3"
                      placeholder="Kosongkan jika tidak ingin mengubah password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    <div className="form-text mt-2 text-muted small">
                      *Masukkan password baru jika Anda ingin mengganti sandi akun Anda.
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end pt-3 border-top">
                  <button
                    type="submit"
                    className="btn btn-primary px-5 py-2 fw-bold rounded-3 shadow-sm d-flex align-items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle fs-5"></i> Simpan Perubahan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}