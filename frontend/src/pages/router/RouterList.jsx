import { useEffect, useState } from "react";
import api from "../../services/api";
import MapPicker from "../../components/MapPicker";

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
      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          onClick={closeModal}
        >
          <div 
            className="modal-dialog modal-dialog-centered modal-lg" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow">
              
              <div className="modal-header">
                <h5 className="modal-title fw-semibold">
                  <i className={`bi bi-${isEdit ? "pencil" : "plus-circle"} me-2`}></i>
                  {isEdit ? "Edit Router" : "Add New Router"}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>

              <form onSubmit={submit}>
                <div className="modal-body">
                  
                  {/* Connection Settings */}
                  <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                    <i className="bi bi-plug me-1"></i>Connection Settings
                  </h6>
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Name *</label>
                      <input
                        className="form-control"
                        placeholder="My Router"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Host/IP *</label>
                      <input
                        className="form-control"
                        placeholder="192.168.88.1"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Port</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="8728"
                        value={form.port}
                        onChange={(e) => setForm({ ...form, port: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Username</label>
                      <input
                        className="form-control"
                        placeholder="admin"
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Location Settings */}
                  <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                    <i className="bi bi-geo-alt me-1"></i>Location (Optional)
                  </h6>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="-6.2088"
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="106.8456"
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <MapPicker
                      lat={form.latitude}
                      lng={form.longitude}
                      onChange={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })}
                      height={250}
                    />
                  </div>
                  <div className="mt-2 p-3 bg-light rounded small text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Tip: Right-click on Google Maps → "What's here?" to copy coordinates.
                  </div>

                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={closeModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className={`bi bi-${isEdit ? "check-lg" : "plus-lg"} me-1`}></i>
                        {isEdit ? "Update" : "Create"}
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
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title text-danger fw-semibold">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Delete Router?
                </h5>
                <button type="button" className="btn-close" onClick={() => setDeleteId(null)}></button>
              </div>

              <div className="modal-body">
                <p className="text-muted mb-0">
                  Are you sure you want to delete this router? <br/>
                  <strong className="text-danger">This action cannot be undone.</strong>
                </p>
                {data.find((r) => r.id === deleteId) && (
                  <div className="mt-3 p-3 bg-light rounded">
                    <div className="small text-muted">Deleting:</div>
                    <div className="fw-medium">
                      {data.find((r) => r.id === deleteId)?.name}
                    </div>
                    <div className="small text-muted">
                      <code>{data.find((r) => r.id === deleteId)?.host}</code>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer border-top-0 pt-0">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setDeleteId(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={confirmDelete}
                >
                  <i className="bi bi-trash me-1"></i>
                  Yes, Delete
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}