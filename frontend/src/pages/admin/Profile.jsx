import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data.user);
        setFormData({
          username: res.data.user.username,
          email: res.data.user.email,
          password: "",
        });
      } catch (err) {
        console.log(err);
      }
    };
    
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);
    try {
      const res = await api.put("/auth/profile", formData);
      setUser(res.data.user);
      setIsEditing(false);
      setAlert({ type: "success", msg: "Profile berhasil diupdate!" });
      setFormData(prev => ({ ...prev, password: "" })); // reset password field
    } catch (err) {
      setAlert({ type: "danger", msg: err.response?.data?.message || "Gagal update profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">

          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="mb-0">Profile Saya</h4>
            {!isEditing && (
              <button className="btn btn-outline-primary btn-sm" onClick={() => setIsEditing(true)}>
                <i className="bi bi-pencil me-1"></i> Edit Profile
              </button>
            )}
          </div>

          {alert && (
            <div className={`alert alert-${alert.type} alert-dismissible fade show`} role="alert">
              {alert.msg}
              <button type="button" className="btn-close" onClick={() => setAlert(null)}></button>
            </div>
          )}

          <div className="row">
            {/* LEFT */}
            <div className="col-md-4 text-center border-end">
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{ width: 100, height: 100, fontSize: 40 }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </div>

              <h5 className="mb-1">{user?.username}</h5>
              <span className="badge bg-secondary mb-3">{user?.role}</span>
              
              {(user?.status || user?.area || user?.phone) && (
                <div className="text-start mt-4 px-3">
                  <h6 className="text-muted fw-bold mb-3" style={{ fontSize: '0.85rem' }}>INFORMASI TEKNISI</h6>
                  {user?.status && (
                    <div className="mb-2">
                      <small className="text-muted d-block">Status</small>
                      <span className={`badge bg-${user.status === 'AKTIF' ? 'success' : user.status === 'CUTI' ? 'warning' : 'danger'}`}>
                        {user.status}
                      </span>
                    </div>
                  )}
                  {user?.area && (
                    <div className="mb-2">
                      <small className="text-muted d-block">Area Kerja</small>
                      <span>{user.area}</span>
                    </div>
                  )}
                  {user?.phone && (
                    <div className="mb-2">
                      <small className="text-muted d-block">No. Telepon</small>
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="col-md-8 px-md-4">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label text-muted small fw-bold">Username</label>
                  <input
                    name="username"
                    className={`form-control ${isEditing ? '' : 'bg-light'}`}
                    value={isEditing ? formData.username : (user?.username || "")}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted small fw-bold">Email</label>
                  <input
                    type="email"
                    name="email"
                    className={`form-control ${isEditing ? '' : 'bg-light'}`}
                    value={isEditing ? formData.email : (user?.email || "")}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>

                {isEditing && (
                  <div className="mb-4">
                    <label className="form-label text-muted small fw-bold">Password Baru (Opsional)</label>
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      placeholder="Kosongkan jika tidak ingin mengubah"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <small className="text-muted">Password minimal 6 karakter jika diisi.</small>
                  </div>
                )}

                {!isEditing && (
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-bold">Role Akses</label>
                    <input
                      className="form-control bg-light"
                      value={user?.role || ""}
                      disabled
                    />
                  </div>
                )}

                {isEditing && (
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary px-4" disabled={loading}>
                      {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-light" 
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          username: user?.username,
                          email: user?.email,
                          password: "",
                        });
                      }}
                      disabled={loading}
                    >
                      Batal
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}