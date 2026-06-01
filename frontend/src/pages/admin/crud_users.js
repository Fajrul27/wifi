import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Technician() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [alert, setAlert] = useState(null);

  const initialForm = {
    id: null,
    username: "",
    email: "",
    password: "",
    status: "AKTIF",
    area: "",
    phone: "",
  };

  const [form, setForm] = useState(initialForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/technicians");
      setData(res.data.data);
    } catch (err) {
      setAlert({ type: "danger", msg: "Gagal memuat data teknisi" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setForm(initialForm);
    setIsEdit(false);
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setForm({
      id: user.id,
      username: user.username,
      email: user.email,
      password: "", // empty so it won't update unless typed
      status: user.status || "AKTIF",
      area: user.area || "",
      phone: user.phone || "",
    });
    setIsEdit(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setAlert(null);
    try {
      if (isEdit) {
        await api.put(`/admin/technicians/${form.id}`, form);
        setAlert({ type: "success", msg: "Teknisi berhasil diperbarui" });
      } else {
        await api.post("/admin/technicians", form);
        setAlert({ type: "success", msg: "Teknisi berhasil ditambahkan" });
      }
      setShowModal(false);
      load();
    } catch (err) {
      setAlert({ type: "danger", msg: err.response?.data?.message || "Terjadi kesalahan" });
    } finally {
      setActionLoading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus teknisi ini?")) return;
    
    try {
      await api.delete(`/admin/technicians/${id}`);
      setAlert({ type: "success", msg: "Teknisi berhasil dihapus" });
      load();
    } catch (err) {
      setAlert({ type: "danger", msg: err.response?.data?.message || "Gagal menghapus teknisi" });
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-0">Manajemen Teknisi</h4>
          <p className="text-muted mb-0 small">Kelola data teknisi, area kerja, dan status</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={handleOpenCreate}>
          <i className="bi bi-person-plus me-2"></i> Tambah Teknisi
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type} alert-dismissible fade show`} role="alert">
          {alert.msg}
          <button type="button" className="btn-close" onClick={() => setAlert(null)}></button>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="px-4 py-3">Nama Teknisi</th>
                  <th className="py-3">Kontak</th>
                  <th className="py-3">Area Kerja</th>
                  <th className="py-3">Status</th>
                  <th className="text-end px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      Memuat data teknisi...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      Belum ada data teknisi
                    </td>
                  </tr>
                ) : (
                  data.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <div className="d-flex align-items-center">
                          <div 
                            className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center me-3" 
                            style={{width: 40, height: 40}}
                          >
                            <i className="bi bi-person-gear"></i>
                          </div>
                          <div>
                            <div className="fw-bold">{u.username}</div>
                            <small className="text-muted">ID: {u.id}</small>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="mb-1"><i className="bi bi-envelope text-muted me-2"></i>{u.email}</div>
                        {u.phone && <div><i className="bi bi-telephone text-muted me-2"></i>{u.phone}</div>}
                      </td>
                      <td className="py-3">
                        {u.area ? (
                          <span className="badge bg-info bg-opacity-10 text-info px-2 py-1 border border-info border-opacity-25">
                            <i className="bi bi-geo-alt me-1"></i> {u.area}
                          </span>
                        ) : <span className="text-muted small">-</span>}
                      </td>
                      <td className="py-3">
                        <span className={`badge bg-${u.status === 'AKTIF' ? 'success' : u.status === 'CUTI' ? 'warning' : 'danger'}`}>
                          {u.status || 'AKTIF'}
                        </span>
                      </td>
                      <td className="text-end px-4 py-3">
                        <button className="btn btn-sm btn-light text-primary me-2 shadow-sm border" onClick={() => handleOpenEdit(u)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-sm btn-light text-danger shadow-sm border" onClick={() => remove(u.id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah/Edit */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg rounded-4">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header border-bottom-0 pb-0 pt-4 px-4">
                    <h5 className="modal-title fw-bold">{isEdit ? 'Edit Teknisi' : 'Tambah Teknisi Baru'}</h5>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label text-muted small fw-bold">Username</label>
                      <input
                        className="form-control form-control-lg fs-6"
                        placeholder="Masukkan username"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label text-muted small fw-bold">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="contoh@email.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label text-muted small fw-bold">No. WhatsApp</label>
                        <input
                          className="form-control"
                          placeholder="08123456789"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label text-muted small fw-bold">Area Kerja</label>
                      <input
                        className="form-control"
                        placeholder="Contoh: Area Timur, Kecamatan X"
                        value={form.area}
                        onChange={(e) => setForm({ ...form, area: e.target.value })}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label text-muted small fw-bold">Status Teknisi</label>
                      <select 
                        className="form-select"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="AKTIF">AKTIF - Siap Bertugas</option>
                        <option value="CUTI">CUTI - Tidak Tersedia</option>
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label text-muted small fw-bold">Password {isEdit && '(Opsional)'}</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder={isEdit ? "Kosongkan jika tidak diubah" : "Masukkan password awal"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required={!isEdit}
                      />
                    </div>
                  </div>
                  <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
                    <button type="button" className="btn btn-light px-4" onClick={() => setShowModal(false)} disabled={actionLoading}>
                      Batal
                    </button>
                    <button type="submit" className="btn btn-primary px-4" disabled={actionLoading}>
                      {actionLoading ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}