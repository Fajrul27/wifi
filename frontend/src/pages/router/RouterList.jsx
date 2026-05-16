import { useEffect, useState } from "react";
import api from "../../services/api";

export default function Routers() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [form, setForm] = useState({
    id: null,
    name: "",
    host: "",
    username: "",
    password: "",
    port: 8728,
    latitude: "",
    longitude: "",
  });

  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ───────────────── LOAD DATA ───────────────── */
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/routers");
      setData(res.data);
    } catch (err) {
      console.error("Failed to load routers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ───────────────── MODAL HANDLERS ───────────────── */
  const openCreate = () => {
    resetForm();
    setIsEdit(false);
    setShowModal(true);
  };

  const openEdit = (r) => {
    setForm({
      id: r.id,
      name: r.name,
      host: r.host,
      username: r.username,
      password: r.password,
      port: r.port,
      latitude: r.latitude ?? "",
      longitude: r.longitude ?? "",
    });
    setIsEdit(true);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      host: "",
      username: "",
      password: "",
      port: 8728,
      latitude: "",
      longitude: "",
    });
  };

  /* ───────────────── SUBMIT FORM ───────────────── */
  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...form,
        port: parseInt(form.port) || 8728,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      };

      if (isEdit) {
        await api.put(`/routers/${form.id}`, payload);
      } else {
        await api.post("/routers", payload);
      }

      closeModal();
      load();
    } catch (err) {
      console.error("Failed to save router:", err);
      alert("Gagal menyimpan router");
    } finally {
      setSubmitting(false);
    }
  };

  /* ───────────────── DELETE ───────────────── */
  const confirmDelete = async () => {
    try {
      await api.delete(`/routers/${deleteId}`);
      setDeleteId(null);
      load();
    } catch (err) {
      console.error("Failed to delete router:", err);
      alert("Gagal menghapus router");
    }
  };

  /* ───────────────── TEST CONNECTION ───────────────── */
  const testConnection = async (id) => {
    setTestingId(id);
    try {
      await api.post(`/routers/${id}/test-connection`);
      load();
    } catch (err) {
      console.error("Connection test failed:", err);
      alert("Connection test failed");
    } finally {
      setTestingId(null);
    }
  };

  /* ───────────────── STATUS BADGE ───────────────── */
  const StatusBadge = ({ online }) => (
    <span
      className={`badge rounded-pill px-3 py-2 ${
        online
          ? "bg-success-subtle text-success-emphasis border border-success-subtle"
          : "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle"
      }`}
    >
      <i
        className={`bi bi-circle-fill me-1 ${online ? "text-success" : "text-secondary"}`}
        style={{ fontSize: "0.6rem" }}
      ></i>
      {online ? "Online" : "Offline"}
    </span>
  );

  /* ───────────────── MAIN RENDER ───────────────── */
  return (
    <div className="container-fluid py-3" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-router me-2"></i>Routers
          </h3>
          <p className="text-muted mb-0 small">Manage your MikroTik router connections</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={openCreate}>
          <i className="bi bi-plus-lg"></i>
          Add Router
        </button>
      </div>

 

      {/* TABLE CARD */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3">
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-list-ul me-2"></i>Router List
            <span className="badge bg-secondary ms-2">{data.length}</span>
          </h5>
        </div>
        
        <div className="table-responsive">
          {loading ? (
            <div className="d-flex justify-content-center align-items-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2 text-muted">Loading routers...</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              <p className="mb-0">No routers found</p>
              <button className="btn btn-sm btn-outline-primary mt-2" onClick={openCreate}>
                + Add your first router
              </button>
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Host</th>
                  <th>Port</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th className="text-end" style={{ width: "220px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className={r.isOnline ? "" : "opacity-75"}>
                    <td>
                      <div className="fw-medium">{r.name}</div>
                      {(r.latitude || r.longitude) && (
                        <small className="text-muted">
                          <i className="bi bi-geo-alt me-1"></i>
                          {r.latitude?.toFixed(3)}, {r.longitude?.toFixed(3)}
                        </small>
                      )}
                    </td>
                    <td>
                      <code className="small">{r.host}</code>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{r.port}</span>
                    </td>
                    <td>
                      <StatusBadge online={r.isOnline} />
                    </td>
                    <td>
                      {r.lastSeen ? (
                        <small className="text-muted">
                          {new Date(r.lastSeen).toLocaleString("id-ID")}
                        </small>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-info"
                          onClick={() => testConnection(r.id)}
                          disabled={testingId === r.id}
                          title="Test Connection"
                        >
                          {testingId === r.id ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                          ) : (
                            <i className="bi bi-wifi"></i>
                          )}
                        </button>
                        <button
                          className="btn btn-outline-warning"
                          onClick={() => openEdit(r)}
                          title="Edit Router"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => setDeleteId(r.id)}
                          title="Delete Router"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* =========================
          MODAL FORM (Create/Edit)
      ========================= */}
      {/* =========================
          MODAL FORM (Create/Edit)
      ========================= */}
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}
          onClick={closeModal}
        >
          <div 
            className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white" style={{ maxHeight: "90vh" }}>
              
              <div className="modal-header bg-light py-3 px-4 border-bottom border-secondary-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 fs-5 mb-0">
                  <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                    <i className={`bi bi-${isEdit ? "pencil" : "plus-circle"}`}></i>
                  </div>
                  <span>{isEdit ? "Edit Router" : "Add New Router"}</span>
                </h5>
                <button type="button" className="btn-close bg-secondary bg-opacity-10 p-2 rounded-circle shadow-none" onClick={closeModal}></button>
              </div>

              <form onSubmit={submit} className="d-flex flex-column overflow-hidden" style={{ flex: 1 }}>
                <div className="modal-body p-4 overflow-y-auto">
                  
                  {/* Connection Settings */}
                  <h6 className="text-muted text-uppercase fw-bold mb-3 small tracking-wider">
                    <i className="bi bi-plug me-2 text-primary"></i> Pengaturan Koneksi
                  </h6>
                  <div className="row g-4 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Nama Router *</label>
                      <input
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: Router Pusat"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Host / IP Address *</label>
                      <input
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="contoh: 192.168.88.1"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Port API</label>
                      <input
                        type="number"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="8728"
                        value={form.port}
                        onChange={(e) => setForm({ ...form, port: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Username API</label>
                      <input
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="admin"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-secondary mb-1">Password API</label>
                      <input
                        type="password"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Location Settings */}
                  <h6 className="text-muted text-uppercase fw-bold mb-3 small tracking-wider">
                    <i className="bi bi-geo-alt me-2 text-primary"></i> Koordinat Lokasi (Opsional)
                  </h6>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="-6.2088"
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-secondary mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-control form-control-lg rounded-3 border-secondary-subtle fs-6 shadow-none"
                        placeholder="106.8456"
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-primary bg-opacity-10 border border-primary-subtle rounded-4 small text-secondary d-flex align-items-center gap-2 shadow-sm">
                    <i className="bi bi-info-circle-fill text-primary fs-5"></i>
                    <div>Tip: Klik kanan pada Google Maps → pilih koordinat angka paling atas untuk menyalin Latitude dan Longitude.</div>
                  </div>

                </div>

                <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle">
                  <button 
                    type="button" 
                    className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" 
                    onClick={closeModal}
                    disabled={submitting}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <i className={`bi bi-${isEdit ? "check-lg" : "plus-lg"}`}></i>
                        {isEdit ? "Simpan Perubahan" : "Tambahkan Router"}
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* =========================
          DELETE CONFIRMATION MODAL
      ========================= */}
      {deleteId && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden bg-white">
              
              <div className="modal-header bg-danger bg-opacity-10 py-3 px-4 border-bottom border-danger-subtle d-flex align-items-center justify-content-between">
                <h5 className="modal-title text-danger fw-bold d-flex align-items-center gap-2 fs-5 mb-0">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Hapus Router?</span>
                </h5>
                <button type="button" className="btn-close bg-danger bg-opacity-10 p-2 rounded-circle shadow-none" onClick={() => setDeleteId(null)}></button>
              </div>

              <div className="modal-body p-4">
                <p className="text-secondary mb-0 fs-6">
                  Apakah Anda yakin ingin menghapus router ini? <br/>
                  <strong className="text-danger fw-semibold">Tindakan ini tidak dapat dibatalkan.</strong>
                </p>
                {data.find((r) => r.id === deleteId) && (
                  <div className="mt-4 p-3 bg-light border border-secondary-subtle rounded-4 shadow-sm">
                    <div className="small text-muted fw-medium mb-1">Router yang akan dihapus:</div>
                    <div className="fw-bold text-dark fs-6">
                      {data.find((r) => r.id === deleteId)?.name}
                    </div>
                    <div className="small text-muted mt-1">
                      <code className="bg-secondary bg-opacity-10 px-2 py-1 rounded text-dark fw-semibold">{data.find((r) => r.id === deleteId)?.host}</code>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer py-3 px-4 bg-light border-top border-secondary-subtle justify-content-end gap-2">
                <button 
                  className="btn btn-secondary rounded-3 px-4 py-2 fw-medium shadow-sm" 
                  onClick={() => setDeleteId(null)}
                >
                  Batal
                </button>
                <button 
                  className="btn btn-danger rounded-3 px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" 
                  onClick={confirmDelete}
                >
                  <i className="bi bi-trash"></i>
                  Ya, Hapus Router
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}