import { useEffect, useState } from "react";
import api from "../../services/api";
import UserTable from "./components/UserTable";
import UserModal from "./components/UserModal";

export default function Technician() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "TEKNISI" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/technicians");
      setData(res.data.data || []);
    } catch (err) {
      showToast("Gagal memuat data pengguna", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setForm({ username: "", email: "", password: "", role: "TEKNISI" });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode("edit");
    setSelectedId(user.id);
    setForm({ username: user.username, email: user.email, password: "", role: user.role || "TEKNISI" });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalMode === "create") {
        await api.post("/admin/technicians", form);
        showToast("Pengguna berhasil ditambahkan!", "success");
      } else {
        await api.put(`/admin/technicians/${selectedId}`, form);
        showToast("Data pengguna berhasil diperbarui!", "success");
      }
      setShowModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${name}"?`)) return;
    try {
      await api.delete(`/admin/technicians/${id}`);
      showToast("Pengguna berhasil dihapus!", "success");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || err.message, "danger");
    }
  };

  const filteredData = data.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">Manajemen Pengguna & Tim</h3>
          <p className="text-muted small mb-0">Kelola akun karyawan, teknisi lapangan, NOC, dan helpdesk beserta hak aksesnya</p>
        </div>
        <button className="btn btn-primary px-4 py-2 fw-bold rounded-3 shadow-sm d-flex align-items-center gap-2" onClick={openCreateModal}>
          <i className="bi bi-person-plus-fill fs-5"></i> Tambah Pengguna
        </button>
      </div>

      {/* Filter Card */}
      <div className="card border-0 shadow-sm rounded-4 mb-4 p-3 bg-white">
        <div className="row g-3 align-items-center">
          <div className="col-md-6">
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
              <input
                type="text"
                className="form-control bg-light border-0"
                placeholder="Cari berdasarkan username atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-6 text-md-end text-muted small">
            Menampilkan <span className="fw-bold text-dark">{filteredData.length}</span> dari <span className="fw-bold text-dark">{data.length}</span> pengguna
          </div>
        </div>
      </div>

      {/* User Table Component */}
      <UserTable
        data={filteredData}
        loading={loading}
        onEdit={openEditModal}
        onRemove={remove}
      />

      {/* User Modal Component */}
      <UserModal
        show={showModal}
        mode={modalMode}
        form={form}
        saving={saving}
        onChange={setForm}
        onSubmit={handleSave}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}